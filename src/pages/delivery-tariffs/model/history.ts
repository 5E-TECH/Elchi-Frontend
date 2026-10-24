import type {
  DeliveryPricingSettings,
  DeliveryPricingSettingsVersion,
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
 * oldingi versiyasi bilan solishtiriladi. Hisob qoidalari — `buildSettingsHistory`, ikkalasi — `buildTimeline`.
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

/** Hisob qoidalari (sozlama) o'zgarishi: kg / so'm / koeffitsiyent; pickup tekin chegarasi `null` — hech qachon. */
export type SettingsChange =
  | { kind: "firstKg" | "minBillable" | "step" | "roundTo" | "pickupFee" | "express"; from: number; to: number }
  | { kind: "pickupFree"; from: number | null; to: number | null };

const SETTINGS_NUMBER_FIELDS = [
  ["firstKg", "firstKgIncluded"],
  ["minBillable", "minBillableKg"],
  ["step", "billableStepKg"],
  ["roundTo", "roundTo"],
  ["pickupFee", "pickupFee"],
  ["express", "expressMultiplier"],
] as const satisfies readonly (readonly [SettingsChange["kind"], keyof DeliveryPricingSettings])[];

export const diffSettings = (previous: DeliveryPricingSettings, next: DeliveryPricingSettings): SettingsChange[] => {
  const changes: SettingsChange[] = [];
  for (const [kind, key] of SETTINGS_NUMBER_FIELDS) {
    if (previous[key] !== next[key]) changes.push({ kind, from: previous[key], to: next[key] });
  }
  if (previous.pickupFreeFromCount !== next.pickupFreeFromCount)
    changes.push({ kind: "pickupFree", from: previous.pickupFreeFromCount, to: next.pickupFreeFromCount });
  return changes;
};

export type SettingsHistoryEntry = {
  version: DeliveryPricingSettingsVersion;
  /** Ro'yxatdagi eng eski versiya — dastlabki qoidalar. */
  initial: boolean;
  changes: SettingsChange[];
};

/** `GET /delivery/pricing-settings/history` (yangisi tepada) — har versiya undan oldingisi bilan; o'zgarishsizi tashlanadi. */
export const buildSettingsHistory = (versions: readonly DeliveryPricingSettingsVersion[]): SettingsHistoryEntry[] =>
  versions
    .map((version, index) => {
      const previous = versions[index + 1];
      return { version, initial: !previous, changes: previous ? diffSettings(previous, version) : [] };
    })
    .filter((entry) => entry.initial || entry.changes.length > 0);

export type TimelineEntry =
  | { type: "tariff"; entry: HistoryEntry; at: string }
  | { type: "settings"; entry: SettingsHistoryEntry; at: string };

const timeOf = (value: string | null | undefined) => {
  const time = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(time) ? time : 0;
};

/**
 * «O'ZGARISHLAR TARIXI» — tarif versiyalari (`valid_from` bo'yicha) va hisob qoidalari versiyalari (`createdAt`)
 * bitta ro'yxatda, yangisi tepada (teng vaqtda — asl tartib saqlanadi).
 */
export const buildTimeline = (
  tariffVersions: readonly DeliveryTariffVersion[],
  settingsVersions: readonly DeliveryPricingSettingsVersion[] = [],
): TimelineEntry[] =>
  [
    ...buildHistory(tariffVersions).map((entry): TimelineEntry => ({ type: "tariff", entry, at: entry.version.validFrom })),
    ...buildSettingsHistory(settingsVersions).map(
      (entry): TimelineEntry => ({ type: "settings", entry, at: entry.version.createdAt ?? "" }),
    ),
  ].sort((a, b) => timeOf(b.at) - timeOf(a.at));
