import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import BranchBatchDetailPage from "./batchDetail";

/**
 * Filial paketi tafsiloti — `/new-orders/branches/:branchId/batches/:batchId` (dizayn v2, maket
 * `superadmin-neworders-branch-batch-detail`). Fixture backend shaklida (branch-service `findTransferBatchById`:
 * paket yozuvi + `items[].order` — enriched buyurtma + `region`) — normalizator (G2/G3) ham tekshiriladi.
 */

type ScannerOptions = {
  orders: { id: string; qr_code_token?: string | null }[];
  enabled?: boolean;
  onMatch: (row: { id: string }, raw: string) => void;
  onMissing: (raw: string) => void;
};

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  scanner: null as ScannerOptions | null,
  playScanFeedback: vi.fn(),
  playMissingOrderFeedback: vi.fn(),
}));

vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: mocks.post, patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

vi.mock("../../../shared/lib/useOrderQrScanner", () => ({
  useOrderQrScanner: (options: ScannerOptions) => {
    mocks.scanner = options;
  },
}));

vi.mock("../../scan/lib/scanShared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../scan/lib/scanShared")>()),
  playScanFeedback: mocks.playScanFeedback,
  playMissingOrderFeedback: mocks.playMissingOrderFeedback,
}));

/** Mahalliy vaqt (test qaysi vaqt mintaqasida yurmasin — «04.10.2026, 11:20» o'zgarmaydi). */
const local = (day: number, h: number, m: number) => new Date(2026, 9, day, h, m).toISOString();

const item = (
  id: string,
  order: Record<string, unknown> | null,
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  id: `i${id}`,
  batch_id: "140",
  order_id: id,
  snapshot_price: Number(order?.total_price ?? 0),
  snapshot_market_id: "121",
  sent_at: null,
  createdAt: local(4, 15, 50),
  order,
  ...extra,
});

const enrichedOrder = (
  id: string,
  name: string,
  phone: string,
  district: string,
  createdAt: string,
  price: number,
  whereDeliver: string,
) => ({
  id,
  status: "on the road",
  where_deliver: whereDeliver,
  total_price: price,
  createdAt,
  qr_code_token: `qr-${id}-token`,
  customer: { id: `c${id}`, name, phone_number: phone, district: { name: district }, region: { name: "Jizzax" } },
  district: { id: `d${id}`, name: district },
  region: { id: "16", name: "Jizzax" },
});

/** `GET transfer-batches/140` — gateway paket yozuvini o'ramsiz qaytaradi. */
const DETAIL = {
  id: "140",
  qr_code_token: "BTB-TOKEN140AA",
  source_branch_id: "7",
  destination_branch_id: "1",
  direction: "FORWARD",
  target_region_id: "16",
  status: "SENT",
  order_count: 3,
  total_price: 412000,
  createdAt: local(4, 15, 50),
  region: { id: "16", name: "Jizzax viloyati" },
  items: [
    item("10173", enrichedOrder("10173", "Otabek Normatov", "+998913624715", "Jizzax sh.", local(4, 11, 20), 185000, "address")),
    item("10172", enrichedOrder("10172", "Dilfuza Qurbonova", "+998934182590", "Zomin tumani", local(4, 9, 35), 132000, "center")),
    // Minimal buyurtma (mijoz, tuman, sana yo'q; elementda ham sana yo'q) — sana paketniki, qolgani «—».
    item("10171", { id: "10171", status: "on the road", total_price: 95000 }, { createdAt: undefined }),
  ],
};

