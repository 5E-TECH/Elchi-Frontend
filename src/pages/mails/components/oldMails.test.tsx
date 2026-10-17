import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../shared/api/api";
import { renderWithProviders } from "../../../test/test-utils";
import OldMails from "./oldMails";

const mocks = vi.hoisted(() => ({
  useGetOldMails: vi.fn(),
  useBatches: vi.fn(),
  useGetRegions: vi.fn(),
  useGetCouriers: vi.fn(),
  printOrders: vi.fn(),
  exportOldMailsToExcel: vi.fn(),
}));

vi.mock("../../../entities/mails", () => ({
  useMails: () => ({ useGetOldMails: mocks.useGetOldMails }),
}));
vi.mock("../../../entities/batch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/batch")>()),
  useBatches: mocks.useBatches,
}));
vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({ useGetRegions: mocks.useGetRegions, useGetCouriers: mocks.useGetCouriers }),
}));
vi.mock("../detail/lib/printMode", () => ({ printOrders: mocks.printOrders }));
vi.mock("./lib/exportOldMailsToExcel", () => ({ exportOldMailsToExcel: mocks.exportOldMailsToExcel }));

const post = (
  id: string,
  options: { status?: string; courier?: { id: string; name: string } | null; region?: [string, string]; orders?: number; amount?: number; date?: string } = {},
) => ({
  id,
  branch_id: "1",
  courier_id: options.courier?.id ?? null,
  courier: options.courier === undefined ? { id: "119", name: "Buxaro Courier" } : options.courier,
  createdAt: options.date ?? "2026-10-05T12:33:00.000Z",
  updatedAt: options.date ?? "2026-10-05T12:33:00.000Z",
  order_quantity: options.orders ?? 3,
  post_total_price: options.amount ?? 650000,
  qr_code_token: `qr-${id}`,
  region: { id: options.region?.[0] ?? "2", name: options.region?.[1] ?? "Buxoro" },
  region_id: options.region?.[0] ?? "2",
  status: options.status ?? "received",
});

const MAILS = [
  post("90", { status: "received" }),
  post("91", { status: "sent", courier: null, region: ["3", "Andijon"], orders: 2, amount: 100000 }),
  post("92", { status: "canceled", courier: { id: "7", name: "Jasur Tursunov" } }),
];

const BATCHES = [
  {
    id: "129",
    token: "t",
    from_branch: { id: "1", name: "Andijon filiali" },
    to_branch: { id: "5", name: "Toshkent HQ", region: "Toshkent" },
    direction: "forward",
    orders_count: 14,
    total_price: 3186000,
    status: "received",
    created_at: "2026-10-07T12:55:00.000Z",
  },
  {
    id: "128",
    token: "t2",
    from_branch: { id: "2", name: "Farg'ona filiali" },
    to_branch: { id: "5", name: "Toshkent HQ", region: "Toshkent" },
    direction: "forward",
    orders_count: 8,
    total_price: 1704000,
    status: "on_the_way",
    created_at: "2026-10-07T10:30:00.000Z",
  },
];

const mailsResult = (rows: unknown[], extra: Record<string, unknown> = {}) => ({
  data: { statusCode: 200, data: { data: rows, total: rows.length, page: 1, limit: 100, totalPages: 1 } },
  isLoading: false,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
  ...extra,
});

const LocationProbe = () => {
  const location = useLocation();
  return (
    <>
      <output data-testid="search">{location.search}</output>
      <output data-testid="path">{location.pathname}</output>
      <output data-testid="state">{JSON.stringify(location.state ?? null)}</output>
    </>
  );
};

const renderOld = (role: string, route = "/mails/old", layout?: "card" | "page") =>
  renderWithProviders(
    <>
      <OldMails layout={layout} />
      <LocationProbe />
    </>,
    { route, preloadedState: { role: { id: "1", role, region: null, name: "Test" } } },
  );

const search = () => new URLSearchParams(screen.getByTestId("search").textContent ?? "");

