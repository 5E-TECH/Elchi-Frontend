// dizayn-v2: superadmin-notifications-sms-report
import { useCallback, useMemo, useState } from "react";
import { Coins, Layers, MessageSquareText, MessageSquareOff } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { NoticeAlert } from "../../../entities/notification";
import {
  useSmsReport,
  useSmsTariffs,
  type SmsReport,
  type SmsReportDay,
} from "../../../entities/sms";
import { formatDateLocalized } from "../../../shared/lib/formatDateTime";
import {
  formatCompactMoneyLocalized,
  formatMoneyLocalized,
  formatNumberLocalized,
} from "../../../shared/lib/formatMoney";
import {
  Badge,
  Card,
  DataTable,
  DateRange,
  EmptyState,
  ErrorState,
  Pagination,
  QueryBoundary,
  SkeletonChart,
  StatCard,
  type DataTableColumn,
} from "../../../shared/ui/primitives";
import {
  buildDaily,
  buildMonthly,
  daysBetween,
  defaultReportRange,
  reportQueryRange,
  sortDayRows,
  summarizeByClass,
  summarizeTotals,
  tashkentDay,
  monthLabel,
  type MonthlyRow,
} from "../lib/smsReport";
import { useIsPhoneViewport } from "../lib/useIsPhoneViewport";
import { useDayLabel } from "../lib/useDayLabel";
import { CostCard, DailyCard, DeliveryCard, Sparkline, StatusCard } from "./sms/SmsReportCharts";

/** «5,85 mln so'm» → qiymat «5,85» + birlik «mln so'm» (maket `.el-kpi-value` + `.el-kpi-unit`). */
const splitCompact = (text: string) => {
  const index = text.indexOf(" ");
  return index > 0
    ? { value: text.slice(0, index), unit: text.slice(index + 1) }
    : { value: text, unit: undefined };
};

const DAY_PAGE_SIZES = [10, 20, 50] as const;

/** Bu qatordagi birorta SMS ham tariflanmagan — xarajat «—». */
const untariffedRow = (row: Pick<SmsReportDay, "total" | "untariffed">) => row.total > 0 && row.untariffed >= row.total;

/**
 * XARAJAT HISOBOTI (8auPBa1O #6), dizayn v2 — maket `superadmin-notifications-sms-report`.
 *
 * Davr (`DateRange`, sukut — oxirgi 30 kun; kunlar Toshkent vaqti bo'yicha — avvalgidek `from` kun boshi +05:00,
 * `to` — keyingi kun boshi). KPI: «Jami SMS», «Bo'laklar», «Jami xarajat» (kunlik sparkline bilan; telefonda bitta
 * xulosa kartasi). Tarifsiz SMS — ogohlantirish. Grafiklar (hammasi `GET …/sms/report` qatorlaridan, spec §2.3):
 * «Yetkazilish» (yarim doira), «Kunlik SMS soni» (sinf bo'yicha ustunlar, «Grafik | Jadval»), «Xarajat turlari
 * bo'yicha», «Holat turlari bo'yicha». Pastda «Oylar bo'yicha» (FaFN0Pux, maketda yo'q, eng yaqini «Kunlar bo'yicha»;
 * tanlangan davrdagi kun qatorlaridan) va «Kunlar bo'yicha» jadvallari (telefonda kartalar).
 */
