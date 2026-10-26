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
    createLogist: vi.fn(),
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
    createLogist: { mutateAsync: mocks.createLogist, isPending: false },
  }),
}));

// DtKKY0V8: kuryer «Tuman» — viloyat tumanlari (`GET region/:id`), tarmoqsiz.
vi.mock("../../../../entities/logistics/api/logisticsApi", () => ({
  useLogistics: () => ({
    useGetDistricts: (regionId?: string) => ({
      data:
        regionId === "12"
          ? [
              { id: 41, name: "Urgut tumani" },
              { id: 40, name: "Pastdarg'om tumani" },
            ]
          : regionId === "22"
            ? [{ id: 201, name: "Termiz tumani" }]
            : undefined,
      isLoading: false,
      isError: false,
    }),
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
  for (const fn of [
    mocks.createAdmin,
    mocks.createManager,
    mocks.createRegistrator,
    mocks.createMarket,
    mocks.createCourier,
    mocks.createLogist,
  ]) {
    fn.mockReset().mockResolvedValue({ statusCode: 201 });
  }
  mocks.navigate.mockReset();
  mocks.useBranches.mockReset().mockReturnValue({ data: { data: mocks.branches }, isLoading: false });
});

describe("CreateUserForm — sahifa (maket `superadmin-users-create`)", () => {
  it("sarlavha, rol kartasi (6 rol, izohlari bilan), izoh va forma kartasi", () => {
    renderWithProviders(<CreateUserForm />, { preloadedState: superadminState });

    expect(screen.getByRole("heading", { level: 1, name: "Yangi foydalanuvchi" })).toBeInTheDocument();
    expect(screen.getByText("Rolni tanlang va ma'lumotlarni kiriting · majburiy maydonlar * bilan")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Foydalanuvchilar" })).toHaveAttribute("href", "/all-users");
    const group = screen.getByRole("group", { name: "Foydalanuvchi roli" });
    expect(within(group).getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual([
      "admin",
      "manager",
      "registrator",
      "logist",
      "courier",
      "marketing",
    ]);
    expect(screen.getByRole("radio", { name: /^Kuryer/ })).toHaveAccessibleName("Kuryer Maosh yoki buyurtma tarifi");
    expect(screen.getByRole("radio", { name: /^Logist/ })).toHaveAccessibleName(
      "Logist Buyurtmalar va holat tarixi, moliyasiz",
    );
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

describe("CreateUserForm — kuryer «Ish hududi» (DtKKY0V8, maketlar `*-users-create-courier-district`)", () => {
  const REGIONAL_BRANCHES = [
    { ...mocks.branches[0], region: { id: "11", name: "Toshkent shahri" } },
    { ...mocks.branches[1], region: { id: "22", name: "Surxondaryo viloyati" } },
    { ...mocks.branches[1], id: "17", name: "Chilonzor punkt", code: "PNK", type: "PICKUP" as const, level: 2 },
  ];

  const fillCourier = async (user: User, container: HTMLElement) => {
    await fill(user, container, "fullName", "Sardor Qodirov");
    await fill(user, container, "phone", "931184625");
    await fill(user, container, "password", "kuryer2026");
    await fill(user, container, "homeRate", "20000");
    await fill(user, container, "centerRate", "15000");
  };

  it("menejer: faqat «Tuman» — o'z filiali viloyati tumanlari; tanlansa `district_id` yuboriladi", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CreateUserForm />, { preloadedState: managerState("REGIONAL") });

    expect(screen.getByText("Ish hududi")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Filial" })).not.toBeInTheDocument();
    const district = screen.getByRole("combobox", { name: "Tuman" });
    expect(district).toHaveAccessibleDescription("Ixtiyoriy · faqat Samarqand viloyati tumanlari, qidirib tanlanadi");
    await user.click(district);
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Pastdarg'om tumani",
      "Urgut tumani",
    ]);
    await user.click(screen.getByRole("option", { name: "Pastdarg'om tumani" }));

    await fillCourier(user, container);
    await save(user);

    await waitFor(() => expect(mocks.createCourier).toHaveBeenCalledTimes(1));
    expect(mocks.createCourier).toHaveBeenCalledWith(
      expect.objectContaining({ branch_id: "44", district_id: "40" }),
    );
  });

  it("superadmin: Filial (ixtiyoriy, PICKUP yo'q) → Viloyat → Tuman; filial almashsa tuman tozalanadi", async () => {
    mocks.useBranches.mockReturnValue({ data: { data: REGIONAL_BRANCHES }, isLoading: false });
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CreateUserForm />, { preloadedState: superadminState });
    await pickRole(user, "Kuryer");

    const district = screen.getByRole("combobox", { name: "Tuman" });
    expect(district).toBeDisabled();
    expect(district).toHaveAccessibleDescription("Avval filialni tanlang — tumanlar filial viloyatidan olinadi");
    expect(screen.getByRole("textbox", { name: "Viloyat" })).toHaveValue("—");

    await user.click(screen.getByRole("combobox", { name: "Filial" }));
    const options = screen.getAllByRole("option").map((option) => option.textContent ?? "");
    expect(options.some((label) => label.includes("Chilonzor punkt"))).toBe(false);
    await user.click(screen.getByRole("option", { name: /Surxondaryo/ }));

    expect(screen.getByRole("textbox", { name: "Viloyat" })).toHaveValue("Surxondaryo viloyati");
    await user.click(screen.getByRole("combobox", { name: "Tuman" }));
    await user.click(screen.getByRole("option", { name: "Termiz tumani" }));

    await fillCourier(user, container);
    await save(user);

    await waitFor(() => expect(mocks.createCourier).toHaveBeenCalledTimes(1));
    expect(mocks.createCourier).toHaveBeenCalledWith({
      name: "Sardor Qodirov",
      phone_number: "+998931184625",
      password: "kuryer2026",
      branch_id: "15",
      district_id: "201",
      tariff_home: 20000,
      tariff_center: 15000,
    });

    // Filial almashsa — tuman tozalanadi (boshqa viloyat tumani 400 bo'lardi).
    await user.click(screen.getByRole("combobox", { name: "Filial" }));
    await user.click(screen.getByRole("option", { name: /Bosh ofis/ }));
    expect(screen.getByRole("combobox", { name: "Tuman" })).toHaveValue("");
  });

  it("superadmin: filialsiz — avvalgidek HQ (`branch_id` va `district_id` yuborilmaydi)", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CreateUserForm />, { preloadedState: superadminState });
    await pickRole(user, "Kuryer");
    await fillCourier(user, container);
    await save(user);

    await waitFor(() => expect(mocks.createCourier).toHaveBeenCalledTimes(1));
    const payload = mocks.createCourier.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("branch_id");
    expect(payload).not.toHaveProperty("district_id");
  });

  it("400 «Tuman topilmadi» — «Tuman» ostida va xabarda i18n matni, sahifada qoladi", async () => {
    mocks.createCourier.mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { statusCode: 400, message: "Tuman topilmadi" } },
    });
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CreateUserForm />, { preloadedState: managerState("REGIONAL") });
    await user.click(screen.getByRole("combobox", { name: "Tuman" }));
    await user.click(screen.getByRole("option", { name: "Urgut tumani" }));
    await fillCourier(user, container);
    await save(user);

    const text = "Tuman topilmadi — ro'yxatdan qayta tanlang";
    await waitFor(() => expect(screen.getAllByText(text).length).toBe(2));
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});

describe("CreateUserForm — «Logist» (LG-2, maket `superadmin-users-create-logist`)", () => {
  const fillLogist = async (user: User, container: HTMLElement) => {
    await fill(user, container, "fullName", "Aziz Rahimov");
    await fill(user, container, "phone", "901234567");
    await fill(user, container, "password", "logist2026");
  };

  it("forma: «Logist qo'shish», maosh majburiy, to'lov kuni ixtiyoriy, «Viloyatlar» izohi; POST → «Logist biriktirish»", async () => {
    mocks.createLogist.mockResolvedValue({ data: { statusCode: 201, data: { id: 57, name: "Aziz Rahimov" } } });
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CreateUserForm />, { preloadedState: superadminState });

    await pickRole(user, "Logist");
    expect(screen.getByRole("form", { name: "Logist qo'shish" })).toBeInTheDocument();
    expect(screen.getByText("Logist o'ziga biriktirilgan viloyatlar statistikasini kuzatadi")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Maosh" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Viloyatlar" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Logist filialga biriktirilmaydi. Saqlagach «Logist biriktirish» sahifasi shu logist tanlangan holda ochiladi — viloyatlarni o'sha yerda belgilaysiz.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Filial" })).not.toBeInTheDocument();

    await fillLogist(user, container);
    await save(user);
    expect(await screen.findByText("Maosh kiritilmadi")).toBeInTheDocument();
    expect(mocks.createLogist).not.toHaveBeenCalled();

    await fill(user, container, "salary", "6000000");
    await user.click(screen.getByRole("combobox", { name: "To'lov kuni" }));
    await user.click(screen.getByRole("option", { name: "10" }));
    await save(user);

    await waitFor(() => expect(mocks.createLogist).toHaveBeenCalledTimes(1));
    expect(mocks.createLogist).toHaveBeenCalledWith({
      name: "Aziz Rahimov",
      phone_number: "+998901234567",
      password: "logist2026",
      salary: 6000000,
      payment_day: 10,
    });
    expect(await screen.findByText("Logist yaratildi")).toBeInTheDocument();
    expect(screen.getByText("Aziz Rahimov · endi unga viloyatlarni belgilang")).toBeInTheDocument();
    expect(mocks.navigate).toHaveBeenCalledWith("/regions/logist-assignment?logist=57");
  });

  it("to'lov kunisiz yuboriladi; 409 — telefon ostida «Bu telefon raqam allaqachon mavjud», server matni yo'q", async () => {
    mocks.createLogist.mockRejectedValue({
      response: { status: 409, data: { message: "Conflict: phone_number duplicate key" } },
    });
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CreateUserForm />, {
      preloadedState: superadminState,
      route: "/all-users/create-user?role=logist",
    });

    expect(screen.getByRole("radio", { name: /^Logist/ })).toBeChecked();
    await fillLogist(user, container);
    await fill(user, container, "salary", "6000000");
    await save(user);

    await waitFor(() => expect(mocks.createLogist).toHaveBeenCalledTimes(1));
    expect(mocks.createLogist).toHaveBeenCalledWith({
      name: "Aziz Rahimov",
      phone_number: "+998901234567",
      password: "logist2026",
      salary: 6000000,
    });
    expect(await screen.findByText("Bu telefon raqam allaqachon mavjud")).toBeInTheDocument();
    expect(screen.queryByText(/duplicate key/)).not.toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("boshqa xato — «Logistni yaratib bo'lmadi», sahifada qoladi", async () => {
    mocks.createLogist.mockRejectedValue({ response: { status: 503, data: { message: "identity timeout" } } });
    const user = userEvent.setup();
    const { container } = renderWithProviders(<CreateUserForm />, {
      preloadedState: { role: { id: "2", role: "admin", region: null, name: "Admin" } } as never,
      route: "/all-users/create-user?role=logist",
    });
    await fillLogist(user, container);
    await fill(user, container, "salary", "6000000");
    await save(user);

    expect(await screen.findByText("Logistni yaratib bo'lmadi")).toBeInTheDocument();
    expect(screen.getByText("Ma'lumotlarni tekshirib, qayta urining.")).toBeInTheDocument();
    expect(screen.queryByText("identity timeout")).not.toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("menejerda ?role=logist e'tiborga olinmaydi (logist kartasi yo'q)", () => {
    renderWithProviders(<CreateUserForm />, {
      preloadedState: managerState("HYBRID"),
      route: "/all-users/create-user?role=logist",
    });
    expect(screen.queryByRole("radio", { name: /^Logist/ })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^Kuryer/ })).toBeChecked();
  });
});
