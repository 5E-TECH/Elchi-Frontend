import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileClock,
  LayoutDashboard,
  Loader2,
  Plus,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
} from 'lucide-react';
import { CATEGORY_LABEL, ROLE_META } from '../../entities/integrations';
import {
  connectionHealth,
  fmtMetric,
  metricsByUid,
  useIntegrationMetrics,
  type ConnectionHealth,
} from '../../entities/integrations/metrics';
import ConnectionSubNav, { type SubNavItem } from './ConnectionSubNav';
import { ROLE_ORDER } from './connections';
import {
  fieldsFor,
  groupByRole,
  isConfigured,
  useConnections,
  type Connection,
} from './useConnections';
import ConnectionOverview from './panels/ConnectionOverview';
import ConnectionSettings from './panels/ConnectionSettings';
import ConnectionSecurity from './panels/ConnectionSecurity';
import ConnectionLog from './panels/ConnectionLog';
import ConnectionMetricRow from './panels/ConnectionMetricRow';

/**
 * KONSOL — bitta ulanish bilan ishlash yuzasi.
 *
 * JOYLASHUV: chapda ro'yxat, o'ngda tafsilot.
 *
 *   ┌──────────────┬────────────────────────────────┐
 *   │ qidiruv      │ Beepost                  ● ok  │
 *   │              │ ─────────────────────────────  │
 *   │ MANBA        │ [metrika: 6 hujayra]           │
 *   │ ● Beepost 98%│ ─────────────────────────────  │
 *   │ ● Uzum    —  │ Umumiy · Sozlama · Hodisa ·    │
 *   │              │ Xavfsizlik                     │
 *   │ TASHUVCHI    │ ─────────────────────────────  │
 *   │ ● LDG    ok  │ <panel>                        │
 *   └──────────────┴────────────────────────────────┘
 *
 * NEGA CHAPDA USTUN, tepada gorizontal chip emas. Chiplar tepada turganda
 * ro'yxat uzayishi bilan ikkinchi qatorga tushib, panelni pastga surardi va
 * ulanish almashtirish uchun har safar yuqoriga scroll qilish kerak edi.
 * Ustunda esa ro'yxat va tafsilot bir vaqtda ko'rinadi — solishtirish uchun
 * ham qulay ("Beepostda 98%, Uzumda nega 40%?").
 *
 * ⚠️ `lg` dan kichik ekranda ustun gorizontal lentaga aylanadi: telefonda
 * 260px yon ustun tafsilotga joy qoldirmaydi.
 *
 * ⚠️ Tanlangan ulanish URL'da (`?c=partner:7`) — Manzara jadvalidan
 * "Ochish" aynan shu manzilga o'tadi, sahifa yangilanishi tanlovni
 * yo'qotmaydi.
 */

const HEALTH_DOT: Record<ConnectionHealth, string> = {
  ok: 'bg-emerald-500',
  attention: 'bg-amber-500',
  off: 'bg-red-500',
};

