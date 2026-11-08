import { useState } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import FinanceHistoryDetailPopup from "./FinanceHistoryDetailPopup";
import type { PaymentRow } from "./patmentHistoryTable";

/**
 * T6 N2 — tarix tafsiloti pastki qismi (maketlar `superadmin-payments-history-detail-dialog-correctable`, `…-locked`)
 * va tuzatish oqimi oynada: faqat superadmin (admin — tasodifiy `correctable` bo'lsa ham tugma yo'q), har `correctable`
 * holati (ruxsat · zanjir · qulf turlari · ALREADY_CORRECTED · `null` · yuklanish), telefon tartibi, amal tanlansa
 * tafsilot yashirinadi, «Bekor qilish» — qaytadi, muvaffaqiyat va ALREADY_CORRECTED dan keyin — hamma oyna yopiladi,
 * «Smenani ochish» — smena oynasi tasdiq ustida.
 */

const state = vi.hoisted(() => ({
  byId: {} as Record<string, unknown>,
  loading: false,
  post: vi.fn(),
  openShift: vi.fn(),
}));

vi.mock("../../../shared/api/api", () => ({
  api: { get: vi.fn(() => new Promise(() => {})), post: state.post, patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

vi.mock("../../../entities/payments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../entities/payments")>();
  return {
    ...actual,
    useCashBox: () => ({
      useGetFinanceHistoryById: (id: string | null) =>
        state.loading
          ? { data: undefined, isLoading: true, isError: false, refetch: vi.fn() }
          : { data: id && state.byId[id] ? { data: state.byId[id] } : undefined, isLoading: false, isError: false, refetch: vi.fn() },
      useGetCurrentShift: () => ({ data: { data: { shift: null, required: true } }, isSuccess: true, isError: false, refetch: vi.fn() }),
      useGetCashBoxMain: () => ({ data: undefined, isSuccess: false }),
      openShift: { mutateAsync: state.openShift, isPending: false },
    }),
  };
});

const http = (status: number, data: Record<string, unknown> = {}) =>
  Object.assign(new Error(`Request failed with status code ${status}`), { isAxiosError: true, response: { status, data }, request: {} });

const PAID_AT = "2026-10-06T09:32:00.000Z";
const DEADLINE = "2026-11-07T09:32:00.000Z";

const row: PaymentRow = {
  id: "4512",
  amount: 1_850_000,
  operation_type: "income",
  source_type: "courier_payment",
  payment_method: "cash",
  cashbox_id: "1",
  cashbox_type: "main",
  comment: "Kunlik topshiriq",
  payment_date: PAID_AT,
};

const transfer = {
  kind: "courier_payment",
  payment_method: "cash",
  amount: 1_850_000,
  receiver: { cashbox_type: "main", branch_id: null, name: null },
  courier: { id: "263", name: "Jasur Tursunov" },
  market: null,
};

const allowed = { allowed: true, deadline: DEADLINE, window_days: 30, root_history_id: "4512", transfer };

const withDetail = (correctable: unknown, id = "4512") => {
  state.byId[id] = {
    ...row,
    id,
    cashbox: { id: "1", cashbox_type: "main", balance: 24_615_000 },
    source_user: { id: "263", name: "Jasur Tursunov", role: "courier" },
    ...(correctable === undefined ? {} : { correctable }),
  };
};

const Harness = ({ initial, onClosed }: { initial: PaymentRow; onClosed: () => void }) => {
  const [current, setCurrent] = useState<PaymentRow | null>(initial);
  return (
    <FinanceHistoryDetailPopup
      row={current}
      onClose={() => {
        onClosed();
        setCurrent(null);
      }}
    />
  );
};

const open = (role = "superadmin", initial: PaymentRow = row) => {
  const onClosed = vi.fn();
  const utils = renderWithProviders(<Harness initial={initial} onClosed={onClosed} />, {
    preloadedState: { role: { id: "1", role, region: null, name: role } } as never,
  });
  return { ...utils, onClosed, user: userEvent.setup() };
};

const detail = () => screen.getByRole("dialog", { name: "Kirim operatsiyasi" });
const footerOf = (dialog: HTMLElement) => dialog.querySelector<HTMLElement>("[data-dialog-footer]")!;
const buttonNames = (element: HTMLElement) => within(element).getAllByRole("button").map((button) => button.textContent);

beforeEach(() => {
  state.byId = {};
  state.loading = false;
});
afterEach(() => {
  state.post.mockReset();
  state.openShift.mockReset();
});

describe("FinanceHistoryDetailPopup — tuzatish pastki qismi (superadmin)", () => {
  it("ruxsat: muddat izohi, «Qaytarish» (danger-soft) · «Summani tahrirlash» · «Yopish»; telefon tartibi", () => {
    withDetail(allowed);
    open();
    const footer = footerOf(detail());
    expect(footer.textContent?.replace(/\s+/g, " ")).toContain(
      "Qaytarish yoki tahrirlash mumkin: 07.11.2026, 14:32 gacha · muddat 30 kun",
    );
    expect(within(footer).getByText("07.11.2026, 14:32 gacha", { normalizer: (text) => text.replace(/\s+/g, " ") })).toHaveClass(
      "font-semibold",
    );
    expect(buttonNames(footer)).toEqual(["Qaytarish", "Summani tahrirlash", "Yopish"]);
    const [reverse, correct, close] = within(footer).getAllByRole("button");
    expect(reverse).toHaveAttribute("aria-haspopup", "dialog");
    expect(correct).toHaveAttribute("aria-haspopup", "dialog");
    expect(reverse.className).toMatch(/bg-danger-soft/);
    // Telefon: «Summani tahrirlash» tepada, «Qaytarish» ostida, «Yopish» yo'q (X, tutqich, fon).
    expect(reverse).toHaveClass("max-md:order-2", "md:mr-auto");
    expect(correct).toHaveClass("max-md:order-1");
    expect(close).toHaveClass("max-md:hidden");
    expect(footer.querySelector("[data-correction-footer=actions]")).toHaveClass("max-md:flex-col");
  });

  it("zanjir davomi (`root_history_id` ≠ id): «muddat birinchi to'lovdan (#4498)»", () => {
    withDetail({ ...allowed, root_history_id: "4498" }, "4522");
    open("superadmin", { ...row, id: "4522" });
    expect(footerOf(detail()).textContent?.replace(/\s+/g, " ")).toContain(
      "Qaytarish yoki tahrirlash mumkin: 07.11.2026, 14:32 gacha · muddat birinchi to'lovdan (#4498)",
    );
  });

  const locks: Array<[string, Record<string, unknown>, string]> = [
    [
      "WINDOW_EXPIRED",
      { allowed: false, code: "WINDOW_EXPIRED", deadline: "2026-10-02T12:30:00.000Z", window_days: 30, root_history_id: "4512" },
      "Muddat tugagan: 02.10.2026, 17:30To'lovni 30 kun ichida qaytarish yoki summasini tahrirlash mumkin edi.Muddatni o'zgartirish",
    ],
    [
      "LEGACY_UNLINKED",
      { allowed: false, code: "LEGACY_UNLINKED", deadline: null, window_days: 30, root_history_id: null },
      "Eski yozuvBu to'lov tuzatish imkoniyati qo'shilishidan oldin yozilgan va kassalardagi juft yozuvlari aniqlanmagan — uni qaytarib ham, tahrirlab ham bo'lmaydi.",
    ],
    [
      "NOT_CORRECTABLE reversal_row",
      { allowed: false, code: "NOT_CORRECTABLE", reason: "reversal_row", deadline: null, window_days: 30, root_history_id: null },
      "Tuzatib bo'lmaydiTeskari yozuvni qaytarib ham, tahrirlab ham bo'lmaydi.",
    ],
    [
      "NOT_CORRECTABLE cashbox_deleted (kuryer)",
      { allowed: false, code: "NOT_CORRECTABLE", reason: "cashbox_deleted", deadline: null, window_days: 30, root_history_id: null, transfer },
      "Tuzatib bo'lmaydiKuryer kassasi o'chirilgan.",
    ],
    [
      "COURIER_MOVED (ega qarori)",
      { allowed: false, code: "COURIER_MOVED", deadline: DEADLINE, window_days: 30, root_history_id: "4512", transfer },
      "Tuzatib bo'lmaydi — kuryer boshqa filialga o'tgan.",
    ],
  ];
  it.each(locks)("qulf %s: neytral izoh, faqat «Yopish»", (code, correctable, text) => {
    withDetail(correctable);
    open();
    const footer = footerOf(detail());
    const note = within(footer).getByRole("note");
    expect(note.textContent?.replace(/\s+/g, " ")).toBe(text);
    expect(note).toHaveClass("bg-sunken", "ring-border");
    expect(note.querySelector("svg")).toHaveClass("lucide-lock");
    expect(buttonNames(footer)).toEqual(["Yopish"]);
    expect(within(footer).getByRole("button", { name: "Yopish" })).not.toHaveClass("max-md:hidden");
    expect(footer).not.toHaveTextContent("Qaytarish yoki tahrirlash mumkin");
    const link = within(footer).queryByRole("link", { name: "Muddatni o'zgartirish" });
    if (code === "WINDOW_EXPIRED") expect(link).toHaveAttribute("href", "/payments/shift-settings");
    else expect(link).toBeNull();
  });

  it("«Muddatni o'zgartirish» — sozlamalarga, oyna yopiladi", async () => {
    withDetail(locks[0][1]);
    const { user, onClosed } = open();
    await user.click(within(footerOf(detail())).getByRole("link", { name: "Muddatni o'zgartirish" }));
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  const plain: Array<[string, unknown]> = [
    ["ALREADY_CORRECTED", { allowed: false, code: "ALREADY_CORRECTED", deadline: DEADLINE, window_days: 30, root_history_id: "4512" }],
    ["correctable: null", null],
    ["correctable yo'q", undefined],
  ];
  it.each(plain)("%s — faqat «Yopish», izoh yo'q", (_label, correctable) => {
    withDetail(correctable);
    open();
    const footer = footerOf(detail());
    expect(buttonNames(footer)).toEqual(["Yopish"]);
    expect(within(footer).queryByRole("note")).toBeNull();
    expect(footer).not.toHaveTextContent("mumkin");
  });

  it("admin: `correctable` tasodifan kelsa ham — tugma ham, izoh ham yo'q", () => {
    withDetail(allowed);
    open("admin");
    const footer = footerOf(detail());
    expect(buttonNames(footer)).toEqual(["Yopish"]);
    expect(footer).not.toHaveTextContent("Qaytarish");
  });

  it("tafsilot yuklanayotganda — faqat «Yopish»", () => {
    state.loading = true;
    open();
    expect(buttonNames(footerOf(detail()))).toEqual(["Yopish"]);
  });
});

describe("FinanceHistoryDetailPopup — tuzatish oqimi", () => {
  it("«Qaytarish» → tafsilot o'rnida forma; «Bekor qilish» — tafsilotga qaytadi; «Summani tahrirlash» → forma", async () => {
    withDetail(allowed);
    const { user, onClosed } = open();
    await user.click(within(footerOf(detail())).getByRole("button", { name: "Qaytarish" }));
    const form = await screen.findByRole("dialog", { name: "To'lovni qaytarish" });
    expect(screen.queryByRole("dialog", { name: "Kirim operatsiyasi" })).not.toBeInTheDocument();
    expect(form).toHaveTextContent("#4512 · Kuryer to'lovi · 06.10.2026, 14:32");
    await user.click(within(form).getByRole("button", { name: "Bekor qilish" }));
    expect(await screen.findByRole("dialog", { name: "Kirim operatsiyasi" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "To'lovni qaytarish" })).not.toBeInTheDocument();
    expect(onClosed).not.toHaveBeenCalled();

    await user.click(within(footerOf(detail())).getByRole("button", { name: "Summani tahrirlash" }));
    const edit = await screen.findByRole("dialog", { name: "Summani tahrirlash" });
    expect(edit).toHaveTextContent("#4512 · Kuryer to'lovi · Jasur Tursunov · 06.10.2026, 14:32");
    expect(screen.queryByRole("dialog", { name: "Kirim operatsiyasi" })).not.toBeInTheDocument();
  });

  it("muvaffaqiyat: xabar, hamma oyna yopiladi (`onClose`)", async () => {
    withDetail(allowed);
    state.post.mockResolvedValueOnce({ data: { data: { correction: { id: "12", action: "reverse" }, idempotent: false } } });
    const { user, onClosed } = open();
    await user.click(within(footerOf(detail())).getByRole("button", { name: "Qaytarish" }));
    const form = await screen.findByRole("dialog", { name: "To'lovni qaytarish" });
    await user.type(within(form).getByRole("textbox", { name: /^Sabab/ }), "Boshqa kuryer tanlab yuborilgan");
    await user.click(within(form).getByRole("button", { name: "Davom etish" }));
    const confirm = await screen.findByRole("alertdialog", { name: "To'lovni qaytarishni tasdiqlang" });
    await user.click(within(confirm).getByRole("button", { name: "Qaytarish" }));
    expect(await screen.findByText("To'lov qaytarildi")).toBeInTheDocument();
    expect(onClosed).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(state.post).toHaveBeenCalledWith(
      "finance/history/4512/reverse",
      { reason: "Boshqa kuryer tanlab yuborilgan" },
      expect.objectContaining({ headers: { "Idempotency-Key": expect.any(String) }, silentNetworkError: true }),
    );
  });

  it("ALREADY_CORRECTED: «Orqaga» butun oqimni yopadi (forma ham, tafsilot ham)", async () => {
    withDetail(allowed);
    state.post.mockRejectedValueOnce(http(409, { code: "ALREADY_CORRECTED" }));
    const { user, onClosed } = open();
    await user.click(within(footerOf(detail())).getByRole("button", { name: "Qaytarish" }));
    const form = await screen.findByRole("dialog", { name: "To'lovni qaytarish" });
    await user.type(within(form).getByRole("textbox", { name: /^Sabab/ }), "Boshqa kuryer tanlab yuborilgan");
    await user.click(within(form).getByRole("button", { name: "Davom etish" }));
    const confirm = await screen.findByRole("alertdialog", { name: "To'lovni qaytarishni tasdiqlang" });
    await user.click(within(confirm).getByRole("button", { name: "Qaytarish" }));
    await within(confirm).findByText("To'lov allaqachon tuzatilgan. Ro'yxat yangilandi.");
    await user.click(within(confirm).getByRole("button", { name: "Orqaga" }));
    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("SHIFT_REQUIRED: «Smenani ochish» — smena oynasi tasdiq ustida; ochilgach tasdiqqa qaytadi", async () => {
    withDetail(allowed);
    state.post.mockRejectedValueOnce(http(400, { code: "SHIFT_REQUIRED" }));
    state.openShift.mockResolvedValueOnce({});
    const { user } = open();
    await user.click(within(footerOf(detail())).getByRole("button", { name: "Qaytarish" }));
    const form = await screen.findByRole("dialog", { name: "To'lovni qaytarish" });
    await user.type(within(form).getByRole("textbox", { name: /^Sabab/ }), "Boshqa kuryer tanlab yuborilgan");
    await user.click(within(form).getByRole("button", { name: "Davom etish" }));
    const confirm = await screen.findByRole("alertdialog", { name: "To'lovni qaytarishni tasdiqlang" });
    await user.click(within(confirm).getByRole("button", { name: "Qaytarish" }));
    const alert = await within(confirm).findByRole("alert");
    await user.click(within(alert).getByRole("button", { name: "Smenani ochish" }));
    const shift = await screen.findByRole("dialog", { name: "Smenani ochish" });
    await user.click(within(shift).getByRole("button", { name: "Smenani ochish" }));
    await waitFor(() => expect(state.openShift).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Smenani ochish" })).not.toBeInTheDocument());
    expect(screen.getByRole("alertdialog", { name: "To'lovni qaytarishni tasdiqlang" })).toBeInTheDocument();
  });
});
