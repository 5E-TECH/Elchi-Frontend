import { expect, test } from "@playwright/test";
import {
  APPROVE_DIALOG,
  MAKET_GROUPS,
  mockReturnApi,
  openActionDialog,
  openReturnTab,
  returnOrder,
} from "./support/mailsReturn";
import { expectToast } from "./support/toast";

/**
 * Pochta → Qaytarish (YEI06cPN) — 390px. u5HTJtqK: tasdiq oynasi telefonda pastki varaqa (maket
 * `superadmin-ops-logistics-approve-dialog`), tugmalar ≥ 44px, gorizontal skroll yo'q.
 */
test.describe("Pochta → Qaytarish — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("guruh, qatorlar va Tasdiqlash/Rad etish tugmalari ekranga sig'adi; tasdiqlash oyna orqali ishlaydi", async ({
    page,
  }) => {
    const { actions, leaked } = await mockReturnApi(page);
    await openReturnTab(page);

    for (const name of ["Tasdiqlash", "Rad etish", "Tanlovni bekor qilish"]) {
      const button = page.getByRole("button", { name });
      await button.scrollIntoViewIfNeeded();
      const box = (await button.boundingBox())!;
      expect(box.x, name).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, name).toBeLessThanOrEqual(390);
      expect(box.height, `${name}: telefonda ≥ 44px`).toBeGreaterThanOrEqual(44);
    }
    // Belgining bosish maydoni — 44px `label` (guruh) va butun karta (so'rov).
    const groupTarget = (await page.getByRole("checkbox", { name: "Baxodir Kuryer: barchasini tanlash" }).locator("xpath=..").boundingBox())!;
    expect(groupTarget.height).toBeGreaterThanOrEqual(44);
    expect(groupTarget.width).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    // Telefonda so'rov — `label` karta: matnni bosish ham belgini almashtiradi.
    await page.getByText("Karimova Nodira").click();
    await expect(page.getByRole("checkbox", { name: "Karimova Nodira so'rovini tanlash" })).toBeChecked();
    const dialog = await openActionDialog(page, "approve");
    expect(actions).toEqual([]);
    // O'lchash ochilish animatsiyasi tugagach (transform paytida 43,9999 px chiqishi mumkin).
    await dialog.evaluate((node) =>
      Promise.allSettled(node.ownerDocument.getAnimations().map((animation) => animation.finished)),
    );
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    // Pastki varaqa — ekranning pastiga yopishgan.
    expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(844 - 1);
    for (const name of ["Bekor qilish", "1 tasini tasdiqlash"]) {
      const button = (await dialog.getByRole("button", { name }).boundingBox())!;
      expect(button.height, `${name}: telefonda ≥ 44px`).toBeGreaterThanOrEqual(44);
      expect(button.x + button.width, name).toBeLessThanOrEqual(390);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    await dialog.getByRole("button", { name: "1 tasini tasdiqlash" }).click();
    await expect(page.getByRole("alertdialog", { name: APPROVE_DIALOG })).toHaveCount(0);
    await expect(page.getByText("Karimova Nodira")).toHaveCount(0);
    await expectToast(page, "1 ta tasdiqlandi", { tone: "success" });
    expect(actions[0]?.body).toEqual({ order_ids: ["1251171"] });
    expect(leaked).toEqual([]);
  });

  test("12 ta buyurtma, 403 — xato bloki ko'rinadi, pastki tugmalar ortida qolmaydi", async ({ page }) => {
    const groups = [
      ...MAKET_GROUPS,
      {
        courier: { id: "58", name: "Bekzod Aliyev", phone_number: "+998901112255" },
        courier_id: "58",
        orders: ["10260", "10261", "10262", "10263", "10264"].map((id, index) =>
          returnOrder(id, `Mijoz ${index + 1}`, index % 2 ? "waiting" : "on the road", "58"),
        ),
      },
    ];
    const { leaked } = await mockReturnApi(page, {
      groups,
      approve: () => ({ status: 403, body: { statusCode: 403, message: "Buyurtma boshqa filial kuryerida" } }),
    });
    await openReturnTab(page, "Sherzod Komilov");
    for (const courier of ["Jasur Tursunov", "Sherzod Komilov", "Kuryer", "Bekzod Aliyev"]) {
      await page.getByRole("checkbox", { name: `${courier}: barchasini tanlash` }).check();
    }
    await expect(page.getByRole("region", { name: "Tanlangan so'rovlar" })).toContainText("12 ta so'rov tanlandi");
    const dialog = await openActionDialog(page, "approve");

    await dialog.getByRole("button", { name: "12 tasini tasdiqlash" }).click();
    const alert = dialog.getByRole("alert");
    await expect(alert).toContainText("Ayrim buyurtmalar boshqa filial kuryerida");
    await expect(alert).not.toContainText("Buyurtma boshqa filial kuryerida");
    // Xato bloki oyna tanasining ko'rinadigan qismida (tana o'zi suriladi) va pastki tugmalardan yuqorida.
    await expect(alert).toBeInViewport({ ratio: 0.95 });
    await expect
      .poll(() =>
        alert.evaluate((node) => {
          const box = node.getBoundingClientRect();
          const body = node.closest("[data-dialog-body]")!.getBoundingClientRect();
          return box.top >= body.top - 1 && box.bottom <= body.bottom + 1;
        }),
      )
      .toBe(true);
    const alertBox = (await alert.boundingBox())!;
    const cancelBox = (await dialog.getByRole("button", { name: "Bekor qilish" }).boundingBox())!;
    expect(alertBox.y + alertBox.height, "xato bloki tugmalardan yuqorida").toBeLessThanOrEqual(cancelBox.y);
    expect(leaked).toEqual([]);
  });
});
