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

vi.mock("../../widgets/dashboard-top-performers/ui/TopPerformers", () => ({
  default: ({ markets }: { markets?: unknown[] }) => (
    <div data-testid="top-performers">markets:{markets?.length ?? 0}</div>
  ),
}));

describe("MarketDashboardPage", () => {
  beforeEach(() => {
    getDashboardMock.mockReturnValue({
      data: {
        data: {
          orders: {
            acceptedCount: 4,
            soldAndPaid: 1,
            cancelled: 1,
            inProgress: 1,
            profit: 120000,
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
        },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
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
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByTestId("top-performers")).toHaveTextContent("markets:1");
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
    expect(screen.getByTestId("top-performers")).toHaveTextContent("markets:1");
  });
});
