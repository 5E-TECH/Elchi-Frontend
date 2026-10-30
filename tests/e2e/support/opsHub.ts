import { expect, type Page, type Route } from "@playwright/test";

/**
 * Ops vositalari hub'i (`/ops`) e2e uchun soxta backend. Hech qanday so'rov serverga ketmaydi: GET — bo'sh ro'yxat,
 * yozish so'rovi `leaked` ga tushadi (eski yo'lni ochish hech narsa yozmasligi kerak).
 */
const ORIGIN = "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: cors,
    body: JSON.stringify(body),
  });

type Role = "superadmin" | "admin";
const PROFILES: Record<Role, Record<string, unknown>> = {
  superadmin: { id: "1", role: "superadmin", name: "Bosh admin", status: "active" },
  admin: { id: "2", role: "admin", name: "Admin", status: "active" },
};

export const mockOpsHub = async (page: Page, role: Role) => {
  const leaked: string[] = [];
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") return reply(route, { statusCode: 200, data: PROFILES[role] });
    if (request.method() !== "GET") leaked.push(`${request.method()} ${path}`);
    return reply(route, { statusCode: 200, data: [] });
  });
  await page.addInitScript(() => {
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
  });
  return { leaked };
};

/** Hub'ga yo'naltiriladigan eski yo'llar: `tab` — `?tab=`, `label` — tab nomi, `panel` — panel sarlavhasi. */
export const OPS_REDIRECTS = [
  { from: "/investors-ops", tab: "investors", label: "Investorlar", panel: "Investorlar" },
  {
    from: "/logistics-ops",
    tab: "logistics",
    label: "Logistika",
    panel: "Logistika — qaytarish so'rovlari",
  },
  { from: "/branch-ops", tab: "branches", label: "Filiallar", panel: "Filiallar — operatsiyalar" },
  { from: "/system-ops", tab: "system", label: "Tizim", panel: "Tizim — xizmatlar va analitika" },
  { from: "/logs", tab: "auth", label: "Kirish diagnostikasi", panel: "Kirish diagnostikasi" },
];

/** Sahifa — hub (`?tab=` to'g'ri, sarlavha «Ops vositalari», tab paneli ochilgan), eski alohida sahifa emas. */
export const expectOpsHub = async (page: Page, tab: string, panel: string) => {
  const content = page.locator("[data-shell-slot=content]");
  await expect(content.getByRole("heading", { level: 1, name: "Ops vositalari" })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page).toHaveURL(new RegExp(`/ops\\?tab=${tab}$`));
  await expect(content.getByRole("heading", { level: 2, name: panel, exact: true })).toBeVisible();
  // Ikkinchi eshik yo'q: eski sahifaning «← Ops vositalari» havolasi chizilmaydi.
  await expect(content.getByRole("link", { name: "Ops vositalari" })).toHaveCount(0);
};
