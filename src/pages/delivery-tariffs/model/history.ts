import type {
  DeliveryTariff,
  DeliveryTariffsData,
  DeliveryTariffVersion,
} from "../../../entities/delivery-pricing";

/** Ikki versiya orasidagi o'zgarish (pul — so'm, muddat — kun). */
export type TariffChange =
  | { kind: "base" | "perKg"; from: number; to: number }
  | { kind: "days"; from: [number, number]; to: [number, number] };

export const diffTariffs = (previous: DeliveryTariff, next: DeliveryTariff): TariffChange[] => {
  const changes: TariffChange[] = [];
  if (previous.basePrice !== next.basePrice) changes.push({ kind: "base", from: previous.basePrice, to: next.basePrice });
  if (previous.extraPerKg !== next.extraPerKg)
    changes.push({ kind: "perKg", from: previous.extraPerKg, to: next.extraPerKg });
  if (previous.daysMin !== next.daysMin || previous.daysMax !== next.daysMax)
    changes.push({ kind: "days", from: [previous.daysMin, previous.daysMax], to: [next.daysMin, next.daysMax] });
  return changes;
};

export type HistoryEntry = {
  version: DeliveryTariffVersion;
  /** Shu tarifning oldingi versiyasi yo'q (ro'yxatda) — dastlabki tarif. */
  initial: boolean;
  changes: TariffChange[];
};

/**
 * «O'ZGARISHLAR TARIXI» — `GET /delivery/tariffs` `versions` (yangisi tepada): har versiya shu tarifning undan
 * oldingi versiyasi bilan solishtiriladi. Sozlama (hisob qoidalari) o'zgarishlari bu javobda yo'q.
 */
export const buildHistory = (versions: readonly DeliveryTariffVersion[]): HistoryEntry[] =>
  versions.map((version, index) => {
    const previous = versions.slice(index + 1).find((item) => item.tariffId === version.tariffId);
    return { version, initial: !previous, changes: previous ? diffTariffs(previous, version) : [] };
  });

/** Jadval ostidagi «Rejalashtirilgan: …» — kelajakdagi versiyalar, hozirgi tarif bilan solishtirib. */
export const scheduledChanges = (data: DeliveryTariffsData): HistoryEntry[] =>
  buildHistory(data.versions)
    .filter((entry) => entry.version.isScheduled)
    .map((entry) => {
      const current = data.current[entry.version.tariffId];
      return current ? { ...entry, initial: false, changes: diffTariffs(current, entry.version) } : entry;
    });
