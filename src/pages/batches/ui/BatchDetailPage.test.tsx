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
  paused?: boolean;
  onMatch: (row: { id: string }, raw: string) => void;
  onMissing: (raw: string) => void;
  /** Kamera maqsadi (markaziy «Skaner» tugmasi) — `useOrderQrScanner` uni USB bilan bir yo'ldan o'tkazadi. */
  camera?: {
    id: string;
    title: string;
    context?: string;
    progress?: { done: number; total?: number; label?: string };
    list?: { key: string; title: string; subtitle?: string; tone?: string; onUndo?: () => void }[];
    finish?: { label: string };
  };
};

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  scanner: null as ScannerOptions | null,
  playScanFeedback: vi.fn(),
  printPackageReceipt: vi.fn(),
}));

vi.mock("../../../features/print-receipts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../features/print-receipts")>()),
  printPackageReceipt: mocks.printPackageReceipt,
  preloadReceiptPrinting: () => Promise.resolve(),
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

/** `GET transfer-batches/:id/history` qatori (branch-service `findTransferBatchHistory` shakli, 3HKvAyhm). */
const historyRow = (
  id: string,
  action: string,
  actionLabel: string,
  createdAt: string,
  user: { id: string; name: string | null } | null,
) => ({ id, batch_id: "172", user_id: user?.id ?? "0", action, action_label: actionLabel, notes: null, created_at: createdAt, user });

const respond = (
  body: Record<string, unknown> = detail(),
  history: () => Promise<unknown> = () => Promise.resolve({ data: { statusCode: 200, data: [] } }),
) => {
  mocks.get.mockImplementation((url: string) => {
    if (url === "transfer-batches/172" || url === "transfer-batches/172/remaining") return Promise.resolve({ data: body });
    if (url === "transfer-batches/172/history") return history();
    return Promise.reject(new Error(`kutilmagan so'rov: ${url}`));
  });
};
const historyCard = () => screen.getByRole("region", { name: "Tarix" });

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
});

