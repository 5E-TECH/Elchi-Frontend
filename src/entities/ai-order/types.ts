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
  | "ai_error";

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
};

export type AiParseResponse = {
  ok: boolean;
  reason?: AiParseFailureReason;
  orders?: AiPreviewOrder[];
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
  | { product_name: string; quantity: number };

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
};

export type AiConfirmRequest = {
  market_id?: string;
  orders: AiConfirmOrder[];
};

/** Har buyurtma alohida natija beradi; `index` — `orders[]` dagi o'rni. */
export type AiConfirmResult = {
  index: number;
  ok: boolean;
  order_id?: string;
  reason?: string;
};

export type AiConfirmResponse = {
  results: AiConfirmResult[];
};
