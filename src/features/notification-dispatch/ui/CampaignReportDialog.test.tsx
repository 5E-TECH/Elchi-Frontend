import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { normalizeCampaign } from "../../../entities/notification-campaign";
import { api } from "../../../shared/api/api";
import { renderWithProviders } from "../../../test/test-utils";
import { CampaignReportDialog } from "./CampaignReportDialog";

/**
 * Kampaniya hisoboti oynasi — H7kpCman qolgan FE TC'lari (6 ta StatCard: «Yetkazildi» — DLR yo'q bo'lsa «—», narx
 * yonida «taxminiy»; SMS bloki faqat `sms !== null`; SMS kampaniyasi), N9 (lkQiuyQu: maskalangan telefon, sabab —
 * `reason_code` dan). Vaqt — 2026-10-21 11:00 Toshkent.
 */

const NOW = new Date("2026-10-21T06:00:00Z");

const CAMPAIGN = normalizeCampaign({
  id: "14",
  status: "done",
  display_status: "sent",
  title: "Kuryerlar uchun yangi qoidalar",
  category: "system",
  channels: ["in_app", "push"],
  total: 212,
  sent: 210,
  created_at: "2026-10-20T06:00:00Z",
});

const BASE_REPORT = {
  kind: "notification",
  campaign: { id: "14", title: "Kuryerlar uchun yangi qoidalar", display_status: "sent", channels: ["in_app", "push"] },
  stats: { audience: 212, sent: 210, delivered: null, failed: 0, skipped: 0, pending: 0, undelivered: 2 },
  dlr: { supported: false, received: null, awaiting: null, note: "raw dlr note" },
  by_channel: [
    { channel: "in_app", sent: 212, failed: 0, skipped: 0, pending: 0, statuses: { sent: 212 } },
    { channel: "push", sent: 140, failed: 2, skipped: 70, pending: 0, statuses: { sent: 140, failed: 2, no_subscription: 70 } },
  ],
  sms: null,
  cost: { currency: "UZS", estimated: 0, cost_of_sent: 0, is_estimate: true, paid_channels: [], note: "raw cost note" },
  permissions: { can_export: false },
};

const UNDELIVERED = {
  items: [
    {
      ref_id: "1",
      recipient_id: "300",
      name: "Akmal Rasulov",
      role: "courier",
      phone: "***7434",
      failures: [
        { channel: "push", status: "failed", reason: "Received unexpected response code 410", reason_code: "subscription_expired" },
      ],
    },
    {
      ref_id: "2",
      recipient_id: "301",
      name: "Sardor Ahmedov",
      role: "courier",
      // To'liq raqam kelib qolsa ham — faqat oxirgi 4 raqam.
      phone: "+998901234567",
      failures: [{ channel: "push", status: "failed", reason: "429 Too Many", reason_code: "rate_limited" }],
    },
  ],
  meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
  unlisted_failed: 0,
};

let getSpy: MockInstance<typeof api.get>;
let report: Record<string, unknown> = BASE_REPORT;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  report = BASE_REPORT;
  getSpy = vi.spyOn(api, "get").mockImplementation((async (url: string) => {
    if (url === "notifications/campaigns/14/report") return { data: { data: report } };
    if (url === "notifications/campaigns/14/undelivered") return { data: { data: UNDELIVERED } };
    if (url === "notifications/sms/campaigns/7/report") return { data: { data: SMS_REPORT } };
    if (url === "notifications/sms/campaigns/7/undelivered") return { data: { data: SMS_UNDELIVERED } };
    return { data: { data: [] } };
  }) as never);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const openReport = async () => {
  renderWithProviders(<CampaignReportDialog campaign={CAMPAIGN} onClose={() => {}} />);
  const dialog = await screen.findByRole("dialog", { name: "Kampaniya hisoboti" });
  const body = await within(dialog).findByTestId("campaign-report");
  await waitFor(() => expect(within(body).getByTestId("campaign-report-stats")).toBeInTheDocument());
  return { dialog, body, stats: within(body).getByTestId("campaign-report-stats") };
};

