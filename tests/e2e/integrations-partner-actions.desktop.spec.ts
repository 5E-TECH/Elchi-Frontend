import { expect, test } from "@playwright/test";
import { mockPartnerJournal } from "./support/partnerJournal";

/**
 * ESKI `/integrations/partners` VA `integrations-ops` AMALLARI KONSOLDA (Dj70iDbD), 1440px. Sahifalar o'chirilgan,
 * shuning uchun har amal shu yerda oxirigacha bajariladi: so'rov tanasi va bir martalik kalit ham tekshiriladi.
 */
const SCOPE = "/integrations/connections?scope=partner";
const panel = (tab: string) => `${SCOPE}&c=partner:1&t=${tab}`;

test.describe("Eski sahifa amallari konsolda — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ hamkor yaratish: IP ro'yxati ketadi, API kalit bir marta ko'rsatiladi", async ({ page }) => {
    const { leaked, writes } = await mockPartnerJournal(page);
    await page.goto(SCOPE);

    await page.getByRole("button", { name: "Yangi hamkor" }).click({ timeout: 60_000 });
    const dialog = page.getByRole("dialog", { name: "Yangi hamkor" });
    await dialog.getByRole("textbox", { name: /^Nom/ }).fill("Yangi Market");
    const ip = dialog.getByPlaceholder("IP yozing va Enter bosing");
    await ip.fill("1.2.3.4");
    await ip.press("Enter");
    await dialog.getByRole("button", { name: "Yaratish" }).click();

    const reveal = page.getByRole("dialog", { name: "API kalit — bir marta ko'rsatiladi" });
    await expect(reveal).toContainText("elc_once_key");
    expect(writes).toEqual([
      { call: "POST admin/partners", body: expect.objectContaining({ name: "Yangi Market", ip_allowlist: ["1.2.3.4"] }) },
    ]);
    expect(leaked).toEqual([]);
  });

  test("⭐ kalitni yangilash: tasdiqdan keyin yangi kalit bir marta ko'rinadi", async ({ page }) => {
    const { leaked, writes } = await mockPartnerJournal(page);
    await page.goto(panel("security"));

    await page.getByRole("button", { name: "Kalitni yangilash" }).click({ timeout: 60_000 });
    await expect(page.getByRole("alertdialog", { name: "Kalitni yangilash" })).toContainText("BeePost");
    expect(writes).toEqual([]);

    await page.getByRole("button", { name: "Ha, yangilash" }).click();
    await expect(page.getByText("elc_rotated_key")).toBeVisible();
    expect(writes.map(({ call }) => call)).toEqual(["POST admin/partners/1/rotate-key"]);
    expect(leaked).toEqual([]);
  });

  test("⭐ hamkorni to'xtatish tasdiq bilan", async ({ page }) => {
    const { leaked, writes } = await mockPartnerJournal(page);
    await page.goto(panel("security"));

    await page.getByRole("button", { name: "To'xtatish" }).click({ timeout: 60_000 });
    const dialog = page.getByRole("alertdialog", { name: "Ulanishni to'xtatish" });
    expect(writes).toEqual([]);
    await dialog.getByRole("button", { name: "To'xtatish" }).click();

    await expect.poll(() => writes).toEqual([{ call: "POST admin/partners/1/status", body: { is_active: false } }]);
    expect(leaked).toEqual([]);
  });

  test("⭐ sozlamalar: manzil sinaladi, saqlanadi, navbatga qaytgan hodisalar soni aytiladi", async ({ page }) => {
    const { leaked, writes } = await mockPartnerJournal(page);
    await page.goto(panel("settings"));

    // Tarjimasi yo'qolgan kalit xom matn bo'lib chiqardi (`setSandboxCard`, `console.sandboxIntro`).
    const content = page.locator("[data-shell-slot=content]");
    await expect(content.getByText("Yoqilsa, har hodisaning nusxasi sinov manziliga ham yuboriladi.", { exact: false })).toBeVisible({ timeout: 60_000 });
    await expect(content.getByText(/setSandboxCard|console\.sandboxIntro/)).toHaveCount(0);

    await page.getByRole("textbox", { name: /Webhook manzili/ }).first().fill("https://partner.example.com/hook", { timeout: 60_000 });
    await page.getByRole("button", { name: "Sinash" }).first().click();
    await expect.poll(() => writes.map(({ call }) => call)).toEqual(["POST admin/partners/1/webhook-test"]);

    await page.getByRole("button", { name: "Saqlash" }).first().click();
    await expect(page.getByText("Hamkor sozlamalari saqlandi — kutib turgan 3 ta hodisa navbatga qaytarildi").first()).toBeVisible();
    expect(writes.at(-1)).toEqual({ call: "PATCH admin/partners/1", body: expect.objectContaining({ webhook_url: "https://partner.example.com/hook" }) });
    expect(leaked).toEqual([]);
  });

  test("⭐ eski Ops sinxroni: «Ish rejimi» o'sha `POST integrations/:id/sync` ni yuboradi", async ({ page }) => {
    const { leaked, writes } = await mockPartnerJournal(page);
    await page.goto("/integrations/connections?scope=external&c=integration:7&t=control");

    await page.getByRole("button", { name: "Navbatni hoziroq yuborish" }).click({ timeout: 60_000 });
    await expect.poll(() => writes.map(({ call }) => call)).toEqual(["POST integrations/7/sync"]);
    expect(leaked).toEqual([]);
  });
});
