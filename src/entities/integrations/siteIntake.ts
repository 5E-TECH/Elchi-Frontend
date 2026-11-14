import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

/**
 * «TASHQI SAYTLAR» — saytdan QR bo'yicha buyurtma olish va uni Elchi'ga yozish (BeePost «Tashqi buyurtmalar» naqshi).
 *
 * Ikki qadam ATAYLAB ajratilgan (BeePost ham shunday): skan faqat KO'RSATADI (`search-by-qr` — hech narsa
 * yaratmaydi), buyurtma esa operator «Qabul qilish» ni bosgandagina yaratiladi (`orders/external/receive`). Shunda
 * ro'yxatdan olib tashlangan posilka tizimda «yetim» bo'lib qolmaydi.
 *
 * ⚠️ `integrations/:slug/scan-intake` ISHLATILMADI: u saytning javobini `searchByQr` ning `successRes` qobig'i bilan
 * birga buyurtma deb oladi (spec'da qobiqsiz mock), ya'ni amalda telefon topilmay «phone_missing» bilan o'tkazib
 * yuborardi. Bu backend topilmasi — alohida aytilgan.
 */

/**
 * Saytdan QR bo'yicha buyurtma so'rash. Javob — saytning o'z shakli (`response_path` sozlangan bo'lsa o'sha qism),
 * ochish `pages/new_orders/sites/model/siteOrder.ts` → `unwrapSiteOrders` da.
 *
 * Backend qobig'i: `{ statusCode, message, data: { integration, request, raw, data } }` — kerakligi ichki `data`.
 */
export const searchSiteOrderByQr = async (input: {
  slug: string;
  qr: string;
  /** Ulanishda qidiruv manzili sozlanmagan bo'lsa (`qrSearchEndpoint`). */
  endpoint?: string;
}): Promise<unknown> => {
  const body: Record<string, string> = { qr_code: input.qr };
  if (input.endpoint) body.endpoint = input.endpoint;
  const res = await api.post(API_ENDPOINTS.INTEGRATIONS.SEARCH_BY_QR(input.slug), body);
  const envelope = (res.data as { data?: unknown } | undefined)?.data;
  if (envelope && typeof envelope === "object" && !Array.isArray(envelope) && "data" in envelope) {
    return (envelope as { data?: unknown }).data ?? null;
  }
  return envelope ?? null;
};

export type SiteImportSkip = { external_id: string | null; reason: string };

export type SiteImportResult = {
  created: Array<{ id: string; external_id: string | null }>;
  skipped: SiteImportSkip[];
};

/**
 * ⚠️ KICHIK BO'LAKLAR. Backend buyurtmalarni bittalab yaratadi (mijoz, tuman, pochta), gateway esa 15 soniyada
 * uziladi — katta partiya timeout'ga tushib, qaysilari yaratilgani noma'lum qolardi. BeePost 30 talab yuborardi;
 * bizda bitta buyurtma og'irroq, shuning uchun 10.
 */
export const SITE_IMPORT_CHUNK = 10;

const postImport = (integrationId: string, orders: unknown[]): Promise<SiteImportResult> =>
  api.post(API_ENDPOINTS.ORDERS.EXTERNAL_RECEIVE, { integration_id: integrationId, orders }).then((res) => {
    const raw = res.data as { data?: unknown };
    const page = ((raw?.data as { data?: unknown } | undefined)?.data ?? raw?.data) as
      | Partial<SiteImportResult>
      | undefined;
    return {
      created: Array.isArray(page?.created) ? page.created : [],
      skipped: Array.isArray(page?.skipped) ? page.skipped : [],
    };
  });

/**
 * Saytdan olingan buyurtmalarni Elchi'da yaratish (holati `new`, keyin `receive-by-scan` bilan qabul qilinadi).
 *
 * Bo'laklab yuboriladi. Birinchi bo'lak yiqilsa hech narsa yaratilmagan — xato yuqoriga chiqadi. Keyingisi yiqilsa
 * oldingilari ALLAQACHON yaratilgan: ular yo'qotilmaydi, yuborilmaganlar esa `failed` da (sababi bilan) qaytadi.
 */
export const importSiteOrders = async (
  integrationId: string,
  orders: ReadonlyArray<{ key: string; payload: unknown }>,
  send: (chunk: unknown[]) => Promise<SiteImportResult> = (chunk) => postImport(integrationId, chunk),
): Promise<SiteImportResult & { failed: Array<{ key: string; reason: unknown }> }> => {
  const result: SiteImportResult & { failed: Array<{ key: string; reason: unknown }> } = {
    created: [],
    skipped: [],
    failed: [],
  };
  for (let start = 0; start < orders.length; start += SITE_IMPORT_CHUNK) {
    const chunk = orders.slice(start, start + SITE_IMPORT_CHUNK);
    try {
      const part = await send(chunk.map((order) => order.payload));
      result.created.push(...part.created);
      result.skipped.push(...part.skipped);
    } catch (error) {
      if (start === 0) throw error;
      result.failed.push(...orders.slice(start).map((order) => ({ key: order.key, reason: error })));
      break;
    }
  }
  return result;
};
