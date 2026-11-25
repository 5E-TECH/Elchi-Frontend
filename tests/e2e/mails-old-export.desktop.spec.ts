import { readFileSync } from "node:fs";
import { expect, test, type Route } from "@playwright/test";

/**
 * Eski pochtalar: jadvalda kuryer (TC2) va Excel «Kuryer» ustuni (TC3) — 4YZcTTDQ, 1440px.
 * Bahodir, 2026-11-04: superadmin jadvalida «Kuryer» o'rnida «Filial» (pochta `branch_id` nomi) — TC2 shunga
 * almashgan; Excel «Kuryer» ustuni (TC3) o'zgarmagan.
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

/** `POST export/old-mails.xlsx` tanasi (2026-11-25: fayl serverda yasaladi). */
type ExportPayload = {
  title: string;
  labels: Record<string, string>;
  rows: { id: string; courier: string | null }[];
};

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

  test("⭐ TC2+TC3 + F4: server sahifalash, Excel'da barcha 150 qator, «Kuryer» ustuni to'la; kuryersiz pochta bo'sh", async ({ page }) => {
    const leaked: string[] = [];
    const postQueries: Record<string, string>[] = [];
    const exports: ExportPayload[] = [];
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
      if (path === "branches") {
        return reply(route, { statusCode: 200, data: { items: [{ id: "1", name: "HQ Toshkent", type: "HQ" }], total: 1 } });
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
            // tveJKICY: filtr bo'yicha yig'indilar — barcha sahifalar (150 × 3 buyurtma, 150 × 650 000 so'm).
            orders_total: ALL_POSTS.reduce((sum, item) => sum + item.order_quantity, 0),
            amount_total: ALL_POSTS.reduce((sum, item) => sum + item.post_total_price, 0),
          },
        });
      }
      if (path === "export/old-mails.xlsx") {
        exports.push(request.postDataJSON() as ExportPayload);
        return route.fulfill({
          status: 200,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          headers: {
            ...cors,
            "access-control-expose-headers": "Content-Disposition",
            "content-disposition": 'attachment; filename="old-mails-2026-11-25.xlsx"',
          },
          body: "xlsx",
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
    // TC2 (2026-11-04 dan): jadvalda «Kuryer» o'rnida «Filial» — pochta filiali nomi (kuryerli pochtada ham).
    const table = page.getByRole("table", { name: "Eski pochtalar" });
    await expect(table).toBeVisible({ timeout: 60_000 });
    await expect(table.getByRole("link", { name: "№90", exact: true })).toBeVisible();
    const headers = await table.getByRole("columnheader").allInnerTexts();
    expect(headers.map((text) => text.trim().toLowerCase())).not.toContain("kuryer");
    const branchColumn = headers.findIndex((text) => text.trim().toLowerCase() === "filial");
    expect(branchColumn, "jadvalda «Filial» ustuni").toBeGreaterThan(-1);
    const branchCell = (id: string) =>
      table
        .getByRole("row")
        .filter({ has: page.getByRole("link", { name: `№${id}`, exact: true }) })
        .getByRole("cell")
        .nth(branchColumn);
    await expect(branchCell("90")).toHaveText("HQ Toshkent");
    await expect(branchCell("91")).toHaveText("HQ Toshkent");
    // F4: sahifalash server `total` i bo'yicha — birinchi so'rov 8 ta qator, `has_orders=true`.
    await expect(page.getByText("1–8 / 150 ta pochta")).toBeVisible();
    // Ega qarori 2026-11-10: «N ta pochta · M ta buyurtma · jami S» xulosasi yo'q (server yig'indilari kelsa ham).
    await expect(page.getByText(/ta buyurtma · jami|450 ta buyurtma|97\s500\s000/)).toHaveCount(0);
    await expect(table.getByRole("link", { name: /^№\d+$/ })).toHaveCount(8);
    expect(postQueries[0]).toMatchObject({ page: "1", limit: "8", has_orders: "true" });

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Excelga yuklash", exact: true }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("old-mails-2026-11-25.xlsx");
    expect(readFileSync((await file.path())!, "utf8"), "fayl — server javobi").toBe("xlsx");

    // Serverga ketgan qatorlar: barcha filtrlangan pochtalar (joriy sahifa emas), kuryer nomi bilan.
    expect(exports).toHaveLength(1);
    const [payload] = exports;
    expect(payload).toMatchObject({ title: "Eski pochtalar hisoboti", capped: false, hide_courier: false });
    expect(payload.labels).toMatchObject({ courier: "Kuryer" });
    expect(payload.rows).toHaveLength(150);
    const byId = new Map(payload.rows.map((row) => [row.id, row.courier]));
    expect(byId.get("90")).toBe("Buxaro Courier");
    expect(byId.get("91"), "kuryersiz pochta — server «Biriktirilmagan» deb yozadi").toBeNull();
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
