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

vi.mock("../../shared/ui/CustomDatePicker", () => ({
  default: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
  }) => (
    <input
      aria-label={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    getDashboardMock.mockReturnValue({
      data: {
        orders: {
          acceptedCount: 12,
          soldAndPaid: 5,
          cancelled: 2,
          profit: 480000,
        },
      },
    });
  });

  it("renders dashboard header and date filters", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByText("Bugungi statistika")).toBeInTheDocument();
    expect(screen.getByLabelText("Boshlanish")).toBeInTheDocument();
    expect(screen.getByLabelText("Tugash")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bugun" })).not.toBeInTheDocument();
  });

  it("passes dashboard metrics into child widgets", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByTestId("dashboard-statistics")).toHaveTextContent("12-5-2-480000");
    expect(screen.getByTestId("financial-analysis")).toHaveTextContent('"totalOrders":12');
  });

  it("switches to filtered title when dates are selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DashboardPage />);

    await user.type(screen.getByLabelText("Boshlanish"), "2026-04-01");

    expect(screen.getByText("Tanlangan davr statistikasi")).toBeInTheDocument();
  });

  it("falls back to zero metrics when api response is empty", () => {
    getDashboardMock.mockReturnValue({ data: undefined });
    renderWithProviders(<DashboardPage />);

    expect(screen.getByTestId("dashboard-statistics")).toHaveTextContent("0-0-0-0");
  });
});
