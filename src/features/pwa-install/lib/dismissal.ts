/**
 * Bosh sahifadagi bir martalik taklif yopilgani (KI-S3: «bosh sahifada bir marta», shu qurilmada). Saqlash
 * bloklangan bo'lsa (xususiy rejim) — xato yutiladi: taklif yopiladi, lekin keyingi ochilishda qaytishi mumkin.
 */
export const DASHBOARD_DISMISS_KEY = "elchi:pwa-install:dashboard-dismissed";

export const readDashboardDismissed = (): boolean => {
  try {
    return window.localStorage.getItem(DASHBOARD_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
};

export const writeDashboardDismissed = () => {
  try {
    window.localStorage.setItem(DASHBOARD_DISMISS_KEY, "1");
  } catch {
    // Saqlab bo'lmadi — shu ochilish uchun komponent holatida yopiladi.
  }
};
