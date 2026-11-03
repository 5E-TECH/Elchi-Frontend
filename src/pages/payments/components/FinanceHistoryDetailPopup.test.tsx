import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import FinanceHistoryDetailPopup from "./FinanceHistoryDetailPopup";
import type { PaymentRow } from "./patmentHistoryTable";
import { renderWithProviders } from "../../../test/test-utils";

const detailState = vi.hoisted(() => ({
  calls: [] as Array<{ id: string | null; enabled: boolean }>,
  result: { data: undefined, isLoading: false, isError: false } as Record<string, unknown>,
  /** T6: ID bo'yicha javob («Bog'liq yozuv» boshqa yozuvni so'raydi); yo'q bo'lsa — `result`. */
  byId: {} as Record<string, Record<string, unknown>>,
  refetch: vi.fn(),
}));

vi.mock("../../../entities/payments", () => ({
  useCashBox: () => ({
    useGetFinanceHistoryById: (id: string | null, enabled: boolean) => {
      detailState.calls.push({ id, enabled });
      return { ...((id && detailState.byId[id]) || detailState.result), refetch: detailState.refetch };
    },
  }),
}));

const asRole = (role: string) => ({ role: { id: "1", role, region: null, name: role } }) as never;

const sellRow: PaymentRow = {
  id: "501",
  amount: 640_000,
  balance_after: 1_850_000,
  operation_type: "income",
  cashbox_id: "77",
  source_type: "sell",
  source_id: "10227",
  cashbox_type: "couriers",
  payment_method: "cash",
  payment_date: "2026-10-06T12:30:00.000Z",
  comment: "Mijoz naqd to'ladi, qaytim berildi",
};

const sellDetail = {
  data: {
    id: "501",
    amount: 640_000,
    cashbox_id: "77",
    cashbox: { id: "77", balance: 1_850_000, cashbox_type: "couriers" },
    created_by_user: { id: "9", name: "Jasur Tursunov", phone_number: "+998904121855", role: "courier" },
    order: {
      id: "10227",
      status: "sold",
      total_price: 640_000,
      to_be_paid: 595_000,
      paid_amount: 0,
      address: "8-mavze, 14-uy, 27-xonadon",
      market: { id: "3", name: "Nur Elektronika" },
      customer: { id: "4", phone_number: "+998909770236" },
      district: { id: "1", name: "Yangihayot tumani" },
      region: { id: "2", name: "Toshkent sh." },
    },
  },
};

const open = (row: PaymentRow | null, role = "superadmin", props: { hideCashboxType?: boolean } = {}) => {
  const onClose = vi.fn();
  renderWithProviders(<FinanceHistoryDetailPopup row={row} onClose={onClose} {...props} />, {
    preloadedState: asRole(role),
  });
  return { onClose };
};

const term = (dialog: HTMLElement, label: string) => within(dialog).getByText(label, { selector: "dt" });
const valueOf = (dialog: HTMLElement, label: string) => term(dialog, label).nextElementSibling as HTMLElement;

beforeEach(() => {
  detailState.calls = [];
  detailState.result = { data: undefined, isLoading: false, isError: false };
  detailState.byId = {};
  detailState.refetch.mockClear();
});

