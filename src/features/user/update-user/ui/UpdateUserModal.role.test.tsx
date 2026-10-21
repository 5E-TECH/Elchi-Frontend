import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import type { User } from "../../../../entities/user/types/user";
import { UpdateUserModal } from "./UpdateUserModal";

/**
 * FY-2 (K3scaE0W, SZTZ4HEU) — tahrirlash oynasida «Rol»: faqat superadmin, admin ⇄ menejer ⇄ ro'yxatchi ⇄ logist;
 * tasdiq «Rolni o'zgartirasizmi?»; avval `PATCH /users/:id/role`, keyin qolgan maydonlar; 409 / 503 oyna ichida;
 * qisman muvaffaqiyat. Maketlar: `superadmin-users-edit-role`, `superadmin-users-role-confirm-dialog`,
 * `superadmin-users-role-confirm-logist`, `superadmin-users-edit-role-error`. Tarmoqqa chiqilmaydi.
 */

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
  changeUserRole: vi.fn(),
  fetchRoleCatalog: vi.fn(),
  getLogistRegions: vi.fn(),
  navigate: vi.fn(),
  calls: [] as string[],
}));

vi.mock("../../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetUserById: () => ({ data: undefined, isLoading: false }),
    updateUser: { mutateAsync: mocks.updateUser, isPending: false },
    updateMyProfile: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

vi.mock("../../../../entities/user/api/roleApi", async () => {
  const actual = await vi.importActual<typeof import("../../../../entities/user/api/roleApi")>(
    "../../../../entities/user/api/roleApi",
  );
  const { useQuery } = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    changeUserRole: mocks.changeUserRole,
    // Haqiqiy hook modul ichidagi `fetchRoleCatalog` ni chaqirardi — mock'ga ulanadi.
    useRoleCatalog: ({ enabled = true }: { enabled?: boolean } = {}) =>
      useQuery({ queryKey: actual.roleCatalogKey, queryFn: mocks.fetchRoleCatalog, enabled, retry: false }),
  };
});

vi.mock("../../../../entities/logist", async () => {
  const actual = await vi.importActual<typeof import("../../../../entities/logist")>("../../../../entities/logist");
  return { ...actual, getLogistRegions: mocks.getLogistRegions };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock("../../../../shared/lib/useLogout", () => ({
  useLogout: () => ({ logout: vi.fn() }),
}));

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: "41",
  name: "Nilufar Rashidova",
  phone_number: "+998908112649",
  username: "nilufar_r",
  role: "admin",
  status: "active",
  salary: 6000000,
  payment_day: "5",
  createdAt: "2026-09-03T09:00:00.000Z",
  updatedAt: "2026-10-05T09:00:00.000Z",
  is_deleted: false,
  tariff_home: null,
  tariff_center: null,
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

const renderModal = (user: User, viewer: { role: string; id: string } = { role: "superadmin", id: "1" }) => {
  const onClose = vi.fn();
  renderWithProviders(<UpdateUserModal userId={user.id} initialUser={user} onClose={onClose} />, {
    preloadedState: stateFor(viewer.role, viewer.id),
  });
  return { onClose };
};

const roleField = () => screen.getByRole("combobox", { name: "Rol" });
const saveButton = () => screen.getByRole("button", { name: "O'zgarishlarni saqlash" });

const pickRole = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
  await user.click(roleField());
  await user.click(await screen.findByRole("option", { name: new RegExp(`^${label}`) }));
};

const httpError = (status: number) => ({
  isAxiosError: true,
  response: {
    status,
    data: { message: "Foydalanuvchi 'Yunusobod' filialiga biriktirilgan — DELETE /branches/7/users/41" },
  },
});

beforeEach(() => {
  mocks.calls.length = 0;
  mocks.updateUser.mockReset().mockImplementation(async () => {
    mocks.calls.push("updateUser");
    return { statusCode: 200 };
  });
  mocks.changeUserRole.mockReset().mockImplementation(async () => {
    mocks.calls.push("changeRole");
    return { statusCode: 200 };
  });
  mocks.fetchRoleCatalog.mockReset().mockResolvedValue({
    changeableRoles: ["admin", "manager", "registrator", "logist"],
  });
  mocks.getLogistRegions.mockReset().mockResolvedValue([]);
  mocks.navigate.mockReset();
});

describe("UpdateUserModal — «Rol» bo'limi kimga ko'rinadi (FY-2)", () => {
  it("superadmin admin'ni tahrirlasa — «Rol» + «Faqat superadmin», izoh va 4 ta rol (izohlari bilan)", async () => {
    const user = userEvent.setup();
    renderModal(makeUser());

    const section = screen.getByRole("region", { name: "Rol" });
    expect(section).toHaveTextContent("Faqat superadmin");
    expect(roleField()).toHaveTextContent("Admin");
    expect(
      screen.getByText(
        "Faqat admin, menejer, ro'yxatchi va logist o'rtasida almashtiriladi. Saqlashdan oldin tasdiq so'raladi.",
      ),
    ).toBeInTheDocument();

    await user.click(roleField());
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "AdminKompaniya bo'yicha boshqaruv",
      "MenejerFilial menejeri: o'z filiali pochtasi, kuryerlari va kassasi",
      "Ro'yxatchiBuyurtmalarni qabul qilish va ro'yxatga olish",
      "LogistBiriktirilgan viloyatlar: buyurtmalar, holat tarixi, pochta va kuryerlar · moliyasiz",
    ]);
    expect(screen.getByRole("option", { name: /^Admin/ })).toHaveAttribute("aria-selected", "true");
    // Katalog faqat ro'yxat ochilganda so'raladi (oyna har ochilganda emas).
    expect(mocks.fetchRoleCatalog).toHaveBeenCalledTimes(1);
  });

  it("katalog (`changeable_roles`) qisqa bo'lsa — faqat o'shalar + joriy rol", async () => {
    mocks.fetchRoleCatalog.mockResolvedValue({ changeableRoles: ["manager", "registrator"] });
    const user = userEvent.setup();
    renderModal(makeUser({ role: "logist" }));

    await user.click(roleField());
    await waitFor(() =>
      expect(screen.getAllByRole("option").map((option) => option.textContent?.split(/(?=[A-Z])/)[0])).toEqual([
        "Menejer",
        "Ro'yxatchi",
        "Logist",
      ]),
    );
  });

  it("oyna ochilganda katalog so'ralmaydi", () => {
    renderModal(makeUser());
    expect(mocks.fetchRoleCatalog).not.toHaveBeenCalled();
  });

  it.each([
    ["admin tahrirlasa", makeUser(), { role: "admin", id: "1" }],
    ["menejer tahrirlasa", makeUser({ role: "registrator" }), { role: "manager", id: "1" }],
    ["kuryer (almashtirilmaydi)", makeUser({ role: "courier" }), { role: "superadmin", id: "1" }],
    ["market (almashtirilmaydi)", makeUser({ role: "market" }), { role: "superadmin", id: "1" }],
    ["superadmin o'zini", makeUser({ id: "1", role: "admin" }), { role: "superadmin", id: "1" }],
  ])("%s — «Rol» bo'limi yo'q", (_case, target, viewer) => {
    renderModal(target, viewer);
    expect(screen.queryByRole("combobox", { name: "Rol" })).not.toBeInTheDocument();
    expect(screen.queryByText("Faqat superadmin")).not.toBeInTheDocument();
  });
});

