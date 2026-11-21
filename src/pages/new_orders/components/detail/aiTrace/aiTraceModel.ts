import {
  AI_AUDITED_FIELDS,
  AI_TRACE_RETENTION_DAYS,
  formatMaskedPhone,
  type AiAuditedField,
  type AiOrderTrace,
  type AiTraceSuggestion,
} from "../../../../../entities/ai-order";
import { getDistrictName, getRegionName, type OrderDetail } from "../orderDetailModel";

/**
 * «AI IZI» OYNASI — sof mantiq (maket `superadmin-orders-detail-ai-trace-dialog`).
 *
 * «AI taklifi» — iz (`ai_suggestion`, 30 kungacha), «Yakuniy» — buyurtmaning o'zi (tafsilot sahifasi allaqachon
 * yuklagan). Telefon har ikki ustunda maskalangan (iz to'liq raqam bermaydi). Matnlar — i18n kalitlari bilan
 * UI qatlamida; bu yerda faqat qiymat qatorlari.
 */

/** Iz faqat shu rollarga (backend `@Roles(SUPERADMIN, ADMIN)`) — boshqalarda so'rov ham ketmaydi. */
const TRACE_ROLES: ReadonlySet<string> = new Set(["superadmin", "admin"]);

export const canViewAiTrace = (role: unknown) => TRACE_ROLES.has(String(role ?? "").trim().toLowerCase());

/** Qiymat — bir yoki bir necha qator (mahsulotlar). Bo'sh — `[]` (UI «—» chizadi). */
export type TraceValue = string[];

export type TraceLookups = {
  /** `region_id → nom` (viloyatlar ro'yxati). */
  regionName: (id: string | null) => string | null;
  /** `district_id → nom` (`GET district/:id`). */
  districtName: (id: string | null) => string | null;
  money: (amount: number) => string;
  delivery: (value: string | null) => string | null;
  itemLine: (name: string, quantity: number) => string;
};

export type EditedRow = { field: AiAuditedField; ai: TraceValue; final: TraceValue };

const line = (value: string | null | undefined): TraceValue => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? [trimmed] : [];
};

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const str = (value: unknown): string | null =>
  typeof value === "string" ? value : typeof value === "number" ? String(value) : null;

/** Buyurtmadagi mahsulot nomi (katalogsiz qatorda — `product_name`). */
const orderItemName = (item: OrderDetail["items"][number]) =>
  item.product?.name?.trim() || item.product_name?.trim() || "—";

const orderProductNames = (order: OrderDetail) => {
  const names = new Map<string, string>();
  for (const item of order.items ?? []) {
    const id = item.product?.id ?? item.product_id;
    if (id) names.set(String(id), orderItemName(item));
  }
  return names;
};

const aiValue = (
  field: AiAuditedField,
  suggestion: AiTraceSuggestion,
  order: OrderDetail,
  lookups: TraceLookups,
): TraceValue => {
  switch (field) {
    case "customer_name":
      return line(suggestion.customer_name);
    case "phone_number":
      return line(formatMaskedPhone(suggestion.phone_masked));
    case "extra_number":
      return line(formatMaskedPhone(suggestion.extra_masked));
    case "region_id":
      return line(lookups.regionName(suggestion.region_id));
    case "district_id":
      return line(lookups.districtName(suggestion.district_id));
    case "address":
      return line(suggestion.address);
    case "total_price":
      return suggestion.total_price === null ? [] : [lookups.money(suggestion.total_price)];
    case "where_deliver":
      return line(lookups.delivery(suggestion.where_deliver));
    case "comment":
      return line(suggestion.comment);
    case "operator":
      return line(suggestion.operator);
    case "items": {
      // Katalogdagi mahsulotga bog'langan bo'lsa — uning nomi (yakuniy ustun bilan solishtirish oson), aks holda AI
      // o'qigan nom.
      const names = orderProductNames(order);
      return suggestion.items.map((item) =>
        lookups.itemLine((item.product_id && names.get(item.product_id)) || item.name || "—", item.quantity),
      );
    }
  }
};

const finalValue = (field: AiAuditedField, order: OrderDetail, lookups: TraceLookups): TraceValue => {
  const customer = record(order.customer);
  switch (field) {
    case "customer_name":
      return line(str(customer?.name));
    case "phone_number":
      return line(formatMaskedPhone(str(customer?.phone_number)));
    case "extra_number":
      return line(formatMaskedPhone(str(customer?.extra_number) ?? str(order.extra_number)));
    case "region_id":
      return line(getRegionName(order));
    case "district_id":
      return line(getDistrictName(order));
    case "address":
      return line(order.address);
    case "total_price":
      return [lookups.money(order.total_price)];
    case "where_deliver":
      return line(lookups.delivery(order.where_deliver));
    case "comment":
      return line(order.comment);
    case "operator": {
      // Integratsiya buyurtmasidagi `external_…` — ism emas (order-meta bilan bir xil qoida).
      const operator = str(order.operator);
      return operator?.startsWith("external_") ? [] : line(operator);
    }
    case "items":
      return (order.items ?? []).map((item) => lookups.itemLine(orderItemName(item), item.quantity));
  }
};

