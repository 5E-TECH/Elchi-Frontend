import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import OrdersTable from "./OrdersTable";
import { renderWithProviders } from "../../../test/test-utils";

const orders = [
  {
    id: "o-1",
    customer: { name: "Ali", phone_number: "+998901234567" },
    district: { name: "Yunusobod", region: { name: "Toshkent" } },
    market: { name: "Fresh Market" },
    status: "sold",
    where_deliver: "center",
    total_price: 250000,
    createdAt: "2026-04-06T10:00:00.000Z",
  },
];

/** Telefon (< 768): `DataTable` jadval o'rniga kartalar chizadi (`matchMedia`). */
const mockPhone = () =>
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query === "(max-width: 767px)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );

afterEach(() => {
  vi.restoreAllMocks();
});

const bodyRows = () => screen.getAllByRole("row").slice(1);

describe("OrdersTable", () => {
  it("renders order row data", () => {
    renderWithProviders(<OrdersTable data={orders as never} isLoading={false} />);

    const [row] = bodyRows();
    const cells = within(row).getAllByRole("cell");
    expect(within(cells[1]).getByText("Ali")).toBeInTheDocument();
    expect(within(cells[1]).getByText("+998 90 123 45 67")).toBeInTheDocument();
    expect(within(cells[2]).getByText("Yunusobod")).toBeInTheDocument();
    expect(within(cells[2]).getByText("Toshkent")).toBeInTheDocument();
    expect(cells[3]).toHaveTextContent("Fresh Market");
    expect(within(cells[4]).getByText("Sotilgan")).toBeInTheDocument();
    expect(within(cells[6]).getByText("250 000 so'm")).toBeInTheDocument();
  });

  it("v2 ustunlari: tartib, planshetda yashirinadiganlar va summa o'ngda", () => {
    renderWithProviders(<OrdersTable data={orders as never} isLoading={false} />);

    const headers = screen.getAllByRole("columnheader");
    expect(headers.map((header) => header.textContent)).toEqual([
      "Buyurtma",
      "Mijoz",
      "Tuman / viloyat",
      "Market",
      "Holat",
      "Yetkazish",
      "Summa/ market",
    ]);
    expect(headers[2]).toHaveClass("max-lg:hidden");
    expect(headers[3]).toHaveClass("max-lg:hidden");
    expect(headers[5]).toHaveClass("max-lg:hidden");
    expect(headers[6]).toHaveClass("text-right");
  });

  it("⭐ D-02: uzun mijoz / tuman / market matni kesiladi (`truncate` + eng ko'p kenglik), to'liq matn `title` da", () => {
    const long = "Abdurahmonova Gulchehraxon Abdumalikovna Xolmatova";
    renderWithProviders(
      <OrdersTable
        data={[
          {
            ...orders[0],
            customer: { name: long, phone_number: "+998901112233" },
            market: { name: "Juda uzun nomli market MChJ filial savdo" },
            district: { name: "Mirzo Ulug'bek tumani", region: { name: "Toshkent shahri" } },
          } as never,
        ]}
        isLoading={false}
      />,
    );
    const name = screen.getByText(long);
    expect(name).toHaveClass("truncate");
    expect(name).toHaveAttribute("title", long);
    // O'ram ustunning eng kichik kengligiga qo'shilmaydi (`minmax(0,1fr)`), lekin haddan oshmaydi.
    expect(name.parentElement).toHaveClass("grid", "grid-cols-[minmax(0,1fr)]", "max-w-[260px]");
    // Market ustuni va planshetdagi «Summa / market» qatori — ikkalasi ham kesiladi.
    for (const market of screen.getAllByText("Juda uzun nomli market MChJ filial savdo")) {
      expect(market).toHaveClass("truncate");
    }
    expect(screen.getByText("Mirzo Ulug'bek tumani")).toHaveClass("truncate");
  });

  it("renders loading skeletons", () => {
    renderWithProviders(<OrdersTable data={[]} isLoading />);

    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders empty state", () => {
    renderWithProviders(<OrdersTable data={[]} isLoading={false} />);

    expect(screen.getByText("Buyurtmalar topilmadi")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Filtrlarni tozalash" })).not.toBeInTheDocument();
  });

  it("bo'sh ro'yxatda filtr faol bo'lsa — «Filtrlarni tozalash»", async () => {
    const user = userEvent.setup();
    const onClearFilters = vi.fn();
    renderWithProviders(<OrdersTable data={[]} isLoading={false} onClearFilters={onClearFilters} />);

    await user.click(screen.getByRole("button", { name: "Filtrlarni tozalash" }));
    expect(onClearFilters).toHaveBeenCalled();
  });

  it("hides market column for market role", () => {
    renderWithProviders(<OrdersTable data={orders as never} isLoading={false} />, {
      preloadedState: {
        role: { role: "market", id: "", region: "", name: "" },
      },
    });

    expect(screen.queryByRole("columnheader", { name: "Market" })).not.toBeInTheDocument();
    expect(screen.queryByText("Fresh Market")).not.toBeInTheDocument();
    // Market jadvalida yetkazish turi planshetda ham ko'rinadi.
    expect(screen.getByRole("columnheader", { name: "Yetkazish" })).not.toHaveClass("max-lg:hidden");
  });

  it("renders translated delivery badge", () => {
    renderWithProviders(<OrdersTable data={orders as never} isLoading={false} />);

    expect(screen.getByText("Markazgacha")).toBeInTheDocument();
  });

  it("calls row click handler", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();

    renderWithProviders(
      <OrdersTable data={orders as never} isLoading={false} onRowClick={onRowClick} />,
    );

    await user.click(screen.getByText("Ali"));

    expect(onRowClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "o-1" }),
      0,
    );
  });

  it("allows selecting only unsent cancelled orders", async () => {
    const user = userEvent.setup();
    const onSelectChange = vi.fn();
    const cancelledOrders = [
      { ...orders[0], id: "cancelled-1", status: "cancelled" },
      { ...orders[0], id: "sent-1", status: "cancelled (sent)" },
    ];

    renderWithProviders(
      <OrdersTable
        data={cancelledOrders as never}
        isLoading={false}
        isSelectable={(order) => order.status === "cancelled"}
        selectedIds={new Set()}
        onSelectChange={onSelectChange}
        onSelectAll={vi.fn()}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Sahifadagi jo'natilmagan buyurtmalarni tanlash" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "№sent-1 allaqachon jo'natilgan, tanlab bo'lmaydi" })).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "№cancelled-1 ni tanlash" }));
    expect(onSelectChange).toHaveBeenCalledWith("cancelled-1", true);
  });

  it("tanlangan qator ajralib turadi", () => {
    renderWithProviders(
      <OrdersTable
        data={[{ ...orders[0], status: "cancelled" }] as never}
        isLoading={false}
        isSelectable={() => true}
        selectedIds={new Set(["o-1"])}
        onSelectChange={vi.fn()}
        onSelectAll={vi.fn()}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "№o-1 ni tanlash" })).toBeChecked();
    expect(bodyRows()[0]).toHaveClass("bg-action-soft");
  });

  it("shows the real order id as a link to the order detail", () => {
    renderWithProviders(<OrdersTable data={orders as never} isLoading={false} />);

    expect(screen.getByRole("link", { name: "№o-1" })).toHaveAttribute("href", "/edit/o-1");
  });

  it("copies the order id to the clipboard without triggering the row click", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    renderWithProviders(
      <OrdersTable data={orders as never} isLoading={false} onRowClick={onRowClick} />,
    );

    await user.click(screen.getByRole("button", { name: "№o-1 raqamini nusxalash" }));

    expect(writeText).toHaveBeenCalledWith("o-1");
    expect(onRowClick).not.toHaveBeenCalled();
    expect(await screen.findByText("Buyurtma raqami nusxalandi")).toBeInTheDocument();
  });

  it("does not claim the number was copied when the browser refuses the clipboard write", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")) },
      configurable: true,
    });

    renderWithProviders(<OrdersTable data={orders as never} isLoading={false} />);

    await user.click(screen.getByRole("button", { name: "№o-1 raqamini nusxalash" }));

    expect(await screen.findByText("Nusxa olib bo'lmadi — buyurtma raqami: o-1")).toBeInTheDocument();
    expect(screen.queryByText("Buyurtma raqami nusxalandi")).not.toBeInTheDocument();
  });

  it("makes the status column sortable and reports the click to the parent", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();

    renderWithProviders(
      <OrdersTable
        data={orders as never}
        isLoading={false}
        sortConfig={null}
        onSortChange={onSortChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Holat" }));

    expect(onSortChange).toHaveBeenCalledWith({ key: "status", direction: "asc" });
  });

  it("without a URL sort shows the server default (newest first) on the order column", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    renderWithProviders(
      <OrdersTable data={orders as never} isLoading={false} sortConfig={null} onSortChange={onSortChange} />,
    );

    const byDate = screen.getByRole("button", { name: "Buyurtma" });
    expect(byDate).toHaveAttribute("aria-pressed", "true");
    expect(byDate).toHaveAttribute("title", "Sana bo'yicha saralash");
    expect(screen.getByRole("columnheader", { name: "Buyurtma" })).toHaveAttribute("aria-sort", "descending");

    await user.click(byDate);
    expect(onSortChange).toHaveBeenCalledWith({ key: "createdAt", direction: "asc" });
  });

  it("keeps the server's row order when sorted (the whole list is sorted on the server)", () => {
    const serverSortedOrders = [
      { ...orders[0], id: "sold-1", status: "sold" },
      { ...orders[0], id: "new-1", status: "new" },
      { ...orders[0], id: "cancelled-1", status: "cancelled" },
    ];

    renderWithProviders(
      <OrdersTable
        data={serverSortedOrders as never}
        isLoading={false}
        sortConfig={{ key: "status", direction: "asc" }}
        onSortChange={vi.fn()}
      />,
    );

    const ids = screen.getAllByRole("link", { name: /^№/ }).map((node) => node.textContent);
    expect(ids).toEqual(["№sold-1", "№new-1", "№cancelled-1"]);
  });

  it("does not offer sorting by customer name (the server cannot sort by it)", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();

    renderWithProviders(
      <OrdersTable
        data={orders as never}
        isLoading={false}
        sortConfig={null}
        onSortChange={onSortChange}
      />,
    );

    const customerHeader = screen.getByRole("columnheader", { name: "Mijoz" });
    expect(within(customerHeader).queryByRole("button")).not.toBeInTheDocument();
    await user.click(customerHeader);

    expect(onSortChange).not.toHaveBeenCalled();
  });

  it("marks the pinned exact-number match next to its number (only the first row)", () => {
    const rows = [
      { ...orders[0], id: "1", customer: { name: "Aniq Mijoz", phone_number: "+998901111111" } },
      { ...orders[0], id: "o-2" },
      { ...orders[0], id: "o-3" },
    ];

    renderWithProviders(<OrdersTable data={rows as never} isLoading={false} pinnedOrderId="1" />);

    const badge = within(bodyRows()[0]).getByTestId("exact-match-badge");
    expect(badge).toHaveTextContent("Aniq");
    expect(badge).toHaveAttribute("title", "Qidiruvdagi raqamga aynan mos buyurtma");
    expect(within(bodyRows()[0]).getAllByRole("cell")[0]).toHaveTextContent("№1");
    expect(screen.getAllByTestId("exact-match-badge")).toHaveLength(1);
  });

  it("shows no exact-match badge without a pinned match", () => {
    const rows = [
      { ...orders[0], id: "o-2" },
      { ...orders[0], id: "o-3" },
    ];

    renderWithProviders(<OrdersTable data={rows as never} isLoading={false} />);

    expect(screen.queryByTestId("exact-match-badge")).not.toBeInTheDocument();
  });

  it("shows the exact-match badge on the phone card too", () => {
    mockPhone();
    renderWithProviders(
      <OrdersTable data={[{ ...orders[0], id: "1" }, { ...orders[0], id: "o-2" }] as never} isLoading={false} pinnedOrderId="1" />,
    );

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const badges = screen.getAllByTestId("exact-match-badge");
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent("Aniq");
  });

  it("phone card: one link per order with name, amount, number · district · market and the date", () => {
    mockPhone();
    renderWithProviders(<OrdersTable data={orders as never} isLoading={false} label="Buyurtmalar ro'yxati" />);

    const list = screen.getByRole("list", { name: "Buyurtmalar ro'yxati" });
    const card = within(list).getByRole("link");
    expect(card).toHaveAttribute("href", "/edit/o-1");
    expect(card).toHaveTextContent("Ali");
    expect(card).toHaveTextContent("250 000 so'm");
    expect(card).toHaveTextContent("№o-1 · Yunusobod · Fresh Market");
    expect(card).toHaveTextContent("06.04.2026");
    // Havola ichida tugma yo'q (nusxalash — jadvalda).
    expect(within(card).queryByRole("button")).not.toBeInTheDocument();
  });

  it("market phone card: number · district · date, no market", () => {
    mockPhone();
    renderWithProviders(<OrdersTable data={orders as never} isLoading={false} />, {
      preloadedState: { role: { role: "market", id: "", region: "", name: "" } },
    });

    const card = screen.getByRole("link");
    expect(card).toHaveTextContent(/№o-1 · Yunusobod · 06\.04\.2026/);
    expect(card).not.toHaveTextContent("Fresh Market");
  });

  it("each order is reachable by keyboard through its number link (rows are not buttons)", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    renderWithProviders(<OrdersTable data={orders as never} isLoading={false} onRowClick={onRowClick} />);

    expect(screen.queryByRole("button", { name: /Ali/ })).not.toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole("link", { name: "№o-1" })).toHaveFocus();
  });

  it("shows an error with retry (not \"Buyurtmalar topilmadi\") when the list request failed", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderWithProviders(<OrdersTable data={[]} isLoading={false} isError onRetry={onRetry} />);

    expect(screen.queryByText("Buyurtmalar topilmadi")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Qayta urinish/ }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("keeps the rows (no error screen) when a refetch failed but rows exist", () => {
    renderWithProviders(<OrdersTable data={orders as never} isLoading={false} isError onRetry={vi.fn()} />);

    expect(screen.getByRole("link", { name: "№o-1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Qayta urinish/ })).not.toBeInTheDocument();
  });

  it("«Bekor · yo'lda»: kuryer qatori `transport_status` bilan keladi; ostida «→ maqsad»", () => {
    renderWithProviders(
      <OrdersTable
        data={
          [
            {
              ...orders[0],
              status: "cancelled",
              transport_status: "cancelled (sent)",
              branch: { id: "1", name: "Toshkent HQ" },
            },
          ] as never
        }
        isLoading={false}
      />,
    );

    expect(screen.getByText("Bekor · yo'lda")).toBeInTheDocument();
    expect(screen.getByTestId("cancel-return-place")).toHaveTextContent("→ Toshkent HQ");
  });

  it("bekor bosqichi (tizim-states-data §09): «Bekor · HQ'da» + «Toshkent HQ · 2 kun»; topshirilgani — «Marketga topshirildi»", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000 - 3_600_000).toISOString();
    renderWithProviders(
      <OrdersTable
        data={
          [
            {
              ...orders[0],
              id: "c-1",
              status: "cancelled",
              holder_type: "HQ",
              post_id: "78",
              branch: { id: "1", name: "Toshkent HQ" },
              last_handover_at: twoDaysAgo,
            },
            {
              ...orders[0],
              id: "c-2",
              status: "returned_to_market",
              holder_type: "MARKET",
              branch: { id: "1", name: "Toshkent HQ" },
            },
          ] as never
        }
        isLoading={false}
      />,
    );

    const hqRow = screen.getByRole("link", { name: "№c-1" }).closest("tr") as HTMLElement;
    expect(within(hqRow).getByText("Bekor · HQ'da")).toHaveAttribute("data-cancel-stage", "hq");
    expect(within(hqRow).getByTestId("cancel-return-place")).toHaveTextContent("Toshkent HQ · 2 kun");
    const doneRow = screen.getByRole("link", { name: "№c-2" }).closest("tr") as HTMLElement;
    expect(within(doneRow).getByText("Marketga topshirildi")).toHaveClass("bg-sunken", "text-text-muted");
  });
});

