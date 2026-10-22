import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Elchi Pochta №1 — «Asosiy kassa»: xarajat kategoriyalari. Soxta gateway backend kabi QAT'IY:
 *
 * - `GET finance/cashbox/expense-categories` — faol kategoriyalar (`sort_order`, `id`); `include_deleted` faqat
 *   superadminga;
 * - `POST` / `PATCH :id` / `DELETE :id` — faqat superadmin (aks holda 403); nom 1–100, takror (katta-kichik harfsiz)
 *   — 409 «"<nom>" nomli kategoriya allaqachon bor», topilmadi — 404, bo'sh PATCH — 400; o'chirish yumshoq;
 * - `PATCH finance/cashbox/spend` — DTO `forbidNonWhitelisted` (`amount, type, comment, card_id,
 *   expense_category_id`), `Idempotency-Key` majburiy, faol bo'lmagan kategoriya — 400; tarix qatoriga
 *   `expense_category_id` + `expense_category_name` (nom nusxasi);
 * - `PATCH finance/cashbox/fill` — `expense_category_id` bo'lsa 400 `property expense_category_id should not exist`.
 *
 * Boshqa yozish so'rovlari taqiqlangan (`leaked`).
 */

type Category = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_deleted: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type HistoryRow = Record<string, unknown> & { id: string };

const SEED: Array<[string, string]> = [
  ["Ovqatlanish", "Xodimlarning ovqati, tushlik"],
  ["Yoqilg'i", "Benzin, gaz, dizel"],
  ["Avtomobil xarajatlari", "Ta'mirlash, moy almashtirish, ehtiyot qismlar"],
  ["Ijara (arenda)", "Filial, ombor, ofis ijarasi"],
  ["Kommunal to'lovlar", "Elektr, suv, gaz, chiqindi"],
  ["Internet va aloqa", "Internet, telefon, SIM-karta"],
  ["Xodimlar oyligi", "Oylik, avans, bonus"],
  ["Yetkazib berish", "Tashqi transport, yuk tashish xizmati"],
  ["Qadoqlash materiallari", "Paket, skotch, quti, yorliq"],
  ["Ofis xarajatlari", "Qog'oz, ruchka, printer, kanselyariya"],
  ["Ta'mirlash", "Filial, ombor va ofis jihozlarini ta'mirlash"],
  ["Texnika va jihozlar", "Kompyuter, printer, skaner, mebel"],
  ["Reklama va marketing", "Telegram, Instagram reklamasi, banner"],
  ["Xizmat xarajatlari", "Bank komissiyasi, dastur obunalari"],
  ["Soliq va majburiy to'lovlar", "Soliq, davlat bojlari"],
  ["Tozalik va xo'jalik", "Tozalash vositalari, xo'jalik buyumlari"],
  ["Qaytarilgan pullar", "Mijozga pul qaytarish"],
];

const SPEND_FIELDS = new Set(["amount", "type", "comment", "card_id", "expense_category_id"]);
const FILL_FIELDS = new Set(["amount", "type", "comment", "card_id"]);

const appOrigin = () => new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4173").origin;
const wrap = (data: unknown, statusCode = 200, message = "ok") => ({ statusCode, message, data });

/** Bugungi, lekin o'tgan vaqt (yarim tundan keyin ham «Bugun» bo'lib qoladi). */
const today = (minutesAgo: number) => {
  const now = Date.now();
  const midnight = new Date(now).setHours(0, 0, 0, 0);
  return new Date(Math.max(now - minutesAgo * 60_000, midnight + (60 - minutesAgo))).toISOString();
};

