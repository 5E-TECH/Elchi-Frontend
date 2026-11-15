import type { HTMLAttributes } from "react";
import { getPanelId, getTabId } from "../../../shared/ui/primitives";
import { ALERT_ID_PARAM } from "./alertFilters";

/**
 * `/ai-assistant` bo'limlari (D1, D4): `?tab=chat|alerts`. Faqat maslahatchi backend'i bor muhitda (`overview` zondi
 * `available`) — aks holda sahifa faqat suhbat va `?tab` e'tiborga olinmaydi. «Hisobotlar», «Tavsiyalar», «Sarf» —
 * backend yo'q (BE-4 7NajBTwo, BE-1 815tWsxr), chizilmaydi.
 *   - `chat` — sukut, URL'ga yozilmaydi; noma'lum qiymat — `chat`;
 *   - tab almashsa faqat `tab` o'zgaradi (filtrlar va `conversation` qoladi); «Ogohlantirishlar» dan chiqilsa — ochiq
 *     oyna (`alert`) ham olinadi.
 */
export const AI_TABS = ["chat", "alerts"] as const;
export type AiTab = (typeof AI_TABS)[number];

export const AI_TAB_PARAM = "tab";
export const DEFAULT_AI_TAB: AiTab = "chat";

const isAiTab = (value: unknown): value is AiTab => typeof value === "string" && (AI_TABS as readonly string[]).includes(value);

/** URL'dagi tab (noma'lum yoki yo'q — `chat`). Mavjudlik qobiqda hisobga olinadi. */
export const readTab = (params: URLSearchParams): AiTab => {
  const raw = params.get(AI_TAB_PARAM);
  return isAiTab(raw) ? raw : DEFAULT_AI_TAB;
};

/** Tab almashgandagi URL: `chat` — kalit olinadi; «Ogohlantirishlar» dan chiqishda `alert` ham. */
export const tabSearch = (params: URLSearchParams, tab: AiTab): URLSearchParams => {
  const next = new URLSearchParams(params);
  if (tab === DEFAULT_AI_TAB) next.delete(AI_TAB_PARAM);
  else next.set(AI_TAB_PARAM, tab);
  if (tab !== "alerts") next.delete(ALERT_ID_PARAM);
  return next;
};

/** Tab va panel `id` lari prefiksi (`Tabs idPrefix`, `getPanelId`). */
export const AI_TABS_ID_PREFIX = "ai-assistant";

/** Telefondagi «Bo'lim» tanlovi (`Select`) `id` si — panel nomi shundan olinadi. */
export const AI_TAB_SELECT_ID = `${AI_TABS_ID_PREFIX}-section-select`;

/**
 * Panel atributlari: ≥ 768 — `tabpanel` (tanlangan tab `aria-controls` bilan bog'lanadi; `tabIndex: 0` — ARIA tabs
 * namunasi: tabdan Tab bilan panelga o'tiladi); telefonda tablar o'rnida `Select`, panel — `region`, nomi tanlovdan
 * («Bo'lim: Ogohlantirishlar», `aria-labelledby`) — ichidagi «Ogohlantirishlar» kartasi bilan bir xil nomli ikki
 * hudud bo'lmaydi.
 */
export const tabPanelProps = (tab: AiTab, { phone }: { phone: boolean }): HTMLAttributes<HTMLDivElement> =>
  phone
    ? { role: "region", id: getPanelId(AI_TABS_ID_PREFIX, tab), "aria-labelledby": AI_TAB_SELECT_ID }
    : {
        role: "tabpanel",
        id: getPanelId(AI_TABS_ID_PREFIX, tab),
        "aria-labelledby": getTabId(AI_TABS_ID_PREFIX, tab),
        tabIndex: 0,
      };
