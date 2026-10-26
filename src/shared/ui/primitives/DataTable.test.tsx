import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { DataTable, type DataTableColumn, type DataTableSort } from "./DataTable";

/**
 * DataTable: ustunlar, planshetda yashirin ustun, server saralashi (aylanish, `aria-sort`), tanlov
 * (hammasi / qisman / tanlab bo'lmaydigan qator), qatorni bosish (ichki havola/tugma — yo'q) va
 * telefonda kartalar ro'yxati.
 */

type Row = { id: string; name: string; sum: number; sent?: boolean };

const ROWS: Row[] = [
  { id: "10242", name: "Sevara Tursunova", sum: 1150000 },
  { id: "10241", name: "Dilnoza Karimova", sum: 185000 },
  { id: "10231", name: "Shahnoza Ergasheva", sum: 320000, sent: true },
];

const COLUMNS: DataTableColumn<Row>[] = [
  {
    id: "createdAt",
    header: "Buyurtma",
    sortable: true,
    sortTitle: "Sana bo'yicha saralash",
    firstDirection: "desc",
    cell: (row) => <a href={`#order-${row.id}`}>№{row.id}</a>,
  },
  { id: "customer", header: "Mijoz", cell: (row) => row.name },
  { id: "market", header: "Market", hideBelow: "lg", cell: () => "Nur Elektronika" },
  { id: "status", header: "Holat", sortable: true, cell: () => "Yangi" },
  { id: "total_price", header: "Summa", sortable: true, align: "end", cell: (row) => String(row.sum) },
];

const mockPhone = (phone: boolean) =>
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: phone && query === "(max-width: 767px)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );

