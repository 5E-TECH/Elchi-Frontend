import { expect, test } from "@playwright/test";
import { mockCourierCancelApi, openSellDialog } from "./support/courierCancel";
import { expectToast } from "./support/toast";

/** Kuryer → «Sotish» — «Marketga to'langan summa» (uguUEhin, TC: T0UGh8bL) — 1440px. */

test.describe("Kuryer sotish oynasi — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ marketga to'langan summa so'rovga ketadi va natija bildirishnomasi chiqadi", async ({ page }) => {
    const { sells, leaked } = await mockCourierCancelApi(page);
    const dialog = await openSellDialog(page);

    await expect(dialog).toContainText("№10234 · Ipak Yo'li Savdo · Uygacha");
    await expect(dialog.getByText(/280\D000 so'mdan oshmasin/)).toBeVisible();
    const paid = dialog.getByLabel("Marketga to'langan summa");
    await paid.fill("100000");
    await expect(paid).toHaveValue("100 000");
    await dialog.getByRole("button", { name: "Sotish", exact: true }).click();

    await expect(dialog).toHaveCount(0);
    await expectToast(page, "Sotildi, marketga qisman to'landi", { tone: "success" });
    expect(sells).toEqual([{ id: "10234", body: { comment: "", extraCost: 0, paidAmount: 100000 }, status: 200 }]);
    expect(leaked).toEqual([]);
  });

  test("to'liq to'lansa — «to'liq to'landi»; bo'sh qoldirilsa `paidAmount` yuborilmaydi", async ({ page }) => {
    const { sells } = await mockCourierCancelApi(page);
    let dialog = await openSellDialog(page);
    await dialog.getByLabel("Marketga to'langan summa").fill("280000");
    await dialog.getByRole("button", { name: "Sotish", exact: true }).click();
    await expectToast(page, "Sotildi, marketga to'liq to'landi", { tone: "success" });

    dialog = await openSellDialog(page);
    await dialog.getByRole("button", { name: "Sotish", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(sells.map((s) => [s.id, s.body.paidAmount ?? null, s.status])).toEqual([
      ["10234", 280000, 200],
      ["10235", null, 200],
    ]);
  });

  test("chegaradan oshsa ogohlantiradi; backend 400 xabari ko'rinadi, oyna ochiq qoladi", async ({ page }) => {
    const { sells } = await mockCourierCancelApi(page);
    const dialog = await openSellDialog(page);
    await dialog.getByLabel("Marketga to'langan summa").fill("300000");
    await expect(dialog.getByRole("alert")).toHaveText(/Marketga to'lov 280\D000 so'mdan oshmasligi kerak/);
    await dialog.getByRole("button", { name: "Sotish", exact: true }).click();
    await expectToast(page, "paidAmount 280000 dan oshmasligi kerak", { tone: "error" });
    await expect(dialog).toBeVisible();
    expect(sells.map((s) => s.status)).toEqual([400]);
  });
});
