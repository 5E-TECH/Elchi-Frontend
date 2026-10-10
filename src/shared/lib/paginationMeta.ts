/**
 * Ro'yxat javobidan sahifalash ma'lumoti. Backend standarti:
 * `{ statusCode, message, data: { items, meta: { page, limit, total, totalPages } } }`.
 * Eski shakllar ham o'qiladi: `{ total, page, limit }`, `{ data: { total } }`,
 * `{ meta }`, `{ pagination }`. Topilmagan maydon — `undefined` (taxmin qilinmaydi).
 */
export interface PaginationMeta {
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : undefined;

const toNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const FIELDS: Record<keyof PaginationMeta, string[]> = {
  total: ["total", "totalItems", "total_items", "count"],
  page: ["page", "currentPage", "current_page"],
  limit: ["limit", "perPage", "per_page", "pageSize", "page_size"],
  totalPages: ["totalPages", "total_pages", "pages"],
};

export const extractPaginationMeta = (payload: unknown): PaginationMeta => {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  // Ustuvorlik: eng tashqi aniq qiymat → data → data.meta → meta.
  const sources = [
    root,
    data,
    asRecord(data?.meta),
    asRecord(data?.pagination),
    asRecord(root?.meta),
    asRecord(root?.pagination),
  ].filter((source): source is UnknownRecord => Boolean(source));

  const pick = (keys: string[]) => {
    for (const source of sources) {
      for (const key of keys) {
        const value = toNumber(source[key]);
        if (value !== undefined) return value;
      }
    }
    return undefined;
  };

  return {
    total: pick(FIELDS.total),
    page: pick(FIELDS.page),
    limit: pick(FIELDS.limit),
    totalPages: pick(FIELDS.totalPages),
  };
};
