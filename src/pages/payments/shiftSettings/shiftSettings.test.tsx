import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import ShiftSettingsPage from ".";
import { canManageShiftSettings } from "../../../app/lib/access";
import { renderWithProviders } from "../../../test/test-utils";

/** kiZgTybn — smena sozlamalari: faqat superadmin, PATCH faqat o'zgargan kalitlar, AI faqat rasm talab qilinganda. */

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api: http, API_TIMEOUT_MS: 20_000, LONG_REQUEST_TIMEOUT_MS: 120_000 }));

const SETTINGS = {
  account_check_enabled: false,
  photo_required: true,
  ai_check_enabled: false,
  cashbox_user_id: "0",
  cashbox_type: "main",
  cards: [
    {
      card_id: "1",
      name: "Asosiy karta",
      bank_name: "Agrobank",
      last4: "1234",
      is_default: true,
      require_photo_on_shift_close: true,
      ai_check_enabled: true,
      photo_required: true,
      ai_enabled: false,
    },
    {
      card_id: "3",
      name: "Hisob raqam",
      bank_name: "Ipoteka bank",
      last4: "2205",
      is_default: false,
      require_photo_on_shift_close: false,
      ai_check_enabled: false,
      photo_required: false,
      ai_enabled: false,
    },
  ],
};

const superadmin = { role: { id: "1", role: "superadmin", region: null, name: "SA" } } as never;

beforeEach(() => {
  http.get.mockReset();
  http.patch.mockReset();
  http.get.mockImplementation(async () => ({ data: { statusCode: 200, data: SETTINGS } }));
  http.patch.mockImplementation(async () => ({ data: { statusCode: 200, data: {} } }));
});

describe("Shift settings (kiZgTybn)", () => {
  it("only a superadmin may manage the settings (route guard = backend PATCH @Roles(SUPERADMIN))", () => {
    const state = (role: string) => ({ role: { role } }) as never;
    expect(canManageShiftSettings(state("superadmin"))).toBe(true);
    for (const role of ["admin", "manager", "registrator", "courier", "market"]) {
      expect(canManageShiftSettings(state(role))).toBe(false);
    }
  });

  it("saves only the changed keys; turning a card photo off turns its AI off; AI needs a photo", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ShiftSettingsPage />, { route: "/payments/shift-settings", preloadedState: superadmin });
    const save = await screen.findByRole("button", { name: /Saqlash/ });
    expect(save).toBeDisabled();
    expect(screen.getAllByText("Tasdiqlash o'chiq — smena avvalgidek yopiladi").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("switch", { name: "Smena yopishda har karta qoldig'i majburiy" }));
    await user.click(screen.getByRole("switch", { name: "AI tekshiruvi" }));
    const table = screen.getByRole("table", { name: "Kartalar bo'yicha smena kalitlari" });
    // Rasm talab qilinmagan kartada AI kaliti o'chiq — «Rasm kerak».
    expect(within(table).getByRole("switch", { name: "Hisob raqam: AI tekshiruvi" })).toBeDisabled();
    expect(within(table).getByText("Rasm kerak")).toBeInTheDocument();
    expect(within(table).getByText("Rasm majburiy, AI tekshiradi")).toBeInTheDocument();
    // Asosiy karta rasmi o'chirilsa — AI ham o'chadi.
    await user.click(within(table).getByRole("switch", { name: "Asosiy karta: rasm talab qilish" }));
    expect(within(table).getByRole("switch", { name: "Asosiy karta: AI tekshiruvi" })).toHaveAttribute("aria-checked", "false");

    await user.click(save);
    await waitFor(() => expect(http.patch).toHaveBeenCalledTimes(1));
    expect(http.patch).toHaveBeenCalledWith("finance/shift/settings", {
      account_check_enabled: true,
      ai_check_enabled: true,
      cards: [{ card_id: "1", require_photo_on_shift_close: false, ai_check_enabled: false }],
    });
    expect(await screen.findByText("Sozlamalar saqlandi")).toBeInTheDocument();
  });

  it("old backend without auto_close / report: the automation cards are not drawn", async () => {
    renderWithProviders(<ShiftSettingsPage />, { route: "/payments/shift-settings", preloadedState: superadmin });
    await screen.findByRole("button", { name: /Saqlash/ });
    expect(screen.queryByText("Avtomatik yopish")).not.toBeInTheDocument();
    expect(screen.queryByText("Smena hisobotini yuborish")).not.toBeInTheDocument();
  });

  it("a rejected save (403) shows the backend message", async () => {
    http.patch.mockRejectedValueOnce(
      Object.assign(new Error("403"), {
        response: { status: 403, data: { message: "Smena sozlamalarini faqat superadmin o'zgartiradi" } },
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ShiftSettingsPage />, { route: "/payments/shift-settings", preloadedState: superadmin });
    await user.click(await screen.findByRole("switch", { name: "Rasm talab qilish" }));
    await user.click(screen.getByRole("button", { name: /Saqlash/ }));
    expect(await screen.findByText("Smena sozlamalarini faqat superadmin o'zgartiradi")).toBeInTheDocument();
  });
});

