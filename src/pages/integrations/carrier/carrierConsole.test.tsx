import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { Route, Routes } from "react-router-dom";
import { queryKeys } from "../../../shared/config/queryKeys";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * TASHQI YETKAZUVCHILAR KONSOLI — asosiy oqimlar (maket `*-carrier-console` va `*-carrier-*-dialog`):
 * ro'yxat holatlari, yaratish → kalit BIR MARTA, kuryer tanlovi qoidalari, server rad javoblari, kalitni yangilash,
 * to'xtatish (tasdiq bilan), tahrirlash (IP qatorma-qator). `notify` / `confirm` mock qilinmaydi — haqiqiy UI.
 *
 * Konsol `<StrictMode>` ichida chiziladi — ilovadagidek (`main.tsx`): effektlar ikki marta ishga tushadi.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));

vi.mock("../../../shared/api/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../shared/api/api")>();
  return {
    ...original,
    api: { ...original.api, get: mocks.get, post: mocks.post, patch: mocks.patch },
  };
});

import { CarrierConsole } from "./CarrierConsole";

const httpError = (status: number, message: string) => {
  const error = new AxiosError("Request failed");
  error.response = {
    status,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { statusCode: status, message },
  };
  return error;
};

const ACCOUNTS = [
  {
    id: "3",
    name: "FastPost Logistics",
    courier_user_id: "55",
    ip_allowlist: ["203.0.113.10", "198.51.100.0/24"],
    is_active: true,
    createdAt: "2026-11-09T05:15:00.000Z",
    updatedAt: "2026-11-10T04:40:00.000Z",
  },
  {
    id: "2",
    name: "Samarqand Ekspress",
    courier_user_id: "66",
    ip_allowlist: null,
    is_active: true,
    createdAt: "2026-11-06T10:40:00.000Z",
    updatedAt: "2026-11-06T10:40:00.000Z",
  },
  {
    id: "1",
    name: "Vodiy Kargo",
    courier_user_id: "77",
    ip_allowlist: ["203.0.113.0/24"],
    is_active: false,
    createdAt: "2026-11-03T06:20:00.000Z",
    updatedAt: "2026-11-03T06:20:00.000Z",
  },
];

const USERS: Record<string, Record<string, unknown>> = {
  "55": {
    id: "55",
    name: "FastPost kuryeri",
    phone_number: "+998909774040",
    status: "active",
    role: "courier",
    branch: { id: "1", name: "Toshkent HQ" },
    tariff_home: 30000,
    tariff_center: 25000,
  },
  "66": {
    id: "66",
    name: "Samarqand Ekspress kuryeri",
    phone_number: "+998972140866",
    status: "blocked",
    role: "courier",
    branch: { id: "1", name: "Toshkent HQ" },
    tariff_home: 20000,
    tariff_center: 15000,
  },
  "88": {
    id: "88",
    name: "Shahar Kargo kuryeri",
    phone_number: "+998935551820",
    status: "active",
    role: "courier",
    branch: { id: "1", name: "Toshkent HQ" },
    tariff_home: 25000,
    tariff_center: 20000,
  },
  "99": {
    id: "99",
    name: "Rustam Qodirov",
    phone_number: "+998974551209",
    status: "active",
    role: "courier",
    branch: { id: "9", name: "Samarqand filiali" },
    tariff_home: 25000,
    tariff_center: 20000,
  },
  "91": {
    id: "91",
    name: "Sanjar Xudoyberdiyev",
    phone_number: "+998915073318",
    status: "inactive",
    role: "courier",
    branch: { id: "5", name: "Farg'ona filiali" },
    tariff_home: 25000,
    tariff_center: 20000,
  },
};

let accounts = ACCOUNTS;

const routeGet = (url: string, config?: { params?: Record<string, unknown> }) => {
  if (url === "admin/carriers")
    return Promise.resolve({
      data: { statusCode: 200, message: "carrier accounts", data: accounts },
    });
  if (url === "branches/hq")
    return Promise.resolve({
      data: { statusCode: 200, data: { id: "1", name: "Toshkent HQ", type: "HQ" } },
    });
  if (url === "users") {
    return Promise.resolve({
      data: {
        statusCode: 200,
        data: {
          items: Object.values(USERS),
          meta: { page: 1, limit: 50, total: 5, totalPages: 1 },
        },
      },
    });
  }
  const user = /^users\/(\d+)$/.exec(url);
  if (user) {
    const row = USERS[user[1]];
    return row
      ? Promise.resolve({ data: { statusCode: 200, data: row } })
      : Promise.reject(httpError(404, "Foydalanuvchi topilmadi"));
  }
  const cash = /^finance\/cashbox\/user\/(\d+)$/.exec(url);
  if (cash) {
    const box = CASHBOXES[cash[1]];
    if (!box) return Promise.reject(httpError(404, "Kassa topilmadi"));
    // Backend kabi: `with_history` siz — faqat kassaning o'zi (C3 maydonlari `olinishi_kerak` … faqat tarix bilan).
    return Promise.resolve({
      data: { statusCode: 200, data: config?.params?.with_history ? box : box.cashbox },
    });
  }
  return Promise.resolve({ data: { statusCode: 200, data: [] } });
};

/**
 * `GET finance/cashbox/user/:id?cashbox_type=couriers&with_history=true` (superadmin, C3): kassa + `olinishi_kerak`.
 * 55 — HQ kuryeri, savdo kutilmaydi (balans = qabul qilinadigan); 99 — HQ emas: balans bor, lekin superadmin qabul
 * qilmaydi (0). `with_history` siz backend faqat `cashbox` ni qaytaradi (`routeGet`).
 */
