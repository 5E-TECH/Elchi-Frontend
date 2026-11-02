import { expect, test } from "@playwright/test";
import { mainHorizontalOverflow } from "./support/integrations";
import { CONSOLE_LOG, mockPartnerJournal } from "./support/partnerJournal";

/**
 * «HODISALAR» — UMUMIY WEBHOOK JURNALI, 1440px (Dj70iDbD). Eski `/integrations/partners` va `integrations-ops`
 * olib tashlangan: jurnal shu panelda, eski yo'llar ikkinchi eshik bo'lib ochilmaydi.
 */

const filter = (page: import("@playwright/test").Page) => page.getByRole("combobox", { name: "Hamkor bo'yicha filtr" });

test.describe("Umumiy webhook jurnali — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ sukut — ochiq hamkor; «Barcha hamkorlar» — hamma hamkor, ustunda nomi", async ({ page }) => {
    const { journal, leaked } = await mockPartnerJournal(page);
    await page.goto(CONSOLE_LOG);

    const table = page.getByRole("table", { name: "Biz yuborgan hodisalar" });
    await expect(table.getByRole("row")).toHaveCount(3, { timeout: 60_000 });
    await expect(table.getByRole("columnheader", { name: "Hamkor" })).toHaveCount(0);
    expect(journal.at(-1)?.get("partner_id")).toBe("1");

    await filter(page).click();
    await page.getByRole("option", { name: "Barcha hamkorlar" }).click();

    await expect(table.getByRole("row")).toHaveCount(4);
    await expect(table.getByRole("columnheader", { name: "Hamkor" })).toBeVisible();
    await expect(table.getByRole("row", { name: /EX-3/ })).toContainText("Baraka Shop");
    expect(journal.at(-1)?.has("partner_id")).toBe(false);
    expect(await mainHorizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });

  test("⭐ webhook ma'lumoti ochiladi, yetkazilmagani qayta navbatga qo'yiladi", async ({ page }) => {
    const { leaked, writes } = await mockPartnerJournal(page);
    await page.goto(CONSOLE_LOG);

    const toggle = page.getByRole("button", { name: "№101 — webhook ma'lumotini ko'rish" });
    await toggle.click({ timeout: 60_000 });
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("8 urinishdan keyin to'xtatildi")).toBeVisible();
    await expect(page.locator("#partner-payload-1")).toContainText('"external_order_id": "EX-1"');

    await page.getByRole("button", { name: "№101 hodisasini qayta yuborish" }).click();
    await expect.poll(() => writes.map(({ call }) => call)).toEqual(["POST admin/partners/webhooks/1/retry"]);
    // Yetkazilgan hodisada qayta yuborish yo'q, lekin ma'lumotni ko'rish bor.
    await expect(page.getByRole("button", { name: "№102 hodisasini qayta yuborish" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "№102 — webhook ma'lumotini ko'rish" })).toBeVisible();
    expect(leaked).toEqual([]);
  });

  test("admin ham umumiy jurnalni ko'radi", async ({ page }) => {
    await mockPartnerJournal(page, { role: "admin" });
    await page.goto(CONSOLE_LOG);

    await filter(page).click({ timeout: 60_000 });
    await page.getByRole("option", { name: "Barcha hamkorlar" }).click();
    await expect(
      page.getByRole("table", { name: "Biz yuborgan hodisalar" }).getByRole("columnheader", { name: "Hamkor" }),
    ).toBeVisible();
  });

  for (const path of ["/partners", "/integrations/partners"]) {
    test(`⭐ ${path} — eski sahifa yo'q, 404`, async ({ page }) => {
      await mockPartnerJournal(page);
      await page.goto(path);

      await expect(page.getByRole("heading", { level: 1, name: "Bu sahifa topilmadi" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("heading", { name: "API hamkorlari" })).toHaveCount(0);
    });
  }

  for (const path of ["/integrations-ops", "/ops?tab=integrations"]) {
    test(`⭐ superadmin: ${path} → konsol, eski vosita yo'q`, async ({ page }) => {
      await mockPartnerJournal(page);
      await page.goto(path);

      await expect(page).toHaveURL(/\/integrations\/connections\?scope=partner/, { timeout: 60_000 });
      await expect(page.getByRole("heading", { level: 1, name: "Integratsiyalar" })).toBeVisible({ timeout: 60_000 });
    });
  }

  test("⭐ /integrations/sources: «Eski sahifa» belgisi matn bilan, xom kalit emas", async ({ page }) => {
    await mockPartnerJournal(page);
    await page.goto("/integrations/sources");

    const content = page.locator("[data-shell-slot=content]");
    await expect(content.getByText("Eski sahifa", { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(content.getByText(/legacyPartners|legacySources/)).toHaveCount(0);
  });

  for (const role of ["superadmin", "admin"] as const) {
    test(`⭐ ${role}: menyuda bitta «Integratsiyalar» — «Ma'lumotnoma» ichida, alohida guruh yo'q`, async ({ page }) => {
      await mockPartnerJournal(page, { role });
      await page.goto(CONSOLE_LOG);

      const nav = page.getByRole("navigation", { name: "Asosiy bo'limlar" });
      await expect(nav.getByRole("button", { name: "Ma'lumotnoma" })).toBeVisible({ timeout: 60_000 });
      await expect(nav.getByRole("link", { name: "Integratsiyalar" })).toHaveCount(1);
      await expect(nav.getByRole("button", { name: "Integratsiyalar" })).toHaveCount(0);
    });
  }

  for (const [language, allPartners] of [
    ["ru", "Все партнёры"],
    ["en", "All partners"],
  ] as const) {
    test(`${language}: filtr va ma'lumot tarjima qilingan`, async ({ page }) => {
      await mockPartnerJournal(page, { language });
      await page.goto(CONSOLE_LOG);

      await page.getByRole("combobox").filter({ hasText: /BeePost/ }).click({ timeout: 60_000 });
      await expect(page.getByRole("option", { name: allPartners })).toBeVisible();
    });
  }

  test("⭐ Ops hub'da integratsiya tabi yo'q, admin uchun eski yo'l — 403", async ({ page, context }) => {
    await mockPartnerJournal(page);
    await page.goto("/ops?tab=system");
    const tabs = page.getByRole("tablist", { name: "Ops bo'limlari" }).getByRole("tab");
    await expect(tabs).toHaveCount(7, { timeout: 60_000 });
    await expect(tabs.filter({ hasText: "Integratsiya" })).toHaveCount(0);

    await context.unrouteAll({ behavior: "ignoreErrors" });
    await mockPartnerJournal(page, { role: "admin" });
    await page.goto("/integrations-ops");
    await expect(page.getByRole("heading", { level: 1, name: "Bu sahifaga ruxsatingiz yo'q" })).toBeVisible({ timeout: 60_000 });
  });
});

/** Uzun nom va xato matni bilan ham «Amal» ustuni ekranda qoladi: jadval o'z ichida ham, sahifa ham surilmaydi. */
for (const width of [768, 1024, 1100, 1279, 1280, 1440]) {
  test.describe(`Umumiy jurnal — uzun matn, ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    test.describe.configure({ timeout: 90_000 });

    test("«Amal» ko'rinadi, gorizontal skroll yo'q", async ({ page }) => {
      await mockPartnerJournal(page, { long: true });
      await page.goto(CONSOLE_LOG);

      await filter(page).click({ timeout: 60_000 });
      await page.getByRole("option", { name: "Barcha hamkorlar" }).click();
      const table = page.getByRole("table", { name: "Biz yuborgan hodisalar" });
      await expect(table.getByRole("columnheader", { name: "Hamkor" })).toBeVisible();

      expect(await mainHorizontalOverflow(page)).toBeLessThanOrEqual(0);
      const inner = await table.evaluate((node) => node.parentElement!.scrollWidth - node.parentElement!.clientWidth);
      expect(inner).toBeLessThanOrEqual(0);
      const action = await page.getByRole("button", { name: "№101 hodisasini qayta yuborish" }).boundingBox();
      expect((action?.x ?? 0) + (action?.width ?? 0)).toBeLessThanOrEqual(width);
      // Ustun yashiringanda ham buyurtma ko'rinadi.
      await expect(table.getByText("EX-1", { exact: true }).filter({ visible: true })).toHaveCount(1);
    });
  });
}
