// dizayn-v2: superadmin-integrations-partners-console, superadmin-integrations-external-console, superadmin-integrations-marketplace-console, superadmin-integrations-carrier-console, admin-integrations-partners, admin-integrations-external, admin-integrations-marketplace, admin-integrations-carrier-console
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Activity, ChevronRight, CircleCheck, CircleX, Clock, Plug, Plus, RefreshCw } from "lucide-react";
import { canManageCarrierAccounts } from "../../app/lib/access";
import { CATEGORY_LABEL, type Integration } from "../../entities/integrations";
import { useCarrierAccounts } from "../../entities/integrations/carriers";
import {
  connectionHealth,
  metricsByUid,
  useIntegrationMetrics,
  type ConnectionHealth,
  type ConnectionMetrics,
  type IntegrationMetrics,
} from "../../entities/integrations/metrics";
import { importedOrdersOf } from "../../entities/integrations/siteSource";
import { cx } from "../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../shared/lib/formatDateTime";
import { MINUS_SIGN, formatNumberLocalized, formatPercentLocalized } from "../../shared/lib/formatMoney";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  SkeletonTable,
  StatCard,
  StatusBadge,
  Tabs,
  TextInput,
  getTabId,
  type DataTableColumn,
  type TabItem,
} from "../../shared/ui/primitives";
import {
  HEALTH_KEY,
  HEALTH_TONE,
  connectionPath,
  legacyConnectionPath,
  matchScope,
  scopePath,
  successOf,
  type Scope,
} from "./connectionMeta";
import { isConfigured, useConnections, type Connection } from "./useConnections";
import NewPartnerModal from "./NewPartnerModal";
import { CarrierConsole } from "./carrier/CarrierConsole";
import { InlineAlert, InlineLegend, SegBar } from "./ui";

/**
 * KONSOL — «Integratsiyalar» (maket `*-partners-console`, `*-external-console`, `*-marketplace-console`,
 * `*-carrier-console`).
 *
 * 4-tab «Tashqi yetkazuvchilar» (`?scope=carrier`, Carrier API) — faqat superadmin va admin
 * (`canManageCarrierAccounts`; backend `admin/carriers`). Uning o'z konsoli (`carrier/CarrierConsole`): KPI yo'q,
 * ro'yxat kartasi shu tab qatori bilan + tanlangan akkaunt. Menejer / registratorda tab chizilmaydi.
 *
 *   PageHeader («Yangi hamkor» / «Yangi ulanish»)
 *   «Barcha ulanishlar · oxirgi 24 soat» — 4 KPI (D1: «kechaga nisbatan» = 48 soat − 24 soat)
 *   Karta: scope tablari (Hamkorlar · Tashqi tizimlar · Marketplace, sonlari bilan) → izoh → qidiruv →
 *          ulanishlar jadvali (telefonda kartalar) → legenda
 *
 * Qator bosilsa ulanishning O'Z SAHIFASI ochiladi (`ConnectionPage`, ega qarori 2026-11-25). Ilgari tafsilot shu
 * sahifaning pastida edi (`?c=integration:3&t=log`) — eski havola yangi manzilga yo'naltiriladi.
 * Sparklinelar va «Chiziqlar — oxirgi 7 kun» — «Taklif» (kunlik seriya API'da yo'q), chizilmaydi.
 */

