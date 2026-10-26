import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import type { User } from "../../../../entities/user/types/user";
import { UpdateUserModal } from "./UpdateUserModal";
import { peekLoginNotice, clearLoginNotice } from "../../../../auth/loginNotice";

/**
 * fix3b RBAC-16 (docs: enum = active | inactive) — "Bloklangan" varianti
 * olib tashlandi (backend 400 berardi).
 * Parol (2026-10-23, fix3b RBAC-09 o'rniga): o'z parolini o'zgartirganda backend BOSHQA qurilmalarni chiqaradi,
 * shu qurilma qoladi — foydalanuvchi chiqarilmaydi, xabar «Parol almashtirildi — boshqa qurilmalardan chiqildi»;
 * boshqa xodimning paroli almashsa — xabarda o'sha xodim barcha qurilmalardan chiqarilgani aytiladi.
 */

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const mocks = vi.hoisted(() => ({
  useGetUserById: vi.fn(),
  updateUser: vi.fn(),
  updateMyProfile: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("../../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetUserById: (id: string, _params?: unknown, options?: { silentError?: boolean }) =>
      options ? mocks.useGetUserById(id, options) : mocks.useGetUserById(id),
    updateUser: { mutateAsync: mocks.updateUser, isPending: false },
    updateMyProfile: { mutateAsync: mocks.updateMyProfile, isPending: false },
  }),
}));

vi.mock("../../../../shared/lib/useLogout", () => ({
  useLogout: () => ({ logout: mocks.logout }),
}));

// DtKKY0V8: kuryer «Tuman» tanlovi viloyat tumanlarini so'raydi (`GET region/:id`) — tarmoqsiz.
vi.mock("../../../../entities/logistics/api/logisticsApi", () => ({
  useLogistics: () => ({
    useGetDistricts: (regionId?: string) => ({
      data: regionId ? [{ id: 41, name: "Urgut tumani" }] : undefined,
      isLoading: false,
      isError: false,
    }),
  }),
}));

beforeEach(() => {
  mocks.useGetUserById.mockReset().mockReturnValue({ data: undefined, isLoading: false });
});

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: "263",
  name: "E2E Kuryer",
  phone_number: "+998901112233",
  username: "e2e_kuryer",
  role: "courier",
  status: "active",
  salary: 0,
  payment_day: null,
  createdAt: "2026-09-01T09:00:00.000Z",
  updatedAt: "2026-09-30T09:00:00.000Z",
  is_deleted: false,
  tariff_home: 10000,
  tariff_center: 8000,
  default_tariff: "home",
  ...overrides,
});

