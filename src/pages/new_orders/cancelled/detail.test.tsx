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
  paused?: boolean;
  onMatch: (order: { id: string }, raw: string) => void;
  onMissing: (raw: string) => void;
  /** Kamera maqsadi (markaziy «Skaner» tugmasi) — `useOrderQrScanner` uni USB bilan bir yo'ldan o'tkazadi. */
  camera?: {
    id: string;
    title: string;
    context?: string;
    hint?: string;
    note?: { title: string; text?: string };
    progress?: { done: number; total?: number; label?: string };
    list?: { key: string; title: string; subtitle?: string; onUndo?: () => void }[];
    finish?: { label: string };
  };
};

const mocks = vi.hoisted(() => ({
  handoverMutate: vi.fn(),
  scanMutateAsync: vi.fn(),
  pinMutateAsync: vi.fn(),
  generateMutate: vi.fn(),
  playScanFeedback: vi.fn(),
  scanner: { current: null as ScannerOptions | null },
  qrRequired: { current: true as boolean | undefined },
  emptyList: { current: false },
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
    verifyMarketCancelledPin: { mutate: vi.fn(), mutateAsync: mocks.pinMutateAsync, isPending: false },
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
    // Sahifada skan tugmasi yo'q — kamera faqat markaziy «Skaner» orqali (tizim-scanner §09).
    expect(screen.queryByRole("button", { name: "Market QR skanerlash" })).not.toBeInTheDocument();
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
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("success", expect.any(String), undefined, { step: true });

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
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("missing", expect.any(String));
    expect(screen.getByText("Market QR kerak")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marketga jo'natish" })).toBeDisabled();
  });

  it("QR kerak bo'lsa: buyurtma QR skani tanlaydi, lekin market QR'siz jo'natib bo'lmaydi", async () => {
    renderDetail();

    await scan("tok-501");

    expect(screen.getByRole("checkbox", { name: "№501 ni tanlovdan chiqarish" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Marketga jo'natish — 1 ta" })).toBeDisabled();
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("success", expect.any(String));
  });
});

describe("Bekor qilinganlarni topshirish — kamera (markaziy «Skaner» tugmasi)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.qrRequired.current = true;
    mocks.scanner.current = null;
  });

  it("sahifada skan tugmasi yo'q: v1 «Kamera» ham, sarlavhadagi «Market QR skanerlash» ham", () => {
    renderDetail();

    expect(screen.queryByRole("button", { name: "Kamera" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Kamera bilan skanerlash/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Market QR skanerlash" })).not.toBeInTheDocument();
  });

  it("market QR qabul qilingach shu QR yana o'qilsa — ikkinchi so'rov yo'q, ruxsat va jo'natish saqlanadi", async () => {
    mocks.scanMutateAsync.mockResolvedValueOnce({ data: { authorization_token: "auth-1", remaining_seconds: 252 } });
    // Backend ikkinchi foydalanishni rad etadi — so'rov ketsa, ruxsat o'chib ketardi.
    mocks.scanMutateAsync.mockRejectedValue(new Error("QR allaqachon ishlatilgan"));
    const user = userEvent.setup();
    renderDetail();

    await scan("MCR-baraka-201");
    expect(await screen.findByText("Market QR skanerlandi")).toBeInTheDocument();

    await scan("MCR-baraka-201");

    expect(mocks.scanMutateAsync).toHaveBeenCalledTimes(1);
    expect(mocks.playScanFeedback).toHaveBeenLastCalledWith("duplicate", "Market QR allaqachon qabul qilingan");
    expect(screen.getByText("Market QR skanerlandi")).toBeInTheDocument();
    const send = screen.getByRole("button", { name: "Marketga jo'natish — 2 ta" });
    expect(send).toBeEnabled();
    await user.click(send);
    expect(mocks.handoverMutate).toHaveBeenCalledWith(
      expect.objectContaining({ authorizationToken: "auth-1" }),
      expect.any(Object),
    );
  });

  it("maqsad matni holatga qarab: «Market QR skanerlash» → QR'dan keyin «Buyurtmalarni tanlash · QR 04:12»", async () => {
    mocks.scanMutateAsync.mockResolvedValue({ data: { authorization_token: "auth-1", remaining_seconds: 252 } });
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

    const after = mocks.scanner.current!.camera!;
    expect(after.id).toBe("cancelled-handover:201");
    expect(after.title).toBe("Buyurtmalarni tanlash");
    expect(after.hint).toMatch(/^Buyurtmalarni tanlang · QR 04:1\d amal qiladi$/);
    expect(after.progress).toMatchObject({ done: 2, total: 2, label: "ta tanlandi" });
    expect(after.finish).toMatchObject({ label: "Tugatish" });
    expect(after.list?.map((item) => item.key)).toEqual(["501", "502"]);
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("success", "Market QR qabul qilindi", undefined, { step: true });

    // «Bekor qilish» — tanlovdan chiqaradi (jo'natish hali bo'lmagan).
    act(() => after.list![0].onUndo!());
    expect(screen.getByRole("checkbox", { name: "№501 ni qo'lda tanlash" })).not.toBeChecked();
    expect(mocks.scanner.current!.camera!.progress).toMatchObject({ done: 1, total: 2 });
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
    expect(mocks.playScanFeedback).toHaveBeenCalledWith("missing", expect.any(String));
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

describe("Bekor qilinganlarni topshirish — «Topshirildi (N)» (maket superadmin-neworders-cancelled-handover-done)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.qrRequired.current = true;
    mocks.scanner.current = null;
    mocks.handoverMutate.mockImplementation((_vars: unknown, options: { onSuccess: () => void }) => options.onSuccess());
  });

  it("muvaffaqiyatdan keyin qatorlar yo'qolmaydi: «Topshirildi 2 ta», «Marketga topshirildi» + usul, jami", async () => {
    mocks.scanMutateAsync.mockResolvedValue({ data: { authorization_token: "auth-1", remaining_seconds: 252 } });
    const user = userEvent.setup();
    renderDetail();
    expect(screen.queryByTestId("handed-over-card")).toBeNull();

    await scan("MCR-baraka-201");
    await screen.findByText("Market QR skanerlandi");
    await user.click(screen.getByRole("button", { name: "Marketga jo'natish — 2 ta" }));

    const card = await screen.findByTestId("handed-over-card");
    expect(within(card).getByRole("heading", { name: /Topshirildi/ })).toBeInTheDocument();
    expect(within(card).getByText("2 ta")).toBeInTheDocument();
    expect(card).toHaveTextContent("Sahifa yangilansa, ro'yxat tozalanadi");
    expect(card).toHaveTextContent(/jami 341\s000 so'm/);
    // Telefonda jami izoh ostida (o'ngdagi ustun md dan kichikda yashirin).
    expect(within(card).getByTestId("handed-over-total-phone")).toHaveTextContent(/jami 341\s000 so'm/);
    const table = within(card).getByRole("table", { name: "Topshirilgan buyurtmalar" });
    expect(within(table).getByRole("link", { name: "№501" })).toHaveAttribute("href", "/orders/edit/501");
    expect(within(table).getAllByText("Marketga topshirildi")).toHaveLength(2);
    expect(within(table).getAllByText("QR orqali")).toHaveLength(2);
    // Tayyorlash ro'yxatida qolmadi.
    expect(screen.queryByRole("checkbox", { name: /№501/ })).toBeNull();
  });

  it("qo'lda tasdiqlangani — «Qo'lda tasdiq — Yorliq yo'qolgan»", async () => {
    mocks.qrRequired.current = false;
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getAllByRole("button", { name: "QR buzilgan" })[1]);
    const dialog = await screen.findByRole("dialog", { name: "QR buzilganini tasdiqlash" });
    await user.click(within(dialog).getByRole("radio", { name: "Yorliq yo'qolgan" }));
    await user.click(within(dialog).getByRole("button", { name: "Qo'lda tasdiqlash" }));
    await scan("tok-501");
    await user.click(screen.getByRole("button", { name: "Marketga jo'natish — 2 ta" }));

    const table = within(await screen.findByTestId("handed-over-card")).getByRole("table");
    const manualRow = within(table).getByRole("link", { name: "№502" }).closest("tr") as HTMLElement;
    expect(manualRow).toHaveTextContent("Qo'lda tasdiq — Yorliq yo'qolgan");
    const scannedRow = within(table).getByRole("link", { name: "№501" }).closest("tr") as HTMLElement;
    expect(scannedRow).toHaveTextContent("QR'siz (market sozlamasi)");
  });
});

describe("Bekor qilinganlarni topshirish — 6 xonali kod (zkRab9M2, maket superadmin-neworders-cancelled-pin-dialog)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.qrRequired.current = true;
    mocks.emptyList.current = false;
    mocks.scanner.current = null;
    mocks.handoverMutate.mockImplementation((_vars: unknown, options: { onSuccess: () => void }) => options.onSuccess());
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

  it("to'g'ri kod — QR skani bilan bir xil: hamma bekorlar tanlanadi, taymer, token bilan jo'natiladi, usul «Parol orqali»", async () => {
    mocks.pinMutateAsync.mockResolvedValue({
      data: { market_id: "201", authorized: true, authorization_token: "auth-pin", remaining_seconds: 300, method: "pin" },
    });
    const user = userEvent.setup();
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
    expect(screen.getByRole("checkbox", { name: "№501 ni tanlovdan chiqarish" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "№502 ni tanlovdan chiqarish" })).toBeChecked();
    // Kod ruxsati olingach — «PIN kodni kiritish» yo'q (holat «skanerlandi»).
    expect(screen.queryByRole("button", { name: "PIN kodni kiritish" })).not.toBeInTheDocument();
    expect(mocks.scanner.current!.paused).toBe(false);

    await user.click(screen.getByRole("button", { name: "Marketga jo'natish — 2 ta" }));
    expect(mocks.handoverMutate).toHaveBeenCalledWith(
      { marketId: "201", orderIds: ["501", "502"], authorizationToken: "auth-pin", manualOverrides: [] },
      expect.any(Object),
    );
    const table = within(await screen.findByTestId("handed-over-card")).getByRole("table");
    expect(within(table).getAllByText("Parol orqali")).toHaveLength(2);
  });

  it("noto'g'ri kod — maydon ostida qolgan urinishlar, oyna ochiq, tanlov va ruxsat yo'q; yozilsa xato yo'qoladi", async () => {
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
    expect(screen.getByRole("checkbox", { name: "№501 ni qo'lda tanlash" })).not.toBeChecked();

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

  it("marketda QR o'chirilgan bo'lsa — «Qabul qilish» yo'q", () => {
    renderDetail(marketState(false));

    expect(screen.getByRole("heading", { name: "Market QR talab qilinmaydi" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Qabul qilish" })).not.toBeInTheDocument();
  });
});
