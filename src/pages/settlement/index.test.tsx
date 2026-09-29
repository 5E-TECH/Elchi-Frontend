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
    await user.click(await screen.findByRole("button", { name: "Ha, yuborish" }));

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith(
        "orders/settlement/courier-to-branch",
        expect.objectContaining({
          courier_id: "courier-1",
          branch_id: "branch-1",
          amount: 50000,
        }),
        expect.objectContaining({ headers: { "Idempotency-Key": expect.any(String) } }),
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

  const fillLeg2 = async (user: ReturnType<typeof userEvent.setup>, branch = "12", amount = "1250000") => {
    if (branch) await user.type(screen.getByLabelText("b2h-branch"), branch);
    if (amount) await user.type(screen.getByLabelText("b2h-amount"), amount);
  };
  const leg2Button = () => screen.getAllByRole("button", { name: "Hisob-kitobni yuborish" })[1];

  it("shows the server's reason when the branch → HQ leg is rejected (it was silent before)", async () => {
    const user = userEvent.setup();
    apiPostMock.mockRejectedValue(
      Object.assign(new Error("Bad Request"), { isAxiosError: true, response: { status: 400, data: { message: "branch_id should not be empty" } } }),
    );
    renderWithProviders(<SettlementPage />);
    await fillLeg2(user);

    await user.click(leg2Button());
    await user.click(await screen.findByRole("button", { name: "Ha, yuborish" }));

    expect(await screen.findByText("Hisob-kitob yuborilmadi")).toBeInTheDocument();
    expect(screen.getByText("branch_id should not be empty")).toBeInTheDocument();
  });

  it("keeps the send button disabled and posts nothing without an ID or with amount <= 0", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettlementPage />);

    expect(leg2Button()).toBeDisabled();
    await fillLeg2(user, "12", "0");
    expect(leg2Button()).toBeDisabled();
    await user.clear(screen.getByLabelText("b2h-amount"));
    await user.type(screen.getByLabelText("b2h-amount"), "-5");
    expect(leg2Button()).toBeDisabled();
    await user.clear(screen.getByLabelText("b2h-branch"));
    await user.clear(screen.getByLabelText("b2h-amount"));
    await user.type(screen.getByLabelText("b2h-amount"), "1000");
    expect(leg2Button()).toBeDisabled();

    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("shows the amount and recipient in the confirmation and sends nothing on \"Bekor qilish\"", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettlementPage />);
    await fillLeg2(user);

    await user.click(leg2Button());
    expect(await screen.findByText(/1\s?250\s?000 so'm → Filial #12 → HQ\. Tasdiqlaysizmi\?/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Bekor qilish" }));

    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("reuses one idempotency key for retries and starts a new one after success", async () => {
    const user = userEvent.setup();
    apiPostMock.mockRejectedValueOnce(Object.assign(new Error("Timeout"), { isAxiosError: true, code: "ECONNABORTED" }));
    renderWithProviders(<SettlementPage />);
    await fillLeg2(user);

    await user.click(leg2Button());
    await user.click(await screen.findByRole("button", { name: "Ha, yuborish" }));
    // Javobsiz — natija noma'lum.
    expect(await screen.findByText("Natija noma'lum — qayta yubormang")).toBeInTheDocument();

    await user.click(leg2Button());
    await user.click((await screen.findAllByRole("button", { name: "Ha, yuborish" })).at(-1)!);
    await waitFor(() => expect(apiPostMock).toHaveBeenCalledTimes(2));
    await screen.findByText("Hisob-kitob qabul qilindi");

    await user.click(leg2Button());
    await user.click((await screen.findAllByRole("button", { name: "Ha, yuborish" })).at(-1)!);
    await waitFor(() => expect(apiPostMock).toHaveBeenCalledTimes(3));

    const keys = apiPostMock.mock.calls.map((call) => (call[2] as { headers: Record<string, string> }).headers["Idempotency-Key"]);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[1]);
  });
});
