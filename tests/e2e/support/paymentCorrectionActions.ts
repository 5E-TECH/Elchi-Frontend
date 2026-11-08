import type { Page } from "@playwright/test";
import { OVERVIEW_PAGE_DATA } from "./paymentCorrection";

/**
 * T6-FE-2 (N2) e2e soxta ma'lumotlari: superadmin `/payments` tarixida tuzatiladigan to'lovlar (`correctable`, backend
 * #623 `correctable.transfer`) va `POST finance/history/:id/reverse | correct-amount` javoblari (ketma-ket ssenariy).
 * Yozuvlar `setupShellSession` dan KEYIN ro'yxatdan o'tadi — faqat shu ikki POST ushlanadi, qolgani (GET, OPTIONS)
 * `route.fallback()` bilan sessiya ishlovchisiga o'tadi (boshqa yozish so'rovi baribir `leaked`).
 */

const now = Date.now();
const minutesAgo = (minutes: number) => {
  const midnight = new Date(now).setHours(0, 0, 0, 0);
  return new Date(Math.max(now - minutes * 60_000, midnight + (600 - minutes) * 1000)).toISOString();
};
const daysFromNow = (days: number) => new Date(now + days * 86_400_000).toISOString();

const MAIN = { id: "1", balance: 24_615_000, cashbox_type: "main" };
const COURIER = { id: "263", name: "Jasur Tursunov", phone_number: "+998904121855", role: "courier" };
const MARKET = { id: "101", name: "Baraka Shop", phone_number: "+998903001122", role: "market" };
const MAIN_RECEIVER = { cashbox_type: "main", branch_id: null, name: null };

const leg = (row: Record<string, unknown>) => ({ cashbox_id: "1", cashbox_type: "main", cashbox: MAIN, correction: null, ...row });

const courierPayment = () =>
  leg({
    id: "4512",
    amount: 1_850_000,
    operation_type: "income",
    source_type: "courier_payment",
    payment_method: "cash",
    comment: "Kunlik topshiriq",
    source_user: COURIER,
    payment_date: minutesAgo(30),
    createdAt: minutesAgo(30),
  });

const marketPayment = () =>
  leg({
    id: "4498",
    amount: 2_400_000,
    operation_type: "expense",
    source_type: "market_payment",
    payment_method: "click",
    comment: "Oktabr, 1-hafta hisobi",
    source_user: MARKET,
    payment_date: minutesAgo(90),
    createdAt: minutesAgo(90),
  });

const lockedPayment = () =>
  leg({
    id: "3987",
    amount: 1_275_000,
    operation_type: "expense",
    source_type: "market_payment",
    payment_method: "click",
    comment: "Avgust, 4-hafta hisobi",
    source_user: { id: "102", name: "Nur Elektronika", phone_number: "+998712004545", role: "market" },
    payment_date: "2026-09-02T12:30:00.000Z",
    createdAt: "2026-09-02T12:30:00.000Z",
  });

export const CORRECTION_DEADLINE = daysFromNow(30);

/** `GET finance/history/:id` — superadmin tafsiloti `correctable` bilan. */
export const correctionDetails = () => ({
  "finance/history/4512": {
    ...courierPayment(),
    correctable: {
      allowed: true,
      deadline: CORRECTION_DEADLINE,
      window_days: 30,
      root_history_id: "4512",
      transfer: {
        kind: "courier_payment",
        payment_method: "cash",
        amount: 1_850_000,
        receiver: MAIN_RECEIVER,
        courier: { id: COURIER.id, name: COURIER.name },
        market: null,
      },
    },
  },
  "finance/history/4498": {
    ...marketPayment(),
    correctable: {
      allowed: true,
      deadline: CORRECTION_DEADLINE,
      window_days: 30,
      root_history_id: "4498",
      transfer: {
        kind: "market_payment",
        payment_method: "click",
        amount: 2_400_000,
        receiver: MAIN_RECEIVER,
        courier: null,
        market: { id: MARKET.id, name: MARKET.name },
      },
    },
  },
  "finance/history/3987": {
    ...lockedPayment(),
    correctable: {
      allowed: false,
      code: "WINDOW_EXPIRED",
      deadline: "2026-10-02T12:30:00.000Z",
      window_days: 30,
      root_history_id: "3987",
      transfer: null,
    },
  },
});

/** `/payments` sahifasi: KPI, grafik, tarix (uch to'lov) va tafsilotlar. */
export const correctionPageData = () => {
  const items = [courierPayment(), marketPayment(), lockedPayment()];
  return {
    ...OVERVIEW_PAGE_DATA,
    "finance/history": { items, meta: { page: 1, limit: 10, total: items.length, totalPages: 1 } },
    ...correctionDetails(),
  };
};

export type CorrectionReply = { status: number; body?: Record<string, unknown> } | "abort";

const created = (path: string) => ({
  statusCode: 201,
  message: "ok",
  data: {
    correction: { id: "12", action: path.endsWith("/reverse") ? "reverse" : "edit" },
    cashboxes: [],
    idempotent: false,
  },
});

/**
 * Tuzatish POST'lari: har so'rov tana va `Idempotency-Key` bilan yoziladi; javob — `replies` navbatidan (tugasa 201).
 * `"abort"` — javobsiz (tarmoq uzildi).
 */
export const mockCorrectionPosts = async (page: Page, replies: CorrectionReply[] = []) => {
  const posts: Array<{ path: string; body: unknown; key: string | undefined }> = [];
  await page.context().route(/\/finance\/history\/\d+\/(reverse|correct-amount)(\?.*)?$/, async (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.fallback();
    const path = new URL(request.url()).pathname.replace(/^\//, "");
    posts.push({ path, body: request.postDataJSON(), key: (await request.allHeaders())["idempotency-key"] });
    const reply = replies.shift() ?? { status: 201 };
    if (reply === "abort") return route.abort("failed");
    const origin = (await request.headerValue("origin")) ?? "http://127.0.0.1:4173";
    return route.fulfill({
      status: reply.status,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": origin,
        "access-control-allow-credentials": "true",
        "access-control-allow-headers": "*",
      },
      body: JSON.stringify(reply.body ?? created(path)),
    });
  });
  return { posts };
};
