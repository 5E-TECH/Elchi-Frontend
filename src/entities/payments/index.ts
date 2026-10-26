import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { SHIFT_CLOSE_TIMEOUT_MS, type CloseShiftAccount } from "./shiftAccountCheck";

export const cashbox = "cashbox";
export const shift = "shift";
export const financeHistory = "finance-history";

export interface FinanceHistoryActor {
  id: string | number;
  name?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone_number?: string | null;
  phone?: string | null;
  role?: string | null;
  status?: string | null;
}

export interface FinanceHistoryCashbox {
  id: string;
  balance: number;
  balance_cash?: number;
  balance_card?: number;
  cashbox_type: string;
  user_id?: string | null;
  user?: FinanceHistoryActor | null;
}

export interface FinanceHistoryOrderProduct {
  id: string;
  name?: string | null;
  image_url?: string | null;
}

export interface FinanceHistoryOrderItem {
  id: string;
  product_id: string;
  quantity: number;
  product?: FinanceHistoryOrderProduct | null;
}

export interface FinanceHistoryRegion {
  id: string;
  name: string;
}

export interface FinanceHistoryDistrict {
  id: string;
  name: string;
  region?: FinanceHistoryRegion | null;
}

export interface FinanceHistoryOrder {
  id: string;
  status?: string;
  where_deliver?: string;
  total_price?: number;
  to_be_paid?: number;
  paid_amount?: number;
  comment?: string | null;
  operator?: string | null;
  address?: string | null;
  market?: FinanceHistoryActor | null;
  customer?: (FinanceHistoryActor & {
    extra_number?: string | null;
    address?: string | null;
    district?: FinanceHistoryDistrict | null;
    region?: FinanceHistoryRegion | null;
  }) | null;
  district?: FinanceHistoryDistrict | null;
  region?: FinanceHistoryRegion | null;
  items?: FinanceHistoryOrderItem[];
}

export interface FinanceHistoryDetail {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  operation_type?: string;
  cashbox_id?: string;
  source_type?: string;
  source_id?: string | null;
  source_user_id?: string | null;
  amount: number;
  balance_after?: number;
  payment_method?: string | null;
  comment?: string | null;
  created_by?: string | null;
  payment_date?: string | null;
  /** Elchi Pochta №1 — qo'lda chiqimning xarajat kategoriyasi (ID va yozilgan paytdagi nom), bo'lmasa `null`. */
  expense_category_id?: string | null;
  expense_category_name?: string | null;
  cashbox?: FinanceHistoryCashbox | null;
  order?: FinanceHistoryOrder | null;
  user?: FinanceHistoryActor | null;
  source_user?: FinanceHistoryActor | null;
  sourceUser?: FinanceHistoryActor | null;
  created_by_user?: FinanceHistoryActor | null;
  createdByUser?: FinanceHistoryActor | null;
}

export interface FinanceHistoryDetailResponse {
  statusCode: number;
  message: string;
  data: FinanceHistoryDetail;
}

/**
 * HQ kuryeri — superadmin/admin "Qabul qilinishi kerak" ro'yxati qatori
 * (GET /finance/cashbox/hq-couriers). Faqat faol branch_users qatori HQ
 * filialida bo'lgan va kassasida puli (balance > 0) bor kuryerlar keladi,
 * bloklanganlari ham (pul yashirinib qolmasin). Summa bo'yicha kamayish tartibida.
 */
export interface HqCourierReceivable {
  id: string;
  name: string;
  phone_number: string | null;
  status: string;
  balance: number;
  cashbox: {
    id: string;
    balance: number;
    balance_cash: number;
    balance_card: number;
  };
}

export interface HqCourierReceivablesResponse {
  statusCode: number;
  message: string;
  data: {
    items: HqCourierReceivable[];
    total: number;
    hq_branch_id: string;
  };
}

/**
 * Pul o'tkazmasi so'rovi (kuryerdan qabul qilish, marketga to'lov, filial →
 * HQ). `idempotencyKey` bitta mantiqiy to'lov uchun o'zgarmaydi
 * (muvaffaqiyatgacha) — javob kechikib (masalan 504) qayta yuborilsa, backend
 * o'sha kalit bo'yicha pulni faqat bir marta o'tkazadi.
 */
export type CashboxPaymentRequest = { data: Record<string, unknown>; idempotencyKey: string };
export type CourierPaymentRequest = CashboxPaymentRequest;

