/** `.el-chip` (`aria-pressed`, CODE-MAP 2.2): son — kulrang, tanlanganda ko'k. */
export const CHIP =
  "group inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-border-strong bg-surface px-3 " +
  "text-[13px] font-medium text-text transition-[background-color,border-color,color] duration-150 " +
  "hover:border-text-subtle motion-reduce:transition-none aria-pressed:border-action aria-pressed:bg-action-soft " +
  "aria-pressed:font-semibold aria-pressed:text-action-fg max-md:h-11";
export const CHIP_COUNT = "font-medium text-text-muted group-aria-pressed:text-action-fg";

/** `.el-stat-icon` (CODE-MAP 2.9): neytral ikonka katagi. */
export const STAT_ICON =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted";

/** `.el-menu` (CODE-MAP 2.2): band 36 px (telefonda 44). */
export const MENU = "flex min-w-[184px] flex-col gap-0.5 rounded-xl border border-border bg-raised p-1.5 shadow-xl";
export const MENU_ITEM =
  "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-text outline-none! " +
  "transition-[background-color,color] duration-150 motion-reduce:transition-none hover:bg-sunken " +
  "focus-visible:bg-sunken max-md:min-h-11 [&>svg]:mt-0.5 [&>svg]:shrink-0 [&>svg]:text-text-muted";
export const MENU_SEPARATOR = "mx-1.5 my-1 h-px shrink-0 bg-border";

/** Tab paneli pastki qismi — `Card footer` bilan bir xil (`.el-card-foot`). */
export const PANEL_FOOT = "flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3";
