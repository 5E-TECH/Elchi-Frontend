// dizayn-v2: (maket yo'q) tizim-feedback
import { FlaskConical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { Portal, TONE_SOLID } from "../../../shared/ui/primitives";
import { STAGING_NAMESPACE } from "../model/locales";

/**
 * «TEST MUHIT» BELGISI — faqat staging build'ida (test-admin.elchipochta.uz, `VITE_APP_ENV=staging`).
 * Maket yo'q — eng yaqini `tizim-feedback` (ogohlantirish toni) va `Badge` (solid, `sm`) retsepti.
 *
 *  - Ekran tepasida ingichka (4px) ogohlantirish chizig'i + o'rtada osilib turgan «TEST muhit» yorlig'i
 *    (20px, 12px matn, `FlaskConical` — ikonka katalogida «Sinov rejimi»). Yuqori panel o'rtasida: telefonda bo'sh
 *    oraliq ustida, desktopda qidiruv maydonining o'ng chekkasiga biroz tegadi (tugmalarni yopmaydi); kirish
 *    sahifasida ham, skaner qobig'ida ham ko'rinadi.
 *  - Hech narsani to'smaydi: `pointer-events-none` (bosish ostidagi elementga o'tadi), fokus olmaydi, sahifani
 *    surmaydi (shell'ga tegilmaydi). Qatlam — `toast` (1300, `tizim-motion` 08: «bosishni to'smaydi»), dialog
 *    fonidan ham yuqorida — TEST sayt ekanligi hech qachon yashirinmaydi.
 *  - Ranglar faqat tokenlardan (`TONE_SOLID.warning` — ikkala mavzuda AA), kunduzgi/tungi o'zi.
 */
export const StagingBanner = () => {
  const { t } = useTranslation(STAGING_NAMESPACE, { useSuspense: false });

  return (
    <Portal layer="toast">
      <div
        data-staging-banner=""
        role="note"
        aria-label={t("description")}
        className="pointer-events-none fixed inset-x-0 top-0 flex flex-col items-center"
      >
        <div aria-hidden="true" className={cx("h-1 w-full", TONE_SOLID.warning)} />
        <span
          className={cx(
            "inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-b-md px-2 text-xs font-semibold leading-none",
            TONE_SOLID.warning,
          )}
        >
          <FlaskConical size={14} aria-hidden="true" className="shrink-0" />
          {t("label")}
        </span>
      </div>
    </Portal>
  );
};
