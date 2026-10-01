import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

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

/** Kassa smenasi (finance-service `shifts` jadvali; ID lar bigint satr). */
export interface CashboxShift {
  id: string;
  opened_by: string;
  closed_by?: string | null;
  opened_at?: string;
  closed_at?: string | null;
  status: "open" | "closed";
  comment?: string | null;
}

/** GET /finance/shift javobi. */
export interface ShiftListResponse {
  statusCode: number;
  message: string;
  data: {
    items: CashboxShift[];
    pagination?: { total: number; page: number; limit: number; totalPages: number };
  };
}

/** POST /finance/shift/open — gateway OpenShiftRequestDto (sukut: MAIN kassa). */
export type OpenShiftRequest = { opened_by: string };

/** POST /finance/shift/close — gateway CloseShiftRequestDto. */
export type CloseShiftRequest = { closed_by: string; shift_id: string; comment?: string };

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

  const refreshCashboxQueries = async () => {
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

  const createPaymentCourier = useMutation({
    mutationFn: ({ data, idempotencyKey }: CourierPaymentRequest) =>
      api.post<CourierPaymentResponse>(
        API_ENDPOINTS.CASHBOX.PAYMENT_COURIER,
        data,
        idempotencyHeaders(idempotencyKey),
      ),
    onSuccess: refreshCashboxQueries,
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
    onSuccess: refreshCashboxQueries,
  });

  const createPaymentMarket = useMutation({
    mutationFn: ({ data, idempotencyKey }: CashboxPaymentRequest) =>
      api.post<CashboxPaymentResponse>(
        API_ENDPOINTS.CASHBOX.PAYMENT_MARKET,
        data,
        idempotencyHeaders(idempotencyKey),
      ),
    onSuccess: refreshCashboxQueries,
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

  const useGetCashboxMyCashbox = (params?: any) =>
    useQuery({
      queryKey: [cashbox, "my-cashbox", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.CASHBOX.MY_CASHBOX, { params }).then((res) => res.data),
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

  const useGetCashBoxMain = (params?: any) =>
    useQuery({
      queryKey: [cashbox, "main", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.CASHBOX_MAIN, { params }).then((res) => res.data),
    });

  // Kalit `cashbox` prefiksi ostida — refreshCashboxQueries har to'lovdan
  // keyin ro'yxatni ham yangilaydi (qabul qilingan kuryer summasi kamayadi).
  const useGetHqCourierReceivables = (enabled: boolean = true) =>
    useQuery<HqCourierReceivablesResponse>({
      queryKey: [cashbox, "hq-couriers"],
      queryFn: () =>
        api.get(API_ENDPOINTS.FINANCE.HQ_COURIERS).then((res) => res.data),
      enabled,
    });

  const cashboxSpand = useMutation({
    mutationFn: ({ data }: { data: any }) => api.patch(API_ENDPOINTS.CASHBOX.SPEND, data),
    onSuccess: refreshCashboxQueries,
  });

  const cashboxFill = useMutation({
    mutationFn: ({ data }: { data: any }) => api.patch(API_ENDPOINTS.CASHBOX.FILL, data),
    onSuccess: refreshCashboxQueries,
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
  // FE-PAY-06: backend'da "joriy smena" marshruti yo'q — foydalanuvchining
  // OCHIQ smenasi GET /finance/shift?status=open&opened_by=<o'zi> bilan
  // olinadi. Yuboriladigan maydonlar gateway DTO'lari bilan aynan bir xil
  // (forbidNonWhitelisted): OpenShiftRequestDto → { opened_by },
  // CloseShiftRequestDto → { closed_by, shift_id, comment? }. Ilgari ochish
  // tanasiz, yopish faqat { comment } bilan ketib, har doim 400 olardi.

  const useGetCurrentShift = (openedBy?: string | null, enabled: boolean = true) =>
    useQuery<ShiftListResponse>({
      queryKey: [shift, "current", openedBy],
      queryFn: () =>
        api
          .get(API_ENDPOINTS.CASHBOX.SHIFT_CURRENT, {
            params: { status: "open", opened_by: openedBy, limit: 1 },
          })
          .then((res) => res.data),
      enabled: enabled && Boolean(openedBy),
    });

  // Smena holati qayta o'qilguncha kutiladi — tugma ("ochish" ↔ "yopish")
  // muvaffaqiyat xabari bilan bir vaqtda almashadi.
  const openShift = useMutation({
    mutationFn: ({ opened_by }: OpenShiftRequest) =>
      api.post(API_ENDPOINTS.CASHBOX.SHIFT_OPEN, { opened_by }),
    onSuccess: () => client.invalidateQueries({ queryKey: [shift] }),
  });

  const closeShift = useMutation({
    mutationFn: ({ closed_by, shift_id, comment }: CloseShiftRequest) =>
      api.post(API_ENDPOINTS.CASHBOX.SHIFT_CLOSE, {
        closed_by,
        shift_id,
        // Bo'sh izoh yuborilmaydi — smena ochilgandagi izohni o'chirib yubormasin.
        ...(comment ? { comment } : {}),
      }),
    onSuccess: async () => {
      void refreshCashboxQueries();
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
