import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import { CreateUserForm } from "./CreateUserForm";

beforeAll(() => {
  // jsdom da yo'q — ro'yxat ochilganda tanlangan bandga aylantiradi.
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
    createAdmin: vi.fn(),
    createManager: vi.fn(),
    createRegistrator: vi.fn(),
    createMarket: vi.fn(),
    createCourier: vi.fn(),
    useBranches: vi.fn(),
    navigate: vi.fn(),
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock("../../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    createAdmin: { mutateAsync: mocks.createAdmin, isPending: false },
    createManager: { mutateAsync: mocks.createManager, isPending: false },
    createRegistrator: { mutateAsync: mocks.createRegistrator, isPending: false },
    createMarket: { mutateAsync: mocks.createMarket, isPending: false },
    createCourier: { mutateAsync: mocks.createCourier, isPending: false },
  }),
}));

vi.mock("../../../../entities/branch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../entities/branch")>()),
  useBranches: mocks.useBranches,
}));

const superadminState = {
  role: { id: "1", role: "superadmin", region: null, name: "Superadmin" },
} as never;

/** Menejer profili: filial (ichma-ich `branch.branch`) va hudud — `readViewerBranch` o'qiydi. */
const managerState = (type: "REGIONAL" | "HYBRID") =>
  ({
    role: { id: "70", role: "manager", region: null, name: "Menejer" },
    user: {
      user: {
        id: "70",
        role: "manager",
        region: { id: "12", name: "Samarqand viloyati" },
        branch: { branch: { id: "44", name: "Urgut filiali", type, region_id: "12" } },
      },
      isAuthenticated: true,
      accessToken: null,
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;

type User = ReturnType<typeof userEvent.setup>;

const pickRole = async (user: User, name: string) => {
  // Dizayn v2: rol — radio-kartochkalar («Foydalanuvchi roli»), nomi «Rol + izoh».
  await user.click(screen.getByRole("radio", { name: new RegExp(`^${name}`) }));
};

const fill = async (user: User, container: HTMLElement, name: string, value: string) => {
  const input = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!input) throw new Error(`input not found: ${name}`);
  await user.type(input, value);
};

const save = (user: User) => user.click(screen.getByRole("button", { name: "Saqlash" }));

beforeEach(() => {
  for (const fn of [mocks.createAdmin, mocks.createManager, mocks.createRegistrator, mocks.createMarket, mocks.createCourier]) {
    fn.mockReset().mockResolvedValue({ statusCode: 201 });
  }
  mocks.navigate.mockReset();
  mocks.useBranches.mockReset().mockReturnValue({ data: { data: mocks.branches }, isLoading: false });
});

describe("CreateUserForm — sahifa (maket `superadmin-users-create`)", () => {
  it("sarlavha, rol kartasi (5 rol, izohlari bilan), izoh va forma kartasi", () => {
    renderWithProviders(<CreateUserForm />, { preloadedState: superadminState });

    expect(screen.getByRole("heading", { level: 1, name: "Yangi foydalanuvchi" })).toBeInTheDocument();
    expect(screen.getByText("Rolni tanlang va ma'lumotlarni kiriting · majburiy maydonlar * bilan")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Foydalanuvchilar" })).toHaveAttribute("href", "/all-users");
    const group = screen.getByRole("group", { name: "Foydalanuvchi roli" });
    expect(within(group).getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual([
      "admin",
      "manager",
      "registrator",
      "courier",
      "marketing",
    ]);
    expect(screen.getByRole("radio", { name: /^Kuryer/ })).toHaveAccessibleName("Kuryer Maosh yoki buyurtma tarifi");
    expect(screen.getByText("Kirish ma'lumotlarini o'zingiz bering")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Admin qo'shish" })).toBeInTheDocument();
  });

  it("superadmin uchun filiallar so'raladi", () => {
    renderWithProviders(<CreateUserForm />, { preloadedState: superadminState });
    expect(mocks.useBranches).toHaveBeenCalledWith({ page: 1, limit: 500 }, true);
  });
});

describe("CreateUserForm — filial ro'yxati rolga qarab", () => {
  it("menejerda HQ yo'q, registratorda HQ bor", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateUserForm />, { preloadedState: superadminState });

    await pickRole(user, "Menejer");
    await user.click(screen.getByRole("combobox", { name: "Filial" }));

    expect(screen.getByRole("option", { name: /Surxondaryo/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /HQ-TSHKNT/ })).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    await pickRole(user, "Ro'yxatchi");
    await user.click(screen.getByRole("combobox", { name: "Filial" }));

    expect(screen.getByRole("option", { name: /HQ-TSHKNT/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Surxondaryo/ })).toBeInTheDocument();
  });
});

describe("CreateUserForm — «To'lov kuni» 1–30 ro'yxati (ega qarori 2026-10-16)", () => {
  it("kalendar emas — «1» … «30» (31 yo'q); tanlangan kun API'ga avvalgidek son bo'lib ketadi", async () => {
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
    await save(user);

    await waitFor(() => expect(mocks.createAdmin).toHaveBeenCalledTimes(1));
    expect(mocks.createAdmin).toHaveBeenCalledWith({
      name: "Yangi Admin",
      phone_number: "+998901234567",
      password: "secret12",
      salary: 5000000,
      payment_day: 15,
    });
    expect(await screen.findByText("Admin yaratish")).toBeInTheDocument();
    expect(mocks.navigate).toHaveBeenCalledWith(-1);
  });

  it("kun tanlanmasa — xato, so'rov yuborilmaydi", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CreateUserForm />, { preloadedState: superadminState });
    await fill(user, container, "fullName", "Yangi Admin");
    await fill(user, container, "phone", "901234567");
    await fill(user, container, "password", "secret12");
    await fill(user, container, "salary", "5000000");
    await save(user);

    expect(await screen.findByText("Sana kiritilmadi")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "To'lov kuni" })).toHaveAttribute("aria-invalid", "true");
    expect(mocks.createAdmin).not.toHaveBeenCalled();
  });
});

