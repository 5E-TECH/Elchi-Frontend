/**
 * Biriktirish savatidagi buyurtma — `GET orders/qr-code/:token` (skan) javobidan. `/dispatch` sahifasi va
 * `/scan/:token` dagi «Kuryerga biriktirish» bir xil shaklni savatga qo'yadi (avval `pages/dispatch/model`
 * da edi; savat qurilmada saqlangani uchun ikki sahifa uni shu yerdan oladi).
 */
export type DispatchOrder = {
  id: string;
  /** Skanerlangan token (takrorni aniqlash uchun). */
  token: string;
  market: string | null;
  name: string | null;
  phone: string | null;
  district: string | null;
  region: string | null;
  amount: number;
  /** Xom `where_deliver`: `address` / `home` — uygacha, `center` — markazgacha. */
  deliveryKind: DispatchDeliveryKind | null;
  /** Xom sana (ISO) — `formatDateTimeLocalized` uchun. */
  createdAt: string | null;
  status: string | null;
};

export type DispatchDeliveryKind = "home" | "center";

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" ? (value as UnknownRecord) : {};

const text = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

const unwrapOrderPayload = (payload: unknown) => {
  const source = asRecord(payload);
  const responseData = asRecord(source.data ?? source);
  const responsePayload = asRecord(responseData.data ?? responseData);
  return asRecord(responsePayload.order ?? responseData.order ?? responsePayload);
};

export const readDeliveryKind = (value: unknown): DispatchDeliveryKind | null => {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "address" || raw === "home") return "home";
  if (raw === "center") return "center";
  return null;
};

/** Skan javobidan ro'yxat qatori; buyurtma `id` si bo'lmasa — `null`. */
export const normalizeDispatchOrder = (payload: unknown, token: string): DispatchOrder | null => {
  const order = unwrapOrderPayload(payload);
  const id = text(order.id);
  if (!id) return null;

  const market = asRecord(order.market);
  const sender = asRecord(order.sender);
  const customer = asRecord(order.customer);
  const district = asRecord(order.district ?? customer.district);
  const region = asRecord(order.region ?? district.region ?? customer.region);

  return {
    id,
    token,
    market: text(market.name ?? sender.name),
    name: text(customer.fullName ?? customer.full_name ?? customer.name ?? order.customer_name ?? order.name),
    phone: text(customer.phone_number ?? customer.phone ?? order.phone_number ?? order.phone),
    district: text(district.name ?? order.district_name),
    region: text(region.name ?? order.region_name),
    amount: Number(order.total_price ?? 0) || 0,
    deliveryKind: readDeliveryKind(order.where_deliver ?? order.delivery_type ?? order.deliveryType),
    createdAt: text(order.createdAt ?? order.created_at ?? order.updatedAt ?? order.updated_at),
    status: text(order.status),
  };
};

const nullableText = (value: unknown): string | null => (typeof value === "string" && value ? value : null);

/**
 * Qurilmadan o'qilgan (ishonchsiz) yozuv → buyurtma: majburiy maydonlar (`id`, `token`) bo'lmasa `null`,
 * qolgan maydon noto'g'ri turda bo'lsa — bo'sh qiymat (eski versiya yoki qo'lda o'zgartirilgan `localStorage`).
 */
export const sanitizeDispatchOrder = (value: unknown): DispatchOrder | null => {
  const source = asRecord(value);
  const id = typeof source.id === "string" && source.id.trim() ? source.id : null;
  const token = typeof source.token === "string" && source.token.trim() ? source.token : null;
  if (!id || !token) return null;
  const amount = typeof source.amount === "number" && Number.isFinite(source.amount) ? source.amount : 0;
  return {
    id,
    token,
    market: nullableText(source.market),
    name: nullableText(source.name),
    phone: nullableText(source.phone),
    district: nullableText(source.district),
    region: nullableText(source.region),
    amount,
    deliveryKind: source.deliveryKind === "home" || source.deliveryKind === "center" ? source.deliveryKind : null,
    createdAt: nullableText(source.createdAt),
    status: nullableText(source.status),
  };
};
