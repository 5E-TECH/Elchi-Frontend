/** «Yumaloq» qadam: 1 · 2 · 2,5 · 5 · 10 × 10ⁿ (maket o'qi: 0 · 10 mln · 20 mln · 30 mln). */
const niceStep = (raw: number) => {
  if (!(raw > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  const nice = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10;
  return nice * power;
};

/** Y o'qi chiziqlari: 0 dan (manfiy qiymat bo'lsa — undan pastdan) yumaloq qadam bilan, ~3–4 bo'lak. */
export const buildTicks = (values: readonly number[]) => {
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const step = niceStep((max - min) / 3);
  const start = Math.floor(min / step) * step;
  const end = Math.max(start + step, Math.ceil(max / step) * step);
  const ticks: number[] = [];
  for (let value = start; value <= end + step / 2; value += step) ticks.push(value);
  return ticks;
};
