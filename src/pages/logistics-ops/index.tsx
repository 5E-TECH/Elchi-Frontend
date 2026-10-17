// dizayn-v2: superadmin-ops-logistics
import { memo, useState } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useLogisticsCoverage } from "../../entities/logistics/logisticsCoverage";
import { getBackendErrorMessage } from "../../shared/lib/backendError";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  QueryBoundary,
  StatusBadge,
  type DataTableColumn,
  type Tone,
} from "../../shared/ui/primitives";
import { useIsPhone } from "../../shared/ui/primitives/date/useIsPhone";
import { OpsAlert, OpsIntro, OpsToolPage } from "../ops/ui/OpsToolPage";
import { extractReturnRequestRows, type ReturnRequestRow } from "./lib/returnRequestRows";

/**
 * OPS → «Logistika» (maket `superadmin-ops-logistics`): qaytarish so'rovlari (`GET post/return-requests/list`
 * — kuryer bo'yicha guruhlangan `data.groups[].orders`) va tanlanganlarini tasdiqlash
 * (`POST post/return-requests/approve` — FAQAT `{ order_ids }`, fix3b CODE-09).
 *
 * Matnlar: sarlavha, ustunlar va natija xabarlari — `returns:opsReturnRequests.*` (o'qiladi); maketdagi yangi
 * matnlar — `ops:logistics.*`.
 */

/** Qaytarish so'rovi holati (backend `RETURN_REQUEST_STATUSES`: WAITING, ON_THE_ROAD). */
const STATUS_TONE: Record<string, Tone> = { waiting: "warning", on_the_road: "neutral" };

