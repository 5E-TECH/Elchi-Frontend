// dizayn-v2: superadmin-neworders-create-manual-step1, superadmin-neworders-create-manual-step2, manager-new-orders-create-manual-step1, manager-new-orders-create-manual-step2
import { memo } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../../shared/lib/cx";
import { Button } from "../../../../shared/ui/primitives";

type OrderStepperProps = {
  /** Joriy qadam: 1 — market tanlash, 2 — mijoz va mahsulotlar. */
  step: 1 | 2;
  /** Tanlangan market nomi — 2-qadamda bajarilgan 1-qadam o'rnida ko'rinadi. */
  marketName?: string;
  /** «O'zgartirish» — 1-qadamga qaytish (market saqlanadi). Berilmasa havola yo'q. */
  onChangeMarket?: () => void;
};

/** Qadam doirasi (32 px): joriy — `action`, bajarilgan — `success-soft` + `Check`, keyingisi — `sunken`. */
const CIRCLE = "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold";

/**
 * QADAMLAR — maketdagi `nav.el-card` «Qadamlar» (`*-create-manual-step1`, `*-create-manual-step2`).
 * Ikki qadam bitta qatorda, oralig'ida chiziq; telefonda (< 768) ustma-ust, chiziqsiz.
 * Joriy qadamda `aria-current="step"`.
 */
const OrderStepper = ({ step, marketName, onChangeMarket }: OrderStepperProps) => {
  const { t } = useTranslation("orders");
  const marketDone = step > 1;

  return (
    <nav aria-label={t("createStepsLabel")} className="min-w-0 rounded-[14px] border border-border bg-surface p-5">
      <ol className="flex min-w-0 items-center gap-4 text-sm max-md:flex-col max-md:items-stretch max-md:gap-3">
        <li aria-current={step === 1 ? "step" : undefined} className="flex min-w-0 items-center gap-3">
          {marketDone ? (
            <span className={cx(CIRCLE, "bg-success-soft text-success-fg")}>
              <Check size={16} aria-hidden="true" />
            </span>
          ) : (
            <span className={cx(CIRCLE, "bg-action text-on-solid")}>1</span>
          )}
          <span className="flex min-w-0 flex-col">
            <span className="text-xs text-text-muted">
              {marketDone ? t("createStepMarketDone") : t("createStepNumber", { step: 1 })}
            </span>
            <span className="truncate font-semibold text-text">
              {marketDone && marketName ? marketName : t("selectMarketTitle")}
            </span>
          </span>
          {marketDone && onChangeMarket ? (
            <Button
              variant="link"
              className="ml-1 shrink-0"
              aria-label={t("createChangeMarketAria")}
              onClick={onChangeMarket}
            >
              {t("createChangeMarket")}
            </Button>
          ) : null}
        </li>
        <li aria-hidden="true" className="h-px min-w-6 flex-1 bg-border max-md:hidden" />
        <li aria-current={step === 2 ? "step" : undefined} className="flex min-w-0 items-center gap-3">
          <span
            className={cx(
              CIRCLE,
              step === 2 ? "bg-action text-on-solid" : "border border-border-strong bg-sunken text-text-muted",
            )}
          >
            2
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-xs text-text-muted">{t("createStepNumber", { step: 2 })}</span>
            <span className="truncate font-semibold text-text">{t("createStepDetailsTitle")}</span>
          </span>
        </li>
      </ol>
    </nav>
  );
};

export default memo(OrderStepper);
