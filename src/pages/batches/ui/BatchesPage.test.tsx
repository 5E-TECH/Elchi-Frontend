import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import BatchesPage from "./BatchesPage";

/**
 * Paketlar — `/batches` (dizayn v2, maketlar `*-batches-new|old|return`): tablar va sonlari, `?tab` va `page=1`,
 * marshrut, holat badge'i (haqiqiy holat), sahifalash, qator → `/batches/:id` (holat `{ from, fromSearch }`).
 */

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

type Params = Record<string, string>;

const local = (day: number, h: number, m: number) => new Date(2026, 9, day, h, m).toISOString();

const raw = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  qr_code_token: `BTB-${id}`,
  source_branch: { id: "7", name: "Chilonzor qabul punkti" },
  destination_branch: { id: "1", name: "Toshkent HQ" },
  region: { id: "14", name: "Samarqand" },
  direction: "FORWARD",
  status: "PENDING",
  order_count: 18,
  total_price: 4260000,
  createdAt: local(6, 13, 48),
  ...extra,
});

const TOTALS: Record<string, number> = { "PENDING|FORWARD": 24, "RECEIVED|FORWARD": 42, "|RETURN": 38 };

const respond = (
  rows: Record<string, unknown>[] = [raw("148"), raw("147", { total_price: 2875000, order_count: 12 })],
  totals: Record<string, number> = TOTALS,
) => {
  mocks.get.mockImplementation((url: string, config?: { params?: Params }) => {
    if (url === "transfer-batches") {
      const params = config?.params ?? {};
      const total = totals[`${params.status ?? ""}|${params.direction ?? ""}`] ?? 0;
      const data = params.limit === "1" ? rows.slice(0, 1) : rows;
      return Promise.resolve({
        data: { data: { items: data, meta: { page: Number(params.page ?? 1), limit: Number(params.limit ?? 10), total } } },
      });
    }
    if (url === "branches") return Promise.resolve({ data: { data: { items: [{ id: "1", name: "Toshkent HQ" }] } } });
    return Promise.reject(new Error(`kutilmagan so'rov: ${url}`));
  });
};

const listCalls = () =>
  mocks.get.mock.calls
    .filter(([url]) => url === "transfer-batches")
    .map(([, config]) => (config as { params: Params }).params);

const LocationProbe = () => {
  const location = useLocation();
  return (
    <output data-testid="location" data-state={JSON.stringify(location.state ?? null)}>
      {location.pathname}
      {location.search}
    </output>
  );
};

const stateFor = (role: string) =>
  ({
    role: { id: `${role}-1`, role, region: null, name: role },
    user: { user: { id: `${role}-1`, role }, isAuthenticated: true, accessToken: null, loading: false, isAppInitializing: false, error: null },
  }) as never;

const renderPage = (route = "/batches", role = "superadmin") =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/batches" element={<BatchesPage />} />
        <Route path="/batches/:id" element={<p>Paket tafsiloti</p>} />
      </Routes>
      <LocationProbe />
    </>,
    { route, preloadedState: stateFor(role) },
  );

afterEach(() => {
  mocks.get.mockReset();
});

