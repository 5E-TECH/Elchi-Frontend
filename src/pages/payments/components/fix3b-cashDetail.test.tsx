import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import CashDetail from "./cashDetail";

/**
 * FIX3B — kassa sahifasi (cash-detail):
 *  - FE-PAY-01 QAYTARILDI (foydalanuvchi qarori #7): menejerning "HQga
 *    o'tkazish" sahifasi fix3 dan oldingidek — filial ID si URL'dan, profildagi
 *    filial emas. Filial puli HQ ga faqat superadmin/admin qabul qilganda
 *    o'tadi. `Idempotency-Key` o'rami qoladi;
 *  - menejerga "Do'konga o'tkazma" (click_to_market) ko'rsatilmaydi — backend
 *    403; superadmin/admin'da qoladi;
 *  - kuryer "O'tkazma"sida ham karta egasi tanlovi yo'q (qiymati hech qachon
 *    yuborilmasdi).
 */

type HistoryCall = { params: Record<string, unknown>; enabled: unknown };
type PaymentArg = { data: Record<string, unknown>; idempotencyKey: string };

const state = vi.hoisted(() => ({
  cashbox: undefined as unknown,
  historyCalls: [] as HistoryCall[],
  managerPayable: undefined as unknown,
  usersEnabled: [] as boolean[],
}));
const cashboxRefetch = vi.hoisted(() => vi.fn(async () => ({ data: state.cashbox })));
const marketPayment = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const branchPayment = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const courierPayment = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));

