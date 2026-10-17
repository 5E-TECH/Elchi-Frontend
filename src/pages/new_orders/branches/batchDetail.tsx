// dizayn-v2: superadmin-neworders-branch-batch-detail, admin-neworders-branch-batch-detail
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Inbox, ListChecks, ScanLine } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import {
  useBatchDetail,
  useBatchRemainingDetail,
  useReceiveTransferBatchOrders,
  type BatchDetail,
  type BatchOrder,
} from "../../../entities/batch";
import { useBranchDetail } from "../../../entities/branch";
import { OrderStatusBadge } from "../../../entities/order";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { notify } from "../../../shared/lib/notify";
import { useOrderQrScanner } from "../../../shared/lib/useOrderQrScanner";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  QueryBoundary,
  Skeleton,
  type DataTableColumn,
  type DataTableSelection,
} from "../../../shared/ui/primitives";
import { formatBatchDisplayId } from "../../batches/lib/batchFormat";
import { getDeliveryLabelKey } from "../../orders/list/courier/list/orderActionModel";
import { playMissingOrderFeedback, playScanFeedback } from "../../scan/lib/scanShared";
import { SelectionRegion } from "../ui/SelectionRegion";
import {
  BATCH_STATUS_TONE,
  readBatchOrderDate,
  readBatchOrderStatus,
  readBatchRegion,
  readBranchId,
  readBranchName,
  sumBatchOrdersTotal,
  toDeliveryKind,
} from "./branchBatchesModel";

const known = (value: string | null | undefined) => (value && value.trim() && value !== "—" ? value : null);

/** Buyurtma tafsiloti (maketdagi `@orders-detail`). */
const orderHref = (order: BatchOrder) => `/orders/edit/${order.id}`;

/**
 * FILIAL PAKETI TAFSILOTI — `/new-orders/branches/:branchId/batches/:batchId` (superadmin/admin; qobiq `bare`).
 *
 * Sarlavha: «← {filial}» · «Paket B-140» + holat badge'i · «{viloyat} buyurtmalari · N ta · summa», yagona asosiy
 * amal «Qabul qilish — N ta buyurtma» (tanlanganlar; tasdiq oynasi yo'q — v1 va maketdagidek).
 * Karta: «Yo'nalish {manba} → {manzil}» + skaner maslahati («USB skaner tayyor»), tanlov paneli, jadval
 * (telefonda kartalar). USB skaner (klaviatura) buyurtma QR'ini o'qisa — buyurtma ro'yxatda tanlanadi.
 * Kamera rejimi (maket `*-camera`, telefondagi «Kamera bilan skanerlash») — keyinroq, alohida.
 *
 * Ma'lumot: `GET transfer-batches/:id`, bo'lmasa `…/remaining` (v1 dagidek). Qabul:
 * `POST transfer-batches/:id/receive-orders { orderIds }` — qabul qilinganlar ro'yxatdan yashiriladi.
 */
