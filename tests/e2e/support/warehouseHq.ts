import { expect, test, type Page, type Route } from "@playwright/test";
import { rawProduct, rawWarehouse } from "../../../src/test/warehouseFixtures";
import { setupShellSession } from "./shellSession";

/**
 * Markaziy ombor (Pa1KaXmj, 1-bosqich) e2e yordamchilari: superadmin «Omborlar» → «Ombor ochish» → «Markaziy ombor ·
 * Toshkent HQ» → yaratish → tafsilot → «Mahsulot qo'shish» (kirim). Soxta backend — ombor javoblari o'ramsiz (backend
 * kabi), filial javoblari gateway o'rami bilan. Yozish so'rovlari (`POST warehouses`, `POST warehouses/12/stock-in`)
 * shu yerda ushlanadi va yoziladi; boshqa har yozish `leaked` ga tushadi (`setupShellSession`).
 */

const appOrigin = () => new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4173").origin;
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

export const HQ_BRANCH = {
  id: "1",
  name: "Toshkent HQ",
  code: "HQ",
  type: "HQ",
  status: "active",
  address: "Toshkent sh., Chilonzor tumani",
  region_id: "14",
  region: { id: "14", name: "Toshkent shahri" },
};

const DESTINATIONS = [
  {
    id: "20",
    name: "Qarshi filiali",
    type: "REGIONAL",
    status: "active",
    region: { id: "9", name: "Qashqadaryo viloyati" },
    has_manager: true,
    manager: { id: "40", name: "Javlon Hamroyev" },
  },
];

const REGIONAL = rawWarehouse();
const PRODUCT = rawProduct();
const MARKET = { id: "121", name: "Baraka Shop" };

/** Ochilgan Markaziy ombor (`POST /warehouses` javobi va keyingi `GET`lar); `qty` — kirimdan keyingi qoldiq. */
const hqWarehouse = (qty: number) =>
  rawWarehouse({
    id: 12,
    name: "Markaziy ombor",
    kind: "HQ",
    branch_id: "1",
    branch: { id: "1", name: "Toshkent HQ", type: "HQ", status: "active", address: HQ_BRANCH.address },
    region: null,
    manager_user_id: null,
    manager: null,
    effective_address: HQ_BRANCH.address,
    created_at: new Date().toISOString(),
    movements_count: qty > 0 ? 1 : 0,
    summary: {
      positions: qty > 0 ? 1 : 0,
      markets: qty > 0 ? 1 : 0,
      on_hand: qty,
      reserved: 0,
      available: qty,
      reserved_orders: 0,
      low_count: 0,
      out_count: 0,
    },
    last_movement: null,
  });

export type WarehouseHqMock = {
  /** `POST /warehouses` tanalari. */
  created: unknown[];
  /** `POST /warehouses/12/stock-in` — tana va `Idempotency-Key`. */
  stockIns: { body: unknown; key: string | null }[];
  leaked: string[];
};

/**
 * `hq: "found"` — `GET /branches/hq` HQ ni qaytaradi; `"missing"` — 404 (tizimda HQ yo'q yoki eski backend: oyna
 * avvalgidek faqat viloyat filiallari bilan ishlaydi).
 */
