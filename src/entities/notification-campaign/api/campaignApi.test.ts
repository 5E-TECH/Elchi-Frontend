import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../shared/api/api";
import {
  cancelCampaign,
  createAudienceSegment,
  createCampaign,
  deleteAudienceSegment,
  exportCampaignUndelivered,
  getAudienceSegments,
  getCampaign,
  getCampaigns,
  getSchedulePolicy,
  normalizeAudiencePreview,
  previewAudience,
} from "./campaignApi";

afterEach(() => vi.restoreAllMocks());

describe("campaignApi (KM-2)", () => {
  it("preview: posts the target (+ with_sample) and reads counts, limits, push users and the masked sample", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({
      data: {
        statusCode: 200,
        message: "Audience preview",
        data: {
          exact: true,
          total: 1308,
          by_role: { customer: 1186, market: 98, manager: 20, logist: 4 },
          by_channel: { in_app: 1308, push: 312, sms: 1140 },
          limits: { dispatch_max: 5000, campaign_max: 20000 },
          campaign_allowed: true,
          hint: "raw backend text",
          sample: [{ id: 48211, role: "customer", phone: "***7434" }],
        },
      },
    });
    const result = await previewAudience({ roles: ["market"] }, { withSample: true });
    expect(post).toHaveBeenCalledWith("notifications/audience/preview", {
      roles: ["market"],
      with_sample: true,
    });
    expect(result).toEqual({
      exact: true,
      total: 1308,
      byRole: { customer: 1186, market: 98, manager: 20, logist: 4 },
      push: 312,
      dispatchMax: 5000,
      campaignMax: 20000,
      campaignAllowed: true,
      sample: [{ id: "48211", role: "customer", phone: "***7434" }],
    });
    expect(JSON.stringify(result)).not.toContain("raw backend");
  });

  it("preview over the cap: no push count, campaign not allowed", () => {
    expect(
      normalizeAudiencePreview({
        data: {
          exact: false,
          total: 24310,
          by_channel: { push: null },
          limits: { campaign_max: 20000 },
          campaign_allowed: false,
        },
      }),
    ).toMatchObject({ exact: false, push: null, campaignAllowed: false, sample: null });
  });

  it("creates a campaign with the Idempotency-Key header", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({
      data: {
        data: {
          campaign_id: "7",
          status: "queued",
          total: 98,
          scheduled_at: null,
          duplicate: false,
          quiet_hours_shifted: true,
        },
      },
    });
    const payload = {
      roles: ["market"],
      type: "system.manual",
      category: "system",
      priority: "normal",
      title: "T",
      channels: ["in_app" as const],
    };
    await expect(createCampaign(payload, "key-1")).resolves.toEqual({
      campaign_id: "7",
      status: "queued",
      total: 98,
      scheduled_at: null,
      duplicate: false,
      quiet_hours_shifted: true,
    });
    expect(post).toHaveBeenCalledWith("notifications/campaigns", payload, {
      headers: { "Idempotency-Key": "key-1" },
    });
  });

  it("progress, list and cancel", async () => {
    const get = vi.spyOn(api, "get").mockImplementation((async (url: string) => {
      if (url === "notifications/campaigns/7") {
        return {
          data: {
            data: {
              id: 7,
              status: "running",
              display_status: "sending",
              title: "T",
              total: 100,
              sent: 40,
              failed: 2,
              skipped: 0,
              progress_pct: 42,
              can_cancel: true,
              last_error: "x",
            },
          },
        };
      }
      return {
        data: {
          data: {
            items: [{ id: 8, status: "done", total: 10, sent: 10 }],
            meta: { page: 1, limit: 20, total: 1 },
          },
        },
      };
    }) as never);
    const campaign = await getCampaign("7");
    expect(campaign).toMatchObject({
      id: "7",
      status: "running",
      display_status: "sending",
      sent: 40,
      failed: 2,
      progress_pct: 42,
      can_cancel: true,
    });
    expect(campaign).not.toHaveProperty("last_error");
    const list = await getCampaigns({ state: "sent" });
    expect(get).toHaveBeenLastCalledWith("notifications/campaigns", { params: { state: "sent" } });
    expect(list.items[0]).toMatchObject({
      id: "8",
      status: "done",
      display_status: null,
      progress_pct: 100,
    });
    expect(list.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });

    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: { data: { id: "7", status: "cancelled", can_cancel: false } } });
    await expect(cancelCampaign("7")).resolves.toMatchObject({
      status: "cancelled",
      can_cancel: false,
    });
    expect(post).toHaveBeenCalledWith("notifications/campaigns/7/cancel");
  });

  it("saved segments: list, create, delete", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: {
        data: {
          items: [
            {
              id: 3,
              name: "Toshkent",
              audience: { roles: ["market"] },
              last_total: 98,
              last_counted_at: "2026-10-21T06:05:00Z",
            },
            { id: 4 },
          ],
        },
      },
    });
    await expect(getAudienceSegments()).resolves.toEqual([
      {
        id: "3",
        name: "Toshkent",
        description: null,
        audience: { roles: ["market"] },
        lastTotal: 98,
        lastCountedAt: "2026-10-21T06:05:00Z",
      },
    ]);
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: { data: { id: 9, name: "Yangi", audience: {} } } });
    await createAudienceSegment({ roles: ["market"], name: "Yangi" });
    expect(post).toHaveBeenCalledWith("notifications/audience/segments", {
      roles: ["market"],
      name: "Yangi",
    });
    const del = vi.spyOn(api, "delete").mockResolvedValue({ data: {} });
    await deleteAudienceSegment("9");
    expect(del).toHaveBeenCalledWith("notifications/audience/segments/9");
  });

  it("schedule policy: quiet hours and the shifted moment", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({
      data: {
        data: {
          promo_quiet_hours: { start: "18:00", end: "09:00", enabled: true },
          check: { shifted: true, effective_at: "2026-10-22T04:00:00.000Z", message: "raw" },
        },
      },
    });
    await expect(
      getSchedulePolicy({ scheduled_at: "2026-10-21T19:10:00+05:00", category: "marketing" }),
    ).resolves.toEqual({
      quietHours: { start: "18:00", end: "09:00", enabled: true },
      // `is_promo` / `max_schedule_days` kelmasa — `false` va sukut 90.
      isPromo: false,
      maxScheduleDays: 90,
      check: { shifted: true, effectiveAt: "2026-10-22T04:00:00.000Z" },
    });
    expect(get).toHaveBeenCalledWith("notifications/campaigns/schedule-policy", {
      params: { scheduled_at: "2026-10-21T19:10:00+05:00", category: "marketing" },
    });
  });

  it("CSV export: small — the file, big — a background job id", async () => {
    const blob = new Blob(["a,b"]);
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ status: 200, data: blob });
    await expect(exportCampaignUndelivered("7")).resolves.toEqual({ kind: "file", blob, fileName: null });
    expect(get).toHaveBeenCalledWith("notifications/campaigns/7/undelivered/export", {
      responseType: "blob",
    });
    get.mockResolvedValueOnce({
      status: 202,
      data: new Blob([JSON.stringify({ data: { export_id: 3 } })]),
    });
    await expect(exportCampaignUndelivered("7")).resolves.toEqual({ kind: "job", exportId: "3" });
  });
});
