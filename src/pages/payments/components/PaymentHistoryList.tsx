import { memo, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Calendar } from "lucide-react";
import type { PaymentRow } from "./patmentHistoryTable";
import { resolvePaymentActorName } from "./paymentHistoryActor";
import { useTranslation } from "react-i18next";
import FinanceHistoryDetailPopup from "./FinanceHistoryDetailPopup";
import { getPaymentSourceTypeLabel } from "./paymentSourceType";
import { Badge } from "../../../shared/ui/primitives";
import { PaymentAckBadge } from "./PaymentAckBadge";

const fmt = (n: number) => n.toLocaleString("uz-UZ");

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  } catch {
    return dateStr;
  }
};

const labelCashboxType = (v?: string, t?: (key: string) => string) => {
  if (!v) return "";
  if (v === "cash") return t ? t("cash") : v;
  if (v === "card") return t ? t("clickPayment") : v;
  if (v === "transfer") return t ? t("transferOption") : v;
  if (v === "click_to_market") return t ? t("toMarketTransferOption") : v;
  return v;
};

const labelOperation = (v?: string, t?: (key: string) => string) => {
  if (!v) return "";
  if (v === "income") return t ? t("income") : v;
  if (v === "expense") return t ? t("expense") : v;
  return v;
};

const extractRollback = (comment: string) => {
  const token = "[ROLLBACK]";
  if (!comment) return { isRollback: false, text: "" };
  if (!comment.includes(token)) return { isRollback: false, text: comment.trim() };
  const text = comment.replaceAll(token, "").trim();
  return { isRollback: true, text };
};

/**
 * Qator belgilari guruhi (dizayn v2, 2crjWf7v): «Tuzatish» (`[ROLLBACK]` yozuvi), kuryer kvitansiyasi
 * javobi, manba turi, to'lov turi, «Kirim/Chiqim». Maket: `courier-cashbox-my-all` / `courier-cashbox-my-transfers`
 * — `.el-badge.el-tone-neutral` (to'lov turi, «Kirim»/«Chiqim»: ikonka katalogi — «badge neytral, rangni summa
 * oladi»), tuzatish — `.el-badge-outline` «Tuzatish».
 * Maketdan farq: «Kirim»/«Chiqim» badge'ida ↙/↗ ikonkasi yo'q — qatorning chap ikonkasi va sahifadagi
 * Kirim/Chiqim kartalari hali v1 (Kirim ↗, Chiqim ↘); bitta ekranda qarama-qarshi strelkalar bo'lmasin,
 * ma'noni matn beradi. Qatorning qolgan qismi hali v1 (umumiy widget: `/payments/main-cashbox`,
 * `/payments/cash-detail/:id`, `/cash-box`).
 */
const HistoryRowBadges = memo(
  ({
    isRollback,
    paymentAck,
    sourceType,
    cashboxType,
    operationType,
  }: {
    isRollback: boolean;
    paymentAck?: PaymentRow["payment_ack"];
    sourceType: string;
    cashboxType: string;
    operationType?: string;
  }) => {
    const { t } = useTranslation("payments");

    return (
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {isRollback && <Badge variant="outline">{t("historyCorrectionBadge")}</Badge>}
        <PaymentAckBadge ack={paymentAck} />
        {sourceType && (
          <span className="max-w-80 truncate text-xs text-text-muted">
            {getPaymentSourceTypeLabel(sourceType, t)}
          </span>
        )}
        {cashboxType && <Badge>{labelCashboxType(cashboxType, t) || cashboxType}</Badge>}
        {operationType && (
          <Badge>{labelOperation(operationType, t) || operationType}</Badge>
        )}
      </div>
    );
  },
);

