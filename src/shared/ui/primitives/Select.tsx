import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from "react";
import { Check, ChevronDown, ChevronUp, Lock, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../lib/cx";
import { Button, ButtonIcon, type IconSlot } from "./Button";
import { useFieldControl } from "./fieldContext";
import { IconButton } from "./IconButton";
import { useMergedRefs } from "./overlay/mergeRefs";
import { Portal } from "./overlay/Portal";
import { useDismiss } from "./overlay/useDismiss";
import { usePopover } from "./overlay/usePopover";
import {
  findTypeaheadIndex,
  firstEnabledIndex,
  isPrintableKey,
  lastEnabledIndex,
  matchesQuery,
  pageIndex,
  splitMatch,
  stepIndex,
} from "./select/selectModel";
import { Spinner } from "./Spinner";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  TANLASH RO'YXATI — dizayn v2 (`.el-select` · `.el-select-placeholder` · `.el-options` · `.el-option` ·
 *  `.el-option-empty`, `design/CODE-MAP.md` 2.2, taxta `tizim-states-forms` 03 «Tanlash ro'yxatlari»)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Yopiq holatda oddiy maydon kabi (40 px, telefonda 44; `size="lg"` 48). Ochilganda ro'yxat maydon
 *  OSTIDA chiqadi (sig'masa — tepada), eni maydonga teng, eng ko'pi 280 px, keyin aylantiriladi.
 *  Tanlangan qator — ko'k fon, qalin matn va `Check`; klaviatura bilan yurilgan qator — kulrang.
 *  Telefonda ham shu ro'yxat maydon ostida (maketlar: `superadmin-branches-add-employee-dialog`,
 *  `superadmin-orders-filters-mobile`), qatorlar ≥ 44 px.
 *
 *  Turlar:
 *    oddiy        — `<button role="combobox">` (WAI-ARIA «select-only combobox»): ↑ ↓ Home End PageUp
 *                   PageDown, harf yozib o'tish (type-ahead), Enter / Probel — tanlash, Esc — yopish;
 *    `searchable` — maydonning o'zi qidiruvga aylanadi (`<input role="combobox" aria-autocomplete="list">`,
 *                   chapda `Search`): market, tuman kabi uzun ro'yxatlar; mos qism qalin; topilmasa
 *                   «Topilmadi» + izoh (`emptyHint`);
 *    `multiple`   — ko'p tanlov: tanlanganlar maydon ichida belgi (2 tasi ko'rinadi, qolgani «+N»),
 *                   har birini × bilan olib tashlash; ro'yxat ochiq qoladi, pastida «N ta tanlangan ·
 *                   Tozalash». `multiDisplay="count"` — belgi o'rniga «N ta tanlangan».
 *  Holatlar: tanlanmagan (namuna matni `text-subtle`) · tanlangan · xato (`Field error`) · o'chirilgan
 *  (`Lock`, sababi `Field hint` da) · yuklanmoqda (`loading`: yopiq — chevron o'rnida spinner, ochiq —
 *  ro'yxatda spinner + `loadingText`; `aria-busy`, maydon bloklanmaydi — taxta `tizim-loading` 9).
 *
 *  Tozalash (ega qarori 2026-10-16, filtrlar): qiymat tanlangach maydonning o'zida × («Tozalash», chevron
 *  o'rnida, Tab bilan yetib boriladi, telefonda 44 px) — `clearable` berilsa yoki variantlarda bo'sh qiymatli
 *  (`value: ""`) «Barchasi» varianti bo'lsa. Bunday variant — «hammasi»: qiymat `""` / `null` bo'lsa maydonda
 *  uning nomi namuna ko'rinishida (maket `.el-select-placeholder` «Barchasi»), × qiymatni yana `""` qiladi
 *  (variantsiz `clearable` — `null`).
 *
 *  Yorliq, ko'rsatma va xato — `Field` (`labelAs="span"`: yorliq `aria-labelledby` bilan ulanadi).
 *  Fokus doim maydonda qoladi (`aria-activedescendant`, variant id'si qiymatdan), ro'yxat `Portal` da
 *  (`dropdown` qatlami; oyna ichida — oynadan yuqori). Esc va tashqariga bosish faqat ro'yxatni yopadi
 *  (oyna qoladi); maydon ko'rinmay qolsa (ota panel yig'ildi, skroll) — ro'yxat ham yopiladi. Qidiruvli
 *  yopiq maydonda Enter formani yubormaydi — ro'yxatni ochadi. Ko'p tanlovda «N ta tanlangan» live region'da.
 */

export type SelectSize = "sm" | "md" | "lg";

export type SelectOption<V extends string = string> = {
  value: V;
  /** Ko'rinadigan nom — qidiruv va type-ahead ham shu bo'yicha. */
  label: string;
  /** Ikkinchi qator (kulrang, 12 px): «dilshod.k · Kuryer», telefon raqami. */
  description?: ReactNode;
  /** Chapdagi ikonka (lucide). */
  icon?: IconSlot;
  disabled?: boolean;
  /** Guruh sarlavhasi (`.el-menu-label`). Bir guruh variantlari ketma-ket chiziladi. */
  group?: string;
  /** Qidiruv uchun qo'shimcha matn (telefon, login, kod) — ko'rinmaydi. */
  searchText?: string;
};

export type SelectOptionState = { selected: boolean; active: boolean; query: string };

type SelectBaseProps<V extends string> = {
  options: ReadonlyArray<SelectOption<V>>;
  /**
   * Hech narsa tanlanmaganda (maket: «Viloyat tanlang»). Variantlarda bo'sh qiymatli («Barchasi») variant bo'lsa —
   * uning nomi ustun (filtr: bo'sh maydonda «Barchasi»).
   */
  placeholder?: string;
  /**
   * Tanlovni tozalash tugmasi (×, qiymat tanlangach). Ko'p tanlovda — «Barchasini tozalash». Bitta tanlovda bo'sh
   * qiymatli («Barchasi») variant bo'lsa, × o'zi chiqadi (berilmasa ham).
   */
  clearable?: boolean;
  /** × tugmasi nomi (sukut: «Tozalash» / «Barchasini tozalash»; maket: «Barcha holatlarni tozalash»). */
  clearLabel?: string;
  /**
   * Ro'yxat yuklanmoqda (`tizim-loading` 9 «Tanlov ichida spinner»): maydon bloklanmaydi, yopiq holatda
   * chevron o'rnida spinner; ochilganda ro'yxatda spinner + «Yuklanmoqda...»; maydonda `aria-busy`.
   */
  loading?: boolean;
  /** Yuklanish matni ro'yxatda (maket: «Kuryerlar yuklanmoqda…»; sukut «Yuklanmoqda...»). */
  loadingText?: string;
  disabled?: boolean;
  readOnly?: boolean;
  /** Xato holati (odatda `Field error` dan keladi). */
  invalid?: boolean;
  required?: boolean;
  /** sm 32 (jadval ostidagi «10 ta» — `.el-select.el-btn-sm`; telefonda 44) · md 40 (sukut) · lg 48 (kuryer ekranlari). */
  size?: SelectSize;
  /** Maydon chapidagi ikonka (`searchable` da sukut — `Search`). */
  icon?: IconSlot;
  /**
   * Maydon ichidagi yorliq (bitta tanlov) — yorlig'i yashirin filtrda: qiymat yoki namunadan oldin kulrang
   * «Holat:» (maketlar `superadmin-users-list` «Holat: Barchasi», `superadmin-mails-old`,
   * `superadmin-products-list`). Ekran o'quvchidan yashirin — maydon nomi `Field` yorlig'idan (`hideLabel`).
   * Bunda bo'sh maydon matni oddiy rangda: «Barchasi» — holat, taklif emas.
   */
  inlineLabel?: string;
  /**
   * Oddiy (qidiruvsiz, bitta tanlovli) maydonda tanlangan nomdan keyin — masalan bo'lim sonining belgisi
   * (maket `superadmin-mails-today` telefonda: «Bugungi pochtalar ⟨8⟩»). Bezak: ekran o'quvchi nomini
   * `aria-label` dan oladi. Qidiruvli va ko'p tanlovli maydonda e'tiborga olinmaydi.
   */
  valueAddon?: ReactNode;
  /** Ro'yxat qayerda ochiladi (sig'masa baribir ag'dariladi). Sukut — pastda. */
  placement?: "bottom" | "top";
  /**
   * Ro'yxat eni: `"match"` (sukut) — maydon eni bilan bir xil; `"min"` — kamida maydon eni, variantlar uzunroq bo'lsa
   * kengroq. Tor maydon uchun (telefondagi bosh sahifa «Yil»i — matn kengligida; `"match"` da ro'yxat 53 px bo'lib
   * «Yil» harflarga bo'linardi, tya24blo).
   */
  panelWidth?: "match" | "min";
  /** Ro'yxat ochiqligi (boshqariladigan). */
  open?: boolean;
  /** Birinchi chizishda ochiq (boshqarilmaydigan; namuna sahifasi). */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Topilmaganda sarlavha (sukut «Topilmadi»). */
  emptyText?: ReactNode;
  /** Topilmaganda izoh: maket ««Zarafshon» bo'yicha market yo'q». Funksiya — qidiruv matni bilan. */
  emptyHint?: ReactNode | ((query: string) => ReactNode);
  /** Ro'yxat umuman bo'sh bo'lsa (qidiruvsiz). */
  noOptionsText?: ReactNode;
  /** Variant ichini o'zingiz chizish (ikonka/belgi o'rni saqlanadi). */
  renderOption?: (option: SelectOption<V>, state: SelectOptionState) => ReactNode;
  /** Ro'yxat nomi (`aria-label`; maket: «Marketlar»). Berilmasa — `Field` yorlig'i yoki `aria-label`. */
  listLabel?: string;
  /** Oddiy forma uchun yashirin `<input name>` (ko'p tanlovda har qiymatga bittadan). */
  name?: string;
  id?: string;
  /** Tashqi quti (maydon) klassi. */
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  /** Fokus maydondan (ro'yxatdan ham) chiqqanda — react-hook-form `onBlur`. */
  onBlur?: () => void;
  /** Maydon elementi (tugma yoki qidiruv maydoni) — `focus()` uchun. */
  ref?: Ref<HTMLElement>;
  /**
   * `false` — ro'yxat portalga chiqmaydi, maydon ostida `absolute` chiziladi (mavzu konteyneri ichidagi
   * namuna, statik kadr). Sukut `true`.
   */
  portal?: boolean;
};

type SearchProps = {
  /** Maydonning o'zi qidiruvga aylanadi (uzun ro'yxatlar). */
  searchable?: boolean;
  /** Qidiruv matni (boshqariladigan) — server qidiruvi uchun `onSearchChange` bilan. */
  searchValue?: string;
  defaultSearchValue?: string;
  onSearchChange?: (query: string) => void;
  /** Mahalliy saralash: sukut — nom (+ `searchText`) ichida qism; `false` — saralamaydi (server). */
  filter?: false | ((option: SelectOption<string>, query: string) => boolean);
};

export type SingleSelectProps<V extends string = string> = SelectBaseProps<V> &
  SearchProps & {
    multiple?: false;
    /**
     * Tanlangan qiymat; `null` / `""` (yoki variantlarda yo'q qiymat) — tanlanmagan. Bo'sh qiymatli («Barchasi»)
     * variant bo'lsa, `null` / `""` — o'sha variant.
     */
    value?: V | null;
    defaultValue?: V | null;
    onChange?: (value: V | null, option: SelectOption<V> | null) => void;
  };

export type MultiSelectProps<V extends string = string> = SelectBaseProps<V> & {
  multiple: true;
  value?: readonly V[];
  defaultValue?: readonly V[];
  onChange?: (value: V[]) => void;
  /** Maydonda nechta belgi ko'rinadi, qolgani «+N» (sukut 2 — maket). */
  maxChips?: number;
  /** `chips` (sukut) — belgilar; `count` — «N ta tanlangan». */
  multiDisplay?: "chips" | "count";
  /** Belgini olib tashlash tugmasi nomi (maket: «Yangi holatini olib tashlash»). */
  removeLabel?: (label: string) => string;
  searchable?: never;
};

export type SelectProps<V extends string = string> = SingleSelectProps<V> | MultiSelectProps<V>;

// ── Klasslar (CODE-MAP 2.2: `INPUT` + `.el-select`, `RAISED` + `.el-options`) ─────────────────────

/** Tashqi quti — `.el-input`: chegara, fon, fokus halqasi `focus-within` da (TextInput bilan bir xil). */
const BOX_BASE =
  "relative flex w-full min-w-0 items-center border bg-input text-base text-text md:text-sm " +
  "transition-[background-color,border-color,color,box-shadow] duration-150 motion-reduce:transition-none " +
  "focus-within:ring-3";

const BOX_SIZE: Record<SelectSize, string> = {
  sm: "h-8 rounded-lg max-md:h-11",
  md: "h-10 rounded-[10px] max-md:h-11",
  lg: "h-12 rounded-xl md:text-[15px]",
};

/** Ko'p tanlov: belgilar o'raladi — balandlik kamida 40/44, maket `padding: 7px 4px 7px 8px`. */
const MULTI_BOX_SIZE: Record<SelectSize, string> = {
  sm: "min-h-8 rounded-lg py-[3px] pl-2 pr-1 max-md:min-h-11",
  md: "min-h-10 rounded-[10px] py-[7px] pl-2 pr-1 max-md:min-h-11",
  lg: "min-h-12 rounded-xl py-[11px] pl-2 pr-1 md:text-[15px]",
};

type BoxState = { invalid: boolean; disabled: boolean; readOnly: boolean; open: boolean };

/**
 * Holat → chegara/fon (bir xususiyatga ikki klass tushmasin — JS'da tanlanadi). Ochiq ro'yxat — fokus
 * ko'rinishida (maket `.is-focus`: ko'k chegara + halqa), fokus boshqa joyda bo'lsa ham (namuna kadri).
 */
const boxStateClasses = ({ invalid, disabled, readOnly, open }: BoxState) =>
  cx(
    invalid
      ? cx("border-danger focus-within:ring-danger-soft", open && "ring-3 ring-danger-soft")
      : open
        ? "border-action ring-3 ring-focus"
        : "border-border-strong focus-within:border-action focus-within:ring-focus",
    !invalid && !disabled && !open && "hover:border-text-subtle",
    disabled ? "cursor-not-allowed bg-sunken text-text-subtle" : readOnly ? "bg-sunken" : "cursor-pointer",
  );

/**
 * Maydon ichidagi boshqaruv (tugma yoki qidiruv maydoni): shaffof, global `:focus-visible` konturi
 * o'chiq (`outline-none!` — fokus qutining chegarasi va halqasida, TextInput kabi), quti balandligigacha
 * cho'ziladi (bosish maydoni to'liq 40/44/48).
 */
const CONTROL_BASE =
  "-my-px min-w-0 flex-1 self-stretch bg-transparent text-inherit outline-none! disabled:cursor-not-allowed";

/** `.el-options` (RAISED + `p-1.5`, oraliq 2 px). Ochilish: shaffoflik + 4 px siljish, 200 ms (`tizim-motion`). */
const PANEL =
  "flex min-h-0 flex-col rounded-xl border border-border bg-raised p-1.5 text-sm text-text shadow-xl " +
  "transition-[opacity,translate] duration-200 ease-out starting:opacity-0 motion-reduce:transition-none";

/** `.el-option`: 36 px (telefonda 44), radius 8; tanlangan — `action-soft`, qalin, ko'k matn. */
const OPTION_BASE =
  "flex min-h-9 w-full cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left " +
  "transition-[background-color,color] duration-150 motion-reduce:transition-none max-md:min-h-11";
const OPTION_SELECTED = "bg-action-soft font-semibold text-action-fg";
const OPTION_ACTIVE = "bg-sunken text-text";
const OPTION_IDLE = "text-text";
const OPTION_DISABLED = "cursor-not-allowed text-text-subtle";

/** `.el-option-empty`. */
const OPTION_EMPTY = "px-2.5 py-4 text-center text-[13px] text-text-muted";

/** `.el-menu-label` — guruh sarlavhasi. */
const GROUP_LABEL = "px-2.5 pb-0.5 pt-1.5 text-xs font-semibold text-text-muted";

/** `.el-badge.el-tone-neutral` + `.el-chip-x` (maket: o'ngda 2 px, oraliq 2 px). */
const CHIP =
  "inline-flex h-6 max-w-full items-center gap-0.5 whitespace-nowrap rounded-md bg-sunken pl-2 pr-0.5 text-xs " +
  "font-semibold leading-none text-text-muted ring-1 ring-inset ring-border";
const CHIP_PLAIN =
  "inline-flex h-6 items-center whitespace-nowrap rounded-md bg-sunken px-2 text-xs font-semibold leading-none " +
  "text-text-muted ring-1 ring-inset ring-border";
/** `.el-chip-x`: 20 px doira; telefonda bosish maydoni 44 px (`after:-inset-3`, CODE-MAP). */
const CHIP_X =
  "pointer-events-auto relative inline-flex size-5 shrink-0 items-center justify-center rounded-full text-text-muted " +
  "transition-[background-color,color] duration-150 hover:bg-border hover:text-text motion-reduce:transition-none " +
  "max-md:after:absolute max-md:after:-inset-3 max-md:after:content-['']";

const EMPTY_VALUES: readonly never[] = [];

/** Ro'yxat bo'limlari: guruh birinchi uchragan joyida (uning hamma variantlari shu yerda), guruhsizlar o'z o'rnida. */
type Section<V extends string> = {
  key: string;
  label: string | undefined;
  items: Array<{ option: SelectOption<V>; index: number }>;
};

/** Bo'limlar va ko'rinish tartibidagi tekis ro'yxat (klaviatura indeksi shu tartibda). */
const buildSections = <V extends string>(options: ReadonlyArray<SelectOption<V>>) => {
  const sections: Array<Section<V>> = [];
  const byGroup = new Map<string, Section<V>>();
  for (const option of options) {
    if (option.group) {
      let section = byGroup.get(option.group);
      if (!section) {
        section = { key: `g${sections.length}`, label: option.group, items: [] };
        sections.push(section);
        byGroup.set(option.group, section);
      }
      section.items.push({ option, index: -1 });
      continue;
    }
    const last = sections[sections.length - 1];
    if (last && last.label === undefined) last.items.push({ option, index: -1 });
    else sections.push({ key: `u${sections.length}`, label: undefined, items: [{ option, index: -1 }] });
  }
  const flat: Array<SelectOption<V>> = [];
  for (const section of sections) {
    for (const item of section.items) {
      item.index = flat.length;
      flat.push(item.option);
    }
  }
  return { sections, flat };
};

const defaultFilter = (option: SelectOption<string>, query: string) =>
  matchesQuery(option.searchText ? `${option.label} ${option.searchText}` : option.label, query);

/** Qidiruvda mos qism qalin (maket `.el-option` ichida `<strong>`). */
const Highlight = ({ text, query }: { text: string; query: string }) => (
  <>
    {splitMatch(text, query).map((segment, index) =>
      segment.match ? (
        <strong key={index} className="font-bold">
          {segment.text}
        </strong>
      ) : (
        <Fragment key={index}>{segment.text}</Fragment>
      ),
    )}
  </>
);

/**
 * Dizayn v2 tanlash ro'yxati.
 *
 *   <Field label="Viloyat" required labelAs="span" error={errors.region}>
 *     <Select options={regions} value={regionId} onChange={setRegionId} placeholder="Viloyat tanlang" />
 *   </Field>
 *   <Field label="Market" labelAs="span">
 *     <Select searchable options={markets} value={marketId} onChange={setMarketId} loading={isLoading}
 *       emptyHint={(q) => t("markets.notFound", { q })} />
 *   </Field>
 *   <Field label="Holat" labelAs="span" hint="Tanlanmasa — barcha holatlar">
 *     <Select multiple clearable options={statuses} value={statuses} onChange={setStatuses} />
 *   </Field>
 */
export const Select = <V extends string = string>(props: SelectProps<V>) => {
  const {
    options,
    placeholder,
    clearable = false,
    clearLabel,
    loading = false,
    loadingText,
    disabled,
    readOnly,
    invalid,
    required,
    size = "md",
    icon,
    inlineLabel,
    valueAddon,
    placement = "bottom",
    panelWidth = "match",
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    emptyText,
    emptyHint,
    noOptionsText,
    renderOption,
    listLabel,
    name,
    id,
    className,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "aria-describedby": ariaDescribedBy,
    onBlur,
    ref,
    portal = true,
  } = props;
  const multiple = props.multiple === true;
  const searchable = !multiple && props.searchable === true;

  const { t } = useTranslation("ui");
  const field = useFieldControl({ id, "aria-describedby": ariaDescribedBy, invalid, disabled, readOnly, required });
  const autoId = useId();
  const controlId = field.id ?? `select-${autoId}`;
  const listboxId = `${controlId}-listbox`;
  /**
   * Variant id'si QIYMATDAN (indeksdan emas): qidiruvda natija o'zgarganda faol variant boshqa bo'lsa,
   * `aria-activedescendant` ham o'zgaradi — ekran o'quvchi yangi variantni aytadi (indeks bo'yicha
   * `-option-0` bir xil qolardi). `encodeURIComponent` — bo'sh joysiz va noyob (qiymatlar noyob).
   */
  const optionId = (value: string) => `${controlId}-option-${encodeURIComponent(value)}`;
  const labelledBy = ariaLabelledBy ?? field.labelId;

  // ── Qiymat ────────────────────────────────────────────────────────────────
  const [innerSingle, setInnerSingle] = useState<V | null>(() =>
    props.multiple ? null : (props.defaultValue ?? null),
  );
  const [innerMulti, setInnerMulti] = useState<readonly V[]>(() =>
    props.multiple ? (props.defaultValue ?? EMPTY_VALUES) : EMPTY_VALUES,
  );
  const singleValue = props.multiple ? null : props.value === undefined ? innerSingle : props.value;
  const multiValue = props.multiple ? (props.value ?? innerMulti) : EMPTY_VALUES;
  /**
   * «Barchasi» varianti (filtr): bo'sh qiymatli (`""`) variant — «hammasi». Qiymat `null` / `""` bo'lsa u tanlangan
   * (ro'yxatda belgili), maydonda esa nomi namuna ko'rinishida; × qiymatni yana `""` qiladi.
   */
  const allOption = multiple ? undefined : options.find((option) => option.value === "");
  /** Bitta tanlovda qiymat yo'q (`null` / `""`) — maydonda namuna, × chiqmaydi. */
  const singleEmpty = singleValue === null || singleValue === undefined || singleValue === "";
  const selectedValues: readonly V[] = useMemo(
    () =>
      multiple
        ? multiValue
        : singleEmpty
          ? allOption
            ? [allOption.value]
            : EMPTY_VALUES
          : [singleValue as V],
    [allOption, multiple, multiValue, singleEmpty, singleValue],
  );
  const selectedSet = useMemo(() => new Set<string>(selectedValues), [selectedValues]);
  const optionByValue = useMemo(() => new Map<string, SelectOption<V>>(options.map((o) => [o.value, o])), [options]);
  const selectedOptions = useMemo(
    () => selectedValues.map((value) => optionByValue.get(value)).filter((o): o is SelectOption<V> => Boolean(o)),
    [optionByValue, selectedValues],
  );
  const selectedLabel = !multiple && !singleEmpty ? selectedOptions[0]?.label : undefined;
  /** Tozalanadigan qiymat bormi (× shunda chiqadi). */
  const hasValue = multiple ? selectedValues.length > 0 : !singleEmpty;

  // ── Ochiqlik, qidiruv, faol variant ──────────────────────────────────────
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const isOpen = (openProp ?? innerOpen) && !field.disabled && !field.readOnly;
  const searchProps = props.multiple ? undefined : props;
  const [innerQuery, setInnerQuery] = useState(searchProps?.defaultSearchValue ?? "");
  const query = searchable ? (searchProps?.searchValue ?? innerQuery) : "";
  const [activeValue, setActiveValue] = useState<V | null>(null);

  const filter = searchProps?.filter;
  const visibleOptions = useMemo(() => {
    if (!searchable || filter === false || !query.trim()) return options;
    const test = filter ?? defaultFilter;
    return options.filter((option) => test(option, query));
  }, [filter, options, query, searchable]);
  const { sections, flat } = useMemo(() => buildSections(visibleOptions), [visibleOptions]);

  const activeFound = activeValue === null ? -1 : flat.findIndex((option) => option.value === activeValue);
  // Qidiruvda faol variant yo'qolsa (natija o'zgardi) — birinchi mos variant (Enter uni tanlaydi).
  const activeIndex = activeFound >= 0 ? activeFound : searchable && query.trim() ? firstEnabledIndex(flat) : -1;

  // ── Ref'lar, joylashuv, yopish ────────────────────────────────────────────
  const { anchorRef, floatingRef, floatingStyles, side } = usePopover<HTMLDivElement, HTMLDivElement>({
    open: isOpen && portal,
    placement: placement === "top" ? "top-start" : "bottom-start",
    matchWidth: panelWidth === "min" ? "min" : true,
    maxHeight: 280,
  });
  const controlRef = useRef<HTMLElement | null>(null);
  const setControlRef = useMergedRefs<HTMLElement>(controlRef, ref);
  const listRef = useRef<HTMLDivElement | null>(null);
  /** Keyingi faol variant ko'rinishga aylantirilsinmi (klaviatura / ochilish — ha, sichqoncha — yo'q). */
  const scrollActiveRef = useRef(false);
  const typeaheadRef = useRef({ buffer: "", timer: 0 });

  useEffect(() => () => window.clearTimeout(typeaheadRef.current.timer), []);

  const setOpen = (next: boolean) => {
    if (openProp === undefined) setInnerOpen(next);
    onOpenChange?.(next);
  };

  const setQuery = (next: string) => {
    if (searchProps?.searchValue === undefined) setInnerQuery(next);
    searchProps?.onSearchChange?.(next);
  };

  const close = () => {
    setOpen(false);
    if (query) setQuery("");
    typeaheadRef.current.buffer = "";
  };

  const focusControl = () => controlRef.current?.focus({ preventScroll: true });

  /** Ochish: faol variant — tanlangan (yoki birinchi/oxirgi faol). */
  const openList = (target: "selected" | "first" | "last" = "selected") => {
    if (field.disabled || field.readOnly) return;
    const selectedIndex = flat.findIndex((option) => selectedSet.has(option.value) && !option.disabled);
    const index =
      target === "first"
        ? firstEnabledIndex(flat)
        : target === "last"
          ? lastEnabledIndex(flat)
          : selectedIndex >= 0
            ? selectedIndex
            : firstEnabledIndex(flat);
    setActiveValue(index >= 0 ? flat[index].value : null);
    scrollActiveRef.current = true;
    if (!isOpen) setOpen(true);
  };

  useDismiss({
    open: isOpen,
    refs: [anchorRef, floatingRef],
    focusOutside: true,
    onDismiss: () => close(),
  });

  // Maydon ko'rinmay qolsa — ro'yxat yopiladi. Portaldagi ro'yxat maydonga «yopishmagan»: ota panel
  // yig'ilsa (buyurtmalar filtri telefonda har tanlovdan keyin yig'iladi, `overflow-hidden`) yoki maydon
  // skroll bilan chiqib ketsa, ro'yxat egasiz ekranda osilib qolardi. `IntersectionObserver` ota
  // konteynerlar kesishini ham hisoblaydi; yo'q muhitda (jsdom) — kuzatilmaydi.
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    const anchor = anchorRef.current;
    if (!isOpen || !portal || !anchor || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => !entry.isIntersecting)) closeRef.current();
    });
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [anchorRef, isOpen, portal]);

  // Faol variant ro'yxatda ko'rinsin (faqat klaviatura va ochilishda — sichqoncha ostidagi ro'yxat sakramasin).
  useLayoutEffect(() => {
    if (!isOpen || !scrollActiveRef.current) return;
    scrollActiveRef.current = false;
    const list = listRef.current;
    const element = activeIndex >= 0 ? document.getElementById(optionId(flat[activeIndex].value)) : null;
    if (!list || !element) return;
    const top = element.offsetTop;
    const bottom = top + element.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  });

  // ── Tanlash ───────────────────────────────────────────────────────────────
  const commitSingle = (next: V | null) => {
    if (props.multiple) return;
    if (props.value === undefined) setInnerSingle(next);
    props.onChange?.(next, next === null ? null : (optionByValue.get(next) ?? null));
  };

  const commitMulti = (next: V[]) => {
    if (!props.multiple) return;
    if (props.value === undefined) setInnerMulti(next);
    props.onChange?.(next);
  };

  const choose = (option: SelectOption<V> | undefined) => {
    if (!option || option.disabled) return;
    if (multiple) {
      const next = selectedSet.has(option.value)
        ? selectedValues.filter((value) => value !== option.value)
        : [...selectedValues, option.value];
      commitMulti(next);
      setActiveValue(option.value);
      return;
    }
    commitSingle(option.value);
    close();
  };

  const clearAll = () => {
    if (multiple) commitMulti([]);
    else {
      // «Barchasi» varianti bo'lsa — uning qiymati (`""`), aks holda `null`.
      commitSingle(allOption ? allOption.value : null);
      if (isOpen) close();
    }
    focusControl();
  };

  const removeValue = (value: V) => {
    commitMulti(selectedValues.filter((item) => item !== value));
    focusControl();
  };

  const moveActive = (index: number) => {
    if (index < 0) return;
    scrollActiveRef.current = true;
    setActiveValue(flat[index].value);
  };

  const typeahead = (key: string) => {
    const state = typeaheadRef.current;
    window.clearTimeout(state.timer);
    state.buffer += key;
    state.timer = window.setTimeout(() => {
      state.buffer = "";
    }, 500);
    const index = findTypeaheadIndex(flat, state.buffer, activeIndex);
    if (index < 0) return;
    moveActive(index);
    if (!isOpen) setOpen(true);
  };

  // ── Klaviatura (WAI-ARIA combobox + listbox) ──────────────────────────────
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (field.disabled || field.readOnly || event.nativeEvent.isComposing) return;
    const { key } = event;

    if (!isOpen) {
      if (key === "ArrowDown" || key === "ArrowUp") {
        event.preventDefault();
        openList(key === "ArrowUp" && !selectedValues.length ? "last" : "selected");
      } else if (key === "Enter" || (!searchable && key === " ")) {
        // Qidiruvli maydon ham `<input>`: Enter forma ichida uni yuborib yubormasin (buyurtma yaratish
        // formasi) — v1 dagidek ro'yxatni ochadi.
        event.preventDefault();
        openList();
      } else if (!searchable && (key === "Home" || key === "End")) {
        event.preventDefault();
        openList(key === "Home" ? "first" : "last");
      } else if (!searchable && isPrintableKey(event)) {
        event.preventDefault();
        typeahead(key);
      }
      return;
    }

    switch (key) {
      case "ArrowDown":
        event.preventDefault();
        if (!event.altKey) moveActive(stepIndex(flat, activeIndex, 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        if (event.altKey && !multiple) choose(flat[activeIndex]);
        else if (event.altKey) close();
        else moveActive(stepIndex(flat, activeIndex, -1));
        return;
      case "PageDown":
      case "PageUp":
        event.preventDefault();
        moveActive(pageIndex(flat, activeIndex, key === "PageDown" ? 1 : -1));
        return;
      case "Home":
      case "End":
        // Qidiruv maydonida Home/End — matn ichida kursor (WAI-ARIA: tahrirlanadigan combobox).
        if (searchable) return;
        event.preventDefault();
        moveActive(key === "Home" ? firstEnabledIndex(flat) : lastEnabledIndex(flat));
        return;
      case "Enter":
        event.preventDefault();
        choose(flat[activeIndex]);
        return;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      case "Tab":
        close();
        return;
      case " ":
        if (searchable) return;
        event.preventDefault();
        // Type-ahead davomida probel — nomning bir qismi («Toshkent v…»), aks holda tanlash.
        if (typeaheadRef.current.buffer) typeahead(key);
        else choose(flat[activeIndex]);
        return;
      default:
        if (!searchable && isPrintableKey(event)) {
          event.preventDefault();
          typeahead(key);
        }
    }
  };

  /** Probel tugmani `keyup` da bosadi — ochish/tanlashni `keydown` boshqaradi, ikkinchi marta bosilmasin. */
  const handleKeyUp = (event: KeyboardEvent<HTMLElement>) => {
    if (!searchable && event.key === " ") event.preventDefault();
  };

  const handleControlClick = () => {
    if (field.disabled || field.readOnly) return;
    focusControl();
    if (isOpen && !searchable) close();
    else if (!isOpen) openList();
  };

  /** Quti bo'sh joyi (chekka, chevron) bosilsa ham — maydon fokusi va ochish/yopish. */
  const handleBoxMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (field.disabled || field.readOnly || event.button !== 0) return;
    const target = event.target as HTMLElement;
    const control = controlRef.current;
    if (control && (target === control || control.contains(target))) return;
    if (target.closest("button, input, a")) return;
    event.preventDefault();
    focusControl();
    if (isOpen) close();
    else openList();
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setQuery(next);
    setActiveValue(null); // birinchi mos variant faol bo'ladi (`activeIndex`)
    scrollActiveRef.current = true;
    if (!isOpen) setOpen(true);
  };

  const handleInputFocus = (event: FocusEvent<HTMLInputElement>) => {
    // Klaviaturadan kelganda tanlangan nom belgilanadi — yozish uni almashtiradi (qidiruv boshlanadi).
    if (!isOpen) event.target.select();
  };

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget as Node | null;
    if (next && (anchorRef.current?.contains(next) || floatingRef.current?.contains(next))) return;
    // Fokus HECH QAYERGA ketdi (`relatedTarget` yo'q): telefonda klaviatura «Tayyor» bilan yopildi, `blur()`,
    // oyna fokusni yo'qotdi. `useDismiss` faqat boshqa elementdagi `focusin` ni ko'radi — ro'yxat egasiz
    // ochiq qolib, sahifa skrollida keyingi maydon ustiga tushardi va unga bosish variant tanlab yuborardi.
    // WAI-ARIA combobox: fokus maydondan chiqsa ro'yxat yopiladi. Variant bosilishi fokusni olmaydi
    // (panel `mousedown` → `preventDefault`), shuning uchun tanlashga ta'sir qilmaydi.
    if (!next && isOpen) close();
    onBlur?.();
  };

  // ── Ko'rinish ─────────────────────────────────────────────────────────────
  const state = { invalid: field.invalid, disabled: field.disabled, readOnly: field.readOnly, open: isOpen };
  const placeholderText = allOption?.label || (placeholder ?? t("select.placeholder"));
  const comboboxAria = {
    id: controlId,
    role: "combobox" as const,
    "aria-expanded": isOpen,
    "aria-haspopup": "listbox" as const,
    "aria-controls": isOpen ? listboxId : undefined,
    "aria-activedescendant": isOpen && !loading && activeIndex >= 0 ? optionId(flat[activeIndex].value) : undefined,
    "aria-labelledby": labelledBy,
    "aria-label": labelledBy ? undefined : ariaLabel,
    "aria-describedby": field["aria-describedby"],
    "aria-invalid": field["aria-invalid"],
    "aria-errormessage": field["aria-errormessage"],
    "aria-required": field["aria-required"],
    "aria-readonly": field.readOnly || undefined,
    "aria-busy": loading || undefined,
  };

  const trailingIcon = field.disabled ? (
    <ButtonIcon icon={Lock} px={16} className="text-text-subtle" />
  ) : loading && !isOpen ? (
    // Yopiq + yuklanmoqda: chevron o'rnida spinner (`tizim-loading` 9), maydon bosiladi.
    <Spinner data-select-loading="" className="text-text-subtle" />
  ) : isOpen ? (
    <ButtonIcon icon={ChevronUp} px={16} className="text-action-fg" />
  ) : (
    <ButtonIcon icon={ChevronDown} px={16} className="text-text-subtle" />
  );

  // × — qiymat bo'lsa: `clearable` yoki «Barchasi» varianti (filtr). Oddiy `<button>` — Tab bilan yetib boriladi;
  // nomi «Tozalash», qaysi maydon ekani — `aria-describedby` (yorliq). Bosilganda fokus maydonga qaytadi.
  // Bitta tanlovda × chevron/spinner o'rnida turadi: ro'yxat yuklanayotganda (URL'dagi qiymatning nomi hali
  // kelmagan) — spinner ko'rinadi, × yuklangach chiqadi.
  const canClear =
    (clearable || Boolean(allOption)) &&
    hasValue &&
    !field.disabled &&
    !field.readOnly &&
    (multiple || !loading);
  const clearButton = canClear ? (
    <IconButton
      label={clearLabel ?? t(multiple ? "select.clearAll" : "select.clear")}
      icon={X}
      size="sm"
      aria-describedby={labelledBy}
      data-select-clear=""
      className={cx("relative text-text-subtle", multiple ? "-my-1 max-md:-my-2" : "-mr-2 max-md:-mr-3")}
      onMouseDown={(event) => event.preventDefault()}
      onClick={clearAll}
    />
  ) : null;

  // Ichki yorliq (yorlig'i yashirin filtr): «Holat:» kulrang, ekran o'quvchidan yashirin (nomi `Field` yorlig'idan).
  const inlineLabelNode =
    inlineLabel && !multiple ? (
      <span
        aria-hidden="true"
        data-select-inline-label=""
        className="pointer-events-none shrink-0 whitespace-nowrap text-text-muted"
      >
        {`${inlineLabel}:`}
      </span>
    ) : null;

  const hiddenInputs = name
    ? (selectedValues.length ? selectedValues : [""]).map((value, index) => (
        <input key={`${value}-${index}`} type="hidden" name={name} value={value} />
      ))
    : null;

  let trigger: ReactNode;
  if (multiple) {
    const multiProps = props as MultiSelectProps<V>;
    const maxChips = Math.max(0, multiProps.maxChips ?? 2);
    const display = multiProps.multiDisplay ?? "chips";
    const visibleChips = selectedOptions.slice(0, maxChips);
    const hiddenCount = selectedOptions.length - visibleChips.length;
    const summary = selectedOptions.length
      ? selectedOptions.map((option) => option.label).join(", ")
      : placeholderText;
    const removeName = multiProps.removeLabel ?? ((label: string) => t("select.remove", { label }));

    trigger = (
      <div
        ref={anchorRef}
        data-select="multiple"
        data-open={isOpen || undefined}
        data-invalid={field.invalid || undefined}
        className={cx(BOX_BASE, MULTI_BOX_SIZE[size], "gap-2", boxStateClasses(state), className)}
      >
        {/*
          Butun quti — bitta combobox tugmasi; belgilar va × uning ustida (ichida tugma bo'lmaydi).
          `-inset-px` — chegara ham bosiladi: tugma qutining to'liq 40/44/48 px balandligida (telefonda ≥ 44).
        */}
        <button
          ref={setControlRef}
          type="button"
          {...comboboxAria}
          disabled={field.disabled}
          onClick={handleControlClick}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onBlur={handleBlur}
          className="absolute -inset-px cursor-[inherit] rounded-[inherit] outline-none!"
        >
          <span className="sr-only">{summary}</span>
        </button>
        {icon ? <ButtonIcon icon={icon} px={18} className="pointer-events-none relative ml-1 text-text-subtle" /> : null}
        <span className="pointer-events-none relative flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {!selectedOptions.length ? (
            <span className="truncate pl-1 text-text-subtle">{placeholderText}</span>
          ) : display === "count" ? (
            <span className="truncate pl-1">{t("select.selectedCount", { count: selectedOptions.length })}</span>
          ) : (
            <>
              {visibleChips.map((option) => (
                <span key={option.value} className={CHIP}>
                  <span className="min-w-0 truncate">{option.label}</span>
                  {!field.disabled && !field.readOnly ? (
                    <button
                      type="button"
                      aria-label={removeName(option.label)}
                      title={removeName(option.label)}
                      className={CHIP_X}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => removeValue(option.value)}
                    >
                      <X aria-hidden="true" size={12} strokeWidth={2} />
                    </button>
                  ) : null}
                </span>
              ))}
              {hiddenCount > 0 ? <span className={CHIP_PLAIN}>{`+${hiddenCount}`}</span> : null}
            </>
          )}
        </span>
        {clearButton}
        <span aria-hidden="true" className="pointer-events-none relative flex shrink-0 items-center pr-1.5">
          {trailingIcon}
        </span>
        {hiddenInputs}
      </div>
    );
  } else if (searchable) {
    trigger = (
      <div
        ref={anchorRef}
        data-select="search"
        data-open={isOpen || undefined}
        data-invalid={field.invalid || undefined}
        onMouseDown={handleBoxMouseDown}
        className={cx(BOX_BASE, BOX_SIZE[size], "gap-2 px-3", boxStateClasses(state), className)}
      >
        <ButtonIcon icon={icon ?? Search} px={18} className="pointer-events-none text-text-subtle" />
        {inlineLabelNode}
        <input
          ref={setControlRef}
          type="text"
          {...comboboxAria}
          aria-autocomplete="list"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          value={isOpen ? query : (selectedLabel ?? "")}
          placeholder={isOpen ? (selectedLabel ?? placeholderText) : placeholderText}
          disabled={field.disabled}
          readOnly={field.readOnly}
          onChange={handleInputChange}
          onClick={handleControlClick}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className={cx(
            CONTROL_BASE,
            "p-0",
            // Ochiqda tanlangan nom namunada — oddiy rangda (yozish uni almashtiradi); ichki yorliqli yopiq
            // filtrda «Barchasi» — holat, oddiy rangda.
            (isOpen && selectedLabel && !query) || (inlineLabel && !isOpen)
              ? "placeholder:text-text"
              : "placeholder:text-text-subtle",
          )}
        />
        {clearButton ?? (
          <span aria-hidden="true" className="pointer-events-none flex shrink-0 items-center">
            {trailingIcon}
          </span>
        )}
        {hiddenInputs}
      </div>
    );
  } else {
    trigger = (
      <div
        ref={anchorRef}
        data-select="single"
        data-open={isOpen || undefined}
        data-invalid={field.invalid || undefined}
        onMouseDown={handleBoxMouseDown}
        className={cx(BOX_BASE, BOX_SIZE[size], "gap-2 pr-3", boxStateClasses(state), className)}
      >
        <button
          ref={setControlRef}
          type="button"
          {...comboboxAria}
          disabled={field.disabled}
          onClick={handleControlClick}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onBlur={handleBlur}
          className={cx(CONTROL_BASE, "flex cursor-[inherit] items-center gap-2 pl-3 text-left")}
        >
          {icon ? <ButtonIcon icon={icon} px={18} className="text-text-subtle" /> : null}
          {inlineLabelNode}
          {valueAddon != null && valueAddon !== false ? (
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className={cx("min-w-0 truncate", !selectedLabel && !inlineLabel && "text-text-subtle")}>
                {selectedLabel ?? placeholderText}
              </span>
              <span aria-hidden="true" data-select-addon="" className="flex shrink-0 items-center">
                {valueAddon}
              </span>
            </span>
          ) : (
            <span className={cx("min-w-0 flex-1 truncate", !selectedLabel && !inlineLabel && "text-text-subtle")}>
              {selectedLabel ?? placeholderText}
            </span>
          )}
        </button>
        {clearButton ?? (
          <span aria-hidden="true" className="pointer-events-none flex shrink-0 items-center">
            {trailingIcon}
          </span>
        )}
        {hiddenInputs}
      </div>
    );
  }

  // ── Ro'yxat paneli ────────────────────────────────────────────────────────
  const trimmedQuery = query.trim();
  const showLoading = loading;
  const isEmpty = !showLoading && flat.length === 0;
  const loadingLabel = loadingText ?? t("select.loading");
  // Ko'p tanlovda belgilash/olib tashlash — «N ta tanlangan» (faol variantning `aria-selected` o'zgarishini
  // ekran o'quvchilar har doim ham aytmaydi). Panel ochilgandagi matn aytilmaydi — faqat o'zgarishi.
  const liveMessage = showLoading
    ? loadingLabel
    : isEmpty
      ? searchable && trimmedQuery
        ? t("select.empty")
        : (typeof noOptionsText === "string" ? noOptionsText : t("select.noOptions"))
      : searchable && trimmedQuery
        ? t("select.results", { count: flat.length })
        : multiple
          ? t("select.selectedCount", { count: selectedValues.length })
          : "";

  const emptyContent = searchable && trimmedQuery ? (
    <div className={cx(OPTION_EMPTY, "flex flex-col gap-0.5")}>
      <span className="font-semibold text-text">{emptyText ?? t("select.empty")}</span>
      <span>
        {typeof emptyHint === "function"
          ? emptyHint(trimmedQuery)
          : (emptyHint ?? t("select.emptyHint", { query: trimmedQuery }))}
      </span>
    </div>
  ) : (
    <div className={OPTION_EMPTY}>{noOptionsText ?? t("select.noOptions")}</div>
  );

  const renderOptionRow = (option: SelectOption<V>, index: number) => {
    const selected = selectedSet.has(option.value);
    const active = index === activeIndex;
    const optionDisabled = Boolean(option.disabled);
    return (
      <div
        key={option.value}
        id={optionId(option.value)}
        role="option"
        aria-selected={selected}
        aria-disabled={optionDisabled || undefined}
        data-active={active || undefined}
        onMouseMove={() => {
          if (!active && !optionDisabled) setActiveValue(option.value);
        }}
        onClick={() => choose(option)}
        className={cx(
          OPTION_BASE,
          optionDisabled ? OPTION_DISABLED : selected ? OPTION_SELECTED : active ? OPTION_ACTIVE : OPTION_IDLE,
        )}
      >
        {option.icon ? (
          <ButtonIcon icon={option.icon} px={16} className={selected ? undefined : "text-text-muted"} />
        ) : null}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 break-words">
          {renderOption ? (
            renderOption(option, { selected, active, query: trimmedQuery })
          ) : (
            <>
              <span>{searchable && trimmedQuery ? <Highlight text={option.label} query={trimmedQuery} /> : option.label}</span>
              {option.description ? (
                <span className="text-xs font-medium text-text-muted">{option.description}</span>
              ) : null}
            </>
          )}
        </span>
        {selected ? <Check aria-hidden="true" size={16} strokeWidth={2} className="shrink-0" /> : null}
      </div>
    );
  };

  const listbox = (
    <div
      ref={listRef}
      id={listboxId}
      role="listbox"
      // `listLabel` aniq berilsa — u (maket: «Marketlar»), aks holda maydon yorlig'i.
      aria-labelledby={listLabel ? undefined : labelledBy}
      aria-label={listLabel ?? (labelledBy ? undefined : (ariaLabel ?? placeholder))}
      aria-multiselectable={multiple || undefined}
      aria-busy={showLoading || undefined}
      className={cx("relative flex min-h-0 flex-col gap-0.5 overflow-y-auto overscroll-contain", (showLoading || isEmpty) && "hidden")}
    >
      {showLoading
        ? null
        : sections.map((section) =>
            section.label ? (
              <div key={section.key} role="group" aria-labelledby={`${controlId}-group-${section.key}`} className="flex flex-col gap-0.5">
                <div id={`${controlId}-group-${section.key}`} role="presentation" className={GROUP_LABEL}>
                  {section.label}
                </div>
                {section.items.map(({ option, index }) => renderOptionRow(option, index))}
              </div>
            ) : (
              <Fragment key={section.key}>{section.items.map(({ option, index }) => renderOptionRow(option, index))}</Fragment>
            ),
          )}
    </div>
  );

  const footer =
    multiple && selectedValues.length > 0 && !showLoading ? (
      <div className="flex shrink-0 flex-col">
        <div aria-hidden="true" className="mx-1.5 my-1 h-px bg-border" />
        <div className="flex items-center justify-between gap-2 py-0.5 pl-2.5 pr-1">
          {/* Ekran o'quvchiga son live region'da (`role="status"`) — bu yerda takrorlanmaydi. */}
          <span aria-hidden="true" className="text-xs text-text-muted">
            {t("select.selectedCount", { count: selectedValues.length })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onMouseDown={(event) => event.preventDefault()}
            onClick={clearAll}
          >
            {t("select.clearShort")}
          </Button>
        </div>
      </div>
    ) : null;

  const panel = isOpen ? (
    <div
      ref={floatingRef}
      data-select-panel=""
      data-side={portal ? side : "bottom"}
      style={portal ? floatingStyles : undefined}
      // Panel bosilganda fokus maydonda qoladi (`aria-activedescendant` naqshi). `stopPropagation` — ro'yxat
      // portalda (o'z konteyneridan tashqarida): eski (v1) «tashqariga bosish» `document` `mousedown` tinglovchilari
      // (buyurtmalar/foydalanuvchilar filtri telefon paneli) variant bosilishini «tashqari» deb panelni yopmasin
      // (ro'yxat egasiz osilib qolardi). O'zimizning `useDismiss` — `pointerdown` capture, unga ta'sir qilmaydi.
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      className={cx(
        PANEL,
        side === "top" && portal ? "starting:translate-y-1" : "starting:-translate-y-1",
        !portal && "absolute inset-x-0 top-full z-10 mt-2 max-h-[280px]",
      )}
    >
      {listbox}
      {showLoading ? (
        <div className={cx(OPTION_EMPTY, "flex items-center justify-center gap-2")}>
          <Spinner className="text-action" />
          {loadingLabel}
        </div>
      ) : isEmpty ? (
        emptyContent
      ) : null}
      {footer}
      <span role="status" className="sr-only">
        {liveMessage}
      </span>
    </div>
  ) : null;

  return (
    <div data-select-root="" className={cx("relative min-w-0", !portal && isOpen && "z-10")}>
      {trigger}
      {panel ? portal ? <Portal layer="dropdown" anchor={anchorRef}>{panel}</Portal> : panel : null}
    </div>
  );
};
