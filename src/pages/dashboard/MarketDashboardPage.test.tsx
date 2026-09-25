import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import MarketDashboardPage from "./MarketDashboardPage";

const getDashboardMock = vi.fn();
const getKpiMock = vi.fn();

vi.mock("../../entities/dashboard", () => ({
  useDashboard: () => ({
    getDashboard: getDashboardMock,
    getKpi: getKpiMock,
  }),
}));

const settingsState: { data: unknown } = { data: undefined };

vi.mock("../../entities/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../entities/settings")>()),
  useSettings: () => settingsState,
}));

vi.mock("../../widgets/dashboard-performance-chart/ui/PerformanceChart", () => ({
  // `couriers === undefined` is the signal that the couriers section is
  // intentionally omitted for the market role (not relevant to a market user).
  default: (props: { markets?: unknown[]; couriers?: unknown[] }) => (
    <div
      data-testid="performance-chart"
      data-markets-count={props.markets?.length ?? -1}
      data-couriers-count={props.couriers === undefined ? "undefined" : props.couriers.length}
    />
  ),
}));

// Shared fixture builder — tests that need a modified variant (e.g. empty
// topOperators) clone a FRESH call of this instead of reading the mock's
// return value back (vi.fn().mockReturnValue() has no recorded
// "implementation" to read back via getMockImplementation(), so that pattern
// silently produced `undefined` and dropped the rest of the fixture).
const buildDashboardResponse = () => ({
  data: {
    data: {
      orders: {
        acceptedCount: 4,
        soldAndPaid: 1,
        cancelled: 1,
        inProgress: 1,
        profit: 120000,
      },
      myStat: {
        totalOrders: 38,
        soldOrders: 7,
        canceledOrders: 2,
        profit: 19060000,
        successRate: 18.42,
      },
      topMarkets: [
        {
          market_id: "market-1",
          market_name: "Market",
          total_orders: 4,
          successful_orders: 1,
          success_rate: 25,
        },
      ],
      topOperators: [
        {
          operator_id: "operator-1",
          operator_name: "Operator Ali",
          total_orders: 20,
          successful_orders: 16,
          success_rate: 80,
        },
      ],
    },
  },
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
});

describe("MarketDashboardPage", () => {
  beforeEach(() => {
    getDashboardMock.mockReturnValue(buildDashboardResponse());
    settingsState.data = undefined;
  });

  it("hides the comparison chart and rankings when those widgets are turned off in Settings", async () => {
    const { DEFAULT_SETTINGS } = await import("../../entities/settings");
    settingsState.data = {
      ...DEFAULT_SETTINGS,
      dashboard: {
        widgets: { ...DEFAULT_SETTINGS.dashboard.widgets, performanceChart: false, topPerformers: false },
      },
    };

    renderWithProviders(<MarketDashboardPage />, {
      preloadedState: {
        role: { id: "market-1", role: "market", region: null, name: "Market" },
      },
    });

    expect(screen.getByTestId("market-stats-grid")).toBeInTheDocument();
    expect(screen.queryByTestId("performance-chart")).not.toBeInTheDocument();
    expect(screen.queryByText("Top marketlar")).not.toBeInTheDocument();
  });

  it("uses only the market-authorized dashboard endpoint", () => {
    renderWithProviders(<MarketDashboardPage />, {
      preloadedState: {
        role: { id: "market-1", role: "market", region: null, name: "Market" },
      },
    });

    expect(getDashboardMock).toHaveBeenCalledWith(
      { start_day: "", end_day: "" },
      true,
      "market:unknown",
    );
    expect(getKpiMock).not.toHaveBeenCalled();
    const grid = screen.getByTestId("market-stats-grid");
    expect(grid).toHaveClass("grid-cols-2");
    expect(grid.children).toHaveLength(4);
    expect(screen.getByText("Jami buyurtmalar").parentElement).toHaveTextContent("38");
    expect(screen.getByText("Sotilgan").parentElement).toHaveTextContent("7");
    expect(grid).toHaveTextContent("18.42%");
    expect(screen.getByText("Bekor qilingan").parentElement).toHaveTextContent("2");
    expect(screen.getByText("Sof foyda").parentElement).toHaveTextContent("19 060 000");
    expect(screen.getByText("Top marketlar")).toBeInTheDocument();
    expect(screen.getByText("Siz")).toBeInTheDocument();
    expect(screen.getByText("Top operatorlar")).toBeInTheDocument();
    expect(screen.getByText("Operator Ali")).toBeInTheDocument();
  });

  it("sends explicit dates when market selects all-time range", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MarketDashboardPage />, {
      preloadedState: {
        role: { id: "market-1", role: "market", region: null, name: "Market" },
      },
    });

    await user.click(screen.getByRole("button", { name: "Barchasi" }));

    const lastParams = getDashboardMock.mock.lastCall?.[0];

    expect(getDashboardMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        start_day: "1970-01-01",
        end_day: expect.any(String),
      }),
      true,
      "market:unknown",
    );
    expect(lastParams).not.toHaveProperty("all");
    expect(getKpiMock).not.toHaveBeenCalled();
    expect(screen.getByText("Top marketlar")).toBeInTheDocument();
    expect(screen.getByText("Top operatorlar")).toBeInTheDocument();
  });

  it("omits the operator leaderboard without leaving an empty card", () => {
    const response = buildDashboardResponse();
    getDashboardMock.mockReturnValue({
      ...response,
      data: {
        ...response.data,
        data: { ...response.data.data, topOperators: [] },
      },
    });
    renderWithProviders(<MarketDashboardPage />, {
      preloadedState: {
        role: { id: "market-1", role: "market", region: null, name: "Market" },
      },
    });

    expect(screen.queryByText("Top operatorlar")).not.toBeInTheDocument();

    // Regression guard: dropping the operators leaderboard must not blank out
    // or shrink the still-populated markets leaderboard next to it — the
    // markets section keeps rendering its real ranking, not just its title.
    expect(screen.getByText("Top marketlar")).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "1. Market" })).toBeInTheDocument();

    // The layout must not reserve a phantom second grid column for the
    // now-absent operators card — only one leaderboard is showing.
    const marketsCard = screen.getByRole("list", { name: "Top marketlar" }).closest("section");
    expect(marketsCard?.parentElement).not.toHaveClass("md:grid-cols-2");
  });

  it("shows the markets-only performance chart (no couriers section for the market role)", () => {
    renderWithProviders(<MarketDashboardPage />, {
      preloadedState: {
        role: { id: "market-1", role: "market", region: null, name: "Market" },
      },
    });

    const chart = screen.getByTestId("performance-chart");
    expect(chart).toHaveAttribute("data-markets-count", "1");
    expect(chart).toHaveAttribute("data-couriers-count", "undefined");
  });
});
