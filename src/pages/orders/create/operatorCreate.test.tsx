import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { aiApiGet, aiPreview } from "../../../test/aiOrderFixtures";
import type { AiConfirmRequest, AiPreviewOrder } from "../../../entities/ai-order";

const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { post: mocks.post, get: mocks.get, patch: vi.fn(), delete: vi.fn() },
}));

import OrderCreate from "./index";

/**
 * MO-3 / MO-7 (OfRSoRUX) — market operatori `/new-orders/create` da: «Qo'lda · AI bilan» (maket
 * `market_operator-new-orders-create-manual`; AI holatlari `market-new-orders-create-ai-*`). Backend 6cb2340:
 * `POST /orders` va `GET /region`, `/district` operatorga ochiq; `market_id` tokendan, `operator` — operatorning o'zi.
 * Market qadami yo'q. «Yangi buyurtmalar» yon kartasi — operator marketi bo'yicha (nCAFnqIe / N12, MO-8:
 * `GET orders/markets/:marketId/new` operatorga o'z marketi uchun ochiq); havolalar — `/orders/edit/:id`, `/orders?status=new`.
 */

const operatorState = {
  role: { id: "42", role: "market_operator", region: null, name: "Dilnoza Karimova" },
  user: {
    user: { id: "42", role: "market_operator", name: "Dilnoza Karimova", market: { id: "37", name: "Baraka Shop", add_order: true } },
    isAuthenticated: true,
    accessToken: null,
    loading: false,
    isAppInitializing: false,
    error: null,
  },
} as never;

let parseOrders: AiPreviewOrder[];
let parseResponse: () => unknown;

const confirmCalls = () =>
  mocks.post.mock.calls.filter(([url]) => url === "orders/ai-confirm").map(([, body]) => body as AiConfirmRequest);
const orderPosts = () => mocks.post.mock.calls.filter(([url]) => url === "orders");
const parseCalls = () => mocks.post.mock.calls.filter(([url]) => url === "orders/ai-parse");
const getUrls = () => mocks.get.mock.calls.map(([url]) => String(url));

/** v2 `Select` (qidiruvli combobox): ochiladi va portaldagi ro'yxatdan variant tanlanadi. */
const pickOption = async (user: ReturnType<typeof userEvent.setup>, comboboxId: string, option: string) => {
  const combobox = document.getElementById(comboboxId) as HTMLElement;
  await waitFor(() => expect(combobox).toBeEnabled());
  await user.click(combobox);
  await user.click(await screen.findByRole("option", { name: option }));
};

const openAi = () => fireEvent.click(within(screen.getByTestId("create-mode-tabs")).getByRole("radio", { name: /AI bilan/ }));

const analyse = async () => {
  fireEvent.change(screen.getByRole("textbox", { name: "Buyurtma matni" }), { target: { value: "Vali 90 123 45 67" } });
  fireEvent.click(screen.getByRole("button", { name: "Tahlil qilish" }));
  await waitFor(() => expect(parseCalls()).toHaveLength(1));
};

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  parseOrders = [];
  parseResponse = () => ({ ok: true, orders: parseOrders });
  mocks.get.mockReset();
  mocks.get.mockImplementation(aiApiGet);
  mocks.post.mockReset();
  mocks.post.mockImplementation((url: string, body: unknown) => {
    if (url === "orders/ai-parse") return Promise.resolve({ data: { statusCode: 200, data: parseResponse() } });
    if (url === "orders/ai-confirm") {
      const request = body as AiConfirmRequest;
      return Promise.resolve({
        data: { statusCode: 200, data: { results: request.orders.map((_, index) => ({ index, ok: true, order_id: "901" })) } },
      });
    }
    if (url === "orders") return Promise.resolve({ data: { statusCode: 201, data: { id: "905" } } });
    return Promise.reject(new Error(`kutilmagan POST ${url}`));
  });
});

