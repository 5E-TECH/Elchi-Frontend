import { useSelector } from "react-redux";
import type { RootState } from "../config/store";
import { refreshAccessToken } from "../../auth/authService";
import {
  clearPasswordChangeFlag,
  dismissPasswordChangePrompt,
  isPasswordChangePromptOpen,
} from "../../auth/passwordChange";
import { ChangePasswordDialog } from "../../pages/profile/ui/ChangePasswordDialog";

/**
 * `PATCH /auth/my-profile { password }` (`ChangePasswordDialog`) → `POST /auth/refresh` (yangi token bayroqsiz) →
 * bayroq tozalanadi. Refresh yiqilsa ham parol almashgan — bayroq baribir tozalanadi (keyingi refresh `false` beradi).
 */
const PasswordChangePromptDialog = () => {
  const profile = useSelector((state: RootState) => state.user.user);
  const fallbackName = useSelector((state: RootState) => state.role.name);

  const onChanged = async () => {
    try {
      await refreshAccessToken();
    } catch {
      // Token keyingi so'rovda o'zi yangilanadi.
    }
    clearPasswordChangeFlag();
  };

  return (
    <ChangePasswordDialog
      open
      variant="required"
      name={profile?.name ?? fallbackName ?? ""}
      phone={profile?.phone_number}
      // Saqlangach bayroq allaqachon tozalangan — «Keyinroq» faqat oyna hali ochiq bo'lsa (yopish / Esc).
      onClose={() => {
        if (isPasswordChangePromptOpen()) dismissPasswordChangePrompt();
      }}
      onChanged={onChanged}
    />
  );
};

export default PasswordChangePromptDialog;
