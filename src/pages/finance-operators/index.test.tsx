import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import FinanceOperatorsPage from "./index";
import { renderWithProviders } from "../../test/test-utils";

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}));

describe("Finance operators page", () => {
  beforeEach(() => {
    apiGetMock.mockImplementation((url: string) => {
      if (url.endsWith("/balance"))
        return Promise.resolve({ data: { earned: 300000, paid: 100000, balance: 200000 } });
      if (url.endsWith("/earnings"))
        return Promise.resolve({ data: [{ order_id: "o1", amount: 5000 }] });
      if (url.endsWith("/payments"))
        return Promise.resolve({ data: [{ amount: 100000, comment: "avans" }] });
      return Promise.resolve({ data: {} });
    });
    apiPostMock.mockResolvedValue({ data: { id: "pay1" } });
  });

  it("renders the operator finance header", () => {
    renderWithProviders(<FinanceOperatorsPage />);
    expect(screen.getByText("Operator hisob-kitobi")).toBeInTheDocument();
  });

  it("loads an operator's balance summary via GET", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FinanceOperatorsPage />);

    await user.type(screen.getByLabelText("operator-id"), "op1");
    await user.click(screen.getByRole("button", { name: /Yuklash/ }));

    await waitFor(() =>
      expect(apiGetMock).toHaveBeenCalledWith("finance/operators/op1/balance"),
    );
    expect(await screen.findByText("Qoldiq")).toBeInTheDocument();
    expect(await screen.findByText("Ishlab topgan")).toBeInTheDocument();
  });

  it("records an operator payout via POST", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FinanceOperatorsPage />);

    await user.type(screen.getByLabelText("operator-id"), "op1");
    await user.click(screen.getByRole("button", { name: /Yuklash/ }));

    await user.type(await screen.findByLabelText("payout-amount"), "50000");
    await user.type(screen.getByLabelText("payout-comment"), "oylik avans");
    await user.click(screen.getByRole("button", { name: "To'lovni saqlash" }));

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith(
        "finance/operator-payments",
        expect.objectContaining({ operator_id: "op1", amount: 50000 }),
      ),
    );
    expect(await screen.findByText("To'lov qayd qilindi")).toBeInTheDocument();
  });
});
