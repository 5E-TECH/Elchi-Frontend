import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import DashboardPage from "./DashboardPage";
import { renderWithProviders } from "../../test/test-utils";

const getDashboardMock = vi.fn();

vi.mock("../../entities/dashboard", () => ({
  useDashboard: () => ({
    getDashboard: getDashboardMock,
  }),
}));

vi.mock("../../widgets/dashboard-statistics/ui/DashboardStatistics", () => ({
  default: (props: Record<string, number>) => (
    <div data-testid="dashboard-statistics">
      {props.totalOrders}-{props.sold}-{props.cancelled}-{props.profit}
    </div>
  ),
}));

vi.mock("../../widgets/financial-analysis/ui/FinancialAnalysis", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="financial-analysis">{JSON.stringify(props)}</div>
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
  });

  it("renders dashboard header and date filters", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByText("Bugungi statistika")).toBeInTheDocument();
    expect(screen.getByLabelText("Boshlanish → Tugash")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bugun" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bu hafta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bu oy" })).toBeInTheDocument();
  });

  it("passes dashboard metrics into child widgets", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByTestId("dashboard-statistics")).toHaveTextContent("12-5-2-480000");
    expect(screen.getByTestId("financial-analysis")).toHaveTextContent('"totalOrders":12');
  });

  it("switches to filtered title when dates are selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DashboardPage />);

    await user.click(screen.getByLabelText("Boshlanish → Tugash"));

    expect(screen.getByText("Tanlangan davr statistikasi")).toBeInTheDocument();
  });

  it("falls back to zero metrics when api response is empty", () => {
    getDashboardMock.mockReturnValue({ data: undefined });
    renderWithProviders(<DashboardPage />);

    expect(screen.getByTestId("dashboard-statistics")).toHaveTextContent("0-0-0-0");
  });
});
