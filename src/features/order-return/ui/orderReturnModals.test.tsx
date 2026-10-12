import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../test/test-utils";
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
