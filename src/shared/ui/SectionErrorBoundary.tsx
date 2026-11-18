// dizayn-v2: tizim-errors
import { notifyManager, QueryClientContext, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import ErrorBoundary, { type ErrorBoundaryFallbackProps } from "./ErrorBoundary";
import { Card, ErrorState } from "./primitives";

const NO_QUERY_KEYS: readonly QueryKey[] = [];
const SectionQueryKeysContext = createContext<readonly QueryKey[]>(NO_QUERY_KEYS);

/**
 * Sahifa sukuti (QKCeGZ3N): ichidagi `queryKeys` siz bo'lim chegaralari — dashboard to'rlari (`KpiRow`, `CardRow`)
 * bolalari ham — «Qayta urinish»da shu so'rovlarni qayta yuboradi (odatda sahifaning asosiy so'rovi). DOM qo'shmaydi.
 */
export const SectionRetryScope = ({
  queryKeys,
  children,
}: {
  queryKeys: readonly QueryKey[];
  children: ReactNode;
}) => <SectionQueryKeysContext.Provider value={queryKeys}>{children}</SectionQueryKeysContext.Provider>;

/**
 * «Qayta urinish»: bo'lim so'rovlari keshdan tozalanadi (kalit prefiksi bo'yicha) — faollari (ota komponent kuzatadi)
 * darhol qayta yuboriladi, yiqilgan bo'limning o'zinikilar (u yechilgani uchun nofaol) bo'lim qayta chizilganda
 * yangidan so'raladi; so'ng chegara tozalanadi. Aks holda bo'lim keshdagi o'sha buzilgan javob bilan qayta chizilib,
 * yana yiqilardi. Chegara kesh o'zgarishi kuzatuvchilarga yetgach (react-query navbati, o'sha bitta chizishda)
 * tozalanadi — bo'lim otaning eski props'i bilan emas, tozalangan holat bilan chiziladi.
 */
const retrySection = (client: QueryClient | undefined, keys: readonly QueryKey[], reset: () => void) => {
  if (!client || keys.length === 0) {
    reset();
    return;
  }
  notifyManager.batch(() => {
    for (const queryKey of keys) void client.resetQueries({ queryKey });
    notifyManager.schedule(reset);
  });
};

type SectionErrorBoundaryProps = {
  children: ReactNode;
  /**
   * «Qayta urinish»da qayta yuboriladigan so'rovlar (kalit prefikslari, masalan `[REVENUE_QUERY_KEY]`). Berilmasa —
   * eng yaqin `SectionRetryScope` dagisi; u ham bo'lmasa — faqat qayta chiziladi.
   */
  queryKeys?: readonly QueryKey[];
  /** Xato kartasining to'rdagi joyi (masalan `lg:col-span-2`) — o'rnidagi karta egallagan joy saqlansin. */
  className?: string;
};

/**
 * BO'LIM XATO CHEGARASI (QKCeGZ3N, taxta `tizim-errors` 02 «Bo'lim xatosi»): bitta karta / grafik / KPI yiqilsa —
 * faqat uning o'rnida «Bu bo'limni ochishda xatolik yuz berdi · Boshqa bo'limlar ishlashda davom etadi» va
 * «Qayta urinish»; sahifaning qolgan qismi ishlayveradi. «Qayta urinish» — bo'lim so'rovlari qayta yuboriladi
 * (`queryKeys` / `SectionRetryScope`) va bo'lim qayta chiziladi: javob tuzalgan bo'lsa, bo'lim tiklanadi.
 * Xatosiz holatda DOM qo'shmaydi (to'r selektorlari `[&>*:last-child]` o'zgarmaydi).
 */
const SectionErrorBoundary = ({ children, queryKeys, className }: SectionErrorBoundaryProps) => {
  const client = useContext(QueryClientContext);
  const scopeKeys = useContext(SectionQueryKeysContext);
  const keys = queryKeys ?? scopeKeys;
  const renderSectionError = ({ reset }: ErrorBoundaryFallbackProps) => (
    <Card className={className}>
      <ErrorState kind="section" onRetry={() => retrySection(client, keys, reset)} />
    </Card>
  );
  return (
    <ErrorBoundary record={false} fallbackRender={renderSectionError}>
      {children}
    </ErrorBoundary>
  );
};

export default SectionErrorBoundary;
