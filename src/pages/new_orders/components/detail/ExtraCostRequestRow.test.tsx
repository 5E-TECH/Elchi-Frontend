import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import { normalizeOrderDetail } from "./orderDetailModel";
import { PaymentCard } from "./PaymentCard";

/**
 * SPEC v2 — buyurtma tafsilotidagi «To'lov» kartasida «Qo'shimcha xarajat» qatori: summa, holat, qaysi mahsulot
 * uchun, kutilayotganda avtomatik tasdiq muddati, rad etilganda sababi. Manba — buyurtmaning `extra_cost_request`.
 */

const REQUEST = {
  id: "xc-1",
  status: "pending",
  mode: "deferred",
  action: "sell",
  amount: 20000,
  items: [
    { order_item_id: "i-1", product_id: "p-1", product_name: "Telefon g'ilofi", quantity: 1 },
    { order_item_id: "i-2", product_id: "p-2", product_name: "Zaryadka", quantity: 2 },
  ],
  auto_approve_at: "2026-11-13T09:00:00.000Z",
  created_at: "2026-11-12T09:00:00.000Z",
  decided_at: null,
  reject_reason: null,
  reject_reason_label: null,
};

const renderCard = (extraCostRequest: unknown) => {
  const order = normalizeOrderDetail({
    id: "o-1",
    status: "sold",
    total_price: 300000,
    to_be_paid: 300000,
    paid_amount: 0,
    ...(extraCostRequest === undefined ? {} : { extra_cost_request: extraCostRequest }),
  });
  if (!order) throw new Error("order");
  return renderWithProviders(<PaymentCard order={order} />);
};

const row = () => document.querySelector<HTMLElement>('[data-payment="extraCost"]');

describe("«To'lov» kartasi — «Qo'shimcha xarajat» qatori (SPEC v2)", () => {
  it("⭐ kutilayotgan: summa, «Tasdiq kutilmoqda», mahsulotlar, avtomatik tasdiq muddati", () => {
    renderCard(REQUEST);
    expect(row()).not.toBeNull();
    expect(row()).toHaveTextContent("Qo'shimcha xarajat");
    expect(row()).toHaveTextContent(/20\D000 so'm/);
    expect(row()?.querySelector('[data-extra-cost-status="pending"]')).toHaveTextContent(
      "Tasdiq kutilmoqda",
    );
    expect(row()).toHaveTextContent("Mahsulotlar: Telefon g'ilofi ×1, Zaryadka ×2");
    expect(row()).toHaveTextContent(/gacha javob bo'lmasa — avtomatik tasdiqlanadi/);
  });

  it("rad etilgan: «Rad etildi» va sabab; avtomatik tasdiq muddati yo'q", () => {
    renderCard({
      ...REQUEST,
      status: "rejected",
      reject_reason: "TOO_EXPENSIVE",
      decided_at: "2026-11-12T10:00:00.000Z",
    });
    expect(row()?.querySelector('[data-extra-cost-status="rejected"]')).toHaveTextContent(
      "Rad etildi",
    );
    expect(row()).toHaveTextContent("Sabab: Juda qimmat");
    expect(row()).not.toHaveTextContent(/avtomatik tasdiqlanadi/);
  });

  it("maydon yo'q yoki `null` — qator chizilmaydi, qolgan to'lov qatorlari joyida", () => {
    const { unmount } = renderCard(undefined);
    expect(row()).toBeNull();
    expect(document.querySelector('[data-payment="total"]')).not.toBeNull();
    unmount();

    renderCard(null);
    expect(row()).toBeNull();
    expect(screen.getByText("To'lov")).toBeInTheDocument();
  });
});
