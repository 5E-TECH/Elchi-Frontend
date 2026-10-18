import { describe, expect, it } from "vitest";
import { normalizeFinancialBalance } from "./financialBalance";

describe("normalizeFinancialBalance", () => {
  it("uses the chain (couriers + branches + cargo) as the positive part of the new formula", () => {
    // m2DAhYid: backend endi finance-service formulasini qaytaradi.
    const data = normalizeFinancialBalance({
      statusCode: 200,
      data: {
        currentSituation: 41392735.57,
        main: { balance: 94213635.57 },
        chain: { chainReceivable: 110336500, branchReceivable: 64712000, hqReceivable: 45624500, providerReceivable: 644500 },
        branches: { branchReceivable: 64712000 },
        markets: { marketPayable: 163801900, marketsTotalBalans: -163801900 },
        couriers: { allCourierCashboxes: [], couriersTotalBalanse: 52674500 },
        formula: "main_cashbox + chain_receivable + provider_receivable - market_cashbox_payable",
      },
    });

    expect(data?.receivable).toBe(110981000);
    expect(data?.currentSituation).toBe(41392735.57);
    // Kassa + yo'ldagi pul + marketlar = holat (kartalar yig'indisi jami bilan mos).
    expect((data?.main.balance ?? 0) + (data?.receivable ?? 0) + (data?.markets.marketsTotalBalans ?? 0)).toBeCloseTo(41392735.57, 2);
    // Kuryer kassalari yig'indisi ma'lumot sifatida saqlanadi.
    expect(data?.couriers.couriersTotalBalanse).toBe(52674500);
  });

  it("falls back to the legacy courier field when the backend sends no chain", () => {
    const data = normalizeFinancialBalance({
      data: {
        currentSituation: -4876264.43,
        main: { balance: 94213635.57 },
        markets: { marketsTotalBalans: -163801900 },
        couriers: { couriersTotalBalanse: 64712000 },
      },
    });

    expect(data?.receivable).toBe(64712000);
    expect(data?.currentSituation).toBe(-4876264.43);
  });
});

describe("marketlar va kuryerlar ro'yxati (IaMK2tf2)", () => {
  it("⭐ market qatori ishorasi teskari olinadi: musbat (biz qarzmiz) → manfiy, manfiy (oldindan to'lagan) → musbat", () => {
    const data = normalizeFinancialBalance({
      data: {
        main: { balance: 0 },
        markets: {
          allMarketCashboxes: [
            { id: "1", balance: 4_820_000, user: { name: "Baraka Shop" } },
            { id: "2", balance: -150_000, user: { name: "Oldindan to'lagan" } },
            { id: "3", balance: 0, user: { name: "Nol" } },
          ],
          marketsTotalBalans: -4_670_000,
        },
        couriers: { allCourierCashboxes: [{ id: "9", balance: -85_000, user: { name: "Kuryer" } }], couriersTotalBalanse: -85_000 },
      },
    });

    expect(data?.markets.items.map((item) => item.balance)).toEqual([-4_820_000, 150_000, 0]);
    expect(Object.is(data?.markets.items[2].balance, -0)).toBe(false);
    // Kuryer ishorasi o'zgarmaydi.
    expect(data?.couriers.items[0].balance).toBe(-85_000);
  });

  it("⭐ sanoq `nonZeroCount` dan, `truncated` o'qiladi; eski javobda — yuklangan qatorlar soni", () => {
    const rows = (count: number) => Array.from({ length: count }, (_, i) => ({ id: String(i + 1), balance: 1000 * (i + 1), user: { name: `M${i + 1}` } }));
    const data = normalizeFinancialBalance({
      data: {
        main: { balance: 0 },
        markets: { allMarketCashboxes: rows(20), nonZeroCount: 57, truncated: true, marketsTotalBalans: -1 },
        couriers: { allCourierCashboxes: rows(2), couriersTotalBalanse: 3000 },
      },
    });

    expect(data?.markets).toMatchObject({ nonZeroCount: 57, truncated: true });
    expect(data?.markets.items).toHaveLength(20);
    expect(data?.couriers).toMatchObject({ nonZeroCount: 2, truncated: false });
  });
});

describe("readCurrentBalance (GtAoqHlk)", () => {
  it("analytics javobidagi currentBalance (qobiq bilan ham, qobiqsiz ham)", async () => {
    const { readCurrentBalance } = await import("./financialBalance");
    expect(readCurrentBalance({ statusCode: 200, data: { currentBalance: 1545000 } })).toBe(1545000);
    expect(readCurrentBalance({ current_balance: "-200" })).toBe(-200);
  });

  it("javobda yo'q bo'lsa null — karta 0 deb yolg'on ko'rsatilmaydi", async () => {
    const { readCurrentBalance } = await import("./financialBalance");
    expect(readCurrentBalance(undefined)).toBeNull();
    expect(readCurrentBalance({ data: { summary: {} } })).toBeNull();
  });
});
