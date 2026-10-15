/**
 * Yuqori paneldagi profil tugmasi va profil menyusi uchun foydalanuvchi ma'lumoti
 * (maket `.el-user` / `.el-avatar`, taxta `tizim-states-navigation` → «Yuqori panel»).
 *
 * Avatar — ism-familiya bosh harflari (maket: «SE»), rol ikonkasi emas.
 * Rol qatori — rol nomi, filial biriktirilgan bo'lsa « · <filial nomi>» (maket: «Menejer · Urgut filiali»).
 * Filial nomi `my-profile` javobidagi `branch` (filial biriktiruvi) dan olinadi; yo'q bo'lsa faqat rol.
 */

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const asText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/** «Shodiyor Ergashev» → «SE», «Baraka» → «BA», bo'sh → «?». */
export const getInitials = (name: string | null | undefined): string => {
  const words = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  const letters =
    words.length === 1 ? Array.from(words[0]).slice(0, 2) : [Array.from(words[0])[0], Array.from(words[1])[0]];
  return letters.join("").toLocaleUpperCase();
};

/** Profilga biriktirilgan filial nomi (`branch.branch.name` yoki `branch.name`), bo'lmasa `null`. */
export const readBranchName = (user: unknown): string | null => {
  const branch = asRecord(asRecord(user)?.branch);
  if (!branch) return null;
  return asText(asRecord(branch.branch)?.name) ?? asText(branch.name) ?? asText(branch.branch_name);
};

/** Profil ismi: `fullName` → `full_name` → `name` → zaxira (rol slice'idagi ism). */
export const readDisplayName = (user: unknown, fallback?: string | null): string | null => {
  const record = asRecord(user);
  return (
    asText(record?.fullName) ??
    asText(record?.full_name) ??
    asText(record?.name) ??
    asText(fallback) ??
    null
  );
};

/**
 * Yuqori paneldagi rol qatorida filial ko'rsatiladigan rollar — maket personalari (`design/kit/roles.json`):
 * «Menejer · Urgut filiali», «Ro'yxatchi · Toshkent HQ»; kuryer, admin, superadmin — faqat rol.
 * Profil menyusi sarlavhasida esa filial biriktirilgan har rolda ko'rsatiladi («Superadmin · Toshkent HQ»).
 */
export const TOPBAR_BRANCH_ROLES: ReadonlySet<string> = new Set(["manager", "registrator"]);

/** «Menejer» + «Urgut filiali» → «Menejer · Urgut filiali». */
export const joinRoleAndBranch = (roleLabel: string, branchName: string | null): string =>
  branchName ? `${roleLabel} · ${branchName}` : roleLabel;
