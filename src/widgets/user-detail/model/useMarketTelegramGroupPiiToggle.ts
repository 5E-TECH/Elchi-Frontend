import { useState } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import type { RootState } from "../../../app/config/store";
import { useUser } from "../../../entities/user/api/userApi";
import type { User } from "../../../entities/user/types/user";
import { getActionErrorMessage } from "../../../shared/lib/actionError";
import { notify } from "../../../shared/lib/notify";

/**
 * Kalit xulqi (holat, kim o'zgartira oladi, PATCH + xabarlar) — bir joyda: `/profile` dagi alohida karta
 * (`MarketTelegramGroupPiiCard`, v2 `ProfilePage`) va v2 `/all-users/:id` dagi «Ruxsatlar»
 * kartasining qatori (`UserDetailView`) ikkalasi shuni ishlatadi — tahrir qoidalari aynan bir xil.
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
      notify.success(t("tgGroupPiiSaved"), {
        description: next ? t("tgGroupPiiShownDescription") : t("tgGroupPiiHiddenDescription"),
      });
    } catch (error) {
      setPending(null);
      // `null` — javob umuman kelmadi: tarmoq xatosini global xabar allaqachon ko'rsatgan.
      const message = getActionErrorMessage(error, t("tgGroupPiiSaveErrorDescription"));
      if (message !== null) notify.error(t("tgGroupPiiSaveError"), { description: message });
    }
  };

  return { checked, canEdit, isSaving, toggle };
};