describe("OrderCreate — market operatori (MO-3, MO-7)", () => {
  it("sukut — «Qo'lda», «Qo'lda · AI bilan» tablari; sarlavhada «Baraka Shop nomidan»; market qadami yo'q", async () => {
    renderWithProviders(<OrderCreate />, { preloadedState: operatorState });

    expect(screen.getByRole("heading", { level: 1, name: "Yangi buyurtma" })).toBeInTheDocument();
    expect(screen.getByText("Baraka Shop nomidan")).toBeInTheDocument();
    expect(screen.getByTestId("create-mode-tabs")).toBeInTheDocument();
    expect(screen.getByTestId("manual-mode-panel")).not.toHaveClass("hidden");
    expect(screen.queryByText(/Avval marketni tanlang/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Buyurtmalar/ })).toHaveAttribute("href", "/orders");

    // Viloyat ro'yxati operatorga ochiq (N11); boshqa market yo'llari (`markets*`) so'ralmaydi, faqat o'z marketi
    // yangi buyurtmalari (N12).
    await waitFor(() => expect(getUrls()).toContain("region"));
    await waitFor(() =>
      expect(getUrls().filter((url) => /^orders\/markets\/|^markets/.test(url))).toEqual(["orders/markets/37/new"]),
    );
  });

  it("⭐ nCAFnqIe (N12): «Yangi buyurtmalar» — o'z marketi bugungilari, qator → /orders/edit/:id, telefonda → /orders?status=new", async () => {
    const today = new Date().toISOString();
    mocks.get.mockImplementation((url: string) =>
      url === "orders/markets/37/new"
        ? Promise.resolve({
            data: {
              statusCode: 200,
              data: [
                {
                  id: "10247",
                  status: "new",
                  where_deliver: "address",
                  total_price: 185000,
                  createdAt: today,
                  customer: { id: "c1", name: "Sevara Tojiboyeva", district: { id: "1", name: "Yunusobod tumani" } },
                },
                // Kechagi (sana filtri yo'q — backend barcha yangilarni beradi): «bugun» kartasiga kirmaydi.
                { id: "10101", status: "new", where_deliver: "center", total_price: 90000, createdAt: "2026-01-02T08:00:00.000Z", customer: { id: "c2", name: "Bekzod Aliyev" } },
              ],
            },
          })
        : aiApiGet(url),
    );
    renderWithProviders(<OrderCreate />, { preloadedState: operatorState });

    const card = await screen.findByRole("region", { name: "Yangi buyurtmalar" });
    expect(card).toHaveTextContent("Baraka Shop · bugun");
    const row = await within(card).findByRole("link", { name: /Sevara Tojiboyeva/ });
    expect(within(card).getByText("Jami 1 ta")).toBeInTheDocument();
    expect(row).toHaveAttribute("href", "/orders/edit/10247");
    expect(row).toHaveTextContent("№10247 · Yunusobod tumani");
    expect(within(card).queryByText("Bekzod Aliyev")).not.toBeInTheDocument();
    // Telefon (maket `el-show-mobile`): havola-karta — «Buyurtmalar» ning «Yangi» tabiga («Qabul va yaratish» yopiq).
    expect(screen.getByRole("link", { name: "Bugungi yangi buyurtmalar, 1 ta" })).toHaveAttribute("href", "/orders?status=new");
    expect(screen.getByRole("link", { name: "Bugungi yangi buyurtmalar, 1 ta" })).toHaveTextContent("Baraka Shop · bugun · 1 ta");
    expect(getUrls().filter((url) => url.startsWith("orders/markets/"))).toEqual(["orders/markets/37/new"]);
  });

  it("nCAFnqIe: profildagi `market_id` ustun; marketga biriktirilmagan operator — karta ham, so'rov ham yo'q", async () => {
    const withMarketId = {
      ...(operatorState as Record<string, unknown>),
      user: {
        ...(operatorState as { user: Record<string, unknown> }).user,
        user: { id: "42", role: "market_operator", name: "Dilnoza Karimova", market_id: 7 },
      },
    } as never;
    const { unmount } = renderWithProviders(<OrderCreate />, { preloadedState: withMarketId });
    // Nomsiz market: «— · bugun» emas — «Bugun».
    const card = await screen.findByRole("region", { name: "Yangi buyurtmalar" });
    expect(within(card).getByText("Bugun")).toBeInTheDocument();
    await waitFor(() => expect(getUrls()).toContain("orders/markets/7/new"));
    unmount();

    mocks.get.mockClear();
    const unassigned = {
      ...(operatorState as Record<string, unknown>),
      user: {
        ...(operatorState as { user: Record<string, unknown> }).user,
        user: { id: "42", role: "market_operator", name: "Dilnoza Karimova", market_id: null },
      },
    } as never;
    renderWithProviders(<OrderCreate />, { preloadedState: unassigned });
    await waitFor(() => expect(getUrls()).toContain("region"));
    expect(screen.queryByRole("region", { name: "Yangi buyurtmalar" })).not.toBeInTheDocument();
    expect(getUrls().filter((url) => url.startsWith("orders/markets/"))).toEqual([]);
  });

  it("xulosada «Operator» — o'zi, faqat o'qish («Siz — avtomatik yoziladi»)", async () => {
    renderWithProviders(<OrderCreate />, { preloadedState: operatorState });

    const aside = await screen.findByRole("complementary", { name: "Buyurtma xulosasi" });
    const field = within(aside).getByRole("textbox", { name: "Operator" });
    expect(field).toHaveValue("Dilnoza Karimova");
    expect(field).toHaveAttribute("readonly");
    expect(within(aside).getByText("Siz — avtomatik yoziladi")).toBeInTheDocument();
  });

  it("qo'lda yaratish — POST /orders: market_id va operator yo'q, Idempotency-Key bilan; katalog — my-products", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: operatorState });

    await user.type(screen.getByRole("combobox", { name: /^Telefon/ }), "901234567");
    await user.type(screen.getByLabelText(/^Mijoz ismi/), "Aliyev Vali");
    await pickOption(user, "customer.region_id", "Toshkent shahri • 1726");
    await pickOption(user, "customer.district_id", "Chilonzor • 1726269");
    await user.click(await screen.findByRole("button", { name: /Telefon ushlagich/ }));
    await user.clear(screen.getByLabelText(/^Umumiy summa/));
    await user.type(screen.getByLabelText(/^Umumiy summa/), "150000");
    await user.click(
      within(screen.getByRole("complementary", { name: "Buyurtma xulosasi" })).getByRole("button", { name: "Buyurtma yaratish" }),
    );

    await waitFor(() => expect(orderPosts()).toHaveLength(1));
    const [, body, config] = orderPosts()[0] as [string, Record<string, unknown>, { headers?: Record<string, string> }];
    expect(body).not.toHaveProperty("market_id");
    expect(body).not.toHaveProperty("operator");
    expect(body).toMatchObject({ district_id: "101", total_price: 150000 });
    expect(config?.headers?.["Idempotency-Key"]).toEqual(expect.any(String));
    expect(getUrls().some((url) => url.startsWith("product/my-products"))).toBe(true);
  });

  it("AI bilan: market_id yuborilmaydi, Operator maydoni — o'zi; AI o'qigan operator matni yuborilmaydi", async () => {
    parseOrders = [aiPreview({ operator: "sevinch" })];
    renderWithProviders(<OrderCreate />, { preloadedState: operatorState });
    openAi();
    await analyse();

    const card = await screen.findByTestId("ai-preview-card");
    const field = within(card).getByRole("textbox", { name: "Operator" });
    expect(field).toHaveValue("Dilnoza Karimova");
    expect(field).toHaveAttribute("readonly");
    expect(within(card).queryByDisplayValue("sevinch")).not.toBeInTheDocument();
    const parseBody = parseCalls()[0][1] as FormData;
    expect(parseBody.has("market_id")).toBe(false);

    fireEvent.click(within(screen.getByTestId("ai-confirm-bar")).getByRole("button", { name: "Tayyorlarini yaratish — 1 ta" }));
    await waitFor(() => expect(confirmCalls()).toHaveLength(1));
    expect(confirmCalls()[0]).not.toHaveProperty("market_id");
    expect(confirmCalls()[0].orders[0]).not.toHaveProperty("operator");
  });

  it("AI o'chiq (ai-availability) — tablar yo'q, qo'lda forma ochiq (ogohlantirishsiz)", async () => {
    mocks.get.mockImplementation((url: string) =>
      url === "orders/ai-availability"
        ? Promise.resolve({ data: { statusCode: 200, data: { enabled: false, state: "disabled" } } })
        : aiApiGet(url),
    );
    renderWithProviders(<OrderCreate />, { preloadedState: operatorState });

    await waitFor(() => expect(screen.queryByTestId("create-mode-tabs")).not.toBeInTheDocument());
    expect(screen.getByTestId("manual-mode-panel")).not.toHaveClass("hidden");
    expect(screen.queryByTestId("ai-mode-panel")).not.toBeInTheDocument();
    expect(screen.queryByText("AI bilan yaratish hozir o'chiq")).not.toBeInTheDocument();
  });

  it("market nomi profilda bo'lmasa — umumiy izoh", () => {
    const noMarket = {
      ...(operatorState as Record<string, unknown>),
      user: { ...(operatorState as { user: Record<string, unknown> }).user, user: { id: "42", role: "market_operator", name: "Dilnoza Karimova" } },
    } as never;
    renderWithProviders(<OrderCreate />, { preloadedState: noMarket });
    expect(screen.getByText("Buyurtmalar siz ishlaydigan market nomidan yaratiladi")).toBeInTheDocument();
  });
});
