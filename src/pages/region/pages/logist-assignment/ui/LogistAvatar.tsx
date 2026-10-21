import { cx } from "../../../../../shared/lib/cx";
import { logistInitials } from "../model/assignment";

/** `.el-avatar` (bosh harflar): tanlangan — `surface` fonda ko'k, qolgani — `sunken` fonda kulrang. */
export const LogistAvatar = ({
  name,
  selected,
  size = 40,
}: {
  name: string;
  selected?: boolean;
  size?: 28 | 40;
}) => (
  <span
    aria-hidden="true"
    className={cx(
      "inline-flex shrink-0 items-center justify-center rounded-full text-[13px] font-bold",
      size === 40 ? "size-10" : "size-7 text-xs",
      selected ? "bg-surface text-action-fg" : "bg-sunken text-text-muted",
    )}
  >
    {logistInitials(name)}
  </span>
);
