import { describe, expect, it } from "vitest";
import type { ActivityActionsCatalog } from "../../../entities/activity-log";
import { buildActionOptions, buildActivityLogParams, EMPTY_ACTIVITY_FILTERS } from "./activityFilters";

describe("buildActivityLogParams", () => {
  it("`from` — kun boshi, `to` — kun oxiri (mahalliy vaqt, ISO)", () => {
    const params = buildActivityLogParams({ ...EMPTY_ACTIVITY_FILTERS, dateFrom: "2026-10-01", dateTo: "2026-10-08" }, 1, 20);
    expect(params.from).toBe(new Date(2026, 9, 1, 0, 0, 0, 0).toISOString());
    expect(params.to).toBe(new Date(2026, 9, 8, 23, 59, 59, 999).toISOString());
  });

  it("bo'sh qiymatlar yuborilmaydi; matn chetidagi bo'shliq olib tashlanadi", () => {
    expect(buildActivityLogParams({ ...EMPTY_ACTIVITY_FILTERS, entityType: "  Order ", userId: " ", search: "  " }, 3, 20)).toEqual({
      page: 3,
      limit: 20,
      entity_type: "Order",
    });
  });

  it("obyekt turi `entityTypeParam` orqali backend turiga o'giriladi", () => {
    expect(
      buildActivityLogParams({ ...EMPTY_ACTIVITY_FILTERS, entityType: "buyurtma" }, 1, 20, (input) =>
        input.trim() === "buyurtma" ? "Order" : input,
      ),
    ).toEqual({ page: 1, limit: 20, entity_type: "Order" });
  });
});

describe("buildActionOptions — yorliq va guruh tarjimasi", () => {
  const catalog: ActivityActionsCatalog = {
    actions: ["login", "order.cancel"],
    registry: [
      { action: "login", label: "Tizimga kirdi", category: "auth", categoryLabel: "Kirish", icon: null, tone: null, known: true },
      { action: "order.cancel", label: "Bekor qilindi", category: "order", categoryLabel: "Buyurtma", icon: null, tone: null, known: true },
    ],
    categories: [],
  };

  it("tarjima berilmasa — backend yorlig'i va `category_label`", () => {
    expect(buildActionOptions(catalog, "Barchasi").slice(1)).toEqual([
      { value: "login", label: "Tizimga kirdi", group: "Kirish", searchText: "login" },
      { value: "order.cancel", label: "Bekor qilindi", group: "Buyurtma", searchText: "order.cancel" },
    ]);
  });

  it("ru/en: fe'l va guruh yorlig'i chaqiruvchidan", () => {
    const options = buildActionOptions(catalog, "Все", {
      action: (action) => (action === "login" ? "Вход в систему" : undefined),
      category: (key) => (key === "auth" ? "Вход" : key === "order" ? "Заказ" : undefined),
    });
    expect(options.map((option) => [option.label, option.group])).toEqual([
      ["Все", undefined],
      ["Вход в систему", "Вход"],
      ["Bekor qilindi", "Заказ"],
    ]);
  });
});
