import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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
  managerSettlement: undefined as unknown,
  usersEnabled: [] as boolean[],
  /** `GET /couriers` (menejer kuryer kassasi summasi, T2VHX1Y7). */
  couriers: undefined as unknown,
}));
const cashboxRefetch = vi.hoisted(() => vi.fn(async () => ({ data: state.cashbox })));
const marketPayment = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const branchPayment = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const courierPayment = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));

// qzjTMWPb: kunlik agregatlar bu testda emas — 403 holati: bloklar chizilmaydi, sahifa o'zgarmaydi.
vi.mock("../../../entities/payments/financeDaily", async (importOriginal) => {
  const forbidden = () => ({ isError: true, error: { response: { status: 403 } }, isLoading: false, refetch: vi.fn() });
  return {
    ...(await importOriginal<object>()),
    useFinanceHistoryDaily: forbidden,
    useFinancialBalanceDaily: forbidden,
  };
});

vi.mock("../../../entities/payments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/payments")>()),
  useCashBox: () => ({
    // CB-2: smena ochiq (qulf yo'q) — forma testlari smenaga bog'liq emas.
    useGetCurrentShift: () => ({
      isSuccess: true,
      isError: false,
      data: { data: { shift: { id: "5", status: "open", opened_by: "1" }, required: true } },
      refetch: vi.fn(),
    }),
    openShift: { mutateAsync: vi.fn(), isPending: false },
    useGetCashBoxMain: () => ({ isSuccess: false, data: undefined }),
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
    useGetManagerSettlement: () => ({ data: state.managerSettlement, isLoading: false, refetch: vi.fn() }),
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
    // Menejer kuryer kassasi summasi (T2VHX1Y7) — `GET /couriers`.
    useGetUserById: () => ({ data: undefined }),
    useGetCouriers: (_params: unknown, enabled: unknown) => ({ data: enabled ? state.couriers : undefined, isLoading: false }),
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
const RECEIVE_SUCCESS = "Kuryerdan to'lov muvaffaqiyatli qabul qilindi";
// Dizayn v2 (maket): «Do'konga o'tkazma» → «Marketga o'tkazma».
const TO_MARKET = "Marketga o'tkazma";
const CONFIRM_TITLE = "To'lovni tasdiqlang";
/** Menejer → HQ tugmasi endi yo'q (ega qarori #7) — qaytmasligini tekshirish uchun. */
const TRANSFER_TO_HQ = /HQ'ga o'tkazish$/;
const RECEIVE = /qabul qilish$/i;
const CARD_PICKER = "Kartani tanlang";

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
/** Forma tugmasi → (5hBeDuyn) tasdiq oynasi ochilsa, undagi «Tasdiqlash». */
const submit = async (label: string | RegExp) => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: label }));
  const dialog = await screen.findByRole("alertdialog", { name: CONFIRM_TITLE }).catch(() => null);
  if (dialog) {
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  }
};
const callsOf = (mock: { mutateAsync: ReturnType<typeof vi.fn> }) =>
  mock.mutateAsync.mock.calls.map(([arg]) => arg as PaymentArg);

beforeEach(() => {
  sessionStorage.clear();
  state.cashbox = undefined;
  state.historyCalls = [];
  state.managerPayable = undefined;
  state.managerSettlement = undefined;
  state.usersEnabled = [];
  state.couriers = undefined;
  cashboxRefetch.mockClear();
  marketPayment.mutateAsync.mockReset();
  branchPayment.mutateAsync.mockReset();
  courierPayment.mutateAsync.mockReset();
});

