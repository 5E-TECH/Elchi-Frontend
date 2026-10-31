import type { Locator, Page } from "@playwright/test";

/** Ekrandagi QR rasmini loyihaning skaner kutubxonasi (`qr-scanner`) bilan o'qiydi — mazmuni qaytadi. */
export const readQr = async (page: Page, qr: Locator): Promise<string> => {
  const png = (await qr.screenshot()).toString("base64");
  return page.evaluate(async (data) => {
    const { default: QrScanner } = await import(
      /* @vite-ignore */ `${location.origin}/node_modules/qr-scanner/qr-scanner.min.js`
    );
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    return (await QrScanner.scanImage(image, { returnDetailedScanResult: true })).data as string;
  }, png);
};
