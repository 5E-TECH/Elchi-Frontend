import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DeliveryQuote, DeliveryQuoteState } from "../../../../entities/delivery-pricing";
import i18n from "../../../../i18n";
import enOrders from "../../../../locales/en/orders.json";
import ruOrders from "../../../../locales/ru/orders.json";
import uzOrders from "../../../../locales/uz/orders.json";
import { renderWithProviders } from "../../../../test/test-utils";
import DeliveryPriceBlock from "./DeliveryPriceBlock";
import type { OrderDeliveryQuote } from "./useOrderDeliveryQuote";

/**
 * 6NYcXvGy — «Buyurtma xulosasi» → «Yetkazish narxi» (maket `*-create-manual-step2-existing-customer`): server
 * hisobidagi taxminiy narx, holatlar va o'lchovsiz mahsulot ogohlantirishi; o'lchovli mahsulot yo'q — CS-B standart narx.
 */

const QUOTE: DeliveryQuote = {
  tariffId: "address",
  base: 35_000,
  perExtraKg: 4_000,
  actualKg: 1.8,
  volumetricKg: 2.4,
  billableKg: 2.4,
  extraKg: 2,
  extra: 8_000,
  total: 43_000,
  basis: "volume",
  volumetricFromKg: 0,
  volumetricApplied: true,
  daysMin: 1,
  daysMax: 2,
};

const success = (overrides: Partial<DeliveryQuoteState> = {}): DeliveryQuoteState => ({
  status: "success",
  quotes: { city: null, center: null, address: QUOTE },
  isUpdating: false,
  retry: vi.fn(),
  ...overrides,
});

const estimate = (overrides: Partial<OrderDeliveryQuote> = {}): OrderDeliveryQuote => ({
  visible: true,
  input: { items: [], measured: 2, unmeasured: 0 },
  state: success(),
  quote: QUOTE,
  ...overrides,
});

const renderBlock = (props: Partial<Parameters<typeof DeliveryPriceBlock>[0]> = {}) =>
  renderWithProviders(
    <DeliveryPriceBlock
      isMarketRole={false}
      standardPrice={35_000}
      estimate={estimate()}
      {...props}
    />,
  );

const group = () => screen.getByRole("group", { name: "Yetkazish narxi" });

afterEach(async () => {
  await i18n.changeLanguage("uz");
});

