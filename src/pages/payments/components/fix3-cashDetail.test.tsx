import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import CashDetail from "./cashDetail";

/**
 * FIX3 — kassa sahifasi (cash-detail):
 *  - FE-PAY-03 / C1: market to'lovi va filial → HQ `Idempotency-Key` bilan;
 *  - FE-PAY-08 / M14 / C14: market va filialda karta egasi tanlovi yo'q,
 *    `source_user_id` yuborilmaydi;
 *  - FE-PAY-04 / C2: sana filtri oddiy YYYY-MM-DD;
 *  - FE-PAY-15: HQ filial sahifasida summa serverdan (GET /branches);
 *  - FE-PAY-16: Excel — menejerga yo'q, xato ko'rinadi.
 * FIX3B (fix3b-cashDetail.test.tsx): FE-PAY-01 qaytarildi (menejer sahifasi
 * fix3 dan oldingidek), kuryer "O'tkazma"sida ham karta tanlovi yo'q,
 * menejerga "Do'konga o'tkazma" yo'q.
 */

type CashboxCall = { id: unknown; enabled: unknown; params: Record<string, unknown> };
type HistoryCall = { params: Record<string, unknown>; enabled: unknown };
type PaymentArg = { data: Record<string, unknown>; idempotencyKey: string };

const state = vi.hoisted(() => ({
  cashbox: undefined as unknown,
  cashboxCalls: [] as CashboxCall[],
  historyCalls: [] as HistoryCall[],
  managerPayable: undefined as unknown,
  branches: undefined as unknown,
  branchesEnabled: [] as boolean[],
  usersEnabled: [] as boolean[],
}));
const cashboxRefetch = vi.hoisted(() => vi.fn(async () => ({ data: state.cashbox })));
const branchesRefetch = vi.hoisted(() => vi.fn(async () => ({ data: state.branches })));
const marketPayment = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const branchPayment = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const courierPayment = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const apiGet = vi.hoisted(() => vi.fn());

vi.mock("../../../entities/payments", () => ({
  useCashBox: () => ({
    useGetCashBoxById: (id: unknown, enabled: unknown, params: Record<string, unknown>) => {
      state.cashboxCalls.push({ id, enabled, params });
      return { data: state.cashbox, isLoading: false, refetch: cashboxRefetch };
    },
    useGetFinanceHistory: (params: Record<string, unknown>, enabled: unknown) => {
      state.historyCalls.push({ params, enabled });
      return { data: undefined, isLoading: false, refetch: vi.fn(async () => ({ data: undefined })) };
    },
    useGetFinanceHistoryById: () => ({ data: undefined, isLoading: false, isError: false }),
    createPaymentCourier: courierPayment,
    createPaymentBranchToMain: branchPayment,
    createPaymentMarket: marketPayment,
  }),
}));
vi.mock("../../../entities/payments/financeCoverage", () => ({
  useFinanceCoverage: () => ({
    useGetManagerPayableToHq: () => ({
      data: state.managerPayable,
      isLoading: false,
      refetch: vi.fn(async () => ({ data: state.managerPayable })),
    }),
  }),
}));
vi.mock("../../../entities/markets", () => ({
  useMarkets: () => ({ useGetMarkets: () => ({ data: undefined, isLoading: false }) }),
}));
vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetUser: (_params: unknown, enabled: unknown) => {
      state.usersEnabled.push(Boolean(enabled));
      return {
        data: enabled
          ? { data: { items: [{ id: "1", name: "Bosh admin", role: "superadmin", cashbox: { balance_card: 0 } }] } }
          : undefined,
        isLoading: false,
      };
    },
  }),
}));
vi.mock("../../../entities/branch/api/useBranches", () => ({
  useBranches: (_params: unknown, enabled: boolean) => {
    state.branchesEnabled.push(enabled);
    return { data: enabled ? state.branches : undefined, isLoading: false, refetch: branchesRefetch };
  },
}));
vi.mock("../../../shared/api/api", () => ({ api: { get: apiGet }, LONG_REQUEST_TIMEOUT_MS: 120_000 }));
// Sana oralig'i: bitta tugma 2026-10-01 → 2026-10-01 ni tanlaydi.
vi.mock("../../../shared/ui/DateRangePicker", () => ({
  default: ({ onChange }: { onChange: (range: { startDate: Date | null; endDate: Date | null }) => void }) => (
    <button
      type="button"
      onClick={() => onChange({ startDate: new Date(2026, 9, 1), endDate: new Date(2026, 9, 1) })}
    >
      set-range
    </button>
  ),
}));

