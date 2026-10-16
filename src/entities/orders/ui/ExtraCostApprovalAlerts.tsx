// dizayn-v2: courier-orders-sell-extra-cost-dialog, courier-orders-cancel-dialog, courier-orders-action-approval-pending, manager-orders-cancel-dialog
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

/**
 * Amal market tasdig'iga tushdi — forma o'rnida (maket `courier-orders-action-approval-pending`:
 * oyna sarlavhasi «Market tasdig'i kutilmoqda», tanada shu blok). Ogohlantirish matni + `dl`:
 * so'ralgan amal, qo'shimcha xarajat, yuborilgan vaqt (ma'lum bo'lsa).
 *
 * Oyna ochiq turganda forma shu blokka almashadi — sarlavha o'zgarishini ekran o'quvchi aytmaydi,
 * shuning uchun `role="status"` ichida sarlavha ham bor (ko'rinmas).
 */
export const ExtraCostPendingAlert = memo(
  ({
    id,
    amount,
    action,
    requestedAt,
  }: {
    id?: string;
    amount: number;
    action?: ExtraCostAction | null;
    requestedAt?: string | null;
  }) => {
    const { t, i18n } = useTranslation("orders");
    const language = i18n.language;
    const rows: Array<{ label: string; value: string }> = [
      ...(action && isExtraCostAction(action)
        ? [{ label: t("extraCostApprovalRequestedAction"), value: t(ACTION_LABEL_KEYS[action]) }]
        : []),
      { label: t("extraCost"), value: formatMoneyLocalized(amount, { language }) },
      ...(requestedAt
        ? [{ label: t("extraCostApprovalSentTime"), value: formatDateTimeLocalized(requestedAt, { language }) }]
        : []),
    ];
    return (
      <div
        id={id}
        role="status"
        className="flex flex-col gap-3 rounded-xl bg-warning-soft p-4 text-[13px] text-warning-fg"
      >
        <div className="flex items-start gap-3">
          <Clock className="mt-px size-[18px] flex-none" aria-hidden="true" />
          <p className="min-w-0 text-text">
            <span className="sr-only">{t("extraCostApprovalPendingTitle")}. </span>
            {t("extraCostApprovalPendingDescription", { amount: formatMoneyLocalized(amount, { language }) })}
          </p>
        </div>
        <dl className="m-0 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 border-t border-border pt-3">
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-text-muted">{row.label}</dt>
              <dd className="m-0 whitespace-nowrap text-right font-semibold text-text">{row.value}</dd>
            </div>
          ))}
        </dl>
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
