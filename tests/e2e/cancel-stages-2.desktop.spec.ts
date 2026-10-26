import { expect, test } from "@playwright/test";
import {
  MARKET,
  mockCancelStages2Api,
  ORDER_BRANCH_3D,
  ORDER_COURIER,
  ORDER_HANDED_PIN,
  ORDER_HQ_ESCALATED,
} from "./support/cancelStages2";

/**
 * BEKOR HOLATLARI — vOczoOUE 2-bosqich (BG1–BG4) va vNKGbg5q (BG7), 1440px. Maketlar `superadmin-orders-list-cancelled`
 * (bosqich chiplari, «N kun» 3 / 8 kun), `market-new-orders-cancelled(-transit|-received)` (market 3 tabi).
 */
test.describe("Bekor bosqichi, 2-bosqich — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });

  test("⭐ «Bekor qilingan» tabi: bosqich chiplari → `cancel_stage` (status yo'q); joy/kun backend `cancel_return` dan; BG7 belgilari", async ({
    page,
  }) => {
    const { leaked, listQueries } = await mockCancelStages2Api(page, {
      list: [ORDER_HQ_ESCALATED, ORDER_BRANCH_3D, ORDER_HANDED_PIN],
    });
    await page.goto(`/orders?status=${encodeURIComponent("cancelled,cancelled (sent)")}`);
    const table = page.getByRole("table");
    await expect(table.getByRole("link", { name: "№10188" })).toBeVisible({ timeout: 90_000 });

    // 8 kun (received_at; last_handover_at — 1 kun): sariq + ikonka, «Eskalatsiya», «Marketga eslatildi (sana)».
    const hqRow = table.getByRole("row").filter({ has: page.getByRole("link", { name: "№10188" }) });
    await expect(hqRow.getByText("Bekor · HQ'da")).toBeVisible();
    await expect(hqRow.getByTestId("cancel-return-place")).toHaveText("Toshkent HQ · 8 kun");
    await expect(hqRow.getByTestId("cancel-return-age")).toHaveAttribute("data-level", "alert");
    await expect(hqRow.getByTestId("cancel-return-age")).toHaveClass(/text-warning-fg/);
    await expect(hqRow.getByTestId("cancel-return-escalated")).toHaveText("Eskalatsiya");
    await expect(hqRow.getByTestId("cancel-return-notified")).toHaveText(/^Marketga eslatildi \(\d\d\.\d\d\.\d{4}\)$/);

    const branchRow = table.getByRole("row").filter({ has: page.getByRole("link", { name: "№10214" }) });
    await expect(branchRow.getByTestId("cancel-return-place")).toHaveText("Farg'ona filiali · 3 kun");
    await expect(branchRow.getByTestId("cancel-return-age")).toHaveAttribute("data-level", "warn");
    await expect(branchRow.getByTestId("cancel-return-escalated")).toHaveCount(0);

    // «Marketga topshirildi» — ro'yxatda vaqt va usul.
    const handedRow = table.getByRole("row").filter({ has: page.getByRole("link", { name: "№10179" }) });
    await expect(handedRow.getByTestId("cancel-return-place")).toHaveText(/^Toshkent HQ · 03\.10\.2026, \d\d:\d\d · Parol orqali$/);

    const chips = page.getByRole("group", { name: "Bekor bosqichi bo'yicha" });
    await expect(chips.getByRole("button")).toHaveText(["Barchasi", "Kuryerda", "Yo'lda", "Filialda", "HQ'da", "Topshirilgan"]);
    await expect(chips.getByRole("button", { name: "Barchasi" })).toHaveAttribute("aria-pressed", "true");

    await chips.getByRole("button", { name: "HQ'da" }).click();
    await expect(page).toHaveURL(/cancel_stage=hq/);
    await expect(table.getByRole("link", { name: "№10214" })).toHaveCount(0);
    await expect(table.getByRole("link", { name: "№10188" })).toBeVisible();
    const hqQuery = listQueries.at(-1)!;
    expect(hqQuery.get("cancel_stage")).toBe("hq");
    expect(hqQuery.getAll("status")).toEqual([]);

    // «Topshirilgan» — returned_to_market (status=cancelled bilan AND bo'lsa bo'sh qolardi).
    await chips.getByRole("button", { name: "Topshirilgan" }).click();
    await expect(table.getByRole("link", { name: "№10179" })).toBeVisible();
    await expect(table.getByRole("link", { name: "№10188" })).toHaveCount(0);
    expect(listQueries.at(-1)!.get("cancel_stage")).toBe("market");

    // Boshqa tabga o'tilsa bosqich tozalanadi.
    await page.getByRole("tab", { name: /Barchasi/ }).click();
    await expect(page).not.toHaveURL(/cancel_stage=/);
    await expect(chips).toHaveCount(0);
    expect(leaked).toEqual([]);
  });

  test("⭐ market: «Olib ketishga tayyor · Yo'lda · Olganlarim» — `stage` so'rovlari, sonlar, joy va usul", async ({ page }) => {
    const { leaked, marketQueries } = await mockCancelStages2Api(page, {
      profile: MARKET,
      marketCancelled: [ORDER_HQ_ESCALATED, ORDER_COURIER, ORDER_BRANCH_3D, ORDER_HANDED_PIN],
    });
    await page.goto("/new-orders/cancelled/201");
    const tabs = page.getByRole("group", { name: "Bekor qilinganlar bosqichi" });
    await expect(tabs.getByRole("button", { name: /Olib ketishga tayyor/ })).toHaveText("Olib ketishga tayyor1", {
      timeout: 90_000,
    });
    await expect(tabs.getByRole("button", { name: /Yo'lda/ })).toHaveText("Yo'lda2");
    await expect(tabs.getByRole("button", { name: /Olganlarim/ })).toHaveText("Olganlarim1");
    expect(marketQueries.map((query) => query.get("stage"))).toEqual(
      expect.arrayContaining([null, "courier,in_transit,branch", "market"]),
    );
    const received = marketQueries.find((query) => query.get("stage") === "market")!;
    expect(received.get("start_day")).toMatch(/^\d{4}-\d{2}-01$/);
    expect(received.get("end_day")).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await tabs.getByRole("button", { name: /Yo'lda/ }).click();
    await expect(page).toHaveURL(/view=transit/);
    await expect(page.getByRole("heading", { name: "Yo'ldagi bekor buyurtmalar" })).toBeVisible();
    const transit = page.getByTestId("market-returns-transit").getByRole("table");
    const courierRow = transit.getByRole("row").filter({ hasText: "Dilnoza Karimova" });
    await expect(courierRow.getByText("Bekor · kuryerda")).toBeVisible();
    await expect(courierRow.getByTestId("cancel-return-place")).toHaveText("Akmal Rahimov");
    const branchRow = transit.getByRole("row").filter({ hasText: "Nodir Karimov" });
    await expect(branchRow.getByTestId("cancel-return-place")).toHaveText("Farg'ona filiali · 3 kun");
    // Market tomonida BG7 belgilari yo'q.
    await expect(page.getByTestId("cancel-return-escalated")).toHaveCount(0);

    await tabs.getByRole("button", { name: /Olganlarim/ }).click();
    await expect(page.getByRole("heading", { name: "Olgan bekor buyurtmalaringiz" })).toBeVisible();
    const handed = page.getByTestId("market-returns-received").getByRole("table").getByRole("row").filter({ hasText: "Odil Ismoilov" });
    await expect(handed).toContainText("03.10.2026");
    await expect(handed).toContainText("Toshkent HQ");
    await expect(handed).toContainText("Parol orqali");

    await tabs.getByRole("button", { name: /Olib ketishga tayyor/ }).click();
    await expect(page.getByRole("button", { name: "Qabul qilish" })).toBeVisible();
    expect(leaked).toEqual([]);
  });
});