beforeEach(async () => {
  if (i18n.language !== "uz") await i18n.changeLanguage("uz");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DataTable — jadval", () => {
  it("sarlavha va kataklar; planshetda yashirinadigan ustun `max-lg:hidden`, summa o'ngda", () => {
    render(<DataTable rows={ROWS} columns={COLUMNS} getRowKey={(row) => row.id} label="Buyurtmalar" />);

    const table = screen.getByRole("table", { name: "Buyurtmalar" });
    const headers = within(table).getAllByRole("columnheader");
    expect(headers.map((header) => header.textContent)).toEqual(["Buyurtma", "Mijoz", "Market", "Holat", "Summa"]);
    expect(headers[2]).toHaveClass("max-lg:hidden");
    expect(headers[4]).toHaveClass("text-right");

    const firstRow = within(table).getAllByRole("row")[1];
    const cells = within(firstRow).getAllByRole("cell");
    expect(cells[2]).toHaveClass("max-lg:hidden");
    expect(cells[4]).toHaveClass("text-right", "whitespace-nowrap");
    expect(within(firstRow).getByRole("link", { name: "№10242" })).toHaveAttribute("href", "#order-10242");
  });

  it("saralanmaydigan ustunda tugma yo'q; saralanadiganida — `aria-pressed`, maslahat va `aria-sort`", () => {
    render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        getRowKey={(row) => row.id}
        sort={{ key: "createdAt", direction: "desc" }}
        onSortChange={vi.fn()}
      />,
    );

    expect(within(screen.getByRole("columnheader", { name: "Mijoz" })).queryByRole("button")).toBeNull();
    const byDate = screen.getByRole("button", { name: "Buyurtma" });
    expect(byDate).toHaveAttribute("aria-pressed", "true");
    expect(byDate).toHaveAttribute("title", "Sana bo'yicha saralash");
    expect(screen.getByRole("columnheader", { name: "Buyurtma" })).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByRole("button", { name: "Holat" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("columnheader", { name: "Holat" })).not.toHaveAttribute("aria-sort");
  });

  it("saralash aylanishi: boshqa ustun → birinchi yo'nalish → teskari → saralashsiz; qatorlar qayta tartiblanmaydi", async () => {
    const user = userEvent.setup();
    const changes: Array<DataTableSort | null> = [];
    const Harness = () => {
      const [sort, setSort] = useState<DataTableSort | null>(null);
      return (
        <DataTable
          rows={ROWS}
          columns={COLUMNS}
          getRowKey={(row) => row.id}
          sort={sort}
          onSortChange={(next) => {
            changes.push(next);
            setSort(next);
          }}
        />
      );
    };
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Holat" }));
    await user.click(screen.getByRole("button", { name: "Holat" }));
    await user.click(screen.getByRole("button", { name: "Holat" }));
    await user.click(screen.getByRole("button", { name: "Buyurtma" }));
    await user.click(screen.getByRole("button", { name: "Buyurtma" }));

    expect(changes).toEqual([
      { key: "status", direction: "asc" },
      { key: "status", direction: "desc" },
      null,
      { key: "createdAt", direction: "desc" },
      { key: "createdAt", direction: "asc" },
    ]);
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["№10242", "№10241", "№10231"]);
  });

  it("⭐ MJAKYdyh: har `<th>` da scope=\"col\" — oddiy, saralanadigan, tanlov va tafsilot ustunlari ham", () => {
    render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        getRowKey={(row) => row.id}
        label="Buyurtmalar"
        sort={{ key: "createdAt", direction: "desc" }}
        onSortChange={vi.fn()}
        selection={{ isSelected: () => false, onToggle: vi.fn(), onToggleAll: vi.fn(), rowLabel: (row) => `№${row.id} ni tanlash` }}
        expandable={{ isExpanded: () => false, onToggle: vi.fn(), render: (row) => <p>Tafsilot {row.id}</p> }}
      />,
    );

    const headers = within(screen.getByRole("table", { name: "Buyurtmalar" })).getAllByRole("columnheader");
    // 5 ustun + tanlov + tafsilot.
    expect(headers).toHaveLength(COLUMNS.length + 2);
    for (const header of headers) expect(header).toHaveAttribute("scope", "col");
  });

  it("⭐ MJAKYdyh: saralash sarlavhasi — `<button>`, klaviatura: Tab bilan fokus, Enter va Probel saralashni almashtiradi", async () => {
    const user = userEvent.setup();
    const changes: Array<DataTableSort | null> = [];
    const Harness = () => {
      const [sort, setSort] = useState<DataTableSort | null>(null);
      return (
        <DataTable
          rows={ROWS}
          columns={COLUMNS}
          getRowKey={(row) => row.id}
          sort={sort}
          onSortChange={(next) => {
            changes.push(next);
            setSort(next);
          }}
        />
      );
    };
    render(<Harness />);

    const byDate = screen.getByRole("button", { name: "Buyurtma" });
    expect(byDate.tagName).toBe("BUTTON");
    expect(byDate).toHaveAttribute("type", "button");
    expect(screen.getByRole("columnheader", { name: "Buyurtma" })).not.toHaveAttribute("aria-sort");

    await user.tab();
    expect(byDate).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(changes).toEqual([{ key: "createdAt", direction: "desc" }]);
    expect(screen.getByRole("columnheader", { name: "Buyurtma" })).toHaveAttribute("aria-sort", "descending");
    expect(byDate).toHaveFocus();

    await user.keyboard(" ");
    expect(changes.at(-1)).toEqual({ key: "createdAt", direction: "asc" });
    expect(screen.getByRole("columnheader", { name: "Buyurtma" })).toHaveAttribute("aria-sort", "ascending");

    // Keyingi saralanadigan sarlavha («Mijoz», «Market» — tugmasiz, Tab ularni o'tkazib yuboradi).
    await user.tab();
    expect(screen.getByRole("button", { name: "Holat" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(changes.at(-1)).toEqual({ key: "status", direction: "asc" });
    expect(screen.getByRole("columnheader", { name: "Holat" })).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByRole("columnheader", { name: "Buyurtma" })).not.toHaveAttribute("aria-sort");
  });

  it("qatorni bosish: qatorda — chaqiriladi, ichidagi havola yoki tugmada — yo'q", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataTable
        rows={ROWS}
        columns={[
          ...COLUMNS.slice(0, 2),
          { id: "copy", header: "", cell: (row) => <button type="button">Nusxalash {row.id}</button> },
        ]}
        getRowKey={(row) => row.id}
        onRowClick={onRowClick}
      />,
    );

    await user.click(screen.getByText("Dilnoza Karimova"));
    expect(onRowClick).toHaveBeenCalledWith(ROWS[1], 1);

    onRowClick.mockClear();
    await user.click(screen.getByRole("button", { name: "Nusxalash 10242" }));
    await user.click(screen.getByRole("link", { name: "№10241" }));
    expect(onRowClick).not.toHaveBeenCalled();
    // Qator tugma emas — klaviatura havola orqali.
    expect(screen.queryByRole("button", { name: /Sevara/ })).toBeNull();
  });
});

