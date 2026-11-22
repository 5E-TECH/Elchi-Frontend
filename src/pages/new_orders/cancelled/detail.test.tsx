import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SCANNER_KEY_GAP_MS } from "../../../shared/lib/useKeyboardScanner";
import { renderWithProviders } from "../../../test/test-utils";
import { markScannerCameraMounted } from "../../../shared/lib/scanner/scannerHost";
import CancelledMarketDetail from "./detail";

/**
 * Bekor qilinganlarni marketga topshirish (dizayn v2) — biznes qoida o'zgarmaganini tekshiradi:
 * market QR skanerlanmaguncha topshirilmaydi; QR / kod hech narsani avtomatik tanlamaydi va yubormaydi. SKAN =
 * TOPSHIRISH (ega qarori 2026-11-15, BeePost naqshi): ruxsat ichida har buyurtma QR skani o'sha zahoti alohida
 * so'rov bilan (token bilan) topshiriladi, qator ro'yxatdan «Topshirildi» ga o'tadi; takror — «Allaqachon
 * topshirilgan», notanish — «QR topilmadi», ruxsatsiz — «Avval market QR'ini skanerlang»; market roli — o'z QR kodi.
 */

type ScannerOptions = {
  orders: { id: string }[];
  enabled?: boolean;
  paused?: boolean;
  onMatch: (order: { id: string }, raw: string) => void;
  onMissing: (raw: string) => void;
  onPausedScan?: (raw: string, source: string) => void;
  /** Kamera maqsadi (markaziy «Skaner» tugmasi) — `useOrderQrScanner` uni USB bilan bir yo'ldan o'tkazadi. */
  camera?: {
    id: string;
    title: string;
    context?: string;
    hint?: string;
    note?: { title: string; text?: string };
    progress?: { done: number; total?: number; label?: string };
    list?: { key: string; title: string; subtitle?: string; onUndo?: () => void }[];
    listTitle?: string;
    finish?: { label: string };
  };
};

const mocks = vi.hoisted(() => ({
  handoverMutateAsync: vi.fn(),
  scanMutateAsync: vi.fn(),
  pinMutateAsync: vi.fn(),
  generateMutate: vi.fn(),
  playScanFeedback: vi.fn(),
  fetchScanDetail: vi.fn(),
  scanner: { current: null as ScannerOptions | null },
  qrRequired: { current: true as boolean | undefined },
  emptyList: { current: false },
  /** `useCancelledOrdersByMarket` ga uzatilgan parametrlar (BG3 `stage`, sana). */
  cancelledCalls: [] as Array<{ stage?: string; start_day?: string; end_day?: string } | undefined>,
}));

const order = (id: string, name: string, total: number) => ({
  id,
  status: "cancelled",
  where_deliver: "center",
  total_price: total,
  paid_amount: 0,
  to_be_paid: 0,
  createdAt: "2026-10-01T08:00:00.000Z",
  comment: null,
  address: null,
  qr_code_token: `tok-${id}`,
  items: [{ id: `i-${id}`, product_id: null, product_name: "Qishki shapka", quantity: 2 }],
  customer: { id: `c-${id}`, name, phone_number: "+998901112233" },
  district: { id: "d1", name: "Sergeli tumani", region: { id: "r1", name: "Toshkent sh." } },
  market: { id: "201", name: "Baraka Shop", cancelled_handover_qr_required: mocks.qrRequired.current },
});

/** Javob har renderda bir xil obyekt (haqiqiy `useQuery` kabi) — bayroq o'zgarsa yangisi. */
const responses = new Map<string, unknown>();
const ordersResponse = () => {
  const key = `${mocks.qrRequired.current}-${mocks.emptyList.current}`;
  if (!responses.has(key)) {
    responses.set(key, {
      data: mocks.emptyList.current ? [] : [order("501", "Malika Yusupova", 96000), order("502", "Dilfuza Hasanova", 245000)],
    });
  }
  return responses.get(key);
};

/** BG3: «Yo'lda» (`courier,in_transit,branch`) va «Olganlarim» (`market`) javoblari — bosqich maydonlari bilan. */
const stageResponses = new Map<string, unknown>();
const stageResponse = (stage: string) => {
  if (!stageResponses.has(stage)) {
    stageResponses.set(
      stage,
      stage === "market"
        ? {
            data: [
              {
                ...order("490", "Kamola Saidova", 590000),
                status: "returned_to_market",
                return_stage: "market",
                cancel_return: {
                  stage: "market",
                  place_type: "BRANCH",
                  place_name: "Samarqand filiali",
                  handed_over_at: "2026-10-20T12:05:00.000Z",
                  handover_method: "qr",
                },
              },
            ],
            total: 1,
          }
        : {
            data: [
              {
                ...order("510", "Dilnoza Karimova", 185000),
                return_stage: "courier",
                cancel_return: { stage: "courier", place_type: "COURIER", place_name: "Akmal Rahimov" },
              },
              {
                ...order("511", "Madina Rasulova", 229000),
                return_stage: "branch",
                cancel_return: {
                  stage: "branch",
                  place_type: "BRANCH",
                  place_name: "Farg'ona filiali",
                  received_at: new Date(Date.now() - 4 * 86_400_000).toISOString(),
                },
              },
            ],
            total: 2,
          },
    );
  }
  return stageResponses.get(stage);
};

const idleQuery = () => ({ status: "pending", data: undefined, isLoading: false, isError: false, refetch: vi.fn() });

vi.mock("../../../entities/orders", () => ({
  useOrders: () => ({
    useGetTodayOrders: idleQuery,
    useGetTodayOrdersByMarket: idleQuery,
    useCancelledMarkets: idleQuery,
    useCancelledOrdersByMarket: (
      _marketId: string,
      options?: { enabled?: boolean; stage?: string; start_day?: string; end_day?: string },
    ) => {
      if (options?.stage) mocks.cancelledCalls.push(options);
      return {
        status: "success",
        isSuccess: true,
        data: options?.stage ? stageResponse(options.stage) : ordersResponse(),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      };
    },
    generateCancelledMarketQr: { mutate: mocks.generateMutate, isPending: false },
    scanMarketCancelledQr: { mutate: vi.fn(), mutateAsync: mocks.scanMutateAsync, isPending: false },
    verifyMarketCancelledPin: { mutate: vi.fn(), mutateAsync: mocks.pinMutateAsync, isPending: false },
    handoverCancelledOrders: { mutate: vi.fn(), mutateAsync: mocks.handoverMutateAsync, isPending: false },
  }),
}));

vi.mock("../../../shared/lib/useOrderQrScanner", () => ({
  useOrderQrScanner: (options: ScannerOptions) => {
    mocks.scanner.current = options;
  },
}));

// Ro'yxatda yo'q kod serverdan tekshiriladi (skan auditi #37/#94) — sukut: 404 («QR topilmadi»).
vi.mock("../../scan/lib/scanResource", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../scan/lib/scanResource")>()),
  fetchScanDetail: mocks.fetchScanDetail,
}));

vi.mock("../../../shared/lib/scanner/feedback", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../shared/lib/scanner/feedback")>()),
  playScanFeedback: mocks.playScanFeedback,
}));

