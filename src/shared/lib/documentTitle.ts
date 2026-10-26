import { useEffect, useSyncExternalStore } from "react";

/**
 * SAHIFA SARLAVHASI (WuVeVZqo) — brauzer yorlig'i va tarixda «Buyurtmalar — Elchi Pochta». Manba — sahifaning
 * `PageHeader` i (har v2 sahifada bitta `<h1>`): alohida marshrut xaritasi kerak emas, til almashsa o'zi yangilanadi.
 * Shell shu nomni bo'lim almashganda skrin-riderga e'lon qiladi (`widgets/layout/ui/RouteAnnouncer`).
 */
const APP_NAME = "Elchi Pochta";
/** `index.html` dagi sarlavha — sahifa o'z nomini bermaganda (kirish, yuklanish). */
const DEFAULT_TITLE = (typeof document !== "undefined" && document.title) || APP_NAME;

let pageTitle: string | null = null;
const listeners = new Set<() => void>();

export const formatDocumentTitle = (page: string) => `${page} — ${APP_NAME}`;

const setPageTitle = (next: string | null) => {
  if (pageTitle === next) return;
  pageTitle = next;
  document.title = next ? formatDocumentTitle(next) : DEFAULT_TITLE;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Sahifa nomini brauzer sarlavhasiga yozadi; sahifa yopilsa — ilova sukuti (keyingi sahifa o'zinikini yozadi). */
export const useDocumentTitle = (page: string | null | undefined) => {
  const value = page?.trim() || null;
  useEffect(() => {
    if (!value) return undefined;
    setPageTitle(value);
    return () => {
      if (pageTitle === value) setPageTitle(null);
    };
  }, [value]);
};

/** Joriy sahifa nomi (`useDocumentTitle` yozgan) — shell e'loni uchun. */
export const usePageTitle = () =>
  useSyncExternalStore(
    subscribe,
    () => pageTitle,
    () => null,
  );
