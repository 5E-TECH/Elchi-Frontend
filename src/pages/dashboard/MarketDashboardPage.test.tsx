import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import { getPreviousPeriodRange, getTodayRange } from "../../shared/lib/dateRange";
import MarketDashboardPage from "./MarketDashboardPage";

const getDashboardMock = vi.fn();
const getKpiMock = vi.fn();
const approvalsState: { data: unknown; isLoading: boolean; isError: boolean } = { data: undefined, isLoading: false, isError: false };
const approveState = { mutate: vi.fn(), isPending: false, variables: undefined as { id: string } | undefined };
const rejectState = { mutate: vi.fn(), isPending: false, variables: undefined as { id: string } | undefined };
// Hook chaqiruvlari kuzatiladi: operator rejimida xarajat tasdiqlari so'rovi umuman yuborilmasligi kerak (backend 403).
const extraCostHook = vi.fn(() => approvalsState);
const autoApprovedHook = vi.fn(() => ({ data: undefined }));

vi.mock("../../entities/dashboard", () => ({
  useDashboard: () => ({ getDashboard: getDashboardMock, getKpi: getKpiMock }),
}));

vi.mock("../../entities/orders", () => ({
  useOrders: () => ({
    useAutoApprovedExtraCostApprovals: () => autoApprovedHook(),
    useExtraCostApprovals: () => extraCostHook(),
    approveExtraCostApproval: approveState,
    rejectExtraCostApproval: rejectState,
  }),
}));

// «Qayta tekshirish» (biriktirilmagan operator) — profil qayta o'qiladi; tarmoqqa chiqmaydi.
const fetchMyProfileMock = vi.fn(() => Promise.resolve({}));
vi.mock("../../auth/authService", () => ({ fetchMyProfile: () => fetchMyProfileMock() }));

const settingsState: { data: unknown } = { data: undefined };
vi.mock("../../entities/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../entities/settings")>()),
  useSettings: () => settingsState,
}));

const yesterday = getPreviousPeriodRange(getTodayRange())!;

// Har test o'z nusxasini oladi (o'zgartirilsa boshqalariga ta'sir qilmasin).
const buildDashboardResponse = () => ({
  data: {
    data: {
      orders: { acceptedCount: 4, soldAndPaid: 1, cancelled: 1, inProgress: 1, profit: 120000 },
      myStat: { totalOrders: 38, soldOrders: 7, canceledOrders: 2, profit: 19060000, successRate: 18.42, inProgress: 12 },
      topMarkets: [
        { market_id: "market-1", market_name: "Market", total_orders: 4, successful_orders: 1, success_rate: 25 },
        { market_id: "market-2", market_name: "Nur Elektronika", total_orders: 38, successful_orders: 31, success_rate: 81.6 },
      ] as Array<Record<string, unknown>>,
      topOperators: [
        { operator_id: "operator-1", operator_name: "Operator Ali", total_orders: 20, successful_orders: 16, success_rate: 80 },
      ] as Array<Record<string, unknown>>,
    } as Record<string, unknown>,
  },
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
});

