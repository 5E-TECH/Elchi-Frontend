import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import type { Employee } from "../../../entities/branch";
import BranchEmployeesSection from "./BranchEmployeesSection";

vi.mock("../../../features/branch-remove-employee", () => ({
  RemoveEmployeeButton: ({ userId }: { userId: string }) => (
    <button type="button" data-testid={`remove-${userId}`}>
      remove
    </button>
  ),
}));

vi.mock("../../../features/courier-transfer-branch", () => ({
  TransferCourierButton: ({
    courierId,
    courierName,
    variant,
  }: {
    courierId: string;
    courierName?: string;
    variant: string;
  }) => (
    <button type="button" data-testid={`transfer-${courierId}`} data-variant={variant}>
      {courierName}
    </button>
  ),
}));

const employee = (id: string, fullName: string, position: string): Employee => ({
  id: `row-${id}`,
  user: { id, fullName, phone: "+998900000000" },
  position,
  joined_at: "2026-09-30T00:00:00.000Z",
});

describe("BranchEmployeesSection — kuryer qatori: chiqarish yo'q, faqat o'tkazish", () => {
  it("kuryer qatorida o'chirish tugmasi yo'q, o'rniga o'tkazish tugmasi bor", () => {
    renderWithProviders(
      <BranchEmployeesSection
        branchId="15"
        data={[
          employee("209", "Filial kuryeri", "COURIER"),
          employee("210", "Filial registratori", "REGISTRATOR"),
          employee("211", "Filial menejeri", "MANAGER"),
        ]}
      />,
    );

    expect(screen.getAllByText("Filial kuryeri").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("remove-209")).not.toBeInTheDocument();
    const transfer = screen.getByTestId("transfer-209");
    expect(transfer).toHaveAttribute("data-variant", "row");
    expect(transfer).toHaveTextContent("Filial kuryeri");
  });

  it("registrator va menejer qatorlarida o'chirish tugmasi qoladi, o'tkazish yo'q", () => {
    renderWithProviders(
      <BranchEmployeesSection
        branchId="15"
        data={[
          employee("209", "Filial kuryeri", "COURIER"),
          employee("210", "Filial registratori", "REGISTRATOR"),
          employee("211", "Filial menejeri", "MANAGER"),
        ]}
      />,
    );

    expect(screen.getByTestId("remove-210")).toBeInTheDocument();
    expect(screen.getByTestId("remove-211")).toBeInTheDocument();
    expect(screen.queryByTestId("transfer-210")).not.toBeInTheDocument();
    expect(screen.queryByTestId("transfer-211")).not.toBeInTheDocument();
  });

  it("rol kichik harfda kelsa ham kuryer taniladi", () => {
    renderWithProviders(
      <BranchEmployeesSection branchId="1" data={[employee("263", "HQ kuryeri", "courier")]} />,
    );

    expect(screen.getAllByText("HQ kuryeri").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("remove-263")).not.toBeInTheDocument();
    expect(screen.getByTestId("transfer-263")).toBeInTheDocument();
  });
});
