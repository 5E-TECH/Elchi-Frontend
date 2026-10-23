import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError } from "axios";
import { vi } from "vitest";
import ExpenseCategoriesOpsPage from "./index";
import { renderWithProviders } from "../../test/test-utils";

/**
 * Elchi Pochta №1 — Ops → «Xarajat kategoriyalari» (superadmin; ilgari «Asosiy kassa» oynasi edi): ro'yxat (tartib,
 * nom, «Nimalar kiradi»), bo'sh / xato holatlari, qo'shish / tahrirlash oynasi (faqat o'zgargan maydonlar, 409 —
 * «Nomi» ostida, 404 — xabar va ro'yxat), o'chirish tasdiq bilan. Haqiqiy react-query hook'lari, `ConfirmHost` va
 * `Toaster` — faqat HTTP almashtirilgan.
 */

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("../../shared/api/api", () => ({ api: http }));

const URL = "finance/cashbox/expense-categories";
const superadmin = { role: { id: "1", role: "superadmin", region: null, name: "Bosh admin" } } as never;

type Row = { id: string; name: string; description: string | null; sort_order: number; is_deleted: boolean };
const row = (id: string, name: string, sortOrder: number, description: string | null = null): Row => ({
  id,
  name,
  description,
  sort_order: sortOrder,
  is_deleted: false,
});

let rows: Row[] = [];
const httpError = (status: number, message: string) =>
  Object.assign(new AxiosError(`Request failed with status code ${status}`, "ERR_BAD_REQUEST"), {
    response: { status, data: { statusCode: status, message } },
  });

/** Soxta PATCH — server holatini ham yangilaydi (keyingi qayta so'rov yangi qiymatni qaytaradi). */
const patchServer = () =>
  http.patch.mockImplementation(async (url: string, body: Partial<Row>) => {
    const id = url.split("/").pop();
    rows = rows.map((item) => (item.id === id ? { ...item, ...body } : item));
    return { data: { statusCode: 200, data: { category: rows.find((item) => item.id === id) } } };
  });

beforeEach(() => {
  rows = [
    row("1", "Ovqatlanish", 1, "Xodimlarning ovqati, tushlik"),
    row("2", "Yoqilg'i", 2, "Benzin, gaz, dizel"),
    row("17", "Qaytarilgan pullar", 17),
  ];
  Object.values(http).forEach((fn) => fn.mockReset());
  http.get.mockImplementation(async () => ({ data: { statusCode: 200, data: { items: rows } } }));
});

const open = () => renderWithProviders(<ExpenseCategoriesOpsPage embedded />, { preloadedState: superadmin });

const listCard = () => screen.findByRole("region", { name: "Kategoriyalar" });
const items = () =>
  within(screen.getByRole("list", { name: "Xarajat kategoriyalari" })).getAllByRole("listitem");
const loaded = async (count = 3) => {
  await waitFor(() => expect(items()).toHaveLength(count));
};
const addButton = () => screen.getByRole("button", { name: "Kategoriya qo'shish" });

describe("Ops → Xarajat kategoriyalari — ro'yxat", () => {
  it("kirish kartasi; faol kategoriyalar tartib bo'yicha: raqam, nom, tavsif (yo'q bo'lsa izoh), amallar; sarlavhada soni", async () => {
    open();
    expect(screen.getByRole("heading", { level: 2, name: "Kassa xarajatlari kategoriyalari" })).toBeInTheDocument();
    // Hub ichida (`embedded`) — o'z sahifa sarlavhasi yo'q.
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    const card = await listCard();
    await loaded();
    expect(within(card).getByText("3 ta")).toBeInTheDocument();
    const [first, , last] = items();
    expect(first).toHaveTextContent("Tartib raqami: 1");
    expect(first).toHaveTextContent("Ovqatlanish");
    expect(first).toHaveTextContent("Xodimlarning ovqati, tushlik");
    expect(last).toHaveTextContent("Tavsif yozilmagan");
    expect(within(first).getByRole("button", { name: "«Ovqatlanish» kategoriyasini tahrirlash" })).toBeInTheDocument();
    expect(within(first).getByRole("button", { name: "«Ovqatlanish» kategoriyasini o'chirish" })).toBeInTheDocument();
    expect(addButton()).toBeEnabled();
    expect(http.get).toHaveBeenCalledWith(URL, { params: undefined });
  });

  it("yuklanmasa — xato holati va «Qayta urinish»; «Kategoriya qo'shish» ro'yxatsiz o'chiq", async () => {
    http.get.mockRejectedValueOnce(httpError(500, "Internal server error"));
    const user = userEvent.setup();
    open();
    const card = await listCard();
    expect(await within(card).findByText("Kategoriyalarni yuklab bo'lmadi")).toBeInTheDocument();
    expect(addButton()).toBeDisabled();
    await user.click(within(card).getByRole("button", { name: /Qayta urinish/ }));
    await loaded();
    expect(addButton()).toBeEnabled();
  });

  it("faol kategoriya yo'q — bo'sh holat, qo'shish ochiq", async () => {
    rows = [];
    open();
    const card = await listCard();
    expect(await within(card).findByText("Kategoriyalar yo'q")).toBeInTheDocument();
    expect(
      within(card).getByText("Kategoriya qo'shing — u «Kassadan xarajat» oynasidagi ro'yxatda chiqadi"),
    ).toBeInTheDocument();
    await waitFor(() => expect(addButton()).toBeEnabled());
  });
});

