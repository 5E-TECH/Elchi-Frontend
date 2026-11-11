import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import DailySchedulePage from ".";

/**
 * Ops → «Kun tartibi» (2026-11-10): buyurtma yaratish / qabul chegaralari, kun almashishi (`orders/intake-settings`) va
 * smena jadvali — avtomatik ochish, avtomatik yopish (smena sozlamalaridan ko'chgan), kechikish xabari
 * (`finance/shift/settings`). Bitta «Saqlash» — faqat o'zgargan maydonlar, ikki PATCH mustaqil.
 */
const http = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock("../../shared/api/api", () => ({ api: http, API_TIMEOUT_MS: 20_000, LONG_REQUEST_TIMEOUT_MS: 120_000 }));

type Json = Record<string, unknown>;

const iso = (ms: number) => new Date(ms).toISOString();
const HOUR = 3_600_000;

const freshIntake = (): Json => {
  const now = Date.now();
  return {
    cutoff_time: "10:00",
    is_open: true,
    closes_at: iso(now + 3 * HOUR),
    reopens_at: null,
    receive_cutoff_time: "16:00",
    receive_is_open: true,
    receive_closes_at: iso(now + 6 * HOUR),
    receive_reopens_at: null,
    day_change_time: "00:00",
    // Ish kuni 2 soat oldin boshlangan: «00:30» bugun o'tgan, «23:30» — o'tmagan.
    day_started_at: iso(now - 2 * HOUR),
    next_day_change_at: iso(now + 22 * HOUR),
  };
};

const freshShift = (): Json => ({
  account_check_enabled: false,
  photo_required: false,
  ai_check_enabled: false,
  cards: [],
  auto_open: { enabled: false, times: ["08:00"], scope: "main" },
  auto_close: { enabled: false, times: ["23:00", "14:00"], scope: "main", warn_before_min: 15 },
  late_alert: { enabled: false, grace_min: 15, channels: { telegram: true, in_app: true } },
});

const server = { intake: {} as Json | null, shift: {} as Json };

/** Eski backend javobi — yangi kalitlarsiz nusxa. */
const without = (source: Json, keys: string[]): Json =>
  Object.fromEntries(Object.entries(source).filter(([key]) => !keys.includes(key)));

/** Ichma-ich bloklar (`auto_open`, `late_alert.channels` …) qisman yangilanadi — backend kabi. */
const merge = (base: Json, patch: Json): Json => {
  const out: Json = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    out[key] =
      value && typeof value === "object" && !Array.isArray(value) && base[key] && typeof base[key] === "object"
        ? merge(base[key] as Json, value as Json)
        : value;
  }
  return out;
};

const notFound = () => Object.assign(new Error("Not Found"), { response: { status: 404, data: {} } });

const superadmin = { role: { id: "1", role: "superadmin", region: null, name: "SA" } } as never;
const render = () => renderWithProviders(<DailySchedulePage embedded />, { route: "/ops?tab=daily-schedule", preloadedState: superadmin });

const intakePatches = () => http.patch.mock.calls.filter(([url]) => url === "orders/intake-settings").map(([, body]) => body);
const shiftPatches = () => http.patch.mock.calls.filter(([url]) => url === "finance/shift/settings").map(([, body]) => body);

beforeEach(() => {
  server.intake = freshIntake();
  server.shift = freshShift();
  http.get.mockReset();
  http.patch.mockReset();
  http.get.mockImplementation(async (url: string) => {
    if (url === "orders/intake-settings") {
      if (!server.intake) throw notFound();
      return { data: { statusCode: 200, data: server.intake } };
    }
    if (url === "finance/shift/settings") return { data: { statusCode: 200, data: server.shift } };
    if (url.startsWith("finance/cashbox")) return { data: { statusCode: 200, data: [] } };
    throw new Error(`kutilmagan GET ${url}`);
  });
  http.patch.mockImplementation(async (url: string, body: Json) => {
    if (url === "orders/intake-settings") {
      server.intake = merge(server.intake ?? {}, body);
      return { data: { statusCode: 200, data: server.intake } };
    }
    if (url === "finance/shift/settings") {
      server.shift = merge(server.shift, body);
      return { data: { statusCode: 200, data: server.shift } };
    }
    throw new Error(`kutilmagan PATCH ${url}`);
  });
});

const field = (name: string) => screen.getByRole("textbox", { name: new RegExp(`^${name}`) });

