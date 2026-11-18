import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import uzUsers from "../../../locales/uz/users.json";
import ruUsers from "../../../locales/ru/users.json";
import enUsers from "../../../locales/en/users.json";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api: mocks }));

import { OperatorAccountSection } from "./OperatorAccountSection";

/**
 * B1te60bD — superadmin/admin market operatori hisobini KO'RADI (faqat o'qish): `GET finance/operators/:id/balance`,
 * `/payments`, `/earnings` (`limit`/`offset`). Market o'zi to'laydi va yozadi (F2qp6FtE) — yozish amali yo'q.
 */

const BALANCE = { statusCode: 200, message: "operator balance", data: { operator_id: "41", earned: 1286500, paid: 1100000, balance: 186500 } };
const OVERPAID = { statusCode: 200, message: "operator balance", data: { operator_id: "42", earned: 420000, paid: 450000, balance: -30000 } };

/** Backend `listOperatorPayments` qatori (entity + `status`; `operator_name` yo'q, `createdAt`). */
const paymentRow = (id: string, extra: Record<string, unknown>) => ({
  id,
  operator_id: "41",
  market_id: "1",
  paid_by_id: "7",
  amount: 300000,
  note: null,
  source: "market",
  affects_cashbox: false,
  paid_at: "2026-11-15",
  recorded_by_role: "market",
  cancelled_at: null,
  cancelled_by_role: null,
  cancel_reason: null,
  createdAt: "2026-11-15T09:30:00.000Z",
  updatedAt: "2026-11-15T09:30:00.000Z",
  isDeleted: false,
  status: "active",
  ...extra,
});

const PAYMENT_ROWS = [
  paymentRow("305", { note: "Noyabr, 1-qism" }),
  paymentRow("303", {
    amount: 200000,
    paid_at: "2026-11-08",
    note: "Xato summa",
    status: "cancelled",
    cancelled_at: "2026-11-08T12:00:00.000Z",
    cancel_reason: "Summa xato kiritildi",
  }),
  paymentRow("301", { amount: 800000, paid_at: "2026-10-01", note: "Sentabr", source: "elchi", affects_cashbox: true, market_id: null }),
  paymentRow("300", { amount: 100000, paid_at: "2026-09-01", note: null, source: "elchi", affects_cashbox: false, market_id: null }),
];

const paymentsPage = (rows: unknown[], total: number, offset = 0) => ({
  statusCode: 200,
  message: "operator payments",
  data: { rows, total, limit: 10, offset },
});

const EARNING_ROWS = [
  {
    id: "9001", operator_id: "41", order_id: "10241", market_id: "1", amount: 18000, commission_type: "percent",
    commission_value: 5, order_total_price: 360000, createdAt: "2026-11-16T08:52:00.000Z", isDeleted: false,
  },
  {
    id: "9000", operator_id: "41", order_id: "10238", market_id: "1", amount: 3000, commission_type: "fixed",
    commission_value: 3000, order_total_price: 500000, createdAt: "2026-11-15T06:20:00.000Z", isDeleted: false,
  },
];
const earningsPage = (rows: unknown[], total: number) => ({
  statusCode: 200,
  message: "operator earnings",
  data: { rows, total, limit: 10, offset: 0 },
});

type Responses = { balance?: unknown; payments?: (offset: number) => unknown; earnings?: unknown };

const mockApi = ({ balance = BALANCE, payments, earnings }: Responses = {}) => {
  mocks.get.mockImplementation((url: string, config?: { params?: { offset?: number } }) => {
    const reply = (value: unknown) => (value instanceof Error ? Promise.reject(value) : Promise.resolve({ data: value }));
    if (/^finance\/operators\/\d+\/balance$/.test(url)) return reply(balance);
    if (/^finance\/operators\/\d+\/payments$/.test(url)) {
      return reply(payments ? payments(config?.params?.offset ?? 0) : paymentsPage(PAYMENT_ROWS, PAYMENT_ROWS.length));
    }
    if (/^finance\/operators\/\d+\/earnings$/.test(url)) return reply(earnings ?? earningsPage(EARNING_ROWS, 82));
    return Promise.reject(new Error(`kutilmagan so'rov: ${url}`));
  });
};

const httpError = (status: number) =>
  Object.assign(new Error("Server xatosi"), { isAxiosError: true, response: { status, data: { message: "ichki xato" } } });

const renderSection = (operatorId = "41", marketName: string | null = "Baraka Shop") =>
  renderWithProviders(<OperatorAccountSection operatorId={operatorId} marketName={marketName} />, {
    route: `/all-users/${operatorId}`,
  });

const paymentsCard = () => screen.getByRole("heading", { level: 2, name: "To'lovlar" }).closest("section") as HTMLElement;
const earningsCard = () => screen.getByRole("heading", { level: 2, name: "Daromadlar" }).closest("section") as HTMLElement;

