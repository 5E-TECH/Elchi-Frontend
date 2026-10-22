import { expect, test } from "@playwright/test";

/**
 * js9ndYwA — ilova kodi ishga tushmasa oq ekran emas, zaxira matn (`index.html`):
 *   - JavaScript o'chiq — `<noscript>` «Ilova ishlashi uchun JavaScript yoqilgan bo'lishi kerak.»;
 *   - bundle yuklanmadi / tahlil qilinmadi (eski brauzer) — 8 s dan keyin «Brauzeringiz eskirgan.»;
 *   - oddiy yuklanish — blok ko'rinmaydi, React chizilgach o'chiriladi (`main.tsx`).
 * `/login` — kirishsiz ochiladi, backend so'rovi kerak emas.
 */
test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ timeout: 120_000 });

test.describe("JavaScript o'chiq", () => {
  test.use({ javaScriptEnabled: false });

  test("⭐ zaxira matn ko'rinadi, «Brauzeringiz eskirgan» bloki chiqmaydi", async ({ page }) => {
    await page.goto("/login");
    // `getByText` `<noscript>` ichini qidirmaydi — CSS selektor bilan.
    const message = page.locator("noscript .elchi-fallback__title");
    await expect(message).toBeVisible();
    await expect(message).toHaveText("Ilova ishlashi uchun JavaScript yoqilgan bo'lishi kerak.");
    await page.waitForTimeout(8_500);
    await expect(page.locator("#legacy-fallback")).toBeHidden();
  });
});

test("⭐ bundle yuklanmasa — 8 s dan keyin «Brauzeringiz eskirgan.», undan oldin yashirin", async ({ page }) => {
  await page.route(/\/src\/main\.tsx/, (route) => route.abort());
  await page.goto("/login", { waitUntil: "commit" });
  const fallback = page.locator("#legacy-fallback");
  await expect(fallback).toBeAttached();
  // 8 s gacha yashirin: holat hujjat vaqti bilan birga o'qiladi (sekin mashinada sahifa 8 s dan kech ochilishi mumkin).
  const early = await fallback.evaluate((node) => ({
    elapsed: document.timeline.currentTime as number,
    delay: getComputedStyle(node).animationDelay,
    visibility: getComputedStyle(node).visibility,
  }));
  expect(early.delay).toBe("8s");
  if (early.elapsed < 7_500) expect(early.visibility).toBe("hidden");
  await expect(fallback).toBeVisible({ timeout: 15_000 });
  await expect(fallback).toContainText("Brauzeringiz eskirgan.");
  await expect(fallback).toContainText("Iltimos, Safari yoki Chrome'ni yangilang.");
});

test("⭐ oddiy yuklanish — blok ko'rinmaydi va React chizilgach DOM'dan o'chiriladi", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator('input[name="password"]')).toBeVisible({ timeout: 90_000 });
  await expect(page.locator("#legacy-fallback")).toHaveCount(0);
});
