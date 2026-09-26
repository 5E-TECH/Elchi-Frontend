import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import SellModal from "./SellModal";
import CancelModal from "./CancelModal";
import { renderWithProviders } from "../../../../../test/test-utils";
import {
  clearPendingExtraCostApproval,
  recordPendingExtraCostApproval,
} from "../../../../../entities/orders/extraCostApproval";

const order = {
  id: "o-1",
  created_at: "2026-09-25T08:00:00.000Z",
  status: "waiting",
  total_price: 120000,
  where_deliver: "center",
  product_quantity: 1,
  market: { name: "BeePost" },
  customer: { name: "Ali Valiyev", phone_number: "+998901234567" },
  district: { name: "Asaka" },
  region: { name: "Andijon" },
  items: [],
};

const renderSell = (props: Partial<Parameters<typeof SellModal>[0]> = {}) =>
  renderWithProviders(
    <SellModal order={order} open onClose={vi.fn()} onSell={vi.fn()} onPartlySell={vi.fn()} {...props} />,
  );

const renderCancel = (props: Partial<Parameters<typeof CancelModal>[0]> = {}) =>
  renderWithProviders(<CancelModal order={order} open onClose={vi.fn()} onCancel={vi.fn()} {...props} />);

const NOTICE = /market tasdig'idan o'tadi/;

describe("SellModal extra cost approval", () => {
  afterEach(() => clearPendingExtraCostApproval("o-1"));

  it("warns up front that an extra cost goes to the market for approval", async () => {
    const user = userEvent.setup();
    renderSell();

    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    await user.type(screen.getAllByPlaceholderText("0").at(-1)!, "5000");

    expect(screen.getByText(NOTICE)).toBeInTheDocument();
  });

  it("replaces the form with 'Market tasdig'i kutilmoqda' while approval is pending", () => {
    recordPendingExtraCostApproval({ orderId: "o-1", action: "sell", amount: 5000, requestedAt: new Date().toISOString(), orderStatus: "waiting" });
    renderSell({ awaitingApproval: true });

    expect(screen.getByRole("status")).toHaveTextContent("Market tasdig'i kutilmoqda");
    expect(screen.getByRole("status")).toHaveTextContent(/5\D?000 so'm qo'shimcha xarajat marketga tasdiqqa yuborildi/);
    expect(screen.queryByRole("button", { name: /^Sotish$/ })).not.toBeInTheDocument();
    expect(screen.getByText("Yopish", { selector: "button" })).toBeInTheDocument();
  });

  it("reminds about an earlier request but still lets the courier resubmit", () => {
    recordPendingExtraCostApproval({ orderId: "o-1", action: "sell", amount: 5000, requestedAt: new Date().toISOString(), orderStatus: "waiting" });
    renderSell();

    expect(screen.getByText(/qo'shimcha xarajat .* market tasdig'iga yuborilgan/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sotish/ })).toBeEnabled();
  });
});