const superadmin = { role: { id: "1", role: "superadmin", region: null, name: "Admin" } } as never;

/** Prod my-profile (menejer 210): `branch` — branch_users QATORI (id 3), filial — 16. */
const managerProfile = {
  id: "210",
  name: "E2E Menejer REG",
  role: "manager",
  branch: {
    id: "3",
    branch_id: "16",
    user_id: "210",
    role: "MANAGER",
    branch: { id: "16", name: "E2E REGIONAL Samarqand", type: "REGIONAL", parent_id: "1" },
  },
};
const manager = {
  role: { id: "210", role: "manager", region: null, name: "Menejer" },
  user: {
    user: managerProfile,
    isAuthenticated: true,
    accessToken: "token",
    loading: false,
    isAppInitializing: false,
    error: null,
  },
} as never;

const marketCashbox = {
  statusCode: 200,
  data: {
    cashbox: { id: "40", cashbox_type: "markets", user_id: "201", balance: 12_000_000 },
    history: [],
  },
};
const hqBranchCashbox = {
  statusCode: 200,
  data: { cashbox: { id: "30", cashbox_type: "branch", user_id: "15", balance: 900_000 }, history: [] },
};

const paymentAccepted = { data: { statusCode: 200, message: "success", data: {} } };
const idempotentReplay = {
  data: { statusCode: 200, message: "To'lov allaqachon bajarilgan (takroriy so'rov)", data: { idempotent: true } },
};
/** Gateway RPC timeout (pul finance'da o'tgan bo'lishi mumkin). */
const gatewayTimeout = () =>
  Object.assign(new Error("Request failed with status code 504"), {
    response: { status: 504, data: { statusCode: 504, message: "Finance service response timeout" } },
  });
const badRequest = () =>
  Object.assign(new Error("Request failed with status code 400"), {
    response: { status: 400, data: { statusCode: 400, message: "Marketga ortiqcha to'lov" } },
  });

const OUTCOME_UNKNOWN =
  "Server javob bermadi — to'lov o'tgan bo'lishi mumkin. Kassa yangilandi, summani tekshiring: aynan shu to'lovni qayta yuborsangiz, u ikki marta yozilmaydi";
const ALREADY_RECORDED = "Bu to'lov allaqachon yozilgan — kassa yangilandi, summani tekshiring";
const MARKET_SUCCESS = "Marketga to'lov muvaffaqiyatli amalga oshirildi";
const BRANCH_SUCCESS = "Asosiy filialga to'lov muvaffaqiyatli o'tkazildi";

/** uz-UZ guruhlash belgisi U+00A0 — Testing Library matnni oddiy bo'shliqqa normallaydi. */
const money = (amount: number) => `${amount.toLocaleString("uz-UZ")} UZS`.replace(/\s+/g, " ");

const renderAt = (
  route: string | { pathname: string; search?: string; state?: unknown },
  preloadedState: never = superadmin,
) =>
  renderWithProviders(
    <Routes>
      <Route path="/payments/cash-detail/:id" element={<CashDetail />} />
    </Routes>,
    { route, preloadedState },
  );

const setAmount = (amount: string) =>
  fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: amount } });
const chooseMethod = (method: string) =>
  userEvent.setup().click(screen.getByRole("radio", { name: method }));
const submit = (label: string) => userEvent.setup().click(screen.getByRole("button", { name: label }));

const callsOf = (mock: { mutateAsync: ReturnType<typeof vi.fn> }) =>
  mock.mutateAsync.mock.calls.map(([arg]) => arg as PaymentArg);

beforeEach(() => {
  sessionStorage.clear();
  state.cashbox = undefined;
  state.cashboxCalls = [];
  state.historyCalls = [];
  state.managerPayable = undefined;
  state.branches = undefined;
  state.branchesEnabled = [];
  state.usersEnabled = [];
  cashboxRefetch.mockClear();
  branchesRefetch.mockClear();
  marketPayment.mutateAsync.mockReset();
  branchPayment.mutateAsync.mockReset();
  courierPayment.mutateAsync.mockReset();
  apiGet.mockReset();
});

