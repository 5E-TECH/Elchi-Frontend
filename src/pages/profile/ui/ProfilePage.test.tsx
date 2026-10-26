import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { peekLoginNotice } from "../../../auth/loginNotice";
import { TELEGRAM_LINK_POLL_MS } from "../../../features/telegram-link/ui/TelegramLinkCard";
import type { User, UserRole } from "../../../entities/user/types/user";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
  logout: vi.fn(),
}));
vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, patch: mocks.patch, post: mocks.post, delete: mocks.delete },
}));
vi.mock("../../../shared/lib/useLogout", () => ({ useLogout: () => ({ logout: mocks.logout }) }));
// Boshqa foydalanuvchi sahifasi (`UserDetailView`) testi uchun — o'tkazish tugmasi filiallarni so'ramasin.
vi.mock("../../../features/courier-transfer-branch", () => ({ TransferCourierButton: () => null }));

import ProfilePage from "./ProfilePage";
import { UserDetailView } from "../../../widgets/user-detail/ui/UserDetailView";

/**
 * `/profile` (dizayn v2, maketlar `common-profile`, `common-profile-password-dialog`): ma'lumot kartasi, maosh
 * (faqat maoshli xodimda), parol oynasi (≥ 8 belgi — NDmZMzCP, takror mos; saqlangach boshqa qurilmalar chiqadi, shu qurilma
 * qoladi — «Sessiyalar» qayta so'raladi) va tahrirlash oynasi
 * (faqat o'zgargan maydonlar). Shuningdek o'z Telegram'ini botga ulash (BreQwksC) va marketda «Guruhda mijoz
 * ismi va telefoni» kaliti (ysBqD9Nx) — ikkalasi faqat shu sahifada (o'z profili).
 */

const baseProfile = {
  id: "1",
  name: "Shodiyor Ergashev",
  username: "shodiyor",
  phone_number: "+998907001234",
  role: "superadmin",
  status: "active",
  salary: 6_000_000,
  payment_day: 25,
  createdAt: "2026-01-14T09:00:00+05:00",
  updatedAt: "2026-10-02T09:00:00+05:00",
  branch: { id: "b1", branch_id: "7", branch: { id: "7", name: "Toshkent HQ" } },
};

let profile: Record<string, unknown> = baseProfile;

const patchCalls = () =>
  mocks.patch.mock.calls
    .filter(([url]) => url === "auth/my-profile")
    .map(([, body]) => body as Record<string, unknown>);

beforeEach(() => {
  profile = { ...baseProfile };
  window.sessionStorage.clear();
  mocks.logout.mockReset().mockResolvedValue(undefined);
  mocks.get
    .mockReset()
    .mockImplementation((url: string) =>
      url === "auth/my-profile"
        ? Promise.resolve({ data: { statusCode: 200, data: profile } })
        : Promise.resolve({ data: { data: {} } }),
    );
  mocks.patch.mockReset().mockResolvedValue({ data: { statusCode: 200, data: profile } });
  mocks.post.mockReset();
  mocks.delete.mockReset();
});

const open = async () => {
  const view = renderWithProviders(<ProfilePage />, { route: "/profile" });
  await screen.findByRole("heading", { name: "Shodiyor Ergashev" });
  return view;
};

describe("Profil — ma'lumot kartasi", () => {
  it("ism, login, rol va holat badge'lari, telefon, filial va sanalar", async () => {
    await open();
    expect(screen.getByRole("heading", { level: 1, name: "Profil" })).toBeInTheDocument();
    expect(screen.getByText("Login: shodiyor")).toBeInTheDocument();
    expect(screen.getByText("Superadmin")).toBeInTheDocument();
    expect(screen.getByText("Faol")).toBeInTheDocument();
    expect(screen.getByText("+998 90 700 12 34")).toBeInTheDocument();
    expect(screen.getByText("Toshkent HQ")).toBeInTheDocument();
    expect(screen.getByText("14.01.2026")).toBeInTheDocument();
    expect(screen.getByText("02.10.2026")).toBeInTheDocument();
  });

  it("login va filial bo'lmasa — o'sha qatorlar chizilmaydi", async () => {
    profile = { ...baseProfile, username: null, branch: null };
    await open();
    expect(screen.queryByText(/^Login:/)).not.toBeInTheDocument();
    expect(screen.queryByText("Filial")).not.toBeInTheDocument();
  });
});

