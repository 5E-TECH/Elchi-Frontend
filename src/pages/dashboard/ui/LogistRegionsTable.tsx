// dizayn-v2: logist-dashboard-main
import { ChevronRight, CircleX, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized, formatPercentLocalized } from "../../../shared/lib/formatMoney";
import { CHART_FILL, ChartLegend, successZoneTone } from "../../../shared/ui/charts";
import { Card, DataTable, type DataTableColumn } from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import type { DashboardPeriod } from "../../../entities/dashboard/lib/period";
import {
  logistRegionHref,
  type LogistDashboardModel,
  type LogistRegionRow,
  type LogistSummary,
} from "../model/logistDashboard";

type TableRow = { kind: "region"; row: LogistRegionRow } | { kind: "total"; summary: LogistSummary };

/** «›» havola-ikonka (maket `.el-iconbtn`, ghost `IconButton` md ko'rinishi; telefonda jadval yo'q). */
const DETAIL_LINK =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] text-text-muted " +
  "transition-[background-color,color] duration-150 hover:bg-sunken hover:text-text active:bg-border " +
  "motion-reduce:transition-none";

/** Kichik holat chizig'i (`.el-segbar`, jadvalda 8px, kartada 6px): sotilgan · jarayonda · bekor. */
const MiniSegBar = ({
  row,
  ariaLabel,
  className,
}: {
  row: Pick<LogistRegionRow, "delivered" | "pending" | "cancelled">;
  ariaLabel: string;
  className: string;
}) => {
  const parts = [
    { key: "sold", value: row.delivered, fill: CHART_FILL.success },
    { key: "pending", value: row.pending, fill: CHART_FILL.warning },
    { key: "cancelled", value: row.cancelled, fill: CHART_FILL.danger },
  ].filter((part) => part.value > 0);
  return (
    <div role="img" aria-label={ariaLabel} className={cx("flex min-w-0 gap-0.5", className)}>
      {parts.length > 0 ? (
        parts.map((part) => (
          <span
            key={part.key}
            data-segbar-segment={part.key}
            className={cx("block min-w-1 first:rounded-l-[4px] last:rounded-r-[4px]", part.fill)}
            style={{ flex: `${part.value} 1 0` }}
          />
        ))
      ) : (
        <span className="block flex-1 rounded-[4px] bg-sunken" />
      )}
    </div>
  );
};

const RateCell = ({ row }: { row: LogistRegionRow }) => {
  const { i18n } = useTranslation();
  if (!row.hasOrders) return <span className="text-text-subtle">—</span>;
  const tone = successZoneTone(row.rate);
  const Icon = tone === "warning" ? TriangleAlert : tone === "danger" ? CircleX : null;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {Icon ? (
        <Icon
          size={14}
          aria-hidden="true"
          className={tone === "warning" ? "text-warning-fg" : "text-danger-fg"}
        />
      ) : null}
      {formatPercentLocalized(row.rate, { language: i18n.language })}
    </span>
  );
};

/**
 * «VILOYATLARIM (N)» (maket `logist-dashboard-main`): jadval — viloyat (tumanlar soni), buyurtmalar ustuni,
 * holat chizig'i, muvaffaqiyat, faol kuryer, «›» tafsilot; oxirida «Jami» qatori. Planshetda «Holat» va «Faol kuryer»
 * yashirin, telefonda kartalar. LG-3: viloyat nomi, «›» va telefon kartasi — `/regions?region=<id>&period=…` havolasi (bosh sahifa davri bilan).
 */
