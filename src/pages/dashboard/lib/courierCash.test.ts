import { describe, expect, it } from "vitest";
import { toCourierCash } from "./courierCash";

describe("kuryer kassasi (my-cashbox, bugun)", () => {
  it("kun boshi = balans − kirim + chiqim; sotuvlar va topshirilgan alohida", () => {
    const cash = toCourierCash({
      data: {
        cashbox: { balance: 1_245_000 },
        income: 1_885_000,
        outcome: 2_400_000,
        cashboxHistory: [
          { operation_type: "income", source_type: "sell", amount: 1_885_000 },
          { operation_type: "expense", source_type: "courier_payment", amount: 2_400_000 },
        ],
      },
    });
    expect(cash).toEqual({
      balance: 1_245_000,
      flow: { start: 1_760_000, sales: 1_885_000, handedOver: 2_400_000, other: 0 },
    });
  });

  it("boshqa harakatlar «Boshqa» ga tushadi — yig'indi joriy balansga teng", () => {
    const cash = toCourierCash({
      data: {
        cashbox: { balance: "500000" },
        income: "700000",
        outcome: "300000",
        cashboxHistory: [
          { operation_type: "income", source_type: "sell", amount: 600_000 },
          { operation_type: "income", source_type: "correction", amount: 100_000 },
          { operation_type: "expense", source_type: "courier_payment", amount: 200_000 },
          { operation_type: "expense", source_type: "manual_expense", amount: 100_000 },
        ],
      },
    })!;
    const { start, sales, handedOver, other } = cash.flow!;
    expect(start + sales - handedOver + other).toBe(cash.balance);
    expect(other).toBe(0);
  });

  it("tarix yoki yig'indilar yo'q — faqat balans (sharshara chizilmaydi)", () => {
    expect(toCourierCash({ data: { cashbox: { balance: 10 } } })).toEqual({ balance: 10, flow: null });
    expect(toCourierCash({ data: {} })).toBeNull();
  });
});
