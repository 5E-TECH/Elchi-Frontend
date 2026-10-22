import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import FinanceHistoryDetailPopup from "./FinanceHistoryDetailPopup";
import type { PaymentRow } from "./patmentHistoryTable";
import { renderWithProviders } from "../../../test/test-utils";

const detailState = vi.hoisted(() => ({
  calls: [] as Array<{ id: string | null; enabled: boolean }>,
  result: { data: undefined, isLoading: false, isError: false } as Record<string, unknown>,
  refetch: vi.fn(),
}));

vi.mock("../../../entities/payments", () => ({
  useCashBox: () => ({
    useGetFinanceHistoryById: (id: string | null, enabled: boolean) => {
      detailState.calls.push({ id, enabled });
      return { ...detailState.result, refetch: detailState.refetch };
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
