import { expect, test } from "@playwright/test";
import { MERGED, mockDistrictsApi, openDistricts, openMergeToIzboskan } from "./support/districtsMerge";
import { toast } from "./support/toast";

/**
 * DM-1 — `/regions/districts` (admin, 1440): «Hududlar» → «Tumanlar», DELETE 400 → «Tumanni o'chirib bo'lmaydi»
 * (sonlarsiz, server matnisiz) → «Tumanni birlashtirish» (maqsad faqat shu viloyatdan) → jarayon (yopilmaydi) →
 * natija; timeout/504 → «Natija noma'lum»; 409 → umumiy xabar.
 */
test.describe.configure({ timeout: 120_000 });

test("admin «Hududlar» sarlavhasidan «Tumanlar» ga o'tadi (birinchi tugma)", async ({ page }) => {
  await mockDistrictsApi(page, () => ({ status: 200, body: MERGED }));
  await page.goto("/regions");
  const actions = page.getByRole("button", { name: /^(Tumanlar|Tumanlarni o'tkazish|Logist biriktirish)$/ });
  await expect(actions).toHaveText(["Tumanlar", "Tumanlarni o'tkazish", "Logist biriktirish"], { timeout: 60_000 });
  await actions.first().click();
  await expect(page).toHaveURL(/\/regions\/districts$/);
  await expect(page.getByText("Bo'z tumani").first()).toBeVisible();
});

test("⭐ o'chirib bo'lmaydi → birlashtirish → jarayon → natija (target_before → target_after)", async ({ page }) => {
  const mock = await mockDistrictsApi(page, () => ({ status: 200, body: MERGED, delayMs: 1500 }));
  await openDistricts(page);
  const dialog = await openMergeToIzboskan(page);
  // Server matni («Bu tumanda 128 ta buyurtma bor…») hech qayerda ko'rinmaydi.
  await expect(page.getByText(/128 ta buyurtma bor/)).toHaveCount(0);

  await dialog.getByRole("button", { name: "Birlashtirish" }).click();
  const progress = page.getByRole("alertdialog", { name: "Birlashtirilmoqda…" });
  await expect(progress).toBeVisible();
  await expect(progress.getByText(/^O'tgan vaqt \d:\d\d$/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(progress).toBeVisible();

  const result = page.getByRole("dialog", { name: "Tumanlar birlashtirildi" });
  await expect(result).toBeVisible();
  const now = result.getByRole("list", { name: "Izboskan tumanida endi" });
  await expect(now).toContainText("1 254 ta");
  await expect(now).toContainText("oldin 1 126 ta");
  await expect(result.getByText("Ko'chirildi", { exact: true })).toHaveCount(0);
  expect(mock.mergeBodies).toEqual([{ path: "district/23/merge", body: { target_district_id: "24" } }]);

  await result.getByRole("button", { name: "Yopish" }).last().click();
  await expect(result).toBeHidden();
  // Ro'yxat yangilandi — Bo'z tumani yo'q.
  await expect(page.getByText("Bo'z tumani")).toHaveCount(0);
  expect(mock.leaked).toEqual([]);
});

test("504 → «Natija noma'lum»: «Qayta urinish» yo'q, «Tumanlarni yangilash» ro'yxatni qayta oladi", async ({ page }) => {
  const mock = await mockDistrictsApi(page, () => ({
    status: 504,
    body: { statusCode: 504, message: "Yuqori oqim xizmati vaqtida javob bermadi (timeout)" },
  }));
  await openDistricts(page);
  const dialog = await openMergeToIzboskan(page);
  await dialog.getByRole("button", { name: "Birlashtirish" }).click();

  const unknown = page.getByRole("alertdialog", { name: "Natija noma'lum" });
  await expect(unknown).toBeVisible();
  await expect(unknown).toContainText("Bo'z tumani → Izboskan tumani");
  await expect(unknown.getByRole("button", { name: /Qayta urinish/ })).toHaveCount(0);
  await expect(page.getByText(/Yuqori oqim/)).toHaveCount(0);
  const calls = mock.regionCalls();
  await unknown.getByRole("button", { name: "Tumanlarni yangilash" }).click();
  await expect(unknown).toBeHidden();
  await expect.poll(() => mock.regionCalls()).toBeGreaterThan(calls);
  expect(mock.mergeBodies).toHaveLength(1);
});

test("409 → umumiy «Birlashtirib bo'lmadi» xabari, oyna yopiladi, server matni ko'rinmaydi", async ({ page }) => {
  await mockDistrictsApi(page, () => ({
    status: 409,
    body: { statusCode: 409, message: "Birlashtirish bekor qilindi: tekshiruv mos kelmadi" },
  }));
  await openDistricts(page);
  const dialog = await openMergeToIzboskan(page);
  await dialog.getByRole("button", { name: "Birlashtirish" }).click();

  await expect(toast(page, "Birlashtirib bo'lmadi", { tone: "error" })).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/tekshiruv mos kelmadi/)).toHaveCount(0);
  await expect(page.getByText("Bo'z tumani").first()).toBeVisible();
});