describe("Profil — oylik maosh", () => {
  it("maoshli xodimda karta bor: to'plangan / maosh, foiz va progress", async () => {
    await open();
    const card = screen.getByRole("region", { name: "Oylik maosh" });
    expect(within(card).getByText("Shu davrda to'plangan")).toBeInTheDocument();
    expect(within(card).getByText(/6 000 000 so'm/)).toBeInTheDocument();
    expect(within(card).getByRole("progressbar", { name: "Maosh davri" })).toHaveAttribute(
      "aria-valuemax",
      "100",
    );
  });

  it.each([
    ["maosh 0", { salary: 0 }],
    ["kuryer (maoshli rol emas)", { role: "courier", salary: 3_000_000 }],
  ])("%s — karta yo'q", async (_label, over) => {
    profile = { ...baseProfile, ...over };
    await open();
    expect(screen.queryByRole("region", { name: "Oylik maosh" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Xavfsizlik" })).toBeInTheDocument();
  });
});

describe("Profil — parolni o'zgartirish", () => {
  const openDialog = async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Parolni o'zgartirish" }));
    return screen.findByRole("dialog", { name: "Parolni o'zgartirish" });
  };

  it("bo'sh, qisqa va mos kelmagan parol yuborilmaydi", async () => {
    const dialog = await openDialog();
    expect(within(dialog).getByText("Shodiyor Ergashev ·", { exact: false })).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Parolni saqlash" }));
    expect(within(dialog).getByText("Yangi parolni kiriting")).toBeInTheDocument();

    const [first, second] = within(dialog).getAllByPlaceholderText(/parol/i);
    await userEvent.type(first, "abc");
    await userEvent.type(second, "abc");
    await userEvent.click(within(dialog).getByRole("button", { name: "Parolni saqlash" }));
    expect(
      within(dialog).getByText("Parol kamida 8 ta belgidan iborat bo'lsin"),
    ).toBeInTheDocument();

    await userEvent.clear(first);
    await userEvent.type(first, "namuna12");
    await userEvent.clear(second);
    await userEvent.type(second, "namuna13");
    await userEvent.click(within(dialog).getByRole("button", { name: "Parolni saqlash" }));
    expect(within(dialog).getByText("Parollar mos kelmadi")).toBeInTheDocument();

    // Faqat bo'shliqdan iborat parol — bo'sh (eski modal `trim()` qoidasi).
    await userEvent.clear(first);
    await userEvent.type(first, "    ");
    await userEvent.clear(second);
    await userEvent.type(second, "    ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Parolni saqlash" }));
    expect(within(dialog).getByText("Yangi parolni kiriting")).toBeInTheDocument();
    expect(patchCalls()).toEqual([]);
  });

  it("mos kelsa yashil izoh; saqlansa faqat `{ password }` ketadi, «boshqa qurilmalardan chiqildi», shu qurilma qoladi", async () => {
    const dialog = await openDialog();
    expect(
      within(dialog).getByText("Saqlangach, boshqa barcha qurilmalar hisobingizdan darhol chiqadi. Shu qurilma tizimda qoladi."),
    ).toBeInTheDocument();
    const sessionCalls = () => mocks.get.mock.calls.filter(([url]) => url === "auth/sessions").length;
    await waitFor(() => expect(sessionCalls()).toBe(1));
    const [first, second] = within(dialog).getAllByPlaceholderText(/parol/i);
    expect(first).toHaveAttribute("type", "password");
    await userEvent.click(within(dialog).getAllByRole("button", { name: "Parolni ko'rsatish" })[0]);
    expect(first).toHaveAttribute("type", "text");

    await userEvent.type(first, "namuna12");
    await userEvent.type(second, "namuna12");
    expect(within(dialog).getByText("Parollar mos keladi")).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Parolni saqlash" }));
    await waitFor(() => expect(patchCalls()).toEqual([{ password: "namuna12" }]));
    expect(await screen.findByText("Parol almashtirildi — boshqa qurilmalardan chiqildi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Parolni o'zgartirish" })).not.toBeInTheDocument());
    // Backend boshqa qurilmalarni chiqardi — «Sessiyalar» qayta so'raladi; shu qurilma tizimda qoladi.
    await waitFor(() => expect(sessionCalls()).toBe(2));
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(peekLoginNotice()).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Profil" })).toBeInTheDocument();
  });

  it("backend rad etsa — chiqilmaydi, oyna ochiq qoladi, xato ko'rinadi", async () => {
    mocks.patch.mockRejectedValueOnce({
      response: {
        status: 400,
        data: { message: "Parol juda oddiy", errors: { password: ["Parol juda oddiy"] } },
      },
    });
    const dialog = await openDialog();
    const [first, second] = within(dialog).getAllByPlaceholderText(/parol/i);
    await userEvent.type(first, "11111111");
    await userEvent.type(second, "11111111");
    await userEvent.click(within(dialog).getByRole("button", { name: "Parolni saqlash" }));

    expect(await within(dialog).findByText("Parol juda oddiy")).toBeInTheDocument();
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("elchi_login_notice")).toBeNull();
  });
});

