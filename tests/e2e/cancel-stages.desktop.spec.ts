import { expect, test } from "@playwright/test";
import {
  AT_HQ_TRACKING,
  HANDED_TRACKING,
  MANAGER,
  mockCancelStagesApi,
  ORDER_AT_HQ,
  ORDER_HANDED,
  ORDER_IN_TRANSIT,
} from "./support/cancelStages";

/**
 * BEKOR HOLATLARI (1-bosqich, backendsiz) — 1440px. Maketlar: `superadmin-orders-list-cancelled`,
 * `manager-orders-detail-cancelled`, `superadmin-orders-detail-cancelled`, `tizim-states-data` §09.
 * Ega javoblari (2026-10-19): «Bekor · HQ'da» + joy nomi ikkinchi qatorda; «Marketga topshirildi» — neytral.
 */
test.describe("Bekor bosqichi — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ ro'yxat: «Bekor · HQ'da» + «Toshkent HQ · 2 kun», «Bekor · yo'lda» + «→ Toshkent HQ», «Marketga topshirildi»", async ({
    page,
  }) => {
    const { leaked } = await mockCancelStagesApi(page, { list: [ORDER_AT_HQ, ORDER_IN_TRANSIT, ORDER_HANDED] });
    await page.goto("/orders");
    const table = page.getByRole("table");
    await expect(table.getByRole("link", { name: "№10235" })).toBeVisible({ timeout: 60_000 });

    const hqRow = table.getByRole("row").filter({ has: page.getByRole("link", { name: "№10235" }) });
    await expect(hqRow.getByText("Bekor · HQ'da")).toBeVisible();
    await expect(hqRow.getByTestId("cancel-return-place")).toHaveText("Toshkent HQ · 2 kun");

    const transitRow = table.getByRole("row").filter({ has: page.getByRole("link", { name: "№10231" }) });
    await expect(transitRow.getByText("Bekor · yo'lda")).toBeVisible();
    await expect(transitRow.getByTestId("cancel-return-place")).toHaveText("→ Toshkent HQ");

    const handedRow = table.getByRole("row").filter({ has: page.getByRole("link", { name: "№10241" }) });
    const handed = handedRow.getByText("Marketga topshirildi", { exact: true });
    await expect(handed).toBeVisible();
    // Neytral (kulrang) — qizil emas.
    await expect(handed).toHaveClass(/bg-sunken/);
    await expect(handed).not.toHaveClass(/danger/);
    await expect(table.getByText("Bekor qilingan", { exact: true })).toHaveCount(0);
    expect(leaked).toEqual([]);
  });

  test("⭐ «Holat» filtrida «Marketga topshirildi» → `status=returned_to_market`", async ({ page }) => {
    const { listQueries } = await mockCancelStagesApi(page, { list: [ORDER_HANDED] });
    await page.goto("/orders?status=returned_to_market");
    await expect(page.getByRole("link", { name: "№10241" })).toBeVisible({ timeout: 60_000 });
    expect(listQueries.some((query) => query.getAll("status").includes("returned_to_market"))).toBe(true);
    await expect(page.getByText("Holat: Marketga topshirildi")).toBeVisible();
  });

  test("⭐ menejer tafsiloti: «Bekor · HQ'da», «Qaytarish yo'li» 3 qadam + «Marketga topshirish» kutilmoqda", async ({ page }) => {
    const { leaked } = await mockCancelStagesApi(page, {
      profile: MANAGER,
      details: [ORDER_AT_HQ],
      tracking: { "10235": AT_HQ_TRACKING },
    });
    await page.goto("/orders/edit/10235");
    // Sahifa sarlavhasi (`PageHeader`, `main` ichidagi `header`; `banner` — shell topbar).
    const header = page.locator("main header").first();
    await expect(header.getByText("Bekor · HQ'da")).toBeVisible({ timeout: 60_000 });
    await expect(header.getByTestId("detail-stage-place")).toHaveText("Toshkent HQ · 2 kun");
    await expect(page.getByText("Buyurtma bekor qilingan — mijoz, manzil, summa va mahsulotlarni o'zgartirib bo'lmaydi.")).toBeVisible();

    const card = page.getByTestId("order-return-path");
    await expect(card.getByRole("heading", { name: "Qaytarish yo'li" })).toBeVisible();
    const steps = card.getByTestId("return-path-step");
    await expect(steps).toHaveCount(3);
    await expect(steps.nth(0)).toContainText("Bekor qilindi");
    await expect(steps.nth(0)).toContainText("Kuryer Akmal Rahimov · Sergeli tumani");
    await expect(steps.nth(0)).toContainText("Sabab: mijoz rad etdi");
    await expect(steps.nth(1)).toContainText("Kuryer Akmal Rahimov → Toshkent HQ");
    await expect(steps.nth(1)).toContainText("Pochta №2098");
    await expect(steps.nth(2)).toContainText("Toshkent HQ · Ro'yxatchi Bobur Xolmatov");
    await expect(card.getByTestId("return-path-pending")).toContainText(
      "Baraka Shop olib ketishi kutilmoqda · Toshkent HQ · 2 kun",
    );
    // «Hozir kimda» bosqich bilan birlashgan.
    await expect(page.getByTestId("meta-holder")).toContainText("Bekor · HQ'da — Toshkent HQ · 2 kun");
    // Tarixda joy nomi (desktopda tarix ochiq): «… bekor qilingan buyurtmani qabul qildi — Toshkent HQ».
    await expect(page.getByTestId("tracking-event").filter({ hasText: "qabul qildi — Toshkent HQ" })).toContainText(
      "Ro'yxatchi Bobur Xolmatov bekor qilingan buyurtmani qabul qildi — Toshkent HQ",
    );
    expect(leaked).toEqual([]);
  });

  test("⭐ superadmin tafsiloti: «Marketga topshirildi» (neytral) · «Toshkent HQ · … · QR orqali», zanjir yopildi", async ({ page }) => {
    const { leaked } = await mockCancelStagesApi(page, {
      details: [ORDER_HANDED],
      tracking: { "10241": HANDED_TRACKING },
    });
    await page.goto("/orders/edit/10241");
    // Sahifa sarlavhasi (`PageHeader`, `main` ichidagi `header`; `banner` — shell topbar).
    const header = page.locator("main header").first();
    const badge = header.getByText("Marketga topshirildi", { exact: true });
    await expect(badge).toBeVisible({ timeout: 60_000 });
    await expect(badge).toHaveClass(/bg-sunken/);
    await expect(header.getByTestId("detail-stage-place")).toHaveText(/^Toshkent HQ · 07\.10\.2026, \d{2}:\d{2} · QR orqali$/);
    await expect(page.getByText("Buyurtma marketga topshirilgan — mijoz, manzil, summa va mahsulotlarni o'zgartirib bo'lmaydi.")).toBeVisible();

    const card = page.getByTestId("order-return-path");
    await expect(card).toContainText("Zanjir yopildi — posilka marketga qaytdi");
    await expect(card.getByTestId("return-path-step")).toHaveCount(4);
    await expect(card.getByTestId("return-path-step").nth(3)).toContainText(
      "Toshkent HQ · Ro'yxatchi Bobur Xolmatov → Baraka Shop",
    );
    await expect(card.getByTestId("return-path-method")).toHaveText("QR orqali");
    await expect(card.getByTestId("return-path-pending")).toHaveCount(0);
    expect(leaked).toEqual([]);
  });
});
