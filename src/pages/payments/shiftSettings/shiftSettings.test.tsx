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
