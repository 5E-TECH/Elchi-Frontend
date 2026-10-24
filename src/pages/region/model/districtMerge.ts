import axios from "axios";
import { api, MERGE_REQUEST_TIMEOUT_MS } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";

/**
 * TUMANNI BIRLASHTIRISH (oNAE3LW9, DM-1) — `POST district/:id/merge {target_district_id}`: manba tumanning
 * buyurtma, foydalanuvchi va filiallari maqsad tumanga ko'chadi, manba o'chadi. Holat mashinasi va javob
 * tahlili shu yerda (oyna — `ui/DistrictMergeDialog.tsx`; SATO sahifasi ham shuni ishlatadi, SA-2).
 *
 *   idle → confirm → progress → result | error | unknown
 *
 * - `confirm` — maqsad tanlanadi (faqat manba viloyatidan, ega S2), oldindan tanlangan maqsad bo'lishi mumkin;
 * - `progress` — so'rov ketmoqda: oyna yopilmaydi, Esc/fon ishlamaydi;
 * - `result` — 200: «Ko'chirildi» — `moved_live` (faqat tirik, vsmpTweI; eski javobda `moved`), maqsad tumandagi
 *   tirik sonlar `target_before` → `target_after`;
 * - `unknown` — javob kelmadi (vaqt tugadi, aloqa uzildi) yoki 500/502/504/524: server natijasi noma'lum,
 *   «Qayta urinish» yo'q (ikki marta birlashtirmaslik uchun);
 * - `error` — server aniq rad etdi (400/403/404/409/503). 409/503 javobida mashina o'qiydigan sabab bo'lsa
 *   (`data.reason` + `data.details`, tf324cXN — `parseMergeErrorDetails`) — xato oynasi (DM-2): «Birlashtirib
 *   bo'lmadi» / «Servis javob bermadi» (ko'chirilganlar qaytarildi, «Qayta urinish») yoki «chala qoldi»
 *   (`manual_fix`, qaytmaganlar ro'yxati). Sababsiz xato (400/403/404, eski javob) — umumiy xabar: «qaytarildi»
 *   deb da'vo qilinmaydi. Server matni hech qachon ko'rsatilmaydi.
 */

export type MergeDistrict = {
  id: string;
  name: string;
  regionId: string;
  regionName: string;
};

/** Tirik (o'chirilmagan) yozuvlar soni — backend `GeoUsage` ning asosiy maydonlari. */
export type MergeCounts = { orders: number; users: number; branches: number };

/** Ko'chiriladigan yozuv turi (birlashtirish qadami) — `MergeCounts` kalitlari. */
export type MergeKind = keyof MergeCounts;
export const MERGE_KINDS: readonly MergeKind[] = ["orders", "users", "branches"];

export type MergeOutcome = {
  before: MergeCounts | null;
  after: MergeCounts | null;
  /** «Ko'chirildi» — faqat tirik (`moved_live`, vsmpTweI); eski javobda `moved` (jami). */
  moved: MergeCounts | null;
};

/** tf324cXN — `data.reason`: qaysi bosqichda va nega birlashtirish bekor qilindi. */
export type MergeErrorReason = "count_mismatch" | "remote_refused" | "timeout" | "invalid_response" | "delete_failed";

/** `count_mismatch`: `source` — manba tumanda qoldiq (kutilgan 0), `target` — maqsad jami (tirik + o'chirilgan). */
export type MergeMismatch = { kind: MergeKind; district: "source" | "target"; expected: number; actual: number };

/** Kompensatsiyadan keyin joyiga qaytmagan yozuvlar: `districtId` / `count` — `null`, aniqlanmagan bo'lsa. */
export type MergeStranded = { kind: MergeKind; districtId: string | null; count: number | null };

/** 409/503 javobining mashina o'qiydigan qismi (`data.details`) — xato oynasi faqat shundan quriladi. */
export type MergeErrorDetails = {
  /** Noma'lum (yangi) kod — `null`: «Sabab» qatori chizilmaydi. */
  reason: MergeErrorReason | null;
  /** Qadam (`delete_failed` da `null`). */
  kind: MergeKind | null;
  timeoutMs: number | null;
  mismatches: MergeMismatch[];
  /** `true` — kompensatsiya chala: qo'lda tuzatish kerak (`stranded`). */
  manualFix: boolean;
  stranded: MergeStranded[];
  /** Gateway `trace_id` — «Xabarni nusxalash» matni uchun. */
  traceId: string | null;
};

