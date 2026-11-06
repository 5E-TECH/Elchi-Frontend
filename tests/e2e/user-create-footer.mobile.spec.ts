import { expect, test } from "@playwright/test";
import { mockCreateUserSms } from "./support/userPasswordSms";

/**
 * «Yangi foydalanuvchi» (telefon): forma pastidagi tugmalar maketdagidek (`*-users-create`, `el-card-foot el-show-mobile`)
 * ustma-ust va to'liq enli. Avval yonma-yon edi — «Yaratish va SMS yuborish» 360 px da kartadan 22 px chiqib, sahifa
 * (kontent `<main>` ichida) yonga surilardi (jonli test sayti, 2026-11-06).
 */
for (const width of [360, 390]) {
  test(`${width}px: «Bekor qilish» va «Yaratish va SMS yuborish» ustma-ust, sahifa yonga surilmaydi`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 800 });
    await mockCreateUserSms(page);
    await page.goto("/all-users/create-user?role=courier");
    const form = page.getByRole("form", { name: /Kuryer/ });
    await expect(form).toBeVisible({ timeout: 90_000 });

    const cancel = form.getByRole("button", { name: "Bekor qilish" });
    const submit = form.getByRole("button", { name: "Yaratish va SMS yuborish" });
    await submit.scrollIntoViewIfNeeded();
    const a = (await cancel.boundingBox())!;
    const b = (await submit.boundingBox())!;
    // Maket tartibi: avval «Bekor qilish», ostida asosiy tugma; ikkalasi bir xil to'liq enli.
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.height);
    expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1);
    expect(b.x + b.width).toBeLessThanOrEqual(width);
    expect(b.height).toBeGreaterThanOrEqual(44);

    const overflow = await page.evaluate(() => {
      const main = document.querySelector("main")!;
      return {
        page: document.documentElement.scrollWidth - innerWidth,
        main: main.scrollWidth - main.clientWidth,
      };
    });
    expect(overflow).toEqual({ page: 0, main: 0 });
  });
}
