import { expect, test, type Page } from "@playwright/test";
import { RESOLVE_NOTE } from "../../src/test/aiAdvisorFixtures";
import { advisorCalls, composer, FIRST_ALERT_TITLE, mockAiAssistantApi, openAiAlerts, openAiAssistant } from "./support/aiAssistant";

/**
 * 60PWUbgC — AI yordamchi «Ogohlantirishlar» (superadmin, desktop 1280; maketlar `superadmin-ai-assistant-alerts`,
 * `superadmin-ai-assistant`): maslahatchi backend'i bor (`advisor: "on"`) — tablar «Suhbat · Ogohlantirishlar 3»,
 * yangi izoh, jiddiylar banneri, filtrlar ↔ URL (`status`, `severity`, `rule` → `rule_key`, `page`), bo'sh holat,
 * tab almashganda suhbat qoralamasi saqlanadi va ochiq oyna (`alert`) olinadi. Ogohlantirish oynasi (maketlar
 * `superadmin-ai-assistant-alert-dialog`, `-alert-dialog-receipt`, `-alert-resolve-confirm`): ochilganda «Ko'rildi»
 * (nishon kamayadi), «Hal qilindi» (izoh → tasdiq → PATCH → toast), «Ahamiyatsiz» (tasdiqsiz), AI izohi (navbat →
 * tayyor; 60 s; 429 oylik / umumiy), 409, chuqur havola. «Sozlamalar» — qoidalar oynasi (maketlar
 * `superadmin-ai-assistant-settings-rules-dialog`, `-settings-confirm`): tasdiq → PATCH `{version, rules}`, mijoz va
 * server xatolari, 409, sozlamalar zondi 404. Backend yo'q holati — `ai-assistant.desktop.spec.ts`.
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
  // Hisobotlar · Tavsiyalar · Sarf — backend yo'q; «Sozlamalar» — sozlamalar zondi muvaffaqiyatli (D3).
  await expect(page.getByRole("tab", { name: /Hisobotlar|Tavsiyalar|Sarf/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sozlamalar" })).toBeVisible();

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

  // Qator → `?alert=` — oyna; Esc — `alert` olinadi; «Suhbat» ga qaytsa `tab` olinadi, qoralama joyida.
  await page.getByRole("button", { name: "1", exact: true }).click();
  await expect(page).not.toHaveURL(/[?&]page=/);
  await page.getByRole("link", { name: FIRST_ALERT_TITLE, exact: true }).click();
  await expect(page).toHaveURL(/[?&]alert=1041/);
  await expect(page.getByRole("dialog", { name: /^Jasur Tursunov kassasida/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/ai-assistant\?tab=alerts$/);
  await page.getByRole("tab", { name: "Suhbat" }).click();
  await expect(page).not.toHaveURL(/[?&](tab|alert)=/);
  await expect(composer(page)).toHaveValue("Kecha-chi?");
  await expect(page.getByRole("button", { name: "Yangi suhbat" })).toBeVisible();

  // Zond + oyna ochilgandagi yangilash (D16) + ko'pi bilan bitta 60 s poll; sozlamalar zondi — bitta (oyna ochilmadi;
  // fokusda 30 s dan eski bo'lsa yana bittasi); GET :id (yon ta'sirli) — faqat oyna ochilganda, bir marta.
  expect(advisorCalls(advisor, "ai/advisor/overview").length).toBeLessThanOrEqual(3);
  expect(advisorCalls(advisor, "ai/advisor/settings").length).toBeGreaterThanOrEqual(1);
  expect(advisorCalls(advisor, "ai/advisor/settings").length).toBeLessThanOrEqual(2);
  expect(advisor.requests.filter((request) => /^ai\/advisor\/alerts\/\d+/.test(request.path)).map((request) => request.path)).toEqual([
    "ai/advisor/alerts/1041",
  ]);
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

test("ro'yxatdan ochilgan oyna: Esc — o'sha ro'yxat yozuviga qaytadi (fokus havolada, qator «Ko'rildi»); «Orqaga» — tabdan chiqadi", async ({
  page,
}) => {
  await mockAiAssistantApi(page, { advisor: "on" });
  await openAiAssistant(page);
  await page.getByRole("tab", { name: /Ogohlantirishlar/ }).click();
  await expect(page).toHaveURL(/\?tab=alerts$/);
  const link = page.getByRole("link", { name: FIRST_ALERT_TITLE, exact: true });
  const row = page.getByRole("table", { name: "Ogohlantirishlar ro'yxati" }).getByRole("row").filter({ has: link });
  await expect(row).toContainText("Yangi");

  await link.click();
  await expect(page).toHaveURL(/[?&]alert=1041/);
  await expect(page.getByRole("dialog", { name: /^Jasur Tursunov kassasida/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/ai-assistant\?tab=alerts$/);
  await expect(link).toBeFocused();
  await expect(row).toContainText("Ko'rildi");

  // Yopish tarixga yangi ro'yxat yozuvini qo'shmaydi: bitta «Orqaga» — suhbatga.
  await page.goBack();
  await expect(page).toHaveURL(/\/ai-assistant$/);
  await expect(page.getByRole("tab", { name: "Suhbat" })).toHaveAttribute("aria-selected", "true");
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

// ── Ogohlantirish oynasi (`?alert=:id`) ────────────────────────────────────────────────────────────────────

/** R1 ro'yxat sarlavhasi (1-sahifada eski yopilgan nusxasi ham bor — birinchisi `1040`). */
const R1_LIST_TITLE = "Samarqand filiali kassasida 3 smena ketma-ket kamomad: −445 000 so'm";
const R1_DIALOG_TITLE = "Samarqand filiali kassasida 3 smena ketma-ket kamomad";

