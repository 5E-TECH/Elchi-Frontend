import { expect, test } from "@playwright/test";
import {
  APPROVE_DIALOG,
  MAKET_GROUPS,
  REJECT_DIALOG,
  mockReturnApi,
  openActionDialog,
  openReturnTab,
} from "./support/mailsReturn";
import { expectToast } from "./support/toast";

/**
 * Pochta → Qaytarish (YEI06cPN) — 1440px. u5HTJtqK: «Tasdiqlash» / «Rad etish» — faqat tasdiq oynasi orqali (maket
 * `superadmin-ops-logistics-approve-dialog`, Ops'dagi nusxadan ko'chgan), natija — xabar (`*-approve-result`).
 */
const MAKET_IDS = ["10244", "10241", "10223", "10236", "10229", "10250", "10198"];

test.describe("Pochta → Qaytarish — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ TC2: return_requested buyurtmalar — kuryer guruhi va har buyurtma qatori ko'rinadi", async ({ page }) => {
    const { leaked } = await mockReturnApi(page);
    await openReturnTab(page);

    await expect(page.getByText("Jami qaytarish so'rovlari")).toBeVisible();
    await expect(page.getByText("2 ta buyurtma qaytarish so'rovi")).toBeVisible();
    await expect(page.getByText("Aliyev Vali")).toBeVisible();
    await expect(page.getByText("Karimova Nodira")).toBeVisible();
    await expect(page.getByText("Hozircha kurierlardan qaytarish so'rovi kelmagan")).toHaveCount(0);
    expect(leaked).toEqual([]);
  });

  test("⭐ TC3: «Tasdiqlash» → tasdiq oynasi (oynasiz so'rov yo'q) → POST approve { order_ids }, qator yo'qoladi", async ({
    page,
  }) => {
    const { actions, leaked } = await mockReturnApi(page);
    await openReturnTab(page);

    // Dizayn v2: jadval qatoridagi belgi — «⟨mijoz⟩ so'rovini tanlash».
    await page.getByRole("checkbox", { name: "Aliyev Vali so'rovini tanlash" }).check();
    await expect(page.getByRole("region", { name: "Tanlangan so'rovlar" })).toContainText("1 ta so'rov tanlandi");
    const dialog = await openActionDialog(page, "approve");
    expect(actions).toEqual([]);
    await expect(dialog).toContainText("1 ta buyurtma kuryerlardan olinadi va HQ omboriga qaytariladi.");

    const response = page.waitForResponse(
      (res) => res.url().endsWith("/post/return-requests/approve") && res.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "1 tasini tasdiqlash" }).click();
    const approve = await response;
    expect(approve.status()).toBeGreaterThanOrEqual(200);
    expect(approve.status()).toBeLessThan(300);
    expect(actions).toEqual([{ type: "approve", body: { order_ids: ["1251170"] }, status: 201 }]);

    await expect(page.getByRole("alertdialog", { name: APPROVE_DIALOG })).toHaveCount(0);
    await expect(page.getByText("Aliyev Vali")).toHaveCount(0);
    await expect(page.getByText("Karimova Nodira")).toBeVisible();
    await expectToast(page, "1 ta tasdiqlandi", { tone: "success" });
    await expectToast(page, "1 ta buyurtma omborga qaytarildi.", { tone: "success" });
    expect(leaked).toEqual([]);
  });

  test("guruhni butunlay tasdiqlash → ro'yxat bo'shaydi va bo'sh holat matni chiqadi", async ({ page }) => {
    const { actions } = await mockReturnApi(page);
    await openReturnTab(page);

    // Guruh qatoridagi belgi — «⟨kuryer⟩: barchasini tanlash» (faqat shu kuryer).
    await page.getByRole("checkbox", { name: "Baxodir Kuryer: barchasini tanlash" }).check();
    const dialog = await openActionDialog(page, "approve");
    await dialog.getByRole("button", { name: "2 tasini tasdiqlash" }).click();

    await expect(page.getByText("Hozircha kurierlardan qaytarish so'rovi kelmagan")).toBeVisible();
    expect(actions.map((action) => [action.type, (action.body as { order_ids: string[] }).order_ids.sort()])).toEqual([
      ["approve", ["1251170", "1251171"]],
    ]);
  });

  test("⭐ oyna kuryer guruhlarini ko'rsatadi; qisman natija — ogohlantirish va o'tkazilgan raqam", async ({ page }) => {
    const { actions, leaked } = await mockReturnApi(page, {
      groups: MAKET_GROUPS,
      approve: () => ({
        status: 200,
        body: {
          statusCode: 200,
          message: "Qaytarish so'rovlari tasdiqlandi — buyurtmalar omborga qaytarildi",
          data: { approved: 6, order_ids: MAKET_IDS.filter((id) => id !== "10236"), skipped_order_ids: ["10236"] },
        },
      }),
    });
    await openReturnTab(page, "Sherzod Komilov");
    await page.getByRole("checkbox", { name: "Barcha so'rovlarni tanlash" }).check();
    const dialog = await openActionDialog(page, "approve");

    await expect(dialog).toContainText("7 ta buyurtma kuryerlardan olinadi va HQ omboriga qaytariladi.");
    await expect(dialog).toContainText("+ 1 ta buyurtma kuryersiz");
    const groups = dialog.getByRole("list", { name: "Kuryerlar bo'yicha" });
    await expect(groups).toContainText("Jasur Tursunov");
    await expect(groups).toContainText("+ yana 2 ta");
    await expect(groups).toContainText("Kuryer biriktirilmagan");
    // Holat — jadval badge'i matni (xom backend qiymati emas).
    await expect(groups).toContainText("Kuryer qabul qilmagan");
    await expect(groups).not.toContainText("on the road");
    await expect(dialog).toContainText("Bu amalni bekor qilib bo'lmaydi.");
    // Oyna kengligi — maket 480 px.
    const box = (await dialog.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(481);

    await dialog.getByRole("button", { name: "7 tasini tasdiqlash" }).click();
    await expect(page.getByRole("alertdialog", { name: APPROVE_DIALOG })).toHaveCount(0);
    await expectToast(page, "6 ta tasdiqlandi, 1 tasi o'tkazib yuborildi", { tone: "warning" });
    await expectToast(page, "№10236 ni shu orada boshqa xodim ko'rib chiqqan yoki holati o'zgargan.", { tone: "warning" });
    expect(actions.map((action) => action.body)).toEqual([{ order_ids: MAKET_IDS }]);
    expect(leaked).toEqual([]);
  });

  test("⭐ 409 (tanlov eskirgan) — oyna ochiq, i18n matn (xom backend matni emas); «Bekor qilish» — tanlov saqlanadi", async ({
    page,
  }) => {
    const raw = "Tanlangan buyurtmalar shu orada qabul qilingan yoki ko'rib chiqilgan — sahifani yangilang";
    const { actions } = await mockReturnApi(page, {
      groups: MAKET_GROUPS,
      approve: () => ({ status: 409, body: { statusCode: 409, message: raw, error: "Conflict" } }),
    });
    await openReturnTab(page, "Sherzod Komilov");
    await page.getByRole("checkbox", { name: "Barcha so'rovlarni tanlash" }).check();
    const dialog = await openActionDialog(page, "approve");

    await dialog.getByRole("button", { name: "7 tasini tasdiqlash" }).click();
    await expect(dialog.getByRole("alert")).toContainText(
      "Tanlov eskirgan: tanlangan so'rovlar shu orada ko'rib chiqilgan yoki holati o'zgargan.",
    );
    await expect(page.getByText(raw)).toHaveCount(0);
    expect(actions.map((action) => action.status)).toEqual([409]);

    await dialog.getByRole("button", { name: "Bekor qilish" }).click();
    await expect(page.getByRole("alertdialog", { name: APPROVE_DIALOG })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Tanlangan so'rovlar" })).toContainText("7 ta so'rov tanlandi");
  });

  test("⭐ «Rad etish» — qizil oyna; «Bekor qilish» — so'rov ketmaydi; tasdiqlansa — xabar, ro'yxat bo'shaydi", async ({
    page,
  }) => {
    const { actions, leaked } = await mockReturnApi(page);
    await openReturnTab(page);
    const panel = page.getByRole("region", { name: "Tanlangan so'rovlar" });
    await expect(panel.getByRole("button", { name: "Rad etish", exact: true })).toBeDisabled();

    await page.getByRole("checkbox", { name: "Barcha so'rovlarni tanlash" }).check();
    let dialog = await openActionDialog(page, "reject");
    await expect(dialog).toContainText(
      "2 ta so'rov rad etiladi: buyurtmalar omborga qaytmaydi, kuryerda (yoki filial pochtasida) qoladi.",
    );
    await dialog.getByRole("button", { name: "Bekor qilish" }).click();
    await expect(dialog).toHaveCount(0);
    expect(actions).toEqual([]);

    dialog = await openActionDialog(page, "reject");
    await dialog.getByRole("button", { name: "2 tasini rad etish" }).click();
    await expect(page.getByRole("alertdialog", { name: REJECT_DIALOG })).toHaveCount(0);
    await expectToast(page, "2 ta so'rov rad etildi", { tone: "success" });
    await expect(page.getByText("Hozircha kurierlardan qaytarish so'rovi kelmagan")).toBeVisible();
    expect(actions).toEqual([{ type: "reject", body: { order_ids: ["1251170", "1251171"] }, status: 201 }]);
    expect(leaked).toEqual([]);
  });
});
