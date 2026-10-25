// dizayn-v2: superadmin-warehouse-list, admin-warehouse-list
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { hqFirst, HqWarehouseBadge, WarehouseStatusBadge, type Warehouse } from "../../../entities/warehouse";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { DataTable, StatusBadge, type DataTableColumn } from "../../../shared/ui/primitives";
import { warehousePath } from "../model/paths";
import { useWarehouseText } from "../model/useWarehouseText";

const Dash = ({ label }: { label: string }) => (
  <>
    <span aria-hidden="true" className="text-text-subtle">
      —
    </span>
    <span className="sr-only">{label}</span>
  </>
);

/**
 * OMBORLAR JADVALI (maket `superadmin-warehouse-list`): «Ombor (filial) · Viloyat · Mas'ul xodim · Jami dona (tur) ·
 * Band · Kam qolgan (tugagan) · Oxirgi harakat · Holat». Planshetda (< 1024) viloyat, mas'ul, band va oxirgi harakat
 * yashirin — viloyat filial nomi yonida; telefonda kartalar (nom + holat, filial · viloyat · mas'ul, «486 dona · 12
 * tur · 38 band» + «3 ta kam» + sana; to'xtatilganda «Qoldiq saqlanadi · yangi buyurtma tushmaydi»).
 * Markaziy ombor (Pa1KaXmj; maket yo'q — eng yaqini `superadmin-warehouse-list`): qatori tepada (joriy sahifada),
 * nom yonida «Markaziy» belgisi (telefon kartasida ham). «Viloyat» — HQ filialining viloyati, viloyat omborlaridagidek:
 * backend ro'yxatning «Viloyat:» filtri va qidiruvi ham shu `region` bo'yicha (HQ'da viloyat bo'lmasa — «—»), ekran
 * filtrga zid bo'lmasin.
 */
