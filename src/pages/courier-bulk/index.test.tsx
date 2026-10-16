import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CourierBulkPage from "./index";
import { renderWithProviders } from "../../test/test-utils";

/**
 * «Kunni yakunlash» — tasdiqlash oynasi orqali (DESIGN_SYSTEM §8, maket `courier-courier-bulk-confirm-dialog`):
 * oyna nima bo'lishini sanab beradi, «Orqaga» — hech narsa yuborilmaydi, «Tasdiqlash» — buyurtmalar yakunlanadi.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn(), sell: vi.fn(), cancel: vi.fn() }));

vi.mock("../../shared/api/api", () => ({ api: { get: mocks.get } }));

vi.mock("../../entities/orders", () => ({
  useOrders: () => ({
    SellOrder: { mutateAsync: mocks.sell, isPending: false },
    CancelOrder: { mutateAsync: mocks.cancel, isPending: false },
  }),
}));

const order = (id: string, name: string) => ({
  id,
  status: "waiting",
  total_price: 100000,
  customer: { name, phone_number: "+998901112233" },
  market: { name: "Baraka Shop" },
});

describe("CourierBulkPage — «Kunni yakunlash»", () => {
  beforeEach(() => {
    mocks.get.mockResolvedValue({
      data: { statusCode: 200, data: { data: [order("10", "Ali"), order("11", "Vali")], total: 2 } },
    });
    mocks.sell.mockResolvedValue({});
    mocks.cancel.mockResolvedValue({});
  });

  it("asks for confirmation; «Orqaga» sends nothing", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    await user.click(await screen.findByRole("button", { name: /Kunni yakunlash/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Kunni yakunlashni tasdiqlang" });
    expect(dialog).toHaveTextContent("2 ta buyurtma: quyidagilar bajariladi");
    expect(dialog).toHaveTextContent("2 ta sotilgan deb belgilanadi");
    expect(dialog).toHaveTextContent("Bu amalni ortga qaytarib bo'lmaydi: 2 ta buyurtma holati darhol o'zgaradi.");

    await user.click(within(dialog).getByRole("button", { name: "Orqaga" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mocks.sell).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
  });

  it("«Tasdiqlash» finalizes the orders", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    await user.click(await screen.findByRole("button", { name: /Kunni yakunlash/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Kunni yakunlashni tasdiqlang" });
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => expect(mocks.sell).toHaveBeenCalledTimes(2));
    expect(mocks.sell).toHaveBeenCalledWith(expect.objectContaining({ orderId: "10" }));
    expect(await screen.findByText("Kun yakunlandi")).toBeInTheDocument();
  });
});
