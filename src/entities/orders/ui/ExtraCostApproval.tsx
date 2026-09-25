import { memo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Clock3 } from "lucide-react";
import {
  clearPendingExtraCostApproval,
  getActivePendingApproval,
  usePendingExtraCostApprovals,
  type PendingExtraCostApproval,
} from "../extraCostApproval";

const resolveLocale = (language: string) =>
  language === "ru" ? "ru-RU" : language === "en" ? "en-US" : "uz-UZ";

const useApprovalFormatters = () => {
  const { t, i18n } = useTranslation("orders");
  const locale = resolveLocale(i18n.language);
  const formatAmount = (amount: number) => `${amount.toLocaleString(locale)} ${t("currency")}`;
  const formatTime = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
    const sameDay = date.toDateString() === new Date().toDateString();
    return date.toLocaleString(locale, {
      ...(sameDay ? {} : { day: "2-digit", month: "2-digit" }),
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  return { t, formatAmount, formatTime };
};

export const ExtraCostApprovalNotice = memo(() => {
  const { t } = useTranslation("orders");
  return (
    <p className="mt-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
      {t("extraCostApprovalNotice")}
    </p>
  );
});
ExtraCostApprovalNotice.displayName = "ExtraCostApprovalNotice";

export const ExtraCostApprovalPendingBanner = memo(({ amount }: { amount: number }) => {
  const { t, formatAmount } = useApprovalFormatters();
  return (
    <div
      role="status"
      className="rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 dark:border-amber-400/30 dark:bg-amber-400/10"
    >
      <p className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-100">
        <Clock3 size={16} className="shrink-0" />
        {t("extraCostApprovalPendingTitle")}
      </p>
      <p className="mt-1 text-xs font-medium text-amber-800/90 dark:text-amber-100/85">
        {t("extraCostApprovalPendingDescription", { amount: formatAmount(amount) })}
      </p>
    </div>
  );
});
ExtraCostApprovalPendingBanner.displayName = "ExtraCostApprovalPendingBanner";

export const ExtraCostApprovalSentNote = memo(({ approval }: { approval: PendingExtraCostApproval }) => {
  const { t, formatAmount, formatTime } = useApprovalFormatters();
  return (
    <p className="flex items-start gap-2 rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
      <Clock3 size={14} className="mt-0.5 shrink-0" />
      {t("extraCostApprovalSentAt", {
        amount: formatAmount(approval.amount),
        time: formatTime(approval.requestedAt),
      })}
    </p>
  );
});
ExtraCostApprovalSentNote.displayName = "ExtraCostApprovalSentNote";

/**
 * Ro'yxatdagi belgi. Buyurtma holati so'rov yuborilgandagidan o'zgargan bo'lsa
 * (market tasdiqlab, amal bajarilgan) yozuv o'chiriladi va belgi ko'rinmaydi.
 */
export const ExtraCostApprovalBadge = memo(({ orderId, status }: { orderId: string; status: string }) => {
  const approvals = usePendingExtraCostApprovals();
  const stored = approvals[orderId];
  const active = getActivePendingApproval(approvals, { id: orderId, status });
  const { t, formatAmount, formatTime } = useApprovalFormatters();

  useEffect(() => {
    if (stored && !active) clearPendingExtraCostApproval(orderId);
  }, [active, orderId, stored]);

  if (!active) return null;

  const title = t("extraCostApprovalSentAt", {
    amount: formatAmount(active.amount),
    time: formatTime(active.requestedAt),
  });

  return (
    <span
      title={title}
      aria-label={title}
      className="inline-flex items-center gap-1 rounded-full border border-amber-300/70 bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-400/35 dark:bg-amber-400/12 dark:text-amber-100"
    >
      <Clock3 size={11} className="shrink-0" />
      {t("extraCostApprovalBadge")}
    </span>
  );
});
ExtraCostApprovalBadge.displayName = "ExtraCostApprovalBadge";
