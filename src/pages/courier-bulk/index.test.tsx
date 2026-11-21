import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CourierBulkPage from "./index";
import { renderWithProviders } from "../../test/test-utils";
import { getActiveScanTarget, resetScanTargets } from "../../shared/lib/scanner/scanTargets";

/**
 * «Kunni yakunlash» — BEEPOST MODELI (ega 2026-11-21: «kunni yakunlash xuddi BeePost'nikiday ishlashi kerak»):
 *  - sukut natija «Sotildi»: kuryer faqat qaytgan (bekor) va ertaga qoladigan posilkalarni skanerlaydi, qolgani
 *    sotiladi; tasdiq oynasida belgilanmaganlar sotilishi belgilash katagi bilan tasdiqlanadi;
 *  - isbotsizlar BULK so'rov bilan (avval bekorlar, keyin sotuvlar) — har buyurtmaga alohida so'rov emas;
 *  - boshqa rejimda qayta skan belgini ko'chiradi; belgilar brauzerda saqlanadi; «Faqat bekorlar».
 */

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  sell: vi.fn(),
  cancel: vi.fn(),
  bulk: vi.fn(),
  feedback: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../shared/api/api", () => ({ api: { get: mocks.get } }));

vi.mock("../../entities/orders", () => ({
  useOrders: () => ({
    SellOrder: { mutateAsync: mocks.sell, isPending: false },
    CancelOrder: { mutateAsync: mocks.cancel, isPending: false },
    BulkOrderAction: { mutateAsync: mocks.bulk, isPending: false },
  }),
}));

vi.mock("../../shared/lib/scanner/feedback", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../shared/lib/scanner/feedback")>()),
  playScanFeedback: mocks.feedback,
}));

type BulkCall = { action: "sold" | "cancel"; orderIds: string[]; comment?: string; headers?: Record<string, string> };

/** Server javobi: hammasi bajarildi (xato berganlari `failed` da). */
const bulkOk = (failed: Array<{ order_id: string; status_code: number; message: string }> = []) =>
  mocks.bulk.mockImplementation(({ action, orderIds }: BulkCall) => {
    const failedIds = new Set(failed.map((failure) => failure.order_id));
    return Promise.resolve({
      statusCode: 200,
      data: {
        action,
        total: orderIds.length,
        succeeded: orderIds.filter((orderId) => !failedIds.has(orderId)),
        failed: failed.filter((failure) => orderIds.includes(failure.order_id)),
      },
    });
  });

const bulkCalls = () => mocks.bulk.mock.calls.map(([call]) => call as BulkCall);

beforeEach(() => {
  resetScanTargets();
  localStorage.clear();
});

const order = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  status: "waiting",
  total_price: 100000,
  createdAt: "2026-10-15T08:00:00.000Z",
  qr_code_token: `tok-${id}-qr`,
  customer: { name, phone_number: "+998901112233" },
  market: { name: "Baraka Shop" },
  ...over,
});

const respondWith = (orders: unknown[]) =>
  mocks.get.mockResolvedValue({ data: { statusCode: 200, data: { data: orders, total: orders.length } } });

/** USB (HID) skaner: tez ketma-ket tugmalar + Enter. */
const scan = async (value: string) => {
  await act(async () => {
    for (const key of value) fireEvent.keyDown(window, { key });
    fireEvent.keyDown(window, { key: "Enter" });
  });
};

const rowOf = (name: string) => {
  const group = screen.getByRole("radiogroup", { name: `${name}: natija` });
  return group.closest("tr") as HTMLElement;
};

/** Qatordagi natija varianti («{name}: natija» guruhida). */
const resultOf = (name: string, option: "Sotildi" | "Bekor" | "Ertaga") =>
  within(screen.getByRole("radiogroup", { name: `${name}: natija` })).getByRole("radio", { name: option });

const openFinalize = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: /Kunni yakunlash/ }));
  return screen.findByRole("alertdialog", { name: "Kunni yakunlashni tasdiqlang" });
};

