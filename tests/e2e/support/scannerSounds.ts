import { expect, type Page, type TestInfo } from "@playwright/test";
import { expectNoHorizontalScroll } from "./scannerCamera";
import { mockSettingsApi, settingsTab } from "./settingsNotifications";

/**
 * JX0EBpa7 — Sozlamalar → Skaner: eski 6 ta ovoz yonida 6 ta yumshoq to'plam. Tanlov hisobga (`PATCH
 * auth/my-settings` → `scanner.sounds`) va qurilmaga yoziladi, qayta yuklanganda saqlangan; «Eshitib ko'rish»
 * tanlovni o'zgartirmaydi; serverdagi noma'lum ID — «Klassik» (zaxira).
 */
const SOFT = ["Jiringcha", "Tomchi", "Marimba", "Pufakcha", "Billur", "Mayin"];

const openScanner = async (page: Page) => {
  await page.goto("/settings");
  await settingsTab(page, /^Skaner/).click({ timeout: 60_000 });
  return {
    success: page.getByRole("radiogroup", { name: "Muvaffaqiyat ovozi" }),
    error: page.getByRole("radiogroup", { name: "Xato ovozi" }),
  };
};

export const runSoftSoundsSaved = async (
  page: Page,
  testInfo: TestInfo,
  label: string,
  theme: "light" | "dark",
) => {
  const { patches, leaked } = await mockSettingsApi(page, { theme });
  const { success, error } = await openScanner(page);
  await expect(success.getByRole("radio")).toHaveCount(12);
  for (const name of SOFT) await expect(success.getByRole("radio", { name })).toBeAttached();
  await expect(success.getByRole("radio", { name: "Klassik" })).toBeChecked();

  // Eshitib ko'rish — tanlov va hisob o'zgarmaydi.
  await success
    .getByRole("button", { name: "Jiringcha — muvaffaqiyat ovozini eshitib ko'rish" })
    .click();
  await expect(success.getByRole("radio", { name: "Klassik" })).toBeChecked();
  expect(patches).toEqual([]);

  await success.getByText("Marimba", { exact: true }).click();
  await error.getByText("Billur", { exact: true }).click();
  await expect(success.getByRole("radio", { name: "Marimba" })).toBeChecked();
  await expect(error.getByRole("radio", { name: "Billur" })).toBeChecked();
  await expect
    .poll(() => (patches.at(-1) as { scanner?: { sounds?: unknown } } | undefined)?.scanner?.sounds)
    .toEqual({ success: "marimba", error: "glass" });
  expect(await page.evaluate(() => window.localStorage.getItem("scanner-success-sound"))).toBe(
    "marimba",
  );
  expect(await page.evaluate(() => window.localStorage.getItem("scanner-error-sound"))).toBe(
    "glass",
  );

  await expectNoHorizontalScroll(page);
  // «Eshitib ko'rish» xabari («Qabul qilindi») yopilgach — rasmda ovozlar ro'yxati ko'rinsin.
  await expect(page.getByText("Qabul qilindi", { exact: true })).toBeHidden({ timeout: 15_000 });
  await success.scrollIntoViewIfNeeded();
  const shot = await page.screenshot();
  await testInfo.attach(`scanner-sounds-${label}-${theme}`, {
    body: shot,
    contentType: "image/png",
  });
  if (process.env.E2E_SHOTS_DIR) {
    await success.screenshot({
      path: `${process.env.E2E_SHOTS_DIR}/scanner-sounds-${label}-${theme}.png`,
    });
  }

  // Qayta yuklanganda — hisobdagi tanlov.
  const reloaded = await openScanner(page);
  await expect(reloaded.success.getByRole("radio", { name: "Marimba" })).toBeChecked();
  await expect(reloaded.error.getByRole("radio", { name: "Billur" })).toBeChecked();
  expect(leaked).toEqual([]);
};

export const runUnknownSoundFallback = async (page: Page) => {
  const { leaked } = await mockSettingsApi(page, {
    theme: "light",
    initialSettings: { scanner: { sounds: { success: "eski-ovoz", error: "bell" } } },
  });
  const { success, error } = await openScanner(page);
  await expect(success.getByRole("radio", { name: "Klassik" })).toBeChecked();
  await expect(error.getByRole("radio", { name: "Qo'ng'iroq" })).toBeChecked();
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("scanner-success-sound")))
    .toBe("classic");
  expect(leaked).toEqual([]);
};
