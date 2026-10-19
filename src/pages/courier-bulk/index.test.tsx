import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CourierBulkPage from "./index";
import { renderWithProviders } from "../../test/test-utils";
import { getActiveScanTarget, resetScanTargets } from "../../shared/lib/scanner/scanTargets";

/**
 * «Kunni yakunlash» — tasdiqlash oynasi orqali (DESIGN_SYSTEM §8, maket `courier-courier-bulk-confirm-dialog`):
 * oyna nima bo'lishini sanab beradi, «Orqaga» — hech narsa yuborilmaydi, «Tasdiqlash» — buyurtmalar yakunlanadi.
 * Qator natijasi «Sotildi | Bekor | Ertaga» (maket `courier-courier-bulk-main`), «Ertaga» so'rov yubormaydi.
 */

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  sell: vi.fn(),
  cancel: vi.fn(),
  feedback: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../shared/api/api", () => ({ api: { get: mocks.get } }));

vi.mock("../../entities/orders", () => ({
  useOrders: () => ({
    SellOrder: { mutateAsync: mocks.sell, isPending: false },
    CancelOrder: { mutateAsync: mocks.cancel, isPending: false },
  }),
}));

vi.mock("../../shared/lib/scanner/feedback", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../shared/lib/scanner/feedback")>()),
  playScanFeedback: mocks.feedback,
}));