describe("BatchDetailPage — paket cheki (HJ5sLHiz)", () => {
  it("«Chop etish» menyusi: termal 100×60 yoki A5 — paket cheki lokal QR bilan (window.print emas)", async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    mocks.printPackageReceipt.mockResolvedValue({ orders: 0, pages: 1, jobs: 1, withoutQr: 0, delivery: ["printed"] });
    respond(
      detail({
        status: "RECEIVED",
        destination_branch: { id: "1", name: "Toshkent HQ" },
        driver_name: "Aziz Rahimov",
        vehicle_plate: "30 A 456 BC",
      }),
    );
    renderPage("superadmin");

    expect(await screen.findByRole("heading", { level: 1, name: "Paket B-172" })).toBeInTheDocument();
    const card = screen.getByRole("region", { name: "QR kod" });
    const qr = within(card).getByRole("img", { name: "B-172 paketining QR kodi" });
    expect(qr.tagName.toLowerCase()).toBe("svg");
    expect(qr.querySelector("path")?.getAttribute("fill")).toBe("currentColor");

    await user.click(within(card).getByRole("button", { name: "Chop etish" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("Termal yorliq (100×60 mm)"),
      expect.stringContaining("A5 varaq"),
    ]);
    await user.click(within(menu).getByRole("menuitem", { name: /A5 varaq/ }));

    expect(mocks.printPackageReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "batch",
        id: "172",
        direction: "forward",
        token: "BTB-172",
        from: "Urgut filiali",
        to: "Toshkent HQ",
        ordersCount: 3,
        totalPrice: 864000,
      }),
      { sheet: "a5", output: "browser" },
    );
    expect(print).not.toHaveBeenCalled();
  });
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
    // Eski javob (faqat `destination_branch_id`): nom noma'lum — «—»; `GET branches/:id` hech kimda so'ralmaydi (3HKvAyhm).
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
    expect(await within(historyCard()).findByText("Tarix hozircha mavjud emas")).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith("transfer-batches/172/history");
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
    // Eski javobda qabul qiluvchi filial nomi yo'q — nomsiz matn.
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
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("success", "Tanlandi №10165");

    act(() => mocks.scanner!.onMatch(scanned("10165"), "qr-10165"));
    expect(await screen.findByText("Allaqachon tanlangan")).toBeInTheDocument();

    act(() => mocks.scanner!.onMissing("qr-boshqa"));
    expect(await screen.findByText("QR topilmadi")).toBeInTheDocument();
    expect(screen.getByText("Bu QR kod ushbu paketdagi buyurtmalarga mos kelmadi.")).toBeInTheDocument();
    expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("missing", "Bu paketda yo'q · qr-boshqa");
  });

  it("kamera maqsadi: «HQ'ga yuborish · Paket B-172», «N / jami ta tanlandi», ro'yxat va «Bu paketda yo'q»", async () => {
    respond();
    renderPage("manager");
    await screen.findByRole("heading", { level: 1, name: "Paket B-172" });

    expect(mocks.scanner?.camera).toMatchObject({
      id: "batch-send:172",
      title: "HQ'ga yuborish",
      context: "Paket B-172 · Urgut filiali",
      progress: { done: 0, total: 3, label: "ta tanlandi" },
      finish: { label: "Tugatish" },
    });

    act(() => mocks.scanner!.onMatch(scanned("10165"), "qr-10165"));
    act(() => mocks.scanner!.onMissing("qr-boshqa"));
    expect(mocks.scanner?.camera?.progress).toMatchObject({ done: 1, total: 3 });
    // Yangisi birinchi: rad etilgan kod, so'ng tanlangan buyurtma.
    expect(mocks.scanner?.camera?.list?.map((item) => [item.key, item.tone])).toEqual([
      ["missing:qr-boshqa", "danger"],
      ["order:10165", "success"],
    ]);
    expect(mocks.scanner?.camera?.list?.[0]).toMatchObject({
      title: "qr-boshqa · Bu paketda yo'q",
      subtitle: "Mos kelmadi · tanlanmadi",
    });

    act(() => mocks.scanner!.camera!.list![1].onUndo!());
    expect(within(ordersCard()).getByRole("checkbox", { name: "№10165 ni tanlash" })).not.toBeChecked();
    expect(mocks.scanner?.camera?.progress).toMatchObject({ done: 0, total: 3 });
  });

  it("superadmin — doim faqat o'qish: tanlov, skaner va yuborish yo'q; market ustuni", async () => {
    respond(detail({ status: "RECEIVED", destination_branch: { id: "1", name: "Toshkent HQ" } }));
    renderPage("superadmin", { from: "batches", fromSearch: "?tab=old&page=2" });

    expect(await screen.findByRole("heading", { level: 1, name: "Paket B-172" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Paketlar" })).toHaveAttribute("href", "/batches?tab=old&page=2");
    expect(within(screen.getByRole("banner")).getByText("Qabul qilingan")).toHaveClass("bg-success-soft");
    // 3HKvAyhm: nom tafsilotdagi `destination_branch` dan — `GET branches/:id` endi chaqirilmaydi.
    const info = screen.getByRole("region", { name: "Paket ma'lumotlari" });
    expect(within(info).getByText("Toshkent HQ")).toBeInTheDocument();
    expect(mocks.get.mock.calls.some(([url]) => String(url).startsWith("branches/"))).toBe(false);
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
    respond(detail({ direction: "RETURN" }), () =>
      Promise.resolve({
        data: { statusCode: 200, data: [historyRow("h1", "CREATED", "Yaratildi", local(8, 9, 20), { id: "1", name: "Ravshan Ortiqov" })] },
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
    expect(await within(historyCard()).findByText("Qaytarish paketi yaratildi")).toBeInTheDocument();
    expect(within(historyCard()).getByText("Ravshan Ortiqov")).toBeInTheDocument();
  });

  it("⭐ 3HKvAyhm menejer: filial nomlari tafsilotdan (`source_branch` / `destination_branch`), branches/:id yo'q", async () => {
    respond(detail({ status: "SENT", destination_branch: { id: "1", name: "Toshkent HQ" } }));
    renderPage("manager");

    await screen.findByRole("heading", { level: 1, name: "Paket B-172" });
    // Sarlavha izohi: «Urgut filiali → Toshkent HQ · Yaratilgan: …».
    expect(screen.getByRole("banner")).toHaveTextContent(/Urgut filiali\s*Toshkent HQ · Yaratilgan:/);
    const info = screen.getByRole("region", { name: "Paket ma'lumotlari" });
    expect(within(info).getByText("Filial").nextSibling).toHaveTextContent("Urgut filiali");
    expect(within(info).getByText("Qayerga").nextSibling).toHaveTextContent("Toshkent HQ");
    expect(mocks.get.mock.calls.some(([url]) => String(url).startsWith("branches/"))).toBe(false);
  });

  it("⭐ 3HKvAyhm «Tarix» — GET …/history: eng yangisi tepada, bajargan xodim, noma'lum harakat — `action_label`", async () => {
    respond(detail({ status: "RECEIVED", destination_branch: { id: "1", name: "Toshkent HQ" } }), () =>
      Promise.resolve({
        data: {
          statusCode: 200,
          // Backend — xronologik (eng eskisi birinchi).
          data: [
            historyRow("h1", "CREATED", "Yaratildi", local(6, 12, 2), { id: "31", name: "Malika Yusupova" }),
            historyRow("h2", "SENT", "Jo'natildi", local(6, 16, 10), { id: "31", name: "Malika Yusupova" }),
            historyRow("h3", "RECEIVED", "Qabul qilindi", local(6, 19, 35), { id: "40", name: "Bobur Xolmatov" }),
            // Identity javob bermadi — `user: null`: bajargan qatori yo'q, ro'yxat yiqilmaydi.
            historyRow("h4", "REOPENED", "Qayta ochildi", local(6, 20, 0), null),
          ],
        },
      }),
    );
    renderPage("admin");

    await screen.findByRole("heading", { level: 1, name: "Paket B-172" });
    const list = await within(historyCard()).findByRole("list", { name: "Paket tarixi" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((row) => row.querySelector("p")?.textContent)).toEqual([
      "Qayta ochildi",
      "Paket Toshkent HQ'da qabul qilindi",
      "Paket Toshkent HQ'ga jo'natildi",
      "Paket yaratildi",
    ]);
    expect(rows[0]).not.toHaveTextContent("—");
    expect(rows[1]).toHaveTextContent("Bobur Xolmatov");
    expect(rows[3]).toHaveTextContent("Malika Yusupova");
    expect(within(historyCard()).getByText("4 ta")).toBeInTheDocument();
  });

  it("3HKvAyhm «Tarix» xatosi — karta ichida «Qayta urinish», sahifa ishlayveradi", async () => {
    let fail = true;
    respond(detail({ status: "RECEIVED" }), () =>
      fail
        ? Promise.reject({ response: { status: 500 } })
        : Promise.resolve({
            data: { statusCode: 200, data: [historyRow("h1", "CREATED", "Yaratildi", local(6, 12, 2), { id: "31", name: "Malika Yusupova" })] },
          }),
    );
    const user = userEvent.setup();
    renderPage("manager");

    await screen.findByRole("heading", { level: 1, name: "Paket B-172" });
    expect(await within(historyCard()).findByText("Tarixni yuklab bo'lmadi", {}, { timeout: 4000 })).toBeInTheDocument();
    // Asosiy kartalar xatodan ta'sirlanmaydi.
    expect(screen.getByRole("region", { name: "Paket ma'lumotlari" })).toBeInTheDocument();
    fail = false;
    await user.click(within(historyCard()).getByRole("button", { name: "Qayta urinish" }));
    expect(await within(historyCard()).findByText("Paket yaratildi")).toBeInTheDocument();
  });

  it("3HKvAyhm: logist — tarix so'rovi yuborilmaydi (backend 403), tafsilotdagi `history` ko'rsatiladi", async () => {
    respond(detail({ status: "SENT" }));
    renderPage("logist");

    await screen.findByRole("heading", { level: 1, name: "Paket B-172" });
    expect(within(historyCard()).getByText("Tarix hozircha mavjud emas")).toBeInTheDocument();
    expect(mocks.get).not.toHaveBeenCalledWith("transfer-batches/172/history");
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
