import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import SourcePicker from "./SourcePicker";
import { renderWithProviders } from "../../test/test-utils";

const apiGetMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: vi.fn(),
  },
}));

const HOUR = 3_600_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

/** Maketdagi uch manba (`superadmin-neworders-incoming-sources`): 7 · 3 · 2 posilka, biri 4 kun kutmoqda. */
const SOURCES = [
  { market_id: "121", orders_count: 7, total_price_sum: 1_845_000, oldest_at: ago(3 * HOUR), market: { name: "BeePost" } },
  { market_id: "122", orders_count: 3, total_price_sum: 642_000, oldest_at: ago(20 * HOUR), market: { name: "Ipak Yo'li Savdo" } },
  { market_id: "123", orders_count: 2, total_price_sum: 1_160_000, oldest_at: ago(4 * 24 * HOUR), market: { name: "Nur Elektronika" } },
];

const INTEGRATIONS = [
  // Posilkasi bor manba — «posilkasiz» ro'yxatda takrorlanmaydi.
  { id: 1, name: "BeePost chiquvchi", role: "source", category: "marketplace", is_active: true, market_id: "121" },
  // Posilkasiz ulangan manba.
  { id: 2, name: "Chilonzor Market", role: "source", category: "marketplace", is_active: true, market_id: "900" },
  // Yetkazuvchi (carrier) — manba emas.
  { id: 3, name: "Kargo", role: "carrier", category: "cargo", is_active: true, market_id: null },
];

type Mock = { sources?: unknown; sourcesError?: unknown };

const mockApi = ({ sources = SOURCES, sourcesError }: Mock = {}) =>
  apiGetMock.mockImplementation((url: string) => {
    if (url === "orders/external/sources") {
      return sourcesError ? Promise.reject(sourcesError) : Promise.resolve({ data: sources });
    }
    if (url === "integrations") return Promise.resolve({ data: { statusCode: 200, data: { items: INTEGRATIONS } } });
    if (url === "admin/partners") return Promise.resolve({ data: [{ id: 7, name: "BeePost hamkor", is_active: true }] });
    return Promise.resolve({ data: [] });
  });

const sourcesCalls = () => apiGetMock.mock.calls.filter(([url]) => url === "orders/external/sources");

