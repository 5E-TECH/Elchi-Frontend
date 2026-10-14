import { expect, test } from "@playwright/test";
import { mockSettingsApi, openNotificationsTab } from "./support/settingsNotifications";

/** Sozlamalar → Bildirishnomalar (F89H1avs) — 1440px. */
test.describe("Sozlamalar → Bildirishnomalar — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ TC1: 4-tab \"Bildirishnomalar\" ko'rinadi va ochiladi", async ({ page }) => {
    const { leaked } = await mockSettingsApi(page);
    await page.goto("/settings");
    const tabs = page.getByRole("main").getByRole("button", { name: /^(Ko'rinish|Dashboard|Interfeys|Bildirishnomalar)/ });
    await expect(tabs).toHaveCount(4, { timeout: 60_000 });
    await expect(tabs.nth(3)).toContainText("Bildirishnomalar");
    await tabs.nth(3).click();
    await expect(page.getByTestId("notifications-scope-notice")).toBeVisible();
    await expect(page.getByText("Kanallar", { exact: true })).toBeVisible();
    expect(leaked).toEqual([]);
  });

  test("⭐ TC2: kanal kaliti → PATCH ketadi; sahifa yangilangandan keyin holat SAQLANGAN", async ({ page }) => {
    const { patches, leaked } = await mockSettingsApi(page);
    await openNotificationsTab(page);
    const telegram = page.getByRole("switch", { name: "Telegram" });
    await expect(telegram).toHaveAttribute("aria-checked", "true");

    await telegram.click();
    await expect(telegram).toHaveAttribute("aria-checked", "false");
    await expect.poll(() => patches.length).toBeGreaterThan(0);
    expect((patches.at(-1) as { notifications: { channels: { telegram: boolean } } }).notifications.channels.telegram).toBe(false);

    await page.reload();
    await openNotificationsTab(page);
    await expect(page.getByRole("switch", { name: "Telegram" })).toHaveAttribute("aria-checked", "false");
    expect(leaked).toEqual([]);
  });

  test("⭐ TC3: eski (bo'limsiz) sozlama — ekran defaultlar bilan ochiladi, xato yo'q", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const { leaked } = await mockSettingsApi(page, {
      initialSettings: { appearance: { density: "compact" }, notifications: { push: false } },
    });
    await openNotificationsTab(page);
    for (const name of ["Ilova ichida", "Jonli (real vaqtda)", "Telegram", "SMS"]) {
      await expect(page.getByRole("switch", { name, exact: true }), name).toHaveAttribute("aria-checked", "true");
    }
    await expect(page.getByRole("switch", { name: "Sokin soatlarni yoqish" })).toHaveAttribute("aria-checked", "false");
    expect(errors).toEqual([]);
    expect(leaked).toEqual([]);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`⭐ TC12: ${theme} temada matnlar o'qiladi (sarlavha ≥ 4.5, izoh ≥ 3), kalitlar ko'rinadi`, async ({ page }) => {
      const { leaked } = await mockSettingsApi(page, { theme });
      await openNotificationsTab(page);
      expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(theme === "dark");

      // Faqat Bildirishnomalar tabi tarkibi (sahifa sarlavhasi bu karta doirasida emas).
      const low = await page.getByTestId("notifications-scope-notice").evaluate((notice) => {
        let main: HTMLElement = notice as HTMLElement;
        while (main.parentElement && !main.textContent?.includes("Toshkent vaqti")) main = main.parentElement;
        // Har qanday CSS rang (oklab/oklch/rgb) → RGBA: canvas brauzerning o'zi o'giradi.
        const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
        const rgba = (color: string) => {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = "#000";
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 1, 1);
          const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
          return [r, g, b, a / 255];
        };
        const lum = ([r, g, b]: number[]) => {
          const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const background = (el: Element | null): number[] => {
          for (let node = el; node; node = node.parentElement) {
            const color = rgba(getComputedStyle(node).backgroundColor);
            if (color[3] > 0.9) return color.slice(0, 3);
          }
          return rgba(getComputedStyle(document.body).backgroundColor).slice(0, 3);
        };
        const results: string[] = [];
        const texts = Array.from(main.querySelectorAll<HTMLElement>("p, span, h2, h3, label"))
          .filter((el) => el.offsetParent !== null && el.childElementCount === 0 && (el.textContent ?? "").trim().length > 2);
        for (const el of texts) {
          const bg = background(el);
          const [fr, fg0, fb, fa] = rgba(getComputedStyle(el).color);
          // Shaffof matn fon bilan aralashtiriladi (ko'zga ko'rinadigan rang).
          const fg = [fr * fa + bg[0] * (1 - fa), fg0 * fa + bg[1] * (1 - fa), fb * fa + bg[2] * (1 - fa)];
          const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
          const ratio = (a + 0.05) / (b + 0.05);
          // Sarlavha/yorliq (qalin) — WCAG AA 4.5; izoh (oddiy, `TEXT.soft` tokeni) — o'qiladi: ≥ 3.
          const strong = Number(getComputedStyle(el).fontWeight) >= 600;
          const required = strong ? 4.5 : 3;
          if (ratio < required) results.push(`${(el.textContent ?? "").trim().slice(0, 30)} → ${ratio.toFixed(2)}`);
        }
        return results;
      });
      expect(low).toEqual([]);
      for (const name of ["Telegram", "SMS", "Sokin soatlarni yoqish"]) {
        await expect(page.getByRole("switch", { name, exact: true }), name).toBeVisible();
      }
      expect(leaked).toEqual([]);
    });
  }
});