const CASHBOXES: Record<string, { cashbox: Record<string, unknown> } & Record<string, unknown>> = {
  "55": {
    cashbox: { id: "c55", cashbox_type: "couriers", balance: 2340000 },
    history: [],
    is_hq_courier: true,
    can_receive: true,
    olinishi_kerak: 2340000,
  },
  "99": {
    cashbox: { id: "c99", cashbox_type: "couriers", balance: 500000 },
    history: [],
    is_hq_courier: false,
    can_receive: false,
    olinishi_kerak: 0,
  },
};

const getCalls = (url: string) => mocks.get.mock.calls.filter(([called]) => called === url).length;

/** «Qabul qilinishi kerak» qatorining qiymati (`dt` → `dd`). */
const receivableOf = (scope: HTMLElement) =>
  within(scope).getByText("Qabul qilinishi kerak").nextElementSibling as HTMLElement;

const fillCreate = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) => {
  await user.type(within(dialog).getByRole("textbox", { name: /Kompaniya nomi/ }), "Shahar Kargo");
  await user.click(within(dialog).getByRole("combobox", { name: /Kuryer/ }));
  await user.click(await screen.findByRole("option", { name: /Shahar Kargo kuryeri/ }));
};

const SUPERADMIN = { role: { id: "1", role: "superadmin", region: null, name: "SA" } } as never;

const open = (search = "?scope=carrier") =>
  renderWithProviders(
    <StrictMode>
      <CarrierConsole tabs={null} />
    </StrictMode>,
    {
      route: `/integrations/connections${search}`,
      preloadedState: SUPERADMIN,
    },
  );

const card = () => screen.getByRole("region", { name: /FastPost Logistics/ });

/** `POST admin/carriers` muvaffaqiyatli javobi — bir martalik kalit bilan. */
const createdResponse = (apiKey: string) => ({
  data: {
    statusCode: 201,
    data: {
      id: "4",
      name: "Shahar Kargo",
      courier_user_id: "88",
      ip_allowlist: null,
      is_active: true,
      createdAt: "",
      updatedAt: "",
      courier_name: "Shahar Kargo kuryeri",
      api_key: apiKey,
    },
  },
});

/** Javobi qo'lda beriladigan so'rov (sekin tarmoq): `release` chaqirilguncha osilib turadi. */
const deferred = () => {
  let release: (value: unknown) => void = () => {};
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  return { promise, release: (value: unknown) => release(value) };
};

const REFRESH_ERROR = "Ro'yxatni yangilab bo'lmadi — ko'rsatilgan ma'lumot eskirgan bo'lishi mumkin.";

