import { expect, type Page, type Route } from "@playwright/test";

/**
 * EzgWTudf (#212) — jo'natilgan pochtani boshqa qabul qiluvchiga o'tkazish. Elchi v2 da pochta kuryerga emas,
 * filialga jo'natiladi: «Eski» pochta tafsiloti → «Filialga o'tkazish» (superadmin, admin) →
 * `POST branches/posts/:id/reassign {destination_branch_id}`. Soxta backend:
 *  - `GET post` — «Eski»: №120 (jo'natilgan, Samarqand 1 ga, hamma buyurtma yo'lda), №121 (qabul qilingan);
 *  - `GET branches` — «Filial» ustuni nomlari; `GET branches/dispatch-destinations` — viloyat filiallari;
 *  - `GET post/orders/:id` — pochta meta'si va buyurtmalari;
 *  - `POST branches/posts/120/reassign` — 201 (pochta filiali almashadi) yoki `reject` bo'lsa 409 (backend matni);
 *  - boshqa yozish so'rovlari taqiqlangan (`leaked`).
 */
const ORIGIN = "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    headers: cors,
    body: JSON.stringify(body),
  });

const REGION = { id: "8", name: "Samarqand", sato_code: "1718" };
const BRANCHES = [
  { id: "31", name: "Samarqand 1", hasManager: true },
  { id: "32", name: "Samarqand 2", hasManager: true },
  { id: "33", name: "Kattaqo'rg'on", hasManager: false },
];
export const REJECT_MESSAGE =
  "Pochtadagi 1 ta buyurtma filialda qabul qilingan yoki yo'lda emas: #3202. Qabul qilina boshlagan pochtani boshqa filialga o'tkazib bo'lmaydi. Hech narsa o'tkazilmadi";

type Role = "superadmin" | "admin" | "registrator" | "manager";

const PROFILES: Record<Role, Record<string, unknown>> = {
  superadmin: { id: "1", role: "superadmin", name: "Bosh admin" },
  admin: { id: "2", role: "admin", name: "Admin" },
  registrator: {
    id: "3",
    role: "registrator",
    name: "HQ registrator",
    branch_id: "1",
    branch_type: "HQ",
    branch: { id: "1", name: "HQ Toshkent", type: "HQ" },
  },
  manager: {
    id: "4",
    role: "manager",
    name: "Ravshan Ortiqov",
    branch_id: "31",
    branch_type: "REGIONAL",
    branch: { id: "31", name: "Samarqand 1", type: "REGIONAL" },
  },
};

const order = (id: string, name: string, status: string, postId: string) => ({
  id,
  createdAt: "2026-11-04T07:00:00.000Z",
  updatedAt: "2026-11-04T07:00:00.000Z",
  market_id: "7",
  customer_id: `c${id}`,
  product_quantity: 1,
  where_deliver: "address",
  total_price: 150000,
  to_be_paid: 150000,
  paid_amount: 0,
  status,
  comment: null,
  operator: null,
  post_id: postId,
  qr_code_token: `qr-${id}`,
  customer: { id: `c${id}`, name, phone_number: "+998901234567" },
  market: { id: "7", name: "Baraka Shop" },
  district: { id: "1401", name: "Urgut", region_id: REGION.id, region: REGION },
  region: REGION,
  items: [],
});

