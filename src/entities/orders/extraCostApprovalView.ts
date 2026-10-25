import type { ExtraCostApproval } from "./index";

/**
 * Qo'shimcha xarajat so'rovining ko'rinadigan maydonlari (0Ngp09FG, backend 278f706): `order_number` — mijozga
 * ko'rinadigan raqam («EL-100076», yorliqdagi; ichki `order_id` emas), `requested_by.name` — so'rovchi ismi
 * (identity'dan; olinmasa yoki foydalanuvchi o'chirilgan bo'lsa `null`). Eski javobda maydonlar yo'q — zaxira.
 */

/** «EL-100076»; `order_number` yo'q — ichki `order_id`. Havola baribir `order_id` bo'yicha. */
export const extraCostOrderNumber = (approval: Pick<ExtraCostApproval, "order_id" | "order_number">): string =>
  approval.order_number?.trim().replace(/^[#№]\s*/u, "") || approval.order_id;

/** So'rovchi ismi yoki `null` (UI zaxirasi — `#user_id`). */
export const extraCostRequesterName = (
  approval: Pick<ExtraCostApproval, "requested_by">,
): string | null => approval.requested_by?.name?.trim() || null;
