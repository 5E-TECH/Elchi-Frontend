import { expect, test } from "@playwright/test";
import { mockCourierCancelApi, openCancelDialog } from "./support/courierCancel";

/** Kuryer → «Bekor qilish» — 390px: pastki varaqa, sabab majburiy. */
test.describe("Kuryer bekor qilish oynasi — 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("⭐ pastdan chiqadi, maydonlar va tugmalar ≥ 44px, gorizontal skroll yo'q; sabab bilan yuboriladi", async ({ page }) => {
    const { cancels, leaked } = await mockCourierCancelApi(page);
    const dialog = await openCancelDialog(page);

    const box = (await dialog.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(Math.abs(box.y + box.height - viewport.height)).toBeLessThanOrEqual(1);
    expect(box.width).toBeGreaterThanOrEqual(viewport.width - 1);

    const problems = await dialog.evaluate((root) => {
      const out: string[] = [];
      for (const el of Array.from(root.querySelectorAll<HTMLElement>("button, select, input:not([type=file]), textarea"))) {
        const r = el.getBoundingClientRect();
        if (r.height < 44) out.push(`${el.tagName} ${Math.round(r.height)}px "${el.textContent?.trim() || el.getAttribute("aria-label") || ""}"`);
        if (r.right > window.innerWidth + 1 || r.left < -1) out.push(`chiqib ketgan: ${el.tagName}`);
        if ((el.tagName === "SELECT" || el.tagName === "INPUT" || el.tagName === "TEXTAREA") && parseFloat(getComputedStyle(el).fontSize) < 16) {
          out.push(`${el.tagName} shrift ${getComputedStyle(el).fontSize} (iOS zoom)`);
        }
      }
      if (root.scrollWidth > root.clientWidth + 1) out.push("gorizontal skroll");
      return out;
    });
    expect(problems).toEqual([]);

    const submit = dialog.getByRole("button", { name: "Bekor qilish", exact: true });
    await expect(submit).toBeDisabled();
    await dialog.getByLabel(/^Sabab/).selectOption("CUSTOMER_NO_ANSWER");
    await submit.click();
    await expect(dialog).toHaveCount(0);
    expect(cancels.map((c) => c.body.reason)).toEqual(["CUSTOMER_NO_ANSWER"]);
    expect(leaked).toEqual([]);
  });

  test("isbot majburiy bo'lsa: sabab tugma yonida, «Bekor qilish» sig'adi va o'chiq", async ({ page }) => {
    const api = await mockCourierCancelApi(page);
    api.state.orders[0] = {
      ...api.state.orders[0],
      market: { name: "Zamon Market", expense_proof_conditions: ["cancel_any"] },
    } as never;
    const dialog = await openCancelDialog(page);
    await dialog.getByLabel(/^Sabab/).selectOption("CUSTOMER_REFUSED");

    const submit = dialog.getByRole("button", { name: "Bekor qilish", exact: true });
    await expect(submit).toBeDisabled();
    await expect(dialog.getByText("Bekor qilishda rasm yoki video majburiy").last()).toBeVisible();
    const fits = await submit.evaluate((el) => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().right <= window.innerWidth);
    expect(fits).toBe(true);
  });
});
