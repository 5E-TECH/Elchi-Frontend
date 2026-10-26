// dizayn-v2: superadmin-payments-shift-settings
import { Pressable } from "../../../shared/ui/primitives";
import { SwitchTrack } from "../../settings/ui/settingsUi";

/** Jadval katagidagi kalit (`.el-switch`, `role="switch"`): nomi — `aria-label` (qator + ustun), ≥ 44 px bosish maydoni. */
export const CellSwitch = ({
  checked,
  disabled,
  label,
  onToggle,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onToggle: (next: boolean) => void;
}) => (
  <Pressable
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onToggle(!checked)}
    className="group inline-flex min-h-11 items-center rounded-lg px-1 disabled:cursor-not-allowed"
  >
    <SwitchTrack />
  </Pressable>
);
