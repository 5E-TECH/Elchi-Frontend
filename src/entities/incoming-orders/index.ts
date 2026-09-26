import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { getBackendErrorMessage } from "../../shared/lib/backendError";

/**
 * Hamkor tizimlardan (BeePost va h.k.) kelgan buyurtmalar.
 *
 * Backend `GET /orders/external` — `source = external` bo'yicha filtrlangan
 * odatdagi buyurtma ro'yxati. Hamkor Partner API orqali posilka yaratganda
 * buyurtma shu ro'yxatda `new` holatida paydo bo'ladi va HQ operatori uni
 * skanerlab tizimga qabul qiladi.
 *
 * Rollar (gateway guardi): SUPERADMIN · ADMIN · REGISTRATOR · MARKET.
 */
export type IncomingOrder = {
  id: string;
  order_number?: number | null;
  status?: string | null;
  total_price?: number | null;
  qr_code_token?: string | null;
  /** Hamkor tomonidagi buyurtma id'si (bizga `external_id` bo'lib keladi). */
  external_id?: string | null;
  customer?: {
    name?: string | null;
    phone_number?: string | null;
    district?: { name?: string | null } | null;
  } | null;
  district?: { name?: string | null } | null;
  market?: { name?: string | null } | null;
};

export type IncomingOrdersParams = {
  status?: string | string[];
  market_id?: string;
};

export type IncomingOrdersList = {
  items: IncomingOrder[];
  /** Server aytgan jami son (bo'lmasa — yuklangan qatorlar soni). */
  total: number;
};

export const incomingOrdersKey = "incoming-external-orders";

/**
 * ⚠️ BACKEND `limit` NI FAQAT 10/25/50/100 QABUL QILADI (gateway
 * `parsePaginationQuery`), boshqa qiymatga 400 qaytadi. Skaner esa
 * manbaning BARCHA kutayotgan posilkalarini bilishi shart — aks holda
 * 100-dan keyingi posilka "ro'yxatda yo'q" deb rad etilardi. Shu sabab
 * sahifalar `total` ga yetguncha ketma-ket olinib, bitta ro'yxatga
 * birlashtiriladi.
 */
export const INCOMING_PAGE_LIMIT = 100;
/** Cheksiz tsikldan himoya: 20 × 100 = 2000 posilka. */
const INCOMING_MAX_PAGES = 20;

const readTotal = (raw: unknown): number | undefined => {
  const body = raw as { total?: unknown; data?: { meta?: { total?: unknown } } } | undefined;
  const value = Number(body?.total ?? body?.data?.meta?.total);
  return Number.isFinite(value) ? value : undefined;
};

export const fetchAllIncomingOrders = async (
  params?: IncomingOrdersParams,
): Promise<IncomingOrdersList> => {
  const items: IncomingOrder[] = [];
  let total: number | undefined;

  for (let page = 1; page <= INCOMING_MAX_PAGES; page += 1) {
    const res = await api.get(API_ENDPOINTS.ORDERS.EXTERNAL, {
      params: { ...params, page, limit: INCOMING_PAGE_LIMIT },
    });
    const pageItems = extractIncomingOrders(res.data);
    items.push(...pageItems);
    total = readTotal(res.data) ?? total;

    if (pageItems.length < INCOMING_PAGE_LIMIT || (total !== undefined && items.length >= total)) {
      break;
    }
  }

  return { items, total: total ?? items.length };
};

export const useIncomingExternalOrders = (params?: IncomingOrdersParams) =>
  useQuery({
    queryKey: [incomingOrdersKey, params],
    queryFn: () => fetchAllIncomingOrders(params),
  });

/**
 * Ro'yxatni javob qobig'idan ochib oladi.
 *
 * Qobiq qatlamlarga qarab farq qiladi (`data.data.items` / `data.items` /
 * to'g'ridan-to'g'ri massiv), shu bois HIMOYALANGAN ochish — bir qatlam
 * o'zgarsa sahifa bo'sh ko'rinib qolmasin.
 */
export const extractIncomingOrders = (raw: unknown): IncomingOrder[] => {
  const candidates = [
    (raw as { data?: { items?: unknown } })?.data?.items,
    (raw as { data?: unknown })?.data,
    (raw as { items?: unknown })?.items,
    raw,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as IncomingOrder[];
  }
  return [];
};

/**
 * KIRUVCHI POSILKALARNING MANBALARI.
 *
 * Ekran ilgari barcha tashqi buyurtmani bitta ro'yxatda ko'rsatardi. Amalda
 * faqat bitta hamkor (BeePost) yuborgani uchun ekran o'shanga moslangandek
 * ko'rinardi, lekin ikkinchi manba qo'shilishi bilan operator qo'lida bir
 * manbaning qopi turib, ro'yxatda boshqasining posilkasini ham ko'rardi.
 *
 * Endi avval manba tanlanadi.
 *
 * ⚠️ Ro'yxat BUYURTMALARNING O'ZIDAN chiqadi, ulanishlar sozlamasidan emas.
 * Shu bois: posilkasi yo'q manba ro'yxatda ko'rinmaydi, va sozlamasi
 * o'chirilgan bo'lsa ham kutayotgan posilka YASHIRILMAYDI — u haqiqatan
 * omborda turgan bo'lishi mumkin.
 */