describe("Tashqi yetkazuvchilar konsoli", () => {
  beforeEach(() => {
    accounts = ACCOUNTS;
    mocks.get.mockReset();
    mocks.post.mockReset();
    mocks.patch.mockReset();
    mocks.get.mockImplementation((url: string, config?: { params?: Record<string, unknown> }) =>
      routeGet(String(url), config),
    );
  });

  it("⭐ ro'yxat: holatlar backend ma'lumotidan — Faol / Kuryer nofaol / To'xtatilgan, kuryer users/:id dan", async () => {
    open();
    const table = await screen.findByRole("table", { name: "Tashqi yetkazuvchilar ro'yxati" });
    expect(await within(table).findByText("FastPost kuryeri")).toBeInTheDocument();
    const rows = within(table).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Faol");
    expect(rows[1]).toHaveTextContent("2 ta qoida");
    await waitFor(() => expect(rows[2]).toHaveTextContent("Kuryer nofaol"));
    expect(rows[2]).toHaveTextContent("Kalit ishlamayapti");
    expect(rows[2]).toHaveTextContent("Cheklov yo'q");
    // 77 — users/:id 404: kuryer o'chirilgan.
    await waitFor(() => expect(rows[3]).toHaveTextContent("Kuryer topilmadi"));
    expect(rows[3]).toHaveTextContent("Kuryer ID 77 — ismi va telefoni yo'q");
    expect(mocks.get).toHaveBeenCalledWith("admin/carriers");
  });

  it("⭐ tafsilot: kuryer filiali, tarif, «Qabul qilinishi kerak», HQ izohi, kalit qayta ko'rsatilmaydi", async () => {
    open();
    const detail = await screen.findByRole("region", { name: /FastPost Logistics/ });
    expect(await within(detail).findByText("Toshkent HQ")).toBeInTheDocument();
    expect(within(detail).getByText(/uyga 30 000 · markazga 25 000 so'm/)).toBeInTheDocument();
    expect(await within(detail).findByText("2 340 000 so'm")).toBeInTheDocument();
    expect(
      within(detail).getByText(/HQ kuryeri — kompaniya topshirgan naqdni/),
    ).toBeInTheDocument();
    expect(within(detail).getByText("203.0.113.10")).toBeInTheDocument();
    expect(
      within(detail).getByText("Faqat bir marta ko'rsatiladi — yangilash mumkin"),
    ).toBeInTheDocument();
    expect(within(detail).getByRole("link", { name: /Kuryer kassasi/ })).toHaveAttribute(
      "href",
      "/payments/cash-detail/55?type=courier",
    );
    // `with_history` — busiz backend C3 maydonlarini (`olinishi_kerak`) qo'shmaydi; tarixdan 1 qator yetadi.
    expect(mocks.get).toHaveBeenCalledWith("finance/cashbox/user/55", {
      params: { cashbox_type: "couriers", with_history: true, page: 1, limit: 1 },
    });
  });

  it("⭐ yaratish → kalit BIR MARTA: «nusxaladim» belgisisiz yopilmaydi, yopilgach kalit DOM'da va keshda qolmaydi", async () => {
    const user = userEvent.setup();
    mocks.post.mockResolvedValue({
      data: {
        statusCode: 201,
        data: {
          id: "4",
          name: "Shahar Kargo",
          courier_user_id: "88",
          ip_allowlist: null,
          is_active: true,
          createdAt: "",
          updatedAt: "",
          courier_name: "Shahar Kargo kuryeri",
          api_key: "elc_secret_key_value",
        },
      },
    });
    const { queryClient } = open("?scope=carrier&new=1");
    /** So'rov va mutatsiya keshidagi hamma ma'lumot — kalit hech birida bo'lmasligi kerak. */
    const cached = () =>
      JSON.stringify([
        queryClient.getMutationCache().getAll().map((mutation) => mutation.state.data ?? null),
        queryClient.getQueryCache().getAll().map((query) => query.state.data ?? null),
      ]);
    const dialog = await screen.findByRole("dialog", { name: "Yangi tashqi yetkazuvchi" });
    await user.type(
      within(dialog).getByRole("textbox", { name: /Kompaniya nomi/ }),
      "Shahar Kargo",
    );

    await user.click(within(dialog).getByRole("combobox", { name: /Kuryer/ }));
    // Bog'langan (FastPost — yoqiq, Samarqand — yoqiq) va nofaol kuryer tanlab bo'lmaydi, sababi bilan.
    expect(
      await screen.findByRole("option", {
        name: /FastPost kuryeri.*Allaqachon «FastPost Logistics» akkauntiga bog'langan/,
      }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("option", { name: /Sanjar Xudoyberdiyev.*Nofaol/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(
      screen.getByRole("option", {
        name: /Rustam Qodirov.*HQ emas — naqdni filial menejeri oladi/,
      }),
    ).not.toHaveAttribute("aria-disabled");
    await user.click(screen.getByRole("option", { name: /Shahar Kargo kuryeri/ }));
    expect(
      within(dialog).getByText(
        /Toshkent HQ kuryeri — naqdni asosiy kassaga o'zingiz qabul qilasiz/,
      ),
    ).toBeInTheDocument();

    // IP: xato qator — yuborilmaydi.
    const ip = within(dialog).getByRole("textbox", { name: /IP ro'yxati/ });
    await user.type(ip, "203.0.113.7/16");
    expect(
      within(dialog).getByText("Diapazon tarmoq manzili bilan yozilsin: 203.0.0.0/16"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("1 ta qatorda xato — tuzating yoki o'chiring"),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Yaratish va kalit olish" }));
    expect(mocks.post).not.toHaveBeenCalled();

    await user.clear(ip);
    await user.type(ip, "203.0.113.10");
    await user.click(within(dialog).getByRole("button", { name: "Yaratish va kalit olish" }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        "admin/carriers",
        { name: "Shahar Kargo", courier_id: "88", ip_allowlist: ["203.0.113.10"] },
        expect.objectContaining({ timeout: 30_000 }),
      ),
    );

    const keyDialog = await screen.findByRole("dialog", {
      name: "API kalit — bir marta ko'rsatiladi",
    });
    expect(within(keyDialog).getByDisplayValue("elc_secret_key_value")).toBeInTheDocument();
    // Kalit faqat oynada: mutatsiya `reset()` + `gcTime: 0` — keshlarda yo'q (oyna ochiq turganda ham).
    await waitFor(() => expect(cached()).not.toContain("elc_secret_key_value"));
    const done = within(keyDialog).getByRole("button", { name: "Yakunlash" });
    expect(done).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("dialog", { name: "API kalit — bir marta ko'rsatiladi" }),
    ).toBeInTheDocument();

    // «Nusxaladim» belgisisiz sahifani yangilash / yopish — brauzer tasdig'i (`beforeunload`).
    const leave = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(leave()).toBe(true);

    await user.click(
      within(keyDialog).getByRole("checkbox", { name: "Kalitni nusxaladim va xavfsiz saqladim" }),
    );
    expect(leave()).toBe(false);
    await user.click(done);
    await waitFor(() =>
      expect(screen.queryByDisplayValue("elc_secret_key_value")).not.toBeInTheDocument(),
    );
    // `?new=1` URL'dan olingan — yaratish oynasi qayta ochilmaydi, kalit boshqa joyda ko'rinmaydi.
    expect(screen.queryByRole("dialog", { name: "Yangi tashqi yetkazuvchi" })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("elc_secret_key_value");
    expect(cached()).not.toContain("elc_secret_key_value");
  });

  it("⭐ yaratishda 409 — xato forma tepasida; ro'yxat yangilangach akkaunt nomi va «ochish» (courier_user_id)", async () => {
    const user = userEvent.setup();
    mocks.post.mockRejectedValue(
      httpError(409, 'Bu kurier allaqachon "Shahar Kargo Old" carrier akkauntiga bog\'langan (id 5)'),
    );
    open("?scope=carrier&new=1");
    const dialog = await screen.findByRole("dialog", { name: "Yangi tashqi yetkazuvchi" });
    await fillCreate(user, dialog);
    // Poyga: kuryer boshqa oynada hozirgina bog'landi — yuklangan ro'yxatda hali yo'q, server 409 beradi.
    accounts = [
      {
        id: "5",
        name: "Shahar Kargo Old",
        courier_user_id: "88",
        ip_allowlist: null,
        is_active: true,
        createdAt: "2026-11-10T09:00:00.000Z",
        updatedAt: "2026-11-10T09:00:00.000Z",
      },
      ...ACCOUNTS,
    ];
    await user.click(within(dialog).getByRole("button", { name: "Yaratish va kalit olish" }));

    const alert = (await within(dialog).findByText("Yaratilmadi: kuryer band")).closest(
      "[role=alert]",
    ) as HTMLElement;
    // Xatodan keyin ro'yxat yangilanadi (`onSettled`) — matn nomli bo'ladi va akkauntni ochish mumkin.
    const openButton = await within(alert).findByRole("button", {
      name: "«Shahar Kargo Old»ni ochish",
    });
    expect(alert).toHaveTextContent("allaqachon «Shahar Kargo Old» akkauntiga bog'langan (ID 5)");
    await user.click(openButton);
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Yangi tashqi yetkazuvchi" })).not.toBeInTheDocument(),
    );
    expect(await screen.findByRole("region", { name: /Shahar Kargo Old/ })).toBeInTheDocument();
  });

  it("⭐ yaratishda javob kelmadi — «Javob kelmadi», «Ro'yxatni yangilash» ro'yxatni so'raydi, forma qayta ochilmaydi", async () => {
    const user = userEvent.setup();
    mocks.post.mockRejectedValue(new AxiosError("timeout of 30000ms exceeded", "ECONNABORTED"));
    open("?scope=carrier&new=1");
    const dialog = await screen.findByRole("dialog", { name: "Yangi tashqi yetkazuvchi" });
    await fillCreate(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Yaratish va kalit olish" }));

    const unknown = await screen.findByRole("alertdialog", { name: "Javob kelmadi" });
    expect(unknown).toHaveTextContent("Akkaunt yaratilgan bo'lishi mumkin");
    expect(unknown).toHaveTextContent("«Shahar Kargo» ro'yxatda bo'lsa");
    // Natija noma'lum — ro'yxat baribir yangilanadi (`onSettled`); × yo'q (maket `cc4`).
    await waitFor(() => expect(getCalls("admin/carriers")).toBeGreaterThanOrEqual(2));
    expect(within(unknown).getAllByRole("button", { name: "Yopish" })).toHaveLength(1);

    const before = getCalls("admin/carriers");
    await user.click(within(unknown).getByRole("button", { name: /Ro'yxatni yangilash/ }));
    await waitFor(() => expect(getCalls("admin/carriers")).toBeGreaterThan(before));
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog", { name: "Javob kelmadi" })).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("dialog", { name: "Yangi tashqi yetkazuvchi" })).not.toBeInTheDocument();
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it("yaratishda 503 — «Kuryerni tekshirib bo'lmadi», hech narsa yaratilmadi", async () => {
    const user = userEvent.setup();
    mocks.post.mockRejectedValue(
      httpError(503, "Kurierni tekshirib bo'lmadi — identity xizmati javob bermadi"),
    );
    open("?scope=carrier&new=1");
    const dialog = await screen.findByRole("dialog", { name: "Yangi tashqi yetkazuvchi" });
    await fillCreate(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Yaratish va kalit olish" }));
    const title = await within(dialog).findByText("Kuryerni tekshirib bo'lmadi");
    expect(title.closest("[role=alert]")).toHaveTextContent("hech narsa yaratilmadi");
    expect(screen.queryByRole("alertdialog", { name: "Javob kelmadi" })).not.toBeInTheDocument();
  });

  it("⭐ kalitni yangilash — tasdiqdan keyin yangi kalit oynasi; rad javobi (kuryer faol emas) — alohida oyna", async () => {
    const user = userEvent.setup();
    mocks.post.mockResolvedValueOnce({
      data: { statusCode: 200, data: { id: "3", api_key: "elc_rotated" } },
    });
    open();
    await screen.findByRole("region", { name: /FastPost Logistics/ });
    await user.click(within(card()).getByRole("button", { name: "Kalitni yangilash" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Kalitni yangilash" });
    expect(confirm).toHaveTextContent("Eski kalit darhol ishlamay qoladi.");
    expect(mocks.post).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole("button", { name: "Ha, yangilash" }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        "admin/carriers/3/rotate-key",
        undefined,
        expect.objectContaining({ timeout: 30_000 }),
      ),
    );
    const keyDialog = await screen.findByRole("dialog", {
      name: "Yangi API kalit — bir marta ko'rsatiladi",
    });
    expect(within(keyDialog).getByDisplayValue("elc_rotated")).toBeInTheDocument();
    expect(keyDialog).toHaveTextContent("Eski kalit endi ishlamaydi");
    await user.click(within(keyDialog).getByRole("checkbox"));
    await user.click(within(keyDialog).getByRole("button", { name: "Yakunlash" }));
    await waitFor(() => expect(screen.queryByDisplayValue("elc_rotated")).not.toBeInTheDocument());

    mocks.post.mockRejectedValueOnce(httpError(400, "Kurier faol emas"));
    await user.click(within(card()).getByRole("button", { name: "Kalitni yangilash" }));
    await user.click(
      within(await screen.findByRole("alertdialog", { name: "Kalitni yangilash" })).getByRole(
        "button",
        { name: "Ha, yangilash" },
      ),
    );
    const refused = await screen.findByRole("alertdialog", { name: "Kalit yangilanmadi" });
    expect(refused).toHaveTextContent("Faol bo'lmagan kuryerga yangi kalit berilmaydi");
    expect(within(refused).getByRole("button", { name: "Kuryerni ochish" })).toBeInTheDocument();
  });

  it("⭐ to'xtatish — xavfli tasdiq, «Buyurtma biriktirish to'xtamaydi» ogohlantirishi bilan", async () => {
    const user = userEvent.setup();
    mocks.post.mockResolvedValue({
      data: { statusCode: 200, data: { id: "3", is_active: false } },
    });
    open();
    await screen.findByRole("region", { name: /FastPost Logistics/ });
    await user.click(within(card()).getByRole("button", { name: "To'xtatish" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Ulanishni to'xtatish" });
    expect(confirm).toHaveTextContent("Buyurtma biriktirish to'xtamaydi");
    await user.click(within(confirm).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mocks.post).not.toHaveBeenCalled();

    await user.click(within(card()).getByRole("button", { name: "To'xtatish" }));
    await user.click(
      within(await screen.findByRole("alertdialog", { name: "Ulanishni to'xtatish" })).getByRole(
        "button",
        { name: "Ha, to'xtatish" },
      ),
    );
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        "admin/carriers/3/status",
        { is_active: false },
        expect.objectContaining({ timeout: 30_000 }),
      ),
    );
    expect(await screen.findByText("«FastPost Logistics» to'xtatildi")).toBeInTheDocument();
  });

  it("⭐ kalitni yangilashda javob kelmadi — «Qayta yangilash» → yangi kalit; «Yakunlash» dan keyin fokus sarlavhada", async () => {
    const user = userEvent.setup();
    mocks.post
      .mockRejectedValueOnce(httpError(504, "Gateway Timeout"))
      .mockResolvedValueOnce({ data: { statusCode: 200, data: { id: "3", api_key: "elc_retry" } } });
    open();
    await screen.findByRole("region", { name: /FastPost Logistics/ });
    await user.click(within(card()).getByRole("button", { name: "Kalitni yangilash" }));
    await user.click(
      within(await screen.findByRole("alertdialog", { name: "Kalitni yangilash" })).getByRole(
        "button",
        { name: "Ha, yangilash" },
      ),
    );
    const unknown = await screen.findByRole("alertdialog", { name: "Javob kelmadi" });
    expect(unknown).toHaveTextContent("Eski kalit allaqachon ishlamasligi mumkin");
    await user.click(within(unknown).getByRole("button", { name: "Qayta yangilash" }));

    const keyDialog = await screen.findByRole("dialog", {
      name: "Yangi API kalit — bir marta ko'rsatiladi",
    });
    expect(within(keyDialog).getByDisplayValue("elc_retry")).toBeInTheDocument();
    expect(mocks.post).toHaveBeenCalledTimes(2);
    expect(mocks.post).toHaveBeenLastCalledWith(
      "admin/carriers/3/rotate-key",
      undefined,
      expect.objectContaining({ timeout: 30_000 }),
    );
    await user.click(within(keyDialog).getByRole("checkbox"));
    await user.click(within(keyDialog).getByRole("button", { name: "Yakunlash" }));
    // Kalit oynasi «Javob kelmadi» yopilayotganda ochilgan — fokus DOM'dan ketgan tugmaga emas, sarlavhaga qaytadi.
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name: "FastPost Logistics" }),
      ),
    );
  });

  it("⭐ yoqishni server rad etsa (kuryer faol emas) — «Yoqilmadi» + «Kuryerni ochish», kuryer qayta so'raladi", async () => {
    const user = userEvent.setup();
    mocks.post.mockRejectedValue(httpError(400, "Kurier faol emas"));
    open("?scope=carrier&c=carrier:1");
    const detail = await screen.findByRole("region", { name: /Vodiy Kargo/ });
    await user.click(within(detail).getByRole("button", { name: "Yoqish" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Ulanishni yoqish" });
    expect(confirm).toHaveTextContent("Kompaniya avvalgi kaliti bilan yana ishlay boshlaydi");
    const before = getCalls("users/77");
    await user.click(within(confirm).getByRole("button", { name: "Yoqish" }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        "admin/carriers/1/status",
        { is_active: true },
        expect.objectContaining({ timeout: 30_000 }),
      ),
    );
    const refused = await screen.findByRole("alertdialog", { name: "Yoqilmadi" });
    expect(refused).toHaveTextContent("Bog'langan kuryer tekshiruvdan o'tmadi");
    expect(within(refused).getByRole("button", { name: "Kuryerni ochish" })).toBeInTheDocument();
    // Rad javobidan keyin kuryer tafsiloti eskirgan — darhol qayta so'raladi (holat belgisi server bilan bir xil).
    await waitFor(() => expect(getCalls("users/77")).toBeGreaterThan(before));

    await user.click(within(refused).getByRole("button", { name: "Yopish" }));
    await waitFor(() =>
      expect(document.activeElement).toBe(within(detail).getByRole("button", { name: "Yoqish" })),
    );
  });

  it("«Qabul qilinishi kerak» — kassaning olinishi_kerak (HQ emas: balans bo'lsa ham 0), so'rov yiqilsa «—»", async () => {
    accounts = [{ ...ACCOUNTS[0], id: "9", name: "Rustam Kargo", courier_user_id: "99" }, ...ACCOUNTS];
    const { unmount } = open();
    const detail = await screen.findByRole("region", { name: /Rustam Kargo/ });
    // Butun qiymat (substring emas): «500 000 so'm» ham «0 so'm» ni o'z ichiga oladi.
    await waitFor(() => expect(receivableOf(detail)).toHaveTextContent(/^0 so'm$/));
    expect(detail).toHaveTextContent("Kuryer Samarqand filialida");
    unmount();

    // 55 kassasi yiqildi (403) — skelet abadiy qolmaydi.
    accounts = ACCOUNTS;
    mocks.get.mockImplementation((url: string, config?: { params?: Record<string, unknown> }) =>
      String(url).startsWith("finance/cashbox/user/")
        ? Promise.reject(httpError(403, "Forbidden"))
        : routeGet(String(url), config),
    );
    open();
    const fastPost = await screen.findByRole("region", { name: /FastPost Logistics/ });
    await waitFor(() => expect(receivableOf(fastPost)).toHaveTextContent("—"));
  });

  it("⭐ tahrirlash — kuryer o'zgarmaydi, xato IP «Saqlash» ni o'chiradi, faqat o'zgargan maydon yuboriladi", async () => {
    const user = userEvent.setup();
    mocks.patch.mockResolvedValue({ data: { statusCode: 200, data: ACCOUNTS[0] } });
    open();
    await screen.findByRole("region", { name: /FastPost Logistics/ });
    await user.click(within(card()).getByRole("button", { name: "Tahrirlash" }));
    const dialog = await screen.findByRole("dialog", { name: "Tahrirlash" });
    expect(within(dialog).getByRole("group", { name: "Bog'langan kuryer" })).toHaveTextContent(
      "O'zgartirib bo'lmaydi",
    );

    const ip = within(dialog).getByRole("textbox", { name: /IP ro'yxati/ });
    expect(ip).toHaveValue("203.0.113.10\n198.51.100.0/24");
    await user.type(ip, "\n2001:db8::/48");
    expect(
      within(dialog).getByText("IPv6 diapazon qo'llab-quvvatlanmaydi — aniq IPv6 manzil yozing"),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Saqlash" })).toBeDisabled();

    await user.clear(ip);
    await user.type(ip, "203.0.113.10");
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith("admin/carriers/3", {
        ip_allowlist: ["203.0.113.10"],
      }),
    );
  });

  it("ro'yxat bo'sh — bo'sh holat va «Yangi tashqi yetkazuvchi»", async () => {
    accounts = [];
    open();
    expect(await screen.findByText("Hali tashqi yetkazuvchi yo'q")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yangi tashqi yetkazuvchi" })).toBeInTheDocument();
  });

  it("ro'yxat olinmasa — xato va «Qayta urinish»", async () => {
    mocks.get.mockImplementation((url: string, config?: { params?: Record<string, unknown> }) =>
      url === "admin/carriers"
        ? Promise.reject(httpError(500, "Internal"))
        : routeGet(String(url), config),
    );
    open();
    expect(
      await screen.findByText("Tashqi yetkazuvchilar ro'yxatini olib bo'lmadi."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qayta urinish" })).toBeInTheDocument();
  });

  it("⭐ tahrirlash: saqlangach darhol qayta ochilgan forma saqlangan nomdan boshlanadi; keyingi saqlash nomni qaytarmaydi", async () => {
    const user = userEvent.setup();
    const renamed = { ...ACCOUNTS[0], name: "FastPost NEW" };
    mocks.patch
      .mockResolvedValueOnce({ data: { statusCode: 200, data: renamed } })
      .mockResolvedValueOnce({
        data: { statusCode: 200, data: { ...renamed, ip_allowlist: ["203.0.113.10"] } },
      });
    open();
    await screen.findByRole("region", { name: /FastPost Logistics/ });
    // Sekin tarmoq: saqlashdan keyingi ro'yxat yangilanishi (`onSettled`) javob bermay turadi.
    const list = deferred();
    mocks.get.mockImplementation((url: string, config?: { params?: Record<string, unknown> }) =>
      url === "admin/carriers" ? list.promise : routeGet(String(url), config),
    );
    const detail = () => screen.getByRole("region", { name: /FastPost/ });

    await user.click(within(detail()).getByRole("button", { name: "Tahrirlash" }));
    let dialog = await screen.findByRole("dialog", { name: "Tahrirlash" });
    const nameInput = within(dialog).getByRole("textbox", { name: /Kompaniya nomi/ });
    await user.clear(nameInput);
    await user.type(nameInput, "FastPost NEW");
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith("admin/carriers/3", { name: "FastPost NEW" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Tahrirlash" })).not.toBeInTheDocument(),
    );

    // Ro'yxat hali kelmagan — forma baribir saqlangan nomdan boshlanadi (PATCH javobi keshga yozilgan).
    await user.click(within(detail()).getByRole("button", { name: "Tahrirlash" }));
    dialog = await screen.findByRole("dialog", { name: "Tahrirlash" });
    expect(within(dialog).getByRole("textbox", { name: /Kompaniya nomi/ })).toHaveValue(
      "FastPost NEW",
    );
    accounts = [renamed, ...ACCOUNTS.slice(1)];
    await act(async () => list.release({ data: { statusCode: 200, data: accounts } }));

    // Faqat IP o'zgardi — nom yuborilmaydi (oldingi saqlash qaytarilmaydi).
    const ip = within(dialog).getByRole("textbox", { name: /IP ro'yxati/ });
    await user.clear(ip);
    await user.type(ip, "203.0.113.10");
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(2));
    expect(mocks.patch).toHaveBeenLastCalledWith("admin/carriers/3", {
      ip_allowlist: ["203.0.113.10"],
    });
  });

  it("⭐ tahrirlash: oyna ochiq turganda ro'yxat yangilansa (boshqa admin nomni o'zgartirdi) — tegilmagan nom qayta yuborilmaydi", async () => {
    const user = userEvent.setup();
    mocks.patch.mockResolvedValue({ data: { statusCode: 200, data: ACCOUNTS[0] } });
    const { queryClient } = open();
    await screen.findByRole("region", { name: /FastPost Logistics/ });
    await user.click(within(card()).getByRole("button", { name: "Tahrirlash" }));
    const dialog = await screen.findByRole("dialog", { name: "Tahrirlash" });

    // Shu paytda boshqa admin nomni o'zgartirdi; ro'yxat fonda yangilandi (boshqa amalning invalidatsiyasi).
    accounts = [{ ...ACCOUNTS[0], name: "FastPost (boshqa admin)" }, ...ACCOUNTS.slice(1)];
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.carrierAccounts.all });
    });
    await waitFor(() => expect(dialog).toHaveTextContent("FastPost (boshqa admin)"));
    expect(within(dialog).getByRole("textbox", { name: /Kompaniya nomi/ })).toHaveValue(
      "FastPost Logistics",
    );

    const ip = within(dialog).getByRole("textbox", { name: /IP ro'yxati/ });
    await user.clear(ip);
    await user.type(ip, "203.0.113.10");
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    expect(mocks.patch).toHaveBeenCalledWith("admin/carriers/3", {
      ip_allowlist: ["203.0.113.10"],
    });
  });

  it("⭐ yaratish so'rovi ketayotganda «Kuryer qo'shish» havolasi yo'q — sahifadan chiqib kalit yo'qolmaydi", async () => {
    const user = userEvent.setup();
    const created = deferred();
    mocks.post.mockReturnValue(created.promise);
    renderWithProviders(
      <StrictMode>
        <Routes>
          <Route path="/integrations/connections" element={<CarrierConsole tabs={null} />} />
          <Route path="/all-users/create-user" element={<p>FOYDALANUVCHI YARATISH</p>} />
        </Routes>
      </StrictMode>,
      { route: "/integrations/connections?scope=carrier&new=1", preloadedState: SUPERADMIN },
    );
    const dialog = await screen.findByRole("dialog", { name: "Yangi tashqi yetkazuvchi" });
    expect(within(dialog).getByRole("link", { name: /Kuryer qo'shish/ })).toHaveAttribute(
      "href",
      "/all-users/create-user",
    );
    await fillCreate(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Yaratish va kalit olish" }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    // So'rov ketmoqda — oynadan sahifani almashtiradigan havola chizilmaydi.
    await waitFor(() =>
      expect(within(dialog).queryByRole("link", { name: /Kuryer qo'shish/ })).not.toBeInTheDocument(),
    );

    await act(async () => created.release(createdResponse("elc_kept_key")));
    const keyDialog = await screen.findByRole("dialog", {
      name: "API kalit — bir marta ko'rsatiladi",
    });
    expect(within(keyDialog).getByDisplayValue("elc_kept_key")).toBeInTheDocument();
    expect(screen.queryByText("FOYDALANUVCHI YARATISH")).not.toBeInTheDocument();
  });

  it("⭐ ro'yxatni qayta so'rash yiqilsa (504) — jadval va tanlangan akkaunt qoladi, «yangilab bo'lmadi» + «Qayta urinish»", async () => {
    const user = userEvent.setup();
    const { queryClient } = open();
    await screen.findByRole("region", { name: /FastPost Logistics/ });
    mocks.get.mockImplementation((url: string, config?: { params?: Record<string, unknown> }) =>
      url === "admin/carriers"
        ? Promise.reject(httpError(504, "Gateway Timeout"))
        : routeGet(String(url), config),
    );
    // Mutatsiyalarning `onSettled` invalidatsiyasi (masalan kalit yangilangach) — qayta so'rash yiqiladi.
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.carrierAccounts.all });
    });

    await waitFor(() =>
      expect(queryClient.getQueryState(queryKeys.carrierAccounts.all)?.status).toBe("error"),
    );
    // Keshdagi ro'yxat (3 qator) joyida: jadval va tanlangan akkaunt xato bilan almashtirilmaydi.
    expect(screen.getByRole("table", { name: "Tashqi yetkazuvchilar ro'yxati" })).toBeInTheDocument();
    expect(within(card()).getByRole("button", { name: "Kalitni yangilash" })).toBeInTheDocument();
    expect(
      screen.queryByText("Tashqi yetkazuvchilar ro'yxatini olib bo'lmadi."),
    ).not.toBeInTheDocument();
    expect(await screen.findByText(REFRESH_ERROR)).toBeInTheDocument();

    mocks.get.mockImplementation((url: string, config?: { params?: Record<string, unknown> }) =>
      routeGet(String(url), config),
    );
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    await waitFor(() => expect(screen.queryByText(REFRESH_ERROR)).not.toBeInTheDocument());
    expect(card()).toBeInTheDocument();
  });

  it("⭐ yoqish oynasi: kuryer holati noma'lum (users/:id yiqildi) — «faol» deb yozilmaydi", async () => {
    const user = userEvent.setup();
    mocks.get.mockImplementation((url: string, config?: { params?: Record<string, unknown> }) =>
      url === "users/77"
        ? Promise.reject(httpError(500, "Internal"))
        : routeGet(String(url), config),
    );
    open("?scope=carrier&c=carrier:1");
    const detail = await screen.findByRole("region", { name: /Vodiy Kargo/ });
    // 5xx — bir marta qayta urinadi (`useLinkedCouriers`), keyin `error`.
    await waitFor(() => expect(getCalls("users/77")).toBeGreaterThanOrEqual(2), { timeout: 4000 });
    await user.click(within(detail).getByRole("button", { name: "Yoqish" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Ulanishni yoqish" });
    expect(confirm).toHaveTextContent("Kuryer holati tekshirilmadi — server yoqishda tekshiradi");
    expect(confirm).not.toHaveTextContent("Bog'langan kuryer faol");
  });
});

/**
 * Brauzer «Orqaga» (Android orqaga tugmasi, iOS chekkadan surish) — `popstate`, `beforeunload` emas. Ilovadagidek
 * `BrowserRouter` (jsdom `window.history`) va `<StrictMode>`: katalogdan konsolga o'tilgan, so'ng «Orqaga».
 */
describe("Tashqi yetkazuvchilar konsoli — «Orqaga» bir martalik kalitni yo'qotmaydi", () => {
  beforeEach(() => {
    accounts = ACCOUNTS;
    mocks.get.mockReset();
    mocks.post.mockReset();
    mocks.patch.mockReset();
    mocks.get.mockImplementation((url: string, config?: { params?: Record<string, unknown> }) =>
      routeGet(String(url), config),
    );
  });

  const openFromCatalog = (search: string) => {
    window.history.replaceState(null, "", "/integrations/new");
    window.history.pushState(null, "", `/integrations/connections${search}`);
    return renderWithProviders(
      <StrictMode>
        <Routes>
          <Route path="/integrations/new" element={<p>KATALOG</p>} />
          <Route path="/integrations/connections" element={<CarrierConsole tabs={null} />} />
        </Routes>
      </StrictMode>,
      { history: "browser", preloadedState: SUPERADMIN },
    );
  };

  /** `history.back()` — `popstate` kelguncha kutiladi (jsdom uni keyingi vazifada yuboradi). */
  const pressBack = async () => {
    await act(async () => {
      const popped = new Promise<void>((resolve) =>
        window.addEventListener("popstate", () => resolve(), { once: true }),
      );
      window.history.back();
      await popped;
    });
  };

  it("⭐ kalit oynasi «nusxaladim»siz ochiq — «Orqaga» konsolni yopmaydi, kalit joyida; belgilangach «Orqaga» ishlaydi", async () => {
    const user = userEvent.setup();
    mocks.post.mockResolvedValue(createdResponse("elc_back_key"));
    openFromCatalog("?scope=carrier&new=1");
    const dialog = await screen.findByRole("dialog", { name: "Yangi tashqi yetkazuvchi" });
    await fillCreate(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Yaratish va kalit olish" }));
    const keyDialog = await screen.findByRole("dialog", {
      name: "API kalit — bir marta ko'rsatiladi",
    });
    expect(within(keyDialog).getByDisplayValue("elc_back_key")).toBeInTheDocument();

    await pressBack();
    expect(screen.queryByText("KATALOG")).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/integrations/connections");
    expect(
      within(
        screen.getByRole("dialog", { name: "API kalit — bir marta ko'rsatiladi" }),
      ).getByDisplayValue("elc_back_key"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Hozir chiqib bo'lmaydi")).toBeInTheDocument();

    // «Nusxaladim» belgilangach himoya yo'q — «Orqaga» odatdagidek katalogga qaytadi (ortiqcha yozuv qolmagan).
    await user.click(
      within(keyDialog).getByRole("checkbox", { name: "Kalitni nusxaladim va xavfsiz saqladim" }),
    );
    await user.click(within(keyDialog).getByRole("button", { name: "Yakunlash" }));
    await pressBack();
    expect(await screen.findByText("KATALOG")).toBeInTheDocument();
  });

  it("⭐ kalitni yangilash so'rovi ketayotganda «Orqaga» — konsol yopilmaydi, javob kelgach yangi kalit ko'rsatiladi", async () => {
    const user = userEvent.setup();
    const rotated = deferred();
    mocks.post.mockReturnValue(rotated.promise);
    openFromCatalog("?scope=carrier");
    await screen.findByRole("region", { name: /FastPost Logistics/ });
    await user.click(within(card()).getByRole("button", { name: "Kalitni yangilash" }));
    await user.click(
      within(await screen.findByRole("alertdialog", { name: "Kalitni yangilash" })).getByRole(
        "button",
        { name: "Ha, yangilash" },
      ),
    );
    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));

    // Server eski kalitni o'chirib bo'lgan bo'lishi mumkin — yangisi faqat shu javobda keladi.
    await pressBack();
    expect(screen.queryByText("KATALOG")).not.toBeInTheDocument();

    await act(async () =>
      rotated.release({ data: { statusCode: 200, data: { id: "3", api_key: "elc_after_back" } } }),
    );
    const keyDialog = await screen.findByRole("dialog", {
      name: "Yangi API kalit — bir marta ko'rsatiladi",
    });
    expect(within(keyDialog).getByDisplayValue("elc_after_back")).toBeInTheDocument();
  });
});
