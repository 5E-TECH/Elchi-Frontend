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

    // Eski backend (`branch_account_check_enabled` yo'q): bitta kalit — avvalgi nomi bilan, filial kaliti yo'q.
    expect(screen.queryByRole("switch", { name: "Filiallar — qoldiq tasdiqlash" })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Asosiy kassa — qoldiq tasdiqlash" })).not.toBeInTheDocument();
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

  it("old backend without report: the report card is not drawn; the shift schedule link is always there", async () => {
    renderWithProviders(<ShiftSettingsPage />, { route: "/payments/shift-settings", preloadedState: superadmin });
    await screen.findByRole("button", { name: /Saqlash/ });
    expect(screen.queryByText("Smena hisobotini yuborish")).not.toBeInTheDocument();
    expect(screen.getByText("Smena jadvali")).toBeInTheDocument();
    // Backend `auto_open` bermaydi — tavsif yo'q funksiyani (avtomatik ochish, kechikish xabari) va'da qilmaydi.
    expect(screen.getByText("Smenani avtomatik yopish vaqtlari endi Ops → «Kun tartibi»da.")).toBeInTheDocument();
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

/**
 * BE-A (2026-11-10) — ikki kalit: «Asosiy kassa — qoldiq tasdiqlash» (`account_check_enabled`) va «Filiallar — qoldiq
 * tasdiqlash» (`branch_account_check_enabled`); MAIN kartalarida rasm + AI sukut yoqiq; PATCH faqat o'zgargan kalit;
 * backend 400 matni aynan.
 */
describe("Shift settings — main and branch balance confirmation (BE-A)", () => {
  const BE_A = {
    ...SETTINGS,
    account_check_enabled: true,
    main_account_check_enabled: true,
    branch_account_check_enabled: false,
    photo_required: true,
    ai_check_enabled: true,
    cards: SETTINGS.cards.map((card) => ({
      ...card,
      require_photo_on_shift_close: true,
      ai_check_enabled: true,
      photo_required: true,
      ai_enabled: true,
    })),
  };

  beforeEach(() => {
    http.get.mockImplementation(async () => ({ data: { statusCode: 200, data: BE_A } }));
  });

  it("draws both switches with their server values; the subtitle no longer claims «all cashboxes»", async () => {
    renderWithProviders(<ShiftSettingsPage />, { route: "/payments/shift-settings", preloadedState: superadmin });
    const main = await screen.findByRole("switch", { name: "Asosiy kassa — qoldiq tasdiqlash" });
    const branch = screen.getByRole("switch", { name: "Filiallar — qoldiq tasdiqlash" });
    expect(main).toHaveAttribute("aria-checked", "true");
    expect(branch).toHaveAttribute("aria-checked", "false");
    expect(branch).toHaveAccessibleDescription(
      "Filial kassalarida ham har karta qoldig'i majburiy. O'chiq bo'lsa, filial smenasi avvalgidek yopiladi",
    );
    expect(screen.queryByRole("switch", { name: "Smena yopishda har karta qoldig'i majburiy" })).not.toBeInTheDocument();
    expect(screen.getByText("Asosiy kassa va filiallar · faqat superadmin o'zgartiradi")).toBeInTheDocument();
    expect(screen.queryByText(/Barcha kassalar uchun/)).not.toBeInTheDocument();
    // MAIN kartalari sukut bo'yicha rasm + AI bilan.
    const table = screen.getByRole("table", { name: "Kartalar bo'yicha smena kalitlari" });
    expect(within(table).getAllByText("Rasm majburiy, AI tekshiradi")).toHaveLength(2);
    expect(within(table).getByRole("switch", { name: "Hisob raqam: rasm talab qilish" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: /Saqlash/ })).toBeDisabled();
  });

  it("PATCH carries only the changed switch: branch on → `branch_account_check_enabled`, main off → `account_check_enabled`", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ShiftSettingsPage />, { route: "/payments/shift-settings", preloadedState: superadmin });
    await user.click(await screen.findByRole("switch", { name: "Filiallar — qoldiq tasdiqlash" }));
    await user.click(screen.getByRole("button", { name: /Saqlash/ }));
    await waitFor(() => expect(http.patch).toHaveBeenCalledTimes(1));
    expect(http.patch).toHaveBeenLastCalledWith("finance/shift/settings", { branch_account_check_enabled: true });
  });

  it("main off — only `account_check_enabled: false`; card rows say confirmation is off", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ShiftSettingsPage />, { route: "/payments/shift-settings", preloadedState: superadmin });
    await user.click(await screen.findByRole("switch", { name: "Asosiy kassa — qoldiq tasdiqlash" }));
    const table = screen.getByRole("table", { name: "Kartalar bo'yicha smena kalitlari" });
    expect(within(table).getAllByText("Tasdiqlash o'chiq — smena avvalgidek yopiladi")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: /Saqlash/ }));
    await waitFor(() => expect(http.patch).toHaveBeenCalledTimes(1));
    expect(http.patch).toHaveBeenLastCalledWith("finance/shift/settings", { account_check_enabled: false });
  });

  it("a backend 400 is shown verbatim (AI without a photo)", async () => {
    http.patch.mockRejectedValueOnce(
      Object.assign(new Error("400"), {
        response: {
          status: 400,
          data: { statusCode: 400, message: "AI tekshiruvi faqat smena yopishda qoldiq rasmi talab qilinganda yoqiladi" },
        },
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ShiftSettingsPage />, { route: "/payments/shift-settings", preloadedState: superadmin });
    await user.click(await screen.findByRole("switch", { name: "Filiallar — qoldiq tasdiqlash" }));
    await user.click(screen.getByRole("button", { name: /Saqlash/ }));
    expect(
      await screen.findByText("AI tekshiruvi faqat smena yopishda qoldiq rasmi talab qilinganda yoqiladi"),
    ).toBeInTheDocument();
    expect(screen.getByText("Sozlamalar saqlanmadi")).toBeInTheDocument();
  });
});

