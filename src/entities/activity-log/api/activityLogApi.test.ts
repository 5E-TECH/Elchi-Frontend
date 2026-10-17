import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../shared/api/instance", () => ({
  api: { get: mocks.get },
}));

import { getActivityActionCatalog, getActivityLogs, getEntityHistory } from "./activityLogApi";

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

  it("returns the actions array from the envelope", async () => {
    mocks.get.mockResolvedValue({ data: { data: ["create", "update", "status_change"] } });
    await expect(getActivityActionCatalog()).resolves.toEqual({
      actions: ["create", "update", "status_change"],
      registry: [],
    });
  });

  it("reads the y8CxCtcK registry (labels, categories) next to the verbs", async () => {
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
    const catalog = await getActivityActionCatalog();
    expect(catalog.actions).toEqual(["status_change", "order.cancel"]);
    expect(catalog.registry).toEqual([
      { action: "status_change", label: "Holat o'zgardi", category: "general", category_label: "Umumiy" },
      { action: "order.cancel", label: "Bekor qilindi", category: "order", category_label: "Buyurtma" },
    ]);
  });

  it("keeps action_meta and actor_status from the enriched feed row", async () => {
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
    expect(result.items[0].action_meta).toMatchObject({ label: "Tizimdan chiqdi", known: true });
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
