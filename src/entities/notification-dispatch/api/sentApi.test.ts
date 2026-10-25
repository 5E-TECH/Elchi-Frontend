import { vi } from "vitest";
import { api } from "../../../shared/api/api";
import { getSentList, normalizeSentDetail, normalizeSentList } from "./sentApi";

describe("normalizeSentDetail", () => {
  it("unwraps the gateway envelope and keeps only safe, typed fields", () => {
    const detail = normalizeSentDetail({
      statusCode: 200,
      message: "Dispatch",
      data: {
        dispatch_id: "b2c4",
        status: "partial",
        type: "system.manual",
        category: "branch",
        priority: "high",
        title: "Ertaga qabul punkti 10:00 dan ishlaydi",
        body: "Matn",
        link: null,
        channels: ["in_app", "telegram"],
        recipients: 148,
        dispatched: 148,
        skipped_by_preference: "0",
        by_channel: { in_app: 148, telegram: "131" },
        channel_status: { in_app: { sent: 148 }, telegram: { sent: 125, failed: 6, skipped: 17 } },
        no_provider: [],
        audience: { roles: ["courier", "market"], recipient_ids: 0 },
        error: "QueryFailedError: raw",
        created_by: { id: "1", name: "Shodiyor Ergashev", role: "superadmin" },
        created_at: "2026-10-21T09:15:00.000Z",
        finished_at: "2026-10-21T09:15:04.000Z",
        undelivered: {
          items: [
            {
              notification_id: 901,
              recipient_id: 3,
              name: "Baraka Shop",
              role: "market",
              failures: [{ channel: "telegram", status: "skipped", reason: "no_telegram_id" }, { status: "x" }],
            },
          ],
          meta: { page: 1, limit: 10, total: 33, totalPages: 4 },
        },
      },
    });
    expect(detail).toMatchObject({
      dispatch_id: "b2c4",
      status: "partial",
      by_channel: { in_app: 148, telegram: 131 },
      channel_status: { telegram: { sent: 125, failed: 6, skipped: 17 } },
      audience: { roles: ["courier", "market"], recipient_ids: 0 },
      created_by: { id: "1", name: "Shodiyor Ergashev", role: "superadmin" },
      undelivered: { page: 1, limit: 10, total: 33 },
    });
    expect(detail.undelivered.items[0]).toEqual({
      notification_id: "901",
      recipient_id: "3",
      name: "Baraka Shop",
      role: "market",
      failures: [{ channel: "telegram", status: "skipped", reason: "no_telegram_id" }],
    });
    // Texnik `error` modelga kirmaydi — UI uni hech qachon chiza olmaydi.
    expect(detail).not.toHaveProperty("error");
  });

  it("is defensive about missing fields", () => {
    const detail = normalizeSentDetail({ data: { status: "weird" } }, { page: 2, limit: 5 });
    expect(detail.status).toBe("running");
    expect(detail.channel_status).toBeNull();
    expect(detail.created_by).toBeNull();
    expect(detail.undelivered).toEqual({ items: [], page: 2, limit: 5, total: 0 });
  });
});

describe("normalizeSentList (NS-2)", () => {
  it("unwraps `{ items, meta }`, drops the raw `message`, keeps a missing audience as null", () => {
    const list = normalizeSentList({
      statusCode: 200,
      message: "Dispatch history",
      data: {
        items: [
          {
            dispatch_id: "a1",
            status: "partial",
            type: "system.manual",
            title: "Ertaga",
            body_preview: "Matn boshi",
            channels: ["in_app", "telegram"],
            recipients: 148,
            dispatched: "148",
            skipped_by_preference: 2,
            by_channel: { in_app: 148, telegram: 131 },
            channel_status: { telegram: { queued: 131, skipped: 17 } },
            no_provider: [],
            message: "Partially dispatched",
            created_by: { id: "7", name: null, role: "admin" },
            created_at: "2026-10-21T09:15:00.000Z",
            finished_at: null,
          },
          { status: "sent" },
        ],
        meta: { page: 2, limit: 10, total: 11, totalPages: 2 },
      },
    });
    expect(list).toMatchObject({ page: 2, limit: 10, total: 11, totalPages: 2 });
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({
      dispatch_id: "a1",
      status: "partial",
      dispatched: 148,
      skipped_by_preference: 2,
      audience: null,
      created_by: { id: "7", name: null, role: "admin" },
      channel_status: { telegram: { queued: 131, skipped: 17 } },
    });
    expect(list.items[0]).not.toHaveProperty("message");
  });

  it("NS-3: keeps a single recipient's id, name and role; drops a recipient without id", () => {
    const list = normalizeSentList({
      data: {
        items: [
          {
            dispatch_id: "p1",
            status: "sent",
            audience: { recipient_ids: 1, recipient: { id: 41, name: "Aziz Karimov", role: "courier" } },
          },
          { dispatch_id: "p2", status: "sent", audience: { recipient_ids: 1, recipient: { name: "Ismsiz id" } } },
          { dispatch_id: "p3", status: "sent", audience: { roles: ["market"], recipient: "x" } },
        ],
      },
    });
    expect(list.items[0].audience).toEqual({
      recipient_ids: 1,
      recipient: { id: "41", name: "Aziz Karimov", role: "courier" },
    });
    expect(list.items[1].audience).toEqual({ recipient_ids: 1 });
    expect(list.items[2].audience).toEqual({ roles: ["market"] });
  });

  it("is defensive about an empty or odd payload", () => {
    expect(normalizeSentList({ data: { items: "x" } }, { page: 3, limit: 10 })).toEqual({
      items: [],
      page: 3,
      limit: 10,
      total: 0,
      totalPages: 1,
    });
    expect(normalizeSentList({ data: { items: [{ dispatch_id: "z", status: "weird" }] } }).items[0].status).toBe("running");
  });

  it("getSentList sends only the filters that are set", async () => {
    const spy = vi.spyOn(api, "get").mockResolvedValue({ data: { data: { items: [], meta: { total: 0 } } } } as never);
    await getSentList({ page: 1, limit: 10 });
    expect(spy).toHaveBeenLastCalledWith("notifications/sent", { params: { page: 1, limit: 10 } });
    await getSentList({ page: 2, limit: 10, status: "failed", created_by: "7" });
    expect(spy).toHaveBeenLastCalledWith("notifications/sent", {
      params: { page: 2, limit: 10, status: "failed", created_by: "7" },
    });
    spy.mockRestore();
  });
});