const stateFor = (role: string, branchType?: string) =>
  ({
    role: { id: `${role}-1`, role, region: null, name: role },
    user: {
      user: { id: `${role}-1`, role, ...(branchType ? { branch: { id: "1", type: branchType } } : {}) },
      isAuthenticated: true,
      accessToken: null,
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;

const renderPicker = (role = "superadmin", branchType?: string) =>
  renderWithProviders(
    <Routes>
      <Route path="/new-orders/incoming" element={<SourcePicker />} />
    </Routes>,
    { route: "/new-orders/incoming", preloadedState: stateFor(role, branchType) },
  );

const requestedUrls = () => apiGetMock.mock.calls.map(([url]) => url);

describe("SourcePicker — kiruvchi posilkalar manbalari (dizayn v2)", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  it("⭐ har manba — skanerlash sahifasiga havola, soni, summasi va eng eski posilka kutishi", async () => {
    mockApi();
    renderPicker();

    const table = await screen.findByRole("table", { name: "Manbalar" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);

    const beepost = within(rows[0]);
    expect(beepost.getByRole("link", { name: "BeePost" })).toHaveAttribute("href", "/new-orders/incoming/121");
    expect(beepost.getByRole("link", { name: "BeePost posilkalarini skanerlash" })).toHaveAttribute(
      "href",
      "/new-orders/incoming/121",
    );
    expect(beepost.getByText("7 ta")).toBeInTheDocument();
    expect(beepost.getByText("1 845 000 so'm")).toBeInTheDocument();
    expect(beepost.getByText("3 soat")).toBeInTheDocument();
    expect(beepost.getByRole("meter", { name: "BeePost: eng eski posilka 3 soat kutmoqda, chegara 3 kun" })).toHaveAttribute(
      "aria-valuenow",
      "3",
    );

    // 3 kundan uzoq kutgan manba sariq badge bilan (rang matn bilan birga).
    const stale = within(rows[2]);
    expect(stale.getByText("4 kun kutmoqda")).toBeInTheDocument();
    expect(stale.getByRole("meter")).toHaveAttribute("aria-valuenow", "96");
  });

  it("taqsimot xulosasi: halqa nomi, jami summa va eng uzoq kutayotgan manba", async () => {
    mockApi();
    renderPicker();

    expect(
      await screen.findAllByRole("img", {
        name: "Kutilayotgan 12 ta posilka: BeePost 7, Ipak Yo'li Savdo 3, Nur Elektronika 2",
      }),
    ).not.toHaveLength(0);
    expect(screen.getByRole("list", { name: "Manbalar bo'yicha ulush" })).toHaveTextContent("58,3%");
    expect(screen.getByText("Jami summa").nextElementSibling).toHaveTextContent("3 647 000so'm");
    expect(screen.getByText("Eng uzoq kutayotgan").nextElementSibling).toHaveTextContent("Nur Elektronika4 kun kutmoqda");
  });

  it("superadmin: karta qobiq tablari bilan boshlanadi, «Kiruvchi posilkalar» joriy tab", async () => {
    mockApi();
    renderPicker("superadmin");
    await screen.findByRole("table", { name: "Manbalar" });

    const tabs = screen.getByRole("navigation", { name: "Qabul manbalari" });
    expect(within(tabs).getByRole("link", { name: /Kiruvchi posilkalar/ })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("heading", { level: 2, name: "Kiruvchi posilkalar" })).not.toBeInTheDocument();
  });

  it.each([
    ["manager", "HQ"],
    ["manager", "PICKUP"],
    ["registrator", "REGIONAL"],
  ])(
    "⭐ %s (%s): «Marketlar · Kiruvchi posilkalar» tablari; ulanishlar (admin/partners, integrations) so'ralmaydi — 403 yo'q",
    async (role, branchType) => {
      mockApi();
      renderPicker(role, branchType);
      await screen.findByRole("table", { name: "Manbalar" });

      const tabs = screen.getByRole("navigation", { name: "Qabul manbalari" });
      expect(within(tabs).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
        "/new-orders",
        "/new-orders/incoming",
      ]);
      expect(within(tabs).getByRole("link", { name: /Kiruvchi posilkalar/ })).toHaveAttribute("aria-current", "page");
      expect(screen.queryByRole("heading", { level: 2, name: "Kiruvchi posilkalar" })).not.toBeInTheDocument();
      expect(requestedUrls()).not.toContain("admin/partners");
      expect(requestedUrls()).not.toContain("integrations");
      expect(screen.queryByRole("region", { name: "Ulangan manbalar — hozircha posilka yo'q" })).not.toBeInTheDocument();
    },
  );

  it("superadmin: ulanishlar so'raladi (posilkasiz manbalar kartasi uchun)", async () => {
    mockApi();
    renderPicker("superadmin");
    await screen.findByRole("table", { name: "Manbalar" });

    await waitFor(() => expect(requestedUrls()).toEqual(expect.arrayContaining(["admin/partners", "integrations"])));
  });

  it("qabul qilmaydigan menejer (REGIONAL) — ruxsat yo'q", async () => {
    mockApi();
    renderPicker("manager", "REGIONAL");

    expect(await screen.findByText("Bu sahifaga kirish huquqingiz yo'q")).toBeInTheDocument();
  });

  it("ulangan, lekin posilkasiz manbalar alohida kartada (hamkor va yetkazuvchi emas) + Integratsiyalar havolasi", async () => {
    mockApi();
    renderPicker();

    const card = await screen.findByRole("region", { name: "Ulangan manbalar — hozircha posilka yo'q" });
    expect(within(card).getByText("Chilonzor Market")).toBeInTheDocument();
    expect(within(card).queryByText("BeePost chiquvchi")).not.toBeInTheDocument();
    expect(within(card).queryByText("BeePost hamkor")).not.toBeInTheDocument();
    expect(within(card).queryByText("Kargo")).not.toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /Integratsiyalar/ })).toHaveAttribute(
      "href",
      "/integrations/connections?scope=external",
    );
  });

  it("posilka yo'q — o'rgatuvchi bo'sh holat (xato emas)", async () => {
    mockApi({ sources: [] });
    renderPicker();

    expect(await screen.findByText("Qabul kutayotgan posilka yo'q")).toBeInTheDocument();
    expect(screen.getByText(/posilka kelmaguncha manba bu yerda chiqmaydi/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("so'rov yiqilsa — xato va «Qayta urinish» qayta so'raydi", async () => {
    const user = userEvent.setup();
    mockApi({ sourcesError: { response: { status: 500, data: { message: "Xizmat javob bermadi" } } } });
    renderPicker();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Manbalar ro'yxatini olib bo'lmadi");
    const before = sourcesCalls().length;
    await user.click(within(alert).getByRole("button", { name: /Qayta urinish/ }));
    await waitFor(() => expect(sourcesCalls().length).toBe(before + 1));
  });

  it("«Yangilash» ro'yxatni qayta so'raydi", async () => {
    const user = userEvent.setup();
    mockApi();
    renderPicker();
    await screen.findByRole("table", { name: "Manbalar" });
    const before = sourcesCalls().length;

    await user.click(screen.getByRole("button", { name: "Yangilash" }));

    await waitFor(() => expect(sourcesCalls().length).toBe(before + 1));
  });

  it("market roli — ruxsat yo'q (qabul qilmaydi)", async () => {
    mockApi();
    renderPicker("market");

    expect(await screen.findByText("Bu sahifaga kirish huquqingiz yo'q")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
