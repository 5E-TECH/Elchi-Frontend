import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { getTodayRange } from "../../../shared/lib/dateRange";
import BranchDashboardPage from "./BranchDashboardPage";

const getDashboardMock = vi.hoisted(() => vi.fn());

vi.mock("../../../entities/dashboard", () => ({
  useDashboard: () => ({
    getDashboard: getDashboardMock,
  }),
}));

vi.mock("../../../widgets/dashboard-top-performers/ui/TopPerformers", () => ({
  default: ({ branches }: { branches?: unknown[] }) => (
    <div data-testid="top-branches">branches:{branches?.length ?? 0}</div>
  ),
}));

describe("BranchDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDashboardMock.mockReturnValue({
      data: {
        data: {
          orders: {
            acceptedCount: 7,
            soldAndPaid: 3,
            cancelled: 1,
            profit: 0,
            totalRevenue: 0,
          },
          branchDashboard: {
            role: "MANAGER",
            today_orders_count: 0,
            week_orders_count: 0,
            active_batches_count: 2,
            couriers_count: 4,
            cards: {
              orders: {
                total: 7,
                new: 0,
                on_the_road: 3,
                delivered: 3,
                returned: 1,
              },
              markets: [],
              packages: {
                on_the_way: 1,
                waiting_for_acceptance: 1,
              },
              couriers: {
                total: 4,
                active: 2,
              },
            },
          },
          topBranches: [
            {
              branch_id: "branch-1",
              branch_name: "Qashqadaryo",
              total_orders: 9,
              successful_orders: 4,
              success_rate: 44.4,
            },
          ],
        },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it("sends date filters and renders backend dashboard summary", async () => {
    const user = userEvent.setup();
    const todayRange = getTodayRange();
    renderWithProviders(<BranchDashboardPage />, {
      preloadedState: {
        role: { id: "manager-1", role: "manager", region: null, name: "Manager" },
        user: {
          user: {
            id: "manager-user-1",
            branch_id: "branch-1",
          } as any,
          isAuthenticated: true,
          accessToken: "token",
          loading: false,
          isAppInitializing: false,
          error: null,
        },
      },
    });

    expect(getDashboardMock).toHaveBeenCalledWith(
      { branch_id: "branch-1", start_day: todayRange.from, end_day: todayRange.to },
      true,
      "manager:manager-user-1",
    );

    await user.click(screen.getByRole("button", { name: "Barchasi" }));

    const lastParams = getDashboardMock.mock.lastCall?.[0];

    expect(getDashboardMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        branch_id: "branch-1",
        start_day: "1970-01-01",
        end_day: expect.any(String),
      }),
      true,
      "manager:manager-user-1",
    );
    expect(lastParams).not.toHaveProperty("all");
    expect(screen.getAllByText("7").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getByTestId("top-branches")).toHaveTextContent("branches:1");
  });

  const managerState = {
    role: { id: "manager-1", role: "manager", region: null, name: "Manager" },
    user: {
      user: { id: "manager-user-1", branch_id: "branch-1" } as never,
      isAuthenticated: true,
      accessToken: "token",
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  } as const;

  const withBranchDashboard = (branchDashboard: unknown) => {
    const base = getDashboardMock();
    getDashboardMock.mockReturnValue({
      ...base,
      data: { data: { ...base.data.data, branchDashboard } },
    });
  };

  it("stats_unavailable: nollar o'rniga 'Statistika vaqtincha mavjud emas' ko'rinadi (fix3 C9)", () => {
    const base = getDashboardMock();
    withBranchDashboard({ ...base.data.data.branchDashboard, stats_unavailable: true });
    renderWithProviders(<BranchDashboardPage />, { preloadedState: managerState as never });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Statistika vaqtincha mavjud emas — sahifani yangilang",
    );
    expect(screen.queryByText("Jami buyurtmalar")).not.toBeInTheDocument();
    expect(screen.queryByText("7")).not.toBeInTheDocument();
  });

  it("filial paneli kelmasa — data.orders (boshqa doira) ga qaytmaydi (fix3 C9)", () => {
    withBranchDashboard(null);
    renderWithProviders(<BranchDashboardPage />, { preloadedState: managerState as never });

    expect(screen.getByRole("alert")).toHaveTextContent("Statistika vaqtincha mavjud emas");
    // data.orders.acceptedCount = 7 — endi ko'rsatilmaydi.
    expect(screen.queryByText("7")).not.toBeInTheDocument();
  });

  it("stats_unavailable: false — raqamlar avvalgidek", () => {
    const base = getDashboardMock();
    withBranchDashboard({ ...base.data.data.branchDashboard, stats_unavailable: false });
    renderWithProviders(<BranchDashboardPage />, { preloadedState: managerState as never });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getAllByText("7").length).toBeGreaterThan(0);
  });
});
