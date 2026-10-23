// dizayn-v2: superadmin-ops-system, superadmin-ops-system-loading, superadmin-ops-system-error, superadmin-ops-system-partial, superadmin-ops-system-down, superadmin-ops-system-critical
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  CircleCheck,
  CircleQuestionMark,
  CircleX,
  RefreshCw,
  ServerOff,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMiscCoverage } from "../../../entities/coverage/miscCoverage";
import { cx } from "../../../shared/lib/cx";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import {
  Badge,
  Button,
  Card,
  DataTable,
  ErrorState,
  Pressable,
  Skeleton,
  StatusBadge,
  TONE_SOFT,
  type DataTableColumn,
  type Tone,
} from "../../../shared/ui/primitives";
import {
  HEALTH_SERVICE_KEYS,
  capitalize,
  joinList,
  readReadiness,
  type HealthLevel,
  type HealthService,
  type HealthSummary,
  type ServiceState,
} from "../lib/systemHealth";

/**
 * «Tizim holati» kartasi (maketlar `superadmin-ops-system[-loading|-error|-partial|-down|-critical]`).
 *
 * `GET /health/readiness` (200 | 503): sarlavhada umumiy holat badge'i + «N ta xizmat · vaqt tekshirildi» + «Yangilash»;
 * xulosa qatori (ikonka, sarlavha, izoh, sanoq badge'lari); «Xizmatlar ro'yxati» ochiladi — desktop/planshetda
 * ixcham jadval, telefonda kartalar. Hammasi ishlasa ro'yxat yopiq, aks holda ochiq turadi (maketdagidek).
 * Xizmatning xom `error` matni ko'rsatilmaydi — faqat sabab turi bo'yicha i18n matn.
 *
 * Foydalanuvchi ro'yxatni qo'lda ochib/yopgan bo'lsa, bu tanlov faqat o'sha darajada (ok/partial/…) amal qiladi —
 * daraja o'zgarsa yana maket qoidasi ishlaydi («biror narsa ishlamasa — ochiq»).
 * Oflayn (so'rov `paused`) — cheksiz skelet emas, «Internet aloqasi yo'q». Xatodan «Qayta urinish» bilan tiklansa,
 * fokus kartaga o'tadi (tugma yo'qolib, fokus `<body>` ga tushmasin).
 */

const LEVEL_TONE: Record<HealthLevel, Tone> = { ok: "success", partial: "warning", critical: "danger", down: "danger" };
const LEVEL_ICON: Record<HealthLevel, LucideIcon> = {
  ok: CircleCheck,
  partial: TriangleAlert,
  critical: CircleX,
  down: CircleX,
};
const LEVEL_BADGE: Record<HealthLevel, "ok" | "partial" | "down"> = {
  ok: "ok",
  partial: "partial",
  critical: "down",
  down: "down",
};
const STATE_TONE: Record<ServiceState, Tone> = { ok: "success", down: "danger", unknown: "neutral" };

/** Yuklanishda ro'yxat skeleti — 4 qator (maket `superadmin-ops-system-loading`). */
const SKELETON_ROWS = ["60%", "44%", "52%", "70%"];

