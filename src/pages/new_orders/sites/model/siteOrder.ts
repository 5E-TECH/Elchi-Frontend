/**
 * «TASHQI SAYTLAR» — saytdan QR bo'yicha olingan buyurtmani o'qish (sof funksiyalar, test shu yerda).
 *
 * Sayt (masalan Adosh, Donoxon) bizga buyurtma YUBORMAYDI: posilkada saytning QR'i bor, operator uni skanerlaydi va
 * Elchi saytning API'sidan buyurtmani so'raydi (`POST integrations/:slug/search-by-qr`). Javob saytning O'Z shaklida
 * keladi — maydon nomlari ulanishning `field_mapping` ida yoziladi.
 *
 * ⚠️ XARITA VA SUKUTLAR BACKEND BILAN AYNAN BIR XIL (`order-lifecycle.service.ts` → `receiveExternalOrders`). Ro'yxatda
 * ko'ringan ism, telefon va summa «Qabul qilish» dan keyin yaratiladigan buyurtmada ham xuddi shunday bo'lishi kerak:
 * aks holda operator bir narsani ko'rib, tizimga boshqasi tushardi. Yo'l nuqtali (`customer.name`) — backend
 * `getFieldValue` kabi.
 */

import { readItemsText } from "./siteItemsText";

/** Ulanishdagi maydon nomlari (`field_mapping`) — faqat ro'yxatda va qabulda kerak bo'ladiganlari. */
export type SiteFieldMapping = {
  id_field: string;
  qr_code_field: string;
  customer_name_field: string;
  phone_field: string;
  address_field: string;
  district_code_field: string;
  region_code_field: string;
  comment_field: string;
  total_price_field: string;
  delivery_price_field: string;
  items_field: string;
  item_name_field: string;
  item_qty_field: string;
  total_count_field: string;
};

/** Backend sukutlari (`fieldMapping.x ?? '<sukut>'`). */
export const DEFAULT_SITE_MAPPING: SiteFieldMapping = {
  id_field: "id",
  qr_code_field: "qr_code",
  customer_name_field: "full_name",
  phone_field: "phone",
  address_field: "address",
  district_code_field: "district",
  region_code_field: "region",
  comment_field: "comment",
  total_price_field: "total_price",
  delivery_price_field: "delivery_price",
  items_field: "items",
  item_name_field: "name",
  item_qty_field: "quantity",
  total_count_field: "total_count",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Ulanishning `field_mapping` i (har xil shaklda kelishi mumkin) → to'liq xarita. Bo'sh qiymat — sukut. */
export const readSiteMapping = (fieldMapping: unknown): SiteFieldMapping => {
  const source = isRecord(fieldMapping) ? fieldMapping : {};
  const next = { ...DEFAULT_SITE_MAPPING };
  (Object.keys(next) as (keyof SiteFieldMapping)[]).forEach((key) => {
    const value = source[key];
    if (typeof value === "string" && value.trim()) next[key] = value.trim();
  });
  return next;
};

/** `a.b.c` yo'li bo'yicha qiymat (backend `getFieldValue`). */
export const readPath = (value: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((acc, key) => (isRecord(acc) ? acc[key] : undefined), value);

/** `a.b.c` yo'liga qiymat yozilgan NUSXA (asl obyekt o'zgarmaydi; yo'qolgan oraliq obyektlar yaratiladi). */
export const withPath = (value: Record<string, unknown>, path: string, next: unknown): Record<string, unknown> => {
  const [head, ...rest] = path.split(".");
  if (!rest.length) return { ...value, [head]: next };
  const child = isRecord(value[head]) ? (value[head] as Record<string, unknown>) : {};
  return { ...value, [head]: withPath(child, rest.join("."), next) };
};

const text = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
};

/**
 * Summa — backend `safeExternalAmount` kabi: son yoki sonli matn; bo'sh — 0; son bo'lmasa `null` (backend uni
 * `price_invalid` deb o'tkazib yuboradi, ro'yxatda esa «—»).
 */
export const readAmount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/\s+/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : null;
};

