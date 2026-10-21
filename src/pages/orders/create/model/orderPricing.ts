import type { DeliveryType, OrderItem } from "../../../../entities/order/types/order";
import { resolveAssetUrl } from "../../../../shared/lib/assetUrl";

/**
 * BUYURTMA YARATISH — NARX YORDAMCHILARI (CS-B, Trello IT1YpboR / zRqDRLAZ).
 *
 * Narx dvigateli (DAqXPeSy, vazn va hajm) hali yo'q — hozircha faqat market kartasidagi STANDART narx
 * (`tariff_home` / `tariff_center`, `int`, so'm) va sukut turi (`default_tariff`: backend `Where_deliver` —
 * `center` | `address`). Tariflarni faqat superadmin, admin (`GET markets` to'liq qatori yoki `GET users/:id`) va
 * market (`GET auth/my-profile`) oladi; menejer va registratorga backend bermaydi (N3) — ularda narx chizilmaydi.
 */

/** Yetkazish narxlari qaysi rollarga ko'rinadi (backend shu rollarga tariflarni beradi). */
export const canSeeMarketTariffs = (role: string | null | undefined) =>
  role === "superadmin" || role === "admin" || role === "market";

export type MarketTariffs = {
  /** «Uygacha» standart narxi; `null` — belgilanmagan. */
  address: number | null;
  /** «Markazgacha» standart narxi; `null` — belgilanmagan. */
  center: number | null;
  /** Market kartasidagi sukut turi; `null` — noma'lum. */
  defaultType: DeliveryType | null;
};

/**
 * Tarif qiymati: musbat butun so'm yoki `null`. `0` ham «belgilanmagan» — backend 0 tarifli buyurtmani sotuvda
 * rad etadi (`assertTariffCoversShares`), shuning uchun «0 so'm» ko'rsatib chalg'itilmaydi.
 */
export const readTariff = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && !value.trim()) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null;
};

/** `default_tariff`: backend `address` | `center`; eski frontend tipi `home` ham `address`. */
export const readDeliveryType = (value: unknown): DeliveryType | null => {
  if (value === "center") return "center";
  if (value === "address" || value === "home") return "address";
  return null;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** Market yozuvida tarif maydonlari bormi (`GET markets` to'liq qatori) — bo'lmasa `GET users/:id` so'raladi. */
export const hasTariffFields = (record: unknown): boolean =>
  isRecord(record) && ("tariff_home" in record || "tariff_center" in record || "default_tariff" in record);

/** Market yozuvi yoki gateway qobig'i (`{ data: {...} }`) dan tariflar. */
export const readMarketTariffs = (payload: unknown): MarketTariffs | null => {
  const record = isRecord(payload) && isRecord(payload.data) && !hasTariffFields(payload) ? payload.data : payload;
  if (!isRecord(record)) return null;
  return {
    address: readTariff(record.tariff_home),
    center: readTariff(record.tariff_center),
    defaultType: readDeliveryType(record.default_tariff),
  };
};

export const tariffFor = (tariffs: MarketTariffs | null | undefined, type: DeliveryType): number | null =>
  tariffs ? tariffs[type] : null;

/** Ikkala tur ham narxsiz — «Bu marketga standart narx belgilanmagan» ogohlantirishi. */
export const hasNoTariffs = (tariffs: MarketTariffs | null | undefined) =>
  tariffs != null && tariffs.address == null && tariffs.center == null;

/** Katalog mahsuloti (`GET product/market/:id`, `product/my-products`). `price` — `numeric(14,2)`, bo'sh — `null`. */
export type CatalogProduct = {
  id: string | number;
  name?: string;
  price?: number | string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  image?: string | null;
  photo_url?: string | null;
  photo?: string | null;
};

/** Mahsulot narxi (so'm) yoki `null` — kiritilmagan, bo'sh yoki noto'g'ri. `0` — haqiqiy narx (bepul). */
export const readProductPrice = (product?: CatalogProduct | null): number | null => {
  const raw = product?.price;
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string" && !raw.trim()) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

/** Mahsulot rasmi — ochiq manzil (MinIO ichki manzili `resolveAssetUrl` bilan almashtiriladi). */
export const readProductImageUrl = (product?: CatalogProduct | null): string | undefined =>
  product
    ? resolveAssetUrl(product.image_url ?? product.imageUrl ?? product.image ?? product.photo_url ?? product.photo)
    : undefined;

export type ItemsTotal = {
  /** Narxi ma'lum mahsulotlar summasi (butun so'm). */
  total: number;
  /** Hisobga kirgan qatorlar soni. */
  priced: number;
  /** Narxsiz qatorlar: narxi kiritilmagan katalog mahsuloti va katalogdan tashqari mahsulot. */
  unpriced: number;
};

/**
 * Mahsulotlar bo'yicha summa: Σ narx × son. Katalogdan tashqari (`product_id = null`) va narxi kiritilmagan
 * mahsulot hisobga kirmaydi (`unpriced`). Katalog hali yuklanmagan qator ham narxsiz sanaladi.
 */
export const computeItemsTotal = (
  items: OrderItem[],
  findProduct: (id: string) => CatalogProduct | undefined,
): ItemsTotal => {
  let total = 0;
  let priced = 0;
  let unpriced = 0;
  for (const item of items) {
    const price = item.product_id == null ? null : readProductPrice(findProduct(item.product_id));
    const quantity = Math.max(1, Number(item.quantity) || 1);
    if (price == null) {
      unpriced += 1;
      continue;
    }
    total += price * quantity;
    priced += 1;
  }
  return { total: Math.round(total), priced, unpriced };
};

/** «Umumiy summa» avto-taklifi: hisobga kirgan mahsulot bo'lsa — summa raqamlari, aks holda bo'sh. */
export const suggestedTotalDigits = ({ total, priced }: ItemsTotal): string => (priced > 0 ? String(total) : "");
