import { useSelector } from "react-redux";
import { useOrderIntake } from "../../entities/order-intake";
import type { RootState } from "../config/store";

/**
 * BusinessDaySync (xhiXv3w3) — kirgan foydalanuvchi uchun «Kun tartibi» holatini (`GET orders/intake-settings`,
 * umumiy kesh `ORDER_INTAKE_KEY`) yuklab turadi: undagi ish kuni jadvali `shared/lib/businessDay` ga yoziladi va
 * butun ilovadagi sana tanlagichlar «Bugun / Hafta / Oy» ni ISH KUNI bo'yicha hisoblaydi. UI render qilmaydi.
 */
const BusinessDaySync = () => {
  const isAuthenticated = useSelector((state: RootState) => state.user.isAuthenticated);
  useOrderIntake({ enabled: isAuthenticated });
  return null;
};

export default BusinessDaySync;