describe("FE-PAY-03 / C1 — market payout and branch → HQ are idempotent", () => {
  it("market: a 504 keeps the key, warns and refetches; the identical retry reuses the key; the next payment gets a new key", async () => {
    marketPayment.mutateAsync.mockRejectedValueOnce(gatewayTimeout()).mockResolvedValue(paymentAccepted);
    state.cashbox = marketCashbox;
    renderAt("/payments/cash-detail/201?type=market");

    setAmount("5000000");
    await chooseMethod("Naqd");
    await submit("To'lash");

    expect(await screen.findByText(OUTCOME_UNKNOWN)).toBeInTheDocument();
    expect(screen.getByText("Finance service response timeout")).toBeInTheDocument();
    await waitFor(() => expect(cashboxRefetch).toHaveBeenCalled());
    // Forma qoladi — aynan shu to'lov qayta yuboriladi.
    expect(screen.getByPlaceholderText("0")).not.toHaveValue("");

    await submit("To'lash");
    await waitFor(() => expect(marketPayment.mutateAsync).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(MARKET_SUCCESS)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByPlaceholderText("0")).toHaveValue(""));

    setAmount("5000000");
    await chooseMethod("Naqd");
    await submit("To'lash");
    await waitFor(() => expect(marketPayment.mutateAsync).toHaveBeenCalledTimes(3));

    const [first, retry, next] = callsOf(marketPayment);
    expect(first.data).toEqual({
      market_id: "201",
      amount: 5_000_000,
      payment_method: "cash",
      payment_date: expect.any(String),
      comment: "",
    });
    expect(retry.idempotencyKey).toBe(first.idempotencyKey);
    expect(next.idempotencyKey).not.toBe(first.idempotencyKey);
  });

  it("market: a definite 4xx shows the backend error without the 'outcome unknown' warning", async () => {
    marketPayment.mutateAsync.mockRejectedValueOnce(badRequest());
    state.cashbox = marketCashbox;
    renderAt("/payments/cash-detail/201?type=market");

    setAmount("1000");
    await chooseMethod("Naqd");
    await submit("To'lash");

    expect(await screen.findByText("Marketga ortiqcha to'lov")).toBeInTheDocument();
    expect(screen.queryByText(OUTCOME_UNKNOWN)).not.toBeInTheDocument();
  });

  it("market: a duplicate (idempotent) reply is a warning, not a second success", async () => {
    marketPayment.mutateAsync.mockResolvedValueOnce(idempotentReplay);
    state.cashbox = marketCashbox;
    renderAt("/payments/cash-detail/201?type=market");

    setAmount("5000000");
    await chooseMethod("Naqd");
    await submit("To'lash");

    expect(await screen.findByText(ALREADY_RECORDED)).toBeInTheDocument();
    expect(screen.queryByText(MARKET_SUCCESS)).not.toBeInTheDocument();
    await waitFor(() => expect(cashboxRefetch).toHaveBeenCalled());
    expect(screen.getByPlaceholderText("0")).toHaveValue("");
  });

  it("market and branch fingerprints differ for the same id and amount", async () => {
    marketPayment.mutateAsync.mockRejectedValue(gatewayTimeout());
    branchPayment.mutateAsync.mockRejectedValue(gatewayTimeout());
    state.cashbox = marketCashbox;
    const market = renderAt("/payments/cash-detail/15?type=market");
    setAmount("1000");
    await chooseMethod("Naqd");
    await submit("To'lash");
    await waitFor(() => expect(marketPayment.mutateAsync).toHaveBeenCalledTimes(1));
    market.unmount();

    state.cashbox = hqBranchCashbox;
    renderAt("/payments/cash-detail/15?type=branch");
    setAmount("1000");
    await chooseMethod("Naqd");
    await submit("HQga o'tkazish");
    await waitFor(() => expect(branchPayment.mutateAsync).toHaveBeenCalledTimes(1));

    expect(callsOf(branchPayment)[0].idempotencyKey).not.toBe(callsOf(marketPayment)[0].idempotencyKey);
  });

  it("branch → HQ (superadmin): the retry after a 504 reuses the key — even after a reload", async () => {
    branchPayment.mutateAsync.mockRejectedValueOnce(gatewayTimeout()).mockResolvedValue(paymentAccepted);
    state.cashbox = hqBranchCashbox;
    const first = renderAt("/payments/cash-detail/15?type=branch");

    setAmount("300000");
    await chooseMethod("Naqd");
    await submit("HQga o'tkazish");
    expect(await screen.findByText(OUTCOME_UNKNOWN)).toBeInTheDocument();
    first.unmount();

    renderAt("/payments/cash-detail/15?type=branch");
    setAmount("300000");
    await chooseMethod("Naqd");
    await submit("HQga o'tkazish");
    await waitFor(() => expect(branchPayment.mutateAsync).toHaveBeenCalledTimes(2));

    const [beforeReload, afterReload] = callsOf(branchPayment);
    expect(beforeReload.data).toEqual(
      expect.objectContaining({ branch_id: "15", amount: 300_000, payment_method: "cash" }),
    );
    expect(afterReload.idempotencyKey).toBe(beforeReload.idempotencyKey);
    expect(await screen.findByText(BRANCH_SUCCESS)).toBeInTheDocument();
  });
});

