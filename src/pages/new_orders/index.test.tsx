import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import { LegacyOrderCreateRedirect } from "../../app/lib/routes";
import NewOrders from "./index";
import Markets from "./markets";
import NewOrdersTabs from "./ui/NewOrdersTabs";

/**
 * «Qabul va yaratish» qobig'i (`/new-orders/*`, dizayn v2): sarlavha, «Buyurtma yaratish» havolasi,
 * rolga qarab tablar (v1 shartlari) va ulardagi sonlar, bola sahifa rejimlari (bare / hosted / legacy).
 */

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../shared/api/api", () => ({
  api: { get: mocks.get, post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const TODAY_MARKETS = [
  { market_id: "11", orders_count: 9, total_price_sum: 4860000, market: { name: "Nur Elektronika", phone_number: "+998936041872" } },
  { market_id: "12", orders_count: 14, total_price_sum: 3420000, market: { name: "Baraka Shop", phone_number: "+998903152241" } },
];

/** Soxta backend: yo'l → javob. Noma'lum yo'l — bo'sh ro'yxat. */
const respond = (overrides: Record<string, unknown> = {}) => {
  mocks.get.mockImplementation((url: string) => {
    const routes: Record<string, unknown> = {
      "orders/markets/new": { data: TODAY_MARKETS },
      "orders/external/sources": {
        data: [
          { market_id: "121", orders_count: 7, total_price_sum: 1, oldest_at: null },
          { market_id: "122", orders_count: 5, total_price_sum: 1, oldest_at: null },
        ],
      },
      "branches/with-sent-batches": [{ id: "b1", name: "Andijon" }, { id: "b2", name: "Samarqand" }, { id: "b3", name: "Buxoro" }],
      "orders/markets/cancelled": { data: Array.from({ length: 9 }, (_, i) => ({ market_id: String(i + 1), orders_count: 1, total_price_sum: 1 })) },
      "orders/markets/121/new": { data: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }, { id: "5" }] },
      "orders/markets/121/cancelled": { data: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }, { id: "f" }] },
      ...overrides,
    };
    const body = url in routes ? routes[url] : { data: [] };
    return body instanceof Error ? Promise.reject(body) : Promise.resolve({ data: body });
  });
};

const LocationProbe = () => {
  const location = useLocation();
  const market = (location.state as { selectedMarket?: { name: string } } | null)?.selectedMarket;
  return (
    <span data-testid="location" data-market={market?.name ?? ""}>
      {location.pathname}
    </span>
  );
};

