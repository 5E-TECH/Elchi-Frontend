import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import PaymentHistoryList from "./PaymentHistoryList";
import type { PaymentRow } from "./patmentHistoryTable";
import { toPaymentAck } from "./paymentAck";

/**
 * 2crjWf7v — kuryer kassasi tarixida kuryerning bot kvitansiyasiga javobi:
 * `disputed` → «Noto'g'ri» (danger), `confirmed` → «Tasdiqlangan» (success),
 * `null` / maydon yo'q → belgi yo'q. Qator belgilari guruhi dizayn v2 da.
 */

// Tafsilot oynasi o'z so'rovini yuboradi — bu testga aloqasi yo'q.
vi.mock("./FinanceHistoryDetailPopup", () => ({ default: () => null }));

const row = (id: string, overrides: Partial<PaymentRow> = {}): PaymentRow => ({
  id,
  amount: -150000,
  operation_type: "expense",
  source_type: "courier_payment",
  payment_method: "cash",
  created_by: `Menejer ${id}`,
  payment_date: "2026-10-17T09:10:00.000Z",
  ...overrides,
});

const rowButton = (name: string) => screen.getByRole("button", { name: new RegExp(name) });

describe("toPaymentAck", () => {
  it("keeps confirmed / disputed, maps null and unknown values to null, absent to undefined", () => {
    expect(toPaymentAck("confirmed")).toBe("confirmed");
    expect(toPaymentAck("disputed")).toBe("disputed");
    expect(toPaymentAck(null)).toBeNull();
    expect(toPaymentAck("something_new")).toBeNull();
    expect(toPaymentAck(undefined)).toBeUndefined();
  });
});

describe("PaymentHistoryList — courier receipt answer badge (2crjWf7v)", () => {
  it("shows «Noto'g'ri» (danger, with icon) for a disputed courier payment", () => {
    renderWithProviders(<PaymentHistoryList data={[row("1", { payment_ack: "disputed" })]} />);

    const badge = within(rowButton("Menejer 1")).getByText("Noto'g'ri");
    expect(badge).toHaveAttribute("data-payment-ack", "disputed");
    expect(badge).toHaveClass("bg-danger-soft", "text-danger-fg");
    expect(badge.querySelector("svg")).not.toBeNull();
    expect(badge).toHaveAttribute("title", "Kuryer botdagi kvitansiyaga «Noto'g'ri» deb javob berdi");
    expect(screen.queryByText("Tasdiqlangan")).not.toBeInTheDocument();
  });

  it("shows «Tasdiqlangan» (success) for a confirmed courier payment", () => {
    renderWithProviders(<PaymentHistoryList data={[row("2", { payment_ack: "confirmed" })]} />);

    const badge = within(rowButton("Menejer 2")).getByText("Tasdiqlangan");
    expect(badge).toHaveAttribute("data-payment-ack", "confirmed");
    expect(badge).toHaveClass("bg-success-soft", "text-success-fg");
    expect(screen.queryByText("Noto'g'ri")).not.toBeInTheDocument();
  });

  it("shows no receipt badge when the courier has not answered (null) or the row has no field", () => {
    renderWithProviders(
      <PaymentHistoryList
        data={[
          row("3", { payment_ack: null }),
          row("4", { source_type: "sell", operation_type: "income", amount: 90000 }),
        ]}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(document.querySelector("[data-payment-ack]")).toBeNull();
    expect(screen.queryByText("Noto'g'ri")).not.toBeInTheDocument();
    expect(screen.queryByText("Tasdiqlangan")).not.toBeInTheDocument();
  });

  it("marks each row independently", () => {
    renderWithProviders(
      <PaymentHistoryList
        data={[
          row("5", { payment_ack: "disputed" }),
          row("6", { payment_ack: "confirmed" }),
          row("7", { payment_ack: null }),
        ]}
      />,
    );

    expect(within(rowButton("Menejer 5")).getByText("Noto'g'ri")).toBeInTheDocument();
    expect(within(rowButton("Menejer 6")).getByText("Tasdiqlangan")).toBeInTheDocument();
    expect(rowButton("Menejer 7").querySelector("[data-payment-ack]")).toBeNull();
  });
});

describe("PaymentHistoryList — v2 badge group", () => {
  it("labels a [ROLLBACK] entry «Tuzatish» (outline) instead of the English «ROLLBACK» and hides the token", () => {
    renderWithProviders(
      <PaymentHistoryList data={[row("8", { comment: "[ROLLBACK] Buyurtma qaytarildi" })]} />,
    );

    const button = rowButton("Menejer 8");
    expect(within(button).getByText("Tuzatish")).toHaveClass("ring-1", "ring-inset");
    expect(within(button).queryByText("ROLLBACK")).not.toBeInTheDocument();
    expect(within(button).getByText("Buyurtma qaytarildi")).toBeInTheDocument();
  });

  it("renders payment method and «Kirim»/«Chiqim» as neutral v2 badges (colour stays on the amount)", () => {
    renderWithProviders(
      <PaymentHistoryList
        data={[
          row("9"),
          row("10", { operation_type: "income", amount: 120000, source_type: "sell" }),
        ]}
      />,
    );

    const expense = within(rowButton("Menejer 9")).getByText("Chiqim");
    const income = within(rowButton("Menejer 10")).getByText("Kirim");
    for (const badge of [expense, income]) {
      expect(badge).toHaveClass("bg-sunken", "text-text-muted", "text-xs");
    }
    expect(within(rowButton("Menejer 9")).getByText("Naqd")).toHaveClass("bg-sunken", "text-text-muted");
  });
});
