import { resolveAssetUrl } from "../../../../shared/lib/assetUrl";
import type { EditableOrderSnapshot } from "../newOrderUpdateRules";

/**
 * BUYURTMA TAFSILOTI (`/orders/edit/:orderId`) — ma'lumot modeli.
 *
 * `GET orders/:id` javobining openapi sxemasi yo'q va maydonlar har xil keladi (hamkor posilkasida
 * `product` null, summa matn `"150000.00"`, mock API esa bo'sh `{}`). Sahifa xom javobga tayanmaydi:
 * avval `normalizeOrderDetail` bilan tozalanadi, `id` bo'lmasa — «topilmadi» (ilgari
 * `normalizeOrderStatus(undefined).trim` sahifani `/runtime-error` ga tashlardi).
 */

export interface OrderDetailDistrict {
  id?: string;
  name?: string;
  region_id?: string;
  region?: { id?: string; name?: string };
}

export interface OrderDetailItem {
  id: string;
  quantity: number;
  image?: string | null;
  image_url?: string | null;
  product: {
    id: string;
    name?: string | null;
    image?: string | null;
    image_url?: string | null;
    imageUrl?: string | null;
    photo?: string | null;
    photo_url?: string | null;
    file?: string | null;
    url?: string | null;
  } | null;
  /** Hamkor posilkalarida `product` null keladi: id va nom shu maydonlarda. */
  product_id?: string | null;
  product_name?: string | null;
}

export interface OrderDetailCustomer {
  id: string;
  name: string;
  phone_number: string;
}

