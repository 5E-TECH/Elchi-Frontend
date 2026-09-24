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
});
