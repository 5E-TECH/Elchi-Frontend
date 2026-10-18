import { expect, test } from "@playwright/test";
import { IPV6, mockActivityLogsApi, openActivityLogs } from "./support/activityLogs";

/** Faoliyat jurnali (y8CxCtcK) — 390px: ro'yxat qatorlari, «Filtrlar» pastki varaqasi, gorizontal skroll yo'q. */
test.describe("Faoliyat jurnali — 390px", () => {
  test.describe.configure({ timeout: 120_000 });

  test("⭐ jadval o'rniga ro'yxat; «Filtrlar» varaqasida «Amal» guruhlangan va qo'llanadi; nishonlar ≥ 44px", async ({ page }) => {
    const { requests, leaked } = await mockActivityLogsApi(page);
    await openActivityLogs(page);

    await expect(page.getByRole("table", { name: "Faoliyat jurnali yozuvlari" })).toHaveCount(0);
    const list = page.getByRole("list", { name: "Faoliyat jurnali yozuvlari" });
    await expect(list.getByRole("listitem")).toHaveCount(4);
    await expect(list.getByText("Qo'lda chiqim", { exact: true }).locator("..")).toHaveClass(/bg-danger-soft/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const toggle = list.getByRole("button", { name: "Buyurtma №10227 tafsilotini ochish" }).first();
    expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await toggle.click();
    await expect(page.getByRole("table", { name: "Maydon o'zgarishlari" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.getByRole("button", { name: "Filtrlar" }).click();
    const sheet = page.getByRole("dialog", { name: "Filtrlar" });
    await sheet.getByRole("combobox", { name: "Amal" }).click();
    const listbox = page.getByRole("listbox", { name: "Amal" });
    await expect(listbox.getByRole("group", { name: "Moliya" })).toContainText("Qo'lda chiqim");
    await listbox.getByRole("option", { name: "Qo'lda chiqim" }).click();
    await sheet.getByRole("button", { name: "Natijalarni ko'rsatish" }).click();

    await expect.poll(() => requests.at(-1)?.get("action")).toBe("finance.manual_expense");
    await expect(list.getByRole("listitem")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Filtrlar 1", exact: true })).toBeVisible();
    expect(leaked).toEqual([]);
  });

  test("⭐ f2Ud5tju TC12: «Qo'shimcha ma'lumot» (Qurilma, IP manzil) 390px ga sig'adi, gorizontal skroll yo'q", async ({ page }) => {
    await mockActivityLogsApi(page);
    await openActivityLogs(page);
    const list = page.getByRole("list", { name: "Faoliyat jurnali yozuvlari" });
    const width = page.viewportSize()!.width;

    for (const [target, device, ip] of [
      ["Buyurtma №10227", "Android", "10.24.6.118"],
      ["Buyurtma №10230", "Windows · Edge", IPV6],
    ] as const) {
      await list.getByRole("button", { name: `${target} tafsilotini ochish` }).click();
      const meta = page.getByRole("region", { name: "Qo'shimcha ma'lumot" });
      await expect(meta.getByText("Qurilma", { exact: true })).toBeVisible();
      await expect(meta.getByText(device, { exact: true })).toBeVisible();
      await expect(meta.getByText(ip, { exact: true })).toBeVisible();
      for (const value of [meta.getByText(device, { exact: true }), meta.getByText(ip, { exact: true }), meta]) {
        const box = (await value.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  });
});
