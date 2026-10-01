const parseAmount = (value: string): number => Number(value.replace(/\s/g, ""));

export type CourierTariffInput = {
  homeRate: string;
  centerRate: string;
  salary: string;
};

/**
 * Kuryer tariflari majburiymi (fix3b FE-USR-11).
 *
 * Kuryerning ulushi `CourierCompensationMode` ga bog'liq: faqat `salary_only`
 * kuryer buyurtmadan 0 oladi. Shuning uchun tariflarni bo'sh qoldirish
 * (= 0) faqat MAOSH kiritilganda mumkin. Maoshsiz kuryer (`per_order`) uchun
 * ikkala tarif ham majburiy — aks holda u har buyurtmadan jimgina 0 olardi.
 * 0 so'm maosh — maosh emas (u holda kuryer umuman hech narsa olmasdi).
 */
export const areCourierTariffsRequired = ({ salary }: Pick<CourierTariffInput, "salary">) => {
  const amount = parseAmount(salary);
  return !(salary.trim() && Number.isFinite(amount) && amount > 0);
};

/** Bo'sh tarif maydonlari: maoshsiz kuryerda ikkalasi ham to'ldirilishi shart. */
export const getMissingCourierTariffs = (values: CourierTariffInput) => {
  if (!areCourierTariffsRequired(values)) {
    return { home: false, center: false };
  }

  return {
    home: !values.homeRate.trim(),
    center: !values.centerRate.trim(),
  };
};

/**
 * Kuryer yaratishdagi tariflar (fix3 FE-USR-11, fix3b).
 *
 * Backend `CreateCourierRequestDto` da `tariff_home` va `tariff_center`
 * MAJBURIY (`@IsNumber @Min(0)`, `IsOptional` yo'q), shuning uchun ular har
 * doim yuboriladi:
 *  - maosh kiritilgan va ikkala tarif bo'sh — maoshli kuryer, 0 / 0;
 *  - ikkala tarif to'ldirilgan — kiritilgan qiymatlar;
 *  - boshqa holat (maoshsiz bo'sh tarif yoki faqat bittasi) — `null`: forma
 *    tekshiruvi uni yuborishdan oldin to'xtatishi kerak.
 */
export const buildCourierTariffs = (
  values: CourierTariffInput,
): { tariff_home: number; tariff_center: number } | null => {
  const homeRate = values.homeRate.trim();
  const centerRate = values.centerRate.trim();

  if (!homeRate && !centerRate) {
    return areCourierTariffsRequired(values) ? null : { tariff_home: 0, tariff_center: 0 };
  }

  if (!homeRate || !centerRate) return null;

  return {
    tariff_home: parseAmount(homeRate),
    tariff_center: parseAmount(centerRate),
  };
};
