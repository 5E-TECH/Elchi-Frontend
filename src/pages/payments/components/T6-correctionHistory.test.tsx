import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import PaymentHistoryList from "./PaymentHistoryList";
import PaymentHistoryTable, { type PaymentRow } from "./patmentHistoryTable";

/**
 * T6-FE-1 (XXyAZ9ge) — kassa tarixidagi to'lov tuzatish belgilari: «To'lovlar» jadvali va telefon kartalari (maket
 * `superadmin-payments-overview-corrected`), kassa tafsilotidagi ro'yxat (`superadmin-payments-cash-detail-courier-
 * corrected`). To'rt belgi (Qaytarildi · Tahrirlangan · Teskari yozuv · Tuzatilgan), teskari yozuv ostida sabab emas —
 * asl yozuvga havola, «Tuzatilgan» ostida «#id o'rniga», tugma nomida belgi. Summa o'zgarmaydi (ega qarori).
 * `/cash-box` — `MyCashboxPage.test.tsx`, oyna — `FinanceHistoryDetailPopup.test.tsx`.
 */

vi.mock("./FinanceHistoryDetailPopup", () => ({ default: () => null }));

const asRole = (role: string) => ({ role: { id: "1", role, region: null, name: role } }) as never;

const REVERSE_REASON = "Boshqa kuryer tanlab yuborilgan — pul Rustam Qosimovdan olingan";
const EDIT_REASON = "Marketga 2 000 000 so'm o'tkazilgan, summa xato kiritilgan";
const superadmin = { id: "1", name: "Shodiyor Ergashev", role: "superadmin" };

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
  created_by_user: superadmin,
  createdAt: "2026-10-08T09:32:00.000Z",
  payment_date: "2026-10-08T09:32:00.000Z",
  ...overrides,
});

/** Asosiy kassa (superadmin ko'radi): qaytarilgan kuryer to'lovi, uning teskari yozuvi, tahrir uchligi. */
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

let restoreMedia: (() => void) | null = null;
beforeEach(() => {
  // «Bugun, HH:mm» — Toshkent vaqti (testlar TZ=Asia/Tashkent bilan).
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-08T13:00:00.000Z"));
});
afterEach(() => {
  vi.useRealTimers();
  restoreMedia?.();
  restoreMedia = null;
});

const kinds = () => [...document.querySelectorAll("[data-payment-correction]")].map((el) => el.getAttribute("data-payment-correction"));

