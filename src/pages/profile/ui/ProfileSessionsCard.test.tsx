import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { focusManager } from "@tanstack/react-query";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api: { get: mocks.get } }));

import { ProfileSessionsCard } from "./ProfileSessionsCard";
import ProfilePage from "./ProfilePage";

/**
 * «Sessiyalar» (Elchi Pochta #3, `/profile`): faqat o'z hisobining faol sessiyalari — soni, qurilma, IP,
 * «Kirgan vaqti», «Oxirgi faollik» (nisbiy + sana), «Shu qurilma». Sana va vaqt — Toshkent vaqtida
 * (foydalanuvchilar Toshkentda, formatlovchi brauzer vaqtini oladi — testda mintaqa qat'iy `Asia/Tashkent`).
 */

/** Ilova tsconfig'ida Node tiplari yo'q; testda faqat `process.env.TZ` kerak. */
declare const process: { env: Record<string, string | undefined> };

const originalTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "Asia/Tashkent";
});
afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000 - 1_000).toISOString();

type Row = Record<string, unknown>;
const session = (over: Row = {}): Row => ({
  id: "s-1",
  device_name: "Kompyuter · Linux · Chrome",
  device_id: null,
  user_agent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36",
  ip: "213.230.64.10",
  // 04:12 UTC = 09:12 Toshkent.
  logged_in_at: "2026-10-18T04:12:00.000Z",
  last_seen_at: minutesAgo(12),
  expires_at: "2026-10-23T09:00:00.000Z",
  current: false,
  ...over,
});

let sessionsResponse: () => Promise<unknown>;
const reply = (data: { active_count: number; sessions: Row[] }) => () =>
  Promise.resolve({ data: { statusCode: 200, message: "success", data } });

const sessionCalls = () => mocks.get.mock.calls.filter(([url]) => url === "auth/sessions").length;

beforeEach(() => {
  sessionsResponse = reply({ active_count: 0, sessions: [] });
  mocks.get.mockReset().mockImplementation((url: string) => {
    if (url === "auth/sessions") return sessionsResponse();
    if (url === "auth/my-profile") {
      return Promise.resolve({
        data: { statusCode: 200, data: { id: "7", name: "Ali Valiyev", role: "courier", status: "active" } },
      });
    }
    return Promise.resolve({ data: { data: {} } });
  });
});

const card = () => screen.getByRole("region", { name: "Sessiyalar" });
const rows = async () => {
  const list = await screen.findByRole("list", { name: "Faol sessiyalar ro'yxati" });
  return within(list).getAllByRole("listitem");
};

