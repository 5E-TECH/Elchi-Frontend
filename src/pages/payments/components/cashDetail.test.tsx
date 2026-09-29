import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import CashDetail, { normalizeType } from "./cashDetail";

const cashboxState = vi.hoisted(() => ({ response: undefined as unknown }));
const marketPayment = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const idle = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
const idleQuery = { data: undefined, isLoading: false, refetch: vi.fn() };

vi.mock("../../../entities/payments", () => ({
  useCashBox: () => ({
    useGetCashBoxById: () => ({ data: cashboxState.response, isLoading: false, refetch: vi.fn() }),
    useGetFinanceHistory: () => idleQuery,
    useGetFinanceHistoryById: () => idleQuery,
    createPaymentCourier: idle,
    createPaymentBranchToMain: idle,
    createPaymentMarket: marketPayment,
  }),
}));
vi.mock("../../../entities/payments/financeCoverage", () => ({
  useFinanceCoverage: () => ({ useGetManagerPayableToHq: () => idleQuery }),
}));
vi.mock("../../../entities/markets", () => ({
  useMarkets: () => ({ useGetMarkets: () => ({ data: undefined, isLoading: false }) }),
}));
vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({ useGetUser: () => ({ data: undefined, isLoading: false }) }),
}));

const superadmin = { role: { id: "1", role: "superadmin", region: null, name: "Admin" } } as never;

/** State'siz ochish = F5, ulashilgan havola yoki yangi tab. */
const openWithoutState = (route: string) =>
  renderWithProviders(
    <Routes>
      <Route path="/payments/cash-detail/:id" element={<CashDetail />} />
    </Routes>,
    { route, preloadedState: superadmin },
  );

describe("normalizeType", () => {
  it("recognises a branch cashbox", () => {
    expect(normalizeType("branch")).toBe("branch");
    expect(normalizeType("main")).toBe("branch");
    expect(normalizeType(undefined, "branch")).toBe("branch");
  });

  it("recognises courier and market cashboxes", () => {
    expect(normalizeType("couriers")).toBe("courier");
    expect(normalizeType("markets")).toBe("market");
  });

  it("returns null (not market) when the type cannot be determined", () => {
    expect(normalizeType(undefined)).toBeNull();
    expect(normalizeType("something-else")).toBeNull();
  });
});

describe("CashDetail without router state (F5 / shared link)", () => {
  afterEach(() => {
    cashboxState.response = undefined;
    marketPayment.mutateAsync.mockReset();
  });

  it("opens a branch cashbox as the branch → HQ form, never as a market payment", () => {
    // Jonli #13 — Andijon filiali: GET /finance/cashbox/user/13 → cashbox_type "branch".
    cashboxState.response = { data: { cashbox: { id: "30", cashbox_type: "branch", user_id: "13", balance: 0 } } };
    openWithoutState("/payments/cash-detail/13");

    expect(screen.queryByText("Marketga to'lov qilish")).not.toBeInTheDocument();
    expect(screen.queryByText("Market kassasi")).not.toBeInTheDocument();
    expect(screen.getAllByText("Filial kassasidan asosiy kassaga pul o'tkazish").length).toBeGreaterThan(0);
  });

  it("keeps the type from the URL (?type=branch) even before the cashbox loads", () => {
    openWithoutState("/payments/cash-detail/13?type=branch");

    expect(screen.queryByText("Marketga to'lov qilish")).not.toBeInTheDocument();
    expect(screen.getAllByText("Filial kassasidan asosiy kassaga pul o'tkazish").length).toBeGreaterThan(0);
  });

  it("shows no payment form at all when the type cannot be determined", () => {
    cashboxState.response = { data: { cashbox: { id: "99", user_id: "13" } } };
    openWithoutState("/payments/cash-detail/13");

    expect(screen.getByRole("alert")).toHaveTextContent("Kassa turi aniqlanmadi");
    expect(screen.queryByText("Marketga to'lov qilish")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "To'lash" })).not.toBeInTheDocument();
  });

  it("still opens a real market cashbox as a market payment", () => {
    cashboxState.response = { data: { cashbox: { id: "40", cashbox_type: "markets", user_id: "3", balance: 0 } } };
    openWithoutState("/payments/cash-detail/3");

    expect(screen.getAllByText("Marketga to'lov qilish").length).toBeGreaterThan(0);
  });
});
