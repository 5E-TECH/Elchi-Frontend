import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MyCashboxPage from "./MyCashboxPage";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * `/cash-box` (dizayn v2): market / kuryer / menejer kassasi — sarlavha, balans kartasi («Bugun» bloki),
 * tarix tablari (`sourceTypes`), jadval, tafsilot oynasi, holatlar. Ega qarori D2 (2026-10-17): market o'z
 * kassasida HQ → market o'tkazmasini (`market_payment`) ro'yxatda ham, tafsilotda ham «Chiqim −» ko'radi.
 */

type Params = Record<string, unknown>;

const api = vi.hoisted(() => ({
  calls: [] as Params[],
  response: undefined as unknown,
  isError: false,
  refetch: vi.fn(),
}));

// qzjTMWPb: kunlik agregatlar bu testda emas — 403 holati: bloklar chizilmaydi, sahifa o'zgarmaydi.
vi.mock("../../../entities/payments/financeDaily", async (importOriginal) => {
  const forbidden = () => ({ isError: true, error: { response: { status: 403 } }, isLoading: false, refetch: vi.fn() });
  return {
    ...(await importOriginal<object>()),
    useFinanceHistoryDaily: forbidden,
    useFinancialBalanceDaily: forbidden,
  };
});

vi.mock("../../../entities/payments", () => ({
  useCashBox: () => ({
    useGetCashboxMyCashbox: (params: Params = {}) => {
      api.calls.push(params);
      return api.isError
        ? { data: undefined, isLoading: false, isFetching: false, isError: true, error: new Error("boom"), refetch: api.refetch }
        : { data: api.response, isLoading: false, isFetching: false, isError: false, error: null, refetch: api.refetch };
    },
    useGetFinanceHistoryById: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  }),
}));

const asRole = (role: string, extra: Record<string, unknown> = {}) =>
  ({ role: { id: "263", role, region: null, name: role === "market" ? "Baraka Shop" : "Jasur Tursunov" }, ...extra }) as never;

/** Mahalliy vaqt (sahifa «Bugun»ni brauzer kalendar kuni bo'yicha aniqlaydi). */
const at = (day: number, hour: number) => new Date(2026, 9, day, hour, 0).toISOString();

const respond = (cashboxType: string, balance: number, rows: Params[]) => {
  api.response = { statusCode: 200, data: { cashbox: { id: "70", cashbox_type: cashboxType, balance }, cashboxHistory: rows } };
};

const MARKET_ROWS: Params[] = [
  {
    id: "501",
    operation_type: "expense",
    source_type: "market_payment",
    amount: 2_000_000,
    payment_method: "click",
    comment: "Oktabr, 1-hafta hisobi",
    balance_after: 2_820_000,
    created_by: "1",
    createdByUser: { id: 1, name: "Aziz Admin", role: "admin" },
    createdAt: at(8, 11),
  },
  {
    id: "502",
    operation_type: "income",
    source_type: "sell",
    source_id: "10234",
    amount: 185_000,
    payment_method: "cash",
    balance_after: 4_820_000,
    createdAt: at(8, 10),
  },
  {
    id: "503",
    operation_type: "expense",
    source_type: "cancel",
    source_id: "10203",
    comment: "Mijoz qaytardi",
    amount: 320_000,
    payment_method: "cash",
    balance_after: 5_670_000,
    createdAt: at(5, 11),
  },
];

const COURIER_ROWS: Params[] = [
  {
    id: "601",
    operation_type: "expense",
    source_type: "courier_payment",
    amount: 2_400_000,
    payment_method: "cash",
    comment: "Kunlik tushum topshirildi",
    balance_after: 640_000,
    created_by: "33",
    created_by_user: { id: 33, name: "Mohira Qodirova", role: "manager", phone_number: "+998901112233" },
    createdAt: at(8, 9),
  },
  {
    id: "602",
    operation_type: "income",
    source_type: "sell",
    source_id: "10250",
    amount: 185_000,
    payment_method: "cash",
    balance_after: 3_040_000,
    createdAt: at(8, 8),
  },
];

