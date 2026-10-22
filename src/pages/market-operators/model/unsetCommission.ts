import { hasCommission, type MarketOperator } from "../../../entities/market-operator";

/**
 * «Komissiya belgilanmagan» ogohlantirishi — FAQAT joriy sahifa (backendda komissiya filtri yo'q, limit ≤ 100) va faqat
 * faol operatorlar: nofaol operator tizimga kira olmaydi, sotuv qilmaydi — undan daromad yo'qolmaydi.
 */
export const operatorsWithoutCommission = (items: readonly MarketOperator[]): MarketOperator[] =>
  items.filter((item) => item.status === "active" && !hasCommission(item));

/** Ko'rinadigan ismlar soni — qolgani «yana N ta operator». */
export const MAX_LISTED_NAMES = 3;

/**
 * Ismlar ro'yxati: «A», «A va B», «A, B va C», «A, B, C va yana 2 ta operator». `and` / `more` — i18n matni.
 */
export const joinOperatorNames = (
  names: readonly string[],
  { and, more }: { and: string; more: (count: number) => string },
): string => {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length > MAX_LISTED_NAMES) {
    return `${names.slice(0, MAX_LISTED_NAMES).join(", ")} ${and} ${more(names.length - MAX_LISTED_NAMES)}`;
  }
  return `${names.slice(0, -1).join(", ")} ${and} ${names[names.length - 1]}`;
};