describe("OrdersTable — menejer amallari", () => {
  const actionRows = [
    { ...orders[0], id: "w-1", status: "waiting" },
    { ...orders[0], id: "s-1", status: "sold" },
    { ...orders[0], id: "p-1", status: "paid" },
  ];

  const renderActions = (overrides: Record<string, unknown> = {}) => {
    const handlers = { onSellOrder: vi.fn(), onCancelOrder: vi.fn(), onRollbackOrder: vi.fn() };
    renderWithProviders(
      <OrdersTable
        data={actionRows as never}
        isLoading={false}
        canUseOrderActions={(order) => order.status !== "paid"}
        {...handlers}
        {...overrides}
      />,
    );
    return handlers;
  };

  it("«Amallar» ustuni: kutilmoqda — Sotish + Bekor qilish; sotilgan — Qaytarish; boshqasi — «Amal yo'q»", async () => {
    const user = userEvent.setup();
    const handlers = renderActions();

    expect(screen.getByRole("columnheader", { name: "Amallar" })).toBeInTheDocument();
    const [waiting, sold, paid] = bodyRows();

    await user.click(within(waiting).getByRole("button", { name: "№w-1 ni sotish" }));
    expect(handlers.onSellOrder).toHaveBeenCalledWith(expect.objectContaining({ id: "w-1" }));
    await user.click(within(waiting).getByRole("button", { name: "№w-1 ni bekor qilish" }));
    expect(handlers.onCancelOrder).toHaveBeenCalledWith(expect.objectContaining({ id: "w-1" }));

    const rollback = within(sold).getByRole("button", { name: "№s-1 ni kutilmoqda holatiga qaytarish" });
    expect(rollback).toHaveAttribute("title", "Kutilmoqda holatiga qaytarish");
    expect(rollback).toHaveTextContent("Qaytarish");
    await user.click(rollback);
    expect(handlers.onRollbackOrder).toHaveBeenCalledWith(expect.objectContaining({ id: "s-1" }));
    expect(within(sold).queryByRole("button", { name: /ni sotish/ })).not.toBeInTheDocument();

    expect(within(paid).queryAllByRole("button", { name: /ni (sotish|bekor qilish)/ })).toHaveLength(0);
    expect(within(paid).getByLabelText("Amal yo'q")).toHaveTextContent("—");
  });

  it("amal so'rovi ketayotganda hamma amal tugmalari o'chiq", () => {
    renderActions({ isOrderActionPending: true });

    expect(screen.getByRole("button", { name: "№w-1 ni sotish" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "№w-1 ni bekor qilish" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "№s-1 ni kutilmoqda holatiga qaytarish" })).toBeDisabled();
  });

  it("telefon kartasida amallar kartaning ostida, to'liq enli", () => {
    mockPhone();
    renderActions();

    const items = screen.getAllByRole("listitem");
    const waitingCard = items[0];
    expect(within(waitingCard).getByRole("button", { name: "№w-1 ni sotish" })).toHaveClass("flex-1");
    expect(within(waitingCard).getByRole("button", { name: "№w-1 ni bekor qilish" })).toHaveTextContent("Bekor qilish");
    expect(within(items[2]).queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("OrdersTable — qaytarish so'ralgan belgisi", () => {
  const requested = {
    ...orders[0],
    id: "o-2",
    status: "waiting",
    return_requested: true,
    return_reason: "Mijoz rad etdi",
  };

  it("⭐ return_requested qatorida \"Qaytarish so'ralgan\", sabab tooltip/aria'da", () => {
    renderWithProviders(<OrdersTable data={[requested] as never} isLoading={false} />);
    const badges = screen.getAllByTestId("return-requested-badge");
    expect(badges.length).toBeGreaterThan(0);
    for (const badge of badges) {
      expect(badge).toHaveTextContent("Qaytarish so'ralgan");
      expect(badge).toHaveAttribute("aria-label", "Qaytarish so'ralgan. Sabab: Mijoz rad etdi");
      expect(badge).toHaveAttribute("title", "Sabab: Mijoz rad etdi");
    }
  });

  it("oddiy buyurtma (return_requested false/yo'q) — belgi yo'q", () => {
    renderWithProviders(
      <OrdersTable
        data={[{ ...orders[0], return_requested: false, return_reason: null }, orders[0]] as never}
        isLoading={false}
      />,
    );
    expect(screen.queryByTestId("return-requested-badge")).not.toBeInTheDocument();
  });
});
