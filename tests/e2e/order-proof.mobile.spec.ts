import { expect, test, type Route } from "@playwright/test";

/**
 * BUYURTMA DALILLARI — detal sahifasi, 390px.
 *
 * Imzolangan URL `GET files/:key` dan olinadi va rasm HAQIQATAN yuklanadi
 * (naturalWidth > 0); lightbox ekranga sig'adi; ochiq `files/view` CHAQIRILMAYDI.
 * Hech qanday so'rov serverga ketmaydi.
 */

const ORIGIN = "http://127.0.0.1:4173";
const CDN = "https://cdn.e2e.test";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

/** 8×8 qizil PNG — haqiqiy rasm, brauzer uni dekodlaydi. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC",
  "base64",
);

const KEYS = [
  "proof-1784557173685-10818f3a-6482-4bb3-b092-f85b18057d9b-Screenshot.png",
  "proof-1784557173686-20818f3a-6482-4bb3-b092-f85b18057d9b-ikkinchi.jpg",
];

/** Real #95 dagi kalit (karta dalilidan, so'zma-so'z). */
const ORDER_95_KEY = "proof-1784557173685-10818f3a-6482-4bb3-b092-f85b18057d9b-Screenshot_from_2025-12-05_22-03-56.png";

const mockApi = async (page: import("@playwright/test").Page, keys: string[]) => {
    const leaked: string[] = [];
    const fileCalls: string[] = [];
    await page.context().route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === ORIGIN) return route.continue();
      if (url.origin === CDN) return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
      if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });

      const path = decodeURIComponent(url.pathname.replace(/^\//, ""));
      if (path === "auth/my-profile") {
        return reply(route, wrap({ id: "1", role: "admin", name: "E2E admin", status: "active" }));
      }
      if (path === "orders/95") {
        return reply(
          route,
          wrap({
            id: "95",
            status: "sold",
            where_deliver: "center",
            total_price: 150000,
            to_be_paid: 0,
            paid_amount: 150000,
            comment: null,
            address: null,
            customer: { id: "c1", name: "Aliyev Vali", phone_number: "+998901234567" },
            market: { id: "m1", name: "Zamon Market", expense_proof_conditions: ["sell_any"] },
            items: [],
            proof_files: keys,
          }),
        );
      }
      if (path.startsWith("files/")) {
        fileCalls.push(path);
        const key = path.replace(/^files\//, "");
        return reply(route, wrap({ url: `${CDN}/${key}?X-Amz-Signature=e2e`, expires_in: 3600 }));
      }
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
    return { leaked, fileCalls };
};

test.describe("Buyurtma dalillari — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("#95: bitta rasm ko'rinadi va bosilganda KATTALASHADI", async ({ page }) => {
    const { leaked, fileCalls } = await mockApi(page, [ORDER_95_KEY]);
    await page.goto("/orders/edit/95");
    const card = page.getByTestId("order-proof-card");
    await expect(card).toBeVisible({ timeout: 60_000 });

    const thumb = card.locator('[data-testid="proof-gallery"] img');
    await expect(thumb).toHaveCount(1);
    await expect.poll(() => thumb.evaluate((el) => (el as HTMLImageElement).naturalWidth > 0)).toBe(true);
    const small = (await thumb.boundingBox())!;

    await card.locator("button[aria-label^='Dalilni ochish']").click();
    const big = page.getByTestId("proof-lightbox").locator("img");
    await expect(big).toBeVisible();
    const large = (await big.boundingBox())!;
    expect(large.width).toBeGreaterThan(small.width);
    expect(large.x + large.width).toBeLessThanOrEqual(390);
    expect(fileCalls).toEqual([`files/${ORDER_95_KEY}`]);
    expect(leaked).toEqual([]);
  });

  test("Dalillar kartasi, haqiqiy rasm, lightbox ekranga sig'adi; files/view chaqirilmaydi", async ({ page }) => {
    const { leaked, fileCalls } = await mockApi(page, KEYS);
    await page.goto("/orders/edit/95");
    const card = page.getByTestId("order-proof-card");
    await expect(card).toBeVisible({ timeout: 60_000 });
    await expect(card).toContainText("Dalillar");

    // Ikkala rasm HAQIQATAN yuklangan (buzilgan rasm belgisi emas).
    const images = card.locator('[data-testid="proof-gallery"] img');
    await expect(images).toHaveCount(2);
    await expect
      .poll(() => images.evaluateAll((els) => els.map((el) => (el as HTMLImageElement).naturalWidth > 0)))
      .toEqual([true, true]);
    expect(fileCalls.sort()).toEqual(KEYS.map((key) => `files/${key}`).sort());
    expect(fileCalls.some((call) => call.includes("files/view"))).toBe(false);

    // Lightbox: rasm ekranga sig'adi, "1 / 2", keyingisiga o'tadi.
    await card.locator("button[aria-label^='Dalilni ochish']").first().click();
    const lightbox = page.getByTestId("proof-lightbox");
    await expect(lightbox.locator("img")).toBeVisible();
    const box = (await lightbox.locator("img").boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    await expect(page.getByText("1 / 2")).toBeVisible();
    await lightbox.locator('button[aria-label="Keyingi"]').click();
    await expect(page.getByText("2 / 2")).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });
});
