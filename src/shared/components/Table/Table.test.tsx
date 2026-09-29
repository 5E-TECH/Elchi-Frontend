import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Table } from "./Table";
import type { ColumnConfig, SortConfig } from "./Table.types";

interface Row {
  id: string;
  name: string;
  price: number;
}

const rows: Row[] = [
  { id: "1", name: "Banana", price: 300 },
  { id: "2", name: "Apple", price: 100 },
  { id: "3", name: "Cherry", price: 200 },
];

const columns: ColumnConfig<Row>[] = [
  { key: "name", label: "Ism", sortable: true },
  { key: "price", label: "Narx", sortable: true, sortValue: (row) => row.price },
];

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
};

describe("Table sorting", () => {
  afterEach(() => setViewportWidth(1440));

  it("sorts rows internally when uncontrolled and clicking a sortable header", async () => {
    setViewportWidth(1440);
    const user = userEvent.setup();
    render(<Table data={rows} columns={columns} keyExtractor={(row) => row.id} />);

    const bodyOrderBefore = screen.getAllByRole("row").slice(1).map((row) => row.textContent);
    expect(bodyOrderBefore[0]).toContain("Banana");

    await user.click(screen.getByRole("columnheader", { name: "Narx" }));

    const bodyOrderAfter = screen.getAllByRole("row").slice(1).map((row) => row.textContent);
    expect(bodyOrderAfter[0]).toContain("Apple");
  });

  it("defers to the parent when sortConfig/onSortChange are controlled", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    setViewportWidth(1440);

    render(
      <Table
        data={rows}
        columns={columns}
        keyExtractor={(row) => row.id}
        sortConfig={null}
        onSortChange={onSortChange}
      />,
    );

    await user.click(screen.getByRole("columnheader", { name: "Narx" }));

    expect(onSortChange).toHaveBeenCalledWith({ key: "price", direction: "asc" });
    // Controlled: internal state never applied, so the row order does not change on its own.
    const bodyOrderAfter = screen.getAllByRole("row").slice(1).map((row) => row.textContent);
    expect(bodyOrderAfter[0]).toContain("Banana");
  });

  it("reorders rows once the controlled sortConfig prop is actually updated", () => {
    const Controlled = () => {
      const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: "price", direction: "asc" });
      return (
        <Table
          data={rows}
          columns={columns}
          keyExtractor={(row) => row.id}
          sortConfig={sortConfig}
          onSortChange={setSortConfig}
        />
      );
    };
    render(<Controlled />);

    const bodyOrder = screen.getAllByRole("row").slice(1).map((row) => row.textContent);
    expect(bodyOrder[0]).toContain("Apple");
  });

  it("keeps the given row order with manualSort (the server already sorted it)", async () => {
    setViewportWidth(1440);
    const user = userEvent.setup();
    const onSortChange = vi.fn();

    render(
      <Table
        data={rows}
        columns={columns}
        keyExtractor={(row) => row.id}
        sortConfig={{ key: "price", direction: "asc" }}
        onSortChange={onSortChange}
        manualSort
      />,
    );

    const bodyOrder = screen.getAllByRole("row").slice(1).map((row) => row.textContent);
    expect(bodyOrder[0]).toContain("Banana");
    expect(screen.getByRole("columnheader", { name: /Narx/ })).toHaveTextContent("↑");

    await user.click(screen.getByRole("columnheader", { name: /Narx/ }));
    expect(onSortChange).toHaveBeenCalledWith({ key: "price", direction: "desc" });
  });

  it("shows a mobile sort chip bar in card mode and lets the user sort by tapping a chip", async () => {
    setViewportWidth(500);
    const user = userEvent.setup();
    render(<Table data={rows} columns={columns} keyExtractor={(row) => row.id} sortLabel="Saralash:" />);

    expect(screen.getByText("Saralash:")).toBeInTheDocument();
    const priceChip = screen.getByRole("button", { name: "Narx" });

    await user.click(priceChip);

    const cards = screen.getAllByText(/Apple|Banana|Cherry/);
    expect(cards[0]).toHaveTextContent("Apple");
  });

  it("does not render a sort bar on desktop or when no column is sortable", () => {
    setViewportWidth(1440);
    render(<Table data={rows} columns={columns} keyExtractor={(row) => row.id} sortLabel="Saralash:" />);
    expect(screen.queryByText("Saralash:")).not.toBeInTheDocument();
  });

  it("keeps the mobile sort label and chips readable in both themes (no background-coloured text)", () => {
    setViewportWidth(390);
    render(
      <Table
        data={rows}
        columns={columns}
        keyExtractor={(row) => row.id}
        sortLabel="Saralash:"
        sortConfig={{ key: "price", direction: "asc" }}
        onSortChange={vi.fn()}
        manualSort
      />,
    );

    const bar = screen.getByTestId("mobile-sort-bar");
    // Dark rejimda `sidebar` rangi fon bilan bir xil — yorliq/chip matni undan olinmasligi kerak.
    expect(bar.innerHTML).not.toMatch(/text-sidebar/);
    expect(screen.getByText("Saralash:").className).toContain("dark:text-[color:var(--color-text-muted-dark)]");
    const inactiveChip = screen.getByRole("button", { name: "Ism" });
    expect(inactiveChip.className).toContain("dark:text-white/85");
    expect(inactiveChip.className).toContain("text-maindark/80");
    expect(screen.getByRole("button", { name: /Narx/ }).className).toContain("text-white");
  });

  it("keeps card-mode tables at the container width so a long card cannot push every card's right edge out of view", () => {
    setViewportWidth(390);
    const { container, unmount } = render(<Table data={rows} columns={columns} keyExtractor={(row) => row.id} />);
    // Avtomatik jadval eng keng kartaning min-content'iga cho'zilardi — `table-fixed` 100% da ushlaydi.
    expect(container.querySelector("table")).toHaveClass("table-fixed");
    unmount();

    setViewportWidth(1440);
    const desktop = render(<Table data={rows} columns={columns} keyExtractor={(row) => row.id} />);
    expect(desktop.container.querySelector("table")).not.toHaveClass("table-fixed");
  });
});