/**
 * POST /finance/cashbox/payment/{courier,market,branch-to-main} javobi (umumiy
 * konvert). Shu `Idempotency-Key` bilan pul avval o'tgan bo'lsa (javobi
 * yo'qolgan urinish qayta yuborilganda) finance-service pulni ikkinchi marta
 * o'tkazmaydi va `{ statusCode: 200, message: "... (takroriy so'rov)",
 * data: { idempotent: true } }` qaytaradi — ya'ni bu yangi to'lov EMAS.
 */
export interface CashboxPaymentResponse {
  statusCode: number;
  message: string;
  data?: ({ idempotent?: boolean } & Record<string, unknown>) | null;
}
export type CourierPaymentResponse = CashboxPaymentResponse;

const idempotencyHeaders = (idempotencyKey: string) => ({ headers: { "Idempotency-Key": idempotencyKey } });

/**
 * Kassa smenasi (finance-service `shifts` jadvali; ID lar bigint satr, pul — `numeric(20,2)` → son).
 * Yopilgan smenada yig'indilar, kutilgan qoldiq va farq to'ldiriladi (QTCUUgjA): `expected = opening + income −
 * expense`, `discrepancy = closing − expected` (manfiy — kamomad, musbat — ortiqcha). Sanalgan summa yuborilmasa
 * farq `null` («Sanalmadi»).
 */
export interface CashboxShift {
  id: string;
  opened_by: string;
  closed_by?: string | null;
  /** Smena qaysi kassaga tegishli: MAIN — `"0"`, filial — filial ID si. */
  cashbox_user_id?: string | null;
  opened_at?: string;
  closed_at?: string | null;
  status: "open" | "closed";
  opening_balance_cash?: number;
  opening_balance_card?: number;
  closing_balance_cash?: number;
  closing_balance_card?: number;
  total_income_cash?: number;
  total_income_card?: number;
  total_expense_cash?: number;
  total_expense_card?: number;
  expected_balance_cash?: number | null;
  expected_balance_card?: number | null;
  discrepancy_cash?: number | null;
  discrepancy_card?: number | null;
  comment?: string | null;
}

/**
 * GET /finance/shift/current javobi (kfdfYDik): `shift` — kassaning OCHIQ smenasi yoki `null` (yopilgan smena
 * kelmaydi), `required` — smenasiz pul operatsiyalari bloklanadimi (`FINANCE_REQUIRE_OPEN_SHIFT`). Kassa doirasi
 * JWT'dan: superadmin/admin — asosiy (MAIN) kassa, menejer — o'z filiali kassasi (filiali topilmasa 403).
 */
export interface CurrentShiftResponse {
  statusCode: number;
  message: string;
  data: {
    shift: CashboxShift | null;
    required?: boolean;
    cashbox_user_id?: string;
  };
}

/** POST /finance/shift/open va /close javobi — smena qatori. */
export interface ShiftMutationResponse {
  statusCode: number;
  message: string;
  data: CashboxShift;
}

/**
 * POST /finance/shift/open — gateway `OpenShiftRequestDto`. Ochgan xodim JWT'dan yoziladi (`opened_by`
 * e'tiborga olinmaydi); ochilish qoldig'i yuborilmaydi — backend kassaning jonli qoldig'ini yozadi.
 */
export type OpenShiftRequest = { comment?: string };

/**
 * POST /finance/shift/close — gateway `CloseShiftRequestDto`. Yopgan xodim JWT'dan (`closed_by` yuborilmaydi).
 * `closing_balance_cash` — sanalgan naqd (majburiy, UI qoidasi); `closing_balance_card` — sanalgan karta
 * (ixtiyoriy: yuborilmasa `discrepancy_card` null — «Sanalmadi»).
 */
export type CloseShiftRequest = {
  shift_id: string;
  closing_balance_cash: number;
  closing_balance_card?: number | null;
  comment?: string;
  /**
   * kiZgTybn — har karta / hisob qoldig'i (`shift.account_check.enabled` yoqilganda kassaning HAR faol kartasi uchun
   * majburiy). Rasm kaliti yuborilmaydi: backend qoralamadagi (`account-photo`) rasmni oladi.
   */
  accounts?: CloseShiftAccount[];
};

