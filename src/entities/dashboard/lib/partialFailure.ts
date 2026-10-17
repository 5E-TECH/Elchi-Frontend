type UnknownRecord = Record<string, unknown>;

/**
 * Qisman nosozlik (VkwhHqvW, FRONTEND_CHANGELOG 2026-10-12/14): javobda `degraded: true` va `failed_parts` —
 * olinmagan bo'laklar (javob kalitlari). `degraded` da `null` kelgan bo'lak ham olinmagan hisoblanadi
 * (normalizatsiya uni `[]` / 0 ga aylantirib yubormasin).
 */
export const readPartialFailure = (
  response: UnknownRecord,
  data: UnknownRecord,
  nullableKeys: Readonly<Record<string, readonly string[]>> = {},
): { degraded: boolean; failedParts: string[] } => {
  const raw = data.failed_parts ?? data.failedParts ?? response.failed_parts ?? response.failedParts;
  const parts = new Set(Array.isArray(raw) ? raw.map((part) => String(part)) : []);
  const degraded = data.degraded === true || response.degraded === true || parts.size > 0;
  if (degraded) {
    for (const [key, aliases] of Object.entries(nullableKeys)) {
      if ([key, ...aliases].some((name) => data[name] === null)) parts.add(key);
    }
  }
  return { degraded, failedParts: [...parts] };
};

/** Shu kalitlardan biri olinmaganmi (`failedParts` — normalizatsiya qilingan javobdan). */
export const hasFailedPart = (failedParts: readonly string[] | undefined, ...keys: string[]) =>
  Boolean(failedParts?.some((part) => keys.includes(part)));