/**
 * SAYT JAVOBIDAN BUYURTMA(LAR)NI OCHISH.
 *
 * `search-by-qr` javobining `data` qismi — ulanishda `response_path` yozilgan bo'lsa o'sha yo'ldagi qiymat, aks holda
 * saytning BUTUN javobi. Ko'p sayt buyurtmani o'z qobig'ida qaytaradi (`{ success, data: {...} }`) — BeePost ham
 * aynan shunday ochardi (`data.data || data`). Qoida:
 *  - `null` / bo'sh massiv / `success: false` — topilmadi;
 *  - massiv — har elementi buyurtma;
 *  - obyektda xaritadagi id yoki telefon maydoni bo'lsa — o'zi buyurtma; bo'lmasa va ichida `data` bo'lsa — o'sha.
 */
export const unwrapSiteOrders = (payload: unknown, mapping: SiteFieldMapping): Record<string, unknown>[] => {
  if (payload === null || payload === undefined) return [];
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  if (payload.success === false) return [];
  const looksLikeOrder =
    readPath(payload, mapping.id_field) !== undefined || readPath(payload, mapping.phone_field) !== undefined;
  if (!looksLikeOrder && "data" in payload) return unwrapSiteOrders(payload.data, mapping);
  return Object.keys(payload).length ? [payload] : [];
};

export type SiteOrderItem = { name: string; quantity: number };

/** Ro'yxatdagi qator — saytdan olingan buyurtma (hali Elchi'da yaratilmagan). */
export type SiteOrderPreview = {
  /** Ro'yxat kaliti — QR (bitta QR — bitta posilka). */
  key: string;
  /**
   * Qabulda serverga ketadigan token: saytning o'z QR maydoni bo'lsa o'sha, bo'lmasa skanerlangan qiymat. Backend
   * buyurtmaning `qr_code_token` iga aynan shuni yozadi — qabul (`receive-by-scan`) shu bilan topadi.
   */
  qr: string;
  externalId: string | null;
  name: string;
  phone: string;
  address: string;
  /** Saytdagi tuman kodi (SOATO yoki Elchi id'si) — xom; nomi `siteEdit.ts` → `findSiteDistrict`. */
  districtCode: string;
  /** Saytdagi viloyat kodi (SOATO, masalan 1703) — tuman bilan solishtirish uchun. */
  regionCode: string;
  comment: string;
  items: SiteOrderItem[];
  /** `total_price + delivery_price` (backend `finalPrice`); summa o'qilmasa `null`. */
  amount: number | null;
  /**
   * Serverga yuboriladigan buyurtma — saytning javobi, QR maydoni bo'lmasa skanerlangan QR qo'shilgan (backend
   * `scanIntake` ham shunday qiladi: aks holda buyurtmaga tasodifiy token tushib, posilkani skanerlab bo'lmasdi).
   */
  payload: Record<string, unknown>;
  /** Oxirgi qabulda o'tmagan bo'lsa — sababi (qatorda ko'rsatiladi). */
  error?: string;
  /** Operator qo'lda tuzatgan (`siteEdit.ts`). */
  edited?: boolean;
};

/** Mahsulotlar: massiv — elementlari, matn — undan ajratilgan qatorlar (`readItemsText`), boshqasi — bo'sh. */
const readItems = (raw: unknown, totalCount: unknown, mapping: SiteFieldMapping): SiteOrderItem[] => {
  if (typeof raw === "string") return readItemsText(raw, totalCount);
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((row) => {
    const name = text(readPath(row, mapping.item_name_field));
    if (!name) return [];
    const quantity = Number(readPath(row, mapping.item_qty_field) ?? 1);
    return [{ name, quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1 }];
  });
};

