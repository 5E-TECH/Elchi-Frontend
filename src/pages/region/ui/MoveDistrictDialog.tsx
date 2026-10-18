// dizayn-v2: (maket yo'q) superadmin-regions-sato-management, tizim-states-forms, superadmin-products-select-market-dialog
import { ArrowLeftRight, Check } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { Button, Dialog } from "../../../shared/ui/primitives";

export interface MoveDistrictTarget {
  districtId: string;
  districtName: string;
  fromRegionId: string;
  fromRegionName: string;
}

export interface MoveDistrictDialogProps {
  target: MoveDistrictTarget | null;
  regions: readonly { id: string; name: string }[];
  onClose: () => void;
  onMove: (target: MoveDistrictTarget, toRegionId: string) => void;
}

/**
 * TUMANNI BOSHQA VILOYATGA O'TKAZISH (telefon: sudrab tashlash ishlamaydi — har tumanda «⇆»).
 * Maket yo'q — eng yaqini: `tizim-states-forms` + `superadmin-products-select-market-dialog` (tanlash
 * ro'yxati + «Bekor qilish» / asosiy amal). Telefonda pastki varaqa (Dialog o'zi).
 */
const MoveDistrictDialog = ({ target, regions, onClose, onMove }: MoveDistrictDialogProps) => {
  const { t } = useTranslation("region");
  const [choice, setChoice] = useState<string | null>(null);
  const [forTarget, setForTarget] = useState(target?.districtId ?? null);
  const groupId = useId();
  // Boshqa tuman ochilganda tanlov boshidan.
  if ((target?.districtId ?? null) !== forTarget) {
    setForTarget(target?.districtId ?? null);
    setChoice(null);
  }
  const options = regions.filter((region) => region.id !== target?.fromRegionId);

  return (
    <Dialog
      open={target != null}
      onClose={onClose}
      title={t("v2.board.move.title")}
      description={
        target
          ? t("v2.board.move.description", {
              name: target.districtName,
              region: target.fromRegionName,
            })
          : undefined
      }
      icon={ArrowLeftRight}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("v2.board.cancel")}
          </Button>
          <Button
            variant="primary"
            disabled={!choice}
            onClick={() => {
              if (target && choice) onMove(target, choice);
            }}
          >
            {t("v2.board.move.submit")}
          </Button>
        </>
      }
    >
      <fieldset className="m-0 flex min-w-0 flex-col border-0 p-0">
        <legend className="pb-2 text-[13px] font-semibold text-text-muted">
          {t("v2.board.move.listLabel")}
        </legend>
        {options.map((region) => {
          const checked = choice === region.id;
          return (
            <label
              key={region.id}
              className={cx(
                "flex min-h-11 cursor-pointer items-center gap-3 border-t border-border px-1 py-2 text-sm text-text first-of-type:border-t-0",
                "transition-colors duration-150 hover:bg-row-hover motion-reduce:transition-none",
                checked && "font-semibold",
              )}
            >
              <input
                type="radio"
                name={groupId}
                value={region.id}
                checked={checked}
                onChange={() => setChoice(region.id)}
                className="size-4 shrink-0 accent-action"
              />
              <span className="min-w-0 flex-1 truncate">{region.name}</span>
              {checked ? (
                <Check size={18} aria-hidden="true" className="shrink-0 text-action-fg" />
              ) : null}
            </label>
          );
        })}
      </fieldset>
    </Dialog>
  );
};

export default MoveDistrictDialog;
