import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  CHART_MUTED,
  CHART_PALETTE,
  SEMANTIC_TOKENS,
  TEXT_MUTED,
  type ThemeName,
} from "../../shared/config/themeTokens";
import { cx } from "../../shared/lib/cx";

/** Panel mavzusi: `current` — `?theme-pair=0` rejimida ilovaning joriy mavzusi. */
export type KitPanelTheme = ThemeName | "current";

export type ThemePairProps = Omit<ComponentProps<"div">, "children"> & {
  /**
   * Namuna. Ikki marta chiziladi (kunduzgi + tungi), shuning uchun ichida `id`
   * bo'lsa (tab `aria-controls`, `label htmlFor` …) funksiya bering va `id` ga
   * mavzuni qo'shing: `{(theme) => <Tabs idPrefix={`demo-${theme}`} />}`.
   */
  children: ReactNode | ((theme: KitPanelTheme) => ReactNode);
  /**
   * Panellar joylashuvi: `split` (sukut) — keng ekranda yonma-yon, `md` dan tor bo'lsa ustma-ust;
   * `stack` — har doim ustma-ust (keng namuna, masalan 5 ustunli jadval, yarim kenglikka sig'maydi).
   */
  layout?: "split" | "stack";
};

/**
 * Mavzu tokenlarini (`--color-*`) shu panel uchun qayta e'lon qiladi.
 *
 * NEGA KERAK: tokenlar `:root` (`@theme`) va `.dark` blokida aniqlangan va
 * meros bo'lib o'tadi. Ilova tungi mavzuda bo'lsa (`<html class="dark">`),
 * kunduzgi panel ichida ham tungi qiymatlar qolardi — shuning uchun kunduzgi
 * panel qiymatlarni o'zi beradi. Manba — `themeTokens.ts` (index.css bilan
 * `themeTokens.test.ts` tenglashtiradi), qo'lda rang yozilmaydi.
 * Tungi panelga `.dark` klassi yetadi (`index.css` dagi `.dark` bloki
 * tokenlarni ichki daraxtda ham qayta aniqlaydi).
 */
const themeVariables = (theme: ThemeName): CSSProperties => {
  const vars: Record<string, string> = { colorScheme: theme };
  for (const [name, value] of Object.entries(SEMANTIC_TOKENS[theme])) vars[`--color-${name}`] = value;
  vars["--color-text-muted"] = TEXT_MUTED[theme];
  CHART_PALETTE[theme].forEach((value, index) => {
    vars[`--color-chart-${index + 1}`] = value;
  });
  vars["--color-chart-muted"] = CHART_MUTED[theme];
  return vars as CSSProperties;
};

const LIGHT_VARIABLES = themeVariables("light");

const PANEL = "flex min-w-0 flex-col gap-4 rounded-[14px] border border-border bg-bg p-5 text-text max-md:p-4";
const LABEL = "text-xs font-semibold uppercase tracking-[.05em] text-text-muted";

const render = (children: ThemePairProps["children"], theme: KitPanelTheme) =>
  typeof children === "function" ? children(theme) : children;

const LAYOUT: Record<NonNullable<ThemePairProps["layout"]>, string> = {
  split: "grid-cols-2 max-md:grid-cols-1",
  stack: "grid-cols-1",
};

/**
 * Namunani kunduzgi va tungi mavzuda yonma-yon ko'rsatadi (telefonda ustma-ust;
 * `layout="stack"` — har doim ustma-ust).
 * `?theme-pair=0` bo'lsa — faqat bitta panel, ilovaning joriy mavzusida.
 */
export const ThemePair = ({ children, className, layout = "split", ...rest }: ThemePairProps) => {
  const { t } = useTranslation("ui");
  const [params] = useSearchParams();

  if (params.get("theme-pair") === "0") {
    return (
      <div data-kit-theme="current" className={cx(PANEL, className)} {...rest}>
        {render(children, "current")}
      </div>
    );
  }

  return (
    <div data-kit-layout={layout} className={cx("grid min-w-0 gap-4", LAYOUT[layout], className)} {...rest}>
      <div data-kit-theme="light" className={PANEL} style={LIGHT_VARIABLES}>
        <span className={LABEL}>{t("kit.themeLight")}</span>
        {render(children, "light")}
      </div>
      <div data-kit-theme="dark" className={cx("dark", PANEL)} style={{ colorScheme: "dark" }}>
        <span className={LABEL}>{t("kit.themeDark")}</span>
        {render(children, "dark")}
      </div>
    </div>
  );
};
