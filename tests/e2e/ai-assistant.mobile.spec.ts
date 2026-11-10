import { expect, test } from "@playwright/test";
import { tapTargets, tooSmall } from "./support/tapTargets";
import { composer, expectNoHorizontalOverflow, mockAiAssistantApi, openAiAssistant } from "./support/aiAssistant";

/**
 * F7PWp6cK — AI yordamchi telefonda (390): gorizontal oqish yo'q, bosiladigan narsa ≥ 44 px, maydon shrifti 16 px,
 * «Suhbatlar N» — pastki varaqa (ro'yxatdan tanlash), tavsiya chiplari o'z konteynerida suriladi, markdown jadval —
 * kartalar, SSE javob.
 */
test.describe.configure({ timeout: 120_000 });

test("⭐ 390: bo'sh suhbat — oqish yo'q, nishonlar ≥ 44 px, maydon 16 px; karta → SSE javob, jadval kartalarda", async ({ page }) => {
  const { leaked } = await mockAiAssistantApi(page, { conversations: "none" });
  await openAiAssistant(page);
  await expect(page.getByRole("heading", { name: "Moliya bo'yicha savol bering" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const main = page.locator("[data-shell-slot=content]");
  const small = tooSmall(await tapTargets(page));
  expect(small).toEqual([]);
  expect(await composer(page).evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
  // Hisoblagich telefonda yashirin (maket).
  await expect(main.getByText("0 / 1 000")).toBeHidden();

  await page.getByRole("button", { name: /Bu oy kassaga qancha pul tushdi\?/ }).click();
  const log = page.getByRole("log", { name: "Suhbat" });
  await expect(log.getByText("286,4 mln so'm")).toBeVisible();
  // Jadval o'rnida kartalar (DataTable renderCard).
  await expect(log.getByRole("table")).toHaveCount(0);
  await expect(log.getByText("Jasur Tursunov")).toBeVisible();
  await expect(log.getByText("2 840 000 so'm")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // Tavsiya chiplari — bir qatorda, o'z konteynerida suriladi (sahifa emas).
  const chips = page.getByRole("group", { name: "Tavsiya savollar" });
  await expect(chips.getByRole("button")).toHaveCount(5);
  const scrolls = await chips.evaluate((node) => node.scrollWidth > node.clientWidth);
  expect(scrolls).toBe(true);
  for (const box of await chips.getByRole("button").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height))) {
    expect(box).toBeGreaterThanOrEqual(44);
  }
  await expectNoHorizontalOverflow(page);
  expect(leaked).toEqual([]);
});

test("390: «Suhbatlar 1» — pastki varaqa, tanlangan suhbat ochiladi; yuborish tugmasi 44 × 44", async ({ page }) => {
  await mockAiAssistantApi(page);
  await openAiAssistant(page);
  const open = page.getByRole("button", { name: /Suhbatlar/ });
  await expect(open).toBeVisible();
  expect((await open.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await open.click();
  const sheet = page.getByRole("dialog", { name: "Suhbatlar" });
  await expect(sheet).toBeVisible();
  const box = (await sheet.boundingBox())!;
  expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(844 - 1);
  const item = sheet.getByRole("link", { name: /Marketlarga to'lanmagan summa/ });
  expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await item.click();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/\?conversation=41$/);
  await expect(page.getByRole("log", { name: "Suhbat" }).getByText("18,4 mln so'm")).toBeVisible();

  const send = page.getByRole("button", { name: "Yuborish", exact: true });
  const sendBox = (await send.boundingBox())!;
  expect(sendBox.width).toBeGreaterThanOrEqual(44);
  expect(sendBox.height).toBeGreaterThanOrEqual(44);
  await expectNoHorizontalOverflow(page);
});