export const mockWarehouseHqApi = async (page: Page, { hq = "found" }: { hq?: "found" | "missing" } = {}) => {
  const { leaked } = await setupShellSession(page, "superadmin", "E2E Superadmin");
  const origin = appOrigin();
  const cors = {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  };
  const reply = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
  const mock: WarehouseHqMock = { created: [], stockIns: [], leaked };
  const stocked = () => mock.stockIns.reduce((sum, call) => sum + ((call.body as { lines?: { qty: number }[] }).lines?.[0]?.qty ?? 0), 0);

  const list = () => {
    const items = mock.created.length ? [hqWarehouse(stocked()), REGIONAL] : [REGIONAL];
    const active = items.length;
    return {
      data: items,
      total: items.length,
      page: 1,
      limit: 20,
      counts: { all: active, active, paused: 0 },
      summary: { warehouses: active, active, paused: 0, positions: 12, on_hand: 486, reserved: 38, available: 448, reserved_orders: 14, low_count: 2, out_count: 1 },
    };
  };

  await page.route(/\/(warehouses|branches\/(hq|dispatch-destinations))(\/[\w-]+)*(\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    // Ilovaning o'z sahifalari (`/warehouses`, `/warehouses/12`) — Vite'ga.
    if (url.origin === origin) return route.fallback();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    const method = request.method();

    if (path === "branches/hq" && method === "GET") {
      return hq === "found" ? reply(route, wrap(HQ_BRANCH)) : reply(route, { statusCode: 404, message: "HQ filiali topilmadi" }, 404);
    }
    if (path === "branches/dispatch-destinations" && method === "GET") return reply(route, wrap(DESTINATIONS));
    if (path === "warehouses" && method === "GET") return reply(route, list());
    if (path === "warehouses" && method === "POST") {
      mock.created.push(request.postDataJSON());
      return reply(route, hqWarehouse(0), 201);
    }
    if (path === "warehouses/12" && method === "GET") return reply(route, hqWarehouse(stocked()));
    if (path === "warehouses/12/stock" && method === "GET") {
      const qty = stocked();
      return reply(route, {
        warehouse: { id: "12", name: "Markaziy ombor", status: "ACTIVE" },
        data: qty
          ? [
              {
                stock_id: "77",
                product: PRODUCT,
                market: MARKET,
                on_hand: qty,
                reserved: 0,
                available: qty,
                low_stock_threshold: null,
                threshold: 5,
                level: "ok",
                last_movement_at: new Date().toISOString(),
              },
            ]
          : [],
        total: qty ? 1 : 0,
        page: 1,
        limit: 20,
        facets: { levels: { all: qty ? 1 : 0, ok: qty ? 1 : 0, low: 0, out: 0 }, markets: qty ? [{ ...MARKET, positions: 1 }] : [] },
      });
    }
    if (path === "warehouses/12/movements" && method === "GET") return reply(route, { data: [], total: 0, page: 1, limit: 5 });
    if (path === "warehouses/12/lookup" && method === "GET") {
      const code = url.searchParams.get("code") ?? "";
      const found = code === PRODUCT.sku_code;
      return reply(route, {
        code,
        matched_by: found ? "sku_code" : null,
        data: found ? [{ product: PRODUCT, market: MARKET, stock: null }] : [],
      });
    }
    if (path === "warehouses/12/stock-in" && method === "POST") {
      const body = request.postDataJSON() as { lines: { product_id: string; qty: number }[] };
      mock.stockIns.push({ body, key: request.headers()["idempotency-key"] ?? null });
      const qty = stocked();
      return reply(route, {
        warehouse_id: "12",
        warehouse_name: "Markaziy ombor",
        replayed: false,
        positions: body.lines.length,
        total_qty: body.lines.reduce((sum, line) => sum + line.qty, 0),
        lines: body.lines.map((line) => ({
          product_id: line.product_id,
          product_name: PRODUCT.name,
          market_id: MARKET.id,
          qty: line.qty,
          on_hand: qty,
          reserved: 0,
          available: qty,
        })),
      });
    }
    return route.fallback();
  });
  return mock;
};

/** «Omborlar» → «Ombor ochish» oynasi, «Filial» ro'yxati ochiq holda. */
export const openCreateDialog = async (page: Page) => {
  await page.goto("/warehouses");
  await expect(page.getByRole("heading", { level: 1, name: "Omborlar" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Ombor ochish" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Ombor ochish" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("combobox", { name: /Filial/ }).click();
  return dialog;
};

/** HQ tanlanadi va ombor ochiladi; tafsilot sahifasiga o'tilgach sarlavha qaytariladi. */
export const createHqWarehouse = async (page: Page) => {
  const dialog = await openCreateDialog(page);
  const options = page.getByRole("option");
  await expect(options).toHaveText(["Markaziy ombor · Toshkent HQ", "Qarshi filiali · Qashqadaryo viloyati"]);
  await options.first().click();
  await expect(dialog.getByRole("textbox", { name: /Ombor nomi/ })).toHaveValue("Markaziy ombor");
  const manager = dialog.getByRole("textbox", { name: /Mas'ul xodim/ });
  await expect(manager).toHaveValue("Belgilanmaydi");
  await expect(manager).toHaveAttribute("readonly", "");
  await expect(dialog.getByText("Markaziy omborda menejer yo'q — mas'ul belgilanmaydi")).toBeVisible();
  await dialog.getByRole("button", { name: "Ombor ochish" }).click();
  await expect(page).toHaveURL(/\/warehouses\/12$/);
  const heading = page.getByRole("heading", { level: 1, name: "Markaziy ombor" });
  await expect(heading).toBeVisible();
  return heading;
};

/** Tafsilotda «Mahsulot qo'shish» → `ELC-P-000142` (USB skaner kabi: yozish + Enter) → «Qoldiqqa qo'shish». */
export const stockInOneProduct = async (page: Page) => {
  await page.getByRole("button", { name: "Mahsulot qo'shish" }).first().click();
  const stockIn = page.getByRole("dialog", { name: "Omborga mahsulot qo'shish" });
  await expect(stockIn).toBeVisible();
  const field = stockIn.getByRole("combobox", { name: /Mahsulot/ });
  await field.fill(String(PRODUCT.sku_code));
  await field.press("Enter");
  await expect(stockIn.getByRole("list", { name: "Skanerlangan mahsulotlar" }).getByText(PRODUCT.name)).toBeVisible();
  await stockIn.getByRole("button", { name: /Qoldiqqa qo'shish/ }).click();
  await expect(stockIn).toBeHidden();
  return stockIn;
};
