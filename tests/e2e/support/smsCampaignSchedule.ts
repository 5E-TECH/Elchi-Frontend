import type { Page, Route } from "@playwright/test";

/**
 * KM-6 (2aS7PFX0) — SMS kampaniyani rejalashtirish uchun qo'shimcha soxta backend (`mockSmsCampaignApi` ustidan,
 * sahifa darajasida — kontekst marshrutidan oldin tekshiriladi): `scheduled_at` li preview (tungi taqiq siljishi
 * bilan), `POST …/campaigns` (FAQAT soxta — `status: 'scheduled'`, hech narsa yuborilmaydi), tarix va
 * `POST …/campaigns/:id/cancel` (`cancelStatus` — 200 yoki 409).
 */
const ORIGIN = "http://127.0.0.1:4194";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

/** 12:00 Toshkent vaqti (2026-10-21) — taqiqdan tashqarida. */
export const NOON_TASHKENT = new Date("2026-10-21T07:00:00Z");

/** Tashkent devor soati → `…+05:00` (backend `scheduled_for_tashkent` shakli). */
const QUIET = { start: 18 * 60, end: 9 * 60 };
const shiftedFor = (scheduledAt: string) => {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(scheduledAt);
  if (!match) return { at: scheduledAt, shifted: false };
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  if (minutes >= QUIET.start) {
    const next = new Date(Date.parse(`${match[1]}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    return { at: `${next}T09:00:00+05:00`, shifted: true };
  }
  if (minutes < QUIET.end) return { at: `${match[1]}T09:00:00+05:00`, shifted: true };
  return { at: scheduledAt, shifted: false };
};

export type SmsScheduleMock = {
  created: Array<{ body: Record<string, unknown>; idempotencyKey: string | undefined }>;
  cancelled: string[];
  /** Bekor qilish javobi: 200 — `cancelled`; 409 — «faqat rejalashtirilgan». */
  cancelStatus: 200 | 409;
  history: Array<Record<string, unknown>>;
};

export const mockSmsScheduleApi = async (page: Page): Promise<SmsScheduleMock> => {
  const mock: SmsScheduleMock = { created: [], cancelled: [], cancelStatus: 200, history: [] };
  await page.route(/notifications\/sms\/campaigns/, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = new URL(request.url()).pathname.replace(/^\//, "");

    if (path === "notifications/sms/campaigns/preview" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      const scheduledAt = typeof body.scheduled_at === "string" ? body.scheduled_at : null;
      if (!scheduledAt) return route.fallback();
      const { at, shifted } = shiftedFor(scheduledAt);
      return reply(route, {
        statusCode: 200,
        data: {
          message_class: "promo",
          text: body.text,
          sample_text: `${String(body.text)}\nRad etish: https://api.elchipochta.uz/sms/stop/x`,
          encoding: "GSM-7",
          parts: 1,
          total: 3,
          recipients: 2,
          blocked_no_consent: 0,
          skipped_invalid_phone: 1,
          max_fanout: 5000,
          fanout_exceeded: false,
          tariff: 175,
          estimated_cost: 350,
          scheduled_for: at,
          scheduled_for_tashkent: at,
          requested_at: scheduledAt,
          quiet_hours_shifted: shifted,
          sms_enabled: true,
        },
      });
    }

    if (path === "notifications/sms/campaigns" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      mock.created.push({ body, idempotencyKey: request.headers()["idempotency-key"] });
      const scheduledAt = String(body.scheduled_at ?? "");
      const { at, shifted } = shiftedFor(scheduledAt);
      const id = String(40 + mock.created.length);
      mock.history.unshift({
        id,
        created_at: new Date().toISOString(),
        message_class: "promo",
        text: body.text,
        total: 3,
        queued: 0,
        blocked: 0,
        skipped: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        pending: 0,
        estimated_cost: "350",
        status: "scheduled",
        scheduled_at: at,
        scheduled_for: at,
        scheduled_for_tashkent: at,
        requested_at: scheduledAt,
        quiet_hours_shifted: shifted,
        can_cancel: true,
      });
      return reply(route, {
        statusCode: 201,
        data: {
          campaign_id: id,
          status: "scheduled",
          queued: 0,
          recipients: 2,
          blocked_no_consent: 0,
          skipped_invalid_phone: 1,
          estimated_cost: 350,
          scheduled_for: at,
          scheduled_for_tashkent: at,
          requested_at: scheduledAt,
          quiet_hours_shifted: shifted,
        },
      });
    }

    const cancel = /^notifications\/sms\/campaigns\/([^/]+)\/cancel$/.exec(path);
    if (cancel && request.method() === "POST") {
      mock.cancelled.push(cancel[1]);
      const row = mock.history.find((item) => item.id === cancel[1]);
      if (mock.cancelStatus === 409) {
        if (row) Object.assign(row, { status: "queued", can_cancel: false });
        return reply(route, { statusCode: 409, message: "Kampaniya bekor qilinmaydi (holati: queued)" }, 409);
      }
      if (row) Object.assign(row, { status: "cancelled", can_cancel: false, cancelled_at: new Date().toISOString() });
      return reply(route, { statusCode: 200, data: row ?? {} });
    }

    if (path === "notifications/sms/campaigns" && request.method() === "GET") {
      return reply(route, { statusCode: 200, data: mock.history });
    }
    return route.fallback();
  });
  return mock;
};
