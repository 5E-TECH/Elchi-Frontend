// dizayn-v2: superadmin-integrations-partners-console, superadmin-integrations-external-console, superadmin-integrations-marketplace-console, admin-integrations-partners, admin-integrations-external, admin-integrations-marketplace
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, ChevronRight, CircleCheck, CircleX, Clock, Plug, Plus, RefreshCw } from "lucide-react";
import { CATEGORY_LABEL, integrationKeys } from "../../entities/integrations";
import {
  connectionHealth,
  metricsByUid,
  metricsKey,
  useIntegrationMetrics,
  type ConnectionHealth,
  type ConnectionMetrics,
  type IntegrationMetrics,
} from "../../entities/integrations/metrics";
import { settlementKey } from "../../entities/integrations/settlement";
import { partnersKey } from "../../entities/partners";
import { cx } from "../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../shared/lib/formatDateTime";
import { MINUS_SIGN, formatNumberLocalized, formatPercentLocalized } from "../../shared/lib/formatMoney";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  IconButton,
  PageHeader,
  Pressable,
  SkeletonTable,
  StatCard,
  StatusBadge,
  Tabs,
  TextInput,
  getPanelId,
  getTabId,
  type DataTableColumn,
  type TabItem,
  type Tone,
} from "../../shared/ui/primitives";
import { fieldsFor, isConfigured, useConnections, type Connection } from "./useConnections";
import ConnectionOverview from "./panels/ConnectionOverview";
import ConnectionSettings from "./panels/ConnectionSettings";
import ConnectionSecurity from "./panels/ConnectionSecurity";
import ConnectionLog from "./panels/ConnectionLog";
import ConnectionSettlement from "./panels/ConnectionSettlement";
import ConnectionShipments from "./panels/ConnectionShipments";
import ConnectionControl from "./panels/ConnectionControl";
import NewPartnerModal from "./NewPartnerModal";
import { InlineAlert, InlineLegend, SegBar } from "./ui";

/**
 * KONSOL — «Integratsiyalar» (maket `*-partners-console`, `*-external-console`, `*-marketplace-console`).
 *
 *   PageHeader («Yangi hamkor» / «Yangi ulanish»)
 *   «Barcha ulanishlar · oxirgi 24 soat» — 4 KPI (D1: «kechaga nisbatan» = 48 soat − 24 soat)
 *   Karta: scope tablari (Hamkorlar · Tashqi tizimlar · Marketplace, sonlari bilan) → izoh → qidiruv →
 *          ulanishlar jadvali (telefonda kartalar) → legenda
 *   Karta: tanlangan ulanish — sarlavha + 7 tab (Umumiy holat … Xavfsizlik) → panel
 *
 * ⚠️ Tanlangan ulanish + tab URL'da (`?scope=partner&c=partner:7&t=settings`) — havola yuborish va
 * sahifani yangilash tanlovni yo'qotmaydi (`tabUrl.test.tsx`).
 * Sparklinelar va «Chiziqlar — oxirgi 7 kun» — «Taklif» (kunlik seriya API'da yo'q), chizilmaydi.
 */

type Scope = "partner" | "external" | "marketplace";

const SCOPES: Scope[] = ["partner", "external", "marketplace"];

const matchScope = (c: Connection, scope: Scope): boolean => {
  if (scope === "partner") return c.kind === "partner";
  if (scope === "marketplace") return c.kind === "integration" && c.category === "marketplace";
  return c.kind === "integration" && c.category !== "marketplace";
};

/** Har scope uchun i18n kalitlari — tab, izoh, bo'sh holat, «Yangi» yorlig'i, ro'yxat nomi. */
const SCOPE_KEY: Record<Scope, { tab: string; subtitle: string; empty: string; emptyHint: string; neu: string; list: string }> = {
  partner: {
    tab: "navPartners",
    subtitle: "scPartnerSubtitle",
    empty: "scPartnerEmpty",
    emptyHint: "scPartnerEmptyHint",
    neu: "scPartnerNew",
    list: "console.listPartners",
  },
  external: {
    tab: "navExternal",
    subtitle: "scExternalSubtitle",
    empty: "scExternalEmpty",
    emptyHint: "scExternalEmptyHint",
    neu: "scExternalNew",
    list: "console.listExternal",
  },
  marketplace: {
    tab: "navMarketplace",
    subtitle: "scMarketplaceSubtitle",
    empty: "scMarketplaceEmpty",
    emptyHint: "scMarketplaceEmptyHint",
    neu: "scMarketplaceNew",
    list: "console.listMarketplace",
  },
};

