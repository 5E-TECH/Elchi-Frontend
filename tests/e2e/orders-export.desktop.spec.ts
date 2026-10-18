import { readFileSync } from "node:fs";
import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Buyurtmalar → «Excelga yuklash» (xWsCAA5N) — 1440px. Kontrakt: FRONTEND_CHANGELOG 2026-10-15
 * (`GET /orders/export/excel`: `/orders` filtrlari, bitta so'rov, .xlsx, `X-Export-*` sarlavhalari CORS'da ochiq).
 * Soxta backend, serverga so'rov ketmaydi.
 */
const ORIGIN = "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const json = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

/** Zip imzosi (`PK\x03\x04`) — haqiqiy .xlsx fayl boshi; e2e da tarkib emas, baytlar o'zgarmasligi tekshiriladi. */
const XLSX_BYTES = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00, 0x08, 0x00]);

const order = (id: number) => ({
  id: String(id),
  status: "sold",
  total_price: 150000,
  createdAt: "2026-10-16T08:00:00.000Z",
  customer: { name: `Mijoz ${id}`, phone_number: "+998901234567" },
  market: { id: "7", name: "Baraka Shop" },
  district: { id: "5", name: "Chilonzor", region: { id: "1", name: "Toshkent" } },
  courier: { id: "26", name: "Jasur Tursunov", phone_number: "+998901112233" },
  items: [],
});

type ExportMode = "ok" | "network" | "forbidden";

const mockOrdersApi = async (page: Page, exportHeaders: Record<string, string>, mode: ExportMode = "ok") => {
  const exportRequests: URLSearchParams[] = [];
  const listRequests: URLSearchParams[] = [];
  const leaked: string[] = [];
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return json(route, { statusCode: 200, data: { id: "1", role: "superadmin", name: "Bosh admin", status: "active" } });
    }
    if (path === "orders/export/excel") {
      exportRequests.push(url.searchParams);
      if (mode === "network") return route.abort("internetdisconnected");
      if (mode === "forbidden") {
        return route.fulfill({
          status: 403,
          headers: { ...cors, "content-type": "application/json" },
          body: JSON.stringify({ statusCode: 403, message: "Bu filial buyurtmalarini eksport qilishga ruxsat yo'q" }),
        });
      }
      return route.fulfill({
        status: 200,
        headers: {
          ...cors,
          "access-control-expose-headers": "Content-Disposition, X-Export-Total, X-Export-Limit, X-Export-Truncated",
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": 'attachment; filename="barcha_buyurtmalar_2026-10-17.xlsx"',
          ...exportHeaders,
        },
        body: XLSX_BYTES,
      });
    }
    if (path === "orders") {
      listRequests.push(url.searchParams);
      const items = [order(1001), order(1002), order(1003)];
      return json(route, { statusCode: 200, data: items, total: items.length, page: 1, limit: 10 });
    }
    if (request.method() !== "GET") leaked.push(`${request.method()} ${path}`);
    return json(route, { statusCode: 200, data: [] });
  });
  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
  return { exportRequests, listRequests, leaked };
};

const openOrders = async (page: Page, query = "") => {
  await page.goto(`/orders${query}`);
  await expect(page.getByRole("button", { name: "Excelga yuklash" })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("Mijoz 1001").first()).toBeVisible({ timeout: 60_000 });
};

test.describe("Buyurtmalar — Excel eksporti, 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });

  test("⭐ TC3+TC4: bitta so'rov (filtrlar bilan, sahifasiz), .xlsx server baytlari o'zgarmasdan, «Excelga saqlandi»", async ({ page }) => {
    const { exportRequests, listRequests, leaked } = await mockOrdersApi(page, {
      "x-export-total": "3",
      "x-export-limit": "50000",
      "x-export-truncated": "false",
    });
    await openOrders(page, "?orderSearch=Mijoz&where_deliver=address");
    const listBefore = listRequests.length;

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Excelga yuklash" }).click();
    const file = await download;

    expect(file.suggestedFilename()).toBe("barcha_buyurtmalar_2026-10-17.xlsx");
    expect(readFileSync((await file.path())!)).toEqual(XLSX_BYTES);
    expect(exportRequests).toHaveLength(1);
    expect(exportRequests[0].get("search")).toBe("Mijoz");
    expect(exportRequests[0].get("where_deliver")).toBe("address");
    expect(exportRequests[0].has("page")).toBe(false);
    expect(exportRequests[0].has("limit")).toBe(false);
    // Eski 100 talik sikl yo'q: eksport uchun `GET /orders?page=N` ketmaydi.
    expect(listRequests.length).toBe(listBefore);

    const toasts = page.getByRole("region", { name: "Bildirishnomalar" });
    await expect(toasts.getByText("Excelga saqlandi", { exact: true })).toBeVisible();
    await expect(toasts.getByText("3 ta buyurtma Excelga saqlandi.")).toBeVisible();
    expect(leaked).toEqual([]);
  });

  test("⭐ TC2: chegaradan oshsa — fayl saqlanadi va «Fayl to'liq emas» ogohlantirishi", async ({ page }) => {
    const { exportRequests } = await mockOrdersApi(page, {
      "x-export-total": "61234",
      "x-export-limit": "50000",
      "x-export-truncated": "true",
    });
    await openOrders(page);

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Excelga yuklash" }).click();
    await download;

    expect(exportRequests).toHaveLength(1);
    const toasts = page.getByRole("region", { name: "Bildirishnomalar" });
    await expect(toasts.getByText("Fayl to'liq emas", { exact: true })).toBeVisible();
    await expect(toasts.getByText("Faylda 50 000 ta, jami 61 234 ta buyurtma — filtrni toraytiring.")).toBeVisible();
    await expect(toasts.getByText("Excelga saqlandi", { exact: true })).toHaveCount(0);
  });

  test("javob kelmasa (internet uzildi) — bitta global «Internet aloqasi yo'q», eksport xabari takrorlanmaydi", async ({ page }) => {
    const { exportRequests } = await mockOrdersApi(page, {}, "network");
    await openOrders(page);

    const button = page.getByRole("button", { name: "Excelga yuklash" });
    await button.click();

    const toasts = page.getByRole("region", { name: "Bildirishnomalar" });
    await expect(toasts.getByText("Internet aloqasi yo'q", { exact: true })).toHaveCount(1);
    await expect(toasts.getByText("Excel fayl yuklanmadi", { exact: true })).toHaveCount(0);
    await expect(button).not.toHaveAttribute("aria-busy", "true");
    expect(exportRequests).toHaveLength(1);
  });

  test("403 — backend sababi (blob ichidagi JSON) va «Qayta urinish»", async ({ page }) => {
    const { exportRequests } = await mockOrdersApi(page, {}, "forbidden");
    await openOrders(page);

    await page.getByRole("button", { name: "Excelga yuklash" }).click();

    const toasts = page.getByRole("region", { name: "Bildirishnomalar" });
    await expect(toasts.getByText("Excel fayl yuklanmadi", { exact: true })).toBeVisible();
    await expect(toasts.getByText("Bu filial buyurtmalarini eksport qilishga ruxsat yo'q", { exact: true })).toBeVisible();
    await toasts.getByRole("button", { name: "Qayta urinish" }).click();
    await expect.poll(() => exportRequests.length).toBe(2);
  });
});
