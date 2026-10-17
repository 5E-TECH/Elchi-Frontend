import { expect, test, type BrowserContext, type CDPSession, type Page, type Route } from "@playwright/test";
import { expectToast, waitToastsGone } from "./support/toast";

/**
 * PUSH (davC9QOX) — PROD BUILD ustida, HAQIQIY Service Worker bilan.
 *
 * Soxta: faqat backend (API) va brauzerning push-xizmati (FCM) — `pushManager.subscribe`
 * qurilma endpointini qaytaradi, xolos. `sw.js` haqiqiy: push hodisasi Chrome
 * DevTools protokoli (`ServiceWorker.deliverPushMessage`) bilan yetkaziladi.
 * Hech qanday so'rov prod serverga ketmaydi.
 */

const ORIGIN = "http://127.0.0.1:4175";
const VAPID = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

type Call = { method: string; path: string; body: unknown; auth: string | null; at: number };

/** Server holati: push_subscriptions jadvali (endpoint → qator) va foydalanuvchi sozlamasi. */
const mockBackend = async (context: BrowserContext, { pushEnabled = true } = {}) => {
  const calls: Call[] = [];
  const subscriptions = new Map<string, { user_id: string; platform: string }>();
  let settings: Record<string, unknown> = {};
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    const body = request.postDataJSON?.() ?? null;
    calls.push({ method: request.method(), path, body, auth: request.headers()["authorization"] ?? null, at: Date.now() });

    if (path === "auth/my-profile") {
      return reply(route, wrap({ id: "42", role: "manager", name: "E2E menejer", status: "active", settings }));
    }
    if (path === "auth/my-settings" && request.method() === "PATCH") {
      settings = (body as { settings: Record<string, unknown> }).settings;
      return reply(route, wrap({ settings }));
    }
    if (path === "notifications/push/public-key") {
      return reply(route, wrap(pushEnabled ? { enabled: true, public_key: VAPID } : { enabled: false, public_key: null }));
    }
    if (path === "notifications/push/subscribe" && request.method() === "POST") {
      const sub = body as { endpoint: string; platform: string };
      // Backend: endpoint bo'yicha upsert (push-subscription.service.spec — 1 qator).
      subscriptions.set(sub.endpoint, { user_id: "42", platform: sub.platform });
      return reply(route, wrap({ id: "s1", endpoint: sub.endpoint }), 201);
    }
    if (path === "notifications/push/subscribe" && request.method() === "DELETE") {
      subscriptions.delete((body as { endpoint: string }).endpoint);
      return reply(route, wrap({ deleted: true }));
    }
    if (path === "auth/logout") return reply(route, wrap({ ok: true }));
    if (path === "notifications/inbox/unread-count") return reply(route, wrap({ unread: 0 }));
    if (request.method() !== "GET") return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    return reply(route, wrap([]));
  });
  return { calls, subscriptions };
};

/**
 * Sessiya + brauzer push-xizmati o'rnini bosuvchi (FCM'ga ulanilmaydi). Obuna
 * brauzerdagidek SAQLANADI (qayta yuklashda ham), `subscribe` va ruxsat oynasi sanaladi.
 */
