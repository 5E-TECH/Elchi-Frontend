import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api: http }));

import {
  createExpenseCategory,
  deleteExpenseCategory,
  getExpenseCategories,
  normalizeExpenseCategory,
  normalizeExpenseCategoryList,
  updateExpenseCategory,
} from "./expenseCategoryApi";

const row = (id: string, name: string, sortOrder: number, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  description: null,
  sort_order: sortOrder,
  is_deleted: false,
  created_by: null,
  updated_by: null,
  created_at: "2026-10-21T08:00:00.000Z",
  updated_at: "2026-10-21T08:00:00.000Z",
  ...extra,
});

beforeEach(() => {
  Object.values(http).forEach((fn) => fn.mockReset());
});

describe("normalizeExpenseCategory", () => {
  it("API qatori → model: ID satr, bo'sh tavsif — null, tartib son", () => {
    expect(normalizeExpenseCategory(row("2", " Yoqilg'i ", 2, { description: "Benzin, gaz, dizel" }))).toEqual({
      id: "2",
      name: "Yoqilg'i",
      description: "Benzin, gaz, dizel",
      sortOrder: 2,
      isDeleted: false,
    });
    expect(normalizeExpenseCategory({ id: 5, name: "Ofis", description: "  ", sort_order: "7" })).toEqual({
      id: "5",
      name: "Ofis",
      description: null,
      sortOrder: 7,
      isDeleted: false,
    });
  });

  it("ID yoki nomsiz qator — null", () => {
    expect(normalizeExpenseCategory({ name: "Nomli" })).toBeNull();
    expect(normalizeExpenseCategory({ id: "3", name: "  " })).toBeNull();
    expect(normalizeExpenseCategory(null)).toBeNull();
  });
});

describe("normalizeExpenseCategoryList", () => {
  it("`data.items` — backend tartibida (faollari oldin, sort_order, id), takror ID bir marta", () => {
    const list = normalizeExpenseCategoryList({
      statusCode: 200,
      data: {
        items: [
          row("9", "O'chirilgan", 1, { is_deleted: true }),
          row("3", "Uchinchi", 3),
          row("10", "Ikkinchi B", 2),
          row("2", "Ikkinchi A", 2),
          row("3", "Uchinchi (takror)", 3),
          { id: "", name: "ID siz" },
        ],
      },
    });
    expect(list.map((item) => item.id)).toEqual(["2", "10", "3", "9"]);
    expect(list[2].name).toBe("Uchinchi");
  });

  it("buzuq javob — bo'sh ro'yxat", () => {
    expect(normalizeExpenseCategoryList({ data: {} })).toEqual([]);
    expect(normalizeExpenseCategoryList(undefined)).toEqual([]);
  });
});

describe("expense category API", () => {
  it("GET — sukut bo'yicha paramsiz, `includeDeleted` da include_deleted=true", async () => {
    http.get.mockResolvedValue({ data: { data: { items: [row("1", "Ovqatlanish", 1)] } } });

    await expect(getExpenseCategories()).resolves.toEqual([
      { id: "1", name: "Ovqatlanish", description: null, sortOrder: 1, isDeleted: false },
    ]);
    expect(http.get).toHaveBeenLastCalledWith("finance/cashbox/expense-categories", { params: undefined });

    await getExpenseCategories({ includeDeleted: true });
    expect(http.get).toHaveBeenLastCalledWith("finance/cashbox/expense-categories", {
      params: { include_deleted: true },
    });
  });

  it("POST / PATCH / DELETE — to'g'ri manzil va tana, javobdan `data.category`", async () => {
    http.post.mockResolvedValue({ data: { statusCode: 201, data: { category: row("18", "Yangi", 18) } } });
    http.patch.mockResolvedValue({ data: { statusCode: 200, data: { category: row("2", "Yoqilg'i va moy", 2) } } });
    http.delete.mockResolvedValue({
      data: { statusCode: 200, data: { category: row("2", "Yoqilg'i va moy", 2, { is_deleted: true }) } },
    });

    await expect(createExpenseCategory({ name: "Yangi" })).resolves.toMatchObject({ id: "18", name: "Yangi" });
    expect(http.post).toHaveBeenCalledWith("finance/cashbox/expense-categories", { name: "Yangi" });

    await expect(updateExpenseCategory("2", { name: "Yoqilg'i va moy", description: null })).resolves.toMatchObject({
      id: "2",
      name: "Yoqilg'i va moy",
    });
    expect(http.patch).toHaveBeenCalledWith("finance/cashbox/expense-categories/2", {
      name: "Yoqilg'i va moy",
      description: null,
    });

    await expect(deleteExpenseCategory("2")).resolves.toMatchObject({ id: "2", isDeleted: true });
    expect(http.delete).toHaveBeenCalledWith("finance/cashbox/expense-categories/2");
  });
});
