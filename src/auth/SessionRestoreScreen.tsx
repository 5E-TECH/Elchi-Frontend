import { memo, useId } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { LogIn, RefreshCw, ServerCrash, WifiOff } from "lucide-react";
import LogoWhite from "../shared/assets/brand/elchi-logo-white.png";
import { Button } from "../shared/ui/primitives";
import type { SessionRestoreState } from "../entities/user/model/types";
import { abandonSessionRestore, retrySessionRestoreNow } from "./authService";

/**
 * «INTERNET SEKIN — QAYTA URINILMOQDA» (sekin internet, 2026-11-07). Yangi tab / PWA ochilishida sessiyani cookie
 * bilan tiklash 15 s dan oshdi yoki vaqtincha yiqildi (`authService.ts` → SESSIYANI TIKLASH): foydalanuvchi jim
 * kirish sahifasiga tashlanmaydi — ilova o'zi qayta urinadi.
 *
 * `PageLoader` bilan bir xil qobiq (navy fon, oq logotip) — yuklanish ekrani shu ekranga sakramasdan almashadi.
 * Kirish chunk'ida (lazy EMAS): tarmoq qotgan paytda ham chiziladi; matnlar `auth` nomlar fazosida (uz — eager).
 */
type SessionRestoreScreenProps = {
  state: SessionRestoreState;
};

const SessionRestoreScreen = ({ state }: SessionRestoreScreenProps) => {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const titleId = useId();
  const textId = useId();
  const server = state.reason === "server";
  const Icon = server ? ServerCrash : WifiOff;
  const attempting = state.phase !== "waiting";

  // Qobiq aylanadi, ichki blok kamida ekran balandligida markazda: past ekranda (320×460, yotiq telefon) tarkib
  // tepaga chiqib kesilmaydi — `justify-center` to'g'ridan-to'g'ri aylanadigan qobiqda logotipni yetib bo'lmas qilardi.
  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-nav">
      <div className="flex min-h-full flex-col items-center justify-center gap-6 p-4">
        <img
          src={LogoWhite}
          alt="Elchi Pochta"
          width={145}
          height={48}
          className="block h-12 w-auto"
          draggable={false}
        />
        <section
          aria-labelledby={titleId}
          aria-describedby={textId}
          className="flex w-full max-w-[400px] min-w-0 flex-col items-center gap-5 rounded-[14px] border border-border bg-surface px-6 py-8 text-center"
        >
          <span
            aria-hidden="true"
            className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning-fg"
          >
            <Icon aria-hidden="true" focusable="false" size={24} />
          </span>

          <div className="flex flex-col items-center gap-2">
            <h1 id={titleId} className="text-xl font-bold tracking-[-.01em] text-text">
              {t(server ? "sessionRestore.titleServer" : "sessionRestore.title")}
            </h1>
            <p id={textId} className="max-w-[320px] text-sm text-text-muted">
              {t("sessionRestore.text")}
            </p>
            <p aria-live="polite" className="text-[13px] font-medium text-text-muted">
              {t(attempting ? "sessionRestore.trying" : "sessionRestore.waiting")}
            </p>
          </div>

          <div className="flex w-full flex-col gap-3">
            <Button
              size="lg"
              fullWidth
              leftIcon={RefreshCw}
              loading={attempting}
              onClick={retrySessionRestoreNow}
            >
              {t("sessionRestore.retry")}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              leftIcon={LogIn}
              onClick={() => {
                abandonSessionRestore();
                navigate("/login", { replace: true });
              }}
            >
              {t("sessionRestore.toLogin")}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default memo(SessionRestoreScreen);
