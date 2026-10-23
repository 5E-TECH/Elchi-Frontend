import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { vi } from "vitest";
import MainCashbox from "./mainCashbox";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * Elchi Pochta №1 — «Kassadan xarajat» oynasidagi «Xarajat kategoriyasi» tanlovi (ega 2026-10-22: kategoriya
 * MAJBURIY, izoh ixtiyoriy):
 *  - faqat chiqimda; tanlanmasa saqlab bo'lmaydi (maydon ostida xato, so'rov yo'q); tanlangan ID payload'da va
 *    tasdiq oynasida «Kategoriya» qatori;
 *  - izoh bo'sh (yoki faqat bo'sh joy) bo'lsa payload'da `comment` kaliti umuman yo'q;
 *  - to'ldirishda maydon ham, ro'yxat so'rovi ham, kalit ham yo'q (backend `fill` 400 beradi), izoh u yerda majburiy;
 *  - ro'yxat yuklanmasa yoki faol kategoriya yo'q bo'lsa — maydon o'chiq, sabab va «Xarajatni saqlash» bloklangan
 *    (superadminda — «Xarajat kategoriyalari» havolasi Ops vositalaridagi sozlama tabiga, `/ops?tab=expense-categories`);
 *    o'chirilgan kategoriya (400) — backend matni, ro'yxat qayta o'qiladi, eskirgan tanlov tozalanadi va qaytadan tanlash
 *    so'raladi; backend «kategoriyasiz» 400 — matni;
 *  - kassa sarlavhasida «Xarajat kategoriyalari» tugmasi yo'q (hech bir rolda) — sozlama Ops vositalarida.
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

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

const openSpend = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: /Kassadan xarajat/ }));
  return screen.findByRole("dialog", { name: "Kassadan xarajat" });
};

