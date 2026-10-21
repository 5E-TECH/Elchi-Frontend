// dizayn-v2: investor-dashboard-home, investor-dashboard-home-table
import { ChartColumn, CircleCheck, Hourglass } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { InvestorMonthlyPoint, InvestorMonthsWindow } from "../../../entities/investors";
import { cx } from "../../../shared/lib/cx";
import { formatCompactMoneyLocalized, formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import {
  ChartLegend,
  ChartNote,
  StackedBars,
  ViewToggle,
  type ChartView,
  type StackedBarsColumn,
  type StackedBarsSeries,
} from "../../../shared/ui/charts";
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  SegmentedControl,
  Skeleton,
  SkeletonChart,
} from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import { currentMonthKey, loadErrorText, monthNames, monthTitle, parseMonthKey } from "../lib/format";

const MONTH_WINDOWS: readonly InvestorMonthsWindow[] = [6, 12, 24];

export interface MonthlyProfitCardProps {
  months: InvestorMonthsWindow;
  onMonthsChange: (months: InvestorMonthsWindow) => void;
  view: ChartView;
  onViewChange: (view: ChartView) => void;
  /** `undefined` — yuklanmoqda (skelet, boshqaruvlar joyida). */
  items: InvestorMonthlyPoint[] | undefined;
  /** Hali birorta foyda davri yo'q — grafik o'rnida bo'sh holat, boshqaruvlar yashirin (maket `dashboard-empty`). */
  empty?: boolean;
  /** Oyna almashganda eski grafik xira turadi (`.el-chart.is-refetch`). */
  refreshing?: boolean;
  /**
   * Tanlangan davr yuklanmadi, lekin avvalgisi bor edi: boshqaruvlar joyida (boshqa davrga qaytish mumkin), grafik
   * o'rnida `ErrorState` va «Qayta urinish». Birinchi yuklanish xatosi — sahifadagi butun karta (`dashboard-error`).
   */
  error?: { error: unknown; onRetry: () => void; retrying?: boolean };
  /** «Hozir» — test uchun. */
  now?: Date;
}

type MonthRow = InvestorMonthlyPoint & { current: boolean; isTotal?: boolean };

/**
 * «OYLIK FOYDA» (maket `investor-dashboard-home` / `-home-table`): davr 6 · 12 · 24 oy, «Grafik | Jadval», yig'indi
 * qatori (Jami · To'langan · Kutilmoqda — telefonda ikki qatorda, ega IN-S3), steklangan ustunlar (To'langan — yashil
 * asos, Kutilmoqda — sariq ustida) yoki jadval egizagi (yangi oy tepada, oxirida «Jami»; telefonda kartalar).
 * Oy — foyda DAVRINING tugagan oyi; joriy oy hali yopilmagan bo'lsa — izoh.
 */
