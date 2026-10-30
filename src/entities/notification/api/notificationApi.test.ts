import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMyTelegramGroups, getNotifications } from "./notificationApi";

/** `GET /notifications` normallashtirish — tarmoqsiz (`api` mock). TG-B: sana kelmasa `null` («hozir» to'qilmaydi). */

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../shared/api/instance", () => ({ api: { get: mocks.get } }));

beforeEach(() => mocks.get.mockReset());

describe("getNotifications", () => {
  it("qatorlar normallashadi: `createdAt` zaxirasi, `group_type`, `is_active` («false» satri ham)", async () => {
    mocks.get.mockResolvedValue({
      data: {
        data: {
          items: [
            { id: 1, market_id: 201, group_id: -100, group_type: "cancel", is_active: "false", createdAt: "2026-10-06T09:00:00.000Z" },
          ],
          meta: { total: 1, page: 1, limit: 10 },
        },
      },
    });

    const result = await getNotifications({ market_id: "201", page: 1, limit: 10 });

    expect(mocks.get).toHaveBeenCalledWith(expect.any(String), { params: { market_id: "201", page: 1, limit: 10 } });
    expect(result.total).toBe(1);
    expect(result.data[0]).toMatchObject({
      id: "1",
      market_id: "201",
      group_id: "-100",
      group_type: "cancel",
      is_active: false,
      created_at: "2026-10-06T09:00:00.000Z",
    });
  });

  it("sana umuman kelmasa — `created_at: null` (avval «hozirgi vaqt» qo'yilardi)", async () => {
    mocks.get.mockResolvedValue({ data: { data: [{ id: 2, market_id: 201, group_type: "create" }] } });

    const result = await getNotifications({ page: 1, limit: 10 });

    expect(result.data[0].created_at).toBeNull();
    expect(result.data[0].is_active).toBe(true);
  });

  it("G085w5Qr: nofaol qatorda `inactive_reason` / `inactive_at`; noma'lum sabab va faol qatorda — `null`", async () => {
    mocks.get.mockResolvedValue({
      data: {
        data: {
          items: [
            { id: 1, market_id: 1, group_type: "create", is_active: false, inactive_reason: "kicked", inactive_at: "2026-10-21T08:00:00.000Z" },
            { id: 2, market_id: 1, group_type: "cancel", is_active: false, inactive_reason: "archived", inactive_at: null },
            { id: 3, market_id: 2, group_type: "create", is_active: false },
            { id: 4, market_id: 2, group_type: "cancel", is_active: true, inactive_reason: "manual", inactive_at: "2026-10-21T08:00:00.000Z" },
          ],
        },
      },
    });

    const result = await getNotifications({ page: 1, limit: 10 });

    expect(result.data.map(({ inactive_reason, inactive_at }) => ({ inactive_reason, inactive_at }))).toEqual([
      { inactive_reason: "kicked", inactive_at: "2026-10-21T08:00:00.000Z" },
      { inactive_reason: null, inactive_at: null },
      { inactive_reason: null, inactive_at: null },
      { inactive_reason: null, inactive_at: null },
    ]);
  });
});

describe("getMyTelegramGroups (KJNHAlGW, TG-C)", () => {
  it("`GET notifications/me/telegram-groups` → ikkala tur: ulangan, nofaol + sabab; ulanmaganda `is_active: false`", async () => {
    mocks.get.mockResolvedValue({
      data: {
        statusCode: 200,
        data: [
          { group_type: "cancel", linked: true, is_active: false, linked_at: "2026-10-06T09:00:00.000Z", inactive_reason: "kicked", linked_by: "9", linked_by_owner: true },
          { group_type: "create", linked: true, is_active: true, linked_at: "2026-10-06T09:00:00.000Z", inactive_reason: null, linked_by: "37", linked_by_owner: false },
        ],
      },
    });

    const result = await getMyTelegramGroups();

    expect(mocks.get).toHaveBeenCalledWith("notifications/me/telegram-groups");
    expect(result).toEqual([
      { group_type: "create", linked: true, is_active: true, linked_at: "2026-10-06T09:00:00.000Z", inactive_reason: null, linked_by_owner: false },
      { group_type: "cancel", linked: true, is_active: false, linked_at: "2026-10-06T09:00:00.000Z", inactive_reason: "kicked", linked_by_owner: true },
    ]);
  });

  it("tur kelmasa, `linked: false` yoki javob boshqa shaklda — ulanmagan; noma'lum sabab — `null`", async () => {
    mocks.get.mockResolvedValue({
      data: {
        data: [
          { group_type: "create", linked: false, is_active: null, linked_at: null, inactive_reason: null },
          { group_type: "cancel", linked: true, is_active: false, linked_at: null, inactive_reason: "new_reason" },
        ],
      },
    });
    expect(await getMyTelegramGroups()).toEqual([
      { group_type: "create", linked: false, is_active: false, linked_at: null, inactive_reason: null, linked_by_owner: null },
      // Eski backend (`linked_by_owner` yo'q) — noma'lum, ogohlantirish chiqmaydi.
      { group_type: "cancel", linked: true, is_active: false, linked_at: null, inactive_reason: null, linked_by_owner: null },
    ]);

    mocks.get.mockResolvedValue({ data: { data: {} } });
    expect((await getMyTelegramGroups()).map((row) => [row.group_type, row.linked])).toEqual([
      ["create", false],
      ["cancel", false],
    ]);
  });
});
