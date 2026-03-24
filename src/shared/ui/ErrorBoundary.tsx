import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";
import logo from "../assets/logoowhite.png";

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
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden px-4 py-8 text-primary animate-loader-in"
          style={{
            background:
              "linear-gradient(135deg, var(--color-background) 0%, var(--color-maindark) 52%, var(--color-purple-dark) 100%)",
          }}
        >
          <div className="absolute inset-0 overflow-hidden pointer-events-none animate-aurora">
            <div
              className="absolute top-[-12%] left-[-8%] h-[28rem] w-[28rem] rounded-full opacity-20 blur-[120px]"
              style={{ background: "var(--color-main)" }}
            />
            <div
              className="absolute right-[-10%] bottom-[-14%] h-[30rem] w-[30rem] rounded-full opacity-18 blur-[130px]"
              style={{ background: "var(--color-purple)" }}
            />
            {[...Array(14)].map((_, index) => (
              <div
                key={index}
                className="absolute h-1 w-1 rounded-full bg-primary animate-float-particle"
                style={{
                  top: `${((index * 13) % 90) + 4}%`,
                  left: `${((index * 19) % 88) + 6}%`,
                  animationDelay: `${index * 0.22}s`,
                  opacity: 0.18 + (index % 4) * 0.07,
                }}
              />
            ))}
          </div>

          <div className="relative flex items-center justify-center">
            <div
              className="absolute animate-spin-ring"
              style={{
                width: "22rem",
                height: "22rem",
                borderRadius: "9999px",
                background:
                  "conic-gradient(from 0deg, transparent, var(--color-main), transparent)",
                padding: "2px",
                maskImage:
                  "radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))",
                WebkitMaskImage:
                  "radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))",
                opacity: 0.38,
              }}
            />

            <div
              className="absolute animate-spin-ring-rev"
              style={{
                width: "18.5rem",
                height: "18.5rem",
                borderRadius: "9999px",
                border: "2px dashed var(--color-purple-light)",
                opacity: 0.22,
              }}
            />

            <div
              className="absolute animate-spin-ring-slow"
              style={{
                width: "15.5rem",
                height: "15.5rem",
                borderRadius: "9999px",
                background:
                  "linear-gradient(to right, var(--color-main), var(--color-purple))",
                padding: "3px",
                maskImage:
                  "radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))",
                WebkitMaskImage:
                  "radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))",
                filter: "blur(1px)",
              }}
            />

            <div
              className="relative z-10 flex h-52 w-52 items-center justify-center rounded-full animate-pulse-glow animate-logo-reveal"
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                backdropFilter: "blur(18px)",
                border: "1px solid var(--color-glass-border)",
                boxShadow:
                  "0 0 80px rgba(87, 106, 219, 0.28), inset 0 0 30px rgba(255, 255, 255, 0.05)",
              }}
            >
              <div className="absolute inset-4 rounded-full border border-primary/10" />
              <img
                src={logo}
                alt="Elchi Logo"
                className="h-24 w-24 object-contain drop-shadow-[0_0_16px_rgba(255,255,255,0.35)]"
                draggable={false}
              />
              <div className="error-boundary-icon-shell absolute -right-1 top-7 flex h-14 w-14 items-center justify-center rounded-2xl text-primary">
                <ShieldAlert size={24} strokeWidth={2.2} />
              </div>
            </div>
          </div>

          <div className="mt-14 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.38em] text-primary/45">
              Emergency Fallback
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-[0.18em] uppercase sm:text-5xl">
              Elchi
            </h1>
            <div className="mt-3 flex items-center justify-center gap-3">
              <div className="h-px w-8 bg-gradient-to-r from-transparent to-primary/25" />
              <p className="text-xs font-medium uppercase tracking-[0.32em] text-primary/45">
                Pochta Xizmati
              </p>
              <div className="h-px w-8 bg-gradient-to-l from-transparent to-primary/25" />
            </div>
          </div>

          <div className="mt-10 w-full max-w-2xl rounded-[2rem] border border-primary/10 bg-primary/6 p-6 text-center backdrop-blur-xl sm:p-8">
            <h2 className="text-3xl font-black leading-tight text-primary">
              Nimadir noto&apos;g&apos;ri ketdi
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-primary/68 sm:text-base">
              Ilova xatoni ushladi va butunlay buzilib ketishini oldini oldi.
              Sahifani qayta yuklab ko&apos;ring, odatda shu bilan holat tiklanadi.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                type="button"
                onClick={this.handleReload}
                className="error-boundary-button inline-flex min-w-52 items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-semibold text-primary transition-all duration-200 hover:-translate-y-0.5"
              >
                <RefreshCw size={17} />
                Qayta yuklash
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="inline-flex min-w-52 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 px-5 py-4 text-sm font-semibold text-primary/80 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/10"
              >
                Asosiy sahifaga qaytish
              </button>
            </div>
          </div>

          <div className="absolute bottom-12 flex gap-3">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="h-1.5 w-1.5 rounded-full animate-dot-bounce"
                style={{
                  background:
                    index === 1 ? "var(--color-main)" : "rgba(255, 255, 255, 0.2)",
                  animationDelay: `${index * 0.15}s`,
                  boxShadow:
                    index === 1 ? "0 0 10px var(--color-main)" : "none",
                }}
              />
            ))}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
