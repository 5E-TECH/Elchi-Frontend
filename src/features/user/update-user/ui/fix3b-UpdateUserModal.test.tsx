import { screen, waitFor } from "@testing-library/react";
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
  it("faqat 'Faol' va 'Faol emas' — 'Bloklangan' yo'q", async () => {
    const user = userEvent.setup();
    renderModal(makeUser(), { role: "superadmin", id: "1" });

    await user.click(screen.getByRole("button", { name: "Holat" }));

    expect(screen.getByRole("button", { name: "Faol emas" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Faol" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Bloklangan" })).not.toBeInTheDocument();
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