const respond = ({ detail = DETAIL as unknown, branches = true } = {}) => {
  mocks.get.mockImplementation((url: string) => {
    if (url === "transfer-batches/140" || url === "transfer-batches/140/remaining") {
      return detail instanceof Error ? Promise.reject(detail) : Promise.resolve({ data: detail });
    }
    if (branches && url === "branches/7") {
      return Promise.resolve({ data: { statusCode: 200, data: { id: "7", name: "Chilonzor qabul punkti" } } });
    }
    if (branches && url === "branches/1") {
      return Promise.resolve({ data: { statusCode: 200, data: { id: "1", name: "Toshkent HQ" } } });
    }
    return Promise.reject(new Error(`kutilmagan so'rov: ${url}`));
  });
};

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
    <Routes>
      <Route path="/new-orders/branches/:branchId/batches/:batchId" element={<BranchBatchDetailPage />} />
    </Routes>,
    { route: "/new-orders/branches/7/batches/140", preloadedState: stateFor(role) },
  );

const table = () => screen.getByRole("table", { name: "Buyurtmalar" });
const bodyRows = () => within(table()).getAllByRole("row").slice(1);
const rowOf = (id: string) => bodyRows().find((row) => row.textContent?.includes(`№${id}`)) as HTMLElement;
const selectionTitle = () =>
  within(screen.getByRole("region", { name: "Tanlanganlar" })).getByText(/tanlandi|tanlanmagan/);
const receiveButton = () => screen.getByRole("button", { name: /^Qabul qilish —/ });
const scanned = (id: string) => mocks.scanner!.orders.find((row) => row.id === id)!;

beforeEach(() => {
  mocks.get.mockReset();
  mocks.post.mockReset();
  mocks.playScanFeedback.mockReset();
  mocks.playMissingOrderFeedback.mockReset();
  mocks.scanner = null;
  respond();
});

