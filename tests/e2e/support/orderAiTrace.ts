import type { Page, Route } from "@playwright/test";
import { ORDER_95 } from "./orderDetail";

/**
 * «AI izi» (vncdmXOy) — soxta backend: AI bilan yaratilgan buyurtma, uning izi va bog'liq ma'lumotnomalar.
 * `mockOrderDetailApi` (kontekst darajasi) ustidan — sahifa darajasidagi `route` ustun.
 */
export const AI_ORDER = {
  ...ORDER_95,
  id: "95",
  status: "received",
  total_price: 185000,
  to_be_paid: 185000,
  paid_amount: 0,
  comment: "Kechqurun 18:00 dan keyin olib keling.",
  address: "Lutfiy ko'chasi, 14-uy, 32-xonadon",
  operator: "Kamola",
  customer: { id: "c1", name: "Dilnoza Karimova", phone_number: "+998901234567" },
  market: { id: "m7", name: "Baraka Shop", phone_number: "+998992222222" },
  district: { id: "101", name: "Chilonzor tumani", region: { id: "11", name: "Toshkent sh." } },
  items: [
    { id: "i1", quantity: 1, product: { id: "501", name: "Bolalar kurtkasi, 110 sm" } },
    { id: "i2", quantity: 2, product: { id: "502", name: "Qishki shapka" } },
  ],
};

export const AI_TRACE = {
  order_id: "95",
  draft_id: "d-1",
  item_index: 0,
  confirmed_by: "77",
  confirmed_at: new Date(Date.now() - 2 * 60_000).toISOString(),
  created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  source_text:
    "Assalomu alaykum, 3 ta buyurtma:\n1) Dilnoza Karimova [TEL_1], Lutfiy 14-uy 32-xonadon, mo'ljal Qatortol. Bolalar kurtkasi 110 — 1 ta, qishki shapka 2 ta. Narxi 185 000, dostavka 20 000. Kechqurun 18:00 dan keyin.\n2) Bekzod aka [TEL_2], Mirobod, Taras Shevchenko 21. Simsiz quloqchin 1 ta — 90 000.\n3) Sevara [TEL_3], Yunusobod 4-mavze 12-uy. Quvvatlagich 20 W — 120 000.",
  source_purged: false,
  image_count: 1,
  model: "claude-sonnet-5",
  prompt_version: "2026-10-26.1",
  ai_suggestion: {
    customer_name: "Dilnoza Karimova",
    phone_masked: "+99890*****76",
    extra_masked: null,
    region_id: "11",
    district_id: "103",
    address: "Lutfiy, 14-uy, 32-xonadon",
    total_price: 1850000,
    where_deliver: "address",
    comment: "Kechqurun 18:00 dan keyin olib keling.",
    operator: "Kamola",
    items: [
      { name: "kurtka 110", product_id: "501", quantity: 1 },
      { name: "shapka", product_id: "502", quantity: 1 },
    ],
    district_match: { method: "address", ai_text: "Qatortol", score: 0.6 },
    region_inferred: true,
    check_codes: ["district_low_confidence", "price_check"],
  },
  edited_fields: ["phone_number", "district_id", "address", "total_price", "items"],
};

const cors = {
  "access-control-allow-origin": "http://127.0.0.1:4173",
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: cors,
    body: JSON.stringify({ statusCode: 200, message: "ok", data }),
  });

export const mockAiTraceApi = async (page: Page, trace: Record<string, unknown> = AI_TRACE) => {
  await page.route(/\/orders\/95\/ai-trace$/, (route) => reply(route, trace));
  await page.route(/\/users\/77$/, (route) => reply(route, { id: "77", name: "Nilufar Rashidova", role: "admin" }));
  await page.route(/\/district\/103$/, (route) => reply(route, { id: "103", name: "Uchtepa tumani", region_id: "11" }));
  await page.route(/\/region$/, (route) => reply(route, [{ id: 11, name: "Toshkent sh." }]));
};