export const mockCashboxCategoriesApi = async (
  page: Page,
  { role = "superadmin", theme }: { role?: string; theme?: "light" | "dark" } = {},
) => {
  const origin = appOrigin();
  const cors = {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  };
  const reply = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
  const error = (route: Route, status: number, message: string | string[]) =>
    reply(route, { statusCode: status, message, error: status === 409 ? "Conflict" : "Bad Request" }, status);

  const stamp = "2026-10-21T08:00:00.000Z";
  const state = {
    categories: SEED.map(([name, description], index): Category => ({
      id: String(index + 1),
      name,
      description,
      sort_order: index + 1,
      is_deleted: false,
      created_by: null,
      updated_by: null,
      created_at: stamp,
      updated_at: stamp,
    })),
    balance: { cash: 18_240_000, card: 6_375_000 },
    history: [
      {
        id: "740",
        amount: 450_000,
        balance_after: 24_615_000,
        operation_type: "expense",
        source_type: "manual_expense",
        cashbox_type: "main",
        cashbox_id: "1",
        payment_method: "cash",
        comment: "Toshkent — Samarqand, benzin",
        expense_category_id: "2",
        expense_category_name: "Yoqilg'i",
        created_by: "1",
        created_by_user: { id: "1", name: "Shodiyor Ergashev", role: "superadmin" },
        createdAt: today(40),
      },
      {
        id: "739",
        amount: 1_850_000,
        balance_after: 25_065_000,
        operation_type: "income",
        source_type: "courier_payment",
        cashbox_type: "main",
        cashbox_id: "1",
        payment_method: "cash",
        created_by: "1",
        created_by_user: { id: "1", name: "Shodiyor Ergashev", role: "superadmin" },
        source_user: { id: "9", name: "Jasur Tursunov", role: "courier" },
        createdAt: today(90),
      },
    ] as HistoryRow[],
  };
  const calls = {
    spends: [] as Array<{ body: Record<string, unknown>; key?: string; status: number }>,
    fills: [] as Array<{ body: Record<string, unknown>; key?: string; status: number }>,
    creates: [] as Array<Record<string, unknown>>,
    updates: [] as Array<{ id: string; body: Record<string, unknown> }>,
    deletes: [] as string[],
  };
  const leaked: string[] = [];

  const active = () =>
    state.categories
      .filter((category) => !category.is_deleted)
      .sort((a, b) => a.sort_order - b.sort_order || Number(a.id) - Number(b.id));
  const duplicate = (name: string, exceptId?: string) =>
    active().some((category) => category.id !== exceptId && category.name.toLowerCase() === name.toLowerCase());
  const normalizeName = (value: unknown) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");

  const manualOperation = (
    kind: "spend" | "fill",
    body: Record<string, unknown>,
    category: Category | null,
  ): HistoryRow => {
    const amount = Number(body.amount);
    const method = body.type === "click" ? "click" : "cash";
    const delta = kind === "spend" ? -amount : amount;
    if (method === "click") state.balance.card += delta;
    else state.balance.cash += delta;
    const row: HistoryRow = {
      id: String(800 + calls.spends.length + calls.fills.length),
      amount,
      balance_after: state.balance.cash + state.balance.card,
      operation_type: kind === "spend" ? "expense" : "income",
      source_type: kind === "spend" ? "manual_expense" : "manual_income",
      cashbox_type: "main",
      cashbox_id: "1",
      payment_method: method,
      comment: body.comment ?? null,
      expense_category_id: category?.id ?? null,
      expense_category_name: category?.name ?? null,
      created_by: "1",
      created_by_user: { id: "1", name: "Shodiyor Ergashev", role },
      createdAt: new Date().toISOString(),
    };
    state.history = [row, ...state.history];
    return row;
  };

  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    const method = request.method();

    if (path === "auth/my-profile") {
      // Mavzu — profil sozlamasidan (kirgandan keyin u localStorage'dan ustun).
      const settings = theme ? { settings: { appearance: { theme, themeChosen: true } } } : {};
      return reply(route, wrap({ id: "1", role, name: "Shodiyor Ergashev", status: "active", ...settings }));
    }
    if (path === "notifications/inbox/unread-count") return reply(route, wrap({ unread: 0 }));
    if (path === "finance/shift/current") {
      return reply(
        route,
        wrap({
          shift: { id: "12", opened_by: "1", status: "open", opened_at: today(300) },
          required: true,
          cashbox_user_id: "0",
        }),
      );
    }
    if (path === "finance/cashbox/main") {
      return reply(
        route,
        wrap({
          cashbox: {
            id: "1",
            cashbox_type: "main",
            balance: state.balance.cash + state.balance.card,
            balance_cash: state.balance.cash,
            balance_card: state.balance.card,
          },
          cashboxHistory: state.history,
        }),
      );
    }
    if (path === "finance/history" && method === "GET") {
      return reply(route, wrap({ items: state.history, total: state.history.length }));
    }
    const historyMatch = path.match(/^finance\/history\/(\d+)$/);
    if (historyMatch && method === "GET") {
      const row = state.history.find((item) => item.id === historyMatch[1]);
      return row ? reply(route, wrap(row)) : error(route, 404, "Tarix yozuvi topilmadi");
    }

    // ── Xarajat kategoriyalari ──
    if (path === "finance/cashbox/expense-categories") {
      if (method === "GET") {
        const includeDeleted = role === "superadmin" && url.searchParams.get("include_deleted") === "true";
        const deleted = includeDeleted ? state.categories.filter((category) => category.is_deleted) : [];
        return reply(route, wrap({ items: [...active(), ...deleted] }, 200, "Xarajat kategoriyalari"));
      }
      if (method === "POST") {
        if (role !== "superadmin") return error(route, 403, "Forbidden resource");
        const body = request.postDataJSON() as Record<string, unknown>;
        calls.creates.push(body);
        const name = normalizeName(body.name);
        if (!name || name.length > 100) return error(route, 400, "Kategoriya nomi majburiy");
        if (duplicate(name)) return error(route, 409, `"${name}" nomli kategoriya allaqachon bor`);
        const maxOrder = Math.max(0, ...active().map((category) => category.sort_order));
        const category: Category = {
          id: String(Math.max(...state.categories.map((item) => Number(item.id))) + 1),
          name,
          description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
          sort_order: typeof body.sort_order === "number" ? body.sort_order : maxOrder + 1,
          is_deleted: false,
          created_by: "1",
          updated_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        state.categories.push(category);
        return reply(route, wrap({ category }, 201, "Kategoriya qo'shildi"), 201);
      }
    }
    const categoryMatch = path.match(/^finance\/cashbox\/expense-categories\/(\d+)$/);
    if (categoryMatch && (method === "PATCH" || method === "DELETE")) {
      if (role !== "superadmin") return error(route, 403, "Forbidden resource");
      const id = categoryMatch[1];
      const category = state.categories.find((item) => item.id === id && !item.is_deleted);
      if (method === "DELETE") {
        calls.deletes.push(id);
        if (!category) return error(route, 404, "Kategoriya topilmadi");
        category.is_deleted = true;
        return reply(route, wrap({ category }, 200, "Kategoriya o'chirildi"));
      }
      const body = request.postDataJSON() as Record<string, unknown>;
      calls.updates.push({ id, body });
      if (!category) return error(route, 404, "Kategoriya topilmadi");
      if (!Object.keys(body).length) return error(route, 400, "O'zgartirish uchun name, description yoki sort_order bering");
      if (body.name !== undefined) {
        const name = normalizeName(body.name);
        if (!name) return error(route, 400, "Kategoriya nomi majburiy");
        if (duplicate(name, id)) return error(route, 409, `"${name}" nomli kategoriya allaqachon bor`);
        category.name = name;
      }
      if (body.description !== undefined) {
        category.description =
          typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
      }
      if (typeof body.sort_order === "number") category.sort_order = body.sort_order;
      category.updated_at = new Date().toISOString();
      return reply(route, wrap({ category }, 200, "Kategoriya yangilandi"));
    }

    // ── Qo'lda kirim / chiqim ──
    if ((path === "finance/cashbox/spend" || path === "finance/cashbox/fill") && method === "PATCH") {
      const kind = path.endsWith("spend") ? "spend" : "fill";
      const body = request.postDataJSON() as Record<string, unknown>;
      const key = (await request.allHeaders())["idempotency-key"];
      const log = kind === "spend" ? calls.spends : calls.fills;
      const allowed = kind === "spend" ? SPEND_FIELDS : FILL_FIELDS;
      const extra = Object.keys(body).filter((field) => !allowed.has(field));
      if (extra.length) {
        log.push({ body, key, status: 400 });
        return error(route, 400, extra.map((field) => `property ${field} should not exist`));
      }
      if (!key) {
        log.push({ body, key, status: 400 });
        return error(route, 400, "Idempotency-Key sarlavhasi majburiy");
      }
      let category: Category | null = null;
      if (kind === "spend" && body.expense_category_id !== undefined) {
        category = active().find((item) => item.id === String(body.expense_category_id)) ?? null;
        if (!/^\d+$/.test(String(body.expense_category_id)) || !category) {
          log.push({ body, key, status: 400 });
          return error(route, 400, "Xarajat kategoriyasi topilmadi yoki o'chirilgan — ro'yxatdan faol kategoriya tanlang");
        }
      }
      log.push({ body, key, status: 200 });
      const history = manualOperation(kind, body, category);
      return reply(route, wrap({ history }, 200, kind === "spend" ? "Kassadan chiqim bajarildi" : "Kassa to'ldirildi"));
    }

    if (method !== "GET") {
      leaked.push(`${method} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, wrap({ items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }));
  });

  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });

  return { state, calls, leaked };
};

export const openMainCashbox = async (page: Page) => {
  await page.goto("/payments/main-cashbox");
  await expect(page.getByRole("heading", { level: 1, name: "Asosiy kassa" })).toBeVisible({ timeout: 60_000 });
  // Smena ochiq — tezkor amallar qulfsiz.
  await expect(page.getByRole("button", { name: /Kassadan xarajat/ })).toBeEnabled();
};

/** «Kassadan xarajat» oynasini ochib, majburiy maydonlarni to'ldiradi (kategoriya — chaqiruvchida). */
export const openSpendDialog = async (page: Page, { amount = "150000", comment = "Benzin, oktabr" } = {}) => {
  await page.getByRole("button", { name: /Kassadan xarajat/ }).click();
  const dialog = page.getByRole("dialog", { name: "Kassadan xarajat" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/^Summa/).fill(amount);
  await dialog.getByRole("radio", { name: "Naqd" }).click();
  await dialog.getByLabel(/^Izoh/).fill(comment);
  return dialog;
};

export const categoryCombobox = (page: Page) =>
  page.getByRole("dialog", { name: "Kassadan xarajat" }).getByRole("combobox", { name: /Xarajat kategoriyasi/ });

export const expectNoHorizontalOverflow = async (page: Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};
