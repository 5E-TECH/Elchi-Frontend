import { describe, expect, it } from "vitest";
import {
  buildWaterfall,
  normalizeApiBuckets,
  normalizeLedgerRows,
  readTopImpactsPagination,
  toPlotPercent,
} from "./analytics";
import { normalizeFinancialBalance } from "./financialBalance";
import { buildHistoryExportParams, readHistoryFilters } from "./historyFilters";

describe("buildWaterfall — «Daftar qoldig'i harakati»", () => {
  const positive = [
    { sourceType: "manual_income", amount: 5_000_000, percent: 50.8 },
    { sourceType: "sell_profit", amount: 4_836_500, percent: 49.2 },
  ];
  const negative = [{ sourceType: "salary", amount: 8_906_000, percent: 100 }];

  it("davr boshi = hozirgi qoldiq − sof o'zgarish; manbalar ketma-ket; oxiri = hozirgi qoldiq", () => {
    const result = buildWaterfall({ currentBalance: 8_437_500, netChange: 930_500, positive, negative, reachesToday: true });

    expect(result.withTotals).toBe(true);
    expect(result.steps.map((step) => [step.kind, step.from, step.to])).toEqual([
      ["start", 0, 7_507_000],
      ["up", 7_507_000, 12_507_000],
      ["up", 12_507_000, 17_343_500],
      ["down", 17_343_500, 8_437_500],
      ["end", 0, 8_437_500],
    ]);
    expect(result.min).toBe(0);
    expect(result.max).toBe(17_343_500);
  });

  it("o'tgan davr yoki qoldiq yo'q — boshi/oxiri chizilmaydi, ta'sirlar noldan", () => {
    for (const input of [
      { currentBalance: 8_437_500, reachesToday: false },
      { currentBalance: null, reachesToday: true },
    ]) {
      const result = buildWaterfall({ ...input, netChange: 930_500, positive, negative });
      expect(result.withTotals).toBe(false);
      expect(result.steps.map((step) => step.kind)).toEqual(["up", "up", "down"]);
      expect(result.steps[0].from).toBe(0);
    }
  });

  it("manfiy qoldiq — o'q noldan pastga kengayadi", () => {
    const result = buildWaterfall({
      currentBalance: -2_000_000,
      netChange: -3_000_000,
      positive: [],
      negative: [{ sourceType: "bills", amount: 3_000_000, percent: 100 }],
      reachesToday: true,
    });
    expect(result.min).toBe(-2_000_000);
    expect(result.max).toBe(1_000_000);
    expect(toPlotPercent(0, result.min, result.max)).toBeCloseTo(66.67, 1);
  });
});

describe("analytics javobi", () => {
  it("normalizeApiBuckets — backend `positiveImpact` (total_amount, percentage), kamayish tartibida", () => {
    expect(
      normalizeApiBuckets(
        {
          data: {
            positiveImpact: [
              { source_type: "sell_profit", total_amount: "100", percentage: 25 },
              { source_type: "manual_income", total_amount: 300, percentage: 75 },
              { source_type: "correction", total_amount: 0, percentage: 0 },
            ],
          },
        },
        "positive",
      ),
    ).toEqual([
      { sourceType: "manual_income", amount: 300, percent: 75 },
      { sourceType: "sell_profit", amount: 100, percent: 25 },
    ]);
  });

  it("readTopImpactsPagination — server `pagination`", () => {
    expect(readTopImpactsPagination({ data: { items: [], pagination: { total: 186, page: 3, limit: 10 } } }, 1, 10)).toEqual({
      total: 186,
      page: 3,
      limit: 10,
    });
    expect(readTopImpactsPagination(undefined, 2, 10)).toEqual({ total: 0, page: 2, limit: 10 });
  });

  // guzrGySp: top-impacts qatorida backend `created_by_user: {id, name, role} | null` (history bilan bir xil).
  it("normalizeLedgerRows — «Kiritgan»: ism `created_by_user` dan, foydalanuvchi yo'q — `#id`, muallifsiz — avtomatik", () => {
    const rows = normalizeLedgerRows([
      {
        id: "1",
        source_type: "manual_income",
        amount: 500_000,
        created_by: "7",
        created_by_user: { id: "7", name: "Dilnoza Karimova", role: "admin" },
      },
      { id: "2", source_type: "manual_expense", amount: 200_000, created_by: "9", created_by_user: null },
      { id: "3", source_type: "sell_profit", amount: 30_000, created_by: null, created_by_user: null },
    ]);

    expect(rows.map(({ actor, automatic }) => ({ actor, automatic }))).toEqual([
      { actor: "Dilnoza Karimova", automatic: false },
      { actor: "#9", automatic: false },
      { actor: "", automatic: true },
    ]);
  });
});

describe("Balans tarkibi uchun `chain` (additiv)", () => {
  it("chain bor — zanjir va kargo alohida; yo'q — null", () => {
    expect(
      normalizeFinancialBalance({
        data: { currentSituation: 1, main: { balance: 1 }, chain: { chainReceivable: 8, providerReceivable: 3 } },
      })?.chain,
    ).toEqual({ chainReceivable: 8, providerReceivable: 3 });
    expect(normalizeFinancialBalance({ data: { currentSituation: 1, main: { balance: 1 } } })?.chain).toBeNull();
  });
});

describe("Tarix filtrlari (URL) va eksport paramlari", () => {
  it("noto'g'ri sana va noma'lum manba e'tiborsiz qoldiriladi", () => {
    const filters = readHistoryFilters(
      new URLSearchParams("financialBalanceHistoryFrom=2026-10-01&financialBalanceHistoryTo=oops&financialBalanceHistorySource=sell"),
    );
    expect(filters).toEqual({ fromDate: "2026-10-01", toDate: "", sourceType: "" });
    expect(buildHistoryExportParams(filters)).toEqual({ from_date: "2026-10-01" });
  });
});

describe("buildWaterfall — server davr boshi (qzjTMWPb)", () => {
  it("o'tgan davrda ham boshi va oxiri `financial-balance/daily` dan chiziladi", () => {
    const result = buildWaterfall({
      currentBalance: 999,
      netChange: 50,
      positive: [{ sourceType: "sell", amount: 80, percent: 100 }],
      negative: [{ sourceType: "bills", amount: 30, percent: 100 }],
      reachesToday: false,
      periodBalances: { opening: 100, closing: 150 },
    });
    expect(result.withTotals).toBe(true);
    expect(result.steps[0]).toMatchObject({ kind: "start", amount: 100 });
    expect(result.steps.at(-1)).toMatchObject({ kind: "end", amount: 150 });
  });

  it("server qoldig'i noma'lum — avvalgi qoida: o'tgan davrda boshi/oxiri yo'q", () => {
    const result = buildWaterfall({
      currentBalance: 999,
      netChange: 50,
      positive: [],
      negative: [],
      reachesToday: false,
      periodBalances: { opening: null, closing: null },
    });
    expect(result.withTotals).toBe(false);
  });
});
