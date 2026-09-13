import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  CheckCircle,
  Cable,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Unlink,
  XCircle,
} from 'lucide-react';
import { CATEGORY_LABEL, ROLE_META } from '../../entities/integrations';
import {
  connectionHealth,
  fmtMetric,
  metricsByUid,
  useIntegrationMetrics,
  type ConnectionHealth,
  type ConnectionMetrics,
} from '../../entities/integrations/metrics';
import { isConfigured, useConnections, type Connection } from './useConnections';
import { Tag } from 'antd';
import {
  CARD_FOOTER,
  CTA_BTN,
  ROLE_ICON_BG,
  ROLE_TAG_COLOR,
  HEADER_ICON,
  PAGE_SUBTITLE,
  PAGE_TITLE,
  SEARCH_INPUT,
  cardHeader,
  cardShell,
  softBtn,
} from './ui';

/**
 * INTEGRATSIYALAR — kartalar to'ri.
 *
 * Bu yuza PCS (BeePost) `pages/integrations/index.tsx` sahifasidan
 * KO'CHIRILDI: sahifa sarlavhasi (gradient ikonka + qidiruv + gradient
 * tugma), kartalar to'ri (holat gradienti bilan sarlavha, ikonka+yozuv
 * qatorlari, rangli yumshoq amal tugmalari) va bo'sh holat — hammasi
 * o'sha yerdagi shakl.
 *
 * NEGA. Avval bu yer jadval edi va undan oldin chiplar ro'yxati. Ikki
 * variant ham foydalanuvchiga yoqmadi: "UI tomonlama Beepostniki yaxshiroq".
 * Shu bois shakl o'ylab topilmaydi — tasdiqlangan joydan olinadi.
 *
 * ⚠️ BITTA ATAYLAB QILINGAN FARQ. PCS kartasida ikki holat bor
 * (faol/nofaol). Bizda uchta, chunki `connectionHealth` "sozlama to'g'ri,
 * lekin hodisalar yetmayapti" holatini ham ajratadi — metrika aynan shu
 * holat uchun qo'shilgan edi. Uni yashil ko'rsatish muammoni yashirardi.
 */

const HEALTH_TEXT: Record<ConnectionHealth, string> = {
  ok: 'Ishlayapti',
  attention: "E'tibor kerak",
  off: "O'chirilgan",
};

