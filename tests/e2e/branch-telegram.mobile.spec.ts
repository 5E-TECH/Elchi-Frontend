import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Filial kassasi Telegram guruhi — telefon (390px): filial sahifasidagi «Kassa hisoboti · Telegram» kartasi.
 * Ulangan holat: «Almashtirish» / «Uzish» va «Guruhga · Shaxsiy chatga» to'liq enli, ≥ 44px; ulanmagan holat:
 * «Ulash» to'liq enli + «guruh ulanmagan» ogohlantirishi. Gorizontal skroll yo'q.
 */
const appOrigin = () => new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4173").origin;
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

const BRANCH = { id: "12", name: "Urganch filiali", type: "REGIONAL", level: 1, code: "URG", status: "active" };

type TelegramStatus = {
  branch_id: string;
  report_target: "group" | "private";
  group: null | {
    chat_id: string;
    title: string | null;
    is_active: boolean;
    inactive_reason: string | null;
    inactive_at: string | null;
    linked_at: string;
    linked_by: string | null;
  };
  can_manage: boolean;
};

const LINKED: TelegramStatus = {
  branch_id: BRANCH.id,
  report_target: "group",
  group: {
    chat_id: "-1001234567890",
    title: "Urganch kassa",
    is_active: true,
    inactive_reason: null,
    inactive_at: null,
    linked_at: "2026-11-18T09:00:00.000Z",
    linked_by: "1",
  },
  can_manage: true,
};

const mockBranchTelegramApi = async (page: Page, status: TelegramStatus) => {
  const origin = appOrigin();
  const cors = {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  };
  const reply = (route: Route, body: unknown, code = 200) =>
    route.fulfill({ status: code, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") return reply(route, wrap({ id: "1", role: "superadmin", name: "Bosh admin", status: "active" }));
    if (path === "notifications/inbox/unread-count") return reply(route, wrap({ unread: 0 }));
    if (path === `branches/${BRANCH.id}/telegram`) return reply(route, wrap(status));
    if (path === `branches/${BRANCH.id}`) return reply(route, wrap(BRANCH));
    if (request.method() !== "GET") return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    return reply(route, wrap([]));
  });
  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
};

const noHorizontalScroll = async (page: Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};

const telegramCard = (page: Page) => page.locator("section", { has: page.getByText("Kassa hisoboti · Telegram") });

test.describe("Filial kassasi Telegram guruhi — telefon 390px", () => {
  test.describe.configure({ timeout: 120_000 });

  test("⭐ ulangan: «Almashtirish» / «Uzish» va «Hisobot qayerga» to'liq enli, ≥ 44px, skroll yo'q", async ({ page }, testInfo) => {
    await mockBranchTelegramApi(page, LINKED);
    await page.goto(`/branches/${BRANCH.id}`);

    const card = telegramCard(page);
    await expect(card.getByText("Ulangan")).toBeVisible({ timeout: 90_000 });
    await expect(card.getByText("«Urganch kassa»", { exact: false })).toBeVisible();
    await card.scrollIntoViewIfNeeded();
    const cardBox = await card.boundingBox();

    for (const name of ["Almashtirish", "Uzish"]) {
      const button = card.getByRole("button", { name });
      const box = await button.boundingBox();
      expect(box?.height ?? 0, name).toBeGreaterThanOrEqual(44);
    }
    const target = card.getByRole("radiogroup", { name: "Hisobot qayerga" }).or(card.getByRole("group", { name: "Hisobot qayerga" }));
    const targetBox = await target.first().boundingBox();
    expect((targetBox?.width ?? 0) / (cardBox?.width ?? 1)).toBeGreaterThan(0.8);
    for (const name of ["Guruhga", "Shaxsiy chatga"]) {
      const option = card.getByRole("radio", { name }).or(card.getByRole("button", { name }));
      expect((await option.first().boundingBox())?.height ?? 0, name).toBeGreaterThanOrEqual(44);
    }
    await noHorizontalScroll(page);
    await card.screenshot({ path: testInfo.outputPath("branch-telegram-linked-390.png") });
  });

  test("ulanmagan: to'liq enli «Ulash» ≥ 44px va «guruh ulanmagan» ogohlantirishi", async ({ page }, testInfo) => {
    await mockBranchTelegramApi(page, { ...LINKED, group: null });
    await page.goto(`/branches/${BRANCH.id}`);

    const card = telegramCard(page);
    await expect(card.getByText("Ulanmagan", { exact: true })).toBeVisible({ timeout: 90_000 });
    await card.scrollIntoViewIfNeeded();
    const link = card.getByRole("button", { name: "Ulash" });
    const linkBox = await link.boundingBox();
    expect(linkBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((linkBox?.width ?? 0) / ((await card.boundingBox())?.width ?? 1)).toBeGreaterThan(0.8);
    await expect(card.getByRole("note")).toBeVisible();
    await noHorizontalScroll(page);
    await card.screenshot({ path: testInfo.outputPath("branch-telegram-unlinked-390.png") });
  });
});
