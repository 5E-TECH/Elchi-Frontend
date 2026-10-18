import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import type { ActivityActionsCatalog, ActivityLog, ActivityLogParams } from "../../../entities/activity-log";
import ActivityLogViewer from "./ActivityLogViewer";

const mocks = vi.hoisted(() => ({
  logs: vi.fn(),
  actions: vi.fn(),
}));

vi.mock("../../../entities/activity-log", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/activity-log")>()),
  useActivityLogs: mocks.logs,
  useActivityActions: mocks.actions,
}));

const log = (over: Partial<ActivityLog> = {}): ActivityLog => ({
  id: "1",
  entity_type: "Order",
  entity_id: "10227",
  action: "status_change",
  old_value: { status: "on the road", sold_at: null },
  new_value: { status: "sold", sold_at: "2026-10-16T09:32:00.000Z" },
  user_id: "7",
  user_name: null,
  user_role: null,
  service: "order",
  trace_id: "4f9c2a7e81d34b6a9e05c3d17a2b8f64",
  metadata: { source: "Kuryer ilovasi", ip: "10.24.6.118" },
  created_at: "2026-10-16T09:32:00.000Z",
  actor: { id: "7", name: "Jasur Tursunov", role: "courier" },
  action_meta: {
    action: "status_change",
    label: "Holat o'zgardi",
    category: "order",
    categoryLabel: "Buyurtma",
    icon: "swap",
    tone: "slate",
    known: true,
  },
  actor_status: "snapshot",
  entity: { name: "Sardor Qodirov" },
  references: null,
  ...over,
});

const CATALOG: ActivityActionsCatalog = {
  actions: ["finance.manual_expense", "order.sell", "login", "order.new_verb"],
  registry: [
    { action: "finance.manual_expense", label: "Qo'lda chiqim", category: "finance", categoryLabel: "Moliya", icon: "minus", tone: "rose", known: true },
    { action: "order.sell", label: "Sotildi", category: "order", categoryLabel: "Buyurtma", icon: "plus", tone: "green", known: true },
    { action: "login", label: "Tizimga kirdi", category: "auth", categoryLabel: "Kirish", icon: "login", tone: "slate", known: true },
  ],
  categories: [
    { key: "order", label: "Buyurtma" },
    { key: "finance", label: "Moliya" },
    { key: "auth", label: "Kirish" },
  ],
};

const listResult = (items: ActivityLog[]) => ({
  data: { items, page: 1, limit: 20, total: items.length, totalPages: 1 },
  isLoading: false,
  isFetching: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
});

const lastParams = (): ActivityLogParams => mocks.logs.mock.lastCall?.[0];

beforeEach(() => {
  mocks.logs.mockReset();
  mocks.actions.mockReset();
  mocks.actions.mockReturnValue({ data: CATALOG, isLoading: false });
});

