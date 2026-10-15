/**
 * DIZAYN v2 PRIMITIVLARI — yagona import nuqtasi (1-bosqich).
 *
 *   import { Button, Card, PageHeader, StatusBadge } from "../../shared/ui/primitives";
 *
 * Qaysi primitiv qaysi maket blokiga mos — `design/CODE-MAP.md` («1-bosqich primitivi» ustuni).
 * Faqat nomli eksportlar. Buyurtma holati badge'i (`OrderStatusBadge`) bu yerda YO'Q —
 * u `entities/order` da (shared qatlam entities'ni bilmaydi, FSD).
 */

export { TONES, TONE_FG, TONE_RING, TONE_SOFT, TONE_SOLID } from "./tone";
export type { Tone } from "./tone";

export { Button, ButtonIcon, buttonClasses } from "./Button";
export type {
  ButtonClassOptions,
  ButtonIconProps,
  ButtonProps,
  ButtonSize,
  ButtonVariant,
  IconPx,
  IconSlot,
} from "./Button";

export { IconButton } from "./IconButton";
export type { IconButtonProps, IconButtonVariant } from "./IconButton";

export { Spinner } from "./Spinner";
export type { SpinnerProps, SpinnerSize } from "./Spinner";

export { Badge } from "./Badge";
export type { BadgeProps, BadgeSize, BadgeVariant } from "./Badge";

export { StatusBadge } from "./StatusBadge";
export type { StatusBadgeProps } from "./StatusBadge";

export { Card } from "./Card";
export type { CardPadding, CardProps, CardVariant } from "./Card";

export { StatCard } from "./StatCard";
export type { StatCardGoodWhen, StatCardProps } from "./StatCard";

export { PageHeader } from "./PageHeader";
export type { PageHeaderBack, PageHeaderProps } from "./PageHeader";

export { Tabs, getPanelId, getTabId } from "./Tabs";
export type { TabItem, TabsBackground, TabsProps } from "./Tabs";

export { SegmentedControl } from "./SegmentedControl";
export type { SegmentedControlProps, SegmentedControlSize, SegmentedOption } from "./SegmentedControl";
