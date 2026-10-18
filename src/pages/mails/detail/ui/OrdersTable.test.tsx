import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PostOrder } from "../../../../entities/mails";
import i18n from "../../../../i18n";
import { renderWithProviders } from "../../../../test/test-utils";
import OrdersTable from "./OrdersTable";

/**
 * Pochtadagi buyurtmalar kartasi (dizayn v2): sarlavha va skaner izohi, tanlov paneli
 * (`superadmin-mails-detail`), ustunlar (`*-old`, kuryer), qator amallari, saralash, pastki qism.
 */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

const order = (id: string, over: Partial<PostOrder> = {}) =>
  ({
    id,
    createdAt: "2026-10-05T09:14:00.000Z",
    updatedAt: "2026-10-05T09:14:00.000Z",
    where_deliver: "address",
    total_price: 100000,
    status: "received",
    address: "Mustaqillik ko'chasi, 21",
    customer: { id: `c${id}`, name: `Mijoz ${id}`, phone_number: "+998914521830" },
    market: { id: "7", name: "Baraka Shop" },
    district: { id: "5", name: "Qarshi sh.", region: { id: "14", name: "Qashqadaryo" } },
    ...over,
  }) as unknown as PostOrder;

const ORDERS = [
  order("101"),
  order("102", { where_deliver: "center", total_price: 240000, status: "cancelled (sent)" }),
  order("103", { total_price: 50000 }),
];

const base = {
  orders: ORDERS,
  selectedIds: new Set<string>(),
  allSelected: false,
  someSelected: false,
  onToggleAll: vi.fn(),
  onToggleOne: vi.fn(),
};

const table = () => screen.getByRole("table", { name: "Pochtadagi buyurtmalar" });
const headers = () => within(table()).getAllByRole("columnheader").map((th) => th.textContent?.trim());

