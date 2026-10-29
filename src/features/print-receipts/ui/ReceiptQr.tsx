import { memo, useMemo } from "react";
import { encodeReceiptQr } from "../lib/printReceiptQr";

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
 */
const ReceiptQr = ({ token, label, className }: Props) => {
  const symbol = useMemo(() => encodeReceiptQr(token), [token]);
  if (!symbol) return null;
  const path = symbol.runs
    .map(([row, col, length]) => `M${col} ${row}h${length}v1h-${length}z`)
    .join("");
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${symbol.count} ${symbol.count}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <path fill="currentColor" d={path} />
    </svg>
  );
};

export default memo(ReceiptQr);
