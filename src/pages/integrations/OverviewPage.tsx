import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, RefreshCw, Search } from 'lucide-react';
import {
  CATEGORY_LABEL,
  ROLE_META,
  connectionHealth,
  fmtMetric,
  metricsByUid,
  useIntegrationMetrics,
  type IntegrationRole,
} from '../../entities/integrations';
import { ROLE_ORDER } from './connections';
import { isConfigured, useConnections } from './useConnections';

/**
 * MANZARA — integratsiyalar bo'limining kirish nuqtasi.
 *
 * NEGA BU EKRAN. Ilgari bo'lim to'g'ridan-to'g'ri bitta ulanish paneliga
 * olib borardi va "hammasi qalay?" degan savolga javob beradigan joy YO'Q
 * edi. Operator har bir ulanishni navbatma-navbat ochib tekshirishi kerak
 * edi — 6 ulanishda bu 6 marta bosish, muammo esa faqat bittasida.
 *
 * Endi: yuqorida jami raqamlar, pastda jadval — muammoli ulanish birinchi
 * qarashda ko'rinadi.
 *
 * ⚠️ `null` VA 0 ARALASHTIRILMAYDI. Backend o'lchanmagan qiymatni `null`
 * qaytaradi va bu ekran uni "—" deb ko'rsatadi. `0` deb yozish "bir zumda
 * javob berdi" yoki "hammasi yiqildi" degan yolg'on xabar bo'lardi.
 */

const CARD =
  'rounded-2xl border border-[color:var(--color-border-soft)] bg-primary dark:bg-primarydark';
const MUTED = 'text-[color:var(--color-text-muted)]';

