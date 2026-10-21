import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { UserListTable } from "./UserListTable";
import { renderWithProviders } from "../../../test/test-utils";

const navigateMock = vi.fn();
const updateUserStatusMutateMock = vi.fn();
const deleteUserMutateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    updateUserStatus: { mutate: updateUserStatusMutateMock },
    deleteUser: { mutate: deleteUserMutateMock, isPending: false },
    // «Tahrirlash» oynasi (`UpdateUserModal`) — `initialUser` bilan so'rov yubormaydi.
    useGetUserById: () => ({ data: undefined, isLoading: false }),
    updateUser: { mutateAsync: vi.fn(), isPending: false },
    updateMyProfile: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const users = [
  {
    id: "1",
    name: "Ali Valiyev",
    phone_number: "+998901234567",
    role: "admin",
    status: "active",
    createdAt: "2026-09-03T09:00:00.000Z",
  },
  {
    id: "2",
    name: "Vali",
    phone_number: "+998909876543",
    role: "courier",
    status: "inactive",
    createdAt: "2026-09-01T09:00:00.000Z",
  },
];

const openMenu = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(screen.getByRole("button", { name: `${name} amallari` }));
  return screen.findByRole("menu", { name: `${name} amallari` });
};

describe("UserListTable (dizayn v2)", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    updateUserStatusMutateMock.mockReset();
    deleteUserMutateMock.mockReset();
  });

  it("qatorlar: avatar bosh harflari, formatlangan telefon, rol va holat badge'lari", () => {
    renderWithProviders(<UserListTable users={users as never} canManage />);

    const table = screen.getByRole("table", { name: "Foydalanuvchilar ro'yxati" });
    const aliRow = within(table).getByText("Ali Valiyev").closest("tr");
    expect(aliRow).not.toBeNull();
    const row = within(aliRow as HTMLElement);
    expect(row.getByText("AV")).toBeInTheDocument();
    expect(row.getAllByText("+998 90 123 45 67").length).toBeGreaterThan(0);
    expect(row.getByText("Admin")).toBeInTheDocument();
    expect(row.getByText("Faol")).toBeInTheDocument();
    expect(within(table).getByText("Nofaol")).toBeInTheDocument();
  });

  it("qator bosilsa — foydalanuvchi tafsilotiga o'tadi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserListTable users={users as never} />);

    await user.click(screen.getAllByText("+998 90 987 65 43")[0]);

    expect(navigateMock).toHaveBeenCalledWith("/all-users/2");
  });

  it("nofaol qilish — avval tasdiq oynasi, so'ng PATCH status", async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserListTable users={users as never} canManage />);

    const menu = await openMenu(user, "Ali Valiyev");
    await user.click(within(menu).getByRole("menuitem", { name: "Nofaol qilish" }));

    // Nofaol qilish — avval tasdiqlash oynasi (DESIGN_SYSTEM §8); tasdiqsiz so'rov ketmaydi.
    const dialog = await screen.findByRole("alertdialog", { name: "Nofaol qilishni tasdiqlang" });
    expect(dialog).toHaveTextContent("Ali Valiyev hisobi nofaol holatga o'tadi.");
    expect(updateUserStatusMutateMock).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Nofaol qilish" }));

    expect(updateUserStatusMutateMock).toHaveBeenCalledWith({ id: "1", status: "inactive" }, expect.any(Object));
  });

  it("tasdiq bekor qilinsa — holat o'zgarmaydi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserListTable users={users as never} canManage />);

    const menu = await openMenu(user, "Ali Valiyev");
    await user.click(within(menu).getByRole("menuitem", { name: "Nofaol qilish" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));

    expect(updateUserStatusMutateMock).not.toHaveBeenCalled();
  });

  it("menyu amalidan keyin fokus kebab tugmasiga qaytadi (body'ga tushmaydi)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserListTable users={users as never} canManage />);
    const trigger = screen.getByRole("button", { name: "Vali amallari" });

    // Tasdiqsiz amal — menyu yopilgach fokus darhol tugmada.
    let menu = await openMenu(user, "Vali");
    await user.click(within(menu).getByRole("menuitem", { name: "Faol qilish" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    // Tasdiq oynasi yopilgach (bekor) — fokus yana shu tugmaga qaytadi.
    const aliTrigger = screen.getByRole("button", { name: "Ali Valiyev amallari" });
    menu = await openMenu(user, "Ali Valiyev");
    await user.click(within(menu).getByRole("menuitem", { name: "Nofaol qilish" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(aliTrigger).toHaveFocus());
  });

  it("nofaol foydalanuvchini faol qilish — tasdiqsiz", async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserListTable users={users as never} canManage />);

    const menu = await openMenu(user, "Vali");
    await user.click(within(menu).getByRole("menuitem", { name: "Faol qilish" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(updateUserStatusMutateMock).toHaveBeenCalledWith({ id: "2", status: "active" }, expect.any(Object));
  });

  it("holat o'zgarsa — muvaffaqiyat xabari", async () => {
    updateUserStatusMutateMock.mockImplementation((_vars, options: { onSuccess?: () => void; onSettled?: () => void }) => {
      options.onSuccess?.();
      options.onSettled?.();
    });
    const user = userEvent.setup();
    renderWithProviders(<UserListTable users={users as never} canManage />);

    const menu = await openMenu(user, "Vali");
    await user.click(within(menu).getByRole("menuitem", { name: "Faol qilish" }));

    expect(await screen.findByText('"Vali" foydalanuvchisi faol qilindi')).toBeInTheDocument();
  });

  it("o'chirish — maketdagi tasdiq oynasi matni, so'ng DELETE", async () => {
    deleteUserMutateMock.mockImplementation((_id, options: { onSuccess?: () => void }) => options.onSuccess?.());
    const user = userEvent.setup();
    renderWithProviders(<UserListTable users={users as never} canManage />);

    const menu = await openMenu(user, "Ali Valiyev");
    await user.click(within(menu).getByRole("menuitem", { name: "O'chirish" }));

    const dialog = await screen.findByRole("alertdialog", { name: "Foydalanuvchini o'chirish" });
    expect(dialog).toHaveTextContent("«Ali Valiyev» foydalanuvchisini o'chirishni tasdiqlaysizmi?");
    expect(dialog).toHaveTextContent("Admin · +998 90 123 45 67");
    expect(dialog).toHaveTextContent("Hisobni vaqtincha to'xtatish kerak bo'lsa, o'chirish o'rniga nofaol qiling.");
    expect(deleteUserMutateMock).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));

    expect(deleteUserMutateMock).toHaveBeenCalledWith("1", expect.any(Object));
    expect(await screen.findByText('"Ali Valiyev" muvaffaqiyatli o\'chirildi')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("o'chirish rad etilsa — backend matni xabarda, oyna ochiq qoladi", async () => {
    deleteUserMutateMock.mockImplementation((_id, options: { onError?: (error: unknown) => void }) =>
      options.onError?.({ response: { status: 409, data: { message: "Kuryerda pul bor" } } }),
    );
    const user = userEvent.setup();
    renderWithProviders(<UserListTable users={users as never} canManage />);

    const menu = await openMenu(user, "Ali Valiyev");
    await user.click(within(menu).getByRole("menuitem", { name: "O'chirish" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Foydalanuvchini o'chirish" });
    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));

    expect(await screen.findByText("Kuryerda pul bor")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog", { name: "Foydalanuvchini o'chirish" })).toBeInTheDocument();
  });

  it("server matni bo'lmasa — axios'ning inglizcha matni emas, o'zbekcha zaxira matn", async () => {
    deleteUserMutateMock.mockImplementation((_id, options: { onError?: (error: unknown) => void }) =>
      options.onError?.({ message: "Request failed with status code 500", response: { status: 500, data: {} } }),
    );
    const user = userEvent.setup();
    renderWithProviders(<UserListTable users={users as never} canManage />);

    const menu = await openMenu(user, "Ali Valiyev");
    await user.click(within(menu).getByRole("menuitem", { name: "O'chirish" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Foydalanuvchini o'chirish" });
    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));

    expect(await screen.findByText("Foydalanuvchini o'chirishda xatolik yuz berdi")).toBeInTheDocument();
    expect(screen.queryByText("Request failed with status code 500")).not.toBeInTheDocument();
  });

  it("«Tahrirlash» — tahrirlash oynasini shu foydalanuvchi bilan ochadi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserListTable users={users as never} canManage />, {
      preloadedState: { role: { id: "9", role: "superadmin", region: null, name: "SA" } } as never,
    });

    const menu = await openMenu(user, "Ali Valiyev");
    await user.click(within(menu).getByRole("menuitem", { name: "Tahrirlash" }));

    const dialog = await screen.findByRole("dialog", { name: "Foydalanuvchini tahrirlash" });
    expect(dialog).toHaveTextContent("Ali Valiyev · Admin");
  });

  it.each([
    ["market_operator", "Market operatori", "Kamola Yusupova"],
    ["logist", "Logist", "Dilshod Karimov"],
    ["investor", "Investor", "Sherzod Umarov"],
  ])("yangi rol (%s) qatorida — rol yorlig'i va to'liq qator menyusi (FY-S2)", async (role, label, name) => {
    updateUserStatusMutateMock.mockImplementation((_vars, options: { onSuccess?: () => void; onSettled?: () => void }) => {
      options.onSuccess?.();
      options.onSettled?.();
    });
    const user = userEvent.setup();
    const row = { id: "77", name, phone_number: "+998993715264", role, status: "active", createdAt: "2026-08-28T19:25:00.000Z" };
    renderWithProviders(<UserListTable users={[row] as never} canManage />);

    const table = screen.getByRole("table", { name: "Foydalanuvchilar ro'yxati" });
    expect(within(within(table).getByText(name).closest("tr") as HTMLElement).getByText(label)).toBeInTheDocument();

    const menu = await openMenu(user, name);
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Tahrirlash",
      "Nofaol qilish",
      "O'chirish",
    ]);

    // Superadmin market operatorini (va boshqa yangi rollarni) nofaol qila oladi — tasdiq bilan (FY-S2).
    await user.click(within(menu).getByRole("menuitem", { name: "Nofaol qilish" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Nofaol qilishni tasdiqlang" });
    await user.click(within(dialog).getByRole("button", { name: "Nofaol qilish" }));
    expect(updateUserStatusMutateMock).toHaveBeenCalledWith({ id: "77", status: "inactive" }, expect.any(Object));
  });

  it("boshqarish huquqi bo'lmasa (menejer, fix3 RBAC-16) — amallar menyusi yo'q, faqat «Ochish»", () => {
    renderWithProviders(<UserListTable users={users as never} />);

    expect(screen.getByText("Ali Valiyev")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /amallari$/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Ali Valiyev tafsilotlari" })[0]).toHaveAttribute(
      "href",
      "/all-users/1",
    );
    expect(updateUserStatusMutateMock).not.toHaveBeenCalled();
  });
});

/** Telefon kengligi (`useIsPhone` — `matchMedia("(max-width: 767px)")`). */
const asPhone = () => {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query.includes("max-width: 767px"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
};

describe("UserListTable — «Telegram boti» ustuni (TG-B, `*-users-list-telegram`)", () => {
  const telegramUsers = [
    { ...users[0], telegram_linked: true },
    { ...users[1], telegram_linked: false },
    { id: "3", name: "Eski javob", phone_number: "+998901112233", role: "market", status: "active" },
    { id: "4", name: "Karim Investov", phone_number: "+998904445566", role: "investor", status: "active", telegram_linked: false },
  ];

  it("superadmin/admin: «Holat» dan keyin «Telegram boti» (izohli sarlavha), «Ulangan» / «Ulanmagan», maydon yo'q yoki ulab bo'lmaydi — «—»", () => {
    renderWithProviders(<UserListTable users={telegramUsers as never} canManage />);

    const table = screen.getByRole("table", { name: "Foydalanuvchilar ro'yxati" });
    const headers = within(table).getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(headers.indexOf("Telegram boti")).toBe(headers.indexOf("Holat") + 1);
    expect(within(table).getByTitle("Shaxsiy Elchi boti ulanishi")).toHaveTextContent("Telegram boti");

    const rowOf = (name: string) => within(within(table).getByText(name).closest("tr") as HTMLElement);
    expect(rowOf("Ali Valiyev").getByText("Ulangan")).toBeInTheDocument();
    expect(rowOf("Vali").getByText("Ulanmagan")).toBeInTheDocument();
    expect(rowOf("Eski javob").queryByText(/Ulan/)).not.toBeInTheDocument();
    expect(rowOf("Karim Investov").getByLabelText("Ulab bo'lmaydi")).toHaveTextContent("—");
  });

  it("menejerda (boshqaruvsiz) ustun yo'q", () => {
    renderWithProviders(<UserListTable users={telegramUsers as never} />);
    expect(screen.queryByRole("columnheader", { name: "Telegram boti" })).not.toBeInTheDocument();
    expect(screen.queryByText("Ulangan")).not.toBeInTheDocument();
  });

  it("telefon kartasi: rol va holatdan keyin «Bot ulangan» / «Bot ulanmagan»", () => {
    const restore = asPhone();
    try {
      renderWithProviders(<UserListTable users={telegramUsers as never} canManage />);
      expect(screen.getByText("Bot ulangan")).toBeInTheDocument();
      expect(screen.getByText("Bot ulanmagan")).toBeInTheDocument();
      expect(screen.getAllByText(/^Bot /)).toHaveLength(2);
    } finally {
      restore();
    }
  });
});
