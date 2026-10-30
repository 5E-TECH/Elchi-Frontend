import { useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import type { RootState } from "../config/store";
import { logoutAndRedirect, refreshAccessToken } from "../../auth/authService";
import {
  clearPasswordChangeFlag,
  dismissPasswordChangePrompt,
  isPasswordChangePromptOpen,
  usePasswordChangeForced,
} from "../../auth/passwordChange";
import { ChangePasswordDialog } from "../../pages/profile/ui/ChangePasswordDialog";

/**
 * `PATCH /auth/my-profile { old_password, password }` (`ChangePasswordDialog`) → `POST /auth/refresh` (yangi token
 * bayroqsiz — `pwd_change` / `pwd_forced` yo'q) → bayroq tozalanadi. Refresh yiqilsa ham parol almashgan — bayroq
 * baribir tozalanadi (keyingi refresh `false` beradi).
 *
 * aidsxJ2H — majburiy rejim (`pwd_forced` / 403 `PASSWORD_CHANGE_REQUIRED`): oyna bloklovchi, «Keyinroq» o'rniga
 * «Chiqish»; saqlangach 403 bilan yiqilgan so'rovlar qayta so'raladi (sahifa o'zi to'ladi).
 */
const PasswordChangePromptDialog = () => {
  const profile = useSelector((state: RootState) => state.user.user);
  const fallbackName = useSelector((state: RootState) => state.role.name);
  const forced = usePasswordChangeForced();
  const queryClient = useQueryClient();

  const onChanged = async () => {
    try {
      await refreshAccessToken();
    } catch {
      // Token keyingi so'rovda o'zi yangilanadi.
    }
    clearPasswordChangeFlag();
    if (forced) void queryClient.invalidateQueries();
  };

  return (
    <ChangePasswordDialog
      open
      variant="required"
      forced={forced}
      name={profile?.name ?? fallbackName ?? ""}
      phone={profile?.phone_number}
      // Saqlangach bayroq allaqachon tozalangan — «Keyinroq» faqat oyna hali ochiq bo'lsa (yopish / Esc).
      onClose={() => {
        if (isPasswordChangePromptOpen()) dismissPasswordChangePrompt();
      }}
      onSignOut={() => logoutAndRedirect()}
      onChanged={onChanged}
    />
  );
};

export default PasswordChangePromptDialog;
