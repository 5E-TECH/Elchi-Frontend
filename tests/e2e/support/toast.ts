import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Qalqib chiquvchi xabarlar (dizayn v2 `Toaster`, `src/shared/ui/primitives/Toaster.tsx`).
 *
 * `notify()` matni sahifada IKKI joyda turadi:
 *   1) ko'rinadigan karta — «Bildirishnomalar» hududi (`section[aria-label]`) → `ol` → `li[data-toast-id][data-tone]`;
 *   2) ekran o'quvchi uchun yashirin (`sr-only`) doimiy jonli hudud — `role="status"` (xato — `role="alert"`),
 *      `[data-toast-announcer]`; u yerda sarlavha va izoh bitta qatorda: «Sarlavha. Izoh».
 * Shu sabab `page.getByText(xabar)` ikki elementga tushadi (strict mode). Xabarni shu yerdagi helperlar bilan izlang:
 * `toast()` — faqat ko'rinadigan karta (sarlavha YOKI izoh bo'yicha), `expectToast()` — karta + e'lon.
 */

export const TOAST_REGION_NAME = "Bildirishnomalar";

export type ToastTone = "success" | "info" | "warning" | "error";

/** Ko'rinadigan xabarlar hududi (bo'sh bo'lsa — DOM'da yo'q). */
export const toastRegion = (page: Page): Locator => page.getByRole("region", { name: TOAST_REGION_NAME, exact: true });

/**
 * Matni (sarlavha yoki izoh; `getByText` kabi — katta-kichik harfsiz qism-satr yoki RegExp) mos keladigan
 * ko'rinadigan xabar kartasi. `tone` berilsa — faqat shu tondagi xabar.
 */
export const toast = (page: Page, text: string | RegExp, { tone }: { tone?: ToastTone } = {}): Locator => {
  const items = toastRegion(page).getByRole("listitem").filter({ hasText: text });
  return tone ? items.and(page.locator(`[data-tone="${tone}"]`)) : items;
};

/** Yashirin e'lon qiluvchidagi qatorlar (`status` / `alert`), matni bo'yicha. */
export const toastAnnouncement = (page: Page, text: string | RegExp): Locator =>
  page.locator("[data-toast-announcer] > p").filter({ hasText: text });

/**
 * Xabar ko'rinadi (aynan bitta karta) VA ekran o'quvchiga aynan bir marta aytiladi — xato `alert`
 * hududida, qolganlari `status` hududida.
 */
export const expectToast = async (
  page: Page,
  text: string | RegExp,
  options: { tone?: ToastTone; timeout?: number } = {},
) => {
  await expect(toast(page, text, options)).toBeVisible({ timeout: options.timeout });
  const announced = toastAnnouncement(page, text);
  await expect(announced).toHaveCount(1);
  if (options.tone) {
    await expect(announced.locator("xpath=..")).toHaveAttribute("role", options.tone === "error" ? "alert" : "status");
  }
};

/** Ko'rinadigan xabarlar yopilguncha kutadi (kursor xabar ustida bo'lsa vaqt to'xtaydi — chetga olinadi). */
export const waitToastsGone = async (page: Page, timeout = 15_000) => {
  const viewport = page.viewportSize();
  await page.mouse.move(5, (viewport?.height ?? 900) - 5);
  await expect(toastRegion(page)).toHaveCount(0, { timeout });
};
