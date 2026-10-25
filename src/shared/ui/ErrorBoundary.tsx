import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";
import { isBrowserOffline, isChunkLoadError, reloadForNewVersion } from "../lib/chunkError";
import { ErrorState } from "./primitives";
import {
  getCurrentAppPath,
  RUNTIME_ERROR_PATH,
  saveRuntimeError,
} from "../lib/runtimeError";

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Zaxira ko'rinish — faqat xato sahifasida (403 · 404 · 500 · ilova xatosi) beriladi (`routes.tsx` → `AppRouter`):
   * o'sha sahifaning shell'siz (butun ekran) nusxasi. Shell (yon menyu, yuqori panel) yoki sahifaning o'zi
   * yiqilsa, foydalanuvchi bo'sh ekran o'rniga shu sahifani ko'radi; xato saqlanmaydi va `/runtime-error` ga
   * o'tilmaydi (ilova xatosi sahifasida asl xato yozuvi va «Qayta urinish» manzili o'zgarmay qoladi).
   * Berilmasa — odatdagi yo'l: xato saqlanadi va `/runtime-error` ga to'liq qayta yuklash bilan o'tiladi.
   */
  fallback?: ReactNode;
  /**
   * O'zgarsa (masalan yo'l), xato holati tozalanadi va bolalar qayta chiziladi — zaxira sahifadan boshqa bo'limga
   * o'tilganda chegara o'sha holatda qotib qolmaydi.
   */
  resetKey?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  /** Oflaynda bo'lim fayli yuklanmadi (G6F68ti6, 6-band) — «Internet aloqasi yo'q», aloqa qaytgach qayta yuklash. */
  chunkOffline?: boolean;
  /** Onlayn chunk xatosi — yangi versiya uchun sahifa qayta yuklanmoqda (bo'sh ekran bir lahza). */
  reloading?: boolean;
  resetKey?: string;
}

/** Bo'lim fayli oflaynda yuklanmadi: butun ekran holati; aloqa qaytsa (yoki «Qayta urinish») — sahifa qayta yuklanadi. */
const ChunkOfflineState = () => {
  useEffect(() => {
    const reload = () => window.location.reload();
    window.addEventListener("online", reload);
    return () => window.removeEventListener("online", reload);
  }, []);
  return <ErrorState size="page" kind="offline" onRetry={() => window.location.reload()} />;
};

/**
 * Ilova xato chegarasi. Ikki joyda turadi: `App.tsx` (provayderlar atrofida, global) va `routes.tsx` → `AppRouter`
 * (route'lar atrofida, `fallback` + `resetKey` bilan — xato sahifasida shell yiqilsa shell'siz nusxa).
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    resetKey: this.props.resetKey,
  };

  public static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    const chunk = isChunkLoadError(error);
    return { hasError: true, chunkOffline: chunk && isBrowserOffline(), reloading: false };
  }

  public static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    return props.resetKey === state.resetKey
      ? null
      : { hasError: false, chunkOffline: false, reloading: false, resetKey: props.resetKey };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("ErrorBoundary xatoligi:", error, errorInfo);
    }

    // Bo'lim fayli yuklanmadi (deploy'dan keyingi eski tab yoki internet yo'q) — kod xatosi emas: «Ilova xatosi»
    // yozilmaydi. Oflayn — «Internet aloqasi yo'q» (render), onlayn — yangi versiya uchun bir marta qayta yuklash;
    // yaqinda allaqachon qayta yuklangan bo'lsa — odatdagi yo'l (G6F68ti6, 6-band).
    if (isChunkLoadError(error)) {
      if (this.state.chunkOffline) return;
      if (reloadForNewVersion()) {
        this.setState({ reloading: true });
        return;
      }
    }

    // Xato sahifasining o'zida yiqildi — zaxira (shell'siz nusxa) chiziladi, boshqa joyga o'tilmaydi.
    if (this.props.fallback !== undefined) return;

    try {
      saveRuntimeError({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        sourcePath: getCurrentAppPath(),
        occurredAt: new Date().toISOString(),
      });
    } catch {
      // Ignore storage failures and still try to navigate to the runtime error page.
    }

    if (typeof window !== "undefined" && window.location.pathname !== RUNTIME_ERROR_PATH) {
      window.location.replace(RUNTIME_ERROR_PATH);
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.state.chunkOffline) return <ChunkOfflineState />;
      if (this.state.reloading) return null;
      return this.props.fallback ?? null;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