describe("FE-PAY-08 / M14 / C14 — no card-owner picker and no source_user_id for market and branch", () => {
  it("market: 'O'tkazma' shows no card picker and posts payment_method click without source_user_id", async () => {
    marketPayment.mutateAsync.mockResolvedValue(paymentAccepted);
    state.cashbox = marketCashbox;
    renderAt("/payments/cash-detail/201?type=market");

    setAmount("100000");
    await chooseMethod("O'tkazma");
    expect(screen.queryByLabelText("Kartani tanlang")).not.toBeInTheDocument();
    expect(state.usersEnabled.some(Boolean)).toBe(false);

    await submit("To'lash");
    await waitFor(() => expect(marketPayment.mutateAsync).toHaveBeenCalledTimes(1));
    expect(callsOf(marketPayment)[0].data).toEqual({
      market_id: "201",
      amount: 100_000,
      payment_method: "click",
      payment_date: expect.any(String),
      comment: "",
    });
  });

  it("branch → HQ: 'O'tkazma' shows no card picker and posts no source_user_id", async () => {
    branchPayment.mutateAsync.mockResolvedValue(paymentAccepted);
    state.cashbox = hqBranchCashbox;
    renderAt("/payments/cash-detail/15?type=branch");

    setAmount("100000");
    await chooseMethod("O'tkazma");
    expect(screen.queryByLabelText("Kartani tanlang")).not.toBeInTheDocument();

    await submit("HQga o'tkazish");
    await waitFor(() => expect(branchPayment.mutateAsync).toHaveBeenCalledTimes(1));
    const [call] = callsOf(branchPayment);
    expect(call.data).toEqual(
      expect.objectContaining({ branch_id: "15", amount: 100_000, payment_method: "click" }),
    );
    expect(call.data).not.toHaveProperty("source_user_id");
  });
});