const stateFor = (role: string, id: string) =>
  ({
    role: { id, role, region: null, name: role },
    user: {
      user: { id, role },
      isAuthenticated: true,
      accessToken: null,
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;

const renderModal = (
  user: User,
  viewer: { role: string; id: string },
  options: { isOwnProfile?: boolean } = {},
) =>
  renderWithProviders(
    <UpdateUserModal
      userId={user.id}
      initialUser={user}
      isOwnProfile={options.isOwnProfile}
      onClose={vi.fn()}
    />,
    { preloadedState: stateFor(viewer.role, viewer.id) },
  );

const typePassword = async (user: ReturnType<typeof userEvent.setup>, value: string) => {
  const input = document.querySelector<HTMLInputElement>('input[name="password"]');
  if (!input) throw new Error("password input not found");
  await user.type(input, value);
};

describe("UpdateUserModal — holat variantlari (fix3b)", () => {
  it("faqat 'Faol' va 'Nofaol' — 'Bloklangan' yo'q", async () => {
    const user = userEvent.setup();
    renderModal(makeUser(), { role: "superadmin", id: "1" });

    // v2 `Select`: maydon — combobox, variantlar — option (maket `superadmin-users-edit-dialog`: «Faol» / «Nofaol»).
    await user.click(screen.getByRole("combobox", { name: "Holat" }));

    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Faol", "Nofaol"]);
    expect(screen.queryByRole("option", { name: "Bloklangan" })).not.toBeInTheDocument();
  });
});

describe("UpdateUserModal — parolni o'zgartirish (boshqa qurilmalar chiqadi)", () => {
  beforeEach(() => {
    mocks.updateUser.mockReset().mockResolvedValue({ statusCode: 200 });
    mocks.updateMyProfile.mockReset().mockResolvedValue({ statusCode: 200 });
    mocks.logout.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => clearLoginNotice());

  it("profil rejimida o'z paroli saqlansa — chiqarilmaydi, «boshqa qurilmalardan chiqildi»", async () => {
    const user = userEvent.setup();
    renderModal(makeUser({ id: "56" }), { role: "courier", id: "56" }, { isOwnProfile: true });

    await typePassword(user, "yangiParol1");
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));

    expect(await screen.findByText("Parol almashtirildi — boshqa qurilmalardan chiqildi")).toBeInTheDocument();
    expect(mocks.updateMyProfile).toHaveBeenCalledWith(expect.objectContaining({ password: "yangiParol1" }));
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(peekLoginNotice()).toBeNull();
  });

  it("admin ro'yxatdan O'ZINI tahrirlab parolni o'zgartirsa ham — chiqarilmaydi, o'sha xabar", async () => {
    const user = userEvent.setup();
    renderModal(makeUser({ id: "7", role: "admin" }), { role: "admin", id: "7" });

    await typePassword(user, "yangiParol1");
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));

    expect(await screen.findByText("Parol almashtirildi — boshqa qurilmalardan chiqildi")).toBeInTheDocument();
    expect(mocks.updateUser).toHaveBeenCalledWith({ id: "7", data: expect.objectContaining({ password: "yangiParol1" }) });
    expect(mocks.logout).not.toHaveBeenCalled();
  });

  it("boshqa xodimning paroli — admin chiqarilmaydi, xabarda xodim barcha qurilmalardan chiqarilgani", async () => {
    const user = userEvent.setup();
    renderModal(makeUser({ id: "263" }), { role: "admin", id: "7" });

    await typePassword(user, "yangiParol1");
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));

    expect(
      await screen.findByText(
        "\"E2E Kuryer\" yangilandi. Parol almashtirildi — foydalanuvchi barcha qurilmalardan chiqarildi.",
      ),
    ).toBeInTheDocument();
    expect(mocks.updateUser).toHaveBeenCalledTimes(1);
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(peekLoginNotice()).toBeNull();
  });

  it("parolsiz boshqa xodimni yangilash — oddiy «muvaffaqiyatli yangilandi»", async () => {
    const user = userEvent.setup();
    renderModal(makeUser({ id: "263" }), { role: "admin", id: "7" });

    const nameInput = document.querySelector<HTMLInputElement>('input[name="name"]');
    if (!nameInput) throw new Error("name input not found");
    await user.type(nameInput, " 2");
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));

    expect(await screen.findByText("\"E2E Kuryer\" muvaffaqiyatli yangilandi!")).toBeInTheDocument();
    expect(screen.queryByText(/barcha qurilmalardan/)).not.toBeInTheDocument();
  });

  it("parolsiz o'z profilini yangilash chiqarmaydi", async () => {
    const user = userEvent.setup();
    renderModal(makeUser({ id: "56", name: "Eski ism" }), { role: "courier", id: "56" }, { isOwnProfile: true });

    const nameInput = document.querySelector<HTMLInputElement>('input[name="name"]');
    if (!nameInput) throw new Error("name input not found");
    await user.clear(nameInput);
    await user.type(nameInput, "Yangi ism");
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));

    await waitFor(() => expect(mocks.updateMyProfile).toHaveBeenCalledTimes(1));
    expect(mocks.logout).not.toHaveBeenCalled();
  });

  it("saqlash rad etilsa chiqarilmaydi", async () => {
    const user = userEvent.setup();
    mocks.updateMyProfile.mockRejectedValue({ response: { status: 400, data: { message: "Parol juda qisqa" } } });
    renderModal(makeUser({ id: "56" }), { role: "courier", id: "56" }, { isOwnProfile: true });

    await typePassword(user, "yangiParol1");
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));

    // NDmZMzCP: server matni xabarda va parol maydoni ostida.
    expect(await screen.findAllByText("Parol juda qisqa")).not.toHaveLength(0);
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(peekLoginNotice()).toBeNull();
  });
});

