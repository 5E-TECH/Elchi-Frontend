// dizayn-v2: superadmin-warehouse-detail, admin-warehouse-detail, manager-warehouse-detail
import { ClipboardList, Package, Tag, TriangleAlert } from "lucide-react";
import type { Warehouse } from "../../../../entities/warehouse";
import { StatCard, StatusBadge } from "../../../../shared/ui/primitives";
import { useWarehouseText } from "../../model/useWarehouseText";

/**
 * Ombor KPI (maket `.el-kpi-row`): Pozitsiyalar («N ta marketning mahsuloti») · Jami dona («sotish uchun mavjud N
 * dona») · Band («N ta faol buyurtmada»; menejerda «N ta buyurtmada · kuryerga berilmagan») · Kam qolgan («N ta kam
 * qoldi», «N ta tugagan»).
 */
export const WarehouseKpis = ({ warehouse, managerView }: { warehouse: Warehouse | undefined; managerView: boolean }) => {
  const text = useWarehouseText();
  const { t } = text;
  const summary = warehouse?.summary;
  const loading = !summary;
  return (
    <section aria-label={t("detail.kpiLabel")} className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-md:gap-3">
      <StatCard
        label={t("kpi.positions")}
        icon={Tag}
        loading={loading}
        value={summary ? text.number(summary.positions) : undefined}
        unit={t("units.ta")}
        hint={summary ? t("kpi.positionsHint", { value: text.number(summary.markets) }) : undefined}
      />
      <StatCard
        label={t("kpi.onHand")}
        icon={Package}
        loading={loading}
        value={summary ? text.number(summary.onHand) : undefined}
        unit={t("units.pcsWord", { count: summary?.onHand ?? 0 })}
        hint={summary ? t("kpi.availableHint", { value: text.pcs(summary.available) }) : undefined}
      />
      <StatCard
        label={t("kpi.reserved")}
        icon={ClipboardList}
        loading={loading}
        value={summary ? text.number(summary.reserved) : undefined}
        unit={t("units.pcsWord", { count: summary?.reserved ?? 0 })}
        hint={
          summary
            ? t(managerView ? "kpi.reservedHintManager" : "kpi.reservedHint", {
                value: text.number(summary.reservedOrders),
              })
            : undefined
        }
      />
      <StatCard
        label={t("kpi.low")}
        icon={TriangleAlert}
        loading={loading}
        value={summary ? text.number(summary.lowCount + summary.outCount) : undefined}
        unit={t("units.ta")}
        hint={
          summary ? (
            summary.lowCount + summary.outCount === 0 ? (
              <span>{t("kpi.noLow")}</span>
            ) : (
              <>
                {summary.lowCount > 0 ? (
                  <StatusBadge
                    tone="warning"
                    label={t("kpi.lowBadge", { count: summary.lowCount, value: text.number(summary.lowCount) })}
                  />
                ) : null}
                {summary.outCount > 0 ? (
                  <StatusBadge
                    tone="danger"
                    label={t("kpi.outBadgeShort", { count: summary.outCount, value: text.number(summary.outCount) })}
                  />
                ) : null}
              </>
            )
          ) : undefined
        }
      />
    </section>
  );
};
