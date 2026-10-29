import type {
  DeliveryMeasureItem,
  DeliveryQuote,
  DeliveryQuotesByTariff,
} from "../../../../entities/delivery-pricing";
import type { DeliveryType, OrderItem } from "../../../../entities/order/types/order";
import type { CatalogProduct } from "./orderPricing";

/**
 * BUYURTMA FORMASIDA TAXMINIY YETKAZISH NARXI (6NYcXvGy, CS-E; maket `*-create-manual-step2-existing-customer` —
 * «Buyurtma xulosasi» → «Yetkazish narxi ≈ …»).
 *
 * Narxni server hisoblaydi (`POST /delivery/quote/by-tariff`, elchipochta.uz kalkulyatori bilan ayni formula) — bu
 * yerda faqat so'rov elementlari yig'iladi: tanlangan katalog mahsulotining o'lchovi HAR DONA uchun alohida element
 * (bitta posilka). O'lchovsiz mahsulot (eski katalog, 6FLyjO6j) va katalogdan tashqari mahsulot so'rovga kirmaydi —
 * ular sanaladi va forma ogohlantiradi. Narx buyurtma payload'iga QO'SHILMAYDI (backend DTO qabul qilmaydi).
 */

const positiveNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

/** Katalog mahsulotining o'lchovi; og'irlik yoki uchala o'lchamdan biri yo'q — `null` (o'lchovsiz). */
export const readCatalogMeasure = (product?: CatalogProduct | null): DeliveryMeasureItem | null => {
  if (!product) return null;
  const weight = positiveNumber(product.weight_kg);
  const length = positiveNumber(product.length_cm);
  const width = positiveNumber(product.width_cm);
  const height = positiveNumber(product.height_cm);
  if (weight === null || length === null || width === null || height === null) return null;
  return {
    weight_kg: weight,
    length_cm: length,
    width_cm: width,
    height_cm: height,
    volumetric_enabled: product.volumetric_enabled !== false,
  };
};

export type OrderQuoteInput = {
  /** So'rov elementlari — o'lchovli mahsulotlar, har dona alohida. */
  items: DeliveryMeasureItem[];
  /** O'lchovli mahsulot qatorlari soni. */
  measured: number;
  /** O'lchovsiz qatorlar (o'lchovi yo'q katalog mahsuloti yoki katalogdan tashqari). */
  unmeasured: number;
};

export const buildOrderQuoteInput = (
  items: readonly OrderItem[],
  findProduct: (id: string) => CatalogProduct | undefined,
): OrderQuoteInput => {
  const measures: DeliveryMeasureItem[] = [];
  let measured = 0;
  let unmeasured = 0;
  for (const item of items) {
    const measure =
      item.product_id == null ? null : readCatalogMeasure(findProduct(item.product_id));
    if (!measure) {
      unmeasured += 1;
      continue;
    }
    measured += 1;
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
    for (let unit = 0; unit < quantity; unit += 1) measures.push(measure);
  }
  return { items: measures, measured, unmeasured };
};

/**
 * Tanlangan yetkazish turining natijasi: «Markazgacha» — `center`, «Uygacha» — `address` (sayt kalkulyatoridagi
 * shahar ichidagi `city` tarifi bu yerda tanlanmaydi — formada yo'nalishning market tomoni yo'q).
 */
export const quoteForDeliveryType = (
  quotes: DeliveryQuotesByTariff | undefined,
  type: DeliveryType,
): DeliveryQuote | null => quotes?.[type] ?? null;
