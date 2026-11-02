import { expect, test } from "@playwright/test";
import { mockCancelReasons } from "./support/cancelReasons";

/** «BEKOR QILISH SABABLARI», 1440px (GNWDKvmZ, PUvKXWVw): kirish `/orders` dan, ruxsat, davr, tarjima. */
test.describe("Bekor qilish sabablari — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ /orders sarlavhasidan ochiladi; sabablar soni va ulushi bilan, «Orqaga» qaytaradi", async ({ page }) => {
    const { leaked, stats } = await mockCancelReasons(page);
    await page.goto("/orders");

    await page.getByRole("link", { name: "Bekor qilish sabablari" }).click({ timeout: 60_000 });
    await expect(page).toHaveURL(/\/orders\/cancel-reasons$/);
    const list = page.getByRole("list", { name: "Sabablar bo'yicha" });
    await expect(list.getByRole("listitem").first()).toContainText("Mijoz javob bermadi");
    await expect(list.getByRole("listitem").first()).toContainText("18 ta");
    await expect(list.getByRole("listitem").first()).toContainText("45%");
    await expect(list).toContainText("Sababsiz");
    await expect(page.getByRole("region", { name: "Bekor qilish ko'rsatkichlari" })).toContainText("40");
    expect(stats.at(-1)?.get("startDate")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    await page.getByRole("link", { name: "Buyurtmalar" }).first().click();
    await expect(page).toHaveURL(/\/orders$/);
    expect(leaked).toEqual([]);
  });

  test("⭐ superadmin market tanlaydi — `market_id` so'rovga ketadi", async ({ page }) => {
    const { stats } = await mockCancelReasons(page);
    await page.goto("/orders/cancel-reasons");

    await page.getByRole("combobox", { name: "Market" }).click({ timeout: 60_000 });
    await page.getByRole("option", { name: "Baraka Shop" }).click();
    await expect.poll(() => stats.at(-1)?.get("market_id")).toBe("7");
  });

  test("⭐ filial tanlanadi; «Barcha marketlar» qaytarilsa `market_id` olinadi", async ({ page }) => {
    const { stats } = await mockCancelReasons(page);
    await page.goto("/orders/cancel-reasons");

    await page.getByRole("combobox", { name: "Filial" }).click({ timeout: 60_000 });
    await page.getByRole("option", { name: "HQ Toshkent" }).click();
    await expect.poll(() => stats.at(-1)?.get("branch_id")).toBe("1");

    const kpi = page.getByRole("region", { name: "Bekor qilish ko'rsatkichlari" });
    await expect(kpi).toContainText("40");

    await page.getByRole("combobox", { name: "Market" }).click();
    await page.getByRole("option", { name: "Baraka Shop" }).click();
    await expect.poll(() => stats.at(-1)?.get("market_id")).toBe("7");
    expect(stats.at(-1)?.get("branch_id")).toBe("1");
    await expect(kpi).toContainText("7");
    await expect(kpi).not.toContainText("40");

    // Qaytarilganda javob keshdan: yangi so'rov shart emas, ekrandagi son qaytishi muhim.
    await page.getByRole("combobox", { name: "Market" }).click();
    await page.getByRole("option", { name: "Barcha marketlar" }).click();
    await expect(kpi).toContainText("40");
  });

  test("⭐ «Barchasi»: sanasiz so'rov, sarlavhada «Barcha vaqt», 1970 sanasi ko'rinmaydi", async ({ page }) => {
    const { stats } = await mockCancelReasons(page);
    await page.goto("/orders/cancel-reasons");
    await expect(page.getByRole("list", { name: "Sabablar bo'yicha" })).toBeVisible({ timeout: 60_000 });

    await page.getByRole("group", { name: "Hisobot filtrlari" }).getByRole("button").first().click();
    await page.getByRole("button", { name: "Barchasi" }).click();

    // Dashboard'dagi `1970-01-01` muammosi (#534) bu yerda yo'q: «Barchasi» sanasiz so'raydi.
    await expect.poll(() => stats.at(-1)?.has("startDate")).toBe(false);
    expect(stats.at(-1)?.has("endDate")).toBe(false);
    await expect(page.locator("[data-shell-slot=content]")).not.toContainText("1970");
    await expect(page.getByText("Barcha vaqt")).toBeVisible();
  });

  test("backend qisqartirgan oraliq sarlavhada ko'rinadi", async ({ page }) => {
    await mockCancelReasons(page, { appliedRange: { startDate: "2026-01-05", endDate: "2026-10-31" } });
    await page.goto("/orders/cancel-reasons");

    await expect(page.getByRole("heading", { name: "Sabablar bo'yicha" })).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("[data-shell-slot=content]")).toContainText("05.01");
  });

  for (const role of ["manager", "market"]) {
    test(`⭐ ${role}: hisobot ochiladi, filtrlar yashirin`, async ({ page }) => {
      await mockCancelReasons(page, { role });
      await page.goto("/orders/cancel-reasons");

      await expect(page.getByRole("list", { name: "Sabablar bo'yicha" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("combobox", { name: "Market" })).toHaveCount(0);
      await expect(page.getByRole("combobox", { name: "Filial" })).toHaveCount(0);
    });
  }

  for (const role of ["courier", "registrator"]) {
    test(`⭐ ${role}: ruxsat yo'q, /orders da havola ham yo'q`, async ({ page }) => {
      await mockCancelReasons(page, { role });
      await page.goto("/orders/cancel-reasons");
      await expect(page.getByRole("heading", { level: 1, name: "Bu sahifaga ruxsatingiz yo'q" })).toBeVisible({ timeout: 60_000 });

      await page.goto("/orders");
      await expect(page.locator("[data-shell-slot=content]").getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("link", { name: "Bekor qilish sabablari" })).toHaveCount(0);
    });
  }

  for (const [language, title, reason] of [
    ["ru", "Причины отмены", "Клиент не ответил"],
    ["en", "Cancellation reasons", "Customer didn't answer"],
  ] as const) {
    test(`${language}: sarlavha va sabablar tarjima qilingan`, async ({ page }) => {
      await mockCancelReasons(page, { language });
      await page.goto("/orders/cancel-reasons");

      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("list").filter({ hasText: reason })).toBeVisible();
    });
  }
});

/** Oraliq kengliklar: `/orders` sarlavhasida yangi havola bilan ham, hisobotda ham sahifa surilmaydi. */
for (const width of [768, 1024, 1100, 1279, 1280, 1440]) {
  test.describe(`Bekor qilish sabablari — ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    test.describe.configure({ timeout: 90_000 });

    for (const language of ["uz", "ru", "en"] as const) {
      test(`${language}: sarlavha va hisobot sig'adi`, async ({ page }) => {
        await mockCancelReasons(page, { language, long: true });
        await page.goto("/orders");
        const link = page.locator('a[href="/orders/cancel-reasons"]');
        await expect(link).toBeVisible({ timeout: 60_000 });
        const overflow = () => page.locator("main:has([data-shell-slot=content])").evaluate((main) => main.scrollWidth - main.clientWidth);
        expect(await overflow()).toBeLessThanOrEqual(0);
        const box = (await link.boundingBox())!;
        expect(box.x + box.width).toBeLessThanOrEqual(width);

        await link.click();
        await expect(page.locator("[data-shell-slot=content] section ul").first()).toBeVisible({ timeout: 30_000 });
        expect(await overflow()).toBeLessThanOrEqual(0);
      });
    }
  });
}

