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
 * «Sessiyalar» (Elchi Pochta #3, `/profile`): faqat o'z hisobining sessiyalari — faollar soni, qurilma, tarmoq IP,
 * «Kirgan vaqti» (oxirgi kirish + «Birinchi marta»), «Oxirgi faollik» (nisbiy + sana), «Shu qurilma»; qayta
 * kirishi kerak bo'lganlar (`status: "expired"`) xiralashgan, «Qayta kirish kerak» bilan. Sana va vaqt — Toshkent vaqtida
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
  // 04:12 UTC = 09:12 Toshkent. Birinchi kirish shu daqiqada — «Birinchi marta» qatori yo'q.
  logged_in_at: "2026-10-18T04:12:00.000Z",
  first_logged_in_at: "2026-10-18T04:12:20.000Z",
  last_seen_at: minutesAgo(12),
  expires_at: "2026-10-23T09:00:00.000Z",
  current: false,
  status: "active",
  ...over,
});

let sessionsResponse: () => Promise<unknown>;
const reply =
  (data: { active_count: number; sessions: Row[]; can_revoke_others?: boolean; revoke_available_at?: string | null }) =>
  () =>
    Promise.resolve({ data: { statusCode: 200, message: "success", data } });

const sessionCalls = () => mocks.get.mock.calls.filter(([url]) => url === "auth/sessions").length;

const httpError = (status: number, message: string, extra: Row = {}) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data: { statusCode: status, message, ...extra } },
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
  const list = await screen.findByRole("list", { name: "Sessiyalar ro'yxati" });
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
    expect(within(first).getByText("Tarmoq IP: 213.230.64.10")).toBeInTheDocument();
    expect(within(second).getByRole("heading", { level: 3, name: "Kompyuter · Windows · Edge" })).toBeInTheDocument();
    expect(within(second).queryByText("Shu qurilma")).not.toBeInTheDocument();
    expect(within(second).getByText("Tarmoq IP: 84.54.70.2")).toBeInTheDocument();
    // Faqat o'z sessiyalari: boshqa so'rov (foydalanuvchilar ro'yxati, tizim bo'yicha son) yo'q.
    expect(mocks.get.mock.calls.map(([url]) => url)).toEqual(["auth/sessions"]);
  });

  it("tarmoq IP — bitta Wi-Fi izohi bilan (`title`)", async () => {
    sessionsResponse = reply({ active_count: 1, sessions: [session({ current: true })] });
    renderWithProviders(<ProfileSessionsCard />);

    const [row] = await rows();
    expect(within(row).getByText("Tarmoq IP: 213.230.64.10")).toHaveAttribute(
      "title",
      "Bitta Wi-Fi tarmog'idagi qurilmalar bir xil IP bilan ko'rinadi.",
    );
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
    expect(within(none).getByText("Tarmoq IP noma'lum")).toBeInTheDocument();
    expect(within(custom).getByRole("heading", { name: "Ombor planshet" })).toBeInTheDocument();
  });

  it("«Kirgan vaqti» — oxirgi kirish; birinchi kirish boshqa bo'lsa ostida «Birinchi marta», bir xil bo'lsa — yo'q", async () => {
    sessionsResponse = reply({
      active_count: 2,
      sessions: [
        // 06:30 UTC = 11:30 Toshkent.
        session({ id: "again", current: true, first_logged_in_at: "2026-10-02T06:30:00.000Z" }),
        session({ id: "once", device_name: "Windows 11 · Chrome 154" }),
      ],
    });
    renderWithProviders(<ProfileSessionsCard />);

    const [again, once] = await rows();
    expect(within(again).getByText("18.10.2026, 09:12")).toHaveAttribute("dateTime", "2026-10-18T04:12:00.000Z");
    const first = within(again).getByText("02.10.2026, 11:30");
    expect(first.tagName).toBe("TIME");
    expect(first).toHaveAttribute("dateTime", "2026-10-02T06:30:00.000Z");
    expect(first.closest("dd")).toHaveTextContent("Birinchi marta: 02.10.2026, 11:30");
    expect(within(once).getByRole("heading", { level: 3, name: "Windows 11 · Chrome 154" })).toBeInTheDocument();
    expect(within(once).queryByText(/Birinchi marta/)).not.toBeInTheDocument();
  });

  it("ro'yxat server chegarasida (50) qisqa qolsa — pastda jami son", async () => {
    sessionsResponse = reply({ active_count: 51, sessions: [session()] });
    renderWithProviders(<ProfileSessionsCard />);

    await rows();
    expect(within(card()).getByText("51 ta faol")).toBeInTheDocument();
    expect(within(card()).getByText("Oxirgi 1 tasi ko'rsatilgan · jami 51 ta faol sessiya")).toBeInTheDocument();
  });
});

