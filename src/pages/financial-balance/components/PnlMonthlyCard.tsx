// dizayn-v2: (maket yo'q) superadmin-balance-analysis, investor-dashboard-home
import { memo, useMemo, useState } from "react";
import { ChartColumn } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_PNL_MONTHS,
  PNL_MONTH_WINDOWS,
  isFinancePnlForbidden,
  useFinancePnl,
  type PnlMonth,
  type PnlMonthsWindow,
} from "../../../entities/payments/financePnl";
import { cx } from "../../../shared/lib/cx";
import { formatCompactMoneyLocalized, formatMoneyLocalized, formatSignedMoneyLocalized } from "../../../shared/lib/formatMoney";
import { ChartLegend, ChartNote, ViewToggle, type ChartView } from "../../../shared/ui/charts";
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  SegmentedControl,
  Skeleton,
  SkeletonChart,
  type DataTableColumn,
} from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import PnlMonthlyChart, { type PnlMonthLabels } from "./PnlMonthlyChart";

const UZ_MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
const UZ_MONTHS_SHORT = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];

const asMonthList = (value: unknown, fallback: string[]) =>
  Array.isArray(value) && value.length === 12 ? value.map(String) : fallback;

const monthIndex = (key: string) => Math.min(11, Math.max(0, Number(key.slice(5, 7)) - 1));

type MonthRow = PnlMonth & { current: boolean; isTotal?: boolean };

/**
 * «OYLIK DAROMAD VA SOF FOYDA» — butun tizim bo'yicha (ega 2026-11-28, Balans → Tahlil, faqat superadmin/admin):
 * `GET /finance/pnl`, davr 6 · 12 · 24 oy (investor «Oylik foyda» bilan bir xil), «Grafik | Jadval». Tahlil davri
 * tanlovidan mustaqil — o'z oynasi bor, shuning uchun tab tepasida, davr tanlovidan oldin turadi.
 *
 * Maket yo'q — eng yaqini: karta va boshqaruvlar `investor-dashboard-home` («Oylik foyda»), grafik
 * `superadmin-payments-overview` (kirim yuqoriga, chiqim pastga, sof chiziq). Qoidalar backend'da (`pnlSql`):
 * daromad − xarajat = sof foyda; qo'lda kirim alohida, sof foydaga kirmaydi — izohda va jadvalda ko'rinadi.
 * 403 (boshqa rol) — karta jim yashirinadi.
 */
