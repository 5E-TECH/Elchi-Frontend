import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import CashDetail, { normalizeType } from "./cashDetail";

type CashboxCall = { id: unknown; enabled: unknown; params: Record<string, unknown> };

const cashboxState = vi.hoisted(() => ({
  response: undefined as unknown,
  calls: [] as CashboxCall[],
}));
/** Kassani qayta o'qish — sukut bo'yicha serverdagi (joriy) javobni qaytaradi. */
const cashboxRefetch = vi.hoisted(() => vi.fn(async () => ({ data: cashboxState.response })));
const marketsState = vi.hoisted(() => ({ data: undefined as unknown }));
const marketPayment = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const courierPayment = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const idle = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
const idleQuery = { data: undefined, isLoading: false, refetch: vi.fn() };

vi.mock("../../../entities/payments", () => ({
  useCashBox: () => ({
    useGetCashBoxById: (id: unknown, enabled: unknown, params: Record<string, unknown>) => {
      cashboxState.calls.push({ id, enabled, params });
      return {
        data: cashboxState.response,
        isLoading: false,
        refetch: cashboxRefetch,
      };
    },
    useGetFinanceHistory: () => idleQuery,
    useGetFinanceHistoryById: () => idleQuery,
    createPaymentCourier: courierPayment,
    createPaymentBranchToMain: idle,
    createPaymentMarket: marketPayment,
  }),
}));
vi.mock("../../../entities/payments/financeCoverage", () => ({
  useFinanceCoverage: () => ({ useGetManagerPayableToHq: () => idleQuery }),
}));
vi.mock("../../../entities/markets", () => ({
  useMarkets: () => ({ useGetMarkets: () => ({ data: marketsState.data, isLoading: false }) }),
}));
vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({ useGetUser: () => ({ data: undefined, isLoading: false }) }),
}));

const superadmin = { role: { id: "1", role: "superadmin", region: null, name: "Admin" } } as never;
const manager = { role: { id: "198", role: "manager", region: null, name: "Menejer" } } as never;

/** uz-UZ guruhlash belgisi U+00A0 — Testing Library matnni oddiy bo'shliqqa normallaydi. */
const money = (amount: number) => `${amount.toLocaleString("uz-UZ")} UZS`.replace(/\s+/g, " ");

/**
 * GET /finance/cashbox/user/:id?cashbox_type=couriers — superadmin/admin uchun
 * gateway (C3) `user`, `is_hq_courier`, `can_receive`, `receive_check_failed`,
 * `olinishi_kerak` qo'shadi. Tekshiruv xizmati ishlamasa: `receive_check_failed:
 * true`, `is_hq_courier`/`can_receive` = null, `olinishi_kerak = max(0, balance)`.
 */
const courierDetailResponse = (overrides: Record<string, unknown> = {}) => ({
  statusCode: 200,
  data: {
    cashbox: { id: "70", cashbox_type: "couriers", user_id: "263", balance: 250000 },
    history: [],
    user: {
      id: "263",
      name: "Ali Valiyev",
      phone_number: "+998901234567",
      role: "courier",
      status: "active",
    },
    is_hq_courier: true,
    can_receive: true,
    receive_check_failed: false,
    olinishi_kerak: 250000,
    counterparty: "HQ",
    ...overrides,
  },
});

/** finance-service: shu Idempotency-Key bilan pul avval o'tgan (takroriy so'rov). */
const idempotentReplayResponse = {
  data: {
    statusCode: 200,
    message: "To'lov allaqachon qabul qilingan (takroriy so'rov)",
    data: { idempotent: true },
  },
};
const paymentAccepted = { data: { statusCode: 200, message: "success", data: {} } };
/** Javob kelmay qolgan urinish (axios `timeoutErrorMessage`). */
const requestTimeout = () =>
  Object.assign(new Error("So'rov vaqti tugadi"), { code: "ECONNABORTED" });

const ALREADY_RECORDED = "Bu to'lov allaqachon yozilgan — kassa yangilandi, summani tekshiring";
const RECEIVE_SUCCESS = "Kuryerdan to'lov muvaffaqiyatli qabul qilindi";
const CHECK_FAILED = "Tekshiruv xizmati javob bermadi — to'lov yuborilsa server qayta tekshiradi";
const HQ_COURIER_HAS_BRANCH_SALES =
  "Kuryerda filialga tegishli topshirilmagan savdo bor — ularni filial menejeri qabul qiladi";
const BRANCH_COURIER = "Bu kuryer filialga tegishli — pulni filial menejeri qabul qiladi";

