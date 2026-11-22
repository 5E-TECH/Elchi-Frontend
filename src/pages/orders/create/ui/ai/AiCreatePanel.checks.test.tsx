import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../../test/test-utils";
import { aiApiGet, aiPreview } from "../../../../../test/aiOrderFixtures";

const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));

vi.mock("../../../../../shared/api/api", () => ({ api: { post: mocks.post, get: mocks.get } }));

import type { AiConfirmRequest, AiPreviewOrder } from "../../../../../entities/ai-order";
import AiCreatePanel from "./AiCreatePanel";

/**
 * AI ACK — TASDIQ VA DARVOZA XATOLARI (backend #649/#658; maket `*-create-ai-preview-checks`).
 *
 * Bloklovchi ogohlantirishli karta operator tasdiqlamaguncha yuborilmaydi; tasdiqlangan kod `orders[].ack_checks`
 * bo'lib ketadi. Gateway darvozasi (409/503/400) butun so'rovni rad etadi — hech narsa yaratilmagan, kartalar
 * belgilanadi va qayta yuborish mumkin.
 */

const marketState = { role: { id: "7", role: "market", region: null, name: "Test market" } } as never;

const order = (i: number, overrides: Partial<AiPreviewOrder> = {}) =>
  aiPreview({
    customer_name: `Mijoz ${i}`,
    phone_number: `+99890${String(1000000 + i).slice(-7)}`,
    total_price: 100000 + i * 1000,
    index: i - 1,
    ...overrides,
  });

let parseOrders: AiPreviewOrder[];
let confirmHandler: (request: AiConfirmRequest) => Promise<unknown>;

const confirmCalls = () =>
  mocks.post.mock.calls.filter(([url]) => url === "orders/ai-confirm").map(([, body]) => body as AiConfirmRequest);

const ok = (request: AiConfirmRequest) =>
  Promise.resolve({
    data: { statusCode: 200, data: { results: request.orders.map((_, index) => ({ index, ok: true, order_id: `9${index}` })) } },
  });

/** Gateway xato konverti (`public-error-fields.ts`): `{ statusCode, message, code, … }`. */
const gatewayError = (status: number, body: Record<string, unknown>, headers: Record<string, string> = {}) =>
  Promise.reject(
    new AxiosError(`Request failed with status code ${status}`, "ERR_BAD_REQUEST", {} as InternalAxiosRequestConfig, null, {
      status,
      statusText: "",
      data: { statusCode: status, message: "server matni", ...body },
      headers: new AxiosHeaders(headers),
      config: {} as InternalAxiosRequestConfig,
    }),
  );

const renderPanel = () =>
  renderWithProviders(<AiCreatePanel active isMarketRole market={null} onSwitchToManual={vi.fn()} />, {
    preloadedState: marketState,
  });

const parse = async (expectedCards: number) => {
  fireEvent.change(screen.getByRole("textbox", { name: "Buyurtma matni" }), { target: { value: "buyurtmalar matni" } });
  fireEvent.click(screen.getByRole("button", { name: /Tahlil qilish|Qayta tahlil qil/ }));
  await waitFor(() => expect(screen.getAllByTestId("ai-preview-card")).toHaveLength(expectedCards));
};

const bar = () => screen.getByTestId("ai-confirm-bar");
const cards = () => screen.getAllByTestId("ai-preview-card");

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  parseOrders = [];
  confirmHandler = ok;
  mocks.get.mockReset();
  mocks.get.mockImplementation(aiApiGet);
  mocks.post.mockReset();
  mocks.post.mockImplementation((url: string, body: unknown) => {
    if (url === "orders/ai-parse") {
      return Promise.resolve({ data: { statusCode: 200, data: { ok: true, draft_id: "draft-1", orders: parseOrders } } });
    }
    if (url === "orders/ai-confirm") return confirmHandler(body as AiConfirmRequest);
    return Promise.reject(new Error(`kutilmagan POST ${url}`));
  });
});

