import { formatOrderRef } from "../../../entities/order/model/orderNumber";
import { normalizeOrderStatus } from "../../../entities/order/model/statusRegistry";
import type { OrderStatus } from "../../../entities/order/types/order";
import { CURRENCY_LABEL, formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { parseUzbekPhone } from "../../../shared/lib/formatPhone";
import { normalizeReceiptText } from "./printReceiptFonts";
import {
  cleanReceiptValue,
  formatReceiptPhone,
  getReceiptContactPhones,
  type ReceiptContactSource,
} from "./receiptContact";

/**
 * BUYURTMA CHEKI MODELI (HJ5sLHiz, maket `tizim-receipts` 01, TZ F3–F4). Kirish turi o'zida — `pages/*` dan import yo'q:
 * `ApiOrder` («Qabul va yaratish», buyurtma tafsiloti) ham, `PostOrder` (pochta) ham shu shaklga mos keladi.
 * Chek matni doim o'zbekcha (lotin); qiymatlar kiritilganidek (kirill ham). Bo'sh maydon — `""`: chekda chiqmaydi,
 * «-» / «—» hech qachon chop etilmaydi.
 */

export interface ReceiptNamed {
  name?: string | null;
}

export interface ReceiptOrderItemSource {
  quantity?: number | string | null;
  product?: ReceiptNamed | null;
  /** Hamkor (Partner API) buyurtmasi: katalogda yo'q — nom matn bo'lib keladi. */
  product_name?: string | null;
}

export interface ReceiptOrderSource extends ReceiptContactSource {
  id: string | number;
  /** «EL-100081» (rwAy8Qyk). Pochta qatorlarida BE-1 dan keyin keladi; yo'q — `№{id}`. */
  order_number?: string | null;
  qr_code_token?: string | null;
  status?: string | null;
  where_deliver?: string | null;
  /** Kelmasa (LOGIST proyeksiyasi) — summa ramkasi chizilmaydi. */
  total_price?: number | string | null;
  /** Mijoz onlayn to'lagan qism (`order.entity.ts`); kelmasa — 0. */
  paid_online_amount?: number | string | null;
  createdAt?: string | null;
  comment?: string | null;
  address?: string | null;
  /** Pochta qatoridagi qo'shimcha raqam (`customer.extra_number` dan ustun). */
  extra_number?: string | null;
  items?: ReadonlyArray<ReceiptOrderItemSource> | null;
  customer?: {
    name?: string | null;
    phone_number?: string | null;
    extra_number?: string | null;
    address?: string | null;
    region?: ReceiptNamed | null;
    district?: ReceiptNamed | null;
  } | null;
  district?: (ReceiptNamed & { region?: ReceiptNamed | null }) | null;
  region?: ReceiptNamed | null;
  market?: { name?: string | null; phone_number?: string | null } | null;
}

/**
 * Ramkadagi summa (maket 01 · 2): kuryer mijozdan oladigan pul yoki holat yorlig'i.
 * `collect` — raqam (valyutasiz, «185 000»), `total` — qisman onlayn to'langanda ostidagi «jami …» (valyutasiz).
 */
export type ReceiptAmount =
  { kind: "collect"; value: string; total: string | null } | { kind: "label"; text: string };

export interface ReceiptOrderModel {
  /** Ichki id (davomi sahifalarini bog'lash, T8 kategoriya yorlig'i uchun). */
  id: string;
  /** «№EL-100081»; zaxira «№81». */
  ref: string;
  /** QR mazmuni — faqat token; yo'q — `null` (id kodlanmaydi, «QR yo'q» ramkasi). */
  qrToken: string | null;
  /** `null` — pul maydoni kelmagan (LOGIST): ramka chizilmaydi. */
  amount: ReceiptAmount | null;
  name: string;
  phone: string;
  extraPhone: string;
  /** «Toshkent sh. · Yashnobod tumani». */
  region: string;
  /** Ko'cha, uy, mo'ljal. */
  street: string;
  /** «UYGACHA» / «MARKAZGACHA» (qora yorliq, bosh harflar). */
  delivery: string;
  /** «23.10.2026» (Toshkent vaqti). */
  date: string;
  /** «Smart soat X8 Pro ×1». */
  products: string[];
  comment: string;
  /** Jo'natuvchi — market nomi. */
  sender: string;
  /** «Muammo bo'lsa» raqamlari. */
  contacts: string[];
}

/** Chek matnlari (doim o'zbekcha — maket «Til va format»). */
export const RECEIPT_TEXT = Object.freeze({
  currency: CURRENCY_LABEL.uz,
  paid: "To'langan",
  returning: "Qaytarish",
  home: "UYGACHA",
  center: "MARKAZGACHA",
  productFallback: "Mahsulot",
  total: "jami",
  comment: "Izoh:",
  address: "Manzil:",
  sender: "Jo'natuvchi:",
  contact: "Muammo bo'lsa:",
  noQr: "QR yo'q",
});

/** Ega qarori 3 (2026-10-29): qaytayotgan buyurtma qayta chop etilsa — ramkada «Qaytarish». */
const RETURN_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  "cancelled",
  "cancelled (sent)",
  "returned_to_market",
]);
/** …pul allaqachon olingan — «To'langan». */
const SETTLED_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  "sold",
  "paid",
  "partly_paid",
  "closed",
]);

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  return null;
};

