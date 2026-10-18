// dizayn-v2: superadmin-neworders-incoming-sources, admin-neworders-incoming-sources, manager-new-orders-incoming-sources
import { memo, useMemo } from "react";
import { ChevronRight, Package } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { sourceLabel, type IncomingSource } from "../../../entities/incoming-orders";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { DataTable, type DataTableColumn } from "../../../shared/ui/primitives";
import { sourceColorIndex, waitingFor } from "../lib";
import { waitingText } from "./sourceFormat";
import { SourceKey, WaitingLabel, WaitMeter } from "./sourceVisuals";

/** Skanerlash sahifasi — manba (`market_id`) bo'yicha. */
const incomingScanPath = (source: IncomingSource) => `/new-orders/incoming/${source.market_id}`;

/** `.el-stat-icon` — neytral ikonka qutisi (36 px). */
const SOURCE_ICON = (
  <span
    aria-hidden="true"
    className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted"
  >
    <Package size={18} />
  </span>
);

/** `.el-iconbtn.el-iconbtn-sm` havola ko'rinishida (qatorning oxiridagi «›»). */
const ROW_LINK =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-text-muted " +
  "transition-[background-color,color] duration-150 hover:bg-sunken hover:text-text motion-reduce:transition-none max-md:size-11";

type Row = { source: IncomingSource; index: number };

/**
 * MANBALAR JADVALI (maket `superadmin-neworders-incoming-sources`): Manba · Posilkalar · Umumiy summa ·
 * Eng eski posilka (kutish + 3 kunlik chegara o'lchagichi) · «›». Telefonda — havola kartalar.
 *
 * Manba nomi — klaviatura uchun havola; qatorni sichqoncha bilan bosish ham o'sha skanerlash sahifasiga
 * olib boradi. Rang belgisi — yuqoridagi halqadagi bo'lak rangi (6 tadan ko'p manbada qolganlari kulrang).
 */
const SourcesTable = ({ sources }: { sources: readonly IncomingSource[] }) => {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const rows = useMemo<Row[]>(() => sources.map((source, index) => ({ source, index })), [sources]);

  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      {
        id: "source",
        header: t("incoming.colSource"),
        className: "w-[34%]",
        cell: ({ source, index }) => (
          <span className="flex min-w-0 items-center gap-3">
            {SOURCE_ICON}
            <Link
              to={incomingScanPath(source)}
              className="inline-flex min-w-0 items-center gap-2 font-semibold text-text hover:text-action-hover"
            >
              <SourceKey colorIndex={sourceColorIndex(sources, index)} />
              <span className="min-w-0 [overflow-wrap:anywhere]">{sourceLabel(source)}</span>
            </Link>
          </span>
        ),
      },
      {
        id: "parcels",
        header: t("incoming.colParcels"),
        align: "end",
        className: "w-[14%]",
        cell: ({ source }) => t("incoming.countTa", { count: source.orders_count }),
      },
      {
        id: "sum",
        header: t("incoming.colSum"),
        align: "end",
        className: "w-[20%]",
        cellClassName: "font-semibold",
        cell: ({ source }) => formatMoneyLocalized(source.total_price_sum),
      },
      {
        id: "oldest",
        header: t("incoming.colOldest"),
        className: "w-[24%] pl-10",
        cell: ({ source }) => {
          const waiting = waitingFor(source.oldest_at);
          return (
            <span className="flex flex-col items-start gap-1.5">
              <WaitingLabel t={t} waiting={waiting} />
              {waiting.unit === "none" ? null : (
                <WaitMeter
                  waiting={waiting}
                  label={t("incoming.meterLabel", { name: sourceLabel(source), wait: waitingText(t, waiting) })}
                />
              )}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: <span className="sr-only">{t("incoming.colActions")}</span>,
        className: "w-14",
        cellClassName: "text-right",
        cell: ({ source }) => {
          const label = t("incoming.openSource", { name: sourceLabel(source) });
          return (
            <Link to={incomingScanPath(source)} aria-label={label} title={label} className={ROW_LINK}>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          );
        },
      },
    ],
    [sources, t],
  );

  const renderCard = ({ source, index }: Row) => {
    const waiting = waitingFor(source.oldest_at);
    return (
      <Link to={incomingScanPath(source)} className="flex min-h-14 min-w-0 items-start gap-3 px-4 py-3 text-sm text-text">
        {SOURCE_ICON}
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 justify-between gap-2">
            <span className="inline-flex min-w-0 items-center gap-2 font-semibold">
              <SourceKey colorIndex={sourceColorIndex(sources, index)} />
              <span className="min-w-0 [overflow-wrap:anywhere]">{sourceLabel(source)}</span>
            </span>
            <span className="whitespace-nowrap font-semibold">{formatMoneyLocalized(source.total_price_sum)}</span>
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <span className="whitespace-nowrap text-[13px] text-text-muted">
              {t("incoming.parcelsCount", { count: source.orders_count })}
            </span>
            {waiting.unit === "none" ? null : <WaitingLabel t={t} waiting={waiting} />}
          </span>
        </span>
        <ChevronRight size={18} aria-hidden="true" className="mt-2 shrink-0 text-text-subtle" />
      </Link>
    );
  };

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowKey={({ source }) => String(source.market_id)}
      label={t("incoming.tableLabel")}
      onRowClick={({ source }) => navigate(incomingScanPath(source))}
      renderCard={renderCard}
      className="border-t border-border"
    />
  );
};

export default memo(SourcesTable);
