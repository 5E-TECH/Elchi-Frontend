// dizayn-v2: superadmin-ai-assistant, superadmin-ai-assistant-limit-reached
import { useTranslation } from "react-i18next";
import { Clock, Lock, TriangleAlert } from "lucide-react";
import { Card } from "../../../shared/ui/primitives";
import { Meter } from "../../../shared/ui/charts";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { NoticeAlert } from "../../../entities/notification/ui/NoticeAlert";
import type { AiAccessState } from "../../../entities/ai-advisor";
import { limitView, type LimitView } from "../model/limit";

/**
 * «Bugungi limit» (maket: yon ustun kartasi — `.el-meter`, izoh, «Faqat o'qish» qatori; < 1024 — ingichka o'lchagich
 * qatori; tugaganda — `-limit-reached`: ogohlantirish rangidagi o'lchagich, «Limit tugadi — …», kiritish ustida
 * ogohlantirish qutisi). Limit yaqin (≤ 5 savol) — «N ta savol qoldi · …» + ogohlantirish rangi. «Oylik budjet» va
 * «Sarfni ko'rish» chizilmaydi (T2 budjeti backend'da yo'q).
 */

const useLimitTexts = (view: LimitView) => {
  const { t } = useTranslation("aiAdvisor");
  const used = formatNumberLocalized(view.used);
  const limit = formatNumberLocalized(view.limit);
  return {
    value: t("limit.value", { used, limit }),
    meterLabel: t("limit.meterLabel", { used, limit }),
  };
};

export const ReadOnlyNote = () => {
  const { t } = useTranslation("aiAdvisor");
  return (
    <div className="flex items-start gap-2.5">
      <Lock size={16} aria-hidden="true" className="mt-0.5 flex-none text-text-muted" />
      <p className="text-xs leading-normal text-text-muted">{t("readOnly")}</p>
    </div>
  );
};

/** Yon ustun kartasi (≥ 1024). */
export const LimitCard = ({ access }: { access: AiAccessState }) => {
  const { t } = useTranslation("aiAdvisor");
  const view = limitView(access);
  const texts = useLimitTexts(view);
  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-text">{t("limit.title")}</h2>
          <span className="whitespace-nowrap text-sm font-semibold text-text">{texts.value}</span>
        </div>
        <Meter
          value={view.used}
          max={view.limit || 1}
          tone={view.reached || view.near ? "warning" : undefined}
          ariaLabel={texts.meterLabel}
        />
        {view.reached ? (
          <p className="text-xs text-text-muted">{t("limit.reached")}</p>
        ) : view.near ? (
          <p className="flex items-start gap-1.5 text-xs text-text-muted">
            <TriangleAlert size={14} aria-hidden="true" className="mt-0.5 flex-none text-warning-fg" />
            <span>{t("limit.near", { count: view.remaining, value: formatNumberLocalized(view.remaining) })}</span>
          </p>
        ) : (
          <p className="text-xs text-text-muted">
            {t("limit.hint", { count: view.remaining, value: formatNumberLocalized(view.remaining) })}
          </p>
        )}
        <div className="border-t border-border pt-3">
          <ReadOnlyNote />
        </div>
      </div>
    </Card>
  );
};

/** < 1024: ingichka o'lchagich qatori («Suhbatlar» tugmasi yonida). */
export const LimitRow = ({ access }: { access: AiAccessState }) => {
  const { t } = useTranslation("aiAdvisor");
  const view = limitView(access);
  const texts = useLimitTexts(view);
  return (
    <div className="flex min-w-0 flex-[1_1_180px] flex-col gap-1.5">
      <div className="flex justify-between gap-2">
        <span className="text-xs text-text-muted">{t("limit.title")}</span>
        <span className="whitespace-nowrap text-xs font-semibold text-text">{texts.value}</span>
      </div>
      <Meter
        value={view.used}
        max={view.limit || 1}
        thickness="thin"
        tone={view.reached || view.near ? "warning" : undefined}
        ariaLabel={texts.meterLabel}
      />
    </div>
  );
};

/** Limit tugadi — kiritish ustida (`-limit-reached`: `Clock` ikonkasi; «Hisobotlarga o'tish» — T2, chizilmaydi). */
export const LimitAlert = ({ access }: { access: AiAccessState }) => {
  const { t } = useTranslation("aiAdvisor");
  return (
    <NoticeAlert tone="warning" icon={Clock} title={t("limit.alertTitle", { limit: formatNumberLocalized(access.dailyLimit) })}>
      {t("limit.alertText")}
    </NoticeAlert>
  );
};