describe("Ops → Xarajat kategoriyalari — qo'shish", () => {
  it("bo'sh nom — xato, so'rov yo'q; to'ldirilsa aynan { name, description, sort_order }, oyna yopiladi, ro'yxatda chiqadi", async () => {
    http.post.mockImplementation(async (_url: string, body: { name: string; description?: string; sort_order?: number }) => {
      const created = row("18", body.name, body.sort_order ?? 18, body.description ?? null);
      rows = [...rows, created];
      return { data: { statusCode: 201, message: "Kategoriya qo'shildi", data: { category: created } } };
    });
    const user = userEvent.setup();
    open();
    await loaded();

    await user.click(addButton());
    const form = await screen.findByRole("dialog", { name: "Kategoriya qo'shish" });
    await waitFor(() => expect(within(form).getByLabelText(/^Nomi/)).toHaveFocus());
    await user.click(within(form).getByRole("button", { name: "Qo'shish" }));
    expect(await within(form).findByText("Kategoriya nomini yozing")).toBeInTheDocument();
    expect(http.post).not.toHaveBeenCalled();

    await user.type(within(form).getByLabelText(/^Nomi/), "  Bank   xizmati ");
    await user.type(within(form).getByLabelText(/^Nimalar kiradi/), "Komissiya, karta xizmati");
    await user.type(within(form).getByLabelText(/^Tartib raqami/), "5");
    await user.click(within(form).getByRole("button", { name: "Qo'shish" }));

    await waitFor(() => expect(http.post).toHaveBeenCalledTimes(1));
    expect(http.post).toHaveBeenCalledWith(URL, {
      name: "Bank xizmati",
      description: "Komissiya, karta xizmati",
      sort_order: 5,
    });
    expect(await screen.findByText("Kategoriya qo'shildi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Kategoriya qo'shish" })).not.toBeInTheDocument());
    await waitFor(() =>
      expect(items().map((item) => item.textContent)).toContain("Tartib raqami: 55Bank xizmatiKomissiya, karta xizmati"),
    );
  });

  it("ixtiyoriy maydonlar bo'sh — faqat { name } (backend oxiriga qo'yadi); qayta ochilganda forma bo'sh", async () => {
    http.post.mockResolvedValue({ data: { statusCode: 201, data: { category: row("18", "Bank", 18) } } });
    const user = userEvent.setup();
    open();
    await loaded();
    await user.click(addButton());
    let form = await screen.findByRole("dialog", { name: "Kategoriya qo'shish" });
    await user.type(within(form).getByLabelText(/^Nomi/), "Bank");
    await user.click(within(form).getByRole("button", { name: "Qo'shish" }));
    await waitFor(() => expect(http.post).toHaveBeenCalledWith(URL, { name: "Bank" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Kategoriya qo'shish" })).not.toBeInTheDocument());

    await user.click(addButton());
    form = await screen.findByRole("dialog", { name: "Kategoriya qo'shish" });
    expect(within(form).getByLabelText(/^Nomi/)).toHaveValue("");
  });

  it("takror nom (409) — «Nomi» ostida backend matni, oyna ochiq qoladi", async () => {
    http.post.mockRejectedValue(httpError(409, "\"Yoqilg'i\" nomli kategoriya allaqachon bor"));
    const user = userEvent.setup();
    open();
    await loaded();
    await user.click(addButton());
    const form = await screen.findByRole("dialog", { name: "Kategoriya qo'shish" });
    await user.type(within(form).getByLabelText(/^Nomi/), "yoqilg'i");
    await user.click(within(form).getByRole("button", { name: "Qo'shish" }));

    expect(await within(form).findByText("\"Yoqilg'i\" nomli kategoriya allaqachon bor")).toBeInTheDocument();
    expect(within(form).getByLabelText(/^Nomi/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("dialog", { name: "Kategoriya qo'shish" })).toBeInTheDocument();
    expect(screen.queryByText("Kategoriya qo'shildi")).not.toBeInTheDocument();
  });

  it("noto'g'ri tartib raqami — xato, so'rov yo'q; «Bekor qilish» oynani yopadi", async () => {
    const user = userEvent.setup();
    open();
    await loaded();
    await user.click(addButton());
    const form = await screen.findByRole("dialog", { name: "Kategoriya qo'shish" });
    await user.type(within(form).getByLabelText(/^Nomi/), "Bank");
    await user.type(within(form).getByLabelText(/^Tartib raqami/), "2000000");
    await user.click(within(form).getByRole("button", { name: "Qo'shish" }));
    expect(await within(form).findByText("0 dan 1 000 000 gacha butun son yozing")).toBeInTheDocument();
    expect(http.post).not.toHaveBeenCalled();

    await user.click(within(form).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Kategoriya qo'shish" })).not.toBeInTheDocument());
    expect(http.post).not.toHaveBeenCalled();
  });
});

describe("Ops → Xarajat kategoriyalari — tahrirlash", () => {
  const openEdit = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await user.click(screen.getByRole("button", { name: `«${name}» kategoriyasini tahrirlash` }));
    return screen.findByRole("dialog", { name: "Kategoriyani tahrirlash" });
  };

  it("maydonlar to'ldirilgan; faqat o'zgarganlar ketadi, bo'shatilgan tavsif — null", async () => {
    patchServer();
    const user = userEvent.setup();
    open();
    await loaded();
    const form = await openEdit(user, "Yoqilg'i");
    expect(within(form).getByLabelText(/^Nomi/)).toHaveValue("Yoqilg'i");
    expect(within(form).getByLabelText(/^Nimalar kiradi/)).toHaveValue("Benzin, gaz, dizel");
    expect(within(form).getByLabelText(/^Tartib raqami/)).toHaveValue("2");

    await user.clear(within(form).getByLabelText(/^Nomi/));
    await user.type(within(form).getByLabelText(/^Nomi/), "Yoqilg'i va moy");
    await user.clear(within(form).getByLabelText(/^Nimalar kiradi/));
    await user.click(within(form).getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(http.patch).toHaveBeenCalledTimes(1));
    expect(http.patch).toHaveBeenCalledWith(`${URL}/2`, { name: "Yoqilg'i va moy", description: null });
    expect(await screen.findByText("Kategoriya saqlandi")).toBeInTheDocument();
    expect(await screen.findByText("Yoqilg'i va moy")).toBeInTheDocument();
  });

  it("boshqa qator ochilsa — o'sha kategoriya qiymatlari; o'zgarishsiz «Saqlash» so'rovsiz yopiladi; tartib — faqat { sort_order }", async () => {
    patchServer();
    const user = userEvent.setup();
    open();
    await loaded();
    let form = await openEdit(user, "Ovqatlanish");
    await user.click(within(form).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Kategoriyani tahrirlash" })).not.toBeInTheDocument());

    form = await openEdit(user, "Qaytarilgan pullar");
    expect(within(form).getByLabelText(/^Nomi/)).toHaveValue("Qaytarilgan pullar");
    expect(within(form).getByLabelText(/^Nimalar kiradi/)).toHaveValue("");
    await user.click(within(form).getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Kategoriyani tahrirlash" })).not.toBeInTheDocument());
    expect(http.patch).not.toHaveBeenCalled();

    form = await openEdit(user, "Qaytarilgan pullar");
    await user.clear(within(form).getByLabelText(/^Tartib raqami/));
    await user.type(within(form).getByLabelText(/^Tartib raqami/), "0");
    await user.click(within(form).getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(http.patch).toHaveBeenCalledWith(`${URL}/17`, { sort_order: 0 }));
    // Kesh darhol: yangi tartib — ro'yxat boshida.
    await waitFor(() => expect(items()[0]).toHaveTextContent("Qaytarilgan pullar"));
  });

  it("topilmadi (404) — xabar, oyna yopiladi va ro'yxat qayta so'raladi", async () => {
    http.patch.mockRejectedValue(httpError(404, "Kategoriya topilmadi"));
    const user = userEvent.setup();
    open();
    await loaded();
    const form = await openEdit(user, "Ovqatlanish");
    const getsBefore = http.get.mock.calls.length;
    rows = rows.filter((item) => item.id !== "1");
    await user.type(within(form).getByLabelText(/^Nomi/), " va choy");
    await user.click(within(form).getByRole("button", { name: "Saqlash" }));

    expect(await screen.findByText("Kategoriya topilmadi")).toBeInTheDocument();
    expect(screen.getByText("U o'chirilgan bo'lishi mumkin — ro'yxat yangilandi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Kategoriyani tahrirlash" })).not.toBeInTheDocument());
    await waitFor(() => expect(http.get.mock.calls.length).toBeGreaterThan(getsBefore));
    await loaded(2);
  });
});

describe("Ops → Xarajat kategoriyalari — o'chirish", () => {
  it("tasdiq: nom, tavsif, tarix eslatmasi; bekor — so'rov yo'q; «O'chirish» — DELETE va ro'yxatdan chiqadi", async () => {
    http.delete.mockImplementation(async (url: string) => {
      const id = url.split("/").pop();
      const removed = rows.find((item) => item.id === id)!;
      rows = rows.filter((item) => item.id !== id);
      return { data: { statusCode: 200, data: { category: { ...removed, is_deleted: true } } } };
    });
    const user = userEvent.setup();
    open();
    await loaded();

    await user.click(screen.getByRole("button", { name: "«Yoqilg'i» kategoriyasini o'chirish" }));
    let confirm = await screen.findByRole("alertdialog", { name: "O'chirishni tasdiqlang" });
    expect(within(confirm).getByText("Yoqilg'i")).toBeInTheDocument();
    expect(within(confirm).getByText("Benzin, gaz, dizel")).toBeInTheDocument();
    expect(within(confirm).getByText("Avval yozilgan xarajatlarda kategoriya nomi saqlanib qoladi.")).toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(http.delete).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "«Yoqilg'i» kategoriyasini o'chirish" }));
    confirm = await screen.findByRole("alertdialog", { name: "O'chirishni tasdiqlang" });
    await user.click(within(confirm).getByRole("button", { name: "O'chirish" }));

    await waitFor(() => expect(http.delete).toHaveBeenCalledWith(`${URL}/2`));
    expect(await screen.findByText("Kategoriya o'chirildi")).toBeInTheDocument();
    await loaded(2);
    expect(within(screen.getByRole("list", { name: "Xarajat kategoriyalari" })).queryByText("Yoqilg'i")).not.toBeInTheDocument();
  });

  it("o'chirish rad etilsa (404) — xato tasdiq oynasi ichida, ro'yxat qayta so'raladi", async () => {
    http.delete.mockRejectedValue(httpError(404, "Kategoriya topilmadi"));
    const user = userEvent.setup();
    open();
    await loaded();
    const getsBefore = http.get.mock.calls.length;

    await user.click(screen.getByRole("button", { name: "«Ovqatlanish» kategoriyasini o'chirish" }));
    const confirm = await screen.findByRole("alertdialog", { name: "O'chirishni tasdiqlang" });
    await user.click(within(confirm).getByRole("button", { name: "O'chirish" }));
    expect(await within(confirm).findByText(/Kategoriya topilmadi/)).toBeInTheDocument();
    await waitFor(() => expect(http.get.mock.calls.length).toBeGreaterThan(getsBefore));
    expect(screen.queryByText("Kategoriya o'chirildi")).not.toBeInTheDocument();
  });
});
