import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import ShiftSettingsPage from ".";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * QlLf33Ma, 6-bosqich — «Chek rasmi va AI tahlili» kartasi (TZ 1, UI qismi): rasm o'chiq — AI kaliti bosilmaydi; rasmni
 * o'chirish tasdiq bilan va AI ham o'chadi; «Saqlash» yagona va faqat o'zgarganlarni yuboradi; bekor qilinsa hech narsa
 * o'zgarmaydi; chek so'rovi yiqilsa smena sozlamasi baribir saqlanadi va xato aniq aytiladi.
 */

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api: http, API_TIMEOUT_MS: 20_000, LONG_REQUEST_TIMEOUT_MS: 120_000 }));

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
  hq_transfer: { photo_required: false, ai_enabled: false },
  updated_at: "2026-10-01T05:15:00.000Z",
  updated_by: "1",
};
const RECEIPT_URL = "finance/receipt-settings";
const SHIFT_URL = "finance/shift/settings";
const superadmin = { role: { id: "1", role: "superadmin", region: null, name: "SA" } } as never;

const receiptPatches = () => http.patch.mock.calls.filter(([url]) => url === RECEIPT_URL);
const shiftPatches = () => http.patch.mock.calls.filter(([url]) => url === SHIFT_URL);

const open = async () => {
  renderWithProviders(<ShiftSettingsPage />, { route: "/payments/shift-settings", preloadedState: superadmin });
  await screen.findByText("Chek rasmi va AI tahlili");
  await screen.findAllByRole("switch", { name: "Qo'lda chiqim: chek rasmi majburiy" });
};
const toggle = (name: string) => screen.getAllByRole("switch", { name })[0];

beforeEach(() => {
  http.get.mockReset();
  http.patch.mockReset();
  http.get.mockImplementation(async (url: string) => {
    if (url === RECEIPT_URL) return { data: { statusCode: 200, data: RECEIPTS } };
    if (url.startsWith("user")) return { data: { statusCode: 200, data: { id: "1", name: "Shodiyor Ergashev" } } };
    return { data: { statusCode: 200, data: SHIFT } };
  });
  http.patch.mockImplementation(async () => ({ data: { statusCode: 200, data: {} } }));
});