describe("UpdateUserModal — rolni o'zgartirish oqimi (FY-2)", () => {
  it("Admin → Menejer: izoh, tasdiq oynasi, faqat `PATCH /users/:id/role`, xabar va yopilish", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal(makeUser());

    await pickRole(user, "Menejer");
    expect(screen.getByText("O'zgartirildi: Admin → Menejer · saqlashda tasdiq so'raladi")).toBeInTheDocument();
    await user.click(saveButton());

    const dialog = await screen.findByRole("alertdialog", { name: "Rolni o'zgartirasizmi?" });
    expect(dialog).toHaveTextContent("Nilufar Rashidova endi menejer sifatida ishlaydi.");
    expect(within(dialog).getByRole("img", { name: "Rol: Admin → Menejer" })).toBeInTheDocument();
    expect(dialog).toHaveTextContent("O'zgargandan keyin");
    const items = within(dialog).getAllByRole("listitem").map((item) => item.textContent);
    expect(items).toEqual([
      "Joriy sessiyasi yopiladi — keyingi kirishda yangi rol bilan ishlaydi",
      "Menejerni filialga biriktiring: «Filiallar» → filial → «Xodim qo'shish»",
      "Eski va yangi rol faoliyat jurnaliga yoziladi",
    ]);
    expect(mocks.changeUserRole).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Rolni o'zgartirish" }));

    await waitFor(() => expect(mocks.changeUserRole).toHaveBeenCalledWith("41", "manager"));
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(await screen.findByText("Rol o'zgartirildi")).toBeInTheDocument();
    expect(screen.getByText("Nilufar Rashidova: Admin → Menejer")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("rol va boshqa maydon: avval rol, keyin `PATCH /users/:id`", async () => {
    const user = userEvent.setup();
    renderModal(makeUser({ role: "registrator" }));

    await pickRole(user, "Admin");
    const nameInput = document.querySelector<HTMLInputElement>('input[name="name"]');
    if (!nameInput) throw new Error("name input not found");
    await user.clear(nameInput);
    await user.type(nameInput, "Nilufar R.");
    await user.click(saveButton());

    const dialog = await screen.findByRole("alertdialog", { name: "Rolni o'zgartirasizmi?" });
    expect(dialog).toHaveTextContent("Nilufar Rashidova endi admin sifatida ishlaydi.");
    // Menejer emas — filial qatori yo'q.
    expect(dialog).not.toHaveTextContent("Menejerni filialga biriktiring");
    await user.click(within(dialog).getByRole("button", { name: "Rolni o'zgartirish" }));

    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(1));
    expect(mocks.calls).toEqual(["changeRole", "updateUser"]);
    expect(mocks.updateUser).toHaveBeenCalledWith({ id: "41", data: { name: "Nilufar R." } });
  });

  it("tasdiq bekor qilinsa — hech narsa yuborilmaydi, oyna ochiq", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal(makeUser());

    await pickRole(user, "Logist");
    await user.click(saveButton());
    const dialog = await screen.findByRole("alertdialog", { name: "Rolni o'zgartirasizmi?" });
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mocks.changeUserRole).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(roleField()).toHaveTextContent("Logist");
  });

  it("Logist → Admin: bo'shaydigan viloyatlar nomi, jurnal qatori va «Logistlarni biriktirish» havolasi", async () => {
    mocks.getLogistRegions.mockResolvedValue([
      { id: "1", name: "Samarqand", logistId: "41" },
      { id: "2", name: "Navoiy", logistId: "41" },
      { id: "3", name: "Toshkent", logistId: "9" },
      { id: "4", name: "Buxoro", logistId: null },
    ]);
    const user = userEvent.setup();
    renderModal(makeUser({ name: "Aziz Rahimov", role: "logist" }));

    await pickRole(user, "Admin");
    await user.click(saveButton());

    const dialog = await screen.findByRole("alertdialog", { name: "Rolni o'zgartirasizmi?" });
    expect(dialog).toHaveTextContent("Aziz Rahimov endi admin sifatida ishlaydi.");
    expect(within(dialog).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "2 ta viloyat bo'shatiladi: Samarqand, Navoiy — «Logistlarni biriktirish» sahifasida boshqa logistga beriladi",
      "Joriy sessiyasi yopiladi — keyingi kirishda yangi rol bilan ishlaydi",
      "Eski va yangi rol, bo'shatilgan viloyatlar faoliyat jurnaliga yoziladi",
    ]);
    await user.click(within(dialog).getByRole("button", { name: "Rolni o'zgartirish" }));

    await waitFor(() => expect(mocks.changeUserRole).toHaveBeenCalledWith("41", "admin"));
    await user.click(await screen.findByRole("button", { name: "Logistlarni biriktirish" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/regions/logist-assignment");
  });

  it("logist viloyatlari yuklanmasa — nomsiz umumiy qator", async () => {
    mocks.getLogistRegions.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    renderModal(makeUser({ role: "logist" }));

    await pickRole(user, "Menejer");
    await user.click(saveButton());

    const dialog = await screen.findByRole("alertdialog", { name: "Rolni o'zgartirasizmi?" });
    expect(dialog).toHaveTextContent(
      "Logistning viloyatlari bo'shatiladi — «Logistlarni biriktirish» sahifasida boshqa logistga beriladi",
    );
  });

  it("409 — oyna ichida «Rol o'zgartirilmadi» (backend matnisiz), qolgan maydonlar yuborilmaydi", async () => {
    mocks.changeUserRole.mockRejectedValue(httpError(409));
    const user = userEvent.setup();
    const { onClose } = renderModal(makeUser({ name: "Kamron Tursunov", role: "registrator" }));

    await pickRole(user, "Menejer");
    const nameInput = document.querySelector<HTMLInputElement>('input[name="name"]');
    if (!nameInput) throw new Error("name input not found");
    await user.type(nameInput, " K.");
    await user.click(saveButton());
    const dialog = await screen.findByRole("alertdialog", { name: "Rolni o'zgartirasizmi?" });
    await user.click(within(dialog).getByRole("button", { name: "Rolni o'zgartirish" }));

    const alert = await screen.findByTestId("role-change-error");
    expect(alert).toHaveAttribute("role", "alert");
    expect(alert).toHaveTextContent("Rol o'zgartirilmadi");
    expect(alert).toHaveTextContent(
      "Kamron Tursunov filialga biriktirilgan. Avval uni filialdan chiqaring — rol o'zgargach, yangi rol bilan qayta biriktiring. Oyna yopilmadi — kiritilganlar joyida.",
    );
    expect(within(alert).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/DELETE \/branches/)).not.toBeInTheDocument();
    expect(roleField()).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("O'zgartirildi: Ro'yxatchi → Menejer")).toBeInTheDocument();
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(nameInput).toHaveValue("Kamron Tursunov K.");

    // Boshqa rol tanlansa — xato tozalanadi.
    await pickRole(user, "Admin");
    expect(screen.queryByTestId("role-change-error")).not.toBeInTheDocument();
  });

  it("503 — «Qayta urinish» tasdiqsiz qayta yuboradi", async () => {
    mocks.changeUserRole.mockRejectedValueOnce(httpError(503));
    const user = userEvent.setup();
    const { onClose } = renderModal(makeUser());

    await pickRole(user, "Ro'yxatchi");
    await user.click(saveButton());
    await user.click(
      within(await screen.findByRole("alertdialog", { name: "Rolni o'zgartirasizmi?" })).getByRole("button", {
        name: "Rolni o'zgartirish",
      }),
    );

    const alert = await screen.findByTestId("role-change-error");
    expect(alert).toHaveTextContent("Hozir tekshirib bo'lmadi — rol o'zgarmadi.");
    await user.click(within(alert).getByRole("button", { name: "Qayta urinish" }));

    await waitFor(() => expect(mocks.changeUserRole).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mocks.changeUserRole).toHaveBeenLastCalledWith("41", "registrator");
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("400 — umumiy matn, «Qayta urinish» yo'q", async () => {
    mocks.changeUserRole.mockRejectedValue(httpError(400));
    const user = userEvent.setup();
    renderModal(makeUser());

    await pickRole(user, "Logist");
    await user.click(saveButton());
    await user.click(
      within(await screen.findByRole("alertdialog", { name: "Rolni o'zgartirasizmi?" })).getByRole("button", {
        name: "Rolni o'zgartirish",
      }),
    );

    const alert = await screen.findByTestId("role-change-error");
    expect(alert).toHaveTextContent("Rolni o'zgartirib bo'lmadi. Sahifani yangilab, qayta urinib ko'ring.");
    expect(within(alert).queryByRole("button")).not.toBeInTheDocument();
  });

  it("qisman: rol o'zgardi, qolgani saqlanmadi — ogohlantirish, oyna ochiq, keyingi saqlashda rol qayta yuborilmaydi", async () => {
    mocks.updateUser.mockRejectedValueOnce(httpError(500));
    const user = userEvent.setup();
    const { onClose } = renderModal(makeUser());

    await pickRole(user, "Menejer");
    const nameInput = document.querySelector<HTMLInputElement>('input[name="name"]');
    if (!nameInput) throw new Error("name input not found");
    await user.type(nameInput, "!");
    await user.click(saveButton());
    await user.click(
      within(await screen.findByRole("alertdialog", { name: "Rolni o'zgartirasizmi?" })).getByRole("button", {
        name: "Rolni o'zgartirish",
      }),
    );

    expect(await screen.findByText("Rol o'zgartirildi, qolgani saqlanmadi")).toBeInTheDocument();
    expect(
      screen.getByText("Nilufar Rashidova endi menejer. Boshqa o'zgarishlar saqlanmadi — tekshirib, qayta saqlang."),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Foydalanuvchini tahrirlash" })).toHaveTextContent(
      "Nilufar Rashidova · Menejer",
    );

    await user.click(saveButton());
    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(2));
    expect(mocks.changeUserRole).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("Menejer → Admin: menejer tariflari yashirinadi va yuborilmaydi", async () => {
    const user = userEvent.setup();
    renderModal(makeUser({ role: "manager", tariff_home: 20000, tariff_center: 15000 }));

    expect(document.querySelector('input[name="tariff_home"]')).not.toBeNull();
    await pickRole(user, "Admin");
    expect(document.querySelector('input[name="tariff_home"]')).toBeNull();

    const salaryInput = document.querySelector<HTMLInputElement>('input[name="salary"]');
    if (!salaryInput) throw new Error("salary input not found");
    await user.clear(salaryInput);
    await user.type(salaryInput, "7000000");
    await user.click(saveButton());
    await user.click(
      within(await screen.findByRole("alertdialog", { name: "Rolni o'zgartirasizmi?" })).getByRole("button", {
        name: "Rolni o'zgartirish",
      }),
    );

    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(1));
    expect(mocks.updateUser).toHaveBeenCalledWith({ id: "41", data: { salary: 7000000 } });
  });

  it("rol o'zgarmasa — eski oqim (tasdiqsiz `PATCH /users/:id`)", async () => {
    const user = userEvent.setup();
    renderModal(makeUser());

    const nameInput = document.querySelector<HTMLInputElement>('input[name="name"]');
    if (!nameInput) throw new Error("name input not found");
    await user.type(nameInput, "!");
    await user.click(saveButton());

    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(1));
    expect(mocks.changeUserRole).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
