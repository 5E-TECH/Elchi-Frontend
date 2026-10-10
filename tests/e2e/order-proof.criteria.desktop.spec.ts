import { expect, test, type Locator } from "@playwright/test";
import { mockOrderProofApi, openProofOrder, ORDER_95_KEY, proofOrder } from "./support/orderProof";

/**
 * BUYURTMA DALILLARI — qabul mezonlari, 1440px. Soxta backend.
 */
const VIDEO_KEY = "proof-1784557173690-40818f3a-6482-4bb3-b092-f85b18057d9b-yetkazish.mp4";
const REGIONAL_MANAGER = {
  id: "501",
  role: "manager",
  name: "Hududiy menejer",
  status: "active",
  branch_id: "12",
  branch: { id: "12", name: "Urganch filiali", type: "REGIONAL" },
};

// antd Modal "zoom" animatsiyasi tugagach o'lchanadi.
const settledBox = async (locator: Locator) => {
  let previous = "";
  await expect
    .poll(async () => {
      const box = await locator.boundingBox();
      const current = box ? [box.x, box.y, box.width, box.height].map(Math.round).join(",") : "";
      const settled = current !== "" && current === previous;
      previous = current;
      return settled;
    }, { intervals: [100] })
    .toBe(true);
  return (await locator.boundingBox())!;
};

test.describe("Buyurtma dalillari — qabul mezonlari (1440px)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ /orders/edit/95: \"Dalillar\" kartasida 1 ta rasm ko'rinadi va bosilganda kattalashadi", async ({ page }) => {
    const { leaked, fileCalls, unauthorizedFileCalls } = await mockOrderProofApi(page);
    await openProofOrder(page, "95");

    const card = page.getByTestId("order-proof-card");
    await expect(card).toContainText("Dalillar");
    const thumb = card.locator('[data-testid="proof-gallery"] img');
    await expect(thumb).toHaveCount(1);
    await expect.poll(() => thumb.evaluate((el) => (el as HTMLImageElement).naturalWidth > 0)).toBe(true);
    expect(await thumb.getAttribute("src")).toMatch(/^blob:/);
    const small = (await thumb.boundingBox())!;

    await card.locator("button[aria-label^='Dalilni ochish']").click();
    const big = page.getByTestId("proof-lightbox").locator("img");
    await expect(big).toBeVisible();
    await expect.poll(() => big.evaluate((el) => (el as HTMLImageElement).naturalWidth > 0)).toBe(true);
    const large = await settledBox(big);
    expect(large.width).toBeGreaterThan(small.width * 3);

    // Fayl JWT bilan, maxfiy endpointdan; ochiq files/view ishlatilmaydi.
    expect(fileCalls).toEqual([`files/${ORDER_95_KEY}/content`]);
    expect(unauthorizedFileCalls).toEqual([]);
    expect(leaked).toEqual([]);
  });

  test("⭐ proof_files null (#109) — dalil kartasi UMUMAN chiqmaydi, fayl so'ralmaydi", async ({ page }) => {
    const { leaked, fileCalls } = await mockOrderProofApi(page, {
      order: proofOrder({ id: "109", status: "on the road", post_id: "90", proof_files: null }),
    });
    await openProofOrder(page, "109");

    await expect(page.getByTestId("order-proof-card")).toHaveCount(0);
    await expect(page.getByText("Dalillar", { exact: true })).toHaveCount(0);
    expect(fileCalls).toEqual([]);
    expect(leaked).toEqual([]);
  });

  test("⭐ .mp4 kalit — <video> pleyer (img EMAS), video haqiqatan dekodlanadi", async ({ page }) => {
    const { leaked } = await mockOrderProofApi(page, { order: proofOrder({ proof_files: [VIDEO_KEY] }) });
    await openProofOrder(page, "95");

    const tile = page.getByTestId("order-proof-card").locator("button[aria-label^='Dalilni ochish']");
    await expect(tile).toHaveAttribute("data-proof-kind", "video");
    const preview = tile.locator("video");
    await expect(preview).toHaveCount(1);
    await expect(tile.locator("img")).toHaveCount(0);
    // Metadata yuklandi — buzilgan fayl emas.
    await expect.poll(() => preview.evaluate((el) => (el as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(1);

    await tile.click();
    const player = page.getByTestId("proof-lightbox").locator("video");
    await expect(player).toBeVisible();
    await expect(player).toHaveAttribute("controls", "");
    await expect(page.getByTestId("proof-lightbox").locator("img")).toHaveCount(0);
    await expect.poll(() => player.evaluate((el) => (el as HTMLVideoElement).videoWidth)).toBe(32);
    expect(leaked).toEqual([]);
  });

  test("⭐ market sell_any — detal SellModal'da dalil maydoni yonida * va dalilsiz tugma bloklangan", async ({ page }) => {
    const { leaked } = await mockOrderProofApi(page, {
      profile: REGIONAL_MANAGER,
      order: proofOrder({
        id: "102",
        status: "waiting",
        post_id: "90",
        holder_type: "BRANCH",
        holder_branch_id: "12",
        proof_files: null,
        market: { id: "m1", name: "Zamon Market", expense_proof_conditions: ["sell_any"] },
      }),
    });
    await openProofOrder(page, "102");
    await page.locator("button").filter({ hasText: /^Sotish$/ }).first().click();

    const label = page.locator("p").filter({ hasText: /^Rasm yoki video\*?$/ });
    await expect(label).toHaveCount(1);
    await expect(label.locator("span.text-red-400")).toHaveText("*");

    const submit = page.locator("button").filter({ hasText: "Sotishda rasm yoki video majburiy" });
    await expect(submit).toBeDisabled();

    // Dalil biriktirilgach tugma ochiladi (so'rov yuborilmaydi).
    await page.locator('input[type="file"][accept="image/*,video/*"]').setInputFiles({
      name: "dalil.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgo=", "base64"),
    });
    await expect(page.locator("button").filter({ hasText: /^Sotish$/ }).last()).toBeEnabled();
    expect(leaked).toEqual([]);
  });

  test.describe("backend holatlari", () => {
    test("content endpoint hali yo'q, MinIO ochiq — imzolangan URL bilan rasm ko'rinadi", async ({ page }) => {
      const { leaked, fileCalls } = await mockOrderProofApi(page, { backend: "signed" });
      await openProofOrder(page, "95");
      const thumb = page.getByTestId("order-proof-card").locator('[data-testid="proof-gallery"] img');
      await expect.poll(() => thumb.evaluate((el) => (el as HTMLImageElement).naturalWidth > 0)).toBe(true);
      expect(fileCalls).toEqual([`files/${ORDER_95_KEY}/content`, `files/${ORDER_95_KEY}`]);
      expect(leaked).toEqual([]);
    });

    test("⭐ bugungi prod (MinIO ichki URL) — buzilgan rasm belgisi EMAS, \"Faylni ochib bo'lmadi\"", async ({ page }) => {
      const { leaked } = await mockOrderProofApi(page, { backend: "prod-today" });
      await openProofOrder(page, "95");
      const tile = page.getByTestId("order-proof-card").locator("button[aria-label^='Dalilni ochish']");
      await expect(tile).toContainText("Faylni ochib bo'lmadi");
      await expect(tile.locator("img")).toHaveCount(0);
      expect(leaked).toEqual([]);
    });
  });
});
