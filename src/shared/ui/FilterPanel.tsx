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
    className={`mb-5 rounded-[28px] border border-[color:var(--color-border-soft)] bg-primary p-4 shadow-sm dark:bg-primarydark ${className}`}
  >
    <div className={`grid gap-3 ${gridClassName}`}>{children}</div>
  </section>
);

export default memo(FilterPanel);
