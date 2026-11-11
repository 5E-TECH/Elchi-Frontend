import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import type { Branch } from "../../../entities/branch";
import BranchCashboxDebtCard from "./BranchCashboxDebtCard";

const mocks = vi.hoisted(() => ({ patch: vi.fn() }));

vi.mock("../../../shared/api/instance", () => ({
  api: { patch: mocks.patch },
}));

const makeBranch = (extra: Partial<Branch> = {}): Branch => ({
  id: "15",
  name: "Namangan",
  type: "REGIONAL",
  region: { id: "1", name: "Namangan" },
  district: { id: "2", name: "Chust" },
  address: "—",
  status: "active",
  employees_count: 3,
  created_at: "2026-10-01",
  cashbox_debt_enabled: false,
  ...extra,
});

const stateFor = (role: string) =>
  ({ role: { id: `${role}-1`, role, region: null, name: role } }) as never;

describe("Filial tafsiloti — «Kassa qarzga ishlaydi» kaliti", () => {
  beforeEach(() => {
    mocks.patch.mockReset();
    mocks.patch.mockResolvedValue({ data: { data: {} } });
  });

  it("superadmin: sukut o'chiq — yoqadi (PATCH /branches/15 { cashbox_debt_enabled: true })", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BranchCashboxDebtCard branch={makeBranch()} />, {
      preloadedState: stateFor("superadmin"),
    });

    expect(screen.getByRole("heading", { name: "Kassa sozlamalari" })).toBeInTheDocument();
    const toggle = screen.getByRole("switch", { name: "Kassa qarzga ishlaydi" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await user.click(toggle);

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith(expect.stringMatching(/branches\/15$/), {
        cashbox_debt_enabled: true,
      }),
    );
    expect(await screen.findByText("Filial kassasi qarzga ishlashi yoqildi")).toBeInTheDocument();
  });

  it("admin: yoqiq — o'chiradi", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <BranchCashboxDebtCard branch={makeBranch({ cashbox_debt_enabled: true })} />,
      {
        preloadedState: stateFor("admin"),
      },
    );

    const toggle = screen.getByRole("switch", { name: "Kassa qarzga ishlaydi" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await user.click(toggle);
    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith(expect.stringMatching(/branches\/15$/), {
        cashbox_debt_enabled: false,
      }),
    );
    expect(
      await screen.findByText("Filial kassasi qarzga ishlashi o'chirildi"),
    ).toBeInTheDocument();
  });

  it("backend xatosi — xabar chiqadi, kalit o'zgarmaydi", async () => {
    const user = userEvent.setup();
    mocks.patch.mockRejectedValue({ response: { status: 403, data: { message: "Ruxsat yo'q" } } });
    renderWithProviders(<BranchCashboxDebtCard branch={makeBranch()} />, {
      preloadedState: stateFor("superadmin"),
    });

    await user.click(screen.getByRole("switch", { name: "Kassa qarzga ishlaydi" }));
    expect(await screen.findByText("Sozlamani saqlab bo'lmadi")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Kassa qarzga ishlaydi" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it.each([
    ["HQ filial", makeBranch({ type: "HQ" }), "superadmin"],
    ["menejer", makeBranch(), "manager"],
  ])("%s — kalit ko'rinmaydi", (_label, branch, role) => {
    renderWithProviders(<BranchCashboxDebtCard branch={branch} />, {
      preloadedState: stateFor(role),
    });
    expect(screen.queryByRole("switch", { name: "Kassa qarzga ishlaydi" })).not.toBeInTheDocument();
  });
});
