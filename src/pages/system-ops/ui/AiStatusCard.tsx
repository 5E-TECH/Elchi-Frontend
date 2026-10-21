// dizayn-v2: superadmin-ops-system, superadmin-ops-system-loading, superadmin-ops-system-error, superadmin-ops-system-partial, superadmin-ops-system-down, superadmin-ops-system-critical, superadmin-ops-system-ai-config, superadmin-ops-system-ai-cap
import { useEffect, useRef, type ReactNode } from "react";
import { CircleCheck, CircleHelp, CircleX, Info, RefreshCw, TriangleAlert, type LucideIcon } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { useAiAvailability, useAiStatus, type AiModelVerdict } from "../../../entities/ai-order";
import { cx } from "../../../shared/lib/cx";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import { formatPercentLocalized, formatUsdLocalized } from "../../../shared/lib/formatMoney";
import { Meter, type ChartTone } from "../../../shared/ui/charts";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Skeleton,
  StatusBadge,
  TONE_SOFT,
  type Tone,
} from "../../../shared/ui/primitives";
import { OpsAlert } from "../../ops/ui/OpsToolPage";
import { AI_MODEL_ENV, readAiStatus, type AiModelRow, type AiOverall, type AiStatusSummary } from "../lib/aiStatus";

/**
 * «AI holati» kartasi (maketlar `superadmin-ops-system[-ai-config|-ai-cap|-partial|-error|-critical|-down|-loading]`).
 *
 * `GET ai/status` (`silentError`) + gateway bayrog'i `GET orders/ai-availability` (`enabled: false` — «AI o'chiq»).
 * Sarlavhada umumiy holat (Yoqilgan / AI o'chiq / Limit tugadi / Noma'lum) va model belgilari (Zaif / Noma'lum model);
 * ogohlantirishlar (o'chiq sababi, limit tugadi, zaif / noma'lum model); kalit va 3 model kartasi (kalit qiymati hech
 * qachon ko'rsatilmaydi — javobda ham yo'q); «Bugungi limit» o'lchagichi (dollar — `formatUsdLocalized`, S4), jurnalga
 * yozilmagan chaqiruvlar soni. Limitni oshirish faqat serverda (S2) — Ops'da tugma yo'q.
 * Xato: 504 — ichki ogohlantirish + «Qayta urinish» (maket `-down`), boshqasi — bo'sh holat (maket `-critical`).
 * Xom backend matni ko'rsatilmaydi.
 */

/** Kalit egasi — brend nomi, tarjima qilinmaydi (maketdagidek). */
const AI_KEY_PROVIDER = "Anthropic";

/** Backend sukuti (`AI_CAP_WARN_RATIO` = 0,8) — «80% dan oshdi» (maket `superadmin-ops-system-partial`). */
const AI_CAP_WARN_PERCENT = 80;

const OVERALL_TONE: Record<AiOverall, Tone> = {
  enabled: "success",
  off: "neutral",
  capExceeded: "danger",
  unknown: "neutral",
};

const VERDICT_TONE: Record<AiModelVerdict, Tone> = { ok: "success", weak: "danger", unknown: "danger" };
const VERDICT_ICON: Record<AiModelVerdict, LucideIcon> = { ok: CircleCheck, weak: TriangleAlert, unknown: TriangleAlert };

const KEY_TONE: Record<AiStatusSummary["keyState"], Tone> = {
  ok: "success",
  missing: "danger",
  misnamed: "danger",
  unknown: "neutral",
};
const KEY_ICON: Record<AiStatusSummary["keyState"], LucideIcon> = {
  ok: CircleCheck,
  missing: CircleX,
  misnamed: CircleX,
  unknown: CircleHelp,
};

const strong = <strong className="font-semibold text-text" />;

