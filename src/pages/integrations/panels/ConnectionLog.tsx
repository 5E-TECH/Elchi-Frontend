import { useState } from 'react';
import { Loader2, RefreshCw, RotateCw } from 'lucide-react';
import {
  usePartnerActions,
  usePartnerWebhooks,
} from '../../../entities/partners';
import type { Connection } from '../useConnections';

/**
 * JURNAL — ulanish bo'yicha hodisalar.
 *
 * Manba TURGA qarab boshqa, chunki hodisaning o'zi boshqa:
 *   inbound  (`partner`)     — BIZ yuborgan webhooklar (outbox): yetdimi,
 *                              necha urinish, nega yiqildi
 *   outbound (`integration`) — biz yuborgan so'rovlar tarixi
 *
 * ⚠️ Outbound uchun bu panel hozircha BO'SH HOLAT ko'rsatadi. Sinxron tarixi
 * endpointi bor (`integrations/:id/sync-history`), lekin uni bu yerga ulash
 * alohida ish — va yo'qligini YASHIRISH o'rniga ochiq aytish to'g'ri:
 * "jurnal hali ulanmagan" degan xabar "hodisa yo'q" degan yolg'on xabardan
 * yaxshi.
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
    return (
      <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-6 text-center dark:bg-primarydark">
        <p className="m-0 text-sm font-semibold text-maindark dark:text-white">
          Bu ulanish uchun jurnal hali ulanmagan
        </p>
        <p className="m-0 mt-1 text-xs text-[color:var(--color-text-muted)]">
          Sinxron tarixi backendda mavjud, lekin bu panelga hali bog'lanmagan.
          "Hodisa yo'q" deb ko'rsatish chalg'ituvchi bo'lardi.
        </p>
      </div>
    );
  }

  const rows = webhooks.data?.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-xl border border-[color:var(--color-border-soft)] bg-white px-3 text-xs font-semibold text-maindark dark:bg-white/[0.04] dark:text-white"
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
          className="flex h-9 items-center gap-1.5 rounded-xl border border-[color:var(--color-border-soft)] px-3 text-xs font-bold text-maindark disabled:opacity-50 dark:text-white"
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
          <Loader2 className="animate-spin text-main" size={22} />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-6 text-center text-sm text-[color:var(--color-text-muted)] dark:bg-primarydark">
          Hodisa yo'q
        </div>
      ) : (
        <div className="divide-y divide-[color:var(--color-border-soft)] overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-primary dark:bg-primarydark">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                  STATUS_TONE[row.status] ??
                  'bg-white/10 text-[color:var(--color-text-muted)]'
                }`}
              >
                {STATUS_LABEL[row.status] ?? row.status}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-maindark dark:text-white">
                  {row.new_status ?? row.event_type ?? '—'}
                </span>
                <span className="block truncate text-[11px] text-[color:var(--color-text-muted)]">
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
                  className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-main px-2.5 text-[11px] font-bold text-main disabled:opacity-40"
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

export default ConnectionLog;
