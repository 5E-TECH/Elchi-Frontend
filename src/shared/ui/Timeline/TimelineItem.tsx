import type { ReactNode } from "react";

type TimelineItemProps = {
  icon: ReactNode;
  isLast?: boolean;
  children: ReactNode;
};

export const TimelineItem = ({ icon, isLast = false, children }: TimelineItemProps) => (
  <div className="grid grid-cols-[2.75rem_1fr] gap-3">
    <div className="relative flex justify-center">
      {!isLast && <span className="absolute top-11 bottom-0 w-px bg-gray-200 dark:bg-white/10" />}
      <span className="relative z-10 mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-main/20 bg-main/10 text-main dark:border-white/10 dark:bg-white/5 dark:text-white">
        {icon}
      </span>
    </div>
    <div className="pb-5">{children}</div>
  </div>
);

export default TimelineItem;
