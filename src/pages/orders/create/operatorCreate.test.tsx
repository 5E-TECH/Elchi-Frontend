import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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
 * MO-3 — market operatori `/new-orders/create` da: faqat «AI bilan» (maket `market_operator-new-orders-create-manual`,
 * AI qismi; holatlar `market-new-orders-create-ai-*`). Qo'lda forma, «Qo'lda · AI bilan» tanlovi, market tanlash,
 * «Yangi buyurtmalar» yon kartasi va viloyat/tuman ro'yxatlari yo'q — ularning backend yo'llari operatorga 403.
 */

const operatorState = {
  role: { id: "42", role: "market_operator", region: null, name: "Dilnoza Karimova" },
} as never;

let parseOrders: AiPreviewOrder[];
let parseResponse: () => unknown;

const confirmCalls = () =>
  mocks.post.mock.calls.filter(([url]) => url === "orders/ai-confirm").map(([, body]) => body as AiConfirmRequest);
const parseCalls = () => mocks.post.mock.calls.filter(([url]) => url === "orders/ai-parse");
const getUrls = () => mocks.get.mock.calls.map(([url]) => String(url));

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
    return Promise.reject(new Error(`kutilmagan POST ${url}`));
  });
});

describe("OrderCreate — market operatori (MO-3)", () => {
  it("darhol AI paneli: tanlov, qo'lda forma, market qadami va yon karta yo'q; orqaga — «Buyurtmalar»", async () => {
    renderWithProviders(<OrderCreate />, { preloadedState: operatorState });

    expect(screen.getByRole("heading", { level: 1, name: "Yangi buyurtma" })).toBeInTheDocument();
    expect(screen.getByText("Buyurtmalar marketingiz nomidan AI bilan yaratiladi")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Buyurtma matni" })).toBeInTheDocument();
    expect(screen.getByTestId("ai-mode-panel")).not.toHaveClass("hidden");

    expect(screen.queryByTestId("create-mode-tabs")).not.toBeInTheDocument();
    expect(screen.queryByTestId("manual-mode-panel")).not.toBeInTheDocument();
    expect(screen.queryByText(/Avval marketni tanlang/)).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Yangi buyurtmalar" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Buyurtmalar/ })).toHaveAttribute("href", "/orders");

    await waitFor(() => expect(getUrls()).toContain("orders/ai-availability"));
    // Operatorga yopiq yo'llar so'ralmaydi (global 403 xabari chiqmasin).
    expect(getUrls().filter((url) => url === "region" || /^region\/|^orders\/markets\/|^markets/.test(url))).toEqual([]);
  });

  it("AI aniqlagan tuman bilan karta tayyor (viloyat maydoni yo'q); market_id yuborilmaydi, katalog — my-products", async () => {
    parseOrders = [aiPreview({ region_id: null, region_name: null, region_given: false })];
    renderWithProviders(<OrderCreate />, { preloadedState: operatorState });
    await analyse();

    const card = await screen.findByTestId("ai-preview-card");
    expect(within(card).queryByText("Viloyat")).not.toBeInTheDocument();
    expect(card).toHaveAttribute("data-ready", "true");

    const parseBody = parseCalls()[0][1] as FormData;
    expect(parseBody.has("market_id")).toBe(false);

    fireEvent.click(within(screen.getByTestId("ai-confirm-bar")).getByRole("button", { name: "Tayyorlarini yaratish — 1 ta" }));
    await waitFor(() => expect(confirmCalls()).toHaveLength(1));
    expect(confirmCalls()[0]).not.toHaveProperty("market_id");
    expect(confirmCalls()[0].orders[0].district_id).toBe("101");

    expect(getUrls().some((url) => url.startsWith("product/my-products"))).toBe(true);
    expect(getUrls().filter((url) => url === "region" || url.startsWith("region/"))).toEqual([]);
  });

  it("tuman topilmagan va taklif yo'q — tuman maydoni o'chiq, «matnda tumanni yozing» izohi; karta tayyor emas", async () => {
    parseOrders = [aiPreview({ region_id: null, region_name: null, district_id: null, district_name: null })];
    renderWithProviders(<OrderCreate />, { preloadedState: operatorState });
    await analyse();

    const card = await screen.findByTestId("ai-preview-card");
    expect(card).toHaveAttribute("data-ready", "false");
    expect(within(card).getByText("Tuman aniqlanmadi — matnda tumanni yozib, qayta tahlil qiling.")).toBeInTheDocument();
  });

  it("AI o'chiq (`reason: disabled`) — «Qo'lda yaratish» tugmasi yo'q, kimga murojaat qilish aytiladi", async () => {
    parseResponse = () => ({ ok: false, reason: "disabled" });
    renderWithProviders(<OrderCreate />, { preloadedState: operatorState });
    await analyse();

    const block = await screen.findByTestId("ai-block");
    expect(block).toHaveTextContent("Bu market uchun AI yoqilmagan — market egasi yoki administratorga murojaat qiling.");
    expect(within(block).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("manual-mode-panel")).not.toBeInTheDocument();
  });

  it("AI rad etdi (`refused`) — «Matnni tahrirlash» (qo'lda emas)", async () => {
    parseResponse = () => ({ ok: false, reason: "refused" });
    renderWithProviders(<OrderCreate />, { preloadedState: operatorState });
    await analyse();

    expect(await screen.findByText("Matnni boshqacha yozib, qayta urinib ko'ring.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Matnni tahrirlash" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Qo'lda/ })).not.toBeInTheDocument();
  });

  it("ai-availability o'chiq — AI paneli o'rniga ogohlantirish, qo'lda forma chizilmaydi", async () => {
    mocks.get.mockImplementation((url: string) =>
      url === "orders/ai-availability"
        ? Promise.resolve({ data: { statusCode: 200, data: { enabled: false, state: "disabled" } } })
        : aiApiGet(url),
    );
    renderWithProviders(<OrderCreate />, { preloadedState: operatorState });

    expect(await screen.findByText("AI bilan yaratish hozir o'chiq")).toBeInTheDocument();
    expect(screen.getByText("Buyurtma yaratish uchun market egasi yoki administratorga murojaat qiling.")).toBeInTheDocument();
    expect(screen.queryByTestId("ai-mode-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("manual-mode-panel")).not.toBeInTheDocument();
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
