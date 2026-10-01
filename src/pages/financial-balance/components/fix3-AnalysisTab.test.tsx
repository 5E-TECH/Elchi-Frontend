import { vi } from "vitest";
import AnalysisTab from "./AnalysisTab";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * C2 / CODE-22: moliyaviy balans tahlili sana chegaralarini oddiy YYYY-MM-DD
 * yuboradi (backend Toshkent kuni deb oladi), `T00:00:00.000Z` siz.
 */

const calls = vi.hoisted(() => ({ analytics: [] as unknown[], topImpacts: [] as unknown[] }));

vi.mock("../../../entities/payments/financeCoverage", () => ({
  useFinanceCoverage: () => ({
    useGetFinancialBalanceAnalytics: (_enabled: boolean, params: unknown) => {
      calls.analytics.push(params);
      return { data: undefined, isLoading: false };
    },
    useGetFinancialBalanceTopImpacts: (_enabled: boolean, params: unknown) => {
      calls.topImpacts.push(params);
      return { data: undefined, isLoading: false };
    },
  }),
}));

const toDateInputValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

describe("AnalysisTab date params (C2)", () => {
  it("requests today's range as plain YYYY-MM-DD for analytics and top impacts", () => {
    renderWithProviders(<AnalysisTab />, { route: "/financial-balance?tab=analysis" });
    const today = toDateInputValue(new Date());

    expect(calls.analytics.at(-1)).toEqual({ fromDate: today, toDate: today });
    expect(calls.topImpacts.at(-1)).toEqual({ fromDate: today, toDate: today, page: 1, limit: 10000 });
    expect(JSON.stringify([...calls.analytics, ...calls.topImpacts])).not.toMatch(/T\d{2}:\d{2}/);
  });
});
