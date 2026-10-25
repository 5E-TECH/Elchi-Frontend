// dizayn-v2: tizim-errors
import type { ReactNode } from "react";
import ErrorBoundary, { type ErrorBoundaryFallbackProps } from "./ErrorBoundary";
import { Card, ErrorState } from "./primitives";

/**
 * BO'LIM XATO CHEGARASI (QKCeGZ3N, taxta `tizim-errors` 02 «Bo'lim xatosi»): bitta karta / grafik / KPI yiqilsa —
 * faqat uning o'rnida «Bu bo'limni ochishda xatolik yuz berdi · Boshqa bo'limlar ishlashda davom etadi» va
 * «Qayta urinish»; sahifaning qolgan qismi ishlayveradi. Xatosiz holatda DOM qo'shmaydi (to'r selektorlari
 * `[&>*:last-child]` o'zgarmaydi).
 */
const renderSectionError = ({ reset }: ErrorBoundaryFallbackProps) => (
  <Card>
    <ErrorState kind="section" onRetry={reset} />
  </Card>
);

const SectionErrorBoundary = ({ children }: { children: ReactNode }) => (
  <ErrorBoundary record={false} fallbackRender={renderSectionError}>
    {children}
  </ErrorBoundary>
);

export default SectionErrorBoundary;
