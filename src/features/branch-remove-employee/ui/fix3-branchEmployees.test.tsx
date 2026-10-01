import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import RemoveEmployeeButton from "./RemoveEmployeeButton";
import AddEmployeeModal from "../../branch-add-employee/ui/AddEmployeeModal";

/**
 * fix3 CODE-21 — filial xodimlari:
 *   - olib tashlash rad etilsa sabab ko'rinadi (avval jimgina yutilardi);
 *   - qo'shish oynasi faqat filialga biriktiriladigan rollarni so'raydi
 *     (avval admin/operator — backend ularni doim rad etardi).
 */

const mocks = vi.hoisted(() => ({
  removeMutateAsync: vi.fn(),
  useUsers: vi.fn(),
}));

vi.mock("../api/useRemoveEmployee", () => ({
  useRemoveEmployee: () => ({ mutateAsync: mocks.removeMutateAsync, isPending: false }),
}));

vi.mock("../../branch-add-employee/api/useAddEmployee", () => ({
  useAddEmployee: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("../../../entities/user", () => ({
  useUsers: (params: unknown) => {
    mocks.useUsers(params);
    return { data: [] };
  },
}));

const httpError = (status: number, message: string) =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data: { statusCode: status, message },
  } as AxiosResponse);

describe("RemoveEmployeeButton (fix3 CODE-21)", () => {
  beforeEach(() => {
    mocks.removeMutateAsync.mockReset();
  });

  it("backend rad etsa — sabab ko'rinadi", async () => {
    const user = userEvent.setup();
    mocks.removeMutateAsync.mockRejectedValue(
      httpError(409, "Kuryerni filialdan chiqarib bo'lmaydi: qo'lida pul bor"),
    );
    renderWithProviders(<RemoveEmployeeButton branchId="15" userId="56" />);

    await user.click(screen.getByRole("button", { name: "Olib tashlash" }));
    await user.click(await screen.findByRole("button", { name: "Tasdiqlash" }));

    expect(mocks.removeMutateAsync).toHaveBeenCalledWith("56");
    expect(
      await screen.findByText("Kuryerni filialdan chiqarib bo'lmaydi: qo'lida pul bor"),
    ).toBeInTheDocument();
  });
});

describe("AddEmployeeModal (fix3 CODE-21)", () => {
  it("faqat manager/registrator/courier foydalanuvchilarini so'raydi", () => {
    renderWithProviders(<AddEmployeeModal branchId="15" open onClose={vi.fn()} />);

    expect(mocks.useUsers).toHaveBeenCalledWith(
      expect.objectContaining({ role: ["manager", "registrator", "courier"], enabled: true }),
    );
  });
});