beforeEach(() => {
  resetScanTargets();
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

describe("CourierBulkPage — «Kunni yakunlash»", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.sell.mockReset();
    mocks.cancel.mockReset();
    respondWith([order("10", "Ali"), order("11", "Vali")]);
    mocks.sell.mockResolvedValue({});
    mocks.cancel.mockResolvedValue({});
  });

  it("asks for confirmation; «Orqaga» sends nothing", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Ali")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Kunni yakunlash/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Kunni yakunlashni tasdiqlang" });
    expect(dialog).toHaveTextContent("2 ta buyurtma: quyidagilar bajariladi");
    expect(dialog).toHaveTextContent("2 ta sotilgan deb belgilanadi");
    expect(dialog).toHaveTextContent("2 tasi belgilanmagan, sukut bo'yicha");
    expect(within(dialog).getByRole("note")).toHaveTextContent("Bu amalni ortga qaytarib bo'lmaydi");
    expect(within(dialog).getByRole("note")).toHaveTextContent("2 ta buyurtma holati darhol o'zgaradi.");

    await user.click(within(dialog).getByRole("button", { name: "Orqaga" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mocks.sell).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
  });

  it("«Tasdiqlash» finalizes the orders", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Ali")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Kunni yakunlash/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Kunni yakunlashni tasdiqlang" });
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => expect(mocks.sell).toHaveBeenCalledTimes(2));
    expect(mocks.sell).toHaveBeenCalledWith({
      orderId: "10",
      data: { comment: "Kuryer tezkor amal orqali sotildi deb yakunladi", extraCost: 0 },
      // Ommaviy yopish — audit sarlavhasi (j9KFyqlS).
      headers: { "X-Request-Source": "courier-bulk" },
    });
    expect(await screen.findByText("Kun yakunlandi")).toBeInTheDocument();
  });

  it("qatordagi natija: «Bekor» va «Ertaga» belgilanadi, «Ertaga» so'rov yubormaydi", async () => {
    respondWith([order("10", "Ali"), order("11", "Vali"), order("12", "Soli")]);
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Ali")).toBeInTheDocument();
    // Boshida hammasi belgilanmagan (sukut — «sotildi»).
    expect(within(rowOf("Ali")).getByText("Belgilanmagan")).toBeInTheDocument();

    await user.click(within(screen.getByRole("radiogroup", { name: "Ali: natija" })).getByRole("radio", { name: "Bekor" }));
    await user.click(within(screen.getByRole("radiogroup", { name: "Vali: natija" })).getByRole("radio", { name: "Ertaga" }));

    expect(within(rowOf("Ali")).queryByText("Belgilanmagan")).not.toBeInTheDocument();
    expect(within(screen.getByRole("radiogroup", { name: "Ali: natija" })).getByRole("radio", { name: "Bekor" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: /Kunni yakunlash/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Kunni yakunlashni tasdiqlang" });
    expect(dialog).toHaveTextContent("3 ta buyurtma: quyidagilar bajariladi");
    expect(dialog).toHaveTextContent("1 ta sotilgan deb belgilanadi");
    expect(dialog).toHaveTextContent("1 tasi belgilanmagan, sukut bo'yicha");
    expect(dialog).toHaveTextContent("1 ta bekor qilinadi");
    expect(dialog).toHaveTextContent("№10 · Ali — bekor qilingan holatiga o'tadi");
    expect(dialog).toHaveTextContent("1 tasi ertaga qoladi");
    expect(within(dialog).getByRole("note")).toHaveTextContent("2 ta buyurtma holati darhol o'zgaradi.");
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledTimes(1));
    expect(mocks.cancel).toHaveBeenCalledWith({
      orderId: "10",
      data: { comment: "Kuryer tezkor amal orqali bekor qildi", extraCost: 0 },
      headers: { "X-Request-Source": "courier-bulk" },
    });
    await waitFor(() => expect(mocks.sell).toHaveBeenCalledTimes(1));
    expect(mocks.sell).toHaveBeenCalledWith(expect.objectContaining({ orderId: "12" }));
    // «Ertaga» (Vali, №11) — hech qanday so'rov yo'q.
    expect(mocks.sell).not.toHaveBeenCalledWith(expect.objectContaining({ orderId: "11" }));
    expect(mocks.cancel).not.toHaveBeenCalledWith(expect.objectContaining({ orderId: "11" }));
    expect(await screen.findByText(/1 ta buyurtma ertaga qoldirildi\./)).toBeInTheDocument();
  });

  it("belgilanmagan qatorda «Sotildi» bosilsa — aniq belgi («Belgilanmagan» yo'qoladi)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Ali")).toBeInTheDocument();
    const sold = within(screen.getByRole("radiogroup", { name: "Ali: natija" })).getByRole("radio", { name: "Sotildi" });
    expect(sold).toBeChecked();
    await user.click(sold);

    expect(within(rowOf("Ali")).queryByText("Belgilanmagan")).not.toBeInTheDocument();
    expect(within(rowOf("Vali")).getByText("Belgilanmagan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Belgilarni tozalash" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Belgilarni tozalash" }));
    expect(within(rowOf("Ali")).getByText("Belgilanmagan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Belgilarni tozalash" })).toBeDisabled();
  });

  it("USB skaner: «Bekor qilish» rejimida buyurtma bekorga belgilanadi; topilmasa — xato qoladi", async () => {
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Ali")).toBeInTheDocument();
    await scan("tok-10-qr");

    expect(await screen.findByText("Ali bekor qilishga belgilandi")).toBeInTheDocument();
    expect(within(screen.getByRole("radiogroup", { name: "Ali: natija" })).getByRole("radio", { name: "Bekor" })).toBeChecked();

    await scan("noma'lum-qr-kod");
    expect(await screen.findByTestId("courier-bulk-scan-error")).toHaveTextContent(
      "Bu QR kod kutilayotgan buyurtmalar ichida topilmadi",
    );
    expect(screen.getByTestId("courier-bulk-scan-error")).toHaveAttribute("role", "alert");

    // Keyingi muvaffaqiyatli skan xatoni yopadi.
    await scan("tok-11-qr");
    expect(await screen.findByText("Vali bekor qilishga belgilandi")).toBeInTheDocument();
    expect(screen.queryByTestId("courier-bulk-scan-error")).not.toBeInTheDocument();
  });

  it("qidiruv va «Natija» filtri — mijoz tomonida, qayta so'rovsiz", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Ali")).toBeInTheDocument();
    const requests = mocks.get.mock.calls.length;

    await user.type(screen.getByRole("searchbox", { name: /qidirish/ }), "Vali");
    expect(screen.queryByText("Ali")).not.toBeInTheDocument();
    expect(screen.getByText("Vali")).toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox", { name: /qidirish/ }));
    await user.type(screen.getByRole("searchbox", { name: /qidirish/ }), "Hech kim");
    expect(screen.getByText("Buyurtma topilmadi")).toBeInTheDocument();
    expect(mocks.get.mock.calls.length).toBe(requests);
  });

  it("«Kunni yakunlash» DOM'da bitta; «Faqat bekorlarni qo'llash» yo'q", async () => {
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Ali")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Kunni yakunlash/ })).toHaveLength(1);
    expect(screen.queryByText(/Faqat bekorlarni/)).not.toBeInTheDocument();
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

  it("maqsad: «Kunni yakunlash · N ta kutilayotgan buyurtma», «Bekor / Ertaga» rejimi; sahifada «Kamera» tugmasi yo'q", async () => {
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
      listTitle: "Skanerlanganlar",
      finish: { label: "Tugatish" },
    });
    expect(screen.queryByRole("button", { name: /Kamera/ })).not.toBeInTheDocument();
  });

  it("kamera skani: rejim bo'yicha belgilaydi, ro'yxat «4 / 7 · …», «Bekor qilish» belgini oladi", async () => {
    renderWithProviders(<CourierBulkPage />);
    expect(await screen.findByText("Ali")).toBeInTheDocument();

    await act(async () => {
      await target().onScan("tok-10-qr", "camera");
    });
    expect(mocks.feedback).toHaveBeenLastCalledWith("success", "Bekor qilishga belgilandi №10 · Ali");
    expect(within(screen.getByRole("radiogroup", { name: "Ali: natija" })).getByRole("radio", { name: "Bekor" })).toBeChecked();

    // Rejim kamera ichida almashtiriladi — sahifadagi rejim ham (bitta holat).
    act(() => target().onModeChange?.("tomorrow"));
    await waitFor(() => expect(target().mode).toBe("tomorrow"));
    await act(async () => {
      await target().onScan("tok-11-qr", "manual");
    });
    expect(mocks.feedback).toHaveBeenLastCalledWith("success", "Ertaga qoldirishga belgilandi №11 · Vali");

    await waitFor(() => expect(target().progress).toMatchObject({ done: 2, total: 3 }));
    expect(target().listDescription).toBe("2 / 3 · 1 ta bekor, 1 ta ertaga");
    expect(target().listNote).toBe("Skanerlanmagan 1 ta buyurtma sotilgan deb belgilanadi.");
    expect(target().list?.map((item) => [item.key, item.tone])).toEqual([
      ["11", "warning"],
      ["10", "danger"],
    ]);
    expect(target().list?.[1]).toMatchObject({ title: "№10 · Ali", subtitle: "Bekor · Toshkent tumani · 310 000 so'm" });

    // «Bekor qilish» — belgi olinadi, shu buyurtmani qayta skanerlash mumkin (takror deb rad etilmaydi).
    act(() => target().list![1].onUndo!());
    await waitFor(() => expect(within(rowOf("Ali")).getByText("Belgilanmagan")).toBeInTheDocument());
    await act(async () => {
      await target().onScan("tok-10-qr", "camera");
    });
    expect(mocks.feedback).toHaveBeenLastCalledWith("success", "Ertaga qoldirishga belgilandi №10 · Ali");
  });

  it("qatorda qo'lda belgilangan — «skanerlandi» ga kirmaydi, kamera ro'yxatida yo'q", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);
    expect(await screen.findByText("Ali")).toBeInTheDocument();

    await user.click(within(screen.getByRole("radiogroup", { name: "Vali: natija" })).getByRole("radio", { name: "Bekor" }));
    expect(target().progress).toMatchObject({ done: 0, total: 3 });
    expect(target().list).toEqual([]);

    await act(async () => {
      await target().onScan("tok-10-qr", "camera");
    });
    await waitFor(() => expect(target().progress).toMatchObject({ done: 1, total: 3 }));
    expect(target().list?.map((item) => item.key)).toEqual(["10"]);
    expect(target().listDescription).toBe("1 / 3 · 1 ta bekor, 0 ta ertaga");
    // Qo'lda «Bekor» qilingan Vali sotilgan deb hisoblanmaydi.
    expect(target().listNote).toBe("Skanerlanmagan 1 ta buyurtma sotilgan deb belgilanadi.");
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
