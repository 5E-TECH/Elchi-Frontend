import { expect, test } from "@playwright/test";
import { OVERPAID_RESPONSE, mainHorizontalOverflow, mockSettlementApi, openSettlement } from "./support/integrationSettlement";

/** Integratsiya → Hisob-kitob (IS-1) — 390px: gorizontal skroll yo'q, oyna pastdan, tugmalar ≥ 44px. */
test.describe("Integratsiya — Hisob-kitob, 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("«Qoldiq» sig'adi, to'lov oynasi pastki varaqa, tugmalar ≥ 44px", async ({ page }) => {
    const { leaked } = await mockSettlementApi(page);
    await openSettlement(page);

    const balance = page.getByRole("region", { name: "Qoldiq" });
    await expect(balance).toContainText(/To'lanishi kerak\s*4\s510\s000/);
    expect(await mainHorizontalOverflow(page)).toBeLessThanOrEqual(0);

    const payButton = balance.getByRole("button", { name: "To'lov olindi" });
    expect((await payButton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await payButton.click();

    const dialog = page.getByRole("dialog", { name: "Tashuvchidan olingan to'lov" });
    await expect(dialog).toBeVisible();
    const viewport = page.viewportSize()!;
    // Varaqa pastdan siljib chiqadi — joyiga tushguncha kutamiz.
    await expect
      .poll(async () => {
        const box = (await dialog.boundingBox())!;
        return Math.abs(box.y + box.height - viewport.height);
      })
      .toBeLessThanOrEqual(1);
    expect((await dialog.boundingBox())!.width).toBeGreaterThanOrEqual(viewport.width - 1);
    for (const name of ["Orqaga", "Yozish"]) {
      expect((await dialog.getByRole("button", { name }).boundingBox())!.height, name).toBeGreaterThanOrEqual(44);
    }
    expect(leaked).toEqual([]);
  });

  test("IS-2: «To'lov №82» kartada, ortiqcha summa va natija oynasi pastki varaqa, tugmalar ≥ 44px", async ({ page }) => {
    const { leaked } = await mockSettlementApi(page, { remittanceResponse: OVERPAID_RESPONSE });
    await openSettlement(page);
    await expect(page.getByText(/TY-447738 · To'lov №82 · /)).toBeVisible();
    expect(await mainHorizontalOverflow(page)).toBeLessThanOrEqual(0);

    await page.getByRole("button", { name: "To'lov olindi" }).click();
    const dialog = page.getByRole("dialog", { name: "Tashuvchidan olingan to'lov" });
    await expect(dialog).toContainText(/to'lanishi kerak 4\s510\s000 so'm/);
    await dialog.getByRole("textbox", { name: /Summa/ }).fill("5000000");
    await expect(dialog).toContainText("Ortig'i hamkor avansiga o'tadi");
    const equalize = dialog.getByRole("button", { name: /tenglash/ });
    expect((await equalize.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await dialog.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    await dialog.getByRole("button", { name: "Yozish" }).click();

    const result = page.getByRole("dialog", { name: "To'lov yozildi" });
    await expect(result).toBeVisible();
    const viewport = page.viewportSize()!;
    await expect
      .poll(async () => {
        const box = (await result.boundingBox())!;
        return Math.abs(box.y + box.height - viewport.height);
      })
      .toBeLessThanOrEqual(1);
    expect((await result.boundingBox())!.width).toBeGreaterThanOrEqual(viewport.width - 1);
    expect(await result.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    const openCashbox = result.getByRole("link", { name: "Asosiy kassani ochish" });
    expect((await openCashbox.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await result.getByRole("button", { name: "Tayyor" }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(leaked).toEqual([]);
  });

  test("IS-3: «Olingan to'lovlar» kartalari, bekor qilish oynasi pastki varaqa, tugmalar ≥ 44px", async ({ page }) => {
    const { cancels, leaked } = await mockSettlementApi(page);
    await openSettlement(page);
    const section = page.getByRole("region", { name: "Olingan to'lovlar" });
    await expect(section.getByText("To'lov topshiriqnomasi №4518 · Oktyabr, 2-hafta COD")).toBeVisible();
    await expect(section.getByText("Kassadan qaytarildi")).toBeVisible();
    expect(await mainHorizontalOverflow(page)).toBeLessThanOrEqual(0);
    for (const name of ["Faol", "Bekor qilingan", "Barchasi"]) {
      expect((await section.getByRole("button", { name, exact: true }).boundingBox())!.height, name).toBeGreaterThanOrEqual(44);
    }
    const cancelButton = section.getByRole("button", { name: "№82 to'lovini bekor qilish" });
    expect((await cancelButton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await cancelButton.click();

    const dialog = page.getByRole("alertdialog", { name: "To'lovni bekor qilasizmi?" });
    await expect(dialog).toBeVisible();
    const viewport = page.viewportSize()!;
    await expect
      .poll(async () => {
        const box = (await dialog.boundingBox())!;
        return Math.abs(box.y + box.height - viewport.height);
      })
      .toBeLessThanOrEqual(1);
    expect(await dialog.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    for (const name of ["Orqaga", "To'lovni bekor qilish"]) {
      expect((await dialog.getByRole("button", { name }).boundingBox())!.height, name).toBeGreaterThanOrEqual(44);
    }
    await dialog.getByRole("textbox", { name: /Sabab/ }).fill("Summa ikki marta kiritilgan");
    await dialog.getByRole("button", { name: "To'lovni bekor qilish" }).click();
    await expect(dialog).toHaveCount(0);
    expect(cancels).toHaveLength(1);
    expect(leaked).toEqual([]);
  });
});