describe("AiCreatePanel — AI tekshiruvlari va tasdiq", () => {
  it("tuman tasdiq kutayotgan karta yuborilmaydi; belgilansa `ack_checks` bilan ketadi", async () => {
    parseOrders = [order(1), order(2, { checks: [{ code: "district_low_confidence" }] })];
    renderPanel();
    await parse(2);

    expect(bar()).toHaveTextContent("1 ta tayyor · 1 ta karta tasdiq kutmoqda");
    expect(within(bar()).getByRole("button", { name: "Tasdiq kutmoqda (1)" })).toBeInTheDocument();
    expect(within(bar()).queryByRole("button", { name: /To'ldirilmagan/ })).toBeNull();

    fireEvent.click(within(cards()[1]).getByRole("checkbox", { name: "Tuman to'g'ri, tasdiqlayman" }));
    expect(bar()).toHaveTextContent("2 ta tayyor");
    fireEvent.click(within(bar()).getByRole("button", { name: "Tayyorlarini yaratish — 2 ta" }));

    await waitFor(() => expect(confirmCalls()).toHaveLength(1));
    const [first, second] = confirmCalls()[0].orders;
    expect(first).not.toHaveProperty("ack_checks");
    expect(second.ack_checks).toEqual(["district_low_confidence"]);
    // FRONTEND holati serverga ketmaydi (gateway forbidNonWhitelisted).
    for (const key of ["checks", "acked_checks", "server_required_acks", "district_match", "region_inferred"]) {
      expect(second).not.toHaveProperty(key);
    }
  });

  it("409 CHECKS_NOT_ACKNOWLEDGED: hech narsa yaratilmadi — kartada majburiy tasdiq, belgilab qayta yuborilsa ack ketadi", async () => {
    parseOrders = [order(1)];
    confirmHandler = () =>
      gatewayError(409, {
        code: "CHECKS_NOT_ACKNOWLEDGED",
        missing: ["price_check"],
        orders: [{ index: 0, missing: ["price_check"] }],
      });
    renderPanel();
    await parse(1);

    fireEvent.click(within(bar()).getByRole("button", { name: "Tayyorlarini yaratish — 1 ta" }));

    expect(await screen.findByText(/Hech qaysi buyurtma yaratilmadi: 1 ta kartada tuman yoki summa tasdiqlanmagan/)).toBeInTheDocument();
    expect(cards()).toHaveLength(1);
    expect(cards()[0]).toHaveAttribute("data-ready", "false");
    expect(within(cards()[0]).getByText("Server tasdiq so'radi — ogohlantirishni tekshirib, belgilang")).toBeInTheDocument();
    expect(within(screen.getByTestId("ai-issues")).getByText("Narx matnga mos emas — tasdiqlang")).toBeInTheDocument();

    confirmHandler = ok;
    fireEvent.click(within(cards()[0]).getByRole("checkbox", { name: "Narx to'g'ri, tasdiqlayman" }));
    fireEvent.click(within(bar()).getByRole("button", { name: "Tayyorlarini yaratish — 1 ta" }));

    await waitFor(() => expect(confirmCalls()).toHaveLength(2));
    expect(confirmCalls()[1].orders[0].ack_checks).toEqual(["price_check"]);
    await waitFor(() => expect(screen.queryAllByTestId("ai-preview-card")).toHaveLength(0));
  });

  it("503 AI_CHECKS_UNAVAILABLE: hech narsa yaratilmagan, «N soniyadan keyin» — «Natija noma'lum» EMAS", async () => {
    parseOrders = [order(1)];
    confirmHandler = () =>
      gatewayError(503, { code: "AI_CHECKS_UNAVAILABLE", retryable: true, retry_after_seconds: 7 }, { "retry-after": "7" });
    renderPanel();
    await parse(1);

    fireEvent.click(within(bar()).getByRole("button", { name: "Tayyorlarini yaratish — 1 ta" }));

    expect(await screen.findByText(/hech narsa yaratilmadi\. 7 soniyadan keyin qayta urinib ko'ring/)).toBeInTheDocument();
    expect(screen.queryByText(/Natija noma'lum/)).toBeNull();
    // Karta tayyor holicha — qayta yuborish xavfsiz.
    expect(within(bar()).getByRole("button", { name: "Tayyorlarini yaratish — 1 ta" })).toBeEnabled();
  });

  it("400 AI_DRAFT_NOT_FOUND: `indexes` dagi karta belgilanadi — «AI natijasi topilmadi»", async () => {
    parseOrders = [order(1), order(2)];
    confirmHandler = () => gatewayError(400, { code: "AI_DRAFT_NOT_FOUND", indexes: [1] });
    renderPanel();
    await parse(2);

    fireEvent.click(within(bar()).getByRole("button", { name: "Tayyorlarini yaratish — 2 ta" }));

    await waitFor(() =>
      expect(within(cards()[1]).getByText(/AI natijasi topilmadi — matnni AI bilan qayta tahlil qiling/)).toBeInTheDocument(),
    );
    expect(within(cards()[0]).queryByText(/AI natijasi topilmadi/)).toBeNull();
    expect(cards()).toHaveLength(2);
  });

  it("`same_phone_multi`: karta raqami bilan; ikkinchi karta olib tashlansa eslatma yo'qoladi", async () => {
    const phone = "+998901112233";
    parseOrders = [
      order(1, { phone_number: phone, checks: [{ code: "same_phone_multi", other_index: 1 }] }),
      order(2, { phone_number: phone, checks: [{ code: "same_phone_multi", other_index: 0 }] }),
    ];
    renderPanel();
    await parse(2);

    expect(within(cards()[0]).getByText("Shu raqam #2 kartada ham bor")).toBeInTheDocument();
    expect(within(cards()[1]).getByText("Shu raqam #1 kartada ham bor")).toBeInTheDocument();

    fireEvent.click(within(cards()[1]).getByRole("button", { name: "Bu buyurtmani tashlab yuborish" }));

    expect(within(cards()[0]).queryByText(/Shu raqam/)).toBeNull();
    expect(within(cards()[0]).queryByTestId("ai-notes-count")).toBeNull();
  });
});
