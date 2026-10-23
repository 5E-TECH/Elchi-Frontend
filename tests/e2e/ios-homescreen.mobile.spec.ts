import { expect, test } from "@playwright/test";

/**
 * QgqO0CdZ — iPhone Safari «Ulashish → Bosh ekranga qo'shish» uchun manifest buzilmagan: Safari'ning o'zi shu
 * ma'lumotdan ikonka va nom oladi. Haqiqiy brauzerda (`webkit-iphone` — iPhone 12, Safari; `mobile-390`):
 * iOS teglari, manifest maydonlari, har ikonka 200 + PNG + e'lon qilingan o'lchamda, `apple-touch-icon` 180×180.
 * Ulashish menyusining o'zi Safari'ning native UI'si — avtomatlashtirib bo'lmaydi.
 */
test.describe.configure({ timeout: 90_000 });

type Manifest = {
  name?: string;
  short_name?: string;
  start_url?: string;
  scope?: string;
  display?: string;
  icons?: Array<{ src: string; sizes: string; type: string }>;
  shortcuts?: Array<{ url: string }>;
};

/** Rasmni brauzerning o'zida yuklab, haqiqiy o'lchamini oladi (buzilgan PNG — xato). */
const imageSize = (page: import("@playwright/test").Page, src: string) =>
  page.evaluate(
    (url) =>
      new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error(`rasm ochilmadi: ${url}`));
        image.src = url;
      }),
    src,
  );

test("⭐ bosh ekranga qo'shish: iOS teglari, manifest va ikonkalar butun", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("body")).toBeVisible();

  // iOS teglari: Safari bosh ekran ikonkasi, nomi va to'liq ekran rejimini shulardan oladi.
  const head = page.locator("head");
  await expect(head.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
  await expect(head.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "Elchi");
  const appleIcon = await head.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  const manifestHref = await head.locator('link[rel="manifest"]').getAttribute("href");
  expect(appleIcon).toBeTruthy();
  expect(manifestHref).toBeTruthy();

  const fetched = await page.evaluate(async (href) => {
    const res = await fetch(href!);
    return { status: res.status, text: await res.text() };
  }, manifestHref);
  expect(fetched.status).toBe(200);
  const manifest = JSON.parse(fetched.text) as Manifest; // buzilgan JSON — shu yerda yiqiladi
  expect(manifest).toMatchObject({ name: "Elchi Pochta", short_name: "Elchi", start_url: "/", scope: "/", display: "standalone" });

  const icons = manifest.icons ?? [];
  expect(icons.length).toBeGreaterThan(0);
  for (const icon of icons) {
    const head = await page.evaluate(async (src) => {
      const res = await fetch(src);
      return { status: res.status, type: res.headers.get("content-type") ?? "" };
    }, icon.src);
    expect(head.status, icon.src).toBe(200);
    expect(head.type, icon.src).toContain("image/png");
    const [width, height] = icon.sizes.split("x").map(Number);
    expect(await imageSize(page, icon.src), icon.src).toEqual({ width, height });
  }
  for (const shortcut of manifest.shortcuts ?? []) expect(shortcut.url.startsWith("/"), shortcut.url).toBe(true);

  // Bosh ekran ikonkasi (iOS manifest ikonkasini emas, shuni oladi) — 180×180 PNG.
  expect(await imageSize(page, appleIcon!)).toEqual({ width: 180, height: 180 });
});
