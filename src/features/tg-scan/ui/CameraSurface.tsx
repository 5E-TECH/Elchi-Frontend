// dizayn-v2: courier-scan-active, courier-scan-starting, courier-scan-permission-denied, courier-scan-success-flash, courier-scan-other-courier, courier-scan-invalid
import type { ComponentProps, ReactNode, Ref } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "../../../shared/lib/cx";
import { Pressable } from "../../../shared/ui/primitives";

/**
 * KAMERA YUZASI — maket `.el-cam*` (`design/CODE-MAP.md` 2.11, taxta `tizim-scanner`), telefon ko'rinishi.
 *
 * Yuza HAR DOIM tungi: ildizga `dark` klassi — ichidagi tokenlar tungi qiymat oladi (maketdagi
 * `--cam-*`: shisha `bg-bg/60`, panel `bg-bg/95`, chiziq `border-text/20`, yordamchi matn `text-text/75`,
 * natija ranglari `*-fg`, ular ustida `text-on-solid`). Fon — `nav` («doim navy orol», skaner oynasi).
 * Qatlamlar (maketdagidek): tasvir 0 · ramka 1 · holat/maslahat/xabar/karta 2 · yuqori va pastki panel 3.
 */

export type CameraTone = "success" | "error" | "warning" | "info";

const TONE_BORDER: Record<CameraTone, string> = {
  success: "border-success-fg",
  error: "border-danger-fg",
  warning: "border-warning-fg",
  info: "border-info-fg",
};

const TONE_SOLID: Record<CameraTone, string> = {
  success: "bg-success-fg text-on-solid",
  error: "bg-danger-fg text-on-solid",
  warning: "bg-warning-fg text-on-solid",
  info: "bg-info-fg text-on-solid",
};

const TONE_TINT: Record<CameraTone, string> = {
  success: "bg-success-soft",
  error: "bg-danger-soft",
  warning: "bg-warning-soft",
  info: "bg-info-soft",
};

const TONE_TOAST_BORDER: Record<CameraTone, string> = {
  success: "border-success-fg/50",
  error: "border-danger-fg/55",
  warning: "border-warning-fg/55",
  info: "border-info-fg/45",
};

type CameraSurfaceProps = {
  /** Bo'limning ekran o'quvchi nomi (holatga qarab: «Kamera ishga tushmoqda» …). */
  label: string;
  busy?: boolean;
  title: string;
  context?: string;
  /** Yuqori paneldagi o'ng asboblar (chiroq). */
  tools?: ReactNode;
  /** Haqiqiy `<video>` (to'liq ekran, eng pastki qatlam). */
  feed?: ReactNode;
  children?: ReactNode;
  /** Pastki panel (hisoblagich, oxirgi skan, amal). */
  bottom?: ReactNode;
  surfaceRef?: Ref<HTMLElement>;
};

/** `.el-cam` + `.el-cam-top` + `.el-cam-stage` — telefonda to'liq ekran (Telegram oynasi). */
export const CameraSurface = ({
  label,
  busy,
  title,
  context,
  tools,
  feed,
  children,
  bottom,
  surfaceRef,
}: CameraSurfaceProps) => (
  <section
    ref={surfaceRef}
    aria-label={label}
    aria-busy={busy || undefined}
    className="dark fixed inset-0 isolate flex flex-col overflow-hidden bg-nav text-text"
  >
    {feed}
    <header className="relative z-3 flex min-h-18 shrink-0 items-center gap-2 p-3">
      {/* Chap tomonda Telegram'ning o'z «Yopish» tugmasi bor — sarlavha markazda qolsin. */}
      <span aria-hidden="true" className="size-12 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center">
        <h1 className="max-w-full truncate text-base leading-[22px] font-bold">{title}</h1>
        {context ? (
          <p className="max-w-full truncate text-[13px] leading-[18px] font-medium text-text/75">{context}</p>
        ) : null}
      </div>
      <div className="flex min-w-12 shrink-0 items-center justify-end gap-2">{tools}</div>
    </header>
    <div className="relative min-h-0 flex-1">{children}</div>
    {bottom}
  </section>
);

/** `.el-cam-btn` — 48px yumaloq shisha tugma (`aria-label` majburiy). */
export const CameraButton = ({
  icon: Icon,
  label,
  className,
  ...rest
}: Omit<ComponentProps<"button">, "children"> & { icon: LucideIcon; label: string }) => (
  <Pressable
    aria-label={label}
    title={label}
    {...rest}
    className={cx(
      "inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-text/20 bg-bg/60 text-text backdrop-blur-md",
      "transition-colors duration-150 hover:bg-bg/80 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40",
      "aria-pressed:border-text aria-pressed:bg-text aria-pressed:text-on-solid",
      className,
    )}
  >
    <Icon aria-hidden="true" focusable="false" size={22} strokeWidth={2} />
  </Pressable>
);

