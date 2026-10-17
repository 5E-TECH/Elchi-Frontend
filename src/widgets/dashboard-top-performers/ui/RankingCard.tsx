// dizayn-v2: superadmin-dashboard-main, admin-dashboard-main, registrator-dashboard-main, manager-branch-dashboard-main
import { memo, useState } from "react";
import { ChevronDown, ChevronUp, Info, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RankingMeta, TopBranch, TopMarket } from "../../../entities/dashboard";
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized, formatPercentLocalized } from "../../../shared/lib/formatMoney";
import { Badge, Button, Card, EmptyState, Skeleton } from "../../../shared/ui/primitives";
import {
  rankingPeriodLabel,
  toBranchRankingRows,
  toMarketRankingRows,
  type RankingRow,
} from "../model/ranking";

/**
 * REYTING KARTASI — dizayn v2: «Top marketlar», «Top filiallar» (9zbSDkUI).
 * Maketlar `superadmin-dashboard-main` (admin, registrator ham) va `manager-branch-dashboard-main`;
 * taxta `tizim-charts`: reyting ro'yxati (`.el-rank`), «Kam ma'lumot» eslatmasi, telefonda 3 qator.
 *
 * v1 `TopPerformers` (kuryer va market dashboardlari) tegilmaydi — umumiy widget, alohida
 * ko'chiriladi (AGENTS.md). Backend tartibi saqlanadi.
 */

/** Desktop va planshetda ko'rinadigan qatorlar; qolgani «Yana ko'rsatish» ortida. */
const VISIBLE_ROWS = 5;
/** Telefonda (taxta: «Reyting — 3 qator + Yana ko'rsatish»). */
const PHONE_ROWS = 3;
/** Taxta «Kam ma'lumot»: shundan kam buyurtmali qator bo'lsa, reyting taxminiy ekani aytiladi. */
const LOW_DATA_ORDERS = 30;

const ROW =
  "grid grid-cols-[24px_32px_minmax(0,1fr)_auto] items-center gap-x-3 border-t border-border py-2.5 first:border-t-0 " +
  "max-md:grid-cols-[24px_minmax(0,1fr)_auto]";
const POS = "inline-flex size-6 items-center justify-center rounded-full text-xs font-bold text-text-muted";
const AVATAR =
  "inline-flex size-8 items-center justify-center rounded-full text-xs font-bold text-text-muted ring-1 ring-inset ring-border max-md:hidden";

/** Bosh harflar doirasi («Baraka Shop» → «BS»). */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toLocaleUpperCase();

export type RankingCardProps = {
  title: string;
  /** Ikkisidan biri: marketlar yoki filiallar reytingi (xom backend qatorlari — qator karta ichida yasaladi). */
  markets?: readonly TopMarket[];
  branches?: readonly TopBranch[];
  meta?: RankingMeta | null;
  /** Foydalanuvchining o'z filiali (menejer): «Sizning filial» belgisi; top 5 dan tashqarida — alohida qatorda. */
  ownId?: string | null;
  /** O'z filiali ro'yxatda bo'lsa izoh formulasi (menejer: «Sotuv foizi · top 5 va sizning filial»). */
  ownFormula?: string;
  /** So'rov ketmoqda: qatorlar skeleti (bo'sh holat emas — «buyurtma yo'q» yuklanishda yozilmaydi). */
  loading?: boolean;
  className?: string;
  "data-testid"?: string;
};

