import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { getStatusColor } from "../config/statusColorMap";

type StatusBadgeProps = {
  status: string;
  size?: "sm" | "md";
};

const statusLabelKeyMap: Record<string, string> = {
  created: "statusCreated",
  new: "statusNew",
  received: "statusReceived",
  waiting: "statusWaiting",
  on_the_road: "statusOnTheRoad",
  sold: "statusSold",
  paid: "statusPaid",
  cancelled: "statusCancelled",
  closed: "statusClosed",
};

const humanizeStatus = (status?: string | null) => {
  if (!status) {
    return "—";
  }

  return status
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const sizeClassMap = {
  sm: "px-2.5 py-1 text-[11px]",
  md: "px-3 py-1.5 text-xs",
} satisfies Record<NonNullable<StatusBadgeProps["size"]>, string>;

export const StatusBadge = ({ status, size = "sm" }: StatusBadgeProps) => {
  const { t } = useTranslation("orders");
  const colors = getStatusColor(status);
  const labelKey = statusLabelKeyMap[status];

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border font-semibold whitespace-nowrap",
        sizeClassMap[size],
        colors.bg,
        colors.text,
        colors.border,
      )}
    >
      {labelKey ? t(labelKey) : humanizeStatus(status)}
    </span>
  );
};

export default StatusBadge;
