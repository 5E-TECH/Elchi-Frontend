import { describe, expect, it } from "vitest";
import {
  commissionInputText,
  formatCommissionValue,
  hasCommission,
  parseCommissionInput,
  percentEarning,
} from "./commission";
import { normalizeMarketOperator, normalizeMarketOperatorList } from "../api/marketOperatorApi";

describe("market operatori komissiyasi", () => {
  it("hasCommission: turi va qiymati bo'lsa — belgilangan; 0 ham aniq qiymat", () => {
    expect(hasCommission({ commission_type: "percent", commission_value: 5 })).toBe(true);
    expect(hasCommission({ commission_type: "fixed", commission_value: 0 })).toBe(true);
    expect(hasCommission({ commission_type: null, commission_value: 5 })).toBe(false);
    expect(hasCommission({ commission_type: "percent", commission_value: null })).toBe(false);
  });

  it("formatCommissionValue: foiz (2 kasrgacha) va qat'iy summa (kasr yaxlitlanmaydi)", () => {
    expect(formatCommissionValue("percent", 5, "uz")).toBe("5%");
    expect(formatCommissionValue("percent", 3.5, "uz")).toBe("3,5%");
    expect(formatCommissionValue("percent", 2.25, "en")).toBe("2.25%");
    expect(formatCommissionValue("fixed", 3000, "uz")).toBe("3 000 so'm");
    expect(formatCommissionValue("fixed", 3000.5, "uz")).toBe("3 000,5 so'm");
    expect(formatCommissionValue("fixed", 3000, "ru")).toBe("3 000 сум");
  });

  it("parseCommissionInput: mingliklar, vergul, 2 kasr, chegaralar", () => {
    expect(parseCommissionInput("percent", "4")).toEqual({ ok: true, value: 4 });
    expect(parseCommissionInput("percent", "3,5")).toEqual({ ok: true, value: 3.5 });
    expect(parseCommissionInput("percent", "100")).toEqual({ ok: true, value: 100 });
    expect(parseCommissionInput("percent", "100.01")).toEqual({ ok: false, error: "range" });
    expect(parseCommissionInput("fixed", "1 000 000")).toEqual({ ok: true, value: 1_000_000 });
    expect(parseCommissionInput("fixed", "1 500 000")).toEqual({ ok: false, error: "range" });
    expect(parseCommissionInput("fixed", "5,125")).toEqual({ ok: false, error: "format" });
    expect(parseCommissionInput("fixed", "-5")).toEqual({ ok: false, error: "format" });
    expect(parseCommissionInput("fixed", "abc")).toEqual({ ok: false, error: "format" });
    expect(parseCommissionInput("fixed", " ")).toEqual({ ok: false, error: "required" });
    expect(parseCommissionInput("fixed", "", { optional: true })).toEqual({ ok: true, value: null });
  });

  it("percentEarning va commissionInputText", () => {
    expect(percentEarning(4)).toBe(10_000);
    expect(percentEarning(3.5, 100_000)).toBe(3_500);
    expect(commissionInputText(3.5, "uz")).toBe("3,5");
    expect(commissionInputText(3.5, "en")).toBe("3.5");
    expect(commissionInputText(null, "uz")).toBe("");
    // Qat'iy summa mingliklari bo'sh joy bilan (maket «1 500 000»), o'qilganda yana o'sha son.
    expect(commissionInputText(3000, "uz")).toBe("3 000");
    expect(commissionInputText(1_000_000, "en")).toBe("1 000 000");
    expect(commissionInputText(12500.5, "ru")).toBe("12 500,5");
    expect(parseCommissionInput("fixed", commissionInputText(12500.5, "ru"))).toEqual({ ok: true, value: 12500.5 });
  });

  it("normalize: backend qatori (createdAt, numeric satr) va ro'yxat meta'si", () => {
    expect(
      normalizeMarketOperator({
        id: 41,
        name: "Madina",
        phone_number: "+998902143658",
        role: "market_operator",
        status: "inactive",
        market_id: "12",
        commission_type: "fixed",
        commission_value: "3000.00",
        createdAt: "2026-08-12T10:15:00Z",
      }),
    ).toEqual({
      id: "41",
      name: "Madina",
      phone_number: "+998902143658",
      status: "inactive",
      commission_type: "fixed",
      commission_value: 3000,
      created_at: "2026-08-12T10:15:00Z",
    });
    const list = normalizeMarketOperatorList(
      { statusCode: 200, data: { items: [{ id: "1", commission_type: "weird" }], meta: { page: 2, limit: 20, total: 21 } } },
      { page: 1, limit: 10 },
    );
    expect(list).toMatchObject({ total: 21, page: 2, limit: 20 });
    expect(list.items[0]).toMatchObject({ id: "1", status: "active", commission_type: null, commission_value: null });
  });
});
