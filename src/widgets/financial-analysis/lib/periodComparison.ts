/** A zero or absent baseline has no meaningful percentage change. */
export const calculatePercentChange = (
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null => {
  if (current == null || previous == null || !Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return null;
  }

  return ((current - previous) / Math.abs(previous)) * 100;
};