/** Xato oynasi turi: maket `merge-error`, `merge-error-unavailable`, `merge-error-manual`. */
export type MergeErrorVariant = "error" | "unavailable" | "manual";

export type MergeFailure = {
  kind: "error" | "unknown";
  status: number | null;
  /** Faqat `error`: javobdagi mashina sababi (yo'q bo'lsa — `null`, umumiy xabar). */
  details?: MergeErrorDetails | null;
};

export type MergeState =
  | { phase: "idle" }
  | { phase: "confirm"; source: MergeDistrict; targetId: string | null }
  | { phase: "progress"; source: MergeDistrict; target: MergeDistrict; startedAt: number }
  | { phase: "result"; source: MergeDistrict; target: MergeDistrict; outcome: MergeOutcome }
  | { phase: "unknown"; source: MergeDistrict; target: MergeDistrict }
  | {
      phase: "error";
      source: MergeDistrict;
      target: MergeDistrict;
      status: number | null;
      details: MergeErrorDetails | null;
    };

export type MergeEvent =
  | { type: "open"; source: MergeDistrict; targetId?: string | null }
  | { type: "select"; targetId: string | null }
  | { type: "submit"; target: MergeDistrict; at: number }
  /** Shu manba bilan so'rov allaqachon ketmoqda (sahifa qayta ochilgan) — jarayon oynasiga qaytiladi. */
  | { type: "resume"; source: MergeDistrict; target: MergeDistrict; startedAt: number }
  | { type: "succeed"; outcome: MergeOutcome }
  | { type: "fail"; failure: MergeFailure }
  /** Xato oynasidagi «Qayta urinish» — o'sha manba va maqsad bilan yana jarayonga. */
  | { type: "retry"; at: number }
  | { type: "close" };

export const MERGE_IDLE: MergeState = { phase: "idle" };

/** Holat o'tishlari. Ruxsat etilmagan hodisa holatni o'zgartirmaydi (masalan, jarayonda «close»). */
export const mergeReducer = (state: MergeState, event: MergeEvent): MergeState => {
  switch (event.type) {
    case "open":
      if (state.phase === "progress") return state;
      return {
        phase: "confirm",
        source: event.source,
        targetId: event.targetId && event.targetId !== event.source.id ? event.targetId : null,
      };
    case "select":
      return state.phase === "confirm" ? { ...state, targetId: event.targetId } : state;
    case "submit":
      if (state.phase !== "confirm" || event.target.id === state.source.id) return state;
      // Ega S2: maqsad faqat shu viloyatdan — chaqiruvchi ro'yxati buzilsa ham so'rov ketmaydi.
      if (event.target.regionId !== state.source.regionId) return state;
      return { phase: "progress", source: state.source, target: event.target, startedAt: event.at };
    case "resume":
      if (state.phase === "progress") return state;
      return { phase: "progress", source: event.source, target: event.target, startedAt: event.startedAt };
    case "succeed":
      return state.phase === "progress"
        ? { phase: "result", source: state.source, target: state.target, outcome: event.outcome }
        : state;
    case "fail":
      if (state.phase !== "progress") return state;
      return event.failure.kind === "unknown"
        ? { phase: "unknown", source: state.source, target: state.target }
        : {
            phase: "error",
            source: state.source,
            target: state.target,
            status: event.failure.status,
            details: event.failure.details ?? null,
          };
    case "retry":
      // Faqat ko'chirilganlar to'liq qaytarilgan xatodan (chala qolganda — avval qo'lda tuzatish).
      if (state.phase !== "error" || !state.details || state.details.manualFix) return state;
      return { phase: "progress", source: state.source, target: state.target, startedAt: event.at };
    case "close":
      return state.phase === "progress" ? state : MERGE_IDLE;
    default:
      return state;
  }
};

