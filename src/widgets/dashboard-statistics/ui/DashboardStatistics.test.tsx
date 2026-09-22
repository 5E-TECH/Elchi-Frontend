import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../test/test-utils";
import DashboardStatistics from "./DashboardStatistics";

const baseProps = {
  accepted: 100,
  sold: 60,
  cancelled: 10,
  profit: 5_000_000,
  totalRevenue: 20_000_000,
  avgOrderValue: 200_000,
  avgFulfillmentHours: 12.5,
  onTimeRate: 72.3,
};

describe("DashboardStatistics", () => {
  it("fills the secondary metrics row with all 6 cards, including the two new KPI cards", () => {
    renderWithProviders(<DashboardStatistics {...baseProps} showFinancialMetrics />);

    // Pre-existing 4 cards still there.
    expect(screen.getByText("Jami daromad")).toBeInTheDocument();
    expect(screen.getByText("Sof foyda")).toBeInTheDocument();
    expect(screen.getByText("O'rtacha buyurtma qiymati")).toBeInTheDocument();
    expect(screen.getByText("Yo'qotilgan daromad")).toBeInTheDocument();

    // The two previously-missing KPI cards now render with real values from props.
    const fulfillmentCard = screen.getByText("O'rtacha yetkazish vaqti").closest(".el-card");
    expect(fulfillmentCard).toHaveTextContent("12 soat 30 daq");

    const onTimeCard = screen.getByText("O'z vaqtida (SLA)").closest(".el-card");
    expect(onTimeCard).toHaveTextContent("72.3%");
    expect(onTimeCard).toHaveTextContent("24 soat");
  });

  it("shows a dash for zero fulfillment hours instead of a misleading 0", () => {
    renderWithProviders(
      <DashboardStatistics {...baseProps} avgFulfillmentHours={0} showFinancialMetrics />,
    );

    const fulfillmentCard = screen.getByText("O'rtacha yetkazish vaqti").closest(".el-card");
    expect(fulfillmentCard).toHaveTextContent("—");
  });

  it("renders no leftover empty block when showFinancialMetrics is false", () => {
    const { container } = renderWithProviders(
      <DashboardStatistics {...baseProps} showFinancialMetrics={false} />,
    );

    expect(screen.queryByText("Jami daromad")).not.toBeInTheDocument();
    expect(screen.queryByText("O'rtacha yetkazish vaqti")).not.toBeInTheDocument();
    expect(screen.queryByText("O'z vaqtida (SLA)")).not.toBeInTheDocument();
    expect(screen.queryByText("Yo'qotilgan daromad")).not.toBeInTheDocument();
    // The grid container itself must not be left behind as an empty div.
    expect(container.querySelector(".xl\\:grid-cols-6")).not.toBeInTheDocument();
  });

  it("keeps a full 6-column grid so the row never leaves a bare 1/3 gap", () => {
    const { container } = renderWithProviders(
      <DashboardStatistics {...baseProps} showFinancialMetrics />,
    );

    const grid = container.querySelector(".xl\\:grid-cols-6");
    expect(grid).toBeInTheDocument();
    expect(grid?.children).toHaveLength(6);
  });
});
