import type { Page, Route } from "@playwright/test";

/**
 * TG-A (ysBqD9Nx) — o'z profilida shaxsiy Telegram'ni ulash/uzish e2e: soxta backend.
 * `POST users/me/telegram/link-code` dan keyin `GET auth/my-profile` `linkAfterPolls` marta so'ralgach bot ulagan
 * bo'ladi (`telegram_linked: true`); `DELETE users/me/telegram` — uzadi.
 */
const ORIGIN = "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

export const TG_DEEP_LINK = "https://t.me/elchi_test_bot?start=Kod123";
export const TG_USERNAME = "ali_kuryer";

export type ProfileTelegramOptions = {
  linked?: boolean;
  /** Havola muddati, ms (sukut 10 daqiqa). */
  expiresInMs?: number;
  /** `null` — bot nomi sozlanmagan (buyruq rejimi). */
  deepLink?: string | null;
  /** Kod olingach nechanchi profil so'rovida bot ulagan bo'ladi (`null` — ulamaydi). */
  linkAfterPolls?: number | null;
  /** Server sozlamasidagi mavzu (foydalanuvchi o'zi tanlagan — `themeChosen`). */
  theme?: "light" | "dark";
};

export const mockProfileTelegramApi = async (
  page: Page,
  { linked = false, expiresInMs = 10 * 60_000, deepLink = TG_DEEP_LINK, linkAfterPolls = null, theme }: ProfileTelegramOptions = {},
) => {
  const state = { linked, codeRequests: 0, unlinkRequests: 0, pollsAfterCode: 0 };
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");

    if (path === "auth/my-profile") {
      if (state.codeRequests > 0 && !state.linked && linkAfterPolls != null) {
        state.pollsAfterCode += 1;
        if (state.pollsAfterCode > linkAfterPolls) state.linked = true;
      }
      return reply(
        route,
        wrap({
          id: "7",
          role: "courier",
          name: "Ali Valiyev",
          username: "ali",
          phone_number: "+998901234567",
          status: "active",
          salary: 0,
          createdAt: "2026-01-14T09:00:00.000Z",
          updatedAt: "2026-10-02T09:00:00.000Z",
          telegram_linked: state.linked,
          telegram_username: state.linked ? TG_USERNAME : null,
          telegram_linked_at: state.linked ? "2026-10-12T09:30:00.000Z" : null,
          ...(theme ? { settings: { appearance: { theme, themeChosen: true } } } : {}),
        }),
      );
    }
    if (path === "users/me/telegram/link-code" && request.method() === "POST") {
      state.codeRequests += 1;
      state.pollsAfterCode = 0;
      return reply(
        route,
        wrap({
          token: `Kod${state.codeRequests}`,
          purpose: "user",
          expires_at: new Date(Date.now() + expiresInMs).toISOString(),
          deep_link: deepLink,
          command: "/start Kod123",
        }),
      );
    }
    if (path === "users/me/telegram" && request.method() === "DELETE") {
      state.unlinkRequests += 1;
      state.linked = false;
      return reply(route, wrap({ unlinked: true }));
    }
    if (request.method() !== "GET") return reply(route, { message: "e2e: kutilmagan yozish" }, 403);
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
  return state;
};
