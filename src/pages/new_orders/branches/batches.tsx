// dizayn-v2: superadmin-neworders-branch-batches, admin-neworders-branch-batches
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, Inbox, ListChecks, SearchX } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useBatches, useReceiveTransferBatch, type Batch } from "../../../entities/batch";
import { useBranchDetail } from "../../../entities/branch";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
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
  SkeletonTable,
  TextInput,
  type DataTableColumn,
  type DataTableSelection,
} from "../../../shared/ui/primitives";
import { formatBatchDisplayId } from "../../batches/lib/batchFormat";
import { playMissingOrderFeedback, playScanFeedback } from "../../scan/lib/scanShared";
import { SelectionRegion } from "../../../shared/ui/SelectionRegion";
import {
  BATCH_STATUS_TONE,
  matchesBatchSearch,
  readBatchRegion,
  readBranchName,
  sumBatchesTotal,
  toScannableBatches,
} from "./branchBatchesModel";

/** Havola ko'rinishidagi ikonka-tugma (`.el-iconbtn-sm`, ghost) — telefonda 44 px. */
const ICON_LINK =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-text-muted " +
  "transition-[background-color,color] duration-150 hover:bg-sunken hover:text-text " +
  "motion-reduce:transition-none max-md:size-11";

type ScannableBatch = Batch & { qr_code_token: string | null };

/**
 * FILIAL PAKETLARI — `/new-orders/branches/:branchId` (superadmin/admin; qobiq `bare`), dizayn v2.
 *
 * Sarlavha: «← Filial paketlari» · filial nomi · «Filialdan yuborilgan, qabul kutayotgan paketlar · N ta · summa»,
 * yagona asosiy amal «Qabul qilish — N ta paket» (tanlanganlarga; tasdiq oynasi yo'q — v1 va maketdagidek).
 * Karta: qidiruv (viloyat, paket raqami, token) + «Skaner tayyor» qatori, tanlov paneli, jadval (telefonda
 * kartalar). USB skaner (klaviatura) paket QR'ini o'qisa — paket ro'yxatda tanlanadi (qabul qilinmaydi).
 *
 * So'rov: `transfer-batches?source_branch_id&status=SENT&direction=FORWARD&page=1&limit=100` (sahifalash yo'q,
 * 100 ta bilan cheklangan — v1 dagidek). Qabul: har paketga `POST transfer-batches/:id/receive`
 * (`Promise.allSettled`) — qabul qilinganlar ro'yxatdan yashiriladi, muvaffaqiyat va xato alohida xabar.
 */
