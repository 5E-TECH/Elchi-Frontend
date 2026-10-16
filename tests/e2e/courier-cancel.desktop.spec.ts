import { expect, test } from "@playwright/test";
import { chooseCancelReason, mockCourierCancelApi, openCancelDialog } from "./support/courierCancel";

/** Kuryer → «Bekor qilish» — sabab majburiy (GNWDKvmZ, TC: PUvKXWVw) — 1440px. */
test.describe("Kuryer bekor qilish oynasi — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ sabab tanlanmaguncha «Bekor qilish» o'chiq; tanlansa POST { reason } → oyna yopiladi", async ({ page }) => {
    const { cancels, leaked } = await mockCourierCancelApi(page);
    const dialog = await openCancelDialog(page);

    await expect(dialog).toContainText("№10234 · Ipak Yo'li Savdo · Uygacha");
    // uguUEhin: bekor qilishda «To'langan summa» yo'q.
    await expect(dialog.getByLabel("To'langan summa")).toHaveCount(0);
    const submit = dialog.getByRole("button", { name: "Bekor qilish", exact: true });
    await expect(submit).toBeDisabled();

    await chooseCancelReason(page, dialog, "Mijoz rad etdi");
    await expect(submit).toBeEnabled();
    const request = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/orders/cancel/10234"));
    await submit.click();
    await request;

    await expect(dialog).toHaveCount(0);
    expect(cancels).toEqual([
      { id: "10234", body: { reason: "CUSTOMER_REFUSED", comment: "", extraCost: 0 }, status: 200 },
    ]);
    expect(leaked).toEqual([]);
  });

  test("⭐ «Boshqa» — izohsiz o'chiq, izoh yozilgach yuboriladi", async ({ page }) => {
    const { cancels } = await mockCourierCancelApi(page);
    const dialog = await openCancelDialog(page);
    const submit = dialog.getByRole("button", { name: "Bekor qilish", exact: true });

    await chooseCancelReason(page, dialog, "Boshqa");
    await expect(dialog.getByText("«Boshqa» tanlanganda izoh majburiy")).toBeVisible();
    await expect(submit).toBeDisabled();

    await dialog.getByLabel(/^Izoh/).fill("Mijoz boshqa shaharga ko'chgan");
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(dialog).toHaveCount(0);
    expect(cancels.map((c) => [c.body.reason, c.body.comment, c.status])).toEqual([
      ["OTHER", "Mijoz boshqa shaharga ko'chgan", 200],
    ]);
  });

  test("Escape va «Orqaga» — hech narsa yuborilmaydi", async ({ page }) => {
    const { cancels } = await mockCourierCancelApi(page);
    let dialog = await openCancelDialog(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    dialog = await openCancelDialog(page);
    await dialog.getByRole("button", { name: "Orqaga" }).click();
    await expect(dialog).toHaveCount(0);
    expect(cancels).toEqual([]);
  });
});
