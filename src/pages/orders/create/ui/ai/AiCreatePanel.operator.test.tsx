import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../../test/test-utils";
import { aiApiGet, aiPreview } from "../../../../../test/aiOrderFixtures";

const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));

vi.mock("../../../../../shared/api/api", () => ({ api: { post: mocks.post, get: mocks.get } }));

import type { AiConfirmRequest, AiPreviewOrder } from "../../../../../entities/ai-order";
import AiCreatePanel from "./AiCreatePanel";

/**
 * AI KARTASIDA «OPERATOR» TANLOVI (2026-11-20): AI xabardagi `#sevinch` ni faqat matn qilib yozardi — buyurtma
 * `operator_id` siz yaratilib, sotuvda operatorga komissiya yozilmasdi. Endi kartada ro'yxatdan tanlanadi
 * (`orders[].operator_id`); AI o'qigan ism mos kelsa — faqat TAKLIF (avtomatik tanlanmaydi).
 */

const SELECTABLE = "market-operators/selectable";
const ok = (data: unknown) => Promise.resolve({ data: { statusCode: 200, message: "ok", data } });

let operatorsByMarket: Record<string, Array<{ id: string; name: string }>>;
let parseOrders: AiPreviewOrder[];
let confirmResponse: (request: AiConfirmRequest) => unknown;

const apiGet = (url: string, config?: { params?: { market_id?: string } }) =>
  url === SELECTABLE ? ok({ items: operatorsByMarket[config?.params?.market_id ?? "own"] ?? [] }) : aiApiGet(url);

const selectableCalls = () => mocks.get.mock.calls.filter(([url]) => url === SELECTABLE);
const confirmCalls = () =>
  mocks.post.mock.calls.filter(([url]) => url === "orders/ai-confirm").map(([, body]) => body as AiConfirmRequest);

const order = (i: number, overrides: Partial<AiPreviewOrder> = {}) =>
  aiPreview({
    customer_name: `Mijoz ${i}`,
    phone_number: `+99890${String(1000000 + i).slice(-7)}`,
    total_price: 100000 + i * 1000,
    ...overrides,
  });

const marketState = { role: { id: "7", role: "market", region: null, name: "Test market" } } as never;
const adminState = { role: { id: "1", role: "superadmin", region: null, name: "Admin" } } as never;

const parse = async (user: ReturnType<typeof userEvent.setup>, expectedCards: number) => {
  await user.type(screen.getByRole("textbox", { name: "Buyurtma matni" }), "buyurtmalar");
  await user.click(screen.getByRole("button", { name: /Tahlil qilish/ }));
  await waitFor(() => expect(screen.getAllByTestId("ai-preview-card")).toHaveLength(expectedCards));
};

const cards = () => screen.getAllByTestId("ai-preview-card");
const operatorSelect = (card: HTMLElement) => within(card).findByRole("combobox", { name: "Operator" });

const pickOperator = async (user: ReturnType<typeof userEvent.setup>, card: HTMLElement, name: string) => {
  await user.click(await operatorSelect(card));
  await user.click(await screen.findByRole("option", { name }));
};

const createAll = async (user: ReturnType<typeof userEvent.setup>, count: number) => {
  await user.click(within(screen.getByTestId("ai-confirm-bar")).getByRole("button", { name: `Tayyorlarini yaratish — ${count} ta` }));
  await waitFor(() => expect(confirmCalls()).toHaveLength(1));
};

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  operatorsByMarket = {
    own: [
      { id: "31", name: "Sevinch Karimova" },
      { id: "32", name: "Bekzod Aliyev" },
    ],
    "3": [{ id: "41", name: "Dilnoza Karimova" }],
  };
  parseOrders = [];
  confirmResponse = (request) => ({
    results: request.orders.map((_, index) => ({ index, ok: true, order_id: String(900 + index) })),
  });
  mocks.get.mockReset();
  mocks.get.mockImplementation(apiGet);
  mocks.post.mockReset();
  mocks.post.mockImplementation((url: string, body: unknown) => {
    if (url === "orders/ai-parse") {
      return ok({ ok: true, orders: parseOrders });
    }
    if (url === "orders/ai-confirm") return ok(confirmResponse(body as AiConfirmRequest));
    return Promise.reject(new Error(`kutilmagan POST ${url}`));
  });
});

