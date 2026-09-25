import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import DashboardPage from "./DashboardPage";
import { renderWithProviders } from "../../test/test-utils";

const getDashboardMock = vi.fn();
const getKpiMock = vi.fn();

vi.mock("../../entities/dashboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../entities/dashboard")>()),
  useDashboard: () => ({
    getDashboard: getDashboardMock,
    getKpi: getKpiMock,
  }),
}));

vi.mock("../../widgets/dashboard-statistics/ui/DashboardStatistics", () => ({
  default: (props: Record<string, number | boolean>) => (
    <div
      data-testid="dashboard-statistics"
      data-financial={String(props.showFinancialMetrics)}
    >
      {props.accepted}-{props.sold}-{props.cancelled}-{props.profit}-
      {props.avgOrderValue}-{props.avgFulfillmentHours}
    </div>
  ),
}));

vi.mock("../../widgets/financial-analysis/ui/FinancialAnalysis", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="financial-analysis">{JSON.stringify(props)}</div>
  ),
}));

vi.mock("../../widgets/dashboard-top-performers/ui/TopPerformers", () => ({
  // Renders the wired-in market/branch names (instead of swallowing props) so a
  // regression test can confirm the admin dashboard actually passes real ranking
  // data through, not just that a wrapper div mounts.
  default: (props: {
    markets?: Array<{ market_name: string | null }>;
    branches?: Array<{ branch_name: string | null }>;
  }) => (
    <div data-testid="top-performers">
      {(props.markets ?? []).map((m, i) => (
        <span key={`market-${i}`} data-testid="top-market-name">{m.market_name}</span>
      ))}
      {(props.branches ?? []).map((b, i) => (
        <span key={`branch-${i}`} data-testid="top-branch-name">{b.branch_name}</span>
      ))}
    </div>
  ),
}));

vi.mock("../../widgets/dashboard-region/ui/RegionStatsCard", () => ({
  default: () => <div data-testid="region-stats" />,
}));

vi.mock("../../widgets/dashboard-performance-chart/ui/PerformanceChart", () => ({
  // `couriers === undefined` (as opposed to `[]`) is the signal the market
  // role uses to hide the couriers section entirely — surface that distinction.
  default: (props: { markets?: unknown[]; couriers?: unknown[] }) => (
    <div
      data-testid="performance-chart"
      data-markets-count={props.markets?.length ?? -1}
      data-couriers-count={props.couriers === undefined ? "undefined" : props.couriers.length}
    />
  ),
}));

vi.mock("../../shared/ui/DateRangePicker", () => ({
  default: ({
    value,
    onChange,
    placeholder,
  }: {
    value: { startDate: Date | null; endDate: Date | null };
    onChange: (value: { startDate: Date | null; endDate: Date | null }) => void;
    placeholder: string;
  }) => (
    <button
      aria-label={placeholder}
      onClick={() =>
        onChange({
          startDate: new Date("2026-04-01"),
          endDate: new Date("2026-04-14"),
        })
      }
    >
      {value.startDate?.toISOString() ?? "empty"}
    </button>
  ),
}));

// KPI + financial analysis are gated to SUPERADMIN/ADMIN (Audit P1-2), so the
// happy-path dashboard test renders as an admin.
const adminState = {
  role: { id: "admin-1", role: "admin", region: null, name: "Admin" },
} as never;

const registratorState = {
  role: {
    id: "registrator-1",
    role: "registrator",
    region: null,
    name: "Registrator",
  },
} as never;

const courierState = {
  role: {
    id: "courier-1",
    role: "courier",
    region: null,
    name: "Courier",
  },
} as never;

const operatorState = {
  role: {
    id: "operator-1",
    role: "operator",
    region: null,
    name: "Operator",
  },
} as never;