describe("CreateUserForm — har rol payload'i", () => {
  it("menejer: filial, ixtiyoriy maosh va ikkala tarif", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CreateUserForm />, { preloadedState: superadminState });
    await pickRole(user, "Menejer");
    await fill(user, container, "fullName", "Menejer Bir");
    await fill(user, container, "phone", "901112233");
    await fill(user, container, "password", "secret12");
    await user.click(screen.getByRole("combobox", { name: "Filial" }));
    await user.click(screen.getByRole("option", { name: /Surxondaryo/ }));
    await fill(user, container, "homeRate", "10000");
    await fill(user, container, "centerRate", "8000");
    await save(user);

    await waitFor(() => expect(mocks.createManager).toHaveBeenCalledTimes(1));
    expect(mocks.createManager).toHaveBeenCalledWith({
      name: "Menejer Bir",
      phone_number: "+998901112233",
      password: "secret12",
      branch_id: "15",
      tariff_home: 10000,
      tariff_center: 8000,
    });
  });

  it("menejer: filialsiz yuborilmaydi", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CreateUserForm />, { preloadedState: superadminState });
    await pickRole(user, "Menejer");
    await fill(user, container, "fullName", "Menejer Bir");
    await fill(user, container, "phone", "901112233");
    await fill(user, container, "password", "secret12");
    await save(user);

    expect(await screen.findByText("Filial tanlang")).toBeInTheDocument();
    expect(mocks.createManager).not.toHaveBeenCalled();
  });

  it("ro'yxatchi: filial, maosh va to'lov kuni", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CreateUserForm />, { preloadedState: superadminState });
    await pickRole(user, "Ro'yxatchi");
    await fill(user, container, "fullName", "Ro'yxatchi Bir");
    await fill(user, container, "phone", "907778899");
    await fill(user, container, "password", "secret12");
    await user.click(screen.getByRole("combobox", { name: "Filial" }));
    await user.click(screen.getByRole("option", { name: /HQ-TSHKNT/ }));
    await fill(user, container, "salary", "3000000");
    await user.click(screen.getByRole("combobox", { name: "To'lov kuni" }));
    await user.click(screen.getByRole("option", { name: "5" }));
    await save(user);

    await waitFor(() => expect(mocks.createRegistrator).toHaveBeenCalledTimes(1));
    expect(mocks.createRegistrator).toHaveBeenCalledWith({
      name: "Ro'yxatchi Bir",
      phone_number: "+998907778899",
      password: "secret12",
      salary: 3000000,
      payment_day: 5,
      branch_id: "1",
    });
  });

  it("market: nom, login, parol, asosiy tarif «Markazgacha» → `center`", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CreateUserForm />, { preloadedState: superadminState });
    await pickRole(user, "Market");

    expect(screen.getByRole("form", { name: "Market qo'shish" })).toBeInTheDocument();
    expect(screen.getByText("Market o'z kabinetiga login va parol bilan kiradi")).toBeInTheDocument();
    await fill(user, container, "fullName", "Zarafshon Market");
    await fill(user, container, "phone", "934552017");
    await fill(user, container, "username", "zarafshon_market");
    await fill(user, container, "password", "zarafshon26");
    await user.click(screen.getByRole("radio", { name: "Markazgacha" }));
    await fill(user, container, "homeRate", "35000");
    await fill(user, container, "centerRate", "25000");
    await save(user);

    await waitFor(() => expect(mocks.createMarket).toHaveBeenCalledTimes(1));
    expect(mocks.createMarket).toHaveBeenCalledWith({
      name: "Zarafshon Market",
      phone_number: "+998934552017",
      username: "zarafshon_market",
      password: "zarafshon26",
      tariff_home: 35000,
      tariff_center: 25000,
      default_tariff: "center",
    });
  });

  it("market: asosiy tarif tanlanmasa — xato", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CreateUserForm />, { preloadedState: superadminState });
    await pickRole(user, "Market");
    await fill(user, container, "fullName", "Zarafshon Market");
    await fill(user, container, "phone", "934552017");
    await fill(user, container, "username", "zarafshon_market");
    await fill(user, container, "password", "zarafshon26");
    await fill(user, container, "homeRate", "35000");
    await fill(user, container, "centerRate", "25000");
    await save(user);

    expect(await screen.findByText("Tur tanlang")).toBeInTheDocument();
    expect(mocks.createMarket).not.toHaveBeenCalled();
  });

  it("backend maydon xatosi maydon ostida, sahifadan chiqilmaydi", async () => {
    mocks.createAdmin.mockRejectedValue({
      response: { status: 409, data: { message: "Telefon band", errors: { phone_number: "Bu raqam band" } } },
    });
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CreateUserForm />, { preloadedState: superadminState });
    await fill(user, container, "fullName", "Yangi Admin");
    await fill(user, container, "phone", "901234567");
    await fill(user, container, "password", "secret12");
    await fill(user, container, "salary", "5000000");
    await user.click(screen.getByRole("combobox", { name: "To'lov kuni" }));
    await user.click(screen.getByRole("option", { name: "1" }));
    await save(user);

    expect(await screen.findByText("Bu raqam band")).toBeInTheDocument();
    expect(await screen.findByText("Telefon band")).toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});