const BranchBatchDetailPage = () => {
  const { branchId = "", batchId = "" } = useParams<{ branchId: string; batchId: string }>();
  const { t, i18n } = useTranslation(["newOrders", "orders", "common"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const receiveBatchOrders = useReceiveTransferBatchOrders();
  const detailQuery = useBatchDetail(batchId);
  const remainingQuery = useBatchRemainingDetail(batchId);
  const sourceBranchQuery = useBranchDetail(branchId);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [receivedOrderIds, setReceivedOrderIds] = useState<Set<string>>(new Set());

  const data = useMemo<BatchDetail | undefined>(
    () => detailQuery.data ?? remainingQuery.data,
    [detailQuery.data, remainingQuery.data],
  );

  const isLoading = detailQuery.isLoading || remainingQuery.isLoading;
  const isError = detailQuery.isError && remainingQuery.isError;

  // Manzil filial nomi tafsilotda yo'q (faqat `destination_branch_id`) — `GET branches/:id` dan.
  const destinationName = readBranchName(data?.to_branch);
  const destinationQuery = useBranchDetail(destinationName ? undefined : readBranchId(data?.to_branch));

  const orders = useMemo(
    () => (data?.orders ?? []).filter((order) => !receivedOrderIds.has(order.id)),
    [data?.orders, receivedOrderIds],
  );
  const isAllSelected = orders.length > 0 && orders.every((order) => selectedOrderIds.has(order.id));

  const sourceName =
    readBranchName(sourceBranchQuery.data) ??
    readBranchName(data?.from_branch) ??
    t("branchBatches.batches.branchFallback", { id: branchId });
  const targetName = destinationName ?? readBranchName(destinationQuery.data);

  // «Barchasini tanlash» / «Barchasini bekor qilish» — paketdagi barcha (qabul qilinmagan) buyurtmalar, v1 dagidek.
  const toggleAll = useCallback(() => {
    setSelectedOrderIds((prev) =>
      orders.length > 0 && orders.every((order) => prev.has(order.id))
        ? new Set()
        : new Set(orders.map((order) => order.id)),
    );
  }, [orders]);

  const markOrdersReceived = useCallback((ids: string[]) => {
    setReceivedOrderIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const refetchBatchData = useCallback(async () => {
    await Promise.all([detailQuery.refetch(), remainingQuery.refetch()]);
  }, [detailQuery, remainingQuery]);

  const handleAcceptSelectedOrders = () => {
    const ids = Array.from(selectedOrderIds);
    if (ids.length === 0 || receiveBatchOrders.isPending || !batchId) return;

    receiveBatchOrders.mutate(
      { batchId, orderIds: ids },
      {
        onSuccess: async () => {
          markOrdersReceived(ids);
          notify.success(t("branchBatches.detail.receiveSuccess"), {
            description: t("branchBatches.detail.receiveSuccessDescription", {
              count: ids.length,
              value: formatNumberLocalized(ids.length, { language }),
            }),
          });
          await refetchBatchData();
        },
        onError: (error: unknown) => {
          const msg = getBackendErrorMessage(error) ?? t("receiveError");
          notify.error(t("receiveError"), { description: msg });
        },
      },
    );
  };

  const handleMissingScannedOrder = useCallback(() => {
    playMissingOrderFeedback();
    notify.warning(t("qrNotFound"), { description: t("branchBatches.detail.scanMissing"), duration: 3000 });
  }, [t]);

  // Skaner chaqiruvlari joriy tanlovni o'qiydi: yon ta'sir (ovoz, xabar) `setState` ichida emas.
  const selectedRef = useRef(selectedOrderIds);
  useEffect(() => {
    selectedRef.current = selectedOrderIds;
  }, [selectedOrderIds]);

  const selectScannedOrder = useCallback(
    (order: BatchOrder) => {
      if (selectedRef.current.has(order.id)) {
        void playScanFeedback("duplicate", t("common:scannerFeedbackDuplicate"));
        notify.warning(t("common:scannerFeedbackDuplicate"), { description: `#${order.id}`, duration: 2000 });
        return;
      }
      selectedRef.current = new Set(selectedRef.current).add(order.id);
      setSelectedOrderIds((prev) => {
        const next = new Set(prev);
        next.add(order.id);
        return next;
      });
      void playScanFeedback("success");
    },
    [t],
  );

  const scannerEnabled = orders.length > 0 && !receiveBatchOrders.isPending;
  useOrderQrScanner({
    orders,
    enabled: scannerEnabled,
    onMatch: selectScannedOrder,
    onMissing: handleMissingScannedOrder,
  });

  // ─── Ko'rinish ───────────────────────────────────────────────────────────────
  const money = useCallback((value: number) => formatMoneyLocalized(value, { language }), [language]);
  const count = useCallback((value: number) => formatNumberLocalized(value, { language }), [language]);
  const dateOf = useCallback(
    (order: BatchOrder) => {
      const value = readBatchOrderDate(order, data?.created_at);
      return value ? formatDateTimeLocalized(value, { language }) : "—";
    },
    [data?.created_at, language],
  );
  const statusBadge = useCallback((order: BatchOrder) => {
    const status = readBatchOrderStatus(order);
    return status ? <OrderStatusBadge status={status} /> : null;
  }, []);

  const deliveryBadge = useCallback(
    (order: BatchOrder) => {
      const key = getDeliveryLabelKey(toDeliveryKind(order.where_deliver));
      return key ? <Badge>{t(key, { ns: "orders" })}</Badge> : null;
    },
    [t],
  );

  const selection = useMemo<DataTableSelection<BatchOrder>>(
    () => ({
      isSelected: (order) => selectedOrderIds.has(order.id),
      onToggle: (order, checked) =>
        setSelectedOrderIds((prev) => {
          const next = new Set(prev);
          if (checked) next.add(order.id);
          else next.delete(order.id);
          return next;
        }),
      onToggleAll: (checked) => setSelectedOrderIds(checked ? new Set(orders.map((order) => order.id)) : new Set()),
      headerLabel: t("marketOrders.selectAllLabel"),
      rowLabel: (order) => t("marketOrders.selectRow", { id: order.id }),
    }),
    [orders, selectedOrderIds, t],
  );

  const columns = useMemo<DataTableColumn<BatchOrder>[]>(
    () => [
      {
        id: "order",
        header: t("marketOrders.columns.order"),
        cell: (order) => (
          <>
            <Link
              to={orderHref(order)}
              className="whitespace-nowrap font-semibold text-text hover:text-action-fg hover:underline"
            >
              №{order.id}
            </Link>
            <div className="whitespace-nowrap text-[13px] text-text-muted">{dateOf(order)}</div>
          </>
        ),
      },
      {
        id: "customer",
        header: t("marketOrders.columns.customer"),
        cell: (order) => (
          <>
            <div className="whitespace-nowrap font-semibold text-text">{known(order.receiver) ?? "—"}</div>
            <div className="whitespace-nowrap text-[13px] text-text-muted">{formatPhone(order.phone) || "—"}</div>
          </>
        ),
      },
      {
        id: "location",
        header: t("marketOrders.columns.location"),
        cell: (order) => (
          <>
            <div className="whitespace-nowrap">{order.district ?? known(order.address) ?? "—"}</div>
            {order.region ? <div className="whitespace-nowrap text-[13px] text-text-muted">{order.region}</div> : null}
          </>
        ),
      },
      {
        id: "status",
        header: t("branchBatches.batches.columns.status"),
        cell: statusBadge,
      },
      {
        id: "delivery",
        header: t("marketOrders.columns.delivery"),
        hideBelow: "lg",
        cell: deliveryBadge,
      },
      {
        id: "amount",
        header: t("marketOrders.columns.amount"),
        align: "end",
        cell: (order) => <span className="font-semibold text-text">{money(order.price)}</span>,
      },
    ],
    [dateOf, deliveryBadge, money, statusBadge, t],
  );

  // Telefon kartasi: chapda belgi (DataTable, 48 px), o'ngda butun karta — buyurtma tafsilotiga havola.
  const renderCard = useCallback(
    (order: BatchOrder) => {
      const place = order.district ?? known(order.address);
      return (
        <Link to={orderHref(order)} className="flex min-w-0 flex-col gap-1 py-3 pl-12 pr-4 text-sm text-text">
          <span className="flex min-w-0 justify-between gap-2">
            <span className="min-w-0 font-semibold">{known(order.receiver) ?? "—"}</span>
            <span className="whitespace-nowrap font-semibold">{money(order.price)}</span>
          </span>
          <span className="text-[13px] text-text-muted">
            №{order.id}
            {place ? ` · ${place}` : null}
            {order.phone ? (
              <>
                {" · "}
                <span className="whitespace-nowrap">{formatPhone(order.phone)}</span>
              </>
            ) : null}
          </span>
          <span className="flex flex-wrap gap-1.5">
            {statusBadge(order)}
            {deliveryBadge(order)}
          </span>
        </Link>
      );
    },
    [deliveryBadge, money, statusBadge],
  );

  const isLoaded = data !== undefined;
  const region = data ? readBatchRegion(data) : null;
  const totalSum = sumBatchOrdersTotal(orders);
  const selectedOrders = orders.filter((order) => selectedOrderIds.has(order.id));
  const displayId = formatBatchDisplayId(known(data?.id) ?? batchId);

  const description = isLoaded ? (
    <>
      {region ? <>{t("branchBatches.detail.regionOrders", { region })} · </> : null}
      <span className="whitespace-nowrap">{t("branchBatches.batches.qty", { value: count(orders.length) })}</span> ·{" "}
      <span className="whitespace-nowrap">{money(totalSum)}</span>
    </>
  ) : null;

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader
        back={`/new-orders/branches/${branchId}`}
        backLabel={sourceName}
        title={t("branchBatches.detail.title", { id: displayId })}
        meta={
          data ? (
            <Badge tone={BATCH_STATUS_TONE[data.status]} dot>
              {t(`batchStatus.${data.status}`)}
            </Badge>
          ) : null
        }
        description={description}
        actions={
          <Button
            leftIcon={Check}
            disabled={selectedOrderIds.size === 0}
            loading={receiveBatchOrders.isPending}
            loadingText={t("receiving")}
            onClick={handleAcceptSelectedOrders}
          >
            <Trans
              t={t}
              i18nKey="marketOrders.receive"
              values={{ value: count(selectedOrderIds.size) }}
              count={selectedOrderIds.size}
              components={{ long: <span className="max-md:hidden" /> }}
            />
          </Button>
        }
      />

      <Card as="section" padding="none" aria-label={t("branchBatches.detail.cardLabel")}>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 max-md:px-4">
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
            <p className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="text-xs font-semibold uppercase tracking-[.05em] text-text-muted">
                {t("branchBatches.detail.direction")}
              </span>
              <span className="inline-flex flex-wrap items-center gap-1.5 font-semibold text-text">
                {sourceBranchQuery.isLoading && !readBranchName(data?.from_branch) ? (
                  <Skeleton width={140} height={14} />
                ) : (
                  sourceName
                )}
                {targetName ? (
                  <>
                    <ArrowRight aria-hidden="true" size={16} strokeWidth={2} className="shrink-0 text-text-subtle" />
                    {targetName}
                  </>
                ) : null}
              </span>
            </p>
            <p className="flex items-center gap-1.5 text-xs text-text-muted">
              <ScanLine aria-hidden="true" size={14} className="shrink-0" />
              <span>{t("branchBatches.detail.scanHint")}</span>
            </p>
          </div>
          {scannerEnabled ? (
            <Badge tone="success" dot role="status" className="max-md:hidden">
              {t("marketOrders.scannerReady")}
            </Badge>
          ) : null}
        </div>

        {orders.length > 0 ? (
          <SelectionRegion
            idle={selectedOrders.length === 0}
            label={t("branchBatches.batches.selectionRegion")}
            title={
              selectedOrders.length > 0
                ? t("marketOrders.selectedSummary", {
                    value: count(selectedOrders.length),
                    sum: money(sumBatchOrdersTotal(selectedOrders)),
                  })
                : t("marketOrders.noneSelected")
            }
            hint={t("branchBatches.detail.selectionHint")}
            action={
              <Button variant="ghost" size="sm" leftIcon={ListChecks} onClick={toggleAll} className="max-md:px-2">
                {isAllSelected ? t("deselectAll") : t("selectAll")}
              </Button>
            }
          />
        ) : null}

        <QueryBoundary
          query={{
            data: isLoaded ? orders : undefined,
            isLoading,
            isError,
            error: detailQuery.error ?? remainingQuery.error,
            refetch: refetchBatchData,
          }}
          keepPreviousData={false}
          skeleton="table"
          loadingLabel={t("marketOrders.loading")}
          empty={
            <EmptyState
              icon={Inbox}
              title={t("branchBatches.detail.emptyTitle")}
              description={t("branchBatches.detail.emptyDescription")}
            />
          }
          className="border-t border-border"
        >
          {(list, { isRefetching }) => (
            <DataTable
              rows={list}
              columns={columns}
              getRowKey={(order) => order.id}
              label={t("branchBatches.detail.tableLabel")}
              density="tight"
              selection={selection}
              // Qator bosilsa — tanlov (v1 kartasidagidek); buyurtma raqami havolasi tafsilotni ochadi.
              onRowClick={(order) => selection.onToggle(order, !selectedOrderIds.has(order.id))}
              renderCard={renderCard}
              busy={isRefetching}
            />
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
};

export default memo(BranchBatchDetailPage);
