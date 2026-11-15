// dizayn-v2: superadmin-ai-assistant-alert-dialog, superadmin-ai-assistant-alert-dialog-receipt
import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Info, RefreshCw, Sparkles } from "lucide-react";
import type { AiAdvisorAlertDetail } from "../../../entities/ai-advisor";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { MiniMarkdown } from "../../../shared/ui/markdown/MiniMarkdown";
import { Button, Skeleton, Spinner } from "../../../shared/ui/primitives";
import { explanationView, type ExplanationView } from "../model/explanationView";
import { useExplainAlert } from "../model/useAlertMutations";

export type ExplanationSectionProps = {
  alert: AiAdvisorAlertDetail;
  /** 60 s kutish tugadi, izoh hali `pending` (`useExplanationPoll`). */
  expired: boolean;
  /** Izoh qayta so'ralib `pending` bo'ldi — 60 s yangidan. */
  onRestart: () => void;
};

const TEXT = "m-0 text-[13px] text-text-muted";

/**
 * «AI izohi» bloki (maket `superadmin-ai-assistant-alert-dialog` va «Boshqa holatlar»; `-courier-debt` — kunlik
 * umumiy chegara, `-expense` — oylik budjet): `sunken` quti, sarlavha `Sparkles` bilan. «Sarfni ko'rish» — backend
 * yo'q (BE-1), chizilmaydi. Xato matnlari `ai-advisor` shartnomasi §7.4 bo'yicha.
 */
export const ExplanationSection = ({ alert, expired, onRestart }: ExplanationSectionProps) => {
  const { t, i18n } = useTranslation("aiAdvisor");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const titleId = useId();
  const hintId = useId();
  const explain = useExplainAlert();
  const view = explanationView(alert, explain.error, expired);
  if (view.kind === "hidden") return null;

  const request = () =>
    explain.mutate(alert.id, {
      onSuccess: (result) => {
        if (result.explanation_status === "pending") onRestart();
      },
    });

  const requestButton = (label: string, { disabled = false, icon = Sparkles }: { disabled?: boolean; icon?: typeof Sparkles } = {}) => (
    <Button
      variant="secondary"
      size="sm"
      leftIcon={icon}
      loading={explain.isPending}
      disabled={disabled}
      aria-describedby={hintId}
      onClick={request}
      className="self-start"
    >
      {label}
    </Button>
  );

  const budgetText = (budget: Extract<ExplanationView, { kind: "budget" }>) => {
    if (budget.scope === "advisor" && budget.period !== "day") {
      return budget.retryAt
        ? t("alerts.explain.budgetMonth", { at: formatDateTimeLocalized(budget.retryAt, { language, relative: false }) })
        : t("alerts.explain.budgetMonthNoDate");
    }
    // Kunlik (umumiy yoki yordamchining kunlik) chegarasi: jiddiy ogohlantirish izohi avtomatik so'raladi.
    return alert.severity === "critical" && alert.explanation_status === "failed"
      ? t("alerts.explain.budgetDailyAuto")
      : t("alerts.explain.budgetDaily");
  };

  let body: ReactNode;
  switch (view.kind) {
    case "ready":
      body = (
        <>
          {/* Maket: izoh matni `.el-small` (13 px, qator 20 px) — suhbat javobidan (14 px) ixchamroq. */}
          <div className="[&_li]:leading-5 [&_p]:leading-5 [&>div]:text-[13px]">
            <MiniMarkdown source={view.markdown} />
          </div>
          <p className="m-0 flex items-start gap-1.5 text-xs text-text-muted">
            <Info aria-hidden="true" size={16} strokeWidth={2} className="shrink-0" />
            <span className="min-w-0">{t("chat.disclaimer")}</span>
          </p>
        </>
      );
      break;
    case "pending":
      body = (
        <div role="status" className="flex flex-col gap-2.5">
          <span className="inline-flex items-center gap-2 text-[13px] text-text-muted">
            <Spinner size="sm" />
            {t("alerts.explain.pending")}
          </span>
          <Skeleton width="92%" height={12} />
          <Skeleton width="64%" height={12} />
        </div>
      );
      break;
    case "expired":
      body = (
        <>
          <p id={hintId} role="status" className={TEXT}>
            {t("alerts.explain.expired")}
          </p>
          {requestButton(t("alerts.explain.retry"), { icon: RefreshCw })}
        </>
      );
      break;
    case "budget":
      body = (
        <>
          <p id={hintId} className={TEXT}>
            {budgetText(view)}
          </p>
          {requestButton(t("alerts.explain.request"), { disabled: true })}
        </>
      );
      break;
    case "failed":
    case "request":
      body = (
        <>
          <p id={hintId} role={view.kind === "request" ? "alert" : undefined} className={TEXT}>
            {t(view.kind === "failed" ? "alerts.explain.failed" : "alerts.explain.requestFailed")}
          </p>
          {requestButton(t("alerts.explain.retry"), { icon: RefreshCw })}
        </>
      );
      break;
    case "disabled":
      body = (
        <>
          <p id={hintId} role="alert" className={TEXT}>
            {t("alerts.explain.disabled")}
          </p>
          {requestButton(t("alerts.explain.request"))}
        </>
      );
      break;
    default:
      body = (
        <>
          <p id={hintId} className={TEXT}>
            {t("alerts.explain.none")}
          </p>
          {requestButton(t("alerts.explain.request"))}
        </>
      );
  }

  return (
    <section
      aria-labelledby={titleId}
      data-testid="ai-alert-explanation"
      data-state={view.kind}
      className="flex flex-col gap-2 rounded-xl bg-sunken px-4 py-3.5"
    >
      <div className="flex items-center gap-2">
        <Sparkles aria-hidden="true" size={18} strokeWidth={2} className="shrink-0 text-text-muted" />
        <h3 id={titleId} className="m-0 text-sm font-semibold text-text">
          {t("alerts.explain.title")}
        </h3>
        {view.kind === "ready" && view.at ? (
          <span className="ml-auto text-xs whitespace-nowrap text-text-muted">{formatDateTimeLocalized(view.at, { language })}</span>
        ) : null}
      </div>
      {body}
    </section>
  );
};
