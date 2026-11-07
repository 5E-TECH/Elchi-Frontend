import type { BrowserContext, Route, WebSocketRoute } from "@playwright/test";
import { describe, expect, it } from "vitest";
import { API_ORIGIN, installMockApi, reply, type ApiTable } from "./mockApi";

/**
 * Vizual snapshotlar tarmoq to'sig'i: faqat ilova va soxta API (Manrope — ilovaning o'zidan); yozish va boshqa xost — qayd
 * qilinadi (test yiqiladi). Haqiqiy brauzersiz: kontekst va route soxta.
 */
const APP = "http://127.0.0.1:4178";

type Handled = { continued?: boolean; aborted?: string; fulfilled?: { status?: number; body?: string | Buffer; contentType?: string } };

const setup = async (table: ApiTable = {}, fetchImpl?: () => Promise<{ status: number; body: string }>) => {
  let handler: ((route: Route) => Promise<unknown>) | null = null;
  let wsHandler: ((ws: WebSocketRoute) => unknown) | null = null;
  const context = {
    route: async (_pattern: string, fn: (route: Route) => Promise<unknown>) => {
      handler = fn;
    },
    routeWebSocket: async (_pattern: unknown, fn: (ws: WebSocketRoute) => unknown) => {
      wsHandler = fn;
    },
  } as unknown as BrowserContext;
  const log = await installMockApi(context, { appOrigin: APP, table });
  const send = async (url: string, { method = "GET", resourceType = "fetch", postData = null as string | null } = {}) => {
    const result: Handled = {};
    const route = {
      request: () => ({
        url: () => url,
        method: () => method,
        resourceType: () => resourceType,
        postData: () => postData,
        headers: () => ({ "user-agent": "vitest" }),
      }),
      continue: async () => {
        result.continued = true;
      },
      abort: async (code: string) => {
        result.aborted = code;
      },
      fulfill: async (options: Handled["fulfilled"]) => {
        result.fulfilled = options;
      },
      fetch: async () => {
        if (!fetchImpl) throw new Error("fetch kutilmagan");
        const response = await fetchImpl();
        return {
          status: () => response.status,
          headers: () => ({ "content-type": "text/css", "content-encoding": "gzip" }),
          body: async () => Buffer.from(response.body),
        };
      },
    } as unknown as Route;
    await handler!(route);
    return result;
  };
  const json = (handled: Handled) => JSON.parse(String(handled.fulfilled?.body)) as unknown;
  /** Soxta WebSocket: serverdan yuborilganlar `sent`, `message()` — sahifadan kelgan xabar. */
  const socket = (url: string) => {
    const sent: string[] = [];
    let onMessage: ((message: string) => unknown) | null = null;
    let closed: { code?: number } | null = null;
    wsHandler!({
      url: () => url,
      send: (message: string) => sent.push(message),
      onMessage: (fn: (message: string) => unknown) => {
        onMessage = fn;
      },
      close: async (options: { code?: number }) => {
        closed = options;
      },
    } as unknown as WebSocketRoute);
    return { sent, message: (text: string) => onMessage?.(text), closed: () => closed };
  };
  return { log, send, json, socket };
};

