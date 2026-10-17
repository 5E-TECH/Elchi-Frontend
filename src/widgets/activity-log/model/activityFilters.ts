import { humanizeAction, type ActivityActionsCatalog } from "../../../entities/activity-log";
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

/** «Amal» variantlari: «Barchasi» + kategoriya guruhlari (`categories` tartibida). */
export const buildActionOptions = (catalog: ActivityActionsCatalog | undefined, allLabel: string): SelectOption[] => {
  const all: SelectOption = { value: "", label: allLabel };
  if (!catalog) return [all];
  const { registry, categories, actions } = catalog;
  if (!registry.length) {
    return [all, ...actions.map((action) => ({ value: action, label: humanizeAction(action) || action }))];
  }
  const order = new Map(categories.map((category, index) => [category.key, index]));
  const groupOf = (category: string | null, categoryLabel: string | null) =>
    categories.find((item) => item.key === category)?.label ?? categoryLabel ?? undefined;
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
      label: item.label || humanizeAction(item.action),
      group: groupOf(item.category, item.categoryLabel),
      searchText: item.action,
    }));
  // Reyestrda yo'q, lekin ro'yxatda bor fe'l (yangi backend fe'li) — oxirida, guruhsiz.
  const rest = actions
    .filter((action) => !seen.has(action))
    .map((action) => ({ value: action, label: humanizeAction(action) || action, searchText: action }));
  return [all, ...known, ...rest];
};
