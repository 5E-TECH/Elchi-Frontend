import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * SERVICE WORKER YANGILANISHI (QgqO0CdZ, TC8) — PROD BUILD, haqiqiy SW.
 *
 * "Yangi deploy" — `dist/sw.js` baytlari o'zgaradi (SW_VERSION boshqa). Sahifa
 * BIR marta yangilanganda yangi versiya faol bo'lishi kerak: `skipWaiting` +
 * `clients.claim` bo'lmasa foydalanuvchi eski SW'da qotib qolardi.
 *
 * Faol SW versiyasi uning o'zidan o'qiladi: push hodisasida SW ochiq tablarga
 * `{ type: "elchi:push", version: SW_VERSION }` yuboradi.
 */

const ORIGIN = "http://127.0.0.1:4175";
const SW_FILE = resolve("dist/sw.js");

const swVersion = (source: string) => /^const SW_VERSION = "([^"]+)";/.exec(source)?.[1] ?? null;

/** CDP orqali haqiqiy `push` hodisasi (DevTools'dagi "Push" tugmasi bilan bir xil). */
const pushChannel = async (page: Page) => {
  const session = await page.context().newCDPSession(page);
  const registrations = new Map<string, string>();
  session.on("ServiceWorker.workerRegistrationUpdated", (event) => {
    for (const registration of event.registrations) {
      if (!registration.isDeleted) registrations.set(registration.scopeURL, registration.registrationId);
    }
  });
  await session.send("ServiceWorker.enable");
  await expect.poll(() => registrations.get(`${ORIGIN}/`) ?? null).not.toBeNull();
  return () =>
    session.send("ServiceWorker.deliverPushMessage", {
      origin: ORIGIN,
      registrationId: registrations.get(`${ORIGIN}/`)!,
      data: JSON.stringify({ title: "SW versiya tekshiruvi" }),
    });
};

/** Faol SW versiyasi: push yuboriladi va SW tabga yuborgan `version` o'qiladi. */
const activeVersion = async (page: Page, deliver: () => Promise<unknown>) => {
  await page.evaluate(() => {
    (window as unknown as { __swVersions: string[] }).__swVersions = [];
  });
  await deliver();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __swVersions: string[] }).__swVersions.length))
    .toBeGreaterThan(0);
  return page.evaluate(() => (window as unknown as { __swVersions: string[] }).__swVersions.at(-1));
};

test.describe("Service Worker — yangi deploy (TC8)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("⭐ sw.js o'zgargach sahifa BIR marta yangilanishda yangi SW_VERSION faol bo'ladi", async ({ page, context }) => {
    const original = readFileSync(SW_FILE, "utf8");
    const oldVersion = swVersion(original);
    expect(oldVersion, "dist/sw.js 1-qatorida SW_VERSION").not.toBeNull();
    // Uzunligi bir xil yangi versiya (preview server fayl o'lchamini keshlaydi).
    const newVersion = `${oldVersion!.slice(0, -1)}${oldVersion!.endsWith("9") ? "8" : "9"}`;

    // Backend kerak emas: login sahifasi, API so'rovlari serverga ketmaydi.
    await context.route(/api\.elchipochta\.uz|:3004\//, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: '{"statusCode":200,"data":[]}' }),
    );
    await context.grantPermissions(["notifications"], { origin: ORIGIN });
    await context.addInitScript(() => {
      const w = window as unknown as { __swVersions: string[] };
      w.__swVersions = [];
      navigator.serviceWorker?.addEventListener("message", (event) => {
        if (event.data?.type === "elchi:push") w.__swVersions.push(event.data.version);
      });
    });

    try {
      await page.goto("/login");
      await expect
        .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 30_000 })
        .toBe(true);
      const deliver = await pushChannel(page);
      expect(await activeVersion(page, deliver)).toBe(oldVersion);

      // "Deploy": serverdagi sw.js baytlari o'zgardi.
      writeFileSync(SW_FILE, original.replace(`"${oldVersion}"`, `"${newVersion}"`));

      // Faqat BIR marta yangilanadi — ikkinchi reload, "yopib-ochish" yo'q.
      await page.reload();
      await expect
        .poll(
          async () => {
            const version = await activeVersion(page, deliver).catch(() => null);
            return version;
          },
          { timeout: 30_000, intervals: [500, 1000, 2000] },
        )
        .toBe(newVersion);

      // Ro'yxatda hamon BITTA SW (scope "/") va u sahifani boshqaradi.
      const state = await page.evaluate(async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        return {
          count: registrations.length,
          scope: registrations[0]?.scope,
          waiting: Boolean(registrations[0]?.waiting),
          controlled: Boolean(navigator.serviceWorker.controller),
        };
      });
      expect(state).toEqual({ count: 1, scope: `${ORIGIN}/`, waiting: false, controlled: true });
    } finally {
      writeFileSync(SW_FILE, original);
    }
  });
});
