/**
 * Bir domenli API (same-origin) — Worker proksi.
 *
 * Nega: kabinet (`*-admin.elchipochta.uz`) API'ga (`*-api.elchipochta.uz`) boshqa domendan `Authorization` sarlavhasi
 * bilan murojaat qilganda brauzer HAR YANGI URL uchun alohida CORS preflight (`OPTIONS`) yuboradi — har qidiruv,
 * sahifa, buyurtma ID ikki borib-kelish. Cloudflare/tunnel xato sahifalari (502, 530/1033) esa CORS sarlavhasisiz
 * keladi va JS'da «Network Error» bo'lib ko'rinadi. API kabinet domeni ostida (`/api/*`) bo'lsa — preflight yo'q,
 * xato sahifasining statusi JS'ga ko'rinadi.
 *
 * Qanday: `wrangler.jsonc` → `assets.run_worker_first` FAQAT `/api/*` va `/socket.io/*` ni Worker'ga beradi
 * (`worker/index.ts` — kirish, faqat `default`; mantiq shu faylda);
 * qolgan hamma narsa (SPA, assets) avvalgidek to'g'ridan-to'g'ri statik fayllardan (Worker chaqirilmaydi).
 *   - `/api/<yo'l>`      → `${API_ORIGIN}/<yo'l>` (prefiks olib tashlanadi; backend marshrutlari o'zgarmaydi);
 *   - `/socket.io/<…>`   → `${API_ORIGIN}/socket.io/<…>` (socket.io `/realtime` namespace, WebSocket + polling).
 *
 * Proksi qoidalari (har biri `src/test/apiProxyWorker.test.ts` da):
 *   1. Mijoz IP'si. Backend rate-limit va audit IP'ni FAQAT `CF-Connecting-IP` dan oladi (Elchi-Backend
 *      `client-ip-throttler.guard.ts`). Bir zonadagi (elchipochta.uz) Worker subrequest'ida Cloudflare bu qiymatni
 *      `x-real-ip` dan oladi, `x-real-ip` ni esa skript o'zgartira oladi — shuning uchun ikkalasi ham kiruvchi
 *      so'rovning Cloudflare yozgan `CF-Connecting-IP` qiymatiga MAJBURAN tenglanadi (mijoz yuborgan `X-Real-IP`
 *      o'tib ketib, login chegarasini aylanib o'tmasin). `API_ORIGIN` BOSHQA zonada bo'lsa Cloudflare barcha
 *      so'rovlarga bitta `2a06:98c0:3600::103` yozadi (hamma bitta rate-limit hisoblagichida) — shuning uchun
 *      `API_ORIGIN` faqat kabinet bilan bir zonada (test: wrangler.jsonc).
 *   2. Refresh cookie. Backend `Path=/auth` beradi; brauzer uni `/api/auth/refresh` ga yubormasdi. nginx
 *      `proxy_cookie_path` kabi `Path` ga `/api` prefiksi qo'shiladi (`/auth` → `/api/auth`), `Domain` olib
 *      tashlanadi (cookie kabinet hostiga bog'lanadi — host-only). Backend o'zgarmaydi: to'g'ridan-to'g'ri
 *      `*-api.elchipochta.uz` mijozlari ham avvalgidek ishlaydi (orqaga qaytish — faqat frontend deploy'i).
 *   3. Xato sahifalari. API javob bermasa (tarmoq xatosi) yoki Cloudflare/tunnel 5xx HTML sahifasi qaytarsa —
 *      o'sha status bilan JSON (`code: "UPSTREAM_UNAVAILABLE"`): ilova «Internet aloqasi yo'q» emas, server
 *      xatosini ko'radi. Backend'ning o'z JSON xatolari tegilmaydi.
 *   4. Qolgani o'zgarmaydi: metod, tana (oqim — fayl yuklash, SSE), `Authorization`, `Cookie`, `Origin` (backend
 *      CORS / socket.io `allowRequest` uni `CORS_ORIGINS` bo'yicha tekshiradi), 3xx (`redirect: "manual"`),
 *      WebSocket 101 javobi.
 */

export interface Env {
  /** `wrangler.jsonc` → `assets.binding` (zaxira: `run_worker_first` dan tashqari yo'l kelib qolsa). */
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** API origin'i (`https://test-api.elchipochta.uz`) — `wrangler.jsonc` → `env.<muhit>.vars.API_ORIGIN`. */
  API_ORIGIN?: string;
}

/** Kabinetdagi API prefiksi — `.env.<muhit>` dagi `VITE_BASE_URL=/api/` bilan bir xil. */
export const API_PREFIX = "/api";
/** socket.io sukut yo'li — `src/shared/lib/realtime.ts` (`realtimeUrl`) shu origin'ga ulanadi. */
export const SOCKET_IO_PREFIX = "/socket.io/";

/** Brauzerga qaytariladigan xato kodi — API (yoki tunnel) javob bermadi. */
export const UPSTREAM_UNAVAILABLE = "UPSTREAM_UNAVAILABLE";

const UPSTREAM_UNAVAILABLE_MESSAGE = "Server vaqtincha javob bermayapti. Birozdan keyin qayta urinib ko'ring.";

/** Proksi qilinmaydigan (begona origin'ga olib chiqadigan) yo'l — 400. */
export const BAD_PROXY_PATH = "BAD_PROXY_PATH";

