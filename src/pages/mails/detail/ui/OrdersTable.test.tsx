import { createRef, useState } from "react";
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
    expect(within(table()).getByText("Bekor · yo'lda")).toBeInTheDocument();
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

/**
 * MD-1: qidiruv va takroriy telefonlar (opt-in prop'lar) — maketlar `superadmin-mails-detail-search`,
 * `-search-empty`, `-duplicates`. Paket tafsiloti (`/batches/:id`) bu prop'larni bermaydi — o'zgarishsiz.
 */
describe("OrdersTable — qidiruv (MD-1)", () => {
  const search = (over: Partial<NonNullable<Parameters<typeof OrdersTable>[0]["search"]>> = {}) => ({
    value: "",
    onValueChange: vi.fn(),
    active: false,
    visible: ORDERS,
    onSelectRows: vi.fn(),
    ...over,
  });
  const region = () => screen.getByRole("region", { name: "Tanlangan buyurtmalar" });

  it("qidiruv maydoni sarlavha qatorida; yozilganda `onValueChange`; prop'siz — maydon yo'q", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { unmount } = renderWithProviders(<OrdersTable {...base} search={search({ onValueChange })} />);
    const input = screen.getByRole("searchbox", { name: "Pochtadagi buyurtmalarni qidirish" });
    expect(input).toHaveAttribute("placeholder", "№, mijoz, telefon, tuman, market");
    await user.type(input, "B");
    expect(onValueChange).toHaveBeenLastCalledWith("B");
    // Qidiruv faol emas — oddiy «Barchasini tanlash» va «N ta buyurtma · Jami».
    expect(within(region()).getByRole("button", { name: "Barchasini tanlash" })).toBeInTheDocument();
    expect(screen.getByText("3 ta buyurtma")).toBeInTheDocument();
    unmount();

    renderWithProviders(<OrdersTable {...base} />);
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("natija: holat qatori, «N tasi qidiruvda yashirin», «Ko'rinayotganlarni tanlash», sarlavha belgisi va futer", async () => {
    const user = userEvent.setup();
    const onSelectRows = vi.fn();
    renderWithProviders(
      <OrdersTable
        {...base}
        selectedIds={new Set(["101", "102"])}
        someSelected
        onClearSelection={vi.fn()}
        selectionHint="Jo'natish va chop etish faqat tanlangan buyurtmalarga qo'llanadi"
        search={search({ value: "Mijoz 103", active: true, visible: [ORDERS[2]], onSelectRows })}
      />,
    );
    expect(screen.getByText(/bo'yicha/).closest("p")).toHaveTextContent("«Mijoz 103» bo'yicha 1 ta buyurtma topildi");
    expect(within(table()).getAllByRole("row")).toHaveLength(2);
    expect(region()).toHaveTextContent("2 ta buyurtma tanlandi / 3 ta");
    expect(region()).toHaveTextContent("2 tasi qidiruvda yashirin, lekin tanlangan qoladi");
    expect(within(region()).queryByRole("button", { name: "Barchasini tanlash" })).toBeNull();

    // Nomi ko'rinadigan matndan boshlanadi (WCAG 2.5.3).
    await user.click(within(region()).getByRole("button", { name: "Ko'rinayotganlarni tanlash (1)" }));
    expect(onSelectRows).toHaveBeenLastCalledWith(["103"], true);
    // Sarlavha belgisi — faqat ko'rinadiganlar.
    await user.click(within(table()).getByRole("checkbox", { name: "Barcha buyurtmalarni tanlash" }));
    expect(onSelectRows).toHaveBeenLastCalledWith(["103"], true);

    expect(screen.getByText("1 ta ko'rsatilmoqda · 3 tadan")).toBeInTheDocument();
    expect(screen.getByText(/^Pochta jami:/).textContent?.replace(/\s/g, " ")).toMatch(/390 000 so'm/);
  });

  it("faqat market nomi bo'yicha — «· market nomi bo'yicha»", () => {
    renderWithProviders(
      <OrdersTable {...base} search={search({ value: "Baraka", active: true, visible: ORDERS, byMarket: true })} />,
    );
    expect(screen.getByText(/bo'yicha/).closest("p")).toHaveTextContent(
      "«Baraka» bo'yicha 3 ta buyurtma topildi · market nomi bo'yicha",
    );
  });

  it("natija yo'q: EmptyState + «Qidiruvni tozalash», tanlov paneli qoladi («Tanlanganlar qidiruvda yashirin»)", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderWithProviders(
      <OrdersTable
        {...base}
        selectedIds={new Set(["101"])}
        someSelected
        onClearSelection={vi.fn()}
        search={search({ value: "Dilshod", active: true, visible: [], onValueChange })}
      />,
    );
    expect(screen.queryByRole("table")).toBeNull();
    // Ko'rinadigan sarlavha + jonli hudud (ekran o'quvchisi uchun) — ikkalasida bir xil matn.
    expect(screen.getAllByText("«Dilshod» bo'yicha buyurtma topilmadi")).toHaveLength(2);
    expect(screen.getByTestId("mail-search-status")).toHaveTextContent("«Dilshod» bo'yicha buyurtma topilmadi");
    expect(
      screen.getByText(
        "Buyurtma raqami, ism, telefon, tuman yoki market nomini tekshiring. Telefonni «+998» siz, faqat raqamlar bilan ham yozish mumkin.",
      ),
    ).toBeInTheDocument();
    expect(region()).toHaveTextContent("Tanlanganlar qidiruvda yashirin, lekin tanlangan qoladi");
    expect(within(region()).queryByRole("button", { name: /Ko'rinayotgan/ })).toBeNull();
    expect(within(region()).getByRole("button", { name: "Tanlovni bekor qilish" })).toBeEnabled();
    expect(screen.getByText("0 ta ko'rsatilmoqda · 3 tadan")).toBeInTheDocument();

    // Maydondagi × va EmptyState tugmasi — ikkalasi «Qidiruvni tozalash».
    const clears = screen.getAllByRole("button", { name: "Qidiruvni tozalash" });
    expect(clears).toHaveLength(2);
    await user.click(clears[1]);
    expect(onValueChange).toHaveBeenLastCalledWith("");
  });

  it("«Qidiruvni tozalash» (bo'sh holat) dan keyin fokus qidiruv maydoniga qaytadi", async () => {
    const user = userEvent.setup();
    const inputRef = createRef<HTMLInputElement>();
    renderWithProviders(
      <OrdersTable
        {...base}
        searchInputRef={inputRef}
        search={search({ value: "Dilshod", active: true, visible: [] })}
      />,
    );
    await user.click(screen.getAllByRole("button", { name: "Qidiruvni tozalash" })[1]);
    expect(screen.getByRole("searchbox", { name: "Pochtadagi buyurtmalarni qidirish" })).toHaveFocus();
  });

  it("jonli hudud bitta va doimiy: natijadan «topilmadi» ga o'tganda o'sha element matni almashadi", async () => {
    const user = userEvent.setup();
    const stages = [
      search(),
      search({ value: "Mijoz 103", active: true, visible: [ORDERS[2]] }),
      search({ value: "Dilshod", active: true, visible: [] }),
    ];
    const Harness = () => {
      const [stage, setStage] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setStage((value) => value + 1)}>
            keyingi
          </button>
          <OrdersTable {...base} search={stages[stage]} />
        </>
      );
    };
    renderWithProviders(<Harness />);
    const status = screen.getByTestId("mail-search-status");
    expect(status).toHaveAttribute("role", "status");
    expect(status.textContent).toBe("");

    await user.click(screen.getByRole("button", { name: "keyingi" }));
    expect(screen.getByTestId("mail-search-status")).toBe(status);
    expect(status).toHaveTextContent("«Mijoz 103» bo'yicha 1 ta buyurtma topildi");

    await user.click(screen.getByRole("button", { name: "keyingi" }));
    expect(screen.getByTestId("mail-search-status")).toBe(status);
    expect(status).toHaveTextContent("«Dilshod» bo'yicha buyurtma topilmadi");
  });

  it("holat qatori jadvalga QO'LLANGAN so'rovni ko'rsatadi (`query`), maydon esa qoralamani (`value`)", () => {
    renderWithProviders(
      <OrdersTable
        {...base}
        search={search({ value: "Mijoz 1034", query: "Mijoz 103", active: true, visible: [ORDERS[2]] })}
      />,
    );
    expect(screen.getByRole("searchbox", { name: "Pochtadagi buyurtmalarni qidirish" })).toHaveValue("Mijoz 1034");
    expect(screen.getByTestId("mail-search-status")).toHaveTextContent("«Mijoz 103» bo'yicha 1 ta buyurtma topildi");
  });

  it("takroriy raqam: «Takroriy raqam» belgisi (maslahat bilan), qatorda ogohlantirish chizig'i, banner sarlavha ostida", () => {
    renderWithProviders(
      <OrdersTable
        {...base}
        search={search()}
        alert={<div role="note">banner</div>}
        duplicateNote={(item) => (item.id === "102" ? "Shu raqamga yana: №103" : null)}
      />,
    );
    const badge = within(table()).getByText("Takroriy raqam");
    expect(badge.closest("[title]")).toHaveAttribute("title", "Shu raqamga yana: №103");
    // Maketdagi oddiy `.el-badge` (24 px), kichik emas.
    expect(badge.closest("[title]")).toHaveClass("h-6");
    expect(within(table()).getAllByText("Takroriy raqam")).toHaveLength(1);
    const row = within(table()).getByRole("checkbox", { name: "№102 ni tanlash" }).closest("tr")!;
    expect(row.className).toContain("shadow-[inset_3px_0_0_var(--color-warning)]");
    expect(screen.getByRole("note")).toHaveTextContent("banner");
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

    it("kartada «Takroriy raqam» badge'lar qatorida va chiziq", () => {
      renderWithProviders(
        <OrdersTable
          {...base}
          search={search()}
          duplicateNote={(item) => (item.id === "101" ? "Shu raqamga yana: №102" : null)}
        />,
      );
      expect(screen.queryByRole("table")).toBeNull();
      expect(screen.getAllByText("Takroriy raqam")).toHaveLength(1);
      const card = screen.getByRole("checkbox", { name: "№101 ni tanlash" }).closest("li")!;
      expect(card.className).toContain("[li&]:shadow-[inset_3px_0_0_var(--color-warning)]");
    });
  });
});
