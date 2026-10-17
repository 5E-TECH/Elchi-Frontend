import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { getTodayRange } from "../../../shared/lib/dateRange";
import BranchDashboardPage from "./BranchDashboardPage";

const getDashboardMock = vi.hoisted(() => vi.fn());

vi.mock("../../../entities/dashboard", () => ({
  useDashboard: () => ({ getDashboard: getDashboardMock }),
}));

const branchDashboard = {
  role: "MANAGER",
  today_orders_count: 0,
  week_orders_count: 0,
  active_batches_count: 2,
  couriers_count: 4,
  cards: {
    orders: { total: 7, new: 1, on_the_road: 2, delivered: 3, returned: 1 },
    markets: [
      { id: "m1", name: "Baraka Shop", orders: 5, amount: 4_800_000 },
      { id: "m2", name: "Nur Elektronika", orders: 2, amount: 6_100_000 },
    ],
    packages: { on_the_way: 3, waiting_for_acceptance: 2 },
    couriers: { total: 8, active: 6 },
  },
};

const topBranches = Array.from({ length: 7 }, (_, index) => ({
  branch_id: index === 6 ? "branch-1" : `b-${index}`,
  branch_name: index === 6 ? "Urgut filiali" : `Filial ${index + 1}`,
  total_orders: 30,
  successful_orders: 25 - index,
  success_rate: ((25 - index) / 30) * 100,
}));

const response = (dashboard: unknown = branchDashboard) => ({
  data: {
    data: {
      orders: { acceptedCount: 99, soldAndPaid: 3, cancelled: 1, profit: 0, totalRevenue: 0 },
      branchDashboard: dashboard,
      topBranches,
    },
  },
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
});

