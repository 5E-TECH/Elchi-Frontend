import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";
import { isBrowserOffline, isChunkLoadError, reloadForNewVersion } from "../lib/chunkError";
import { ErrorState } from "./primitives";
import {
  getCurrentAppPath,
  getRuntimeError,
  RUNTIME_ERROR_PATH,
  saveRuntimeError,
  type RuntimeErrorPayload,
} from "../lib/runtimeError";

/** `fallbackRender` ga beriladi: saqlangan xato yozuvi (kod, takror hisobi) va chegarani tozalab qayta chizish. */
export type ErrorBoundaryFallbackProps = { error: RuntimeErrorPayload; reset: () => void };

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
  /**
   * QKCeGZ3N — joyida ko'rsatish: xato yozuvi saqlanadi (kod, takror hisobi — `/runtime-error` dagidek), lekin
   * boshqa sahifaga ham, to'liq qayta yuklash ham YO'Q — chegara o'rnida shu chiziladi. Shell kontent zonasi
   * (`dashboardLayout.tsx` — yon menyu, yuqori panel va ochiq formalar joyida qoladi) va dashboard bo'limlari
   * (`SectionErrorBoundary`). `reset` — bolalarni qayta chizish («Qayta urinish»).
   */
  fallbackRender?: (props: ErrorBoundaryFallbackProps) => ReactNode;
  /**
   * Xato yozuvini saqlash (`sessionStorage`, kod va takror hisobi uchun). Sukut — ha; bo'lim chegarasi
   * (`SectionErrorBoundary`) saqlamaydi — bitta karta xatosi sahifa xatosining takror hisobiga qo'shilmasin.
   */
  record?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  /** Oflaynda bo'lim fayli yuklanmadi (G6F68ti6, 6-band) — «Internet aloqasi yo'q», aloqa qaytgach qayta yuklash. */
  chunkOffline?: boolean;
  /** Onlayn chunk xatosi — yangi versiya uchun sahifa qayta yuklanmoqda (bo'sh ekran bir lahza). */
  reloading?: boolean;
  resetKey?: string;
  /** `fallbackRender` rejimida — saqlangan xato yozuvi. */
  inlineError?: RuntimeErrorPayload;
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
 * Ilova xato chegarasi. Turadigan joylari: `App.tsx` (provayderlar atrofida, global), `routes.tsx` → `AppRouter`
 * (route'lar atrofida, `fallback` + `resetKey` bilan — xato sahifasida shell yiqilsa shell'siz nusxa), shell kontent
 * zonasi (`dashboardLayout.tsx`, `fallbackRender` — sahifa yiqilsa menyu joyida, QKCeGZ3N) va dashboard bo'limlari
 * (`SectionErrorBoundary`).
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
      : { hasError: false, chunkOffline: false, reloading: false, inlineError: undefined, resetKey: props.resetKey };
  }

  /** «Qayta urinish» (`fallbackRender`): bolalar qayta chiziladi; yana yiqilsa takror hisobi oshadi. */
  private reset = () => {
    this.setState({ hasError: false, chunkOffline: false, reloading: false, inlineError: undefined });
  };

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // QKCeGZ3N (4-band): prod'da ham konsolda — foydalanuvchi xato kodini aytganda tashxis uchun.
    console.error("ErrorBoundary xatoligi:", error, errorInfo);

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
    if (this.props.fallback !== undefined && !this.props.fallbackRender) return;

    const payload: RuntimeErrorPayload = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      sourcePath: getCurrentAppPath(),
      occurredAt: new Date().toISOString(),
    };
    const record = this.props.record !== false;
    if (record) {
      try {
        saveRuntimeError(payload);
      } catch {
        // Ignore storage failures and still try to navigate to the runtime error page.
      }
    }

    // Joyida ko'rsatish (QKCeGZ3N): shell va boshqa bo'limlar joyida, to'liq qayta yuklash yo'q.
    if (this.props.fallbackRender) {
      const saved = record ? getRuntimeError() : null;
      this.setState({ inlineError: saved && saved.sourcePath === payload.sourcePath ? saved : payload });
      return;
    }

    if (typeof window !== "undefined" && window.location.pathname !== RUNTIME_ERROR_PATH) {
      window.location.replace(RUNTIME_ERROR_PATH);
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.state.chunkOffline) return <ChunkOfflineState />;
      if (this.state.reloading) return null;
      if (this.props.fallbackRender) {
        // Yozuv `componentDidCatch` da (commit bosqichi) saqlanadi va shu zahoti qayta chiziladi — bo'yashdan oldin,
        // shuning uchun oraliq `null` ko'rinmaydi (takroriy xatoda «Qayta urinish» chaqnab qolmasin).
        return this.state.inlineError
          ? this.props.fallbackRender({ error: this.state.inlineError, reset: this.reset })
          : null;
      }
      return this.props.fallback ?? null;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
