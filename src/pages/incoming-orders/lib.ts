/**
 * Kiruvchi posilkalar ekranining sof mantiqi — React'siz, testga qulay.
 */
import type { IncomingOrder, IncomingSource, ReceiveByScanResult } from "../../entities/incoming-orders";

/**
 * Qabulda qop bo'yicha qabul qilingan posilkalar soni (r8EGkLrP): qop skani belgilagan tokenlardan server
 * qabul qilmaganlari ayriladi. Serverga har posilkaning o'z tokeni ketadi, shuning uchun `batch_tokens`
 * odatda bo'sh; server qop tokenini o'zi ochgan bo'lsa (`batch_tokens` bor) — qabul qilinganlarning hammasi.
 */
export const countReceivedByBag = (bagTokens: ReadonlySet<string>, result: ReceiveByScanResult): number => {
  const failed = result.unmatched.filter((item) => bagTokens.has(item.token)).length;
  const byBag = Math.max(bagTokens.size - failed, 0);
  return byBag === 0 && (result.batchTokens?.length ?? 0) > 0 ? result.received : byBag;
};

/** Kutish birligi: matn ekranda tarjima qilinadi (`waitingText`), mantiq tilga bog'liq emas. */
export type WaitingUnit = "none" | "now" | "today" | "hours" | "days";

export interface Waiting {
  unit: WaitingUnit;
  /** Soatlar (`hours`) yoki kunlar (`days`) soni; boshqa birlikda 0. */
  count: number;
  /** To'liq soatlar — kutish o'lchagichi (`meter`) uchun; sana yo'q yoki kelajakda bo'lsa 0. */
  hours: number;
  /** Uzoq kutgan posilka — e'tibor kerakligini bildiradi. */
  stale: boolean;
}

/**
 * ⚠️ «Unutilgan» chegarasi — UCH KUN (soatlarda). Bir kun normal (posilka yo'lda bo'lishi
 * mumkin), uch kun esa unutilgan degani. Chegara shu yerda, chunki u ekranda uch joyda
 * ishlatiladi (matn, rang va o'lchagichdagi tik chiziq) va hammasi bir xil bo'lishi shart.
 */
export const STALE_HOURS = 72;

/** O'lchagich shkalasi — 4 kun: chegara (3 kun) shkalaning 75% ida turadi (maket `.el-meter-target`). */
export const WAIT_METER_MAX_HOURS = 96;

/**
 * Eng eski posilka qancha kutgani.
 *
 * NEGA KERAK. Unutilib qolgan manba aks holda hech qayerda ko'rinmaydi: soni
 * kichik bo'lsa ro'yxat oxirida turib e'tibordan chetda qolardi va posilkalar
 * omborda haftalab yotishi mumkin edi.
 */
export const waitingFor = (
  iso: string | null | undefined,
  now: number = Date.now(),
): Waiting => {
  const none: Waiting = { unit: "none", count: 0, hours: 0, stale: false };
  if (!iso) return none;

  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return none;

  const ms = now - at;
  // Kelajakdagi sana — server/mijoz vaqti farqi. "minus 2 soat" deb
  // ko'rsatishdan ko'ra "hozir" deyish to'g'ri.
  if (ms < 0) return { unit: "now", count: 0, hours: 0, stale: false };

  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return { unit: "today", count: 0, hours, stale: false };
  if (hours < 24) return { unit: "hours", count: hours, hours, stale: false };

  const days = Math.floor(hours / 24);
  return { unit: "days", count: days, hours, stale: days * 24 >= STALE_HOURS };
};

/** O'lchagich to'lishi, foizda (0–100): shkala 4 kun, undan uzoq kutgan — to'liq. */
export const waitMeterPercent = (waiting: Waiting): number =>
  Math.min(100, (Math.min(waiting.hours, WAIT_METER_MAX_HOURS) / WAIT_METER_MAX_HOURS) * 100);

