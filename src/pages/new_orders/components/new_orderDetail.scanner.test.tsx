import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n, { i18nReady } from "../../../i18n";
import { renderWithProviders } from "../../../test/test-utils";
import { isScannerOverlayOpen, openScanner, resetScannerHost } from "../../../shared/lib/scanner/scannerHost";
import { getActiveScanTarget, resetScanTargets } from "../../../shared/lib/scanner/scanTargets";
import ScannerHost from "../../../widgets/scanner/ScannerHost";
import NewOrderDetail from "./new_orderDetail";

/**
 * `/new-orders/:marketId` — kamera (Trello v1eLN2tV 2-bosqich, ega 2026-10-19): markaziy «Skaner» tugmasi shu
 * sahifaning skan maqsadini ochadi. Haqiqiy `useOrderQrScanner` (kamera skani USB bilan bir yo'l) va
 * `ScannerHost`; tarmoq — `useOrders` va `fetchScanDetail` mock'lari.
 */

type Order = Record<string, unknown> & { id: string };

const mocks = vi.hoisted(() => ({
  receiveMutate: vi.fn(),
  fetchScanDetail: vi.fn(),
  marketsRefetch: vi.fn(),
  playScanFeedback: vi.fn(),
  ordersByMarket: {} as Record<string, Order[]>,
  responses: new Map<string, unknown>(),
}));

vi.mock("../../../shared/lib/useCameraQrScanner", () => ({
  useCameraQrScanner: () => ({
    isStarting: false,
    torchEnabled: false,
    hasTorch: false,
    cameraError: "",
    cameraErrorKind: null,
    cameraUnavailable: false,
    restartScanner: vi.fn(),
    toggleTorch: vi.fn(),
    stopScanner: vi.fn(),
    setCameraError: vi.fn(),
  }),
}));

const query = (data: unknown) => ({
  data,
  status: "success",
  isLoading: false,
  isPending: false,
  isSuccess: true,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
});

/** Javob har renderda bir xil obyekt (haqiqiy `useQuery` kabi). */
const marketResponse = (marketId: string) => {
  if (!mocks.responses.has(marketId)) {
    mocks.responses.set(marketId, query({ data: mocks.ordersByMarket[marketId] ?? [] }));
  }
  return mocks.responses.get(marketId);
};

vi.mock("../../../entities/orders", () => ({
  useOrders: () => ({
    useGetTodayOrdersByMarket: (marketId: number | string) => marketResponse(String(marketId)),
    useGetTodayOrders: () => ({ ...query(undefined), data: undefined, refetch: mocks.marketsRefetch }),
    useCancelledMarkets: () => query([]),
    useCancelledOrdersByMarket: () => query([]),
    deleteOrder: { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false },
    createReceiveOrder: { mutate: mocks.receiveMutate, isPending: false },
    createTransferBatch: { mutate: vi.fn(), isPending: false },
  }),
}));

vi.mock("../../scan/lib/scanResource", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../scan/lib/scanResource")>()),
  fetchScanDetail: mocks.fetchScanDetail,
}));

vi.mock("../../../shared/lib/scanner/feedback", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../shared/lib/scanner/feedback")>()),
  playScanFeedback: mocks.playScanFeedback,
}));

const order = (id: string, token: string, name: string, marketId: string, marketName: string): Order => ({
  id,
  qr_code_token: token,
  status: "new",
  where_deliver: "address",
  total_price: 96000,
  paid_amount: 0,
  to_be_paid: 96000,
  createdAt: "2026-10-19T08:00:00.000Z",
  comment: null,
  address: "Farg'ona",
  items: [],
  customer: { id: `c-${id}`, name, phone_number: "+998901112233" },
  district: { name: "Farg'ona sh." },
  market: { id: marketId, name: marketName },
});

const adminState = {
  role: { id: "admin-1", role: "admin", region: null, name: "admin" },
  user: {
    user: { id: "admin-1", role: "admin" },
    isAuthenticated: true,
    accessToken: null,
    loading: false,
    isAppInitializing: false,
    error: null,
  },
} as never;