describe("AiCreatePanel — «Operator» tanlovi", () => {
  it("market: o'z ro'yxati (`market_id` siz); tanlangan operator `operator_id` + ismi bilan ketadi", async () => {
    const user = userEvent.setup();
    parseOrders = [order(1)];
    renderWithProviders(<AiCreatePanel active isMarketRole market={null} onSwitchToManual={vi.fn()} />, {
      preloadedState: marketState,
    });
    await parse(user, 1);

    const [card] = cards();
    expect(await operatorSelect(card)).toHaveTextContent("Tanlanmagan");
    expect(selectableCalls()).toEqual([[SELECTABLE, { params: undefined }]]);

    await pickOperator(user, card, "Bekzod Aliyev");
    expect(within(card).getByText("Buyurtma va komissiya shu operatorga yoziladi")).toBeInTheDocument();
    expect(within(card).queryByLabelText("Ro'yxatda yo'q operator")).not.toBeInTheDocument();

    await createAll(user, 1);
    expect(confirmCalls()[0].orders[0]).toMatchObject({ operator_id: "32", operator: "Bekzod Aliyev" });
  });

  it("AI o'qigan ism mos kelsa — faqat TAKLIF: tanlanmaguncha `operator_id` yuborilmaydi, «Tanlash» bilan bog'lanadi", async () => {
    const user = userEvent.setup();
    parseOrders = [order(1, { operator: "#sevinch" }), order(2, { operator: "Sevinch" })];
    renderWithProviders(<AiCreatePanel active isMarketRole market={null} onSwitchToManual={vi.fn()} />, {
      preloadedState: marketState,
    });
    await parse(user, 2);

    const [first] = cards();
    expect(await within(first).findByText("Ro'yxatda «Sevinch Karimova» bor — komissiya yozilishi uchun tanlang")).toBeInTheDocument();
    expect(await operatorSelect(first)).toHaveTextContent("Tanlanmagan");

    await user.click(within(first).getByRole("button", { name: "«Sevinch Karimova» ni operator qilib tanlash" }));
    expect(await operatorSelect(first)).toHaveTextContent("Sevinch Karimova");

    await createAll(user, 2);
    const [sent1, sent2] = confirmCalls()[0].orders;
    expect(sent1).toMatchObject({ operator_id: "31", operator: "Sevinch Karimova" });
    // Ikkinchisi tanlanmadi — 2026-11-21: ro'yxat bor bo'lsa AI o'qigan ism ham yuborilmaydi (operatorsiz).
    expect(sent2).not.toHaveProperty("operator");
    expect(sent2).not.toHaveProperty("operator_id");
  });

  it("bir nechta kartada mos ism — «Hammasini tanlash» bitta bosishda bog'laydi (mos kelmagani tegilmaydi)", async () => {
    const user = userEvent.setup();
    parseOrders = [
      order(1, { operator: "#sevinch" }),
      order(2, { operator: "bekzod aliyev" }),
      order(3, { operator: "Shahzoda" }),
    ];
    renderWithProviders(<AiCreatePanel active isMarketRole market={null} onSwitchToManual={vi.fn()} />, {
      preloadedState: marketState,
    });
    await parse(user, 3);

    const alert = (await screen.findByText("2 ta buyurtmada operator ismi ro'yxatdagi operatorga mos keladi")).closest(
      "[data-tone]",
    ) as HTMLElement;
    // Ro'yxatda yo'q ism — erkin matn maydoni YO'Q (2026-11-21), faqat AI nima o'qigani izohi.
    expect(within(cards()[2]).getByText("Xabarda «Shahzoda» deb yozilgan — operatorni ro'yxatdan tanlang")).toBeInTheDocument();
    expect(within(cards()[2]).queryByLabelText("Ro'yxatda yo'q operator")).not.toBeInTheDocument();

    await user.click(within(alert).getByRole("button", { name: "Hammasini tanlash" }));
    expect(screen.queryByText(/ta buyurtmada operator ismi/)).not.toBeInTheDocument();

    await createAll(user, 3);
    const sent = confirmCalls()[0].orders;
    expect(sent.map((o) => o.operator_id ?? null)).toEqual(["31", "32", null]);
    // Tanlanmagani — operatorsiz: «Shahzoda» matni yuborilmaydi.
    expect(sent[2]).not.toHaveProperty("operator");
  });

  it("xodim: tanlangan market ro'yxati (`market_id` bilan)", async () => {
    const user = userEvent.setup();
    parseOrders = [order(1)];
    renderWithProviders(
      <AiCreatePanel active isMarketRole={false} market={{ id: 3, name: "Baraka Shop" }} onSwitchToManual={vi.fn()} />,
      { preloadedState: adminState },
    );
    await parse(user, 1);

    await pickOperator(user, cards()[0], "Dilnoza Karimova");
    expect(selectableCalls()).toEqual([[SELECTABLE, { params: { market_id: "3" } }]]);

    await createAll(user, 1);
    expect(confirmCalls()[0]).toMatchObject({ market_id: "3", orders: [{ operator_id: "41" }] });
  });

  it("marketda operator yo'q yoki ro'yxat yuklanmasa — avvalgi erkin matn (xatoda izoh bilan), `operator_id` yo'q", async () => {
    const user = userEvent.setup();
    mocks.get.mockImplementation((url: string, config?: { params?: { market_id?: string } }) =>
      url === SELECTABLE ? Promise.reject({ response: { status: 500, data: { message: "Xato" } } }) : apiGet(url, config),
    );
    parseOrders = [order(1, { operator: "Kamola" })];
    renderWithProviders(<AiCreatePanel active isMarketRole market={null} onSwitchToManual={vi.fn()} />, {
      preloadedState: marketState,
    });
    await parse(user, 1);

    const [card] = cards();
    expect(await within(card).findByText("Operatorlar ro'yxati yuklanmadi — ismini qo'lda yozing")).toBeInTheDocument();
    expect(within(card).queryByRole("combobox", { name: "Operator" })).not.toBeInTheDocument();
    expect(within(card).getByLabelText("Operator")).toHaveValue("Kamola");

    await createAll(user, 1);
    expect(confirmCalls()[0].orders[0]).toMatchObject({ operator: "Kamola" });
    expect(confirmCalls()[0].orders[0]).not.toHaveProperty("operator_id");
  });

  it("market operatori — o'zgarmagan: o'zi, ro'yxat so'ralmaydi, `operator_id` yuborilmaydi", async () => {
    const user = userEvent.setup();
    parseOrders = [order(1, { operator: "#sevinch" })];
    renderWithProviders(
      <AiCreatePanel
        active
        isMarketRole
        market={null}
        areaLists={false}
        selfOperator={{ name: "Dilnoza Karimova" }}
      />,
      { preloadedState: { role: { id: "42", role: "market_operator", region: null, name: "Dilnoza Karimova" } } as never },
    );
    await parse(user, 1);

    const [card] = cards();
    expect(within(card).getByLabelText("Operator")).toHaveValue("Dilnoza Karimova");
    expect(within(card).queryByRole("combobox", { name: "Operator" })).not.toBeInTheDocument();
    expect(selectableCalls()).toHaveLength(0);

    await createAll(user, 1);
    expect(confirmCalls()[0].orders[0]).not.toHaveProperty("operator_id");
    expect(confirmCalls()[0].orders[0]).not.toHaveProperty("operator");
  });

  it("backend operatorni rad etsa — karta sabab bilan qoladi, ro'yxat yangilanadi va eskirgan tanlov tushadi", async () => {
    const user = userEvent.setup();
    parseOrders = [order(1)];
    confirmResponse = () => ({
      results: [
        {
          index: 0,
          ok: false,
          code: "create_failed",
          reason: "Tanlangan operator bu marketga tegishli emas yoki faol emas",
          reason_code: "CHOSEN_OPERATOR_NOT_SELECTABLE",
        },
      ],
    });
    renderWithProviders(<AiCreatePanel active isMarketRole market={null} onSwitchToManual={vi.fn()} />, {
      preloadedState: marketState,
    });
    await parse(user, 1);
    await pickOperator(user, cards()[0], "Bekzod Aliyev");
    // Shu orada operator o'chirildi.
    operatorsByMarket.own = [{ id: "31", name: "Sevinch Karimova" }];

    await createAll(user, 1);

    const [card] = cards();
    expect(
      await within(card).findByText(/Tanlangan operator bu marketga tegishli emas yoki faol emas/),
    ).toBeInTheDocument();
    await waitFor(() => expect(selectableCalls().length).toBeGreaterThan(1));
    await waitFor(async () => expect(await operatorSelect(card)).toHaveTextContent("Tanlanmagan"));
  });
});
