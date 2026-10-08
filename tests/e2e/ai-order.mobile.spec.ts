import { expect, test, type Page, type Route } from "@playwright/test";
import { aiDistrictsByRegion, aiPreview, aiProducts, aiRegions } from "../../src/test/aiOrderFixtures";

/**
 * AI BUYURTMA — 390px TELEFON (JzQIec06).
 *
 * ⚠️ Hech qanday so'rov serverga KETMAYDI: dev server .env dagi API manziliga
 * murojaat qiladi, lekin kontekst darajasidagi `route` localhost'dan
 * tashqaridagi HAMMA so'rovni shu yerda soxta javob bilan yopadi. Test
 * oxirida `leaked` bo'sh bo'lishi shart.
 */

const ORIGIN = "http://127.0.0.1:4173";

/** 12 ta buyurtma: 3 tasi to'ldirilmagan (tuman / narx / mahsulot yo'q). */
const parsedOrders = Array.from({ length: 12 }, (_, i) =>
  aiPreview({
    customer_name: `Mijoz ${i + 1} Abdurahmonov Abdulazizxon`,
    phone_number: `+99890${String(1000000 + i).slice(-7)}`,
    total_price: 150000 + i * 1000,
    address: "Chilonzor 19-kvartal, 45-uy, 12-xonadon — mo'ljal: katta supermarket yonida",
    ...(i === 2 ? { district_id: null, district_name: null } : {}),
    ...(i === 6 ? { total_price: null } : {}),
    ...(i === 10
      ? { items: [{ name: "noma'lum mahsulot", quantity: 2, product_id: null, resolved_name: null, candidates: [] }] }
      : {}),
  }),
);

const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};

const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

const mockApi = async (page: Page) => {
  const leaked: string[] = [];
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    // Shriftlar va boshqa tashqi resurslar — yuklanmaydi, lekin API ham emas.
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });

    const path = url.pathname.replace(/^\//, "");
    const now = Date.now();
    if (path === "auth/login" || path === "auth/refresh") {
      return reply(route, {
        accessToken: "e2e.local.token",
        accessTokenExpiresAt: now + 3_600_000,
        refreshTokenExpiresAt: now + 86_400_000,
      });
    }
    if (path === "auth/my-profile") {
      return reply(route, wrap({ id: "7", role: "market", name: "E2E market", status: "active" }));
    }
    if (path === "orders/ai-availability") return reply(route, wrap({ enabled: true, state: "enabled" }));
    if (path === "orders/ai-parse") return reply(route, wrap({ ok: true, orders: parsedOrders }));
    if (path === "region") return reply(route, wrap(aiRegions));
    const region = path.match(/^region\/(\d+)$/);
    if (region) return reply(route, { districts: aiDistrictsByRegion[region[1]] ?? [] });
    if (path.startsWith("product/")) return reply(route, wrap(aiProducts));
    if (request.method() !== "GET") {
      // Yozuvchi so'rov kutilmagan — qayd qilinadi va rad etiladi.
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, wrap([]));
  });
  return leaked;
};

const openAiMode = async (page: Page) => {
  await page.goto("/login");
  await page.locator('input[name="elchi-login-phone"]').fill("900000001");
  await page.locator('input[name="password"]').fill("0990");
  await page.getByRole("button", { name: "Tizimga kirish" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));

  await page.goto("/new-orders/create");
  const tabs = page.getByTestId("create-mode-tabs");
  await tabs.getByRole("button", { name: "Qo'lda" }).click();
  await tabs.getByRole("tab", { name: "AI bilan" }).click();

  await page.getByLabel("Buyurtma matni").fill("12 ta buyurtma matni");
  await page.getByRole("button", { name: "Tahlil qilish" }).click();
  await expect(page.getByTestId("ai-preview-card")).toHaveCount(12);
};

/** Haqiqiy skroll konteyneri — `<main>`: ildiz div'da overflow:hidden, document doim teng. */
const mainOverflow = (page: Page) =>
  page.locator("main.el-surface-page").evaluate((main) => ({
    scrollWidth: main.scrollWidth,
    clientWidth: main.clientWidth,
  }));

