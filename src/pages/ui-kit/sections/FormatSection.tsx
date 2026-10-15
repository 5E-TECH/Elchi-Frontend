import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import {
  formatDateLocalized,
  formatDateTimeLocalized,
  type DateLanguage,
} from "../../../shared/lib/formatDateTime";
import {
  CURRENCY_LABEL,
  formatCompactMoneyLocalized,
  formatMoneyLocalized,
  formatPercentLocalized,
  formatSignedMoneyLocalized,
} from "../../../shared/lib/formatMoney";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { KitSection } from "../KitSection";
import { ThemePair } from "../ThemePair";

/**
 * «Formatlash» bo'limi — maket `Main` → «Format standarti» jadvali (Tur · Qoida · O'zbekcha · Ruscha ·
 * Inglizcha). Har qiymat formatlovchini ANIQ til bilan chaqiradi, shuning uchun ustunlar interfeys
 * tilidan qat'i nazar uz | ru | en ni ko'rsatadi.
 *
 * «Kirim» (+, `success-fg`) va «Qarz, chiqim» (haqiqiy minus `−`, `danger-fg`) — `formatSignedMoneyLocalized`;
 * rangni formatlovchi emas, chaqiruvchi beradi (shu yerda `tone`). «Buyurtma raqami», «Soni»,
 * «Tanlov yorlig'i», «Filtr tugmasi» — formatlovchi emas, bu bo'limda ko'rsatilmaydi.
 *
 * Joylashuv KONTEYNER kengligiga qarab (`@container`, ekranga emas — panel ekranning bir qismi):
 *   ≥ 56rem — to'liq jadval (Qoida alohida ustunda, maketdagidek);
 *   42–56rem — Qoida sarlavha ostida;
 *   < 42rem — jadval o'rniga ro'yxat (telefon qoidasi: jadval → kartalar, gorizontal skroll yo'q).
 */

/** Uch til — ustunlar tartibi (maketdagidek). */
const LANGUAGES = ["uz", "ru", "en"] as const satisfies readonly DateLanguage[];

/**
 * Qotirilgan «hozir» — maketdagi kun (08.10.2026). Nisbiy sana skrinshotda har kuni bir xil
 * chiqsin («Bugun, 14:15 · Kecha, 18:04»).
 */
const KIT_NOW = new Date(2026, 9, 8, 15, 0);
const TODAY_SAMPLE = new Date(2026, 9, 8, 14, 15);
const YESTERDAY_SAMPLE = new Date(2026, 9, 7, 18, 4);
const OLDER_SAMPLE = new Date(2026, 9, 6, 19, 5);

type ExampleId =
  | "money"
  | "income"
  | "debt"
  | "compactThousand"
  | "compactMillion"
  | "compactBillion"
  | "percent"
  | "phone"
  | "date"
  | "dateTime"
  | "relative";

/** Qiymat rangi: kirim — `success-fg`, qarz/chiqim — `danger-fg` (maketdagidek); sukut — oddiy matn. */
type ValueTone = "success" | "danger";

/**
 * Bitta qator: til → qiymat. Massiv — bir katakdagi bir nechta namuna (« · » bilan).
 * `tone` — qiymat rangi (ishora matnda turadi, rang yolg'iz ma'no bermaydi).
 */
type Example = {
  id: ExampleId;
  format: (language: DateLanguage) => string | readonly string[];
  tone?: ValueTone;
};

const EXAMPLES: readonly Example[] = [
  { id: "money", format: (language) => formatMoneyLocalized(185_000, { language }) },
  { id: "income", tone: "success", format: (language) => formatSignedMoneyLocalized(120_000, { language }) },
  { id: "debt", tone: "danger", format: (language) => formatSignedMoneyLocalized(-240_000, { language }) },
  { id: "compactThousand", format: (language) => formatCompactMoneyLocalized(185_000, { language }) },
  { id: "compactMillion", format: (language) => formatCompactMoneyLocalized(12_400_000, { language }) },
  { id: "compactBillion", format: (language) => formatCompactMoneyLocalized(1_200_000_000, { language }) },
  { id: "percent", format: (language) => formatPercentLocalized(8.2, { language }) },
  // Telefon hamma tilda bir xil.
  { id: "phone", format: () => formatPhone("998901234567") },
  { id: "date", format: (language) => formatDateLocalized(KIT_NOW, { language }) },
  { id: "dateTime", format: (language) => formatDateTimeLocalized(OLDER_SAMPLE, { language, now: KIT_NOW }) },
  {
    id: "relative",
    format: (language) => [
      formatDateTimeLocalized(TODAY_SAMPLE, { language, now: KIT_NOW }),
      formatDateTimeLocalized(YESTERDAY_SAMPLE, { language, now: KIT_NOW }),
    ],
  },
];

/** `.el-card` (CODE-MAP §1 CARD); `overflow-hidden` — sarlavha foni yumaloq burchakdan chiqmasin. */
const CARD = "min-w-0 overflow-hidden rounded-[14px] border border-border bg-surface";
/** `.el-table th` (CODE-MAP §2.6). */
const TH =
  "h-10 whitespace-nowrap border-b border-border bg-sunken px-4 text-left text-xs font-semibold uppercase tracking-[.04em] text-text-muted";
