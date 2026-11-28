import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { silentErrorMeta, type SilentErrorOption } from "../../shared/lib/queryErrorEvents";

export const investors = "investors";

export type InvestorListMeta = { page?: number; limit?: number; total?: number; totalPages?: number };
export type InvestorList<T = Record<string, unknown>> = { items: T[]; meta: InvestorListMeta };

/**
 * GET /investors javobi konvertda keladi: `{ statusCode, message, data: { items, meta } }`.
 * Ilgari butun konvert massiv deb antd Table'ga berilardi va sahifa
 * `te.some is not a function` bilan qulardi. Har qanday shaklda massiv qaytadi.
 */
export const toInvestorList = <T = Record<string, unknown>>(payload: unknown): InvestorList<T> => {
  const record = (payload ?? {}) as { data?: unknown };
  const body = (record.data ?? payload) as { items?: unknown; meta?: InvestorListMeta } | unknown[] | null;
  if (Array.isArray(body)) return { items: body as T[], meta: {} };
  const items = body && Array.isArray((body as { items?: unknown }).items) ? ((body as { items: T[] }).items) : [];
  return { items, meta: (body as { meta?: InvestorListMeta } | null)?.meta ?? {} };
};

/** Bir sahifada ko'pi bilan (backend `normalizePagination` chegarasi). */
const INVESTOR_PAGE_LIMIT = 100;
/** Ehtiyot chegarasi: 10 sahifa = 1000 investor. */
const INVESTOR_MAX_PAGES = 10;

/**
 * LIuf0DcD (ega, 2026-11-18): «Foydalanuvchilar → Investorlar» dagi «Kabinetni ko'rish» uchun login → investor yozuvi
 * (`user_id` → `id`) xaritasi. `GET /users` investor id'sini bermaydi, `GET /investors` (superadmin/admin) esa har
 * yozuvning `user_id` sini qaytaradi — barcha sahifalar o'qiladi. Login'siz yozuvlar (`user_id` bo'sh yoki `0`) kirmaydi.
 */
export const useInvestorIdsByUser = (enabled: boolean) =>
  useQuery({
    queryKey: [investors, "by-user"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const map = new Map<string, string>();
      for (let page = 1; page <= INVESTOR_MAX_PAGES; page += 1) {
        const { items, meta } = await api
          .get(API_ENDPOINTS.INVESTORS.BASE, { params: { page, limit: INVESTOR_PAGE_LIMIT } })
          .then((res) => toInvestorList<{ id?: unknown; user_id?: unknown }>(res.data));
        for (const item of items) {
          const userId = item.user_id == null ? "" : String(item.user_id).trim();
          const id = item.id == null ? "" : String(item.id).trim();
          if (id && userId && userId !== "0" && !map.has(userId)) map.set(userId, id);
        }
        const totalPages = Number(meta.totalPages) || 0;
        if (items.length < INVESTOR_PAGE_LIMIT || (totalPages > 0 && page >= totalPages)) break;
      }
      return map;
    },
    ...silentErrorMeta({ silentError: true }),
  });

