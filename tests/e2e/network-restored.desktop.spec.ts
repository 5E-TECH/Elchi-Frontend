import { expect, test } from "@playwright/test";
import { mockOrdersListApi } from "./support/floor";

/**
 * G6F68ti6 (1/3-bandlar) — tarmoq holati xabari (taxta `tizim-feedback` §04): «Internet aloqasi yo'q» aloqa
 * qaytguncha turadi, qaytgach o'zi yopiladi va «Aloqa tiklandi» 3 s ko'rinib yo'qoladi; ochiq sahifa qayta so'raladi.
 * Ikki holat: brauzer oflayn (`setOffline`) va «Wi-Fi bor, internet yo'q» (`navigator.onLine` = true, so'rovlar
 * uziladi — brauzer `online` hodisasi kelmaydi, tiklanish birinchi javobdan).
 */
test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 90_000 });

const toasts = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "Bildirishnomalar", exact: true });

test("⭐ brauzer oflayn → «Internet aloqasi yo'q» (2 s kutib); onlayn → yopiladi, «Aloqa tiklandi» 3 s, ro'yxat qayta so'raladi", async ({
  page,
  context,
}) => {
  const { state } = await mockOrdersListApi(page);
  await page.goto("/orders");
  await expect(page.getByText("Sevara Tursunova")).toBeVisible({ timeout: 60_000 });

  await context.setOffline(true);
  await expect(toasts(page).getByText("Internet aloqasi yo'q")).toBeVisible({ timeout: 5_000 });
  // «Qayta urinish» oflaynda xabarni yopmaydi.
  await toasts(page).getByRole("button", { name: "Qayta urinish" }).click();
  await expect(toasts(page).getByText("Internet aloqasi yo'q")).toBeVisible();
  // Kursor xabar ustida turganda vaqt to'xtaydi (taxta §01) — foydalanuvchi kabi chetga suriladi.
  await page.mouse.move(700, 600);

  const before = state.listCalls;
  await context.setOffline(false);
  await expect(toasts(page).getByText("Aloqa tiklandi")).toBeVisible({ timeout: 10_000 });
  await expect(toasts(page).getByText("Internet aloqasi yo'q")).toHaveCount(0);
  await expect.poll(() => state.listCalls, { timeout: 10_000 }).toBeGreaterThan(before);
  await expect(toasts(page).getByText("Aloqa tiklandi")).toHaveCount(0, { timeout: 5_000 });
});

/**
 * Javobsiz so'rov (2026-11-20): GET jim 2 marta qayta so'raladi (~4 s), so'ng ilova saytining o'zi tekshiriladi
 * (`HEAD /robots.txt`). Keshdagi ro'yxatni yangilash xatosi global xabar bermaydi (sahifa «Ro'yxat yangilanmadi» ni
 * o'zi chizadi) — shuning uchun ro'yxat birinchi yuklanishida uziladi. Faqat API (ilova sayti emas) uziladi.
 */
const APP_ORIGIN = "http://127.0.0.1:4173";
const apiOrdersList = (url: URL) => url.origin !== APP_ORIGIN && url.pathname === "/orders";
const abort = (route: import("@playwright/test").Route) => route.abort("internetdisconnected");

test("«Wi-Fi bor, internet yo'q»: so'rov va sayt tekshiruvi uzilsa — «Internet aloqasi yo'q»; aloqa qaytsa «Aloqa tiklandi»", async ({
  page,
}) => {
  await mockOrdersListApi(page);
  // Ro'yxat so'rovi ham, ilova sayti tekshiruvi ham uziladi — `navigator.onLine` o'zgarmaydi.
  await page.route(apiOrdersList, abort);
  await page.route("**/robots.txt", abort);
  await page.goto("/orders");
  await expect(toasts(page).getByText("Internet aloqasi yo'q")).toBeVisible({ timeout: 20_000 });
  expect(await page.evaluate(() => navigator.onLine)).toBe(true);

  await page.unroute(apiOrdersList);
  await page.unroute("**/robots.txt");
  await toasts(page).getByRole("button", { name: "Qayta urinish" }).click();
  await expect(toasts(page).getByText("Aloqa tiklandi")).toBeVisible({ timeout: 10_000 });
  await expect(toasts(page).getByText("Internet aloqasi yo'q")).toHaveCount(0);
  await expect(page.getByText("Sevara Tursunova")).toBeVisible();
  // Inglizcha kutubxona matni hech qayerda chiqmaydi.
  await expect(page.getByText("Network Error")).toHaveCount(0);
});

test("internet bor, faqat API javob bermadi (Cloudflare/tunnel): «Server javob bermadi», internet ayblanmaydi; aloqa qaytsa yopiladi", async ({
  page,
}) => {
  await mockOrdersListApi(page);
  await page.route(apiOrdersList, abort);
  await page.goto("/orders");
  await expect(toasts(page).getByText("Server javob bermadi", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Internet aloqasi yo'q")).toHaveCount(0);

  await page.unroute(apiOrdersList);
  await toasts(page).getByRole("button", { name: "Qayta urinish" }).click();
  await expect(toasts(page).getByText("Aloqa tiklandi")).toBeVisible({ timeout: 10_000 });
  await expect(toasts(page).getByText("Server javob bermadi", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Sevara Tursunova")).toBeVisible();
});
