/**
 * Dashboard sarlavhasi uchun profil ma'lumoti (`auth/my-profile` → `state.user.user`): filial va market nomi.
 * Shell'dagi `widgets/header/model/userIdentity.ts` bilan bir xil qoida (u widget — bu yerga import qilinmaydi).
 */
const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const asText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/** Profilga biriktirilgan filial nomi (`branch.branch.name` → `branch.name` → `branch.branch_name`). */
export const readProfileBranchName = (user: unknown): string | null => {
  const branch = asRecord(asRecord(user)?.branch);
  if (!branch) return asText(asRecord(user)?.branch_name);
  return asText(asRecord(branch.branch)?.name) ?? asText(branch.name) ?? asText(branch.branch_name);
};

/** Profil nomi (market — market nomi): `fullName` → `full_name` → `name`. */
export const readProfileName = (user: unknown): string | null => {
  const record = asRecord(user);
  return asText(record?.fullName) ?? asText(record?.full_name) ?? asText(record?.name);
};

/** Jarayonda = qabul qilingan − sotilgan − bekor qilingan (manfiy bo'lsa 0). */
export const inProgressCount = (accepted: number, sold: number, cancelled: number): number =>
  Math.max(0, accepted - sold - cancelled);