const count = (value: unknown): number | null => {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** `GeoUsage` → tirik sonlar (`deleted` hisobga olinmaydi — «O'chirilgan yozuvlar sanalmaydi»). */
export const parseMergeCounts = (raw: unknown): MergeCounts | null => {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const orders = count(record.orders);
  const users = count(record.users);
  const branches = count(record.branches);
  return orders == null || users == null || branches == null ? null : { orders, users, branches };
};

/** `{ statusCode, message, data: X }` → `X` (o'ralmagan javob ham qabul qilinadi). */
const unwrapData = (payload: unknown): Record<string, unknown> | null => {
  const record = (payload ?? {}) as { data?: unknown };
  const data = record.data && typeof record.data === "object" ? record.data : payload;
  return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
};

/**
 * 200 javobi `{ statusCode, message, data: { moved, moved_live, target_before, target_after } }`. «Ko'chirildi» —
 * `moved_live` (faqat tirik, vsmpTweI); u yo'q eski javobda — `moved`.
 */
export const parseMergeOutcome = (payload: unknown): MergeOutcome => {
  const data = unwrapData(payload);
  return {
    before: parseMergeCounts(data?.target_before),
    after: parseMergeCounts(data?.target_after),
    moved: parseMergeCounts(data?.moved_live) ?? parseMergeCounts(data?.moved),
  };
};

/** `GET district/:id/usage` → `{ orders, users, branches }` (tirik; Is1zvHN7). */
export const parseDistrictUsage = (payload: unknown): MergeCounts | null => parseMergeCounts(unwrapData(payload));

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const REASONS: ReadonlySet<string> = new Set<MergeErrorReason>([
  "count_mismatch",
  "remote_refused",
  "timeout",
  "invalid_response",
  "delete_failed",
]);
const asKind = (value: unknown): MergeKind | null =>
  typeof value === "string" && (MERGE_KINDS as readonly string[]).includes(value) ? (value as MergeKind) : null;
const asId = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
};

/**
 * 409/503 xato javobi (`{ statusCode, message, data: { reason, details }, trace_id }`, tf324cXN) → oyna uchun
 * tafsilot. `details.manual_fix` (har doim boolean) bo'lmasa — `null`: javob mashina o'qiydigan emas (400/404,
 * eski backend), oyna «qaytarildi» deb da'vo qilmaydi. `message` (server matni) o'qilmaydi.
 */
export const parseMergeErrorDetails = (body: unknown): MergeErrorDetails | null => {
  const root = asRecord(body);
  const data = asRecord(root?.data);
  const details = asRecord(data?.details);
  if (!root || !data || !details || typeof details.manual_fix !== "boolean") return null;
  const rawReason = typeof details.reason === "string" ? details.reason : data.reason;
  const reason = typeof rawReason === "string" && REASONS.has(rawReason) ? (rawReason as MergeErrorReason) : null;
  const mismatches: MergeMismatch[] = [];
  for (const item of Array.isArray(details.mismatches) ? details.mismatches : []) {
    const row = asRecord(item);
    const kind = asKind(row?.kind);
    const expected = count(row?.expected);
    const actual = count(row?.actual);
    if (!row || !kind || expected == null || actual == null) continue;
    if (row.district !== "source" && row.district !== "target") continue;
    mismatches.push({ kind, district: row.district, expected, actual });
  }
  const stranded: MergeStranded[] = [];
  for (const item of Array.isArray(details.stranded) ? details.stranded : []) {
    const row = asRecord(item);
    const kind = asKind(row?.kind);
    if (!row || !kind) continue;
    stranded.push({ kind, districtId: asId(row.district_id), count: count(row.count) });
  }
  return {
    reason,
    kind: asKind(details.kind),
    timeoutMs: count(details.timeout_ms),
    mismatches,
    manualFix: details.manual_fix,
    stranded,
    traceId: typeof root.trace_id === "string" && root.trace_id ? root.trace_id : null,
  };
};

/**
 * Oyna turi: `manual_fix` — «chala qoldi»; servis javob bermadi / ulanib bo'lmadi (`timeout`, 503 dagi
 * `remote_refused`, sababsiz 503) — «Servis javob bermadi»; qolgani (sonlar mos kelmadi, rad etdi, noto'g'ri
 * javob, o'chirib bo'lmadi) — «Birlashtirib bo'lmadi».
 */
export const mergeErrorVariant = (status: number | null, details: MergeErrorDetails): MergeErrorVariant => {
  if (details.manualFix) return "manual";
  if (details.reason === "timeout") return "unavailable";
  if (status === 503 && (details.reason === "remote_refused" || details.reason == null)) return "unavailable";
  return "error";
};

/** «Sabab» qatori: i18n kaliti (`v2.districts.mergeError.reason.*`) va o'rniga qo'yiladigan qiymatlar. */
export type MergeReasonLine = {
  key: string;
  kind?: MergeKind | null;
  district?: "source" | "target";
  expected?: number;
  actual?: number;
  seconds?: number;
};

/**
 * Sabab → matn qatorlari (xom server matni emas, tf324cXN: «Sonlar mos kelmadi — buyurtmalar 1 255 ta, kutilgan
 * 1 254 ta», «Foydalanuvchilar ko'chirilmadi — servis 15 soniya ichida javob bermadi»). Noma'lum kod — `[]`.
 */
export const mergeReasonLines = (details: MergeErrorDetails): MergeReasonLine[] => {
  switch (details.reason) {
    case "count_mismatch":
      return details.mismatches.length
        ? details.mismatches.map((m) => ({
            key: m.district === "source" ? "countMismatchSource" : "countMismatchTarget",
            kind: m.kind,
            district: m.district,
            expected: m.expected,
            actual: m.actual,
          }))
        : [{ key: "countMismatch", kind: details.kind }];
    case "timeout":
      return [
        details.timeoutMs != null && details.timeoutMs > 0
          ? { key: "timeout", kind: details.kind, seconds: Math.round(details.timeoutMs / 1000) }
          : { key: "timeoutNoValue", kind: details.kind },
      ];
    case "remote_refused":
      return [{ key: "remoteRefused", kind: details.kind }];
    case "invalid_response":
      return [{ key: "invalidResponse", kind: details.kind }];
    case "delete_failed":
      return [{ key: "deleteFailed" }];
    default:
      return [];
  }
};

/** Server javobining HTTP holati (javob bo'lmasa — `null`). */
export const httpStatusOf = (error: unknown): number | null =>
  axios.isAxiosError(error) ? (error.response?.status ?? null) : null;

/** Javob kelmagan yoki natija noaniq bo'lgan HTTP holatlari (proksi/gateway vaqti, kutilmagan server xatosi). */
const UNKNOWN_STATUSES = new Set([500, 502, 504, 524]);

/**
 * Xato → `unknown` (natija noma'lum) yoki `error` (server aniq rad etdi). Javobsiz har xato (vaqt tugadi,
 * aloqa uzildi) — `unknown`: so'rov serverga yetib, birlashtirish davom etgan bo'lishi mumkin.
 * 500 ham `unknown`: birlashtirish yakunlanib, keyingi qadam (jurnal yozuvi) yiqilsa ham 500 keladi.
 */
export const classifyMergeError = (error: unknown): MergeFailure => {
  if (!axios.isAxiosError(error)) return { kind: "unknown", status: null };
  if (error.code === "ERR_CANCELED") return { kind: "unknown", status: null };
  const status = error.response?.status ?? null;
  if (status == null) return { kind: "unknown", status: null };
  if (UNKNOWN_STATUSES.has(status)) return { kind: "unknown", status };
  return { kind: "error", status, details: parseMergeErrorDetails(error.response?.data) };
};

export const mergeDistrictRequest = async (sourceId: string, targetId: string): Promise<MergeOutcome> => {
  const response = await api.post(
    API_ENDPOINTS.DISTRICTS.MERGE(sourceId),
    { target_district_id: targetId },
    { timeout: MERGE_REQUEST_TIMEOUT_MS },
  );
  return parseMergeOutcome(response.data);
};

/** «… ko'chadi» / «Ko'chirilayotganlar» / «Bog'langan» sonlari — `GET district/:id/usage` (tirik yozuvlar). */
export const districtUsageKey = (districtId: string) => ["district-usage", districtId] as const;

export const fetchDistrictUsage = async (districtId: string): Promise<MergeCounts | null> => {
  const response = await api.get(API_ENDPOINTS.DISTRICTS.USAGE(districtId));
  return parseDistrictUsage(response.data);
};

/** `DELETE district/:id` 400 (`data.reason = 'district_in_use'`) → `data.usage` tirik sonlari (AF0fvJbw). */
export const deleteBlockedUsage = (error: unknown): MergeCounts | null => {
  if (!axios.isAxiosError(error)) return null;
  const data = asRecord(asRecord(error.response?.data)?.data);
  return parseMergeCounts(data?.usage);
};

/** Maqsad nomzodlari — faqat manba viloyatidagi boshqa tumanlar (ega S2), nom bo'yicha. */
export const mergeCandidates = <D extends { id: string; name: string }>(
  regions: ReadonlyArray<{ id: string; name: string; districts: ReadonlyArray<D> }>,
  source: Pick<MergeDistrict, "id" | "regionId">,
): MergeDistrict[] => {
  const region = regions.find((r) => r.id === source.regionId);
  if (!region) return [];
  return region.districts
    .filter((d) => d.id !== source.id)
    .map((d) => ({ id: d.id, name: d.name, regionId: region.id, regionName: region.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "uz"));
};

/** «O'tgan vaqt 0:42» — daqiqa:soniya. */
export const formatElapsed = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};
