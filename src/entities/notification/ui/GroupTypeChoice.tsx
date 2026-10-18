// dizayn-v2: superadmin-notifications-create-dialog
import { useTranslation } from "react-i18next";
import { useFieldControl } from "../../../shared/ui/primitives";
import type { NotificationGroupType } from "../model/types";

const TYPES: readonly NotificationGroupType[] = ["create", "cancel"];

/** Maket `.el-choice-card` (CODE-MAP 2.2): tanlangan karta — `action` chegarasi va yumshoq fon. */
const CARD =
  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-border-strong bg-surface px-3.5 py-3 " +
  "has-[:checked]:border-action has-[:checked]:bg-action-soft has-[:disabled]:cursor-not-allowed " +
  "has-[:disabled]:opacity-45 transition-[background-color,border-color] duration-150 motion-reduce:transition-none";

export type GroupTypeChoiceProps = {
  value: NotificationGroupType;
  onChange: (value: NotificationGroupType) => void;
  /** Radio guruh nomi (bir sahifada ikki oyna bo'lsa farq qilsin). */
  name: string;
  disabled?: boolean;
};

/**
 * Xabar turi — ikki radio karta («Yangi buyurtmalar guruhi» / «Bekor qilinganlar guruhi»).
 * `Field labelAs="span"` ichida ishlatiladi: guruh nomi yorliqdan, izoh `hint` dan.
 */
const GroupTypeChoice = ({ value, onChange, name, disabled }: GroupTypeChoiceProps) => {
  const { t } = useTranslation("notifications");
  const field = useFieldControl({ disabled });

  return (
    <div
      role="radiogroup"
      aria-labelledby={field.labelId}
      aria-describedby={field["aria-describedby"]}
      aria-required={field["aria-required"]}
      className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-2"
    >
      {TYPES.map((type) => (
        <label key={type} className={CARD}>
          <input
            type="radio"
            name={name}
            value={type}
            checked={value === type}
            disabled={field.disabled}
            onChange={() => onChange(type)}
            className="size-[18px] shrink-0 cursor-pointer accent-action disabled:cursor-not-allowed"
          />
          <span className="text-sm font-semibold text-text">{t(`telegramGroups.typeChoice.${type}`)}</span>
        </label>
      ))}
    </div>
  );
};

export default GroupTypeChoice;
