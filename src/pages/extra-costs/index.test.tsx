import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RootState } from "../../app/config/store";
import { renderWithProviders } from "../../test/test-utils";
import ExtraCostsPage from "./index";

/**
 * GykuOz8f — «Qo'shimcha xarajatli buyurtmalar» (`/extra-costs`): `GET orders/extra-costs?tab&page&limit` ro'yxati,
 * tablar (sonlari `counts` dan), URL'dagi tab va sahifa, holat belgilari, isbot oynasi (so'rovning o'z yo'li —
 * `orders/extra-costs/:id/proofs/:index`), market tasdiqlash / rad etish (409 — «allaqachon hal qilingan»), operator
 * — faqat ko'rish, marketga biriktirilmagan operator — so'rov yo'q.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("../../shared/api/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../shared/api/api")>();
  return { ...original, api: { ...original.api, get: mocks.get, post: mocks.post } };
});

const LIST_URL = "orders/extra-costs";
const COUNTS = { all: 5, pending: 1, approved: 2, cancelled: 2 };

const PENDING = {
  id: "ap-1",
  order_id: "81",
  order_number: "EL-100081",
  market_id: "7",
  requested_by_user_id: "56",
  requested_by_role: "courier",
  requested_by: { id: "56", name: "Jasur Tursunov" },
  action: "sell",
  amount: 15000,
  status: "pending",
  proof_file_keys: ["proof-1761900000000-a.jpg", "proof-1761900000001-b.mp4"],
  proof_count: 2,
  auto_approve_at: "2026-11-06T10:00:00.000Z",
  createdAt: "2026-11-05T10:00:00.000Z",
  immediate: false,
  order_status: "waiting",
  customer: { name: "Ali Valiyev", phone: "+998901234567" },
  market: { id: "7", name: "Baraka Shop" },
};

const ROWS = [
  PENDING,
  {
    ...PENDING,
    id: "ap-2",
    order_id: "82",
    order_number: "EL-100082",
    action: "cancel",
    amount: 8000,
    status: "rejected",
    reject_reason: "TOO_EXPENSIVE",
    decision_comment: "Kelishilmagan narx",
    decided_at: "2026-11-05T12:00:00.000Z",
    auto_approve_at: null,
    proof_file_keys: [],
    proof_count: 0,
    customer: { name: null, phone: null },
  },
  {
    ...PENDING,
    id: "ap-3",
    order_id: "83",
    order_number: "EL-100083",
    status: "approved",
    auto_approved: true,
    decided_at: "2026-11-05T13:00:00.000Z",
    auto_approve_at: null,
  },
  {
    ...PENDING,
    id: "ap-4",
    order_id: "84",
    order_number: "EL-100084",
    status: "approved",
    immediate: true,
    auto_approve_at: null,
    requested_by_role: "manager",
    requested_by: null,
    requested_by_user_id: "77",
  },
  {
    ...PENDING,
    id: "ap-5",
    order_id: "85",
    order_number: "EL-100085",
    action: "partly_sell",
    status: "void",
    closed_reason: "Buyurtma qaytarildi",
    closed_at: "2026-11-05T14:00:00.000Z",
    auto_approve_at: null,
  },
];

type ListParams = { tab: string; page: number; limit: number };

const listPage = (items: unknown[], { total = items.length, page = 1, limit = 25, counts = COUNTS } = {}) => ({
  data: { statusCode: 200, message: "ok", data: { items, total, page, limit, counts } },
});

const listCalls = () =>
  mocks.get.mock.calls.filter(([url]) => url === LIST_URL).map(([, options]) => options.params as ListParams);

const mockList = (respond: (params: ListParams) => unknown = () => listPage(ROWS)) =>
  mocks.get.mockImplementation((url: string, options?: { params?: ListParams }) => {
    if (url === LIST_URL) return Promise.resolve(respond(options?.params as ListParams));
    if (url.startsWith("orders/extra-costs/")) {
      const type = url.endsWith("/1") ? "video/mp4" : "image/jpeg";
      return Promise.resolve({ data: new Blob(["x"], { type }) });
    }
    return Promise.resolve({ data: {} });
  });

const signedInAs = (role: string, user: Record<string, unknown> | null = null): Partial<RootState> => ({
  role: { id: "1", role, region: null, name: "Test" },
  ...(user
    ? {
        user: {
          user: { id: "1", role, ...user } as never,
          isAuthenticated: true,
          accessToken: "test.token",
          loading: false,
          isAppInitializing: false,
          error: null,
        },
      }
    : {}),
});

const renderPage = (role: string, { route = "/extra-costs", user = null as Record<string, unknown> | null } = {}) =>
  renderWithProviders(<ExtraCostsPage />, { route, preloadedState: signedInAs(role, user) });

const findTable = () => screen.findByRole("table", { name: "Qo'shimcha xarajatli buyurtmalar ro'yxati" });

const httpError = (status: number, message: string) =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data: { statusCode: status, message },
  } as AxiosResponse);

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

describe("«Qo'shimcha xarajatli buyurtmalar» sahifasi (GykuOz8f)", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.post.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it("⭐ kuryer: tablar sonlari bilan, holat belgilari, sabab, isbot tugmasi; «Kim yozgan» va qaror tugmalari yo'q", async () => {
    mockList();
    renderPage("courier");

    const table = await findTable();
    expect(listCalls()[0]).toEqual({ tab: "all", page: 1, limit: 25 });

    const tabs = screen.getByRole("tablist", { name: "Xarajat holati bo'yicha" });
    expect(within(tabs).getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Barchasi 5",
      "Kutilmoqda 1",
      "Tasdiqlangan 2",
      "Bekor qilingan 2",
    ]);
    expect(within(tabs).getByRole("tab", { name: /^Barchasi/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/jami 5 ta/)).toBeInTheDocument();
    expect(screen.getByText("Siz yozgan qo'shimcha xarajatlar va market qarorlari", { exact: false })).toBeInTheDocument();

    const headers = within(table).getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(headers).not.toContain("Kim yozgan");
    expect(headers).not.toContain("Amallar");

    const [pending, rejected, auto, immediate, closed] = within(table).getAllByRole("row").slice(1);
    expect(within(pending).getByRole("link", { name: "Buyurtma №EL-100081 ni ochish" })).toHaveAttribute(
      "href",
      "/orders/edit/81",
    );
    expect(pending).toHaveTextContent("Sotish");
    expect(pending).toHaveTextContent("Ali Valiyev");
    expect(pending).toHaveTextContent("+998 90 123 45 67");
    expect(pending).toHaveTextContent("Tasdiq kutilmoqda");
    expect(within(pending).getByTestId("extra-cost-auto-ap-1")).toHaveTextContent(/avtomatik tasdiqlanadi/);
    expect(within(pending).getByRole("button", { name: "Isbot (2) — №EL-100081" })).toBeInTheDocument();

    expect(rejected).toHaveTextContent("Rad etildi");
    expect(rejected).toHaveTextContent("Juda qimmat: Kelishilmagan narx");
    expect(rejected).toHaveTextContent("Mijoz ko'rsatilmagan");
    expect(rejected).toHaveTextContent("Yo'q");
    expect(auto).toHaveTextContent("Avtomatik tasdiqlandi");
    expect(immediate).toHaveTextContent("Tasdiqsiz yozildi");
    expect(closed).toHaveTextContent("Bekor bo'ldi");
    expect(closed).toHaveTextContent("Buyurtma qaytarildi");
    expect(closed).toHaveTextContent("Qisman sotish");

    expect(screen.queryByRole("button", { name: /^Tasdiqlash/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Rad etish/ })).not.toBeInTheDocument();
  });

  it("⭐ menejer: «Kim yozgan» — ism va rol, ism kelmasa `#id`", async () => {
    mockList();
    renderPage("manager");

    const table = await findTable();
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toContain("Kim yozgan");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Jasur Tursunov");
    expect(rows[0]).toHaveTextContent("Kuryer");
    expect(rows[3]).toHaveTextContent("#77");
    expect(rows[3]).toHaveTextContent("Menejer");
  });

  it("⭐ tab almashsa — `tab` so'rovga va URL'ga yoziladi, sahifa 1 ga qaytadi; market tomonida «Tasdiqlash kutilayotgan»", async () => {
    const user = userEvent.setup();
    mockList();
    renderPage("market", { route: "/extra-costs?page=3" });

    await findTable();
    expect(listCalls()[0]).toEqual({ tab: "all", page: 3, limit: 25 });
    await user.click(screen.getByRole("tab", { name: /^Tasdiqlash kutilayotgan/ }));

    await waitFor(() => expect(listCalls().at(-1)).toEqual({ tab: "pending", page: 1, limit: 25 }));
    expect(screen.getByRole("tab", { name: /^Tasdiqlash kutilayotgan/ })).toHaveAttribute("aria-selected", "true");
  });

  it("⭐ bildirishnoma havolasi `?tab=cancelled&page=2` — kerakli tab va sahifa ochiladi", async () => {
    mockList((params) => listPage(ROWS.slice(1, 2), { total: 30, page: params.page, limit: params.limit }));
    renderPage("courier", { route: "/extra-costs?tab=cancelled&page=2" });

    await findTable();
    expect(listCalls()[0]).toEqual({ tab: "cancelled", page: 2, limit: 25 });
    expect(screen.getByRole("tab", { name: /^Bekor qilingan/ })).toHaveAttribute("aria-selected", "true");
  });

  it("⭐ sahifalash: 2-sahifa va «50 ta» — `page` / `limit` so'rovga ketadi", async () => {
    const user = userEvent.setup();
    mockList((params) => listPage(ROWS, { total: 60, page: params.page, limit: params.limit }));
    renderPage("courier");

    await findTable();
    expect(screen.getByText("1–25 / 60 ta")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^2/ }));
    await waitFor(() => expect(listCalls().at(-1)).toEqual({ tab: "all", page: 2, limit: 25 }));
  });

  it("⭐ sahifa ro'yxat oxiridan tashqarida (2-sahifadagi yagona so'rov hal qilindi) — oxirgi sahifaga qaytadi", async () => {
    mockList((params) =>
      params.page > 1
        ? listPage([], { total: 25, page: params.page, limit: params.limit })
        : listPage(ROWS, { total: 25, page: params.page, limit: params.limit }),
    );
    renderPage("market", { route: "/extra-costs?tab=pending&page=2" });

    await waitFor(() => expect(listCalls().at(-1)).toEqual({ tab: "pending", page: 1, limit: 25 }));
    expect(listCalls()[0]).toEqual({ tab: "pending", page: 2, limit: 25 });
    await findTable();
  });

  it("⭐ isbot oynasi — fayllar so'rovning o'z yo'lidan (`orders/extra-costs/:id/proofs/:index`), rasm va video", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn((blob: Blob) => `blob:${blob.type}`);
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    mockList();
    renderPage("market_operator", { user: { market_id: "7" } });

    await findTable();
    await user.click(screen.getByRole("button", { name: "Isbot (2) — №EL-100081" }));

    const dialog = await screen.findByRole("dialog", { name: "Isbot — №EL-100081" });
    expect(dialog).toHaveTextContent("Sotish");
    await waitFor(() =>
      expect(within(dialog).getByTestId("proof-gallery").querySelectorAll("[data-proof-kind]")).toHaveLength(2),
    );
    const proofCalls = mocks.get.mock.calls.filter(([url]) => String(url).startsWith("orders/extra-costs/ap-1/"));
    expect(proofCalls.map(([url]) => url)).toEqual(["orders/extra-costs/ap-1/proofs/0", "orders/extra-costs/ap-1/proofs/1"]);
    expect(proofCalls[0][1]).toEqual(expect.objectContaining({ responseType: "blob" }));
    await waitFor(() => expect(within(dialog).getByRole("img")).toHaveAttribute("src", "blob:image/jpeg"));
    expect(within(dialog).getByTestId("proof-gallery").querySelector('[data-proof-kind="video"]')).not.toBeNull();
    vi.unstubAllGlobals();
  });

  it("⭐ market: «Tasdiqlash kutilayotgan» tabida tasdiqlash — tasdiq oynasi orqali, POST approve", async () => {
    const user = userEvent.setup();
    mockList(() => listPage([PENDING]));
    mocks.post.mockResolvedValue({ data: { statusCode: 200, data: {} } });
    renderPage("market", { route: "/extra-costs?tab=pending" });

    const table = await findTable();
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toContain("Amallar");
    await user.click(screen.getByRole("button", { name: /^Tasdiqlash — №EL-100081/ }));

    const dialog = await screen.findByRole("alertdialog", { name: "Qo'shimcha xarajatni tasdiqlang" });
    expect(mocks.post).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith("orders/extra-cost-approvals/ap-1/approve", { comment: undefined }),
    );
    expect(await screen.findByText("Qo'shimcha xarajat tasdiqlandi")).toBeInTheDocument();
  });

  it("⭐ market: «Barchasi» tabida qaror tugmalari yo'q (faqat kutilayotganlar tabida)", async () => {
    mockList();
    renderPage("market");

    const table = await findTable();
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).not.toContain("Amallar");
    expect(screen.queryByRole("button", { name: /^Tasdiqlash —/ })).not.toBeInTheDocument();
  });

  it("⭐ market: so'rov boshqa joyda hal qilingan (409) — «allaqachon hal qilingan» va ro'yxat yangilanadi", async () => {
    const user = userEvent.setup();
    mockList(() => listPage([PENDING]));
    mocks.post.mockRejectedValue(httpError(409, "Already decided"));
    renderPage("market", { route: "/extra-costs?tab=pending" });

    await findTable();
    const before = listCalls().length;
    await user.click(screen.getByRole("button", { name: /^Tasdiqlash — №EL-100081/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Qo'shimcha xarajatni tasdiqlang" });
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    expect(await screen.findByText("So'rov allaqachon hal qilingan")).toBeInTheDocument();
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(before));
  });

  it("⭐ market: rad etish — sabab oynasi, POST reject sabab va izoh bilan", async () => {
    const user = userEvent.setup();
    mockList(() => listPage([PENDING]));
    mocks.post.mockResolvedValue({ data: { statusCode: 200, data: {} } });
    renderPage("market", { route: "/extra-costs?tab=pending" });

    await findTable();
    await user.click(screen.getByRole("button", { name: /^Rad etish — №EL-100081/ }));
    const dialog = await screen.findByRole("dialog", { name: "So'rovni rad etish" });
    await user.click(within(dialog).getByRole("combobox", { name: /Rad etish sababi/ }));
    await user.click(await screen.findByRole("option", { name: "Juda qimmat" }));
    await user.click(within(dialog).getByRole("button", { name: "Rad etish" }));

    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith("orders/extra-cost-approvals/ap-1/reject", { reason: "TOO_EXPENSIVE" }),
    );
    expect(await screen.findByText("So'rov rad etildi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "So'rovni rad etish" })).not.toBeInTheDocument());
  });

  it("⭐ market operatori: faqat ko'rish — tasdiqlash / rad etish yo'q, izoh bor", async () => {
    mockList(() => listPage([PENDING]));
    renderPage("market_operator", { route: "/extra-costs?tab=pending", user: { market_id: "7" } });

    await findTable();
    expect(screen.getByRole("tab", { name: /^Tasdiqlash kutilayotgan/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Faqat ko'rish: qarorni market egasi qiladi")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Tasdiqlash/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Rad etish/ })).not.toBeInTheDocument();
  });

  it("⭐ marketga biriktirilmagan operator — so'rov yuborilmaydi, tushuntirish chiqadi", async () => {
    mockList();
    renderPage("market_operator", { user: { market_id: null } });

    expect(await screen.findByText("Siz hali marketga biriktirilmagansiz")).toBeInTheDocument();
    expect(listCalls()).toHaveLength(0);
  });

  it("bo'sh ro'yxat — tabga mos matn (market: «Tasdiq kutayotgan xarajat yo'q»)", async () => {
    mockList(() => listPage([], { counts: { all: 0, pending: 0, approved: 0, cancelled: 0 } }));
    renderPage("market", { route: "/extra-costs?tab=pending" });

    expect(await screen.findByText("Tasdiq kutayotgan xarajat yo'q")).toBeInTheDocument();
  });

  it("xato — «Qo'shimcha xarajatlarni yuklab bo'lmadi» va «Qayta urinish»", async () => {
    mocks.get.mockRejectedValue(httpError(500, "boom"));
    renderPage("courier");

    expect(await screen.findByText("Qo'shimcha xarajatlarni yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Qayta urinish/ })).toBeInTheDocument();
  });

  it("⭐ telefon: jadval o'rniga kartalar — holat, summa, havola, isbot va qaror tugmalari", async () => {
    mockPhone(true);
    mockList(() => listPage([PENDING]));
    renderPage("market", { route: "/extra-costs?tab=pending" });

    const cards = await screen.findByRole("list", { name: "Qo'shimcha xarajatli buyurtmalar" });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const [card] = within(cards).getAllByRole("listitem");
    expect(card).toHaveTextContent("Tasdiq kutilmoqda");
    expect(card).toHaveTextContent("Jasur Tursunov");
    expect(within(card).getByRole("link", { name: "Buyurtma №EL-100081 ni ochish" })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Isbot (2) — №EL-100081" })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: /^Tasdiqlash — №EL-100081/ })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: /^Rad etish — №EL-100081/ })).toBeInTheDocument();
  });
});