/** State'siz ochish = F5, ulashilgan havola yoki yangi tab. */
const openWithoutState = (route: string, preloadedState = superadmin) =>
  renderWithProviders(
    <Routes>
      <Route path="/payments/cash-detail/:id" element={<CashDetail />} />
    </Routes>,
    { route, preloadedState },
  );

const lastCashboxParams = () => cashboxState.calls.at(-1)?.params;

const setAmount = (amount: string) =>
  fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: amount } });

const submitCourierPayment = () =>
  userEvent.setup().click(screen.getByRole("button", { name: "Qabul qilish" }));

const chooseMethod = (method: string) =>
  userEvent.setup().click(screen.getByRole("radio", { name: method }));

const chooseMarket = async (market: string) => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Market tanlang" }));
  await user.click(screen.getByRole("option", { name: market }));
};

const fillCourierPayment = async (amount: string, method = "Naqd") => {
  setAmount(amount);
  await chooseMethod(method);
  await submitCourierPayment();
};

const courierPaymentCalls = () =>
  courierPayment.mutateAsync.mock.calls.map(
    ([arg]) => arg as { data: Record<string, unknown>; idempotencyKey: string },
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
    cashboxState.calls = [];
    marketPayment.mutateAsync.mockReset();
    courierPayment.mutateAsync.mockReset();
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

describe("CashDetail — courier cashbox (HQ courier → Asosiy kassa)", () => {
  const scrollIntoView = Element.prototype.scrollIntoView;

  beforeAll(() => {
    // FilterSelect ochilganda variantni ko'rinishga aylantiradi — jsdom'da yo'q.
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterAll(() => {
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  afterEach(() => {
    cashboxState.response = undefined;
    cashboxState.calls = [];
    marketsState.data = undefined;
    courierPayment.mutateAsync.mockReset();
  });

  it("requests the courier cashbox (cashbox_type=couriers) for a superadmin opening ?type=courier without state", () => {
    cashboxState.response = courierDetailResponse();
    openWithoutState("/payments/cash-detail/263?type=courier");

    expect(cashboxState.calls.at(-1)?.id).toBe("263");
    expect(lastCashboxParams()).toEqual(
      expect.objectContaining({ cashbox_type: "couriers", with_history: true }),
    );
  });

  it("shows the courier name from data.user and 'Qabul qilinishi kerak' (not 'Foydalanuvchi' / 'Umumiy balans 0')", () => {
    cashboxState.response = courierDetailResponse();
    openWithoutState("/payments/cash-detail/263?type=courier");

    expect(screen.getAllByText("Ali Valiyev").length).toBeGreaterThan(0);
    expect(screen.queryByText("Foydalanuvchi")).not.toBeInTheDocument();
    expect(screen.getAllByText("Qabul qilinishi kerak").length).toBeGreaterThan(0);
    expect(screen.queryByText("Umumiy balans")).not.toBeInTheDocument();
    expect(screen.getAllByText(money(250000)).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Qabul qilish" })).toBeInTheDocument();
    // Hammasi joyida — hech qanday ogohlantirish yo'q.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("falls back to the phone number when the courier has no name", () => {
    cashboxState.response = courierDetailResponse({
      user: { id: "263", name: "", phone_number: "+998901234567", role: "courier" },
    });
    openWithoutState("/payments/cash-detail/263?type=courier");

    expect(screen.getAllByText("+998901234567").length).toBeGreaterThan(0);
    expect(screen.queryByText("Foydalanuvchi")).not.toBeInTheDocument();
  });

  describe("receive state alerts (C3)", () => {
    it("branch courier (is_hq_courier=false, can_receive=false): branch alert, no form", () => {
      cashboxState.response = courierDetailResponse({
        is_hq_courier: false,
        can_receive: false,
        olinishi_kerak: 0,
      });
      openWithoutState("/payments/cash-detail/209?type=courier");

      expect(screen.getByRole("alert")).toHaveTextContent(BRANCH_COURIER);
      expect(screen.queryByText(HQ_COURIER_HAS_BRANCH_SALES)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Qabul qilish" })).not.toBeInTheDocument();
      expect(screen.queryByRole("radio", { name: "Naqd" })).not.toBeInTheDocument();
    });

    it("HQ courier with branch-linked unsettled sales (is_hq_courier=true, can_receive=false): its own alert, no form", () => {
      cashboxState.response = courierDetailResponse({
        is_hq_courier: true,
        can_receive: false,
        olinishi_kerak: 0,
      });
      openWithoutState("/payments/cash-detail/263?type=courier");

      expect(screen.getByRole("alert")).toHaveTextContent(HQ_COURIER_HAS_BRANCH_SALES);
      // "Filial kuryeri" deb noto'g'ri aytilmaydi — u HQ kuryeri.
      expect(screen.queryByText(BRANCH_COURIER)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Qabul qilish" })).not.toBeInTheDocument();
      expect(screen.queryByRole("radio", { name: "Naqd" })).not.toBeInTheDocument();
    });

    it("check service outage (receive_check_failed=true, flags null): keeps the form with a warning and still sends", async () => {
      courierPayment.mutateAsync.mockResolvedValue(paymentAccepted);
      cashboxState.response = courierDetailResponse({
        receive_check_failed: true,
        is_hq_courier: null,
        can_receive: null,
        olinishi_kerak: 250000,
      });
      openWithoutState("/payments/cash-detail/263?type=courier");

      expect(screen.getByRole("alert")).toHaveTextContent(CHECK_FAILED);
      expect(screen.queryByText(BRANCH_COURIER)).not.toBeInTheDocument();
      expect(screen.queryByText(HQ_COURIER_HAS_BRANCH_SALES)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Qabul qilish" })).toBeEnabled();

      // Server (C4) qayta tekshiradi — forma so'rovni yuboradi.
      await fillCourierPayment("100000");
      await waitFor(() => expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(1));
      expect(courierPaymentCalls()[0].data).toEqual(
        expect.objectContaining({ courier_id: "263", amount: 100000 }),
      );
    });
  });

  describe("over-balance guard", () => {
    it("SA/ADMIN with a server limit (olinishi_kerak): blocks a larger amount without sending a request", async () => {
      cashboxState.response = courierDetailResponse();
      openWithoutState("/payments/cash-detail/263?type=courier");

      await fillCourierPayment("300000");

      expect(
        await screen.findByText(
          `Summa ko'rsatilgan balansdan (${money(250000).replace(" UZS", "")} so'm) oshmasligi kerak`,
        ),
      ).toBeInTheDocument();
      expect(courierPayment.mutateAsync).not.toHaveBeenCalled();
    });

    it("SA/ADMIN without a server limit (no olinishi_kerak): no client-side cap — the backend caps", async () => {
      courierPayment.mutateAsync.mockResolvedValue(paymentAccepted);
      cashboxState.response = courierDetailResponse({ olinishi_kerak: undefined });
      openWithoutState("/payments/cash-detail/263?type=courier");

      await fillCourierPayment("300000");

      await waitFor(() => expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(1));
      expect(courierPaymentCalls()[0].data).toEqual(expect.objectContaining({ amount: 300000 }));
      expect(screen.queryByText(/oshmasligi kerak/)).not.toBeInTheDocument();
    });

    it("manager: no client-side cap above the displayed amount (previous behaviour, backend caps)", async () => {
      courierPayment.mutateAsync.mockResolvedValue(paymentAccepted);
      cashboxState.response = {
        statusCode: 200,
        data: {
          cashbox: { id: "60", cashbox_type: "couriers", user_id: "209", balance: 70000 },
          history: [],
          user: { id: "209", name: "Filial kuryeri", role: "courier" },
        },
      };
      openWithoutState("/payments/cash-detail/209?type=courier", manager);

      await fillCourierPayment("90000");

      await waitFor(() => expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(1));
      expect(courierPaymentCalls()[0].data).toEqual(
        expect.objectContaining({ courier_id: "209", amount: 90000 }),
      );
      expect(screen.queryByText(/oshmasligi kerak/)).not.toBeInTheDocument();
    });
  });

  describe("Idempotency-Key bound to the payment fingerprint", () => {
    // Javobsiz to'lov kalitlari sessionStorage'da — testlar bir-biriga ta'sir qilmasin.
    beforeEach(() => sessionStorage.clear());

    it("keeps the key for an identical retry after a failure and renews it after success", async () => {
      courierPayment.mutateAsync
        .mockRejectedValueOnce(requestTimeout())
        .mockResolvedValue(paymentAccepted);
      cashboxState.response = courierDetailResponse();
      openWithoutState("/payments/cash-detail/263?type=courier");

      // 1) javob kelmadi (xato) → 2) aynan o'sha to'lovni qayta yuborish → muvaffaqiyat.
      await fillCourierPayment("100000");
      expect(await screen.findByText("So'rov vaqti tugadi")).toBeInTheDocument();
      await submitCourierPayment();
      await waitFor(() => expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(2));
      expect(await screen.findByText(RECEIVE_SUCCESS)).toBeInTheDocument();
      // Muvaffaqiyatdan keyin forma tozalanadi — kalit ham shu paytda yangilangan.
      await waitFor(() => expect(screen.getByPlaceholderText("0")).toHaveValue(""));
      // 3) keyingi (yangi) to'lov — summa avvalgisi bilan bir xil bo'lsa ham.
      await fillCourierPayment("100000");
      await waitFor(() => expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(3));

      const [first, retry, next] = courierPaymentCalls();
      expect(first).toEqual({
        data: expect.objectContaining({ courier_id: "263", amount: 100000, payment_method: "cash" }),
        idempotencyKey: expect.any(String),
      });
      expect(first.idempotencyKey).not.toBe("");
      expect(retry.idempotencyKey).toBe(first.idempotencyKey);
      expect(next.data).toEqual(expect.objectContaining({ courier_id: "263", amount: 100000 }));
      expect(next.idempotencyKey).not.toBe(first.idempotencyKey);
    });

    it("rotates the key when the amount or the payment method changes after a failure", async () => {
      courierPayment.mutateAsync.mockRejectedValue(requestTimeout());
      cashboxState.response = courierDetailResponse();
      openWithoutState("/payments/cash-detail/263?type=courier");

      await fillCourierPayment("100000"); // 1) 100 000 naqd
      await waitFor(() => expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(1));
      setAmount("120000"); // 2) summa o'zgardi — boshqa to'lov
      await submitCourierPayment();
      await waitFor(() => expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(2));
      await submitCourierPayment(); // 3) 2-to'lovning aynan o'zi — qayta urinish
      await waitFor(() => expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(3));
      await chooseMethod("O'tkazma"); // 4) usul o'zgardi — boshqa to'lov
      await submitCourierPayment();
      await waitFor(() => expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(4));

      const [first, changedAmount, retry, changedMethod] = courierPaymentCalls();
      expect(changedAmount.data).toEqual(expect.objectContaining({ amount: 120000, payment_method: "cash" }));
      expect(changedAmount.idempotencyKey).not.toBe(first.idempotencyKey);
      expect(retry.idempotencyKey).toBe(changedAmount.idempotencyKey);
      expect(changedMethod.data).toEqual(expect.objectContaining({ amount: 120000, payment_method: "click" }));
      expect(changedMethod.idempotencyKey).not.toBe(retry.idempotencyKey);
      expect(changedMethod.idempotencyKey).not.toBe(first.idempotencyKey);
    });

    it("rotates the key when the market changes (click_to_market)", async () => {
      courierPayment.mutateAsync.mockRejectedValue(requestTimeout());
      marketsState.data = {
        data: {
          items: [
            { id: "3", name: "Yandex" },
            { id: "4", name: "Kimdur" },
          ],
        },
      };
      cashboxState.response = courierDetailResponse();
      openWithoutState("/payments/cash-detail/263?type=courier");

      setAmount("100000");
      await chooseMethod("Do'konga o'tkazma");
      await chooseMarket("Yandex");
      await submitCourierPayment();
      await waitFor(() => expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(1));
      await chooseMarket("Kimdur");
      await submitCourierPayment();
      await waitFor(() => expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(2));
      await submitCourierPayment();
      await waitFor(() => expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(3));

      const [yandex, kimdur, kimdurRetry] = courierPaymentCalls();
      expect(yandex.data).toEqual(
        expect.objectContaining({ payment_method: "click_to_market", market_id: "3" }),
      );
      expect(kimdur.data).toEqual(expect.objectContaining({ market_id: "4" }));
      expect(kimdur.idempotencyKey).not.toBe(yandex.idempotencyKey);
      expect(kimdurRetry.idempotencyKey).toBe(kimdur.idempotencyKey);
    });

    it("duplicate (idempotent) response: warning instead of success, cashbox refetched, amount not subtracted", async () => {
      courierPayment.mutateAsync.mockResolvedValueOnce(idempotentReplayResponse);
      cashboxState.response = courierDetailResponse();
      openWithoutState("/payments/cash-detail/263?type=courier");

      await fillCourierPayment("100000");

      expect(await screen.findByText(ALREADY_RECORDED)).toBeInTheDocument();
      expect(screen.queryByText(RECEIVE_SUCCESS)).not.toBeInTheDocument();
      await waitFor(() => expect(cashboxRefetch).toHaveBeenCalled());
      // Mahalliy 250 000 − 100 000 = 150 000 hisoblanmaydi — summa serverdan.
      expect(screen.getAllByText(money(250000)).length).toBeGreaterThan(0);
      expect(screen.queryByText(money(150000))).not.toBeInTheDocument();
      // Forma tozalangan — bir bosishda ikkinchi to'lov ketib qolmaydi.
      expect(screen.getByPlaceholderText("0")).toHaveValue("");

      // Keyingi to'lov (garchi bir xil bo'lsa ham) — yangi mantiqiy to'lov, yangi kalit.
      courierPayment.mutateAsync.mockResolvedValue(paymentAccepted);
      await fillCourierPayment("100000");
      await waitFor(() => expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(2));

      const [duplicate, next] = courierPaymentCalls();
      expect(next.idempotencyKey).not.toBe(duplicate.idempotencyKey);
      expect(await screen.findByText(RECEIVE_SUCCESS)).toBeInTheDocument();
    });

    it("⭐ A javobsiz → B xato → A qayta: A o'z kalitini qayta ishlatadi (pul ikki marta o'tmaydi)", async () => {
      courierPayment.mutateAsync.mockRejectedValue(requestTimeout());
      cashboxState.response = courierDetailResponse();
      openWithoutState("/payments/cash-detail/263?type=courier");

      await fillCourierPayment("100000"); // A
      await waitFor(() => expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(1));
      setAmount("50000"); // B — boshqa to'lov
      await submitCourierPayment();
      await waitFor(() => expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(2));
      setAmount("100000"); // A yana
      await submitCourierPayment();
      await waitFor(() => expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(3));

      const [a, b, aAgain] = courierPaymentCalls();
      expect(b.idempotencyKey).not.toBe(a.idempotencyKey);
      expect(aAgain.idempotencyKey).toBe(a.idempotencyKey);
    });

    it("sahifa qayta ochilganda (F5 / orqaga) javobsiz to'lovning kaliti saqlanadi", async () => {
      courierPayment.mutateAsync.mockRejectedValue(requestTimeout());
      cashboxState.response = courierDetailResponse();
      const first = openWithoutState("/payments/cash-detail/263?type=courier");

      await fillCourierPayment("100000");
      await waitFor(() => expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(1));
      first.unmount();

      openWithoutState("/payments/cash-detail/263?type=courier");
      await fillCourierPayment("100000");
      await waitFor(() => expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(2));

      const [beforeRemount, afterRemount] = courierPaymentCalls();
      expect(afterRemount.idempotencyKey).toBe(beforeRemount.idempotencyKey);
    });

    it("menejer (router state summasi): takroriy javobdan keyin ekrandagi summa ham kamayadi", async () => {
      courierPayment.mutateAsync.mockResolvedValueOnce(idempotentReplayResponse);
      cashboxState.response = {
        statusCode: 200,
        data: {
          cashbox: { id: "60", cashbox_type: "couriers", user_id: "209", balance: 250000 },
          history: [],
          user: { id: "209", name: "Filial kuryeri", role: "courier" },
        },
      };
      renderWithProviders(
        <Routes>
          <Route path="/payments/cash-detail/:id" element={<CashDetail />} />
        </Routes>,
        {
          route: {
            pathname: "/payments/cash-detail/209",
            search: "?type=courier",
            state: { type: "courier", entity: { id: "209", name: "Filial kuryeri", amount: 250000 } },
          },
          preloadedState: manager,
        },
      );
      expect(screen.getAllByText(money(250000)).length).toBeGreaterThan(0);

      await fillCourierPayment("100000");

      expect(await screen.findByText(ALREADY_RECORDED)).toBeInTheDocument();
      await waitFor(() => expect(screen.getAllByText(money(150000)).length).toBeGreaterThan(0));
    });
  });

  it("manager: still requests cashbox_type=couriers and gets the receive form (no can_receive for managers)", () => {
    cashboxState.response = {
      statusCode: 200,
      data: {
        cashbox: { id: "60", cashbox_type: "couriers", user_id: "209", balance: 70000 },
        history: [],
        user: { id: "209", name: "Filial kuryeri", role: "courier" },
      },
    };
    openWithoutState("/payments/cash-detail/209?type=courier", manager);

    expect(lastCashboxParams()).toEqual(expect.objectContaining({ cashbox_type: "couriers" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getAllByText("Filial kuryeri").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Qabul qilish" })).toBeInTheDocument();
  });
});
