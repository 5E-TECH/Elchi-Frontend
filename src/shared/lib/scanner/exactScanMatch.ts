import type { TFunction } from "i18next";
import { getBackendMessage, getErrorKind, getErrorStatus } from "../errorKind";

/**
 * SKAN — FAQAT ANIQ MOSLIK (skan auditi 2026-11-23, #46 pochta, #54 buyurtmalar ro'yxati).
 *
 * Avval ro'yxat sahifalari (`/orders` menejer va kuryer «Bekor qilingan», `/mails/:id` jo'natish / rad etilgan) skan
 * javobidagi buyurtma ro'yxatda bo'lmasa «o'xshash» qatorni tanlardi: bir xil mijoz (id YOKI telefon YOKI faqat ISM) +
 * market (+ tuman). Natija — qo'ldagi B posilka o'rniga A tanlanardi («Tanlandi №A»), keyin A ning o'z skani
 * «Allaqachon tanlangan» derdi va jismonan skanerlanmagan posilka HQ'ga / pochtaga ketardi. Endi skan faqat AYNAN
 * o'sha buyurtmaga ta'sir qiladi:
 *
 *   1) qatorning o'z id'si yoki QR tokeni skan kalitiga teng;
 *   2) aks holda — qator skanerlangan buyurtmadan AJRALGAN (qatorning ota / manba id'si skanerlangan buyurtma, masalan
 *      qisman sotuvdan qolgan bola buyurtma — yorliq asl buyurtmaniki) va shunday qator BITTA.
 *
 * Aka-uka moslik (skanerlangan va qator bir otaning ikki bolasi) ham yo'q — u ham boshqa buyurtma.
 */

type AnyRecord = Record<string, unknown>;

const asRecord = (value: unknown): AnyRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {};