const shiftMoneyKeys = [
  "opening_balance_cash",
  "opening_balance_card",
  "closing_balance_cash",
  "closing_balance_card",
  "total_income_cash",
  "total_income_card",
  "total_expense_cash",
  "total_expense_card",
] as const;
const shiftNullableMoneyKeys = [
  "expected_balance_cash",
  "expected_balance_card",
  "discrepancy_cash",
  "discrepancy_card",
] as const;

const toFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Smena qatorini bir xil shaklga keltiradi: ID lar satr, pul maydonlari son (`numeric` satr kelsa ham),
 * nullable farq/kutilgan qiymatlar `null` saqlanadi. Qator bo'lmasa — `null`.
 */
export const normalizeCashboxShift = (value: unknown): CashboxShift | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = record.id;
  if (id === undefined || id === null || id === "") return null;
  const shift: CashboxShift = {
    ...(record as Partial<CashboxShift>),
    id: String(id),
    opened_by: record.opened_by === undefined || record.opened_by === null ? "" : String(record.opened_by),
    closed_by: record.closed_by === undefined || record.closed_by === null ? null : String(record.closed_by),
    status: String(record.status ?? "").toLowerCase() === "closed" ? "closed" : "open",
  };
  for (const key of shiftMoneyKeys) shift[key] = toFiniteNumber(record[key]) ?? 0;
  for (const key of shiftNullableMoneyKeys) shift[key] = toFiniteNumber(record[key]);
  return shift;
};

/**
 * Har pul harakatidan keyin kassa bilan bog'liq barcha so'rovlarni yangilaydi (kassa, balanslar, tarix,
 * bosh sahifa). Umumiy eksport — boshqa moliya oqimlari (masalan integratsiya hisob-kitobi) ham ishlatadi.
 */
export const refreshCashboxQueries = async (client: QueryClient) => {
  await Promise.all([
    client.invalidateQueries({ queryKey: [cashbox], refetchType: "active" }),
    client.invalidateQueries({ queryKey: ["finance-cov"], refetchType: "active" }),
    client.invalidateQueries({ queryKey: ["markets"], refetchType: "active" }),
    client.invalidateQueries({ queryKey: ["couriers"], refetchType: "active" }),
    client.invalidateQueries({ queryKey: ["courier-cashbox-balances"], refetchType: "active" }),
    client.invalidateQueries({ queryKey: ["branches"], refetchType: "active" }),
    // GET /managers — "Qabul qilinishi kerak" oynasidagi filial summalari
    // (berilishi_kerak). Busiz qabuldan keyin 30 s gacha eski summa
    // ko'rinib, kassa sahifasiga ham o'tib ketardi (FE-PAY-15).
    client.invalidateQueries({ queryKey: ["managers"], refetchType: "active" }),
    client.invalidateQueries({ queryKey: ["dashboard"], refetchType: "active" }),
    client.invalidateQueries({ queryKey: ["branch-dashboard"], refetchType: "active" }),
    client.invalidateQueries({ queryKey: ["revenue"], refetchType: "active" }),
    client.invalidateQueries({ queryKey: ["kpi"], refetchType: "active" }),
    client.invalidateQueries({ queryKey: [financeHistory], refetchType: "active" }),
  ]);
};

const normalizeFinanceHistoryParams = (params?: any) => {
  if (!params) return params;

  const { fromDate, toDate, ...rest } = params;
  return {
    ...rest,
    ...(fromDate && { from_date: fromDate }),
    ...(toDate && { to_date: toDate }),
  };
};