describe("Sessiyalar — qayta kirish kerak (`expired`) va eski backend", () => {
  const mixed = () =>
    reply({
      active_count: 2,
      sessions: [
        session({ id: "old", device_name: "iPhone · iOS 17 · Safari", status: "expired", last_seen_at: minutesAgo(3 * 24 * 60) }),
        session({ id: "me", device_name: "Samsung SM-A515F · Android 13 · Chrome 155", current: true }),
        session({ id: "win", device_name: "Windows 11 · Chrome 154", ip: "84.54.70.12" }),
      ],
    });

  it("faollar tepada, `expired` oxirida — xiralashgan, «Qayta kirish kerak»; «N ta faol» faqat faollar", async () => {
    sessionsResponse = mixed();
    renderWithProviders(<ProfileSessionsCard />);

    const [me, win, old] = await rows();
    expect(within(card()).getByText("2 ta faol")).toBeInTheDocument();
    expect(within(me).getByRole("heading", { name: "Samsung SM-A515F · Android 13 · Chrome 155" })).toHaveClass("text-text");
    expect(within(me).queryByText("Qayta kirish kerak")).not.toBeInTheDocument();
    expect(within(win).queryByText("Qayta kirish kerak")).not.toBeInTheDocument();
    expect(win).toHaveAttribute("data-session-status", "active");

    expect(old).toHaveAttribute("data-session-status", "expired");
    const heading = within(old).getByRole("heading", { level: 3, name: "iPhone · iOS 17 · Safari" });
    expect(heading).toHaveClass("text-text-muted");
    expect(heading).not.toHaveClass("text-text");
    expect(within(old).getByText("Qayta kirish kerak")).toBeInTheDocument();
    expect(within(old).getByText("3 kun oldin").closest("dd")).toHaveClass("text-text-muted");
    // Qayta kirishi kerak bo'lgan qurilmani ham chiqarish mumkin.
    expect(within(old).getByRole("button", { name: "Chiqarish: iPhone · iOS 17 · Safari" })).toBeInTheDocument();
  });

  it("`expired` qatordagi «Chiqarish»: o'z izohi bilan tasdiq → DELETE, faollar soni o'zgarmaydi", async () => {
    sessionsResponse = mixed();
    mocks.delete.mockImplementation(async () => {
      sessionsResponse = reply({
        active_count: 2,
        sessions: [
          session({ id: "me", device_name: "Samsung SM-A515F · Android 13 · Chrome 155", current: true }),
          session({ id: "win", device_name: "Windows 11 · Chrome 154" }),
        ],
      });
      return revoked(["old"]);
    });
    const user = userEvent.setup();
    renderWithProviders(<ProfileSessionsCard />);
    const [, , old] = await rows();

    await user.click(within(old).getByRole("button", { name: /Chiqarish/ }));
    const confirm = await screen.findByRole("alertdialog", { name: "Qurilmani chiqarishni tasdiqlang" });
    expect(within(confirm).getByText(/U baribir qayta kirishi kerak edi/)).toBeInTheDocument();
    expect(within(confirm).getByText("iPhone · iOS 17 · Safari")).toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Chiqarish" }));

    expect(await screen.findByText("Qurilma chiqarildi")).toBeInTheDocument();
    expect(mocks.delete).toHaveBeenCalledWith("auth/sessions/old");
    await waitFor(async () => expect(await rows()).toHaveLength(2));
    expect(within(card()).getByText("2 ta faol")).toBeInTheDocument();
    expect(within(card()).queryByText("Qayta kirish kerak")).not.toBeInTheDocument();
  });

  it("«Boshqa barcha qurilmalardan chiqish» — boshqasi faqat `expired` bo'lsa ham bor; tasdiqda hamma boshqalar sanaladi", async () => {
    sessionsResponse = reply({
      active_count: 1,
      sessions: [
        session({ id: "me", current: true }),
        session({ id: "old", device_name: "iPhone · iOS 17 · Safari", status: "expired" }),
      ],
    });
    const user = userEvent.setup();
    const view = renderWithProviders(<ProfileSessionsCard />);
    await rows();
    expect(within(card()).getByText("1 ta faol")).toBeInTheDocument();
    await user.click(within(card()).getByRole("button", { name: "Boshqa barcha qurilmalardan chiqish" }));
    let confirm = await screen.findByRole("alertdialog", { name: "Boshqa qurilmalardan chiqishni tasdiqlang" });
    expect(within(confirm).getByText(/Boshqa 1 ta qurilma hisobingizdan chiqariladi/)).toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    view.unmount();

    sessionsResponse = mixed();
    renderWithProviders(<ProfileSessionsCard />);
    await rows();
    await user.click(within(card()).getByRole("button", { name: "Boshqa barcha qurilmalardan chiqish" }));
    confirm = await screen.findByRole("alertdialog", { name: "Boshqa qurilmalardan chiqishni tasdiqlang" });
    expect(within(confirm).getByText(/Boshqa 2 ta qurilma hisobingizdan chiqariladi/)).toBeInTheDocument();
  });

  it("server chegarasi: ro'yxatdagi faollar `active_count` dan kam — pastda jami son (`expired` sanalmaydi)", async () => {
    sessionsResponse = reply({
      active_count: 51,
      sessions: [session({ id: "me", current: true }), session({ id: "old", status: "expired" })],
    });
    renderWithProviders(<ProfileSessionsCard />);

    await rows();
    expect(within(card()).getByText("Oxirgi 2 tasi ko'rsatilgan · jami 51 ta faol sessiya")).toBeInTheDocument();
  });

  it("eski backend (`status` va `first_logged_in_at` yo'q) — hammasi faol, «Birinchi marta» qatori yo'q", async () => {
    const legacy = (over: Row) => {
      const row = session(over);
      delete row.status;
      delete row.first_logged_in_at;
      return row;
    };
    sessionsResponse = reply({
      active_count: 2,
      sessions: [legacy({ id: "win", device_name: "Kompyuter · Windows · Edge" }), legacy({ id: "me", current: true })],
    });
    renderWithProviders(<ProfileSessionsCard />);

    const [me, win] = await rows();
    expect(within(card()).getByText("2 ta faol")).toBeInTheDocument();
    expect(within(card()).queryByText("Qayta kirish kerak")).not.toBeInTheDocument();
    expect(within(card()).queryByText(/Birinchi marta/)).not.toBeInTheDocument();
    expect(within(me).getByText("18.10.2026, 09:12")).toBeInTheDocument();
    expect(win).toHaveAttribute("data-session-status", "active");
    expect(within(card()).queryByText(/Oxirgi \d+ tasi/)).not.toBeInTheDocument();
  });
});

