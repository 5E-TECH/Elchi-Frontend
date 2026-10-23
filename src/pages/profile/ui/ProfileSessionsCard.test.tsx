import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { focusManager } from "@tanstack/react-query";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api: { get: mocks.get, post: mocks.post, delete: mocks.delete } }));

import { ProfileSessionsCard } from "./ProfileSessionsCard";
import ProfilePage from "./ProfilePage";

/**
 * «Sessiyalar» (Elchi Pochta #3, `/profile`): faqat o'z hisobining faol sessiyalari — soni, qurilma, IP,
 * «Kirgan vaqti», «Oxirgi faollik» (nisbiy + sana), «Shu qurilma». Sana va vaqt — Toshkent vaqtida
 * (foydalanuvchilar Toshkentda, formatlovchi brauzer vaqtini oladi — testda mintaqa qat'iy `Asia/Tashkent`).
 * Boshqa qurilmalarni chiqarish: qatordagi «Chiqarish» (`DELETE auth/sessions/:id`) va «Boshqa barcha
 * qurilmalardan chiqish» (`POST auth/sessions/revoke-others`) — haqiqiy tasdiq oynasi va xabarlar orqali.
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

const httpError = (status: number, message: string) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data: { statusCode: status, message } },
  });

/** Gateway kontrakti: DELETE — «Sessiya yopildi», revoke-others — «Boshqa sessiyalardan chiqildi». */
const revoked = (ids: string[], message = "Sessiya yopildi") => ({
  data: { statusCode: 200, message, data: { revoked: ids.length, session_ids: ids } },
});

