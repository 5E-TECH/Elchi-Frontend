import { expect, test } from "@playwright/test";
import { advisorCalls, composer, mockAiAssistantApi, openAiAssistant } from "./support/aiAssistant";

/**
 * F7PWp6cK / T2 — AI moliyaviy yordamchi (faqat suhbat, superadmin), desktop 1280: menyu «Moliya» → «AI yordamchi»,
 * bo'sh suhbat → savol → SSE javob (markdown jadval, «Manba», limit `done.limits` dan), URL `?conversation=`,
 * «To'xtatish», uzilish va tarixdan to'liq javob, 503 → «AI o'chiq», 429 → limit tugadi. Ega 2026-11-23: superadmin
 * «Kirish huquqi» oynasida adminga ruxsat beradi; ruxsatli admin — menyuda va sahifada, ruxsatsiz — menyuda yo'q,
 * URL'da «ruxsat berilmagan».
 */
test.describe.configure({ timeout: 120_000 });

test("⭐ menyu → bo'sh suhbat → karta → SSE javob: markdown jadval, «Manba», URL va ro'yxat, limit 39 / 100", async ({ page }) => {
  const { state, leaked } = await mockAiAssistantApi(page, { conversations: "none" });
  await page.goto("/");
  const link = page.getByRole("link", { name: "AI yordamchi" });
  await expect(link).toBeVisible({ timeout: 60_000 });
  await link.click();
  await expect(page).toHaveURL(/\/ai-assistant$/);
  await expect(page.getByRole("heading", { level: 1, name: "AI moliyaviy yordamchi" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Moliya bo'yicha savol bering" })).toBeVisible();
  await expect(page.getByText("Hali suhbat yo'q.")).toBeVisible();
  // T2 qismlari yo'q.
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page.getByText(/Chuqur tahlil|Oylik budjet|Sozlamalar/)).toHaveCount(0);

  await page.getByRole("button", { name: /Qaysi kuryerlarda qarz ko'p\?/ }).click();
  const log = page.getByRole("log", { name: "Suhbat" });
  await expect(log.getByText("Qaysi kuryerlarda qarz ko'p?")).toBeVisible();
  await expect(log.getByText("286,4 mln so'm")).toBeVisible();
  await expect(log.getByRole("heading", { name: "Eng ko'p qarzi bor kuryerlar" })).toBeVisible();
  await expect(log.getByRole("cell", { name: "2 840 000 so'm" })).toBeVisible();
  await expect(
    log.getByText("Manba: kassa operatsiyalari 01.10–23.10.2026, 1 284 ta yozuv; kuryerlar qarzi (joriy holat), 37 ta yozuv"),
  ).toBeVisible();
  await expect(log.getByText("AI xato qilishi mumkin — muhim qarordan oldin manbani tekshiring.")).toBeVisible();

  await expect(page).toHaveURL(/\/ai-assistant\?conversation=77$/);
  await expect(page.getByRole("navigation", { name: "Suhbatlar tarixi" }).getByRole("link", { name: /Qaysi kuryerlarda qarz ko'p/ })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(page.getByRole("complementary").getByText("39 / 100 savol")).toBeVisible();
  expect(state.posts).toEqual([{ message: "Qaysi kuryerlarda qarz ko'p?" }]);

  // Davomi — o'sha suhbatda (`conversation_id`). Klaviatura bilan: fokus <body> ga tushmaydi — javob tugagach maydonda.
  await composer(page).fill("Kecha-chi?");
  await composer(page).focus();
  await page.keyboard.press("Control+Enter");
  await expect(log.getByText("Kecha-chi?")).toBeVisible();
  await expect(log.getByRole("button", { name: "Javobni nusxalash" })).toHaveCount(2);
  await expect(composer(page)).toBeFocused();
  expect(state.posts[1]).toEqual({ message: "Kecha-chi?", conversation_id: "77" });
  expect(leaked).toEqual([]);
});

test("maslahatchi backend'i yo'q (404, bugungi prod): tablar va «Sozlamalar» yo'q, ?tab=alerts e'tiborga olinmaydi; zond — 1 so'rov", async ({ page }) => {
  const { advisor, leaked } = await mockAiAssistantApi(page);
  await openAiAssistant(page, "/ai-assistant?tab=alerts&status=new&alert=1041");
  await expect(page.getByRole("heading", { name: "Moliya bo'yicha savol bering" })).toBeVisible();
  await expect(page.getByText("Pul oqimi, kassa va hisob-kitoblar bo'yicha savol bering. Yordamchi faqat ma'lumot o'qiydi.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Yangi suhbat" })).toBeVisible();
  await expect(page.getByRole("tablist")).toHaveCount(0);
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: /^Bo'lim:/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sozlamalar" })).toHaveCount(0);
  await expect(page.locator("[data-shell-slot=content]").getByText("Ogohlantirishlar")).toHaveCount(0);
  // Xato UI yo'q (Toaster'ning bo'sh jonli hududi — slotdan tashqarida).
  await expect(page.locator("[data-shell-slot=content]").getByRole("alert")).toHaveCount(0);
  // URL tegilmaydi (faqat e'tiborga olinmaydi).
  await expect(page).toHaveURL(/\/ai-assistant\?tab=alerts&status=new&alert=1041$/);

  // Boshqa sahifaga o'tib qaytganda ham qayta so'ralmaydi (sessiya davomida keshlanadi), oyna fokusida ham.
  await page.getByRole("link", { name: "Bosh sahifa" }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("link", { name: "AI yordamchi" }).click();
  await expect(page.getByRole("heading", { name: "Moliya bo'yicha savol bering" })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("tablist")).toHaveCount(0);

  expect(advisorCalls(advisor, "ai/advisor/overview")).toHaveLength(1);
  expect(advisorCalls(advisor, "ai/advisor/settings")).toHaveLength(0);
  expect(advisor.requests).toHaveLength(1);
  expect(leaked).toEqual([]);
});

test("«To'xtatish»: javob kelmaguncha maydon o'chiq, tugma ikonkasiz; to'xtatilgach «Javob to'xtatildi» + «Qayta yuborish»; fokus <body> ga tushmaydi", async ({ page }) => {
  const { state } = await mockAiAssistantApi(page, { mode: "pending" });
  await openAiAssistant(page);
  await composer(page).fill("Sentyabrda nega zarar bo'ldi?");
  // Klaviatura: «Yuborish» → Enter — tugma o'rnini «To'xtatish» oladi, fokus unga o'tadi.
  await page.getByRole("button", { name: "Yuborish", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("AI yordamchi · yozmoqda")).toBeVisible();
  await expect(composer(page)).toBeDisabled();
  await expect(composer(page)).toHaveAttribute("placeholder", "Javob yozilmoqda…");
  const stop = page.getByRole("button", { name: "To'xtatish" });
  await expect(stop.locator("svg")).toHaveCount(0);
  await expect(stop).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Javob to'xtatildi")).toBeVisible();
  await expect(page.getByRole("button", { name: "Qayta yuborish" })).toBeVisible();
  await expect(composer(page)).toBeEnabled();
  await expect(composer(page)).toBeFocused();
  expect(state.hanging).toBe(1);
});

test("uzilish: qisman matn + «Aloqa uzildi»; ai-service saqlagan to'liq javob tarixdan o'zi keladi", async ({ page }) => {
  await mockAiAssistantApi(page, { mode: "cut", conversations: "none" });
  await openAiAssistant(page);
  await composer(page).fill("Marketlarga to'lanmagan summa qancha?");
  await page.getByRole("button", { name: "Yuborish", exact: true }).click();
  await expect(page.getByText("Aloqa uzildi", { exact: true })).toBeVisible();
  await expect(page.getByText("Server bilan aloqa uzildi. Javob to'liq kelmadi.")).toBeVisible();
  await expect(page.getByText("Hozir marketlarga to'lanmagan jami")).toBeVisible();
  // ≈5 s dan keyin suhbat qayta so'raladi — to'liq javob qisman matn o'rnini egallaydi.
  await expect(page.getByText("286,4 mln so'm")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Aloqa uzildi", { exact: true })).toHaveCount(0);
});

test("503 → «AI yordamchi hozir ishlamayapti», maydon «AI o'chiq», savol matnga qaytadi; tarix ochiq", async ({ page }) => {
  await mockAiAssistantApi(page, { mode: "disabled" });
  await openAiAssistant(page);
  await composer(page).fill("Bu oy kassaga qancha tushdi?");
  await page.getByRole("button", { name: "Yuborish", exact: true }).click();
  await expect(page.getByText("AI yordamchi hozir ishlamayapti")).toBeVisible();
  await expect(composer(page)).toHaveAttribute("placeholder", "AI o'chiq");
  await expect(composer(page)).toHaveValue("Bu oy kassaga qancha tushdi?");
  await page.getByRole("link", { name: /Marketlarga to'lanmagan summa/ }).click();
  await expect(page.getByRole("log", { name: "Suhbat" }).getByText("18,4 mln so'm")).toBeVisible();
});

test("429 (limit tugadi) → ogohlantirish, maydon o'chiq, yon ustunda «Limit tugadi …»", async ({ page }) => {
  await mockAiAssistantApi(page, { mode: "limit" });
  await openAiAssistant(page, "/ai-assistant?conversation=41");
  await composer(page).fill("Yana bitta savol");
  await page.getByRole("button", { name: "Yuborish", exact: true }).click();
  await expect(page.getByText("Bugungi 100 ta savol ishlatildi")).toBeVisible();
  await expect(page.getByText("Yangi savol ertaga, 00:00 dan.")).toBeVisible();
  await expect(composer(page)).toHaveAttribute("placeholder", "Limit ertaga, 00:00 da yangilanadi");
  await expect(page.getByText("Limit tugadi — ertaga, 00:00 da yangilanadi (Toshkent vaqti).")).toBeVisible();
});

test("kunlik AI chegarasi (-daily-cap) → suhbat ustida ogohlantirish (summasiz), maydon o'z placeholder'i bilan o'chiq; «Yangi suhbat» dan keyin ham turadi", async ({ page }) => {
  await mockAiAssistantApi(page, { mode: "cap", conversations: "none" });
  await openAiAssistant(page);
  await composer(page).fill("Bu oy kassaga qancha tushdi?");
  await page.getByRole("button", { name: "Yuborish", exact: true }).click();
  const cap = page.getByRole("status").filter({ hasText: "Bugungi AI chegarasi tugadi" });
  await expect(cap).toBeVisible();
  await expect(cap).toContainText("Yordamchi bugungi xavfsizlik chegarasiga yetdi. Yangi savol ertaga, 00:00 dan (Toshkent vaqti).");
  await expect(cap).toContainText("Kunlik chegara serverda o'rnatilgan — uni oshirib bo'lmaydi.");
  // Maslahatchi backend'i yo'q — «Ogohlantirishlar ochiq» yo'q; summa va «Sarfni ko'rish» — backend yo'q.
  await expect(cap).not.toContainText("Ogohlantirishlar ochiq");
  await expect(cap).not.toContainText("so'm");
  await expect(page.getByRole("link", { name: /Sarfni ko'rish/ })).toHaveCount(0);
  await expect(page.locator("[data-shell-slot=content]").getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("Javob berilmadi: bugungi AI chegarasi tugagan. Ertaga, 00:00 dan qayta so'rashingiz mumkin.")).toBeVisible();
  await expect(composer(page)).toBeDisabled();
  await expect(composer(page)).toHaveAttribute("placeholder", "Yangi savol ertaga, 00:00 dan");
  // Savol limiti tugamagan — yon ustunda «Qolgan: 62 ta savol».
  await expect(page.getByRole("complementary").getByText("Limit har kuni 00:00 da (Toshkent vaqti) yangilanadi. Qolgan: 62 ta savol.")).toBeVisible();

  await page.getByRole("button", { name: "Yangi suhbat" }).first().click();
  await expect(page.getByRole("heading", { name: "Moliya bo'yicha savol bering" })).toBeVisible();
  await expect(cap).toBeVisible();
  await expect(composer(page)).toHaveAttribute("placeholder", "Yangi savol ertaga, 00:00 dan");
});

test("kunlik AI chegarasi, maslahatchi backend'i bor — «Ogohlantirishlar ochiq; ogohlantirish qoidalari ishlayveradi.»", async ({ page }) => {
  await mockAiAssistantApi(page, { mode: "cap", conversations: "none", advisor: "on" });
  await openAiAssistant(page);
  await expect(page.getByRole("tab", { name: /Ogohlantirishlar/ })).toBeVisible();
  await composer(page).fill("Bu oy kassaga qancha tushdi?");
  await page.getByRole("button", { name: "Yuborish", exact: true }).click();
  const cap = page.getByRole("status").filter({ hasText: "Bugungi AI chegarasi tugadi" });
  await expect(cap).toContainText(
    "Yordamchi bugungi xavfsizlik chegarasiga yetdi. Yangi savol ertaga, 00:00 dan (Toshkent vaqti). Ogohlantirishlar ochiq; ogohlantirish qoidalari ishlayveradi.",
  );
});

test("suhbat topilmadi (404) → «Yangi suhbat»", async ({ page }) => {
  await mockAiAssistantApi(page);
  await openAiAssistant(page, "/ai-assistant?conversation=999");
  await expect(page.getByText("Suhbat topilmadi", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Yangi suhbat" }).last().click();
  await expect(page).toHaveURL(/\/ai-assistant$/);
  await expect(page.getByRole("heading", { name: "Moliya bo'yicha savol bering" })).toBeVisible();
});

test("⭐ ruxsatli admin: menyuda «AI yordamchi», suhbat ochiladi; «Kirish huquqi» va maslahatchi zondi yo'q", async ({ page }) => {
  const { advisor, leaked } = await mockAiAssistantApi(page, { role: "admin" });
  await page.goto("/");
  const link = page.getByRole("link", { name: "AI yordamchi" });
  await expect(link).toBeVisible({ timeout: 60_000 });
  await link.click();
  await expect(page.getByRole("heading", { level: 1, name: "AI moliyaviy yordamchi" })).toBeVisible();
  await expect(composer(page)).toBeEnabled();
  await expect(page.getByRole("button", { name: "Kirish huquqi" })).toHaveCount(0);
  expect(advisorCalls(advisor, "ai/advisor/overview")).toHaveLength(0);
  expect(leaked).toEqual([]);
});

test("ruxsatsiz admin: menyuda «AI yordamchi» yo'q, URL'da «ruxsat berilmagan»", async ({ page }) => {
  await mockAiAssistantApi(page, { role: "admin", adminAccess: "denied" });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Balans" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("link", { name: "AI yordamchi" })).toHaveCount(0);
  await page.goto("/ai-assistant");
  await expect(page.getByText("Sizga AI yordamchidan foydalanish ruxsati berilmagan")).toBeVisible({ timeout: 60_000 });
});

test("⭐ superadmin «Kirish huquqi»: adminga ruxsat va limit — faqat o'zgargan qatorlar PATCH", async ({ page }) => {
  const { state, leaked } = await mockAiAssistantApi(page);
  await openAiAssistant(page);
  await page.getByRole("button", { name: "Kirish huquqi" }).click();
  const dialog = page.getByRole("dialog", { name: "AI yordamchiga kirish huquqi" });
  await expect(dialog.getByText("Ruxsat berilgan: 2 / 3")).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByText("Doim kiradi", { exact: true })).toBeVisible();

  await dialog.getByRole("switch", { name: "Kamola Yusupova" }).click();
  await dialog.getByRole("switch", { name: "Bekzod Aliyev" }).click();
  await expect(dialog.getByText("Ruxsat berilgan: 2 / 3")).toBeVisible();
  await dialog.getByRole("button", { name: "Saqlash" }).click();

  await expect(dialog).toHaveCount(0);
  // Toast matni ko'rinadigan xabarda va ekran o'quvchi uchun jonli hududda — birinchisi.
  await expect(page.getByText("Ruxsatlar saqlandi").first()).toBeVisible();
  expect(state.accessPatches).toEqual([
    { user_id: "12", enabled: false, daily_limit: null },
    { user_id: "13", enabled: true, daily_limit: null },
  ]);
  expect(leaked).toEqual([]);
});
