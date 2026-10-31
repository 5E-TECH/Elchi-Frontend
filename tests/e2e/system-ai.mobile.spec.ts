import { expect, test } from "@playwright/test";
import { AI_WEAK, aiCard, mockSystemOpsApi, openSystemOps } from "./support/systemOps";

/** /ops?tab=system «AI holati» — 390px: kartalar bitta ustunda, gorizontal skroll yo'q, matn ≥ 12px, tugma ≥ 44px. */
test.describe("Ops → Tizim — AI holati — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("zaif model + 84% + yozilmagan chaqiruvlar: bitta ustun, ekranga sig'adi, matn ≥ 12px", async ({ page }) => {
    const { leaked } = await mockSystemOpsApi(page, { ai: [AI_WEAK] });
    await openSystemOps(page);
    const card = aiCard(page);
    await expect(card.getByText("29,40 $ / 35,00 $ · 84%")).toBeVisible();
    await expect(card.getByText("Zaif model: buyurtma ajratish sifati tushadi")).toBeVisible();
    await expect(card.getByText("80% dan oshdi")).toBeVisible();
    await expect(card.getByText("3 ta")).toBeVisible();

    const tiles = card.getByRole("list", { name: "AI kaliti va modellar" }).getByRole("listitem");
    await expect(tiles).toHaveCount(4);
    const lefts = await tiles.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)));
    expect(new Set(lefts).size).toBe(1);

    const outside = await card
      .locator("*")
      .evaluateAll((elements) =>
        elements
          .map((el) => ({ text: el.textContent?.trim().slice(0, 30) ?? el.tagName, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && (r.left < -1 || r.right > window.innerWidth + 1))
          .map(({ text }) => text),
      );
    expect(outside).toEqual([]);
    const tiny = await card.locator("*").evaluateAll((elements) =>
      elements
        .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim()))
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12)
        .map((el) => el.textContent?.trim().slice(0, 30)),
    );
    expect(tiny).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });

  test("504: «Qayta urinish» ≥ 44px", async ({ page }) => {
    const fail = { status: 504, body: { statusCode: 504, message: "upstream (raw)" } };
    await mockSystemOpsApi(page, { ai: [fail, fail] });
    await openSystemOps(page);
    const button = aiCard(page).getByRole("button", { name: "Qayta urinish" });
    await expect(button).toBeVisible({ timeout: 30_000 });
    const box = await button.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});
