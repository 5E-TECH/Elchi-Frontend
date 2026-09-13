import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Cable,
  FileClock,
  LayoutDashboard,
  Loader2,
  Plus,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  Wallet,
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
import {
  fieldsFor,
  isConfigured,
  useConnections,
  type Connection,
} from './useConnections';
import ConnectionOverview from './panels/ConnectionOverview';
import ConnectionSettings from './panels/ConnectionSettings';
import ConnectionSecurity from './panels/ConnectionSecurity';
import ConnectionLog from './panels/ConnectionLog';
import ConnectionSettlement from './panels/ConnectionSettlement';
import ConnectionShipments from './panels/ConnectionShipments';
import ConnectionControl from './panels/ConnectionControl';
import {
  BORDER,
  CTA_BTN,
  ROLE_ICON_BG,
  FAINT,
  HEADER_ICON,
  HEALTH_DOT,
  MUTED,
  PAGE_SUBTITLE,
  PAGE_TITLE,
  SEARCH_INPUT,
  TITLE,
  chip,
  chipIcon,
  chipLabel,
} from './ui';

/**
 * ULANISHLAR KONSOLI — PCS (BeePost) sahifasining shakli.
 *
 *   CHIP QATORI (rol bo'yicha guruhlangan, INDIGO urg'u)
 *        ↓
 *   METRIKA QATORI (tanlangan ulanishning 24 soati)
 *        ↓
 *   SUB-NAV: Umumiy holat · Sozlamalar · Hodisalar · Xavfsizlik (VIOLET)
 *        ↓
 *   panel
 *
 * NEGA CHAP USTUNDAN QAYTDIK. Avvalgi variantda ro'yxat chapda vertikal
 * ustun edi. Foydalanuvchi ikki variantni ham ko'rib, PCS shaklini tanladi:
 * u yerda ranglar aniqroq va yozuvlar o'qiladi. Shu bois shakl ham,
 * palitra ham o'sha yerdan olindi (`ui.ts`).
 *
 * ⚠️ Tanlangan ulanish URL'da (`?c=partner:7`) — Manzara jadvalidan
 * "Ochish" aynan shu manzilga o'tadi va sahifa yangilanishi tanlovni
 * yo'qotmaydi.
 */
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
   * Qidiruv FAQAT chiplarni filtrlaydi, tanlovni o'zgartirmaydi. Tanlangan
   * ulanish filtrga tushmasa ham panel ochiq qoladi — aks holda yozishni
   * boshlash bilan panel yo'qolib ketardi.
   */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return connections;
    return connections.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q),
    );
  }, [connections, query]);

  const fields = useMemo(() => (active ? fieldsFor(active) : []), [active]);

  const items: SubNavItem[] = active
    ? [
        {
          key: 'overview',
          label: 'Umumiy holat',
          icon: <LayoutDashboard className="h-4 w-4" />,
          desc: 'Tayyorlik',
          content: (
            <ConnectionOverview
              connection={active}
              metrics={byUid.get(active.uid)}
            />
          ),
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
          key: 'shipments',
          label: "Jo'natmalar",
          icon: <Truck className="h-4 w-4" />,
          desc: 'Posilkalar va xatolar',
          content: <ConnectionShipments connection={active} />,
        },
        {
          key: 'log',
          label: 'Hodisalar',
          icon: <FileClock className="h-4 w-4" />,
          desc: 'Yetdimi, nega yiqildi',
          content: <ConnectionLog connection={active} />,
        },
        {
          /*
            HISOB-KITOB — foydalanuvchi talabi: "ikkala kassani solishtirish
            uchun". Chiquvchi ulanishda tashuvchi qarzi va to'lovlari, hamkorda
            esa daftar ularning tomonida (panel buni aytadi).
          */
          key: 'settlement',
          label: 'Hisob-kitob',
          icon: <Wallet className="h-4 w-4" />,
          desc: 'Qarz va to\'lovlar',
          content: <ConnectionSettlement connection={active} />,
        },
        {
          key: 'control',
          label: 'Boshqaruv',
          icon: <SlidersHorizontal className="h-4 w-4" />,
          desc: 'Kalitlar va jarayonlar',
          content: (
            <ConnectionControl connection={active} onChanged={refetch} />
          ),
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
        <Loader2 className="animate-spin text-indigo-500" size={26} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
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
    <div className="space-y-4">
      {/* Qismiy xato — ro'yxat to'liq emasligini AYTISH kerak, aks holda
          operator "ulanish yo'q" deb o'ylardi. */}
      {partialError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
          Ro'yxatning bir qismini olib bo'lmadi — hamma ulanish ko'rinmayotgan
          bo'lishi mumkin.
        </div>
      )}

      {/* ═══════ SARLAVHA — PCS shakli ═══════ */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className={HEADER_ICON}>
            <Cable className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className={`m-0 ${PAGE_TITLE}`}>Boshqaruv</h1>
            <p className={`m-0 ${PAGE_SUBTITLE}`}>
              Ulanishni tanlang va sozlang
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {connections.length > 4 && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Qidirish..."
                className={SEARCH_INPUT}
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => navigate('/integrations/new')}
            className={CTA_BTN}
          >
            <Plus className="h-5 w-5" />
            Yangi ulanish
          </button>
        </div>
      </div>

      {/* ═══════ ULANISH CHIPLARI ═══════ */}
      {connections.length === 0 ? (
        <div
          className={`rounded-xl border-2 border-dashed ${BORDER} p-8 text-center`}
        >
          <Cable className={`mx-auto h-8 w-8 ${FAINT}`} />
          <p className={`m-0 mt-3 text-sm font-bold ${TITLE}`}>
            Hali ulanish yo'q
          </p>
          <p className={`m-0 mt-1 text-xs ${MUTED}`}>
            Birinchi ulanishni qo'shish uchun "Yangi ulanish".
          </p>
          <button
            type="button"
            onClick={() => navigate('/integrations/new')}
            className="mx-auto mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25"
          >
            <Plus className="h-4 w-4" />
            Yangi ulanish
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <p className={`m-0 text-sm ${MUTED}`}>
          "{query}" bo'yicha topilmadi.
        </p>
      ) : (
        /*
          ⚠️ ROL BO'YICHA GURUHLASH OLIB TASHLANDI. Ilgari chiplar
          "Buyurtma manbalari" / "Yetkazuvchilar" degan sarlavhalar ostida
          alohida qatorlarda turardi. Foydalanuvchi buni so'radi: "alohida
          bo'lib turishi kerak emas, faqat icon yoki rang bilan ajralib
          tursa yetarli".
          
          Rol YO'QOLMADI — u chip ikonkasining rangiga ko'chdi va sarlavhada
          (tooltip) tushuntiriladi. Ro'yxat esa endi bitta qatorda, ya'ni
          ulanish almashtirish uchun pastga qarash kerak emas.
        */
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {filtered.map((c) => (
            <ConnectionChip
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

          {/* "+" oxirida — PCS'dagi naqsh. */}
          <button
            type="button"
            onClick={() => navigate('/integrations/new')}
            className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed ${BORDER} px-4 py-2.5 text-sm font-medium ${MUTED} transition-colors hover:border-indigo-300 hover:text-indigo-600`}
          >
            <Plus className="h-4 w-4" />
            Yangi
          </button>
        </div>
      )}

      {/*
        ═══════ TANLANGAN ULANISH ═══════

        ⚠️ DOIMIY METRIKA QATORI OLIB TASHLANDI. Raqamlar endi "Umumiy holat"
        paneli ichida `Statistic` bo'lib turadi — PCS `ElchiDashboardTab` shu
        naqshni ishlatadi. Ikki joyda ko'rsatish takror bo'lardi va sub-nav
        pastga surilardi.
      */}
      {active && activeItem && (
        <div className="space-y-4">
          <ConnectionSubNav
            items={items}
            active={activeItem.key}
            onChange={setTab}
          />
          <div>{activeItem.content}</div>
        </div>
      )}
    </div>
  );
};

/** Ro'yxatdagi bitta ulanish chipi — PCS `ProvidersTab` shakli. */
const ConnectionChip = ({
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
    className={chip(active)}
  >
    {/*
      Ikonka foni ROL rangida — guruh sarlavhasi o'rniga shu ajratadi.
      Tanlangan chipda esa to'liq urg'u rangi (indigo) qoladi, aks holda
      "qaysi biri tanlangan" savoli paydo bo'lardi.
    */}
    <span
      className={
        active
          ? chipIcon(true)
          : `${chipIcon(false)} ${ROLE_ICON_BG[connection.role] ?? ''}`
      }
      title={ROLE_META[connection.role].hint}
    >
      <Cable className="h-4 w-4" />
    </span>

    <span className="min-w-0">
      <span className="flex items-center gap-1.5">
        {/* Holat nuqtasi — `connectionHealth` yagona qoidasidan. */}
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
        <span className={`truncate ${chipLabel(active)}`}>
          {connection.name}
        </span>
      </span>
      <span className={`block truncate text-[11px] leading-tight ${FAINT}`}>
        {CATEGORY_LABEL[connection.category]} · {rate}
      </span>
    </span>
  </button>
);

export default ConnectionsPage;