describe("SellModal partial sell", () => {
  const singleUnitOrder = {
    ...order,
    product_quantity: 1,
    items: [{ id: "i1", quantity: 1, product: { id: "24", name: "product", image_url: null } }],
  };
  const twoUnitOrder = {
    ...order,
    product_quantity: 2,
    items: [{ id: "i1", quantity: 2, product: { id: "24", name: "Krossovka", image_url: null } }],
  };
  // Prod'dagi haqiqiy BeePost posilkasi #120 (kuryer ro'yxati qatori shakli):
  // katalogga bog'lanmagan — product ham, product_id ham null.
  const beePostMultiUnitOrder = {
    ...order,
    id: "120",
    product_quantity: 2,
    items: [{ id: "124", quantity: 2, product_id: null, product_name: "tv", product: null }],
  };
  // Prod admin ro'yxati qatori #1251132: katalogda bor, lekin `product`
  // obyekti kelmaydi — faqat product_id va product_name.
  const adminRowOrder = {
    ...order,
    id: "1251132",
    product_quantity: 3,
    items: [{ id: "1251136", quantity: 3, product_id: "8", product_name: "psarinorm" }],
  };
  const partialToggle = () => screen.getByRole("button", { name: /Qisman sotish/ });
  const sellButton = () => screen.getByRole("button", { name: /Sotish$|mahsulot sonini kamaytiring|summasini kiriting/ });

  it("blocks partial sell for a single-unit order and says why", () => {
    renderSell({ order: singleUnitOrder });

    expect(partialToggle()).toBeDisabled();
    expect(partialToggle()).toHaveTextContent("Buyurtmada bitta mahsulot — qisman sotib bo'lmaydi");
    // To'liq sotish ta'sirlanmaydi.
    expect(sellButton()).toBeEnabled();
  });

  it("allows partial sell for a multi-unit partner parcel without a catalog product and sends the order-item id (real BeePost #120)", async () => {
    const user = userEvent.setup();
    const onPartlySell = vi.fn();
    renderSell({ order: beePostMultiUnitOrder as never, onPartlySell });

    expect(partialToggle()).toBeEnabled();
    await user.click(partialToggle());
    await user.click(screen.getByRole("button", { name: "tv sonini kamaytirish" }));
    await user.type(screen.getAllByPlaceholderText("0")[0], "500000");
    await user.click(screen.getByRole("button", { name: /^Sotish$/ }));

    expect(onPartlySell).toHaveBeenCalledWith("120", expect.objectContaining({
      order_item_info: [{ order_item_id: "124", quantity: 1 }],
      totalPrice: 500000,
    }));
  });

  it("blocks partial sell with its own reason when the order has no product lines", () => {
    renderSell({ order: { ...order, product_quantity: 1, items: [] } });

    expect(partialToggle()).toBeDisabled();
    expect(partialToggle()).toHaveTextContent("Buyurtmada mahsulot qatorlari yo'q");
  });

  it("sends every line by its order-item id when a catalog line and a catalog-less one are mixed", async () => {
    const user = userEvent.setup();
    const onPartlySell = vi.fn();
    renderSell({
      order: {
        ...order,
        product_quantity: 3,
        items: [
          { id: "14", quantity: 2, product_id: "4", product: { id: "4", name: "Telefon", image_url: null } },
          { id: "15", quantity: 1, product_id: null, product_name: "tv", product: null },
        ],
      } as never,
      onPartlySell,
    });

    expect(partialToggle()).toBeEnabled();
    await user.click(partialToggle());
    await user.click(screen.getByRole("button", { name: "tv sonini kamaytirish" }));
    await user.type(screen.getAllByPlaceholderText("0")[0], "700000");
    await user.click(screen.getByRole("button", { name: /^Sotish$/ }));

    expect(onPartlySell).toHaveBeenCalledWith("o-1", expect.objectContaining({
      order_item_info: [
        { order_item_id: "14", product_id: "4", quantity: 2 },
        { order_item_id: "15", quantity: 0 },
      ],
    }));
  });

  it("does not treat two catalog-less lines as the same product", () => {
    renderSell({
      order: {
        ...order,
        product_quantity: 3,
        items: [
          { id: "31", quantity: 2, product_id: null, product_name: "kurtka", product: null },
          { id: "32", quantity: 1, product_id: null, product_name: "shim", product: null },
        ],
      } as never,
    });

    expect(partialToggle()).toBeEnabled();
  });

  it("blocks an order where the same catalog product sits on two lines", () => {
    renderSell({
      order: {
        ...order,
        product_quantity: 3,
        items: [
          { id: "a", quantity: 2, product_id: "8", product_name: "psarinorm" },
          { id: "b", quantity: 1, product_id: "8", product_name: "psarinorm" },
        ],
      } as never,
    });

    expect(partialToggle()).toBeDisabled();
    expect(partialToggle()).toHaveTextContent("Bir xil mahsulot bir necha qatorda");
  });

  it("names invalid (negative) quantities instead of claiming a single item", () => {
    renderSell({
      order: { ...order, product_quantity: -5, items: [{ id: "x", quantity: -5, product_id: "8" }] } as never,
    });

    expect(partialToggle()).toBeDisabled();
    expect(partialToggle()).toHaveTextContent("Mahsulot sonlari noto'g'ri");
  });

  it("keeps 'Sotish' disabled in partial mode until a quantity is actually reduced", async () => {
    const user = userEvent.setup();
    renderSell({ order: twoUnitOrder });

    await user.click(partialToggle());
    await user.type(screen.getAllByPlaceholderText("0")[0], "60000");

    expect(sellButton()).toBeDisabled();
    expect(sellButton()).toHaveTextContent("Kamida bitta mahsulot sonini kamaytiring");

    // Kamaytirib, keyin qaytarib oshirsa — yana bloklanadi.
    await user.click(screen.getByRole("button", { name: "Krossovka sonini kamaytirish" }));
    expect(sellButton()).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Krossovka sonini oshirish" }));
    expect(sellButton()).toBeDisabled();
  });

  it("keeps 'Sotish' disabled in partial mode while the payment amount is empty", async () => {
    const user = userEvent.setup();
    renderSell({ order: twoUnitOrder });

    await user.click(partialToggle());
    await user.click(screen.getByRole("button", { name: "Krossovka sonini kamaytirish" }));

    expect(sellButton()).toBeDisabled();
    expect(sellButton()).toHaveTextContent("To'lov summasini kiriting");
  });

  it("sends a valid partial sell for a two-unit order (regression)", async () => {
    const user = userEvent.setup();
    const onPartlySell = vi.fn();
    renderSell({ order: twoUnitOrder, onPartlySell });

    await user.click(partialToggle());
    await user.click(screen.getByRole("button", { name: "Krossovka sonini kamaytirish" }));
    await user.type(screen.getAllByPlaceholderText("0")[0], "60000");
    await user.click(screen.getByRole("button", { name: /^Sotish$/ }));

    expect(onPartlySell).toHaveBeenCalledWith("o-1", {
      order_item_info: [{ order_item_id: "i1", product_id: "24", quantity: 1 }],
      totalPrice: 60000,
      extraCost: 0,
      comment: "",
    });
  });

  it("sends the catalog product_id next to the order-item id when the row has no product object (admin list)", async () => {
    const user = userEvent.setup();
    const onPartlySell = vi.fn();
    renderSell({ order: adminRowOrder as never, onPartlySell });

    await user.click(partialToggle());
    // Nom `product_name` dan olinadi (ilgari bo'sh qolardi).
    expect(screen.getByText("psarinorm")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "psarinorm sonini kamaytirish" }));
    await user.type(screen.getAllByPlaceholderText("0")[0], "80000");
    await user.click(screen.getByRole("button", { name: /^Sotish$/ }));

    expect(onPartlySell).toHaveBeenCalledWith("1251132", expect.objectContaining({
      order_item_info: [{ order_item_id: "1251136", product_id: "8", quantity: 2 }],
      totalPrice: 80000,
    }));
  });

  it("lets one of two single-unit lines drop to zero while at least one unit stays", async () => {
    const user = userEvent.setup();
    const onPartlySell = vi.fn();
    renderSell({
      order: {
        ...order,
        product_quantity: 2,
        items: [
          { id: "i1", quantity: 1, product: { id: "24", name: "Krossovka", image_url: null } },
          { id: "i2", quantity: 1, product: { id: "25", name: "Futbolka", image_url: null } },
        ],
      },
      onPartlySell,
    });

    await user.click(partialToggle());
    await user.click(screen.getByRole("button", { name: "Krossovka sonini kamaytirish" }));
    // Bitta dona qolgani uchun ikkinchisini kamaytirib bo'lmaydi.
    expect(screen.getByRole("button", { name: "Futbolka sonini kamaytirish" })).toBeDisabled();
    await user.type(screen.getAllByPlaceholderText("0")[0], "30000");
    await user.click(screen.getByRole("button", { name: /^Sotish$/ }));

    expect(onPartlySell).toHaveBeenCalledWith("o-1", expect.objectContaining({
      order_item_info: [
        { order_item_id: "i1", product_id: "24", quantity: 0 },
        { order_item_id: "i2", product_id: "25", quantity: 1 },
      ],
    }));
  });
});

describe("CancelModal extra cost approval", () => {
  afterEach(() => clearPendingExtraCostApproval("o-1"));

  it("warns up front that an extra cost goes to the market for approval", async () => {
    const user = userEvent.setup();
    renderCancel();

    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    const [extraCostInput] = screen.getAllByRole("spinbutton");
    await user.clear(extraCostInput);
    await user.type(extraCostInput, "5000");

    expect(screen.getByText(NOTICE)).toBeInTheDocument();
  });

  it("replaces the form with 'Market tasdig'i kutilmoqda' while approval is pending", () => {
    recordPendingExtraCostApproval({ orderId: "o-1", action: "cancel", amount: 5000, requestedAt: new Date().toISOString(), orderStatus: "waiting" });
    renderCancel({ awaitingApproval: true });

    expect(screen.getByRole("status")).toHaveTextContent("Market tasdig'i kutilmoqda");
    expect(screen.queryByRole("button", { name: /Bekor qilish/ })).not.toBeInTheDocument();
    expect(screen.getByText("Yopish", { selector: "button" })).toBeInTheDocument();
  });
});