export type IncomingSource = {
  market_id: string;
  orders_count: number;
  total_price_sum: number;
  /** Eng eski kutayotgan posilka sanasi (ISO) yoki `null`. */
  oldest_at: string | null;
  market?: { id?: string; name?: string | null } | null;
};

export const incomingSourcesKey = "incoming-external-sources";

export const useIncomingSources = () =>
  useQuery({
    queryKey: [incomingSourcesKey],
    queryFn: () =>
      api
        .get(API_ENDPOINTS.ORDERS.EXTERNAL_SOURCES)
        .then((res) => extractIncomingSources(res.data)),
  });

/** Qobiq qatlamlari marshrutga qarab farq qiladi — himoyalangan ochish. */
export const extractIncomingSources = (raw: unknown): IncomingSource[] => {
  const candidates = [
    (raw as { data?: { data?: unknown } })?.data?.data,
    (raw as { data?: unknown })?.data,
    raw,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as IncomingSource[];
  }
  return [];
};

/** Manba nomi — nom yechilmagan bo'lsa ham foydali matn qaytadi. */
export const sourceLabel = (source: IncomingSource): string =>
  source.market?.name?.trim() || `Market #${source.market_id}`;

/**
 * SKANERLANGAN POSILKALARNI QABUL QILISH.
 *
 * ⚠️ SERVERGA TOKEN YUBORILADI, `order_ids` EMAS.
 *
 * Ilgari frontend skanerlangan tokenni O'ZI buyurtmaga moslab, serverga
 * id'lar yuborardi. Ya'ni server skanerlash bo'lgan-bo'lmaganini BILMASDI
 * va darvozani boshqa ekrandan yoki to'g'ridan-to'g'ri API'dan chetlab
 * o'tish mumkin edi (audit K2). Endi dalil serverda tekshiriladi.
 *
 * Javobda `unmatched` — qabul qilinmagan tokenlar SABABI bilan. Ularni
 * ko'rsatish SHART: aks holda operator "hammasi qabul qilindi" deb o'ylab,
 * qolib ketgan posilkani sezmaydi.
 */
export interface ReceiveByScanResult {
  received: number;
  unmatched: Array<{ token: string; reason: string }>;
}

/**
 * ⚠️ BACKEND BIR SO'ROVDA 200 TADAN ORTIQ TOKENNI RAD ETADI (400 "bir
 * so'rovda 200 tadan ko'p token yuborib bo'lmaydi"). Ilgari hamma skanerlangan
 * tokenlar bitta so'rovda ketardi — 200 dan ko'p posilka skanerlangan qop
 * umuman qabul qilinmasdi. Endi tokenlar 200 tadan bo'lib ketma-ket
 * yuboriladi va natijalar jamlanadi.
 */
export const RECEIVE_BY_SCAN_MAX_TOKENS = 200;

const postReceiveByScan = (tokens: string[]): Promise<ReceiveByScanResult> =>
  api
    .post(API_ENDPOINTS.ORDERS.EXTERNAL_RECEIVE_BY_SCAN, { tokens })
    .then((res) => {
      const raw = res.data as { data?: unknown };
      const inner = (raw?.data as { data?: unknown })?.data ?? raw?.data;
      const page = inner as Partial<ReceiveByScanResult> | undefined;
      return {
        received: Number(page?.received ?? 0),
        unmatched: Array.isArray(page?.unmatched) ? page!.unmatched : [],
      } satisfies ReceiveByScanResult;
    });

/**
 * Bo'laklab qabul qilish. Birinchi bo'lak yiqilsa hech narsa qabul
 * qilinmagan — xato odatdagidek yuqoriga chiqadi. Keyingi bo'lak yiqilsa
 * oldingilari ALLAQACHON qabul qilingan: ularni yo'qotmaslik uchun natija
 * qaytariladi, yuborilmay qolgan tokenlar esa sababi bilan `unmatched` ga
 * qo'shiladi (operator qisman qabulni ko'rsin).
 */
export const receiveTokensInChunks = async (
  tokens: string[],
  send: (chunk: string[]) => Promise<ReceiveByScanResult> = postReceiveByScan,
): Promise<ReceiveByScanResult> => {
  const result: ReceiveByScanResult = { received: 0, unmatched: [] };

  for (let start = 0; start < tokens.length; start += RECEIVE_BY_SCAN_MAX_TOKENS) {
    const chunk = tokens.slice(start, start + RECEIVE_BY_SCAN_MAX_TOKENS);
    try {
      const part = await send(chunk);
      result.received += part.received;
      result.unmatched.push(...part.unmatched);
    } catch (error) {
      if (start === 0) throw error;
      const reason = getBackendErrorMessage(error) ?? "yuborib bo'lmadi";
      result.unmatched.push(...tokens.slice(start).map((token) => ({ token, reason })));
      break;
    }
  }

  return result;
};

export const useReceiveByScan = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (tokens: string[]) => receiveTokensInChunks(tokens),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [incomingOrdersKey] });
      client.invalidateQueries({ queryKey: [incomingSourcesKey] });
    },
  });
};
