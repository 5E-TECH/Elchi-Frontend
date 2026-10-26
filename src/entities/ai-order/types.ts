import type { DeliveryType } from "../order/types/order";

/**
 * AI BUYURTMA — BACKEND SHARTNOMASI (`orders/ai-parse`, `orders/ai-confirm`).
 *
 * ⚠️ Shakl YASSI va `{ ok, reason?, orders? }` — backend kartalari ham aynan
 * shu shaklga keltirilishi kelishilgan. Bir tomonda o'zgarsa ikkinchisi ham
 * o'zgarishi SHART, aks holda frontend javobni o'qiy olmaydi.
 */

export type AiParseFailureReason =
  | "disabled"
  | "ai_off"
  | "refused"
  | "truncated"
  | "network"
  | "insufficient"
  | "no_market"
  | "ai_error"
  /** Kunlik global AI xarajat shifti tugagan — "AI o'chirilgan" EMAS. */
  | "cap_exceeded";

export type AiDistrictCandidate = {
  id: string;
  label: string;
  region_name: string;
};

export type AiProductCandidate = {
  id: string;
  name: string;
};

export type AiPreviewItem = {
  /** AI matndan o'qigan nom. */
  name: string;
  quantity: number;
  product_id?: string | null;
  /** Katalogdagi mos mahsulot nomi (faqat ko'rsatish uchun). */
  resolved_name?: string | null;
  candidates: AiProductCandidate[];
  /**
   * Operator "katalogda yo'q" deb ANIQ belgilagan. Faqat shunda
   * `product_id` siz item `product_name` bilan yuboriladi.
   */
  allow_free_text?: boolean;
};

/**
 * J3hEDtFN (prompt `2026-10-26.1`): AI noaniq maydonni TAXMIN QILMAYDI — qiymat `null` qoladi va `warnings[]` ga
 * tushadi. Faqat enum (erkin matn yo'q) — frontend o'z matnini ko'rsatadi; noma'lum qiymat e'tiborsiz.
 */
export const AI_WARNING_FIELDS = [
  "customer_name",
  "phone_number",
  "extra_number",
  "region_name",
  "district_name",
  "address",
  "items",
  "total_price",
  "comment",
  "where_deliver",
  "is_replacement",
  "operator",
] as const;
export type AiWarningField = (typeof AI_WARNING_FIELDS)[number];

/** `unclear` — o'qib bo'lmadi; `ambiguous` — bir necha talqin; `conflict` — zid qiymatlar. */
export const AI_WARNING_REASONS = ["unclear", "ambiguous", "conflict"] as const;
export type AiWarningReason = (typeof AI_WARNING_REASONS)[number];

export type AiPreviewWarning = { field: AiWarningField; reason: AiWarningReason };

export type AiPreviewOrder = {
  customer_name: string;
  phone_number: string;
  extra_number?: string | null;
  region_id: string | null;
  region_name: string | null;
  /** Viloyat matnda aniq aytilganmi (taxmin emas). */
  region_given: boolean;
  district_id: string | null;
  district_name: string | null;
  district_candidates: AiDistrictCandidate[];
  address?: string | null;
  items: AiPreviewItem[];
  total_price: number | null;
  comment?: string | null;
  operator?: string | null;
  where_deliver: DeliveryType;
  /**
   * Tahlil javobidagi `draft_id` — backend emas, FRONTEND har buyurtmaga
   * yozib qo'yadi: tasdiqlashda qaytarib yuboriladi va AI xarajat jurnali
   * qatorlari yaratilgan buyurtmaga bog'lanadi.
   */
  draft_id?: string | null;
  /**
   * Preview'dagi o'rni (ai-parse javobidagi `index`, 0..29; vncdmXOy). Tasdiqlashda `ai_item_index` bo'lib
   * qaytadi — operator karta o'chirsa ham o'zgarmaydi.
   */
  index?: number;
  /** Noaniq maydonlar (bo'sh massiv / yo'q — ogohlantirish yo'q). */
  warnings?: AiPreviewWarning[];
};

export type AiParseResponse = {
  ok: boolean;
  reason?: AiParseFailureReason;
  orders?: AiPreviewOrder[];
  /** Shu tahlilning xarajat jurnalidagi identifikatori (UUID). */
  draft_id?: string;
  /** Backend'ning odam o'qiydigan izohi (UI o'z matnini ishlatadi). */
  message?: string;
};

/** `GET orders/ai-availability` — AI yoqilganmi (konfiguratsiya kaliti). */
export type AiAvailability = {
  enabled: boolean;
  state?: "enabled" | "disabled" | "cap_exceeded" | "unknown";
};

/** Rasm `prepareImage` (shared/lib/downscaleImage) chiqishidan olinadi. */
export type AiParseImage = {
  media_type: string;
  data_base64: string;
  name: string;
};

export type AiParseRequest = {
  text?: string;
  /** Faqat admin/registrator uchun — market roli uchun server o'zi hal qiladi. */
  market_id?: string;
  images?: AiParseImage[];
  /** Operator "Bekor qilish" bosganda so'rovni to'xtatish uchun. */
  signal?: AbortSignal;
};

export type AiConfirmCustomer = {
  name: string;
  /** `+998XXXXXXXXX`; noto'g'ri raqamda bo'sh satr (server rad etadi). */
  phone_number: string;
  district_id: string;
  extra_number?: string;
  address?: string;
};