const staffState = (role: string) =>
  ({
    role: { id: `${role}-1`, role, region: null, name: role },
  }) as never;

const renderDetail = (preloadedState = staffState("admin")) =>
  renderWithProviders(
    <Routes>
      <Route path="/new-orders/cancelled/:marketId" element={<CancelledMarketDetail />} />
    </Routes>,
    { route: "/new-orders/cancelled/201", preloadedState },
  );

/** Hali topshirilmaganlar jadvalidagi qator (topshirilgani ro'yxatdan chiqadi). */
const pendingRow = (id: string) => {
  const table = screen.queryByRole("table", { name: "Bekor qilingan buyurtmalar" });
  return table ? within(table).queryByRole("link", { name: `№${id}` }) : null;
};
const handedTable = () => within(screen.getByTestId("handed-over-card")).getByRole("table", { name: "Topshirilgan buyurtmalar" });

/** Skaner taqlidi: `onMatch` / `onMissing` va topshirish so'rovining (`mutateAsync`) javobi kutiladi. */
const scan = async (raw: string) => {
  await act(async () => {
    const scanner = mocks.scanner.current!;
    const match = scanner.orders.find((item) => item.id === raw || `tok-${item.id}` === raw);
    if (match) scanner.onMatch(match, raw);
    else scanner.onMissing(raw);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const AUTH = { data: { authorization_token: "auth-1", remaining_seconds: 252 } };

beforeEach(() => {
  mocks.fetchScanDetail.mockReset();
  mocks.fetchScanDetail.mockRejectedValue({ response: { status: 404, data: { statusCode: 404, message: "topilmadi" } } });
});

/** Tugashini test o'zi boshqaradigan topshirish javobi («Topshirilmoqda…» holati). */
const deferred = () => {
  let resolve!: (value: unknown) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};

describe("Bekor qilinganlarni topshirish — market QR (biznes qoida)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.qrRequired.current = true;
    mocks.emptyList.current = false;
    mocks.scanner.current = null;
    mocks.handoverMutateAsync.mockReset();
    mocks.handoverMutateAsync.mockResolvedValue({ data: {} });
  });

  it("QR skanerlanmaguncha: «Market QR kerak», jo'natish tugmasi va tanlov yo'q, «QR buzilgan» o'chiq", () => {
    renderDetail();

    expect(screen.getByRole("heading", { level: 1, name: "Baraka Shop" })).toBeInTheDocument();
    expect(screen.getByText("2 ta bekor qilingan buyurtma")).toBeInTheDocument();
    expect(screen.getByText("Market QR kerak")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Topshirish uchun avval market chiqargan QR kodni skanerlang yoki PIN kodni kiriting. Keyin buyurtmalarni birma-bir skanerlang — har biri darhol marketga topshiriladi.",
      ),
    ).toBeInTheDocument();
    // Skan = topshirish: «Marketga jo'natish — N ta», tanlov belgilari va «Tanlangan buyurtmalar» qatori yo'q.
    expect(screen.queryByRole("button", { name: /Marketga jo'natish/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Tanlangan buyurtmalar" })).not.toBeInTheDocument();
    // Sahifada skan tugmasi yo'q — kamera faqat markaziy «Skaner» orqali (tizim-scanner §09).
    expect(screen.queryByRole("button", { name: "Market QR skanerlash" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bekor qilingan buyurtmalarni topshirish" })).toBeInTheDocument();
    expect(pendingRow("501")).not.toBeNull();
    // Qo'lda topshirish ham market ruxsati bilan — QR kutilayotganda o'chiq.
    for (const button of screen.getAllByRole("button", { name: "QR buzilgan" })) expect(button).toBeDisabled();
    expect(screen.getByText("USB skaner tayyor")).toBeInTheDocument();
  });

  it("⭐ market QR skanerlansa — hech narsa topshirilmaydi; taymer chiqadi, keyingi qadam aytiladi", async () => {
    mocks.scanMutateAsync.mockResolvedValue(AUTH);
    renderDetail();

    await scan("MCR-baraka-201");

    expect(mocks.scanMutateAsync).toHaveBeenCalledWith("MCR-baraka-201");
    expect(await screen.findByText("Market QR skanerlandi")).toBeInTheDocument();
    expect(screen.getByRole("timer", { name: /QR amal qilish vaqti: 4 daqiqa (12|11) soniya/ })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Endi buyurtmalarni birma-bir skanerlang — skanerlangani darhol marketga topshiriladi va ro'yxatdan chiqadi. QR muddati tugasa, uni qayta skanerlash kerak bo'ladi.",
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText("Endi buyurtmalarni skanerlang — har biri darhol topshiriladi.")).toBeInTheDocument();
    // Ilgari shu yerda marketning BARCHA bekorlari tanlanardi — endi hech biri yuborilmaydi.
    expect(mocks.handoverMutateAsync).not.toHaveBeenCalled();
    expect(pendingRow("501")).not.toBeNull();
    expect(pendingRow("502")).not.toBeNull();
    expect(screen.queryByTestId("handed-over-card")).toBeNull();
    for (const button of screen.getAllByRole("button", { name: "QR buzilgan" })) expect(button).toBeEnabled();
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("success", expect.any(String), undefined, {
      step: true,
      voice: "received",
    });
  });

  it("⭐ skan = darhol topshirish: har skan alohida so'rov (token bilan), qator «Topshirildi» ga o'tadi", async () => {
    mocks.scanMutateAsync.mockResolvedValue(AUTH);
    renderDetail();
    expect(screen.queryByTestId("handed-over-card")).toBeNull();

    await scan("MCR-baraka-201");
    await screen.findByText("Market QR skanerlandi");

    await scan("tok-501");
    expect(mocks.handoverMutateAsync).toHaveBeenCalledTimes(1);
    expect(mocks.handoverMutateAsync).toHaveBeenLastCalledWith({
      marketId: "201",
      orderIds: ["501"],
      authorizationToken: "auth-1",
      manualOverrides: [],
    });
    expect(pendingRow("501")).toBeNull();
    expect(pendingRow("502")).not.toBeNull();
    expect(screen.getByText("1 ta bekor qilingan buyurtma")).toBeInTheDocument();
    expect(within(handedTable()).getByRole("link", { name: "№501" })).toHaveAttribute("href", "/orders/edit/501");
    expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("success", "Topshirildi №501");

    await scan("tok-502");
    expect(mocks.handoverMutateAsync).toHaveBeenCalledTimes(2);
    expect(mocks.handoverMutateAsync).toHaveBeenLastCalledWith({
      marketId: "201",
      orderIds: ["502"],
      authorizationToken: "auth-1",
      manualOverrides: [],
    });
    // Ro'yxatda hech narsa qolmadi — «jo'natiladigan bekor yo'q» emas, «Hammasi topshirildi».
    expect(screen.getByText("Hammasi topshirildi")).toBeInTheDocument();
    expect(screen.getByText("Shu sahifada 2 ta buyurtma marketga topshirildi.")).toBeInTheDocument();
    expect(screen.queryByText("Bekor qilingan buyurtma yo'q")).toBeNull();

    // «Topshirildi (N)» (maket superadmin-neworders-cancelled-handover-done): yangisi tepada, usul, jami.
    const card = screen.getByTestId("handed-over-card");
    expect(within(card).getByRole("heading", { name: /Topshirildi/ })).toBeInTheDocument();
    expect(within(card).getByText("2 ta")).toBeInTheDocument();
    expect(card).toHaveTextContent("Sahifa yangilansa, ro'yxat tozalanadi");
    expect(card).toHaveTextContent(/jami 341\s000 so'm/);
    expect(within(card).getByTestId("handed-over-total-phone")).toHaveTextContent(/jami 341\s000 so'm/);
    const links = within(handedTable()).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["№502", "№501"]);
    expect(within(handedTable()).getAllByText("Marketga topshirildi")).toHaveLength(2);
    expect(within(handedTable()).getAllByText("QR orqali")).toHaveLength(2);
  });

  it("topshirilganni qayta skanerlash — «Allaqachon topshirilgan», ikkinchi so'rov yo'q", async () => {
    mocks.scanMutateAsync.mockResolvedValue(AUTH);
    renderDetail();
    await scan("MCR-baraka-201");
    await screen.findByText("Market QR skanerlandi");

    await scan("tok-501");
    await scan("tok-501");

    expect(mocks.handoverMutateAsync).toHaveBeenCalledTimes(1);
    expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("duplicate", "Allaqachon topshirilgan №501");
    expect(await screen.findByText("Allaqachon topshirilgan №501")).toBeInTheDocument();
  });

  it("so'rov ketayotganda: qatorda «Topshirilmoqda…», shu buyurtmaning takror skani yuborilmaydi, boshqasi — yuboriladi", async () => {
    mocks.scanMutateAsync.mockResolvedValue(AUTH);
    const first = deferred();
    mocks.handoverMutateAsync.mockReturnValueOnce(first.promise);
    renderDetail();
    await scan("MCR-baraka-201");
    await screen.findByText("Market QR skanerlandi");

    await scan("tok-501");
    const table = screen.getByRole("table", { name: "Bekor qilingan buyurtmalar" });
    const row = within(table).getByRole("link", { name: "№501" }).closest("tr") as HTMLElement;
    expect(within(row).getByRole("status")).toHaveTextContent("Topshirilmoqda…");
    expect(within(row).queryByRole("button", { name: "QR buzilgan" })).toBeNull();
    // Skan = topshirish: so'rov ketayotganda skaner TO'XTAMAYDI.
    expect(mocks.scanner.current!.paused).toBe(false);

    // So'rov hali ketmoqda — «Allaqachon topshirilgan» deb aytilmaydi (409/403 bilan qaytishi mumkin): ovoz yo'q,
    // neytral «Topshirilmoqda №501…», ikkinchi so'rov yo'q.
    const feedbackCalls = mocks.playScanFeedback.mock.calls.length;
    await scan("tok-501");
    expect(mocks.handoverMutateAsync).toHaveBeenCalledTimes(1);
    expect(mocks.playScanFeedback).toHaveBeenCalledTimes(feedbackCalls);
    expect(await screen.findByText("Topshirilmoqda №501…")).toBeInTheDocument();
    expect(screen.queryByText("Allaqachon topshirilgan №501")).toBeNull();

    await scan("tok-502");
    expect(mocks.handoverMutateAsync).toHaveBeenCalledTimes(2);
    expect(mocks.handoverMutateAsync).toHaveBeenLastCalledWith(expect.objectContaining({ orderIds: ["502"] }));

    await act(async () => {
      first.resolve({ data: {} });
      await first.promise;
    });
    await waitFor(() => expect(pendingRow("501")).toBeNull());
    expect(within(handedTable()).getByRole("link", { name: "№501" })).toBeInTheDocument();
  });

  it("kamera ochiq: so'rov ketayotgan buyurtma qayta skanerlansa — kamera qatorida ovozsiz «Topshirilmoqda №…»", async () => {
    mocks.scanMutateAsync.mockResolvedValue(AUTH);
    const first = deferred();
    mocks.handoverMutateAsync.mockReturnValueOnce(first.promise);
    renderDetail();
    await scan("MCR-baraka-201");
    await screen.findByText("Market QR skanerlandi");
    await scan("tok-501");

    const unmount = markScannerCameraMounted();
    try {
      await scan("tok-501");
      expect(mocks.handoverMutateAsync).toHaveBeenCalledTimes(1);
      expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("duplicate", "Topshirilmoqda №501…", undefined, {
        silent: true,
        step: true,
      });
      // Kamera ochiq — toast yo'q (natija kamera ichida).
      expect(screen.queryByText("Topshirilmoqda №501…")).toBeNull();
    } finally {
      unmount();
    }

    await act(async () => {
      first.resolve({ data: {} });
      await first.promise;
    });
    expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("success", "Topshirildi №501");
  });

  it("QR kerak, hali skanerlanmagan: buyurtma skani hech narsa yubormaydi — «Avval market QR'ini skanerlang»", async () => {
    renderDetail();

    await scan("tok-501");

    expect(mocks.handoverMutateAsync).not.toHaveBeenCalled();
    expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("error", "Avval market QR'ini skanerlang");
    expect(await screen.findByText("Avval market QR'ini skanerlang")).toBeInTheDocument();
    expect(
      screen.getByText("Market QR kodini skanerlang yoki PIN kodni kiriting, so'ng buyurtmani qayta skanerlang."),
    ).toBeInTheDocument();
    expect(pendingRow("501")).not.toBeNull();
    expect(screen.queryByTestId("handed-over-card")).toBeNull();
  });

  it("topshirish xatosi — qator ro'yxatda qoladi, xato ovozi; 403 (ruxsat tugagan) — «Market QR kerak» ga qaytadi", async () => {
    mocks.scanMutateAsync.mockResolvedValue(AUTH);
    renderDetail();
    await scan("MCR-baraka-201");
    await screen.findByText("Market QR skanerlandi");

    mocks.handoverMutateAsync.mockRejectedValueOnce({
      response: { status: 400, data: { statusCode: 400, message: "Buyurtma HQ'da turmagan" } },
    });
    await scan("tok-501");
    expect(pendingRow("501")).not.toBeNull();
    expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("error", "Buyurtma HQ'da turmagan");
    expect(await screen.findByText("№501 ni marketga topshirib bo'lmadi")).toBeInTheDocument();
    expect(screen.getByText("Market QR skanerlandi")).toBeInTheDocument();

    mocks.handoverMutateAsync.mockRejectedValueOnce({
      response: { status: 403, data: { statusCode: 403, message: "5 daqiqalik topshirish ruxsati tugagan" } },
    });
    await scan("tok-502");
    expect(pendingRow("502")).not.toBeNull();
    expect(await screen.findByText("Market QR kerak")).toBeInTheDocument();
    expect(screen.queryByText("Market QR skanerlandi")).toBeNull();

    // Ruxsat tozalandi — keyingi skan so'rov yubormaydi.
    await scan("tok-502");
    expect(mocks.handoverMutateAsync).toHaveBeenCalledTimes(2);
  });

  it("eski tokenning kechikkan 403 javobi keyin skanerlangan YANGI ruxsatni o'chirmaydi", async () => {
    mocks.scanMutateAsync
      .mockResolvedValueOnce(AUTH)
      .mockResolvedValueOnce({ data: { authorization_token: "auth-2", remaining_seconds: 300 } });
    const slow = deferred();
    mocks.handoverMutateAsync.mockReturnValueOnce(slow.promise);
    renderDetail();
    await scan("MCR-baraka-201");
    await screen.findByText("Market QR skanerlandi");

    // №501 — sekin tarmoq, javob hali yo'q (token auth-1).
    await scan("tok-501");
    // №502 — 403: auth-1 tugagan, sahifa «Market QR kerak» ga qaytadi.
    mocks.handoverMutateAsync.mockRejectedValueOnce({
      response: { status: 403, data: { statusCode: 403, message: "5 daqiqalik topshirish ruxsati tugagan" } },
    });
    await scan("tok-502");
    expect(await screen.findByText("Market QR kerak")).toBeInTheDocument();

    // Market yangi QR ko'rsatdi — auth-2.
    await scan("MCR-baraka-201-new");
    await screen.findByText("Market QR skanerlandi");

    // №501 ning kechikkan 403 javobi (auth-1) yangi ruxsatni o'chirmaydi.
    await act(async () => {
      slow.reject({
        response: { status: 403, data: { statusCode: 403, message: "5 daqiqalik topshirish ruxsati tugagan" } },
      });
      await slow.promise.catch(() => undefined);
    });
    expect(screen.getByText("Market QR skanerlandi")).toBeInTheDocument();
    expect(screen.queryByText("Market QR kerak")).toBeNull();

    mocks.handoverMutateAsync.mockResolvedValueOnce({ data: {} });
    await scan("tok-501");
    expect(mocks.handoverMutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ orderIds: ["501"], authorizationToken: "auth-2" }),
    );
  });

  it("QR ruxsati bilan «QR buzilgan» → «Qo'lda topshirish»: token va sabab bilan darhol topshiriladi", async () => {
    mocks.scanMutateAsync.mockResolvedValue(AUTH);
    const user = userEvent.setup();
    renderDetail();
    await scan("MCR-baraka-201");
    await screen.findByText("Market QR skanerlandi");

    await user.click(screen.getAllByRole("button", { name: "QR buzilgan" })[1]);
    const dialog = await screen.findByRole("dialog", { name: "QR buzilganini tasdiqlash" });
    expect(dialog).toHaveAccessibleDescription("Bu buyurtma skanerlanmasdan darhol marketga topshiriladi.");
    await user.click(within(dialog).getByRole("button", { name: "Qo'lda topshirish" }));

    expect(mocks.handoverMutateAsync).toHaveBeenCalledWith({
      marketId: "201",
      orderIds: ["502"],
      authorizationToken: "auth-1",
      manualOverrides: [{ order_id: "502", reason: "QR yirtilgan" }],
    });
    await waitFor(() => expect(pendingRow("502")).toBeNull());
    expect(screen.queryByRole("dialog", { name: "QR buzilganini tasdiqlash" })).not.toBeInTheDocument();
  });

  it("⭐ skan auditi #38: server «allaqachon topshirilgan» desa — takror ogohlantirish, qator «Topshirildi» ga", async () => {
    mocks.scanMutateAsync.mockResolvedValue(AUTH);
    mocks.handoverMutateAsync.mockResolvedValue({ data: { closed_count: 0, order_ids: [], already_handed_order_ids: ["501"] } });
    renderDetail();
    await scan("MCR-baraka-201");
    await screen.findByText("Market QR skanerlandi");

    await scan("tok-501");

    expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("duplicate", "Allaqachon topshirilgan №501");
    await waitFor(() => expect(pendingRow("501")).toBeNull());
  });

  it("⭐ skan auditi #37/#94: ro'yxatda yo'q kod — server tekshiradi: shu marketga topshirilgan → «Allaqachon topshirilgan», «QR topilmadi» emas", async () => {
    mocks.fetchScanDetail.mockResolvedValue({
      type: "order",
      data: { data: { id: "777", status: "returned_to_market", market_id: "201" } },
    });
    renderDetail();

    await scan("tok-777");

    await waitFor(() =>
      expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("duplicate", "Allaqachon topshirilgan №777"),
    );
    expect(mocks.fetchScanDetail).toHaveBeenCalledWith("tok-777", { light: true, orderOnly: true });
    expect(screen.queryByText("QR topilmadi")).not.toBeInTheDocument();
  });

  it("ro'yxatda yo'q, bekor qilingan, lekin hali shu yerda emas — «hali topshirishga tayyor emas»", async () => {
    mocks.fetchScanDetail.mockResolvedValue({
      type: "order",
      data: { data: { id: "778", status: "cancelled", market_id: "201" } },
    });
    renderDetail();

    await scan("tok-778");

    expect(await screen.findByText("№778 hali topshirishga tayyor emas")).toBeInTheDocument();
  });

  it("tekshiruv tarmoq xatosi — «Tekshirib bo'lmadi», «QR topilmadi» emas", async () => {
    mocks.fetchScanDetail.mockRejectedValue({ code: "ERR_NETWORK" });
    renderDetail();

    await scan("tok-779");

    expect(await screen.findByText("Tekshirib bo'lmadi — qayta skanerlang")).toBeInTheDocument();
    expect(screen.queryByText("QR topilmadi")).not.toBeInTheDocument();
  });

  it("skan auditi #42: market QR tekshirilayotganda kelgan skan jim yo'qolmaydi", () => {
    renderDetail();

    act(() => mocks.scanner.current!.onPausedScan?.("tok-501", "keyboard"));

    expect(mocks.playScanFeedback).toHaveBeenLastCalledWith(
      "error",
      "Market ruxsati tekshirilmoqda — bir oz kutib qayta skanerlang",
    );
  });

  it("market QR rad etilsa — «Market QR rad etildi», XATO ovozi («Bu ro'yxatda yo'q» emas), token yo'q", async () => {
    mocks.scanMutateAsync.mockRejectedValue({
      response: { status: 400, data: { statusCode: 400, message: "QR muddati tugagan" } },
    });
    renderDetail();

    await scan("MCR-boshqa");

    expect(await screen.findByText("Market QR rad etildi")).toBeInTheDocument();
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("error", "QR muddati tugagan");
    expect(mocks.playScanFeedback).not.toHaveBeenCalledWith("missing", expect.anything());
    expect(screen.getByText("Market QR kerak")).toBeInTheDocument();
  });
});

describe("Bekor qilinganlarni topshirish — kamera (markaziy «Skaner» tugmasi)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.qrRequired.current = true;
    mocks.scanner.current = null;
    mocks.handoverMutateAsync.mockReset();
    mocks.handoverMutateAsync.mockResolvedValue({ data: {} });
  });

  it("sahifada skan tugmasi yo'q: v1 «Kamera» ham, sarlavhadagi «Market QR skanerlash» ham", () => {
    renderDetail();

    expect(screen.queryByRole("button", { name: "Kamera" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Kamera bilan skanerlash/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Market QR skanerlash" })).not.toBeInTheDocument();
  });

  it("market QR qabul qilingach shu QR yana o'qilsa — ikkinchi so'rov yo'q, ruxsat saqlanadi va skan topshiradi", async () => {
    mocks.scanMutateAsync.mockResolvedValueOnce(AUTH);
    // Backend ikkinchi foydalanishni rad etadi — so'rov ketsa, ruxsat o'chib ketardi.
    mocks.scanMutateAsync.mockRejectedValue(new Error("QR allaqachon ishlatilgan"));
    renderDetail();

    await scan("MCR-baraka-201");
    expect(await screen.findByText("Market QR skanerlandi")).toBeInTheDocument();

    await scan("MCR-baraka-201");

    expect(mocks.scanMutateAsync).toHaveBeenCalledTimes(1);
    expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("duplicate", "Market QR allaqachon qabul qilingan");
    expect(screen.getByText("Market QR skanerlandi")).toBeInTheDocument();
    await scan("tok-501");
    expect(mocks.handoverMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ authorizationToken: "auth-1" }));
  });

  it("maqsad matni holatga qarab: «Market QR skanerlash» → QR'dan keyin «Marketga topshirish · QR 04:12»", async () => {
    mocks.scanMutateAsync.mockResolvedValue(AUTH);
    renderDetail();

    const before = mocks.scanner.current!;
    expect(before.paused).toBe(false);
    expect(before.camera).toMatchObject({
      id: "cancelled-handover:201",
      title: "Market QR skanerlash",
      context: "Baraka Shop · 2 ta buyurtma",
      hint: "Market QR kodini ramka ichiga olib keling",
      note: { title: "Faqat Baraka Shop QR kodi" },
    });
    expect(before.camera?.finish).toBeUndefined();

    await scan("MCR-baraka-201");

    const afterQr = mocks.scanner.current!.camera!;
    expect(afterQr.id).toBe("cancelled-handover:201");
    expect(afterQr.title).toBe("Marketga topshirish");
    expect(afterQr.context).toBe("Baraka Shop · 2 ta qoldi");
    expect(afterQr.hint).toMatch(/^Buyurtmalarni skanerlang · QR 04:1\d amal qiladi$/);
    expect(afterQr.note?.title).toBe("Buyurtma QR kodini skanerlang — u darhol topshiriladi");
    // Market QR hech narsani topshirmaydi — hisoblagich 0 dan.
    expect(afterQr.progress).toMatchObject({ done: 0, total: 2, label: "ta topshirildi" });
    expect(afterQr.finish).toMatchObject({ label: "Tugatish" });
    expect(afterQr.listTitle).toBe("Topshirilganlar");
    expect(afterQr.list).toEqual([]);

    await scan("tok-501");
    await scan("tok-502");
    const after = mocks.scanner.current!.camera!;
    expect(after.progress).toMatchObject({ done: 2, total: 2 });
    expect(after.context).toBe("Baraka Shop · 0 ta qoldi");
    // Yangisi tepada; «Bekor qilish» yo'q — topshirish server amali, qaytarilmaydi.
    expect(after.list?.map((item) => item.key)).toEqual(["502", "501"]);
    expect(after.list?.every((item) => item.onUndo === undefined)).toBe(true);
    // Topshirilganlar skaner ro'yxatida qoladi — takror skan «Bu ro'yxatda yo'q» emas, «Allaqachon topshirilgan».
    expect([...mocks.scanner.current!.orders.map((item) => item.id)].sort()).toEqual(["501", "502"]);
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("success", "Market QR qabul qilindi", undefined, {
      step: true,
      voice: "received",
    });
  });
});

describe("Bekor qilinganlarni topshirish — skaner (QR talab qilinmaydi)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.qrRequired.current = false;
    mocks.handoverMutateAsync.mockReset();
    mocks.handoverMutateAsync.mockResolvedValue({ data: {} });
  });

  it("«Market QR talab qilinmaydi»: skan tokensiz darhol topshiradi, takror — ogohlantirish, notanish — «QR topilmadi»", async () => {
    renderDetail();

    expect(screen.getByText("Market QR talab qilinmaydi")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Market QR skanerlash" })).not.toBeInTheDocument();
    for (const button of screen.getAllByRole("button", { name: "QR buzilgan" })) expect(button).toBeEnabled();

    await scan("tok-501");
    expect(mocks.handoverMutateAsync).toHaveBeenCalledWith({
      marketId: "201",
      orderIds: ["501"],
      authorizationToken: undefined,
      manualOverrides: [],
    });
    expect(pendingRow("501")).toBeNull();
    const row = within(handedTable()).getByRole("link", { name: "№501" }).closest("tr") as HTMLElement;
    expect(row).toHaveTextContent("QR'siz (market sozlamasi)");

    await scan("tok-501");
    expect(mocks.handoverMutateAsync).toHaveBeenCalledTimes(1);
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("duplicate", "Allaqachon topshirilgan №501");

    await scan("nomalum-qr-123");
    await waitFor(() =>
      expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("missing", "Bu marketning bekorlarida yo'q"),
    );
    expect(await screen.findByText("QR topilmadi")).toBeInTheDocument();
  });

  it("QR buzilgan: oyna → «Qo'lda topshirish» — sabab enum kodi bilan, «Qo'lda tasdiq — Yorliq yo'qolgan»", async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getAllByRole("button", { name: "QR buzilgan" })[1]);
    const dialog = await screen.findByRole("dialog", { name: "QR buzilganini tasdiqlash" });
    expect(within(dialog).getByText("Dilfuza Hasanova")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("radio", { name: "Yorliq yo'qolgan" }));
    await user.click(within(dialog).getByRole("button", { name: "Qo'lda topshirish" }));

    expect(mocks.handoverMutateAsync).toHaveBeenCalledWith({
      marketId: "201",
      orderIds: ["502"],
      authorizationToken: undefined,
      manualOverrides: [{ order_id: "502", reason: "Label yo'qolgan" }],
    });
    expect(await screen.findByText("Buyurtma qo'lda topshirildi")).toBeInTheDocument();
    expect(screen.getByText("#502 · Yorliq yo'qolgan")).toBeInTheDocument();
    expect(pendingRow("502")).toBeNull();
    const row = within(handedTable()).getByRole("link", { name: "№502" }).closest("tr") as HTMLElement;
    expect(row).toHaveTextContent("Qo'lda tasdiq — Yorliq yo'qolgan");
    // Qo'lda topshirilgani skanerlansa ham — «Allaqachon topshirilgan».
    await scan("tok-502");
    expect(mocks.handoverMutateAsync).toHaveBeenCalledTimes(1);
  });

  it("«Bekor qilish» — oyna yopiladi, hech narsa yuborilmaydi", async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getAllByRole("button", { name: "QR buzilgan" })[0]);
    const dialog = await screen.findByRole("dialog", { name: "QR buzilganini tasdiqlash" });
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));

    expect(screen.queryByRole("dialog", { name: "QR buzilganini tasdiqlash" })).not.toBeInTheDocument();
    expect(mocks.handoverMutateAsync).not.toHaveBeenCalled();
    expect(pendingRow("501")).not.toBeNull();
  });
});

