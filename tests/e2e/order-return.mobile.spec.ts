import { expect, test } from "@playwright/test";
import { mockOrderDetailApi, openOrderDetail, ORDER_96 } from "./support/orderDetail";

/** MARKETGA QAYTARISH — 390px: belgi, tugma va oynalar ekranga sig'adi. */
const MANAGER = {
  id: "501",
  role: "manager",
  name: "Filial menejeri",
  status: "active",
  branch_id: "12",
  branch: { id: "12", name: "Urganch filiali", type: "REGIONAL" },
};

const outsideViewport = (page: import("@playwright/test").Page, selector: string) =>
  page.locator(selector).evaluateAll((elements) =>
    elements
      .map((el) => ({ id: el.getAttribute("data-testid") ?? el.tagName, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.left < -1 || r.right > window.innerWidth + 1))
      .map(({ id }) => id),
  );

test.describe("Marketga qaytarish — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("menejer: belgi + \"Marketga topshirildi\" va QR oynasi ekranga sig'adi", async ({ page }) => {
    const { leaked } = await mockOrderDetailApi(
      page,
      { ...ORDER_96, status: "waiting", return_requested: true, return_reason: "Mijoz rad etdi" },
      { profile: MANAGER },
    );
    await openOrderDetail(page);
    await expect(page.getByTestId("return-requested-badge")).toBeVisible();
    await expect(page.getByTestId("mark-returned-button")).toBeVisible();
    expect(
      await outsideViewport(page, "[data-testid='return-requested-badge'], [data-testid='mark-returned-button']"),
    ).toEqual([]);

    await page.getByTestId("mark-returned-button").click();
    await expect(page.getByTestId("mark-returned-modal")).toBeVisible();
    expect(
      await outsideViewport(page, "[data-testid='mark-returned-modal'], [data-testid='mark-returned-modal'] button, [data-testid='mark-returned-modal'] input"),
    ).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });

  test("admin: \"Marketga qaytarish\" va sabab oynasi ekranga sig'adi", async ({ page }) => {
    const { leaked } = await mockOrderDetailApi(page, { ...ORDER_96, status: "waiting", return_requested: false });
    await openOrderDetail(page);
    await page.getByTestId("initiate-return-button").click();
    await expect(page.getByTestId("initiate-return-modal")).toBeVisible();
    expect(
      await outsideViewport(page, "[data-testid='initiate-return-modal'], [data-testid='initiate-return-modal'] button, [data-testid='initiate-return-modal'] textarea"),
    ).toEqual([]);
    const overflow = await page
      .locator("main.el-surface-page")
      .evaluate((main) => main.scrollWidth - main.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });
});
