/**
 * Sessiya holati: `active` — qurilma kirgan; `expired` — qurilmada ochiq sessiya bor, lekin qayta kirishi kerak
 * (refresh muddati tugagan yoki parol almashgan; 90 kungacha saqlanadi). Eski backend maydonni bermasa — `active`.
 */
export type AccountSessionStatus = "active" | "expired";

/**
 * O'z hisobining sessiyasi — `GET /auth/sessions` qatori (Elchi Pochta #3). Bir nechta qurilmadan bir vaqtda
 * kirish mumkin; shu qurilmada ochiq sessiya bo'lsa, qayta kirish o'shani ishlatadi (ID o'zgarmaydi, kirgan vaqti
 * yangilanadi). Maydonlar backend nomlarida; bo'sh qiymat — `null`.
 */
export type AccountSession = {
  id: string;
  /**
   * Qurilma nomi — mijoz `X-Device-Name` («Samsung SM-A515F · Android 13 · Chrome 155») yoki server User-Agent'dan
   * («Telefon · Android · Chrome»); aniqlanmasa `null`.
   */
  device_name: string | null;
  /** Mijoz yuborgan barqaror qurilma ID si (`X-Device-Id`). */
  device_id: string | null;
  user_agent: string | null;
  ip: string | null;
  /** OXIRGI kirgan vaqti (ISO) — shu qurilmadan har qayta kirishda yangilanadi. */
  logged_in_at: string | null;
  /** Shu qurilmadan BIRINCHI kirgan vaqti (ISO); eski backend bermaydi — `null`. */
  first_logged_in_at: string | null;
  /** Oxirgi faollik (ISO) — har `/auth/refresh` da yangilanadi (ilova ochiq bo'lsa ≈ soatiga bir). */
  last_seen_at: string | null;
  /** Sessiya muddati (refresh token, ISO). */
  expires_at: string | null;
  /** So'rov shu sessiyaning tokeni bilan kelgan («Shu qurilma»). Telegram Mini App'da hech biri `true` emas. */
  current: boolean;
  status: AccountSessionStatus;
};

export type AccountSessionList = {
  /** FAQAT `active` sessiyalar soni (ro'yxat cheklangan bo'lsa ham to'liq son); `expired` sanalmaydi. */
  active_count: number;
  /** Sessiyalar: joriy, so'ng faollar, so'ng qayta kirishi kerak bo'lganlar (server tartibi). */
  sessions: AccountSession[];
  /**
   * Joriy sessiya BOSHQA sessiyalarni yopa oladimi (Telegram kabi qoida): shu qurilmadan BIRINCHI kirganiga 48 soat
   * to'lmagan sessiya boshqalarni chiqara olmaydi (`DELETE /auth/sessions/:id`, `POST …/revoke-others` → 403
   * `SESSION_TOO_NEW`). O'z «Chiqish» i cheklanmaydi. Eski backend maydonni bermaydi — `true` (bugungi xulq).
   */
  can_revoke_others: boolean;
  /** Qachondan boshlab mumkin bo'ladi (ISO); cheklov yo'q yoki noma'lum — `null`. */
  revoke_available_at: string | null;
};

/** Qurilma turi — server yorlig'ining birinchi bo'lagidan («Telefon», «Planshet», «Kompyuter»). */
export type SessionDeviceKind = "phone" | "tablet" | "desktop";

/**
 * Sessiyani yopish javobi — `DELETE /auth/sessions/:id` (`revoked: 1`) va `POST /auth/sessions/revoke-others`
 * (`revoked: n`, 0 bo'lishi mumkin): yopilgan sessiyalar soni va ID lari.
 */
export type RevokeSessionsResult = {
  revoked: number;
  session_ids: string[];
};

/**
 * 403 `SESSION_TOO_NEW` — yangi qurilmadan boshqa sessiyani yopishga urinish. `message` — backend matni («Xavfsizlik
 * uchun yangi qurilmadan boshqa sessiyalarni chiqarib bo'lmaydi — … dan keyin mumkin»), `available_at` — qachondan
 * mumkin (ISO); ikkalasi bo'lmasligi mumkin.
 */
export type SessionTooNewError = {
  message: string | null;
  available_at: string | null;
};
