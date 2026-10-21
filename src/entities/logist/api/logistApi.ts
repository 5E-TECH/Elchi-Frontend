import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import type { BulkAssignRegionLogistRequest, Logist, LogistRegion } from "../model/types";

type Raw = Record<string, unknown>;

const asRecord = (value: unknown): Raw | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Raw) : null;

const idOf = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
};

/** `GET /logists` qatori → `Logist` (javob shakli `GET /users` bilan bir xil — identity `user.find_all`). */
export const normalizeLogist = (value: unknown): Logist | null => {
  const item = asRecord(value);
  const id = idOf(item?.id);
  if (!item || !id) return null;
  return {
    id,
    name: typeof item.name === "string" ? item.name.trim() : "",
    phone_number: typeof item.phone_number === "string" ? item.phone_number : "",
    status: item.status === "inactive" ? "inactive" : "active",
  };
};

/** `{ statusCode, data: { items, meta } }` (yoki `data` massiv) → logistlar. */
export const normalizeLogistList = (value: unknown): Logist[] => {
  const response = asRecord(value) ?? {};
  const data = asRecord(response.data);
  const items = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(response.data)
      ? response.data
      : Array.isArray(response.items)
        ? response.items
        : [];
  return items.map(normalizeLogist).filter((logist): logist is Logist => Boolean(logist));
};

/** `GET /region` → viloyatlar (`id`, `name`, `logist_id`). Tumanlar e'tiborga olinmaydi. */
export const normalizeLogistRegions = (value: unknown): LogistRegion[] => {
  const response = asRecord(value);
  const body = response && "data" in response ? response.data : value;
  const rows = Array.isArray(body)
    ? body
    : Array.isArray(asRecord(body)?.items)
      ? (asRecord(body)?.items as unknown[])
      : [];
  return rows.flatMap((row) => {
    const region = asRecord(row);
    const id = idOf(region?.id);
    if (!region || !id) return [];
    return [
      {
        id,
        name: typeof region.name === "string" && region.name.trim() ? region.name.trim() : "—",
        logistId: idOf(region.logist_id),
      },
    ];
  });
};

/**
 * Backend sahifasi 100 tadan oshmaydi (`normalizeQuery`): logistlar soni kichik — bitta so'rov, qidiruv klientda.
 */
export const LOGISTS_LIMIT = 100;

export const getLogists = async (): Promise<Logist[]> => {
  const response = await api.get(API_ENDPOINTS.LOGISTS.BASE, {
    params: { page: 1, limit: LOGISTS_LIMIT },
  });
  return normalizeLogistList(response.data);
};

export const getLogistRegions = async (): Promise<LogistRegion[]> => {
  const response = await api.get(API_ENDPOINTS.REGIONS.BASE);
  return normalizeLogistRegions(response.data);
};

export const bulkAssignRegionLogist = async (
  body: BulkAssignRegionLogistRequest,
): Promise<void> => {
  await api.post(API_ENDPOINTS.REGIONS.LOGIST_BULK, body);
};

/** Bitta viloyat: `logistId: null` — logistni olib tashlash (`PATCH region/:id/logist`). */
export const assignRegionLogist = async (
  regionId: string,
  logistId: string | null,
): Promise<void> => {
  await api.patch(API_ENDPOINTS.REGIONS.LOGIST(regionId), { logist_id: logistId });
};
