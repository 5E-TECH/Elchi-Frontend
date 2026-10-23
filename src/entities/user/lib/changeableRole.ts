import type { ChangeableUserRole } from "../types/user";

/**
 * K3scaE0W — rolni o'zgartirish mumkin bo'lgan rollar, ko'rsatish tartibida (maket `superadmin-users-edit-role`:
 * Admin · Menejer · Ro'yxatchi · Logist). Backend `GET /roles` → `changeable_roles` bilan kesishtiriladi; katalog
 * kelmasa (yuklanmoqda / xato) — shu ro'yxat (backend baribir o'zi tekshiradi: boshqasi 400).
 */
export const CHANGEABLE_USER_ROLES: readonly ChangeableUserRole[] = Object.freeze([
  "admin",
  "manager",
  "registrator",
  "logist",
]);

export const isChangeableUserRole = (role: unknown): role is ChangeableUserRole =>
  typeof role === "string" && (CHANGEABLE_USER_ROLES as readonly string[]).includes(role);
