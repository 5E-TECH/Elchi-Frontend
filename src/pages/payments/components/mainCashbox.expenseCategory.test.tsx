import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import MainCashbox from "./mainCashbox";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * Elchi Pochta №1 — «Kassadan xarajat» oynasidagi «Xarajat kategoriyasi» tanlovi:
 *  - faqat chiqimda; ixtiyoriy — tanlanmasa payload'da `expense_category_id` kaliti umuman yo'q;
 *  - tanlansa ID yuboriladi va tasdiq oynasida «Kategoriya» qatori bor;
 *  - to'ldirishda maydon ham, ro'yxat so'rovi ham, kalit ham yo'q (backend `fill` 400 beradi);
 *  - ro'yxat yuklanmasa forma ishlayveradi; o'chirilgan kategoriya (400) — backend matni, ro'yxat qayta o'qiladi,
 *    eskirgan tanlov tozalanadi.
 *
 * Haqiqiy `useCashBox` / `useExpenseCategories` (react-query), haqiqiy oyna va `ConfirmHost` — faqat HTTP qatlami
 * almashtirilgan.
 */

type PatchCall = [string, Record<string, unknown>, { headers?: Record<string, string> } | undefined];

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: http,
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));
vi.mock("./lib/exportMainCashboxReport", () => ({ exportMainCashboxReport: vi.fn() }));
vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetUser: () => ({ data: undefined, isLoading: false }),
    useGetUserById: () => ({ data: undefined, isLoading: false }),
    useGetManagers: () => ({ data: undefined, isLoading: false }),
    useGetCouriers: () => ({ data: undefined, isLoading: false }),
  }),
}));
vi.mock("../../../entities/markets", () => ({
  useMarkets: () => ({ useGetMarkets: () => ({ data: undefined, isLoading: false }) }),
}));
vi.mock("../../../entities/branch/api/useBranches", () => ({
  useBranches: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("./SalaryPaymentPopup", () => ({ default: () => null }));
vi.mock("./MainCashboxBalanceChart", () => ({ default: () => null }));

const FILL_URL = "finance/cashbox/fill";
const SPEND_URL = "finance/cashbox/spend";
const CATEGORIES_URL = "finance/cashbox/expense-categories";

const admin = { role: { id: "2", role: "admin", region: null, name: "Admin" } } as never;

const category = (id: string, name: string, sortOrder: number, description: string | null = null) => ({
  id,
  name,
  description,
  sort_order: sortOrder,
  is_deleted: false,
  created_by: null,
  updated_by: null,
  created_at: "2026-10-21T08:00:00.000Z",
  updated_at: "2026-10-21T08:00:00.000Z",
});

let categoryRows = [
  category("1", "Ovqatlanish", 1, "Xodimlarning ovqati, tushlik"),
  category("2", "Yoqilg'i", 2, "Benzin, gaz, dizel"),
  category("4", "Ijara (arenda)", 4, "Filial, ombor, ofis ijarasi"),
];
let categoriesFail = false;

const patches = (url: string) =>
  (http.patch.mock.calls as PatchCall[]).filter(([patchUrl]) => patchUrl === url);
const categoryGets = () => http.get.mock.calls.filter(([url]) => url === CATEGORIES_URL).length;

const httpError = (status: number, message: string) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: { statusCode: status, message } },
  });

const open = () => renderWithProviders(<MainCashbox />, { route: "/payments/main-cashbox", preloadedState: admin });

const openSpend = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: /Kassadan xarajat/ }));
  return screen.findByRole("dialog", { name: "Kassadan xarajat" });
};

const fillRequired = async (
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  { amount = "150000", comment = "Benzin, oktabr" } = {},
) => {
  await user.type(within(dialog).getByLabelText(/^Summa/), amount);
  await user.click(within(dialog).getByRole("radio", { name: "Naqd" }));
  await user.type(within(dialog).getByLabelText(/^Izoh/), comment);
};

const categoryField = (dialog: HTMLElement) =>
  within(dialog).getByRole("combobox", { name: /Xarajat kategoriyasi/ });

const chooseCategory = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, name: RegExp) => {
  await user.click(categoryField(dialog));
  await user.click(await screen.findByRole("option", { name }));
};

const confirmOperation = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
  const confirm = await screen.findByRole("alertdialog", { name: title });
  return { confirm, submit: () => user.click(within(confirm).getByRole("button", { name: "Tasdiqlash" })) };
};

