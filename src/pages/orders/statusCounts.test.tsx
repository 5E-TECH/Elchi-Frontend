import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import Orders from "./index";
import { renderWithProviders } from "../../test/test-utils";
import { api } from "../../shared/api/api";

/**
 * GaBIPi3Z — `/orders` holat tablari sonlari (`GET /orders/status-counts`, haqiqiy React Query, `api.get` soxta):
 * ro'yxat bilan bir xil filtrlar (holatsiz, sahifasiz), «Yangilash» bilan birga, tab almashsa qayta so'ralmaydi,
 * xatoda tablar sonsiz, 0 ham ko'rsatiladi.
 */

vi.mock("./list/OrderFilters", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./list/OrderFilters")>()),
  default: () => null,
}));

const row = (id: string, status: string) => ({
  id,
  status,
  total_price: 185000,
  to_be_paid: 185000,
  where_deliver: "address",
  created_at: "2026-10-15T08:00:00.000Z",
  market: { id: "37", name: "Baraka Shop" },
  customer: { id: `c${id}`, name: `Mijoz ${id}`, phone_number: "+998902146631" },
  district: { id: "1", name: "Chilonzor tumani" },
  items: [],
});

const COUNTS = {
  all: 1248,
  new: 32,
  received: 120,
  on_the_road: 86,
  waiting: 14,
  sold: 734,
  paid: 168,
  cancelled: 0,
  new_incoming: 7,
  by_status: {},
  search_truncated: false,
};

type Call = { url: string; params: Record<string, unknown> };
const server = { calls: [] as Call[], countsFail: false, counts: COUNTS as Record<string, unknown> };
let getSpy: MockInstance;

beforeEach(() => {
  server.calls = [];
  server.countsFail = false;
  server.counts = COUNTS;
  getSpy = vi.spyOn(api, "get").mockImplementation(async (url: string, config?: { params?: unknown }) => {
    server.calls.push({ url, params: { ...((config?.params as Record<string, unknown> | undefined) ?? {}) } });
    if (url === "orders") {
      return { data: { statusCode: 200, data: [row("10242", "waiting")], total: 1248, page: 1, limit: 10 } };
    }
    if (url === "orders/status-counts") {
      if (server.countsFail) throw Object.assign(new Error("500"), { isAxiosError: true, response: { status: 500 } });
      return { data: { statusCode: 200, data: server.counts } };
    }
    throw new Error(`kutilmagan so'rov: ${url}`);
  });
});

afterEach(() => {
  getSpy.mockRestore();
});

const stateOf = (role: string) => ({ role: { id: "1", role, region: null, name: role } }) as never;
const open = (route = "/orders", role = "admin") => renderWithProviders(<Orders />, { route, preloadedState: stateOf(role) });
const countCalls = () => server.calls.filter((call) => call.url === "orders/status-counts");
const tab = (name: RegExp) => screen.getByRole("tab", { name });

describe("Buyurtmalar — holat tablari sonlari (GaBIPi3Z)", () => {
  it("har tabda o'z soni (maket «Barchasi 1 248 · Yangi 32 …»); 0 ham ko'rsatiladi", async () => {
    open();
    await waitFor(() => expect(tab(/^Barchasi/)).toHaveTextContent("Barchasi 1 248"));
    expect(tab(/^Yangi/)).toHaveTextContent("Yangi 32");
    expect(tab(/^Qabul qilindi/)).toHaveTextContent("Qabul qilindi 120");
    expect(tab(/^Yo'lda/)).toHaveTextContent("Yo'lda 86");
    expect(tab(/^Kutilmoqda/)).toHaveTextContent("Kutilmoqda 14");
    expect(tab(/^Sotilgan/)).toHaveTextContent("Sotilgan 734");
    expect(tab(/^To'langan/)).toHaveTextContent("To'langan 168");
    expect(tab(/^Bekor qilingan/)).toHaveTextContent("Bekor qilingan 0");
  });

  it("filtrlar ro'yxat bilan bir xil, lekin holat / sahifa / saralash YUBORILMAYDI", async () => {
    open(
      "/orders?status=cancelled,cancelled%20(sent)&page=2&orderMarketId=37&orderRegionId=5&startDay=2026-10-01&endDay=2026-10-26&where_deliver=address&orderSortBy=createdAt&orderSortDir=desc",
    );
    await waitFor(() => expect(countCalls()).toHaveLength(1));
    const list = server.calls.find((call) => call.url === "orders")!;
    expect(list.params).toMatchObject({ status: ["cancelled", "cancelled (sent)"], market_id: "37" });
    expect(countCalls()[0].params).toEqual({
      market_id: "37",
      region_id: "5",
      start_day: "2026-10-01",
      end_day: "2026-10-26",
      where_deliver: "address",
    });
    await waitFor(() => expect(tab(/^Bekor qilingan/)).toHaveTextContent("Bekor qilingan 0"));
  });

  it("tab almashsa sonlar qayta so'ralmaydi (holat kalitga kirmaydi), ro'yxat esa so'raladi", async () => {
    const user = userEvent.setup();
    open();
    await waitFor(() => expect(tab(/^Yangi/)).toHaveTextContent("Yangi 32"));
    const listBefore = server.calls.filter((call) => call.url === "orders").length;
    await user.click(tab(/^Yangi/));
    await waitFor(() => expect(server.calls.filter((call) => call.url === "orders").length).toBe(listBefore + 1));
    expect(countCalls()).toHaveLength(1);
    expect(tab(/^Yangi/)).toHaveTextContent("Yangi 32");
  });

  it("«Yangilash» ro'yxat bilan birga sonlarni ham qayta so'raydi", async () => {
    const user = userEvent.setup();
    open();
    await waitFor(() => expect(tab(/^Barchasi/)).toHaveTextContent("Barchasi 1 248"));
    server.counts = { ...COUNTS, all: 1249, new: 33 };
    await user.click(screen.getAllByRole("button", { name: "Ro'yxatni yangilash" })[0]);
    await waitFor(() => expect(countCalls()).toHaveLength(2));
    await waitFor(() => expect(tab(/^Barchasi/)).toHaveTextContent("Barchasi 1 249"));
    expect(tab(/^Yangi/)).toHaveTextContent("Yangi 33");
  });

  it("sonlar so'rovi yiqilsa — tablar sonsiz (noto'g'ri son yo'q), global xato xabari yo'q", async () => {
    server.countsFail = true;
    open();
    await screen.findByText("Mijoz 10242");
    await waitFor(() => expect(countCalls().length).toBeGreaterThan(0));
    expect(tab(/^Barchasi/)).toHaveTextContent(/^Barchasi$/);
    expect(screen.queryByText(/Server javob bermadi/)).not.toBeInTheDocument();
  });

  it("market va menejer rollarida ham (o'z doirasi backendda) — market_id yuborilmaydi", async () => {
    open("/orders?orderMarketId=99", "market");
    await waitFor(() => expect(countCalls()).toHaveLength(1));
    expect(countCalls()[0].params).toEqual({});
    await waitFor(() => expect(tab(/^Barchasi/)).toHaveTextContent("Barchasi 1 248"));
  });
});