export const WarehousesTable = ({
  rows,
  busy,
  onOpen,
}: {
  rows: readonly Warehouse[];
  busy?: boolean;
  onOpen: (warehouse: Warehouse) => void;
}) => {
  const { t } = useTranslation("warehouses");
  const text = useWarehouseText();
  const ordered = useMemo(() => hqFirst(rows), [rows]);

  const lastMovement = (row: Warehouse) => {
    if (row.status === "PAUSED" && row.pausedAt) {
      return { date: text.dateTime(row.pausedAt), summary: t("list.pausedAt") };
    }
    if (!row.lastMovement) return null;
    const movement = row.lastMovement;
    return {
      date: text.dateTime(movement.createdAt),
      summary: text.lastMovementSummary({ ...movement, orderId: movement.refType === "order" ? movement.refId : null }),
    };
  };

  const lowCount = (row: Warehouse) => row.summary.lowCount + row.summary.outCount;

  const columns: DataTableColumn<Warehouse>[] = [
    {
      id: "name",
      header: t("list.columns.warehouse"),
      cell: (row) => (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              to={warehousePath(row.id)}
              onClick={(event) => event.stopPropagation()}
              className="whitespace-nowrap font-semibold text-text no-underline hover:text-action-hover"
            >
              {row.name}
            </Link>
            {row.isHq ? <HqWarehouseBadge /> : null}
          </span>
          <span className="text-[13px] text-text-muted">
            {row.branch?.name ?? ""}
            {row.region ? <span className="lg:hidden">{` · ${row.region.name}`}</span> : null}
          </span>
        </span>
      ),
    },
    {
      id: "region",
      header: t("list.columns.region"),
      hideBelow: "lg",
      className: "whitespace-nowrap",
      cell: (row) => row.region?.name ?? <Dash label={t("list.noRegion")} />,
    },
    {
      id: "manager",
      header: <span title={t("list.columns.managerTitle")}>{t("list.columns.manager")}</span>,
      hideBelow: "lg",
      cell: (row) =>
        row.manager?.name ? (
          <span className="flex flex-col gap-0.5 whitespace-nowrap">
            <span className="text-text">{row.manager.name}</span>
            {row.manager.phone ? (
              <span className="text-[13px] text-text-muted">{formatPhone(row.manager.phone)}</span>
            ) : null}
          </span>
        ) : (
          <Dash label={t("list.noManager")} />
        ),
    },
    {
      id: "onHand",
      header: t("list.columns.onHand"),
      align: "end",
      cell: (row) => (
        <span className="flex flex-col items-end gap-0.5 whitespace-nowrap">
          <span>
            <span className="font-semibold text-text">{text.number(row.summary.onHand)}</span>{" "}
            <span className="text-text-muted">{t("units.pcsWord", { count: row.summary.onHand })}</span>
          </span>
          <span className="text-[13px] text-text-muted">{t("list.positions", { count: row.summary.positions, value: text.number(row.summary.positions) })}</span>
        </span>
      ),
    },
    {
      id: "reserved",
      header: <span title={t("list.columns.reservedTitle")}>{t("list.columns.reserved")}</span>,
      align: "end",
      hideBelow: "lg",
      cell: (row) =>
        row.summary.reserved > 0 ? (
          text.number(row.summary.reserved)
        ) : (
          <span className="text-text-subtle">{text.number(0)}</span>
        ),
    },
    {
      id: "low",
      header: t("list.columns.low"),
      align: "end",
      cell: (row) =>
        lowCount(row) > 0 ? (
          <span className="flex flex-col items-end gap-1">
            <StatusBadge tone="warning" label={t("list.lowCount", { count: lowCount(row), value: text.number(lowCount(row)) })} />
            {row.summary.outCount > 0 ? (
              <span className="whitespace-nowrap text-[13px] text-danger-fg">
                {t("list.outCount", { count: row.summary.outCount, value: text.number(row.summary.outCount) })}
              </span>
            ) : null}
          </span>
        ) : (
          <Dash label={t("list.noLow")} />
        ),
    },
    {
      id: "lastMovement",
      header: t("list.columns.lastMovement"),
      hideBelow: "lg",
      cell: (row) => {
        const last = lastMovement(row);
        return last ? (
          <span className="flex flex-col gap-0.5 whitespace-nowrap">
            <span className="text-text">{last.date}</span>
            <span className="text-[13px] text-text-muted">{last.summary}</span>
          </span>
        ) : (
          <Dash label={t("list.noMovements")} />
        );
      },
    },
    {
      id: "status",
      header: t("list.columns.status"),
      cell: (row) => <WarehouseStatusBadge status={row.status} />,
    },
  ];

  const renderCard = (row: Warehouse) => {
    const last = lastMovement(row);
    const meta = [row.branch?.name, row.region?.name, row.manager?.name].filter(Boolean).join(" · ");
    return (
      <Link
        to={warehousePath(row.id)}
        className="flex min-w-0 flex-col gap-1.5 px-4 py-3 text-text no-underline"
      >
        <span className="flex items-start justify-between gap-2">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0 font-semibold text-text">{row.name}</span>
            {row.isHq ? <HqWarehouseBadge /> : null}
          </span>
          <WarehouseStatusBadge status={row.status} className="shrink-0" />
        </span>
        {meta ? <span className="text-[13px] text-text-muted">{meta}</span> : null}
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="text-[13px]">
            <span className="font-semibold text-text">{text.pcs(row.summary.onHand)}</span>
            <span className="text-text-muted">
              {` · ${t("list.positions", { count: row.summary.positions, value: text.number(row.summary.positions) })}`}
              {row.summary.reserved > 0 ? ` · ${t("list.reservedShort", { value: text.number(row.summary.reserved) })}` : ""}
            </span>
          </span>
          {lowCount(row) > 0 ? (
            <StatusBadge tone="warning" label={t("list.lowShort", { count: lowCount(row), value: text.number(lowCount(row)) })} />
          ) : null}
          {last ? <span className="ml-auto whitespace-nowrap text-xs text-text-muted">{last.date}</span> : null}
        </span>
        {row.status === "PAUSED" ? <span className="text-[13px] text-text-muted">{t("list.pausedHint")}</span> : null}
      </Link>
    );
  };

  return (
    <DataTable
      rows={ordered}
      columns={columns}
      getRowKey={(row) => row.id}
      label={t("list.tableLabel")}
      cardsLabel={t("list.tableLabel")}
      renderCard={renderCard}
      onRowClick={onOpen}
      busy={busy}
      className="border-t border-border"
    />
  );
};
