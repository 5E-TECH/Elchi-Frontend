import {
  type CSSProperties,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type FormEventHandler,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../lib/cx";
import { useBackdropPress } from "./dialog/useBackdropPress";
import { ButtonIcon, type IconSlot } from "./Button";
import { IconButton } from "./IconButton";
import { getFocusableElements, Portal, useFocusTrap, useMergedRefs, useScrollLock, useVisualViewportFit } from "./overlay";
import { TONE_SOFT, type Tone } from "./tone";
import { usePresence, type Presence } from "./usePresence";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  OYNA (dialog) — dizayn v2 (`.el-overlay` · `.el-dialog` · `.el-dialog-head` · `.el-dialog-foot` ·
 *  `.el-sheet` · `.el-sheet-grip`, `design/CODE-MAP.md` 2.8; taxtalar `tizim-motion` 03, `tizim-feedback` 06)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Tuzilma (maketdagi har `*-dialog` ekrani): sarlavha qatori (ikonka · sarlavha + izoh · «Yopish»),
 *  tana (bloklar orasi 16 px), pastda amallar — chapda «Bekor qilish» (`secondary`), o'ngda BITTA
 *  asosiy amal. Tana uzun bo'lsa faqat u aylanadi, sarlavha va amallar joyida; aylanayotganda amallar
 *  ustida chiziq (maket `manager-orders-cancel-dialog`, `superadmin-users-edit-dialog`).
 *
 *  O'lchamlar (maketdagi kengliklar): sm 440 (o'chirish/tasdiq) · md 480 (sukut) · lg 560 (tanlash
 *  ro'yxati, bekor qilish formasi) · xl 640 (keng forma: foydalanuvchi, filial).
 *
 *  Telefonda (< 768) — PASTKI VARAQA: ekran pastiga yopishgan, to'liq en, tepasi yumaloq, tutqich,
 *  balandligi ≤ 92dvh, amallar teng enli (≥ 44 px).
 *
 *  Harakat (`tizim-motion` 03): fon va oyna birga — shaffoflik 0 → 100%, oyna 98% → 100%, 250 ms kirish
 *  egri chizig'i; varaqa pastdan siljiydi. Yopilish 200 ms, chiqish egri chizig'i. «Harakatni
 *  kamaytirish» yoqilsa — darhol.
 *
 *  Xatti-harakat (WAI-ARIA dialog): `role="dialog"` (`alertdialog` — tasdiqlash) + `aria-modal`,
 *  sarlavha/izoh bog'langan; `Portal` (`overlay` qatlami, 1200); fokus ichkariga (sukut: tanadagi
 *  birinchi maydon), Tab oyna ichida aylanadi, yopilgach ochgan tugmaga qaytadi; Esc va fon bosilsa
 *  yopiladi (`dismissible`, `closeOnOverlay`); so'rov ketayotganda (`busy`) yopilmaydi; orqa fon
 *  `inert` va aylanmaydi.
 */

export type DialogSize = "sm" | "md" | "lg" | "xl";

/** Panel ko'rinishi: `auto` — kompyuterda markazda, telefonda pastki varaqa; `dialog`/`sheet` — majburiy (namuna sahifasi). */
export type DialogLayout = "auto" | "dialog" | "sheet";

/** Nima sababdan yopilmoqda: Esc, fon bosildi, sarlavhadagi «Yopish», telefonda tutqich pastga tortildi. */
export type DialogCloseReason = "escape" | "overlay" | "close-button" | "swipe";

/** Tutqichni tortib yopish chegarasi: varaqa balandligining choragi (48…120 px) yoki tez siltash. */
const SWIPE_CLOSE_MIN_PX = 48;
const SWIPE_CLOSE_MAX_PX = 120;
const SWIPE_CLOSE_RATIO = 0.25;
const SWIPE_FLICK_MIN_PX = 24;
/** px/ms — shundan tez siltansa masofadan qat'i nazar yopiladi. */
const SWIPE_FLICK_VELOCITY = 0.5;

const SIZE: Record<DialogSize, string> = {
  sm: "max-w-[440px]",
  md: "max-w-[480px]",
  lg: "max-w-[560px]",
  xl: "max-w-[640px]",
};

/** `.el-dialog`: `raised` yuza, 20 px radius, maketdagi `--shadow-2` → `shadow-xl`. */
const PANEL_BASE = "relative flex w-full min-w-0 flex-col gap-4 bg-raised text-text shadow-xl outline-none";

