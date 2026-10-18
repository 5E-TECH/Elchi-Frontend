import type { BrowserContext, Route, WebSocketRoute } from "@playwright/test";
import { FONT_HOSTS, serveFont } from "./fonts";

/**
 * Vizual snapshotlar — soxta API va tarmoq to'sig'i (docs/DESIGN_SYSTEM.md §12.5).
 *
 * - ilova manzili (`vite preview`, 127.0.0.1) — o'tadi;
 * - Manrope — ilova kabi Google Fonts'dan (`fonts.googleapis.com`, `fonts.gstatic.com`) — `fonts.ts` orqali
 *   (qayta urinish + ishchi keshi);
 * - `http://api.visual.test/*` — sahna jadvali (`"GET orders"`, `"GET orders/:id"`), OPTIONS → 204 + CORS;
 *   jadvalda yo'q GET → bo'sh, lekin to'g'ri shakldagi javob (`app-shot.mjs` kabi) + «unmocked» ro'yxati;
 *   jadvalda yo'q yozish (POST/PATCH/PUT/DELETE) → 403 va test yiqiladi;
 * - jonli kanal (`RealtimeSync` → socket.io `ws://api.visual.test/socket.io/`, namespace `/realtime`) — soxta
 *   socket.io server (`fakeRealtime`): har sahnada «ulangan» holat, hodisa yo'q (`context.route` WebSocket'ni
 *   ushlamaydi — aks holda DNS xatosi konsolga tushadi va qayta ulanish sikli tasodifiy vaqtda yuradi);
 * - qolgan hamma narsa (boshqa xost, prod API, boshqa WebSocket) — to'xtatiladi va test yiqiladi.
 */
export const API_ORIGIN = "http://api.visual.test";
const API_HOST = new URL(API_ORIGIN).host;

/**
 * Minimal socket.io (Engine.IO v4 / Socket.IO v5 protokoli) server: ochilish paketi, namespace CONNECT'ga javob,
 * ping'ga pong. `pingInterval`/`pingTimeout` katta — sahna davomida server ping yubormaydi va mijoz uzmaydi
 * (soat muzlatilgan, `Date.now()` asosidagi muddat ham tugamaydi). Hech qanday `notification:new` yuborilmaydi.
 */
export const fakeRealtime = (ws: Pick<WebSocketRoute, "send" | "onMessage">) => {
  ws.send(`0${JSON.stringify({ sid: "visual-eio", upgrades: [], pingInterval: 600_000, pingTimeout: 600_000, maxPayload: 1_000_000 })}`);
  ws.onMessage((message) => {
    const text = typeof message === "string" ? message : message.toString("utf8");
    if (text === "2") return ws.send("3");
    // CONNECT: `40` yoki `40/realtime,{"token":…}` → `40/realtime,{"sid":…}`.
    const connect = /^40(\/[^,]*)?/.exec(text);
    if (connect) ws.send(`40${connect[1] ? `${connect[1]},` : ""}${JSON.stringify({ sid: "visual-sio" })}`);
  });
};

export interface ApiRequest {
  method: string;
  /** Boshidagi `/` siz: `orders`, `orders/96`. */
  path: string;
  query: URLSearchParams;
  /** `:id` kabi segmentlar qiymati. */
  params: Record<string, string>;
  body: unknown;
}

const REPLY = Symbol("visual-reply");
/** Holat kodi bilan javob (`reply({ message }, 404)`). Oddiy qiymat — 200 JSON. */
export interface MockReply {
  readonly [REPLY]: true;
  readonly body: unknown;
  readonly status: number;
}
export const reply = (body: unknown, status = 200): MockReply => ({ [REPLY]: true, body, status });
const isReply = (value: unknown): value is MockReply => typeof value === "object" && value !== null && REPLY in value;

/** JSON javob tanasi (fixture yoki inline obyekt). */
export type ApiValue = Record<string, unknown> | unknown[] | string | number | boolean | null;
export type ApiHandler = (request: ApiRequest) => ApiValue | MockReply;
/** Kalit: `"<METHOD> <yo'l>"`, yo'lda `:nom` segmenti bo'lishi mumkin. Qiymat — JSON, `reply(…)` yoki funksiya. */
export type ApiTable = Record<string, ApiValue | MockReply | ApiHandler>;

export interface NetworkLog {
  /** Jadvalda yo'q GET'lar (bo'sh javob berildi) — sahna fixture'ini to'ldirish uchun. */
  unmocked: string[];
  /** Jadvalda yo'q yozish so'rovlari — test yiqiladi. */
  writes: string[];
  /** Ruxsatsiz manzillar (to'xtatildi) — test yiqiladi. */
  blocked: string[];
  /** Olinmagan Google Fonts so'rovlari (CSS yoki woff2 bo'lagi) — test yiqiladi (zaxira shrift jim chiziladi). */
  fontErrors: string[];
}

