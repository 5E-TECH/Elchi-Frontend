import type { Page } from "@playwright/test";
import { setupShellSession } from "./shellSession";

/**
 * EP-3 (Elchi Pochta #3) — `/profile` «Sessiyalar» e2e: soxta `GET auth/sessions` (faqat o'z faol sessiyalari) va
 * profil. Yozish so'rovlari taqiqlangan (`leaked`); `sessionRequests` — sessiyalar necha marta so'ralgani.
 */
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const SESSIONS = {
  active_count: 3,
  sessions: [
    {
      id: "s-2",
      device_name: "Kompyuter · Windows · Edge",
      device_id: null,
      user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0",
      ip: "84.54.70.12",
      logged_in_at: ago(2 * 24 * 60 + 90),
      last_seen_at: ago(7),
      expires_at: ago(-24 * 60),
      current: false,
    },
    {
      id: "s-1",
      device_name: "Telefon · Android · Chrome",
      device_id: null,
      user_agent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36",
      ip: "213.230.64.10",
      logged_in_at: ago(26 * 60),
      last_seen_at: ago(42),
      expires_at: ago(-24 * 60),
      current: true,
    },
    {
      id: "s-3",
      device_name: null,
      device_id: null,
      user_agent: null,
      ip: null,
      logged_in_at: ago(5 * 24 * 60),
      last_seen_at: ago(3 * 24 * 60),
      expires_at: ago(-60),
      current: false,
    },
  ],
};

export const openProfileWithSessions = async (page: Page, role = "courier") => {
  const state = { sessionRequests: 0 };
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/auth/sessions" && request.method() === "GET") state.sessionRequests += 1;
  });
  const { leaked } = await setupShellSession(
    page,
    role,
    "Ali Valiyev",
    { "auth/sessions": SESSIONS },
    { phone_number: "+998901234567", createdAt: "2026-01-14T09:00:00.000Z", updatedAt: "2026-10-02T09:00:00.000Z" },
  );
  await page.goto("/profile");
  return { leaked, state };
};
