/**
 * SKAN HUDUDI — kamera faqat ekrandagi ramka ichini o'qiydi (Sozlamalar → Skaner → «Ramka o'lchami», maket
 * `common-settings-scanner`: «Kamera faqat ramka ichidagi QR kodni o'qiydi»).
 *
 * `<video>` `object-cover` bilan chiziladi: tasvir elementni to'ldiradi, ortig'i kesiladi. Ramkaning ekrandagi
 * to'rtburchagi tasvir piksellariga o'tkaziladi (masshtab, kesilgan chet, old kamerada ko'zgu) va har tomondan
 * `margin` qadar kengaytiriladi — kod ramka chetida tursa ham o'qilsin. O'lcham noma'lum bo'lsa — kutubxonaning
 * sukut hududi (kichik tomonning 2/3 qismi, markazda).
 */

export type ScanRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  downScaledWidth: number;
  downScaledHeight: number;
};

type Rect = { left: number; top: number; width: number; height: number };

/**
 * Ramka shakli: `square` — QR (sukut); `wide` — shtrix kod rejimi (Trello CO66kcoB): keng past to'rtburchak, zavod
 * kodining ingichka chiziqlari uchun tahlil kadri kattaroq (uzun tomon 640 — modul ~3 px, 400 da EAN-13 ~2 px edi).
 */
export type ScanRegionShape = "square" | "wide";

/** Tahlil uchun kichraytirilgan kadrning uzun tomoni (`qr-scanner` sukuti — 400). */
const DOWNSCALED: Record<ScanRegionShape, number> = { square: 400, wide: 640 };
/** Ramka atrofidagi zaxira (har tomondan, ramka tomoniga nisbatan). */
const MARGIN = 0.1;
/** `wide` sukut hududi: kadr enining 80% i, bo'yi — enining 55% i. */
const WIDE_WIDTH = 0.8;
const WIDE_RATIO = 0.55;

export const defaultScanRegion = (videoWidth: number, videoHeight: number, shape: ScanRegionShape = "square"): ScanRegion => {
  if (shape === "wide") {
    const width = Math.round(videoWidth * WIDE_WIDTH);
    const height = Math.min(videoHeight, Math.round(width * WIDE_RATIO));
    const ratio = Math.min(1, DOWNSCALED.wide / Math.max(width, height));
    return {
      x: Math.round((videoWidth - width) / 2),
      y: Math.round((videoHeight - height) / 2),
      width,
      height,
      downScaledWidth: Math.max(1, Math.round(width * ratio)),
      downScaledHeight: Math.max(1, Math.round(height * ratio)),
    };
  }
  const size = Math.round((2 / 3) * Math.min(videoWidth, videoHeight));
  const scaled = Math.min(DOWNSCALED.square, size);
  return {
    x: Math.round((videoWidth - size) / 2),
    y: Math.round((videoHeight - size) / 2),
    width: size,
    height: size,
    downScaledWidth: scaled,
    downScaledHeight: scaled,
  };
};

export const scanRegionFromFinder = ({
  videoWidth,
  videoHeight,
  videoRect,
  finderRect,
  mirrored = false,
  margin = MARGIN,
  shape = "square",
}: {
  videoWidth: number;
  videoHeight: number;
  videoRect: Rect;
  finderRect: Rect | null;
  mirrored?: boolean;
  margin?: number;
  shape?: ScanRegionShape;
}): ScanRegion => {
  if (
    !finderRect ||
    videoWidth <= 0 ||
    videoHeight <= 0 ||
    videoRect.width <= 0 ||
    videoRect.height <= 0 ||
    finderRect.width <= 0 ||
    finderRect.height <= 0
  ) {
    return defaultScanRegion(videoWidth, videoHeight, shape);
  }
  // object-cover: ekran pikseli → tasvir pikseli.
  const scale = Math.max(videoRect.width / videoWidth, videoRect.height / videoHeight);
  const offsetX = (videoRect.width - videoWidth * scale) / 2;
  const offsetY = (videoRect.height - videoHeight * scale) / 2;
  const pad = Math.max(finderRect.width, finderRect.height) * margin;
  let left = (finderRect.left - pad - videoRect.left - offsetX) / scale;
  const top = (finderRect.top - pad - videoRect.top - offsetY) / scale;
  const width = (finderRect.width + pad * 2) / scale;
  const height = (finderRect.height + pad * 2) / scale;
  // Old kamera ko'zgu qilib ko'rsatiladi (`scaleX(-1)`) — tasvirda chap va o'ng almashgan.
  if (mirrored) left = videoWidth - left - width;

  const x = Math.max(0, Math.round(left));
  const y = Math.max(0, Math.round(top));
  const w = Math.min(videoWidth - x, Math.round(width - (x - left)));
  const h = Math.min(videoHeight - y, Math.round(height - (y - top)));
  if (w < 32 || h < 32) return defaultScanRegion(videoWidth, videoHeight, shape);
  // Tomonlar nisbati saqlanadi (kutubxona talabi), uzun tomon ≤ 400 (`wide` — 640).
  const ratio = Math.min(1, DOWNSCALED[shape] / Math.max(w, h));
  return {
    x,
    y,
    width: w,
    height: h,
    downScaledWidth: Math.max(1, Math.round(w * ratio)),
    downScaledHeight: Math.max(1, Math.round(h * ratio)),
  };
};
