// dizayn-v2: superadmin-payments-cash-detail-courier, superadmin-payments-cash-detail-market, superadmin-payments-cash-detail-branch, admin-payments-cash-detail-courier, admin-payments-cash-detail-market, admin-payments-cash-detail-branch, manager-payments-cash-detail-courier, manager-payments-cash-detail-branch
import { memo, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ReceiptText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import type { PaymentRow } from "./patmentHistoryTable";
import { getPaymentActorName, resolvePaymentActorName } from "./paymentHistoryActor";
import FinanceHistoryDetailPopup from "./FinanceHistoryDetailPopup";
import {
  getPaymentMethodLabel,
  getPaymentSourceTitle,
  getViewerOperationType,
  isOrderLinkedSource,
} from "./paymentSourceType";
import { formatSignedMoneyLocalized } from "../../../shared/lib/formatMoney";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { cx } from "../../../shared/lib/cx";
import { scrollShellContentToTop } from "../../../shared/lib/usePagination";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Pagination,
  SkeletonList,
} from "../../../shared/ui/primitives";

/**
 * KASSA OPERATSIYALARI RO'YXATI — dizayn v2 (maket `*-payments-cash-detail-*`, «Operatsiyalar tarixi»
 * kartasidagi `.el-list`).
 *
 * Qator: yo'nalish ikonkasi (kirim `ArrowDownLeft`, chiqim `ArrowUpRight`, neytral quti), sarlavha — manba
 * («Sotuv · №10237», buyurtma bo'yicha manbada raqam bilan), ostida «{yaratgan} · {to'lov turi}», qo'shimcha
 * qator — filial tarixida kuryer to'lovi uchun «Kuryer: {ism}» (`showSourceUser`), aks holda izoh; o'ngda ishorali
 * summa (rang + ishora birga) va sana. Bosilsa — `FinanceHistoryDetailPopup`.
 *
 * Yo'nalish ko'ruvchiga bog'liq (`getViewerOperationType`, ega qarori D2): marketning o'z kassasida
 * `market_payment` — chiqim; boshqa rollarda qatorning `operation_type` i.
 *
 * `pageSize` dan ko'p qator bo'lsa — mijoz tomonida sahifalash (`Pagination`).
 * `withContainer` (sukut) — o'z kartasi bilan; `false` — ota karta ichida (cash-detail).
 */

const ROLLBACK_TOKEN = "[ROLLBACK]";

const normalize = (value?: string | null) => (value ?? "").trim().toLowerCase();

/** Buyurtma orqaga qaytarilganda order-service izoh boshiga `[ROLLBACK]` qo'yadi. */
const splitRollback = (comment?: string | null) => {
  const text = comment ?? "";
  if (!text.includes(ROLLBACK_TOKEN)) return { isRollback: false, text: text.trim() };
  return { isRollback: true, text: text.replaceAll(ROLLBACK_TOKEN, "").trim() };
};

const toAmount = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Qator yo'nalishi: ko'ruvchi nuqtai nazaridan, noma'lum bo'lsa — summa ishorasi. */
const getHistoryRowDirection = (row: PaymentRow, viewerRole?: string | null) =>
  getViewerOperationType(row, viewerRole) ?? (toAmount(row.amount) < 0 ? "expense" : "income");

/** Ko'ruvchi nuqtai nazaridan ishorali summa (kirim +, chiqim −). */
const getHistoryRowSignedAmount = (row: PaymentRow, viewerRole?: string | null) => {
  const amount = Math.abs(toAmount(row.amount));
  return getHistoryRowDirection(row, viewerRole) === "income" ? amount : -amount;
};

/** Qator sarlavhasi: «Sotuv · №10237» (buyurtma bo'yicha manba) yoki manba nomi. */
const getHistoryRowTitle = (row: PaymentRow, t: Translate, viewerRole?: string | null) => {
  const title = getPaymentSourceTitle(row.source_type, t, {
    role: viewerRole,
    cashboxType: row.cashbox_type ?? row.cashbox?.cashbox_type,
  });
  const sourceId = String(row.source_id ?? "").trim();
  return isOrderLinkedSource(row.source_type) && sourceId
    ? t("v2CashDetail.list.orderTitle", { title, id: sourceId })
    : title;
};

const getHistoryRowDate = (row: PaymentRow) => row.payment_date || row.createdAt || row.created_at || "";

/**
 * Qator ko'rinishi yordamchilari — cash-detail «Balans harakati» (grafik/jadval) ro'yxat bilan aynan bir xil
 * sarlavha, yo'nalish va ishorani ko'rsatishi uchun.
 */
// eslint-disable-next-line react-refresh/only-export-components -- ro'yxat bilan bir manba (alohida modul cash-detail egaligida yo'q)
export const historyRowView = {
  direction: getHistoryRowDirection,
  signedAmount: getHistoryRowSignedAmount,
  title: getHistoryRowTitle,
  date: getHistoryRowDate,
} as const;

