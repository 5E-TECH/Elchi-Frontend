import { expect, test } from "@playwright/test";
import {
  COUNT_MISMATCH,
  MANUAL_FIX,
  MERGED,
  deleteBoz,
  mockDistrictsApi,
  openDistricts,
  openMergeToIzboskan,
} from "./support/districtsMerge";
import { toast } from "./support/toast";

/**
 * DM-1, DM-2 — `/regions/districts` (admin, 1440): «Hududlar» → «Tumanlar», DELETE 400 → «Tumanni o'chirib
 * bo'lmaydi» («Bog'langan» — `data.usage`, server matnisiz) → «Tumanni birlashtirish» (maqsad faqat shu viloyatdan,
 * «… ko'chadi» sonlari) → jarayon (yopilmaydi) → natija («Ko'chirildi» — `moved_live`); timeout/504 → «Natija
 * noma'lum»; 409/503 `data.reason` bilan → xato oynalari («Sabab», «Qayta urinish», «chala qoldi»); sababsiz 409 →
 * umumiy xabar.
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
  // «Bog'langan» — DELETE 400 javobidagi `data.usage`.
  const blocked = await deleteBoz(page);
  await expect(blocked.getByRole("list", { name: "Tumanga bog'langanlar" })).toContainText("128 ta");
  await blocked.getByRole("button", { name: "Yopish" }).last().click();
  await expect(blocked).toBeHidden();
  const dialog = await openMergeToIzboskan(page);
  // «Izboskan tumaniga ko'chadi» — GET district/23/usage.
  await expect(dialog.getByText("Izboskan tumaniga ko'chadi")).toBeVisible();
  await expect(dialog.getByRole("list", { name: "Ko'chiriladiganlar" })).toContainText("Mijoz, kuryer va market");
  // Server matni («Bu tumanda 128 ta buyurtma bor…») hech qayerda ko'rinmaydi.
  await expect(page.getByText(/128 ta buyurtma bor/)).toHaveCount(0);

  // Maket: oyna eni 520 px, tuman nomi 14 px (sarlavha 16 px).
  expect((await dialog.boundingBox())?.width).toBe(520);
  const sourceTitle = dialog.getByText("Bo'z tumani", { exact: true });
  await expect(sourceTitle).toHaveCSS("font-size", "14px");

  await dialog.getByRole("button", { name: "Birlashtirish" }).click();
  const progress = page.getByRole("alertdialog", { name: "Birlashtirilmoqda…" });
  await expect(progress).toBeVisible();
  // Bosilgan tugma yo'qoldi — fokus panelda (ekran o'quvchi «Birlashtirilmoqda…» ni o'qiydi).
  await expect(progress).toBeFocused();
  await expect(progress.getByText(/^O'tgan vaqt \d:\d\d$/)).toBeVisible();
  await expect(progress.getByRole("list", { name: "Ko'chirilayotganlar" })).toContainText("128 ta");
  await page.keyboard.press("Escape");
  await expect(progress).toBeVisible();

  const result = page.getByRole("dialog", { name: "Tumanlar birlashtirildi" });
  await expect(result).toBeVisible();
  const now = result.getByRole("list", { name: "Izboskan tumanida endi" });
  await expect(now).toContainText("1 254 ta");
  await expect(now).toContainText("oldin 1 126 ta");
  await expect(result).toBeFocused();
  await expect(now.getByText("1 254 ta", { exact: true })).toHaveCSS("font-size", "14px");
  // «Ko'chirildi» — faqat tirik (`moved_live` 128), `moved` (130) emas.
  const moved = result.getByRole("list", { name: "Ko'chirildi" });
  await expect(moved).toContainText("128 ta");
  await expect(moved).not.toContainText("130");
  expect(mock.mergeBodies).toEqual([{ path: "district/23/merge", body: { target_district_id: "24" } }]);

  await result.getByRole("button", { name: "Yopish" }).last().click();
  await expect(result).toBeHidden();
  // Ro'yxat yangilandi — Bo'z tumani yo'q.
  await expect(page.getByText("Bo'z tumani")).toHaveCount(0);
  // Ochgan tugmalar yo'q — fokus qidiruv maydonida, `body` da emas.
  await expect(page.getByRole("searchbox", { name: "Tuman yoki viloyat qidirish" })).toBeFocused();
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

test("sababsiz 409 → umumiy «Birlashtirib bo'lmadi» xabari, oyna yopiladi, server matni ko'rinmaydi", async ({ page }) => {
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

test("⭐ 409 count_mismatch → «Birlashtirib bo'lmadi»: «Sabab», nusxalash, «Qayta urinish» → natija", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  let calls = 0;
  const mock = await mockDistrictsApi(page, () => {
    calls += 1;
    return calls === 1 ? COUNT_MISMATCH : { status: 200, body: MERGED, delayMs: 500 };
  });
  await openDistricts(page);
  const dialog = await openMergeToIzboskan(page);
  await dialog.getByRole("button", { name: "Birlashtirish" }).click();

  const error = page.getByRole("alertdialog", { name: "Birlashtirib bo'lmadi" });
  await expect(error).toBeVisible();
  expect((await error.boundingBox())?.width).toBe(480);
  await expect(error).toContainText("Ko'chirilganlar Bo'z tumaniga qaytarildi, tuman o'chirilmadi.");
  await expect(error).toContainText("Bo'z tumani → Izboskan tumani");
  await expect(error.getByTestId("merge-error-reason")).toContainText(/Sonlar mos kelmadi — Izboskan tumanida buyurtmalar 1\s255 ta, kutilgan 1\s254 ta\./);
  // Server matni va HTTP kodi ko'rinmaydi.
  await expect(page.getByText(/tekshiruv mos kelmadi/)).toHaveCount(0);
  await expect(error).not.toContainText("409");
  // Z1c1sNPT: «Bo'z tumaniga qaytarildi: buyurtmalar · foydalanuvchilar · filiallar» — details.rolled_back_*.
  await expect(error.getByText("Bo'z tumaniga qaytarildi", { exact: true })).toBeVisible();
  await expect(error.getByRole("list", { name: "Bo'z tumaniga qaytarilganlar" }).getByRole("listitem")).toHaveText([
    /Buyurtmalar\s*128 ta/,
    /Foydalanuvchilar\s*6 ta/,
    /Filiallar\s*1 ta/,
  ]);

  await error.getByRole("button", { name: "Xabarni nusxalash" }).click();
  await expect(toast(page, "Xabar nusxalandi", { tone: "success" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("Kod: count_mismatch · orders");
  expect(copied).toContain("trace_id: e2e-trace-1");
  expect(copied).toContain("Bo'z tumaniga qaytarildi: buyurtmalar 128 ta · foydalanuvchilar 6 ta · filiallar 1 ta");

  await error.getByRole("button", { name: "Qayta urinish" }).click();
  await expect(page.getByRole("alertdialog", { name: "Birlashtirilmoqda…" })).toBeVisible();
  const result = page.getByRole("dialog", { name: "Tumanlar birlashtirildi" });
  await expect(result).toBeVisible();
  await expect(result.getByRole("list", { name: "Ko'chirildi" })).toContainText("128 ta");
  expect(mock.mergeBodies).toHaveLength(2);
  expect(mock.mergeBodies[1]).toEqual({ path: "district/23/merge", body: { target_district_id: "24" } });
  expect(mock.leaked).toEqual([]);
});

test("503 manual_fix → «Birlashtirish chala qoldi»: qaytmaganlar, «Qayta urinish» yo'q, jurnalga o'tish", async ({
  page,
}) => {
  const mock = await mockDistrictsApi(page, () => MANUAL_FIX);
  await openDistricts(page);
  const dialog = await openMergeToIzboskan(page);
  await dialog.getByRole("button", { name: "Birlashtirish" }).click();

  const manual = page.getByRole("alertdialog", { name: "Birlashtirish chala qoldi" });
  await expect(manual).toBeVisible();
  expect((await manual.boundingBox())?.width).toBe(520);
  await expect(manual.getByRole("alert")).toContainText("Qo'lda tuzatish kerak");
  await expect(manual.getByTestId("merge-error-reason")).toContainText(
    "Foydalanuvchilar ko'chirilmadi — servis 15 soniya ichida javob bermadi.",
  );
  const stranded = manual.getByRole("list", { name: "Bo'z tumaniga qaytmaganlar" });
  await expect(stranded.getByRole("listitem")).toHaveCount(2);
  await expect(stranded).toContainText("Buyurtmalar · 14 ta");
  // Z1c1sNPT: qaytmagan buyurtma raqamlari (`stranded_order_ids`, ≤10 ta) + «va yana N ta» (14 − 5).
  await expect(stranded).toContainText("Izboskan tumanida qoldi: №7001, №7002, №7015, №7023, №7040 va yana 9 ta");
  await expect(stranded).toContainText("Foydalanuvchilar · ID'lar noma'lum");
  await expect(manual.getByRole("button", { name: "Qayta urinish" })).toHaveCount(0);
  await expect(page.getByText(/kompensatsiya/)).toHaveCount(0);

  await manual.getByRole("button", { name: "Faoliyat jurnalini ochish" }).click();
  await expect(page).toHaveURL(/\/activity-logs$/);
  expect(mock.mergeBodies).toHaveLength(1);
});