const PANEL_LAYOUT: Record<DialogLayout, string> = {
  // Joyida chizilgan panel (namuna sahifasi) tor joyda ham maketdagidek: konteyner < 384 px — tugmalar
  // teng enli (`@container el (max-width:767px)` → `.el-dialog-foot .el-btn{flex:1}`).
  dialog: "@container/dialog max-h-full rounded-[20px] border border-border p-6",
  // Telefonda `.el-overlay > .el-dialog` → `.el-sheet` (maket `@container el (max-width:767px)`).
  auto:
    "max-h-full rounded-[20px] border border-border p-6 " +
    "max-md:max-h-[min(92dvh,calc(var(--dialog-viewport-h,100dvh)-12px))] max-md:max-w-none max-md:rounded-b-none max-md:border-b-0 max-md:px-4 max-md:pt-2 " +
    "max-md:pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
  sheet: "max-h-[92dvh] rounded-t-[20px] border-x border-t border-border px-4 pt-2 pb-6",
};

/**
 * Kirish/chiqish (`tizim-motion` 03): faqat shaffoflik va o'lcham/siljish. Tailwind v4 da `scale-*` va
 * `translate-*` alohida `scale` / `translate` xossalari (`transform` emas) — o'tish ro'yxatida aynan ular
 * turadi, aks holda oyna kattalashmay, varaqa siljimay sakrab chiqardi. Kompyuterda kattalashish + paydo
 * bo'lish, telefonda pastdan siljish (shaffoflik o'zgarmaydi). Ochilish — `@starting-style` (`starting:`),
 * yopilish — `data-state="closed"` (`usePresence` element DOM'da 200 ms qoldiradi).
 */
const PANEL_MOTION =
  "transition-[opacity,scale,translate] duration-250 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none " +
  "md:starting:scale-[.98] md:starting:opacity-0 max-md:starting:translate-y-full " +
  "data-[state=closed]:duration-200 data-[state=closed]:ease-[cubic-bezier(0.4,0,1,1)] " +
  "md:data-[state=closed]:scale-[.98] md:data-[state=closed]:opacity-0 max-md:data-[state=closed]:translate-y-full";

/** `.el-overlay`: fon qoplamasi alohida qatlam — oyna shaffofligiga ta'sir qilmaydi. */
const BACKDROP =
  "pointer-events-none absolute inset-0 bg-overlay transition-opacity duration-250 ease-[cubic-bezier(0.2,0,0,1)] " +
  "starting:opacity-0 data-[state=closed]:opacity-0 data-[state=closed]:duration-200 " +
  "data-[state=closed]:ease-[cubic-bezier(0.4,0,1,1)] motion-reduce:transition-none";

const ROOT = "fixed inset-0 flex items-center justify-center overflow-hidden p-6 max-md:items-end max-md:p-0";

/** Klaviatura ochiq paytdagi ko'rinadigan oyna balandligi — telefon varaqasi `max-h` shundan oshmaydi. */
const VIEWPORT_HEIGHT_VAR = "--dialog-viewport-h";

/** Sensorli asosiy kiritish (telefon, planshet) — ekran klaviaturasi bor. */
const isCoarsePointer = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;

const TEXT_INPUT_TYPES = new Set(["", "text", "search", "email", "tel", "url", "number", "password"]);

/** Fokus ekran klaviaturasini ochadigan maydon. */
const isTextEntry = (element: HTMLElement) =>
  element instanceof HTMLTextAreaElement ||
  (element instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(element.type.toLowerCase())) ||
  element.isContentEditable;

/**
 * `.el-sheet-grip` — faqat varaqada. Modal oynada (`Dialog`) tutqichni pastga tortib yopish mumkin
 * (`tizim-responsive`: «Yopish tugmasi, fonni bosish yoki tutqichni pastga tortish»); tortish joyi —
 * varaqa tepasidagi to'liq enli 32 px yo'lak (chiziqning o'zi 40 × 4).
 */
const GRIP: Record<DialogLayout, string | null> = {
  dialog: null,
  auto: "hidden max-md:flex",
  sheet: "flex",
};

/**
 * `.el-dialog-foot`: o'ngga tekislangan; telefonda (varaqada) tugmalar teng enli, bir qatorda.
 * Qator `flex-wrap` — tugma matni `nowrap` bo'lgani uchun sig'masa (uzun fe'l, keng zaxira shrift — masalan
 * Manrope yuklanmaganda DejaVu Sans) ikkinchi tugma keyingi qatorga to'liq enli tushadi, ekrandan chiqmaydi.
 * Sig'sa — ko'rinish o'zgarmaydi (bir qator, teng enli).
 */
