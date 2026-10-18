import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import ActivityLogsPage from ".";
import { renderWithProviders } from "../../test/test-utils";

/**
 * `/activity-logs` sahifasi — integratsiya testi (G2): haqiqiy hook'lar, faqat HTTP qatlami soxta. Komponent
 * darajasidagi holatlar (TC8, TC11, …) — `widgets/activity-log/ui/ActivityLogViewer.test.tsx`.
 */

const apiGetMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: { get: (...args: unknown[]) => apiGetMock(...args) },
}));

/** Gateway audit feed (`GET /activity-logs`) — `{ data: { items, meta } }`, qatorlar boyitilgan (`actor`, `action_meta`). */
const LOGS = [
  {
    id: 101,
    entity_type: "Order",
    entity_id: "10227",
    action: "status_change",
    _service: "order",
    created_at: "2026-10-06T09:32:00Z",
    user_name: "Jasur Tursunov",
    user_role: "courier",
    actor: { id: "7", name: "Jasur Tursunov", role: "courier" },
    action_meta: { action: "status_change", label: "Holat o'zgardi", category: "general", tone: "blue", known: true },
    old_value: { status: "on_the_road", sold_at: null },
    new_value: { status: "sold", sold_at: "2026-10-06T09:32:00Z" },
    metadata: { source: "Kuryer ilovasi", device: "Android" },
    trace_id: "4f9c2a7e81d34b6a9e05c3d17a2b8f64",
    entity: { id: "10227", status: "sold" },
  },
  {
    id: 102,
    entity_type: "User",
    entity_id: "61",
    action: "logout",
    _service: "identity",
    created_at: "2026-10-05T11:31:00Z",
    actor: { id: "61", name: "Akbar Nurmatov", role: "market" },
    action_meta: { action: "logout", label: "Tizimdan chiqdi", category: "auth", known: true },
    old_value: null,
    new_value: null,
    metadata: null,
    trace_id: null,
    entity: { id: "61", name: "Akbar Nurmatov" },
  },
  {
    id: 103,
    entity_type: "Product",
    entity_id: "887",
    action: "deleted",
    _service: "catalog",
    created_at: "2026-10-05T10:24:00Z",
    actor: { id: "1", name: "Shodiyor Ergashev", role: "superadmin" },
    old_value: { name: "Eski zaryadlovchi" },
    new_value: null,
    metadata: null,
    entity: { id: "887", name: "Eski zaryadlovchi" },
  },
];

const CATALOG = {
  data: ["status_change", "logout", "deleted", "order.cancel"],
  registry: [
    { action: "status_change", label: "Holat o'zgardi", category: "general", category_label: "Umumiy" },
    { action: "logout", label: "Tizimdan chiqdi", category: "auth", category_label: "Kirish" },
    { action: "deleted", label: "O'chirildi", category: "general", category_label: "Umumiy" },
    { action: "order.cancel", label: "Bekor qilindi", category: "order", category_label: "Buyurtma" },
  ],
  categories: [],
};

const feed = (items: unknown[], total = items.length) => ({
  data: { data: { items, meta: { page: 1, limit: 20, total, totalPages: Math.max(1, Math.ceil(total / 20)) } } },
});

/** Oxirgi `GET activity-logs` so'rovining parametrlari. */
const lastListParams = () => {
  const calls = apiGetMock.mock.calls.filter(([url]) => url === "activity-logs");
  return (calls.at(-1)?.[1] as { params: Record<string, unknown> } | undefined)?.params;
};

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

