import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import CourierOrders from "./index";
import { renderWithProviders } from "../../../../test/test-utils";
import { api } from "../../../../shared/api/api";

/**
 * TOZ-0 — kuryer «Buyurtmalar» tab sonlari va «Jami» (Trello 0d11ewk7, wtmkmJ8h):
 *  - d8757e: sotilgandan keyin «Kutilayotgan» soni darhol kamayadi (sotish `[orders]` ni, demak
 *    `COURIER_ORDER_COUNTS_QUERY_KEY` ni ham yangilaydi — 60 s kutilmaydi);
 *  - 5e77ed: 1 000+ sonlar `formatNumberLocalized` bilan guruhlanadi (390px — e2e `courier-counts.mobile.spec.ts`);
 *  - fb6aae: bo'sh ro'yxatda «Jami 0 ta buyurtma» («—» yoki skelet emas).
 */

const row = (id: string, name: string, status = "waiting") => ({
  id,
  status,
  total_price: 185000,
  to_be_paid: 185000,
  where_deliver: "address",
  created_at: "2026-10-15T08:00:00.000Z",
  market: { name: "Baraka Shop" },
  customer: { name, phone_number: "+998902146631" },
  district: { name: "Qibray tumani" },
  items: [],
  holder_type: "COURIER",
  holder_courier_id: "26",
});

const server = {
  rows: [] as ReturnType<typeof row>[],
  counts: { waiting: 7, all: 24, cancelled: 3 },
  calls: [] as string[],
  posts: [] as Array<{ url: string; body: unknown }>,
};

let getSpy: MockInstance;
let postSpy: MockInstance;

beforeEach(() => {
  server.rows = [row("10239", "Laylo Hasanova"), row("10238", "Javohir Toshmatov")];
  server.counts = { waiting: 7, all: 24, cancelled: 3 };
  server.calls = [];
  server.posts = [];
  getSpy = vi.spyOn(api, "get").mockImplementation(async (url: string) => {
    server.calls.push(url);
    if (url === "orders/courier/orders/counts") {
      return { data: { statusCode: 200, message: "Courier order counts", data: server.counts } };
    }
    if (url === "orders/courier/orders") {
      return { data: { statusCode: 200, data: server.rows, total: server.rows.length, page: 1, limit: 10 } };
    }
    throw new Error(`kutilmagan so'rov: ${url}`);
  });
  postSpy = vi.spyOn(api, "post").mockImplementation(async (url: string, body?: unknown) => {
    server.posts.push({ url, body });
    const sell = /^orders\/sell\/(\w+)$/.exec(url);
    if (!sell) throw new Error(`kutilmagan so'rov: POST ${url}`);
    // Backend kabi: sotilgan buyurtma «Kutilayotgan» dan chiqadi, sonlar ham shu zahoti o'zgaradi.
    server.rows = server.rows.filter((item) => item.id !== sell[1]);
    server.counts = { ...server.counts, waiting: server.counts.waiting - 1 };
    return { data: { statusCode: 200, message: "Order sold", data: { id: sell[1], status: "sold" } } };
  });
});

afterEach(() => {
  getSpy.mockRestore();
  postSpy.mockRestore();
});

const courierState = { role: { id: "26", role: "courier", region: null, name: "Kuryer" } } as never;
const open = (route = "/orders?status=waiting") =>
  renderWithProviders(<CourierOrders />, { route, preloadedState: courierState });

const tabTexts = () =>
  within(screen.getByRole("tablist", { name: "Holat bo'yicha" }))
    .getAllByRole("tab")
    .map((tab) => tab.textContent);

const countCalls = () => server.calls.filter((url) => url === "orders/courier/orders/counts").length;

describe("Kuryer tab sonlari — sotishdan keyin (0d11ewk7 d8757e)", () => {
  it("sotilgandan keyin «Kutilayotgan» soni darhol kamayadi: counts qayta so'raladi, 7 → 6", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByText("Laylo Hasanova");
    await waitFor(() => expect(tabTexts()).toEqual(["Kutilayotgan 7", "Barchasi 24", "Bekor qilingan 3"]));
    expect(countCalls()).toBe(1);

    await user.click(screen.getByRole("button", { name: "№10239 ni sotish" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^Sotish$/ }));

    await waitFor(() => expect(server.posts.map((post) => post.url)).toEqual(["orders/sell/10239"]));
    // Avtomatik yangilanish (60 s) kutilmaydi — sotish muvaffaqiyatidan keyin sonlar shu zahoti qayta so'raladi.
    await waitFor(() => expect(countCalls()).toBe(2));
    await waitFor(() => expect(tabTexts()).toEqual(["Kutilayotgan 6", "Barchasi 24", "Bekor qilingan 3"]));
    await waitFor(() => expect(screen.queryByText("Laylo Hasanova")).not.toBeInTheDocument());
  });
});

describe("Kuryer tab sonlari — 1 000+ (0d11ewk7 5e77ed)", () => {
  it("katta sonlar xonalarga ajratilib chiziladi (uz — bo'shliq), qisqartmasiz", async () => {
    server.counts = { waiting: 1234, all: 128450, cancelled: 1056 };
    open();
    await screen.findByText("Laylo Hasanova");
    await waitFor(() =>
      expect(tabTexts().map((text) => text?.replace(/\s/g, " "))).toEqual([
        "Kutilayotgan 1 234",
        "Barchasi 128 450",
        "Bekor qilingan 1 056",
      ]),
    );
    // «1.2k» kabi qisqartma yo'q (ega qarorisiz qo'shilmaydi).
    expect(tabTexts().join(" ")).not.toMatch(/\dk\b/i);
  });
});

describe("Kuryer «Jami N ta buyurtma» — bo'sh ro'yxat (wtmkmJ8h fb6aae)", () => {
  it("«Kutilayotgan» bo'sh: sarlavhada «Jami 0 ta buyurtma» (skelet yoki «—» emas)", async () => {
    server.rows = [];
    server.counts = { waiting: 0, all: 0, cancelled: 0 };
    open();
    expect(await screen.findByText("Jami 0 ta buyurtma")).toBeInTheDocument();
    expect(screen.getByText("Buyurtmalar mavjud emas")).toBeInTheDocument();
  });

  it("«Bekor qilingan» bo'sh: ham «Jami 0 ta buyurtma»", async () => {
    server.rows = [];
    server.counts = { waiting: 0, all: 0, cancelled: 0 };
    open("/orders?status=cancelled");
    expect(await screen.findByText("Jami 0 ta buyurtma")).toBeInTheDocument();
  });
});
