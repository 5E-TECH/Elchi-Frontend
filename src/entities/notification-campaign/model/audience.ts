import {
  isOrderRangeInverted,
  toCustomerSegmentPayload,
  type CustomerSegment,
  type CustomerSegmentPayload,
} from "./segment";

/**
 * AUDITORIYA KONSTRUKTORI (KM-2, ebSV5oyP / W8aerwL6) — `/notifications/send` «Auditoriya» rejimi.
 *
 * Turi: Mijoz · Market · Xodim. Xodim rollari (ega KM-S2): admin, menejer, registrator, kuryer, logist — superadmin va
 * investor auditoriyaga kirmaydi. Mijozlar faqat `include_customers: true` bilan nishonlanadi va backend (gateway +
 * notification-service + identity) segmentsiz `include_customers` ni 400 bilan rad etadi — shuning uchun:
 *   • mijoz filtri (segment) bo'lsa — `include_customers: true` + `segment`;
 *   • filtr yo'q, «Filtrsiz — barcha mijozlarga» belgilangan — `include_customers` + `confirm_all_customers: true`;
 *   • filtr ham, belgi ham yo'q — nishon QURILMAYDI (so'rov ketmaydi, «Mijozlar uchun filtr tanlang»).
 * Segment mijoz tanlanmagan bo'lsa yuborilmaydi (backend `segment` ni mijozsiz rad etadi).
 */
export const AUDIENCE_KINDS = ["customer", "market", "staff"] as const;
export type AudienceKind = (typeof AUDIENCE_KINDS)[number];

export const AUDIENCE_STAFF_ROLES = [
  "admin",
  "manager",
  "registrator",
  "courier",
  "logist",
] as const;
export type AudienceStaffRole = (typeof AUDIENCE_STAFF_ROLES)[number];

export interface AudienceDraft {
  kinds: AudienceKind[];
  staffRoles: AudienceStaffRole[];
  customerSegment: CustomerSegment;
  /** «Filtrsiz — barcha mijozlarga yuborish» (aniq tasdiq → `confirm_all_customers`). */
  allCustomers: boolean;
}

/** Backend nishoni (`AudienceTargetFieldsDto`): preview, segmentni saqlash va kampaniya uchun umumiy. */
export interface AudienceTarget {
  roles?: string[];
  broadcast?: true;
  include_customers?: true;
  confirm_all_customers?: true;
  segment?: CustomerSegmentPayload;
}

export const createAudienceDraft = (): AudienceDraft => ({
  kinds: [],
  staffRoles: [],
  customerSegment: {},
  allCustomers: false,
});

/**
 * Konstruktor holati:
 *   `noKind` — hech qaysi tur tanlanmagan; `noStaffRole` — «Xodim» bor, rol yo'q; `needsCustomerFilter` — mijoz
 *   tanlangan, filtr ham «Filtrsiz» belgisi ham yo'q; `invertedRange` — «dan» > «gacha»; `ready` — nishon bor.
 */
export type AudienceGate =
  "noKind" | "noStaffRole" | "needsCustomerFilter" | "invertedRange" | "ready";

const has = (draft: AudienceDraft, kind: AudienceKind) => draft.kinds.includes(kind);

/**
 * Konstruktordagi mijoz filtri → backend `segment`. Backend `min_orders ≤ 1` ni e'tiborsiz qoldiradi («dan 1» —
 * buyurtma bergan hamma mijoz), shuning uchun u filtr hisoblanmaydi: yolg'iz o'zi «Filtrsiz» tasdig'ini chetlab
 * o'tmasin.
 */
export const audienceSegmentPayload = (segment: CustomerSegment): CustomerSegmentPayload => {
  const payload = toCustomerSegmentPayload(segment);
  if (payload.min_orders !== undefined && payload.min_orders <= 1) delete payload.min_orders;
  return payload;
};

/** Mijoz filtri amalda yo'q (bo'sh yoki faqat «dan 1»). */
export const isAudienceSegmentEmpty = (segment: CustomerSegment) =>
  Object.keys(audienceSegmentPayload(segment)).length === 0;

