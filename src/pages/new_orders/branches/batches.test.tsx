import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import BranchSentBatchesPage from "./batches";

/**
 * Filial paketlari — `/new-orders/branches/:branchId` (dizayn v2, maket `superadmin-neworders-branch-batches`):
 * so'rov parametrlari, sarlavha va asosiy amal, jadval, tanlov, USB skaner (tanlash, takror, topilmadi),
 * qabul (har paketga alohida so'rov, qisman xato), holatlar va telefon kartalari.
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

vi.mock("../../../shared/lib/scanner/feedback", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../shared/lib/scanner/feedback")>()),
  playScanFeedback: mocks.playScanFeedback,
  playMissingOrderFeedback: mocks.playMissingOrderFeedback,
}));

const today = (h: number, m: number) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).toISOString();
};

/** Backend `GET transfer-batches` qatori (branch-service: `region` biriktirilgan). */
const rawBatch = (id: string, region: string, count: number, total: number, createdAt: string) => ({
  id,
  qr_code_token: `BTB-TOKEN${id}AA`,
  source_branch_id: "7",
  destination_branch_id: "1",
  direction: "FORWARD",
  target_region_id: `r${id}`,
  status: "SENT",
  order_count: count,
  total_price: total,
  createdAt,
  region: { id: `r${id}`, name: region },
});

const BATCHES = [
  rawBatch("148", "Samarqand", 18, 4260000, today(13, 48)),
  rawBatch("147", "Farg'ona", 12, 2875000, today(12, 15)),
  rawBatch("140", "Jizzax", 3, 412000, new Date(2026, 9, 4, 15, 50).toISOString()),
];

const respond = ({ batches = BATCHES as unknown, branch = true } = {}) => {
  mocks.get.mockImplementation((url: string) => {
    if (url === "transfer-batches") {
      return batches instanceof Error
        ? Promise.reject(batches)
        : Promise.resolve({ data: { statusCode: 200, data: { items: batches, meta: { page: 1, limit: 100, total: 3 } } } });
    }
    if (url === "branches/7" && branch) {
      return Promise.resolve({ data: { statusCode: 200, data: { id: "7", name: "Chilonzor qabul punkti" } } });
    }
    return Promise.reject(new Error(`kutilmagan so'rov: ${url}`));
  });
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
        <Route path="/new-orders/branches/:branchId" element={<BranchSentBatchesPage />} />
        <Route path="/new-orders/branches/:branchId/batches/:batchId" element={<p>Paket tafsiloti</p>} />
      </Routes>
      <LocationProbe />
    </>,
    { route: "/new-orders/branches/7", preloadedState: stateFor(role) },
  );

const table = () => screen.getByRole("table", { name: "Paketlar" });
const bodyRows = () => within(table()).getAllByRole("row").slice(1);
const rowOf = (displayId: string) =>
  bodyRows().find((row) => within(row).queryByRole("link", { name: displayId })) as HTMLElement;
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

describe("Filial paketlari — so'rov va sarlavha", () => {
  it("so'rov: source_branch_id, SENT, FORWARD, page 1, limit 100 (v1 dagidek)", async () => {
    renderPage();
    await waitFor(() => expect(bodyRows()).toHaveLength(3));

    const call = mocks.get.mock.calls.find(([url]) => url === "transfer-batches");
    expect(call?.[1]).toEqual({
      params: { status: "SENT", direction: "FORWARD", source_branch_id: "7", page: "1", limit: "100" },
    });
  });

  it("sarlavha: «← Filial paketlari», filial nomi, izoh · N ta · summa; asosiy amal tanlovsiz nofaol", async () => {
    renderPage("superadmin");

    expect(screen.getByRole("link", { name: "Filial paketlari" })).toHaveAttribute("href", "/new-orders/branches");
    expect(await screen.findByRole("heading", { level: 1, name: "Chilonzor qabul punkti" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/Filialdan yuborilgan/)).toHaveTextContent(
        "Filialdan yuborilgan, qabul kutayotgan paketlar · 3 ta · 7 547 000 so'm",
      ),
    );
    expect(receiveButton()).toBeDisabled();
    expect(receiveButton()).toHaveTextContent("Qabul qilish — 0 ta paket");
  });

  it("filial nomi kelmasa — «Filial #7» (v1 dagidek)", async () => {
    respond({ branch: false });
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "Filial #7" })).toBeInTheDocument();
  });
});

