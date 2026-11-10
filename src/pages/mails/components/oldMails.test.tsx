import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { api } from "../../../shared/api/api";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { renderWithProviders } from "../../../test/test-utils";
import OldMails from "./oldMails";

const mocks = vi.hoisted(() => ({
  /** «Filial» ustuni nomlari — `GET branches` (superadmin, admin; `model/mailBranchNames.ts`). */
  useBranches: vi.fn(() => ({ data: { data: [{ id: "1", name: "HQ Toshkent" }] } })),
  useGetOldMails: vi.fn(),
  fetchOldMails: vi.fn(),
  fetchAllTransferBatches: vi.fn(),
  useGetRegions: vi.fn(),
  useGetCouriers: vi.fn(),
  printPostWithOrders: vi.fn(),
  exportOldMailsToExcel: vi.fn(),
}));

vi.mock("../../../entities/mails", () => ({
  useMails: () => ({ useGetOldMails: mocks.useGetOldMails, fetchOldMails: mocks.fetchOldMails }),
}));
vi.mock("../../../entities/batch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/batch")>()),
  fetchAllTransferBatches: mocks.fetchAllTransferBatches,
}));
vi.mock("../../../entities/branch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/branch")>()),
  useBranches: mocks.useBranches,
}));
vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({ useGetRegions: mocks.useGetRegions, useGetCouriers: mocks.useGetCouriers }),
}));
vi.mock("../detail/lib/printMode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../detail/lib/printMode")>()),
  printPostWithOrders: mocks.printPostWithOrders,
}));
vi.mock("./lib/exportOldMailsToExcel", () => ({ exportOldMailsToExcel: mocks.exportOldMailsToExcel }));

/**
 * Ega qarori 2026-11-10: «N ta pochta · M ta buyurtma · jami S» xulosasi yo'q. Bo'shliqlar (NBSP ham) normallashtirilgan
 * matnda «· N ta buyurtma» yoki «jami …» bor element topilmasligi kerak (qator / karta ichidagi o'z soni bundan tashqari).
 */
