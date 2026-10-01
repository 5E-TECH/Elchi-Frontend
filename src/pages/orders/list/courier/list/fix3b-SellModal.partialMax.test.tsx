import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SellModal from "./SellModal";
import { renderWithProviders } from "../../../../../test/test-utils";

/**
 * fix3b M10 — qisman sotuv summasi buyurtma summasidan oshmasligi kerak
 * (backend ham 400 qaytaradi). Xato (masalan ortiqcha nol) market va kuryer
 * kassasini oshirib, rollbackda asl summani yo'qotardi.
 */

const order = {
  id: "o-10",
  created_at: "2026-10-01T08:00:00.000Z",
  status: "waiting",
  total_price: 150000,
  where_deliver: "center",
  product_quantity: 2,
  market: { name: "Yandex" },
  customer: { name: "Ali Valiyev", phone_number: "+998901234567" },
  district: { name: "Guliston" },
  region: { name: "Sirdaryo" },
  items: [{ id: "i1", quantity: 2, product: { id: "24", name: "Krossovka", image_url: null } }],
};

const EXCEEDS = "Qisman sotuv summasi buyurtma summasidan oshmasligi kerak";

const setup = async (amount: string, overrides: Partial<typeof order> = {}) => {
  const user = userEvent.setup();
  const onPartlySell = vi.fn();
  renderWithProviders(
    <SellModal
      order={{ ...order, ...overrides }}
      open
      onClose={vi.fn()}
      onSell={vi.fn()}
      onPartlySell={onPartlySell}
    />,
  );
  await user.click(screen.getByRole("button", { name: /Qisman sotish/ }));
  await user.click(screen.getByRole("button", { name: "Krossovka sonini kamaytirish" }));
  await user.type(screen.getAllByPlaceholderText("0")[0], amount);
  return { user, onPartlySell };
};

describe("SellModal — qisman sotuv summasi chegarasi (fix3b M10)", () => {
  it("buyurtma summasidan katta summani yubormaydi va sababini ko'rsatadi", async () => {
    const { user, onPartlySell } = await setup("1500000");

    expect(screen.getByRole("alert")).toHaveTextContent(EXCEEDS);
    const submit = screen.getByRole("button", { name: EXCEEDS });
    expect(submit).toBeDisabled();

    await user.click(submit);
    expect(onPartlySell).not.toHaveBeenCalled();
  });

  it("buyurtma summasiga teng summa ruxsat etiladi", async () => {
    const { user, onPartlySell } = await setup("150000");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Sotish$/ }));

    expect(onPartlySell).toHaveBeenCalledWith("o-10", expect.objectContaining({ totalPrice: 150000 }));
  });

  it("kichik summa avvalgidek yuboriladi", async () => {
    const { user, onPartlySell } = await setup("90000");

    await user.click(screen.getByRole("button", { name: /^Sotish$/ }));
    expect(onPartlySell).toHaveBeenCalledWith("o-10", expect.objectContaining({ totalPrice: 90000 }));
  });

  it("summani tuzatsa — blok yo'qoladi", async () => {
    const { user, onPartlySell } = await setup("1500000");
    const input = screen.getAllByPlaceholderText("0")[0];

    await user.clear(input);
    await user.type(input, "15000");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Sotish$/ }));
    expect(onPartlySell).toHaveBeenCalledWith("o-10", expect.objectContaining({ totalPrice: 15000 }));
  });

  it("to'liq sotish ta'sirlanmaydi", async () => {
    const user = userEvent.setup();
    const onSell = vi.fn();
    renderWithProviders(
      <SellModal order={order} open onClose={vi.fn()} onSell={onSell} onPartlySell={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /^Sotish$/ }));
    expect(onSell).toHaveBeenCalledWith("o-10", expect.objectContaining({ extraCost: 0 }));
  });
});
