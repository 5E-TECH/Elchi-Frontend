import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import CancelReasonsPage from "./index";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../shared/api/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../shared/api/api")>();
  return { ...original, api: { ...original.api, get: mocks.get } };
});

const STATS = {
  statusCode: 200,
  data: {
    total: 8,
    by_reason: [
      { reason: "CUSTOMER_REFUSED", label: "Mijoz rad etdi", count: 6 },
      { reason: "NEW_REASON", label: "Yangi sabab", count: 2 },
    ],
  },
};
const LIST = { statusCode: 200, data: { items: [{ id: 7, name: "Baraka Shop" }] } };
const BRANCHES = { statusCode: 200, data: { items: [{ id: 1, name: "HQ Toshkent", type: "HQ" }], meta: { total: 1, page: 1, limit: 100, totalPages: 1 } } };

const stateOf = (role: string) => ({ role: { id: "1", role, region: null, name: "Test" } }) as never;
const statsCalls = () => mocks.get.mock.calls.filter(([url]) => url === "orders/cancel-reasons/stats").map(([, options]) => options.params);

const mockApi = (stats: () => Promise<unknown> = () => Promise.resolve({ data: STATS })) =>
  mocks.get.mockImplementation((url: string) => {
    if (url === "orders/cancel-reasons/stats") return stats();
    return Promise.resolve({ data: url === "branches" ? BRANCHES : LIST });
  });

describe("«Bekor qilish sabablari» hisoboti (GNWDKvmZ)", () => {
  beforeEach(() => mocks.get.mockReset());

  it("⭐ davr bilan so'raladi; jami, eng ko'p sabab, ulushlar; yorliq tarjimadan, noma'lumi backenddan", async () => {
    mockApi();
    renderWithProviders(<CancelReasonsPage />, { preloadedState: stateOf("superadmin") });

    const list = await screen.findByRole("list", { name: "Sabablar bo'yicha" });
    expect(within(list).getByText("Mijoz rad etdi")).toBeInTheDocument();
    expect(within(list).getByText("Yangi sabab")).toBeInTheDocument();
    expect(within(list).getByText("6 ta")).toBeInTheDocument();
    expect(list).toHaveTextContent("75%");
    expect(screen.getByRole("region", { name: "Bekor qilish ko'rsatkichlari" })).toHaveTextContent("Jami bekor qilingan");

    const [params] = statsCalls();
    expect(params.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(params.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(params).not.toHaveProperty("market_id");
  });

  it("⭐ superadmin market tanlasa — `market_id` ketadi", async () => {
    const user = userEvent.setup();
    mockApi();
    renderWithProviders(<CancelReasonsPage />, { preloadedState: stateOf("admin") });

    await user.click(await screen.findByRole("combobox", { name: "Market" }));
    await user.click(await screen.findByRole("option", { name: "Baraka Shop" }));

    await waitFor(() => expect(statsCalls().at(-1)).toMatchObject({ market_id: "7" }));
  });

  it("⭐ filial ro'yxati to'lgan, tanlansa `branch_id` ketadi (`useBranches` javobi `data.data` da)", async () => {
    const user = userEvent.setup();
    mockApi();
    renderWithProviders(<CancelReasonsPage />, { preloadedState: stateOf("superadmin") });

    await user.click(await screen.findByRole("combobox", { name: "Filial" }));
    await user.click(await screen.findByRole("option", { name: "HQ Toshkent" }));

    await waitFor(() => expect(statsCalls().at(-1)).toMatchObject({ branch_id: "1" }));
  });

  it.each(["manager", "market"])("⭐ %s: filtrlar yashirin, market va filial ro'yxati so'ralmaydi", async (role) => {
    mockApi();
    renderWithProviders(<CancelReasonsPage />, { preloadedState: stateOf(role) });

    await screen.findByRole("list", { name: "Sabablar bo'yicha" });
    expect(screen.queryByRole("combobox", { name: "Market" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Filial" })).toBeNull();
    expect(mocks.get.mock.calls.every(([url]) => url === "orders/cancel-reasons/stats")).toBe(true);
  });

  it("⭐ bo'sh davr — xatosiz bo'sh holat", async () => {
    mockApi(() => Promise.resolve({ data: { data: { total: 0, by_reason: [] } } }));
    renderWithProviders(<CancelReasonsPage />, { preloadedState: stateOf("superadmin") });

    expect(await screen.findByText("Bu davrda bekor qilingan buyurtma yo'q")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Sabablar bo'yicha" })).toBeNull();
  });

  it("⭐ xato «bo'sh» deb ko'rsatilmaydi, «Qayta urinish» qayta so'raydi", async () => {
    const user = userEvent.setup();
    let attempts = 0;
    mockApi(() => {
      attempts += 1;
      return attempts === 1 ? Promise.reject(new Error("500")) : Promise.resolve({ data: STATS });
    });
    renderWithProviders(<CancelReasonsPage />, { preloadedState: stateOf("superadmin") });

    expect(await screen.findByText("Hisobotni yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.queryByText("Bu davrda bekor qilingan buyurtma yo'q")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(await screen.findByRole("list", { name: "Sabablar bo'yicha" })).toBeInTheDocument();
  });
});
