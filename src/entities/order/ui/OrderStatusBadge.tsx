import { useTranslation } from "react-i18next";
import { StatusBadge, type StatusBadgeProps } from "../../../shared/ui/primitives/StatusBadge";
import {
  ORDER_STATUS_NS,
  ORDER_STATUS_REGISTRY,
  ORDER_STATUS_UNKNOWN_LABEL_KEY,
  humanizeOrderStatus,
  resolveDisplayOrderStatus,
} from "../model/statusRegistry";

export type OrderStatusBadgeProps = Omit<StatusBadgeProps, "tone" | "label" | "icon" | "variant"> & {
  /** API'dan kelgan xom holat (`on the road`, `ON_THE_ROAD`, `cancelled_sent` …). */
  status: unknown;
};

/**
 * BUYURTMA HOLATI BELGISI (dizayn v2): ton, yorliq va ko'rinish
 * `ORDER_STATUS_REGISTRY` dan; maketdagidek nuqtali (`el-badge el-badge-dot`),
 * ikonkasiz; «Bekor — jo'natilgan» chegarali.
 *
 * Noma'lum holat yiqitmaydi va bo'sh qolmaydi: neytral ton + o'qiladigan xom
 * qiymat (`lost_in_transit` → «Lost in transit»), bo'sh qiymat — «Noma'lum».
 */
export const OrderStatusBadge = ({ status, ...rest }: OrderStatusBadgeProps) => {
  const { t } = useTranslation(ORDER_STATUS_NS);
  const resolved = resolveDisplayOrderStatus(status);

  if (resolved) {
    const meta = ORDER_STATUS_REGISTRY[resolved];
    return (
      <StatusBadge
        tone={meta.tone}
        variant={meta.variant}
        label={t(meta.labelKey)}
        data-order-status={meta.key}
        {...rest}
      />
    );
  }

  return (
    <StatusBadge
      tone="neutral"
      label={humanizeOrderStatus(status) ?? t(ORDER_STATUS_UNKNOWN_LABEL_KEY)}
      data-order-status="unknown"
      {...rest}
    />
  );
};
