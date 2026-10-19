import designRoles from "../../design/kit/roles.json";
import routeMap from "../../design/kit/route-map.json";
import { SIDEBAR_CONFIG, type SidebarUserRole } from "../widgets/Sidebar/model/menuConfig";

/**
 * Maket menyusi (`design/kit/roles.json`) — kodda bor qismi, menyu testlari uchun.
 *
 * Ega tasdiqlagan, lekin kodda hali yo'q narsalar `design/kit/route-map.json` da yoziladi (screens.mjs bilan
 * bir xil manba): `plannedMenu` — rol → maketdagi, kodda hali yo'q menyu bandlari; `plannedBottomNav` — rol →
 * maketdagi, kodda hali yo'q pastki menyu kataklari. Ikkala ro'yxat faqat qisqaradi: kod maketga yetgach band
 * shu yerdan olinadi (`designMenu.test.ts` eslatadi). Kodda umuman yo'q rol (`SIDEBAR_CONFIG` da kaliti yo'q)
 * faqat butun menyusi `plannedMenu` da bo'lsa o'tkaziladi.
 */

export type DesignMenuItem = {
  key: string;
  label: string;
  icon: string;
  group?: string;
  short?: Record<"uz" | "ru" | "en", string>;
};
export type DesignRoleSpec = { grouped: boolean; menu: DesignMenuItem[]; bottomNav: string[] };

type PlannedMap = Record<string, string[] | string>;
const listOf = (map: PlannedMap | undefined, role: string): string[] => {
  const value = map?.[role];
  return Array.isArray(value) ? value : [];
};

export const DESIGN_ROLES = designRoles.roles as unknown as Record<string, DesignRoleSpec>;
export const PLANNED_MENU = (routeMap as unknown as { plannedMenu?: PlannedMap }).plannedMenu;
export const PLANNED_BOTTOM_NAV = (routeMap as unknown as { plannedBottomNav?: PlannedMap }).plannedBottomNav;

const CODE_ROLE_SET = new Set(Object.keys(SIDEBAR_CONFIG));

/** Maketdagi rollar — kodda bor (yon menyusi bor) va kodda hali yo'q (rejadagi). */
export const DESIGN_ROLE_NAMES = Object.keys(DESIGN_ROLES);
export const CODE_DESIGN_ROLES = DESIGN_ROLE_NAMES.filter((role) => CODE_ROLE_SET.has(role)) as SidebarUserRole[];
export const PLANNED_ROLES = DESIGN_ROLE_NAMES.filter((role) => !CODE_ROLE_SET.has(role));

/** Rol uchun maketdagi, kodda hali yo'q menyu kalitlari (`plannedMenu`). */
export const plannedMenuKeys = (role: string): string[] => listOf(PLANNED_MENU, role);

/** Maket roli, kodda hali yo'q menyu bandlarisiz — kod menyusi shu bilan solishtiriladi. */
export const designRoleInCode = (role: string): DesignRoleSpec => {
  const spec = DESIGN_ROLES[role];
  const planned = new Set(plannedMenuKeys(role));
  return { ...spec, menu: spec.menu.filter((item) => !planned.has(item.key)) };
};

/** Pastki menyusi maketda o'zgargan, kodda hali eski rol (`plannedBottomNav`). */
export const isBottomNavPlanned = (role: string): boolean => listOf(PLANNED_BOTTOM_NAV, role).length > 0;
export const plannedBottomNav = (role: string): string[] => listOf(PLANNED_BOTTOM_NAV, role);
