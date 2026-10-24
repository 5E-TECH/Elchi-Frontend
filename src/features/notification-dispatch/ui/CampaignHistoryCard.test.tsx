import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { onlineManager } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { api } from "../../../shared/api/api";
import { renderWithProviders } from "../../../test/test-utils";
import { CampaignHistoryCard } from "./CampaignHistoryCard";

/**
 * KM-3 «Kampaniyalar tarixi» (maket `superadmin-notifications-send-schedule`) + bekor qilish oynasi
 * (`-campaign-cancel-dialog`) + hisobot oynasi (`-campaign-report-dialog`). Vaqt — 2026-10-21 11:00 Toshkent.
 */

const NOW = new Date("2026-10-21T06:00:00Z");

const ROWS = [
  {
    id: "11",
    status: "queued",
    display_status: "scheduled",
    title: "Kuzgi chegirma",
    category: "marketing",
    channels: ["in_app", "push"],
    audience: { roles: ["market", "manager", "logist"], include_customers: true, segment: { region_id: "1" } },
    total: 1308,
    sent: 0,
    progress_pct: 0,
    scheduled_at: "2026-10-22T10:00:00+05:00",
    can_cancel: true,
  },
  {
    id: "12",
    status: "running",
    display_status: "sending",
    title: "Yangi tariflar",
    category: "system",
    channels: ["in_app", "realtime"],
    audience: { roles: ["market"] },
    total: 4860,
    sent: 2040,
    progress_pct: 42,
    created_at: "2026-10-21T05:30:00Z",
    scheduled_at: null,
    paused_until: "2026-10-22T04:00:00.000Z",
    can_cancel: true,
  },
  {
    id: "14",
    status: "done",
    display_status: "sent",
    title: "Kuryerlar uchun yangi qoidalar",
    category: "system",
    channels: ["in_app", "realtime", "push"],
    audience: { roles: ["courier"] },
    total: 212,
    sent: 210,
    failed: 2,
    progress_pct: 100,
    created_at: "2026-10-20T06:00:00Z",
    scheduled_at: null,
    can_cancel: false,
  },
];

const REPORT = {
  kind: "notification",
  campaign: { id: "14", title: "Kuryerlar uchun yangi qoidalar", display_status: "sent", channels: ["in_app", "push"] },
  stats: { audience: 212, sent: 210, delivered: null, failed: 0, skipped: 0, pending: 0, undelivered: 72 },
  by_channel: [
    { channel: "in_app", sent: 212, failed: 0, skipped: 0, pending: 0, statuses: { sent: 212 } },
    { channel: "push", sent: 140, failed: 2, skipped: 70, pending: 0, statuses: { sent: 140, failed: 2, no_subscription: 70 } },
  ],
  permissions: { can_export: false },
};

let getSpy: MockInstance<typeof api.get>;
let postSpy: MockInstance<typeof api.post>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  getSpy = vi.spyOn(api, "get").mockImplementation((async (url: string, config?: { params?: Record<string, unknown> }) => {
    if (url === "notifications/campaigns") {
      const state = config?.params?.state;
      const items = ROWS.filter((row) => !state || row.display_status === state);
      return { data: { data: { items, meta: { page: 1, limit: 10, total: items.length, totalPages: 1 } } } };
    }
    if (url === "notifications/campaigns/14/report") return { data: { data: REPORT } };
    if (url === "notifications/campaigns/14/undelivered") {
      return {
        data: {
          data: {
            items: [
              { ref_id: "1", recipient_id: "300", name: "Akmal Rasulov", role: "courier", phone: null, failures: [{ channel: "push", status: "failed", reason: "raw provider text" }] },
              { ref_id: "2", recipient_id: "301", name: "Sardor Ahmedov", role: "courier", phone: null, failures: [{ channel: "push", status: "no_subscription", reason: null }] },
            ],
            meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
            unlisted_failed: 0,
          },
        },
      };
    }
    if (url === "region") return { data: { data: [{ id: "1", name: "Toshkent sh." }] } };
    return { data: { data: [] } };
  }) as never);
  postSpy = vi.spyOn(api, "post").mockImplementation((async (url: string) => {
    if (url === "notifications/campaigns/12/cancel")
      return { data: { data: { ...ROWS[1], status: "cancelled", display_status: "cancelled", can_cancel: false } } };
    throw new Error(url);
  }) as never);
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Ro'yxat javobini almashtirish (boshqa so'rovlar — asosiy soxta). */
const listReturns = (items: Array<Record<string, unknown>>) => {
  const base = getSpy.getMockImplementation()!;
  getSpy.mockImplementation((async (url: string, config?: unknown) =>
    url === "notifications/campaigns"
      ? { data: { data: { items, meta: { page: 1, limit: 10, total: items.length, totalPages: 1 } } } }
      : base(url, config as never)) as never);
};

