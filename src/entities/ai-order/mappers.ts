import { getUzbekistanPhoneDigits } from "../../shared/lib/phone";
import {
  formatExtraNumber,
  formatPrice,
  type OrderCreateFormValues,
} from "../../pages/orders/create/model/orderCreateForm";
import type { OrderItem } from "../order/types/order";
import type {
  AiConfirmItem,
  AiConfirmOrder,
  AiConfirmRequest,
  AiPreviewItem,
  AiPreviewOrder,
} from "./types";

/**
 * AI PREVIEW → FORMA / TASDIQLASH PAYLOADI.
 *
 * ⚠️ Gateway'da `forbidNonWhitelisted: true` — noma'lum maydon 400 beradi.
 * Shu sabab preview obyekti HECH QACHON yoyib (`...preview`) yuborilmaydi:
 * payload faqat ruxsat etilgan maydonlardan qo'lda yig'iladi. AI metadatasi
 * (`candidates`, `district_candidates`, `region_given`, `resolved_name`,
 * `ready`, `issues`) shu tariqa tabiiy tushib qoladi.
 */

/**
 * Mahalliy 9 xonali raqam yoki bo'sh satr. `getUzbekistanPhoneDigits`
 * ortiqcha raqamni kesib tashlaydi — 10 xonali noto'g'ri raqamdan "to'g'ri"
 * ko'rinadigan YOLG'ON raqam yasalmasligi uchun jami raqamlar soni ham
 * tekshiriladi (9 ta yoki `998` bilan 12 ta).
 */
export const toLocalPhone = (value?: string | null): string => {
  const local = getUzbekistanPhoneDigits(value ?? "");
  const total = (value ?? "").replace(/\D/g, "").length;
  return local.length === 9 && (total === 9 || total === 12) ? local : "";
};

export const toQuantity = (value: unknown): number => {
  const quantity = Math.round(Number(value));
  return Number.isFinite(quantity) && quantity >= 1 ? quantity : 1;
};

const toAmount = (value: unknown): number => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
};

const text = (value?: string | null) => (value ?? "").trim();

export type AiOrderFormValues = Pick<OrderCreateFormValues, "customer" | "details">;

/**
 * AI chiqishini mavjud "Buyurtma yaratish" formasi qiymatlariga o'giradi.
 * Katalogda topilmagan (product_id siz) item formaga tushmaydi — forma
 * faqat katalog mahsulotini qabul qiladi.
 */
export const aiPreviewToFormValues = (preview: AiPreviewOrder): AiOrderFormValues => {
  const items: OrderItem[] = preview.items
    .filter((item) => Boolean(item.product_id))
    .map((item) => ({ product_id: String(item.product_id), quantity: toQuantity(item.quantity) }));
  const price = preview.total_price;

  return {
    customer: {
      phone: toLocalPhone(preview.phone_number),
      extra_phone: toLocalPhone(preview.extra_number),
      name: text(preview.customer_name),
      region_id: preview.region_id ? String(preview.region_id) : "",
      district_id: preview.district_id ? String(preview.district_id) : "",
      address: text(preview.address),
    },
    details: {
      items,
      total_price:
        price !== null && Number.isFinite(Number(price)) ? formatPrice(String(Math.round(Number(price)))) : "",
      where_deliver: preview.where_deliver === "address" ? "address" : "center",
      operator: text(preview.operator),
      comment: text(preview.comment),
    },
  };
};

/**
 * `product_id` bor → katalog mahsuloti. Yo'q bo'lsa `product_name` FAQAT
 * operator "katalogda yo'q" deb belgilaganda (`allow_free_text === true`);
 * aks holda item yuborilmaydi.
 */
const toConfirmItem = (item: AiPreviewItem): AiConfirmItem[] => {
  const quantity = toQuantity(item.quantity);
  if (item.product_id) return [{ product_id: String(item.product_id), quantity }];
  const name = text(item.name);
  if (item.allow_free_text === true && name) return [{ product_name: name, quantity }];
  return [];
};

const toConfirmOrder = (preview: AiPreviewOrder): AiConfirmOrder => {
  const phone = toLocalPhone(preview.phone_number);
  const extra = toLocalPhone(preview.extra_number);
  const districtId = preview.district_id ? String(preview.district_id) : "";
  const address = text(preview.address);
  const comment = text(preview.comment);
  const operator = text(preview.operator);

  return {
    customer: {
      name: text(preview.customer_name),
      phone_number: phone ? `+998${phone}` : "",
      // ⚠️ Gateway `customer.district_id` ni ham majburiy talab qiladi.
      district_id: districtId,
      ...(extra && { extra_number: formatExtraNumber(extra) }),
      ...(address && { address }),
    },
    items: preview.items.flatMap(toConfirmItem),
    district_id: districtId,
    total_price: toAmount(preview.total_price),
    where_deliver: preview.where_deliver === "address" ? "address" : "center",
    ...(address && { address }),
    ...(comment && { comment }),
    ...(operator && { operator }),
  };
};

/**
 * `buildCreateOrderPayload` shabloni bo'yicha, lekin:
 * - `region_id` YUBORILMAYDI — server uni tumandan o'zi oladi;
 * - `status` YUBORILMAYDI — sukut `new` bo'lishi kerak;
 * - `market_id` faqat market bo'lmagan rollar uchun (`includeMarketId`).
 */
export const buildAiConfirmPayload = (
  previews: AiPreviewOrder[],
  options: { marketId?: string | number | null; includeMarketId: boolean },
): AiConfirmRequest => ({
  ...(options.includeMarketId && options.marketId ? { market_id: String(options.marketId) } : {}),
  orders: previews.map(toConfirmOrder),
});
