import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LONG_REQUEST_TIMEOUT_MS, api } from "../../../shared/api/api";
import { campaignBarPct, campaignEffectiveAt, isCampaignPaused } from "../model/campaign";
import {
  getCampaignExportJob,
  getCampaignReport,
  getCampaignUndelivered,
  getSchedulePolicy,
  normalizeCampaign,
  normalizeCampaignList,
} from "./campaignApi";
import {
  CAMPAIGN_PROGRESS_INTERVAL_MS,
  CAMPAIGN_SCHEDULED_INTERVAL_MS,
  campaignListRefetchInterval,
  resetPendingCampaignExports,
  useCampaignUndelivered,
  useExportCampaignUndelivered,
} from "./hooks";

afterEach(() => {
  vi.restoreAllMocks();
  resetPendingCampaignExports();
});

/**
 * KM-3 — rejalashtirish siyosati, tarix qatori, hisobot, «Yetkazilmaganlar» va CSV eksport (backend H7kpCman /
 * WIsb9Ytq kontrakti, `Elchi-Backend` `docs/frontend/FRONTEND_CHANGELOG.md` N1).
 */
describe("campaignApi (KM-3)", () => {
  it("schedule policy: is_promo, max_schedule_days; xom `message` olinmaydi", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: {
        data: {
          timezone: "Asia/Tashkent",
          promo_quiet_hours: { start: "18:00", end: "09:00", enabled: true, env: "NOTIF_PROMO_QUIET_HOURS" },
          is_promo: true,
          max_schedule_days: 60,
        },
      },
    });
    const policy = await getSchedulePolicy({ category: "marketing" });
    expect(policy).toEqual({
      quietHours: { start: "18:00", end: "09:00", enabled: true },
      isPromo: true,
      maxScheduleDays: 60,
      check: null,
    });
  });

  it("tarix qatori: paused_until, can_cancel; ro'yxat meta", () => {
    const row = normalizeCampaign({
      id: 12,
      status: "running",
      display_status: "sending",
      title: "Yangi tariflar",
      total: 4860,
      sent: 2040,
      can_cancel: true,
      paused_until: "2026-10-22T04:00:00.000Z",
      last_error: "Partiya 3 marta yiqildi: raw",
    });
    expect(row).toMatchObject({ id: "12", can_cancel: true, paused_until: "2026-10-22T04:00:00.000Z" });
    expect(row).not.toHaveProperty("last_error");
    expect(
      normalizeCampaignList({ data: { items: [{ id: 1 }], meta: { page: 2, limit: 10, total: 11, totalPages: 2 } } }).meta,
    ).toEqual({ page: 2, limit: 10, total: 11, totalPages: 2 });
  });

  it("hisobot: delivered null — «o'lchanmagan» (0 emas), kanal kesimi, can_export; xom izohlar olinmaydi", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({
      data: {
        data: {
          kind: "notification",
          campaign: { id: "14", title: "Kuryerlar", category: "system", display_status: "sent", channels: ["in_app", "push"] },
          stats: { audience: 212, sent: 210, delivered: null, failed: 0, skipped: 0, pending: 0, undelivered: 72 },
          dlr: { note: "raw" },
          by_channel: [
            { channel: "push", sent: 140, failed: 2, skipped: 70, pending: 0, other: 1, statuses: { no_subscription: 70 } },
          ],
          cost: { note: "raw" },
          permissions: { can_export: true },
          export_sync_limit: 10000,
        },
      },
    });
    const report = await getCampaignReport("14");
    expect(get).toHaveBeenCalledWith("notifications/campaigns/14/report");
    expect(report.stats).toEqual({
      audience: 212,
      sent: 210,
      delivered: null,
      failed: 0,
      skipped: 0,
      pending: 0,
      undelivered: 72,
    });
    // `other` (noma'lum holat) — jarayonda.
    expect(report.byChannel).toEqual([
      { channel: "push", sent: 140, failed: 2, skipped: 70, pending: 1, statuses: { no_subscription: 70 } },
    ]);
    expect(report.canExport).toBe(true);
    expect(JSON.stringify(report)).not.toContain("raw");
  });

  it("yetkazilmaganlar: sahifa parametrlari va qatorlar", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({
      data: {
        data: {
          items: [
            {
              ref_id: 9000,
              recipient_id: 300,
              name: "Akmal",
              role: "courier",
              phone: null,
              failures: [{ channel: "push", status: "failed", reason: "raw" }],
            },
          ],
          meta: { page: 2, limit: 10, total: 72, totalPages: 8 },
          unlisted_failed: 3,
        },
      },
    });
    const page = await getCampaignUndelivered("14", { page: 2, limit: 10 });
    expect(get).toHaveBeenCalledWith("notifications/campaigns/14/undelivered", { params: { page: 2, limit: 10 } });
    expect(page.items[0]).toMatchObject({ ref_id: "9000", recipient_id: "300", name: "Akmal" });
    expect(page.meta.totalPages).toBe(8);
    expect(page.unlistedFailed).toBe(3);
  });

  it("eksport holati: noma'lum holat — navbatda", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: { data: { export_id: 5, status: "weird" } } });
    await expect(getCampaignExportJob("5")).resolves.toEqual({ exportId: "5", status: "queued", filename: null });
  });
});

