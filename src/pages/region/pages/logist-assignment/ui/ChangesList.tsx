// dizayn-v2: superadmin-regions-logist-assignment-confirm-dialog, admin-regions-logist-assignment-confirm-dialog
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { shortRegionName } from "../../../../../entities/region";
import { Badge, type Tone } from "../../../../../shared/ui/primitives";
import type { AssignmentChange, AssignmentDiff } from "../model/assignment";

const CHANGE_TONE: Record<AssignmentChange["kind"], Tone> = {
  adding: "info",
  transfer: "warning",
  removing: "danger",
};

/**
 * Tasdiq oynasidagi o'zgarishlar ro'yxati (maket `*-regions-logist-assignment-confirm-dialog`): avval olib
 * tashlanadiganlar, so'ng o'tkaziladiganlar («Dilnoza Karimovadan olinadi»), oxirida qo'shiladiganlar; ostida izoh
 * «Logistsiz viloyat hech bir logistning bosh sahifasida ko'rinmaydi.»
 */
export const ChangesList = ({
  diff,
  ownerName,
}: {
  diff: AssignmentDiff;
  ownerName: (logistId: string) => string | null;
}) => {
  const { t } = useTranslation("region");
  const items = [...diff.removed, ...diff.transferred, ...diff.added];

  const hintOf = (change: AssignmentChange) => {
    if (change.kind === "removing") return t("v2.logist.confirm.removedHint");
    if (change.kind === "adding") return t("v2.logist.confirm.addedHint");
    const owner = change.region.logistId ? ownerName(change.region.logistId) : null;
    return owner
      ? t("v2.logist.confirm.transferHint", { name: owner })
      : t("v2.logist.confirm.transferHintUnknown");
  };

  return (
    <>
      <ul
        aria-label={t("v2.logist.confirm.listLabel")}
        className="m-0 flex list-none flex-col gap-2 p-0"
      >
        {items.map((change) => (
          <li
            key={change.region.id}
            className="flex items-center gap-3 rounded-[10px] bg-sunken px-3 py-2.5"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-semibold text-text">{shortRegionName(change.region.name)}</span>
              <span className="text-xs text-text-muted">{hintOf(change)}</span>
            </span>
            <Badge dot tone={CHANGE_TONE[change.kind]}>
              {t(`v2.logist.regions.badge.${change.kind}`)}
            </Badge>
          </li>
        ))}
      </ul>
      <p className="m-0 flex items-start gap-2 text-[13px] text-text-muted">
        <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span className="min-w-0">{t("v2.logist.confirm.note")}</span>
      </p>
    </>
  );
};
