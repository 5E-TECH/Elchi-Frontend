import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { AI_ASSISTANT_TOOL_NAMES, type AiSource, type AiSourcePeriod } from "./types";

/**
 * «Manba: …» qatori (maket `superadmin-ai-assistant`): «Manba: kassa operatsiyalari 01.10–23.10.2026, 1 284 ta yozuv;
 * kuryerlar qarzi (joriy holat), 37 ta yozuv». Har manba alohida (bitta javobda davri har xil bir nechta manba
 * bo'lishi mumkin), takrori olib tashlanadi; `ok: false` (tool xato bergan) — ko'rsatilmaydi; davrsiz tool —
 * «(joriy holat)»; `truncated` — «qisqartirilgan». Sana `YYYY-MM-DD` satr sifatida o'qiladi (`new Date()` emas —
 * vaqt mintaqasi kunni surmasin).
 */

type Translate = (key: string, options?: Record<string, unknown>) => string;

const KNOWN_TOOLS = new Set<string>(AI_ASSISTANT_TOOL_NAMES);

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

const dateParts = (value: string) => {
  const match = DATE_RE.exec(value.trim());
  return match ? { year: match[1], month: match[2], day: match[3] } : null;
};

/** `2026-10-01`…`2026-10-23` → «01.10–23.10.2026»; yil boshqa — ikkalasi to'liq; bitta kun — «23.10.2026». */
export const formatSourcePeriod = (period: AiSourcePeriod): string => {
  const from = dateParts(period.from);
  const to = dateParts(period.to);
  if (!from || !to) return `${period.from}–${period.to}`;
  const full = (d: NonNullable<typeof from>) => `${d.day}.${d.month}.${d.year}`;
  if (from.year === to.year && from.month === to.month && from.day === to.day) return full(to);
  if (from.year === to.year) return `${from.day}.${from.month}–${full(to)}`;
  return `${full(from)}–${full(to)}`;
};

/** Ko'rsatiladigan manbalar: faqat muvaffaqiyatli, takrorsiz (bir tool + bir davr — eng ko'p yozuv). */
export const visibleSources = (sources: readonly AiSource[]): AiSource[] => {
  const byKey = new Map<string, AiSource>();
  for (const source of sources) {
    if (!source.ok) continue;
    const key = `${source.tool}|${source.period?.from ?? ""}|${source.period?.to ?? ""}`;
    const prev = byKey.get(key);
    byKey.set(
      key,
      prev
        ? { ...prev, records: Math.max(prev.records, source.records), truncated: prev.truncated || source.truncated }
        : source,
    );
  }
  return [...byKey.values()];
};

/** Tool nomi → matn (`aiAdvisor:sources.tools.*`); noma'lum tool — umumiy «boshqa ma'lumot». */
export const sourceLabel = (tool: string, t: Translate) =>
  KNOWN_TOOLS.has(tool) ? t(`sources.tools.${tool}`) : t("sources.tools.other");

/** Bitta manba: «kassa operatsiyalari 01.10–23.10.2026, 1 284 ta yozuv». */
export const formatSource = (source: AiSource, t: Translate, language?: string | null) => {
  const label = sourceLabel(source.tool, t);
  const period = source.period ? formatSourcePeriod(source.period) : t("sources.currentState");
  const records = t("sources.records", {
    count: source.records,
    value: formatNumberLocalized(source.records, { language }),
  });
  const parts = [`${label} ${period}`, records];
  if (source.truncated) parts.push(t("sources.truncated"));
  return parts.join(", ");
};

/** Butun qator («Manba: …») yoki manba yo'q bo'lsa `null` (qator chizilmaydi). */
export const formatSourcesLine = (sources: readonly AiSource[], t: Translate, language?: string | null) => {
  const items = visibleSources(sources);
  if (!items.length) return null;
  return t("sources.line", { items: items.map((source) => formatSource(source, t, language)).join("; ") });
};
