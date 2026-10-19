import { expect, test } from "@playwright/test";
import { mockDispatchApi, openDispatch } from "./support/floor";
import { enterCode, expectNoHorizontalScroll, FAKE_CAMERA, openScannerFromBottomNav } from "./support/scannerCamera";
import { toast } from "./support/toast";

/**
 * 390px: `/dispatch` — markaziy «Skaner» kamerani SHU sahifa ustida ochadi (ega 2026-10-19; sahifada «Kamera»
 * tugmasi yo'q). Kamera har skandan keyin yopilmaydi; paket QR rad etiladi; savat qurilmada (ega D2) — sahifa
 * yangilansa ham buyurtma va tanlov joyida, so'ng kuryerga biriktiriladi.
 */
test.use(FAKE_CAMERA);

test.describe("Biriktirish — kamera va qurilmadagi savat, 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("markaziy tugma → kamera → kodlar: savatga qo'shiladi, paket QR rad; yangilangach savat joyida → biriktirish", async ({ page }) => {
    const api = await mockDispatchApi(page);
    await openDispatch(page);
    await expect(page.getByRole("button", { name: /Kamera/ })).toHaveCount(0);

    const camera = await openScannerFromBottomNav(page, "Biriktirish");
    await expect(camera.getByText("Toshkent HQ · savatda 0 ta")).toBeVisible();

    await enterCode(page, camera, "tok-10285");
    await expect(camera.getByText("Qo'shildi №10285")).toBeVisible();
    await expect(camera.getByText("Toshkent HQ · savatda 1 ta")).toBeVisible();

    // Paket QR — so'rovsiz rad, kamera ochiq qoladi.
    await enterCode(page, camera, "BTB-0418");
    await expect(camera.getByText("Noto'g'ri QR turi — buyurtma yorlig'idagi QR kodni skanerlang")).toBeVisible();
    await enterCode(page, camera, "tok-10316");
    await expect(camera.getByText("Toshkent HQ · savatda 2 ta")).toBeVisible();
    expect(api.lookups).toEqual(["tok-10285", "tok-10316"]);

    await camera.getByRole("button", { name: "Tugatish" }).click();
    await expect(camera).toBeHidden();
    await page.getByRole("checkbox", { name: "№10316 ni tanlash" }).click();

    // Savat qurilmada: sahifa yangilansa ham buyurtmalar va tanlov joyida, qayta so'ralmaydi.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Kuryerga biriktirish" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("checkbox", { name: "№10285 ni tanlash" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "№10316 ni tanlash" })).not.toBeChecked();
    expect(api.lookups).toEqual(["tok-10285", "tok-10316"]);

    await page.getByRole("button", { name: "Kuryerga biriktirish — 1 ta", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Kuryerni tanlang" });
    await dialog.getByRole("radio", { name: /Sardor Aliyev/ }).click();
    await dialog.getByRole("button", { name: "Biriktirish — 1 ta" }).click();
    await expect(toast(page, "1 ta buyurtma Sardor Aliyevga biriktirildi")).toBeVisible();
    expect(api.assigns).toEqual([{ courier_id: "263", order_ids: ["10285"] }]);
    // Biriktirilgani savatdan olindi, tanlanmagani qoldi.
    await expect(page.getByText("№10285")).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: "№10316 ni tanlash" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    expect(api.leaked).toEqual([]);
  });
});
