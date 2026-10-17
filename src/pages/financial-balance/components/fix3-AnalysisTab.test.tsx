import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, vi } from "vitest";
import AnalysisTab from "./AnalysisTab";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * C2 / CODE-22: moliyaviy balans tahlili sana chegaralarini oddiy YYYY-MM-DD
 * yuboradi (backend Toshkent kuni deb oladi), `T00:00:00.000Z` siz.
 */

const calls = vi.hoisted(() => ({
  analytics: [] as unknown[],
  topImpacts: [] as unknown[],
  // Serverdek: `page`/`limit` bo'yicha qatorlar va `pagination` (vmLTsAok). `undefined` — javob yo'q.
  topImpactsResponse: undefined as undefined | ((params: { page: number; limit: number }) => unknown),
}));

vi.mock("../../../entities/payments/financeCoverage", () => ({
  useFinanceCoverage: () => ({
    useGetFinancialBalanceAnalytics: (_enabled: boolean, params: unknown) => {
      calls.analytics.push(params);
      return { data: undefined, isLoading: false };
    },
    useGetFinancialBalanceTopImpacts: (_enabled: boolean, params: { page: number; limit: number }) => {
      calls.topImpacts.push(params);
      return { data: calls.topImpactsResponse?.(params), isLoading: false };
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
    expect(calls.topImpacts.at(-1)).toEqual({ fromDate: today, toDate: today, page: 1, limit: 10 });
    expect(JSON.stringify([...calls.analytics, ...calls.topImpacts])).not.toMatch(/T\d{2}:\d{2}/);
  });
});

describe("AnalysisTab — eng katta tranzaksiyalar server sahifalashi (vmLTsAok)", () => {
  const TOTAL = 186;
  const serverPage = ({ page, limit }: { page: number; limit: number }) => {
    const from = (page - 1) * limit;
    const items = Array.from({ length: Math.max(0, Math.min(limit, TOTAL - from)) }, (_, index) => ({
      id: String(from + index + 1),
      amount: 1_000_000 - (from + index) * 1000,
      operation_type: "income",
      source_type: "manual_income",
      payment_date: "2026-10-17T05:00:00.000Z",
    }));
    return { statusCode: 200, data: { items, pagination: { total: TOTAL, page, limit, totalPages: Math.ceil(TOTAL / limit) } } };
  };

  beforeEach(() => {
    calls.topImpacts.length = 0;
    calls.topImpactsResponse = serverPage;
  });

  afterEach(() => {
    calls.topImpactsResponse = undefined;
  });

  it("⭐ TC2/TC3: so'rovda `limit` 10 (≤ 100); sarlavhadagi «jami» — `pagination.total`, sahifalar soni u bilan mos (186 → 19)", () => {
    renderWithProviders(<AnalysisTab />, { route: "/financial-balance?tab=analysis" });

    expect(calls.topImpacts.every((params) => (params as { limit: number }).limit <= 100)).toBe(true);
    expect(screen.getByText("186 ta jami")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "19" })).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#10")).toBeInTheDocument();
    expect(screen.queryByText("#11")).not.toBeInTheDocument();
  });

  it("⭐ TC1: 11-sahifaga o'tiladi — server `page: 11` so'raladi va 101–110 qatorlar keladi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AnalysisTab />, { route: "/financial-balance?tab=analysis" });

    await user.click(screen.getByRole("button", { name: "5" }));
    for (let step = 0; step < 6; step += 1) await user.click(screen.getByRole("button", { name: "Keyingi" }));

    await waitFor(() => expect(calls.topImpacts.at(-1)).toMatchObject({ page: 11, limit: 10 }));
    expect(screen.getByText("#101")).toBeInTheDocument();
    expect(screen.getByText("#110")).toBeInTheDocument();
    expect(screen.queryByText("#100")).not.toBeInTheDocument();

    // Oxirgi sahifa — 19 (181–186), «Keyingi» o'chiq.
    await user.click(screen.getByRole("button", { name: "19" }));
    await waitFor(() => expect(calls.topImpacts.at(-1)).toMatchObject({ page: 19 }));
    expect(screen.getByText("#186")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keyingi" })).toBeDisabled();
  });
});

