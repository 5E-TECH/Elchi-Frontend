import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import ReturnsPage from "./index";

/**
 * Qaytarishlar — `/returns` (dizayn v2, maketlar `superadmin-returns-list`, `manager-returns-list`): holat filtri API
 * qiymatini yuboradi, menejerda «Filialdan» ustuni yo'q va izohda o'z filiali, saralash joriy sahifa ichida,
 * qator → `/batches/:id` (holat `{ from: "returns" }`).
 */

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../shared/api/api", () => ({
  api: { get: mocks.get, post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

type Params = Record<string, unknown>;

const local = (day: number, h: number, m: number) => new Date(2026, 9, day, h, m).toISOString();

const ROWS = [
  {
    id: "170",
    source_branch: { name: "Andijon filiali" },
    destination_branch: { name: "Toshkent HQ" },
    order_count: 2,
    total_price: 385000,
    status: "PENDING",
    createdAt: local(17, 12, 5),
  },
  {
    id: "171",
    source_branch: { name: "Urgut filiali" },
    destination_branch: { name: "Toshkent HQ" },
    order_count: 4,
    total_price: 1160000,
    status: "SENT",
    createdAt: local(17, 15, 20),
  },
];

const respond = (rows: unknown[] = ROWS, total = 38) => {
  mocks.get.mockImplementation((url: string) =>
    url === "transfer-batches"
      ? Promise.resolve({ data: { data: { items: rows, meta: { page: 1, limit: 10, total } } } })
      : Promise.reject(new Error(`kutilmagan so'rov: ${url}`)),
  );
};

const lastParams = () => {
  const calls = mocks.get.mock.calls.filter(([url]) => url === "transfer-batches");
  return (calls.at(-1)?.[1] as { params: Params }).params;
};

const stateFor = (role: string, user: Record<string, unknown> = {}) =>
  ({
    role: { id: `${role}-1`, role, region: null, name: role },
    user: {
      user: { id: `${role}-1`, role, ...user },
      isAuthenticated: true,
      accessToken: null,
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;

const LocationProbe = () => {
  const location = useLocation();
  return (
    <output data-testid="location" data-state={JSON.stringify(location.state ?? null)}>
      {location.pathname}
    </output>
  );
};

const renderPage = (role = "superadmin", user: Record<string, unknown> = {}) =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/returns" element={<ReturnsPage />} />
        <Route path="/batches/:id" element={<p>Paket tafsiloti</p>} />
      </Routes>
      <LocationProbe />
    </>,
    { route: "/returns", preloadedState: stateFor(role, user) },
  );

afterEach(() => {
  mocks.get.mockReset();
});

describe("ReturnsPage — /returns", () => {
  it("superadmin: izoh, jadval (Filialdan → Qayerga), yangisi tepada, holat yorlig'i", async () => {
    respond();
    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Qaytarishlar" })).toBeInTheDocument();
    expect(await screen.findByText("jami 38 ta paket")).toBeInTheDocument();
    expect(screen.getByText(/Filiallardan qaytish oqimidagi paketlar/)).toBeInTheDocument();

    const table = await screen.findByRole("table", { name: "Qaytarish paketlari ro'yxati" });
    expect(within(table).getByRole("columnheader", { name: /Filialdan/ })).toBeInTheDocument();
    const links = within(table).getAllByRole("link", { name: /^B-\d+$/ });
    expect(links.map((link) => link.textContent)).toEqual(["B-171", "B-170"]);
    const row = links[0].closest("tr")!;
    expect(row).toHaveTextContent("Urgut filiali");
    expect(within(row).getByText("Yo'lda")).toBeInTheDocument();
    expect(within(row).getByText("1 160 000 so'm")).toBeInTheDocument();

    expect(lastParams()).toEqual({ page: 1, limit: 10, direction: "RETURN" });
    expect(screen.getByText("1–10 / 38 ta paket")).toBeInTheDocument();
  });

  it("holat filtri API qiymatini yuboradi (Yangi → PENDING) va 1-sahifaga qaytaradi", async () => {
    respond();
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole("table", { name: "Qaytarish paketlari ro'yxati" });
    await user.click(screen.getByRole("combobox", { name: "Holat" }));
    await user.click(await screen.findByRole("option", { name: "Qabul qilindi" }));

    await waitFor(() => expect(lastParams()).toEqual({ page: 1, limit: 10, direction: "RETURN", status: "RECEIVED" }));
  });

  it("filtrdan keyin bo'sh — «Filtrni tozalash»", async () => {
    respond();
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("table", { name: "Qaytarish paketlari ro'yxati" });

    respond([], 0);
    await user.click(screen.getByRole("combobox", { name: "Holat" }));
    await user.click(await screen.findByRole("option", { name: "Bekor qilindi" }));

    expect(await screen.findByText("Bu holatdagi qaytarish paketi yo'q")).toBeInTheDocument();
    respond();
    await user.click(screen.getByRole("button", { name: "Filtrni tozalash" }));
    await waitFor(() => expect(lastParams()).toEqual({ page: 1, limit: 10, direction: "RETURN" }));
  });

  it("saralash — joriy sahifa ichida (Summa ↑)", async () => {
    respond();
    const user = userEvent.setup();
    renderPage();

    const table = await screen.findByRole("table", { name: "Qaytarish paketlari ro'yxati" });
    await user.click(within(table).getByRole("button", { name: /Summa/ }));
    expect(within(table).getAllByRole("link", { name: /^B-\d+$/ }).map((link) => link.textContent)).toEqual([
      "B-170",
      "B-171",
    ]);
  });

  it("menejer: o'z filiali (source_branch_id), izohda filial nomi, «Filialdan» ustuni yo'q", async () => {
    respond(ROWS, 14);
    renderPage("manager", { branch_id: "7", branch: { id: "7", branch: { id: "7", name: "Urgut filiali", type: "HQ" } } });

    expect(await screen.findByText(/Urgut filialidan chiqqan qaytarish paketlari/)).toBeInTheDocument();
    const table = await screen.findByRole("table", { name: "Qaytarish paketlari ro'yxati" });
    expect(within(table).queryByRole("columnheader", { name: /Filialdan/ })).not.toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: /Qayerga/ })).toBeInTheDocument();
    expect(lastParams()).toEqual({ page: 1, limit: 10, direction: "RETURN", source_branch_id: "7" });
  });

  it("qator → /batches/:id, holat { from: returns }", async () => {
    respond();
    const user = userEvent.setup();
    renderPage();

    const table = await screen.findByRole("table", { name: "Qaytarish paketlari ro'yxati" });
    await user.click(within(table).getByRole("link", { name: "B-170 paketini ochish" }));

    await waitFor(() => expect(screen.getByText("Paket tafsiloti")).toBeInTheDocument());
    expect(screen.getByTestId("location")).toHaveTextContent("/batches/170");
    expect(JSON.parse(screen.getByTestId("location").dataset.state!)).toEqual({ from: "returns" });
  });

  it("xato — xabar va «Qayta urinish»", async () => {
    mocks.get.mockRejectedValue(Object.assign(new Error("Server"), { response: { status: 500 } }));
    renderPage();
    expect(await screen.findByText("Qaytarish paketlari ro'yxatini yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qayta urinish" })).toBeInTheDocument();
  });
});
