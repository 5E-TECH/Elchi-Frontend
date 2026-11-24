import type { SiteOrderPreview } from "../model/siteOrder";

/** Qator nomi — mijoz ismi, bo'lmasa QR (xabar va tugma nomlarida). */
export const siteOrderLabel = (row: SiteOrderPreview) => row.name || row.qr;
