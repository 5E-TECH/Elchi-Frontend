import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import type {
  CreateExpenseCategoryRequest,
  ExpenseCategory,
  UpdateExpenseCategoryRequest,
} from "../model/types";

type Raw = Record<string, unknown>;

const asRecord = (value: unknown): Raw | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Raw) : null;

const idOf = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
};

const textOf = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** API qatori (`{ id, name, description, sort_order, is_deleted, … }`) → `ExpenseCategory`; ID siz / nomsiz — `null`. */
export const normalizeExpenseCategory = (value: unknown): ExpenseCategory | null => {
  const item = asRecord(value);
  const id = idOf(item?.id);
  const name = textOf(item?.name);
  if (!item || !id || !name) return null;
  const sortOrder = Number(item.sort_order);
  return {
    id,
    name,
    description: textOf(item.description) || null,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    isDeleted: item.is_deleted === true,
  };
};

/**
 * Ro'yxat tartibi — backend bilan bir xil: faollari oldin, so'ng `sort_order`, so'ng `id` (raqam sifatida).
 * Keshni qo'lda yangilaganda (qo'shish, tartib raqamini o'zgartirish) ro'yxat server qaytaradigan tartibda qoladi.
 */
export const sortExpenseCategories = (items: readonly ExpenseCategory[]): ExpenseCategory[] =>
  [...items].sort(
    (a, b) =>
      Number(a.isDeleted) - Number(b.isDeleted) ||
      a.sortOrder - b.sortOrder ||
      Number(a.id) - Number(b.id) ||
      a.id.localeCompare(b.id),
  );

/** `{ statusCode, data: { items } }` (yoki `data` massiv) → kategoriyalar, takror ID siz, tartiblangan. */
export const normalizeExpenseCategoryList = (value: unknown): ExpenseCategory[] => {
  const response = asRecord(value) ?? {};
  const data = asRecord(response.data);
  const rows = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(response.data)
      ? response.data
      : Array.isArray(response.items)
        ? response.items
        : [];
  const byId = new Map<string, ExpenseCategory>();
  for (const row of rows) {
    const item = normalizeExpenseCategory(row);
    if (item && !byId.has(item.id)) byId.set(item.id, item);
  }
  return sortExpenseCategories([...byId.values()]);
};

/** `POST` / `PATCH` / `DELETE` javobi — `data.category`. Shakl buzuq bo'lsa `null` (chaqiruvchi ro'yxatni qayta so'raydi). */
const categoryOf = (value: unknown): ExpenseCategory | null => {
  const data = asRecord(asRecord(value)?.data);
  return normalizeExpenseCategory(data?.category ?? data);
};

export const getExpenseCategories = async ({ includeDeleted = false }: { includeDeleted?: boolean } = {}) => {
  const response = await api.get(API_ENDPOINTS.CASHBOX.EXPENSE_CATEGORIES, {
    params: includeDeleted ? { include_deleted: true } : undefined,
  });
  return normalizeExpenseCategoryList(response.data);
};

export const createExpenseCategory = async (body: CreateExpenseCategoryRequest) => {
  const response = await api.post(API_ENDPOINTS.CASHBOX.EXPENSE_CATEGORIES, body);
  return categoryOf(response.data);
};

export const updateExpenseCategory = async (id: string, body: UpdateExpenseCategoryRequest) => {
  const response = await api.patch(API_ENDPOINTS.CASHBOX.EXPENSE_CATEGORY(id), body);
  return categoryOf(response.data);
};

export const deleteExpenseCategory = async (id: string) => {
  const response = await api.delete(API_ENDPOINTS.CASHBOX.EXPENSE_CATEGORY(id));
  return categoryOf(response.data);
};