export const audienceGate = (draft: AudienceDraft): AudienceGate => {
  if (!draft.kinds.length) return "noKind";
  if (has(draft, "staff") && !draft.staffRoles.length) return "noStaffRole";
  if (has(draft, "customer")) {
    if (isOrderRangeInverted(draft.customerSegment)) return "invertedRange";
    if (isAudienceSegmentEmpty(draft.customerSegment) && !draft.allCustomers)
      return "needsCustomerFilter";
  }
  return "ready";
};

/** Qoralama → backend nishoni; `ready` bo'lmasa `null` (so'rov yuborilmaydi). Rollar tartibi barqaror. */
export const toAudienceTarget = (draft: AudienceDraft): AudienceTarget | null => {
  if (audienceGate(draft) !== "ready") return null;
  const roles: string[] = [];
  if (has(draft, "market")) roles.push("market");
  if (has(draft, "staff")) {
    for (const role of AUDIENCE_STAFF_ROLES) if (draft.staffRoles.includes(role)) roles.push(role);
  }
  const target: AudienceTarget = {};
  if (roles.length) target.roles = roles;
  if (has(draft, "customer")) {
    target.include_customers = true;
    const segment = audienceSegmentPayload(draft.customerSegment);
    if (Object.keys(segment).length) target.segment = segment;
    else target.confirm_all_customers = true;
  }
  return target;
};

/** Barqaror kalit (so'rov keshi, `Idempotency-Key` barmoq izi). */
export const audienceTargetKey = (target: AudienceTarget | null) =>
  target ? JSON.stringify(target) : "";

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const ISO_DAY = /^(\d{4}-\d{2}-\d{2})/;
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Saqlangan sana (`YYYY-MM-DD` yoki ISO) → Toshkent kalendar kuni. */
const tashkentDay = (value: unknown): string | undefined => {
  if (typeof value !== "string" || !value) return undefined;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return ISO_DAY.exec(value)?.[1];
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date(time + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
};

/** Oldingi kalendar kuni (`last_order_to` qat'iy chegara — UI'da oxirgi kun kiradi). */
const previousDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
};

const toPositiveInt = (value: unknown) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : undefined;
};

const toId = (value: unknown) =>
  (typeof value === "string" || typeof value === "number") && /^\d+$/.test(String(value))
    ? String(value)
    : undefined;

/**
 * Saqlangan segment sharti (`notification_audience_segments.audience`) → konstruktor qoralamasi. Konstruktorda
 * chizilmaydigan qismlar (`broadcast`, superadmin/investor rollari) tashlanadi. `last_order_to` saqlashda keyingi
 * kunning yarim tuni bo'lib ketgan — UI'ga oxirgi kiradigan kun qaytadi.
 */
export const draftFromSavedAudience = (audience: unknown): AudienceDraft => {
  const record = asRecord(audience);
  const roles = Array.isArray(record.roles)
    ? record.roles.map((role) => String(role).toLowerCase())
    : [];
  const staffRoles = AUDIENCE_STAFF_ROLES.filter((role) => roles.includes(role));
  const includeCustomers = record.include_customers === true;
  const kinds = AUDIENCE_KINDS.filter((kind) =>
    kind === "customer"
      ? includeCustomers
      : kind === "market"
        ? roles.includes("market")
        : staffRoles.length > 0,
  );
  const raw = asRecord(record.segment);
  const to = tashkentDay(raw.last_order_to);
  const segment: CustomerSegment = {
    region_id: toId(raw.region_id),
    district_id: toId(raw.district_id),
    market_id: toId(raw.market_id),
    last_order_from: tashkentDay(raw.last_order_from),
    last_order_to: to ? previousDay(to) : undefined,
    min_orders: toPositiveInt(raw.min_orders),
    max_orders: toPositiveInt(raw.max_orders),
  };
  const customerSegment = Object.fromEntries(
    Object.entries(segment).filter(([, value]) => value !== undefined),
  ) as CustomerSegment;
  return {
    kinds,
    staffRoles,
    customerSegment: includeCustomers ? customerSegment : {},
    allCustomers: includeCustomers && record.confirm_all_customers === true,
  };
};
