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

/**
 * YAGONA QORONG'I YUZA — hisoblab tanlangan.
 *
 * ⚠️ NIMA BUZILGAN EDI. Bitta ekranda UCH XIL qorong'i yuza bor edi:
 *
 *   sahifa foni   `#2a2540`  (`index.css` — `--color-dark-bg-py`)
 *   Tailwind karta `#2A263D` ← fondan kontrast **1.00**, ya'ni MUTLAQO
 *                              ajralmaydi
 *   antd karta     `#141414` ← neytral qora, binafsha sahifada butunlay
 *                              boshqa oiladan
 *
 * Foydalanuvchi shikoyati: "bg qora rangga o'tmayapti" — u aynan shuni
 * ko'rgan: kartalar fonga singib ketgan, antd kartalari esa begona qora
 * to'rtburchak bo'lib turgan.
 *
 * `#3A3358` HISOBLAB tanlandi:
 *   fondan kontrast 1.25 — antd sukutidagi ajralish darajasi bilan bir xil,
 *   lekin ilovaning O'Z rang oilasida;
 *   oq matn 11.70:1, `gray-200` 9.45:1, `gray-400` 4.61:1 — uchalasi ham AA.
 *
 * ⚠️ AYNI QIYMAT `AntdThemeProvider` da `colorBgContainer` ga ham beriladi.
 * Ikki joyda yozilgani ataylab: Tailwind sinf satri va antd tokeni bitta
 * manbadan kelmaydi. Biri o'zgarsa ikkinchisi ham o'zgarishi SHART —
 * `palette.test.ts` shuni tekshiradi.
 */
/**
 * ⚠️ SINF SATRLARIDA BU KONSTANTA ISHLATILMAYDI — faqat antd tomoni va
 * testlar uchun.
 *
 * NEGA. Tailwind sinflarni manba faylidan STATIK matn sifatida topadi.
 * `` `dark:bg-[${DARK_SURFACE_HEX}]` `` yozsak, skaner
 * `dark:bg-[${DARK_SURFACE_HEX}]` degan yaroqsiz nomni ko'radi va
 * `dark:bg-[#3A3358]` qoidasini UMUMAN yaratmaydi — natijada karta
 * qorong'ida SHAFFOF bo'lib qoladi va sahifa foni ko'rinib turadi.
 * (Bu tuzoqqa aynan shu faylda tushilgan va build CSS'ini tekshirib
 * aniqlangan.)
 *
 * Shu bois sinflarda hex LITERAL yoziladi, bu konstanta esa ikkinchi
 * nusxani bir joyda ushlab turadi. Ikkisi bir xil qolishini
 * `palette.test.ts` tekshiradi.
 */
export const DARK_SURFACE_HEX = "#3A3358";

/** Sahifa/bo'lim sarlavhasi — eng baland kontrast. */
export const TITLE = "text-gray-800 dark:text-white";

/** Asosiy matn (jadval qatori, yorliq). */
export const BODY = "text-gray-700 dark:text-gray-200";

/** Ikkilamchi matn — izoh, tavsif. PCS'dagi `gray-500`. */
export const MUTED = "text-gray-500 dark:text-gray-400";

/**
 * Eng och matn — FAQAT chip ostidagi 11px tavsif va bezak ikonkalari uchun.
 *
 * ⚠️ QORONG'I VARIANTI TUZATILDI. Ilgari `dark:text-gray-500` edi va yangi
 * yuzada (`#3A3358`) u **2.42:1** beradi — AA katta matn chegarasidan (3.0)
 * ham past, ya'ni o'qilmaydi. Endi `gray-400`: **4.61:1**, AA normal matn
 * uchun ham o'tadi.
 *
 * ⚠️ YORUG' REJIMDA `gray-400` oq fonda ~2.9:1 — normal matn uchun AA dan
 * past. Shu bois u FAQAT 11px chip tavsifida ishlatiladi (dekorativ,
 * yonida aniq yorliq bor). Katta harfli 10px yorliqlar uchun `MUTED`.
 */
