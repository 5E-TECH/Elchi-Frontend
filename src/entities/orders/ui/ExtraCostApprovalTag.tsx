// dizayn-v2: manager-orders-list-pending
import { memo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { Badge } from "../../../shared/ui/primitives/Badge";
import {
  clearPendingExtraCostApproval,
  getActivePendingApproval,
  isExtraCostAction,
  usePendingExtraCostApprovals,
  type ExtraCostAction,
} from "../extraCostApproval";

const ACTION_LABEL_KEYS: Record<ExtraCostAction, string> = {
  sell: "extraCostApprovalActionSell",
  partly_sell: "extraCostApprovalActionPartlySell",
  cancel: "extraCostApprovalActionCancel",
};

/**
 * «Tasdiqqa yuborilgan» — ro'yxatdagi holat yonida (dizayn v2; maket `manager-orders-list-pending`:
 * `el-badge el-badge-outline el-tone-warning`, ikonkasiz). Maslahatda nima, qancha va qachon yuborilgani:
 * «Sotish: 20 000 so'm qo'shimcha xarajat Bugun, 14:05 da market tasdig'iga yuborilgan».
 *
 * Buyurtma holati so'rov yuborilgandagidan o'zgargan bo'lsa (market tasdiqladi, amal bajarildi) yozuv
 * o'chiriladi va belgi ko'rinmaydi. v1 `ExtraCostApprovalBadge` (eski sahifalar) shu mantiq bilan.
 */
export const ExtraCostApprovalTag = memo(({ orderId, status }: { orderId: string; status: string }) => {
  const { t, i18n } = useTranslation("orders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const approvals = usePendingExtraCostApprovals();
  const stored = approvals[orderId];
  const active = getActivePendingApproval(approvals, { id: orderId, status });

  useEffect(() => {
    if (stored && !active) clearPendingExtraCostApproval(orderId);
  }, [active, orderId, stored]);

  if (!active) return null;

  const params = {
    amount: formatMoneyLocalized(active.amount, { language }),
    time: formatDateTimeLocalized(active.requestedAt, { language }),
  };
  const title = isExtraCostAction(active.action)
    ? t("extraCostApprovalSentAtAction", { ...params, action: t(ACTION_LABEL_KEYS[active.action]) })
    : t("extraCostApprovalSentAt", params);

  return (
    <Badge tone="warning" variant="outline" title={title} aria-label={title}>
      {t("extraCostApprovalBadge")}
    </Badge>
  );
});
ExtraCostApprovalTag.displayName = "ExtraCostApprovalTag";
