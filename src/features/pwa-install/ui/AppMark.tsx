// dizayn-v2: courier-inbox-pwa-install, courier-inbox-pwa-ios-dialog, common-settings-notifications-pwa, courier-dashboard-pwa-install
import MarkWhite from "../../../shared/assets/brand/elchi-mark-white.png";
import { cx } from "../../../shared/lib/cx";

/**
 * Ilova belgisi plitkasi — maketdagi navy kvadrat (`background: var(--sidebar)` → `bg-nav`, ikkala mavzuda yon menyu
 * rangi) + oq Elchi belgisi. `lg` — 44 (karta), `md` — 40 (sozlamalar, oyna), `sm` — 36 (oyna sarlavhasi uyasi).
 */
const SIZE = {
  lg: { box: "size-11", w: 26, h: 24 },
  md: { box: "size-10", w: 24, h: 22 },
  sm: { box: "size-9", w: 22, h: 20 },
} as const;

export const AppMark = ({ size = "lg", className }: { size?: keyof typeof SIZE; className?: string }) => {
  const s = SIZE[size];
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-[10px] border border-border bg-nav",
        s.box,
        className,
      )}
    >
      <img src={MarkWhite} alt="" width={s.w} height={s.h} className="block" />
    </span>
  );
};