beforeEach(() => {
  sessionsResponse = reply({ active_count: 0, sessions: [] });
  mocks.post.mockReset();
  mocks.delete.mockReset();
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

describe("Sessiyalar — boshqa qurilmalarni chiqarish", () => {
  const three = () =>
    reply({
      active_count: 3,
      sessions: [
        session({ id: "win", device_name: "Kompyuter · Windows · Edge", ip: "84.54.70.12" }),
        session({ id: "me", device_name: "Telefon · Android · Chrome", current: true }),
        session({ id: "ua", device_name: null, user_agent: "PostmanRuntime/7.39.0", ip: null }),
      ],
    });

  it("«Chiqarish» faqat boshqa qurilmalar qatorida; joriy qatorda — faqat «Shu qurilma» badge'i", async () => {
    sessionsResponse = three();
    renderWithProviders(<ProfileSessionsCard />);

    const [current, win, ua] = await rows();
    expect(within(current).getByText("Shu qurilma")).toBeInTheDocument();
    expect(within(current).queryByRole("button")).not.toBeInTheDocument();
    expect(within(win).getByRole("button", { name: "Chiqarish: Kompyuter · Windows · Edge" })).toHaveTextContent(
      "Chiqarish",
    );
    expect(within(ua).getByRole("button", { name: "Chiqarish: PostmanRuntime/7.39.0" })).toBeInTheDocument();
    expect(within(card()).getByRole("button", { name: "Boshqa barcha qurilmalardan chiqish" })).toBeInTheDocument();
  });

  it("faqat shu qurilma bo'lsa — hech qanday chiqarish tugmasi yo'q", async () => {
    sessionsResponse = reply({ active_count: 1, sessions: [session({ current: true })] });
    renderWithProviders(<ProfileSessionsCard />);

    await rows();
    expect(within(card()).queryByRole("button", { name: /Chiqarish/ })).not.toBeInTheDocument();
    expect(within(card()).queryByRole("button", { name: "Boshqa barcha qurilmalardan chiqish" })).not.toBeInTheDocument();
  });

  it("qator: tasdiq (qaysi qurilma) → bekor — so'rov yo'q; «Chiqarish» → DELETE, xabar, qator ro'yxatdan chiqadi", async () => {
    sessionsResponse = three();
    let release: (value: unknown) => void = () => undefined;
    mocks.delete.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProfileSessionsCard />);
    const [, win] = await rows();

    await user.click(within(win).getByRole("button", { name: /Chiqarish/ }));
    let confirm = await screen.findByRole("alertdialog", { name: "Qurilmani chiqarishni tasdiqlang" });
    expect(within(confirm).getByText("Kompyuter · Windows · Edge")).toBeInTheDocument();
    expect(within(confirm).getByText(/IP: 84\.54\.70\.12 · oxirgi faollik 12 daqiqa oldin/)).toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mocks.delete).not.toHaveBeenCalled();

    await user.click(within(win).getByRole("button", { name: /Chiqarish/ }));
    confirm = await screen.findByRole("alertdialog", { name: "Qurilmani chiqarishni tasdiqlang" });
    await user.click(within(confirm).getByRole("button", { name: "Chiqarish" }));
    // So'rov ketayotganda — tugmada yuklanish, oyna ochiq.
    expect(await within(confirm).findByText("Chiqarilmoqda…")).toBeInTheDocument();
    expect(mocks.delete).toHaveBeenCalledWith("auth/sessions/win");

    sessionsResponse = reply({
      active_count: 2,
      sessions: [
        session({ id: "me", device_name: "Telefon · Android · Chrome", current: true }),
        session({ id: "ua", device_name: null, user_agent: "PostmanRuntime/7.39.0", ip: null }),
      ],
    });
    release(revoked(["win"]));

    expect(await screen.findByText("Qurilma chiqarildi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(async () => expect(await rows()).toHaveLength(2));
    expect(within(card()).queryByRole("heading", { name: "Kompyuter · Windows · Edge" })).not.toBeInTheDocument();
    expect(within(card()).getByText("2 ta faol")).toBeInTheDocument();
    await waitFor(() => expect(sessionCalls()).toBe(2));
  });

  it("404 — sessiya allaqachon yopilgan: xato emas, ma'lumot xabari va ro'yxat qayta so'raladi", async () => {
    sessionsResponse = three();
    mocks.delete.mockRejectedValue(httpError(404, "Sessiya topilmadi yoki allaqachon yopilgan"));
    const user = userEvent.setup();
    renderWithProviders(<ProfileSessionsCard />);
    const [, win] = await rows();

    await user.click(within(win).getByRole("button", { name: /Chiqarish/ }));
    const confirm = await screen.findByRole("alertdialog", { name: "Qurilmani chiqarishni tasdiqlang" });
    await user.click(within(confirm).getByRole("button", { name: "Chiqarish" }));

    expect(await screen.findByText("Bu sessiya allaqachon yopilgan")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.queryByText("Qurilma chiqarildi")).not.toBeInTheDocument();
    await waitFor(() => expect(sessionCalls()).toBe(2));
  });

  it("400 (joriy sessiya / noto'g'ri ID) — oyna ochiq, ichida backend sababi", async () => {
    sessionsResponse = three();
    mocks.delete.mockRejectedValue(
      httpError(400, "Joriy sessiyani bu yerdan yopib bo'lmaydi — «Chiqish» tugmasidan foydalaning"),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProfileSessionsCard />);
    const [, win] = await rows();

    await user.click(within(win).getByRole("button", { name: /Chiqarish/ }));
    const confirm = await screen.findByRole("alertdialog", { name: "Qurilmani chiqarishni tasdiqlang" });
    await user.click(within(confirm).getByRole("button", { name: "Chiqarish" }));

    expect(await within(confirm).findByRole("alert")).toHaveTextContent(
      "Joriy sessiyani bu yerdan yopib bo'lmaydi — «Chiqish» tugmasidan foydalaning",
    );
    expect(screen.getByRole("alertdialog", { name: "Qurilmani chiqarishni tasdiqlang" })).toBeInTheDocument();
    expect(screen.queryByText("Qurilma chiqarildi")).not.toBeInTheDocument();
  });

  it("«Boshqa barcha qurilmalardan chiqish»: tasdiqda soni → POST (tanasiz), xabar, faqat shu qurilma qoladi", async () => {
    sessionsResponse = three();
    mocks.post.mockImplementation(async () => {
      sessionsResponse = reply({
        active_count: 1,
        sessions: [session({ id: "me", device_name: "Telefon · Android · Chrome", current: true })],
      });
      return revoked(["win", "ua"], "Boshqa sessiyalardan chiqildi");
    });
    const user = userEvent.setup();
    renderWithProviders(<ProfileSessionsCard />);
    await rows();

    await user.click(within(card()).getByRole("button", { name: "Boshqa barcha qurilmalardan chiqish" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Boshqa qurilmalardan chiqishni tasdiqlang" });
    expect(within(confirm).getByText(/Boshqa 2 ta qurilma hisobingizdan chiqariladi/)).toBeInTheDocument();
    expect(within(confirm).getByText("Shu qurilma tizimda qoladi.")).toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Hammasini chiqarish" }));

    expect(await screen.findByText("Boshqa qurilmalardan chiqildi")).toBeInTheDocument();
    expect(screen.getByText("2 ta sessiya yopildi.")).toBeInTheDocument();
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.post.mock.calls[0]).toEqual(["auth/sessions/revoke-others"]);
    await waitFor(async () => expect(await rows()).toHaveLength(1));
    expect(within(card()).queryByRole("button", { name: "Boshqa barcha qurilmalardan chiqish" })).not.toBeInTheDocument();
  });

  it("revoke-others 0 ta yopdi — ma'lumot xabari; 400 (eski token) — oyna ichida «qayta kiring»", async () => {
    sessionsResponse = three();
    mocks.post.mockResolvedValueOnce({
      data: { statusCode: 200, message: "Boshqa faol sessiya yo'q", data: { revoked: 0, session_ids: [] } },
    });
    mocks.post.mockRejectedValueOnce(httpError(400, "Joriy sessiya aniqlanmadi — qayta kiring"));
    const user = userEvent.setup();
    renderWithProviders(<ProfileSessionsCard />);
    await rows();

    await user.click(within(card()).getByRole("button", { name: "Boshqa barcha qurilmalardan chiqish" }));
    let confirm = await screen.findByRole("alertdialog", { name: "Boshqa qurilmalardan chiqishni tasdiqlang" });
    await user.click(within(confirm).getByRole("button", { name: "Hammasini chiqarish" }));
    expect(await screen.findByText("Boshqa faol sessiya qolmagan")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

    await user.click(within(card()).getByRole("button", { name: "Boshqa barcha qurilmalardan chiqish" }));
    confirm = await screen.findByRole("alertdialog", { name: "Boshqa qurilmalardan chiqishni tasdiqlang" });
    await user.click(within(confirm).getByRole("button", { name: "Hammasini chiqarish" }));
    expect(await within(confirm).findByRole("alert")).toHaveTextContent(
      "Shu qurilmaning sessiyasini aniqlab bo'lmadi. Tizimdan chiqib, qayta kiring va yana urinib ko'ring.",
    );
    expect(screen.queryByText("Boshqa qurilmalardan chiqildi")).not.toBeInTheDocument();
  });
});
