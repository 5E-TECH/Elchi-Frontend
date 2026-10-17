import type { OrderListItem } from "../../../entities/order/types/order";
import { normalizeScannerCandidates } from "../../../shared/lib/scanToken";
import type { ApiOrder } from "../model/apiOrder";

/**
 * BEKOR QILINGANLARNI MARKETGA TOPSHIRISH (`/new-orders/cancelled/:marketId`) — sof yordamchilar.
 *
 * Sahifa (`detail.tsx`) va uning qismlari (`ui/*`) shu yerdagi qoidalardan foydalanadi; hammasi
 * `cancelledModel.test.ts` da tekshiriladi. Market QR, avtorizatsiya tokeni va skaner matnini o'qish
 * funksiyalari dizayn v2 gacha `detail.tsx` ichida edi — mantiq AYNAN o'sha (faqat ko'chirildi).
 */

export type CancelledMarketQr = {
  image?: string;
  token?: string;
  payload?: string;
};

export type CancelledHandoverAuthorization = {
  authorizationToken: string;
  expiresAt: number;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? value as Record<string, unknown> : {};

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }

  return "";
};

const normalizeQrImage = (value: string) => {
  if (!value) return "";
  if (value.startsWith("data:") || value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  if (value.trim().startsWith("<svg")) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`;
  }

  return /^[A-Za-z0-9+/=]+$/.test(value) && value.length > 120
    ? `data:image/png;base64,${value}`
    : "";
};

/** `POST orders/markets/:id/cancelled/qr` javobi → QR rasm, token yoki matn (market roli). */
export const normalizeCancelledMarketQr = (response: unknown): CancelledMarketQr => {
  const source = asRecord(response);
  const data = asRecord(source.data ?? source);
  const qr = asRecord(data.qr ?? data.qrCode ?? data.qr_code);
  const image = firstText(
    data.qr_image,
    data.qrImage,
    data.qr_url,
    data.qrUrl,
    data.image,
    data.url,
    qr.image,
    qr.url,
  );
  const token = firstText(
    data.token,
    data.qr_code_token,
    data.qrCodeToken,
    data.qr_token,
    qr.token,
    qr.qr_code_token,
  );
  const payload = firstText(data.payload, data.value, data.code, qr.payload, qr.value, token, image);

  return {
    image: normalizeQrImage(image),
    token,
    payload,
  };
};

/** `POST scan/market-cancelled` javobi → topshirish tokeni va muddati (muddat yo'q bo'lsa — 300 s). */
export const normalizeCancelledAuthorization = (
  response: unknown,
): CancelledHandoverAuthorization => {
  const source = asRecord(response);
  const data = asRecord(source.data ?? source);
  const authorizationToken = firstText(
    data.authorization_token,
    data.authorizationToken,
    data.token,
  );
  const expiresAtText = firstText(data.expires_at, data.expiresAt);
  const expiresAtFromResponse = expiresAtText ? new Date(expiresAtText).getTime() : NaN;
  const remainingSeconds = Number(data.remaining_seconds ?? data.remainingSeconds ?? 300);
  const expiresAt = Number.isFinite(expiresAtFromResponse)
    ? expiresAtFromResponse
    : Date.now() + Math.max(1, remainingSeconds) * 1000;

  if (!authorizationToken) {
    throw new Error("Authorization token is missing");
  }

  return { authorizationToken, expiresAt };
};

export const getDecodedScannerText = (rawValue: string) => {
  const candidates = normalizeScannerCandidates(rawValue, window.location.origin);
  return [rawValue, ...candidates].map((item) => item.trim()).filter(Boolean);
};

const parseQrJson = (value: string) => {
  try {
    return asRecord(JSON.parse(value));
  } catch {
    return {};
  }
};

/** Skaner o'qigan matn shu marketning bekor qilinganlar QR kodimi (`MCR-…`, matn yoki JSON). */
export const scannerContainsMarketCancelledQr = (rawValue: string, marketId: string) => {
  const marketKey = String(marketId).toLowerCase();

  return getDecodedScannerText(rawValue).some((candidate) => {
    const text = candidate.toLowerCase();
    if (text.startsWith("mcr-")) {
      return true;
    }

    if (text.includes("cancelled") && text.includes("market") && text.includes(marketKey)) {
      return true;
    }

    const parsed = parseQrJson(candidate);
    const parsedMarketId = firstText(parsed.market_id, parsed.marketId, asRecord(parsed.market).id);
    const parsedType = firstText(parsed.type, parsed.kind, parsed.action);

    return parsedMarketId === marketId && parsedType.toLowerCase().includes("cancel");
  });
};

export const extractMarketCancelledQrToken = (rawValue: string) =>
  getDecodedScannerText(rawValue).find((candidate) =>
    candidate.trim().toUpperCase().startsWith("MCR-"),
  ) ?? "";

export const toOrderCardData = (order: OrderListItem): ApiOrder => ({
  id: order.id,
  qr_code_token: order.qr_code_token,
  status: order.status,
  where_deliver: order.where_deliver,
  total_price: order.total_price,
  paid_amount: order.paid_amount,
  to_be_paid: order.to_be_paid,
  createdAt: order.createdAt,
  comment: order.comment,
  address: order.address,
  /**
   * Katalog bog'lanishi bo'lmasa SOXTA `product` yasamaymiz.
   *
   * Hamkor (Partner API) buyurtmalarida mahsulot bizning katalogda yo'q:
   * `product_id` bo'sh, nom esa `product_name` da matn bo'lib keladi.
   * Avval bu yerda `product: { id: item.product_id, ... }` qurilardi va
   * id `null` bo'lib ketardi — ya'ni mavjud bo'lmagan mahsulotga havola.
   * Endi nom o'z maydonida uzatiladi, kartochka esa ikkalasini ham biladi.
   */
  items: (order.items ?? []).map((item) => ({
    id: item.id,
    quantity: item.quantity,
    product_name: item.product_name ?? null,
    product: item.product
      ? {
          id: item.product.id,
          name: item.product.name,
          image_url: item.product.image_url ?? null,
        }
      : null,
  })),
  customer: {
    id: order.customer?.id ?? order.customer_id,
    name: order.customer?.name ?? "—",
    phone_number: order.customer?.phone_number ?? "—",
    district: order.district ? { name: order.district.name } : undefined,
    region: order.district?.region ? { name: order.district.region.name } : undefined,
  },
  district: order.district ? { name: order.district.name } : undefined,
  region: order.district?.region ? { name: order.district.region.name } : undefined,
});

export const formatCountdown = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

export const getOrderProductNames = (order: OrderListItem) =>
  order.items
    .map((item) => item.product?.name ?? item.product_name ?? `#${item.product_id}`)
    .filter(Boolean)
    .join(", ");

// ─── Dizayn v2: sahifa holati ─────────────────────────────────────────────────

/** Ekran o'quvchi uchun qolgan vaqt: «4 daqiqa 12 soniya» (`role="timer"` nomi). */
export const splitCountdown = (seconds: number): { minutes: number; seconds: number } => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return { minutes: Math.floor(safeSeconds / 60), seconds: safeSeconds % 60 };
};

/**
 * Market QR bosqichi (sahifa ogohlantirishi va «Marketga jo'natish» shu bo'yicha):
 *  - `notRequired` — marketda `cancelled_handover_qr_required === false`: QR kerak emas;
 *  - `required`    — QR kerak va hali skanerlanmagan (yoki muddati tugagan);
 *  - `scanned`     — market QR skanerlangan, topshirish tokeni amal qilmoqda.
 */
export type HandoverQrStage = "notRequired" | "required" | "scanned";

export const resolveHandoverQrStage = ({
  qrRequired,
  qrScanned,
  authorizationToken,
}: {
  qrRequired: boolean;
  qrScanned: boolean;
  authorizationToken: string;
}): HandoverQrStage => {
  if (!qrRequired) return "notRequired";
  return qrScanned && authorizationToken ? "scanned" : "required";
};

/**
 * «Marketga jo'natish» mumkinmi — v1 dagi shart AYNAN: tanlov bor, so'rov ketmayapti, market ma'lum va
 * QR talab qilinsa — skanerlangan va token bor. (Market QR'siz jo'natish faqat marketda QR o'chirilgan bo'lsa.)
 */
export const canSendHandover = ({
  selectedCount,
  pending,
  marketId,
  qrRequired,
  qrScanned,
  authorizationToken,
}: {
  selectedCount: number;
  pending: boolean;
  marketId: string;
  qrRequired: boolean;
  qrScanned: boolean;
  authorizationToken: string;
}): boolean =>
  selectedCount > 0 &&
  !pending &&
  Boolean(marketId) &&
  !(qrRequired && (!qrScanned || !authorizationToken));
