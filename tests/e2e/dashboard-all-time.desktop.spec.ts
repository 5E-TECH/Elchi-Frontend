import { expect, test, type Page, type Route } from "@playwright/test";
import { assertManropeLoaded, FONT_HOSTS, serveFont } from "../visual/support/fonts";

/**
 * tya24blo — bosh sahifada «Barchasi»: superadmin, market va menejer (`/branch-dashboard`) `GET analytics/dashboard`
 * ga `all=true` yuboradi (`start_day=1970-01-01` emas). Backend oraliqni 366 kunga qisqartirgan bo'lsa
 * (`clamped: true` + `effective_from` / `effective_to`), sarlavhadagi sana maydonida shu haqiqiy oraliq ko'rinadi.
 * Meta joyi: superadmin va menejer — javobning yuqori darajasi, market — `myStat.applied_range` (karta: market /
 * menejer javobida meta shu yerda edi). 1440 va 390px, soxta backend.
 *
 * Matn kengligi o'lchanadi — shuning uchun ilovadagi HAQIQIY shrift (Manrope, Google Fonts) yuklanadi (vizual
 * testlardagi `serveFont`): to'sib qo'yilsa zaxira shrift chiziladi va natija mashinaga bog'liq bo'ladi (lokalda
 * o'tib, CI'da 0,2–7,5 px toshib yiqilardi).
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

const META = { clamped: true, effective_from: "2025-10-21", effective_to: "2026-10-20", max_span_days: 366 };
const RANGE_TEXT = /^21\.10\.2025\s–\s20\.10\.2026$/;

type Role = "superadmin" | "market" | "manager";
const PROFILES: Record<Role, Record<string, unknown>> = {
  superadmin: { id: "1", role: "superadmin", name: "Bosh admin", status: "active" },
  market: { id: "37", role: "market", name: "Baraka Shop", status: "active", add_order: true },
  manager: {
    id: "25",
    role: "manager",
    name: "Menejer",
    status: "active",
    branch_id: "b6",
    branch: { id: "b6", type: "REGIONAL", name: "Urgut filiali" },
  },
};

const dashboardData = (role: Role, all: boolean) => {
  const base: Record<string, unknown> = {
    orders: { acceptedCount: 120, soldAndPaid: 80, cancelled: 10, profit: 1_200_000, totalRevenue: 9_600_000 },
    myStat: { totalOrders: 28, soldOrders: 19, canceledOrders: 3, profit: 480_000, successRate: 67.86 },
    markets: [],
    couriers: [],
    topMarkets: [],
    topBranches: [],
    topCouriers: [],
    topOperators: [],
    ...(role === "manager"
      ? { branchDashboard: { role: "MANAGER", today_orders_count: 4, week_orders_count: 20, active_batches_count: 1, couriers_count: 3 } }
      : {}),
  };
  if (!all) return base;
  if (role === "market") {
    return { ...base, myStat: { ...(base.myStat as object), applied_range: { clamped: true, from: META.effective_from, to: META.effective_to } } };
  }
  return { ...base, ...META };
};

const mockDashboard = async (page: Page, role: Role) => {
  const requests: URLSearchParams[] = [];
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (FONT_HOSTS.has(url.host)) return void (await serveFont(route));
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") return reply(route, { statusCode: 200, data: PROFILES[role] });
    if (path === "analytics/dashboard") {
      requests.push(url.searchParams);
      return reply(route, { statusCode: 200, message: "ok", data: dashboardData(role, url.searchParams.get("all") === "true") });
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
  return requests;
};

test.describe.configure({ timeout: 180_000 });

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test.describe(`${viewport.width}px`, () => {
    test.use({ viewport });

    for (const role of ["superadmin", "market", "manager"] as const) {
      test(`⭐ ${role}: «Barchasi» → all=true; sana maydonida haqiqiy oraliq 21.10.2025 – 20.10.2026`, async ({ page }) => {
        const requests = await mockDashboard(page, role);
        await page.goto(role === "manager" ? "/branch-dashboard" : "/");
        const all = page.getByRole("radio", { name: "Barchasi" });
        await expect(all).toBeVisible({ timeout: 90_000 });
        await expect(page.getByText(RANGE_TEXT)).toHaveCount(0);

        await all.click();
        await expect(all).toBeChecked();
        await expect.poll(() => requests.at(-1)?.get("all")).toBe("true");
        const last = requests.at(-1)!;
        expect(last.has("start_day")).toBe(false);
        expect(last.has("end_day")).toBe(false);
        if (role === "manager") expect(last.get("branch_id")).toBe("b6");
        // 1970-01-01 hech qaysi so'rovda ketmadi.
        expect(requests.some((params) => params.get("start_day") === "1970-01-01")).toBe(false);

        const range = page.getByText(RANGE_TEXT);
        await expect(range).toBeVisible();
        await assertManropeLoaded(page);
        // Oraliq TO'LIQ ko'rinadi — «… – 20.10.2…» bo'lib kesilmaydi (`toBeVisible` kesilishni ushlamaydi; tya24blo
        // qayta tekshiruvi: market 390px da «Yil» tanlovi yonida matn qutisi 154 px, matn 171 px edi).
        // Sub-piksel aniqlikda: `scrollWidth`/`clientWidth` butun songa yaxlitlanadi va 0,2 px kesilishni («20.10.20…»)
        // ko'rmaydi — matnning haqiqiy eni (Range) qutidan katta bo'lmasin.
        expect(
          await range.evaluate((node) => {
            const text = document.createRange();
            text.selectNodeContents(node);
            return text.getBoundingClientRect().width - node.getBoundingClientRect().width;
          }),
        ).toBeLessThanOrEqual(0.01);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        // «Yil» bosish joyi telefonda ≥ 44 × 44 (tugma butun maydon — `fullTrigger`), maydon esa tor qoladi.
        if (viewport.width < 768 && role !== "manager") {
          const year = await page.getByRole("combobox", { name: /Yil/ }).boundingBox();
          expect(year!.width).toBeGreaterThanOrEqual(44);
          expect(year!.height).toBeGreaterThanOrEqual(44);
        }

        // Telefonda «Yil» tor (matn kengligida) — uning ro'yxati maydon eniga qisilmaydi: har variant bir qatorda
        // (avval 53 px ro'yxatda «Yil» harflarga bo'linardi).
        if (viewport.width === 390 && role !== "manager") {
          await page.getByRole("combobox", { name: /Yil/ }).click();
          // Har variant matni nechta qatorga bo'lingan (qutining balandligi 44 px qolib, matn toshadi — shuning uchun
          // matn qatorlari sanaladi).
          const lines = await page
            .getByRole("listbox")
            .getByRole("option")
            .evaluateAll((nodes) =>
              nodes.map((node) => {
                const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
                let max = 0;
                for (let text = walker.nextNode(); text; text = walker.nextNode()) {
                  if (!text.textContent?.trim()) continue;
                  const range = document.createRange();
                  range.selectNodeContents(text);
                  max = Math.max(
                    max,
                    new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top)))
                      .size,
                  );
                }
                return max;
              }),
            );
          expect(lines.length).toBeGreaterThan(1);
          expect(Math.max(...lines)).toBe(1);
          await page.keyboard.press("Escape");
        }
      });
    }
  });
}