const HEALTH_TONE: Record<ConnectionHealth, Tone> = { ok: "success", attention: "warning", off: "neutral" };
const HEALTH_KEY: Record<ConnectionHealth, string> = { ok: "healthOk", attention: "healthAttention", off: "healthOff" };
/** Rol — birlik shaklida (maket: «Buyurtma manbasi», «Yetkazuvchi»). */
const ROLE_ONE_KEY: Record<Connection["role"], string> = {
  carrier: "console.roleOneCarrier",
  source: "console.roleOneSource",
  payment: "console.roleOnePayment",
  mirror: "console.roleOneMirror",
};

/** Panel tablari — tartib maketdagidek. */
const PANEL_TABS = [
  { key: "overview", labelKey: "tabOverview" },
  { key: "settings", labelKey: "tabSettings" },
  { key: "shipments", labelKey: "tabShipments" },
  { key: "log", labelKey: "tabEvents" },
  { key: "settlement", labelKey: "tabSettlement" },
  { key: "control", labelKey: "tabControl" },
  { key: "security", labelKey: "tabSecurity" },
] as const;

type PanelKey = (typeof PANEL_TABS)[number]["key"];

/** Yakunlangan hodisalar ulushi (Σ yetkazildi / (Σ yetkazildi + Σ yetmadi)), yakunlangan yo'q — `null`. */
const successOf = (delivered: number, failed: number): number | null =>
  delivered + failed > 0 ? (delivered / (delivered + failed)) * 100 : null;

const sumOf = (data: IntegrationMetrics | undefined, key: "delivered" | "failed" | "events") =>
  (data?.connections ?? []).reduce((acc, c) => acc + (Number(c[key]) || 0), 0);

