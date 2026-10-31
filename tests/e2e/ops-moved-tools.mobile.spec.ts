import { expect, test, type Page } from "@playwright/test";
import { mockOpsHub, OPS_MOVED } from "./support/opsHub";

/**
 * F2NzXpMv — 390px: ko'chgan vositalar va bosh sahifadagi KPI ekranga sig'adi. Mobil e2e'lar vositaning o'zini
 * sinaydi (`branch-ops`, `logistics-ops-approve`), bu yerda — sahifa ichida gorizontal skroll chiqmasligi. Soxta backend.
 */
test.describe.configure({ timeout: 120_000 });

const expectNoOverflow = async (page: Page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
};

for (const { to, panel } of OPS_MOVED) {
  test(`⭐ ${to}: «${panel}» 390px da sig'adi`, async ({ page }) => {
    const { leaked } = await mockOpsHub(page, "superadmin");
    await page.goto(to);
    const heading = page.getByRole("heading", { level: 2, name: panel });
    await expect(heading).toBeVisible({ timeout: 60_000 });
    await heading.scrollIntoViewIfNeeded();
    await expectNoOverflow(page);
    expect(leaked).toEqual([]);
  });
}

test("⭐ bosh sahifa: SLA va «Analitika KPI» 390px da sig'adi", async ({ page }) => {
  await mockOpsHub(page, "superadmin");
  await page.goto("/");
  const heading = page.getByRole("heading", { level: 2, name: "Analitika KPI" });
  await expect(async () => {
    await page.evaluate(() => {
      const main = document.querySelector("#main-content")?.closest("[data-shell-slot]")?.parentElement;
      window.scrollTo(0, document.body.scrollHeight);
      main?.scrollTo(0, main.scrollHeight);
    });
    await page.mouse.wheel(0, 4000);
    await expect(heading).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 60_000 });
  const box = (await heading.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await expectNoOverflow(page);
});