const historyTable = () => screen.findByRole("table", { name: "Operatsiyalar tarixi" });

const rowOf = async (title: string) => {
  const table = await historyTable();
  return within(table).getByRole("button", { name: title }).closest("tr") as HTMLTableRowElement;
};

beforeEach(() => {
  api.calls.length = 0;
  api.isError = false;
  api.refetch.mockClear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 8, 18, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("MyCashboxPage — market (ega qarori D2)", () => {
  it("HQ → market o'tkazmasi ro'yxatda «Chiqim −2 000 000 so'm», tafsilotda «Chiqim operatsiyasi»", async () => {
    respond("markets", 2_820_000, MARKET_ROWS);
    const user = userEvent.setup();
    renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("market") });

    const row = await rowOf("HQ'dan marketga o'tkazma");
    expect(within(row).getByText("Chiqim")).toBeInTheDocument();
    expect(row).toHaveTextContent("−2 000 000 so'm");
    expect(row).not.toHaveTextContent("+2 000 000");
    expect(row).toHaveTextContent("Oktabr, 1-hafta hisobi");

    await user.click(within(row).getByRole("button", { name: "HQ'dan marketga o'tkazma" }));
    const dialog = await screen.findByRole("dialog", { name: "Chiqim operatsiyasi" });
    expect(dialog).toHaveTextContent("−2 000 000");
    expect(dialog).not.toHaveTextContent("+2 000 000");
    // Market maketida «Kassa turi» bor.
    expect(within(dialog).getByText("Kassa turi")).toBeInTheDocument();
  });

  it("sarlavha, balans kartasi («Qarshi tomon: Elchi HQ»), ko'z tugmasi va «Bugun» bloki", async () => {
    respond("markets", 2_820_000, MARKET_ROWS);
    const user = userEvent.setup();
    renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("market") });

    expect(screen.getByRole("heading", { level: 1, name: "To'lovlar" })).toBeInTheDocument();
    expect(screen.getByText("Market kassasi: balans va Elchi bilan operatsiyalar tarixi")).toBeInTheDocument();

    const card = await screen.findByRole("region", { name: "Umumiy balans" });
    expect(card).toHaveTextContent("2 820 000so'm");
    expect(within(card).getByText("Qarshi tomon")).toBeInTheDocument();
    expect(within(card).getByText("Elchi HQ")).toBeInTheDocument();
    expect(within(card).getByText("Baraka Shop")).toBeInTheDocument();
    // Bugungi qatorlar: sotuv +185 000, HQ → market o'tkazmasi — chiqim (D2).
    expect(
      within(card).getByRole("img", { name: "Bugun: kirim +185 000 so'm, chiqim −2 000 000 so'm" }),
    ).toBeInTheDocument();

    const hide = within(card).getByRole("button", { name: "Balansni yashirish" });
    expect(hide).toHaveAttribute("aria-pressed", "false");
    await user.click(hide);
    expect(card).not.toHaveTextContent("2 820 000");
    expect(within(card).getByRole("button", { name: "Balansni ko'rsatish" })).toHaveAttribute("aria-pressed", "true");
  });

  it("bekor qilish qatori: «Tuzatish» badge'i va «Buyurtma №10203 · Mijoz qaytardi»", async () => {
    respond("markets", 2_820_000, MARKET_ROWS);
    renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("market") });

    const row = await rowOf("Bekor qilish");
    expect(within(row).getByText("Tuzatish")).toBeInTheDocument();
    // Maketdagi `.el-badge` — 24px (`md`).
    expect(within(row).getByText("Tuzatish")).toHaveClass("h-6");
    expect(row).toHaveTextContent("Buyurtma №10203 · Mijoz qaytardi");
    // Planshetda (`max-lg`) to'lov turi «Manba» ostida (market maketi), sana ostida emas (kuryer maketi).
    expect(row).toHaveTextContent("Mijoz qaytardi · Naqd");
    expect(row.querySelectorAll("td")[0]).not.toHaveTextContent("Naqd");
    expect(row).toHaveTextContent("−320 000 so'm");
    expect(row).toHaveTextContent("5 670 000 so'm");
  });
});