const Path = () => <span data-testid="path">{useLocation().pathname}</span>;

const renderPage = () =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/new-orders/:marketId" element={<NewOrderDetail />} />
      </Routes>
      <ScannerHost />
      <Path />
    </>,
    { route: "/new-orders/121", preloadedState: adminState },
  );

const target = () => {
  const active = getActiveScanTarget();
  if (!active) throw new Error("skan maqsadi yo'q");
  return active;
};

const statsOf = () => Object.fromEntries((target().stats ?? []).map((stat) => [stat.key, stat.value]));

const notFound = () => Object.assign(new Error("Not found"), { response: { status: 404 } });

beforeAll(async () => {
  await i18nReady;
  await i18n.changeLanguage("uz");
});

beforeEach(() => {
  mocks.responses.clear();
  mocks.ordersByMarket = {
    "121": [
      order("o1", "aaaaaaaaaaaaaaaaaaaaaaa1", "Sanjar Mirzayev", "121", "Ipak Yo'li Savdo"),
      order("o2", "aaaaaaaaaaaaaaaaaaaaaaa2", "Gulnoza Hamidova", "121", "Ipak Yo'li Savdo"),
    ],
    "122": [order("o7", "bbbbbbbbbbbbbbbbbbbbbbb7", "Rustam Qodirov", "122", "Baraka Shop")],
  };
  mocks.receiveMutate.mockImplementation((_vars: unknown, options: { onSuccess?: () => void; onSettled?: () => void }) => {
    options.onSuccess?.();
    options.onSettled?.();
  });
  mocks.marketsRefetch.mockResolvedValue({
    isError: false,
    data: {
      data: [
        { market_id: "121", orders_count: 2, market: { name: "Ipak Yo'li Savdo" } },
        { market_id: "122", orders_count: 1, market: { name: "Baraka Shop" } },
      ],
    },
  });
});

afterEach(() => {
  act(() => {
    resetScanTargets();
    resetScannerHost();
  });
  vi.clearAllMocks();
});

