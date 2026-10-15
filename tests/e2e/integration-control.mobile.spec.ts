import { expect, test } from "@playwright/test";
import { mockControlApi, openControl } from "./support/integrationControl";

/** Integratsiya → Ish rejimi (fG48Xv5X) — 390px. */
test.describe("Integratsiya — Ish rejimi, 390px", () => {
  test.describe.configure({ timeout: 90_000 });

  test("⭐ 4: har qator to'liq sig'adi — kalit kesilmaydi, bosiladigan narsalar ≥ 44px, gorizontal skroll yo'q", async ({ page }) => {
    const { patches, leaked } = await mockControlApi(page);
    await openControl(page);

    const problems = await page.evaluate(() => {
      const out: string[] = [];
      const panel = document.querySelector('[data-testid="ctl-row-master"]')!.closest("section")!;
      const box = panel.getBoundingClientRect();
      for (const el of Array.from(panel.querySelectorAll<HTMLElement>('[role="switch"], button'))) {
        const r = el.getBoundingClientRect();
        if (r.left < box.left - 1 || r.right > box.right + 1 || r.right > window.innerWidth) out.push(`kesilgan: ${el.textContent}`);
        if (r.height < 44) out.push(`${Math.round(r.height)}px: ${el.textContent}`);
        if (el.scrollWidth > el.clientWidth + 1) out.push(`matn sig'madi: ${el.textContent}`);
      }
      const main = document.querySelector("main.el-surface-page") as HTMLElement;
      if (main.scrollWidth > main.clientWidth) out.push(`gorizontal skroll ${main.scrollWidth - main.clientWidth}px`);
      return out;
    });
    expect(problems).toEqual([]);

    // Kalit bosiladi (to'liq kenglikdagi qator).
    await page.getByTestId("ctl-row-reconcile").getByRole("switch").click();
    await expect(page.getByTestId("ctl-row-reconcile").getByRole("switch")).toHaveAttribute("aria-checked", "true");
    expect(patches).toEqual([{ slug: "tez-yetkaz", type: "api", reconcile_enabled: true }]);
    expect(leaked).toEqual([]);
  });

  test("tasdiqlash oynasi telefonda pastdan chiqadi, tugmalar ≥ 44px va to'liq kenglikda", async ({ page }) => {
    const { patches } = await mockControlApi(page);
    await openControl(page);
    await page.getByRole("button", { name: "To'xtatish", exact: true }).click();
    const dialog = page.getByRole("alertdialog", { name: "Ulanishni o'chirish" });
    await expect(dialog).toBeVisible();

    const box = (await dialog.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(Math.abs(box.y + box.height - viewport.height)).toBeLessThanOrEqual(1);
    expect(box.x).toBeLessThanOrEqual(1);
    expect(box.width).toBeGreaterThanOrEqual(viewport.width - 1);
    for (const name of ["Bekor qilish", "Ha, o'chirish"]) {
      const button = (await dialog.getByRole("button", { name }).boundingBox())!;
      expect(button.height, name).toBeGreaterThanOrEqual(44);
      expect(button.width, name).toBeGreaterThan(viewport.width / 2 - 40);
    }
    await dialog.getByRole("button", { name: "Ha, o'chirish" }).click();
    await expect(dialog).toHaveCount(0);
    expect(patches).toEqual([{ slug: "tez-yetkaz", type: "api", is_active: false }]);
  });
});