const ARRAYISH = /(^|\/)(regions?|districts?|markets?|couriers?|branches|categories|tariffs|sato|logists?|sources|partners|statuses|roles)(\/|$)/;
const ARRAY_LIST = /(^|\/)orders$/;
const EMPTY_META = { page: 1, limit: 10, total: 0, totalPages: 0 };

/** Jadvalda yo'q GET uchun bo'sh javob — `design/tools/app-shot.mjs` dagi shakllar. */
const emptyBody = (path: string) => {
  if (ARRAYISH.test(path)) return { statusCode: 200, data: [] };
  if (ARRAY_LIST.test(path)) return { statusCode: 200, data: [], meta: EMPTY_META, total: 0 };
  return { statusCode: 200, data: { items: [], data: [], meta: EMPTY_META, total: 0 }, total: 0 };
};

/** 1×1 shaffof PNG — jadvalda yo'q rasm so'rovi uchun (singan rasm ikonkasi chizilmasin). */
const BLANK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

type Compiled = { method: string; segments: string[]; value: ApiTable[string] };

const compile = (table: ApiTable): Compiled[] =>
  Object.entries(table).map(([key, value]) => {
    const match = /^(GET|POST|PATCH|PUT|DELETE) (\S+)$/.exec(key);
    if (!match) throw new Error(`Vizual mock kaliti noto'g'ri: «${key}» (kerak: "GET orders" yoki "GET orders/:id")`);
    return { method: match[1], segments: match[2].replace(/^\/+/, "").split("/"), value };
  });

const matchEntry = (entries: Compiled[], method: string, path: string) => {
  const parts = path.split("/");
  // Aniq kalit birinchi, keyin `:nom` segmentli kalitlar (yozilish tartibida).
  const exact = entries.find((entry) => entry.method === method && entry.segments.join("/") === path);
  if (exact) return { entry: exact, params: {} };
  for (const entry of entries) {
    if (entry.method !== method || entry.segments.length !== parts.length) continue;
    const params: Record<string, string> = {};
    const ok = entry.segments.every((segment, index) => {
      if (segment.startsWith(":")) {
        params[segment.slice(1)] = decodeURIComponent(parts[index]);
        return true;
      }
      return segment === parts[index];
    });
    if (ok) return { entry, params };
  }
  return null;
};

const parseBody = (raw: string | null) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
};

/** Kontekstga tarmoq to'sig'ini o'rnatadi. Qaytgan `log` test oxirida tekshiriladi. */
export const installMockApi = async (
  context: BrowserContext,
  { appOrigin, table }: { appOrigin: string; table: ApiTable },
): Promise<NetworkLog> => {
  const entries = compile(table);
  const log: NetworkLog = { unmocked: [], writes: [], blocked: [], fontErrors: [] };
  const cors = {
    "access-control-allow-origin": appOrigin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  };
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

  await context.routeWebSocket(
    () => true,
    (ws) => {
      const url = new URL(ws.url());
      if (url.host === API_HOST && url.pathname.startsWith("/socket.io")) return fakeRealtime(ws);
      log.blocked.push(`WS ${url.origin}${url.pathname}`);
      return ws.close({ code: 1008, reason: "visual: tashqi WebSocket taqiqlangan" });
    },
  );
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === appOrigin) return route.continue();
    if (url.protocol === "https:" && FONT_HOSTS.has(url.hostname)) {
      if (!(await serveFont(route))) log.fontErrors.push(`${url.hostname}${url.pathname}`);
      return;
    }
    if (url.origin !== API_ORIGIN) {
      log.blocked.push(`${request.method()} ${url.origin}${url.pathname}`);
      return route.abort("blockedbyclient");
    }

    const method = request.method();
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\/+/, "");
    const found = matchEntry(entries, method, path);
    if (!found) {
      if (method !== "GET") {
        log.writes.push(`${method} ${path}`);
        return json(route, { statusCode: 403, message: "visual: yozish taqiqlangan" }, 403);
      }
      log.unmocked.push(`GET ${path}${url.search}`);
      if (request.resourceType() === "image") {
        return route.fulfill({ status: 200, contentType: "image/png", headers: cors, body: BLANK_PNG });
      }
      return json(route, emptyBody(path));
    }
    const { value } = found.entry;
    const result =
      typeof value === "function"
        ? (value as ApiHandler)({ method, path, query: url.searchParams, params: found.params, body: parseBody(request.postData()) })
        : value;
    if (isReply(result)) return json(route, result.body, result.status);
    return json(route, result);
  });
  return log;
};
