import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { vi } from "vitest";
import Payments from "./index";
import { renderWithProviders } from "../../test/test-utils";

/**
 * ⚠️ `MemoryRouter` brauzer manzilini o'zgartirmaydi — URL holati router'ning
 * o'zidan (`useLocation`) o'qiladi, `window.location`dan emas.
 */
const LocationProbe = () => {
  const { search } = useLocation();
  return <span data-testid="search">{search}</span>;
};

const getFinanceHistoryMock = vi.fn((params: unknown) => {
  void params;
  return {
    data: { data: { items: [], pagination: { total: 0, page: 1, limit: 10 } } },
    isLoading: false,
  };
});

vi.mock("../../entities/payments", () => ({
  useCashBox: () => ({
    useGetCashBoxInfo: () => ({ data: { data: {} }, isLoading: false }),
    useGetFinanceHistory: (params: unknown) => getFinanceHistoryMock(params),
  }),
}));

vi.mock("../../entities/payments/financeCoverage", () => ({
  useFinanceCoverage: () => ({
    useGetManagerSettlement: () => ({ data: undefined }),
    useGetManagerPayableToHq: () => ({ data: undefined }),
  }),
}));

vi.mock("../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetUser: () => ({ data: { data: { items: [] } }, isLoading: false }),
    useGetManagers: () => ({ data: { data: [] }, isLoading: false }),
    useGetCouriers: () => ({ data: { data: [] }, isLoading: false }),
  }),
}));

vi.mock("../../entities/markets", () => ({
  useMarkets: () => ({
    useGetMarkets: () => ({ data: { data: [] }, isLoading: false }),
  }),
}));

vi.mock("./components/patmentHistoryTable", () => ({
  default: () => <div data-testid="payment-history-table" />,
}));

vi.mock("../../shared/components/popupSelect", () => ({
  default: () => null,
}));

describe("Payments filters", () => {
  // jsdom does not implement scrollIntoView; FilterSelect calls it when its
  // dropdown opens. Pre-existing gap, unrelated to this fix — stub locally.
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });


  const open = (route = "/payments") =>
    renderWithProviders(
      <>
        <Payments />
        <LocationProbe />
      </>,
      { route },
    );

  const currentSearch = () => screen.getByTestId("search").textContent ?? "";

  beforeEach(() => {
    getFinanceHistoryMock.mockClear();
  });

  it("restores the operation_type filter from the URL after a refresh", async () => {
    open("/payments?operation_type=income");

    await waitFor(() => {
      expect(getFinanceHistoryMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ operation_type: "income" }),
      );
    });
  });

  it("does not reset the saved page while restoring a filter from the URL", async () => {
    open("/payments?operation_type=income&paymentsPage=4");

    await waitFor(() => {
      expect(getFinanceHistoryMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ operation_type: "income", page: 4 }),
      );
    });
  });

  it("writes the selected filter to the URL immediately, so a refresh keeps it", async () => {
    const user = userEvent.setup();
    open("/payments");

    await user.click(screen.getByLabelText("Operatsiya turi"));
    const incomeOption = await screen.findByRole("option", { name: "Kirim" });
    await user.click(incomeOption);

    await waitFor(() => expect(currentSearch()).toContain("operation_type=income"));
  });
});