const BASE_SCOPES: Scope[] = ["partner", "external", "marketplace"];
/** Scope tablari `id` prefiksi — ikki joyda chizilgan tab qatorida bir xil (fokusni qaytarish uchun). */
const SCOPE_TABS_ID = "integrations-scope";
const ALL_SCOPES: Scope[] = [...BASE_SCOPES, "carrier"];

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
  carrier: {
    tab: "carrier.tab",
    subtitle: "carrier.subtitle",
    empty: "carrier.empty.title",
    emptyHint: "carrier.empty.text",
    neu: "carrier.newButton",
    list: "carrier.listAria",
  },
};

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
  const canManageCarriers = useSelector(canManageCarrierAccounts);
  const SCOPES = canManageCarriers ? ALL_SCOPES : BASE_SCOPES;
  /** 4-tab soni; ro'yxat `CarrierConsole` bilan bitta kesh (`queryKeys.carrierAccounts`). */
  const carriersQuery = useCarrierAccounts({ enabled: canManageCarriers, silentError: true });

  const legacyPath = legacyConnectionPath(searchParams);
  const scopeParam = searchParams.get("scope");
  const scope: Scope = SCOPES.includes(scopeParam as Scope) ? (scopeParam as Scope) : "partner";
  const meta = SCOPE_KEY[scope];

  /** Shu scope'ga tegishli ulanishlar — jadval va tanlov SHU ro'yxatdan. */
  const scoped = useMemo(() => connections.filter((c) => matchScope(c, scope)), [connections, scope]);
  const carrierCount = carriersQuery.data?.length;
  const scopeCounts = useMemo(
    () =>
      ({
        ...Object.fromEntries(BASE_SCOPES.map((s) => [s, connections.filter((c) => matchScope(c, s)).length])),
        carrier: carrierCount ?? 0,
      }) as Record<Scope, number>,
    [connections, carrierCount],
  );

  const byUid = useMemo(() => metricsByUid(metricsQuery.data), [metricsQuery.data]);

  /**
   * Scope tab qatori ikki joyda chiziladi (carrier — `CarrierConsole` kartasida, qolganlari — shu sahifa kartasida):
   * carrier tabiga kirish / chiqishda u qayta o'rnatiladi va fokus `<body>` ga tushardi (← → keyin ishlamasdi).
   * Tab orqali almashilsa — yangi qatordagi tanlangan tabga fokus qaytariladi (faqat fokus yo'qolgan bo'lsa).
   */
  const refocusScopeTab = useRef(false);
  const onScope = (next: Scope) => {
    setQuery("");
    refocusScopeTab.current = true;
    navigate(scopePath(next));
  };
  useLayoutEffect(() => {
    if (!refocusScopeTab.current) return;
    refocusScopeTab.current = false;
    if (document.activeElement && document.activeElement !== document.body) return;
    document.getElementById(getTabId(SCOPE_TABS_ID, scope))?.focus();
  }, [scope]);

  const onNew = () => {
    if (scope === "partner") setNewPartnerOpen(true);
    else if (scope === "carrier") {
      // Yaratish oynasi `CarrierConsole` ichida: `?new=1` — ochish so'rovi; konsol ro'yxat yuklangach uni bir marta
      // o'qib oynani mahalliy holatda ochadi va parametrni URL'dan oladi (oyna URL'ga bog'liq emas).
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set("new", "1");
          return params;
        },
        { replace: true },
      );
    } else navigate(`/integrations/new?scope=${scope}`);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter((c) => c.name.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q));
  }, [scoped, query]);

  const healthOf = (c: Connection): ConnectionHealth =>
    connectionHealth({ isActive: c.is_active, configured: isConfigured(c), metrics: byUid.get(c.uid) });

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

  const openLabel = (c: Connection) => t("console.openConnection", { name: c.name });

  /** Nom — havola (yangi oynada ham ochiladi); `stretched` — telefon kartasida bosiladigan maydon butun karta. */
  const nameLink = (c: Connection, stretched = false) => (
    <Link
      to={connectionPath(c.uid)}
      className={cx(
        "text-left text-sm font-semibold text-text hover:text-action-fg hover:underline",
        stretched && "after:absolute after:inset-0 after:content-['']",
      )}
    >
      {c.name}
    </Link>
  );

  /** Saytdan olingan buyurtmalar — hamkorda yo'q; noma'lum bo'lsa `null` («—», 0 emas). */
  const importsOf = (c: Connection) => (c.kind === "integration" ? importedOrdersOf(c.raw as Integration) : null);

  const columns: DataTableColumn<Connection>[] = [
    {
      id: "name",
      header: t(scope === "partner" ? "console.colPartner" : "console.colConnection"),
      cell: (c) => {
        const sub = subtitleOf(c);
        return (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2">
              {nameLink(c)}
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
    ...(scope === "partner"
      ? []
      : [
          {
            id: "imported",
            header: t("conn.colImported"),
            align: "end" as const,
            cell: (c: Connection) => {
              const imports = importsOf(c);
              if (!imports) return <span className="text-text-muted">—</span>;
              return (
                <span className="flex flex-col items-end">
                  <span className={cx("font-semibold tabular-nums", imports.total ? "text-text" : "text-text-muted")}>
                    {t("console.countTa", { count: num(imports.total) })}
                  </span>
                  {imports.last_at ? (
                    <span className="whitespace-nowrap text-xs text-text-muted">
                      {formatDateTimeLocalized(imports.last_at, { language })}
                    </span>
                  ) : null}
                </span>
              );
            },
          },
        ]),
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
        <Link
          to={connectionPath(c.uid)}
          aria-label={openLabel(c)}
          title={openLabel(c)}
          className="inline-flex size-9 items-center justify-center rounded-[10px] text-text-muted hover:bg-sunken hover:text-text"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
      ),
    },
  ];

  const renderCard = (c: Connection) => {
    const sub = subtitleOf(c);
    const health = healthOf(c);
    const { m, events, segAria, parts, note } = eventInfo(c);
    const imports = importsOf(c);
    return (
      <div className="flex min-w-0 flex-col gap-1 px-4 py-3">
        {nameLink(c, true)}
        <span className={cx("text-xs [overflow-wrap:anywhere]", sub.warn ? "text-warning-fg" : "text-text-muted")}>{sub.text}</span>
        <span className="text-xs text-text-muted">
          {scope !== "partner" ? `${t(CATEGORY_LABEL[c.category])} · ` : ""}
          {imports ? `${t("conn.importedShort", { value: num(imports.total) })} · ` : ""}
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
    count: (s === "carrier" ? carrierCount === undefined : isLoading) ? undefined : scopeCounts[s],
  }));

  const scopeTabs = (
    <Tabs
      items={tabItems}
      value={scope}
      onValueChange={onScope}
      ariaLabel={t("console.scopeTabsAria")}
      idPrefix={SCOPE_TABS_ID}
      listClassName="px-3"
    />
  );

  if (legacyPath) return <Navigate replace to={legacyPath} />;

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        title={t("pageTitle")}
        description={t("pageSubtitle")}
        actions={
          <Button
            variant="primary"
            leftIcon={Plus}
            onClick={onNew}
            aria-haspopup={scope === "carrier" ? "dialog" : undefined}
            // Carrier: ro'yxat yuklanmaguncha (yoki umuman olinmasa) yaratib bo'lmaydi — band kuryerlar aniqlanmaydi.
            // Fondagi qayta so'rash yiqilsa (`isError`, ma'lumot keshda) — konsol bilan bir xil, tugma ishlayveradi.
            disabled={scope === "carrier" && carriersQuery.data === undefined}
          >
            {t(meta.neu)}
          </Button>
        }
      />

      {scope === "carrier" ? (
        <CarrierConsole tabs={scopeTabs} />
      ) : isError ? (
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
            {scopeTabs}
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
                onRowClick={(c) => navigate(connectionPath(c.uid))}
                renderCard={renderCard}
                busy={metricsQuery.isFetching && !metricsQuery.isPending}
                className="border-t border-border"
              />
            ) : null}
          </Card>

        </>
      )}

      <NewPartnerModal open={newPartnerOpen} onClose={() => setNewPartnerOpen(false)} onCreated={refetch} />
    </div>
  );
};

export default ConnectionsPage;
