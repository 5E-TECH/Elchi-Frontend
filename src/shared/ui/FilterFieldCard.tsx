import { memo, type ReactNode } from "react";

interface FilterFieldCardProps {
  children: ReactNode;
  className?: string;
}

const FilterFieldCard = ({ children, className = "" }: FilterFieldCardProps) => (
  <div
    className={`rounded-2xl border border-[color:var(--color-border-soft)] bg-white/70 p-3 shadow-sm dark:border-white/8 dark:bg-white/[0.03] ${className}`}
  >
    {children}
  </div>
);

export default memo(FilterFieldCard);