describe("FE-PAY-04 / C2 — cash-detail date filter", () => {
  it("sends plain YYYY-MM-DD fromDate/toDate to cashbox/user/:id and the market payout still works", async () => {
    marketPayment.mutateAsync.mockResolvedValue(paymentAccepted);
    state.cashbox = marketCashbox;
    renderAt("/payments/cash-detail/201?type=market");

    await userEvent.setup().click(screen.getByRole("button", { name: "set-range" }));
    await waitFor(() =>
      expect(state.cashboxCalls.at(-1)?.params).toEqual(
        expect.objectContaining({ cashbox_type: "markets", fromDate: "2026-10-01", toDate: "2026-10-01" }),
      ),
    );

    setAmount("1000");
    await chooseMethod("Naqd");
    await submit("To'lash");
    await waitFor(() => expect(marketPayment.mutateAsync).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Bu market kassasi emas — to'lov yuborilmadi.")).not.toBeInTheDocument();
  });
});

describe("FE-PAY-15 — HQ branch receive page reads the payable from the server", () => {
  const openHqBranch = (amount: number) =>
    renderAt({
      pathname: "/payments/cash-detail/15",
      search: "?type=branch",
      state: { type: "branch", entity: { id: "15", name: "Sirdaryo menejeri", role: "branch", amount } },
    });

  it("shows the server berilishi_kerak (GET /branches), not the stale router-state amount", () => {
    state.cashbox = hqBranchCashbox;
    state.branches = {
      data: [{ id: "15", name: "E2E Filial Sirdaryo", type: "REGIONAL", status: "active", berilishi_kerak: 400_000 }],
    };
    openHqBranch(1_000_000);

    expect(state.branchesEnabled.some(Boolean)).toBe(true);
    expect(screen.getAllByText(money(400_000)).length).toBeGreaterThan(0);
    expect(screen.queryByText(money(1_000_000))).not.toBeInTheDocument();
    expect(screen.getAllByText("Qabul qilinishi kerak").length).toBeGreaterThan(0);
  });

  it("falls back to the router-state amount when the branch is not in the server list", () => {
    state.cashbox = hqBranchCashbox;
    state.branches = { data: [] };
    openHqBranch(1_000_000);

    expect(screen.getAllByText(money(1_000_000)).length).toBeGreaterThan(0);
  });

  it("after a receipt shows the refreshed server payable, or the locally reduced one while the ledger lags", async () => {
    branchPayment.mutateAsync.mockResolvedValue(paymentAccepted);
    state.cashbox = hqBranchCashbox;
    state.branches = {
      data: [{ id: "15", name: "E2E Filial Sirdaryo", type: "REGIONAL", status: "active", berilishi_kerak: 400_000 }],
    };
    openHqBranch(400_000);

    // Ledger hali yangilanmagan (server summasi o'zgarmagan) — mahalliy 400 000 − 100 000.
    setAmount("100000");
    await chooseMethod("Naqd");
    await submit("HQga o'tkazish");
    expect(await screen.findByText(BRANCH_SUCCESS)).toBeInTheDocument();
    await waitFor(() => expect(branchesRefetch).toHaveBeenCalled());
    await waitFor(() => expect(screen.getAllByText(money(300_000)).length).toBeGreaterThan(0));
  });

  it("after a receipt applies the refreshed server payable when the ledger already moved", async () => {
    branchPayment.mutateAsync.mockResolvedValue(paymentAccepted);
    state.cashbox = hqBranchCashbox;
    state.branches = {
      data: [{ id: "15", name: "E2E Filial Sirdaryo", type: "REGIONAL", status: "active", berilishi_kerak: 400_000 }],
    };
    branchesRefetch.mockResolvedValueOnce({
      data: {
        data: [{ id: "15", name: "E2E Filial Sirdaryo", type: "REGIONAL", status: "active", berilishi_kerak: 250_000 }],
      },
    });
    openHqBranch(400_000);

    setAmount("100000");
    await chooseMethod("Naqd");
    await submit("HQga o'tkazish");

    expect(await screen.findByText(BRANCH_SUCCESS)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText(money(250_000)).length).toBeGreaterThan(0));
    expect(screen.queryByText(money(300_000))).not.toBeInTheDocument();
  });
});

describe("FE-PAY-16 — Excel export on cash-detail", () => {
  it("manager: the Excel button is not shown (export is ADMIN/SUPERADMIN only)", () => {
    state.cashbox = {
      statusCode: 200,
      data: {
        cashbox: { id: "60", cashbox_type: "couriers", user_id: "209", balance: 70_000 },
        history: [],
        user: { id: "209", name: "Filial kuryeri", role: "courier" },
      },
    };
    renderAt("/payments/cash-detail/209?type=courier", manager);

    expect(screen.queryByRole("button", { name: /Excel/ })).not.toBeInTheDocument();
  });

  it("superadmin: a failed export shows the backend message from the Blob body", async () => {
    apiGet.mockRejectedValueOnce(
      Object.assign(new Error("Request failed with status code 403"), {
        response: {
          status: 403,
          data: new Blob([JSON.stringify({ statusCode: 403, message: "Forbidden resource" })], {
            type: "application/json",
          }),
        },
      }),
    );
    state.cashbox = marketCashbox;
    renderAt("/payments/cash-detail/201?type=market");

    await userEvent.setup().click(screen.getByRole("button", { name: /Excel/ }));

    expect(await screen.findByText("Forbidden resource")).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith(
      "export/cashbox-history.xlsx",
      expect.objectContaining({ params: expect.objectContaining({ cashbox_id: "40" }) }),
    );
  });

  it("superadmin: a network failure shows the generic export error", async () => {
    apiGet.mockRejectedValueOnce({});
    state.cashbox = marketCashbox;
    renderAt("/payments/cash-detail/201?type=market");

    await userEvent.setup().click(screen.getByRole("button", { name: /Excel/ }));

    expect(await screen.findByText("Excel faylni yuklab bo'lmadi")).toBeInTheDocument();
  });
});
