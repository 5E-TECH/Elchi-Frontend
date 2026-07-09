import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { getTodayRange } from "../../../shared/lib/dateRange";
import BranchDashboardPage from "./BranchDashboardPage";

const getDashboardMock = vi.hoisted(() => vi.fn());
const useGetOrdersMock = vi.hoisted(() => vi.fn());
const useGetCouriersMock = vi.hoisted(() => vi.fn());
const useQueriesMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();

  return {
    ...actual,
    useQueries: useQueriesMock,
  };
});

vi.mock("../../../entities/dashboard", () => ({
  useDashboard: () => ({
    getDashboard: getDashboardMock,
  }),
}));

vi.mock("../../../entities/order/api/orderApi", () => ({
  useOrders: () => ({
    useGetOrders: useGetOrdersMock,
  }),
}));

vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetCouriers: useGetCouriersMock,
  }),
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
                total: 0,
                new: 0,
                on_the_road: 0,
                delivered: 0,
                returned: 0,
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
        },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useGetOrdersMock.mockImplementation((params: { status?: string[] } | undefined) => {
      const status = params?.status ?? [];
      const total = status.includes("sold")
        ? 3
        : status.includes("cancelled")
          ? 1
          : 7;

      return {
        data: {
          data: [],
          total,
          page: 1,
          limit: 10,
        },
      };
    });
    useGetCouriersMock.mockReturnValue({
      data: [
        {
          id: "courier-user-1",
          name: "Courier",
        },
      ],
    });
    useQueriesMock.mockImplementation(({ queries }: { queries: unknown[] }) =>
      queries.map((_, index) => ({
        data: {
          data: [],
          total: index % 3 === 0 ? 2 : index % 3 === 1 ? 1 : 0,
          page: 1,
          limit: 10,
        },
      })),
    );
  });

  it("sends date filters and aggregates all branch orders", async () => {
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
    expect(useGetOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({ branch_id: "branch-1", limit: 10 }),
      true,
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
    expect(screen.getAllByText("9").length).toBeGreaterThan(0);
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
  });
});
