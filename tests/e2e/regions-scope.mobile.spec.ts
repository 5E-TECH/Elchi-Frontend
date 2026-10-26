import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, openScopedRegions } from "./support/regionsScope";

/** aLx7Di99 — 390: kuryer va menejer sarlavhasi kesim bo'yicha, gorizontal oqish yo'q. */
test.describe.configure({ timeout: 180_000 });

test("390: kuryer — «Faqat o'zingizga tegishli …», oqish yo'q", async ({ page }) => {
  const mock = await openScopedRegions(page, "courier");
  await expect(page.getByText("Faqat o'zingizga tegishli tuman statistikasi")).toBeVisible();
  await expect(page.getByText(/· Sizga tegishli buyurtmalar$/).first()).toBeVisible();
  await expect(page.getByText(/Samarqand viloyati buyurtmalari/)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  expect(mock.leaked).toEqual([]);
});

test("390: menejer — «Urgut filiali buyurtmalari»", async ({ page }) => {
  await openScopedRegions(page, "manager");
  await expect(page.getByText(/^Urgut filiali buyurtmalari · /)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
