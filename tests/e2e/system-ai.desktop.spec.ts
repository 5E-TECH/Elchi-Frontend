import { expect, test } from "@playwright/test";
import { AI_CAP, AI_CONFIG, aiCard, aiFlag, aiStatus, healthCard, mockSystemOpsApi, openSystemOps } from "./support/systemOps";

/**
 * OPS → TIZIM → «AI HOLATI» (/ops?tab=system, OS-2 — maketlar `superadmin-ops-system[-ai-cap|-ai-config|-down]`):
 * `GET ai/status` + gateway bayrog'i `GET orders/ai-availability`; dollar «12,40 $» (S4); limitni oshirish tugmasi yo'q
 * (S2); kalit yo'q / noto'g'ri — «AI o'chiq» (S3); xom backend matni chiqmaydi.
 */
test.describe("Ops → Tizim — AI holati — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ yoqilgan: Tizim holatidan keyin; kalit (qiymatsiz), 3 model, «5,82 $ / 25,00 $ · 23%», tugma yo'q", async ({ page }) => {
    const { leaked } = await mockSystemOpsApi(page);
    await openSystemOps(page);
    const card = aiCard(page);
    await expect(card.getByText("5,82 $ / 25,00 $ · 23%")).toBeVisible();
    await expect(card.getByText("Yoqilgan")).toBeVisible();
    await expect(card.getByText("Kalit qiymati hech qachon ko'rsatilmaydi")).toBeVisible();
    const tiles = card.getByRole("list", { name: "AI kaliti va modellar" }).getByRole("listitem");
    await expect(tiles).toHaveCount(4);
    await expect(tiles.nth(3)).toContainText("claude-haiku-4-5");
    await expect(card.getByRole("meter", { name: "Bugungi AI limiti: 5,82 $ sarflandi, 25,00 $ dan 23%" })).toBeVisible();
    await expect(card.getByRole("button")).toHaveCount(0);

    // Tartib (OS-1 3-band): Tizim holati → AI holati.
    await expect(healthCard(page).getByText("Hamma xizmatlar ishlayapti")).toBeVisible();
    const order = await page
      .getByRole("heading", { level: 2 })
      .evaluateAll((els) => els.map((el) => el.textContent ?? ""));
    const index = (name: string) => order.indexOf(name);
    expect(index("Tizim holati")).toBeLessThan(index("AI holati"));

    // Bir qatorda 4 karta (1440px).
    const tops = await tiles.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    expect(leaked).toEqual([]);
  });

  test("⭐ S2 limit tugadi: «Limit tugadi», danger ogohlantirish, «limit faqat serverda oshiriladi», tugma yo'q", async ({ page }) => {
    await mockSystemOpsApi(page, { ai: [AI_CAP] });
    await openSystemOps(page);
    const card = aiCard(page);
    const alert = card.getByRole("alert");
    await expect(alert).toContainText("Kunlik limit tugadi — AI ertaga 00:00 gacha o'chiq");
    await expect(alert).toContainText("Bugungi 25,00 $ to'liq sarflandi.");
    await expect(card.getByText("25,00 $ / 25,00 $ · 100%")).toBeVisible();
    await expect(
      card.getByText("AI ertaga, 00:00 da qayta yoqiladi (Toshkent vaqti) · limit faqat serverda oshiriladi"),
    ).toBeVisible();
    await expect(card.getByRole("button")).toHaveCount(0);
  });

  test("⭐ S3 kalit nomi noto'g'ri + noma'lum model: «AI o'chiq», «Noma'lum model», o'lchagich yo'q", async ({ page }) => {
    await mockSystemOpsApi(page, { ai: [AI_CONFIG] });
    await openSystemOps(page);
    const card = aiCard(page);
    await expect(card.getByText("AI o'chiq — kalit nomi noto'g'ri")).toBeVisible();
    await expect(card.getByText("AI o'chiq", { exact: true })).toBeVisible();
    await expect(card.getByText("Noma'lum model: rasmdan buyurtma ajratish")).toBeVisible();
    await expect(card.getByText("AI o'chiq — bugun sarflanmagan, limit hisoblanmaydi")).toBeVisible();
    await expect(card.getByRole("meter")).toHaveCount(0);
  });

  test("⭐ gateway bayrog'i o'chiq: «AI o'chiq — serverda o'chirib qo'yilgan»", async ({ page }) => {
    await mockSystemOpsApi(page, { aiFlag: aiFlag(false) });
    await openSystemOps(page);
    const card = aiCard(page);
    await expect(card.getByText("AI o'chiq — serverda o'chirib qo'yilgan")).toBeVisible();
    await expect(card.getByText("Yoqilgan")).toHaveCount(0);
  });

  test("⭐ ai/status 504: «AI holatini olib bo'lmadi» «(504)», xom matnsiz; «Qayta urinish» — tiklanadi", async ({ page }) => {
    const { calls } = await mockSystemOpsApi(page, {
      // 5xx bir marta qayta urinadi (`queryRetry.ts`) — ikkala urinish ham 504.
      ai: [
        { status: 504, body: { statusCode: 504, message: "AI service javob bermadi (raw)" } },
        { status: 504, body: { statusCode: 504, message: "AI service javob bermadi (raw)" } },
        aiStatus(),
      ],
    });
    await openSystemOps(page);
    const card = aiCard(page);
    const alert = card.getByRole("alert");
    await expect(alert).toContainText("AI holatini olib bo'lmadi", { timeout: 30_000 });
    await expect(alert).toContainText("AI xizmati javob bermadi (504). Tizim holatida «AI buyurtma» qatorini tekshiring.");
    await expect(card.getByText("Noma'lum")).toBeVisible();
    await expect(page.getByText("AI service javob bermadi (raw)")).toHaveCount(0);
    await alert.getByRole("button", { name: "Qayta urinish" }).click();
    await expect(card.getByText("Yoqilgan")).toBeVisible();
    expect(calls.ai).toBe(3);
  });
});
