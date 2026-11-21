/**
 * AI BUYURTMA AUDIT IZI — `GET orders/:id/ai-trace` (vncdmXOy; backend `libs/common/src/ai/ai-draft.contract.ts` →
 * `AiDraftTrace`). Faqat SUPERADMIN/ADMIN (matnda mijoz PII'si bor); buyurtma AI'dan yaratilmagan bo'lsa 404.
 *
 * ⚠️ MAXFIYLIK: manba matnda telefonlar `[TEL_n]`, AI taklifida telefon faqat maskalangan (`+99890*****67`) — to'liq
 * raqam hech qachon kelmaydi. 30 kundan keyin matn va AI taklifi o'chiriladi (`source_purged`, `ai_suggestion: null`);
 * model, kim tasdiqlagani va qaysi maydonlar o'zgargani qoladi.
 */

/** Operator o'zgartirishi mumkin bo'lgan va audit qilinadigan maydonlar (backend tartibi). */
export const AI_AUDITED_FIELDS = [
  "customer_name",
  "phone_number",
  "extra_number",
  "region_id",
  "district_id",
  "address",
  "total_price",
  "where_deliver",
  "comment",
  "operator",
  "items",
] as const;
export type AiAuditedField = (typeof AI_AUDITED_FIELDS)[number];

/** Matn saqlanish muddati (backend retention): shundan keyin `source_text` va `ai_suggestion` — `null`. */
export const AI_TRACE_RETENTION_DAYS = 30;

export type AiTraceItem = { name: string; product_id: string | null; quantity: number };

/** Tuman qanday aniqlangani (P1-7): AI o'qigan matn — «AI o'qigan: «Qatortol» → Uchtepa tumani». */
export type AiTraceDistrictMatch = { method: string; ai_text: string; score: number | null };

/** AI TAKLIFI — shu buyurtmaga mos preview snapshot'i (`AiDraftPreviewSnapshot`). */
export type AiTraceSuggestion = {
  customer_name: string | null;
  /** `+99890*****67` — to'liq raqam yo'q. */
  phone_masked: string | null;
  extra_masked: string | null;
  region_id: string | null;
  district_id: string | null;
  address: string | null;
  total_price: number | null;
  where_deliver: string | null;
  comment: string | null;
  operator: string | null;
  items: AiTraceItem[];
  /** Eski snapshot'larda yo'q. */
  district_match: AiTraceDistrictMatch | null;
  region_inferred: boolean;
  /** Preview'dagi tekshiruv kodlari (`district_low_confidence`, `price_check`, …); eski snapshot'da `[]`. */
  check_codes: string[];
};

export type AiOrderTrace = {
  order_id: string;
  /** Preview'dagi o'rni (0..); `null` — eski yozuv. */
  item_index: number | null;
  /** Tasdiqlagan foydalanuvchi id'si (ism — `GET users/:id`). */
  confirmed_by: string | null;
  confirmed_at: string | null;
  /** AI tahlil qilgan vaqt (draft yaratilgan). */
  created_at: string | null;
  /** Maskalangan matn (`[TEL_n]`); muddat tugagach `null`. */
  source_text: string | null;
  source_purged: boolean;
  image_count: number;
  model: string;
  prompt_version: string;
  ai_suggestion: AiTraceSuggestion | null;
  /** Server hisoblagan, operator o'zgartirgan maydonlar; `null` — noma'lum (eski yozuv). */
  edited_fields: AiAuditedField[] | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

const amount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isAuditedField = (value: unknown): value is AiAuditedField =>
  (AI_AUDITED_FIELDS as readonly unknown[]).includes(value);

const toItems = (value: unknown): AiTraceItem[] =>
  Array.isArray(value)
    ? value.filter(isRecord).map((item) => ({
        name: text(item.name) ?? "",
        product_id: text(item.product_id),
        quantity: Math.max(1, Math.round(amount(item.quantity) ?? 1)),
      }))
    : [];

const toDistrictMatch = (value: unknown): AiTraceDistrictMatch | null => {
  if (!isRecord(value)) return null;
  const aiText = text(value.ai_text);
  return aiText ? { method: text(value.method) ?? "", ai_text: aiText, score: amount(value.score) } : null;
};

const toSuggestion = (value: unknown): AiTraceSuggestion | null => {
  if (!isRecord(value)) return null;
  return {
    customer_name: text(value.customer_name),
    phone_masked: text(value.phone_masked),
    extra_masked: text(value.extra_masked),
    region_id: text(value.region_id),
    district_id: text(value.district_id),
    address: text(value.address),
    total_price: amount(value.total_price),
    where_deliver: text(value.where_deliver),
    comment: text(value.comment),
    operator: text(value.operator),
    items: toItems(value.items),
    district_match: toDistrictMatch(value.district_match),
    region_inferred: value.region_inferred === true,
    check_codes: Array.isArray(value.check_codes)
      ? value.check_codes.filter((code): code is string => typeof code === "string")
      : [],
  };
};

/** Gateway javobi (`{ statusCode, data }` ichida yoki to'g'ridan-to'g'ri) → iz; `order_id` yo'q bo'lsa `null`. */
export const toAiOrderTrace = (payload: unknown): AiOrderTrace | null => {
  const raw = isRecord(payload) && isRecord(payload.data) ? payload.data : payload;
  if (!isRecord(raw)) return null;
  const orderId = text(raw.order_id);
  if (!orderId) return null;
  const itemIndex = amount(raw.item_index);
  return {
    order_id: orderId,
    item_index: itemIndex !== null && Number.isInteger(itemIndex) && itemIndex >= 0 ? itemIndex : null,
    confirmed_by: text(raw.confirmed_by),
    confirmed_at: text(raw.confirmed_at),
    created_at: text(raw.created_at),
    source_text: typeof raw.source_text === "string" && raw.source_text.trim() !== "" ? raw.source_text : null,
    source_purged: raw.source_purged === true,
    image_count: Math.max(0, Math.round(amount(raw.image_count) ?? 0)),
    model: text(raw.model) ?? "—",
    prompt_version: text(raw.prompt_version) ?? "—",
    ai_suggestion: toSuggestion(raw.ai_suggestion),
    edited_fields: Array.isArray(raw.edited_fields) ? raw.edited_fields.filter(isAuditedField) : null,
  };
};

/**
 * Telefon maskasi ko'rinishi: `+99890*****67` / `901234567` → `+998 90 *** ** 67` (o'rtasi doim yashirin — maket;
 * yakuniy raqam ham AI taklifi bilan bir xil ko'rinishda, to'liq raqam oynada ko'rsatilmaydi).
 */
export const formatMaskedPhone = (value: string | null | undefined): string | null => {
  const raw = (value ?? "").replace(/[\s()-]/g, "");
  const local = raw.replace(/^\+?998/, "");
  if (!/^[\d*]{9}$/.test(local)) return null;
  return `+998 ${local.slice(0, 2)} *** ** ${local.slice(7, 9)}`;
};