describe("DeliveryPriceBlock — taxminiy narx (6NYcXvGy)", () => {
  it("«≈ 43 000 so'm», standart + vazn (qo'shimcha kg ajratilgan), hisob vazni, og'irlik va hajmli vazn, «Taxminiy»", () => {
    renderBlock();
    const block = group();
    expect(within(block).getByTestId("delivery-estimate")).toHaveTextContent("≈ 43 000 so'm");
    expect(block).toHaveTextContent("Standart 35 000 + vazn uchun 8 000 so'm (2 kg × 4 000)");
    expect(block).toHaveTextContent("Hisob vazni 2,4 kg · hajm bo'yicha");
    expect(block).toHaveTextContent("Og'irligi 1,8 kg · hajmli vazni 2,4 kg");
    expect(block).toHaveTextContent("Marketdan yechiladi · yakuniy narx sotuvda qotiriladi");
    expect(within(block).getByText("Taxminiy")).toBeInTheDocument();
    // Standart narx o'rnida — dvigatel narxi («Standart narx» qatori yo'q).
    expect(within(block).queryByText("Standart narx")).not.toBeInTheDocument();
    expect(screen.queryByTestId("delivery-unmeasured")).not.toBeInTheDocument();
  });

  it("qo'shimcha vazn yo'q — «… vazn uchun qo'shimcha yo'q», og'irlik bo'yicha; market — «Sizdan yechiladi»", () => {
    const light = {
      ...QUOTE,
      extraKg: 0,
      extra: 0,
      total: 35_000,
      billableKg: 0.8,
      basis: "weight" as const,
    };
    renderBlock({ isMarketRole: true, estimate: estimate({ quote: light }) });
    expect(group()).toHaveTextContent("≈ 35 000 so'm");
    expect(group()).toHaveTextContent("Standart 35 000 — vazn uchun qo'shimcha yo'q");
    expect(group()).toHaveTextContent("Hisob vazni 0,8 kg · og'irlik bo'yicha");
    expect(group()).toHaveTextContent("Sizdan yechiladi · yakuniy narx sotuvda qotiriladi");
  });

  it("o'lchovsiz mahsulot ham bor — ko'rinadigan ogohlantirish, narx o'lchovlilardan", () => {
    renderBlock({ estimate: estimate({ input: { items: [], measured: 2, unmeasured: 1 } }) });
    expect(screen.getByTestId("delivery-unmeasured")).toHaveTextContent(
      "1 ta mahsulotda o'lchov yo'q — narx ularsiz hisoblandi",
    );
    expect(screen.getByTestId("delivery-estimate")).toHaveTextContent("≈ 43 000 so'm");
  });

  it("birinchi javob kutilmoqda — skelet va aria-busy, «Taxminiy» hali yo'q", () => {
    renderBlock({
      estimate: estimate({
        state: { status: "loading", quotes: undefined, isUpdating: true, retry: vi.fn() },
        quote: null,
      }),
    });
    expect(group()).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByTestId("delivery-estimate")).not.toBeInTheDocument();
    expect(screen.queryByText("Taxminiy")).not.toBeInTheDocument();
  });

  it("yangisi hisoblanmoqda — oldingi narx turadi, xira (aria-busy)", () => {
    renderBlock({ estimate: estimate({ state: success({ isUpdating: true }) }) });
    expect(group()).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("delivery-estimate")).toHaveTextContent("≈ 43 000 so'm");
  });

  it("API javob bermadi — «Hisoblab bo'lmadi», forma ishlaydi, «Qayta urinish» qayta so'raydi", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    renderBlock({
      estimate: estimate({
        state: { status: "error", quotes: undefined, isUpdating: false, retry },
        quote: null,
      }),
    });
    expect(group()).toHaveTextContent("Hisoblab bo'lmadi");
    expect(group()).toHaveTextContent("Buyurtma baribir yaratiladi — narx sotuvda hisoblanadi.");
    expect(screen.queryByTestId("delivery-estimate")).not.toBeInTheDocument();
    await user.click(within(group()).getByRole("button", { name: "Qayta urinish" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("tanlangan turga faol tarif yo'q — «—» va izoh", () => {
    renderBlock({ estimate: estimate({ quote: null }) });
    expect(group()).toHaveTextContent("—");
    expect(group()).toHaveTextContent("Bu yetkazish turiga faol tarif yo'q");
  });
});

describe("DeliveryPriceBlock — o'lchovli mahsulot yo'q (CS-B standart narx)", () => {
  it("mahsulot tanlanmagan — standart narx avvalgidek", () => {
    renderBlock({
      estimate: estimate({ input: { items: [], measured: 0, unmeasured: 0 }, quote: null }),
    });
    expect(group()).toHaveTextContent("35 000 so'm");
    expect(group()).toHaveTextContent("Standart narx");
    expect(screen.queryByText("Taxminiy")).not.toBeInTheDocument();
    expect(screen.queryByTestId("delivery-unmeasured")).not.toBeInTheDocument();
  });

  it("faqat o'lchovsiz mahsulotlar — standart narx + ogohlantirish; standart narx ham yo'q — «—» + ogohlantirish", () => {
    const allUnmeasured = estimate({
      input: { items: [], measured: 0, unmeasured: 2 },
      quote: null,
    });
    const { unmount } = renderBlock({ estimate: allUnmeasured });
    expect(group()).toHaveTextContent("35 000 so'm");
    expect(screen.getByTestId("delivery-unmeasured")).toHaveTextContent(
      "Mahsulotlarda o'lchov yo'q — vazn va hajm bo'yicha narx hisoblanmadi",
    );
    unmount();

    renderBlock({ standardPrice: null, estimate: allUnmeasured });
    expect(group()).toHaveTextContent("—");
    expect(screen.getByTestId("delivery-unmeasured")).toBeInTheDocument();
  });

  it("narx ko'rmaydigan rol — dvigatel bloki ham, ogohlantirish ham yo'q", () => {
    renderBlock({
      standardPrice: null,
      estimate: estimate({ visible: false, input: { items: [], measured: 2, unmeasured: 1 } }),
    });
    expect(screen.queryByRole("group", { name: "Yetkazish narxi" })).not.toBeInTheDocument();
  });
});

describe("DeliveryPriceBlock — uz/ru/en", () => {
  const KEYS = [
    "estimateValue",
    "estimateBreakdown",
    "estimateBaseOnly",
    "estimateBillable",
    "estimateBillableNoBasis",
    "estimateBasisVolume",
    "estimateBasisWeight",
    "estimateWeights",
    "estimateBadge",
    "estimateFailed",
    "estimateFailedHint",
    "estimateNoTariff",
    "unmeasuredAll",
  ];

  it("uchala tilda kalitlar bor (ru — kirill), ko'plik shakllari: ru one/few/many, en one/other", () => {
    for (const locale of [uzOrders, ruOrders, enOrders]) {
      const pricing = (locale as { createPricing: Record<string, string> }).createPricing;
      for (const key of KEYS) expect(pricing[key], key).toBeTruthy();
    }
    expect(
      (uzOrders as { createPricing: Record<string, string> }).createPricing.unmeasuredSome,
    ).toBeTruthy();
    const ru = (ruOrders as { createPricing: Record<string, string> }).createPricing;
    for (const form of ["one", "few", "many"])
      expect(ru[`unmeasuredSome_${form}`]).toMatch(/[а-я]/);
    const en = (enOrders as { createPricing: Record<string, string> }).createPricing;
    for (const form of ["one", "other"]) expect(en[`unmeasuredSome_${form}`]).toBeTruthy();
  });

  it("ruscha: «≈ 43 000 сум», «Расчётный вес 2,4 кг · по объёму», «У 3 товаров нет габаритов …»", async () => {
    await i18n.changeLanguage("ru");
    renderBlock({ estimate: estimate({ input: { items: [], measured: 1, unmeasured: 3 } }) });
    const block = screen.getByRole("group", { name: "Стоимость доставки" });
    expect(within(block).getByTestId("delivery-estimate")).toHaveTextContent("≈ 43 000 сум");
    expect(block).toHaveTextContent("Расчётный вес 2,4 кг · по объёму");
    expect(screen.getByTestId("delivery-unmeasured")).toHaveTextContent(
      "У 3 товаров нет габаритов",
    );
  });
});
