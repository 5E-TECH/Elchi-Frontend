import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

/**
 * SMENALAR TARIXI — `GET finance/shift` (8OYPuz7J; eng yangisi birinchi). Doira: superadmin / admin — `cashbox_user_id`
 * (`"0"` — asosiy kassa), menejer — backend JWT bo'yicha o'z filialini majburlaydi (parametr yuborilmaydi).
 * Kalit `shift` prefiksi ostida — smena ochilsa / yopilsa ro'yxat qayta o'qiladi.
 */

/** `entities/payments` dagi `shift` kaliti bilan bir xil (import — test mock'lari modulni butunlay almashtiradi). */
const SHIFT_QUERY_KEY = "shift";

/** Asosiy kassa (`finance.shifts.cashbox_user_id`). */
export const MAIN_CASHBOX_USER_ID = "0";

export type ShiftHistoryRow = {
  id: string;
  status: "open" | "closed";
  openedAt: string | null;
  closedAt: string | null;
  openedByName: string | null;
  closedByName: string | null;
  /** Tizim jadval bo'yicha yopgan («Avtomatik yopildi»). */
  autoClosed: boolean;
};

export type ShiftHistoryPage = { items: ShiftHistoryRow[]; total: number };

export type ShiftHistoryParams = { page: number; limit: number; cashboxUserId?: string };

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

const normalizeRow = (value: unknown): ShiftHistoryRow | null => {
  const row = asRecord(value);
  const id = row.id === undefined || row.id === null ? "" : String(row.id);
  if (!/^\d+$/.test(id)) return null;
  return {
    id,
    status: String(row.status ?? "").toLowerCase() === "closed" ? "closed" : "open",
    openedAt: text(row.opened_at),
    closedAt: text(row.closed_at),
    openedByName: text(row.opened_by_name),
    closedByName: text(row.closed_by_name),
    autoClosed: row.close_reason === "auto" || row.closed_by_system === true,
  };
};

/** `{ statusCode, data: { items, pagination: { total } } }`. */
export const normalizeShiftHistory = (body: unknown): ShiftHistoryPage => {
  const data = asRecord(asRecord(body).data);
  const items = (Array.isArray(data.items) ? data.items : [])
    .map(normalizeRow)
    .filter((row): row is ShiftHistoryRow => row !== null);
  const total = Number(asRecord(data.pagination).total);
  return { items, total: Number.isFinite(total) && total > 0 ? total : items.length };
};

export const useShiftHistory = ({ page, limit, cashboxUserId }: ShiftHistoryParams, enabled = true) =>
  useQuery({
    queryKey: [SHIFT_QUERY_KEY, "history", { page, limit, cashboxUserId: cashboxUserId ?? null }],
    queryFn: () =>
      api
        .get(API_ENDPOINTS.CASHBOX.SHIFT_HISTORY, {
          params: { page, limit, ...(cashboxUserId ? { cashbox_user_id: cashboxUserId } : {}) },
        })
        .then((res) => normalizeShiftHistory(res.data)),
    enabled,
    placeholderData: keepPreviousData,
    // Xato oynaning o'zida (`ErrorState` + «Qayta urinish») — global xabar takrorlamasin.
    meta: { silentError: true },
  });
