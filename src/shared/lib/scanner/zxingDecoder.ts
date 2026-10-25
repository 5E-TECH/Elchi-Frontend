// ZXing faqat chuqur yo'l bilan (`esm/core/...`): paket indeksi barcha formatlar va yozuvchilarni tortib, kamera
// bo'lagini bir necha barobar kattalashtirardi. WASM yo'q — CSP'da `wasm-unsafe-eval` yo'q, bu sof JS.
import BarcodeFormat from "@zxing/library/esm/core/BarcodeFormat";
import BinaryBitmap from "@zxing/library/esm/core/BinaryBitmap";
import type BitArray from "@zxing/library/esm/core/common/BitArray";
import HybridBinarizer from "@zxing/library/esm/core/common/HybridBinarizer";
import DecodeHintType from "@zxing/library/esm/core/DecodeHintType";
import NotFoundException from "@zxing/library/esm/core/NotFoundException";
import Code128Reader from "@zxing/library/esm/core/oned/Code128Reader";
import MultiFormatUPCEANReader from "@zxing/library/esm/core/oned/MultiFormatUPCEANReader";
import OneDReader from "@zxing/library/esm/core/oned/OneDReader";
import QRCodeReader from "@zxing/library/esm/core/qrcode/QRCodeReader";
import type Result from "@zxing/library/esm/core/Result";
import RGBLuminanceSource from "@zxing/library/esm/core/RGBLuminanceSource";
import { acceptDecodedCode, type BarcodeFormatName } from "./barcodeCodes";

/**
 * ZXING ZAXIRASI (Trello CO66kcoB): brauzerda `BarcodeDetector` yo'q yoki kerakli formatlarni qo'llamasa (iOS Safari,
 * Firefox, Windows/Linux Chrome) — kamera kadri shu yerda o'qiladi. Alohida bo'lak: faqat shtrix kod rejimidagi
 * kamera ochilganda va native dekoder yo'q bo'lsagina yuklanadi (`barcodeEngine.ts`).
 *
 * `TRY_HARDER` YO'Q: kadrda kod bo'lmaganda (kameradagi kadrlarning aksariyati) u bir kadrni ~12 barobar sekin
 * o'qiydi (640 × 342 kadr, Node: ~10 ms → ~125 ms; telefonda 2–4 barobar ko'p) — asosiy oqim qotib qolardi. Kod
 * ramka ichida, gorizontal turadi (yo'riqnoma shuni so'raydi) — oddiy rejim yetadi (~10° qiyalikkacha).
 */

const FORMAT_NAME: Partial<Record<BarcodeFormat, BarcodeFormatName>> = {
  [BarcodeFormat.QR_CODE]: "qr_code",
  [BarcodeFormat.EAN_13]: "ean_13",
  [BarcodeFormat.EAN_8]: "ean_8",
  [BarcodeFormat.UPC_A]: "upc_a",
  [BarcodeFormat.CODE_128]: "code_128",
};

export type DecodedCode = {
  format: BarcodeFormatName;
  rawValue: string;
  /** Kod burchaklari (kadr piksellarida; 1D kodda — chiziq uchlari). */
  cornerPoints: { x: number; y: number }[];
};

const ONE_D_HINTS = new Map<DecodeHintType, unknown>([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.CODE_128]],
]);

/**
 * 1D o'quvchi — faqat EAN-13 / EAN-8 / UPC-A va Code128 (ZXing `MultiFormatOneDReader` bilan bir xil sikl).
 * `MultiFormatOneDReader` ning o'zi Code39 / 93, ITF, Codabar, RSS ni ham import qilib, bo'lakni ~14 KB gz
 * kattalashtirardi (42 → 29 KB).
 */
class FactoryBarcodeReader extends OneDReader {
  private readonly readers: OneDReader[];

  constructor(hints: Map<DecodeHintType, unknown>) {
    super();
    this.readers = [new MultiFormatUPCEANReader(hints), new Code128Reader()];
  }

  decodeRow(rowNumber: number, row: BitArray, hints?: Map<DecodeHintType, unknown>): Result {
    for (const reader of this.readers) {
      try {
        return reader.decodeRow(rowNumber, row, hints);
      } catch {
        // Bu format emas — keyingi o'quvchi.
      }
    }
    throw new NotFoundException();
  }

  reset(): void {
    this.readers.forEach((reader) => reader.reset());
  }
}

/** RGBA (`ImageData.data`) → kulrang (yashilga og'irroq o'rtacha, ZXing `RGBLuminanceSource` bilan bir xil). */
export const toLuminance = (rgba: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray => {
  const size = width * height;
  const gray = new Uint8ClampedArray(size);
  for (let pixel = 0, offset = 0; pixel < size; pixel += 1, offset += 4) {
    gray[pixel] = (rgba[offset] + rgba[offset + 1] * 2 + rgba[offset + 2]) >> 2;
  }
  return gray;
};

const toDecoded = (result: Result): DecodedCode | null => {
  const format = FORMAT_NAME[result.getBarcodeFormat()];
  const rawValue = result.getText();
  if (!format || !acceptDecodedCode(format, rawValue)) return null;
  return {
    format,
    rawValue,
    cornerPoints: (result.getResultPoints() ?? []).flatMap((point) => (point ? [{ x: point.getX(), y: point.getY() }] : [])),
  };
};

export type ZxingDecoder = {
  /** Kulrang kadr → birinchi qabul qilingan kod yoki `null` (topilmadi / nazorat raqami xato). */
  decode: (luminance: Uint8ClampedArray, width: number, height: number) => DecodedCode | null;
};

export const createZxingDecoder = (): ZxingDecoder => {
  // 1D birinchi — topilmagan kadrda arzonroq (~5 ms), zavod qutisida asosan shu.
  const readers = [
    { reader: new FactoryBarcodeReader(ONE_D_HINTS), hints: ONE_D_HINTS },
    { reader: new QRCodeReader(), hints: undefined },
  ];
  return {
    decode: (luminance, width, height) => {
      // Bitta binarizator: 1D qator bo'yicha (global gistogramma), QR — matritsa (lokal) — ikkalasi bir kadrda.
      const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminance, width, height)));
      for (const { reader, hints } of readers) {
        try {
          const decoded = toDecoded(reader.decode(bitmap, hints));
          if (decoded) return decoded;
        } catch {
          // Topilmadi / nazorat yoki format xatosi — keyingi o'quvchi, keyin keyingi kadr.
        } finally {
          reader.reset();
        }
      }
      return null;
    },
  };
};
