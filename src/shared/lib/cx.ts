/**
 * Klass satrlarini birlashtiruvchi kichik yordamchi (dizayn v2 primitivlari uchun).
 *
 *   cx("h-10 px-4", isActive && "bg-action-soft", className)
 *
 * Faqat "falsy" qismlarni (`false`, `null`, `undefined`, `0`, `""`) tashlab,
 * qolganini bitta bo'sh joy bilan qo'shadi. Takrorni olib tashlash yoki
 * Tailwind klasslarini "birlashtirish" (tailwind-merge kabi) QILMAYDI —
 * primitiv ichida bir xil xususiyatga ikki klass yozilmasin.
 *
 * `clsx` to'g'ridan-to'g'ri bog'liqlik emas, shuning uchun yangi kodda shu ishlatiladi.
 */
export type ClassPart = string | false | null | undefined | 0;

export const cx = (...parts: ClassPart[]): string => {
  let out = "";
  for (const part of parts) {
    if (!part) continue;
    const trimmed = part.trim();
    if (!trimmed) continue;
    out = out ? `${out} ${trimmed}` : trimmed;
  }
  return out;
};
