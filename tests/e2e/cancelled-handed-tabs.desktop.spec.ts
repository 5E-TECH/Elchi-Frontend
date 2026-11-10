import { expect, test } from "@playwright/test";
import { BATCHES, openCancelledTabs } from "./support/cancelledHandedTabs";

/**
 * «Qabul va yaratish → Bekor qilinganlar»: «Kutilmoqda | Topshirilgan» (2026-11-10, ega tasdiqlagan maket) — 1440px.
 * Tablar butun enni teng ikkiga bo'ladi (52 px), «Topshirilgan» — kun bo'yicha kartalar, karta → partiya sahifasi.
 */
test.describe("Bekor qilinganlar — Kutilmoqda | Topshirilgan, 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });

  test("⭐ tablar teng, «Topshirilgan» kartalari, qidiruv serverga, karta → partiya → orqaga filtr bilan", async ({ page }) => {
    const requests = await openCancelledTabs(page);
    await page.goto("/new-orders/cancelled");

    const tabs = page.getByRole("radiogroup", { name: "Bekor qilinganlar bo'limlari" });
    const pending = tabs.getByRole("radio", { name: /Kutilmoqda/ });
    const handed = tabs.getByRole("radio", { name: /Topshirilgan/ });
    await expect(pending).toHaveText("Kutilmoqda2", { timeout: 90_000 });
    await expect(handed).toHaveText("Topshirilgan2");
    await expect(pending).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("table", { name: "Marketlar" })).toBeVisible();

    // Butun enni ikkiga: ikki variant teng va 52 px.
    const [a, b] = [await pending.boundingBox(), await handed.boundingBox()];
    expect(a!.height).toBe(52);
    expect(Math.abs(a!.width - b!.width)).toBeLessThan(1);
    const track = await tabs.boundingBox();
    expect(a!.width + b!.width).toBeGreaterThan(track!.width - 20);

    await handed.click();
    await expect(page).toHaveURL(/\/new-orders\/cancelled\?tab=handed$/);
    const card = page.getByRole("region", { name: "Marketga topshirilgan bekor qilinganlar" });
    const today = card.getByRole("region", { name: /^Bugun · / });
    const baraka = today.getByRole("link", { name: /Baraka Shop/ });
    await expect(baraka).toBeVisible();
    await expect(baraka.getByText("QR orqali")).toBeVisible();
    await expect(baraka.getByText("1 ta qo'lda")).toBeVisible();
    await expect(card.getByRole("region", { name: /^Kecha · / }).getByRole("link", { name: /Nur Market/ })).toBeVisible();
    await expect(card.getByText(/ta topshirish/).locator("xpath=..")).toHaveText(/2 ta topshirish · 10 ta buyurtma · jami/);

    // Sukut — joriy oy.
    const first = requests.handovers[0];
    expect(first.get("start_day")).toMatch(/^\d{4}-\d{2}-01$/);
    expect(first.get("limit")).toBe("24");

    // Qidiruv serverga (kechiktirib).
    await card.getByRole("searchbox", { name: "Topshirilganlarni qidirish" }).fill("nur");
    await expect(page).toHaveURL(/q=nur/);
    await expect(card.getByRole("link", { name: /Baraka Shop/ })).toHaveCount(0);
    expect(requests.handovers.at(-1)!.get("search")).toBe("nur");

    await card.getByRole("link", { name: /Nur Market/ }).click();
    await expect(page).toHaveURL(new RegExp(`/new-orders/cancelled/handovers/${BATCHES[1].id}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Nur Market" })).toBeVisible();
    await expect(page.getByText("Topshirdi: Malika Rasulova")).toBeVisible();
    await expect(page.getByRole("table", { name: "Topshirilgan buyurtmalar" }).getByRole("link", { name: "№10235" })).toHaveAttribute(
      "href",
      "/orders/edit/10235",
    );

    // «← Topshirilgan» — qidiruv saqlangan holda.
    await page.getByRole("link", { name: "Topshirilgan" }).click();
    await expect(page).toHaveURL(/tab=handed.*q=nur|q=nur.*tab=handed/);
    await expect(page.getByRole("radio", { name: /Topshirilgan/ })).toHaveAttribute("aria-checked", "true");
    expect(requests.leaked).toEqual([]);
  });

  test("noma'lum partiya — «Topshirish topilmadi»", async ({ page }) => {
    await openCancelledTabs(page);
    await page.goto("/new-orders/cancelled/handovers/1_2_3");
    await expect(page.locator("#main-content").getByText("Topshirish topilmadi")).toBeVisible({ timeout: 90_000 });
    // Sahifa xatoni o'zi aytadi — global «Ma'lumotni yuklab bo'lmadi» xabari takrorlanmaydi.
    await expect(page.getByText("Ma'lumotni yuklab bo'lmadi.")).toHaveCount(0);
    await page.getByRole("button", { name: "Topshirilganlarga qaytish" }).click();
    await expect(page).toHaveURL(/\/new-orders\/cancelled\?tab=handed$/);
  });
});
