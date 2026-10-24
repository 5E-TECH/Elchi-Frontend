// dizayn-v2: (maket yo'q) superadmin-ops-investors
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { EXPENSE_CATEGORIES_TAB } from "../ops/tabs";
import { OpsIntro, OpsToolPage } from "../ops/ui/OpsToolPage";
import ExpenseCategoriesPanel from "./ui/ExpenseCategoriesPanel";

/**
 * OPS → «Xarajat kategoriyalari» (`/ops?tab=expense-categories`; faqat superadmin). Kassa xarajati kategoriyalari
 * sozlamasi ilgari «To'lovlar → Asosiy kassa» sarlavhasidagi tugmadan ochiladigan oyna edi — 2026-10-23 da
 * sozlama sifatida Ops vositalariga, moliya guruhiga («Moliya operatorlari» dan keyin) ko'chirildi. Eski
 * to'g'ridan-to'g'ri yo'li yo'q — faqat hub ichida (`embedded`); «Kassadan xarajat» oynasidagi «Xarajat
 * kategoriyalari» havolasi (faol kategoriya yo'q holati, superadmin) shu tabga olib keladi.
 *
 * Tuzilma — boshqa Ops tablari kabi: kirish kartasi (`OpsIntro`) + bo'lim kartasi (`ExpenseCategoriesPanel`).
 * Maket yo'q — eng yaqini `superadmin-ops-investors` (ro'yxat kartasi + qo'shish).
 */
const ExpenseCategoriesOpsPage = ({ embedded = false }: { embedded?: boolean }) => {
  const { t } = useTranslation("ops");
  return (
    <OpsToolPage tabKey={EXPENSE_CATEGORIES_TAB} embedded={embedded}>
      <OpsIntro title={t("expenseCategories.intro.title")} description={t("expenseCategories.intro.description")} />
      <ExpenseCategoriesPanel />
    </OpsToolPage>
  );
};

export default memo(ExpenseCategoriesOpsPage);
