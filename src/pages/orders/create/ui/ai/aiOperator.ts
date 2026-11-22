import type { AiConfirmResult } from "../../../../../entities/ai-order";
import { suggestOperator, type SelectableMarketOperator } from "../../../../../entities/market-operator";
import type { AiDraft } from "./aiDraft";
import type { AiDraftOrder } from "./evalPreview";

/**
 * AI KARTASIDAGI «OPERATOR» TANLOVI.
 *
 * Muammo (2026-11-20): AI xabardagi `#sevinch` ni faqat MATN qilib yozardi — buyurtmada operator ismi ko'rinardi,
 * lekin `operator_id` yo'q edi, ya'ni sotuvda operatorga komissiya yozilmasdi va u «Operatorlar» sahifasida
 * ko'rinmasdi. Endi kartada ro'yxatdan tanlanadi (`orders[].operator_id`).
 *
 * Ega (2026-11-23): AI o'qigan ism ro'yxatdagi BITTA operatorga mos kelsa (`suggestOperator`) — operator SO'RAMASDAN
 * tanlanadi (`autoPickOperators`), avval bu faqat «Tanlash» / «Hammasini tanlash» taklifi edi. Kartada tanlov va
 * «Xabardagi «…» bo'yicha tanlandi» izohi ko'rinadi — odam yaratishdan oldin o'zgartira yoki olib tashlay oladi.
 * Mos kelmasa / bir nechta mos (ikki «Sevinch») — tanlanmaydi, odam o'zi tanlaydi.
 */

/**
 * Kartalarni ro'yxat bilan BIR MARTA solishtiradi (`operatorAutoChecked`): mos kelganiga operator qo'yiladi,
 * allaqachon tanlangani tegilmaydi. Belgi tufayli odam keyin «Tanlanmagan» yoki boshqa operatorni tanlasa —
 * qayta tanlanmaydi. Yangi tahlil kartalari (`toDraft`) belgisiz keladi.
 */
export const autoPickOperators = (drafts: AiDraft[], operators: readonly SelectableMarketOperator[]): AiDraft[] =>
  drafts.map((draft) => {
    if (draft.operatorAutoChecked) return draft;
    const checked: AiDraft = { ...draft, operatorAutoChecked: true };
    if (chosenOperatorId(draft.order, operators)) return checked;
    const operator = suggestOperator(draft.order.operator, operators);
    return operator ? { ...checked, order: { ...draft.order, operator_id: operator.id, operator: operator.name } } : checked;
  });

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