describe("FinanceHistoryDetailPopup (v2)", () => {
  it("is closed (renders nothing) without a row", () => {
    open(null);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("income row: title, signed amount, balance after, dl rows, party, comment and the linked order", async () => {
    detailState.result = { data: sellDetail, isLoading: false, isError: false };
    const { onClose } = open(sellRow);

    const dialog = await screen.findByRole("dialog", { name: "Kirim operatsiyasi" });
    expect(within(dialog).getByText(/^Operatsiyalar tarixi · /)).toBeInTheDocument();
    expect(dialog.querySelector("[data-history-amount]")).toHaveTextContent("+640 000so'm");
    expect(within(dialog).getByText("1 850 000 so'm")).toBeInTheDocument();

    expect(valueOf(dialog, "Manba turi")).toHaveTextContent("Sotuv");
    expect(valueOf(dialog, "Kassa turi")).toHaveTextContent("Kuryer kassasi");
    const party = valueOf(dialog, "Qayerdan");
    expect(party).toHaveTextContent("Jasur Tursunov");
    expect(within(party).getByText("Kuryer")).toBeInTheDocument();
    expect(within(party).getByText("+998 90 412 18 55")).toBeInTheDocument();
    expect(valueOf(dialog, "To'lov turi")).toHaveTextContent("Naqd");
    expect(within(dialog).getByText("Mijoz naqd to'ladi, qaytim berildi")).toBeInTheDocument();

    const orderLink = within(dialog).getByRole("link", { name: "Buyurtma №10227 ni ochish" });
    expect(orderLink).toHaveAttribute("href", "/orders/edit/10227");
    expect(orderLink).toHaveTextContent("№10227");
    expect(valueOf(dialog, "Market")).toHaveTextContent("Nur Elektronika");
    expect(valueOf(dialog, "Holat")).toHaveTextContent("Sotilgan");
    expect(valueOf(dialog, "Tuman")).toHaveTextContent("Yangihayot tumani, Toshkent sh.");
    expect(valueOf(dialog, "Manzil")).toHaveTextContent("8-mavze, 14-uy, 27-xonadon");
    expect(valueOf(dialog, "Mijoz telefoni")).toHaveTextContent("+998 90 977 02 36");
    // Uch summa: kompyuter bloki va telefon `dl` (CSS bilan almashadi) — ikkalasida ham.
    expect(within(dialog).getAllByText("595 000 so'm")).toHaveLength(2);

    // Tafsilot shu qatorning ID si bilan so'raladi.
    expect(detailState.calls.at(-1)).toEqual({ id: "501", enabled: true });

    await userEvent.setup().click(within(dialog).getAllByRole("button", { name: "Yopish" }).at(-1)!);
    expect(onClose).toHaveBeenCalled();
  });

  it("expense row: «Chiqim operatsiyasi», minus amount and «Qayerga»", async () => {
    detailState.result = {
      data: {
        data: {
          id: "502",
          amount: 2_400_000,
          cashbox_id: "1",
          source_user: { id: "3", name: "Baraka Shop", role: "market" },
        },
      },
      isLoading: false,
      isError: false,
    };
    open({ id: "502", amount: 2_400_000, operation_type: "expense", source_type: "market_payment", cashbox_id: "1", cashbox_type: "main" });

    const dialog = await screen.findByRole("dialog", { name: "Chiqim operatsiyasi" });
    expect(dialog.querySelector("[data-history-amount]")).toHaveTextContent("−2 400 000so'm");
    expect(valueOf(dialog, "Manba turi")).toHaveTextContent("Market to'lovi");
    expect(valueOf(dialog, "Kassa turi")).toHaveTextContent("Asosiy kassa");
    expect(valueOf(dialog, "Qayerga")).toHaveTextContent("Baraka Shop");
  });

  it("D2: the market viewer sees an HQ → market transfer as «Chiqim −» (even when the row says income)", async () => {
    open(
      { id: "503", amount: 2_000_000, operation_type: "income", source_type: "market_payment", cashbox_type: "markets" },
      "market",
    );

    const dialog = await screen.findByRole("dialog", { name: "Chiqim operatsiyasi" });
    expect(dialog.querySelector("[data-history-amount]")).toHaveTextContent("−2 000 000so'm");
    expect(valueOf(dialog, "Manba turi")).toHaveTextContent("HQ'dan marketga o'tkazma");
  });

  it("other roles keep the row direction for market_payment", async () => {
    open({ id: "504", amount: 2_000_000, operation_type: "income", source_type: "market_payment", cashbox_type: "markets" });
    expect(await screen.findByRole("dialog", { name: "Kirim operatsiyasi" })).toBeInTheDocument();
  });

  it("courier view (hideCashboxType): no «Kassa turi» row", async () => {
    open(sellRow, "courier", { hideCashboxType: true });
    const dialog = await screen.findByRole("dialog", { name: "Kirim operatsiyasi" });
    expect(within(dialog).queryByText("Kassa turi")).not.toBeInTheDocument();
    expect(valueOf(dialog, "Manba turi")).toHaveTextContent("Sotuv");
  });

  it("loading: summary from the row immediately, the rest as a skeleton", async () => {
    detailState.result = { data: undefined, isLoading: true, isError: false };
    open(sellRow);

    const dialog = await screen.findByRole("dialog", { name: "Kirim operatsiyasi" });
    expect(dialog.querySelector("[data-history-amount]")).toHaveTextContent("+640 000so'm");
    expect(within(dialog).getByRole("status", { name: "Tafsilot yuklanmoqda" })).toBeInTheDocument();
    expect(within(dialog).queryByText("Manba turi")).not.toBeInTheDocument();
  });

  it("error: «Tafsilotni yuklab bo'lmadi» with a retry that refetches", async () => {
    detailState.result = { data: undefined, isLoading: false, isError: true, error: new Error("500") };
    open(sellRow);

    const dialog = await screen.findByRole("dialog", { name: "Kirim operatsiyasi" });
    expect(within(dialog).getByText("Tafsilotni yuklab bo'lmadi")).toBeInTheDocument();
    await userEvent.setup().click(within(dialog).getByRole("button", { name: "Qayta urinish" }));
    expect(detailState.refetch).toHaveBeenCalled();
  });

  it("a non-numeric (virtual) row id is never requested — row data only", async () => {
    open({ id: "pending-branch-to-hq-16", amount: 500_000, operation_type: "expense", source_type: "branch_to_main", cashbox_type: "branch" }, "manager");

    const dialog = await screen.findByRole("dialog", { name: "Chiqim operatsiyasi" });
    expect(detailState.calls.every((call) => call.id === null && call.enabled === false)).toBe(true);
    expect(valueOf(dialog, "Manba turi")).toHaveTextContent("Filialdan HQ'ga o'tkazma");
    // Menejer uchun filial kassasi — uning «Asosiy kassa»si.
    expect(valueOf(dialog, "Kassa turi")).toHaveTextContent("Asosiy kassa");
  });

  it("mismatch guard: a detail from another cashbox is ignored (row data only, no order)", async () => {
    detailState.result = {
      data: { data: { ...sellDetail.data, cashbox_id: "999", cashbox: { id: "999", balance: 0, cashbox_type: "markets" } } },
      isLoading: false,
      isError: false,
    };
    open(sellRow);

    const dialog = await screen.findByRole("dialog", { name: "Kirim operatsiyasi" });
    expect(within(dialog).queryByText("Bog'langan buyurtma")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Jasur Tursunov")).not.toBeInTheDocument();
  });
});

describe("FinanceHistoryDetailPopup — kuryer kvitansiyasi javobi (2crjWf7v)", () => {
  const courierPayment = (payment_ack: PaymentRow["payment_ack"] | undefined): PaymentRow => ({
    id: "47",
    amount: 1000,
    operation_type: "expense",
    source_type: "courier_payment",
    cashbox_id: "9",
    cashbox_type: "couriers",
    payment_method: "cash",
    payment_date: "2026-10-17T07:34:00.000Z",
    ...(payment_ack === undefined ? {} : { payment_ack }),
  });

  it("xodim, disputed → «Kvitansiya javobi: Kuryer: noto'g'ri» (maket manager-payments-history-detail-dialog-ack)", async () => {
    open(courierPayment("disputed"), "manager");
    const dialog = await screen.findByRole("dialog", { name: "Chiqim operatsiyasi" });
    const badge = within(valueOf(dialog, "Kvitansiya javobi")).getByText("Kuryer: noto'g'ri");
    expect(badge).toHaveAttribute("data-payment-ack", "disputed");
    expect(badge).toHaveAttribute("title", "Kuryer botdagi kvitansiyaga «Noto'g'ri» deb javob berdi");
  });

  it("xodim, confirmed → «Kuryer tasdiqladi»", async () => {
    open(courierPayment("confirmed"), "manager");
    const dialog = await screen.findByRole("dialog", { name: "Chiqim operatsiyasi" });
    expect(within(valueOf(dialog, "Kvitansiya javobi")).getByText("Kuryer tasdiqladi")).toHaveAttribute(
      "data-payment-ack",
      "confirmed",
    );
  });

  it("kuryerning o'zi, confirmed → «Siz tasdiqlagansiz» (KI-S1)", async () => {
    open(courierPayment("confirmed"), "courier", { hideCashboxType: true });
    const dialog = await screen.findByRole("dialog", { name: "Chiqim operatsiyasi" });
    const badge = within(valueOf(dialog, "Kvitansiya javobi")).getByText("Siz tasdiqlagansiz");
    expect(badge).toHaveAttribute("data-payment-ack", "confirmed");
    expect(badge).toHaveAttribute("title", "Botdagi kvitansiyani siz tasdiqlagansiz");
  });

  it("kuryerning o'zi, disputed → «Siz: noto'g'ri»", async () => {
    open(courierPayment("disputed"), "courier", { hideCashboxType: true });
    const dialog = await screen.findByRole("dialog", { name: "Chiqim operatsiyasi" });
    const badge = within(valueOf(dialog, "Kvitansiya javobi")).getByText("Siz: noto'g'ri");
    expect(badge).toHaveAttribute("title", "Botdagi kvitansiyaga siz «Noto'g'ri» deb javob bergansiz");
    expect(within(dialog).queryByText(/^Kuryer(: noto'g'ri| tasdiqladi)$/)).not.toBeInTheDocument();
  });

  it("javob yo'q (null) → «Javob yo'q»; maydon kelmagan qatorda qator umuman yo'q", async () => {
    open(courierPayment(null), "manager");
    const dialog = await screen.findByRole("dialog", { name: "Chiqim operatsiyasi" });
    expect(valueOf(dialog, "Kvitansiya javobi")).toHaveTextContent("Javob yo'q");
  });

  it("boshqa qatorda (payment_ack yo'q) «Kvitansiya javobi» chizilmaydi", async () => {
    open(courierPayment(undefined), "manager");
    const dialog = await screen.findByRole("dialog", { name: "Chiqim operatsiyasi" });
    expect(within(dialog).queryByText("Kvitansiya javobi", { selector: "dt" })).not.toBeInTheDocument();
  });
});

describe("FinanceHistoryDetailPopup — xarajat kategoriyasi (Elchi Pochta №1)", () => {
  const spendRow: PaymentRow = {
    id: "740",
    amount: 150_000,
    balance_after: 2_350_000,
    operation_type: "expense",
    cashbox_id: "1",
    source_type: "manual_expense",
    cashbox_type: "main",
    payment_method: "cash",
    payment_date: "2026-10-21T09:15:00.000Z",
    comment: "Benzin, oktabr",
    expense_category_id: "2",
    expense_category_name: "Yoqilg'i",
  };

  it("qatordagi nom (yozilgan paytdagi nusxa) — «Manba turi» dan keyin «Kategoriya» qatori", async () => {
    open(spendRow);
    const dialog = await screen.findByRole("dialog", { name: "Chiqim operatsiyasi" });
    expect(valueOf(dialog, "Kategoriya")).toHaveTextContent("Yoqilg'i");
    const terms = within(dialog).getAllByText(/./, { selector: "dt" }).map((node) => node.textContent);
    expect(terms.indexOf("Kategoriya")).toBe(terms.indexOf("Manba turi") + 1);
  });

  it("qatorda bo'lmasa — tafsilot javobidan; kategoriyasiz yozuvda qator yo'q", async () => {
    detailState.result = {
      data: { data: { id: "740", amount: 150_000, cashbox_id: "1", expense_category_name: "Ijara (arenda)" } },
      isLoading: false,
      isError: false,
    };
    open({ ...spendRow, expense_category_name: undefined });
    const dialog = await screen.findByRole("dialog", { name: "Chiqim operatsiyasi" });
    expect(valueOf(dialog, "Kategoriya")).toHaveTextContent("Ijara (arenda)");
  });

  it("kategoriyasiz chiqim — «Kategoriya» qatori chizilmaydi", async () => {
    open({ ...spendRow, expense_category_id: null, expense_category_name: null });
    const dialog = await screen.findByRole("dialog", { name: "Chiqim operatsiyasi" });
    expect(within(dialog).queryByText("Kategoriya", { selector: "dt" })).not.toBeInTheDocument();
  });
});

/**
 * T6-FE-1 (XXyAZ9ge) — «Qaytarish va tahrir» bloki (maketlar `*-history-detail-dialog-corrected`, `…-replacement`):
 * izohda `#id`, «Summa» yonida belgi (summa chizilmaydi), blok xulosadan keyin (qatordan darhol, tafsilot
 * kelgach undan), «Bog'liq yozuv» shu oynada `related.id` ni ochadi; «Tuzatilgan» sanasi — tuzatish vaqti (C1);
 * teskari yozuvda sababni takrorlovchi «Izoh» yashirin (C6). Barcha rollarga, sabab bilan.
 */
describe("FinanceHistoryDetailPopup — to'lov tuzatish (T6)", () => {
  const PAID = "2026-10-08T08:05:00.000Z"; // Bugun, 13:05 (Toshkent)
  const EDITED = "2026-10-08T10:10:00.000Z"; // Bugun, 15:10
  const EDIT_REASON = "Marketga 2 000 000 so'm o'tkazilgan, summa xato kiritilgan";
  const REVERSE_REASON = "Boshqa kuryer tanlab yuborilgan — pul Rustam Qosimovdan olingan";

  const editCorrection = (role: string, related: Record<string, unknown> | null, extra: Record<string, unknown> = {}) => ({
    id: "13",
    action: "edit",
    payment_kind: "market_payment",
    role,
    reason: EDIT_REASON,
    created_by_name: "Shodiyor Ergashev",
    created_at: EDITED,
    original_amount: 2_400_000,
    new_amount: 2_000_000,
    related_history_id: related ? String(related.id) : null,
    related,
    ...extra,
  });
  const replacementRelated = {
    id: "4522", source_type: "market_payment", role: "replacement", operation_type: "expense", amount: 2_000_000, created_at: EDITED,
  };
  const originalRelated = {
    id: "4498", source_type: "market_payment", role: "original", operation_type: "expense", amount: 2_400_000, created_at: PAID,
  };

  const editedRow = (overrides: Partial<PaymentRow> = {}): PaymentRow => ({
    id: "4498",
    amount: 2_400_000,
    balance_after: 22_215_000,
    operation_type: "expense",
    cashbox_id: "1",
    source_type: "market_payment",
    cashbox_type: "main",
    payment_method: "click",
    payment_date: PAID,
    createdAt: PAID,
    comment: "Oktabr, 1-hafta hisobi",
    source_user: { id: "101", name: "Baraka Shop", role: "market" },
    correction: editCorrection("original", replacementRelated) as unknown as PaymentRow["correction"],
    ...overrides,
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-08T13:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const section = (dialog: HTMLElement) =>
    within(dialog).getByRole("region", { name: "Qaytarish va tahrir" });
  const kv = (scope: HTMLElement, label: string) =>
    within(scope).getByText(label, { selector: "dt" }).nextElementSibling as HTMLElement;

  it("tahrirlangan asl to'lov: #id izohda, «Tahrirlangan» belgisi, blok va «Bog'liq yozuv»", async () => {
    open(editedRow());
    const dialog = await screen.findByRole("dialog", { name: "Chiqim operatsiyasi" });
    expect(within(dialog).getByText("Operatsiyalar tarixi · #4498 · Bugun, 13:05")).toBeInTheDocument();

    const badge = within(dialog).getByText("Tahrirlangan");
    expect(badge).toHaveAttribute("data-payment-correction", "edited");
    expect(badge.parentElement).toHaveTextContent(/^SummaTahrirlangan$/);
    // Ega qarori: summa chizilmaydi, xiralashmaydi.
    const amount = dialog.querySelector("[data-history-amount]") as HTMLElement;
    expect(amount).toHaveClass("text-danger-fg");
    expect(amount.className).not.toMatch(/line-through|opacity/);

    const block = section(dialog);
    expect(kv(block, "Amal")).toHaveTextContent("Summa tahrirlandi");
    expect(kv(block, "Summa")).toHaveTextContent("2 400 000 so'm → 2 000 000 so'm");
    expect(kv(block, "Sana")).toHaveTextContent("Bugun, 15:10");
    expect(kv(block, "Kim")).toHaveTextContent("Shodiyor Ergashev");
    expect(kv(block, "Sabab")).toHaveTextContent(EDIT_REASON);
    expect(kv(block, "Sabab")).toHaveClass("font-medium");
    const related = within(block).getByRole("button", {
      name: "Bog'liq yozuv: Market to'lovi, Tuzatilgan, #4522, −2 000 000 so'm, tafsilotni ochish",
    });
    expect(related).toHaveTextContent("#4522 · Bugun, 15:10");
    // Blok xulosadan keyin, asosiy `dl` dan oldin.
    const mainTerm = within(dialog).getByText("Manba turi", { selector: "dt" });
    expect(block.compareDocumentPosition(mainTerm) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(dialog).getByText("Oktabr, 1-hafta hisobi")).toBeInTheDocument();
  });

  it("«Bog'liq yozuv» shu oynada related.id ni ochadi (GET finance/history/4522)", async () => {
    detailState.byId["4522"] = {
      data: {
        data: {
          id: "4522",
          amount: 2_000_000,
          balance_after: 25_015_000,
          cashbox_id: "1",
          cashbox: { id: "1", balance: 25_015_000, cashbox_type: "main" },
          operation_type: "expense",
          source_type: "market_payment",
          payment_method: "click",
          payment_date: PAID,
          createdAt: EDITED,
          comment: "Oktabr, 1-hafta hisobi",
          correction: editCorrection("replacement", originalRelated),
        },
      },
      isLoading: false,
      isError: false,
    };
    const user = userEvent.setup();
    open(editedRow());
    const dialog = await screen.findByRole("dialog", { name: "Chiqim operatsiyasi" });
    await user.click(within(dialog).getByRole("button", { name: /^Bog'liq yozuv: Market to'lovi, Tuzatilgan/ }));

    expect(detailState.calls).toContainEqual({ id: "4522", enabled: true });
    expect(within(dialog).getByText("Operatsiyalar tarixi · #4522 · Bugun, 15:10")).toBeInTheDocument();
    expect(within(dialog).getByText("Tuzatilgan")).toHaveAttribute("data-payment-correction", "replacement");
    // C1: «Tuzatilgan» to'lov sanasi — tuzatish vaqti (backend asl payment_date ni nusxalaydi).
    expect(valueOf(dialog, "To'lov sanasi")).toHaveTextContent("Bugun, 15:10");
    expect(
      within(section(dialog)).getByRole("button", {
        name: "Bog'liq yozuv: asl to'lov, Market to'lovi, Tahrirlangan, #4498, −2 400 000 so'm, tafsilotni ochish",
      }),
    ).toHaveTextContent("Asl to'lov · #4498 · Bugun, 13:05");
    expect(dialog).toHaveTextContent("25 015 000 so'm");
  });

  it("teskari yozuv: Summa qatori yo'q, sababni takrorlovchi «Izoh» yashirin (C6)", async () => {
    open(
      editedRow({
        id: "4521",
        operation_type: "income",
        source_type: "payment_reversal",
        payment_date: undefined,
        createdAt: EDITED,
        comment: ` ${EDIT_REASON} `,
        reverses_history_id: "4498",
        correction: editCorrection("reversal", originalRelated) as unknown as PaymentRow["correction"],
      }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Kirim operatsiyasi" });
    expect(within(dialog).getByText("Teskari yozuv")).toBeInTheDocument();
    const block = section(dialog);
    expect(within(block).queryByText("Summa", { selector: "dt" })).not.toBeInTheDocument();
    expect(kv(block, "Sabab")).toHaveTextContent(EDIT_REASON);
    expect(within(dialog).queryByText("Izoh")).not.toBeInTheDocument();
    expect(valueOf(dialog, "Manba turi")).toHaveTextContent("To'lovni qaytarish");
    expect(
      within(block).getByRole("button", { name: /^Bog'liq yozuv: asl to'lov, Market to'lovi, Tahrirlangan, #4498/ }),
    ).toBeInTheDocument();
  });

  it("teskari yozuvdagi boshqa izoh ko'rinadi", async () => {
    open(
      editedRow({
        id: "4521",
        operation_type: "income",
        source_type: "payment_reversal",
        comment: "Boshqa izoh",
        correction: editCorrection("reversal", originalRelated) as unknown as PaymentRow["correction"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Izoh")).toBeInTheDocument();
    expect(within(dialog).getByText("Boshqa izoh")).toBeInTheDocument();
  });

  it("kuryer (o'z kassasi): «Qaytarildi», sabab ko'rinadi, bog'liq teskari yozuv «+»", async () => {
    open(
      {
        id: "4512",
        amount: 1_850_000,
        balance_after: 0,
        operation_type: "expense",
        cashbox_id: "70",
        source_type: "courier_payment",
        cashbox_type: "couriers",
        payment_method: "cash",
        createdAt: "2026-10-08T09:32:00.000Z",
        comment: "Kunlik topshiriq",
        correction: {
          id: "12",
          action: "reverse",
          payment_kind: "courier_payment",
          role: "original",
          reason: REVERSE_REASON,
          created_by_name: null,
          created_at: "2026-10-08T11:40:00.000Z",
          original_amount: 1_850_000,
          new_amount: null,
          related_history_id: "4530",
          related: {
            id: "4530", source_type: "payment_reversal", role: "reversal", operation_type: "income", amount: 1_850_000,
            created_at: "2026-10-08T11:40:00.000Z",
          },
        } as unknown as PaymentRow["correction"],
      },
      "courier",
      { hideCashboxType: true },
    );
    const dialog = await screen.findByRole("dialog", { name: "Chiqim operatsiyasi" });
    expect(within(dialog).getByText("Qaytarildi")).toHaveAttribute("data-payment-correction", "reversed");
    const block = section(dialog);
    expect(kv(block, "Amal")).toHaveTextContent("To'liq qaytarildi");
    expect(kv(block, "Summa")).toHaveTextContent(/^1 850 000 so'm$/);
    // Ism qidiruvi yiqilgan (null) — «—».
    expect(kv(block, "Kim")).toHaveTextContent("—");
    expect(kv(block, "Sabab")).toHaveTextContent(REVERSE_REASON);
    const related = within(block).getByRole("button", {
      name: "Bog'liq yozuv: To'lovni qaytarish, Teskari yozuv, #4530, +1 850 000 so'm, tafsilotni ochish",
    });
    expect(within(related).getByText("+1 850 000 so'm")).toHaveClass("text-success-fg");
  });

  it("market: bog'liq yozuv sarlavhasi market nuqtai nazaridan, related yo'q — «Bog'liq yozuv» yo'q", async () => {
    open(editedRow({ cashbox_type: "markets", cashbox_id: "55" }), "market");
    const dialog = await screen.findByRole("dialog");
    expect(
      within(section(dialog)).getByRole("button", { name: /^Bog'liq yozuv: HQ'dan marketga o'tkazma, Tuzatilgan, #4522/ }),
    ).toBeInTheDocument();
  });

  it("related yo'q — «Bog'liq yozuv» bo'limi chizilmaydi, qolgan blok bor", async () => {
    open(editedRow({ correction: editCorrection("original", null) as unknown as PaymentRow["correction"] }), "admin");
    const dialog = await screen.findByRole("dialog");
    expect(section(dialog)).toBeInTheDocument();
    expect(within(dialog).queryByText("Bog'liq yozuv")).not.toBeInTheDocument();
  });

  it("tafsilotdagi tuzatish eskirgan qatordan ustun", async () => {
    detailState.result = {
      data: {
        data: {
          id: "4498",
          amount: 2_400_000,
          cashbox_id: "1",
          cashbox: { id: "1", balance: 22_215_000, cashbox_type: "main" },
          correction: editCorrection("original", replacementRelated),
        },
      },
      isLoading: false,
      isError: false,
    };
    open(editedRow({ correction: null }), "manager");
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Tahrirlangan")).toBeInTheDocument();
    expect(section(dialog)).toBeInTheDocument();
  });

  it("tuzatilmagan yozuv: belgi va blok yo'q; virtual qatorda #id yo'q", async () => {
    open(editedRow({ correction: null }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector("[data-payment-correction]")).toBeNull();
    expect(within(dialog).queryByRole("region", { name: "Qaytarish va tahrir" })).not.toBeInTheDocument();
  });
});
