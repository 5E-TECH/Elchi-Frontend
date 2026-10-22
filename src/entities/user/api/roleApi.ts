import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import { useQuery } from "@tanstack/react-query";
import { CHANGEABLE_USER_ROLES, isChangeableUserRole } from "../lib/changeableRole";
import type { ChangeableUserRole, RoleCatalog } from "../types/user";

type Raw = Record<string, unknown>;

const asRecord = (value: unknown): Raw | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Raw) : null;

/**
 * `GET /roles` → `{ statusCode, data: { items, changeable_roles } }` (yoki `data` siz). Faqat `changeable_roles`
 * olinadi — katalog yorliqlari va izohlari faqat o'zbekcha (nomlar i18n'dan). Noma'lum rol tashlab yuboriladi,
 * tartib — `CHANGEABLE_USER_ROLES` (maketdagidek). Massiv umuman kelmasa — `null` (chaqiruvchi zaxira ro'yxatni oladi).
 */
export const normalizeRoleCatalog = (payload: unknown): RoleCatalog | null => {
  const response = asRecord(payload);
  const data = asRecord(response?.data) ?? response;
  const raw = data?.changeable_roles;
  if (!Array.isArray(raw)) return null;
  const allowed = new Set(
    raw
      .map((role) => (typeof role === "string" ? role.trim().toLowerCase() : ""))
      .filter(isChangeableUserRole),
  );
  return { changeableRoles: CHANGEABLE_USER_ROLES.filter((role) => allowed.has(role)) };
};

export const fetchRoleCatalog = async (): Promise<RoleCatalog | null> => {
  const response = await api.get(API_ENDPOINTS.ROLES.BASE);
  return normalizeRoleCatalog(response.data);
};

/** `PATCH /users/:id/role` (faqat superadmin). Javob — yangilangan foydalanuvchi (`sanitize`). */
export const changeUserRole = async (id: string, role: ChangeableUserRole): Promise<unknown> => {
  const response = await api.patch(API_ENDPOINTS.USERS.ROLE(id), { role });
  return response.data;
};

/** Kalit shu entity ichida (`shared/config/queryKeys.ts` boshqa PR'lar egaligida). */
export const roleCatalogKey = ["role-catalog"] as const;

/**
 * Rol katalogi. Katalog backend konstantasi — kamdan-kam o'zgaradi (30 daqiqa yangi). Xato global xabar chiqarmaydi
 * (`silentError`): rol ro'yxati zaxira bilan ishlayveradi.
 */
export const useRoleCatalog = (options: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: roleCatalogKey,
    queryFn: fetchRoleCatalog,
    enabled: options.enabled ?? true,
    staleTime: 30 * 60 * 1000,
    retry: false,
    meta: { silentError: true },
  });
