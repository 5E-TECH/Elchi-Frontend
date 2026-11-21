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
 * odam tanlaydi). Matn ro'yxatdagi BITTA operatorga mos kelsa — faqat TAKLIF («Tanlash» tugmasi;
 * `suggestOperator` — `entities/market-operator`, qo'lda forma ham shuni ishlatadi).
 */

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
 * Tasdiqlashga ketadigan operator maydonlari. Ega (2026-11-21): ro'yxat bor bo'lsa «Ro'yxatda yo'q operator» erkin
 * matni yo'q — operator tanlanmagan karta OPERATORSIZ ketadi (AI o'qigan ism ham yuborilmaydi: aks holda buyurtmada
 * ism ko'rinardi, lekin `operator_id` yo'q — sotuvda komissiya yozilmasdi). Ro'yxat yo'q / bo'sh / xato — avvalgidek
 * kartadagi matn (o'sha holatda erkin matn maydoni ko'rinadi).
 */
export const confirmOperatorFields = (
  order: Pick<AiDraftOrder, "operator_id" | "operator">,
  operators: readonly SelectableMarketOperator[] | undefined,
): { operator_id: string | null; operator: string } => {
  const id = chosenOperatorId(order, operators);
  if (id) return { operator_id: id, operator: order.operator ?? "" };
  return { operator_id: null, operator: operators?.length ? "" : (order.operator ?? "") };
};

/**
 * ai-confirm natijasi: tanlangan operator rad etildi (o'chirilgan / bloklangan / boshqa market) — ro'yxat
 * yangilanadi va eskirgan tanlov kartada o'z-o'zidan tushadi (`chosenOperatorId`). Kod bo'lmasa (eski gateway) —
 * backend matni («Tanlangan operator bu marketga tegishli emas…»), qo'lda formadagi `isOperatorRejected` kabi.
 */
export const isOperatorRejectedResult = (result: Pick<AiConfirmResult, "ok" | "reason" | "reason_code">): boolean =>
  !result.ok &&
  (result.reason_code?.startsWith("CHOSEN_OPERATOR_") === true || /tanlangan operator/i.test(result.reason ?? ""));