vi.mock("../../../entities/payments", () => ({
  useCashBox: () => ({
    useGetCashBoxById: () => ({ data: state.cashbox, isLoading: false, refetch: cashboxRefetch }),
    useGetFinanceHistory: (params: Record<string, unknown>, enabled: unknown) => {
      state.historyCalls.push({ params, enabled });
      return {
        data: undefined,
        isLoading: false,
        refetch: vi.fn(async () => ({ data: undefined })),
      };
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
// Karta egasi tanlovi uchun GET /users — endi hech qachon so'ralmasligi kerak.
vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetUser: (_params: unknown, enabled: unknown) => {
      state.usersEnabled.push(Boolean(enabled));
      return { data: undefined, isLoading: false };
    },
  }),
}));
vi.mock("../../../entities/branch/api/useBranches", () => ({
  useBranches: () => ({
    data: undefined,
    isLoading: false,
    refetch: vi.fn(async () => ({ data: undefined })),
  }),
}));

const superadmin = { role: { id: "1", role: "superadmin", region: null, name: "Admin" } } as never;

/** Prod my-profile (menejer 210): `branch` — branch_users QATORI (id 3), filial — 16. */
const manager = {
  role: { id: "210", role: "manager", region: null, name: "Menejer" },
  user: {
    user: {
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
    },
    isAuthenticated: true,
    accessToken: "token",
    loading: false,
    isAppInitializing: false,
    error: null,
  },
} as never;

/** Superadmin/admin uchun HQ kuryeri kassasi (C3 maydonlari bilan). */
const hqCourierCashbox = {
  statusCode: 200,
  data: {
    cashbox: { id: "70", cashbox_type: "couriers", user_id: "263", balance: 250_000 },
    history: [],
    user: { id: "263", name: "Ali Valiyev", role: "courier" },
    is_hq_courier: true,
    can_receive: true,
    receive_check_failed: false,
    olinishi_kerak: 250_000,
  },
};
/** Menejer uchun o'z filiali kuryeri kassasi (C3 maydonlari menejerga kelmaydi). */
const branchCourierCashbox = {
  statusCode: 200,
  data: {
    cashbox: { id: "60", cashbox_type: "couriers", user_id: "209", balance: 70_000 },
    history: [],
    user: { id: "209", name: "Filial kuryeri", role: "courier" },
  },
};

const paymentAccepted = { data: { statusCode: 200, message: "success", data: {} } };
const OUTCOME_UNKNOWN =
  "Server javob bermadi — to'lov o'tgan bo'lishi mumkin. Kassa yangilandi, summani tekshiring: aynan shu to'lovni qayta yuborsangiz, u ikki marta yozilmaydi";
const BRANCH_SUCCESS = "Asosiy filialga to'lov muvaffaqiyatli o'tkazildi";
const RECEIVE_SUCCESS = "Kuryerdan to'lov muvaffaqiyatli qabul qilindi";
const TO_MARKET = "Do'konga o'tkazma";
const CARD_PICKER = "Kartani tanlang";

const renderAt = (route: string, preloadedState: never = superadmin) =>
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
const submit = (label: string) =>
  userEvent.setup().click(screen.getByRole("button", { name: label }));
const callsOf = (mock: { mutateAsync: ReturnType<typeof vi.fn> }) =>
  mock.mutateAsync.mock.calls.map(([arg]) => arg as PaymentArg);

beforeEach(() => {
  sessionStorage.clear();
  state.cashbox = undefined;
  state.historyCalls = [];
  state.managerPayable = undefined;
  state.usersEnabled = [];
  cashboxRefetch.mockClear();
  marketPayment.mutateAsync.mockReset();
  branchPayment.mutateAsync.mockReset();
  courierPayment.mutateAsync.mockReset();
});

describe("FE-PAY-01 reverted — the manager's own HQ handover screen is as before fix3", () => {
  beforeEach(() => {
    state.managerPayable = {
      data: {
        kassadagi_summa: 500_000,
        berilishi_kerak: 500_000,
        olinishi_kerak: 0,
        counterparty: "HQ",
      },
    };
  });

  it("sends the URL id as branch_id (not the profile branch 16), still with an Idempotency-Key", async () => {
    branchPayment.mutateAsync.mockResolvedValue(paymentAccepted);
    renderAt("/payments/cash-detail/3?type=branch", manager);

    setAmount("100000");
    await chooseMethod("Naqd");
    await submit("HQga o'tkazish");

    await waitFor(() => expect(branchPayment.mutateAsync).toHaveBeenCalledTimes(1));
    const [call] = callsOf(branchPayment);
    expect(call.data).toEqual({
      branch_id: "3",
      amount: 100_000,
      payment_method: "cash",
      payment_date: expect.any(String),
      comment: "",
    });
    expect(call.idempotencyKey).toEqual(expect.any(String));
    expect(call.idempotencyKey).not.toBe("");
    expect(await screen.findByText(BRANCH_SUCCESS)).toBeInTheDocument();
    // Tarix ham URL'dagi ID bo'yicha (fix3 dan oldingidek).
    expect(
      state.historyCalls.some(
        (entry) =>
          entry.enabled && entry.params.user_id === "3" && entry.params.cashbox_type === "branch",
      ),
    ).toBe(true);
    expect(state.historyCalls.some((entry) => entry.params.user_id === "16")).toBe(false);
  });

  it("the gateway's 403 is shown as a definite error (no 'outcome unknown' warning, no success)", async () => {
    branchPayment.mutateAsync.mockRejectedValueOnce(
      Object.assign(new Error("Request failed with status code 403"), {
        response: {
          status: 403,
          data: {
            statusCode: 403,
            message: "Siz faqat o'z branch'ingiz pulini HQ ga topshira olasiz",
          },
        },
      }),
    );
    renderAt("/payments/cash-detail/3?type=branch", manager);

    setAmount("100000");
    await chooseMethod("Naqd");
    await submit("HQga o'tkazish");

    expect(
      await screen.findByText("Siz faqat o'z branch'ingiz pulini HQ ga topshira olasiz"),
    ).toBeInTheDocument();
    expect(screen.queryByText(OUTCOME_UNKNOWN)).not.toBeInTheDocument();
    expect(screen.queryByText(BRANCH_SUCCESS)).not.toBeInTheDocument();
    expect(callsOf(branchPayment)[0].data).toEqual(expect.objectContaining({ branch_id: "3" }));
  });
});

describe("'Do'konga o'tkazma' (click_to_market) — HQ cashbox only", () => {
  it("manager: the courier receive page does not offer it (backend 403)", () => {
    state.cashbox = branchCourierCashbox;
    renderAt("/payments/cash-detail/209?type=courier", manager);

    expect(screen.getByRole("radio", { name: "Naqd" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "O'tkazma" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: TO_MARKET })).not.toBeInTheDocument();
  });

  it("superadmin: the HQ courier page keeps it", () => {
    state.cashbox = hqCourierCashbox;
    renderAt("/payments/cash-detail/263?type=courier");

    expect(screen.getByRole("radio", { name: TO_MARKET })).toBeInTheDocument();
  });
});

describe("Courier 'O'tkazma' — no card-owner picker (its value was never sent)", () => {
  it("superadmin: no picker, no users list, and the payload is exactly the courier DTO fields", async () => {
    courierPayment.mutateAsync.mockResolvedValue(paymentAccepted);
    state.cashbox = hqCourierCashbox;
    renderAt("/payments/cash-detail/263?type=courier");

    setAmount("100000");
    await chooseMethod("O'tkazma");
    expect(screen.queryByLabelText(CARD_PICKER)).not.toBeInTheDocument();
    expect(screen.queryByText(CARD_PICKER)).not.toBeInTheDocument();

    await submit("Qabul qilish");
    await waitFor(() => expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(1));
    expect(callsOf(courierPayment)[0].data).toEqual({
      courier_id: "263",
      amount: 100_000,
      payment_method: "click",
      market_id: null,
      payment_date: expect.any(String),
      comment: "",
    });
    expect(await screen.findByText(RECEIVE_SUCCESS)).toBeInTheDocument();
    expect(state.usersEnabled.some(Boolean)).toBe(false);
  });

  it("manager: no picker and the transfer payment still goes through", async () => {
    courierPayment.mutateAsync.mockResolvedValue(paymentAccepted);
    state.cashbox = branchCourierCashbox;
    renderAt("/payments/cash-detail/209?type=courier", manager);

    setAmount("50000");
    await chooseMethod("O'tkazma");
    expect(screen.queryByLabelText(CARD_PICKER)).not.toBeInTheDocument();

    await submit("Qabul qilish");
    await waitFor(() => expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(1));
    const [call] = callsOf(courierPayment);
    expect(call.data).toEqual(
      expect.objectContaining({
        courier_id: "209",
        amount: 50_000,
        payment_method: "click",
        market_id: null,
      }),
    );
    expect(call.data).not.toHaveProperty("source_user_id");
    expect(call.idempotencyKey).toEqual(expect.any(String));
    expect(state.usersEnabled.some(Boolean)).toBe(false);
  });
});
