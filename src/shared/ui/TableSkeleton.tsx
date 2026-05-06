import { memo } from "react";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

const TableSkeleton = ({ rows = 6, columns = 5, className = "" }: TableSkeletonProps) => (
  <div
    className={`overflow-hidden rounded-2xl border border-[color:var(--color-border-strong)] bg-primary shadow-sm dark:border-white/10 dark:bg-white/[0.025] ${className}`}
  >
    <div className="hidden border-b border-[color:var(--color-border-soft)] bg-main/10 px-5 py-4 md:grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {Array.from({ length: columns }).map((_, index) => (
        <span key={index} className="h-3 w-20 animate-pulse rounded-full bg-maindark/10 dark:bg-white/15" />
      ))}
    </div>

    <div className="divide-y divide-[color:var(--color-border-soft)] dark:divide-white/10">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-3 px-5 py-4 md:items-center"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, opacity: 1 - rowIndex * 0.06 }}
        >
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <span
              key={columnIndex}
              className="h-4 animate-pulse rounded-full bg-slate-200 dark:bg-white/12"
              style={{ width: `${columnIndex % 2 === 0 ? 72 : 54}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export default memo(TableSkeleton);