describe("OldMails — xodim (pochtalar)", () => {
  beforeEach(() => {
    mocks.useGetOldMails.mockReturnValue(mailsResult(MAILS));
    mocks.useBatches.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() });
    mocks.useGetRegions.mockReturnValue({
      data: { data: [{ id: "2", name: "Buxoro" }, { id: "3", name: "Andijon" }] },
      isLoading: false,
    });
    mocks.useGetCouriers.mockReturnValue({
      data: { data: { items: [{ id: "119", name: "Buxaro Courier" }, { id: "7", name: "Jasur Tursunov" }] } },
      isLoading: false,
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests the full collection like v1 and renders the table with courier column and status badges", () => {
    renderOld("admin", "/mails/old", "card");

    expect(mocks.useGetOldMails).toHaveBeenCalledWith(
      false,
      { page: 1, limit: 10000, region_id: "", courier_id: "", status: "", startDate: "", endDate: "" },
      { enabled: true },
    );
    const table = screen.getByRole("table", { name: "Eski pochtalar" });
    expect(within(table).getByRole("link", { name: "№90" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Kuryer" })).toBeInTheDocument();
    // Kuryer ustuni (≥ 1024) va planshet nusxasi (viloyat ostida).
    expect(within(table).getAllByText("Buxaro Courier").length).toBeGreaterThan(0);
    expect(within(table).getByText("Qabul qilingan")).toBeInTheDocument();
    expect(within(table).getByText("Jo'natilgan")).toBeInTheDocument();
    expect(within(table).getByText("Rad etilgan")).toBeInTheDocument();
  });

  it("status column header follows the role mockups: «Holati» for admin/superadmin, «Holat» for manager", () => {
    const { unmount } = renderOld("admin", "/mails/old", "card");
    expect(within(screen.getByRole("table", { name: "Eski pochtalar" })).getByRole("columnheader", { name: "Holati" })).toBeInTheDocument();
    unmount();
    renderOld("manager", "/mails/old", "card");
    expect(within(screen.getByRole("table", { name: "Eski pochtalar" })).getByRole("columnheader", { name: "Holat" })).toBeInTheDocument();
  });

  it("offers receipt reprint only for received mails", () => {
    renderOld("admin", "/mails/old", "card");

    expect(screen.getByRole("button", { name: "№90: chekni qayta chiqarish" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "№91: chekni qayta chiqarish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "№92: chekni qayta chiqarish" })).not.toBeInTheDocument();
  });

  it("shows the filtered summary line (D6) and the page summary", () => {
    renderOld("manager", "/mails/old", "card");

    expect(
      screen.getByText((_, node) => node?.tagName === "P" && node.textContent === "3 ta pochta · 8 ta buyurtma · jami 1 400 000 so'm"),
    ).toBeInTheDocument();
    expect(screen.getByText("1–3 / 3 ta pochta")).toBeInTheDocument();
  });

  it("reprints the receipt through GET post/orders/:id and the browser print mode", async () => {
    const user = userEvent.setup();
    const orders = [{ id: "o1" }];
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: { data: orders } });
    renderOld("admin", "/mails/old", "card");

    await user.click(screen.getByRole("button", { name: "№90: chekni qayta chiqarish" }));

    expect(get).toHaveBeenCalledWith("post/orders/90");
    expect(mocks.printOrders).toHaveBeenCalledWith("browser", orders);
  });

  it("warns when the mail has no orders and reports a reprint failure", async () => {
    const user = userEvent.setup();
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: { data: [] } });
    renderOld("admin", "/mails/old", "card");

    await user.click(screen.getByRole("button", { name: "№90: chekni qayta chiqarish" }));
    expect(await screen.findByText("Buyurtmalar topilmadi")).toBeInTheDocument();
    expect(mocks.printOrders).not.toHaveBeenCalled();

    get.mockRejectedValueOnce(new Error("boom"));
    await user.click(screen.getByRole("button", { name: "№90: chekni qayta chiqarish" }));
    expect(await screen.findByText("Chekni chiqarishda xatolik yuz berdi")).toBeInTheDocument();
  });

  it("exports the filtered list to Excel with the courier column and unchanged labels", async () => {
    const user = userEvent.setup();
    renderOld("admin", "/mails/old?status=received", "card");

    await user.click(screen.getByRole("button", { name: "Excelga yuklash" }));

    expect(mocks.exportOldMailsToExcel).toHaveBeenCalledTimes(1);
    const { rows, labels } = mocks.exportOldMailsToExcel.mock.calls[0][0];
    expect(rows).toEqual([
      {
        id: "90",
        region: "Buxoro",
        courier: "Buxaro Courier",
        status: "Qabul qilingan",
        orders: 3,
        amount: 650000,
        createdAt: "2026-10-05T12:33:00.000Z",
      },
    ]);
    expect(labels).toMatchObject({
      title: "Eski pochtalar hisoboti",
      mailId: "Pochta raqami",
      region: "Viloyat",
      courier: "Kuryer",
      status: "Holati",
      orders: "Buyurtmalar",
      amount: "Summa",
      currency: "so'm",
    });
    expect(await screen.findByText("1 ta eski pochta Excel fayliga yuklandi")).toBeInTheDocument();
  });

  it("writes a filter to the URL and resets the page to 1", async () => {
    const user = userEvent.setup();
    renderOld("admin", "/mails/old?page=2", "card");

    await user.click(screen.getByRole("combobox", { name: "Viloyat" }));
    await user.click(screen.getByRole("option", { name: "Andijon" }));

    expect(search().get("region_id")).toBe("3");
    expect(search().get("page")).toBe("1");
    expect(screen.getByRole("link", { name: "№91" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "№90" })).not.toBeInTheDocument();
  });

  it("offers the mail statuses in the status filter", async () => {
    const user = userEvent.setup();
    renderOld("registrator", "/mails/old", "card");

    await user.click(screen.getByRole("combobox", { name: "Holati" }));
    const names = screen.getAllByRole("option").map((option) => option.textContent);
    expect(names).toEqual(["Barchasi", "Jo'natilgan", "Qabul qilingan", "Rad etilgan", "Qaytarilgan"]);
  });

  it("shows the filtered empty state with «Filtrlarni tozalash» that clears the URL filters", async () => {
    const user = userEvent.setup();
    renderOld("admin", "/mails/old?status=canceled_received&limit=16", "card");

    expect(screen.getByText("Tanlangan filtrlar bo'yicha hech narsa topilmadi")).toBeInTheDocument();
    const clear = screen.getAllByRole("button", { name: "Filtrlarni tozalash" });
    await user.click(clear[clear.length - 1]);

    expect(search().get("status")).toBeNull();
    expect(search().get("limit")).toBe("16");
    expect(screen.getByRole("link", { name: "№90" })).toBeInTheDocument();
  });

  it("opens the detail with the v1 navigation state (tab, view, filters)", async () => {
    const user = userEvent.setup();
    renderOld("admin", "/mails/old?region_id=2", "card");

    await user.click(screen.getByRole("link", { name: "№90 pochtani ochish" }));

    expect(screen.getByTestId("path").textContent).toBe("/mails/90");
    expect(JSON.parse(screen.getByTestId("state").textContent ?? "null")).toEqual({
      fromTab: "old",
      view: "old",
      fromSearch: "?region_id=2",
    });
  });

  it("paginates on the client with page sizes 8/16/32/64", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 10 }, (_, index) => post(String(100 + index)));
    mocks.useGetOldMails.mockReturnValue(mailsResult(many));
    renderOld("admin", "/mails/old", "card");

    expect(screen.getByText("1–8 / 10 ta pochta")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /^№1\d\d$/ })).toHaveLength(8);
    await user.click(screen.getByRole("button", { name: "Keyingi sahifa" }));
    expect(search().get("page")).toBe("2");
    expect(screen.getByText("9–10 / 10 ta pochta")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: /Sahifadagi qatorlar soni/ }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["8 ta", "16 ta", "32 ta", "64 ta"]);
  });

  it("shows the empty state when there are no old mails", () => {
    mocks.useGetOldMails.mockReturnValue(mailsResult([]));
    renderOld("admin", "/mails/old", "card");

    expect(screen.getByText("Eski pochtalar topilmadi")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    // v1 da bo'sh holatda Excel tugmasi yo'q edi — bo'sh fayl va «0 ta yuklandi» xabari chiqmasin.
    expect(screen.getByRole("button", { name: "Excelga yuklash" })).toBeDisabled();
  });

  it("shows an error state with retry", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mocks.useGetOldMails.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { response: { status: 500, data: {} } },
      refetch,
    });
    renderOld("admin", "/mails/old", "card");

    expect(screen.getByText("Eski pochtalarni yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excelga yuklash" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(refetch).toHaveBeenCalled();
    expect(mocks.exportOldMailsToExcel).not.toHaveBeenCalled();
  });
});