describe("Kun tartibi — buyurtma qabuli", () => {
  it("⭐ yaratish, qabul, kun almashishi: joriy holat ko'rinadi; o'zgartirilsa bitta PATCH faqat o'zgarganlar bilan", async () => {
    const user = userEvent.setup();
    render();
    const card = await screen.findByRole("region", { name: "Buyurtma qabuli" });
    const save = screen.getByRole("button", { name: "Saqlash" });
    expect(save).toBeDisabled();
    expect(field("Buyurtma yaratish chegarasi")).toHaveValue("10:00");
    expect(field("Yaratilgan buyurtmalarni qabul qilish chegarasi")).toHaveValue("16:00");
    expect(field("Kun almashish vaqti")).toHaveValue("00:00");
    expect(within(card).getAllByText(/^Hozir: ochiq · \d\d:\d\d da yopiladi$/)).toHaveLength(2);
    // Yangi backend — yaratish chegarasi har kungi.
    expect(within(card).getByText(/Har kuni shu vaqtdan keyin yangi buyurtma yaratilmaydi/)).toBeInTheDocument();

    await user.clear(field("Buyurtma yaratish chegarasi"));
    await user.type(field("Buyurtma yaratish chegarasi"), "1130");
    expect(field("Buyurtma yaratish chegarasi")).toHaveValue("11:30");
    await user.clear(field("Yaratilgan buyurtmalarni qabul qilish chegarasi"));
    await user.clear(field("Kun almashish vaqti"));
    await user.type(field("Kun almashish vaqti"), "1800");
    await user.click(save);

    await waitFor(() =>
      expect(intakePatches()).toEqual([{ cutoff_time: "11:30", receive_cutoff_time: null, day_change_time: "18:00" }]),
    );
    expect(shiftPatches()).toEqual([]);
    expect(await screen.findByText("Kun tartibi saqlandi")).toBeInTheDocument();
    // Saqlangandan keyin qoralama server bilan teng — «Saqlash» yana o'chiq.
    await waitFor(() => expect(screen.getByRole("button", { name: "Saqlash" })).toBeDisabled());
  });

  it("noto'g'ri soat — maydon xatosi, «Saqlash» o'chiq; bugun o'tgan soat — «darhol yopiladi» ogohlantirishi", async () => {
    const user = userEvent.setup();
    render();
    await screen.findByRole("region", { name: "Buyurtma qabuli" });
    await user.clear(field("Kun almashish vaqti"));
    await user.type(field("Kun almashish vaqti"), "25");
    expect(screen.getByText("Vaqtni 00:00–23:59 ko'rinishida kiriting")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saqlash" })).toBeDisabled();

    await user.clear(field("Kun almashish vaqti"));
    await user.type(field("Kun almashish vaqti"), "0000");
    await user.clear(field("Buyurtma yaratish chegarasi"));
    await user.type(field("Buyurtma yaratish chegarasi"), "0030");
    expect(screen.getByText("Bu vaqt bugun o'tgan — saqlansa, yaratish darhol yopiladi")).toBeInTheDocument();
    await user.clear(field("Buyurtma yaratish chegarasi"));
    await user.type(field("Buyurtma yaratish chegarasi"), "2330");
    expect(screen.queryByText("Bu vaqt bugun o'tgan — saqlansa, yaratish darhol yopiladi")).toBeNull();
    expect(screen.getByRole("button", { name: "Saqlash" })).toBeEnabled();
  });

  it("eski backend (`receive_cutoff_time` yo'q): qabul maydoni yo'q, yaratish chegarasi «faqat joriy ish kuni uchun»", async () => {
    server.intake = without(freshIntake(), [
      "receive_cutoff_time",
      "receive_is_open",
      "receive_closes_at",
      "receive_reopens_at",
    ]);
    render();
    const card = await screen.findByRole("region", { name: "Buyurtma qabuli" });
    expect(within(card).queryByRole("textbox", { name: /qabul qilish chegarasi/ })).toBeNull();
    expect(within(card).getByText("Faqat joriy ish kuni uchun — kun almashganda cheklov o'chadi")).toBeInTheDocument();
  });
});

describe("Kun tartibi — smena jadvali", () => {
  it("⭐ avtomatik ochish: kalit, vaqt qo'shish, qamrov; kechikish xabari: daqiqa va kanal → bitta smena PATCH", async () => {
    const user = userEvent.setup();
    render();
    const open = await screen.findByRole("region", { name: "Avtomatik ochish" });
    await user.click(within(open).getByRole("switch", { name: "Smenani avtomatik ochish" }));
    await user.click(within(open).getByRole("button", { name: "Vaqt qo'shish" }));
    await user.click(await screen.findByRole("option", { name: "07:30" }));
    expect(
      within(within(open).getByRole("list", { name: "Kuniga ochish vaqtlari" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["07:30", "08:00"]);
    await user.click(within(open).getByRole("radio", { name: "Asosiy kassa va filial kassalari" }));

    const late = screen.getByRole("region", { name: "Kechikish haqida xabar" });
    await user.click(within(late).getByRole("switch", { name: "Superadminlarga xabar yuborish" }));
    await user.click(within(late).getByRole("checkbox", { name: "Telegram" }));

    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    await waitFor(() =>
      expect(shiftPatches()).toEqual([
        {
          auto_open: { enabled: true, times: ["07:30", "08:00"], scope: "main+branches" },
          late_alert: { enabled: true, channels: { telegram: false } },
        },
      ]),
    );
    expect(intakePatches()).toEqual([]);
    expect(await screen.findByText("Kun tartibi saqlandi")).toBeInTheDocument();
  });

  it("avtomatik yopish (smena sozlamalaridan ko'chgan): kalit, vaqtlar (olib tashlash + qo'shish), qamrov, ogohlantirish", async () => {
    const user = userEvent.setup();
    render();
    const close = await screen.findByRole("region", { name: "Avtomatik yopish" });
    const enable = within(close).getByRole("switch", { name: "Smenani avtomatik yopish" });
    expect(enable).toHaveAttribute("aria-checked", "false");
    const times = within(close).getByRole("list", { name: "Kuniga yopish vaqtlari" });
    // Backend tartiblamagan bo'lsa ham — o'sish tartibida.
    expect(within(times).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["14:00", "23:00"]);

    await user.click(enable);
    await user.click(within(close).getByRole("button", { name: "14:00 ni olib tashlash" }));
    await user.click(within(close).getByRole("button", { name: "Vaqt qo'shish" }));
    await user.click(await screen.findByRole("option", { name: "09:30" }));
    expect(within(times).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["09:30", "23:00"]);
    await user.click(within(close).getByRole("radio", { name: "Asosiy kassa va filial kassalari" }));
    await user.click(within(close).getByRole("switch", { name: "Yopishdan 15 daqiqa oldin ogohlantirish" }));

    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    await waitFor(() =>
      expect(shiftPatches()).toEqual([
        { auto_close: { enabled: true, times: ["09:30", "23:00"], scope: "main+branches", warn_before_min: 0 } },
      ]),
    );
  });

  it("vaqtsiz yoqilgan jadval, ochish = yopish vaqti, kanalsiz xabar — kartada xato, «Saqlash» o'chiq", async () => {
    const user = userEvent.setup();
    render();
    const close = await screen.findByRole("region", { name: "Avtomatik yopish" });
    await user.click(within(close).getByRole("switch", { name: "Smenani avtomatik yopish" }));
    await user.click(within(close).getByRole("button", { name: "14:00 ni olib tashlash" }));
    await user.click(within(close).getByRole("button", { name: "23:00 ni olib tashlash" }));
    expect(within(close).getByText("Kamida bitta yopish vaqtini qo'shing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saqlash" })).toBeDisabled();

    // Yopishga «08:00» — u ochishda ham bor: ikkala kartada ziddiyat.
    await user.click(within(close).getByRole("button", { name: "Vaqt qo'shish" }));
    await user.click(await screen.findByRole("option", { name: "08:00" }));
    const open = screen.getByRole("region", { name: "Avtomatik ochish" });
    const conflict = "08:00 — ham ochish, ham yopish vaqti. Bittasini o'zgartiring";
    expect(within(open).getByText(conflict)).toBeInTheDocument();
    expect(within(close).getByText(conflict)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saqlash" })).toBeDisabled();
    await user.click(within(close).getByRole("button", { name: "08:00 ni olib tashlash" }));
    await user.click(within(close).getByRole("button", { name: "Vaqt qo'shish" }));
    await user.click(await screen.findByRole("option", { name: "22:00" }));
    expect(screen.getByRole("button", { name: "Saqlash" })).toBeEnabled();

    const late = screen.getByRole("region", { name: "Kechikish haqida xabar" });
    await user.click(within(late).getByRole("switch", { name: "Superadminlarga xabar yuborish" }));
    await user.click(within(late).getByRole("checkbox", { name: "Telegram" }));
    await user.click(within(late).getByRole("checkbox", { name: "Tizim" }));
    expect(within(late).getByText("Kamida bitta kanalni tanlang")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saqlash" })).toBeDisabled();
    expect(http.patch).not.toHaveBeenCalled();
  });

  it("eski backend (`auto_open` / `late_alert` yo'q): faqat «Avtomatik yopish» kartasi", async () => {
    server.shift = without(freshShift(), ["auto_open", "late_alert"]);
    render();
    expect(await screen.findByRole("region", { name: "Avtomatik yopish" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Avtomatik ochish" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Kechikish haqida xabar" })).toBeNull();
    // Izoh yo'q funksiyaga («Avtomatik ochish») ishora qilmaydi — avvalgidek «kassir o'zi ochadi».
    const close = screen.getByRole("region", { name: "Avtomatik yopish" });
    expect(within(close).getByText(/Keyingi smenani kassir o'zi ochadi\./)).toBeInTheDocument();
    expect(within(close).queryByText(/Avtomatik ochish/)).toBeNull();
  });

  it("yangi backend: yopish izohi «kassir yoki tizim»; vaqtlar soni — «Kuniga N marta»", async () => {
    render();
    const close = await screen.findByRole("region", { name: "Avtomatik yopish" });
    expect(within(close).getByText(/Keyingi smenani kassir ochadi yoki «Avtomatik ochish» yoqilgan bo'lsa — tizim\./)).toBeInTheDocument();
    expect(within(close).getByText("Kuniga 2 marta · Toshkent vaqti (UTC+5)")).toBeInTheDocument();
    const open = screen.getByRole("region", { name: "Avtomatik ochish" });
    expect(within(open).getByText("Kuniga 1 marta · Toshkent vaqti (UTC+5)")).toBeInTheDocument();
  });
});

describe("Kun tartibi — saqlash", () => {
  it("ikki PATCH mustaqil: biri yiqilsa (403) — qaysi qism saqlanmadi (backend matni) va qaysi biri saqlandi, qoralama qoladi", async () => {
    const user = userEvent.setup();
    const fallback = http.patch.getMockImplementation()!;
    http.patch.mockImplementation(async (url: string, body: Json) => {
      if (url === "orders/intake-settings") {
        throw Object.assign(new Error("403"), {
          response: { status: 403, data: { message: "Qabul vaqtini faqat superadmin o'zgartiradi" } },
        });
      }
      return fallback(url, body);
    });
    render();
    await screen.findByRole("region", { name: "Buyurtma qabuli" });
    await user.clear(field("Buyurtma yaratish chegarasi"));
    await user.type(field("Buyurtma yaratish chegarasi"), "1200");
    await user.click(within(screen.getByRole("region", { name: "Avtomatik ochish" })).getByRole("switch", { name: "Smenani avtomatik ochish" }));
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(await screen.findByText("Buyurtma qabuli saqlanmadi")).toBeInTheDocument();
    expect(screen.getByText("Qabul vaqtini faqat superadmin o'zgartiradi")).toBeInTheDocument();
    expect(screen.getByText("Smena jadvali saqlandi")).toBeInTheDocument();
    expect(screen.queryByText("Kun tartibi saqlanmadi")).toBeNull();
    expect(shiftPatches()).toEqual([{ auto_open: { enabled: true } }]);
    expect(field("Buyurtma yaratish chegarasi")).toHaveValue("12:00");
    await waitFor(() => expect(screen.getByRole("button", { name: "Saqlash" })).toBeEnabled());
  });

  it("ikkala PATCH ham yiqilsa — umumiy «Kun tartibi saqlanmadi» + backend matni", async () => {
    const user = userEvent.setup();
    http.patch.mockImplementation(async () => {
      throw Object.assign(new Error("500"), { response: { status: 500, data: { message: "Server javob bermadi" } } });
    });
    render();
    await screen.findByRole("region", { name: "Buyurtma qabuli" });
    await user.clear(field("Buyurtma yaratish chegarasi"));
    await user.type(field("Buyurtma yaratish chegarasi"), "1200");
    await user.click(within(screen.getByRole("region", { name: "Avtomatik ochish" })).getByRole("switch", { name: "Smenani avtomatik ochish" }));
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(await screen.findByText("Kun tartibi saqlanmadi")).toBeInTheDocument();
    expect(screen.getByText("Server javob bermadi")).toBeInTheDocument();
    expect(screen.queryByText("Smena jadvali saqlandi")).toBeNull();
  });

  it("buyurtma qabuli endpointi yo'q (404) va smena bloklari yo'q — «Kun tartibi hali mavjud emas»", async () => {
    server.intake = null;
    server.shift = { cards: [] };
    render();
    expect(await screen.findByText("Kun tartibi hali mavjud emas")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Saqlash" })).toBeNull();
  });
});
