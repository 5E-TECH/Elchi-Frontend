import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emitQueryError, QUERY_ERROR_EVENT } from "../shared/lib/queryErrorEvents";
import { useActivityLogs } from "../entities/activity-log/api/useActivityLogs";
import { useBranchCoverage } from "../entities/branch/branchCoverage";
import { useMiscCoverage } from "../entities/coverage/miscCoverage";
import { useIdentityCoverage } from "../entities/identity";
import {
  useGetIntegrationById,
  useGetIntegrations,
  useIntegrationMetrics,
} from "../entities/integrations";
import { useIntegrationsCoverage } from "../entities/integrations/integrationsCoverage";
import { usePayments } from "../entities/integrations/payments";
import { useReceivableBalance, useReceivables, useRemittances } from "../entities/integrations/settlement";
import { usePartnerShipments, useProviderShipments } from "../entities/integrations/shipments";
import { useSyncHistory } from "../entities/integrations/syncHistory";
import { useWebhookLogs } from "../entities/integrations/webhookLogs";
import {
  useInvestorDashboard,
  useInvestorInvestments,
  useInvestorProfits,
  useInvestors,
} from "../entities/investors";
import { useLogisticsCoverage } from "../entities/logistics/logisticsCoverage";
import { useNotifications } from "../entities/notification/api/useNotifications";
import { useInboxList } from "../entities/notification-inbox/api/useInbox";
import { usePartners, usePartnerWebhooks } from "../entities/partners";
import { useFinanceCoverage } from "../entities/payments/financeCoverage";
import {
  useSmsAccounts,
  useSmsCampaigns,
  useSmsReport,
  useSmsStatus,
  useSmsTemplates,
} from "../entities/sms";
import { useUser } from "../entities/user/api/userApi";
import { createTestStore } from "./test-utils";

/**
 * G2 — xatosi sahifaning o'zida chiziladigan so'rovlar (`ErrorState` / `QueryBoundary`): integratsiyalar konsoli
 * va panellari, eski hamkorlar/manbalar, Telegram guruhlari, SMS, faoliyat jurnali, ops panellari, profil va
 * bildirishnomalar qutisi. Global xabar (`QUERY_ERROR_EVENT` → toast) takrorlanmaydi (`g1SilentQueryErrors` naqshi).
 * Hook'larda bayroq ixtiyoriy (`{ silentError: true }`) — bayroqsiz iste'molchi (masalan sarlavha qo'ng'iroqchasi,
 * manba tanlash) uchun xulq o'zgarmagan.
 */

const apiMock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../shared/api/api", () => ({
  api: apiMock,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
  API_TIMEOUT_MS: 20_000,
}));

const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
const serverError = new AxiosError(
  "Request failed with status code 500",
  AxiosError.ERR_BAD_RESPONSE,
  config,
  {},
  {
    status: 500,
    statusText: "",
    headers: {},
    config,
    data: { message: "Internal server error" },
  } as AxiosResponse,
);

const createWrapper = () => {
  const client = new QueryClient({
    queryCache: new QueryCache({ onError: (error, query) => emitQueryError(error, query.meta) }),
    defaultOptions: { queries: { retry: false } },
  });
  const store = createTestStore();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </Provider>
  );
  return Wrapper;
};