describe("CourierBulkPage — «Kunni yakunlash» (BeePost modeli)", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.sell.mockReset();
    mocks.cancel.mockReset();
    mocks.bulk.mockReset();
    respondWith([order("10", "Ali"), order("11", "Vali")]);
    mocks.sell.mockResolvedValue({});
    mocks.cancel.mockResolvedValue({});
    bulkOk();
  });

  it("ro'yxat «scope=actionable» bilan so'raladi (menejer — faqat amal qila oladigani)", async () => {
    renderWithProviders(<CourierBulkPage />);
    expect(await screen.findByText("Ali")).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith(
      "orders/courier/orders",
      expect.objectContaining({ params: expect.objectContaining({ status: "waiting", scope: "actionable" }) }),
    );
  });

  it("⭐ belgilanmagan qator — «Sotildi» (sukut); kartada «Sotiladi 2 ta», belgisi «Belgilanmagan»", async () => {
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Ali")).toBeInTheDocument();
    expect(resultOf("Ali", "Sotildi")).toBeChecked();
    expect(resultOf("Ali", "Bekor")).not.toBeChecked();
    expect(within(rowOf("Ali")).getByText("Belgilanmagan")).toBeInTheDocument();
    expect(screen.getByText("Belgilanmaganlari sotiladi")).toBeInTheDocument();
    const stats = screen.getByRole("group", { name: "Kun yakuni" });
    expect(stats).toHaveTextContent(/Sotiladi\s*2\s*ta\s*Shundan belgilanmagan: 2 ta/);
  });

  it("⭐ tasdiq: belgilanmaganlar sotilishi katak bilan tasdiqlanadi; «Orqaga» hech narsa yubormaydi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);
    expect(await screen.findByText("Ali")).toBeInTheDocument();

    const dialog = await openFinalize(user);
    expect(dialog).toHaveTextContent("2 ta buyurtma: quyidagilar bajariladi");
    expect(within(dialog).getByText("2 ta sotilgan deb belgilanadi").closest("li")).toHaveTextContent(
      "Sotilgan holatiga o'tadi — 2 tasi belgilanmagan (skanerlanmagan)",
    );
    const ack = within(dialog).getByRole("checkbox", { name: "Belgilanmagan 2 ta buyurtma SOTILISHINI tushunaman" });
    expect(ack).not.toBeChecked();
    expect(within(dialog).getByRole("button", { name: "Tasdiqlash" })).toBeDisabled();

    await user.click(within(dialog).getByRole("button", { name: "Orqaga" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mocks.bulk).not.toHaveBeenCalled();
    expect(mocks.sell).not.toHaveBeenCalled();
  });

  it("⭐ katak belgilansa — BITTA bulk so'rov: barcha belgilanmaganlar sotiladi (yakunlash kaliti bilan)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);
    expect(await screen.findByText("Ali")).toBeInTheDocument();

    const dialog = await openFinalize(user);
    await user.click(within(dialog).getByRole("checkbox", { name: /SOTILISHINI tushunaman/ }));
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => expect(mocks.bulk).toHaveBeenCalledTimes(1));
    expect(bulkCalls()[0]).toEqual({
      action: "sold",
      orderIds: ["10", "11"],
      comment: "Kuryer tezkor amal orqali sotildi deb yakunladi",
      headers: { "X-Request-Source": "courier-bulk", "Idempotency-Key": expect.stringMatching(/^courier-bulk:[^:]+$/) },
    });
    // Yakka sotuv so'rovi yo'q.
    expect(mocks.sell).not.toHaveBeenCalled();
    expect(await screen.findByText("2 ta buyurtma muvaffaqiyatli yakunlandi")).toBeInTheDocument();
  });

  it("hammasi aniq belgilangan — katak so'ralmaydi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);
    expect(await screen.findByText("Ali")).toBeInTheDocument();
    // Sukut «Sotildi» qayta bosilsa — aniq belgi («Belgilanmagan» yo'qoladi).
    await user.click(resultOf("Ali", "Sotildi"));
    expect(within(rowOf("Ali")).queryByText("Belgilanmagan")).not.toBeInTheDocument();
    expect(resultOf("Ali", "Sotildi")).toBeChecked();
    await user.click(resultOf("Vali", "Bekor"));

    const dialog = await openFinalize(user);
    expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(within(dialog).getByText("1 ta sotilgan deb belgilanadi").closest("li")).toHaveTextContent(
      "Sotilgan holatiga o'tadi",
    );
    expect(within(dialog).getByRole("button", { name: "Tasdiqlash" })).toBeEnabled();
  });

  it("⭐ aralash: avval bekorlar, keyin sotuvlar (belgilanmagan ham); «Ertaga» so'rovsiz", async () => {
    respondWith([order("10", "Ali"), order("11", "Vali"), order("12", "Soli"), order("13", "Gani")]);
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);
    expect(await screen.findByText("Ali")).toBeInTheDocument();

    await user.click(resultOf("Ali", "Bekor"));
    await user.click(resultOf("Vali", "Ertaga"));
    await user.click(resultOf("Gani", "Sotildi"));
    // Soli (№12) — belgilanmagan → sotiladi.

    const dialog = await openFinalize(user);
    expect(dialog).toHaveTextContent("4 ta buyurtma: quyidagilar bajariladi");
    expect(dialog).toHaveTextContent("2 ta sotilgan deb belgilanadi");
    expect(dialog).toHaveTextContent("1 tasi belgilanmagan (skanerlanmagan)");
    expect(dialog).toHaveTextContent("1 ta bekor qilinadi");
    expect(dialog).toHaveTextContent("№10 · Ali — bekor qilingan holatiga o'tadi");
    expect(dialog).toHaveTextContent("1 tasi ertaga qoladi");
    expect(within(dialog).getByRole("note")).toHaveTextContent("3 ta buyurtma holati darhol o'zgaradi.");
    await user.click(within(dialog).getByRole("checkbox", { name: "Belgilanmagan 1 ta buyurtma SOTILISHINI tushunaman" }));
    // Yakunlashdan keyingi yangilanish — server endi faqat «Ertaga» qolganini qaytaradi.
    respondWith([order("11", "Vali")]);
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => expect(mocks.bulk).toHaveBeenCalledTimes(2));
    expect(bulkCalls().map(({ action, orderIds, comment }) => ({ action, orderIds, comment }))).toEqual([
      { action: "cancel", orderIds: ["10"], comment: "Kuryer tezkor amal orqali bekor qildi" },
      { action: "sold", orderIds: ["12", "13"], comment: "Kuryer tezkor amal orqali sotildi deb yakunladi" },
    ]);
    // Bitta yakunlash — ayni kalit.
    expect(bulkCalls()[0].headers?.["Idempotency-Key"]).toBe(bulkCalls()[1].headers?.["Idempotency-Key"]);
    expect(await screen.findByText(/3 ta buyurtma muvaffaqiyatli yakunlandi 1 ta buyurtma ertaga qoldirildi\./)).toBeInTheDocument();
    // Bajarilganlar ro'yxatdan chiqdi, «Ertaga» qoldi.
    expect(screen.queryByText("Ali")).not.toBeInTheDocument();
    expect(resultOf("Vali", "Ertaga")).toBeChecked();
  });

  it("⭐ 45 ta buyurtma — 20 tadan bo'lak (3 ta so'rov, ketma-ket), 45 ta so'rov emas", async () => {
    respondWith(Array.from({ length: 45 }, (_, index) => order(String(100 + index), `Mijoz ${index}`)));
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);
    expect(await screen.findByText("Mijoz 0")).toBeInTheDocument();

    const dialog = await openFinalize(user);
    await user.click(within(dialog).getByRole("checkbox", { name: /SOTILISHINI tushunaman/ }));
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => expect(mocks.bulk).toHaveBeenCalledTimes(3));
    expect(bulkCalls().map((call) => call.orderIds.length)).toEqual([20, 20, 5]);
    expect(await screen.findByText("45 ta buyurtma muvaffaqiyatli yakunlandi")).toBeInTheDocument();
  });

  it("⭐ server bittasini rad etsa — u sababi bilan qoladi, qolganlari yakunlanadi", async () => {
    bulkOk([{ order_id: "11", status_code: 400, message: "Buyurtma kutilmoqda (waiting) holatida emas" }]);
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);
    expect(await screen.findByText("Ali")).toBeInTheDocument();

    const dialog = await openFinalize(user);
    await user.click(within(dialog).getByRole("checkbox", { name: /SOTILISHINI tushunaman/ }));
    respondWith([order("11", "Vali")]);
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    const result = await screen.findByRole("dialog", { name: "Yakunlashda xatolik" });
    expect(result).toHaveTextContent("Buyurtma kutilmoqda (waiting) holatida emas");
    await user.click(within(result).getByRole("button", { name: "Tushunarli" }));
    await waitFor(() => expect(screen.queryByText("Ali")).not.toBeInTheDocument());
    expect(within(rowOf("Vali")).getByTestId("courier-bulk-row-error")).toHaveTextContent(
      "Yakunlanmadi: Buyurtma kutilmoqda (waiting) holatida emas",
    );
  });

  it("⭐ «Faqat bekorlar»: faqat «Bekor» belgilanganlar bekor qilinadi, sotuv so'rovi ketmaydi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);
    expect(await screen.findByText("Ali")).toBeInTheDocument();
    const cancelOnly = screen.getByRole("button", { name: "Faqat bekorlar" });
    expect(cancelOnly).toBeDisabled();

    await user.click(resultOf("Ali", "Bekor"));
    expect(cancelOnly).toBeEnabled();
    await user.click(cancelOnly);
    const dialog = await screen.findByRole("alertdialog", { name: "Faqat bekorlarni bajarish" });
    expect(dialog).toHaveTextContent("1 ta buyurtma bekor qilinadi. Qolganlari o'zgarmaydi");
    respondWith([order("11", "Vali")]);
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));

    await waitFor(() => expect(mocks.bulk).toHaveBeenCalledTimes(1));
    expect(bulkCalls()[0]).toMatchObject({ action: "cancel", orderIds: ["10"] });
    await waitFor(() => expect(screen.queryByText("Ali")).not.toBeInTheDocument());
    // Vali (belgilanmagan) — tegilmadi, ro'yxatda qoldi.
    expect(screen.getByText("Vali")).toBeInTheDocument();
    expect(bulkCalls().some((call) => call.action === "sold")).toBe(false);
  });

  it("hammasi «Ertaga» — so'rov ham, tasdiq oynasi ham yo'q", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);
    expect(await screen.findByText("Ali")).toBeInTheDocument();
    await user.click(resultOf("Ali", "Ertaga"));
    await user.click(resultOf("Vali", "Ertaga"));
    await user.click(screen.getByRole("button", { name: /Kunni yakunlash/ }));

    expect(
      await screen.findByText("Yakunlanadigan buyurtma yo'q — ertaga qoldirilganlar kutilmoqda holatida qoladi."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mocks.bulk).not.toHaveBeenCalled();
  });

  it("«Belgilarni tozalash» — hammasi yana sukut «Sotildi»", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);
    expect(await screen.findByText("Ali")).toBeInTheDocument();
    await user.click(resultOf("Ali", "Bekor"));
    expect(within(rowOf("Ali")).queryByText("Belgilanmagan")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Belgilarni tozalash" }));
    expect(resultOf("Ali", "Sotildi")).toBeChecked();
    expect(within(rowOf("Ali")).getByText("Belgilanmagan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Belgilarni tozalash" })).toBeDisabled();
  });

  it("⭐ belgilar saqlanadi: sahifa qayta ochilsa «Bekor» / «Ertaga» va skan rejimi joyida", async () => {
    const user = userEvent.setup();
    const first = renderWithProviders(<CourierBulkPage />);
    expect(await screen.findByText("Ali")).toBeInTheDocument();
    await user.click(resultOf("Ali", "Bekor"));
    await user.click(resultOf("Vali", "Ertaga"));
    act(() => getActiveScanTarget()?.onModeChange?.("tomorrow"));
    first.unmount();

    renderWithProviders(<CourierBulkPage />);
    expect(await screen.findByText("Ali")).toBeInTheDocument();
    expect(resultOf("Ali", "Bekor")).toBeChecked();
    expect(resultOf("Vali", "Ertaga")).toBeChecked();
    await waitFor(() => expect(getActiveScanTarget()?.mode).toBe("tomorrow"));
  });

  it("⭐ USB skaner: boshqa rejimda qayta skan belgini KO'CHIRADI; ayni rejimda — «Qayta skaner»", async () => {
    renderWithProviders(<CourierBulkPage />);
    expect(await screen.findByText("Ali")).toBeInTheDocument();

    await scan("tok-10-qr");
    expect(await screen.findByText("Ali bekor qilishga belgilandi")).toBeInTheDocument();
    expect(resultOf("Ali", "Bekor")).toBeChecked();

    // Ayni rejimda takror — ogohlantirish, belgi o'zgarmaydi.
    await scan("tok-10-qr");
    expect(await screen.findByText("Bu buyurtma oldin skaner qilingan")).toBeInTheDocument();
    expect(resultOf("Ali", "Bekor")).toBeChecked();

    // «Ertaga» rejimida — ko'chadi.
    act(() => getActiveScanTarget()?.onModeChange?.("tomorrow"));
    await waitFor(() => expect(getActiveScanTarget()?.mode).toBe("tomorrow"));
    await scan("tok-10-qr");
    expect(await screen.findByText("Belgi o'zgartirildi")).toBeInTheDocument();
    expect(resultOf("Ali", "Ertaga")).toBeChecked();
  });

  it("USB skaner: topilmasa — xato qoladi, keyingi to'g'ri skan uni yopadi", async () => {
    renderWithProviders(<CourierBulkPage />);
    expect(await screen.findByText("Ali")).toBeInTheDocument();

    await scan("noma'lum-qr-kod");
    expect(await screen.findByTestId("courier-bulk-scan-error")).toHaveTextContent(
      "Bu QR kod kutilayotgan buyurtmalar ichida topilmadi",
    );
    expect(screen.getByTestId("courier-bulk-scan-error")).toHaveAttribute("role", "alert");

    await scan("tok-11-qr");
    expect(await screen.findByText("Vali bekor qilishga belgilandi")).toBeInTheDocument();
    expect(screen.queryByTestId("courier-bulk-scan-error")).not.toBeInTheDocument();
  });

  it("qidiruv va «Natija» filtri — mijoz tomonida; «Sotiladi» belgilanmaganlarni ham ko'rsatadi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Ali")).toBeInTheDocument();
    const requests = mocks.get.mock.calls.length;

    await user.type(screen.getByRole("searchbox", { name: /qidirish/ }), "Vali");
    expect(screen.queryByText("Ali")).not.toBeInTheDocument();
    expect(screen.getByText("Vali")).toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox", { name: /qidirish/ }));

    await user.click(resultOf("Ali", "Bekor"));
    const filter = screen.getByRole("combobox", { name: "Natija bo'yicha filtr" });
    await user.click(filter);
    await user.click(screen.getByRole("option", { name: "Sotiladi" }));
    expect(screen.queryByText("Ali")).not.toBeInTheDocument();
    expect(screen.getByText("Vali")).toBeInTheDocument();

    await user.click(filter);
    await user.click(screen.getByRole("option", { name: "Bekor qilinadi" }));
    expect(screen.getByText("Ali")).toBeInTheDocument();
    expect(screen.queryByText("Vali")).not.toBeInTheDocument();
    expect(mocks.get.mock.calls.length).toBe(requests);
  });

  it("«Kunni yakunlash» DOM'da bitta; «Faqat bekorlar» ham bor", async () => {
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Ali")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Kunni yakunlash/ })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Faqat bekorlar" })).toHaveLength(1);
  });

  it("ro'yxat bo'sh — «Kutilayotgan buyurtmalar yo'q», yakunlash o'chiq", async () => {
    respondWith([]);
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Kutilayotgan buyurtmalar yo'q")).toBeInTheDocument();
    expect(screen.getByText("Kutilmoqda holatidagi buyurtmalar shu yerda chiqadi.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kunni yakunlash/ })).toBeDisabled();
  });

  it("yuklash xatosi — «Buyurtmalarni yuklashda xatolik» va «Qayta urinish»", async () => {
    mocks.get.mockRejectedValueOnce({ response: { status: 500, data: { message: "Server xatosi" } } });
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Buyurtmalarni yuklashda xatolik")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(await screen.findByText("Ali")).toBeInTheDocument();
  });
});

