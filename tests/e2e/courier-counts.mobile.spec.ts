import { expect, test, type Locator, type Page } from "@playwright/test";
import { mockCourierCancelApi } from "./support/courierCancel";

/**
 * TOZ-0 — kuryer «Buyurtmalar» tab sonlari 1 000+ (Trello 0d11ewk7 «5e77ed»), telefon 390:
 * sonlar `formatNumberLocalized` bilan guruhlanadi («1 234», «1.2k» qisqartmasiz — ega qarorisiz yo'q), tablar bir
 * qatorda (sinmaydi: 48px, son yorliq bilan bir qatorda), sahifada gorizontal skroll yo'q. Maketdagi
 * `courier-orders-tab-switcher-open` tablari 7 · 24 · 3 da ham 390 ning chetida — katta sonlarda sig'masa v2 `Tabs`
 * qoidasi ishlaydi: faqat tablar qatori o'zi suriladi (chetda xiralashish), tanlangan tab doim to'liq ko'rinadi.
 */

const COUNTS = { waiting: 1234, all: 12480, cancelled: 1056 };

const measure = (tabs: Locator) =>
  tabs.evaluate((list) => {
    const listRect = list.getBoundingClientRect();
    return {
      listRight: Math.round(listRect.right),
      pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
      tabs: Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]')).map((tab) => {
        const rect = tab.getBoundingClientRect();
        const count = tab.querySelector("span:last-child")!.getBoundingClientRect();
        return {
          name: tab.textContent,
          selected: tab.getAttribute("aria-selected") === "true",
          height: Math.round(rect.height),
          // Son tab ichida, yorliq bilan bir qatorda (pastga tushmagan).
          countInline: Math.abs(count.top + count.height / 2 - (rect.top + rect.height / 2)) <= 2,
          countInside: count.right <= rect.right + 0.5,
          visible: rect.left >= listRect.left - 0.5 && rect.right <= listRect.right + 0.5,
        };
      }),
    };
  });

const open = async (page: Page, route: string) => {
  const { state, leaked } = await mockCourierCancelApi(page);
  state.counts = COUNTS;
  await page.goto(route);
  const tabs = page.getByRole("tablist", { name: "Buyurtmalar turi" });
  await expect(tabs).toBeVisible({ timeout: 60_000 });
  await expect(tabs.getByRole("tab")).toHaveText([
    /^Kutilayotgan\s1\s234$/,
    /^Barchasi\s12\s480$/,
    /^Bekor qilingan\s1\s056$/,
  ]);
  return { tabs, leaked };
};

const expectNotBroken = (metrics: Awaited<ReturnType<typeof measure>>) => {
  expect(metrics.pageOverflow).toBeLessThanOrEqual(0);
  expect(metrics.listRight).toBeLessThanOrEqual(390);
  for (const tab of metrics.tabs) {
    expect(tab, String(tab.name)).toMatchObject({ height: 48, countInline: true, countInside: true });
  }
  // Tanlangan tab qatorda to'liq ko'rinadi (chetga chiqib qolmaydi).
  expect(metrics.tabs.find((tab) => tab.selected)).toMatchObject({ visible: true });
};

test.describe("Kuryer tab sonlari — 1 000+ (390px)", () => {
  test.describe.configure({ timeout: 90_000 });

  test("«Kutilayotgan» tanlangan: sonlar formatlangan, tablar sinmaydi, sahifa surilmaydi", async ({ page }) => {
    const { tabs, leaked } = await open(page, "/orders");
    expectNotBroken(await measure(tabs));
    expect(leaked).toEqual([]);
  });

  test("«Bekor qilingan» (oxirgi tab) tanlangan: u ham to'liq ko'rinadi", async ({ page }) => {
    const { tabs } = await open(page, "/orders?status=cancelled");
    await expect(tabs.getByRole("tab", { selected: true })).toHaveText(/^Bekor qilingan/);
    await expect.poll(async () => (await measure(tabs)).tabs[2].visible).toBe(true);
    expectNotBroken(await measure(tabs));
  });
});
