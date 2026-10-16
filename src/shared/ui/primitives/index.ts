/**
 * DIZAYN v2 PRIMITIVLARI — yagona import nuqtasi (1-bosqich; 3-bosqich: forma, overlay, holatlar).
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

// ── 3-bosqich: forma, overlay, holatlar ──────────────────────────────────────

export { Field } from "./Field";
export type { FieldProps } from "./Field";
export { FieldContext, useFieldContext, useFieldControl } from "./fieldContext";
export type { FieldContextValue, FieldControlOverrides, FieldControlProps } from "./fieldContext";

export { TextInput } from "./TextInput";
export type { TextAreaFieldProps, TextInputFieldProps, TextInputMode, TextInputProps, TextInputSize } from "./TextInput";

export { Skeleton } from "./Skeleton";
export type { SkeletonProps, SkeletonShape, SkeletonTone } from "./Skeleton";

// Tanlash ro'yxati: oddiy, qidiruvli, ko'p tanlovli (WAI-ARIA combobox + listbox).
export { Select } from "./Select";
export type {
  MultiSelectProps,
  SelectOption,
  SelectOptionState,
  SelectProps,
  SelectSize,
  SingleSelectProps,
} from "./Select";

// Sana: kalendar, sana oralig'i (tez tanlov + ikki oy), bitta sana.
export { Calendar } from "./Calendar";
export type { CalendarMode, CalendarProps } from "./Calendar";
export { DateRange, DateRangePanel } from "./DateRange";
export type { DatePresetKey, DateRangeChangeSource, DateRangePanelProps, DateRangeProps } from "./DateRange";
export { DateInput } from "./DateInput";
export type { DateInputProps } from "./DateInput";

// Overlay infratuzilmasi (Select, DateRange, Dialog, Toaster shu ustida) — `./overlay/index.ts`.
export {
  assignRefs,
  computePopoverPosition,
  getFocusableElements,
  getPortalRoot,
  getStackingZ,
  inertOthers,
  isInUiLayer,
  isTopLayer,
  LAYER_ATTR,
  PORTAL_ROOT_ID,
  Portal,
  pushLayer,
  readShellBottomInset,
  removeLayer,
  SHELL_BOTTOM_INSET_VAR,
  useDismiss,
  useFocusTrap,
  useInertOthers,
  useMergedRefs,
  useParentLayerZ,
  usePopover,
  useScrollLock,
  useShellBottomInsetSource,
  writeShellBottomInset,
  Z_LAYERS,
} from "./overlay";
export type {
  DismissReason,
  FocusTrapOptions,
  PopoverAlign,
  PopoverPlacement,
  PopoverPosition,
  PopoverPositionInput,
  PopoverSide,
  PortalLayer,
  PortalProps,
  UseDismissOptions,
  UsePopoverOptions,
  UsePopoverResult,
} from "./overlay";

// Oyna, tasdiqlash oynasi (`useConfirm`), yopilish harakati.
export { Dialog, DialogPanel } from "./Dialog";
export type {
  DialogCloseReason,
  DialogIconShape,
  DialogLayout,
  DialogPanelProps,
  DialogProps,
  DialogSize,
} from "./Dialog";
export { ConfirmDialog, ConfirmDialogPanel } from "./ConfirmDialog";
export type {
  ConfirmAmount,
  ConfirmConsequence,
  ConfirmContent,
  ConfirmDialogPanelProps,
  ConfirmDialogProps,
  ConfirmParty,
  ConfirmRow,
  ConfirmTone,
  ConfirmTransfer,
} from "./ConfirmDialog";
export { confirm, useConfirm } from "./useConfirm";
export type { ConfirmOptions } from "./useConfirm";
export { canAnimateExit, usePresence } from "./usePresence";
export type { Presence, PresenceOptions } from "./usePresence";

// Global qatlamlar manzili (`app/providers/UiHost.tsx`): dialog va feedback quruvchilari to'ldiradi.
export { ConfirmHost } from "./ConfirmHost";
// Xabar chiqarish — `notify` (`src/shared/lib/notify.ts`, React'dan tashqarida ham); bu yerda faqat ko'rinish.
export { Toast, Toaster } from "./Toaster";
export type { ToastProps } from "./Toaster";

// Holatlar: bo'sh, xato, yuklanish (skelet) va ularni bitta so'rov uchun yig'uvchi `QueryBoundary`.
export { EmptyState, StateIcon } from "./EmptyState";
export type { EmptyStateProps, StateSize, StateTone } from "./EmptyState";
export { ErrorState } from "./ErrorState";
export type { ErrorStateProps } from "./ErrorState";
export type { ErrorKind } from "../../lib/errorKind";
export { SkeletonChart, SkeletonLines, SkeletonList, SkeletonTable, SlowLoadingHint } from "./SkeletonPresets";
export type { SkeletonChartProps, SkeletonLinesProps, SkeletonListProps, SkeletonTableProps } from "./SkeletonPresets";
export { SKELETON_DELAY_MS, SLOW_LOADING_MS, useDelayedFlag, useLoadingPhase } from "./useLoadingPhase";
export type { LoadingPhaseOptions } from "./useLoadingPhase";
export { QueryBoundary } from "./QueryBoundary";
export type { QueryBoundaryProps, QueryBoundarySkeleton, QueryBoundaryState, QueryLike } from "./QueryBoundary";
