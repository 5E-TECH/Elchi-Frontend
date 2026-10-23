import { expect, test } from "@playwright/test";
import {
  mockCampaignApi,
  noHorizontalScroll,
  openAudience,
  shot,
} from "./support/notificationCampaign";

/**
 * KM-2 — «Auditoriya» telefonda (390px): chiplar va kartalar ≥ 44px, gorizontal skrollsiz, namuna oynasi — pastki
 * varaqa, jadval o'rniga kartalar.
 */
test.describe("Xabar yuborish — auditoriya, 390px", () => {
  test.describe.configure({ timeout: 120_000 });

  for (const theme of ["light", "dark"] as const) {
    test(`konstruktor, son va namuna telefonda (${theme})`, async ({ page }) => {
      const mock = await mockCampaignApi(page, { theme });
      const form = await openAudience(page);

      await form.getByRole("checkbox", { name: "Mijoz" }).check();
      await form.getByRole("checkbox", { name: "Xodim" }).check();
      for (const name of ["Menejer", "Logist"]) {
        const chip = form.getByRole("button", { name });
        expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await chip.click();
      }
      await form.getByRole("checkbox", { name: "Filtrsiz — barcha mijozlarga yuborish" }).click();
      await expect(
        form.getByRole("checkbox", { name: "Filtrsiz — barcha mijozlarga yuborish" }),
      ).toBeChecked();
      const summary = form.getByTestId("audience-summary");
      await expect(summary).toContainText("Auditoriya: 1 210 ta");
      expect(mock.previews.at(-1)).toEqual({
        roles: ["manager", "logist"],
        include_customers: true,
        confirm_all_customers: true,
      });
      for (const name of ["Namunani ko'rish", "Segmentni saqlash"]) {
        expect(
          (await summary.getByRole("button", { name }).boundingBox())!.height,
        ).toBeGreaterThanOrEqual(44);
      }
      expect(await noHorizontalScroll(page)).toBe(true);
      await shot(page, `phone-audience-${theme}`, form);

      await summary.getByRole("button", { name: "Namunani ko'rish" }).click();
      const sample = page.getByRole("dialog", { name: "Auditoriya namunasi" });
      await expect(sample).toContainText("***7434");
      await expect(sample.getByRole("table")).toHaveCount(0);
      expect(await noHorizontalScroll(page)).toBe(true);
      await shot(page, `phone-sample-${theme}`);
      expect(mock.leaked).toEqual([]);
    });
  }

  test("kampaniya progressi telefonda — tugmalar 44px, skrollsiz", async ({ page }) => {
    const mock = await mockCampaignApi(page);
    const form = await openAudience(page);
    await form.getByRole("checkbox", { name: "Market" }).check();
    await expect(form.getByTestId("audience-summary")).toContainText("Auditoriya: 98 ta");
    await form.getByRole("textbox", { name: "Sarlavha" }).fill("Yangi tariflar 1-noyabrdan");
    await form.getByRole("button", { name: /^Yuborish/ }).click();
    await page
      .getByRole("alertdialog", { name: "Xabarni yuborishni tasdiqlang" })
      .getByRole("button", { name: /Ha, yuborish/ })
      .click();
    const progress = page.getByTestId("campaign-progress");
    await expect(progress.getByTestId("campaign-counts")).toContainText("49 / 98 yuborildi");
    for (const name of ["Bekor qilish", "Yangi xabar"]) {
      expect(
        (await progress.getByRole("button", { name }).boundingBox())!.height,
      ).toBeGreaterThanOrEqual(44);
    }
    expect(await noHorizontalScroll(page)).toBe(true);
    await shot(page, "phone-progress", progress);
    expect(mock.leaked).toEqual([]);
  });
});
