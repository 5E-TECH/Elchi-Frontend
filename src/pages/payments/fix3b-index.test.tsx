import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { vi } from "vitest";
import Payments from "./index";
import { renderWithProviders } from "../../test/test-utils";

/**
 * FIX3B — /payments: FE-PAY-01 QAYTARILDI (foydalanuvchi qarori #7) — menejer filial pulini o'zi topshirmaydi.
 * Menejerning "Berilishi kerak" kartasi HQ kassasi sahifasini (faqat ko'rish, IjqTYQks) HAQIQIY filial id bilan ochadi
 * (IjqTYQks, prod: branch_users qatori id'si bilan POST 403 olardi): `all-info.branch_id` → `profile.branch.branch_id`
 * → ichki `profile.branch.branch.id` → `profile.branch_id`; profildagi qatorning o'z `id` si hech qachon.
 */

const LocationProbe = () => {
  const { pathname, search, state } = useLocation();
  return (
    <>
      <span data-testid="pathname">{pathname}</span>
      <span data-testid="search">{search}</span>
      <span data-testid="state">{JSON.stringify(state ?? null)}</span>
    </>
  );
};

const page = vi.hoisted(() => ({ cashboxInfo: { data: {} } as unknown }));

vi.mock("../../entities/payments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../entities/payments")>()),
  useCashBox: () => ({
    useGetCashBoxInfo: () => ({ data: page.cashboxInfo, isLoading: false }),
    useGetFinanceHistory: () => ({ data: { data: { items: [] } }, isLoading: false }),
    useGetHqCourierReceivables: () => ({ data: undefined, isLoading: false }),
    useGetCurrentShift: () => ({ isSuccess: false, data: undefined }),
    openShift: { mutateAsync: vi.fn(), isPending: false },
    useGetCashBoxMain: () => ({ data: undefined, isLoading: false }),
  }),
}));
vi.mock("../../entities/payments/financeCoverage", () => ({
  useFinanceCoverage: () => ({
    useGetManagerSettlement: () => ({ data: undefined }),
    useGetManagerPayableToHq: () => ({ data: undefined }),
  }),
}));
vi.mock("../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetUser: () => ({ data: { data: { items: [] } }, isLoading: false }),
    useGetUserById: () => ({ data: undefined }),
    useGetManagers: () => ({ data: undefined, isLoading: false }),
    useGetCouriers: () => ({ data: undefined, isLoading: false }),
  }),
}));
vi.mock("../../entities/markets", () => ({
  useMarkets: () => ({ useGetMarkets: () => ({ data: undefined, isLoading: false }) }),
}));
vi.mock("../../entities/branch/api/useBranches", () => ({
  useBranches: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("./components/patmentHistoryTable", () => ({
  default: () => <div data-testid="payment-history-table" />,
}));

/** Prod my-profile (menejer 210): `branch` — branch_users QATORI (id 3), filial — 16. */
const manager = {
  role: { id: "210", role: "manager", region: null, name: "Menejer" },
  user: {
    user: {
      id: "210",
      name: "E2E Menejer REG",
      role: "manager",
      region: null,
      branch: {
        id: "3",
        branch_id: "16",
        user_id: "210",
        role: "MANAGER",
        branch: { id: "16", name: "E2E REGIONAL Samarqand", type: "REGIONAL", parent_id: "1" },
      },
    },
    isAuthenticated: true,
    accessToken: "token",
    loading: false,
    isAppInitializing: false,
    error: null,
  },
} as never;

const open = () =>
  renderWithProviders(
    <>
      <Payments />
      <LocationProbe />
    </>,
    { route: "/payments", preloadedState: manager },
  );

beforeEach(() => {
  page.cashboxInfo = {
    data: {
      kassadagi_summa: 500_000,
      berilishi_kerak: 500_000,
      olinishi_kerak: 0,
      counterparty: "HQ",
    },
  };
});

describe("IjqTYQks — manager 'Berilishi kerak' opens the HQ cashbox (read-only) with the real branch id, not the branch_users row id", () => {
  it("opens /payments/cash-detail/<profile.branch.branch_id>?type=branch (16, not the row id 3)", async () => {
    open();

    await userEvent.setup().click(screen.getByText("Berilishi kerak"));

    expect(screen.getByTestId("pathname").textContent).toBe("/payments/cash-detail/16");
    expect(screen.getByTestId("search").textContent).toBe("?type=branch");
    expect(JSON.parse(screen.getByTestId("state").textContent || "null")).toEqual(
      expect.objectContaining({
        type: "branch",
        entity: expect.objectContaining({ id: "16", role: "branch", amount: 500_000 }),
      }),
    );
  });

  it("an explicit all-info branch_id still wins (original order)", async () => {
    page.cashboxInfo = {
      data: {
        branch_id: "16",
        kassadagi_summa: 500_000,
        berilishi_kerak: 500_000,
        olinishi_kerak: 0,
        counterparty: "HQ",
      },
    };
    open();

    await userEvent.setup().click(screen.getByText("Berilishi kerak"));

    expect(screen.getByTestId("pathname").textContent).toBe("/payments/cash-detail/16");
  });

  it("ega qarori (#7, 2026-10-25): menejer sarlavhasida «HQ'ga o'tkazish» yo'q — HQ filial pulini o'zi oladi", () => {
    open();

    expect(screen.queryByRole("button", { name: "HQ'ga o'tkazish" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kuryerdan qabul qilish" })).toBeInTheDocument();
  });

  it("a cashbox `branch` entity (not a branch_users row) keeps its own id", async () => {
    page.cashboxInfo = {
      data: {
        branch: { id: "21", name: "Kassa filiali" },
        kassadagi_summa: 500_000,
        berilishi_kerak: 500_000,
        olinishi_kerak: 0,
        counterparty: "HQ",
      },
    };
    open();

    await userEvent.setup().click(screen.getByText("Berilishi kerak"));

    expect(screen.getByTestId("pathname").textContent).toBe("/payments/cash-detail/21");
  });
});
