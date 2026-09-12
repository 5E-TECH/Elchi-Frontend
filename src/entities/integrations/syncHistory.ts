import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/api';
import { API_ENDPOINTS } from '../../shared/api';

/**
 * CHIQUVCHI ULANISHNING HODISALAR JURNALI (`sync_history`).
 *
 * NEGA ALOHIDA FAYL. `integrationsCoverage.ts` da bu endpoint uchun hook bor,
 * lekin u BITTA katta `useIntegrationsCoverage()` to'plami ichida — uni
 * chaqirish o'n-o'n beshta boshqa so'rov va mutatsiyani ham tirgizadi. Bir
 * panelga bitta so'rov kerak.
 *
 * ⚠️ INBOUND bilan ARALASHTIRMANG. Hamkor (inbound) hodisalari
 * `partner_webhook_outbox` da — BIZ yuborgan webhooklar. Bu jadval esa
 * teskarisi: BIZ tortib olgan sinxronlar. Ikkisining maydonlari ham boshqa,
 * shu bois bitta komponentda ikki manba emas, ikki ko'rinish chiziladi.
 */

export interface SyncHistoryRow {
  id: string | number;
  integration_id: string;
  integration_name: string;
  synced_orders: number;
  status: 'success' | 'failed' | null;
  result: Record<string, unknown> | null;
  /** Epoch millisekund. Postgres `bigint` — satr bo'lib kelishi MUMKIN. */
  sync_date: number | string | null;
  attempted_at: string | null;
}

export interface SyncHistorySummary {
  total_attempts: number;
  success_count: number;
  failed_count: number;
  /**
   * ⚠️ Backend urinish bo'lmasa `0` qaytaradi — bu "hammasi yiqildi" degan
   * ma'noni beradi, aslida "hali urinish yo'q". UI'da `total_attempts === 0`
   * bo'lsa bu qiymatga ISHONMASLIK kerak.
   */
  success_rate: number;
}

export interface SyncHistoryPage {
  items: SyncHistoryRow[];
  summary: SyncHistorySummary;
}

const EMPTY: SyncHistoryPage = {
  items: [],
  summary: {
    total_attempts: 0,
    success_count: 0,
    failed_count: 0,
    success_rate: 0,
  },
};

/** `{statusCode,message,data:{...}}` — qatlam soni o'zgarsa ham sinmasin. */
const unwrap = (raw: unknown): SyncHistoryPage => {
  const outer = raw as { data?: unknown };
  const first = outer?.data ?? raw;
  const inner = (first as { data?: unknown })?.data ?? first;
  const page = inner as Partial<SyncHistoryPage> | undefined;
  return {
    items: Array.isArray(page?.items) ? page!.items : [],
    summary: page?.summary ?? EMPTY.summary,
  };
};

export const syncHistoryKey = 'integration-sync-history';

export const useSyncHistory = (params: {
  integrationId?: string;
  status?: string;
  limit?: number;
}) =>
  useQuery({
    queryKey: [syncHistoryKey, params.integrationId, params.status, params.limit],
    // Chiquvchi ulanish bo'lmasa so'rov yuborilmaydi.
    enabled: Boolean(params.integrationId),
    queryFn: () =>
      api
        .get(API_ENDPOINTS.INTEGRATIONS.SYNC_HISTORY_BY_ID(params.integrationId!), {
          params: {
            // Backend faqat `success`/`failed` ni tanadi; qolgani e'tiborsiz.
            ...(params.status && params.status !== 'all'
              ? { status: params.status }
              : {}),
            limit: params.limit ?? 20,
          },
        })
        .then((res) => unwrap(res.data)),
    staleTime: 15_000,
  });

/** Epoch (son yoki satr) → o'qiladigan sana. Yaroqsiz bo'lsa "—". */
export const syncWhen = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '—';
  const ms = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  return new Date(ms).toLocaleString('uz-UZ');
};
