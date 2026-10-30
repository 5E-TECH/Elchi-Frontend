// dizayn-v2: courier-scan-starting
import { useCallback, useEffect, useRef, useState } from "react";
import { loginWithTelegram, type TelegramAuthResult, type TelegramAuthUser } from "../api/tgScanApi";
import { isTelegramCourierOnlyError } from "./scanError";
import { loadTelegramWebApp, prepareTelegramWebApp, type TelegramWebApp } from "./telegramWebApp";

/**
 * Mini App kirishi: SDK → `initData` → `POST /auth/telegram`.
 *
 *   loading     — SDK yuklanmoqda yoki kirish so'rovi ketmoqda;
 *   outside     — `initData` yo'q (oddiy brauzer): kamera OCHILMAYDI;
 *   error       — kirish rad etildi (401: imzo/eskirgan/bog'lanmagan) yoki tarmoq xatosi;
 *   not-courier — akkaunt kuryer emas (skan faqat kuryerga: `scan-assign` va `scan/done` `@Roles(COURIER)`; BOT-2 dan
 *                 backend boshqa rolga kirishning o'zida 403 `TELEGRAM_COURIER_ONLY` qaytaradi);
 *   expired     — skanerlash paytida JWT tugadi (refresh yo'q — Mini App qayta ochiladi);
 *   ready       — token xotirada (asosiy sessiya saqlagichiga yozilmaydi).
 */
export type TelegramAuthState =
  | { status: "loading" }
  | { status: "outside" }
  | { status: "error"; error: unknown }
  | { status: "not-courier"; webApp: TelegramWebApp }
  | { status: "expired"; webApp: TelegramWebApp }
  | { status: "ready"; webApp: TelegramWebApp; accessToken: string; user: TelegramAuthUser | null };

type AttemptResult = { webApp: TelegramWebApp | null; auth: TelegramAuthResult | null; notCourier?: boolean };
type Attempt = { id: number; promise: Promise<AttemptResult> };

export const useTelegramAuth = ({ surfaceColor }: { surfaceColor?: () => string | null } = {}) => {
  const [state, setState] = useState<TelegramAuthState>({ status: "loading" });
  const [attemptId, setAttemptId] = useState(0);
  // StrictMode effektni ikki marta yuritadi — bitta urinishga bitta kirish so'rovi.
  const attemptRef = useRef<Attempt | null>(null);
  const surfaceColorRef = useRef(surfaceColor);

  useEffect(() => {
    surfaceColorRef.current = surfaceColor;
  }, [surfaceColor]);

  useEffect(() => {
    let cancelled = false;
    if (attemptRef.current?.id !== attemptId) {
      attemptRef.current = {
        id: attemptId,
        promise: loadTelegramWebApp().then(async (webApp): Promise<AttemptResult> => {
          if (!webApp?.initData) return { webApp, auth: null };
          prepareTelegramWebApp(webApp, surfaceColorRef.current?.());
          try {
            return { webApp, auth: await loginWithTelegram(webApp.initData) };
          } catch (error) {
            if (isTelegramCourierOnlyError(error)) return { webApp, auth: null, notCourier: true };
            throw error;
          }
        }),
      };
    }

    attemptRef.current.promise.then(
      ({ webApp, auth, notCourier }) => {
        if (cancelled) return;
        if (webApp && notCourier) {
          setState({ status: "not-courier", webApp });
          return;
        }
        if (!webApp || !auth) {
          setState({ status: "outside" });
          return;
        }
        if (auth.user?.role && auth.user.role !== "courier") {
          setState({ status: "not-courier", webApp });
          return;
        }
        setState({ status: "ready", webApp, accessToken: auth.accessToken, user: auth.user });
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: "error", error });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttemptId((id) => id + 1);
  }, []);

  /** Skanerlash paytida 401 — token yangilanmaydi (refresh yo'q), Mini App qayta ochiladi. */
  const expire = useCallback(() => {
    setState((current) => (current.status === "ready" ? { status: "expired", webApp: current.webApp } : current));
  }, []);

  return { state, retry, expire };
};
