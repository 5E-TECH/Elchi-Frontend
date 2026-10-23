/**
 * O'z hisobining sessiyasi — `GET /auth/sessions` qatori (Elchi Pochta #3). Har login — alohida sessiya
 * (bir nechta qurilmadan bir vaqtda kirish mumkin). Maydonlar backend nomlarida; bo'sh qiymat — `null`.
 */
export type AccountSession = {
  id: string;
  /** "Telefon · Android · Chrome" — `X-Device-Name` yoki User-Agent'dan (server); aniqlanmasa `null`. */
  device_name: string | null;
  /** Mijoz yuborgan barqaror qurilma ID si (`X-Device-Id`). */
  device_id: string | null;
  user_agent: string | null;
  ip: string | null;
  /** Kirgan vaqti (ISO). */
  logged_in_at: string | null;
  /** Oxirgi faollik (ISO) — har `/auth/refresh` da yangilanadi (ilova ochiq bo'lsa ≈ soatiga bir). */
  last_seen_at: string | null;
  /** Sessiya muddati (refresh token, ISO). */
  expires_at: string | null;
  /** So'rov shu sessiyaning tokeni bilan kelgan («Shu qurilma»). Telegram Mini App'da hech biri `true` emas. */
  current: boolean;
};

export type AccountSessionList = {
  /** Barcha faol sessiyalar soni (ro'yxat 50 ta bilan cheklangan bo'lsa ham to'liq son). */
  active_count: number;
  /** Faol sessiyalar, oxirgi faollik bo'yicha yangisi tepada (ko'pi bilan 50). */
  sessions: AccountSession[];
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
