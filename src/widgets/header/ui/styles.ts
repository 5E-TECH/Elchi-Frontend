// dizayn-v2: shell
/**
 * Yuqori panel ichidagi takrorlanadigan klass to'plamlari (`design/CODE-MAP.md` 1-bo'lim retseptlari va 2.10).
 * Maketdagi `el-*` nomlari JSX'ga ko'chirilmaydi — shu tarjimalar ishlatiladi.
 */

/** `.el-menu` / `.el-options` / `.el-popover` foni: `RAISED` (bg-raised, border, radius 12, soya). */
export const RAISED = "rounded-xl border border-border bg-raised shadow-xl";

/** `.el-menu-item` asosi: 36px, 14px matn; telefonda 44px (bosish maydoni). Rang — quyidagi ikki turdan birida. */
const MENU_ITEM_BASE =
  "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm no-underline " +
  "transition-[background-color,color] duration-150 motion-reduce:transition-none [&>svg]:shrink-0 max-md:h-11";

/** `.el-menu-item`: matn `text`, ikonka `text-muted`, hover/fokus `sunken`. */
export const MENU_ITEM = `${MENU_ITEM_BASE} text-text hover:bg-sunken focus-visible:bg-sunken [&>svg]:text-text-muted`;

/** `.el-menu-item-danger` — «Chiqish»: matn va ikonka `danger-fg`, hover/fokus `danger-soft`. */
export const MENU_ITEM_DANGER =
  `${MENU_ITEM_BASE} text-danger-fg hover:bg-danger-soft focus-visible:bg-danger-soft [&>svg]:text-danger-fg`;

/** `.el-menu-sep`. */
export const MENU_SEP = "mx-1.5 my-1 h-px shrink-0 bg-border";

/** `.el-menu-label`. */
export const MENU_LABEL = "px-2.5 pb-0.5 pt-1.5 text-xs font-semibold text-text-muted";

/** `.el-kbd`. */
export const KBD =
  "inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-md border border-border-strong " +
  "bg-sunken px-1.5 text-xs font-semibold text-text-muted";

/**
 * `.el-input` (CODE-MAP `INPUT`) — telefonda 16px (iOS kattalashtirmasin), desktopda 14px.
 * Qidiruv uchun chapda ikonka joyi (`.el-search .el-input` → `padding-left: 40px`).
 */
export const SEARCH_INPUT =
  "h-10 w-full rounded-[10px] border border-border-strong bg-input pl-10 pr-11 text-base text-text md:text-sm " +
  "placeholder:text-text-subtle hover:border-text-subtle focus:border-action focus:outline-none focus:ring-3 " +
  "focus:ring-focus [&::-webkit-search-cancel-button]:appearance-none";

/** `.el-avatar` — bosh harflar doirasi (CODE-MAP: avatar → `bg-avatar text-on-avatar`; tunda maketdagi to'q ko'k). */
export const AVATAR =
  "inline-flex shrink-0 select-none items-center justify-center rounded-full bg-avatar font-bold text-on-avatar";

/** `.el-stat-icon` — neytral ikonka qutisi. */
export const STAT_ICON = "inline-flex shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted";

/** `.el-skel-line` / `.el-skel-block` (shimmer o'rniga — gradientsiz `animate-pulse`). */
export const SKELETON = "animate-pulse rounded-md bg-sunken motion-reduce:animate-none";
