import type { TFunction } from "i18next";
import { getErrorKind, getErrorStatus } from "../../../shared/lib/errorKind";

/**
 * Mahsulotni saqlash / o'chirish xatosining izohi — faqat i18n matn (xom backend `message` foydalanuvchiga
 * ko'rsatilmaydi). Tur bo'yicha: oflayn, vaqt chegarasi, 400 (ma'lumot noto'g'ri — masalan narx chegarasi yoki
 * rasm turi), 403, 404, 409 (shu marketda shu nomli mahsulot bor — catalog `ensureNameAvailable` / 23505;
 * qayta urinish yordam bermaydi, nomni o'zgartirish kerak), 5xx, qolgani — umumiy «qayta urinib ko'ring».
 */
export const describeProductError = (error: unknown, t: TFunction<"products">): string => {
  const kind = getErrorKind(error);
  if (kind === "offline") return t("states.error.offline.description", { ns: "ui" });
  if (kind === "timeout") return t("states.error.timeout.description", { ns: "ui" });
  if (kind === "forbidden") return t("v2.errors.forbidden");
  if (kind === "server") return t("v2.errors.server");
  const status = getErrorStatus(error);
  if (status === 400 || status === 413 || status === 422) return t("v2.errors.invalid");
  if (status === 404) return t("v2.errors.notFound");
  if (status === 409) return t("v2.errors.duplicateName");
  return t("states.error.generic.descriptionNoStatus", { ns: "ui" });
};

/** 409 — nom band (catalog servisidagi yagona 409 sababi): forma «Mahsulot nomi» maydonini qizil qiladi. */
export const isDuplicateNameError = (error: unknown): boolean => getErrorStatus(error) === 409;