/**
 * «Operator o'zgartirgan maydonlar» qatorlari — backend tartibida (`AI_AUDITED_FIELDS`). AI taklifi o'chirilgan
 * bo'lsa (`ai_suggestion: null`) «AI taklifi» bo'sh, maydon nomi va yakuniy qiymat qoladi.
 */
export const editedRows = (trace: AiOrderTrace, order: OrderDetail, lookups: TraceLookups): EditedRow[] => {
  const edited = new Set(trace.edited_fields ?? []);
  return AI_AUDITED_FIELDS.filter((field) => edited.has(field)).map((field) => ({
    field,
    ai: trace.ai_suggestion ? aiValue(field, trace.ai_suggestion, order, lookups) : [],
    final: finalValue(field, order, lookups),
  }));
};

/** «Qolgan N ta maydon AI taklifidagidek qoldi». */
export const unchangedCount = (trace: AiOrderTrace) =>
  AI_AUDITED_FIELDS.length - new Set(trace.edited_fields ?? []).size;

export type CheckStatus = "fixed" | "confirmed" | "note";

/** Tekshiruv kodi (ma'lumlari) — `region_inferred` ham shu ro'yxatda (snapshot'da alohida bayroq). */
export const TRACE_CHECK_CODES = [
  "district_low_confidence",
  "price_check",
  "region_inferred",
  "qty_check",
  "duplicate_items",
  "phone_is_market",
  "same_phone_multi",
] as const;
export type TraceCheckCode = (typeof TRACE_CHECK_CODES)[number];

/** Kod qaysi maydon bilan «tuzatiladi» (operator o'sha maydonni o'zgartirgan bo'lsa — «Tuzatildi»). */
const CHECK_FIELD: Record<TraceCheckCode, AiAuditedField> = {
  district_low_confidence: "district_id",
  price_check: "total_price",
  region_inferred: "region_id",
  qty_check: "items",
  duplicate_items: "items",
  phone_is_market: "phone_number",
  same_phone_multi: "phone_number",
};

/** Bloklovchi (operator tasdiqlagan) kodlar; qolganlari — faqat eslatma. */
const BLOCKING: ReadonlySet<TraceCheckCode> = new Set(["district_low_confidence", "price_check"]);

export type CheckRow = { code: TraceCheckCode; status: CheckStatus };

/**
 * «Ishlagan tekshiruvlar»: snapshot'dagi `check_codes` + `region_inferred`. Noma'lum kod e'tiborsiz. Holat:
 * tegishli maydon o'zgargan — «Tuzatildi»; bloklovchi va o'zgarmagan — «Tasdiqlandi» (operator «… to'g'ri,
 * tasdiqlayman» belgilagan); yumshoq — «Eslatma».
 */
export const checkRows = (trace: AiOrderTrace): CheckRow[] => {
  const suggestion = trace.ai_suggestion;
  if (!suggestion) return [];
  const codes = new Set<string>(suggestion.check_codes);
  if (suggestion.region_inferred) codes.add("region_inferred");
  const edited = new Set(trace.edited_fields ?? []);
  return TRACE_CHECK_CODES.filter((code) => codes.has(code)).map((code) => ({
    code,
    status: edited.has(CHECK_FIELD[code]) ? "fixed" : BLOCKING.has(code) ? "confirmed" : "note",
  }));
};

/** Manba matn bo'laklari: `[TEL_n]` — alohida (qalin), qolgani oddiy matn. */
export type SourcePart = { text: string; phone: boolean };

export const splitSourceText = (text: string): SourcePart[] =>
  text
    .split(/(\[TEL_\d+\])/g)
    .filter((part) => part !== "")
    .map((part) => ({ text: part, phone: /^\[TEL_\d+\]$/.test(part) }));

/** Matn o'chiriladigan (yoki o'chirilgan) sana: tahlil vaqti + 30 kun. */
export const retentionDate = (createdAt: string | null): Date | null => {
  if (!createdAt) return null;
  const time = new Date(createdAt).getTime();
  return Number.isFinite(time) ? new Date(time + AI_TRACE_RETENTION_DAYS * 24 * 60 * 60 * 1000) : null;
};
