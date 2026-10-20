import { describe, expect, it } from "vitest";
import {
  CODE_DESIGN_ROLES,
  DESIGN_ROLES,
  PLANNED_BOTTOM_NAV,
  PLANNED_MENU,
  PLANNED_ROLES,
  plannedBottomNav,
  plannedMenuKeys,
} from "./designMenu";
import { SIDEBAR_CONFIG, type SidebarUserRole } from "../widgets/Sidebar/model/menuConfig";

/**
 * `route-map.json` → `plannedMenu` / `plannedBottomNav` — menyu testlari o'tkazib yuboradigan narsalar
 * (ega tasdiqlagan, kodda hali yo'q). Ro'yxat jim kengayib qolmasin: har yozuv maketda bor, kodda yo'q
 * rol esa butun menyusi bilan rejada.
 */
describe("maket menyusi — rejadagi (kodda hali yo'q) bandlar", () => {
  const roleKeys = (map: Record<string, unknown> | undefined) =>
    Object.keys(map ?? {}).filter((key) => !key.startsWith("$"));

  it("kodda bor rollar maketda bor", () => {
    expect(CODE_DESIGN_ROLES.length).toBeGreaterThanOrEqual(6);
  });

  /**
   * Kodda yo'q rol, yoki qobiq kaliti bor, lekin bandlari hali bo'sh rol (ROL-0: logist, market_operator,
   * investor — har band o'z sahifasi bilan keladi): maketdagi butun menyusi `plannedMenu` da.
   */
  const EMPTY_MENU_ROLES = [
    ...PLANNED_ROLES,
    ...CODE_DESIGN_ROLES.filter((role) => SIDEBAR_CONFIG[role as SidebarUserRole].length === 0),
  ];

  it("menyusi bo'sh yangi rollar (ROL-0) qobiqda bor", () => {
    expect(EMPTY_MENU_ROLES).toEqual(expect.arrayContaining(["logist", "market_operator", "investor"]));
  });

  it.each(EMPTY_MENU_ROLES)("%s: kodda yo'q yoki bo'sh menyuli rolning butun menyusi plannedMenu da", (role) => {
    expect(new Set(plannedMenuKeys(role))).toEqual(new Set(DESIGN_ROLES[role].menu.map((item) => item.key)));
  });

  it("plannedMenu dagi har rol va kalit maketda bor", () => {
    for (const role of roleKeys(PLANNED_MENU)) {
      expect(DESIGN_ROLES[role], role).toBeDefined();
      const keys = new Set(DESIGN_ROLES[role].menu.map((item) => item.key));
      for (const key of plannedMenuKeys(role)) expect(keys.has(key), `${role}.${key}`).toBe(true);
    }
  });

  it("plannedBottomNav — kodda bor rol, kataklari maketdagi bottomNav bilan bir xil", () => {
    for (const role of roleKeys(PLANNED_BOTTOM_NAV)) {
      expect(CODE_DESIGN_ROLES as string[], role).toContain(role);
      expect(plannedBottomNav(role), role).toEqual(DESIGN_ROLES[role].bottomNav);
    }
  });
});
