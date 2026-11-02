import type {
  DeliveryMeasureItem,
  DeliveryQuote,
  DeliveryQuotesByTariff,
} from "../../../../entities/delivery-pricing";
import type { DeliveryType, OrderItem } from "../../../../entities/order/types/order";
import type { CatalogProduct } from "./orderPricing";

/**
 * BUYURTMA FORMASIDA TAXMINIY YETKAZISH NARXI (6NYcXvGy, CS-E; maketlar `*-create-manual-step2-existing-customer`,
 * `market-new-orders-create-manual-existing-customer` — «Buyurtma xulosasi» → «Yetkazish narxi» holatlari).
 *
 * Vazn uchun qo'shimchani server hisoblaydi (`POST /delivery/quote/by-tariff`) — bu yerda faqat so'rov elementlari
 * yig'iladi: tanlangan katalog mahsulotining o'lchovi HAR DONA uchun alohida element (bitta posilka). O'lchovsiz
 * mahsulot (eski katalog, 6FLyjO6j) va katalogdan tashqari mahsulot so'rovga kirmaydi — nomi bilan aytiladi. Narx
 * buyurtma payload'iga QO'SHILMAYDI (backend DTO qabul qilmaydi).
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
  /** O'lchovsiz qatorlar soni (o'lchovi yo'q katalog mahsuloti yoki katalogdan tashqari). */
  unmeasured: number;
  /** Katalogdan tashqari mahsulotlar nomi (maket: «Sovg'a qadog'i» katalogda yo'q — vazni hisobga kirmadi). */
  catalogLessNames: string[];
  /** O'lchovi kiritilmagan katalog mahsulotlari nomi. */
  unmeasuredNames: string[];
};

/** Bitta qatorning donasi (so'rov elementlari soni): butun, kamida 1, ko'pi bilan `MAX_QUOTE_UNITS_PER_ITEM`. */
export const MAX_QUOTE_UNITS_PER_ITEM = 500;
const quoteUnits = (quantity: unknown) => {
  const value = Math.floor(Number(quantity));
  return Number.isFinite(value) && value > 0 ? Math.min(value, MAX_QUOTE_UNITS_PER_ITEM) : 1;
};

export const buildOrderQuoteInput = (
  items: readonly OrderItem[],
  findProduct: (id: string) => CatalogProduct | undefined,
): OrderQuoteInput => {
  const measures: DeliveryMeasureItem[] = [];
  const catalogLessNames: string[] = [];
  const unmeasuredNames: string[] = [];
  let measured = 0;
  for (const item of items) {
    const product = item.product_id == null ? undefined : findProduct(item.product_id);
    const measure = readCatalogMeasure(product);
    if (!measure) {
      const name = (product?.name ?? item.product_name ?? "").trim();
      if (item.product_id == null) catalogLessNames.push(name);
      else unmeasuredNames.push(name);
      continue;
    }
    measured += 1;
    for (let unit = 0; unit < quoteUnits(item.quantity); unit += 1) measures.push(measure);
  }
  return {
    items: measures,
    measured,
    unmeasured: catalogLessNames.length + unmeasuredNames.length,
    catalogLessNames,
    unmeasuredNames,
  };
};

/**
 * Maketdagi taxminiy narx: MARKET STANDART NARXI + vazn uchun qo'shimcha (server hisobidagi `extra` — asosiy narxga
 * kiradigan kg dan ortig'i × tarifning har kg narxi). Server `total` i umumiy tarif asosidan — maket esa «Standart
 * 35 000 + vazn uchun 8 000 so'm» (market kartasidagi standart narx «og'ir yoki katta posilkada oshadi»).
 */
export const estimateTotal = (standardPrice: number, quote: DeliveryQuote): number =>
  standardPrice + Math.max(0, quote.extra);

/**
 * Tanlangan yetkazish turining natijasi: «Markazgacha» — `center`, «Uygacha» — `address` (sayt kalkulyatoridagi
 * shahar ichidagi `city` tarifi bu yerda tanlanmaydi — formada yo'nalishning market tomoni yo'q).
 */
export const quoteForDeliveryType = (
  quotes: DeliveryQuotesByTariff | undefined,
  type: DeliveryType,
): DeliveryQuote | null => quotes?.[type] ?? null;
