import type { AiConfirmResult } from "../../../../../entities/ai-order";
import type { SelectableMarketOperator } from "../../../../../entities/market-operator";
import type { AiDraftOrder } from "./evalPreview";

/**
 * AI KARTASIDAGI «OPERATOR» TANLOVI (qo'lda formadagi `OperatorField` bilan AYNI qoida).
 *
 * Muammo (2026-11-20): AI xabardagi `#sevinch` ni faqat MATN qilib yozardi — buyurtmada operator ismi ko'rinardi,
 * lekin `operator_id` yo'q edi, ya'ni sotuvda operatorga komissiya yozilmasdi va u «Operatorlar» sahifasida
 * ko'rinmasdi. Endi kartada ro'yxatdan tanlanadi (`orders[].operator_id`).
 *
 * ⚠️ AI matnidan operator AVTOMATIK tanlanmaydi (backend shartnomasi: `operator_id` — pulga ta'sir qiladi, faqat
 * odam tanlaydi). Matn ro'yxatdagi BITTA operatorga mos kelsa — faqat TAKLIF («Tanlash» tugmasi).
 */

/** Taqqoslash uchun: katta-kichik harf, `#` boshi, tutuq belgisi turlari (ʻ ʼ ’ ‘ `) va bo'shliqlar farq qilmaydi. */
export const normalizeOperatorName = (value: string | null | undefined): string =>
  (value ?? "")
    .normalize("NFC")
    .toLocaleLowerCase("uz")
    .replace(/[ʻʼ’‘`']/g, "'")
    .replace(/^\s*#+/, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * AI o'qigan ism (`operator` matni) ro'yxatdagi qaysi operatorga mos keladi:
 *  - to'liq ism bir xil — o'sha operator («Sevinch Karimova» = «sevinch karimova»);
 *  - matn bitta so'z — ismi shu so'z bilan boshlanadigan YAGONA operator («#sevinch» → «Sevinch Karimova»);
 *  - bir nechta mos (ikki «Sevinch») yoki hech biri — `null` (taklif yo'q, odam o'zi tanlaydi).
 */
export const suggestOperator = (
  text: string | null | undefined,
  operators: readonly SelectableMarketOperator[] | undefined,
): SelectableMarketOperator | null => {
  const needle = normalizeOperatorName(text);
  if (!needle || !operators?.length) return null;

  const exact = operators.filter((operator) => normalizeOperatorName(operator.name) === needle);
  if (exact.length > 0) return exact.length === 1 ? exact[0] : null;
  if (needle.includes(" ")) return null;

  const byFirstName = operators.filter((operator) => normalizeOperatorName(operator.name).split(" ")[0] === needle);
  return byFirstName.length === 1 ? byFirstName[0] : null;
};

/**
 * Kartadagi tanlov hozir ham yaroqlimi. Ro'yxat yuklangan va unda yo'q (admin marketni almashtirgan, operator
 * o'chirilgan / bloklangan) — eskirgan: ko'rinmaydi va YUBORILMAYDI. Ro'yxat hali yo'q (yuklanmoqda / xato) —
 * tanlov saqlanadi, uni backend tekshiradi (rad etsa — shu karta xato bilan qoladi).
 */
export const chosenOperatorId = (
  order: Pick<AiDraftOrder, "operator_id">,
  operators: readonly SelectableMarketOperator[] | undefined,
): string => {
  const id = order.operator_id?.trim() ?? "";
  if (!id) return "";
  return !operators || operators.some((operator) => operator.id === id) ? id : "";
};

/**
 * ai-confirm natijasi: tanlangan operator rad etildi (o'chirilgan / bloklangan / boshqa market) — ro'yxat
 * yangilanadi va eskirgan tanlov kartada o'z-o'zidan tushadi (`chosenOperatorId`). Kod bo'lmasa (eski gateway) —
 * backend matni («Tanlangan operator bu marketga tegishli emas…»), qo'lda formadagi `isOperatorRejected` kabi.
 */
export const isOperatorRejectedResult = (result: Pick<AiConfirmResult, "ok" | "reason" | "reason_code">): boolean =>
  !result.ok &&
  (result.reason_code?.startsWith("CHOSEN_OPERATOR_") === true || /tanlangan operator/i.test(result.reason ?? ""));
