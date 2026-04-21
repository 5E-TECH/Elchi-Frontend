import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
  };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Global ErrorBoundary xatoligi:", error, errorInfo);

    try {
      const payload = JSON.stringify({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });

      window.sessionStorage.setItem("elchi_runtime_error", payload);
    } catch {
      // Ignore storage failures and still try to navigate to the runtime error page.
    }

    if (typeof window !== "undefined" && window.location.pathname !== "/runtime-error") {
      window.location.replace("/runtime-error");
    }
  }

  public render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
