import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { vi } from "vitest";
import HistoryTab from "./HistoryTab";
import { renderWithProviders } from "../../../test/test-utils";

const LocationProbe = () => {
  const { search } = useLocation();
  return <span data-testid="search">{search}</span>;
};

const idleQuery = { data: undefined, isLoading: false, isError: false, refetch: vi.fn() };

const getHistoryMock = vi.fn((enabled: boolean, params: unknown) => {
  void enabled;
  void params;
  return idleQuery;
});

vi.mock("../../../entities/payments/financeCoverage", () => ({
  useFinanceCoverage: () => ({
    useGetFinancialBalanceHistory: (enabled: boolean, params: unknown) => getHistoryMock(enabled, params),
  }),
}));

const open = (route: string) =>
  renderWithProviders(
    <>
      <HistoryTab />
      <LocationProbe />
    </>,
    { route },
  );

const currentSearch = () => screen.getByTestId("search").textContent ?? "";

describe("HistoryTab URL state", () => {
  // jsdom does not implement scrollIntoView; FilterSelect calls it when its
  // dropdown opens.
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    getHistoryMock.mockClear();
    getHistoryMock.mockImplementation(() => idleQuery);
  });

  it("maps the URL filter params to the history request query (restores them after F5)", () => {
    open(
      "/financial-balance?tab=history&financialBalanceHistorySource=sell_profit&financialBalanceHistoryFrom=2026-09-01&financialBalanceHistoryTo=2026-09-20&financialBalanceHistoryPage=2",
    );

    expect(getHistoryMock).toHaveBeenLastCalledWith(true, {
      page: 2,
      limit: 10,
      source_type: "sell_profit",
      fromDate: "2026-09-01T00:00:00.000Z",
      toDate: "2026-09-20T23:59:59.999Z",
    });
  });

  it("ignores a malformed date in the URL instead of sending it to the API", () => {
    open("/financial-balance?tab=history&financialBalanceHistoryFrom=not-a-date");

    expect(getHistoryMock).toHaveBeenLastCalledWith(true, { page: 1, limit: 10 });
  });

  it("ignores an unknown source type in the URL instead of sending it to the API (which answers 500)", () => {
    open("/financial-balance?tab=history&financialBalanceHistorySource=sell");

    expect(getHistoryMock).toHaveBeenLastCalledWith(true, { page: 1, limit: 10 });
  });

  it("writes a newly selected source filter to the URL and resets to page 1", async () => {
    const user = userEvent.setup();
    open("/financial-balance?tab=history&financialBalanceHistoryPage=3");

    await user.click(screen.getByLabelText("Manba turi"));
    await user.click(await screen.findByRole("option", { name: "Pochta foydasi" }));

    await waitFor(() => expect(currentSearch()).toContain("financialBalanceHistorySource=sell_profit"));
    expect(currentSearch()).not.toContain("financialBalanceHistoryPage");
    expect(currentSearch()).toContain("tab=history");
    // Backend enum qiymati `sell_profit`; `sell` yuborilsa 500 qaytaradi.
    expect(getHistoryMock).toHaveBeenLastCalledWith(true, { page: 1, limit: 10, source_type: "sell_profit" });
  });

  it("shows an error state (not 'no history') when the history request fails", () => {
    getHistoryMock.mockImplementation(() => ({ ...idleQuery, isError: true }));
    open("/financial-balance?tab=history");

    expect(screen.getByText("Xatolik")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qayta urinish" })).toBeInTheDocument();
    expect(screen.queryByText("Tarix ma'lumotlari topilmadi")).not.toBeInTheDocument();
  });
});
