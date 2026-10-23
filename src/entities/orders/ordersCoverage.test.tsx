import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { API_ENDPOINTS } from "../../shared/api";
import { useOrdersCoverage } from "./ordersCoverage";

vi.mock("../../shared/api/api", () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

/**
 * XAtqsRNH d381b1: lump-sum hisob-kitob oyoqlari (`POST orders/settlement/*`) backendda 410 Gone — o'lik mutatsiyalar
 * (pul ko'chirgach hech qanday kassa so'rovi yangilanmasdi) va ularning endpoint konstantalari olib tashlangan.
 * Pul amallari faqat `entities/payments` orqali (`refreshCashboxQueries`).
 */
const sources = import.meta.glob(["../../**/*.{ts,tsx}", "!../../**/*.test.{ts,tsx}"], {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

describe("useOrdersCoverage — o'lik settlement mutatsiyalari yo'q (d381b1)", () => {
  it("settlementCourierToBranch / settlementBranchToHq / settlementHqToMarket qaytarilmaydi", () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useOrdersCoverage(), { wrapper });
    expect(Object.keys(result.current).filter((name) => /^settlement/i.test(name))).toEqual([]);
    // Har-buyurtma holati (GET orders/:id/settlement) backendda bor — qoladi.
    expect(result.current.useGetSettlementState).toBeTypeOf("function");
  });

  it("410 Gone yo'llari endpoint konstantalarida va kodda yo'q", () => {
    const orders = API_ENDPOINTS.ORDERS as Record<string, unknown>;
    expect(Object.keys(orders).filter((name) => /^SETTLEMENT_(COURIER|BRANCH|HQ)/.test(name))).toEqual([]);
    const offenders = Object.entries(sources)
      .filter(([, text]) => /orders\/settlement\/(courier-to-branch|branch-to-hq|hq-to-market)"/.test(text))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
