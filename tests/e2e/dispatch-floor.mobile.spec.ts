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
});
