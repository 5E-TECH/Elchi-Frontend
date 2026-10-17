import { fireEvent, screen, within } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
  onClose: vi.fn(),
}));

vi.mock("../../../entities/payments/financeCoverage", () => ({
  useFinanceCoverage: () => ({
    createFinancialBalanceEntry: { mutate: mocks.mutate, isPending: mocks.isPending },
  }),
}));

import FinancialEntryModal from "./FinancialEntryModal";

/**
 * «Yozuv qo'shish» (GtAoqHlk) — dizayn v2 oynasi (`superadmin-balance-entry-dialog`).
 * Xulq tekshiruvlari v1 dagidek: payload AYNAN `{amount, source_type, comment}`, ishora, Idempotency-Key
 * (qayta urinishda o'sha kalit), validatsiya, server/tarmoq xatosi oynada, yuborilayotganda yopilmaydi.
 */

const open = () => renderWithProviders(<FinancialEntryModal open onClose={mocks.onClose} />);
const dialog = () => screen.getByRole("dialog", { name: "Qo'lda yozuv qo'shish" });
const amountInput = () => within(dialog()).getByLabelText(/^Summa/);
const commentInput = () => within(dialog()).getByLabelText(/^Izoh/);

beforeEach(() => {
  mocks.mutate.mockReset();
  mocks.onClose.mockReset();
  mocks.isPending = false;
});

