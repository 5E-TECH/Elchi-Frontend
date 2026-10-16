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