export interface OrderDetail extends EditableOrderSnapshot {
  id: string;
  status: string;
  where_deliver: string;
  /** Har doim son (backend `"150000.00"` matn ham yuboradi). */
  total_price: number;
  to_be_paid: number;
  paid_amount: number;
  comment: string | null;
  address: string | null;
  district_id?: string;
  district?: OrderDetailDistrict;
  region?: { id?: string; name?: string };
  items: OrderDetailItem[];
  customer: OrderDetailCustomer;
  [key: string]: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asText = (value: unknown): string => (typeof value === "string" ? value : "");

const asId = (value: unknown): string =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

/** Pul maydoni: son yoki son ko'rinishidagi matn; boshqasi — 0. */
const asAmount = (value: unknown): number => {
  const amount = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(amount) ? amount : 0;
};

/** `{ statusCode, data: {...} }` o'rami yoki to'g'ridan-to'g'ri buyurtma. */
export const unwrapOrderDetail = (response: unknown): Record<string, unknown> | null => {
  if (!isRecord(response)) return null;
  if (isRecord(response.data)) return response.data;
  return response;
};

/**
 * Xom javob → sahifa ishlatadigan buyurtma. `id` yo'q (mock API `{}`, o'chirilgan buyurtma) — `null`.
 * Qolgan xom maydonlar (market, post_id, holder_*, proof_files …) o'zgarmasdan saqlanadi.
 */
export const normalizeOrderDetail = (response: unknown): OrderDetail | null => {
  const raw = unwrapOrderDetail(response);
  if (!raw) return null;
  const id = asId(raw.id);
  if (!id) return null;

  const customer = isRecord(raw.customer) ? raw.customer : {};
  const items = Array.isArray(raw.items) ? raw.items.filter(isRecord) : [];

  return {
    ...raw,
    id,
    status: asText(raw.status),
    where_deliver: asText(raw.where_deliver),
    total_price: asAmount(raw.total_price),
    to_be_paid: asAmount(raw.to_be_paid),
    paid_amount: asAmount(raw.paid_amount),
    comment: typeof raw.comment === "string" ? raw.comment : null,
    address: typeof raw.address === "string" ? raw.address : null,
    district: isRecord(raw.district) ? (raw.district as OrderDetailDistrict) : undefined,
    region: isRecord(raw.region) ? (raw.region as OrderDetail["region"]) : undefined,
    items: items.map((item, index) => ({
      ...(item as unknown as OrderDetailItem),
      id: asId(item.id) || `item-${index}`,
      quantity: asAmount(item.quantity),
      product: isRecord(item.product) ? (item.product as OrderDetailItem["product"]) : null,
    })),
    customer: {
      ...customer,
      id: asId(customer.id),
      name: asText(customer.name),
      phone_number: asText(customer.phone_number),
    },
  };
};

/** Yaratilgan vaqt: `createdAt` (enriched javob) yoki `created_at`. */
export const readOrderCreatedAt = (order: OrderDetail): string | number | null => {
  const value = order.createdAt ?? order.created_at;
  return typeof value === "string" || typeof value === "number" ? value : null;
};

/** Buyurtmaning marketi (nom va dalil shartlari) — `GET orders/:id` enriched javobida keladi. */
export const readOrderMarket = (order: OrderDetail | null) => {
  const raw = order?.market;
  if (!isRecord(raw)) return null;
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : null;
  return {
    name,
    expense_proof_conditions: Array.isArray(raw.expense_proof_conditions)
      ? raw.expense_proof_conditions.filter((item): item is string => typeof item === "string")
      : null,
  };
};

export const getRegionName = (order: OrderDetail) => order.district?.region?.name ?? order.region?.name ?? null;

export const getDistrictName = (order: OrderDetail) => order.district?.name ?? null;

/** Katalogsiz qator (hamkor/marketplace posilkasi): `product` yo'q, nom `product_name` da. */
export const isCatalogLessItem = (item: OrderDetailItem) =>
  !item.product && typeof item.product_name === "string" && item.product_name.trim() !== "";

export const getProductImageUrl = (item: OrderDetailItem) =>
  resolveAssetUrl(
    item.product?.image_url ??
      item.product?.imageUrl ??
      item.product?.image ??
      item.product?.photo_url ??
      item.product?.photo ??
      item.product?.file ??
      item.product?.url ??
      item.image_url ??
      item.image,
  );

type NamedRef = { id?: string | number | null; name?: string | null; title?: string | null } | null | undefined;

/** Tarix (tracking) jumlalaridagi filial / pochta / market nomlari — buyurtmaning o'zidan. */
export const buildTrackingContext = (order: OrderDetail | null) => {
  const source = (order ?? {}) as {
    branch?: NamedRef;
    destination_branch?: NamedRef;
    target_branch?: NamedRef;
    market?: NamedRef;
    post?: NamedRef;
    branch_id?: string | number | null;
    destination_branch_id?: string | number | null;
    target_branch_id?: string | number | null;
    market_id?: string | number | null;
    branch_name?: string | null;
    destination_branch_name?: string | null;
    target_branch_name?: string | null;
    market_name?: string | null;
    post_name?: string | null;
  };
  const branchNamesById: Record<string, string> = {};
  const marketNamesById: Record<string, string> = {};
  const add = (target: Record<string, string>, id?: string | number | null, name?: string | null) => {
    if (id != null && name) target[String(id)] = name;
  };

  add(branchNamesById, source.branch?.id ?? source.branch_id, source.branch?.name ?? source.branch_name);
  add(
    branchNamesById,
    source.destination_branch?.id ?? source.destination_branch_id,
    source.destination_branch?.name ?? source.destination_branch_name,
  );
  add(
    branchNamesById,
    source.target_branch?.id ?? source.target_branch_id,
    source.target_branch?.name ?? source.target_branch_name,
  );
  add(
    marketNamesById,
    source.market?.id ?? source.market_id,
    source.market?.name ?? source.market?.title ?? source.market_name,
  );

  return {
    // Jo'natish jumlasidagi filial («… pochtani HQ'dan Urgut filialiga jo'natdi»): aniq manzil filiali bo'lmasa —
    // buyurtmaning o'z filiali (`branch`; jo'natilgach `branch_id` manzil filialiga o'tadi). Ilgari bu e'tiborsiz
    // qolib, jumla «Filial filialiga» bo'lib chiqardi (D-05).
    branchName:
      source.destination_branch?.name ??
      source.target_branch?.name ??
      source.destination_branch_name ??
      source.target_branch_name ??
      source.branch?.name ??
      source.branch_name ??
      null,
    postName: source.post?.name ?? source.post?.title ?? source.post_name ?? null,
    marketName: source.market?.name ?? source.market?.title ?? source.market_name ?? null,
    branchNamesById,
    marketNamesById,
  };
};

/** Sotish / bekor qilish / qaytarish oynalariga beriladigan buyurtma (`ActionOrder` shakli). */
export const buildActionOrder = (order: OrderDetail | null) => {
  if (!order) return null;
  const market = readOrderMarket(order);
  return {
    id: order.id,
    created_at: "",
    status: order.status,
    total_price: order.total_price,
    where_deliver: order.where_deliver,
    product_quantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
    market: { name: market?.name ?? "-", expense_proof_conditions: market?.expense_proof_conditions ?? null },
    customer: { name: order.customer.name, phone_number: order.customer.phone_number },
    district: { name: getDistrictName(order) ?? "—" },
    region: { name: getRegionName(order) ?? "—" },
    // «Marketga to'langan summa» chegarasi va hamkor buyurtmasini aniqlash (uguUEhin).
    to_be_paid: order.to_be_paid,
    sale_market_paid_max:
      typeof order.sale_market_paid_max === "number" || typeof order.sale_market_paid_max === "string"
        ? order.sale_market_paid_max
        : null,
    external_id: (order.external_id ?? order.externalId ?? null) as string | number | null,
    sell_requires_media: Boolean(
      order.sell_requires_media ?? order.sellRequiresMedia ?? order.require_sell_proof ?? order.sell_proof_required,
    ),
    cancel_requires_media: Boolean(
      order.cancel_requires_media ??
        order.cancelRequiresMedia ??
        order.require_cancel_proof ??
        order.cancel_proof_required,
    ),
    // Katalog id bo'lmasa (hamkor posilkasi) qator id'si product_id O'RNIGA qo'yilmaydi — SellModal
    // qatorni `order_item_id` (item.id) bilan yuboradi.
    items: order.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      product_id: item.product?.id ?? item.product_id ?? null,
      product_name: item.product?.name ?? item.product_name ?? null,
      product: {
        id: item.product?.id ?? item.product_id ?? null,
        name: item.product?.name ?? item.product_name ?? "",
        image_url: item.product?.image_url ?? null,
      },
    })),
  };
};

export type DetailActionOrder = NonNullable<ReturnType<typeof buildActionOrder>>;

/** Tarixni ko'rish huquqi uchun buyurtmaning kimda turgani (holder). */
export const buildTrackingAccess = (order: OrderDetail | null) => ({
  holderType: (order?.holder_type ?? order?.holderType ?? null) as string | null,
  holderBranchId: (order?.holder_branch_id ?? order?.holderBranchId ?? null) as string | number | null,
  holderCourierId: (order?.holder_courier_id ?? order?.holderCourierId ?? null) as string | number | null,
});
