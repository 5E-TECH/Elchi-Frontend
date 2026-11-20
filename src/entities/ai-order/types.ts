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
  /**
   * Operator kartaga katalogdan O'ZI qo'shgan qator (AI matnda o'qimagan). Backend emas — FRONTEND yozadi: payload
   * qo'lda yig'iladi (`toConfirmItem`), bayroq serverga ketmaydi; qatorda «AI o'qidi» o'rniga «Qo'lda qo'shildi».
   */
  added_manually?: boolean;
  /**
   * AI javobidagi o'rni (`items[]` indeksi). Backend emas — FRONTEND `toDraft` da yozadi: operator qator o'chirsa
   * yoki qo'shsa ham `qty_check.item_index` / `duplicate_items.item_indexes` to'g'ri qatorga bog'lanadi.
   */
  source_index?: number;
};

/**
 * P1-7 (backend `order-service/src/ai/ai-preview.types.ts` → `AiCheck`): ai-parse `orders[].checks`.
 * ⚠️ Ro'yxat kengayadi — noma'lum `code` e'tiborsiz qoldiriladi (`normalizeAiChecks`).
 */
export type AiCheck =
  | { code: "district_low_confidence" }
  | { code: "price_check"; kind: "mismatch" | "too_high"; mentions: number[] }
  | { code: "qty_check"; item_index: number }
  | { code: "duplicate_items"; item_indexes: number[] }
  | { code: "phone_is_market" }
  | { code: "same_phone_multi"; other_index: number };

/**
 * Faqat shu ikkitasi BLOKLAYDI (ega qarori 2026-11-14, backend `AI_BLOCKING_CHECK_CODES`): ai-confirm ularni
 * `orders[].ack_checks` da kutadi, aks holda 409 `CHECKS_NOT_ACKNOWLEDGED`. Qolganlari — yumshoq eslatma.
 */
export const AI_BLOCKING_CHECK_CODES = ["district_low_confidence", "price_check"] as const;
export type AiBlockingCheckCode = (typeof AI_BLOCKING_CHECK_CODES)[number];

/** Tuman qanday aniqlangani (faqat tuman avto-tanlanganda; aks holda `null`). */
export type AiDistrictMatch = {
  /** `exact` | `alias` | `address` | `fuzzy` | `llm` (kengayishi mumkin). */
  method: string;
  /** AI o'qigan tuman matni (≤ 80 belgi). */
  ai_text: string | null;
  /** 0..1 — faqat `fuzzy`/`address`. */
  score: number | null;
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
  /**
   * Kartada ODAM ro'yxatdan tanlagan market operatori (`GET /market-operators/selectable`). Backend emas — FRONTEND
   * yozadi: ai-parse uni hech qachon bermaydi (`toDraft` AI qiymatini e'tiborsiz qoldiradi), AI matnidagi ism ham
   * avtomatik bog'lanmaydi. Tasdiqlashda `orders[].operator_id` — buyurtma va sotuvdagi komissiya shu operatorga.
   */
  operator_id?: string | null;
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
  /** P1-7: tuman qanday aniqlangani («AI o'qigan: «Urgut» → Urgut tumani»). Eski backend'da yo'q. */
  district_match?: AiDistrictMatch | null;
  /** P1-7: viloyat matnda aytilmagan, AI uni tumandan chiqargan. Ishora: `region_inferred || !region_given`. */
  region_inferred?: boolean;
  /** P1-7: AI tekshiruvlari (bloklovchi va yumshoq). Eski backend'da yo'q — tekshiruvsiz. */
  checks?: AiCheck[];
  /**
   * Operator KO'RIB tasdiqlagan bloklovchi kodlar («Tuman to'g'ri, tasdiqlayman»). Backend emas — FRONTEND yozadi;
   * tasdiqlashda faqat hozir talab qilinadiganlari `orders[].ack_checks` bo'lib ketadi (`ackChecksToSend`).
   */
  acked_checks?: AiBlockingCheckCode[];
  /**
   * Server 409 `CHECKS_NOT_ACKNOWLEDGED` da shu buyurtma uchun talab qilgan kodlar — frontend ularni kartada
   * MAJBURAN so'raydi (tahrir istisnosidan qat'i nazar). FRONTEND yozadi, serverga ketmaydi.
   */
  server_required_acks?: AiBlockingCheckCode[];
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
  /**
   * Ro'yxatdan tanlangan operator (`POST /orders` `operator_id` bilan AYNI qoida): backend uni buyurtma marketining
   * faol operatorlari ichida tekshiradi (aks holda shu buyurtma `create_failed`) va `operator` ni uning ismi bilan
   * yozadi. Tanlanmasa yuborilmaydi — buyurtma operatorsiz, `operator` faqat matn (komissiya yozilmaydi).
   */
  operator_id?: string;
  /** Tahlil javobidagi `draft_id` (bo'lsa) — xarajatni buyurtmaga bog'lash uchun. */
  draft_id?: string;
  /**
   * Preview'dagi `index` (0..29). `draft_id` bilan birga — barqaror dublikat kaliti (`ai:<market>:<draft>:<index>`)
   * va server tomonidagi audit (`edited_fields`: operator nimani o'zgartirdi). Qayta yuborishda O'ZGARMAYDI.
   */
  ai_item_index?: number;
  /**
   * Operator ko'rib tasdiqlagan bloklovchi kodlar (`district_low_confidence`, `price_check`). Qaysi kod kerakligini
   * server O'ZI biladi (preview snapshot'i); kerakli kod yo'q bo'lsa — butun so'rov 409 `CHECKS_NOT_ACKNOWLEDGED`.
   */
  ack_checks?: AiBlockingCheckCode[];
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
  /**
   * Aniq sabab kodi (backend UPPER_CASE, #658) — masalan `CHOSEN_OPERATOR_NOT_SELECTABLE`: tanlangan operator
   * marketning faol operatori emas (`code` bunda `create_failed`). Eski javobda yo'q — `reason` matni zaxira.
   */
  reason_code?: string;
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