test.describe("AI buyurtma — 390px", () => {
  test("gorizontal skroll yo'q, kartalar yig'ilgan, to'ldirilmaganlari ochiq", async ({ page }) => {
    const leaked = await mockApi(page);
    await openAiMode(page);

    const { scrollWidth, clientWidth } = await mainOverflow(page);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    const cards = page.getByTestId("ai-preview-card");
    for (let i = 0; i < 12; i += 1) {
      const card = cards.nth(i);
      const ready = (await card.getAttribute("data-ready")) === "true";
      await expect(card.getByTestId("ai-card-body"), `#${i + 1}`).toBeVisible({ visible: !ready });
    }
    // Uzun ism qisqaradi, lekin tuman va narx xulosada TO'LIQ ko'rinadi.
    const summary = cards.first().getByTestId("ai-card-toggle");
    await expect(summary).toContainText("Mijoz 1");
    const price = summary.getByText("150 000 so'm", { exact: true });
    await expect(price).toBeVisible();
    const [priceBox, summaryBox] = [await price.boundingBox(), await summary.boundingBox()];
    expect(priceBox!.x + priceBox!.width).toBeLessThanOrEqual(summaryBox!.x + summaryBox!.width);
    await expect(summary.getByText("Chilonzor", { exact: true })).toBeVisible();

    // Asosiy tugma matni kesilmaydi ("Tayyo..." emas).
    const createLabel = page.getByTestId("ai-confirm-bar").getByText("Tayyorlarini yaratish (9)");
    expect(await createLabel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);

    // Tayyor kartani ochish — kenglik baribir oshmaydi.
    await cards.first().getByTestId("ai-card-toggle").click();
    await expect(cards.first().getByTestId("ai-card-body")).toBeVisible();
    const afterOpen = await mainOverflow(page);
    expect(afterOpen.scrollWidth).toBeLessThanOrEqual(afterOpen.clientWidth);

    expect(leaked).toEqual([]);
  });

  test("12px dan kichik matn yo'q, tugmalar kamida 44px", async ({ page }) => {
    const leaked = await mockApi(page);
    await openAiMode(page);
    await page.getByTestId("ai-preview-card").first().getByTestId("ai-card-toggle").click();

    const panel = page.getByTestId("ai-mode-panel");
    const tinyText = await panel.evaluate((root) =>
      Array.from(root.querySelectorAll<HTMLElement>("*"))
        .filter((el) => el.offsetParent !== null)
        .filter((el) => Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent?.trim()))
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12)
        .map((el) => `${el.tagName} ${parseFloat(getComputedStyle(el).fontSize)}px "${el.textContent?.trim().slice(0, 30)}"`),
    );
    expect(tinyText).toEqual([]);

    const smallTargets = await panel.evaluate((root) =>
      Array.from(root.querySelectorAll<HTMLElement>("button, input:not([type=checkbox]):not([type=file]), textarea"))
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({ el, box: el.getBoundingClientRect() }))
        .filter(({ box }) => box.height < 44 || box.width < 44)
        .map(({ el, box }) => `${el.tagName} ${Math.round(box.width)}x${Math.round(box.height)} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}"`),
    );
    expect(smallTargets).toEqual([]);

    expect(leaked).toEqual([]);
  });

  test("\"To'ldirilmagan (N)\" keyingi to'ldirilmagan kartani yopishgan panel USTIDA ko'rsatadi", async ({ page }) => {
    const leaked = await mockApi(page);
    await openAiMode(page);

    const bar = page.getByTestId("ai-confirm-bar");
    const jump = bar.getByRole("button", { name: "To'ldirilmagan (3)" });
    await expect(jump).toBeVisible();

    const unready = page.locator('[data-testid="ai-preview-card"][data-ready="false"]');
    for (const index of [0, 1, 2]) {
      await jump.click();
      const card = unready.nth(index);
      await expect
        .poll(async () => {
          const cardBox = await card.boundingBox();
          const barBox = await bar.boundingBox();
          if (!cardBox || !barBox) return false;
          // Kartaning tepasi ko'rinadi va yopishgan panel ostida qolmaydi.
          return cardBox.y >= 0 && cardBox.y < barBox.y;
        })
        .toBe(true);
    }

    expect(leaked).toEqual([]);
  });
});
