/**
 * Markaziy ombor (Pa1KaXmj) ro'yxat va ustunlarda birinchi: `isHq` lar oldinga, qolganlarining tartibi o'zgarmaydi
 * (barqaror). Ombor ko'pi bilan bitta, lekin funksiya bir nechtasida ham tartibni saqlaydi.
 */
export const hqFirst = <T extends { isHq: boolean }>(items: readonly T[]): T[] => [
  ...items.filter((item) => item.isHq),
  ...items.filter((item) => !item.isHq),
];
