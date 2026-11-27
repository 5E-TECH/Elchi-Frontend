import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RootState } from "../../app/config/store";
import { renderWithProviders } from "../../test/test-utils";
import CourierHoldPage from "./index";

/**
 * onXzDc5n — «Kuryerdagi buyurtmalar» (`/courier-hold`): uchta ro'yxat — «72 soatdan oshgan»
 * (`GET /orders?courier_hold=over_72`), «48 soatga yaqin» (`near_48`, ogohlantirish havolasi `?tab=near_48`) va
 * «Kuryerlar bo'yicha» (`GET orders/courier-hold/summary`; kuryer tanlansa — uning hamma ochiq buyurtmalari
 * `courier_hold=any&courier_id`). Soat belgisi `last_handover_at` dan; tab sonlari jamlamadan.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../shared/api/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../shared/api/api")>();
  return { ...original, api: { ...original.api, get: mocks.get } };
});

const SUMMARY_URL = "orders/courier-hold/summary";
const LIST_URL = "orders";
const HOUR = 60 * 60 * 1000;
const hoursAgo = (hours: number) => new Date(Date.now() - hours * HOUR - 60_000).toISOString();

const SUMMARY = {
  statusCode: 200,
  data: {
    couriers: [
      {
        courier_id: "26",
        total: 3,
        under_36: 1,
        near_48: 1,
        over_48: 0,
        over_72: 1,
        oldest_since: hoursAgo(98),
        oldest_hours: 98,
        cancelled_held: 0,
        courier: { id: "26", name: "Aziz Karimov", phone_number: "+998901112233" },
      },
      {
        courier_id: "27",
        total: 1,
        under_36: 0,
        near_48: 0,
        over_48: 1,
        over_72: 0,
        oldest_since: hoursAgo(50),
        oldest_hours: 50,
        cancelled_held: 1,
        courier: { id: "27", name: "Bobur Aliyev", phone_number: null },
      },
    ],
    totals: { couriers: 2, total: 4, under_36: 1, near_48: 1, over_48: 1, over_72: 1, cancelled_held: 1, oldest_hours: 98 },
  },
};

const order = (id: string, hours: number, extra: Record<string, unknown> = {}) => ({
  id,
  order_number: `EL-${100000 + Number(id)}`,
  status: "waiting",
  total_price: 150000,
  market_id: "37",
  customer_id: "5",
  region_id: "1",
  holder_type: "COURIER",
  holder_courier_id: "26",
  last_handover_at: hoursAgo(hours),
  market: { id: "37", name: "Baraka Shop" },
  customer: { id: "5", name: "Ali Valiyev", phone_number: "+998901234567" },
  courier: { id: "26", name: "Aziz Karimov" },
  district: { id: "3", name: "Chilonzor", region: { id: "1", name: "Toshkent" } },
  ...extra,
});

type ListParams = Record<string, unknown>;

const mockApi = (list: (params: ListParams) => unknown[] = () => [order("81", 98)]) =>
  mocks.get.mockImplementation((url: string, options?: { params?: ListParams }) => {
    if (url === SUMMARY_URL) return Promise.resolve({ data: SUMMARY });
    if (url === LIST_URL) {
      const rows = list(options?.params ?? {});
      return Promise.resolve({ data: { data: rows, total: rows.length, page: 1, limit: 25 } });
    }
    return Promise.resolve({ data: {} });
  });

const listCalls = () =>
  mocks.get.mock.calls.filter(([url]) => url === LIST_URL).map(([, options]) => (options as { params: ListParams }).params);

const signedInAs = (role: string): Partial<RootState> => ({ role: { id: "1", role, region: null, name: "Test" } });

const renderPage = (role: string, route = "/courier-hold") =>
  renderWithProviders(<CourierHoldPage />, { route, preloadedState: signedInAs(role) });

describe("«Kuryerdagi buyurtmalar» sahifasi (onXzDc5n)", () => {
  beforeEach(() => mocks.get.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("⭐ admin: sukut «72 soatdan oshgan» — `courier_hold=over_72`, tab sonlari jamlamadan, soat belgisi va kuryer", async () => {
    mockApi();
    renderPage("admin");

    const table = await screen.findByRole("table", { name: "Kuryerdagi buyurtmalar ro'yxati" });
    expect(listCalls()[0]).toEqual({ page: 1, limit: 25, courier_hold: "over_72" });

    const tabs = screen.getByRole("tablist", { name: "Ro'yxat turi" });
    await waitFor(() => expect(within(tabs).getByRole("tab", { name: /72 soatdan oshgan\s*1/ })).toBeInTheDocument());
    expect(within(tabs).getByRole("tab", { name: /48 soatga yaqin\s*1/ })).toBeInTheDocument();
    expect(within(tabs).getByRole("tab", { name: /Kuryerlar bo'yicha\s*2/ })).toBeInTheDocument();

    expect(within(table).getByRole("link", { name: "Buyurtma №EL-100081 ni ochish" })).toHaveAttribute(
      "href",
      "/orders/edit/81",
    );
    const badge = within(table).getByTestId("courier-hold-hours-81");
    expect(badge).toHaveTextContent("98 soat");
    expect(badge).toHaveAttribute("data-level", "over_72");
    expect(within(table).getByText("Aziz Karimov")).toBeInTheDocument();
    expect(within(table).getByText("Baraka Shop")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Buyurtmalar ro'yxatida ochish" })).toHaveAttribute(
      "href",
      "/orders?courier_hold=over_72",
    );
  });

  it("⭐ ogohlantirish havolasi `?tab=near_48` — «48 soatga yaqin» (`courier_hold=near_48`), belgi ogohlantirish rangida", async () => {
    mockApi(() => [order("82", 40)]);
    renderPage("courier", "/courier-hold?tab=near_48");

    const table = await screen.findByRole("table", { name: "Kuryerdagi buyurtmalar ro'yxati" });
    expect(listCalls()[0]).toEqual({ page: 1, limit: 25, courier_hold: "near_48" });
    expect(within(table).getByTestId("courier-hold-hours-82")).toHaveAttribute("data-level", "near");
    // Kuryerga o'z ismi ustuni va /orders havolasi kerak emas (uning /orders sahifasida bu filtr yo'q).
    expect(within(table).queryByRole("columnheader", { name: "Kuryer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Buyurtmalar ro'yxatida ochish" })).not.toBeInTheDocument();
  });

  it("⭐ «Kuryerlar bo'yicha»: jamlama jadvali (ro'yxat so'rovi yo'q); «Buyurtmalari» → o'sha kuryerdagi hamma ochiq buyurtmalar", async () => {
    mockApi((params) => (params.courier_id === "27" ? [order("90", 50, { holder_courier_id: "27", courier: { id: "27", name: "Bobur Aliyev" } })] : []));
    renderPage("manager", "/courier-hold?tab=couriers");

    const summary = await screen.findByRole("table", { name: "Kuryerlar bo'yicha jamlama" });
    expect(listCalls()).toHaveLength(0);
    const row = within(summary).getByText("Bobur Aliyev").closest("tr")!;
    expect(within(row).getByText("50 soat")).toBeInTheDocument();
    expect(within(summary).getByText("+998 90 111 22 33")).toBeInTheDocument();

    await userEvent.click(within(row).getByRole("button", { name: "Bobur Aliyev buyurtmalarini ochish" }));

    const table = await screen.findByRole("table", { name: "Kuryerdagi buyurtmalar ro'yxati" });
    expect(listCalls().at(-1)).toEqual({ page: 1, limit: 25, courier_hold: "any", courier_id: "27" });
    expect(screen.getByTestId("courier-hold-courier")).toHaveTextContent("Kuryer: Bobur Aliyev");
    expect(within(table).getByTestId("courier-hold-hours-90")).toHaveAttribute("data-level", "over_48");

    await userEvent.click(screen.getByRole("button", { name: "Barcha kuryerlar" }));
    expect(await screen.findByRole("table", { name: "Kuryerlar bo'yicha jamlama" })).toBeInTheDocument();
  });

  it("bo'sh ro'yxat — tabga mos bo'sh holat", async () => {
    mockApi(() => []);
    renderPage("market");
    expect(await screen.findByText("72 soatdan oshgan buyurtma yo'q")).toBeInTheDocument();
    // Market — market ustuni yo'q (o'zi), /orders havolasi bor.
    expect(screen.getByRole("link", { name: "Buyurtmalar ro'yxatida ochish" })).toBeInTheDocument();
  });
});
