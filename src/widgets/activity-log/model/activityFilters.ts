import { humanizeAction, type ActivityActionsCatalog, type ActivityLogParams } from "../../../entities/activity-log";
import type { SelectOption } from "../../../shared/ui/primitives";

/** Faoliyat jurnali filtrlari (maket `superadmin-activity-logs-list`). */
export type ActivityLogFilterValues = {
  search: string;
  service: string;
  action: string;
  entityType: string;
  userId: string;
  dateFrom: string;
  dateTo: string;
};

export const EMPTY_ACTIVITY_FILTERS: ActivityLogFilterValues = {
  search: "",
  service: "",
  action: "",
  entityType: "",
  userId: "",
  dateFrom: "",
  dateTo: "",
};

export type SheetValues = Pick<ActivityLogFilterValues, "service" | "action" | "entityType" | "userId">;

export const countSheetFilters = (values: SheetValues) =>
  [values.service, values.action, values.entityType.trim(), values.userId.trim()].filter(Boolean).length;

export const hasActivityFilters = (values: ActivityLogFilterValues) =>
  Boolean(values.search.trim() || countSheetFilters(values) || values.dateFrom || values.dateTo);

/** `YYYY-MM-DD` (mahalliy kun) → kun boshi / oxiri ISO (avvalgi `dayjs().startOf/endOf("day")` bilan bir xil). */
const dayBoundary = (day: string, end: boolean): string | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return undefined;
  const [, y, m, d] = match.map(Number);
  const date = end ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d, 0, 0, 0, 0);
  return date.toISOString();
};

/**
 * So'rov parametrlari: bo'sh qiymat yuborilmaydi, matn chetlari kesiladi, `from` — kun boshi, `to` — kun oxiri.
 * `entityTypeParam` — «Buyurtma» → `Order` (`useActivityLabels`).
 */
export const buildActivityLogParams = (
  filters: ActivityLogFilterValues,
  page: number,
  limit: number,
  entityTypeParam: (input: string) => string = (input) => input.trim(),
): ActivityLogParams => {
  const next: ActivityLogParams = { page, limit };
  const search = filters.search.trim();
  if (search) next.search = search;
  if (filters.service) next.service = filters.service;
  if (filters.action) next.action = filters.action;
  if (filters.entityType.trim()) next.entity_type = entityTypeParam(filters.entityType);
  if (filters.userId.trim()) next.user_id = filters.userId.trim();
  const from = dayBoundary(filters.dateFrom, false);
  const to = dayBoundary(filters.dateTo, true);
  if (from) next.from = from;
  if (to) next.to = to;
  return next;
};

export type ActionOptionLabels = {
  /** Tarjima qilingan fe'l yorlig'i (ru/en); `undefined` — reyestr yorlig'i. */
  action?: (action: string) => string | undefined;
  /** Guruh nomi (kategoriya kaliti + backend nomi → tarjima). */
  category?: (key: string | null, fallback: string | null) => string | undefined;
};

/** «Amal» variantlari: «Barchasi» + kategoriya guruhlari (`categories` tartibida). */
export const buildActionOptions = (
  catalog: ActivityActionsCatalog | undefined,
  allLabel: string,
  labels: ActionOptionLabels = {},
): SelectOption[] => {
  const all: SelectOption = { value: "", label: allLabel };
  if (!catalog) return [all];
  const { registry, categories, actions } = catalog;
  const verbLabel = (action: string, backendLabel?: string) =>
    labels.action?.(action) || backendLabel || humanizeAction(action) || action;
  if (!registry.length) {
    return [all, ...actions.map((action) => ({ value: action, label: verbLabel(action) }))];
  }
  const order = new Map(categories.map((category, index) => [category.key, index]));
  const groupOf = (category: string | null, categoryLabel: string | null) => {
    const fallback = categories.find((item) => item.key === category)?.label ?? categoryLabel ?? null;
    return labels.category ? labels.category(category, fallback) : (fallback ?? undefined);
  };
  const seen = new Set<string>();
  const known = registry
    .filter((item) => {
      if (seen.has(item.action)) return false;
      seen.add(item.action);
      return true;
    })
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const left = order.get(a.item.category ?? "") ?? Number.MAX_SAFE_INTEGER;
      const right = order.get(b.item.category ?? "") ?? Number.MAX_SAFE_INTEGER;
      return left - right || a.index - b.index;
    })
    .map(({ item }) => ({
      value: item.action,
      label: verbLabel(item.action, item.label),
      group: groupOf(item.category, item.categoryLabel),
      searchText: item.action,
    }));
  // Reyestrda yo'q, lekin ro'yxatda bor fe'l (yangi backend fe'li) — oxirida, guruhsiz.
  const rest = actions
    .filter((action) => !seen.has(action))
    .map((action) => ({ value: action, label: verbLabel(action), searchText: action }));
  return [all, ...known, ...rest];
};
