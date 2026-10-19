import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import CancelledMarketDetail from "./detail";

/**
 * Bekor qilinganlarni marketga topshirish (dizayn v2) — biznes qoida o'zgarmaganini tekshiradi:
 * market QR skanerlanmaguncha jo'natilmaydi; skanerlansa barcha bekorlar tanlanadi va token yuboriladi;
 * buyurtma QR skani — tanlov, takror — ogohlantirish, notanish — «QR topilmadi»; market roli — o'z QR kodi.
 */

type ScannerOptions = {
  orders: { id: string }[];
  enabled?: boolean;
  onMatch: (order: { id: string }, raw: string) => void;
  onMissing: (raw: string) => void;
};

const mocks = vi.hoisted(() => ({
  handoverMutate: vi.fn(),
  scanMutateAsync: vi.fn(),
  generateMutate: vi.fn(),
  playScanFeedback: vi.fn(),
  playMissingOrderFeedback: vi.fn(),
  scanner: { current: null as ScannerOptions | null },
  qrRequired: { current: true as boolean | undefined },
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
  const key = String(mocks.qrRequired.current);
  if (!responses.has(key)) {
    responses.set(key, { data: [order("501", "Malika Yusupova", 96000), order("502", "Dilfuza Hasanova", 245000)] });
  }
  return responses.get(key);
};

const idleQuery = () => ({ status: "pending", data: undefined, isLoading: false, isError: false, refetch: vi.fn() });

vi.mock("../../../entities/orders", () => ({
  useOrders: () => ({
    useGetTodayOrders: idleQuery,
    useGetTodayOrdersByMarket: idleQuery,
    useCancelledMarkets: idleQuery,
    useCancelledOrdersByMarket: () => ({
      status: "success",
      isSuccess: true,
      data: ordersResponse(),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
    generateCancelledMarketQr: { mutate: mocks.generateMutate, isPending: false },
    scanMarketCancelledQr: { mutate: vi.fn(), mutateAsync: mocks.scanMutateAsync, isPending: false },
    handoverCancelledOrders: { mutate: mocks.handoverMutate, isPending: false },
  }),
}));

vi.mock("../../../shared/lib/useOrderQrScanner", () => ({
  useOrderQrScanner: (options: ScannerOptions) => {
    mocks.scanner.current = options;
  },
}));

vi.mock("../../../shared/lib/scanner/feedback", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../shared/lib/scanner/feedback")>()),
  playScanFeedback: mocks.playScanFeedback,
  playMissingOrderFeedback: mocks.playMissingOrderFeedback,
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

const scan = async (raw: string) => {
  await act(async () => {
    const scanner = mocks.scanner.current!;
    const match = scanner.orders.find((item) => item.id === raw || `tok-${item.id}` === raw);
    if (match) scanner.onMatch(match, raw);
    else scanner.onMissing(raw);
  });
};

describe("Bekor qilinganlarni topshirish — market QR (biznes qoida)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.qrRequired.current = true;
    mocks.scanner.current = null;
  });

  it("QR skanerlanmaguncha: «Market QR kerak», jo'natish o'chirilgan, hech narsa tanlanmagan", () => {
    renderDetail();

    expect(screen.getByRole("heading", { level: 1, name: "Baraka Shop" })).toBeInTheDocument();
    expect(screen.getByText("2 ta bekor qilingan buyurtma")).toBeInTheDocument();
    expect(screen.getByText("Market QR kerak")).toBeInTheDocument();
    const send = screen.getByRole("button", { name: "Marketga jo'natish" });
    expect(send).toBeDisabled();
    expect(send).toHaveAccessibleDescription(/Jo'natish uchun avval market chiqargan QR kodni skanerlang/);
    expect(screen.getByRole("button", { name: "Market QR skanerlash" })).toBeInTheDocument();
    const region = screen.getByRole("region", { name: "Tanlangan buyurtmalar" });
    expect(within(region).getByText("Hali buyurtma tanlanmagan")).toBeInTheDocument();
    // Maket `*-scanner-dialog`: tanlov yo'q — kulrang (`sunken`) qator, ko'k emas (ko'k faqat tanlov bo'lsa).
    expect(region).toHaveClass("bg-sunken");
    expect(region).not.toHaveClass("bg-action-soft");
    expect(screen.getByRole("checkbox", { name: "№501 ni qo'lda tanlash" })).not.toBeChecked();
    expect(screen.getByText("USB skaner tayyor")).toBeInTheDocument();
  });

  it("market QR skanerlansa — barcha bekorlar tanlanadi, taymer chiqadi, token bilan jo'natiladi", async () => {
    mocks.scanMutateAsync.mockResolvedValue({ data: { authorization_token: "auth-1", remaining_seconds: 252 } });
    const user = userEvent.setup();
    renderDetail();

    await scan("MCR-baraka-201");

    expect(mocks.scanMutateAsync).toHaveBeenCalledWith("MCR-baraka-201");
    expect(await screen.findByText("Market QR skanerlandi")).toBeInTheDocument();
    expect(screen.getByRole("timer", { name: /QR amal qilish vaqti: 4 daqiqa (12|11) soniya/ })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "№501 ni tanlovdan chiqarish" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "№502 ni tanlovdan chiqarish" })).toBeChecked();
    const selectedRegion = screen.getByRole("region", { name: "Tanlangan buyurtmalar" });
    expect(within(selectedRegion).getByText("2 ta buyurtma tanlandi")).toBeInTheDocument();
    expect(selectedRegion).toHaveClass("bg-action-soft");
    expect(screen.queryByRole("button", { name: "Market QR skanerlash" })).not.toBeInTheDocument();
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("success");

    await user.click(screen.getByRole("button", { name: "Marketga jo'natish — 2 ta" }));
    expect(mocks.handoverMutate).toHaveBeenCalledWith(
      { marketId: "201", orderIds: ["501", "502"], authorizationToken: "auth-1", manualOverrides: [] },
      expect.any(Object),
    );
  });

  it("market QR rad etilsa — «QR topilmadi», xato ovozi, tanlov va token yo'q", async () => {
    mocks.scanMutateAsync.mockRejectedValue(new Error("network"));
    renderDetail();

    await scan("MCR-boshqa");

    expect(await screen.findByText("QR topilmadi")).toBeInTheDocument();
    expect(mocks.playMissingOrderFeedback).toHaveBeenCalled();
    expect(screen.getByText("Market QR kerak")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marketga jo'natish" })).toBeDisabled();
  });

  it("QR kerak bo'lsa: buyurtma QR skani tanlaydi, lekin market QR'siz jo'natib bo'lmaydi", async () => {
    renderDetail();

    await scan("tok-501");

    expect(screen.getByRole("checkbox", { name: "№501 ni tanlovdan chiqarish" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Marketga jo'natish — 1 ta" })).toBeDisabled();
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("success");
  });
});

describe("Bekor qilinganlarni topshirish — skaner (QR talab qilinmaydi)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.qrRequired.current = false;
  });

  it("«Market QR talab qilinmaydi»: skan tanlaydi, takror — ogohlantirish, notanish — «QR topilmadi»", async () => {
    const user = userEvent.setup();
    renderDetail();

    expect(screen.getByText("Market QR talab qilinmaydi")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Market QR skanerlash" })).not.toBeInTheDocument();

    await scan("tok-501");
    expect(screen.getByRole("checkbox", { name: "№501 ni tanlovdan chiqarish" })).toBeChecked();

    await scan("tok-501");
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("duplicate", expect.any(String));
    expect(await screen.findByText("#501")).toBeInTheDocument();

    await scan("nomalum-qr-123");
    expect(mocks.playMissingOrderFeedback).toHaveBeenCalled();
    expect(await screen.findByText("QR topilmadi")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Marketga jo'natish — 1 ta" }));
    expect(mocks.handoverMutate).toHaveBeenCalledWith(
      { marketId: "201", orderIds: ["501"], authorizationToken: undefined, manualOverrides: [] },
      expect.any(Object),
    );
  });

  it("QR buzilgan: oyna → «Qo'lda tasdiqlangan» badge'i (sabab — yorliq), tanlovdan chiqarish", async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getAllByRole("button", { name: "QR buzilgan" })[1]);
    const dialog = await screen.findByRole("dialog", { name: "QR buzilganini tasdiqlash" });
    expect(within(dialog).getByText("Dilfuza Hasanova")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("radio", { name: "Yorliq yo'qolgan" }));
    await user.click(within(dialog).getByRole("button", { name: "Qo'lda tasdiqlash" }));

    const badge = await screen.findByText("Qo'lda tasdiqlangan");
    expect(badge).toHaveAttribute("title", "Yorliq yo'qolgan");
    const checkbox = screen.getByRole("checkbox", { name: "№502 ni tanlovdan chiqarish" });
    expect(checkbox).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Marketga jo'natish — 1 ta" }));
    expect(mocks.handoverMutate).toHaveBeenLastCalledWith(
      expect.objectContaining({ manualOverrides: [{ order_id: "502", reason: "Label yo'qolgan" }] }),
      expect.any(Object),
    );

    await user.click(checkbox);
    expect(screen.queryByText("Qo'lda tasdiqlangan")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "№502 ni qo'lda tanlash" })).not.toBeChecked();
  });
});

describe("Bekor qilinganlar — market roli", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("marketda QR o'chirilgan bo'lsa — «Qabul qilish» yo'q", () => {
    renderDetail(marketState(false));

    expect(screen.getByRole("heading", { name: "Market QR talab qilinmaydi" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Qabul qilish" })).not.toBeInTheDocument();
  });
});
