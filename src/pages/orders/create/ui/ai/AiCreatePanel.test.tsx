import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../../test/test-utils";
import { aiApiGet, aiPreview } from "../../../../../test/aiOrderFixtures";

const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));

vi.mock("../../../../../shared/api/api", () => ({ api: { post: mocks.post, get: mocks.get } }));

import type { AiConfirmRequest, AiPreviewOrder } from "../../../../../entities/ai-order";
import AiCreatePanel from "./AiCreatePanel";

/**
 * AI BUYURTMA — TASDIQLASH, YARATISH, QISMAN NATIJA (yDLrGAz8).
 */

const marketState = { role: { id: "7", role: "market", region: null, name: "Test market" } } as never;

/** `i`-buyurtma: telefon va narx har xil, ya'ni imzolari ham har xil. */
const order = (i: number, overrides: Partial<AiPreviewOrder> = {}) =>
  aiPreview({
    customer_name: `Mijoz ${i}`,
    phone_number: `+99890${String(1000000 + i).slice(-7)}`,
    total_price: 100000 + i * 1000,
    ...overrides,
  });

let parseOrders: AiPreviewOrder[];
let confirmResponse: (request: AiConfirmRequest) => unknown;

const confirmCalls = () =>
  mocks.post.mock.calls.filter(([url]) => url === "orders/ai-confirm").map(([, body]) => body as AiConfirmRequest);

const renderPanel = () =>
  renderWithProviders(<AiCreatePanel active isMarketRole market={null} onSwitchToManual={vi.fn()} />, {
    preloadedState: marketState,
  });

const parse = async (expectedCards: number) => {
  fireEvent.change(screen.getByLabelText("Buyurtma matni"), { target: { value: "buyurtmalar matni" } });
  fireEvent.click(screen.getByRole("button", { name: /Tahlil qilish|Qayta tahlil qil/ }));
  if (expectedCards > 0) {
    await waitFor(() => expect(screen.getAllByTestId("ai-preview-card")).toHaveLength(expectedCards));
  }
};

const reparse = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Matnni tahrirlash" }));
  fireEvent.click(screen.getByRole("button", { name: /Tahlil qilish/ }));
};

const allResultsOk = (request: AiConfirmRequest) => ({
  results: request.orders.map((_, index) => ({ index, ok: true, order_id: String(900 + index) })),
});

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  parseOrders = [];
  confirmResponse = allResultsOk;
  mocks.get.mockReset();
  mocks.get.mockImplementation(aiApiGet);
  mocks.post.mockReset();
  mocks.post.mockImplementation((url: string, body: unknown) => {
    if (url === "orders/ai-parse") {
      return Promise.resolve({ data: { statusCode: 200, data: { ok: true, orders: parseOrders } } });
    }
    if (url === "orders/ai-confirm") {
      return Promise.resolve({ data: { statusCode: 200, data: confirmResponse(body as AiConfirmRequest) } });
    }
    return Promise.reject(new Error(`kutilmagan POST ${url}`));
  });
});

