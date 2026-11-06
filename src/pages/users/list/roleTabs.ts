import type { UserRole } from "../../../entities/user/types/user";

/**
 * Rol tablari. Superadmin/admin — 9 ta, ega tartibi FY-S1 (maket `superadmin-users-list-roles`): avval xodimlar,
 * keyin tashqi hisoblar. Eski «Operatorlar» tabi olindi (backend `GET /users` da `operator` — eski rol). Menejer —
 * 4 ta (`manager-users-list`): faqat o'z filiali xodimlari (`branch_users`) — «Marketlar» olindi (ega, 2026-11-04:
 * marketning filialga bog'i yo'q, menejer uning tafsilotini baribir ocholmaydi — 403), o'rniga «Menejerlar» (shu
 * filial menejerlari, o'zi ham). `""` — «Hammasi». `satisfies`: backend `Roles` da yo'q rol tabga kirmaydi.
 */
export const STAFF_ROLES = ["admin", "manager", "registrator", "courier", "logist"] as const satisfies readonly UserRole[];
export const EXTERNAL_ROLES = ["market", "market_operator", "investor"] as const satisfies readonly UserRole[];
export const STAFF_TABS = ["", ...STAFF_ROLES, ...EXTERNAL_ROLES] as const;
export const MANAGER_TABS = ["", "courier", "registrator", "manager"] as const;
