import { expect, test, type Page } from "@playwright/test";
import { cameraDialog, HQ_MANAGER_PROFILE, mockNewOrdersCameraApi, OWN_TOKEN } from "./support/newOrdersCamera";
import { enterCode, expectNoHorizontalScroll, FAKE_CAMERA } from "./support/scannerCamera";
import { COURIER_TOKENS, enterScanCode, mockCourierScanApi } from "./support/universalScanner";
import { mockUniversalScanModesApi, REFUSED_MAIL_QR, SEND_ORDER_TOKEN } from "./support/universalScanModes";

/**
 * 390px: universal skaner `/scan` rejimlari (Trello v1eLN2tV 3-bosqich).
 *   - kuryer: sukut «O'zimga olish» — har kod `POST orders/scan-assign`, kamera yopilmaydi, ro'yxat, «Tugatish» → xulosa;
 *   - HQ menejeri: «Qabul qilish» → market varag'i → `/new-orders/:id`, kamera O'SHA sahifada ochiq (skan = qabul);
 *   - superadmin (5 rejim — «Rejim: … ▾» varag'i, vNcGDnNh 2-band): «Pochtani jo'natish» (varaq → `/mails/:id`, skan =
 *     tanlov), «Rad etilgan pochta» (pochta QR'i → `/mails/:id`), «Marketga topshirish» (varaq →
 *     `/new-orders/cancelled/:id`, kamera market QR bosqichida).
 */
test.use(FAKE_CAMERA);

