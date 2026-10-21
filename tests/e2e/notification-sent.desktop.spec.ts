import { expect, test } from "@playwright/test";
import { FAILED_ID, PARTIAL_ID, mockSentApi, noHorizontalScroll, shot } from "./support/notificationSent";

/**
 * NS-2 — «Yuborilganlar» (`/notifications/sent`; maketlar `superadmin-notifications-sent`, `-loading`, `-empty`,
 * `-error`, `-sent-detail-dialog`, `-sent-detail-states`), 1440px. Barcha so'rovlar soxta, faqat GET.
 */
test.describe("Yuborilganlar — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`ro'yxat: ustunlar, natija izohlari, sahifalash va filtrlar URL'da (${theme})`, async ({ page }) => {
      const mock = await mockSentApi(page, { theme });
      await page.goto("/notifications/sent");

      await expect(page.getByRole("heading", { level: 1, name: "Yuborilganlar" })).toBeVisible({ timeout: 60_000 });
      await expect(page.locator("#main-content").getByRole("link", { name: "Bildirishnomalar" })).toHaveAttribute(
        "href",
        "/inbox",
      );
      const table = page.getByRole("table", { name: "Yuborilgan xabarlar" });
      await expect(table.getByRole("row")).toHaveCount(11);
      await expect(page.getByText("14 ta", { exact: true })).toBeVisible();
      await expect(page.getByText("1–10 / 14 ta xabar")).toBeVisible();

      const partial = table.getByRole("row", { name: /Ertaga qabul punkti/ });
      await expect(partial).toContainText("Qisman yuborildi");
      await expect(partial).toContainText("O'tkazib yuborildi: Telegram 17, SMS 9");
      await expect(partial).toContainText("148 ta qabul qiluvchi");
      await expect(partial).toContainText("Shodiyor Ergashev");
      await expect(table.getByRole("row", { name: /Kunni yakunlashni 19:00/ })).toContainText("Nilufar Rashidova");
      await expect(table.getByRole("row", { name: /Marketlarga/ })).toContainText("dan beri");
      await expect(table.getByRole("row", { name: /texnik ishlar/ })).toContainText("SMS: provayder ulanmagan");
      await expect(table.getByRole("row", { name: /Ombor/ })).toContainText("Bildirishnomani o'chirganlar: 3");
      const failed = table.getByRole("row", { name: /Kuryerlar yig'ilishi/ });
      await expect(failed).toContainText("Hech kimga ketmadi — qayta yuboring");
      await expect(failed).toContainText("Qabul qiluvchi yo'q");
      // Xom backend matni (`message`, `error`) ko'rinmaydi.
      await expect(page.getByText(/ECONNREFUSED|Partially dispatched|Notification dispatched/)).toHaveCount(0);
      expect(await noHorizontalScroll(page)).toBe(true);
      await shot(page, `list-desktop-${theme}`);

      await page.getByRole("button", { name: "Keyingi sahifa" }).click();
      await expect(page.getByText("11–14 / 14 ta xabar")).toBeVisible();
      await expect(page).toHaveURL(/[?&]page=2/);

      // «Natija: Xato» — 1-sahifaga qaytadi, so'rovda `status=failed`.
      await page.getByRole("combobox", { name: "Natija" }).click();
      await page.getByRole("option", { name: "Xato" }).click();
      await expect(table.getByRole("row")).toHaveCount(2);
      await expect(page).toHaveURL(/status=failed/);
      await expect(page).not.toHaveURL(/page=2/);
      expect(mock.listRequests.at(-1)?.get("status")).toBe("failed");

      // «Kim yubordi: Nilufar» — xato natijada yo'q → «Filtrni tozalash».
      await page.getByRole("combobox", { name: "Kim yubordi" }).click();
      await page.getByRole("option", { name: /Nilufar Rashidova/ }).click();
      await expect(page).toHaveURL(/created_by=7/);
      await expect(page.getByText("Bu natija bo'yicha xabar yo'q")).toBeVisible();
      await shot(page, `empty-filtered-desktop-${theme}`);
      await page.getByRole("button", { name: "Filtrni tozalash" }).click();
      await expect(table.getByRole("row")).toHaveCount(11);
      await expect(page).not.toHaveURL(/status=|created_by=/);
      expect(mock.leaked).toEqual([]);
    });
  }

  test("tafsilot oynasi URL'da (?id=); xato bilan tugaganida «Qayta yuborish» → /notifications/send", async ({ page }) => {
    const mock = await mockSentApi(page);
    await page.goto("/notifications/sent");
    const table = page.getByRole("table", { name: "Yuborilgan xabarlar" });
    await expect(table.getByRole("row")).toHaveCount(11, { timeout: 60_000 });

    await table.getByRole("button", { name: "Ertaga qabul punkti 10:00 dan ishlaydi", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Ertaga qabul punkti 10:00 dan ishlaydi" });
    await expect(dialog.getByText("Rol: Kuryer, Market")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`id=${PARTIAL_ID}`));
    await shot(page, "detail-partial-desktop-light");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page).not.toHaveURL(/id=/);

    await table.getByRole("button", { name: /Kuryerlar yig'ilishi.*natijasini ochish/ }).click();
    const failed = page.getByRole("dialog", { name: "Kuryerlar yig'ilishi soat 9:00 da" });
    await expect(failed.getByText("Yuborish xato bilan tugadi")).toBeVisible();
    await expect(failed.getByText(/ECONNREFUSED/)).toHaveCount(0);
    await shot(page, "detail-failed-desktop-light");
    await expect(page).toHaveURL(new RegExp(`id=${FAILED_ID}`));
    await failed.getByRole("link", { name: "Qayta yuborish" }).click();
    await expect(page).toHaveURL(/\/notifications\/send$/);
    await expect(page.getByRole("heading", { level: 1, name: "Xabar yuborish" })).toBeVisible();

    // Yuborish sahifasi sarlavhasida «Yuborilganlar» — orqaga.
    await page.getByRole("link", { name: "Yuborilganlar" }).click();
    await expect(page).toHaveURL(/\/notifications\/sent$/);
    await expect(page.getByRole("heading", { level: 1, name: "Yuborilganlar" })).toBeVisible();
    expect(mock.leaked).toEqual([]);
  });

  test("eskirgan havola (?id=…) — «Xabar topilmadi»", async ({ page }) => {
    await mockSentApi(page);
    await page.goto("/notifications/sent?id=00000000-0000-0000-0000-000000000000");
    const dialog = page.getByRole("dialog", { name: "Yuborilgan xabar" });
    await expect(dialog.getByText("Xabar topilmadi")).toBeVisible({ timeout: 60_000 });
    // Pastdagi «Yopish» (yuqoridagi × ham shu nomda).
    await dialog.getByRole("button", { name: "Yopish" }).last().click();
    await expect(page).not.toHaveURL(/id=/);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`xato va bo'sh holatlar (${theme})`, async ({ page }) => {
      const mock = await mockSentApi(page, { theme });
      mock.failList = true;
      await page.goto("/notifications/sent");
      await expect(page.getByText("Yuborilganlar ro'yxatini olib bo'lmadi")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(/notification_dispatches/)).toHaveCount(0);
      await expect(page.getByRole("combobox", { name: "Natija" })).toBeDisabled();
      await shot(page, `error-desktop-${theme}`);

      mock.failList = false;
      mock.emptyList = true;
      await page.getByRole("button", { name: "Qayta urinish" }).click();
      await expect(page.getByText("Hali xabar yuborilmagan")).toBeVisible();
      // Hech narsa yuborilmagan — filtrlar yo'q (maket `*-sent-empty`).
      await expect(page.getByRole("combobox", { name: "Natija" })).toHaveCount(0);
      await shot(page, `empty-desktop-${theme}`);
    });
  }

  test("admin ham ochadi (canSendNotifications)", async ({ page }) => {
    await mockSentApi(page, { role: "admin" });
    await page.goto("/notifications/sent");
    await expect(page.getByRole("table", { name: "Yuborilgan xabarlar" }).getByRole("row")).toHaveCount(11, {
      timeout: 60_000,
    });
  });

  test("menejer — /notifications/sent ochilmaydi", async ({ page }) => {
    const mock = await mockSentApi(page, { role: "manager" });
    await page.goto("/notifications/sent");
    await expect(page.getByRole("heading", { level: 1, name: "Yuborilganlar" })).toHaveCount(0);
    await page.waitForTimeout(1000);
    expect(mock.listRequests).toHaveLength(0);
  });
});