describe("Sessiyalar — holatlar", () => {
  it("bo'sh — «Faol sessiya topilmadi» va «0 ta faol»", async () => {
    renderWithProviders(<ProfileSessionsCard />);

    expect(await screen.findByText("Faol sessiya topilmadi")).toBeInTheDocument();
    expect(within(card()).getByText("0 ta faol")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Sessiyalar ro'yxati" })).not.toBeInTheDocument();
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
    expect(within(confirm).getByText(/Tarmoq IP: 84\.54\.70\.12 · oxirgi faollik 12 daqiqa oldin/)).toBeInTheDocument();
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

describe("Sessiyalar — yangi qurilma cheklovi (48 soat, Telegram kabi)", () => {
  const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
  /** Vaqt — to'liq sana («Bugun» siz), Toshkent vaqtida (`formatDateTimeLocalized(…, { relative: false })`). */
  const fullTime = (iso: string) => formatDateTimeLocalized(iso, { language: "uz", relative: false });
  const REASON = "Xavfsizlik uchun yangi qurilmadan boshqa sessiyalarni chiqarib bo'lmaydi.";
  const URGENT = "Shoshilinch bo'lsa — parolni almashtiring: boshqa barcha qurilmalar darhol chiqadi.";
  const two = (extra: { can_revoke_others?: boolean; revoke_available_at?: string | null } = {}) =>
    reply({
      active_count: 3,
      sessions: [
        session({ id: "me", device_name: "Telefon · Android · Chrome", current: true }),
        session({ id: "win", device_name: "Kompyuter · Windows · Edge" }),
        session({ id: "old", device_name: "iPhone · iOS 17 · Safari", status: "expired" }),
      ],
      ...extra,
    });

  it("`can_revoke_others: false` — ogohlantirish (sabab, vaqt, «parolni almashtiring»); amallar o'chirilgan, sababi bilan", async () => {
    const availableAt = hoursFromNow(30);
    const when = fullTime(availableAt);
    sessionsResponse = two({ can_revoke_others: false, revoke_available_at: availableAt });
    const user = userEvent.setup();
    renderWithProviders(<ProfileSessionsCard />);
    const [, win, old] = await rows();

    const alert = within(card()).getByTestId("sessions-revoke-lock");
    expect(alert).toHaveAttribute("role", "status");
    expect(within(alert).getByText(REASON)).toBeInTheDocument();
    expect(alert).toHaveTextContent(`${when} dan keyin mumkin bo'ladi. ${URGENT}`);
    // To'liq sana: «25.10.2026, 14:30» (nisbiy «Bugun/Ertaga» emas).
    expect(when).toMatch(/^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/);
    // Parol oynasi havolasi faqat `onChangePassword` berilsa (profil sahifasi).
    expect(within(alert).queryByRole("button")).not.toBeInTheDocument();

    // Yashirilmaydi — o'chirilgan, sababi (sabab + vaqt) ekran o'quvchiga va `title` da.
    const description = `${REASON} ${when} dan keyin mumkin bo'ladi.`;
    for (const button of [
      within(win).getByRole("button", { name: "Chiqarish: Kompyuter · Windows · Edge" }),
      within(old).getByRole("button", { name: "Chiqarish: iPhone · iOS 17 · Safari" }),
      within(card()).getByRole("button", { name: "Boshqa barcha qurilmalardan chiqish" }),
    ]) {
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription(description);
      expect(button).toHaveAttribute("title", description);
      await user.click(button);
    }
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("vaqt noma'lum (`revoke_available_at: null`) — «48 soat o'tgach»; «Parolni o'zgartirish» → `onChangePassword`", async () => {
    sessionsResponse = two({ can_revoke_others: false, revoke_available_at: null });
    const onChangePassword = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ProfileSessionsCard onChangePassword={onChangePassword} />);
    await rows();

    const alert = within(card()).getByTestId("sessions-revoke-lock");
    expect(alert).toHaveTextContent(
      `Shu qurilmadan birinchi kirganingizdan 48 soat o'tgach mumkin bo'ladi. ${URGENT}`,
    );
    expect(within(card()).getByRole("button", { name: "Boshqa barcha qurilmalardan chiqish" })).toBeDisabled();
    await user.click(within(alert).getByRole("button", { name: "Parolni o'zgartirish" }));
    expect(onChangePassword).toHaveBeenCalledTimes(1);
  });

  it("ruxsat vaqti o'tib bo'lgan yoki `can_revoke_others: true` — cheklov yo'q", async () => {
    sessionsResponse = two({ can_revoke_others: false, revoke_available_at: hoursFromNow(-1) });
    const view = renderWithProviders(<ProfileSessionsCard />);
    await rows();
    expect(within(card()).queryByTestId("sessions-revoke-lock")).not.toBeInTheDocument();
    expect(within(card()).getByRole("button", { name: "Boshqa barcha qurilmalardan chiqish" })).toBeEnabled();
    view.unmount();

    sessionsResponse = two({ can_revoke_others: true, revoke_available_at: null });
    renderWithProviders(<ProfileSessionsCard />);
    const [, win] = await rows();
    expect(within(card()).queryByTestId("sessions-revoke-lock")).not.toBeInTheDocument();
    expect(within(win).getByRole("button", { name: /Chiqarish/ })).toBeEnabled();
    expect(within(win).getByRole("button", { name: /Chiqarish/ })).not.toHaveAttribute("title");
  });

  it("eski backend (maydonlar yo'q) — bugungi xulq: ogohlantirish yo'q, amallar yoqilgan", async () => {
    sessionsResponse = two();
    renderWithProviders(<ProfileSessionsCard />);
    const [, win, old] = await rows();

    expect(within(card()).queryByText(REASON)).not.toBeInTheDocument();
    expect(within(win).getByRole("button", { name: /Chiqarish/ })).toBeEnabled();
    expect(within(old).getByRole("button", { name: /Chiqarish/ })).toBeEnabled();
    expect(within(card()).getByRole("button", { name: "Boshqa barcha qurilmalardan chiqish" })).not.toHaveAccessibleDescription();
  });

  it("baribir 403 SESSION_TOO_NEW (qatordagi «Chiqarish»): oyna yopiladi, server matni ogohlantirishda, ro'yxat qayta so'raladi", async () => {
    sessionsResponse = two();
    const availableAt = hoursFromNow(20);
    const serverMessage = `Xavfsizlik uchun yangi qurilmadan boshqa sessiyalarni chiqarib bo'lmaydi — ${fullTime(availableAt)} dan keyin mumkin`;
    mocks.delete.mockImplementation(async () => {
      sessionsResponse = two({ can_revoke_others: false, revoke_available_at: availableAt });
      throw httpError(403, serverMessage, { code: "SESSION_TOO_NEW", available_at: availableAt });
    });
    const user = userEvent.setup();
    renderWithProviders(<ProfileSessionsCard />);
    const [, win] = await rows();

    await user.click(within(win).getByRole("button", { name: /Chiqarish/ }));
    const confirm = await screen.findByRole("alertdialog", { name: "Qurilmani chiqarishni tasdiqlang" });
    await user.click(within(confirm).getByRole("button", { name: "Chiqarish" }));

    expect(await screen.findByText("Hozircha chiqarib bo'lmaydi")).toBeInTheDocument();
    expect(screen.getByText(serverMessage)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.queryByText("Qurilma chiqarildi")).not.toBeInTheDocument();
    expect(mocks.delete).toHaveBeenCalledWith("auth/sessions/win");
    await waitFor(() => expect(sessionCalls()).toBe(2));
    // Endi kartada cheklov: ogohlantirish va o'chirilgan amallar.
    expect(await within(card()).findByTestId("sessions-revoke-lock")).toHaveTextContent(
      `${fullTime(availableAt)} dan keyin mumkin bo'ladi.`,
    );
    expect(within(card()).getByRole("button", { name: "Boshqa barcha qurilmalardan chiqish" })).toBeDisabled();
  });

  it("baribir 403 (revoke-others, maydonlar `details` ichida, server matnisiz) — o'z matnimiz xatodagi vaqt bilan", async () => {
    sessionsResponse = two();
    const availableAt = hoursFromNow(5);
    mocks.post.mockImplementation(async () => {
      sessionsResponse = two({ can_revoke_others: false, revoke_available_at: availableAt });
      throw httpError(403, "Forbidden", {
        message: undefined,
        details: { code: "SESSION_TOO_NEW", available_at: availableAt },
      });
    });
    const user = userEvent.setup();
    renderWithProviders(<ProfileSessionsCard />);
    await rows();

    await user.click(within(card()).getByRole("button", { name: "Boshqa barcha qurilmalardan chiqish" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Boshqa qurilmalardan chiqishni tasdiqlang" });
    await user.click(within(confirm).getByRole("button", { name: "Hammasini chiqarish" }));

    expect(await screen.findByText("Hozircha chiqarib bo'lmaydi")).toBeInTheDocument();
    expect(screen.getByText(`${REASON} ${fullTime(availableAt)} dan keyin mumkin bo'ladi.`)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.queryByText("Boshqa qurilmalardan chiqildi")).not.toBeInTheDocument();
    expect(sessionCalls()).toBe(2);
    expect(within(card()).getByTestId("sessions-revoke-lock")).toBeInTheDocument();
    expect(within(card()).getByRole("button", { name: "Boshqa barcha qurilmalardan chiqish" })).toBeDisabled();
  });

  it("kodsiz 403 — oddiy xato: oyna ochiq, ichida backend sababi", async () => {
    sessionsResponse = two();
    mocks.delete.mockRejectedValue(httpError(403, "Ruxsat yo'q"));
    const user = userEvent.setup();
    renderWithProviders(<ProfileSessionsCard />);
    const [, win] = await rows();

    await user.click(within(win).getByRole("button", { name: /Chiqarish/ }));
    const confirm = await screen.findByRole("alertdialog", { name: "Qurilmani chiqarishni tasdiqlang" });
    await user.click(within(confirm).getByRole("button", { name: "Chiqarish" }));
    expect(await within(confirm).findByRole("alert")).toHaveTextContent("Ruxsat yo'q");
    expect(screen.queryByText("Hozircha chiqarib bo'lmaydi")).not.toBeInTheDocument();
  });

  it("profil sahifasida: ogohlantirishdagi «Parolni o'zgartirish» parol oynasini ochadi", async () => {
    mocks.get.mockImplementation((url: string) => {
      if (url === "auth/sessions") return two({ can_revoke_others: false, revoke_available_at: hoursFromNow(10) })();
      if (url === "auth/my-profile") {
        return Promise.resolve({
          data: { statusCode: 200, data: { id: "7", name: "Ali Valiyev", role: "courier", status: "active" } },
        });
      }
      return Promise.resolve({ data: { data: {} } });
    });
    const user = userEvent.setup();
    renderWithProviders(<ProfilePage />, { route: "/profile" });
    await rows();

    const alert = within(card()).getByTestId("sessions-revoke-lock");
    await user.click(within(alert).getByRole("button", { name: "Parolni o'zgartirish" }));
    expect(await screen.findByRole("dialog", { name: "Parolni o'zgartirish" })).toBeInTheDocument();
  });
});
