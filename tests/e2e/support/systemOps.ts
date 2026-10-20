import { expect, type Page, type Route } from "@playwright/test";

/**
 * `/system-ops` (Ops → Tizim) e2e uchun soxta backend (superadmin). Hech qanday so'rov serverga ketmaydi;
 * GET bo'lmagan so'rov `leaked` ga tushadi.
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

/** api-gateway `SERVICE_HEALTH_PROBES` tartibi (backend `origin/main`). */
export const HEALTH_SERVICES = [
  "IDENTITY",
  "ORDER",
  "CATALOG",
  "LOGISTICS",
  "FINANCE",
  "NOTIFICATION",
  "INTEGRATION",
  "ANALYTICS",
  "BRANCH",
  "INVESTOR",
  "FILE",
  "C2C",
  "SEARCH",
  "AI",
];

type Probe = { status: "ok" | "down" | "unknown"; latency_ms?: number; error?: string };
export type MockReply = { status: number; body: unknown };

/**
 * `GET /health/readiness` javobi — konvertsiz: `{ status, timestamp, services }`; hammasi ok — 200, aks holda 503.
 */
export const readiness = (overrides: Record<string, Probe> = {}): MockReply => {
  const services = HEALTH_SERVICES.map((service, index) => ({
    service,
    latency_ms: [12, 18, 9, 21, 15, 14, 27, 41, 11, 8, 14, 10, 22, 19][index],
    ...(overrides[service] ?? { status: "ok" }),
  }));
  const allOk = services.every((s) => s.status === "ok");
  return {
    status: allOk ? 200 : 503,
    body: { status: allOk ? "ok" : "degraded", timestamp: new Date().toISOString(), services },
  };
};

export const PARTIAL = readiness({
  NOTIFICATION: { status: "down", latency_ms: 212, error: "reported degraded" },
  SEARCH: { status: "down", latency_ms: 1502, error: "Timeout has occurred" },
});

export const CRITICAL = readiness({
  ORDER: { status: "down", latency_ms: 38, error: "Internal error: ECONNREFUSED 10.0.0.4:5672" },
  AI: { status: "unknown", error: "client not registered" },
});

/** `analytics-service` KPI konverti. */
export const KPI_OK: MockReply = {
  status: 200,
  body: {
    statusCode: 200,
    message: "KPI stats",
    data: {
      averageOrderValue: 236400,
      averageFulfillmentHours: 18.4,
      onTimeRate: 82.6,
      cancellationRate: 7.5,
      courierEfficiency: 9.4,
      marketRating: [],
      marketRatingMeta: {},
      degraded: false,
      failed_parts: [],
    },
  },
};

export const mockSystemOpsApi = async (
  page: Page,
  options: { health?: MockReply[]; kpi?: MockReply[] } = {},
) => {
  const leaked: string[] = [];
  const calls = { health: 0, kpi: 0 };
  // Navbatdagi javob; oxirgisi keyingi so'rovlarda takrorlanadi.
  const next = (list: MockReply[] | undefined, index: number, fallback: MockReply) =>
    list && list.length ? list[Math.min(index, list.length - 1)] : fallback;

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
    if (path === "health/readiness") {
      const result = next(options.health, calls.health, readiness());
      calls.health += 1;
      return reply(route, result.body, result.status);
    }
    if (path === "analytics/kpi") {
      const result = next(options.kpi, calls.kpi, KPI_OK);
      calls.kpi += 1;
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
  return { leaked, calls };
};

export const openSystemOps = async (page: Page) => {
  await page.goto("/system-ops");
  await expect(page.getByRole("heading", { name: "Tizim — xizmatlar va analitika" })).toBeVisible({ timeout: 60_000 });
};

export const healthCard = (page: Page) => page.getByRole("region", { name: "Tizim holati" });
