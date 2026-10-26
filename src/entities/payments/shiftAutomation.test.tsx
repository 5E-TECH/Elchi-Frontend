import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isShiftAiPendingStale,
  normalizeShiftCheckSettings,
  normalizeShiftReport,
  resetShiftAiPendingTracker,
  SHIFT_PENDING_MAX_MS,
  SHIFT_PENDING_POLL_MS,
  useShiftAiTimedOut,
  useShiftReport,
} from "./shiftAccountCheck";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("../../shared/api/api", () => ({ api: http, API_TIMEOUT_MS: 20_000, LONG_REQUEST_TIMEOUT_MS: 120_000 }));

/** y8Tqm9Ap + gWI4gYkw — sozlama / hisobot normalizatorlari. */
describe("shift automation contract (y8Tqm9Ap, gWI4gYkw)", () => {
  it("settings: auto_close times are validated, de-duplicated and sorted; report recipients × channels; old backend → null", () => {
    const settings = normalizeShiftCheckSettings({
      data: {
        account_check_enabled: true,
        cards: [],
        auto_close: { enabled: true, times: ["23:00", "14:00", "14:00", "25:00", 9], scope: "main+branches", warn_before_min: 0 },
        report: { recipients: { superadmin: { telegram: true, in_app: false }, couriers: {} }, format: "xlsx" },
      },
    });
    expect(settings.auto_close).toEqual({ enabled: true, times: ["14:00", "23:00"], scope: "main+branches", warn_before_min: 0 });
    expect(settings.report).toEqual({
      recipients: {
        superadmin: { telegram: true, in_app: false },
        couriers: { telegram: false, in_app: false },
        markets: { telegram: false, in_app: false },
      },
      format: "xlsx",
    });
    const old = normalizeShiftCheckSettings({ data: { account_check_enabled: false, cards: [] } });
    expect(old.auto_close).toBeNull();
    expect(old.report).toBeNull();
    // Yaroqsiz scope / ogohlantirish — sukutga tushadi.
    expect(
      normalizeShiftCheckSettings({ data: { cards: [], auto_close: { scope: "all", warn_before_min: 999 } } }).auto_close,
    ).toEqual({ enabled: false, times: [], scope: "main", warn_before_min: 15 });
  });

  it("report: close_reason=auto → auto_close banner data; deliveries are normalized, broken rows dropped", () => {
    const report = normalizeShiftReport({
      data: {
        shift: { id: 31, status: "closed", closed_at: "2026-10-26T18:00:00.000Z" },
        close_reason: "auto",
        closed_by_system: true,
        auto_close: { closed_at: "2026-10-26T18:00:00.000Z", label: "Avtomatik yopildi — 23:00, kassir yopmagan" },
        report: { status: "sent", round: 2, file_format: "pdf", has_file: true, file_url: "https://files.example/r.pdf" },
        deliveries: [
          { round: 2, recipient_id: 7, recipient_name: "Bekzod", recipient_kind: "courier", channel: "telegram", status: "failed", failed_reason: "Telegram ulanmagan" },
          { round: 2, recipient_id: 8, recipient_kind: "robot", channel: "telegram", status: "sent" },
        ],
      },
    });
    expect(report?.close_reason).toBe("auto");
    expect(report?.closed_by_system).toBe(true);
    expect(report?.auto_close).toEqual({ closed_at: "2026-10-26T18:00:00.000Z", label: "Avtomatik yopildi — 23:00, kassir yopmagan" });
    expect(report?.report).toEqual({ status: "sent", round: 2, file_format: "pdf", has_file: true, file_url: "https://files.example/r.pdf" });
    expect(report?.deliveries).toEqual([
      {
        id: null,
        round: 2,
        recipient_id: "7",
        recipient_name: "Bekzod",
        recipient_kind: "courier",
        channel: "telegram",
        status: "failed",
        failed_reason: "Telegram ulanmagan",
        sent_at: null,
        created_at: null,
      },
    ]);
    // Eski backend / qo'lda yopilgan smena.
    const manual = normalizeShiftReport({ data: { shift: { id: 31, status: "closed" }, close_reason: "manual", auto_close: null } });
    expect(manual?.auto_close).toBeNull();
    expect(manual?.deliveries).toEqual([]);
    expect(manual?.report).toBeNull();
  });
});

/** Review: AI `pending` uzoq tursa 5 s lik so'rov ~3 daqiqadan keyin to'xtaydi va holat «kelmadi» bo'ladi. */
describe("AI pending polling stops after SHIFT_PENDING_MAX_MS", () => {
  const pendingReport = (status = "pending") => ({
    data: {
      statusCode: 200,
      data: {
        shift: { id: "31", status: "open" },
        accounts: [{ card_id: "1", ai_status: status, has_photo: true, photo_uploaded_at: "2026-10-26T17:41:00.000Z" }],
        operations: [],
      },
    },
  });

  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    vi.useFakeTimers();
    resetShiftAiPendingTracker();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    http.get.mockReset();
    http.get.mockImplementation(async () => pendingReport());
  });
  afterEach(() => {
    client.clear();
    vi.useRealTimers();
  });

  it("polls every 5 s while pending, then stops after ~3 minutes and reports the card as timed out", async () => {
    const { result } = renderHook(
      () => {
        const query = useShiftReport("31", { pollPending: true });
        return { query, timedOut: useShiftAiTimedOut("31", query.data?.accounts) };
      },
      { wrapper },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(http.get).toHaveBeenCalledTimes(1);
    expect(result.current.timedOut.size).toBe(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SHIFT_PENDING_POLL_MS * 3);
    });
    expect(http.get).toHaveBeenCalledTimes(4);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SHIFT_PENDING_MAX_MS);
    });
    const calls = http.get.mock.calls.length;
    expect(calls).toBeLessThanOrEqual(1 + SHIFT_PENDING_MAX_MS / SHIFT_PENDING_POLL_MS + 1);
    expect(result.current.timedOut.has("1")).toBe(true);

    // Muddat o'tgach — boshqa so'rov yo'q.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SHIFT_PENDING_POLL_MS * 6);
    });
    expect(http.get).toHaveBeenCalledTimes(calls);
  });

  it("a re-uploaded photo (new photo_uploaded_at) starts a fresh window; a finished check is never stale", () => {
    const row = { card_id: "1", ai_status: "pending" as const, photo_uploaded_at: "2026-10-26T17:41:00.000Z" };
    const t0 = Date.now();
    expect(isShiftAiPendingStale("31", row, t0)).toBe(false);
    expect(isShiftAiPendingStale("31", row, t0 + SHIFT_PENDING_MAX_MS)).toBe(true);
    expect(isShiftAiPendingStale("31", { ...row, photo_uploaded_at: "2026-10-26T17:50:00.000Z" }, t0 + SHIFT_PENDING_MAX_MS)).toBe(
      false,
    );
    expect(isShiftAiPendingStale("31", { ...row, ai_status: "match" }, t0 + SHIFT_PENDING_MAX_MS * 2)).toBe(false);
  });
});
