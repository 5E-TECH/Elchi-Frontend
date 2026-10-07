import { Component, type ErrorInfo, type ReactNode } from "react";

interface InlineErrorBoundaryProps {
  children: ReactNode;
}

interface InlineErrorBoundaryState {
  hasError: boolean;
}

/**
 * Bitta bo'limning xatosini o'sha bo'lim ichida ushlaydi.
 *
 * Ildizdagi ErrorBoundary har qanday xatoda butun ilovani /runtime-error ga
 * otadi. Bu esa xatoni joyida ko'rsatadi — qolgan sahifa (menyu, boshqa tablar)
 * ishlashda davom etadi. Boshqa bo'limga o'tishda holatni tozalash uchun
 * chaqiruvchi `key` beradi.
 */
class InlineErrorBoundary extends Component<InlineErrorBoundaryProps, InlineErrorBoundaryState> {
  public state: InlineErrorBoundaryState = {
    hasError: false,
  };

  public static getDerivedStateFromError(): InlineErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("Bo'lim xatoligi:", error, errorInfo);
    }
  }

  private retry = () => {
    this.setState({ hasError: false });
  };

  public render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        className="flex min-h-[220px] flex-col items-center justify-center gap-3 p-6 text-center"
      >
        <p className="m-0 text-base font-bold text-maindark dark:text-white">
          Bu bo'limni ochishda xatolik yuz berdi
        </p>
        <p className="m-0 text-sm text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
          Boshqa bo'limlar ishlashda davom etadi.
        </p>
        <button
          type="button"
          onClick={this.retry}
          className="rounded-full border border-main px-4 py-2 text-sm font-semibold text-main transition-colors hover:bg-main hover:text-white"
        >
          Qayta urinish
        </button>
      </div>
    );
  }
}

export default InlineErrorBoundary;
