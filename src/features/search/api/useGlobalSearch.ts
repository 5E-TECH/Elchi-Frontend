import { useQuery } from "@tanstack/react-query";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";

export interface GlobalSearchParams {
  q: string;
  type?: string;
  source?: string;
  page?: number;
  limit?: number;
}

export interface GlobalSearchItem {
  id: string;
  sourceId?: string;
  title: string;
  subtitle?: string;
  type?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  raw: Record<string, unknown>;
}

export interface GlobalSearchMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface GlobalSearchResponse {
  items: GlobalSearchItem[];
  meta: GlobalSearchMeta;
  raw: unknown;
}

const toDisplayItem = (item: unknown, index: number): GlobalSearchItem | null => {
  if (typeof item !== "object" || item === null) return null;
  const raw = item as Record<string, unknown>;

  const idValue = raw.id ?? raw._id ?? raw.uuid ?? index;
  const sourceId = raw.sourceId ? String(raw.sourceId) : undefined;
  const titleValue = raw.title ?? raw.name ?? raw.full_name ?? raw.phone_number ?? raw.username;
  const normalizeSubtitle = (value: unknown) => {
    if (typeof value !== "string") return value ? String(value) : undefined;
    const parts = value
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length <= 1) return value;
    const uniqueParts = Array.from(new Set(parts));
    return uniqueParts.join(" ");
  };

  const subtitleValue = normalizeSubtitle(raw.content) ?? raw.role ?? raw.status;
  const typeValue = raw.type ?? raw.entity ?? raw.model;
  const sourceValue = raw.source;
  const metadataValue =
    typeof raw.metadata === "object" && raw.metadata !== null
      ? (raw.metadata as Record<string, unknown>)
      : undefined;

  return {
    id: String(idValue),
    sourceId,
    title: titleValue ? String(titleValue) : `Natija #${index + 1}`,
    subtitle: subtitleValue ? String(subtitleValue) : undefined,
    type: typeValue ? String(typeValue) : undefined,
    source: sourceValue ? String(sourceValue) : undefined,
    metadata: metadataValue,
    raw,
  };
};

export const useGlobalSearch = (params: GlobalSearchParams, enabled = true) =>
  useQuery({
    queryKey: ["global-search", params],
    queryFn: async () => {
      const response = await api.get(API_ENDPOINTS.SEARCH.BASE, {
        params: {
          q: params.q,
          type: params.type,
          source: params.source,
          page: params.page ?? 1,
          limit: params.limit ?? 10,
        },
      });

      const payload = response.data as Record<string, unknown>;
      const data = (payload.data as Record<string, unknown> | undefined) ?? {};
      const rawItems = Array.isArray(data.items) ? data.items : [];
      const items = rawItems
        .map((item, index) => toDisplayItem(item, index))
        .filter((item): item is GlobalSearchItem => Boolean(item));
      const metaRaw = (data.meta as Record<string, unknown> | undefined) ?? {};
      const meta: GlobalSearchMeta = {
        page: Number(metaRaw.page ?? 1),
        limit: Number(metaRaw.limit ?? params.limit ?? 10),
        total: Number(metaRaw.total ?? items.length),
        totalPages: Number(metaRaw.totalPages ?? 1),
      };

      return { items, meta, raw: payload } satisfies GlobalSearchResponse;
    },
    enabled: enabled && params.q.trim().length > 0,
    placeholderData: (prev) => prev,
  });
