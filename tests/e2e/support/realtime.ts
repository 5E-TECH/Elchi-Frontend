import type { Page, Route, WebSocketRoute } from "@playwright/test";

/**
 * Jonli bildirishnomalar (uRkw6lk0) — soxta backend va soxta socket.io serveri (Engine.IO v4 / Socket.IO v5
 * protokoli, `page.routeWebSocket`). Kontrakt: FRONTEND_CHANGELOG 2026-10-14 (m9BOlEbE) — namespace `/realtime`,
 * `auth: { token }`, hodisa `notification:new` (to'liq inbox qatori). Serverga hech narsa ketmaydi.
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

export type InboxRow = { id: string; title: string; body: string | null; category: string; link: string | null };

/** Gateway access token shakli (imzo tekshirilmaydi — ilova faqat payload'ni o'qiydi): `{ sub, roles, sid }`. */
export const e2eAccessToken = (claims: { sub?: string; role?: string; sid?: string } = {}) => {
  const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const { sub = "1", role = "superadmin", sid } = claims;
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub, roles: [role], ...(sid ? { sid } : {}) })}.e2e`;
};

export type MockRealtimeOptions = {
  /** Access token (sukut — `e2e.local.token`, `sid` siz). */
  token?: string;
  /** Profil roli (sukut — superadmin). */
  role?: string;
};

export const mockRealtime = async (page: Page, options: MockRealtimeOptions = {}) => {
  const token = options.token ?? "e2e.local.token";
  const role = options.role ?? "superadmin";
  const state = {
    unread: 2,
    inbox: [{ id: "n-1", title: "Kun yakuni eslatmasi", body: "Kassani yoping", category: "finance", link: "/cash-box" }] as InboxRow[],
    unreadRequests: 0,
    sockets: [] as WebSocketRoute[],
    socketUrls: [] as string[],
    auth: [] as unknown[],
    closed: 0,
    /** `POST auth/logout` / `POST auth/refresh` so'rovlari soni. */
    logoutRequests: 0,
    refreshRequests: 0,
    /** Yopilgan sessiya: keyingi ulanish rad etiladi (`error` SESSION_REVOKED + server uzadi), HTTP — 401. */
    revoked: false,
    /** Faqat socket ulanishi rad etiladi (HTTP javob beraveradi) — jonli kanal yo'lini alohida sinash uchun. */
    socketRevoked: false,
  };

  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/logout") state.logoutRequests += 1;
    if (path === "auth/refresh") state.refreshRequests += 1;
    if (state.revoked && path !== "auth/logout") {
      const message = path === "auth/refresh" ? "Invalid refresh token" : "Session revoked";
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        headers: cors,
        body: JSON.stringify({ statusCode: 401, message }),
      });
    }
    if (path === "auth/my-profile") {
      return reply(route, { statusCode: 200, data: { id: "1", role, name: "E2E", status: "active" } });
    }
    if (path === "notifications/inbox/unread-count") {
      state.unreadRequests += 1;
      return reply(route, { statusCode: 200, data: { unread: state.unread } });
    }
    if (path === "notifications/inbox") {
      const items = state.inbox.map((row, index) => ({
        ...row,
        type: `${row.category}.manual`,
        priority: "normal",
        is_read: index >= state.unread,
        created_at: "2026-10-17T10:00:00.000Z",
      }));
      return reply(route, {
        statusCode: 200,
        data: { items, unread: state.unread, meta: { page: 1, limit: 20, total: items.length, totalPages: 1 } },
      });
    }
    return reply(route, { statusCode: 200, data: [] });
  });

  // Soxta socket.io serveri: ochilish paketi → namespace ulanishi (`40/realtime,{token}`) → tasdiq.
  await page.routeWebSocket(/\/socket\.io\//, (ws) => {
    state.sockets.push(ws);
    state.socketUrls.push(ws.url());
    ws.onClose(() => {
      state.closed += 1;
    });
    ws.send(`0${JSON.stringify({ sid: `e2e-${state.sockets.length}`, upgrades: [], pingInterval: 25000, pingTimeout: 60000, maxPayload: 1000000 })}`);
    ws.onMessage((message) => {
      const text = String(message);
      if (text.startsWith("40/realtime")) {
        state.auth.push(JSON.parse(text.slice(text.indexOf("{"))));
        ws.send(`40/realtime,${JSON.stringify({ sid: `ns-${state.sockets.length}` })}`);
        if (state.revoked || state.socketRevoked) {
          // Backend (RealtimeGateway.handleConnection): yopilgan sessiya — `error` hodisasi, keyin server uzadi.
          ws.send(`42/realtime,${JSON.stringify(["error", { message: "Session revoked", code: "SESSION_REVOKED" }])}`);
          ws.send("41/realtime,");
          return;
        }
        ws.send(`42/realtime,${JSON.stringify(["connected", { user_id: "1", roles: [role] }])}`);
      }
    });
  });

  await page.addInitScript((accessToken) => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", accessToken);
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  }, token);

  /** Backend dispatch qilgandek: qatorni inboxga qo'shadi va socket orqali `notification:new` yuboradi. */
  const dispatch = (row: InboxRow) => {
    state.inbox = [row, ...state.inbox];
    state.unread += 1;
    state.sockets.at(-1)!.send(`42/realtime,${JSON.stringify(["notification:new", { ...row, priority: "normal", is_read: false }])}`);
  };

  /**
   * Backend sessiyani yopgandek (Elchi Pochta #3, `SessionRevocationService.kickSessions`): oxirgi socketga
   * `auth:session_revoked` `{ session_id, reason }`, 250 ms dan keyin server uzadi («io server disconnect»).
   * `revoke: true` — sessiya haqiqatan yopilgan: keyingi HTTP so'rovlar 401, qayta ulanish rad etiladi.
   */
  const kick = (payload: { session_id: string; reason: string }, { revoke = true } = {}) => {
    if (revoke) state.revoked = true;
    const ws = state.sockets.at(-1)!;
    ws.send(`42/realtime,${JSON.stringify(["auth:session_revoked", payload])}`);
    if (revoke) {
      setTimeout(() => {
        try {
          ws.send("41/realtime,");
        } catch {
          // Mijoz socketni allaqachon o'zi yopgan.
        }
      }, 250);
    }
  };

  return { state, dispatch, kick };
};
