import { readFileSync } from "node:fs";
import { expect, test, type Route } from "@playwright/test";

/**
 * Eski pochtalar: jadvalda kuryer (TC2) va Excel «Kuryer» ustuni (TC3) — 4YZcTTDQ, 1440px.
 * Backend endi `GET /post` qatorida `courier: { id, name, phone_number }` beradi
 * (kuryer o'chirilgan / yo'q bo'lsa `null`). Soxta backend, serverga so'rov ketmaydi.
 *
 * F4 (YfrqN70i): ro'yxat server tomonida sahifalanadi (`total` bo'yicha, `limit` ≤ 100, `has_orders=true`),
 * Excel esa BARCHA filtrlangan qatorlarni 100 talab oladi — soxta `GET /post` sahifani `page`/`limit` bo'yicha
 * kesadi (150 ta pochta → Excel uchun 2 sahifa).
 */
const ORIGIN = "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

const post = (id: string, courier: { id: string; name: string; phone_number: string } | null, region: string) => ({
  id,
  branch_id: "1",
  courier_id: courier?.id ?? null,
  courier,
  createdAt: "2026-10-15T12:33:00.000Z",
  updatedAt: "2026-10-15T12:33:00.000Z",
  isDeleted: false,
  order_quantity: 3,
  post_total_price: 650000,
  qr_code_token: `qr-${id}`,
  region: { id: "2", name: region },
  region_id: "2",
  status: "sent",
});

const BUXARO = { id: "119", name: "Buxaro Courier", phone_number: "+998901190119" };
/** 150 ta pochta (eng yangisi tepada): №90 — kuryer bilan, №91 — kuryersiz, qolganlari №1000… */
const ALL_POSTS = [
  post("90", BUXARO, "Buxoro"),
  post("91", null, "Andijon"),
  ...Array.from({ length: 148 }, (_, index) => post(String(1000 + index), BUXARO, "Buxoro")),
];

test.describe("Eski pochtalar — kuryer: karta va Excel", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ TC2+TC3 + F4: server sahifalash, Excel'da barcha 150 qator, «Kuryer» ustuni to'la; kuryersiz pochtada «-»", async ({ page }) => {
    const leaked: string[] = [];
    const postQueries: Record<string, string>[] = [];
    await page.context().route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === ORIGIN) return route.continue();
      if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      const path = url.pathname.replace(/^\//, "");
      if (path === "auth/my-profile") {
        return reply(route, { statusCode: 200, data: { id: "1", role: "superadmin", name: "Bosh admin", status: "active" } });
      }
      if (path === "post") {
        postQueries.push(Object.fromEntries(url.searchParams));
        // Backend kabi: `limit` ≤ 100 (`limit_capped`), sahifa `createdAt DESC` bo'yicha kesiladi.
        const requested = Number(url.searchParams.get("limit") ?? 8);
        const limit = Math.min(100, Math.max(1, requested));
        const pageNo = Math.max(1, Number(url.searchParams.get("page") ?? 1));
        const rows = ALL_POSTS.slice((pageNo - 1) * limit, pageNo * limit);
        return reply(route, {
          statusCode: 200,
          data: {
            data: rows,
            total: ALL_POSTS.length,
            page: pageNo,
            limit,
            totalPages: Math.max(1, Math.ceil(ALL_POSTS.length / limit)),
            limit_capped: requested > 100,
            max_limit: 100,
          },
        });
      }
      if (request.method() !== "GET") leaked.push(`${request.method()} ${path}`);
      return reply(route, { statusCode: 200, data: [] });
    });
    await page.addInitScript(() => {
      const far = Date.now() + 86_400_000;
      window.sessionStorage.setItem("accessToken", "e2e.local.token");
      window.sessionStorage.setItem(
        "authSessionMetadata",
        JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
      );
    });

    await page.goto("/mails/old");
    // TC2 (dizayn v2): jadvalning «Kuryer» ustunida kuryer nomi; kuryersiz pochtada «—».
    const table = page.getByRole("table", { name: "Eski pochtalar" });
    await expect(table).toBeVisible({ timeout: 60_000 });
    const headers = await table.getByRole("columnheader").allInnerTexts();
    const courierColumn = headers.findIndex((text) => text.trim().toLowerCase() === "kuryer");
    expect(courierColumn, "jadvalda «Kuryer» ustuni").toBeGreaterThan(-1);
    const courierCell = (id: string) =>
      table
        .getByRole("row")
        .filter({ has: page.getByRole("link", { name: `№${id}`, exact: true }) })
        .getByRole("cell")
        .nth(courierColumn);
    await expect(courierCell("90")).toHaveText("Buxaro Courier");
    await expect(courierCell("91")).toHaveText("—");
    // F4: sahifalash server `total` i bo'yicha — birinchi so'rov 8 ta qator, `has_orders=true`.
    await expect(page.getByText("1–8 / 150 ta pochta")).toBeVisible();
    await expect(table.getByRole("link", { name: /^№\d+$/ })).toHaveCount(8);
    expect(postQueries[0]).toMatchObject({ page: "1", limit: "8", has_orders: "true" });

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Excelga yuklash", exact: true }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^old-mails-\d{4}-\d{2}-\d{2}\.xls$/);
    const html = readFileSync((await file.path())!, "utf8");

    // Sarlavha qatoridagi «Kuryer» ustuni indeksi bo'yicha har qatorning qiymati.
    const rows = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) =>
      [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => c[1].replace(/<[^>]+>/g, "").trim()),
    );
    const header = rows.find((cells) => cells.includes("Kuryer"))!;
    expect(header, "sarlavhada «Kuryer» ustuni").toBeTruthy();
    const courierIndex = header.indexOf("Kuryer");
    const dataRows = rows.filter((cells) => /^\d+$/.test(cells[0] ?? "") && /^\d+$/.test(cells[1] ?? ""));
    expect(dataRows, "Excel'da barcha filtrlangan qatorlar (joriy sahifa emas)").toHaveLength(150);
    const byId = new Map(dataRows.map((cells) => [cells[1], cells[courierIndex]]));
    expect(byId.get("90")).toBe("Buxaro Courier");
    expect(byId.get("91")).toBe("-");
    // Excel: 100 talab 2 sahifa, ro'yxat filtrlari bilan; hech bir so'rov 100 dan ko'p so'ramaydi.
    const exportQueries = postQueries.filter((query) => query.limit === "100");
    expect(exportQueries.map((query) => query.page)).toEqual(["1", "2"]);
    for (const query of postQueries) {
      expect(query.has_orders).toBe("true");
      expect(Number(query.limit)).toBeLessThanOrEqual(100);
    }
    expect(leaked).toEqual([]);
  });
});
