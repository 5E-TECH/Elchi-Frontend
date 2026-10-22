import { expect, test } from "@playwright/test";
import { openUsers } from "./support/usersList";

/** 84IDGRDp — `/all-users` keng ekranda gorizontal oqib ketish yo'q (390 — `users-list.mobile.spec.ts`). */
test.describe.configure({ timeout: 180_000 });

for (const width of [1440, 1920]) {
  test(`⭐ ${width}px: gorizontal oqib ketish yo'q`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openUsers(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.locator("[data-shell-slot=content]").evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  });
}

/**
 * FY-1 (maket `superadmin-users-list-roles`): 9 ta rol tabi FY-S1 tartibida, «Rol» tanlovi desktopda yashirin;
 * tab bosilsa — `GET /users?role=…` (bitta so'rov); market operatori / logist / investor qatorida qator menyusi.
 */
test("⭐ FY-1: 9 ta rol tabi, yangi rol tabi so'rovga ketadi, yangi rollarda qator menyusi", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { listQueries } = await openUsers(page);
  const content = page.locator("[data-shell-slot=content]");

  const tabs = content.getByRole("tablist", { name: "Rol bo'yicha" }).getByRole("tab");
  await expect(tabs).toHaveText([
    "Hammasi",
    "Adminlar",
    "Menejerlar",
    "Ro'yxatchilar",
    "Kuryerlar",
    "Logistlar",
    "Marketlar",
    "Market operatorlari",
    "Investorlar",
  ]);
  await expect(content.getByRole("combobox", { name: "Rol" })).toBeHidden();

  // Yangi rollar qatorida — rol yorlig'i va to'liq qator menyusi (FY-S2).
  for (const [name, label] of [
    ["Foydalanuvchi 6", "Logist"],
    ["Foydalanuvchi 7", "Market operatori"],
    ["Foydalanuvchi 8", "Investor"],
  ] as const) {
    const row = content.getByRole("row").filter({ hasText: name });
    await expect(row.getByText(label, { exact: true })).toBeVisible();
    await row.getByRole("button", { name: `${name} amallari` }).click();
    const menu = page.getByRole("menu", { name: `${name} amallari` });
    // «Foydalanuvchi 8» (investor) — nofaol: menyuda «Faol qilish».
    await expect(menu.getByRole("menuitem")).toHaveText(["Tahrirlash", /^(Nofaol|Faol) qilish$/, "O'chirish"]);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  }

  await content.getByRole("tab", { name: "Market operatorlari" }).click();
  await expect(page).toHaveURL(/[?&]role=market_operator\b/);
  await expect.poll(() => listQueries.at(-1)?.get("role")).toBe("market_operator");
  await expect(content.getByRole("tab", { name: "Market operatorlari" })).toHaveAttribute("aria-selected", "true");
  await expect(content.getByRole("row").filter({ hasText: "Foydalanuvchi 7" })).toBeVisible();
  await expect(content.getByRole("row").filter({ hasText: "Foydalanuvchi 1" })).toHaveCount(0);
});
