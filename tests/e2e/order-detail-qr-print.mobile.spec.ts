import { expect, test } from "@playwright/test";
import { mockOrderDetailApi, openOrderDetail, ORDER_95 } from "./support/orderDetail";
import { mockQrCamera, readQr } from "./support/orderQr";
import { FAKE_CAMERA } from "./support/scannerCamera";

/**
 * TzfF0bmQ — 390px: QR karta va «Chop etish» ekranga sig'adi, usullar pastki varaqada, QR o'qiladi. Kamera kadri
 * soxta (ekrandagi QR rasmi), lekin zanjir haqiqiy: `/scan` → `qr-scanner` → `GET orders/qr-code/:token` → natija.
 */
const TOKEN = "5c0c4c27af78467d451a027e";
const SUPERADMIN = { id: "1", role: "superadmin", name: "E2E superadmin", status: "active" };

test.use(FAKE_CAMERA);
test.describe.configure({ timeout: 180_000 });

test("⭐ kamera ekrandagi QR'ni o'qiydi — aynan shu buyurtma topiladi", async ({ page }) => {
  const { leaked, requests } = await mockOrderDetailApi(
    page,
    { ...ORDER_95, qr_code_token: TOKEN },
    { profile: SUPERADMIN },
  );
  await openOrderDetail(page, "95");
  const qr = page.getByRole("img", { name: /buyurtmasining QR kodi/ });
  await qr.scrollIntoViewIfNeeded();
  await expect(qr.locator("path")).toBeAttached();
  const frame = await qr.locator("..").screenshot();

  await mockQrCamera(page, frame);
  await page.goto("/scan");
  await expect(page).toHaveURL(new RegExp(`/scan/${TOKEN}$`), { timeout: 60_000 });
  await expect(page.getByText("Aliyev Vali").first()).toBeVisible({ timeout: 60_000 });
  expect(requests).toContain(`GET orders/qr-code/${TOKEN}`);
  expect(leaked).toEqual([]);
});

test("⭐ QR va «Chop etish» ekrandan chiqmaydi, QR o'qiladi, usullar varaqada", async ({
  page,
}) => {
  await mockOrderDetailApi(page, { ...ORDER_95, qr_code_token: TOKEN }, { profile: SUPERADMIN });
  await openOrderDetail(page, "95");

  const button = page.getByRole("button", { name: "Chop etish" });
  const qr = page.getByRole("img", { name: /buyurtmasining QR kodi/ });
  await expect(button).toBeVisible();
  await qr.scrollIntoViewIfNeeded();
  await expect(qr).toBeVisible();
  for (const target of [button, qr]) {
    const box = (await target.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  }
  expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(await readQr(page, qr)).toBe(TOKEN);

  await button.click();
  const sheet = page.getByRole("dialog", { name: "Chop etish" });
  await expect(sheet.getByText("Brauzer orqali chop etish")).toBeVisible();
  await expect(sheet.getByText("PDF yorliq (100×60 mm)")).toBeVisible();
});
