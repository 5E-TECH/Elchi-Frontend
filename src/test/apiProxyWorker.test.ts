import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../../worker";
import {
  BAD_PROXY_PATH,
  type Env,
  parseApiOrigin,
  proxiedResponse,
  rewriteSetCookie,
  UPSTREAM_UNAVAILABLE,
  upstreamHeaders,
  upstreamPath,
  upstreamTarget,
} from "../../worker/proxy";

/**
 * BIR DOMENLI API — Worker proksi (`worker/index.ts` → `worker/proxy.ts`, `wrangler.jsonc` → `env.staging`): kabinetning `/api/*` va
 * `/socket.io/*` so'rovlari API'ga. Asosiy shartlar: backend rate-limit mijozning HAQIQIY IP'sini ko'radi (soxta
 * `X-Real-IP` o'tmaydi), refresh cookie `/api/auth` ga yetadi, tunnel xato sahifasi JS'ga «Network Error» emas.
 */
const API_ORIGIN = "https://test-api.elchipochta.uz";
const SITE = "https://test-admin.elchipochta.uz";

/** Express `res.cookie` / `res.clearCookie` chiqishi (Elchi-Backend `refresh-cookie.ts`: Path=/auth, Lax, Secure). */
const LOGIN_COOKIE =
  "refreshToken=refresh.jwt; Max-Age=86400; Path=/auth; Expires=Sat, 21 Nov 2026 10:00:00 GMT; HttpOnly; Secure; SameSite=Lax";
const CLEARED_COOKIE = "refreshToken=; Path=/auth; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax";

const assets = { fetch: vi.fn(async () => new Response("<!doctype html>", { headers: { "content-type": "text/html" } })) };
const env = (overrides: Partial<Env> = {}): Env => ({ ASSETS: assets, API_ORIGIN, ...overrides });

const upstreamFetch = vi.fn<(input: URL, init?: RequestInit) => Promise<Response>>();
vi.stubGlobal("fetch", upstreamFetch);

/** API'ga ketgan so'rov (`fetch(target, init)`). */
const sentRequest = () => {
  const [input, init] = upstreamFetch.mock.calls[0];
  return new Request(input, init);
};

afterEach(() => {
  upstreamFetch.mockReset();
  assets.fetch.mockClear();
});

describe("yo'l xaritasi", () => {
  it("/api prefiksi olib tashlanadi, socket.io yo'li o'zgarmaydi, qolgani — proksi emas", () => {
    expect(upstreamPath("/api/orders")).toBe("/orders");
    expect(upstreamPath("/api/auth/refresh")).toBe("/auth/refresh");
    expect(upstreamPath("/api/")).toBe("/");
    expect(upstreamPath("/api")).toBe("/");
    expect(upstreamPath("/socket.io/")).toBe("/socket.io/");
    expect(upstreamPath("/apix/orders")).toBeNull();
    expect(upstreamPath("/orders/api/1")).toBeNull();
    expect(upstreamPath("/login")).toBeNull();
    expect(upstreamPath("/socket.io")).toBeNull();
  });

  it("API_ORIGIN — faqat https origin (yo'lsiz)", () => {
    expect(parseApiOrigin(`${API_ORIGIN}`)).toBe(API_ORIGIN);
    expect(parseApiOrigin(` ${API_ORIGIN}/ `)).toBe(API_ORIGIN);
    expect(parseApiOrigin("http://test-api.elchipochta.uz")).toBeNull();
    expect(parseApiOrigin(`${API_ORIGIN}/api`)).toBeNull();
    expect(parseApiOrigin("")).toBeNull();
    expect(parseApiOrigin(undefined)).toBeNull();
  });
});

describe("refresh cookie (Set-Cookie Path → /api…, Domain olib tashlanadi)", () => {
  it("⭐ login: Path=/auth → Path=/api/auth, qolgan atributlar (HttpOnly, Secure, SameSite=Lax, muddat) o'sha", () => {
    expect(rewriteSetCookie(LOGIN_COOKIE)).toBe(LOGIN_COOKIE.replace("Path=/auth", "Path=/api/auth"));
  });

  it("logout (clearCookie) — AYNI yo'l bilan o'chiriladi", () => {
    expect(rewriteSetCookie(CLEARED_COOKIE)).toBe(CLEARED_COOKIE.replace("Path=/auth", "Path=/api/auth"));
  });

  it("Path=/ → /api; Path yo'q — tegilmaydi (brauzer /api/... dan oladi); allaqachon /api ostida — ikki marta qo'shilmaydi", () => {
    expect(rewriteSetCookie("a=1; Path=/; HttpOnly")).toBe("a=1; Path=/api; HttpOnly");
    expect(rewriteSetCookie("a=1; HttpOnly")).toBe("a=1; HttpOnly");
    expect(rewriteSetCookie("a=1; path=/api/auth")).toBe("a=1; path=/api/auth");
    expect(rewriteSetCookie("a=1; Path=/api")).toBe("a=1; Path=/api");
    expect(rewriteSetCookie("a=1; Path=/apix")).toBe("a=1; Path=/api/apix");
  });

  it("Domain olib tashlanadi — cookie kabinet hostiga (host-only)", () => {
    expect(rewriteSetCookie("a=1; Domain=test-api.elchipochta.uz; Path=/auth; Secure")).toBe("a=1; Path=/api/auth; Secure");
  });
});

