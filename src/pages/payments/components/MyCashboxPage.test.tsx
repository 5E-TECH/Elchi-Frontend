import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MyCashboxPage from "./MyCashboxPage";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * 2crjWf7v — kuryerning `/cash-box` sahifasi: `GET finance/cashbox/my-cashbox` javobidagi
 * `payment_ack` qatorga o'tadi va tarixda «Noto'g'ri» / «Tasdiqlangan» belgisi chiqadi.
 */

const myCashbox = vi.hoisted(() => ({
  history: [] as Record<string, unknown>[],
}));

vi.mock("../../../entities/payments", () => ({
  useCashBox: () => ({
    useGetCashboxMyCashbox: () => ({
      data: {
        data: {
          cashbox: { id: "70", cashbox_type: "couriers", balance: 640000, user: { name: "Jasur Tursunov" } },
          cashboxHistory: myCashbox.history,
        },
      },
      isLoading: false,
    }),
  }),
}));
// Tafsilot oynasi o'z so'rovini yuboradi — bu testga aloqasi yo'q.
vi.mock("./FinanceHistoryDetailPopup", () => ({ default: () => null }));

const courier = { role: { id: "263", role: "courier", region: null, name: "Kuryer" } } as never;

const courierPayment = (id: string, minute: string, extra: Record<string, unknown>) => ({
  id,
  amount: -1650000,
  operation_type: "expense",
  source_type: "courier_payment",
  payment_method: "cash",
  cashbox_type: "couriers",
  createdByUser: { name: `Menejer ${id}` },
  createdAt: `2026-10-17T09:${minute}:00.000Z`,
  ...extra,
});

describe("MyCashboxPage — courier receipt answer (2crjWf7v)", () => {
  it("carries payment_ack from the my-cashbox history into the rows", () => {
    myCashbox.history = [
      courierPayment("11", "10", { payment_ack: "disputed" }),
      courierPayment("12", "20", { payment_ack: "confirmed" }),
      courierPayment("13", "30", { payment_ack: null }),
      { id: "14", amount: 420000, operation_type: "income", source_type: "sell", cashbox_type: "couriers", createdAt: "2026-10-17T09:40:00.000Z" },
    ];

    renderWithProviders(<MyCashboxPage />, { route: "/cash-box", preloadedState: courier });

    const rows = screen.getAllByRole("button", { name: /Menejer 1[123] → Jasur Tursunov/ });
    expect(rows).toHaveLength(3);
    const [unanswered, confirmed, disputed] = rows; // yangisi tepada

    expect(within(disputed).getByText("Noto'g'ri")).toHaveAttribute("data-payment-ack", "disputed");
    expect(within(confirmed).getByText("Tasdiqlangan")).toHaveAttribute("data-payment-ack", "confirmed");
    expect(unanswered.querySelector("[data-payment-ack]")).toBeNull();
    expect(document.querySelectorAll("[data-payment-ack]")).toHaveLength(2);
  });
});
