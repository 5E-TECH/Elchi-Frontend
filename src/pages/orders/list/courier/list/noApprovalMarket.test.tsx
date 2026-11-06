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
 * QoYyRl6S: kuryerda ham xuddi shunday (backend tasdiqsiz marketda xarajatni darhol yozadi); market xarajatni yopgan
 * bo'lsa (`extra_cost_enabled: false`) maydon o'rnida kulrang izoh, so'rovda `extraCost: 0`.
 */

const HINT = "Kiritilsa, market tasdig'idan o'tadi";
const NOTICE = /market tasdig'idan o'tadi/;
const HOME_NOTE = "Uyga yetkazishda qo'shimcha xarajat yozilmaydi — uy tarifi allaqachon yuqori.";
const DISABLED_NOTE = "Bu market uchun qo'shimcha xarajat yozilmaydi.";

const order = (
  extraCostRequiresApproval?: boolean | null,
  whereDeliver = "center",
  extraCostEnabled?: boolean | null,
) => ({
  id: "10293",
  status: "waiting",
  total_price: 96000,
  where_deliver: whereDeliver,
  market: {
    name: "Chilonzor Market",
    extra_cost_requires_approval: extraCostRequiresApproval,
    ...(extraCostEnabled === undefined ? {} : { extra_cost_enabled: extraCostEnabled }),
  },
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

});

describe("Sotish oynasi — kuryer, market tasdig'i yozuvi (QoYyRl6S)", () => {
  const renderCourierSell = (props: Partial<Parameters<typeof SellModal>[0]> = {}) =>
    renderWithProviders(
      <SellModal
        order={order(false)}
        open
        onClose={vi.fn()}
        onSell={vi.fn()}
        onPartlySell={vi.fn()}
        restrictExtraCostToCenter
        {...props}
      />,
    );

  it("⭐ tasdiqsiz market: 10 000 yozilsa ham «market tasdig'idan o'tadi» yo'q; xarajat so'rovga ketadi", async () => {
    const user = userEvent.setup();
    const onSell = vi.fn();
    renderCourierSell({ onSell });

    await user.type(extraCostInput()!, "10000");
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sotish" }));
    expect(onSell).toHaveBeenCalledWith("10293", expect.objectContaining({ extraCost: 10000 }));
  });

  it.each([
    ["tasdiqli market (true)", true],
    ["maydon kelmagan", undefined],
    ["maydon null", null],
  ])("%s — xarajat yozilgach «market tasdig'idan o'tadi» ogohlantirishi bor", async (_label, flag) => {
    const user = userEvent.setup();
    renderCourierSell({ order: order(flag) });

    await user.type(extraCostInput()!, "5000");
    expect(screen.getByRole("status")).toHaveTextContent(NOTICE);
  });

  it("uyga yetkazish qoidasi o'zgarmagan: tasdiqli va tasdiqsiz marketda ham — izoh, maydon yo'q, extraCost: 0", async () => {
    const user = userEvent.setup();
    for (const flag of [true, false]) {
      const onSell = vi.fn();
      const { unmount } = renderCourierSell({ onSell, order: order(flag, "address") });
      expect(screen.getByRole("note")).toHaveTextContent(HOME_NOTE);
      expect(extraCostInput()).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Sotish" }));
      expect(onSell).toHaveBeenCalledWith("10293", expect.objectContaining({ extraCost: 0 }));
      unmount();
    }
  });
});

describe("Xarajat yopiq market (`extra_cost_enabled: false`, QoYyRl6S)", () => {
  it.each([
    ["kuryer", undefined],
    ["menejer", "manager" as const],
  ])("sotish (%s): maydon yo'q, kulrang izoh; so'rovda extraCost: 0", async (_label, variant) => {
    const user = userEvent.setup();
    const onSell = vi.fn();
    renderWithProviders(
      <SellModal
        order={order(true, "center", false)}
        open
        variant={variant}
        onClose={vi.fn()}
        onSell={onSell}
        onPartlySell={vi.fn()}
        restrictExtraCostToCenter={variant === undefined}
      />,
    );

    expect(extraCostInput()).not.toBeInTheDocument();
    expect(screen.getByRole("note", { name: "Qo'shimcha xarajat" })).toHaveTextContent(DISABLED_NOTE);
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sotish" }));
    expect(onSell).toHaveBeenCalledWith("10293", expect.objectContaining({ extraCost: 0 }));
  });

  it("uyga yetkazishda ham — yopiq market izohi (uy izohi emas)", () => {
    renderSell({ order: order(false, "address", false) });
    expect(screen.getByRole("note", { name: "Qo'shimcha xarajat" })).toHaveTextContent(DISABLED_NOTE);
    expect(screen.queryByText(HOME_NOTE)).not.toBeInTheDocument();
  });

  it.each([
    ["kuryer", undefined],
    ["menejer", "manager" as const],
  ])("bekor qilish (%s): maydon yo'q, kulrang izoh; so'rovda extraCost: 0", async (_label, variant) => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderWithProviders(
      <CancelModal order={order(true, "center", false)} open variant={variant} onClose={vi.fn()} onCancel={onCancel} />,
    );

    expect(extraCostInput()).not.toBeInTheDocument();
    expect(screen.getByRole("note", { name: "Qo'shimcha xarajat" })).toHaveTextContent(DISABLED_NOTE);

    await user.click(screen.getByRole("combobox", { name: /^Sabab/ }));
    await user.click(await screen.findByRole("option", { name: "Mijoz rad etdi" }));
    await user.click(screen.getAllByRole("button", { name: /^Bekor qilish$/ }).at(-1)!);
    expect(onCancel).toHaveBeenCalledWith("10293", { reason: "CUSTOMER_REFUSED", comment: "", extraCost: 0 });
  });

  it.each([
    ["true", true],
    ["maydon kelmagan", undefined],
    ["null", null],
  ])("bayroq %s — maydon avvalgidek", (_label, flag) => {
    const { unmount } = renderSell({ order: order(true, "center", flag) });
    expect(extraCostInput()).toBeInTheDocument();
    unmount();
    renderCancel({ order: order(true, "center", flag) });
    expect(extraCostInput()).toBeInTheDocument();
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

  it("⭐ kuryer oynasi ham (QoYyRl6S): tasdiqsiz marketda ogohlantirish yo'q, tasdiqli marketda bor", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(
      <CancelModal order={order(false)} open onClose={vi.fn()} onCancel={vi.fn()} />,
    );

    await user.type(extraCostInput()!, "5000");
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    unmount();

    renderWithProviders(<CancelModal order={order(true)} open onClose={vi.fn()} onCancel={vi.fn()} />);
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

  it("sabab chiqqanda va o'zgarganda ko'rinishga suriladi (telefonda uzun pastki varaqa)", () => {
    const scrollIntoView = vi.fn();
    const original = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: scrollIntoView,
    });
    try {
      const { rerender } = renderSell({ error: REASON });
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView).toHaveBeenLastCalledWith({ block: "nearest" });
      expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByRole("alert"));

      rerender(
        <SellModal
          order={order(false)}
          open
          variant="manager"
          onClose={vi.fn()}
          onSell={vi.fn()}
          onPartlySell={vi.fn()}
          error="Boshqa sabab"
        />,
      );
      expect(scrollIntoView).toHaveBeenCalledTimes(2);
    } finally {
      if (original) Object.defineProperty(Element.prototype, "scrollIntoView", original);
      else Reflect.deleteProperty(Element.prototype, "scrollIntoView");
    }
  });
});