export const HealthCard = () => {
  const { t, i18n } = useTranslation("ops");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { useGetHealthReadiness } = useMiscCoverage();
  const query = useGetHealthReadiness({ silentError: true });
  const listId = useId();
  const [expandedOverride, setExpandedOverride] = useState<{ level: HealthLevel; expanded: boolean } | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const focusOnRecovery = useRef(false);

  const summary = query.isError ? null : readReadiness(query.data);
  const offline = query.isPending && query.fetchStatus === "paused";
  const loading = query.isPending && !offline;
  const failed = !loading && summary === null;
  const fetching = query.isFetching;

  const hasSummary = summary !== null;
  useEffect(() => {
    if (!hasSummary || !focusOnRecovery.current) return;
    focusOnRecovery.current = false;
    const active = document.activeElement;
    if (!active || active === document.body) cardRef.current?.focus();
  }, [hasSummary]);

  const ms = (value: number) => t("system.health.ms", { value: formatNumberLocalized(value, { language }) });
  const serviceName = (service: HealthService) =>
    service.known ? t(`system.health.services.${service.key}.name`) : service.key;
  const serviceArea = (service: HealthService) =>
    service.known ? t(`system.health.services.${service.key}.area`) : service.key;
  const list = (items: readonly string[]) => joinList(items, t("system.health.and"));
  const checkedAt = query.dataUpdatedAt > 0 ? formatDateTimeLocalized(query.dataUpdatedAt, { language }) : null;
  const total = summary?.total ?? HEALTH_SERVICE_KEYS.length;

  const refresh = () => {
    void query.refetch();
  };
  const retry = () => {
    focusOnRecovery.current = true;
    refresh();
  };

  // ── Sarlavha ───────────────────────────────────────────────────────────────
  const headerBadge = loading ? (
    <Skeleton shape="circle" tone="border" width={96} height={24} />
  ) : summary ? (
    <StatusBadge tone={LEVEL_TONE[summary.level]} label={t(`system.health.badge.${LEVEL_BADGE[summary.level]}`)} />
  ) : (
    <StatusBadge tone="neutral" label={t("system.health.badge.unknown")} />
  );

  const meta = loading
    ? t("system.health.metaChecking", { count: total })
    : failed
      ? checkedAt
        ? t("system.health.lastSuccess", { time: checkedAt })
        : t("system.health.neverChecked")
      : t("system.health.meta", { count: total, time: checkedAt ?? "" });

  const refreshButton = (
    <Button
      variant="ghost"
      size="sm"
      leftIcon={RefreshCw}
      loading={fetching && !loading}
      disabled={fetching}
      onClick={refresh}
    >
      {fetching ? t("system.health.checking") : t("system.health.refresh")}
    </Button>
  );

  return (
    <Card
      padding="none"
      title={t("system.health.title")}
      titleAddon={headerBadge}
      description={meta}
      actions={refreshButton}
      ref={cardRef}
      tabIndex={-1}
      aria-busy={loading || undefined}
      data-health-level={summary?.level ?? (loading ? "loading" : offline ? "offline" : "error")}
    >
      {loading ? (
        <HealthSkeleton label={t("system.health.loadingLabel")} />
      ) : offline ? (
        <ErrorState kind="offline" onRetry={retry} retrying={fetching} className="py-7" />
      ) : failed ? (
        <ErrorState
          icon={ServerOff}
          title={t("system.health.error.title")}
          description={
            <>
              {t("system.health.error.text")}
              {getErrorStatus(query.error) != null ? (
                <span className="mt-1 block text-xs text-text-subtle">
                  {t("system.health.error.code", { status: getErrorStatus(query.error) })}
                </span>
              ) : null}
            </>
          }
          onRetry={retry}
          retrying={fetching}
          retryLabel={t("common.retry")}
          className="py-7"
        />
      ) : summary ? (
        <HealthBody
          summary={summary}
          expanded={
            expandedOverride?.level === summary.level ? expandedOverride.expanded : summary.level !== "ok"
          }
          onToggle={() =>
            setExpandedOverride((prev) => ({
              level: summary.level,
              expanded: !(prev?.level === summary.level ? prev.expanded : summary.level !== "ok"),
            }))
          }
          listId={listId}
          ms={ms}
          serviceName={serviceName}
          serviceArea={serviceArea}
          list={list}
        />
      ) : null}
    </Card>
  );
};

