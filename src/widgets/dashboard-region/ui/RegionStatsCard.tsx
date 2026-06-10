import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Map as MapIcon, Loader2 } from "lucide-react";
import UzbekistanRegionMap from "../../../pages/region/ui/UzbekistanRegionMap";
import { useRegionStats, toRegionMapItems } from "../../../entities/region";
import { TYPO, TEXT } from "../../../shared/config/designSystem";
import QueryErrorState from "../../../shared/ui/QueryErrorState";
import { getTodayRange } from "../../../shared/lib/dateRange";

/**
 * RegionStatsCard — Dashboard uchun hududlar bo'yicha xarita widgeti.
 * Mavjud `UzbekistanRegionMap` komponenti va `entities/region` data-layeridan
 * foydalanadi (yangi backend kerak emas).
 */
export interface RegionStatsCardProps {
  startDate?: string;
  endDate?: string;
}

const RegionStatsCard = memo(({ startDate, endDate }: RegionStatsCardProps) => {
  const { t } = useTranslation("dashboard");
  const params = useMemo(() => {
    const today = getTodayRange();
    return {
      startDate: startDate || today.from,
      endDate: endDate || today.to,
    };
  }, [endDate, startDate]);
  const { data, isLoading, isError, refetch } = useRegionStats(params);

  const regions = data?.regions ?? [];
  const summary = data?.summary ?? null;

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <MapIcon size={18} style={{ color: "var(--color-main)" }} />
        <div>
          <h2 className={`${TYPO.sectionTitle} text-maindark dark:text-primary`}>
            {t("region.title")}
          </h2>
          <p className="mt-1 text-xs" style={{ color: TEXT.soft }}>
            {t("region.subtitle")}
          </p>
        </div>
      </div>

      {isError ? (
        <QueryErrorState
          description={t("load_error")}
          onRetry={() => void refetch()}
        />
      ) : isLoading ? (
        <div className="flex h-[400px] items-center justify-center rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-card-surface)]">
          <Loader2 className="h-7 w-7 animate-spin" style={{ color: "var(--color-main)" }} />
        </div>
      ) : (
        <UzbekistanRegionMap
          regions={toRegionMapItems(regions)}
          summary={summary}
          startDate={params.startDate}
          endDate={params.endDate}
        />
      )}
    </section>
  );
});

RegionStatsCard.displayName = "RegionStatsCard";

export default RegionStatsCard;
