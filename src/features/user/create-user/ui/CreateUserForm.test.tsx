import { screen, waitFor, within } from "@testing-library/react";
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
    createAdmin: vi.fn(),
  };
});

vi.mock("../../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    createAdmin: { mutateAsync: mocks.createAdmin, isPending: false },
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
  // v2 `Select searchable`: maydon — `Field` yorlig'i ("Filial") bilan nomlangan combobox.
  await user.click(screen.getByRole("combobox", { name: "Filial" }));
};

describe("CreateUserForm — filial ro'yxati rolga qarab", () => {
  it("menejerda HQ yo'q, registratorda HQ bor", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateUserForm />, { preloadedState: superadminState });

    await pickRole(user, "Admin", "Menejer");
    await openBranchSelect(user);

    expect(screen.getByRole("option", { name: /Surxondaryo/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /HQ-TSHKNT/ })).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    await pickRole(user, "Menejer", "Ro'yxatchi");
    await openBranchSelect(user);

    expect(screen.getByRole("option", { name: /HQ-TSHKNT/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Surxondaryo/ })).toBeInTheDocument();
  });
});

describe("CreateUserForm — «To'lov kuni» 1–30 ro'yxati (ega qarori 2026-10-16)", () => {
  const fill = async (user: ReturnType<typeof userEvent.setup>, container: HTMLElement, name: string, value: string) => {
    const input = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
    if (!input) throw new Error(`input not found: ${name}`);
    await user.type(input, value);
  };

  it("kalendar emas — «1» … «30» (31 yo'q); tanlangan kun API'ga avvalgidek son bo'lib ketadi", async () => {
    mocks.createAdmin.mockReset().mockResolvedValue({ statusCode: 201 });
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CreateUserForm />, { preloadedState: superadminState });

    const day = screen.getByRole("combobox", { name: "To'lov kuni" });
    expect(day).toHaveAttribute("aria-haspopup", "listbox");
    expect(day).toHaveTextContent("To'lov kunini tanlang");
    await user.click(day);
    const list = screen.getByRole("listbox", { name: "To'lov kuni" });
    const labels = within(list).getAllByRole("option").map((option) => option.textContent);
    expect(labels).toHaveLength(30);
    expect(labels[0]).toBe("1");
    expect(labels[29]).toBe("30");
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "15" }));
    expect(day).toHaveTextContent("15");

    await fill(user, container, "fullName", "Yangi Admin");
    await fill(user, container, "phone", "901234567");
    await fill(user, container, "password", "secret12");
    await fill(user, container, "salary", "5000000");
    await user.click(screen.getByRole("button", { name: /Saqlash/ }));

    await waitFor(() => expect(mocks.createAdmin).toHaveBeenCalledTimes(1));
    expect(mocks.createAdmin).toHaveBeenCalledWith(expect.objectContaining({ salary: 5000000, payment_day: 15 }));
  });

  it("kun tanlanmasa — xato, so'rov yuborilmaydi", async () => {
    mocks.createAdmin.mockReset();
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CreateUserForm />, { preloadedState: superadminState });
    await fill(user, container, "fullName", "Yangi Admin");
    await fill(user, container, "phone", "901234567");
    await fill(user, container, "password", "secret12");
    await fill(user, container, "salary", "5000000");
    await user.click(screen.getByRole("button", { name: /Saqlash/ }));

    expect(await screen.findByText("Sana kiritilmadi")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "To'lov kuni" })).toHaveAttribute("aria-invalid", "true");
    expect(mocks.createAdmin).not.toHaveBeenCalled();
  });
});
