import { useEffect, useState } from "react";

type OrderDetailAccessRules = typeof import("../../new_orders/components/detail/orderDetailAccess");

/**
 * Buyurtma tafsilotining ruxsat qoidalari (`getOrderDetailAccess` …) — FAQAT menejerga, kerak bo'lganda
 * yuklanadi. Modul `features/order-return` barreli orqali qaytarish oynalarini (kamera skaneri bilan) o'ziga
 * tortadi; statik import bo'lsa kuryer telefoni ham ularni yuklardi (spec G3 §8 «Scan chunk weight»).
 * Yuklanguncha `null`.
 */
export const useOrderDetailAccessRules = (enabled: boolean): OrderDetailAccessRules | null => {
  const [rules, setRules] = useState<OrderDetailAccessRules | null>(null);

  useEffect(() => {
    if (!enabled || rules) return undefined;
    let alive = true;
    void import("../../new_orders/components/detail/orderDetailAccess").then((module) => {
      if (alive) setRules(module);
    });
    return () => {
      alive = false;
    };
  }, [enabled, rules]);

  return enabled ? rules : null;
};