describe("DataTable — zichlik", () => {
  it("`tight` — ichki katak 8, chetdagilar 16; `tablet-tight` — faqat < 1024 da shunday", () => {
    const { unmount } = render(<DataTable rows={ROWS} columns={COLUMNS} getRowKey={(row) => row.id} density="tight" />);
    expect(screen.getAllByRole("cell")[0]).toHaveClass("px-2", "first:pl-4", "last:pr-4");
    unmount();

    render(<DataTable rows={ROWS} columns={COLUMNS} getRowKey={(row) => row.id} density="tablet-tight" />);
    expect(screen.getAllByRole("cell")[0]).toHaveClass("px-4", "max-lg:px-2", "max-lg:first:pl-4", "max-lg:last:pr-4");
    expect(screen.getAllByRole("columnheader")[0]).toHaveClass("px-4", "max-lg:px-2");
  });
});

describe("DataTable — tanlov", () => {
  const Harness = ({ initial = [] as string[] }) => {
    const [selected, setSelected] = useState(new Set(initial));
    return (
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        getRowKey={(row) => row.id}
        selection={{
          isSelected: (row) => selected.has(row.id),
          isSelectable: (row) => !row.sent,
          onToggle: (row, checked) =>
            setSelected((previous) => {
              const next = new Set(previous);
              if (checked) next.add(row.id);
              else next.delete(row.id);
              return next;
            }),
          onToggleAll: (checked) =>
            setSelected(checked ? new Set(ROWS.filter((row) => !row.sent).map((row) => row.id)) : new Set()),
          headerLabel: "Sahifadagi jo'natilmagan buyurtmalarni tanlash",
          rowLabel: (row) => `№${row.id} ni tanlash`,
          disabledRowLabel: (row) => `№${row.id} allaqachon jo'natilgan, tanlab bo'lmaydi`,
        }}
      />
    );
  };

  it("qator belgilari nomlangan; tanlab bo'lmaydigani `disabled`; tanlangan qator `bg-action-soft`", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const disabled = screen.getByRole("checkbox", { name: "№10231 allaqachon jo'natilgan, tanlab bo'lmaydi" });
    expect(disabled).toBeDisabled();

    const first = screen.getByRole("checkbox", { name: "№10242 ni tanlash" });
    await user.click(first);
    expect(first).toBeChecked();
    expect(first.closest("tr")).toHaveClass("bg-action-soft");
    expect(first.closest("tr")).toHaveAttribute("data-selected");

    const all = screen.getByRole("checkbox", { name: "Sahifadagi jo'natilmagan buyurtmalarni tanlash" });
    expect(all).not.toBeChecked();
    expect((all as HTMLInputElement).indeterminate).toBe(true);
  });

  it("«hammasi» faqat tanlanadiganlarni belgilaydi va qayta bosilsa tozalaydi", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const all = screen.getByRole("checkbox", { name: "Sahifadagi jo'natilmagan buyurtmalarni tanlash" });
    await user.click(all);
    expect(screen.getByRole("checkbox", { name: "№10242 ni tanlash" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "№10241 ni tanlash" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /№10231/ })).not.toBeChecked();
    expect(all).toBeChecked();
    expect((all as HTMLInputElement).indeterminate).toBe(false);

    await user.click(all);
    expect(screen.getByRole("checkbox", { name: "№10242 ni tanlash" })).not.toBeChecked();
  });
});

