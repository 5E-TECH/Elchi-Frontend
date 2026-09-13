import { useState } from 'react';
import { Loader2, RefreshCw, RotateCw } from 'lucide-react';
import {
  usePartnerActions,
  usePartnerWebhooks,
} from '../../../entities/partners';
import {
  syncWhen,
  useSyncHistory,
  type SyncHistoryRow,
} from '../../../entities/integrations/syncHistory';
import type { Connection } from '../useConnections';

/**
 * JURNAL — ulanish bo'yicha hodisalar.
 *
 * Manba TURGA qarab boshqa, chunki hodisaning o'zi boshqa:
 *   inbound  (`partner`)     — BIZ yuborgan webhooklar (outbox): yetdimi,
 *                              necha urinish, nega yiqildi
 *   outbound (`integration`) — biz yuborgan so'rovlar tarixi
 *
 * IKKI MANBA — IKKI KO'RINISH, bitta jadval emas. Maydonlari umuman boshqa:
 * outbox'da "necha urinish / nega yiqildi", sync_history'da "nechta buyurtma
 * tortildi". Ularni bitta jadvalga tiqish uchun ustunlarni umumlashtirish
 * kerak bo'lardi va natijada ikkisi ham ma'nosini yo'qotardi.
 */

const STATUS_TONE: Record<string, string> = {
  completed: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  pending: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
  processing: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
  awaiting_config: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
  permanently_failed: 'bg-red-500/12 text-red-700 dark:text-red-300',
};

const STATUS_LABEL: Record<string, string> = {
  completed: 'yetkazildi',
  pending: 'navbatda',
  processing: 'yuborilmoqda',
  awaiting_config: 'sozlama kutilmoqda',
  permanently_failed: 'yetkazilmadi',
};

const when = (v?: string | null) =>
  v ? new Date(v).toLocaleString('uz-UZ') : '—';

