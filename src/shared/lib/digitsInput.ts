/**
 * Son va pul maydoni (`TextInput mode="number" | "money"`) uchun yozish paytidagi yordamchilar.
 * Saqlanadigan qiymat — faqat raqamlar (`"1545000"`), ko'rsatiladigani — mingliklar bilan
 * (`formatNumberLocalized`: uz/ru «1 545 000», en «1,545,000»).
 */

/** Faqat raqamlar, boshidagi ortiqcha nollarsiz («007» → «7», «0» qoladi). */
export const toDigits = (raw: string): string => raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

/** Ko'rsatilgan matnda `count` ta raqamdan keyingi kursor joyi. */
export const caretAfterDigits = (display: string, count: number): number => {
  if (count <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < display.length; index += 1) {
    if (/\d/.test(display[index])) {
      seen += 1;
      if (seen === count) return index + 1;
    }
  }
  return display.length;
};

/**
 * Formatlashdan keyin kursor sakramasin: o'zgarishdan oldin kursorgacha nechta raqam bo'lgan bo'lsa,
 * yangi ko'rinishda ham shuncha raqamdan keyin qo'yiladi (keyingi kadrda — React qiymatni yozgach).
 */
export const keepDigitCaret = (input: HTMLInputElement, nextDisplay: string) => {
  const caret = input.selectionStart ?? input.value.length;
  const before = input.value.slice(0, caret).replace(/\D/g, "").length;
  const next = caretAfterDigits(nextDisplay, before);
  window.requestAnimationFrame(() => {
    if (document.activeElement === input) input.setSelectionRange(next, next);
  });
};
