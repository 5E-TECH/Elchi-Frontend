import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeShiftHistory } from "../../../entities/payments/shiftHistory";
import { renderWithProviders } from "../../../test/test-utils";
import MainCashbox from "./mainCashbox";

/**
 * «Smenalar tarixi» (ega 2026-11-25: smena hisobotini UI'dan topib bo'lmasdi) — «Asosiy kassa» sarlavhasidan ochiladi,
 * har qator `/payments/shifts/:id` ga havola. Haqiqiy react-query, faqat HTTP qatlami almashtirilgan.
 */

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: http,
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));
vi.mock("./lib/exportMainCashboxReport", () => ({ exportMainCashboxReport: vi.fn() }));
vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetUser: () => ({ data: undefined, isLoading: false }),
    useGetUserById: () => ({ data: undefined, isLoading: false }),
    useGetManagers: () => ({ data: undefined, isLoading: false }),
    useGetCouriers: () => ({ data: undefined, isLoading: false }),
  }),
}));
vi.mock("../../../entities/markets", () => ({
  useMarkets: () => ({ useGetMarkets: () => ({ data: undefined, isLoading: false }) }),
}));
vi.mock("../../../entities/branch/api/useBranches", () => ({
  useBranches: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("./SalaryPaymentPopup", () => ({ default: () => null }));
vi.mock("./MainCashboxBalanceChart", () => ({ default: () => null }));

const stateFor = (role: string) => ({ role: { id: "1", role, region: null, name: "Ali Valiyev" } }) as never;

const SHIFTS = [
  {
    id: "17",
    status: "open",
    opened_at: "2026-11-25T04:00:00.000Z",
    closed_at: null,
    opened_by_name: "Vali Aliyev",
    closed_by_name: null,
    close_reason: null,
  },
  {
    id: 16,
    status: "closed",
    opened_at: "2026-11-24T12:53:02.017Z",
    closed_at: "2026-11-24T22:41:08.917Z",
    opened_by_name: "Ali Valiyev",
    closed_by_name: "Ali Valiyev",
    close_reason: "manual",
  },
  {
    id: "15",
    status: "closed",
    opened_at: "2026-11-23T04:00:00.000Z",
    closed_at: "2026-11-23T18:00:00.000Z",
    opened_by_name: "Vali Aliyev",
    closed_by_name: null,
    close_reason: "auto",
  },
];

const server = { total: 3, fail: false, items: SHIFTS as unknown[] };
const historyCalls = () => http.get.mock.calls.filter(([url]) => url === "finance/shift");

beforeEach(() => {
  Object.assign(server, { total: 3, fail: false, items: SHIFTS });
  http.get.mockReset();
  http.get.mockImplementation(async (url: string) => {
    if (url === "finance/shift") {
      if (server.fail) throw Object.assign(new Error("500"), { response: { status: 500, data: {} } });
      return { data: { statusCode: 200, data: { items: server.items, pagination: { total: server.total, page: 1, limit: 10 } } } };
    }
    if (url === "finance/shift/current") return { data: { statusCode: 200, data: { shift: null, required: true } } };
    return { data: { statusCode: 200, data: {} } };
  });
});
afterEach(() => vi.clearAllMocks());

const openHistory = async (role = "superadmin") => {
  const user = userEvent.setup();
  renderWithProviders(<MainCashbox />, { route: "/payments/main-cashbox", preloadedState: stateFor(role) });
  const button = await screen.findByRole("button", { name: "Smenalar tarixi" });
  // Oyna ochilmaguncha so'rov ketmaydi.
  expect(historyCalls()).toHaveLength(0);
  await user.click(button);
  return { user, dialog: await screen.findByRole("dialog", { name: "Smenalar tarixi" }) };
};

describe("«Smenalar tarixi» — smena hisobotiga kirish", () => {
  // Vaqtlar Toshkent mintaqasida (vitest sozlamasi).
  it("superadmin: asosiy kassa smenalari, har biri hisobotga havola; holat va xodim", async () => {
    const { dialog } = await openHistory();
    const list = await within(dialog).findByRole("list", { name: "Smenalar tarixi" });
    expect(historyCalls()[0][1]).toEqual({ params: { page: 1, limit: 10, cashbox_user_id: "0" } });

    const links = within(list).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/payments/shifts/17",
      "/payments/shifts/16",
      "/payments/shifts/15",
    ]);
    expect(links[0]).toHaveTextContent("Smena #17");
    expect(links[0]).toHaveTextContent("Ochiq");
    expect(links[0]).toHaveTextContent("Ochgan xodim: Vali Aliyev");
    // Yarim tundan o'tgan smena — ikkala sana ham («Kecha, 17:53 – Bugun, 03:41» yoki sana bilan).
    expect(links[1]).toHaveTextContent(/, 17:53 – .+, 03:41/);
    expect(links[1]).toHaveTextContent("Yopgan xodim: Ali Valiyev");
    expect(links[2]).toHaveTextContent("Avtomatik yopilgan");
    expect(within(dialog).getByText(/Asosiy kassa · smenani tanlang/)).toBeInTheDocument();
    // 10 tadan kam — sahifalash yo'q.
    expect(within(dialog).queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("menejer: kassa parametri yuborilmaydi (backend o'z filialini majburlaydi)", async () => {
    await openHistory("manager");
    await waitFor(() => expect(historyCalls()).toHaveLength(1));
    expect(historyCalls()[0][1]).toEqual({ params: { page: 1, limit: 10 } });
  });

  it("10 tadan ko'p — keyingi sahifa so'raladi", async () => {
    server.total = 25;
    const { user, dialog } = await openHistory();
    await within(dialog).findByRole("list", { name: "Smenalar tarixi" });
    await user.click(within(dialog).getByRole("button", { name: "Keyingi sahifa" }));
    await waitFor(() => expect(historyCalls().at(-1)?.[1]).toEqual({ params: { page: 2, limit: 10, cashbox_user_id: "0" } }));
  });

  it("bo'sh ro'yxat — «Hali smena yo'q»", async () => {
    Object.assign(server, { items: [], total: 0 });
    const { dialog } = await openHistory();
    expect(await within(dialog).findByText("Hali smena yo'q")).toBeInTheDocument();
  });

  it("havola bosilsa oyna yopiladi", async () => {
    const { user, dialog } = await openHistory();
    await user.click(await within(dialog).findByRole("link", { name: /Smena #16/ }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Smenalar tarixi" })).not.toBeInTheDocument());
  });
});

describe("normalizeShiftHistory", () => {
  it("buzuq qatorlar tashlanadi, jami yo'q bo'lsa — qatorlar soni", () => {
    const page = normalizeShiftHistory({ data: { items: [null, { id: "x" }, { id: 5, status: "CLOSED", closed_by_system: true }] } });
    expect(page).toEqual({
      items: [
        { id: "5", status: "closed", openedAt: null, closedAt: null, openedByName: null, closedByName: null, autoClosed: true },
      ],
      total: 1,
    });
    expect(normalizeShiftHistory(undefined)).toEqual({ items: [], total: 0 });
  });
});
