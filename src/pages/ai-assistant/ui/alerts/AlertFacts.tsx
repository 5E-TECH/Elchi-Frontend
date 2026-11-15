// dizayn-v2: superadmin-ai-assistant-alert-dialog, superadmin-ai-assistant-alert-dialog-receipt
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../../shared/lib/cx";
import { formatSignedMoneyLocalized } from "../../../../shared/lib/formatMoney";

export type AlertFact = {
  id: string;
  label: ReactNode;
  value: ReactNode;
};

export type AlertFactsProps = {
  facts: ReadonlyArray<AlertFact | null | false | undefined>;
  /**
   * `auto` — ustun eni ≥ 260 px (telefonda bitta ustun; maket R1); `2` — doim ikki ustun (maket R7 — telefonda ham);
   * `rows` — ustma-ust qatorlar: chapda yorliq, o'ngda qiymat, oralarida chiziq (maket R7 «Karta qoldig'ida farq»).
   */
  columns?: "auto" | 2 | "rows";
  className?: string;
};

const GRID: Record<"auto" | 2, string> = {
  auto: "grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))]",
  2: "grid-cols-2",
};

/**
 * Ogohlantirish faktlari — `sunken` quti ichida `dl` (maket: panjara — `padding 14px 16px`, oraliq 12 × 24, yorliq
 * `text-xs text-text-muted`, qiymat `.el-strong`; qatorlar — `padding 4px 16px`, har qator 8 px, yorliq `.el-muted`,
 * qiymat o'ngda). Bo'sh (`null`) qatorlar tashlab ketiladi.
 */
export const AlertFacts = ({ facts, columns = "auto", className }: AlertFactsProps) => {
  const { t } = useTranslation("aiAdvisor");
  const items = facts.filter((fact): fact is AlertFact => Boolean(fact));
  if (!items.length) return null;
  if (columns === "rows") {
    return (
      <dl aria-label={t("alerts.facts.label")} className={cx("m-0 flex flex-col rounded-xl bg-sunken px-4 py-1 text-sm", className)}>
        {items.map((fact, index) => (
          <div
            key={fact.id}
            className={cx("flex flex-wrap justify-between gap-x-3 gap-y-1 py-2", index > 0 && "border-t border-border")}
          >
            <dt className="text-text-muted">{fact.label}</dt>
            <dd className="m-0 ml-auto min-w-0 text-right font-semibold [overflow-wrap:anywhere] text-text">{fact.value}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <dl
      aria-label={t("alerts.facts.label")}
      className={cx("m-0 grid gap-x-6 gap-y-3 rounded-xl bg-sunken px-4 py-3.5", GRID[columns], className)}
    >
      {items.map((fact) => (
        <div key={fact.id} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-xs text-text-muted">{fact.label}</dt>
          <dd className="m-0 text-sm font-semibold [overflow-wrap:anywhere] text-text">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
};

/** Ishorali summa (U+2212): manfiy — `danger-fg` (ishora matnda, rang yolg'iz emas). */
export const SignedMoney = ({ value, className }: { value: number; className?: string }) => {
  const { i18n } = useTranslation();
  return (
    <span className={cx("font-semibold whitespace-nowrap", value < 0 && "text-danger-fg", className)}>
      {formatSignedMoneyLocalized(value, { language: i18n.resolvedLanguage ?? i18n.language })}
    </span>
  );
};
