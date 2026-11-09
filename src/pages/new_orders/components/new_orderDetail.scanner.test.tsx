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
  receiveMutateAsync: vi.fn(),
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
    createReceiveOrder: { mutate: mocks.receiveMutate, mutateAsync: mocks.receiveMutateAsync, isPending: false },
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

/** HYBRID filial menejeri — qabul `transfer-batches` orqali (`resolveReceiveMode`). */
const hybridManagerState = {
  role: { id: "522", role: "manager", region: null, name: "manager" },
  user: {
    user: { id: "522", role: "manager", branch: { id: "15", type: "HYBRID" } },
    isAuthenticated: true,
    accessToken: null,
    loading: false,
    isAppInitializing: false,
    error: null,
  },
} as never;

const renderPage = (preloadedState: never = adminState) =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/new-orders/:marketId" element={<NewOrderDetail />} />
      </Routes>
      <ScannerHost />
      <Path />
    </>,
    { route: "/new-orders/121", preloadedState },
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
  // Ommaviy qabul (tasdiq oynasi) — `mutate` callbacklari bilan; skan qabuli — har skan o'z `mutateAsync` va'dasi bilan.
  mocks.receiveMutate.mockImplementation((_vars: unknown, options: { onSuccess?: () => void; onSettled?: () => void }) => {
    options.onSuccess?.();
    options.onSettled?.();
  });
  mocks.receiveMutateAsync.mockReset();
  mocks.receiveMutateAsync.mockResolvedValue({});
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

    expect(mocks.receiveMutateAsync).toHaveBeenCalledWith({ orderIds: ["o1"] });
    expect(mocks.fetchScanDetail).not.toHaveBeenCalled();
    // «Ovozli xabar»: HQ market qabuli — «Qabul qilindi».
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("success", "Qabul qilindi №o1", undefined, { voice: "received" });
    expect(statsOf()).toEqual({ received: 1, left: 1, missing: 0 });
    expect(target().progress).toMatchObject({ done: 1, total: 2 });
    expect(target().list?.[0]).toMatchObject({ title: "№o1 · Sanjar Mirzayev", tone: "success" });
    expect(target().list?.[0].onUndo).toBeUndefined();
  });

  it("⭐ sekin internet: A javobi kelmasdan B skanerlanadi — ikkalasi ham qabul qilindi (ovoz, hisob), A qotib qolmaydi", async () => {
    let finishA: (value: unknown) => void = () => {};
    mocks.receiveMutateAsync
      .mockImplementationOnce(() => new Promise((resolve) => (finishA = resolve)))
      .mockResolvedValueOnce({});
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Ipak Yo'li Savdo" });

    await act(async () => {
      await target().onScan("aaaaaaaaaaaaaaaaaaaaaaa1", "keyboard");
    });
    await act(async () => {
      await target().onScan("aaaaaaaaaaaaaaaaaaaaaaa2", "keyboard");
    });
    await act(async () => {
      finishA({});
    });

    // Ilgari (`mutate(vars, { onSuccess })`): B boshlanishi bilan A ning callbacklari uzilardi — A ovozsiz, hisobsiz.
    await waitFor(() => expect(statsOf()).toEqual({ received: 2, left: 0, missing: 0 }));
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("success", "Qabul qilindi №o1", undefined, { voice: "received" });
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("success", "Qabul qilindi №o2", undefined, { voice: "received" });

    // A «kutilmoqda» belgisida qolmagan: qayta skan — takror ogohlantirish, yangi qabul so'rovi yo'q.
    await act(async () => {
      await target().onScan("aaaaaaaaaaaaaaaaaaaaaaa1", "keyboard");
    });
    expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("duplicate", expect.any(String));
    expect(mocks.receiveMutateAsync).toHaveBeenCalledTimes(2);
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
    expect(mocks.receiveMutateAsync).not.toHaveBeenCalled();
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
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("missing", "Topilmadi: ccccccccccccccccccccccc0");
    expect(target().list?.[0]).toMatchObject({ title: "ccccccccccccccccccccccc0", subtitle: "Topilmadi", tone: "danger" });
    expect(mocks.receiveMutateAsync).not.toHaveBeenCalled();
  });

  it("begona QR (403 order_not_in_your_branch, #620): lokal sabab, «qayta skanerlang» yo'q, hisob o'zgarmaydi", async () => {
    mocks.fetchScanDetail.mockRejectedValue(
      Object.assign(new Error("Forbidden"), {
        response: {
          status: 403,
          data: { statusCode: 403, message: "backend matni", data: { reason: "order_not_in_your_branch" } },
        },
      }),
    );
    renderPage(hybridManagerState);
    await screen.findByRole("heading", { level: 1, name: "Ipak Yo'li Savdo" });

    await act(async () => {
      await target().onScan("ddddddddddddddddddddddd4", "keyboard");
    });

    expect(await screen.findByText("Bu buyurtma sizning filialingizda emas")).toBeInTheDocument();
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("error", "Bu buyurtma sizning filialingizda emas");
    expect(screen.queryByText("Tekshirib bo'lmadi — qayta skanerlang")).not.toBeInTheDocument();
    expect(screen.queryByText("backend matni")).not.toBeInTheDocument();
    expect(statsOf()).toEqual({ received: 0, left: 2, missing: 0 });
    expect(target().list).toEqual([]);
    expect(mocks.receiveMutateAsync).not.toHaveBeenCalled();
  });

  it("ommaviy «Qabul qilish» dan keyin (ro'yxat yangilangan) shu buyurtma skanerlansa — takror, «Topilmadi» emas", async () => {
    // Qabul qilingan buyurtma serverda endi «received» — tekshiruvga borsa ham «Topilmadi» bo'lmasin.
    mocks.fetchScanDetail.mockResolvedValue({
      type: "order",
      data: { data: { id: "o1", qr_code_token: "aaaaaaaaaaaaaaaaaaaaaaa1", status: "received", market_id: "121" } },
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Ipak Yo'li Savdo" });

    await user.click(screen.getByRole("checkbox", { name: "№o1 ni tanlash" }));
    await user.click(screen.getByRole("button", { name: "Qabul qilish — 1 ta buyurtma" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Qo'lda qabul qilish" });
    // Qayta so'rov javobi — qabul qilingan buyurtmasiz.
    mocks.responses.set("121", query({ data: [mocks.ordersByMarket["121"][1]] }));
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));
    expect(mocks.receiveMutate).toHaveBeenCalledWith({ orderIds: ["o1"] }, expect.any(Object));
    await waitFor(() => expect(statsOf()).toEqual({ received: 1, left: 1, missing: 0 }));

    await act(async () => {
      await target().onScan("aaaaaaaaaaaaaaaaaaaaaaa1", "camera");
    });

    expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("duplicate", expect.any(String));
    expect(statsOf()).toEqual({ received: 1, left: 1, missing: 0 });
    expect(target().list?.map((item) => item.key)).toEqual(["received:o1"]);
    expect(mocks.receiveMutate).toHaveBeenCalledTimes(1);
    expect(mocks.receiveMutateAsync).not.toHaveBeenCalled();
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

    await waitFor(() => expect(mocks.receiveMutateAsync).toHaveBeenCalledWith({ orderIds: ["o3"] }));
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
    expect(mocks.receiveMutateAsync).toHaveBeenLastCalledWith({ orderIds: ["o7"] });
  });
});
