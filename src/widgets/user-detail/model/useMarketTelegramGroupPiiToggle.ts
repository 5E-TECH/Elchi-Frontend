import { useState } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import type { RootState } from "../../../app/config/store";
import { useUser } from "../../../entities/user/api/userApi";
import type { User } from "../../../entities/user/types/user";
import axios from "axios";
import { notify } from "../../../shared/lib/notify";

/**
 * «Guruhda mijoz ismi va telefoni» kaliti xulqi (ysBqD9Nx; holat, kim o'zgartira oladi, PATCH + xabarlar) —
 * «Telegram guruhi» kartasining qatori (`MarketTelegramGroupsCard`: `/all-users/:id` va market `/profile`, TG-B S3).
 * Darhol qaytariladigan ruxsat — tasdiqsiz (DESIGN_SYSTEM §8). Xato matni faqat i18n (backend matni chiqmaydi).
 *
 * O'zgartira oladi: superadmin, admin — istalgan market; market — faqat o'zi (backend boshqasiga 403).
 */
export const useMarketTelegramGroupPiiToggle = (user: User, isOwnProfile = false) => {
  const { t } = useTranslation("users");
  const viewer = useSelector((state: RootState) => state.role);
  const { updateMarketTelegramGroupPii } = useUser();

  const canEdit =
    viewer.role === "superadmin" ||
    viewer.role === "admin" ||
    (viewer.role === "market" && (isOwnProfile || String(viewer.id ?? "") === String(user.id)));

  // Backend sukuti `true`: maydon kelmasa (eski javob) ham yoqiq deb ko'rsatiladi.
  const serverValue = user.tg_group_show_customer_pii !== false;
  // Bosilgan qiymat server yangi qiymatni qaytarguncha ko'rinadi: `basis` — bosilgan paytdagi server
  // qiymati; so'rov yangilangach (server qiymati o'zgarsa) bu qatlam o'z-o'zidan e'tiborsiz qoladi.
  const [pending, setPending] = useState<{ value: boolean; basis: boolean } | null>(null);
  const checked = pending && pending.basis === serverValue ? pending.value : serverValue;
  const isSaving = updateMarketTelegramGroupPii.isPending;

  const toggle = async () => {
    if (!canEdit || isSaving) return;
    const next = !checked;
    setPending({ value: next, basis: serverValue });

    try {
      await updateMarketTelegramGroupPii.mutateAsync({
        id: String(user.id),
        tg_group_show_customer_pii: next,
      });
      notify.success(t("tgGroup.piiSaved"), {
        description: next ? t("tgGroup.piiShown") : t("tgGroup.piiHidden"),
      });
    } catch (error) {
      setPending(null);
      // Javob umuman kelmadi — tarmoq xatosini global xabar allaqachon ko'rsatgan.
      if (axios.isAxiosError(error) && !error.response && error.code !== "ERR_CANCELED") return;
      notify.error(t("tgGroup.piiSaveError"), { description: t("tgGroup.piiSaveErrorText") });
    }
  };

  return { checked, canEdit, isSaving, toggle };
};
