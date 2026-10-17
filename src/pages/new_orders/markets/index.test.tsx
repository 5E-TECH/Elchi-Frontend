import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import Markets from "./index";

/**
 * «Qabul va yaratish» → «Marketlar» (dizayn v2, maket `superadmin-neworders-markets`): jadval, kunlik xulosa,
 * mijoz tomonidagi qidiruv va saralash, holatlar (bo'sh, natija yo'q, xato), telefonda kartalar, market roli
 * yo'naltirilishi.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const TODAY_MARKETS = [
  { market_id: "11", orders_count: 9, total_price_sum: 4860000, market: { name: "Nur Elektronika", phone_number: "+998936041872" } },
  { market_id: "12", orders_count: 14, total_price_sum: 3420000, market: { name: "Baraka Shop", phone_number: "+998903152241" } },
  { market_id: "13", orders_count: 2, total_price_sum: 310000, market: { name: "Oila Market", phone_number: "+998952407658" } },
];

const respondWith = (markets: unknown) => {
  mocks.get.mockImplementation((url: string) =>
    url === "orders/markets/new"
      ? markets instanceof Error
        ? Promise.reject(markets)
        : Promise.resolve({ data: { data: markets } })
      : Promise.resolve({ data: { data: [] } }),
  );
};

const LocationProbe = () => <span data-testid="location">{useLocation().pathname}</span>;

const stateFor = (role: string, branchType?: string, id = `${role}-1`) =>
  ({
    role: { id, role, region: null, name: role },
    user: {
      user: { id, role, ...(branchType ? { branch: { id: "1", type: branchType } } : {}) },
      isAuthenticated: true,
      accessToken: null,
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;

const renderMarkets = (role = "admin", branchType?: string, id?: string) =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/new-orders" element={<Markets />} />
        <Route path="/new-orders/:marketId" element={<p>Market sahifasi</p>} />
      </Routes>
      <LocationProbe />
    </>,
    { route: "/new-orders", preloadedState: stateFor(role, branchType, id) },
  );

const bodyRows = () => within(screen.getByRole("table", { name: "Marketlar" })).getAllByRole("row").slice(1);
const marketNames = () => bodyRows().map((row) => within(row).getAllByRole("link")[0].textContent);

describe("Marketlar — jadval va xulosa", () => {
  beforeEach(() => respondWith(TODAY_MARKETS));

  it("qatorlar: buyurtmalar soni bo'yicha kamayish (sukut), havolalar, telefon va summa formati", async () => {
    renderMarkets();

    await waitFor(() => expect(marketNames()).toEqual(["Baraka Shop", "Nur Elektronika", "Oila Market"]));
    const header = screen.getByRole("columnheader", { name: /Buyurtmalar/ });
    expect(header).toHaveAttribute("aria-sort", "descending");

    const [first] = bodyRows();
    expect(within(first).getByRole("link", { name: "Baraka Shop" })).toHaveAttribute("href", "/new-orders/12");
    expect(within(first).getByRole("link", { name: "Baraka Shop ni ochish" })).toHaveAttribute("href", "/new-orders/12");
    expect(first).toHaveTextContent("+998 90 315 22 41");
    expect(first).toHaveTextContent("14 ta");
    expect(first).toHaveTextContent("3 420 000 so'm");
  });

  it("tablar variantida xulosa qidiruv yonida, «Bugun:» siz", async () => {
    renderMarkets("superadmin");

    const card = screen.getByRole("region", { name: "Qabul kutayotgan buyurtmalar" });
    await waitFor(() =>
      expect(within(card).getByText(/ta market/).closest("p")).toHaveTextContent(
        "3 ta market · 25 ta buyurtma · jami 8 590 000 so'm",
      ),
    );
    expect(within(card).queryByText(/Bugun:/)).not.toBeInTheDocument();
  });

  it("HQ registratori (tablar bor): xulosa «Bugun: …» bilan, havola «… buyurtmalarini ochish» (maket registrator-new-orders-markets)", async () => {
    renderMarkets("registrator", "HQ");

    const card = screen.getByRole("region", { name: "Qabul kutayotgan buyurtmalar" });
    await waitFor(() =>
      expect(within(card).getByText(/ta market/).closest("p")).toHaveTextContent(
        "Bugun: 3 ta market · 25 ta buyurtma · jami 8 590 000 so'm",
      ),
    );
    const [first] = bodyRows();
    expect(within(first).getByRole("link", { name: "Baraka Shop buyurtmalarini ochish" })).toHaveAttribute(
      "href",
      "/new-orders/12",
    );
  });

  it("saralash: «Market» bosilsa nom bo'yicha, yana bosilsa teskari", async () => {
    const user = userEvent.setup();
    renderMarkets();
    await waitFor(() => expect(bodyRows()).toHaveLength(3));

    await user.click(screen.getByRole("button", { name: /^Market/ }));
    expect(marketNames()).toEqual(["Baraka Shop", "Nur Elektronika", "Oila Market"]);
    await user.click(screen.getByRole("button", { name: /^Market/ }));
    expect(marketNames()).toEqual(["Oila Market", "Nur Elektronika", "Baraka Shop"]);

    await user.click(screen.getByRole("button", { name: /Umumiy summa/ }));
    expect(marketNames()).toEqual(["Nur Elektronika", "Baraka Shop", "Oila Market"]);
  });

  it("qatorni bosish market buyurtmalarini ochadi (v1 dagidek)", async () => {
    const user = userEvent.setup();
    renderMarkets();
    await waitFor(() => expect(bodyRows()).toHaveLength(3));

    await user.click(within(bodyRows()[1]).getByText("+998 93 604 18 72"));
    expect(screen.getByTestId("location")).toHaveTextContent("/new-orders/11");
  });
});

describe("Marketlar — qidiruv (mijoz tomonida)", () => {
  beforeEach(() => respondWith(TODAY_MARKETS));

  it("nom va telefon raqami bo'yicha; natija yo'q — «Qidiruvni tozalash»", async () => {
    const user = userEvent.setup();
    renderMarkets();
    await waitFor(() => expect(bodyRows()).toHaveLength(3));
    const search = screen.getByRole("searchbox", { name: "Marketlarni qidirish" });
    expect(search).toHaveAttribute("placeholder", "Market nomi yoki telefon raqami");

    await user.type(search, "oila");
    expect(marketNames()).toEqual(["Oila Market"]);

    await user.clear(search);
    await user.type(search, "93 604");
    expect(marketNames()).toEqual(["Nur Elektronika"]);

    await user.clear(search);
    await user.type(search, "Chilonzor");
    const noMatch = screen.getByText("Bu qidiruv bo'yicha market topilmadi").parentElement as HTMLElement;
    // Maydondagi × ham «Qidiruvni tozalash» — bo'sh holatdagi tugmani bosamiz.
    await user.click(within(noMatch).getByRole("button", { name: "Qidiruvni tozalash" }));
    expect(bodyRows()).toHaveLength(3);
    expect(search).toHaveValue("");

    // Qidiruv backendga yuborilmaydi (endpoint qidiruvni qabul qilmaydi) — so'rov bitta.
    expect(mocks.get.mock.calls.filter(([url]) => url === "orders/markets/new")).toHaveLength(1);
  });
});

describe("Marketlar — holatlar", () => {
  it("bo'sh kun: «Bugun buyurtma yo'q»", async () => {
    respondWith([]);
    renderMarkets();
    expect(await screen.findByText("Bugun buyurtma yo'q")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("xato: «Qayta urinish» so'rovni qaytaradi, xulosa yozilmaydi", async () => {
    const user = userEvent.setup();
    respondWith(new Error("Network Error"));
    renderMarkets();

    const retry = await screen.findByRole("button", { name: "Qayta urinish" });
    expect(screen.queryByText(/ta market/)).not.toBeInTheDocument();

    respondWith(TODAY_MARKETS);
    await user.click(retry);
    await waitFor(() => expect(bodyRows()).toHaveLength(3));
  });
});

describe("Marketlar — telefon (< 768): kartalar", () => {
  const original = window.matchMedia;
  beforeEach(() => {
    respondWith(TODAY_MARKETS);
    window.matchMedia = ((query: string) => ({
      matches: query.includes("max-width: 767px"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;
  });
  afterEach(() => {
    window.matchMedia = original;
  });

  it("har market — bitta havola: nom, summa, telefon · buyurtmalar", async () => {
    renderMarkets("manager", "HYBRID");

    const list = await screen.findByRole("list", { name: "Marketlar" });
    const cards = within(list).getAllByRole("link");
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveAttribute("href", "/new-orders/12");
    expect(cards[0]).toHaveTextContent("Baraka Shop3 420 000 so'm+998 90 315 22 41 · 14 ta buyurtma");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("Marketlar — market roli", () => {
  it("o'z «Yangi buyurtmalar» sahifasiga yo'naltiriladi, ro'yxat so'ralmaydi", async () => {
    respondWith(TODAY_MARKETS);
    renderMarkets("market", undefined, "121");

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/new-orders/121"));
    expect(mocks.get.mock.calls.map(([url]) => url)).not.toContain("orders/markets/new");
  });
});
