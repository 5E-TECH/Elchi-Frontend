import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import BranchBatchesPage from "./index";

/**
 * «Qabul va yaratish» → «Filial paketlari» (dizayn v2, maket `superadmin-neworders-branches`): qobiq tablari
 * kartada, xulosa, jadval, mijoz tomonidagi qidiruv va saralash, holatlar, telefonda kartalar.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

/** Backend `branch.transfer_batches.branches_with_sent` javobi (`successRes({ side, direction, items })`). */
const BRANCHES = [
  { id: "7", name: "Chilonzor qabul punkti", phone_number: "+998712001452", sent_batches_count: 6, sent_total_price: 15155500 },
  { id: "8", name: "Sergeli qabul punkti", phone_number: "+998712036618", sent_batches_count: 2, sent_total_price: 1645000 },
  { id: "9", name: "Urgut filiali", phone_number: null, sent_batches_count: 1, sent_total_price: 540000 },
];

const respondWith = (items: unknown) => {
  mocks.get.mockImplementation((url: string) =>
    url === "branches/with-sent-batches"
      ? items instanceof Error
        ? Promise.reject(items)
        : Promise.resolve({ data: { statusCode: 200, data: { side: "source", direction: "FORWARD", items } } })
      : Promise.resolve({ data: { data: [] } }),
  );
};

const LocationProbe = () => <span data-testid="location">{useLocation().pathname}</span>;

const stateFor = (role = "admin") =>
  ({
    role: { id: `${role}-1`, role, region: null, name: role },
    user: {
      user: { id: `${role}-1`, role },
      isAuthenticated: true,
      accessToken: null,
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;

const renderPage = (role = "admin") =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/new-orders/branches" element={<BranchBatchesPage />} />
        <Route path="/new-orders/branches/:branchId" element={<p>Filial paketlari ro'yxati</p>} />
      </Routes>
      <LocationProbe />
    </>,
    { route: "/new-orders/branches", preloadedState: stateFor(role) },
  );

const bodyRows = () => within(screen.getByRole("table", { name: "Filiallar" })).getAllByRole("row").slice(1);
const branchNames = () => bodyRows().map((row) => within(row).getAllByRole("link")[0].textContent);

describe("Filial paketlari — karta, tablar, jadval", () => {
  beforeEach(() => respondWith(BRANCHES));

  it("karta qobiq tablari bilan boshlanadi: «Filial paketlari» joriy, son = filiallar", async () => {
    renderPage("superadmin");

    const card = screen.getByRole("region", { name: "Qabul kutayotgan buyurtmalar" });
    const nav = within(card).getByRole("navigation", { name: "Qabul manbalari" });
    const current = within(nav).getByRole("link", { current: "page" });
    expect(current).toHaveAttribute("href", "/new-orders/branches");
    await waitFor(() => expect(current).toHaveTextContent("Filial paketlari 3"));
  });

  it("xulosa: «3 ta filial · 9 ta paket · jami 17 340 500 so'm»; stat kartalar va # ustuni yo'q", async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/ta filial/).closest("p")).toHaveTextContent(
        "3 ta filial · 9 ta paket · jami 17 340 500 so'm",
      ),
    );
    expect(screen.queryByRole("columnheader", { name: "#" })).not.toBeInTheDocument();
    expect(screen.queryByText("Filiallar", { selector: "span" })).not.toBeInTheDocument();
  });

  it("qatorlar: paketlar soni bo'yicha kamayish (sukut), havolalar, telefon, summa", async () => {
    renderPage();

    await waitFor(() => expect(branchNames()).toEqual(["Chilonzor qabul punkti", "Sergeli qabul punkti", "Urgut filiali"]));
    expect(screen.getByRole("columnheader", { name: /Paketlar/ })).toHaveAttribute("aria-sort", "descending");

    const [first, , third] = bodyRows();
    expect(within(first).getByRole("link", { name: "Chilonzor qabul punkti" })).toHaveAttribute("href", "/new-orders/branches/7");
    expect(within(first).getByRole("link", { name: "Chilonzor qabul punkti paketlarini ochish" })).toHaveAttribute(
      "href",
      "/new-orders/branches/7",
    );
    expect(first).toHaveTextContent("+998 71 200 14 52");
    expect(first).toHaveTextContent("6 ta");
    expect(first).toHaveTextContent("15 155 500 so'm");
    // Telefon yo'q (null) — «—».
    expect(within(third).getAllByRole("cell")[1]).toHaveTextContent("—");
  });

  it("saralash: nom, summa; qatorni bosish filial paketlarini ochadi", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(bodyRows()).toHaveLength(3));

    // O'zbek alifbosi tartibi (`localeCompare(…, "uz")`): «Ch» — alohida harf, «Z» dan keyin.
    await user.click(screen.getByRole("button", { name: /^Filial/ }));
    expect(branchNames()).toEqual(["Sergeli qabul punkti", "Urgut filiali", "Chilonzor qabul punkti"]);
    await user.click(screen.getByRole("button", { name: /^Filial/ }));
    expect(branchNames()).toEqual(["Chilonzor qabul punkti", "Urgut filiali", "Sergeli qabul punkti"]);

    await user.click(screen.getByRole("button", { name: /Umumiy summa/ }));
    expect(branchNames()).toEqual(["Chilonzor qabul punkti", "Sergeli qabul punkti", "Urgut filiali"]);

    await user.click(within(bodyRows()[1]).getByText("+998 71 203 66 18"));
    expect(screen.getByTestId("location")).toHaveTextContent("/new-orders/branches/8");
  });

  it("qidiruv: nom va telefon raqamlari (mijoz tomonida); natija yo'q — «Qidiruvni tozalash»", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(bodyRows()).toHaveLength(3));

    const search = screen.getByRole("searchbox", { name: "Filiallarni qidirish" });
    expect(search).toHaveAttribute("placeholder", "Filial nomi yoki telefon raqami");

    await user.type(search, "sergeli");
    expect(branchNames()).toEqual(["Sergeli qabul punkti"]);

    await user.clear(search);
    await user.type(search, "71 200");
    expect(branchNames()).toEqual(["Chilonzor qabul punkti"]);

    await user.clear(search);
    await user.type(search, "Namangan");
    const noMatch = screen.getByText("Bu qidiruv bo'yicha filial topilmadi").parentElement as HTMLElement;
    await user.click(within(noMatch).getByRole("button", { name: "Qidiruvni tozalash" }));
    expect(bodyRows()).toHaveLength(3);

    // So'rov tab sonidagi kalit bilan (side=source, direction=FORWARD) va bitta — qidiruv backendga ketmaydi.
    const calls = mocks.get.mock.calls.filter(([url]) => url === "branches/with-sent-batches");
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toEqual({ params: { side: "source", direction: "FORWARD" } });
  });
});

