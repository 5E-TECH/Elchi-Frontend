import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../shared/api/instance", () => ({
  api: { get: mocks.get },
}));

import { getInbox, getInboxUnreadCount } from "./inboxApi";

describe("inboxApi", () => {
  beforeEach(() => {
    mocks.get.mockReset();
  });

  it("unwraps the gateway envelope and normalizes list items + meta", async () => {
    mocks.get.mockResolvedValue({
      data: {
        statusCode: 200,
        message: "Notifications",
        data: {
          items: [
            {
              id: 1,
              type: "order.sold",
              category: "order",
              priority: "high",
              title: "Sold",
              body: null,
              data: null,
              link: "/orders/1",
              is_read: false,
              read_at: null,
              created_at: "2026-08-12T00:00:00Z",
            },
          ],
          unread: 3,
          meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        },
      },
    });

    const result = await getInbox({ page: 1, limit: 20 });

    expect(result.unread).toBe(3);
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "1",
      category: "order",
      priority: "high",
      is_read: false,
      link: "/orders/1",
    });
  });

  it("coerces unknown category/priority to safe defaults", async () => {
    mocks.get.mockResolvedValue({
      data: {
        data: {
          items: [{ id: 2, category: "weird", priority: "???", title: "x" }],
          unread: 0,
          meta: {},
        },
      },
    });

    const result = await getInbox({});

    expect(result.items[0].category).toBe("system");
    expect(result.items[0].priority).toBe("normal");
    expect(result.items[0].is_read).toBe(false);
  });

  it("reads the unread count from the envelope", async () => {
    mocks.get.mockResolvedValue({ data: { data: { unread: 7 } } });
    await expect(getInboxUnreadCount()).resolves.toBe(7);
  });

  it("tolerates an un-enveloped payload", async () => {
    mocks.get.mockResolvedValue({ data: { unread: 5 } });
    await expect(getInboxUnreadCount()).resolves.toBe(5);
  });
});