const ConnectionsPage = () => {
  const { t, i18n } = useTranslation("integrations");
  const language = i18n.language;
  const num = (value: number) => formatNumberLocalized(value, { language });
  const { connections, isLoading, isError, partialError, refetch } = useConnections({ silentError: true });
  const metricsQuery = useIntegrationMetrics(undefined, { silentError: true });
  /** D1: «kechaga nisbatan» — 48 soatlik oyna; kecha = 48 soat − 24 soat. Yiqilsa meta yashirinadi. */
  const prevQuery = useIntegrationMetrics(48, { silentError: true });
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [newPartnerOpen, setNewPartnerOpen] = useState(false);
  const navigate = useNavigate();

  const scopeParam = searchParams.get("scope");
  const scope: Scope = SCOPES.includes(scopeParam as Scope) ? (scopeParam as Scope) : "partner";
  const meta = SCOPE_KEY[scope];

  /** Shu scope'ga tegishli ulanishlar — jadval va tanlov SHU ro'yxatdan. */
  const scoped = useMemo(() => connections.filter((c) => matchScope(c, scope)), [connections, scope]);
  const scopeCounts = useMemo(
    () => Object.fromEntries(SCOPES.map((s) => [s, connections.filter((c) => matchScope(c, s)).length])) as Record<Scope, number>,
    [connections],
  );

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
  const byUid48 = useMemo(() => metricsByUid(prevQuery.data), [prevQuery.data]);

  const activeUid = searchParams.get("c") ?? "";
  const active = useMemo(() => scoped.find((c) => c.uid === activeUid) ?? scoped[0], [scoped, activeUid]);

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

  /** Boshqa ulanishga o'tish: ikki parametr BITTA yangilanishda (tab birinchisiga qaytadi). */
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

  const onScope = (next: Scope) => {
    setQuery("");
    navigate(`/integrations/connections?scope=${next}`);
  };

  const onNew = () => {
    if (scope === "partner") setNewPartnerOpen(true);
    else navigate(`/integrations/new?scope=${scope}`);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter((c) => c.name.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q));
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
   * «Yangilash» (Umumiy holat) — TanStack Query keshini INVALIDATSIYA qiladi: ulanishlar, metrika va
   * qarz qoldig'i. Sahifa qayta yuklanmaydi; ochiq so'rovlar fonda yangilanadi.
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

  const shownTabs = PANEL_TABS.filter((item) => !hiddenTabs.has(item.key));
  const activeTab: PanelKey = (shownTabs.find((item) => item.key === tab) ?? shownTabs[0]).key;

  const healthOf = (c: Connection): ConnectionHealth =>
    connectionHealth({ isActive: c.is_active, configured: isConfigured(c), metrics: byUid.get(c.uid) });

  /** Kechagi muvaffaqiyat (tanlangan ulanish): 48 soat − 24 soat. */
  const prevRateOf = (uid: string): number | null => {
    const now = byUid.get(uid);
    const wide = byUid48.get(uid);
    if (!now || !wide || prevQuery.isError) return null;
    return successOf(Math.max(0, wide.delivered - now.delivered), Math.max(0, wide.failed - now.failed));
  };

  const panel = (key: PanelKey, c: Connection) => {
    switch (key) {
      case "overview":
        return (
          <ConnectionOverview
            /* Ulanish almashganda panel YANGIDAN — oldingi ulanishning «Aloqani sinash» natijasi boshqasida chiqmaydi. */
            key={c.uid}
            connection={c}
            metrics={byUid.get(c.uid)}
            metricsState={metricsQuery.isPending ? "loading" : metricsQuery.isError ? "error" : "ready"}
            onFix={setTab}
            hiddenTabs={hiddenTabs}
            onRefresh={refreshOverview}
            refreshing={metricsQuery.isFetching}
            prevSuccessRate={prevRateOf(c.uid)}
          />
        );
      case "settings":
        return <ConnectionSettings connection={c} fields={fields} onSaved={refetch} />;
      case "shipments":
        return <ConnectionShipments connection={c} />;
      case "log":
        return <ConnectionLog connection={c} metrics={byUid.get(c.uid)} />;
      case "settlement":
        return <ConnectionSettlement connection={c} />;
      case "control":
        return <ConnectionControl connection={c} onChanged={refetch} />;
      case "security":
        return <ConnectionSecurity connection={c} fields={fields} onSaved={refetch} />;
      default:
        return null;
    }
  };

  /* ─── Ulanishlar jadvali ─── */
  const eventInfo = (c: Connection) => {
    const m = byUid.get(c.uid);
    const events = m?.events ?? 0;
    const delivered = m?.delivered ?? 0;
    const queued = m?.queued ?? 0;
    const failed = m?.failed ?? 0;
    const segAria = t("console.segAria", { count: num(events), delivered: num(delivered), queued: num(queued), failed: num(failed) });
    const parts = [
      { value: delivered, className: "bg-success" },
      { value: queued, className: "bg-warning" },
      { value: failed, className: "bg-danger" },
    ];
    const note =
      failed > 0 ? (
        <span className="text-danger-fg">{t("console.failedNote", { count: num(failed) })}</span>
      ) : queued > 0 ? (
        <span className="text-warning-fg">{t("console.queuedNote", { count: num(queued) })}</span>
      ) : null;
    return { m, events, segAria, parts, note };
  };

  const eventsCell = (c: Connection) => {
    const { m, events, segAria, parts, note } = eventInfo(c);
    return (
      <div className="flex flex-col items-end">
        <span className={cx("font-semibold tabular-nums", events ? "text-text" : "text-text-muted")}>{num(events)}</span>
        {events > 0 ? <SegBar size="sm" className="my-1.5 ml-auto w-[120px]" ariaLabel={segAria} parts={parts} /> : null}
        {note ? <span className="text-xs">{note}</span> : null}
        {m?.success_rate != null ? (
          <span className="text-xs text-text-muted lg:hidden">
            {t("console.rateShort", { rate: formatPercentLocalized(m.success_rate, { language }) })}
          </span>
        ) : null}
      </div>
    );
  };

  const subtitleOf = (c: Connection) => {
    if (c.kind === "partner") {
      const url = (c.raw as { webhook_url?: string | null }).webhook_url;
      return url ? { text: url, warn: false } : { text: t("console.noWebhookUrl"), warn: true };
    }
    const raw = c.raw as { base_url?: string | null; api_url?: string | null };
    const url = raw.base_url || raw.api_url;
    return url ? { text: url, warn: false } : { text: t("console.noApiUrl"), warn: true };
  };

  const sandboxOn = (c: Connection) => c.kind === "partner" && Boolean((c.raw as { sandbox_enabled?: boolean }).sandbox_enabled);

  /** `stretched` — telefon kartasida tugmaning bosiladigan maydoni butun karta (≥ 44 px, ichida boshqa tugma yo'q). */
  const nameButton = (c: Connection, stretched = false) => (
    <Pressable
      onClick={() => select(c.uid)}
      aria-current={c.uid === active?.uid ? "true" : undefined}
      className={cx(
        "text-left text-sm font-semibold text-text hover:text-action-fg hover:underline",
        stretched && "after:absolute after:inset-0 after:content-['']",
      )}
    >
      {c.name}
    </Pressable>
  );

  const columns: DataTableColumn<Connection>[] = [
    {
      id: "name",
      header: t(scope === "partner" ? "console.colPartner" : "console.colConnection"),
      cell: (c) => {
        const sub = subtitleOf(c);
        return (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2">
              {nameButton(c)}
              {sandboxOn(c) ? (
                <Badge tone="info" size="sm">
                  {t("console.sandboxBadge")}
                </Badge>
              ) : null}
            </span>
            <span className={cx("max-w-[360px] truncate text-xs", sub.warn ? "text-warning-fg" : "text-text-muted")} title={sub.text}>
              {sub.text}
            </span>
          </div>
        );
      },
    },
    ...(scope === "partner"
      ? []
      : [
          {
            id: "category",
            header: t("console.colType"),
            cell: (c: Connection) => <Badge>{t(CATEGORY_LABEL[c.category])}</Badge>,
          },
        ]),
    {
      id: "health",
      header: t("colStatus"),
      cell: (c) => {
        const health = healthOf(c);
        return <StatusBadge tone={HEALTH_TONE[health]} label={t(HEALTH_KEY[health])} />;
      },
    },
    {
      id: "events",
      header: t("console.colEvents24h"),
      align: "end",
      cell: (c) => eventsCell(c),
    },
    {
      id: "rate",
      header: t("console.colSuccess"),
      align: "end",
      hideBelow: "lg",
      cell: (c) => {
        const rate = byUid.get(c.uid)?.success_rate;
        return rate == null ? (
          <span className="text-text-muted">—</span>
        ) : (
          <span className="font-semibold">{formatPercentLocalized(rate, { language })}</span>
        );
      },
    },
    {
      id: "last",
      header: t("console.colLastEvent"),
      hideBelow: "lg",
      cell: (c) => {
        const last = byUid.get(c.uid)?.last_event_at;
        return last ? (
          <span className={c.is_active ? "text-text" : "text-text-muted"}>{formatDateTimeLocalized(last, { language })}</span>
        ) : (
          <span className="text-text-muted">—</span>
        );
      },
    },
    {
      id: "open",
      header: <span className="sr-only">{t("console.colActions")}</span>,
      className: "w-16",
      cell: (c) => (
        <IconButton size="sm" icon={ChevronRight} label={t("console.openConnection", { name: c.name })} onClick={() => select(c.uid)} />
      ),
    },
  ];

  const renderCard = (c: Connection) => {
    const sub = subtitleOf(c);
    const health = healthOf(c);
    const { m, events, segAria, parts, note } = eventInfo(c);
    return (
      <div className={cx("flex min-w-0 flex-col gap-1 px-4 py-3", c.uid === active?.uid && "bg-action-soft")}>
        {nameButton(c, true)}
        <span className={cx("text-xs [overflow-wrap:anywhere]", sub.warn ? "text-warning-fg" : "text-text-muted")}>{sub.text}</span>
        <span className="text-xs text-text-muted">
          {scope !== "partner" ? `${t(CATEGORY_LABEL[c.category])} · ` : ""}
          {m && events > 0 ? (
            <>
              {t("console.events24hShort", { count: num(events) })}
              {" · "}
              {note ?? (m.success_rate != null ? formatPercentLocalized(m.success_rate, { language }) : "—")}
            </>
          ) : m?.last_event_at ? (
            t("console.lastEventShort", { at: formatDateTimeLocalized(m.last_event_at, { language }) })
          ) : (
            t("console.noEventsYet")
          )}
        </span>
        {events > 0 ? <SegBar size="sm" className="my-0.5" ariaLabel={segAria} parts={parts} /> : null}
        <span className="flex flex-wrap gap-1.5">
          <StatusBadge tone={HEALTH_TONE[health]} label={t(HEALTH_KEY[health])} />
          {sandboxOn(c) ? <Badge tone="info">{t("console.sandboxBadge")}</Badge> : null}
        </span>
      </div>
    );
  };

  /* ─── KPI (barcha ulanishlar, 24 soat) ─── */
  const totals = metricsQuery.data?.totals;
  const delivered24 = sumOf(metricsQuery.data, "delivered");
  const failed24 = totals?.failed ?? 0;
  const success24 = successOf(delivered24, failed24);
  const prevReady = Boolean(prevQuery.data) && !prevQuery.isError && Boolean(metricsQuery.data);
  const prevEvents = prevReady ? Math.max(0, (prevQuery.data?.totals.events ?? 0) - (totals?.events ?? 0)) : null;
  const prevFailed = prevReady ? Math.max(0, (prevQuery.data?.totals.failed ?? 0) - failed24) : null;
  const prevDelivered = prevReady ? Math.max(0, sumOf(prevQuery.data, "delivered") - delivered24) : null;
  const prevSuccess = prevDelivered !== null && prevFailed !== null ? successOf(prevDelivered, prevFailed) : null;
  const eventsDelta = prevEvents ? (((totals?.events ?? 0) - prevEvents) / prevEvents) * 100 : null;
  const successDelta = success24 !== null && prevSuccess !== null ? success24 - prevSuccess : null;
  // Ikki kunda ham hodisa yo'q — «0 ta kechaga nisbatan» shovqin; taqqoslanadigan narsa yo'q.
  const anyActivity = (totals?.events ?? 0) > 0 || (prevEvents ?? 0) > 0;
  const failedDelta = prevFailed !== null && anyActivity ? failed24 - prevFailed : null;
  const signed = (value: number, fractionDigits = 0) =>
    `${value > 0 ? "+" : value < 0 ? MINUS_SIGN : ""}${formatNumberLocalized(Math.abs(value), { language, fractionDigits })}`;

  const queueRows = useMemo(() => {
    const list = (metricsQuery.data?.connections ?? [])
      .filter((m: ConnectionMetrics) => m.queued > 0)
      .sort((a, b) => b.queued - a.queued);
    const nameOf = (uid: string) => connections.find((c) => c.uid === uid)?.name ?? uid;
    const top = list.slice(0, 2).map((m) => ({ key: m.uid, name: nameOf(m.uid), value: m.queued }));
    const rest = list.slice(2);
    return { top, restCount: rest.length, restValue: rest.reduce((acc, m) => acc + m.queued, 0) };
  }, [metricsQuery.data, connections]);
  const QUEUE_COLORS = ["bg-chart-1", "bg-chart-2"];

  const kpiLoading = metricsQuery.isPending;
  const kpiHint = t("console.vsYesterday");

  const tabItems: TabItem<Scope>[] = SCOPES.map((s) => ({
    value: s,
    label: t(SCOPE_KEY[s].tab),
    count: isLoading ? undefined : scopeCounts[s],
  }));

  const panelIdPrefix = `conn-${active?.uid.replace(":", "-") ?? "none"}`;

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        title={t("pageTitle")}
        description={t("pageSubtitle")}
        actions={
          <Button variant={activeTab === "settings" && active ? "secondary" : "primary"} leftIcon={Plus} onClick={onNew}>
            {t(meta.neu)}
          </Button>
        }
      />

      {isError ? (
        <InlineAlert
          tone="danger"
          action={
            <Button variant="secondary" size="sm" leftIcon={RefreshCw} onClick={refetch} className="max-md:min-h-11">
              {t("retry")}
            </Button>
          }
        >
          {t("lstLoadError")}
        </InlineAlert>
      ) : (
        <>
          {/* ═══ Barcha ulanishlar · oxirgi 24 soat ═══ */}
          <section aria-labelledby="kpi-all" className="flex min-w-0 flex-col gap-3">
            <h2 id="kpi-all" className="text-xs font-semibold uppercase tracking-[.04em] text-text-muted">
              {t("console.kpiTitle")}
            </h2>
            <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-md:gap-3">
              <StatCard
                label={t("console.kpiEvents")}
                icon={Activity}
                loading={kpiLoading}
                value={num(totals?.events ?? 0)}
                unit={t("console.unitTa")}
                delta={eventsDelta}
                goodWhen="none"
                hint={eventsDelta !== null ? kpiHint : undefined}
              />
              <StatCard
                label={t("console.kpiSuccess")}
                icon={CircleCheck}
                loading={kpiLoading}
                value={success24 === null ? "—" : formatNumberLocalized(success24, { language, fractionDigits: 1 })}
                unit={success24 === null ? undefined : "%"}
                delta={successDelta}
                deltaText={successDelta !== null ? t("console.deltaPp", { value: signed(successDelta, 1) }) : undefined}
                goodWhen="up"
                hint={successDelta !== null ? kpiHint : undefined}
              />
              <StatCard
                label={t("console.kpiFailed")}
                icon={CircleX}
                loading={kpiLoading}
                value={num(failed24)}
                unit={t("console.unitTa")}
                delta={failedDelta}
                deltaText={failedDelta !== null ? t("console.deltaCount", { value: signed(failedDelta) }) : undefined}
                goodWhen="down"
                hint={failedDelta !== null ? kpiHint : undefined}
              />
              <StatCard
                label={t("console.kpiQueued")}
                icon={Clock}
                loading={kpiLoading}
                value={num(totals?.queued ?? 0)}
                unit={t("console.unitTa")}
                hint={queueRows.top.length ? t("console.byConnection") : undefined}
              >
                {queueRows.top.length ? (
                  <span className="flex flex-col gap-1">
                    <SegBar
                      ariaLabel={t("console.queueAria", {
                        list: [
                          ...queueRows.top.map((r) => `${r.name} ${num(r.value)}`),
                          ...(queueRows.restCount
                            ? [t("console.queueRest", { count: queueRows.restCount, value: num(queueRows.restValue) })]
                            : []),
                        ].join(", "),
                      })}
                      parts={[
                        ...queueRows.top.map((r, index) => ({ value: r.value, className: QUEUE_COLORS[index] })),
                        { value: queueRows.restValue, className: "bg-chart-muted" },
                      ]}
                    />
                    <span className="flex flex-col gap-0.5">
                      {queueRows.top.map((r, index) => (
                        <span key={r.key} className="flex items-center gap-1.5 text-xs">
                          <span aria-hidden="true" className={cx("size-2.5 shrink-0 rounded-[3px]", QUEUE_COLORS[index])} />
                          <span className="min-w-0 flex-1 truncate text-text-muted">{r.name}</span>
                          <span className="font-semibold text-text">{num(r.value)}</span>
                        </span>
                      ))}
                      {queueRows.restCount ? (
                        <span className="flex items-center gap-1.5 text-xs">
                          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[3px] bg-chart-muted" />
                          <span className="min-w-0 flex-1 truncate text-text-muted">
                            {t("console.moreConnections", { count: queueRows.restCount })}
                          </span>
                          <span className="font-semibold text-text">{num(queueRows.restValue)}</span>
                        </span>
                      ) : null}
                    </span>
                  </span>
                ) : null}
              </StatCard>
            </div>
          </section>

          {partialError ? (
            <InlineAlert tone="warning" title={t("console.partialTitle")}>
              {t("console.partialText")}
            </InlineAlert>
          ) : null}

          {/* ═══ Ulanishlar ro'yxati ═══ */}
          <Card
            padding="none"
            aria-label={t(meta.list)}
            footer={
              !isLoading && filtered.length > 0 ? (
                <>
                  <InlineLegend
                    items={[
                      { key: "d", label: t("deliveryDelivered"), className: "bg-success" },
                      { key: "q", label: t("deliveryQueued"), className: "bg-warning" },
                      { key: "f", label: t("deliveryFailed"), className: "bg-danger" },
                    ]}
                  />
                  <span className="text-xs text-text-subtle">{t("console.legendNote")}</span>
                </>
              ) : undefined
            }
          >
            <Tabs
              items={tabItems}
              value={scope}
              onValueChange={onScope}
              ariaLabel={t("console.scopeTabsAria")}
              listClassName="px-3"
            />
            <div className="flex flex-col gap-3 px-5 py-4 max-md:px-4">
              <p className="text-[13px] leading-[18px] text-text-muted">{t(meta.subtitle)}</p>
              {!isLoading && scoped.length > 0 ? (
                <TextInput
                  mode="search"
                  value={query}
                  onValueChange={setQuery}
                  placeholder={t("console.searchPlaceholder")}
                  aria-label={t("console.searchAria")}
                />
              ) : null}
              {!isLoading && scoped.length > 0 && filtered.length === 0 ? (
                <p className="text-[13px] text-text-muted">{t("searchEmpty", { q: query.trim() })}</p>
              ) : null}
            </div>
            {isLoading ? (
              <SkeletonTable
                framed={false}
                rows={4}
                columns={[t("console.colConnection"), t("colStatus"), t("console.colEvents24h"), t("console.colLastEvent")]}
                className="border-t border-border"
              />
            ) : scoped.length === 0 ? (
              <EmptyState
                className="border-t border-border"
                icon={Plug}
                title={t(meta.empty)}
                description={t(meta.emptyHint)}
                action={
                  <Button variant="secondary" leftIcon={Plus} onClick={onNew}>
                    {t(meta.neu)}
                  </Button>
                }
              />
            ) : filtered.length > 0 ? (
              <DataTable
                rows={filtered}
                columns={columns}
                getRowKey={(c) => c.uid}
                label={t(meta.list)}
                cardsLabel={t(meta.list)}
                density="tablet-tight"
                onRowClick={(c) => select(c.uid)}
                rowClassName={(c) => (c.uid === active?.uid ? "bg-action-soft hover:bg-action-soft" : null)}
                renderCard={renderCard}
                busy={metricsQuery.isFetching && !metricsQuery.isPending}
                className="border-t border-border"
              />
            ) : null}
          </Card>

          {/* ═══ Tanlangan ulanish ═══ */}
          {active ? (
            <Card padding="none" aria-labelledby="sel-name" className="overflow-hidden">
              <div className="flex min-w-0 flex-wrap items-start gap-x-4 gap-y-3 px-5 pb-2 pt-4 max-md:px-4">
                <span className="inline-flex size-9 flex-none items-center justify-center rounded-[10px] bg-sunken text-text-muted max-md:hidden">
                  <Plug size={18} aria-hidden="true" />
                </span>
                <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
                    <h2 id="sel-name" className="mr-1 text-base font-bold text-text">
                      {active.name}
                    </h2>
                    <StatusBadge tone={HEALTH_TONE[healthOf(active)]} label={t(HEALTH_KEY[healthOf(active)])} />
                    <Badge>{t(ROLE_ONE_KEY[active.role])}</Badge>
                    <Badge>{t(CATEGORY_LABEL[active.category])}</Badge>
                  </div>
                  <p className="text-[13px] leading-[18px] text-text-muted">
                    {t(active.kind === "partner" ? "console.selPartnerHint" : "console.selIntegrationHint")}
                  </p>
                </div>
              </div>
              <Tabs
                items={shownTabs.map((item) => ({ value: item.key, label: t(item.labelKey) }))}
                value={activeTab}
                onValueChange={setTab}
                ariaLabel={t("console.panelTabsAria", { name: active.name })}
                idPrefix={panelIdPrefix}
                controlsPanel
                listClassName="px-3"
              />
              <div
                role="tabpanel"
                id={getPanelId(panelIdPrefix, activeTab)}
                aria-labelledby={getTabId(panelIdPrefix, activeTab)}
                className="min-w-0"
              >
                {panel(activeTab, active)}
              </div>
            </Card>
          ) : null}
        </>
      )}

      <NewPartnerModal open={newPartnerOpen} onClose={() => setNewPartnerOpen(false)} onCreated={refetch} />
    </div>
  );
};

export default ConnectionsPage;
