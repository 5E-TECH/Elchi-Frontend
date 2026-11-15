import { expect, test } from "@playwright/test";
import { RESOLVE_NOTE } from "../../src/test/aiAdvisorFixtures";
import { tapTargets, tooSmall } from "./support/tapTargets";
import {
  advisorCalls,
  expectNoHorizontalOverflow,
  FIRST_ALERT_TITLE,
  mockAiAssistantApi,
  openAiAlerts,
  openAiAssistant,
} from "./support/aiAssistant";

/**
 * 60PWUbgC — «Ogohlantirishlar» telefonda (390; maketlar `superadmin-ai-assistant-tab-select`, `-alerts`,
 * `-alerts-filters-mobile`): tablar o'rnida «Bo'lim» tanlovi («3 yangi»), kartalar, gorizontal oqish yo'q, nishonlar
 * ≥ 44 px, «Filtrlar» — pastki varaqa (qoralama, «Natijalarni ko'rsatish (N)»), filtrlar URL'da; ogohlantirish oynasi
 * va «Hal qilindi» tasdig'i — pastki varaqa (maketlar `superadmin-ai-assistant-alert-dialog`, `-alert-resolve-confirm`).
 */
test.describe.configure({ timeout: 120_000 });

test("⭐ 390: «Bo'lim» tanlovi → «Ogohlantirishlar»: kartalar, oqish yo'q, nishonlar ≥ 44 px", async ({ page }) => {
  const { leaked } = await mockAiAssistantApi(page, { advisor: "on" });
  await openAiAssistant(page);

  const section = page.getByRole("combobox", { name: "Bo'lim: Suhbat" });
  await expect(section).toBeVisible();
  await expect(page.getByRole("tablist")).toHaveCount(0);
  expect((await section.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await section.click();
  const options = page.getByRole("option");
  await expect(options).toHaveCount(2);
  await expect(options.nth(0)).toHaveText("Suhbat");
  await expect(options.nth(1)).toContainText("Ogohlantirishlar");
  await expect(options.nth(1)).toContainText("3 yangi");
  for (const height of await options.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height))) {
    expect(height).toBeGreaterThanOrEqual(44);
  }
  await options.nth(1).click();

  await expect(page).toHaveURL(/\/ai-assistant\?tab=alerts$/);
  await expect(page.getByRole("combobox", { name: "Bo'lim: Ogohlantirishlar" })).toBeVisible();
  const list = page.getByRole("list", { name: "Ogohlantirishlar ro'yxati" });
  await expect(list.getByRole("link").first()).toContainText(FIRST_ALERT_TITLE);
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByTestId("ai-alerts-critical-banner")).toContainText("2 ta jiddiy ogohlantirish ko'rib chiqilmagan");
  await expectNoHorizontalOverflow(page);
  expect(tooSmall(await tapTargets(page))).toEqual([]);
  expect(leaked).toEqual([]);
});

