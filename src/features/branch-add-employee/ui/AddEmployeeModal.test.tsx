import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import AddEmployeeModal from "./AddEmployeeModal";

/**
 * «Xodim qo'shish» oynasi (maket `superadmin-branches-add-employee-dialog`): faqat faol menejer / ro'yxatchi /
 * kuryer (`GET /users`), «ism» + «login · rol», `POST /branches/:id/users { user_id }`, tanlovsiz yuborilmaydi.
 * Ega (2026-11-04): faqat filialsizlar (`branch_id` bo'sh) — boshqa filialdagini backend 409 bilan rad etadi; rollar
 * filial turiga mos (HQ — menejersiz, PICKUP — kuryersiz). Qidiruv serverga ham ketadi (`search`): har rol uchun
 * 100 tadan tashqaridagi eski filialsiz xodim ham topiladi; ro'yxat kesilgan bo'lsa «xodim yo'q» deyilmaydi.
 */
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../../../shared/api/instance", () => ({ api }));

// Gateway (`attachUserBranches`) har qatorga `branch_id` + `branch` qo'yadi: biriktirilmagan — `null`.
const USERS: Record<string, Array<Record<string, unknown>>> = {
  courier: [
    { id: 31, name: "Dilshod Karimov", username: "dilshod.k", role: "courier", status: "active", branch_id: null, branch: null },
    { id: 41, name: "Bekzod Toshev", username: "bekzod.t", role: "courier", status: "active", branch_id: "12", branch: { id: "12", name: "Urganch filiali" } },
  ],
  registrator: [
    { id: 32, name: "Kamola Yusupova", username: "kamola.y", role: "registrator", status: "active", branch_id: null, branch: null },
    { id: 42, name: "Malika Rahimova", username: "malika.r", role: "registrator", status: "active", branch_id: "1", branch: { id: "1", name: "Bosh ofis" } },
  ],
  manager: [
    { id: 33, name: "Umid Haydarov", username: "umid.h", role: "manager", status: "active", branch_id: null, branch: null },
    { id: 43, name: "Bahodir Aliyev", username: "bahodir.a", role: "manager", status: "active", branch_id: "15", branch: { id: "15", name: "Urgut filiali" } },
  ],
};

type Row = Record<string, unknown>;
type GetConfig = { params?: { role?: string; search?: string } };

/** Backend qidiruvi kabi: ism / login (ILIKE) yoki telefon raqamlari bo'yicha. */
const matchesSearch = (row: Row, search?: string) => {
  const needle = String(search ?? "").trim().toLowerCase();
  if (!needle) return true;
  const digits = needle.replace(/\D/g, "");
  return (
    [row.name, row.username].some((value) => String(value ?? "").toLowerCase().includes(needle)) ||
    (digits.length >= 3 && String(row.phone_number ?? "").replace(/\D/g, "").includes(digits))
  );
};

/** `GET /users`: `pool[role]` dan `search` bo'yicha; `search` siz — faqat `firstPage[role]` (backendning 100 talik sahifasi). */
const mockUsers = (firstPage: Record<string, Row[]>, pool: Record<string, Row[]> = firstPage) =>
  api.get.mockImplementation((_url: string, config?: GetConfig) => {
    const role = config?.params?.role ?? "";
    const search = config?.params?.search;
    const items = search ? (pool[role] ?? []).filter((row) => matchesSearch(row, search)) : (firstPage[role] ?? []);
    return Promise.resolve({ data: { statusCode: 200, data: { items } } });
  });

