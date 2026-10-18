import type { TFunction } from "i18next";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { notify } from "../../../shared/lib/notify";

export interface UserRequestOptions<T> {
  request: () => Promise<T>;
  /** Muvaffaqiyat xabarining tavsifi («Admin yaratish», «"Ali" muvaffaqiyatli yangilandi!»). */
  successMessage: string;
  /** Backend matni bo'lmasa — xato tavsifi. */
  errorMessage?: string;
  onSuccess?: (data: T) => void;
  onError?: (error: unknown) => void;
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
  t,
}: UserRequestOptions<T>): Promise<T | undefined> => {
  let data: T;
  try {
    data = await request();
  } catch (error) {
    notify.error(t("error", { ns: "common" }), {
      description: getBackendErrorMessage(error) ?? errorMessage ?? t("serverRequestError", { ns: "common" }),
    });
    onError?.(error);
    return undefined;
  }
  notify.success(t("success", { ns: "common" }), { description: successMessage });
  onSuccess?.(data);
  return data;
};