describe("UpdateUserModal — «To'lov kuni» 1–30 ro'yxati (ega qarori 2026-10-16)", () => {
  beforeEach(() => {
    mocks.updateUser.mockReset().mockResolvedValue({ statusCode: 200 });
    mocks.logout.mockReset().mockResolvedValue(undefined);
  });

  const dayField = () => screen.getByRole("combobox", { name: "To'lov kuni (1-30)" });

  it("saqlangan kun ko'rinadi; boshqasi tanlansa API'ga avvalgidek son bo'lib ketadi", async () => {
    const user = userEvent.setup();
    renderModal(makeUser({ id: "300", role: "admin", payment_day: "12" }), { role: "superadmin", id: "1" });

    expect(dayField()).toHaveTextContent("12");
    await user.click(dayField());
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(30);
    expect(screen.getByRole("option", { name: "12" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("option", { name: "20" }));
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));

    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(1));
    expect(mocks.updateUser).toHaveBeenCalledWith({ id: "300", data: expect.objectContaining({ payment_day: 20 }) });
  });

  it("kun o'zgarmasa — payload'da payment_day yo'q (avvalgidek)", async () => {
    const user = userEvent.setup();
    renderModal(makeUser({ id: "300", role: "admin", payment_day: "12", name: "Eski" }), { role: "superadmin", id: "1" });
    const nameInput = document.querySelector<HTMLInputElement>('input[name="name"]');
    if (!nameInput) throw new Error("name input not found");
    await user.clear(nameInput);
    await user.type(nameInput, "Yangi");
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));

    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(1));
    expect(mocks.updateUser.mock.calls[0][0].data).not.toHaveProperty("payment_day");
  });

  it("saqlangan 31 — maydon bo'sh (xatosiz), saqlashda «1-30» xatosi; to'g'ri kun tanlansa saqlanadi", async () => {
    const user = userEvent.setup();
    renderModal(makeUser({ id: "300", role: "admin", payment_day: "31" }), { role: "superadmin", id: "1" });

    expect(dayField()).toHaveTextContent("To'lov kunini tanlang");
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));
    expect(await screen.findByText("1-30 oralig'ida bo'lishi kerak")).toBeInTheDocument();
    expect(dayField()).toHaveAttribute("aria-invalid", "true");
    expect(mocks.updateUser).not.toHaveBeenCalled();

    await user.click(dayField());
    await user.click(screen.getByRole("option", { name: "28" }));
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));
    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(1));
    expect(mocks.updateUser).toHaveBeenCalledWith({ id: "300", data: expect.objectContaining({ payment_day: 28 }) });
  });

  it("noto'g'ri qiymat («abc») — maydon bo'sh, sahifa yiqilmaydi", () => {
    renderModal(makeUser({ id: "300", role: "admin", payment_day: "abc" }), { role: "superadmin", id: "1" });
    expect(dayField()).toHaveTextContent("To'lov kunini tanlang");
  });
});

