import { memo, type ReactNode } from "react";

interface PageStatBadgeProps {
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}

const PageStatBadge = ({
  icon,
  children,
  className = "",
}: PageStatBadgeProps) => (
  <div
    className={`flex items-center gap-2 rounded-2xl border border-[color:var(--color-border-soft)] bg-primary px-4 py-3 text-sm font-bold text-[color:var(--color-text-muted)] shadow-sm dark:bg-primarydark dark:text-white/70 ${className}`}
  >
    {icon}
    {children}
  </div>
);

export default memo(PageStatBadge);
