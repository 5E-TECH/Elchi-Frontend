import { useCallback, useState } from "react";
import { getActionErrorMessage } from "../../shared/lib/actionError";

/**
 * Sotish, qisman sotish va bekor qilish rad etilsa sabab OYNA ICHIDA (2KisY7DL): toast oyna ortida qolib, oynani
 * yopmaguncha o'qilmasdi. Oyna ochiq qoladi — foydalanuvchi tuzatib qayta yuboradi. Javob kelmagan tarmoq xatosi
 * (`null`) oynada chiqmaydi: global «Tarmoq xatosi» bildirishnomasi uni allaqachon ko'rsatgan.
 */
export const useActionDialogError = (fallback: string) => {
  const [message, setMessage] = useState<string | null>(null);
  const show = useCallback(
    (error: unknown) => setMessage(getActionErrorMessage(error, fallback)),
    [fallback],
  );
  const clear = useCallback(() => setMessage(null), []);
  return { message, show, clear };
};