describe("CourierBulkPage — menejer", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.bulk.mockReset();
    bulkOk();
    respondWith([
      order("10", "Ali", { holder_type: "COURIER", holder_courier_id: "289", courier_id: "289" }),
      order("11", "Vali", { holder_type: "BRANCH", courier_id: "0" }),
    ]);
  });

  const managerState = {
    role: { id: "201", role: "manager", region: null, name: "Menejer" },
    user: { user: { id: "201", can_sell_cancel: true } },
  } as never;

  it("⭐ kuryer qo'lidagi buyurtma ham sotiladi (kuryer nomidan — oynada izoh), menejer izohi bilan", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />, { preloadedState: managerState });
    expect(await screen.findByText("Ali")).toBeInTheDocument();
    expect(screen.queryByTestId("courier-bulk-courier-held")).not.toBeInTheDocument();

    const dialog = await openFinalize(user);
    expect(dialog).toHaveTextContent("2 ta sotilgan deb belgilanadi");
    expect(dialog).toHaveTextContent("Kuryer qo'lidagi 1 ta buyurtma kuryer nomidan sotiladi");
    await user.click(within(dialog).getByRole("checkbox", { name: /SOTILISHINI tushunaman/ }));
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => expect(mocks.bulk).toHaveBeenCalledTimes(1));
    expect(bulkCalls()[0]).toMatchObject({
      action: "sold",
      orderIds: ["10", "11"],
      comment: "Menejer tezkor amal orqali sotildi deb yakunladi",
    });
  });
});