const prepareBrowser = async (
  context: BrowserContext,
  { device = "a", permission }: { device?: string; permission?: "denied" } = {},
) => {
  await context.addInitScript(
    ({ device, permission }) => {
      const far = Date.now() + 86_400_000;
      if (!window.sessionStorage.getItem("__e2e_logged_out")) {
        window.sessionStorage.setItem("accessToken", "e2e.local.token");
        window.sessionStorage.setItem(
          "authSessionMetadata",
          JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
        );
      }
      const KEY = "__e2e_push_endpoint";
      const w = window as unknown as Record<string, unknown>;
      const counters = JSON.parse(window.localStorage.getItem("__e2e_counters") ?? "{}");
      const bump = (name: string) => {
        counters[name] = (counters[name] ?? 0) + 1;
        window.localStorage.setItem("__e2e_counters", JSON.stringify(counters));
      };
      const make = (endpoint: string) => ({
        endpoint,
        expirationTime: null,
        options: { userVisibleOnly: true },
        toJSON: () => ({ endpoint, keys: { p256dh: "BPe2eKey", auth: "authE2E" } }),
        unsubscribe: () => {
          window.localStorage.removeItem(KEY);
          bump("unsubscribe");
          return Promise.resolve(true);
        },
      });
      if (typeof PushManager !== "undefined") {
        PushManager.prototype.getSubscription = function () {
          const endpoint = window.localStorage.getItem(KEY);
          return Promise.resolve(endpoint ? (make(endpoint) as unknown as PushSubscription) : null);
        };
        PushManager.prototype.subscribe = function (options?: PushSubscriptionOptionsInit) {
          bump("subscribe");
          w.__subscribeOptions = {
            userVisibleOnly: options?.userVisibleOnly,
            keyBytes: (options?.applicationServerKey as ArrayBuffer | undefined)?.byteLength ?? 0,
          };
          const endpoint = `https://fcm.googleapis.com/fcm/send/e2e-device-${device}`;
          window.localStorage.setItem(KEY, endpoint);
          return Promise.resolve(make(endpoint) as unknown as PushSubscription);
        };
      }
      if ("Notification" in window) {
        const original = Notification.requestPermission.bind(Notification);
        Notification.requestPermission = () => {
          bump("permissionPrompt");
          if (permission === "denied") {
            window.localStorage.setItem("__e2e_permission", "denied");
            return Promise.resolve("denied");
          }
          return original();
        };
        if (permission === "denied") {
          Object.defineProperty(Notification, "permission", {
            configurable: true,
            get: () => (window.localStorage.getItem("__e2e_permission") as NotificationPermission) ?? "default",
          });
        }
      }
    },
    { device, permission },
  );
};

const counters = (page: Page) =>
  page.evaluate(() => JSON.parse(window.localStorage.getItem("__e2e_counters") ?? "{}") as Record<string, number>);

const waitForServiceWorker = async (page: Page) => {
  await expect
    .poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration("/"))?.active)), {
      timeout: 30_000,
    })
    .toBe(true);
};

/*
 * Muvaffaqiyat xabari (v2 `Toaster`) keyingi bosish nishonini to'smasin: sichqoncha ustida tursa vaqt
 * to'xtaydi — `waitToastsGone` (support/toast.ts) kursorni chetga olib, xabarlar yopilishini kutadi.
 * (Avval antd `.ant-notification-notice` kutilardi — v2 da u yo'q, kutish bo'sh o'tib ketardi.)
 */

const enablePush = async (page: Page, where = "/inbox") => {
  await page.goto(where);
  await waitForServiceWorker(page);
  const button = page.getByRole("button", { name: "Bildirishnomalarni yoqish" });
  await expect(button).toBeVisible({ timeout: 60_000 });
  await button.click();
  await page.getByRole("button", { name: "Yoqish", exact: true }).click();
  await expect(page.getByRole("button", { name: "Bildirishnomalarni o'chirish" })).toBeVisible();
};

/** CDP: SW ro'yxat ID'si → haqiqiy `push` hodisasi. */
const pushChannel = async (page: Page) => {
  const session: CDPSession = await page.context().newCDPSession(page);
  const registrations = new Map<string, string>();
  session.on("ServiceWorker.workerRegistrationUpdated", (event) => {
    for (const registration of event.registrations) {
      if (!registration.isDeleted) registrations.set(registration.scopeURL, registration.registrationId);
    }
  });
  await session.send("ServiceWorker.enable");
  await expect.poll(() => registrations.get(`${ORIGIN}/`) ?? null).not.toBeNull();
  return (payload: Record<string, unknown>) =>
    session.send("ServiceWorker.deliverPushMessage", {
      origin: ORIGIN,
      registrationId: registrations.get(`${ORIGIN}/`)!,
      data: JSON.stringify(payload),
    });
};

const systemNotifications = (page: Page) =>
  page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const list = (await registration?.getNotifications()) ?? [];
    return list.map((notification) => ({ title: notification.title, data: notification.data }));
  });

