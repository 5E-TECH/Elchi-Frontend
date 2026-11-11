import { expect, test } from "@playwright/test";
import { composer, mockAiAssistantApi, openAiAssistant } from "./support/aiAssistant";

/**
 * F7PWp6cK / T2 — AI moliyaviy yordamchi (faqat suhbat, superadmin), desktop 1280: menyu «Moliya» → «AI yordamchi»,
 * bo'sh suhbat → savol → SSE javob (markdown jadval, «Manba», limit `done.limits` dan), URL `?conversation=`,
 * «To'xtatish», uzilish va tarixdan to'liq javob, 503 → «AI o'chiq», 429 → limit tugadi; admin — menyuda yo'q, 403.
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

test("xarajat shifti → sahifa ustida ogohlantirish, maydon o'z placeholder'i bilan o'chiq; «Yangi suhbat» dan keyin ham sabab ko'rinadi", async ({ page }) => {
  await mockAiAssistantApi(page, { mode: "cap", conversations: "none" });
  await openAiAssistant(page);
  await composer(page).fill("Bu oy kassaga qancha tushdi?");
  await page.getByRole("button", { name: "Yuborish", exact: true }).click();
  const alert = page.getByRole("alert").filter({ hasText: "AI yordamchining bugungi xarajat chegarasi tugadi" });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("Yangi savol ertaga, 00:00 dan.");
  await expect(page.getByText("Javob berilmadi: bugungi xarajat chegarasi tugagan.")).toBeVisible();
  await expect(composer(page)).toBeDisabled();
  await expect(composer(page)).toHaveAttribute("placeholder", "Xarajat chegarasi ertaga, 00:00 da yangilanadi");
  // Savol limiti tugamagan — yon ustunda «Qolgan: 62 ta savol».
  await expect(page.getByRole("complementary").getByText("Limit har kuni 00:00 da (Toshkent vaqti) yangilanadi. Qolgan: 62 ta savol.")).toBeVisible();

  await page.getByRole("button", { name: "Yangi suhbat" }).first().click();
  await expect(page.getByRole("heading", { name: "Moliya bo'yicha savol bering" })).toBeVisible();
  await expect(alert).toBeVisible();
  await expect(composer(page)).toHaveAttribute("placeholder", "Xarajat chegarasi ertaga, 00:00 da yangilanadi");
});

test("suhbat topilmadi (404) → «Yangi suhbat»", async ({ page }) => {
  await mockAiAssistantApi(page);
  await openAiAssistant(page, "/ai-assistant?conversation=999");
  await expect(page.getByText("Suhbat topilmadi", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Yangi suhbat" }).last().click();
  await expect(page).toHaveURL(/\/ai-assistant$/);
  await expect(page.getByRole("heading", { name: "Moliya bo'yicha savol bering" })).toBeVisible();
});

test("admin: menyuda «AI yordamchi» yo'q, URL — 403", async ({ page }) => {
  await mockAiAssistantApi(page, { role: "admin" });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Balans" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("link", { name: "AI yordamchi" })).toHaveCount(0);
  await page.goto("/ai-assistant");
  await expect(page.getByText("Bu sahifaga ruxsatingiz yo'q")).toBeVisible({ timeout: 60_000 });
});
