import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import CampaignPage from "./CampaignPage";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("../../../shared/api/api", () => ({ api }));

/**
 * H7kpCman: SMS «Kampaniyalar tarixi» → «Hisobot» — umumiy hisobot oynasi SMS rejimida
 * (`GET /notifications/sms/campaigns/:id/report`): bo'laklar soni va kodlash, operator hisoboti, taxminiy narx.
 */

const HISTORY = [
  {
    id: "5",
    created_at: "2026-10-20T06:00:00Z",
    message_class: "promo",
    text: "Kuzgi chegirma 20%",
    total: 86,
    queued: 86,
    blocked: 0,
    skipped: 0,
    sent: 86,
    delivered: 61,
    failed: 3,
    pending: 22,
    estimated_cost: "15050",
  },
  // KM-6: rejalashtirilgan (hali yuborilmagan) — hisobot tugmasi yo'q.
  {
    id: "6",
    created_at: "2026-10-21T05:00:00Z",
    message_class: "promo",
    text: "Ertangi aksiya",
    total: 10,
    queued: 0,
    blocked: 0,
    skipped: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    pending: 0,
    estimated_cost: null,
    status: "scheduled",
  },
];

const REPORT = {
  kind: "sms",
  campaign: { id: "5", title: null, text: "Kuzgi chegirma 20%", channels: ["sms"], created_at: "2026-10-20T06:00:00Z" },
  stats: { audience: 86, sent: 86, delivered: null, failed: 3, skipped: 0, pending: 22, undelivered: 3 },
  dlr: { supported: true, received: 0, awaiting: 64, note: "raw" },
  by_channel: [{ channel: "sms", sent: 61, failed: 3, skipped: 0, pending: 22, other: 0, statuses: { sent: 61 } }],
  sms: {
    messages: 86,
    parts_total: 172,
    parts_per_message: { min: 2, max: 2 },
    encoding: "GSM-7",
    source: "sms_outbox",
    dlr: { final: 0, delivered: 0, failed: 0, awaiting: 64 },
    tariff_per_part: 175,
    cost_of_sent: 30100,
  },
  cost: { currency: "UZS", estimated: 30100, cost_of_sent: 30100, is_estimate: true, paid_channels: ["sms"] },
  permissions: { can_export: false },
};

describe("CampaignPage — SMS kampaniya hisoboti (H7kpCman)", () => {
  beforeEach(() => {
    api.get.mockReset().mockImplementation((url: string) => {
      if (url.endsWith("sms/campaigns")) return Promise.resolve({ data: { data: HISTORY } });
      if (url === "notifications/sms/campaigns/5/report") return Promise.resolve({ data: { data: REPORT } });
      if (url === "notifications/sms/campaigns/5/undelivered")
        return Promise.resolve({
          data: { data: { items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 }, unlisted_failed: 0 } },
        });
      if (url.endsWith("tariffs")) return Promise.resolve({ data: { data: { promo: 175 } } });
      return Promise.resolve({ data: { data: [] } });
    });
  });

  it("«Hisobot» → SMS bloki: bo'laklar va kodlash, DLR kelmagan — «—», narx taxminiy; rejalashtirilganda tugma yo'q", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    const table = await screen.findByRole("table", { name: "Yuborilgan kampaniyalar" });
    const rows = within(table).getAllByRole("row");
    expect(within(rows[2]).queryByRole("button", { name: /SMS kampaniya hisoboti/ })).toBeNull();
    await user.click(within(rows[1]).getByRole("button", { name: /^SMS kampaniya hisoboti — / }));

    const dialog = await screen.findByRole("dialog", { name: "Kampaniya hisoboti" });
    expect(dialog).toHaveTextContent("SMS kampaniya");
    expect(dialog).toHaveTextContent("Kuzgi chegirma 20%");
    const stats = await within(dialog).findByTestId("campaign-report-stats");
    expect(stats).toHaveTextContent("Yetkazildi—operator hisoboti hali kelmagan");
    expect(stats).toHaveTextContent("Narx30,1 ming so'mtaxminiy");
    const sms = within(dialog).getByTestId("campaign-report-sms");
    expect(sms).toHaveTextContent("Bo'laklar172 ta · 1 xabar = 2 bo'lak");
    expect(sms).toHaveTextContent("KodlashGSM-7");
    expect(sms).toHaveTextContent("Operator hisobotiHali kelmagan · kutilmoqda 64 ta");
    expect(sms).toHaveTextContent("Yuborilganlar narxi30 100 so'm");
    expect(api.get).toHaveBeenCalledWith("notifications/sms/campaigns/5/report");
    // CSV — faqat superadmin (`can_export`).
    expect(within(dialog).queryByRole("button", { name: "CSV yuklab olish" })).toBeNull();
    expect(await within(dialog).findByText("Yetkazilmaganlar yo'q")).toBeVisible();
    await user.click(within(dialog).getAllByRole("button", { name: "Yopish" }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Kampaniya hisoboti" })).toBeNull());
  });
});
