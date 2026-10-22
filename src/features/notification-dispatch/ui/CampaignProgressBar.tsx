// dizayn-v2: superadmin-notifications-send-states, superadmin-notifications-send-schedule
import { cx } from "../../../shared/lib/cx";

/**
 * `.el-progress` (CODE-MAP): `h-2 rounded-full bg-sunken` > `bg-action`. Qiymat — foiz (0–100). `sunken` quti ichida
 * (bekor qilish oynasidagi karta) iz `surface` — aks holda fon bilan qo'shilib ko'rinmaydi.
 */
export const CampaignProgressBar = ({
  value,
  label,
  track = "sunken",
  className,
}: {
  value: number;
  label: string;
  track?: "sunken" | "surface";
  className?: string;
}) => (
  <div
    role="progressbar"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={value}
    className={cx(
      "h-2 w-full overflow-hidden rounded-full",
      track === "surface" ? "bg-surface" : "bg-sunken",
      className,
    )}
  >
    <span className="block h-full rounded-full bg-action" style={{ width: `${value}%` }} />
  </div>
);