const OverviewPage = () => {
  const navigate = useNavigate();
  const { connections, isLoading, partialError, refetch } = useConnections();
  const metricsQuery = useIntegrationMetrics();
  const metrics = useMemo(
    () => metricsByUid(metricsQuery.data),
    [metricsQuery.data],
  );
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? connections.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.subtitle.toLowerCase().includes(q),
        )
      : connections;

    /**
     * E'tibor kerak bo'lganlar YUQORIDA. Ro'yxat uzun bo'lsa, muammoli
     * ulanish oxirida qolib e'tibordan chetda qolardi.
     */
    const weight: Record<ConnectionHealth, number> = {
      attention: 0,
      off: 1,
      ok: 2,
    };
    return [...list].sort(
      (a, b) => weight[healthOf(a, metrics)] - weight[healthOf(b, metrics)],
    );
  }, [connections, query, metrics]);

  const totals = metricsQuery.data?.totals;
  const failedCount = totals?.failed ?? 0;

  return (
    <div>
      {/* ═══════════ SARLAVHA ═══════════ */}
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className={HEADER_ICON}>
            <Settings className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className={`m-0 ${PAGE_TITLE}`}>Integratsiyalar</h1>
            <p className={`m-0 ${PAGE_SUBTITLE}`}>
              Tashqi tizimlar bilan ulanishlarni boshqarish
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Qidirish..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={SEARCH_INPUT}
            />
          </div>

          {/*
            Hodisalar holati — PCS'dagi "Sync Monitor" naqshi: yetmagan
            hodisa bo'lsa sariq, bo'lmasa yashil. Raqam tugmaning ichida,
            chunki "nechta" degan savol "bormi" dan keyin darhol keladi.
          */}
          <button
            type="button"
            onClick={() => void metricsQuery.refetch()}
            disabled={metricsQuery.isFetching}
            title="Oxirgi 24 soatdagi hodisalar"
            className={`${softBtn(failedCount > 0 ? 'amber' : 'green')} px-4 py-2.5`}
          >
            {metricsQuery.isFetching ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Activity className="h-5 w-5" />
            )}
            <span className="hidden sm:inline">
              {failedCount > 0
                ? `${failedCount} hodisa yetmadi`
                : 'Hodisalar joyida'}
            </span>
          </button>

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

      {/* Qismiy xato — ro'yxat to'liq emasligini AYTISH kerak. */}
      {partialError && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
          Ro'yxatning bir qismini olib bo'lmadi — hamma ulanish ko'rinmayotgan
          bo'lishi mumkin.
        </div>
      )}

      {/* ═══════════ RO'YXAT ═══════════ */}
      {isLoading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="animate-spin text-blue-500" size={28} />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Unlink className="mb-4 h-16 w-16 text-gray-300 dark:text-gray-600" />
          <h3 className="mb-2 text-lg font-semibold text-gray-700 dark:text-gray-300">
            {query ? 'Ulanish topilmadi' : "Ulanishlar yo'q"}
          </h3>
          <p className="max-w-md text-center text-gray-500 dark:text-gray-400">
            {query
              ? `"${query}" bo'yicha hech narsa topilmadi`
              : "Hozircha ulanish yo'q. Yangi qo'shish uchun tugmani bosing."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <ConnectionCard
              key={c.uid}
              connection={c}
              metrics={metrics.get(c.uid)}
              onOpen={() =>
                navigate(
                  `/integrations/connections?c=${encodeURIComponent(c.uid)}`,
                )
              }
              onRefresh={refetch}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/** Holat — `connectionHealth` yagona qoidasi. */
const healthOf = (
  c: Connection,
  metrics: Map<string, ConnectionMetrics>,
): ConnectionHealth =>
  connectionHealth({
    isActive: c.is_active,
    configured: isConfigured(c),
    metrics: metrics.get(c.uid),
  });

const ConnectionCard = ({
  connection,
  metrics,
  onOpen,
  onRefresh,
}: {
  connection: Connection;
  metrics?: ConnectionMetrics;
  onOpen: () => void;
  onRefresh: () => void;
}) => {
  const health = connectionHealth({
    isActive: connection.is_active,
    configured: isConfigured(connection),
    metrics,
  });
  const configured = isConfigured(connection);

  return (
    <div className={cardShell(!connection.is_active)}>
      {/* ── Sarlavha: holat gradienti ── */}
      <div className={cardHeader(health)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {/*
              Ikonka foni ROL rangida. Foydalanuvchi guruh sarlavhalarini
              olib tashlashni so'radi ("faqat icon yoki rang bilan ajralib
              tursa yetarli") — rol shu yerda va Tag'da qoladi.
            */}
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                ROLE_ICON_BG[connection.role] ?? 'bg-white/20'
              }`}
            >
              <Cable className="h-4 w-4 text-white" />
            </span>
            <h3 className="m-0 truncate text-lg font-bold text-white">
              {connection.name}
            </h3>
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-lg bg-white/20 px-2 py-1 text-xs font-medium text-white">
            {health === 'ok' ? (
              <CheckCircle className="h-3.5 w-3.5" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
            {HEALTH_TEXT[health]}
          </span>
        </div>
      </div>

      {/* ── Tana ── */}
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag color={ROLE_TAG_COLOR[connection.role]}>
            {ROLE_META[connection.role].label}
          </Tag>
          <Tag>{CATEGORY_LABEL[connection.category]}</Tag>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Link2 className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="truncate text-xs text-gray-500 dark:text-gray-400">
            {connection.subtitle}
          </span>
        </div>

        {/*
          Raqamlar — `fmtMetric` orqali: o'lchanmagan qiymat "—", hech qachon
          `0`. `0%` "hammasi yiqildi", `0 ms` "bir zumda javob berdi" degan
          yolg'on xabar bo'lardi.
        */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-2 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            24 soatda:{' '}
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              {metrics?.events ?? 0}
            </span>{' '}
            hodisa
            {(metrics?.failed ?? 0) > 0 && (
              <span className="ml-1 font-semibold text-red-600 dark:text-red-400">
                · {metrics!.failed} yetmadi
              </span>
            )}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {fmtMetric(metrics?.success_rate, '%')}
          </span>
        </div>
      </div>

      {/* ── Amallar ── */}
      <div className={CARD_FOOTER}>
        <button
          type="button"
          onClick={onOpen}
          className={`${softBtn('blue')} flex-1`}
        >
          <Settings className="h-4 w-4" />
          {/*
            Sozlamasi tugallanmagan ulanishda "Ochish" emas, "Davom etish" —
            operator nima qilish kerakligini tugmadan biladi.
          */}
          {configured ? 'Boshqarish' : 'Davom etish'}
        </button>

        <button
          type="button"
          onClick={onRefresh}
          title="Ro'yxatni yangilash"
          className={`${softBtn('gray')} shrink-0`}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default OverviewPage;
