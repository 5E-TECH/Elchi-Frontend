import { ArrowRight } from "lucide-react";
import { StatusBadge } from "../../../shared/ui/StatusBadge";

type StatusTransitionBadgeProps = {
  oldStatus?: string;
  newStatus?: string;
};

export const StatusTransitionBadge = ({ oldStatus, newStatus }: StatusTransitionBadgeProps) => {
  if (!oldStatus && !newStatus) {
    return null;
  }

  if (!oldStatus && newStatus) {
    return <StatusBadge status={newStatus} />;
  }

  if (oldStatus && !newStatus) {
    return <StatusBadge status={oldStatus} />;
  }

  const previousStatus = oldStatus as string;
  const nextStatus = newStatus as string;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge status={previousStatus} />
      <ArrowRight size={14} className="text-gray-400 dark:text-white" />
      <StatusBadge status={nextStatus} />
    </div>
  );
};

export default StatusTransitionBadge;
