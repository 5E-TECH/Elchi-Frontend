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

// antd sahifasi jsdom'da har bir yangilanishda ~0.5 s qayta chiziladi —
// shu sabab maydonlar harfma-harf emas, paste bilan to'ldiriladi (tekshirilayotgani
// so'rov tanasi), to'lov oqimiga esa yuklama ostida ham yetadigan limit berilgan.
const PAYOUT_FLOW_TIMEOUT_MS = 20_000;

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

    await user.click(screen.getByLabelText("operator-id"));
    await user.paste("op1");
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

    await user.click(screen.getByLabelText("operator-id"));
    await user.paste("op1");
    await user.click(screen.getByRole("button", { name: /Yuklash/ }));

    await user.click(await screen.findByLabelText("payout-amount"));
    await user.paste("50000");
    await user.click(screen.getByLabelText("payout-comment"));
    await user.paste("oylik avans");
    await user.click(screen.getByRole("button", { name: "To'lovni saqlash" }));

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith(
        "finance/operator-payments",
        expect.objectContaining({ operator_id: "op1", amount: 50000 }),
      ),
    );
    expect(await screen.findByText("To'lov qayd qilindi")).toBeInTheDocument();
  }, PAYOUT_FLOW_TIMEOUT_MS);
});
