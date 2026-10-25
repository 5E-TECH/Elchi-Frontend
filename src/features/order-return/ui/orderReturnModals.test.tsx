import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../test/test-utils";
import { isScannerOverlayOpen, resetScannerHost } from "../../../shared/lib/scanner/scannerHost";
import { getActiveScanTarget, resetScanTargets } from "../../../shared/lib/scanner/scanTargets";
import InitiateReturnModal from "./InitiateReturnModal";
import MarkReturnedModal from "./MarkReturnedModal";

/**
 * ⚠️ `getByRole` / userEvent ISHLATILMAYDI (antd CSS-in-JS jsdom'da selektor
 * xatosi) — `data-testid` va `fireEvent`.
 */
const apiPost = vi.hoisted(() => vi.fn());
vi.mock("../../../shared/api/api", () => ({ api: { post: apiPost, get: vi.fn(), patch: vi.fn() } }));

const backendError = (message: string) =>
  Object.assign(new Error(message), { isAxiosError: true, response: { status: 400, data: { message } } });

describe("InitiateReturnModal — POST orders/:id/initiate-return", () => {
  beforeEach(() => {
    apiPost.mockReset();
  });

  it("⭐ sabab majburiy: bo'sh bo'lsa so'rov KETMAYDI", () => {
    renderWithProviders(<InitiateReturnModal open orderId="95" onClose={vi.fn()} />);
    fireEvent.change(screen.getByTestId("return-reason-input"), { target: { value: "   " } });
    fireEvent.click(screen.getByTestId("initiate-return-submit"));
    expect(screen.getByTestId("initiate-return-modal")).toHaveTextContent("Qaytarish sababini yozing");
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("⭐ sabab bilan — { reason } yuboriladi va oyna yopiladi", async () => {
    apiPost.mockResolvedValue({ data: { statusCode: 200, data: { id: "95", return_requested: true } } });
    const onClose = vi.fn();
    renderWithProviders(<InitiateReturnModal open orderId="95" onClose={onClose} />);
    fireEvent.change(screen.getByTestId("return-reason-input"), { target: { value: "  Mijoz rad etdi " } });
    fireEvent.click(screen.getByTestId("initiate-return-submit"));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(apiPost).toHaveBeenCalledWith("orders/95/initiate-return", { reason: "Mijoz rad etdi" });
  });

  it("backend xatosi oynada ko'rinadi, oyna ochiq qoladi", async () => {
    apiPost.mockRejectedValue(backendError("Bu holatdagi orderni qaytarishni boshlab bo'lmaydi"));
    const onClose = vi.fn();
    renderWithProviders(<InitiateReturnModal open orderId="95" onClose={onClose} />);
    fireEvent.change(screen.getByTestId("return-reason-input"), { target: { value: "Sabab" } });
    fireEvent.click(screen.getByTestId("initiate-return-submit"));

    await waitFor(() =>
      expect(screen.getByTestId("initiate-return-modal")).toHaveTextContent("qaytarishni boshlab bo'lmaydi"),
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("MarkReturnedModal — market QR → ruxsat → mark-returned-to-market", () => {
  beforeEach(() => {
    apiPost.mockReset();
  });

  const enterQr = (value: string) => {
    fireEvent.change(screen.getByTestId("mark-returned-qr-input"), { target: { value } });
    fireEvent.click(screen.getByTestId("mark-returned-submit"));
  };

  it("QR kiritilmaguncha tasdiqlash o'chiq; market QR bo'lmasa so'rov ketmaydi", () => {
    renderWithProviders(<MarkReturnedModal open orderId="95" onClose={vi.fn()} />);
    expect(screen.getByTestId("mark-returned-submit")).toBeDisabled();
    enterQr("ORD-95");
    expect(screen.getByTestId("mark-returned-error")).toHaveTextContent("MCR-");
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("⭐ to'g'ri oqim: QR (registri saqlangan) → MHA ruxsat → topshirish; oyna yopiladi", async () => {
    apiPost.mockImplementation((url: string) => {
      if (url === "scan/market-cancelled") {
        return Promise.resolve({ data: { type: "market_cancelled_handover", data: { authorization_token: "MHA-Tok_9" } } });
      }
      if (url === "orders/95/mark-returned-to-market") {
        return Promise.resolve({ data: { statusCode: 200, data: { id: "95", status: "returned_to_market" } } });
      }
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    const onClose = vi.fn();
    renderWithProviders(<MarkReturnedModal open orderId="95" onClose={onClose} />);
    enterQr("MCR-AbC_xYz");

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(apiPost.mock.calls).toEqual([
      ["scan/market-cancelled", { qr_token: "MCR-AbC_xYz" }],
      ["orders/95/mark-returned-to-market", { authorization_token: "MHA-Tok_9" }],
    ]);
  });

  it("⭐ topshirish yiqilsa — xato ko'rinadi, ruxsat saqlanadi, qayta urinish QR'ni QAYTA skan qilmaydi", async () => {
    let markCalls = 0;
    apiPost.mockImplementation((url: string) => {
      if (url === "scan/market-cancelled") {
        return Promise.resolve({ data: { data: { authorization_token: "MHA-1" } } });
      }
      markCalls += 1;
      return markCalls === 1
        ? Promise.reject(backendError("Bu buyurtma sizning filialingizda emas"))
        : Promise.resolve({ data: { statusCode: 200, data: {} } });
    });
    const onClose = vi.fn();
    renderWithProviders(<MarkReturnedModal open orderId="95" onClose={onClose} />);
    enterQr("MCR-abc");

    await waitFor(() => expect(screen.getByTestId("mark-returned-error")).toHaveTextContent("filialingizda emas"));
    expect(screen.getByTestId("mark-returned-authorized")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("mark-returned-submit"));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(apiPost.mock.calls.map(([url]) => url)).toEqual([
      "scan/market-cancelled",
      "orders/95/mark-returned-to-market",
      "orders/95/mark-returned-to-market",
    ]);
    expect(apiPost.mock.calls[2][1]).toEqual({ authorization_token: "MHA-1" });
  });

  it("QR skan rad etilsa (muddati tugagan) — topshirish so'rovi KETMAYDI", async () => {
    apiPost.mockRejectedValue(backendError("QR muddati tugagan"));
    renderWithProviders(<MarkReturnedModal open orderId="95" onClose={vi.fn()} />);
    enterQr("MCR-old");

    await waitFor(() => expect(screen.getByTestId("mark-returned-error")).toHaveTextContent("QR muddati tugagan"));
    expect(apiPost).toHaveBeenCalledTimes(1);
  });
});

const pinError = (reason: string, remaining?: number) =>
  Object.assign(new Error(reason), {
    isAxiosError: true,
    response: {
      status: 400,
      data: {
        message: "Kod",
        data: { reason, ...(remaining === undefined ? {} : { details: { remaining_attempts: remaining, max_attempts: 5 } }) },
      },
    },
  });

describe("MarkReturnedModal — QR o'rniga market PIN kodi (zkRab9M2, BG6)", () => {
  beforeEach(() => {
    apiPost.mockReset();
  });

  const enterCode = (value: string) => {
    fireEvent.change(screen.getByTestId("mark-returned-qr-input"), { target: { value } });
    fireEvent.click(screen.getByTestId("mark-returned-submit"));
  };

  it("⭐ market ma'lum: «042 917» → { market_id, pin } (boshidagi nol saqlanadi) → ruxsat → topshirish", async () => {
    apiPost.mockImplementation((url: string) => {
      if (url === "scan/market-cancelled") {
        return Promise.resolve({ data: { data: { authorization_token: "MHA-pin", method: "pin" } } });
      }
      if (url === "orders/95/mark-returned-to-market") {
        return Promise.resolve({ data: { statusCode: 200, data: { id: "95" } } });
      }
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    const onClose = vi.fn();
    renderWithProviders(<MarkReturnedModal open orderId="95" marketId="16" onClose={onClose} />);
    expect(screen.getByText("Yoki 6 xonali PIN kodni kiriting")).toBeInTheDocument();
    enterCode("042 917");

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(apiPost.mock.calls).toEqual([
      ["scan/market-cancelled", { market_id: "16", pin: "042917" }],
      ["orders/95/mark-returned-to-market", { authorization_token: "MHA-pin" }],
    ]);
  });

  it("market ma'lum bo'lsa ham QR kodi avvalgidek ishlaydi", async () => {
    apiPost.mockImplementation((url: string) =>
      url === "scan/market-cancelled"
        ? Promise.resolve({ data: { data: { authorization_token: "MHA-qr" } } })
        : Promise.resolve({ data: { statusCode: 200, data: {} } }),
    );
    const onClose = vi.fn();
    renderWithProviders(<MarkReturnedModal open orderId="95" marketId="16" onClose={onClose} />);
    enterCode("MCR-AbC");

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(apiPost.mock.calls[0]).toEqual(["scan/market-cancelled", { qr_token: "MCR-AbC" }]);
  });

  it("noto'g'ri kod — qolgan urinishlar ko'rinadi, topshirish so'rovi KETMAYDI", async () => {
    apiPost.mockRejectedValue(pinError("market_cancelled_pin_invalid", 3));
    const onClose = vi.fn();
    renderWithProviders(<MarkReturnedModal open orderId="95" marketId="16" onClose={onClose} />);
    enterCode("123456");

    await waitFor(() => expect(screen.getByTestId("mark-returned-error")).toHaveTextContent("Kod noto'g'ri — yana 3 ta urinish qoldi"));
    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("5 marta xato — blok xabari: market yangi QR chiqarsin", async () => {
    apiPost.mockRejectedValue(pinError("market_cancelled_pin_blocked", 0));
    renderWithProviders(<MarkReturnedModal open orderId="95" marketId="16" onClose={vi.fn()} />);
    enterCode("123456");

    await waitFor(() =>
      expect(screen.getByTestId("mark-returned-error")).toHaveTextContent("5 marta xato kiritildi — market yangi QR chiqarsin"),
    );
  });

  it("market noma'lum — 6 raqam kod sifatida yuborilmaydi (avvalgidek faqat QR)", () => {
    renderWithProviders(<MarkReturnedModal open orderId="95" onClose={vi.fn()} />);
    enterCode("042917");
    expect(screen.getByTestId("mark-returned-error")).toHaveTextContent("MCR-");
    expect(apiPost).not.toHaveBeenCalled();
  });
});

describe("MarkReturnedModal — kamera (oynaning o'z tugmasi, v2 ScannerCamera)", () => {
  beforeEach(() => {
    apiPost.mockReset();
    resetScanTargets();
    resetScannerHost();
  });

  it("oyna ochiq — `dialog` qatlamidagi maqsad; «Kamera bilan skanerlash» kamera oynasini ochadi", () => {
    renderWithProviders(<MarkReturnedModal open orderId="95" onClose={vi.fn()} />);

    expect(getActiveScanTarget()).toMatchObject({
      id: "mark-returned:95",
      layer: "dialog",
      title: "Market QR skanerlash",
      context: "#95 — marketga topshirish",
    });
    fireEvent.click(screen.getByText("Kamera bilan skanerlash"));
    expect(isScannerOverlayOpen()).toBe(true);
  });

  it("kamera skani qo'lda kiritish bilan bir yo'l: QR → ruxsat → topshirish, so'ng kamera va oyna yopiladi", async () => {
    apiPost.mockImplementation((url: string) =>
      url === "scan/market-cancelled"
        ? Promise.resolve({ data: { data: { authorization_token: "MHA-1" } } })
        : Promise.resolve({ data: { statusCode: 200, data: {} } }),
    );
    const onClose = vi.fn();
    const { unmount } = renderWithProviders(<MarkReturnedModal open orderId="95" onClose={onClose} />);
    fireEvent.click(screen.getByText("Kamera bilan skanerlash"));

    await act(async () => {
      await getActiveScanTarget()!.onScan("MCR-abc", "camera");
    });

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(apiPost.mock.calls).toEqual([
      ["scan/market-cancelled", { qr_token: "MCR-abc" }],
      ["orders/95/mark-returned-to-market", { authorization_token: "MHA-1" }],
    ]);
    // Ruxsat olindi — QR kutilmaydi, kamera yopildi.
    expect(isScannerOverlayOpen()).toBe(false);
    expect(getActiveScanTarget()).toBeNull();
    unmount();
  });

  it("market QR emas — xato oynada, so'rov yo'q, kamera ochiq qoladi", async () => {
    renderWithProviders(<MarkReturnedModal open orderId="95" onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Kamera bilan skanerlash"));

    await act(async () => {
      await getActiveScanTarget()!.onScan("ORD-95", "camera");
    });

    expect(screen.getByTestId("mark-returned-error")).toHaveTextContent("MCR-");
    expect(apiPost).not.toHaveBeenCalled();
    expect(isScannerOverlayOpen()).toBe(true);
  });
});