describe("Filial paketlari — jadval va tanlov", () => {
  it("qator: paket havolasi + sana, viloyat, son, holat (haqiqiy — «Yo'lda»), summa, «ochish»", async () => {
    renderPage();
    await waitFor(() => expect(bodyRows()).toHaveLength(3));

    const row = rowOf("B-148");
    expect(within(row).getByRole("link", { name: "B-148" })).toHaveAttribute("href", "/new-orders/branches/7/batches/148");
    expect(within(row).getByRole("link", { name: "B-148 paketini ochish" })).toHaveAttribute(
      "href",
      "/new-orders/branches/7/batches/148",
    );
    expect(row).toHaveTextContent("Bugun, 13:48");
    expect(row).toHaveTextContent("Samarqand");
    expect(row).toHaveTextContent("18 ta");
    expect(row).toHaveTextContent("Yo'lda");
    // Paket badge'i maketdagidek (F1): «Yo'lda» — warning, buyurtmadagi «Yo'lda» bilan bir xil.
    expect(within(row).getByText("Yo'lda")).toHaveClass("bg-warning-soft");
    expect(row).not.toHaveTextContent("Yangi");
    expect(row).toHaveTextContent("4 260 000 so'm");
    expect(rowOf("B-140")).toHaveTextContent("04.10.2026");
  });

  it("qatorni bosish paket tafsilotini ochadi", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(bodyRows()).toHaveLength(3));

    await user.click(within(rowOf("B-147")).getByText("Farg'ona"));
    expect(screen.getByTestId("location")).toHaveTextContent("/new-orders/branches/7/batches/147");
  });

  it("belgi bilan tanlash: panel xulosasi va asosiy amal soni; «Barchasini tanlash» — ko'rinib turganlar", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(bodyRows()).toHaveLength(3));
    expect(selectionTitle()).toHaveTextContent("Paket tanlanmagan");
    // Bo'sh tanlov — neytral (ko'k faqat tanlov bo'lganda; maket `*-cancelled-scanner-dialog`).
    const region = screen.getByRole("region", { name: "Tanlanganlar" });
    expect(region).toHaveClass("bg-sunken");
    expect(region).not.toHaveClass("bg-action-soft");

    await user.click(screen.getByRole("checkbox", { name: "B-148 paketini tanlash" }));
    expect(selectionTitle()).toHaveTextContent("1 ta paket tanlandi · 4 260 000 so'm");
    expect(screen.getByRole("region", { name: "Tanlanganlar" })).toHaveClass("bg-action-soft");
    expect(receiveButton()).toBeEnabled();
    expect(receiveButton()).toHaveTextContent("Qabul qilish — 1 ta paket");

    // Qidiruv: faqat ko'rinib turganlar «Barchasini tanlash» ga kiradi.
    await user.type(screen.getByRole("searchbox", { name: "Paketlarni qidirish" }), "jizzax");
    expect(bodyRows()).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Barchasini tanlash" }));
    expect(selectionTitle()).toHaveTextContent("2 ta paket tanlandi · 4 672 000 so'm");
    await user.click(screen.getByRole("button", { name: "Tanlovni bekor qilish" }));
    expect(selectionTitle()).toHaveTextContent("1 ta paket tanlandi · 4 260 000 so'm");
  });
});

