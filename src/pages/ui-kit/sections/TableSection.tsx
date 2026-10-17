import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { Badge } from "../../../shared/ui/primitives/Badge";
import { Card } from "../../../shared/ui/primitives/Card";
import { DataTable, type DataTableColumn, type DataTableSort } from "../../../shared/ui/primitives/DataTable";
import { Pagination } from "../../../shared/ui/primitives/Pagination";
import { StatusBadge } from "../../../shared/ui/primitives/StatusBadge";
import type { Tone } from "../../../shared/ui/primitives/tone";
import { KitSection } from "../KitSection";
import { ThemePair, type KitPanelTheme } from "../ThemePair";

/**
 * «Jadval va sahifalash» bo'limi (`?section=table`) — `DataTable` + `Pagination`.
 *
 * Namuna maketdan: `superadmin-orders-list` (ustunlar, «Sana bo'yicha saralash», planshetda yashirin
 * ustunlar, pastda «1–10 / 1 248 ta buyurtma» va ‹ 1 2 3 … 125 ›) va `manager-orders-list-cancelled`
 * (tanlov ustuni, tanlab bo'lmaydigan qator). Telefonda (< 768) jadval o'rniga kartalar.
 * Ikkala panel bitta holatni bo'lishadi (kunduzgi panelda tanlansa, tungida ham).
 * Ostida — ochiladigan qator (`expandable`, maket `superadmin-activity-logs-row-expanded`): chevron
 * ustuni, ochilgan panel, tafsiloti yo'q qatorda chevron yo'q.
 */

type DemoRow = {
  id: string;
  name: string;
  phone: string;
  district: string;
  region: string;
  statusKey: "new" | "onTheRoad" | "cancelled" | "cancelledSent";
  amount: number;
  /** Bugungi kundan necha kun oldin va soat:daqiqa — sana `formatDateTimeLocalized` bilan («Bugun, 14:40»). */
  at: [days: number, hours: number, minutes: number];
};

const atDate = ([days, hours, minutes]: DemoRow["at"]) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, hours, minutes);
};

/** Maketdagi qatorlar (`superadmin-orders-list`, `manager-orders-list-cancelled`). */
const ROWS: DemoRow[] = [
  { id: "10242", name: "Sevara Tursunova", phone: "+998905621407", district: "Chilonzor tumani", region: "Toshkent sh.", statusKey: "new", amount: 1150000, at: [0, 14, 40] },
  { id: "10238", name: "Javohir Toshmatov", phone: "+998977013345", district: "Mirobod tumani", region: "Toshkent sh.", statusKey: "onTheRoad", amount: 1280000, at: [0, 11, 20] },
  { id: "10235", name: "Malika Yusupova", phone: "+998998124011", district: "Sergeli tumani", region: "Toshkent sh.", statusKey: "cancelled", amount: 96000, at: [1, 18, 4] },
  { id: "10231", name: "Shahnoza Ergasheva", phone: "+998952047719", district: "Uchtepa tumani", region: "Toshkent sh.", statusKey: "cancelledSent", amount: 320000, at: [1, 14, 5] },
];

/** Ochiladigan qator namunasi — maket `superadmin-activity-logs-row-expanded` dagi qatorlar. */
type LogDemoRow = {
  id: string;
  who: string;
  roleKey: "courier" | "registrar" | "market";
  actionKey: "statusChanged" | "created" | "loggedOut";
  objectKey: "order" | "user";
  objectRef: string;
  at: DemoRow["at"];
  hasChanges: boolean;
};

const LOG_ROWS: LogDemoRow[] = [
  { id: "l1", who: "Jasur Tursunov", roleKey: "courier", actionKey: "statusChanged", objectKey: "order", objectRef: "№10227", at: [0, 14, 32], hasChanges: true },
  { id: "l2", who: "Bobur Xolmatov", roleKey: "registrar", actionKey: "created", objectKey: "order", objectRef: "№10244", at: [0, 14, 18], hasChanges: true },
  { id: "l3", who: "Akbar Nurmatov", roleKey: "market", actionKey: "loggedOut", objectKey: "user", objectRef: "#61", at: [1, 16, 31], hasChanges: false },
];

