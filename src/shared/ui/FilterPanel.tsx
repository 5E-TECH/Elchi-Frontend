import { memo, type ReactNode } from "react";

interface FilterPanelProps {
  children: ReactNode;
  className?: string;
  gridClassName?: string;
}

const FilterPanel = ({
  children,
  className = "",
  gridClassName = "",
}: FilterPanelProps) => (
  <section
    className={`mb-4 rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-3 shadow-sm sm:mb-5 sm:p-4 dark:bg-primarydark ${className}`}
  >
    <div className={`grid min-w-0 grid-cols-1 gap-3 ${gridClassName}`}>{children}</div>
  </section>
);

export default memo(FilterPanel);
