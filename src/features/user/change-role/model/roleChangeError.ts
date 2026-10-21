import { getErrorKind, getErrorStatus } from "../../../../shared/lib/errorKind";

/**
 * `PATCH /users/:id/role` xatosi → oyna ichidagi ogohlantirish turi (backend matni ko'rsatilmaydi — unda texnik yo'l
 * bor: «DELETE /branches/…»):
 *   - `assigned` — 409: foydalanuvchi filialga biriktirilgan (filial nomi — backend kGIjOciz dan keyin, FY-4);
 *   - `retry`    — 503 (biriktiruv tekshirilmadi / logist viloyatlari bo'shatilmadi), boshqa 5xx, vaqt chegarasi
 *                  yoki tarmoq: rol o'zgarmagan, «Qayta urinish»;
 *   - `failed`   — qolgani (400 — rol ro'yxatda yo'q yoki allaqachon shu rolda, 403, 404).
 */
export type RoleChangeErrorKind = "assigned" | "retry" | "failed";

export const classifyRoleChangeError = (error: unknown): RoleChangeErrorKind => {
  if (getErrorStatus(error) === 409) return "assigned";
  const kind = getErrorKind(error);
  if (kind === "server" || kind === "timeout" || kind === "offline") return "retry";
  return "failed";
};
