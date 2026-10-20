import { describe, expect, it } from "vitest";
import i18n from "../../../i18n";
import { toSourceTypeLabel } from "./historyRow";

/**
 * lbX2ipAQ — «Manba turi» ro'yxati, «Manba» ustuni va Tahlil bitta yorliqdan (`toSourceTypeLabel`):
 * sotuv va bekor qilish qo'shimcha xarajati farqlanadi (uz/ru/en).
 */
describe("toSourceTypeLabel — qo'shimcha xarajat manbalari", () => {
  it.each([
    ["uz", "Qo'shimcha xarajat (sotuv)", "Qo'shimcha xarajat (bekor)"],
    ["ru", "Дополнительный расход (продажа)", "Дополнительный расход (отмена)"],
    ["en", "Extra cost (sale)", "Extra cost (cancellation)"],
  ])("%s: sotuv va bekor yorlig'i alohida", async (language, sell, cancel) => {
    const t = (await i18n.cloneInstance().changeLanguage(language)) as (key: string) => string;
    const label = (source: string) => toSourceTypeLabel(source, (key) => t(`payments:${key}`));
    expect(label("sell_extra_cost")).toBe(sell);
    expect(label("cancel_extra_cost")).toBe(cancel);
    expect(label("sell_extra_cost")).not.toBe(label("cancel_extra_cost"));
  });
});