describe("campaignListRefetchInterval (tarix)", () => {
  const page = (rows: Array<Record<string, unknown>>) =>
    normalizeCampaignList({ data: { items: rows, meta: { total: rows.length } } });

  it("yuborilayotgan bo'lsa — 3 s, faqat rejalashtirilgan — 60 s, qolganida — yo'q", () => {
    expect(campaignListRefetchInterval(page([{ status: "running", display_status: "sending" }]))).toBe(
      CAMPAIGN_PROGRESS_INTERVAL_MS,
    );
    expect(campaignListRefetchInterval(page([{ status: "queued", display_status: "scheduled" }]))).toBe(
      CAMPAIGN_SCHEDULED_INTERVAL_MS,
    );
    expect(campaignListRefetchInterval(page([{ status: "done", display_status: "sent" }]))).toBe(false);
    expect(campaignListRefetchInterval(undefined)).toBe(false);
  });
});

describe("useExportCampaignUndelivered (CSV)", () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
  );

  it("kichik — fayl darhol (nomi Content-Disposition dan)", async () => {
    const blob = new Blob(["a,b"]);
    vi.spyOn(api, "get").mockResolvedValue({
      status: 200,
      data: blob,
      headers: { "content-disposition": 'attachment; filename="kampaniya-14.csv"' },
    });
    const save = vi.fn();
    const { result } = renderHook(() => useExportCampaignUndelivered(save), { wrapper });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.mutateAsync("14");
    });
    expect(outcome).toEqual({ kind: "saved", fileName: "kampaniya-14.csv" });
    expect(save).toHaveBeenCalledWith(blob, "kampaniya-14.csv");
  });

  it("katta — fon vazifasi: holat so'raladi, tayyor bo'lgach yuklab olinadi", async () => {
    const file = new Blob(["x"]);
    const statuses = ["queued", "running", "done"];
    const get = vi.spyOn(api, "get").mockImplementation((async (url: string) => {
      if (url.endsWith("/undelivered/export")) {
        return { status: 202, data: new Blob([JSON.stringify({ data: { export_id: 5 } })]), headers: {} };
      }
      if (url.endsWith("/exports/5")) return { data: { data: { export_id: 5, status: statuses.shift() } } };
      if (url.endsWith("/exports/5/download")) return { status: 200, data: file, headers: {} };
      throw new Error(url);
    }) as never);
    const save = vi.fn();
    const { result } = renderHook(() => useExportCampaignUndelivered(save, { pollMs: 1 }), { wrapper });
    await act(async () => {
      await result.current.mutateAsync("14");
    });
    expect(get).toHaveBeenCalledWith("notifications/campaigns/exports/5/download", {
      responseType: "blob",
      timeout: LONG_REQUEST_TIMEOUT_MS,
    });
    expect(save).toHaveBeenCalledWith(file, "kampaniya-14-yetkazilmaganlar.csv");
  });

  it("fon vazifasi xato bilan tugasa yoki kutish oshsa — fayl yo'q", async () => {
    vi.spyOn(api, "get").mockImplementation((async (url: string) =>
      url.endsWith("/undelivered/export")
        ? { status: 202, data: new Blob([JSON.stringify({ data: { export_id: 5 } })]), headers: {} }
        : { data: { data: { export_id: 5, status: "running" } } }) as never);
    const save = vi.fn();
    const { result } = renderHook(() => useExportCampaignUndelivered(save, { pollMs: 1, maxPolls: 2 }), { wrapper });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.mutateAsync("14");
    });
    await waitFor(() => expect(outcome).toEqual({ kind: "timeout" }));
    expect(save).not.toHaveBeenCalled();
  });

  it("kutish oshgan vazifa eslab qolinadi: keyingi bosish yangi eksport ochmaydi — tayyor faylni yuklaydi", async () => {
    const file = new Blob(["x"]);
    let status = "running";
    const get = vi.spyOn(api, "get").mockImplementation((async (url: string) => {
      if (url.endsWith("/undelivered/export")) {
        return { status: 202, data: new Blob([JSON.stringify({ data: { export_id: 5 } })]), headers: {} };
      }
      if (url.endsWith("/exports/5")) return { data: { data: { export_id: 5, status } } };
      if (url.endsWith("/exports/5/download")) return { status: 200, data: file, headers: {} };
      throw new Error(url);
    }) as never);
    const save = vi.fn();
    const onOutcome = vi.fn();
    const { result } = renderHook(
      () => useExportCampaignUndelivered(save, { pollMs: 1, maxPolls: 2, onOutcome }),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync("14");
    });
    expect(onOutcome).toHaveBeenLastCalledWith({ kind: "timeout" });
    status = "done";
    await act(async () => {
      await result.current.mutateAsync("14");
    });
    expect(onOutcome).toHaveBeenLastCalledWith({ kind: "saved", fileName: "kampaniya-14-yetkazilmaganlar.csv" });
    expect(save).toHaveBeenCalledWith(file, "kampaniya-14-yetkazilmaganlar.csv");
    expect(get.mock.calls.filter(([url]) => String(url).endsWith("/undelivered/export"))).toHaveLength(1);
  });

  it("eslab qolingan vazifa topilmasa (410) — yangisi ochiladi", async () => {
    const file = new Blob(["x"]);
    let exports = 0;
    let first = true;
    vi.spyOn(api, "get").mockImplementation((async (url: string) => {
      if (url.endsWith("/undelivered/export")) {
        exports += 1;
        const id = exports === 1 ? 5 : 6;
        return { status: 202, data: new Blob([JSON.stringify({ data: { export_id: id } })]), headers: {} };
      }
      if (url.endsWith("/exports/5")) {
        if (first) {
          first = false;
          return { data: { data: { export_id: 5, status: "running" } } };
        }
        throw Object.assign(new Error("gone"), { isAxiosError: true, response: { status: 410 } });
      }
      if (url.endsWith("/exports/6")) return { data: { data: { export_id: 6, status: "done" } } };
      if (url.endsWith("/exports/6/download")) return { status: 200, data: file, headers: {} };
      throw new Error(url);
    }) as never);
    const save = vi.fn();
    const { result } = renderHook(() => useExportCampaignUndelivered(save, { pollMs: 1, maxPolls: 1 }), {
      wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync("14");
    });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.mutateAsync("14");
    });
    expect(exports).toBe(2);
    expect(outcome).toEqual({ kind: "saved", fileName: "kampaniya-14-yetkazilmaganlar.csv" });
  });
});