describe("MyCashboxPage — kuryer", () => {
  it("«Kassa», ustunlar «Operatsiya»/«Turi», «Qabul qildi: …», tafsilotda «Kassa turi» yo'q", async () => {
    respond("couriers", 1_245_000, COURIER_ROWS);
    const user = userEvent.setup();
    renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("courier") });

    expect(screen.getByRole("heading", { level: 1, name: "Kassa" })).toBeInTheDocument();
    const table = await historyTable();
    expect(within(table).getByRole("columnheader", { name: "Operatsiya" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Turi" })).toBeInTheDocument();

    const row = await rowOf("Kuryerdan filialga o'tkazma");
    expect(row).toHaveTextContent("Qabul qildi: Mohira Qodirova · Kunlik tushum topshirildi");
    expect(row).toHaveTextContent("−2 400 000 so'm");

    const card = screen.getByRole("region", { name: "Umumiy balans" });
    expect(within(card).getByText("Kuryer kassasi")).toBeInTheDocument();
    expect(
      within(card).getByRole("img", { name: "Bugun: kirim +185 000 so'm, chiqim −2 400 000 so'm" }),
    ).toBeInTheDocument();

    await user.click(within(row).getByRole("button", { name: /tafsilotini ochish$/ }));
    const dialog = await screen.findByRole("dialog", { name: "Chiqim operatsiyasi" });
    expect(within(dialog).queryByText("Kassa turi")).not.toBeInTheDocument();
  });

  it("«To'lov o'tkazmalari» tabi `sourceTypes` yuboradi; «Bugun» bloki filtrdan mustaqil", async () => {
    respond("couriers", 1_245_000, COURIER_ROWS);
    const user = userEvent.setup();
    renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("courier") });

    await historyTable();
    // Boshlang'ich holat: ikkala so'rov bir xil kalit — bitta so'rov (sana va tursiz).
    expect(api.calls.every((params) => Object.keys(params).length === 0)).toBe(true);

    await user.click(screen.getByRole("tab", { name: "To'lov o'tkazmalari" }));
    await waitFor(() =>
      // T6: teskari yozuv (`payment_reversal`) ham — maket `courier-cashbox-my-transfers-corrected`.
      expect(api.calls).toContainEqual({ sourceTypes: "courier_payment,market_payment,branch_to_main,payment_reversal" }),
    );
    // Tab o'zgarsa ham «Bugun» — bugungi barcha qatorlar (sourceTypes'siz).
    expect(api.calls).toContainEqual({ fromDate: "2026-10-08", toDate: "2026-10-08" });
    expect(screen.getByRole("tab", { name: "To'lov o'tkazmalari" })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("tab", { name: "Barchasi" }));
    await waitFor(() => expect(api.calls.slice(-2)).toEqual([{}, {}]));
  });
});