const ConnectionsPage = () => {
  const { connections, isLoading, isError, partialError, refetch } =
    useConnections();
  const metricsQuery = useIntegrationMetrics();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState('overview');
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const byUid = useMemo(
    () => metricsByUid(metricsQuery.data),
    [metricsQuery.data],
  );

  const activeUid = searchParams.get('c') ?? '';
  const active = useMemo(
    () => connections.find((c) => c.uid === activeUid) ?? connections[0],
    [connections, activeUid],
  );

  /**
   * Ro'yxat yuklangach URL'ni birinchi ulanish bilan to'ldiramiz — aks holda
   * panel ko'rinib turadi-yu, URL bo'sh qoladi va sahifani yangilaganda
   * boshqa ulanishga o'tib ketishi mumkin.
   */
  useEffect(() => {
    if (!activeUid && active) {
      const next = new URLSearchParams(searchParams);
      next.set('c', active.uid);
      setSearchParams(next, { replace: true });
    }
  }, [activeUid, active, searchParams, setSearchParams]);

  const select = (uid: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('c', uid);
    setSearchParams(next, { replace: true });
    // Yangi ulanishga o'tganda birinchi tabga qaytamiz: "Hodisalar" tabida
    // turib boshqa ulanishga o'tish chalkash bo'lardi.
    setTab('overview');
  };

  /**
   * Qidiruv FAQAT chap ro'yxatni filtrlaydi, tanlovni o'zgartirmaydi.
   * Tanlangan ulanish filtrga tushmasa ham panel ochiq qoladi — aks holda
   * yozishni boshlash bilan panel yo'qolib ketardi.
   */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return connections;
    return connections.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.subtitle.toLowerCase().includes(q),
    );
  }, [connections, query]);

  const groups = groupByRole(filtered, ROLE_ORDER);

  const fields = useMemo(
    () => (active ? fieldsFor(active) : []),
    [active],
  );

  const items: SubNavItem[] = active
    ? [
        {
          key: 'overview',
          label: 'Umumiy holat',
          icon: <LayoutDashboard className="h-4 w-4" />,
          desc: 'Tayyorlik',
          content: <ConnectionOverview connection={active} />,
        },
        {
          key: 'settings',
          label: 'Sozlamalar',
          icon: <SettingsIcon className="h-4 w-4" />,
          desc: 'Qanday ishlaydi',
          content: (
            <ConnectionSettings
              connection={active}
              fields={fields}
              onSaved={refetch}
            />
          ),
        },
        {
          key: 'log',
          label: 'Hodisalar',
          icon: <FileClock className="h-4 w-4" />,
          desc: 'Yetdimi, nega yiqildi',
          content: <ConnectionLog connection={active} />,
        },
        {
          key: 'security',
          label: 'Xavfsizlik',
          icon: <ShieldCheck className="h-4 w-4" />,
          desc: 'Kim tegishi mumkin',
          content: (
            <ConnectionSecurity
              connection={active}
              fields={fields}
              onSaved={refetch}
            />
          ),
        },
      ]
    : [];

  const activeItem = items.find((i) => i.key === tab) ?? items[0];

  if (isLoading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Loader2 className="animate-spin text-main" size={26} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm font-semibold text-red-700 dark:text-red-300">
        Ulanishlar ro'yxatini olib bo'lmadi.
        <button
          type="button"
          onClick={refetch}
          className="ml-2 underline underline-offset-2"
        >
          Qayta urinish
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Qismiy xato — ro'yxat to'liq emasligini AYTISH kerak, aks holda
          operator "ulanish yo'q" deb o'ylardi. */}
      {partialError && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
          Ro'yxatning bir qismini olib bo'lmadi — hamma ulanish ko'rinmayotgan
          bo'lishi mumkin.
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[260px_1fr] lg:items-start">
        {/* ═══════ CHAP USTUN ═══════ */}
        <aside className="rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-3 shadow-sm dark:bg-primarydark lg:sticky lg:top-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--color-text-muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ulanish qidirish"
              className="h-9 w-full rounded-xl border border-[color:var(--color-border-soft)] bg-white pl-9 pr-3 text-xs font-semibold text-maindark outline-none focus:border-main dark:bg-white/[0.04] dark:text-white"
            />
          </div>

          {connections.length === 0 ? (
            <p className="m-0 mt-3 text-xs text-[color:var(--color-text-muted)]">
              Hali ulanish yo'q.
            </p>
          ) : filtered.length === 0 ? (
            <p className="m-0 mt-3 text-xs text-[color:var(--color-text-muted)]">
              "{query}" bo'yicha topilmadi.
            </p>
          ) : (
            /* Telefonda gorizontal lenta, katta ekranda vertikal ustun. */
            <div className="mt-3 flex gap-3 overflow-x-auto pb-1 lg:block lg:space-y-3 lg:overflow-visible lg:pb-0">
              {groups.map((group) => (
                <div key={group.role} className="min-w-[200px] lg:min-w-0">
                  <p
                    className="m-0 mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]"
                    title={ROLE_META[group.role].hint}
                  >
                    {ROLE_META[group.role].label}
                  </p>
                  <div className="flex gap-2 lg:flex-col">
                    {group.items.map((c) => (
                      <RailItem
                        key={c.uid}
                        connection={c}
                        active={c.uid === active?.uid}
                        rate={fmtMetric(byUid.get(c.uid)?.success_rate, '%')}
                        health={connectionHealth({
                          isActive: c.is_active,
                          configured: isConfigured(c),
                          metrics: byUid.get(c.uid),
                        })}
                        onClick={() => select(c.uid)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate('/integrations/new')}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-main/50 px-3 py-2 text-xs font-bold text-main transition hover:bg-main/5"
          >
            <Plus className="h-3.5 w-3.5" />
            Yangi ulanish
          </button>
        </aside>

        {/* ═══════ O'NG TAFSILOT ═══════ */}
        {active && activeItem ? (
          <div className="min-w-0 space-y-3">
            <ConnectionMetricRow
              metrics={byUid.get(active.uid)}
              isLoading={metricsQuery.isLoading}
            />
            <ConnectionSubNav
              items={items}
              active={activeItem.key}
              onChange={setTab}
            />
            <div>{activeItem.content}</div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[color:var(--color-border-soft)] p-8 text-center">
            <p className="m-0 text-sm font-semibold text-maindark dark:text-white">
              Hali ulanish yo'q
            </p>
            <p className="m-0 mt-1 text-xs text-[color:var(--color-text-muted)]">
              Birinchi ulanishni qo'shish uchun "Yangi ulanish".
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

/** Chap ustundagi bitta qator. */
const RailItem = ({
  connection,
  active,
  rate,
  health,
  onClick,
}: {
  connection: Connection;
  active: boolean;
  rate: string;
  health: ConnectionHealth;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={active ? 'true' : undefined}
    className={`flex w-full min-w-[190px] shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition lg:min-w-0 ${
      active
        ? 'border-main bg-main/10'
        : 'border-[color:var(--color-border-soft)] bg-white hover:border-main/40 dark:bg-white/[0.04]'
    }`}
  >
    {/* Holat nuqtasi — `connectionHealth` yagona qoidasidan keladi. */}
    <span
      className={`h-2 w-2 shrink-0 rounded-full ${HEALTH_DOT[health]}`}
      title={
        health === 'ok'
          ? 'Ishlayapti'
          : health === 'off'
            ? "O'chirilgan"
            : "E'tibor kerak"
      }
    />
    <span className="min-w-0 flex-1">
      <span
        className={`block truncate text-xs font-bold ${
          active ? 'text-main' : 'text-maindark dark:text-primary'
        }`}
      >
        {connection.name}
      </span>
      <span className="block truncate text-[10px] text-[color:var(--color-text-muted)]">
        {CATEGORY_LABEL[connection.category]}
      </span>
    </span>
    {/* Muvaffaqiyat foizi — o'lchanmagan bo'lsa "—". */}
    <span className="shrink-0 text-[10px] font-bold tabular-nums text-[color:var(--color-text-muted)]">
      {rate}
    </span>
  </button>
);

export default ConnectionsPage;
