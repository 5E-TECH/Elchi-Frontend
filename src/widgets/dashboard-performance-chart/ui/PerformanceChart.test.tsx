import type { ReactNode } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../test/test-utils";
import PerformanceChart from "./PerformanceChart";
import type { TopMarket, TopCourier } from "../../../entities/dashboard";

interface ChartRow {
  id: string;
  name: string;
}

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ children, data }: { children: ReactNode; data: ChartRow[] }) => (
    <div data-testid="bar-chart" data-rows={JSON.stringify(data.map((row) => row.name))}>
      {children}
    </div>
  ),
  Bar: ({ children }: { children?: ReactNode }) => <div data-testid="bar">{children}</div>,
  Cell: ({ fill }: { fill: string }) => <span data-testid="bar-cell" data-fill={fill} />,
  XAxis: () => null,
  YAxis: ({ tickFormatter }: { tickFormatter?: (value: string) => string }) => (
    <div data-testid="y-axis" data-long-label={tickFormatter?.("E2E-AND13-KURYER2-EXTRA") ?? ""} />
  ),
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

const buildMarket = (overrides: Partial<TopMarket> & { market_id: string }): TopMarket => ({
  market_name: `Market ${overrides.market_id}`,
  total_orders: 100,
  successful_orders: 70,
  success_rate: 70,
  ...overrides,
});

const buildCourier = (overrides: Partial<TopCourier> & { courier_id: string }): TopCourier => ({
  courier_name: `Courier ${overrides.courier_id}`,
  total_orders: 50,
  successful_orders: 40,
  success_rate: 80,
  ...overrides,
});

describe("PerformanceChart", () => {
  it("renders nothing when neither markets nor couriers are provided", () => {
    const { container } = renderWithProviders(<PerformanceChart />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders only the markets section for the market role (couriers prop omitted)", () => {
    renderWithProviders(
      <PerformanceChart markets={[buildMarket({ market_id: "m1" })]} />,
    );

    expect(screen.getByText("Marketlar bo'yicha sotuv foizi")).toBeInTheDocument();
    expect(screen.queryByText("Kuryerlar bo'yicha sotuv foizi")).not.toBeInTheDocument();
  });

  it("renders both sections for admin-like roles", () => {
    renderWithProviders(
      <PerformanceChart
        markets={[buildMarket({ market_id: "m1" })]}
        couriers={[buildCourier({ courier_id: "c1" })]}
      />,
    );

    expect(screen.getByText("Marketlar bo'yicha sotuv foizi")).toBeInTheDocument();
    expect(screen.getByText("Kuryerlar bo'yicha sotuv foizi")).toBeInTheDocument();
  });

  it("shows an empty state instead of a blank chart when the section has zero rows", () => {
    renderWithProviders(<PerformanceChart markets={[]} />);

    expect(screen.getByText("Hali solishtirish uchun yetarli ma'lumot yo'q.")).toBeInTheDocument();
    expect(screen.queryByTestId("bar-chart")).not.toBeInTheDocument();
  });

  it("sorts rows by sell-through rate, highest first", () => {
    renderWithProviders(
      <PerformanceChart
        markets={[
          buildMarket({ market_id: "low", market_name: "Low", success_rate: 20 }),
          buildMarket({ market_id: "high", market_name: "High", success_rate: 90 }),
          buildMarket({ market_id: "mid", market_name: "Mid", success_rate: 50 }),
        ]}
      />,
    );

    const rows = JSON.parse(screen.getByTestId("bar-chart").getAttribute("data-rows")!);
    expect(rows).toEqual(["High", "Mid", "Low"]);
  });

  it("caps the chart at 10 rows and reveals the rest behind Show more", async () => {
    const user = userEvent.setup();
    const markets = Array.from({ length: 14 }, (_, i) =>
      buildMarket({ market_id: `m${i}`, market_name: `Market ${i}`, success_rate: 100 - i }),
    );

    renderWithProviders(<PerformanceChart markets={markets} />);

    const rowsBefore = JSON.parse(screen.getByTestId("bar-chart").getAttribute("data-rows")!);
    expect(rowsBefore).toHaveLength(10);

    await user.click(screen.getByRole("button", { name: /Yana ko'rsatish/ }));

    const rowsAfter = JSON.parse(screen.getByTestId("bar-chart").getAttribute("data-rows")!);
    expect(rowsAfter).toHaveLength(14);
  });

  it("truncates long axis labels so space-less courier names are not clipped", () => {
    renderWithProviders(<PerformanceChart couriers={[buildCourier({ courier_id: "c1" })]} />);

    expect(screen.getByTestId("y-axis")).toHaveAttribute("data-long-label", "E2E-AND13-KURYE…");
  });

  it("paints rates below 50% red, 50–69% amber and 70%+ green", () => {
    renderWithProviders(
      <PerformanceChart
        markets={[
          buildMarket({ market_id: "a", success_rate: 80 }),
          buildMarket({ market_id: "b", success_rate: 60 }),
          buildMarket({ market_id: "c", success_rate: 49.9 }),
          buildMarket({ market_id: "d", success_rate: 45 }),
        ]}
      />,
    );

    expect(screen.getAllByTestId("bar-cell").map((cell) => cell.getAttribute("data-fill"))).toEqual([
      "var(--color-success)",
      "var(--color-warning)",
      "var(--color-error)",
      "var(--color-error)",
    ]);
  });

  it("shows a loading skeleton — not the 'not enough data' text — while the data is still loading", () => {
    const { container } = renderWithProviders(<PerformanceChart markets={[]} couriers={[]} loading />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.queryByText("Hali solishtirish uchun yetarli ma'lumot yo'q.")).not.toBeInTheDocument();
  });

  it("explains why the couriers section is empty when a specific reason is given", () => {
    renderWithProviders(
      <PerformanceChart markets={[]} couriers={[]} couriersEmptyText="Kuryerlar bu davr uchun yo'q" />,
    );

    expect(screen.getByText("Kuryerlar bu davr uchun yo'q")).toBeInTheDocument();
    expect(screen.getByText("Hali solishtirish uchun yetarli ma'lumot yo'q.")).toBeInTheDocument();
  });

  it("does not show a Show more button when there are 10 or fewer rows", () => {
    const markets = Array.from({ length: 5 }, (_, i) => buildMarket({ market_id: `m${i}` }));
    renderWithProviders(<PerformanceChart markets={markets} />);

    expect(screen.queryByRole("button", { name: /Yana ko'rsatish/ })).not.toBeInTheDocument();
  });
});