describe("UpdateUserModal — dizayn v2 oynasi (maket `superadmin-users-edit-dialog`)", () => {
  beforeEach(() => {
    mocks.updateUser.mockReset().mockResolvedValue({ statusCode: 200 });
    mocks.logout.mockReset().mockResolvedValue(undefined);
  });

  it("sarlavha va izoh «{ism} · {rol}», bo'limlar va tugmalar maketdagidek", () => {
    renderModal(
      makeUser({ id: "40", name: "Baraka Shop", role: "market", default_tariff: "home" }),
      { role: "superadmin", id: "1" },
    );

    const dialog = screen.getByRole("dialog", { name: "Foydalanuvchini tahrirlash" });
    expect(dialog).toHaveAccessibleDescription("Baraka Shop · Market");
    expect(screen.getByText("Asosiy ma'lumotlar")).toBeInTheDocument();
    expect(screen.getByText("Market ma'lumotlari")).toBeInTheDocument();
    expect(screen.getByText(/^Bo'sh qoldirilsa, parol o'zgarmaydi\. Kamida 8 ta belgi/)).toBeInTheDocument();
    expect(screen.getByText("Nofaol qilishdan oldin tasdiq so'raladi")).toBeInTheDocument();
    // Eski `home` qiymati — «Uygacha» (API `address`).
    expect(screen.getByRole("combobox", { name: "Asosiy tarif" })).toHaveTextContent("Uygacha");
    expect(screen.getByRole("button", { name: "Bekor qilish" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "O'zgarishlarni saqlash" })).toBeInTheDocument();
  });

  it("faqat o'zgargan maydonlar yuboriladi: market tarifi va asosiy tarif (home → address o'zgarish emas)", async () => {
    const user = userEvent.setup();
    renderModal(
      makeUser({ id: "40", name: "Baraka Shop", role: "market", default_tariff: "home", tariff_home: 35000, tariff_center: 25000 }),
      { role: "superadmin", id: "1" },
    );

    const home = document.querySelector<HTMLInputElement>('input[name="tariff_home"]');
    if (!home) throw new Error("tariff_home input not found");
    expect(home).toHaveValue("35 000");
    await user.clear(home);
    await user.type(home, "40000");
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));

    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(1));
    expect(mocks.updateUser).toHaveBeenCalledWith({ id: "40", data: { tariff_home: 40000 } });
  });

  it("asosiy tarif «Markazgacha» tanlansa — `default_tariff: center`", async () => {
    const user = userEvent.setup();
    // Ba'zi javoblarda `address` keladi (tipda — `home`).
    renderModal(makeUser({ id: "40", role: "market", default_tariff: "address" as never }), { role: "admin", id: "1" });

    await user.click(screen.getByRole("combobox", { name: "Asosiy tarif" }));
    await user.click(screen.getByRole("option", { name: "Markazgacha" }));
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));

    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(1));
    expect(mocks.updateUser).toHaveBeenCalledWith({ id: "40", data: { default_tariff: "center" } });
  });

  it("holat «Nofaol» — avval tasdiq oynasi; tasdiqlansa `status: inactive` yuboriladi", async () => {
    const user = userEvent.setup();
    renderModal(makeUser({ id: "263", name: "E2E Kuryer" }), { role: "superadmin", id: "1" });

    await user.click(screen.getByRole("combobox", { name: "Holat" }));
    await user.click(screen.getByRole("option", { name: "Nofaol" }));
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));

    const confirmDialog = await screen.findByRole("alertdialog", { name: "Nofaol qilishni tasdiqlang" });
    expect(mocks.updateUser).not.toHaveBeenCalled();
    await user.click(within(confirmDialog).getByRole("button", { name: "Nofaol qilish" }));

    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(1));
    expect(mocks.updateUser).toHaveBeenCalledWith({ id: "263", data: { status: "inactive" } });
  });

  it("telefon o'zgarsa `+998…` ko'rinishida yuboriladi; 9 raqamdan kam — xato", async () => {
    const user = userEvent.setup();
    renderModal(makeUser({ id: "263" }), { role: "superadmin", id: "1" });

    const phone = document.querySelector<HTMLInputElement>('input[name="phone"]');
    if (!phone) throw new Error("phone input not found");
    expect(phone).toHaveValue("90 111 22 33");
    await user.clear(phone);
    await user.type(phone, "93512");
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));
    expect(await screen.findByText("9 ta raqam kiriting")).toBeInTheDocument();
    expect(mocks.updateUser).not.toHaveBeenCalled();

    await user.type(phone, "4408");
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));
    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(1));
    expect(mocks.updateUser).toHaveBeenCalledWith({ id: "263", data: { phone_number: "+998935124408" } });
  });

  it("backend maydon xatosi maydon ostida ko'rinadi", async () => {
    const user = userEvent.setup();
    mocks.updateUser.mockRejectedValue({
      response: { status: 400, data: { message: "Validation failed", errors: { phone_number: "Bu raqam band" } } },
    });
    renderModal(makeUser({ id: "263" }), { role: "superadmin", id: "1" });

    const phone = document.querySelector<HTMLInputElement>('input[name="phone"]');
    if (!phone) throw new Error("phone input not found");
    await user.clear(phone);
    await user.type(phone, "935124408");
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));

    expect(await screen.findByText("Bu raqam band")).toBeInTheDocument();
  });
});

