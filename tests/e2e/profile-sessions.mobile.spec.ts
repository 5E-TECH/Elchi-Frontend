import { expect, test } from "@playwright/test";
import { openProfileWithSessions } from "./support/profileSessions";

/**
 * EP-3 (Elchi Pochta #3) — /profile «Sessiyalar» telefonda (390, kuryer): qatorlar ustma-ust (qurilma, so'ng
 * vaqtlar), «Shu qurilma» tepada, gorizontal oqish yo'q, matn ≥ 12px.
 */
test.describe.configure({ timeout: 120_000 });

test("⭐ 390: ustma-ust qatorlar, oqish yo'q, mayda matn yo'q", async ({ page }) => {
  const { leaked } = await openProfileWithSessions(page, "courier");

  const card = page.getByRole("region", { name: "Sessiyalar" });
  await expect(card).toBeVisible({ timeout: 90_000 });
  await expect(card.getByText("3 ta faol")).toBeVisible();
  const rows = card.getByRole("list", { name: "Faol sessiyalar ro'yxati" }).getByRole("listitem");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0).getByText("Shu qurilma")).toBeVisible();

  // Telefonda vaqtlar qurilma nomining ostida.
  const device = await rows.nth(0).getByRole("heading", { level: 3 }).boundingBox();
  const loggedIn = await rows.nth(0).getByText("Kirgan vaqti").boundingBox();
  expect(loggedIn?.y ?? 0).toBeGreaterThan((device?.y ?? 0) + (device?.height ?? 0));

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const tiny = await card.evaluate((root) =>
    [...root.querySelectorAll<HTMLElement>("*")]
      .filter((node) => node.childNodes.length && [...node.childNodes].some((child) => child.nodeType === 3 && child.textContent?.trim()))
      .filter((node) => parseFloat(getComputedStyle(node).fontSize) < 12)
      .map((node) => node.textContent),
  );
  expect(tiny).toEqual([]);
  expect(leaked).toEqual([]);
});