const ConnectionLog = ({ connection }: { connection: Connection }) => {
  const [status, setStatus] = useState('all');
  const isPartner = connection.kind === 'partner';

  const webhooks = usePartnerWebhooks({
    partner_id: isPartner ? connection.id : undefined,
    status,
    page: 1,
    limit: 20,
  });
  const { retryWebhook } = usePartnerActions();

  if (!isPartner) {
    return <OutboundLog connection={connection} />;
  }

  const rows = webhooks.data?.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-xl border border-gray-200 dark:border-gray-700 bg-white px-3 text-xs font-semibold text-gray-700 dark:bg-gray-800/50 dark:text-gray-200"
        >
          <option value="all">Barcha holat</option>
          <option value="pending">Navbatda</option>
          <option value="processing">Yuborilmoqda</option>
          <option value="completed">Yetkazildi</option>
          <option value="awaiting_config">Sozlama kutilmoqda</option>
          <option value="permanently_failed">Yetkazilmadi</option>
        </select>

        <button
          type="button"
          onClick={() => void webhooks.refetch()}
          disabled={webhooks.isFetching}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 px-3 text-xs font-bold text-gray-700 disabled:opacity-50 dark:text-gray-200"
        >
          {webhooks.isFetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Yangilash
        </button>
      </div>

      {webhooks.isLoading ? (
        <div className="flex min-h-[120px] items-center justify-center">
          <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400" size={22} />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white p-6 text-center text-sm text-gray-500 dark:text-gray-400 dark:bg-gray-800/50">
          Hodisa yo'q
        </div>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                  STATUS_TONE[row.status] ??
                  'bg-white/10 text-gray-500 dark:text-gray-400'
                }`}
              >
                {STATUS_LABEL[row.status] ?? row.status}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-gray-800 dark:text-white">
                  {row.new_status ?? row.event_type ?? '—'}
                </span>
                <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">
                  {row.external_order_id ?? row.order_id} · {when(row.created_at)}
                  {row.attempts ? ` · ${row.attempts} urinish` : ''}
                </span>
              </span>

              {/* Xato matni MUHIM: "yetkazilmadi" o'zi sababni aytmaydi. */}
              {row.last_error && (
                <span className="w-full break-all text-[11px] text-red-600 dark:text-red-300">
                  {row.last_error}
                </span>
              )}

              {row.status !== 'completed' && (
                <button
                  type="button"
                  onClick={() => void retryWebhook.mutateAsync(String(row.id))}
                  disabled={retryWebhook.isPending}
                  title="Qayta navbatga qo'yish va darhol urinib ko'rish"
                  className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-indigo-500 px-2.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 disabled:opacity-40"
                >
                  <RotateCw className="h-3 w-3" />
                  Qayta
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * CHIQUVCHI JURNAL — biz tortib olgan sinxronlar (`sync_history`).
 *
 * Yuqorida xulosa qatori turadi, chunki "oxirgi 20 satr"ni o'qib chiqish
 * bilan "umuman ishlayaptimi" degan savolga javob bo'lmaydi.
 */
const OutboundLog = ({ connection }: { connection: Connection }) => {
  const [status, setStatus] = useState('all');
  const history = useSyncHistory({
    integrationId: connection.id,
    status,
    limit: 20,
  });

  const rows: SyncHistoryRow[] = history.data?.items ?? [];
  const summary = history.data?.summary;

  /**
   * ⚠️ Urinish bo'lmasa backend `success_rate: 0` qaytaradi. `0%` deb
   * ko'rsatish "hammasi yiqildi" degan YOLG'ON bo'lardi — aslida hali
   * urinish yo'q. Shu holda "—".
   */
  const rate =
    summary && summary.total_attempts > 0 ? `${summary.success_rate}%` : '—';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-xl border border-gray-200 dark:border-gray-700 bg-white px-3 text-xs font-semibold text-gray-700 dark:bg-gray-800/50 dark:text-gray-200"
        >
          <option value="all">Barcha holat</option>
          <option value="success">Muvaffaqiyatli</option>
          <option value="failed">Yiqilgan</option>
        </select>
        <button
          type="button"
          onClick={() => void history.refetch()}
          disabled={history.isFetching}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 px-3 text-xs font-bold text-gray-700 disabled:opacity-50 dark:text-gray-200"
        >
          {history.isFetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Yangilash
        </button>
      </div>

      {/* Xulosa — filtr bilan birga o'zgaradi, shuning uchun tepada. */}
      {summary && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Urinish', value: String(summary.total_attempts) },
            { label: 'Muvaffaqiyat', value: String(summary.success_count) },
            { label: 'Yiqilgan', value: String(summary.failed_count) },
            { label: 'Muvaffaqiyat %', value: rate },
          ].map((cell) => (
            <div
              key={cell.label}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white px-3 py-2 dark:bg-gray-800/50"
            >
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                {cell.label}
              </p>
              <p className="m-0 mt-0.5 text-base font-extrabold tabular-nums text-gray-800 dark:text-white">
                {cell.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {history.isLoading ? (
        <div className="flex min-h-[120px] items-center justify-center">
          <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400" size={22} />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white p-6 text-center text-sm text-gray-500 dark:text-gray-400 dark:bg-gray-800/50">
          Sinxron hodisasi yo'q
        </div>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50">
          {rows.map((row) => (
            <div
              key={String(row.id)}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                  row.status === 'success'
                    ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                    : row.status === 'failed'
                      ? 'bg-red-500/12 text-red-700 dark:text-red-300'
                      : 'bg-white/10 text-gray-500 dark:text-gray-400'
                }`}
              >
                {row.status === 'success'
                  ? 'muvaffaqiyatli'
                  : row.status === 'failed'
                    ? 'yiqildi'
                    : 'noma’lum'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-gray-800 dark:text-white">
                  {row.synced_orders} buyurtma tortildi
                </span>
                <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">
                  {syncWhen(row.sync_date)}
                </span>
              </span>
              {/*
                Xato matni `result` JSON ichida bo'lishi mumkin — "yiqildi"
                so'zi o'zi sababni aytmaydi.
              */}
              {row.status === 'failed' && row.result && (
                <span className="w-full break-all text-[11px] text-red-600 dark:text-red-300">
                  {typeof row.result.error === 'string'
                    ? row.result.error
                    : JSON.stringify(row.result).slice(0, 300)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConnectionLog;
