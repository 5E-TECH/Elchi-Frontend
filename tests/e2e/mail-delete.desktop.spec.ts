import { expect, test } from "@playwright/test";
import { mockMailDeleteApi, openMailDetail } from "./support/mailDelete";

/** Pochta tafsiloti → savat (yokjwjXG) — superadmin, 1440px. Backend soxta. */
test.describe("Pochtadan o'chirish — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ TC1: savat → sabab → POST /post/delete 200, qator yo'qoladi, 403 yo'q, /post/cancel chaqirilmaydi", async ({ page }) => {
    const { deletes, leaked } = await mockMailDeleteApi(page);
    await openMailDetail(page);

    const remove = page.getByRole("button", { name: "№1251 ni pochtadan o'chirish" }).first();
    await expect(remove).toBeVisible();
    await remove.click();

    const dialog = page.getByRole("alertdialog", { name: "1 ta buyurtmani pochtadan o'chirish" });
    await expect(dialog).toContainText("Buyurtma pochtadan butunlay o'chiriladi, qaytarib bo'lmaydi.");
    const confirm = dialog.getByRole("button", { name: "Ha, o'chirish" });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(/^Sabab/).fill("Market buyurtmani qaytarib oldi");
    const response = page.waitForResponse((r) => r.url().endsWith("/post/delete") && r.request().method() === "POST");
    await confirm.click();
    expect((await response).status()).toBe(200);

    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("1 ta buyurtma pochtadan o'chirildi")).toBeVisible();
    await expect(page.getByText("Aliyev Vali")).toHaveCount(0);
    await expect(page.getByText("Karimova Nodira").first()).toBeVisible();
    expect(deletes).toEqual([
      { body: { post_id: "74", order_ids: ["1251"], reason: "Market buyurtmani qaytarib oldi" }, status: 200 },
    ]);
    expect(leaked).toEqual([]);
  });

  test("409 — sabab oynada ko'rinadi, oyna ochiq qoladi", async ({ page }) => {
    const { deletes } = await mockMailDeleteApi(page, { conflictIds: ["1251"] });
    await openMailDetail(page);
    await page.getByRole("button", { name: "№1251 ni pochtadan o'chirish" }).first().click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByLabel(/^Sabab/).fill("Xato qo'shilgan");
    await dialog.getByRole("button", { name: "Ha, o'chirish" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("#1251 — buyurtma kuryer qo'lida");
    await expect(dialog).toBeVisible();
    await expect(page.getByText("Aliyev Vali").first()).toBeVisible();
    expect(deletes.map((d) => d.status)).toEqual([409]);
  });

  test("hammasini tanlab o'chirsa — pochta bo'shaydi va ro'yxatga qaytadi", async ({ page }) => {
    const { deletes } = await mockMailDeleteApi(page);
    await openMailDetail(page);
    await page.getByText("Barchasini tanlash", { exact: true }).click();
    const bar = page.getByTestId("mail-delete-selected");
    await expect(bar).toContainText("3 ta tanlandi");
    await bar.getByRole("button", { name: "Tanlanganlarni o'chirish" }).click();
    const dialog = page.getByRole("alertdialog", { name: "3 ta buyurtmani pochtadan o'chirish" });
    await dialog.getByLabel(/^Sabab/).fill("Pochta bekor qilindi");
    await dialog.getByRole("button", { name: "Ha, o'chirish" }).click();
    await expect(page).toHaveURL(/\/mails\/today$/);
    expect(deletes[0].body).toEqual({ post_id: "74", order_ids: ["1251", "1252", "1253"], reason: "Pochta bekor qilindi" });
  });

  test("jo'natilgan pochtada (status ≠ new) savat yo'q", async ({ page }) => {
    await mockMailDeleteApi(page, { postStatus: "sent" });
    await openMailDetail(page);
    await expect(page.getByRole("button", { name: /pochtadan o'chirish/ })).toHaveCount(0);
  });
});
