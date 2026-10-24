#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  DIZAYN v2 QO'RIQCHISI (ratchet) — qoidalar dvigateli + CLI
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Maqsad: Dizayn v2 (docs/DESIGN_SYSTEM.md) har PR uchun MAJBURIY bo'lsin,
 *  lekin eski kodni bir zumda qayta yozishga majburlamasin. Har fayl × qoida
 *  bo'yicha hozirgi buzilishlar soni `design/guard-baseline.json` da turadi;
 *  son faqat KAMAYISHI mumkin. Yangi fayl uchun baseline = 0.
 *
 *  Kim ishlatadi:
 *    - `src/test/designGuard.test.ts` (vitest → CI'da har PR'da `npm test`);
 *    - CLI:  npm run design:guard                      — fayllar bo'yicha hisobot
 *            npm run design:guard -- --changed         — faqat baseline'dan farq qilganlar
 *            npm run design:guard -- src/pages/x.tsx   — fayldagi har buzilish + v2 o'rnini bosuvchisi
 *            npm run design:guard -- --update          — baseline'ni qotirish (faqat kamaytiradi)
 *            npm run design:guard -- --diff [origin/dev]
 *                                                      — faqat shu branchda QO'SHILGAN qatorlar: yangi buzilish = 0
 *                                                        (ratchet "almashtirish" teshigini yopadi; CI PR'da yuradi)
 *            npm run design:guard -- --update --allow-increase "<sabab>"
 *                                                      — oshirishga ruxsat (sabab baseline'ga yoziladi)
 *
 *  Istisno (bitta qator): o'sha yoki oldingi qatorda
 *      // design-guard-ignore: <sabab>          (JSX ichida: {/* design-guard-ignore: <sabab> *\/})
 *  Sabab majburiy — sababsiz marker hech narsani o'tkazib yubormaydi va test yiqiladi.
 *
 *  Qoidalar (har biri qatordagi uchrashuvlar sonini sanaydi; izohlar hisobga kirmaydi):
 *    colour    — hex `#fff` / `rgb()` / `rgba()` / `hsl()` rang literallari (className, `bg-[#fff]`,
 *                `shadow-[..rgba(..)]`, style obyektlari, JS konstantalari). themeTokens.ts — istisno.
 *    palette   — Tailwind standart palitrasi: `bg-blue-500`, `text-gray-400`, `border-red-200/50`, `bg-white`,
 *                `text-black/60` …
 *    dark-pair — `dark:` rang jufti: `dark:bg-slate-800`, `dark:text-white`, `dark:hover:border-…` (tokenlar
 *                mavzuga o'zi moslashadi; `dark:text-sm` kabi o'lcham sanalmaydi).
 *    legacy    — eski token nomlari: `main`, `maindark`, `primary`, `primarydark`, `purple*`,
 *                `border-soft`, `card-surface`, `page-surface`, `background(-soft/-deep)`, `dashboard-*`,
 *                `table-*`, `glass*`, `warning-start/end/…` (+ §2 dagi boshqa aliaslar) — utilita yoki `--color-*`.
 *    money     — `Intl.NumberFormat`, sonning `.toLocaleString(...)`, qo'lda yozilgan `so'm` / `сум` /
 *                `UZS`. formatMoney.ts — istisno.
 *    icons     — `@ant-design/icons` va lucide-react'dan boshqa ikonka kutubxonalari importi.
 *    tiny-text — 12px dan kichik shrift: `text-[10px]`, `text-[11px]`, `fontSize: 10`, `font-size: 11px` …
 *    v1-class  — index.css dagi eski v1 klasslari: `el-card`, `el-card-soft`, `el-glass-control`, `el-segmented*`,
 *                `el-surface-page`, `el-muted-text`, `el-soft-text` (maketdagi `el-*` bilan nomdosh, lekin v2 emas).
 *    weight    — `font-black` / `font-extrabold` / `fontWeight: 800|900` (v2 da eng qalin — `font-bold`).
 *    gradient  — `bg-linear-*`, `bg-gradient-*`, `bg-radial*`, `bg-conic*`, `linear-gradient(...)` (v2 — tekis fon).
 *    v1-helper — designSystem.ts dagi v1 yordamchilari (`TYPO.*`, `TEXT.*`, `TONE`, `toneAccent()`, `toneSoftBg()`,
 *                `formatPercent()`) va v1 komponentlari (`headerName`, `MetricCard`) importi; 1-bosqich
 *                o'rnini bosgan v1 modullari importi (`V1_MODULES`, yo'l fayl joyiga nisbatan aniq hal qilinadi):
 *                shared/components/button → Button, shared/ui/StatusBadge va pages/orders/list/OrderStatusBadge →
 *                StatusBadge / entities/order OrderStatusBadge, shared/config/statusColorMap → statusRegistry +
 *                tone.ts, shared/lib/formatDate → formatDateTimeLocalized.
 *    named-colour — nomli CSS rangi (`white`, `red`, `navy` … 148 ta; `transparent`/`currentColor`/`inherit`/`none`
 *                emas): JSX rang atributlari (`stroke="white"`, `color="red"`), style/konfig kalitlari
 *                (`color: "green"`, `"color": "red"`, `border: "1px solid black"`), ulardagi ternar / `??` tarmoqlari
 *                (`stroke={dark ? "white" : "black"}`, `color: ok ? "green" : "red"`), satr ichidagi CSS (`color: red;`), Tailwind
 *                ixtiyoriy qiymati (`bg-[white]`). themeTokens.ts va OUTPUT_FORMAT_FILES — istisno.
 *
 *  Migratsiya qilingan papkalar (5-bosqich): `V2_SCOPES` dagi papka ichidagi HAR fayl (belgisiz `.ts` yordamchi ham)
 *  rang qoidalarida (`COLOUR_RULES`) ruxsat 0 — baseline'dagi eski son hisobga olinmaydi va `--update` uni yozmaydi.
 *  Istisnolar: `V2_SCOPE_PENDING` (hali v1 qolgan fayllar, faqat qisqaradi) va `OUTPUT_FORMAT_FILES` (chop etish,
 *  termal yorliq, Excel — oq qog'oz, ilova mavzusidan tashqari; rang qoidalari qo'llanmaydi).
 *  Ro'yxatlarni `src/test/paletteGuard.test.ts` tekshiradi (eskirgan yozuv, unutilgan toza papka, o'lcham).
 *
 *  Tezlik: ~800 fayl ≈ 0.4 s (bitta o'tishli izoh-niqoblovchi + qator regexlari, AST yo'q).
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const BASELINE_FILE = "design/guard-baseline.json";
export const IGNORE_MARKER = "design-guard-ignore";

const SCAN_DIR = "src";
const EXCLUDED_DIRS = new Set(["src/locales", "src/test"]);
const EXCLUDED_DIR_NAMES = new Set(["test", "tests", "__tests__", "__mocks__", "node_modules"]);

const TOKEN_SOURCE = "src/shared/config/themeTokens.ts";
const MONEY_SOURCE = "src/shared/lib/formatMoney.ts";

/* ──────────────── Migratsiya qilingan papkalar (V2_SCOPES) va chiqish formatlari ──────────────── */

/** Rang qoidalari: V2_SCOPES (ruxsat 0) va OUTPUT_FORMAT_FILES (istisno) faqat shularga qo'llanadi.
 *  `money`, `tiny-text`, `weight`, `v1-helper` … baseline bo'yicha ishlashda davom etadi. */
export const COLOUR_RULES = Object.freeze([
  "colour",
  "palette",
  "dark-pair",
  "legacy",
  "gradient",
  "named-colour",
]);
const COLOUR_RULE_SET = new Set(COLOUR_RULES);

/**
 * 4-bosqichda to'liq ko'chirilgan slice'lar: ichidagi HAR fayl (belgisiz .ts yordamchi ham) rang qoidalarida 0.
 * Integrator guruh tugaganda qo'shadi; `src/test/paletteGuard.test.ts` unutilgan toza slice'ni o'zi topadi
 * (≥ 1 ta `// dizayn-v2:` fayl + rang buzilishi 0 → shu ro'yxatda bo'lishi shart). Bosqich B (G2 + G3 birlashtirildi):
 * G2/G3 papkalari ham shu yerda; `src/auth` (G3: sessiya, kirish — FSD qatlami emas) ham. FAQAT O'SADI.
 */
export const V2_SCOPES = Object.freeze([
  "src/auth",
  "src/entities/activity-log",
  "src/entities/delivery-pricing",
  "src/entities/integrations",
  "src/entities/market-operator",
  "src/entities/notification",
  "src/entities/notification-campaign",
  "src/entities/notification-dispatch",
  "src/entities/notification-inbox",
  "src/entities/order",
  "src/entities/orders",
  "src/entities/product",
  "src/features/auth",
  "src/features/branch",
  "src/features/branch-add-employee",
  "src/features/branch-create",
  "src/features/branch-edit",
  "src/features/branch-remove-employee",
  "src/features/courier-transfer-branch",
  "src/features/dispatch-basket",
  "src/features/notification-create",
  "src/features/notification-delete",
  "src/features/notification-dispatch",
  "src/features/notification-inbox",
  "src/features/notification-toggle",
  "src/features/order-return",
  "src/features/order-tracking",
  "src/features/push-notifications",
  "src/features/pwa-install",
  "src/features/telegram-link",
  "src/features/tg-scan",
  "src/features/user",
  "src/pages/activity-logs",
  "src/pages/batches",
  "src/pages/branch-dashboard",
  "src/pages/branch-ops",
  "src/pages/branches",
  "src/pages/courier-bulk",
  "src/pages/dashboard",
  "src/pages/dispatch",
  "src/pages/expense-categories",
  "src/pages/finance-operators",
  "src/pages/financial-balance",
  "src/pages/identity-ops",
  "src/pages/incoming-orders",
  "src/pages/integrations",
  "src/pages/integrations-ops",
  "src/pages/investor",
  "src/pages/investors-ops",
  "src/pages/logistics-ops",
  "src/pages/logs",
  "src/pages/mails",
  "src/pages/market-operators",
  "src/pages/my-earnings",
  "src/pages/new_orders",
  "src/pages/notification-send",
  "src/pages/notification-sent",
  "src/pages/notifications",
  "src/pages/ops",
  "src/pages/orders",
  "src/pages/partners",
  "src/pages/payments",
  "src/pages/products",
  "src/pages/profile",
  "src/pages/region",
  "src/pages/returns",
  "src/pages/scan",
  "src/pages/settings",
  "src/pages/system-ops",
  "src/pages/tg-scan",
  "src/pages/ui-kit",
  "src/pages/users",
  "src/widgets/Sidebar",
  "src/widgets/activity-log",
  "src/widgets/branch-detail",
  "src/widgets/branch-list",
  "src/widgets/dashboard-part-error",
  "src/widgets/dashboard-region",
  "src/widgets/dashboard-statistics",
  "src/widgets/dashboard-top-performers",
  "src/widgets/financial-analysis",
  "src/widgets/header",
  "src/widgets/layout",
  "src/widgets/notification-inbox",
  "src/widgets/order-meta",
  "src/widgets/order-tracking",
  "src/widgets/order-return-path",
  "src/widgets/region-detail",
  "src/widgets/scanner",
  "src/widgets/user-detail",
  "src/widgets/user-list",
  // TOZ-2: v1 `BackButton.tsx` v2 tokenlariga o'tdi — `src/shared/ui` butunligicha (primitives, charts, error-page, camera …).
  "src/shared/ui",
  // MO-1: v1 `headerName.tsx` o'chirildi — papka rangda toza (`PrintModeSelect` raw-control ratchetida, rangda 0).
  "src/shared/components",
]);

/** Scope ichida hali v1 qolgan fayllar — baseline'dagi rang ruxsati saqlanadi. FAQAT QISQARADI (sabab bilan;
 *  paletteGuard.test.ts: fayl bor, scope ichida, hali rang buzilishi bor, o'lcham ≤ MAX_PENDING). */
export const V2_SCOPE_PENDING = Object.freeze({
  "src/pages/payments/components/SalaryPaymentPopup.tsx":
    "yetib bo'lmaydigan v1 — «Maosh to'lash» yashirin (Moliya spec §9)",
});

/** Ilova mavzusidan tashqari chiqish formatlari (chop etish, termal yorliq, Excel): rang qoidalari qo'llanmaydi —
 *  oq qog'ozdagi qora matn / Excel ARGB to'g'ri. Faqat `/lib/` dagi print|export|pdf|label fayllari (test). */
export const OUTPUT_FORMAT_FILES = Object.freeze({
  "src/pages/new_orders/components/lib/printLabelPdf.ts":
    "termal yorliq / PDF — oq qog'oz, ilova mavzusidan tashqari",
  "src/pages/mails/detail/lib/printMode.ts": "brauzer chop etish HTML'i — oq qog'oz",
  "src/pages/mails/components/lib/exportOldMailsToExcel.ts": "Excel katak ranglari (ARGB)",
  "src/pages/payments/components/lib/exportMainCashboxReport.ts": "Excel katak ranglari (ARGB)",
});
const OUTPUT_FORMAT_PATHS = Object.keys(OUTPUT_FORMAT_FILES);

/** Fayl `V2_SCOPES` papkalaridan biri ichidami (`src/...` yo'li, posix). */
export const isInV2Scope = (file) => V2_SCOPES.some((dir) => file.startsWith(`${dir}/`));

/** Rang qoidalarida ruxsat 0 bo'lgan fayl: `// dizayn-v2:` belgili yoki scope ichida (pending emas). */
const isScoped = (file, v2) => v2 || (isInV2Scope(file) && !Object.hasOwn(V2_SCOPE_PENDING, file));

/* ─────────────────────────────── Qoidalar ─────────────────────────────── */

const UTIL_PREFIX =
  "(bg|text|border(?:-[xytrblse])?|ring(?:-offset)?|from|via|to|fill|stroke|outline|divide|shadow|decoration|accent|caret|placeholder)";
const PALETTE_FAMILY =
  "(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)";
// src/index.css «ESKI NOMLAR» bloki (alias). Komponentga xos aliaslar (flag-*, loader-*, footer-*, date-picker-*,
// error-page-*, region-map-*) bu yerda yo'q — ular o'z komponentida qoladi va o'sha bosqichda ko'chiriladi.
const LEGACY_NAME =
  "(main-soft|maindark|main|primarydark|primary|purple(?:-(?:soft|light|dark))?|border-soft|card-surface(?:-strong)?|card-shadow|page-surface|background(?:-(?:soft|deep))?|dashboard-[a-z]+(?:-[a-z]+)*|table-[a-z]+(?:-[a-z]+)*|sidebar|error|surface-elevated(?:-dark)?|surface-dark|glass(?:-border)?|warning-(?:surface|border|start|end|text)|dark-bg-py|text-muted-dark)";

// `href="#add"`, `to="#faq"` — langar, rang emas.
const RE_ANCHOR_BEFORE = /\b(?:href|to)\s*=\s*\{?\s*["'`]$/;
const RE_HEX =
  /(?<![A-Za-z0-9&.$#])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9A-Za-z-])/g;
const RE_COLOR_FN = /(?<![A-Za-z0-9-])(?:rgba?|hsla?|hwb|oklch|oklab)\(/gi;
const RE_PALETTE = new RegExp(
  `(?<![\\w-])${UTIL_PREFIX}-${PALETTE_FAMILY}-(\\d{2,3})(?![\\w-])`,
  "g",
);
const RE_PALETTE_BW = new RegExp(`(?<![\\w-])${UTIL_PREFIX}-(white|black)(?![\\w-])`, "g");
// `dark:` + rang utilitasi (`dark:bg-…`, `dark:hover:text-…`). O'lcham/joylashuv utilitalari (`dark:text-sm`,
// `dark:border-0`, `dark:shadow-none`) sanalmaydi.
const RE_DARK_PAIR = new RegExp(
  `(?<![\\w-])dark:(?:[\\w-]+:)*!?${UTIL_PREFIX}-(?!(?:xs|sm|md|base|lg|\\d?xl|x|y|t|r|b|l|s|e|none|inner|solid|dashed|dotted|double|hidden|left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip|opacity-\\d+)(?![\\w-])|\\d|\\[(?:\\d|length:))[\\w./\\[\\]#(),%-]+`,
  "g",
);
const RE_LEGACY_UTIL = new RegExp(`(?<![\\w-])${UTIL_PREFIX}-${LEGACY_NAME}(?![\\w-])`, "g");
const RE_LEGACY_VAR = new RegExp(`(?<![\\w-])--color-${LEGACY_NAME}(?![\\w-])`, "g");
const RE_INTL_NUMBER = /\bIntl\s*\.\s*NumberFormat\b/g;
const RE_TO_LOCALE = /\.toLocaleString\s*\(/g;
const RE_DATE_LINE =
  /\bnew\s+Date\b|\bDate\.|\bdayjs\b|\bmoment\(|\b(?:hour|minute|second|weekday|month|year|day|timeZone|dateStyle|timeStyle)\s*:/;
const RE_DATE_RECEIVER = /(?:[Dd]ate|[Tt]ime|[Dd]ay|At|_at)$/;
const RE_CURRENCY_SOM = /\bso(?:\\?['‘’ʻ`])m/gi;
const RE_CURRENCY_SUM = /(?<!\p{L})с[уў]м(?!\p{L})/giu;
const RE_CURRENCY_UZS = /\bUZS\b/g;
const ICON_LIBS =
  "@ant-design/icons(?:-svg)?|react-icons|@heroicons/react|@tabler/icons-react|@tabler/icons|@mui/icons-material|@fortawesome/[\\w.-]+|@phosphor-icons/react|phosphor-react|react-feather|@radix-ui/react-icons|iconsax-react|@iconify/react|@remixicon/react|react-bootstrap-icons|@carbon/icons-react|@primer/octicons-react|ionicons|boxicons";
const RE_ICON_IMPORT = new RegExp(
  `(?:\\bfrom\\s*|\\bimport\\s*\\(\\s*|\\brequire\\s*\\(\\s*|^\\s*import\\s+)["'](?:${ICON_LIBS})(?:/[^"']*)?["']`,
  "g",
);
const RE_TW_TEXT_SIZE = /(?<![\w-])text-\[(?:length:)?(\d*\.?\d+)(px|rem|em)\]/g;
const RE_FONT_SIZE_PROP = /\bfontSize\s*[:=]\s*\{?\s*["'`]?(\d*\.?\d+)(px|rem|em)?(?![\d.])/g;
const RE_FONT_SIZE_CSS = /\bfont-size\s*:\s*(\d*\.?\d+)(px|rem|em)/g;
// Palitra CSS o'zgaruvchisi (`var(--color-blue-500)`, `bg-(--color-gray-400)`) va dinamik oila (`bg-${c}-500`).
const RE_PALETTE_VAR = new RegExp(`(?<![\\w-])--color-${PALETTE_FAMILY}-(\\d{2,3})(?![\\w-])`, "g");
const RE_PALETTE_DYNAMIC = new RegExp(
  `(?<![\\w-])${UTIL_PREFIX}-\\$\\{[^}\\n]*\\}-(\\d{2,3})(?![\\w-])`,
  "g",
);

/** CSS nomli ranglari (CSS Color 4, 148 ta). `transparent`, `currentColor`, `inherit`, `none` — rang emas, yo'q. */
export const CSS_NAMED_COLOURS = Object.freeze(
  (
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown " +
    "burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan " +
    "darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred " +
    "darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink " +
    "deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold " +
    "goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush " +
    "lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey " +
    "lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime " +
    "limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen " +
    "mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin " +
    "navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise " +
    "palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue " +
    "saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow " +
    "springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen"
  ).split(" "),
);
const NAMED = `(?<c>${[...CSS_NAMED_COLOURS].sort((a, b) => b.length - a.length).join("|")})`;
// 1) JSX / HTML rang atributi: `stroke="white"`, `color={"red"}`, `stopColor='navy'`, `iconColor="red"`, satrdagi
//    `stop-color="white"`. Qo'shtirnoq ichida — katta-kichik harf farqsiz.
const RE_NAMED_ATTR = new RegExp(
  `\\b(?:fill|stroke|[a-z]*color)\\s*=\\s*\\{?\\s*(["'\`])${NAMED}\\1`,
  "dgi",
);
// 2) style / konfig obyekti kaliti: `color: "green"`, `backgroundColor: 'white'`, `border: "1px solid black"`.
const NAMED_KEY =
  "(?:fill|stroke|background|border(?:Top|Right|Bottom|Left|Block|Inline)?|outline|boxShadow|textShadow|[a-z]*color)";
const RE_NAMED_KEY = new RegExp(
  `\\b${NAMED_KEY}["']?\\s*:\\s*(["'\`])(?:[^"'\`;\\n]*?\\s)?${NAMED}(?![\\w-])`,
  "dgi",
);
// 1b/2b) ifoda ichidagi qo'shtirnoqli nom: `stroke={dark ? "white" : "black"}`, `color={c ?? "red"}`,
//    `color: ok ? "green" : "red"` — har tarmoq alohida sanaladi (ifoda: `e` guruhi, nom: `RE_NAMED_QUOTED`).
const RE_NAMED_ATTR_EXPR = new RegExp(`\\b(?:fill|stroke|[a-z]*color)\\s*=\\s*\\{(?<e>[^{}\\n]*)\\}`, "dgi");
const RE_NAMED_KEY_EXPR = new RegExp(
  `\\b${NAMED_KEY}["']?\\s*:\\s*(?<e>[^,;\\n{}"'\`]*\\?[^,;\\n{}]*)`,
  "dgi",
);
const RE_NAMED_QUOTED = new RegExp(`(["'\`])${NAMED}\\1`, "dgi");
// 3) satr / template ichidagi CSS matni: `color: red;`, `{ background: white }`, `border: 1px solid black`, Tailwind
//    ixtiyoriy xossasi `[color:red]`. Qo'shtirnoqsiz — JS identifikatoriga adashmaslik uchun faqat kichik harf.
const NAMED_CSS_PROP = [
  "(?:stop|flood|lighting|caret|outline|column-rule|text-decoration)-color",
  "color",
  "background(?:-color)?",
  "border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?(?:-color)?",
  "fill|stroke|outline|box-shadow|text-shadow",
].join("|");
const RE_NAMED_CSS = new RegExp(
  `(?:^|[;{\\[\\s"'\`])(?:${NAMED_CSS_PROP})\\s*:\\s*(?:[^;"'\`\\n]*\\s)?${NAMED}(?![\\w-])`,
  "dg",
);
// 4) Tailwind ixtiyoriy qiymati: `bg-[white]`, `text-[red]`, `fill-[navy]` (palitra qoidasi `bg-white` ni ushlaydi).
const RE_NAMED_TW = new RegExp(`(?<![\\w-])${UTIL_PREFIX}-\\[(?:color:)?${NAMED}\\]`, "dg");
const RE_NAMED_PREFILTER = /olor|fill|stroke|background|border|outline|shadow|-\[/i;

const TONE_OF_FAMILY = {
  slate: "neutral",
  gray: "neutral",
  zinc: "neutral",
  neutral: "neutral",
  stone: "neutral",
  red: "danger",
  rose: "danger",
  orange: "warning",
  amber: "warning",
  yellow: "warning",
  lime: "success",
  green: "success",
  emerald: "success",
  teal: "success",
  cyan: "info",
  sky: "info",
  blue: "action",
  indigo: "action",
  violet: "action",
  purple: "action",
  fuchsia: "action",
  pink: "category",
};

const BW_HINT = {
  white: {
    text: "text-on-solid (action/holat fonida) · text-text",
    bg: "bg-surface · bg-raised · bg-input",
    border: "border-border",
    gradient: "gradient yo'q → bg-surface",
    shadow: "shadow-sm / shadow-md (rangli soya yo'q)",
  },
  black: {
    text: "text-text",
    bg: "bg-overlay (modal orqa foni) · bg-surface",
    border: "border-border-strong",
    gradient: "gradient yo'q → bg-overlay",
    shadow: "shadow-sm / shadow-md (rangli soya yo'q)",
  },
};

const kindOfPrefix = (prefix) => {
  if (
    prefix === "text" ||
    prefix === "placeholder" ||
    prefix === "caret" ||
    prefix === "decoration"
  )
    return "text";
  if (prefix === "bg" || prefix === "fill") return "bg";
  if (prefix === "from" || prefix === "via" || prefix === "to") return "gradient";
  if (prefix === "shadow") return "shadow";
  return "border";
};

const paletteHint = (prefix, family) => {
  if (BW_HINT[family]) return BW_HINT[family][kindOfPrefix(prefix)];
  const tone = TONE_OF_FAMILY[family];
  const kind = kindOfPrefix(prefix);
  if (kind === "shadow") return "soya rangsiz: shadow-sm / shadow-md (rangli soya yo'q)";
  if (tone === "neutral") {
    return {
      text: "text-text · text-text-muted · text-text-subtle",
      bg: "bg-surface · bg-sunken · bg-bg · bg-row-hover",
      border: "border-border · border-border-strong",
      gradient: "gradient yo'q → bg-surface / bg-sunken",
    }[kind];
  }
  if (tone === "action") {
    const note = " (ko'k faqat interaktiv narsa; holat bo'lsa info-*; binafsha brend yo'q)";
    return (
      {
        text: "text-action-fg",
        bg: "bg-action text-on-solid · bg-action-soft",
        border: "border-action",
        gradient: "gradient yo'q → bg-action",
      }[kind] + note
    );
  }
  if (tone === "category")
    return "holat bo'lsa danger-* / warning-*, kategoriya/grafik bo'lsa chart-1…8 (CHART_PALETTE)";
  return {
    text: `text-${tone}-fg`,
    bg: `bg-${tone}-soft text-${tone}-fg · to'liq: bg-${tone}`,
    border: `border-${tone}`,
    gradient: `gradient yo'q → bg-${tone}-soft`,
  }[kind];
};

const legacyHint = (name) => {
  if (name === "main") return "bg-action text-on-solid · text-action-fg · border-action";
  if (name === "main-soft" || name === "background-soft") return "bg-action-soft";
  if (name === "maindark") return "text-text (matn) · bg-brand / bg-nav (brend foni)";
  if (name === "primary") return "bg-surface (fon) · text-on-solid (action ustidagi matn)";
  if (name === "primarydark") return "bg-action-hover (hover) · tungi yuza → bg-raised";
  if (name.startsWith("purple"))
    return "bg-action · bg-action-soft · bg-action-hover · text-action-fg (binafsha brend yo'q)";
  if (name === "border-soft") return "border-border";
  if (name === "card-surface") return "bg-row-hover / bg-sunken";
  if (name === "card-surface-strong" || name.startsWith("surface-elevated")) return "bg-raised";
  if (name === "card-shadow") return "shadow-sm / shadow-md (rang literalsiz)";
  if (name === "page-surface") return "bg-surface";
  if (name === "background-deep") return "bg-overlay";
  if (name.startsWith("dashboard-text")) return "text-text-muted / text-text-subtle";
  if (name.startsWith("table-header"))
    return "jadval sarlavhasi: bg-sunken text-text-muted (gradient yo'q)";
  if (name === "sidebar") return "bg-bg (yon menyu: bg-nav)";
  if (name === "error") return "text-danger-fg · bg-danger-soft · border-danger";
  if (name === "dark-bg-py") return "bg-bg";
  if (name === "background") return "bg-brand (navy urg'u) · bg-bg (sahifa foni)";
  if (name.startsWith("table-"))
    return "jadval: bg-sunken (sarlavha) · hover:bg-row-hover · text-text-muted (yorliq)";
  if (name === "dashboard-border") return "border-border";
  if (name.startsWith("dashboard-chart")) return "grafik: CHART_PALETTE / themeTokens(theme) (§3)";
  if (name.startsWith("dashboard-")) return "text-text-muted / text-text-subtle";
  if (name.startsWith("glass")) return "bg-surface · border-border (shisha effekti yo'q)";
  if (name === "surface-dark") return "bg-raised";
  if (name.startsWith("warning-"))
    return "bg-warning-soft text-warning-fg · border-warning (gradient yo'q)";
  if (name === "text-muted-dark")
    return "text-text-muted (dark: jufti kerak emas — token o'zi moslashadi)";
  return "v2 tokeni (docs/DESIGN_SYSTEM.md §2)";
};

const COLOUR_HINT =
  "token: bg-surface · text-text-muted · border-border · bg-action text-on-solid · bg-*-soft text-*-fg " +
  "(JS: themeTokens.ts — themeTokens(theme), CHART_PALETTE)";
const MONEY_FN_HINT =
  "formatMoneyLocalized / formatCompactMoneyLocalized / formatNumberLocalized (src/shared/lib/formatMoney.ts)";
const MONEY_LABEL_HINT =
  'valyutani qo\'lda yozmang: formatMoneyLocalized(x) (CURRENCY_LABEL) yoki t("…currency")';
const ICON_HINT = "faqat lucide-react — kanonik nom: design/icon-registry.json";
const DARK_PAIR_HINT =
  "dark: jufti yozilmaydi — tokenlar mavzuga o'zi moslashadi (bg-surface, text-text, border-border …)";
const TINY_TEXT_HINT = "eng kichik matn 12px: text-xs — docs/DESIGN_SYSTEM.md §4";
const NAMED_COLOUR_HINT =
  "token: SVG — fill-current / stroke-current + text-* (text-on-solid, text-text-muted …); JS — CHART_PALETTE[theme], " +
  "themeTokens(theme); antd Tag rangi o'rniga Badge/StatusBadge tone";
const PALETTE_VAR_HINT =
  "palitra o'zgaruvchisi o'rniga v2 tokeni: var(--color-surface) · var(--color-text-muted) · var(--color-border) · " +
  "var(--color-action) · var(--color-<ton>-soft|fg) (src/index.css)";
const PALETTE_DYNAMIC_HINT =
  "dinamik rang oilasi yozilmaydi: ton xaritasi TONE_SOFT / TONE_FG / TONE_SOLID (tone.ts) yoki CHART_PALETTE[theme]";

const toPx = (value, unit) => Number(value) * (unit === "rem" || unit === "em" ? 16 : 1);

/** @param {RegExp} re @param {string} line @param {(m: RegExpExecArray) => string | null} hintOf */
const collect = (re, line, hintOf, out) => {
  re.lastIndex = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    const hint = hintOf(m);
    if (hint !== null) out.push({ col: m.index + 1, match: m[0], hint });
  }
};

/** `collect` ning nomli guruh (`c`) varianti: ustun va matn — faqat rang nomi (`d` bayrog'i). Bir joy bir marta. */
const collectNamed = (re, line, hint, out, seen) => {
  re.lastIndex = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    const [start] = m.indices.groups.c;
    if (seen.has(start)) continue;
    seen.add(start);
    out.push({ col: start + 1, match: m.groups.c, hint });
  }
};

/** Ifoda (`e` guruhi) ichidagi har qo'shtirnoqli rang nomi — ternar / `??` tarmoqlari. Bir joy bir marta. */
const collectNamedInExpr = (re, line, hint, out, seen) => {
  re.lastIndex = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    const [from, to] = m.indices.groups.e;
    const expr = line.slice(from, to);
    RE_NAMED_QUOTED.lastIndex = 0;
    for (let q = RE_NAMED_QUOTED.exec(expr); q; q = RE_NAMED_QUOTED.exec(expr)) {
      const start = from + q.indices.groups.c[0];
      if (seen.has(start)) continue;
      seen.add(start);
      out.push({ col: start + 1, match: q.groups.c, hint });
    }
  }
};

const DESIGN_SYSTEM_SOURCE = "src/shared/config/designSystem.ts";
const RE_V1_CLASS =
  /(?<![\w-])el-(?:card-soft|card|surface-page|glass-control|segmented-button-active|segmented-button|segmented|muted-text|soft-text)(?![\w-])/g;
const RE_WEIGHT_CLASS = /(?<![\w-])font-(?:black|extrabold)(?![\w-])/g;
const RE_WEIGHT_PROP = /\bfontWeight\s*[:=]\s*\{?\s*["'`]?(?:800|900)(?![\d])/g;
const RE_GRADIENT_CLASS = /(?<![\w-])bg-(?:linear|gradient|radial|conic)(?![\w])/g;
const RE_GRADIENT_FN = /(?<![\w-])(?:repeating-)?(?:linear|radial|conic)-gradient\(/g;
const RE_V1_HELPER = /(?<![\w$.])(?:(?:TYPO|TEXT)\.[A-Za-z]|TONE\[|(?:toneAccent|toneSoftBg|formatPercent)\s*\()/g;
const RE_V1_IMPORT = /\bfrom\s+["'][^"']*\/(?:headerName|MetricCard)["']/g;

const V1_CLASS_HINT =
  "v1 klassi (index.css), maketdagi el-* emas — design/CODE-MAP.md: karta `rounded-[14px] border border-border bg-surface`, segment CODE-MAP 2.5";
const WEIGHT_HINT = "eng qalin — font-bold (700): sarlavha va KPI raqami ham — docs/DESIGN_SYSTEM.md §4";
const GRADIENT_HINT =
  "v2 da gradient yo'q — tekis token fon: bg-surface / bg-action / bg-*-soft — docs/DESIGN_SYSTEM.md §2";
const V1_HELPER_HINT =
  "v1 yordamchisi: TYPO/TEXT → Tailwind tipografiya (DESIGN_SYSTEM §4); TONE/toneAccent/toneSoftBg → *-fg / *-soft tokenlari; formatPercent → formatPercentLocalized (formatMoney.ts)";
const V1_IMPORT_HINT =
  "v1 komponenti: HeaderName → PageHeader, MetricCard → StatCard (1-bosqich) yoki design/CODE-MAP.md retsepti";

/**
 * 1-bosqich primitivlari o'rnini bosgan v1 modullari (src'ga nisbatan, kengaytmasiz) → v2 o'rnini bosuvchisi.
 * Import yo'li fayl joylashuviga nisbatan ANIQ hal qilinadi (`./button`, `../../shared/components/button`,
 * `@/shared/components/button`, `src/…`, `/src/…`): `primitives/Button`, `primitives/StatusBadge`,
 * `formatDateTime` kabi nomdoshlar tutilmaydi.
 */
export const V1_MODULES = {
  "src/shared/components/button":
    "v1 Button → Button / IconButton (src/shared/ui/primitives) — design/CODE-MAP.md 2.1",
  "src/shared/ui/StatusBadge":
    "v1 StatusBadge → StatusBadge (src/shared/ui/primitives); buyurtma holati — OrderStatusBadge (src/entities/order)",
  "src/pages/orders/list/OrderStatusBadge":
    "v1 OrderStatusBadge → OrderStatusBadge (src/entities/order: statusRegistry + StatusBadge)",
  "src/shared/config/statusColorMap":
    "v1 statusColorMap → buyurtma holati: ORDER_STATUS_REGISTRY / OrderStatusBadge (src/entities/order); ton klasslari: tone.ts (TONE_SOFT / TONE_FG / TONE_SOLID)",
  "src/shared/lib/formatDate":
    "v1 formatDate → formatDateTimeLocalized / formatDateLocalized / formatTimeLocalized (src/shared/lib/formatDateTime.ts)",
};

// `from "…"`, `import("…")`, `require("…")`, yon ta'sirli `import "…"`; `?raw` kabi so'rov qismi tashlanadi.
const RE_IMPORT_SPEC =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)(["'])([^"'?\n]+)(?:\?[^"'\n]*)?\1/g;

/**
 * Import spetsifikatorini src'ga nisbatan modul yo'liga aylantiradi (kengaytma va `/index` siz).
 * Paket (`antd`, `react`) — `null`.
 * @param {string} spec @param {string} file
 */
export function resolveImportPath(spec, file) {
  let p;
  if (spec === "." || spec === ".." || spec.startsWith("./") || spec.startsWith("../")) {
    p = path.posix.join(path.posix.dirname(file.split(path.sep).join("/")), spec);
  } else if (spec.startsWith("@/")) {
    p = `src/${spec.slice(2)}`;
  } else if (spec.startsWith("/src/")) {
    p = spec.slice(1);
  } else if (spec.startsWith("src/")) {
    p = spec;
  } else {
    return null;
  }
  return path.posix
    .normalize(p)
    .replace(/\.(?:[cm]?[jt]sx?)$/, "")
    .replace(/\/index$/, "");
}

export const RULES = [
  {
    id: "colour",
    title: "Rang literal (hex / rgb() / hsl()) — faqat tokenlar",
    exempt: [TOKEN_SOURCE, ...OUTPUT_FORMAT_PATHS],
    find(line, out) {
      if (line.includes("#")) {
        collect(
          RE_HEX,
          line,
          (m) => (RE_ANCHOR_BEFORE.test(line.slice(0, m.index)) ? null : COLOUR_HINT),
          out,
        );
      }
      if (line.includes("(")) collect(RE_COLOR_FN, line, () => COLOUR_HINT, out);
    },
  },
  {
    id: "palette",
    title: "Tailwind standart palitrasi (bg-blue-500, text-gray-400, bg-white, text-black …)",
    exempt: [...OUTPUT_FORMAT_PATHS],
    find(line, out) {
      collect(RE_PALETTE, line, (m) => paletteHint(m[1].replace(/-.*/, ""), m[2]), out);
      if (line.includes("white") || line.includes("black"))
        collect(RE_PALETTE_BW, line, (m) => paletteHint(m[1].replace(/-.*/, ""), m[2]), out);
      if (line.includes("--color-")) collect(RE_PALETTE_VAR, line, () => PALETTE_VAR_HINT, out);
      if (line.includes("${")) collect(RE_PALETTE_DYNAMIC, line, () => PALETTE_DYNAMIC_HINT, out);
    },
  },
  {
    id: "dark-pair",
    title: "dark: rang jufti (dark:bg-…, dark:text-…) — tokenlar o'zi moslashadi",
    exempt: [...OUTPUT_FORMAT_PATHS],
    find(line, out) {
      if (line.includes("dark:")) collect(RE_DARK_PAIR, line, () => DARK_PAIR_HINT, out);
    },
  },
  {
    id: "legacy",
    title: "Eski token nomi (main, maindark, primary, purple*, border-soft …)",
    exempt: [...OUTPUT_FORMAT_PATHS],
    find(line, out) {
      collect(RE_LEGACY_UTIL, line, (m) => legacyHint(m[2]), out);
      if (line.includes("--color-")) collect(RE_LEGACY_VAR, line, (m) => legacyHint(m[1]), out);
    },
  },
  {
    id: "money",
    title: "Pul/son formati formatMoney.ts dan tashqarida",
    exempt: [MONEY_SOURCE],
    find(line, out) {
      if (line.includes("Intl")) collect(RE_INTL_NUMBER, line, () => MONEY_FN_HINT, out);
      if (line.includes("toLocaleString")) {
        const dateLine = RE_DATE_LINE.test(line);
        collect(
          RE_TO_LOCALE,
          line,
          (m) => {
            if (dateLine) return null;
            const receiver = /([\w$]+)\s*\)?\s*$/.exec(line.slice(0, m.index))?.[1] ?? "";
            return RE_DATE_RECEIVER.test(receiver) ? null : MONEY_FN_HINT;
          },
          out,
        );
      }
      collect(RE_CURRENCY_SOM, line, () => MONEY_LABEL_HINT, out);
      collect(RE_CURRENCY_SUM, line, () => MONEY_LABEL_HINT, out);
      if (line.includes("UZS")) collect(RE_CURRENCY_UZS, line, () => MONEY_LABEL_HINT, out);
    },
  },
  {
    id: "icons",
    title: "lucide-react dan boshqa ikonka kutubxonasi",
    exempt: [],
    find(line, out) {
      if (line.includes("from") || line.includes("import") || line.includes("require")) {
        collect(RE_ICON_IMPORT, line, () => ICON_HINT, out);
      }
    },
  },
  {
    id: "tiny-text",
    title: "12px dan kichik shrift",
    exempt: [],
    find(line, out) {
      const small = (m) => (toPx(m[1], m[2]) < 12 ? TINY_TEXT_HINT : null);
      if (line.includes("text-[")) collect(RE_TW_TEXT_SIZE, line, small, out);
      if (line.includes("fontSize")) collect(RE_FONT_SIZE_PROP, line, small, out);
      if (line.includes("font-size")) collect(RE_FONT_SIZE_CSS, line, small, out);
    },
  },
  {
    id: "v1-class",
    title: "Eski v1 klassi (el-card, el-glass-control, el-segmented …)",
    exempt: [],
    find(line, out) {
      if (line.includes("el-")) collect(RE_V1_CLASS, line, () => V1_CLASS_HINT, out);
    },
  },
  {
    id: "weight",
    title: "font-black / font-extrabold (v2 da eng qalin — font-bold)",
    exempt: [],
    find(line, out) {
      if (line.includes("font-")) collect(RE_WEIGHT_CLASS, line, () => WEIGHT_HINT, out);
      if (line.includes("fontWeight")) collect(RE_WEIGHT_PROP, line, () => WEIGHT_HINT, out);
    },
  },
  {
    id: "gradient",
    title: "Gradient (bg-linear-*, linear-gradient(...)) — v2 da tekis fon",
    exempt: [...OUTPUT_FORMAT_PATHS],
    find(line, out) {
      if (line.includes("bg-")) collect(RE_GRADIENT_CLASS, line, () => GRADIENT_HINT, out);
      if (line.includes("gradient(")) collect(RE_GRADIENT_FN, line, () => GRADIENT_HINT, out);
    },
  },
  {
    id: "v1-helper",
    title:
      "v1 yordamchisi/komponenti (TYPO, TEXT, toneAccent, formatPercent, HeaderName, MetricCard, v1 Button, StatusBadge, statusColorMap, formatDate)",
    exempt: [DESIGN_SYSTEM_SOURCE],
    find(line, out, file) {
      collect(RE_V1_HELPER, line, () => V1_HELPER_HINT, out);
      if (line.includes("from")) collect(RE_V1_IMPORT, line, () => V1_IMPORT_HINT, out);
      if (file && (line.includes("from") || line.includes("import") || line.includes("require"))) {
        collect(
          RE_IMPORT_SPEC,
          line,
          (m) => V1_MODULES[resolveImportPath(m[2], file) ?? ""] ?? null,
          out,
        );
      }
    },
  },
  {
    id: "named-colour",
    title: "Nomli CSS rangi (white, red …) — faqat tokenlar",
    exempt: [TOKEN_SOURCE, ...OUTPUT_FORMAT_PATHS],
    find(line, out) {
      if (!RE_NAMED_PREFILTER.test(line)) return;
      const seen = new Set();
      if (line.includes("=")) collectNamed(RE_NAMED_ATTR, line, NAMED_COLOUR_HINT, out, seen);
      if (line.includes("={")) collectNamedInExpr(RE_NAMED_ATTR_EXPR, line, NAMED_COLOUR_HINT, out, seen);
      if (line.includes(":")) {
        collectNamed(RE_NAMED_KEY, line, NAMED_COLOUR_HINT, out, seen);
        collectNamed(RE_NAMED_CSS, line, NAMED_COLOUR_HINT, out, seen);
        if (line.includes("?")) collectNamedInExpr(RE_NAMED_KEY_EXPR, line, NAMED_COLOUR_HINT, out, seen);
      }
      if (line.includes("-[")) collectNamed(RE_NAMED_TW, line, NAMED_COLOUR_HINT, out, seen);
    },
  },
];

export const RULE_IDS = RULES.map((rule) => rule.id);

/* ────────────────────────── Izohlarni niqoblash ────────────────────────── */

const REGEX_AFTER = new Set([
  "",
  "(",
  ",",
  "=",
  ":",
  "[",
  "!",
  "&",
  "|",
  "?",
  "{",
  ";",
  "+",
  "-",
  "*",
  "%",
  "~",
  "^",
]);
const REGEX_AFTER_WORD = new Set([
  "return",
  "typeof",
  "case",
  "do",
  "else",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "throw",
  "yield",
  "await",
  "instanceof",
]);
const isWordChar = (ch) => {
  const c = ch.charCodeAt(0);
  return (
    (c >= 97 && c <= 122) ||
    (c >= 65 && c <= 90) ||
    (c >= 48 && c <= 57) ||
    c === 95 ||
    c === 36 ||
    (c > 127 && /[\p{L}\p{N}]/u.test(ch))
  );
};
const isLetter = (ch) => {
  if (ch === undefined) return false;
  const c = ch.charCodeAt(0);
  return (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c > 127 && /\p{L}/u.test(ch));
};

const scanRegexLiteral = (text, start) => {
  let inClass = false;
  for (let j = start + 1; j < text.length; j += 1) {
    const c = text[j];
    if (c === "\\") {
      j += 1;
      continue;
    }
    if (c === "\n") return -1;
    if (inClass) {
      if (c === "]") inClass = false;
      continue;
    }
    if (c === "[") {
      inClass = true;
      continue;
    }
    if (c === "/") {
      let k = j + 1;
      while (k < text.length && /[a-z]/i.test(text[k])) k += 1;
      return k;
    }
  }
  return -1;
};

/**
 * Izohlarni (`// …`, `/* … *\/`, JSX `{/* … *\/}`) bo'shliq bilan almashtiradi — qator/ustun raqamlari
 * saqlanadi, satr va template literallar o'z joyida qoladi (className'lar aynan ularda).
 * Yengil leksik tahlil: satr, template (`${}` ichma-ich), regex literal, JSX matnidagi apostrof (Don't, so'm).
 */
export function maskComments(text) {
  const n = text.length;
  const ranges = [];
  const templateDepths = [];
  let depth = 0;
  let inTemplate = false;
  let prev = "";
  let prev2 = "";
  let lastWord = "";
  const mark = (ch) => {
    prev2 = prev;
    prev = ch;
  };
  let i = 0;
  while (i < n) {
    const ch = text[i];
    if (inTemplate) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "`") {
        inTemplate = false;
        lastWord = "";
        mark("a");
        i += 1;
        continue;
      }
      if (ch === "$" && text[i + 1] === "{") {
        templateDepths.push(depth);
        inTemplate = false;
        mark("{");
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    if (ch === " " || ch === "\n" || ch === "\t" || ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "/") {
      const next = text[i + 1];
      if (next === "/") {
        let end = text.indexOf("\n", i);
        if (end === -1) end = n;
        ranges.push(i, end);
        i = end;
        continue;
      }
      if (next === "*") {
        let end = text.indexOf("*/", i + 2);
        end = end === -1 ? n : end + 2;
        ranges.push(i, end);
        i = end;
        continue;
      }
      const regexAllowed =
        REGEX_AFTER.has(prev) ||
        (prev === ">" && prev2 === "=") ||
        (prev === "a" && REGEX_AFTER_WORD.has(lastWord));
      if (regexAllowed) {
        const end = scanRegexLiteral(text, i);
        if (end > 0) {
          i = end;
          lastWord = "";
          mark("a");
          continue;
        }
      }
      mark("/");
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      // JSX matnidagi apostrof (Don't, so'm, o'z) satr ochmaydi: TS'da harfdan keyin darhol satr bo'lmaydi.
      if (ch === "'" && isLetter(text[i - 1]) && isLetter(text[i + 1])) {
        i += 1;
        continue;
      }
      let j = i + 1;
      while (j < n) {
        const c = text[j];
        if (c === "\\") {
          j += 2;
          continue;
        }
        if (c === ch || c === "\n") break;
        j += 1;
      }
      i = j + 1;
      lastWord = "";
      mark("a");
      continue;
    }
    if (ch === "`") {
      inTemplate = true;
      i += 1;
      continue;
    }
    if (ch === "{") {
      depth += 1;
      mark("{");
      i += 1;
      continue;
    }
    if (ch === "}") {
      if (templateDepths.length && templateDepths[templateDepths.length - 1] === depth) {
        templateDepths.pop();
        inTemplate = true;
        i += 1;
        continue;
      }
      depth -= 1;
      mark("}");
      i += 1;
      continue;
    }
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (isWordChar(ch)) {
      let j = i + 1;
      while (j < n && isWordChar(text[j])) j += 1;
      lastWord = text.slice(i, j);
      mark("a");
      i = j;
      continue;
    }
    mark(ch);
    i += 1;
  }
  if (!ranges.length) return text;
  let out = "";
  let last = 0;
  for (let k = 0; k < ranges.length; k += 2) {
    out +=
      text.slice(last, ranges[k]) + text.slice(ranges[k], ranges[k + 1]).replace(/[^\n]/g, " ");
    last = ranges[k + 1];
  }
  return out + text.slice(last);
}

/* ─────────────────────────────── Skanerlash ─────────────────────────────── */

const RE_MARKER = new RegExp(`${IGNORE_MARKER}(:?)(.*)$`);
/** v2 ga to'liq ko'chirilgan fayl belgisi (AGENTS.md): birinchi qatorda `// dizayn-v2: <ekran>`. */
const RE_V2_MARKER = /^\uFEFF?\s*\/\/\s*dizayn-v2:\s*\S/;
const clip = (s, max = 160) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/** Uzun qatorda topilgan joy atrofidagi bo'lak (minified className'lar 400+ belgi bo'ladi). */
const snippet = (raw, col, length) => {
  const from = Math.max(0, col - 1 - 60);
  const to = Math.min(raw.length, col - 1 + length + 80);
  const body = raw.slice(from, to);
  return `${from > 0 ? "…" : ""}${from > 0 ? body : body.trimStart()}${to < raw.length ? "…" : ""}`;
};

/**
 * Bitta faylni skanerlaydi. `file` — repo ildiziga nisbatan yo'l (`src/...`), qoida istisnolari shunga qarab.
 * `v2` — fayl `// dizayn-v2:` belgili: unga baseline qo'llanmaydi, har qoida bo'yicha ruxsat 0.
 * @returns {{ file: string, v2: boolean, counts: Record<string, number>, violations: Array<object>, ignored: number,
 *            badIgnores: Array<{line:number, source:string}>, unusedIgnores: Array<{line:number, source:string}> }}
 */
export function scanSource(file, text) {
  const lines = text.split("\n");
  const masked = maskComments(text).split("\n");
  const rules = RULES.filter((rule) => !rule.exempt.includes(file));

  // Istisno markerlari: izoh ichida bo'lishi shart (satr ichidagisi marker emas).
  const skipLine = new Map();
  const markers = [];
  const badIgnores = [];
  if (text.includes(IGNORE_MARKER)) {
    lines.forEach((raw, idx) => {
      if (!raw.includes(IGNORE_MARKER) || masked[idx].includes(IGNORE_MARKER)) return;
      const m = RE_MARKER.exec(raw);
      const reason = m && m[1] === ":" ? m[2].replace(/\*\/.*$/, "").trim() : "";
      if (!reason) {
        badIgnores.push({ line: idx + 1, source: clip(raw.trim()) });
        return;
      }
      const commentOnly = masked[idx].replace(/[\s{}]/g, "") === "";
      const marker = { line: idx + 1, source: clip(raw.trim()), used: false };
      markers.push(marker);
      skipLine.set(commentOnly ? idx + 1 : idx, marker);
    });
  }

  const counts = {};
  const violations = [];
  let ignored = 0;
  const found = [];
  for (let idx = 0; idx < masked.length; idx += 1) {
    const line = masked[idx];
    if (line.length < 4 || !/\S/.test(line)) continue;
    for (const rule of rules) {
      found.length = 0;
      rule.find(line, found, file);
      if (!found.length) continue;
      if (found.length > 1) found.sort((x, y) => x.col - y.col);
      const marker = skipLine.get(idx);
      if (marker) {
        marker.used = true;
        ignored += found.length;
        continue;
      }
      counts[rule.id] = (counts[rule.id] ?? 0) + found.length;
      for (const hit of found) {
        violations.push({
          rule: rule.id,
          line: idx + 1,
          col: hit.col,
          match: hit.match,
          hint: hit.hint,
          source: snippet(lines[idx], hit.col, hit.match.length),
        });
      }
    }
  }
  const unusedIgnores = markers
    .filter((m) => !m.used)
    .map(({ line, source }) => ({ line, source }));
  const v2 = RE_V2_MARKER.test(lines[0] ?? "");
  const scoped = isScoped(file, v2);
  return { file, v2, scoped, counts, violations, ignored, badIgnores, unusedIgnores };
}

const toPosix = (p) => p.split(path.sep).join("/");

/** Fayl qo'riqchi doirasidami (src/**\/*.{ts,tsx}, testlar, locales va .d.ts dan tashqari). */
export function isGuardedFile(rel) {
  const p = toPosix(rel);
  if (!p.startsWith(`${SCAN_DIR}/`) || !/\.tsx?$/.test(p) || p.endsWith(".d.ts")) return false;
  if (/\.(test|spec)\.tsx?$/.test(p)) return false;
  const parts = p.split("/");
  for (let k = 1; k < parts.length - 1; k += 1) {
    if (EXCLUDED_DIR_NAMES.has(parts[k]) || EXCLUDED_DIRS.has(parts.slice(0, k + 1).join("/")))
      return false;
  }
  return true;
}

export function listSourceFiles(root = ROOT) {
  const out = [];
  const walk = (dirRel) => {
    for (const entry of readdirSync(path.join(root, dirRel), { withFileTypes: true })) {
      const rel = `${dirRel}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(rel) && !EXCLUDED_DIR_NAMES.has(entry.name)) walk(rel);
      } else if (isGuardedFile(rel)) {
        out.push(rel);
      }
    }
  };
  walk(SCAN_DIR);
  return out.sort();
}

export function scanTree({ root = ROOT } = {}) {
  const started = performance.now();
  const files = listSourceFiles(root).map((rel) =>
    scanSource(rel, readFileSync(path.join(root, rel), "utf8")),
  );
  return { root, files, ms: Math.round(performance.now() - started) };
}

/* ─────────────────────────────── Baseline ─────────────────────────────── */

export function loadBaseline(root = ROOT) {
  const file = path.join(root, BASELINE_FILE);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8"));
}

/**
 * Faylning ruxsatlari: `// dizayn-v2:` — hammasi 0; V2_SCOPES ichidagi (pending emas) — rang qoidalari
 * (`COLOUR_RULES`) 0, qolganlari (`money`, `tiny-text` …) baseline bo'yicha; boshqa fayl — baseline.
 */
function allowanceOf(result, allowedByFile) {
  if (result.v2) return {};
  const allowed = allowedByFile[result.file] ?? {};
  if (!result.scoped) return allowed;
  return Object.fromEntries(Object.entries(allowed).filter(([id]) => !COLOUR_RULE_SET.has(id)));
}

export function compareToBaseline(scan, baseline) {
  const allowedByFile = baseline?.files ?? {};
  const totals = Object.fromEntries(RULE_IDS.map((id) => [id, { current: 0, baseline: 0 }]));
  const regressions = [];
  const improvements = [];
  const seen = new Set();
  for (const result of scan.files) {
    seen.add(result.file);
    // `// dizayn-v2:` fayl — faqat v2: baseline'dagi eski son hisobga olinmaydi. V2_SCOPES fayli — rangda shunday.
    const allowed = allowanceOf(result, allowedByFile);
    for (const id of RULE_IDS) {
      const count = result.counts[id] ?? 0;
      const limit = allowed[id] ?? 0;
      totals[id].current += count;
      if (count > limit) {
        regressions.push({
          file: result.file,
          rule: id,
          count,
          baseline: limit,
          newFile: !(result.file in allowedByFile),
          v2File: result.v2,
          scopeFile: !result.v2 && Boolean(result.scoped) && COLOUR_RULE_SET.has(id),
          violations: result.violations.filter((v) => v.rule === id),
        });
      } else if (count < limit) {
        improvements.push({ file: result.file, rule: id, count, baseline: limit });
      } else if (!count && (allowedByFile[result.file]?.[id] ?? 0) > limit) {
        // `// dizayn-v2:` / V2_SCOPES fayli: baseline'dagi eski son hisobga olinmaydi va buzilish ham qolmagan —
        // o'lik yozuv; `--changed` ko'rsatadi, `--update` o'chiradi.
        improvements.push({ file: result.file, rule: id, count, baseline: allowedByFile[result.file][id] });
      }
    }
  }
  const stale = [];
  for (const [file, counts] of Object.entries(allowedByFile)) {
    for (const id of RULE_IDS) totals[id].baseline += counts[id] ?? 0;
    if (!seen.has(file)) stale.push(file);
  }
  return { regressions, improvements, stale, totals };
}

const BASELINE_COMMENT =
  "Dizayn v2 qo'riqchisi (ratchet): har fayl × qoida uchun ruxsat etilgan ESKI buzilishlar soni. Son faqat " +
  "kamayadi, yangi fayl = 0. Qo'lda tahrirlamang: `npm run design:guard -- --update`. Oshirish faqat " +
  '`--allow-increase "<sabab>"` bilan va sabab `increases` ro\'yxatiga yoziladi. Qoidalar: ' +
  "docs/DESIGN_SYSTEM.md §12.3, scripts/design-guard.mjs.";

/**
 * Joriy skanerdan yangi baseline. Biror son oshgan bo'lsa `allowIncrease` (sabab) majburiy, aks holda xato.
 */
export function buildBaseline(
  scan,
  previous,
  { allowIncrease = "", date = new Date().toISOString().slice(0, 10) } = {},
) {
  const cmp = compareToBaseline(scan, previous);
  // `// dizayn-v2:` fayldagi va V2_SCOPES faylidagi rang buzilishi baseline orqali qotirilmaydi (ruxsat doim 0) —
  // faqat tuzatiladi.
  const regressions = cmp.regressions.filter((r) => !r.v2File && !r.scopeFile);
  const reason = allowIncrease.trim();
  if (regressions.length && !reason) {
    const error = new Error('baseline oshishi uchun --allow-increase "<sabab>" kerak');
    error.regressions = regressions;
    throw error;
  }
  const files = {};
  for (const result of scan.files) {
    if (result.v2) continue; // v2 fayl uchun ruxsat doim 0 — baseline'ga yozilmaydi
    const entry = {};
    for (const id of RULE_IDS) {
      if (!result.counts[id]) continue;
      if (result.scoped && COLOUR_RULE_SET.has(id)) continue; // V2_SCOPES: rang ruxsati yozilmaydi
      entry[id] = result.counts[id];
    }
    if (Object.keys(entry).length) files[result.file] = entry;
  }
  const increases = [...(previous?.increases ?? [])];
  if (regressions.length && !previous) {
    // Boshlang'ich baseline: yuzlab "oshish"ni sanab o'tirmaymiz — sabab va jami yoziladi.
    increases.push({
      date,
      reason,
      initial: true,
      total: regressions.reduce((sum, r) => sum + r.count, 0),
    });
  } else if (regressions.length) {
    const changes = {};
    for (const r of regressions) (changes[r.file] ??= {})[r.rule] = [r.baseline, r.count];
    increases.push({ date, reason, changes });
  }
  return {
    $comment: BASELINE_COMMENT,
    version: 1,
    rules: Object.fromEntries(RULES.map((rule) => [rule.id, rule.title])),
    increases,
    files,
  };
}

const indentJson = (value, pad) => JSON.stringify(value, null, 2).replace(/\n/g, `\n${pad}`);

/** Barqaror formatda yozadi: har fayl bitta qatorda (diff va merge sodda bo'lsin). */
export function serializeBaseline(baseline) {
  const fileLines = Object.keys(baseline.files)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((file) => {
      const counts = RULE_IDS.filter((id) => baseline.files[file][id])
        .map((id) => `${JSON.stringify(id)}: ${baseline.files[file][id]}`)
        .join(", ");
      return `    ${JSON.stringify(file)}: { ${counts} }`;
    });
  return [
    "{",
    `  "$comment": ${JSON.stringify(baseline.$comment)},`,
    `  "version": ${baseline.version},`,
    `  "rules": ${indentJson(baseline.rules, "  ")},`,
    `  "increases": ${indentJson(baseline.increases, "  ")},`,
    `  "files": {${fileLines.length ? `\n${fileLines.join(",\n")}\n  ` : ""}}`,
    "}",
    "",
  ].join("\n");
}

/* ─────────────────────────────── Hisobotlar ─────────────────────────────── */

const MAX_LINES_PER_ENTRY = 25;
const MAX_FILES_IN_REPORT = 20;

const formatViolation = (v) =>
  `      ${v.line}:${v.col}  ${v.match}  →  ${v.hint}\n         ${v.source}`;

/** Baseline'dan oshgan fayllar: qaysi qator, qaysi qoida, v2 o'rnini bosuvchisi. */
export function formatRegressions(cmp) {
  if (!cmp.regressions.length) return "";
  const byFile = new Map();
  for (const r of cmp.regressions) {
    if (!byFile.has(r.file)) byFile.set(r.file, []);
    byFile.get(r.file).push(r);
  }
  const out = [
    `Dizayn v2 qo'riqchisi: ${byFile.size} ta faylda buzilishlar baseline'dan oshdi (${BASELINE_FILE}).`,
    "Yangi/o'zgargan kod faqat v2 tokenlari va qoidalari bilan yoziladi — docs/DESIGN_SYSTEM.md.",
    "",
  ];
  let shown = 0;
  for (const [file, entries] of byFile) {
    if (shown === MAX_FILES_IN_REPORT) {
      out.push(`… yana ${byFile.size - shown} ta fayl: npm run design:guard -- --changed`, "");
      break;
    }
    shown += 1;
    const note = entries[0].v2File
      ? "   (// dizayn-v2: fayl — ruxsat 0, baseline qo'llanmaydi)"
      : entries.some((r) => r.scopeFile)
        ? "   (V2_SCOPES: rang qoidalarida ruxsat 0)"
        : entries[0].newFile
          ? "   (yangi fayl — baseline 0)"
          : "";
    out.push(file + note);
    for (const r of entries) {
      const rule = RULES.find((x) => x.id === r.rule);
      out.push(
        `  [${r.rule}] ${rule.title}: ${r.count} ta, ruxsat ${r.baseline} — kamida ${r.count - r.baseline} tasini v2 ga o'tkazing`,
      );
      for (const v of r.violations.slice(0, MAX_LINES_PER_ENTRY)) out.push(formatViolation(v));
      if (r.violations.length > MAX_LINES_PER_ENTRY) {
        out.push(
          `      … yana ${r.violations.length - MAX_LINES_PER_ENTRY} ta: npm run design:guard -- ${file}`,
        );
      }
    }
    out.push("");
  }
  out.push(
    "Tuzatish: qatorni v2 tokeni / formatlovchisi / lucide-react bilan yozing (→ dan keyingi maslahat).",
    "Asosli istisno (bitta qator): shu yoki oldingi qatorga  // design-guard-ignore: <sabab>",
    "Fayl ko'chirilgan/bo'lingan bo'lsa yoki boshqa asosli sabab bo'lsa:",
    "  npm run design:guard -- --update --allow-increase \"<sabab>\"   (sabab baseline'ga yoziladi, review'da ko'rinadi)",
  );
  if (cmp.regressions.some((r) => r.v2File || r.scopeFile)) {
    out.push(
      "`// dizayn-v2:` fayldagi har buzilish va V2_SCOPES faylidagi rang buzilishi baseline bilan",
      "  qotirilmaydi — faqat tuzatiladi (V2_SCOPES / V2_SCOPE_PENDING / OUTPUT_FORMAT_FILES —",
      "  scripts/design-guard.mjs, istisno ro'yxatlari faqat qisqaradi).",
    );
  }
  if (cmp.stale.length && cmp.regressions.some((r) => r.newFile)) {
    out.push(
      `Eslatma: baseline'da yo'qolgan fayllar bor (${cmp.stale.slice(0, 3).join(", ")}${cmp.stale.length > 3 ? " …" : ""}) — ko'chirish bo'lsa, yuqoridagi --allow-increase bilan qotiring.`,
    );
  }
  return out.join("\n");
}

export function formatBadIgnores(scan) {
  return scan.files
    .flatMap((f) => f.badIgnores.map((b) => `${f.file}:${b.line}  ${b.source}`))
    .join("\n");
}

const pad = (s, n) => (s.length >= n ? s : s + " ".repeat(n - s.length));

function printFileTable(scan, baseline, onlyChanged) {
  const allowedByFile = baseline?.files ?? {};
  const rows = [];
  for (const result of scan.files) {
    const allowed = allowanceOf(result, allowedByFile);
    const raw = allowedByFile[result.file] ?? {};
    const cells = [];
    let changed = false;
    for (const id of RULE_IDS) {
      const count = result.counts[id] ?? 0;
      const limit = allowed[id] ?? 0;
      // v2 / V2_SCOPES fayli: baseline'da eski son bor, lekin u hisobga olinmaydi va buzilish qolmagan.
      const dead = !count && (raw[id] ?? 0) > limit;
      if (!count && !limit && !dead) continue;
      if (count > limit) {
        cells.push(`${id} ${count}>${limit} OSHDI`);
        changed = true;
      } else if (count < limit) {
        cells.push(`${id} ${count}<${limit}`);
        changed = true;
      } else if (dead) {
        cells.push(`${id} 0<${raw[id]} (ruxsat 0 — --update o'chiradi)`);
        changed = true;
      } else cells.push(`${id} ${count}`);
    }
    if (!cells.length || (onlyChanged && !changed)) continue;
    rows.push(`  ${pad(result.file, 70)} ${cells.join("  ")}`);
  }
  console.log(
    onlyChanged
      ? "Baseline'dan farq qilgan fayllar:"
      : "Fayllar bo'yicha (joriy son; >baseline = OSHDI, <baseline = yaxshilangan):",
  );
  console.log(rows.length ? rows.join("\n") : "  (yo'q)");
}

function printFileDetails(scan, files) {
  for (const raw of files) {
    const rel = toPosix(path.relative(ROOT, path.resolve(raw)));
    const result = scan.files.find((f) => f.file === rel);
    if (!result) {
      console.log(
        `\n${rel}: qo'riqchi doirasida emas (src/**/*.{ts,tsx}, testlar va locales'dan tashqari)`,
      );
      continue;
    }
    console.log(
      `\n${rel} — ${result.violations.length} ta buzilish${result.ignored ? `, ${result.ignored} ta istisno` : ""}`,
    );
    for (const v of result.violations)
      console.log(`  [${v.rule}] ${formatViolation(v).trimStart()}`);
    for (const b of result.badIgnores)
      console.log(`  [ignore] ${b.line}: sababsiz marker — ${b.source}`);
    for (const u of result.unusedIgnores)
      console.log(`  [ignore] ${u.line}: ishlatilmagan marker — ${u.source}`);
  }
}

function printTotals(cmp, scan) {
  console.log(`\nJami (${scan.files.length} fayl, ${scan.ms} ms):`);
  const idWidth = Math.max(...RULE_IDS.map((id) => id.length));
  for (const id of RULE_IDS) {
    const t = cmp.totals[id];
    const rule = RULES.find((x) => x.id === id);
    console.log(
      `  ${pad(id, idWidth)} ${pad(String(t.current), 6)} baseline ${pad(String(t.baseline), 6)} ${rule.title}`,
    );
  }
}

/* ─────────────────────────────── --diff ─────────────────────────────── */

const git = (args, root = ROOT) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

/**
 * `git diff -U0` matnidan har fayl uchun qo'shilgan (yangi fayldagi) va o'chirilgan (eski fayldagi) qator
 * raqamlari. Qayta nomlangan fayl eski yo'li bilan bog'lanadi.
 * @returns {Array<{ oldPath: string | null, newPath: string | null, added: Set<number>, removed: Set<number> }>}
 */
export function parseUnifiedDiff(text) {
  const files = [];
  let cur = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("diff --git ")) {
      cur = { oldPath: null, newPath: null, added: new Set(), removed: new Set() };
      files.push(cur);
    } else if (!cur) continue;
    else if (line.startsWith("--- ")) cur.oldPath = line === "--- /dev/null" ? null : line.slice(6);
    else if (line.startsWith("+++ ")) cur.newPath = line === "+++ /dev/null" ? null : line.slice(6);
    else if (line.startsWith("@@")) {
      const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
      if (!m) continue;
      const [oldStart, oldLen, newStart, newLen] = [m[1], m[2] ?? "1", m[3], m[4] ?? "1"].map(Number);
      for (let k = 0; k < oldLen; k += 1) cur.removed.add(oldStart + k);
      for (let k = 0; k < newLen; k += 1) cur.added.add(newStart + k);
    }
  }
  return files;
}

/**
 * Buzilish "turi" — qiymatsiz: `colour` → hex | rgba(; `named-colour` → named; `palette` → `text-gray` (soyasiz);
 * `dark-pair` → `dark:hover:bg` (qiymatsiz); qolganlari → topilgan matn. Eski qatorni tahrirlash (rangni boshqasiga, eski
 * `dark:bg-[#…]` ni `dark:bg-surface` ga) yangi buzilish emas; YANGI tur yoki ortiqcha son — yangi.
 */
const violationKey = (v) => {
  const m = v.match.replace(/\s+/g, "");
  let kind = m;
  if (v.rule === "colour") kind = m.startsWith("#") ? "hex" : m.toLowerCase();
  else if (v.rule === "named-colour") kind = "named"; // `white` → `black` almashtirish — yangi tur emas (hex kabi)
  else if (v.rule === "palette") kind = m.replace(/-\d{2,3}$/, "");
  else if (v.rule === "dark-pair") kind = /^(dark:(?:[\w-]+:)*!?[a-z]+(?:-[xytrblse])?)-/.exec(m)?.[1] ?? m;
  return `${v.rule}\u0000${kind}`;
};

/**
 * Faqat `base` dan beri QO'SHILGAN qatorlardagi yangi buzilishlar. Har fayl uchun: qo'shilgan qatorlardagi
 * buzilishlar (qoida + matn) ko'p-to'plamidan o'chirilgan qatorlardagilari ayiriladi — ya'ni mavjud qatorni
 * tahrirlash yoki kodni ko'chirish o'tadi, `bg-white` ni o'chirib `text-gray-400` qo'shish esa o'tmaydi.
 * Ish daraxti (commit qilinmagan va yangi fayllar) ham hisobga olinadi.
 */
export function diffViolations({ base = "origin/dev", root = ROOT } = {}) {
  const mergeBase = git(["merge-base", base, "HEAD"], root).trim();
  const diff = git(["diff", "-U0", "--no-color", "-M", mergeBase, "--", SCAN_DIR], root);
  const entries = parseUnifiedDiff(diff);
  const untracked = git(["ls-files", "--others", "--exclude-standard", "--", SCAN_DIR], root)
    .split("\n")
    .filter(Boolean);
  for (const rel of untracked) {
    const lines = readFileSync(path.join(root, rel), "utf8").split("\n").length;
    entries.push({
      oldPath: null,
      newPath: rel,
      added: new Set(Array.from({ length: lines }, (_, k) => k + 1)),
      removed: new Set(),
    });
  }
  const results = [];
  for (const entry of entries) {
    if (!entry.newPath || !entry.added.size || !isGuardedFile(entry.newPath)) continue;
    const now = scanSource(entry.newPath, readFileSync(path.join(root, entry.newPath), "utf8"));
    const removed = new Map();
    if (entry.oldPath && entry.removed.size) {
      const before = scanSource(entry.oldPath, git(["show", `${mergeBase}:${entry.oldPath}`], root));
      for (const v of before.violations) {
        if (!entry.removed.has(v.line)) continue;
        removed.set(violationKey(v), (removed.get(violationKey(v)) ?? 0) + 1);
      }
    }
    const fresh = [];
    for (const v of now.violations) {
      if (!entry.added.has(v.line)) continue;
      const key = violationKey(v);
      const left = removed.get(key) ?? 0;
      if (left > 0) removed.set(key, left - 1);
      else fresh.push(v);
    }
    if (fresh.length || now.badIgnores.length)
      results.push({ file: entry.newPath, violations: fresh, badIgnores: now.badIgnores });
  }
  return { base, mergeBase, files: results };
}

function runDiff(args) {
  let res;
  try {
    res = diffViolations({ base: args.diffBase });
  } catch (error) {
    console.error(
      `--diff: git bilan solishtirib bo'lmadi (${args.diffBase}). CI'da checkout fetch-depth: 0 kerak.\n${error.message}`,
    );
    return 2;
  }
  const total = res.files.reduce((n, f) => n + f.violations.length, 0);
  const bad = res.files.flatMap((f) => f.badIgnores.map((b) => `  ${f.file}:${b.line}  ${b.source}`));
  if (!total && !bad.length) {
    console.log(`OK: ${args.diffBase} dan beri qo'shilgan qatorlarda yangi dizayn buzilishi yo'q.`);
    return 0;
  }
  if (total) {
    console.error(
      `RAD ETILDI: ${args.diffBase} dan beri qo'shilgan qatorlarda ${total} ta yangi dizayn buzilishi (docs/DESIGN_SYSTEM.md, AGENTS.md):\n`,
    );
    for (const f of res.files) {
      if (!f.violations.length) continue;
      console.error(f.file);
      for (const v of f.violations.slice(0, MAX_LINES_PER_ENTRY))
        console.error(`  ${v.line}:${v.col}  [${v.rule}] ${v.match}  →  ${v.hint}\n      ${v.source}`);
      if (f.violations.length > MAX_LINES_PER_ENTRY)
        console.error(`  … yana ${f.violations.length - MAX_LINES_PER_ENTRY} ta`);
    }
    console.error(
      "\nTuzating (tokenlar / formatMoney / lucide-react). Asosli istisno: o'sha qatorda `// design-guard-ignore: <sabab>`.",
    );
  }
  if (bad.length)
    console.error(`\nXATO: sababsiz design-guard-ignore (format: // design-guard-ignore: <sabab>):\n${bad.join("\n")}`);
  return 1;
}

const USAGE = `Foydalanish: npm run design:guard [-- <variantlar>] [fayl ...]
  (variantsiz)                 fayllar bo'yicha hisobot + baseline bilan solishtirish
  --changed                    faqat baseline'dan farq qilgan fayllar
  <fayl ...>                   shu fayllardagi har buzilish va v2 o'rnini bosuvchisi
  --update                     baseline'ni joriy holatga qotirish (faqat kamaytiradi / eskirganni o'chiradi)
  --diff [base]                faqat base (sukut: origin/dev) dan beri QO'SHILGAN qatorlar: yangi buzilish = 0
  --update --allow-increase "<sabab>"
                               oshishga ruxsat; sabab ${BASELINE_FILE} → increases ga yoziladi
Qoidalar: docs/DESIGN_SYSTEM.md §12.3.`;

function parseArgs(argv) {
  const args = {
    update: false,
    allowIncrease: null,
    changed: false,
    diffBase: null,
    help: false,
    files: [],
    error: null,
  };
  for (let k = 0; k < argv.length; k += 1) {
    const a = argv[k];
    if (a === "--update") args.update = true;
    else if (a === "--changed") args.changed = true;
    else if (a === "--diff") {
      const next = argv[k + 1];
      args.diffBase = next && !next.startsWith("-") ? next : "origin/dev";
      if (next && !next.startsWith("-")) k += 1;
    } else if (a.startsWith("--diff=")) args.diffBase = a.slice("--diff=".length) || "origin/dev";
    else if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--allow-increase") {
      const next = argv[k + 1];
      args.allowIncrease = next && !next.startsWith("--") ? next : "";
      if (next && !next.startsWith("--")) k += 1;
    } else if (a.startsWith("--allow-increase="))
      args.allowIncrease = a.slice("--allow-increase=".length);
    else if (a.startsWith("-")) args.error = `noma'lum variant: ${a}`;
    else args.files.push(a);
  }
  if (args.allowIncrease !== null && !args.update)
    args.error = "--allow-increase faqat --update bilan ishlatiladi";
  if (args.allowIncrease !== null && !args.allowIncrease.trim())
    args.error = '--allow-increase uchun sabab majburiy: --allow-increase "<sabab>"';
  return args;
}

function runUpdate(scan, previous, args) {
  let next;
  try {
    next = buildBaseline(scan, previous, { allowIncrease: args.allowIncrease ?? "" });
  } catch (error) {
    if (!error.regressions) throw error;
    console.error(formatRegressions({ regressions: error.regressions, stale: [] }));
    console.error(`\nRAD ETILDI: ${error.regressions.length} ta son oshadi. Baseline yozilmadi.`);
    console.error(
      'Avval kodni tuzating; asosli bo\'lsa: npm run design:guard -- --update --allow-increase "<sabab>"',
    );
    return 1;
  }
  const cmp = compareToBaseline(scan, previous);
  const v2Regressions = cmp.regressions.filter((r) => r.v2File);
  const scopeRegressions = cmp.regressions.filter((r) => r.scopeFile);
  cmp.regressions = cmp.regressions.filter((r) => !r.v2File && !r.scopeFile);
  if (v2Regressions.length) {
    console.error(
      `Diqqat: // dizayn-v2: fayllarda buzilish bor — ular baseline bilan qotirilmaydi, tuzating: ${[
        ...new Set(v2Regressions.map((r) => r.file)),
      ].join(", ")}`,
    );
  }
  if (scopeRegressions.length) {
    console.error(
      `Diqqat: V2_SCOPES fayllarida rang buzilishi bor — baseline bilan qotirilmaydi, tuzating: ${[
        ...new Set(scopeRegressions.map((r) => r.file)),
      ].join(", ")}`,
    );
  }
  const text = serializeBaseline(next);
  const file = path.join(ROOT, BASELINE_FILE);
  const before = existsSync(file) ? readFileSync(file, "utf8") : "";
  if (before === text) {
    console.log(`${BASELINE_FILE} o'zgarmadi (joriy holat bilan bir xil).`);
    return 0;
  }
  writeFileSync(file, text);
  const total = (field) => RULE_IDS.reduce((sum, id) => sum + cmp.totals[id][field], 0);
  console.log(`${BASELINE_FILE} yangilandi: jami ${total("baseline")} → ${total("current")}.`);
  if (cmp.improvements.length)
    console.log(`  kamaydi: ${cmp.improvements.length} ta (fayl × qoida)`);
  if (cmp.stale.length) console.log(`  o'chirildi (fayl yo'q): ${cmp.stale.join(", ")}`);
  if (cmp.regressions.length && !previous) {
    console.log(
      `  boshlang'ich baseline: ${Object.keys(next.files).length} fayl (sabab: ${args.allowIncrease.trim()})`,
    );
  } else if (cmp.regressions.length) {
    console.log(`  OSHDI (sabab: ${args.allowIncrease.trim()}):`);
    for (const r of cmp.regressions)
      console.log(`    ${r.file} [${r.rule}] ${r.baseline} → ${r.count}`);
  }
  return 0;
}

export function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  if (args.error) {
    console.error(`${args.error}\n\n${USAGE}`);
    return 2;
  }
  if (args.diffBase) return runDiff(args);
  const scan = scanTree();
  const baseline = loadBaseline();
  if (!baseline && !args.update)
    console.warn(`${BASELINE_FILE} topilmadi — hamma buzilish "yangi" hisoblanadi.`);
  if (args.update) return runUpdate(scan, baseline, args);

  const cmp = compareToBaseline(scan, baseline);
  if (args.files.length) printFileDetails(scan, args.files);
  else printFileTable(scan, baseline, args.changed);
  printTotals(cmp, scan);

  const bad = formatBadIgnores(scan);
  const unused = scan.files.flatMap((f) => f.unusedIgnores.map((u) => `${f.file}:${u.line}`));
  if (unused.length)
    console.warn(
      `\nOgohlantirish: ishlatilmagan design-guard-ignore markerlari: ${unused.join(", ")}`,
    );
  if (cmp.stale.length)
    console.warn(
      `\nOgohlantirish: baseline'da mavjud bo'lmagan fayllar (npm run design:guard -- --update o'chiradi): ${cmp.stale.join(", ")}`,
    );
  if (cmp.improvements.length && !cmp.regressions.length) {
    console.log(
      `\nYaxshilangan: ${cmp.improvements.length} ta (fayl × qoida). Qotirish: npm run design:guard -- --update`,
    );
  }
  if (bad)
    console.error(
      `\nXATO: sababsiz design-guard-ignore (format: // design-guard-ignore: <sabab>):\n${bad}`,
    );
  if (cmp.regressions.length) {
    console.error(`\n${formatRegressions(cmp)}`);
    return 1;
  }
  if (bad) return 1;
  console.log("\nOK: hech bir fayl baseline'dan oshmagan.");
  return 0;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) process.exitCode = main(process.argv.slice(2));
