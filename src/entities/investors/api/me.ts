import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS } from "../../../shared/api";
import { api } from "../../../shared/api/api";
import { silentErrorMeta, type SilentErrorOption } from "../../../shared/lib/queryErrorEvents";
import {
  toInvestorDashboard,
  toInvestorInvestmentsPage,
  toInvestorMe,
  toInvestorProfitsPage,
  type InvestorDashboard,
  type InvestorInvestmentsPage,
  type InvestorMe,
  type InvestorProfitsPage,
} from "../model/me";

/**
 * INVESTOR KABINETI so'rovlari (IN-1). Faqat investor roli (`@Roles(INVESTOR)`); doira JWT'dan — `investor_id`
 * yuborilmaydi. Sahifa xatoni o'zi chizadi (403 / 404 / 409 holat ekranlari, `ErrorState`) — `silentError` bilan
 * global xabar takrorlanmaydi. 4xx qayta so'ralmaydi (`shouldRetryQuery`, ilova sukuti).
 */

export const investorMeKeys = {
  all: ["investors", "me"] as const,
  profile: () => ["investors", "me", "profile"] as const,
  dashboard: (months: number) => ["investors", "me", "dashboard", months] as const,
  investments: (params: InvestorListParams) => ["investors", "me", "investments", params] as const,
  profits: (params: InvestorProfitParams) => ["investors", "me", "profits", params] as const,
};

/** Grafik oynasi: backend 1..36 qabul qiladi, maketda 6 · 12 · 24. */
export type InvestorMonthsWindow = 6 | 12 | 24;

export type InvestorListParams = { page?: number; limit?: number; from_date?: string; to_date?: string };
export type InvestorProfitParams = { page?: number; limit?: number; is_paid?: boolean };

type Options = SilentErrorOption & { enabled?: boolean };

/** Profil va yig'indi (`GET investors/me`) — grafiksiz; holat ekranlari bilan bir xil 403 / 404 / 409. */
export const useInvestorMe = (options?: Options) =>
  useQuery<InvestorMe>({
    queryKey: investorMeKeys.profile(),
    queryFn: ({ signal }) =>
      api.get(API_ENDPOINTS.INVESTORS.ME, { signal }).then((response) => toInvestorMe(response.data)),
    enabled: options?.enabled ?? true,
    ...silentErrorMeta(options),
  });

/** KPI + oylik foyda (`GET investors/me/dashboard?months=`). Oyna almashganda eski grafik turib turadi. */
export const useInvestorDashboard = (months: InvestorMonthsWindow, options?: Options) =>
  useQuery<InvestorDashboard>({
    queryKey: investorMeKeys.dashboard(months),
    queryFn: ({ signal }) =>
      api
        .get(API_ENDPOINTS.INVESTORS.ME_DASHBOARD, { params: { months }, signal })
        .then((response) => toInvestorDashboard(response.data)),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
    ...silentErrorMeta(options),
  });

/** O'z investitsiyalari (`invested_at` DESC — tartib serverda). */
export const useInvestorInvestments = (params: InvestorListParams, options?: Options) =>
  useQuery<InvestorInvestmentsPage>({
    queryKey: investorMeKeys.investments(params),
    queryFn: ({ signal }) =>
      api
        .get(API_ENDPOINTS.INVESTORS.ME_INVESTMENTS, { params, signal })
        .then((response) => toInvestorInvestmentsPage(response.data)),
    enabled: options?.enabled ?? true,
    ...silentErrorMeta(options),
  });

/** O'z foyda tarixi (`period_start` DESC — tartib serverda). */
export const useInvestorProfits = (params: InvestorProfitParams, options?: Options) =>
  useQuery<InvestorProfitsPage>({
    queryKey: investorMeKeys.profits(params),
    queryFn: ({ signal }) =>
      api
        .get(API_ENDPOINTS.INVESTORS.ME_PROFITS, { params, signal })
        .then((response) => toInvestorProfitsPage(response.data)),
    enabled: options?.enabled ?? true,
    ...silentErrorMeta(options),
  });