/** y8Tqm9Ap + gWI4gYkw — «Avtomatik yopish» va «Smena hisobotini yuborish» kartalari: PATCH faqat o'zgarganlar. */
describe("Shift settings — auto close and report sending (y8Tqm9Ap, gWI4gYkw)", () => {
  const AUTOMATION = {
    ...SETTINGS,
    auto_close: { enabled: false, times: ["23:00", "14:00"], scope: "main", warn_before_min: 15 },
    report: {
      recipients: {
        superadmin: { telegram: true, in_app: true },
        couriers: { telegram: false, in_app: false },
        markets: { telegram: false, in_app: false },
      },
      format: "pdf",
    },
  };

  beforeEach(() => {
    http.get.mockImplementation(async () => ({ data: { statusCode: 200, data: AUTOMATION } }));
  });

  it("auto close: switch, times (remove + add, sorted), scope and warn minutes → only the changed auto_close keys", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ShiftSettingsPage />, { route: "/payments/shift-settings", preloadedState: superadmin });
    const enable = await screen.findByRole("switch", { name: "Smenani avtomatik yopish" });
    expect(enable).toHaveAttribute("aria-checked", "false");
    const times = screen.getByRole("list", { name: "Kuniga yopish vaqtlari" });
    // Backend tartiblamagan bo'lsa ham — o'sish tartibida.
    expect(within(times).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["14:00", "23:00"]);
    expect(screen.getByText("Kuniga 2 marta · Toshkent vaqti (UTC+5)")).toBeInTheDocument();

    await user.click(enable);
    await user.click(screen.getByRole("button", { name: "14:00 ni olib tashlash" }));
    await user.click(screen.getByRole("button", { name: "Vaqt qo'shish" }));
    await user.click(await screen.findByRole("option", { name: "09:30" }));
    expect(within(times).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["09:30", "23:00"]);

    await user.click(screen.getByRole("radio", { name: "Asosiy kassa va filial kassalari" }));
    const warn = screen.getByRole("switch", { name: "Yopishdan 15 daqiqa oldin ogohlantirish" });
    await user.click(warn);
    expect(screen.getByRole("switch", { name: "Yopishdan oldin ogohlantirish" })).toHaveAttribute("aria-checked", "false");

    await user.click(screen.getByRole("button", { name: /Saqlash/ }));
    await waitFor(() => expect(http.patch).toHaveBeenCalledTimes(1));
    expect(http.patch).toHaveBeenCalledWith("finance/shift/settings", {
      auto_close: { enabled: true, times: ["09:30", "23:00"], scope: "main+branches", warn_before_min: 0 },
    });
  });

  it("auto close turned on without any time: error under the times and «Saqlash» stays disabled", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ShiftSettingsPage />, { route: "/payments/shift-settings", preloadedState: superadmin });
    await user.click(await screen.findByRole("switch", { name: "Smenani avtomatik yopish" }));
    await user.click(screen.getByRole("button", { name: "14:00 ni olib tashlash" }));
    await user.click(screen.getByRole("button", { name: "23:00 ni olib tashlash" }));
    expect(screen.getByText("Kamida bitta yopish vaqtini qo'shing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Saqlash/ })).toBeDisabled();
  });

  it("report sending: recipient × channel switches and the PDF / Excel format → only the changed report keys", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ShiftSettingsPage />, { route: "/payments/shift-settings", preloadedState: superadmin });
    const table = await screen.findByRole("table", { name: "Hisobot qabul qiluvchilari" });
    expect(within(table).getByRole("switch", { name: "Superadmin: Telegram" })).toHaveAttribute("aria-checked", "true");
    await user.click(within(table).getByRole("switch", { name: "Kuryerlar: tizim bildirishnomasi" }));
    await user.click(within(table).getByRole("switch", { name: "Superadmin: Telegram" }));
    await user.click(screen.getByRole("radio", { name: "Excel" }));

    await user.click(screen.getByRole("button", { name: /Saqlash/ }));
    await waitFor(() => expect(http.patch).toHaveBeenCalledTimes(1));
    expect(http.patch).toHaveBeenCalledWith("finance/shift/settings", {
      report: { recipients: { superadmin: { telegram: false }, couriers: { in_app: true } }, format: "xlsx" },
    });
  });
});
