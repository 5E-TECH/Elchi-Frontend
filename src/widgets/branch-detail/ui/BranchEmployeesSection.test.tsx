import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import type { Employee } from "../../../entities/branch";
import BranchEmployeesSection from "./BranchEmployeesSection";

/**
 * «Filial xodimlari» (dizayn v2, haqiqiy tugmalar bilan): kuryer qatorida faqat «Boshqa filialga o'tkazish»,
 * menejer/ro'yxatchida — «Olib tashlash» (tasdiq oynasi orqali `DELETE /branches/:id/users/:userId`).
 */
const api = vi.hoisted(() => ({ get: vi.fn(), delete: vi.fn() }));
vi.mock("../../../shared/api/instance", () => ({ api }));

const employee = (id: string, fullName: string, position: string): Employee => ({
  id: `row-${id}`,
  user: { id, fullName, phone: "+998915123407" },
  position,
  joined_at: "2026-09-30T12:00:00.000Z",
});

const ROWS = [
  employee("209", "Filial kuryeri", "COURIER"),
  employee("210", "Filial registratori", "REGISTRATOR"),
  employee("211", "Filial menejeri", "MANAGER"),
];

const asRole = (role: string) => ({ preloadedState: { role: { id: "1", role, region: null, name: role } } as never });

describe("BranchEmployeesSection — kuryer qatori: chiqarish yo'q, faqat o'tkazish", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.delete.mockReset();
  });

  it("kuryer qatorida olib tashlash tugmasi yo'q, o'rniga o'tkazish tugmasi bor (superadmin)", () => {
    renderWithProviders(<BranchEmployeesSection branchId="15" query={{ data: ROWS }} />, asRole("superadmin"));

    expect(screen.getByText("Filial kuryeri")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Filial kuryerini filialdan olib tashlash" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filial kuryerini boshqa filialga o'tkazish" })).toHaveTextContent(
      "Boshqa filialga o'tkazish",
    );
  });

  it("registrator va menejer qatorlarida olib tashlash tugmasi qoladi, o'tkazish yo'q", () => {
    renderWithProviders(<BranchEmployeesSection branchId="15" query={{ data: ROWS }} />, asRole("superadmin"));

    expect(screen.getByRole("button", { name: "Filial registratorini filialdan olib tashlash" })).toHaveTextContent(
      "Olib tashlash",
    );
    expect(screen.getByRole("button", { name: "Filial menejerini filialdan olib tashlash" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /boshqa filialga o'tkazish/ })).toHaveLength(1);
  });

  it("rol kichik harfda kelsa ham kuryer taniladi; lavozim nomi o'zbekcha", () => {
    renderWithProviders(
      <BranchEmployeesSection branchId="1" query={{ data: [employee("263", "HQ kuryeri", "courier")] }} />,
      asRole("admin"),
    );

    expect(screen.queryByRole("button", { name: /filialdan olib tashlash/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "HQ kuryerini boshqa filialga o'tkazish" })).toBeInTheDocument();
    expect(screen.getByText("Kuryer")).toBeInTheDocument();
  });

  it("jadval: lavozim badge'lari, telefon «+998 91 512 34 07», qo'shilgan sana «30.09.2026»", () => {
    renderWithProviders(<BranchEmployeesSection branchId="15" query={{ data: ROWS }} />, asRole("superadmin"));

    const table = screen.getByRole("table", { name: "Filial xodimlari" });
    expect(within(table).getByText("Ro'yxatchi")).toBeInTheDocument();
    expect(within(table).getByText("Menejer")).toBeInTheDocument();
    expect(within(table).getAllByText("+998 91 512 34 07")).toHaveLength(3);
    expect(within(table).getAllByText("30.09.2026")).toHaveLength(3);
  });

  it("⭐ olib tashlash — tasdiq oynasidan keyin DELETE va xabar; bekor qilinsa so'rov yo'q", async () => {
    const user = userEvent.setup();
    api.delete.mockResolvedValue({ data: { statusCode: 200 } });
    renderWithProviders(<BranchEmployeesSection branchId="15" query={{ data: ROWS }} />, asRole("superadmin"));

    await user.click(screen.getByRole("button", { name: "Filial registratorini filialdan olib tashlash" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Filial registratorini filialdan olib tashlash?" });
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(api.delete).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Filial registratorini filialdan olib tashlash" }));
    const again = await screen.findByRole("alertdialog", { name: "Filial registratorini filialdan olib tashlash?" });
    await user.click(within(again).getByRole("button", { name: "Olib tashlash" }));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("branches/15/users/210"));
    expect(await screen.findByText("Xodim olib tashlandi")).toBeInTheDocument();
  });

  it("bo'sh ro'yxat — «Filialga hali xodim biriktirilmagan»", () => {
    renderWithProviders(<BranchEmployeesSection branchId="15" query={{ data: [] }} />, asRole("superadmin"));

    expect(screen.getByText("Filialga hali xodim biriktirilmagan")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("xato — «Xodimlarni yuklab bo'lmadi» + «Qayta urinish» (refetch)", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    renderWithProviders(
      <BranchEmployeesSection
        branchId="15"
        query={{ data: undefined, isError: true, error: new Error("boom"), refetch }}
      />,
      asRole("superadmin"),
    );

    expect(screen.getByText("Xodimlarni yuklab bo'lmadi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
