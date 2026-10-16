import { memo } from "react";
import { useTranslation } from "react-i18next";
import { SkeletonTable } from "./primitives/SkeletonPresets";
import { SLOW_LOADING_MS, useLoadingPhase } from "./primitives/useLoadingPhase";

/** Shundan keyin skeleton tagida "kutish uzoq davom etmoqda" chiqadi (qJjLP109; taxta `tizim-loading`: 15 s). */
export const SLOW_LOADING_AFTER_MS = SLOW_LOADING_MS;

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

/**
 * v1 → v2 O'RAMI. Ko'rinish — `SkeletonTable` (`src/shared/ui/primitives/SkeletonPresets.tsx`, taxtalar
 * `tizim-loading` 03, `tizim-errors` «Yuklanmoqda»): sarlavha qatori 40 px, qatorlar 56 px, telefonda
 * kartalar; 400 ms gacha ko'rinmaydi (tez javobda miltillamaydi), 15 s dan keyin pastda izoh.
 * Yangi kodda `QueryBoundary skeleton="table"` ni ishlating.
 */
const TableSkeleton = ({ rows = 6, columns = 5, className = "" }: TableSkeletonProps) => {
  const { t } = useTranslation("ui");
  const { visible, slow } = useLoadingPhase(true);

  return (
    <div aria-busy="true" className={className || undefined}>
      <span className="sr-only">{t("states.loading")}</span>
      <SkeletonTable rows={rows} columns={columns} slow={slow} className={visible ? undefined : "invisible"} />
    </div>
  );
};

export default memo(TableSkeleton);
