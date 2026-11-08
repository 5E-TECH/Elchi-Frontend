import { expect, test, type Page } from "@playwright/test";
import { correctionPageData, mockCorrectionPosts } from "./support/paymentCorrectionActions";
import { setupShellSession } from "./support/shellSession";

/**
 * T6-FE-2 (N2) — telefon (390): tafsilot varag'ida «Summani tahrirlash» tepada, «Qaytarish» ostida, «Yopish» yo'q
 * (maket `superadmin-payments-history-detail-dialog-correctable`, telefon); tasdiq varag'ida xato chiqsa oqibatlar
 * yashirinadi va xato qutisi ko'rinadi (`…-reverse-errors`, telefon). Gorizontal skroll yo'q, tugmalar ≥ 44 px.
 */
const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("390: tafsilot pastki qismi ustma-ust, tasdiqda xato ko'rinadi, oqibatlar yashirin", async ({ page }) => {
  const { leaked } = await setupShellSession(page, "superadmin", "Shodiyor Ergashev", correctionPageData());
  await mockCorrectionPosts(page, [{ status: 409, body: { statusCode: 409, message: "x", code: "CARD_ARCHIVED" } }]);
  await page.goto("/payments");
  const card = page.getByRole("button", { name: /^Kuryer to'lovi/ }).first();
  await card.scrollIntoViewIfNeeded();
  await card.click();

  const sheet = page.getByRole("dialog", { name: "Kirim operatsiyasi" });
  const correct = sheet.getByRole("button", { name: "Summani tahrirlash" });
  const reverse = sheet.getByRole("button", { name: "Qaytarish" });
  await expect(correct).toBeVisible();
  await expect(reverse).toBeVisible();
  // Bir lahzada o'lchanadi (varaqa pastdan siljib chiqadi): ko'rinadigan tugmalar tepadan pastga.
  const buttons = await sheet.locator("[data-dialog-footer]").evaluate((footer) =>
    Array.from(footer.querySelectorAll("button"))
      .filter((button) => button.getClientRects().length > 0)
      .map((button) => {
        const box = button.getBoundingClientRect();
        return { name: button.textContent?.trim(), top: box.top, height: box.height, width: box.width };
      })
      .sort((a, b) => a.top - b.top),
  );
  expect(buttons.map((button) => button.name)).toEqual(["Summani tahrirlash", "Qaytarish"]);
  for (const button of buttons) {
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(button.width).toBeGreaterThan(300);
  }
  await expect(sheet.locator("[data-dialog-footer]").getByRole("button", { name: "Yopish" })).toBeHidden();
  expect(await noHorizontalScroll(page)).toBe(true);

  await reverse.click();
  const form = page.getByRole("dialog", { name: "To'lovni qaytarish" });
  await form.getByRole("textbox", { name: /^Sabab/ }).fill("Boshqa kuryer tanlab yuborilgan");
  await form.getByRole("button", { name: "Davom etish" }).click();
  const confirm = page.getByRole("alertdialog", { name: "To'lovni qaytarishni tasdiqlang" });
  await expect(confirm.getByRole("list")).toBeVisible();
  await confirm.getByRole("button", { name: "Qaytarish" }).click();
  const alert = confirm.getByRole("alert");
  await expect(alert).toContainText("Karta arxivda");
  await expect(alert).toBeInViewport();
  await expect(confirm.getByRole("list")).toBeHidden();
  expect(await noHorizontalScroll(page)).toBe(true);
  expect(leaked).toEqual([]);
});
