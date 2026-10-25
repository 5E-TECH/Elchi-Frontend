import { expect, type Page, type Route } from "@playwright/test";

/**
 * Balans → Tarix → "Yozuv qo'shish" (GtAoqHlk) — soxta gateway.
 *
 * `POST finance/financial-balance/entries` gateway kabi QAT'IY:
 * - DTO `forbidNonWhitelisted`: ruxsat etilgan maydonlar faqat
 *   `amount, source_type, order_id?, related_user_id?, comment?` — boshqa
 *   maydon bo'lsa 400 `property X should not exist`;
 * - `Idempotency-Key` bir xil bo'lsa yozuv QAYTA yozilmaydi.
 * Muvaffaqiyatda 201 va yozuv daftar tarixining boshiga qo'shiladi.
 */
const ORIGIN = "http://127.0.0.1:4194";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

const DTO_FIELDS = new Set(["amount", "source_type", "order_id", "related_user_id", "comment"]);
const SOURCE_TYPES = new Set(["manual_income", "manual_expense", "bills", "salary", "correction"]);

type LedgerEntry = Record<string, unknown> & { id: string; balance_after: number };

export const mockFinancialEntryApi = async (page: Page, options: { failFirstPost?: boolean } = {}) => {
  const state = {
    history: [
      {
        id: "66",
        amount: 15000,
        balance_before: 1530000,
        balance_after: 1545000,
        source_type: "sell_profit",
        comment: null,
        created_by: null,
        created_by_user: null,
        order_id: "1001",
        createdAt: "2026-10-13T09:00:00.000Z",
      },
    ] as LedgerEntry[],
  };
  const posts: Array<{ body: Record<string, unknown>; idempotencyKey: string | undefined; status: number }> = [];
  const byKey = new Map<string, LedgerEntry>();
  const leaked: string[] = [];
  let historyGets = 0;
  let balanceGets = 0;
  let failNext = Boolean(options.failFirstPost);

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
    if (path === "finance/cashbox/financial-balanse") {
      // Yuqoridagi balans kartalari: kassa = daftarning oxirgi qoldig'i (yozuvdan keyin o'zgaradi).
      balanceGets += 1;
      const balance = state.history[0].balance_after;
      return reply(route, { statusCode: 200, data: { balance, main: { balance } } });
    }
    if (path === "finance/financial-balance/history") {
      historyGets += 1;
      const items = state.history;
      return reply(route, {
        statusCode: 200,
        data: { items, total: items.length, pagination: { total: items.length, page: 1, limit: 10, totalPages: 1 } },
      });
    }
    if (path === "finance/financial-balance/entries" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      const idempotencyKey = (await request.allHeaders())["idempotency-key"];
      if (failNext) {
        // Javob kelmaydi (tarmoq uzildi) — daftarga ham yozilmadi.
        failNext = false;
        posts.push({ body, idempotencyKey, status: 0 });
        return route.abort("internetdisconnected");
      }
      const extra = Object.keys(body).filter((key) => !DTO_FIELDS.has(key));
      const invalid =
        extra.length > 0
          ? extra.map((key) => `property ${key} should not exist`)
          : typeof body.amount !== "number" || body.amount === 0
            ? ["amount must be a non-zero number"]
            : !SOURCE_TYPES.has(String(body.source_type))
              ? ["source_type must be one of the following values"]
              : null;
      if (invalid) {
        posts.push({ body, idempotencyKey, status: 400 });
        return reply(route, { statusCode: 400, message: invalid, error: "Bad Request" }, 400);
      }
      const repeated = idempotencyKey ? byKey.get(idempotencyKey) : undefined;
      const entry =
        repeated ??
        ({
          id: String(100 + state.history.length),
          amount: Math.abs(body.amount as number),
          balance_before: state.history[0].balance_after,
          balance_after: state.history[0].balance_after + (body.amount as number),
          source_type: body.source_type,
          comment: body.comment ?? null,
          created_by: "1",
          created_by_user: { id: "1", name: "Bosh admin", role: "superadmin" },
          order_id: null,
          createdAt: new Date().toISOString(),
        } satisfies LedgerEntry);
      if (!repeated) {
        state.history = [entry, ...state.history];
        if (idempotencyKey) byKey.set(idempotencyKey, entry);
      }
      posts.push({ body, idempotencyKey, status: 201 });
      return reply(route, { statusCode: 201, message: "Financial balance entry recorded", data: entry }, 201);
    }
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
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
  return { state, posts, leaked, historyGets: () => historyGets, balanceGets: () => balanceGets };
};

export const openHistoryTab = async (page: Page) => {
  await page.goto("/financial-balance?tab=history");
  await expect(page.getByRole("button", { name: "Yozuv qo'shish" })).toBeVisible({ timeout: 60_000 });
  // Dizayn v2: buyurtma raqami «№» bilan (jadvalda havola, telefonda karta matni).
  await expect(page.getByText("Buyurtma №1001")).toBeVisible();
};

/** "Yozuv qo'shish" → Qo'lda chiqim, 1 000, izoh → Saqlash. */
export const submitManualExpense = async (page: Page, comment: string) => {
  await page.getByRole("button", { name: "Yozuv qo'shish" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Qo'lda chiqim" }).click();
  await dialog.getByLabel("Summa").fill("1000");
  await dialog.getByLabel("Izoh").fill(comment);
  // Dizayn v2 (maket `superadmin-balance-entry-dialog`): «Balansga ta'siri» yorlig'i va qiymati alohida, bitta
  // `role=status` qatorida; uz valyutasi "so'm"; minus — haqiqiy `−` (U+2212, `formatSignedMoneyLocalized`).
  await expect(dialog.getByRole("status")).toHaveText(/^Balansga ta'siri: ?\u22121\D?000 so'm$/);
  return dialog;
};
