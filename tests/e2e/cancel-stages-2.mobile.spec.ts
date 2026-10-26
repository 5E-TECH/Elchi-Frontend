import { expect, test, type Page } from "@playwright/test";
import {
  MARKET,
  mockCancelStages2Api,
  ORDER_BRANCH_3D,
  ORDER_COURIER,
  ORDER_HANDED_PIN,
  ORDER_HQ_ESCALATED,
} from "./support/cancelStages2";

/** vOczoOUE 2-bosqich — 390px: gorizontal skroll yo'q, chiplar ≥ 44 px, kartalarda joy / kun / belgilar. */
test.describe.configure({ timeout: 120_000 });

const pageFits = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("⭐ 390px: «Bekor qilingan» tabi — bosqich chiplari (44 px), kartada «8 kun» + «Eskalatsiya», sahifa sig'adi", async ({ page }) => {
  const { leaked } = await mockCancelStages2Api(page, { list: [ORDER_HQ_ESCALATED, ORDER_BRANCH_3D, ORDER_HANDED_PIN] });
  await page.goto(`/orders?status=${encodeURIComponent("cancelled,cancelled (sent)")}`);
  await expect(page.getByText("Rustam Nazarov")).toBeVisible({ timeout: 90_000 });

  const chips = page.getByRole("group", { name: "Bekor bosqichi bo'yicha" });
  for (const chip of await chips.getByRole("button").all()) {
    expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await expect(page.getByTestId("cancel-return-escalated").first()).toBeVisible();
  await expect(page.getByTestId("cancel-return-age").first()).toHaveText("8 kun");
  expect(await pageFits(page)).toBe(true);

  await chips.getByRole("button", { name: "Filialda" }).click();
  await expect(page.getByText("Nodir Karimov")).toBeVisible();
  await expect(page.getByText("Rustam Nazarov")).toHaveCount(0);
  expect(await pageFits(page)).toBe(true);
  expect(leaked).toEqual([]);
});

test("⭐ 390px: market 3 tabi — kartalar, sahifa sig'adi", async ({ page }) => {
  const { leaked } = await mockCancelStages2Api(page, {
    profile: MARKET,
    marketCancelled: [ORDER_HQ_ESCALATED, ORDER_COURIER, ORDER_BRANCH_3D, ORDER_HANDED_PIN],
  });
  await page.goto("/new-orders/cancelled/201");
  const tabs = page.getByRole("group", { name: "Bekor qilinganlar bosqichi" });
  await expect(tabs.getByRole("button", { name: /Yo'lda/ })).toHaveText("Yo'lda2", { timeout: 90_000 });
  for (const chip of await tabs.getByRole("button").all()) {
    expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  expect(await pageFits(page)).toBe(true);

  await tabs.getByRole("button", { name: /Yo'lda/ }).click();
  const transit = page.getByTestId("market-returns-transit");
  await expect(transit.getByText("Bekor · kuryerda").first()).toBeVisible();
  await expect(transit.getByText("Akmal Rahimov").first()).toBeVisible();
  expect(await pageFits(page)).toBe(true);

  await tabs.getByRole("button", { name: /Olganlarim/ }).click();
  const received = page.getByTestId("market-returns-received");
  await expect(received.getByText("Parol orqali").first()).toBeVisible();
  expect(await pageFits(page)).toBe(true);
  expect(leaked).toEqual([]);
});