const globalErrorsOf = async (hook: () => { isError: boolean }) => {
  apiMock.get.mockRejectedValue(serverError);
  const listener = vi.fn();
  window.addEventListener(QUERY_ERROR_EVENT, listener);
  try {
    const { result } = renderHook(hook, { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  } finally {
    window.removeEventListener(QUERY_ERROR_EVENT, listener);
  }
  return listener.mock.calls.length;
};

afterEach(() => {
  apiMock.get.mockReset();
});

const S = { silentError: true } as const;

describe("G2 so'rovlari — sahifadagi xato bilan global xabar takrorlanmaydi", () => {
  it.each<[string, () => { isError: boolean }]>([
    // Integratsiyalar
    ["integratsiya metrikasi", () => useIntegrationMetrics(undefined, S)],
    ["integratsiyalar ro'yxati", () => useGetIntegrations({ limit: 100 }, S)],
    ["integratsiya tafsiloti", () => useGetIntegrationById("7", S)],
    ["hamkorlar", () => usePartners(S)],
    ["hamkor webhooklari", () => usePartnerWebhooks({ page: 1, limit: 20 }, S)],
    ["to'lovlar jurnali", () => usePayments({ integrationId: "7", page: 1, limit: 20 }, S)],
    ["webhook jurnali", () => useWebhookLogs({ integrationId: "7", page: 1, limit: 20 }, S)],
    ["sinxronlash tarixi", () => useSyncHistory({ integrationId: "7", limit: 20 }, S)],
    ["debitor balansi", () => useReceivableBalance("7", S)],
    ["debitorlar", () => useReceivables({ integrationId: "7", page: 1, limit: 20 }, S)],
    ["olingan to'lovlar (IS-3)", () => useRemittances({ integrationId: "7", page: 1, limit: 10 }, S)],
    ["posilkalar (chiquvchi)", () => useProviderShipments({ integrationId: "7", page: 1 }, S)],
    ["posilkalar (hamkor)", () => usePartnerShipments({ partnerId: "7", page: 1 }, S)],
    // Bildirishnomalar
    ["Telegram guruhlari", () => useNotifications({ page: 1, limit: 10 }, S)],
    ["SMS holati", () => useSmsStatus(S)],
    ["SMS shablonlari", () => useSmsTemplates(S)],
    ["SMS kampaniyalar tarixi", () => useSmsCampaigns(S)],
    ["SMS akkauntlari", () => useSmsAccounts(true, S)],
    ["SMS hisoboti", () => useSmsReport("2026-10-01", "2026-10-08", S)],
    // Tizim
    ["faoliyat jurnali", () => useActivityLogs({ page: 1, limit: 20 }, S)],
    [
      "operator balansi",
      () => useFinanceCoverage().useGetOperatorBalance("3", true, S),
    ],
    [
      "operator daromadi",
      () => useFinanceCoverage().useGetOperatorEarnings("3", true, { limit: 10 }, S),
    ],
    [
      "operator to'lovlari",
      () => useFinanceCoverage().useGetOperatorPayouts("3", true, { limit: 10 }, S),
    ],
    ["filial yangi buyurtmalari (ops)", () => useBranchCoverage().useGetNewOrders(undefined, S)],
    ["adminlar (ops)", () => useIdentityCoverage().useGetAdmins(undefined, S)],
    ["menejerlar (ops)", () => useIdentityCoverage().useGetManagers(undefined, S)],
    ["registratorlar (ops)", () => useIdentityCoverage().useGetRegistrators(undefined, S)],
    ["debitorlar (ops)", () => useIntegrationsCoverage().useGetReceivables({ page: 1 }, S)],
    ["investorlar (ops)", () => useInvestors().useGetInvestors({ page: 1, limit: 20 }, S)],
    [
      "qaytarish so'rovlari (ops)",
      () => useLogisticsCoverage().useGetReturnRequestsList(undefined, S),
    ],
    ["tizim KPI (ops)", () => useMiscCoverage().useGetAnalyticsKpi(undefined, S)],
    ["tizim holati — readiness (ops)", () => useMiscCoverage().useGetHealthReadiness(S)],
    ["token bo'yicha skan (ops)", () => useMiscCoverage().useGetScanByToken("abc", true, S)],
    // Hisob
    ["profil", () => useUser().useGetMyProfile(S)],
    ["bildirishnomalar qutisi", () => useInboxList({ page: 1, limit: 20 }, S)],
    // Investor kabineti (IN-1): sahifa 403 / 404 / 409 holat ekranlari va `ErrorState` ni o'zi chizadi.
    ["investor bosh sahifasi", () => useInvestorDashboard(12, S)],
    ["investorning investitsiyalari", () => useInvestorInvestments({ limit: 3 }, S)],
    ["investorning foyda tarixi", () => useInvestorProfits({ limit: 5 }, S)],
  ])("%s — global xabar yo'q", async (_name, hook) => {
    expect(await globalErrorsOf(hook)).toBe(0);
  });

  it.each<[string, () => { isError: boolean }]>([
    ["bildirishnomalar qutisi (qo'ng'iroqcha)", () => useInboxList({ page: 1, limit: 5 })],
    ["hamkorlar", () => usePartners()],
    ["integratsiyalar ro'yxati", () => useGetIntegrations({ limit: 100 })],
    ["profil", () => useUser().useGetMyProfile()],
    ["SMS shablonlari", () => useSmsTemplates()],
  ])("%s — bayroqsiz boshqa iste'molchilar uchun global xabar avvalgidek", async (_name, hook) => {
    expect(await globalErrorsOf(hook)).toBe(1);
  });
});
