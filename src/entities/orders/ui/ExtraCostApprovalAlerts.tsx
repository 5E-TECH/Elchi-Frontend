// dizayn-v2: courier-orders-cancel-dialog, courier-orders-action-approval-pending
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { isExtraCostAction, type ExtraCostAction, type PendingExtraCostApproval } from "../extraCostApproval";

/**
 * Qo'shimcha xarajat tasdig'i — v2 ogohlantirishlari (`.el-alert.el-tone-warning`).
 *
 * `ExtraCostApproval.tsx` dagi v1 komponentlar boshqa oynalarda (Sotish,
 * buyurtma tafsiloti) hamon ishlatiladi — ular tegilmaydi; v2 ga o'tgan
 * oynalar shu faylni oladi. Matnlar o'sha kalitlardan.
 */

const ACTION_LABEL_KEYS: Record<ExtraCostAction, string> = {
  sell: "extraCostApprovalActionSell",
  partly_sell: "extraCostApprovalActionPartlySell",
  cancel: "extraCostApprovalActionCancel",
};

const ALERT = "flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2.5 text-[13px] text-warning-fg";

/** Xarajat yozilganda: market tasdig'idan o'tishi haqida oldindan ogohlantirish. */
export const ExtraCostNoticeAlert = memo(({ id }: { id?: string }) => {
  const { t } = useTranslation("orders");
  return (
    <div id={id} role="status" className={ALERT}>
      <Clock className="mt-0.5 size-4 flex-none" aria-hidden="true" />
      <p className="min-w-0 text-text">{t("extraCostApprovalNotice")}</p>
    </div>
  );
});
ExtraCostNoticeAlert.displayName = "ExtraCostNoticeAlert";

/** Amal market tasdig'iga tushdi — forma o'rnida ko'rsatiladi. */
export const ExtraCostPendingAlert = memo(
  ({ amount, action }: { amount: number; action?: ExtraCostAction | null }) => {
    const { t, i18n } = useTranslation("orders");
    return (
      <div role="status" className={`${ALERT} px-4 py-3 text-sm`}>
        <Clock className="mt-0.5 size-[18px] flex-none" aria-hidden="true" />
        <div className="flex min-w-0 flex-col gap-1 text-text">
          <p className="font-bold">{t("extraCostApprovalPendingTitle")}</p>
          {action && isExtraCostAction(action) ? (
            <p className="text-[13px] font-semibold">
              {t("extraCostApprovalPendingAction", { action: t(ACTION_LABEL_KEYS[action]) })}
            </p>
          ) : null}
          <p className="text-[13px] text-text-muted">
            {t("extraCostApprovalPendingDescription", {
              amount: formatMoneyLocalized(amount, { language: i18n.language }),
            })}
          </p>
        </div>
      </div>
    );
  },
);
ExtraCostPendingAlert.displayName = "ExtraCostPendingAlert";

/** Shu buyurtma bo'yicha avval yuborilgan, hali hal qilinmagan so'rov. */
export const ExtraCostSentAlert = memo(({ approval }: { approval: PendingExtraCostApproval }) => {
  const { t, i18n } = useTranslation("orders");
  const params = {
    amount: formatMoneyLocalized(approval.amount, { language: i18n.language }),
    // "Bugun, 14:15" / "Kecha, 18:04" / "06.10.2026, 19:05" (dizayn v2 sana formati).
    time: formatDateTimeLocalized(approval.requestedAt, { language: i18n.language }),
  };
  return (
    <div className={ALERT}>
      <Clock className="mt-0.5 size-4 flex-none" aria-hidden="true" />
      <p className="min-w-0 text-text">
        {isExtraCostAction(approval.action)
          ? t("extraCostApprovalSentAtAction", { ...params, action: t(ACTION_LABEL_KEYS[approval.action]) })
          : t("extraCostApprovalSentAt", params)}
      </p>
    </div>
  );
});
ExtraCostSentAlert.displayName = "ExtraCostSentAlert";