const FOOT: Record<DialogLayout, string> = {
  dialog: "flex shrink-0 flex-wrap justify-end gap-2 @max-sm/dialog:[&>*]:flex-1",
  auto: "flex shrink-0 flex-wrap justify-end gap-2 max-md:[&>*]:flex-1",
  sheet: "flex shrink-0 flex-wrap justify-end gap-2 [&>*]:flex-1",
};

/** Tana aylanayotganda amallar ustidagi chiziq (telefonda chetdan chetga — `superadmin-users-edit-dialog`). */
const FOOT_DIVIDER: Record<DialogLayout, string> = {
  dialog: "border-t border-border pt-4",
  auto: "border-t border-border pt-4 max-md:-mx-4 max-md:px-4",
  sheet: "-mx-4 border-t border-border px-4 pt-4",
};

/** Ikonka: `square` — `.el-stat-icon` 36 (oddiy oyna), `circle` — 40 doira (tasdiqlash oynasi). */
export type DialogIconShape = "square" | "circle";

const ICON_SHAPE: Record<DialogIconShape, string> = {
  square: "size-9 rounded-[10px]",
  circle: "size-10 rounded-full",
};

export type DialogPanelProps = Omit<ComponentProps<"div">, "title" | "children" | "onSubmit"> & {
  /** Sarlavha (`h2`, 16/24 · 700). Bo'lmasa — `aria-label` majburiy. */
  title?: ReactNode;
  /** Sarlavha ostidagi izoh (13 px, `text-muted`): ob'ekt, raqam, kontekst. */
  description?: ReactNode;
  /** Sarlavha yonidagi ikonka (lucide komponenti yoki element). */
  icon?: IconSlot;
  /** Ikonka toni (sukut `neutral` — `sunken` fon). */
  iconTone?: Tone;
  iconShape?: DialogIconShape;
  size?: DialogSize;
  layout?: DialogLayout;
  /** Pastdagi amallar: `Button` lar, chapdan o'ngga — «Bekor qilish», so'ng asosiy amal. */
  footer?: ReactNode;
  /** Amallar ustidagi chiziq: `true` (sukut) — doim, maketlardagidek; `"auto"` — faqat tana aylanayotganda; `false` — yo'q. */
  footerDivider?: boolean | "auto";
  /** Sarlavhadagi «Yopish» tugmasi bosilganda. Berilmasa tugma yo'q. */
  onCloseClick?: () => void;
  /** «Yopish» tugmasi nomi (sukut «Yopish»). */
  closeLabel?: string;
  /** «Yopish» o'chirilgan (so'rov ketmoqda). */
  closeDisabled?: boolean;
  /** Berilsa tana va amallar `<form>` ichida: `type="submit"` tugma va Enter shu funksiyani chaqiradi. */
  onSubmit?: FormEventHandler<HTMLFormElement>;
  /** `<form>` atributlari (`noValidate`, `id`, `aria-label` …). */
  formProps?: Omit<ComponentProps<"form">, "onSubmit" | "children" | "className">;
  /** Tana o'rami (aylanadigan qism) klassi. */
  bodyClassName?: string;
  /** Sarlavha va izoh `id` lari (`Dialog` bog'laydi; sukut — avtomatik). */
  titleId?: string;
  descriptionId?: string;
  /** Tananing aylanuvchi o'rami (fokus uchun birinchi maydonni topish). */
  bodyRef?: Ref<HTMLDivElement>;
  /** Tutqich yo'lagining sichqoncha/teginish hodisalari (pastga tortib yopish — `Dialog`). */
  gripProps?: Pick<
    ComponentProps<"div">,
    "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel" | "onLostPointerCapture"
  >;
  panelRef?: Ref<HTMLDivElement>;
  children?: ReactNode;
};

/** Tana aylanayotganmi (ResizeObserver: tana va uning mazmuni o'lchami o'zgarganda qayta o'lchanadi). */
const useOverflowing = (enabled: boolean) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const body = bodyRef.current;
    if (!enabled || !body || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      setOverflowing(body.scrollHeight - body.clientHeight > 1);
    });
    observer.observe(body);
    if (contentRef.current) observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [enabled]);

  return { bodyRef, contentRef, overflowing: enabled && overflowing };
};

