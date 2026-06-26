import { useEffect, useMemo, useState } from "react";
import { message } from "antd";
import { Banknote, CreditCard, History, WalletCards, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFinanceCoverage } from "../../../entities/payments/financeCoverage";
import Popup from "../../../shared/ui/Popup";

type Employee = {
  id: string;
  name?: string;
  role?: string;
  salary?: number | string | null;
};

type SalaryPaymentPopupProps = {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
};

const toNumber = (value: unknown) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
};

const formatAmount = (value: number) =>
  value.toLocaleString("uz-UZ", { maximumFractionDigits: 0 });

const toHistoryItems = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const data = record.data;
  if (Array.isArray(record.items)) return record.items as Record<string, unknown>[];
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const nestedData = data as Record<string, unknown>;
    if (Array.isArray(nestedData.items)) return nestedData.items as Record<string, unknown>[];
  }

  return [];
};

const getHistoryDate = (item: Record<string, unknown>) =>
  String(item.payment_date ?? item.createdAt ?? item.created_at ?? "");

const SalaryPaymentPopup = ({
  employee,
  isOpen,
  onClose,
}: SalaryPaymentPopupProps) => {
  const { t } = useTranslation("payments");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const { createSalary, useGetSalaryByUser } = useFinanceCoverage();
  const { data: salaryResponse, isLoading: isHistoryLoading } = useGetSalaryByUser(
    employee?.id ?? "",
    isOpen && Boolean(employee?.id),
  );

  useEffect(() => {
    if (!isOpen) return;
    setAmount(formatAmount(toNumber(employee?.salary)));
    setComment("");
    setPaymentMethod("cash");
  }, [employee?.id, employee?.salary, isOpen]);

  const historyItems = useMemo(
    () => toHistoryItems(salaryResponse),
    [salaryResponse],
  );
  const paidAmount = useMemo(
    () => historyItems.reduce((total, item) => total + Math.abs(toNumber(item.amount)), 0),
    [historyItems],
  );
  const monthlySalary = toNumber(employee?.salary);
  const unpaidAmount = Math.max(monthlySalary - paidAmount, 0);
  const parsedAmount = Number(amount.replace(/[^0-9]/g, ""));
  const isValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;

  const handleAmountChange = (value: string) => {
    const digits = value.replace(/[^0-9]/g, "");
    setAmount(digits ? formatAmount(Number(digits)) : "");
  };

  const handleSubmit = () => {
    if (!employee || !isValidAmount) return;

    createSalary.mutate(
      {
        user_id: employee.id,
        amount: parsedAmount,
        type: paymentMethod === "card" ? "click" : "cash",
        comment: comment.trim() || undefined,
      },
      {
        onSuccess: () => {
          message.success(t("salaryPaymentSuccess"));
          onClose();
        },
        onError: () => message.error(t("salaryPaymentError")),
      },
    );
  };

  if (!isOpen || !employee) return null;

  return (
    <Popup isShow={isOpen} onClose={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t("paySalary")}
        className="w-[min(94vw,580px)] overflow-hidden rounded-2xl border border-main/25 bg-primary text-maindark shadow-2xl dark:border-white/10 dark:bg-primarydark dark:text-primary"
      >
        <header className="flex items-center gap-3 bg-main px-5 py-4 text-white">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
            <WalletCards size={21} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold">{employee.name || t("userFallback")}</h2>
            <p className="text-sm text-white/75">{t("paySalary")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("cancelShort")}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 transition hover:bg-white/25"
          >
            <X size={21} />
          </button>
        </header>

        <div className="max-h-[calc(90vh-72px)] space-y-5 overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 p-3.5">
              <p className="text-xs font-medium text-rose-500">{t("salaryUnpaidBalance")}</p>
              <p className="mt-1 text-lg font-bold text-rose-500">{formatAmount(unpaidAmount)} {t("currency")}</p>
            </div>
            <div className="rounded-xl border border-main/20 bg-main/8 p-3.5">
              <p className="text-xs font-medium text-[color:var(--color-text-muted)] dark:text-white/60">{t("monthlySalary")}</p>
              <p className="mt-1 text-lg font-bold">{formatAmount(monthlySalary)} {t("currency")}</p>
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">{t("amount")}</span>
            <input
              value={amount}
              onChange={(event) => handleAmountChange(event.target.value)}
              inputMode="numeric"
              placeholder="0"
              className="h-12 w-full rounded-xl border border-main/20 bg-main/8 px-4 text-base font-semibold outline-none transition placeholder:text-[color:var(--color-text-muted)] focus:border-main focus:ring-2 focus:ring-main/20 dark:border-white/10 dark:bg-white/8"
            />
          </label>

          <div>
            <p className="mb-2 text-sm font-medium">{t("paymentMethod")}</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod("cash");
                }}
                className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition ${paymentMethod === "cash" ? "border-main bg-main text-white" : "border-main/20 bg-main/5 hover:border-main/45 dark:border-white/10 dark:bg-white/5"}`}
              >
                <Banknote size={17} /> {t("cash")}
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("card")}
                className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition ${paymentMethod === "card" ? "border-main bg-main text-white" : "border-main/20 bg-main/5 hover:border-main/45 dark:border-white/10 dark:bg-white/5"}`}
              >
                <CreditCard size={17} /> {t("card")}
              </button>
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">{t("optionalComment")}</span>
            <input
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={t("commentPlaceholder")}
              className="h-11 w-full rounded-xl border border-main/20 bg-main/8 px-4 text-sm outline-none transition placeholder:text-[color:var(--color-text-muted)] focus:border-main focus:ring-2 focus:ring-main/20 dark:border-white/10 dark:bg-white/8"
            />
          </label>

          <button
            type="button"
            disabled={!isValidAmount || createSalary.isPending}
            onClick={handleSubmit}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-main px-4 font-semibold text-white transition hover:bg-main/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <WalletCards size={18} />
            {createSalary.isPending ? t("loadingLabel") : t("paySalary")}
          </button>

          <div className="overflow-hidden rounded-xl border border-main/12 dark:border-white/10">
            <div className="flex items-center gap-2 border-b border-main/12 px-4 py-3 dark:border-white/10">
              <History size={17} className="text-main" />
              <p className="text-sm font-bold">{t("paymentHistory")}</p>
              <span className="ml-auto text-xs text-[color:var(--color-text-muted)] dark:text-white/55">{t("salaryPaidTotal", { amount: formatAmount(paidAmount) })}</span>
            </div>
            <div className="max-h-52 divide-y divide-main/10 overflow-y-auto dark:divide-white/10">
              {isHistoryLoading ? (
                <p className="px-4 py-5 text-sm text-[color:var(--color-text-muted)] dark:text-white/60">{t("loadingLabel")}</p>
              ) : historyItems.length === 0 ? (
                <p className="px-4 py-5 text-sm text-[color:var(--color-text-muted)] dark:text-white/60">{t("salaryHistoryEmpty")}</p>
              ) : historyItems.map((item, index) => {
                const historyAmount = Math.abs(toNumber(item.amount));
                const rawDate = getHistoryDate(item);
                const formattedDate = rawDate ? new Date(rawDate).toLocaleString("uz-UZ") : "";
                return (
                  <div key={String(item.id ?? index)} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-main/10 text-main">
                      <WalletCards size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{t("monthlySalary")}</p>
                      <p className="truncate text-xs text-[color:var(--color-text-muted)] dark:text-white/55">{formattedDate || String(item.comment ?? "")}</p>
                    </div>
                    <p className="text-sm font-bold text-rose-500">-{formatAmount(historyAmount)} {t("currency")}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </Popup>
  );
};

export default SalaryPaymentPopup;