describe("Paket tafsiloti — sarlavha va yo'nalish", () => {
  it("«← {filial}», «Paket B-140» + holat (haqiqiy, «Yo'lda»), «{viloyat} buyurtmalari · 3 ta · summa»", async () => {
    renderPage("superadmin");

    expect(screen.getByRole("heading", { level: 1, name: "Paket B-140" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Chilonzor qabul punkti" })).toHaveAttribute(
      "href",
      "/new-orders/branches/7",
    );
    await waitFor(() =>
      expect(screen.getByText(/buyurtmalari ·/)).toHaveTextContent("Jizzax viloyati buyurtmalari · 3 ta · 412 000 so'm"),
    );
    expect(screen.getByRole("banner")).toHaveTextContent("Yo'lda");
    expect(receiveButton()).toBeDisabled();
    expect(receiveButton()).toHaveTextContent("Qabul qilish — 0 ta buyurtma");
  });

  it("yo'nalish: manba filial → manzil filial (`GET branches/:id`), skaner maslahati, «USB skaner tayyor»", async () => {
    renderPage();

    const card = screen.getByRole("region", { name: "Paketdagi buyurtmalar" });
    await waitFor(() => expect(within(card).getByText("Yo'nalish").parentElement).toHaveTextContent(
      "Yo'nalishChilonzor qabul punktiToshkent HQ",
    ));
    expect(within(card).getByText("QR kodni skanerlang — buyurtma ro'yxatda tanlanadi")).toBeInTheDocument();
    await waitFor(() => expect(within(card).getByRole("status")).toHaveTextContent("USB skaner tayyor"));
    // Kamera rejimi (D4) — bu ishda yo'q.
    expect(screen.queryByRole("button", { name: /Kamera/ })).not.toBeInTheDocument();
    expect(mocks.get.mock.calls.map(([url]) => url)).toContain("branches/1");
  });

  it("filial nomlari kelmasa — «Filial #7», manzil chizilmaydi", async () => {
    respond({ branches: false });
    renderPage();

    const card = screen.getByRole("region", { name: "Paketdagi buyurtmalar" });
    await waitFor(() => expect(within(card).getByText("Yo'nalish").parentElement).toHaveTextContent("Yo'nalishFilial #7"));
    expect(screen.getByRole("link", { name: "Filial #7" })).toHaveAttribute("href", "/new-orders/branches/7");
  });
});

describe("Paket tafsiloti — jadval (G2: sana, tuman, viloyat)", () => {
  it("ustunlar: buyurtma havolasi + sana, mijoz, tuman/viloyat, holat, yetkazish, summa", async () => {
    renderPage();
    await waitFor(() => expect(bodyRows()).toHaveLength(3));

    const row = rowOf("10173");
    expect(within(row).getByRole("link", { name: "№10173" })).toHaveAttribute("href", "/orders/edit/10173");
    expect(row).toHaveTextContent("04.10.2026, 11:20");
    expect(row).toHaveTextContent("Otabek Normatov");
    expect(row).toHaveTextContent("+998 91 362 47 15");
    expect(row).toHaveTextContent("Jizzax sh.");
    expect(row).toHaveTextContent("Jizzax");
    expect(row).toHaveTextContent("Yo'lda");
    expect(row).toHaveTextContent("Uygacha");
    expect(row).toHaveTextContent("185 000 so'm");
    expect(rowOf("10172")).toHaveTextContent("Markazgacha");
  });

  it("maydonlari yo'q buyurtma — sana paketniki, qolgani «—»", async () => {
    renderPage();
    await waitFor(() => expect(bodyRows()).toHaveLength(3));

    const row = rowOf("10171");
    const cells = within(row).getAllByRole("cell");
    // [belgi, buyurtma, mijoz, joy, holat, yetkazish, summa]
    expect(cells[1]).toHaveTextContent("№1017104.10.2026, 15:50");
    expect(cells[2]).toHaveTextContent("——");
    expect(cells[3]).toHaveTextContent("—");
    expect(cells[6]).toHaveTextContent("95 000 so'm");
  });

  it("qatorni bosish — tanlov (v1 kartasidagidek); «Barchasini tanlash» — barcha buyurtmalar", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(bodyRows()).toHaveLength(3));
    expect(selectionTitle()).toHaveTextContent("Buyurtma tanlanmagan");

    await user.click(within(rowOf("10173")).getByText("Otabek Normatov"));
    expect(selectionTitle()).toHaveTextContent("1 ta buyurtma tanlandi · 185 000 so'm");
    expect(receiveButton()).toHaveTextContent("Qabul qilish — 1 ta buyurtma");

    await user.click(screen.getByRole("button", { name: "Barchasini tanlash" }));
    expect(selectionTitle()).toHaveTextContent("3 ta buyurtma tanlandi · 412 000 so'm");
    await user.click(screen.getByRole("button", { name: "Barchasini bekor qilish" }));
    expect(selectionTitle()).toHaveTextContent("Buyurtma tanlanmagan");
  });
});

describe("Paket tafsiloti — USB skaner", () => {
  it("skan — buyurtma tanlanadi; takror — «Allaqachon topilgan» «#id»; topilmadi — ogohlantirish", async () => {
    renderPage();
    await waitFor(() => expect(bodyRows()).toHaveLength(3));

    expect(mocks.scanner?.enabled).toBe(true);
    expect(scanned("10172").qr_code_token).toBe("qr-10172-token");

    act(() => mocks.scanner!.onMatch(scanned("10172"), "qr-10172-token"));
    expect(screen.getByRole("checkbox", { name: "№10172 ni tanlash" })).toBeChecked();
    expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("success");

    act(() => mocks.scanner!.onMatch(scanned("10172"), "qr-10172-token"));
    expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("duplicate", "Allaqachon topilgan");
    expect(await screen.findByText("#10172")).toBeInTheDocument();

    act(() => mocks.scanner!.onMissing("qr-boshqa-paket"));
    expect(mocks.playMissingOrderFeedback).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("QR topilmadi")).toBeInTheDocument();
    expect(screen.getByText("Bu QR kod shu paketdagi buyurtmalarga mos kelmadi.")).toBeInTheDocument();
    expect(mocks.post).not.toHaveBeenCalled();
  });
});

