// dizayn-v2: superadmin-mails-today, manager-mails-today, courier-mails-today, superadmin-mails-refused, courier-mails-refused
import { memo } from "react";
import { Mail, Package, Wallet } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import {
  CURRENCY_LABEL,
  formatMoneyLocalized,
  formatNumberLocalized,
  resolveMoneyLanguage,
} from "../../../shared/lib/formatMoney";
import { StatCard } from "../../../shared/ui/primitives";
import type { MailRowsSummary } from "../model/mailsLists";

/**
 * POCHTALAR XULOSASI — ikki ko'rinish (dizayn v2):
 *
 *  - `line` — matn qatori (`.el-small .el-muted`, sonlar `.el-strong`): «8 ta viloyat · 182 ta buyurtma ·
 *    jami 34 760 000 so'm» (`unit="mails"` — «ta pochta»). Xodim maketlarida telefonda ikki qator
 *    («… ta buyurtma» / «jami …», `stackOnPhone`); kuryerda bitta o'raluvchi qator.
 *  - `cards` — kuryerning uchta `StatCard` i: «Bugungi pochtalar» N ta · «Buyurtmalar» N ta ·
 *    «Jami summa» X so'm (maket `courier-mails-today`, `courier-mails-refused`).
 */
type LineProps = {
  variant: "line";
  summary: MailRowsSummary;
  /** Birinchi son: turli viloyatlar yoki pochtalar. */
  unit: "regions" | "mails";
  /** Telefonda «jami …» alohida qatorda (xodim maketlari). */
  stackOnPhone?: boolean;
  className?: string;
};

type CardsProps = {
  variant: "cards";
  summary: MailRowsSummary;
  /** Birinchi kartaning nomi: «Bugungi pochtalar» / «Rad etilgan pochtalar». */
  mailsLabel: string;
  className?: string;
};

export type MailSummaryStatsProps = LineProps | CardsProps;

const STRONG = <strong className="font-semibold text-text" />;

const MailSummaryStats = (props: MailSummaryStatsProps) => {
  const { t, i18n } = useTranslation("mailsShell");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { summary } = props;
  const count = (value: number) => formatNumberLocalized(value, { language });

  if (props.variant === "cards") {
    return (
      <div className={cx("grid grid-cols-3 gap-4", props.className)}>
        <StatCard label={props.mailsLabel} value={count(summary.mails)} unit={t("stats.unit")} icon={Mail} />
        <StatCard label={t("stats.orders")} value={count(summary.orders)} unit={t("stats.unit")} icon={Package} />
        <StatCard
          label={t("stats.amount")}
          value={formatMoneyLocalized(summary.amount, { language, withCurrency: false })}
          unit={CURRENCY_LABEL[resolveMoneyLanguage(language)]}
          icon={Wallet}
        />
      </div>
    );
  }

  const first = props.unit === "regions" ? summary.regions : summary.mails;
  const stack = props.stackOnPhone ?? false;
  return (
    <p className={cx("text-[13px] text-text-muted", props.className)}>
      <span className="whitespace-nowrap">
        <Trans
          t={t}
          i18nKey={props.unit === "regions" ? "summary.regions" : "summary.mails"}
          values={{ value: count(first) }}
          count={first}
          components={{ b: STRONG }}
        />
      </span>
      {" · "}
      <span className="whitespace-nowrap">
        <Trans
          t={t}
          i18nKey="summary.orders"
          values={{ value: count(summary.orders) }}
          count={summary.orders}
          components={{ b: STRONG }}
        />
      </span>
      <span className={cx(stack && "max-md:hidden")}>{" · "}</span>
      <span className={cx("whitespace-nowrap", stack && "max-md:block")}>
        <Trans
          t={t}
          i18nKey="summary.total"
          values={{ value: formatMoneyLocalized(summary.amount, { language }) }}
          components={{ b: STRONG }}
        />
      </span>
    </p>
  );
};

export default memo(MailSummaryStats);
