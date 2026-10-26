import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { api } from "../../../shared/api/api";
import { renderWithProviders } from "../../../test/test-utils";
import OldMails from "./oldMails";

const mocks = vi.hoisted(() => ({
  useGetOldMails: vi.fn(),
  fetchOldMails: vi.fn(),
  fetchAllTransferBatches: vi.fn(),
  useGetRegions: vi.fn(),
  useGetCouriers: vi.fn(),
  printOrders: vi.fn(),
  exportOldMailsToExcel: vi.fn(),
}));

vi.mock("../../../entities/mails", () => ({
  useMails: () => ({ useGetOldMails: mocks.useGetOldMails, fetchOldMails: mocks.fetchOldMails }),
}));
vi.mock("../../../entities/batch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/batch")>()),
  fetchAllTransferBatches: mocks.fetchAllTransferBatches,
}));
vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({ useGetRegions: mocks.useGetRegions, useGetCouriers: mocks.useGetCouriers }),
}));
vi.mock("../detail/lib/printMode", () => ({ printOrders: mocks.printOrders }));
vi.mock("./lib/exportOldMailsToExcel", () => ({ exportOldMailsToExcel: mocks.exportOldMailsToExcel }));

/** Xulosa qatori (`<p>`) — bo'shliqlar (NBSP ham) normallashtirilgan matn bo'yicha. */
const summaryLine = (text: string | RegExp) =>
  screen.getByText((_, node) => {
    if (node?.tagName !== "P") return false;
    const content = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    return typeof text === "string" ? content === text : text.test(content);
  });

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

const batch = (id: string, status: string, overrides: Record<string, unknown> = {}) => ({
  id,
  token: `t-${id}`,
  from_branch: { id: "1", name: "Andijon filiali" },
  to_branch: { id: "5", name: "Toshkent HQ", region: "Toshkent" },
  direction: "forward",
  orders_count: 14,
  total_price: 3186000,
  status,
  created_at: "2026-10-07T12:55:00.000Z",
  ...overrides,
});

const BATCHES = [
  batch("129", "received"),
  batch("128", "on_the_way", {
    from_branch: { id: "2", name: "Farg'ona filiali" },
    orders_count: 8,
    total_price: 1704000,
    created_at: "2026-10-07T10:30:00.000Z",
  }),
];

/** Server javobi (`GET /post`): sahifa qatorlari + `total` (filtrlangan barcha qatorlar soni). */
type PageMeta = { total?: number; page?: number; limit?: number; orders_total?: number; amount_total?: number };

const pageBody = (rows: unknown[], meta: PageMeta = {}) => {
  const { total = rows.length, limit = 8, page = 1, ...sums } = meta;
  return {
    statusCode: 200,
    data: { data: rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)), ...sums },
  };
};

