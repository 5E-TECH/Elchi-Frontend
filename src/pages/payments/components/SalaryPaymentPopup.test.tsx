import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SalaryPaymentPopup from "./SalaryPaymentPopup";
import { renderWithProviders } from "../../../test/test-utils";

/** Maosh to'lash — pul kassadan chiqadi, shuning uchun tasdiqlash oynasi orqali (DESIGN_SYSTEM §8). */

const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock("../../../entities/payments/financeCoverage", () => ({
  useFinanceCoverage: () => ({
    createSalary: { mutate: mocks.mutate, isPending: false },
    useGetSalaryByUser: () => ({ data: [], isLoading: false }),
  }),
}));

const employee = { id: "u1", name: "Jasur Tursunov", role: "courier", salary: 3000000 };

describe("SalaryPaymentPopup", () => {
  beforeEach(() => mocks.mutate.mockReset());

  it("shows a payment confirmation (amount, from → to) before paying", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SalaryPaymentPopup employee={employee} isOpen onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Maosh to'lash" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Maosh to'lovini tasdiqlang" });
    expect(dialog).toHaveTextContent("Asosiy kassa");
    expect(dialog).toHaveTextContent("Jasur Tursunov");
    expect(dialog).toHaveTextContent("Naqd");
    expect(mocks.mutate).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mocks.mutate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Maosh to'lash" }));
    const again = await screen.findByRole("alertdialog", { name: "Maosh to'lovini tasdiqlang" });
    await user.click(within(again).getByRole("button", { name: "Maosh to'lash" }));

    expect(mocks.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u1", amount: 3000000, type: "cash" }),
      expect.any(Object),
    );
  });
});