/**
 * `.el-table td` (CODE-MAP §2.6). Matn rangi bu yerda EMAS — har katak o'zinikini beradi
 * (`cx` klasslarni birlashtirmaydi: `text-text` + `text-text-muted` qaysi biri yutishi CSS tartibiga bog'liq).
 */
const TD = "h-14 border-b border-border px-4 py-2 align-middle";
/** `.el-small .el-muted` — qoida matni. */
const RULE = "text-[13px] font-normal text-text-muted";
/** Qiymat matni (`.el-strong`), rangi `tone` bo'yicha. */
const VALUE_TONE: Record<ValueTone | "default", string> = {
  default: "text-text",
  success: "text-success-fg",
  danger: "text-danger-fg",
};

/** Qiymat: har namuna bo'linmaydi, katak esa « · » dan keyin ikkinchi qatorga o'ta oladi. */
const Value = ({ value }: { value: string | readonly string[] }) => {
  const parts = typeof value === "string" ? [value] : value;
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={part}>
          {index > 0 ? " · " : null}
          <span className="whitespace-nowrap">{part}</span>
        </Fragment>
      ))}
    </>
  );
};

type Row = {
  id: ExampleId;
  title: string;
  rule: string;
  values: Record<DateLanguage, string | readonly string[]>;
  tone?: ValueTone;
};

const FormatSamples = ({ rows }: { rows: readonly Row[] }) => {
  const { t } = useTranslation("ui");

  return (
    <div className="@container min-w-0">
      <div className={CARD}>
        {/* Jadval: konteyner ≥ 42rem. `.el-table-wrap` — skroll faqat jadval ichida. */}
        <div className="relative overflow-x-auto @max-2xl:hidden">
          <table
            aria-label={t("format.tableLabel")}
            className="w-full border-collapse text-sm [&_tbody_tr:last-child>*]:border-b-0"
          >
            <thead>
              <tr>
                <th scope="col" className={TH}>
                  {t("format.columns.type")}
                </th>
                <th scope="col" className={cx(TH, "min-w-[200px] @max-4xl:hidden")}>
                  {t("format.columns.rule")}
                </th>
                {LANGUAGES.map((language) => (
                  <th key={language} scope="col" className={TH}>
                    {t(`format.columns.${language}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-row-hover">
                  <th scope="row" className={cx(TD, "text-left font-semibold text-text")}>
                    {/* Sarlavha bo'linmaydi (maketda «Ixcham · milliard» bir qatorda). */}
                    <span className="whitespace-nowrap">{row.title}</span>
                    {/* Qoida ustuni yashiringanda (konteyner < 56rem) — sarlavha ostida. */}
                    <span className={cx(RULE, "mt-0.5 block @4xl:hidden")}>{row.rule}</span>
                  </th>
                  <td className={cx(TD, RULE, "@max-4xl:hidden")}>{row.rule}</td>
                  {LANGUAGES.map((language) => (
                    <td
                      key={language}
                      lang={language}
                      className={cx(TD, "font-semibold", VALUE_TONE[row.tone ?? "default"])}
                    >
                      <Value value={row.values[language]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Ro'yxat: konteyner < 42rem (telefon, tor panel). `.el-list-item` + `.el-kv`. */}
        <ul aria-label={t("format.tableLabel")} className="hidden flex-col @max-2xl:flex">
          {rows.map((row) => (
            <li key={row.id} className="flex min-w-0 flex-col gap-2 border-b border-border px-4 py-3 last:border-b-0">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-semibold text-text">{row.title}</span>
                <span className={RULE}>{row.rule}</span>
              </div>
              <dl className="m-0 grid grid-cols-[minmax(88px,auto)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
                {LANGUAGES.map((language) => (
                  <Fragment key={language}>
                    <dt className="text-text-muted">{t(`format.columns.${language}`)}</dt>
                    <dd
                      lang={language}
                      className={cx("m-0 min-w-0 font-semibold", VALUE_TONE[row.tone ?? "default"])}
                    >
                      <Value value={row.values[language]} />
                    </dd>
                  </Fragment>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export const FormatSection = () => {
  const { t } = useTranslation("ui");

  const rows: Row[] = EXAMPLES.map(({ id, format, tone }) => ({
    id,
    tone,
    title: t(`format.rows.${id}.title`),
    rule: t(`format.rows.${id}.rule`, {
      units: LANGUAGES.map((language) => CURRENCY_LABEL[language]).join(", "),
      example: formatDateTimeLocalized(OLDER_SAMPLE, { now: KIT_NOW }),
    }),
    values: { uz: format("uz"), ru: format("ru"), en: format("en") },
  }));

  return (
    <KitSection
      id="format"
      title={t("kit.sections.format.title")}
      description={t("kit.sections.format.description")}
    >
      {/* Jadval keng (5 ustun) — panellar yonma-yon emas, ustma-ust. */}
      <ThemePair layout="stack">
        <FormatSamples rows={rows} />
      </ThemePair>
    </KitSection>
  );
};
