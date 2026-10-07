import type { InboundAction, StatusCatalog, StatusCatalogEntry } from "../../entities/integrations/statusCatalog";

/**
 * STATUS XARITASI — sof mantiq (JnHK6bgV).
 *
 * Uch xarita, uch xil SAQLASH FORMATI — har biri backend o'qiydigan shaklda
 * qoladi (migratsiya yo'q, faqat muharrir ko'rinishi o'zgaradi):
 *
 *   outbound  `status_mapping`             { bizning_kod: "ularning_qiymati" }
 *   payment   `payment_config.status_map`  { bizning_kod: ["2", "PAID"] }
 *   inbound   `inbound_status_mapping`     { ULARNING_KOD: { status, action? } }
 *
 * ⚠️ Avvalgi umumiy "mapping" muharriri bu maydonlarda mijoz-maydon
 * kalitlarini (ism, telefon…) ko'rsatardi va qiymatni SATR qilib saqlardi:
 * to'lov xaritasida backend massiv kutadi, kiruvchi xaritada obyekt — ya'ni
 * UI orqali kiritilgan xarita hech qachon ishlamasdi.
 */

export type StatusMapKind = "outbound" | "inbound" | "payment";

export type StatusMapValue = Record<string, unknown>;

export const catalogFor = (kind: StatusMapKind, catalog: StatusCatalog): StatusCatalogEntry[] =>
  kind === "payment" ? catalog.payment : catalog.shipment;

const asObject = (value: unknown): StatusMapValue =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as StatusMapValue) : {};

/** Hamkor qiymatlari: vergul bilan ajratilgan erkin matn ("7", "доставлено", "ST-07"). */
export const splitValues = (text: string): string[] =>
  text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

const inboundStatusOf = (entry: unknown): string => {
  const status = (entry as { status?: unknown } | null)?.status;
  return typeof status === "string" ? status : "";
};

/** Katalog qatoridagi input matni. */
export const rowText = (kind: StatusMapKind, value: unknown, code: string): string => {
  const map = asObject(value);
  if (kind === "outbound") {
    const current = map[code];
    return typeof current === "string" || typeof current === "number" ? String(current) : "";
  }
  if (kind === "payment") {
    const current = map[code];
    if (Array.isArray(current)) return current.map(String).join(", ");
    return typeof current === "string" ? current : "";
  }
  return Object.entries(map)
    .filter(([, entry]) => inboundStatusOf(entry) === code)
    .map(([partnerCode]) => partnerCode)
    .join(", ");
};

/**
 * Katalog qatorini yangilaydi va YANGI obyekt qaytaradi. Bo'sh input —
 * kalit xaritadan olinadi (bo'sh satr saqlanmaydi).
 */
export const setRow = (
  kind: StatusMapKind,
  value: unknown,
  code: string,
  text: string,
  defaultAction?: InboundAction,
): StatusMapValue => {
  const out = { ...asObject(value) };
  if (kind === "outbound") {
    if (text.trim()) out[code] = text.trim();
    else delete out[code];
    return out;
  }
  if (kind === "payment") {
    const list = splitValues(text);
    if (list.length) out[code] = list;
    else delete out[code];
    return out;
  }
  // inbound: shu statusga tegishli eski kodlar olib tashlanib, yangilari yoziladi.
  const previous = new Map<string, unknown>();
  for (const [partnerCode, entry] of Object.entries(out)) {
    if (inboundStatusOf(entry) === code) {
      previous.set(partnerCode, entry);
      delete out[partnerCode];
    }
  }
  for (const partnerCode of splitValues(text)) {
    // Mavjud yozuvning `action` i saqlanadi; yangisiga — statusning sukut amali.
    const kept = previous.get(partnerCode) as { action?: unknown } | undefined;
    const action = typeof kept?.action === "string" ? kept.action : defaultAction;
    out[partnerCode] = action ? { status: code, action } : { status: code };
  }
  return out;
};

/** Katalogdagi nechta status moslangan (sarlavhadagi "9 / 12"). */
export const matchedCount = (kind: StatusMapKind, value: unknown, entries: StatusCatalogEntry[]): number =>
  entries.filter((entry) => rowText(kind, value, entry.code).trim() !== "").length;

/**
 * Katalogda YO'Q, lekin saqlangan xaritada bor yozuvlar — o'chirib
 * yuborilmaydi, "Qo'shimcha / nostandart" bo'limida ko'rinadi.
 * outbound/payment: kalit katalogda yo'q; inbound: `status` katalogda yo'q.
 */
export const extraKeys = (kind: StatusMapKind, value: unknown, entries: StatusCatalogEntry[]): string[] => {
  const codes = new Set(entries.map((entry) => entry.code));
  const map = asObject(value);
  return Object.keys(map).filter((key) =>
    kind === "inbound" ? !codes.has(inboundStatusOf(map[key])) : !codes.has(key),
  );
};

/** Qo'shimcha yozuv qiymatining matni (inbound — uning `status` i). */
export const extraText = (kind: StatusMapKind, value: unknown, key: string): string => {
  const entry = asObject(value)[key];
  if (kind === "inbound") return inboundStatusOf(entry);
  if (Array.isArray(entry)) return entry.map(String).join(", ");
  return typeof entry === "string" || typeof entry === "number" ? String(entry) : "";
};

/** Qo'shimcha yozuvni tahrirlash/o'chirish (`text` bo'sh — o'chiriladi). */
export const setExtra = (kind: StatusMapKind, value: unknown, key: string, text: string): StatusMapValue => {
  const out = { ...asObject(value) };
  if (!text.trim()) {
    delete out[key];
    return out;
  }
  if (kind === "inbound") {
    const kept = asObject(out[key]);
    out[key] = { ...kept, status: text.trim() };
  } else if (kind === "payment") {
    out[key] = splitValues(text);
  } else {
    out[key] = text.trim();
  }
  return out;
};