const LogisticsOpsPage = ({ embedded = false }: { embedded?: boolean }) => {
  const { t } = useTranslation(["ops", "returns"]);
  const isPhone = useIsPhone();
  const { useGetReturnRequestsList, approveReturnRequest } = useLogisticsCoverage();

  const returnRequests = useGetReturnRequestsList();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // fix3 CODE-09 / C13: javob `data.groups[].orders` — kuryer bo'yicha guruhlangan.
  const rows = extractReturnRequestRows(returnRequests.data);

  // Tanlov faqat ro'yxatda hozir bor qatorlardan — yangilangan ro'yxatda yo'qolgan qator yuborilmaydi.
  const selectedRows = rows.filter((row) => selectedKeys.includes(row.key));
  const selectedOrderIds = selectedRows.map((row) => row.order_id || row.id).filter(Boolean);
  const selectedCount = selectedOrderIds.length;

  const toggle = (row: ReturnRequestRow, checked: boolean) =>
    setSelectedKeys((previous) =>
      checked ? [...previous.filter((key) => key !== row.key), row.key] : previous.filter((key) => key !== row.key),
    );
  const toggleAll = (checked: boolean) => setSelectedKeys(checked ? rows.map((row) => row.key) : []);

  /**
   * fix3b CODE-09: tasdiqlash ilgari erkin JSON (`{"order_id": "..."}`) yuborardi,
   * `ReturnRequestsActionRequestDto` esa faqat `{ order_ids: string[] }` qabul qiladi — har doim 400.
   * Endi tanlangan qatorlarning buyurtma id lari yuboriladi.
   */
  const handleApprove = () => {
    if (selectedCount === 0 || approveReturnRequest.isPending) return;
    approveReturnRequest.mutate({ order_ids: selectedOrderIds }, { onSuccess: () => setSelectedKeys([]) });
  };


  const statusBadge = (row: ReturnRequestRow) => (
    <StatusBadge
      tone={STATUS_TONE[row.status] ?? "neutral"}
      label={t(`logistics.statuses.${row.status}`, { defaultValue: row.status || "—" })}
    />
  );
  const courierName = (row: ReturnRequestRow) => row.courier || t("logistics.list.noCourier");
  const orderLink = (row: ReturnRequestRow) => {
    const orderId = row.order_id || row.id;
    return orderId ? (
      <Link to={`/orders/edit/${orderId}`} className="font-semibold text-text hover:text-action-fg">
        {t("logistics.list.orderLink", { id: orderId })}
      </Link>
    ) : (
      <span>—</span>
    );
  };

  const columns: DataTableColumn<ReturnRequestRow>[] = [
    {
      id: "id",
      header: t("returns:opsReturnRequests.columns.id"),
      className: "w-24",
      cell: (row) => <span className="text-text-muted">{row.id || "—"}</span>,
    },
    { id: "order", header: t("returns:opsReturnRequests.columns.order"), className: "w-40", cell: orderLink },
    { id: "status", header: t("returns:opsReturnRequests.columns.status"), className: "w-[260px]", cell: statusBadge },
    {
      id: "courier",
      header: t("returns:opsReturnRequests.columns.courier"),
      cell: (row) => <span className="whitespace-nowrap">{courierName(row)}</span>,
    },
  ];

  const allSelected = rows.length > 0 && selectedRows.length === rows.length;

  return (
    <OpsToolPage tabKey="logistics" embedded={embedded}>
      <OpsIntro
        title={t("returns:opsReturnRequests.title")}
        description={t("returns:opsReturnRequests.description")}
      />

      <Card
        padding="none"
        title={t("logistics.list.title")}
        actions={
          returnRequests.data !== undefined && !returnRequests.isError ? (
            <Badge>{t("common.count", { count: rows.length })}</Badge>
          ) : null
        }
      >
        <QueryBoundary
          query={returnRequests}
          skeleton="table"
          isEmpty={() => rows.length === 0}
          empty={<EmptyState title={t("returns:opsReturnRequests.empty")} />}
          error={(error, retry) => (
            <ErrorState
              error={error}
              title={t("returns:opsReturnRequests.loadError")}
              retryLabel={t("common.retry")}
              onRetry={retry}
            />
          )}
        >
          {() => (
            <>
              {/* Tanlov paneli (maket `role="region"` «Tanlangan so'rovlar»): son, izoh, «Tanlovni bekor qilish», tasdiqlash. */}
              <div
                role="region"
                aria-label={t("logistics.list.selection")}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-action-soft px-5 py-3 max-md:px-4"
              >
                <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-0.5">
                  <span className="font-semibold text-action-fg">
                    {selectedCount > 0
                      ? t("logistics.list.selected", { count: selectedCount })
                      : t("returns:opsReturnRequests.selectHint")}
                  </span>
                  <span className="text-xs text-text-muted">{t("logistics.list.grouped")}</span>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 max-md:ml-auto">
                  {selectedCount > 0 ? (
                    <Button variant="ghost" size="sm" compact onClick={() => setSelectedKeys([])}>
                      {t("logistics.list.clear")}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    compact
                    leftIcon={Check}
                    disabled={selectedCount === 0}
                    loading={approveReturnRequest.isPending}
                    onClick={handleApprove}
                  >
                    {t("logistics.list.approve", { count: selectedCount })}
                  </Button>
                </div>
              </div>

              {approveReturnRequest.isSuccess || approveReturnRequest.isError ? (
                <div className="border-b border-border px-5 py-3 max-md:px-4">
                  {approveReturnRequest.isError ? (
                    <OpsAlert tone="danger" title={t("returns:opsReturnRequests.approveError")}>
                      {getBackendErrorMessage(approveReturnRequest.error)}
                    </OpsAlert>
                  ) : (
                    <OpsAlert tone="success" title={t("returns:opsReturnRequests.approveSuccess")} />
                  )}
                </div>
              ) : null}

              {isPhone ? (
                <label className="flex min-h-12 cursor-pointer items-center gap-1 border-b border-border bg-sunken py-0.5 pl-1 pr-4">
                  <span className="inline-flex size-11 flex-none items-center justify-center">
                    <input
                      type="checkbox"
                      className="size-[18px] cursor-pointer accent-action"
                      checked={allSelected}
                      ref={(node) => {
                        if (node) node.indeterminate = selectedRows.length > 0 && !allSelected;
                      }}
                      aria-label={t("logistics.list.selectAll")}
                      onChange={(event) => toggleAll(event.target.checked)}
                    />
                  </span>
                  <span className="flex-1 text-[13px] font-semibold text-text">{t("logistics.list.selectAllShort")}</span>
                  <span className="text-xs text-text-muted">
                    {t("logistics.list.selectedOf", { selected: selectedRows.length, total: rows.length })}
                  </span>
                </label>
              ) : null}

              <DataTable
                rows={rows}
                columns={columns}
                getRowKey={(row) => row.key}
                label={t("logistics.list.title")}
                selection={{
                  isSelected: (row) => selectedKeys.includes(row.key),
                  onToggle: toggle,
                  onToggleAll: toggleAll,
                  headerLabel: t("logistics.list.selectAll"),
                  rowLabel: (row) => t("logistics.list.selectRow", { id: row.id || row.order_id }),
                }}
                renderCard={(row) => {
                  const orderId = row.order_id || row.id;
                  const body = (
                    <>
                      <span className="flex justify-between gap-2">
                        <span className="font-semibold text-text">
                          {orderId ? t("logistics.list.orderLink", { id: orderId }) : "—"}
                        </span>
                        <span className="text-xs text-text-muted">{t("common.idValue", { id: row.id || "—" })}</span>
                      </span>
                      <span className="text-[13px] text-text-muted">{courierName(row)}</span>
                      <span>{statusBadge(row)}</span>
                    </>
                  );
                  // Telefonda butun karta — buyurtma havolasi (belgi kartadan tashqarida, 48 px).
                  return orderId ? (
                    <Link to={`/orders/edit/${orderId}`} className="flex min-w-0 flex-col gap-1 py-3 pl-12 pr-4">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex min-w-0 flex-col gap-1 py-3 pl-12 pr-4">{body}</div>
                  );
                }}
              />
            </>
          )}
        </QueryBoundary>
      </Card>
    </OpsToolPage>
  );
};

export default memo(LogisticsOpsPage);
