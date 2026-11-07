// Aniq fayllardan (barrel emas): bu modul ilovaning boshlang'ich faylida — barrel u yerga barcha primitivlarni tortardi.
import { ConfirmHost } from "../../shared/ui/primitives/ConfirmHost";
import { Toaster } from "../../shared/ui/primitives/Toaster";

/**
 * DIZAYN v2 GLOBAL QATLAMLARI — ilovada BIR MARTA (`app/lib/provider.tsx`).
 *
 *   ConfirmHost — `useConfirm()` tasdiqlash oynalari (`overlay` qatlami, 1200);
 *   Toaster     — `notify()` xabarlari (`toast` qatlami, 1300).
 *
 * Router, i18n, mavzu va so'rovlar provayderlari ICHIDA, lekin `AuthBootstrap` va ilova yuklovchisidan
 * (`GlobalLoader`) TASHQARIDA: kirish sahifasida va ilova yuklanayotganda ham xabar ko'rinadi.
 * Ikkalasi ham `#ui-portal` ga portal qiladi — joylashuvi DOM'da ahamiyatsiz.
 */
export const UiHost = () => (
  <>
    <ConfirmHost />
    <Toaster />
  </>
);

export default UiHost;
