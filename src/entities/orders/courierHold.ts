import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import type { CourierHoldFilter } from "../order/types/order";

/**
 * «KURYERDAGI BUYURTMALAR» (onXzDc5n) — buyurtma kuryer qo'lida qancha turgani.
 *
 * Soat — buyurtma kuryerga o'tgan paytdan (`last_handover_at`: pochta jo'natildi, skan bilan olindi, kuryerga
 * o'tkazildi; kuryer qabul qilganda yangilanmaydi), kalendar soat. Faqat kuryer qo'lidagi va hali yopilmagan
 * buyurtmalar: yo'lda, kutilmoqda, mijoz kutilmoqda. Oraliqlar backend bilan bir xil:
 *   near_48  36 ≤ soat < 48 — «48 soatga yaqinlashgan» (kuryer va marketga bir marta ogohlantirish ketadi)
 *   over_48  48 ≤ soat < 72
 *   over_72  soat ≥ 72     — «72 soatdan oshgan»
 *
 * Kim ko'radi (doira backend'da, faqat tokendan): superadmin / admin — hammasi, menejer — o'z filiali, kuryer — o'zi,
 * market — o'z marketi. Registrator, operator, market operatori, logist — 403 (filtr va sahifa ularda yo'q).
 */

export const COURIER_HOLD_FILTERS: readonly CourierHoldFilter[] = ["any", "near_48", "over_48", "over_72"];
export const COURIER_HOLD_NEAR_FROM_HOURS = 36;
export const COURIER_HOLD_DEADLINE_HOURS = 48;
export const COURIER_HOLD_OVER_HOURS = 72;

export const isCourierHoldFilter = (value: unknown): value is CourierHoldFilter =>
  typeof value === "string" && (COURIER_HOLD_FILTERS as readonly string[]).includes(value);

/** URL'dagi qiymat → filtr (kichik harf, bo'shliqsiz); noma'lum — bo'sh (backend noma'lumiga 400 beradi). */
export const parseCourierHoldFilter = (value: unknown): CourierHoldFilter | "" => {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  return isCourierHoldFilter(text) ? text : "";
};

const COURIER_HOLD_ROLES = new Set(["superadmin", "admin", "manager", "courier", "market"]);

/** Filtr va «Kuryerdagi buyurtmalar» sahifasi — backend `COURIER_HOLD_ROLES` bilan bir xil. */
export const canViewCourierHold = (role: string | null | undefined): boolean =>
  COURIER_HOLD_ROLES.has(String(role ?? "").trim().toLowerCase());

const HOUR_MS = 60 * 60 * 1000;

/** Kuryerda necha to'liq soat (`last_handover_at` dan). Sana yo'q / noto'g'ri — `null`. */
export const courierHoldHours = (since: unknown, now: number = Date.now()): number | null => {
  if (typeof since !== "string" && typeof since !== "number") return null;
  const at = new Date(since).getTime();
  if (!Number.isFinite(at)) return null;
  return Math.max(0, Math.floor((now - at) / HOUR_MS));
};

export type CourierHoldLevel = "ok" | "near" | "over_48" | "over_72";

/** Soat → daraja (belgi rangi): 36 dan kam — oddiy, 36–48 — ogohlantirish, 48–72 — muddat o'tgan, 72+ — jiddiy. */
export const courierHoldLevel = (hours: number | null): CourierHoldLevel => {
  if (hours === null || hours < COURIER_HOLD_NEAR_FROM_HOURS) return "ok";
  if (hours < COURIER_HOLD_DEADLINE_HOURS) return "near";
  if (hours < COURIER_HOLD_OVER_HOURS) return "over_48";
  return "over_72";
};

// ── Kuryer bo'yicha jamlama ───────────────────────────────────────────────
export interface CourierHoldSummaryParams {
  market_id?: string;
  branch_id?: string;
  region_id?: string;
  courier_id?: string;
}

export interface CourierHoldSummaryRow {
  courierId: string;
  name: string | null;
  phone: string | null;
  total: number;
  under36: number;
  near48: number;
  over48: number;
  over72: number;
  /** Eng eski buyurtma kuryerga o'tgan payt. */
  oldestSince: string | null;
  oldestHours: number | null;
  /** Bekor qilingan, lekin hali kuryer qo'lida (filialga topshirilmagan) — faqat ma'lumot. */
  cancelledHeld: number;
}

export interface CourierHoldSummary {
  couriers: CourierHoldSummaryRow[];
  totals: {
    couriers: number;
    total: number;
    under36: number;
    near48: number;
    over48: number;
    over72: number;
    cancelledHeld: number;
    oldestHours: number | null;
  };
}

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};

const text = (value: unknown): string | null => {
  if (typeof value === "string") return value.trim() ? value.trim() : null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

const count = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
};

const hoursOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
};

/** Javob (`{ data: {...} }` yoki to'g'ridan obyekt) → jamlama; noto'g'ri qator — tashlanadi. */
export const toCourierHoldSummary = (payload: unknown): CourierHoldSummary => {
  const root = asRecord(payload);
  const data = root.couriers !== undefined ? root : asRecord(root.data);
  const couriers: CourierHoldSummaryRow[] = [];
  for (const raw of Array.isArray(data.couriers) ? data.couriers : []) {
    const row = asRecord(raw);
    const person = asRecord(row.courier);
    const courierId = text(row.courier_id) ?? text(person.id);
    if (!courierId) continue;
    couriers.push({
      courierId,
      name: text(person.name),
      phone: text(person.phone_number),
      total: count(row.total),
      under36: count(row.under_36),
      near48: count(row.near_48),
      over48: count(row.over_48),
      over72: count(row.over_72),
      oldestSince: text(row.oldest_since),
      oldestHours: hoursOrNull(row.oldest_hours),
      cancelledHeld: count(row.cancelled_held),
    });
  }
  const totals = asRecord(data.totals);
  const sum = (key: keyof Pick<CourierHoldSummaryRow, "total" | "under36" | "near48" | "over48" | "over72" | "cancelledHeld">) =>
    couriers.reduce((acc, row) => acc + row[key], 0);
  return {
    couriers,
    totals: {
      couriers: data.totals ? count(totals.couriers) : couriers.length,
      total: data.totals ? count(totals.total) : sum("total"),
      under36: data.totals ? count(totals.under_36) : sum("under36"),
      near48: data.totals ? count(totals.near_48) : sum("near48"),
      over48: data.totals ? count(totals.over_48) : sum("over48"),
      over72: data.totals ? count(totals.over_72) : sum("over72"),
      cancelledHeld: data.totals ? count(totals.cancelled_held) : sum("cancelledHeld"),
      oldestHours: hoursOrNull(totals.oldest_hours),
    },
  };
};

export const courierHoldSummaryQueryKey = (params: CourierHoldSummaryParams) =>
  ["orders", "courier-hold", "summary", params] as const;

/**
 * `GET orders/courier-hold/summary`. Kalit `["orders", …]` ostida — sotish / bekor qilish / jonli kanaldagi buyurtma
 * xabari (`["orders"]` ni yangilaydi) jamlamani ham yangilaydi.
 */
export const useCourierHoldSummary = (params: CourierHoldSummaryParams, enabled = true) =>
  useQuery({
    queryKey: courierHoldSummaryQueryKey(params),
    queryFn: async () =>
      toCourierHoldSummary((await api.get(API_ENDPOINTS.ORDERS.COURIER_HOLD_SUMMARY, { params })).data),
    enabled,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: "always",
    meta: { silentError: true },
  });