describe("BatchesPage — /batches", () => {
  it("sarlavha, tablar sonlari bilan, jadval: marshrut, viloyat, haqiqiy holat, summa", async () => {
    respond();
    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Paketlar" })).toBeInTheDocument();
    expect(await screen.findByText("24 ta paket · filial va HQ xodimlari tomonidan yaratilgan")).toBeInTheDocument();

    const tabs = screen.getByRole("tablist", { name: "Paket turlari" });
    await waitFor(() => {
      expect(within(tabs).getByRole("tab", { name: /Yangi/ })).toHaveTextContent("24");
      expect(within(tabs).getByRole("tab", { name: /Eski/ })).toHaveTextContent("42");
      expect(within(tabs).getByRole("tab", { name: /Qaytarilgan/ })).toHaveTextContent("38");
    });
    expect(within(tabs).getByRole("tab", { name: /Yangi/ })).toHaveAttribute("aria-selected", "true");

    const table = await screen.findByRole("table", { name: "Paketlar ro'yxati" });
    const row = within(table).getByRole("link", { name: "B-148" }).closest("tr")!;
    expect(within(row).getByText("Samarqand")).toBeInTheDocument();
    expect(row).toHaveTextContent("Chilonzor qabul punkti");
    expect(row).toHaveTextContent("Toshkent HQ");
    expect(within(row).getByText("Yangi")).toHaveClass("bg-info-soft");
    expect(within(row).getByText("18 ta")).toBeInTheDocument();
    expect(within(row).getByText("4 260 000 so'm")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "B-148 paketini ochish" })).toHaveAttribute("href", "/batches/148");

    // Yangi tab so'rovi — v1 paramlari; boshqa tablar — faqat soni uchun `limit=1`.
    expect(listCalls()).toEqual(
      expect.arrayContaining([
        { status: "PENDING", direction: "FORWARD", page: "1", limit: "10" },
        { status: "RECEIVED", direction: "FORWARD", page: "1", limit: "1" },
        { direction: "RETURN", page: "1", limit: "1" },
      ]),
    );
    expect(screen.getByText("1–10 / 24 ta paket")).toBeInTheDocument();
  });

  it("tab almashsa — ?tab va page=1, «Qaytarilgan» izohida «Qaytarishlar» havolasi", async () => {
    respond([raw("171", { direction: "RETURN", status: "SENT" })]);
    const user = userEvent.setup();
    renderPage("/batches?tab=new&page=3");

    await screen.findByRole("table", { name: "Paketlar ro'yxati" });
    await user.click(screen.getByRole("tab", { name: /Qaytarilgan/ }));

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/batches?tab=return&page=1"));
    expect(await screen.findByRole("link", { name: "Qaytarishlar" })).toHaveAttribute("href", "/returns");
    expect(screen.getByText(/filiallardan qaytish oqimidagi paketlar/)).toBeInTheDocument();
    expect(listCalls()).toContainEqual({ direction: "RETURN", page: "1", limit: "10" });
    // SENT → «Yo'lda» (paket holati yorlig'i — newOrders:batchStatus), ton — warning (maketdagidek, F1).
    expect(await screen.findByText("Yo'lda")).toHaveClass("bg-warning-soft");
  });

  it("qator bosilsa — /batches/:id, holat { from: batches, fromSearch }", async () => {
    respond();
    const user = userEvent.setup();
    renderPage("/batches?tab=old&page=2");

    const table = await screen.findByRole("table", { name: "Paketlar ro'yxati" });
    await user.click(within(table).getByText("4 260 000 so'm"));

    await waitFor(() => expect(screen.getByText("Paket tafsiloti")).toBeInTheDocument());
    expect(screen.getByTestId("location")).toHaveTextContent("/batches/148");
    expect(JSON.parse(screen.getByTestId("location").dataset.state!)).toEqual({
      from: "batches",
      fromSearch: "?tab=old&page=2",
    });
  });

  it("filial nomi kelmasa («—», «Filial #1») — GET branches dan", async () => {
    respond([raw("150", { destination_branch: { id: "1", name: "Filial #1" } })]);
    renderPage();

    const table = await screen.findByRole("table", { name: "Paketlar ro'yxati" });
    await waitFor(() => expect(within(table).getAllByText(/Toshkent HQ/).length).toBeGreaterThan(0));
    expect(mocks.get).toHaveBeenCalledWith("branches", expect.anything());
  });

  it("menejer — `GET branches` ga ruxsat yo'q (backend `@Roles`), so'rov yuborilmaydi", async () => {
    respond([raw("150", { destination_branch: { id: "1", name: "Filial #1" } })]);
    renderPage("/batches", "manager");

    await screen.findByRole("table", { name: "Paketlar ro'yxati" });
    expect(mocks.get.mock.calls.some(([url]) => url === "branches")).toBe(false);
  });

  it("bo'sh ro'yxat — «Paketlar yo'q»", async () => {
    respond([], {});
    renderPage();
    expect(await screen.findByText("Paketlar yo'q")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Sahifalar" })).not.toBeInTheDocument();
  });

  it("xato — sarlavha va «Qayta urinish» (refetch)", async () => {
    mocks.get.mockImplementation((url: string, config?: { params?: Params }) =>
      url === "transfer-batches" && config?.params?.limit !== "1"
        ? Promise.reject(Object.assign(new Error("Server"), { response: { status: 500 } }))
        : Promise.resolve({ data: { data: { items: [], meta: { total: 0 } } } }),
    );
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Paketlar ro'yxatini yuklab bo'lmadi")).toBeInTheDocument();
    respond();
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(await screen.findByRole("table", { name: "Paketlar ro'yxati" })).toBeInTheDocument();
  });
});