test.describe("Push — prod build, haqiqiy Service Worker", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("TC1: sahifa ochilganda hech qanday ruxsat oynasi so'ralmaydi", async ({ page, context }) => {
    await mockBackend(context);
    await prepareBrowser(context);
    await page.goto("/");
    await waitForServiceWorker(page);
    await page.goto("/inbox");
    await expect(page.getByRole("button", { name: "Bildirishnomalarni yoqish" })).toBeVisible({ timeout: 60_000 });
    expect((await counters(page)).permissionPrompt ?? 0).toBe(0);
  });

  test("TC2+TC3+TC4: avval bizning oyna → keyin brauzer oynasi → POST subscribe 2xx (platform=desktop)", async ({ page, context }) => {
    const { calls, subscriptions } = await mockBackend(context);
    await prepareBrowser(context);
    await context.grantPermissions(["notifications"], { origin: ORIGIN });
    await page.goto("/inbox");
    await waitForServiceWorker(page);

    await page.getByRole("button", { name: "Bildirishnomalarni yoqish" }).click({ timeout: 60_000 });
    await expect(page.getByText("Bildirishnomalarni yoqasizmi?")).toBeVisible();
    expect((await counters(page)).permissionPrompt ?? 0).toBe(0);

    const subscribeResponse = page.waitForResponse(
      (response) => response.url().endsWith("/notifications/push/subscribe") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Yoqish", exact: true }).click();
    const response = await subscribeResponse;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    expect((await counters(page)).permissionPrompt).toBe(1);
    expect(await page.evaluate(() => (window as unknown as { __subscribeOptions: unknown }).__subscribeOptions)).toEqual({
      userVisibleOnly: true,
      keyBytes: 65,
    });

    const post = calls.find((call) => call.method === "POST" && call.path === "notifications/push/subscribe")!;
    expect(post.auth).toBe("Bearer e2e.local.token");
    expect(post.body).toMatchObject({
      endpoint: "https://fcm.googleapis.com/fcm/send/e2e-device-a",
      keys: { p256dh: "BPe2eKey", auth: "authE2E" },
      platform: "desktop",
      is_standalone: false,
    });
    expect([...subscriptions.values()]).toEqual([{ user_id: "42", platform: "desktop" }]);
    await expect(page.getByRole("button", { name: "Bildirishnomalarni o'chirish" })).toBeVisible();
  });

  for (const [platform, userAgent] of [
    ["android", "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36"],
    ["ios", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"],
  ] as const) {
    test(`TC4: platform '${platform}' to'g'ri yuboriladi`, async ({ browser }) => {
      const context = await browser.newContext({ userAgent, viewport: { width: 390, height: 664 } });
      const page = await context.newPage();
      const { calls } = await mockBackend(context);
      await prepareBrowser(context);
      await context.grantPermissions(["notifications"], { origin: ORIGIN });
      await enablePush(page);
      const post = calls.find((call) => call.method === "POST" && call.path === "notifications/push/subscribe")!;
      expect((post.body as { platform: string }).platform).toBe(platform);
      await context.close();
    });
  }

  test("TC5: rad etilgach — passiv holat, qayta yuklashda oyna QAYTA chiqmaydi", async ({ page, context }) => {
    const { calls } = await mockBackend(context);
    await prepareBrowser(context, { permission: "denied" });
    await page.goto("/inbox");
    await waitForServiceWorker(page);
    await page.getByRole("button", { name: "Bildirishnomalarni yoqish" }).click({ timeout: 60_000 });
    await page.getByRole("button", { name: "Yoqish", exact: true }).click();
    await expect(page.getByText("Bildirishnomalar brauzerda bloklangan", { exact: false })).toBeVisible();
    expect((await counters(page)).permissionPrompt).toBe(1);

    await page.reload();
    await expect(page.getByText("Bildirishnomalar brauzerda bloklangan", { exact: false })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Bildirishnomalarni yoqish" })).toHaveCount(0);
    await expect(page.getByText("Bildirishnomalarni yoqasizmi?")).toHaveCount(0);
    expect((await counters(page)).permissionPrompt).toBe(1);
    expect(calls.filter((call) => call.path === "notifications/push/subscribe")).toEqual([]);
  });

  test("TC6: logout — DELETE subscribe token BEKOR QILINISHIDAN OLDIN (Bearer bilan), qator o'chadi", async ({ page, context }) => {
    const { calls, subscriptions } = await mockBackend(context);
    await prepareBrowser(context);
    await context.grantPermissions(["notifications"], { origin: ORIGIN });
    await enablePush(page);
    expect(subscriptions.size).toBe(1);

    await waitToastsGone(page);
    // Dizayn v2 shell (2-bosqich): «Chiqish» — sarlavhadagi profil menyusining bandi (`UserMenu`).
    await page.getByRole("button", { name: /Profil menyusi$/ }).click();
    await page.getByRole("menu", { name: "Profil menyusi" }).getByRole("menuitem", { name: "Chiqish" }).click();
    await page.waitForURL(/\/login/);
    const del = calls.findIndex((call) => call.method === "DELETE" && call.path === "notifications/push/subscribe");
    const logout = calls.findIndex((call) => call.path === "auth/logout");
    expect(del).toBeGreaterThanOrEqual(0);
    expect(del).toBeLessThan(logout);
    expect(calls[del].auth).toBe("Bearer e2e.local.token");
    expect(calls[del].body).toEqual({ endpoint: "https://fcm.googleapis.com/fcm/send/e2e-device-a" });
    expect(subscriptions.size).toBe(0);
    // Qurilmadagi obuna ham bekor qilindi (login sahifasi to'liq yuklangach o'qiladi).
    await page.waitForLoadState("load");
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem("__e2e_push_endpoint")).catch(() => "navigating"))
      .toBeNull();
  });

  test("TC7: tab ochiq va ko'rinib turibdi — tizim bildirishnomasi YO'Q, faqat ilova ichida (toast)", async ({ page, context }) => {
    await mockBackend(context);
    await prepareBrowser(context);
    await context.grantPermissions(["notifications"], { origin: ORIGIN });
    await enablePush(page);
    const deliver = await pushChannel(page);

    expect(await page.evaluate(() => document.visibilityState)).toBe("visible");
    await deliver({ title: "Yangi buyurtma #501", body: "Toshkent, 150 000 so'm", link: "/orders/edit/501", id: "n1" });
    await expectToast(page, "Yangi buyurtma #501", { tone: "info", timeout: 10_000 });
    // SW push'ni qayta ishlashiga vaqt beriladi — keyin ham tizim bildirishnomasi bo'lmasligi kerak.
    await page.waitForTimeout(1500);
    expect(await systemNotifications(page)).toEqual([]);
  });

  test("TC8: tab yopiq — tizim bildirishnomasi ko'rsatiladi, havolasi to'g'ri sahifa", async ({ page, context }) => {
    await mockBackend(context);
    await prepareBrowser(context);
    await context.grantPermissions(["notifications"], { origin: ORIGIN });
    await enablePush(page);
    const deliver = await pushChannel(page);

    // Ilova tabi yopildi (shu origin'da oyna qolmadi).
    await page.goto("about:blank");
    await deliver({ title: "Yangi buyurtma #777", body: "Andijon", link: "/orders/edit/777", id: "n2" });

    const checker = await context.newPage();
    await checker.goto("/login");
    await expect
      .poll(() => systemNotifications(checker), { timeout: 15_000 })
      .toEqual([{ title: "Yangi buyurtma #777", data: { link: "/orders/edit/777", id: "n2" } }]);
  });

  test("TC9: ikki xil brauzer — 2 ta alohida obuna (har biri o'z endpointi bilan)", async ({ browser }) => {
    const endpoints: string[] = [];
    for (const device of ["chrome", "edge"]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const { calls } = await mockBackend(context);
      await prepareBrowser(context, { device });
      await context.grantPermissions(["notifications"], { origin: ORIGIN });
      await enablePush(page);
      const post = calls.find((call) => call.method === "POST" && call.path === "notifications/push/subscribe")!;
      endpoints.push((post.body as { endpoint: string }).endpoint);
      await context.close();
    }
    expect(endpoints).toEqual([
      "https://fcm.googleapis.com/fcm/send/e2e-device-chrome",
      "https://fcm.googleapis.com/fcm/send/e2e-device-edge",
    ]);
  });

  test("TC10: bir brauzerdan 3 marta — brauzer obunasi BITTA, serverda 1 qator", async ({ page, context }) => {
    const { calls, subscriptions } = await mockBackend(context);
    await prepareBrowser(context);
    await context.grantPermissions(["notifications"], { origin: ORIGIN });
    await enablePush(page);
    for (let round = 0; round < 2; round += 1) {
      await waitToastsGone(page);
      await page.getByRole("button", { name: "Bildirishnomalarni o'chirish" }).click();
      await expect(page.getByRole("button", { name: "Bildirishnomalarni yoqish" })).toBeVisible();
      await waitToastsGone(page);
      await page.getByRole("button", { name: "Bildirishnomalarni yoqish" }).click();
      await page.getByRole("button", { name: "Yoqish", exact: true }).click();
      await expect(page.getByRole("button", { name: "Bildirishnomalarni o'chirish" })).toBeVisible();
    }
    await page.reload();
    await expect(page.getByRole("button", { name: "Bildirishnomalarni o'chirish" })).toBeVisible({ timeout: 60_000 });

    const endpoints = new Set(
      calls.filter((call) => call.method === "POST" && call.path === "notifications/push/subscribe").map((call) => (call.body as { endpoint: string }).endpoint),
    );
    expect([...endpoints]).toEqual(["https://fcm.googleapis.com/fcm/send/e2e-device-a"]);
    expect(subscriptions.size).toBe(1);
  });

  test("TC11: Sozlamalarda push o'chirilgach — mavjud obuna o'chadi, qayta yuklashda yangisi yaratilmaydi", async ({ page, context }) => {
    const { calls, subscriptions } = await mockBackend(context);
    await prepareBrowser(context);
    await context.grantPermissions(["notifications"], { origin: ORIGIN });
    await enablePush(page);
    expect(subscriptions.size).toBe(1);

    await page.goto("/settings");
    await page.getByRole("main").getByRole("tab", { name: /Bildirishnomalar/ }).click({ timeout: 60_000 });
    await waitToastsGone(page);
    // Dizayn v2: Sozlamalarda push — «Shu qurilmaga bildirishnomalar» kaliti (maket `common-settings-notifications`).
    const toggle = page.getByRole("switch", { name: "Shu qurilmaga bildirishnomalar" });
    await expect(toggle).toHaveAttribute("aria-checked", "true", { timeout: 60_000 });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(subscriptions.size).toBe(0);
    const patch = calls.filter((call) => call.path === "auth/my-settings").at(-1)!;
    expect((patch.body as { settings: { notifications: { push: boolean } } }).settings.notifications.push).toBe(false);

    const postsBefore = calls.filter((call) => call.method === "POST" && call.path === "notifications/push/subscribe").length;
    const subscribeBefore = (await counters(page)).subscribe;
    await page.reload();
    await expect(page.getByRole("main")).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(2000);
    expect(calls.filter((call) => call.method === "POST" && call.path === "notifications/push/subscribe").length).toBe(postsBefore);
    expect((await counters(page)).subscribe).toBe(subscribeBefore);
    expect(subscriptions.size).toBe(0);
  });

  test("TC12: 390×664 — ruxsat tugmasi to'liq ko'rinadi, kesilmaydi", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await mockBackend(context);
    await prepareBrowser(context);
    await page.goto("/inbox");
    await waitForServiceWorker(page);
    const button = page.getByRole("button", { name: "Bildirishnomalarni yoqish" });
    await expect(button).toBeVisible({ timeout: 60_000 });
    const box = await button.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, clipped: el.scrollWidth > el.clientWidth + 1 };
    });
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(390);
    expect(box.bottom).toBeLessThanOrEqual(664);
    expect(box.clipped).toBe(false);
    await context.close();
  });
});
