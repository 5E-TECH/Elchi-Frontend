import { BASE_URL } from "../../../shared/const";

/**
 * Carrier API'ning ommaviy manzili — shu ilova ishlayotgan API hosti (`VITE_BASE_URL`: prod `api.elchipochta.uz`,
 * test `test-api.elchipochta.uz`). `/carrier/*` va Swagger (`/carrier-docs`) shu host ildizida
 * (`docs/public/CARRIER_API.md` «Baza manzili»). Maketdagi `https://api.elchipochta.uz` — prod qiymati.
 */
export const carrierPublicBaseUrl = (): string => {
  try {
    return new URL(BASE_URL).origin;
  } catch {
    return BASE_URL.replace(/\/+$/, "");
  }
};

export const carrierDocsUrl = (): string => `${carrierPublicBaseUrl()}/carrier-docs`;