describe("Ega qarori #7 (IjqTYQks, 2026-10-25) — menejer HQ'ga pul o'tkazmaydi: HQ kassasi sahifasi faqat ko'rish uchun", () => {
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

  it("forma, «HQ'ga o'tkazish» tugmasi va POST yo'q — «HQ o'zi qabul qiladi» izohi; tarix haqiqiy filial (16) bo'yicha", () => {
    renderAt("/payments/cash-detail/16?type=branch", manager);

    expect(screen.getByText(/Filial pulini HQ o'zi qabul qiladi/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("0")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: TRANSFER_TO_HQ })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Naqd" })).not.toBeInTheDocument();
    expect(branchPayment.mutateAsync).not.toHaveBeenCalled();
    expect(
      state.historyCalls.some(
        (entry) => entry.enabled && entry.params.user_id === "16" && entry.params.cashbox_type === "branch",
      ),
    ).toBe(true);
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

    await submit(RECEIVE);
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

    await submit(RECEIVE);
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

/**
 * Dizayn v2 — menejer → HQ (maket `manager-payments-cash-detail-branch`): sarlavha HQ nomi, «HQ kassasi»,
 * «{filial} kassasidan HQ'ga pul o'tkazish»; kassa (GET manager/settlement) — «Kassa yetarli», ko'rsatma,
 * tasdiqda filial kassasi → HQ kassasi. Payload yuqoridagi testda (URL id = branch_id).
 */
describe("Dizayn v2 — menejer → HQ sahifasi", () => {
  beforeEach(() => {
    state.managerPayable = { data: { counterparty: "HQ", berilishi_kerak: 3_460_000 } };
    state.managerSettlement = {
      data: {
        counterparty: "HQ",
        kassa: { cash: 3_000_000, card: 785_000, total: 3_785_000 },
        berilishi_kerak: 3_460_000,
        olinishi_kerak: 2_940_000,
      },
    };
  });

  it("sarlavha, kassa yetarliligi va tarix; forma o'rnida «HQ o'zi qabul qiladi»; Excel yo'q", () => {
    renderAt(
      {
        pathname: "/payments/cash-detail/3",
        search: "?type=branch",
        state: { type: "branch", entity: { id: "3", name: "Toshkent HQ", role: "branch", type: "branch" } },
      },
      manager,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Toshkent HQ" })).toBeInTheDocument();
    expect(screen.getByText("HQ kassasi")).toBeInTheDocument();
    expect(screen.getByText("E2E REGIONAL Samarqand kassasidan HQ oladigan pul")).toBeInTheDocument();
    expect(screen.getByText("Qarshi tomon: Toshkent HQ")).toBeInTheDocument();
    expect(screen.getByText("Kassa yetarli")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Berilishi kerak summa kassadagi summaga nisbatan" })).toHaveAttribute(
      "aria-valuenow",
      "91.4",
    );
    expect(screen.getByText(/^Kassada qoladi · 325\D000 so'm$/)).toBeInTheDocument();
    expect(screen.getByText(/Filial pulini HQ o'zi qabul qiladi/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "HQ'ga o'tkazish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: TRANSFER_TO_HQ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Excel/ })).not.toBeInTheDocument();
    expect(screen.getByText("E2E REGIONAL Samarqand kassasidagi kirim va chiqimlar")).toBeInTheDocument();
  });

  it("berilishi kerak kassadan ko'p bo'lsa — «Kassa yetarli emas»", () => {
    state.managerPayable = { data: { counterparty: "HQ", berilishi_kerak: 4_000_000 } };
    renderAt("/payments/cash-detail/3?type=branch", manager);

    expect(screen.getByText("Kassa yetarli emas")).toBeInTheDocument();
    expect(screen.getByText(/^Kassada qoladi · 0 so'm$/)).toBeInTheDocument();
  });
});

/**
 * T2VHX1Y7 — menejer kuryer kassasida «Qabul qilinishi kerak» summasi so'rovdan (`GET /couriers`, `/payments`
 * oynasidagi bilan bir manba), router state'dan emas: prod — sahifada 36 000, haqiqiy 35 000, F5 dan keyin 37 000.
 */
describe("T2VHX1Y7 — manager courier cashbox amount comes from the query, not router state", () => {
  const openCourier = (stateAmount: number) =>
    renderAt(
      {
        pathname: "/payments/cash-detail/209",
        search: "?type=courier",
        state: { type: "courier", entity: { id: "209", name: "Filial kuryeri", role: "courier", amount: stateAmount } },
      },
      manager,
    );
  /** Summani to'liq ko'rsatgan eng ichki element (raqam va «so'm» alohida qismlarda bo'lishi mumkin). */
  const flat = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();
  const amountText = (value: number) => (_content: string, element: Element | null) => {
    const expected = flat(`${value.toLocaleString("uz-UZ")} so'm`);
    return (
      Boolean(element) &&
      flat(element?.textContent) === expected &&
      !Array.from(element?.children ?? []).some((child) => flat(child.textContent) === expected)
    );
  };

  it("shows the server receivable (35 000) instead of the stale router-state amount (36 000)", () => {
    state.cashbox = branchCourierCashbox;
    state.couriers = { data: { items: [{ id: "209", name: "Filial kuryeri", cashbox: { balance: 35_000 } }] } };
    openCourier(36_000);

    expect(screen.getAllByText(amountText(35_000)).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(amountText(36_000))).toHaveLength(0);
  });

  it("after a receipt shows the refreshed server amount (34 000), not a locally reduced router-state amount", async () => {
    courierPayment.mutateAsync.mockImplementation(async () => {
      // Real mutatsiya `onSuccess` da ["couriers"] ni qayta o'qiydi — shu yerda server javobi.
      state.couriers = { data: { items: [{ id: "209", cashbox: { balance: 34_000 } }] } };
      return paymentAccepted;
    });
    state.cashbox = branchCourierCashbox;
    state.couriers = { data: { items: [{ id: "209", name: "Filial kuryeri", cashbox: { balance: 35_000 } }] } };
    openCourier(36_000);

    setAmount("1000");
    await chooseMethod("Naqd");
    await submit(RECEIVE);
    expect(await screen.findByText(RECEIVE_SUCCESS)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText(amountText(34_000)).length).toBeGreaterThan(0));
    expect(screen.queryAllByText(amountText(35_000))).toHaveLength(0);
  });

  it("keeps the router-state amount while the courier is not in the server list", () => {
    state.cashbox = branchCourierCashbox;
    state.couriers = { data: { items: [] } };
    openCourier(36_000);

    expect(screen.getAllByText(amountText(36_000)).length).toBeGreaterThan(0);
  });
});
