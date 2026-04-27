export const UZBEKISTAN_PHONE_PREFIX = "+998";

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

export const toUzbekistanPhoneValue = (value: string = "") =>
  `${UZBEKISTAN_PHONE_PREFIX}${getUzbekistanPhoneDigits(value)}`;

export const isCompleteUzbekistanPhone = (value: string = "") =>
  getUzbekistanPhoneDigits(value).length === 9;
