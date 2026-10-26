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
    // 3HKvAyhm: menejer ham filial nomlarini ko'radi (tafsilot `source_branch` / `destination_branch`), «Tarix» — /history.
    const info = page.getByRole("region", { name: "Paket ma'lumotlari" });
    await expect(info).toContainText("Urgut filiali");
    await expect(info).toContainText("Toshkent HQ");
    const history = page.getByRole("region", { name: "Tarix" });
    await expect(history.getByRole("listitem")).toHaveCount(1);
    await expect(history).toContainText("Paket yaratildi");
    await expect(history).toContainText("Ravshan Ortiqov");
    const orders = page.getByRole("region", { name: "Paketdagi buyurtmalar" });
    await orders.getByRole("checkbox", { name: "№10166 ni tanlash" }).check();
    await orders.getByRole("checkbox", { name: "№10163 ni tanlash" }).check();
    await expect(orders.getByText("2 ta buyurtma tanlandi")).toBeVisible();

    await page.getByRole("button", { name: "HQ'ga yuborish — 2 ta" }).click();
    await expect(page.getByText("Paket HQ'ga yuborildi", { exact: true })).toBeVisible();
    expect(sends).toEqual([{ path: "transfer-batches/172/send", body: { orderIds: ["10166", "10163"] } }]);
    await expect(orders.getByRole("checkbox", { name: "№10166 ni tanlash" })).toHaveCount(0);
    await expect(orders.getByRole("checkbox", { name: "№10165 ni tanlash" })).toBeVisible();
    // Jo'natishdan keyin tarix yangilanadi — eng yangisi tepada.
    await expect(history.getByRole("listitem")).toHaveCount(2);
    await expect(history.getByRole("listitem").first()).toContainText("Paket Toshkent HQ'ga jo'natildi");

    // «← Paketlar» — kelgan tabga (holat `fromSearch`), yon menyudagi «Paketlar» emas.
    const back = page.locator('[data-shell-slot="content"]').getByRole("link", { name: "Paketlar", exact: true });
    await expect(back).toHaveAttribute("href", "/batches?tab=new");
    await back.click();
    await expect(page).toHaveURL(/\/batches\?tab=new$/);
    expect(leaked).toEqual([]);
  });

  test("qaytarishlar («Sana: Bugun» URL'da) → paket tafsiloti, «← Qaytarishlar» filtr bilan", async ({ page }) => {
    const { leaked, listQueries } = await mockBatchesApi(page);
    await page.goto("/returns?period=today");
    await expect(page.getByRole("heading", { level: 1, name: "Qaytarishlar" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Urgut filialidan chiqqan qaytarish paketlari/)).toBeVisible();
    // Sana filtri (F2): `period` | `date`, hech qachon `from`/`to`.
    await expect(page.getByRole("button", { name: /^Sana / })).toContainText("Bugun");
    expect(
      listQueries.some(
        (query) => query.includes("direction=RETURN") && query.includes("source_branch_id=7") && query.includes("period=today"),
      ),
    ).toBe(true);
    expect(listQueries.every((query) => !/[?&](from|to)=/.test(query))).toBe(true);

    await page.getByRole("link", { name: "B-171 paketini ochish" }).click();
    await expect(page).toHaveURL(/\/batches\/171$/);
    await expect(
      page.locator('[data-shell-slot="content"]').getByRole("link", { name: "Qaytarishlar", exact: true }),
    ).toHaveAttribute("href", "/returns?period=today");
    expect(leaked).toEqual([]);
  });
});
