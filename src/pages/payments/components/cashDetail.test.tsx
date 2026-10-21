import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import CashDetail, { normalizeType } from "./cashDetail";

type CashboxCall = { id: unknown; enabled: unknown; params: Record<string, unknown> };

const cashboxState = vi.hoisted(() => ({
  response: undefined as unknown,
  calls: [] as CashboxCall[],
  /** Shu paramlar bilan so'rov yiqiladi (masalan tab/sana almashgach). */
  failWhen: undefined as ((params: Record<string, unknown>) => boolean) | undefined,
}));
/** Kassani qayta o'qish — sukut bo'yicha serverdagi (joriy) javobni qaytaradi. */
const cashboxRefetch = vi.hoisted(() => vi.fn(async () => ({ data: cashboxState.response })));
const marketsState = vi.hoisted(() => ({ data: undefined as unknown }));
/** GET /finance/history (filial sahifasi) — sukut bo'yicha bo'sh. */
const historyState = vi.hoisted(() => ({ data: undefined as unknown }));
const marketPayment = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const courierPayment = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const idle = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
/**
 * CB-2: `GET finance/shift/current` (joriy foydalanuvchi kassasi). Sukut — ochiq smena (qulf yo'q);
 * `null` — smena yo'q (qulf), `"error"` — holat noma'lum (403 / tarmoq).
 */
const shiftState = vi.hoisted(() => ({
  shift: { id: "5", status: "open", opened_by: "1" } as Record<string, unknown> | null | "error",
  refetch: vi.fn(),
  balanceRequests: [] as boolean[],
}));
const openShiftMutation = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const idleQuery = { data: undefined, isLoading: false, refetch: vi.fn() };

vi.mock("../../../entities/payments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/payments")>()),
  useCashBox: () => ({
    useGetCurrentShift: () =>
      shiftState.shift === "error"
        ? { isSuccess: false, isError: true, data: undefined, refetch: shiftState.refetch }
        : {
            isSuccess: true,
            isError: false,
            data: { data: { shift: shiftState.shift, required: true } },
            refetch: shiftState.refetch,
          },
    openShift: openShiftMutation,
    // «Ochilish qoldig'i» — faqat oyna ochiq bo'lganda so'raladi.
    useGetCashBoxMain: (_params: unknown, enabled: boolean) => {
      shiftState.balanceRequests.push(enabled);
      return enabled
        ? { isSuccess: true, data: { data: { cashbox: { balance_cash: 1200000, balance_card: 300000 } } } }
        : { isSuccess: false, data: undefined };
    },
    useGetCashBoxById: (id: unknown, enabled: unknown, params: Record<string, unknown>) => {
      cashboxState.calls.push({ id, enabled, params });
      if (cashboxState.failWhen?.(params)) {
        return { data: undefined, isLoading: false, isError: true, error: new Error("boom"), refetch: cashboxRefetch };
      }
      return {
        data: cashboxState.response,
        isLoading: false,
        refetch: cashboxRefetch,
      };
    },
    useGetFinanceHistory: () => ({ ...idleQuery, data: historyState.data }),
    useGetFinanceHistoryById: () => idleQuery,
    createPaymentCourier: courierPayment,
    createPaymentBranchToMain: idle,
    createPaymentMarket: marketPayment,
  }),
}));
vi.mock("../../../entities/payments/financeCoverage", () => ({
  useFinanceCoverage: () => ({
    useGetManagerPayableToHq: () => idleQuery,
    useGetManagerSettlement: () => idleQuery,
  }),
}));
// GET /branches (menejersiz filiallar / HQ filial sahifasidagi server summasi).
vi.mock("../../../entities/branch/api/useBranches", () => ({
  useBranches: () => ({ data: undefined, isLoading: false, refetch: vi.fn(async () => ({ data: undefined })) }),
}));

vi.mock("../../../entities/markets", () => ({
  useMarkets: () => ({ useGetMarkets: () => ({ data: marketsState.data, isLoading: false }) }),
}));
vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetUser: () => ({ data: undefined, isLoading: false }),
    useGetUserById: () => ({ data: undefined }),
    // Menejer kuryer kassasi summasi (T2VHX1Y7) — `GET /couriers`.
    useGetCouriers: () => ({ data: undefined, isLoading: false }),
  }),
}));

const superadmin = { role: { id: "1", role: "superadmin", region: null, name: "Admin" } } as never;
const manager = { role: { id: "198", role: "manager", region: null, name: "Menejer" } } as never;

/** uz-UZ guruhlash belgisi U+00A0 — Testing Library matnni oddiy bo'shliqqa normallaydi. */
// Dizayn v2: uz valyutasi "so'm" (payments.currency — ilgari "UZS" edi).
const money = (amount: number) => `${amount.toLocaleString("uz-UZ")} so'm`.replace(/\s+/g, " ");
const normalizeText = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();
/**
 * Summa bitta element matni sifatida (dizayn v2 katta summasida raqam va «so'm» alohida qismlarda) —
 * shu summani to'liq ko'rsatgan eng ichki element.
 */
