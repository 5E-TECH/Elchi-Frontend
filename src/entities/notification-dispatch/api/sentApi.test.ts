import { normalizeSentDetail } from "./sentApi";

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
