// dizayn-v2: (maket yo'q) superadmin-neworders-markets
import { memo } from "react";
import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import type { RootState } from "../../../app/config/store";
import { useOrderIntake } from "../../../entities/order-intake";
import { buttonClasses, StatusBadge } from "../../../shared/ui/primitives";
import { DAILY_SCHEDULE_TAB, opsTabPath } from "../../ops/tabs";

/**
 * «Qabul va yaratish» sarlavhasida BUGUNGI QABUL VAQTI (2026-11-08). Maket yo'q — eng yaqini
 * `superadmin-neworders-markets` sarlavhasi (ikkinchi darajali amal asosiy «Buyurtma yaratish» yonida).
 *   - superadmin: «Bugungi qabul: 10:00 gacha» havolasi → Ops → «Kun tartibi» (`/ops?tab=daily-schedule`; ega
 *     2026-11-10 — yaratish va qabul chegaralari, kun almashishi, smena jadvali endi o'sha yerda; ilgari shu yerdagi
 *     oyna edi);
 *   - qolgan rollar (admin ham): cheklov bo'lsa — holat belgisi («… gacha» / «yopildi»), cheklovsizda hech narsa.
 * Backend endpointi yo'q bo'lsa (`supported: false`) — umuman ko'rinmaydi (`entities/order-intake/model.ts`).
 */
const OrderIntakeControl = () => {
  const { t } = useTranslation("newOrders");
  const role = useSelector((state: RootState) => state.role.role);
  const canManage = role === "superadmin";
  const intake = useOrderIntake();

  if (!intake.supported) return null;

  const label = intake.closed
    ? t("intake.closed")
    : intake.cutoffTime
      ? t("intake.until", { time: intake.cutoffTime })
      : t("intake.unlimited");

  if (!canManage) {
    if (!intake.cutoffTime) return null;
    return (
      <StatusBadge
        tone={intake.closed ? "danger" : "info"}
        icon={Clock}
        label={label}
        data-testid="order-intake-status"
      />
    );
  }

  return (
    <Link
      to={opsTabPath(DAILY_SCHEDULE_TAB)}
      className={buttonClasses({ variant: "secondary" })}
      aria-label={`${label}. ${t("intake.change")}`}
      data-testid="order-intake-control"
    >
      {/* `Button` bilan bir xil ichki tuzilma: ikonka 18, yorliq qisqaradi (ilgari shu yerda tugma edi). */}
      <Clock aria-hidden="true" focusable="false" size={18} strokeWidth={2} className="shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  );
};

export default memo(OrderIntakeControl);