describe("Faoliyat jurnali (dizayn v2)", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiGetMock.mockImplementation((url: string) => {
      if (url === "activity-logs/actions") return Promise.resolve({ data: CATALOG });
      if (url === "activity-logs") return Promise.resolve(feed(LOGS));
      return Promise.resolve({ data: {} });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sarlavha va jadval: vaqt, kim (rol yorlig'i), amal badge'i, obyekt, xizmat; sahifalash xulosasi", async () => {
    renderWithProviders(<ActivityLogsPage />, { route: "/activity-logs" });

    expect(screen.getByRole("heading", { level: 1, name: "Faoliyat jurnali" })).toBeInTheDocument();
    const table = await screen.findByRole("table", { name: "Faoliyat jurnali yozuvlari" });
    const headers = within(table).getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(headers).toEqual(["Tafsilot", "Vaqt", "Kim", "Amal", "Obyekt", "Xizmat"]);

    const row = within(table).getByText("Jasur Tursunov").closest("tr") as HTMLTableRowElement;
    expect(within(row).getByText("Kuryer")).toBeInTheDocument();
    expect(within(row).getByText("Holat o'zgardi")).toBeInTheDocument();
    expect(within(row).getByText("№10227")).toBeInTheDocument();
    expect(within(row).getByText("Buyurtmalar")).toBeInTheDocument();

    const deletedRow = within(table).getByText("Shodiyor Ergashev").closest("tr") as HTMLTableRowElement;
    // Ton kelmagan eski fe'l — kalit so'z bo'yicha (o'chirildi → danger).
    expect(within(deletedRow).getByText("O'chirildi").closest("[data-tone]")).toHaveAttribute("data-tone", "danger");
    expect(within(deletedRow).getByText("Superadmin")).toBeInTheDocument();

    expect(screen.getByText("1–3 / 3 ta yozuv")).toBeInTheDocument();
    expect(lastListParams()).toEqual({ page: 1, limit: 20 });
  });

  it("qator ochiladi: maydon o'zgarishlari (yorliq + kalit, oldin → keyin), qo'shimcha ma'lumot, Kuzatuv ID; o'zgarishsiz yozuvda chevron yo'q", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ActivityLogsPage />, { route: "/activity-logs" });

    const toggle = await screen.findByRole("button", { name: "Buyurtma №10227 tafsilotini ochish" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // «Tizimdan chiqdi» — o'zgarish, metadata va kuzatuv ID yo'q: chevron yo'q.
    expect(screen.queryByRole("button", { name: /Foydalanuvchi #61/ })).toBeNull();

    await user.click(toggle);
    const changes = await screen.findByRole("table", { name: "Maydon o'zgarishlari" });
    const statusRow = within(changes).getByText("status").closest("tr") as HTMLTableRowElement;
    expect(within(statusRow).getByText("Holat")).toBeInTheDocument();
    expect(within(statusRow).getByText("Yo'lda")).toHaveClass("line-through");
    expect(within(statusRow).getByText("Sotilgan")).toBeInTheDocument();
    expect(within(changes).getByText("Sotilgan vaqti")).toBeInTheDocument();

    expect(screen.getByText("Qo'shimcha ma'lumot")).toBeInTheDocument();
    expect(screen.getByText("Manba")).toBeInTheDocument();
    expect(screen.getByText("Kuryer ilovasi")).toBeInTheDocument();
    expect(screen.getByText("4f9c2a7e81d34b6a9e05c3d17a2b8f64")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kuzatuv ID ni nusxalash" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Buyurtma №10227 tafsilotini yopish" }));
    expect(screen.queryByRole("table", { name: "Maydon o'zgarishlari" })).toBeNull();
  });

  it("qidiruv 400 ms kechikish bilan; Xizmat filtri → `service`, sahifa 1 ga qaytadi; «Filtrlarni tozalash»", async () => {
    const user = userEvent.setup();
    apiGetMock.mockImplementation((url: string) => {
      if (url === "activity-logs/actions") return Promise.resolve({ data: CATALOG });
      if (url === "activity-logs") return Promise.resolve(feed(LOGS, 45));
      return Promise.resolve({ data: {} });
    });
    renderWithProviders(<ActivityLogsPage />, { route: "/activity-logs" });

    expect(screen.queryByRole("button", { name: "Filtrlarni tozalash" })).toBeNull();
    await user.click(await screen.findByRole("button", { name: "2" }));
    await waitFor(() => expect(lastListParams()).toMatchObject({ page: 2 }));

    await user.type(screen.getByRole("searchbox", { name: "Jurnaldan qidirish" }), "10227");
    await waitFor(() => expect(lastListParams()).toEqual({ page: 1, limit: 20, search: "10227" }), { timeout: 2000 });

    await user.click(screen.getByRole("combobox", { name: "Xizmat" }));
    await user.click(await screen.findByRole("option", { name: "Moliya" }));
    await waitFor(() => expect(lastListParams()).toEqual({ page: 1, limit: 20, search: "10227", service: "finance" }));

    await user.type(screen.getByRole("textbox", { name: "Foydalanuvchi ID" }), "7");
    await waitFor(() => expect(lastListParams()).toMatchObject({ user_id: "7" }));

    await user.click(screen.getByRole("button", { name: "Filtrlarni tozalash" }));
    // Filtrsiz so'rov keshda bor (birinchi yuklash) — qayta yuborilmaydi; maydonlar tozalanadi, havola yo'qoladi.
    expect(screen.getByRole("searchbox", { name: "Jurnaldan qidirish" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Foydalanuvchi ID" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Xizmat" })).toHaveTextContent("Barchasi");
    expect(screen.queryByRole("button", { name: "Filtrlarni tozalash" })).toBeNull();
  });

  it("Amal filtri — katalog yorliqlari (`GET /activity-logs/actions` reyestri)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ActivityLogsPage />, { route: "/activity-logs" });

    await user.click(await screen.findByRole("combobox", { name: "Amal" }));
    await user.click(await screen.findByRole("option", { name: "Bekor qilindi" }));
    await waitFor(() => expect(lastListParams()).toMatchObject({ action: "order.cancel" }));
  });

  it("Amal filtri guruhlari ru tilida tarjima qilinadi (backend `category_label` — faqat o'zbekcha)", async () => {
    const user = userEvent.setup();
    await i18n.changeLanguage("ru");
    try {
      renderWithProviders(<ActivityLogsPage />, { route: "/activity-logs" });
      await user.click(await screen.findByRole("combobox", { name: "Действие" }));
      expect(await screen.findByRole("group", { name: "Заказ" })).toBeInTheDocument();
      expect(screen.getByRole("group", { name: "Вход" })).toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "Buyurtma" })).toBeNull();
    } finally {
      await i18n.changeLanguage("uz");
    }
  });

  it("xato — «Faoliyat jurnalini yuklashda xatolik yuz berdi» + qayta urinish; bo'sh — «Yozuvlar topilmadi»", async () => {
    const user = userEvent.setup();
    let fail = true;
    apiGetMock.mockImplementation((url: string) => {
      if (url === "activity-logs/actions") return Promise.resolve({ data: CATALOG });
      if (url === "activity-logs") {
        if (fail) return Promise.reject({ response: { status: 500, data: { message: "down" } } });
        return Promise.resolve(feed([]));
      }
      return Promise.resolve({ data: {} });
    });
    renderWithProviders(<ActivityLogsPage />, { route: "/activity-logs" });

    expect(await screen.findByText("Faoliyat jurnalini yuklashda xatolik yuz berdi")).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: /Qayta urinish/ }));
    expect(await screen.findByText("Yozuvlar topilmadi")).toBeInTheDocument();
  });

  it("telefonda: kartalar + chevron, filtrlar pastki varaqada (qoralama → «Natijalarni ko'rsatish»)", async () => {
    mockPhone(true);
    const user = userEvent.setup();
    renderWithProviders(<ActivityLogsPage />, { route: "/activity-logs" });

    const list = await screen.findByRole("list", { name: "Faoliyat jurnali yozuvlari" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByRole("combobox", { name: "Xizmat" })).toBeNull();

    await user.click(within(list).getByRole("button", { name: "Buyurtma №10227 tafsilotini ochish" }));
    expect(await within(list).findByText("Maydon o'zgarishlari")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filtrlar" }));
    const sheet = await screen.findByRole("dialog", { name: "Filtrlar" });
    await user.type(within(sheet).getByRole("textbox", { name: "Foydalanuvchi ID" }), "61");
    expect(lastListParams()).not.toHaveProperty("user_id");
    await user.click(within(sheet).getByRole("button", { name: "Natijalarni ko'rsatish" }));

    await waitFor(() => expect(lastListParams()).toEqual({ page: 1, limit: 20, user_id: "61" }));
    expect(screen.getByRole("button", { name: /Filtrlar/ })).toHaveTextContent("1");
  });
});
