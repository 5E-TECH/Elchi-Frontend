/**
 * Eski (v1) tanlash ro'yxati o'ramlarining (`SearchableSelect`, `FilterSelect`, `FilterMultiSelect`) bo'sh maydon
 * matni va FILTR rejimi.
 *
 * Ega qarori (2026-10-16): filtrda bo'sh qiymat — «hammasi». Bo'sh maydonda «Barchasi» (maketlar
 * `superadmin-orders-list`, `superadmin-orders-filters-mobile`), qiymat tanlangach maydonning o'zida × «Tozalash» —
 * bosilsa qiymat yana bo'sh (`""`) bo'ladi. v1 dagi «Tanlang <yorliq>» qoidasi olib tashlandi.
 *
 * Ro'yxat FILTR deb hisoblanadi, agar: iste'molchi `allOption` bergan; variantlarda `value=""` li («Barchasi»)
 * variant bor; namuna «Barchasi»-simon («Barchasi», «Barcha marketlar», «Все», «All …»); yoki o'ram o'zi filtr
 * (`FilterSelect useRedux`, `FilterMultiSelect`). Forma ro'yxati (bularning hech biri yo'q) o'z namunasini saqlaydi,
 * × chiqmaydi.
 *
 * Yorlig'i yashirin filtrda (`hideLabel`) maydon nomi maydonning o'zida — kulrang «Holat:» + «Barchasi»
 * (maketlar `superadmin-users-list`, `superadmin-mails-old`, `superadmin-products-list`; `Select inlineLabel`).
 */
const ALL_WORDS = ["all", "barchasi", "все"];
const ALL_PREFIXES = ["all ", "barcha ", "все "];

/** «Barchasi» / «Все» / «All» (va «Barcha …», «Все …», «All …») — filtrning «hammasi» namunasi. */
export const isAllPlaceholder = (placeholder: string | undefined): boolean => {
  const normalized = (placeholder ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return ALL_WORDS.includes(normalized) || ALL_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

/**
 * `allOption` — iste'molchining filtr belgisi: `true` — «Barchasi»; satr — «Barchasi» o'rniga shu matn
 * («Barcha marketlar»); `false` — filtr EMAS (avtomatik aniqlash ham o'chadi).
 */
export type AllOptionProp = boolean | string;

export type FilterEmptyLabelInput = {
  allOption?: AllOptionProp;
  /** `value=""` li variant nomi (bo'lsa) — `FilterSelect` / `SearchableSelect` variantlaridan. */
  emptyOptionLabel?: string;
  placeholder?: string;
  /**
   * Yorliq yashirin (`hideLabel`): maydon nomi maydon ichida («Viloyat: Barchasi»), shuning uchun namuna —
   * qisqa «Barchasi» («Barcha viloyatlar» emas; maket `superadmin-mails-old`).
   */
  hideLabel?: boolean;
  /** O'ramning o'zi filtr (`FilterSelect useRedux`, `FilterMultiSelect`). */
  implicitFilter?: boolean;
  /** «Barchasi» / «Все» / «All» (`ui:select.all`). */
  allWord: string;
};

const filled = (text: string | undefined): text is string => Boolean(text?.trim());

/** Ro'yxat filtrmi (yuqoridagi qoidalar). */
export const isFilterSelect = ({
  allOption,
  emptyOptionLabel,
  placeholder,
  implicitFilter,
}: Omit<FilterEmptyLabelInput, "allWord" | "hideLabel">): boolean => {
  if (allOption === false) return false;
  return Boolean(allOption) || emptyOptionLabel !== undefined || isAllPlaceholder(placeholder) || Boolean(implicitFilter);
};

/**
 * Filtr bo'lsa — bo'sh maydon matni («Barchasi»), aks holda `null` (forma: iste'molchi namunasi qoladi).
 * Ustuvorlik: `allOption` satri → `value=""` li variant nomi → (yorliq ko'rinsa) «Barchasi»-simon namuna
 * o'zgarishsiz («Barcha manbalar») → «Barchasi».
 */
export const resolveFilterEmptyLabel = (input: FilterEmptyLabelInput): string | null => {
  if (!isFilterSelect(input)) return null;
  const { allOption, emptyOptionLabel, placeholder, hideLabel, allWord } = input;
  if (typeof allOption === "string" && filled(allOption)) return allOption;
  if (filled(emptyOptionLabel)) return emptyOptionLabel;
  if (!hideLabel && filled(placeholder) && isAllPlaceholder(placeholder)) return placeholder;
  return allWord;
};