export const mockMailTransfer = async (
  page: Page,
  { role = "superadmin" as Role, reject = false, theme = "light" as "light" | "dark" } = {},
) => {
  const state = {
    posts: {
      "120": {
        status: "sent",
        branch_id: "31",
        orders: [
          order("3201", "Aliyev Vali", "on the road", "120"),
          order("3202", "Karimova Nodira", "on the road", "120"),
        ],
      },
      "121": {
        status: "received",
        branch_id: "31",
        orders: [order("3301", "Sobirov Jasur", "waiting", "121")],
      },
    } as Record<string, { status: string; branch_id: string; orders: ReturnType<typeof order>[] }>,
  };
  const reassigns: Array<{ postId: string; body: unknown; status: number }> = [];
  const leaked: string[] = [];
  const postRow = (id: string) => {
    const item = state.posts[id];
    return {
      id,
      createdAt: id === "120" ? "2026-11-04T07:30:00.000Z" : "2026-11-03T07:30:00.000Z",
      updatedAt: "2026-11-04T07:30:00.000Z",
      isDeleted: false,
      courier_id: "0",
      post_total_price: item.orders.reduce((sum, row) => sum + row.total_price, 0),
      order_quantity: item.orders.length,
      qr_code_token: `POST-${id}`,
      region_id: REGION.id,
      branch_id: item.branch_id,
      region: REGION,
      status: item.status,
      courier: null,
    };
  };

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
          ...PROFILES[role],
          status: "active",
          settings: { appearance: { theme, themeChosen: true } },
        },
      });
    }
    if (path === "post" && request.method() === "GET") {
      const rows = Object.keys(state.posts).map(postRow);
      return reply(route, {
        statusCode: 200,
        data: {
          data: rows,
          total: rows.length,
          page: 1,
          totalPages: 1,
          limit: 8,
          orders_total: 3,
          amount_total: 450000,
        },
      });
    }
    if (path === "branches") {
      return reply(route, {
        statusCode: 200,
        data: {
          items: BRANCHES.map(({ id, name }) => ({ id, name, type: "REGIONAL", status: "active" })),
          total: 3,
        },
      });
    }
    if (path === "branches/dispatch-destinations") {
      const items = BRANCHES.map(({ id, name, hasManager }) => ({
        id,
        name,
        code: `SMQ-${id}`,
        type: "REGIONAL",
        status: "active",
        phone_number: "+998903009002",
        region_id: REGION.id,
        region: { id: REGION.id, name: REGION.name },
        has_manager: hasManager,
        manager: hasManager ? { id: `m${id}`, name: "Menejer" } : null,
      }));
      return reply(route, { statusCode: 200, data: { items, total: items.length } });
    }
    const detail = /^post\/orders\/(\d+)$/.exec(path);
    if (detail && state.posts[detail[1]]) {
      const id = detail[1];
      const item = state.posts[id];
      const total = item.orders.reduce((sum, row) => sum + row.total_price, 0);
      return reply(route, {
        statusCode: 200,
        message: "ok",
        data: {
          allOrdersByPostId: item.orders,
          homeOrders: { homeOrders: item.orders.length, homeOrdersTotalPrice: total },
          centerOrders: { centerOrders: 0, centerOrdersTotalPrice: 0 },
          post: { ...postRow(id), region: { id: REGION.id, name: REGION.name } },
        },
      });
    }
    const reassign = /^branches\/posts\/(\d+)\/reassign$/.exec(path);
    if (reassign && request.method() === "POST") {
      const body = request.postDataJSON() as { destination_branch_id: string };
      if (reject) {
        reassigns.push({ postId: reassign[1], body, status: 409 });
        return reply(route, { statusCode: 409, message: REJECT_MESSAGE, error: "Conflict" }, 409);
      }
      state.posts[reassign[1]].branch_id = String(body.destination_branch_id);
      reassigns.push({ postId: reassign[1], body, status: 201 });
      return reply(
        route,
        {
          statusCode: 201,
          message: "ok",
          data: { post_id: reassign[1], destination_branch_id: body.destination_branch_id },
        },
        201,
      );
    }
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, { statusCode: 200, data: [] });
  });
  await page.addInitScript((t) => {
    window.localStorage.setItem("theme", t);
    window.localStorage.setItem("theme-version", "2");
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({
        accessTokenExpiresAt: far,
        refreshTokenExpiresAt: far,
        refreshTokenWarnAt: far,
      }),
    );
  }, theme);
  return { reassigns, leaked };
};

const shot = async (page: Page, name: string) => {
  if (process.env.E2E_SHOTS_DIR)
    await page.screenshot({ path: `${process.env.E2E_SHOTS_DIR}/${name}.png` });
};

const transferButton = (page: Page) =>
  page.getByRole("button", { name: "Filialga o'tkazish" }).locator("visible=true");

