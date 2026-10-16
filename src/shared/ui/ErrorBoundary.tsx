import { Component, type ErrorInfo, type ReactNode } from "react";
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
  resetKey?: string;
}

/**
 * Ilova xato chegarasi. Ikki joyda turadi: `App.tsx` (provayderlar atrofida, global) va `routes.tsx` → `AppRouter`
 * (route'lar atrofida, `fallback` + `resetKey` bilan — xato sahifasida shell yiqilsa shell'siz nusxa).
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    resetKey: this.props.resetKey,
  };

  public static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  public static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    return props.resetKey === state.resetKey ? null : { hasError: false, resetKey: props.resetKey };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("ErrorBoundary xatoligi:", error, errorInfo);
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
      return this.props.fallback ?? null;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
