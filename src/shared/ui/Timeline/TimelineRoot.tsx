import type { ReactNode } from "react";

type TimelineRootProps = {
  children: ReactNode;
};

export const TimelineRoot = ({ children }: TimelineRootProps) => (
  <div className="space-y-0">{children}</div>
);

export default TimelineRoot;