/**
 * gWI4gYkw — «Smena hisobotini yuborish»: PATCH faqat o'zgarganlar. «Avtomatik yopish» (y8Tqm9Ap) — Ops → «Kun
 * tartibi» (`pages/daily-schedule`, testlari o'sha yerda), bu yerda — havola kartasi.
 */
describe("Shift settings — report sending and the shift schedule link (gWI4gYkw)", () => {
  it("yangi backend (`auto_open` bor): «Smena jadvali» tavsifi — ochish, yopish va kechikish xabari", async () => {
    http.get.mockImplementation(async () => ({
      data: { statusCode: 200, data: { ...SETTINGS, auto_open: { enabled: false, times: ["08:00"], scope: "main" } } },
    }));
    renderWithProviders(<ShiftSettingsPage />, { route: "/payments/shift-settings", preloadedState: superadmin });
    expect(
      await screen.findByText(
        "Smenani avtomatik ochish va yopish vaqtlari, vaqtida ochilmasa yoki yopilmasa superadminlarga xabar — endi Ops → «Kun tartibi»da.",
      ),
    ).toBeInTheDocument();
  });

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

  it("«Avtomatik yopish» Ops → «Kun tartibi»ga ko'chdi (2026-11-10): karta yo'q, havola bor; PATCH da `auto_close` yo'q", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ShiftSettingsPage />, { route: "/payments/shift-settings", preloadedState: superadmin });
    await screen.findByRole("table", { name: "Hisobot qabul qiluvchilari" });
    expect(screen.queryByRole("switch", { name: "Smenani avtomatik yopish" })).not.toBeInTheDocument();
    expect(screen.queryByText("Avtomatik yopish")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Kun tartibini ochish" })).toHaveAttribute("href", "/ops?tab=daily-schedule");
    expect(screen.getByText("Smenani avtomatik yopish vaqtlari endi Ops → «Kun tartibi»da.")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Excel" }));
    await user.click(screen.getByRole("button", { name: /Saqlash/ }));
    await waitFor(() => expect(http.patch).toHaveBeenCalledTimes(1));
    expect(http.patch).toHaveBeenCalledWith("finance/shift/settings", { report: { format: "xlsx" } });
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