describe("FinancialEntryModal — qo'lda yozuv (GtAoqHlk)", () => {
  it("qo'lda chiqim: payload AYNAN {amount, source_type, comment}, summa manfiy, Idempotency-Key bilan", () => {
    open();
    fireEvent.change(amountInput(), { target: { value: "50 000" } });
    fireEvent.change(commentInput(), { target: { value: "  Ofis ijarasi  " } });
    // «Balansga ta'siri» — ishorali (haqiqiy minus), uz «so'm».
    expect(within(dialog()).getByRole("status")).toHaveTextContent(/^Balansga ta'siri: −50 000 so'm$/);
    fireEvent.click(within(dialog()).getByRole("button", { name: "Saqlash" }));

    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    const [{ data, idempotencyKey }] = mocks.mutate.mock.calls[0] as [{ data: unknown; idempotencyKey: string }];
    expect(data).toStrictEqual({ amount: -50000, source_type: "manual_expense", comment: "Ofis ijarasi" });
    expect(idempotencyKey).toEqual(expect.any(String));
  });

  it("qo'lda kirim musbat; tuzatishda yo'nalishni operator tanlaydi", () => {
    open();
    fireEvent.change(amountInput(), { target: { value: "1000" } });
    fireEvent.change(commentInput(), { target: { value: "Qaytim" } });

    fireEvent.click(within(dialog()).getByRole("button", { name: "Qo'lda kirim" }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Saqlash" }));
    expect((mocks.mutate.mock.calls[0][0] as { data: { amount: number } }).data.amount).toBe(1000);

    fireEvent.click(within(dialog()).getByRole("button", { name: "Tuzatish" }));
    fireEvent.click(within(dialog()).getByRole("radio", { name: "Kirim (+)" }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Saqlash" }));
    expect(mocks.mutate.mock.calls[1][0]).toMatchObject({ data: { amount: 1000, source_type: "correction" } });
  });

  it("yo'nalish segmenti doim ko'rinadi: qat'iy manbada tanlangan va o'chiq, tuzatishda faol", () => {
    open();
    const income = () => within(dialog()).getByRole("radio", { name: "Kirim (+)" });
    const expense = () => within(dialog()).getByRole("radio", { name: "Chiqim (−)" });

    // Sukut — qo'lda chiqim: chiqim tanlangan, ikkalasi o'chiq.
    expect(expense()).toHaveAttribute("aria-checked", "true");
    expect(income()).toBeDisabled();
    expect(expense()).toBeDisabled();

    fireEvent.click(within(dialog()).getByRole("button", { name: "Qo'lda kirim" }));
    expect(income()).toHaveAttribute("aria-checked", "true");
    expect(income()).toBeDisabled();

    fireEvent.click(within(dialog()).getByRole("button", { name: "Tuzatish" }));
    expect(within(dialog()).getByRole("button", { name: "Tuzatish" })).toHaveAttribute("aria-pressed", "true");
    expect(income()).toBeEnabled();
    expect(expense()).toBeEnabled();
  });

  it("chiplar maket tartibida va matnida (MANUAL_ENTRY_SOURCES)", () => {
    open();
    const chips = within(dialog())
      .getAllByRole("button")
      .filter((button) => button.hasAttribute("aria-pressed"))
      .map((button) => button.textContent);
    expect(chips).toEqual(["Qo'lda chiqim", "Qo'lda kirim", "Hisob-fakturalar", "Maosh", "Tuzatish"]);
  });

  it("summa yoki sabab bo'lmasa yuborilmaydi", () => {
    open();
    expect(within(dialog()).getByText("Sababini yozing — kamida 3 belgi.")).toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Saqlash" }));

    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(within(dialog()).getByText("Summani kiriting")).toBeInTheDocument();
    expect(within(dialog()).getByText("Sababini yozing (kamida 3 belgi)")).toBeInTheDocument();
  });

  it("server xatosi oynada ko'rinadi, oyna yopilmaydi", () => {
    mocks.mutate.mockImplementation((_vars: unknown, options: { onError: (e: unknown) => void }) =>
      options.onError(
        new AxiosError("Request failed with status code 400", "ERR_BAD_REQUEST", undefined, undefined, {
          status: 400,
          data: { message: "property foo should not exist" },
        } as AxiosResponse),
      ),
    );
    open();
    fireEvent.change(amountInput(), { target: { value: "1000" } });
    fireEvent.change(commentInput(), { target: { value: "Ijara" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Saqlash" }));

    expect(within(dialog()).getByRole("alert")).toHaveTextContent("property foo should not exist");
    expect(mocks.onClose).not.toHaveBeenCalled();
  });

  it("tarmoq xatosi: oynada xom \"Network Error\" emas, \"Tarmoq xatosi\"; qayta urinish o'sha kalit bilan", () => {
    mocks.mutate.mockImplementationOnce((_vars: unknown, options: { onError: (e: unknown) => void }) =>
      options.onError(new AxiosError("Network Error", "ERR_NETWORK")),
    );
    open();
    fireEvent.change(amountInput(), { target: { value: "1000" } });
    fireEvent.change(commentInput(), { target: { value: "Ijara" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Saqlash" }));

    const alert = within(dialog()).getByRole("alert");
    expect(alert).toHaveTextContent("Tarmoq xatosi");
    expect(alert).not.toHaveTextContent("Network Error");

    fireEvent.click(within(dialog()).getByRole("button", { name: "Saqlash" }));
    const [first, second] = mocks.mutate.mock.calls.map((call) => call[0] as { idempotencyKey: string });
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
  });

  it("muvaffaqiyatdan keyin oyna yopiladi va keyingi yozuv YANGI kalit oladi", () => {
    mocks.mutate.mockImplementation((_vars: unknown, options: { onSuccess: () => void }) => options.onSuccess());
    open();
    fireEvent.change(amountInput(), { target: { value: "1000" } });
    fireEvent.change(commentInput(), { target: { value: "Ijara" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Saqlash" }));
    expect(mocks.onClose).toHaveBeenCalledTimes(1);

    fireEvent.change(amountInput(), { target: { value: "2000" } });
    fireEvent.change(commentInput(), { target: { value: "Kommunal" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Saqlash" }));
    const [first, second] = mocks.mutate.mock.calls.map((call) => call[0] as { idempotencyKey: string });
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey);
  });

  it("yuborilayotganda: «Saqlash» qayta yubormaydi, «Bekor qilish» o'chiq, oyna yopilmaydi", () => {
    mocks.isPending = true;
    open();
    fireEvent.change(amountInput(), { target: { value: "1000" } });
    fireEvent.change(commentInput(), { target: { value: "Ijara" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Saqlash" }));

    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(within(dialog()).getByRole("button", { name: "Bekor qilish" })).toBeDisabled();
    fireEvent.keyDown(dialog(), { key: "Escape" });
    expect(mocks.onClose).not.toHaveBeenCalled();
  });
});
