import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Badge, type BadgeProps } from "./Badge";
import type { Tone } from "./tone";

export type StatusBadgeProps = Omit<BadgeProps, "tone" | "children" | "icon" | "dot"> & {
  /** Holat ma'nosi: yangi — info, jarayonda — warning, bajarildi — success, bekor/xato — danger, yopilgan — neutral. */
  tone: Tone;
  /** Holat so'zi (tarjima qilingan). */
  label: ReactNode;
  /** Ikonka. Berilmasa — holat nuqtasi (`.el-badge-dot`). */
  icon?: LucideIcon;
};

/**
 * HOLAT BELGISI — holat har doim rang + so'z + (nuqta yoki ikonka) bilan
 * beriladi, faqat rang bilan emas (`docs/DESIGN_SYSTEM.md` §2, §8).
 *
 * Maketda holat — nuqtali belgi (`el-badge el-badge-dot` + ton,
 * `tizim-states-data` «Holat belgilari»); ikonka berilsa nuqta o'rnini oladi.
 * Domen holatlari o'z registridan foydalanadi (buyurtma: `entities/order` →
 * `OrderStatusBadge`), bu komponent faqat ko'rinish.
 */
export const StatusBadge = ({ tone, label, icon, ...rest }: StatusBadgeProps) => (
  <Badge tone={tone} icon={icon} dot={!icon} {...rest}>
    {label}
  </Badge>
);
