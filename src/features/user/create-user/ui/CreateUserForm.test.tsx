import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import { CreateUserForm } from "./CreateUserForm";

beforeAll(() => {
  // jsdom da yo'q — SearchableSelect ochilganda tanlangan bandga aylantiradi.
  Element.prototype.scrollIntoView = vi.fn();
});

const mocks = vi.hoisted(() => {
  const base = {
    region: { id: "", name: "—" },
    district: { id: "", name: "—" },
    address: "—",
    status: "active" as const,
    employees_count: 0,
    created_at: "2026-10-01T00:00:00.000Z",
  };

  return {
    branches: [
      { ...base, id: "1", name: "Bosh ofis", code: "HQ-TSHKNT", type: "HQ" as const, level: 0 },
      { ...base, id: "15", name: "Surxondaryo", code: "SRX", type: "REGIONAL" as const, level: 1 },
    ],
    mutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  };
});

vi.mock("../../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    createAdmin: mocks.mutation(),
    createManager: mocks.mutation(),
    createRegistrator: mocks.mutation(),
    createMarket: mocks.mutation(),
    createCourier: mocks.mutation(),
  }),
}));

vi.mock("../../../../entities/branch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../entities/branch")>()),
  useBranches: () => ({ data: { data: mocks.branches }, isLoading: false }),
}));

const superadminState = {
  role: { id: "1", role: "superadmin", region: null, name: "Superadmin" },
} as never;

const pickRole = async (user: ReturnType<typeof userEvent.setup>, from: string, to: string) => {
  // jsdom kengligi 1024px — ixcham rol tanlagich ishlaydi.
  await user.click(screen.getByRole("button", { name: from }));
  await user.click(screen.getByRole("button", { name: to }));
};

const openBranchSelect = async (user: ReturnType<typeof userEvent.setup>) => {
  // Trigger nomi `<label htmlFor="branchId">` dan olinadi — "Filial".
  await user.click(screen.getByRole("button", { name: "Filial" }));
};

describe("CreateUserForm — filial ro'yxati rolga qarab", () => {
  it("menejerda HQ yo'q, registratorda HQ bor", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateUserForm />, { preloadedState: superadminState });

    await pickRole(user, "Admin", "Menejer");
    await openBranchSelect(user);

    expect(screen.getByRole("button", { name: /Surxondaryo/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /HQ-TSHKNT/ })).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    await pickRole(user, "Menejer", "Ro'yxatchi");
    await openBranchSelect(user);

    expect(screen.getByRole("button", { name: /HQ-TSHKNT/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Surxondaryo/ })).toBeInTheDocument();
  });
});
