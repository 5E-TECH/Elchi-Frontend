import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../shared/api/instance", () => ({
  api: { get: mocks.get },
}));

import { getActivityActions, getActivityLogs, getEntityHistory } from "./activityLogApi";

describe("activityLogApi", () => {
  beforeEach(() => {
    mocks.get.mockReset();
  });

  it("unwraps the feed envelope and normalizes items, meta and _service", async () => {
    mocks.get.mockResolvedValue({
      data: {
        data: {
          items: [
            {
              id: 5,
              entity_type: "Order",
              entity_id: "123",
              action: "status_change",
              user_id: "7",
              user_name: "Ali",
              user_role: "manager",
              _service: "order",
              created_at: "2026-08-12T00:00:00Z",
              actor: { id: 7, name: "Ali", role: "manager" },
              old_value: { status: "new" },
              new_value: { status: "sold" },
            },
          ],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        },
      },
    });

    const result = await getActivityLogs({ page: 1, limit: 20 });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "5",
      entity_type: "Order",
      entity_id: "123",
      action: "status_change",
      service: "order",
    });
    expect(result.items[0].actor).toMatchObject({ id: "7", name: "Ali", role: "manager" });
  });

  it("eski kontrakt: faqat fe'llar — reyestr va kategoriyalar bo'sh", async () => {
    mocks.get.mockResolvedValue({ data: { data: ["create", "update", "status_change"] } });
    await expect(getActivityActions()).resolves.toEqual({
      actions: ["create", "update", "status_change"],
      registry: [],
      categories: [],
    });
  });

  it("y8CxCtcK: `registry` va `categories` o'qiladi (FRONTEND_CHANGELOG 2026-10-14)", async () => {
    mocks.get.mockResolvedValue({
      data: {
        statusCode: 200,
        data: ["finance.manual_expense", "order.sell"],
        registry: [
          {
            action: "finance.manual_expense",
            label: "Qo'lda chiqim",
            category: "finance",
            category_label: "Moliya",
            icon: "minus",
            tone: "rose",
            known: true,
          },
          { action: "order.sell", label: "Sotildi", category: "order", category_label: "Buyurtma", tone: "green" },
          { label: "" },
        ],
        categories: [{ key: "order", label: "Buyurtma" }, { key: "finance", label: "Moliya" }, { label: "kalitsiz" }],
      },
    });

    const catalog = await getActivityActions();

    expect(catalog.actions).toEqual(["finance.manual_expense", "order.sell"]);
    expect(catalog.registry).toEqual([
      {
        action: "finance.manual_expense",
        label: "Qo'lda chiqim",
        category: "finance",
        categoryLabel: "Moliya",
        icon: "minus",
        tone: "rose",
        known: true,
      },
      { action: "order.sell", label: "Sotildi", category: "order", categoryLabel: "Buyurtma", icon: null, tone: "green", known: true },
    ]);
    expect(catalog.categories).toEqual([
      { key: "order", label: "Buyurtma" },
      { key: "finance", label: "Moliya" },
    ]);
  });

  it("qo'shimcha o'ram (`data: { data, registry, categories }`) ham o'qiladi", async () => {
    mocks.get.mockResolvedValue({
      data: { data: { data: ["login"], registry: [{ action: "login", label: "Tizimga kirdi" }], categories: [] } },
    });
    const catalog = await getActivityActions();
    expect(catalog.actions).toEqual(["login"]);
    expect(catalog.registry[0]).toMatchObject({ action: "login", label: "Tizimga kirdi", known: true });
  });

  it("qatorda `action_meta` va `actor_status` (y8CxCtcK); eski backendda — null", async () => {
    mocks.get.mockResolvedValue({
      data: {
        data: {
          items: [
            {
              id: 9,
              action: "order.batch_sent",
              action_meta: { action: "order.batch_sent", label: "Order batch sent", icon: "dot", tone: "slate", known: false },
              actor_status: "unresolved",
              actor: { id: 44, name: null, role: null, resolved: false },
              user_id: "44",
            },
            { id: 10, action: "login" },
          ],
          meta: { total: 2 },
        },
      },
    });

    const result = await getActivityLogs({ page: 1, limit: 20 });

    expect(result.items[0].action_meta).toEqual({
      action: "order.batch_sent",
      label: "Order batch sent",
      category: null,
      categoryLabel: null,
      icon: "dot",
      tone: "slate",
      known: false,
    });
    expect(result.items[0].actor_status).toBe("unresolved");
    expect(result.items[0].actor?.resolved).toBe(false);
    expect(result.items[1].action_meta).toBeNull();
    expect(result.items[1].actor_status).toBeNull();
  });

  it("G2: reyestr (yorliq, kategoriya) fe'llar yonida o'qiladi; ikon/ton bo'lmasa — null", async () => {
    mocks.get.mockResolvedValue({
      data: {
        data: ["status_change", "order.cancel"],
        registry: [
          { action: "status_change", label: "Holat o'zgardi", category: "general", category_label: "Umumiy", icon: "swap", tone: "blue" },
          { action: "order.cancel", label: "Bekor qilindi", category: "order", category_label: "Buyurtma" },
        ],
        categories: [],
      },
    });
    const catalog = await getActivityActions();
    expect(catalog.actions).toEqual(["status_change", "order.cancel"]);
    expect(catalog.registry).toEqual([
      { action: "status_change", label: "Holat o'zgardi", category: "general", categoryLabel: "Umumiy", icon: "swap", tone: "blue", known: true },
      { action: "order.cancel", label: "Bekor qilindi", category: "order", categoryLabel: "Buyurtma", icon: null, tone: null, known: true },
    ]);
    expect(catalog.categories).toEqual([]);
  });

  it("G2: boyitilgan qatordagi `action_meta` va `actor_status: snapshot` saqlanadi", async () => {
    mocks.get.mockResolvedValue({
      data: {
        data: {
          items: [
            {
              id: 9,
              action: "logout",
              actor_status: "snapshot",
              action_meta: { action: "logout", label: "Tizimdan chiqdi", category: "auth", category_label: "Kirish", icon: "logout", tone: "slate", known: true },
            },
          ],
          meta: { total: 1 },
        },
      },
    });
    const result = await getActivityLogs({ page: 1, limit: 20 });
    expect(result.items[0].actor_status).toBe("snapshot");
    expect(result.items[0].action_meta).toMatchObject({ label: "Tizimdan chiqdi", categoryLabel: "Kirish", known: true });
  });

  it("normalizes entity-history items", async () => {
    mocks.get.mockResolvedValue({
      data: { data: { items: [{ id: 1, entity_type: "User", entity_id: "9", action: "update" }], meta: { total: 1 } } },
    });

    const result = await getEntityHistory("User", "9");

    expect(result).toHaveLength(1);
    expect(result[0].entity_type).toBe("User");
    expect(result[0].id).toBe("1");
  });
});
