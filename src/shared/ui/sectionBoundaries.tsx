import { Children, isValidElement, type ReactNode } from "react";
import SectionErrorBoundary from "./SectionErrorBoundary";

/** Har bir bolani alohida chegaraga o'raydi (dashboard to'rlari — `KpiRow`, `CardRow`). Kalitlar saqlanadi. */
export const withSectionBoundaries = (children: ReactNode) =>
  Children.map(children, (child) =>
    isValidElement(child) ? <SectionErrorBoundary key={child.key ?? undefined}>{child}</SectionErrorBoundary> : child,
  );
