import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { vi } from "vitest";
import FinancialBalance from "./index";
import { renderWithProviders } from "../../test/test-utils";

const LocationProbe = () => {
  const { search } = useLocation();
  return <span data-testid="search">{search}</span>;
};

vi.mock("../../entities/payments", () => ({
  useCashBox: () => ({
    useGetFinancialBalance: () => ({
      data: { data: { balance: 1000, main: { balance: 1000 } } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
  }),
}));

vi.mock("./components/Statistics", () => ({ default: () => <div data-testid="overview-tab" /> }));
vi.mock("./components/HistoryTab", () => ({ default: () => <div data-testid="history-tab" /> }));
vi.mock("./components/AnalysisTab", () => ({ default: () => <div data-testid="analysis-tab" /> }));

const open = (route = "/financial-balance") =>
  renderWithProviders(
    <>
      <FinancialBalance />
      <LocationProbe />
    </>,
    { route },
  );

const currentSearch = () => screen.getByTestId("search").textContent ?? "";

describe("FinancialBalance tabs", () => {
  it("opens the History tab straight from a ?tab=history link (and after F5)", () => {
    open("/financial-balance?tab=history");

    expect(screen.getByTestId("history-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("overview-tab")).not.toBeInTheDocument();
  });

  it("falls back to the overview tab for an unknown ?tab value", () => {
    open("/financial-balance?tab=bogus");

    expect(screen.getByTestId("overview-tab")).toBeInTheDocument();
  });

  it("writes the selected tab to the URL", async () => {
    const user = userEvent.setup();
    open();

    await user.click(screen.getByRole("button", { name: "Tarix" }));

    expect(currentSearch()).toContain("tab=history");
    expect(screen.getByTestId("history-tab")).toBeInTheDocument();
  });

  it("drops the History tab's page/filter params when switching to another tab", async () => {
    const user = userEvent.setup();
    open(
      "/financial-balance?tab=history&financialBalanceHistoryPage=4&financialBalanceHistorySource=sell&keep=1",
    );

    await user.click(screen.getByRole("button", { name: "Umumiy ko'rinish" }));

    expect(currentSearch()).toContain("tab=overview");
    expect(currentSearch()).toContain("keep=1");
    expect(currentSearch()).not.toContain("financialBalanceHistory");
  });
});