describe("CampaignReportDialog — H7kpCman / N9", () => {
  it("6 ta StatCard: Yetkazildi — «—» (0 emas), narx — «taxminiy · bepul kanallar»; SMS bloki yo'q", async () => {
    const { body, stats } = await openReport();
    expect(stats).toHaveTextContent("Auditoriya212qabul qiluvchi");
    expect(stats).toHaveTextContent("Yuborildi210xatosiz");
    expect(stats).toHaveTextContent("Yetkazildi—bu kanallarda yetkazish hisoboti yo'q");
    expect(stats).not.toHaveTextContent("Yetkazildi0");
    expect(stats).toHaveTextContent("Xato2Push kanalida");
    expect(stats).toHaveTextContent("O'tkazib yuborildi70Push obunasi yo'q");
    expect(stats).toHaveTextContent("Narx0 so'mtaxminiy · bepul kanallar");
    // 390px: 2 ustun (desktop — 3).
    expect(stats).toHaveClass("grid-cols-3", "max-md:grid-cols-2");
    expect(stats.querySelectorAll("[data-stat-value]")).toHaveLength(6);
    expect(within(body).queryByTestId("campaign-report-sms")).toBeNull();
    expect(body).not.toHaveTextContent(/raw/);
  });

  it("N9: yetkazilmaganlar — maskalangan telefon, sabab `reason_code` xaritasidan (xom matn yo'q)", async () => {
    const { body } = await openReport();
    expect(await within(body).findByText("Akmal Rasulov")).toBeVisible();
    expect(body).toHaveTextContent("Kuryer · ***7434");
    expect(body).toHaveTextContent("Kuryer · ***4567");
    expect(body).not.toHaveTextContent("+998901234567");
    expect(body).toHaveTextContent("Push obunasi eskirgan");
    expect(body).toHaveTextContent("Push xizmati so'rovlarni chekladi");
    expect(body).not.toHaveTextContent("Received unexpected response code 410");
    expect(body).toHaveTextContent("2 tadan 1–2 · telefon maskalangan");
  });

  it("SMS kanalli kampaniya: SMS bloki (xabar, bo'lak, operator hisoboti hali kelmagan, tarif), narx taxminiy", async () => {
    report = {
      ...BASE_REPORT,
      campaign: { ...BASE_REPORT.campaign, channels: ["in_app", "sms"] },
      by_channel: [{ channel: "sms", sent: 2, failed: 0, skipped: 1, pending: 0, statuses: { sent: 2, skipped: 1 } }],
      sms: {
        message_class: "promo",
        messages: 2,
        sent: 2,
        delivered: null,
        failed: 0,
        pending: 0,
        parts_total: 4,
        dlr: { final: 0, delivered: 0, failed: 0, awaiting: 2 },
        tariff_per_part: 175,
        estimated_cost: 700,
        cost_of_sent: 700,
      },
      cost: { currency: "UZS", estimated: 700, cost_of_sent: 700, is_estimate: true, paid_channels: ["sms"] },
    };
    const { body, stats } = await openReport();
    expect(stats).toHaveTextContent("Narx700 so'mtaxminiy · faktik summa — provayder hisobidan");
    const sms = within(body).getByTestId("campaign-report-sms");
    expect(sms).toHaveTextContent("Xabarlar2 ta");
    expect(sms).toHaveTextContent("Bo'laklar4 ta");
    expect(sms).toHaveTextContent("Operator hisobotiHali kelmagan · kutilmoqda 2 ta");
    expect(sms).toHaveTextContent("1 bo'lak narxi175 so'm");
    expect(sms).toHaveTextContent("Yuborilganlar narxi700 so'm");
    expect(sms).toHaveTextContent("Narx taxminiy: tarif × bo'laklar");
    // Bu yo'lda backend kodlashni bermaydi — qator chizilmaydi.
    expect(sms).not.toHaveTextContent("Kodlash");
  });

  it("SMS kampaniyasi: SMS manzillari, kodlash va bo'laklar, DLR kelgan — «Yetkazildi» soni; operator rad etgani — xato", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CampaignReportDialog
        campaign={{ kind: "sms", id: "7", text: "Kuzgi chegirma 20%", created_at: "2026-10-20T06:00:00Z" }}
        onClose={() => {}}
      />,
    );
    const dialog = await screen.findByRole("dialog", { name: "Kampaniya hisoboti" });
    expect(dialog).toHaveTextContent("SMS kampaniya · Kecha, 11:00");
    expect(dialog).toHaveTextContent("Kuzgi chegirma 20%");
    const body = await within(dialog).findByTestId("campaign-report");
    const stats = await within(body).findByTestId("campaign-report-stats");
    expect(stats).toHaveTextContent("Yetkazildi3operator hisobotiga ko'ra");
    expect(stats).toHaveTextContent("Narx1,5 ming so'mtaxminiy · faktik summa — provayder hisobidan");
    const sms = within(body).getByTestId("campaign-report-sms");
    expect(sms).toHaveTextContent("Bo'laklar8 ta · 1 xabar = 2 bo'lak");
    expect(sms).toHaveTextContent("KodlashUCS-2");
    expect(sms).toHaveTextContent("Operator hisobotiYetkazildi 3 · Xato 1 · Kutilmoqda 0");
    expect(await within(body).findByText("Mijoz 1")).toBeVisible();
    expect(body).toHaveTextContent("SMS — xato");
    expect(body).toHaveTextContent("Operator rad etdi");
    expect(body).toHaveTextContent("***1122");
    expect(getSpy).toHaveBeenCalledWith("notifications/sms/campaigns/7/report");
    expect(getSpy).toHaveBeenCalledWith("notifications/sms/campaigns/7/undelivered", { params: { page: 1, limit: 10 } });
    // CSV — faqat can_export (superadmin): SMS eksport manzili.
    getSpy.mockResolvedValueOnce({ status: 200, data: new Blob(["a"]), headers: {} } as never);
    await user.click(within(dialog).getByRole("button", { name: "CSV yuklab olish" }));
    await waitFor(() =>
      expect(getSpy).toHaveBeenCalledWith("notifications/sms/campaigns/7/undelivered/export", expect.anything()),
    );
  });
});

