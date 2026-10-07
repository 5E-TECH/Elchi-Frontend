import { memo, useId, type ReactNode } from "react";
import { ExternalLink, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Popup from "../../../shared/ui/Popup";
import { formatFinancialAmount } from "../lib/financialBalance";
import { orderLink, toSourceTypeLabel, type HistoryRow } from "../lib/historyRow";

const formatDateTime = (value: unknown) => {
  const date = new Date(typeof value === "number" ? value : String(value ?? ""));
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-0.5 rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/5">
    <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-white/45">{label}</dt>
    <dd className="m-0 break-words text-sm font-medium text-maindark dark:text-white">{children}</dd>
  </div>
);

/**
 * Daftar qatorining TO'LIQ tafsiloti (4WeT0Tv5): jadvalda qisqartirilgan izoh
 * to'liq matnda, kim kiritgani va buyurtmaga havola.
 */
const FinancialHistoryDetail = ({ row, onClose }: { row: HistoryRow | null; onClose: () => void }) => {
  const { t } = useTranslation("payments");
  const titleId = useId();
  const currency = t("currency");
  const money = (value: number) => `${value < 0 ? "-" : ""}${formatFinancialAmount(Math.abs(value))} ${currency}`;

  return (
    <Popup isShow={Boolean(row)} onClose={onClose} labelledBy={titleId}>
      {row && (
        <div className="flex max-h-[90vh] w-[calc(100vw-32px)] max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl bg-primary p-5 shadow-xl dark:bg-maindark">
          <div className="flex items-start justify-between gap-3">
            <h3 id={titleId} className="text-base font-bold text-maindark dark:text-white">
              {toSourceTypeLabel(row.sourceType, t)}
              <span className="ml-2 text-sm font-semibold text-gray-400">#{row.id}</span>
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("close", { ns: "common" })}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-400 hover:text-main"
            >
              <X size={18} />
            </button>
          </div>

          <dl className="m-0 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label={t("financialBalanceDate")}>{formatDateTime(row.date)}</Field>
            <Field label={t("financialBalanceChange")}>
              <span className={row.changeAmount < 0 ? "text-rose-500" : "text-emerald-500"}>
                {row.changeAmount >= 0 ? "+" : ""}
                {money(row.changeAmount)}
              </span>
            </Field>
            <Field label={t("financialBalancePreviousBalance")}>{money(row.previousBalance)}</Field>
            <Field label={t("financialBalanceNextBalance")}>{money(row.nextBalance)}</Field>
            <Field label={t("financialBalanceCreatedBy")}>
              {row.automatic ? t("financialBalanceAutomatic") : row.actorName || "—"}
            </Field>
            <Field label={t("financialBalanceOrder")}>
              {row.orderId ? (
                <Link
                  to={orderLink(row.orderId)}
                  onClick={onClose}
                  className="inline-flex items-center gap-1 font-semibold text-main hover:underline"
                >
                  {t("financialBalanceOrderLink", { id: row.orderId })}
                  <ExternalLink size={14} />
                </Link>
              ) : (
                "—"
              )}
            </Field>
          </dl>

          <Field label={t("financialBalanceComment")}>
            <span className="whitespace-pre-wrap">{row.comment || "—"}</span>
          </Field>
        </div>
      )}
    </Popup>
  );
};

export default memo(FinancialHistoryDetail);
