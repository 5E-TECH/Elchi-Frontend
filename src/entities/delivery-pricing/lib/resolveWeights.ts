import {
  DELIVERY_TARIFF_IDS,
  type DeliveryMeasureItem,
  type DeliveryQuote,
  type DeliveryQuotesByTariff,
} from "../model/types";
import {
  computeMeasureWeights,
  DEFAULT_WEIGHT_RULES,
  meetsVolumetricThreshold,
  type MeasureWeights,
  type WeightRules,
} from "./billableWeight";

/** Hisob vazni, chegara va asos — uchala tarifda bir xil (sozlama umumiy): birinchi mavjud natijadan. */
export const firstDeliveryQuote = (quotes: DeliveryQuotesByTariff | undefined): DeliveryQuote | null =>
  DELIVERY_TARIFF_IDS.map((id) => quotes?.[id] ?? null).find(Boolean) ?? null;

export type ResolvedMeasureWeights = MeasureWeights & {
  /** Qo'llangan «Hajm bo'yicha hisoblash chegarasi», kg (0 — har doim hajm bo'yicha). */
  volumetricFromKg: number;
  /** Hajm hisobga olindimi (kalit yoqiq va hajmli vazn ≥ chegara). */
  volumetricApplied: boolean;
  /** `server` — hisob vazni shu o'lchovning server hisobidan; `local` — klient hisobi (javob kutilmoqda yoki yo'q). */
  source: "server" | "local";
};

/**
 * «HAJMLI VAZN» / «HISOB VAZNI» KO'RSATKICHI — server natijasi ustun (rol sozlamani o'qiy olmasa ham to'g'ri):
 *  - chegara: shu o'lchovning yangi javobidagi `volumetricFromKg` → sozlama (`rules`, faqat superadmin/admin; saqlangach
 *    eski javobdan yangiroq) → eskirgan javobniki (sozlama o'lchovga bog'liq emas — sozlamasiz rol uchun) → 0;
 *  - shu o'lchovning yangi javobi (`fresh`) `volumetricApplied` bilan kelgan bo'lsa — hisob vazni, asos va «hajm
 *    qo'llandi» serverdan; aks holda (kutish, eski backend) — shu chegara bilan klient hisobi.
 * Hajmli vaznning o'zi (U × K × B / 5000) — har doim klientda (geometriya, kalit o'chiq bo'lsa ham ko'rsatiladi).
 */
export const resolveMeasureWeights = (
  item: DeliveryMeasureItem,
  rules: WeightRules | undefined,
  server: { quote: DeliveryQuote | null; fresh: boolean } = { quote: null, fresh: false },
): ResolvedMeasureWeights => {
  const volumetricFromKg =
    (server.fresh ? server.quote?.volumetricFromKg : null) ??
    rules?.volumetricFromKg ??
    server.quote?.volumetricFromKg ??
    0;
  const effective: WeightRules = { ...(rules ?? DEFAULT_WEIGHT_RULES), volumetricFromKg };
  const local = computeMeasureWeights(item, effective);
  const quote = server.fresh ? server.quote : null;
  if (quote && quote.volumetricApplied !== null && quote.billableKg > 0) {
    return {
      ...local,
      billableKg: quote.billableKg,
      basis: quote.basis ?? (quote.volumetricApplied ? local.basis : "weight"),
      volumetricFromKg,
      volumetricApplied: quote.volumetricApplied,
      source: "server",
    };
  }
  return { ...local, volumetricFromKg, volumetricApplied: meetsVolumetricThreshold(item, effective), source: "local" };
};