const PnlMonthlyCard = () => {
  const { t, i18n } = useTranslation(["payments", "ui"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isPhone = useIsPhone();
  const [months, setMonths] = useState<PnlMonthsWindow>(DEFAULT_PNL_MONTHS);
  const [view, setView] = useState<ChartView>("chart");
  const query = useFinancePnl(months);
  const data = query.data ?? null;

  const labels = useMemo<PnlMonthLabels>(() => {
    const full = asMonthList(t("ui:date.months", { returnObjects: true }), UZ_MONTHS);
    const short = asMonthList(t("v2Balance.analysis.pnl.monthsShort", { returnObjects: true }), UZ_MONTHS_SHORT);
    return {
      short: (key) => short[monthIndex(key)],
      full: (key) => `${full[monthIndex(key)]} ${key.slice(0, 4)}`,
    };
  }, [t]);

  const money = (value: number) => formatMoneyLocalized(value, { language });
  const signed = (value: number) => formatSignedMoneyLocalized(value, { language });
  const compact = (value: number) => formatCompactMoneyLocalized(value, { language });

  const currentMonth = data?.to.slice(0, 7) ?? "";
  const rows = useMemo<MonthRow[]>(
    () => [...(data?.months ?? [])].reverse().map((item) => ({ ...item, current: item.month === currentMonth })),
    [data, currentMonth],
  );

  if (query.isError && isFinancePnlForbidden(query.error)) return null;

  const first = data?.months[0];
  const last = data?.months.at(-1);
  const lower = (value: string) => value.toLocaleLowerCase(language);
  const range = first && last ? `${lower(labels.full(first.month))} – ${lower(labels.full(last.month))}` : "";
  const empty = !!data && data.months.every((item) => item.gross === 0 && item.opex === 0);

  const controls = (
    <div className="flex flex-wrap items-center gap-2 max-md:w-full max-md:flex-col max-md:items-stretch">
      <SegmentedControl<string>
        ariaLabel={t("v2Balance.analysis.pnl.windowLabel")}
        value={String(months)}
        onValueChange={(value) => setMonths(Number(value) as PnlMonthsWindow)}
        options={PNL_MONTH_WINDOWS.map((count) => ({
          value: String(count),
          label: t("v2Balance.analysis.pnl.window", { count }),
        }))}
      />
      <ViewToggle value={view} onChange={setView} ariaLabel={t("v2Balance.analysis.pnl.viewLabel")} />
    </div>
  );

  const header = {
    as: "section" as const,
    divided: false,
    title: t("v2Balance.analysis.pnl.title"),
    description: range ? t("v2Balance.analysis.pnl.subtitle", { range }) : t("v2Balance.analysis.pnl.subtitleEmpty"),
    actions: controls,
    // Telefonda davr va «Grafik | Jadval» to'liq enda, ustma-ust: sarlavhadagi amallar o'rami ham to'liq en.
    className: "min-w-0 max-md:[&>div:first-child>div:last-child]:w-full",
    bodyClassName: "flex flex-col gap-4",
  };

  if (query.isLoading) {
    return (
      <Card {...header} aria-busy="true">
        <div role="status" aria-label={t("v2Balance.analysis.pnl.loading")} className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-4">
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex min-w-0 flex-[1_1_140px] flex-col gap-1.5">
                <Skeleton shape="line" width="60%" height={12} />
                <Skeleton shape="line" width="40%" height={16} />
              </div>
            ))}
          </div>
          <SkeletonChart className="h-[290px] justify-around max-md:h-44" bars={Math.min(months, 12)} />
        </div>
      </Card>
    );
  }

  if (query.isError || !data) {
    return (
      <Card {...header}>
        <ErrorState
          size="chart"
          error={query.error}
          title={t("v2Balance.analysis.pnl.loadError")}
          onRetry={() => void query.refetch()}
        />
      </Card>
    );
  }

  if (empty) {
    return (
      <Card {...header}>
        <EmptyState
          size="chart"
          icon={ChartColumn}
          title={t("v2Balance.analysis.pnl.empty")}
          description={t("v2Balance.analysis.pnl.emptyHint")}
        />
      </Card>
    );
  }

  const { totals } = data;
  const summary = [
    { key: "gross", label: t("v2Balance.analysis.pnl.grossTotal"), value: compact(totals.gross), tone: "" },
    { key: "opex", label: t("v2Balance.analysis.pnl.opexTotal"), value: compact(totals.opex), tone: "" },
    {
      key: "net",
      label: t("v2Balance.analysis.pnl.net"),
      value: formatCompactMoneyLocalized(totals.net, { language }),
      // Zarar — qizil (holat rangi «−» belgisi bilan birga); foyda — oddiy matn.
      tone: totals.net < 0 ? "text-danger-fg" : "",
    },
  ];
  const ariaLabel = t("v2Balance.analysis.pnl.aria", {
    range,
    gross: money(totals.gross),
    opex: money(totals.opex),
    net: signed(totals.net),
  });
  const openMonth = last && last.month === currentMonth ? last : null;

  const dash = <span className="text-text-subtle">—</span>;
  const cellMoney = (value: number, className?: string) =>
    value !== 0 ? <span className={cx("whitespace-nowrap", className)}>{money(value)}</span> : dash;
  const totalRow: MonthRow = { month: "total", ...totals, current: false, isTotal: true };

  const columns: DataTableColumn<MonthRow>[] = [
    {
      id: "month",
      header: t("v2Balance.analysis.pnl.table.month"),
      cell: (row) =>
        row.isTotal ? (
          <span className="font-semibold">{t("v2Balance.analysis.pnl.table.total")}</span>
        ) : (
          <span className="inline-flex flex-wrap items-center gap-2 font-semibold">
            {labels.full(row.month)}
            {row.current ? <Badge size="sm">{t("v2Balance.analysis.pnl.currentMonth")}</Badge> : null}
          </span>
        ),
    },
    {
      id: "gross",
      header: t("v2Balance.analysis.pnl.gross"),
      align: "end",
      cell: (row) => cellMoney(row.gross),
    },
    {
      id: "opex",
      header: t("v2Balance.analysis.pnl.opex"),
      align: "end",
      cell: (row) => cellMoney(row.opex),
    },
    {
      id: "net",
      header: t("v2Balance.analysis.pnl.net"),
      align: "end",
      cell: (row) =>
        row.net !== 0 ? (
          <span className={cx("whitespace-nowrap font-semibold", row.net < 0 ? "text-danger-fg" : "text-text")}>
            {signed(row.net)}
          </span>
        ) : (
          dash
        ),
    },
    {
      id: "otherIncome",
      header: t("v2Balance.analysis.pnl.otherIncome"),
      align: "end",
      hideBelow: "lg",
      cell: (row) => cellMoney(row.otherIncome, "text-text-muted"),
    },
  ];

  return (
    <Card {...header}>
      <dl className="m-0 flex flex-wrap gap-4">
        {summary.map((item) => (
          <div key={item.key} className="flex min-w-0 flex-[1_1_140px] flex-col gap-0.5">
            <dt className="text-xs text-text-muted">{item.label}</dt>
            <dd className={cx("m-0 whitespace-nowrap text-base font-bold", item.tone || "text-text")}>{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className={cx("transition-opacity duration-150 motion-reduce:transition-none", query.isPlaceholderData && "opacity-45")}>
        {view === "chart" ? (
          <PnlMonthlyChart months={data.months} labels={labels} ariaLabel={ariaLabel} />
        ) : (
          <DataTable<MonthRow>
            rows={isPhone ? rows : [...rows, totalRow]}
            getRowKey={(row) => row.month}
            label={t("v2Balance.analysis.pnl.title")}
            cardsLabel={t("v2Balance.analysis.pnl.title")}
            density="compact"
            className="overflow-hidden rounded-xl border border-border"
            rowClassName={(row) => (row.isTotal ? "font-semibold" : undefined)}
            columns={columns}
            renderCard={(row) => (
              <div className="flex flex-col gap-1 px-4 py-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="inline-flex flex-wrap items-center gap-2 font-semibold text-text">
                    {labels.full(row.month)}
                    {row.current ? <Badge size="sm">{t("v2Balance.analysis.pnl.currentMonth")}</Badge> : null}
                  </span>
                  <span className={cx("whitespace-nowrap font-semibold", row.net < 0 ? "text-danger-fg" : "text-text")}>
                    {signed(row.net)}
                  </span>
                </div>
                <div className="flex flex-wrap justify-end gap-x-3 text-[13px] text-text-muted">
                  <span>
                    {t("v2Balance.analysis.pnl.gross")} {money(row.gross)}
                  </span>
                  <span>
                    {t("v2Balance.analysis.pnl.opex")} {money(row.opex)}
                  </span>
                </div>
              </div>
            )}
          />
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        {view === "chart" ? (
          <ChartLegend
            items={[
              { key: "gross", label: t("v2Balance.analysis.pnl.gross"), tone: "action", keyClassName: "bg-chart-1" },
              { key: "opex", label: t("v2Balance.analysis.pnl.opex"), tone: "danger", keyClassName: "bg-chart-8" },
              { key: "net", label: t("v2Balance.analysis.pnl.netLegend"), tone: "neutral", line: true, keyClassName: "bg-text" },
            ]}
          />
        ) : null}
        <ChartNote>{t("v2Balance.analysis.pnl.rules")}</ChartNote>
        {totals.otherIncome !== 0 ? (
          <ChartNote>{t("v2Balance.analysis.pnl.otherIncomeNote", { amount: money(totals.otherIncome) })}</ChartNote>
        ) : null}
        {openMonth ? (
          <ChartNote>{t("v2Balance.analysis.pnl.openMonth", { month: labels.full(openMonth.month) })}</ChartNote>
        ) : null}
      </div>
    </Card>
  );
};

export default memo(PnlMonthlyCard);