export type CameraChipDot = "live" | "info" | "warning" | "error";

const DOT: Record<CameraChipDot, string> = {
  live: "bg-success-fg motion-safe:animate-pulse",
  info: "bg-info-fg",
  warning: "bg-warning-fg",
  error: "bg-danger-fg",
};

/** `.el-cam-status` — ramka tepasidagi holat chiplari qatori. */
export const CameraStatus = ({ children }: { children: ReactNode }) => (
  <div className="pointer-events-none absolute inset-x-3 top-3 z-2 flex flex-wrap justify-center gap-2">{children}</div>
);

/** `.el-cam-chip` (32px). */
export const CameraChip = ({ dot, icon: Icon, children }: { dot?: CameraChipDot; icon?: LucideIcon; children: ReactNode }) => (
  <span className="inline-flex h-8 items-center gap-2 rounded-full border border-text/20 bg-bg/60 px-3 text-[13px] leading-none font-semibold whitespace-nowrap backdrop-blur-md">
    {dot ? <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", DOT[dot])} /> : null}
    {Icon ? <Icon aria-hidden="true" focusable="false" size={16} strokeWidth={2} /> : null}
    {children}
  </span>
);

/** `.el-cam-hint` — ramka ostidagi maslahat. */
export const CameraHint = ({ children, live }: { children: ReactNode; live?: boolean }) => (
  <p
    role={live ? "status" : undefined}
    className="absolute top-[calc(50%+140px)] left-1/2 z-2 w-max max-w-[min(380px,calc(100%-32px))] -translate-x-1/2 rounded-full border border-text/20 bg-bg/60 px-3.5 py-2 text-center text-sm leading-5 font-semibold backdrop-blur-md md:top-[calc(50%+156px)]"
  >
    {children}
  </p>
);

const CORNERS = [
  "top-0 left-0 rounded-tl-3xl border-r-0 border-b-0",
  "top-0 right-0 rounded-tr-3xl border-b-0 border-l-0",
  "right-0 bottom-0 rounded-br-3xl border-t-0 border-l-0",
  "bottom-0 left-0 rounded-bl-3xl border-t-0 border-r-0",
] as const;

type ScanFinderProps = {
  /** Natija rangi (ramka, fon va markazdagi belgi). */
  tone?: CameraTone | null;
  /** Kamera to'xtagan yoki hali ochilmagan — oqarib qolgan ramka. */
  paused?: boolean;
  /** Markazdagi 72px belgi (natija ikonkasi yoki spinner). */
  mark?: ReactNode;
};

/**
 * `.el-cam-finder` — 248px (≥ 768: 280), radius 24, burchaklar 56/5px. Atrofdagi qorong'i parda — `overlay`.
 * Skanerlash chizig'i — `nav-accent` (to'q fon ustidagi urg'u, DESIGN_SYSTEM §2).
 */
export const ScanFinder = ({ tone, paused, mark }: ScanFinderProps) => (
  <div
    aria-hidden="true"
    data-finder-tone={tone ?? (paused ? "paused" : "idle")}
    className={cx(
      "absolute top-1/2 left-1/2 z-1 size-[248px] -translate-x-1/2 -translate-y-1/2 rounded-3xl md:size-[280px]",
      "shadow-[0_0_0_2400px_var(--color-overlay)] ring-1 ring-text/20 ring-inset transition-colors duration-200 motion-reduce:transition-none",
      tone && TONE_TINT[tone],
    )}
  >
    {CORNERS.map((corner) => (
      <span
        key={corner}
        className={cx(
          "absolute size-14 border-[5px] drop-shadow-sm transition-colors duration-200 motion-reduce:transition-none",
          corner,
          tone ? TONE_BORDER[tone] : paused ? "border-text/40" : "border-text",
        )}
      />
    ))}
    {!tone && !paused ? (
      <span className="absolute inset-x-[10%] top-1/2 -mt-px h-0.5 animate-[scanner-scan-line-y_2.4s_ease-in-out_infinite_alternate] rounded-full bg-nav-accent motion-reduce:animate-none" />
    ) : null}
    {mark ? (
      <span
        className={cx(
          "absolute top-1/2 left-1/2 inline-flex size-18 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-xl",
          tone ? TONE_SOLID[tone] : "bg-bg/60 text-text",
        )}
      >
        {mark}
      </span>
    ) : null}
  </div>
);

/** `.el-cam-toasts` — natija xabari (pastda, `aria-live`). */
export const CameraToasts = ({ children }: { children?: ReactNode }) => (
  <div role="status" aria-live="polite" className="absolute inset-x-3 bottom-3 z-2 flex flex-col items-center gap-2">
    {children}
  </div>
);

/** `.el-cam-toast` + `-icon` / `-body` / `-title` / `-text`. */
export const CameraToast = ({
  tone,
  icon: Icon,
  title,
  text,
}: {
  tone: CameraTone;
  icon: LucideIcon;
  title: ReactNode;
  text?: ReactNode;
}) => (
  <div
    data-toast-tone={tone}
    className={cx("flex w-full max-w-[440px] items-center gap-3 rounded-[14px] border bg-bg/95 p-2.5 shadow-xl", TONE_TOAST_BORDER[tone])}
  >
    <span aria-hidden="true" className={cx("inline-flex size-9 shrink-0 items-center justify-center rounded-full", TONE_SOLID[tone])}>
      <Icon focusable="false" size={20} strokeWidth={2} />
    </span>
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="text-sm leading-5 font-bold [overflow-wrap:anywhere]">{title}</span>
      {text ? <span className="text-[13px] leading-[18px] text-text/75 [overflow-wrap:anywhere]">{text}</span> : null}
    </div>
  </div>
);

export type CameraCardTone = "error" | "warning" | "neutral";

const CARD_ICON: Record<CameraCardTone, string> = {
  error: "bg-danger-soft text-danger-fg",
  warning: "bg-warning-soft text-warning-fg",
  neutral: "bg-text/7 text-text",
};

/**
 * `.el-cam-card` — kamera o'rnidagi markaziy karta (ruxsat yo'q, Telegram'dan tashqarida, kirish xatosi …).
 * Maket `courier-scan-permission-denied`.
 */
export const CameraCard = ({
  tone,
  icon: Icon,
  title,
  text,
  actions,
  alert = true,
}: {
  tone: CameraCardTone;
  icon: LucideIcon;
  title: ReactNode;
  text?: ReactNode;
  actions?: ReactNode;
  /** `role="alert"` (sukut) — xato darhol o'qilsin; `false` — oddiy holat. */
  alert?: boolean;
}) => (
  <div
    role={alert ? "alert" : undefined}
    className="absolute top-1/2 left-1/2 z-2 flex max-h-[calc(100%-24px)] w-[min(360px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 overflow-auto rounded-[20px] border border-text/10 bg-bg/95 px-5 pt-6 pb-5 text-center shadow-xl"
  >
    <span aria-hidden="true" className={cx("inline-flex size-14 shrink-0 items-center justify-center rounded-full", CARD_ICON[tone])}>
      <Icon focusable="false" size={24} strokeWidth={2} />
    </span>
    <h2 className="text-lg leading-[26px] font-bold [overflow-wrap:anywhere]">{title}</h2>
    {text ? <p className="text-sm leading-[21px] text-text/75 [overflow-wrap:anywhere]">{text}</p> : null}
    {actions ? <div className="mt-1 flex w-full flex-col gap-2">{actions}</div> : null}
  </div>
);

/** `.el-cam-bottom` — pastki panel (telefonda xavfsiz hudud bilan). */
export const CameraBottom = ({ children }: { children: ReactNode }) => (
  <div className="relative z-3 shrink-0 rounded-t-[20px] border-t border-text/10 bg-bg/95 px-4 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] backdrop-blur-lg">
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3">{children}</div>
  </div>
);

/** `.el-cam-last` — oxirgi skan qatori. */
export const CameraLastScan = ({
  icon,
  tone,
  title,
  subtitle,
}: {
  icon: ReactNode;
  tone?: CameraTone | null;
  title: ReactNode;
  subtitle?: ReactNode;
}) => (
  <div className="flex min-h-14 min-w-0 items-center gap-3 rounded-[14px] bg-text/7 py-1.5 pr-1.5 pl-2.5">
    <span
      aria-hidden="true"
      className={cx("inline-flex size-8 shrink-0 items-center justify-center rounded-full", tone ? TONE_SOLID[tone] : "bg-text/7 text-text")}
    >
      {icon}
    </span>
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-sm leading-5 font-semibold">{title}</span>
      {subtitle ? <span className="truncate text-[13px] leading-[18px] text-text/75">{subtitle}</span> : null}
    </span>
  </div>
);