describe("AiCreatePanel", () => {
  it("`ready` bo'lmagan kartalar yaratishga umuman yuborilmaydi; tugmadagi N jonli yangilanadi", async () => {
    parseOrders = [order(1), order(2), order(3, { district_id: null, district_name: null })];
    renderPanel();
    await parse(3);

    const bar = screen.getByTestId("ai-confirm-bar");
    expect(bar).toHaveTextContent("2 ta tayyor · 1 ta to'ldirilmagan");
    expect(within(bar).getByRole("button", { name: "Tayyorlarini yaratish (2)" })).toBeEnabled();

    // Bitta tayyor kartani tashlab yuborish — N darhol kamayadi.
    fireEvent.click(within(screen.getAllByTestId("ai-preview-card")[0]).getByRole("button", { name: "Bu buyurtmani tashlab yuborish" }));
    expect(within(bar).getByRole("button", { name: "Tayyorlarini yaratish (1)" })).toBeInTheDocument();

    fireEvent.click(within(bar).getByRole("button", { name: "Tayyorlarini yaratish (1)" }));

    await waitFor(() => expect(confirmCalls()).toHaveLength(1));
    expect(confirmCalls()[0].orders.map((o) => o.customer.name)).toEqual(["Mijoz 2"]);
  });

  it("tayyor karta bo'lmasa tugma disabled (\"Hammasini yaratish\" yo'q)", async () => {
    parseOrders = [order(1, { total_price: null })];
    renderPanel();
    await parse(1);

    expect(screen.getByRole("button", { name: "Tayyorlarini yaratish (0)" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Hammasini/ })).not.toBeInTheDocument();
  });

  it("5 dan ortiq buyurtmada tasdiq oynasi chiqadi va ichida ism/tuman/narx ro'yxati bor", async () => {
    parseOrders = Array.from({ length: 6 }, (_, i) => order(i + 1));
    renderPanel();
    await parse(6);

    fireEvent.click(screen.getByRole("button", { name: "Tayyorlarini yaratish (6)" }));

    expect(screen.getByText("6 ta buyurtma yaratiladi. Tuman va narxlarni tekshirdingizmi?")).toBeInTheDocument();
    const list = screen.getByTestId("ai-confirm-list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(6);
    expect(list).toHaveTextContent("Mijoz 1—Chilonzor—101 000");
    expect(confirmCalls()).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Ha, yaratish" }));
    await waitFor(() => expect(confirmCalls()).toHaveLength(1));
  });

  it("10 tadan 7 tasi muvaffaqiyatli: 7 tasi \"Yaratildi\" ro'yxatiga o'tadi, 3 tasi xato matni bilan kartada qoladi", async () => {
    parseOrders = Array.from({ length: 10 }, (_, i) => order(i + 1));
    const failedIndexes = new Set([1, 4, 8]);
    confirmResponse = (request) => ({
      results: request.orders.map((_, index) =>
        failedIndexes.has(index)
          ? { index, ok: false, reason: "tuman topilmadi" }
          : { index, ok: true, order_id: String(900 + index) },
      ),
    });
    renderPanel();
    await parse(10);

    fireEvent.click(screen.getByRole("button", { name: "Tayyorlarini yaratish (10)" }));
    fireEvent.click(screen.getByRole("button", { name: "Ha, yaratish" }));

    expect(await screen.findByText("7 ta yaratildi · 3 ta xato")).toBeInTheDocument();
    expect(within(screen.getByTestId("ai-created-list")).getAllByRole("listitem")).toHaveLength(7);
    const remaining = screen.getAllByTestId("ai-preview-card");
    expect(remaining).toHaveLength(3);
    remaining.forEach((card) => expect(within(card).getByText("tuman topilmadi")).toBeInTheDocument());
    expect(remaining.map((card) => (within(card).getByLabelText("Ism") as HTMLInputElement).value)).toEqual([
      "Mijoz 2",
      "Mijoz 5",
      "Mijoz 9",
    ]);
  });

  it("xato kartadagi maydonni tuzatib qayta yuborish mumkin", async () => {
    parseOrders = [order(1)];
    confirmResponse = () => ({ results: [{ index: 0, ok: false, reason: "telefon noto'g'ri" }] });
    renderPanel();
    await parse(1);
    fireEvent.click(screen.getByRole("button", { name: "Bu kartani yaratish" }));
    expect(await screen.findByText("telefon noto'g'ri")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Ism"), { target: { value: "Aliyev Vali" } });
    expect(screen.queryByText("telefon noto'g'ri")).not.toBeInTheDocument();
    confirmResponse = allResultsOk;
    fireEvent.click(screen.getByRole("button", { name: "Bu kartani yaratish" }));

    await waitFor(() => expect(confirmCalls()).toHaveLength(2));
    expect(confirmCalls()[1].orders[0].customer.name).toBe("Aliyev Vali");
    await waitFor(() => expect(screen.queryAllByTestId("ai-preview-card")).toHaveLength(0));
  });

  it("yaratilgan buyurtma qayta tahlilda preview'ga qo'shilmaydi va \"o'tkazib yuborildi\" xabari chiqadi", async () => {
    parseOrders = [order(1), order(2)];
    renderPanel();
    await parse(2);
    fireEvent.click(screen.getByRole("button", { name: "Tayyorlarini yaratish (2)" }));
    await waitFor(() => expect(screen.queryAllByTestId("ai-preview-card")).toHaveLength(0));

    parseOrders = [order(1), order(2), order(3)];
    await reparse();

    expect(await screen.findByText("2 ta allaqachon yaratilgan buyurtma o'tkazib yuborildi.")).toBeInTheDocument();
    expect(screen.getAllByTestId("ai-preview-card")).toHaveLength(1);
    expect((screen.getByLabelText("Ism") as HTMLInputElement).value).toBe("Mijoz 3");
  });

  it("so'rov davomida tugma disabled — ikki marta bosish ikkita POST yubormaydi", async () => {
    parseOrders = [order(1)];
    let resolveConfirm!: (value: unknown) => void;
    mocks.post.mockImplementation((url: string) =>
      url === "orders/ai-parse"
        ? Promise.resolve({ data: { data: { ok: true, orders: parseOrders } } })
        : new Promise((resolve) => (resolveConfirm = resolve)),
    );
    renderPanel();
    await parse(1);

    const button = screen.getByRole("button", { name: "Tayyorlarini yaratish (1)" });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByRole("button", { name: "Yaratilmoqda..." })).toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "Yaratilmoqda..." }));
    expect(confirmCalls()).toHaveLength(1);
    resolveConfirm({ data: { data: { results: [{ index: 0, ok: true, order_id: "900" }] } } });
    await waitFor(() => expect(screen.getByTestId("ai-created-list")).toBeInTheDocument());
  });

  it("har yuborishda yangi `request_id` generatsiya qilinadi va payloadga kiradi", async () => {
    parseOrders = [order(1), order(2)];
    renderPanel();
    await parse(2);

    const cards = screen.getAllByTestId("ai-preview-card");
    fireEvent.click(within(cards[0]).getByRole("button", { name: "Bu kartani yaratish" }));
    await waitFor(() => expect(confirmCalls()).toHaveLength(1));
    await waitFor(() => expect(screen.getAllByTestId("ai-preview-card")).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Bu kartani yaratish" }));
    await waitFor(() => expect(confirmCalls()).toHaveLength(2));

    const [first, second] = confirmCalls().map((request) => request.request_id);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(second).toMatch(/^[0-9a-f-]{36}$/);
    expect(first).not.toBe(second);
  });

  it("market roli uchun `market_id` yuborilmaydi; status/region_id yo'q", async () => {
    parseOrders = [order(1)];
    renderPanel();
    await parse(1);

    fireEvent.click(screen.getByRole("button", { name: "Tayyorlarini yaratish (1)" }));

    await waitFor(() => expect(confirmCalls()).toHaveLength(1));
    const request = confirmCalls()[0];
    expect(request).not.toHaveProperty("market_id");
    expect(request.orders[0]).not.toHaveProperty("status");
    expect(request.orders[0]).not.toHaveProperty("region_id");
  });

  it("timeout holatida AVTOMATIK qayta yuborish yo'q, aniq tushuntirish chiqadi", async () => {
    parseOrders = [order(1)];
    mocks.post.mockImplementation((url: string) =>
      url === "orders/ai-parse"
        ? Promise.resolve({ data: { data: { ok: true, orders: parseOrders } } })
        : Promise.reject(
            new AxiosError("timeout of 90000ms exceeded", "ECONNABORTED", {} as InternalAxiosRequestConfig),
          ),
    );
    renderPanel();
    await parse(1);

    fireEvent.click(screen.getByRole("button", { name: "Tayyorlarini yaratish (1)" }));

    expect(await screen.findByText(/Natija noma'lum/)).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(confirmCalls()).toHaveLength(1);
    // Karta joyida qoladi — operator ro'yxatni tekshirib, o'zi qaror qiladi.
    expect(screen.getAllByTestId("ai-preview-card")).toHaveLength(1);
  });

  it("muvaffaqiyatdan keyin `orders` va `dashboard` querylar invalidate bo'ladi", async () => {
    parseOrders = [order(1)];
    const { queryClient } = renderPanel();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    await parse(1);

    fireEvent.click(screen.getByRole("button", { name: "Tayyorlarini yaratish (1)" }));

    await waitFor(() =>
      expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual(
        expect.arrayContaining([["orders"], ["dashboard"]]),
      ),
    );
  });

  it("tasdiqlanmagan `ready` kartalar borida sahifadan chiqishda ogohlantirish chiqadi", async () => {
    parseOrders = [order(1)];
    renderPanel();
    await parse(1);

    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const link = document.createElement("a");
    link.href = "/orders";
    document.body.appendChild(link);
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(click);

    expect(confirmSpy).toHaveBeenCalledWith("Tasdiqlanmagan buyurtmalar bor. Sahifadan chiqsangiz ular yo'qoladi. Chiqasizmi?");
    expect(click.defaultPrevented).toBe(true);
    link.remove();
    confirmSpy.mockRestore();
  });

  it("hamma karta yaratilgach chiqish ogohlantirishi olib tashlanadi", async () => {
    parseOrders = [order(1)];
    renderPanel();
    await parse(1);
    fireEvent.click(screen.getByRole("button", { name: "Tayyorlarini yaratish (1)" }));
    await waitFor(() => expect(screen.queryAllByTestId("ai-preview-card")).toHaveLength(0));

    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
  });

  it("parse natijasi bo'sh bo'lsa xato emas, \"buyurtma topilmadi\" xabari", async () => {
    parseOrders = [];
    renderPanel();
    await parse(0);

    expect(await screen.findByText("Matnda buyurtma topilmadi.")).toBeInTheDocument();
  });

  it("parse javobidagi `draft_id` har buyurtma bilan ai-confirm ga qaytadi (lYVuADRE #18)", async () => {
    parseOrders = [order(1), order(2)];
    mocks.post.mockImplementation((url: string, body: unknown) => {
      if (url === "orders/ai-parse") {
        return Promise.resolve({
          data: { data: { ok: true, orders: parseOrders, draft_id: "3f0c2a52-8a5b-4c6e-9d0e-1b2c3d4e5f60" } },
        });
      }
      return Promise.resolve({ data: { data: allResultsOk(body as AiConfirmRequest) } });
    });
    renderPanel();
    await parse(2);

    fireEvent.click(screen.getByRole("button", { name: "Tayyorlarini yaratish (2)" }));

    await waitFor(() => expect(confirmCalls()).toHaveLength(1));
    expect(confirmCalls()[0].orders.map((o) => o.draft_id)).toEqual([
      "3f0c2a52-8a5b-4c6e-9d0e-1b2c3d4e5f60",
      "3f0c2a52-8a5b-4c6e-9d0e-1b2c3d4e5f60",
    ]);
  });
});
