// dizayn-v2: manager-orders-list-pending
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { Badge } from "../../../shared/ui/primitives/Badge";
import {
  getActivePendingApproval,
  isExtraCostAction,
  usePendingExtraCostApprovals,
  type ExtraCostAction,
  type OrderWithPendingApproval,
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
 * Manba — server (GykuOz8f): buyurtmaning `pending_extra_cost_approval` maydoni (`GET /orders`) — boshqa qurilmada
 * yuborilgan so'rov ham ko'rinadi, market qaror qilgach (ro'yxat yangilanganda) belgi yo'qoladi.
 */
export const ExtraCostApprovalTag = memo(({ order }: { order: OrderWithPendingApproval }) => {
  const { t, i18n } = useTranslation("orders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const approvals = usePendingExtraCostApprovals();
  const active = getActivePendingApproval(approvals, order);

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