const HistoryRow = memo(
  ({ row, onClick }: { row: PaymentRow; onClick: (row: PaymentRow) => void }) => {
  const { t } = useTranslation("payments");
  const op = row.operation_type;
  const isIncome = op === "income";
  const sign = isIncome ? "+" : "-";
  const amount = Number(row.amount ?? 0);
  const created = resolvePaymentActorName(row);
  const commentInfo = extractRollback(row.comment || "");
  const cashboxType = row.payment_method || row.cashbox_type || row.cashbox?.cashbox_type || "";
  const sourceType = row.source_type || "";
  const dateStr = (row.payment_date || row.createdAt || row.created_at || "") as string;

  return (
    <button
      type="button"
      onClick={() => onClick(row)}
      className="flex w-full flex-col items-stretch gap-3 px-3 py-3 text-left transition-colors hover:bg-gray-50/60 dark:hover:bg-white/3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${isIncome
            ? "bg-linear-to-br from-emerald-500/20 to-emerald-500/10 text-emerald-300"
            : "bg-linear-to-br from-rose-500/20 to-rose-500/10 text-rose-300"
            }`}
        >
          {isIncome ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
        </div>

        <div className="min-w-0">
          <p className="text-[13px] font-bold text-gray-900 dark:text-white/90 truncate m-0">
            {created}
          </p>
          <HistoryRowBadges
            isRollback={commentInfo.isRollback}
            paymentAck={row.payment_ack}
            sourceType={sourceType}
            cashboxType={cashboxType}
            operationType={op}
          />
          {commentInfo.text && (
            <p className="mt-1 text-[11px] leading-5 text-gray-500 dark:text-white/45 whitespace-pre-line">
              {commentInfo.text}
            </p>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-100 pt-2 text-left dark:border-white/10 sm:border-0 sm:pt-0 sm:text-right">
        <p className={`text-[13px] font-black tabular-nums m-0 ${isIncome ? "text-emerald-300" : "text-rose-300"}`}>
          {sign}
          {fmt(Math.abs(amount))} {t("currencyAmountSuffix")}
        </p>
        {typeof row.balance_after === "number" && (
          <p className="mt-1 text-[11px] text-gray-500 dark:text-white/45">
            {t("balance")}: {fmt(row.balance_after)} {t("currencyAmountSuffix")}
          </p>
        )}
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-white/35 sm:justify-end">
          <Calendar size={12} className="shrink-0" />
          {formatDate(dateStr)}
        </p>
      </div>
    </button>
    );
  },
);

export interface PaymentHistoryListProps {
  data?: PaymentRow[];
  isLoading?: boolean;
  withContainer?: boolean;
}

const PaymentHistoryList = ({
  data = [],
  isLoading = false,
  withContainer = true,
}: PaymentHistoryListProps) => {
  const { t } = useTranslation("payments");
  const [selectedRow, setSelectedRow] = useState<PaymentRow | null>(null);

  const rows = useMemo(() => data ?? [], [data]);

  if (isLoading) {
    const Skeleton = (
      <>
        <div className="px-5 py-4">
          <div className="h-4 w-40 rounded bg-gray-200/40 dark:bg-white/10 animate-pulse" />
          <div className="mt-2 h-3 w-28 rounded bg-gray-200/30 dark:bg-white/5 animate-pulse" />
        </div>
        <div className="divide-y divide-gray-100 dark:divide-white/10">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-5 py-4">
              <div className="h-3 w-56 rounded bg-gray-200/30 dark:bg-white/5 animate-pulse" />
              <div className="mt-2 h-3 w-40 rounded bg-gray-200/20 dark:bg-white/5 animate-pulse" />
            </div>
          ))}
        </div>
      </>
    );
    return (
      withContainer ? (
        <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-glass-border shadow-sm overflow-hidden">
          {Skeleton}
        </div>
      ) : (
        Skeleton
      )
    );
  }

  const Body = (
    <>
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto max-h-[24rem] sm:max-h-[28rem] lg:max-h-[32rem]">
        <div className="divide-y divide-gray-100 dark:divide-white/10">
        {rows.length === 0 ? (
          <div className="px-5 py-6 text-center text-sm text-gray-500 dark:text-white/50">
            {t("paymentHistoryNotFound")}
          </div>
        ) : (
          rows.map((row) => (
            <HistoryRow
              key={row.id}
              row={row}
              onClick={setSelectedRow}
            />
          ))
        )}
        </div>
      </div>

      <FinanceHistoryDetailPopup
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
      />
    </>
  );

  return withContainer ? (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-primary shadow-sm dark:border-glass-border dark:bg-maindark">
      {Body}
    </div>
  ) : (
    Body
  );
};

export default memo(PaymentHistoryList);