const ago = (iso: string | null) => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return 'hozir';
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'hozir';
  if (min < 60) return `${min} daq`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} soat`;
  return `${Math.floor(hr / 24)} kun`;
};

const HEALTH_DOT: Record<string, string> = {
  ok: 'bg-emerald-500',
  attention: 'bg-amber-500',
  off: 'bg-transparent border border-[color:var(--color-text-muted)]',
};

const OverviewPage = () => {
  const navigate = useNavigate();
  const { connections, isLoading, partialError, refetch } = useConnections();
  const metricsQuery = useIntegrationMetrics();
  const metrics = useMemo(
    () => metricsByUid(metricsQuery.data),
    [metricsQuery.data],
  );

  const [role, setRole] = useState<IntegrationRole | ''>('');
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return connections.filter((c) => {
      if (role && c.role !== role) return false;
      if (!needle) return true;
      return (
        c.name.toLowerCase().includes(needle) ||
        c.subtitle.toLowerCase().includes(needle)
      );
    });
  }, [connections, role, q]);

  const totals = metricsQuery.data?.totals;
  const activeCount = connections.filter((c) => c.is_active).length;

  /** Muammoli ulanishlar — yuqoridagi ogohlantirish uchun. */
  const troubled = connections.filter((c) => {
    const h = connectionHealth({
      isActive: c.is_active,
      configured: isConfigured(c),
      metrics: metrics.get(c.uid),
    });
    return h === 'attention';
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Loader2 className="animate-spin text-main" size={26} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {partialError && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
          Ro'yxatning bir qismini olib bo'lmadi — hamma ulanish ko'rinmayotgan
          bo'lishi mumkin.
        </div>
      )}

      {/* ═══════ METRIKA ═══════ */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Faol ulanish" value={`${activeCount} / ${connections.length}`} />
        <Metric
          label={`Hodisa · ${metricsQuery.data?.window_hours ?? 24} soat`}
          value={fmtMetric(totals?.events)}
        />
        <Metric label="Yetmagan" value={fmtMetric(totals?.failed)} tone={totals?.failed ? 'bad' : undefined} />
        <Metric label="Navbatda" value={fmtMetric(totals?.queued)} tone={totals?.queued ? 'warn' : undefined} />
      </div>

      {/* Muammoni NOMLAB aytadi — "3 xato bor" degan raqam o'zi yetarli emas,
          operator qaysi ulanishni ochishini bilishi kerak. */}
      {troubled.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
          ⚠ E'tibor kerak:{' '}
          {troubled.map((c) => c.name).join(' · ')}
        </div>
      )}

      {/* ═══════ FILTR ═══════ */}
      <div className="flex flex-wrap items-center gap-2">
        <div className={`flex items-center gap-2 rounded-xl border border-[color:var(--color-border-soft)] px-3 py-2 ${CARD} min-w-[180px] flex-1`}>
          <Search size={14} className={MUTED} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ulanish qidirish…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[color:var(--color-text-muted)]"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <RoleChip on={role === ''} onClick={() => setRole('')}>
            Hammasi
          </RoleChip>
          {ROLE_ORDER.map((r) => (
            <RoleChip key={r} on={role === r} onClick={() => setRole(r)} title={ROLE_META[r].hint}>
              {ROLE_META[r].label}
            </RoleChip>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            refetch();
            void metricsQuery.refetch();
          }}
          disabled={metricsQuery.isFetching}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-[color:var(--color-border-soft)] px-3 text-xs font-bold text-maindark disabled:opacity-50 dark:text-white"
        >
          {metricsQuery.isFetching ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          Yangilash
        </button>

        <button
          type="button"
          onClick={() => navigate('/integrations/new')}
          className="flex h-9 items-center gap-1.5 rounded-xl bg-main px-3.5 text-xs font-bold text-white"
        >
          <Plus size={14} />
          Yangi ulanish
        </button>
      </div>

      {/* ═══════ JADVAL ═══════ */}
      {connections.length === 0 ? (
        <EmptyState onAdd={() => navigate('/integrations/new')} />
      ) : rows.length === 0 ? (
        <div className={`${CARD} p-8 text-center text-sm ${MUTED}`}>
          Qidiruvga mos ulanish topilmadi.
        </div>
      ) : (
        <div className={`${CARD} overflow-x-auto`}>
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr>
                {['Ulanish', 'Rol', 'Oxirgi hodisa', 'Hodisa', 'Yetmagan', 'Javob', '']
                  .map((h, i) => (
                    <th
                      key={h + i}
                      className={`border-b border-[color:var(--color-border-soft)] px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] ${MUTED}`}
                    >
                      {h}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const mt = metrics.get(c.uid);
                const health = connectionHealth({
                  isActive: c.is_active,
                  configured: isConfigured(c),
                  metrics: mt,
                });
                return (
                  <tr key={c.uid}>
                    <td className="border-b border-[color:var(--color-border-soft)] px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${HEALTH_DOT[health]}`} />
                        <span className="min-w-0">
                          <span className="block truncate font-bold text-maindark dark:text-white">
                            {c.name}
                          </span>
                          <span className={`block truncate text-[11px] ${MUTED}`}>
                            {CATEGORY_LABEL[c.category]} · {c.subtitle}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="border-b border-[color:var(--color-border-soft)] px-3 py-2.5">
                      <span className="rounded-full bg-main/12 px-2 py-0.5 text-[10px] font-bold text-main">
                        {ROLE_META[c.role].label}
                      </span>
                    </td>
                    <td className={`border-b border-[color:var(--color-border-soft)] px-3 py-2.5 text-xs tabular-nums ${MUTED}`}>
                      {ago(mt?.last_event_at ?? null)}
                    </td>
                    <td className="border-b border-[color:var(--color-border-soft)] px-3 py-2.5 text-xs tabular-nums">
                      {fmtMetric(mt?.events)}
                    </td>
                    <td className="border-b border-[color:var(--color-border-soft)] px-3 py-2.5 text-xs tabular-nums">
                      {mt?.failed ? (
                        <span className="font-bold text-red-600 dark:text-red-300">
                          {mt.failed}
                        </span>
                      ) : (
                        <span className={MUTED}>{fmtMetric(mt?.failed)}</span>
                      )}
                    </td>
                    <td className={`border-b border-[color:var(--color-border-soft)] px-3 py-2.5 text-xs tabular-nums ${MUTED}`}>
                      {/* Outbound ulanishda javob vaqti o'lchanmaydi — "—". */}
                      {fmtMetric(mt?.avg_ms, ' ms')}
                    </td>
                    <td className="border-b border-[color:var(--color-border-soft)] px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/integrations/connections?c=${encodeURIComponent(c.uid)}`,
                          )
                        }
                        className="rounded-lg border border-[color:var(--color-border-soft)] px-2.5 py-1 text-[11px] font-bold text-maindark dark:text-white"
                      >
                        {isConfigured(c) ? 'Ochish' : 'Davom etish'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const Metric = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'bad' | 'warn';
}) => (
  <div className={`${CARD} px-4 py-3`}>
    <div className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${MUTED}`}>
      {label}
    </div>
    <div
      className={`mt-0.5 text-2xl font-bold tabular-nums ${
        tone === 'bad'
          ? 'text-red-600 dark:text-red-300'
          : tone === 'warn'
            ? 'text-amber-600 dark:text-amber-300'
            : 'text-maindark dark:text-white'
      }`}
    >
      {value}
    </div>
  </div>
);

const RoleChip = ({
  on,
  onClick,
  title,
  children,
}: {
  on: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
      on
        ? 'border-main bg-main text-white'
        : 'border-[color:var(--color-border-soft)] text-maindark/70 hover:border-main/40 dark:text-primary/70'
    }`}
  >
    {children}
  </button>
);

/**
 * Bo'sh holat — O'RGATADI, shunchaki "ma'lumot yo'q" demaydi.
 *
 * Birinchi ulanishni qo'shish eng chalkash payt: operator qaysi yo'nalishni
 * tanlashini bilmaydi. Shu bois bu yerda yo'nalish farqi ham tushuntiriladi.
 */
const EmptyState = ({ onAdd }: { onAdd: () => void }) => (
  <div className={`${CARD} flex flex-col items-center gap-3 p-10 text-center`}>
    <p className="m-0 text-base font-bold text-maindark dark:text-white">
      Hali ulanish yo'q
    </p>
    <p className={`m-0 max-w-sm text-sm ${MUTED}`}>
      Tashqi tizim ikki xil ulanadi: <strong>bizga buyurtma beradi</strong>{' '}
      (marketplace, CRM) yoki <strong>bizdan posilka oladi</strong>{' '}
      (yetkazuvchi). Yo'nalishni ulash paytida tanlaysiz.
    </p>
    <button
      type="button"
      onClick={onAdd}
      className="mt-1 flex items-center gap-1.5 rounded-xl bg-main px-4 py-2 text-sm font-bold text-white"
    >
      <Plus size={15} />
      Birinchi ulanishni qo'shish
    </button>
  </div>
);

export default OverviewPage;
