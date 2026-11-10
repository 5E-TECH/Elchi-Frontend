import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getThisMonthRange } from "../../../shared/lib/dateRange";
import { renderWithProviders } from "../../../test/test-utils";
import { formatDayDots, shiftDay, tashkentDayOf } from "./handedModel";
import CancelledMarkets from "./index";

/**
 * «Bekor qilinganlar» ichki tablari (2026-11-10): «Kutilmoqda» (marketlar) | «Topshirilgan» (har «Marketga
 * jo'natish» — bitta karta, kun bo'yicha). Holat URL'da (`?tab=handed`), tab sonlari, server filtrlari.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const MARKETS = [
  { market_id: "201", orders_count: 6, total_price_sum: 1845000, market: { id: "201", name: "Baraka Shop", phone_number: "+998903152241" } },
  { market_id: "202", orders_count: 4, total_price_sum: 2140000, market: { id: "202", name: "Nur Elektronika", phone_number: "+998936041872" } },
];

const now = new Date();
const today = tashkentDayOf(now);
const yesterday = shiftDay(today, -1);

const HANDOVERS = {
  data: [
    {
      id: "201_1762771320123456_520",
      market_id: "201",
      market: { id: "201", name: "Baraka Shop", phone_number: "+998903152241" },
      handed_at: now.toISOString(),
      day: today,
      handed_by: { id: "520", name: "Aziz Karimov" },
      method: "qr",
      manual_count: 1,
      orders_count: 6,
      total_price_sum: 1740000,
    },
    {
      id: "202_1762684920000000_521",
      market_id: "202",
      market: { id: "202", name: "Nur Elektronika", phone_number: null },
      handed_at: new Date(now.getTime() - 86_400_000).toISOString(),
      day: yesterday,
      handed_by: null,
      method: "pin",
      manual_count: 0,
      orders_count: 4,
      total_price_sum: 1120000,
    },
  ],
  total: 2,
  page: 1,
  limit: 24,
  totals: { batches: 3, orders: 11, amount: 3000000 },
};

let handovers: unknown = HANDOVERS;

const respond = () =>
  mocks.get.mockImplementation((url: string, config?: { params?: Record<string, unknown> }) => {
    if (url === "orders/markets/cancelled") return Promise.resolve({ data: { data: MARKETS } });
    if (url === "orders/markets/cancelled/handovers") {
      const body = typeof handovers === "function" ? (handovers as (p: unknown) => unknown)(config?.params) : handovers;
      return Promise.resolve({ data: body });
    }
    return Promise.resolve({ data: { data: [] } });
  });

const handoverCalls = () =>
  mocks.get.mock.calls
    .filter(([url]) => url === "orders/markets/cancelled/handovers")
    .map(([, config]) => (config as { params?: Record<string, unknown> } | undefined)?.params);

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

const adminState = {
  role: { id: "admin-1", role: "admin", region: null, name: "Admin" },
} as never;

const renderPage = (route = "/new-orders/cancelled") =>
  renderWithProviders(
    <>
      <CancelledMarkets />
      <LocationProbe />
    </>,
    { route, preloadedState: adminState },
  );

describe("Bekor qilinganlar — «Kutilmoqda | Topshirilgan» tablari", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    handovers = HANDOVERS;
    respond();
  });

  it("sukut — «Kutilmoqda» (marketlar ro'yxati); tab sonlari: marketlar va joriy oy topshirishlari", async () => {
    renderPage();
    const tabs = screen.getByRole("radiogroup", { name: "Bekor qilinganlar bo'limlari" });
    const pending = within(tabs).getByRole("radio", { name: /Kutilmoqda/ });
    const handed = within(tabs).getByRole("radio", { name: /Topshirilgan/ });
    expect(pending).toBeChecked();
    expect(handed).not.toBeChecked();
    await waitFor(() => expect(pending).toHaveTextContent("Kutilmoqda2"));
    await waitFor(() => expect(handed).toHaveTextContent("Topshirilgan3"));
    expect(screen.getByRole("region", { name: "Bekor qilingan buyurtmalari bor marketlar" })).toBeInTheDocument();

    const month = getThisMonthRange();
    expect(handoverCalls()[0]).toEqual({ page: 1, limit: 24, start_day: month.from, end_day: month.to });
  });

  it("«Topshirilgan» → ?tab=handed, kun guruhlari, kartalar (usul, qo'lda soni, xodim) va havola", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("radio", { name: /Topshirilgan/ }));
    expect(screen.getByTestId("location")).toHaveTextContent("/new-orders/cancelled?tab=handed");

    const card = screen.getByRole("region", { name: "Marketga topshirilgan bekor qilinganlar" });
    const todayGroup = await within(card).findByRole("region", { name: `Bugun · ${formatDayDots(today)}` });
    const yesterdayGroup = within(card).getByRole("region", { name: `Kecha · ${formatDayDots(yesterday)}` });

    const baraka = within(todayGroup).getByRole("link", { name: /Baraka Shop/ });
    expect(baraka).toHaveAttribute("href", "/new-orders/cancelled/handovers/201_1762771320123456_520");
    expect(within(baraka).getByText("6 ta buyurtma")).toBeInTheDocument();
    expect(within(baraka).getByText("QR orqali")).toBeInTheDocument();
    expect(within(baraka).getByText("1 ta qo'lda")).toBeInTheDocument();
    expect(within(baraka).getByText("Aziz Karimov")).toBeInTheDocument();

    const nur = within(yesterdayGroup).getByRole("link", { name: /Nur Elektronika/ });
    expect(within(nur).getByText("Parol orqali")).toBeInTheDocument();
    expect(within(nur).queryByText(/ta qo'lda/)).not.toBeInTheDocument();
    expect(within(nur).getByText("Xodim noma'lum")).toBeInTheDocument();

    // Xulosa — butun filtr bo'yicha (`totals`), sahifadagi kartalar emas.
    expect(within(card).getByText(/ta topshirish/).closest("p")).toHaveTextContent(/3 ta topshirish · 11 ta buyurtma · jami/);
    // Kartalar 2 ta, 12 dan kam — sahifalash yo'q.
    expect(within(card).queryByRole("navigation", { name: "Sahifalar" })).not.toBeInTheDocument();
  });

  it("URL'dagi sana oralig'i va qidiruv serverga; qidiruv kechiktirib, 1-sahifadan", async () => {
    const user = userEvent.setup();
    renderPage("/new-orders/cancelled?tab=handed&from=2026-10-01&to=2026-10-31&page=2");
    await screen.findByRole("link", { name: /Baraka Shop/ });
    expect(handoverCalls()[0]).toEqual({ page: 2, limit: 24, start_day: "2026-10-01", end_day: "2026-10-31" });

    await user.type(screen.getByRole("searchbox", { name: "Topshirilganlarni qidirish" }), "Baraka");
    await waitFor(() =>
      expect(handoverCalls().at(-1)).toEqual({
        page: 1,
        limit: 24,
        search: "Baraka",
        start_day: "2026-10-01",
        end_day: "2026-10-31",
      }),
    );
    // Har harfga emas — bitta so'rov (kechiktirish).
    expect(handoverCalls().filter((params) => params?.search)).toHaveLength(1);
    expect(screen.getByTestId("location")).toHaveTextContent("q=Baraka");
    expect(screen.getByTestId("location")).not.toHaveTextContent("page=");
  });

  it("qidiruv topmasa — «Qidiruvni tozalash» qidiruvsiz ro'yxatni qaytaradi", async () => {
    const user = userEvent.setup();
    handovers = (params: { search?: string } | undefined) =>
      params?.search ? { data: [], total: 0, totals: { batches: 0, orders: 0, amount: 0 } } : HANDOVERS;
    renderPage("/new-orders/cancelled?tab=handed&q=yoq");
    expect(await screen.findByText("Bu qidiruv bo'yicha topshirish topilmadi")).toBeInTheDocument();
    const clear = screen
      .getAllByRole("button", { name: "Qidiruvni tozalash" })
      .find((button) => button.dataset.variant === "secondary");
    await user.click(clear!);
    expect(await screen.findByRole("link", { name: /Baraka Shop/ })).toBeInTheDocument();
    expect(screen.getByTestId("location")).not.toHaveTextContent("q=");
  });

  it("bo'sh davr — «Bu davrda topshirish yo'q», tab soni 0", async () => {
    handovers = { data: [], total: 0, totals: { batches: 0, orders: 0, amount: 0 } };
    renderPage("/new-orders/cancelled?tab=handed");
    expect(await screen.findByText("Bu davrda topshirish yo'q")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Topshirilgan/ })).toHaveTextContent("Topshirilgan0");
  });

  it("«Kutilmoqda» ga qaytish — tab parametri olib tashlanadi, marketlar ro'yxati", async () => {
    const user = userEvent.setup();
    renderPage("/new-orders/cancelled?tab=handed");
    await screen.findByRole("link", { name: /Baraka Shop/ });
    await user.click(screen.getByRole("radio", { name: /Kutilmoqda/ }));
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/new-orders\/cancelled$/);
    expect(await screen.findByRole("table", { name: "Marketlar" })).toBeInTheDocument();
  });

  it("klaviatura: ← → bilan almashganda fokus tanlangan radioda qoladi (karta qayta yaratilmaydi)", async () => {
    renderPage();
    const pending = screen.getByRole("radio", { name: /Kutilmoqda/ });
    pending.focus();
    fireEvent.keyDown(pending, { key: "ArrowRight" });
    const handed = screen.getByRole("radio", { name: /Topshirilgan/ });
    expect(handed).toBeChecked();
    expect(handed).toHaveFocus();
    expect(await screen.findByRole("link", { name: /Baraka Shop/ })).toBeInTheDocument();
    // Karta o'sha — nomi tabga qarab.
    expect(screen.getByRole("region", { name: "Marketga topshirilgan bekor qilinganlar" })).toBeInTheDocument();

    fireEvent.keyDown(handed, { key: "ArrowLeft" });
    expect(screen.getByRole("radio", { name: /Kutilmoqda/ })).toHaveFocus();
    expect(screen.getByRole("region", { name: "Bekor qilingan buyurtmalari bor marketlar" })).toBeInTheDocument();
  });

  it("«Kutilmoqda» qidiruvi tab almashganda saqlanadi", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("link", { name: "Baraka Shop" });
    await user.type(screen.getByRole("searchbox", { name: "Marketlarni qidirish" }), "Nur");
    await user.click(screen.getByRole("radio", { name: /Topshirilgan/ }));
    await user.click(screen.getByRole("radio", { name: /Kutilmoqda/ }));
    expect(screen.getByRole("searchbox", { name: "Marketlarni qidirish" })).toHaveValue("Nur");
    expect(screen.queryByRole("link", { name: "Baraka Shop" })).not.toBeInTheDocument();
  });

  it("URL'dagi sahifa oxirgisidan katta — oxirgi sahifaga o'tadi, «topshirish yo'q» chizilmaydi", async () => {
    const totals = { batches: 30, orders: 90, amount: 9_000_000 };
    handovers = (params: { page?: number } | undefined) =>
      (params?.page ?? 1) > 2 ? { data: [], total: 30, totals } : { ...HANDOVERS, total: 30, totals };
    renderPage("/new-orders/cancelled?tab=handed&page=5");
    expect(await screen.findByRole("link", { name: /Baraka Shop/ })).toBeInTheDocument();
    expect(handoverCalls().map((params) => params?.page)).toEqual([5, 2]);
    expect(screen.getByTestId("location")).toHaveTextContent("page=2");
    expect(screen.queryByText("Bu davrda topshirish yo'q")).not.toBeInTheDocument();
    // 30 > 12 — sahifalash ko'rinadi.
    expect(screen.getByRole("navigation", { name: "Sahifalar" })).toBeInTheDocument();
  });
});
