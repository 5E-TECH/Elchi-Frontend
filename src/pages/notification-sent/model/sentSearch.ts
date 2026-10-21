import { isDispatchHistoryStatus, type DispatchHistoryStatus } from "../../../entities/notification-dispatch";

/**
 * «Yuborilganlar» holati URL'da (NS-2): `?status=` (Natija), `?created_by=` (Kim yubordi — foydalanuvchi id'si),
 * `?page=` va ochiq tafsilot oynasi `?id=` (dispatch_id — havola bilan ulashiladi; tarixda yo'q bo'lsa oyna «Xabar
 * topilmadi»). Noto'g'ri qiymat e'tiborga olinmaydi (backend 400 bermasin).
 */

export type SentFilters = {
  status: DispatchHistoryStatus | "";
  author: string;
};

export type SentSearch = {
  filters: SentFilters;
  page: number;
  openId: string | null;
};

export const EMPTY_SENT_FILTERS: SentFilters = { status: "", author: "" };

const AUTHOR_RE = /^\d+$/;
/** Backend `DISPATCH_ID_RE` bilan bir xil. */
const DISPATCH_ID_RE = /^[\w.:-]{1,100}$/;

export const parseSentSearch = (params: URLSearchParams): SentSearch => {
  const status = params.get("status") ?? "";
  const author = params.get("created_by") ?? "";
  const page = Number(params.get("page"));
  const openId = params.get("id") ?? "";
  return {
    filters: {
      status: isDispatchHistoryStatus(status) ? status : "",
      author: AUTHOR_RE.test(author) ? author : "",
    },
    page: Number.isInteger(page) && page > 1 ? page : 1,
    openId: DISPATCH_ID_RE.test(openId) ? openId : null,
  };
};

export type SentSearchPatch = Partial<SentFilters> & { page?: number; openId?: string | null };

/**
 * Yangi URL parametrlari. Filtr qiymati o'zgarsa — 1-sahifa (o'sha qiymat qayta yuborilsa sahifa saqlanadi). Bo'sh qiymat va 1-sahifa URL'ga yozilmaydi; boshqa (begona)
 * parametrlar saqlanadi.
 */
export const applySentSearch = (current: URLSearchParams, patch: SentSearchPatch): URLSearchParams => {
  const next = new URLSearchParams(current);
  const set = (key: string, value: string | null | undefined) => {
    if (value) next.set(key, value);
    else next.delete(key);
  };
  // Faqat qiymat haqiqatan o'zgarsa 1-sahifaga (telefon varaqasi ikkala kalitni ham yuboradi).
  const changed = (key: string, value: string | undefined) => value !== undefined && value !== (current.get(key) ?? "");
  const filtersChanged = changed("status", patch.status) || changed("created_by", patch.author);
  if (patch.status !== undefined) set("status", patch.status);
  if (patch.author !== undefined) set("created_by", patch.author);
  if (filtersChanged) next.delete("page");
  if (patch.page !== undefined) set("page", patch.page > 1 ? String(patch.page) : null);
  if (patch.openId !== undefined) set("id", patch.openId);
  return next;
};

export const countSentFilters = (filters: SentFilters) => (filters.status ? 1 : 0) + (filters.author ? 1 : 0);