const summaryLines = () =>
  screen.queryAllByText((_, node) => {
    if (!node || node.children.length > 8) return false;
    const content = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    return /ta (pochta|paket) · .*ta buyurtma|ta buyurtma · jami|^jami \d|(заказ\S*|orders?) · (всего|total)/.test(content);
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

/** `branchType` — foydalanuvchi filiali turi (menejer: HQ — jadval, qolganlari — kartalar; `model/mailsCardView.ts`). */
const renderOld = (role: string, route = "/mails/old", layout?: "card" | "page", branchType?: string) =>
  renderWithProviders(
    <>
      <OldMails layout={layout} />
      <LocationProbe />
    </>,
    {
      route,
      preloadedState: {
        role: { id: "1", role, region: null, name: "Test" },
        ...(branchType
          ? {
              user: {
                user: { id: "1", role, branch: { id: "1", type: branchType } },
                isAuthenticated: true,
                accessToken: null,
                loading: false,
                isAppInitializing: false,
                error: null,
              },
            }
          : {}),
      } as never,
    },
  );

const dateOf = (iso: string) => formatDateTimeLocalized(iso, { language: "uz" });

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
    mocks.printPostWithOrders.mockReset();
  });

  it("requests one server page (page, limit ≤ 100, has_orders) and renders the table with «Filial» column and status badges", () => {
    renderOld("admin", "/mails/old", "card");

    expect(mocks.useGetOldMails).toHaveBeenCalledWith(false, { page: 1, limit: 8, has_orders: true }, LIST_OPTIONS);
    const table = screen.getByRole("table", { name: "Eski pochtalar" });
    expect(within(table).getByRole("link", { name: "№90" })).toBeInTheDocument();
    // «Kuryer» o'rnida «Filial» (Bahodir, 2026-11-04): ustun (≥ 1024) va planshet nusxasi (viloyat ostida).
    expect(within(table).getByRole("columnheader", { name: "Filial" })).toBeInTheDocument();
    expect(within(table).queryByRole("columnheader", { name: "Kuryer" })).not.toBeInTheDocument();
    expect(within(table).getAllByText("HQ Toshkent").length).toBeGreaterThan(0);
    expect(within(table).queryByText("Buxaro Courier")).not.toBeInTheDocument();
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
    renderOld("manager", "/mails/old", "card", "HQ");
    expect(within(screen.getByRole("table", { name: "Eski pochtalar" })).getByRole("columnheader", { name: "Holat" })).toBeInTheDocument();
  });

  it("HQ manager keeps the «Kuryer» column (own branch only — no «Filial», branch names not requested)", () => {
    mocks.useBranches.mockClear();
    renderOld("manager", "/mails/old", "card", "HQ");
    const table = screen.getByRole("table", { name: "Eski pochtalar" });
    expect(within(table).getByRole("columnheader", { name: "Kuryer" })).toBeInTheDocument();
    expect(within(table).queryByRole("columnheader", { name: "Filial" })).not.toBeInTheDocument();
    expect(within(table).getAllByText("Buxaro Courier").length).toBeGreaterThan(0);
    expect(mocks.useBranches.mock.calls.every((call) => !(call as unknown[])[1])).toBe(true);
  });

  it("branch manager: date cards (newest first in the page) with the real status, courier and the same router state", async () => {
    const user = userEvent.setup();
    const rows = [
      post("80", { status: "sent", date: "2026-10-03T09:00:00.000Z", courier: null }),
      post("82", { status: "received", date: "2026-10-06T09:00:00.000Z" }),
      post("81", { status: "canceled", date: "2026-10-04T09:00:00.000Z", courier: { id: "7", name: "Jasur Tursunov" } }),
    ];
    mocks.useGetOldMails.mockReturnValue(mailsResult(rows, { total: 46, orders_total: 684, amount_total: 128_360_000 }));
    renderOld("manager", "/mails/old?region_id=2", "card", "REGIONAL");

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    // Filtrlar, Excel va sahifalash o'z joyida; xulosa yo'q (2026-11-10).
    expect(summaryLines()).toEqual([]);
    expect(screen.getByRole("combobox", { name: "Kuryer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excelga yuklash" })).toBeInTheDocument();
    expect(screen.getByText("1–8 / 46 ta pochta")).toBeInTheDocument();

    const list = screen.getByRole("list", { name: "Eski pochtalar" });
    const links = within(list).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/mails/82", "/mails/81", "/mails/80"]);
    expect(links[1]).toHaveAccessibleName(
      `Pochta №81, ${dateOf("2026-10-04T09:00:00.000Z")}, Rad etilgan, Buxoro, 3 ta buyurtma, 650 000 so'm — ochish`,
    );
    expect(within(links[1]).getByText("Kuryer: Jasur Tursunov")).toBeInTheDocument();
    expect(within(links[0]).getByText("Qabul qilingan")).toBeInTheDocument();
    expect(within(links[2]).getByText("Jo'natilgan")).toBeInTheDocument();

    await user.click(links[1]);
    expect(screen.getByTestId("path").textContent).toBe("/mails/81");
    expect(JSON.parse(screen.getByTestId("state").textContent ?? "null")).toEqual({
      fromTab: "old",
      view: "old",
      fromSearch: "?region_id=2",
    });
  });

  it("branch manager: «Chekni qayta chiqarish» stays on the received card (outside the link) and prints", async () => {
    const user = userEvent.setup();
    const orders = [{ id: "o1", qr_code_token: "a".repeat(24) }];
    mocks.printPostWithOrders.mockResolvedValue({ orders: 1, pages: 2, jobs: 1, withoutQr: 0, delivery: ["printed"] });
    const get = vi.spyOn(api, "get").mockResolvedValue({
      data: {
        data: {
          allOrdersByPostId: orders,
          post: { id: "90", status: "received", qr_code_token: "POST-90", createdAt: "2026-10-07T12:55:00.000Z" },
        },
      },
    });
    renderOld("manager", "/mails/old", "card", "HYBRID");

    const list = screen.getByRole("list", { name: "Eski pochtalar" });
    const reprint = within(list).getByRole("button", { name: "№90: chekni qayta chiqarish" });
    expect(reprint).toHaveTextContent("Chekni qayta chiqarish");
    expect(reprint.closest("a")).toBeNull();
    // Faqat qabul qilingan pochtada.
    expect(within(list).getAllByRole("button")).toHaveLength(1);

    await user.click(reprint);
    expect(get).toHaveBeenCalledWith("post/orders/90");
    await waitFor(() => expect(mocks.printPostWithOrders).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("path").textContent).toBe("/mails/old");
  });

  it("branch manager: card-shaped loading skeleton", () => {
    mocks.useGetOldMails.mockReturnValue(mailsResult([], {}, { data: undefined, isLoading: true }));
    const { container } = renderOld("manager", "/mails/old", "card", "REGIONAL");

    expect(container.querySelector('[data-skeleton-preset="cards"]')).not.toBeNull();
  });

  it("offers receipt reprint only for received mails", () => {
    renderOld("admin", "/mails/old", "card");

    expect(screen.getByRole("button", { name: "№90: chekni qayta chiqarish" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "№91: chekni qayta chiqarish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "№92: chekni qayta chiqarish" })).not.toBeInTheDocument();
  });

  it("⭐ 2026-11-10: umumiy xulosa yo'q — server yig'indilari kelsa ham (admin, superadmin, registrator, menejer)", () => {
    mocks.useGetOldMails.mockReturnValue(
      mailsResult(MAILS, { total: 46, orders_total: 684, amount_total: 128_360_000 }),
    );
    for (const role of ["admin", "superadmin", "registrator", "manager"]) {
      const { unmount } = renderOld(role, "/mails/old", "card");
      expect(summaryLines()).toEqual([]);
      expect(screen.queryByText(/684/)).not.toBeInTheDocument();
      expect(screen.queryByText(/128[\s\u00a0]360[\s\u00a0]000/)).not.toBeInTheDocument();
      expect(screen.queryByText((_, node) => node?.tagName === "P" && node.textContent === "46 ta pochta")).toBeNull();
      // Sahifalash va Excel o'z joyida.
      expect(screen.getByText("1–8 / 46 ta pochta")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Excelga yuklash" })).toBeInTheDocument();
      unmount();
    }
  });

  it("2026-11-10: ru/en da ham xulosa yo'q", async () => {
    mocks.useGetOldMails.mockReturnValue(mailsResult(MAILS, { total: 3, orders_total: 0, amount_total: 0 }));
    renderOld("admin", "/mails/old", "card");
    try {
      for (const [language, pagination] of [
        ["ru", "1–3 из 3 почт"],
        ["en", "1–3 of 3 mails"],
      ]) {
        await act(async () => {
          await i18n.changeLanguage(language);
        });
        expect(summaryLines()).toEqual([]);
        expect(screen.getByText(pagination)).toBeInTheDocument();
      }
    } finally {
      await act(async () => {
        await i18n.changeLanguage("uz");
      });
    }
  });

  it("reprints through GET post/orders/:id: the mail receipt first, then the order receipts (ega qarori 5)", async () => {
    const user = userEvent.setup();
    const orders = [{ id: "o1", qr_code_token: "a".repeat(24) }];
    mocks.printPostWithOrders.mockResolvedValue({ orders: 1, pages: 2, jobs: 1, withoutQr: 0, delivery: ["printed"] });
    const get = vi.spyOn(api, "get").mockResolvedValue({
      data: {
        data: {
          allOrdersByPostId: orders,
          homeOrders: { homeOrders: 1, homeOrdersTotalPrice: 185_000 },
          centerOrders: { centerOrders: 0, centerOrdersTotalPrice: 0 },
          post: { id: "90", status: "received", qr_code_token: "POST-90", createdAt: "2026-10-07T12:55:00.000Z" },
        },
      },
    });
    renderOld("admin", "/mails/old", "card");

    await user.click(screen.getByRole("button", { name: "№90: chekni qayta chiqarish" }));

    expect(get).toHaveBeenCalledWith("post/orders/90");
    await waitFor(() => expect(mocks.printPostWithOrders).toHaveBeenCalledTimes(1));
    const [source, printed] = mocks.printPostWithOrders.mock.calls[0];
    expect(printed).toEqual(orders);
    expect(source).toMatchObject({ kind: "post", id: "90", token: "POST-90", ordersCount: 1, totalPrice: 185_000 });
    // Pochta va buyurtma tokenlari bor — «QR yo'q» ogohlantirishi yo'q.
    expect(screen.queryByText("Pochta chekida QR yo'q")).not.toBeInTheDocument();
  });

  it("reprint «Qayerga»: no region on the mail → the orders' region, never the «Viloyat #» screen fallback", async () => {
    const user = userEvent.setup();
    const noRegion = { ...post("95"), region: null, region_id: null };
    mocks.useGetOldMails.mockReturnValue(mailsResult([noRegion]));
    mocks.printPostWithOrders.mockResolvedValue({ orders: 1, pages: 2, jobs: 1, withoutQr: 0, delivery: ["printed"] });
    const postMeta = { id: "95", status: "received", qr_code_token: "POST-95", createdAt: "2026-10-07T12:55:00.000Z" };
    const order = { id: "o1", qr_code_token: "a".repeat(24) };
    vi.spyOn(api, "get")
      .mockResolvedValueOnce({
        data: { data: { allOrdersByPostId: [{ ...order, district: { region: { name: "Buxoro viloyati" } } }], post: postMeta } },
      })
      .mockResolvedValueOnce({ data: { data: { allOrdersByPostId: [order], post: postMeta } } });
    renderOld("admin", "/mails/old", "card");

    await user.click(screen.getByRole("button", { name: "№95: chekni qayta chiqarish" }));
    await waitFor(() => expect(mocks.printPostWithOrders).toHaveBeenCalledTimes(1));
    expect(mocks.printPostWithOrders.mock.calls[0][0]).toMatchObject({ kind: "post", id: "95", to: "Buxoro viloyati" });

    // Hech qayerda viloyat yo'q — «Qayerga» chekda chiqmaydi (`to: null`), «Viloyat #» emas.
    await user.click(screen.getByRole("button", { name: "№95: chekni qayta chiqarish" }));
    await waitFor(() => expect(mocks.printPostWithOrders).toHaveBeenCalledTimes(2));
    expect(mocks.printPostWithOrders.mock.calls[1][0].to).toBeNull();
  });

  it("warns before printing when orders have no QR token and shows a retryable error when printing fails", async () => {
    const user = userEvent.setup();
    mocks.printPostWithOrders.mockRejectedValueOnce(new Error("jsPDF"));
    vi.spyOn(api, "get").mockResolvedValue({ data: { data: [{ id: "o1", qr_code_token: null }] } });
    renderOld("admin", "/mails/old", "card");

    await user.click(screen.getByRole("button", { name: "№90: chekni qayta chiqarish" }));
    expect(await screen.findByText("1 ta buyurtmada QR yo'q")).toBeInTheDocument();
    // Eski javobda `post` meta'si (va uning tokeni) yo'q — pochta cheki ham «QR yo'q» bilan chiqadi: oldindan aytiladi.
    expect(await screen.findByText("Pochta chekida QR yo'q")).toBeInTheDocument();
    expect(await screen.findByText("Chek chop etilmadi")).toBeInTheDocument();

    mocks.printPostWithOrders.mockResolvedValueOnce({ orders: 1, pages: 2, jobs: 1, withoutQr: 1, delivery: ["printed"] });
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    await waitFor(() => expect(mocks.printPostWithOrders).toHaveBeenCalledTimes(2));
  });

  it("warns when the mail has no orders and reports a reprint failure", async () => {
    const user = userEvent.setup();
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: { data: [] } });
    renderOld("admin", "/mails/old", "card");

    await user.click(screen.getByRole("button", { name: "№90: chekni qayta chiqarish" }));
    expect(await screen.findByText("Buyurtmalar topilmadi")).toBeInTheDocument();
    expect(mocks.printPostWithOrders).not.toHaveBeenCalled();

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

  it("region filter offers every region from `GET /region` ({ data: [...] }), not only the current page's ones", async () => {
    mocks.useGetRegions.mockReturnValue({
      data: {
        statusCode: 200,
        data: [
          { id: "2", name: "Buxoro" },
          { id: "3", name: "Andijon" },
          { id: "9", name: "Xorazm" },
          { id: "12", name: "Surxondaryo" },
        ],
      },
      isLoading: false,
    });
    const user = userEvent.setup();
    renderOld("admin", "/mails/old", "card");

    await user.click(screen.getByRole("combobox", { name: "Viloyat" }));
    const names = screen.getAllByRole("option").map((option) => option.textContent);
    expect(names).toEqual(expect.arrayContaining(["Xorazm", "Surxondaryo", "Buxoro", "Andijon"]));

    await user.click(screen.getByRole("option", { name: "Xorazm" }));
    expect(lastListParams()).toEqual({ page: 1, limit: 8, has_orders: true, region_id: "9" });
  });

  it("«Viloyat» filtri viloyatlar kam bo'lsa ham qidiruvli (ega qarori 2026-11-09, «Bugungi» bilan bir xil)", async () => {
    mocks.useGetRegions.mockReturnValue({
      data: { statusCode: 200, data: [{ id: "2", name: "Buxoro" }, { id: "3", name: "Andijon" }, { id: "9", name: "Xorazm" }] },
      isLoading: false,
    });
    const user = userEvent.setup();
    renderOld("admin", "/mails/old", "card");

    const field = screen.getByRole("combobox", { name: "Viloyat" });
    expect(field.tagName).toBe("INPUT");
    // Nom ichidagi qism ham topiladi: «xor» → Buxoro va Xorazm; «xora» → faqat Xorazm.
    await user.type(field, "xor");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Buxoro", "Xorazm"]);
    await user.type(field, "a");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Xorazm"]);
    await user.keyboard("{Enter}");
    expect(lastListParams()).toEqual({ page: 1, limit: 8, has_orders: true, region_id: "9" });
  });

  it("region filter falls back to the page's regions when `GET /region` gave nothing", async () => {
    mocks.useGetRegions.mockReturnValue({ data: undefined, isLoading: false });
    const user = userEvent.setup();
    renderOld("admin", "/mails/old", "card");

    await user.click(screen.getByRole("combobox", { name: "Viloyat" }));
    expect(screen.getByRole("option", { name: "Andijon" })).toBeInTheDocument();
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
    expect(within(table).queryByRole("columnheader", { name: "Filial" })).not.toBeInTheDocument();
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

  it("uses every batch page, not only the newest 100 (client filters over all of them); no summary (2026-11-10)", async () => {
    const many = Array.from({ length: 130 }, (_, index) => batch(String(1000 + index), index % 2 ? "received" : "cancelled"));
    mocks.fetchAllTransferBatches.mockResolvedValue({ data: many, capped: false });
    renderOld("superadmin", "/mails/old?batch_mode=all", "card");

    expect(await screen.findByText("1–8 / 130 ta paket")).toBeInTheDocument();
    expect(summaryLines()).toEqual([]);
    expect(screen.queryByText(/1[\s\u00a0]820 ta buyurtma|414[\s\u00a0]180[\s\u00a0]000/)).not.toBeInTheDocument();
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

  it.each([
    ["manager", "list"],
    ["registrator", "table"],
  ])("%s has no view switch and batch_mode in the URL is ignored", (role, view) => {
    renderOld(role, "/mails/old?batch_mode=all", "card");

    expect(screen.queryByRole("radiogroup", { name: "Ko'rinish" })).not.toBeInTheDocument();
    expect(screen.getByRole(view as "list" | "table", { name: "Eski pochtalar" })).toBeInTheDocument();
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

  it("uses the courier endpoint, hides the courier filter, shows date cards and reprints with a text button", () => {
    renderOld("courier", "/mails/old?courier_id=7&region_id=2");

    // `courier_id` kuryerda yuborilmaydi (backend — JWT egasi).
    expect(mocks.useGetOldMails).toHaveBeenCalledWith(true, { page: 1, limit: 8, has_orders: true, region_id: "2" }, LIST_OPTIONS);
    expect(mocks.useGetCouriers).toHaveBeenCalledWith({ status: "active", limit: 100 }, false);
    expect(screen.queryByRole("combobox", { name: "Kuryer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Ko'rinish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Eski pochtalar" });
    const links = within(list).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/mails/90", "/mails/91", "/mails/92"]);
    expect(within(links[0]).getByText(dateOf(MAILS[0].createdAt))).toBeInTheDocument();
    expect(within(links[0]).getByText("Pochta №90")).toBeInTheDocument();
    // Kuryerning o'z ro'yxatida kuryer nomi kartada yo'q.
    expect(within(list).queryByText(/Kuryer:/)).not.toBeInTheDocument();
    expect(within(list).getByRole("button", { name: "Pochta №90: chekni qayta chiqarish" })).toHaveTextContent(
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

  it("HQ manager cards: «Pochta №X» title, «Kuryer: … · viloyat» sub-line (manager-mails-old)", () => {
    renderOld("manager", "/mails/old", "card", "HQ");

    const cards = screen.getByRole("list");
    expect(within(cards).getByText("Pochta №90")).toBeInTheDocument();
    expect(within(cards).getByText(/Kuryer: Buxaro Courier · Buxoro/)).toBeInTheDocument();
  });

  it("390px, 2026-11-10: xulosa yo'q; segmentsiz rolda (menejer) bo'sh asboblar qatori ham yo'q", () => {
    mocks.useGetOldMails.mockReturnValue(mailsResult(MAILS, { total: 46, orders_total: 684, amount_total: 128_360_000 }));
    renderOld("manager", "/mails/old", "card");

    expect(summaryLines()).toEqual([]);
    expect(screen.queryByText(/684/)).not.toBeInTheDocument();
    // Filtrlar qatori kartaning birinchi bo'lagi — tepada 16 px (asboblar qatori o'rnida).
    const filters = screen.getByRole("button", { name: /^Filtrlar/ }).closest("div.flex-col");
    expect(filters).toHaveClass("pt-4");
    expect(filters?.previousElementSibling).toBeNull();
  });

  it("390px admin: «Pochtalar | Filial paketlari» segmenti qoladi, xulosa yo'q", () => {
    mocks.useGetOldMails.mockReturnValue(mailsResult(MAILS, { total: 46, orders_total: 684, amount_total: 128_360_000 }));
    renderOld("admin", "/mails/old", "card");

    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    expect(summaryLines()).toEqual([]);
    expect(screen.getByRole("button", { name: /^Filtrlar/ }).closest("div.flex-col")).toHaveClass("pt-3");
  });

  it("branch manager phone: one list of date cards, the reprint button outside the link", () => {
    renderOld("manager", "/mails/old", "card", "REGIONAL");

    const list = screen.getByRole("list", { name: "Eski pochtalar" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(within(list).getByRole("link", { name: /^Pochta №90, .+, Qabul qilingan, Buxoro, 3 ta buyurtma, 650 000 so'm — ochish$/ })).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: "№90: chekni qayta chiqarish" }).closest("a")).toBeNull();
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
