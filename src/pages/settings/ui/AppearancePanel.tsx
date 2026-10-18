// dizayn-v2: common-settings-appearance
import { useId, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Language, ThemeMode } from "../../../entities/settings";
import { TEXT_MUTED, themeTokens } from "../../../shared/config/themeTokens";
import { ChoiceCard, RadioDot, SectionHead } from "./settingsUi";

const LANGUAGES: { key: Language; native: string }[] = [
  { key: "uz", native: "O'zbekcha" },
  { key: "ru", native: "Русский" },
  { key: "en", native: "English" },
];

/** Kunduzgi mavzu namunasi qatorlari (maket: 70/90/76/84/64 %). */
const PREVIEW_LINES = ["70%", "90%", "76%", "84%", "64%"] as const;

/**
 * Kunduzgi mavzu namunasi — sahifa qaysi mavzuda bo'lishidan qat'i nazar KUNDUZGI ranglarda.
 * Ilovada «majburan kunduzgi» qatlami yo'q (CODE-MAP: `.el-theme-light` ekvivalenti yo'q), shuning uchun
 * ranglar `themeTokens("light")` dan (JS token manbasi, hex emas).
 */
const LightPreview = () => {
  const light = themeTokens("light");
  return (
    <span
      aria-hidden="true"
      className="flex h-[104px] gap-1.5 rounded-lg p-2"
      style={{ background: light.sunken }}
    >
      <span
        className="flex w-[32%] flex-none flex-col gap-1.5 rounded-md p-2"
        style={{ background: light.surface }}
      >
        {PREVIEW_LINES.map((width, index) => (
          <span
            key={width}
            className={index === 1 ? "mt-1 h-1.5 rounded-full" : "h-1.5 rounded-full"}
            style={{ width, background: index === 0 ? light["border-strong"] : light.border }}
          />
        ))}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span
          className="flex h-5 flex-none items-center justify-end rounded-md px-1"
          style={{ background: light.surface, color: TEXT_MUTED.light }}
        >
          <Sun size={12} />
        </span>
        <span className="flex flex-1 gap-1.5">
          <span className="flex-1 rounded-md" style={{ background: light.surface }} />
          <span className="flex-1 rounded-md" style={{ background: light.surface }} />
        </span>
        <span className="flex-1 rounded-md" style={{ background: light.surface }} />
      </span>
    </span>
  );
};

/** Tungi mavzu namunasi — `dark` o'rami ichida tokenlar tungi (CODE-MAP: `.el-theme-dark` → `className="dark"`). */
const DarkPreview = () => (
  <span aria-hidden="true" className="dark flex h-[104px] gap-1.5 rounded-lg bg-nav p-2">
    <span className="flex w-[32%] flex-none flex-col gap-1.5 rounded-md bg-nav-line p-2">
      {PREVIEW_LINES.map((width, index) => (
        <span
          key={width}
          className={
            index === 0 ? "h-1.5 rounded-full bg-nav-text" : "h-1.5 rounded-full bg-nav-active"
          }
          style={{ width, marginTop: index === 1 ? 4 : undefined }}
        />
      ))}
    </span>
    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="flex h-5 flex-none items-center justify-end rounded-md bg-nav-line px-1 text-nav-text">
        <Moon size={12} />
      </span>
      <span className="flex flex-1 gap-1.5">
        <span className="flex-1 rounded-md bg-nav-line" />
        <span className="flex-1 rounded-md bg-nav-line" />
      </span>
      <span className="flex-1 rounded-md bg-nav-line" />
    </span>
  </span>
);

/**
 * «KO'RINISH» — maket `common-settings-appearance`: «Mavzu» (2 rasmli radio-karta) va «Til» (3 radio).
 * Tanlov darhol qo'llanadi va avto-saqlanadi (`onTheme` / `onLanguage` — sahifadagi `persist`).
 */
export const AppearancePanel = ({
  theme,
  language,
  onTheme,
  onLanguage,
}: {
  theme: ThemeMode;
  language: Language;
  onTheme: (theme: ThemeMode) => void;
  onLanguage: (language: Language) => void;
}) => {
  const { t } = useTranslation("settings");
  const themeId = useId();
  const langId = useId();

  const themes: { key: ThemeMode; preview: ReactNode }[] = [
    { key: "light", preview: <LightPreview /> },
    { key: "dark", preview: <DarkPreview /> },
  ];

  return (
    <>
      <div
        role="radiogroup"
        aria-labelledby={themeId}
        className="flex flex-col gap-4 p-5 max-md:p-4"
      >
        <SectionHead id={themeId} title={t("appearance.theme")} hint={t("appearance.theme_hint")} />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-4">
          {themes.map(({ key, preview }) => (
            <ChoiceCard
              key={key}
              name="settings-theme"
              value={key}
              checked={theme === key}
              onSelect={() => onTheme(key)}
              className="flex-col gap-3 p-3"
            >
              {preview}
              <span className="flex min-h-6 items-center gap-2.5 px-1">
                <RadioDot />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold">{t(`appearance.${key}`)}</span>
                  <span className="text-xs text-text-muted">{t(`appearance.${key}_hint`)}</span>
                </span>
              </span>
            </ChoiceCard>
          ))}
        </div>
      </div>

      <div
        role="radiogroup"
        aria-labelledby={langId}
        className="flex flex-col gap-4 border-t border-border p-5 max-md:p-4"
      >
        <SectionHead
          id={langId}
          title={t("appearance.language")}
          hint={t("appearance.language_hint")}
        />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-4">
          {LANGUAGES.map(({ key, native }) => (
            <ChoiceCard
              key={key}
              name="settings-language"
              value={key}
              checked={language === key}
              onSelect={() => onLanguage(key)}
              className="min-h-16 items-center gap-3 px-4 py-3"
            >
              <RadioDot />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-semibold" lang={key}>
                  {native}
                </span>
                <span className="text-xs text-text-muted">{t(`appearance.lang_${key}`)}</span>
              </span>
            </ChoiceCard>
          ))}
        </div>
      </div>
    </>
  );
};
