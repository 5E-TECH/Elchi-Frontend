import type { ReactNode } from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import FinancialAnalysis, { CustomTooltip } from "./FinancialAnalysis";

const getRevenueMock = vi.fn();

vi.mock("../../../entities/dashboard", () => ({
  useDashboard: () => ({ getRevenue: getRevenueMock }),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ComposedChart: ({ children, data }: { children: ReactNode; data: Array<{ previousRevenue?: number | null }> }) => (
    <div data-testid="revenue-chart" data-previous={JSON.stringify(data.map((point) => point.previousRevenue))}>{children}</div>
  ),
  Area: () => null,
  Bar: () => null,
  Line: ({ dataKey, strokeOpacity }: { dataKey: string; strokeOpacity?: number }) => (
    <div data-testid={dataKey === "previousRevenue" ? "previous-line" : "current-line"} data-opacity={strokeOpacity} />
  ),
  XAxis: () => null,
  YAxis: ({ tickFormatter }: { tickFormatter?: (value: number) => string }) => (
    <div data-testid="y-axis" data-sample-tick={tickFormatter ? tickFormatter(1_500_000) : undefined} />
  ),
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

const current = {
  data: {
    summary: { totalRevenue: 150000, totalOrders: 3, avgRevenue: 10000 },
    chart: { labels: ["01.09", "02.09"], values: [50000, 100000] },
  },
};
const previous = {
  data: {
    summary: { totalRevenue: 100000, totalOrders: 2, avgRevenue: 5000 },
    chart: { labels: ["17.08", "18.08"], values: [40000, 60000] },
  },
};

describe("FinancialAnalysis comparison", () => {
  beforeEach(() => {
    window.localStorage.removeItem("dashboard-comparison");
    getRevenueMock.mockImplementation((params: { start_day: string }) => ({
      data: params.start_day === "2026-09-01" ? current : previous,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));
  });

  it("queries equal-length ranges and shows manually verified growth with a previous line", () => {
    renderWithProviders(
      <FinancialAnalysis startDate="2026-09-01" endDate="2026-09-15" analyticsScope="admin:1" />,
    );

    expect(getRevenueMock).toHaveBeenCalledWith(
      { period: "daily", start_day: "2026-09-01", end_day: "2026-09-15" },
      true,
      "admin:1",
    );
    expect(getRevenueMock).toHaveBeenCalledWith(
      { period: "daily", start_day: "2026-08-17", end_day: "2026-08-31" },
      true,
      "admin:1",
    );
    const revenueCard = screen.getByText("Jami daromad").closest<HTMLElement>(".el-card");
    expect(within(revenueCard!).getByText("+50.0%")).toBeInTheDocument();
    expect(revenueCard).toHaveTextContent("100 000 so'm");
    expect(screen.getByTestId("previous-line")).toHaveAttribute("data-opacity", "0.55");
    expect(screen.getByTestId("revenue-chart")).toHaveAttribute("data-previous", "[40000,60000]");
  });

  it("uses a dash when the previous period has no orders", () => {
    getRevenueMock.mockImplementation((params: { start_day: string }) => ({
      data: params.start_day === "2026-09-01"
        ? current
        : { data: { summary: { totalRevenue: 0, totalOrders: 0, avgRevenue: 0 }, chart: { labels: ["17.08"], values: [0] } } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));
    renderWithProviders(<FinancialAnalysis startDate="2026-09-01" endDate="2026-09-15" />);

    const revenueCard = screen.getByText("Jami daromad").closest<HTMLElement>(".el-card");
    expect(within(revenueCard!).getByText("—")).toBeInTheDocument();
    expect(screen.queryByTestId("previous-line")).not.toBeInTheDocument();
  });

  it("marks a decrease red with a downward arrow", () => {
    getRevenueMock.mockImplementation((params: { start_day: string }) => ({
      data: params.start_day === "2026-09-01"
        ? current
        : { data: { ...previous.data, summary: { ...previous.data.summary, totalRevenue: 200000 } } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));
    renderWithProviders(<FinancialAnalysis startDate="2026-09-01" endDate="2026-09-15" />);

    const revenueCard = screen.getByText("Jami daromad").closest<HTMLElement>(".el-card");
    expect(within(revenueCard!).getByText("-25.0%")).toBeInTheDocument();
    expect(revenueCard?.querySelector(".lucide-trending-down")).toBeInTheDocument();
  });

  it("persists the comparison toggle and stops the previous query", async () => {
    const user = userEvent.setup();
    const view = renderWithProviders(<FinancialAnalysis startDate="2026-09-01" endDate="2026-09-15" />);

    await user.click(screen.getByRole("button", { name: "Solishtirish" }));
    expect(window.localStorage.getItem("dashboard-comparison")).toBe("false");
    expect(screen.queryByTestId("previous-line")).not.toBeInTheDocument();
    expect(getRevenueMock).toHaveBeenLastCalledWith(
      { period: "daily", start_day: "2026-08-17", end_day: "2026-08-31" },
      false,
      undefined,
    );

    view.unmount();
    renderWithProviders(<FinancialAnalysis startDate="2026-09-01" endDate="2026-09-15" />);
    expect(screen.getByRole("button", { name: "Solishtirish" })).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the controls and metric hints wrap-safe at a 390px viewport width", () => {
    renderWithProviders(
      <FinancialAnalysis startDate="2026-09-01" endDate="2026-09-15" analyticsScope="admin:1" />,
    );

    // Period + comparison toggle controls must wrap instead of overflowing on narrow screens.
    const toggleButton = screen.getByRole("button", { name: "Solishtirish" });
    expect(toggleButton.parentElement).toHaveClass("flex-wrap");

    // Metric grid starts single-column (grid-cols-1) — only widens at sm/xl breakpoints.
    const revenueCard = screen.getByText("Jami daromad").closest<HTMLElement>(".el-card")!;
    const metricsGrid = revenueCard.closest("div.grid");
    expect(metricsGrid).toHaveClass("grid-cols-1");

    // Long hint text (previous-period label + amount) must wrap/clamp, not overflow.
    const hint = within(revenueCard).getByText(/Oldingi davr \(/);
    expect(hint).toHaveClass("break-words");
    expect(hint).toHaveClass("line-clamp-2");
  });

  it("formats the Y axis with compact numbers so it stays narrow on small screens", () => {
    renderWithProviders(
      <FinancialAnalysis startDate="2026-09-01" endDate="2026-09-15" analyticsScope="admin:1" />,
    );

    // formatCompactMoney(1_500_000) === "1.50 mln" — must NOT be the raw "1 500 000".
    expect(screen.getByTestId("y-axis")).toHaveAttribute("data-sample-tick", "1.50 mln");
  });

  it("hides the previous-period line when the chart arrays have mismatched lengths", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    getRevenueMock.mockImplementation((params: { start_day: string }) => ({
      data: params.start_day === "2026-09-01"
        ? current
        : {
            data: {
              summary: { totalRevenue: 100000, totalOrders: 2, avgRevenue: 5000 },
              // Only 1 point vs current's 2 points — a real mismatch (e.g. weekly/monthly bucketing).
              chart: { labels: ["17.08"], values: [40000] },
            },
          },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));
    renderWithProviders(<FinancialAnalysis startDate="2026-09-01" endDate="2026-09-15" />);

    expect(screen.queryByTestId("previous-line")).not.toBeInTheDocument();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("moslik ishonchli emas"));
    warnSpy.mockRestore();
  });

  it("shows a distinct loading state for the previous period instead of a false '—'", () => {
    getRevenueMock.mockImplementation((params: { start_day: string }) => {
      if (params.start_day === "2026-09-01") {
        return { data: current, isLoading: false, isError: false, refetch: vi.fn() };
      }
      // Previous-period query still in flight: no data yet, isLoading true.
      return { data: undefined, isLoading: true, isError: false, refetch: vi.fn() };
    });
    renderWithProviders(<FinancialAnalysis startDate="2026-09-01" endDate="2026-09-15" />);

    const revenueCard = screen.getByText("Jami daromad").closest<HTMLElement>(".el-card");
    expect(within(revenueCard!).getByText("…")).toBeInTheDocument();
    expect(within(revenueCard!).getByText((_, node) => node?.textContent === "Oldingi davr (2026-08-17 – 2026-08-31): Yuklanmoqda...")).toBeInTheDocument();
    expect(screen.queryByTestId("previous-line")).not.toBeInTheDocument();
    expect(screen.getByText("Yuklanmoqda...")).toBeInTheDocument();
  });
});

describe("FinancialAnalysis CustomTooltip", () => {
  it("distinguishes a missing (null) previous point from a genuine zero", () => {
    renderWithProviders(
      <CustomTooltip
        active
        label="17.08"
        payload={[
          { name: "Joriy davr", value: 0, color: "#000" },
          { name: "Oldingi davr", value: null as unknown as number, color: "#999" },
        ]}
      />,
    );

    expect(screen.getByText("Joriy davr: 0 UZS")).toBeInTheDocument();
    expect(screen.getByText("Oldingi davr: —")).toBeInTheDocument();
  });
});