const keyText = (value: unknown) => {
  if (typeof value === "string") return value.trim().toLowerCase();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

const nonEmpty = (record: AnyRecord) => (Object.keys(record).length > 0 ? record : undefined);

/**
 * Skan javobi (`fetchScanDetail(...).data`) → buyurtma yozuvi. Shakllar: `{ data: {...} }` (global o'ram),
 * `{ data: { data: { order } } }`, `resource` / `payload` o'ramlari. Topilmasa — bo'sh obyekt.
 */
export const unwrapScannedOrder = (payload: unknown): AnyRecord => {
  const source = asRecord(payload);
  const data = asRecord(source.data ?? source);
  const nestedData = asRecord(data.data ?? data);
  const resource = asRecord(nestedData.resource ?? data.resource);
  const payloadData = asRecord(nestedData.payload ?? data.payload);
  return asRecord(
    nestedData.order ?? data.order ?? resource.order ?? payloadData.order ?? nonEmpty(resource) ?? nonEmpty(payloadData) ?? nestedData,
  );
};

const OWN_KEYS = ["id", "qr_code_token", "qrCodeToken"] as const;

/** Qator qaysi buyurtmadan ajralgan (qisman sotuv, bo'linish): ota / manba id'lari. */
const DERIVED_FROM_ID_KEYS = [
  "parent_order_id",
  "parentOrderId",
  // Kuryerning «Bekor qilingan» tabida backend `parent_order_id` ni shu nomga ko'chiradi (gateway
  // `normalizeCourierCancelledRowForDisplay`).
  "partial_parent_order_id",
  "partialParentOrderId",
  "original_order_id",
  "originalOrderId",
  "source_order_id",
  "sourceOrderId",
  "split_from_order_id",
  "splitFromOrderId",
  "cancelled_from_order_id",
  "cancelledFromOrderId",
  "partly_sold_order_id",
  "partlySoldOrderId",
  "root_order_id",
  "rootOrderId",
  "base_order_id",
  "baseOrderId",
] as const;

const DERIVED_FROM_OBJECT_KEYS = [
  "parent_order",
  "parentOrder",
  "original_order",
  "originalOrder",
  "source_order",
  "sourceOrder",
  "split_from_order",
  "splitFromOrder",
  "cancelled_from_order",
  "cancelledFromOrder",
] as const;

const collect = (record: AnyRecord, keys: readonly string[], target: Set<string>) => {
  keys.forEach((key) => {
    const text = keyText(record[key]);
    if (text) target.add(text);
  });
};

const ownKeysOf = (value: unknown) => {
  const keys = new Set<string>();
  collect(asRecord(value), OWN_KEYS, keys);
  return keys;
};

const derivedFromKeysOf = (value: unknown) => {
  const record = asRecord(value);
  const keys = new Set<string>();
  collect(record, DERIVED_FROM_ID_KEYS, keys);
  DERIVED_FROM_OBJECT_KEYS.forEach((key) => collect(asRecord(record[key]), OWN_KEYS, keys));
  return keys;
};

/**
 * Skanerlangan buyurtmaning o'z kalitlari: id va QR token (kichik harf) + `extra` (masalan skaner o'qigan xom kod
 * nomzodlari — javobda id bo'lmasa ham qator tokeni bilan moslanadi). Ota / manba id'lari KIRMAYDI.
 */
export const scannedOrderKeys = (scanned: unknown, extra: readonly string[] = []): Set<string> => {
  const keys = ownKeysOf(scanned);
  extra.forEach((candidate) => {
    const text = keyText(candidate);
    if (text) keys.add(text);
  });
  return keys;
};

const intersects = (left: ReadonlySet<string>, right: ReadonlySet<string>) => {
  for (const key of left) if (right.has(key)) return true;
  return false;
};

/** Ro'yxatdan skanerlangan buyurtmaning AYNAN o'zi (yuqoridagi qoida); topilmasa yoki noaniq — `undefined`. */
export const findExactScannedRow = <T>(rows: readonly T[], keys: ReadonlySet<string>): T | undefined => {
  if (keys.size === 0) return undefined;
  const own = rows.find((row) => intersects(ownKeysOf(row), keys));
  if (own) return own;
  const derived = rows.filter((row) => intersects(derivedFromKeysOf(row), keys));
  return derived.length === 1 ? derived[0] : undefined;
};

/** Skan javobidagi buyurtma id'si (bo'sh — buyurtma emas yoki id yo'q). */
export const scannedOrderId = (scanned: unknown): string => {
  const id = asRecord(scanned).id;
  if (typeof id === "string") return id.trim();
  return typeof id === "number" && Number.isFinite(id) ? String(id) : "";
};

/** 404 — kod bo'yicha buyurtma yo'q: haqiqiy «topilmadi». */
export const isScanLookupNotFound = (error: unknown) => getErrorStatus(error) === 404;

/**
 * Skan qidiruvi bajarilmadi (javobsiz, vaqt tugadi, 5xx, 429 …) — bu «topilmadi» EMAS (skan auditi #48, #56): qayta
 * skan odatda o'tadi. Qaytadi — sabab matni; sarlavhani sahifa o'z nomlar fazosidan beradi («Tekshirib bo'lmadi —
 * qayta skanerlang»). Matnlar `ui` nomlar fazosidagi xato holatlaridan; `tooMany` (429, so'rov cheklovi) — sahifadan.
 * Qidiruv `failFast` (jim qayta urinishsiz), shuning uchun bitta uzilish ham shu yerga tushadi.
 */
export const scanLookupFailureReason = (t: TFunction, error: unknown, texts: { tooMany: string }): string => {
  const status = getErrorStatus(error);
  if (status === 429) return texts.tooMany;
  switch (getErrorKind(error)) {
    case "offline":
      return t("ui:states.error.offline.title");
    case "timeout":
      return t("ui:states.error.timeout.description");
    case "server":
      return t("ui:states.error.server.description", { status: status ?? 500 });
    default:
      return (
        getBackendMessage(error) ??
        (status
          ? t("ui:states.error.generic.description", { status })
          : t("ui:states.error.generic.descriptionNoStatus"))
      );
  }
};
