// dizayn-v2: (maket yo'q) manager-orders-list-pending
import { memo } from "react";
import { CircleCheck, CircleX, Clock, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { Badge } from "../../../shared/ui/primitives/Badge";
import type { Tone } from "../../../shared/ui/primitives/tone";
import {
  extraCostTagKind,
  readExtraCostRequest,
  useFormatExtraCostItems,
  type ExtraCostTagKind,
} from "../extraCostRequest";

const META: Record<ExtraCostTagKind, { tone: Tone; icon: LucideIcon; key: string }> = {
  pending: { tone: "warning", icon: Clock, key: "extraCostRequestTag.pending" },
  approved: { tone: "success", icon: CircleCheck, key: "extraCostRequestTag.approved" },
  rejected: { tone: "danger", icon: CircleX, key: "extraCostRequestTag.rejected" },
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/**
 * QO'SHIMCHA XARAJAT BELGISI (SPEC v2) — buyurtma allaqachon sotilgan / bekor qilingan, xarajat esa alohida so'rov:
 * «Xarajat kutilmoqda · 20 000 so'm», `showDecided` bo'lsa (tafsilot, skaner) «Xarajat tasdiqlangan · 20 000 so'm» /
 * «Xarajat rad etildi». Maslahatda — qaysi tovar uchun. Manba — buyurtmaning `extra_cost_request` maydoni.
 *
 * Eski (`replay`) kutilayotgan so'rov — «Tasdiqqa yuborilgan» (`ExtraCostApprovalTag`) / «Tasdiq kutilmoqda»; bu
 * belgi u yerda chiqmaydi. Maket yo'q — eng yaqini `manager-orders-list-pending` (holat yonidagi `Badge`).
 */
export const ExtraCostRequestTag = memo(
  ({ order, showDecided = false }: { order: unknown; showDecided?: boolean }) => {
    const { t, i18n } = useTranslation("orders");
    const language = i18n.resolvedLanguage ?? i18n.language;
    const formatItems = useFormatExtraCostItems();
    const record = asRecord(order);
    const request = readExtraCostRequest(record?.extra_cost_request);
    const kind = extraCostTagKind(request, {
      showDecided,
      legacyPending: Boolean(record?.pending_extra_cost_approval),
    });

    if (!request || !kind) return null;

    const meta = META[kind];
    const label = t(meta.key, { amount: formatMoneyLocalized(request.amount, { language }) });
    const items = formatItems(request.items, request.action);
    const hint = items ? t("extraCostRequestTag.items", { items }) : undefined;

    return (
      <Badge
        tone={meta.tone}
        icon={meta.icon}
        data-testid="extra-cost-request-tag"
        data-kind={kind}
        title={hint}
        aria-label={hint ? `${label}. ${hint}` : label}
      >
        {label}
      </Badge>
    );
  },
);
ExtraCostRequestTag.displayName = "ExtraCostRequestTag";