describe("OrdersTable (v2)", () => {
  it("sarlavha, son, skaner izohi va «USB skaner tayyor»; ustunlar maketdagidek", () => {
    renderWithProviders(
      <OrdersTable {...base} scanHint="QR kodni skanerlasangiz, buyurtma ro'yxatda avtomatik tanlanadi" scannerReady />,
    );
    const card = screen.getByRole("region", { name: "Pochtadagi buyurtmalar" });
    expect(within(card).getByRole("heading", { level: 2, name: "Buyurtmalar" })).toBeInTheDocument();
    expect(within(card).getByText("3 ta")).toBeInTheDocument();
    expect(within(card).getByText("QR kodni skanerlasangiz, buyurtma ro'yxatda avtomatik tanlanadi")).toBeInTheDocument();
    expect(within(card).getByRole("status")).toHaveTextContent("USB skaner tayyor");
    expect(headers()).toEqual(["", "Buyurtma", "Mijoz", "Tuman / manzil", "Market", "Holat", "Yetkazish", "Summa"]);
    expect(within(table()).getByRole("link", { name: "№101" })).toHaveAttribute("href", "/orders/edit/101");
    expect(within(table()).getByText("Bekor — jo'natilgan")).toBeInTheDocument();
    expect(within(table()).getAllByText("Uygacha")).toHaveLength(2);
    expect(within(table()).getByText("Markazgacha")).toBeInTheDocument();
    // Pastki qism: «N ta buyurtma» · «Jami: X».
    expect(screen.getByText("3 ta buyurtma")).toBeInTheDocument();
    expect(screen.getByText(/^Jami:/).textContent?.replace(/\s/g, " ")).toMatch(/390 000 so'm/);
  });

  it("tanlov paneli: bo'sh — «Hech biri tanlanmagan»; tanlanganda son va izoh; «Barchasini tanlash» / «Tanlovni bekor qilish»", async () => {
    const user = userEvent.setup();
    const onToggleAll = vi.fn();
    const onClear = vi.fn();
    const hint = "Jo'natish va chop etish faqat tanlangan buyurtmalarga qo'llanadi";
    const region = () => screen.getByRole("region", { name: "Tanlangan buyurtmalar" });

    const idle = renderWithProviders(
      <OrdersTable {...base} onToggleAll={onToggleAll} onClearSelection={onClear} selectionHint={hint} />,
    );
    expect(region()).toHaveTextContent("Hech biri tanlanmagan");
    expect(region()).toHaveTextContent("Skanerlang yoki belgilang");
    expect(within(region()).getByRole("button", { name: "Tanlovni bekor qilish" })).toBeDisabled();
    await user.click(within(region()).getByRole("button", { name: "Barchasini tanlash" }));
    expect(onToggleAll).toHaveBeenCalledTimes(1);
    idle.unmount();

    const some = renderWithProviders(
      <OrdersTable
        {...base}
        selectedIds={new Set(["101", "102"])}
        someSelected
        onToggleAll={onToggleAll}
        onClearSelection={onClear}
        selectionHint={hint}
      />,
    );
    expect(region()).toHaveTextContent("2 ta buyurtma tanlandi / 3 ta");
    expect(region()).toHaveTextContent(hint);
    await user.click(within(region()).getByRole("button", { name: "Tanlovni bekor qilish" }));
    expect(onClear).toHaveBeenCalledTimes(1);
    some.unmount();

    renderWithProviders(
      <OrdersTable
        {...base}
        selectedIds={new Set(["101", "102", "103"])}
        allSelected
        onToggleAll={onToggleAll}
        onClearSelection={onClear}
      />,
    );
    // Hammasi tanlangan — «Barchasini tanlash» tanlovni bekor qilmaydi (o'chiq).
    expect(within(region()).getByRole("button", { name: "Barchasini tanlash" })).toBeDisabled();
    expect(onToggleAll).toHaveBeenCalledTimes(1);
  });

  it("qator belgisi «№X ni tanlash» → onToggleOne; sarlavha belgisi → onToggleAll", async () => {
    const user = userEvent.setup();
    const onToggleOne = vi.fn();
    const onToggleAll = vi.fn();
    renderWithProviders(<OrdersTable {...base} onToggleOne={onToggleOne} onToggleAll={onToggleAll} />);
    await user.click(screen.getByRole("checkbox", { name: "№102 ni tanlash" }));
    expect(onToggleOne).toHaveBeenCalledWith("102");
    await user.click(screen.getByRole("checkbox", { name: "Barcha buyurtmalarni tanlash" }));
    expect(onToggleAll).toHaveBeenCalledTimes(1);
  });

  it("chop etish va savat (superadmin, NEW pochta): «№X ni chop etish» menyusi, «№X ni pochtadan o'chirish»", async () => {
    const user = userEvent.setup();
    const onPrintOne = vi.fn();
    const onDeleteOne = vi.fn();
    renderWithProviders(<OrdersTable {...base} onPrintOne={onPrintOne} onDeleteOne={onDeleteOne} canDelete />);
    await user.click(screen.getByRole("button", { name: "№101 ni chop etish" }));
    await user.click(screen.getByRole("menuitem", { name: /PDF yorliq \(100×60 mm\)/ }));
    expect(onPrintOne).toHaveBeenCalledWith(expect.objectContaining({ id: "101" }), "pdf_100x60");
    await user.click(screen.getByRole("button", { name: "№103 ni pochtadan o'chirish" }));
    expect(onDeleteOne).toHaveBeenCalledWith("103");
  });

  it("eski pochta (`history`): belgi, panel va «Holat» yo'q; sana faqat kun", () => {
    renderWithProviders(<OrdersTable {...base} variant="history" readOnly />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("region", { name: "Tanlangan buyurtmalar" })).toBeNull();
    expect(headers()).toEqual(["Buyurtma", "Mijoz", "Tuman / manzil", "Market", "Yetkazish", "Summa"]);
    expect(within(table()).getAllByText("05.10.2026")).toHaveLength(3);
  });

  it("kuryer: havolasiz raqam, «Tuman» ustuni, saralash (Summa) mijoz tomonida", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <OrdersTable
        {...base}
        readOnly
        orderHref={null}
        sortable
        cardVariant="courier"
        columns={["order", "customer", "district", "market", "delivery", "status", "amount"]}
      />,
    );
    expect(within(table()).queryByRole("link")).toBeNull();
    expect(headers()).toEqual(["Buyurtma", "Mijoz", "Tuman", "Market", "Yetkazish", "Holat", "Summa"]);
    const ids = () => within(table()).getAllByText(/^№\d+$/).map((el) => el.textContent);
    await user.click(screen.getByRole("button", { name: "Summa" }));
    expect(ids()).toEqual(["№102", "№101", "№103"]);
    await user.click(screen.getByRole("button", { name: "Summa" }));
    expect(ids()).toEqual(["№103", "№101", "№102"]);
  });

  it("bo'sh — «Buyurtmalar topilmadi»; paket iste'moli: sarlavha, ustunlar va izoh", () => {
    const { unmount } = renderWithProviders(<OrdersTable {...base} orders={[]} />);
    expect(screen.getByText("Buyurtmalar topilmadi")).toBeInTheDocument();
    expect(screen.getByText("Bu pochta uchun hech qanday buyurtma yo'q")).toBeInTheDocument();
    unmount();

    renderWithProviders(
      <OrdersTable
        {...base}
        title="Paketdagi buyurtmalar"
        ariaLabel="Paketdagi buyurtmalar"
        columns={["order", "customer", "address", "delivery", "status", "amount"]}
        selectionHint="HQ'ga faqat tanlangan buyurtmalar yuboriladi"
        selectedIds={new Set(["101"])}
        someSelected
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Paketdagi buyurtmalar" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("table", { name: "Paketdagi buyurtmalar" }))
        .getAllByRole("columnheader")
        .map((th) => th.textContent?.trim()),
    ).toEqual(["", "Buyurtma", "Mijoz", "Manzil", "Yetkazish", "Holat", "Summa"]);
    expect(screen.getByText("HQ'ga faqat tanlangan buyurtmalar yuboriladi")).toBeInTheDocument();
  });
  it("qator bosilsa — tanlov (v1 dagidek); havola va belgi o'z ishini qiladi; faqat o'qishda — yo'q", async () => {
    const user = userEvent.setup();
    const onToggleOne = vi.fn();
    const { unmount } = renderWithProviders(<OrdersTable {...base} onToggleOne={onToggleOne} />);
    await user.click(within(table()).getByText("Mijoz 102"));
    expect(onToggleOne).toHaveBeenCalledTimes(1);
    expect(onToggleOne).toHaveBeenLastCalledWith("102");
    await user.click(within(table()).getByRole("checkbox", { name: "№101 ni tanlash" }));
    expect(onToggleOne).toHaveBeenCalledTimes(2);
    expect(onToggleOne).toHaveBeenLastCalledWith("101");
    unmount();

    const readOnlyToggle = vi.fn();
    renderWithProviders(<OrdersTable {...base} readOnly onToggleOne={readOnlyToggle} />);
    await user.click(within(table()).getByText("Mijoz 102"));
    expect(readOnlyToggle).not.toHaveBeenCalled();
  });
});

