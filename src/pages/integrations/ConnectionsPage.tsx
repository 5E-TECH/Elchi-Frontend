import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FileClock,
  LayoutDashboard,
  Loader2,
  Plug,
  Plus,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  Wallet,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { CATEGORY_LABEL, ROLE_META, integrationKeys } from "../../entities/integrations";
import {
  connectionHealth,
  fmtMetric,
  metricsByUid,
  metricsKey,
  useIntegrationMetrics,
  type ConnectionHealth,
} from "../../entities/integrations/metrics";
import { settlementKey } from "../../entities/integrations/settlement";
import { partnersKey } from "../../entities/partners";
import ConnectionSubNav, { type SubNavItem } from "./ConnectionSubNav";
import { fieldsFor, isConfigured, useConnections, type Connection } from "./useConnections";
import ConnectionOverview from "./panels/ConnectionOverview";
import ConnectionSettings from "./panels/ConnectionSettings";
import ConnectionSecurity from "./panels/ConnectionSecurity";
import ConnectionLog from "./panels/ConnectionLog";
import ConnectionSettlement from "./panels/ConnectionSettlement";
import ConnectionShipments from "./panels/ConnectionShipments";
import ConnectionControl from "./panels/ConnectionControl";
import NewPartnerModal from "./NewPartnerModal";
import { BORDER, FAINT, HEALTH_DOT, MUTED, SEARCH_INPUT, TITLE } from "./ui";

/**
 * SCOPE KONSOLI — PCS (BeePost) `ProvidersTab` shakli.
 *
 * Bitta komponent, uch yuza: `?scope=` bilan filtrlanadi va yuqoridagi 3 tab
 * (Hamkorlar / Tashqi tizimlar / Marketplace) har biri shu komponentni
 * o'zining scope'i bilan chizadi — xuddi BeePost'da LDG/Elchi provayderlari
 * bitta kabinada ko'rsatilganidek.
 *
 *   PROVAYDER KARTALARI (scope ichidagi ulanishlar) + "Yangi"
 *        ↓
 *   SUB-NAV: Umumiy holat · Sozlamalar · Posilkalar · Hodisalar · ... (VIOLET)
 *        ↓
 *   panel
 *
 * ⚠️ Tanlangan ulanish + tab URL'da (`?c=partner:7&t=settings`) — havola
 * yuborish va sahifani yangilash tanlovni yo'qotmaydi.
 */

type Scope = "partner" | "external" | "marketplace";

const SCOPES: Scope[] = ["partner", "external", "marketplace"];

const matchScope = (c: Connection, scope: Scope): boolean => {
  if (scope === "partner") return c.kind === "partner";
  if (scope === "marketplace") return c.kind === "integration" && c.category === "marketplace";
  return c.kind === "integration" && c.category !== "marketplace";
};

/** Har scope uchun i18n kalit ildizi — matn + bo'sh holat + "Yangi" yorlig'i. */
const SCOPE_KEY: Record<Scope, { subtitle: string; empty: string; emptyHint: string; neu: string }> = {
  partner: {
    subtitle: "scPartnerSubtitle",
    empty: "scPartnerEmpty",
    emptyHint: "scPartnerEmptyHint",
    neu: "scPartnerNew",
  },
  external: {
    subtitle: "scExternalSubtitle",
    empty: "scExternalEmpty",
    emptyHint: "scExternalEmptyHint",
    neu: "scExternalNew",
  },
  marketplace: {
    subtitle: "scMarketplaceSubtitle",
    empty: "scMarketplaceEmpty",
    emptyHint: "scMarketplaceEmptyHint",
    neu: "scMarketplaceNew",
  },
};

