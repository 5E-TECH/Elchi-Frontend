import { describe, expect, expectTypeOf, it } from "vitest";
import type { UserRole } from "../../../entities/user/types/user";
import { EXTERNAL_ROLES, getManagerTabs, MANAGER_MARKET_TABS, MANAGER_TABS, STAFF_ROLES, STAFF_TABS } from "./roleTabs";

/**
 * K3scaE0W — rol tablari backend `Roles` bilan mos. `RoleSelector` va `UserFilters` FY-1 da olib tashlangan, rol
 * ro'yxati endi shu tablarda. `UserRole` — backend `Roles` ning frontenddagi nusxasi (`entities/user/types/user.ts`).
 */
const BACKEND_ROLES = [
  "superadmin",
  "admin",
  "manager",
  "registrator",
  "marketing",
  "operator",
  "courier",
  "market",
  "customer",
  "logist",
  "market_operator",
  "investor",
  "branch",
] as const satisfies readonly UserRole[];

describe("rol tablari", () => {
  it("ro'yxat `UserRole` ni to'liq qamraydi: yangi rol qo'shilsa, bu fayl ham yangilanadi", () => {
    expectTypeOf<Exclude<UserRole, (typeof BACKEND_ROLES)[number]>>().toBeNever();
    expect(new Set(BACKEND_ROLES).size).toBe(BACKEND_ROLES.length);
  });

  it("tablardagi har rol backend ro'yxatida bor", () => {
    const tabs = [...STAFF_TABS, ...MANAGER_MARKET_TABS].filter((tab) => tab !== "");
    expect(tabs.filter((tab) => !(BACKEND_ROLES as readonly string[]).includes(tab))).toEqual([]);
  });

  it("superadmin/admin va menejer tablari o'zgarmagan (snapshot)", () => {
    expect(STAFF_TABS).toEqual(["", "admin", "manager", "registrator", "courier", "logist", "market", "market_operator", "investor"]);
    // 2026-11-04: menejerda «Menejerlar»; 2026-11-12: PICKUP/HYBRID da oxirida «Marketlar» (o'zi yaratganlar).
    expect(MANAGER_TABS).toEqual(["", "courier", "registrator", "manager"]);
    expect(MANAGER_MARKET_TABS).toEqual(["", "courier", "registrator", "manager", "market"]);
  });

  it("2026-11-12: «Marketlar» faqat market yarata oladigan menejerda (PICKUP, HYBRID)", () => {
    expect(getManagerTabs("PICKUP")).toEqual(MANAGER_MARKET_TABS);
    expect(getManagerTabs("HYBRID")).toEqual(MANAGER_MARKET_TABS);
    for (const type of ["REGIONAL", "HQ", "CITY", "", null, undefined]) {
      expect(getManagerTabs(type)).toEqual(MANAGER_TABS);
    }
  });

  it("xodim va tashqi rollar kesishmaydi", () => {
    expect(STAFF_ROLES.filter((role) => (EXTERNAL_ROLES as readonly string[]).includes(role))).toEqual([]);
  });
});
