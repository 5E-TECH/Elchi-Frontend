import { expect, test, type Page } from "@playwright/test";
import { setupShellSession } from "./shellSession";

/**
 * KI-2 «Ilovani o'rnatish» e2e yordamchisi. Haqiqiy o'rnatish brauzer/OS oynasi — testda soxtalanadi:
 *  - `installable` — sahifa yuklangach `beforeinstallprompt` (prompt() chaqiruvi `window.__pwaPrompts` da sanaladi,
 *    javob `outcome`; `accepted` bo'lsa brauzer kabi `appinstalled` ham keladi);
 *  - `ios` — iPhone user agent (`test.use({ userAgent })`) + sensorli ekran, hodisasiz;
 *  - `unsupported` — hodisasiz oddiy brauzer.
 * API — `setupShellSession` (soxta sessiya, yozish taqiqlangan).
 */
export const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

export type PwaMode = "installable" | "ios" | "unsupported";

export const setupPwaSession = async (
  page: Page,
  {
    role = "courier",
    mode = "installable",
    outcome = "accepted",
    theme = "light",
  }: { role?: string; mode?: PwaMode; outcome?: "accepted" | "dismissed"; theme?: "light" | "dark" } = {},
) => {
  // Mavzu serverdagi `appearance.theme` dan sinxronlanadi (faqat `themeChosen` bo'lsa) — localStorage yetarli emas.
  const session = await setupShellSession(page, role, "Jasur Tursunov", {}, {
    settings: { appearance: { theme, themeChosen: true } },
  });
  await page.addInitScript(
    ({ mode, outcome, theme }) => {
      window.localStorage.setItem("theme", theme);
      window.localStorage.setItem("theme-version", "2");
      const w = window as unknown as { __pwaPrompts: number };
      w.__pwaPrompts = 0;
      if (mode !== "installable") return;
      window.addEventListener("load", () => {
        const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
          prompt: () => Promise<void>;
          userChoice: Promise<{ outcome: string; platform: string }>;
        };
        event.prompt = () => {
          w.__pwaPrompts += 1;
          if (outcome === "accepted") setTimeout(() => window.dispatchEvent(new Event("appinstalled")), 50);
          return Promise.resolve();
        };
        event.userChoice = Promise.resolve({ outcome, platform: "web" });
        window.dispatchEvent(event);
      });
    },
    { mode, outcome, theme },
  );
  return session;
};

export const promptCount = (page: Page) =>
  page.evaluate(() => (window as unknown as { __pwaPrompts: number }).__pwaPrompts);

/** Skrinshot — test natijalari papkasiga (PR uchun; repoga kirmaydi). */
export const shot = async (page: Page, name: string) => {
  await page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true });
};

/** 390 px: gorizontal skroll yo'q. */
export const expectNoHorizontalOverflow = async (page: Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};

/** Bosiladigan har element (locator ichida) ≥ 44 px. */
export const expectTapTargets = async (page: Page, selector: string) => {
  const sizes = await page.locator(selector).locator("button, a").evaluateAll((nodes) =>
    nodes
      .filter((n) => (n as HTMLElement).offsetParent !== null)
      .map((n) => {
        const r = n.getBoundingClientRect();
        return { name: n.textContent?.trim() || n.getAttribute("aria-label"), w: r.width, h: r.height };
      }),
  );
  expect(sizes.length).toBeGreaterThan(0);
  for (const size of sizes) {
    expect(size.h, String(size.name)).toBeGreaterThanOrEqual(44);
    expect(size.w, String(size.name)).toBeGreaterThanOrEqual(44);
  }
};
