/**
 * Pochta tarixi (backend #618, `GET post/orders/:id?view=current|all`) — sof yordamchilar, UI'siz.
 *
 * `view=all` (qabul qilingan `received` / `canceled_received` pochtaning server sukuti) pochtaga HAR QACHON kirgan
 * buyurtmalarni qaytaradi: har qatorda `in_post_now`, `membership`, `current_post_id`, `current_canceled_post_id`;
 * javobda `view: "all"` va `history_incomplete`. `view=current` — avvalgi shakl (bu maydonlarsiz).
 */

/** Buyurtma pochtaga qachon kirgan / chiqqan; `next_post_id` — chiqib o'tgan keyingi pochta. */
export interface PostOrderMembership {
  joined_at: string | null;
  left_at: string | null;
  next_post_id: string | null;
}

/** Tarix maydonlari (faqat `view=all` qatorlarida; `current` javobida yo'q). */
export interface PostOrderHistoryFields {
  in_post_now?: boolean | null;
  membership?: PostOrderMembership | null;
  current_post_id?: string | null;
  current_canceled_post_id?: string | null;
  post_id?: string | null;
  canceled_post_id?: string | null;
}

/** «Hozir qayerda»: shu pochtada · boshqa pochtada · qaytarish pochtasida · pochtada emas. */
export type PostOrderLocationKind = "here" | "post" | "return" | "none";

export interface PostOrderLocation {
  kind: PostOrderLocationKind;
  /** `post` / `return` da — buyurtma hozir turgan pochta raqami. */
  postId?: string;
}

const idText = (value: unknown): string =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

/**
 * Buyurtma hozir shu pochtadami. Kalit yo'q (`view=current`, eski backend) — joriy a'zo; faqat aniq `false` —
 * sobiq a'zo (backend `isInPostNow` bilan bir xil).
 */
export const isInPostNow = (order: Pick<PostOrderHistoryFields, "in_post_now">): boolean =>
  order.in_post_now !== false;

/**
 * «Hozir qayerda» — backend `postOrderLocationLabel` tartibi: joriy a'zo — shu pochtada; aks holda avval qaytarish
 * pochtasi (`current_canceled_post_id`, zaxira `canceled_post_id`), keyin oddiy pochta (`current_post_id`, zaxira
 * `post_id`); ikkalasi ham yo'q — pochtada emas. Qaytarish ko'rsatkichi shu pochtaning o'zi bo'lsa — o'tkazib
 * yuboriladi (backenddagidek). `current_post_id` shu pochtaning o'zi bo'lsa — buyurtma shu pochtada: bu faqat
 * nomuvofiq javobda bo'ladi (backend joriy a'zoni `in_post_now: true` beradi), backend Excel'i u holda
 * «pochtada emas» yozadi.
 */
export const getPostOrderLocation = (
  order: PostOrderHistoryFields,
  postId: string | number,
): PostOrderLocation => {
  if (isInPostNow(order)) return { kind: "here" };
  const self = idText(postId);
  const canceledPostId = idText(order.current_canceled_post_id ?? order.canceled_post_id);
  if (canceledPostId && canceledPostId !== self) return { kind: "return", postId: canceledPostId };
  const currentPostId = idText(order.current_post_id ?? order.post_id);
  if (currentPostId && currentPostId === self) return { kind: "here" };
  if (currentPostId) return { kind: "post", postId: currentPostId };
  return { kind: "none" };
};

/** Javob tarix ko'rinishidami (`view: "all"`). Kalit yo'q — joriy javob (`false` deb taxmin qilinmaydi). */
export const isHistoryView = (data: { view?: string | null } | null | undefined): boolean =>
  data?.view === "all";