describe("«To'lovlar» jadvali (superadmin-payments-overview-corrected)", () => {
  const open = () =>
    renderWithProviders(<PaymentHistoryTable data={mainRows} viewerRole="superadmin" />, {
      preloadedState: asRole("superadmin"),
    });

  it("to'rt belgi «Manba» da sarlavhadan keyin; tuzatilmagan qatorda belgi yo'q", () => {
    open();
    const [reversal, replacement, , reversed, edited, plain] = within(screen.getByRole("table"))
      .getAllByRole("row")
      .slice(1);
    expect(kinds()).toEqual(["reversal", "replacement", "reversal", "reversed", "edited"]);
    const title = within(reversed).getByRole("button", { name: "Kuryer to'lovi" });
    expect(title.nextElementSibling).toHaveTextContent("Qaytarildi");
    expect(within(edited).getByText("Tahrirlangan")).toHaveClass("bg-warning-soft");
    expect(within(replacement).getByText("Tuzatilgan")).toHaveClass("bg-info-soft");
    expect(within(reversal).getByText("Teskari yozuv").querySelector("svg")).toBeNull();
    expect(within(reversed).getByText("Qaytarildi").querySelector("svg")).not.toBeNull();
    expect(plain.querySelector("[data-payment-correction]")).toBeNull();
  });

  it("pastki qatorlar: havola sabab o'rnida, «#id o'rniga» qo'shiladi; «Tuzatilgan» — tuzatish vaqti", () => {
    open();
    const [reversal, replacement, editReversal, reversed] = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(reversal).toHaveTextContent("To'lovni qaytarish");
    expect(reversal).toHaveTextContent("#4511 · Kuryer to'lovi qaytarildi");
    expect(editReversal).toHaveTextContent("#4498 · summa tahrirlandi");
    expect(screen.getByRole("table")).not.toHaveTextContent(REVERSE_REASON);
    expect(screen.getByRole("table")).not.toHaveTextContent(EDIT_REASON);
    expect(replacement).toHaveTextContent("Baraka Shop · #4498 o'rniga");
    expect(within(replacement).getByText("#4498 o'rniga")).toHaveClass("whitespace-nowrap");
    expect(replacement).toHaveTextContent("Bugun, 15:10");
    expect(reversed).toHaveTextContent("Jasur Tursunov");
  });

  it("summa tuzatilmagan qatordagidek (chizilmaydi, xiralashmaydi); tugma nomida belgi", () => {
    open();
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    const reversedAmount = within(rows[3]).getByText("+1 850 000 so'm");
    const plainAmount = within(rows[5]).getByText("+920 000 so'm");
    expect(reversedAmount.className).toBe(plainAmount.className);
    expect(reversedAmount.className).not.toMatch(/line-through|opacity|text-text-muted/);
    expect(document.querySelector(".line-through")).toBeNull();
    expect(
      within(rows[3]).getByRole("button", { name: "Kuryer to'lovi, Qaytarildi (Bugun, 14:32) tafsilotini ochish" }),
    ).toBeInTheDocument();
    expect(
      within(rows[0]).getByRole("button", { name: "To'lovni qaytarish, Teskari yozuv (Bugun, 16:40) tafsilotini ochish" }),
    ).toBeInTheDocument();
  });

  it("telefon kartasi: belgi «Kirim/Chiqim» dan keyin, sub — havola va kassa; nomida pastki qator ham", () => {
    restoreMedia = phoneMedia();
    open();
    // Karta nomi ichidagini almashtiradi — T6 pastki qatori ham aytiladi (ekran o'quvchi).
    const card = screen.getByRole("button", {
      name: "To'lovni qaytarish, Teskari yozuv (#4511 · Kuryer to'lovi qaytarildi), Chiqim −1 850 000 so'm, Bugun, 16:40 · Shodiyor Ergashev",
    });
    expect(card).toHaveTextContent("#4511 · Kuryer to'lovi qaytarildi · Asosiy kassa");
    const badge = within(card).getByText("Teskari yozuv");
    expect(badge.previousElementSibling).toHaveTextContent("Chiqim");
    const replacement = screen.getByRole("button", {
      name: "Market to'lovi, Tuzatilgan (Baraka Shop · #4498 o'rniga), Chiqim −2 000 000 so'm, Bugun, 15:10 · Shodiyor Ergashev",
    });
    expect(replacement).toHaveTextContent("Baraka Shop · #4498 o'rniga · Asosiy kassa");
    // «#4498 o'rniga» bo'linmaydi (maket).
    expect(within(replacement).getByText("#4498 o'rniga")).toHaveClass("whitespace-nowrap");
    expect(
      screen.getByRole("button", {
        name: "Kuryer to'lovi, Qaytarildi (Jasur Tursunov), Kirim +1 850 000 so'm, Bugun, 14:32 · Shodiyor Ergashev",
      }),
    ).toBeInTheDocument();
    expect(kinds()).toEqual(["reversal", "replacement", "reversal", "reversed", "edited"]);
  });

  it("admin va menejer ro'yxatida ham belgilar (maket yo'q — eng yaqini superadmin)", () => {
    for (const role of ["admin", "manager"]) {
      const { unmount } = renderWithProviders(<PaymentHistoryTable data={mainRows} viewerRole={role} />, {
        preloadedState: asRole(role),
      });
      expect(kinds()).toEqual(["reversal", "replacement", "reversal", "reversed", "edited"]);
      // Sarlavha ko'ruvchi nuqtai nazaridan (C10): menejerda — «Kuryerdan filialga o'tkazma».
      expect(screen.getByRole("table")).toHaveTextContent(
        role === "manager" ? "#4511 · Kuryerdan filialga o'tkazma qaytarildi" : "#4511 · Kuryer to'lovi qaytarildi",
      );
      unmount();
    }
  });
});