export const FAINT = "text-gray-400 dark:text-gray-400";

/** Karta/panel yuzasi. */
export const SURFACE = "bg-white dark:bg-[#3A3358] border border-gray-200 dark:border-gray-700";

/** Faqat chegara (yuza alohida berilganda). */
export const BORDER = "border-gray-200 dark:border-gray-700";

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
      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/25 shadow-sm"
      : `${BORDER} bg-white dark:bg-[#3A3358] hover:border-indigo-300 dark:hover:border-indigo-700`
  }`;

export const chipIcon = (on: boolean) =>
  `flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
    on
      ? "bg-indigo-600 text-white"
      : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300"
  }`;

export const chipLabel = (on: boolean) =>
  `block text-sm font-bold leading-tight ${on ? "text-indigo-700 dark:text-indigo-300" : BODY}`;

/** Birlamchi tugma — PCS'dagi ko'k gradient. */
export const PRIMARY_BTN =
  "flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl disabled:opacity-50 disabled:shadow-none";

/** Ikkilamchi tugma. */
export const GHOST_BTN = `flex items-center gap-2 rounded-xl border ${BORDER} px-4 py-2.5 text-sm font-medium ${BODY} transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50`;

/**
 * Holat ohanglari — semantik rang urg'u rangidan ALOHIDA.
 * Indigo/violet = "qaysi narsa tanlangan", yashil/qizil = "qanday ketmoqda".
 */
export const TONE = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-300",
  warn: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300",
  bad: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300",
  info: "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
} as const;

/** Holat nuqtasi — `connectionHealth` natijasiga mos. */
export const HEALTH_DOT = {
  ok: "bg-emerald-500",
  attention: "bg-amber-500",
  off: "bg-gray-400 dark:bg-gray-600",
} as const;

/* ═══════════════════════════════════════════════════════════════════════
   PCS (BeePost) SAHIFASINING QURILISH BLOKLARI
   
   Quyidagilar PCS `pages/integrations/index.tsx` dan AYNAN olindi — ranglar
   ham, o'lchamlar ham. Sabab: foydalanuvchi ikki variantni ko'rib PCS
   shaklini tanladi ("UI tomonlama Beepostniki yaxshiroq").
   
   ⚠️ `dark:bg-[#3A3358]` — PCS'ning aniq qorong'i yuzasi. Uni `gray-800` ga
   almashtirmang: PCS'da butun ilova shu tusda va karta fondan ajralib
   turishi shunga tayanadi.
   ═══════════════════════════════════════════════════════════════════════ */

/** PCS karta yuzasi. */
export const PCS_SURFACE = "bg-white dark:bg-[#3A3358]";

/** Sahifa sarlavhasidagi gradient ikonka qutisi. */
export const HEADER_ICON =
  "w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg";

export const PAGE_TITLE = "text-xl sm:text-2xl font-bold text-gray-800 dark:text-white";

export const PAGE_SUBTITLE = "text-sm text-gray-500 dark:text-gray-400";

/** Qidiruv maydoni — PCS'dagi fokus halqasi bilan. */
export const SEARCH_INPUT =
  "w-48 sm:w-64 pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#3A3358] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all";

/** Birlamchi amal — ko'k gradient. */
export const CTA_BTN =
  "flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium shadow-lg shadow-blue-500/25 hover:shadow-xl transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:shadow-none";

/**
 * Yumshoq rangli tugma — PCS karta amallari va "Sync Monitor" naqshi.
 * Fon och tus, matn to'yingan tus: rang ma'no tashiydi, lekin matnni
 * bosib ketmaydi.
 */
export const softBtn = (tone: "blue" | "amber" | "red" | "green" | "gray") =>
  ({
    blue: "bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50",
    amber:
      "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50",
    red: "bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50",
    green:
      "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50",
    gray: "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600",
  })[tone] +
  " flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * Karta chegarasi — nofaol ulanish DARHOL ko'rinadi (qizil + xiralashgan).
 * PCS shu naqshni ishlatadi va u yaxshi ishlaydi: ro'yxatga qarash bilan
 * o'chirilgani ajralib turadi.
 */
export const cardShell = (dim: boolean) =>
  `${PCS_SURFACE} rounded-2xl shadow-sm border overflow-hidden transition-all hover:shadow-md ${
    dim
      ? "border-red-200 dark:border-red-900/30 opacity-75"
      : "border-gray-100 dark:border-gray-800"
  }`;

/**
 * Karta sarlavhasining gradienti — HOLATGA qarab.
 *
 * PCS'da ikki holat bor (faol/nofaol). Bizda uchta, chunki `connectionHealth`
 * "sozlama to'g'ri, lekin hodisalar yetmayapti" holatini ham ajratadi — va
 * aynan shu holat uchun metrika qo'shilgan edi. Uni yashil ko'rsatish
 * muammoni yashirardi.
 */
/**
 * ⚠️ GRADIENT TUSLARI TO'QLASHTIRILDI — ustida OQ matn turadi.
 *
 * Ilgari `-500`/`gray-400` ishlatilardi va oq matn kontrasti:
 *   green-500 2.28 · emerald-500 2.54 · amber-500 2.15 · orange-500 2.80
 *   gray-400 2.54
 * — OLTITASI HAM AA katta matn chegarasidan (3.0) past, ya'ni karta
 * sarlavhasidagi ulanish NOMI va holati o'qilmasdi. Bu sahifadagi eng
 * ko'zga tashlanadigan element.
 *
 * Yangi tuslar: green-600 3.30 · emerald-700 5.48 · amber-600 3.19 ·
 * orange-700 5.18 · gray-500 4.83 · gray-600 7.56 — hammasi o'tadi.
 *
 * ⚠️ Rang HOLATNI bildiradi, shu bois ikkala mavzuda AYNI qoladi
 * (`dark:` varianti yo'q): yashil "ishlayapti" degani qorong'ida ham
 * yashil bo'lishi kerak.
 */
export const cardHeader = (health: "ok" | "attention" | "off") =>
  `px-4 py-3 border-b ${
    {
      ok: "bg-gradient-to-r from-green-600 to-emerald-700",
      attention: "bg-gradient-to-r from-amber-600 to-orange-700",
      off: "bg-gradient-to-r from-gray-500 to-gray-600",
    }[health]
  }`;

/** Karta amallari poyi. */
export const CARD_FOOTER =
  "px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2";

/* ═══════════════════════════════════════════════════════════════════════
   ROL BELGISI — GURUH SARLAVHASI EMAS
   
   ⚠️ Ro'yxat ilgami rol bo'yicha GURUHLANGAN edi: "Buyurtma manbalari",
   "Yetkazuvchilar" degan alohida sarlavhalar ostida. Foydalanuvchi buni
   olib tashlashni so'radi: "alohida bo'lib turishi kerak emas, faqat icon
   yoki rang bilan ajralib tursa yetarli".
   
   Sabab tushunarli: Elchi'da ulanish soni kichik va sarlavhalar ro'yxatni
   uzaytirib, bir qarashda hammasini ko'rishga to'sqinlik qilardi. Rol esa
   yo'qolmasligi kerak — u ranga va ikonkaga ko'chdi.
   ═══════════════════════════════════════════════════════════════════════ */

/** Har rol uchun antd `Tag` rangi — bir qarashda ajralib turadi. */
export const ROLE_TAG_COLOR: Record<string, string> = {
  carrier: "geekblue",
  source: "green",
  payment: "gold",
  mirror: "purple",
};

/** Karta sarlavhasidagi ikonka foni — rol bo'yicha. */
export const ROLE_ICON_BG: Record<string, string> = {
  carrier: "bg-blue-500/25",
  source: "bg-emerald-500/25",
  payment: "bg-amber-500/25",
  mirror: "bg-purple-500/25",
};