const HealthSkeleton = ({ label }: { label: string }) => (
  <div role="status" aria-label={label}>
    <div className="flex items-center gap-3.5 px-5 py-4">
      <Skeleton shape="circle" tone="border" width={44} height={44} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton tone="border" width="min(220px, 70%)" height={14} />
        <Skeleton tone="border" width="min(360px, 90%)" height={12} />
      </div>
    </div>
    <ul className="m-0 flex list-none flex-col border-t border-border p-0">
      {SKELETON_ROWS.map((width) => (
        <li key={width} className="flex min-h-14 items-center gap-4 border-b border-border px-4 py-3 last:border-b-0">
          <span className="min-w-0 flex-1">
            <Skeleton tone="border" width={width} height={12} />
          </span>
          <Skeleton shape="circle" tone="border" width={88} height={22} />
        </li>
      ))}
    </ul>
  </div>
);

type BodyProps = {
  summary: HealthSummary;
  expanded: boolean;
  onToggle: () => void;
  listId: string;
  ms: (value: number) => string;
  serviceName: (service: HealthService) => string;
  serviceArea: (service: HealthService) => string;
  list: (items: readonly string[]) => string;
};

const HealthBody = ({ summary, expanded, onToggle, listId, ms, serviceName, serviceArea, list }: BodyProps) => {
  const { t } = useTranslation("ops");
  const Icon = LEVEL_ICON[summary.level];
  const tone = LEVEL_TONE[summary.level];
  const unknownNames = list(summary.unknown.map(serviceArea));

  const { title, text } = ((): { title: string; text: string } => {
    switch (summary.level) {
      case "down":
        return {
          title: t("system.health.summary.downTitle"),
          text: t(summary.allTimedOut ? "system.health.summary.downTextTimeout" : "system.health.summary.downText", {
            count: summary.downCount,
          }),
        };
      case "critical": {
        const impact = summary.coreDown.map((service) => t(`system.health.impact.${service.key}`)).join(" ");
        const rest =
          summary.unknownCount > 0
            ? t(
                summary.unknownCount > 1
                  ? "system.health.summary.criticalRestUnknownMany"
                  : "system.health.summary.criticalRestUnknown",
                { count: summary.okCount, names: unknownNames },
              )
            : t("system.health.summary.criticalRest", { count: summary.okCount });
        const aux =
          summary.auxDown.length > 0 ? ` ${t("system.health.summary.criticalAux", { count: summary.auxDown.length })}` : "";
        return {
          title: t(
            summary.coreDown.length === 1
              ? "system.health.summary.criticalTitleOne"
              : "system.health.summary.criticalTitleMany",
            { names: summary.coreDown.map(serviceName).join(", ") },
          ),
          text: `${impact} ${rest}.${aux}`,
        };
      }
      case "partial": {
        // `areasStart` — gap boshida (uz), `areas` — gap o'rtasida (ru/en): bosh harf faqat gap boshida.
        const areas = list(summary.auxDown.map(serviceArea));
        return {
          title: t("system.health.summary.partialTitle", { count: summary.downCount }),
          text: t("system.health.summary.partialText", {
            total: summary.total,
            ok: summary.okCount,
            areas,
            areasStart: capitalize(areas),
          }),
        };
      }
      default:
        if (summary.unknownCount > 0) {
          return {
            title: t("system.health.summary.okUnknownTitle"),
            text: t(summary.unknownCount > 1 ? "system.health.summary.okUnknownTextMany" : "system.health.summary.okUnknownText", {
              total: summary.total,
              ok: summary.okCount,
              names: unknownNames,
            }),
          };
        }
        return {
          title: t("system.health.summary.okTitle"),
          text: [
            t("system.health.summary.okText", { total: summary.total, ok: summary.okCount }),
            summary.averageLatencyMs != null
              ? t("system.health.summary.okLatency", { value: ms(summary.averageLatencyMs) })
              : null,
          ]
            .filter(Boolean)
            .join(" · "),
        };
    }
  })();

  const problemText = (service: HealthService) => {
    if (!service.problem) return null;
    const base = `system.health.problem.${service.problem}`;
    const hint =
      service.problem === "reported" && service.key === "NOTIFICATION"
        ? t(`${base}.hintNotification`)
        : t(`${base}.hint`, { area: serviceArea(service) });
    return { title: t(`${base}.title`), hint };
  };

  const subLabel = (service: HealthService) =>
    service.core ? `${service.key} · ${t("system.health.core")}` : service.key;

  const latency = (service: HealthService): ReactNode =>
    service.latencyMs == null ? "—" : ms(service.latencyMs);

  const columns: DataTableColumn<HealthService>[] = [
    {
      id: "service",
      header: t("system.health.columns.service"),
      cell: (service) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-semibold text-text">{serviceName(service)}</span>
          <span className="text-[13px] whitespace-nowrap text-text-muted">{subLabel(service)}</span>
        </div>
      ),
    },
    {
      id: "status",
      header: t("system.health.columns.status"),
      headerClassName: "w-[136px]",
      cell: (service) => <StatusBadge tone={STATE_TONE[service.state]} label={t(`system.health.state.${service.state}`)} />,
    },
    {
      id: "latency",
      header: t("system.health.columns.latency"),
      align: "end",
      headerClassName: "w-28 whitespace-nowrap",
      cell: (service) => (
        <span className={cx("whitespace-nowrap tabular-nums", service.state === "ok" ? "text-text" : "text-text-muted")}>
          {latency(service)}
        </span>
      ),
    },
    {
      id: "error",
      header: t("system.health.columns.error"),
      cell: (service) => {
        const problem = problemText(service);
        if (!problem) return <span className="text-text-subtle">—</span>;
        return (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-text">{problem.title}</span>
            <span className="text-[13px] text-text-muted max-lg:hidden">{problem.hint}</span>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
        <span
          aria-hidden="true"
          className={cx("inline-flex size-11 flex-none items-center justify-center rounded-xl", TONE_SOFT[tone])}
        >
          <Icon size={22} />
        </span>
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-text">{title}</h3>
          <p className="text-[13px] text-text-muted">{text}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge icon={CircleCheck}>{t("system.health.counts.ok", { count: summary.okCount })}</Badge>
          <Badge tone={summary.downCount > 0 ? "danger" : "neutral"} icon={CircleX}>
            {t("system.health.counts.down", { count: summary.downCount })}
          </Badge>
          {summary.unknownCount > 0 ? (
            <Badge icon={CircleQuestionMark}>{t("system.health.counts.unknown", { count: summary.unknownCount })}</Badge>
          ) : null}
        </div>
      </div>

      <Pressable
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={onToggle}
        className="flex min-h-12 w-full items-center justify-between gap-3 border-t border-border px-5 text-left text-sm font-semibold text-text hover:bg-row-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-action"
      >
        <span>
          {expanded ? t("system.health.list.hide") : t("system.health.list.show")}{" "}
          <span className="font-normal text-text-muted">{t("system.health.list.count", { count: summary.total })}</span>
        </span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={cx("flex-none text-text-subtle transition-transform motion-reduce:transition-none", expanded && "rotate-180")}
        />
      </Pressable>

      {expanded ? (
        <div id={listId} className="border-t border-border">
          <DataTable
            rows={summary.services}
            columns={columns}
            getRowKey={(service) => service.key}
            label={t("system.health.list.label")}
            density="compact"
            renderCard={(service) => {
              const problem = problemText(service);
              const latencyText = service.latencyMs == null ? null : ms(service.latencyMs);
              return (
                <div className="flex min-w-0 items-start gap-3 px-4 py-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-semibold text-text">{serviceName(service)}</span>
                    <span className="text-xs text-text-muted">
                      {[subLabel(service), latencyText].filter(Boolean).join(" · ")}
                    </span>
                    {problem ? <span className="mt-0.5 text-[13px] text-text">{problem.title}</span> : null}
                  </div>
                  <StatusBadge
                    tone={STATE_TONE[service.state]}
                    label={t(`system.health.state.${service.state}`)}
                    className="flex-none"
                  />
                </div>
              );
            }}
          />
        </div>
      ) : null}
    </>
  );
};