const HistoryRow = memo(
  ({
    row,
    viewerRole,
    showSourceUser,
    onOpen,
  }: {
    row: PaymentRow;
    viewerRole?: string | null;
    showSourceUser: boolean;
    onOpen: (row: PaymentRow) => void;
  }) => {
    const { t } = useTranslation("payments");
    const isIncome = getHistoryRowDirection(row, viewerRole) === "income";
    const signedAmount = formatSignedMoneyLocalized(getHistoryRowSignedAmount(row, viewerRole));
    const title = getHistoryRowTitle(row, t, viewerRole);
    const actor = resolvePaymentActorName(row);
    const method = row.payment_method ? getPaymentMethodLabel(row.payment_method, t) : "";
    const subtitle = [actor !== "-" ? actor : "", method !== "—" ? method : ""].filter(Boolean).join(" · ");
    const sourceUserName =
      showSourceUser && normalize(row.source_type) === "courier_payment"
        ? getPaymentActorName(row.source_user ?? row.sourceUser)
        : "";
    const comment = splitRollback(row.comment);
    const extra = sourceUserName ? t("v2CashDetail.list.courier", { name: sourceUserName }) : comment.text;
    const date = formatDateTimeLocalized(getHistoryRowDate(row));
    const Icon = isIncome ? ArrowDownLeft : ArrowUpRight;

    return (
      <li>
        <button
          type="button"
          onClick={() => onOpen(row)}
          aria-label={t("v2CashDetail.list.rowLabel", {
            title,
            direction: t(isIncome ? "v2Common.income" : "v2Common.expense"),
            amount: signedAmount,
            date,
          })}
          className={cx(
            "flex w-full min-h-14 items-start gap-3 px-5 py-3 text-left text-sm max-md:px-4",
            "transition-[background-color] duration-150 hover:bg-row-hover motion-reduce:transition-none",
          )}
        >
          <span
            aria-hidden="true"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted"
          >
            <Icon size={18} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-semibold [overflow-wrap:anywhere] text-text">{title}</span>
            {subtitle ? <span className="text-[13px] text-text-muted">{subtitle}</span> : null}
            {extra ? (
              <span className="mt-0.5 text-xs whitespace-pre-line [overflow-wrap:anywhere] text-text-muted">{extra}</span>
            ) : null}
            {comment.isRollback ? (
              <span className="mt-1">
                <Badge size="sm">{t("v2CashDetail.list.rollback")}</Badge>
              </span>
            ) : null}
          </span>
          <span className="flex shrink-0 flex-col items-end gap-0.5">
            <span className={cx("whitespace-nowrap font-semibold", isIncome ? "text-success-fg" : "text-danger-fg")}>
              {signedAmount}
            </span>
            <span className="whitespace-nowrap text-[13px] text-text-muted">{date}</span>
          </span>
        </button>
      </li>
    );
  },
);

export interface PaymentHistoryListProps {
  data?: PaymentRow[];
  isLoading?: boolean;
  /** Sukut `true` — o'z kartasi bilan; `false` — ota karta ichida. */
  withContainer?: boolean;
  /** Bo'sh ro'yxat sarlavhasi (sukut «Operatsiyalar topilmadi»). */
  emptyText?: string;
  /** Filial tarixi: kuryer to'lovlarida «Kuryer: {ism}» qatori (maket `*-payments-cash-detail-branch`). */
  showSourceUser?: boolean;
  /** Sahifadagi qatorlar soni (sukut 10); ko'p bo'lsa — mijoz tomonida sahifalash. */
  pageSize?: number;
  /** So'rov xatosi — `ErrorState` (+ «Qayta urinish», `onRetry` berilsa). */
  error?: unknown;
  onRetry?: () => void;
}

const PaymentHistoryList = ({
  data,
  isLoading = false,
  withContainer = true,
  emptyText,
  showSourceUser = false,
  pageSize = 10,
  error,
  onRetry,
}: PaymentHistoryListProps) => {
  const { t } = useTranslation("payments");
  const viewerRole = useSelector((state: RootState) => state.role.role);
  const [selectedRow, setSelectedRow] = useState<PaymentRow | null>(null);
  const [page, setPage] = useState(1);
  // Sahifa almashganda ro'yxat boshi ko'rinsin (D-03; kassa tafsilotida tarix forma va balans harakati ostida).
  const listRef = useRef<HTMLUListElement>(null);
  const handlePageChange = (next: number) => {
    setPage(next);
    scrollShellContentToTop(listRef.current);
  };
  const rows = data ?? [];
  // Ro'yxat almashsa (filtr, tab, to'lovdan keyin yangilanish) — 1-sahifa (effektsiz, render paytida).
  const [seenRows, setSeenRows] = useState(rows);
  if (seenRows !== rows && data !== undefined) {
    setSeenRows(rows);
    setPage(1);
  }

  const size = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * size, currentPage * size);

  const body = isLoading ? (
    <div className="px-5 py-4 max-md:px-4">
      <SkeletonList rows={5} />
    </div>
  ) : error ? (
    <ErrorState size="card" error={error} onRetry={onRetry} />
  ) : rows.length === 0 ? (
    <EmptyState size="card" icon={ReceiptText} title={emptyText ?? t("v2CashDetail.history.empty")} />
  ) : (
    <ul ref={listRef} className="m-0 flex list-none flex-col divide-y divide-border p-0">
      {pageRows.map((row) => (
        <HistoryRow
          key={row.id}
          row={row}
          viewerRole={viewerRole}
          showSourceUser={showSourceUser}
          onOpen={setSelectedRow}
        />
      ))}
    </ul>
  );

  const pagination =
    !isLoading && !error && rows.length > size ? (
      <Pagination
        page={currentPage}
        pageSize={size}
        total={rows.length}
        onPageChange={handlePageChange}
        summary={(range) => t("v2Common.paginationOperations", range)}
      />
    ) : null;

  const detail = <FinanceHistoryDetailPopup row={selectedRow} onClose={() => setSelectedRow(null)} />;

  if (withContainer) {
    return (
      <>
        <Card padding="none" footer={pagination ?? undefined}>
          {body}
        </Card>
        {detail}
      </>
    );
  }

  return (
    <>
      {body}
      {pagination ? <div className="border-t border-border px-5 py-3 max-md:px-4">{pagination}</div> : null}
      {detail}
    </>
  );
};

export default memo(PaymentHistoryList);
