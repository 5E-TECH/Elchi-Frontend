import { Component, type ErrorInfo, type ReactNode } from "react";
import {
  getCurrentAppPath,
  RUNTIME_ERROR_PATH,
  saveRuntimeError,
} from "../lib/runtimeError";

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
      return null;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
