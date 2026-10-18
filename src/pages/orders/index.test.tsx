import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { vi, type MockInstance } from "vitest";
import Orders from "./index";
import { renderWithProviders } from "../../test/test-utils";
import { api } from "../../shared/api/api";
import type { DataTableSort as SortConfig } from "../../shared/ui/primitives";

/** `MemoryRouter` brauzer manzilini o'zgartirmaydi — URL `useLocation`dan o'qiladi. */
const LocationProbe = () => {
  const { search } = useLocation();
  return <span data-testid="search">{search}</span>;
};

const orderRows = Array.from({ length: 10 }, (_, i) => ({
  id: `o-${i}`,
  status: "waiting",
  total_price: 1000 * (i + 1),
  created_at: "2026-09-20T10:00:00.000Z",
}));

const ordersResponse: { total: number; search_truncated: boolean; rows: { id: string }[] } = {
  total: 25,
  search_truncated: false,
  rows: orderRows,
};
const getOrdersMock = vi.fn((params: { page: number; limit: number }) => ({
  data: {
    data: ordersResponse.rows,
    total: ordersResponse.total,
    page: params.page,
    limit: params.limit,
    search_truncated: ordersResponse.search_truncated,
  },
  isLoading: false,
}));

vi.mock("../../entities/order/api/orderApi", () => ({
  useOrders: () => ({
    useGetOrders: (params: { page: number; limit: number }) => getOrdersMock(params),
  }),
}));

const idleMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

vi.mock("../../entities/orders", () => ({
  useOrders: () => ({
    SellOrder: idleMutation,
    PartlySellOrder: idleMutation,
    CancelOrder: idleMutation,
    RollbackOrder: idleMutation,
    SendToPost: idleMutation,
  }),
}));

vi.mock("../../entities/markets", () => ({
  useMarkets: () => ({
    useGetMarkets: () => ({ data: undefined, isLoading: false }),
  }),
}));

vi.mock("./list/OrderFilters", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./list/OrderFilters")>()),
  default: () => null,
}));

vi.mock("./list/OrdersTable", () => ({
  default: ({
    data,
    pinnedOrderId,
    sortConfig,
    onSortChange,
  }: {
    data: { id: string }[];
    pinnedOrderId?: string;
    sortConfig: SortConfig | null;
    onSortChange: (config: SortConfig | null) => void;
  }) => (
    <div
      data-testid="orders-table"
      data-sort={sortConfig ? `${sortConfig.key}:${sortConfig.direction}` : ""}
      data-ids={data.map((order) => order.id).join(",")}
      data-pinned={pinnedOrderId ?? ""}
    >
      <button type="button" onClick={() => onSortChange({ key: "total_price", direction: "desc" })}>
        sort-by-price
      </button>
    </div>
  ),
}));

vi.mock("./list/courier/index", () => ({ default: () => null }));
vi.mock("./list/courier/list/SellModal", () => ({ default: () => null }));
vi.mock("./list/courier/list/CancelModal", () => ({ default: () => null }));

const adminState = {
  role: { id: "admin-1", role: "admin", region: null, name: "Admin" },
} as never;

const open = (route: string) =>
  renderWithProviders(
    <>
      <Orders />
      <LocationProbe />
    </>,
    { route, preloadedState: adminState },
  );

const currentSearch = () => new URLSearchParams(screen.getByTestId("search").textContent ?? "");

const regionalManagerState = {
  role: { id: "300", role: "manager", region: null, name: "Menejer" },
  user: {
    user: { id: "300", role: "manager", branch: { id: "15", type: "REGIONAL" } },
    isAuthenticated: true,
    accessToken: null,
    loading: false,
    isAppInitializing: false,
    error: null,
  },
} as never;