const moneyText = (amount: number) => (_content: string, element: Element | null) =>
  Boolean(element) &&
  normalizeText(element?.textContent) === money(amount) &&
  !Array.from(element?.children ?? []).some((child) => normalizeText(child.textContent) === money(amount));

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

/** Dizayn v2: tugma matnida summa bor («100 000 so'm qabul qilish»), summa yo'q bo'lsa «Qabul qilish». */
const RECEIVE_BUTTON = /qabul qilish$/i;
const CONFIRM_TITLE = "To'lovni tasdiqlang";
const findConfirm = () => screen.findByRole("alertdialog", { name: CONFIRM_TITLE });

/**
 * Yuborish: forma tugmasi → (5hBeDuyn) tasdiq oynasi ochilsa, undagi «Tasdiqlash».
 * Oyna ochilmasa (forma xatosi / bloklangan) — hech narsa bosilmaydi.
 */
const submitCourierPayment = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: RECEIVE_BUTTON }));
  const dialog = await findConfirm().catch(() => null);
  if (dialog) {
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  }
};

const chooseMethod = (method: string) =>
  userEvent.setup().click(screen.getByRole("radio", { name: method }));

const chooseMarket = async (market: string) => {
  const user = userEvent.setup();
  // v2 `Select`: maydon — «Market *» yorlig'i bilan nomlangan combobox.
  await user.click(screen.getByRole("combobox", { name: "Market" }));
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

    expect(screen.queryByRole("heading", { name: "Marketga to'lov" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "To'lash" })).not.toBeInTheDocument();
    expect(screen.queryByText("Market kassasi")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Filialdan qabul qilish" })).toBeInTheDocument();
    expect(screen.getByText("Pul filial kassasidan asosiy kassaga tushadi")).toBeInTheDocument();
  });

  it("keeps the type from the URL (?type=branch) even before the cashbox loads", () => {
    openWithoutState("/payments/cash-detail/13?type=branch");

    expect(screen.queryByRole("heading", { name: "Marketga to'lov" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "To'lash" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Filialdan qabul qilish" })).toBeInTheDocument();
  });

  it("shows no payment form at all when the type cannot be determined", () => {
    cashboxState.response = { data: { cashbox: { id: "99", user_id: "13" } } };
    openWithoutState("/payments/cash-detail/13");

    expect(screen.getByRole("alert")).toHaveTextContent("Kassa turi aniqlanmadi");
    expect(screen.queryByRole("heading", { name: "Marketga to'lov" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "To'lash" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: RECEIVE_BUTTON })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Naqd" })).not.toBeInTheDocument();
  });

  it("still opens a real market cashbox as a market payment", () => {
    cashboxState.response = { data: { cashbox: { id: "40", cashbox_type: "markets", user_id: "3", balance: 0 } } };
    openWithoutState("/payments/cash-detail/3");

    expect(screen.getByRole("heading", { name: "Marketga to'lov" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "To'lash" })).toBeInTheDocument();
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
    expect(screen.getAllByText(moneyText(250000)).length).toBeGreaterThan(0);
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
      expect(screen.queryByRole("button", { name: RECEIVE_BUTTON })).not.toBeInTheDocument();
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
      expect(screen.queryByRole("button", { name: RECEIVE_BUTTON })).not.toBeInTheDocument();
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
          `Summa ko'rsatilgan balansdan (${money(250000).replace(" so'm", "")} so'm) oshmasligi kerak`,
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
      await chooseMethod("Marketga o'tkazma");
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
      expect(screen.getAllByText(moneyText(250000)).length).toBeGreaterThan(0);
      expect(screen.queryAllByText(moneyText(150000))).toHaveLength(0);
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
      expect(screen.getAllByText(moneyText(250000)).length).toBeGreaterThan(0);

      await fillCourierPayment("100000");

      expect(await screen.findByText(ALREADY_RECORDED)).toBeInTheDocument();
      await waitFor(() => expect(screen.getAllByText(moneyText(150000)).length).toBeGreaterThan(0));
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

/**
 * 5hBeDuyn — pul yuborishdan OLDIN tasdiq oynasi; javobsiz (504) holatda
 * kuryer oyog'i ham "natija noma'lum" deb ogohlantiradi (market/filial kabi).
 */
describe("CashDetail — kuryerdan qabul: tasdiq va noma'lum natija (5hBeDuyn)", () => {
  const OUTCOME_UNKNOWN =
    "Server javob bermadi — to'lov o'tgan bo'lishi mumkin. Kassa yangilandi, summani tekshiring: aynan shu to'lovni qayta yuborsangiz, u ikki marta yozilmaydi";

  beforeEach(() => {
    courierPayment.mutateAsync.mockReset();
    cashboxRefetch.mockClear();
  });

  it("⭐ tasdiq oynasi summa, amal, kuryer va to'lov turini ko'rsatadi; \"Bekor qilish\" — so'rov KETMAYDI", async () => {
    cashboxState.response = courierDetailResponse();
    openWithoutState("/payments/cash-detail/263?type=courier");
    const user = userEvent.setup();

    setAmount("150000");
    await chooseMethod("Naqd");
    await user.click(screen.getByRole("button", { name: RECEIVE_BUTTON }));

    // Oyna: summa, to'lov turi badge'i va qayerdan → qayerga (kuryer kassasi → asosiy kassa).
    const dialog = await findConfirm();
    expect(dialog).toHaveTextContent(/150\D?000\s*so'm/);
    expect(within(dialog).getByText("Naqd")).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/Qayerdan\s*Kuryer kassasi\s*Ali Valiyev/);
    expect(dialog).toHaveTextContent(/Qayerga\s*Asosiy kassa/);
    expect(within(dialog).getByRole("button", { name: "Tasdiqlash" })).toBeInTheDocument();
    expect(courierPayment.mutateAsync).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(courierPayment.mutateAsync).not.toHaveBeenCalled();
    // Forma joyida qoladi — operator summani tuzatishi mumkin.
    expect(screen.getByPlaceholderText("0")).not.toHaveValue("");
  });

  it("⭐ tasdiqlangandagina POST ketadi", async () => {
    courierPayment.mutateAsync.mockResolvedValue(paymentAccepted);
    cashboxState.response = courierDetailResponse();
    openWithoutState("/payments/cash-detail/263?type=courier");

    await fillCourierPayment("150000");

    await waitFor(() => expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(RECEIVE_SUCCESS)).toBeInTheDocument();
  });

  it("⭐ 504 / javob kelmadi — xato + \"natija noma'lum, qayta yubormang\" ogohlantirishi, kassa qayta o'qiladi", async () => {
    courierPayment.mutateAsync.mockRejectedValue(requestTimeout());
    cashboxState.response = courierDetailResponse();
    openWithoutState("/payments/cash-detail/263?type=courier");

    await fillCourierPayment("150000");

    expect(await screen.findByText(OUTCOME_UNKNOWN)).toBeInTheDocument();
    await waitFor(() => expect(cashboxRefetch).toHaveBeenCalled());
  });
});

/**
 * Dizayn v2 (maket `*-payments-cash-detail-*`): sarlavha, «Hisob-kitob holati», tasdiq oynasi mazmuni,
 * ikki marta yuborishdan himoya, «Marketga o'tkazma», operatsiyalar ro'yxati va «Balans harakati».
 */
describe("CashDetail — dizayn v2", () => {
  const scrollIntoView = Element.prototype.scrollIntoView;
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterAll(() => {
    Element.prototype.scrollIntoView = scrollIntoView;
  });
  beforeEach(() => {
    sessionStorage.clear();
    courierPayment.mutateAsync.mockReset();
    courierPayment.isPending = false;
  });
  afterEach(() => {
    cashboxState.response = undefined;
    cashboxState.calls = [];
    cashboxState.failWhen = undefined;
    marketsState.data = undefined;
    historyState.data = undefined;
    courierPayment.isPending = false;
  });

  const twoRowHistory = [
    {
      id: "2",
      cashbox_id: "70",
      source_type: "courier_payment",
      operation_type: "expense",
      amount: 100000,
      balance_after: 150000,
      payment_method: "cash",
      createdAt: "2026-10-16T10:00:00.000Z",
    },
    {
      id: "1",
      cashbox_id: "70",
      source_type: "sell",
      source_id: "10236",
      operation_type: "income",
      amount: 250000,
      balance_after: 250000,
      payment_method: "cash",
      createdAt: "2026-10-14T10:00:00.000Z",
    },
  ];

  it("«To'lov o'tkazmalari»: qatorlar ketma-ket emas — «Davr boshida»/«Hozir» va grafik yo'q, Kirim/Chiqim qoladi", async () => {
    cashboxState.response = courierDetailResponse({ history: twoRowHistory });
    openWithoutState("/payments/cash-detail/263?type=courier");
    const user = userEvent.setup();

    const movement = screen.getByRole("region", { name: "Balans harakati" });
    expect(movement).toHaveTextContent(/Davr boshida/);
    expect(within(movement).getByRole("radio", { name: "Grafik" })).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "To'lov o'tkazmalari" }));
    const filtered = screen.getByRole("region", { name: "Balans harakati" });
    expect(filtered).not.toHaveTextContent(/Davr boshida|Hozir/);
    expect(within(filtered).queryByRole("radio", { name: "Grafik" })).not.toBeInTheDocument();
    expect(filtered).toHaveTextContent(/Kirim\s*\+250\D000 so'm/);
    expect(filtered).toHaveTextContent(/Chiqim\s*−100\D000 so'm/);
  });

  it("tab almashgach kassa so'rovi yiqilsa — eski tarix ko'rsatilmaydi, ro'yxat o'rnida xato + «Qayta urinish»", async () => {
    cashboxState.response = courierDetailResponse({ history: twoRowHistory });
    cashboxState.failWhen = (params) => Boolean(params.sourceTypes);
    openWithoutState("/payments/cash-detail/263?type=courier");
    const user = userEvent.setup();
    expect(screen.getByRole("button", { name: /^Sotuv · №10236/ })).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "To'lov o'tkazmalari" }));
    expect(screen.queryByRole("button", { name: /^Sotuv · №10236/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Balans harakati" })).not.toBeInTheDocument();
    // Sahifa (kassa, forma) saqlangan javob bilan qoladi.
    expect(screen.getByRole("heading", { name: "Kuryerdan qabul qilish" })).toBeInTheDocument();
    cashboxRefetch.mockClear();
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(cashboxRefetch).toHaveBeenCalled();
  });

  it("sarlavha: ism, «Kuryer kassasi» badge'i, «HQ kuryeri · telefon»; karta «Qarshi tomon: Asosiy kassa»", () => {
    cashboxState.response = courierDetailResponse({
      cashbox: { id: "70", cashbox_type: "couriers", user_id: "263", balance: 250000, balance_cash: 100000, balance_card: 150000 },
    });
    openWithoutState("/payments/cash-detail/263?type=courier");

    expect(screen.getByRole("heading", { level: 1, name: "Ali Valiyev" })).toBeInTheDocument();
    expect(screen.getByText("Kuryer kassasi")).toBeInTheDocument();
    expect(screen.getByText("HQ kuryeri · +998 90 123 45 67")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hisob-kitob holati" })).toBeInTheDocument();
    expect(screen.getByText("Qarshi tomon: Asosiy kassa")).toBeInTheDocument();
    // Kassadagi summa: naqd / o'tkazma bo'linmasi.
    expect(screen.getByRole("img", { name: /naqd 100\D000 so'm \(40%\), o'tkazma 150\D000 so'm \(60%\)/ })).toBeInTheDocument();
    // Qarama-qarshi qator: «Berilishi kerak 0 so'm».
    expect(screen.getByText("Berilishi kerak")).toBeInTheDocument();
    // Summa ko'rsatmasi — server chegarasi bilan.
    expect(screen.getByText(/^Ko'pi bilan 250\D000 so'm — qabul qilinishi kerak bo'lgan summa$/)).toBeInTheDocument();
    // Excel — superadmin/admin.
    expect(screen.getByRole("button", { name: "Excelga yuklash" })).toBeInTheDocument();
  });

  it("«Summalarni yashirish»: summalar «••••••» bo'ladi, qayta bosilsa qaytadi", async () => {
    cashboxState.response = courierDetailResponse();
    openWithoutState("/payments/cash-detail/263?type=courier");
    const user = userEvent.setup();
    const toggle = screen.getByRole("button", { name: "Summalarni yashirish" });

    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryAllByText(moneyText(250000))).toHaveLength(0);
    expect(screen.getAllByText(/••••••/).length).toBeGreaterThan(0);

    await user.click(toggle);
    expect(screen.getAllByText(moneyText(250000)).length).toBeGreaterThan(0);
  });

  it("tugma matnida kiritilgan summa: «Qabul qilish» → «150 000 so'm qabul qilish»", () => {
    cashboxState.response = courierDetailResponse();
    openWithoutState("/payments/cash-detail/263?type=courier");

    expect(screen.getByRole("button", { name: "Qabul qilish" })).toBeInTheDocument();
    setAmount("150000");
    expect(screen.getByRole("button", { name: /^150\D000 so'm qabul qilish$/ })).toBeInTheDocument();
  });

  it("⭐ tasdiq oynasi ochiq paytida forma qayta yuborilsa ikkinchi oyna ochilmaydi; tasdiqdan keyin bitta POST", async () => {
    courierPayment.mutateAsync.mockResolvedValue(paymentAccepted);
    cashboxState.response = courierDetailResponse();
    openWithoutState("/payments/cash-detail/263?type=courier");
    const user = userEvent.setup();

    setAmount("100000");
    await chooseMethod("Naqd");
    const submitButton = screen.getByRole("button", { name: RECEIVE_BUTTON });
    await user.click(submitButton);
    const dialog = await findConfirm();
    // Ikkinchi yuborish (Enter / ikki marta bosish) — qulf: yangi oyna yo'q.
    fireEvent.submit(submitButton.closest("form") as HTMLFormElement);
    await waitFor(() => expect(screen.getAllByRole("alertdialog")).toHaveLength(1));

    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));
    await waitFor(() => expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(1));
    // Navbatda ikkinchi tasdiq qolmagan: oyna qayta ochilmaydi, ikkinchi POST yo'q.
    await expect(findConfirm()).rejects.toThrow();
    expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("⭐ to'lov ketayotganda (isPending) tugma «Yuklanmoqda…» va bosilmaydi — tasdiq ochilmaydi", async () => {
    courierPayment.isPending = true;
    cashboxState.response = courierDetailResponse();
    openWithoutState("/payments/cash-detail/263?type=courier");
    const user = userEvent.setup();

    setAmount("100000");
    await chooseMethod("Naqd");
    const busy = screen.getByRole("button", { name: "Yuklanmoqda…" });
    expect(busy).toHaveAttribute("aria-busy", "true");
    await user.click(busy);

    await expect(findConfirm()).rejects.toThrow();
    expect(courierPayment.mutateAsync).not.toHaveBeenCalled();
  });

  it("tasdiq oynasi izohni ko'rsatadi; payload'dagi izoh — kesilgan, maydonlar o'zgarmagan", async () => {
    courierPayment.mutateAsync.mockResolvedValue(paymentAccepted);
    cashboxState.response = courierDetailResponse();
    openWithoutState("/payments/cash-detail/263?type=courier");
    const user = userEvent.setup();

    setAmount("100000");
    await chooseMethod("O'tkazma");
    fireEvent.change(screen.getByPlaceholderText("Izoh..."), { target: { value: "  Kunlik topshiriq  " } });
    await user.click(screen.getByRole("button", { name: RECEIVE_BUTTON }));
    const dialog = await findConfirm();
    expect(dialog).toHaveTextContent(/Izoh\s*Kunlik topshiriq/);
    expect(within(dialog).getByText("O'tkazma")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));
    await waitFor(() => expect(courierPayment.mutateAsync).toHaveBeenCalledTimes(1));
    expect(courierPaymentCalls()[0].data).toEqual({
      courier_id: "263",
      amount: 100000,
      payment_method: "click",
      market_id: null,
      payment_date: expect.any(String),
      comment: "Kunlik topshiriq",
    });
  });

  it("«Marketga o'tkazma»: market tanlanmaguncha tugma faol emas (izoh bilan); tasdiqda market nomi", async () => {
    courierPayment.mutateAsync.mockResolvedValue(paymentAccepted);
    marketsState.data = { data: { items: [{ id: "3", name: "Yandex" }] } };
    cashboxState.response = courierDetailResponse();
    openWithoutState("/payments/cash-detail/263?type=courier");
    const user = userEvent.setup();

    setAmount("100000");
    await chooseMethod("Marketga o'tkazma");
    expect(screen.getByText("Market tanlanmaguncha qabul qilish tugmasi faol emas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: RECEIVE_BUTTON })).toBeDisabled();

    await chooseMarket("Yandex");
    expect(screen.queryByText("Market tanlanmaguncha qabul qilish tugmasi faol emas")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: RECEIVE_BUTTON }));
    const dialog = await findConfirm();
    expect(dialog).toHaveTextContent(/Market\s*Yandex/);
    expect(within(dialog).getByText("Marketga o'tkazma")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(courierPayment.mutateAsync).not.toHaveBeenCalled();
  });

  it("operatsiyalar ro'yxati va «Balans harakati»: sarlavha, qarshi qator, izoh, ishorali summa; davr boshi → hozir", async () => {
    cashboxState.response = courierDetailResponse({
      cashbox: { id: "70", cashbox_type: "couriers", user_id: "263", balance: 0 },
      olinishi_kerak: 0,
      history: [
        {
          id: "3",
          cashbox_id: "70",
          source_type: "courier_payment",
          operation_type: "expense",
          amount: 300000,
          balance_after: 0,
          payment_method: "cash",
          comment: "Kunlik topshiriq",
          created_by_user: { id: "1", name: "Shodiyor Ergashev" },
          createdAt: "2026-10-16T10:00:00.000Z",
        },
        {
          id: "2",
          cashbox_id: "70",
          source_type: "sell",
          source_id: "10237",
          operation_type: "income",
          amount: 200000,
          balance_after: 300000,
          payment_method: "click",
          created_by_user: { id: "263", name: "Ali Valiyev" },
          createdAt: "2026-10-15T10:00:00.000Z",
        },
        {
          id: "1",
          cashbox_id: "70",
          source_type: "sell",
          source_id: "10236",
          operation_type: "income",
          amount: 100000,
          balance_after: 100000,
          payment_method: "cash",
          created_by_user: { id: "263", name: "Ali Valiyev" },
          createdAt: "2026-10-14T10:00:00.000Z",
        },
      ],
    });
    openWithoutState("/payments/cash-detail/263?type=courier");

    // Ro'yxat (maket qatori): «Sotuv · №10237», «Ali Valiyev · O'tkazma», +200 000 so'm.
    const sale = screen.getByRole("button", { name: /^Sotuv · №10237, Kirim \+200\D000 so'm/ });
    expect(within(sale).getByText("Ali Valiyev · O'tkazma")).toBeInTheDocument();
    const handover = screen.getByRole("button", { name: /^Kuryer to'lovi, Chiqim −300\D000 so'm/ });
    expect(within(handover).getByText("Shodiyor Ergashev · Naqd")).toBeInTheDocument();
    expect(within(handover).getByText("Kunlik topshiriq")).toBeInTheDocument();

    // «Balans harakati»: davr boshida = eng eski qoldiq − uning summasi (100 000 − 100 000).
    const movement = screen.getByRole("region", { name: "Balans harakati" });
    expect(movement).toHaveTextContent(/Davr boshida\s*0 so'm/);
    expect(movement).toHaveTextContent(/Kirim\s*\+300\D000 so'm/);
    expect(movement).toHaveTextContent(/Chiqim\s*−300\D000 so'm/);
    expect(movement).toHaveTextContent(/Hozir\s*0 so'm/);

    // «Jadval» ko'rinishi — qoldiqlar.
    await userEvent.setup().click(within(movement).getByRole("radio", { name: "Jadval" }));
    expect(within(movement).getAllByText(moneyText(300000)).length).toBeGreaterThan(0);

    // Qator bosilsa — tafsilot oynasi.
    await userEvent.setup().click(handover);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("superadmin filial sahifasi: filial nomi sarlavhada, menejer izohda, «Kuryer: …» qatori, tasdiqda filial → asosiy kassa", async () => {
    cashboxState.response = { data: { cashbox: { id: "30", cashbox_type: "branch", user_id: "15", balance: 400000 }, history: [] } };
    historyState.data = {
      data: {
        items: [
          {
            id: "11",
            cashbox_id: "30",
            source_type: "courier_payment",
            operation_type: "income",
            amount: 180000,
            balance_after: 400000,
            payment_method: "cash",
            source_user: { id: "209", name: "Sardor Qurbonov" },
            created_by_user: { id: "198", name: "Ravshan Ortiqov" },
            createdAt: "2026-10-16T09:00:00.000Z",
          },
        ],
      },
    };
    renderWithProviders(
      <Routes>
        <Route path="/payments/cash-detail/:id" element={<CashDetail />} />
      </Routes>,
      {
        route: {
          pathname: "/payments/cash-detail/15",
          search: "?type=branch",
          state: {
            type: "branch",
            entity: {
              id: "15",
              name: "Ravshan Ortiqov",
              branch_name: "Urgut filiali",
              phone_number: "+998915123407",
              role: "branch",
              amount: 400000,
            },
          },
        },
        preloadedState: superadmin,
      },
    );

    expect(screen.getByRole("heading", { level: 1, name: "Urgut filiali" })).toBeInTheDocument();
    expect(screen.getByText("Menejer: Ravshan Ortiqov · +998 91 512 34 07")).toBeInTheDocument();
    expect(screen.getByText("Filial kassasi")).toBeInTheDocument();
    expect(screen.getByText("Kuryer: Sardor Qurbonov")).toBeInTheDocument();
    expect(screen.getByText("Kuryerdan filialga o'tkazma")).toBeInTheDocument();

    setAmount("100000");
    await chooseMethod("Naqd");
    await userEvent.setup().click(screen.getByRole("button", { name: /^100\D000 so'm qabul qilish$/ }));
    const dialog = await findConfirm();
    expect(dialog).toHaveTextContent(/Qayerdan\s*Filial kassasi\s*Urgut filiali/);
    expect(dialog).toHaveTextContent(/Qayerga\s*Asosiy kassa/);
    await userEvent.setup().click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });
});

/**
 * 2crjWf7v — `GET finance/cashbox/user/:id?cashbox_type=couriers` tarixidagi `courier_payment`
 * qatorlarida `payment_ack` bor: tarixda «Kuryer: noto'g'ri» / «Kuryer tasdiqladi» belgisi (KI-S1), `null` — belgisiz.
 */
describe("CashDetail — kuryer kvitansiyasi javobi tarixda (2crjWf7v)", () => {
  afterEach(() => {
    cashboxState.response = undefined;
    cashboxState.calls = [];
  });

  const historyRow = (id: string, extra: Record<string, unknown>) => ({
    id,
    amount: -100000,
    operation_type: "expense",
    source_type: "courier_payment",
    payment_method: "cash",
    created_by_user: { id: `m${id}`, name: `Menejer ${id}`, role: "manager" },
    createdAt: `2026-10-17T0${id}:00:00.000Z`,
    ...extra,
  });

  it("carries payment_ack into the history rows and marks disputed / confirmed ones", () => {
    cashboxState.response = courierDetailResponse({
      history: [
        historyRow("1", { payment_ack: "disputed" }),
        historyRow("2", { payment_ack: "confirmed" }),
        historyRow("3", { payment_ack: null }),
      ],
    });
    openWithoutState("/payments/cash-detail/263?type=courier");

    // Ro'yxat qatori (v2 `.el-list`): ostidagi «{yaratgan} · {to'lov turi}» bo'yicha topiladi.
    const rowOf = (name: string) => {
      const buttons = screen
        .getAllByText(new RegExp(`^${name}( ·|$)`))
        .map((element) => element.closest("li")?.querySelector("button"))
        .filter((button): button is HTMLButtonElement => Boolean(button));
      expect(buttons).toHaveLength(1);
      return buttons[0];
    };
    expect(within(rowOf("Menejer 1")).getByText("Kuryer: noto'g'ri")).toHaveAttribute("data-payment-ack", "disputed");
    expect(within(rowOf("Menejer 2")).getByText("Kuryer tasdiqladi")).toHaveAttribute("data-payment-ack", "confirmed");
    expect(rowOf("Menejer 3").querySelector("[data-payment-ack]")).toBeNull();
  });
});

/**
 * CB-2 (kfdfYDik, ega javobi CB-S4 — smena hamma kassada majburiy): smena yo'q bo'lsa forma o'rnida «Smena
 * boshlanmagan» bloki + «Smenani ochish» (ayni ochish oynasi); tarix va balans o'zgarmaydi. Maketlar
 * `manager-payments-cash-detail-{courier,branch}-shift-closed`; superadmin/admin — eng yaqini shu (asosiy kassa).
 */
describe("CashDetail — smena qulfi (CB-2)", () => {
  afterEach(() => {
    cashboxState.response = undefined;
    cashboxState.calls = [];
    shiftState.shift = { id: "5", status: "open", opened_by: "1" };
    shiftState.refetch.mockReset();
    shiftState.balanceRequests = [];
    openShiftMutation.mutateAsync.mockReset();
    courierPayment.mutateAsync.mockReset();
  });

  const managerCourier = () => {
    cashboxState.response = {
      statusCode: 200,
      data: {
        cashbox: { id: "60", cashbox_type: "couriers", user_id: "209", balance: 70000 },
        history: [],
        user: { id: "209", name: "Filial kuryeri", role: "courier" },
      },
    };
    return openWithoutState("/payments/cash-detail/209?type=courier", manager);
  };

  it("⭐ menejer, kuryer kassasi, smena yo'q: forma yo'q — banner, «Smenani ochish», tarix qoladi", () => {
    shiftState.shift = null;
    managerCourier();

    const card = screen.getByTestId("shift-locked-card");
    expect(within(card).getByRole("heading", { name: "Kuryerdan qabul qilish" })).toBeInTheDocument();
    expect(within(card).getByText("Smena ochilgach ishlaydi")).toBeInTheDocument();
    const banner = within(card).getByRole("status");
    expect(banner).toHaveTextContent("Smena boshlanmagan");
    expect(banner).toHaveTextContent("Filial kassasida smena ochilgandan keyin kuryerdan pul qabul qilish ishlaydi.");
    expect(within(card).getByRole("button", { name: "Smenani ochish" })).toHaveAttribute("aria-haspopup", "dialog");
    expect(within(card).getByText("Balans va operatsiyalar tarixi ko'rinib turadi.")).toBeInTheDocument();
    // Forma va to'lov tugmasi chizilmaydi; tarix kartasi joyida.
    expect(screen.queryByPlaceholderText("0")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: RECEIVE_BUTTON })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Operatsiyalar tarixi" })).toBeInTheDocument();
    // Qoldiq oyna ochilmaguncha so'ralmaydi.
    expect(shiftState.balanceRequests.every((enabled) => !enabled)).toBe(true);
  });

  it("⭐ «Smenani ochish» → ayni ochish oynasi (filial kassasi, jonli qoldiq) → POST, oyna yopiladi, «Smena ochildi»", async () => {
    shiftState.shift = null;
    openShiftMutation.mutateAsync.mockResolvedValue({ data: { id: "9", status: "open" } });
    const user = userEvent.setup();
    managerCourier();

    await user.click(screen.getByRole("button", { name: "Smenani ochish" }));
    const dialog = await screen.findByRole("dialog", { name: "Smenani ochish" });
    expect(dialog).toHaveTextContent("Menejer");
    expect(dialog).toHaveTextContent(/1\D200\D000/);
    expect(dialog).toHaveTextContent(/300\D000/);
    expect(shiftState.balanceRequests).toContain(true);

    await user.click(within(dialog).getByRole("button", { name: "Smenani ochish" }));
    expect(openShiftMutation.mutateAsync).toHaveBeenCalledTimes(1);
    expect(openShiftMutation.mutateAsync).toHaveBeenCalledWith({ comment: undefined });
    expect(await screen.findByText("Smena ochildi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Smenani ochish" })).not.toBeInTheDocument());
  });

  it("ochish xatosi: oyna ochiq qoladi, faqat i18n xabar, holat qayta o'qiladi", async () => {
    shiftState.shift = null;
    openShiftMutation.mutateAsync.mockRejectedValue(
      Object.assign(new Error("raw"), { response: { data: { message: "Smena allaqachon ochiq (raw)" } } }),
    );
    const user = userEvent.setup();
    managerCourier();

    await user.click(screen.getByRole("button", { name: "Smenani ochish" }));
    const dialog = await screen.findByRole("dialog", { name: "Smenani ochish" });
    await user.type(within(dialog).getByRole("textbox"), "  kechki smena  ");
    await user.click(within(dialog).getByRole("button", { name: "Smenani ochish" }));

    expect(openShiftMutation.mutateAsync).toHaveBeenCalledWith({ comment: "kechki smena" });
    expect(await screen.findByText("Smenani ochishda xatolik yuz berdi")).toBeInTheDocument();
    expect(screen.queryByText(/raw/)).not.toBeInTheDocument();
    expect(shiftState.refetch).toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Smenani ochish" })).toBeInTheDocument();
  });

  it("menejer, «HQ'ga o'tkazish» (filial kassasi), smena yo'q: «HQ'ga pul o'tkazish» qulfi", () => {
    shiftState.shift = null;
    openWithoutState("/payments/cash-detail/16?type=branch", manager);

    const card = screen.getByTestId("shift-locked-card");
    expect(within(card).getByRole("heading", { name: "HQ'ga o'tkazish" })).toBeInTheDocument();
    expect(within(card).getByRole("status")).toHaveTextContent(
      "Filial kassasida smena ochilgandan keyin HQ'ga pul o'tkazish ishlaydi.",
    );
    expect(screen.queryByPlaceholderText("0")).not.toBeInTheDocument();
  });

  it("superadmin, kuryer kassasi, asosiy kassa smenasi yo'q: «Asosiy kassada …» qulfi", () => {
    shiftState.shift = null;
    cashboxState.response = courierDetailResponse();
    openWithoutState("/payments/cash-detail/263?type=courier");

    expect(screen.getByTestId("shift-locked-card")).toHaveTextContent(
      "Asosiy kassada smena ochilgandan keyin kuryerdan pul qabul qilish ishlaydi.",
    );
    expect(screen.queryByRole("button", { name: RECEIVE_BUTTON })).not.toBeInTheDocument();
  });

  it("superadmin, market kassasi, asosiy kassa smenasi yo'q: «marketga to'lov» qulfi", () => {
    shiftState.shift = null;
    cashboxState.response = {
      data: { cashbox: { id: "40", cashbox_type: "markets", user_id: "3", balance: 0 }, user: { name: "Market" } },
    };
    openWithoutState("/payments/cash-detail/3?type=market");

    expect(screen.getByTestId("shift-locked-card")).toHaveTextContent(
      "Asosiy kassada smena ochilgandan keyin marketga to'lov ishlaydi.",
    );
  });

  it("superadmin, filialdan qabul, asosiy kassa smenasi yo'q: «filialdan pul qabul qilish» qulfi", () => {
    shiftState.shift = null;
    cashboxState.response = { data: { cashbox: { id: "30", cashbox_type: "branch", user_id: "13", balance: 0 } } };
    openWithoutState("/payments/cash-detail/13?type=branch");

    expect(screen.getByTestId("shift-locked-card")).toHaveTextContent(
      "Asosiy kassada smena ochilgandan keyin filialdan pul qabul qilish ishlaydi.",
    );
  });

  it("smena ochiq — forma; holat noma'lum (403 / tarmoq) — forma (qulf chizilmaydi)", () => {
    managerCourier();
    expect(screen.queryByTestId("shift-locked-card")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qabul qilish" })).toBeInTheDocument();
  });

  it("holat noma'lum (403 / tarmoq) — forma, qulf yo'q", () => {
    shiftState.shift = "error";
    managerCourier();
    expect(screen.queryByTestId("shift-locked-card")).not.toBeInTheDocument();
    expect(screen.queryByText("Smena boshlanmagan")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qabul qilish" })).toBeInTheDocument();
  });

  it("kuryer qabul qila olmaydi (can_receive=false) — smena yo'q bo'lsa ham o'z ogohlantirishi (qulf emas)", () => {
    shiftState.shift = null;
    cashboxState.response = courierDetailResponse({ is_hq_courier: false, can_receive: false });
    openWithoutState("/payments/cash-detail/209?type=courier");
    expect(screen.getByText(BRANCH_COURIER)).toBeInTheDocument();
    expect(screen.queryByTestId("shift-locked-card")).not.toBeInTheDocument();
  });
});

/**
 * XsoWhKP5 — kassa amali formasi xatolari ekran o'quvchiga: «Qabul qilish» bosilganda fokus birinchi xato
 * maydonga o'tadi (`aria-invalid` + xato matni), «To'lov turi» xatosi `role="alert"`.
 */
describe("CashboxActionFormCard — forma xatolari ekran o'quvchiga (XsoWhKP5)", () => {
  afterEach(() => {
    cashboxState.response = undefined;
    cashboxState.calls = [];
  });

  it("bo'sh forma: fokus «Summa» maydoniga, u aria-invalid va xato matniga ulangan", async () => {
    cashboxState.response = courierDetailResponse();
    openWithoutState("/payments/cash-detail/263?type=courier");

    await userEvent.setup().click(screen.getByRole("button", { name: RECEIVE_BUTTON }));

    const amount = screen.getByPlaceholderText("0");
    await waitFor(() => expect(amount).toHaveFocus());
    expect(amount).toHaveAttribute("aria-invalid", "true");
    expect(amount).toHaveAccessibleDescription(/Summa majburiy/);
    expect(screen.getByRole("alert")).toHaveTextContent("To'lov turini tanlang");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("summa bor, to'lov turi yo'q: fokus birinchi radioga, xato darhol aytiladi (role=alert), radiolar aria-invalid", async () => {
    cashboxState.response = courierDetailResponse();
    openWithoutState("/payments/cash-detail/263?type=courier");

    setAmount("100000");
    await userEvent.setup().click(screen.getByRole("button", { name: RECEIVE_BUTTON }));

    const group = screen.getByRole("group", { name: /To'lov turi/ });
    const radios = within(group).getAllByRole("radio");
    await waitFor(() => expect(radios[0]).toHaveFocus());
    await waitFor(() => radios.forEach((radio) => expect(radio).toHaveAttribute("aria-invalid", "true")));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("To'lov turini tanlang");
    expect(group).toHaveAccessibleDescription("To'lov turini tanlang");
  });

  it("server chegarasidan oshgan summa: xato «Summa» ostida va fokus o'sha maydonda", async () => {
    cashboxState.response = courierDetailResponse({ olinishi_kerak: 50000 });
    openWithoutState("/payments/cash-detail/263?type=courier");

    setAmount("100000");
    await chooseMethod("Naqd");
    await userEvent.setup().click(screen.getByRole("button", { name: RECEIVE_BUTTON }));

    const amount = screen.getByPlaceholderText("0");
    await waitFor(() => expect(amount).toHaveFocus());
    expect(amount).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
