import { Children, Fragment, isValidElement, type ReactNode } from "react";
import SectionErrorBoundary from "./SectionErrorBoundary";

/**
 * Har bir bolani alohida chegaraga o'raydi (dashboard to'rlari — `KpiRow`, `CardRow`). Kalitlar saqlanadi.
 * Fragment (`<><SuccessRateCard /><OrderStatusCard /></>`) ochiladi — undagi har karta ham o'z chegarasida, bittasi
 * yiqilsa yonidagisi qoladi (QKCeGZ3N).
 */
export const withSectionBoundaries = (children: ReactNode): ReactNode =>
  Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    if (child.type === Fragment) return withSectionBoundaries((child.props as { children?: ReactNode }).children);
    return <SectionErrorBoundary key={child.key ?? undefined}>{child}</SectionErrorBoundary>;
  });
