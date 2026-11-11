import type { ExtraCostApproval } from "../../../entities/orders";
import { isDeferredExtraCost } from "../../../entities/orders/extraCostRequest";

/**
 * Market qarori matnlari (`dashboard` nomlar fazosi kalitlari, prefikssiz) — so'rov rejimiga qarab (SPEC v2):
 *  - `deferred` — buyurtma allaqachon sotilgan / qisman sotilgan / bekor qilingan: tasdiq xarajatni yozadi (amal
 *    qayta bajarilmaydi; marketga to'langani yetsa backend buyurtmani `paid` ga o'tkazadi — shuning uchun tasdiq
 *    oynasida «holati o'zgarmaydi» YO'Q), rad etilsa xarajat yozilmaydi, buyurtma holati o'zgarmaydi;
 *  - `replay` (eski so'rov, rejim kelmagan javob ham) — tasdiqlansa so'ralgan amal bajariladi.
 * Market dashboardi (`ExtraCostApprovals`, `ExtraCostRejectDialog`) va «Qo'shimcha xarajatli buyurtmalar» sahifasi
 * bir xil kalitlardan foydalanadi. Kechiktirilgan matnlarda `{{amount}}` — so'ralgan summa.
 */

type DecisionSubject = Pick<ExtraCostApproval, "action" | "mode">;

const ACTIONS: readonly ExtraCostApproval["action"][] = ["sell", "partly_sell", "cancel"];

const actionOf = (approval: DecisionSubject): ExtraCostApproval["action"] =>
  ACTIONS.includes(approval.action) ? approval.action : "sell";

/** «Tasdiqlansa — buyurtma sotiladi» / «Buyurtma allaqachon sotilgan. Tasdiqlansa — 20 000 so'm xarajat yoziladi». */
export const extraCostConsequenceKey = (approval: DecisionSubject): string =>
  isDeferredExtraCost(approval)
    ? `market.extra_cost_on_approve_deferred_${actionOf(approval)}`
    : `market.extra_cost_on_approve_${actionOf(approval)}`;

/** Tasdiq oynasining izohi. */
export const extraCostConfirmDescriptionKey = (approval: DecisionSubject): string =>
  isDeferredExtraCost(approval)
    ? "market.extra_cost_confirm_description_deferred"
    : "market.extra_cost_confirm_description";

/** Rad etish oynasidagi eslatma. */
export const extraCostRejectNoteKey = (approval: DecisionSubject): string =>
  isDeferredExtraCost(approval)
    ? "market.extra_cost_reject_note_deferred"
    : "market.extra_cost_reject_note";