const ConnectionsPage = () => {
  const { t } = useTranslation("integrations");
  const { connections, isLoading, isError, partialError, refetch } = useConnections();
  const metricsQuery = useIntegrationMetrics();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [newPartnerOpen, setNewPartnerOpen] = useState(false);
  const navigate = useNavigate();

  const scopeParam = searchParams.get("scope");
  const scope: Scope = SCOPES.includes(scopeParam as Scope) ? (scopeParam as Scope) : "partner";
  const meta = SCOPE_KEY[scope];

  /** Shu scope'ga tegishli ulanishlar — kartalar va tanlov SHU ro'yxatdan. */
  const scoped = useMemo(() => connections.filter((c) => matchScope(c, scope)), [connections, scope]);

  const tab = searchParams.get("t") ?? "overview";

  const setTab = useCallback(
    (next: string) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set("t", next);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const byUid = useMemo(() => metricsByUid(metricsQuery.data), [metricsQuery.data]);

  const activeUid = searchParams.get("c") ?? "";
  const active = useMemo(
    () => scoped.find((c) => c.uid === activeUid) ?? scoped[0],
    [scoped, activeUid],
  );

  /** Ro'yxat yuklangach URL'ni scope'dagi birinchi ulanish bilan to'ldiramiz. */
  useEffect(() => {
    if (active && activeUid !== active.uid) {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set("c", active.uid);
          return params;
        },
        { replace: true },
      );
    }
  }, [activeUid, active, setSearchParams]);

  const select = (uid: string) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set("c", uid);
        params.set("t", "overview");
        return params;
      },
      { replace: true },
    );
  };

  const onNew = () => {
    if (scope === "partner") {
      setNewPartnerOpen(true);
    } else {
      navigate(`/integrations/new?scope=${scope}`);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter(
      (c) => c.name.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q),
    );
  }, [scoped, query]);

  const fields = useMemo(() => (active ? fieldsFor(active) : []), [active]);

  const hiddenTabs = useMemo(() => {
    if (!active) return new Set<string>();
    const hide = new Set<string>();
    if (active.role === "payment" || active.role === "mirror") {
      hide.add("shipments");
      hide.add("settlement");
    }
    if (active.role === "source" && active.kind === "integration") {
      hide.add("settlement");
    }
    return hide;
  }, [active]);

  /**
   * "Yangilash" (Umumiy holat banneri) — TanStack Query keshini
   * INVALIDATSIYA qiladi: ulanishlar, metrika va qarz qoldig'i. Sahifa qayta
   * yuklanmaydi; ochiq so'rovlar fonda yangilanadi.
   */
  const queryClient = useQueryClient();
  const refreshOverview = useCallback(() => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: metricsKey }),
      queryClient.invalidateQueries({ queryKey: [partnersKey] }),
      queryClient.invalidateQueries({ queryKey: integrationKeys.all }),
      queryClient.invalidateQueries({ queryKey: [settlementKey, "balance"] }),
    ]);
  }, [queryClient]);

  const items: SubNavItem[] = active
    ? [
        {
          key: "overview",
          label: t("tabOverview"),
          icon: <LayoutDashboard className="h-4 w-4" />,
          desc: t("tabOverviewDesc"),
          content: (
            <ConnectionOverview
              /* Ulanish almashganda panel YANGIDAN — oldingi ulanishning
                 "Aloqani sinash" natijasi boshqasida chiqmaydi. */
              key={active.uid}
              connection={active}
              metrics={byUid.get(active.uid)}
              metricsState={metricsQuery.isPending ? "loading" : metricsQuery.isError ? "error" : "ready"}
              onFix={setTab}
              hiddenTabs={hiddenTabs}
              onRefresh={refreshOverview}
              refreshing={metricsQuery.isFetching}
            />
          ),
        },
        {
          key: "settings",
          label: t("tabSettings"),
          icon: <SettingsIcon className="h-4 w-4" />,
          desc: t("tabSettingsDesc"),
          content: <ConnectionSettings connection={active} fields={fields} onSaved={refetch} />,
        },
        {
          key: "shipments",
          label: t("tabShipments"),
          icon: <Truck className="h-4 w-4" />,
          desc: t("tabShipmentsDesc"),
          content: <ConnectionShipments connection={active} />,
        },
        {
          key: "log",
          label: t("tabEvents"),
          icon: <FileClock className="h-4 w-4" />,
          desc: t("tabEventsDesc"),
          content: <ConnectionLog connection={active} />,
        },
        {
          key: "settlement",
          label: t("tabSettlement"),
          icon: <Wallet className="h-4 w-4" />,
          desc: t("tabSettlementDesc"),
          content: <ConnectionSettlement connection={active} />,
        },
        {
          key: "control",
          label: t("tabControl"),
          icon: <SlidersHorizontal className="h-4 w-4" />,
          desc: t("tabControlDesc"),
          content: <ConnectionControl connection={active} onChanged={refetch} />,
        },
        {
          key: "security",
          label: t("tabSecurity"),
          icon: <ShieldCheck className="h-4 w-4" />,
          desc: t("tabSecurityDesc"),
          content: <ConnectionSecurity connection={active} fields={fields} onSaved={refetch} />,
        },
      ]
    : [];


  const shownItems = items.filter((i) => !hiddenTabs.has(i.key));
  const activeItem = shownItems.find((i) => i.key === tab) ?? shownItems[0];

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
        {t("lstLoadError")}
        <button type="button" onClick={refetch} className="ml-2 underline underline-offset-2">
          {t("retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {partialError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
          {t("lstPartialError")}
        </div>
      )}

      {/* ═══════ SCOPE QATORI — qisqa tavsif + qidiruv ═══════ */}
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <p className={`m-0 text-sm ${MUTED}`}>{t(meta.subtitle)}</p>
        {scoped.length > 4 && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className={SEARCH_INPUT}
            />
          </div>
        )}
      </div>

      {/* ═══════ PROVAYDER KARTALARI (BeePost ProvidersTab shakli) ═══════ */}
      {scoped.length === 0 ? (
        <div className={`rounded-xl border-2 border-dashed ${BORDER} p-8 text-center`}>
          <Plug className={`mx-auto h-8 w-8 ${FAINT}`} />
          <p className={`m-0 mt-3 text-sm font-bold ${TITLE}`}>{t(meta.empty)}</p>
          <p className={`m-0 mt-1 text-xs ${MUTED}`}>{t(meta.emptyHint)}</p>
          <button
            type="button"
            onClick={onNew}
            className="mx-auto mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25"
          >
            <Plus className="h-4 w-4" />
            {t(meta.neu)}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <p className={`m-0 text-sm ${MUTED}`}>{t("searchEmpty", { q: query })}</p>
      ) : (
        <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
          {filtered.map((c) => (
            <ProviderCard
              key={c.uid}
              connection={c}
              active={c.uid === active?.uid}
              rate={fmtMetric(byUid.get(c.uid)?.success_rate, "%")}
              health={connectionHealth({
                isActive: c.is_active,
                configured: isConfigured(c),
                metrics: byUid.get(c.uid),
              })}
              onClick={() => select(c.uid)}
            />
          ))}

          {/* "+Yangi" karta — oxirida (BeePost naqshi). */}
          <button
            type="button"
            onClick={onNew}
            className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed ${BORDER} px-4 py-2.5 text-sm font-medium ${MUTED} transition-colors hover:border-indigo-300 hover:text-indigo-600`}
          >
            <Plus className="h-4 w-4" />
            {t(meta.neu)}
          </button>
        </div>
      )}

      {/* ═══════ TANLANGAN ULANISH KONSOLI ═══════ */}
      {active && activeItem && (
        <div className="space-y-4">
          <ConnectionSubNav items={shownItems} active={activeItem.key} onChange={setTab} />
          <div>{activeItem.content}</div>
        </div>
      )}

      <NewPartnerModal
        open={newPartnerOpen}
        onClose={() => setNewPartnerOpen(false)}
        onCreated={refetch}
      />
    </div>
  );
};

/**
 * Bitta ulanish KARTASI — PCS `ProvidersTab` provayder tugmasi shakli:
 * rang-ikon qutisi + nom + holat nuqtasi + toifa/ko'rsatkich.
 */
const ProviderCard = ({
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
}) => {
  const { t } = useTranslation("integrations");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`flex shrink-0 items-center gap-2.5 rounded-xl border-2 px-4 py-2.5 text-left transition-all ${
        active
          ? "border-indigo-500 bg-indigo-50 shadow-sm dark:bg-indigo-900/25"
          : "border-gray-200 bg-white hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-indigo-700"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          active
            ? "bg-indigo-600 text-white"
            : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300"
        }`}
        title={t(ROLE_META[connection.role].hintKey)}
      >
        <Plug className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${HEALTH_DOT[health]}`}
            title={
              health === "ok" ? t("healthOk") : health === "off" ? t("healthOff") : t("healthAttention")
            }
          />
          <span
            className={`block max-w-[160px] truncate text-sm font-bold leading-tight ${
              active ? "text-indigo-700 dark:text-indigo-300" : "text-gray-700 dark:text-gray-200"
            }`}
          >
            {connection.name}
          </span>
        </span>
        <span className={`block max-w-[160px] truncate text-[11px] leading-tight ${FAINT}`}>
          {t(CATEGORY_LABEL[connection.category])} · {rate}
        </span>
      </span>
    </button>
  );
};

export default ConnectionsPage;
