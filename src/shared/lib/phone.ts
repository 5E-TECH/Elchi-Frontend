export const UZBEKISTAN_PHONE_PREFIX = "+998";
const UZBEKISTAN_PHONE_COUNTRY_CODE = "998";

export const getUzbekistanPhoneDigits = (value: string = "") => {
  const raw = value.trim();

  // Canonical "+998…": the "+998" prefix the inputs render separately is
  // definitively the country code, so everything after it is the local part.
  if (raw.startsWith(UZBEKISTAN_PHONE_PREFIX)) {
    return raw
      .slice(UZBEKISTAN_PHONE_PREFIX.length)
      .replace(/\D/g, "")
      .slice(0, 9);
  }

  // Bare digits: only strip a leading "998" when there are MORE than 9 digits
  // (i.e. it genuinely carries the country code). A ≤9-digit value is already
  // the LOCAL part — e.g. operator 99 + subscriber starting with 8
  // ("99 800 00 00" → "998000000") — and stripping it would eat the typed 8.
  const digits = raw.replace(/\D/g, "");
  const localDigits =
    digits.length > 9 && digits.startsWith(UZBEKISTAN_PHONE_COUNTRY_CODE)
      ? digits.slice(UZBEKISTAN_PHONE_COUNTRY_CODE.length)
      : digits;

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

const getLocalDigitCountBeforeCaret = (
  value: string,
  caret: number,
  withPrefix: boolean,
) => {
  const digitsBeforeCaret = value.slice(0, caret).replace(/\D/g, "");

  // Only discount the leading "998" when the field value actually embeds the
  // country code (withPrefix). For a local-only field the digits before the
  // caret ARE the local part, so a "998…" there is operator 99 + 8, not a
  // prefix — discounting it would throw the caret to the start.
  if (withPrefix && digitsBeforeCaret.startsWith(UZBEKISTAN_PHONE_COUNTRY_CODE)) {
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
    withPrefix,
  );
  const nextCaret = getCaretFromLocalDigitCount(nextDisplayValue, localDigitCount, withPrefix);

  window.requestAnimationFrame(() => {
    input.setSelectionRange(nextCaret, nextCaret);
  });
};