describe("Orders list — buyurtma yaratish", () => {
  it("ro'yxatda yaratish tugmasi yo'q (yaratish 'Qabul va yaratish' sahifasida)", () => {
    open("/orders");

    expect(screen.queryByRole("button", { name: /Yangi buyurtma/i })).not.toBeInTheDocument();
  });

  it("sarlavhada «Buyurtma yaratish» — yaratish sahifasiga havola (maket `superadmin-orders-list`)", () => {
    open("/orders");

    expect(screen.getByRole("link", { name: "Buyurtma yaratish" })).toHaveAttribute("href", "/new-orders/create");
  });

  it("yaratish huquqi yo'q menejerda (REGIONAL, `intake` yo'q) havola ko'rinmaydi", () => {
    renderWithProviders(<Orders />, { route: "/orders", preloadedState: regionalManagerState });

    expect(screen.queryByRole("link", { name: "Buyurtma yaratish" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excelga yuklash" })).toBeInTheDocument();
  });
});

describe("Orders list — sarlavha, tablar, sahifalash", () => {
  beforeEach(() => {
    getOrdersMock.mockClear();
    ordersResponse.total = 25;
    ordersResponse.search_truncated = false;
    ordersResponse.rows = orderRows;
  });

  it("sarlavha «Buyurtmalar» va jami son", () => {
    open("/orders");

    expect(screen.getByRole("heading", { level: 1, name: "Buyurtmalar" })).toBeInTheDocument();
    expect(screen.getByText("Jami 25 ta buyurtma")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Buyurtmalar ro'yxati" })).toBeInTheDocument();
  });

  it("«Excelga yuklash» — marketda maslahat bilan, boshqalarda maslahatsiz", () => {
    const { unmount } = open("/orders");
    expect(screen.getByRole("button", { name: "Excelga yuklash" })).not.toHaveAttribute("title");
    unmount();

    renderWithProviders(<Orders />, {
      route: "/orders",
      preloadedState: { role: { id: "m-1", role: "market", region: null, name: "Market" } } as never,
    });
    expect(screen.getByRole("button", { name: "Excelga yuklash" })).toHaveAttribute(
      "title",
      "Filtrga mos barcha sahifalar Excel faylga yuklanadi",
    );
  });

  it("holat tablari: «Barchasi» tanlangan, sakkizta tab, izohlar", () => {
    open("/orders");

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Barchasi",
      "Yangi",
      "Qabul qilindi",
      "Yo'lda",
      "Kutilmoqda",
      "Sotilgan",
      "To'langan",
      "Bekor qilingan",
    ]);
    expect(screen.getByRole("tablist", { name: "Holat bo'yicha" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Barchasi" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "To'langan" })).toHaveAttribute("title", "To'langan va qisman to'langan buyurtmalar");
  });

  it("tab bosilsa holat va 1-sahifa bitta URL yangilanishida yoziladi", async () => {
    const user = userEvent.setup();
    open("/orders?page=3");

    await user.click(screen.getByRole("tab", { name: "Bekor qilingan" }));

    await waitFor(() => expect(currentSearch().get("status")).toBe("cancelled,cancelled (sent)"));
    expect(currentSearch().get("page")).toBe("1");
    expect(screen.getByRole("tab", { name: "Bekor qilingan" })).toHaveAttribute("aria-selected", "true");
    expect(getOrdersMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: ["cancelled", "cancelled (sent)"], page: 1 }),
    );
    expect(screen.getByRole("region", { name: "Bekor qilingan buyurtmalar" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "To'langan" }));
    await waitFor(() => expect(currentSearch().get("status")).toBe("paid,partly_paid"));

    await user.click(screen.getByRole("tab", { name: "Barchasi" }));
    await waitFor(() => expect(currentSearch().get("status")).toBeNull());
  });

  it("eski menejer havolasi (`orderStatus=waiting`) — «Kutilmoqda» tabi", async () => {
    open("/orders?orderStatus=waiting");

    await waitFor(() => expect(currentSearch().get("status")).toBe("waiting"));
    expect(screen.getByRole("tab", { name: "Kutilmoqda" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("region", { name: "Kutilayotgan buyurtmalar" })).toBeInTheDocument();
  });

  it("Holat filtridan boshqa to'plam — birorta tab tanlanmaydi", () => {
    open("/orders?status=new,sold");

    for (const tab of screen.getAllByRole("tab")) expect(tab).toHaveAttribute("aria-selected", "false");
    expect(getOrdersMock).toHaveBeenLastCalledWith(expect.objectContaining({ status: ["new", "sold"] }));
  });

  it("sahifalash kartaning pastida: xulosa va sahifa almashishi", async () => {
    const user = userEvent.setup();
    open("/orders");

    expect(screen.getByText("1–10 / 25 ta buyurtma")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "2" }));

    await waitFor(() => expect(currentSearch().get("page")).toBe("2"));
    expect(getOrdersMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });

  it("ro'yxat bo'sh bo'lsa sahifalash chiqmaydi", () => {
    ordersResponse.total = 0;
    ordersResponse.rows = [];
    open("/orders");

    expect(screen.queryByRole("navigation", { name: "Sahifalar" })).not.toBeInTheDocument();
  });

  it("sahifa ro'yxat oxiridan tashqarida qolsa (bo'sh sahifa, jami > 0) — oxirgi sahifaga o'tadi", async () => {
    ordersResponse.total = 25;
    ordersResponse.rows = [];
    open("/orders?page=5");

    await waitFor(() => expect(currentSearch().get("page")).toBe("3"));
    expect(getOrdersMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }));
  });

  it("birinchi yuklanishda «Jami 0 ta» yozilmaydi (son hali noma'lum)", () => {
    const implementation = getOrdersMock.getMockImplementation();
    getOrdersMock.mockImplementation(() => ({ data: undefined, isLoading: true }) as never);
    try {
      open("/orders");
      expect(screen.queryByText(/^Jami \d+ ta buyurtma$/)).not.toBeInTheDocument();
      expect(screen.queryByRole("navigation", { name: "Sahifalar" })).not.toBeInTheDocument();
    } finally {
      if (implementation) getOrdersMock.mockImplementation(implementation);
    }
  });
});

describe("Orders list sorting", () => {
  beforeEach(() => {
    getOrdersMock.mockClear();
    ordersResponse.total = 25;
    ordersResponse.search_truncated = false;
  });

  it("restores the sort from the URL after a refresh and keeps the saved page", () => {
    open("/orders?orderSortBy=total_price&orderSortDir=desc&page=2");

    expect(screen.getByTestId("orders-table")).toHaveAttribute("data-sort", "total_price:desc");
    expect(getOrdersMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });

  it("writes a new sort to the URL together with page 1", async () => {
    const user = userEvent.setup();
    open("/orders?page=3");

    await user.click(screen.getByRole("button", { name: "sort-by-price" }));

    await waitFor(() => expect(currentSearch().get("orderSortBy")).toBe("total_price"));
    expect(currentSearch().get("orderSortDir")).toBe("desc");
    expect(currentSearch().get("page")).toBe("1");
    expect(screen.getByTestId("orders-table")).toHaveAttribute("data-sort", "total_price:desc");
    expect(getOrdersMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
  });

  it("keeps an active filter while sorting (both apply at once)", () => {
    open("/orders?orderMarketId=5&orderSortBy=status&orderSortDir=asc");

    expect(screen.getByTestId("orders-table")).toHaveAttribute("data-sort", "status:asc");
    expect(getOrdersMock).toHaveBeenLastCalledWith(expect.objectContaining({ market_id: "5" }));
  });

  it("sends the sort to the server so it covers the whole list, not just this page", () => {
    open("/orders?orderSortBy=total_price&orderSortDir=desc");
    expect(getOrdersMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort_by: "total_price", sort_dir: "desc" }),
    );
  });

  it("maps the date column to the API field and keeps no sort params without a sort", () => {
    const { unmount } = open("/orders?orderSortBy=createdAt&orderSortDir=asc");
    expect(getOrdersMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort_by: "created_at", sort_dir: "asc" }),
    );
    unmount();

    getOrdersMock.mockClear();
    open("/orders");
    const params = getOrdersMock.mock.lastCall?.[0] as Record<string, unknown>;
    expect(params).not.toHaveProperty("sort_by");
    expect(params).not.toHaveProperty("sort_dir");
  });

  it("ignores a URL sort the server cannot do (old customer-name link)", () => {
    open("/orders?orderSortBy=customer&orderSortDir=asc");

    expect(screen.getByTestId("orders-table")).toHaveAttribute("data-sort", "");
    expect(getOrdersMock.mock.lastCall?.[0]).not.toHaveProperty("sort_by");
  });

  it("no longer shows the current-page-only sort note", () => {
    open("/orders?orderSortBy=total_price&orderSortDir=asc");

    expect(screen.queryByText(/faqat shu sahifadagi/)).not.toBeInTheDocument();
  });
});