describe("UpdateUserModal — FY-1: market «AI narxi», logist maoshi, kuryer «Ish hududi»", () => {
  beforeEach(() => {
    mocks.updateUser.mockReset().mockResolvedValue({ statusCode: 200 });
    mocks.logout.mockReset().mockResolvedValue(undefined);
  });

  const aiInput = () => document.querySelector<HTMLInputElement>('input[name="ai_price"]');
  const market = (overrides: Partial<User> = {}) =>
    makeUser({ id: "40", name: "Baraka Shop", role: "market", tariff_home: 35000, tariff_center: 25000, ...overrides });
  const save = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));

  it("market (maket `superadmin-users-edit-market-ai`): «Market nomi *», «AI narxi (1 buyurtma)» + izoh, saqlangan qiymat", () => {
    renderModal(market({ ai_price_per_order: 250 }), { role: "superadmin", id: "1" });

    expect(screen.getByRole("textbox", { name: /^Market nomi/ })).toHaveValue("Baraka Shop");
    const field = screen.getByRole("textbox", { name: "AI narxi (1 buyurtma)" });
    expect(field).toHaveValue("250");
    expect(field).toHaveAccessibleDescription("Shu market uchun · 0 — bepul");
    expect(field).toHaveAttribute("placeholder", "Masalan: 250");
  });

  it("AI narxi `null` — maydon bo'sh, sukut narx (300) ko'rsatilmaydi (FY-S5); o'zgartirilmasa payload'da yo'q", async () => {
    const user = userEvent.setup();
    renderModal(market({ ai_price_per_order: null }), { role: "admin", id: "1" });

    expect(aiInput()).toHaveValue("");
    expect(screen.queryByText(/300/)).not.toBeInTheDocument();
    const home = document.querySelector<HTMLInputElement>('input[name="tariff_home"]');
    if (!home) throw new Error("tariff_home input not found");
    await user.clear(home);
    await user.type(home, "40000");
    await save(user);

    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(1));
    expect(mocks.updateUser).toHaveBeenCalledWith({ id: "40", data: { tariff_home: 40000 } });
  });

  it("AI narxi kiritilsa — son; 0 — bepul (0 yuboriladi)", async () => {
    const user = userEvent.setup();
    renderModal(market({ ai_price_per_order: null }), { role: "superadmin", id: "1" });

    await user.type(aiInput() as HTMLInputElement, "0");
    await save(user);

    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(1));
    expect(mocks.updateUser).toHaveBeenCalledWith({ id: "40", data: { ai_price_per_order: 0 } });
  });

  it("AI narxi tozalansa — `null` (global narx)", async () => {
    const user = userEvent.setup();
    renderModal(market({ ai_price_per_order: "250.00" as never }), { role: "superadmin", id: "1" });

    expect(aiInput()).toHaveValue("250");
    await user.clear(aiInput() as HTMLInputElement);
    await save(user);

    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(1));
    expect(mocks.updateUser).toHaveBeenCalledWith({ id: "40", data: { ai_price_per_order: null } });
  });

  it("AI narxi 1 000 000 dan katta — maydon xatosi, so'rov ketmaydi", async () => {
    const user = userEvent.setup();
    renderModal(market(), { role: "superadmin", id: "1" });

    await user.type(aiInput() as HTMLInputElement, "1000001");
    await save(user);

    expect(await screen.findByText("0 dan 1 000 000 so'mgacha kiriting")).toBeInTheDocument();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("menejer marketni tahrirlasa — «AI narxi» maydoni yo'q (backend faqat superadmin/admin)", () => {
    renderModal(market({ ai_price_per_order: 250 }), { role: "manager", id: "70" });

    expect(screen.getByText("Market ma'lumotlari")).toBeInTheDocument();
    expect(aiInput()).toBeNull();
    expect(screen.queryByText("AI narxi (1 buyurtma)")).not.toBeInTheDocument();
  });

  it("logist — «Maosh va to'lov kuni» bo'limi; maosh o'zgarsa yuboriladi", async () => {
    const user = userEvent.setup();
    renderModal(makeUser({ id: "81", name: "Dilshod Karimov", role: "logist", salary: 3000000, payment_day: "10" }), {
      role: "superadmin",
      id: "1",
    });

    expect(screen.getByText("Maosh va to'lov kuni")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "To'lov kuni (1-30)" })).toHaveTextContent("10");
    const salary = document.querySelector<HTMLInputElement>('input[name="salary"]');
    if (!salary) throw new Error("salary input not found");
    expect(salary).toHaveValue("3 000 000");
    await user.clear(salary);
    await user.type(salary, "3500000");
    await save(user);

    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(1));
    expect(mocks.updateUser).toHaveBeenCalledWith({ id: "81", data: { salary: 3500000 } });
  });

  it("kuryer (tafsilotdan, `region` bor) — «Ish hududi»: viloyat faqat o'qish + «O'tkazish» izohi, «Tuman» tanlovi (DtKKY0V8)", async () => {
    const user = userEvent.setup();
    renderModal(
      makeUser({ region: { id: "14", name: "Samarqand viloyati", sato_code: "1718", createdAt: "", updatedAt: "" } }),
      { role: "superadmin", id: "1" },
    );

    expect(screen.getByText("Ish hududi")).toBeInTheDocument();
    const region = screen.getByRole("textbox", { name: "Viloyat" });
    expect(region).toHaveValue("Samarqand viloyati");
    expect(region).toHaveAttribute("readonly");
    expect(region).toHaveAccessibleDescription(
      "Filial «Boshqa filialga o'tkazish» orqali o'zgaradi — unda tuman tozalanadi",
    );
    // DtKKY0V8: «Tuman» — shu viloyat tumanlari; tegilmasa yuborilmaydi.
    expect(screen.getByRole("combobox", { name: "Tuman" })).toBeInTheDocument();
    // Tafsilotda viloyat bor — qo'shimcha so'rov yo'q.
    expect(mocks.useGetUserById).toHaveBeenLastCalledWith("");

    // O'lik `region_id` endi hech qachon yuborilmaydi.
    const home = document.querySelector<HTMLInputElement>('input[name="tariff_home"]');
    if (!home) throw new Error("tariff_home input not found");
    await user.clear(home);
    await user.type(home, "12000");
    await save(user);
    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(1));
    expect(mocks.updateUser).toHaveBeenCalledWith({ id: "263", data: { tariff_home: 12000 } });
  });

  it("kuryer ro'yxatdan (`region` yo'q) — viloyat `GET /users/:id` dan olinadi; biriktirilmagan bo'lsa matn", () => {
    mocks.useGetUserById.mockImplementation((id: string) =>
      id
        ? { data: { data: { ...makeUser(), region: { id: "14", name: "Farg'ona viloyati" } } }, isLoading: false }
        : { data: undefined, isLoading: false },
    );
    const { unmount } = renderModal(makeUser(), { role: "admin", id: "1" });

    // Yordamchi so'rov — jim (xato global xabar bermaydi, maydonning o'zida).
    expect(mocks.useGetUserById).toHaveBeenCalledWith("263", { silentError: true });
    expect(screen.getByRole("textbox", { name: "Viloyat" })).toHaveValue("Farg'ona viloyati");
    unmount();

    mocks.useGetUserById.mockReturnValue({ data: { data: { ...makeUser(), region: null } }, isLoading: false });
    renderModal(makeUser(), { role: "admin", id: "1" });
    expect(screen.getByRole("textbox", { name: "Viloyat" })).toHaveValue("Biriktirilmagan");
  });

  it("kuryer viloyati so'rovi yiqilsa — «Biriktirilmagan» emas, «—» (qiymat noma'lum)", () => {
    mocks.useGetUserById.mockImplementation((id: string) =>
      id ? { data: undefined, isLoading: false, isError: true } : { data: undefined, isLoading: false },
    );
    renderModal(makeUser(), { role: "admin", id: "1" });

    const region = screen.getByRole("textbox", { name: "Viloyat" });
    expect(region).toHaveValue("—");
    expect(screen.queryByDisplayValue("Biriktirilmagan")).not.toBeInTheDocument();
  });

  it("kuryer viloyati yuklanayotganda — o'sha 44px faqat-o'qish maydon (yorliq bog'langan), qiymat bo'sh", () => {
    mocks.useGetUserById.mockImplementation((id: string) =>
      id ? { data: undefined, isLoading: true } : { data: undefined, isLoading: false },
    );
    renderModal(makeUser(), { role: "admin", id: "1" });

    const region = screen.getByRole("textbox", { name: "Viloyat" });
    expect(region).toHaveValue("");
    expect(region).toHaveAttribute("readonly");
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByDisplayValue("Biriktirilmagan")).not.toBeInTheDocument();
  });

  it("menejer kuryerni tahrirlasa — «O'tkazish» izohi yo'q (tugma faqat admin/superadminda)", () => {
    renderModal(makeUser({ region: { id: "14", name: "Samarqand viloyati" } as never }), { role: "manager", id: "70" });

    const region = screen.getByRole("textbox", { name: "Viloyat" });
    expect(region).toHaveValue("Samarqand viloyati");
    expect(screen.queryByText("Filial «Boshqa filialga o'tkazish» orqali o'zgaradi")).not.toBeInTheDocument();
  });

  it("market bo'limi to'ri: AI narxi bilan 240px ustun (maket 2×2 / telefonda 1), menejerda ixcham 170px", () => {
    const { unmount } = renderModal(market({ ai_price_per_order: 250 }), { role: "superadmin", id: "1" });
    const grid = () => aiOrHomeGrid();
    expect(grid()).toHaveAttribute("data-min-col", "240");
    expect(grid()?.className).toContain("minmax(min(240px,100%),1fr)");
    unmount();

    renderModal(market({ ai_price_per_order: 250 }), { role: "manager", id: "70" });
    expect(grid()).toHaveAttribute("data-min-col", "170");
  });
});

