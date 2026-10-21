import { expect, test } from "@playwright/test";
import { mockSatoApi, openSatoCodes } from "./support/satoCodes";
import { toast } from "./support/toast";

/**
 * SA-2 — `/regions/sato-management?tab=sato` (1440, superadmin): «SATO kodlarini yozish N» (tasdiq oynasi,
 * «Yozilmoqda…», natija xabari, qayta yuklash), «Bazada yo'q» → «Tuman qo'shish» oynasi (`POST district`),
 * «Takroriy nomlar» → «Birlashtirish» (umumiy `DistrictMergeDialog`, `POST district/:id/merge`).
 */
test.describe.configure({ timeout: 120_000 });

test("«SATO kodlarini yozish 12» → oyna → «Yozilmoqda…» (yopilmaydi) → xabar, «Topildi» 0, tugma o'chiq", async ({ page }) => {
  const mock = await mockSatoApi(page, {
    apply: () => ({
      status: 200,
      delayMs: 800,
      body: { statusCode: 200, message: "12 ta tumanga SATO code qo'shildi", data: { appliedCount: 12 } },
    }),
  });
  await openSatoCodes(page);

  const button = page.getByRole("button", { name: /^SATO kodlarini yozish/ });
  await expect(button).toHaveText("SATO kodlarini yozish 12");
  await expect(button).toHaveAccessibleName("SATO kodlarini yozish 12");
  await button.click();
  const dialog = page.getByRole("alertdialog", { name: "SATO kodlarini yozasizmi?" });
  await expect(dialog).toContainText("Rasmiy ro'yxatdan topilgan 12 ta kod bazadagi tumanlarga yoziladi.");
  await expect(dialog.getByRole("list", { name: "Yoziladigan kodlar" }).getByRole("listitem")).toHaveCount(4);
  await expect(dialog).toContainText("yana 9 ta tuman");
  await expect(dialog).toContainText("Topilmagan 3 ta va takroriy 2 ta yozuvga kod yozilmaydi.");

  await dialog.getByRole("button", { name: "12 ta kodni yozish" }).click();
  await expect(dialog.getByRole("button", { name: "Yozilmoqda…" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();

  await expect(toast(page, "12 ta tumanga SATO kodi yozildi")).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("tablist", { name: "SATO holati bo'yicha" }).getByRole("tab", { name: /^Topildi/ })).toHaveText(
    "Topildi 0",
  );
  await expect(button).toBeDisabled();
  await expect(page.getByText("Yoziladigan kod yo'q", { exact: true })).toBeVisible();
  expect(mock.posts.map((post) => post.path)).toEqual(["district/sato-match/apply"]);
  expect(mock.counts.preview).toBe(2);
  expect(mock.leaked).toEqual([]);
});

test("504 → ro'yxat qayta olinadi, xabar haqiqiy holat bo'yicha (kodlar yozilmagan); server matni yo'q", async ({ page }) => {
  const mock = await mockSatoApi(page, {
    apply: () => ({ status: 504, body: { statusCode: 504, message: "Gateway Timeout upstream" } }),
  });
  await openSatoCodes(page);
  await page.getByRole("button", { name: /^SATO kodlarini yozish/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "12 ta kodni yozish" }).click();

  // Mock: 504 bo'lsa kodlar yozilmagan — qayta olingan ro'yxat bo'yicha xato.
  await expect(toast(page, "SATO kodlarini yozib bo'lmadi")).toBeVisible();
  await expect(page.getByText(/Gateway Timeout/)).toHaveCount(0);
  expect(mock.counts.district).toBe(2);
  expect(mock.leaked).toEqual([]);
});

test("«Bazada yo'q» → «Tuman qo'shish»: to'ldirilgan oyna, o'xshash nom ogohlantirishi → POST district → xabar", async ({ page }) => {
  const mock = await mockSatoApi(page);
  await openSatoCodes(page);
  await page.getByRole("tab", { name: /^Bazada yo'q/ }).click();
  await page.getByRole("button", { name: "Urgut tumani — tuman qo'shish" }).click();

  const dialog = page.getByRole("dialog", { name: "Tuman qo'shish" });
  await expect(dialog.getByRole("textbox", { name: /Tuman nomi/ })).toHaveValue("Urgut tumani");
  await expect(dialog.getByRole("textbox", { name: /Tuman nomi/ })).toBeFocused();
  await expect(dialog.getByRole("combobox", { name: /Viloyat/ })).toHaveText(/Samarqand/);
  await expect(dialog.getByRole("textbox", { name: "SATO kodi" })).toHaveValue("1718236");
  await expect(dialog.getByRole("note")).toHaveText(
    "Bazada «Urgut sh.» bor. Agar bu o'sha tuman bo'lsa, yangisini qo'shmang — «Topilmadi» tabida unga kodni kiriting.",
  );
  const box = (await dialog.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(461);

  await dialog.getByRole("button", { name: "Tuman qo'shish" }).click();
  await expect(toast(page, "Tuman qo'shildi")).toBeVisible();
  await expect(dialog).toHaveCount(0);
  expect(mock.posts).toEqual([{ path: "district", body: { name: "Urgut tumani", region_id: "6", sato_code: "1718236" } }]);
  await expect(page.getByRole("tab", { name: /^Bazada yo'q/ })).toHaveText("Bazada yo'q 1");
  expect(mock.leaked).toEqual([]);
});

test("«Takroriy nomlar» → «Birlashtirish»: kodsiz ID 42 → kodli ID 41, natija oynasi, guruh yo'qoladi", async ({ page }) => {
  const mock = await mockSatoApi(page);
  await openSatoCodes(page);
  await page.getByRole("tab", { name: /^Takroriy nomlar/ }).click();

  const table = page.getByRole("table", { name: "Dublikat tumanlar" });
  const header = table.getByRole("rowheader", { name: /Bo'ka tumani/ });
  await expect(header).toContainText("2 ta yozuv");
  await expect(header).toContainText("Toshkent viloyati");
  await header.getByRole("button", { name: "Bo'ka tumani yozuvlarini birlashtirish" }).click();

  const dialog = page.getByRole("dialog", { name: "Tumanni birlashtirish" });
  await expect(dialog).toContainText("Bo'ka tumani (ID 42) dagi hamma narsa tanlangan tumanga ko'chadi, ID 42 yozuvi o'chiriladi.");
  await expect(dialog).toContainText("Bo'ka tumani · ID 42");
  await expect(dialog).toContainText("Toshkent viloyati · Kod yo'q");
  await expect(dialog.getByRole("combobox", { name: /Maqsad tuman/ })).toContainText("Bo'ka tumani · ID 41");
  await expect(dialog).toContainText("Faqat Toshkent viloyati tumanlari. SATO kodi 1727212 saqlanadi.");
  await dialog.getByRole("button", { name: "Birlashtirish", exact: true }).click();

  const result = page.getByRole("dialog", { name: "Tumanlar birlashtirildi" });
  await expect(result).toContainText("Bo'ka tumani (ID 42) o'chirildi.");
  expect(mock.posts).toEqual([{ path: "district/42/merge", body: { target_district_id: "41" } }]);
  await result.getByRole("button", { name: "Yopish" }).last().click();
  await expect(page.getByText("Takroriy nom yo'q", { exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: /^Takroriy nomlar/ })).toHaveText("Takroriy nomlar 0");
  expect(mock.leaked).toEqual([]);
});
