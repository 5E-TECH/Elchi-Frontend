import QRCode from "qrcode";

/**
 * CHEK QR KODI (HJ5sLHiz, maket `tizim-receipts` «QR qoidasi», TZ F5). Ilova ichida `qrcode` bilan — tarmoq yo'q
 * (tashqi QR xizmati olib tashlandi). Mazmun — faqat token (prefiks / URL / id qo'shilmaydi), bayt rejimi, xato
 * tuzatish H, eng kichik versiya: buyurtma tokeni (24 hex), `POST-…` (22), `BTB-`/`BTR-` (18) → V3 (29×29),
 * `CANCEL-…` (27) → V4 (33×33). Logo yo'q.
 *
 * Chizish uchun qatordagi qo'shni qora modullar bitta to'g'ri to'rtburchakka birlashtiriladi (`runs`): PDF'da har biri
 * bitta `rect`, HTML'da SVG `path` (`crispEdges`).
 */

/** Qatordagi qora bo'lak: [qator, boshlang'ich ustun, uzunlik] (modulda). */
export type ReceiptQrRun = readonly [row: number, col: number, length: number];

export interface ReceiptQrSymbol {
  version: number;
  /** Bir tomondagi modul soni (V3 — 29). */
  count: number;
  runs: ReadonlyArray<ReceiptQrRun>;
}

/** Termal printer: 203 DPI — 1 nuqta = 0,125 mm (maket «Qog'oz va printer»). */
export const THERMAL_DOT_MM = 25.4 / 203.2;

/** Token → QR modullari. Bo'sh token — `null` (chekda «QR yo'q» ramkasi; `id` kodlanmaydi). */
export const encodeReceiptQr = (token: string | null | undefined): ReceiptQrSymbol | null => {
  const data = typeof token === "string" ? token.trim() : "";
  if (!data) return null;
  const code = QRCode.create([{ data: new TextEncoder().encode(data), mode: "byte" }], {
    errorCorrectionLevel: "H",
  });
  const { size, data: cells } = code.modules;
  const runs: ReceiptQrRun[] = [];
  for (let row = 0; row < size; row += 1) {
    let col = 0;
    while (col < size) {
      if (!cells[row * size + col]) {
        col += 1;
        continue;
      }
      const start = col;
      while (col < size && cells[row * size + col]) col += 1;
      runs.push([row, start, col - start]);
    }
  }
  return { version: code.version, count: size, runs };
};

/**
 * Modul o'lchami (mm): butun nuqtali (6 → 5 → 4 nuqta, termal) va qutiga sig'adigan eng kattasi. Buyurtma termal:
 * V3 × 6 nuqta = 21,75 mm; V4 (33) 6 nuqtada sig'maydi → 5 nuqta (20,6 mm), qutida markazda.
 * `dots` bo'sh bo'lsa (A4 / A5 — ofis printeri) — quti modul soniga teng bo'linadi.
 */
export const receiptQrModule = (
  count: number,
  boxMm: number,
  dots: ReadonlyArray<number> = [],
): number => {
  for (const dot of dots) {
    const module = dot * THERMAL_DOT_MM;
    if (module * count <= boxMm + 1e-6) return module;
  }
  return boxMm / count;
};