const managerState = (branchType = "HYBRID") =>
  ({
    role: { id: "manager-1", role: "manager", region: null, name: "Manager" },
    user: {
      user: { id: "manager-user-1", branch_id: "branch-1", branch: { name: "Urgut filiali", type: branchType } } as never,
      isAuthenticated: true,
      accessToken: "token",
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;

const section = (title: string) => screen.getByRole("heading", { name: title }).closest("section") as HTMLElement;

describe("BranchDashboardPage (v2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDashboardMock.mockReturnValue(response());
  });

  it("sukut — bugun, `branch_id` bilan; «Barchasi» — aniq sanalar (`all` emas)", async () => {
    const user = userEvent.setup();
    const today = getTodayRange();
    renderWithProviders(<BranchDashboardPage />, { preloadedState: managerState() });

    expect(getDashboardMock).toHaveBeenCalledWith(
      { branch_id: "branch-1", start_day: today.from, end_day: today.to },
      true,
      "manager:manager-user-1",
    );
    expect(screen.getByText("Urgut filiali · tanlangan davr ko'rsatkichlari")).toBeInTheDocument();
    expect(screen.getByText("Jonli ma'lumotlar yuklandi")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Yilni tanlash" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Barchasi" }));
    const lastParams = getDashboardMock.mock.lastCall?.[0];
    expect(getDashboardMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ branch_id: "branch-1", start_day: "1970-01-01", end_day: expect.any(String) }),
      true,
      "manager:manager-user-1",
    );
    expect(lastParams).not.toHaveProperty("all");
  });

  it("kartalar filial panelidan (boshqa doiradagi `orders` emas)", () => {
    renderWithProviders(<BranchDashboardPage />, { preloadedState: managerState() });

    // 3 / 7 = 42,9% — o'rtacha; yaxshi zonaga 2 ta sotuv kerak (ceil(4,9) − 3)
    const success = section("Muvaffaqiyat darajasi");
    expect(success).toHaveTextContent("42,9%");
    expect(success).toHaveTextContent("Yaxshi zonaga (70%) chiqish uchun yana 2 ta sotuv kerak");

    const status = within(section("Buyurtmalar holati")).getByRole("list", { name: "Holatlar bo'yicha taqsimot" });
    expect(status).toHaveTextContent("Yangi1 ta");
    expect(status).toHaveTextContent("Yo'lda2 ta");
    expect(status).toHaveTextContent("Sotilgan3 ta");
    expect(status).toHaveTextContent("Bekor qilingan1 ta");
    expect(screen.queryByText("99")).not.toBeInTheDocument();

    expect(section("Faol paketlar")).toHaveTextContent("5ta faol paket");
    expect(section("Kuryerlar")).toHaveTextContent("6 / 8 ta");
    expect(section("Kuryerlar")).toHaveTextContent("Bugun faol emas2 ta");
    expect(section("Marketlar bo'yicha")).toHaveTextContent("Baraka Shop");
  });

  it("«Paketlar sahifasini ochish» faqat qabul qobiliyati bor filialda (HQ/PICKUP/HYBRID)", () => {
    const { unmount } = renderWithProviders(<BranchDashboardPage />, { preloadedState: managerState("HYBRID") });
    expect(within(section("Faol paketlar")).getByRole("link", { name: /Paketlar sahifasini ochish/ })).toHaveAttribute("href", "/batches");
    unmount();
    renderWithProviders(<BranchDashboardPage />, { preloadedState: managerState("REGIONAL") });
    expect(within(section("Faol paketlar")).queryByRole("link", { name: /Paketlar sahifasini ochish/ })).not.toBeInTheDocument();
  });

  it("«Top filiallar»: top 5 + o'z filiali 6-qator «Sizning filial»", () => {
    renderWithProviders(<BranchDashboardPage />, { preloadedState: managerState() });
    const lists = within(section("Top filiallar")).getAllByRole("list", { name: "Top filiallar" });
    expect(within(lists[0]).getAllByRole("listitem")).toHaveLength(5);
    expect(lists[1]).toHaveTextContent("7UFUrgut filialiSizning filial63,3%19 / 30 ta");
  });

  it("«Marketlar bo'yicha»: «Summa» tanlansa — summa bo'yicha tartib", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BranchDashboardPage />, { preloadedState: managerState() });
    const card = section("Marketlar bo'yicha");
    let rows = within(card).getAllByRole("list", { name: "Marketlar bo'yicha" })[0].querySelectorAll("li");
    expect(rows[0]).toHaveTextContent("Baraka Shop");
    await user.click(within(card).getByRole("radio", { name: "Summa" }));
    rows = within(card).getAllByRole("list", { name: "Marketlar bo'yicha" })[0].querySelectorAll("li");
    expect(rows[0]).toHaveTextContent("Nur Elektronika");
  });

  it("stats_unavailable: nollar o'rniga «Statistika vaqtincha mavjud emas» (fix3 C9)", () => {
    getDashboardMock.mockReturnValue(response({ ...branchDashboard, stats_unavailable: true }));
    renderWithProviders(<BranchDashboardPage />, { preloadedState: managerState() });

    expect(screen.getByRole("alert")).toHaveTextContent("Statistika vaqtincha mavjud emas — sahifani yangilang");
    expect(screen.queryByRole("heading", { name: "Muvaffaqiyat darajasi" })).not.toBeInTheDocument();
    expect(screen.queryByText("42,9%")).not.toBeInTheDocument();
  });

  it("filial paneli kelmasa — `data.orders` (boshqa doira) ga qaytmaydi (fix3 C9)", () => {
    getDashboardMock.mockReturnValue(response(null));
    renderWithProviders(<BranchDashboardPage />, { preloadedState: managerState() });
    expect(screen.getByRole("alert")).toHaveTextContent("Statistika vaqtincha mavjud emas");
    expect(screen.queryByText("99")).not.toBeInTheDocument();
  });

  it("stats_unavailable: false — raqamlar avvalgidek", () => {
    getDashboardMock.mockReturnValue(response({ ...branchDashboard, stats_unavailable: false }));
    renderWithProviders(<BranchDashboardPage />, { preloadedState: managerState() });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(section("Muvaffaqiyat darajasi")).toHaveTextContent("42,9%");
  });

  it("so'rov xatosi — «Filial ko'rsatkichlarini yuklab bo'lmadi» + qayta urinish", async () => {
    const refetch = vi.fn();
    getDashboardMock.mockReturnValue({ isError: true, isLoading: false, refetch });
    renderWithProviders(<BranchDashboardPage />, { preloadedState: managerState() });
    expect(screen.getByText("Filial ko'rsatkichlarini yuklab bo'lmadi.")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(refetch).toHaveBeenCalled();
  });
});
