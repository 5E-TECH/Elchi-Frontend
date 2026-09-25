import { memo } from "react";
import { Copy } from "lucide-react";

interface OrderIdBadgeProps {
  id: string;
  label: string;
  onCopy: (id: string) => void;
  className?: string;
}

const OrderIdBadge = ({ id, label, onCopy, className = "" }: OrderIdBadgeProps) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    onClick={(event) => {
      event.stopPropagation();
      onCopy(id);
    }}
    className={`inline-flex items-center gap-1 text-xs font-mono font-semibold text-gray-400 transition-colors hover:text-main ${className}`}
  >
    <span>№{id}</span>
    <Copy size={11} className="shrink-0" />
  </button>
);

export default memo(OrderIdBadge);