describe("AddEmployeeModal (v2)", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    mockUsers(USERS);
  });

  it("izoh filial nomi bilan; ro'yxatda «login · rol»; faqat faol menejer/ro'yxatchi/kuryer so'raladi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddEmployeeModal branchId="15" branchName="Urgut filiali" open onClose={vi.fn()} />);

    const dialog = await screen.findByRole("dialog", { name: "Xodim qo'shish" });
    expect(dialog).toHaveAccessibleDescription("Urgut filialiga foydalanuvchini biriktiring.");
    expect(
      within(dialog).getByText("Faqat hech qaysi filialga biriktirilmagan faol menejer, ro'yxatchi va kuryerlar ko'rsatiladi"),
    ).toBeInTheDocument();
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(3));
    for (const role of ["manager", "registrator", "courier"]) {
      expect(api.get).toHaveBeenCalledWith("users", {
        params: expect.objectContaining({ role, status: "active", page: 1, limit: 100 }),
      });
    }

    await user.click(within(dialog).getByRole("combobox", { name: /^Foydalanuvchi/ }));
    const option = await screen.findByRole("option", { name: /Dilshod Karimov/ });
    expect(option).toHaveTextContent("dilshod.k · Kuryer");
    expect(screen.getByRole("option", { name: /Umid Haydarov/ })).toHaveTextContent("umid.h · Menejer");
  });

  it("⭐ tanlangan foydalanuvchi — POST /branches/15/users { user_id }, xabar va yopiladi", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    api.post.mockResolvedValue({ data: { statusCode: 201 } });
    renderWithProviders(<AddEmployeeModal branchId="15" branchName="Urgut filiali" open onClose={onClose} />);

    const dialog = await screen.findByRole("dialog", { name: "Xodim qo'shish" });
    await user.click(within(dialog).getByRole("combobox", { name: /^Foydalanuvchi/ }));
    await user.click(await screen.findByRole("option", { name: /Kamola Yusupova/ }));
    await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("branches/15/users", { user_id: "32" }));
    expect(await screen.findByText("Xodim filialga qo'shildi")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("qidiruv ro'yxatni toraytiradi; ↓ + Enter tanlaydi (forma yuborilmaydi), «Qo'shish» yuboradi", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ data: { statusCode: 201 } });
    renderWithProviders(<AddEmployeeModal branchId="15" open onClose={vi.fn()} />);

    const dialog = await screen.findByRole("dialog", { name: "Xodim qo'shish" });
    const list = within(dialog).getByRole("listbox", { name: "Foydalanuvchilar" });
    await waitFor(() => expect(within(list).getAllByRole("option")).toHaveLength(3));

    await user.type(within(dialog).getByRole("combobox", { name: /^Foydalanuvchi/ }), "umid");
    expect(within(list).getAllByRole("option")).toHaveLength(1);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(within(list).getByRole("option", { name: /Umid Haydarov/ })).toHaveAttribute("aria-selected", "true");
    expect(api.post).not.toHaveBeenCalled();

    await user.clear(within(dialog).getByRole("combobox", { name: /^Foydalanuvchi/ }));
    await user.type(within(dialog).getByRole("combobox", { name: /^Foydalanuvchi/ }), "yo'q odam");
    // Server qidiruvi (300 ms) tugaguncha «topilmadi» chiqmaydi.
    expect(await within(list).findByText("Foydalanuvchi topilmadi")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("users", { params: expect.objectContaining({ search: "yo'q odam" }) });

    await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("branches/15/users", { user_id: "33" }));
  });

  it("tanlovsiz yuborilmaydi — «Foydalanuvchini tanlang» maydon ostida", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddEmployeeModal branchId="15" open onClose={vi.fn()} />);

    const dialog = await screen.findByRole("dialog", { name: "Xodim qo'shish" });
    expect(dialog).toHaveAccessibleDescription("Filialga foydalanuvchini biriktiring.");
    await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }));

    await waitFor(() =>
      expect(within(dialog).getByRole("combobox", { name: /^Foydalanuvchi/ })).toHaveAccessibleErrorMessage(
        "Foydalanuvchini tanlang",
      ),
    );
    expect(api.post).not.toHaveBeenCalled();
  });

  it("backend rad etsa — oyna ochiq, sabab xabarda", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    api.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { statusCode: 409, message: "Foydalanuvchi boshqa filialga biriktirilgan" } },
    });
    renderWithProviders(<AddEmployeeModal branchId="15" open onClose={onClose} />);

    const dialog = await screen.findByRole("dialog", { name: "Xodim qo'shish" });
    await user.click(within(dialog).getByRole("combobox", { name: /^Foydalanuvchi/ }));
    await user.click(await screen.findByRole("option", { name: /Dilshod Karimov/ }));
    await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }));

    expect(await screen.findByText("Foydalanuvchi boshqa filialga biriktirilgan")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Xodim qo'shish" })).toBeInTheDocument();
  });

  it("2026-11-04: filialga biriktirilganlar (boshqa filial ham, shu filial ham) ro'yxatda yo'q — faqat filialsizlar", async () => {
    renderWithProviders(<AddEmployeeModal branchId="15" branchName="Urgut filiali" open onClose={vi.fn()} />);

    const dialog = await screen.findByRole("dialog", { name: "Xodim qo'shish" });
    const list = within(dialog).getByRole("listbox", { name: "Foydalanuvchilar" });
    await waitFor(() => expect(within(list).getAllByRole("option")).toHaveLength(3));
    expect(within(list).getAllByRole("option").map((option) => option.textContent)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Umid Haydarov/), expect.stringMatching(/^Kamola Yusupova/), expect.stringMatching(/^Dilshod Karimov/)]),
    );
    for (const name of [/Bekzod Toshev/, /Malika Rahimova/, /Bahodir Aliyev/]) {
      expect(within(list).queryByRole("option", { name })).not.toBeInTheDocument();
    }
  });

  it("HQ filiali: menejerlar so'ralmaydi va ko'rsatilmaydi, izoh HQ ga mos", async () => {
    renderWithProviders(<AddEmployeeModal branchId="1" branchName="Bosh ofis" branchType="HQ" open onClose={vi.fn()} />);

    const dialog = await screen.findByRole("dialog", { name: "Xodim qo'shish" });
    expect(
      within(dialog).getByText(
        "Faqat hech qaysi filialga biriktirilmagan faol ro'yxatchi va kuryerlar ko'rsatiladi — HQ da menejer bo'lmaydi",
      ),
    ).toBeInTheDocument();
    const list = within(dialog).getByRole("listbox", { name: "Foydalanuvchilar" });
    await waitFor(() => expect(within(list).getAllByRole("option")).toHaveLength(2));
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.get).not.toHaveBeenCalledWith("users", { params: expect.objectContaining({ role: "manager" }) });
    expect(within(list).queryByRole("option", { name: /Umid Haydarov/ })).not.toBeInTheDocument();
    expect(within(list).getByRole("option", { name: /Kamola Yusupova/ })).toBeInTheDocument();
    expect(within(list).getByRole("option", { name: /Dilshod Karimov/ })).toBeInTheDocument();
  });

  it("hamma faol xodim filialga biriktirilgan — «Biriktirilmagan faol xodim yo'q …» (qidiruvsiz)", async () => {
    mockUsers(
      Object.fromEntries(Object.entries(USERS).map(([role, rows]) => [role, rows.filter((row) => row.branch_id != null)])),
    );
    renderWithProviders(<AddEmployeeModal branchId="15" open onClose={vi.fn()} />);

    const dialog = await screen.findByRole("dialog", { name: "Xodim qo'shish" });
    const list = within(dialog).getByRole("listbox", { name: "Foydalanuvchilar" });
    expect(
      await within(list).findByText(
        "Biriktirilmagan faol xodim yo'q. Boshqa filialdagi xodimni avval o'sha filialdan olib tashlang.",
      ),
    ).toBeInTheDocument();
    expect(within(list).queryAllByRole("option")).toHaveLength(0);
  });

  it("qabul punkti (PICKUP): kuryerlar so'ralmaydi va ko'rsatilmaydi (backend 403), izoh shunga mos", async () => {
    renderWithProviders(<AddEmployeeModal branchId="20" branchName="Chilonzor punkti" branchType="PICKUP" open onClose={vi.fn()} />);

    const dialog = await screen.findByRole("dialog", { name: "Xodim qo'shish" });
    expect(
      within(dialog).getByText(
        "Faqat hech qaysi filialga biriktirilmagan faol menejer va ro'yxatchilar ko'rsatiladi — qabul punktida kuryer bo'lmaydi",
      ),
    ).toBeInTheDocument();
    const list = within(dialog).getByRole("listbox", { name: "Foydalanuvchilar" });
    await waitFor(() => expect(within(list).getAllByRole("option")).toHaveLength(2));
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.get).not.toHaveBeenCalledWith("users", { params: expect.objectContaining({ role: "courier" }) });
    expect(within(list).getByRole("option", { name: /Umid Haydarov/ })).toBeInTheDocument();
    expect(within(list).getByRole("option", { name: /Kamola Yusupova/ })).toBeInTheDocument();
    expect(within(list).queryByRole("option", { name: /Dilshod Karimov/ })).not.toBeInTheDocument();
  });

  it("100 talik sahifa kesilgan: «xodim yo'q» deyilmaydi; eski filialsiz kuryer server qidiruvi bilan topiladi va qo'shiladi", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ data: { statusCode: 201 } });
    // Eng yangi 100 kuryer — hammasi filialda; filialsiz Xurshid eski (101-o'rinda), birinchi sahifaga sig'maydi.
    const assigned = Array.from({ length: 100 }, (_, index) => ({
      id: 1000 + index,
      name: `Kuryer ${index + 1}`,
      username: `kuryer.${index + 1}`,
      role: "courier",
      status: "active",
      branch_id: "12",
      branch: { id: "12", name: "Urganch filiali" },
    }));
    const old = {
      id: 77,
      name: "Xurshid Olimov",
      username: "xurshid.o",
      phone_number: "+998907771234",
      role: "courier",
      status: "active",
      branch_id: null,
      branch: null,
    };
    const firstPage = { courier: assigned, registrator: [USERS.registrator[1]], manager: [USERS.manager[1]] };
    mockUsers(firstPage, { ...firstPage, courier: [...assigned, old] });
    renderWithProviders(<AddEmployeeModal branchId="15" open onClose={vi.fn()} />);

    const dialog = await screen.findByRole("dialog", { name: "Xodim qo'shish" });
    const list = within(dialog).getByRole("listbox", { name: "Foydalanuvchilar" });
    expect(
      await within(list).findByText("Hammasi ko'rsatilmagan — ism, login yoki telefon bo'yicha qidiring"),
    ).toBeInTheDocument();
    expect(
      within(list).queryByText("Biriktirilmagan faol xodim yo'q. Boshqa filialdagi xodimni avval o'sha filialdan olib tashlang."),
    ).not.toBeInTheDocument();
    expect(within(list).queryAllByRole("option")).toHaveLength(0);

    const combobox = within(dialog).getByRole("combobox", { name: /^Foydalanuvchi/ });
    await user.type(combobox, "xurshid");
    const option = await within(list).findByRole("option", { name: /Xurshid Olimov/ });
    expect(api.get).toHaveBeenCalledWith("users", {
      params: expect.objectContaining({ role: "courier", search: "xurshid", status: "active", page: 1, limit: 100 }),
    });
    await user.click(option);
    await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("branches/15/users", { user_id: "77" }));
  });

  it("server telefonni raqamlar bo'yicha topganini ko'rsatadi (mahalliy matn mos kelmasa ham)", async () => {
    const user = userEvent.setup();
    const old = {
      id: 77,
      name: "Xurshid Olimov",
      username: "xurshid.o",
      phone_number: "+998907771234",
      role: "courier",
      status: "active",
      branch_id: null,
      branch: null,
    };
    mockUsers(USERS, { ...USERS, courier: [...USERS.courier, old] });
    renderWithProviders(<AddEmployeeModal branchId="15" open onClose={vi.fn()} />);

    const dialog = await screen.findByRole("dialog", { name: "Xodim qo'shish" });
    const list = within(dialog).getByRole("listbox", { name: "Foydalanuvchilar" });
    await waitFor(() => expect(within(list).getAllByRole("option")).toHaveLength(3));

    await user.type(within(dialog).getByRole("combobox", { name: /^Foydalanuvchi/ }), "90 777 12");
    expect(await within(list).findByRole("option", { name: /Xurshid Olimov/ })).toBeInTheDocument();
    expect(within(list).getAllByRole("option")).toHaveLength(1);
  });
});
