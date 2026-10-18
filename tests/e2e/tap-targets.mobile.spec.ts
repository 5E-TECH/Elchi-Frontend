import { devices, expect, test } from "@playwright/test";
import { mockTapTargetsApi, openFully, tapTargets, tooSmall, type TapRole } from "./support/tapTargets";

/**
 * aA5njZNo — telefonda (iPhone 12, 390×664) `/` va `/orders` dagi har bir ko'rinadigan bosiladigan element kamida
 * 44×44 px (Apple HIG; taxta `tizim-motion` 06 «Bosish maydoni»). Boshqaruvlar v2 primitivlarida: `SegmentedControl`,
 * `IconButton`, `Button`, `TextInput` telefonda o'zi 44 px — sahifa alohida `.tap-44` CSS yasamaydi.
 * Chromium (`mobile-390`) da doim; WebKit — `PLAYWRIGHT_WEBKIT=1` bilan `webkit-iphone` loyihasida.
 */
test.use({
  viewport: devices["iPhone 12"].viewport,
  userAgent: devices["iPhone 12"].userAgent,
  deviceScaleFactor: devices["iPhone 12"].deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
});
test.describe.configure({ timeout: 180_000 });

const PAGES: Array<{ role: TapRole; path: string; ready: string }> = [
  { role: "superadmin", path: "/", ready: "[data-testid=ranking-markets]" },
  { role: "superadmin", path: "/orders", ready: "text=Mijoz 1001" },
  { role: "market", path: "/", ready: "[data-shell-slot=content] h1" },
  { role: "market", path: "/orders", ready: "text=Mijoz 1001" },
  { role: "courier", path: "/", ready: "[data-shell-slot=content] h1" },
  { role: "courier", path: "/orders", ready: "[data-shell-slot=content] h1" },
];

for (const { role, path, ready } of PAGES) {
  test(`⭐ ${role} ${path}: barcha bosiladigan elementlar ≥ 44×44`, async ({ page }) => {
    await mockTapTargetsApi(page, role);
    await openFully(page, path, ready);
    const targets = await tapTargets(page);
    // Sahifa haqiqatan chizilgan (shell + kontent), bo'sh ro'yxat «0 ta kichik» bermasin.
    expect(targets.length).toBeGreaterThan(10);
    expect(tooSmall(targets)).toEqual([]);
  });
}

test("⭐ superadmin /: davr filtri qatori (44 px) setkani buzmaydi — ustma-ust tushmaydi, gorizontal skroll yo'q", async ({ page }, testInfo) => {
  await mockTapTargetsApi(page, "superadmin");
  await openFully(page, "/", "[data-testid=ranking-markets]");
  await page.locator("main").evaluate((main) => main.scrollTo({ top: 0 }));

  const period = page.getByRole("radiogroup").first();
  const segments = period.getByRole("radio");
  await expect(segments).toHaveText(["Bugun", "Bu hafta", "Bu oy", "Barchasi"]);
  const boxes = await segments.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().toJSON() as DOMRect));
  const viewport = page.viewportSize()!;
  for (const [i, box] of boxes.entries()) {
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(viewport.width);
    // Bir qatorda, bir-birini qoplamaydi.
    if (i > 0) {
      expect(box.top).toBe(boxes[0].top);
      expect(box.left).toBeGreaterThanOrEqual(boxes[i - 1].right - 0.5);
    }
  }
  // Keyingi qator (yil + sana oralig'i) segment ostida, ustiga chiqmaydi.
  const range = await page.getByRole("button", { name: /Sana oralig'i/ }).boundingBox();
  expect(range!.y).toBeGreaterThanOrEqual(boxes[0].bottom);
  expect(range!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await testInfo.attach("dashboard-390", { body: await page.screenshot(), contentType: "image/png" });
});