test.describe("Universal skaner rejimlari, 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("kuryer: 2 ta kod → 2 ta scan-assign, natija ro'yxati, «Tugatish» → xulosa", async ({ page }) => {
    const api = await mockCourierScanApi(page);
    await page.goto("/scan");
    const camera = page.locator("body");
    await expect(page.getByRole("heading", { name: "O'zimga olish" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("radio", { name: "O'zimga olish" })).toHaveAttribute("aria-checked", "true");

    const [first, second] = Object.keys(COURIER_TOKENS);
    await enterScanCode(page, camera, first, "Olish");
    await expect(page.getByText("№10191 · Lobar Yusupova")).toBeVisible();
    await enterScanCode(page, camera, second, "Olish");
    await expect(page.getByText("№10172 · Sardor Qodirov")).toBeVisible();
    expect(api.assigns).toEqual([first, second]);

    await page.getByRole("button", { name: "Ro'yxat" }).click();
    const list = page.getByRole("dialog", { name: "Skanerlanganlar" });
    await expect(list.getByText("№10191 · Lobar Yusupova")).toBeVisible();
    await expect(list.getByText("Sizga biriktirildi · Mirzo Ulug'bek tumani")).toBeVisible();
    await list.getByRole("button", { name: "Davom etish" }).click();
    await expect(list).toBeHidden();

    await page.getByRole("button", { name: "Tugatish" }).click();
    const summary = page.getByRole("dialog", { name: "Skanerlash yakunlandi" });
    await expect(summary.getByText("2 ta buyurtma sizga biriktirildi")).toBeVisible();
    await expectNoHorizontalScroll(page);
    expect(api.leaked).toEqual([]);
  });

  test("HQ menejeri: «Qabul qilish» → market → /new-orders/:id, kamera ochiq; skan = qabul", async ({ page }) => {
    const { leaked, received } = await mockNewOrdersCameraApi(page, { profile: HQ_MANAGER_PROFILE });
    await page.goto("/scan");
    await expect(page.getByRole("heading", { name: "QR skaner" })).toBeVisible({ timeout: 60_000 });

    await page.getByRole("radio", { name: "Qabul qilish" }).click();
    const sheet = page.getByRole("dialog", { name: "Marketni tanlang" });
    await expect(sheet.getByText("2 ta yangi buyurtma")).toBeVisible();
    await sheet.getByRole("button", { name: /Ipak Yo'li Savdo/ }).click();

    await expect(page).toHaveURL(/\/new-orders\/121$/);
    const dialog = cameraDialog(page);
    await expect(dialog).toBeVisible({ timeout: 60_000 });
    await expect(dialog.getByText("Ipak Yo'li Savdo · 2 ta buyurtma")).toBeVisible();

    await enterCode(page, dialog, OWN_TOKEN);
    await expect.poll(() => received).toEqual([["10254"]]);

    // Bayroq tozalangan: sahifa yangilansa kamera o'zi qayta ochilmaydi.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Ipak Yo'li Savdo" })).toBeVisible({ timeout: 60_000 });
    await expect(cameraDialog(page)).toBeHidden();
    await expectNoHorizontalScroll(page);
    expect(leaked).toEqual([]);
  });
});

/** Telefon kamerasida «Rejim: … ▾» → «Skaner rejimi» varag'i → rejim (3 tadan ko'p rejimda segment o'rniga). */
const chooseMode = async (page: Page, label: string) => {
  await page.getByRole("button", { name: /^Rejim: / }).click();
  const sheet = page.getByRole("dialog", { name: "Skaner rejimi" });
  await expect(sheet.getByRole("radio", { name: "Ma'lumot" })).toHaveAttribute("aria-checked", "true");
  await sheet.getByRole("radio", { name: label }).click();
  await expect(sheet).toBeHidden();
};

test.describe("Universal skaner — pochta va topshirish rejimlari (vNcGDnNh), 390px", () => {
  test.describe.configure({ timeout: 120_000 });

  test("«Pochtani jo'natish» → pochta varag'i → /mails/:id, kamera ochiq; buyurtma skani = tanlov", async ({ page }) => {
    const { leaked } = await mockUniversalScanModesApi(page);
    await page.goto("/scan");
    await expect(page.getByRole("heading", { name: "QR skaner" })).toBeVisible({ timeout: 60_000 });
    await expectNoHorizontalScroll(page);

    await chooseMode(page, "Pochtani jo'natish");
    const sheet = page.getByRole("dialog", { name: "Pochtani tanlang" });
    await expect(sheet.getByText("Qashqadaryo · 3 ta buyurtma")).toBeVisible();
    await sheet.getByRole("button", { name: /Pochta №2483/ }).click();

    await expect(page).toHaveURL(/\/mails\/2483$/);
    const dialog = page.getByRole("dialog", { name: "Pochtani jo'natish", exact: true });
    await expect(dialog).toBeVisible({ timeout: 60_000 });
    await expect(dialog.getByText("Pochta №2483 · Qashqadaryo")).toBeVisible();

    await enterCode(page, dialog, SEND_ORDER_TOKEN);
    await expect(dialog.getByText("№10212 · Shoxrux Rahmonov")).toBeVisible();
    await dialog.getByRole("button", { name: "Tugatish" }).click();
    await expect(dialog).toBeHidden();
    // Jo'natish — sahifaning o'z tugmasi va «Filialni tanlang» oynasi.
    await expect(page.getByRole("button", { name: "Pochtani jo'natish — 1 ta" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    expect(leaked).toEqual([]);
  });

  test("«Rad etilgan pochta» — pochta QR'i (varaqsiz) → /mails/:id, kamera «Rad etilgan pochtani qabul qilish»", async ({ page }) => {
    const { leaked } = await mockUniversalScanModesApi(page);
    await page.goto("/scan");
    await expect(page.getByRole("heading", { name: "QR skaner" })).toBeVisible({ timeout: 60_000 });

    await chooseMode(page, "Rad etilgan pochta");
    const sheet = page.getByRole("dialog", { name: "Pochtani tanlang" });
    await expect(sheet.getByText("Qashqadaryo · Akmal Karimov · 2 ta buyurtma")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("heading", { name: "Rad etilgan pochtani qabul qilish" })).toBeVisible();

    await enterScanCode(page, page.locator("body"), REFUSED_MAIL_QR, "Ochish");
    await expect(page).toHaveURL(/\/mails\/2476$/);
    const dialog = page.getByRole("dialog", { name: "Rad etilgan pochtani qabul qilish" });
    await expect(dialog).toBeVisible({ timeout: 60_000 });
    await expect(dialog.getByText(/Pochta №2476/)).toBeVisible();
    await expectNoHorizontalScroll(page);
    expect(leaked).toEqual([]);
  });

  test("«Marketga topshirish» → market varag'i → /new-orders/cancelled/:id, kamera market QR bosqichida", async ({ page }) => {
    const { leaked, marketQrScans, marketQr } = await mockUniversalScanModesApi(page);
    await page.goto("/scan");
    await expect(page.getByRole("heading", { name: "QR skaner" })).toBeVisible({ timeout: 60_000 });

    await chooseMode(page, "Marketga topshirish");
    const sheet = page.getByRole("dialog", { name: "Marketni tanlang" });
    await expect(sheet.getByText("3 ta bekor qilingan buyurtma")).toBeVisible();
    await sheet.getByRole("button", { name: /Baraka Shop/ }).click();

    await expect(page).toHaveURL(/\/new-orders\/cancelled\/201$/);
    const dialog = page.getByRole("dialog", { name: "Market QR skanerlash" });
    await expect(dialog).toBeVisible({ timeout: 60_000 });
    await enterCode(page, dialog, marketQr);
    await expect.poll(() => marketQrScans).toEqual([marketQr]);
    // Kamera yopilmaydi — o'sha maqsad keyingi bosqichda (buyurtmalarni tanlash).
    await expect(page.getByRole("dialog", { name: "Buyurtmalarni tanlash" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    expect(leaked).toEqual([]);
  });
});
