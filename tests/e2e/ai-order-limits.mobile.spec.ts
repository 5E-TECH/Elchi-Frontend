import { expect, test, type Page, type Route } from "@playwright/test";
import { aiDistrictsByRegion, aiPreview, aiProducts, aiRegions } from "../../src/test/aiOrderFixtures";

/**
 * AI BUYURTMA — 20 tagacha rasm (WHMAIqyo) va preview `warnings[]` (J3hEDtFN), 390px. Rasmlar HAQIQIY brauzer canvas'ida
 * tayyorlanadi (PNG → JPEG); so'rovlar soxta backendda — hech narsa serverga ketmaydi. `E2E_ORIGIN` — boshqa port.
 */
const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4194";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

/** 1×1 PNG. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const parsed = [
  aiPreview({
    customer_name: "Aliyev Vali",
    total_price: null,
    warnings: [
      { field: "total_price", reason: "unclear" },
      { field: "address", reason: "conflict" },
      // Noma'lum qiymat — ko'rsatilmaydi.
      { field: "secret", reason: "unclear" },
    ] as never,
  }),
];

const mockApi = async (page: Page) => {
  const leaked: string[] = [];
  const parseBodies: string[] = [];
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") return reply(route, wrap({ id: "7", role: "market", name: "E2E market", status: "active" }));
    if (path === "orders/ai-availability") return reply(route, wrap({ enabled: true, state: "enabled" }));
    if (path === "orders/ai-parse") {
      parseBodies.push(request.postDataBuffer()?.toString("latin1") ?? "");
      return reply(route, wrap({ ok: true, orders: parsed, draft_id: "d-e2e" }));
    }
    if (path === "region") return reply(route, wrap(aiRegions));
    const region = path.match(/^region\/(\d+)$/);
    if (region) return reply(route, { districts: aiDistrictsByRegion[region[1]] ?? [] });
    if (path.startsWith("product/")) return reply(route, wrap(aiProducts));
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, wrap([]));
  });
  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
  return { leaked, parseBodies };
};

const pageFits = (page: Page) =>
  page.locator("main:has([data-shell-slot=content])").evaluate((main) => main.scrollWidth <= main.clientWidth);

test.describe.configure({ timeout: 150_000 });

test("⭐ 21 rasm → «Ko'pi bilan 20 ta rasm yuborish mumkin», 20 tasi yuboriladi (JPEG); preview'da maydon ogohlantirishi", async ({
  page,
}) => {
  const { leaked, parseBodies } = await mockApi(page);
  await page.goto("/new-orders/create");
  await page.getByTestId("create-mode-tabs").getByRole("radio", { name: "AI bilan" }).click({ timeout: 90_000 });

  await page.getByTestId("ai-image-input").setInputFiles(
    Array.from({ length: 21 }, (_, i) => ({ name: `varaq-${i + 1}.png`, mimeType: "image/png", buffer: PNG })),
  );
  await expect(page.getByText("Ko'pi bilan 20 ta rasm yuborish mumkin. Birinchilari qabul qilindi.")).toBeVisible();
  await expect(page.getByTestId("ai-image-grid").getByRole("listitem")).toHaveCount(20);
  await expect(page.getByText("20/20 surat")).toBeVisible();
  await expect(page.getByRole("button", { name: "Galereyadan" })).toBeDisabled();
  expect(await pageFits(page)).toBe(true);

  await page.getByRole("button", { name: "Tahlil qilish" }).click();
  const card = page.getByTestId("ai-preview-card");
  await expect(card).toHaveCount(1);
  expect(parseBodies).toHaveLength(1);
  expect(parseBodies[0].match(/name="images"/g)).toHaveLength(20);
  expect(parseBodies[0]).toContain("Content-Type: image/jpeg");

  // Faqat enum: narx — «o'qiy olmadi», manzil — «zid qiymatlar»; noma'lum maydon yo'q.
  const warnings = card.getByTestId("ai-field-warning");
  await expect(warnings).toHaveCount(2);
  await expect(card.locator('[data-testid=ai-field-warning][data-field="total_price"]')).toHaveText(
    "AI aniq o'qiy olmadi — tekshiring",
  );
  await expect(card.locator('[data-testid=ai-field-warning][data-field="address"]')).toHaveText(
    "Matnda bir-biriga zid qiymatlar bor — tekshiring",
  );
  expect(await pageFits(page)).toBe(true);
  expect(leaked).toEqual([]);
});