describe("useCampaignUndelivered — boshqa kampaniya", () => {
  it("oldingi sahifa faqat shu kampaniya ichida; boshqa kampaniyada eski qatorlar ko'rinmaydi", async () => {
    let release: (() => void) | null = null;
    vi.spyOn(api, "get").mockImplementation((async (url: string, config?: { params?: { page?: number } }) => {
      const id = url.split("/")[2];
      if (id === "15") await new Promise<void>((resolve) => (release = resolve));
      return {
        data: {
          data: {
            items: [{ ref_id: `${id}-${config?.params?.page}`, recipient_id: "1", failures: [] }],
            meta: { page: config?.params?.page ?? 1, limit: 10, total: 30, totalPages: 3 },
            unlisted_failed: 0,
          },
        },
      };
    }) as never);
    const client = new QueryClient();
    const { result, rerender } = renderHook(
      ({ id, page }: { id: string; page: number }) => useCampaignUndelivered(id, { page, limit: 10 }),
      {
        initialProps: { id: "14", page: 1 },
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );
    await waitFor(() => expect(result.current.data?.items[0].ref_id).toBe("14-1"));
    // Shu kampaniyada sahifa almashdi — oldingi sahifa yangisi kelguncha qoladi.
    rerender({ id: "14", page: 2 });
    expect(result.current.data?.items[0].ref_id).toBe("14-1");
    expect(result.current.isPlaceholderData).toBe(true);
    await waitFor(() => expect(result.current.data?.items[0].ref_id).toBe("14-2"));
    // Boshqa kampaniya — 14 ning qatorlari ko'rinmaydi.
    rerender({ id: "15", page: 1 });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(release).not.toBeNull());
    act(() => release?.());
    await waitFor(() => expect(result.current.data?.items[0].ref_id).toBe("15-1"));
  });
});

