import { resolveAssetUrl } from "../../../shared/lib/assetUrl";

/**
 * MAHSULOT — `catalog.product.find_all` / `find_by_id` javobidagi qator (backend `origin/main`: `id`, `name`,
 * `image_url`, `user_id`, `price` — so'm, `numeric(14,2)`, bo'sh bo'lsa `null` (zRqDRLAZ), `market` —
 * `attachMarkets`, market topilmasa `null`). Eski javoblardagi rasm maydonlari (`image`, `photo` …) ham o'qiladi.
 */
export type Product = {
  id: number;
  name: string;
  price?: number | string | null;
  image?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  photo?: string | null;
  photo_url?: string | null;
  file?: string | null;
  url?: string | null;
  market?: { id: number | string; name?: string | null } | null;
};

/** Faol market (market tanlash oynasi va «Market» filtri): `GET markets?status=active&limit=100`. */
export type ProductMarket = {
  id: number;
  name: string;
  phone: string;
  status?: string | null;
};

/** Ro'yxat javobi meta'si: `{ data, total, page, limit }` yoki `{ data: { items, meta } }` (eski o'ramlar ham). */
export type ProductListMeta = { total: number; page: number; limit: number };

export const toPositiveNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.floor(parsed);
};

const getValueAtPath = (source: unknown, path: readonly string[]): unknown => {
  let current: unknown = source;
  for (const segment of path) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
};

const isProduct = (item: unknown): item is Product => typeof item === "object" && item !== null && "id" in item;

/** Javobdan mahsulotlar massivi (`data.items` · `data.data.items` · `data.products` · `data` · `items` · `[]`). */
export const getProductList = (response: unknown): Product[] => {
  const candidates = [
    getValueAtPath(response, ["data", "items"]),
    getValueAtPath(response, ["data", "data", "items"]),
    getValueAtPath(response, ["data", "products"]),
    getValueAtPath(response, ["data"]),
    getValueAtPath(response, ["items"]),
    getValueAtPath(response, ["products"]),
    response,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return (candidate as unknown[]).filter(isProduct);
  }
  return [];
};

/**
 * Sahifalash ma'lumoti. `total` topilmasa — qatorlar soni (avvalgidek), `page`/`limit` topilmasa — so'ralgani.
 * Javob umuman bo'lmasa `null` (sarlavhadagi «Jami N ta» va sahifalash chizilmaydi).
 */
export const getProductMeta = (
  response: unknown,
  requested: { page: number; limit: number },
): ProductListMeta | null => {
  if (response === undefined || response === null) return null;
  const meta = (getValueAtPath(response, ["data", "meta"]) ??
    getValueAtPath(response, ["data", "pagination"]) ??
    getValueAtPath(response, ["meta"]) ??
    getValueAtPath(response, ["pagination"]) ??
    {}) as Record<string, unknown>;
  const root = response as Record<string, unknown>;
  return {
    total: toPositiveNumber(root.total ?? meta.total) ?? getProductList(response).length,
    page: toPositiveNumber(root.page ?? meta.page) ?? requested.page,
    limit: toPositiveNumber(root.limit ?? meta.limit) ?? requested.limit,
  };
};

/** Bitta mahsulot javobi: o'ramsiz, `{ data }` yoki `{ data: { data } }`. */
export const getProductPayload = (response: unknown): Product | null => {
  if (!response || typeof response !== "object") return null;
  if (isProduct(response)) return response;
  const data = (response as { data?: unknown }).data;
  if (isProduct(data)) return data;
  const nested = getValueAtPath(response, ["data", "data"]);
  return isProduct(nested) ? nested : null;
};

/** Rasm manzili (MinIO ichki manzili ommaviyga — `resolveAssetUrl`). */
export const getProductImageUrl = (product?: Product | null): string | undefined => {
  if (!product) return undefined;
  return resolveAssetUrl(
    product.image_url ??
      product.imageUrl ??
      product.image ??
      product.photo_url ??
      product.photo ??
      product.file ??
      product.url,
  );
};

export const getProductMarketName = (product?: Product | null): string | null => {
  const name = product?.market?.name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
};

/** Mahsulot narxi (so'm) yoki `null` — kiritilmagan, bo'sh yoki noto'g'ri qiymat. */
export const getProductPrice = (product?: Product | null): number | null => {
  const raw = product?.price;
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string" && !raw.trim()) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

/**
 * «Narx» maydoni (`TextInput mode="money"`) — butun so'm, ko'pi bilan 12 xona (backend chegarasi
 * `999 999 999 999,99`, `catalog.swagger.dto.ts`).
 */
export const PRODUCT_PRICE_MAX_DIGITS = 12;

/** Mavjud narx → maydon qiymati (raqamlar satri, butun so'mga yaxlitlangan); narx yo'q — bo'sh. */
export const toPriceInput = (product?: Product | null): string => {
  const price = getProductPrice(product);
  return price === null ? "" : String(Math.round(price));
};

/** Maydon qiymati tekshiruvi: bo'sh — mumkin (ixtiyoriy), aks holda 12 xonadan oshmasin. */
export const isPriceInputValid = (value: string): boolean => value.length <= PRODUCT_PRICE_MAX_DIGITS;

/** `GET markets` javobidan marketlar (faqat id va nomli yozuvlar). */
export const toProductMarkets = (response: unknown): ProductMarket[] => {
  const itemsRaw = getValueAtPath(response, ["data", "items"]);
  const items = Array.isArray(itemsRaw) ? itemsRaw : [];
  return items
    .filter(
      (item): item is { id: number; name: string; phone_number?: string | null; status?: string | null } =>
        typeof item === "object" && item !== null && "id" in item && "name" in item,
    )
    .map((item) => ({ id: item.id, name: item.name, phone: item.phone_number ?? "", status: item.status }));
};
