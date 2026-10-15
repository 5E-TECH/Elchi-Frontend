// dizayn-v2: shell
import { memo, type FocusEvent, type PointerEvent } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { preloadRoute } from "../../../app/lib/routePreload";
import { cx } from "../../../shared/lib/cx";
import { NAV_ROW, NAV_ROW_ACTIVE, NAV_ROW_COLLAPSED, NAV_ROW_IDLE } from "./navClasses";

/**
 * NAVY USTIDAGI MENYU BANDI — maket `.el-nav-item` / `.el-nav-count` (design/kit/helmet.html),
 * holatlar taxtasi `tizim-states-navigation` (01 · Yon menyu).
 *
 * Yon menyu (`Sidebar`, ≥ 1024) va planshetdagi suriluvchi panel (`MobileMenu`, 768–1023) ishlatadi —
 * ikkalasining foni `bg-nav`, shuning uchun ranglar faqat `nav-*` / `on-nav` tokenlaridan:
 *   oddiy   — 40px, radius 10, 14px/500, ikonka 20, oraliq 12, matn `nav-text`;
 *   hover   — faqat fon (`nav-hover`) va oq matn: kattalashish, soya, ko'k fon yo'q;
 *   faol    — `aria-current="page"`: fon `nav-active`, oq matn, 600;
 *   fokus   — 2px OQ halqa (`nav-text`), 2px oraliq: ko'k halqa navy ustida ko'rinmaydi. Global
 *             `:focus-visible` qoidasi (`index.css`) qatlamsiz, shuning uchun rang `!` bilan;
 *   son     — `nav-count` pilyula (12px/600), faol bandda ham oq; 0 — chiqmaydi, > 99 — «99+».
 * Yig'ilgan menyuda (72px): faqat ikonka, 48 × 44; nomi `aria-label` da va maslahatda (`onHint`),
 * son ikonka burchagida (`surface` doiracha).
 *
 * Faol band tashqarida hisoblanadi (`getActiveNavTo(items, useNavPathname())` — shell shartnomasidagi
 * `getActiveNavPath` + maketdagi ota band): eng uzun mos yo'l va bosilgan band sahifa yuklanguncha ham darhol tanlangan.
 */

export interface SidebarItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
  /** Joriy bo'lim (`aria-current="page"`). */
  active: boolean;
  /** Tayyor son matni (`formatNavCount`): `null` — belgi yo'q. */
  count?: string | null;
  /** Son uchun ekran o'quvchi matni: «3 ta yangi». */
  countLabel?: string;
  /** Yig'ilgan yon menyu: faqat ikonka. */
  collapsed?: boolean;
  /** Teginish uchun 44px balandlik (planshetdagi suriluvchi panel); sukut — maketdagi 40px (yon menyu). */
  touch?: boolean;
  /** Band bosilganda (suriluvchi menyuni yopish uchun). */
  onNavigate?: () => void;
  /** Yig'ilgan menyuda nom maslahati: element — ko'rsatish, `null` — yashirish. */
  onHint?: (target: HTMLElement | null, label: string) => void;
}

const SidebarItem = ({
  to,
  icon: Icon,
  label,
  active,
  count = null,
  countLabel,
  collapsed = false,
  touch = false,
  onNavigate,
  onHint,
}: SidebarItemProps) => {
  const accessibleName =
    count && countLabel ? `${label}, ${countLabel}` : collapsed ? label : undefined;

  const showHint = (event: PointerEvent<HTMLAnchorElement> | FocusEvent<HTMLAnchorElement>) => {
    preloadRoute(to);
    if (collapsed) onHint?.(event.currentTarget, label);
  };
  const hideHint = () => {
    if (collapsed) onHint?.(null, label);
  };

  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      aria-label={accessibleName}
      data-nav-item={to}
      onClick={onNavigate}
      onPointerEnter={showHint}
      onPointerLeave={hideHint}
      onFocus={showHint}
      onBlur={hideHint}
      onTouchStart={() => preloadRoute(to)}
      className={cx(
        NAV_ROW,
        collapsed ? NAV_ROW_COLLAPSED : cx("shrink-0 px-3", touch ? "h-11" : "h-10"),
        active ? NAV_ROW_ACTIVE : NAV_ROW_IDLE,
      )}
    >
      <Icon aria-hidden="true" size={20} strokeWidth={2} className="shrink-0" />
      {collapsed ? (
        count ? (
          <span
            aria-hidden="true"
            className="absolute right-0 top-0.5 h-[18px] min-w-[18px] rounded-full bg-surface px-[5px] text-center text-xs font-bold leading-[18px] text-text"
          >
            {count}
          </span>
        ) : null
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {count ? (
            <span
              aria-hidden="true"
              className="inline-flex h-5 min-w-[22px] shrink-0 items-center justify-center rounded-full bg-nav-count px-1.5 text-xs font-semibold text-on-nav"
            >
              {count}
            </span>
          ) : null}
        </>
      )}
    </Link>
  );
};

export default memo(SidebarItem);
