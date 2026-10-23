import { expect, test } from "@playwright/test";
import {
  EVENING_TASHKENT,
  expectNoHorizontalOverflow,
  mockSmsCampaignApi,
  openSegmentCampaign,
  pick,
} from "./support/smsCampaign";
import { tapTargets, tooSmall } from "./support/tapTargets";

/**
 * KM-1 — SMS kampaniya «Mijozlar segmenti» telefonda (390): filtrlar ustma-ust, auditoriya va limit bloki,
 * tungi taqiq izohi; gorizontal toshish yo'q, bosiladigan har narsa ≥ 44 px.
 */
test.describe.configure({ timeout: 180_000 });

test("⭐ 390: segment filtrlari, jonli auditoriya va limit; toshish yo'q, nishonlar ≥ 44 px", async ({ page }) => {
  await page.clock.setFixedTime(EVENING_TASHKENT);
  const mock = await mockSmsCampaignApi(page);
  const panel = await openSegmentCampaign(page);

  await pick(page, /^Viloyat/, "Toshkent sh.");
  await pick(page, /^Tuman/, "Yunusobod tumani");
  await panel.getByRole("textbox", { name: "Buyurtmalar soni" }).fill("2");

  const audience = panel.getByTestId("campaign-audience");
  await expect(audience).toHaveAttribute("data-state", "ready");
  await expect(audience).toContainText("Auditoriya: 386 ta");
  await expect(audience).toContainText("Bugun qolgan: 420 / 500");
  await expect(panel.getByTestId("campaign-quiet-notice")).toContainText("SMS ertaga, 09:00 da yuboriladi");
  await expect
    .poll(() => mock.previews.at(-1)?.segment)
    .toEqual({ region_id: "1", district_id: "13", min_orders: 2 });

  // Filtr maydonlari bir ustunda (telefon): yorliqlar bir chiziqda, ustma-ust.
  const region = (await panel.getByText("Viloyat", { exact: true }).boundingBox())!;
  const market = (await panel.getByText("Market", { exact: true }).boundingBox())!;
  expect(market.y).toBeGreaterThan(region.y);
  expect(Math.abs(market.x - region.x)).toBeLessThan(2);
  // Viloyat va Tuman ham ustma-ust: yonma-yon bo'lsa tanlangan nom × tugmasi bilan kesilardi («Toshkent…»).
  const district = (await panel.getByText("Tuman", { exact: true }).boundingBox())!;
  expect(district.y).toBeGreaterThan(region.y);
  expect(Math.abs(district.x - region.x)).toBeLessThan(2);
  await expect(panel.getByRole("combobox", { name: /^Viloyat/ })).toContainText("Toshkent sh.");

  await panel.getByRole("textbox", { name: "Xabar matni" }).fill("Elchi: kuzgi chegirma 20%");
  await expect(panel.getByRole("button", { name: "Ko'rib chiqish" })).toBeEnabled();

  expect(tooSmall(await tapTargets(page))).toEqual([]);
  await expectNoHorizontalOverflow(page);
  expect(mock.leaked).toEqual([]);
});
