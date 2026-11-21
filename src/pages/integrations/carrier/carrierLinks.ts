import { PUBLIC_API_URL } from "../../../shared/const";

/**
 * Carrier API'ning ommaviy manzili — API hostining o'zi (prod `api.elchipochta.uz`, test `test-api.elchipochta.uz`).
 * `/carrier/*` va Swagger (`/carrier-docs`) shu host ildizida (`docs/public/CARRIER_API.md` «Baza manzili»).
 * Kabinet API'ga bir domen orqali (`VITE_BASE_URL=/api/`) murojaat qilsa ham tashqi yetkazuvchiga kabinet domeni
 * emas, API hosti ko'rsatiladi (`PUBLIC_API_URL`, `.env.staging` → `VITE_PUBLIC_API_URL`). Maketdagi
 * `https://api.elchipochta.uz` — prod qiymati.
 */
export const carrierPublicBaseUrl = (): string => PUBLIC_API_URL;

export const carrierDocsUrl = (): string => `${carrierPublicBaseUrl()}/carrier-docs`;
