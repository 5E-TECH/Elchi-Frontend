import { expect, type Page, type Route } from "@playwright/test";

/**
 * `/regions/districts` e2e (DM-1, DM-2, admin) uchun soxta backend: viloyatlar va tumanlar, `DELETE district/:id` →
 * 400 (`data.usage` — bog'langan yozuvlar), `GET district/:id/usage`, `POST district/:id/merge` — testdagi javob
 * (har so'rovda qayta chaqiriladi — «Qayta urinish» uchun ketma-ket javoblar). Hech qanday so'rov serverga
 * ketmaydi; kutilmagan yozuvchi so'rov `leaked` ga tushadi.
 */
/** Dev server manzili (worktree probe'larida boshqa port — `E2E_ORIGIN`). */
const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

const district = (id: string, name: string) => ({ id, name });

/** `GET /region` — viloyatlar va ularga biriktirilgan tumanlar (maketdagi Andijon). */
export const REGIONS = [
  {
    id: "2",
    name: "Andijon",
    districts: [
      district("21", "Andijon sh."),
      district("22", "Asaka tumani"),
      district("23", "Bo'z tumani"),
      district("24", "Izboskan tumani"),
    ],
  },
  {
    id: "1",
    name: "Toshkent sh.",
    districts: [district("11", "Chilonzor tumani"), district("12", "Mirobod tumani")],
  },
];

const deletedZero = { orders: 0, users: 0, branches: 0, transfer_batches: 0 };

/** Bo'z tumaniga bog'langan tirik yozuvlar (DELETE 400 `data.usage`, `GET district/23/usage`). */
export const USAGE = { orders: 128, users: 6, branches: 1 };

/** 200 javobi — maketdagi sonlar (Izboskan: 1 126 → 1 254 buyurtma); `moved` — o'chirilganlar bilan (130). */
export const MERGED = {
  statusCode: 200,
  message: "District merged",
  data: {
    from_district_id: "23",
    to_district_id: "24",
    moved: { orders: 130, users: 6, branches: 1 },
    moved_live: { orders: 128, users: 6, branches: 1 },
    target_before: { orders: 1126, users: 13, branches: 1, transfer_batches: 0, deleted: deletedZero },
    target_after: { orders: 1254, users: 19, branches: 2, transfer_batches: 0, deleted: deletedZero },
  },
};

export type MergeReply = { status: number; body: unknown; delayMs?: number };

/** tf324cXN — 409: sonlar mos kelmadi (ko'chirilganlar qaytarildi). Server matni foydalanuvchiga chiqmasligi kerak. */
export const COUNT_MISMATCH: MergeReply = {
  status: 409,
  body: {
    statusCode: 409,
    message: "Birlashtirish bekor qilindi: tekshiruv mos kelmadi — B tumandagi buyurtmalar soni 1255",
    data: {
      reason: "count_mismatch",
      details: {
        reason: "count_mismatch",
        kind: "orders",
        mismatches: [{ kind: "orders", district: "target", expected: 1254, actual: 1255 }],
        from_district_id: "23",
        to_district_id: "24",
        // Z1c1sNPT — A tumanga qaytarilgan sonlar (tekis, `details` ichida).
        rolled_back_orders: 128,
        rolled_back_users: 6,
        rolled_back_branches: 1,
        manual_fix: false,
      },
    },
    trace_id: "e2e-trace-1",
  },
};

/** tf324cXN — 503: foydalanuvchilar qadami vaqtida javob bermadi, kompensatsiya chala (`manual_fix`). */
export const MANUAL_FIX: MergeReply = {
  status: 503,
  body: {
    statusCode: 503,
    message: "Birlashtirish bekor qilindi, lekin kompensatsiya to'liq bo'lmadi: …",
    data: {
      reason: "timeout",
      details: {
        reason: "timeout",
        kind: "users",
        timeout_ms: 15000,
        from_district_id: "23",
        to_district_id: "24",
        rolled_back_orders: 114,
        rolled_back_users: 0,
        rolled_back_branches: 0,
        manual_fix: true,
        stranded: [
          { kind: "orders", district_id: "24", count: 14 },
          { kind: "users", district_id: null, count: null },
        ],
        // Z1c1sNPT — qaytmagan buyurtmalarning birinchi ≤10 ta ID'si.
        stranded_order_ids: ["7001", "7002", "7015", "7023", "7040"],
      },
    },
  },
};

