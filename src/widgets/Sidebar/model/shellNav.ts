import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import { useNavPathname } from "../../../shared/lib/navigationPending";
import { closeMobileMenu, openMobileMenu, toggleMobileMenu } from "./sidebarSlice";

/**
 * SHELL NAVIGATSIYA SHARTNOMASI (dizayn v2, 2-bosqich) — yon menyu, yuqori panel,
 * pastki menyu va suriluvchi menyu bir xil manbadan o'qiydi.
 *
 * Suriluvchi menyu (`MobileMenu`, < 1024):
 *   const menu = useMobileMenu();
 *   menu.open()   — yuqori paneldagi menyu tugmasi (planshet/telefon) va pastki menyudagi «Menyu» bandi;
 *   menu.close()  — menyu ichidagi yopish tugmasi, fon, Escape, band bosilganda;
 *   menu.isOpen   — `aria-expanded` uchun.
 *   Shell (`dashboardLayout`) sahifa yo'li o'zgarganda va ekran ≥ 1024 bo'lganda o'zi yopadi,
 *   menyu ochiqligida orqa fonni `inert` qiladi.
 *
 * Faol band:
 *   const pathname = useNavPathname();          — kutilayotgan o'tish bo'lsa uning manzili
 *   const activeTo = getActiveNavPath(items, pathname);
 *   <a aria-current={item.to === activeTo ? "page" : undefined}>
 *   Eng uzun mos yo'l g'olib (`/orders` va `/orders/123` → `/orders`); `end: true` band
 *   (bosh sahifa `/`, `/branch-dashboard`) faqat aynan o'z yo'lida faol.
 */

export type NavMatchItem = { to: string; end?: boolean };

/** `to` yo'li `pathname` ga mosmi (react-router `NavLink` qoidasi bilan bir xil, katta-kichik harf farqsiz). */
export const isNavPathActive = (to: string, pathname: string, end = false): boolean => {
  const target = to.length > 1 ? to.replace(/\/+$/, "").toLowerCase() : to;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "").toLowerCase() : pathname || "/";
  if (path === target) return true;
  if (end || target === "/") return false;
  return path.startsWith(`${target}/`);
};

/** Menyu bandlaridan joriy yo'lga eng aniq mos keladiganining `to` si; hech biri mos kelmasa `null`. */
export const getActiveNavPath = (items: readonly NavMatchItem[], pathname: string): string | null => {
  let best: string | null = null;
  for (const item of items) {
    if (!isNavPathActive(item.to, pathname, item.end)) continue;
    if (best === null || item.to.length > best.length) best = item.to;
  }
  return best;
};

export { useNavPathname };

/** Planshet/telefon suriluvchi menyusi holati va amallari. */
export const useMobileMenu = () => {
  const dispatch = useDispatch();
  const isOpen = useSelector((state: RootState) => Boolean(state.sidebar.isMobileMenuOpen));
  const open = useCallback(() => dispatch(openMobileMenu()), [dispatch]);
  const close = useCallback(() => dispatch(closeMobileMenu()), [dispatch]);
  const toggle = useCallback(() => dispatch(toggleMobileMenu()), [dispatch]);
  return useMemo(() => ({ isOpen, open, close, toggle }), [isOpen, open, close, toggle]);
};
