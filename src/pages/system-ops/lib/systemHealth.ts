/**
 * «TIZIM HOLATI» — `GET /health/readiness` (api-gateway `HealthController.readiness`, backend `origin/main`).
 *
 * Javob konvertsiz: `{ status: "ok" | "degraded", timestamp, services: [{ service, status, latency_ms?, error? }] }`.
 * HTTP 200 — hammasi `ok`, 503 — kamida bittasi `ok` emas (hook `validateStatus` bilan ikkalasini ham oladi).
 * `services` massivi bo'lmasa — xato (null qaytadi, sahifa xato holatini chizadi).
 *
 * Xizmatning `error` matni foydalanuvchiga KO'RSATILMAYDI — undan faqat sabab turi andaza bo'yicha olinadi
 * (mo'rt: backend inglizcha matni o'zgarsa `failed` ga tushadi; ixtiyoriy backend kartasi N21 — kod maydoni).
 *
 * Ega qarori (S1): asosiy xizmatlar — Identity, Order, Finance, Logistics; biri ishlamasa — «Ishlamayapti» (danger).
 */

/** Backend tekshiradigan 14 xizmat (`SERVICE_HEALTH_PROBES` tartibi). */
export const HEALTH_SERVICE_KEYS = [
  "IDENTITY",
  "ORDER",
  "CATALOG",
  "LOGISTICS",
  "FINANCE",
  "NOTIFICATION",
  "INTEGRATION",
  "ANALYTICS",
  "BRANCH",
  "INVESTOR",
  "FILE",
  "C2C",
  "SEARCH",
  "AI",
] as const;

export type HealthServiceKey = (typeof HEALTH_SERVICE_KEYS)[number];

const KNOWN = new Set<string>(HEALTH_SERVICE_KEYS);

/** S1 — asosiy xizmatlar. */
export const CORE_SERVICE_KEYS: readonly HealthServiceKey[] = ["IDENTITY", "ORDER", "FINANCE", "LOGISTICS"];
const CORE = new Set<string>(CORE_SERVICE_KEYS);

export type ServiceState = "ok" | "down" | "unknown";

/** Ishlamaslik sababi (i18n `system.health.problem.<turi>`). */
export type ServiceProblem = "timeout" | "reported" | "notRegistered" | "failed";

export type HealthService = {
  /** Backend `service` (masalan `ORDER`). */
  key: string;
  /** Ro'yxatimizda bormi (yo'q bo'lsa nomi — kalitning o'zi). */
  known: boolean;
  core: boolean;
  state: ServiceState;
  latencyMs: number | null;
  problem: ServiceProblem | null;
};

/**
 * Umumiy daraja:
 *  ok       — ishlamayotgan xizmat yo'q (ulanmagan — `unknown` — bo'lishi mumkin);
 *  partial  — faqat yordamchi xizmat(lar) ishlamayapti (warning);
 *  critical — asosiy xizmat ishlamayapti (danger);
 *  down     — birorta xizmat ham ishlamayapti (danger).
 */
export type HealthLevel = "ok" | "partial" | "critical" | "down";

export type HealthSummary = {
  /** Tartib: ishlamayotganlar → noma'lum → ishlayotganlar; guruh ichida backend tartibi. */
  services: HealthService[];
  total: number;
  okCount: number;
  downCount: number;
  unknownCount: number;
  level: HealthLevel;
  /** Ishlamayotgan asosiy xizmatlar. */
  coreDown: HealthService[];
  /** Ishlamayotgan yordamchi xizmatlar. */
  auxDown: HealthService[];
  unknown: HealthService[];
  /** Ishlayotgan xizmatlarning o'rtacha javob vaqti (ms, butun). */
  averageLatencyMs: number | null;
  /** Ishlamayotganlarning hammasi vaqt chegarasidan oshgan. */
  allTimedOut: boolean;
};

const STATE_RANK: Record<ServiceState, number> = { down: 0, unknown: 1, ok: 2 };

const readState = (value: unknown): ServiceState =>
  value === "ok" ? "ok" : value === "down" ? "down" : "unknown";

const readLatency = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;

/** `error` matnidan sabab turi (matnning o'zi chiqmaydi). */
export const classifyProblem = (state: ServiceState, error: unknown): ServiceProblem | null => {
  if (state === "ok") return null;
  if (state === "unknown") return "notRegistered";
  const text = typeof error === "string" ? error : "";
  // rxjs `TimeoutError`: «Timeout has occurred».
  if (/timeout/i.test(text)) return "timeout";
  // Servis o'zini nosoz deb bildirdi: «reported degraded» / «reported down».
  if (/^reported\b/i.test(text.trim())) return "reported";
  if (/not registered/i.test(text)) return "notRegistered";
  return "failed";
};

const readService = (raw: unknown): HealthService | null => {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const key = typeof record.service === "string" ? record.service.trim().toUpperCase() : "";
  if (!key) return null;
  const state = readState(record.status);
  return {
    key,
    known: KNOWN.has(key),
    core: CORE.has(key),
    state,
    latencyMs: state === "unknown" ? null : readLatency(record.latency_ms),
    problem: classifyProblem(state, record.error),
  };
};

/** Readiness javobi → xulosa. `services` massivi yo'q yoki bo'sh bo'lsa — `null` (xato holati). */
export const readReadiness = (raw: unknown): HealthSummary | null => {
  if (!raw || typeof raw !== "object") return null;
  const list = (raw as { services?: unknown }).services;
  if (!Array.isArray(list)) return null;

  const services = list
    .map(readService)
    .filter((item): item is HealthService => item !== null)
    .map((item, index) => ({ item, index }))
    .sort((a, b) => STATE_RANK[a.item.state] - STATE_RANK[b.item.state] || a.index - b.index)
    .map(({ item }) => item);
  if (services.length === 0) return null;

  const ok = services.filter((s) => s.state === "ok");
  const down = services.filter((s) => s.state === "down");
  const unknown = services.filter((s) => s.state === "unknown");
  const coreDown = down.filter((s) => s.core);
  const auxDown = down.filter((s) => !s.core);

  const level: HealthLevel =
    down.length === 0 ? "ok" : ok.length === 0 ? "down" : coreDown.length > 0 ? "critical" : "partial";

  const latencies = ok.map((s) => s.latencyMs).filter((v): v is number => v !== null);
  const averageLatencyMs =
    latencies.length > 0 ? Math.round(latencies.reduce((sum, v) => sum + v, 0) / latencies.length) : null;

  return {
    services,
    total: services.length,
    okCount: ok.length,
    downCount: down.length,
    unknownCount: unknown.length,
    level,
    coreDown,
    auxDown,
    unknown,
    averageLatencyMs,
    allTimedOut: down.length > 0 && down.every((s) => s.problem === "timeout"),
  };
};

/** «a», «a va b», «a, b va c» — `and` locale'dan. */
export const joinList = (items: readonly string[], and: string): string => {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
};

/** Gap boshi bosh harf bilan. */
export const capitalize = (text: string): string => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);
