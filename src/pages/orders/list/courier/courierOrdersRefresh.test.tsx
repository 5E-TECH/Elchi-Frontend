import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import CourierOrders from "./index";
import { renderWithProviders } from "../../../../test/test-utils";
import { api } from "../../../../shared/api/api";
import { COURIER_ORDER_COUNTS_QUERY_KEY, parseCourierOrderCounts } from "../../../../entities/orders";

/**
 * OR-1 — kuryer «Buyurtmalar»: tab sonlari (`GET orders/courier/orders/counts`), «Yangilash» (ro'yxat + sonlar),
 * «Yangilanmoqda…» (400 ms dan keyin, sonlar xira), «Ro'yxat yangilanmadi» (tab sonlari bilan matn), yangilanishdan
 * keyin tanlov ko'rinadigan qatorlarga qisqaradi.
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

type Deferred = { promise: Promise<void>; resolve: () => void };
const deferred = (): Deferred => {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const server = {
  rows: [row("10239", "Laylo Hasanova"), row("10238", "Javohir Toshmatov")],
  counts: { waiting: 7, all: 24, cancelled: 3 } as Record<string, number>,
  fail: false,
  hold: null as Deferred | null,
  calls: [] as string[],
};

let getSpy: MockInstance;

beforeEach(() => {
  server.rows = [row("10239", "Laylo Hasanova"), row("10238", "Javohir Toshmatov")];
  server.counts = { waiting: 7, all: 24, cancelled: 3 };
  server.fail = false;
  server.hold = null;
  server.calls = [];
  getSpy = vi.spyOn(api, "get").mockImplementation(async (url: string) => {
    server.calls.push(url);
    if (server.hold) await server.hold.promise;
    if (server.fail) {
      throw Object.assign(new Error("500"), { isAxiosError: true, response: { status: 500, data: { message: "raw" } } });
    }
    if (url === "orders/courier/orders/counts") {
      return { data: { statusCode: 200, message: "Courier order counts", data: server.counts } };
    }
    if (url === "orders/courier/orders") {
      return { data: { statusCode: 200, data: server.rows, total: server.rows.length, page: 1, limit: 10 } };
    }
    throw new Error(`kutilmagan so'rov: ${url}`);
  });
});

afterEach(() => {
  server.hold?.resolve();
  getSpy.mockRestore();
});

const courierState = { role: { id: "26", role: "courier", region: null, name: "Kuryer" } } as never;
const open = (route = "/orders?status=waiting") =>
  renderWithProviders(<CourierOrders />, { route, preloadedState: courierState });

/** Desktop ghost «Yangilash» (telefondagi ikonka tugma bilan bir nom; DOM'da ikkinchi). */
const refreshButton = () => screen.getAllByRole("button", { name: "Ro'yxatni yangilash" }).at(-1)!;

const calls = (url: string) => server.calls.filter((item) => item === url).length;

describe("parseCourierOrderCounts", () => {
  it("{ data: { waiting, all, cancelled } } → sonlar; boshqa shakl — null", () => {
    expect(parseCourierOrderCounts({ data: { waiting: 12, all: 340, cancelled: 3 } })).toEqual({
      waiting: 12,
      all: 340,
      cancelled: 3,
    });
    expect(parseCourierOrderCounts({ data: { waiting: "2", all: 5, cancelled: 0 } })).toEqual({
      waiting: 2,
      all: 5,
      cancelled: 0,
    });
    expect(parseCourierOrderCounts({ data: [] })).toBeNull();
    expect(parseCourierOrderCounts({ data: { waiting: 1 } })).toBeNull();
    expect(parseCourierOrderCounts(null)).toBeNull();
    expect(COURIER_ORDER_COUNTS_QUERY_KEY).toEqual(["orders", "courier", "counts"]);
  });
});

