import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SellModal from "./SellModal";
import { renderWithProviders } from "../../../../../test/test-utils";

/**
 * lQjt6sKP — almashtirish buyurtmasini sotish darvozasi («Eski mahsulotni oldim»). Backend usiz 400 qaytaradi:
 * «Avval eski mahsulotni mijozdan olganingizni tasdiqlang …». Shart: `replacement_of_order_id` bor va holat
 * `old_collected` / `old_returned` emas. Tana maydoni — aynan `oldItemCollected` (gateway DTO).
 */

const order = {
  id: "120",
  created_at: "2026-11-04T08:00:00.000Z",
  status: "waiting",
  total_price: 150000,
  where_deliver: "center",
  product_quantity: 2,
  market: { name: "Baraka Shop" },
  customer: { name: "Ali Valiyev", phone_number: "+998901234567" },
  district: { name: "Asaka" },
  region: { name: "Andijon" },
  items: [{ id: "i1", quantity: 2, product: { id: "24", name: "Krossovka", image_url: null } }],
};

const replacementOrder = { ...order, replacement_of_order_id: "81", replacement_state: "awaiting_old_pickup" };

const NOTICE = "Almashtirish: mijozdan eski mahsulotni qaytarib oling — №EL-100081";
const CONFIRM = "Eski mahsulotni oldim";
const REQUIRED = "«Eski mahsulotni oldim» belgilanmaguncha sotib bo'lmaydi";

const renderSell = (props: Partial<Parameters<typeof SellModal>[0]> = {}) => {
  const onSell = vi.fn();
  const onPartlySell = vi.fn();
  renderWithProviders(
    <SellModal
      order={replacementOrder}
      open
      onClose={vi.fn()}
      onSell={onSell}
      onPartlySell={onPartlySell}
      {...props}
    />,
  );
  return { user: userEvent.setup(), onSell, onPartlySell };
};

const submit = () => screen.getByRole("button", { name: /^Sotish$/ });
const confirmBox = () => screen.getByRole("checkbox", { name: CONFIRM });

describe("SellModal — almashtirish: «Eski mahsulotni oldim» darvozasi (lQjt6sKP)", () => {
  it("⭐ ogohlantirish (eski №EL-…) va majburiy belgi; belgilanmaguncha «Sotish» o'chiq, sababi yonida", async () => {
    const { user, onSell } = renderSell();
    const gate = screen.getByTestId("sell-replacement-gate");
    expect(within(gate).getByText(NOTICE)).toBeInTheDocument();
    expect(confirmBox()).not.toBeChecked();
    expect(submit()).toBeDisabled();
    expect(screen.getByText(REQUIRED)).toBeInTheDocument();

    await user.click(submit());
    expect(onSell).not.toHaveBeenCalled();
  });

  it("⭐ belgilangach — to'liq sotish `oldItemCollected: true` bilan", async () => {
    const { user, onSell } = renderSell();
    await user.click(confirmBox());
    expect(screen.queryByText(REQUIRED)).toBeNull();
    expect(submit()).toBeEnabled();

    await user.click(submit());
    expect(onSell).toHaveBeenCalledWith("120", { comment: "", extraCost: 0, oldItemCollected: true });
  });

  it("belgini qayta olib tashlasa — yana o'chiq", async () => {
    const { user } = renderSell();
    await user.click(confirmBox());
    await user.click(confirmBox());
    expect(submit()).toBeDisabled();
  });

  it("qisman sotishda ham darvoza bor va `oldItemCollected: true` yuboriladi", async () => {
    const { user, onPartlySell } = renderSell();
    await user.click(screen.getByRole("switch", { name: /Qisman sotish/ }));
    await user.click(screen.getByRole("button", { name: "Krossovka sonini kamaytirish" }));
    await user.type(screen.getAllByPlaceholderText("0")[0], "90000");
    expect(submit()).toBeDisabled();

    await user.click(confirmBox());
    await user.click(submit());
    expect(onPartlySell).toHaveBeenCalledWith(
      "120",
      expect.objectContaining({ totalPrice: 90000, oldItemCollected: true }),
    );
  });

  it("menejer oynasida (tafsilot, skan, /orders) ham xuddi shu darvoza", async () => {
    const { user, onSell } = renderSell({ variant: "manager" });
    expect(screen.getByText(NOTICE)).toBeInTheDocument();
    expect(submit()).toBeDisabled();
    await user.click(confirmBox());
    await user.click(submit());
    expect(onSell).toHaveBeenCalledWith("120", { comment: "", extraCost: 0, oldItemCollected: true });
  });

  it("eski mahsulot allaqachon olingan (qaytarilgan sotuvni qayta sotish) — belgisiz, faqat ma'lumot; bayroq yuborilmaydi", async () => {
    const { user, onSell } = renderSell({
      order: {
        ...replacementOrder,
        replacement_state: "old_collected",
        old_item_collected_at: "2026-11-01T09:30:00.000Z",
      },
    });
    expect(screen.queryByTestId("sell-replacement-gate")).toBeNull();
    expect(screen.queryByRole("checkbox", { name: CONFIRM })).toBeNull();
    expect(screen.getByTestId("sell-replacement-collected")).toHaveTextContent(/Almashtirish: eski mahsulot olingan \(.+\)/);

    await user.click(submit());
    expect(onSell).toHaveBeenCalledWith("120", { comment: "", extraCost: 0 });
  });

  it("oddiy buyurtma — darvoza yo'q, tana o'zgarmagan", async () => {
    const { user, onSell } = renderSell({ order });
    expect(screen.queryByTestId("sell-replacement-gate")).toBeNull();
    expect(screen.queryByTestId("sell-replacement-collected")).toBeNull();
    await user.click(submit());
    expect(onSell).toHaveBeenCalledWith("120", { comment: "", extraCost: 0 });
  });

  it("backend rad etsa — sabab oyna ichida (2KisY7DL `error`)", () => {
    const message =
      "Bu almashtirish buyurtmasi (eski #81 o'rniga). Avval eski mahsulotni mijozdan olganingizni tasdiqlang";
    renderSell({ variant: "manager", error: message });
    expect(screen.getByRole("alert")).toHaveTextContent(message);
  });
});
