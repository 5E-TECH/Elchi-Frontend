import { expect, test } from "@playwright/test";
import {
  expectNoHorizontalOverflow,
  openInvestorHome,
  openInvestorPage,
  RAW_BACKEND_MESSAGE,
  shot,
} from "./support/investorHome";

/**
 * IN-2 — «Investitsiyalar» (`/investments`) va «Foyda tarixi» (`/profits`), desktop 1440 (maketlar
 * `investor-investments-list`, `-loading`, `-filtered-empty`, `investor-profits-list`, `-filtered-empty`).
 * API soxta (`support/investorHome.ts`), yozish so'rovlari yo'q.
 */

test.use({ viewport: { width: 1440, height: 900 } });

test("investitsiyalar: bosh sahifadan «Barchasi», jami, hissa ustuni, sana oralig'i va filtrni tozalash", async ({ page }) => {
  const mock = await openInvestorHome(page);
  await page.getByRole("link", { name: "Barcha investitsiyalar" }).click();
  await expect(page).toHaveURL(/\/investments$/);
  await expect(page.getByRole("heading", { level: 1, name: "Investitsiyalar" })).toBeVisible();

  const card = page.getByRole("region", { name: "Investitsiyalar ro'yxati" });
  await expect(card.getByText("Jami: 450 000 000 so'm · 5 ta")).toBeVisible({ timeout: 30_000 });
  const rows = card.getByRole("table").getByRole("row");
  await expect(rows).toHaveCount(6);
  await expect(rows.nth(1)).toHaveText("01.08.2026100 000 000 so'm22,2%");
  await expect(rows.nth(5)).toHaveText("15.01.2026120 000 000 so'm26,7%");
  await expect(card.getByRole("meter", { name: "Jamidagi hissasi" })).toHaveCount(5);
  await expect(card.getByText("1–5 / 5 ta investitsiya")).toBeVisible();
  await expect(card.getByRole("button", { name: /Sana oralig'i/ })).toContainText("Barcha vaqt");
  // Menyu: «Investitsiyalar» tanlangan.
  await expect(
    page.getByRole("navigation", { name: "Asosiy bo'limlar" }).getByRole("link", { name: "Investitsiyalar" }),
  ).toHaveAttribute("aria-current", "page");
  expect(mock.lists).toContain("investors/me/investments?page=1&limit=10");
  await expectNoHorizontalOverflow(page);
  await shot(page, "investor-investments--desktop-light");

  // Tez tanlov — URL'ga oraliq yoziladi, so'rov Toshkent kuni bo'yicha.
  await card.getByRole("button", { name: /Sana oralig'i/ }).click();
  await page.getByRole("button", { name: "Bu oy", exact: true }).click();
  await expect(page).toHaveURL(/\/investments\?from=\d{4}-\d{2}-01&to=\d{4}-\d{2}-\d{2}$/);
  await expect.poll(() => mock.lists.at(-1) ?? "").toMatch(/from_date=\d{4}-\d{2}-01T00%3A00%3A00%2B05%3A00/);
  await expect(card.getByText(/^Tanlangan oraliqda: /)).toBeVisible();
});

test("investitsiyalar: oraliqda bo'sh — «Bu oraliqda investitsiya yo'q», «Filtrni tozalash»; bir sahifada yig'indi", async ({ page }) => {
  await openInvestorPage(page, "/investments?from=2026-09-01&to=2026-09-30", "Investitsiyalar", { theme: "dark" });
  const card = page.getByRole("region", { name: "Investitsiyalar ro'yxati" });
  await expect(card.getByText("Bu oraliqda investitsiya yo'q")).toBeVisible({ timeout: 30_000 });
  await expect(card.getByText("Tanlangan oraliqda: 0 so'm · 0 ta")).toBeVisible();
  await expect(card.getByText(/Jami investitsiyangiz: 450 000 000 so'm\.$/)).toBeVisible();
  await expect(card.getByRole("button", { name: /Sana oralig'i/ })).toContainText("01.09 – 30.09.2026");
  await shot(page, "investor-investments-filtered-empty--desktop-dark");

  await card.getByRole("button", { name: "Filtrni tozalash" }).click();
  await expect(page).toHaveURL(/\/investments$/);
  await expect(card.getByText("Jami: 450 000 000 so'm · 5 ta")).toBeVisible();

  await page.goto("/investments?from=2026-04-01&to=2026-08-31");
  await expect(card.getByText("Tanlangan oraliqda: 250 000 000 so'm · 3 ta")).toBeVisible({ timeout: 30_000 });
  await expect(card.getByRole("table").getByRole("row")).toHaveCount(4);
});

test("foyda tarixi: bosh sahifadan «Barchasi», jamilar, «To'lov holati» filtri URL'da", async ({ page }) => {
  const mock = await openInvestorHome(page);
  await page.getByRole("link", { name: "Barcha foyda yozuvlari" }).click();
  await expect(page).toHaveURL(/\/profits$/);

  const card = page.getByRole("region", { name: "Foyda yozuvlari" });
  await expect(card.getByText("To'langan: 34 300 000 so'm")).toBeVisible({ timeout: 30_000 });
  await expect(card.getByText("Kutilmoqda: 6 200 000 so'm")).toBeVisible();
  const table = card.getByRole("table", { name: "Foyda yozuvlari" });
  await expect(table.getByRole("row")).toHaveCount(10);
  await expect(table.getByRole("row").nth(1)).toContainText("01.09 – 30.09.2026");
  await expect(table.getByRole("row").nth(1).getByText("Kutilmoqda")).toBeVisible();
  await expect(card.getByText("1–9 / 9 ta yozuv")).toBeVisible();
  await expect(card.getByRole("radio", { name: "Barchasi" })).toHaveAttribute("aria-checked", "true");
  await shot(page, "investor-profits--desktop-light");

  await card.getByRole("radio", { name: "Kutilmoqda" }).click();
  await expect(page).toHaveURL(/\/profits\?status=pending$/);
  await expect(table.getByRole("row")).toHaveCount(2);
  expect(mock.lists).toContain("investors/me/profits?page=1&limit=10&is_paid=false");

  await card.getByRole("radio", { name: "To'langan" }).click();
  await expect(page).toHaveURL(/\/profits\?status=paid$/);
  await expect(table.getByRole("row")).toHaveCount(9);
  // Jamilar filtrga bog'liq emas.
  await expect(card.getByText("Kutilmoqda: 6 200 000 so'm")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(mock.leaked).toEqual([]);
});

test("foyda tarixi: «Kutilmoqda» bo'yicha bo'sh — maket matni va «Filtrni tozalash»", async ({ page }) => {
  await openInvestorPage(page, "/profits?status=pending", "Foyda tarixi", { empty: true });
  await expect(page.getByText("Kutilayotgan foyda yo'q")).toBeVisible({ timeout: 30_000 });
  await shot(page, "investor-profits-filtered-empty--desktop-light");
  await page.getByRole("button", { name: "Filtrni tozalash" }).click();
  await expect(page).toHaveURL(/\/profits$/);
  await expect(page.getByText("Hali foyda yozuvi yo'q")).toBeVisible();
});

test("404 — butun sahifa holati («Qayta urinish», «Chiqish»); backend matni ko'rinmaydi", async ({ page }) => {
  await openInvestorPage(page, "/investments", "Investitsiyalar", { status: 404 });
  await expect(page.getByRole("heading", { level: 2, name: "Investor profili hali bog'lanmagan" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "Chiqish" })).toBeVisible();
  await expect(page.getByText(RAW_BACKEND_MESSAGE)).toHaveCount(0);
});

test("500 — «Foyda tarixini yuklab bo'lmadi» + «Qayta urinish»; backend matni ko'rinmaydi", async ({ page }) => {
  await openInvestorPage(page, "/profits", "Foyda tarixi", { status: 500 });
  await expect(page.getByText("Foyda tarixini yuklab bo'lmadi")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Qayta urinish" })).toBeVisible();
  await expect(page.getByText(RAW_BACKEND_MESSAGE)).toHaveCount(0);
});