const mailsResult = (
  rows: unknown[],
  meta: PageMeta = {},
  extra: Record<string, unknown> = {},
) => ({
  data: pageBody(rows, meta),
  isLoading: false,
  isError: false,
  isFetching: false,
  isPlaceholderData: false,
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
const LIST_OPTIONS = { enabled: true, keepPreviousData: true };
/** Sahifa ro'yxatining oxirgi so'rovi (varaqadagi `limit: 1` sanovchisi emas). */
const lastListParams = () =>
  mocks.useGetOldMails.mock.calls.filter(([, params]) => params?.limit !== 1).at(-1)?.[1];

/** Excel uchun sahifalar: `count` ta qator, `fetchOldMails(isCourier, { page, limit })` sahifa bo'yicha beradi. */
const pagedFetch = (count: number) =>
  mocks.fetchOldMails.mockImplementation((_isCourier: boolean, params: { page: number; limit: number }) => {
    const from = (params.page - 1) * params.limit;
    const rows = Array.from({ length: Math.max(0, Math.min(params.limit, count - from)) }, (_, index) =>
      post(String(1000 + from + index)),
    );
    return Promise.resolve(pageBody(rows, { total: count, page: params.page, limit: params.limit }));
  });

describe("OldMails — xodim (pochtalar)", () => {
  beforeEach(() => {
    mocks.useGetOldMails.mockReturnValue(mailsResult(MAILS));
    mocks.fetchAllTransferBatches.mockResolvedValue({ data: [], capped: false });
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
    mocks.useGetOldMails.mockReset();
    mocks.fetchOldMails.mockReset();
    mocks.exportOldMailsToExcel.mockReset();
  });

  it("requests one server page (page, limit ≤ 100, has_orders) and renders the table with courier column and status badges", () => {
    renderOld("admin", "/mails/old", "card");

    expect(mocks.useGetOldMails).toHaveBeenCalledWith(false, { page: 1, limit: 8, has_orders: true }, LIST_OPTIONS);
    const table = screen.getByRole("table", { name: "Eski pochtalar" });
    expect(within(table).getByRole("link", { name: "№90" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Kuryer" })).toBeInTheDocument();
    // Kuryer ustuni (≥ 1024) va planshet nusxasi (viloyat ostida).
    expect(within(table).getAllByText("Buxaro Courier").length).toBeGreaterThan(0);
    expect(within(table).getByText("Qabul qilingan")).toBeInTheDocument();
    expect(within(table).getByText("Jo'natilgan")).toBeInTheDocument();
    expect(within(table).getByText("Rad etilgan")).toBeInTheDocument();
    expect(mocks.fetchAllTransferBatches).not.toHaveBeenCalled();
  });

  it("sends the URL page, page size and filters to the server (F4: no limit=10000, no client filtering)", () => {
    mocks.useGetOldMails.mockReturnValue(mailsResult(MAILS, { total: 40, page: 2, limit: 16 }));
    renderOld(
      "admin",
      "/mails/old?page=2&limit=16&region_id=2&courier_id=119&status=cancelled&startDate=2026-10-01&endDate=2026-10-08",
      "card",
    );

    expect(lastListParams()).toEqual({
      page: 2,
      limit: 16,
      has_orders: true,
      region_id: "2",
      courier_id: "119",
      status: "canceled",
      startDate: "2026-10-01",
      endDate: "2026-10-08",
    });
    // Server filtrlagan sahifa qanday kelsa shunday chiziladi (boshqa holat/viloyat qatori ham).
    expect(screen.getByRole("link", { name: "№91" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "№90" })).toBeInTheDocument();
  });

  it("paginates by the server total: «17–32 / 250 ta pochta», page sizes 8/16/32/64", async () => {
    const user = userEvent.setup();
    const pageRows = Array.from({ length: 16 }, (_, index) => post(String(200 + index)));
    mocks.useGetOldMails.mockReturnValue(mailsResult(pageRows, { total: 250, page: 2, limit: 16 }));
    renderOld("admin", "/mails/old?page=2&limit=16", "card");

    expect(screen.getByText("17–32 / 250 ta pochta")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /^№2\d\d$/ })).toHaveLength(16);
    const next = screen.getByRole("button", { name: "Keyingi sahifa" });
    expect(next).toBeEnabled();
    await user.click(next);
    expect(search().get("page")).toBe("3");
    expect(lastListParams()).toMatchObject({ page: 3, limit: 16 });

    await user.click(screen.getByRole("combobox", { name: /Sahifadagi qatorlar soni/ }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["8 ta", "16 ta", "32 ta", "64 ta"]);
  });

  it("moves to the last page when the settled server answer has fewer pages (not while a placeholder is shown)", async () => {
    mocks.useGetOldMails.mockReturnValue(mailsResult([], { total: 10, page: 9, limit: 8 }, { isPlaceholderData: true }));
    const { unmount } = renderOld("admin", "/mails/old?page=9", "card");
    expect(search().get("page")).toBe("9");
    unmount();

    mocks.useGetOldMails.mockReturnValue(mailsResult([], { total: 10, page: 9, limit: 8 }));
    renderOld("admin", "/mails/old?page=9", "card");
    await waitFor(() => expect(search().get("page")).toBe("2"));
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

  it("⭐ tveJKICY: xulosa — «N ta pochta · M ta buyurtma · jami S» server yig'indilaridan (sahifadan emas)", () => {
    mocks.useGetOldMails.mockReturnValue(
      mailsResult(MAILS, { total: 46, orders_total: 684, amount_total: 128_360_000 }),
    );
    renderOld("manager", "/mails/old", "card");

    // Sahifadagi 3 ta pochtaning yig'indisi emas — filtr bo'yicha barcha sahifalar (backend `orders_total`, `amount_total`).
    expect(summaryLine("46 ta pochta · 684 ta buyurtma · jami 128 360 000 so'm")).toBeInTheDocument();
    expect(screen.getByText("1–8 / 46 ta pochta")).toBeInTheDocument();
  });

  it("tveJKICY: imkonsiz filtr — yig'indilar 0; ru/en ham server sonlari bilan", async () => {
    mocks.useGetOldMails.mockReturnValue(mailsResult(MAILS, { total: 3, orders_total: 0, amount_total: 0 }));
    renderOld("admin", "/mails/old", "card");
    expect(summaryLine("3 ta pochta · 0 ta buyurtma · jami 0 so'm")).toBeInTheDocument();

    await act(async () => {
      await i18n.changeLanguage("ru");
    });
    expect(summaryLine("3 почты · 0 заказов · всего 0 сум")).toBeInTheDocument();
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    expect(summaryLine("3 mails · 0 orders · total 0 UZS")).toBeInTheDocument();
    await act(async () => {
      await i18n.changeLanguage("uz");
    });
  });

  it("eski javob (yig'indilarsiz) — xulosa faqat «N ta pochta», sahifadan hisoblanmaydi", () => {
    mocks.useGetOldMails.mockReturnValue(mailsResult(MAILS, { total: 46 }));
    renderOld("manager", "/mails/old", "card");

    expect(screen.getByText((_, node) => node?.tagName === "P" && node.textContent === "46 ta pochta")).toBeInTheDocument();
    expect(screen.queryByText(/ta buyurtma · jami/)).not.toBeInTheDocument();
    expect(screen.getByText("1–8 / 46 ta pochta")).toBeInTheDocument();
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

  it("exports ALL filtered rows to Excel: pages 1..3 by 100 with the same filters", async () => {
    const user = userEvent.setup();
    mocks.useGetOldMails.mockReturnValue(mailsResult(MAILS, { total: 250 }));
    pagedFetch(250);
    renderOld("admin", "/mails/old?status=received&region_id=2&page=2", "card");

    await user.click(screen.getByRole("button", { name: "Excelga yuklash" }));

    expect(await screen.findByText("250 ta eski pochta Excel fayliga yuklandi")).toBeInTheDocument();
    const filters = { limit: 100, has_orders: true, region_id: "2", status: "received" };
    expect(mocks.fetchOldMails.mock.calls).toEqual([
      [false, { page: 1, ...filters }],
      [false, { page: 2, ...filters }],
      [false, { page: 3, ...filters }],
    ]);
    expect(mocks.exportOldMailsToExcel).toHaveBeenCalledTimes(1);
    const { rows, labels } = mocks.exportOldMailsToExcel.mock.calls[0][0];
    expect(rows).toHaveLength(250);
    expect(rows[0]).toEqual({
      id: "1000",
      region: "Buxoro",
      courier: "Buxaro Courier",
      status: "Qabul qilingan",
      orders: 3,
      amount: 650000,
      createdAt: "2026-10-05T12:33:00.000Z",
    });
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
  });

  it("Excel: one export at a time (busy button) and an error toast when a page fails", async () => {
    const user = userEvent.setup();
    let release: (value: unknown) => void = () => undefined;
    mocks.fetchOldMails.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
    renderOld("admin", "/mails/old", "card");

    const button = screen.getByRole("button", { name: "Excelga yuklash" });
    await user.click(button);
    expect(button).toHaveAttribute("aria-busy", "true");
    await user.click(button);
    expect(mocks.fetchOldMails).toHaveBeenCalledTimes(1);
    release(pageBody([post("1")], { total: 1, limit: 100 }));
    expect(await screen.findByText("1 ta eski pochta Excel fayliga yuklandi")).toBeInTheDocument();
    expect(button).not.toHaveAttribute("aria-busy");

    mocks.fetchOldMails.mockRejectedValueOnce(new Error("502"));
    mocks.exportOldMailsToExcel.mockClear();
    await user.click(button);
    expect(await screen.findByText("Excel faylini tayyorlab bo'lmadi")).toBeInTheDocument();
    expect(mocks.exportOldMailsToExcel).not.toHaveBeenCalled();
  });

  it("⭐ Excel chegarasi (200 sahifa = 20 000 qator): fayl beriladi, lekin «Fayl to'liq emas» ogohlantirishi bilan", async () => {
    const user = userEvent.setup();
    mocks.useGetOldMails.mockReturnValue(mailsResult(MAILS, { total: 20_050 }));
    pagedFetch(20_050);
    renderOld("admin", "/mails/old", "card");

    await user.click(screen.getByRole("button", { name: "Excelga yuklash" }));

    expect(
      await screen.findByText("Fayl to'liq emas: faqat birinchi 20 000 qator yuklandi. Filtrni toraytiring."),
    ).toBeInTheDocument();
    // 201-sahifa so'ralmaydi, fayl baribir yuklanadi; «N ta yuklandi» muvaffaqiyat xabari chiqmaydi.
    expect(mocks.fetchOldMails).toHaveBeenCalledTimes(200);
    expect(mocks.exportOldMailsToExcel).toHaveBeenCalledTimes(1);
    expect(mocks.exportOldMailsToExcel.mock.calls[0][0].rows).toHaveLength(20_000);
    expect(screen.queryByText(/ta eski pochta Excel fayliga yuklandi/)).not.toBeInTheDocument();
  });

  it("writes a filter to the URL, resets the page to 1 and asks the server again", async () => {
    const user = userEvent.setup();
    renderOld("admin", "/mails/old?page=2", "card");

    await user.click(screen.getByRole("combobox", { name: "Viloyat" }));
    await user.click(screen.getByRole("option", { name: "Andijon" }));

    expect(search().get("region_id")).toBe("3");
    expect(search().get("page")).toBe("1");
    expect(lastListParams()).toEqual({ page: 1, limit: 8, has_orders: true, region_id: "3" });
  });

  it("offers the mail statuses in the status filter", async () => {
    const user = userEvent.setup();
    renderOld("registrator", "/mails/old", "card");

    await user.click(screen.getByRole("combobox", { name: "Holati" }));
    const names = screen.getAllByRole("option").map((option) => option.textContent);
    expect(names).toEqual(["Barchasi", "Jo'natilgan", "Qabul qilingan", "Rad etilgan", "Qaytarilgan"]);
  });

  it("server total 0 with active filters → filtered empty state; «Filtrlarni tozalash» clears the URL filters", async () => {
    const user = userEvent.setup();
    mocks.useGetOldMails.mockImplementation((_courier: boolean, params: { status?: string }) =>
      params?.status ? mailsResult([]) : mailsResult(MAILS),
    );
    renderOld("admin", "/mails/old?status=canceled_received&limit=16", "card");

    expect(screen.getByText("Tanlangan filtrlar bo'yicha hech narsa topilmadi")).toBeInTheDocument();
    expect(screen.queryByText("Eski pochtalar topilmadi")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excelga yuklash" })).toBeDisabled();
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

  it("server total 0 without filters → «Eski pochtalar topilmadi», Excel disabled", () => {
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
    mocks.fetchAllTransferBatches.mockReset();
    mocks.fetchAllTransferBatches.mockResolvedValue({ data: BATCHES, capped: false });
    mocks.useGetRegions.mockReturnValue({ data: { data: [] }, isLoading: false });
    mocks.useGetCouriers.mockReturnValue({ data: { data: [] }, isLoading: false });
  });
  afterEach(() => {
    mocks.useGetOldMails.mockReset();
    mocks.fetchOldMails.mockReset();
    mocks.exportOldMailsToExcel.mockReset();
  });

  it.each(["admin", "superadmin"])("%s switches to branch batches: batch_mode=all, status dropped, all pages loaded", async (role) => {
    const user = userEvent.setup();
    renderOld(role, "/mails/old?status=sent&region_id=5", "card");
    expect(mocks.fetchAllTransferBatches).not.toHaveBeenCalled();

    const view = screen.getByRole("radiogroup", { name: "Ko'rinish" });
    await user.click(within(view).getByRole("radio", { name: "Filial paketlari" }));

    expect(search().get("batch_mode")).toBe("all");
    expect(search().get("status")).toBeNull();
    expect(search().get("region_id")).toBe("5");
    await waitFor(() => expect(mocks.fetchAllTransferBatches).toHaveBeenCalledTimes(1));
    expect(mocks.useGetOldMails).toHaveBeenLastCalledWith(false, expect.anything(), { enabled: false, keepPreviousData: true });
  });

  it("renders batches with B- numbers, real batch statuses (F1 tones/labels) and no courier column or filter", async () => {
    const user = userEvent.setup();
    renderOld("admin", "/mails/old?batch_mode=all", "card");

    const table = await screen.findByRole("table", { name: "Filial paketlari" });
    expect(within(table).getByRole("link", { name: "B-129" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Paket" })).toBeInTheDocument();
    expect(within(table).queryByRole("columnheader", { name: "Kuryer" })).not.toBeInTheDocument();
    expect(within(table).getByText("Qabul qilingan")).toBeInTheDocument();
    // F1: SENT paket — «Yo'lda», buyurtmadagi «Yo'lda» bilan bir xil ton (warning).
    expect(within(table).getByText("Yo'lda").closest("[class*='bg-']")?.className).toContain("bg-warning-soft");
    expect(screen.queryByRole("combobox", { name: "Kuryer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /chekni qayta chiqarish/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "B-129 paketini ochish" })).toBeInTheDocument();
    expect(screen.getByText("1–2 / 2 ta paket")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Holati" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Barchasi",
      "Yangi",
      "Yo'lda",
      "Qabul qilingan",
      "Bekor qilingan",
    ]);
  });

  it("uses every batch page, not only the newest 100 (client filters and summary over all of them)", async () => {
    const many = Array.from({ length: 130 }, (_, index) => batch(String(1000 + index), index % 2 ? "received" : "cancelled"));
    mocks.fetchAllTransferBatches.mockResolvedValue({ data: many, capped: false });
    renderOld("superadmin", "/mails/old?batch_mode=all", "card");

    expect(await screen.findByText("1–8 / 130 ta paket")).toBeInTheDocument();
    expect(
      screen.getByText((_, node) => node?.tagName === "P" && node.textContent === "130 ta paket · 1 820 ta buyurtma · jami 414 180 000 so'm"),
    ).toBeInTheDocument();
    expect(mocks.useGetOldMails).toHaveBeenLastCalledWith(false, expect.anything(), { enabled: false, keepPreviousData: true });
  });

  it("Excel in batch mode exports the client-filtered batches with the F1 status label", async () => {
    const user = userEvent.setup();
    renderOld("admin", "/mails/old?batch_mode=all&status=received", "card");

    await screen.findByRole("table", { name: "Filial paketlari" });
    await user.click(screen.getByRole("button", { name: "Excelga yuklash" }));

    expect(await screen.findByText("1 ta eski pochta Excel fayliga yuklandi")).toBeInTheDocument();
    expect(mocks.fetchOldMails).not.toHaveBeenCalled();
    const { rows, labels } = mocks.exportOldMailsToExcel.mock.calls[0][0];
    expect(rows).toEqual([
      {
        id: "129",
        region: "Toshkent",
        courier: "",
        status: "Qabul qilingan",
        orders: 14,
        amount: 3186000,
        createdAt: "2026-10-07T12:55:00.000Z",
      },
    ]);
    expect(labels.title).toBe("Eski paketlar hisoboti");
  });

  it("paket qatori paket sahifasini ochadi (/batches/:id, orqaga — «Eski pochtalar» filtrlar bilan)", async () => {
    const user = userEvent.setup();
    renderOld("superadmin", "/mails/old?batch_mode=all", "card");

    await user.click(await screen.findByRole("link", { name: "B-129 paketini ochish" }));

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
    expect(mocks.fetchAllTransferBatches).not.toHaveBeenCalled();
    expect(mocks.useGetOldMails).toHaveBeenLastCalledWith(false, expect.anything(), LIST_OPTIONS);
  });
});

describe("OldMails — kuryer (page)", () => {
  beforeEach(() => {
    mocks.useGetOldMails.mockReturnValue(mailsResult(MAILS));
    mocks.fetchAllTransferBatches.mockResolvedValue({ data: [], capped: false });
    mocks.useGetRegions.mockReturnValue({ data: { data: [{ id: "2", name: "Buxoro" }] }, isLoading: false });
    mocks.useGetCouriers.mockReturnValue({ data: undefined, isLoading: false });
  });
  afterEach(() => {
    mocks.useGetOldMails.mockReset();
    mocks.fetchOldMails.mockReset();
    mocks.exportOldMailsToExcel.mockReset();
  });

  it("uses the courier endpoint, hides the courier filter and column, sorts and reprints with a text button", () => {
    renderOld("courier", "/mails/old?courier_id=7&region_id=2");

    // `courier_id` kuryerda yuborilmaydi (backend — JWT egasi).
    expect(mocks.useGetOldMails).toHaveBeenCalledWith(true, { page: 1, limit: 8, has_orders: true, region_id: "2" }, LIST_OPTIONS);
    expect(mocks.useGetCouriers).toHaveBeenCalledWith({ status: "active", limit: 100 }, false);
    expect(screen.queryByRole("combobox", { name: "Kuryer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Ko'rinish" })).not.toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Eski pochtalar" });
    expect(within(table).queryByRole("columnheader", { name: "Kuryer" })).not.toBeInTheDocument();
    expect(within(table).getByTitle("Holat bo'yicha saralash")).toBeInTheDocument();
    expect(within(table).getAllByRole("link", { name: /^№9\d$/ })).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Pochta №90: chekni qayta chiqarish" })).toHaveTextContent(
      "Chekni qayta chiqarish",
    );
    expect(screen.getByRole("button", { name: "Excelga yuklash" })).toBeInTheDocument();
  });

  it("offers only old-post statuses (no «Jo'natilgan») and never sends status=sent", async () => {
    const user = userEvent.setup();
    renderOld("courier", "/mails/old?status=sent");

    expect(lastListParams()).toEqual({ page: 1, limit: 8, has_orders: true });
    await user.click(screen.getByRole("combobox", { name: "Holati" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Barchasi",
      "Qabul qilingan",
      "Rad etilgan",
      "Qaytarilgan",
    ]);
    await user.click(screen.getByRole("option", { name: "Rad etilgan" }));
    expect(lastListParams()).toEqual({ page: 1, limit: 8, has_orders: true, status: "canceled" });
  });

  it("exports all courier pages with the courier names", async () => {
    const user = userEvent.setup();
    mocks.fetchOldMails.mockResolvedValue(pageBody(MAILS, { total: 3, limit: 100 }));
    renderOld("courier");

    await user.click(screen.getByRole("button", { name: "Excelga yuklash" }));
    await waitFor(() => expect(mocks.exportOldMailsToExcel).toHaveBeenCalled());
    expect(mocks.fetchOldMails).toHaveBeenCalledWith(true, { page: 1, limit: 100, has_orders: true });
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
    mocks.fetchAllTransferBatches.mockReset();
    mocks.fetchAllTransferBatches.mockResolvedValue({ data: BATCHES, capped: false });
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
    mocks.useGetOldMails.mockReset();
  });

  it("uses cards, the filters sheet (draft → URL, server count) and removable chips", async () => {
    const user = userEvent.setup();
    // Varaqadagi son — qoralama bo'yicha `limit: 1` so'rovining `total` i.
    mocks.useGetOldMails.mockImplementation((_courier: boolean, params: { limit?: number }) =>
      params?.limit === 1 ? mailsResult([MAILS[1]], { total: 42, limit: 1 }) : mailsResult(MAILS),
    );
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
    expect(mocks.useGetOldMails).toHaveBeenCalledWith(
      false,
      { page: 1, limit: 1, has_orders: true, region_id: "3", startDate: "2026-10-01", endDate: "2026-10-08" },
      { enabled: true, keepPreviousData: true, silentError: true },
    );
    const apply = within(sheet).getByRole("button", { name: /Natijalarni ko'rsatish/ });
    expect(apply).toHaveTextContent("(42)");
    await user.click(apply);

    expect(search().get("region_id")).toBe("3");
    expect(search().get("page")).toBe("1");

    await user.click(screen.getByRole("button", { name: "Sana filtrini olib tashlash" }));
    expect(search().get("startDate")).toBeNull();
    expect(search().get("endDate")).toBeNull();
    expect(screen.getByRole("button", { name: "Viloyat filtrini olib tashlash" })).toBeInTheDocument();
  });

  it("hides the sheet count while the server count is a placeholder", async () => {
    const user = userEvent.setup();
    mocks.useGetOldMails.mockImplementation((_courier: boolean, params: { limit?: number }) =>
      params?.limit === 1 ? mailsResult([], { total: 3, limit: 1 }, { isPlaceholderData: true }) : mailsResult(MAILS),
    );
    renderOld("admin", "/mails/old", "card");

    await user.click(screen.getByRole("button", { name: /^Filtrlar\s?\d*$/ }));
    const sheet = await screen.findByRole("dialog", { name: "Filtrlar" });
    expect(within(sheet).getByRole("button", { name: /Natijalarni ko'rsatish/ })).not.toHaveTextContent("(");
  });

  it("manager cards: «Pochta №X» title, «Kuryer: … · viloyat» sub-line (manager-mails-old)", () => {
    renderOld("manager", "/mails/old", "card");

    const cards = screen.getByRole("list");
    expect(within(cards).getByText("Pochta №90")).toBeInTheDocument();
    expect(within(cards).getByText(/Kuryer: Buxaro Courier · Buxoro/)).toBeInTheDocument();
  });

  it("tveJKICY 390px: xulosa ikki qatorda — «N ta pochta · M ta buyurtma» va ostida summa", () => {
    mocks.useGetOldMails.mockReturnValue(mailsResult(MAILS, { total: 46, orders_total: 684, amount_total: 128_360_000 }));
    renderOld("manager", "/mails/old", "card");

    const line = summaryLine(/^46 ta pochta · 684 ta buyurtma/);
    expect(line.querySelector("br")).not.toBeNull();
    expect(line).toHaveTextContent("jami 128 360 000 so'm");
  });

  it("courier phone: «Jami N ta pochta» is the server total", () => {
    mocks.useGetOldMails.mockReturnValue(mailsResult(MAILS, { total: 18 }));
    renderOld("courier");

    expect(screen.getByText((_, node) => node?.tagName === "P" && node.textContent === "Jami 18 ta pochta")).toBeInTheDocument();
  });

  it("batch cards: «Paket B-129 · N ta buyurtma · sana» and the real batch status", async () => {
    renderOld("superadmin", "/mails/old?batch_mode=all", "card");

    const cards = await screen.findByRole("list");
    expect(within(cards).getByText(/Paket B-129 · 14 ta buyurtma/)).toBeInTheDocument();
    expect(within(cards).getByText("Yo'lda")).toBeInTheDocument();
  });

  it("hides the summary while there is nothing to summarize", () => {
    mocks.useGetOldMails.mockReturnValue(mailsResult([]));
    renderOld("admin", "/mails/old", "card");

    expect(screen.queryByText(/ta pochta/)).not.toBeInTheDocument();
  });

  it("batch mode: the filters sheet ignores a mail status left in the URL and counts on the client", async () => {
    const user = userEvent.setup();
    renderOld("superadmin", "/mails/old?batch_mode=all&status=canceled", "card");

    await screen.findByRole("list");
    const filtersButton = screen.getByRole("button", { name: /^Filtrlar\s?\d*$/ });
    expect(filtersButton).toHaveTextContent(/^Filtrlar$/);
    await user.click(filtersButton);
    const sheet = await screen.findByRole("dialog", { name: "Filtrlar" });
    // Qoralama ham «0 ta tanlangan», natija — barcha paketlar.
    expect(within(sheet).getByRole("button", { name: /Natijalarni ko'rsatish/ })).toHaveTextContent("(2)");
    expect(mocks.useGetOldMails.mock.calls.some(([, params]) => params?.limit === 1)).toBe(false);
    await user.click(within(sheet).getByRole("button", { name: /Natijalarni ko'rsatish/ }));
    expect(search().get("status")).toBeNull();
  });
});
