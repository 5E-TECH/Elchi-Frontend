/**
 * INTEGRATSIYALAR SAHIFASINING PALITRASI — PCS (BeePost) sahifasidan olindi.
 *
 * NEGA O'ZGARDI. Bu sahifa ilgari Elchi'ning CSS o'zgaruvchilarini
 * ishlatardi: `text-maindark`, `var(--color-text-muted)`,
 * `var(--color-border-soft)`. Natijada ikkilamchi yozuvlar juda och chiqib,
 * o'qish qiyin bo'lardi — foydalanuvchi aynan shuni aytdi: "Beepostdagi
 * ranglari yaxshiroq, chunki unda yozuvlar aniq ko'ringan".
 *
 * PCS aniq Tailwind shkalasini ishlatadi (`gray-800`, `gray-500`) va
 * ikkalasi uchun ham qorong'i variantni ALOHIDA yozadi. Shuning uchun
 * kontrast har ikki mavzuda ham bashoratli bo'ladi.
 *
 * ⚠️ Bu fayl — YAGONA manba. Sinf satrlarini panellar ichida qo'lda
 * yozmaslik kerak: ilgari shunday qilingan va sahifa bo'ylab beshta xil
 * kulrang paydo bo'lgan edi.
 */

/** Sahifa/bo'lim sarlavhasi — eng baland kontrast. */
export const TITLE = 'text-gray-800 dark:text-white';

/** Asosiy matn (jadval qatori, yorliq). */
export const BODY = 'text-gray-700 dark:text-gray-200';

/** Ikkilamchi matn — izoh, tavsif. PCS'dagi `gray-500`. */
export const MUTED = 'text-gray-500 dark:text-gray-400';

/**
 * Eng och matn — FAQAT chip ostidagi 11px tavsif va bezak ikonkalari uchun.
 *
 * ⚠️ MATN UCHUN BUNDAN OCHROG'I YO'Q. Yorug' rejimda `gray-400` oq fonda
 * ~2.9:1 kontrast beradi — bu normal matn uchun AA dan past. PCS ham uni
 * faqat chip tavsifida ishlatadi, shuning uchun biz ham shu chegarada
 * qolamiz. Katta harfli 10px yorliqlar uchun `MUTED` ishlatiladi: ular
 * kichik va siyrak, `gray-400` da o'qilmay qolardi.
 */
export const FAINT = 'text-gray-400 dark:text-gray-500';

/** Karta/panel yuzasi. */
export const SURFACE =
  'bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700';

/** Faqat chegara (yuza alohida berilganda). */
export const BORDER = 'border-gray-200 dark:border-gray-700';

/** Karta — yuza + burchak + ichki bo'shliq. */
export const CARD = `rounded-xl ${SURFACE}`;

/**
 * Provayder/ulanish chipi — PCS `ProvidersTab` dagi INDIGO urg'u.
 * Sub-nav VIOLET ishlatadi, ya'ni ikki daraja rang bilan ajraladi va
 * operator qaysi darajada turganini ko'radi.
 */
export const chip = (on: boolean) =>
  `flex shrink-0 items-center gap-2.5 rounded-xl border-2 px-4 py-2.5 text-left transition-all cursor-pointer ${
    on
      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/25 shadow-sm'
      : `${BORDER} bg-white dark:bg-gray-800/50 hover:border-indigo-300 dark:hover:border-indigo-700`
  }`;

export const chipIcon = (on: boolean) =>
  `flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
    on
      ? 'bg-indigo-600 text-white'
      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300'
  }`;

export const chipLabel = (on: boolean) =>
  `block text-sm font-bold leading-tight ${
    on ? 'text-indigo-700 dark:text-indigo-300' : BODY
  }`;

/** Birlamchi tugma — PCS'dagi ko'k gradient. */
export const PRIMARY_BTN =
  'flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl disabled:opacity-50 disabled:shadow-none';

/** Ikkilamchi tugma. */
export const GHOST_BTN = `flex items-center gap-2 rounded-xl border ${BORDER} px-4 py-2.5 text-sm font-medium ${BODY} transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50`;

/**
 * Holat ohanglari — semantik rang urg'u rangidan ALOHIDA.
 * Indigo/violet = "qaysi narsa tanlangan", yashil/qizil = "qanday ketmoqda".
 */
export const TONE = {
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-300',
  warn: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300',
  bad: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300',
  info: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
} as const;

/** Holat nuqtasi — `connectionHealth` natijasiga mos. */
export const HEALTH_DOT = {
  ok: 'bg-emerald-500',
  attention: 'bg-amber-500',
  off: 'bg-gray-400 dark:bg-gray-600',
} as const;
