import type { Batch } from "./types";

const known = (value: string | null | undefined): string | null => {
  const text = value?.trim();
  return text && text !== "—" ? text : null;
};

/**
 * Paket viloyatlari (nomlari): javobdagi `regions[]`, bo'lmasa `to_branch.region`. Filial paketi 2026-11-14 dan
 * umumiy — bitta yo'nalishga bitta paket, ichida barcha viloyatlar.
 */
export const batchRegionNames = (batch: Pick<Batch, "regions" | "to_branch">): string[] => {
  const names = Array.from(new Set((batch.regions ?? []).map(known).filter((name): name is string => name !== null)));
  if (names.length) return names;
  const single = known(batch.to_branch.region);
  return single ? [single] : [];
};

/**
 * Jadval/karta uchun viloyat yorlig'i: bitta viloyat — nomi; umumiy paket — `many(soni)` («5 ta viloyat»), berilmasa
 * nomlar vergul bilan; noma'lum — `null`.
 */
export const formatBatchRegions = (
  batch: Pick<Batch, "regions" | "to_branch">,
  many?: (count: number) => string,
): string | null => {
  const names = batchRegionNames(batch);
  if (names.length > 1) return many ? many(names.length) : names.join(", ");
  return names[0] ?? null;
};
