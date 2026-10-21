import type { UserRole } from "../types/user";

export const USER_ROLE_LABEL_KEYS: Record<UserRole, string> = {
  admin: "roleAdmin",
  manager: "roleManager",
  registrator: "roleRegistrator",
  marketing: "roleMarketing",
  operator: "roleOperator",
  courier: "roleCourier",
  market: "roleMarket",
  superadmin: "roleSuperAdmin",
  customer: "roleCustomer",
  logist: "roleLogist",
  market_operator: "roleMarketOperator",
  investor: "roleInvestor",
  branch: "roleBranch",
};

export const getUserRoleLabelKey = (role?: string | null) =>
  role && role in USER_ROLE_LABEL_KEYS
    ? USER_ROLE_LABEL_KEYS[role as UserRole]
    : "roleUnknown";

const normalizeRole = (role: unknown): string =>
  typeof role === "string" ? role.trim().toLowerCase() : "";

/**
 * Market tomoni: market va uning operatori (market_operator). Ikkalasi bitta market nomidan ishlaydi —
 * boshqa marketlar ma'lumoti ularga ko'rinmaydi (MO-2, MO-3, MH-1, CS shu yordamchiga tayanadi).
 */
export const isMarketSideRole = (role: unknown): boolean => {
  const normalized = normalizeRole(role);
  return normalized === "market" || normalized === "market_operator";
};

/**
 * Rol personasi — maket `design/kit/roles.json` → `persona` (testda solishtiriladi):
 *   - `scanner` — yuqori paneldagi «Skanerlash» va pastki menyudagi «Skaner» (`persona.scan`);
 *   - `globalSearch` — yuqori paneldagi qidiruv, telefondagi qidiruv ekrani, Ctrl K va menyu varaqasidagi qidiruv.
 *     Investorda yo'q (ega qarori 2026-10-19: investor kabineti — faqat o'z investitsiyasi; maket
 *     `investor-dashboard-mobile-menu` da qidiruv maydoni yo'q). Logistda bor (`persona.search: true`, ega LG-S2).
 *
 * Maketda yo'q (eski yoki menyusiz) rol — skanersiz va qidiruvsiz: ularning bo'limi yo'q, qidiruv natijasi
 * ham ochilmaydigan sahifaga olib boradi.
 */
type RolePersona = { scanner: boolean; globalSearch: boolean };

export const ROLE_PERSONA: Readonly<Record<string, RolePersona>> = {
  superadmin: { scanner: true, globalSearch: true },
  admin: { scanner: true, globalSearch: true },
  manager: { scanner: true, globalSearch: true },
  registrator: { scanner: true, globalSearch: true },
  courier: { scanner: true, globalSearch: true },
  market: { scanner: false, globalSearch: true },
  market_operator: { scanner: false, globalSearch: true },
  logist: { scanner: false, globalSearch: true },
  investor: { scanner: false, globalSearch: false },
};

const personaOf = (role: unknown): RolePersona | undefined => {
  const normalized = normalizeRole(role);
  return Object.prototype.hasOwnProperty.call(ROLE_PERSONA, normalized) ? ROLE_PERSONA[normalized] : undefined;
};

/** Rolda skaner bormi (yuqori panel «Skanerlash», pastki menyu «Skaner»). */
export const roleHasScanner = (role: unknown): boolean => personaOf(role)?.scanner ?? false;

/** Rolda global qidiruv bormi (yuqori panel, qidiruv ekrani, Ctrl K, menyu varaqasi). */
export const roleHasGlobalSearch = (role: unknown): boolean => personaOf(role)?.globalSearch ?? false;
