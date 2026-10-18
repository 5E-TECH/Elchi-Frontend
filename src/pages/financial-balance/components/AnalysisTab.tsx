// dizayn-v2: superadmin-balance-analysis, admin-balance-analysis, tizim-charts
import { memo, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  HandCoins,
  Package,
  PencilLine,
  ReceiptText,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFinanceCoverage } from "../../../entities/payments/financeCoverage";
import { cx } from "../../../shared/lib/cx";
import { getThisMonthRange, getThisWeekRange, getTodayRange, toISODate, type ISODateRange } from "../../../shared/lib/dateRange";
import { formatDateTimeLocalized, type DateInput } from "../../../shared/lib/formatDateTime";
import {
  formatNumberLocalized,
  formatPercentLocalized,
  formatSignedMoneyLocalized,
} from "../../../shared/lib/formatMoney";
import { scrollShellContentToTop } from "../../../shared/lib/usePagination";
import {
  Badge,
  Card,
  DataTable,
  DateRange,
  EmptyState,
  ErrorState,
  Field,
  Pagination,
  QueryBoundary,
  SegmentedControl,
  SkeletonChart,
  SkeletonTable,
  TONE_FG,
  type DataTableColumn,
} from "../../../shared/ui/primitives";
import { formatDay, formatRangeShort } from "../../../shared/ui/primitives/date/calendarMath";
import {
  normalizeAnalyticsSummary,
  normalizeApiBuckets,
  normalizeLedgerRows,
  readTopImpactsPagination,
  type LedgerRow,
  type SourceBucket,
} from "../lib/analytics";
import { extractFinancialLedgerItems, readCurrentBalance } from "../lib/financialBalance";
import { toSourceTypeLabel } from "../lib/historyRow";
import LedgerFlow from "./LedgerFlow";

/** Top tranzaksiyalar sahifasi (server sahifalashi; backend `limit` ni 100 ga qisadi). */
const PAGE_SIZE = 10;

type Period = "today" | "week" | "month" | "all" | "custom";

/** Manba ikonkasi (maketdagi reyting avatarlari). */
const SOURCE_ICON: Record<string, LucideIcon> = {
  manual_income: HandCoins,
  sell_profit: Package,
  sell: Package,
  correction: PencilLine,
  salary: Users,
  manual_expense: Wallet,
  bills: ReceiptText,
  sell_extra_cost: Truck,
  cancel_extra_cost: Truck,
};

const PRESET_RANGE: Record<Exclude<Period, "custom">, () => ISODateRange> = {
  today: getTodayRange,
  week: getThisWeekRange,
  month: getThisMonthRange,
  all: () => ({ from: "", to: "" }),
};

const matchPeriod = (range: ISODateRange): Period => {
  for (const key of ["today", "week", "month", "all"] as const) {
    const preset = PRESET_RANGE[key]();
    if (preset.from === range.from && preset.to === range.to) return key;
  }
  return "custom";
};

interface ImpactRankProps {
  direction: "positive" | "negative";
  buckets: SourceBucket[];
  total: number;
}

