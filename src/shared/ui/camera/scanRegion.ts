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

/** Tahlil uchun kichraytirilgan kvadrat tomoni (`qr-scanner` sukuti — 400). */
const DOWNSCALED = 400;
/** Ramka atrofidagi zaxira (har tomondan, ramka tomoniga nisbatan). */
const MARGIN = 0.1;

export const defaultScanRegion = (videoWidth: number, videoHeight: number): ScanRegion => {
  const size = Math.round((2 / 3) * Math.min(videoWidth, videoHeight));
  const scaled = Math.min(DOWNSCALED, size);
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
}: {
  videoWidth: number;
  videoHeight: number;
  videoRect: Rect;
  finderRect: Rect | null;
  mirrored?: boolean;
  margin?: number;
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
    return defaultScanRegion(videoWidth, videoHeight);
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
  if (w < 32 || h < 32) return defaultScanRegion(videoWidth, videoHeight);
  // Tomonlar nisbati saqlanadi (kutubxona talabi), uzun tomon ≤ 400.
  const ratio = Math.min(1, DOWNSCALED / Math.max(w, h));
  return {
    x,
    y,
    width: w,
    height: h,
    downScaledWidth: Math.max(1, Math.round(w * ratio)),
    downScaledHeight: Math.max(1, Math.round(h * ratio)),
  };
};