beforeEach(() => {
  window.sessionStorage.clear();
  categoryRows = [
    category("1", "Ovqatlanish", 1, "Xodimlarning ovqati, tushlik"),
    category("2", "Yoqilg'i", 2, "Benzin, gaz, dizel"),
    category("4", "Ijara (arenda)", 4, "Filial, ombor, ofis ijarasi"),
  ];
  categoriesFail = false;
  Object.values(http).forEach((fn) => fn.mockReset());
  http.get.mockImplementation(async (url: string) => {
    if (url === "finance/shift/current") {
      return {
        data: {
          statusCode: 200,
          message: "Current shift",
          data: { shift: { id: "12", opened_by: "2", status: "open", opened_at: "2026-10-01T04:00:00.000Z" }, required: true },
        },
      };
    }
    if (url === CATEGORIES_URL) {
      if (categoriesFail) throw httpError(500, "Internal server error");
      return { data: { statusCode: 200, message: "Xarajat kategoriyalari", data: { items: categoryRows } } };
    }
    return { data: { statusCode: 200, message: "success", data: {} } };
  });
  http.patch.mockImplementation(async () => ({ data: { statusCode: 200, message: "ok", data: { id: "900" } } }));
});

describe("Kassadan xarajat — xarajat kategoriyasi", () => {
  it("ixtiyoriy tanlov: faol kategoriyalar tartib bo'yicha, tavsifi bilan; tanlangani tasdiqda va payload'da", async () => {
    const user = userEvent.setup();
    open();
    const dialog = await openSpend(user);

    expect(within(dialog).getByText("(ixtiyoriy)")).toBeInTheDocument();
    await fillRequired(user, dialog);
    await user.click(categoryField(dialog));
    const listbox = await screen.findByRole("listbox", { name: "Xarajat kategoriyalari" });
    expect(within(listbox).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "OvqatlanishXodimlarning ovqati, tushlik",
      "Yoqilg'iBenzin, gaz, dizel",
      "Ijara (arenda)Filial, ombor, ofis ijarasi",
    ]);
    await user.click(within(listbox).getByRole("option", { name: /Yoqilg'i/ }));
    expect(within(dialog).getByText("Nimalar kiradi: Benzin, gaz, dizel")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Xarajatni saqlash" }));
    const { confirm, submit } = await confirmOperation(user, "Xarajatni tasdiqlang");
    expect(within(confirm).getByText("Kategoriya")).toBeInTheDocument();
    expect(within(confirm).getByText("Yoqilg'i")).toBeInTheDocument();
    await submit();

    await waitFor(() => expect(patches(SPEND_URL)).toHaveLength(1));
    expect(patches(SPEND_URL)[0][1]).toEqual({
      amount: 150_000,
      type: "cash",
      comment: "Benzin, oktabr",
      expense_category_id: "2",
    });
    expect(patches(SPEND_URL)[0][2]?.headers?.["Idempotency-Key"]).toEqual(expect.any(String));
    expect(await screen.findByText("Xarajat muvaffaqiyatli saqlandi")).toBeInTheDocument();
  });

  it("qidiruv tavsif bo'yicha ham topadi; tanlov × bilan olib tashlansa kalit yuborilmaydi", async () => {
    const user = userEvent.setup();
    open();
    const dialog = await openSpend(user);
    await fillRequired(user, dialog);

    await user.type(categoryField(dialog), "ombor");
    await user.click(await screen.findByRole("option", { name: /Ijara \(arenda\)/ }));
    expect(categoryField(dialog)).toHaveValue("Ijara (arenda)");
    await user.click(within(dialog).getByRole("button", { name: "Kategoriyani olib tashlash" }));

    await user.click(within(dialog).getByRole("button", { name: "Xarajatni saqlash" }));
    const { confirm, submit } = await confirmOperation(user, "Xarajatni tasdiqlang");
    expect(within(confirm).queryByText("Kategoriya")).not.toBeInTheDocument();
    await submit();

    await waitFor(() => expect(patches(SPEND_URL)).toHaveLength(1));
    expect(patches(SPEND_URL)[0][1]).not.toHaveProperty("expense_category_id");
  });

  it("tanlanmasa — payload eski shaklda, `expense_category_id` kaliti yo'q", async () => {
    const user = userEvent.setup();
    open();
    const dialog = await openSpend(user);
    await fillRequired(user, dialog, { comment: "Kanselyariya" });

    await user.click(within(dialog).getByRole("button", { name: "Xarajatni saqlash" }));
    await (await confirmOperation(user, "Xarajatni tasdiqlang")).submit();

    await waitFor(() => expect(patches(SPEND_URL)).toHaveLength(1));
    expect(patches(SPEND_URL)[0][1]).toEqual({ amount: 150_000, type: "cash", comment: "Kanselyariya" });
    expect(patches(SPEND_URL)[0][1]).not.toHaveProperty("expense_category_id");
  });

  it("to'ldirish: maydon yo'q, ro'yxat so'ralmaydi, payload'da kategoriya yo'q", async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole("button", { name: /Kassani to'ldirish/ }));
    const dialog = await screen.findByRole("dialog", { name: "Kassani to'ldirish" });
    expect(within(dialog).queryByRole("combobox", { name: /kategoriya/i })).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Xarajat kategoriyasi")).not.toBeInTheDocument();

    await fillRequired(user, dialog, { amount: "500000", comment: "Bankdan naqd" });
    await user.click(within(dialog).getByRole("button", { name: "Kirimni saqlash" }));
    await (await confirmOperation(user, "Kirimni tasdiqlang")).submit();

    await waitFor(() => expect(patches(FILL_URL)).toHaveLength(1));
    expect(patches(FILL_URL)[0][1]).toEqual({ amount: 500_000, type: "cash", comment: "Bankdan naqd" });
    expect(categoryGets()).toBe(0);
  });

  it("ro'yxat yuklanmasa: maydon o'chiq, sabab va «Qayta urinish»; xarajat kategoriyasiz saqlanadi", async () => {
    categoriesFail = true;
    const user = userEvent.setup();
    open();
    const dialog = await openSpend(user);

    expect(
      await within(dialog).findByText("Kategoriyalarni yuklab bo'lmadi — xarajatni kategoriyasiz saqlash mumkin"),
    ).toBeInTheDocument();
    expect(categoryField(dialog)).toBeDisabled();

    await fillRequired(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Xarajatni saqlash" }));
    await (await confirmOperation(user, "Xarajatni tasdiqlang")).submit();
    await waitFor(() => expect(patches(SPEND_URL)).toHaveLength(1));
    expect(patches(SPEND_URL)[0][1]).not.toHaveProperty("expense_category_id");
  });

  it("«Qayta urinish» ro'yxatni qayta so'raydi va tanlov ishlaydi", async () => {
    categoriesFail = true;
    const user = userEvent.setup();
    open();
    const dialog = await openSpend(user);
    const retry = await within(dialog).findByRole("button", { name: "Qayta urinish" });

    categoriesFail = false;
    await user.click(retry);
    await waitFor(() => expect(categoryField(dialog)).not.toBeDisabled());
    await chooseCategory(user, dialog, /Ovqatlanish/);
    expect(categoryField(dialog)).toHaveValue("Ovqatlanish");
  });

  it("o'chirilgan kategoriya (400): backend matni, ro'yxat qayta o'qiladi, eskirgan tanlov tozalanadi", async () => {
    const message = "Xarajat kategoriyasi topilmadi yoki o'chirilgan — ro'yxatdan faol kategoriya tanlang";
    http.patch.mockImplementationOnce(async () => {
      throw httpError(400, message);
    });
    const user = userEvent.setup();
    open();
    const dialog = await openSpend(user);
    await fillRequired(user, dialog);
    await chooseCategory(user, dialog, /Yoqilg'i/);
    const getsBefore = categoryGets();

    // Boshqa superadmin «Yoqilg'i» ni o'chirdi.
    categoryRows = categoryRows.filter((row) => row.id !== "2");
    await user.click(within(dialog).getByRole("button", { name: "Xarajatni saqlash" }));
    await (await confirmOperation(user, "Xarajatni tasdiqlang")).submit();

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Kassadan xarajat" })).toBeInTheDocument();
    await waitFor(() => expect(categoryGets()).toBeGreaterThan(getsBefore));
    await waitFor(() => expect(categoryField(dialog)).toHaveValue(""));

    // Qayta yuborish — kategoriyasiz (eskirgan ID ketmaydi), o'sha Idempotency-Key bilan.
    await user.click(within(dialog).getByRole("button", { name: "Xarajatni saqlash" }));
    await (await confirmOperation(user, "Xarajatni tasdiqlang")).submit();
    await waitFor(() => expect(patches(SPEND_URL)).toHaveLength(2));
    expect(patches(SPEND_URL)[0][1]).toHaveProperty("expense_category_id", "2");
    expect(patches(SPEND_URL)[1][1]).not.toHaveProperty("expense_category_id");
    expect(patches(SPEND_URL)[1][2]?.headers?.["Idempotency-Key"]).toBe(
      patches(SPEND_URL)[0][2]?.headers?.["Idempotency-Key"],
    );
  });
});