describe("DashboardPage", () => {
  beforeEach(() => {
    getDashboardMock.mockReturnValue({
      data: {
        data: {
          orders: {
            acceptedCount: 12,
            soldAndPaid: 5,
            cancelled: 2,
            profit: 480000,
            totalRevenue: 960000,
          },
        },
      },
    });
    getKpiMock.mockReturnValue({
      data: {
        data: {
          averageOrderValue: 96000,
          averageFulfillmentHours: 24,
          onTimeRate: 80,
          cancellationRate: 16.67,
          courierEfficiency: 0,
          marketRating: [],
        },
      },
    });
  });

  it("renders dashboard header and date filters", () => {
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });

    expect(getDashboardMock).toHaveBeenCalledWith(
      { start_day: "", end_day: "" },
      true,
      "admin:unknown",
    );
    expect(getKpiMock).toHaveBeenCalledWith(
      { start_day: "", end_day: "" },
      true,
      "admin:unknown",
    );
    expect(screen.getByText("Bugungi statistika")).toBeInTheDocument();
    expect(screen.getByLabelText("Boshlanish → Tugash")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bugun" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bu hafta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bu oy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Barchasi" })).toBeInTheDocument();
  });

  it("loads all-time totals when All is selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });

    await user.click(screen.getByRole("button", { name: "Barchasi" }));

    expect(screen.getByText("Umumiy statistika")).toBeInTheDocument();
    expect(getDashboardMock).toHaveBeenLastCalledWith(
      { all: true },
      true,
      "admin:unknown",
    );
    expect(screen.getByTestId("top-performers")).toBeInTheDocument();
  });

  it("passes dashboard metrics into child widgets", () => {
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });

    expect(screen.getByTestId("dashboard-statistics")).toHaveTextContent(
      "12-5-2-480000-96000-24",
    );
    expect(screen.getByTestId("financial-analysis")).toHaveTextContent('"startDate"');
  });

  it("wires real top market and branch rankings into the Top performers block for admins", () => {
    getDashboardMock.mockReturnValue({
      data: {
        data: {
          orders: {
            acceptedCount: 12,
            soldAndPaid: 5,
            cancelled: 2,
            profit: 480000,
            totalRevenue: 960000,
          },
          topMarkets: [
            { market_id: "m-1", market_name: "Chilonzor filiali", total_orders: 50, successful_orders: 45, success_rate: 90 },
          ],
          topBranches: [
            { branch_id: "b-1", branch_name: "Yunusobod filiali", total_orders: 40, successful_orders: 32, success_rate: 80 },
          ],
        },
      },
    });
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });

    expect(screen.getByTestId("top-performers")).toBeInTheDocument();
    expect(screen.getByTestId("top-market-name")).toHaveTextContent("Chilonzor filiali");
    expect(screen.getByTestId("top-branch-name")).toHaveTextContent("Yunusobod filiali");
  });

  it("wires both markets and couriers into the performance chart for admins", () => {
    getDashboardMock.mockReturnValue({
      data: {
        data: {
          orders: {
            acceptedCount: 12,
            soldAndPaid: 5,
            cancelled: 2,
            profit: 480000,
            totalRevenue: 960000,
          },
          topMarkets: [
            { market_id: "m-1", market_name: "Chilonzor filiali", total_orders: 50, successful_orders: 45, success_rate: 90 },
          ],
          topCouriers: [
            { courier_id: "c-1", courier_name: "Aziz", total_orders: 30, successful_orders: 24, success_rate: 80 },
          ],
        },
      },
    });
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });

    const chart = screen.getByTestId("performance-chart");
    expect(chart).toHaveAttribute("data-markets-count", "1");
    expect(chart).toHaveAttribute("data-couriers-count", "1");
  });

  it("charts every market and courier from the full stats, not just the top-5 rankings", () => {
    const performer = (id: string) => ({ total_orders: 10, successful_orders: 5, success_rate: 50, id });
    getDashboardMock.mockReturnValue({
      data: {
        data: {
          orders: { acceptedCount: 12, soldAndPaid: 5, cancelled: 2, profit: 0, totalRevenue: 0 },
          markets: Array.from({ length: 7 }, (_, i) => ({ ...performer(`m${i}`), market_id: `m${i}`, market_name: `Market ${i}` })),
          couriers: Array.from({ length: 8 }, (_, i) => ({ ...performer(`c${i}`), courier_id: `c${i}`, courier_name: `Kuryer ${i}` })),
          topMarkets: [
            { market_id: "m-1", market_name: "Top market", total_orders: 50, successful_orders: 45, success_rate: 90 },
          ],
        },
      },
    });
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });

    const chart = screen.getByTestId("performance-chart");
    expect(chart).toHaveAttribute("data-markets-count", "7");
    expect(chart).toHaveAttribute("data-couriers-count", "8");
  });

  it("falls back to the top rankings when the full stats come back empty (all-time period)", () => {
    getDashboardMock.mockReturnValue({
      data: {
        data: {
          orders: { acceptedCount: 12, soldAndPaid: 5, cancelled: 2, profit: 0, totalRevenue: 0 },
          markets: [],
          couriers: [],
          topMarkets: [
            { market_id: "m-1", market_name: "A", total_orders: 50, successful_orders: 22, success_rate: 44 },
            { market_id: "m-2", market_name: "B", total_orders: 66, successful_orders: 16, success_rate: 24 },
            { market_id: "m-3", market_name: "C", total_orders: 33, successful_orders: 7, success_rate: 21 },
          ],
        },
      },
    });
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });

    const chart = screen.getByTestId("performance-chart");
    expect(chart).toHaveAttribute("data-markets-count", "3");
    expect(chart).toHaveAttribute("data-couriers-count", "0");
  });

  it("hides the performance chart for couriers and operators", () => {
    getDashboardMock.mockReturnValue({
      data: { data: { myStat: { totalOrders: 1, soldOrders: 1, canceledOrders: 0, profit: 0, successRate: 100 } } },
    });
    renderWithProviders(<DashboardPage />, { preloadedState: courierState });
    expect(screen.queryByTestId("performance-chart")).not.toBeInTheDocument();

    renderWithProviders(<DashboardPage />, { preloadedState: operatorState });
    expect(screen.queryByTestId("performance-chart")).not.toBeInTheDocument();
  });

  it("hides financial dashboard metrics from registrators", () => {
    renderWithProviders(<DashboardPage />, { preloadedState: registratorState });

    expect(screen.getByTestId("dashboard-statistics")).toHaveAttribute(
      "data-financial",
      "false",
    );
    expect(getKpiMock).toHaveBeenCalledWith(
      { start_day: "", end_day: "" },
      false,
      "registrator:unknown",
    );
    expect(screen.queryByTestId("financial-analysis")).not.toBeInTheDocument();
  });

  it("shows only courier-relevant dashboard widgets for couriers", () => {
    getDashboardMock.mockReturnValue({
      data: {
        data: {
          myStat: {
            totalOrders: 28,
            soldOrders: 19,
            canceledOrders: 3,
            profit: 480000,
            successRate: 67.86,
          },
        },
      },
    });
    renderWithProviders(<DashboardPage />, { preloadedState: courierState });

    const grid = screen.getByTestId("courier-stats-grid");
    // 2x2 at mobile widths (no `sm`/`lg` breakpoint applies below 640px, so this
    // stays a 2-column grid at 390px — Tailwind's grid-cols-N uses minmax(0,1fr)
    // tracks, so long values wrap instead of forcing horizontal scroll) and a
    // single row of 4 from the `lg` breakpoint up.
    expect(grid).toHaveClass("grid-cols-2", "lg:grid-cols-4");
    expect(grid.children).toHaveLength(4);
    expect(screen.getByText("Jami buyurtmalar").parentElement).toHaveTextContent("28");
    expect(screen.getByText("Sotilgan").parentElement).toHaveTextContent("19");
    expect(grid).toHaveTextContent("67.86%");
    expect(screen.getByText("Bekor qilingan").parentElement).toHaveTextContent("3");
    expect(screen.getByText("Foyda").parentElement).toHaveTextContent("480 000");
    expect(screen.queryByTestId("dashboard-statistics")).not.toBeInTheDocument();
    expect(getDashboardMock).toHaveBeenCalledWith(
      { start_day: "", end_day: "" },
      true,
      "courier:unknown",
    );
    expect(getKpiMock).toHaveBeenCalledWith(
      { start_day: "", end_day: "" },
      false,
      "courier:unknown",
    );
    expect(screen.queryByTestId("top-performers")).not.toBeInTheDocument();
    expect(screen.queryByTestId("region-stats")).not.toBeInTheDocument();
    expect(screen.queryByTestId("financial-analysis")).not.toBeInTheDocument();
  });

  it("shows four skeleton cards while courier data is loading", () => {
    getDashboardMock.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = renderWithProviders(<DashboardPage />, { preloadedState: courierState });

    expect(screen.getByTestId("courier-stats-grid").children).toHaveLength(4);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.queryByText("Jami buyurtmalar")).not.toBeInTheDocument();
  });

  it("shows an error instead of zero cards when courier myStat is absent", () => {
    getDashboardMock.mockReturnValue({ data: { data: { orders: {} } }, isLoading: false });
    renderWithProviders(<DashboardPage />, { preloadedState: courierState });

    expect(screen.getByText("Kuryer statistikasi hozircha mavjud emas.")).toBeInTheDocument();
    expect(screen.queryByTestId("courier-stats-grid")).not.toBeInTheDocument();
  });

  it("retries a failed courier dashboard request", async () => {
    const refetch = vi.fn();
    getDashboardMock.mockReturnValue({ isError: true, isLoading: false, refetch });
    renderWithProviders(<DashboardPage />, { preloadedState: courierState });

    expect(screen.getByText("Dashboard ma'lumotlarini yuklab bo'lmadi.")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("requests courier statistics again after changing the date range", async () => {
    getDashboardMock.mockImplementation((params: { start_day?: string }) => ({
      data: {
        data: {
          myStat: {
            totalOrders: params.start_day ? 9 : 28,
            soldOrders: 5,
            canceledOrders: 1,
            profit: 120000,
            successRate: 55.56,
          },
        },
      },
    }));
    renderWithProviders(<DashboardPage />, { preloadedState: courierState });

    await userEvent.setup().click(screen.getByLabelText("Boshlanish → Tugash"));

    expect(getDashboardMock).toHaveBeenLastCalledWith(
      { start_day: "2026-04-01", end_day: "2026-04-14" },
      true,
      "courier:unknown",
    );
    expect(screen.getByText("Jami buyurtmalar").parentElement).toHaveTextContent("9");
  });

  it("switches to filtered title when dates are selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });

    await user.click(screen.getByLabelText("Boshlanish → Tugash"));

    expect(screen.getByText("Tanlangan davr statistikasi")).toBeInTheDocument();
    expect(getDashboardMock).toHaveBeenLastCalledWith(
      { start_day: "2026-04-01", end_day: "2026-04-14" },
      true,
      "admin:unknown",
    );
  });

  it("falls back to zero metrics when api response is empty", () => {
    getDashboardMock.mockReturnValue({ data: undefined });
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });

    expect(screen.getByTestId("dashboard-statistics")).toHaveTextContent("0-0-0-0");
  });

  it("gives operators their own stat cards instead of a blank page, without company-wide rankings", () => {
    renderWithProviders(<DashboardPage />, { preloadedState: operatorState });

    // Not blank: the operator sees the same base statistics widget admins do.
    expect(screen.getByTestId("dashboard-statistics")).toBeInTheDocument();
    // But company-wide ranking/region widgets are held back until the backend
    // actually scopes analytics-service to the operator's own market — showing
    // them today would leak every market's and courier's data to an operator.
    expect(screen.queryByTestId("top-performers")).not.toBeInTheDocument();
    expect(screen.queryByTestId("region-stats")).not.toBeInTheDocument();
    // Revenue analytics stay SUPERADMIN/ADMIN-only (Audit P1-2) — unaffected by this change.
    expect(screen.queryByTestId("financial-analysis")).not.toBeInTheDocument();
  });
});