describe("OldMails — «Pochtalar | Filial paketlari» (D11)", () => {
  beforeEach(() => {
    mocks.useGetOldMails.mockReturnValue(mailsResult(MAILS));
    mocks.useBatches.mockReturnValue({ data: { data: BATCHES }, isLoading: false, isError: false, refetch: vi.fn() });
    mocks.useGetRegions.mockReturnValue({ data: { data: [] }, isLoading: false });
    mocks.useGetCouriers.mockReturnValue({ data: { data: [] }, isLoading: false });
  });

  it.each(["admin", "superadmin"])("%s switches to branch batches: batch_mode=all, status dropped", async (role) => {
    const user = userEvent.setup();
    renderOld(role, "/mails/old?status=sent&region_id=5", "card");

    const view = screen.getByRole("radiogroup", { name: "Ko'rinish" });
    await user.click(within(view).getByRole("radio", { name: "Filial paketlari" }));

    expect(search().get("batch_mode")).toBe("all");
    expect(search().get("status")).toBeNull();
    expect(search().get("region_id")).toBe("5");
    expect(mocks.useBatches).toHaveBeenLastCalledWith({ page: 1, limit: 10000 }, { enabled: true });
  });

  it("renders batches with B- numbers, real batch statuses and no courier column or filter", async () => {
    const user = userEvent.setup();
    renderOld("admin", "/mails/old?batch_mode=all", "card");

    const table = screen.getByRole("table", { name: "Filial paketlari" });
    expect(within(table).getByRole("link", { name: "B-129" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Paket" })).toBeInTheDocument();
    expect(within(table).queryByRole("columnheader", { name: "Kuryer" })).not.toBeInTheDocument();
    expect(within(table).getByText("Qabul qilindi")).toBeInTheDocument();
    expect(within(table).getByText("Yo'lda")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Kuryer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /chekni qayta chiqarish/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "B-129 paketini ochish" })).toBeInTheDocument();
    expect(screen.getByText("1–2 / 2 ta paket")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Holati" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Barchasi",
      "Yangi",
      "Yo'lda",
      "Qabul qilindi",
      "Bekor qilindi",
    ]);
  });

  it("paket qatori paket sahifasini ochadi (/batches/:id, orqaga — «Eski pochtalar» filtrlar bilan)", async () => {
    const user = userEvent.setup();
    renderOld("superadmin", "/mails/old?batch_mode=all", "card");

    await user.click(screen.getByRole("link", { name: "B-129 paketini ochish" }));

    expect(screen.getByTestId("path").textContent).toBe("/batches/129");
    expect(JSON.parse(screen.getByTestId("state").textContent ?? "null")).toEqual({
      from: "mails-old",
      fromSearch: "?batch_mode=all",
    });
  });

  it.each(["manager", "registrator"])("%s has no view switch and batch_mode in the URL is ignored", (role) => {
    renderOld(role, "/mails/old?batch_mode=all", "card");

    expect(screen.queryByRole("radiogroup", { name: "Ko'rinish" })).not.toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Eski pochtalar" })).toBeInTheDocument();
    expect(mocks.useBatches).toHaveBeenLastCalledWith(undefined, { enabled: false });
  });
});

