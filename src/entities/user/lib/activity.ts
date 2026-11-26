import type { User, UserRole } from "../types/user";

/**
 * pe71yf8L: «Oxirgi kirish» va «Online / Offline» qaysi rollarda — market akkaunti va market operatori (har biri O'Z
 * akkaunti: operator market qatoriga qo'shilmaydi). Backend shu rollarning `GET /users` / `GET /users/:id`
 * qatorlariga `is_online`, `last_login_at`, `last_seen_at` qo'shadi; xodimlarda kalit yo'q.
 */
export const ACTIVITY_ROLES: ReadonlySet<UserRole> = new Set<UserRole>(["market", "market_operator"]);

export const isActivityRole = (role: string | null | undefined): boolean =>
  Boolean(role) && ACTIVITY_ROLES.has(role as UserRole);

/** Faollik ro'yxat / tafsilot shu oraliqda yangilanadi (market tablarida va market tafsilotida). */
export const ACTIVITY_REFETCH_MS = 60_000;

/** Qatorda faollik ma'lumoti bormi (eski backend yoki xodim qatori — yo'q). */
export const hasActivity = (user: Pick<User, "role" | "is_online">): boolean =>
  isActivityRole(user.role) && typeof user.is_online === "boolean";

const time = (value: string | null | undefined) => {
  if (!value) return Number.NaN;
  return new Date(value).getTime();
};

/**
 * Oxirgi faollik lahzasi: `last_seen_at` va `last_login_at` ning kechrog'i (ISO). Ikkalasi ham bo'sh — `null`
 * (hech kirmagan); faollik xizmati javob bermagan (kalitlar yo'q) — `undefined`.
 */
export const lastActivityAt = (user: Pick<User, "last_seen_at" | "last_login_at">): string | null | undefined => {
  if (user.last_seen_at === undefined && user.last_login_at === undefined) return undefined;
  const seen = time(user.last_seen_at);
  const login = time(user.last_login_at);
  if (Number.isNaN(seen) && Number.isNaN(login)) return null;
  if (Number.isNaN(login) || seen >= login) return user.last_seen_at ?? null;
  return user.last_login_at ?? null;
};
