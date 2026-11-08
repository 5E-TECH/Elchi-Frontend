import { expect, test, type Locator, type Page } from "@playwright/test";
import { correctionPageData, mockCorrectionPosts } from "./support/paymentCorrectionActions";
import { setupShellSession } from "./support/shellSession";

/**
 * T6-FE-2 (N2) — telefon (390): tafsilot varag'ida «Summani tahrirlash» tepada, «Qaytarish» ostida, «Yopish» yo'q
 * (maket `superadmin-payments-history-detail-dialog-correctable`, telefon); tasdiq varag'ida xato chiqsa oqibatlar
 * yashirinadi va xato qutisi ko'rinadi (`…-reverse-errors`, `…-correct-amount-errors`, telefon). Forma va tasdiq —
 * pastki varaqa (ekran eni, pastga yopishgan). Gorizontal skroll yo'q, tugmalar ≥ 44 px, maydon shrifti 16 px.
 */
const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** Varaqa: ekran eni bo'ylab va pastki chetga yopishgan (siljish harakati tugagach o'lchanadi). */
const expectBottomSheet = async (page: Page, sheet: Locator) => {
  await expect
    .poll(async () => {
      const box = await sheet.boundingBox();
      const viewport = page.viewportSize();
      if (!box || !viewport) return false;
      return Math.abs(box.y + box.height - viewport.height) <= 1 && box.width >= viewport.width - 1 && box.x <= 1;
    })
    .toBe(true);
};

/** Ko'rinadigan footer tugmalari ≥ 44 px. */
const expectFooterTargets = async (sheet: Locator) => {
  const heights = await sheet.locator("[data-dialog-footer]").evaluate((footer) =>
    Array.from(footer.querySelectorAll("button"))
      .filter((button) => button.getClientRects().length > 0)
      .map((button) => button.getBoundingClientRect().height),
  );
  expect(heights.length).toBeGreaterThan(0);
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
};

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
  await expectBottomSheet(page, form);
  const reason = form.getByRole("textbox", { name: /^Sabab/ });
  await expect(reason).toHaveCSS("font-size", "16px");
  await reason.fill("Boshqa kuryer tanlab yuborilgan");
  await expectFooterTargets(form);
  expect(await noHorizontalScroll(page)).toBe(true);
  await form.getByRole("button", { name: "Davom etish" }).click();
  const confirm = page.getByRole("alertdialog", { name: "To'lovni qaytarishni tasdiqlang" });
  await expectBottomSheet(page, confirm);
  await expectFooterTargets(confirm);
  await expect(confirm.getByRole("list")).toBeVisible();
  await confirm.getByRole("button", { name: "Qaytarish" }).click();
  const alert = confirm.getByRole("alert");
  await expect(alert).toContainText("Karta arxivda");
  await expect(alert).toBeInViewport();
  await expect(confirm.getByRole("list")).toBeHidden();
  expect(await noHorizontalScroll(page)).toBe(true);
  expect(leaked).toEqual([]);
});

test("390: «Summani tahrirlash» — varaqa, AMOUNT_EXCEEDS xatosi ko'rinadi, oqibatlar yashirin, «Tahrirlash» o'chiq", async ({ page }) => {
  const { leaked } = await setupShellSession(page, "superadmin", "Shodiyor Ergashev", correctionPageData());
  const { posts } = await mockCorrectionPosts(page, [
    { status: 409, body: { statusCode: 409, message: "x", code: "AMOUNT_EXCEEDS", max: 1_200_000 } },
  ]);
  await page.goto("/payments");
  const card = page.getByRole("button", { name: /^Kuryer to'lovi/ }).first();
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await page.getByRole("dialog", { name: "Kirim operatsiyasi" }).getByRole("button", { name: "Summani tahrirlash" }).click();

  const form = page.getByRole("dialog", { name: "Summani tahrirlash" });
  await expectBottomSheet(page, form);
  const amount = form.getByRole("textbox", { name: /^To'g'ri summa/ });
  await expect(amount).toHaveCSS("font-size", "16px");
  await amount.fill("2500000");
  await expect(form).toContainText("+650 000 so'm");
  await form.getByRole("textbox", { name: /^Sabab/ }).fill("Kuryer ko'proq topshirgan");
  await expectFooterTargets(form);
  expect(await noHorizontalScroll(page)).toBe(true);
  await form.getByRole("button", { name: "Davom etish" }).click();

  const confirm = page.getByRole("alertdialog", { name: "Summani tahrirlashni tasdiqlang" });
  await expectBottomSheet(page, confirm);
  await expect(confirm.getByRole("list")).toBeVisible();
  await confirm.getByRole("button", { name: "Tahrirlash" }).click();
  const alert = confirm.getByRole("alert");
  await expect(alert).toContainText("Ko'pi bilan 1 200 000 so'm");
  await expect(alert).toBeInViewport();
  await expect(confirm.getByRole("list")).toBeHidden();
  await expect(confirm.getByRole("button", { name: "Tahrirlash" })).toBeDisabled();
  await expectFooterTargets(confirm);
  expect(await noHorizontalScroll(page)).toBe(true);
  expect(posts).toHaveLength(1);
  expect(leaked).toEqual([]);
});