const SMS_REPORT = {
  kind: "sms",
  campaign: { id: "7", title: null, text: "Kuzgi chegirma 20%", channels: ["sms"], created_at: "2026-10-20T06:00:00Z" },
  stats: { audience: 5, sent: 4, delivered: 3, failed: 1, skipped: 1, pending: 0, undelivered: 1 },
  dlr: { supported: true, received: 4, awaiting: 0, note: null },
  by_channel: [{ channel: "sms", sent: 3, failed: 1, skipped: 1, pending: 0, other: 0, statuses: { delivered: 3, failed: 1 } }],
  sms: {
    messages: 4,
    parts_total: 8,
    parts_per_message: { min: 2, max: 2 },
    encoding: "UCS-2",
    source: "sms_outbox",
    dlr: { final: 4, delivered: 3, failed: 1, awaiting: 0 },
    tariff_per_part: 175,
    cost_of_sent: 1400,
  },
  cost: { currency: "UZS", estimated: 1500, cost_of_sent: 1400, is_estimate: true, paid_channels: ["sms"] },
  permissions: { can_export: true },
};

const SMS_UNDELIVERED = {
  items: [
    {
      ref_id: "70",
      recipient_id: null,
      name: "Mijoz 1",
      role: null,
      phone: "***1122",
      failures: [{ channel: "sms", status: "rejected", reason: "provider raw", reason_code: null }],
    },
  ],
  meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
  unlisted_failed: 0,
};