export const AiStatusCard = () => {
  const { t, i18n } = useTranslation("ops");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const query = useAiStatus();
  const availability = useAiAvailability();
  const cardRef = useRef<HTMLElement>(null);
  const focusOnRecovery = useRef(false);

  const gatewayEnabled = availability.isSuccess ? availability.data?.enabled : undefined;
  const summary = query.isError ? null : readAiStatus(query.data, gatewayEnabled);
  const offline = query.isPending && query.fetchStatus === "paused";
  const loading = query.isPending && !offline;
  const failed = !loading && summary === null;

  const hasSummary = summary !== null;
  useEffect(() => {
    if (!hasSummary || !focusOnRecovery.current) return;
    focusOnRecovery.current = false;
    const active = document.activeElement;
    if (!active || active === document.body) cardRef.current?.focus();
  }, [hasSummary]);

  const retry = () => {
    focusOnRecovery.current = true;
    void query.refetch();
    if (availability.isError) void availability.refetch();
  };

  const titleAddon = loading ? (
    <Skeleton shape="circle" tone="border" width={88} height={24} />
  ) : summary ? (
    <>
      <StatusBadge tone={OVERALL_TONE[summary.overall]} label={t(`system.ai.badge.${summary.overall}`)} />
      {summary.weakModels.length > 0 ? (
        <Badge tone="danger" icon={TriangleAlert}>
          {t("system.ai.badge.weakModel")}
        </Badge>
      ) : null}
      {summary.unknownModels.length > 0 ? (
        <Badge tone="danger" icon={TriangleAlert}>
          {t("system.ai.badge.unknownModel")}
        </Badge>
      ) : null}
    </>
  ) : (
    <StatusBadge tone="neutral" label={t("system.ai.badge.unknown")} />
  );

  const status = getErrorStatus(query.error);

  return (
    <Card
      title={t("system.ai.title")}
      titleAddon={titleAddon}
      description={t("system.ai.subtitle")}
      ref={cardRef}
      tabIndex={-1}
      aria-busy={loading || undefined}
      data-ai-state={summary?.overall ?? (loading ? "loading" : offline ? "offline" : "error")}
      bodyClassName="flex flex-col gap-4"
    >
      {loading ? (
        <AiSkeleton label={t("system.ai.loadingLabel")} />
      ) : offline ? (
        <ErrorState kind="offline" onRetry={retry} retrying={query.isFetching} />
      ) : failed && status === 504 ? (
        <div
          role="alert"
          className={cx("flex min-w-0 flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT.danger)}
        >
          <CircleX size={20} aria-hidden="true" className="shrink-0" />
          <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5 text-text">
            <div className="font-bold">{t("system.ai.error.title")}</div>
            <div className="text-[13px] leading-[18px] text-text-muted">{t("system.ai.error.timeout", { status })}</div>
          </div>
          <Button variant="secondary" size="sm" leftIcon={RefreshCw} onClick={retry} loading={query.isFetching}>
            {t("common.retry")}
          </Button>
        </div>
      ) : failed ? (
        <ErrorState
          icon={CircleHelp}
          title={t("system.ai.error.title")}
          description={t("system.ai.error.text")}
          onRetry={retry}
          retrying={query.isFetching}
          retryLabel={t("common.retry")}
          className="py-4"
        />
      ) : summary ? (
        <AiBody summary={summary} language={language} />
      ) : null}
    </Card>
  );
};

const AiSkeleton = ({ label }: { label: string }) => (
  <div role="status" aria-label={label} className="flex flex-col gap-4">
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3 p-0">
      {[0, 1, 2, 3].map((item) => (
        <li key={item} className="flex flex-col gap-2.5 rounded-xl bg-sunken px-4 py-3.5">
          <Skeleton tone="border" width="50%" height={12} />
          <Skeleton tone="border" width="80%" height={14} />
          <Skeleton shape="circle" tone="border" width={64} height={22} />
        </li>
      ))}
    </ul>
    <div className="flex flex-col gap-2">
      <Skeleton tone="border" width="min(200px, 60%)" height={12} />
      <Skeleton shape="circle" tone="border" width="100%" height={8} />
    </div>
  </div>
);

const Tile = ({
  label,
  name,
  badge,
  hint,
  problem,
}: {
  label: string;
  name: string;
  badge: ReactNode;
  hint: string;
  problem: boolean;
}) => (
  <li
    className={cx("flex min-w-0 flex-col gap-1.5 rounded-xl px-4 py-3.5", problem ? "bg-danger-soft" : "bg-sunken")}
    data-problem={problem || undefined}
  >
    <span className="text-xs text-text-muted">{label}</span>
    <span className="text-sm font-semibold text-text wrap-anywhere">{name}</span>
    <span>{badge}</span>
    <span className="text-xs text-text-muted">{hint}</span>
  </li>
);

const AiBody = ({ summary, language }: { summary: AiStatusSummary; language: string }) => {
  const { t } = useTranslation("ops");
  const usd = (value: number) => formatUsdLocalized(value, { language });
  const { cap, overall } = summary;
  const off = overall === "off";
  const capKnown = cap.state !== "unknown";
  const percent = formatPercentLocalized(cap.percent, { language, fractionDigits: 0 });

  const modelName = (row: AiModelRow) => row.model || "—";

  const modelHint = (row: AiModelRow) => {
    const extra =
      row.verdict === "unknown"
        ? t("system.ai.modelHint.unknown")
        : row.slot === "classify" && row.verdict === "ok"
          ? t("system.ai.modelHint.classifyOk")
          : null;
    return extra ? `${AI_MODEL_ENV[row.slot]} · ${extra}` : AI_MODEL_ENV[row.slot];
  };

  // ── Ogohlantirishlar ───────────────────────────────────────────────────────
  const alerts: ReactNode[] = summary.offReasons.map((reason) => (
    <OpsAlert key={`off-${reason}`} tone="warning" icon={Info} title={t(`system.ai.off.${reason}.title`)}>
      <Trans t={t} i18nKey={`system.ai.off.${reason}.text`} components={{ strong }} />
    </OpsAlert>
  ));
  if (overall === "capExceeded") {
    alerts.push(
      <OpsAlert key="cap" tone="danger" icon={TriangleAlert} title={t("system.ai.capExceeded.title")}>
        {t("system.ai.capExceeded.text", { cap: usd(cap.effectiveCapUsd) })}
      </OpsAlert>,
    );
  }
  if (!capKnown && !off) {
    alerts.push(
      <OpsAlert key="cap-unknown" tone="warning" title={t("system.ai.capUnknown.title")}>
        {t("system.ai.capUnknown.text")}
      </OpsAlert>,
    );
  }
  for (const row of summary.weakModels) {
    alerts.push(
      <OpsAlert key={`weak-${row.slot}`} tone="danger" icon={TriangleAlert} title={t("system.ai.weak.title")}>
        <Trans
          t={t}
          i18nKey="system.ai.weak.text"
          values={{ purpose: t(`system.ai.purpose.${row.slot}`), model: modelName(row) }}
          components={{ strong }}
        />{" "}
        {t(off ? "system.ai.weak.fixOff" : "system.ai.weak.fixOn")}
      </OpsAlert>,
    );
  }
  for (const row of summary.unknownModels) {
    alerts.push(
      <OpsAlert
        key={`unknown-${row.slot}`}
        tone="danger"
        icon={TriangleAlert}
        title={t("system.ai.unknownModel.title", { purpose: t(`system.ai.purposeInline.${row.slot}`) })}
      >
        <Trans t={t} i18nKey="system.ai.unknownModel.text" values={{ model: modelName(row) }} components={{ strong }} />{" "}
        {t(overall === "enabled" ? "system.ai.unknownModel.impactOn" : "system.ai.unknownModel.impactOff")}{" "}
        {t("system.ai.unknownModel.fix")}
      </OpsAlert>,
    );
  }

  // ── Bugungi limit ──────────────────────────────────────────────────────────
  const capBadge =
    cap.state === "exceeded" ? (
      <Badge tone="danger" icon={CircleX}>
        {t("system.ai.cap.exceeded")}
      </Badge>
    ) : cap.state === "warn" ? (
      <Badge tone="warning" icon={TriangleAlert}>
        {t("system.ai.cap.warn", {
          threshold: formatPercentLocalized(AI_CAP_WARN_PERCENT, { language, fractionDigits: 0 }),
        })}
      </Badge>
    ) : !capKnown ? (
      <Badge icon={CircleHelp}>{t("system.ai.cap.unknown")}</Badge>
    ) : null;

  const meterTone: ChartTone | undefined =
    cap.state === "exceeded" ? "danger" : cap.state === "warn" ? "warning" : undefined;

  const note = (() => {
    if (!capKnown) return t("system.ai.cap.unknownText");
    if (off) return cap.spentUsd > 0 ? t("system.ai.cap.offSpent") : t("system.ai.cap.offIdle");
    const base = usd(cap.capUsd);
    const parts: string[] = [];
    if (cap.overrideUsd > 0) parts.push(t("system.ai.cap.override", { base, extra: usd(cap.overrideUsd) }));
    if (cap.state === "exceeded") {
      parts.push(t("system.ai.cap.resetExceeded"), t("system.ai.cap.serverOnly"));
    } else {
      parts.push(cap.overrideUsd > 0 ? t("system.ai.cap.resetOverride", { base }) : t("system.ai.cap.reset"));
    }
    return parts.join(" · ");
  })();

  const values = { spent: usd(cap.spentUsd), cap: usd(cap.effectiveCapUsd), percent };

  return (
    <>
      {alerts}

      <ul
        aria-label={t("system.ai.settingsLabel")}
        className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3 p-0"
      >
        <Tile
          label={t("system.ai.key.label")}
          name={AI_KEY_PROVIDER}
          badge={
            <Badge tone={KEY_TONE[summary.keyState]} icon={KEY_ICON[summary.keyState]}>
              {t(`system.ai.key.state.${summary.keyState}`)}
            </Badge>
          }
          hint={t(`system.ai.key.hint.${summary.keyState}`)}
          problem={summary.keyState === "misnamed"}
        />
        {summary.models.map((row) => (
          <Tile
            key={row.slot}
            label={t(`system.ai.models.${row.slot}`)}
            name={modelName(row)}
            badge={
              <Badge tone={VERDICT_TONE[row.verdict]} icon={VERDICT_ICON[row.verdict]}>
                {t(`system.ai.verdict.${row.verdict}`)}
              </Badge>
            }
            hint={modelHint(row)}
            problem={row.verdict !== "ok"}
          />
        ))}
      </ul>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h3 className="text-sm font-semibold text-text">{t("system.ai.cap.title")}</h3>
          <span className="inline-flex flex-wrap items-center gap-2">
            {capBadge}
            {capKnown ? (
              <span className="text-sm font-semibold whitespace-nowrap text-text tabular-nums">
                {t("system.ai.cap.value", values)}
              </span>
            ) : null}
          </span>
        </div>
        {capKnown && !off ? (
          <Meter value={cap.percent} max={100} tone={meterTone} ariaLabel={t("system.ai.cap.aria", values)} />
        ) : null}
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-text-muted">
          <span>{note}</span>
          <span className="inline-flex items-center gap-1.5">
            {t("system.ai.cap.persist")}{" "}
            {summary.persistFailures > 0 ? (
              <Badge tone="warning" icon={TriangleAlert}>
                {t("common.count", { count: summary.persistFailures })}
              </Badge>
            ) : (
              <span className="font-semibold text-text">{t("common.count", { count: 0 })}</span>
            )}
          </span>
        </div>
      </div>
    </>
  );
};