describe("Chek rasmi va AI tahlili kartasi (QlLf33Ma)", () => {
  it("kalitlar serverdan; rasm o'chiq qatorda AI bosilmaydi va «Avval chek rasmini yoqing»", async () => {
    await open();

    expect(toggle("Qo'lda chiqim: chek rasmi majburiy")).toHaveAttribute("aria-checked", "true");
    expect(toggle("Qo'lda chiqim: AI tahlili")).toBeEnabled();
    expect(toggle("Kuryer va filialdan HQ'ga o'tkazma: chek rasmi majburiy")).toHaveAttribute("aria-checked", "false");
    expect(toggle("Kuryer va filialdan HQ'ga o'tkazma: AI tahlili")).toBeDisabled();
    expect(screen.getAllByText("Avval chek rasmini yoqing").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Chek majburiy, AI tekshiradi").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Chek so'ralmaydi").length).toBeGreaterThan(0);
    await screen.findByText(/Oxirgi o'zgarish: Shodiyor Ergashev · /);
    expect(screen.getByRole("button", { name: /Saqlash/ })).toBeDisabled();
  });

  it("rasmni o'chirish tasdiq so'raydi: bekor qilinsa o'zgarmaydi, tasdiqda AI ham o'chadi, PATCH — faqat o'zgargan", async () => {
    const user = userEvent.setup();
    await open();

    await user.click(toggle("Qo'lda chiqim: chek rasmi majburiy"));
    let dialog = await screen.findByRole("alertdialog", { name: "Chek rasmini o'chirishni tasdiqlang" });
    expect(within(dialog).getByText("Qo'lda chiqimda chek rasmi so'ralmaydi. O'zgarish «Saqlash» bosilganda kuchga kiradi.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(toggle("Qo'lda chiqim: chek rasmi majburiy")).toHaveAttribute("aria-checked", "true");

    await user.click(toggle("Qo'lda chiqim: chek rasmi majburiy"));
    dialog = await screen.findByRole("alertdialog", { name: "Chek rasmini o'chirishni tasdiqlang" });
    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));

    await waitFor(() => expect(toggle("Qo'lda chiqim: chek rasmi majburiy")).toHaveAttribute("aria-checked", "false"));
    expect(toggle("Qo'lda chiqim: AI tahlili")).toBeDisabled();
    expect(toggle("Qo'lda chiqim: AI tahlili")).toHaveAttribute("aria-checked", "false");
    expect(http.patch).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Saqlash/ }));
    await waitFor(() => expect(receiptPatches()).toHaveLength(1));
    expect(receiptPatches()[0][1]).toEqual({ manual_expense: { photo_required: false, ai_enabled: false } });
    expect(shiftPatches()).toHaveLength(0);
    expect(await screen.findByText("Sozlamalar saqlandi")).toBeInTheDocument();
  });

  it("rasm qayta yoqilsa AI o'chiq qoladi va AI kaliti tasdiqsiz", async () => {
    const user = userEvent.setup();
    await open();

    await user.click(toggle("Kuryer va filialdan HQ'ga o'tkazma: chek rasmi majburiy"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(toggle("Kuryer va filialdan HQ'ga o'tkazma: AI tahlili")).toHaveAttribute("aria-checked", "false");
    expect(toggle("Kuryer va filialdan HQ'ga o'tkazma: AI tahlili")).toBeEnabled();
    expect(screen.getAllByText("Chek majburiy, summa qo'lda tekshiriladi").length).toBeGreaterThan(0);

    await user.click(toggle("Qo'lda chiqim: AI tahlili"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Saqlash/ }));
    await waitFor(() => expect(receiptPatches()).toHaveLength(1));
    expect(receiptPatches()[0][1]).toEqual({
      manual_expense: { ai_enabled: false },
      hq_transfer: { photo_required: true },
    });
  });

  it("ikki bo'lim o'zgarsa ikki PATCH; chek yiqilsa kod bo'yicha aniq xabar, kiritilgan qiymat qoladi", async () => {
    http.patch.mockImplementation(async (url: string) => {
      if (url === RECEIPT_URL) {
        throw Object.assign(new Error("400"), {
          response: { status: 400, data: { statusCode: 400, code: "RECEIPT_AI_REQUIRES_PHOTO", message: "x" } },
        });
      }
      return { data: { statusCode: 200, data: {} } };
    });
    const user = userEvent.setup();
    await open();

    await user.click(screen.getByRole("switch", { name: "Smena yopishda har karta qoldig'i majburiy" }));
    await user.click(toggle("Qo'lda chiqim: AI tahlili"));
    await user.click(screen.getByRole("button", { name: /Saqlash/ }));

    await waitFor(() => expect(http.patch).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("AI tahlili faqat chek rasmi yoqilganda ishlaydi")).toBeInTheDocument();
    expect(toggle("Qo'lda chiqim: AI tahlili")).toHaveAttribute("aria-checked", "false");
  });

  it("chek sozlamasi o'qilmasa — kartada xato + «Qayta urinish», smena sozlamalari ishlayveradi", async () => {
    const shiftOnly = http.get.getMockImplementation();
    http.get.mockImplementation(async (url: string, ...rest: unknown[]) => {
      if (url === RECEIPT_URL) throw Object.assign(new Error("500"), { response: { status: 500, data: {} } });
      return shiftOnly?.(url, ...rest);
    });
    renderWithProviders(<ShiftSettingsPage />, { route: "/payments/shift-settings", preloadedState: superadmin });

    expect(await screen.findByRole("button", { name: /Qayta urinish/ })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Smena yopishda har karta qoldig'i majburiy" })).toBeInTheDocument();
  });
});
