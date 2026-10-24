// dizayn-v2: superadmin-warehouse-list, superadmin-warehouse-detail, manager-warehouse-detail, market-products-warehouse-stock
import { useTranslation } from "react-i18next";
import { StatusBadge, type Tone } from "../../../shared/ui/primitives";
import type { StockLevel, WarehouseStatus } from "../model/types";

/** Ombor holati: «Faol» — success, «To'xtatilgan» — neutral (maket `.el-badge-dot`). */
export const WarehouseStatusBadge = ({ status, className }: { status: WarehouseStatus; className?: string }) => {
  const { t } = useTranslation("warehouses");
  return (
    <StatusBadge
      tone={status === "PAUSED" ? "neutral" : "success"}
      label={t(status === "PAUSED" ? "status.paused" : "status.active")}
      className={className}
    />
  );
};

export const STOCK_LEVEL_TONE: Record<StockLevel, Tone> = { ok: "success", low: "warning", out: "danger" };

/** Qoldiq holati: «Yetarli» — success, «Kam qoldi» — warning, «Tugagan» — danger. */
export const StockLevelBadge = ({ level, className }: { level: StockLevel; className?: string }) => {
  const { t } = useTranslation("warehouses");
  return <StatusBadge tone={STOCK_LEVEL_TONE[level]} label={t(`level.${level}`)} className={className} />;
};
