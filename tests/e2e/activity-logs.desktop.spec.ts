import { expect, test } from "@playwright/test";
import { IPV6, UA_ANDROID, mockActivityLogsApi, openActivityLogs } from "./support/activityLogs";

/** Faoliyat jurnali (y8CxCtcK) — 1440px, maketlar `superadmin-activity-logs-list`, `-row-expanded`. */
test.describe("Faoliyat jurnali — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });

  test("⭐ TC10: «Amal» ustunida `action_meta.label` v2 badge'da, ton `action_meta.tone` dan; ikona yo'q", async ({ page }) => {
    const { leaked } = await mockActivityLogsApi(page);
    await openActivityLogs(page);

    const table = page.getByRole("table", { name: "Faoliyat jurnali yozuvlari" });
    const expense = table.getByText("Qo'lda chiqim", { exact: true }).locator("..");
    await expect(expense).toHaveClass(/bg-danger-soft/);
    await expect(expense).toHaveClass(/text-danger-fg/);
    await expect(expense.locator("svg")).toHaveCount(0);
    await expect(table.getByText("Holat o'zgardi", { exact: true }).locator("..")).toHaveClass(/bg-sunken/);
    // Reyestrda yo'q eski fe'l — backend yorlig'i, UI sinmaydi; ismsiz aktyor — «#44 (topilmadi)».
    await expect(table.getByText("Order batch sent", { exact: true })).toBeVisible();
    await expect(table.getByText("#44 (topilmadi)")).toBeVisible();
    // Kim: ism + rol, Obyekt: «Buyurtma №10227», Xizmat: «Buyurtmalar».
    await expect(table.getByRole("row").filter({ hasText: "Jasur Tursunov" }).first()).toContainText("Kuryer");
    await expect(table.getByText("№10227").first()).toBeVisible();
    await expect(table.getByText("Buyurtmalar").first()).toBeVisible();
    expect(leaked).toEqual([]);
  });

  test("⭐ TC8: «Amal» filtri kategoriyalar bo'yicha guruhlangan; tanlansa faqat shu fe'l qatorlari qoladi", async ({ page }) => {
    const { requests } = await mockActivityLogsApi(page);
    await openActivityLogs(page);

    await page.getByRole("combobox", { name: "Amal" }).click();
    const listbox = page.getByRole("listbox", { name: "Amal" });
    await expect(listbox.getByRole("group")).toHaveCount(3);
    await expect(listbox.getByRole("group", { name: "Buyurtma" })).toContainText("Holat o'zgardi");
    await expect(listbox.getByRole("group", { name: "Moliya" })).toContainText("Qo'lda chiqim");
    await expect(listbox.getByRole("group", { name: "Kirish" })).toContainText("Tizimga kirdi");
    // Reyestrda yo'q fe'l — guruhsiz, humanize.
    await expect(listbox.getByRole("option", { name: "Order batch sent" })).toBeVisible();

    await listbox.getByRole("option", { name: "Qo'lda chiqim" }).click();
    await expect.poll(() => requests.at(-1)?.get("action")).toBe("finance.manual_expense");
    const table = page.getByRole("table", { name: "Faoliyat jurnali yozuvlari" });
    await expect(table.getByRole("row")).toHaveCount(2);
    await expect(table.getByText("Qo'lda chiqim", { exact: true })).toBeVisible();

    // Tozalash — boshlang'ich so'rov (keshdan ham bo'lishi mumkin): yana hamma qatorlar, «Amal: Barchasi».
    await page.getByRole("button", { name: "Filtrlarni tozalash" }).click();
    await expect(table.getByRole("row")).toHaveCount(5);
    await expect(page.getByRole("combobox", { name: "Amal" })).toContainText("Barchasi");
  });

  test("qator ochiladi: maydon o'zgarishlari va qo'shimcha ma'lumot; tafsiloti yo'q qatorda tugma yo'q", async ({ page }) => {
    await mockActivityLogsApi(page);
    await openActivityLogs(page);

    await page.getByRole("button", { name: "Buyurtma №10227 tafsilotini ochish" }).first().click();
    const changes = page.getByRole("table", { name: "Maydon o'zgarishlari" });
    await expect(changes).toContainText("Holat");
    await expect(changes.getByText("Yo'lda")).toHaveClass(/line-through/);
    await expect(changes).toContainText("Sotilgan");
    await expect(page.getByText("Kuryer ilovasi")).toBeVisible();
    await expect(page.getByRole("button", { name: "Kuzatuv ID ni nusxalash" })).toBeVisible();

    const loginRow = page.getByRole("row").filter({ hasText: "Tizimga kirdi" });
    await expect(loginRow.getByRole("button")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("⭐ f2Ud5tju TC11: «Qo'shimcha ma'lumot» — Manba, Filial, Qurilma, IP manzil (maket tartibi); kontekstsiz — «—»", async ({ page }) => {
    await mockActivityLogsApi(page);
    await openActivityLogs(page);

    await page.getByRole("button", { name: "Buyurtma №10227 tafsilotini ochish" }).click();
    const meta = page.getByRole("region", { name: "Qo'shimcha ma'lumot" });
    await expect(meta.getByRole("term")).toHaveText(["Manba", "Filial", "Qurilma", "IP manzil", "Kuzatuv ID"]);
    await expect(meta.getByRole("definition").nth(2)).toHaveText("Android");
    await expect(meta.getByRole("definition").nth(2)).toHaveAttribute("title", UA_ANDROID);
    await expect(meta.getByRole("definition").nth(3)).toHaveText("10.24.6.118");
    await expect(meta.getByText("3f1c9a2e-55b1-4b8e-9d0a-1f2e3d4c5b6a")).toHaveCount(0);

    // `device_name` yo'q — `user_agent` dan qisqa nom; IPv6.
    await page.getByRole("button", { name: "Buyurtma №10230 tafsilotini ochish" }).click();
    await expect(meta.getByRole("term")).toHaveText(["Manba", "Qurilma", "IP manzil", "Kuzatuv ID"]);
    await expect(meta.getByRole("definition")).toHaveText(["Ochiq API", "Windows · Edge", IPV6, /4f9c2a7e81d34b6a9e05c3d17a2b8f64/]);

    // Cron yozuvi: so'rov konteksti yo'q — «—», sun'iy qiymat yo'q.
    await page.getByRole("button", { name: /#5521 tafsilotini ochish/ }).click();
    await expect(meta.getByRole("term")).toHaveText(["Sabab", "Qurilma", "IP manzil"]);
    await expect(meta.getByRole("definition")).toHaveText(["Ofis ijarasi", "—", "—"]);
  });

  test("⭐ f2Ud5tju: admin ham ochadi — «Qurilma» ko'rinadi", async ({ page }) => {
    await mockActivityLogsApi(page, "admin");
    await openActivityLogs(page);
    await page.getByRole("button", { name: "Buyurtma №10227 tafsilotini ochish" }).click();
    await expect(page.getByRole("region", { name: "Qo'shimcha ma'lumot" }).getByText("Android", { exact: true })).toBeVisible();
  });

  test("⭐ f2Ud5tju: menejerga sahifa yopiq — «Bu sahifaga ruxsatingiz yo'q», jurnal so'ralmaydi", async ({ page }) => {
    const { requests } = await mockActivityLogsApi(page, "manager");
    await page.goto("/activity-logs");
    await expect(page).toHaveURL(/\/403$/, { timeout: 90_000 });
    await expect(page.getByText("Bu sahifaga ruxsatingiz yo'q")).toBeVisible();
    expect(requests).toHaveLength(0);
  });
});
