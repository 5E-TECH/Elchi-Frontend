import type { LookupStock, MarketRef, WarehouseLookupItem, WarehouseProduct } from "../../../../entities/warehouse";

/** Backend chegarasi (`qty`, `counted` — 100 000 dan oshmaydi; bir yuborishda ≤ 200 qator). */
export const MAX_LINE_QTY = 100_000;
export const MAX_LINES = 200;

/** Hal qilingan qator — mahsulot topildi. `qty` — kirimda qo'shiladigan, inventarizatsiyada sanalgan dona. */
export type ScanItemLine = {
  kind: "item";
  /** Mahsulot id (bir mahsulot — bitta qator). */
  key: string;
  product: WarehouseProduct;
  market: MarketRef;
  /** Shu ombordagi hozirgi qoldiq (`null` — omborda hali yo'q, «0 · yangi»). */
  stock: LookupStock | null;
  qty: number;
  /** «+1 · qayta skan» yoki «Kod bog'landi». */
  badge: "rescan" | "linked" | null;
};

/**
 * Hal qilinmagan skan (yuborilmaydi): `unlinked` — zavod shtrix kodi hech qaysi mahsulotga bog'lanmagan («Mahsulotga
 * bog'lash»), `notFound` — Elchi kodi / matn topilmadi, `ambiguous` — kod bir nechta marketda (marketni tanlash),
 * `failed` — so'rov bajarilmadi (qayta urinish).
 */
export type ScanIssueLine = {
  kind: "unlinked" | "notFound" | "ambiguous" | "failed";
  key: string;
  code: string;
  candidates: WarehouseLookupItem[];
};

export type ScanLine = ScanItemLine | ScanIssueLine;

export type ScanLinesAction =
  | {
      type: "item";
      item: WarehouseLookupItem;
      /** Qaysi skan shu bilan hal bo'ldi (bog'lash, market tanlash) — o'sha muammo qatori olinadi. */
      resolves?: string;
      badge?: "linked";
      /** Yangi qator boshlang'ich soni (sukut 1). Mavjud qatorda — +1. */
      initialQty?: number;
    }
  | { type: "issue"; kind: ScanIssueLine["kind"]; code: string; candidates?: WarehouseLookupItem[] }
  | { type: "qty"; key: string; qty: number }
  | { type: "remove"; key: string }
  | { type: "reset" };

export const issueKey = (code: string) => `code:${code.toUpperCase()}`;

const clampQty = (qty: number) => Math.min(MAX_LINE_QTY, Math.max(0, Math.trunc(Number.isFinite(qty) ? qty : 0)));

/**
 * Skanlar ro'yxati (kirim va inventarizatsiya). Oxirgi skan — yuqorida (maket «Oxirgi skan — yuqorida»). Bir
 * mahsulotni qayta skanerlash yangi qator emas — miqdor +1 va «+1 · qayta skan» belgisi.
 */
export const scanLinesReducer = (lines: ScanLine[], action: ScanLinesAction): ScanLine[] => {
  switch (action.type) {
    case "item": {
      const key = action.item.product.id;
      const resolved = action.resolves ? issueKey(action.resolves) : null;
      const rest = lines.filter((line) => line.key !== key && line.key !== resolved);
      const existing = lines.find((line): line is ScanItemLine => line.kind === "item" && line.key === key);
      const next: ScanItemLine = existing
        ? {
            ...existing,
            stock: action.item.stock,
            qty: clampQty(existing.qty + 1),
            badge: action.badge ?? "rescan",
          }
        : {
            kind: "item",
            key,
            product: action.item.product,
            market: action.item.market,
            stock: action.item.stock,
            qty: clampQty(action.initialQty ?? 1),
            badge: action.badge ?? null,
          };
      return [next, ...rest];
    }
    case "issue": {
      const key = issueKey(action.code);
      return [
        { kind: action.kind, key, code: action.code, candidates: action.candidates ?? [] },
        ...lines.filter((line) => line.key !== key),
      ];
    }
    case "qty":
      return lines.map((line) =>
        line.kind === "item" && line.key === action.key ? { ...line, qty: clampQty(action.qty), badge: null } : line,
      );
    case "remove":
      return lines.filter((line) => line.key !== action.key);
    case "reset":
      return [];
    default:
      return lines;
  }
};

export const itemLines = (lines: readonly ScanLine[]): ScanItemLine[] =>
  lines.filter((line): line is ScanItemLine => line.kind === "item");

export const issueLines = (lines: readonly ScanLine[]): ScanIssueLine[] =>
  lines.filter((line): line is ScanIssueLine => line.kind !== "item");

export const totalQty = (lines: readonly ScanLine[]) => itemLines(lines).reduce((sum, line) => sum + line.qty, 0);

/**
 * Yuboriladigan tarkibning barmoq izi (`Idempotency-Key` shunga bog'lanadi): qatorlar mahsulot id bo'yicha
 * tartiblanadi — skan tartibi o'zgarsa ham tarkib bir xil.
 */
export const linesFingerprint = (lines: readonly ScanLine[], extra: Record<string, unknown> = {}) =>
  JSON.stringify([
    itemLines(lines)
      .map((line) => [line.key, line.qty] as const)
      .sort(([a], [b]) => a.localeCompare(b)),
    extra,
  ]);
