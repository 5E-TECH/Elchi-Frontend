import type { Locator, Page } from "@playwright/test";

/** PNG'dagi QR'ni loyihaning skaner kutubxonasi (`qr-scanner`) bilan o'qiydi — mazmuni qaytadi. */
export const decodeQr = (page: Page, png: Buffer): Promise<string> =>
  page.evaluate(async (data) => {
    const { default: QrScanner } = await import(
      /* @vite-ignore */ `${location.origin}/node_modules/qr-scanner/qr-scanner.min.js`
    );
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    return (await QrScanner.scanImage(image, { returnDetailedScanResult: true })).data as string;
  }, png.toString("base64"));

/** Ekrandagi QR rasmini o'qiydi. */
export const readQr = async (page: Page, qr: Locator): Promise<string> =>
  decodeQr(page, await qr.screenshot());

/**
 * Soxta kamera: `getUserMedia` kanvas oqimini beradi (720 × 1280, telefon orqa kamerasi kabi tik), ichida ekrandagi
 * QR rasmi — 390px ekrandagi skan ramkasi ichida (ramka o'rtadan yuqorida, kamera faqat uning ichini o'qiydi).
 * Kod «Qo'lda kiritish» bilan EMAS, kamera kadridan o'qiladi. Keyingi `goto` dan ishlaydi.
 */
export const mockQrCamera = (page: Page, png: Buffer) =>
  page.addInitScript((data: string) => {
    const devices = navigator.mediaDevices;
    if (!devices?.getUserMedia) return;
    const original = devices.getUserMedia.bind(devices);
    devices.getUserMedia = async (constraints?: MediaStreamConstraints) => {
      if (!constraints?.video) return original(constraints);
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = 1280;
      const context = canvas.getContext("2d");
      if (!context) return original(constraints);
      context.imageSmoothingEnabled = false;
      const side = 340;
      let tick = 0;
      const draw = () => {
        tick += 1;
        context.fillStyle = "rgb(120, 120, 120)";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, (canvas.width - side) / 2, 365, side, side);
        // Kadr o'zgarib tursin (aks holda kanvas oqimi yangi kadr bermaydi).
        context.fillRect(tick % 2, 0, 1, 1);
      };
      draw();
      window.setInterval(draw, 100);
      return canvas.captureStream(15);
    };
  }, png.toString("base64"));