describe("DataTable — ochiladigan qator", () => {
  const ExpandHarness = ({
    initial = [] as string[],
    toggle,
    withSelection = false,
  }: {
    initial?: string[];
    toggle?: "start" | "none";
    withSelection?: boolean;
  }) => {
    const [open, setOpen] = useState(new Set(initial));
    const setRow = (row: Row, next: boolean) =>
      setOpen((previous) => {
        const copy = new Set(previous);
        if (next) copy.add(row.id);
        else copy.delete(row.id);
        return copy;
      });
    return (
      <DataTable
        rows={ROWS}
        columns={
          toggle === "none"
            ? [
                ...COLUMNS.slice(0, 2),
                {
                  id: "actions",
                  header: "",
                  cell: (row) => (
                    <button
                      type="button"
                      aria-expanded={open.has(row.id)}
                      aria-controls={open.has(row.id) ? `pl-${row.id}` : undefined}
                      onClick={() => setRow(row, !open.has(row.id))}
                    >
                      {row.id} — ma'lumot
                    </button>
                  ),
                },
              ]
            : COLUMNS
        }
        getRowKey={(row) => row.id}
        label="Jurnal"
        renderCard={(row) => <span>{row.name}</span>}
        selection={
          withSelection
            ? { isSelected: () => false, onToggle: vi.fn(), onToggleAll: vi.fn(), rowLabel: (row) => `№${row.id} ni tanlash` }
            : undefined
        }
        expandable={{
          isExpanded: (row) => open.has(row.id),
          onToggle: setRow,
          canExpand: (row) => !row.sent,
          render: (row) => <p>Tafsilot {row.id}</p>,
          toggleLabel: (row, expanded) => `№${row.id} tafsilotini ${expanded ? "yopish" : "ochish"}`,
          toggle,
          panelId: toggle === "none" ? (row) => `pl-${row.id}` : undefined,
        }}
      />
    );
  };

  it("chevron ustuni birinchi (sarlavhada yashirin «Tafsilot»); ochilmaydigan qatorda tugma yo'q", () => {
    render(<ExpandHarness />);
    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(COLUMNS.length + 1);
    expect(headers[0]).toHaveTextContent("Tafsilot");
    expect(headers[0]).toHaveClass("w-[52px]");

    const rows = within(screen.getByRole("table", { name: "Jurnal" })).getAllByRole("row");
    expect(within(rows[1]).getAllByRole("cell")[0]).toContainElement(
      screen.getByRole("button", { name: "№10242 tafsilotini ochish" }),
    );
    // №10231 — ochilmaydi: chevron o'rnida faqat ekran o'quvchi matni.
    expect(screen.queryByRole("button", { name: /№10231/ })).toBeNull();
    expect(within(rows[3]).getAllByRole("cell")[0]).toHaveTextContent("Tafsilot yo'q");
  });

  it("bosilsa ochiladi: `aria-expanded`, panel `colSpan` = barcha ustunlar, `aria-controls` panelga; qayta bosilsa yopiladi", async () => {
    const user = userEvent.setup();
    render(<ExpandHarness />);

    const toggle = screen.getByRole("button", { name: "№10241 tafsilotini ochish" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Tafsilot 10241")).toBeNull();

    await user.click(toggle);
    const collapse = screen.getByRole("button", { name: "№10241 tafsilotini yopish" });
    expect(collapse).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByText("Tafsilot 10241").closest("td") as HTMLTableCellElement;
    expect(panel).toHaveAttribute("colspan", String(COLUMNS.length + 1));
    expect(collapse).toHaveAttribute("aria-controls", panel.id);
    // Ochilgan qator va panel bitta blok: fon `bg-sunken`, qator kataklarida pastki chiziq yo'q.
    const row = collapse.closest("tr") as HTMLTableRowElement;
    expect(row).toHaveClass("bg-sunken");
    expect(row).toHaveAttribute("data-expanded");
    expect(within(row).getAllByRole("cell")[1]).not.toHaveClass("border-b");
    expect(panel.closest("tr")).toHaveClass("bg-sunken");

    await user.click(collapse);
    expect(screen.queryByText("Tafsilot 10241")).toBeNull();
    expect(screen.getByRole("button", { name: "№10241 tafsilotini ochish" })).toHaveAttribute("aria-expanded", "false");
  });

  it("klaviatura: Enter va Space ochadi/yopadi", async () => {
    const user = userEvent.setup();
    render(<ExpandHarness />);

    screen.getByRole("button", { name: "№10242 tafsilotini ochish" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText("Tafsilot 10242")).toBeInTheDocument();
    await user.keyboard(" ");
    expect(screen.queryByText("Tafsilot 10242")).toBeNull();
  });

  it("tanlov bilan: belgi ustuni birinchi, chevron undan keyin; panel `colSpan` ikkalasini ham qamraydi", () => {
    render(<ExpandHarness withSelection initial={["10242"]} />);
    const firstRowCells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
    expect(within(firstRowCells[0]).getByRole("checkbox")).toBeInTheDocument();
    expect(within(firstRowCells[1]).getByRole("button", { name: "№10242 tafsilotini yopish" })).toBeInTheDocument();
    expect(screen.getByText("Tafsilot 10242").closest("td")).toHaveAttribute("colspan", String(COLUMNS.length + 2));
  });

  it("`toggle: none` — chevron ustuni yo'q, tugma iste'molchida; panel `panelId` bilan", async () => {
    const user = userEvent.setup();
    render(<ExpandHarness toggle="none" />);
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /tafsilotini/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: "10241 — ma'lumot" }));
    const panel = screen.getByText("Tafsilot 10241").closest("td");
    expect(panel).toHaveAttribute("id", "pl-10241");
    expect(panel).toHaveAttribute("colspan", "3");
    expect(screen.getByRole("button", { name: "10241 — ma'lumot" })).toHaveAttribute("aria-controls", "pl-10241");
  });

  it("telefonda: chevron kartaning o'ng tomonida, panel karta ostida; ochilmaydigan kartada tugma yo'q", async () => {
    mockPhone(true);
    const user = userEvent.setup();
    render(<ExpandHarness />);

    expect(screen.queryByRole("table")).toBeNull();
    const items = within(screen.getByRole("list", { name: "Jurnal" })).getAllByRole("listitem");
    expect(within(items[2]).queryByRole("button")).toBeNull();

    await user.click(within(items[0]).getByRole("button", { name: "№10242 tafsilotini ochish" }));
    const item = screen.getAllByRole("listitem")[0];
    expect(item).toHaveAttribute("data-expanded");
    expect(item).toHaveClass("bg-sunken");
    const panel = within(item).getByText("Tafsilot 10242");
    expect(within(item).getByRole("button", { name: "№10242 tafsilotini yopish" })).toHaveAttribute(
      "aria-controls",
      panel.parentElement?.id,
    );
  });
});

