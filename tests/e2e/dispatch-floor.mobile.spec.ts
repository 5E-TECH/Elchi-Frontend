import { expect, test } from "@playwright/test";
import {
  BULK_SOLD_COMMENT,
  hidScan,
  markResult,
  mockCourierBulkApi,
  mockDispatchApi,
  openCourierBulk,
  openDispatch,
} from "./support/floor";
import { toast } from "./support/toast";

/** G3 «Biriktirish» va «Tezkor amal» — 390px: asosiy amal pastki menyu ustidagi yopishqoq panelda (48px), oyna — varaqa. */
test.describe("Biriktirish va Tezkor amal — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  const expectAboveBottomNav = async (page: import("@playwright/test").Page, name: string) => {
    const button = page.getByRole("button", { name, exact: true });
    await expect(button).toHaveCount(1);
    const box = (await button.boundingBox())!;
    const nav = (await page.getByRole("navigation", { name: "Asosiy bo'limlar" }).boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.y + box.height).toBeLessThanOrEqual(nav.y + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  };

  test("⭐ /dispatch: skan → yopishqoq «Biriktirish» → kuryer varaqasi → POST", async ({ page }) => {
    const api = await mockDispatchApi(page);
    await openDispatch(page);

    await hidScan(page, "tok-10285");
    await expect(page.getByRole("checkbox", { name: "№10285 ni tanlash" })).toBeChecked();
    await hidScan(page, "tok-10316");
    await expect(page.getByRole("checkbox", { name: "№10316 ni tanlash" })).toBeChecked();

    await expectAboveBottomNav(page, "Kuryerga biriktirish — 2 ta");
    await page.getByRole("button", { name: "Kuryerga biriktirish — 2 ta", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "Kuryerni tanlang" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("radio", { name: /Sardor Aliyev/ }).click();
    await dialog.getByRole("button", { name: "Biriktirish — 2 ta" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(toast(page, "2 ta buyurtma Sardor Aliyevga biriktirildi")).toBeVisible();
    expect(api.assigns).toEqual([{ courier_id: "263", order_ids: ["10285", "10316"] }]);
    expect(api.leaked).toEqual([]);
  });

  test("⭐ /courier-bulk: yopishqoq «Kunni yakunlash» → tasdiq → so'rov", async ({ page }) => {
    const api = await mockCourierBulkApi(page);
    await openCourierBulk(page);

    await markResult(page, "Ali Valiyev", "Ertaga");
    await markResult(page, "Dilnoza Rahimova", "Ertaga");
    await expectAboveBottomNav(page, "Kunni yakunlash");
    await page.getByRole("button", { name: "Kunni yakunlash", exact: true }).click();

    const confirm = page.getByRole("alertdialog", { name: "Kunni yakunlashni tasdiqlang" });
    await confirm.getByRole("button", { name: "Tasdiqlash" }).click();

    await expect(toast(page, "Kun yakunlandi")).toBeVisible();
    expect(api.sells).toEqual([{ id: "10401", body: { comment: BULK_SOLD_COMMENT, extraCost: 0 } }]);
    expect(api.cancels).toEqual([]);
    expect(api.leaked).toEqual([]);
  });

  test("⭐ /courier-bulk: isbot qadami — pastki varaqa, fayl tanlanmaguncha «Yakunlash» o'chiq; so'rovlarda X-Request-Source", async ({ page }) => {
    const api = await mockCourierBulkApi(page, { sellProofIds: ["10402"] });
    await openCourierBulk(page);

    await markResult(page, "Dilnoza Rahimova", "Ertaga");
    await page.getByRole("button", { name: "Kunni yakunlash", exact: true }).click();
    await page
      .getByRole("alertdialog", { name: "Kunni yakunlashni tasdiqlang" })
      .getByRole("button", { name: "Tasdiqlash" })
      .click();

    const dialog = page.getByRole("dialog", { name: "Isbot yuklang" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("1 ta buyurtma uchun market rasm yoki video isbot talab qiladi");
    await expect(dialog).toContainText("Qolgan 1 ta buyurtma isbotsiz yakunlanadi.");
    // Telefonda — pastdan chiqadigan varaqa, gorizontal skroll yo'q.
    const box = (await dialog.boundingBox())!;
    expect(box.y + box.height).toBeGreaterThanOrEqual(844 - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const submit = dialog.getByRole("button", { name: "Yakunlash" });
    await expect(submit).toBeDisabled();
    expect(api.requests).toEqual([]);
    const submitBox = (await submit.boundingBox())!;
    expect(submitBox.height).toBeGreaterThanOrEqual(44);

    await dialog
      .getByRole("group", { name: "№10402 · Ali Valiyev" })
      .locator('input[type="file"]')
      .setInputFiles({ name: "isbot_10402.jpg", mimeType: "image/jpeg", buffer: Buffer.from("e2e") });
    await expect(dialog).toContainText("Isbot tanlandi: 1 / 1");
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(toast(page, "Kun yakunlandi")).toBeVisible();
    await expect(dialog).toHaveCount(0);
    expect([...api.requests].sort((a, b) => a.id.localeCompare(b.id))).toEqual([
      { action: "sell", id: "10401", source: "courier-bulk" },
      { action: "sell", id: "10402", source: "courier-bulk" },
    ]);
    // Isbot faqat isbot talab qiladigan buyurtmaga: bitta yuklash, uning kaliti №10402 so'roviga.
    expect(api.uploads).toEqual(["proof/e2e-1.jpg"]);
    expect([...api.sells].sort((a, b) => a.id.localeCompare(b.id))).toEqual([
      { id: "10401", body: { comment: BULK_SOLD_COMMENT, extraCost: 0 } },
      { id: "10402", body: { comment: BULK_SOLD_COMMENT, extraCost: 0, proofFileKeys: ["proof/e2e-1.jpg"] } },
    ]);
    expect(api.leaked).toEqual([]);
  });
});
