// dizayn-v2: superadmin-balance-overview, admin-balance-overview
import { memo, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Store, Truck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { formatMoneyLocalized, formatNumberLocalized, formatPercentLocalized } from "../../../shared/lib/formatMoney";
import { Badge, Button, Card, EmptyState, TONE_FG } from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import { sharePercent, toInitials } from "../lib/balanceFormat";
import type { FinancialBalanceData, FinancialBalanceParty } from "../lib/financialBalance";

/** Summa qatorga bo'linmasin (maketdagi `white-space: nowrap`): oddiy bo'sh joy → bo'linmas. */
const unbroken = (text: string) => text.replace(/ /g, "\u00a0");

/** Telefonda 3 qator (maket `el-hide-mobile`), desktopda 10 — qolgani «Yana ko'rsatish · N ta». */
const PHONE_ROWS = 3;
const DESKTOP_ROWS = 10;

interface RankRow {
  id: string;
  name: string;
  location: string;
  value: number;
  /** Meter ulushi, 0..100. */
  share: number;
  /** O'ngdagi kichik matn: ulush yoki «manfiy balans». */
  sub: string;
  tone?: "danger" | "muted";
}

interface RankCardProps {
  title: string;
  subtitle: string;
  rows: RankRow[];
  /**
   * Noldan farqli kassalarning haqiqiy soni (backend `nonZeroCount`, IaMK2tf2) — sanoq `rows.length` emas:
   * backend ro'yxatni kesgan bo'lsa (`truncated`), `rows` faqat eng kattalari.
   */
  total: number;
  shareLabel: (name: string) => string;
  emptyIcon: typeof Store;
  emptyText: string;
  foot: ReactNode;
}

/** Reyting kartasi (`.el-chart` + `.el-rank`): o'rin, bosh harflar, ism · joy, meter, summa + ulush. */
const RankCard = ({ title, subtitle, rows, total, shareLabel, emptyIcon, emptyText, foot }: RankCardProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isPhone = useIsPhone();
  const [expanded, setExpanded] = useState(false);
  const limit = isPhone ? PHONE_ROWS : DESKTOP_ROWS;
  const visible = expanded ? rows : rows.slice(0, limit);
  // «Yana ko'rsatish · N ta» — bosilganda haqiqatan ochiladigan qatorlar.
  const hidden = rows.length - visible.length;
  const count = Math.max(total, rows.length);
  // Backend bermagan (kesilgan) qatorlar — ro'yxat to'liq ochiq turganda «eng katta N tasi» izohi.
  const notLoaded = count - rows.length;
  const number = (value: number) => formatNumberLocalized(value, { language });

  return (
    <Card
      divided={false}
      className="min-w-0 flex-[1_1_400px]"
      title={title}
      description={subtitle}
      actions={<Badge>{t("v2Balance.rank.count", { value: number(count) })}</Badge>}
      footer={foot}
      bodyClassName="flex-1"
    >
      {rows.length === 0 ? (
        <EmptyState icon={emptyIcon} title={emptyText} />
      ) : (
        <div className="flex flex-col gap-2">
          <ol aria-label={title} className="m-0 flex min-w-0 list-none flex-col p-0">
            {visible.map((row, index) => (
              <li
                key={`${row.id}-${index}`}
                className="grid min-w-0 grid-cols-[24px_32px_minmax(0,1fr)_auto] items-center gap-x-3 border-t border-border py-2.5 first:border-t-0 max-md:grid-cols-[24px_minmax(0,1fr)_auto]"
              >
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-sunken text-xs font-bold text-text-muted">
                  {index + 1}
                </span>
                <span
                  aria-hidden="true"
                  className="inline-flex size-8 items-center justify-center rounded-full bg-sunken text-xs font-bold text-text-muted ring-1 ring-inset ring-border max-md:hidden"
                >
                  {toInitials(row.name)}
                </span>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="truncate text-sm font-semibold text-text">
                    {row.name}
                    {row.location ? (
                      <span className="font-normal text-text-muted max-md:hidden"> · {row.location}</span>
                    ) : null}
                  </span>
                  <div
                    role="meter"
                    aria-label={shareLabel(row.name)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(row.share * 10) / 10}
                    className="h-1.5 min-w-0 rounded-full bg-action-soft"
                  >
                    <span className="block h-full rounded-full bg-chart-1" style={{ width: `${row.share}%` }} />
                  </div>
                </div>
                <div className="flex min-w-32 flex-col items-end max-md:min-w-0">
                  <span
                    className={cx(
                      "whitespace-nowrap text-sm font-bold",
                      row.tone === "danger" ? TONE_FG.danger : row.tone === "muted" ? "text-text-muted" : "text-text",
                    )}
                  >
                    {formatMoneyLocalized(row.value, { language })}
                  </span>
                  <span className="whitespace-nowrap text-xs text-text-muted">{row.sub}</span>
                </div>
              </li>
            ))}
          </ol>
          {hidden > 0 || expanded ? (
            <Button
              variant="ghost"
              size="sm"
              className="self-center"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
              rightIcon={expanded ? ChevronUp : ChevronDown}
            >
              {expanded ? t("v2Balance.rank.showLess") : t("v2Balance.rank.showMore", { value: number(hidden) })}
            </Button>
          ) : null}
          {notLoaded > 0 && hidden === 0 ? (
            <p className="m-0 text-center text-xs text-text-muted">
              {t("v2Balance.rank.topShown", { shown: number(rows.length), total: number(count) })}
            </p>
          ) : null}
        </div>
      )}
    </Card>
  );
};

/**
 * Umumiy ko'rinish: «Marketlar bilan hisob-kitob» va «Kuryerlar bilan hisob-kitob» (desktopda yonma-yon).
 * Marketlar — qarz bo'yicha kamayish tartibida, ulush = qarz / jami qarz. Kuryerlar — qoldiq bo'yicha;
 * ulush = musbat qoldiq / musbat qoldiqlar jami, manfiy kuryer — «manfiy balans», meter bo'sh.
 */
const SettlementRanks = ({ data }: { data: FinancialBalanceData }) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const money = (value: number) => formatMoneyLocalized(value, { language });

  const marketRows = useMemo<RankRow[]>(() => {
    const items = [...data.markets.items].sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
    const base = items.reduce((sum, item) => sum + Math.abs(item.balance), 0);
    return items.map((item: FinancialBalanceParty) => {
      const share = sharePercent(Math.abs(item.balance), base);
      return {
        id: item.id,
        name: item.name,
        location: item.location,
        value: item.balance,
        share,
        sub: formatPercentLocalized(share, { language }),
        tone: item.balance < 0 ? "danger" : item.balance === 0 ? "muted" : undefined,
      };
    });
  }, [data.markets.items, language]);

  const courierStats = useMemo(() => {
    const items = [...data.couriers.items].sort((a, b) => b.balance - a.balance);
    const positive = items.reduce((sum, item) => sum + Math.max(0, item.balance), 0);
    const negative = items.reduce((sum, item) => sum + Math.min(0, item.balance), 0);
    const rows: RankRow[] = items.map((item) => {
      const share = sharePercent(item.balance, positive);
      return {
        id: item.id,
        name: item.name,
        location: item.location,
        value: item.balance,
        share,
        sub: item.balance < 0 ? t("v2Balance.couriers.negative") : formatPercentLocalized(share, { language }),
        tone: item.balance < 0 ? "danger" : item.balance === 0 ? "muted" : undefined,
      };
    });
    return { rows, positive, negative };
  }, [data.couriers.items, language, t]);

  const marketsTotal = data.markets.marketsTotalBalans;
  const couriersTotal = data.couriers.couriersTotalBalanse;

  return (
    <div className="flex flex-wrap items-stretch gap-4">
      <RankCard
        title={t("v2Balance.markets.title")}
        subtitle={t("v2Balance.markets.subtitle")}
        rows={marketRows}
        total={data.markets.nonZeroCount}
        shareLabel={(name) => t("v2Balance.markets.share", { name })}
        emptyIcon={Store}
        emptyText={t("v2Balance.markets.empty")}
        foot={
          <>
            <span className="text-sm font-semibold text-text">{t("v2Balance.rank.total")}</span>
            <span
              className={cx("whitespace-nowrap text-base font-bold", marketsTotal < 0 ? TONE_FG.danger : "text-text")}
            >
              {money(marketsTotal)}
            </span>
          </>
        }
      />
      <RankCard
        title={t("v2Balance.couriers.title")}
        subtitle={t("v2Balance.couriers.subtitle")}
        rows={courierStats.rows}
        total={data.couriers.nonZeroCount}
        shareLabel={(name) => t("v2Balance.couriers.share", { name })}
        emptyIcon={Truck}
        emptyText={t("v2Balance.couriers.empty")}
        foot={
          <div className="flex w-full min-w-0 items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-semibold text-text">{t("v2Balance.rank.total")}</span>
              {courierStats.rows.length > 0 ? (
                <span className="text-xs text-text-muted">
                  {t("v2Balance.couriers.footNote", { positive: unbroken(money(courierStats.positive)) })}
                  {courierStats.negative < 0
                    ? ` · ${t("v2Balance.couriers.footDebtor", { negative: unbroken(money(courierStats.negative)) })}`
                    : null}
                </span>
              ) : null}
            </div>
            <span
              className={cx("whitespace-nowrap text-base font-bold", couriersTotal < 0 ? TONE_FG.danger : "text-text")}
            >
              {money(couriersTotal)}
            </span>
          </div>
        }
      />
    </div>
  );
};

export default memo(SettlementRanks);