describe("Filial paketlari — holatlar", () => {
  it("bo'sh: «Qabul kutayotgan filial paketi yo'q» (v1 «batch» so'zi yo'q), xulosa yo'q", async () => {
    respondWith([]);
    renderPage();
    expect(await screen.findByText("Qabul kutayotgan filial paketi yo'q")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(/ta filial/)).not.toBeInTheDocument();
    expect(screen.queryByText(/batch/i)).not.toBeInTheDocument();
  });

  it("xato: «Qayta urinish», xulosa yozilmaydi; qayta urinish ro'yxatni chiqaradi", async () => {
    const user = userEvent.setup();
    respondWith(new Error("Network Error"));
    renderPage();

    const retry = await screen.findByRole("button", { name: "Qayta urinish" });
    expect(screen.queryByText(/ta filial/)).not.toBeInTheDocument();

    respondWith(BRANCHES);
    await user.click(retry);
    await waitFor(() => expect(bodyRows()).toHaveLength(3));
  });
});

describe("Filial paketlari — telefon (< 768): kartalar", () => {
  const original = window.matchMedia;
  beforeEach(() => {
    respondWith(BRANCHES);
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

  it("har filial — bitta havola: nom, summa, «telefon · N ta paket»", async () => {
    renderPage();

    const list = await screen.findByRole("list", { name: "Filiallar" });
    const cards = within(list).getAllByRole("link");
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveAttribute("href", "/new-orders/branches/7");
    expect(cards[0]).toHaveTextContent("Chilonzor qabul punkti15 155 500 so'm+998 71 200 14 52 · 6 ta paket");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