describe("kassa tafsilotidagi ro'yxat (superadmin-payments-cash-detail-courier-corrected)", () => {
  /** Kuryer kassasi: kuryer to'lovi chiqim, teskari yozuv — kirim. */
  const courierRows: PaymentRow[] = [
    base("4530", {
      cashbox_id: "70",
      cashbox_type: "couriers",
      operation_type: "income",
      source_type: "payment_reversal",
      comment: REVERSE_REASON,
      createdAt: "2026-10-08T11:40:00.000Z",
      payment_date: undefined,
      reverses_history_id: "4512",
      correction: correction("reversal", "reverse", {
        id: "4512", source_type: "courier_payment", role: "original", operation_type: "expense", amount: 1_850_000,
      }),
    }),
    base("4512", {
      cashbox_id: "70",
      cashbox_type: "couriers",
      operation_type: "expense",
      source_type: "courier_payment",
      comment: "Kunlik topshiriq",
      payment_ack: "confirmed",
      correction: correction("original", "reverse", {
        id: "4530", source_type: "payment_reversal", role: "reversal", operation_type: "income", amount: 1_850_000,
      }),
    }),
  ];

  it("«#4512 qaytarildi» izoh (sabab) o'rnida, belgilar qatorida birinchi; tugma nomi maketdagidek", () => {
    renderWithProviders(<PaymentHistoryList data={courierRows} />, { preloadedState: asRole("superadmin") });
    const reversal = screen.getByRole("button", {
      name: "To'lovni qaytarish, Teskari yozuv, #4512 qaytarildi, Kirim +1 850 000 so'm, Bugun, 16:40",
    });
    expect(reversal).toHaveTextContent("Shodiyor Ergashev · Naqd");
    expect(reversal).toHaveTextContent("#4512 qaytarildi");
    expect(reversal).not.toHaveTextContent(REVERSE_REASON);
    expect(within(reversal).getByText("Teskari yozuv")).toHaveAttribute("data-payment-correction", "reversal");

    const original = screen.getByRole("button", {
      name: "Kuryer to'lovi, Qaytarildi, Chiqim −1 850 000 so'm, Bugun, 14:32, Kuryer tasdiqladi",
    });
    expect(original).toHaveTextContent("Kunlik topshiriq");
    const correctionBadge = within(original).getByText("Qaytarildi");
    expect(correctionBadge.parentElement?.firstElementChild).toBe(correctionBadge);
    expect(within(original).getByText("−1 850 000 so'm").className).toContain("text-danger-fg");
    expect(document.querySelector(".line-through")).toBeNull();
  });

  it("«Tuzatilgan»: «izoh · #4498 o'rniga» bo'linmaydi; correction kelmagan teskari yozuv — sabab emas, «#id qaytarildi»", () => {
    const rows: PaymentRow[] = [
      { ...mainRows[1], cashbox_id: "55", cashbox_type: "markets" },
      base("4535", {
        cashbox_id: "70",
        cashbox_type: "couriers",
        operation_type: "income",
        source_type: "payment_reversal",
        comment: REVERSE_REASON,
        createdAt: "2026-10-08T11:45:00.000Z",
        payment_date: undefined,
        reverses_history_id: "4513",
        // Backend `correction` qidiruvi yiqildi (fail-open).
        correction: null,
      }),
    ];
    renderWithProviders(<PaymentHistoryList data={rows} />, { preloadedState: asRole("superadmin") });
    const replacement = screen.getByRole("button", { name: /^Market to'lovi, Tuzatilgan, #4498 o'rniga, / });
    expect(replacement).toHaveTextContent("Oktabr, 1-hafta hisobi · #4498 o'rniga");
    expect(within(replacement).getByText("#4498 o'rniga")).toHaveClass("whitespace-nowrap");

    const failOpen = screen.getByRole("button", { name: /^To'lovni qaytarish, Teskari yozuv, #4513 qaytarildi, Kirim / });
    expect(failOpen).toHaveTextContent("#4513 qaytarildi");
    expect(failOpen).not.toHaveTextContent(REVERSE_REASON);
  });
});
