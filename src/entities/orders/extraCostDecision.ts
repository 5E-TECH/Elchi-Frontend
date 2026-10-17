import axios from "axios";
import { getBackendErrorMessage } from "../../shared/lib/backendError";

/**
 * Qo'shimcha xarajat so'rovi bo'yicha MARKET QARORI (DuST9k8j, 1tnpaIqd).
 *
 * Backend (`POST /orders/extra-cost-approvals/:id/approve|reject`):
 *  - qarorni faqat market EGASI (va admin/superadmin) qiladi — `market_operator` uchun tugmalar yo'q;
 *  - rad etish sababi YOPIQ ro'yxatdan (`reason`, boshqa qiymat → 400), izoh ixtiyoriy;
 *  - qaror atomik: so'rov boshqa joyda (Telegram ✅/❌, boshqa tab) hal qilingan bo'lsa
 *    400 «Bu so'rov allaqachon yakunlangan» (yoki 409) — bu xato emas, ro'yxat yangilanadi.
 */

export const EXTRA_COST_REJECT_REASONS = ["TOO_EXPENSIVE", "NOT_AGREED", "NO_PROOF", "DUPLICATE"] as const;
export type ExtraCostRejectReason = (typeof EXTRA_COST_REJECT_REASONS)[number];

/** Qaror qila oladigan rollar (backend `assertCanDecideExtraCostApproval`). */
const DECIDER_ROLES = new Set(["market", "admin", "superadmin"]);

export const canDecideExtraCost = (role: string | null | undefined): boolean =>
  DECIDER_ROLES.has(String(role ?? "").toLowerCase());

const ALREADY_DECIDED = /allaqachon yakunlangan|already (decided|finali[sz]ed|resolved)/i;

/** So'rov allaqachon hal qilingan (boshqa joyda qaror qilingan) — 409 yoki backend matni. */
export const isExtraCostAlreadyDecidedError = (error: unknown): boolean => {
  if (!axios.isAxiosError(error) || !error.response) return false;
  if (error.response.status === 409) return true;
  const message = getBackendErrorMessage({ response: error.response });
  return Boolean(message && ALREADY_DECIDED.test(message));
};
