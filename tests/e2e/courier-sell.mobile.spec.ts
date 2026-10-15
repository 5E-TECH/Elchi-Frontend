import { expect, test } from "@playwright/test";
import { mockCourierCancelApi, openSellDialog } from "./support/courierCancel";

/** Kuryer → «Sotish» — 390px: pastki varaqa, maydonlar ≥ 44px va 16px shrift. */
test.describe("Kuryer sotish oynasi — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("⭐ pastdan chiqadi, gorizontal skroll yo'q; marketga to'lov bilan sotiladi", async ({ page }) => {
    const { sells, leaked } = await mockCourierCancelApi(page);
    const dialog = await openSellDialog(page);

    const box = (await dialog.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(Math.abs(box.y + box.height - viewport.height)).toBeLessThanOrEqual(1);
    expect(box.width).toBeGreaterThanOrEqual(viewport.width - 1);

    const problems = await dialog.evaluate((root) => {
      const out: string[] = [];
      for (const el of Array.from(root.querySelectorAll<HTMLElement>("button, input:not([type=file]), textarea"))) {
        const r = el.getBoundingClientRect();
        if (r.height < 44) out.push(`${el.tagName} ${Math.round(r.height)}px "${el.textContent?.trim() || el.getAttribute("aria-label") || ""}"`);
        if (r.right > window.innerWidth + 1 || r.left < -1) out.push(`chiqib ketgan: ${el.tagName}`);
        if ((el.tagName === "INPUT" || el.tagName === "TEXTAREA") && parseFloat(getComputedStyle(el).fontSize) < 16) {
          out.push(`${el.tagName} shrift ${getComputedStyle(el).fontSize}`);
        }
      }
      if (root.scrollWidth > root.clientWidth + 1) out.push("gorizontal skroll");
      return out;
    });
    expect(problems).toEqual([]);

    await dialog.getByLabel("Marketga to'langan summa").fill("50000");
    await dialog.getByRole("button", { name: "Sotish", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(sells.map((s) => s.body.paidAmount)).toEqual([50000]);
    expect(leaked).toEqual([]);
  });
});
