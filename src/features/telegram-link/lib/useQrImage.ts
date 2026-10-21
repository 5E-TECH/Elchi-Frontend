import { useMemo } from "react";
import QRCode from "qrcode";

const QR_OPTIONS = { type: "svg", margin: 2, errorCorrectionLevel: "M" } as const;

/**
 * Matndan QR rasmi (SVG `data:` manzil). Kutubxonaning sukut ranglari — oq fonda qora modullar: tungi
 * mavzuda ham QR o'z oq maydoni bilan chiziladi va kamera uni o'qiydi (ranglar ataylab berilmaydi).
 *
 * Kanvas kerak emas: SVG satri `qrcode` ning callback ko'rinishida SINXRON quriladi (brauzer va Node
 * yig'malarida ham) — holat/effekt yo'q, rasm oyna bilan birga chiziladi. Xato bo'lsa (juda uzun matn) —
 * `null`: QR umuman chizilmaydi, «Telegram'da ochish» tugmasi baribir qoladi.
 */
export const useQrImage = (value: string | null): string | null =>
  useMemo(() => {
    if (!value) return null;
    let src: string | null = null;
    try {
      QRCode.toString(value, QR_OPTIONS, (error, svg) => {
        if (!error && svg) src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      });
    } catch {
      return null;
    }
    return src;
  }, [value]);
