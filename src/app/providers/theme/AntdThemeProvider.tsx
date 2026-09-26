import { memo, useMemo, type ReactNode } from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import uzUZ from 'antd/locale/uz_UZ';
import { useTheme } from './ThemeContext';

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
 * Urg'u rangi — `pages/integrations/ui.ts` dagi INDIGO bilan bir xil
 * (`indigo-500`). Aks holda antd tugmalari ko'k, sahifa chiplari esa
 * indigo bo'lib, bitta ekranda ikki xil "asosiy rang" paydo bo'lardi.
 */
const ACCENT = '#6366f1';

/**
 * QORONG'I YUZA — `pages/integrations/ui.ts` dagi `DARK_SURFACE_HEX` bilan
 * AYNI qiymat.
 *
 * ⚠️ NEGA SUKUTNI BOSIB O'TAMIZ. antd `darkAlgorithm` sukuti
 * `colorBgContainer: #141414` — deyarli qora NEYTRAL tus. Ilovaning
 * sahifa foni esa binafsha (`#2a2540`, `index.css`). Natijada bitta
 * ekranda antd kartalari begona qora to'rtburchak bo'lib turardi, Tailwind
 * kartalari esa (`#2A263D`) fondan kontrast **1.00** bilan butunlay
 * singib ketardi. Foydalanuvchi buni "bg qora rangga o'tmayapti" deb
 * ta'rifladi.
 *
 * `#3A3358` hisoblab tanlandi: fondan 1.25 (antd sukutidagi ajralish
 * darajasi), oq matn 11.70:1, `gray-400` 4.61:1 — hammasi AA.
 *
 * ⚠️ `colorBgLayout` ham beriladi: antd sukuti QOP-QORA (`#000000`) va
 * `Layout` ishlatilgan joyda sahifa ichida qora blok paydo bo'lardi.
 */
const DARK_SURFACE = '#3A3358';
const DARK_PAGE = '#2a2540';

const AntdThemeProvider = ({ children }: { children: ReactNode }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const config = useMemo(
    () => ({
      algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: ACCENT,
        ...(isDark
          ? {
              colorBgContainer: DARK_SURFACE,
              // Ko'tarilgan yuzalar (Modal, Dropdown, Select ro'yxati) —
              // kartadan bir pog'ona ajralib turishi kerak.
              colorBgElevated: '#423A63',
              colorBgLayout: DARK_PAGE,
              colorBorder: '#554c82',
              colorBorderSecondary: '#4a4270',
              /**
               * Sukutdagi placeholder (`white/25`) yuzada 2.15:1 — o'qib
               * bo'lmaydi (7L68tqsa kontrast o'lchovi). `white/60` ≈ 6:1.
               */
              colorTextPlaceholder: 'rgba(255, 255, 255, 0.6)',
            }
          : {}),
        /**
         * Burchaklar Tailwind `rounded-xl` (12px) bilan moslashtirildi —
         * antd sukuti 6px va yonma-yon turgan kartalar bilan solishtirganda
         * u "boshqa dizayndan" ko'rinardi.
         */
        borderRadius: 10,
        fontFamily: 'inherit',
      },
      components: {
        /**
         * ⚠️ Jadval sarlavhasi ATAYLAB shaffof. Sahifadagi kartalar
         * Tailwind yuzasida (`bg-white dark:bg-gray-800/50`), antd jadvali
         * esa o'z fonini chizadi — ikkisi ustma-ust tushganda qorong'ida
         * ikki xil kulrang chiziq paydo bo'lardi.
         */
        Table: { headerBg: 'transparent' },
        Card: { paddingLG: 16 },
        /**
         * Dark'da faol tab sukutda `ACCENT` ning qoraytirilgan tusi —
         * yuzada 2.38:1 (7L68tqsa). `indigo-300` bilan ≥ 4.5:1.
         */
        ...(isDark
          ? {
              Tabs: {
                itemSelectedColor: '#a5b4fc',
                itemActiveColor: '#a5b4fc',
                itemHoverColor: '#c7d2fe',
                inkBarColor: '#a5b4fc',
              },
            }
          : {}),
      },
    }),
    [isDark],
  );

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
