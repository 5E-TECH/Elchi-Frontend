import { expect, test } from "@playwright/test";
import { TG_GROUP_DEEP_LINK, marketGroupRow, mockMarketTgGroupApi } from "./support/marketTgGroup";

/**
 * TG-B (4TfLyTrL, 6jXw0DDr; ega javoblari tg-link S1–S5) — market tafsilotidagi «Telegram guruhi» kartasi
 * (`*-users-detail-telegram`): har tur holati, ulanmagan turda to'g'ridan-to'g'ri «Ulash» → bir martalik havola oynasi
 * (`*-users-detail-telegram-group-dialog`), guruh ulanganda oyna o'zi yopiladi va «Guruh ulandi»; muddati tugasa —
 * «Yangi havola olish»; admin ham ulaydi; menejer kartani ko'rmaydi; market o'z profilida — holatsiz qatorlar
 * (`market-profile`); `/all-users` da «Telegram boti» ustuni. `GET /markets/:id/tg-token` hech qachon so'ralmaydi.
 * Soxta backend, 1440px.
 */
test.describe("Market Telegram guruhi (TG-B) — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test.describe.configure({ timeout: 120_000 });

  test("⭐ superadmin: holatlar → «Ulash» (shu market, tur) → QR va havola → guruh ulanadi, oyna yopiladi, karta yangilanadi", async ({
    page,
  }) => {
    const state = await mockMarketTgGroupApi(page, { role: "superadmin", connectAfterPolls: 1 });
    await page.goto("/all-users/201");

    const card = page.getByRole("region", { name: "Telegram guruhi" });
    await expect(card).toBeVisible({ timeout: 90_000 });
    await expect(card.getByText("06.10.2026 dan")).toBeVisible();
    await expect(card.getByText("Bekor qilingan buyurtmalar xabari kelmaydi")).toBeVisible();
    await expect(card.getByRole("button", { name: "Yangi buyurtmalar guruhini ulash" })).toHaveCount(0);
    await expect(card.getByRole("switch", { name: "Guruhda mijoz ismi va telefoni" })).toBeVisible();
    // PII kaliti «Ruxsatlar» da emas (S3).
    await expect(
      page.getByRole("region", { name: "Ruxsatlar" }).getByRole("switch", { name: "Guruhda mijoz ismi va telefoni" }),
    ).toHaveCount(0);

    await card.getByRole("button", { name: "Bekor qilinganlar guruhini ulash" }).click();
    const dialog = page.getByRole("dialog", { name: "Telegram guruhini ulash" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Baraka Shop · Bekor qilinganlar guruhi")).toBeVisible();
    await expect(dialog.getByRole("img", { name: "Telegram guruhini ulash havolasining QR kodi" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Telegram'da ochish" })).toHaveAttribute("href", TG_GROUP_DEEP_LINK);
    await expect(dialog.getByRole("timer")).toHaveText(/qoldi$/);
    expect(state.linkRequests).toEqual([{ purpose: "market_group", group_type: "cancel", market_id: "201" }]);

    // Bot guruhni uladi (2-kuzatuvda qator paydo bo'ladi) — oyna yopiladi, xabar, karta «Ulangan».
    await expect(page.getByText("Guruh ulandi", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(dialog).toHaveCount(0);
    await expect(card.getByRole("button", { name: /guruhini ulash/ })).toHaveCount(0);
    await expect(card.getByText("Ulangan")).toHaveCount(2);
    expect(state.tokenRequests).toBe(0);
  });

  test("⭐ muddati tugadi: «Havola muddati tugadi» → «Yangi havola olish» yangi kod so'raydi", async ({ page }) => {
    const state = await mockMarketTgGroupApi(page, { role: "superadmin", expiresInMs: 3_000 });
    await page.goto("/all-users/201");

    const card = page.getByRole("region", { name: "Telegram guruhi" });
    await card.getByRole("button", { name: "Bekor qilinganlar guruhini ulash" }).click({ timeout: 90_000 });
    const dialog = page.getByRole("dialog", { name: "Telegram guruhini ulash" });
    await expect(dialog.getByText("Havola muddati tugadi")).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByRole("link", { name: "Telegram'da ochish" })).toHaveCount(0);

    await dialog.getByRole("button", { name: "Yangi havola olish" }).click();
    await expect(dialog.getByRole("link", { name: "Telegram'da ochish" })).toBeVisible();
    expect(state.linkRequests).toHaveLength(2);
  });

  test("⭐ admin: karta, «Ulash» va «Barcha guruhlar «Bildirishnomalar» bo'limida» havolasi; nofaol ulanish — «Nofaol»", async ({
    page,
  }) => {
    const state = await mockMarketTgGroupApi(page, { role: "admin", rows: [marketGroupRow("create", false)] });
    await page.goto("/all-users/201");

    const card = page.getByRole("region", { name: "Telegram guruhi" });
    await expect(card.getByText("Nofaol")).toBeVisible({ timeout: 90_000 });
    await expect(card.getByText("Xabarlar bu guruhga yuborilmayapti")).toBeVisible();
    await expect(card.getByRole("button", { name: "Bekor qilinganlar guruhini ulash" })).toBeVisible();
    await card.getByRole("link", { name: /Barcha guruhlar «Bildirishnomalar» bo'limida/ }).click();
    await expect(page).toHaveURL(/\/notifications$/);
    expect(state.tokenRequests).toBe(0);
  });

  test("⭐ menejer: market tafsilotida karta ham, PII kaliti ham yo'q; guruhlar so'ralmaydi", async ({ page }) => {
    const state = await mockMarketTgGroupApi(page, { role: "manager" });
    await page.goto("/all-users/201");

    await expect(page.getByRole("heading", { name: "Baraka Shop" })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole("region", { name: "Telegram guruhi" })).toHaveCount(0);
    await expect(page.getByRole("switch", { name: "Guruhda mijoz ismi va telefoni" })).toHaveCount(0);
    expect(state.notificationRequests).toBe(0);
  });

  test("⭐ market /profile: «Xavfsizlik» va «Telegram» yonma-yon, «Telegram guruhi» — holatsiz, «Ulash» `market_id` siz", async ({
    page,
  }) => {
    const state = await mockMarketTgGroupApi(page, { role: "market" });
    await page.goto("/profile");

    const groups = page.getByRole("region", { name: "Telegram guruhi" });
    await expect(groups).toBeVisible({ timeout: 90_000 });
    const security = await page.getByRole("region", { name: "Xavfsizlik" }).boundingBox();
    const telegram = await page.getByRole("region", { name: "Telegram", exact: true }).boundingBox();
    expect(Math.abs((security?.y ?? 0) - (telegram?.y ?? 1))).toBeLessThan(2);
    await expect(groups.getByText("Ulanmagan")).toHaveCount(0);

    await groups.getByRole("button", { name: "Yangi buyurtmalar guruhini ulash" }).click();
    const dialog = page.getByRole("dialog", { name: "Telegram guruhini ulash" });
    await expect(dialog.getByText("Bot guruhni o'zi ulaydi — ulanganda sizga bildirishnoma keladi")).toBeVisible();
    await expect(dialog.getByText("Guruh ulanishi kutilmoqda…")).toHaveCount(0);
    expect(state.linkRequests).toEqual([{ purpose: "market_group", group_type: "create" }]);
    expect(state.notificationRequests).toBe(0);
  });

  test("⭐ /all-users: «Telegram boti» ustuni — «Ulangan» / «Ulanmagan», investor — «—»", async ({ page }) => {
    await mockMarketTgGroupApi(page, { role: "superadmin" });
    await page.goto("/all-users");

    const table = page.getByRole("table", { name: "Foydalanuvchilar ro'yxati" });
    await expect(table.getByRole("columnheader", { name: "Telegram boti" })).toBeVisible({ timeout: 90_000 });
    await expect(table.getByRole("row", { name: /Mehr Kosmetika/ }).getByText("Ulangan")).toBeVisible();
    await expect(table.getByRole("row", { name: /Jasur Tursunov/ }).getByText("Ulanmagan")).toBeVisible();
    await expect(table.getByRole("row", { name: /Sherzod Umarov/ }).getByLabel("Ulab bo'lmaydi")).toBeVisible();
  });
});