describe("DataTable — telefon", () => {
  it("< 768: jadval o'rniga kartalar ro'yxati (DOM'da bitta nusxa), tanlov belgisi kartada", async () => {
    mockPhone(true);
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        getRowKey={(row) => row.id}
        label="Buyurtmalar"
        renderCard={(row) => <a href={`/orders/edit/${row.id}`}>{row.name}</a>}
        selection={{
          isSelected: () => false,
          onToggle,
          onToggleAll: vi.fn(),
          rowLabel: (row) => `№${row.id} ni tanlash`,
        }}
      />,
    );

    expect(screen.queryByRole("table")).toBeNull();
    const list = screen.getByRole("list", { name: "Buyurtmalar" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getAllByText("Sevara Tursunova")).toHaveLength(1);

    await user.click(screen.getByRole("checkbox", { name: "№10241 ni tanlash" }));
    expect(onToggle).toHaveBeenCalledWith(ROWS[1], true);
  });

  it("`renderCard` berilmasa telefonda ham jadval", () => {
    mockPhone(true);
    render(<DataTable rows={ROWS} columns={COLUMNS} getRowKey={(row) => row.id} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});

describe("DataTable — ochiladigan qator, tugma ustunda (`expandable.toggle: \"none\"`, `superadmin-activity-logs-row-expanded`)", () => {
  // dev (0b52635) `renderExpanded` testlari — bitta API (`expandable`) ga ko'chirilgan: tugmani ustun chizadi,
  // panelning ichki chekkasini mazmunning o'zi beradi (`panelClassName: "p-0"`).
  const Expandable = ({ initial }: { initial: string | null }) => {
    const [open, setOpen] = useState<string | null>(initial);
    return (
      <DataTable
        rows={ROWS}
        columns={[
          {
            id: "toggle",
            header: "Tafsilot",
            cell: (row) => (
              <button type="button" aria-expanded={open === row.id} onClick={() => setOpen(open === row.id ? null : row.id)}>
                {`№${row.id} tafsiloti`}
              </button>
            ),
          },
          ...COLUMNS,
        ]}
        getRowKey={(row) => row.id}
        expandable={{
          toggle: "none",
          isExpanded: (row) => open === row.id,
          onToggle: (row, next) => setOpen(next ? row.id : null),
          render: (row) => <div>{`${row.name} tafsiloti`}</div>,
          panelClassName: "p-0",
        }}
        renderCard={(row) => <span>{row.name}</span>}
      />
    );
  };

  it("ochilgan qator ostida to'liq enli katak; qator va katak kulrang, orada chiziq yo'q; qayta bosilsa yopiladi", async () => {
    const user = userEvent.setup();
    render(<Expandable initial={null} />);
    expect(screen.queryByText("Sevara Tursunova tafsiloti")).toBeNull();

    await user.click(screen.getByRole("button", { name: "№10242 tafsiloti" }));
    const detail = screen.getByText("Sevara Tursunova tafsiloti").closest("td")!;
    expect(detail).toHaveAttribute("colspan", "6");
    expect(detail).toHaveClass("p-0");
    expect(detail.parentElement).toHaveClass("bg-sunken");
    const row = screen.getByRole("button", { name: "№10242 tafsiloti" }).closest("tr")!;
    expect(row).toHaveAttribute("data-expanded");
    expect(row).toHaveClass("bg-sunken");
    for (const cell of within(row).getAllByRole("cell")) expect(cell).not.toHaveClass("border-b");
    expect(row).not.toHaveClass("hover:bg-row-hover");
    expect(row.nextElementSibling).toBe(detail.parentElement);

    await user.click(screen.getByRole("button", { name: "№10242 tafsiloti" }));
    expect(screen.queryByText("Sevara Tursunova tafsiloti")).toBeNull();
  });

  it("telefonda tafsilot kartadan keyin, o'sha `<li>` ichida", () => {
    mockPhone(true);
    render(<Expandable initial="10241" />);
    const item = screen.getByText("Dilnoza Karimova tafsiloti").closest("li")!;
    expect(item).toHaveAttribute("data-expanded");
    expect(item).toHaveClass("bg-sunken");
    expect(within(item).getByText("Dilnoza Karimova")).toBeInTheDocument();
  });
});
