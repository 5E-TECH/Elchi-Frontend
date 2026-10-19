/**
 * `ScannerCamera` alohida bo'lak (chunk) bo'lib yuklanadi: QR kutubxonasi shell bilan birga yuklanmasin.
 * Markaziy «Skaner» tugmasi teginilganda/fokuslanganda oldindan yuklaydi (`preloadScannerCamera`).
 */
export const loadScannerCamera = () => import("./ScannerCamera");

let pending: ReturnType<typeof loadScannerCamera> | null = null;

/** Oldindan yuklash (natijasiz). Yuklanmasa keyingi chaqiruv qayta urinadi. */
export const preloadScannerCamera = () => {
  if (pending) return;
  pending = loadScannerCamera();
  pending.catch(() => {
    pending = null;
  });
};