/** Summa, to'lov turi va (berilsa) izoh — kategoriyani test o'zi tanlaydi. */
const fillRequired = async (
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  { amount = "150000", comment = "Benzin, oktabr" } = {},
) => {
  await user.type(within(dialog).getByLabelText(/^Summa/), amount);
  await user.click(within(dialog).getByRole("radio", { name: "Naqd" }));
  if (comment) await user.type(within(dialog).getByLabelText(/^Izoh/), comment);
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
  it("majburiy tanlov: yorliqda «*», izoh «(ixtiyoriy)»; faol kategoriyalar tartib bo'yicha; kategoriya + izoh — ikkalasi payload'da", async () => {
    const user = userEvent.setup();
    open();
    const dialog = await openSpend(user);

    const categoryLabel = within(dialog).getByText("Xarajat kategoriyasi");
    expect(categoryLabel).toHaveTextContent("Xarajat kategoriyasi *");
    expect(categoryField(dialog)).toHaveAttribute("aria-required", "true");
    expect(within(dialog).getByText("Izoh").closest("label")).toHaveTextContent("Izoh (ixtiyoriy)");
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
    expect(within(confirm).getByText("Benzin, oktabr")).toBeInTheDocument();
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

  it("kategoriyasiz — saqlanmaydi: maydon ostida «Xarajat kategoriyasini tanlang», tasdiq ham so'rov ham yo'q", async () => {
    const user = userEvent.setup();
    open();
    const dialog = await openSpend(user);
    await fillRequired(user, dialog, { comment: "Kanselyariya" });

    await user.click(within(dialog).getByRole("button", { name: "Xarajatni saqlash" }));
    expect(await within(dialog).findByText("Xarajat kategoriyasini tanlang")).toBeInTheDocument();
    expect(categoryField(dialog)).toHaveAttribute("aria-invalid", "true");
    // Izoh ixtiyoriy — uning xatosi yo'q.
    expect(within(dialog).queryByText(/Izoh majburiy/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(http.patch).not.toHaveBeenCalled();

    // Tanlangach xato ketadi va saqlash ishlaydi.
    await chooseCategory(user, dialog, /Ovqatlanish/);
    await waitFor(() => expect(within(dialog).queryByText("Xarajat kategoriyasini tanlang")).not.toBeInTheDocument());
    await user.click(within(dialog).getByRole("button", { name: "Xarajatni saqlash" }));
    await (await confirmOperation(user, "Xarajatni tasdiqlang")).submit();
    await waitFor(() => expect(patches(SPEND_URL)).toHaveLength(1));
    expect(patches(SPEND_URL)[0][1]).toEqual({
      amount: 150_000,
      type: "cash",
      comment: "Kanselyariya",
      expense_category_id: "1",
    });
  });

  it("kategoriya bor, izoh yo'q (yoki faqat bo'sh joy) — payload'da `comment` kaliti yo'q, tasdiqda «Izoh» qatori yo'q", async () => {
    const user = userEvent.setup();
    open();
    const dialog = await openSpend(user);
    await fillRequired(user, dialog, { comment: "" });
    await chooseCategory(user, dialog, /Ijara/);
    await user.click(within(dialog).getByRole("button", { name: "Xarajatni saqlash" }));
    const first = await confirmOperation(user, "Xarajatni tasdiqlang");
    expect(within(first.confirm).getByText("Ijara (arenda)")).toBeInTheDocument();
    expect(within(first.confirm).queryByText("Izoh")).not.toBeInTheDocument();
    await first.submit();

    await waitFor(() => expect(patches(SPEND_URL)).toHaveLength(1));
    expect(patches(SPEND_URL)[0][1]).toEqual({ amount: 150_000, type: "cash", expense_category_id: "4" });
    expect(patches(SPEND_URL)[0][1]).not.toHaveProperty("comment");
    expect(await screen.findByText("Xarajat muvaffaqiyatli saqlandi")).toBeInTheDocument();

    // Faqat bo'sh joylardan iborat izoh ham yuborilmaydi.
    const again = await openSpend(user);
    await fillRequired(user, again, { amount: "90000", comment: "   " });
    await chooseCategory(user, again, /Ovqatlanish/);
    await user.click(within(again).getByRole("button", { name: "Xarajatni saqlash" }));
    await (await confirmOperation(user, "Xarajatni tasdiqlang")).submit();
    await waitFor(() => expect(patches(SPEND_URL)).toHaveLength(2));
    expect(patches(SPEND_URL)[1][1]).toEqual({ amount: 90_000, type: "cash", expense_category_id: "1" });
  });

  it("qidiruv tavsif bo'yicha ham topadi; tanlov × bilan olib tashlansa — yana «Xarajat kategoriyasini tanlang»", async () => {
    const user = userEvent.setup();
    open();
    const dialog = await openSpend(user);
    await fillRequired(user, dialog);

    await user.type(categoryField(dialog), "ombor");
    await user.click(await screen.findByRole("option", { name: /Ijara \(arenda\)/ }));
    expect(categoryField(dialog)).toHaveValue("Ijara (arenda)");
    await user.click(within(dialog).getByRole("button", { name: "Kategoriyani olib tashlash" }));

    await user.click(within(dialog).getByRole("button", { name: "Xarajatni saqlash" }));
    expect(await within(dialog).findByText("Xarajat kategoriyasini tanlang")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(http.patch).not.toHaveBeenCalled();
  });

  it("to'ldirish: maydon yo'q, ro'yxat so'ralmaydi, payload'da kategoriya yo'q, izoh majburiy", async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole("button", { name: /Kassani to'ldirish/ }));
    const dialog = await screen.findByRole("dialog", { name: "Kassani to'ldirish" });
    expect(within(dialog).queryByRole("combobox", { name: /kategoriya/i })).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Xarajat kategoriyasi")).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/\(ixtiyoriy\)/)).not.toBeInTheDocument();

    await fillRequired(user, dialog, { amount: "500000", comment: "" });
    await user.click(within(dialog).getByRole("button", { name: "Kirimni saqlash" }));
    expect(await within(dialog).findByText("Izoh majburiy — pul qayerdan kelganini yozing")).toBeInTheDocument();
    expect(http.patch).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText(/^Izoh/), "Bankdan naqd");
    await user.click(within(dialog).getByRole("button", { name: "Kirimni saqlash" }));
    await (await confirmOperation(user, "Kirimni tasdiqlang")).submit();

    await waitFor(() => expect(patches(FILL_URL)).toHaveLength(1));
    expect(patches(FILL_URL)[0][1]).toEqual({ amount: 500_000, type: "cash", comment: "Bankdan naqd" });
    expect(categoryGets()).toBe(0);
  });

  it("ro'yxat yuklanmasa: maydon o'chiq, sabab va «Qayta urinish»; «Xarajatni saqlash» bloklangan", async () => {
    categoriesFail = true;
    const user = userEvent.setup();
    open();
    const dialog = await openSpend(user);

    expect(
      await within(dialog).findByText("Kategoriyalarni yuklab bo'lmadi — xarajat kategoriyasiz saqlanmaydi"),
    ).toBeInTheDocument();
    expect(categoryField(dialog)).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Xarajatni saqlash" })).toBeDisabled();

    await fillRequired(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Xarajatni saqlash" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(http.patch).not.toHaveBeenCalled();
  });

  it("«Qayta urinish» ro'yxatni qayta so'raydi: tanlov ishlaydi va saqlash ochiladi", async () => {
    categoriesFail = true;
    const user = userEvent.setup();
    open();
    const dialog = await openSpend(user);
    const retry = await within(dialog).findByRole("button", { name: "Qayta urinish" });

    categoriesFail = false;
    await user.click(retry);
    await waitFor(() => expect(categoryField(dialog)).not.toBeDisabled());
    expect(within(dialog).getByRole("button", { name: "Xarajatni saqlash" })).toBeEnabled();
    await chooseCategory(user, dialog, /Ovqatlanish/);
    expect(categoryField(dialog)).toHaveValue("Ovqatlanish");
  });

  it("faol kategoriya yo'q (admin): maydon o'chiq, «superadmin … qo'shadi», saqlash bloklangan, havola yo'q", async () => {
    categoryRows = [];
    const user = userEvent.setup();
    open();
    const dialog = await openSpend(user);

    expect(
      await within(dialog).findByText(
        "Kategoriyalar hali qo'shilmagan — superadmin «Xarajat kategoriyalari» orqali qo'shadi",
      ),
    ).toBeInTheDocument();
    expect(categoryField(dialog)).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Xarajatni saqlash" })).toBeDisabled();
    expect(within(dialog).queryByRole("button", { name: "Xarajat kategoriyalari" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: "Xarajat kategoriyalari" })).not.toBeInTheDocument();
  });

  it("faol kategoriya yo'q (superadmin): saqlash bloklangan, «Xarajat kategoriyalari» — Ops vositalaridagi sozlama tabiga havola", async () => {
    categoryRows = [];
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <MainCashbox />
        <LocationProbe />
      </>,
      {
        route: "/payments/main-cashbox",
        preloadedState: { role: { id: "1", role: "superadmin", region: null, name: "superadmin" } } as never,
      },
    );
    const dialog = await openSpend(user);
    expect(
      await within(dialog).findByText(
        "Kategoriyalar hali qo'shilmagan — xarajatni saqlash uchun avval kategoriya qo'shing",
      ),
    ).toBeInTheDocument();
    expect(categoryField(dialog)).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Xarajatni saqlash" })).toBeDisabled();

    // Boshqaruv oynasi endi kassada ochilmaydi — havola sahifani almashtiradi.
    expect(within(dialog).queryByRole("button", { name: "Xarajat kategoriyalari" })).not.toBeInTheDocument();
    const link = within(dialog).getByRole("link", { name: "Xarajat kategoriyalari" });
    expect(link).toHaveAttribute("href", "/ops?tab=expense-categories");
    await user.click(link);
    expect(screen.getByTestId("location")).toHaveTextContent("/ops?tab=expense-categories");
    expect(screen.queryByRole("dialog", { name: "Xarajat kategoriyalari" })).not.toBeInTheDocument();
    expect(http.post).not.toHaveBeenCalled();
    expect(http.patch).not.toHaveBeenCalled();
  });

  it("o'chirilgan kategoriya (400): backend matni, ro'yxat qayta o'qiladi, eskirgan tanlov tozalanadi va qaytadan so'raladi", async () => {
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

    // Eskirgan ID qayta ketmaydi: avval yangi kategoriya tanlash so'raladi.
    await user.click(within(dialog).getByRole("button", { name: "Xarajatni saqlash" }));
    expect(await within(dialog).findByText("Xarajat kategoriyasini tanlang")).toBeInTheDocument();
    expect(patches(SPEND_URL)).toHaveLength(1);

    // Boshqa kategoriya bilan qayta yuborish — o'sha Idempotency-Key bilan (operatsiya o'zi o'zgarmagan).
    await chooseCategory(user, dialog, /Ovqatlanish/);
    await user.click(within(dialog).getByRole("button", { name: "Xarajatni saqlash" }));
    await (await confirmOperation(user, "Xarajatni tasdiqlang")).submit();
    await waitFor(() => expect(patches(SPEND_URL)).toHaveLength(2));
    expect(patches(SPEND_URL)[0][1]).toHaveProperty("expense_category_id", "2");
    expect(patches(SPEND_URL)[1][1]).toHaveProperty("expense_category_id", "1");
    expect(patches(SPEND_URL)[1][2]?.headers?.["Idempotency-Key"]).toBe(
      patches(SPEND_URL)[0][2]?.headers?.["Idempotency-Key"],
    );
  });

  it("backend kategoriyasiz chiqimni rad etsa (400 «Xarajat kategoriyasini tanlang») — matni xabarda, oyna ochiq", async () => {
    http.patch.mockImplementationOnce(async () => {
      throw httpError(400, "Xarajat kategoriyasini tanlang");
    });
    const user = userEvent.setup();
    open();
    const dialog = await openSpend(user);
    await fillRequired(user, dialog, { comment: "" });
    await chooseCategory(user, dialog, /Ovqatlanish/);
    const getsBefore = categoryGets();
    await user.click(within(dialog).getByRole("button", { name: "Xarajatni saqlash" }));
    await (await confirmOperation(user, "Xarajatni tasdiqlang")).submit();

    // Xabar (toast) — maydon xatosi emas: kategoriya tanlangan qoladi.
    expect(await screen.findByText("Xarajat kategoriyasini tanlang")).toBeInTheDocument();
    expect(within(dialog).queryByText("Xarajat kategoriyasini tanlang")).not.toBeInTheDocument();
    expect(categoryField(dialog)).toHaveValue("Ovqatlanish");
    expect(screen.getByRole("dialog", { name: "Kassadan xarajat" })).toBeInTheDocument();
    expect(screen.queryByText("Xarajat muvaffaqiyatli saqlandi")).not.toBeInTheDocument();
    await waitFor(() => expect(categoryGets()).toBeGreaterThan(getsBefore));
  });
});

describe("Asosiy kassa tarixi — xarajat kategoriyasi", () => {
  const historyRows = [
    {
      id: "740",
      amount: 150_000,
      balance_after: 2_350_000,
      operation_type: "expense",
      source_type: "manual_expense",
      cashbox_type: "main",
      payment_method: "cash",
      comment: "Benzin, oktabr",
      expense_category_id: "2",
      expense_category_name: "Yoqilg'i",
      created_by_user: { id: "2", name: "Nilufar Rashidova" },
      createdAt: new Date().toISOString(),
    },
    {
      id: "741",
      amount: 90_000,
      balance_after: 2_500_000,
      operation_type: "expense",
      source_type: "manual_expense",
      cashbox_type: "main",
      payment_method: "cash",
      comment: "Kanselyariya",
      expense_category_id: null,
      expense_category_name: null,
      created_by_user: { id: "2", name: "Nilufar Rashidova" },
      createdAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    const base = http.get.getMockImplementation();
    http.get.mockImplementation(async (url: string, config?: unknown) =>
      url === "finance/history"
        ? { data: { statusCode: 200, message: "success", data: { items: historyRows } } }
        : base?.(url, config),
    );
  });

  it("jadval: «Manba» ustunida nom yonida kategoriya belgisi, kategoriyasiz qatorda yo'q", async () => {
    open();
    const table = await screen.findByRole("table", { name: "Operatsiyalar tarixi" });
    const withCategory = (await within(table).findByText("Benzin, oktabr")).closest("tr") as HTMLElement;
    const badge = withCategory.querySelector("[data-expense-category]") as HTMLElement;
    expect(badge).toHaveTextContent("Kategoriya: Yoqilg'i");
    const without = within(table).getByText("Kanselyariya").closest("tr") as HTMLElement;
    expect(without.querySelector("[data-expense-category]")).toBeNull();
  });

  it("telefon kartasi: belgi va karta nomida kategoriya", async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    try {
      open();
      const card = await screen.findByRole("button", { name: /· Yoqilg'i/ });
      expect(within(card).getByText("Yoqilg'i")).toBeInTheDocument();
      expect(document.querySelectorAll("[data-expense-category]")).toHaveLength(1);
    } finally {
      window.matchMedia = original;
    }
  });
});

describe("«Xarajat kategoriyalari» — kassa sarlavhasida yo'q (sozlama Ops vositalarida)", () => {
  const asRole = (role: string) => ({ role: { id: "1", role, region: null, name: role } }) as never;

  it.each(["superadmin", "admin", "manager"])("%s: sarlavhada tugma ham, boshqaruv oynasi ham yo'q (tanlov esa bor)", async (role) => {
    const user = userEvent.setup();
    renderWithProviders(<MainCashbox />, { route: "/payments/main-cashbox", preloadedState: asRole(role) });
    await screen.findByRole("button", { name: /Kassadan xarajat/ });
    expect(screen.getByRole("button", { name: "Excelga yuklash" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xarajat kategoriyalari" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Xarajat kategoriyalari" })).not.toBeInTheDocument();

    const dialog = await openSpend(user);
    expect(categoryField(dialog)).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Xarajat kategoriyalari" })).not.toBeInTheDocument();
  });
});
