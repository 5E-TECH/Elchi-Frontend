import { describe, expect, it, vi } from "vitest";
import { formatFinancialAmount } from "./financialBalance";

/** 4AZ2xRRX — bitta sonda ikki xil ajratkich bo'lmasin. */
describe("formatFinancialAmount", () => {
  it("95348635.57 → '95 348 636' (whole sum, thousands by a space, no comma)", () => {
    expect(formatFinancialAmount(95348635.57)).toBe("95 348 636");
  });

  it("keeps the minus sign", () => {
    expect(formatFinancialAmount(-112232400)).toBe("-112 232 400");
  });

  it("0, NaN, undefined and garbage → '0' (never '-0' or 'NaN')", () => {
    expect(formatFinancialAmount(0)).toBe("0");
    expect(formatFinancialAmount(-0.4)).toBe("0");
    expect(formatFinancialAmount(Number.NaN)).toBe("0");
    expect(formatFinancialAmount(undefined)).toBe("0");
    expect(formatFinancialAmount("abc")).toBe("0");
  });

  it("brauzer lokaliga bog'liq emas: Intl inglizcha (Chrome'da 'uz' yo'q) bo'lsa ham bo'shliq", () => {
    const original = Intl.NumberFormat;
    vi.stubGlobal("Intl", { ...Intl, NumberFormat: () => new original("en-US") });
    try {
      expect(formatFinancialAmount(1545000)).toBe("1 545 000");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("numeric strings from the API are accepted", () => {
    expect(formatFinancialAmount("1250000")).toBe("1 250 000");
  });

  it("never mixes separators: only digits, spaces and a leading minus", () => {
    for (const value of [1, 999, 1000, 1234567.89, -5000000.5, 95348635.57]) {
      expect(formatFinancialAmount(value)).toMatch(/^-?\d{1,3}( \d{3})*$/);
    }
  });
});

describe("financial-balance — one amount format on every tab", () => {
  it("no tab passes a separator variant or re-formats with commas", () => {
    const sources = import.meta.glob("../**/*.tsx", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const offenders = Object.entries(sources)
      .filter(([path]) => !path.includes(".test."))
      .filter(([, source]) => /formatFinancialAmount\([^)]*,\s*["'](comma|space)["']\)|replace\(\/\\s\/g,\s*","\)/.test(source))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
    expect(Object.keys(sources).length).toBeGreaterThan(3);
  });
});
