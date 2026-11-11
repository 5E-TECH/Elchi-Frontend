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

// SPEC v2: amal darhol bajariladi, xarajat alohida market tasdig'ini kutadi (avvalgi «market tasdig'idan o'tadi» o'rniga).
const NOTICE = /Qo'shimcha xarajat alohida — market tasdig'ini kutadi/;

type User = ReturnType<typeof userEvent.setup>;

/** Sabab — `Select` (combobox + listbox): ochib, variantni bosish. */
const reasonBox = () => screen.getByRole("combobox", { name: /^Sabab/ });
const chooseReason = async (user: User, label: string) => {
  await user.click(reasonBox());
  await user.click(await screen.findByRole("option", { name: label }));
};

/** Oyna pastidagi «Yopish» (sarlavhadagi × ham «Yopish» — oxirgisi pastdagi tugma). */
const footerCloseButton = () => screen.getAllByRole("button", { name: "Yopish" }).at(-1)!;

describe("SellModal — «Marketga to'langan summa» maydoni yo'q (ega 2026-11-07)", () => {
  it("kuryer: maydon yo'q; to'liq sotishda `paidAmount` yuborilmaydi", async () => {
    const user = userEvent.setup();
    const onSell = vi.fn();
    renderSell({ onSell, order: { ...order, to_be_paid: 120000, sale_market_paid_max: 30000 } as never });
    expect(screen.queryByLabelText("Marketga to'langan summa")).toBeNull();
    expect(screen.queryByText(/Mijozdan olingan puldan marketga o'zingiz bergan qism/)).toBeNull();
    expect(screen.queryByText(/so'mdan oshmasin/)).toBeNull();

    await user.click(screen.getByRole("button", { name: /^Sotish$/ }));
    expect(onSell).toHaveBeenCalledWith("o-1", { comment: "", extraCost: 0 });
    expect(onSell.mock.calls[0][1]).not.toHaveProperty("paidAmount");
  });

  it("menejer: maydon yo'q; to'liq sotishda `paidAmount` yuborilmaydi", async () => {
    const user = userEvent.setup();
    const onSell = vi.fn();
    renderSell({ onSell, variant: "manager", order: { ...order, to_be_paid: 120000, sale_market_paid_max: 30000 } as never });
    expect(screen.queryByLabelText("Marketga to'langan summa")).toBeNull();
    expect(screen.getByLabelText("Qo'shimcha xarajat")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Sotish$/ }));
    expect(onSell).toHaveBeenCalledWith("o-1", { comment: "", extraCost: 0 });
    expect(onSell.mock.calls[0][1]).not.toHaveProperty("paidAmount");
  });
});

describe("SellModal extra cost approval", () => {
  afterEach(() => clearPendingExtraCostApproval("o-1"));

  it("warns up front that an extra cost goes to the market for approval", async () => {
    const user = userEvent.setup();
    renderSell();

    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Qo'shimcha xarajat"), "5000");

    expect(screen.getByText(NOTICE)).toBeInTheDocument();
    // SPEC v2: buyurtma darhol sotiladi, naqd to'liq topshiriladi; eski «holat o'zgarmaydi» matni yo'q.
    expect(screen.getByText(NOTICE)).toHaveTextContent(/^Buyurtma darhol sotiladi\./);
    expect(screen.getByText(NOTICE)).toHaveTextContent(/Naqdni to'liq topshiring/);
    expect(screen.queryByText(/market tasdiqlamaguncha/)).not.toBeInTheDocument();
  });

  it("replaces the form with 'Market tasdig'i kutilmoqda' while approval is pending", () => {
    recordPendingExtraCostApproval({ orderId: "o-1", action: "sell", amount: 5000, requestedAt: new Date().toISOString(), orderStatus: "waiting" });
    renderSell({ awaitingApproval: true });

    // Maket `courier-orders-action-approval-pending`: oyna sarlavhasi almashadi, tanada blok + `dl`.
    expect(screen.getByRole("dialog", { name: "Market tasdig'i kutilmoqda" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Market tasdig'i kutilmoqda");
    expect(screen.getByRole("status")).toHaveTextContent(/5\D?000 so'm qo'shimcha xarajat marketga tasdiqqa yuborildi/);
    expect(screen.getByRole("status")).toHaveTextContent(/So'ralgan amal\s*Sotish/);
    expect(screen.getByRole("status")).toHaveTextContent(/Yuborilgan vaqt\s*Bugun, \d{2}:\d{2}/);
    expect(screen.queryByRole("button", { name: /^Sotish$/ })).not.toBeInTheDocument();
    expect(footerCloseButton()).toHaveTextContent("Yopish");
  });

  it("⭐ hamkor buyurtmasi (`external_id`) — eski (replay) ogohlantirish: «market tasdiqlamaguncha holati o'zgarmaydi»", async () => {
    // Backend hamkor buyurtmasida kechiktirilgan rejimni ishlatmaydi (`isPartnerSyncedOrder`): 202, buyurtma
    // `waiting` da qoladi — «darhol sotiladi» deyish noto'g'ri bo'lardi.
    const user = userEvent.setup();
    renderSell({ order: { ...order, external_id: "BP-120" } });
    await user.type(screen.getByLabelText("Qo'shimcha xarajat"), "5000");

    expect(
      screen.getByText(
        "Qo'shimcha xarajat market tasdig'idan o'tadi — market tasdiqlamaguncha buyurtma holati o'zgarmaydi.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/darhol sotiladi/)).not.toBeInTheDocument();
  });

  it("bo'sh `external_id` — hamkor emas, kechiktirilgan ogohlantirish", async () => {
    const user = userEvent.setup();
    renderSell({ order: { ...order, external_id: "  " } });
    await user.type(screen.getByLabelText("Qo'shimcha xarajat"), "5000");
    expect(screen.getByText(NOTICE)).toHaveTextContent(/^Buyurtma darhol sotiladi\./);
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
  const partialToggle = () => screen.getByRole("switch", { name: /Qisman sotish/ });
  const sellButton = () => screen.getByRole("button", { name: /^Sotish$/ });

  // Ega 2026-11-07 (BeePost'dagidek): 1 donali buyurtmani ham narxini tushirib «qisman» sotish mumkin — mijoz
  // 120 000 lik mahsulotni 90 000 ga oladi, kuryer market bilan kelishgan. Soni o'zgarmaydi, faqat summa.
  it("allows a price-only partial sell for a single-unit order (BeePost parity)", async () => {
    const user = userEvent.setup();
    const onPartlySell = vi.fn();
    renderSell({ order: singleUnitOrder, onPartlySell });

    expect(partialToggle()).toBeEnabled();
    expect(partialToggle()).not.toHaveTextContent("qisman sotib bo'lmaydi");
    await user.click(partialToggle());

    // Kamaytirib bo'lmaydi (kamida 1 dona), lekin bu xato emas — qizil ogohlantirish yo'q.
    expect(screen.getByRole("button", { name: "product sonini kamaytirish" })).toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // Summa maydoni ostida: faqat narx tushadi, buyurtma summasidan kam.
    expect(screen.getByText(/Soni o'zgarmasa, faqat narx tushadi — 120\s000 so'm dan kam kiriting/)).toBeInTheDocument();
    // Summasiz — avvalgidek.
    expect(sellButton()).toBeDisabled();
    expect(screen.getByText("To'lov summasini kiriting")).toBeInTheDocument();

    await user.type(screen.getAllByPlaceholderText("0")[0], "90000");
    expect(sellButton()).toBeEnabled();
    await user.click(sellButton());

    expect(onPartlySell).toHaveBeenCalledWith("o-1", {
      order_item_info: [{ order_item_id: "i1", product_id: "24", quantity: 1 }],
      totalPrice: 90000,
      extraCost: 0,
      // Izoh ixtiyoriy (ega qarori).
      comment: "",
    });
  });

  it("price-only partial sell: an amount equal to the order total is not a partial sale", async () => {
    const user = userEvent.setup();
    const onPartlySell = vi.fn();
    renderSell({ order: singleUnitOrder, onPartlySell });

    await user.click(partialToggle());
    await user.type(screen.getAllByPlaceholderText("0")[0], "120000");

    expect(sellButton()).toBeDisabled();
    expect(
      screen.getByText("Mahsulot sonini kamaytiring yoki summani buyurtma summasidan kam kiriting"),
    ).toBeInTheDocument();
    await user.click(sellButton());
    expect(onPartlySell).not.toHaveBeenCalled();
  });

  it("price-only partial sell allows 0 so'm", async () => {
    const user = userEvent.setup();
    const onPartlySell = vi.fn();
    renderSell({ order: singleUnitOrder, onPartlySell });

    await user.click(partialToggle());
    await user.type(screen.getAllByPlaceholderText("0")[0], "0");
    await user.click(sellButton());

    expect(onPartlySell).toHaveBeenCalledWith("o-1", expect.objectContaining({ totalPrice: 0 }));
  });

  it("allows partial sell for a multi-unit partner parcel without a catalog product and sends the order-item id (real BeePost #120)", async () => {
    const user = userEvent.setup();
    const onPartlySell = vi.fn();
    renderSell({ order: beePostMultiUnitOrder as never, onPartlySell });

    expect(partialToggle()).toBeEnabled();
    await user.click(partialToggle());
    await user.click(screen.getByRole("button", { name: "tv sonini kamaytirish" }));
    // fix3b M10: qisman summa buyurtma summasidan (120 000) oshmaydi.
    await user.type(screen.getAllByPlaceholderText("0")[0], "50000");
    await user.click(screen.getByRole("button", { name: /^Sotish$/ }));

    expect(onPartlySell).toHaveBeenCalledWith("120", expect.objectContaining({
      order_item_info: [{ order_item_id: "124", quantity: 1 }],
      totalPrice: 50000,
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
    await user.type(screen.getAllByPlaceholderText("0")[0], "70000");
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

  // Ega 2026-11-07: 2+ donali buyurtmada ham sonini tushirmasdan narxni tushirib sotish mumkin. Soni ham, summa
  // ham o'zgarmasa — bu oddiy «Sotish», qisman emas.
  it("multi-unit order: price-only sale below the total is allowed, the full total needs a reduced quantity", async () => {
    const user = userEvent.setup();
    const onPartlySell = vi.fn();
    renderSell({ order: twoUnitOrder, onPartlySell });

    await user.click(partialToggle());
    await user.type(screen.getAllByPlaceholderText("0")[0], "120000");

    expect(sellButton()).toBeDisabled();
    // Sabab «Sotish» yonida yoziladi.
    expect(
      screen.getByText("Mahsulot sonini kamaytiring yoki summani buyurtma summasidan kam kiriting"),
    ).toBeInTheDocument();

    // Kamaytirsa — teng summa ham qisman sotuv; qaytarib oshirsa — yana bloklanadi.
    await user.click(screen.getByRole("button", { name: "Krossovka sonini kamaytirish" }));
    expect(sellButton()).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Krossovka sonini oshirish" }));
    expect(sellButton()).toBeDisabled();

    // Soni o'zgarmagan, summa kamroq — narx tushirib sotish.
    const input = screen.getAllByPlaceholderText("0")[0];
    await user.clear(input);
    await user.type(input, "100000");
    expect(sellButton()).toBeEnabled();
    await user.click(sellButton());
    expect(onPartlySell).toHaveBeenCalledWith("o-1", expect.objectContaining({
      order_item_info: [{ order_item_id: "i1", product_id: "24", quantity: 2 }],
      totalPrice: 100000,
    }));
  });

  it("keeps 'Sotish' disabled in partial mode while the payment amount is empty", async () => {
    const user = userEvent.setup();
    renderSell({ order: twoUnitOrder });

    await user.click(partialToggle());
    await user.click(screen.getByRole("button", { name: "Krossovka sonini kamaytirish" }));

    expect(sellButton()).toBeDisabled();
    expect(screen.getByText("To'lov summasini kiriting")).toBeInTheDocument();
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

describe("CancelModal — sabab yopiq ro'yxatdan majburiy (GNWDKvmZ)", () => {
  const submit = () => screen.getAllByRole("button", { name: /^Bekor qilish$/ }).at(-1)!;

  it("«To'langan summa» maydoni yo'q (uguUEhin) — faqat xarajat, sabab, izoh, dalil", () => {
    renderCancel();
    expect(screen.queryByLabelText("To'langan summa")).toBeNull();
    // Pul maydoni bitta — «Qo'shimcha xarajat» (so'm, mingliklar bilan).
    expect(screen.getAllByPlaceholderText("0")).toHaveLength(1);
    expect(screen.getByLabelText("Qo'shimcha xarajat")).toBeInTheDocument();
    expect(reasonBox()).toBeInTheDocument();
    expect(screen.getByLabelText(/^Izoh/)).toBeInTheDocument();
  });

  it("6 ta sabab; tanlanmaguncha «Bekor qilish» o'chiq", async () => {
    const user = userEvent.setup();
    renderCancel();
    expect(reasonBox()).toHaveTextContent("Sababni tanlang");
    expect(submit()).toBeDisabled();
    await user.click(reasonBox());
    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
      "Mijoz javob bermadi",
      "Mijoz rad etdi",
      "Manzil noto'g'ri",
      "Mahsulot nuqsonli",
      "Narx bo'yicha kelishmovchilik",
      "Boshqa",
    ]);
    expect(submit()).toBeDisabled();
  });

  it("sabab tanlansa yoqiladi va so'rovga `reason` qo'shiladi", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderCancel({ onCancel });
    await chooseReason(user, "Mijoz javob bermadi");
    expect(submit()).toBeEnabled();
    await user.click(submit());
    expect(onCancel).toHaveBeenCalledWith("o-1", {
      reason: "CUSTOMER_NO_ANSWER",
      comment: "",
      extraCost: 0,
    });
  });

  it("«Boshqa» — izoh majburiy: bo'sh izohda o'chiq, yozilgach yuboriladi", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderCancel({ onCancel });
    await chooseReason(user, "Boshqa");
    expect(screen.getByText("«Boshqa» tanlanganda izoh majburiy")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Izoh/)).toBeRequired();
    expect(submit()).toBeDisabled();

    await user.type(screen.getByLabelText(/^Izoh/), "   ");
    expect(submit()).toBeDisabled();

    await user.type(screen.getByLabelText(/^Izoh/), "Mijoz boshqa shaharga ketgan");
    expect(submit()).toBeEnabled();
    await user.click(submit());
    expect(onCancel).toHaveBeenCalledWith("o-1", expect.objectContaining({ reason: "OTHER", comment: "   Mijoz boshqa shaharga ketgan" }));
  });

  it("xarajat yozilsa — so'm sifatida yuboriladi (mingliklar bilan ko'rinadi)", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderCancel({ onCancel });
    await user.type(screen.getByLabelText("Qo'shimcha xarajat"), "15000");
    expect(screen.getByLabelText("Qo'shimcha xarajat")).toHaveValue("15 000");
    await chooseReason(user, "Mijoz rad etdi");
    await user.click(submit());
    expect(onCancel).toHaveBeenCalledWith("o-1", { reason: "CUSTOMER_REFUSED", comment: "", extraCost: 15000 });
  });

  it("oyna qayta ochilganda sabab tozalanadi", async () => {
    const user = userEvent.setup();
    const { rerender } = renderCancel();
    await chooseReason(user, "Narx bo'yicha kelishmovchilik");
    expect(reasonBox()).toHaveTextContent("Narx bo'yicha kelishmovchilik");
    rerender(<CancelModal order={order} open={false} onClose={vi.fn()} onCancel={vi.fn()} />);
    rerender(<CancelModal order={order} open onClose={vi.fn()} onCancel={vi.fn()} />);
    expect(reasonBox()).toHaveTextContent("Sababni tanlang");
    expect(submit()).toBeDisabled();
  });

  it("so'rov ketayotganda «Bekor qilish» yuklanishda, «Orqaga» o'chiq, Esc yopmaydi", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onCancel = vi.fn();
    renderCancel({ isLoading: true, onClose, onCancel });
    await chooseReason(user, "Mijoz rad etdi");
    expect(submit()).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Orqaga" })).toBeDisabled();
    await user.click(submit());
    expect(onCancel).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("CancelModal extra cost approval", () => {
  afterEach(() => clearPendingExtraCostApproval("o-1"));

  it("warns up front that an extra cost goes to the market for approval", async () => {
    const user = userEvent.setup();
    renderCancel();

    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Qo'shimcha xarajat"), "5000");

    expect(screen.getByText(NOTICE)).toBeInTheDocument();
    expect(screen.getByText(NOTICE)).toHaveTextContent(/^Buyurtma darhol bekor qilinadi\./);
    expect(screen.queryByText(/market tasdiqlamaguncha/)).not.toBeInTheDocument();
  });

  it("⭐ hamkor buyurtmasi (`external_id`) — eski (replay) ogohlantirish, «darhol bekor qilinadi» yo'q", async () => {
    const user = userEvent.setup();
    renderCancel({ order: { ...order, external_id: "BP-120" } });
    await user.type(screen.getByLabelText("Qo'shimcha xarajat"), "5000");

    expect(
      screen.getByText(
        "Qo'shimcha xarajat market tasdig'idan o'tadi — market tasdiqlamaguncha buyurtma holati o'zgarmaydi.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/darhol bekor qilinadi/)).not.toBeInTheDocument();
  });

  it("replaces the form with 'Market tasdig'i kutilmoqda' while approval is pending", () => {
    recordPendingExtraCostApproval({ orderId: "o-1", action: "cancel", amount: 5000, requestedAt: new Date().toISOString(), orderStatus: "waiting" });
    renderCancel({ awaitingApproval: true });

    expect(screen.getByRole("dialog", { name: "Market tasdig'i kutilmoqda" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Market tasdig'i kutilmoqda");
    expect(screen.getByRole("status")).toHaveTextContent(/So'ralgan amal\s*Bekor qilish/);
    expect(screen.queryByRole("button", { name: /Bekor qilish/ })).not.toBeInTheDocument();
    expect(footerCloseButton()).toHaveTextContent("Yopish");
  });

  it("dalil faqat xarajat tufayli majburiy bo'lsa — aniq sabab yoziladi (`cancel_extra_cost`)", async () => {
    const user = userEvent.setup();
    renderCancel({
      order: { ...order, market: { name: "Zamon", expense_proof_conditions: ["cancel_extra_cost"] } },
    });
    expect(screen.queryByText(/qo'shimcha xarajat bilan bekor qilishda/)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Qo'shimcha xarajat"), "15000");
    expect(
      screen.getByText("Bu market uchun qo'shimcha xarajat bilan bekor qilishda rasm yoki video majburiy"),
    ).toBeInTheDocument();
    await chooseReason(user, "Mijoz rad etdi");
    expect(screen.getAllByRole("button", { name: /^Bekor qilish$/ }).at(-1)).toBeDisabled();
  });
});

/**
 * DALIL MAJBURIYATI — market `expense_proof_conditions` dan OLDINDAN ko'rinadi.
 *
 * Detal sahifasi ilgari modalga `market: { name: "-" }` uzatardi va bu shart
 * hech qachon yetib kelmasdi — foydalanuvchi faqat backend 400 bergandagina
 * bilardi. Endi haqiqiy market uzatiladi; modal uni o'qishi shu yerda qulflangan.
 */
describe("SellModal — market dalil sharti", () => {
  it("⭐ `sell_any` — majburiylik belgisi va izohi chiqadi, dalilsiz yuborib bo'lmaydi", () => {
    renderSell({
      order: { ...order, market: { name: "Zamon Market", expense_proof_conditions: ["sell_any"] } },
    });

    expect(screen.getAllByText("Sotishda rasm yoki video majburiy").length).toBeGreaterThan(0);
    const label = screen.getByText("Rasm yoki video");
    expect(label.parentElement?.textContent).toContain("*");
    expect(screen.getByRole("button", { name: /^Sotish$/ })).toBeDisabled();
  });

  it("shart yo'q (`market: { name: \"-\" }` — eski holat) — majburiylik ko'rinmaydi", () => {
    renderSell();
    expect(screen.queryByText("Sotishda rasm yoki video majburiy")).not.toBeInTheDocument();
  });
});