export const RankingCard = memo(
  ({ title, markets, branches, meta, ownId, ownFormula, loading = false, className, "data-testid": testId }: RankingCardProps) => {
    const { t, i18n } = useTranslation("dashboard");
    const [expanded, setExpanded] = useState(false);
    const language = i18n.language;
    const rows: RankingRow[] = markets ? toMarketRankingRows(markets) : toBranchRankingRows(branches ?? []);

    const ownIndex = ownId ? rows.findIndex((row) => row.id === ownId) : -1;
    // Maket `manager-branch-dashboard-main`: o'z filiali top 5 dan tashqarida — ro'yxat ostida, doim ko'rinadi.
    const pinnedIndex = ownIndex >= VISIBLE_ROWS ? ownIndex : -1;
    const listRows = rows
      .map((row, index) => ({ row, rank: index + 1 }))
      .filter((_, index) => index !== pinnedIndex);
    const hiddenDesktop = Math.max(0, listRows.length - VISIBLE_ROWS);
    const hiddenPhone = Math.max(0, listRows.length - PHONE_ROWS);
    const isEmpty = !loading && rows.length === 0;
    const isLowData = !loading && rows.some((row) => row.total < LOW_DATA_ORDERS);
    const period = rankingPeriodLabel(meta, (count) => t("ranking.periodLastDays", { count }));
    const formula = ownIndex >= 0 && ownFormula ? ownFormula : t("ranking.formula");
    const subtitle = [formula, period].filter(Boolean).join(" · ");

    const renderRow = (row: RankingRow, rank: number, extraClass: string | false, pinned = false) => {
      const own = row.id === ownId;
      return (
        <li key={row.id} className={cx(ROW, extraClass)} data-own={own ? "" : undefined}>
          <span className={cx(POS, pinned ? "bg-surface" : "bg-sunken")}>{rank}</span>
          <span aria-hidden="true" className={cx(AVATAR, pinned ? "bg-surface" : "bg-sunken")}>
            {initials(row.name)}
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-semibold text-text" title={row.name}>
                {row.name}
              </span>
              {own ? (
                <Badge variant="outline" className="shrink-0">
                  {t("ranking.ownBranch")}
                </Badge>
              ) : null}
            </span>
            <div
              role="meter"
              aria-label={t("ranking.rateAria", { name: row.name })}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={row.rate}
              className="h-1.5 overflow-hidden rounded-full bg-action-soft"
            >
              <span className="block h-full rounded-full bg-chart-1" style={{ width: `${row.rate}%` }} />
            </div>
          </div>
          <div className="flex min-w-16 flex-col items-end">
            <span className="text-sm font-bold text-text tabular-nums">
              {formatPercentLocalized(row.rate, { language })}
            </span>
            <span className="text-xs whitespace-nowrap text-text-muted tabular-nums">
              {t("ranking.ratio", {
                successful: formatNumberLocalized(row.successful, { language }),
                total: formatNumberLocalized(row.total, { language }),
              })}
            </span>
          </div>
        </li>
      );
    };

    const hasMore = !isEmpty && hiddenPhone > 0;
    const pinned = pinnedIndex >= 0 ? rows[pinnedIndex] : null;

    return (
      <Card
        divided={false}
        title={title}
        description={subtitle}
        data-testid={testId}
        data-empty={isEmpty ? "" : undefined}
        aria-busy={loading || undefined}
        // Bo'sh karta qo'shnisi bo'yiga cho'zilmaydi — ixcham qoladi (9zbSDkUI).
        className={cx(isEmpty && "self-start", className)}
        bodyClassName="flex flex-1 flex-col gap-4 max-md:gap-3.5"
      >
        {loading ? (
          <ol aria-hidden="true" data-testid="ranking-skeleton" className="flex flex-col">
            {Array.from({ length: VISIBLE_ROWS }, (_, index) => (
              <li key={index} className={cx(ROW, index >= PHONE_ROWS && "max-md:hidden")}>
                <Skeleton shape="circle" width={24} height={24} />
                <Skeleton shape="circle" width={32} height={32} className="max-md:hidden" />
                <span className="flex min-w-0 flex-col gap-2">
                  <Skeleton width={index % 2 ? "52%" : "68%"} />
                  <Skeleton width="100%" height={6} />
                </span>
                <Skeleton width={44} />
              </li>
            ))}
          </ol>
        ) : isEmpty ? (
          <EmptyState size="inline" icon={Trophy} title={t("ranking.empty")} />
        ) : (
          <>
            <ol className="flex flex-col" aria-label={title}>
              {listRows.map(({ row, rank }, index) =>
                renderRow(
                  row,
                  rank,
                  !expanded && (index >= VISIBLE_ROWS ? "hidden" : index >= PHONE_ROWS && "max-md:hidden"),
                ),
              )}
            </ol>
            {pinned ? (
              <ol start={pinnedIndex + 1} aria-label={t("ranking.ownRankAria")} className="flex flex-col rounded-xl bg-sunken">
                {renderRow(pinned, pinnedIndex + 1, "px-3", true)}
              </ol>
            ) : null}
          </>
        )}

        {hasMore || isLowData ? (
          <div className="mt-auto flex flex-col gap-4 max-md:gap-3.5">
            {hasMore ? (
              <Button
                variant="ghost"
                size="sm"
                rightIcon={expanded ? ChevronUp : ChevronDown}
                aria-expanded={expanded}
                onClick={() => setExpanded((value) => !value)}
                className={cx("self-center", hiddenDesktop === 0 && "md:hidden")}
              >
                {expanded ? (
                  t("ranking.showLess")
                ) : (
                  <>
                    <span className="max-md:hidden">{t("ranking.showMore", { count: hiddenDesktop })}</span>
                    <span className="md:hidden">{t("ranking.showMore", { count: hiddenPhone })}</span>
                  </>
                )}
              </Button>
            ) : null}
            {isLowData ? (
              <p className="flex items-start gap-2 text-xs text-text-subtle">
                <Info size={14} aria-hidden="true" className="mt-px shrink-0" />
                {t("ranking.lowData")}
              </p>
            ) : null}
          </div>
        ) : null}
      </Card>
    );
  },
);

RankingCard.displayName = "RankingCard";
