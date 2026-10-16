import { expect, test } from "@playwright/test";
import { mockControlApi, openControl } from "./support/integrationControl";
import { expectToast } from "./support/toast";

/** Integratsiya → Ish rejimi (fG48Xv5X, TC: DOZ6dtJn) — 1440 va 1920px. Backend soxta, serverga hech narsa ketmaydi. */
test.describe("Integratsiya — Ish rejimi, desktop (1440 / 1920)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  for (const width of [1440, 1920]) {
    test(`⭐ 1: ${width}px qator-ro'yxat — Master, Kiruvchi webhook, Solishtiruvchi: ikonka, nom, holat tegi, izoh, o'ngda kalit`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1080 });
      const { leaked } = await mockControlApi(page);
      await openControl(page);

      const rows = [
        { id: "master", name: "Master kalit", checked: "true", tag: "Faol" },
        { id: "webhook", name: "Kiruvchi webhook", checked: "true", tag: "Faol" },
        { id: "reconcile", name: "Solishtiruvchi (CRON)", checked: "false", tag: "O'chiq" },
      ];
      let previousBottom = 0;
      for (const { id, name, checked, tag } of rows) {
        const row = page.getByTestId(`ctl-row-${id}`);
        const toggle = row.getByRole("switch", { name });
        await expect(toggle).toHaveAttribute("aria-checked", checked);
        await expect(row.locator("h3")).toHaveText(name);
        await expect(row.locator("h3 svg")).toHaveCount(1);
        await expect(row.getByText(tag, { exact: true }).first()).toBeVisible();
        await expect(row.locator("p")).not.toBeEmpty();
        const [rowBox, switchBox] = [await row.boundingBox(), await toggle.boundingBox()];
        // Kalit qatorning o'ng chetida; qatorlar ustma-ust (ro'yxat).
        expect(rowBox!.x + rowBox!.width - (switchBox!.x + switchBox!.width)).toBeLessThan(30);
        expect(rowBox!.y).toBeGreaterThanOrEqual(previousBottom - 1);
        previousBottom = rowBox!.y + rowBox!.height;
      }
      await expect(
        page.getByText("Master o'chiq bo'lsa quyi kalitlar ta'sir qilmaydi — hech qanday jarayon ishlamaydi."),
      ).toBeVisible();
      expect(leaked).toEqual([]);
    });
  }

  test("⭐ 1: quyi kalitlar — PATCH { webhook_enabled / reconcile_enabled }, holat tegi yangilanadi", async ({ page }) => {
    const { patches, leaked } = await mockControlApi(page);
    await openControl(page);

    const reconcile = page.getByTestId("ctl-row-reconcile");
    await reconcile.getByRole("switch").click();
    await expect(reconcile.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    await expect(reconcile.getByText("Faol", { exact: true }).first()).toBeVisible();

    const webhook = page.getByTestId("ctl-row-webhook");
    await webhook.getByRole("switch").click();
    await expect(webhook.getByRole("switch")).toHaveAttribute("aria-checked", "false");

    expect(patches).toEqual([
      { slug: "tez-yetkaz", type: "api", reconcile_enabled: true },
      { slug: "tez-yetkaz", type: "api", webhook_enabled: false },
    ]);
    expect(leaked).toEqual([]);
  });

  test("⭐ 2+3: «Hoziroq tenglashtirish» → natija xabari, «Oxirgi solishtiruv» yangilanadi", async ({ page }) => {
    const { reconcileCalls, leaked } = await mockControlApi(page);
    await openControl(page);

    const tile = page.getByTestId("ctl-last-reconcile");
    await expect(tile).toContainText("Hali bo'lmagan");
    await expect(tile).toContainText("Oxirgi solishtiruv");

    await page.getByRole("button", { name: "Hoziroq tenglashtirish" }).click();
    await expectToast(page, "Solishtiruv tugadi: tekshirildi 1 200, yangilandi 3, yiqildi 1", { tone: "success" });
    expect(reconcileCalls).toHaveLength(1);
    await expect(tile).not.toContainText("Hali bo'lmagan");
    await expect(tile).toContainText(/(Bugun|Kecha|15\.10\.2026), \d{2}:45/);
    expect(leaked).toEqual([]);
  });

  test("⭐ 2: 409 — master o'chiq / boshqa solishtiruv ishlayapti", async ({ page }) => {
    await mockControlApi(page, { reconcile: "conflict" });
    await openControl(page);
    await page.getByRole("button", { name: "Hoziroq tenglashtirish" }).click();
    await expectToast(page, "Solishtiruv boshlanmadi: master kalit o'chiq yoki boshqa solishtiruv hozir ishlayapti.", {
      tone: "error",
    });
    await expect(page.getByTestId("ctl-last-reconcile")).toContainText("Hali bo'lmagan");
  });

  test("⭐ 2: 400 — status so'rovi sozlanmagan", async ({ page }) => {
    await mockControlApi(page, { reconcile: "no-query" });
    await openControl(page);
    await page.getByRole("button", { name: "Hoziroq tenglashtirish" }).click();
    await expectToast(page, "Solishtiruv uchun status so'rovi sozlanmagan — «Sozlamalar» bo'limida to'ldiring.", {
      tone: "error",
    });
  });

  test("Master o'chirish — tasdiqlash oynasi: Escape va «Bekor qilish» hech narsa yubormaydi", async ({ page }) => {
    const { patches } = await mockControlApi(page);
    await openControl(page);
    const master = page.getByTestId("ctl-row-master").getByRole("switch");

    await master.click();
    const dialog = page.getByRole("alertdialog", { name: "Ulanishni o'chirish" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Tez Yetkaz");
    await expect(dialog.getByRole("button", { name: "Bekor qilish" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    await page.getByRole("button", { name: "To'xtatish", exact: true }).click();
    await dialog.getByRole("button", { name: "Bekor qilish" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(master).toHaveAttribute("aria-checked", "true");
    expect(patches).toEqual([]);
  });

  test("Master o'chirilsa (tasdiq bilan) «To'xtatish» bloki yashiriladi (maket holati)", async ({ page }) => {
    const { patches } = await mockControlApi(page);
    await openControl(page);
    await expect(page.getByText("Ulanishni butunlay to'xtatish")).toBeVisible();
    await page.getByTestId("ctl-row-master").getByRole("switch").click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Ha, o'chirish" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByTestId("ctl-row-master").getByRole("switch")).toHaveAttribute("aria-checked", "false");
    await expect(page.getByText("Ulanishni butunlay to'xtatish")).toHaveCount(0);
    expect(patches).toEqual([{ slug: "tez-yetkaz", type: "api", is_active: false }]);
  });
});
