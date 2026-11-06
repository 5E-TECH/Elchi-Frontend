import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInstance } from "i18next";
import { vi } from "vitest";
import ShiftSettingsPage from ".";
import uz from "../../../locales/uz/payments.json";
import ru from "../../../locales/ru/payments.json";
import en from "../../../locales/en/payments.json";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * T6-FE-3 (2wgTzcG0) — «To'lovlarni tuzatish muddati» kartasi (maket `superadmin-payments-shift-settings-correction`):
 * 7 · 10 · 30 · Boshqa (1–365), sahifadagi yagona «Saqlash» faqat o'zgargan so'rovni yuboradi, `window_days` — JSON son;
 * yaroqsiz qiymatda «Saqlash» o'chiq; GET yiqilsa kartada xato, qolgan sozlamalar saqlanaveradi; PATCH yiqilsa qoralama
 * qoladi. `notify` mock qilinmaydi — xabar haqiqiy Toaster orqali.
 */

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api: http, API_TIMEOUT_MS: 20_000, LONG_REQUEST_TIMEOUT_MS: 120_000 }));

const CORRECTION_URL = "finance/payment-corrections/settings";
const SHIFT_URL = "finance/shift/settings";
const RECEIPT_URL = "finance/receipt-settings";

const SHIFT = {
  account_check_enabled: false,
  photo_required: true,
  ai_check_enabled: false,
  cashbox_user_id: "0",
  cashbox_type: "main",
  cards: [],
};
const RECEIPTS = {
  manual_expense: { photo_required: true, ai_enabled: true },
  hq_transfer: { photo_required: true, ai_enabled: true },
  updated_at: null,
  updated_by: null,
};
const superadmin = { role: { id: "1", role: "superadmin", region: null, name: "SA" } } as never;

type CorrectionSettings = { window_days: number; updated_by: string | null; updated_at: string | null };
let correction: CorrectionSettings;

const correctionPatches = () => http.patch.mock.calls.filter(([url]) => url === CORRECTION_URL);
const shiftPatches = () => http.patch.mock.calls.filter(([url]) => url === SHIFT_URL);
const receiptPatches = () => http.patch.mock.calls.filter(([url]) => url === RECEIPT_URL);
const correctionGets = () => http.get.mock.calls.filter(([url]) => url === CORRECTION_URL);

const open = async () => {
  renderWithProviders(<ShiftSettingsPage />, { route: "/payments/shift-settings", preloadedState: superadmin });
  const card = await screen.findByRole("region", { name: "To'lovlarni tuzatish muddati" });
  return card;
};
const saveButton = () => screen.getByRole("button", { name: /Saqlash/ });
const toasts = () => screen.getByRole("region", { name: "Bildirishnomalar" });

beforeEach(() => {
  correction = { window_days: 30, updated_by: null, updated_at: null };
  http.get.mockReset();
  http.patch.mockReset();
  http.get.mockImplementation(async (url: string) => {
    if (url === CORRECTION_URL) return { data: { statusCode: 200, message: "success", data: correction } };
    if (url === RECEIPT_URL) return { data: { statusCode: 200, data: RECEIPTS } };
    if (url.startsWith("user")) return { data: { statusCode: 200, data: { id: "1", name: "Shodiyor Ergashev" } } };
    return { data: { statusCode: 200, data: SHIFT } };
  });
  http.patch.mockImplementation(async (url: string, body: { window_days?: number }) => {
    if (url === CORRECTION_URL) {
      correction = { window_days: Number(body.window_days), updated_by: "1", updated_at: "2026-10-01T05:15:00.000Z" };
      return { data: { statusCode: 200, message: "Payment correction settings updated", data: correction } };
    }
    return { data: { statusCode: 200, data: {} } };
  });
});