export const mockDistrictsApi = async (
  page: Page,
  merge: () => MergeReply,
  { theme = "light" }: { theme?: "light" | "dark" } = {},
) => {
  const leaked: string[] = [];
  const mergeBodies: { path: string; body: unknown }[] = [];
  const deletes: string[] = [];
  let regionCalls = 0;
  let merged = false;
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, {
        statusCode: 200,
        data: {
          id: "2",
          role: "admin",
          name: "E2E Admin",
          status: "active",
          settings: { appearance: { theme, themeChosen: true } },
        },
      });
    }
    if (path === "region" && request.method() === "GET") {
      regionCalls += 1;
      const regions = merged
        ? REGIONS.map((r) => ({ ...r, districts: r.districts.filter((d) => d.id !== "23") }))
        : REGIONS;
      return reply(route, { statusCode: 200, data: regions });
    }
    const del = /^district\/(\w+)$/.exec(path);
    if (del && request.method() === "DELETE") {
      deletes.push(del[1]);
      return reply(
        route,
        {
          statusCode: 400,
          message: "Bu tumanda 128 ta buyurtma bor, shuning uchun uni o'chirib bo'lmaydi.",
          data: { reason: "district_in_use", usage: { ...USAGE, transfer_batches: 0 } },
        },
        400,
      );
    }
    if (/^district\/\w+\/usage$/.test(path) && request.method() === "GET") {
      return reply(route, { statusCode: 200, message: "ok", data: USAGE });
    }
    if (/^district\/\w+\/merge$/.test(path) && request.method() === "POST") {
      mergeBodies.push({ path, body: request.postDataJSON() });
      const result = merge();
      if (result.delayMs) await new Promise((resolve) => setTimeout(resolve, result.delayMs));
      if (result.status < 400) merged = true;
      return reply(route, result.body, result.status);
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
  return { leaked, mergeBodies, deletes, regionCalls: () => regionCalls };
};

export const openDistricts = async (page: Page) => {
  await page.goto("/regions/districts");
  await expect(page.getByRole("heading", { name: "Tumanlar", exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Bo'z tumani").first()).toBeVisible();
};

/** Telefonda viloyatlar akkordeon: Andijon (birinchisi) ochiq turadi. */
export const deleteBoz = async (page: Page) => {
  await page.getByRole("button", { name: "Bo'z tumanini o'chirish" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Bo'z tumani o'chirilsinmi?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "O'chirish" }).click();
  const blocked = page.getByRole("alertdialog", { name: "Bo'z tumanini o'chirib bo'lmaydi" });
  await expect(blocked).toBeVisible();
  return blocked;
};

/** «O'chirib bo'lmaydi» → «Birlashtirish» → maqsad «Izboskan tumani». */
export const openMergeToIzboskan = async (page: Page) => {
  const blocked = await deleteBoz(page);
  await blocked.getByRole("button", { name: "Birlashtirish" }).click();
  const dialog = page.getByRole("dialog", { name: "Tumanni birlashtirish" });
  await expect(dialog).toBeVisible();
  await expect(blocked).toBeHidden();
  await dialog.getByRole("combobox", { name: /Maqsad tuman/ }).click();
  await expect(page.getByRole("option")).toHaveText(["Andijon sh.", "Asaka tumani", "Izboskan tumani"]);
  await page.getByRole("option", { name: "Izboskan tumani" }).click();
  await expect(dialog.getByText("Bu amalni qaytarib bo'lmaydi")).toBeVisible();
  return dialog;
};
