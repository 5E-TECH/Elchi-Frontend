import { useId, useState, type ReactNode } from "react";
import { ChevronDown, Lock, RefreshCw, ServerCrash, TriangleAlert, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../lib/cx";
import { getBackendMessage, getErrorKind, getErrorStatus, type ErrorKind } from "../../lib/errorKind";
import { Button, type IconSlot } from "./Button";
import { EmptyState, type EmptyStateProps, type StateTone } from "./EmptyState";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  XATO HOLATI — dizayn v2 (`.el-empty` + `bg-danger-soft text-danger-fg` ikonka + «Qayta urinish»,
 *  `design/CODE-MAP.md` 2.7, taxta `tizim-errors` 01–02, grafik — `tizim-charts` 05)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  So'rov xato qaytarganda ma'lumot turgan joyda chiziladi (karta joyida qoladi, sarlavha va
 *  filtrlar ishlayveradi). Turini `error` dan o'zi aniqlaydi (yoki `kind` bilan bering):
 *
 *    server    — 5xx: `ServerCrash`, «Ma'lumotni yuklab bo'lmadi», «Server xatosi (500)…» + qayta urinish;
 *    timeout   — 20 s chegarasi: «Server javob bermadi…» + qayta urinish;
 *    offline   — javob umuman kelmadi / internet yo'q: `WifiOff`, «Internet aloqasi yo'q» + qayta urinish;
 *    forbidden — 403: `Lock`, KULRANG (xato emas), «Bu ma'lumotni ko'rishga ruxsatingiz yo'q», tugmasiz,
 *                `role="status"`;
 *    section   — bitta bo'lim/tab ishdan chiqdi: «Bu bo'limni ochishda xatolik yuz berdi»;
 *    generic   — boshqa 4xx va noma'lum: backend xabari yoki «So'rov bajarilmadi (422)».
 *
 *  Tur va holat kodi — `src/shared/lib/errorKind.ts` (`getErrorKind`, `getErrorStatus`).
 *  Qizil (danger) — faqat tizim xatosida; `role="alert"` (ekran o'quvchi darhol aytadi).
 *  O'lcham `card` (sukut; «Qayta urinish» — `secondary`), `page` (asosiy tugma «Qayta urinish» +
 *  `actions` dagi chiqish yo'li), `chart` (kichik tugma). `details` — «Xato tafsilotlari» ochiladigan bloki.
 */

const KIND_ICON: Record<ErrorKind, IconSlot> = {
  server: ServerCrash,
  timeout: ServerCrash,
  offline: WifiOff,
  forbidden: Lock,
  section: TriangleAlert,
  generic: TriangleAlert,
};

export type ErrorStateProps = Omit<EmptyStateProps, "title" | "icon" | "tone" | "action"> & {
  /** So'rov xatosi — tur, holat kodi va backend xabari shundan. */
  error?: unknown;
  /** Turini qo'lda berish (sukut — `getErrorKind(error)`). */
  kind?: ErrorKind;
  /** Sarlavha (sukut — turga qarab). */
  title?: ReactNode;
  /** Izoh (sukut — turga qarab; `generic` da backend xabari). */
  description?: ReactNode;
  icon?: IconSlot;
  /** «Qayta urinish» (masalan `query.refetch`). `forbidden` da ko'rsatilmaydi. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Qayta urinish ketmoqda — tugmada spinner. */
  retrying?: boolean;
  /** Qo'shimcha tugmalar (`page`: «Bosh sahifaga qaytish»). «Qayta urinish» dan keyin turadi. */
  actions?: ReactNode;
  /** «Xato tafsilotlari» — ochiladigan blok (texnik matn, `pre`). */
  details?: ReactNode;
};

/**
 * Dizayn v2 xato holati.
 *
 *   <ErrorState error={query.error} onRetry={() => void query.refetch()} />
 *   <ErrorState kind="section" onRetry={retry} />
 *   <ErrorState size="page" kind="server" onRetry={retry}
 *     actions={<Link className={buttonClasses({ variant: "secondary" })} to="/">…</Link>} />
 */
export const ErrorState = ({
  error,
  kind: kindProp,
  title,
  description,
  icon,
  onRetry,
  retryLabel,
  retrying = false,
  actions,
  details,
  size = "card",
  role,
  ...rest
}: ErrorStateProps) => {
  const { t } = useTranslation("ui");
  const detailsId = useId();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const kind = kindProp ?? getErrorKind(error);
  const status = getErrorStatus(error);
  const forbidden = kind === "forbidden";
  const tone: StateTone = forbidden ? "neutral" : "danger";

  const defaultDescription = (() => {
    switch (kind) {
      case "server":
        return status != null
          ? t("states.error.server.description", { status })
          : t("states.error.timeout.description");
      case "generic": {
        const backend = getBackendMessage(error);
        if (backend) return backend;
        return status != null
          ? t("states.error.generic.description", { status })
          : t("states.error.generic.descriptionNoStatus");
      }
      default:
        return t(`states.error.${kind}.description`);
    }
  })();

  const showRetry = Boolean(onRetry) && !forbidden;
  const retryButton = showRetry ? (
    <Button
      variant={size === "page" ? "primary" : "secondary"}
      size={size === "chart" ? "sm" : "md"}
      leftIcon={RefreshCw}
      loading={retrying}
      onClick={onRetry}
    >
      {retryLabel ?? t("states.retry")}
    </Button>
  ) : null;
  const hasActions = showRetry || (actions != null && actions !== false);
  const hasDetails = details != null && details !== false;

  return (
    <EmptyState
      role={role ?? (forbidden ? "status" : "alert")}
      data-error-kind={kind}
      size={size}
      tone={tone}
      icon={icon ?? KIND_ICON[kind]}
      title={title ?? t(`states.error.${kind}.title`)}
      description={description === undefined ? defaultDescription : description}
      action={
        hasActions ? (
          <>
            {retryButton}
            {actions}
          </>
        ) : undefined
      }
      footer={
        hasDetails ? (
          <div className="flex w-full min-w-0 flex-col items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              rightIcon={<ChevronDown className={cx("transition-transform motion-reduce:transition-none", detailsOpen && "rotate-180")} />}
              aria-expanded={detailsOpen}
              aria-controls={detailsId}
              onClick={() => setDetailsOpen((open) => !open)}
            >
              {t("states.details")}
            </Button>
            <pre
              id={detailsId}
              hidden={!detailsOpen}
              className="m-0 max-h-60 w-full max-w-[560px] overflow-auto whitespace-pre-wrap rounded-lg bg-sunken p-3 text-left font-mono text-xs text-text-muted [overflow-wrap:anywhere]"
            >
              {details}
            </pre>
          </div>
        ) : undefined
      }
      {...rest}
    />
  );
};
