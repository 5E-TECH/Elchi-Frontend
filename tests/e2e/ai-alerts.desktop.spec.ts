import { expect, test } from "@playwright/test";
import { advisorCalls, composer, FIRST_ALERT_TITLE, mockAiAssistantApi, openAiAssistant } from "./support/aiAssistant";

/**
 * 60PWUbgC — AI yordamchi «Ogohlantirishlar» (superadmin, desktop 1280; maketlar `superadmin-ai-assistant-alerts`,
 * `superadmin-ai-assistant`): maslahatchi backend'i bor (`advisor: "on"`) — tablar «Suhbat · Ogohlantirishlar 3»,
 * yangi izoh, jiddiylar banneri, filtrlar ↔ URL (`status`, `severity`, `rule` → `rule_key`, `page`), bo'sh holat,
 * tab almashganda suhbat qoralamasi saqlanadi va ochiq oyna (`alert`) olinadi. Backend yo'q holati —
 * `ai-assistant.desktop.spec.ts`.
 */
test.describe.configure({ timeout: 120_000 });

test("⭐ tablar → «Ogohlantirishlar»: banner, ro'yxat, filtrlar ↔ URL, sahifalash; suhbatga qaytsa qoralama joyida", async ({ page }) => {
  const { advisor, leaked } = await mockAiAssistantApi(page, { advisor: "on" });
  await openAiAssistant(page);

  const tablist = page.getByRole("tablist", { name: "AI yordamchi bo'limlari" });
  await expect(tablist.getByRole("tab")).toHaveText(["Suhbat", "Ogohlantirishlar 3"]);
  await expect(tablist.getByRole("tab", { name: "Suhbat" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Kassa, qarzlar va xarajatlar bo'yicha savol va ogohlantirishlar. Yordamchi faqat ma'lumot o'qiydi.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Yangi suhbat" })).toBeVisible();
  // Hisobotlar · Tavsiyalar · Sarf va «Sozlamalar» (S6) — hozircha yo'q.
  await expect(page.getByRole("tab", { name: /Hisobotlar|Tavsiyalar|Sarf/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sozlamalar" })).toHaveCount(0);

  await composer(page).fill("Kecha-chi?");
  await tablist.getByRole("tab", { name: /Ogohlantirishlar/ }).click();
  await expect(page).toHaveURL(/\/ai-assistant\?tab=alerts$/);
  await expect(composer(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Yangi suhbat" })).toHaveCount(0);

  // Banner: faqat yangi jiddiylar (R2, R7).
  const banner = page.getByTestId("ai-alerts-critical-banner");
  await expect(banner).toContainText("2 ta jiddiy ogohlantirish ko'rib chiqilmagan");
  await expect(banner).toContainText("Kuryer qarzi o'smoqda · Chek yoki karta farqi");

  const table = page.getByRole("table", { name: "Ogohlantirishlar ro'yxati" });
  await expect(table.getByRole("row")).toHaveCount(11);
  await expect(table.getByRole("row").nth(1)).toContainText(FIRST_ALERT_TITLE);
  await expect(table.getByRole("row").nth(1)).toContainText("Jiddiy");
  await expect(table.getByRole("row").nth(1)).toContainText("Yangi");
  await expect(page.getByText("1–10 / 22 ta ogohlantirish")).toBeVisible();
  await expect(page.getByText("22 ta", { exact: true })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Holat" }).getByRole("radio")).toHaveText([
    "Barchasi",
    "Yangi 3",
    "Ko'rildi 3",
    "Hal qilindi",
    "Ahamiyatsiz",
  ]);

  // «Faqat jiddiylar» → severity=critical; banner izohi jadvaldagi soni bilan.
  await banner.getByRole("button", { name: "Faqat jiddiylar" }).click();
  await expect(page).toHaveURL(/[?&]severity=critical/);
  await expect(banner).toContainText("Jadvalda faqat jiddiylar: 3 ta");
  await expect(table.getByRole("row")).toHaveCount(4);
  await banner.getByRole("button", { name: "Hammasini ko'rsatish" }).click();
  await expect(page).not.toHaveURL(/severity=/);
  await expect(table.getByRole("row")).toHaveCount(11);

  // Holat segmenti va «Turi» → filtr bo'yicha bo'sh holat → «Filtrlarni tozalash».
  await page.getByRole("radiogroup", { name: "Holat" }).getByRole("radio", { name: /^Yangi/ }).click();
  await expect(page).toHaveURL(/[?&]status=new/);
  await expect(table.getByRole("row")).toHaveCount(4);
  await page.getByRole("combobox", { name: "Turi" }).click();
  await page.getByRole("option", { name: "Zarar" }).click();
  await expect(page).toHaveURL(/[?&]rule=R6/);
  await expect(page.getByText("Bu filtr bo'yicha ogohlantirish yo'q")).toBeVisible();
  expect(advisorCalls(advisor, "ai/advisor/alerts").at(-1)?.query).toEqual({ page: "1", limit: "10", status: "new", rule_key: "R6" });
  await page.getByRole("button", { name: "Filtrlarni tozalash" }).click();
  await expect(page).toHaveURL(/\/ai-assistant\?tab=alerts$/);

  // Sahifalash: 2-sahifa URL'da.
  await page.getByRole("button", { name: "2", exact: true }).click();
  await expect(page).toHaveURL(/[?&]page=2/);
  await expect(page.getByText("11–20 / 22 ta ogohlantirish")).toBeVisible();

  // Qator → `?alert=` (oyna — S4); «Suhbat» ga qaytsa `alert` va `tab` olinadi, qoralama joyida.
  await page.getByRole("button", { name: "1", exact: true }).click();
  await expect(page).not.toHaveURL(/[?&]page=/);
  await page.getByRole("link", { name: FIRST_ALERT_TITLE, exact: true }).click();
  await expect(page).toHaveURL(/[?&]alert=1041/);
  await page.getByRole("tab", { name: "Suhbat" }).click();
  await expect(page).not.toHaveURL(/[?&](tab|alert)=/);
  await expect(composer(page)).toHaveValue("Kecha-chi?");
  await expect(page.getByRole("button", { name: "Yangi suhbat" })).toBeVisible();

  // Zond — bitta so'rov (60 s poll'gacha), sozlamalar (S6) so'ralmaydi; GET :id (yon ta'sirli) — yo'q.
  expect(advisorCalls(advisor, "ai/advisor/overview").length).toBeLessThanOrEqual(2);
  expect(advisorCalls(advisor, "ai/advisor/settings")).toHaveLength(0);
  expect(advisor.requests.filter((request) => /^ai\/advisor\/alerts\/\d+/.test(request.path))).toHaveLength(0);
  expect(leaked).toEqual([]);
});

test("havola `?tab=alerts&status=seen`: «Ogohlantirishlar» tabida ochiladi, filtr qo'llangan", async ({ page }) => {
  const { advisor } = await mockAiAssistantApi(page, { advisor: "on" });
  await page.goto("/ai-assistant?tab=alerts&status=seen");
  await expect(page.getByRole("tab", { name: /Ogohlantirishlar/ })).toHaveAttribute("aria-selected", "true", { timeout: 60_000 });
  const table = page.getByRole("table", { name: "Ogohlantirishlar ro'yxati" });
  await expect(table.getByRole("row")).toHaveCount(4);
  await expect(page.getByRole("radiogroup", { name: "Holat" }).getByRole("radio", { name: /^Ko'rildi/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("textbox", { name: "Savolingiz" })).toBeHidden();
  expect(advisorCalls(advisor, "ai/advisor/alerts")[0]?.query).toEqual({ page: "1", limit: "10", status: "seen" });
});

test("tab=alerts — tarixda: «Orqaga» suhbatga qaytaradi", async ({ page }) => {
  await mockAiAssistantApi(page, { advisor: "on" });
  await openAiAssistant(page);
  await page.getByRole("tab", { name: /Ogohlantirishlar/ }).click();
  await expect(page).toHaveURL(/\?tab=alerts$/);
  await expect(page.getByText(FIRST_ALERT_TITLE)).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/ai-assistant$/);
  await expect(page.getByRole("tab", { name: "Suhbat" })).toHaveAttribute("aria-selected", "true");
  await expect(composer(page)).toBeVisible();
});

test("ogohlantirish yo'q — «Hammasi joyida», tab nishonsiz, banner yo'q", async ({ page }) => {
  const { advisor } = await mockAiAssistantApi(page, { advisor: "on" });
  advisor.alerts.length = 0;
  await page.goto("/ai-assistant?tab=alerts");
  await expect(page.getByText("Hammasi joyida")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Ochiq ogohlantirish yo'q. Qoidalar har 30 daqiqada tekshiriladi.")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Ogohlantirishlar", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("ai-alerts-critical-banner")).toHaveCount(0);
});