/**
 * API target — HAR DOIM `origin` ustida quriladi: yo'l URL sifatida emas, faqat `pathname` sifatida beriladi.
 *
 * ⚠️ Xavfsizlik (audit 2026-11-22, critical): ilgari `new URL(path + search, origin)` edi — `/api//evil.tld/x`
 * dan `//evil.tld/x` qolib, u protokolga nisbiy URL bo'lib o'qilardi va Worker BEGONA saytni kabinet origin'ida
 * (refresh cookie `/api/auth` shu origin'da) qaytarardi. `/api/\evil.tld` ham shunday (`\` — URL parser uchun `/`).
 * Endi: `//` bilan boshlanadigan yoki `\` bor yo'l rad etiladi, natija origin'i `origin` ga teng bo'lishi shart.
 * `null` — proksi qilinmaydi (chaqiruvchi 400 qaytaradi).
 */
export const upstreamTarget = (origin: string, path: string, search: string): URL | null => {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return null;
  try {
    const target = new URL(origin);
    target.pathname = path;
    target.search = search;
    return target.origin === origin ? target : null;
  } catch {
    return null;
  }
};

/** Kabinet yo'li → API yo'li (`null` — proksi qilinmaydi). `/apix` kabi yo'llar `/api` emas. */
export const upstreamPath = (pathname: string): string | null => {
  if (pathname === API_PREFIX) return "/";
  if (pathname.startsWith(`${API_PREFIX}/`)) return pathname.slice(API_PREFIX.length);
  if (pathname.startsWith(SOCKET_IO_PREFIX)) return pathname;
  return null;
};

/**
 * `Set-Cookie` ni kabinet origin'iga moslash (nginx `proxy_cookie_path` + `proxy_cookie_domain`): `Path` ga `/api`
 * prefiksi (`/` → `/api`, `/auth` → `/api/auth`; allaqachon `/api` ostida bo'lsa — tegilmaydi), `Domain` olib
 * tashlanadi. `Path` yo'q cookie'ga tegilmaydi — brauzer uni `/api/...` so'rov yo'lidan o'zi oladi.
 */
export const rewriteSetCookie = (cookie: string): string =>
  cookie
    .split(";")
    .flatMap((part, index) => {
      if (index === 0) return [part];
      const attribute = part.trim();
      if (/^domain\s*=/i.test(attribute)) return [];
      const path = /^path\s*=\s*(\/\S*)$/i.exec(attribute)?.[1];
      if (!path || path === API_PREFIX || path.startsWith(`${API_PREFIX}/`)) return [part];
      return [` Path=${API_PREFIX}${path === "/" ? "" : path}`];
    })
    .join(";");

const jsonError = (status: number, message: string, code: string): Response =>
  new Response(JSON.stringify({ statusCode: status, message, code }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const upstreamUnavailable = (status: number) => jsonError(status, UPSTREAM_UNAVAILABLE_MESSAGE, UPSTREAM_UNAVAILABLE);

/** `API_ORIGIN` — faqat `https://host` (yo'lsiz). Noto'g'ri bo'lsa `null` (500 — sozlama xatosi, jim emas). */
export const parseApiOrigin = (raw: string | undefined): string | null => {
  try {
    const url = new URL(String(raw ?? "").trim());
    if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
};

/** API'ga ketadigan sarlavhalar: mijoz IP'si — faqat Cloudflare yozgan qiymatdan (1-qoida). */
export const upstreamHeaders = (incoming: Headers): Headers => {
  const headers = new Headers(incoming);
  // Host — URL'dan (API hosti); kabinet hosti ketmasin.
  headers.delete("host");
  const clientIp = incoming.get("cf-connecting-ip")?.trim();
  if (clientIp) {
    headers.set("x-real-ip", clientIp);
    headers.set("cf-connecting-ip", clientIp);
  } else {
    // Cloudflare'siz (`wrangler dev`) — mijoz yozgan qiymat ishonchli IP bo'lib o'tmasin.
    headers.delete("x-real-ip");
    headers.delete("cf-connecting-ip");
  }
  return headers;
};

const isJson = (response: Response) => /\bjson\b/i.test(response.headers.get("content-type") ?? "");

/** API javobi → brauzer javobi (2- va 3-qoida). WebSocket (101) — o'zgarmasdan. */
export const proxiedResponse = async (upstream: Response): Promise<Response> => {
  if (upstream.status === 101) return upstream;
  if (upstream.status >= 500 && !isJson(upstream)) {
    await upstream.body?.cancel();
    return upstreamUnavailable(upstream.status);
  }
  const cookies = upstream.headers.getSetCookie();
  if (cookies.length === 0) return upstream;
  const response = new Response(upstream.body, upstream);
  response.headers.delete("set-cookie");
  for (const cookie of cookies) response.headers.append("set-cookie", rewriteSetCookie(cookie));
  return response;
};

/** `/api/*` va `/socket.io/*` → API, qolgani → statik fayllar (`ASSETS`). */
export const handleRequest = async (request: Request, env: Env): Promise<Response> => {
  const url = new URL(request.url);
  const path = upstreamPath(url.pathname);
  if (path === null) return env.ASSETS.fetch(request);

  const origin = parseApiOrigin(env.API_ORIGIN);
  if (!origin) return jsonError(500, "API_ORIGIN sozlanmagan (wrangler.jsonc → vars)", "PROXY_MISCONFIGURED");

  const target = upstreamTarget(origin, path, url.search);
  if (!target) return jsonError(400, "Noto'g'ri API yo'li", BAD_PROXY_PATH);
  // Aniq init (metod, sarlavhalar, tana — oqim): `new Request(url, request)` ning getter'lardan o'qishiga
  // tayanilmaydi. `duplex` — Node/undici oqim tanasi uchun talab qiladi, Workers e'tiborsiz qoldiradi.
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers: upstreamHeaders(request.headers),
    body: request.body,
    redirect: "manual",
  };
  if (request.body) init.duplex = "half";
  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return upstreamUnavailable(502);
  }
  return proxiedResponse(upstream);
};
