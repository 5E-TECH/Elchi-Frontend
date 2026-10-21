import type { AiCapState, AiKeyState, AiModelVerdict } from "../../../entities/ai-order";

/**
 * «AI HOLATI» — `GET ai/status` (api-gateway `AiGatewayController.status`, backend `origin/main`,
 * `AiStatusResponse`) + `GET orders/ai-availability` dagi gateway bayrog'i (`AI_ORDER_ENABLED`).
 *
 * Umumiy holat gateway `AiStatusPoller.getState()` bilan bir xil qoidada (faqat bayroq shu yerda alohida so'rovdan):
 *  - `off`         — bayroq o'chiq, yoki ai-service'da kalit yo'q / noto'g'ri nom (`key_state !== "ok"`), yoki `enabled: false`;
 *  - `capExceeded` — kunlik limit tugadi («Limit tugadi», «AI o'chiq» EMAS);
 *  - `enabled`     — kalit bor, limit ochiq (`ok` / `warn`);
 *  - `unknown`     — limit holatini ai-service o'qiy olmadi (`cap.state: "unknown"` — AI fail-closed).
 *
 * Javob shakli buzuq bo'lsa (`models` / `cap` yo'q) — `null` (karta xato holatini chizadi). Kalit qiymati javobda
 * yo'q va hech qachon ko'rsatilmaydi; model nomlari — server sozlamasi (xom xato matni emas).
 */

export type AiOverall = "enabled" | "off" | "capExceeded" | "unknown";

/** «AI o'chiq» sababi (i18n `system.ai.off.<sabab>`); bir nechtasi bir vaqtda bo'lishi mumkin. */
export type AiOffReason = "flagOff" | "keyMissing" | "keyMisnamed" | "disabled";

export type AiModelSlot = "order" | "vision" | "classify";

export const AI_MODEL_SLOTS: readonly AiModelSlot[] = ["order", "vision", "classify"];

/** Server sozlamasi kaliti (kartada izoh sifatida — maketdagidek). */
export const AI_MODEL_ENV: Record<AiModelSlot, string> = {
  order: "AI_ORDER_MODEL",
  vision: "AI_ORDER_VISION_MODEL",
  classify: "AI_CLASSIFY_MODEL",
};

export type AiModelRow = { slot: AiModelSlot; model: string; verdict: AiModelVerdict };

export type AiCapSummary = {
  state: AiCapState;
  spentUsd: number;
  capUsd: number;
  overrideUsd: number;
  effectiveCapUsd: number;
  /** Sarflangan ulush, foizda (butun; 100 dan oshishi mumkin). */
  percent: number;
};

export type AiStatusSummary = {
  overall: AiOverall;
  offReasons: AiOffReason[];
  /** Noma'lum qiymat — `unknown` (karta «Noma'lum» deb ko'rsatadi). */
  keyState: AiKeyState | "unknown";
  models: AiModelRow[];
  /** Kuchsiz / noma'lum modellar (sarlavha badge'lari va ogohlantirishlar). */
  weakModels: AiModelRow[];
  unknownModels: AiModelRow[];
  cap: AiCapSummary;
  persistFailures: number;
};

const KEY_STATES = new Set<string>(["ok", "missing", "misnamed"]);
const VERDICTS = new Set<string>(["ok", "weak", "unknown"]);
const CAP_STATES = new Set<string>(["ok", "warn", "exceeded", "unknown"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const readNumber = (value: unknown): number => {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
};

const readCount = (value: unknown): number => Math.max(0, Math.round(readNumber(value)));

const readVerdict = (value: unknown): AiModelVerdict =>
  typeof value === "string" && VERDICTS.has(value) ? (value as AiModelVerdict) : "unknown";

const readCap = (raw: Record<string, unknown>): AiCapSummary => {
  const state = typeof raw.state === "string" && CAP_STATES.has(raw.state) ? (raw.state as AiCapState) : "unknown";
  const spentUsd = Math.max(0, readNumber(raw.spent_usd));
  const capUsd = Math.max(0, readNumber(raw.cap_usd));
  const overrideUsd = Math.max(0, readNumber(raw.override_usd));
  const effectiveCapUsd = Math.max(0, readNumber(raw.effective_cap_usd)) || capUsd + overrideUsd;
  // Backend `ratio` — yaxlitlanmagan chegaradan (check() bilan bir xil); yo'q bo'lsa o'zimiz hisoblaymiz.
  const ratio =
    typeof raw.ratio === "number" && Number.isFinite(raw.ratio)
      ? raw.ratio
      : effectiveCapUsd > 0
        ? spentUsd / effectiveCapUsd
        : 0;
  return { state, spentUsd, capUsd, overrideUsd, effectiveCapUsd, percent: Math.max(0, Math.round(ratio * 100)) };
};

/**
 * `ai/status` javobi (+ gateway bayrog'i) → karta modeli.
 * `gatewayEnabled`: `orders/ai-availability.enabled` — `false` bo'lsa «AI o'chiq» (bayroq); noma'lum (so'rov yiqildi
 * yoki hali kelmadi) — hisobga olinmaydi.
 */
export const readAiStatus = (raw: unknown, gatewayEnabled?: boolean | null): AiStatusSummary | null => {
  if (!isRecord(raw) || !isRecord(raw.models) || !isRecord(raw.cap)) return null;
  const modelsRaw = raw.models;
  const policy = isRecord(raw.model_policy) ? raw.model_policy : {};

  const models: AiModelRow[] = AI_MODEL_SLOTS.map((slot) => ({
    slot,
    model: typeof modelsRaw[slot] === "string" ? (modelsRaw[slot] as string).trim() : "",
    verdict: readVerdict(policy[slot]),
  }));

  const keyState: AiStatusSummary["keyState"] =
    typeof raw.key_state === "string" && KEY_STATES.has(raw.key_state) ? (raw.key_state as AiKeyState) : "unknown";
  const cap = readCap(raw.cap);

  const offReasons: AiOffReason[] = [];
  if (gatewayEnabled === false) offReasons.push("flagOff");
  if (keyState === "missing") offReasons.push("keyMissing");
  else if (keyState === "misnamed") offReasons.push("keyMisnamed");
  else if (raw.enabled !== true) offReasons.push("disabled");

  const overall: AiOverall =
    offReasons.length > 0
      ? "off"
      : cap.state === "exceeded"
        ? "capExceeded"
        : cap.state === "ok" || cap.state === "warn"
          ? "enabled"
          : "unknown";

  return {
    overall,
    offReasons,
    keyState,
    models,
    weakModels: models.filter((row) => row.verdict === "weak"),
    unknownModels: models.filter((row) => row.verdict === "unknown"),
    cap,
    persistFailures: readCount(raw.usage_persist_failures),
  };
};
