import { useQueries } from "@tanstack/react-query";
import { api, LONG_REQUEST_TIMEOUT_MS } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import { resolveAssetUrl } from "../../../shared/lib/assetUrl";

/**
 * BUYURTMA DALILLARI (`order.proof_files`).
 *
 * Kuryer sotish / qisman sotish / bekor qilishda rasm yoki video biriktiradi,
 * backend kalitlarni buyurtmaning `proof_files` ro'yxatiga yozadi. Ilgari
 * frontend bu maydonni umuman o'qimasdi — nizo chiqqanda dalilni faqat
 * bazadan topish mumkin edi.
 *
 * ⚠️ OCHIQ `files/view/:key` ISHLAMAYDI: backend u yerda faqat katalog va
 * paket rasmlarini beradi, `proof-...` kalitiga 403 qaytaradi.
 *
 * ⚠️ IMZOLANGAN URL HAM PROD'DA OCHILMAYDI: `GET files/:key` MinIO'ning ICHKI
 * manzilini (`http://minio:9000/...`) imzolaydi, MinIO esa tashqariga chiqarilmagan
 * (faqat `api.elchipochta.uz → api-gateway` tunnel). Shu sabab fayl baytlari
 * JWT bilan himoyalangan `GET files/:key/content` dan olinadi va `blob:` URL
 * bilan ko'rsatiladi. Bu endpoint hali deploy qilinmagan bo'lsa (404/405) —
 * avvalgi imzolangan URL (MinIO ochiq bo'lgan muhitda ishlaydi).
 */

export type ProofKind = "image" | "video" | "file";

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|avif|heic|heif)$/i;
const VIDEO_EXT = /\.(mp4|mov|webm|m4v|3gp|mkv|avi|ogv)$/i;

/** Kengaytma bo'yicha — imzolangan URL'ni olishdan OLDIN ham ma'lum. */
export const proofKind = (key: string): ProofKind => {
  const clean = key.split(/[?#]/)[0] ?? key;
  if (IMAGE_EXT.test(clean)) return "image";
  if (VIDEO_EXT.test(clean)) return "video";
  return "file";
};

/** Yaroqli, takrorsiz kalitlar — buzuq qiymat karta chiqarmaydi. */
export const readProofFiles = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const keys = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(keys)];
};

/**
 * Ko'rsatish uchun nom: `proof-<vaqt>-<uuid>-Asl_nom.png` → `Asl_nom.png`.
 * Prefiks shakli boshqacha bo'lsa kalitning o'zi qaytadi.
 */
export const proofFileName = (key: string): string => {
  const match = /^proof-\d+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i.exec(key);
  return match?.[1] || key;
};

/** Imzolangan URL muddati (soniya) — kesh undan oldin eskiradi. */
const URL_TTL_SECONDS = 3600;

const readSignedUrl = (payload: unknown): string => {
  const outer = (payload ?? {}) as { data?: unknown; url?: unknown };
  const data = (outer.data ?? outer) as { url?: unknown; data?: { url?: unknown } };
  const url = data.url ?? data.data?.url;
  if (typeof url !== "string" || !url) throw new Error("signed-url-missing");
  return resolveAssetUrl(url) ?? url;
};

export const proofFileUrlKey = (key: string) => ["order-proof-file-url", key] as const;

// Har kalit uchun oxirgi `blob:` URL — yangisi yaratilganda eskisi bo'shatiladi.
const objectUrlByKey = new Map<string, string>();

const toObjectUrl = (key: string, blob: Blob) => {
  const previous = objectUrlByKey.get(key);
  if (previous) URL.revokeObjectURL(previous);
  const url = URL.createObjectURL(blob);
  objectUrlByKey.set(key, url);
  return url;
};

const isMissingEndpoint = (error: unknown) => {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 404 || status === 405 || status === 501;
};

const fetchSignedUrl = (key: string) =>
  api
    .get(API_ENDPOINTS.FILES.BY_KEY(encodeURIComponent(key)), {
      params: { expires_in: URL_TTL_SECONDS },
    })
    .then((res) => readSignedUrl(res.data));

/**
 * Brauzer ocha oladigan URL: avval `files/:key/content` (baytlar → `blob:`),
 * endpoint yo'q bo'lsa — imzolangan URL. 403 (ruxsat yo'q) va boshqa xatolar
 * plitkada "ochib bo'lmadi" bo'lib chiqadi.
 */
export const fetchProofFileUrl = async (key: string): Promise<string> => {
  try {
    const res = await api.get<Blob>(API_ENDPOINTS.FILES.CONTENT(encodeURIComponent(key)), {
      responseType: "blob",
      timeout: LONG_REQUEST_TIMEOUT_MS,
    });
    return toObjectUrl(key, res.data);
  } catch (error) {
    if (isMissingEndpoint(error)) return fetchSignedUrl(key);
    throw error;
  }
};

/**
 * Har bir kalit uchun imzolangan URL. Bir kalitning xatosi (403, fayl yo'q)
 * qolganlarini to'smaydi — har plitka o'z holatini ko'rsatadi.
 */
export const useProofFileUrls = (keys: string[]) =>
  useQueries({
    queries: keys.map((key) => ({
      queryKey: proofFileUrlKey(key),
      queryFn: () => fetchProofFileUrl(key),
      // URL muddati tugashidan oldin qayta so'raladi.
      staleTime: (URL_TTL_SECONDS - 600) * 1000,
      gcTime: (URL_TTL_SECONDS - 300) * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      // Xato plitkada ko'rsatiladi — global toast bilan bezovta qilinmaydi.
      meta: { silentError: true },
    })),
  });
