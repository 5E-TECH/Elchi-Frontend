import type { User } from "../../../entities/user/types/user";

/** Maoshli xodim rollari (eski `UserStatsCard`: `isAdmin` — admin, menejer, ro'yxatchi, superadmin). */
const SALARY_ROLES = new Set(["admin", "manager", "registrator", "superadmin"]);

/** «Shodiyor Ergashev» → «SE», «Baraka» → «BA», bo'sh → «?». */
export const profileInitials = (name: string | null | undefined): string => {
  const words = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  const letters =
    words.length === 1
      ? Array.from(words[0]).slice(0, 2)
      : [Array.from(words[0])[0], Array.from(words[1])[0]];
  return letters.join("").toLocaleUpperCase();
};

/** Profilga biriktirilgan filial nomi (`my-profile` → `branch.branch.name`), bo'lmasa `null`. */
export const readProfileBranchName = (user: unknown): string | null => {
  const branch = (user as { branch?: unknown } | null)?.branch;
  if (!branch || typeof branch !== "object") return null;
  const record = branch as { name?: unknown; branch?: { name?: unknown } | null };
  const name = record.branch?.name ?? record.name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
};

/** «Oylik maosh» kartasi faqat maoshli xodim rolida va `salary > 0` bo'lsa (eski `UserStatsCard` qoidasi). */
export const hasProfileSalary = (user: User): boolean =>
  SALARY_ROLES.has(String(user.role)) && Number(user.salary ?? 0) > 0;