const stateFor = (role: string, branchType?: string, id = `${role}-1`) =>
  ({
    role: { id, role, region: null, name: role },
    user: {
      user: {
        id,
        role,
        ...(branchType ? { branch: { id: "1", type: branchType } } : {}),
      },
      isAuthenticated: true,
      accessToken: null,
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;

/** Haqiqiy route daraxti kabi: qobiq + bola sahifalar (bolalar o'rnida belgilar). */
const renderShell = (route: string, role: string, branchType?: string, id?: string) =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/new-orders" element={<NewOrders />}>
          <Route index element={<Markets />} />
          <Route path="create" element={<p>Yaratish sahifasi</p>} />
          <Route path="incoming" element={<p>Manba tanlash</p>} />
          <Route path="incoming/:marketId" element={<p>Skaner</p>} />
          <Route path="branches" element={<p>Filial paketlari sahifasi</p>} />
          <Route path="branches/:branchId" element={<p>Filial paketlari ro'yxati</p>} />
          <Route path="branches/:branchId/batches/:batchId" element={<p>Paket tafsiloti</p>} />
          <Route path="cancelled" element={<p>Bekor qilinganlar sahifasi</p>} />
          <Route
            path="cancelled/:marketId"
            element={
              // Hosted bola (market roli): tablar bola kartasining boshida — haqiqiy sahifadagidek.
              <>
                <NewOrdersTabs />
                <p>Bekor qilingan market</p>
              </>
            }
          />
          <Route path="userDetail/:id" element={<p>Foydalanuvchi sahifasi</p>} />
          <Route path=":marketId" element={<p>Market buyurtmalari</p>} />
          <Route path=":marketId/edit/:orderId" element={<p>Tahrirlash</p>} />
        </Route>
      </Routes>
      <LocationProbe />
    </>,
    { route, preloadedState: stateFor(role, branchType, id) },
  );

const tabsNav = () => screen.getByRole("navigation", { name: "Qabul manbalari" });

describe("Qabul va yaratish — sarlavha va «Buyurtma yaratish»", () => {
  beforeEach(() => respond());

  it.each([
    ["admin", undefined],
    ["market", undefined],
    ["registrator", "REGIONAL"],
  ])("%s: sarlavhadagi havola /new-orders/create ni ochadi", async (role, branchType) => {
    const user = userEvent.setup();
    renderShell("/new-orders", role, branchType);

    expect(screen.getByRole("heading", { level: 1, name: "Qabul va yaratish" })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Buyurtma yaratish" });
    expect(link).toHaveAttribute("href", "/new-orders/create");
    await user.click(link);

    expect(screen.getByTestId("location")).toHaveTextContent("/new-orders/create");
  });

  it("izoh: xodimda — qabul manbalari, marketda — o'z buyurtmalari", () => {
    renderShell("/new-orders/incoming", "admin");
    expect(
      screen.getByText("Buyurtma yaratish va marketlar, filiallar hamda hamkorlardan kelgan buyurtmalarni qabul qilish"),
    ).toBeInTheDocument();
  });

  it("market: o'z izohi", () => {
    renderShell("/new-orders/cancelled/121", "market", undefined, "121");
    expect(screen.getByText("Yangi buyurtmalaringiz va bekor qilinganlarni pochtaga topshirish")).toBeInTheDocument();
  });
});

describe("Qabul va yaratish — tablar (v1 shartlari) va sonlar", () => {
  beforeEach(() => respond());

  it("admin: 4 ta tab, «Filial paketlari», sonlar backenddan; «Buyurtma yaratish» tab emas", async () => {
    renderShell("/new-orders", "admin");

    const nav = tabsNav();
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/new-orders",
      "/new-orders/incoming",
      "/new-orders/branches",
      "/new-orders/cancelled",
    ]);
    expect(within(nav).getByRole("link", { current: "page" })).toHaveTextContent("Marketlar");
    // Sonlar: marketlar 2 ta, posilkalar 7+5, filiallar 3 ta, bekor qilingan marketlar 9 ta.
    await waitFor(() => expect(links[0]).toHaveTextContent("Marketlar 2"));
    await waitFor(() => expect(links[1]).toHaveTextContent("Kiruvchi posilkalar 12"));
    await waitFor(() => expect(links[2]).toHaveTextContent("Filial paketlari 3"));
    await waitFor(() => expect(links[3]).toHaveTextContent("Bekor qilinganlar 9"));
    expect(screen.queryByText("Filial batchlari")).not.toBeInTheDocument();
    expect(screen.getAllByText("Buyurtma yaratish")).toHaveLength(1);
  });

  it("son yuklanmagan yoki xato bo'lsa — yozilmaydi («0» emas)", async () => {
    respond({ "orders/external/sources": new Error("500") });
    renderShell("/new-orders", "superadmin");

    const incoming = within(tabsNav()).getByRole("link", { name: /Kiruvchi posilkalar/ });
    await waitFor(() => expect(within(tabsNav()).getByRole("link", { name: /Marketlar/ })).toHaveTextContent("Marketlar 2"));
    expect(incoming).toHaveTextContent(/^Kiruvchi posilkalar$/);
  });

  it("HQ registratori: Marketlar + Bekor qilinganlar", () => {
    renderShell("/new-orders", "registrator", "HQ");
    const links = within(tabsNav()).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/new-orders", "/new-orders/cancelled"]);
  });

  it.each([
    ["manager", "HYBRID"],
    ["registrator", "REGIONAL"],
  ])("%s (%s): bitta tab — tablar qatori yo'q, karta sarlavhasi «Marketlar» + «Bugun: …»", async (role, branchType) => {
    renderShell("/new-orders", role, branchType);

    expect(screen.queryByRole("navigation", { name: "Qabul manbalari" })).not.toBeInTheDocument();
    const card = screen.getByRole("region", { name: "Marketlar" });
    expect(within(card).getByRole("heading", { level: 2, name: "Marketlar" })).toBeInTheDocument();
    await waitFor(() =>
      expect(within(card).getByText(/Bugun:/).closest("p")).toHaveTextContent(
        "Bugun: 2 ta market · 23 ta buyurtma · jami 8 280 000 so'm",
      ),
    );
    // Faqat ko'rinadigan tab so'raladi: menejer/registrator uchun posilka, filial va bekor so'rovlari yo'q.
    const urls = mocks.get.mock.calls.map(([url]) => url);
    expect(urls).not.toContain("orders/external/sources");
    expect(urls).not.toContain("branches/with-sent-batches");
    expect(urls).not.toContain("orders/markets/cancelled");
  });

  it("market (hosted bola — tablar bola kartasida): Yangi buyurtmalar + Bekor qilinganlar, o'z market id si bilan", async () => {
    renderShell("/new-orders/cancelled/121", "market", undefined, "121");

    const nav = screen.getByRole("navigation", { name: "Qabul va yaratish bo'limlari" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/new-orders/121", "/new-orders/cancelled/121"]);
    expect(within(nav).getByRole("link", { current: "page" })).toHaveTextContent("Bekor qilinganlar");
    await waitFor(() => expect(links[0]).toHaveTextContent("Yangi buyurtmalar 5"));
    await waitFor(() => expect(links[1]).toHaveTextContent("Bekor qilinganlar 6"));
    expect(screen.getByText("Bekor qilingan market")).toBeInTheDocument();
  });
});

describe("Qabul va yaratish — bola sahifa rejimlari", () => {
  beforeEach(() => respond());

  it.each([
    ["/new-orders/create", "admin", "Yaratish sahifasi"],
    ["/new-orders/incoming/121", "admin", "Skaner"],
    ["/new-orders/121", "manager", "Market buyurtmalari"],
    ["/new-orders/121/edit/10257", "market", "Tahrirlash"],
    ["/new-orders/branches/7", "admin", "Filial paketlari ro'yxati"],
    ["/new-orders/branches/7/batches/9", "superadmin", "Paket tafsiloti"],
  ])("%s (%s) — faqat bola sahifa: qobiq sarlavhasi va tablari yo'q", (route, role, child) => {
    renderShell(route, role, role === "manager" ? "HYBRID" : undefined, "121");

    expect(screen.getByText(child)).toBeInTheDocument();
    expect(screen.queryByText("Qabul va yaratish")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Buyurtma yaratish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /Qabul/ })).not.toBeInTheDocument();
  });

  it("xodim bekor qilinganlarni topshirishda — bare: qobiq sarlavhasi yo'q (bola o'z sarlavhasini chizadi)", () => {
    renderShell("/new-orders/cancelled/121", "admin");
    expect(screen.getByText("Bekor qilingan market")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Buyurtma yaratish" })).not.toBeInTheDocument();
  });

  it("market o'z buyurtmalarida — qobiq sarlavhasi bor (tablar bola kartasida)", () => {
    renderShell("/new-orders/121", "market", undefined, "121");
    expect(screen.getByRole("heading", { level: 1, name: "Qabul va yaratish" })).toBeInTheDocument();
    expect(screen.getByText("Market buyurtmalari")).toBeInTheDocument();
  });

  it("manba tanlash — qobiq sarlavhasi bor, tablar bola kartasida (qobiqda yo'q)", () => {
    renderShell("/new-orders/incoming", "admin");
    expect(screen.getByRole("heading", { level: 1, name: "Qabul va yaratish" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Qabul manbalari" })).not.toBeInTheDocument();
  });

  it.each([
    ["/new-orders/branches", "admin", "Filial paketlari sahifasi"],
    ["/new-orders/cancelled", "superadmin", "Bekor qilinganlar sahifasi"],
  ])("%s (%s) — hosted: qobiq sarlavhasi bor, tablar bola kartasida (qobiqda yo'q)", (route, role, child) => {
    renderShell(route, role);
    expect(screen.getByRole("heading", { level: 1, name: "Qabul va yaratish" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Qabul manbalari" })).not.toBeInTheDocument();
    expect(screen.getByText(child)).toBeInTheDocument();
  });

  it("ko'chirilmagan bola (foydalanuvchi tafsiloti) — legacy: sarlavha va tablar sahifada, bola o'zgarmagan", () => {
    renderShell("/new-orders/userDetail/1", "admin");
    expect(screen.getByRole("heading", { level: 1, name: "Qabul va yaratish" })).toBeInTheDocument();
    expect(within(tabsNav()).getByRole("link", { current: "page" })).toHaveTextContent("Marketlar");
    expect(screen.getByText("Foydalanuvchi sahifasi")).toBeInTheDocument();
  });
});

describe("Eski /orders/add havolasi", () => {
  it("/new-orders/create ga o'tadi va tanlangan marketni saqlaydi", () => {
    renderWithProviders(
      <Routes>
        <Route path="/orders/add" element={<LegacyOrderCreateRedirect />} />
        <Route path="/new-orders/create" element={<LocationProbe />} />
      </Routes>,
      {
        route: { pathname: "/orders/add", state: { selectedMarket: { id: "7", name: "TEST Market" } } },
        preloadedState: stateFor("admin"),
      },
    );

    expect(screen.getByTestId("location")).toHaveTextContent("/new-orders/create");
    expect(screen.getByTestId("location")).toHaveAttribute("data-market", "TEST Market");
  });
});