const LOG_TONE: Record<LogDemoRow["actionKey"], Tone> = { statusChanged: "neutral", created: "info", loggedOut: "neutral" };

const STATUS_TONE: Record<DemoRow["statusKey"], { tone: Tone; outline?: boolean }> = {
  new: { tone: "info" },
  onTheRoad: { tone: "warning" },
  cancelled: { tone: "danger" },
  cancelledSent: { tone: "danger", outline: true },
};

export const TableSection = () => {
  const { t, i18n } = useTranslation("ui");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [sort, setSort] = useState<DataTableSort | null>({ key: "createdAt", direction: "desc" });
  const [selected, setSelected] = useState<Set<string>>(new Set(["10235"]));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openLogs, setOpenLogs] = useState<Set<string>>(new Set(["l1"]));

  const status = (row: DemoRow) => (
    <StatusBadge
      tone={STATUS_TONE[row.statusKey].tone}
      variant={STATUS_TONE[row.statusKey].outline ? "outline" : undefined}
      label={t(`tableKit.status.${row.statusKey}`)}
    />
  );

  const columns: DataTableColumn<DemoRow>[] = [
    {
      id: "createdAt",
      header: t("tableKit.columns.order"),
      sortable: true,
      firstDirection: "desc",
      sortTitle: t("tableKit.sortByDate"),
      cell: (row) => (
        <>
          <div className="whitespace-nowrap font-semibold text-text">№{row.id}</div>
          <div className="whitespace-nowrap text-[13px] text-text-muted">{formatDateTimeLocalized(atDate(row.at), { language })}</div>
        </>
      ),
    },
    {
      id: "customer",
      header: t("tableKit.columns.customer"),
      cell: (row) => (
        <>
          <div className="whitespace-nowrap font-semibold">{row.name}</div>
          <div className="whitespace-nowrap text-[13px] text-text-muted">{formatPhone(row.phone)}</div>
        </>
      ),
    },
    {
      id: "area",
      header: t("tableKit.columns.area"),
      hideBelow: "lg",
      cell: (row) => (
        <>
          <div className="whitespace-nowrap">{row.district}</div>
          <div className="whitespace-nowrap text-[13px] text-text-muted">{row.region}</div>
        </>
      ),
    },
    { id: "status", header: t("tableKit.columns.status"), sortable: true, cell: status },
    {
      id: "delivery",
      header: t("tableKit.columns.delivery"),
      hideBelow: "lg",
      cell: () => <Badge>{t("tableKit.toHome")}</Badge>,
    },
    {
      id: "total_price",
      header: t("tableKit.columns.amount"),
      sortable: true,
      align: "end",
      cell: (row) => <span className="font-semibold">{formatMoneyLocalized(row.amount, { language })}</span>,
    },
  ];

  const objectName = (row: LogDemoRow) => `${t(`tableKit.expand.${row.objectKey}`)} ${row.objectRef}`;

  const logColumns: DataTableColumn<LogDemoRow>[] = [
    {
      id: "time",
      header: t("tableKit.expand.time"),
      cell: (row) => <span className="whitespace-nowrap">{formatDateTimeLocalized(atDate(row.at), { language })}</span>,
    },
    {
      id: "who",
      header: t("tableKit.expand.who"),
      cell: (row) => (
        <>
          <div className="whitespace-nowrap font-semibold">{row.who}</div>
          <div className="text-[13px] text-text-muted">{t(`tableKit.expand.${row.roleKey}`)}</div>
        </>
      ),
    },
    {
      id: "action",
      header: t("tableKit.expand.action"),
      cell: (row) => <Badge tone={LOG_TONE[row.actionKey]}>{t(`tableKit.expand.${row.actionKey}`)}</Badge>,
    },
    {
      id: "object",
      header: t("tableKit.expand.object"),
      cell: (row) => (
        <span className="whitespace-nowrap font-semibold">
          {t(`tableKit.expand.${row.objectKey}`)} <span className="font-medium text-text-muted">{row.objectRef}</span>
        </span>
      ),
    },
  ];

  const logPanel = (row: LogDemoRow) => (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-text">{t("tableKit.expand.changes")}</h3>
      <dl className="grid grid-cols-[minmax(88px,30%)_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-text-muted">{t("tableKit.expand.status")}</dt>
        <dd className="m-0">
          {row.actionKey === "created" ? (
            <span className="text-text-muted">—</span>
          ) : (
            <span className="text-text-muted line-through">{t("tableKit.expand.onTheRoad")}</span>
          )}
          {" → "}
          <span className="font-semibold">
            {row.actionKey === "created" ? t("tableKit.status.new") : t("tableKit.expand.sold")}
          </span>
        </dd>
      </dl>
    </div>
  );

  const demo = (theme: KitPanelTheme) => (
    <div className="flex flex-col gap-4">
      <Card padding="none" aria-label={`${t("tableKit.label")} (${theme})`}>
        <DataTable
          rows={ROWS}
          columns={columns}
          getRowKey={(row) => row.id}
          label={t("tableKit.label")}
          sort={sort}
          onSortChange={setSort}
          density="tight"
          selection={{
            isSelected: (row) => selected.has(row.id),
            isSelectable: (row) => row.statusKey === "cancelled" || row.statusKey === "new",
            onToggle: (row, checked) =>
              setSelected((previous) => {
                const next = new Set(previous);
                if (checked) next.add(row.id);
                else next.delete(row.id);
                return next;
              }),
            onToggleAll: (checked) =>
              setSelected(checked ? new Set(ROWS.filter((row) => row.statusKey === "cancelled" || row.statusKey === "new").map((row) => row.id)) : new Set()),
            headerLabel: t("tableKit.selectAll"),
            rowLabel: (row) => t("tableKit.selectRow", { id: row.id }),
            disabledRowLabel: (row) => t("tableKit.cannotSelect", { id: row.id }),
          }}
          renderCard={(row) => (
            <div className="flex min-w-0 flex-col gap-1 px-4 py-3 pl-12">
              <span className="flex justify-between gap-2">
                <span className="font-semibold">{row.name}</span>
                <span className="whitespace-nowrap font-semibold">{formatMoneyLocalized(row.amount, { language })}</span>
              </span>
              <span className="text-[13px] text-text-muted">
                №{row.id} · {row.district}
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                {status(row)}
                <span className="ml-auto whitespace-nowrap text-xs text-text-muted">{formatDateTimeLocalized(atDate(row.at), { language })}</span>
              </span>
            </div>
          )}
          className="border-t border-border"
        />
        <div className="border-t border-border px-5 py-3 max-md:px-4">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={1248}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            summary={(range) => t("tableKit.summary", range)}
          />
        </div>
      </Card>
      <Card padding="none" aria-label={`${t("tableKit.expand.label")} (${theme})`}>
        <DataTable
          rows={LOG_ROWS}
          columns={logColumns}
          getRowKey={(row) => row.id}
          label={t("tableKit.expand.label")}
          expandable={{
            isExpanded: (row) => openLogs.has(row.id),
            canExpand: (row) => row.hasChanges,
            onToggle: (row, next) =>
              setOpenLogs((previous) => {
                const copy = new Set(previous);
                if (next) copy.add(row.id);
                else copy.delete(row.id);
                return copy;
              }),
            toggleLabel: (row, expanded) =>
              t(expanded ? "tableKit.expand.close" : "tableKit.expand.open", { object: objectName(row) }),
            panelId: (row) => `kit-log-${theme}-${row.id}`,
            render: logPanel,
          }}
          renderCard={(row) => (
            <div className="flex min-w-0 flex-col gap-1 px-4 py-3">
              <span className="flex items-center justify-between gap-2">
                <Badge tone={LOG_TONE[row.actionKey]}>{t(`tableKit.expand.${row.actionKey}`)}</Badge>
                <span className="whitespace-nowrap text-[13px] text-text-muted">
                  {formatDateTimeLocalized(atDate(row.at), { language })}
                </span>
              </span>
              <span className="font-semibold">{objectName(row)}</span>
              <span className="text-[13px] text-text-muted">
                {row.who} · {t(`tableKit.expand.${row.roleKey}`)}
              </span>
            </div>
          )}
        />
      </Card>
    </div>
  );

  return (
    <KitSection id="table" title={t("kit.sections.table.title")} description={t("kit.sections.table.description")}>
      <ThemePair layout="stack">{demo}</ThemePair>
    </KitSection>
  );
};