describe("Market yangi buyurtmalari — kamera maqsadi", () => {
  it("ro'yxatdan o'tadi: «Qabul qilish · market», «Qabul qilindi 0 · Qoldi 2 · Topilmadi 0», «Tugatish»", async () => {
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Ipak Yo'li Savdo" });

    expect(target()).toMatchObject({
      id: "new-orders:market:121",
      title: "Qabul qilish",
      context: "Ipak Yo'li Savdo · 2 ta buyurtma",
      progress: { done: 0, total: 2, label: "ta qabul qilindi" },
      listTitle: "Qabul qilinganlar",
      finish: { label: "Tugatish" },
      switcher: { label: "Ipak Yo'li Savdo", value: "121", title: "Marketni tanlang" },
    });
    expect(target().stats?.map((stat) => stat.label)).toEqual(["Qabul qilindi", "Qoldi", "Topilmadi"]);
    expect(statsOf()).toEqual({ received: 0, left: 2, missing: 0 });
  });

  it("kamera skani — USB bilan bir yo'l: ro'yxatdagi buyurtma darhol qabul qilinadi (server amali, «Bekor qilish» yo'q)", async () => {
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Ipak Yo'li Savdo" });

    await act(async () => {
      await target().onScan("aaaaaaaaaaaaaaaaaaaaaaa1", "camera");
    });

    expect(mocks.receiveMutate).toHaveBeenCalledWith({ orderIds: ["o1"] }, expect.any(Object));
    expect(mocks.fetchScanDetail).not.toHaveBeenCalled();
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("success", "Qabul qilindi №o1");
    expect(statsOf()).toEqual({ received: 1, left: 1, missing: 0 });
    expect(target().progress).toMatchObject({ done: 1, total: 2 });
    expect(target().list?.[0]).toMatchObject({ title: "№o1 · Sanjar Mirzayev", tone: "success" });
    expect(target().list?.[0].onUndo).toBeUndefined();
  });

  it("boshqa marketning buyurtmasi — server tekshiradi va RAD etadi: qabul so'rovi yo'q, «Topilmadi» ga kirmaydi", async () => {
    mocks.fetchScanDetail.mockResolvedValue({
      type: "order",
      data: { statusCode: 200, data: { id: "o7", qr_code_token: "bbbbbbbbbbbbbbbbbbbbbbb7", status: "new", market_id: "122", market: { name: "Baraka Shop" } } },
    });
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Ipak Yo'li Savdo" });

    await act(async () => {
      await target().onScan("bbbbbbbbbbbbbbbbbbbbbbb7", "camera");
    });

    await waitFor(() =>
      expect(mocks.playScanFeedback).toHaveBeenCalledWith("error", "Boshqa market: Baraka Shop — qabul qilinmadi"),
    );
    expect(mocks.fetchScanDetail).toHaveBeenCalledWith("bbbbbbbbbbbbbbbbbbbbbbb7");
    expect(mocks.receiveMutate).not.toHaveBeenCalled();
    expect(statsOf()).toEqual({ received: 0, left: 2, missing: 0 });
    expect(target().list).toEqual([]);
  });

  it("serverda ham yo'q (404) — «Topilmadi», hisoblanadi va ro'yxatda turadi", async () => {
    mocks.fetchScanDetail.mockRejectedValue(notFound());
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Ipak Yo'li Savdo" });

    await act(async () => {
      await target().onScan("ccccccccccccccccccccccc0", "manual");
    });

    await waitFor(() => expect(statsOf()).toEqual({ received: 0, left: 2, missing: 1 }));
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("missing", "Topilmadi");
    expect(target().list?.[0]).toMatchObject({ title: "ccccccccccccccccccccccc0", subtitle: "Topilmadi", tone: "danger" });
    expect(mocks.receiveMutate).not.toHaveBeenCalled();
  });

  it("shu marketning yangi buyurtmasi ro'yxatda hali yo'q — server tasdiqlasa darhol qabul qilinadi", async () => {
    mocks.fetchScanDetail.mockResolvedValue({
      type: "order",
      data: { data: { id: "o3", qr_code_token: "aaaaaaaaaaaaaaaaaaaaaaa3", status: "new", market_id: "121" } },
    });
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Ipak Yo'li Savdo" });

    await act(async () => {
      await target().onScan("aaaaaaaaaaaaaaaaaaaaaaa3", "camera");
    });

    await waitFor(() => expect(mocks.receiveMutate).toHaveBeenCalledWith({ orderIds: ["o3"] }, expect.any(Object)));
  });

  it("kamera ichida market almashtiriladi: /new-orders/122, kamera ochiq qoladi, hisob yangidan", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Ipak Yo'li Savdo" });
    await act(async () => {
      await target().onScan("aaaaaaaaaaaaaaaaaaaaaaa1", "camera");
    });
    expect(statsOf().received).toBe(1);

    act(() => {
      openScanner();
    });
    const dialog = await screen.findByRole("dialog", { name: "Qabul qilish" });
    await user.click(within(dialog).getByRole("button", { name: "Ipak Yo'li Savdo — almashtirish" }));
    const sheet = await screen.findByRole("dialog", { name: "Marketni tanlang" });
    expect(mocks.marketsRefetch).toHaveBeenCalled();
    await user.click(await within(sheet).findByRole("button", { name: /Baraka Shop/ }));

    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/new-orders/122"));
    await waitFor(() => expect(target().id).toBe("new-orders:market:122"));
    expect(isScannerOverlayOpen()).toBe(true);
    expect(await screen.findByRole("dialog", { name: "Qabul qilish" })).toBeInTheDocument();
    expect(target().context).toBe("Baraka Shop · 1 ta buyurtma");
    expect(statsOf()).toEqual({ received: 0, left: 1, missing: 0 });

    // Yangi marketning buyurtmasi — yangi sahifaning handler'iga.
    await act(async () => {
      await target().onScan("bbbbbbbbbbbbbbbbbbbbbbb7", "camera");
    });
    expect(mocks.receiveMutate).toHaveBeenLastCalledWith({ orderIds: ["o7"] }, expect.any(Object));
  });
});