describe("«To'lovlarni tuzatish muddati» kartasi (T6-FE-3, 2wgTzcG0)", () => {
  it("sukut: «30 kun» tanlangan, «Sukut qiymati — hali hech kim o'zgartirmagan», «Saqlash» o'chiq", async () => {
    const card = await open();

    expect(await within(card).findByRole("radio", { name: "30 kun" })).toHaveAttribute("aria-checked", "true");
    // Izoh guruhga bog'langan — ekran o'quvchi «Muddat» bilan birga aytadi.
    expect(within(card).getByRole("radiogroup", { name: "Muddat" })).toHaveAccessibleDescription(
      "Sukut — 30 kun. Muddat to'lov qilingan paytdan hisoblanadi; tahrirlangan to'lovda — birinchi to'lovdan.",
    );
    for (const name of ["7 kun", "10 kun", "Boshqa"]) {
      expect(within(card).getByRole("radio", { name })).toHaveAttribute("aria-checked", "false");
    }
    expect(within(card).getByText(/^Shu muddat ichida superadmin kuryerdan olingan pulni/)).toBeInTheDocument();
    expect(
      within(card).getByText(
        "Sukut — 30 kun. Muddat to'lov qilingan paytdan hisoblanadi; tahrirlangan to'lovda — birinchi to'lovdan.",
      ),
    ).toBeInTheDocument();
    expect(within(card).getByText(/^Faqat kuryerdan qabul qilingan pul va marketga berilgan to'lovlar\./)).toBeInTheDocument();
    expect(within(card).getByText("Sukut qiymati — hali hech kim o'zgartirmagan")).toBeInTheDocument();
    expect(within(card).queryByRole("textbox")).not.toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it("«7 kun» → «Saqlash»: faqat muddat PATCH'i, `window_days` — son; xabar izohida muddat; server qiymati qaytadi", async () => {
    const user = userEvent.setup();
    const card = await open();

    await user.click(await within(card).findByRole("radio", { name: "7 kun" }));
    expect(saveButton()).toBeEnabled();
    await user.click(saveButton());

    await waitFor(() => expect(correctionPatches()).toHaveLength(1));
    expect(correctionPatches()[0][1]).toEqual({ window_days: 7 });
    expect(typeof correctionPatches()[0][1].window_days).toBe("number");
    expect(shiftPatches()).toHaveLength(0);
    expect(receiptPatches()).toHaveLength(0);
    expect(await within(toasts()).findByText("Sozlamalar saqlandi")).toBeInTheDocument();
    expect(within(toasts()).getByText("To'lovlarni tuzatish muddati: 7 kun.")).toBeInTheDocument();

    // Sozlama qayta o'qildi: «7 kun» serverdan, o'zgarish yo'q — «Saqlash» o'chiq; muallif ismi users/:id dan.
    expect(await within(card).findByText(/^Oxirgi o'zgarish: Shodiyor Ergashev · /)).toBeInTheDocument();
    expect(within(card).getByRole("radio", { name: "7 kun" })).toHaveAttribute("aria-checked", "true");
    expect(saveButton()).toBeDisabled();
  });

  it("«Boshqa»: maydon joriy son bilan va fokusda; 400 / 0 / bo'sh — xato va «Saqlash» o'chiq; 45 → PATCH 45", async () => {
    const user = userEvent.setup();
    const card = await open();

    await user.click(await within(card).findByRole("radio", { name: "Boshqa" }));
    const input = within(card).getByRole("textbox", { name: "Kunlar soni" });
    expect(input).toHaveValue("30");
    expect(input).toHaveFocus();
    expect(input).toBeRequired();
    expect(within(card).getByText("1 dan 365 gacha")).toBeInTheDocument();
    expect(within(card).getByText("kun")).toBeInTheDocument();
    // Son o'zgarmagan — saqlanadigan narsa yo'q.
    expect(saveButton()).toBeDisabled();

    for (const bad of ["400", "0"]) {
      await user.clear(input);
      await user.type(input, bad);
      expect(within(card).getByText("1 dan 365 gacha butun son kiriting")).toBeInTheDocument();
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(saveButton()).toBeDisabled();
    }
    await user.clear(input);
    expect(within(card).getByText("1 dan 365 gacha butun son kiriting")).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    // Raqamdan boshqa belgi o'tmaydi.
    await user.type(input, "4x5");
    expect(input).toHaveValue("45");
    expect(within(card).queryByText("1 dan 365 gacha butun son kiriting")).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();

    await user.click(saveButton());
    await waitFor(() => expect(correctionPatches()).toHaveLength(1));
    expect(correctionPatches()[0][1]).toEqual({ window_days: 45 });
    expect(await within(toasts()).findByText("To'lovlarni tuzatish muddati: 45 kun.")).toBeInTheDocument();
    // 45 — tayyor variant emas: qayta yuklangach ham «Boshqa» + 45.
    await waitFor(() => expect(saveButton()).toBeDisabled());
    expect(within(card).getByRole("radio", { name: "Boshqa" })).toHaveAttribute("aria-checked", "true");
    expect(within(card).getByRole("textbox", { name: "Kunlar soni" })).toHaveValue("45");
  });

  it("server qiymati 45 — «Boshqa» va maydonda 45 (fokussiz); tayyor variant tanlansa maydon yo'qoladi", async () => {
    correction = { window_days: 45, updated_by: "1", updated_at: "2026-10-01T05:15:00.000Z" };
    const user = userEvent.setup();
    const card = await open();

    expect(await within(card).findByRole("radio", { name: "Boshqa" })).toHaveAttribute("aria-checked", "true");
    const input = within(card).getByRole("textbox", { name: "Kunlar soni" });
    expect(input).toHaveValue("45");
    expect(input).not.toHaveFocus();
    expect(await within(card).findByText(/^Oxirgi o'zgarish: Shodiyor Ergashev · .*10:15$/)).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();

    await user.click(within(card).getByRole("radio", { name: "10 kun" }));
    expect(within(card).queryByRole("textbox", { name: "Kunlar soni" })).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
    // Klaviatura: ← → bilan «Boshqa» ga o'tilsa fokus segmentda qoladi (maydon faqat bosilganda fokuslanadi).
    await user.click(within(card).getByRole("radio", { name: "30 kun" }));
    await user.keyboard("{ArrowRight}");
    const custom = within(card).getByRole("radio", { name: "Boshqa" });
    expect(custom).toHaveAttribute("aria-checked", "true");
    expect(custom).toHaveFocus();
    expect(within(card).getByRole("textbox", { name: "Kunlar soni" })).toHaveValue("30");
  });

  it("muddat o'qilmasa — kartada «Muddatni yuklab bo'lmadi» + «Qayta urinish»; smena sozlamasi baribir saqlanadi", async () => {
    const ok = http.get.getMockImplementation();
    let failing = true;
    http.get.mockImplementation(async (url: string, ...rest: unknown[]) => {
      if (url === CORRECTION_URL && failing) throw Object.assign(new Error("500"), { response: { status: 500, data: {} } });
      return ok?.(url, ...rest);
    });
    const user = userEvent.setup();
    const card = await open();

    expect(await within(card).findByText("Muddatni yuklab bo'lmadi")).toBeInTheDocument();
    expect(within(card).queryByText("Sukut qiymati — hali hech kim o'zgartirmagan")).not.toBeInTheDocument();
    expect(within(card).queryByRole("radiogroup")).not.toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: "Smena yopishda har karta qoldig'i majburiy" }));
    expect(saveButton()).toBeEnabled();
    await user.click(saveButton());
    await waitFor(() => expect(shiftPatches()).toHaveLength(1));
    expect(correctionPatches()).toHaveLength(0);
    expect(await within(toasts()).findByText("Sozlamalar saqlandi")).toBeInTheDocument();

    failing = false;
    const before = correctionGets().length;
    await user.click(within(card).getByRole("button", { name: /Qayta urinish/ }));
    await waitFor(() => expect(correctionGets().length).toBeGreaterThan(before));
    expect(await within(card).findByRole("radio", { name: "30 kun" })).toHaveAttribute("aria-checked", "true");
  });

  it("smena saqlanib muddat PATCH'i yiqilsa — «Sozlamalar saqlanmadi», muddat qoralamasi joyida qoladi", async () => {
    http.patch.mockImplementation(async (url: string) => {
      if (url === CORRECTION_URL) {
        throw Object.assign(new Error("400"), {
          response: {
            status: 400,
            data: { statusCode: 400, message: "window_days 1…365 oralig'idagi butun son bo'lishi kerak" },
          },
        });
      }
      return { data: { statusCode: 200, data: {} } };
    });
    const user = userEvent.setup();
    const card = await open();

    await user.click(screen.getByRole("switch", { name: "Smena yopishda har karta qoldig'i majburiy" }));
    await user.click(await within(card).findByRole("radio", { name: "7 kun" }));
    await user.click(saveButton());

    await waitFor(() => expect(http.patch).toHaveBeenCalledTimes(2));
    expect(shiftPatches()).toHaveLength(1);
    expect(correctionPatches()[0][1]).toEqual({ window_days: 7 });
    expect(await within(toasts()).findByText("Sozlamalar saqlanmadi")).toBeInTheDocument();
    expect(within(card).getByRole("radio", { name: "7 kun" })).toHaveAttribute("aria-checked", "true");
    expect(saveButton()).toBeEnabled();
  });
});

describe("«N kun» ko'pligi (ru: one / few / many, en: one / other, uz — bitta shakl)", () => {
  const translator = async (lng: "uz" | "ru" | "en") => {
    const i18n = createInstance();
    await i18n.init({
      lng,
      fallbackLng: "uz",
      ns: ["payments"],
      defaultNS: "payments",
      resources: { uz: { payments: uz }, ru: { payments: ru }, en: { payments: en } },
      interpolation: { escapeValue: false },
    });
    return i18n.t.bind(i18n);
  };
  const saved = (t: Awaited<ReturnType<typeof translator>>, count: number) =>
    t("paymentCorrection.settings.saved", { count, value: String(count) });
  const days = (t: Awaited<ReturnType<typeof translator>>, count: number) =>
    t("paymentCorrection.settings.days", { count, value: String(count) });

  it("uz", async () => {
    const t = await translator("uz");
    expect([7, 10, 30].map((count) => days(t, count))).toEqual(["7 kun", "10 kun", "30 kun"]);
    expect(saved(t, 1)).toBe("To'lovlarni tuzatish muddati: 1 kun.");
    expect(saved(t, 45)).toBe("To'lovlarni tuzatish muddati: 45 kun.");
  });

  it("ru", async () => {
    const t = await translator("ru");
    expect([7, 10, 30].map((count) => days(t, count))).toEqual(["7 дней", "10 дней", "30 дней"]);
    expect(saved(t, 21)).toBe("Срок исправления платежей: 21 день.");
    expect(saved(t, 22)).toBe("Срок исправления платежей: 22 дня.");
    expect(saved(t, 45)).toBe("Срок исправления платежей: 45 дней.");
    expect(saved(t, 11)).toBe("Срок исправления платежей: 11 дней.");
  });

  it("en", async () => {
    const t = await translator("en");
    expect([7, 10, 30].map((count) => days(t, count))).toEqual(["7 days", "10 days", "30 days"]);
    expect(saved(t, 1)).toBe("Payment correction window: 1 day.");
    expect(saved(t, 45)).toBe("Payment correction window: 45 days.");
  });
});
