import { memo, type ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

const EmptyState = ({
  icon = "📭",
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) => (
  <div
    className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--color-border-soft)] bg-primary px-6 py-14 text-center shadow-sm dark:border-white/10 dark:bg-white/[0.025] ${className}`}
  >
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-main/10 text-3xl text-main dark:text-white">
      {icon}
    </div>
    <h3 className="m-0 text-lg font-black text-maindark dark:text-white">{title}</h3>
    {description ? (
      <p className="mt-2 max-w-md text-sm font-medium leading-6 text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
        {description}
      </p>
    ) : null}
    {action ? <div className="mt-5">{action}</div> : null}
  </div>
);

export default memo(EmptyState);
