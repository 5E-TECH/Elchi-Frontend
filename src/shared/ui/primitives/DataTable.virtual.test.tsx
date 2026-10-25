import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../../i18n";
import { DataTable, type DataTableColumn } from "./DataTable";

/**
 * F4RSPBwx — virtualizatsiya (`virtualizeFrom`): 100 qatordan faqat ko'rinadiganlari (+ zaxira) chiziladi, kalitlar
 * `getRowKey` dan — ro'yxat siljisa ham har qator o'z DOM elementida qoladi (jadval va telefon kartalari).
 * jsdom'da maket yo'q: skroll konteyneri 300 px, qator 56 px (`offsetHeight`) soxtalashtiriladi.
 */
type Row = { id: string; name: string };

const rowsOf = (count: number, from = 1): Row[] =>
  Array.from({ length: count }, (_, index) => ({ id: `r${from + index}`, name: `Buyurtma ${from + index}` }));

const COLUMNS: DataTableColumn<Row>[] = [{ id: "name", header: "Buyurtma", cell: (row) => row.name }];

const Scroller = ({ children }: { children: ReactNode }) => (
  <div data-testid="scroller" style={{ overflowY: "auto" }}>
    {children}
  </div>
);

const isScroller = (element: HTMLElement) => element.dataset.testid === "scroller";

const mockPhone = (phone: boolean) =>
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: phone && query === "(max-width: 767px)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  );

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
    if (isScroller(this)) return 300;
    return this.dataset.index !== undefined ? 56 : 0;
  });
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
    return isScroller(this) ? 800 : 0;
  });
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) {
    return isScroller(this) ? 300 : 0;
  });
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLElement) {
    return isScroller(this) ? 6000 : 0;
  });
});

afterEach(() => vi.restoreAllMocks());

const table = (rows: Row[], virtualizeFrom?: number) => (
  <Scroller>
    <DataTable
      rows={rows}
      columns={COLUMNS}
      getRowKey={(row) => row.id}
      label="Buyurtmalar"
      renderCard={(row) => <span>{row.name}</span>}
      virtualizeFrom={virtualizeFrom}
    />
  </Scroller>
);

describe.each([
  ["jadval", false, "tr"],
  ["telefon kartalari", true, "li"],
] as const)("DataTable virtualizatsiya — %s", (_name, phone, rowTag) => {
  beforeEach(() => {
    mockPhone(phone);
  });

  it("100 qatordan faqat ko'rinadiganlari chiziladi; umumiy son ekran o'quvchiga", async () => {
    render(table(rowsOf(100), 30));
    await screen.findByText("Buyurtma 1");
    const rendered = document.querySelectorAll(`${rowTag}[data-index]`);
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(20);
    expect(screen.queryByText("Buyurtma 100")).not.toBeInTheDocument();
    if (phone) expect(rendered[0]).toHaveAttribute("aria-setsize", "100");
    else expect(screen.getByRole("table")).toHaveAttribute("aria-rowcount", "101");
  });

  it("kalit — getRowKey: ro'yxat boshiga qator qo'shilsa ham «Buyurtma 3» o'z DOM elementida qoladi", async () => {
    const { rerender } = render(table(rowsOf(100), 30));
    const before = (await screen.findByText("Buyurtma 3")).closest(rowTag);
    expect(before).toHaveAttribute("data-index", "2");

    rerender(table([{ id: "r0", name: "Buyurtma 0" }, ...rowsOf(100)], 30));

    const after = (await screen.findByText("Buyurtma 3")).closest(rowTag);
    expect(after).toBe(before);
    expect(after).toHaveAttribute("data-index", "3");
    expect(screen.getByText("Buyurtma 0").closest(rowTag)).toHaveAttribute("data-index", "0");
  });

  it("chegaradan kam qator (yoki prop yo'q) — avvalgidek hammasi, virtualizatsiya belgilarisiz", () => {
    render(table(rowsOf(30), 30));
    expect(document.querySelectorAll(`${rowTag}[data-index]`)).toHaveLength(0);
    expect(screen.getByText("Buyurtma 30")).toBeInTheDocument();
  });
});