describe("Orders list search", () => {
  beforeEach(() => {
    getOrdersMock.mockClear();
    ordersResponse.total = 25;
    ordersResponse.search_truncated = false;
  });

  it("warns that the results are incomplete when the server cut the customer list", () => {
    ordersResponse.search_truncated = true;
    open("/orders?orderSearch=ali");

    expect(screen.getByRole("note")).toHaveTextContent(
      "Natija to'liq emas. Qidiruvga juda ko'p mijoz mos keldi — ism, telefon yoki raqamni to'liqroq yozing.",
    );
  });

  it("shows no warning when the search result is complete", () => {
    open("/orders?orderSearch=ali");

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });
});

describe("Orders list search by exact order number", () => {
  const exactOrder = { id: "1", status: "new", total_price: 55000, created_at: "2026-09-01T10:00:00.000Z" };
  const pageIds = orderRows.map((order) => order.id).join(",");
  let getSpy: MockInstance<typeof api.get>;

  beforeEach(() => {
    getOrdersMock.mockClear();
    ordersResponse.total = 25;
    ordersResponse.search_truncated = false;
    ordersResponse.rows = orderRows;
    // GET /orders/{id} — javob `{ statusCode, message, data: order }` qobig'ida keladi.
    getSpy = vi.spyOn(api, "get").mockResolvedValue({ data: { statusCode: 200, message: "ok", data: exactOrder } });
  });

  afterEach(() => {
    getSpy.mockRestore();
  });

  const settleLookup = async () => {
    await waitFor(() => expect(getSpy).toHaveBeenCalled());
    await act(async () => {
      await Promise.allSettled(getSpy.mock.results.map((result) => result.value));
    });
  };

  it("puts the order whose number equals the search first, even when the server ranked it pages away", async () => {
    open("/orders?orderSearch=1");

    await waitFor(() => expect(screen.getByTestId("orders-table")).toHaveAttribute("data-pinned", "1"));
    expect(getSpy).toHaveBeenCalledWith("orders/1");
    expect(screen.getByTestId("orders-table")).toHaveAttribute("data-ids", `1,${pageIds}`);
  });

  it("does not show the exact order twice when the server already returned it on this page", async () => {
    ordersResponse.rows = [orderRows[0], { ...exactOrder }, orderRows[1]];
    open("/orders?orderSearch=1");

    await waitFor(() => expect(screen.getByTestId("orders-table")).toHaveAttribute("data-pinned", "1"));
    expect(screen.getByTestId("orders-table")).toHaveAttribute("data-ids", "1,o-0,o-1");
  });

  it("pins only on the first page", async () => {
    open("/orders?orderSearch=1&page=2");
    await settleLookup();

    expect(screen.getByTestId("orders-table")).toHaveAttribute("data-pinned", "");
    expect(screen.getByTestId("orders-table")).toHaveAttribute("data-ids", pageIds);
  });

  it("does not look up an order for a search that is not a plain number", async () => {
    open("/orders?orderSearch=ali");
    open("/orders?orderSearch=%2B998901234567");

    await act(async () => {});
    expect(getSpy).not.toHaveBeenCalledWith(expect.stringMatching(/^orders\//));
  });

  it("adds nothing when there is no such order or the user may not see it", async () => {
    getSpy.mockRejectedValue(Object.assign(new Error("Not found"), { response: { status: 404 } }));
    open("/orders?orderSearch=999999");
    await settleLookup();

    expect(screen.getByTestId("orders-table")).toHaveAttribute("data-pinned", "");
    expect(screen.getByTestId("orders-table")).toHaveAttribute("data-ids", pageIds);
  });

  it("ignores a lookup answer for a different order", async () => {
    getSpy.mockResolvedValue({ data: { data: { ...exactOrder, id: "10" } } });
    open("/orders?orderSearch=1");
    await settleLookup();

    expect(screen.getByTestId("orders-table")).toHaveAttribute("data-pinned", "");
  });
});

describe("Orders list — URL sanitizatsiyasi va sahifa almashishi (QA D-03, D-08, D-11)", () => {
  beforeEach(() => {
    getOrdersMock.mockClear();
    ordersResponse.total = 25;
    ordersResponse.search_truncated = false;
    ordersResponse.rows = orderRows;
  });

  it("⭐ D-08: `?limit=5000` — API'ga 10 ketadi (backend faqat 10/25/50/100 ni qabul qiladi)", () => {
    open("/orders?limit=5000");
    expect(getOrdersMock).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 10 }));
  });

  it("D-08: ruxsat etilgan limit saqlanadi", () => {
    open("/orders?limit=50");
    expect(getOrdersMock).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 50 }));
  });

  it("⭐ D-08: noto'g'ri sana (`?startDay=falonchi`, `2026-02-30`) API'ga ketmaydi, to'g'risi ketadi", () => {
    open("/orders?startDay=falonchi&endDay=2026-02-30");
    const params = getOrdersMock.mock.lastCall?.[0] as Record<string, unknown>;
    expect(params).not.toHaveProperty("start_day");
    expect(params).not.toHaveProperty("end_day");

    open("/orders?startDay=2026-10-01&endDay=2026-10-08");
    expect(getOrdersMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ start_day: "2026-10-01", end_day: "2026-10-08" }),
    );
  });

  it("⭐ D-11: faqat bo'shliqli qidiruv — `search` ketmaydi; «№53» → «53»", () => {
    open("/orders?orderSearch=%20%20%20");
    expect(getOrdersMock.mock.lastCall?.[0]).not.toHaveProperty("search");

    open("/orders?orderSearch=%E2%84%9653");
    expect(getOrdersMock).toHaveBeenLastCalledWith(expect.objectContaining({ search: "53" }));
  });

  it("⭐ D-03: sahifa almashganda shell kontenti tepaga qaytadi", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <main>
        <div data-shell-slot="content">
          <Orders />
          <LocationProbe />
        </div>
      </main>,
      { route: "/orders", preloadedState: adminState },
    );
    const main = document.querySelector("main") as HTMLElement;
    main.scrollTop = 829;

    await user.click(screen.getByRole("button", { name: "2" }));

    await waitFor(() => expect(currentSearch().get("page")).toBe("2"));
    expect(main.scrollTop).toBe(0);
  });
});

