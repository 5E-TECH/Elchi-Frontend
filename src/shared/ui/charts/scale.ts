// dizayn-v2: tizim-charts
/**
 * Shkala shifti — eng katta yig'indidan katta-teng yaxlit son (1 · 2 · 5 × 10ⁿ): maketda 5,6 mln ustun plotning 56%
 * ida (shift 10 mln), eng baland ustun tepaga tegmaydi va uning yig'indisi tooltip ostida qolmaydi.
 */
export const niceCeiling = (value: number) => {
  if (!(value > 0) || !Number.isFinite(value)) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((factor) => factor * magnitude >= value * (1 - 1e-9)) ?? 10;
  return step * magnitude;
};
