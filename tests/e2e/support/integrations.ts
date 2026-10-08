import { expect, type Page, type Route } from "@playwright/test";

/**
 * Integratsiyalar konsoli (Umumiy holat) e2e testlari uchun soxta backend.
 *
 * ⚠️ Hech qanday so'rov serverga KETMAYDI: localhost'dan tashqaridagi HAMMA
 * so'rov shu yerda yopiladi. Kutilmagan yozuvchi so'rov `leaked` ga tushadi.
 */

const ORIGIN = "http://127.0.0.1:4173";

const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};

const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

const ELCHI = {
  id: 7,
  name: "Elchi",
  slug: "elchi",
  type: "api",
  role: "carrier",
  category: "cargo",
  is_active: true,
  base_url: "https://api.elchi.uz",
  auth_type: "api_key",
  last_sync_at: "2026-10-07T10:00:00.000Z",
};

/** Kengaytirilgan metrika — uzun summalar bilan (telefonda kesilmasligi tekshiriladi). */
const EXTENDED = {
  uid: "integration:7",
  kind: "integration",
  id: "7",
  events: 1240,
  delivered: 1201,
  failed: 39,
  queued: 4,
  success_rate: 96.9,
  avg_ms: 184,
  last_event_at: "2026-10-07T10:00:00.000Z",
  shipments: { total: 12450, delivered: 11980, failed: 312, mismatch: 158 },
  webhooks: { success: 98765, failed: 1234, invalid_signature: 56 },
  cod: { dispatched: "1234567890.00", collected: "987654321.00", remitted: "876543210.00", debt: "1" },
};

/**
 * @param extended `false` — ESKI backend: metrikada yangi bloklar YO'Q va
 * bu ulanish uchun qator ham yo'q (24 soatda hodisa bo'lmagan).
 */
export const mockIntegrationsApi = async (page: Page, { extended = true } = {}) => {
  const leaked: string[] = [];
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });

    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, wrap({ id: "1", role: "superadmin", name: "E2E superadmin", status: "active" }));
    }
    if (path === "admin/partners") return reply(route, wrap([]));
    if (path === "integrations") {
      return reply(route, wrap({ items: [ELCHI], meta: { total: 1, page: 1, limit: 100, totalPages: 1 } }));
    }
    if (path === "integrations/metrics") {
      return reply(
        route,
        wrap({
          window_hours: 24,
          totals: { events: 1240, failed: 39, queued: 4 },
          connections: extended ? [EXTENDED] : [],
        }),
      );
    }
    if (path === "integrations/7/receivable-balance") {
      return reply(route, wrap({ integration_id: "7", outstanding_amount: "111111111.00", outstanding_count: 42 }));
    }
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, wrap([]));
  });
  return { leaked };
};

/** Superadmin sessiyasi oldindan yoziladi — login formasi bu testning mavzusi emas. */
export const openElchiOverview = async (page: Page) => {
  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
  await page.goto("/integrations/connections?scope=external&c=integration:7&t=overview");
  // Sovuq dev serverda sahifa chunk'lari birinchi marta kompilyatsiya qilinadi.
  await expect(page.getByTestId("ovw-cod")).toBeVisible({ timeout: 60_000 });
};

/** Haqiqiy skroll konteyneri — `<main>`: ijobiy son = gorizontal skroll bor. */
export const mainHorizontalOverflow = (page: Page) =>
  page.locator("main.el-surface-page").evaluate((main) => main.scrollWidth - main.clientWidth);

/**
 * Plitkalardagi kesilgan raqamlar — qiymat o'z qutisidan yoki kartadan
 * chiqib ketgan YOKI ikki qatorga bo'lingan holatlar ro'yxati (bo'sh =
 * hammasi bitta qatorda, to'liq ko'rinadi).
 */
export const clippedTiles = (page: Page) =>
  page.evaluate(() => {
    const problems: string[] = [];
    for (const id of ["ovw-shipments", "ovw-webhooks", "ovw-cod"]) {
      const card = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      if (!card) continue;
      const cardBox = card.getBoundingClientRect();
      for (const tile of Array.from(card.querySelectorAll<HTMLElement>("button[aria-label]"))) {
        const value = tile.querySelector<HTMLElement>(".ant-statistic-content");
        if (!value) continue;
        const box = value.getBoundingClientRect();
        const style = getComputedStyle(value);
        const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5;
        if (value.scrollWidth > value.clientWidth + 1 || box.right > cardBox.right + 1 || box.left < cardBox.left - 1) {
          problems.push(`${id}: "${value.textContent}" ${Math.round(box.width)}px (scroll ${value.scrollWidth})`);
        } else if (box.height > line * 1.5) {
          // Raqam ikki qatorga bo'lingan ("1 234 567 890" / "so'm") — o'qish qiyin.
          problems.push(`${id}: "${value.textContent}" ${Math.round(box.height)}px — bir qatorga sig'madi`);
        }
      }
    }
    return problems;
  });