describe("Orders list — Excel eksporti (xWsCAA5N)", () => {
  let getSpy: MockInstance;
  let clickSpy: MockInstance;
  const downloads: string[] = [];

  const exportResponse = (headers: Record<string, string>) => ({
    data: new Blob(["PK"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    headers,
  });

  beforeEach(() => {
    downloads.length = 0;
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
  });

  afterEach(() => {
    getSpy?.mockRestore();
    clickSpy.mockRestore();
  });

  const exportCalls = () => getSpy.mock.calls.filter(([url]) => url === "orders/export/excel");

  it("⭐ TC3+TC4: BITTA `GET orders/export/excel` (joriy filtrlar, sahifasiz, blob) — .xlsx `Content-Disposition` nomi bilan, «Excelga saqlandi»", async () => {
    const user = userEvent.setup();
    getSpy = vi.spyOn(api, "get").mockResolvedValue(
      exportResponse({
        "content-disposition": 'attachment; filename="barcha_buyurtmalar_2026-10-17.xlsx"',
        "x-export-total": "248",
        "x-export-limit": "50000",
        "x-export-truncated": "false",
      }),
    );
    open("/orders?orderSearch=Ali&where_deliver=address");

    await user.click(screen.getByRole("button", { name: "Excelga yuklash" }));

    await waitFor(() => expect(exportCalls()).toHaveLength(1));
    const [, config] = exportCalls()[0];
    expect(config).toMatchObject({ responseType: "blob", params: { search: "Ali", where_deliver: "address" } });
    expect(config.params).not.toHaveProperty("page");
    expect(config.params).not.toHaveProperty("limit");
    // Eski sahifalash sikli yo'q — `GET /orders?page=N` eksport uchun chaqirilmaydi.
    expect(getSpy.mock.calls.filter(([url]) => url === "orders")).toHaveLength(0);
    expect(downloads).toEqual(["barcha_buyurtmalar_2026-10-17.xlsx"]);
    expect((await screen.findAllByText("Excelga saqlandi")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("248 ta buyurtma Excelga saqlandi.").length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByRole("button", { name: "Excelga yuklash" })).not.toHaveAttribute("aria-busy"));
  });

  it("⭐ TC2: chegaradan oshsa (`X-Export-Truncated`) — fayl saqlanadi va aniq ogohlantirish (jim kesilmaydi)", async () => {
    const user = userEvent.setup();
    getSpy = vi.spyOn(api, "get").mockResolvedValue(
      exportResponse({
        "content-disposition": 'attachment; filename="barcha_buyurtmalar_2026-10-17.xlsx"',
        "x-export-total": "61234",
        "x-export-limit": "50000",
        "x-export-truncated": "true",
      }),
    );
    open("/orders");

    await user.click(screen.getByRole("button", { name: "Excelga yuklash" }));

    expect((await screen.findAllByText("Fayl to'liq emas")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Faylda 50 000 ta, jami 61 234 ta buyurtma — filtrni toraytiring.").length).toBeGreaterThan(0);
    expect(downloads).toHaveLength(1);
    expect(screen.queryByText("Excelga saqlandi")).toBeNull();
  });

  it("filtrga mos buyurtma yo'q (`X-Export-Total: 0`) — fayl saqlanmaydi, ogohlantirish", async () => {
    const user = userEvent.setup();
    getSpy = vi.spyOn(api, "get").mockResolvedValue(exportResponse({ "x-export-total": "0", "x-export-truncated": "false" }));
    open("/orders");

    await user.click(screen.getByRole("button", { name: "Excelga yuklash" }));

    expect((await screen.findAllByText("Filtrga mos buyurtma yo'q — Excel fayl yaratilmadi")).length).toBeGreaterThan(0);
    expect(downloads).toHaveLength(0);
  });

  it("xato (blob ichida JSON) — backend matni va «Qayta urinish» eksportni qaytaradi", async () => {
    const user = userEvent.setup();
    const error = Object.assign(new Error("403"), {
      response: { status: 403, data: new Blob([JSON.stringify({ message: "Eksportga ruxsat yo'q" })], { type: "application/json" }) },
    });
    getSpy = vi.spyOn(api, "get").mockRejectedValue(error);
    open("/orders");

    await user.click(screen.getByRole("button", { name: "Excelga yuklash" }));

    expect((await screen.findAllByText("Excel fayl yuklanmadi")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Eksportga ruxsat yo'q").length).toBeGreaterThan(0);
    expect(downloads).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    await waitFor(() => expect(exportCalls()).toHaveLength(2));
  });

  it("eksport ketayotganda eski xatodagi «Qayta urinish» ikkinchi so'rov yubormaydi; natija eski xato o'rnini oladi", async () => {
    const user = userEvent.setup();
    let resolveSecond: (value: unknown) => void = () => {};
    getSpy = vi
      .spyOn(api, "get")
      .mockRejectedValueOnce(Object.assign(new Error("503"), { response: { status: 503, data: new Blob(["{}"]) } }))
      .mockImplementationOnce(() => new Promise((resolve) => (resolveSecond = resolve)));
    open("/orders");

    await user.click(screen.getByRole("button", { name: "Excelga yuklash" }));
    const staleRetry = await screen.findByRole("button", { name: "Qayta urinish" });

    // Yangi eksport boshlandi (javob hali yo'q) — eski xabardagi «Qayta urinish» bosilsa ham so'rov qo'shilmaydi.
    await user.click(screen.getByRole("button", { name: "Excelga yuklash" }));
    await waitFor(() => expect(exportCalls()).toHaveLength(2));
    fireEvent.click(staleRetry);
    expect(exportCalls()).toHaveLength(2);

    resolveSecond(
      exportResponse({
        "content-disposition": 'attachment; filename="barcha_buyurtmalar_2026-10-17.xlsx"',
        "x-export-total": "3",
        "x-export-truncated": "false",
      }),
    );
    expect((await screen.findAllByText("Excelga saqlandi")).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryByText("Excel fayl yuklanmadi")).toBeNull());
    expect(downloads).toEqual(["barcha_buyurtmalar_2026-10-17.xlsx"]);
    expect(exportCalls()).toHaveLength(2);
  });

  it("`Content-Disposition` o'qilmasa — zaxira nom «barcha_buyurtmalar_<bugun>.xlsx» (mahalliy sana)", async () => {
    const user = userEvent.setup();
    getSpy = vi.spyOn(api, "get").mockResolvedValue(exportResponse({ "x-export-total": "5", "x-export-truncated": "false" }));
    open("/orders");

    await user.click(screen.getByRole("button", { name: "Excelga yuklash" }));

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    await waitFor(() => expect(downloads).toEqual([`barcha_buyurtmalar_${today}.xlsx`]));
  });

  it("javob umuman kelmasa (internet yo'q / vaqt tugadi) — ikkinchi xabar yo'q (global «Internet aloqasi yo'q» yetarli)", async () => {
    const user = userEvent.setup();
    const { AxiosError } = await import("axios");
    getSpy = vi.spyOn(api, "get").mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));
    open("/orders");

    await user.click(screen.getByRole("button", { name: "Excelga yuklash" }));

    await waitFor(() => expect(exportCalls()).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Excelga yuklash" })).not.toHaveAttribute("aria-busy"));
    expect(screen.queryByText("Excel fayl yuklanmadi")).toBeNull();
    expect(downloads).toHaveLength(0);
  });

  it("server/tarmoq xatosi (504, javobsiz) — inglizcha «Gateway Timeout» emas, taxtadagi matn", async () => {
    const user = userEvent.setup();
    getSpy = vi.spyOn(api, "get").mockRejectedValue(
      Object.assign(new Error("504"), {
        response: { status: 504, data: new Blob([JSON.stringify({ message: "Gateway Timeout" })], { type: "application/json" }) },
      }),
    );
    open("/orders");

    await user.click(screen.getByRole("button", { name: "Excelga yuklash" }));

    expect((await screen.findAllByText("Server javob bermadi. Birozdan keyin qayta urinib ko'ring.")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Gateway Timeout")).toBeNull();
  });
});
