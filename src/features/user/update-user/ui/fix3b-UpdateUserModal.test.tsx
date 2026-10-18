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
 * fix3b RBAC-09 — o'z parolini o'zgartirgan foydalanuvchi darhol chiqariladi
 * (backend sessiyani yopadi), login sahifasida sababi ko'rsatiladi.
 */

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
  updateMyProfile: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("../../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetUserById: () => ({ data: undefined, isLoading: false }),
    updateUser: { mutateAsync: mocks.updateUser, isPending: false },
    updateMyProfile: { mutateAsync: mocks.updateMyProfile, isPending: false },
  }),
}));

vi.mock("../../../../shared/lib/useLogout", () => ({
  useLogout: () => ({ logout: mocks.logout }),
}));

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

describe("UpdateUserModal — o'z parolini o'zgartirish (fix3b RBAC-09)", () => {
  beforeEach(() => {
    mocks.updateUser.mockReset().mockResolvedValue({ statusCode: 200 });
    mocks.updateMyProfile.mockReset().mockResolvedValue({ statusCode: 200 });
    mocks.logout.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => clearLoginNotice());

  it("profil sahifasida yangi parol saqlansa — darhol chiqariladi va login xabari qoladi", async () => {
    const user = userEvent.setup();
    renderModal(makeUser({ id: "56" }), { role: "courier", id: "56" }, { isOwnProfile: true });

    await typePassword(user, "yangiParol1");
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));

    await waitFor(() => expect(mocks.logout).toHaveBeenCalledTimes(1));
    expect(mocks.updateMyProfile).toHaveBeenCalledWith(expect.objectContaining({ password: "yangiParol1" }));
    expect(peekLoginNotice()).toBe("passwordChanged");
    expect(await screen.findByText("Parol o'zgardi — qayta kiring")).toBeInTheDocument();
  });

  it("admin ro'yxatdan O'ZINI tahrirlab parolni o'zgartirsa ham chiqariladi", async () => {
    const user = userEvent.setup();
    renderModal(makeUser({ id: "7", role: "admin" }), { role: "admin", id: "7" });

    await typePassword(user, "yangiParol1");
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));

    await waitFor(() => expect(mocks.logout).toHaveBeenCalledTimes(1));
    expect(mocks.updateUser).toHaveBeenCalledWith({ id: "7", data: expect.objectContaining({ password: "yangiParol1" }) });
  });

  it("boshqa xodimning parolini o'zgartirgan admin chiqarilmaydi", async () => {
    const user = userEvent.setup();
    renderModal(makeUser({ id: "263" }), { role: "admin", id: "7" });

    await typePassword(user, "yangiParol1");
    await user.click(screen.getByRole("button", { name: "O'zgarishlarni saqlash" }));

    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(1));
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(peekLoginNotice()).toBeNull();
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

    expect(await screen.findByText("Parol juda qisqa")).toBeInTheDocument();
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
    expect(screen.getByText("Bo'sh qoldirilsa, parol o'zgarmaydi")).toBeInTheDocument();
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