describe("Kuryer buyurtmalari — yangilanish va tab sonlari (OR-1)", () => {
  it("tab sonlari counts endpointidan: Kutilayotgan 7 · Barchasi 24 · Bekor qilingan 3", async () => {
    open();
    const list = await screen.findByRole("tablist", { name: "Holat bo'yicha" });
    await waitFor(() =>
      expect(within(list).getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
        "Kutilayotgan 7",
        "Barchasi 24",
        "Bekor qilingan 3",
      ]),
    );
    expect(await screen.findByText("Jami 2 ta buyurtma")).toBeInTheDocument();
    expect(screen.getByText("Avtomatik yangilanadi")).toBeInTheDocument();
    expect(document.querySelector("header time")).toHaveTextContent(/^\d{2}:\d{2}$/);
  });

  it("sonlar kelmasa (xato yoki boshqa shakl) — tablar sonsiz", async () => {
    server.counts = {};
    open();
    await screen.findByText("Laylo Hasanova");
    const list = screen.getByRole("tablist", { name: "Holat bo'yicha" });
    expect(within(list).getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Kutilayotgan",
      "Barchasi",
      "Bekor qilingan",
    ]);
  });

  it("«Yangilash» ro'yxat va tab sonlarini birga so'raydi; 400 ms dan uzoq bo'lsa «Yangilanmoqda…», sonlar xira", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByText("Laylo Hasanova");
    await waitFor(() => expect(calls("orders/courier/orders/counts")).toBe(1));
    const listBefore = calls("orders/courier/orders");

    server.hold = deferred();
    server.counts = { waiting: 8, all: 25, cancelled: 3 };
    await user.click(refreshButton());
    await waitFor(() => expect(calls("orders/courier/orders")).toBe(listBefore + 1));
    expect(calls("orders/courier/orders/counts")).toBe(2);

    expect(await screen.findByText("Yangilanmoqda…", undefined, { timeout: 1500 })).toBeInTheDocument();
    const busyCount = within(screen.getByRole("tab", { name: /Kutilayotgan/ })).getByText("7");
    expect(busyCount).toHaveAttribute("aria-busy", "true");
    for (const button of screen.getAllByRole("button", { name: "Ro'yxat yangilanmoqda" })) {
      expect(button).toHaveAttribute("aria-busy", "true");
    }

    server.hold.resolve();
    server.hold = null;
    await waitFor(() => expect(screen.queryByText("Yangilanmoqda…")).not.toBeInTheDocument());
    expect(await screen.findByRole("tab", { name: "Kutilayotgan 8" })).toBeInTheDocument();
  });

  it("yangilash yiqilsa: «Ro'yxat va tab sonlari eskirgan bo'lishi mumkin.», qatorlar qoladi, × yopadi", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByText("Laylo Hasanova");
    server.fail = true;
    await user.click(refreshButton());
    const alert = (await screen.findByText("Ro'yxat yangilanmadi")).closest('[role="status"]') as HTMLElement;
    expect(alert).toHaveTextContent("Ro'yxat va tab sonlari eskirgan bo'lishi mumkin.");
    expect(screen.getByText("Laylo Hasanova")).toBeInTheDocument();
    // Sonlar eskisi qoladi (yordamchi so'rov xatosi jim).
    expect(screen.getByRole("tab", { name: "Kutilayotgan 7" })).toBeInTheDocument();

    await user.click(within(alert).getByRole("button", { name: "Ogohlantirishni yopish" }));
    expect(screen.queryByText("Ro'yxat yangilanmadi")).not.toBeInTheDocument();
  });

  it("bekor qilinganlar tabi: yangilanishdan keyin ro'yxatdan chiqqan buyurtma tanlovdan ham chiqadi", async () => {
    const user = userEvent.setup();
    server.rows = [row("10301", "Feruza Mirzayeva", "cancelled"), row("10302", "Ali Valiyev", "cancelled")];
    open("/orders?status=cancelled");
    await screen.findByText("Feruza Mirzayeva");
    await user.click(screen.getByRole("checkbox", { name: /Feruza Mirzayeva|10301/ }));
    await user.click(screen.getByRole("checkbox", { name: /Ali Valiyev|10302/ }));
    expect(await screen.findByText("2 / 2 ta buyurtma tanlandi")).toBeInTheDocument();

    server.rows = [row("10302", "Ali Valiyev", "cancelled")];
    await user.click(refreshButton());
    await waitFor(() => expect(screen.queryByText("Feruza Mirzayeva")).not.toBeInTheDocument());
    expect(await screen.findByText("1 / 1 ta buyurtma tanlandi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1 ta buyurtmani pochtaga yuborish/ })).toBeInTheDocument();

    // Qaytib kelgan buyurtma jimgina «tanlangan» bo'lib chiqmaydi — tanlov qisqargan edi.
    server.rows = [row("10301", "Feruza Mirzayeva", "cancelled"), row("10302", "Ali Valiyev", "cancelled")];
    await user.click(refreshButton());
    expect(await screen.findByText("Feruza Mirzayeva")).toBeInTheDocument();
    expect(await screen.findByText("1 / 2 ta buyurtma tanlandi")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Feruza Mirzayeva|10301/ })).not.toBeChecked();
  });
});