export type AiConfirmItem =
  | { product_id: string; quantity: number }
  /**
   * Katalogda yo'q mahsulot. ⚠️ Backend `allow_unlisted_product: true` siz
   * `product_name` ni 400 bilan rad etadi — bayroq operator "katalogda yo'q"
   * deb ANIQ belgilaganini bildiradi.
   */
  | { product_name: string; quantity: number; allow_unlisted_product: true };

/**
 * ⚠️ `CreateOrderRequest` dan NUSXA OLINMAGAN, ATAYLAB alohida tip: unda
 * `sell_requires_media`, `cancel_requires_media`, `paid_amount`,
 * `qr_code_token` bor — gateway DTO'sida ular YO'Q va `forbidNonWhitelisted`
 * tufayli 400 beradi. `region_id` va `status` ham yo'q: viloyat serverda
 * tumandan olinadi, holat esa sukut bo'yicha `new`.
 */
export type AiConfirmOrder = {
  customer: AiConfirmCustomer;
  items: AiConfirmItem[];
  district_id: string;
  total_price: number;
  where_deliver: DeliveryType;
  address?: string;
  comment?: string;
  operator?: string;
  /** Tahlil javobidagi `draft_id` (bo'lsa) — xarajatni buyurtmaga bog'lash uchun. */
  draft_id?: string;
  /**
   * Preview'dagi `index` (0..29). `draft_id` bilan birga — barqaror dublikat kaliti (`ai:<market>:<draft>:<index>`)
   * va server tomonidagi audit (`edited_fields`: operator nimani o'zgartirdi). Qayta yuborishda O'ZGARMAYDI.
   */
  ai_item_index?: number;
};

export type AiConfirmRequest = {
  market_id?: string;
  /**
   * Har yuborishda yangi `crypto.randomUUID()`. Ayni `request_id` bilan
   * qayta yuborish serverda dublikat yaratmasligi kerak (backend bilan
   * kelishiladigan maydon).
   */
  request_id?: string;
  orders: AiConfirmOrder[];
};

/**
 * ai-confirm'da yiqilgan buyurtma kodi (backend `AiConfirmFailureCode` bilan
 * bir xil). Frontend matnni KOD bo'yicha tarjima qiladi; `reason` — serverning
 * o'zbekcha izohi (kodsiz eski javob uchun zaxira).
 */
export type AiConfirmFailureCode =
  | "district_not_found"
  | "district_mismatch"
  | "product_not_found"
  | "product_foreign"
  | "duplicate_in_batch"
  | "duplicate_recent"
  | "duplicate_in_progress"
  | "validation_unavailable"
  | "create_failed"
  | "timeout_unknown"
  | "not_started";

/** Har buyurtma alohida natija beradi; `index` — `orders[]` dagi o'rni. */
export type AiConfirmResult = {
  index: number;
  ok: boolean;
  order_id?: string;
  code?: AiConfirmFailureCode;
  reason?: string;
};

export type AiConfirmResponse = {
  results: AiConfirmResult[];
};

/**
 * `GET ai/status` (api-gateway `AiGatewayController.status`, SUPERADMIN/ADMIN; backend `libs/common/src/ai/
 * ai-status.contract.ts` → `AiStatusResponse`). Gateway konverti `{ statusCode, message, data }` ichida.
 * ⚠️ Kalit QIYMATI hech qachon qaytmaydi — faqat `key_state`.
 */
/** `ANTHROPIC_API_KEY`: bor / yo'q / boshqa nom bilan berilgan. */
export type AiKeyState = "ok" | "missing" | "misnamed";

/** Model siyosati: `ok` — mos; `weak` — narx jadvalida bor, lekin ajratish uchun kuchsiz; `unknown` — narx jadvalida yo'q. */
export type AiModelVerdict = "ok" | "weak" | "unknown";

/** Kunlik shift: ok / ogohlantirish chegarasidan oshdi / tugadi / o'qib bo'lmadi (AI fail-closed). */
export type AiCapState = "ok" | "warn" | "exceeded" | "unknown";

export type AiStatusResponse = {
  /** ai-service'da Anthropic mijozi bor (kalit o'qildi). */
  enabled: boolean;
  key_state: AiKeyState;
  /** Model NOMLARI (`AI_ORDER_MODEL`, `AI_ORDER_VISION_MODEL`, `AI_CLASSIFY_MODEL`). */
  models: { order: string; vision: string; classify: string };
  model_policy: { ok: boolean; order: AiModelVerdict; vision: AiModelVerdict; classify: AiModelVerdict };
  cap: {
    /** Toshkent sanasi (YYYY-MM-DD). */
    period_key: string;
    spent_usd: number;
    /** Asosiy kunlik limit (`AI_DAILY_USD_CAP`). */
    cap_usd: number;
    /** Bugun uchun serverda qo'shilgan (ertaga tushadi). */
    override_usd: number;
    effective_cap_usd: number;
    /** `spent / effective_cap` (0..1+). */
    ratio: number;
    state: AiCapState;
    reset_at: string;
  };
  /** Xarajat jurnaliga yozilmay qolgan chaqiruvlar soni. */
  usage_persist_failures: number;
};