describe("OldMails — kuryer (page)", () => {
  beforeEach(() => {
    mocks.useGetOldMails.mockReturnValue(mailsResult(MAILS));
    mocks.useBatches.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() });
    mocks.useGetRegions.mockReturnValue({ data: { data: [{ id: "2", name: "Buxoro" }] }, isLoading: false });
    mocks.useGetCouriers.mockReturnValue({ data: undefined, isLoading: false });
  });

  it("uses the courier endpoint, hides the courier filter and column, sorts and reprints with a text button", () => {
    renderOld("courier", "/mails/old?courier_id=7");

    expect(mocks.useGetOldMails).toHaveBeenCalledWith(true, expect.objectContaining({ courier_id: "" }), { enabled: true });
    expect(mocks.useGetCouriers).toHaveBeenCalledWith({ status: "active", limit: 100 }, false);
    expect(screen.queryByRole("combobox", { name: "Kuryer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Ko'rinish" })).not.toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Eski pochtalar" });
    expect(within(table).queryByRole("columnheader", { name: "Kuryer" })).not.toBeInTheDocument();
    expect(within(table).getByTitle("Holat bo'yicha saralash")).toBeInTheDocument();
    // `courier_id` kuryerda e'tiborsiz — uchala pochta ko'rinadi.
    expect(within(table).getAllByRole("link", { name: /^№9\d$/ })).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Pochta №90: chekni qayta chiqarish" })).toHaveTextContent(
      "Chekni qayta chiqarish",
    );
    expect(screen.getByRole("button", { name: "Excelga yuklash" })).toBeInTheDocument();
  });

  it("exports courier mails with the courier names (unchanged rows)", async () => {
    const user = userEvent.setup();
    renderOld("courier");

    await user.click(screen.getByRole("button", { name: "Excelga yuklash" }));
    const { rows } = mocks.exportOldMailsToExcel.mock.calls.at(-1)![0];
    expect(rows.map((row: { id: string; courier: string }) => [row.id, row.courier])).toEqual([
      ["90", "Buxaro Courier"],
      ["91", ""],
      ["92", "Jasur Tursunov"],
    ]);
  });
});

