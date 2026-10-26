import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, openScopedRegions } from "./support/regionsScope";

/** aLx7Di99 — 1440: menejer sarlavhasi filial kesimida («Urgut filiali buyurtmalari»), viloyat da'vosi yo'q. */
test.describe.configure({ timeout: 180_000 });

test("1440: menejer — «Urgut filiali buyurtmalari», «Samarqand viloyati buyurtmalari» yo'q", async ({ page }) => {
  const mock = await openScopedRegions(page, "manager");
  await expect(
    page.getByText("Urgut filiali buyurtmalari · Tuman ustiga bosib batafsil ma'lumotni ko'ring"),
  ).toBeVisible();
  await expect(page.getByText(/· Urgut filiali buyurtmalari$/).first()).toBeVisible();
  await expect(page.getByText(/Samarqand viloyati buyurtmalari/)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  expect(mock.leaked).toEqual([]);
});

test("1440: kuryer — «Sizga tegishli buyurtmalar»", async ({ page }) => {
  await openScopedRegions(page, "courier");
  await expect(page.getByText("Faqat o'zingizga tegishli tuman statistikasi")).toBeVisible();
  await expect(page.getByText(/· Sizga tegishli buyurtmalar$/).first()).toBeVisible();
  await expect(page.getByText(/Samarqand viloyati buyurtmalari/)).toHaveCount(0);
});