const BranchSentBatchesPage = () => {
  const { branchId = "" } = useParams<{ branchId: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation(["newOrders", "common"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());
  const [receivedBatchIds, setReceivedBatchIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const receiveTransferBatch = useReceiveTransferBatch();
  const branchQuery = useBranchDetail(branchId);

  const batchesQuery = useBatches({
    sourceBranchId: branchId,
    statusRaw: "SENT",
    directionRaw: "FORWARD",
    page: 1,
    limit: 100,
  });
  const { data, isLoading, isError } = batchesQuery;

  const rows = useMemo(
    () => (data?.data ?? []).filter((row) => !receivedBatchIds.has(row.id)),
    [data?.data, receivedBatchIds],
  );
  const visibleRows = useMemo(() => rows.filter((row) => matchesBatchSearch(row, search)), [rows, search]);
  const scannableRows = useMemo<ScannableBatch[]>(() => toScannableBatches(rows), [rows]);
  const isAllSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedBatchIds.has(row.id));
  const knownBranchName = readBranchName(branchQuery.data) ?? readBranchName(rows[0]?.from_branch);
  const isNameLoading = !knownBranchName && (branchQuery.isLoading || isLoading);
  const branchName = knownBranchName ?? t("branchBatches.batches.branchFallback", { id: branchId });

  // Skaner chaqiruvlari joriy tanlovni o'qiydi: yon ta'sir (ovoz, xabar) `setState` ichida emas.
  // Ref tanlov o'zgarganda yangilanadi, skaner tanlaganda esa darhol (ketma-ket ikki skaner ham takror deb topiladi).
  const selectedRef = useRef(selectedBatchIds);
  useEffect(() => {
    selectedRef.current = selectedBatchIds;
  }, [selectedBatchIds]);

  // «Barchasini tanlash» / «Tanlovni bekor qilish» — ko'rinib turgan (qidiruvdagi) paketlar, v1 dagidek.
  const toggleAll = useCallback(() => {
    setSelectedBatchIds((prev) => {
      const next = new Set(prev);
      const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => prev.has(row.id));
      visibleRows.forEach((row) => (allVisibleSelected ? next.delete(row.id) : next.add(row.id)));
      return next;
    });
  }, [visibleRows]);

  const markBatchesReceived = useCallback((ids: string[]) => {
    setReceivedBatchIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    setSelectedBatchIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const handleAcceptSelectedBatches = async () => {
    const ids = Array.from(selectedBatchIds);
    if (ids.length === 0 || receiveTransferBatch.isPending) return;

    const results = await Promise.allSettled(ids.map((id) => receiveTransferBatch.mutateAsync(id)));
    const successIds = ids.filter((_, index) => results[index].status === "fulfilled");
    const successCount = successIds.length;
    const failedCount = results.length - successCount;

    if (successCount > 0) {
      markBatchesReceived(successIds);
      notify.success(t("branchBatches.batches.receiveSuccess"), {
        description: t("branchBatches.batches.receiveSuccessDescription", {
          count: successCount,
          value: formatNumberLocalized(successCount, { language }),
        }),
      });
    }

    if (failedCount > 0) {
      notify.error(t("branchBatches.batches.receiveError"), {
        description: t("branchBatches.batches.receiveErrorDescription", {
          count: failedCount,
          value: formatNumberLocalized(failedCount, { language }),
        }),
      });
    }
  };

  const handleMissingScannedBatch = useCallback(() => {
    playMissingOrderFeedback();
    notify.warning(t("qrNotFound"), { description: t("branchBatches.batches.scanMissing"), duration: 3000 });
  }, [t]);

  const selectScannedBatch = useCallback(
    (batch: ScannableBatch) => {
      if (selectedRef.current.has(batch.id)) {
        void playScanFeedback("duplicate", t("common:scannerFeedbackDuplicate"));
        notify.warning(t("common:scannerFeedbackDuplicate"), { description: `#${batch.id}`, duration: 2000 });
        return;
      }
      selectedRef.current = new Set(selectedRef.current).add(batch.id);
      setSelectedBatchIds((prev) => {
        const next = new Set(prev);
        next.add(batch.id);
        return next;
      });
      void playScanFeedback("success");
    },
    [t],
  );

  const scannerEnabled = scannableRows.length > 0 && !receiveTransferBatch.isPending;
  useOrderQrScanner({
    orders: scannableRows,
    enabled: scannerEnabled,
    onMatch: selectScannedBatch,
    onMissing: handleMissingScannedBatch,
  });

  // ─── Ko'rinish ───────────────────────────────────────────────────────────────
  const money = useCallback((value: number) => formatMoneyLocalized(value, { language }), [language]);
  const count = useCallback((value: number) => formatNumberLocalized(value, { language }), [language]);
  const dateTime = useCallback((value: string) => formatDateTimeLocalized(value, { language }), [language]);
  const batchHref = useCallback((batch: Batch) => `/new-orders/branches/${branchId}/batches/${batch.id}`, [branchId]);

  const selectedRows = useMemo(() => rows.filter((row) => selectedBatchIds.has(row.id)), [rows, selectedBatchIds]);
  const totalSum = sumBatchesTotal(rows);

  const statusBadge = useCallback(
    (batch: Batch) => (
      <Badge tone={BATCH_STATUS_TONE[batch.status]} dot>
        {t(`batchStatus.${batch.status}`)}
      </Badge>
    ),
    [t],
  );

  const selection = useMemo<DataTableSelection<Batch>>(
    () => ({
      isSelected: (batch) => selectedBatchIds.has(batch.id),
      onToggle: (batch, checked) =>
        setSelectedBatchIds((prev) => {
          const next = new Set(prev);
          if (checked) next.add(batch.id);
          else next.delete(batch.id);
          return next;
        }),
      onToggleAll: (checked) =>
        setSelectedBatchIds((prev) => {
          const next = new Set(prev);
          visibleRows.forEach((batch) => (checked ? next.add(batch.id) : next.delete(batch.id)));
          return next;
        }),
      headerLabel: t("branchBatches.batches.selectAllLabel"),
      rowLabel: (batch) => t("branchBatches.batches.selectRow", { id: formatBatchDisplayId(batch.id) }),
    }),
    [selectedBatchIds, t, visibleRows],
  );

  const columns = useMemo<DataTableColumn<Batch>[]>(
    () => [
      {
        id: "batch",
        header: t("branchBatches.batches.columns.batch"),
        className: "w-[20%]",
        cell: (batch) => (
          <>
            <Link
              to={batchHref(batch)}
              className="whitespace-nowrap font-semibold text-text hover:text-action-fg hover:underline"
            >
              {formatBatchDisplayId(batch.id)}
            </Link>
            <div className="whitespace-nowrap text-[13px] text-text-muted">{dateTime(batch.created_at)}</div>
          </>
        ),
      },
      {
        id: "region",
        header: t("branchBatches.batches.columns.region"),
        cell: (batch) => readBatchRegion(batch) ?? "—",
      },
      {
        id: "orders",
        header: t("branchBatches.batches.columns.orders"),
        align: "end",
        cell: (batch) => t("branchBatches.batches.ordersCell", { value: count(batch.orders_count) }),
      },
      {
        id: "status",
        header: t("branchBatches.batches.columns.status"),
        cell: statusBadge,
      },
      {
        id: "amount",
        header: t("branchBatches.batches.columns.amount"),
        align: "end",
        cell: (batch) => <span className="font-semibold text-text">{money(batch.total_price)}</span>,
      },
      {
        id: "actions",
        header: <span className="sr-only">{t("branchBatches.batches.columns.actions")}</span>,
        className: "w-14",
        cellClassName: "text-right",
        cell: (batch) => {
          const label = t("branchBatches.batches.open", { id: formatBatchDisplayId(batch.id) });
          return (
            <Link to={batchHref(batch)} aria-label={label} title={label} className={ICON_LINK}>
              <ChevronRight aria-hidden="true" size={16} strokeWidth={2} />
            </Link>
          );
        },
      },
    ],
    [batchHref, count, dateTime, money, statusBadge, t],
  );

  // Telefon kartasi: chapda belgi (DataTable, 48 px), o'ngda butun karta — paket tafsilotiga havola.
  const renderCard = useCallback(
    (batch: Batch) => {
      const region = readBatchRegion(batch);
      return (
        <Link to={batchHref(batch)} className="flex min-w-0 flex-col gap-1 py-3 pl-12 pr-4 text-sm text-text">
          <span className="flex min-w-0 justify-between gap-2">
            <span className="min-w-0 font-semibold">
              {formatBatchDisplayId(batch.id)}
              {region ? ` · ${region}` : null}
            </span>
            <span className="whitespace-nowrap font-semibold">{money(batch.total_price)}</span>
          </span>
          <span className="text-[13px] text-text-muted">
            {t("branchBatches.batches.ordersSub", { count: batch.orders_count, value: count(batch.orders_count) })}
            {" · "}
            <span className="whitespace-nowrap">{dateTime(batch.created_at)}</span>
          </span>
          <span className="flex flex-wrap gap-1.5">{statusBadge(batch)}</span>
        </Link>
      );
    },
    [batchHref, count, dateTime, money, statusBadge, t],
  );

  const isLoaded = data !== undefined;
  const qty = (value: number) => t("branchBatches.batches.qty", { value: count(value) });

  const list = (
    <QueryBoundary
      query={{
        data: isLoaded ? rows : undefined,
        isLoading,
        isError,
        error: batchesQuery.error,
        refetch: batchesQuery.refetch,
      }}
      keepPreviousData={false}
      loadingLabel={t("branchBatches.batches.loading")}
      loading={
        <SkeletonTable
          framed={false}
          columns={[
            t("branchBatches.batches.columns.batch"),
            t("branchBatches.batches.columns.region"),
            t("branchBatches.batches.columns.orders"),
            t("branchBatches.batches.columns.status"),
            t("branchBatches.batches.columns.amount"),
          ]}
          rows={6}
        />
      }
      empty={
        <EmptyState
          icon={Inbox}
          title={t("branchBatches.batches.emptyTitle")}
          description={t("branchBatches.batches.emptyDescription")}
        />
      }
      className="border-t border-border"
    >
      {(_, { isRefetching }) =>
        visibleRows.length > 0 ? (
          <DataTable
            rows={visibleRows}
            columns={columns}
            getRowKey={(batch) => batch.id}
            label={t("branchBatches.batches.tableLabel")}
            selection={selection}
            onRowClick={(batch) => navigate(batchHref(batch))}
            renderCard={renderCard}
            busy={isRefetching}
          />
        ) : (
          <EmptyState
            icon={SearchX}
            title={t("branchBatches.batches.noMatchTitle")}
            description={t("branchBatches.batches.noMatchDescription")}
            action={
              <Button variant="secondary" size="sm" onClick={() => setSearch("")}>
                {t("branchBatches.batches.clearSearch")}
              </Button>
            }
          />
        )
      }
    </QueryBoundary>
  );

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader
        back="/new-orders/branches"
        backLabel={t("branchesTab")}
        title={isNameLoading ? <Skeleton width={224} height={32} /> : branchName}
        description={
          isLoaded ? (
            <>
              {t("branchBatches.batches.description")} · <span className="whitespace-nowrap">{qty(rows.length)}</span>{" "}
              · <span className="whitespace-nowrap">{money(totalSum)}</span>
            </>
          ) : null
        }
        actions={
          <Button
            leftIcon={Check}
            disabled={selectedBatchIds.size === 0}
            loading={receiveTransferBatch.isPending}
            loadingText={t("receiving")}
            onClick={() => void handleAcceptSelectedBatches()}
          >
            <Trans
              t={t}
              i18nKey="branchBatches.batches.receive"
              values={{ value: count(selectedBatchIds.size) }}
              count={selectedBatchIds.size}
              components={{ long: <span className="max-md:hidden" /> }}
            />
          </Button>
        }
      />

      <Card as="section" padding="none" aria-label={t("branchBatches.batches.cardLabel")}>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 max-md:px-4">
          <TextInput
            mode="search"
            value={search}
            onValueChange={setSearch}
            placeholder={t("branchBatches.batches.searchPlaceholder")}
            aria-label={t("branchBatches.batches.searchLabel")}
            className="min-w-0 max-w-[480px] flex-[1_1_320px]"
          />
          {scannerEnabled ? (
            <p role="status" className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[13px] text-text-muted">
              <Badge tone="success" dot>
                {t("branchBatches.batches.scannerReady")}
              </Badge>
              <span>{t("branchBatches.batches.scanHint")}</span>
            </p>
          ) : null}
        </div>

        {rows.length > 0 ? (
          <SelectionRegion
            idle={selectedRows.length === 0}
            label={t("branchBatches.batches.selectionRegion")}
            title={
              selectedRows.length > 0
                ? t("branchBatches.batches.selectedSummary", {
                    value: count(selectedRows.length),
                    sum: money(sumBatchesTotal(selectedRows)),
                  })
                : t("branchBatches.batches.noneSelected")
            }
            hint={t("branchBatches.batches.selectionHint")}
            action={
              <Button
                variant="ghost"
                size="sm"
                leftIcon={ListChecks}
                onClick={toggleAll}
                disabled={visibleRows.length === 0}
                className="max-md:px-2"
              >
                {isAllSelected ? t("branchBatches.batches.clearSelection") : t("selectAll")}
              </Button>
            }
          />
        ) : null}

        {list}
      </Card>
    </div>
  );
};

export default memo(BranchSentBatchesPage);