const aiOrHomeGrid = () => document.querySelector('input[name="tariff_home"]')?.closest("[data-min-col]") ?? null;

describe("UpdateUserModal — CS-C: market «Uyga / Markazga standart narx» (maket `superadmin-users-edit-dialog`)", () => {
  beforeEach(() => {
    mocks.updateUser.mockReset().mockResolvedValue({ statusCode: 200 });
  });

  const market = (overrides: Partial<User> = {}) =>
    makeUser({ id: "40", name: "Baraka Shop", role: "market", tariff_home: 35000, tariff_center: 25000, ...overrides });

  it.each(["superadmin", "admin"])("%s: market maydonlari yangi yorliqlar bilan, majburiy (*)", (role) => {
    renderModal(market(), { role, id: "1" });

    const section = screen.getByText("Market ma'lumotlari").closest("section") as HTMLElement;
    const home = within(section).getByRole("textbox", { name: /^Uyga standart narx/ });
    const center = within(section).getByRole("textbox", { name: /^Markazga standart narx/ });
    expect(home).toHaveValue("35 000");
    expect(center).toHaveValue("25 000");
    expect(home).toHaveAttribute("aria-required", "true");
    expect(center).toHaveAttribute("aria-required", "true");
    expect(screen.queryByText("Uyga tarif")).not.toBeInTheDocument();
    expect(screen.queryByText("Markazga tarif")).not.toBeInTheDocument();
    // «Vazn va hajm bo'yicha narx» — backend maydoni yo'q (DAqXPeSy), chizilmaydi.
    expect(screen.queryByText("Vazn va hajm bo'yicha narx")).not.toBeInTheDocument();
  });

  it("bo'sh standart narx — maydon ostida aniq xato, so'rov yuborilmaydi", async () => {
    const user = userEvent.setup();
    renderModal(market(), { role: "superadmin", id: "1" });

    await user.clear(screen.getByRole("textbox", { name: /^Uyga standart narx/ }));
    await user.clear(screen.getByRole("textbox", { name: /^Markazga standart narx/ }));
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));

    expect(await screen.findByText("Uyga standart narxni kiriting")).toBeInTheDocument();
    expect(screen.getByText("Markazga standart narxni kiriting")).toBeInTheDocument();
    expect(screen.queryByText("Uy tarifi yo'q")).not.toBeInTheDocument();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("bo'sh standart narx bilan saqlash — fokus birinchi xato maydonga («Uyga standart narx»)", async () => {
    const user = userEvent.setup();
    renderModal(market(), { role: "superadmin", id: "1" });

    const home = screen.getByRole("textbox", { name: /^Uyga standart narx/ });
    await user.clear(home);
    await user.clear(screen.getByRole("textbox", { name: /^Markazga standart narx/ }));
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));

    await screen.findByText("Uyga standart narxni kiriting");
    expect(home).toHaveFocus();
    expect(home).toHaveAttribute("aria-invalid", "true");
  });

  it("bir nechta xato — fokus formadagi birinchisiga (nom), keyingisiga emas", async () => {
    const user = userEvent.setup();
    renderModal(market(), { role: "superadmin", id: "1" });

    const name = screen.getByRole("textbox", { name: /^Market nomi/ });
    await user.clear(name);
    await user.clear(screen.getByRole("textbox", { name: /^Markazga standart narx/ }));
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));

    await screen.findByText("Markazga standart narxni kiriting");
    expect(name).toHaveFocus();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("kuryer — «Uyga tarif» / «Markazga tarif» o'zgarmaydi", () => {
    renderModal(makeUser(), { role: "superadmin", id: "1" });

    expect(screen.getByRole("textbox", { name: /^Uyga tarif/ })).toHaveValue("10 000");
    expect(screen.getByRole("textbox", { name: /^Markazga tarif/ })).toHaveValue("8 000");
    expect(screen.queryByText(/standart narx/)).not.toBeInTheDocument();
  });
});