export const LogistRegionsTable = ({
  model,
  period,
  periodText,
}: {
  model: LogistDashboardModel;
  /** Bosh sahifa davri — «Tafsilot» havolasiga o'tadi (`/regions` shu davrda ochiladi). */
  period: DashboardPeriod;
  periodText: string;
}) => {
  const { t, i18n } = useTranslation("dashboard");
  const language = i18n.language;
  const isPhone = useIsPhone();
  const count = (value: number) => formatNumberLocalized(value, { language });
  const maxOrders = Math.max(0, ...model.rows.map((row) => row.total));
  const { summary } = model;

  const couriersText = (active: number | null, total: number | null) =>
    active == null || total == null ? "—" : `${count(active)} / ${count(total)}`;
  const statusAria = (row: Pick<LogistRegionRow, "delivered" | "pending" | "cancelled">) =>
    t("v2Logist.table.statusAria", {
      sold: count(row.delivered),
      pending: count(row.pending),
      cancelled: count(row.cancelled),
    });
  const totalCell = "font-semibold text-text";
  const href = (regionId: string) => logistRegionHref(regionId, period);

  const columns: DataTableColumn<TableRow>[] = [
    {
      id: "region",
      header: t("v2Logist.table.region"),
      cell: (item) =>
        item.kind === "total" ? (
          <span className={totalCell}>{t("v2Logist.table.total", { count: summary.regionCount })}</span>
        ) : (
          <Link
            to={href(item.row.id)}
            className="flex min-w-0 flex-col gap-0.5 text-inherit no-underline hover:[&>span:first-child]:underline"
          >
            <span className="whitespace-nowrap font-semibold text-text">{item.row.name}</span>
            <span className="whitespace-nowrap text-[13px] text-text-muted">
              {t("v2Logist.table.districts", { count: item.row.districtCount })}
            </span>
          </Link>
        ),
    },
    {
      id: "orders",
      header: t("v2Logist.table.orders"),
      className: "w-[24%]",
      cell: (item) => {
        if (item.kind === "total") {
          return <span className={totalCell}>{t("v2Charts.countTa", { value: count(summary.total) })}</span>;
        }
        const width = maxOrders > 0 ? (item.row.total / maxOrders) * 100 : 0;
        return (
          <span
            role="img"
            aria-label={t("v2Logist.table.ordersAria", { name: item.row.name, count: item.row.total, value: count(item.row.total) })}
            className="flex min-w-0 items-center gap-2"
          >
            <span
              aria-hidden="true"
              className="block h-4 min-w-0.5 flex-none rounded-r-[4px] bg-action"
              style={{ width: `calc((100% - 3rem) * ${(width / 100).toFixed(4)})` }}
            />
            <span aria-hidden="true" className="whitespace-nowrap font-semibold text-text">
              {count(item.row.total)}
            </span>
          </span>
        );
      },
    },
    {
      id: "status",
      header: t("v2Logist.table.status"),
      hideBelow: "lg",
      cell: (item) =>
        item.kind === "total" ? (
          <span className={totalCell}>
            {count(summary.delivered)} · {count(summary.pending)} · {count(summary.cancelled)}
          </span>
        ) : (
          <div className="flex min-w-[120px] flex-col gap-1.5">
            <MiniSegBar row={item.row} ariaLabel={statusAria(item.row)} className="h-2" />
            <span className="whitespace-nowrap text-xs text-text-muted">
              {count(item.row.delivered)} · {count(item.row.pending)} · {count(item.row.cancelled)}
            </span>
          </div>
        ),
    },
    {
      id: "success",
      header: t("v2Logist.table.success"),
      align: "end",
      cell: (item) =>
        item.kind === "total" ? (
          <span className={totalCell}>
            {summary.total > 0 ? formatPercentLocalized(summary.rate, { language }) : "—"}
          </span>
        ) : (
          <RateCell row={item.row} />
        ),
    },
    {
      id: "couriers",
      header: t("v2Logist.table.couriers"),
      align: "end",
      hideBelow: "lg",
      cell: (item) =>
        item.kind === "total" ? (
          <span className={totalCell}>{couriersText(summary.activeCouriers, summary.totalCouriers)}</span>
        ) : (
          <span className="whitespace-nowrap">{couriersText(item.row.activeCouriers, item.row.totalCouriers)}</span>
        ),
    },
    {
      id: "detail",
      header: <span className="sr-only">{t("v2Logist.table.detail")}</span>,
      className: "w-12",
      cell: (item) =>
        item.kind === "total" ? null : (
          <Link
            to={href(item.row.id)}
            aria-label={t("v2Logist.table.detailAria", { name: item.row.fullName })}
            title={t("v2Logist.table.detailAria", { name: item.row.fullName })}
            className={DETAIL_LINK}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        ),
    },
  ];

  const rows: TableRow[] = [
    ...model.rows.map((row): TableRow => ({ kind: "region", row })),
    // «Jami» qatori — jadvalda; telefon kartalarida yo'q (maket).
    ...(isPhone ? [] : [{ kind: "total", summary } as TableRow]),
  ];

  const renderCard = (item: TableRow) => {
    if (item.kind === "total") return null;
    const { row } = item;
    const rate = row.hasOrders ? formatPercentLocalized(row.rate, { language }) : "—";
    return (
      <Link
        to={href(row.id)}
        className="flex min-h-16 min-w-0 flex-col gap-2 py-3 text-inherit no-underline"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate font-semibold text-text">{row.name}</span>
          <span className="whitespace-nowrap font-semibold text-text">
            {t("v2Charts.countTa", { value: count(row.total) })}
          </span>
        </span>
        <MiniSegBar
          row={row}
          ariaLabel={`${row.name}: ${statusAria(row)}`}
          className="h-1.5"
        />
        <span className="truncate text-xs text-text-muted">
          {row.activeCouriers == null || row.totalCouriers == null
            ? t("v2Logist.table.cardSummaryNoCouriers", { rate })
            : t("v2Logist.table.cardSummary", {
                rate,
                active: count(row.activeCouriers),
                total: count(row.totalCouriers),
              })}
        </span>
      </Link>
    );
  };

  return (
    <Card
      divided={false}
      title={t("v2Logist.table.title")}
      titleAddon={
        <span className="text-base font-semibold text-text-muted">({count(summary.regionCount)})</span>
      }
      description={periodText}
      bodyClassName="flex flex-col gap-4"
    >
      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(item) => (item.kind === "total" ? "total" : item.row.id)}
        label={t("v2Logist.table.label")}
        density="compact"
        rowClassName={(item) => (item.kind === "total" ? "bg-sunken hover:bg-sunken" : undefined)}
        renderCard={renderCard}
        className="rounded-xl border border-border max-md:rounded-none max-md:border-0"
      />
      <ChartLegend
        className="max-lg:hidden"
        items={[
          { key: "sold", tone: "success", label: t("v2Logist.legend.sold") },
          { key: "pending", tone: "warning", label: t("v2Logist.legend.pending") },
          { key: "cancelled", tone: "danger", label: t("v2Logist.legend.cancelled") },
        ]}
      />
    </Card>
  );
};