describe("Paket tafsiloti — qabul", () => {
  it("POST transfer-batches/140/receive-orders { orderIds } — qabul qilinganlar yashiriladi, xabar", async () => {
    const user = userEvent.setup();
    mocks.post.mockResolvedValue({ data: {} });
    renderPage();
    await waitFor(() => expect(bodyRows()).toHaveLength(3));

    await user.click(screen.getByRole("checkbox", { name: "№10173 ni tanlash" }));
    await user.click(screen.getByRole("checkbox", { name: "№10171 ni tanlash" }));
    await user.click(receiveButton());

    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    expect(mocks.post).toHaveBeenCalledWith("transfer-batches/140/receive-orders", { orderIds: ["10173", "10171"] });
    expect(await screen.findByText("Buyurtmalar qabul qilindi")).toBeInTheDocument();
    expect(screen.getByText("2 ta buyurtma qabul qilindi.")).toBeInTheDocument();
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(rowOf("10172")).toBeDefined();
  });

  it("buyurtma boyitilmagan band (`order: null`) — qabulga band id'si emas, `order_id` ketadi", async () => {
    const user = userEvent.setup();
    mocks.post.mockResolvedValue({ data: {} });
    respond({ detail: { ...DETAIL, items: [...DETAIL.items, item("10199", null)] } });
    renderPage();
    await waitFor(() => expect(bodyRows()).toHaveLength(4));

    await user.click(screen.getByRole("checkbox", { name: "№10199 ni tanlash" }));
    await user.click(receiveButton());

    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    expect(mocks.post).toHaveBeenCalledWith("transfer-batches/140/receive-orders", { orderIds: ["10199"] });
  });

  it("xato — backend xabari bilan «Qabul qilishda xatolik», ro'yxat o'zgarmaydi", async () => {
    const user = userEvent.setup();
    mocks.post.mockRejectedValue({ response: { data: { message: "Buyurtma allaqachon qabul qilingan" } } });
    renderPage();
    await waitFor(() => expect(bodyRows()).toHaveLength(3));

    await user.click(screen.getByRole("checkbox", { name: "№10173 ni tanlash" }));
    await user.click(receiveButton());

    expect(await screen.findByText("Qabul qilishda xatolik")).toBeInTheDocument();
    expect(screen.getByText("Buyurtma allaqachon qabul qilingan")).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(3);
  });
});

describe("Paket tafsiloti — holatlar", () => {
  it("ikkala so'rov xato — ErrorState + «Qayta urinish»", async () => {
    const user = userEvent.setup();
    respond({ detail: new Error("Network Error") });
    renderPage();

    const retry = await screen.findByRole("button", { name: "Qayta urinish" });
    respond();
    await user.click(retry);
    await waitFor(() => expect(bodyRows()).toHaveLength(3));
  });

  it("buyurtmasiz paket — «Qabul kutayotgan buyurtma yo'q», tanlov paneli yo'q", async () => {
    respond({ detail: { ...DETAIL, items: [] } });
    renderPage();
    expect(await screen.findByText("Qabul kutayotgan buyurtma yo'q")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Tanlanganlar" })).not.toBeInTheDocument();
  });
});

describe("Paket tafsiloti — telefon (< 768): kartalar", () => {
  const original = window.matchMedia;
  beforeEach(() => {
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

  it("karta: belgi + havola (mijoz, summa, «№ · tuman · telefon», holat + yetkazish)", async () => {
    renderPage();

    const list = await screen.findByRole("list", { name: "Buyurtmalar" });
    const [first] = within(list).getAllByRole("listitem");
    expect(within(first).getByRole("checkbox", { name: "№10173 ni tanlash" })).toBeInTheDocument();
    const link = within(first).getByRole("link");
    expect(link).toHaveAttribute("href", "/orders/edit/10173");
    expect(link).toHaveTextContent("Otabek Normatov185 000 so'm№10173 · Jizzax sh. · +998 91 362 47 15Yo'ldaUygacha");
  });
});
