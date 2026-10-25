// dizayn-v2: superadmin-warehouse-list, superadmin-warehouse-detail, manager-warehouse-detail, market-products-warehouse-stock
import { useTranslation } from "react-i18next";
import { Badge, StatusBadge, type BadgeSize } from "../../../shared/ui/primitives";
import { STOCK_LEVEL_TONE } from "../lib/levelTone";
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

/** Qoldiq holati: «Yetarli» — success, «Kam qoldi» — warning, «Tugagan» — danger. */
export const StockLevelBadge = ({ level, className }: { level: StockLevel; className?: string }) => {
  const { t } = useTranslation("warehouses");
  return <StatusBadge tone={STOCK_LEVEL_TONE[level]} label={t(`level.${level}`)} className={className} />;
};

/**
 * Markaziy ombor belgisi «Markaziy» (Pa1KaXmj; maket yo'q — eng yaqini `superadmin-warehouse-list`): tur yorlig'i —
 * nuqtasiz `info` Badge (holat emas). Ro'yxatda (nom yonida, telefon kartasida) va tafsilot sarlavhasida.
 */
export const HqWarehouseBadge = ({ size = "sm", className }: { size?: BadgeSize; className?: string }) => {
  const { t } = useTranslation("warehouses");
  return (
    <Badge tone="info" size={size} className={className}>
      {t("kind.hq")}
    </Badge>
  );
};
