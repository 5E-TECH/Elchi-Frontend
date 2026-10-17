import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { SourceListCard, type SourceListQuery, type SourceListRow } from "./SourceListCard";

/**
 * `SourceListCard` — «Qabul va yaratish» manba ro'yxati kartasi (filial paketlari, bekor qilinganlar):
 * shartnoma — qatorlar, so'rov holati, matnlar va havolalar sahifadan; qidiruv, saralash va xulosa — ichida.
 */

vi.mock("../../../shared/api/api", () => ({
  api: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const ROWS: SourceListRow[] = [
  { id: "a", name: "Alfa", phone_number: "+998901112233", orders_count: 2, total_price_sum: 300 },
  { id: "b", name: "Beta", phone_number: "—", orders_count: 5, total_price_sum: 100 },
];

const ok: SourceListQuery = { status: "success", isLoading: false, isError: false, refetch: vi.fn() };

const LocationProbe = () => <span data-testid="location">{useLocation().pathname}</span>;

const renderCard = (query: SourceListQuery = ok, rows: SourceListRow[] = ROWS) => {
  const summary = vi.fn((totals: { markets: number; orders: number; amount: number }) => (
    <p data-testid="summary">{`${totals.markets}/${totals.orders}/${totals.amount}`}</p>
  ));
  const view = renderWithProviders(
    <>
      <Routes>
        <Route
          path="/list"
          element={
            <SourceListCard
              rows={rows}
              query={query}
              ariaLabel="Karta"
              searchPlaceholder="Nom yoki telefon"
              searchLabel="Qidirish"
              listLabel="Ro'yxat"
              loadingLabel="Yuklanmoqda"
              columns={{ name: "Nom", phone: "Telefon", count: "Soni", amount: "Summa", actions: "Amallar" }}
              sortTitles={{ name: "Nom bo'yicha", count: "Son bo'yicha", amount: "Summa bo'yicha" }}
              countCell={(value) => `${value} dona`}
              cardSub={(row) => `${row.phone_number} · ${row.orders_count}`}
              openLabel={(row) => `${row.name} ni ochish`}
              hrefOf={(row) => `/item/${row.id}`}
              summary={summary}
              empty={<p>Hech narsa yo'q</p>}
              noMatch={{ title: "Topilmadi", description: "Tekshiring", clear: "Tozalash" }}
            />
          }
        />
        <Route path="/item/:id" element={<p>Tafsilot</p>} />
      </Routes>
      <LocationProbe />
    </>,
    { route: "/list", preloadedState: { role: { id: "1", role: "admin", region: null, name: "admin" } } as never },
  );
  return { ...view, summary };
};

const names = () =>
  within(screen.getByRole("table", { name: "Ro'yxat" }))
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("link")[0].textContent);

describe("SourceListCard", () => {
  it("karta nomi, ustunlar, son katagi, «ochish» havolasi; sukut — son bo'yicha kamayish", () => {
    renderCard();
    const card = screen.getByRole("region", { name: "Karta" });
    expect(within(card).getByRole("searchbox", { name: "Qidirish" })).toHaveAttribute("placeholder", "Nom yoki telefon");
    expect(names()).toEqual(["Beta", "Alfa"]);
    expect(screen.getByRole("columnheader", { name: /Soni/ })).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByText("5 dona")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Alfa ni ochish" })).toHaveAttribute("href", "/item/a");
  });

  it("xulosa — barcha qatorlar bo'yicha (qidiruvdan qat'i nazar), faqat muvaffaqiyatli holatda", async () => {
    const user = userEvent.setup();
    renderCard();
    expect(screen.getByTestId("summary")).toHaveTextContent("2/7/400");

    await user.type(screen.getByRole("searchbox", { name: "Qidirish" }), "alfa");
    expect(names()).toEqual(["Alfa"]);
    expect(screen.getByTestId("summary")).toHaveTextContent("2/7/400");
  });

  it("xatoda xulosa yo'q, «Qayta urinish» so'rovni qaytaradi", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    const { summary } = renderCard({ status: "error", isLoading: false, isError: true, error: new Error("x"), refetch }, []);
    expect(summary).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("bo'sh — sahifaning bo'sh holati; natija yo'q — «Tozalash»", async () => {
    const user = userEvent.setup();
    const { unmount } = renderCard(ok, []);
    expect(screen.getByText("Hech narsa yo'q")).toBeInTheDocument();
    unmount();

    renderCard();
    await user.type(screen.getByRole("searchbox", { name: "Qidirish" }), "gamma");
    const noMatch = screen.getByText("Topilmadi").parentElement as HTMLElement;
    await user.click(within(noMatch).getByRole("button", { name: "Tozalash" }));
    expect(names()).toEqual(["Beta", "Alfa"]);
  });

  it("qatorni bosish — `hrefOf` ga o'tadi", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByText("+998 90 111 22 33"));
    expect(screen.getByTestId("location")).toHaveTextContent("/item/a");
  });
});