describe("ActivityLogViewer — dizayn v2 (y8CxCtcK, `superadmin-activity-logs-list`)", () => {
  it("qator: vaqt, Kim (ism + rol), Amal badge'i (`action_meta`), Obyekt (№ + nom), Xizmat", () => {
    mocks.logs.mockReturnValue(listResult([log()]));
    renderWithProviders(<ActivityLogViewer />);

    const table = screen.getByRole("table", { name: "Faoliyat jurnali yozuvlari" });
    const [, row] = within(table).getAllByRole("row");
    expect(row).toHaveTextContent("Jasur Tursunov");
    expect(row).toHaveTextContent("Kuryer");
    expect(within(row).getByText("Holat o'zgardi").parentElement).toHaveClass("bg-sunken", "text-text-muted");
    expect(row).toHaveTextContent("Buyurtma №10227");
    expect(row).toHaveTextContent("Sardor Qodirov");
    expect(within(row).getByText("Buyurtmalar")).toBeInTheDocument();
    expect(row).toHaveTextContent(/\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}|Bugun|Kecha/);
  });

  it("Kim: ism topilmasa «#44 (topilmadi)», aktyorsiz — «Tizim» (telefon ko'rsatilmaydi)", () => {
    mocks.logs.mockReturnValue(
      listResult([
        log({ id: "2", actor: { id: "44", name: null, role: null, phone_number: "+998901234567" }, user_id: "44", actor_status: "unresolved" }),
        log({ id: "3", actor: null, user_id: null, actor_status: "system" }),
      ]),
    );
    renderWithProviders(<ActivityLogViewer />);
    expect(screen.getByText("#44 (topilmadi)")).toBeInTheDocument();
    expect(screen.getByText("Tizim")).toBeInTheDocument();
    expect(screen.queryByText(/998901234567/)).toBeNull();
  });

  it("⭐ TC8: «Amal» filtri `categories` tartibida guruhlangan, ichida `registry[].label`; tanlansa — `action` so'raladi", async () => {
    const user = userEvent.setup();
    mocks.logs.mockReturnValue(listResult([log()]));
    renderWithProviders(<ActivityLogViewer />);

    await user.click(screen.getByRole("combobox", { name: "Amal" }));
    const listbox = await screen.findByRole("listbox", { name: "Amal" });
    const groups = within(listbox).getAllByRole("group");
    expect(groups.map((group) => group.getAttribute("aria-labelledby") && within(group).getAllByRole("option")[0].textContent)).toEqual([
      "Sotildi",
      "Qo'lda chiqim",
      "Tizimga kirdi",
    ]);
    expect(within(listbox).getByRole("group", { name: "Buyurtma" })).toBeInTheDocument();
    expect(within(listbox).getByRole("group", { name: "Moliya" })).toHaveTextContent("Qo'lda chiqim");
    expect(within(listbox).getByRole("group", { name: "Kirish" })).toHaveTextContent("Tizimga kirdi");
    // Reyestrda yo'q yangi fe'l — oxirida, humanize.
    expect(within(listbox).getByRole("option", { name: "Order new verb" })).toBeInTheDocument();

    await user.click(within(listbox).getByRole("option", { name: "Qo'lda chiqim" }));
    await waitFor(() => expect(lastParams()).toMatchObject({ action: "finance.manual_expense", page: 1 }));
  });

  it("Obyekt turi o'zbekcha yozilsa backend turi yuboriladi; «Filtrlarni tozalash» hammasini tozalaydi", async () => {
    const user = userEvent.setup();
    mocks.logs.mockReturnValue(listResult([log()]));
    renderWithProviders(<ActivityLogViewer />);

    await user.type(screen.getByRole("textbox", { name: "Obyekt turi" }), "buyurtma");
    await waitFor(() => expect(lastParams()).toMatchObject({ entity_type: "Order" }));

    await user.click(screen.getByRole("button", { name: "Filtrlarni tozalash" }));
    await waitFor(() => expect(lastParams()).toEqual({ page: 1, limit: 20 }));
    expect(screen.getByRole("textbox", { name: "Obyekt turi" })).toHaveValue("");
  });

  it("qidiruv yozilayotganda (400 ms ichida) «Filtrlarni tozalash» — kechikkan qidiruv tozalashni qaytarmaydi", async () => {
    const user = userEvent.setup();
    mocks.logs.mockReturnValue(listResult([log()]));
    renderWithProviders(<ActivityLogViewer />);

    await user.type(screen.getByRole("textbox", { name: "Obyekt turi" }), "buyurtma");
    await waitFor(() => expect(lastParams()).toMatchObject({ entity_type: "Order" }));
    await user.type(screen.getByRole("searchbox", { name: "Jurnaldan qidirish" }), "Ali");
    await user.click(screen.getByRole("button", { name: "Filtrlarni tozalash" }));

    // Qidiruv taymeri (400 ms) o'tib ketsin — `search=Ali` qaytib kelmasligi kerak.
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(lastParams()).toEqual({ page: 1, limit: 20 });
    expect(screen.getByRole("searchbox", { name: "Jurnaldan qidirish" })).toHaveValue("");
  });

  it("qator ochiladi: maydon o'zgarishlari (eski qiymat chizilgan), qo'shimcha ma'lumot, Kuzatuv ID; qayta bosilsa yopiladi", async () => {
    const user = userEvent.setup();
    mocks.logs.mockReturnValue(listResult([log()]));
    renderWithProviders(<ActivityLogViewer />);

    const open = screen.getByRole("button", { name: "Buyurtma №10227 tafsilotini ochish" });
    expect(open).toHaveAttribute("aria-expanded", "false");
    await user.click(open);

    const changes = screen.getByRole("table", { name: "Maydon o'zgarishlari" });
    const statusRow = within(changes).getByText("Holat").closest("tr")!;
    expect(statusRow).toHaveTextContent("status");
    expect(within(statusRow).getByText("Yo'lda")).toHaveClass("line-through");
    expect(statusRow).toHaveTextContent("Sotilgan");
    const soldRow = within(changes).getByText("Sotilgan vaqti").closest("tr")!;
    expect(within(soldRow).getByText("—")).not.toHaveClass("line-through");

    expect(screen.getByText("Manba").nextElementSibling).toHaveTextContent("Kuryer ilovasi");
    expect(screen.getByText("IP manzil").nextElementSibling).toHaveTextContent("10.24.6.118");
    expect(screen.getByText("4f9c2a7e81d34b6a9e05c3d17a2b8f64")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kuzatuv ID ni nusxalash" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Buyurtma №10227 tafsilotini yopish" }));
    expect(screen.queryByRole("table", { name: "Maydon o'zgarishlari" })).toBeNull();
  });

  it("⭐ f2Ud5tju TC11: «Qo'shimcha ma'lumot» — Manba, Filial, Qurilma, IP manzil (maket tartibi); kontekstsiz yozuvda «—»", async () => {
    const user = userEvent.setup();
    const userAgent =
      "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.100 Mobile Safari/537.36";
    mocks.logs.mockReturnValue(
      listResult([
        log({
          metadata: {
            ip: "10.24.6.118",
            user_agent: userAgent,
            device_id: "3f1c9a2e-55b1-4b8e-9d0a-1f2e3d4c5b6a",
            device_name: "Android",
            branch_name: "Toshkent HQ",
            source: "Kuryer ilovasi",
          },
        }),
        log({ id: "2", entity_id: "10230", metadata: null, trace_id: null }),
      ]),
    );
    renderWithProviders(<ActivityLogViewer />);

    await user.click(screen.getByRole("button", { name: "Buyurtma №10227 tafsilotini ochish" }));
    const meta = screen.getByRole("region", { name: "Qo'shimcha ma'lumot" });
    const terms = within(meta).getAllByRole("term").map((term) => term.textContent);
    expect(terms).toEqual(["Manba", "Filial", "Qurilma", "IP manzil", "Kuzatuv ID"]);
    const device = within(meta).getByText("Qurilma").nextElementSibling!;
    expect(device).toHaveTextContent(/^Android$/);
    expect(device).toHaveAttribute("title", userAgent);
    expect(within(meta).getByText("IP manzil").nextElementSibling).toHaveTextContent("10.24.6.118");
    // Texnik kalitlar alohida qator emas (maketda yo'q).
    expect(within(meta).queryByText("3f1c9a2e-55b1-4b8e-9d0a-1f2e3d4c5b6a")).toBeNull();
    expect(within(meta).queryByText(userAgent)).toBeNull();

    // Kontekstsiz yozuv (cron/bot yoki 30 kundan eski): «—», sun'iy qiymat yo'q.
    await user.click(screen.getByRole("button", { name: "Buyurtma №10230 tafsilotini ochish" }));
    const plain = screen.getByRole("region", { name: "Qo'shimcha ma'lumot" });
    expect(within(plain).getAllByRole("term").map((term) => term.textContent)).toEqual(["Qurilma", "IP manzil"]);
    expect(within(plain).getByText("Qurilma").nextElementSibling).toHaveTextContent(/^—$/);
    expect(within(plain).getByText("IP manzil").nextElementSibling).toHaveTextContent(/^—$/);
  });

  it("tafsiloti yo'q qatorda tugma yo'q — «Tafsilot yo'q» (ekran o'quvchi uchun)", () => {
    mocks.logs.mockReturnValue(
      listResult([log({ id: "9", old_value: null, new_value: null, metadata: null, trace_id: null, entity_type: "User", entity_id: "61" })]),
    );
    renderWithProviders(<ActivityLogViewer />);
    expect(screen.queryByRole("button", { name: /tafsilotini ochish/ })).toBeNull();
    expect(screen.getByText("Tafsilot yo'q")).toHaveClass("sr-only");
    expect(screen.getByText("Foydalanuvchi")).toBeInTheDocument();
    expect(screen.getByText("#61")).toBeInTheDocument();
  });

  it("bo'sh: «Yozuvlar topilmadi»; filtr bilan — sabab va «Filtrlarni tozalash»", async () => {
    const user = userEvent.setup();
    mocks.logs.mockReturnValue(listResult([]));
    renderWithProviders(<ActivityLogViewer />);
    expect(screen.getByText("Yozuvlar topilmadi")).toBeInTheDocument();
    expect(screen.queryByText(/Filtrlarga mos yozuv yo'q/)).toBeNull();

    await user.type(screen.getByRole("textbox", { name: "Foydalanuvchi ID" }), "99");
    expect(await screen.findByText("Filtrlarga mos yozuv yo'q. Filtrlarni o'zgartirib ko'ring.")).toBeInTheDocument();
    expect(lastParams()).toMatchObject({ user_id: "99" });
  });

  it("yuklanishda jadval skeleti (qo'lda «Yuklanmoqda…» yo'q), sahifalash yo'q", () => {
    mocks.logs.mockReturnValue({ data: undefined, isLoading: true, isFetching: true, isError: false, error: null, refetch: vi.fn() });
    renderWithProviders(<ActivityLogViewer />);
    expect(screen.queryByRole("table", { name: "Faoliyat jurnali yozuvlari" })).toBeNull();
    expect(screen.queryByText(/Yuklanmoqda/)).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
    // Filtrlar yuklanishda ham ishlaydi.
    expect(screen.getByRole("searchbox", { name: "Jurnaldan qidirish" })).toBeEnabled();
  });

  it("xato: ErrorState + «Qayta urinish» so'rovni qaytaradi", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mocks.logs.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: true,
      error: { response: { status: 500 } },
      refetch,
    });
    renderWithProviders(<ActivityLogViewer />);
    await user.click(screen.getByRole("button", { name: /Qayta urinish/ }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Yozuvlar topilmadi")).toBeNull();
  });

  it("sahifalash: «1–20 / 45 ta yozuv», boshqa sahifa so'raladi va ochiq qator yopiladi", async () => {
    const user = userEvent.setup();
    mocks.logs.mockReturnValue({
      ...listResult([log()]),
      data: { items: [log()], page: 1, limit: 20, total: 45, totalPages: 3 },
    });
    renderWithProviders(<ActivityLogViewer />);
    expect(screen.getByText("1–20 / 45 ta yozuv")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Buyurtma №10227 tafsilotini ochish" }));
    expect(screen.getByRole("table", { name: "Maydon o'zgarishlari" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "2" }));
    await waitFor(() => expect(lastParams()).toMatchObject({ page: 2 }));
    expect(screen.queryByRole("table", { name: "Maydon o'zgarishlari" })).toBeNull();
  });

  it("reyestr kelmasa (eski backend) — fe'llar guruhsiz, humanize", async () => {
    const user = userEvent.setup();
    mocks.actions.mockReturnValue({ data: { actions: ["order.sell"], registry: [], categories: [] }, isLoading: false });
    mocks.logs.mockReturnValue(listResult([log({ action_meta: null, action: "order.sell" })]));
    renderWithProviders(<ActivityLogViewer />);

    expect(screen.getAllByText("Order sell")[0]).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Amal" }));
    const listbox = await screen.findByRole("listbox", { name: "Amal" });
    expect(within(listbox).queryAllByRole("group")).toHaveLength(0);
    expect(within(listbox).getByRole("option", { name: "Order sell" })).toBeInTheDocument();
  });
});