const SmsReportTab = () => {
  const { t, i18n } = useTranslation("sms");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [range, setRange] = useState(defaultReportRange);
  const query = reportQueryRange(range.from, range.to);
  const report = useSmsReport(query.from, query.to, { silentError: true });
  const tariffs = useSmsTariffs();
  const today = tashkentDay();

  const dateText = (day: string) => formatDateLocalized(`${day}T12:00:00`, { language });
  // «09.09 – 08.10.2026» (yil bir xil bo'lsa boshida yilsiz — maket).
  const rangeText =
    range.from.slice(0, 4) === range.to.slice(0, 4)
      ? `${dateText(range.from).slice(0, 5)} – ${dateText(range.to)}`
      : `${dateText(range.from)} – ${dateText(range.to)}`;

  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <DateRange
          aria-label={t("report.range")}
          value={range}
          max={today}
          clearable={false}
          onChange={(next) => {
            if (next.from && next.to) setRange({ from: next.from, to: next.to });
          }}
          className="w-full max-w-[300px] max-md:max-w-none"
        />
        <span className="text-xs text-text-muted">{t("report.rangeHint")}</span>
      </div>

      <QueryBoundary
        query={report}
        isEmpty={(data) => !data.totals || data.totals.total === 0}
        loadingLabel={t("report.loading")}
        loading={
          <div className="flex flex-col gap-4">
            <SkeletonChart className="h-[200px]" bars={12} />
          </div>
        }
        empty={
          <Card>
            <EmptyState
              icon={MessageSquareOff}
              title={t("report.empty")}
              description={t("report.emptyHint")}
            />
          </Card>
        }
        error={(error, retry) => (
          <Card>
            <ErrorState error={error} title={t("report.loadError")} onRetry={retry} />
          </Card>
        )}
      >
        {(data) => (
          <ReportBody
            data={data}
            from={range.from}
            to={range.to}
            rangeText={rangeText}
            tariffs={tariffs.data}
          />
        )}
      </QueryBoundary>
    </>
  );
};

type ReportBodyProps = {
  data: SmsReport;
  from: string;
  to: string;
  rangeText: string;
  tariffs: ReturnType<typeof useSmsTariffs>["data"];
};