describe("Profil — tahrirlash", () => {
  const openDialog = async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Tahrirlash" }));
    return screen.findByRole("dialog", { name: "Profilni tahrirlash" });
  };

  it("faqat o'zgargan maydon yuboriladi (ism)", async () => {
    const dialog = await openDialog();
    const name = within(dialog).getByRole("textbox", { name: /Ism/ });
    await userEvent.clear(name);
    await userEvent.type(name, "  Shodiyor Ergash  ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(patchCalls()).toEqual([{ name: "Shodiyor Ergash" }]));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Profilni tahrirlash" })).not.toBeInTheDocument(),
    );
  });

  it("telefon o'zgarsa `+998…` ko'rinishida", async () => {
    const dialog = await openDialog();
    const phone = within(dialog).getByRole("textbox", { name: /Telefon/ });
    await userEvent.clear(phone);
    await userEvent.type(phone, "901112233");
    await userEvent.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(patchCalls()).toEqual([{ phone_number: "+998901112233" }]));
  });

  it("o'zgarish yo'q — so'rov ketmaydi, oyna yopiladi; noto'liq telefon — xato", async () => {
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Profilni tahrirlash" })).not.toBeInTheDocument(),
    );
    expect(patchCalls()).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "Tahrirlash" }));
    const again = await screen.findByRole("dialog", { name: "Profilni tahrirlash" });
    const phone = within(again).getByRole("textbox", { name: /Telefon/ });
    await userEvent.clear(phone);
    await userEvent.type(phone, "9011");
    await userEvent.click(within(again).getByRole("button", { name: "Saqlash" }));
    expect(within(again).getByText("9 ta raqam kiriting")).toBeInTheDocument();
    expect(patchCalls()).toEqual([]);
  });

  it("1 belgili ism — yuborilmaydi (backend `@MinLength(2)`)", async () => {
    const dialog = await openDialog();
    const name = within(dialog).getByRole("textbox", { name: /Ism/ });
    await userEvent.clear(name);
    await userEvent.type(name, "S");
    await userEvent.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    expect(
      within(dialog).getByText("Ism kamida 2 ta belgidan iborat bo'lsin"),
    ).toBeInTheDocument();
    expect(patchCalls()).toEqual([]);
  });
});

/**
 * O'z profilida «Telegram» kartasi (BreQwksC): oyna ochiq turganda profil qayta o'qiladi va bot ulagach
 * (`telegram_linked: true`) oyna o'zi yopiladi. Karta faqat o'z profilida va faqat xodimlarga chiziladi.
 */

const makeUser = (role: UserRole, overrides: Partial<User> = {}): User => ({
  id: "263",
  name: "E2E Kuryer",
  phone_number: "+998901112233",
  username: "e2e_kuryer",
  role,
  status: "active",
  salary: 0,
  payment_day: null,
  createdAt: "2026-09-01T09:00:00.000Z",
  updatedAt: "2026-09-30T09:00:00.000Z",
  is_deleted: false,
  tariff_home: null,
  tariff_center: null,
  default_tariff: "home",
  ...overrides,
});

const roleState = (role: string, id = `${role}-1`) =>
  ({ role: { id, role, region: null, name: role } }) as never;

const serveProfile = (getUser: () => User) =>
  mocks.get.mockImplementation((url: string) =>
    url === "auth/my-profile"
      ? Promise.resolve({ data: { statusCode: 200, message: "ok", data: getUser() } })
      : Promise.resolve({ data: {} }),
  );