describe("Bekor qilinganlarni topshirish — 6 xonali kod (zkRab9M2, maket superadmin-neworders-cancelled-pin-dialog)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.qrRequired.current = true;
    mocks.emptyList.current = false;
    mocks.scanner.current = null;
    mocks.handoverMutateAsync.mockReset();
    mocks.handoverMutateAsync.mockResolvedValue({ data: {} });
  });

  /** Backend kod xatosi (axios shakli): 400 + `data.reason` (+ qolgan urinishlar). */
  const pinError = (reason: string, remaining?: number) => ({
    response: {
      status: 400,
      data: {
        statusCode: 400,
        message: "Kod noto‘g‘ri",
        data: {
          reason,
          ...(remaining === undefined ? {} : { details: { remaining_attempts: remaining, max_attempts: 5 } }),
        },
      },
    },
  });

  const openPin = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: "PIN kodni kiritish" }));
    return screen.findByRole("dialog", { name: "Market PIN kodi" });
  };

  /**
   * Odam: tugmalar orasida skaner oralig'idan ko'p (`SCANNER_KEY_GAP_MS`) — harf aralashgan kod ham skan emas.
   * USB skaner: belgilar kutishsiz (`delay: null`), oxirida Enter — maydonga xuddi skaner kabi yoziladi.
   */
  const humanUser = () => userEvent.setup({ delay: SCANNER_KEY_GAP_MS + 40 });
  const scannerUser = () => userEvent.setup({ delay: null });
  const MARKET_QR = "MCR-Jx3gQo9_kGb2Vt-og7q4Lw0zgOaY1sNcE8hRuFb5d";

  it("«Market QR kerak» holatida «PIN kodni kiritish» → oyna: fokus maydonda, raqamli klaviatura, skaner to'xtaydi", async () => {
    const user = userEvent.setup();
    renderDetail();
    expect(mocks.scanner.current!.paused).toBe(false);

    const dialog = await openPin(user);
    expect(dialog).toHaveAccessibleDescription(/Baraka Shop · QR o'qilmasa, market QR oynasidagi PIN bilan tasdiqlang\./);
    // USB skaner (klaviatura) bu oynani tinglamaydi: 6 raqam + Enter buyurtma skani emas.
    expect(dialog.closest("[data-scanner-ignore]")).not.toBeNull();
    expect(mocks.scanner.current!.paused).toBe(true);

    const input = within(dialog).getByRole("textbox", { name: /6 xonali PIN/ });
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("autocomplete", "one-time-code");
    expect(input).toHaveAttribute("maxlength", "6");
    expect(input).toHaveAccessibleDescription("Market vakili telefonidagi QR ostida ko'rsatilgan kod.");
    expect(within(dialog).getByText("5 marta noto'g'ri kiritilsa, sessiya bloklanadi — market yangi QR chiqaradi.")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    expect(screen.queryByRole("dialog", { name: "Market PIN kodi" })).not.toBeInTheDocument();
    expect(mocks.scanner.current!.paused).toBe(false);
    expect(mocks.pinMutateAsync).not.toHaveBeenCalled();
  });

  it("⭐ to'g'ri kod — QR skani bilan bir xil: hech narsa topshirilmaydi, taymer; skan token bilan topshiradi, usul «Parol orqali»", async () => {
    mocks.pinMutateAsync.mockResolvedValue({
      data: { market_id: "201", authorized: true, authorization_token: "auth-pin", remaining_seconds: 300, method: "pin" },
    });
    const user = humanUser();
    renderDetail();

    const dialog = await openPin(user);
    await user.type(within(dialog).getByRole("textbox", { name: /6 xonali PIN/ }), "04 29-17x9{Enter}");

    expect(mocks.pinMutateAsync).toHaveBeenCalledTimes(1);
    expect(mocks.pinMutateAsync).toHaveBeenCalledWith({ marketId: "201", pin: "042917" });
    expect(mocks.scanMutateAsync).not.toHaveBeenCalled();
    expect(await screen.findByText("Market PIN kodi tasdiqlandi")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Market PIN kodi" })).not.toBeInTheDocument();
    expect(await screen.findByText("PIN kod qabul qilindi")).toBeInTheDocument();
    expect(screen.getByRole("timer", { name: /QR amal qilish vaqti: (5 daqiqa 0|4 daqiqa 59) soniya/ })).toBeInTheDocument();
    // Ilgari kod qabul qilingach marketning BARCHA bekorlari tanlanardi — endi hech biri yuborilmaydi.
    expect(mocks.handoverMutateAsync).not.toHaveBeenCalled();
    expect(pendingRow("501")).not.toBeNull();
    expect(pendingRow("502")).not.toBeNull();
    // Kod ruxsati olingach — «PIN kodni kiritish» yo'q (holat «skanerlandi»).
    expect(screen.queryByRole("button", { name: "PIN kodni kiritish" })).not.toBeInTheDocument();
    expect(mocks.scanner.current!.paused).toBe(false);

    await scan("tok-502");
    await scan("tok-501");
    expect(mocks.handoverMutateAsync).toHaveBeenNthCalledWith(1, {
      marketId: "201",
      orderIds: ["502"],
      authorizationToken: "auth-pin",
      manualOverrides: [],
    });
    expect(mocks.handoverMutateAsync).toHaveBeenNthCalledWith(2, expect.objectContaining({ orderIds: ["501"], authorizationToken: "auth-pin" }));
    expect(pendingRow("501")).toBeNull();
    expect(pendingRow("502")).toBeNull();
    expect(within(handedTable()).getAllByText("Parol orqali")).toHaveLength(2);
  });

  it("noto'g'ri kod — maydon ostida qolgan urinishlar, oyna ochiq, ruxsat yo'q; yozilsa xato yo'qoladi", async () => {
    mocks.pinMutateAsync.mockRejectedValue(pinError("market_cancelled_pin_invalid", 3));
    const user = userEvent.setup();
    renderDetail();

    const dialog = await openPin(user);
    const input = within(dialog).getByRole("textbox", { name: /6 xonali PIN/ });
    await user.type(input, "111111");
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    expect(await within(dialog).findByText("Kod noto'g'ri — yana 3 ta urinish qoldi")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("dialog", { name: "Market PIN kodi" })).toBeInTheDocument();
    expect(screen.getByText("Market QR kerak")).toBeInTheDocument();
    expect(pendingRow("501")).not.toBeNull();

    await user.type(input, "{Backspace}");
    expect(within(dialog).queryByText(/Kod noto'g'ri/)).not.toBeInTheDocument();
  });

  it("5-xato / blok — «market yangi QR chiqarsin»; muddat tugagan va faol QR yo'q — o'z matni", async () => {
    const user = userEvent.setup();
    renderDetail();
    const dialog = await openPin(user);
    const input = within(dialog).getByRole("textbox", { name: /6 xonali PIN/ });
    const submit = within(dialog).getByRole("button", { name: "Tasdiqlash" });

    const cases: Array<[unknown, string]> = [
      [pinError("market_cancelled_pin_blocked", 0), "5 marta xato kiritildi — market yangi QR chiqarsin"],
      [pinError("market_cancelled_pin_invalid", 0), "5 marta xato kiritildi — market yangi QR chiqarsin"],
      [pinError("market_cancelled_pin_expired"), "Kod muddati tugagan — market yangi QR chiqarsin"],
      [pinError("market_cancelled_pin_not_found"), "Marketda faol QR yo'q — market QR oynasini qayta ochsin"],
    ];
    for (const [error, text] of cases) {
      mocks.pinMutateAsync.mockRejectedValueOnce(error);
      await user.clear(input);
      await user.type(input, "123456");
      await user.click(submit);
      expect(await within(dialog).findByText(text)).toBeInTheDocument();
    }
    expect(screen.getByText("Market QR kerak")).toBeInTheDocument();
  });

  it("to'liq bo'lmagan kod — so'rov ketmaydi, «6 ta raqamni kiriting»", async () => {
    const user = userEvent.setup();
    renderDetail();
    const dialog = await openPin(user);

    await user.type(within(dialog).getByRole("textbox", { name: /6 xonali PIN/ }), "1234{Enter}");

    expect(await within(dialog).findByText("6 ta raqamni kiriting")).toBeInTheDocument();
    expect(mocks.pinMutateAsync).not.toHaveBeenCalled();
  });

  it("⭐ oyna ochiq paytda USB skaner market QR'ini yozsa — kod yuborilmaydi (urinish yeyilmaydi), QR skani bo'ladi", async () => {
    mocks.scanMutateAsync.mockResolvedValue({ data: { authorization_token: "auth-1", remaining_seconds: 252 } });
    const user = scannerUser();
    renderDetail();

    const dialog = await openPin(user);
    // Token ichida 6+ raqam bor: ilgari maydon ularni «kod» qilib, skaner Enter'i bilan yuborardi.
    await user.type(within(dialog).getByRole("textbox", { name: /6 xonali PIN/ }), `${MARKET_QR}{Enter}`);

    expect(mocks.pinMutateAsync).not.toHaveBeenCalled();
    expect(mocks.scanMutateAsync).toHaveBeenCalledTimes(1);
    expect(mocks.scanMutateAsync).toHaveBeenCalledWith(MARKET_QR);
    expect(screen.queryByRole("dialog", { name: "Market PIN kodi" })).not.toBeInTheDocument();
    expect(await screen.findByText("Market QR skanerlandi")).toBeInTheDocument();
    expect(mocks.handoverMutateAsync).not.toHaveBeenCalled();
    expect(pendingRow("501")).not.toBeNull();
  });

  it("oyna ochiq paytda boshqa skan (buyurtma QR'i) — kod yuborilmaydi, maydon tozalanadi, xato maydon ostida", async () => {
    const user = scannerUser();
    renderDetail();

    const dialog = await openPin(user);
    const input = within(dialog).getByRole("textbox", { name: /6 xonali PIN/ });
    await user.type(input, "6a1f0c9e2b7d4835a0c1e9f2{Enter}");

    expect(mocks.pinMutateAsync).not.toHaveBeenCalled();
    expect(mocks.scanMutateAsync).not.toHaveBeenCalled();
    expect(within(dialog).getByText("Skanerlangan kod PIN emas — 6 xonali kodni qo'lda yozing")).toBeInTheDocument();
    expect(input).toHaveValue("");
    expect(screen.getByRole("dialog", { name: "Market PIN kodi" })).toBeInTheDocument();
  });

  it("noto'g'ri koddan keyin fokus «Tasdiqlash» da — skaner Enter'i o'sha kodni qayta yubormaydi, QR skani bo'ladi", async () => {
    mocks.pinMutateAsync.mockRejectedValue(pinError("market_cancelled_pin_invalid", 4));
    mocks.scanMutateAsync.mockResolvedValue({ data: { authorization_token: "auth-1", remaining_seconds: 252 } });
    const user = scannerUser();
    renderDetail();

    const dialog = await openPin(user);
    await humanUser().type(within(dialog).getByRole("textbox", { name: /6 xonali PIN/ }), "111111");
    const submit = within(dialog).getByRole("button", { name: "Tasdiqlash" });
    await user.click(submit);
    expect(await within(dialog).findByText("Kod noto'g'ri — yana 4 ta urinish qoldi")).toBeInTheDocument();
    expect(submit).toHaveFocus();

    await user.keyboard(`${MARKET_QR}{Enter}`);

    expect(mocks.pinMutateAsync).toHaveBeenCalledTimes(1);
    expect(mocks.scanMutateAsync).toHaveBeenCalledWith(MARKET_QR);
    expect(screen.queryByRole("dialog", { name: "Market PIN kodi" })).not.toBeInTheDocument();
    expect(await screen.findByText("Market QR skanerlandi")).toBeInTheDocument();
  });

  it("raqamni bosib turish (avtotakror) — skan emas: kod yuboriladi", async () => {
    mocks.pinMutateAsync.mockRejectedValue(pinError("market_cancelled_pin_invalid", 4));
    const user = humanUser();
    renderDetail();

    const dialog = await openPin(user);
    const input = within(dialog).getByRole("textbox", { name: /6 xonali PIN/ });
    await user.type(input, "000000");
    // «0» ni ushlab turish: OS avtotakrori ~30 ms oraliqda (skaner tezligida), `repeat: true`.
    for (let index = 0; index < 10; index += 1) fireEvent.keyDown(input, { key: "0", code: "Digit0", repeat: true });
    await user.keyboard("{Enter}");

    expect(mocks.pinMutateAsync).toHaveBeenCalledWith({ marketId: "201", pin: "000000" });
    expect(within(dialog).queryByText("Skanerlangan kod PIN emas — 6 xonali kodni qo'lda yozing")).not.toBeInTheDocument();
  });

  it("skanerlangan 6 raqam (yoki tez yozilgan raqamlar) — kod sifatida yuboriladi", async () => {
    mocks.pinMutateAsync.mockRejectedValue(pinError("market_cancelled_pin_invalid", 4));
    const user = scannerUser();
    renderDetail();

    const dialog = await openPin(user);
    await user.type(within(dialog).getByRole("textbox", { name: /6 xonali PIN/ }), "042917{Enter}");

    expect(mocks.pinMutateAsync).toHaveBeenCalledWith({ marketId: "201", pin: "042917" });
    expect(await within(dialog).findByText("Kod noto'g'ri — yana 4 ta urinish qoldi")).toBeInTheDocument();
  });

  it("QR talab qilinmaydigan marketda — «PIN kodni kiritish» yo'q", () => {
    mocks.qrRequired.current = false;
    renderDetail();

    expect(screen.getByText("Market QR talab qilinmaydi")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "PIN kodni kiritish" })).not.toBeInTheDocument();
  });
});