describe("MyCashboxPage — menejer (maket yo'q, eng yaqini market-cashbox-my)", () => {
  it("«Kassa» · «Filial kassasi», kassa egasi — profildagi filial nomi", async () => {
    respond("branch", 3_785_000, [
      {
        id: "701",
        operation_type: "income",
        source_type: "courier_payment",
        amount: 1_500_000,
        payment_method: "cash",
        balance_after: 3_785_000,
        createdAt: at(7, 10),
      },
    ]);
    renderWithProviders(<MyCashboxPage />, {
      route: "/cash-box",
      preloadedState: asRole("manager", {
        user: {
          user: { id: "5", name: "Menejer", role: "manager", branch: { id: "9", name: "Urgut filiali" } },
          isAuthenticated: true,
          accessToken: "t",
          loading: false,
          isAppInitializing: false,
          error: null,
        },
      }),
    });

    expect(screen.getByRole("heading", { level: 1, name: "Kassa" })).toBeInTheDocument();
    expect(screen.getByText("Filial kassasi: balans va operatsiyalar tarixi")).toBeInTheDocument();
    const card = await screen.findByRole("region", { name: "Umumiy balans" });
    expect(within(card).getByText("Urgut filiali")).toBeInTheDocument();
    expect(within(card).getByText("Filial kassasi")).toBeInTheDocument();
    expect(within(card).queryByText(/Sotuvlar balansni oshiradi/)).not.toBeInTheDocument();

    const row = await rowOf("Kuryerdan filialga o'tkazma");
    expect(within(row).getByText("Kirim")).toBeInTheDocument();
    expect(row).toHaveTextContent("+1 500 000 so'm");
  });

  it("qo'lda chiqimning xarajat kategoriyasi (Elchi Pochta №1) — manba nomi yonida belgi", async () => {
    respond("branch", 3_635_000, [
      {
        id: "702",
        operation_type: "expense",
        source_type: "manual_expense",
        amount: 150_000,
        payment_method: "cash",
        comment: "Benzin, oktabr",
        expense_category_id: "2",
        expense_category_name: "Yoqilg'i",
        balance_after: 3_635_000,
        createdAt: at(7, 11),
      },
    ]);
    renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("manager") });

    const badge = await screen.findByText("Yoqilg'i");
    expect(badge.closest("[data-expense-category]")).toHaveTextContent("Kategoriya: Yoqilg'i");
    expect(document.querySelectorAll("[data-expense-category]")).toHaveLength(1);
  });
});

describe("MyCashboxPage — holatlar", () => {
  it("xato: «Kassa ma'lumotini yuklab bo'lmadi» + «Qayta urinish» → refetch", async () => {
    api.isError = true;
    const user = userEvent.setup();
    renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("courier") });

    expect(await screen.findByText("Kassa ma'lumotini yuklab bo'lmadi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(api.refetch).toHaveBeenCalled();
  });

  it("bo'sh: «Operatsiyalar topilmadi»", async () => {
    respond("couriers", 0, []);
    renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("courier") });

    expect(await screen.findByText("Operatsiyalar topilmadi")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("10 tadan ko'p — sahifalash «1–10 / 12 ta operatsiya»; kam bo'lsa «Jami N ta operatsiya»", async () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      id: String(800 + index),
      operation_type: "income",
      source_type: "sell",
      source_id: String(10_300 + index),
      amount: 1000 * (index + 1),
      payment_method: "cash",
      createdAt: at(7, 8 + (index % 10)),
    }));
    respond("couriers", 0, rows);
    const user = userEvent.setup();
    const view = renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("courier") });

    const table = await historyTable();
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(screen.getByText("1–10 / 12 ta operatsiya")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "2" }));
    expect(within(await historyTable()).getAllByRole("row")).toHaveLength(3);

    view.unmount();
    respond("couriers", 0, rows.slice(0, 3));
    renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("courier") });
    expect(await screen.findByText("Jami 3 ta operatsiya")).toBeInTheDocument();
  });

  it("⭐ D-03: sahifa almashganda shell skrolli tarix kartasining boshiga qaytadi (pastda qolib ketmaydi)", async () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      id: String(900 + index),
      operation_type: "income",
      source_type: "sell",
      source_id: String(10_400 + index),
      amount: 1000 * (index + 1),
      payment_method: "cash",
      createdAt: at(7, 8 + (index % 10)),
    }));
    respond("couriers", 0, rows);
    const user = userEvent.setup();
    renderWithProviders(
      <main>
        <div data-shell-slot="content">
          <MyCashboxPage />
        </div>
      </main>,
      { route: "/cash-box", preloadedState: asRole("courier") },
    );
    await historyTable();
    const main = document.querySelector("main") as HTMLElement;
    const card = screen.getByRole("region", { name: "Operatsiyalar tarixi" });
    main.scrollTop = 900;
    main.getBoundingClientRect = () => ({ top: 64 }) as DOMRect;
    card.getBoundingClientRect = () => ({ top: 64 - 400 }) as DOMRect;

    await user.click(screen.getByRole("button", { name: "2" }));

    expect(main.scrollTop).toBe(900 - 400 - 16);
  });

  it("«Summa» bo'yicha saralash — mijoz tomonida", async () => {
    respond("couriers", 0, [
      { id: "1", operation_type: "income", source_type: "sell", source_id: "1", amount: 5_000, createdAt: at(8, 9) },
      { id: "2", operation_type: "income", source_type: "sell", source_id: "2", amount: 90_000, createdAt: at(8, 8) },
      { id: "3", operation_type: "expense", source_type: "cancel", source_id: "3", amount: 40_000, createdAt: at(8, 7) },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("courier") });

    const table = await historyTable();
    const amounts = () =>
      within(table)
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.querySelectorAll("td")[4]?.textContent);
    expect(amounts()).toEqual(["+5 000 so'm", "+90 000 so'm", "−40 000 so'm"]);

    await user.click(within(table).getByRole("button", { name: /^Summa/ }));
    expect(amounts()).toEqual(["+90 000 so'm", "+5 000 so'm", "−40 000 so'm"]);
  });
});

