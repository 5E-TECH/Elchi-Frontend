import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getErrorKind, getErrorStatus } from "../../../shared/lib/errorKind";

/**
 * OPS sahifalari — rad etilgan so'rov matni (Trello LJt0G1y1): foydalanuvchiga faqat o'z (i18n) matnimiz,
 * backend xabari (`response.data.message` — ko'pincha inglizcha class-validator matni) hech qachon chiqmaydi.
 *
 *  - ro'yxat (`ErrorState` izohi): turga qarab `ui:states.error.*` — «Server xatosi (500)…», «So'rov bajarilmadi (400).»;
 *  - amal (`action: true`, `OpsAlert` matni): 400/422 — «Ma'lumot qabul qilinmadi», 404 — «Topilmadi», 409 —
 *    «Holat allaqachon o'zgargan», 403 — «Bu amal rolingiz uchun ochilmagan»; qolgani ro'yxatdagidek.
 *    Sahifaga xos holat xatosi (masalan filial paketi 400 = paket holati) — sahifa o'zi alohida kalit bilan.
 */
export const useOpsErrorText = () => {
  const { t } = useTranslation(["ops", "ui"]);

  return useCallback(
    (error: unknown, options: { action?: boolean } = {}): string => {
      const kind = getErrorKind(error);
      const status = getErrorStatus(error);
      if (options.action && status != null) {
        if (status === 400 || status === 422) return t("ops:common.requestError.badRequest", { status });
        if (status === 404) return t("ops:common.requestError.notFound");
        if (status === 409) return t("ops:common.requestError.conflict");
        // 403 amalda — ro'yxat blokidagi «sahifaning qolgan qismidan foydalanishingiz mumkin» matni mos emas.
        if (status === 403) return t("ops:common.requestError.forbidden");
      }
      switch (kind) {
        case "server":
          return status != null
            ? t("ui:states.error.server.description", { status })
            : t("ui:states.error.timeout.description");
        case "generic":
          return status != null
            ? t("ui:states.error.generic.description", { status })
            : t("ui:states.error.generic.descriptionNoStatus");
        default:
          return t(`ui:states.error.${kind}.description`);
      }
    },
    [t],
  );
};