describe("Sessiyalar — ro'yxat", () => {
  it("faol sessiyalar soni, qurilmalar, IP; «Shu qurilma» tepada", async () => {
    sessionsResponse = reply({
      active_count: 2,
      sessions: [
        session({ id: "a", device_name: "Kompyuter · Windows · Edge", ip: "84.54.70.2" }),
        session({ id: "b", device_name: "Telefon · Android · Chrome", current: true }),
      ],
    });
    renderWithProviders(<ProfileSessionsCard />);

    const [first, second] = await rows();
    expect(within(card()).getByText("2 ta faol")).toBeInTheDocument();
    expect(within(first).getByRole("heading", { level: 3, name: "Telefon · Android · Chrome" })).toBeInTheDocument();
    expect(within(first).getByText("Shu qurilma")).toBeInTheDocument();
    expect(within(first).getByText("IP: 213.230.64.10")).toBeInTheDocument();
    expect(within(second).getByRole("heading", { level: 3, name: "Kompyuter · Windows · Edge" })).toBeInTheDocument();
    expect(within(second).queryByText("Shu qurilma")).not.toBeInTheDocument();
    expect(within(second).getByText("IP: 84.54.70.2")).toBeInTheDocument();
    // Faqat o'z sessiyalari: boshqa so'rov (foydalanuvchilar ro'yxati, tizim bo'yicha son) yo'q.
    expect(mocks.get.mock.calls.map(([url]) => url)).toEqual(["auth/sessions"]);
  });

  it("kirgan vaqti va oxirgi faollik — Toshkent vaqtida, oxirgisi nisbiy + sana", async () => {
    const lastSeen = minutesAgo(12);
    sessionsResponse = reply({ active_count: 1, sessions: [session({ last_seen_at: lastSeen, current: true })] });
    renderWithProviders(<ProfileSessionsCard />);

    const [row] = await rows();
    expect(within(row).getByText("Kirgan vaqti")).toBeInTheDocument();
    const loggedIn = within(row).getByText("18.10.2026, 09:12");
    expect(loggedIn.tagName).toBe("TIME");
    expect(loggedIn).toHaveAttribute("dateTime", "2026-10-18T04:12:00.000Z");
    expect(within(row).getByText("Oxirgi faollik")).toBeInTheDocument();
    expect(within(row).getByText("12 daqiqa oldin")).toHaveAttribute("dateTime", lastSeen);
    expect(within(row).getByText(formatDateTimeLocalized(lastSeen, { language: "uz" }))).toBeInTheDocument();
  });

  it("qurilma nomi yo'q — qisqa User-Agent (to'liq satr `title` da); u ham yo'q — «Noma'lum qurilma»", async () => {
    sessionsResponse = reply({
      active_count: 3,
      sessions: [
        session({ id: "ua", device_name: null, user_agent: "curl/8.4.0" }),
        session({ id: "none", device_name: null, user_agent: null, ip: null }),
        session({ id: "custom", device_name: "Ombor planshet" }),
      ],
    });
    renderWithProviders(<ProfileSessionsCard />);

    const [ua, none, custom] = await rows();
    expect(within(ua).getByRole("heading", { name: "curl/8.4.0" })).toHaveAttribute("title", "curl/8.4.0");
    expect(within(none).getByRole("heading", { name: "Noma'lum qurilma" })).toBeInTheDocument();
    expect(within(none).getByText("IP noma'lum")).toBeInTheDocument();
    expect(within(custom).getByRole("heading", { name: "Ombor planshet" })).toBeInTheDocument();
  });

  it("ro'yxat server chegarasida (50) qisqa qolsa — pastda jami son", async () => {
    sessionsResponse = reply({ active_count: 51, sessions: [session()] });
    renderWithProviders(<ProfileSessionsCard />);

    await rows();
    expect(within(card()).getByText("51 ta faol")).toBeInTheDocument();
    expect(within(card()).getByText("Oxirgi 1 tasi ko'rsatilgan · jami 51 ta faol sessiya")).toBeInTheDocument();
  });
});

describe("Sessiyalar — holatlar", () => {
  it("bo'sh — «Faol sessiya topilmadi» va «0 ta faol»", async () => {
    renderWithProviders(<ProfileSessionsCard />);

    expect(await screen.findByText("Faol sessiya topilmadi")).toBeInTheDocument();
    expect(within(card()).getByText("0 ta faol")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Faol sessiyalar ro'yxati" })).not.toBeInTheDocument();
  });

  it("xato — «Qayta urinish» so'rovni takrorlaydi va ro'yxat chiqadi", async () => {
    sessionsResponse = () => Promise.reject(new Error("boom"));
    renderWithProviders(<ProfileSessionsCard />);

    const retry = await screen.findByRole("button", { name: "Qayta urinish" });
    expect(within(card()).queryByText(/ta faol$/)).not.toBeInTheDocument();
    sessionsResponse = reply({ active_count: 1, sessions: [session({ current: true })] });
    await userEvent.click(retry);

    expect(await rows()).toHaveLength(1);
    expect(sessionCalls()).toBe(2);
  });

  it("bo'lim har ochilganda va oynaga qaytilganda qayta so'raladi", async () => {
    sessionsResponse = reply({ active_count: 1, sessions: [session()] });
    const view = renderWithProviders(<ProfileSessionsCard />);
    await rows();
    expect(sessionCalls()).toBe(1);

    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(sessionCalls()).toBe(2));
    focusManager.setFocused(undefined);

    view.unmount();
    renderWithProviders(<ProfileSessionsCard />);
    await rows();
    expect(sessionCalls()).toBe(3);
  });
});

describe("Sessiyalar — profil sahifasida", () => {
  it.each(["courier", "market", "superadmin"])("%s profilida karta bor", async (role) => {
    mocks.get.mockImplementation((url: string) => {
      if (url === "auth/sessions") return reply({ active_count: 1, sessions: [session({ current: true })] })();
      if (url === "auth/my-profile") {
        return Promise.resolve({ data: { statusCode: 200, data: { id: "7", name: "Ali Valiyev", role, status: "active" } } });
      }
      return Promise.resolve({ data: { data: {} } });
    });
    renderWithProviders(<ProfilePage />, { route: "/profile" });

    await screen.findByRole("heading", { name: "Ali Valiyev" });
    const [row] = await rows();
    expect(within(card()).getByText("1 ta faol")).toBeInTheDocument();
    expect(within(row).getByText("Shu qurilma")).toBeInTheDocument();
  });
});
