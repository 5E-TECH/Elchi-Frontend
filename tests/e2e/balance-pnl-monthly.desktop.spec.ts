import { expect, test } from "@playwright/test";
import { openBalanceAnalysis } from "./support/balanceAnalysis";

/**
 * Balans → Tahlil: «Oylik daromad va sof foyda» (ega 2026-11-28, `GET /finance/pnl`) — 1440px. Karta davr tanlovidan
 * oldin, o'z oynasi (6 · 12 · 24 oy) bilan; grafik (daromad ↑, xarajat ↓, sof foyda chizig'i) va jadval egizagi.
 */
test.describe.configure({ timeout: 120_000 });
test.use({ viewport: { width: 1440, height: 1000 } });

for (const theme of ["light", "dark"] as const) {
  test(`⭐ 1440px (${theme}): 12 oy sukut, grafik, «Jadval» va «6 oy»`, async ({ page }, testInfo) => {
    const { leaked, pnlRequests } = await openBalanceAnalysis(page, { theme });
    const card = page.getByRole("region", { name: "Oylik daromad va sof foyda" });
    await expect(card.getByText("Jami daromad")).toBeVisible();
    expect(pnlRequests.at(-1)?.get("granularity")).toBe("month");

    // Karta davr tanlovidan OLDIN (tanlov unga ta'sir qilmaydi).
    const cardBox = (await card.boundingBox())!;
    const periodBox = (await page.getByRole("group", { name: "Tahlil davri" }).boundingBox())!;
    expect(cardBox.y).toBeLessThan(periodBox.y);

    await expect(card.getByRole("img", { name: /^Oylik daromad, xarajat va sof foyda/ })).toBeVisible();
    await expect(card.locator(".recharts-bar-rectangle").first()).toBeVisible();
    await expect(card.getByText("Sof foyda (daromad − xarajat)")).toBeVisible();
    await expect(card.getByText(/sof foydaga qo'shilmagan/)).toBeVisible();
    await testInfo.attach(`balance-pnl-uz-${theme}-1440`, { body: await card.screenshot(), contentType: "image/png" });

    await card.getByRole("radio", { name: "Jadval" }).click();
    const table = card.getByRole("table", { name: "Oylik daromad va sof foyda" });
    // 12 oy + «Jami».
    await expect(table.getByRole("row")).toHaveCount(14);
    await expect(table.getByText("joriy oy")).toBeVisible();

    const before = pnlRequests.length;
    await card.getByRole("radio", { name: "6 oy" }).click();
    await expect.poll(() => pnlRequests.length).toBeGreaterThan(before);
    await expect(table.getByRole("row")).toHaveCount(8);
    expect(leaked).toEqual([]);
  });
}