describe("OldMails — telefon (< 768)", () => {
  const original = window.matchMedia;
  beforeEach(() => {
    mocks.useGetOldMails.mockReturnValue(mailsResult(MAILS));
    mocks.useBatches.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() });
    mocks.useGetRegions.mockReturnValue({
      data: { data: [{ id: "2", name: "Buxoro" }, { id: "3", name: "Andijon" }] },
      isLoading: false,
    });
    mocks.useGetCouriers.mockReturnValue({ data: { data: [] }, isLoading: false });
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
  });
  afterEach(() => {
    window.matchMedia = original;
  });

  it("uses cards, the filters sheet (draft → URL) and removable chips", async () => {
    const user = userEvent.setup();
    renderOld("admin", "/mails/old?startDate=2026-10-01&endDate=2026-10-08", "card");

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excelga yuklash" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "№90: chekni qayta chiqarish" })).toHaveTextContent(
      "Chekni qayta chiqarish",
    );

    const filtersButton = screen.getByRole("button", { name: /^Filtrlar\s?\d*$/ });
    expect(filtersButton).toHaveTextContent("Filtrlar1");
    await user.click(filtersButton);
    const sheet = await screen.findByRole("dialog", { name: "Filtrlar" });
    await user.click(within(sheet).getByRole("combobox", { name: "Viloyat" }));
    await user.click(screen.getByRole("option", { name: "Andijon" }));
    expect(search().get("region_id")).toBeNull();
    await user.click(within(sheet).getByRole("button", { name: /Natijalarni ko'rsatish/ }));

    expect(search().get("region_id")).toBe("3");
    expect(search().get("page")).toBe("1");

    await user.click(screen.getByRole("button", { name: "Sana filtrini olib tashlash" }));
    expect(search().get("startDate")).toBeNull();
    expect(search().get("endDate")).toBeNull();
    expect(screen.getByRole("button", { name: "Viloyat filtrini olib tashlash" })).toBeInTheDocument();
  });

  it("manager cards: «Pochta №X» title, «Kuryer: … · viloyat» sub-line (manager-mails-old)", () => {
    renderOld("manager", "/mails/old", "card");

    const cards = screen.getByRole("list");
    expect(within(cards).getByText("Pochta №90")).toBeInTheDocument();
    expect(within(cards).getByText(/Kuryer: Buxaro Courier · Buxoro/)).toBeInTheDocument();
  });

  it("batch cards: «Paket B-129 · N ta buyurtma · sana» and the real batch status", () => {
    mocks.useBatches.mockReturnValue({ data: { data: BATCHES }, isLoading: false, isError: false, refetch: vi.fn() });
    renderOld("superadmin", "/mails/old?batch_mode=all", "card");

    const cards = screen.getByRole("list");
    expect(within(cards).getByText(/Paket B-129 · 14 ta buyurtma/)).toBeInTheDocument();
    expect(within(cards).getByText("Yo'lda")).toBeInTheDocument();
  });

  it("hides the summary while there is nothing to summarize", () => {
    mocks.useGetOldMails.mockReturnValue(mailsResult([]));
    renderOld("admin", "/mails/old", "card");

    expect(screen.queryByText(/ta pochta/)).not.toBeInTheDocument();
  });

  it("batch mode: the filters sheet ignores a mail status left in the URL", async () => {
    const user = userEvent.setup();
    mocks.useBatches.mockReturnValue({ data: { data: BATCHES }, isLoading: false, isError: false, refetch: vi.fn() });
    renderOld("superadmin", "/mails/old?batch_mode=all&status=canceled", "card");

    const filtersButton = screen.getByRole("button", { name: /^Filtrlar\s?\d*$/ });
    expect(filtersButton).toHaveTextContent(/^Filtrlar$/);
    await user.click(filtersButton);
    const sheet = await screen.findByRole("dialog", { name: "Filtrlar" });
    // Qoralama ham «0 ta tanlangan», natija — barcha paketlar.
    expect(within(sheet).getByRole("button", { name: /Natijalarni ko'rsatish/ })).toHaveTextContent("(2)");
    await user.click(within(sheet).getByRole("button", { name: /Natijalarni ko'rsatish/ }));
    expect(search().get("status")).toBeNull();
  });
});
