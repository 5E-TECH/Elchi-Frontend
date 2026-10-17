import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import ReturnsPage from "./index";

/**
 * Qaytarishlar — `/returns` (dizayn v2, maketlar `superadmin-returns-list`, `manager-returns-list`): holat filtri API
 * qiymatini yuboradi, sana filtri — `period` | `date` (F2), ikkalasi URL bilan sinxron; menejerda «Filialdan» ustuni
 * yo'q va izohda o'z filiali, saralash joriy sahifa ichida, qator → `/batches/:id` (holat `{ from: "returns", fromSearch }`).
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
    <output data-testid="location" data-search={location.search} data-state={JSON.stringify(location.state ?? null)}>
      {location.pathname}
    </output>
  );
};

const renderPage = (role = "superadmin", user: Record<string, unknown> = {}, route = "/returns") =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/returns" element={<ReturnsPage />} />
        <Route path="/batches/:id" element={<p>Paket tafsiloti</p>} />
      </Routes>
      <LocationProbe />
    </>,
    { route, preloadedState: stateFor(role, user) },
  );

const search = () => new URLSearchParams(screen.getByTestId("location").dataset.search ?? "");
const dateTrigger = () => screen.getByRole("button", { name: /^Sana / });

afterEach(() => {
  mocks.get.mockReset();
  vi.useRealTimers();
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
    await user.click(await screen.findByRole("option", { name: "Qabul qilingan" }));

    await waitFor(() => expect(lastParams()).toEqual({ page: 1, limit: 10, direction: "RETURN", status: "RECEIVED" }));
    expect(search().get("status")).toBe("received");
  });

  it("holat paket badge'i maketdagidek (F1): variantlar «Qabul qilingan», «Bekor qilingan»; «Yo'lda» — warning", async () => {
    respond();
    const user = userEvent.setup();
    renderPage();

    const table = await screen.findByRole("table", { name: "Qaytarish paketlari ro'yxati" });
    expect(within(table).getByText("Yo'lda")).toHaveClass("bg-warning-soft");
    expect(within(table).getByText("Yangi")).toHaveClass("bg-info-soft");
    await user.click(screen.getByRole("combobox", { name: "Holat" }));
    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
      "Barchasi",
      "Yangi",
      "Yo'lda",
      "Qabul qilingan",
      "Bekor qilingan",
    ]);
  });

  it("holat URL'dan: /returns?status=received → status RECEIVED", async () => {
    respond();
    renderPage("superadmin", {}, "/returns?status=received&page=2");

    await screen.findByRole("table", { name: "Qaytarish paketlari ro'yxati" });
    expect(lastParams()).toEqual({ page: 2, limit: 10, direction: "RETURN", status: "RECEIVED" });
    expect(screen.getByRole("combobox", { name: "Holat" })).toHaveTextContent("Qabul qilingan");
  });

  it("filtrdan keyin bo'sh — «Filtrni tozalash»", async () => {
    respond();
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("table", { name: "Qaytarish paketlari ro'yxati" });

    respond([], 0);
    await user.click(screen.getByRole("combobox", { name: "Holat" }));
    await user.click(await screen.findByRole("option", { name: "Bekor qilingan" }));

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
    expect(JSON.parse(screen.getByTestId("location").dataset.state!)).toEqual({ from: "returns", fromSearch: "" });
  });

  it("qator havolasi filtrlarni saqlaydi: holat { from: returns, fromSearch: ?… }", async () => {
    respond();
    const user = userEvent.setup();
    renderPage("superadmin", {}, "/returns?status=new&period=week&page=2");

    const table = await screen.findByRole("table", { name: "Qaytarish paketlari ro'yxati" });
    await user.click(within(table).getByRole("link", { name: "B-171" }));

    await waitFor(() => expect(screen.getByText("Paket tafsiloti")).toBeInTheDocument());
    expect(JSON.parse(screen.getByTestId("location").dataset.state!)).toEqual({
      from: "returns",
      fromSearch: "?status=new&period=week&page=2",
    });
  });

  it("xato — xabar va «Qayta urinish»", async () => {
    mocks.get.mockRejectedValue(Object.assign(new Error("Server"), { response: { status: 500 } }));
    renderPage();
    expect(await screen.findByText("Qaytarish paketlari ro'yxatini yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qayta urinish" })).toBeInTheDocument();
  });
});

describe("ReturnsPage — «Sana» filtri (F2: period | date, URL bilan)", () => {
  beforeEach(() => {
    // Bugun — 2026-10-17 (shanba): «Bu hafta» 12-oktabrdan, «Bu oy» 1-oktabrdan.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 17, 12, 0));
  });

  it("maydon «Sana: Barchasi» holat yonida; /returns?period=today → period today, maydonda «Bugun»", async () => {
    respond();
    renderPage("superadmin", {}, "/returns?period=today");

    await screen.findByRole("table", { name: "Qaytarish paketlari ro'yxati" });
    expect(lastParams()).toEqual({ page: 1, limit: 10, direction: "RETURN", period: "today" });
    expect(dateTrigger()).toHaveAccessibleName("Sana Bugun");
    expect(dateTrigger()).toHaveTextContent("Sana:Bugun");
    // Maket tartibi: «Holat», keyin «Sana» — ikkalasi bitta filtrlar guruhida.
    const filters = screen.getByRole("group", { name: "Filtrlar" });
    const status = within(filters).getByRole("combobox", { name: "Holat" });
    expect(filters).toContainElement(dateTrigger());
    expect(status.compareDocumentPosition(dateTrigger()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("bo'sh: «Sana: Barchasi»; «Bu hafta» → ?period=week, page o'chadi, so'rovda period", async () => {
    respond();
    const user = userEvent.setup();
    renderPage("superadmin", {}, "/returns?page=3&limit=20");

    await screen.findByRole("table", { name: "Qaytarish paketlari ro'yxati" });
    expect(dateTrigger()).toHaveAccessibleName("Sana Barchasi");
    expect(dateTrigger()).toHaveTextContent("Sana:Barchasi");

    await user.click(dateTrigger());
    const dialog = screen.getByRole("dialog", { name: "Sanani tanlash" });
    expect(within(dialog).getByRole("button", { name: "Barchasi" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(dialog).getByRole("button", { name: "Bu hafta" }));

    await waitFor(() => expect(search().get("period")).toBe("week"));
    expect(search().has("page")).toBe(false);
    expect(search().get("limit")).toBe("20");
    await waitFor(() => expect(lastParams()).toEqual({ page: 1, limit: 20, direction: "RETURN", period: "week" }));
    expect(dateTrigger()).toHaveTextContent("Bu hafta");
  });

  it("taqvimda bitta kun → ?date=YYYY-MM-DD (period yo'q), bir bosishda qo'llanadi", async () => {
    respond();
    const user = userEvent.setup();
    renderPage("superadmin", {}, "/returns?period=month");

    await screen.findByRole("table", { name: "Qaytarish paketlari ro'yxati" });
    await user.click(dateTrigger());
    const dialog = screen.getByRole("dialog", { name: "Sanani tanlash" });
    expect(within(dialog).getByRole("button", { name: "Bu oy" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(dialog).getByRole("gridcell", { name: "15-oktabr" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(search().get("date")).toBe("2026-10-15"));
    expect(search().has("period")).toBe(false);
    await waitFor(() => expect(lastParams()).toEqual({ page: 1, limit: 10, direction: "RETURN", date: "2026-10-15" }));
    expect(dateTrigger()).toHaveTextContent("15.10.2026");
  });

  it("× tozalaydi — so'rovda period/date yo'q", async () => {
    respond();
    const user = userEvent.setup();
    renderPage("superadmin", {}, "/returns?date=2026-10-15");

    await screen.findByRole("table", { name: "Qaytarish paketlari ro'yxati" });
    expect(lastParams()).toEqual({ page: 1, limit: 10, direction: "RETURN", date: "2026-10-15" });
    await user.click(screen.getByRole("button", { name: "Sanani tozalash" }));

    await waitFor(() => expect(lastParams()).toEqual({ page: 1, limit: 10, direction: "RETURN" }));
    expect(search().has("date")).toBe(false);
    expect(dateTrigger()).toHaveAccessibleName("Sana Barchasi");
  });

  it("filtrlar bilan bo'sh — «Bu davrda qaytarish paketi yo'q», «Filtrlarni tozalash» ikkalasini o'chiradi", async () => {
    respond([], 0);
    const user = userEvent.setup();
    renderPage("superadmin", {}, "/returns?status=cancelled&period=week");

    expect(await screen.findByText("Bu davrda qaytarish paketi yo'q")).toBeInTheDocument();
    expect(screen.getByText("Boshqa sanani tanlang yoki filtrlarni tozalang.")).toBeInTheDocument();
    respond();
    await user.click(screen.getByRole("button", { name: "Filtrlarni tozalash" }));

    await waitFor(() => expect(lastParams()).toEqual({ page: 1, limit: 10, direction: "RETURN" }));
    expect(search().toString()).toBe("");
  });
});