describe("kampaniya qatori yordamchilari", () => {
  it("chiziq: bekor / xatoda — sent / total (backend `progress_pct` 100), yuborilganda — backend", () => {
    expect(
      campaignBarPct({ status: "cancelled", display_status: "cancelled", sent: 406, total: 1312, progress_pct: 100 }),
    ).toBe(31);
    expect(campaignBarPct({ status: "failed", display_status: "failed", sent: 1908, total: 2980, progress_pct: 100 })).toBe(
      64,
    );
    expect(campaignBarPct({ status: "done", display_status: "sent", sent: 210, total: 212, progress_pct: 100 })).toBe(100);
    expect(campaignBarPct({ status: "queued", display_status: "scheduled", sent: 0, total: 0, progress_pct: 0 })).toBe(0);
  });

  it("haqiqiy lahza: `paused_until` keyinroq bo'lsa — o'sha; to'xtaganmi — hozirga nisbatan", () => {
    expect(campaignEffectiveAt({ scheduled_at: "2026-10-21T13:00:00Z", paused_until: "2026-10-22T04:00:00Z" })).toBe(
      "2026-10-22T04:00:00Z",
    );
    expect(campaignEffectiveAt({ scheduled_at: "2026-10-23T05:00:00Z", paused_until: "2026-10-22T04:00:00Z" })).toBe(
      "2026-10-23T05:00:00Z",
    );
    expect(campaignEffectiveAt({ scheduled_at: null, paused_until: "2026-10-22T04:00:00Z" })).toBe(
      "2026-10-22T04:00:00Z",
    );
    expect(campaignEffectiveAt({ scheduled_at: null, paused_until: null })).toBeNull();
    const at = Date.parse("2026-10-21T15:00:00Z");
    expect(isCampaignPaused({ paused_until: "2026-10-22T04:00:00Z" }, at)).toBe(true);
    expect(isCampaignPaused({ paused_until: "2026-10-21T04:00:00Z" }, at)).toBe(false);
    expect(isCampaignPaused({ paused_until: null }, at)).toBe(false);
  });

  it("ro'yxat: tungi taqiqda to'xtagan yuborilayotgan kampaniya — 60 s (3 s emas)", () => {
    const at = Date.parse("2026-10-21T15:00:00Z");
    const page = normalizeCampaignList({
      data: {
        items: [{ status: "running", display_status: "sending", paused_until: "2026-10-22T04:00:00Z" }],
        meta: { total: 1 },
      },
    });
    expect(campaignListRefetchInterval(page, at)).toBe(CAMPAIGN_SCHEDULED_INTERVAL_MS);
  });
});