describe("Profil — Telegram'ni ulash", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("oyna ochiq turganda profil qayta o'qiladi; bot ulagach oyna yopiladi va karta «Ulangan»", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    let linked = false;
    serveProfile(() => makeUser("courier", { telegram_linked: linked }));
    mocks.post.mockResolvedValue({
      data: {
        statusCode: 200,
        message: "Telegram link",
        data: {
          token: "Kod123",
          purpose: "user",
          expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
          deep_link: "https://t.me/elchi_test_bot?start=Kod123",
          command: "/start Kod123",
        },
      },
    });
    renderWithProviders(<ProfilePage />, { route: "/profile", preloadedState: roleState("courier") });

    const card = await screen.findByRole("region", { name: "Telegram" });
    expect(within(card).getByText("Ulanmagan")).toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: "Telegram'ni ulash" }));
    expect(mocks.post).toHaveBeenCalledWith("users/me/telegram/link-code");
    const dialog = await screen.findByRole("dialog", { name: "Telegram'ni ulash" });
    expect(
      await within(dialog).findByRole("img", { name: "Telegram'ni ulash havolasining QR kodi" }),
    ).toBeInTheDocument();
    const profileCalls = () =>
      mocks.get.mock.calls.filter(([url]) => url === "auth/my-profile").length;
    const before = profileCalls();

    // Hali ulanmagan — oyna ochiq qoladi, profil so'ralaveradi.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TELEGRAM_LINK_POLL_MS);
    });
    expect(profileCalls()).toBeGreaterThan(before);
    expect(dialog).toBeInTheDocument();

    // Foydalanuvchi botda «Start» ni bosdi.
    linked = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TELEGRAM_LINK_POLL_MS);
    });

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Telegram'ni ulash" })).not.toBeInTheDocument(),
    );
    expect(await screen.findByText("Telegram ulandi")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Telegram" })).getByText("Ulangan"),
    ).toBeInTheDocument();

    // Oyna yopilgach so'rash to'xtaydi.
    const afterLinked = profileCalls();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TELEGRAM_LINK_POLL_MS * 2);
    });
    expect(profileCalls()).toBe(afterLinked);
  });

  it("mijozning o'z profilida karta yo'q", async () => {
    serveProfile(() => makeUser("customer", { name: "Mijoz" }));
    renderWithProviders(<ProfilePage />, { route: "/profile", preloadedState: roleState("customer") });

    expect(await screen.findAllByText("Mijoz")).not.toHaveLength(0);
    expect(screen.queryByRole("region", { name: "Telegram" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Telegram'ni ulash" })).not.toBeInTheDocument();
  });

  it.each(["courier", "market", "manager", "registrator", "admin", "superadmin"] as const)(
    "%s o'z profilida kartani ko'radi",
    async (role) => {
      serveProfile(() => makeUser(role));
      renderWithProviders(<ProfilePage />, { route: "/profile", preloadedState: roleState(role) });

      expect(await screen.findByRole("region", { name: "Telegram" })).toBeInTheDocument();
    },
  );

  it("boshqa foydalanuvchining sahifasida (superadmin kuryerni ko'rmoqda) karta yo'q", () => {
    renderWithProviders(<UserDetailView user={makeUser("courier", { telegram_linked: true })} />, {
      preloadedState: roleState("superadmin"),
    });

    expect(screen.getByRole("heading", { level: 1, name: "E2E Kuryer" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Telegram" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Uzish" })).not.toBeInTheDocument();
  });
});

describe("Profil — market: «Guruhda mijoz ismi va telefoni» (ysBqD9Nx)", () => {
  const piiSwitch = () => screen.findByRole("switch", { name: "Guruhda mijoz ismi va telefoni" });

  it("market o'z profilida kalitni o'zgartiradi: PATCH, profil qayta o'qiladi, «Saqlandi»", async () => {
    let server = makeUser("market", { id: "201", name: "Baraka Shop", tg_group_show_customer_pii: true });
    serveProfile(() => server);
    mocks.patch.mockImplementation(async (url: string, body: Record<string, unknown>) => {
      if (url === "markets/201/telegram-group-pii") server = { ...server, ...body };
      return { data: { statusCode: 200, data: server } };
    });
    renderWithProviders(<ProfilePage />, { route: "/profile", preloadedState: roleState("market", "201") });

    const control = await piiSwitch();
    expect(control).toBeEnabled();
    expect(control).toHaveAttribute("aria-checked", "true");
    const profileGets = () => mocks.get.mock.calls.filter(([url]) => url === "auth/my-profile").length;
    const before = profileGets();

    await userEvent.click(control);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith("markets/201/telegram-group-pii", {
        tg_group_show_customer_pii: false,
      }),
    );
    expect(await screen.findByText("Saqlandi")).toBeInTheDocument();
    await waitFor(() => expect(profileGets()).toBeGreaterThan(before));
    expect(control).toHaveAttribute("aria-checked", "false");
  });

  it("o'z profilida (superadmin bo'lsa ham) «Telegram token» kartasi yo'q, token so'ralmaydi (fix3b GvL6ZFAd)", async () => {
    serveProfile(() => makeUser("market", { id: "201", name: "Baraka Shop" }));
    renderWithProviders(<ProfilePage />, { route: "/profile", preloadedState: roleState("market", "201") });

    await piiSwitch();
    expect(screen.queryByRole("region", { name: "Telegram token" })).not.toBeInTheDocument();
    expect(mocks.get.mock.calls.some(([url]) => String(url).endsWith("/tg-token"))).toBe(false);
  });

  it("market (maket `market-profile`, TG-B): «Xavfsizlik» va «Telegram» bir qatorda, ostida «Telegram guruhi», kalit shu kartada", async () => {
    serveProfile(() => makeUser("market", { id: "201", name: "Baraka Shop" }));
    renderWithProviders(<ProfilePage />, { route: "/profile", preloadedState: roleState("market", "201") });

    const groups = await screen.findByRole("region", { name: "Telegram guruhi" });
    const security = screen.getByRole("region", { name: "Xavfsizlik" });
    const telegram = screen.getByRole("region", { name: "Telegram" });
    // Bir qator: ikkala karta bitta o'ramda, «Telegram guruhi» — undan keyin.
    expect(security.parentElement).toBe(telegram.parentElement?.parentElement);
    expect(security.compareDocumentPosition(groups) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(groups).getByRole("switch", { name: "Guruhda mijoz ismi va telefoni" })).toBeEnabled();
  });

  it("TG-C (`market-profile-telegram-status`): holat `GET notifications/me/telegram-groups` dan — ulangan turda «Ulash» yo'q", async () => {
    const market = makeUser("market", { id: "201", name: "Baraka Shop" });
    mocks.get.mockImplementation((url: string) => {
      if (url === "auth/my-profile") return Promise.resolve({ data: { statusCode: 200, data: market } });
      if (url === "notifications/me/telegram-groups") {
        return Promise.resolve({
          data: {
            statusCode: 200,
            data: [
              { group_type: "create", linked: true, is_active: true, linked_at: "2026-10-06T09:00:00.000Z", inactive_reason: null },
              { group_type: "cancel", linked: false, is_active: null, linked_at: null, inactive_reason: null },
            ],
          },
        });
      }
      return Promise.resolve({ data: {} });
    });
    renderWithProviders(<ProfilePage />, { route: "/profile", preloadedState: roleState("market", "201") });

    const groups = await screen.findByRole("region", { name: "Telegram guruhi" });
    expect(await within(groups).findByText("06.10.2026 dan")).toBeInTheDocument();
    expect(within(groups).getByText("Ulangan")).toBeInTheDocument();
    expect(within(groups).getByText("Ulanmagan")).toBeInTheDocument();
    expect(within(groups).getAllByRole("button", { name: /guruhini ulash/ }).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Bekor qilinganlar guruhini ulash",
    ]);
    // Xodim ro'yxati (`GET /notifications`) marketga yopiq — so'ralmaydi.
    expect(mocks.get.mock.calls.some(([url]) => url === "notifications")).toBe(false);
  });

  it("market bo'lmagan rolda kalit yo'q", async () => {
    serveProfile(() => makeUser("courier"));
    renderWithProviders(<ProfilePage />, { route: "/profile", preloadedState: roleState("courier") });

    await screen.findByRole("region", { name: "Telegram" });
    expect(screen.queryByRole("switch", { name: "Guruhda mijoz ismi va telefoni" })).not.toBeInTheDocument();
  });
});
