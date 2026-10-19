import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import BatchDetailPage from "./BatchDetailPage";

/**
 * Paket tafsiloti — `/batches/:id` (dizayn v2, maketlar `manager-batches-detail-send`, `*-batches-detail`,
 * `manager-batches-detail-readonly`, `manager-returns-batch-detail`): jo'natish rejimi faqat menejer/registrator va
 * holat `new` bo'lsa; `PATCH transfer-batches/:id/send { orderIds }`; skaner tanlovi; orqaga havola `state.from`.
 * Fixture — branch-service `findTransferBatchById` shakli (paket yozuvi + `items[].order` enriched buyurtma).
 */

type ScannerOptions = {
  orders: { id: string; qr_code_token?: string | null }[];
  enabled?: boolean;
  onMatch: (row: { id: string }, raw: string) => void;
  onMissing: (raw: string) => void;
};

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  scanner: null as ScannerOptions | null,
  playScanFeedback: vi.fn(),
  playMissingOrderFeedback: vi.fn(),
}));

vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: vi.fn(), patch: mocks.patch, put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

vi.mock("../../../shared/lib/useOrderQrScanner", () => ({
  useOrderQrScanner: (options: ScannerOptions) => {
    mocks.scanner = options;
  },
}));

vi.mock("../../../shared/lib/scanner/feedback", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../shared/lib/scanner/feedback")>()),
  playScanFeedback: mocks.playScanFeedback,
  playMissingOrderFeedback: mocks.playMissingOrderFeedback,
}));

const local = (day: number, h: number, m: number) => new Date(2026, 9, day, h, m).toISOString();

const order = (id: string, name: string, whereDeliver: string, price: number, status = "received") => ({
  id: `i${id}`,
  batch_id: "172",
  order_id: id,
  snapshot_price: price,
  order: {
    id,
    status,
    where_deliver: whereDeliver,
    total_price: price,
    createdAt: local(8, 9, 0),
    address: `${name} manzili`,
    qr_code_token: `qr-${id}`,
    customer: { id: `c${id}`, name, phone_number: "+998912451780" },
    district: { id: `d${id}`, name: "Urgut tumani" },
    market: { id: "m1", name: "Baraka Shop" },
  },
});

const detail = (extra: Record<string, unknown> = {}) => ({
  id: "172",
  qr_code_token: "BTB-172",
  source_branch: { id: "7", name: "Urgut filiali", code: "SMQ-URG" },
  destination_branch_id: "1",
  direction: "FORWARD",
  status: "PENDING",
  order_count: 3,
  total_price: 864000,
  createdAt: local(8, 9, 20),
  region: { id: "14", name: "Samarqand viloyati" },
  items: [
    order("10166", "Hulkar Abdullayeva", "address", 265000),
    order("10165", "Akmal Yo'ldoshev", "address", 410000),
    order("10163", "Feruza Qosimova", "center", 189000),
  ],
  history: [],
  ...extra,
});

const respond = (body: Record<string, unknown> = detail()) => {
  mocks.get.mockImplementation((url: string) => {
    if (url === "transfer-batches/172" || url === "transfer-batches/172/remaining") return Promise.resolve({ data: body });
    if (url === "branches/1") return Promise.resolve({ data: { statusCode: 200, data: { id: "1", name: "Toshkent HQ" } } });
    return Promise.reject(new Error(`kutilmagan so'rov: ${url}`));
  });
};

const stateFor = (role: string) =>
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

const renderPage = (role = "manager", state?: unknown) =>
  renderWithProviders(
    <Routes>
      <Route path="/batches/:id" element={<BatchDetailPage />} />
    </Routes>,
    { route: { pathname: "/batches/172", state }, preloadedState: stateFor(role) },
  );

const ordersCard = () => screen.getByRole("region", { name: "Paketdagi buyurtmalar" });
const scanned = (id: string) => mocks.scanner!.orders.find((row) => row.id === id)!;

beforeEach(() => {
  mocks.scanner = null;
});

afterEach(() => {
  mocks.get.mockReset();
  mocks.patch.mockReset();
  mocks.playScanFeedback.mockReset();
  mocks.playMissingOrderFeedback.mockReset();
});

