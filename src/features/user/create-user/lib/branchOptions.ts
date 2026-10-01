import type { Branch } from "../../../../entities/branch";

/** Filial HQ (bosh ofis) turidami. */
export const isHqBranch = (branch: Pick<Branch, "type"> | null | undefined): boolean =>
  String(branch?.type ?? "").toUpperCase() === "HQ";

/** Avvalgi tartib: avval `level`, keyin nom bo'yicha. */
const compareBranches = (left: Branch, right: Branch) => {
  const leftLevel = left.level ?? 0;
  const rightLevel = right.level ?? 0;

  if (leftLevel !== rightLevel) return leftLevel - rightLevel;
  return left.name.localeCompare(right.name);
};

/**
 * Foydalanuvchi yaratish formasidagi filial ro'yxati — rolga qarab.
 *
 * - Nofaol filiallar hech qaysi rolda chiqmaydi (avvalgidek).
 * - `manager`: HQ (bosh ofis) ro'yxatdan OLIB TASHLANADI — HQ da menejer
 *   bo'lmaydi, HQ ishlarini superadmin, admin va registratorlar bajaradi.
 *   Backend ham rad etadi (POST /managers → 400).
 * - `registrator`: HQ QOLADI — HQ registratorlari kerak.
 */
export const getBranchOptionsForRole = (
  branches: readonly Branch[] | null | undefined,
  role: string | null | undefined,
): Branch[] =>
  (branches ?? [])
    .filter((branch) => branch.status !== "inactive")
    .filter((branch) => role !== "manager" || !isHqBranch(branch))
    .sort(compareBranches);

/**
 * Himoya: menejer uchun HQ filiali tanlanganmi.
 *
 * Ro'yxatda HQ ko'rsatilmaydi, lekin qiymat boshqa yo'l bilan kelib qolsa
 * (masalan filial ro'yxati yangilanib, turi o'zgarsa) forma uni yubormaydi.
 */
export const isManagerHqSelection = (
  branches: readonly Branch[] | null | undefined,
  role: string | null | undefined,
  branchId: string | null | undefined,
): boolean => {
  if (role !== "manager" || !branchId) return false;
  const selected = (branches ?? []).find((branch) => String(branch.id) === String(branchId));
  return isHqBranch(selected);
};
