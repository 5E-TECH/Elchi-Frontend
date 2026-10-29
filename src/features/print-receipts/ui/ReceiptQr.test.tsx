import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { encodeReceiptQr } from "../lib/printReceiptQr";
import ReceiptQr from "./ReceiptQr";

/**
 * Ekrandagi QR (HJ5sLHiz): kodlovchi (`qrcode`) dinamik yuklanadi — yuklanguncha o'sha `<svg role="img">` bo'sh
 * (`aria-busy`), keyin chek bilan aynan bir xil kod chiziladi. Bo'sh token — hech narsa chizilmaydi (zaxirani
 * chaqiruvchi beradi, `BatchQrCode`).
 */
describe("ReceiptQr", () => {
  it("fills the same svg with the receipt's QR once the encoder loads", async () => {
    const token = "BTB-1a2b3c4d5e6f7a8b";
    const symbol = encodeReceiptQr(token)!;
    render(<ReceiptQr token={token} label="B-172 paketining QR kodi" />);
    const qr = screen.getByRole("img", { name: "B-172 paketining QR kodi" });
    await waitFor(() => expect(qr.querySelector("path")).not.toBeNull());
    expect(qr).not.toHaveAttribute("aria-busy");
    expect(qr).toHaveAttribute("viewBox", `0 0 ${symbol.count} ${symbol.count}`);
    expect(qr.querySelector("path")?.getAttribute("d")).toBe(
      symbol.runs.map(([row, col, length]) => `M${col} ${row}h${length}v1h-${length}z`).join(""),
    );
  });

  it("empty token → nothing is rendered (no empty labelled image)", async () => {
    const { container, rerender } = render(<ReceiptQr token="  " label="QR" />);
    expect(container).toBeEmptyDOMElement();
    // Kodlovchi yuklangandan keyin ham.
    rerender(<ReceiptQr token="POST-1a2b3c4d5e6f7a8b9c" label="QR" />);
    await waitFor(() => expect(screen.getByRole("img", { name: "QR" }).querySelector("path")).not.toBeNull());
    rerender(<ReceiptQr token="" label="QR" />);
    expect(container).toBeEmptyDOMElement();
  });
});
