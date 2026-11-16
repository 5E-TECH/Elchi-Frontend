/**
 * Analitika so'rovlari kalit prefikslari (`entities/dashboard` hook'lari shulardan quradi). Bosh sahifa bo'lim xato
 * chegaralarining «Qayta urinish»i shu so'rovlarni qayta yuboradi (QKCeGZ3N). Alohida modul: sahifa testlari
 * `entities/dashboard` ni to'liq soxtalashtirsa ham kalitlar joyida.
 */
export const DASHBOARD_QUERY_KEY = ["dashboard"] as const;
export const KPI_QUERY_KEY = ["kpi"] as const;
export const REVENUE_QUERY_KEY = ["revenue"] as const;
/**
 * «Analitika KPI» (`GET analytics/kpi`, superadmin bosh sahifasi; hook — `entities/coverage/miscCoverage`). Shu yerda:
 * bosh sahifa kalitni oladi, `miscCoverage` esa «Analitika KPI» bo'lagida (lazy) qoladi.
 */
export const ANALYTICS_KPI_QUERY_KEY = ["misc-cov", "analytics-kpi"] as const;