beforeEach(() => {
  for (const fn of Object.values(mocks)) fn.mockReset();
});

describe("OperatorAccountSection — «Hisob» (B1te60bD)", () => {
  it("Ishlab topdi · To'landi · Qoldiq: summalar, izohlar, market nomi; faqat shu operatorning GET so'rovlari", async () => {
    mockApi();
    renderSection();

    const account = screen.getByRole("region", { name: "Hisob" });
    expect(account).toHaveTextContent(
      "Operatorga «Baraka Shop» marketi o'zi to'laydi va yozib boradi — Elchi kassasiga ta'sir qilmaydi. Bu yerda faqat ko'rish mumkin.",
    );
    await waitFor(() => expect(account).toHaveTextContent("1 286 500"));
    expect(account).toHaveTextContent("Ishlab topdi");
    expect(account).toHaveTextContent("1 100 000");
    expect(account).toHaveTextContent("186 500");
    expect(account).toHaveTextContent("Ishlab topdi − to'landi");
    await waitFor(() => expect(account).toHaveTextContent("82 ta sotilgan buyurtmadan"));
    // Oxirgi bekor qilinmagan to'lov (birinchi qator).
    expect(account).toHaveTextContent("Oxirgisi: 15.11.2026");
    expect(account).not.toHaveTextContent("Ortiqcha to'langan");

    const calls = mocks.get.mock.calls.map(([url, config]) => [url, (config as { params?: unknown } | undefined)?.params ?? null]);
    expect(calls).toEqual(
      expect.arrayContaining([
        ["finance/operators/41/balance", null],
        ["finance/operators/41/payments", { limit: 10, offset: 0 }],
        ["finance/operators/41/earnings", { limit: 10, offset: 0 }],
      ]),
    );
    expect(new Set(calls.map(([url]) => url)).size).toBe(3);
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("manfiy qoldiq — «Ortiqcha to'langan» (market sahifasi bilan bir xil); market nomisiz — umumiy izoh", async () => {
    mockApi({ balance: OVERPAID, payments: () => paymentsPage([], 0), earnings: earningsPage([], 0) });
    renderSection("42", null);

    const account = screen.getByRole("region", { name: "Hisob" });
    await waitFor(() => expect(account).toHaveTextContent("30 000"));
    expect(account).toHaveTextContent("Ortiqcha to'langan");
    expect(account).toHaveTextContent("Operatorga market o'zi to'laydi va yozib boradi");
    await waitFor(() => expect(account).toHaveTextContent("Hali sotuv yo'q"));
    // «To'landi» > 0, lekin birinchi sahifada faol to'lov yo'q — «Hali to'lov yo'q» emas (review), umumiy izoh.
    expect(account).not.toHaveTextContent("Hali to'lov yo'q");
    expect(account).toHaveTextContent("Bekor qilinganlarsiz");
  });

  it("hisob xatosi — karta ichida «Qayta urinish», qayta so'raydi", async () => {
    let balanceCalls = 0;
    mocks.get.mockImplementation((url: string) => {
      if (url.endsWith("/balance")) {
        balanceCalls += 1;
        return balanceCalls === 1 ? Promise.reject(httpError(500)) : Promise.resolve({ data: BALANCE });
      }
      if (url.endsWith("/payments")) return Promise.resolve({ data: paymentsPage(PAYMENT_ROWS, 4) });
      return Promise.resolve({ data: earningsPage(EARNING_ROWS, 2) });
    });
    const user = userEvent.setup();
    renderSection();

    const account = screen.getByRole("region", { name: "Hisob" });
    const retry = await within(account).findByRole("button", { name: "Qayta urinish" });
    expect(account).not.toHaveTextContent("ichki xato");
    await user.click(retry);
    await waitFor(() => expect(account).toHaveTextContent("1 286 500"));
  });
});

describe("OperatorAccountSection — «To'lovlar» (faqat o'qish)", () => {
  it("sana, summa, kim yozdi (market · Elchi kassasidan · Elchi yozuvi), holat (bekor — sabab bilan), izoh; amal tugmasi yo'q", async () => {
    mockApi();
    renderSection();

    const card = paymentsCard();
    const table = await within(card).findByRole("table", { name: "To'lovlar" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(4);

    expect(rows[0]).toHaveTextContent("15.11.2026");
    expect(rows[0]).toHaveTextContent("300 000 so'm");
    expect(rows[0]).toHaveTextContent("Market");
    expect(rows[0]).toHaveTextContent("Yozilgan");
    expect(rows[0]).toHaveTextContent("Noyabr, 1-qism");

    expect(rows[1]).toHaveTextContent("Bekor qilingan");
    expect(rows[1]).toHaveTextContent("Sabab: Summa xato kiritildi");
    expect(within(rows[1]).getByText("200 000 so'm")).toHaveClass("line-through");

    expect(rows[2]).toHaveTextContent("Elchi kassasidan");
    expect(rows[2]).toHaveTextContent("Sentabr");
    expect(rows[3]).toHaveTextContent("Elchi yozuvi");
    expect(rows[3]).not.toHaveTextContent("Elchi kassasidan");

    // Kam yozuv — sahifalashsiz: «4 ta to'lov» + «Jami» (bekor qilinganlarsiz, `balance.paid`).
    await waitFor(() => expect(card).toHaveTextContent("Jami: 1 100 000 so'm"));
    expect(card).toHaveTextContent("4 ta to'lov");
    expect(within(card).queryByRole("navigation")).not.toBeInTheDocument();

    // Yozish / bekor qilish yo'q — sahifada umuman tugma yo'q (jadval qatorlari faqat matn).
    expect(screen.queryByRole("button", { name: /Bekor qilish|To'lov yozish/ })).not.toBeInTheDocument();
    expect(within(card).queryAllByRole("button")).toHaveLength(0);
  });

  it("ko'p yozuv — `Pagination`, keyingi sahifa `offset` bilan so'raladi", async () => {
    const pageRows = (offset: number) =>
      Array.from({ length: offset === 0 ? 10 : 3 }, (_, index) =>
        paymentRow(String(400 - offset - index), { note: `To'lov ${offset + index + 1}`, amount: 10000 }),
      );
    mockApi({ payments: (offset) => paymentsPage(pageRows(offset), 13, offset) });
    const user = userEvent.setup();
    renderSection();

    const card = paymentsCard();
    expect(await within(card).findAllByText("To'lov 1")).not.toHaveLength(0);
    expect(card).toHaveTextContent("1–10 / 13 ta to'lov");
    await user.click(within(card).getByRole("button", { name: "2" }));
    expect(await within(card).findAllByText("To'lov 11")).not.toHaveLength(0);
    expect(mocks.get).toHaveBeenCalledWith("finance/operators/41/payments", { params: { limit: 10, offset: 10 } });
    expect(card).toHaveTextContent("11–13 / 13 ta to'lov");
  });

  it("bo'sh — «Hali to'lov yozilmagan»", async () => {
    mockApi({ payments: () => paymentsPage([], 0) });
    renderSection();
    expect(await within(paymentsCard()).findByText("Hali to'lov yozilmagan")).toBeInTheDocument();
  });

  it("telefonda kartalar: izoh, sana, summa, kim yozdi va holat", async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("max-width: 767px"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;
    try {
      mockApi();
      renderSection();
      const card = paymentsCard();
      const list = await within(card).findByRole("list", { name: "To'lovlar" });
      expect(within(card).queryByRole("table")).not.toBeInTheDocument();
      const items = within(list).getAllByRole("listitem");
      expect(items).toHaveLength(4);
      expect(items[1]).toHaveTextContent("Xato summa");
      expect(items[1]).toHaveTextContent("08.11.2026");
      expect(items[1]).toHaveTextContent("Bekor qilingan");
      expect(items[2]).toHaveTextContent("Elchi kassasidan");
      expect(items[3]).toHaveTextContent("Izohsiz");
    } finally {
      window.matchMedia = original;
    }
  });
});

describe("OperatorAccountSection — «Daromadlar»", () => {
  it("buyurtma (havola), buyurtma summasi, stavka, daromad, sana", async () => {
    mockApi();
    renderSection();

    const card = earningsCard();
    const table = await within(card).findByRole("table", { name: "Daromadlar" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(within(rows[0]).getByRole("link", { name: "№10241" })).toHaveAttribute("href", "/orders/edit/10241");
    expect(rows[0]).toHaveTextContent("360 000 so'm");
    expect(rows[0]).toHaveTextContent("5%");
    expect(rows[0]).toHaveTextContent("+18 000 so'm");
    expect(rows[1]).toHaveTextContent("3 000 so'm");
    expect(rows[1]).toHaveTextContent("+3 000 so'm");
    // 82 ta — sahifalash.
    expect(card).toHaveTextContent("1–10 / 82 ta");
  });

  it("bo'sh — «Hali daromad yo'q»", async () => {
    mockApi({ earnings: earningsPage([], 0) });
    renderSection();
    expect(await within(earningsCard()).findByText("Hali daromad yo'q")).toBeInTheDocument();
  });
});

describe("OperatorAccountSection — matnlar uchala tilda", () => {
  it("uz/ru/en `operatorAccount` kalitlari bir xil", () => {
    const keys = (value: unknown, prefix = ""): string[] =>
      typeof value === "object" && value !== null
        ? Object.entries(value).flatMap(([key, inner]) => keys(inner, prefix ? `${prefix}.${key}` : key))
        : [prefix];
    const uz = keys(uzUsers.operatorAccount).sort();
    expect(keys(ruUsers.operatorAccount).sort()).toEqual(uz);
    expect(keys(enUsers.operatorAccount).sort()).toEqual(uz);
  });
});