export const useCashBox = () => {
  const client = useQueryClient();

  const refreshCashbox = () => refreshCashboxQueries(client);

  const createPaymentCourier = useMutation({
    mutationFn: ({ data, idempotencyKey }: CourierPaymentRequest) =>
      api.post<CourierPaymentResponse>(
        API_ENDPOINTS.CASHBOX.PAYMENT_COURIER,
        data,
        idempotencyHeaders(idempotencyKey),
      ),
    onSuccess: refreshCashbox,
  });

  // C1 / FE-PAY-03: market to'lovi va filial → HQ ham kuryer to'lovi kabi
  // `Idempotency-Key` bilan — 504 dan keyin qayta bosish pulni ikki marta
  // yozmaydi (gateway ikkala marshrutda ham sarlavhani o'qiydi).
  const createPaymentBranchToMain = useMutation({
    mutationFn: ({ data, idempotencyKey }: CashboxPaymentRequest) =>
      api.post<CashboxPaymentResponse>(
        API_ENDPOINTS.CASHBOX.PAYMENT_BRANCH_TO_MAIN,
        data,
        idempotencyHeaders(idempotencyKey),
      ),
    onSuccess: refreshCashbox,
  });

  const createPaymentMarket = useMutation({
    mutationFn: ({ data, idempotencyKey }: CashboxPaymentRequest) =>
      api.post<CashboxPaymentResponse>(
        API_ENDPOINTS.CASHBOX.PAYMENT_MARKET,
        data,
        idempotencyHeaders(idempotencyKey),
      ),
    onSuccess: refreshCashbox,
  });

  const useGetCashBoxById = (
    id: string | undefined,
    bool: boolean = true,
    params?: unknown,
  ) =>
    useQuery({
      queryKey: [cashbox, "by-user", id, params],
      queryFn: () =>
        api
          .get(API_ENDPOINTS.FINANCE.CASHBOX_BY_USER(id as string), { params })
          .then((res) => res.data),
      enabled: bool && Boolean(id),
    });

  const useGetCashBoxHistoryById = (id: string | null, bool: boolean = true) =>
    useQuery({
      queryKey: [cashbox, "history-by-id", id],
      queryFn: () => api.get(API_ENDPOINTS.CASHBOX_HISTORY.BY_ID(id as string)).then((res) => res.data),
      enabled: bool && Boolean(id),
    });

  /** `silentError` — blok xatoni o'zi ko'rsatadi (`ErrorState`), global xabar takrorlanmaydi. */
  const useGetCashboxMyCashbox = (params?: any, options?: { silentError?: boolean }) =>
    useQuery({
      queryKey: [cashbox, "my-cashbox", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.CASHBOX.MY_CASHBOX, { params }).then((res) => res.data),
      ...(options?.silentError ? { meta: { silentError: true } } : {}),
    });

  const useGetCashBoxInfo = (bool: boolean = true, params?: any) =>
    useQuery({
      queryKey: [cashbox, "all-info", params],
      queryFn: () =>
        api
          .get(API_ENDPOINTS.FINANCE.CASHBOX_ALL_INFO, { params })
          .then((res) => res.data),
      enabled: bool,
    });

  // `enabled` (CB-2) — smena ochish oynasi qoldiqni faqat oyna ochilganda o'qiydi (sukut o'zgarmagan).
  const useGetCashBoxMain = (params?: any, enabled: boolean = true) =>
    useQuery({
      queryKey: [cashbox, "main", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.CASHBOX_MAIN, { params }).then((res) => res.data),
      enabled,
    });

  // Kalit `cashbox` prefiksi ostida — refreshCashbox har to'lovdan
  // keyin ro'yxatni ham yangilaydi (qabul qilingan kuryer summasi kamayadi).
  const useGetHqCourierReceivables = (enabled: boolean = true) =>
    useQuery<HqCourierReceivablesResponse>({
      queryKey: [cashbox, "hq-couriers"],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.HQ_COURIERS).then((res) => res.data),
      enabled,
    });

  // Ega qarori D3 (2026-10-17): «Kassadan xarajat» / «Kassani to'ldirish» ham
  // `Idempotency-Key` bilan (gateway `cashbox/spend|fill` sarlavhani o'qiydi,
  // takroriy kalitga `data.idempotent: true`). Kalit berilmasa so'rov avvalgidek.
  const cashboxSpand = useMutation({
    mutationFn: ({ data, idempotencyKey }: { data: Record<string, unknown>; idempotencyKey?: string }) =>
      idempotencyKey
        ? api.patch(API_ENDPOINTS.CASHBOX.SPEND, data, idempotencyHeaders(idempotencyKey))
        : api.patch(API_ENDPOINTS.CASHBOX.SPEND, data),
    onSuccess: refreshCashbox,
  });

  const cashboxFill = useMutation({
    mutationFn: ({ data, idempotencyKey }: { data: Record<string, unknown>; idempotencyKey?: string }) =>
      idempotencyKey
        ? api.patch(API_ENDPOINTS.CASHBOX.FILL, data, idempotencyHeaders(idempotencyKey))
        : api.patch(API_ENDPOINTS.CASHBOX.FILL, data),
    onSuccess: refreshCashbox,
  });

  const useGetFinanceHistory = (params?: any, enabled: boolean = true) => {
    const normalizedParams = normalizeFinanceHistoryParams(params);

    return useQuery({
      queryKey: [cashbox, "finance-history", normalizedParams],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.HISTORY, { params: normalizedParams }).then((res) => res.data),
      enabled,
    });
  };

  const useGetFinanceHistoryById = (id: string | null, enabled: boolean = true) =>
    useQuery<FinanceHistoryDetailResponse>({
      queryKey: [financeHistory, id],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.HISTORY_BY_ID(id as string)).then((res) => res.data),
      enabled: enabled && !!id,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    });

  // ==================== SHIFT (SMENA) HOOKS ====================
  //
  // kfdfYDik: holat — GET /finance/shift/current (kassa doirasi JWT'dan: SA/admin — MAIN, menejer — o'z
  // filiali). Ilgari `GET /finance/shift?status=open&opened_by=<o'zi>` ishlatilardi — boshqa admin ochgan smena
  // ko'rinmas, «Smenani ochish» 400 berardi, menejer esa 403 olardi. Ochish `{ comment? }`, yopish
  // `{ shift_id, closing_balance_cash, closing_balance_card?, comment? }` — xodim ID si JWT'dan.

  /** `silentError` — 403 (filiali topilmagan menejer) yoki tarmoq xatosi global xabar chiqarmaydi: holat «noma'lum». */
  const useGetCurrentShift = (enabled: boolean = true) =>
    useQuery<CurrentShiftResponse>({
      queryKey: [shift, "current"],
      queryFn: () => api.get(API_ENDPOINTS.CASHBOX.SHIFT_CURRENT).then((res) => res.data),
      enabled,
      meta: { silentError: true },
    });

  // Smena holati qayta o'qilguncha kutiladi — tugma ("ochish" ↔ "yopish")
  // muvaffaqiyat xabari bilan bir vaqtda almashadi.
  const openShift = useMutation({
    mutationFn: ({ comment }: OpenShiftRequest = {}) =>
      api
        .post<ShiftMutationResponse>(API_ENDPOINTS.CASHBOX.SHIFT_OPEN, comment ? { comment } : {})
        .then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: [shift] }),
  });

  const closeShift = useMutation({
    mutationFn: ({ shift_id, closing_balance_cash, closing_balance_card, comment, accounts }: CloseShiftRequest) => {
      const body = {
        shift_id,
        closing_balance_cash,
        // Karta sanalmagan bo'lsa yuborilmaydi — backend karta farqini hisoblamaydi («Sanalmadi»).
        ...(closing_balance_card === null || closing_balance_card === undefined ? {} : { closing_balance_card }),
        // Bo'sh izoh yuborilmaydi — smena ochilgandagi izohni o'chirib yubormasin.
        ...(comment ? { comment } : {}),
      };
      // kiZgTybn: kartalar bilan — AI `pending` bo'lsa backend 30 s gacha kutadi (gateway 45 s).
      const request = accounts?.length
        ? api.post<ShiftMutationResponse>(
            API_ENDPOINTS.CASHBOX.SHIFT_CLOSE,
            { ...body, accounts },
            { timeout: SHIFT_CLOSE_TIMEOUT_MS },
          )
        : api.post<ShiftMutationResponse>(API_ENDPOINTS.CASHBOX.SHIFT_CLOSE, body);
      return request.then((res) => res.data);
    },
    onSuccess: async () => {
      void refreshCashbox();
      await client.invalidateQueries({ queryKey: [shift] });
    },
  });

  const useGetShiftHistory = (params?: { page?: number; limit?: number }) =>
    useQuery({
      queryKey: [shift, "history", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.CASHBOX.SHIFT_HISTORY, { params }).then((res) => res.data),
    });

  const useGetFinancialBalance = () =>
    useQuery({
      queryKey: [cashbox, "financial-balance"],
      queryFn: () => api.get(API_ENDPOINTS.FINANCE.CASHBOX_FINANCIAL_BALANCE).then((res) => res.data),
    });

  return {
    useGetCashBoxById,
    useGetCashBoxInfo,
    useGetCashboxMyCashbox,
    useGetCashBoxHistoryById,
    useGetCashBoxMain,
    useGetHqCourierReceivables,
    createPaymentCourier,
    createPaymentBranchToMain,
    createPaymentMarket,
    cashboxSpand,
    cashboxFill,
    useGetFinanceHistory,
    useGetFinanceHistoryById,
    // Shift hooks
    useGetCurrentShift,
    openShift,
    closeShift,
    useGetShiftHistory,
    useGetFinancialBalance,
  };
};

export * from "./shiftAccountCheck";
