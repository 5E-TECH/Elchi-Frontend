type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === "object" ? (value as UnknownRecord) : null;

const asText = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

export interface ViewerBranch {
  /** Filial id (`""` — biriktirilmagan). */
  id: string;
  name: string | null;
  /** `HQ` · `REGIONAL` · `HYBRID` · `PICKUP` (katta harf) yoki `null`. */
  type: string | null;
  regionId: string;
  regionName: string | null;
}

/**
 * Kirgan foydalanuvchining (odatda menejer) filiali — profil javobidagi `branch` (ichma-ich `branch.branch`
 * ham), `branch_id`/`branch_type`, `region`. Avvalgi `CreateUserForm` dagi o'qish tartibi AYNAN saqlangan
 * (id, tur, hudud id); qo'shimcha — filial va hudud nomi (sarlavha va «Biriktirish» kartasi uchun).
 */
export const readViewerBranch = (user: unknown): ViewerBranch => {
  const root = asRecord(user);
  const branch = asRecord(root?.branch);
  const nested = asRecord(branch?.branch);
  const rootRegion = asRecord(root?.region);
  const nestedRegion = asRecord(nested?.region);
  const branchRegion = asRecord(branch?.region);

  const type = (
    asText(nested?.type) ??
    asText(nested?.branch_type) ??
    asText(branch?.type) ??
    asText(branch?.branch_type) ??
    asText(root?.branch_type) ??
    ""
  ).toUpperCase();

  return {
    id: asText(nested?.id) ?? asText(branch?.id) ?? asText(root?.branch_id) ?? "",
    name: asText(nested?.name) ?? asText(branch?.name) ?? asText(branch?.branch_name),
    type: type || null,
    regionId:
      asText(root?.region_id) ??
      asText(rootRegion?.id) ??
      asText(nested?.region_id) ??
      asText(nested?.regionId) ??
      asText(nestedRegion?.id) ??
      asText(branch?.region_id) ??
      asText(branch?.regionId) ??
      asText(branchRegion?.id) ??
      "",
    regionName: asText(rootRegion?.name) ?? asText(nestedRegion?.name) ?? asText(branchRegion?.name),
  };
};