const ReportBody = ({ data, from, to, rangeText, tariffs }: ReportBodyProps) => {
  const { t, i18n } = useTranslation("sms");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const dayLabel = useDayLabel();
  const isPhone = useIsPhoneViewport();
  const num = useCallback(
    (value: number) => formatNumberLocalized(value, { language }),
    [language],
  );
  const money = useCallback(
    (value: number) => formatMoneyLocalized(value, { language }),
    [language],
  );

  const daily = useMemo(() => buildDaily(data.days, from, to), [data.days, from, to]);
  const classes = useMemo(() => summarizeByClass(data.days), [data.days]);
  const totals = useMemo(
    () => summarizeTotals(data, daysBetween(from, to).length || 1),
    [data, from, to],
  );
  const dayRows = useMemo(() => sortDayRows(data.days), [data.days]);
  const monthRows = useMemo(() => buildMonthly(data.days), [data.days]);
  // «Kunlar bo'yicha» — mahalliy sahifalash (30 kunda 60–90 qator; API sahifalamaydi).
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DAY_PAGE_SIZES[0]);
  const pageCount = Math.max(1, Math.ceil(dayRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = useMemo(
    () => dayRows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, dayRows, pageSize],
  );
  const cost = splitCompact(
    formatCompactMoneyLocalized(totals.cost, { language, fractionDigits: 2 }),
  );
  const countUnit = t("report.unitCount") || undefined;
  const maxOf = (values: number[]) => num(Math.max(0, ...values));

  const firstOfDay = useMemo(() => {
    const seen = new Set<string>();
    return new Set(
      dayRows
        .filter((row) => (seen.has(row.day) ? false : (seen.add(row.day), true)))
        .map((row) => `${row.day}-${row.message_class}`),
    );
  }, [dayRows]);

  const columns = useMemo<DataTableColumn<SmsReportDay>[]>(
    () => [
      {
        id: "day",
        header: t("report.col.day"),
        cellClassName: "whitespace-nowrap",
        cell: (row) =>
          firstOfDay.has(`${row.day}-${row.message_class}`) ? (
            <span className="font-semibold text-text">{dayLabel(row.day)}</span>
          ) : (
            <span className="text-text-muted">{dayLabel(row.day)}</span>
          ),
      },
      {
        id: "class",
        header: t("report.col.class"),
        cell: (row) => <Badge>{t(`class.${row.message_class}`)}</Badge>,
      },
      { id: "total", header: t("report.col.total"), align: "end", cell: (row) => num(row.total) },
      {
        id: "delivered",
        header: t("report.col.delivered"),
        align: "end",
        cell: (row) => num(row.delivered),
      },
      {
        id: "failed",
        header: t("report.col.failed"),
        align: "end",
        cell: (row) =>
          row.failed ? num(row.failed) : <span className="text-text-muted">{num(0)}</span>,
      },
      {
        id: "parts",
        header: t("report.col.parts"),
        align: "end",
        hideBelow: "lg",
        cell: (row) => num(row.parts),
      },
      {
        id: "cost",
        header: t("report.col.cost"),
        align: "end",
        cell: (row) =>
          untariffedRow(row) ? (
            <span className="text-text-muted" title={t("report.untariffedTitle")}>
              —<span className="sr-only"> {t("report.untariffedTitle")}</span>
            </span>
          ) : (
            <span className="font-semibold text-text">{money(row.cost)}</span>
          ),
      },
    ],
    [dayLabel, firstOfDay, money, num, t],
  );

  const monthColumns = useMemo<DataTableColumn<MonthlyRow>[]>(
    () => [
      {
        id: "month",
        header: t("report.col.month"),
        cellClassName: "whitespace-nowrap",
        cell: (row) => <span className="font-semibold text-text">{monthLabel(row.month)}</span>,
      },
      { id: "total", header: t("report.col.total"), align: "end", cell: (row) => num(row.total) },
      { id: "delivered", header: t("report.col.delivered"), align: "end", cell: (row) => num(row.delivered) },
      {
        id: "failed",
        header: t("report.col.failed"),
        align: "end",
        cell: (row) => (row.failed ? num(row.failed) : <span className="text-text-muted">{num(0)}</span>),
      },
      { id: "parts", header: t("report.col.parts"), align: "end", hideBelow: "lg", cell: (row) => num(row.parts) },
      {
        id: "cost",
        header: t("report.col.cost"),
        align: "end",
        cell: (row) =>
          untariffedRow(row) ? (
            <span className="text-text-muted" title={t("report.untariffedTitle")}>
              —<span className="sr-only"> {t("report.untariffedTitle")}</span>
            </span>
          ) : (
            <span className="font-semibold text-text">{money(row.cost)}</span>
          ),
      },
    ],
    [money, num, t],
  );

  const renderMonthCard = useCallback(
    (row: MonthlyRow) => (
      <div className="flex min-w-0 flex-col gap-1 px-4 py-3">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="font-semibold text-text">{monthLabel(row.month)}</span>
          {untariffedRow(row) ? (
            <span className="text-[13px] whitespace-nowrap text-text-muted">{t("report.untariffedShort")}</span>
          ) : (
            <span className="font-semibold whitespace-nowrap text-text">{money(row.cost)}</span>
          )}
        </div>
        <span className="text-xs text-text-muted">
          {t("report.monthCard", {
            total: num(row.total),
            delivered: num(row.delivered),
            failed: num(row.failed),
          })}
        </span>
      </div>
    ),
    [money, num, t],
  );

  const renderDayCard = useCallback(
    (row: SmsReportDay) => (
      <div className="flex min-w-0 flex-col gap-1 px-4 py-3">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="font-semibold text-text">{dayLabel(row.day)}</span>
            <Badge>{t(`class.${row.message_class}`)}</Badge>
          </span>
          {untariffedRow(row) ? (
            <span className="text-[13px] whitespace-nowrap text-text-muted">
              {t("report.untariffedShort")}
            </span>
          ) : (
            <span className="font-semibold whitespace-nowrap text-text">{money(row.cost)}</span>
          )}
        </div>
        <span className="text-xs text-text-muted">
          {t("report.dayCard", {
            total: num(row.total),
            delivered: num(row.delivered),
            failed: num(row.failed),
            parts: num(row.parts),
          })}
        </span>
      </div>
    ),
    [dayLabel, money, num, t],
  );

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      {isPhone ? null : (
        <section aria-label={t("report.summaryLabel")} className="grid grid-cols-3 gap-4">
          <StatCard
            label={t("report.total")}
            value={num(totals.total)}
            unit={countUnit}
            icon={MessageSquareText}
            hint={t("report.totalMeta", { value: num(Math.round(totals.perDay)) })}
          >
            <Sparkline
              values={daily.map((point) => point.total)}
              label={t("report.sparkAria", {
                label: t("report.total"),
                max: maxOf(daily.map((point) => point.total)),
              })}
            />
          </StatCard>
          <StatCard
            label={t("report.parts")}
            value={num(totals.parts)}
            unit={countUnit}
            icon={Layers}
            hint={
              totals.partsPerSms === null
                ? undefined
                : t("report.partsMeta", {
                    value: formatNumberLocalized(totals.partsPerSms, {
                      language,
                      fractionDigits: 2,
                    }),
                  })
            }
          >
            <Sparkline
              values={daily.map((point) => point.parts)}
              label={t("report.sparkAria", {
                label: t("report.parts"),
                max: maxOf(daily.map((point) => point.parts)),
              })}
            />
          </StatCard>
          <StatCard
            label={t("report.cost")}
            value={cost.value}
            unit={cost.unit}
            icon={Coins}
            hint={t("report.costMeta")}
          >
            <Sparkline
              values={daily.map((point) => point.cost)}
              label={t("report.sparkAria", {
                label: t("report.cost"),
                max: money(Math.max(0, ...daily.map((point) => point.cost))),
              })}
            />
          </StatCard>
        </section>
      )}

      {isPhone ? (
        <Card padding="none" aria-label={t("report.summaryLabel")}>
          <dl className="m-0 flex flex-col px-4">
            {(
              [
                [
                  t("report.total"),
                  t("report.totalSub", { value: num(totals.parts) }),
                  daily.map((point) => point.total),
                  t("count", { value: num(totals.total) }),
                ],
                [
                  t("report.cost"),
                  t("report.costSub"),
                  daily.map((point) => point.cost),
                  formatCompactMoneyLocalized(totals.cost, { language, fractionDigits: 2 }),
                ],
              ] as const
            ).map(([label, sub, values, value], index) => (
              <div
                key={label}
                className={
                  index > 0
                    ? "flex items-center gap-3 border-t border-border py-3"
                    : "flex items-center gap-3 py-3"
                }
              >
                <dt className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-text">{label}</span>
                  <span className="text-xs text-text-muted">{sub}</span>
                </dt>
                <dd className="m-0 flex items-center gap-3">
                  <Sparkline
                    inline
                    values={values.slice(-14)}
                    label={t("report.sparkAria", { label, max: maxOf([...values]) })}
                  />
                  <span className="min-w-[92px] text-right font-semibold whitespace-nowrap text-text">
                    {value}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      ) : null}

      {totals.untariffed > 0 ? (
        <NoticeAlert tone="warning">
          <span className="text-sm">
            <Trans
              t={t}
              i18nKey="report.untariffed"
              values={{ value: num(totals.untariffed) }}
              components={{ b: <span className="font-bold" /> }}
            />
          </span>
        </NoticeAlert>
      ) : null}

      <div className="flex min-w-0 flex-wrap gap-4">
        <DeliveryCard totals={totals} rangeText={rangeText} />
        <DailyCard points={daily} rangeText={rangeText} />
      </div>

      <div className="flex min-w-0 flex-wrap gap-4">
        <CostCard classes={classes} totalCost={totals.cost} tariffs={tariffs} />
        <StatusCard classes={classes} />
      </div>

      <Card padding="none" title={t("report.monthsTitle")} description={t("report.monthsSub")}>
        <DataTable
          rows={monthRows}
          columns={monthColumns}
          getRowKey={(row) => row.month}
          label={t("report.monthsLabel")}
          renderCard={renderMonthCard}
        />
      </Card>

      <Card
        padding="none"
        title={t("report.daysTitle")}
        description={t("report.daysSub")}
        footer={
          dayRows.length > DAY_PAGE_SIZES[0] ? (
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              total={dayRows.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              pageSizeOptions={DAY_PAGE_SIZES}
              summary={(range) => t("report.daysPagination", range)}
            />
          ) : undefined
        }
      >
        <DataTable
          rows={pagedRows}
          columns={columns}
          getRowKey={(row) => `${row.day}-${row.message_class}`}
          label={t("report.daysLabel")}
          renderCard={renderDayCard}
        />
      </Card>
    </div>
  );
};

export default SmsReportTab;
