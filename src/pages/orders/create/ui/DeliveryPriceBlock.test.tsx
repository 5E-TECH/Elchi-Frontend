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
 * 6NYcXvGy — «Buyurtma xulosasi» → «Yetkazish narxi» (maket `market-new-orders-create-manual-existing-customer`
 * holatlari): MARKET STANDART NARXI + vazn uchun qo'shimcha; standart doirasida, hisoblanmoqda, hisoblab bo'lmadi,
 * katalogdan tashqari / o'lchovsiz mahsulot; o'lchovli mahsulot yo'q — CS-B standart narx.
 */

/** Server hisobi: umumiy tarif asosi 60 000 — blok uni EMAS, market standartini (35 000) ko'rsatadi. */
const QUOTE: DeliveryQuote = {
  tariffId: "address",
  base: 60_000,
  perExtraKg: 4_000,
  actualKg: 1.8,
  volumetricKg: 2.4,
  billableKg: 2.4,
  extraKg: 2,
  extra: 8_000,
  total: 68_000,
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

const input = (
  overrides: Partial<OrderDeliveryQuote["input"]> = {},
): OrderDeliveryQuote["input"] => ({
  items: [],
  measured: 2,
  unmeasured: 0,
  catalogLessNames: [],
  unmeasuredNames: [],
  ...overrides,
});

const estimate = (overrides: Partial<OrderDeliveryQuote> = {}): OrderDeliveryQuote => ({
  visible: true,
  input: input(),
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
const value = () => within(group()).getByTestId("delivery-estimate");

afterEach(async () => {
  await i18n.changeLanguage("uz");
});

describe("DeliveryPriceBlock — maket holatlari (6NYcXvGy)", () => {
  it("qo'shimcha bor: «≈ 43 000 so'm» = standart 35 000 + vazn uchun 8 000 (tarif asosi 60 000 emas)", () => {
    renderBlock();
    expect(value()).toHaveTextContent("≈ 43 000 so'm");
    expect(group()).toHaveTextContent("Standart 35 000 + vazn uchun 8 000 so'm (2 kg × 4 000)");
    expect(group()).toHaveTextContent("Hisob vazni 2,4 kg · hajm bo'yicha");
    expect(group()).toHaveTextContent("Og'irligi 1,8 kg · hajmli vazni 2,4 kg");
    expect(group()).toHaveTextContent("Marketdan yechiladi · yakuniy narx sotuvda qotiriladi");
    expect(within(group()).getByText("Taxminiy")).toBeInTheDocument();
    expect(group()).not.toHaveTextContent("60 000");
  });

  it("standart doirasida: «35 000 so'm» (≈ siz), «Standart narx · qo'shimcha yo'q», hisob vazni; «Taxminiy» yo'q", () => {
    const light = { ...QUOTE, extraKg: 0, extra: 0, billableKg: 0.8, basis: "weight" as const };
    renderBlock({ isMarketRole: true, estimate: estimate({ quote: light }) });
    expect(value()).toHaveTextContent(/^35 000 so'm$/);
    expect(group()).toHaveTextContent("Standart narx · qo'shimcha yo'q");
    expect(group()).toHaveTextContent("Hisob vazni 0,8 kg · og'irlik bo'yicha");
    expect(within(group()).queryByText("Taxminiy")).not.toBeInTheDocument();
  });

  it("hisoblanmoqda: skelet va «Vazn va hajm hisoblanmoqda...» (role=status), aria-busy, narx hali yo'q", () => {
    renderBlock({
      estimate: estimate({
        state: { status: "loading", quotes: undefined, isUpdating: true, retry: vi.fn() },
        quote: null,
      }),
    });
    expect(group()).toHaveAttribute("aria-busy", "true");
    expect(within(group()).getByRole("status")).toHaveTextContent("Vazn va hajm hisoblanmoqda...");
    expect(within(group()).queryByTestId("delivery-estimate")).not.toBeInTheDocument();
  });

  it("yangisi hisoblanmoqda — oldingi narx turadi, aria-busy", () => {
    renderBlock({ estimate: estimate({ state: success({ isUpdating: true }) }) });
    expect(group()).toHaveAttribute("aria-busy", "true");
    expect(value()).toHaveTextContent("≈ 43 000 so'm");
  });

  it("hisoblab bo'lmadi: hozircha standart narx, sabab (role=alert), «Qayta urinish» qayta so'raydi", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    renderBlock({
      estimate: estimate({
        state: { status: "error", quotes: undefined, isUpdating: false, retry },
        quote: null,
      }),
    });
    expect(value()).toHaveTextContent(/^35 000 so'm$/);
    expect(within(group()).getByRole("alert")).toHaveTextContent(
      "Vazn bo'yicha qo'shimchani hisoblab bo'lmadi — hozircha standart narx. Buyurtmani baribir yaratish mumkin.",
    );
    await user.click(within(group()).getByRole("button", { name: "Qayta urinish" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("tanlangan turga faol tarif yo'q — standart narx va sabab, «Qayta urinish» yo'q (qayta so'rash foyda bermaydi)", () => {
    renderBlock({ estimate: estimate({ quote: null }) });
    expect(value()).toHaveTextContent(/^35 000 so'm$/);
    expect(within(group()).getByRole("alert")).toBeInTheDocument();
    expect(within(group()).queryByRole("button")).not.toBeInTheDocument();
  });

  it("katalogdan tashqari va o'lchovsiz mahsulotlar — nomi bilan izoh; 3 tadan ko'pi «va yana N ta»", () => {
    renderBlock({
      estimate: estimate({
        input: input({
          unmeasured: 5,
          catalogLessNames: ["Sovg'a qadog'i"],
          unmeasuredNames: ["Eski termos", "Lampa", "Kitob", "Soat"],
        }),
      }),
    });
    const notes = within(group())
      .getAllByRole("status")
      .map((node) => node.textContent);
    expect(notes).toEqual([
      "«Sovg'a qadog'i» katalogda yo'q — vazni hisobga kirmadi",
      "«Eski termos», «Lampa», «Kitob» va yana 1 ta o'lchovi kiritilmagan — vazni hisobga kirmadi",
    ]);
    expect(value()).toHaveTextContent("≈ 43 000 so'm");
  });
});

describe("DeliveryPriceBlock — o'lchovli mahsulot yo'q, standart narxsiz market", () => {
  it("mahsulot tanlanmagan — CS-B standart narxi avvalgidek, izohsiz", () => {
    renderBlock({ estimate: estimate({ input: input({ measured: 0 }), quote: null }) });
    expect(group()).toHaveTextContent("35 000 so'm");
    expect(group()).toHaveTextContent("Standart narx");
    expect(group()).toHaveTextContent("Marketdan yechiladi · yakuniy narx sotuvda qotiriladi");
    expect(within(group()).queryByRole("status")).not.toBeInTheDocument();
    expect(within(group()).queryByText("Taxminiy")).not.toBeInTheDocument();
  });

  it("faqat katalogdan tashqari mahsulot — standart narx + nomli izoh", () => {
    renderBlock({
      estimate: estimate({
        input: input({ measured: 0, unmeasured: 1, catalogLessNames: ["Sovg'a qadog'i"] }),
        quote: null,
      }),
    });
    expect(group()).toHaveTextContent("35 000 so'm");
    expect(within(group()).getByRole("status")).toHaveTextContent(
      "«Sovg'a qadog'i» katalogda yo'q — vazni hisobga kirmadi",
    );
  });

  it("standart narx yo'q (yoki yuklanmoqda) — qator yo'q, server hisobi bo'lsa ham (maket)", () => {
    renderBlock({ standardPrice: null });
    expect(screen.queryByRole("group", { name: "Yetkazish narxi" })).not.toBeInTheDocument();
  });

  it("narxni ko'rmaydigan rol — izohlar ham yo'q", () => {
    renderBlock({
      estimate: estimate({
        visible: false,
        input: input({ measured: 0, unmeasured: 1, catalogLessNames: ["Sovg'a qadog'i"] }),
        quote: null,
      }),
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("DeliveryPriceBlock — uz/ru/en", () => {
  const KEYS = [
    "estimateValue",
    "estimateBreakdown",
    "estimateWithinStandard",
    "estimateBillable",
    "estimateBillableNoBasis",
    "estimateBasisVolume",
    "estimateBasisWeight",
    "estimateWeights",
    "estimateBadge",
    "estimateLoading",
    "estimateFailed",
    "quotedName",
    "namesMore",
    "catalogLessNote",
    "unmeasuredNote",
  ];

  it("uchala tilda kalitlar bor, ru — kirill", () => {
    for (const locale of [uzOrders, ruOrders, enOrders]) {
      const pricing = (locale as { createPricing: Record<string, string> }).createPricing;
      for (const key of KEYS) expect(pricing[key], key).toBeTruthy();
    }
    const ru = (ruOrders as { createPricing: Record<string, string> }).createPricing;
    for (const key of ["estimateFailed", "catalogLessNote", "estimateLoading"])
      expect(ru[key]).toMatch(/[а-я]/);
  });

  it("ruscha: «≈ 43 000 сум», «Расчётный вес 2,4 кг · по объёму», «… нет в каталоге»", async () => {
    await i18n.changeLanguage("ru");
    renderBlock({
      estimate: estimate({ input: input({ unmeasured: 1, catalogLessNames: ["Подарок"] }) }),
    });
    const block = screen.getByRole("group", { name: "Стоимость доставки" });
    expect(within(block).getByTestId("delivery-estimate")).toHaveTextContent("≈ 43 000 сум");
    expect(block).toHaveTextContent("Расчётный вес 2,4 кг · по объёму");
    expect(within(block).getByRole("status")).toHaveTextContent(
      "«Подарок» нет в каталоге — вес не учтён",
    );
  });
});