/**
 * 2crjWf7v — kuryerning `/cash-box` sahifasi: `GET finance/cashbox/my-cashbox` javobidagi
 * `payment_ack` qatorga o'tadi va tarixda kuryerning o'z javobi — «Siz: noto'g'ri» / «Siz tasdiqlagansiz»
 * (KI-S1, maket `courier-cashbox-my-transfers-ack`).
 */
describe("MyCashboxPage — courier receipt answer (2crjWf7v)", () => {
  const courierPayment = (id: string, hour: number, extra: Params) => ({
    id,
    amount: -1_650_000,
    operation_type: "expense",
    source_type: "courier_payment",
    payment_method: "cash",
    cashbox_type: "couriers",
    createdByUser: { name: `Menejer ${id}` },
    createdAt: at(8, hour),
    ...extra,
  });

  const rows = () => [
    courierPayment("11", 9, { payment_ack: "disputed", comment: "Kunlik tushum" }),
    courierPayment("12", 10, { payment_ack: "confirmed" }),
    courierPayment("13", 11, { payment_ack: null }),
    { id: "14", amount: 420_000, operation_type: "income", source_type: "sell", cashbox_type: "couriers", createdAt: at(8, 12) },
  ];

  it("carries payment_ack from the my-cashbox history into the rows", async () => {
    respond("couriers", 640_000, rows());
    renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("courier") });

    const table = await historyTable();
    const rowByReceiver = (name: string) => within(table).getByText(name).closest("tr") as HTMLTableRowElement;
    const disputed = rowByReceiver("Menejer 11");
    const confirmed = rowByReceiver("Menejer 12");
    const unanswered = rowByReceiver("Menejer 13");

    expect(within(disputed).getByText("Siz: noto'g'ri")).toHaveAttribute("data-payment-ack", "disputed");
    expect(within(confirmed).getByText("Siz tasdiqlagansiz")).toHaveAttribute("data-payment-ack", "confirmed");
    expect(within(confirmed).getByText("Siz tasdiqlagansiz")).toHaveAttribute(
      "title",
      "Botdagi kvitansiyani siz tasdiqlagansiz",
    );
    expect(within(table).queryByText(/^Kuryer (tasdiqladi|: )/)).not.toBeInTheDocument();
    // Maketdagi `.el-badge` — 24px (`md`), `sm` (20px) emas.
    expect(within(confirmed).getByText("Siz tasdiqlagansiz")).toHaveClass("h-6");
    expect(unanswered.querySelector("[data-payment-ack]")).toBeNull();
    expect(document.querySelectorAll("[data-payment-ack]")).toHaveLength(2);
  });

  it("phone cards show the badge and say it in the card name", async () => {
    const matchMedia = window.matchMedia;
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
      respond("couriers", 640_000, rows());
      renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("courier") });

      // Tartib (maket): «Qabul qildi» → izoh → javob belgisi oxirida; karta nomi ham shu tartibda.
      const card = await screen.findByRole("button", {
        name: /\(Qabul qildi: Menejer 11 · Kunlik tushum · Siz: noto'g'ri\)/,
      });
      const badge = within(card).getByText("Siz: noto'g'ri");
      expect(badge).toHaveAttribute("data-payment-ack", "disputed");
      expect(badge).toHaveClass("h-6");
      const comment = within(card).getByText("Kunlik tushum");
      const received = within(card).getByText("Menejer 11");
      expect(received.compareDocumentPosition(comment) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(comment.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(screen.getByRole("button", { name: /\(Qabul qildi: Menejer 12 · Siz tasdiqlagansiz\)/ })).toBeInTheDocument();
      expect(document.querySelectorAll("[data-payment-ack]")).toHaveLength(2);
    } finally {
      window.matchMedia = matchMedia;
    }
  });
});

