import { expect, test, type Page } from "@playwright/test";
import { mockTapTargetsApi, openFully } from "./support/tapTargets";

/**
 * aA5njZNo — 44 px qoidasi FAQAT telefonga (< 768) tegishli. 1440 px da desktop o'lchamlari o'zgarmaydi:
 * segment 32, yuqori paneldagi ikonka tugmasi 40, «Oldingi davr bilan solishtirish» kaliti 36, sana maydoni 40.
 * Balandliklar shu yerda qotirilgan (o'lcham «snapshoti») — telefon tuzatishi desktopga sizib chiqsa, test yiqiladi.
 */
test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 180_000 });

const heightOf = async (page: Page, role: "radio" | "button" | "switch", name: string | RegExp) =>
  Math.round((await page.getByRole(role, { name, exact: typeof name === "string" }).first().boundingBox())!.height);

test("⭐ superadmin / 1440: desktop chiplari va tugmalari o'z o'lchamida (44 ga cho'zilmagan)", async ({ page }) => {
  await mockTapTargetsApi(page, "superadmin");
  await openFully(page, "/", "[data-testid=ranking-markets]");

  const sizes = {
    bugun: await heightOf(page, "radio", "Bugun"),
    buHafta: await heightOf(page, "radio", "Bu hafta"),
    kunlik: await heightOf(page, "radio", "Kunlik"),
    grafik: await heightOf(page, "radio", "Grafik"),
    bildirishnomalar: await heightOf(page, "button", "Bildirishnomalar"),
    solishtirish: await heightOf(page, "switch", "Oldingi davr bilan solishtirish"),
    sana: await heightOf(page, "button", /Sana oralig'i/),
  };
  expect(sizes).toEqual({ bugun: 32, buHafta: 32, kunlik: 32, grafik: 32, bildirishnomalar: 40, solishtirish: 36, sana: 40 });
});