describe("Filial paketlari — USB skaner", () => {
  it("paket QR tokeni bilan indekslanadi; skan — paket tanlanadi (qabul qilinmaydi), muvaffaqiyat ovozi", async () => {
    renderPage();
    await waitFor(() => expect(bodyRows()).toHaveLength(3));

    expect(mocks.scanner?.enabled).toBe(true);
    expect(scanned("147").qr_code_token).toBe("BTB-TOKEN147AA");
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent(
      "Skaner tayyorQR kodni skanerlang — paket ro'yxatda tanlanadi",
    );

    act(() => mocks.scanner!.onMatch(scanned("147"), "BTB-TOKEN147AA"));
    expect(screen.getByRole("checkbox", { name: "B-147 paketini tanlash" })).toBeChecked();
    expect(rowOf("B-147")).toHaveAttribute("data-selected");
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("success");
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("takroriy skan: «Allaqachon topilgan» ovozi va xabar «#147» (2 s)", async () => {
    renderPage();
    await waitFor(() => expect(bodyRows()).toHaveLength(3));

    act(() => mocks.scanner!.onMatch(scanned("147"), "BTB-TOKEN147AA"));
    act(() => mocks.scanner!.onMatch(scanned("147"), "BTB-TOKEN147AA"));

    expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("duplicate", "Allaqachon topilgan");
    expect(await screen.findByText("Allaqachon topilgan")).toBeInTheDocument();
    expect(screen.getByText("#147")).toBeInTheDocument();
    expect(selectionTitle()).toHaveTextContent("1 ta paket tanlandi");
  });

  it("topilmagan QR: «topilmadi» ovozi va ogohlantirish", async () => {
    renderPage();
    await waitFor(() => expect(bodyRows()).toHaveLength(3));

    act(() => mocks.scanner!.onMissing("BTB-BOSHQAFILIAL"));
    expect(mocks.playMissingOrderFeedback).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("QR topilmadi")).toBeInTheDocument();
    expect(screen.getByText("Bu QR kod shu filial paketlariga mos kelmadi.")).toBeInTheDocument();
  });
});

describe("Filial paketlari — qabul", () => {
  it("har paketga POST …/receive; qisman xato — alohida xabarlar, qabul qilingan yashiriladi, xatolisi tanlangan qoladi", async () => {
    const user = userEvent.setup();
    mocks.post.mockImplementation((url: string) =>
      url === "transfer-batches/147/receive" ? Promise.reject(new Error("409")) : Promise.resolve({ data: {} }),
    );
    renderPage();
    await waitFor(() => expect(bodyRows()).toHaveLength(3));

    await user.click(screen.getByRole("checkbox", { name: "B-148 paketini tanlash" }));
    await user.click(screen.getByRole("checkbox", { name: "B-147 paketini tanlash" }));
    await user.click(receiveButton());

    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));
    expect(mocks.post.mock.calls.map(([url, body]) => [url, body])).toEqual([
      ["transfer-batches/148/receive", undefined],
      ["transfer-batches/147/receive", undefined],
    ]);

    expect(await screen.findByText("Paketlar qabul qilindi")).toBeInTheDocument();
    expect(screen.getByText("1 ta paket qabul qilindi.")).toBeInTheDocument();
    expect(screen.getByText("Paketlarni qabul qilishda xatolik")).toBeInTheDocument();
    expect(screen.getByText("1 ta paket qabul qilinmadi. Qayta urinib ko'ring.")).toBeInTheDocument();

    await waitFor(() => expect(rowOf("B-148")).toBeUndefined());
    expect(screen.getByRole("checkbox", { name: "B-147 paketini tanlash" })).toBeChecked();
    expect(selectionTitle()).toHaveTextContent("1 ta paket tanlandi · 2 875 000 so'm");
  });
});

describe("Filial paketlari — holatlar", () => {
  it("bo'sh: «Qabul kutayotgan paket yo'q», tanlov paneli va skaner qatori yo'q", async () => {
    respond({ batches: [] });
    renderPage();
    expect(await screen.findByText("Qabul kutayotgan paket yo'q")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Tanlanganlar" })).not.toBeInTheDocument();
    expect(screen.queryByText("Skaner tayyor")).not.toBeInTheDocument();
  });

  it("xato: ErrorState + «Qayta urinish» (v1 qizil quti o'rnida)", async () => {
    const user = userEvent.setup();
    respond({ batches: new Error("Network Error") });
    renderPage();

    const retry = await screen.findByRole("button", { name: "Qayta urinish" });
    respond();
    await user.click(retry);
    await waitFor(() => expect(bodyRows()).toHaveLength(3));
  });

  it("qidiruv natija bermasa — «Qidiruvni tozalash»", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(bodyRows()).toHaveLength(3));

    await user.type(screen.getByRole("searchbox", { name: "Paketlarni qidirish" }), "Namangan");
    expect(screen.getByText("Bu qidiruv bo'yicha paket topilmadi")).toBeInTheDocument();
    const noMatch = screen.getByText("Bu qidiruv bo'yicha paket topilmadi").parentElement as HTMLElement;
    await user.click(within(noMatch).getByRole("button", { name: "Qidiruvni tozalash" }));
    expect(bodyRows()).toHaveLength(3);
  });
});

describe("Filial paketlari — telefon (< 768): kartalar", () => {
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

  it("karta: belgi + havola «B-148 · Samarqand», summa, «18 ta buyurtma · Bugun, 13:48», holat", async () => {
    renderPage();

    const list = await screen.findByRole("list", { name: "Paketlar" });
    const [first] = within(list).getAllByRole("listitem");
    expect(within(first).getByRole("checkbox", { name: "B-148 paketini tanlash" })).toBeInTheDocument();
    const link = within(first).getByRole("link");
    expect(link).toHaveAttribute("href", "/new-orders/branches/7/batches/148");
    expect(link).toHaveTextContent("B-148 · Samarqand4 260 000 so'm18 ta buyurtma · Bugun, 13:48Yo'lda");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
