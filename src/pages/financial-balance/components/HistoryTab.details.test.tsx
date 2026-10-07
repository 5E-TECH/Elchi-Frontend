import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
  download: vi.fn(() => Promise.resolve()),
  history: {} as unknown,
}));

vi.mock("../../../entities/payments/financeCoverage", () => ({
  useFinanceCoverage: () => ({
    useGetFinancialBalanceHistory: () => ({ data: mocks.history, isLoading: false, isError: false, refetch: vi.fn() }),
    createFinancialBalanceEntry: { mutate: mocks.mutate, isPending: mocks.isPending },
  }),
}));
vi.mock("../../../shared/lib/exportFile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../shared/lib/exportFile")>()),
  downloadXlsx: mocks.download,
}));

import HistoryTab from "./HistoryTab";

/**
 * Balans → Tarix: "Izoh", kim kiritgan, buyurtma havolasi, tafsilot (4WeT0Tv5);
 * Excel va "Yozuv qo'shish" (GtAoqHlk).
 */

const row = (overrides: Record<string, unknown>) => ({
  id: "65",
  amount: 2,
  balance_before: 1544998,
  balance_after: 1545000,
  source_type: "correction",
  comment: "AUDIT-B rollback - 63/64 neytrallashtirish",
  created_by: "1",
  created_by_user: { id: "1", name: "Dilshod", role: "superadmin" },
  order_id: null,
  createdAt: "2026-09-19T02:18:00.000Z",
  ...overrides,
});

const historyOf = (items: unknown[]) => ({
  statusCode: 200,
  data: { items, total: items.length, pagination: { total: items.length, page: 1, limit: 10, totalPages: 1 } },
});

const open = (route = "/financial-balance?tab=history") => renderWithProviders(<HistoryTab />, { route });

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  mocks.mutate.mockReset();
  mocks.download.mockClear();
  mocks.history = historyOf([
    row({}),
    row({ id: "66", source_type: "sell_profit", comment: null, created_by: null, created_by_user: null, order_id: "1001", amount: 15000, balance_before: 1545000, balance_after: 1560000 }),
    row({ id: "67", created_by: "9", created_by_user: null, comment: "Ofis ijarasi" }),
  ]);
});

describe("HistoryTab — Izoh va kim kiritgan (4WeT0Tv5)", () => {
  it("izoh matni jadvalda ko'rinadi, to'liq matn `title` da", () => {
    open();
    const cell = screen.getByText("AUDIT-B rollback - 63/64 neytrallashtirish");
    expect(cell).toHaveAttribute("title", "AUDIT-B rollback - 63/64 neytrallashtirish");
  });

  it("izoh yo'q qatorda \"—\", bo'sh katak emas", () => {
    open();
    const autoRow = screen.getByText("Buyurtma #1001").closest("tr") as HTMLElement;
    expect(within(autoRow).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("kim kiritgan: ism; tizim yozgan — \"Avtomatik\"; ismi topilmagan — #id", () => {
    open();
    expect(screen.getByText("Dilshod")).toBeInTheDocument();
    expect(screen.getByText("Avtomatik")).toBeInTheDocument();
    expect(screen.getByText("#9")).toBeInTheDocument();
  });

  it("order_id bor qator buyurtma sahifasiga havola beradi", () => {
    open();
    expect(screen.getByRole("link", { name: "Buyurtma #1001" })).toHaveAttribute("href", "/orders/edit/1001");
  });

  it("qatorga bosilganda to'liq tafsilot oynasi ochiladi", () => {
    open();
    fireEvent.click(screen.getByText("Ofis ijarasi"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("#67")).toBeInTheDocument();
    expect(within(dialog).getByText("Ofis ijarasi")).toBeInTheDocument();
    expect(within(dialog).getByText("#9")).toBeInTheDocument();
  });
});

describe("HistoryTab — Excel va qo'lda yozuv (GtAoqHlk)", () => {
  it("Excel jadvaldagi AYNAN o'sha filtrlar bilan yuklanadi", async () => {
    open(
      "/financial-balance?tab=history&financialBalanceHistorySource=manual_expense&financialBalanceHistoryFrom=2026-10-01&financialBalanceHistoryTo=2026-10-05",
    );
    fireEvent.click(screen.getByRole("button", { name: "Excel" }));
    await waitFor(() =>
      expect(mocks.download).toHaveBeenCalledWith(
        "export/financial-balance.xlsx",
        { source_type: "manual_expense", from_date: "2026-10-01", to_date: "2026-10-05" },
        "financial-balance.xlsx",
      ),
    );
  });

  it("\"Yozuv qo'shish\" — qo'lda chiqim: payload AYNAN {amount, source_type, comment}, summa manfiy, Idempotency-Key bilan", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Yozuv qo'shish" }));
    const dialog = screen.getByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Summa"), { target: { value: "50 000" } });
    fireEvent.change(within(dialog).getByLabelText("Izoh"), { target: { value: "  Ofis ijarasi  " } });
    expect(within(dialog).getByText("Balansga ta'siri: -50 000 UZS")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    const [{ data, idempotencyKey }] = mocks.mutate.mock.calls[0] as [{ data: unknown; idempotencyKey: string }];
    expect(data).toStrictEqual({ amount: -50000, source_type: "manual_expense", comment: "Ofis ijarasi" });
    expect(idempotencyKey).toEqual(expect.any(String));
  });

  it("qo'lda kirim musbat; tuzatishda yo'nalishni operator tanlaydi", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Yozuv qo'shish" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Summa"), { target: { value: "1000" } });
    fireEvent.change(within(dialog).getByLabelText("Izoh"), { target: { value: "Qaytim" } });

    fireEvent.click(within(dialog).getByRole("button", { name: "Qo'lda kirim" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    expect((mocks.mutate.mock.calls[0][0] as { data: { amount: number } }).data.amount).toBe(1000);

    fireEvent.click(within(dialog).getByRole("button", { name: "Tuzatish (rollback)" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Kirim (+)" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    expect(mocks.mutate.mock.calls[1][0]).toMatchObject({ data: { amount: 1000, source_type: "correction" } });
  });

  it("summa yoki sabab bo'lmasa yuborilmaydi", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Yozuv qo'shish" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(within(dialog).getByText("Summani kiriting")).toBeInTheDocument();
    expect(within(dialog).getByText("Sababini yozing (kamida 3 belgi)")).toBeInTheDocument();
  });

  it("server xatosi oynada ko'rinadi, oyna yopilmaydi", () => {
    mocks.mutate.mockImplementation((_vars: unknown, options: { onError: (e: unknown) => void }) =>
      options.onError({ response: { data: { message: "property foo should not exist" } } }),
    );
    open();
    fireEvent.click(screen.getByRole("button", { name: "Yozuv qo'shish" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Summa"), { target: { value: "1000" } });
    fireEvent.change(within(dialog).getByLabelText("Izoh"), { target: { value: "Ijara" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    expect(within(screen.getByRole("dialog")).getByRole("alert")).toHaveTextContent("property foo should not exist");
  });
});
