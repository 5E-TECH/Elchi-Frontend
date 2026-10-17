import { expect, test } from "@playwright/test";
import { mockBatchesApi, openBatches } from "./support/batches";

/** Paketlar — menejer (HQ), 1440px: ro'yxat → tafsilot → tanlanganlarni HQ'ga yuborish → orqaga. */
test.describe("Paketlar — HQ'ga yuborish, 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ ikkita buyurtma tanlanadi → PATCH { orderIds }, yuborilganlar ro'yxatdan chiqadi", async ({ page }) => {
    const { leaked, sends, listQueries } = await mockBatchesApi(page);
    await openBatches(page, "/batches?tab=new");

    const table = page.getByRole("table", { name: "Paketlar ro'yxati" });
    await expect(table.getByRole("link", { name: "B-172", exact: true })).toBeVisible();
    expect(listQueries.some((query) => query.includes("status=PENDING") && query.includes("direction=FORWARD"))).toBe(true);
    await table.getByRole("link", { name: "B-172 paketini ochish" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Paket B-172" })).toBeVisible();
    const orders = page.getByRole("region", { name: "Paketdagi buyurtmalar" });
    await orders.getByRole("checkbox", { name: "№10166 ni tanlash" }).check();
    await orders.getByRole("checkbox", { name: "№10163 ni tanlash" }).check();
    await expect(orders.getByText("2 ta buyurtma tanlandi")).toBeVisible();

    await page.getByRole("button", { name: "HQ'ga yuborish — 2 ta" }).click();
    await expect(page.getByText("Paket HQ'ga yuborildi", { exact: true })).toBeVisible();
    expect(sends).toEqual([{ path: "transfer-batches/172/send", body: { orderIds: ["10166", "10163"] } }]);
    await expect(orders.getByRole("checkbox", { name: "№10166 ni tanlash" })).toHaveCount(0);
    await expect(orders.getByRole("checkbox", { name: "№10165 ni tanlash" })).toBeVisible();

    // «← Paketlar» — kelgan tabga (holat `fromSearch`), yon menyudagi «Paketlar» emas.
    const back = page.locator('[data-shell-slot="content"]').getByRole("link", { name: "Paketlar", exact: true });
    await expect(back).toHaveAttribute("href", "/batches?tab=new");
    await back.click();
    await expect(page).toHaveURL(/\/batches\?tab=new$/);
    expect(leaked).toEqual([]);
  });

  test("qaytarishlar → paket tafsiloti, «← Qaytarishlar»", async ({ page }) => {
    const { leaked, listQueries } = await mockBatchesApi(page);
    await page.goto("/returns");
    await expect(page.getByRole("heading", { level: 1, name: "Qaytarishlar" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Urgut filialidan chiqqan qaytarish paketlari/)).toBeVisible();
    expect(listQueries.some((query) => query.includes("direction=RETURN") && query.includes("source_branch_id=7"))).toBe(true);

    await page.getByRole("link", { name: "B-171 paketini ochish" }).click();
    await expect(page).toHaveURL(/\/batches\/171$/);
    await expect(
      page.locator('[data-shell-slot="content"]').getByRole("link", { name: "Qaytarishlar", exact: true }),
    ).toHaveAttribute("href", "/returns");
    expect(leaked).toEqual([]);
  });
});
