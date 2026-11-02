import { useCallback } from "react";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import { httpStatusOf } from "../model/districtMerge";
import { normalizeSatoOwner } from "../model/satoModel";

/**
 * `GET district/sato/:code` natijasi: kod band, egasi ma'lum · kod band, egasi o'qilmadi (200, lekin javobda
 * id/nom yo'q) · hech kimniki emas (404) · aniqlab bo'lmadi (5xx, aloqa).
 */
export type SatoCodeOwner =
  | { kind: "owner"; id: string; name: string; regionName: string | null }
  | { kind: "taken" }
  | { kind: "none" }
  | { kind: "unknown" };

/**
 * 409 (sababsiz) ni ajratish uchun kod egasini so'raydi (`/regions/districts` «Yangi tuman qo'shish», SATO tabidagi
 * «Tuman qo'shish» oynasi va kod muharriri). Backend 409 ni nom band bo'lganda ham, kod band bo'lganda ham beradi:
 * 200 — kod band (egasi o'qilsa — nomi bilan); 404 — kod bo'sh, demak nom band; boshqa xato — sabab noma'lum
 * (taxmin qilinmaydi).
 */
export const useSatoCodeOwner = () =>
  useCallback(async (code: string): Promise<SatoCodeOwner> => {
    try {
      const owner = normalizeSatoOwner((await api.get(API_ENDPOINTS.DISTRICTS.SATO_BY_CODE(code))).data);
      return owner ? { kind: "owner", ...owner } : { kind: "taken" };
    } catch (error) {
      return httpStatusOf(error) === 404 ? { kind: "none" } : { kind: "unknown" };
    }
  }, []);
