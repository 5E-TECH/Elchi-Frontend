import { memo, useMemo, type ReactNode } from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import uzUZ from 'antd/locale/uz_UZ';
import { useTheme } from './ThemeContext';
import { LEGACY_MAIN, SEMANTIC_TOKENS, TEXT_MUTED } from '../../../shared/config/themeTokens';

/**
 * ANTD MAVZUSINI ILOVA MAVZUSIGA BOG'LASH.
 *
 * ⚠️ NEGA KERAK BO'LDI — ILDIZ SABAB. Ilovada `ConfigProvider` UMUMAN
 * yo'q edi, ya'ni antd 55 ta faylda o'zining SUKUTDAGI YORUG' temasida
 * chizilardi: oq karta, oq jadval, qora yozuv. Qorong'i rejimda sahifa
 * foni qoraygani bilan (`.dark body` — `index.css`) antd yuzalari oq
 * qolardi va ular ichidagi Tailwind `dark:text-gray-200` yozuvlari OQ
 * FONDA OQ bo'lib, umuman ko'rinmasdi.
 *
 * Foydalanuvchi shikoyati aynan shu edi: "darkda yozuvlar ko'rinmayapti va
 * bg qora rangga o'tmayapti".
 *
 * ⚠️ MUAMMO SAHIFAGA XOS EMAS. Ilgari u sezilmagan, chunki antd asosan
 * kichik joylarda (Tag, Select) ishlatilgan va ularning ba'zilari uchun
 * `index.css` da QO'LDA yamoq yozilgan — lekin yamoqlar aniq widget
 * klasslariga bog'langan (`.order-filter-multiselect`,
 * `.region-range-picker`) va `Card`/`Table`/`Input`/`Form` ni
 * qamramaydi. Integratsiyalar sahifasi aynan ularni keng ishlatadi,
 * shuning uchun muammo shu yerda ko'zga tashlandi.
 *
 * ⚠️ NEGA CSS YAMOQ EMAS, ALGORITM. Har bir antd komponenti uchun qo'lda
 * selektor yozish — tugamaydigan ish: antd o'nlab komponent va yuzlab
 * ichki element ishlatadi, har yangi komponent yana bir yamoq talab
 * qiladi (aynan shu bois hozirgi holatga kelingan). `darkAlgonithm` esa
 * BARCHA tokenni bir joyda almashtiradi.
 */

/**
 * DIZAYN v2: barcha rang/o'lcham `shared/config/themeTokens.ts` dan olinadi —
 * u `index.css` dagi `@theme`/`.dark` bilan bir xil (test bilan qulflangan).
 * Ilgari bu yerda alohida `#6366f1` (indigo) va binafsha yuzalar turardi,
 * ya'ni antd va Tailwind ikki xil brendda chizilardi.
 *
 * ⚠️ `colorPrimary` — `LEGACY_MAIN`: antd asosiy tugmasi OQ yozuvli, dark'dagi
 * `action` (#8ea6ff) esa oq yozuv bilan 2.2:1 beradi. `LEGACY_MAIN.dark`
 * (#5574ee) oq yozuvni ham, qorong'i yuzadagi havolani ham o'qiladigan qiladi.
 */
type Tokens = (typeof SEMANTIC_TOKENS)["light"];
const STATUS = [
  ["Success", "success"],
  ["Warning", "warning"],
  ["Info", "info"],
  ["Error", "danger"],
] as const;

/** antd `colorXBg / colorXBorder / colorXText` — v2 `*-soft` va `*-fg` tokenlaridan. */
const statusTokens = (t: Tokens, isDark: boolean) =>
  Object.fromEntries(
    STATUS.flatMap(([antd, key]) => [
      [`color${antd}Bg`, t[`${key}-soft`]],
      [`color${antd}Border`, isDark ? `color-mix(in srgb, ${t[`${key}-fg`]} 35%, transparent)` : `color-mix(in srgb, ${t[key]} 30%, white)`],
      [`color${antd}Text`, t[`${key}-fg`]],
      ...(isDark ? [[`color${antd}TextHover`, t[`${key}-fg`]], [`color${antd}TextActive`, t[`${key}-fg`]]] : []),
    ]),
  );