export const MonthlyProfitCard = ({
  months,
  onMonthsChange,
  view,
  onViewChange,
  items,
  empty = false,
  refreshing = false,
  error,
  now,
}: MonthlyProfitCardProps) => {
  const { t, i18n } = useTranslation(["investor", "ui"]);
  const language = i18n.language;
  const names = monthNames(t);
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const compact = (value: number) => formatCompactMoneyLocalized(value, { language });
  const thisMonth = currentMonthKey(now);
  // Telefonda «Jami» qatori kartaga aylanmaydi — summalar karta tepasidagi yig'indida (maket `-home-table`).
  const isPhone = useIsPhone();

  const controls = empty && !error ? undefined : (
    <div className="flex flex-wrap items-center gap-2 max-md:w-full max-md:flex-col max-md:items-stretch">
      <SegmentedControl<string>
        ariaLabel={t("monthly.periodLabel")}
        value={String(months)}
        onValueChange={(value) => onMonthsChange(Number(value) as InvestorMonthsWindow)}
        options={MONTH_WINDOWS.map((count) => ({
          value: String(count),
          label: t("monthly.window", { count }),
        }))}
      />
      <ViewToggle value={view} onChange={onViewChange} />
    </div>
  );

  const header = {
    title: t("monthly.title"),
    description: t("monthly.sub"),
    actions: controls,
    // Telefonda davr va «Grafik | Jadval» to'liq enda, ustma-ust (maket): sarlavhadagi amallar o'rami ham to'liq en.
    className: "max-md:[&>div:first-child>div:last-child]:w-full",
  };

  if (error) {
    return (
      <Card divided={false} {...header} bodyClassName="flex flex-col gap-4">
        <ErrorState
          size="chart"
          error={error.error}
          title={t("monthly.windowErrorTitle")}
          description={`${loadErrorText(t, error.error)} ${t("monthly.windowErrorHint")}`}
          onRetry={error.onRetry}
          retrying={error.retrying}
        />
      </Card>
    );
  }

  if (items === undefined) {
    // Maket `investor-dashboard-loading`: yig'indi qatori (Jami · To'langan · Kutilmoqda) va oyna enidagi ustunlar.
    return (
      <Card divided={false} {...header} bodyClassName="flex flex-col gap-4" aria-busy="true">
        <div data-skeleton-summary="" className="flex flex-wrap gap-4">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex min-w-0 flex-[1_1_140px] flex-col gap-1.5">
              <Skeleton shape="line" width="60%" height={12} />
              <Skeleton shape="line" width="40%" height={16} />
            </div>
          ))}
        </div>
        <SkeletonChart bars={Math.min(months, 12)} className="justify-around" />
      </Card>
    );
  }

  if (empty) {
    return (
      <Card divided={false} {...header} bodyClassName="flex flex-col gap-4">
        <EmptyState size="chart" icon={ChartColumn} title={t("monthly.emptyTitle")} description={t("monthly.emptyText")} />
      </Card>
    );
  }

  const paid = items.reduce((sum, item) => sum + item.paid, 0);
  const unpaid = items.reduce((sum, item) => sum + item.unpaid, 0);
  const total = paid + unpaid;
  const count = items.length;

  const series: StackedBarsSeries[] = [
    { key: "paid", label: t("monthly.paid"), tone: "success" },
    { key: "unpaid", label: t("monthly.unpaid"), tone: "warning" },
  ];
  const columns: StackedBarsColumn[] = items.map((item) => ({
    key: item.month,
    label: names.short[parseMonthKey(item.month).month],
    title: monthTitle(item.month, names),
    values: { paid: item.paid, unpaid: item.unpaid },
    current: item.month === thisMonth,
  }));

  const first = items[0];
  const last = items[count - 1];
  const lower = (text: string) => text.toLocaleLowerCase(language);
  const ariaLabel =
    first && last
      ? t("monthly.ariaLabel", {
          from: lower(monthTitle(first.month, names)),
          to: lower(monthTitle(last.month, names)),
          total: compact(total),
          paid: compact(paid),
          unpaid: compact(unpaid),
        })
      : t("monthly.title");

  // Joriy oy hali yopilmagan: foyda davr tugagach hisoblanadi (maket izohi).
  const openMonth = last && last.month === thisMonth && last.total === 0 ? last : null;

  const summary = [
    { key: "total", label: t("monthly.total", { count }), value: compact(total) },
    { key: "paid", label: t("monthly.paid"), value: compact(paid) },
    { key: "unpaid", label: t("monthly.unpaid"), value: compact(unpaid) },
  ];

  const rows: MonthRow[] = [...items].reverse().map((item) => ({ ...item, current: item.month === thisMonth }));
  const totalRow: MonthRow = { month: "total", paid, unpaid, total, current: false, isTotal: true };
  const dash = <span className="text-text-subtle">—</span>;
  const cellMoney = (value: number, strong = false) =>
    value > 0 ? <span className={strong ? "font-semibold text-text" : undefined}>{money(value)}</span> : dash;

  return (
    <Card divided={false} {...header} bodyClassName="flex flex-col gap-4">
      <dl className="m-0 flex flex-wrap gap-4">
        {summary.map((item) => (
          <div key={item.key} className="flex min-w-0 flex-[1_1_140px] flex-col gap-0.5">
            <dt className="text-xs text-text-muted">{item.label}</dt>
            <dd className="m-0 whitespace-nowrap text-base font-bold text-text">{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className={cx("transition-opacity duration-150 motion-reduce:transition-none", refreshing && "opacity-45")}>
        {view === "chart" ? (
          <StackedBars series={series} columns={columns} ariaLabel={ariaLabel} />
        ) : (
          <DataTable<MonthRow>
            rows={isPhone ? rows : [...rows, totalRow]}
            getRowKey={(row) => row.month}
            label={t("monthly.tableLabel")}
            density="compact"
            className="overflow-hidden rounded-xl border border-border"
            rowClassName={(row) => (row.isTotal ? "font-semibold" : undefined)}
            cardsLabel={t("monthly.tableLabel")}
            columns={[
              {
                id: "month",
                header: t("monthly.colMonth"),
                cell: (row) =>
                  row.isTotal ? (
                    <span className="font-semibold">{t("monthly.totalRow", { count })}</span>
                  ) : (
                    <span className="inline-flex flex-wrap items-center gap-2 font-semibold">
                      {monthTitle(row.month, names)}
                      {row.current ? <Badge size="sm">{t("monthly.currentMonth")}</Badge> : null}
                    </span>
                  ),
              },
              {
                id: "paid",
                header: t("monthly.colPaid"),
                align: "end",
                cell: (row) => (row.current && row.total === 0 ? dash : cellMoney(row.paid, row.isTotal)),
              },
              {
                id: "unpaid",
                header: t("monthly.colUnpaid"),
                align: "end",
                cell: (row) => (row.current && row.total === 0 ? dash : cellMoney(row.unpaid, row.isTotal)),
              },
              {
                id: "total",
                header: t("monthly.colTotal"),
                align: "end",
                cell: (row) => (row.total > 0 ? <span className="font-semibold text-text">{money(row.total)}</span> : dash),
              },
            ]}
            renderCard={(row) => <MonthCard row={row} names={names} money={money} />}
          />
        )}
      </div>

      {view === "chart" ? (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          {/* Maket: rang belgisi + ikonka + so'z (holat faqat rang bilan berilmaydi). */}
          <ChartLegend
            items={series.map((item) => {
              const Icon = item.key === "paid" ? CircleCheck : Hourglass;
              return {
                key: item.key,
                tone: item.tone,
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <Icon size={14} aria-hidden="true" className="shrink-0" />
                    {item.label}
                  </span>
                ),
              };
            })}
          />
          {openMonth ? (
            <ChartNote>{t("monthly.note", { month: names.full[parseMonthKey(openMonth.month).month] })}</ChartNote>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
};

/** Telefondagi oy kartasi (maket `investor-dashboard-home-table`, `.el-show-mobile`): ikkala qism alohida qatorda. */
const MonthCard = ({
  row,
  names,
  money,
}: {
  row: MonthRow;
  names: ReturnType<typeof monthNames>;
  money: (value: number) => string;
}) => {
  const { t } = useTranslation("investor");
  const title = monthTitle(row.month, names);
  if (row.total === 0) {
    return (
      <div className="flex min-w-0 items-center justify-between gap-2 px-4 py-3">
        <span className="font-semibold text-text">{title}</span>
        <span className="text-[13px] text-text-muted">{row.current ? t("monthly.notCalculated") : t("monthly.noProfit")}</span>
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-1 px-4 py-3">
      <span className="flex justify-between gap-2">
        <span className="font-semibold text-text">{title}</span>
        <span className="whitespace-nowrap font-semibold text-text">{money(row.total)}</span>
      </span>
      <span className="flex flex-col gap-0.5 text-xs">
        <span className={row.paid > 0 ? "text-text-muted" : "text-text-subtle"}>
          {t("monthly.paidLine", { value: row.paid > 0 ? money(row.paid) : "—" })}
        </span>
        <span className={row.unpaid > 0 ? "text-warning-fg" : "text-text-subtle"}>
          {t("monthly.unpaidLine", { value: row.unpaid > 0 ? money(row.unpaid) : "—" })}
        </span>
      </span>
    </div>
  );
};
