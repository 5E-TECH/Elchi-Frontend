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

vi.mock("../../entities/dashboard", () => ({
  useDashboard: () => ({ getDashboard: getDashboardMock, getKpi: getKpiMock }),
}));

vi.mock("../../entities/orders", () => ({
  useOrders: () => ({
    useExtraCostApprovals: () => approvalsState,
    approveExtraCostApproval: approveState,
    rejectExtraCostApproval: rejectState,
  }),
}));

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
    const first = within(card).getByRole("article", { name: "Sotishdagi qo'shimcha xarajat, buyurtma №251165" });
    expect(first).toHaveTextContent("25 000 so'm");
    expect(first).toHaveTextContent("So'rovchiKuryer");
    expect(first).toHaveTextContent("Isbotlar2 ta");
    expect(within(first).getByRole("button", { name: "Tasdiqlanmoqda" })).toBeDisabled();
    expect(within(first).getByRole("button", { name: "Rad etish" })).toBeDisabled();
    const second = within(card).getByRole("article", { name: "Bekor qilishdagi qo'shimcha xarajat, buyurtma №251166" });
    expect(second).toHaveTextContent("IsbotlarYo'q");
    expect(within(second).getByRole("button", { name: "Tasdiqlash" })).toBeEnabled();
  });

  it("qo'shimcha xarajat so'rovi xato yoki bo'sh bo'lsa — panel ko'rinmaydi", () => {
    approvalsState.isError = true;
    renderWithProviders(<MarketDashboardPage />, { preloadedState: marketState() });
    expect(screen.queryByText("Qo'shimcha xarajat tasdiqlari")).not.toBeInTheDocument();
  });

  it("dashboard xatosi — «Qayta urinish»", async () => {
    const refetch = vi.fn();
    getDashboardMock.mockReturnValue({ isError: true, isLoading: false, refetch });
    renderWithProviders(<MarketDashboardPage />, { preloadedState: marketState() });
    expect(screen.getByText("Dashboard ma'lumotlarini yuklab bo'lmadi.")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(refetch).toHaveBeenCalled();
  });
});