describe("BatchDetailPage — /batches/:id", () => {
  it("menejer, yangi paket: sarlavha, ma'lumotlar, QR, jo'natish rejimi, skaner yoqilgan", async () => {
    respond();
    renderPage("manager");

    expect(await screen.findByRole("heading", { level: 1, name: "Paket B-172" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Paketlar" })).toHaveAttribute("href", "/batches?tab=new");
    expect(within(screen.getByRole("banner")).getByText("Yangi")).toBeInTheDocument();
    expect(await screen.findByText(/Yaratilgan:/)).toBeInTheDocument();

    const info = screen.getByRole("region", { name: "Paket ma'lumotlari" });
    expect(within(info).getByText("Urgut filiali")).toBeInTheDocument();
    expect(within(info).getByText("SMQ-URG")).toBeInTheDocument();
    // `GET branches/:id` — faqat superadmin/admin (backend `@Roles`): menejer so'rov yubormaydi, nom noma'lum — «—».
    expect(mocks.get).not.toHaveBeenCalledWith("branches/1", expect.anything());
    expect(mocks.get.mock.calls.some(([url]) => String(url).startsWith("branches/"))).toBe(false);
    expect(within(info).getByText("Qayerga").nextSibling).toHaveTextContent("—");
    expect(within(info).getByText("Samarqand viloyati")).toBeInTheDocument();
    expect(within(info).getByText("Oldinga")).toBeInTheDocument();
    expect(within(info).getByText("864 000 so'm")).toBeInTheDocument();
    // Yetkazish (D13): 2 ta uygacha (675 000), 1 ta markazgacha (189 000).
    expect(within(info).getByText("675 000 so'm")).toBeInTheDocument();
    expect(within(info).getByText("189 000 so'm")).toBeInTheDocument();

    expect(screen.getByRole("region", { name: "QR kod" })).toHaveTextContent("B-172");
    expect(
      within(screen.getByRole("region", { name: "QR kod" })).getByRole("img", { name: "B-172 paketining QR kodi" }),
    ).toBeInTheDocument();

    expect(within(ordersCard()).getByText("QR kodni skanerlang — buyurtma ro'yxatda tanlanadi")).toBeInTheDocument();
    expect(within(ordersCard()).getByRole("checkbox", { name: "№10166 ni tanlash" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "HQ'ga yuborish — 0 ta" })[0]).toBeDisabled();
    expect(mocks.scanner?.enabled).toBe(true);
    expect(screen.getByRole("region", { name: "Tarix" })).toHaveTextContent("Tarix hozircha mavjud emas");
  });

  it("tanlangan buyurtmalar HQ'ga yuboriladi: PATCH { orderIds }, yuborilganlar yashiriladi", async () => {
    respond();
    mocks.patch.mockResolvedValue({ data: { statusCode: 200 } });
    const user = userEvent.setup();
    renderPage("manager");

    await screen.findByRole("heading", { level: 1, name: "Paket B-172" });
    await user.click(within(ordersCard()).getByRole("checkbox", { name: "№10166 ni tanlash" }));
    await user.click(within(ordersCard()).getByRole("checkbox", { name: "№10163 ni tanlash" }));
    expect(within(ordersCard()).getByText("2 ta buyurtma tanlandi")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "HQ'ga yuborish — 2 ta" })[0]);

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith("transfer-batches/172/send", { orderIds: ["10166", "10163"] }),
    );
    expect(await screen.findByText("Paket HQ'ga yuborildi")).toBeInTheDocument();
    // Menejer qabul qiluvchi filial nomini ololmaydi (`GET branches/:id` — 403) — nomsiz matn.
    expect(screen.getByText("2 ta buyurtma HQ'ga yuborildi")).toBeInTheDocument();
    await waitFor(() =>
      expect(within(ordersCard()).queryByRole("checkbox", { name: "№10166 ni tanlash" })).not.toBeInTheDocument(),
    );
    expect(within(ordersCard()).getByRole("checkbox", { name: "№10165 ni tanlash" })).toBeInTheDocument();
  });

  it("yuborish xatosi — backend xabari, tanlov saqlanadi", async () => {
    respond();
    mocks.patch.mockRejectedValue({ response: { status: 409, data: { message: "Paket allaqachon yuborilgan" } } });
    const user = userEvent.setup();
    renderPage("registrator");

    await screen.findByRole("heading", { level: 1, name: "Paket B-172" });
    await user.click(within(ordersCard()).getByRole("checkbox", { name: "№10165 ni tanlash" }));
    await user.click(screen.getAllByRole("button", { name: "HQ'ga yuborish — 1 ta" })[0]);

    expect(await screen.findByText("Paketni yuborishda xatolik bo'ldi")).toBeInTheDocument();
    expect(screen.getByText("Paket allaqachon yuborilgan")).toBeInTheDocument();
    expect(within(ordersCard()).getByRole("checkbox", { name: "№10165 ni tanlash" })).toBeChecked();
  });

  it("USB skaner: tanlaydi, takrorni va topilmaganni aytadi", async () => {
    respond();
    renderPage("manager");
    await screen.findByRole("heading", { level: 1, name: "Paket B-172" });

    act(() => mocks.scanner!.onMatch(scanned("10165"), "qr-10165"));
    expect(await screen.findByText("Buyurtma tanlandi")).toBeInTheDocument();
    expect(within(ordersCard()).getByRole("checkbox", { name: "№10165 ni tanlash" })).toBeChecked();
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("success");

    act(() => mocks.scanner!.onMatch(scanned("10165"), "qr-10165"));
    expect(await screen.findByText("Allaqachon tanlangan")).toBeInTheDocument();

    act(() => mocks.scanner!.onMissing("qr-boshqa"));
    expect(await screen.findByText("QR topilmadi")).toBeInTheDocument();
    expect(screen.getByText("Bu QR kod ushbu paketdagi buyurtmalarga mos kelmadi.")).toBeInTheDocument();
    expect(mocks.playMissingOrderFeedback).toHaveBeenCalled();
  });

  it("superadmin — doim faqat o'qish: tanlov, skaner va yuborish yo'q; market ustuni", async () => {
    respond(detail({ status: "RECEIVED" }));
    renderPage("superadmin", { from: "batches", fromSearch: "?tab=old&page=2" });

    expect(await screen.findByRole("heading", { level: 1, name: "Paket B-172" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Paketlar" })).toHaveAttribute("href", "/batches?tab=old&page=2");
    expect(within(screen.getByRole("banner")).getByText("Qabul qilingan")).toHaveClass("bg-success-soft");
    // Superadmin: tafsilotda faqat `destination_branch_id` — nom `GET branches/:id` dan.
    const info = screen.getByRole("region", { name: "Paket ma'lumotlari" });
    expect(await within(info).findByText("Toshkent HQ")).toBeInTheDocument();
    expect(within(ordersCard()).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /HQ'ga yuborish/ })).not.toBeInTheDocument();
    expect(mocks.scanner?.enabled).toBe(false);
    // Faqat o'qish maketida sarlavhada amal yo'q — «Chop etish» faqat QR kartasida.
    expect(within(screen.getByRole("banner")).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Chop etish" })).toHaveLength(1);
    expect(within(ordersCard()).getByRole("columnheader", { name: "Market" })).toBeInTheDocument();
    expect(within(ordersCard()).getAllByText("Baraka Shop").length).toBeGreaterThan(0);
  });

  it("menejer, yo'lga chiqqan paket — faqat o'qish", async () => {
    respond(detail({ status: "SENT" }));
    renderPage("manager");

    await screen.findByRole("heading", { level: 1, name: "Paket B-172" });
    expect(within(screen.getByRole("banner")).getByText("Yo'lda")).toBeInTheDocument();
    expect(within(ordersCard()).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /HQ'ga yuborish/ })).not.toBeInTheDocument();
  });

  it("qaytarish paketi qaytarishlardan: «← Qaytarishlar», yo'nalish «Qaytarish», tarix", async () => {
    respond(
      detail({
        direction: "RETURN",
        history: [{ id: "h1", action: "CREATED", actor: { name: "Ravshan Ortiqov" }, created_at: local(8, 9, 20) }],
      }),
    );
    const user = userEvent.setup();
    renderPage("manager", { from: "returns" });

    expect(await screen.findByRole("heading", { level: 1, name: "Paket B-172" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Qaytarishlar" })).toHaveAttribute("href", "/returns");
    expect(screen.getByRole("region", { name: "Paket ma'lumotlari" })).toHaveTextContent("Qaytarish");
    expect(within(ordersCard()).getByText("Skanerlang yoki belgilang")).toBeInTheDocument();
    // Qaytarish paketi: asosiy tugma faqat sarlavhada (telefonda ham), karta ostida takrorlanmaydi.
    expect(screen.getAllByRole("button", { name: "HQ'ga yuborish — 0 ta" })).toHaveLength(1);
    expect(within(screen.getByRole("banner")).getByRole("button", { name: "HQ'ga yuborish — 0 ta" })).toBeInTheDocument();
    await user.click(within(ordersCard()).getByRole("checkbox", { name: "№10166 ni tanlash" }));
    expect(within(ordersCard()).getByText("Faqat tanlanganlar HQ'ga yuboriladi, qolganlari paketda qoladi")).toBeInTheDocument();
    const history = screen.getByRole("region", { name: "Tarix" });
    expect(within(history).getByText("Qaytarish paketi yaratildi")).toBeInTheDocument();
    expect(within(history).getByText("Ravshan Ortiqov")).toBeInTheDocument();
  });

  it("paket topilmadi (404) — bo'sh holat va orqaga havola", async () => {
    mocks.get.mockRejectedValue({ response: { status: 404, data: { message: "Not found" } } });
    renderPage("admin", { from: "mails-old", fromSearch: "?batch_mode=all" });

    expect(await screen.findByText("Paket topilmadi")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Eski pochtalar" })).toHaveAttribute("href", "/mails/old?batch_mode=all");
  });

  it("server xatosi — «Qayta urinish»", async () => {
    mocks.get.mockRejectedValue({ response: { status: 500 } });
    renderPage("admin");
    expect(await screen.findByRole("button", { name: "Qayta urinish" })).toBeInTheDocument();
  });
});
