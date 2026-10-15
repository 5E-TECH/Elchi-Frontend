/**
 * ────────────────────────────────────────────────────────────────────────────
 *  DIZAYN v2 TOKENLARI — JS tomondagi nusxa (antd, recharts, canvas uchun)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Asl manba — `src/index.css` (`@theme` va `.dark` bloklari). Bu fayl CSS
 *  o'zgaruvchisini o'qiy olmaydigan joylar uchun (antd `ConfigProvider`,
 *  grafik kutubxonalari). Ikkalasi AYNAN bir xil bo'lishi shart —
 *  `themeTokens.test.ts` har bir qiymatni `index.css` bilan solishtiradi,
 *  shuning uchun bittasini o'zgartirsangiz, ikkinchisini ham o'zgartiring.
 *
 *  Ma'nolar va qoidalar: `docs/DESIGN_SYSTEM.md`.
 */

export type ThemeName = "light" | "dark";

export type SemanticToken =
  | "bg"
  | "surface"
  | "raised"
  | "sunken"
  | "input"
  | "row-hover"
  | "border"
  | "border-strong"
  | "text"
  | "text-subtle"
  | "brand"
  | "nav"
  | "action"
  | "action-hover"
  | "action-fg"
  | "action-soft"
  | "on-solid"
  | "focus"
  | "success"
  | "success-fg"
  | "success-soft"
  | "warning"
  | "warning-fg"
  | "warning-soft"
  | "danger"
  | "danger-fg"
  | "danger-soft"
  | "info"
  | "info-fg"
  | "info-soft"
  | "overlay";

export const SEMANTIC_TOKENS: Record<ThemeName, Record<SemanticToken, string>> = {
  light: {
    bg: "#f4f6fb",
    surface: "#ffffff",
    raised: "#ffffff",
    sunken: "#f0f3f9",
    input: "#ffffff",
    "row-hover": "#f7f9fd",
    border: "#e1e6f0",
    "border-strong": "#c9d1e0",
    text: "#101733",
    "text-subtle": "#7c859f",
    brand: "#1f2853",
    nav: "#1f2853",
    action: "#2b50d8",
    "action-hover": "#2443b8",
    "action-fg": "#2b50d8",
    "action-soft": "#e8edfd",
    "on-solid": "#ffffff",
    focus: "rgba(43, 80, 216, 0.28)",
    success: "#12704f",
    "success-fg": "#12704f",
    "success-soft": "#e3f4ec",
    warning: "#95560a",
    "warning-fg": "#95560a",
    "warning-soft": "#fcf0dc",
    danger: "#be2a3b",
    "danger-fg": "#be2a3b",
    "danger-soft": "#fde8ea",
    info: "#1a62a8",
    "info-fg": "#1a62a8",
    "info-soft": "#e2effa",
    overlay: "rgba(16, 23, 51, 0.45)",
  },
  dark: {
    bg: "#0d1120",
    surface: "#151a2e",
    raised: "#1c2240",
    sunken: "#11162a",
    input: "#11162a",
    "row-hover": "#1a2036",
    border: "#262d4a",
    "border-strong": "#3a4366",
    text: "#e8ebf7",
    "text-subtle": "#7a83a3",
    brand: "#c9d2f5",
    nav: "#0a0e1b",
    action: "#8ea6ff",
    "action-hover": "#a9bbff",
    "action-fg": "#8ea6ff",
    "action-soft": "rgba(142, 166, 255, 0.14)",
    "on-solid": "#0d1120",
    focus: "rgba(142, 166, 255, 0.38)",
    success: "#0d8f5b",
    "success-fg": "#4fc58e",
    "success-soft": "rgba(79, 197, 142, 0.14)",
    warning: "#c97900",
    "warning-fg": "#f1b24e",
    "warning-soft": "rgba(241, 178, 78, 0.14)",
    danger: "#d82f48",
    "danger-fg": "#ff7182",
    "danger-soft": "rgba(255, 113, 130, 0.14)",
    info: "#2563d8",
    "info-fg": "#6bb6f3",
    "info-soft": "rgba(107, 182, 243, 0.14)",
    overlay: "rgba(3, 5, 12, 0.62)",
  },
};

/** `--color-text-muted` (dark'da `--color-text-muted-dark` orqali). */
export const TEXT_MUTED: Record<ThemeName, string> = { light: "#4b5575", dark: "#a7afcb" };

/**
 * Eski `--color-main` — oq matnli FON ham, qorong'i yuzadagi MATN ham bo'lib
 * ishlatiladi. Dark'dagi qiymat ikkala holatda ~4.1:1 beradigan muvozanat;
 * antd tugmalari (oq yozuvli) ham shu rangni oladi.
 */
export const LEGACY_MAIN: Record<ThemeName, string> = { light: "#2b50d8", dark: "#5574ee" };

/**
 * Grafiklar uchun kategorial palitra — `validate_palette.js` bilan ikkala
 * mavzu yuzasida tekshirilgan (qo'shni juftlar CVD ΔE ≥ 8.4, oddiy ko'rish
 * ΔE ≥ 19.3). TARTIBI O'ZGARMAYDI; 8 tadan ortiq seriya bo'lsa "Boshqa"ga
 * yig'iladi, yangi rang yaratilmaydi.
 */
export const CHART_PALETTE: Record<ThemeName, readonly string[]> = {
  light: ["#2b50d8", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
  dark: ["#5b7cf0", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
};

export const CHART_MUTED: Record<ThemeName, string> = { light: "#c9d1e0", dark: "#3a4366" };

/** Mavzu uchun barcha semantik tokenlar. */
export const themeTokens = (theme: ThemeName) => SEMANTIC_TOKENS[theme];
