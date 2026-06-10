import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import DashboardPage from "./DashboardPage";
import { renderWithProviders } from "../../test/test-utils";

const getDashboardMock = vi.fn();
const getKpiMock = vi.fn();

vi.mock("../../entities/dashboard", () => ({
  useDashboard: () => ({
    getDashboard: getDashboardMock,
    getKpi: getKpiMock,
  }),
}));

vi.mock("../../widgets/dashboard-statistics/ui/DashboardStatistics", () => ({
  default: (props: Record<string, number>) => (
    <div data-testid="dashboard-statistics">
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
  default: () => <div data-testid="top-performers" />,
}));

vi.mock("../../widgets/dashboard-region/ui/RegionStatsCard", () => ({
  default: () => <div data-testid="region-stats" />,
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
    renderWithProviders(<DashboardPage />);

    expect(getDashboardMock).toHaveBeenCalledWith(
      { start_day: "", end_day: "" },
      true,
      "unknown:unknown",
    );
    expect(getKpiMock).toHaveBeenCalledWith(
      { start_day: "", end_day: "" },
      true,
      "unknown:unknown",
    );
    expect(screen.getByText("Bugungi statistika")).toBeInTheDocument();
    expect(screen.getByLabelText("Boshlanish → Tugash")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bugun" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bu hafta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bu oy" })).toBeInTheDocument();
  });

  it("passes dashboard metrics into child widgets", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByTestId("dashboard-statistics")).toHaveTextContent(
      "12-5-2-480000-96000-24",
    );
    expect(screen.getByTestId("financial-analysis")).toHaveTextContent('"startDate"');
  });

  it("switches to filtered title when dates are selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DashboardPage />);

    await user.click(screen.getByLabelText("Boshlanish → Tugash"));

    expect(screen.getByText("Tanlangan davr statistikasi")).toBeInTheDocument();
    expect(getDashboardMock).toHaveBeenLastCalledWith(
      { start_day: "2026-04-01", end_day: "2026-04-14" },
      true,
      "unknown:unknown",
    );
  });

  it("falls back to zero metrics when api response is empty", () => {
    getDashboardMock.mockReturnValue({ data: undefined });
    renderWithProviders(<DashboardPage />);

    expect(screen.getByTestId("dashboard-statistics")).toHaveTextContent("0-0-0-0");
  });
});