describe("vizual tarmoq to'sig'i (mockApi)", () => {
  it("ilova manzili o'tadi, boshqa har xost (prod API ham) to'xtatiladi va qayd qilinadi", async () => {
    const { log, send } = await setup();
    expect((await send(`${APP}/assets/index.js`)).continued).toBe(true);
    expect((await send("https://api.elchipochta.uz/orders")).aborted).toBe("blockedbyclient");
    expect((await send(`${APP}/assets/Manrope-wght-latin-x.woff2`, { resourceType: "font" })).continued).toBe(true);
    // Google Fonts endi tashqi xost: ilova uni so'ramaydi — so'rasa, to'xtatiladi va test yiqiladi.
    expect((await send("https://fonts.googleapis.com/css2?family=Manrope:wght@400..800&display=swap", { resourceType: "stylesheet" })).aborted).toBe("blockedbyclient");
    expect((await send("https://fonts.gstatic.com/s/manrope/v23/xn7gYHE41ni1AdIRggexSg.woff2", { resourceType: "font" })).aborted).toBe("blockedbyclient");
    expect(log.blocked).toEqual([
      "GET https://api.elchipochta.uz/orders",
      "GET https://fonts.googleapis.com/css2",
      "GET https://fonts.gstatic.com/s/manrope/v23/xn7gYHE41ni1AdIRggexSg.woff2",
    ]);
  });

  it("jadval: aniq kalit `:id` dan ustun, parametr va `reply(status)` ishlaydi; OPTIONS → 204", async () => {
    const { send, json, log } = await setup({
      "GET orders/:id": ({ params }) => ({ data: { id: params.id } }),
      "GET orders/96": { data: { id: "aniq" } },
      "GET orders/97": reply({ message: "topilmadi" }, 404),
    });
    expect(json(await send(`${API_ORIGIN}/orders/96`))).toEqual({ data: { id: "aniq" } });
    expect(json(await send(`${API_ORIGIN}/orders/12?x=1`))).toEqual({ data: { id: "12" } });
    const missing = await send(`${API_ORIGIN}/orders/97`);
    expect(missing.fulfilled?.status).toBe(404);
    expect((await send(`${API_ORIGIN}/orders/96`, { method: "OPTIONS" })).fulfilled?.status).toBe(204);
    expect(log).toEqual({ unmocked: [], writes: [], blocked: [] });
  });

  it("⭐ jadvalda yo'q GET — bo'sh shakl + «unmocked»; jadvalda yo'q yozish — 403 va qayd", async () => {
    const { send, json, log } = await setup({ "POST orders/sell/:id": { statusCode: 200 } });
    expect(json(await send(`${API_ORIGIN}/markets?limit=100`))).toEqual({ statusCode: 200, data: [] });
    expect(json(await send(`${API_ORIGIN}/orders`))).toMatchObject({ statusCode: 200, data: [], total: 0 });
    expect((await send(`${API_ORIGIN}/orders/sell/1`, { method: "POST", postData: "{}" })).fulfilled?.status).toBe(200);
    const write = await send(`${API_ORIGIN}/orders/cancel/1`, { method: "POST", postData: '{"reason":"x"}' });
    expect(write.fulfilled?.status).toBe(403);
    expect(log.unmocked).toEqual(["GET markets?limit=100", "GET orders"]);
    expect(log.writes).toEqual(["POST orders/cancel/1"]);
  });

  it("⭐ jonli kanal: soxta socket.io «/realtime» ga ulaydi; boshqa WebSocket yopiladi va qayd qilinadi", async () => {
    const { socket, log } = await setup();
    const realtime = socket("ws://api.visual.test/socket.io/?EIO=4&transport=websocket");
    expect(realtime.sent[0]).toMatch(/^0\{"sid":"visual-eio","upgrades":\[\],"pingInterval":600000,/);
    realtime.message('40/realtime,{"token":"visual.local.token"}');
    expect(realtime.sent[1]).toBe('40/realtime,{"sid":"visual-sio"}');
    realtime.message("2");
    expect(realtime.sent[2]).toBe("3");
    expect(realtime.closed()).toBeNull();
    expect(log.blocked).toEqual([]);

    const prod = socket("wss://api.elchipochta.uz/socket.io/?EIO=4&transport=websocket");
    expect(prod.closed()).toMatchObject({ code: 1008 });
    expect(prod.sent).toEqual([]);
    expect(log.blocked).toEqual(["WS wss://api.elchipochta.uz/socket.io/"]);
  });

  it("noto'g'ri jadval kaliti darhol xato beradi", async () => {
    await expect(setup({ "orders/96": {} })).rejects.toThrow(/mock kaliti noto'g'ri/);
  });
});
