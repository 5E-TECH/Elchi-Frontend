import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../../shared/config/queryKeys";
import {
  advisorEnvelope,
  advisorHttpError,
  createAdvisorFixtures,
  RESOLVE_NOTE,
} from "../../../test/aiAdvisorFixtures";
import { mergeExplainResult, useDismissAlert, useExplainAlert, useResolveAlert } from "./useAlertMutations";
import { useSaveAdvisorSettings } from "./useSaveAdvisorSettings";

/**
 * Ogohlantirish amallari va sozlamalarni saqlash — so'rov tanasi (shartnoma §7.4–7.7, #644) va kesh ta'siri (plan §3):
 * PATCH javobi tafsilotga yoziladi, nishon (`overview`) va ro'yxatlar eskiradi; 409 — qayta o'qiladi; explain 202
 * tafsilotga qo'shiladi; 429 keshni o'zgartirmaydi; sozlamalar javobi zond keshiga `available` bo'lib yoziladi.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: mocks.post, patch: mocks.patch, put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const fx = createAdvisorFixtures();
const LIST_KEY = queryKeys.aiAdvisor.alertList({ page: 1, limit: 10 });
const COUNT_KEY = queryKeys.aiAdvisor.alertCount({ severity: "critical" });
const ALERT_KEY = queryKeys.aiAdvisor.alert("1040");
const OTHER_ALERT_KEY = queryKeys.aiAdvisor.alert("1041");
const WRITE_CONFIG = { silentNetworkError: true };

const setup = <T,>(hook: () => T) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 }, mutations: { retry: false } } });
  client.setQueryData(queryKeys.aiAdvisor.overview, { kind: "available", data: fx.overview });
  client.setQueryData(LIST_KEY, fx.list);
  client.setQueryData(COUNT_KEY, fx.list);
  client.setQueryData(ALERT_KEY, fx.detail.r1);
  client.setQueryData(OTHER_ALERT_KEY, fx.detail.r2);
  client.setQueryData(queryKeys.aiAdvisor.settings, { kind: "available", data: fx.settings });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(hook, { wrapper });
  const invalidated = (key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated ?? false;
  return { client, result, invalidated };
};

afterEach(() => vi.clearAllMocks());

describe("«Hal qilindi» / «Ahamiyatsiz» — PATCH ai/advisor/alerts/:id", () => {
  it("«Hal qilindi»: izoh trim qilinadi; javob tafsilotga yoziladi, nishon va ro'yxatlar (sanoq ham) eskiradi", async () => {
    mocks.patch.mockResolvedValue({ data: advisorEnvelope(fx.detail.r1Resolved) });
    const { client, result, invalidated } = setup(() => useResolveAlert());

    await act(() => result.current.mutateAsync({ id: "1040", note: `  ${RESOLVE_NOTE}  ` }));

    expect(mocks.patch).toHaveBeenCalledWith("ai/advisor/alerts/1040", { status: "resolved", note: RESOLVE_NOTE }, WRITE_CONFIG);
    expect(client.getQueryData(ALERT_KEY)).toEqual(fx.detail.r1Resolved);
    expect(invalidated(queryKeys.aiAdvisor.overview)).toBe(true);
    expect(invalidated(LIST_KEY)).toBe(true);
    expect(invalidated(COUNT_KEY)).toBe(true);
    expect(invalidated(OTHER_ALERT_KEY)).toBe(false);
    expect(invalidated(queryKeys.aiAdvisor.settings)).toBe(false);
  });

  it("«Ahamiyatsiz»: izohsiz yoki faqat bo'sh joy — `note` tanada yo'q; izoh bo'lsa — trim", async () => {
    mocks.patch.mockResolvedValue({ data: advisorEnvelope({ ...fx.detail.r1, status: "dismissed" }) });
    const { result } = setup(() => useDismissAlert());

    await act(() => result.current.mutateAsync({ id: "1040" }));
    await act(() => result.current.mutateAsync({ id: "1040", note: "   " }));
    await act(() => result.current.mutateAsync({ id: "1040", note: " Takroriy " }));

    expect(mocks.patch.mock.calls.map((call) => call[1])).toEqual([
      { status: "dismissed" },
      { status: "dismissed" },
      { status: "dismissed", note: "Takroriy" },
    ]);
  });

  it("409 ALERT_CLOSED (boshqa superadmin yopgan) — tafsilot, nishon va ro'yxat qayta o'qiladi", async () => {
    mocks.patch.mockRejectedValue(advisorHttpError(409, fx.errors.closed));
    const { client, result, invalidated } = setup(() => useResolveAlert());

    await act(async () => {
      await expect(result.current.mutateAsync({ id: "1040", note: RESOLVE_NOTE })).rejects.toBeTruthy();
    });

    expect(client.getQueryData(ALERT_KEY)).toEqual(fx.detail.r1);
    expect(invalidated(ALERT_KEY)).toBe(true);
    expect(invalidated(queryKeys.aiAdvisor.overview)).toBe(true);
    expect(invalidated(LIST_KEY)).toBe(true);
  });

  it("400 NOTE_INVALID — kesh tegilmaydi (xato oynada)", async () => {
    mocks.patch.mockRejectedValue(advisorHttpError(400, fx.errors.noteTooShort));
    const { result, invalidated } = setup(() => useResolveAlert());

    await act(async () => {
      await expect(result.current.mutateAsync({ id: "1040", note: "ok" })).rejects.toBeTruthy();
    });

    expect(invalidated(ALERT_KEY)).toBe(false);
    expect(invalidated(queryKeys.aiAdvisor.overview)).toBe(false);
    expect(invalidated(LIST_KEY)).toBe(false);
  });
});

describe("«AI izohini olish» — POST …/explain", () => {
  it("202 pending — tafsilot `pending` + poll oralig'i, eski xato tozalanadi; tana `{}`", async () => {
    mocks.post.mockResolvedValue({ data: advisorEnvelope(fx.explain.queued, 202) });
    const { client, result } = setup(() => useExplainAlert());
    client.setQueryData(ALERT_KEY, fx.detail.r1None);

    await act(() => result.current.mutateAsync("1040"));

    expect(mocks.post).toHaveBeenCalledWith("ai/advisor/alerts/1040/explain", {}, WRITE_CONFIG);
    expect(client.getQueryData(ALERT_KEY)).toMatchObject({
      explanation_status: "pending",
      explanation_poll_after_ms: 2_000,
      explanation_error: null,
    });
  });

  it("202 cached (tayyor) — matn va vaqt darhol", async () => {
    mocks.post.mockResolvedValue({ data: advisorEnvelope(fx.explain.cached, 202) });
    const { client, result } = setup(() => useExplainAlert());
    client.setQueryData(ALERT_KEY, fx.detail.r1None);

    await act(() => result.current.mutateAsync("1040"));

    expect(client.getQueryData(ALERT_KEY)).toMatchObject({
      explanation_status: "ready",
      explanation_md: fx.explain.cached.explanation_md,
      explained_at: fx.explain.cached.explained_at,
      explanation_poll_after_ms: null,
    });
  });

  it("429 budjet — holat o'zgarmaydi; 409 — tafsilot qayta o'qiladi", async () => {
    mocks.post.mockRejectedValueOnce(advisorHttpError(429, fx.errors.budgetGlobalDay));
    const { client, result, invalidated } = setup(() => useExplainAlert());
    client.setQueryData(ALERT_KEY, fx.detail.r1None);

    await act(async () => {
      await expect(result.current.mutateAsync("1040")).rejects.toBeTruthy();
    });
    expect(client.getQueryData(ALERT_KEY)).toEqual(fx.detail.r1None);
    expect(invalidated(ALERT_KEY)).toBe(false);

    mocks.post.mockRejectedValueOnce(advisorHttpError(409, fx.errors.explainClosed));
    await act(async () => {
      await expect(result.current.mutateAsync("1040")).rejects.toBeTruthy();
    });
    expect(invalidated(ALERT_KEY)).toBe(true);
  });

  it("mergeExplainResult: budjet xatosidan keyin qayta so'rov — xato maydonlari tozalanadi", () => {
    const merged = mergeExplainResult(fx.detail.r3Budget, { ...fx.explain.queued, alert_id: "1036" });
    expect(merged).toMatchObject({
      explanation_status: "pending",
      explanation_error: null,
      explanation_error_scope: null,
      explanation_retry_at: null,
      explanation_poll_after_ms: 2_000,
    });
  });
});

describe("Sozlamalarni saqlash — PATCH ai/advisor/settings", () => {
  it("tana — `version` + o'zgargan qoidalar; javob zond keshiga `available`", async () => {
    const next = { ...fx.settings, version: 5, rules: { ...fx.settings.rules, R1: { ...fx.settings.rules.R1, shortage_uzs: 30_000 } } };
    mocks.patch.mockResolvedValue({ data: advisorEnvelope(next) });
    const { client, result, invalidated } = setup(() => useSaveAdvisorSettings());

    const patch = { version: 4, rules: { R1: { shortage_uzs: 30_000 }, R8: { enabled: false } } };
    await act(() => result.current.mutateAsync(patch));

    expect(mocks.patch).toHaveBeenCalledWith("ai/advisor/settings", patch, WRITE_CONFIG);
    expect(client.getQueryData(queryKeys.aiAdvisor.settings)).toEqual({ kind: "available", data: next });
    expect(invalidated(queryKeys.aiAdvisor.overview)).toBe(false);
  });

  it("409 SETTINGS_CONFLICT — sozlamalar qayta o'qiladi; 400 INVALID_RULE — yo'q", async () => {
    mocks.patch.mockRejectedValueOnce(advisorHttpError(400, fx.errors.invalidRule));
    const { result, invalidated } = setup(() => useSaveAdvisorSettings());

    await act(async () => {
      await expect(result.current.mutateAsync({ version: 4, rules: { R1: { consecutive_negative: 1 } } })).rejects.toBeTruthy();
    });
    expect(invalidated(queryKeys.aiAdvisor.settings)).toBe(false);

    mocks.patch.mockRejectedValueOnce(advisorHttpError(409, fx.errors.settingsConflict));
    await act(async () => {
      await expect(result.current.mutateAsync({ version: 4, rules: { R8: { enabled: false } } })).rejects.toBeTruthy();
    });
    expect(invalidated(queryKeys.aiAdvisor.settings)).toBe(true);
  });
});
