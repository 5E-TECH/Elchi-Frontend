import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import CancelledMarkets from "./index";

/**
 * «Bekor qilinganlar» — marketlar ro'yxati (dizayn v2, `SourceListCard`). So'rov parametrsiz (kalit tab soni bilan
 * umumiy, backend `search` ni qabul qilmaydi), qidiruv mijoz tomonida, xulosa va havolalar maketdagidek.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const CANCELLED_MARKETS = [
  { market_id: "201", orders_count: "6", total_price_sum: "1845000", market: { id: "201", name: "Baraka Shop", phone_number: "+998903152241" } },
  { market_id: "202", orders_count: 4, total_price_sum: 2140000, market: { id: "202", name: "Nur Elektronika", phone_number: "+998936041872" } },
];

const respondWith = (markets: unknown) => {
  mocks.get.mockImplementation((url: string) =>
    url === "orders/markets/cancelled"
      ? markets instanceof Error
        ? Promise.reject(markets)
        : Promise.resolve({ data: { data: markets } })
      : Promise.resolve({ data: { data: [] } }),
  );
};

const adminState = {
  role: { id: "admin-1", role: "admin", region: null, name: "Admin" },
} as never;

const renderList = () =>
  renderWithProviders(<CancelledMarkets />, { route: "/new-orders/cancelled", preloadedState: adminState });

describe("Bekor qilinganlar — marketlar ro'yxati", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    respondWith(CANCELLED_MARKETS);
  });

  it("parametrsiz so'rov, xulosa, saralash (ko'p buyurtmali tepada) va havolalar", async () => {
    renderList();

    const card = screen.getByRole("region", { name: "Bekor qilingan buyurtmalari bor marketlar" });
    const table = await within(card).findByRole("table", { name: "Marketlar" });
    // Qidiruv parametri yuborilmaydi (tab sonidagi so'rov bilan bitta kalit).
    const calls = mocks.get.mock.calls.filter(([url]) => url === "orders/markets/cancelled");
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every(([, config]) => config?.params === undefined)).toBe(true);

    expect(within(card).getByText(/ta bekor qilingan buyurtma/)).toHaveTextContent("10 ta bekor qilingan buyurtma");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(within(rows[0]).getByRole("link", { name: "Baraka Shop" })).toHaveAttribute("href", "/new-orders/cancelled/201");
    expect(within(rows[0]).getByText("6 ta")).toBeInTheDocument();
    expect(
      within(rows[1]).getByRole("link", { name: "Nur Elektronika bekor qilingan buyurtmalarini ochish" }),
    ).toHaveAttribute("href", "/new-orders/cancelled/202");
  });

  it("qidiruv mijoz tomonida: telefon raqamlari bo'yicha ham; topilmasa — tozalash", async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole("link", { name: "Baraka Shop" });
    const requests = mocks.get.mock.calls.length;

    const search = screen.getByRole("searchbox", { name: "Marketlarni qidirish" });
    await user.type(search, "93 604");
    expect(screen.queryByRole("link", { name: "Baraka Shop" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nur Elektronika" })).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "yo'q market");
    expect(screen.getByText("Bu qidiruv bo'yicha market topilmadi")).toBeInTheDocument();
    // Bo'sh holatdagi tugma (maydon ichidagi «×» ham shu nomda).
    const clear = screen
      .getAllByRole("button", { name: "Qidiruvni tozalash" })
      .find((button) => button.dataset.variant === "secondary");
    await user.click(clear!);
    expect(screen.getByRole("link", { name: "Baraka Shop" })).toBeInTheDocument();
    // Qidiruv serverga bormaydi.
    expect(mocks.get.mock.calls.length).toBe(requests);
  });

  it("bo'sh ro'yxat — «Bekor qilingan buyurtma yo'q»", async () => {
    respondWith([]);
    renderList();
    expect(await screen.findByText("Bekor qilingan buyurtma yo'q")).toBeInTheDocument();
  });

  it("xato — «Qayta urinish» so'rovni qaytaradi", async () => {
    respondWith(new Error("500"));
    const user = userEvent.setup();
    renderList();
    const retry = await screen.findByRole("button", { name: "Qayta urinish" });
    respondWith(CANCELLED_MARKETS);
    await user.click(retry);
    expect(await screen.findByRole("link", { name: "Baraka Shop" })).toBeInTheDocument();
  });
});
