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
 * - `result` — 200: maqsad tumandagi tirik sonlar `target_before` → `target_after`;
 * - `unknown` — javob kelmadi (vaqt tugadi, aloqa uzildi) yoki 500/502/504/524: server natijasi noma'lum,
 *   «Qayta urinish» yo'q (ikki marta birlashtirmaslik uchun);
 * - `error` — server aniq rad etdi (400/403/404/409/503). Xato oynalari (`merge-error*`, «Sabab», sonlar)
 *   backend N1 dan keyin (DM-2); hozircha umumiy xabar.
 */

export type MergeDistrict = {
  id: string;
  name: string;
  regionId: string;
  regionName: string;
};

/** Tirik (o'chirilmagan) yozuvlar soni — backend `GeoUsage` ning asosiy maydonlari. */
export type MergeCounts = { orders: number; users: number; branches: number };

export type MergeOutcome = { before: MergeCounts | null; after: MergeCounts | null };

export type MergeFailure = { kind: "error" | "unknown"; status: number | null };

export type MergeState =
  | { phase: "idle" }
  | { phase: "confirm"; source: MergeDistrict; targetId: string | null }
  | { phase: "progress"; source: MergeDistrict; target: MergeDistrict; startedAt: number }
  | { phase: "result"; source: MergeDistrict; target: MergeDistrict; outcome: MergeOutcome }
  | { phase: "unknown"; source: MergeDistrict; target: MergeDistrict }
  | { phase: "error"; source: MergeDistrict; target: MergeDistrict; status: number | null };

export type MergeEvent =
  | { type: "open"; source: MergeDistrict; targetId?: string | null }
  | { type: "select"; targetId: string | null }
  | { type: "submit"; target: MergeDistrict; at: number }
  /** Shu manba bilan so'rov allaqachon ketmoqda (sahifa qayta ochilgan) — jarayon oynasiga qaytiladi. */
  | { type: "resume"; source: MergeDistrict; target: MergeDistrict; startedAt: number }
  | { type: "succeed"; outcome: MergeOutcome }
  | { type: "fail"; failure: MergeFailure }
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
        : { phase: "error", source: state.source, target: state.target, status: event.failure.status };
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

/** 200 javobi `{ statusCode, message, data: { moved, target_before, target_after } }` (yoki o'ralmagan `data`). */
export const parseMergeOutcome = (payload: unknown): MergeOutcome => {
  const record = (payload ?? {}) as { data?: unknown };
  const data = (record.data && typeof record.data === "object" ? record.data : payload) as Record<
    string,
    unknown
  > | null;
  return {
    before: parseMergeCounts(data?.target_before),
    after: parseMergeCounts(data?.target_after),
  };
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
  return { kind: UNKNOWN_STATUSES.has(status) ? "unknown" : "error", status };
};

export const mergeDistrictRequest = async (sourceId: string, targetId: string): Promise<MergeOutcome> => {
  const response = await api.post(
    API_ENDPOINTS.DISTRICTS.MERGE(sourceId),
    { target_district_id: targetId },
    { timeout: MERGE_REQUEST_TIMEOUT_MS },
  );
  return parseMergeOutcome(response.data);
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