describe("OrdersTable — paket ko'rinishi (`appearance=\"batch\"`, maket `*-batches-detail*`)", () => {
  it("pastki qism «Jami N ta buyurtma» · summa (pochtadagi «Jami:» emas)", () => {
    renderWithProviders(<OrdersTable {...base} readOnly appearance="batch" />);
    expect(screen.getByText("Jami 3 ta buyurtma")).toBeInTheDocument();
    expect(screen.queryByText(/^Jami:/)).toBeNull();
  });

  describe("telefon (< 768)", () => {
    const original = window.matchMedia;
    beforeEach(() => {
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

    it("kartada «№X · telefon» + manzil; market — faqat «Market» ustuni bo'lsa", () => {
      const { unmount } = renderWithProviders(
        <OrdersTable
          {...base}
          appearance="batch"
          columns={["order", "customer", "address", "delivery", "status", "amount"]}
        />,
      );
      expect(screen.getByText("№101 · +998 91 452 18 30")).toBeInTheDocument();
      expect(screen.getAllByText("Mustaqillik ko'chasi, 21")).toHaveLength(3);
      expect(screen.queryByText(/Baraka Shop/)).toBeNull();
      unmount();

      renderWithProviders(
        <OrdersTable
          {...base}
          readOnly
          appearance="batch"
          columns={["order", "customer", "market", "address", "delivery", "status", "amount"]}
        />,
      );
      expect(screen.getByText("№101 · Baraka Shop · +998 91 452 18 30")).toBeInTheDocument();
    });

    it("pochta ko'rinishi o'zgarmagan: «№X · tuman · market»; skaner belgisi telefonda faqat `scannerReadyOnPhone` bilan", () => {
      const { unmount } = renderWithProviders(<OrdersTable {...base} scannerReady />);
      expect(screen.getByText("№101 · Qarshi sh. · Baraka Shop")).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveClass("max-md:hidden");
      unmount();

      renderWithProviders(<OrdersTable {...base} scannerReady scannerReadyOnPhone appearance="batch" />);
      expect(screen.getByRole("status")).not.toHaveClass("max-md:hidden");
    });
  });
});