/** Chegara chizig'ining o'rni (foizda) — `STALE_HOURS / WAIT_METER_MAX_HOURS`. */
export const WAIT_METER_TARGET_PERCENT = (STALE_HOURS / WAIT_METER_MAX_HOURS) * 100;

/**
 * Eng uzoq kutayotgan manba (eng eski `oldest_at`). Sanasi yo'q manbalar hisobga olinmaydi;
 * hech birida sana bo'lmasa — `null` (xulosa bloki chizilmaydi).
 */
export const oldestSource = (sources: readonly IncomingSource[]): IncomingSource | null => {
  let best: IncomingSource | null = null;
  let bestAt = Number.POSITIVE_INFINITY;
  for (const source of sources) {
    if (!source.oldest_at) continue;
    const at = new Date(source.oldest_at).getTime();
    if (Number.isNaN(at) || at >= bestAt) continue;
    best = source;
    bestAt = at;
  }
  return best;
};

/** Posilka raqami: `№1251170`; hamkor raqam bermagan bo'lsa — id'ning boshi (manba qiymati o'zgarmagan). */
export const orderLabel = (order: IncomingOrder): string =>
  `№${order.order_number ? order.order_number : order.id.slice(0, 8)}`;

/** Tuman: mijoz manzilidagi, bo'lmasa buyurtmadagi. */
export const districtName = (order: IncomingOrder): string =>
  order.customer?.district?.name ?? order.district?.name ?? "—";

/* ─── Qop (hamkor qopi) ─────────────────────────────────────────────────────── */

const textOf = (value: unknown): string => (typeof value === "string" || typeof value === "number" ? String(value).trim() : "");

/** Posilkaning o'z QR tokeni (bo'sh bo'lsa — `""`). */
export const parcelToken = (order: IncomingOrder): string => textOf(order.qr_code_token);

/**
 * Qop kaliti — qoplarni sanash uchun: qop QR tokeni (`external_batch_token`), bo'lmasa hamkor qop id'si
 * (`external_batch_ref`); qopsiz posilka — `null`.
 */
export const bagKeyOf = (order: IncomingOrder): string | null =>
  textOf(order.external_batch_token) || textOf(order.external_batch_ref) || null;

/** Token qisqartmasi: ko'pi bilan 8 belgi, uzunroq bo'lsa «…» bilan (maket: «3733ff7b…»). */
const BAG_TOKEN_CHARS = 8;

/**
 * «Qop» ustunidagi yorliq (maket `*-incoming-scan`): hamkor qop id'si («BP-24817»), bo'lmasa qop tokenining
 * boshi («3733ff7b…»); qopsiz posilka — `null` (ekranda «—»).
 */
export const bagLabel = (order: IncomingOrder): string | null => {
  const ref = textOf(order.external_batch_ref);
  if (ref) return ref;
  const token = textOf(order.external_batch_token);
  if (!token) return null;
  return token.length > BAG_TOKEN_CHARS ? `${token.slice(0, BAG_TOKEN_CHARS)}…` : token;
};

/** Ro'yxatdagi qoplar soni (xulosa «N ta · M ta qop»). */
export const countBags = (orders: readonly IncomingOrder[]): number =>
  new Set(orders.map(bagKeyOf).filter((key): key is string => key !== null)).size;

/**
 * RO'YXAT YANGILANGANDA SKAN BELGILARI SAQLANADI (eo3eeJxs).
 *
 * Ilgari har yangilanish («Yangilash», qabuldan keyingi qayta so'rov, oynaga qaytish) belgilarni jimgina
 * o'chirardi: operator yarim qopni skanerlab, ro'yxatni yangilasa — qaytadan boshlardi. Endi belgi yangi
 * ro'yxatda HALI BOR posilkalarda qoladi (kesishma); ro'yxatdan chiqqan (qabul qilingan, boshqa joyda olingan)
 * posilka belgisi va tokeni olib tashlanadi — serverga ro'yxatda yo'q token ketmaydi.
 *
 * O'zgarish bo'lmasa — o'sha obyektlar qaytadi (jadval qayta chizilmaydi).
 */
