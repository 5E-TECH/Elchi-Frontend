import { useTranslation } from "react-i18next";
import { getUserRoleLabelKey } from "../../user/lib/role";
import type { DispatchAudience } from "./types";

/**
 * «Kimga» va muallif roli matni — tafsilot oynasi va «Yuborilganlar» ro'yxati uchun bitta qoida:
 * hammaga — «Hamma»; rollar — «Rol: Kuryer, Market»; bitta id — «Bitta odam»; bir nechta — «Tanlangan ro'yxat»;
 * auditoriya yo'q (ro'yxat javobi, ega S2 — backend hali bermaydi) — `null` (chaqiruvchi «—» chizadi).
 */
export const useAudienceText = () => {
  const { t } = useTranslation("notifications");
  const { t: tUsers } = useTranslation("users");

  /** Backend roli (`"admin"`, `"courier,market"` — birinchisi) → «Admin». */
  const roleLabel = (role: string | null | undefined) => {
    const value = role?.split(",")[0]?.trim();
    return value ? tUsers(getUserRoleLabelKey(value)) : null;
  };

  const audienceText = (audience: DispatchAudience | null): string | null => {
    if (audience?.broadcast) return t("dispatch.detail.audienceAll");
    if (audience?.roles?.length) {
      return t("dispatch.detail.audienceRoles", { roles: audience.roles.map((role) => roleLabel(role)).join(", ") });
    }
    if (audience?.recipient_ids === 1) return t("dispatch.detail.audienceSingle");
    if (audience?.recipient_ids) return t("dispatch.detail.audienceList");
    return null;
  };

  return { roleLabel, audienceText };
};