describe("mijoz IP'si (backend rate-limit CF-Connecting-IP ga tayanadi)", () => {
  it("⭐ x-real-ip va cf-connecting-ip — Cloudflare yozgan qiymat; mijozning soxta X-Real-IP si o'tmaydi", () => {
    const headers = upstreamHeaders(
      new Headers({ "cf-connecting-ip": "203.0.113.7", "x-real-ip": "1.2.3.4", host: "test-admin.elchipochta.uz" }),
    );
    expect(headers.get("x-real-ip")).toBe("203.0.113.7");
    expect(headers.get("cf-connecting-ip")).toBe("203.0.113.7");
    expect(headers.get("host")).toBeNull();
  });

  it("Cloudflare'siz (wrangler dev) — mijoz yozgan IP sarlavhalari umuman ketmaydi", () => {
    const headers = upstreamHeaders(new Headers({ "x-real-ip": "1.2.3.4", "cf-connecting-ip": "  " }));
    expect(headers.get("x-real-ip")).toBeNull();
    expect(headers.get("cf-connecting-ip")).toBeNull();
  });
});

describe("Worker fetch", () => {
  it("kirish moduli FAQAT default handler eksport qiladi (workerd har nomli eksportni entrypoint deb biladi)", async () => {
    expect(Object.keys(await import("../../worker"))).toEqual(["default"]);
    expect(typeof worker.fetch).toBe("function");
  });

  it("⭐ POST /api/orders?x=1 → API /orders?x=1: metod, tana, Authorization, Cookie, Origin o'sha; redirect manual", async () => {
    upstreamFetch.mockResolvedValue(Response.json({ ok: true }, { status: 201 }));
    const response = await worker.fetch(
      new Request(`${SITE}/api/orders?x=1&y=2`, {
        method: "POST",
        body: JSON.stringify({ phone: "+998900000000" }),
        headers: {
          authorization: "Bearer access.jwt",
          cookie: "refreshToken=refresh.jwt",
          origin: SITE,
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.7",
          "x-real-ip": "1.2.3.4",
        },
      }),
      env(),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
    const sent = sentRequest();
    expect(sent.url).toBe(`${API_ORIGIN}/orders?x=1&y=2`);
    expect(sent.method).toBe("POST");
    expect(await sent.text()).toBe(JSON.stringify({ phone: "+998900000000" }));
    expect(sent.headers.get("authorization")).toBe("Bearer access.jwt");
    expect(sent.headers.get("cookie")).toBe("refreshToken=refresh.jwt");
    expect(sent.headers.get("origin")).toBe(SITE);
    expect(sent.headers.get("x-real-ip")).toBe("203.0.113.7");
    expect(sent.redirect).toBe("manual");
    expect(assets.fetch).not.toHaveBeenCalled();
  });

  it("socket.io polling — o'sha yo'l va query bilan", async () => {
    upstreamFetch.mockResolvedValue(new Response("0{}", { headers: { "content-type": "text/plain" } }));
    await worker.fetch(new Request(`${SITE}/socket.io/?EIO=4&transport=polling&t=abc`), env());
    expect(sentRequest().url).toBe(`${API_ORIGIN}/socket.io/?EIO=4&transport=polling&t=abc`);
  });

  it("⭐ login javobidagi refresh cookie /api/auth ga moslanadi (bir nechta Set-Cookie ham), tana va status o'sha", async () => {
    const upstream = Response.json({ accessToken: "access.jwt" }, { status: 201 });
    upstream.headers.append("set-cookie", LOGIN_COOKIE);
    upstream.headers.append("set-cookie", "other=1; Path=/");
    upstreamFetch.mockResolvedValue(upstream);

    const response = await worker.fetch(new Request(`${SITE}/api/auth/login`, { method: "POST", body: "{}" }), env());
    expect(response.status).toBe(201);
    expect(response.headers.getSetCookie()).toEqual([
      LOGIN_COOKIE.replace("Path=/auth", "Path=/api/auth"),
      "other=1; Path=/api",
    ]);
    expect(await response.json()).toEqual({ accessToken: "access.jwt" });
  });

  it("cookie'siz javob — o'zgarmasdan (oqim, sarlavhalar)", async () => {
    const upstream = Response.json({ data: [] }, { headers: { "retry-after": "5" } });
    upstreamFetch.mockResolvedValue(upstream);
    const response = await worker.fetch(new Request(`${SITE}/api/orders`), env());
    expect(response).toBe(upstream);
  });

  it("⭐ API'ga ulanib bo'lmadi (tarmoq xatosi) — 502 JSON, «Network Error» emas", async () => {
    upstreamFetch.mockRejectedValue(new TypeError("Network connection lost."));
    const response = await worker.fetch(new Request(`${SITE}/api/orders`), env());
    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(
      expect.objectContaining({ statusCode: 502, code: UPSTREAM_UNAVAILABLE, message: expect.any(String) }),
    );
  });

  it("⭐ Cloudflare/tunnel HTML xato sahifasi (530 / 1033, 502) — o'sha status bilan JSON", async () => {
    for (const status of [502, 530]) {
      upstreamFetch.mockResolvedValueOnce(
        new Response("<html>Error 1033 Argo Tunnel error</html>", { status, headers: { "content-type": "text/html" } }),
      );
      const response = await worker.fetch(new Request(`${SITE}/api/orders`), env());
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual(expect.objectContaining({ statusCode: status, code: UPSTREAM_UNAVAILABLE }));
    }
  });

  it("backend'ning o'z JSON xatosi (503 SESSION_CHECK_UNAVAILABLE, 500) — tegilmaydi", async () => {
    const upstream = Response.json({ statusCode: 503, code: "SESSION_CHECK_UNAVAILABLE" }, { status: 503 });
    upstreamFetch.mockResolvedValue(upstream);
    expect(await worker.fetch(new Request(`${SITE}/api/auth/me`), env())).toBe(upstream);
  });

  it("WebSocket (101) javobi — o'zgarmasdan qaytadi", async () => {
    // Node `Response` 101 statusni qabul qilmaydi — Workers'dagi `fetch` javobining o'rnida oddiy obyekt.
    const upgraded = { status: 101, headers: new Headers() } as Response;
    expect(await proxiedResponse(upgraded)).toBe(upgraded);
  });

  it("⭐ xavfsizlik: `/api//<host>`, `/api/\\<host>`, `/api//` — begona origin'ga KETMAYDI, 400 BAD_PROXY_PATH", async () => {
    // Audit 2026-11-22 (critical): ilgari `/api//example.com/` begona sahifani kabinet origin'ida qaytarardi.
    for (const path of ["/api//evil.tld/x", "/api//evil.tld", "/api/\\evil.tld/x", "/api//"]) {
      upstreamFetch.mockClear();
      const response = await worker.fetch(new Request(`${SITE}${path}`), env());
      expect(response.status, path).toBe(400);
      expect(await response.json(), path).toEqual(expect.objectContaining({ code: BAD_PROXY_PATH }));
      expect(upstreamFetch, path).not.toHaveBeenCalled();
      expect(assets.fetch, path).not.toHaveBeenCalled();
    }
  });

  it("socket.io yo'li ham faqat API origin'iga (`/socket.io//…` — yo'l ichida, host emas)", async () => {
    upstreamFetch.mockResolvedValue(new Response("0{}"));
    await worker.fetch(new Request(`${SITE}/socket.io//evil.tld/?EIO=4`), env());
    expect(new URL(sentRequest().url).origin).toBe(API_ORIGIN);
  });

  it("upstreamTarget: natija har doim API origin'ida; kodlangan `%2F` yo'l ichida qoladi", () => {
    expect(upstreamTarget(API_ORIGIN, "/orders", "?x=1")?.href).toBe(`${API_ORIGIN}/orders?x=1`);
    expect(upstreamTarget(API_ORIGIN, "/", "")?.href).toBe(`${API_ORIGIN}/`);
    expect(upstreamTarget(API_ORIGIN, "/%2F%2Fevil.tld/x", "")?.origin).toBe(API_ORIGIN);
    expect(upstreamTarget(API_ORIGIN, "/orders//5", "")?.href).toBe(`${API_ORIGIN}/orders//5`);
    for (const bad of ["//evil.tld", "//evil.tld/x", "/\\evil.tld", "evil.tld", "", "///evil.tld"]) {
      expect(upstreamTarget(API_ORIGIN, bad, ""), bad).toBeNull();
    }
  });

  it("/api va /socket.io dan tashqari yo'l — statik fayllar (ASSETS), API'ga ketmaydi", async () => {
    const response = await worker.fetch(new Request(`${SITE}/orders/edit/5`), env());
    expect(assets.fetch).toHaveBeenCalledTimes(1);
    expect(upstreamFetch).not.toHaveBeenCalled();
    expect(response.headers.get("content-type")).toBe("text/html");
  });

  it("API_ORIGIN sozlanmagan — 500 (jim emas), API'ga hech narsa ketmaydi", async () => {
    const response = await worker.fetch(new Request(`${SITE}/api/orders`), env({ API_ORIGIN: undefined }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual(expect.objectContaining({ code: "PROXY_MISCONFIGURED" }));
    expect(upstreamFetch).not.toHaveBeenCalled();
  });
});