export const keepScannedInList = (
  orders: readonly IncomingOrder[],
  scannedIds: ReadonlySet<string>,
  scannedTokens: readonly string[],
): { ids: ReadonlySet<string>; tokens: readonly string[] } => {
  const ids = new Set<string>();
  const tokens = new Set<string>();
  for (const order of orders) {
    if (!scannedIds.has(order.id)) continue;
    ids.add(order.id);
    const token = parcelToken(order);
    if (token) tokens.add(token);
  }
  const keptTokens = scannedTokens.filter((token) => tokens.has(token));
  return {
    ids: ids.size === scannedIds.size ? scannedIds : ids,
    tokens: keptTokens.length === scannedTokens.length ? scannedTokens : keptTokens,
  };
};

/* ─── Manbalar taqsimoti (donut, segment chizig'i, legenda) ─────────────────── */

/**
 * Grafik bo'laklari ko'pi bilan 6 ta (maket qoidasi `tizim-charts`): manba 6 tadan ko'p bo'lsa,
 * birinchi 5 tasi o'z rangida, qolganlari bitta «Boshqa» bo'lagiga (`chart-muted`) yig'iladi.
 * Ranglar ro'yxat tartibida beriladi (aylantirilmaydi) — jadvaldagi rang belgisi ham shu.
 */
export const MAX_SOURCE_SLICES = 6;

export type SourceSlice = {
  key: string;
  /** `null` — «Boshqa» bo'lagi (nomini sahifa tarjima qiladi). */
  source: IncomingSource | null;
  value: number;
  /** 0-dan boshlangan palitra o'rni; `null` — `chart-muted`. */
  colorIndex: number | null;
};

export const sourceSlices = (sources: readonly IncomingSource[]): SourceSlice[] => {
  const own = sources.length > MAX_SOURCE_SLICES ? MAX_SOURCE_SLICES - 1 : sources.length;
  const slices: SourceSlice[] = sources.slice(0, own).map((source, index) => ({
    key: String(source.market_id),
    source,
    value: Number(source.orders_count) || 0,
    colorIndex: index,
  }));
  if (sources.length > own) {
    const rest = sources.slice(own).reduce((sum, source) => sum + (Number(source.orders_count) || 0), 0);
    slices.push({ key: "__other", source: null, value: rest, colorIndex: null });
  }
  return slices;
};

/** Manbaning rang o'rni (jadvaldagi belgi uchun): «Boshqa» ga tushganlari — `null`. */
export const sourceColorIndex = (sources: readonly IncomingSource[], index: number): number | null => {
  const own = sources.length > MAX_SOURCE_SLICES ? MAX_SOURCE_SLICES - 1 : sources.length;
  return index < own ? index : null;
};

export type DonutArc = { key: string; colorIndex: number | null; length: number; offset: number };

/**
 * Halqa bo'laklari (SVG `stroke-dasharray`): soat 12 dan soat strelkasi bo'yicha, orada 2 px bo'shliq
 * (bitta bo'lak bo'lsa — bo'shliqsiz to'liq halqa). Nol qiymatli bo'lak chizilmaydi.
 */
export const donutArcs = (slices: readonly SourceSlice[], circumference: number, gap = 2): DonutArc[] => {
  const visible = slices.filter((slice) => slice.value > 0);
  const sum = visible.reduce((acc, slice) => acc + slice.value, 0);
  if (!sum) return [];
  const gaps = visible.length > 1 ? gap : 0;
  const available = circumference - gaps * visible.length;
  let offset = 0;
  return visible.map((slice) => {
    const length = (slice.value / sum) * available;
    const arc = { key: slice.key, colorIndex: slice.colorIndex, length, offset };
    offset += length + gaps;
    return arc;
  });
};