/** Bitta sayt buyurtmasi → ro'yxat qatori. */
export const toSitePreview = (
  raw: Record<string, unknown>,
  mapping: SiteFieldMapping,
  scannedQr: string,
): SiteOrderPreview => {
  const providedQr = text(readPath(raw, mapping.qr_code_field));
  const qr = providedQr || scannedQr.trim();
  const externalId = text(readPath(raw, mapping.id_field)) || null;
  const total = readAmount(readPath(raw, mapping.total_price_field));
  const delivery = readAmount(readPath(raw, mapping.delivery_price_field));
  const payload = providedQr ? raw : withPath(raw, mapping.qr_code_field, qr);
  return {
    key: qr,
    qr,
    externalId,
    name: text(readPath(raw, mapping.customer_name_field)),
    phone: text(readPath(raw, mapping.phone_field)),
    address: text(readPath(raw, mapping.address_field)),
    districtCode: text(readPath(raw, mapping.district_code_field)),
    regionCode: text(readPath(raw, mapping.region_code_field)),
    comment: text(readPath(raw, mapping.comment_field)),
    items: readItems(readPath(raw, mapping.items_field), readPath(raw, mapping.total_count_field), mapping),
    amount: total === null || delivery === null ? null : total + delivery,
    payload,
  };
};

/** Saytning QR qidiruv manzili — BeePost odati (`<api_url>/qrorder/find`). */
export const DEFAULT_QR_SEARCH_ENDPOINT = "/qrorder/find";

/**
 * `search-by-qr` ga yuboriladigan `endpoint`.
 *
 * Ulanishda qidiruv sozlangan bo'lsa (`status_sync_config.external_search.endpoint`) — `undefined`: backend o'zinikini
 * oladi. Sozlanmagan bo'lsa backend 400 («External endpoint is required») beradi — shuning uchun BeePost'dagi kabi
 * `/qrorder/find`. API manzilining o'zi shu bilan tugasa — to'liq manzil (backend `http…` endpoint'ni o'zgartirmaydi,
 * aks holda yo'l ikki marta qo'shilardi).
 */
export const qrSearchEndpoint = (integration: {
  base_url?: string | null;
  api_url?: string | null;
  status_sync_config?: unknown;
}): string | undefined => {
  const configured = readPath(integration.status_sync_config, "external_search.endpoint");
  if (typeof configured === "string" && configured.trim()) return undefined;
  const base = text(integration.base_url) || text(integration.api_url);
  if (/^https?:\/\//i.test(base) && /\/qrorder\/find\/?$/i.test(base)) return base;
  return DEFAULT_QR_SEARCH_ENDPOINT;
};

/** Ro'yxatdagi summa — o'qilgan summalar yig'indisi. */
export const previewsTotal = (rows: readonly SiteOrderPreview[]): number =>
  rows.reduce((sum, row) => sum + (row.amount ?? 0), 0);

/**
 * Buyurtma tizimda ALLAQACHON bor (avval yaratilgan, lekin qabul qilinmay qolgan bo'lishi mumkin — masalan
 * oldingi urinishda yaratildi, qabul esa kun tartibi sababli o'tmadi). Bunday qator xato emas: qabul
 * (`receive-by-scan`) baribir yuboriladi, u allaqachon qabul qilingan bo'lsa server o'z sababini qaytaradi.
 */
export const EXISTING_SKIP_REASONS: readonly string[] = ["already_exists", "qr_code_conflict"];

/** Backend `skipped[].reason` → i18n kaliti (`newOrders:sites.reason.*`); noma'lumi — `null` (xom matn ko'rsatiladi). */
const KNOWN_SKIP_REASONS = [
  "phone_missing",
  "phone_invalid",
  "price_invalid",
  "price_missing",
  "customer_create_failed",
  "district_unresolved",
  "region_unresolved",
  "region_mismatch",
] as const;

export type SiteSkipReason = (typeof KNOWN_SKIP_REASONS)[number];

export const knownSkipReason = (reason: string): SiteSkipReason | null =>
  (KNOWN_SKIP_REASONS as readonly string[]).includes(reason) ? (reason as SiteSkipReason) : null;
