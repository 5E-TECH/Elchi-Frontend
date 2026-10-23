/**
 * `.el-choice-card` (CODE-MAP 2.2): tanlangan — `action` chegara va `action-soft` fon; o'chirilgani — `sunken`,
 * `text-subtle` (maketdagi «Mijoz», «Ilova ichida»).
 */
export const CHOICE_CARD =
  "flex min-h-11 min-w-0 cursor-pointer items-center gap-2.5 rounded-xl border border-border-strong bg-surface px-3.5 py-3 " +
  "text-sm text-text has-[:checked]:border-action has-[:checked]:bg-action-soft " +
  "has-[:disabled]:cursor-not-allowed has-[:disabled]:border-border has-[:disabled]:bg-sunken";

/** `.el-check` / `.el-radio`. */
export const CHOICE_INPUT =
  "size-[18px] shrink-0 cursor-pointer accent-action disabled:cursor-not-allowed disabled:opacity-60";
