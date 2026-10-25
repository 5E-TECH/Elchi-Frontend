import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * SZTZ4HEU «e638c6»: yangi xodim yaratilgach filial «Xodim qo'shish» oynasi uni sahifa qayta yuklanmasdan ko'rsatadi.
 * Soxta gateway (superadmin): `GET users?role=…` — joriy foydalanuvchilar, `POST couriers` — yangi kuryer qo'shadi.
 * Ilova manzili `playwright.config.ts` dagi `baseURL` dan.
 */
const appOrigin = () => new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4194").origin;
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

export const BRANCH = { id: "12", name: "Urganch filiali", type: "REGIONAL", level: 1, code: "URG", status: "active" };

type UserRow = { id: string; name: string; phone_number: string; role: string; status: string };

export const mockBranchAddEmployeeApi = async (page: Page) => {
  const origin = appOrigin();
  const cors = {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  };
  const reply = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
  const users: UserRow[] = [
    { id: "5", name: "Sardor Karimov", phone_number: "+998901000005", role: "courier", status: "active" },
    { id: "6", name: "Dilnoza Yusupova", phone_number: "+998901000006", role: "registrator", status: "active" },
  ];
  const creates: unknown[] = [];
  const leaked: string[] = [];
  let usersGets = 0;

  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") return reply(route, wrap({ id: "1", role: "superadmin", name: "Bosh admin", status: "active" }));
    if (path === "notifications/inbox/unread-count") return reply(route, wrap({ unread: 0 }));
    if (path === "users" && request.method() === "GET") {
      usersGets += 1;
      const role = url.searchParams.get("role");
      const status = url.searchParams.get("status");
      const items = users.filter((user) => (!role || user.role === role) && (!status || user.status === status));
      return reply(route, wrap({ items, meta: { page: 1, limit: 100, total: items.length, totalPages: 1 } }));
    }
    if (path === "couriers" && request.method() === "POST") {
      const body = request.postDataJSON() as { name: string; phone_number: string };
      creates.push(body);
      const created = { id: "57", name: body.name, phone_number: body.phone_number, role: "courier", status: "active" };
      users.push(created);
      return reply(route, { statusCode: 201, message: "Courier created", data: created }, 201);
    }
    if (path === `branches/${BRANCH.id}`) return reply(route, wrap(BRANCH));
    if (path === "branches" && request.method() === "GET") {
      return reply(route, wrap({ items: [BRANCH], meta: { page: 1, limit: 500, total: 1, totalPages: 1 } }));
    }
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, wrap([]));
  });
  // Soat to'xtatilgan (`Date.now` o'zgarmaydi, taymerlar ishlaydi): `useUsers` ning 30 s `staleTime` i HECH QACHON
  // o'z-o'zidan tugamaydi — oyna yangi xodimni faqat mutatsiya invalidatsiyasi tufayli ko'rsatadi (sekin mashinada
  // ham test tuzatishsiz yiqiladi).
  await page.clock.setFixedTime(new Date());
  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
  return { users, creates, leaked, usersGets: () => usersGets };
};

/** Filial sahifasi → «Xodim qo'shish» oynasi; ro'yxat yuklangach oynani qaytaradi. */
export const openAddEmployee = async (page: Page) => {
  await page.getByRole("button", { name: "Xodim qo'shish" }).click();
  const dialog = page.getByRole("dialog", { name: "Xodim qo'shish" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("option").first()).toBeVisible({ timeout: 30_000 });
  return dialog;
};

/** SPA ichida o'tish (react-router `popstate` ni tinglaydi) — hujjat qayta yuklanmaydi. */
export const spaNavigate = (page: Page, path: string) =>
  page.evaluate((target) => {
    window.history.pushState({}, "", target);
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
  }, path);

export const markDocument = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as { __sameDocument: boolean }).__sameDocument = true;
  });

export const isSameDocument = (page: Page) =>
  page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument === true);