describe("CreateUserForm — menejer (maketlar `manager-users-create-courier`, `-hybrid`)", () => {
  it("REGIONAL: rol tanlanmaydi, «Biriktirish» kartasi; kuryer filial va hudud bilan yuboriladi; filiallar so'ralmaydi", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CreateUserForm />, { preloadedState: managerState("REGIONAL") });

    expect(mocks.useBranches).toHaveBeenCalledWith({ page: 1, limit: 500 }, false);
    expect(screen.queryByRole("group", { name: "Foydalanuvchi roli" })).not.toBeInTheDocument();
    expect(screen.getByText("Filialingiz uchun kuryer qo'shing · majburiy maydonlar * bilan")).toBeInTheDocument();
    expect(screen.getByText("Biriktirish")).toBeInTheDocument();
    expect(screen.getByText("Urgut filiali")).toBeInTheDocument();
    expect(screen.getByText("Samarqand viloyati")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Kuryer qo'shish" })).toBeInTheDocument();

    await fill(user, container, "fullName", "Azamat To'g'ayev");
    await fill(user, container, "phone", "946273051");
    await fill(user, container, "password", "urgut2026");
    await fill(user, container, "homeRate", "20000");
    await fill(user, container, "centerRate", "15000");
    await save(user);

    await waitFor(() => expect(mocks.createCourier).toHaveBeenCalledTimes(1));
    expect(mocks.createCourier).toHaveBeenCalledWith({
      name: "Azamat To'g'ayev",
      phone_number: "+998946273051",
      password: "urgut2026",
      branch_id: "44",
      region_id: "12",
      tariff_home: 20000,
      tariff_center: 15000,
    });
  });

  it("HYBRID: 3 rol (Kuryer, Ro'yxatchi, Market) va izoh; ro'yxatchi menejer filialiga, filial tanlovisiz", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CreateUserForm />, { preloadedState: managerState("HYBRID") });

    const group = screen.getByRole("group", { name: "Foydalanuvchi roli" });
    expect(within(group).getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual([
      "courier",
      "registrator",
      "marketing",
    ]);
    expect(screen.getByText("Kuryer va ro'yxatchi Urgut filialiga avtomatik biriktiriladi.")).toBeInTheDocument();

    await pickRole(user, "Ro'yxatchi");
    expect(screen.queryByRole("combobox", { name: "Filial" })).not.toBeInTheDocument();
    await fill(user, container, "fullName", "Kamola Rustamova");
    await fill(user, container, "phone", "938061952");
    await fill(user, container, "password", "secret12");
    await fill(user, container, "salary", "4200000");
    await user.click(screen.getByRole("combobox", { name: "To'lov kuni" }));
    await user.click(screen.getByRole("option", { name: "25" }));
    await save(user);

    await waitFor(() => expect(mocks.createRegistrator).toHaveBeenCalledTimes(1));
    expect(mocks.createRegistrator).toHaveBeenCalledWith(expect.objectContaining({ branch_id: "44", payment_day: 25 }));
  });
});