export const useInvestors = () => {
  const client = useQueryClient();

  // ==================== INVESTORS ====================

  const useGetInvestors = (params?: { page?: number; limit?: number }, options?: SilentErrorOption) =>
    useQuery({
      queryKey: [investors, "list", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.INVESTORS.BASE, { params }).then((res) => toInvestorList(res.data)),
      ...silentErrorMeta(options),
    });

  const createInvestor = useMutation({
    mutationFn: (data: unknown) => api.post(API_ENDPOINTS.INVESTORS.BASE, data),
    onSuccess: () => client.invalidateQueries({ queryKey: [investors] }),
  });

  const useGetInvestorById = (id: string, enabled: boolean = true) =>
    useQuery({
      queryKey: [investors, id],
      queryFn: () =>
        api.get(API_ENDPOINTS.INVESTORS.BY_ID(id)).then((res) => res.data),
      enabled: enabled && !!id,
    });

  const updateInvestor = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      api.patch(API_ENDPOINTS.INVESTORS.BY_ID(id), data),
    onSuccess: () => client.invalidateQueries({ queryKey: [investors] }),
  });

  const deleteInvestor = useMutation({
    mutationFn: (id: string) => api.delete(API_ENDPOINTS.INVESTORS.BY_ID(id)),
    onSuccess: () => client.invalidateQueries({ queryKey: [investors] }),
  });

  const useGetInvestorInvestments = (investorId: string, params?: any, enabled: boolean = true) =>
    useQuery({
      queryKey: [investors, investorId, "investments", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.INVESTORS.INVESTMENTS(investorId), { params })
          .then((res) => res.data),
      enabled: enabled && !!investorId,
    });

  const useGetInvestorProfits = (investorId: string, params?: any, enabled: boolean = true) =>
    useQuery({
      queryKey: [investors, investorId, "profits", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.INVESTORS.PROFITS(investorId), { params })
          .then((res) => res.data),
      enabled: enabled && !!investorId,
    });

  // ==================== INVESTMENTS ====================

  const useGetInvestments = (params?: any) =>
    useQuery({
      queryKey: [investors, "investments", "list", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.INVESTMENTS.BASE, { params }).then((res) => res.data),
    });

  const createInvestment = useMutation({
    mutationFn: (data: unknown) => api.post(API_ENDPOINTS.INVESTMENTS.BASE, data),
    onSuccess: () => client.invalidateQueries({ queryKey: [investors] }),
  });

  const useGetInvestmentById = (id: string, enabled: boolean = true) =>
    useQuery({
      queryKey: [investors, "investments", id],
      queryFn: () =>
        api.get(API_ENDPOINTS.INVESTMENTS.BY_ID(id)).then((res) => res.data),
      enabled: enabled && !!id,
    });

  const updateInvestment = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      api.patch(API_ENDPOINTS.INVESTMENTS.BY_ID(id), data),
    onSuccess: () => client.invalidateQueries({ queryKey: [investors] }),
  });

  const deleteInvestment = useMutation({
    mutationFn: (id: string) => api.delete(API_ENDPOINTS.INVESTMENTS.BY_ID(id)),
    onSuccess: () => client.invalidateQueries({ queryKey: [investors] }),
  });

  // ==================== PROFITS ====================

  const useGetProfits = (params?: any) =>
    useQuery({
      queryKey: [investors, "profits", "list", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.PROFITS.BASE, { params }).then((res) => res.data),
    });

  const createProfit = useMutation({
    mutationFn: (data: unknown) => api.post(API_ENDPOINTS.PROFITS.BASE, data),
    onSuccess: () => client.invalidateQueries({ queryKey: [investors] }),
  });

  const calculateProfits = useMutation({
    mutationFn: (data: unknown) => api.post(API_ENDPOINTS.PROFITS.CALCULATE, data),
    onSuccess: () => client.invalidateQueries({ queryKey: [investors] }),
  });

  const markProfitPaid = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: any }) =>
      api.patch(API_ENDPOINTS.PROFITS.MARK_PAID(id), data),
    onSuccess: () => client.invalidateQueries({ queryKey: [investors] }),
  });

  return {
    // Investors
    useGetInvestors,
    createInvestor,
    useGetInvestorById,
    updateInvestor,
    deleteInvestor,
    useGetInvestorInvestments,
    useGetInvestorProfits,
    // Investments
    useGetInvestments,
    createInvestment,
    useGetInvestmentById,
    updateInvestment,
    deleteInvestment,
    // Profits
    useGetProfits,
    createProfit,
    calculateProfits,
    markProfitPaid,
  };
};

// ==================== INVESTOR KABINETI (IN-1) ====================
// Investorning o'zi: `GET investors/me/*` (doira JWT'dan). Hook'lar va normalizator — alohida fayllarda.
export {
  investorMeKeys,
  useInvestorDashboard,
  useInvestorDashboardOf,
  useInvestorInvestments,
  useInvestorMe,
  useInvestorProfits,
  useSetInvestorShareTerms,
  useSetInvestorStartDate,
} from "./api/me";
export type {
  InvestorListParams,
  InvestorMonthsWindow,
  InvestorProfitParams,
  InvestorShareTermsInput,
} from "./api/me";
export {
  investorAccessProblem,
  toInvestorDashboard,
  toInvestorInvestmentsPage,
  toInvestorMe,
  toInvestorProfitsPage,
} from "./model/me";
export type {
  InvestorAccessProblem,
  InvestorDashboard,
  InvestorInvestment,
  InvestorInvestmentsPage,
  InvestorMe,
  InvestorMonthlyPoint,
  InvestorPageMeta,
  InvestorProfit,
  InvestorProfitBasis,
  InvestorProfitsPage,
  InvestorSelfProfile,
  InvestorShareTerm,
  InvestorSummary,
} from "./model/me";
