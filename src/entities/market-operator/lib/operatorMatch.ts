import type { SelectableMarketOperator } from "../model/types";

/**
 * YOZILGAN ISM → RO'YXATDAGI OPERATOR.
 *
 * Buyurtmada operator ismi faqat matn bo'lsa (`operator`), `operator_id` bo'sh qoladi va sotuvda operatorga komissiya
 * yozilmaydi (2026-11-20). AI kartasi mos operatorni o'zi tanlaydi (ega, 2026-11-23 — `autoPickOperators`), odam
 * «Tanlanmagan» ga qaytarsa «Tanlash» taklifi qoladi; «Bog'lanmagan buyurtmalar» kartasi ham shu bilan oldindan
 * tanlaydi. Shu sabab moslik QAT'IY: faqat yagona aniq mos — bir nechta yoki noaniq bo'lsa `null`.
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
 * Ism ro'yxatdagi qaysi operatorga mos keladi:
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