const buildAntdTheme = (isDark: boolean) => {
  const mode = isDark ? "dark" : "light";
  const t = SEMANTIC_TOKENS[mode];
  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: LEGACY_MAIN[mode],
      colorInfo: t.info,
      colorSuccess: t.success,
      colorWarning: t.warning,
      colorError: t.danger,
      colorLink: t["action-fg"],
      colorBgContainer: t.surface,
      colorBgElevated: t.raised,
      colorBgLayout: t.bg,
      colorBorder: t["border-strong"],
      colorBorderSecondary: t.border,
      colorText: t.text,
      colorTextSecondary: TEXT_MUTED[mode],
      colorTextTertiary: t["text-subtle"],
      /**
       * Placeholder ham o'qiladigan bo'lsin: sukut (`white/25`) dark yuzada
       * 2.15:1 edi (7L68tqsa). `text-subtle` ikkala mavzuda >= 4.5:1.
       */
      colorTextPlaceholder: isDark ? "rgba(232, 235, 247, 0.6)" : t["text-subtle"],
      controlOutline: t.focus,
      /**
       * Holat ranglarining yumshoq fonlari/matnlari ham tokenlardan — aks holda
       * antd ularni to'q urug'dan HISOBLAB xira jigarrang/yashil fon chiqaradi
       * (Alert, Tag, Message). Matn — `*-fg` (dark'da yorqin, AA).
       */
      ...statusTokens(t, isDark),
      /** Burchak 10px, boshqaruv balandligi 32 / 40 / 48 — docs/DESIGN_SYSTEM.md §5. */
      borderRadius: 10,
      controlHeight: 40,
      controlHeightSM: 32,
      controlHeightLG: 48,
      fontFamily: "inherit",
    },
    components: {
      /**
       * Jadval sarlavhasi — `sunken` fon + `text-muted` yozuv (v2 jadval
       * uslubi). Qator ustiga kelinganda `row-hover`.
       */
      Table: {
        headerBg: t.sunken,
        headerColor: TEXT_MUTED[mode],
        headerSplitColor: "transparent",
        rowHoverBg: t["row-hover"],
        borderColor: t.border,
      },
      Card: { paddingLG: 16 },
      /** controlHeight 40 kalendar kataklarini kattalashtirmasin (popup eni o'zgarmasin). */
      DatePicker: { cellHeight: 28, cellWidth: 36 },
      /**
       * Faol tab `action-fg` — dark'da #8ea6ff (yuzada 7.4:1). antd'ning
       * qoraytirilgan sukuti dark'da 2.38:1 edi (7L68tqsa).
       */
      Tabs: {
        itemSelectedColor: t["action-fg"],
        itemActiveColor: t["action-fg"],
        itemHoverColor: t["action-hover"],
        inkBarColor: t["action-fg"],
      },
    },
  };
};

const AntdThemeProvider = ({ children }: { children: ReactNode }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const config = useMemo(() => buildAntdTheme(isDark), [isDark]);

  /**
   * ⚠️ LOKAL HAM SHU YERDA. `locale` berilmasa antd INGLIZCHA matn
   * chiqaradi va u operatorga ko'rinadi: bo'sh jadvalda "No data",
   * sahifalashda "items per page", nusxa olishda "Copy". O'zbek tilidagi
   * ekranda inglizcha qatorlar "tizim yarim tarjima qilingan" degan
   * taassurot beradi.
   *
   * antd `uz_UZ` lokalini o'zi taqdim etadi — qo'lda tarjima qilish
   * kerak emas.
   */
  return (
    <ConfigProvider theme={config} locale={uzUZ}>
      {children}
    </ConfigProvider>
  );
};

export default memo(AntdThemeProvider);
