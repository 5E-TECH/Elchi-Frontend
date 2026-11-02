import type { TFunction } from "i18next";
import { isNetworkFailure } from "../../../auth/networkError";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { notify } from "../../../shared/lib/notify";

export interface UserRequestOptions<T> {
  request: () => Promise<T>;
  /**
   * Muvaffaqiyat xabarining tavsifi («Admin yaratish», «"Ali" muvaffaqiyatli yangilandi!»). `null` — xabar yo'q
   * (natijani chaqiruvchi o'zi ko'rsatadi, masalan aidsxJ2H «Foydalanuvchi yaratildi» oynasi).
   */
  successMessage: string | null;
  /** Backend matni bo'lmasa — xato tavsifi. */
  errorMessage?: string;
  onSuccess?: (data: T) => void;
  onError?: (error: unknown) => void;
  /**
   * Xato tavsifini o'zi beradi (masalan kuryer tumani xatosi — DtKKY0V8: server matni o'rniga i18n matni).
   * `undefined` qaytarsa — odatiy tartib (backend matni → `errorMessage`).
   */
  describeError?: (error: unknown) => string | undefined;
  /** `common` nomlar fazosini o'qiy oladigan tarjimon (`useTranslation(["users", "common"])`). */
  t: TFunction;
}

/**
 * `useAppNotification().apiRequest` ning dizayn v2 o'rnini bosuvchisi (spec §0.1: `try/await` + `notify`).
 * Matnlar avvalgidek: muvaffaqiyat — «Muvaffaqiyatli» + `successMessage`; xato — «Xatolik» + backend matni,
 * bo'lmasa `errorMessage`, bo'lmasa «Serverda xatolik yuz berdi». Natija: ma'lumot yoki `undefined` (xato).
 */
export const runUserRequest = async <T>({
  request,
  successMessage,
  errorMessage,
  onSuccess,
  onError,
  describeError,
  t,
}: UserRequestOptions<T>): Promise<T | undefined> => {
  let data: T;
  try {
    data = await request();
  } catch (error) {
    // Javobsiz xato — interceptor bitta tarmoq xabarini ko'rsatgan, ikkinchi «Xatolik» chiqmaydi (G6F68ti6, 4-band).
    if (!isNetworkFailure(error)) {
      notify.error(t("error", { ns: "common" }), {
        description:
          describeError?.(error) ??
          getBackendErrorMessage(error) ??
          errorMessage ??
          t("serverRequestError", { ns: "common" }),
      });
    }
    onError?.(error);
    return undefined;
  }
  if (successMessage !== null) notify.success(t("success", { ns: "common" }), { description: successMessage });
  onSuccess?.(data);
  return data;
};