/**
 * OYNA PANELI — ko'rinish (portal, fokus va fonsiz). `Dialog` shu panelni modal qilib chizadi;
 * namuna sahifasi esa uni joyida (`layout="dialog" | "sheet"`) ko'rsatadi.
 */
export const DialogPanel = ({
  title,
  description,
  icon,
  iconTone = "neutral",
  iconShape = "square",
  size = "md",
  layout = "auto",
  footer,
  footerDivider = true,
  onCloseClick,
  closeLabel,
  closeDisabled,
  onSubmit,
  formProps,
  bodyClassName,
  titleId: titleIdProp,
  descriptionId: descriptionIdProp,
  bodyRef: bodyRefProp,
  gripProps,
  panelRef,
  className,
  children,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  ...rest
}: DialogPanelProps) => {
  const { t } = useTranslation("ui");
  const autoId = useId();
  const titleId = titleIdProp ?? `${autoId}-title`;
  const descriptionId = descriptionIdProp ?? `${autoId}-description`;
  const { bodyRef, contentRef, overflowing } = useOverflowing(footerDivider === "auto" && footer != null);
  const mergedBodyRef = useMergedRefs(bodyRef, bodyRefProp);
  const divided = footerDivider === true || (footerDivider === "auto" && overflowing);
  const hasHeader = title != null || description != null || icon != null || onCloseClick != null;

  const grip = GRIP[layout];
  const body = (
    // Mazmunsiz tana (izohsiz tasdiq: sarlavha + tugmalar) yashiriladi — aks holda sarlavha va amallar
    // orasida ikki karra oraliq (32 px) qolardi; maketda `.el-dialog` gap 16 px.
    <div
      ref={mergedBodyRef}
      data-dialog-body=""
      className={cx("-m-1 min-h-0 flex-auto overflow-y-auto p-1 [&:has(>div:empty)]:hidden", bodyClassName)}
    >
      <div ref={contentRef} className="flex min-w-0 flex-col gap-4">
        {children}
      </div>
    </div>
  );
  const foot =
    footer != null ? (
      <div data-dialog-footer="" className={cx(FOOT[layout], divided && FOOT_DIVIDER[layout])}>
        {footer}
      </div>
    ) : null;

  return (
    <div
      ref={panelRef}
      aria-labelledby={ariaLabelledBy ?? (title != null ? titleId : undefined)}
      aria-describedby={ariaDescribedBy ?? (description != null ? descriptionId : undefined)}
      {...rest}
      data-layout={layout}
      className={cx(PANEL_BASE, PANEL_LAYOUT[layout], layout !== "sheet" && SIZE[size], className)}
    >
      {grip ? (
        // Yo'lak panel tepasidan (`-mt-2`) chetdan chetga (`-mx-4`); `-mb-4` — sarlavhagacha oraliq avvalgidek.
        <div
          aria-hidden="true"
          data-dialog-grip=""
          {...gripProps}
          className={cx(
            "-mx-4 -mt-2 -mb-4 shrink-0 justify-center pt-3 pb-4",
            grip,
            gripProps && "cursor-grab touch-none select-none active:cursor-grabbing",
          )}
        >
          <span className="h-1 w-10 rounded-full bg-border-strong" />
        </div>
      ) : null}
      {hasHeader ? (
        <div className="flex shrink-0 items-start gap-3">
          {icon != null ? (
            <span
              aria-hidden="true"
              className={cx("inline-flex shrink-0 items-center justify-center", ICON_SHAPE[iconShape], TONE_SOFT[iconTone])}
            >
              <ButtonIcon icon={icon} px={20} />
            </span>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {title != null ? (
              <h2 id={titleId} className="text-base font-bold [overflow-wrap:anywhere] text-text">
                {title}
              </h2>
            ) : null}
            {description != null ? (
              <div id={descriptionId} className="text-[13px] text-text-muted">
                {description}
              </div>
            ) : null}
          </div>
          {onCloseClick ? (
            <IconButton
              size="sm"
              icon={X}
              label={closeLabel ?? t("dialog.close")}
              disabled={closeDisabled}
              onClick={onCloseClick}
              className="-mr-2 -mt-1"
            />
          ) : null}
        </div>
      ) : null}
      {onSubmit ? (
        <form {...formProps} onSubmit={onSubmit} className="flex min-h-0 flex-auto flex-col gap-4">
          {body}
          {foot}
        </form>
      ) : (
        <>
          {body}
          {foot}
        </>
      )}
    </div>
  );
};

export type DialogProps = Omit<
  DialogPanelProps,
  "layout" | "onCloseClick" | "closeDisabled" | "panelRef" | "bodyRef" | "titleId" | "descriptionId" | "role"
> & {
  open: boolean;
  /** Yopish so'raldi (Esc, fon, «Yopish»). Oynani yopish — chaqiruvchida (`open=false`). */
  onClose: (reason: DialogCloseReason) => void;
  /** `alertdialog` — tasdiqlash (javob talab qiladi); sukut `dialog`. */
  role?: "dialog" | "alertdialog";
  /** Sarlavhadagi «Yopish» tugmasi (sukut `true`). */
  closable?: boolean;
  /** Esc bilan yopiladi (sukut `true`). */
  dismissible?: boolean;
  /** Fon bosilsa (telefonda — tutqich pastga tortilsa ham) yopiladi (sukut `true`). */
  closeOnOverlay?: boolean;
  /** So'rov ketmoqda: Esc, fon va «Yopish» ishlamaydi (`tizim-feedback` 06 «Yopish»). */
  busy?: boolean;
  /**
   * Ochilganda fokus: `"auto"` (sukut) — tanadagi birinchi maydon/tugma, bo'lmasa panelning o'zi
   * (ekran o'quvchi sarlavhani o'qiydi); sensorli qurilmada (`pointer: coarse`) matn maydoni o'tkazib yuboriladi —
   * klaviatura o'zi ochilib, ro'yxatni yopmasin (vNcGDnNh); `"panel"`; yoki aniq element (`ref`).
   */
  initialFocus?: "auto" | "panel" | RefObject<HTMLElement | null>;
  /** Yopilgach fokus: `true` (sukut) — ochgan tugmaga; `false`; yoki aniq element. */
  returnFocus?: boolean | RefObject<HTMLElement | null>;
  /** Yopilish harakati tugab, oyna DOM'dan olingach. */
  onExited?: () => void;
};

type DialogModalProps = Omit<DialogProps, "onExited"> & { presence: Presence };

const DialogModal = ({
  open,
  presence,
  onClose,
  role = "dialog",
  closable = true,
  dismissible = true,
  closeOnOverlay = true,
  busy = false,
  initialFocus = "auto",
  returnFocus = true,
  ...panelProps
}: DialogModalProps) => {
  const autoFocusRef = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startY: number; startTime: number; offset: number } | null>(null);
  const { exiting, finish } = presence;

  const requestClose = (reason: DialogCloseReason) => {
    if (busy || !open) return;
    onClose(reason);
  };

  const trapRef = useFocusTrap<HTMLDivElement>(open, {
    // Har doim beriladi: `busy` / `dismissible=false` da ham Esc shu oynada «yutiladi» — orqadagi
    // qatlamni yopib yubormaydi.
    onEscape: () => {
      if (dismissible) requestClose("escape");
    },
    initialFocus: initialFocus === "auto" ? autoFocusRef : initialFocus,
    returnFocus,
    inert: true,
  });
  useScrollLock(open);

  // «auto» fokus: tanadagi birinchi fokuslanuvchi element (sarlavhadagi «Yopish» emas), bo'lmasa panel. Sensorli
  // qurilmada matn kiritish maydoni (qidiruv, matn) olinmaydi — fokus ekran klaviaturasini darhol ochib, telefonda
  // pastdan chiqqan ro'yxatni yopardi (vNcGDnNh: «Qabul qilish» → market tanlash); klaviatura faqat bosilganda.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const touch = isCoarsePointer();
    const first = body
      ? getFocusableElements(body).find((element) => !(touch && isTextEntry(element)))
      : undefined;
    autoFocusRef.current = first ?? trapRef.current;
  }, [trapRef]);

  // Telefon klaviaturasi ochiq — qatlam ko'rinadigan oynaga joylashadi: varaqa klaviatura ustida, ichida skroll.
  const viewportFit = useVisualViewportFit(open && !exiting);

  const state = exiting ? "closed" : "open";

  // Tutqichni pastga tortish (telefon varaqasi): panel barmoq ortidan siljiydi; qo'yib yuborilganda chegaradan
  // o'tgan yoki tez siltangan bo'lsa — yopiladi (CSS o'tishi joriy joydan pastga davom etadi), aks holda joyiga qaytadi.
  const swipeEnabled = dismissible && closeOnOverlay && !busy;
  const endDrag = (pointerId: number, time: number, cancelled: boolean) => {
    const drag = dragRef.current;
    const panel = trapRef.current;
    if (!drag || drag.pointerId !== pointerId || !panel) return;
    dragRef.current = null;
    const velocity = drag.offset / Math.max(1, time - drag.startTime);
    const close =
      !cancelled &&
      (drag.offset > Math.min(SWIPE_CLOSE_MAX_PX, Math.max(SWIPE_CLOSE_MIN_PX, panel.offsetHeight * SWIPE_CLOSE_RATIO)) ||
        (drag.offset > SWIPE_FLICK_MIN_PX && velocity > SWIPE_FLICK_VELOCITY));
    panel.style.removeProperty("transition");
    panel.style.removeProperty("translate");
    if (close) requestClose("swipe");
  };
  const gripProps: DialogPanelProps["gripProps"] = swipeEnabled
    ? {
        onPointerDown: (event) => {
          const panel = trapRef.current;
          if (!panel || (event.pointerType === "mouse" && event.button !== 0)) return;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          dragRef.current = { pointerId: event.pointerId, startY: event.clientY, startTime: event.timeStamp, offset: 0 };
          panel.style.transition = "none";
        },
        onPointerMove: (event) => {
          const drag = dragRef.current;
          const panel = trapRef.current;
          if (!drag || drag.pointerId !== event.pointerId || !panel) return;
          drag.offset = Math.max(0, event.clientY - drag.startY);
          panel.style.translate = `0 ${drag.offset}px`;
        },
        onPointerUp: (event) => endDrag(event.pointerId, event.timeStamp, false),
        onPointerCancel: (event) => endDrag(event.pointerId, event.timeStamp, true),
        onLostPointerCapture: (event) => endDrag(event.pointerId, event.timeStamp, true),
      }
    : undefined;

  // Fon bosilishi: bosish ham, qo'yib yuborish ham fonda va oyna eng ustda bo'lsa (ichidagi ro'yxat ochiq
  // turganda bosish faqat ro'yxatni yopadi).
  const backdrop = useBackdropPress(open, rootRef, () => {
    if (!closeOnOverlay || busy) return false;
    requestClose("overlay");
    return true;
  });

  return (
    <Portal layer="overlay">
      {/* Fon bosilishi sichqoncha/teginish uchun; klaviaturada Esc va «Yopish» tugmasi bor. */}
      <div
        ref={rootRef}
        data-dialog-root=""
        data-state={state}
        inert={exiting}
        onPointerDown={backdrop.onPointerDown}
        onClick={backdrop.onClick}
        className={cx(ROOT, exiting && "pointer-events-none")}
        style={
          viewportFit
            ? ({
                top: viewportFit.top,
                bottom: "auto",
                height: viewportFit.height,
                [VIEWPORT_HEIGHT_VAR]: `${viewportFit.height}px`,
              } as CSSProperties)
            : undefined
        }
      >
        <div aria-hidden="true" data-state={state} className={BACKDROP} />
        <DialogPanel
          {...panelProps}
          role={role}
          aria-modal="true"
          tabIndex={-1}
          data-state={state}
          layout="auto"
          panelRef={trapRef}
          bodyRef={bodyRef}
          gripProps={gripProps}
          onCloseClick={closable ? () => requestClose("close-button") : undefined}
          closeDisabled={busy}
          onTransitionEnd={(event) => {
            if (exiting && event.target === event.currentTarget) finish();
          }}
          className={cx(PANEL_MOTION, panelProps.className)}
        />
      </div>
    </Portal>
  );
};

/**
 * Dizayn v2 oynasi.
 *
 *   <Dialog
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     title={t("payments.closeShift")}
 *     description={t("payments.closeShiftHint")}
 *     icon={Timer}
 *     onSubmit={handleSubmit}
 *     busy={mutation.isPending}
 *     footer={
 *       <>
 *         <Button variant="secondary" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
 *         <Button type="submit" leftIcon={Timer} loading={mutation.isPending}>{t("payments.closeShift")}</Button>
 *       </>
 *     }
 *   >
 *     <Field label={t("payments.comment")} optional><TextInput multiline … /></Field>
 *   </Dialog>
 *
 * Tasdiqlash uchun — `ConfirmDialog` yoki `useConfirm()`.
 */
export const Dialog = ({ open, onExited, ...props }: DialogProps) => {
  const presence = usePresence(open, { onExited });
  if (!presence.mounted) return null;
  return <DialogModal {...props} open={open} presence={presence} />;
};