describe("CampaignHistoryCard (KM-3)", () => {
  it("qatorlar: Toshkent vaqti, auditoriya, holat, progress va amal", async () => {
    renderWithProviders(<CampaignHistoryCard />);
    const card = await screen.findByTestId("campaign-history");
    const table = await within(card).findByRole("table", { name: "Kampaniyalar tarixi" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent("Ertaga, 10:00");
    expect(rows[1]).toHaveTextContent("1 308 ta");
    expect(rows[1]).toHaveTextContent("Reklama · Ilova ichida, Push");
    expect(rows[1]).toHaveTextContent("Rejalashtirilgan");
    await waitFor(() => expect(rows[1]).toHaveTextContent("Mijoz, Market, Menejer, Logist · Toshkent sh."));
    expect(rows[2]).toHaveTextContent("Bugun, 10:30");
    expect(rows[2]).toHaveTextContent("Tungi taqiq — ertaga, 09:00 da davom etadi");
    expect(rows[2]).toHaveTextContent("2 040 / 4 860");
    expect(rows[3]).toHaveTextContent("Kecha, 11:00");
    expect(rows[3]).toHaveTextContent("210 yuborildi · 2 xato");
    expect(rows[3]).toHaveTextContent("Xodim: Kuryer");
    expect(within(rows[1]).getByRole("button", { name: "«Kuzgi chegirma» kampaniyasini bekor qilish" })).toBeVisible();
    expect(within(rows[3]).getByRole("button", { name: "«Kuryerlar uchun yangi qoidalar» hisoboti" })).toBeVisible();
    // WIsb9Ytq: yuborilgan kampaniyada «Bekor qilish» YO'Q (faqat `can_cancel` da).
    expect(within(rows[3]).queryByRole("button", { name: /bekor qilish/ })).toBeNull();
    expect(card).toHaveTextContent("3 tadan 1–3");
    // Yagona yuborilayotgan kampaniya tungi taqiqda to'xtagan — 3 s yangilanish yo'q, «jonli» yozuv ham yo'q.
    expect(card).not.toHaveTextContent("Holat har 3 soniyada yangilanadi");
    // Har chiziqning o'z nomi.
    expect(within(rows[2]).getByRole("progressbar", { name: "«Yangi tariflar» — yuborildi" })).toHaveAttribute(
      "aria-valuenow",
      "42",
    );
    expect(getSpy).toHaveBeenCalledWith("notifications/campaigns", { params: { page: 1, limit: 10 } });
  });

  it("bekor qilingan / xato: chiziq — yuborilganlar ulushi (backend `progress_pct` 100); jonli yozuv yo'q", async () => {
    listReturns([
      {
        id: "15",
        status: "cancelled",
        display_status: "cancelled",
        title: "Bayram kunlari ish tartibi",
        category: "system",
        channels: ["in_app"],
        audience: { roles: ["manager"] },
        total: 1312,
        sent: 406,
        skipped: 906,
        progress_pct: 100,
        created_at: "2026-10-06T04:00:00Z",
        can_cancel: false,
      },
    ]);
    renderWithProviders(<CampaignHistoryCard />);
    const card = await screen.findByTestId("campaign-history");
    const table = await within(card).findByRole("table");
    expect(within(table).getByRole("progressbar", { name: "«Bayram kunlari ish tartibi» — yuborildi" })).toHaveAttribute(
      "aria-valuenow",
      "31",
    );
    expect(table).toHaveTextContent("406 / 1 312");
    expect(card).not.toHaveTextContent("Holat har 3 soniyada yangilanadi");
  });

  it("navbatdagi reklama tungi taqiqqa surilgan — vaqt `paused_until`, izoh «Tungi taqiq tufayli surildi»", async () => {
    listReturns([
      {
        id: "17",
        status: "queued",
        display_status: "scheduled",
        title: "Kechki aksiya",
        category: "marketing",
        channels: ["in_app"],
        audience: { roles: ["market"] },
        total: 98,
        sent: 0,
        progress_pct: 0,
        created_at: "2026-10-21T05:50:00Z",
        // «Darhol» kechqurun yaratilgan: backend ertangi 09:00 ga to'xtatdi.
        scheduled_at: "2026-10-20T15:00:00Z",
        paused_until: "2026-10-22T04:00:00Z",
        can_cancel: true,
      },
    ]);
    renderWithProviders(<CampaignHistoryCard />);
    const card = await screen.findByTestId("campaign-history");
    const table = await within(card).findByRole("table");
    const row = within(table).getAllByRole("row")[1];
    expect(row).toHaveTextContent("Ertaga, 09:00");
    expect(row).toHaveTextContent("Tungi taqiq tufayli surildi");
    expect(row).not.toHaveTextContent("Kecha");
  });

  it("oflayn — «Internet aloqasi yo'q» («Hali kampaniya yo'q» emas)", async () => {
    onlineManager.setOnline(false);
    renderWithProviders(<CampaignHistoryCard />);
    const card = await screen.findByTestId("campaign-history");
    expect(await within(card).findByText("Internet aloqasi yo'q")).toBeInTheDocument();
    expect(card).not.toHaveTextContent("Hali kampaniya yo'q");
    onlineManager.setOnline(true);
    expect(await within(card).findByRole("table")).toBeVisible();
  });

  it("holat tablari — backend `state`; bo'sh holat", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CampaignHistoryCard />);
    const card = await screen.findByTestId("campaign-history");
    await within(card).findByRole("table");
    await user.click(within(card).getByRole("tab", { name: "Rejalashtirilgan" }));
    await waitFor(() =>
      expect(getSpy).toHaveBeenLastCalledWith("notifications/campaigns", {
        params: { page: 1, limit: 10, state: "scheduled" },
      }),
    );
    await user.click(within(card).getByRole("tab", { name: "Xato" }));
    expect(await within(card).findByText("«Xato» holatida kampaniya yo'q")).toBeVisible();
    await user.click(within(card).getByRole("button", { name: "Barchasini ko'rsatish" }));
    expect(await within(card).findByRole("table")).toBeVisible();
  });

  it("bekor qilish — xavfli tasdiq oynasi: progress, «Qolgan 2 820 ta», so'ng POST va xabar", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CampaignHistoryCard />);
    const card = await screen.findByTestId("campaign-history");
    await within(card).findByRole("table");
    await user.click(within(card).getByRole("button", { name: "«Yangi tariflar» kampaniyasini bekor qilish" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Kampaniyani bekor qilasizmi?" });
    expect(dialog).toHaveTextContent("Navbatdagi qismlar yuborilmaydi. Allaqachon yuborilgan xabarlar qaytarilmaydi.");
    expect(within(dialog).getByTestId("campaign-cancel-summary")).toHaveTextContent("Yuborilmoqda");
    expect(dialog).toHaveTextContent("Qolgan 2 820 ta qabul qiluvchiga yuborilmaydi");
    expect(within(dialog).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "42");
    await user.click(within(dialog).getByRole("button", { name: "Kampaniyani bekor qilish" }));
    expect(postSpy).toHaveBeenCalledWith("notifications/campaigns/12/cancel");
    expect(await screen.findByText("Kampaniya bekor qilindi")).toBeInTheDocument();
  });

  it("hisobot oynasi: 4 katak, kanal jadvali, yetkazilmaganlar (sabab — kod xaritasidan); CSV faqat can_export da", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CampaignHistoryCard />);
    const card = await screen.findByTestId("campaign-history");
    await within(card).findByRole("table");
    await user.click(within(card).getByRole("button", { name: "«Kuryerlar uchun yangi qoidalar» hisoboti" }));
    const dialog = await screen.findByRole("dialog", { name: "Kampaniya hisoboti" });
    expect(dialog).toHaveTextContent("Kuryerlar uchun yangi qoidalar · Kecha, 11:00");
    const report = await within(dialog).findByTestId("campaign-report");
    await waitFor(() => expect(report).toHaveTextContent("Auditoriya212qabul qiluvchi"));
    expect(report).toHaveTextContent("Yuborildi210xatosiz");
    expect(report).toHaveTextContent("Xato2Push kanalida");
    expect(report).toHaveTextContent("O'tkazib yuborildi70Push obunasi yo'q");
    const table = within(report).getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(table).toHaveTextContent("Ilova ichida212000");
    expect(await within(report).findByText("Akmal Rasulov")).toBeVisible();
    expect(report).toHaveTextContent("Push — xato");
    expect(report).toHaveTextContent("Push yetkazilmadi");
    expect(report).toHaveTextContent("Push — o'tkazildi");
    expect(report).not.toHaveTextContent("raw provider text");
    expect(report).toHaveTextContent("2 tadan 1–2");
    expect(within(dialog).queryByRole("button", { name: "CSV yuklab olish" })).toBeNull();
    await user.click(within(dialog).getAllByRole("button", { name: "Yopish" }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Kampaniya hisoboti" })).toBeNull());
  });
});