test("390: «Filtrlar» — pastki varaqa: qoralama, «Natijalarni ko'rsatish (N)», URL", async ({ page }) => {
  const { advisor } = await mockAiAssistantApi(page, { advisor: "on" });
  await openAiAlerts(page);

  await page.getByRole("button", { name: "Filtrlar" }).click();
  const sheet = page.getByRole("dialog", { name: "Filtrlar" });
  await expect(sheet).toBeVisible();
  const box = (await sheet.boundingBox())!;
  expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(844 - 1);
  await expect(sheet.getByRole("button", { name: /^Natijalarni ko'rsatish\s*\(22\)$/ })).toBeVisible();

  await sheet.getByRole("radiogroup", { name: "Jiddiylik" }).getByRole("radio", { name: "Jiddiy" }).click();
  await sheet.getByRole("button", { name: "Kuryer qarzi o'smoqda" }).click();
  await expect(sheet.getByText("2 ta filtr tanlangan")).toBeVisible();
  const apply = sheet.getByRole("button", { name: /^Natijalarni ko'rsatish\s*\(1\)$/ });
  await expect(apply).toBeVisible();
  // Qoralama URL'ga yozilmagan.
  await expect(page).toHaveURL(/\/ai-assistant\?tab=alerts$/);
  expect(tooSmall(await tapTargets(page))).toEqual([]);

  await apply.click();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/\?tab=alerts&severity=critical&rule=R2$/);
  const list = page.getByRole("list", { name: "Ogohlantirishlar ro'yxati" });
  await expect(list.getByRole("link")).toHaveCount(1);
  await expect(list.getByRole("link")).toContainText(FIRST_ALERT_TITLE);
  expect(advisorCalls(advisor, "ai/advisor/alerts").at(-1)?.query).toEqual({ page: "1", limit: "10", severity: "critical", rule_key: "R2" });
  await expectNoHorizontalOverflow(page);
});

test("390: ogohlantirish oynasi — pastki varaqa: dalillar kartalari, amallar ustma-ust, nishonlar ≥ 44 px, maydon 16 px; tasdiq ham pastda", async ({
  page,
}) => {
  const { advisor, leaked } = await mockAiAssistantApi(page, { advisor: "on" });
  await openAiAlerts(page);
  await page.getByRole("list", { name: "Ogohlantirishlar ro'yxati" }).getByRole("link").nth(1).click();
  await expect(page).toHaveURL(/[?&]alert=1040/);
  const dialog = page.getByRole("dialog", { name: "Samarqand filiali kassasida 3 smena ketma-ket kamomad" });
  await expect(dialog).toBeVisible();
  const box = (await dialog.boundingBox())!;
  expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(844 - 1);

  await expect(dialog.getByRole("table")).toHaveCount(0);
  const evidence = dialog.getByRole("list", { name: "Dalillar · 3 ta yozuv" });
  await expect(evidence.getByRole("listitem")).toHaveCount(4);
  await expect(evidence.getByRole("listitem").first()).toContainText("Kutilgan 4 860 000 · sanalgan 4 740 000 so'm");
  await expect(evidence.getByRole("listitem").last()).toContainText("Jami · 3 smena");

  // Maket: «Hal qilindi», «Ahamiyatsiz», havola — ustma-ust, to'liq enli tugmalar.
  const resolve = dialog.getByRole("button", { name: "Hal qilindi" });
  const [resolveBox, dismissBox, linkBox] = await Promise.all([
    resolve.boundingBox(),
    dialog.getByRole("button", { name: "Ahamiyatsiz" }).boundingBox(),
    dialog.getByRole("link", { name: "Smena hisobotiga o'tish" }).boundingBox(),
  ]);
  expect(resolveBox!.y).toBeLessThan(dismissBox!.y);
  expect(dismissBox!.y).toBeLessThan(linkBox!.y);
  expect(resolveBox!.width).toBeGreaterThan(300);
  expect(await dialog.getByRole("textbox", { name: "Izoh" }).evaluate((node) => getComputedStyle(node).fontSize)).toBe("16px");
  await expectNoHorizontalOverflow(page);
  expect(tooSmall(await tapTargets(page))).toEqual([]);

  await dialog.getByRole("textbox", { name: "Izoh" }).fill(RESOLVE_NOTE);
  await resolve.click();
  const confirm = page.getByRole("alertdialog", { name: "Ogohlantirish hal qilindimi?" });
  await expect(confirm).toBeVisible();
  const confirmBox = (await confirm.boundingBox())!;
  expect(Math.round(confirmBox.y + confirmBox.height)).toBeGreaterThanOrEqual(844 - 1);
  expect(tooSmall(await tapTargets(page))).toEqual([]);
  await confirm.getByRole("button", { name: "Hal qilindi deb belgilash" }).click();
  await expect(page.getByText("Ogohlantirish hal qilindi", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(advisorCalls(advisor, "ai/advisor/alerts/1040", "PATCH")).toHaveLength(1);
  expect(leaked).toEqual([]);
});
