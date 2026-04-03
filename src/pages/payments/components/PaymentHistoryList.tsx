import { memo, useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import type { Pagination, PaymentRow } from "./patmentHistoryTable";
import { useTranslation } from "react-i18next";

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

const labelCashboxType = (v?: string) => {
  if (!v) return "";
  if (v === "cash") return "Naqd";
  if (v === "card") return "Click";
  if (v === "transfer") return "Transfer";
  return v;
};

const labelOperation = (v?: string) => {
  if (!v) return "";
  if (v === "income") return "Kirim";
  if (v === "expense") return "Chiqim";
  return v;
};

const extractRollback = (comment: string) => {
  const token = "[ROLLBACK]";
  if (!comment) return { isRollback: false, text: "" };
  if (!comment.includes(token)) return { isRollback: false, text: comment.trim() };
  const text = comment.replaceAll(token, "").trim();
  return { isRollback: true, text };
};

const Badge = memo(({ text, tone }: { text: string; tone: "neutral" | "green" | "red" }) => {
  const cls =
    tone === "green"
      ? "bg-emerald-500/15 text-emerald-400"
      : tone === "red"
        ? "bg-rose-500/15 text-rose-400"
        : "bg-white/10 text-white/70";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold whitespace-nowrap ${cls}`}>
      {text}
    </span>
  );
});

const RollbackBadge = memo(() => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold whitespace-nowrap bg-violet-500/15 text-violet-300">
    Rollback
  </span>
));

const HistoryRow = memo(({ row }: { row: PaymentRow }) => {
  const op = row.operation_type;
  const isIncome = op === "income";
  const sign = isIncome ? "+" : "-";
  const amount = Number(row.amount ?? 0);
  const created = row.created_by || "-";
  const commentInfo = extractRollback(row.comment || "");
  const cashboxType = row.cashbox_type || row.cashbox?.cashbox_type || row.payment_method || "";
  const sourceType = row.source_type || "";
  const dateStr = (row.payment_date || row.createdAt || row.created_at || "") as string;

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
            isIncome
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
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {commentInfo.isRollback && <RollbackBadge />}
            {sourceType && (
              <span className="text-[11px] text-gray-600 dark:text-white/55 truncate max-w-80">
                {sourceType}
              </span>
            )}
            {cashboxType && <Badge text={labelCashboxType(cashboxType) || cashboxType} tone="neutral" />}
            {op && <Badge text={labelOperation(op) || op} tone={isIncome ? "green" : "red"} />}
          </div>
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className={`text-[13px] font-black tabular-nums m-0 ${isIncome ? "text-emerald-300" : "text-rose-300"}`}>
          {sign}
          {fmt(Math.abs(amount))} so&apos;m
        </p>
        <p className="text-[11px] text-gray-500 dark:text-white/35 flex items-center gap-1.5 justify-end mt-1 m-0">
          <Calendar size={12} className="shrink-0" />
          {formatDate(dateStr)}
        </p>
      </div>
    </div>
  );
});

export interface PaymentHistoryListProps {
  data?: PaymentRow[];
  isLoading?: boolean;
  pagination?: Pagination;
  onPageChange?: (page: number) => void;
  currentPage?: number;
  withContainer?: boolean;
}

const PaymentHistoryList = ({
  data = [],
  isLoading = false,
  pagination,
  onPageChange,
  currentPage,
  withContainer = true,
}: PaymentHistoryListProps) => {
  const { t } = useTranslation("payments");
  const activePage = pagination?.page ?? currentPage ?? 1;
  const hasPagination = pagination && pagination.totalPages > 1;

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
        <div className="bg-primary dark:bg-primarydark rounded-2xl border border-gray-200 dark:border-glass-border shadow-sm overflow-hidden">
          {Skeleton}
        </div>
      ) : (
        Skeleton
      )
    );
  }

  const Body = (
    <>
      <div className="divide-y divide-gray-100 dark:divide-white/10">
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-500 dark:text-white/50">
            {t("paymentHistoryNotFound")}
          </div>
        ) : (
          rows.map((row) => <HistoryRow key={row.id} row={row} />)
        )}
      </div>

      {hasPagination && onPageChange && (
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 dark:border-glass-border">
          <span className="text-xs text-gray-500 dark:text-white/40">
            {t("pageLabel", { page: activePage, totalPages: pagination.totalPages })}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(activePage - 1)}
              disabled={activePage <= 1}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50 hover:bg-main/10 hover:text-main disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label={t("previousPage")}
            >
              <ChevronLeft size={16} />
            </button>

            <button
              onClick={() => onPageChange(activePage + 1)}
              disabled={activePage >= pagination.totalPages}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50 hover:bg-main/10 hover:text-main disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label={t("nextPage")}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );

  return withContainer ? (
    <div className="bg-primary dark:bg-primarydark rounded-2xl border border-gray-200 dark:border-glass-border shadow-sm overflow-hidden">
      {Body}
    </div>
  ) : (
    Body
  );
};

export default memo(PaymentHistoryList);
