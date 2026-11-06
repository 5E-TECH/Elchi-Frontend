import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MainCashbox from "./mainCashbox";
import type { PaymentRow } from "./patmentHistoryTable";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * T6-FE-1 (XXyAZ9ge) — `/payments/main-cashbox` «Operatsiyalar tarixi» (maket yo'q — eng yaqini
 * `superadmin-payments-overview-corrected`, B1): «Manba» da sarlavhadan keyin belgi, teskari yozuv ostida sabab emas —
 * asl yozuvga havola, «Tuzatilgan» ostida «#id o'rniga» (bo'linmaydi), tugma va karta nomida belgi va pastki qator;
 * «Tuzatilgan» sanasi — tuzatish vaqti (C1). Haqiqiy `useCashBox` (react-query) — faqat HTTP qatlami almashtirilgan.
 */

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: http,
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));
vi.mock("./lib/exportMainCashboxReport", () => ({ exportMainCashboxReport: vi.fn() }));
vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetUser: () => ({ data: undefined, isLoading: false }),
    useGetUserById: () => ({ data: undefined, isLoading: false }),
    useGetManagers: () => ({ data: undefined, isLoading: false }),
    useGetCouriers: () => ({ data: undefined, isLoading: false }),
  }),
}));
vi.mock("../../../entities/markets", () => ({
  useMarkets: () => ({ useGetMarkets: () => ({ data: undefined, isLoading: false }) }),
}));
vi.mock("../../../entities/branch/api/useBranches", () => ({
  useBranches: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("./SalaryPaymentPopup", () => ({ default: () => null }));
vi.mock("./MainCashboxBalanceChart", () => ({ default: () => null }));

const superadmin = { role: { id: "1", role: "superadmin", region: null, name: "Shodiyor Ergashev" } } as never;

const REVERSE_REASON = "Boshqa kuryer tanlab yuborilgan — pul Rustam Qosimovdan olingan";
const EDIT_REASON = "Marketga 2 000 000 so'm o'tkazilgan, summa xato kiritilgan";
const author = { id: "1", name: "Shodiyor Ergashev", role: "superadmin" };

type Related = { id: string; source_type: string; role: string; operation_type: string; amount: number };
const correction = (role: string, action: string, related: Related) =>
  ({
    id: action === "edit" ? "13" : "12",
    action,
    payment_kind: action === "edit" ? "market_payment" : "courier_payment",
    role,
    reason: action === "edit" ? EDIT_REASON : REVERSE_REASON,
    created_by_name: "Shodiyor Ergashev",
    created_at: "2026-10-08T11:40:00.000Z",
    original_amount: action === "edit" ? 2_400_000 : 1_850_000,
    new_amount: action === "edit" ? 2_000_000 : null,
    related_history_id: related.id,
    related: { ...related, created_at: "2026-10-08T11:40:00.000Z" },
  }) as unknown as PaymentRow["correction"];

const base = (id: string, overrides: Partial<PaymentRow>): PaymentRow => ({
  id,
  amount: 1_850_000,
  cashbox_id: "1",
  cashbox_type: "main",
  payment_method: "cash",
  created_by_user: author,
  createdAt: "2026-10-08T09:32:00.000Z",
  payment_date: "2026-10-08T09:32:00.000Z",
  ...overrides,
});

/** Asosiy kassa (server tartibi): teskari yozuv, «Tuzatilgan», tahrir teskari yozuvi, qaytarilgan, tahrirlangan, oddiy. */
const mainRows: PaymentRow[] = [
  base("4531", {
    operation_type: "expense",
    source_type: "payment_reversal",
    comment: REVERSE_REASON,
    source_user: { id: "263", name: "Jasur Tursunov" },
    payment_date: undefined,
    createdAt: "2026-10-08T11:40:00.000Z",
    reverses_history_id: "4511",
    correction: correction("reversal", "reverse", {
      id: "4511", source_type: "courier_payment", role: "original", operation_type: "income", amount: 1_850_000,
    }),
  }),
  base("4522", {
    amount: 2_000_000,
    operation_type: "expense",
    source_type: "market_payment",
    comment: "Oktabr, 1-hafta hisobi",
    source_user: { id: "101", name: "Baraka Shop" },
    // Backend asl `payment_date` ni nusxalaydi — ko'rsatiladigan vaqt tuzatish vaqti (C1).
    payment_date: "2026-10-08T08:05:00.000Z",
    createdAt: "2026-10-08T10:10:00.000Z",
    correction: correction("replacement", "edit", {
      id: "4498", source_type: "market_payment", role: "original", operation_type: "expense", amount: 2_400_000,
    }),
  }),
  base("4521", {
    amount: 2_400_000,
    operation_type: "income",
    source_type: "payment_reversal",
    comment: EDIT_REASON,
    source_user: { id: "101", name: "Baraka Shop" },
    payment_date: undefined,
    createdAt: "2026-10-08T10:10:00.000Z",
    reverses_history_id: "4498",
    correction: correction("reversal", "edit", {
      id: "4498", source_type: "market_payment", role: "original", operation_type: "expense", amount: 2_400_000,
    }),
  }),
  base("4511", {
    operation_type: "income",
    source_type: "courier_payment",
    source_user: { id: "263", name: "Jasur Tursunov" },
    correction: correction("original", "reverse", {
      id: "4531", source_type: "payment_reversal", role: "reversal", operation_type: "expense", amount: 1_850_000,
    }),
  }),
  base("4498", {
    amount: 2_400_000,
    operation_type: "expense",
    source_type: "market_payment",
    source_user: { id: "101", name: "Baraka Shop" },
    payment_date: "2026-10-08T08:05:00.000Z",
    createdAt: "2026-10-08T08:05:00.000Z",
    correction: correction("original", "edit", {
      id: "4522", source_type: "market_payment", role: "replacement", operation_type: "expense", amount: 2_000_000,
    }),
  }),
  base("4400", { amount: 920_000, operation_type: "income", source_type: "courier_payment", correction: null }),
];

const phoneMedia = () => {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query.includes("max-width"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
};

const kinds = (scope: ParentNode = document) =>
  [...scope.querySelectorAll("[data-payment-correction]")].map((el) => el.getAttribute("data-payment-correction"));

const open = () =>
  renderWithProviders(<MainCashbox />, { route: "/payments/main-cashbox", preloadedState: superadmin });

let restoreMedia: (() => void) | null = null;

beforeEach(() => {
  // «Bugun, HH:mm» — Toshkent vaqti (testlar TZ=Asia/Tashkent bilan).
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-08T13:00:00.000Z"));
  window.sessionStorage.clear();
  Object.values(http).forEach((fn) => fn.mockReset());
  http.get.mockImplementation(async (url: string) => {
    if (url === "finance/history") {
      return { data: { statusCode: 200, message: "success", data: { items: mainRows } } };
    }
    if (url === "finance/shift/current") {
      return {
        data: {
          statusCode: 200,
          message: "Current shift",
          data: { shift: { id: "12", opened_by: "1", status: "open", opened_at: "2026-10-08T04:00:00.000Z" }, required: true },
        },
      };
    }
    return { data: { statusCode: 200, message: "success", data: {} } };
  });
});

afterEach(() => {
  vi.useRealTimers();
  restoreMedia?.();
  restoreMedia = null;
});

describe("Asosiy kassa tarixi — to'lov tuzatish (T6)", () => {
  it("jadval: belgi «Manba» da sarlavhadan keyin, havolalar sabab o'rnida, «#id o'rniga», tugma nomida belgi", async () => {
    open();
    const table = await screen.findByRole("table", { name: "Operatsiyalar tarixi" });
    await within(table).findByText("Tuzatilgan");
    const [reversal, replacement, editReversal, reversed, edited, plain] = within(table).getAllByRole("row").slice(1);

    expect(kinds(table)).toEqual(["reversal", "replacement", "reversal", "reversed", "edited"]);
    expect(plain.querySelector("[data-payment-correction]")).toBeNull();
    for (const [row, title, badge] of [
      [reversal, "To'lovni qaytarish", "Teskari yozuv"],
      [replacement, "Market to'lovi", "Tuzatilgan"],
      [reversed, "Kuryer to'lovi", "Qaytarildi"],
      [edited, "Market to'lovi", "Tahrirlangan"],
    ] as const) {
      expect(within(row).getByRole("button", { name: title }).nextElementSibling).toHaveTextContent(badge);
    }

    // Teskari yozuv: sabab emas — asl yozuvga havola.
    expect(reversal).toHaveTextContent("#4511 · Kuryer to'lovi qaytarildi");
    expect(editReversal).toHaveTextContent("#4498 · summa tahrirlandi");
    expect(table).not.toHaveTextContent(REVERSE_REASON);
    expect(table).not.toHaveTextContent(EDIT_REASON);

    // «Tuzatilgan»: qarshi tomon · «#4498 o'rniga» (bo'linmaydi), sanasi — tuzatish vaqti.
    const insteadOf = within(replacement).getByText("#4498 o'rniga");
    expect(insteadOf).toHaveClass("whitespace-nowrap");
    expect(insteadOf.parentElement).toHaveTextContent(/^Baraka Shop · #4498 o'rniga$/);
    expect(replacement).toHaveTextContent("Bugun, 15:10");

    expect(
      within(reversal).getByRole("button", { name: "To'lovni qaytarish, Teskari yozuv (Bugun, 16:40) tafsilotini ochish" }),
    ).toBeInTheDocument();
    expect(
      within(reversed).getByRole("button", { name: "Kuryer to'lovi, Qaytarildi (Bugun, 14:32) tafsilotini ochish" }),
    ).toBeInTheDocument();
  });

  it("telefon kartasi: belgi «Kirim/Chiqim» dan keyin; sub — qarshi tomon · #id o'rniga · to'lov turi; nomida pastki qator", async () => {
    restoreMedia = phoneMedia();
    open();
    const card = await screen.findByRole("button", {
      name: "To'lovni qaytarish, Teskari yozuv (#4511 · Kuryer to'lovi qaytarildi), Chiqim −1 850 000 so'm, Bugun, 16:40 · Shodiyor Ergashev",
    });
    expect(card).toHaveTextContent("#4511 · Kuryer to'lovi qaytarildi · Naqd");
    expect(within(card).getByText("Teskari yozuv").previousElementSibling).toHaveTextContent("Chiqim");

    const replacement = screen.getByRole("button", {
      name: "Market to'lovi, Tuzatilgan (Baraka Shop · #4498 o'rniga), Chiqim −2 000 000 so'm, Bugun, 15:10 · Shodiyor Ergashev",
    });
    expect(replacement).toHaveTextContent("Baraka Shop · #4498 o'rniga · Naqd");
    expect(within(replacement).getByText("#4498 o'rniga")).toHaveClass("whitespace-nowrap");
    expect(within(replacement).getByText("Tuzatilgan").previousElementSibling).toHaveTextContent("Chiqim");
    expect(kinds()).toEqual(["reversal", "replacement", "reversal", "reversed", "edited"]);
  });
});