describe("CourierBulkPage — kamera (markaziy «Skaner» tugmasi)", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    respondWith([
      order("10", "Ali", { district: { id: "1", name: "Toshkent tumani" }, total_price: 310000 }),
      order("11", "Vali"),
      order("12", "Soli"),
    ]);
  });

  const target = () => {
    const active = getActiveScanTarget();
    if (!active) throw new Error("kamera maqsadi yo'q");
    return active;
  };

  it("maqsad: «Kunni yakunlash · N ta kutilayotgan buyurtma», «Bekor / Ertaga» rejimi; belgilanmaganlar sotiladi", async () => {
    renderWithProviders(<CourierBulkPage />);
    expect(await screen.findByText("Ali")).toBeInTheDocument();

    expect(target()).toMatchObject({
      id: "courier-bulk",
      title: "Kunni yakunlash",
      context: "3 ta kutilayotgan buyurtma",
      modes: [
        { value: "cancel", label: "Bekor" },
        { value: "tomorrow", label: "Ertaga" },
      ],
      mode: "cancel",
      progress: { done: 0, total: 3, label: "ta skanerlandi" },
      note: { title: "Belgilanmagan 3 ta buyurtma sotiladi." },
      listNote: "Belgilanmagan 3 ta buyurtma sotiladi.",
      listTitle: "Skanerlanganlar",
      finish: { label: "Tugatish" },
    });
    expect(screen.queryByRole("button", { name: /Kamera/ })).not.toBeInTheDocument();
  });

  it("kamera skani: rejim bo'yicha belgilaydi, ro'yxat «2 / 3 · …», «Bekor qilish» belgini oladi (yana sukut «Sotildi»)", async () => {
    renderWithProviders(<CourierBulkPage />);
    expect(await screen.findByText("Ali")).toBeInTheDocument();

    await act(async () => {
      await target().onScan("tok-10-qr", "camera");
    });
    expect(mocks.feedback).toHaveBeenLastCalledWith("success", "Bekor qilishga belgilandi №10 · Ali", undefined, {
      voice: "selected",
    });
    expect(resultOf("Ali", "Bekor")).toBeChecked();

    act(() => target().onModeChange?.("tomorrow"));
    await waitFor(() => expect(target().mode).toBe("tomorrow"));
    await act(async () => {
      await target().onScan("tok-11-qr", "manual");
    });
    expect(mocks.feedback).toHaveBeenLastCalledWith("success", "Ertaga qoldirishga belgilandi №11 · Vali", undefined, {
      voice: "selected",
    });

    await waitFor(() => expect(target().progress).toMatchObject({ done: 2, total: 3 }));
    expect(target().listDescription).toBe("2 / 3 · 1 ta bekor, 1 ta ertaga");
    expect(target().listNote).toBe("Belgilanmagan 1 ta buyurtma sotiladi.");
    expect(target().list?.map((item) => [item.key, item.tone])).toEqual([
      ["11", "warning"],
      ["10", "danger"],
    ]);
    expect(target().list?.[1]).toMatchObject({ title: "№10 · Ali", subtitle: "Bekor · Toshkent tumani · 310 000 so'm" });

    // «Bekor qilish» — belgi olinadi: Ali yana belgilanmagan (sukut «Sotildi»), qayta skanerlash mumkin.
    act(() => target().list![1].onUndo!());
    await waitFor(() => expect(within(rowOf("Ali")).getByText("Belgilanmagan")).toBeInTheDocument());
    expect(resultOf("Ali", "Sotildi")).toBeChecked();
    await waitFor(() => expect(target().listNote).toBe("Belgilanmagan 2 ta buyurtma sotiladi."));
    await act(async () => {
      await target().onScan("tok-10-qr", "camera");
    });
    expect(mocks.feedback).toHaveBeenLastCalledWith("success", "Ertaga qoldirishga belgilandi №10 · Ali", undefined, {
      voice: "selected",
    });
  });

  it("qatorda qo'lda belgilangan — «skanerlandi» ga kirmaydi, kamera ro'yxatida yo'q", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);
    expect(await screen.findByText("Ali")).toBeInTheDocument();

    await user.click(resultOf("Vali", "Bekor"));
    expect(target().progress).toMatchObject({ done: 0, total: 3 });
    expect(target().list).toEqual([]);

    await act(async () => {
      await target().onScan("tok-10-qr", "camera");
    });
    await waitFor(() => expect(target().progress).toMatchObject({ done: 1, total: 3 }));
    expect(target().list?.map((item) => item.key)).toEqual(["10"]);
    expect(target().listDescription).toBe("1 / 3 · 1 ta bekor, 0 ta ertaga");
    expect(target().listNote).toBe("Belgilanmagan 1 ta buyurtma sotiladi.");
  });

  it("topilmagan kod — xato signali matn bilan, belgi yo'q", async () => {
    renderWithProviders(<CourierBulkPage />);
    expect(await screen.findByText("Ali")).toBeInTheDocument();

    await act(async () => {
      await target().onScan("boshqa-kuryer-qr", "camera");
    });
    expect(mocks.feedback).toHaveBeenLastCalledWith("missing", "Bu QR kod kutilayotgan buyurtmalar ichida topilmadi");
    expect(target().progress?.done).toBe(0);
  });
});
