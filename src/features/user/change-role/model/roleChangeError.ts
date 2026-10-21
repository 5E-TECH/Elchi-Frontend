import { getErrorKind, getErrorStatus } from "../../../../shared/lib/errorKind";

/**
 * `PATCH /users/:id/role` xatosi → oyna ichidagi ogohlantirish turi (backend matni ko'rsatilmaydi — unda texnik yo'l
 * bor: «DELETE /branches/…»):
 *   - `assigned` — 409: foydalanuvchi filialga biriktirilgan (filial nomi — backend kGIjOciz dan keyin, FY-4);
 *   - `retry`    — 503 (biriktiruv tekshirilmadi / logist viloyatlari bo'shatilmadi) va boshqa 5xx: rol o'zgarmagan,
 *                  «Qayta urinish»;
 *   - `unknown`  — vaqt chegarasi yoki tarmoq: javob kelmadi, rol o'zgargan-o'zgarmagani noma'lum («Qayta urinish»;
 *                  foydalanuvchi keshi yangilanadi — o'zgargan bo'lsa, qayta urinishda rol qayta yuborilmaydi);
 *   - `failed`   — qolgani (400 — rol ro'yxatda yo'q yoki allaqachon shu rolda, 403, 404).
 */
export type RoleChangeErrorKind = "assigned" | "retry" | "unknown" | "failed";

/** «Qayta urinish» tugmasi bor turlar (natija vaqtinchalik xato yoki noma'lum). */
export const isRetryableRoleChangeError = (kind: RoleChangeErrorKind | null): boolean =>
  kind === "retry" || kind === "unknown";

export const classifyRoleChangeError = (error: unknown): RoleChangeErrorKind => {
  if (getErrorStatus(error) === 409) return "assigned";
  const kind = getErrorKind(error);
  if (kind === "server") return "retry";
  if (kind === "timeout" || kind === "offline") return "unknown";
  return "failed";
};
