import { expect, test } from "@playwright/test";
import {
  BULK_CANCEL_COMMENT,
  BULK_SOLD_COMMENT,
  hidScan,
  markResult,
  mockCourierBulkApi,
  mockDispatchApi,
  openCourierBulk,
  openDispatch,
} from "./support/floor";
import { toast } from "./support/toast";

/** G3 «Biriktirish» va «Tezkor amal» (dizayn v2) — 1440px: skan → tanlash → kuryer oynasi; belgilash → tasdiq → so'rovlar. */
test.describe("Biriktirish va Tezkor amal — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ /dispatch: USB skan qo'shadi va tanlaydi, takror — ogohlantirish; kuryer oynasi → POST faqat tanlanganlar", async ({ page }) => {
    const api = await mockDispatchApi(page);
    await openDispatch(page);
    await expect.poll(() => api.courierQueries[0]).toEqual({ page: "1", limit: "100", status: "active" });

    for (const token of ["tok-10285", "tok-10316", "tok-10342"]) {
      await hidScan(page, token);
      await expect(page.getByRole("checkbox", { name: `№${token.slice(4)} ni tanlash` })).toBeChecked();
    }
    await expect(page.getByText("3 ta buyurtma tanlandi")).toBeVisible();

    await hidScan(page, "tok-10285");
    await expect(page.getByText("Bu buyurtma allaqachon ro'yxatga qo'shilgan")).toBeVisible();
    expect(api.lookups).toEqual(["tok-10285", "tok-10316", "tok-10342"]);

    await page.getByRole("checkbox", { name: "№10342 ni tanlash" }).uncheck();
    await page.getByRole("button", { name: "Kuryerga biriktirish — 2 ta" }).click();

    const dialog = page.getByRole("dialog", { name: "Kuryerni tanlang" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("2 ta buyurtma shu kuryerga biriktiriladi");
    const submit = dialog.getByRole("button", { name: "Biriktirish — 2 ta" });
    await expect(submit).toBeDisabled();
    await dialog.getByRole("radio", { name: /Jasur Karimov/ }).click();
    await expect(submit).toBeEnabled();
    const request = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/orders/assign-to-courier"));
    await submit.click();
    await request;

    await expect(dialog).toHaveCount(0);
    await expect(toast(page, "2 ta buyurtma Jasur Karimovga biriktirildi")).toBeVisible();
    expect(api.assigns).toEqual([{ courier_id: "264", order_ids: ["10285", "10316"] }]);
    // Biriktirilganlar ro'yxatdan chiqadi, tanlanmagani qoladi.
    await expect(page.getByRole("checkbox", { name: "№10285 ni tanlash" })).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: "№10342 ni tanlash" })).not.toBeChecked();
    expect(api.leaked).toEqual([]);
  });

  test("⭐ /courier-bulk: Bekor / Ertaga belgilari → «Kunni yakunlash» tasdig'i → faqat sotish va bekor so'rovlari", async ({ page }) => {
    const api = await mockCourierBulkApi(page);
    await openCourierBulk(page);
    expect(api.listQueries[0]).toMatchObject({ status: "waiting", page: "1", limit: "100" });

    await markResult(page, "Ali Valiyev", "Bekor");
    await markResult(page, "Dilnoza Rahimova", "Ertaga");

    const finalize = page.getByRole("button", { name: "Kunni yakunlash" });
    await finalize.click();
    let confirm = page.getByRole("alertdialog", { name: "Kunni yakunlashni tasdiqlang" });
    await expect(confirm).toContainText("3 ta buyurtma: quyidagilar bajariladi");
    await confirm.getByRole("button", { name: "Orqaga" }).click();
    await expect(confirm).toHaveCount(0);
    expect([...api.sells, ...api.cancels]).toEqual([]);

    await finalize.click();
    confirm = page.getByRole("alertdialog", { name: "Kunni yakunlashni tasdiqlang" });
    await confirm.getByRole("button", { name: "Tasdiqlash" }).click();

    await expect(toast(page, "Kun yakunlandi")).toBeVisible();
    expect(api.sells).toEqual([{ id: "10401", body: { comment: BULK_SOLD_COMMENT, extraCost: 0 } }]);
    expect(api.cancels).toEqual([{ id: "10402", body: { comment: BULK_CANCEL_COMMENT, extraCost: 0 } }]);
    // «Ertaga» — so'rovsiz, ro'yxatda qoladi.
    await expect(page.getByRole("radiogroup", { name: "Dilnoza Rahimova: natija" })).toBeVisible();
    expect(api.leaked).toEqual([]);
  });
});
