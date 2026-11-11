import type { UserRole } from "../../../entities/user/types/user";

/**
 * Rol tablari. Superadmin/admin — 9 ta, ega tartibi FY-S1 (maket `superadmin-users-list-roles`): avval xodimlar,
 * keyin tashqi hisoblar. Eski «Operatorlar» tabi olindi (backend `GET /users` da `operator` — eski rol). Menejer —
 * 4 ta (`manager-users-list`): o'z filiali xodimlari (`branch_users`) — «Hammasi · Kuryerlar · Ro'yxatchilar ·
 * Menejerlar» (shu filial menejerlari, o'zi ham). `""` — «Hammasi». `satisfies`: backend `Roles` da yo'q rol tabga
 * kirmaydi.
 *
 * «Marketlar» menejerda (ega, 2026-11-12: «Qabul va aralash managerlar market yarata olsin va o'zi yaratgan
 * marketlarni foydalanuvchilar ro'yxatida ko'rib tursin»): faqat market yarata oladigan «Qabul punkti» (PICKUP) va
 * «Aralash» (HYBRID) filial menejerida — backend `GET /users` menejerga o'zi yaratgan marketlarni ham qaytaradi
 * (`created_by`), tafsilot (`GET /users/:id`) ham ochiladi. 2026-11-04 da olingan edi (o'shanda 403 edi).
 */
export const STAFF_ROLES = ["admin", "manager", "registrator", "courier", "logist"] as const satisfies readonly UserRole[];
export const EXTERNAL_ROLES = ["market", "market_operator", "investor"] as const satisfies readonly UserRole[];
export const STAFF_TABS = ["", ...STAFF_ROLES, ...EXTERNAL_ROLES] as const;
export const MANAGER_TABS = ["", "courier", "registrator", "manager"] as const;
export const MANAGER_MARKET_TABS = [...MANAGER_TABS, "market"] as const;

/** Market yarata oladigan menejer filial turlari (backend `POST /markets` bilan bir xil). */
export const MARKET_CREATOR_BRANCH_TYPES: ReadonlySet<string> = new Set(["PICKUP", "HYBRID"]);

/** Menejer tablari: PICKUP/HYBRID — «Marketlar» bilan, boshqa turlar (va noma'lum) — o'z filiali xodimlari. */
export const getManagerTabs = (branchType: string | null | undefined): readonly string[] =>
  branchType && MARKET_CREATOR_BRANCH_TYPES.has(branchType) ? MANAGER_MARKET_TABS : MANAGER_TABS;
