import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import { branchTypeOf } from "../../../app/lib/access";

/**
 * «Pochta» ro'yxatlari kartalar to'rimi yoki jadvalmi (ega qarori 2026-11-03, BeePost uslubi).
 *
 * Kartalar: kuryer (barcha tablari) va HQ bo'lmagan filial menejeri — har pochta sanasi va vaqti bilan alohida
 * karta (`components/MailCardsGrid.tsx`). HQ xodimlari (superadmin, admin, registrator, HQ menejeri) — jadval.
 * HQ va filial menejeri faqat filial turi bilan ajraladi (`branchTypeOf` → `getUserBranchType`).
 * «Qaytarish» tabi pochta emas, buyurtma so'rovlari — u bu tanlovga bog'liq emas.
 */
export const selectMailsCardView = (state: RootState): boolean => {
  const role = state.role.role;
  return role === "courier" || (role === "manager" && branchTypeOf(state) !== "HQ");
};

export const useMailsCardView = (): boolean => useSelector(selectMailsCardView);
