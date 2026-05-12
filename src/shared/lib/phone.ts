export const UZBEKISTAN_PHONE_PREFIX = "+998";
const UZBEKISTAN_PHONE_COUNTRY_CODE = "998";

export const getUzbekistanPhoneDigits = (value: string = "") => {
  const digits = value.replace(/\D/g, "");
  const localDigits = digits.startsWith("998") ? digits.slice(3) : digits;

  return localDigits.slice(0, 9);
};

export const formatUzbekistanPhoneLocal = (value: string = "") => {
  const digits = getUzbekistanPhoneDigits(value);

  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length <= 7) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  }

  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
};

export const formatUzbekistanPhoneFull = (value: string = "") => {
  const local = formatUzbekistanPhoneLocal(value);
  return local ? `${UZBEKISTAN_PHONE_PREFIX} ${local}` : `${UZBEKISTAN_PHONE_PREFIX} `;
};

export const toUzbekistanPhoneValue = (value: string = "") =>
  `${UZBEKISTAN_PHONE_PREFIX}${getUzbekistanPhoneDigits(value)}`;

export const isCompleteUzbekistanPhone = (value: string = "") =>
  getUzbekistanPhoneDigits(value).length === 9;

const getLocalDigitCountBeforeCaret = (value: string, caret: number) => {
  const digitsBeforeCaret = value.slice(0, caret).replace(/\D/g, "");

  if (digitsBeforeCaret.startsWith(UZBEKISTAN_PHONE_COUNTRY_CODE)) {
    return Math.max(digitsBeforeCaret.length - UZBEKISTAN_PHONE_COUNTRY_CODE.length, 0);
  }

  return digitsBeforeCaret.length;
};

const getCaretFromLocalDigitCount = (
  formattedValue: string,
  localDigitCount: number,
  withPrefix: boolean,
) => {
  if (localDigitCount <= 0) {
    return withPrefix ? formattedValue.length : 0;
  }

  const prefixDigitLength = withPrefix ? UZBEKISTAN_PHONE_COUNTRY_CODE.length : 0;
  let seenDigits = 0;

  for (let index = 0; index < formattedValue.length; index += 1) {
    if (!/\d/.test(formattedValue[index])) continue;

    if (seenDigits < prefixDigitLength) {
      seenDigits += 1;
      continue;
    }

    seenDigits += 1;
    if (seenDigits - prefixDigitLength >= localDigitCount) {
      return index + 1;
    }
  }

  return formattedValue.length;
};

export const keepPhoneCaretAfterChange = (
  input: HTMLInputElement,
  nextDisplayValue: string,
  withPrefix = false,
) => {
  const localDigitCount = getLocalDigitCountBeforeCaret(
    input.value,
    input.selectionStart ?? input.value.length,
  );
  const nextCaret = getCaretFromLocalDigitCount(nextDisplayValue, localDigitCount, withPrefix);

  window.requestAnimationFrame(() => {
    input.setSelectionRange(nextCaret, nextCaret);
  });
};
