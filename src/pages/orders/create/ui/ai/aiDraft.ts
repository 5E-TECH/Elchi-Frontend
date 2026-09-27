import { toLocalPhone, toQuantity, type AiPreviewOrder } from "../../../../../entities/ai-order";
import type { AiDraftOrder } from "./evalPreview";

/**
 * Operator ko'rib, tuzatayotgan bitta AI buyurtmasi.
 *
 * `order` — tahrirlanadigan nusxa (telefonlar 9 xonali mahalliy ko'rinishda),
 * `source` — AI'ning asl chiqishi: masalan telefon noto'g'ri o'qilgan bo'lsa
 * maydon bo'sh qoladi, lekin operator AI nimani o'qiganini ko'ra oladi.
 */
export type AiDraft = {
  key: string;
  order: AiDraftOrder;
  source: AiPreviewOrder;
  /** Server bu buyurtmani yaratmagan bo'lsa — sababi kartaning o'zida. */
  createError?: string;
};

export type AiCreatedRow = {
  key: string;
  order_id?: string;
  customer_name: string;
  phone_number: string;
  district_name: string | null;
  total_price: number;
};

const idOrNull = (value: unknown) => (value === null || value === undefined || value === "" ? null : String(value));

export const toDraft = (source: AiPreviewOrder, key: string, draftId?: string): AiDraft => ({
  key,
  source,
  order: {
    ...source,
    customer_name: source.customer_name ?? "",
    phone_number: toLocalPhone(source.phone_number),
    extra_number: toLocalPhone(source.extra_number),
    region_id: idOrNull(source.region_id),
    district_id: idOrNull(source.district_id),
    district_candidates: source.district_candidates ?? [],
    address: source.address ?? "",
    comment: source.comment ?? "",
    operator: source.operator ?? "",
    where_deliver: source.where_deliver === "address" ? "address" : "center",
    items: (source.items ?? []).map((item) => ({
      ...item,
      product_id: idOrNull(item.product_id),
      quantity: toQuantity(item.quantity),
      candidates: item.candidates ?? [],
    })),
    price_confirmed: false,
    // Xarajat jurnalini yaratilgan buyurtmaga bog'lash uchun tasdiqlashda qaytadi.
    draft_id: draftId ?? null,
  },
});

export const toCreatedRow = (draft: AiDraft, orderId?: string): AiCreatedRow => ({
  key: draft.key,
  order_id: orderId,
  customer_name: draft.order.customer_name,
  phone_number: draft.order.phone_number,
  district_name: draft.order.district_name,
  total_price: Number(draft.order.total_price ?? 0),
});

/** Javob qobig'i qatlamlarga qarab farq qiladi — himoyalangan ochish. */
export const toList = <T = Record<string, unknown>>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  const record = value as { data?: unknown; items?: unknown; results?: unknown } | null;
  for (const inner of [record?.data, record?.items, record?.results]) {
    if (Array.isArray(inner)) return inner as T[];
    const nested = (inner as { items?: unknown } | undefined)?.items;
    if (Array.isArray(nested)) return nested as T[];
  }
  return [];
};
