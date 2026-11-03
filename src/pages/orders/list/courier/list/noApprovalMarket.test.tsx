import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SellModal from "./SellModal";
import CancelModal from "./CancelModal";
import { renderWithProviders } from "../../../../../test/test-utils";

/**
 * 2KisY7DL: tasdiqsiz marketda (`market.extra_cost_requires_approval: false`) menejer xarajati market tasdig'iga
 * bormaydi — kuryer chegarasida o'tadi (backend 04e1ad9). Shuning uchun menejerga «market tasdig'idan o'tadi»
 * eslatmasi chiqmaydi, uyga yetkazishda kuryerdagi izoh chiqadi; rad javobi (400) oyna ichida ko'rinadi.
 */

const HINT = "Kiritilsa, market tasdig'idan o'tadi";
const NOTICE = /market tasdig'idan o'tadi/;
const HOME_NOTE = "Uyga yetkazishda qo'shimcha xarajat yozilmaydi — uy tarifi allaqachon yuqori.";

const order = (extraCostRequiresApproval?: boolean | null, whereDeliver = "center") => ({
  id: "10293",
  status: "waiting",
  total_price: 96000,
  where_deliver: whereDeliver,
  market: { name: "Chilonzor Market", extra_cost_requires_approval: extraCostRequiresApproval },
  customer: { name: "Sevara Tursunova", phone_number: "+998905621407" },
  district: { name: "Jomboy tumani" },
  items: [],
});

const renderSell = (props: Partial<Parameters<typeof SellModal>[0]> = {}) =>
  renderWithProviders(
    <SellModal
      order={order(false)}
      open
      variant="manager"
      onClose={vi.fn()}
      onSell={vi.fn()}
      onPartlySell={vi.fn()}
      {...props}
    />,
  );

const renderCancel = (props: Partial<Parameters<typeof CancelModal>[0]> = {}) =>
  renderWithProviders(
    <CancelModal
      order={order(false)}
      open
      variant="manager"
      onClose={vi.fn()}
      onCancel={vi.fn()}
      {...props}
    />,
  );

const extraCostInput = () => screen.queryByRole("textbox", { name: "Qo'shimcha xarajat" });

describe("Sotish oynasi — tasdiqsiz market, menejer (2KisY7DL)", () => {
  it("eslatma ham, xarajat yozilgach ogohlantirish ham yo'q; xarajat so'rovga ketadi", async () => {
    const user = userEvent.setup();
    const onSell = vi.fn();
    renderSell({ onSell });

    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
    await user.type(extraCostInput()!, "20000");
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sotish" }));
    expect(onSell).toHaveBeenCalledWith("10293", expect.objectContaining({ extraCost: 20000 }));
  });

  it("uyga yetkazishda — kuryerdagi izoh, xarajat maydoni yo'q, so'rovda extraCost: 0", async () => {
    const user = userEvent.setup();
    const onSell = vi.fn();
    renderSell({ onSell, order: order(false, "address") });

    expect(screen.getByRole("note")).toHaveTextContent(HOME_NOTE);
    expect(extraCostInput()).not.toBeInTheDocument();
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sotish" }));
    expect(onSell).toHaveBeenCalledWith("10293", expect.objectContaining({ extraCost: 0 }));
  });

  it.each([
    ["tasdiqli market (true)", true],
    ["maydon kelmagan", undefined],
    ["maydon null", null],
  ])(
    "%s — avvalgidek: eslatma, xarajat yozilgach ogohlantirish, uyga yetkazishda maydon bor",
    async (_label, flag) => {
      const user = userEvent.setup();
      const { unmount } = renderSell({ order: order(flag) });

      expect(screen.getByText(HINT)).toBeInTheDocument();
      await user.type(extraCostInput()!, "20000");
      expect(screen.queryByText(HINT)).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(NOTICE);
      unmount();

      renderSell({ order: order(flag, "address") });
      expect(extraCostInput()).toBeInTheDocument();
      expect(screen.queryByText(HOME_NOTE)).not.toBeInTheDocument();
    },
  );

  it("kuryer oynasiga ta'sir qilmaydi — bayroq false bo'lsa ham ogohlantirish avvalgidek", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SellModal
        order={order(false)}
        open
        onClose={vi.fn()}
        onSell={vi.fn()}
        onPartlySell={vi.fn()}
      />,
    );

    await user.type(extraCostInput()!, "5000");
    expect(screen.getByText(NOTICE)).toBeInTheDocument();
  });
});

describe("Bekor qilish oynasi — tasdiqsiz market, menejer (2KisY7DL)", () => {
  it("xarajat yozilsa ham «market tasdig'idan o'tadi» chiqmaydi; tasdiqli marketda chiqadi", async () => {
    const user = userEvent.setup();
    const { unmount } = renderCancel();

    await user.type(extraCostInput()!, "20000");
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    unmount();

    renderCancel({ order: order(true) });
    await user.type(extraCostInput()!, "20000");
    expect(screen.getByText(NOTICE)).toBeInTheDocument();
  });

  it("kuryer oynasida bayroq false bo'lsa ham ogohlantirish avvalgidek", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CancelModal order={order(false)} open onClose={vi.fn()} onCancel={vi.fn()} />,
    );

    await user.type(extraCostInput()!, "5000");
    expect(screen.getByText(NOTICE)).toBeInTheDocument();
  });
});

describe("Amal oynasi — rad javobi oyna ichida (2KisY7DL)", () => {
  const REASON = "Qo'shimcha xarajat maksimal 30 000 so'm bo'lishi mumkin";

  it.each([
    ["sotish", () => renderSell({ error: REASON }), "Buyurtmani sotish"],
    ["bekor qilish", () => renderCancel({ error: REASON }), "Buyurtmani bekor qilish"],
  ])("%s: `error` — oyna ichida «alert», forma joyida", (_label, render, title) => {
    render();
    const dialog = screen.getByRole("dialog", { name: title });
    expect(within(dialog).getByRole("alert")).toHaveTextContent(REASON);
    expect(within(dialog).getByRole("textbox", { name: "Qo'shimcha xarajat" })).toBeInTheDocument();
  });

  it("xato yo'q — «alert» yo'q", () => {
    renderSell();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