/** «Musbatga / Manfiyga tortuvchi manbalar» — reyting (`.el-rank`), meter ulushi = `percentage`. */
const ImpactRank = ({ direction, buckets, total }: ImpactRankProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isPositive = direction === "positive";
  const key = `v2Balance.analysis.${direction}`;
  const totalText = formatSignedMoneyLocalized(isPositive ? total : -total, { language });

  return (
    <Card
      divided={false}
      className="min-w-0 flex-[1_1_400px]"
      title={t(`${key}.title`)}
      description={
        <>
          {t(`${key}.total`)}{" "}
          <span className={cx("font-semibold", isPositive ? TONE_FG.success : TONE_FG.danger)}>{totalText}</span>
          {" · "}
          {t(`${key}.sources`, { n: formatNumberLocalized(buckets.length, { language }) })}
        </>
      }
      actions={
        <span className="inline-flex size-9 items-center justify-center rounded-[10px] bg-sunken text-text-muted">
          {isPositive ? <ArrowUpRight aria-hidden="true" size={18} /> : <ArrowDownLeft aria-hidden="true" size={18} />}
        </span>
      }
    >
      {buckets.length === 0 ? (
        <EmptyState icon={isPositive ? ArrowUpRight : ArrowDownLeft} title={t(`${key}.empty`)} />
      ) : (
        <ol aria-label={t(`${key}.title`)} className="m-0 flex min-w-0 list-none flex-col p-0">
          {buckets.map((bucket, index) => {
            const Icon = SOURCE_ICON[bucket.sourceType] ?? Wallet;
            const name = toSourceTypeLabel(bucket.sourceType, t);
            const percent = formatPercentLocalized(bucket.percent, { language });
            return (
              <li
                key={`${bucket.sourceType}-${index}`}
                className="grid min-w-0 grid-cols-[24px_32px_minmax(0,1fr)_auto] items-center gap-x-3 border-t border-border py-2.5 first:border-t-0 max-md:grid-cols-[24px_minmax(0,1fr)_auto]"
              >
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-sunken text-xs font-bold text-text-muted">
                  {index + 1}
                </span>
                <span
                  aria-hidden="true"
                  className="inline-flex size-8 items-center justify-center rounded-full bg-sunken text-text-muted ring-1 ring-inset ring-border max-md:hidden"
                >
                  <Icon size={16} />
                </span>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="truncate text-sm font-semibold text-text">{name}</span>
                  <div
                    role="meter"
                    aria-label={t(`${key}.shareAria`, { name, value: percent })}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(bucket.percent * 10) / 10}
                    className={cx("h-1.5 min-w-0 rounded-full", isPositive ? "bg-action-soft" : "bg-danger-soft")}
                  >
                    <span
                      className={cx("block h-full rounded-full", isPositive ? "bg-chart-1" : "bg-chart-8")}
                      style={{ width: `${Math.min(100, Math.max(0, bucket.percent))}%` }}
                    />
                  </div>
                </div>
                <div className="flex min-w-32 flex-col items-end max-md:min-w-0">
                  <span className={cx("whitespace-nowrap text-sm font-bold", isPositive ? TONE_FG.success : TONE_FG.danger)}>
                    {formatSignedMoneyLocalized(isPositive ? bucket.amount : -bucket.amount, { language })}
                  </span>
                  <span className="whitespace-nowrap text-xs text-text-muted">{t(`${key}.share`, { value: percent })}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
};

interface AnalysisTabProps {
  /** Davr (sahifa sarlavhasidagi «Excelga yuklash» ham shu davr bilan). Berilmasa — ichki holat (sukut: bugun). */
  range?: ISODateRange;
  onRangeChange?: (range: ISODateRange) => void;
}

/**
 * BALANS → TAHLIL (dizayn v2, maket `superadmin-balance-analysis`, grafiklar — `tizim-charts`).
 *
 * Davr: sana oralig'i + «Bugun / Bu hafta / Bu oy / Barchasi» (ega qarori Q7: «Yil» o'rniga «Barchasi» =
 * sana paramsiz). Sukut — bugun. Sana `YYYY-MM-DD` (C2: backend Toshkent kuni deb oladi).
 * «Kunlik kirim va chiqim» maketda «Taklif» — chizilmaydi.
 */
const AnalysisTab = ({ range: rangeProp, onRangeChange }: AnalysisTabProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { useGetFinancialBalanceAnalytics, useGetFinancialBalanceTopImpacts } = useFinanceCoverage();
  const [ownRange, setOwnRange] = useState<ISODateRange>(getTodayRange);
  const range = rangeProp ?? ownRange;
  const [page, setPage] = useState(1);
  // Sahifa almashganda ro'yxat kartasining boshi ko'rinsin (D-03; karta grafiklar ostida).
  const topCardRef = useRef<HTMLElement>(null);
  const handlePageChange = (next: number) => {
    setPage(next);
    scrollShellContentToTop(topCardRef.current);
  };

  const changeRange = (next: ISODateRange) => {
    setPage(1);
    if (onRangeChange) onRangeChange(next);
    else setOwnRange(next);
  };

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = {};
    // C2 / CODE-22: oddiy `YYYY-MM-DD` — backend uni Toshkent kuni deb oladi.
    if (range.from) params.fromDate = range.from;
    if (range.to) params.toDate = range.to;
    return params;
  }, [range.from, range.to]);

  // Server sahifalashi: backend `top-impacts` `limit` ni 1..100 ga qisadi (vmLTsAok) — `limit=10000`
  // bilan mijozda sahifalash 100 tadan keyingi tranzaksiyalarga hech qachon yetmasdi.
  const topImpactParams = useMemo(() => ({ ...queryParams, page, limit: PAGE_SIZE }), [page, queryParams]);
  const analyticsQuery = useGetFinancialBalanceAnalytics(true, queryParams);
  const topQuery = useGetFinancialBalanceTopImpacts(true, topImpactParams);

  const rows = useMemo<LedgerRow[] | undefined>(
    () => (topQuery.data == null ? undefined : normalizeLedgerRows(extractFinancialLedgerItems(topQuery.data))),
    [topQuery.data],
  );
  // Keyingi sahifa yuklanguncha oldingisi ko'rinadi (`placeholderData`, faqat shu davr ichida) — raqamlash
  // ko'rinib turgan qatorlarning o'z sahifasi bo'yicha (`pagination.page`), sahifalagich esa so'ralgan `page`da.
  const pagination = readTopImpactsPagination(topQuery.data, page, PAGE_SIZE);
  // Eski javobda `pagination` bo'lmasa — jami kamida ko'rinib turgan qatorlar soni.
  const topTotal = Math.max(pagination.total, rows?.length ?? 0);

  const analytics = analyticsQuery.data;
  // Jami va manbalar faqat analytics agregatidan (SQL): `rows` — bitta sahifa (10 qator), ulardan jami yoki
  // «taxminiy» ulush yasalmaydi (vmLTsAok).
  const summary = useMemo(() => normalizeAnalyticsSummary(analytics), [analytics]);
  const positiveBuckets = useMemo(() => normalizeApiBuckets(analytics, "positive"), [analytics]);
  const negativeBuckets = useMemo(() => normalizeApiBuckets(analytics, "negative"), [analytics]);
  const currentBalance = readCurrentBalance(analytics);

  const today = toISODate(new Date());
  const reachesToday = !range.to || range.to >= today;
  const periodText =
    formatRangeShort(range) ??
    (range.from ? `${formatDay(range.from)} –` : range.to ? `– ${formatDay(range.to)}` : t("v2Balance.analysis.allTime"));
  const period = matchPeriod(range);

  const columns = useMemo<DataTableColumn<LedgerRow>[]>(
    () => [
      {
        id: "index",
        header: t("v2Balance.analysis.top.col.index"),
        className: "w-14",
        cell: (_row, index) => (
          <span className="text-text-muted">{formatNumberLocalized((pagination.page - 1) * pagination.limit + index + 1, { language })}</span>
        ),
      },
      {
        id: "source",
        header: t("v2Balance.analysis.top.col.source"),
        cell: (row) => <span className="whitespace-nowrap font-semibold">{toSourceTypeLabel(row.sourceType, t)}</span>,
      },
      {
        id: "direction",
        header: t("v2Balance.analysis.top.col.direction"),
        cell: (row) =>
          row.signedAmount < 0 ? (
            <Badge icon={ArrowDownLeft}>{t("v2Balance.analysis.top.expense")}</Badge>
          ) : (
            <Badge icon={ArrowUpRight}>{t("v2Balance.analysis.top.income")}</Badge>
          ),
      },
      {
        id: "actor",
        header: t("v2Balance.analysis.top.col.actor"),
        hideBelow: "lg",
        cell: (row) =>
          row.automatic ? (
            <Badge>{t("v2Balance.history.automatic")}</Badge>
          ) : (
            <span className="whitespace-nowrap">{row.actor || "—"}</span>
          ),
      },
      {
        id: "date",
        header: t("v2Balance.analysis.top.col.date"),
        className: "whitespace-nowrap",
        cell: (row) => formatDateTimeLocalized(row.date as DateInput, { language }),
      },
      {
        id: "amount",
        header: t("v2Balance.analysis.top.col.amount"),
        align: "end",
        cell: (row) => (
          <span className={cx("font-semibold", row.signedAmount < 0 ? TONE_FG.danger : TONE_FG.success)}>
            {formatSignedMoneyLocalized(row.signedAmount, { language })}
          </span>
        ),
      },
    ],
    [language, pagination.limit, pagination.page, t],
  );

  const renderCard = (row: LedgerRow, index: number) => (
    <div className="flex items-start gap-3 px-4 py-3 text-sm text-text">
      <span className="w-5 flex-none pt-px text-[13px] text-text-muted">
        {formatNumberLocalized((pagination.page - 1) * pagination.limit + index + 1, { language })}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex justify-between gap-2">
          <span className="min-w-0 font-semibold">{toSourceTypeLabel(row.sourceType, t)}</span>
          <span className={cx("whitespace-nowrap font-semibold", row.signedAmount < 0 ? TONE_FG.danger : TONE_FG.success)}>
            {formatSignedMoneyLocalized(row.signedAmount, { language })}
          </span>
        </span>
        <span className="text-[13px] text-text-muted">
          {row.automatic ? t("v2Balance.history.automatic") : row.actor || "—"} ·{" "}
          <span className="whitespace-nowrap">{formatDateTimeLocalized(row.date as DateInput, { language })}</span>
        </span>
      </span>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <div role="group" aria-label={t("v2Balance.analysis.period")} className="flex max-w-[620px] flex-wrap items-center gap-3">
        <Field
          label={t("v2Balance.history.date")}
          hideLabel
          labelAs="span"
          className="min-w-0 flex-[1_1_220px] max-md:basis-full"
        >
          <DateRange value={range} onChange={changeRange} presets={false} clearable={false} />
        </Field>
        <SegmentedControl<Period>
          ariaLabel={t("v2Balance.analysis.periodSeg")}
          className="flex-none"
          value={period}
          onValueChange={(value) => {
            if (value !== "custom") changeRange(PRESET_RANGE[value]());
          }}
          options={[
            { value: "today", label: t("v2Balance.analysis.today") },
            { value: "week", label: t("v2Balance.analysis.week") },
            { value: "month", label: t("v2Balance.analysis.month") },
            { value: "all", label: t("v2Balance.analysis.all") },
          ]}
        />
      </div>

      <QueryBoundary
        query={{
          data: analyticsQuery.data ?? null,
          isLoading: analyticsQuery.isLoading,
          isError: analyticsQuery.isError,
          error: analyticsQuery.error,
          refetch: analyticsQuery.refetch,
        }}
        isEmpty={() => false}
        loadingLabel={t("v2Balance.analysis.loading")}
        loading={
          <Card divided={false} title={t("v2Balance.analysis.flow.title")}>
            <SkeletonChart />
          </Card>
        }
        empty={
          <LedgerFlow
            currentBalance={null}
            summary={summary}
            positive={positiveBuckets}
            negative={negativeBuckets}
            reachesToday={reachesToday}
            periodText={periodText}
          />
        }
        error={(error, retry) => <ErrorState framed size="chart" error={error} onRetry={retry} />}
      >
        {(_data, { isRefetching }) => (
          <div className="flex flex-col gap-6 max-md:gap-4">
            <LedgerFlow
              currentBalance={currentBalance}
              summary={summary}
              positive={positiveBuckets}
              negative={negativeBuckets}
              reachesToday={reachesToday}
              periodText={periodText}
              dimmed={isRefetching}
            />
            <div className="flex flex-wrap items-stretch gap-4">
              <ImpactRank direction="positive" buckets={positiveBuckets} total={summary.positiveTotal} />
              <ImpactRank direction="negative" buckets={negativeBuckets} total={summary.negativeTotal} />
            </div>
          </div>
        )}
      </QueryBoundary>

      <Card
        ref={topCardRef}
        padding="none"
        title={t("v2Balance.analysis.top.title")}
        description={t("v2Balance.analysis.top.subtitle")}
        actions={
          rows ? (
            <Badge>{t("v2Balance.analysis.top.count", { value: formatNumberLocalized(topTotal, { language }) })}</Badge>
          ) : null
        }
        footer={
          rows && topTotal > 0 ? (
            <Pagination
              page={page}
              pageSize={pagination.limit}
              total={topTotal}
              onPageChange={handlePageChange}
              summary={(r) => t("v2Balance.analysis.top.pagination", r)}
            />
          ) : undefined
        }
      >
        <QueryBoundary
          query={{ data: rows, isLoading: topQuery.isLoading, isError: topQuery.isError, error: topQuery.error, refetch: topQuery.refetch }}
          loadingLabel={t("v2Balance.analysis.top.loading")}
          loading={
            <SkeletonTable
              framed={false}
              columns={[
                t("v2Balance.analysis.top.col.source"),
                t("v2Balance.analysis.top.col.direction"),
                t("v2Balance.analysis.top.col.date"),
                t("v2Balance.analysis.top.col.amount"),
              ]}
              rows={6}
            />
          }
          empty={
            <EmptyState
              icon={ReceiptText}
              title={t("v2Balance.analysis.top.empty")}
              description={t("v2Balance.analysis.top.emptyDescription")}
            />
          }
          error={(error, retry) => <ErrorState error={error} onRetry={retry} />}
        >
          {(list, { isRefetching }) => (
            <DataTable
              rows={list}
              columns={columns}
              getRowKey={(row, index) => `${row.id}-${index}`}
              label={t("v2Balance.analysis.top.listLabel")}
              cardsLabel={t("v2Balance.analysis.top.listLabel")}
              renderCard={renderCard}
              busy={isRefetching}
            />
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
};

export default memo(AnalysisTab);
