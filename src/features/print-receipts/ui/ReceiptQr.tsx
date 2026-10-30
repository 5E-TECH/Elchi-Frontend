import { memo, useEffect, useMemo, useState } from "react";

type QrModule = typeof import("../lib/printReceiptQr");

/** `qrcode` kutubxonasi sahifa bo'lagiga kirmaydi: birinchi QR chizilganda dinamik yuklanadi va keshlanadi. */
let loadedQr: QrModule | null = null;
let qrPromise: Promise<QrModule> | null = null;
const loadQr = () => {
  if (!qrPromise) {
    qrPromise = import("../lib/printReceiptQr").then(
      (module) => (loadedQr = module),
      (error: unknown) => {
        qrPromise = null;
        throw error;
      },
    );
  }
  return qrPromise;
};

type Props = {
  /** QR mazmuni — faqat token (paket `BTB-…`, pochta `POST-…`). */
  token: string;
  /** Ekran o'quvchi nomi («B-172 paketining QR kodi»). */
  label: string;
  className?: string;
};

/**
 * Ekrandagi QR (HJ5sLHiz): chek bilan aynan bir xil kod — bayt rejimi, xato tuzatish H, eng kichik versiya
 * (`encodeReceiptQr`), tarmoqsiz (tashqi QR xizmati yo'q). SVG `crispEdges`, modullar `currentColor` — rangni
 * o'ram beradi (skaner uchun och fonda to'q). Tinch zona — o'ramning ichki chekkasi.
 *
 * Kodlovchi (`qrcode`) dinamik yuklanadi: yuklanguncha o'sha `<svg role="img">` bo'sh (`aria-busy`), o'lcham o'ramdan —
 * sahifa sakramaydi.
 */
const ReceiptQr = ({ token, label, className }: Props) => {
  const [qr, setQr] = useState<QrModule | null>(loadedQr);
  useEffect(() => {
    if (qr) return;
    let alive = true;
    loadQr().then(
      (module) => {
        if (alive) setQr(module);
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [qr]);
  const symbol = useMemo(() => (qr ? qr.encodeReceiptQr(token) : null), [qr, token]);
  // Bo'sh token — QR yo'q (avvalgidek hech narsa chizilmaydi; zaxirani chaqiruvchi beradi).
  if (!token.trim()) return null;
  const path = symbol?.runs
    .map(([row, col, length]) => `M${col} ${row}h${length}v1h-${length}z`)
    .join("");
  return (
    <svg
      role="img"
      aria-label={label}
      aria-busy={qr ? undefined : true}
      viewBox={`0 0 ${symbol?.count ?? 1} ${symbol?.count ?? 1}`}
      shapeRendering="crispEdges"
      className={className}
    >
      {path ? <path fill="currentColor" d={path} /> : null}
    </svg>
  );
};

export default memo(ReceiptQr);
