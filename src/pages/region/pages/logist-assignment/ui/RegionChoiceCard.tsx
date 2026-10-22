// dizayn-v2: superadmin-regions-logist-assignment, admin-regions-logist-assignment
import { useTranslation } from "react-i18next";
import type { LogistRegion } from "../../../../../entities/logist";
import { shortRegionName } from "../../../../../entities/region";
import { cx } from "../../../../../shared/lib/cx";
import { Badge, type Tone } from "../../../../../shared/ui/primitives";
import { regionCardKind, type RegionCardKind } from "../model/assignment";

const BADGE: Partial<Record<RegionCardKind, Tone>> = {
  adding: "info",
  transfer: "warning",
  removing: "danger",
};

type RegionChoiceCardProps = {
  region: LogistRegion;
  logistId: string;
  checked: boolean;
  /** Viloyatdagi boshqa logistning ismi (`logist_id` bo'yicha). */
  ownerName: (logistId: string) => string | null;
  disabled?: boolean;
  onToggle: (regionId: string) => void;
};

/**
 * Viloyat kartasi (`.el-choice-card` + `.el-check`): nom, holat qatori va o'zgarish belgisi — 6 holat
 * (`regionCardKind`). Belgilangan karta `action-soft` fonda; o'chiq (nofaol logist, saqlanmoqda) — xira.
 */
export const RegionChoiceCard = ({
  region,
  logistId,
  checked,
  ownerName,
  disabled,
  onToggle,
}: RegionChoiceCardProps) => {
  const { t } = useTranslation("region");
  const kind = regionCardKind(region, logistId, checked);
  const owner = region.logistId && region.logistId !== logistId ? ownerName(region.logistId) : null;

  const stateText =
    kind === "other"
      ? (owner ?? t("v2.logist.regions.state.otherUnknown"))
      : kind === "transfer"
        ? t("v2.logist.regions.state.transfer", {
            name: owner ?? t("v2.logist.regions.state.otherUnknown"),
          })
        : t(`v2.logist.regions.state.${kind}`);
  const tone = BADGE[kind];

  return (
    <label
      className={cx(
        "flex min-h-14 min-w-0 items-center gap-3 rounded-xl border px-3.5 py-2.5",
        "transition-[background-color,border-color] duration-150 motion-reduce:transition-none",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-action",
        checked ? "border-action bg-action-soft" : "border-border-strong bg-surface",
        disabled
          ? "cursor-not-allowed opacity-55"
          : cx("cursor-pointer", !checked && "hover:bg-sunken"),
      )}
    >
      <input
        type="checkbox"
        className="size-[18px] shrink-0 accent-action"
        checked={checked}
        disabled={disabled}
        onChange={() => onToggle(region.id)}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold text-text">{shortRegionName(region.name)}</span>
        <span className="truncate text-xs text-text-muted">{stateText}</span>
      </span>
      {tone ? (
        <Badge dot tone={tone}>
          {t(`v2.logist.regions.badge.${kind}`)}
        </Badge>
      ) : null}
    </label>
  );
};