test("⭐ R1 oynasi: ochilganda «Ko'rildi» (nishon 3 → 2); izohsiz «Hal qilindi» — xato; tasdiq → PATCH → toast, ro'yxatda «Hal qilindi»", async ({
  page,
}) => {
  const { advisor, leaked } = await mockAiAssistantApi(page, { advisor: "on" });
  await openAiAlerts(page);
  const tab = page.getByRole("tab", { name: /Ogohlantirishlar/ });
  await expect(tab).toHaveText("Ogohlantirishlar 3");
  const table = page.getByRole("table", { name: "Ogohlantirishlar ro'yxati" });
  const row = table.getByRole("row").filter({ has: page.getByRole("link", { name: R1_LIST_TITLE, exact: true }) }).first();
  await expect(row).toContainText("Yangi");

  await row.getByRole("link", { name: R1_LIST_TITLE, exact: true }).click();
  await expect(page).toHaveURL(/\?tab=alerts&alert=1040$/);
  const dialog = page.getByRole("dialog", { name: R1_DIALOG_TITLE });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Ko'rildi", { exact: true })).toBeVisible();
  await expect(dialog.getByText("3 marta takrorlandi")).toBeVisible();
  await expect(dialog.getByRole("table", { name: "Dalillar · 3 ta yozuv" }).getByRole("row")).toHaveCount(5);
  await expect(dialog.getByText("Uchala smenani Sardor Mirzayev yopgan")).toBeVisible();
  await expect(dialog.getByRole("region", { name: "AI izohi" })).toContainText("Uchala kamomad ham «Humo virtual» kartasida");
  await expect(dialog.getByRole("link", { name: "Smena hisobotiga o'tish" })).toHaveAttribute("href", "/payments/shifts/818");
  // D16: GET :id — «Ko'rildi»; nishon darhol yangilanadi, ro'yxat — oyna yopilgach (qator oyna ortida o'zgarmaydi).
  await expect(tab).toHaveText("Ogohlantirishlar 2");
  await expect(row).toContainText("Yangi");

  // Izohsiz — mijoz xatosi, so'rov yo'q.
  await dialog.getByRole("button", { name: "Hal qilindi" }).click();
  await expect(dialog.getByText("Izoh kamida 3 belgi bo'lsin")).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Izoh" })).toBeFocused();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);

  await dialog.getByRole("textbox", { name: "Izoh" }).fill(`  ${RESOLVE_NOTE}  `);
  await dialog.getByRole("button", { name: "Hal qilindi" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Ogohlantirish hal qilindimi?" });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText("Samarqand filiali · smena kamomadi −445 000 so'm");
  await expect(confirm).toContainText(RESOLVE_NOTE);
  await expect(confirm).toContainText("Holat «Hal qilindi»ga o'tadi va faoliyat jurnaliga yoziladi.");
  await expect(confirm).toContainText("Muammo qaytsa, yangi ogohlantirish ochiladi.");
  expect(advisorCalls(advisor, "ai/advisor/alerts/1040", "PATCH")).toHaveLength(0);
  await confirm.getByRole("button", { name: "Hal qilindi deb belgilash" }).click();

  await expect(page.getByText("Ogohlantirish hal qilindi", { exact: true })).toBeVisible();
  await expect(page.getByText("Samarqand filiali · smena kamomadi. Faoliyat jurnaliga yozildi.", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: R1_DIALOG_TITLE })).toHaveCount(0);
  await expect(page).toHaveURL(/\/ai-assistant\?tab=alerts$/);
  expect(advisorCalls(advisor, "ai/advisor/alerts/1040", "PATCH").map((request) => request.body)).toEqual([
    { status: "resolved", note: RESOLVE_NOTE },
  ]);
  await expect(row).toContainText("Hal qilindi");
  expect(advisorCalls(advisor, "ai/advisor/alerts/1040")).toHaveLength(1);
  expect(leaked).toEqual([]);
});

test("«Ahamiyatsiz» — tasdiqsiz: PATCH `dismissed`, toast, oyna yopiladi", async ({ page }) => {
  const { advisor } = await mockAiAssistantApi(page, { advisor: "on" });
  await openAiAlerts(page, "/ai-assistant?tab=alerts&alert=1036");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Ahamiyatsiz" })).toBeVisible();
  await dialog.getByRole("button", { name: "Ahamiyatsiz" }).click();

  await expect(page.getByText("Ahamiyatsiz deb belgilandi", { exact: true })).toBeVisible();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/ai-assistant\?tab=alerts$/);
  expect(advisorCalls(advisor, "ai/advisor/alerts/1036", "PATCH").map((request) => request.body)).toEqual([{ status: "dismissed" }]);
});

