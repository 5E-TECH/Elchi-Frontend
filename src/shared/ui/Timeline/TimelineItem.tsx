import type { ReactNode } from "react";

type TimelineItemProps = {
  icon: ReactNode;
  isLast?: boolean;
  children: ReactNode;
};

export const TimelineItem = ({ icon, isLast = false, children }: TimelineItemProps) => (
  <div className="grid grid-cols-[3rem_1fr] gap-4 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-5">
    <div className="relative flex justify-center">
      {!isLast && <span className="absolute top-12 bottom-0 w-px bg-gradient-to-b from-main/30 via-main/10 to-transparent dark:from-white/20 dark:via-white/10 dark:to-transparent" />}
      <span className="relative z-10 mt-1 flex h-10 w-10 items-center justify-center rounded-2xl border border-main/20 bg-white text-main shadow-lg shadow-main/10 dark:border-white/10 dark:bg-white/6 dark:text-white">
        {icon}
      </span>
    </div>
    <div className="pb-6">{children}</div>
  </div>
);

export default TimelineItem;