const money = (value: number) =>
  formatMoneyLocalized(value, { language: "uz", withCurrency: false });

/**
 * Ega qarori 1 (2026-10-29): ramkadagi summa = max(0, `total_price` − `paid_online_amount`) — `to_be_paid` emas
 * (u sotuvgacha 0 va marketga to'lanadigan pul). Qisman onlayn to'langanda ostida «jami {total_price}»; 0 — «To'langan».
 */
export const receiptAmountOf = (
  source: Pick<ReceiptOrderSource, "total_price" | "paid_online_amount" | "status">,
): ReceiptAmount | null => {
  const total = toNumber(source.total_price);
  if (total === null) return null;
  const status = normalizeOrderStatus(source.status);
  if (status && RETURN_STATUSES.has(status)) return { kind: "label", text: RECEIPT_TEXT.returning };
  if (status && SETTLED_STATUSES.has(status)) return { kind: "label", text: RECEIPT_TEXT.paid };
  const paidOnline = Math.max(0, toNumber(source.paid_online_amount) ?? 0);
  const collect = Math.max(0, Math.round(total - paidOnline));
  if (collect === 0) return { kind: "label", text: RECEIPT_TEXT.paid };
  return {
    kind: "collect",
    value: money(collect),
    total: paidOnline > 0 ? money(Math.max(0, Math.round(total))) : null,
  };
};

/** Toshkent vaqti (UTC+5, yozgi vaqtsiz) — brauzer mintaqasidan qat'i nazar. */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const pad2 = (value: number) => String(value).padStart(2, "0");

/** «23.10.2026» yoki `withTime` bilan «23.10.2026, 14:15» (paket cheki). Noto'g'ri / bo'sh — `""`. */
export const formatReceiptDate = (value: unknown, withTime = false): string => {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) return "";
  if (typeof value === "string" && !value.trim()) return "";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "";
  const local = new Date(time + TASHKENT_OFFSET_MS);
  const date = `${pad2(local.getUTCDate())}.${pad2(local.getUTCMonth() + 1)}.${local.getUTCFullYear()}`;
  return withTime ? `${date}, ${pad2(local.getUTCHours())}:${pad2(local.getUTCMinutes())}` : date;
};

/**
 * Birinchi to'ldirilgan qiymat. Bo'sh joy tutuvchi («-», «—», «...», «null» — `cleanReceiptValue`) bo'sh hisoblanadi:
 * chekda chiqmaydi va keyingi manbaga o'tiladi.
 */
const firstText = (...values: unknown[]) => {
  for (const value of values) {
    const text = cleanReceiptValue(normalizeReceiptText(value));
    if (text) return text;
  }
  return "";
};

/** Telefon maydonlaridan birinchi raqamlisi (`formatReceiptPhone`; «-», «—» — bo'sh). */
const firstPhone = (...values: unknown[]) => {
  for (const value of values) {
    const phone = formatReceiptPhone(normalizeReceiptText(value));
    if (phone) return phone;
  }
  return "";
};

const samePhone = (a: string, b: string) => {
  if (!a || !b) return false;
  const digits = (value: string) => parseUzbekPhone(value) ?? value.replace(/\D/g, "");
  return digits(a) === digits(b);
};

const productLine = (item: ReceiptOrderItemSource) => {
  const name = firstText(item.product?.name, item.product_name) || RECEIPT_TEXT.productFallback;
  const quantity = toNumber(item.quantity);
  return quantity !== null && quantity > 0 ? `${name} ×${Math.round(quantity)}` : name;
};

/** Manba → chek maydonlari (TZ F3 jadvali). */
export const toReceiptOrderModel = (source: ReceiptOrderSource): ReceiptOrderModel => {
  const customer = source.customer ?? null;
  const phone = firstPhone(customer?.phone_number);
  const extra = firstPhone(source.extra_number, customer?.extra_number);
  const regionName = firstText(
    customer?.region?.name,
    source.region?.name,
    source.district?.region?.name,
  );
  const districtName = firstText(customer?.district?.name, source.district?.name);
  const region = [regionName, districtName]
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join(" · ");
  const token = typeof source.qr_code_token === "string" ? source.qr_code_token.trim() : "";
  return {
    id: String(source.id),
    // «-» kabi `order_number` — yo'q hisoblanadi (zaxira «№{id}»).
    ref: normalizeReceiptText(
      formatOrderRef({ id: source.id, order_number: firstText(source.order_number) }),
    ),
    qrToken: token || null,
    amount: receiptAmountOf(source),
    name: firstText(customer?.name),
    phone,
    extraPhone: samePhone(extra, phone) ? "" : extra,
    region,
    street: firstText(source.address, customer?.address),
    delivery: source.where_deliver === "center" ? RECEIPT_TEXT.center : RECEIPT_TEXT.home,
    date: formatReceiptDate(source.createdAt),
    products: (source.items ?? []).map(productLine),
    comment: firstText(source.comment),
    sender: firstText(source.market?.name),
    contacts: getReceiptContactPhones(source),
  };
};