/**
 * T6-FE-1 (XXyAZ9ge) — `/cash-box` da to'lov tuzatish (maketlar `market-cashbox-my-corrected`,
 * `courier-cashbox-my-transfers-corrected`): `correction` `toPaymentRows` dan o'tadi, belgi sarlavha yonida (market
 * telefonida — sarlavha qatorida, kuryer telefonida — uchinchi qator oxirida, kvitansiya javobidan oldin), teskari
 * yozuv ostida sabab emas — havola; «Tuzatilgan» — tuzatish vaqti va tepada (C1); summa o'zgarmaydi (ega qarori).
 */
describe("MyCashboxPage — to'lov tuzatish (T6)", () => {
  const EDIT_REASON = "Marketga 2 000 000 so'm o'tkazilgan, summa xato kiritilgan";
  const REVERSE_REASON = "Boshqa kuryer tanlab yuborilgan — pul Rustam Qosimovdan olingan";
  const correction = (role: string, action: string, related: Params, extra: Params = {}) => ({
    id: "13",
    action,
    payment_kind: action === "edit" ? "market_payment" : "courier_payment",
    role,
    reason: action === "edit" ? EDIT_REASON : REVERSE_REASON,
    created_by_name: "Shodiyor Ergashev",
    created_at: at(8, 15),
    original_amount: action === "edit" ? 2_400_000 : 1_850_000,
    new_amount: action === "edit" ? 2_000_000 : null,
    related_history_id: related.id,
    related,
    ...extra,
  });
  const superadmin = { id: 1, name: "Shodiyor Ergashev", role: "superadmin" };

  const marketRows = (): Params[] => [
    {
      id: "4521",
      operation_type: "income",
      source_type: "payment_reversal",
      amount: 2_400_000,
      payment_method: "click",
      comment: EDIT_REASON,
      balance_after: 7_035_000,
      createdByUser: superadmin,
      payment_date: null,
      createdAt: at(8, 15),
      reverses_history_id: "4498",
      transfer_id: "t-4521",
      correction: correction("reversal", "edit", {
        id: "4498", source_type: "market_payment", role: "original", operation_type: "expense", amount: 2_400_000, created_at: at(8, 13),
      }),
    },
    {
      id: "4498",
      operation_type: "expense",
      source_type: "market_payment",
      amount: 2_400_000,
      payment_method: "click",
      comment: "Oktabr, 1-hafta hisobi",
      balance_after: 4_635_000,
      createdByUser: superadmin,
      payment_date: at(8, 13),
      createdAt: at(8, 13),
      transfer_id: "t-4498",
      correction: correction("original", "edit", {
        id: "4522", source_type: "market_payment", role: "replacement", operation_type: "expense", amount: 2_000_000, created_at: at(8, 15),
      }),
    },
    {
      // Backend asl `payment_date` (13:00) ni nusxalaydi — ro'yxatda tuzatish vaqti va eng tepada (C1).
      id: "4522",
      operation_type: "expense",
      source_type: "market_payment",
      amount: 2_000_000,
      payment_method: "click",
      comment: "Oktabr, 1-hafta hisobi",
      balance_after: 5_035_000,
      createdByUser: superadmin,
      payment_date: at(8, 13),
      createdAt: new Date(2026, 9, 8, 15, 1).toISOString(),
      transfer_id: "t-4522",
      correction: correction("replacement", "edit", {
        id: "4498", source_type: "market_payment", role: "original", operation_type: "expense", amount: 2_400_000, created_at: at(8, 13),
      }),
    },
  ];

  const courierRows = (): Params[] => [
    {
      id: "4530",
      operation_type: "income",
      source_type: "payment_reversal",
      amount: 1_850_000,
      payment_method: "cash",
      cashbox_type: "couriers",
      comment: REVERSE_REASON,
      balance_after: 1_850_000,
      createdByUser: superadmin,
      payment_date: null,
      createdAt: at(8, 16),
      reverses_history_id: "4512",
      correction: correction("reversal", "reverse", {
        id: "4512", source_type: "courier_payment", role: "original", operation_type: "expense", amount: 1_850_000, created_at: at(8, 14),
      }),
    },
    {
      id: "4512",
      operation_type: "expense",
      source_type: "courier_payment",
      amount: 1_850_000,
      payment_method: "cash",
      cashbox_type: "couriers",
      comment: "Kunlik topshiriq",
      balance_after: 0,
      payment_ack: "confirmed",
      createdByUser: superadmin,
      createdAt: at(8, 14),
      correction: correction("original", "reverse", {
        id: "4530", source_type: "payment_reversal", role: "reversal", operation_type: "income", amount: 1_850_000, created_at: at(8, 16),
      }),
    },
  ];

  const phoneMedia = () => {
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
    return () => {
      window.matchMedia = original;
    };
  };

  it("market jadvali: «Tuzatilgan» tepada (tuzatish vaqti), belgilar, havolalar; sabab ro'yxatda yo'q", async () => {
    respond("markets", 5_035_000, marketRows());
    renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("market") });

    const table = await historyTable();
    const [first, second, third] = within(table).getAllByRole("row").slice(1);
    expect(first.querySelector("[data-payment-correction]")).toHaveAttribute("data-payment-correction", "replacement");
    expect(first).toHaveTextContent("Bugun, 15:01");
    expect(first).toHaveTextContent("Oktabr, 1-hafta hisobi · #4498 o'rniga");
    expect(within(first).getByText("Tuzatilgan")).toBeInTheDocument();

    expect(within(second).getByText("Teskari yozuv")).toHaveAttribute("data-payment-correction", "reversal");
    expect(second).toHaveTextContent("To'lovni qaytarish");
    expect(second).toHaveTextContent("#4498 · summa tahrirlandi");
    expect(second).toHaveTextContent("+2 400 000 so'm");
    expect(table).not.toHaveTextContent(EDIT_REASON);

    expect(within(third).getByText("Tahrirlangan")).toHaveAttribute("data-payment-correction", "edited");
    expect(third).toHaveTextContent("Bugun, 13:00");
    // Ega qarori: tuzatilgan to'lov summasi oddiy qatordagidek — chizilmaydi, xiralashmaydi.
    const amount = within(third).getByText("−2 400 000 so'm");
    expect(amount.className).toBe("whitespace-nowrap font-semibold text-danger-fg");
    expect(third.querySelector(".line-through")).toBeNull();
    // Tugma nomi: «{sarlavha}, {belgi} ({sana}) tafsilotini ochish».
    expect(
      within(third).getByRole("button", { name: "HQ'dan marketga o'tkazma, Tahrirlangan (Bugun, 13:00) tafsilotini ochish" }),
    ).toBeInTheDocument();
  });

  it("teng vaqt (bir tranzaksiya): «Tuzatilgan» «Teskari yozuv» ustida — katta ID tepada; o'sishda — teskari", async () => {
    // Backend teskari yozuv va yangi to'lovni bir xil vaqt bilan yozadi; javobda teskari yozuv oldin keladi.
    const rows = marketRows().map((row) => (row.id === "4522" ? { ...row, createdAt: at(8, 15) } : row));
    respond("markets", 5_035_000, rows);
    const user = userEvent.setup();
    renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("market") });

    const table = await historyTable();
    const order = () =>
      within(table)
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.querySelector("[data-payment-correction]")?.getAttribute("data-payment-correction"));
    expect(order()).toEqual(["replacement", "reversal", "edited"]);

    await user.click(within(table).getByRole("button", { name: /^Sana/ }));
    expect(order()).toEqual(["edited", "reversal", "replacement"]);
  });

  it("market telefoni: belgi sarlavha qatorida, karta nomi maketdagidek", async () => {
    const restore = phoneMedia();
    try {
      respond("markets", 5_035_000, marketRows());
      renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("market") });

      const card = await screen.findByRole("button", {
        name: "HQ'dan marketga o'tkazma, Tuzatilgan (Oktabr, 1-hafta hisobi · #4498 o'rniga), O'tkazma, Chiqim −2 000 000 so'm, balans 5 035 000 so'm, Bugun, 15:01",
      });
      const badge = within(card).getByText("Tuzatilgan");
      expect(badge.parentElement).toHaveTextContent(/^HQ'dan marketga o'tkazmaTuzatilgan$/);
      expect(
        screen.getByRole("button", { name: /^To'lovni qaytarish, Teskari yozuv \(#4498 · summa tahrirlandi\), O'tkazma, Kirim \+2 400 000 so'm/ }),
      ).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("kuryer: «#4512 qaytarildi · Shodiyor Ergashev», telefonda belgi uchinchi qator oxirida (javobdan oldin)", async () => {
    respond("couriers", 1_850_000, courierRows());
    const { unmount } = renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("courier") });

    const table = await historyTable();
    const [reversal, original] = within(table).getAllByRole("row").slice(1);
    expect(reversal).toHaveTextContent("#4512 qaytarildi · Shodiyor Ergashev");
    expect(within(reversal).getByText("Shodiyor Ergashev").tagName).toBe("STRONG");
    expect(reversal).not.toHaveTextContent(REVERSE_REASON);
    expect(within(original).getByText("Qaytarildi")).toHaveAttribute("data-payment-correction", "reversed");
    expect(original).toHaveTextContent("Qabul qildi: Shodiyor Ergashev · Kunlik topshiriq");
    unmount();

    const restore = phoneMedia();
    try {
      respond("couriers", 1_850_000, courierRows());
      renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: asRole("courier") });
      const reversalCard = await screen.findByRole("button", {
        name: /^To'lovni qaytarish, Teskari yozuv \(#4512 qaytarildi · Shodiyor Ergashev\)/,
      });
      const line = within(reversalCard).getByText("Teskari yozuv").parentElement as HTMLElement;
      expect(line).toHaveTextContent("#4512 qaytarildi · Shodiyor ErgashevTeskari yozuv");

      const originalCard = screen.getByRole("button", { name: /^Kuryerdan filialga o'tkazma, Qaytarildi \(/ });
      const correctionBadge = within(originalCard).getByText("Qaytarildi");
      const ack = within(originalCard).getByText("Siz tasdiqlagansiz");
      const comment = within(originalCard).getByText("Kunlik topshiriq");
      expect(comment.compareDocumentPosition(correctionBadge) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(correctionBadge.compareDocumentPosition(ack) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    } finally {
      restore();
    }
  });
});