describe("Bekor qilinganlar — market roli", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.emptyList.current = false;
    mocks.cancelledCalls.length = 0;
  });

  const marketState = (qrRequired?: boolean) =>
    ({
      role: { id: "201", role: "market", region: null, name: "Baraka Shop" },
      user: {
        user: { id: "201", role: "market", cancelled_handover_qr_required: qrRequired },
        isAuthenticated: true,
        accessToken: null,
        loading: false,
        isAppInitializing: false,
        error: null,
      },
    }) as never;

  it("o'z ro'yxati, skaner yo'q; «Qabul qilish» → QR oynasi", async () => {
    mocks.generateMutate.mockImplementation((_marketId: string, options: { onSuccess: (r: unknown) => void }) =>
      options.onSuccess({ data: { token: "MCR-201-xyz" } }),
    );
    const user = userEvent.setup();
    renderDetail(marketState());

    expect(screen.getByRole("heading", { name: "Bekor qilingan buyurtmalarni pochtaga topshirish" })).toBeInTheDocument();
    expect(screen.getByText("QR chiqarishga tayyor")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Marketga jo'natish/ })).not.toBeInTheDocument();
    expect(mocks.scanner.current?.enabled).toBe(false);

    await user.click(screen.getByRole("button", { name: "Qabul qilish" }));
    expect(mocks.generateMutate).toHaveBeenCalledWith("201", expect.any(Object));
    const dialog = await screen.findByRole("dialog", { name: "Bekor qilingan buyurtmalar QR kodi" });
    expect(within(dialog).getByRole("img", { name: "Bekor qilingan buyurtmalarni topshirish QR kodi" })).toBeInTheDocument();
  });

  it("bekor buyurtma yo'q bo'lsa ham «Qabul qilish» yoqiq — QR chiqadi (qaytarishni «Marketga topshirildi» uchun)", async () => {
    mocks.emptyList.current = true;
    mocks.generateMutate.mockImplementation((_marketId: string, options: { onSuccess: (r: unknown) => void }) =>
      options.onSuccess({ data: { token: "MCR-201-xyz" } }),
    );
    const user = userEvent.setup();
    renderDetail(marketState());

    expect(await screen.findByText("Bekor qilingan buyurtma yo'q")).toBeInTheDocument();
    const receive = screen.getByRole("button", { name: "Qabul qilish" });
    expect(receive).toBeEnabled();
    await user.click(receive);
    expect(mocks.generateMutate).toHaveBeenCalledWith("201", expect.any(Object));
    expect(await screen.findByRole("dialog", { name: "Bekor qilingan buyurtmalar QR kodi" })).toBeInTheDocument();
  });

  it("zkRab9M2: QR oynasida 6 xonali kod — «042 917», ekran o'quvchiga raqamlar alohida, amal qilish vaqti", async () => {
    mocks.generateMutate.mockImplementation((_marketId: string, options: { onSuccess: (r: unknown) => void }) =>
      options.onSuccess({
        data: {
          market_id: "201",
          qr_token: "MCR-201-xyz",
          qr_ttl_seconds: 120,
          qr_expires_at: "2026-10-25T10:02:00.000Z",
          pin: "042917",
          pin_expires_at: "2026-10-25T10:02:00.000Z",
          pin_max_attempts: 5,
        },
      }),
    );
    const user = userEvent.setup();
    renderDetail(marketState());

    await user.click(screen.getByRole("button", { name: "Qabul qilish" }));
    const dialog = await screen.findByRole("dialog", { name: "Bekor qilingan buyurtmalar QR kodi" });
    expect(within(dialog).getByRole("img", { name: "Bekor qilingan buyurtmalarni topshirish QR kodi" })).toBeInTheDocument();
    const block = within(dialog).getByTestId("market-qr-pin");
    expect(within(block).getByText("QR o'qilmasa — PIN kod")).toBeInTheDocument();
    expect(within(block).getByTestId("market-qr-pin-value")).toHaveTextContent("042 917");
    expect(within(block).getByText("PIN kod: 0 4 2 9 1 7")).toBeInTheDocument();
    expect(await within(block).findByRole("timer", { name: /Kod amal qilish vaqti: (2 daqiqa 0|1 daqiqa 59) soniya/ })).toHaveTextContent(
      /0[12]:[0-5]\d amal qiladi/,
    );
  });

  it("zkRab9M2: eski backend (kodsiz QR) — kod bloki yo'q", async () => {
    mocks.generateMutate.mockImplementation((_marketId: string, options: { onSuccess: (r: unknown) => void }) =>
      options.onSuccess({ data: { token: "MCR-201-xyz" } }),
    );
    const user = userEvent.setup();
    renderDetail(marketState());

    await user.click(screen.getByRole("button", { name: "Qabul qilish" }));
    const dialog = await screen.findByRole("dialog", { name: "Bekor qilingan buyurtmalar QR kodi" });
    expect(within(dialog).queryByTestId("market-qr-pin")).toBeNull();
  });

  it("vOczoOUE 2-bosqich: «Olib ketishga tayyor · Yo'lda · Olganlarim» — sonlar, `stage` so'rovlari, bosqich va joy", async () => {
    const user = userEvent.setup();
    renderDetail(marketState());

    const tabs = screen.getByRole("group", { name: "Bekor qilinganlar bosqichi" });
    const chip = (name: RegExp) => within(tabs).getByRole("button", { name });
    expect(chip(/Olib ketishga tayyor/)).toHaveAttribute("aria-pressed", "true");
    expect(chip(/Olib ketishga tayyor/)).toHaveTextContent("Olib ketishga tayyor2");
    expect(chip(/Yo'lda/)).toHaveTextContent("Yo'lda2");
    expect(chip(/Olganlarim/)).toHaveTextContent("Olganlarim1");
    // So'rovlar: «Yo'lda» — hali HQ'ga yetmaganlar, «Olganlarim» — shu oy topshirilganlar.
    expect(mocks.cancelledCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: "courier,in_transit,branch" }),
        expect.objectContaining({ stage: "market", start_day: expect.stringMatching(/^\d{4}-\d{2}-01$/) }),
      ]),
    );

    await user.click(chip(/Yo'lda/));
    expect(chip(/Yo'lda/)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Yo'ldagi bekor buyurtmalar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Qabul qilish" })).not.toBeInTheDocument();
    const transit = screen.getByTestId("market-returns-transit");
    expect(within(transit).getAllByText("Bekor · kuryerda").length).toBeGreaterThan(0);
    expect(within(transit).getAllByText("Akmal Rahimov").length).toBeGreaterThan(0);
    expect(within(transit).getAllByText("Bekor · filialda").length).toBeGreaterThan(0);
    const age = within(transit).getAllByTestId("cancel-return-age")[0];
    expect(age).toHaveTextContent("4 kun");
    expect(age.dataset.level).toBe("warn");

    await user.click(chip(/Olganlarim/));
    expect(screen.getByRole("heading", { name: "Olgan bekor buyurtmalaringiz" })).toBeInTheDocument();
    const received = screen.getByTestId("market-returns-received");
    expect(within(received).getAllByText("Samarqand filiali").length).toBeGreaterThan(0);
    expect(within(received).getAllByText("QR orqali").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Olingan sana oralig'i/ })).toBeInTheDocument();

    await user.click(chip(/Olib ketishga tayyor/));
    expect(screen.getByRole("button", { name: "Qabul qilish" })).toBeInTheDocument();
  });

  it("marketda QR o'chirilgan bo'lsa — «Qabul qilish» yo'q", () => {
    renderDetail(marketState(false));

    expect(screen.getByRole("heading", { name: "Market QR talab qilinmaydi" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Qabul qilish" })).not.toBeInTheDocument();
  });
});