const marketState = (id = "market-1") =>
  ({
    role: { id, role: "market", region: null, name: "Market" },
    user: {
      user: { id, name: "Baraka Shop", add_order: true } as never,
      isAuthenticated: true,
      accessToken: "token",
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;

const section = (title: string) => screen.getByRole("heading", { name: title }).closest("section") as HTMLElement;

describe("MarketDashboardPage (v2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDashboardMock.mockImplementation(() => buildDashboardResponse());
    settingsState.data = undefined;
    approvalsState.data = undefined;
    approvalsState.isLoading = false;
    approvalsState.isError = false;
    approveState.isPending = false;
    approveState.variables = undefined;
    rejectState.isPending = false;
    rejectState.variables = undefined;
  });

  it("faqat marketga ruxsat etilgan dashboard so'rovi; KPI `myStat` dan; kpi so'ralmaydi", () => {
    renderWithProviders(<MarketDashboardPage />, { preloadedState: marketState() });

    expect(getDashboardMock).toHaveBeenCalledWith({ start_day: "", end_day: "" }, true, "market:market-1");
    expect(getKpiMock).not.toHaveBeenCalled();
    expect(screen.getByText("Buyurtmalar va ko'rsatkichlar · Baraka Shop")).toBeInTheDocument();
    const grid = screen.getByTestId("market-stats-grid");
    expect(grid.children).toHaveLength(4);
    expect(grid).toHaveTextContent("38");
    expect(grid).toHaveTextContent("7");
    expect(grid).toHaveTextContent("19 060 000");
    expect(section("Muvaffaqiyat darajasi")).toHaveTextContent("18,4%");
    // «Jarayonda» — market `myStat.inProgress` dan
    expect(within(section("Buyurtmalar holati")).getByRole("list", { name: "Holatlar bo'yicha taqsimot" })).toHaveTextContent("Jarayonda12 ta");
    // «Taklif» bloklar chizilmaydi
    expect(screen.queryByText("Reytingdagi o'rningiz")).not.toBeInTheDocument();
    expect(screen.queryByText("Buyurtmalar dinamikasi")).not.toBeInTheDocument();
  });

  it("oldingi davr (kecha) bilan solishtirish — delta «kechaga nisbatan»", () => {
    getDashboardMock.mockImplementation((params: { start_day?: string }) => {
      const response = buildDashboardResponse();
      if (params.start_day === yesterday.from) {
        response.data.data.myStat = { totalOrders: 19, soldOrders: 7, canceledOrders: 2, profit: 19060000, successRate: 36.8 };
      }
      return response;
    });
    renderWithProviders(<MarketDashboardPage />, { preloadedState: marketState() });
    expect(getDashboardMock).toHaveBeenCalledWith({ start_day: yesterday.from, end_day: yesterday.to }, true, "market:market-1");
    // 38 / 19 → +100%
    expect(within(screen.getByTestId("market-stats-grid")).getByText("+100%")).toBeInTheDocument();
    expect(section("Muvaffaqiyat darajasi")).toHaveTextContent("Kecha · 36,8%");
  });

  it("«Barchasi» — market uchun aniq sanalar (`all` emas), kpi yo'q", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MarketDashboardPage />, { preloadedState: marketState() });
    await user.click(screen.getByRole("radio", { name: "Barchasi" }));

    const calls = getDashboardMock.mock.calls.filter(([, enabled]) => enabled === true);
    const lastParams = calls[calls.length - 1][0];
    expect(lastParams).toEqual(expect.objectContaining({ start_day: "1970-01-01", end_day: expect.any(String) }));
    expect(lastParams).not.toHaveProperty("all");
    expect(getKpiMock).not.toHaveBeenCalled();
  });

  it("sozlamada o'chirilgan bloklar (reyting, sotuv foizi) chizilmaydi", async () => {
    const { DEFAULT_SETTINGS } = await import("../../entities/settings");
    settingsState.data = {
      ...DEFAULT_SETTINGS,
      dashboard: { widgets: { ...DEFAULT_SETTINGS.dashboard.widgets, performanceChart: false, topPerformers: false } },
    };
    renderWithProviders(<MarketDashboardPage />, { preloadedState: marketState() });

    expect(screen.getByTestId("market-stats-grid")).toBeInTheDocument();
    expect(screen.queryByText("Marketlar bo'yicha sotuv foizi")).not.toBeInTheDocument();
    expect(screen.queryByText("Top operatorlar")).not.toBeInTheDocument();
  });

  it("«Top operatorlar» — market o'rtachasi chizig'i; bo'sh bo'lsa karta yo'q", () => {
    const { unmount } = renderWithProviders(<MarketDashboardPage />, { preloadedState: marketState() });
    const ops = section("Top operatorlar");
    expect(within(ops).getByText("Operator Ali")).toBeInTheDocument();
    expect(ops).toHaveTextContent("Baraka Shop o'rtachasi · 18,4%");
    unmount();

    getDashboardMock.mockImplementation(() => {
      const response = buildDashboardResponse();
      response.data.data.topOperators = [];
      return response;
    });
    renderWithProviders(<MarketDashboardPage />, { preloadedState: marketState() });
    expect(screen.queryByText("Top operatorlar")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Buyurtmalar holati" })).toBeInTheDocument();
  });

  it("sotuv foizi: reyting + o'z qatori «Siz», kuryerlar bo'limi yo'q, foiz zonasi rangi", () => {
    renderWithProviders(<MarketDashboardPage />, { preloadedState: marketState() });
    const card = section("Marketlar bo'yicha sotuv foizi");
    const rows = within(within(card).getByRole("list", { name: "Marketlar bo'yicha sotuv foizi" })).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Nur Elektronika");
    expect(rows[1]).toHaveTextContent("MarketSiz");
    expect(rows[1].querySelector(".bg-danger")).not.toBeNull();
    expect(rows[0].querySelector(".bg-success")).not.toBeNull();
    expect(screen.queryByText(/Kuryerlar bo'yicha/)).not.toBeInTheDocument();
  });

  it("o'z qatori `markets` dan (reytingga kirmagan bo'lsa ham) ko'rinadi (PMa5dgYQ)", () => {
    // `markets` — normalizatsiyadan keyingi shakl (`useDashboard` mock — normalizator hook ichida).
    getDashboardMock.mockImplementation(() => {
      const response = buildDashboardResponse();
      response.data.data.topMarkets = [];
      response.data.data.markets = [{ market_id: "37", market_name: "TEST Claude Market", total_orders: 11, successful_orders: 4, success_rate: 36.36 }];
      return response;
    });
    renderWithProviders(<MarketDashboardPage />, { preloadedState: marketState("37") });
    const card = section("Marketlar bo'yicha sotuv foizi");
    expect(within(within(card).getByRole("list", { name: "Marketlar bo'yicha sotuv foizi" })).getAllByRole("listitem")).toHaveLength(1);
    expect(card).toHaveTextContent("TEST Claude MarketSiz36,4% · 4 / 11 ta");
  });

  it("«Buyurtma yaratish» faqat `add_order` ruxsati bilan (sarlavha va tezkor harakatlarda)", () => {
    const { unmount } = renderWithProviders(<MarketDashboardPage />, { preloadedState: marketState() });
    expect(screen.getByRole("button", { name: "Buyurtma yaratish" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Buyurtma yaratish/ })).toHaveAttribute("href", "/new-orders/create");
    expect(screen.getByRole("link", { name: /Buyurtmalarni ko'rish/ })).toHaveAttribute("href", "/new-orders");
    unmount();

    renderWithProviders(<MarketDashboardPage />, {
      preloadedState: { role: { id: "market-1", role: "market", region: null, name: "Market" } } as never,
    });
    expect(screen.queryByRole("button", { name: "Buyurtma yaratish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Buyurtma yaratish/ })).not.toBeInTheDocument();
  });

  it("qo'shimcha xarajat: kutilayotganlar karta, yuborilayotganida «Tasdiqlanmoqda» va tugmalar o'chiq", () => {
    // Blok — `ExtraCostApprovals` (DuST9k8j): №, summa, so'rovchi (#id · rol), isbotlar, tasdiq oqibati.
    approvalsState.data = {
      data: [
        { id: "ap-1", order_id: "1251165", market_id: "market-1", requested_by_user_id: "56", requested_by_role: "courier", action: "sell", amount: 25000, status: "pending", proof_file_keys: ["a", "b"] },
        { id: "ap-2", order_id: "1251166", market_id: "market-1", requested_by_user_id: "57", action: "cancel", amount: 15000, status: "pending" },
      ],
    };
    approveState.isPending = true;
    approveState.variables = { id: "ap-1" };
    renderWithProviders(<MarketDashboardPage />, { preloadedState: marketState() });

    const card = screen.getByRole("heading", { name: "Qo'shimcha xarajat tasdiqlari" }).closest("section") as HTMLElement;
    expect(card).toHaveTextContent("2 ta so'rov kutilmoqda");
    const first = within(card).getByRole("listitem", { name: "Sotishdagi qo'shimcha xarajat, buyurtma №1251165" });
    expect(within(first).getByRole("link", { name: "№1251165" })).toHaveAttribute("href", "/orders/edit/1251165");
    expect(first).toHaveTextContent("25 000 so'm");
    expect(first).toHaveTextContent("So'rovchi#56 · Kuryer");
    expect(first).toHaveTextContent("Isbotlar2 ta");
    // Yuborilayotgan tugma — `loading` (aria-busy + aria-disabled, takror bosilmaydi), qo'shnisi o'chiq.
    const approving = within(first).getByRole("button", { name: /Tasdiqlanmoqda/ });
    expect(approving).toHaveAttribute("aria-busy", "true");
    expect(approving).toHaveAttribute("aria-disabled", "true");
    expect(within(first).getByRole("button", { name: "Rad etish" })).toBeDisabled();
    const second = within(card).getByRole("listitem", { name: "Bekor qilishdagi qo'shimcha xarajat, buyurtma №1251166" });
    expect(second).toHaveTextContent("IsbotlarYo'q");
    expect(within(second).getByRole("button", { name: "Tasdiqlash" })).toBeEnabled();
  });

  it("qo'shimcha xarajat: bo'sh — panel ko'rinmaydi; so'rov xatosi — karta ichida xato (2f7cca6, QueryBoundary)", () => {
    approvalsState.data = { data: [] };
    const { unmount } = renderWithProviders(<MarketDashboardPage />, { preloadedState: marketState() });
    expect(screen.queryByText("Qo'shimcha xarajat tasdiqlari")).not.toBeInTheDocument();
    unmount();

    approvalsState.data = undefined;
    approvalsState.isError = true;
    renderWithProviders(<MarketDashboardPage />, { preloadedState: marketState() });
    const card = screen.getByRole("heading", { name: "Qo'shimcha xarajat tasdiqlari" }).closest("section") as HTMLElement;
    expect(within(card).getByRole("alert")).toHaveTextContent("Ma'lumotni yuklab bo'lmadi");
  });

  it("dashboard xatosi — «Qayta urinish»", async () => {
    const refetch = vi.fn();
    getDashboardMock.mockReturnValue({ isError: true, isLoading: false, refetch });
    renderWithProviders(<MarketDashboardPage />, { preloadedState: marketState() });
    expect(screen.getByText("Bosh sahifa ma'lumotlarini yuklab bo'lmadi.")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(refetch).toHaveBeenCalled();
  });

  describe("qisman nosozlik (VkwhHqvW)", () => {
    const marketState = { role: { id: "market-1", role: "market", region: null, name: "Market" } };
    const withFailed = (failedParts: string[]) => {
      const base = buildDashboardResponse();
      getDashboardMock.mockReturnValue({ ...base, data: { data: { ...base.data.data, degraded: true, failedParts } } });
    };

    it("`topMarkets` olinmasa — reyting joyida «Ma'lumotni yuklab bo'lmadi» + «Qayta urinish» (0 emas)", () => {
      withFailed(["topMarkets"]);
      renderWithProviders(<MarketDashboardPage />, { preloadedState: marketState });

      // v2: marketlar reytingi — «Marketlar bo'yicha sotuv foizi» kartasi (reyting + o'z qatori).
      const failed = screen.getByTestId("market-ranking-failed");
      expect(failed).toHaveAttribute("data-part-failed");
      expect(failed).toHaveTextContent("Marketlar bo'yicha sotuv foizi");
      expect(failed).toHaveTextContent("Ma'lumotni yuklab bo'lmadi");
      expect(screen.getByTestId("market-stats-grid")).toBeInTheDocument();
      // Sog' bo'lak — operatorlar reytingi — yo'qolmaydi.
      expect(screen.getByText("Operator Ali")).toBeInTheDocument();
    });

    it("`topOperators` olinmasa — operatorlar reytingi alohida xato kartasi, marketlar reytingi joyida", () => {
      withFailed(["topOperators"]);
      renderWithProviders(<MarketDashboardPage />, { preloadedState: marketState });

      expect(screen.getByTestId("operators-ranking-failed")).toHaveTextContent("Top operatorlar");
      expect(screen.queryByTestId("market-ranking-failed")).not.toBeInTheDocument();
      expect(screen.queryByText("Operator Ali")).not.toBeInTheDocument();
    });

    it("`markets` olinmasa — solishtiruv grafigi o'rnida xato; `myStat` olinmasa — statistika 0 emas, xato", async () => {
      const refetch = vi.fn();
      const base = buildDashboardResponse();
      getDashboardMock.mockReturnValue({
        ...base,
        refetch,
        data: { data: { ...base.data.data, degraded: true, failedParts: ["markets", "myStat"] } },
      });
      renderWithProviders(<MarketDashboardPage />, { preloadedState: marketState });

      expect(screen.getByTestId("performance-markets-failed")).toHaveTextContent("Marketlar bo'yicha sotuv foizi");
      expect(screen.queryByRole("list", { name: "Marketlar bo'yicha sotuv foizi" })).not.toBeInTheDocument();
      expect(screen.queryByTestId("market-stats-grid")).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Muvaffaqiyat darajasi" })).not.toBeInTheDocument();
      await userEvent.setup().click(screen.getAllByRole("button", { name: "Qayta urinish" })[0]);
      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("market operatori rejimi (MO-2, `variant=\"operator\"`)", () => {
    const operatorState = {
      role: { id: "op-9", role: "market_operator", region: null, name: "Dilnoza Karimova" },
      user: {
        user: { id: "op-9", name: "Dilnoza Karimova", role: "market_operator", market_id: 1, add_order: true } as never,
        isAuthenticated: true,
        accessToken: "token",
        loading: false,
        isAppInitializing: false,
        error: null,
      },
    } as never;

    it("KPI va grafiklar o'z marketi bo'yicha; xarajat tasdiqlari so'ralmaydi va chizilmaydi (backend 403)", () => {
      approvalsState.data = {
        data: [{ id: "ap-1", order_id: "1251165", market_id: "1", requested_by_user_id: "56", action: "sell", amount: 25000, status: "pending" }],
      };
      renderWithProviders(<MarketDashboardPage variant="operator" />, { preloadedState: operatorState });

      expect(getDashboardMock).toHaveBeenCalledWith({ start_day: "", end_day: "" }, true, "market_operator:op-9");
      expect(screen.getByTestId("market-stats-grid")).toHaveTextContent("38");
      expect(extraCostHook).not.toHaveBeenCalled();
      expect(autoApprovedHook).not.toHaveBeenCalled();
      expect(screen.queryByText("Qo'shimcha xarajat tasdiqlari")).not.toBeInTheDocument();
      // Profildagi `name` — operatorning o'z ismi, market nomi emas: sarlavha izohida yo'q.
      expect(screen.queryByText(/Dilnoza Karimova/)).not.toBeInTheDocument();
    });

    it("sotuv foizida o'z qatori «Siz» — profildagi `market_id` (operatorning o'z id'si emas)", () => {
      getDashboardMock.mockImplementation(() => {
        const response = buildDashboardResponse();
        response.data.data.topMarkets = [
          { market_id: "1", market_name: "Baraka Shop", total_orders: 10, successful_orders: 4, success_rate: 40 },
          { market_id: "op-9", market_name: "Boshqa market", total_orders: 10, successful_orders: 9, success_rate: 90 },
        ];
        return response;
      });
      renderWithProviders(<MarketDashboardPage variant="operator" />, { preloadedState: operatorState });
      const rows = within(screen.getByRole("list", { name: "Marketlar bo'yicha sotuv foizi" })).getAllByRole("listitem");
      expect(rows[0]).toHaveTextContent("Boshqa market");
      expect(rows[0]).not.toHaveTextContent("Siz");
      expect(rows[1]).toHaveTextContent("Baraka ShopSiz");
    });

    it("marketga biriktirilmagan (profilda `market_id` yo'q) — nol KPI emas, «Siz hali marketga biriktirilmagansiz» + «Qayta tekshirish»; analitika so'ralmaydi", async () => {
      const user = userEvent.setup();
      const unassignedState = {
        role: { id: "op-9", role: "market_operator", region: null, name: "Dilnoza Karimova" },
        user: {
          user: { id: "op-9", name: "Dilnoza Karimova", role: "market_operator", market_id: null } as never,
          isAuthenticated: true,
          accessToken: "token",
          loading: false,
          isAppInitializing: false,
          error: null,
        },
      } as never;
      renderWithProviders(<MarketDashboardPage variant="operator" />, { preloadedState: unassignedState });

      expect(screen.getByRole("heading", { level: 1, name: "Bosh sahifa" })).toBeInTheDocument();
      expect(screen.getByText("Market biriktirilmagan")).toBeInTheDocument();
      expect(within(screen.getByTestId("operator-unassigned")).getByText("Siz hali marketga biriktirilmagansiz")).toBeInTheDocument();
      expect(screen.queryByTestId("market-stats-grid")).not.toBeInTheDocument();
      expect(screen.queryByRole("list", { name: "Marketlar bo'yicha sotuv foizi" })).not.toBeInTheDocument();
      // `analytics/dashboard` yoqilmagan (enabled = false) — operatorning o'z id'si bo'yicha bo'sh statistika so'ralmaydi.
      expect(getDashboardMock).toHaveBeenCalledWith({ start_day: "", end_day: "" }, false, "market_operator:op-9");
      expect(getDashboardMock.mock.calls.every(([, enabled]) => enabled === false)).toBe(true);

      await user.click(screen.getByRole("button", { name: "Qayta tekshirish" }));
      expect(fetchMyProfileMock).toHaveBeenCalledTimes(1);
    });

    it("market egasi rejimi `market_id` siz ham odatdagidek (holat faqat operatorda)", () => {
      renderWithProviders(<MarketDashboardPage />, { preloadedState: marketState() });
      expect(screen.queryByTestId("operator-unassigned")).not.toBeInTheDocument();
      expect(screen.getByTestId("market-stats-grid")).toBeInTheDocument();
    });

    it("MO-3: buyurtmalar ochilgach — «Buyurtma yaratish», «Tezkor harakatlar» (ro'yxat va yaratish) va ro'yxat havolasi bor", () => {
      renderWithProviders(<MarketDashboardPage variant="operator" />, { preloadedState: operatorState });

      expect(screen.getByRole("button", { name: "Buyurtma yaratish" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Tezkor harakatlar" })).toBeInTheDocument();
      expect(within(section("Buyurtmalar holati")).getByRole("link", { name: /Ro'yxat/ })).toHaveAttribute(
        "href",
        expect.stringMatching(/^\/orders/),
      );
      const hrefs = screen.queryAllByRole("link").map((link) => link.getAttribute("href") ?? "");
      // Operatorda «Qabul va yaratish» (`/new-orders`) yo'q — faqat ro'yxat va yaratish.
      expect(hrefs).toEqual(expect.arrayContaining(["/orders", "/new-orders/create"]));
      expect(hrefs).not.toContain("/new-orders");
      // Operatorda qo'lda yaratish yo'q (MO-7 gacha) — izoh «Qo'lda yoki AI» ni va'da qilmaydi.
      const create = screen.getAllByRole("link").find((link) => link.getAttribute("href") === "/new-orders/create");
      expect(create).toHaveTextContent("AI yordamida yaratish");
      expect(create).not.toHaveTextContent(/Qo'lda/);
    });
  });
});
