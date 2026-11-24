import { useQuery } from "@tanstack/react-query";
import { api } from "../../../../shared/api/api";
import { API_ENDPOINTS } from "../../../../shared/api";
import { silentErrorMeta } from "../../../../shared/lib/queryErrorEvents";
import { toSiteDistricts } from "./siteEdit";

/** Barcha tumanlar (SOATO kodi va xizmat viloyati bilan) — sayt kodini nomga aylantirish va qo'lda tanlash uchun. */
export const useSiteDistricts = () =>
  useQuery({
    queryKey: ["site-districts"],
    queryFn: () => api.get(API_ENDPOINTS.DISTRICTS.BASE).then((res) => toSiteDistricts(res.data)),
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    // Kelmasa sahifa ishlayveradi (tuman tekshirilmaydi) — global xabar chiqmaydi.
    ...silentErrorMeta({ silentError: true }),
  });
