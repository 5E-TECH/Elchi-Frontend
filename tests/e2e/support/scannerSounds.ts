import { expect, type Page, type TestInfo } from "@playwright/test";
import { expectNoHorizontalScroll } from "./scannerCamera";
import { mockSettingsApi, settingsTab } from "./settingsNotifications";

/**
 * JX0EBpa7 — Sozlamalar → Skaner: BeePost (sukut, 2026-11-04), eski 6 ta ovoz va 6 ta yumshoq to'plam. Tanlov
 * hisobga (`PATCH auth/my-settings` → `scanner.sounds`, aniq tanlov belgisi `chosen` bilan) va qurilmaga yoziladi,
 * qayta yuklanganda saqlangan; «Eshitib ko'rish» tanlovni o'zgartirmaydi; serverdagi noma'lum ID va belgisiz eski
 * sukut `classic` — «BeePost». «Ovozli xabar» kaliti ham hisobga va qurilmaga yoziladi.
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
  await expect(success.getByRole("radio")).toHaveCount(13);
  for (const name of SOFT) await expect(success.getByRole("radio", { name })).toBeAttached();
  await expect(success.getByRole("radio", { name: "Klassik" })).toBeAttached();
  await expect(success.getByRole("radio", { name: "BeePost" })).toBeChecked();

  // Eshitib ko'rish — tanlov va hisob o'zgarmaydi.
  await success
    .getByRole("button", { name: "Jiringcha — muvaffaqiyat ovozini eshitib ko'rish" })
    .click();
  await expect(success.getByRole("radio", { name: "BeePost" })).toBeChecked();
  expect(patches).toEqual([]);

  await success.getByText("Marimba", { exact: true }).click();
  await error.getByText("Billur", { exact: true }).click();
  await expect(success.getByRole("radio", { name: "Marimba" })).toBeChecked();
  await expect(error.getByRole("radio", { name: "Billur" })).toBeChecked();
  await expect
    .poll(() => (patches.at(-1) as { scanner?: { sounds?: unknown } } | undefined)?.scanner?.sounds)
    .toEqual({ success: "marimba", error: "glass", chosen: true });
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
  await expect(success.getByRole("radio", { name: "BeePost" })).toBeChecked();
  await expect(error.getByRole("radio", { name: "Qo'ng'iroq" })).toBeChecked();
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("scanner-success-sound")))
    .toBe("beepost");
  expect(leaked).toEqual([]);
};

/** Belgisiz `classic` (eski avtomatik sukut) — BeePost; «Ovozli xabar» o'chirilsa hisob va qurilmaga yoziladi. */
export const runLegacyDefaultAndVoice = async (page: Page) => {
  const { patches, leaked } = await mockSettingsApi(page, {
    theme: "light",
    initialSettings: { scanner: { sounds: { success: "classic", error: "classic" } } },
  });
  const { success, error } = await openScanner(page);
  await expect(success.getByRole("radio", { name: "BeePost" })).toBeChecked();
  await expect(error.getByRole("radio", { name: "BeePost" })).toBeChecked();

  const voice = page.getByRole("switch", { name: "Ovozli xabar" });
  await expect(voice).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Ovozli xabarni eshitib ko'rish" }).click();
  expect(patches).toEqual([]);

  await voice.click();
  await expect(voice).toHaveAttribute("aria-checked", "false");
  await expect
    .poll(() => (patches.at(-1) as { scanner?: { feedback?: { voice?: unknown } } } | undefined)?.scanner?.feedback?.voice)
    .toBe(false);
  expect(await page.evaluate(() => window.localStorage.getItem("scanner-voice-enabled"))).toBe("false");

  const reloaded = await openScanner(page);
  await expect(reloaded.success.getByRole("radio", { name: "BeePost" })).toBeChecked();
  await expect(page.getByRole("switch", { name: "Ovozli xabar" })).toHaveAttribute("aria-checked", "false");
  await expectNoHorizontalScroll(page);
  expect(leaked).toEqual([]);
};