/** Telefonda «Eski» — kartalar emas, jadval kartasi (superadmin); №ni bosish ikkala holatda ham ishlaydi. */
const openFromOldList = async (page: Page, id: string, isPhone: boolean) => {
  await page.goto("/mails/old");
  const link = isPhone
    ? page
        .getByRole("link", { name: new RegExp(`№${id}`) })
        .locator("visible=true")
        .first()
    : page
        .getByRole("table", { name: "Eski pochtalar" })
        .getByRole("link", { name: `№${id}`, exact: true });
  await expect(link).toBeVisible({ timeout: 60_000 });
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/mails/${id}$`));
};

const branchInOldList = async (page: Page, id: string, isPhone: boolean) => {
  if (isPhone) {
    return page
      .getByRole("link", { name: new RegExp(`№${id}`) })
      .locator("visible=true")
      .first();
  }
  const table = page.getByRole("table", { name: "Eski pochtalar" });
  return table
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name: `№${id}`, exact: true }) });
};

/**
 * TC1 + TC2: superadmin — jo'natilgan pochtada «Filialga o'tkazish» bor; o'tkazgach «Eski»da yangi filial nomi.
 * Qabul qilingan pochtada tugma yo'q.
 */
export const runTransferHappyPath = async (
  page: Page,
  { theme = "light" as "light" | "dark", isPhone = false, label = "1440" } = {},
) => {
  const { reassigns, leaked } = await mockMailTransfer(page, { theme });

  await openFromOldList(page, "120", isPhone);
  await expect(page.getByText("Aliyev Vali").locator("visible=true").first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(transferButton(page)).toHaveCount(1);
  await transferButton(page).click();

  const dialog = page.getByRole("dialog", { name: "Pochtani boshqa filialga o'tkazish" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(
    "Pochta hozir «Samarqand 1» filialiga jo'natilgan, hali qabul qilinmagan. Pochta va undagi 2 ta buyurtma tanlangan filialga o'tadi.",
  );
  const group = dialog.getByRole("group", { name: "Shu viloyatdagi boshqa faol filiallar" });
  await expect(group.getByRole("radio")).toHaveCount(2);
  await expect(group.getByRole("radio", { name: /Kattaqo'rg'on/ })).toBeDisabled();
  await group.getByText("Samarqand 2", { exact: true }).click();
  await shot(page, `mail-transfer-dialog-${label}-${theme}`);
  await dialog.getByRole("button", { name: "O'tkazish" }).click();

  await expect
    .poll(() => reassigns)
    .toEqual([{ postId: "120", body: { destination_branch_id: "32" }, status: 201 }]);
  await expect(page.getByText("Pochta Samarqand 2 filialiga o'tkazildi.").first()).toBeVisible();
  await expect(dialog).toHaveCount(0);

  // TC2: ro'yxat yangilangan — «Eski»da №120 endi «Samarqand 2» da (orqaga — sarlavhadagi tugma).
  await page
    .getByRole("button", { name: /Eski pochtalar/ })
    .locator("visible=true")
    .first()
    .click();
  await expect(page).toHaveURL(/\/mails\/old/);
  const row = await branchInOldList(page, "120", isPhone);
  await expect(row.getByText("Samarqand 2").locator("visible=true")).toHaveCount(1, {
    timeout: 15_000,
  });
  await expect(row.getByText("Samarqand 1")).toHaveCount(0);
  await shot(page, `mail-transfer-list-${label}-${theme}`);

  // TC1 (ikkinchi yarmi): qabul qilingan pochtada tugma yo'q.
  await openFromOldList(page, "121", isPhone);
  await expect(page.getByText("Sobirov Jasur").locator("visible=true").first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "Filialga o'tkazish" })).toHaveCount(0);

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(leaked).toEqual([]);
};

/** TC3: backend rad etsa (shu orada qabul qilina boshlagan) — oynada backend matni, oyna ochiq, hech narsa o'zgarmaydi. */
export const runTransferRejected = async (page: Page) => {
  const { reassigns, leaked } = await mockMailTransfer(page, { reject: true });
  await openFromOldList(page, "120", false);
  await expect(page.getByText("Aliyev Vali").locator("visible=true").first()).toBeVisible({
    timeout: 30_000,
  });
  await transferButton(page).click();
  const dialog = page.getByRole("dialog", { name: "Pochtani boshqa filialga o'tkazish" });
  await dialog.getByText("Samarqand 2", { exact: true }).click();
  await dialog.getByRole("button", { name: "O'tkazish" }).click();

  await expect.poll(() => reassigns.map((item) => item.status)).toEqual([409]);
  await expect(
    page.getByText(/Qabul qilina boshlagan pochtani boshqa filialga o'tkazib bo'lmaydi/).first(),
  ).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "O'tkazish" })).toBeEnabled();
  await shot(page, "mail-transfer-rejected-1440-light");
  expect(leaked).toEqual([]);
};

/** TC4: shu pochta (`?view=old`) — superadmin va admin tugmani ko'radi, HQ registratori va menejer — yo'q. */
export const runTransferRoleVisibility = async (page: Page, role: Role, visible: boolean) => {
  const { leaked } = await mockMailTransfer(page, { role });
  await page.goto("/mails/120?view=old");
  await expect(page.getByText("Aliyev Vali").locator("visible=true").first()).toBeVisible({
    timeout: 60_000,
  });
  if (visible) await expect(transferButton(page)).toHaveCount(1);
  else await expect(page.getByRole("button", { name: "Filialga o'tkazish" })).toHaveCount(0);
  expect(leaked).toEqual([]);
};