describe("Table row keyboard access", () => {
  afterEach(() => setViewportWidth(1440));

  const bodyRows = (container: HTMLElement) => Array.from(container.querySelectorAll("tbody > tr"));

  it("makes every clickable row focusable as a button with the given accessible name", () => {
    setViewportWidth(1440);
    const { container } = render(
      <Table
        data={rows}
        columns={columns}
        keyExtractor={(row) => row.id}
        onRowClick={vi.fn()}
        getRowAriaLabel={(row) => `Mahsulot ${row.name}`}
      />,
    );

    const trs = bodyRows(container);
    expect(trs).toHaveLength(3);
    for (const tr of trs) {
      expect(tr).toHaveAttribute("tabindex", "0");
      expect(tr).toHaveAttribute("role", "button");
    }
    expect(screen.getByRole("button", { name: "Mahsulot Apple" })).toBe(trs[1]);
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])("opens the focused row with %s, passing the row and its index", async (_key, keys) => {
    setViewportWidth(1440);
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const { container } = render(<Table data={rows} columns={columns} keyExtractor={(row) => row.id} onRowClick={onRowClick} />);

    await user.tab();
    expect(bodyRows(container)[0]).toHaveFocus();
    await user.tab();
    expect(bodyRows(container)[1]).toHaveFocus();
    await user.keyboard(keys);

    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(rows[1], 1);
  });

  it("opens rows from the keyboard in the phone card layout too", async () => {
    setViewportWidth(390);
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <Table
        data={rows}
        columns={columns}
        keyExtractor={(row) => row.id}
        onRowClick={onRowClick}
        mobileRowRender={(row) => <div>{row.name}</div>}
      />,
    );

    // Birinchi Tab — saralash chiplari, keyin qatorlar.
    const firstRow = screen.getAllByRole("button").find((node) => node.tagName === "TR")!;
    firstRow.focus();
    await user.keyboard("{Enter}");
    expect(onRowClick).toHaveBeenCalledWith(rows[0], 0);
  });

  it("does not open the row when Enter is pressed on a control inside it", async () => {
    setViewportWidth(1440);
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const onCopy = vi.fn();
    render(
      <Table
        data={rows}
        columns={[
          ...columns,
          {
            key: "id",
            label: "Amal",
            render: (_: unknown, row: Row) => (
              <button type="button" onClick={(event) => { event.stopPropagation(); onCopy(row.id); }}>
                nusxa {row.id}
              </button>
            ),
          },
        ]}
        keyExtractor={(row) => row.id}
        onRowClick={onRowClick}
      />,
    );

    screen.getByRole("button", { name: "nusxa 2" }).focus();
    await user.keyboard("{Enter}");

    expect(onCopy).toHaveBeenCalledWith("2");
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("adds no focus stop, role or key handler when rows are not clickable", async () => {
    setViewportWidth(1440);
    const user = userEvent.setup();
    const { container } = render(<Table data={rows} columns={columns} keyExtractor={(row) => row.id} />);

    for (const tr of bodyRows(container)) {
      expect(tr).not.toHaveAttribute("tabindex");
      expect(tr).not.toHaveAttribute("role");
    }
    await user.tab();
    expect(bodyRows(container).some((tr) => tr === document.activeElement)).toBe(false);
  });
});

describe("Table error state (sfNW22M7)", () => {
  it("shows an error with a retry button instead of the empty state when the query failed", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<Table data={[]} columns={columns} keyExtractor={(row) => row.id} emptyMessage="Topilmadi" error onRetry={onRetry} />);

    expect(screen.queryByText("Topilmadi")).not.toBeInTheDocument();
    // Bu faylda i18n provayderi yo'q — tugma matni kalit ("retry") bo'lib chiqadi.
    await user.click(screen.getByRole("button", { name: /Qayta urinish|retry/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("keeps the normal empty state when there is no error", () => {
    render(<Table data={[]} columns={columns} keyExtractor={(row) => row.id} emptyMessage="Topilmadi" />);

    expect(screen.getByText("Topilmadi")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Qayta urinish|retry/ })).not.toBeInTheDocument();
  });
});
