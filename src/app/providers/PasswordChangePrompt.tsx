import { lazy, memo, Suspense } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../config/store";
import { usePasswordChangePrompt } from "../../auth/passwordChange";

// Oyna (va uning `userApi` bog'liqligi) faqat bayroq yoqilganda yuklanadi — kirish sahifasi va oddiy yuklanish og'irlashmaydi.
const PasswordChangePromptDialog = lazy(() => import("./PasswordChangePromptDialog"));

/**
 * NDmZMzCP «Yangi parol o'rnating»: login / refresh javobida `must_change_password: true` (yoki darvoza yoqilganda
 * `403 PASSWORD_CHANGE_REQUIRED`) — kirgan foydalanuvchiga parol almashtirish oynasi. Bloklamaydi: «Keyinroq» bilan
 * yopiladi (shu tab sessiyasida qayta chiqmaydi), ilovaning qolgan qismi ishlayveradi.
 */
const PasswordChangePrompt = () => {
  const open = usePasswordChangePrompt();
  const isAuthenticated = useSelector((state: RootState) => state.user.isAuthenticated);
  if (!open || !isAuthenticated) return null;
  return (
    <Suspense fallback={null}>
      <PasswordChangePromptDialog />
    </Suspense>
  );
};

export default memo(PasswordChangePrompt);
