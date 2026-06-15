import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import SettlementPage from "./index";
import { renderWithProviders } from "../../test/test-utils";

const apiPostMock = vi.fn();
const apiGetMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: {
    post: (...args: unknown[]) => apiPostMock(...args),
    get: (...args: unknown[]) => apiGetMock(...args),
  },
}));

describe("Settlement page", () => {
  beforeEach(() => {
    // Mirror the real backend response envelope for the FIFO settlement legs:
    // { statusCode, message, data: { settled_order_ids, allocated, leftover } }.
    apiPostMock.mockResolvedValue({
      data: {
        statusCode: 200,
        message: "Courier→branch settlement applied",
        data: {
          settled_order_ids: ["o1"],
          allocated: 50000,
          leftover: 0,
        },
      },
    });
    apiGetMock.mockResolvedValue({ data: { order_id: "o1", status: "AT_BRANCH" } });
  });

  it("renders the settlement header and all three legs", () => {
    renderWithProviders(<SettlementPage />);

    expect(screen.getByText("Hisob-kitob (COD settlement)")).toBeInTheDocument();
    expect(screen.getByText("Kuryer → Filial")).toBeInTheDocument();
    expect(screen.getByText("Filial → HQ")).toBeInTheDocument();
    expect(screen.getByText("HQ → Market")).toBeInTheDocument();
  });

  it("posts a courier→branch lump sum and renders the FIFO allocation", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettlementPage />);

    await user.type(screen.getByLabelText("c2b-courier"), "courier-1");
    await user.type(screen.getByLabelText("c2b-branch"), "branch-1");
    await user.type(screen.getByLabelText("c2b-amount"), "50000");

    const submitButtons = screen.getAllByRole("button", {
      name: "Hisob-kitobni yuborish",
    });
    await user.click(submitButtons[0]); // leg 1 = courier → branch

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith(
        "orders/settlement/courier-to-branch",
        expect.objectContaining({
          courier_id: "courier-1",
          branch_id: "branch-1",
          amount: 50000,
        }),
      ),
    );

    expect(await screen.findByText("Hisob-kitob qabul qilindi")).toBeInTheDocument();
    expect(await screen.findByText("o1")).toBeInTheDocument();
  });

  it("looks up a per-order settlement state via GET", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettlementPage />);

    await user.type(screen.getByLabelText("lookup-order"), "o1");
    await user.click(screen.getByRole("button", { name: "Tekshirish" }));

    await waitFor(() =>
      expect(apiGetMock).toHaveBeenCalledWith("orders/o1/settlement"),
    );
    expect(await screen.findByText(/AT_BRANCH/)).toBeInTheDocument();
  });
});