test("409 — boshqa superadmin yopgan: tasdiq oynasida izoh, tugma o'chadi", async ({ page }) => {
  await mockAiAssistantApi(page, { advisor: "on", patch: "closed" });
  await openAiAlerts(page, "/ai-assistant?tab=alerts&alert=1040");
  const dialog = page.getByRole("dialog", { name: R1_DIALOG_TITLE });
  await dialog.getByRole("textbox", { name: "Izoh" }).fill(RESOLVE_NOTE);
  await dialog.getByRole("button", { name: "Hal qilindi" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Ogohlantirish hal qilindimi?" });
  await confirm.getByRole("button", { name: "Hal qilindi deb belgilash" }).click();
  await expect(confirm.getByRole("alert")).toContainText("Ogohlantirish allaqachon yopilgan");
  await expect(confirm.getByRole("button", { name: "Hal qilindi deb belgilash" })).toBeDisabled();
});

test("AI izohi: «AI izohini olish» → «AI izoh yozmoqda…» → tayyor (poll)", async ({ page }) => {
  const { advisor } = await mockAiAssistantApi(page, { advisor: "on", explain: "queued", explainReadyAfter: 2 });
  Object.assign(advisor.alerts.find((alert) => alert.id === "1040")!, { explanation_status: "none", explanation_md: null, explained_at: null });
  await openAiAlerts(page, "/ai-assistant?tab=alerts&alert=1040");
  const region = page.getByRole("dialog", { name: R1_DIALOG_TITLE }).getByRole("region", { name: "AI izohi" });
  await expect(region).toContainText("Izoh so'ralganda yoziladi — budjetdan sarflanadi.");

  await region.getByRole("button", { name: "AI izohini olish" }).click();
  await expect(region).toContainText("AI izoh yozmoqda…");
  await expect(region).toContainText("Uchala kamomad ham «Humo virtual» kartasida", { timeout: 20_000 });
  await expect(region).toContainText("AI xato qilishi mumkin — muhim qarordan oldin manbani tekshiring.");
  expect(advisorCalls(advisor, "ai/advisor/alerts/1040/explain", "POST").map((request) => request.body)).toEqual([{}]);
  expect(advisorCalls(advisor, "ai/advisor/alerts/1040").length).toBeGreaterThanOrEqual(3);
});

test("AI izohi: 60 s da tayyor bo'lmasa — «Izoh hali tayyor emas», poll to'xtaydi; «Qayta urinish» qayta so'raydi", async ({ page }) => {
  await page.clock.install();
  const { advisor } = await mockAiAssistantApi(page, { advisor: "on", explain: "stuck" });
  Object.assign(advisor.alerts.find((alert) => alert.id === "1040")!, { explanation_status: "none", explanation_md: null, explained_at: null });
  await openAiAlerts(page, "/ai-assistant?tab=alerts&alert=1040");
  const region = page.getByRole("dialog", { name: R1_DIALOG_TITLE }).getByRole("region", { name: "AI izohi" });
  await region.getByRole("button", { name: "AI izohini olish" }).click();
  await expect(region).toContainText("AI izoh yozmoqda…");

  await page.clock.fastForward("01:01");
  await expect(region).toContainText("Izoh hali tayyor emas — keyinroq oching");
  // Oxirgi poll so'rovi (tezlatish paytida ketgan) yetib kelsin — keyin yangi so'rov bo'lmasligi kerak.
  await page.waitForTimeout(500);
  const polls = advisorCalls(advisor, "ai/advisor/alerts/1040").length;
  await page.clock.fastForward("00:10");
  await page.waitForTimeout(500);
  await expect(region.getByRole("button", { name: "Qayta urinish" })).toBeVisible();
  expect(advisorCalls(advisor, "ai/advisor/alerts/1040")).toHaveLength(polls);

  await region.getByRole("button", { name: "Qayta urinish" }).click();
  await expect(region).toContainText("AI izoh yozmoqda…");
  expect(advisorCalls(advisor, "ai/advisor/alerts/1040/explain", "POST")).toHaveLength(2);
});

for (const [mode, text] of [
  ["budget_month", /Oylik AI budjeti tugagan — izohni \d{2}\.\d{2}\.\d{4}, 00:00 dan keyin olish mumkin\. Qoidalar va dalillar ishlayveradi\./],
  ["budget_global", /Bugungi umumiy AI chegarasi tugadi\. Faktlar va dalillar to'liq; izohni ertaga, 00:00 dan keyin so'rash mumkin \(Toshkent vaqti\)\./],
] as const) {
  test(`AI izohi: 429 (${mode}) — matn va o'chiq tugma, holat o'zgarmaydi`, async ({ page }) => {
    const { advisor } = await mockAiAssistantApi(page, { advisor: "on", explain: mode });
    Object.assign(advisor.alerts.find((alert) => alert.id === "1040")!, { explanation_status: "none", explanation_md: null, explained_at: null });
    await openAiAlerts(page, "/ai-assistant?tab=alerts&alert=1040");
    const region = page.getByRole("dialog", { name: R1_DIALOG_TITLE }).getByRole("region", { name: "AI izohi" });
    await region.getByRole("button", { name: "AI izohini olish" }).click();
    await expect(region).toContainText(text);
    await expect(region.getByRole("button", { name: "AI izohini olish" })).toBeDisabled();
    expect(advisor.alerts.find((alert) => alert.id === "1040")!.explanation_status).toBe("none");
  });
}

test("chuqur havola ?tab=alerts&alert=1039 (R7): chek tekshiruvi; Esc — `alert` olinadi, filtrlar qoladi", async ({ page }) => {
  const { advisor } = await mockAiAssistantApi(page, { advisor: "on" });
  await page.goto("/ai-assistant?tab=alerts&severity=critical&alert=1039");
  const dialog = page.getByRole("dialog", { name: "Chekda farq bor — Urgut filiali yoqilg'i xarajati" });
  await expect(dialog).toBeVisible({ timeout: 60_000 });
  const check = dialog.getByRole("region", { name: "Chek tekshiruvi" });
  await expect(check).toContainText("Farq bor");
  await expect(check).toContainText("Karta mos emas");
  await expect(check).toContainText("Bu hafta 46 ta chek tekshirildi: 41 mos, 3 farq bor, 2 o'qib bo'lmadi.");
  await expect(dialog.getByRole("link", { name: "Operatsiyaga o'tish" })).toHaveAttribute(
    "href",
    "/payments/cash-detail/12?type=branch&history=99120",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/ai-assistant\?tab=alerts&severity=critical$/);
  // Banner: R7 ko'rildi — 1 ta jiddiy qoldi.
  await expect(page.getByTestId("ai-alerts-critical-banner")).toContainText("1 ta jiddiy ogohlantirish ko'rib chiqilmagan");
  expect(advisorCalls(advisor, "ai/advisor/alerts/1039")).toHaveLength(1);
});

test("backend dev holatlari: R7 chek so'mda emas («100 USD», «Farq» —), o'tkazma («HQ kartasiga tushmagan»), R8 baza 0", async ({
  page,
}) => {
  const { advisor, advisorFixtures } = await mockAiAssistantApi(page, { advisor: "on" });
  for (const detail of [advisorFixtures.detail.r7Currency, advisorFixtures.detail.r7Transfer, advisorFixtures.detail.r8NoBaseline]) {
    advisor.alerts.push(structuredClone(detail));
  }

  await page.goto("/ai-assistant?tab=alerts&alert=1050");
  const currency = page.getByRole("dialog", { name: "Chek so'mda emas — Urgut filiali yoqilg'i xarajati" });
  await expect(currency).toBeVisible({ timeout: 60_000 });
  const currencyFacts = currency.getByRole("group", { name: "Asosiy ma'lumotlar" });
  await expect(currencyFacts.getByRole("definition")).toHaveText([
    "Qo'lda chiqim · Yoqilg'i",
    "Urgut filiali",
    "1 250 000 so'm",
    "100 USD",
    "—",
    /^Ravshan Ortiqov · /,
  ]);
  await expect(currency).toContainText("Chek boshqa valyutada (USD) — so'mdagi summa bilan solishtirib bo'lmadi.");
  await expect(currency.getByRole("region", { name: "Chek tekshiruvi" })).toContainText("So'mda emas");
  await page.keyboard.press("Escape");
  await expect(currency).toHaveCount(0);

  await page.goto("/ai-assistant?tab=alerts&alert=1051");
  const transfer = page.getByRole("dialog", { name: "Pul HQ kartasiga tushmagan — Samarqand filiali kuryer topshirig'i" });
  await expect(transfer).toBeVisible({ timeout: 60_000 });
  await expect(transfer.getByRole("group", { name: "Asosiy ma'lumotlar" }).getByRole("term")).toHaveText([
    "Operatsiya",
    "Jo'natuvchi",
    "Kiritilgan",
    "Chekda",
    "Kiritgan",
  ]);
  const check = transfer.getByRole("region", { name: "Chek tekshiruvi" });
  await expect(check).toContainText("HQ kartasiga tushmagan");
  await expect(check).toContainText("··1209HQ kartasi emas");
  await expect(transfer.getByRole("link", { name: "Operatsiyaga o'tish" })).toHaveAttribute("href", "/payments/main-cashbox?history=99301");
  await page.keyboard.press("Escape");

  await page.goto("/ai-assistant?tab=alerts&alert=1053");
  const corrections = page.getByRole("dialog", { name: /4 ta tuzatish — oldingi 30 kunda tuzatish bo'lmagan$/ });
  await expect(corrections).toBeVisible({ timeout: 60_000 });
  await expect(corrections.getByRole("group", { name: "Asosiy ma'lumotlar" })).toContainText("Oldingi 30 kunda tuzatish bo'lmagan");
  expect(advisorCalls(advisor, "ai/advisor/alerts/1050")).toHaveLength(1);
});

test("R2–R6, R8: ro'yxatdan ochiladi — har qoidaning faktlari, o'lchagich / dalil jadvali va asosiy havolasi", async ({ page }) => {
  const { advisor } = await mockAiAssistantApi(page, { advisor: "on" });
  await openAiAlerts(page);

  const open = async (id: string, listTitle: string | RegExp, dialogTitle: string | RegExp) => {
    // Sarlavha havolasi (› tugmasining nomi ««…» ogohlantirishini ochish» — u tanlanmaydi; ro'yxatda shu nomli
    // yopilgan nusxalar ham bor — `alert` bo'yicha).
    await page.getByRole("link", { name: listTitle, exact: true }).and(page.locator(`[href$="alert=${id}"]`)).click();
    const dialog = page.getByRole("dialog", { name: dialogTitle });
    await expect(dialog).toBeVisible();
    return dialog;
  };
  const close = async (dialog: ReturnType<typeof page.getByRole>) => {
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/ai-assistant\?tab=alerts$/);
  };
  const facts = (dialog: ReturnType<typeof page.getByRole>) => dialog.getByLabel("Asosiy ma'lumotlar");

  // R2 «Kuryer qarzi o'smoqda» — ikkala shart, o'lchagich (jiddiy), kassa harakati.
  let dialog = await open("1041", FIRST_ALERT_TITLE, "Jasur Tursunov kassasida 2 840 000 so'm topshirilmagan");
  await expect(facts(dialog)).toContainText("Jasur Tursunov · Toshkent HQ");
  await expect(facts(dialog)).toContainText("4 kun oldin");
  await expect(dialog.getByRole("meter", { name: "Kassadagi summa 2 840 000 so'm, qoida chegarasi 2 000 000 so'm" })).toBeVisible();
  await expect(dialog.getByText("Chegaradan 840 000 so'm ortiq", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/Ikkala shart bajarildi: 4 kun ketma-ket o'sdi va 4 kun topshirilmagan$/)).toBeVisible();
  const days = dialog.getByRole("table", { name: "Kassa harakati · oxirgi 5 kun" });
  await expect(days.getByRole("row")).toHaveCount(7);
  await expect(days.getByRole("row").last()).toContainText("+2 840 000 so'm");
  await expect(dialog.getByRole("link", { name: "Kuryer kassasini ochish" })).toHaveAttribute("href", "/payments/cash-detail/377?type=courier");
  await close(dialog);

  // R3 «G'ayrioddiy xarajat» — «Odatdagidan 3,4 barobar», oxirgi 5 xarajat, «Izoh» ustunisiz.
  dialog = await open(
    "1036",
    "Farg'ona filiali: yoqilg'i xarajati 1 450 000 so'm — odatdagidan 3,4 barobar",
    "Farg'ona filiali: yoqilg'i xarajati odatdagidan 3,4 barobar ko'p",
  );
  await expect(facts(dialog)).toContainText("425 000 so'm · 11 ta xarajat");
  await expect(dialog.getByText("Odatdagidan 3,4 barobar", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Tik chiziq — qoida chegarasi: mediana + 3 × mediana og'ishi = 680 000 so'm", { exact: true })).toBeVisible();
  const expenses = dialog.getByRole("table", { name: "Shu kategoriyadagi oxirgi 5 xarajat" });
  await expect(expenses.getByRole("row").nth(1)).toContainText("Shu xarajat");
  await expect(expenses.getByRole("row").last()).toContainText("30 kunlik mediana");
  await expect(expenses.getByRole("columnheader", { name: "Izoh" })).toHaveCount(0);
  await expect(dialog.getByRole("link", { name: "Xarajatni ochish" })).toHaveAttribute("href", "/payments/cash-detail/9?type=branch&history=98877");
  await close(dialog);

  // R4 «Market to'lovi kechikmoqda» — to'lovlar tarixi (oraliq), jami — to'lovsiz kunlar.
  dialog = await open("1034", "Nur Elektronika — 9 kundan beri to'lov yo'q, qarz 3 120 000 so'm", "Nur Elektronika — 9 kundan beri to'lov yo'q");
  await expect(facts(dialog)).toContainText("3 120 000 so'm");
  const payouts = dialog.getByRole("table", { name: "To'lovlar tarixi · oxirgi 2 ta" });
  await expect(payouts.getByRole("row").nth(1)).toContainText("4 kun");
  await expect(payouts.getByRole("row").last()).toContainText("holatida · berilishi kerak");
  await expect(payouts.getByRole("row").last()).toContainText("9 kun");
  await expect(dialog.getByRole("link", { name: "Market kassasini ochish" })).toHaveAttribute("href", "/payments/cash-detail/55?type=market");
  await close(dialog);

  // R5 «HQ'ga o'tkazma kechikmoqda» — o'lchagich, oxirgi o'tkazmalar.
  dialog = await open(
    "1033",
    "Urgut filiali kassasida 6 400 000 so'm — HQ'ga 4 kundan beri o'tkazma yo'q",
    "Urgut filiali 4 kundan beri HQ'ga pul o'tkazmagan",
  );
  await expect(dialog.getByRole("meter", { name: "Filial kassasida 6 400 000 so'm, qoida chegarasi 5 000 000 so'm" })).toBeVisible();
  const transfers = dialog.getByRole("table", { name: "HQ'ga oxirgi o'tkazmalar · 4 ta" });
  await expect(transfers.getByRole("row").last()).toContainText("4 kun o'tkazmasiz");
  await expect(dialog.getByRole("link", { name: "Filial kassasini ochish" })).toHaveAttribute("href", "/payments/cash-detail/12?type=branch");
  await close(dialog);

  // R6 «Zarar» (hal qilingan) — oldingi kun bilan solishtirish, faqat «Yopish».
  dialog = await open("1031", /kuni sof foyda −380 000 so'm$/, /kuni zarar: sof foyda −380 000 so'm$/);
  await expect(facts(dialog)).toContainText("Butun tizim");
  const compare = dialog.getByRole("table", { name: "Oldingi kun bilan solishtirish" });
  await expect(compare).toContainText("−5,3%");
  await expect(compare).toContainText("+54,3%");
  await expect(compare).toContainText("−640 000 so'm");
  await expect(dialog.getByRole("button", { name: "Hal qilindi" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Yopish" }).last()).toBeVisible();
  await close(dialog);

  // R8 «Tuzatishlar ko'paydi» (ahamiyatsiz) — turlar bo'yicha taqsimot.
  dialog = await open("1029", /haftasida 14 ta tuzatish — 30 kunlik o'rtachadan 2,3 barobar$/, /haftasida 14 ta tuzatish — odatdagidan 2,3 barobar ko'p$/);
  await expect(facts(dialog)).toContainText("14 ta · 9 qaytarish, 5 tahrir");
  const breakdown = dialog.getByRole("region", { name: "Taqsimot · 14 ta tuzatish" });
  await expect(breakdown.getByRole("meter", { name: "Qaytarish: 14 tadan 9 ta" })).toBeVisible();
  await expect(breakdown.getByRole("meter", { name: "Summani tahrirlash: 14 tadan 5 ta" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Tuzatishlar tarixini ochish" })).toHaveCount(0);
  await close(dialog);

  // Har oyna — bitta GET (ochilganda «Ko'rildi»).
  for (const id of ["1041", "1036", "1034", "1033", "1031", "1029"]) expect(advisorCalls(advisor, `ai/advisor/alerts/${id}`)).toHaveLength(1);
});

// ── «Sozlamalar» — qoidalar oynasi (maketlar `superadmin-ai-assistant-settings-rules-dialog`, `-settings-confirm`) ──

/** «Sozlamalar» → oyna (faqat «Qoidalar», D3). */
const openSettings = async (page: Page) => {
  await page.getByRole("button", { name: "Sozlamalar" }).click();
  const dialog = page.getByRole("dialog", { name: "AI yordamchi sozlamalari" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("switch")).toHaveCount(8);
  return dialog;
};

test("⭐ sozlamalar: chegara va kalit → tasdiq («eski → yangi», izoh) → PATCH {version, rules} (severity yo'q) → toast; qayta ochilganda yangi qiymat", async ({
  page,
}) => {
  const { advisor, leaked } = await mockAiAssistantApi(page, { advisor: "on" });
  await openAiAlerts(page);
  const dialog = await openSettings(page);
  await expect(dialog.getByText("Faqat superadmin · har o'zgarish faoliyat jurnaliga yoziladi")).toBeVisible();
  await expect(dialog.getByRole("tablist")).toHaveCount(0);
  await expect(dialog.getByRole("textbox", { name: "Nisbat" })).toHaveCount(0);

  const shortage = dialog.getByRole("textbox", { name: "Bir smenadagi kamomad" });
  await expect(shortage).toHaveValue("50 000");
  await shortage.fill("30000");
  await expect(shortage).toHaveValue("30 000");
  await expect(dialog.getByText("Avval: 50 000 so'm")).toBeVisible();
  const corrections = dialog.getByRole("switch", { name: "Tuzatishlar ko'paydi" });
  await corrections.click();
  await expect(corrections).toHaveAttribute("aria-checked", "false");
  await expect(dialog.getByText("Tuzatishlar 30 kunlik o'rtachadan 2 barobar ko'p · avval yoqilgan edi")).toBeVisible();

  await dialog.getByRole("button", { name: "Saqlash" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Sozlamalarni saqlaysizmi?" });
  await expect(confirm).toContainText("2 ta o'zgarish · faoliyat jurnaliga yoziladi");
  await expect(confirm.getByRole("term")).toHaveText(["Smena kamomadi · Bir smenadagi kamomad", "Tuzatishlar ko'paydi"]);
  await expect(confirm.getByRole("definition").nth(0)).toContainText("30 000 so'm");
  await expect(confirm.getByRole("definition").nth(1)).toContainText("O'chirilgan");
  await expect(confirm).toContainText("O'chirilgan qoida bo'yicha ogohlantirish chiqmaydi.");
  expect(advisorCalls(advisor, "ai/advisor/settings", "PATCH")).toHaveLength(0);
  await confirm.getByRole("button", { name: "Saqlash" }).click();

  await expect(page.getByText("Sozlamalar saqlandi", { exact: true })).toBeVisible();
  await expect(page.getByText("Qoidalar keyingi tekshiruvdan qo'llanadi", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "AI yordamchi sozlamalari" })).toHaveCount(0);
  const patches = advisorCalls(advisor, "ai/advisor/settings", "PATCH");
  expect(patches.map((request) => request.body)).toEqual([{ version: 4, rules: { R1: { shortage_uzs: 30_000 }, R8: { enabled: false } } }]);
  expect(advisor.settings.version).toBe(5);
  // R8 `ratio` / `min_count` (Q12) — formada yo'q, PATCH ga kirmaydi, backend qisman birlashtiradi — saqlangani qoladi.
  expect(advisor.settings.rules.R8).toMatchObject({ enabled: false, ratio: 2, min_count: 3 });

  const again = await openSettings(page);
  await expect(again.getByRole("textbox", { name: "Bir smenadagi kamomad" })).toHaveValue("30 000");
  await expect(again.getByRole("switch", { name: "Tuzatishlar ko'paydi" })).toHaveAttribute("aria-checked", "false");
  await expect(again.getByText(/Avval:|avval yoqilgan edi/)).toHaveCount(0);
  await again.getByRole("button", { name: "Bekor qilish" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(leaked).toEqual([]);
});

test("sozlamalar: noto'g'ri qiymat — maydonda xato, PATCH yo'q; server INVALID_RULE — maydonda; 500 — «Sozlamalar saqlanmadi»", async ({
  page,
}) => {
  const { advisor } = await mockAiAssistantApi(page, { advisor: "on", settingsPatch: "invalid_rule" });
  await openAiAssistant(page);
  const dialog = await openSettings(page);
  const consecutive = dialog.getByRole("textbox", { name: "Ketma-ket manfiy smenalar" });

  await consecutive.fill("0");
  await dialog.getByRole("button", { name: "Saqlash" }).click();
  await expect(consecutive).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByText("1 dan katta son kiriting")).toBeVisible();
  await expect(consecutive).toBeFocused();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);

  // Server boshqa chegara bilan rad etadi (mijoz o'tkazgan qiymat).
  await consecutive.fill("4");
  await dialog.getByRole("button", { name: "Saqlash" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Saqlash" }).click();
  await expect(dialog.getByText("2–30 oralig'ida kiriting")).toBeVisible();
  await expect(consecutive).toBeFocused();
  await expect(dialog).toBeVisible();

  advisor.settingsPatch = "error";
  await dialog.getByRole("button", { name: "Saqlash" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Saqlash" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Sozlamalar saqlanmadi");
  await expect(dialog.getByRole("alert")).toContainText("Hech narsa o'zgarmadi — qayta urining.");
  await expect(consecutive).toHaveValue("4");
  expect(advisorCalls(advisor, "ai/advisor/settings", "PATCH")).toHaveLength(2);
  expect(advisor.settings.version).toBe(4);
});

test("sozlamalar: 409 — boshqa oynada saqlangan: qayta o'qiladi, o'zgarish saqlanib qoladi, qayta saqlash yangi versiya bilan", async ({ page }) => {
  const { advisor } = await mockAiAssistantApi(page, { advisor: "on" });
  await openAiAssistant(page);
  const dialog = await openSettings(page);
  await dialog.getByRole("textbox", { name: "To'lovsiz kunlar" }).fill("10");

  // Boshqa superadmin: versiya 5, «Kuryer qarzi o'smoqda» o'chirilgan.
  advisor.settings = { ...advisor.settings, version: 5, rules: { ...advisor.settings.rules, R2: { ...advisor.settings.rules.R2, enabled: false } } };
  await dialog.getByRole("button", { name: "Saqlash" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Saqlash" }).click();

  await expect(dialog.getByText("Sozlamalar boshqa oynada o'zgartirilgan")).toBeVisible();
  await expect(dialog.getByRole("switch", { name: "Kuryer qarzi o'smoqda" })).toHaveAttribute("aria-checked", "false");
  await expect(dialog.getByRole("textbox", { name: "To'lovsiz kunlar" })).toHaveValue("10");

  await dialog.getByRole("button", { name: "Saqlash" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("1 ta o'zgarish · faoliyat jurnaliga yoziladi");
  await confirm.getByRole("button", { name: "Saqlash" }).click();
  await expect(page.getByText("Sozlamalar saqlandi", { exact: true })).toBeVisible();
  expect(advisorCalls(advisor, "ai/advisor/settings", "PATCH").map((request) => request.body)).toEqual([
    { version: 4, rules: { R4: { days_without_payout: 10 } } },
    { version: 5, rules: { R4: { days_without_payout: 10 } } },
  ]);
  expect(advisor.settings.version).toBe(6);
  expect(advisor.settings.rules.R2.enabled).toBe(false);
});

test("sozlamalar zondi 404 (backend faqat ogohlantirishlar bilan) — «Sozlamalar» yo'q, tablar bor", async ({ page }) => {
  const { advisor } = await mockAiAssistantApi(page, { advisor: "on", settings: "off" });
  await openAiAlerts(page);
  await expect(page.getByRole("tablist", { name: "AI yordamchi bo'limlari" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sozlamalar" })).toHaveCount(0);
  expect(advisorCalls(advisor, "ai/advisor/settings")).toHaveLength(1);
});
