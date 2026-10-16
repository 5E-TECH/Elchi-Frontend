import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { CircleCheck, CircleX, Info, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../lib/cx";
import { notify, toastStore, type NotifyAction, type NotifyTone, type ToastItem } from "../../lib/notify";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { getStackingZ, LAYER_ATTR, Portal } from "./overlay";
import { TONE_FG, type Tone } from "./tone";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  QALQIB CHIQUVCHI XABARLAR — dizayn v2 (`.el-toast`, `design/CODE-MAP.md` 2.7)
 *  Taxtalar: `tizim-feedback` 01–02 · `tizim-errors` 03 · `tizim-motion` («Qalqib chiquvchi xabar»)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Xabarni `notify.success / info / warning / error` chiqaradi (`src/shared/lib/notify.ts`), bu yerda —
 *  faqat ko'rinish. `<Toaster />` ilovada BIR MARTA (`app/providers/UiHost.tsx`).
 *
 *  Joylashuv: kompyuter va planshet — pastki o'ng, chetdan 24 px, 3 tagacha ustma-ust (eng yangisi pastda,
 *  burchakka eng yaqin), oraliq 8 px; telefon (< 768) — yuqori panel ostida, chetdan 12 px, bittadan
 *  (yangisi eskisini almashtiradi), yuqoriga surib yopiladi. Pastki menyu va «Kunni yakunlash» kabi
 *  asosiy tugmalar hech qachon yopilmaydi.
 *
 *  Harakat: o'ngdan 250 ms kirish (telefonda yuqoridan), yopilish 200 ms o'ngga, qolganlari burchak
 *  tomon suriladi; «Harakatni kamaytirish» da — darhol.
 *
 *  Ekran o'quvchi: xabar fokusni OLMAYDI. Matn doimiy `role="status"` (xato — `role="alert"`) e'lon
 *  qiluvchisiga yoziladi: yangi qo'shilgan jonli hudud ekran o'quvchilarda ishonchsiz o'qiladi, doimiy
 *  hududdagi o'zgarish esa har doim. Ko'rinadigan ro'yxat — `Bildirishnomalar` hududi (Tab bilan yopish
 *  va amal tugmalariga yetiladi; Esc — fokusdagi xabarni yopadi). Sichqoncha kursori yoki klaviatura
 *  fokusi xabar ustida — yopilish vaqti to'xtaydi (teginish va sichqoncha bosganda tushgan fokus — yo'q).
 */

const TONE_OF: Record<NotifyTone, Tone> = {
  success: "success",
  info: "info",
  warning: "warning",
  error: "danger",
};

const ICON_OF: Record<NotifyTone, LucideIcon> = {
  success: CircleCheck,
  info: Info,
  warning: TriangleAlert,
  error: CircleX,
};

export type ToastProps = Omit<ComponentProps<"div">, "title" | "children"> & {
  tone: NotifyTone;
  /** Sarlavha — nima bo'ldi (2–4 so'z). */
  title: ReactNode;
  /** Izoh — tafsilot yoki keyingi qadam. */
  description?: ReactNode;
  /** Bitta amal (havola ko'rinishida, izoh ostida). */
  action?: NotifyAction;
  /** Yopish tugmasi (× «Xabarni yopish»); berilmasa — tugma yo'q. */
  onClose?: () => void;
  /** Yopish tugmasi nomi (sukut — `ui:toast.close`). */
  closeLabel?: string;
};

/**
 * Bitta xabar kartasi (`.el-toast`): ton ikonkasi 20 px (rang faqat ikonkada, matn neytral), sarlavha,
 * izoh, ixtiyoriy amal va × tugmasi. `Toaster` shuni chizadi; namuna sahifasi ham to'g'ridan-to'g'ri.
 * Rol (`status`/`alert`) bu yerda yo'q — e'lonni `Toaster` qiladi.
 */
export const Toast = ({ tone, title, description, action, onClose, closeLabel, className, ...rest }: ToastProps) => {
  const { t } = useTranslation("ui");
  const Icon = ICON_OF[tone];
  return (
    <div
      data-tone={tone}
      className={cx(
        "flex w-full min-w-0 items-start gap-3 rounded-xl border border-border bg-raised px-4 py-3 text-sm text-text shadow-xl",
        className,
      )}
      {...rest}
    >
      <Icon aria-hidden="true" focusable="false" size={20} strokeWidth={2} className={cx("mt-px shrink-0", TONE_FG[TONE_OF[tone]])} />
      <div className="flex min-w-0 flex-1 flex-col [overflow-wrap:anywhere]">
        <p className="font-semibold text-text">{title}</p>
        {description != null && description !== false ? (
          <p className="text-[13px] text-text-muted">{description}</p>
        ) : null}
        {action ? (
          <Button variant="link" size="sm" className="-ml-1 mt-1 self-start" onClick={action.onClick}>
            {action.label}
          </Button>
        ) : null}
      </div>
      {onClose ? (
        <IconButton
          size="sm"
          icon={X}
          label={closeLabel ?? t("toast.close")}
          onClick={onClose}
          className="-mr-2 -mt-1"
          data-toast-close=""
        />
      ) : null}
    </div>
  );
};

/**
 * O'tish davri: v1 oynalar (`z-[9998]`, antd `Modal`) ochiq bo'lsa xabar ularning ostida qolmasin.
 * `Portal` langar qatlamidan bitta yuqoriga ko'tariladi; langar — ochiq modal oynalarning eng yuqorisi.
 * Ob'ekt `RefObject` shaklida, `current` har o'qilganda (har chizishda) qayta hisoblanadi.
 */
const MODAL_SELECTOR = '[aria-modal="true"], .ant-modal-wrap, .ant-drawer-open, [role="dialog"]';
const topModalAnchor: RefObject<Element | null> = {
  get current() {
    if (typeof document === "undefined") return null;
    let top: Element | null = null;
    let topZ = 0;
    for (const element of document.querySelectorAll(MODAL_SELECTOR)) {
      if (element.closest(`[${LAYER_ATTR}="toast"]`)) continue;
      const z = getStackingZ(element);
      if (z > topZ) {
        top = element;
        topZ = z;
      }
    }
    return top;
  },
};

/** Klaviatura fokusimi (`:focus-visible`); selektorni bilmagan muhitda — ha. */
const isKeyboardFocus = (element: Element) => {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
};

/** Surib yopish chegarasi (px, telefonda yuqoriga). */
const SWIPE_DISMISS_PX = 40;

type ToastRowProps = {
  toast: ToastItem;
  onDismiss: (id: string, row: HTMLLIElement | null) => void;
};

/**
 * Ro'yxatdagi bitta qator: kirish/chiqish harakati, Esc, telefonda yuqoriga surib yopish.
 * Yopilganda balandlik `grid-rows-[0fr]` bilan yig'iladi — qolganlari burchak tomon suriladi.
 */
const ToastRow = ({ toast, onDismiss }: ToastRowProps) => {
  const rowRef = useRef<HTMLLIElement>(null);
  const [drag, setDrag] = useState<{ pointerId: number; startY: number; offset: number } | null>(null);

  const close = () => onDismiss(toast.id, rowRef.current);

  const onKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    close();
  };

  const onPointerDown = (event: PointerEvent<HTMLLIElement>) => {
    if (event.pointerType !== "touch" || toast.closing) return;
    setDrag({ pointerId: event.pointerId, startY: event.clientY, offset: 0 });
  };
  const onPointerMove = (event: PointerEvent<HTMLLIElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    setDrag({ ...drag, offset: Math.min(0, event.clientY - drag.startY) });
  };
  const onPointerEnd = (event: PointerEvent<HTMLLIElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const swiped = drag.offset <= -SWIPE_DISMISS_PX;
    setDrag(null);
    if (swiped) close();
  };

  return (
    <li
      ref={rowRef}
      data-toast-id={toast.id}
      data-tone={toast.tone}
      data-closing={toast.closing ? "" : undefined}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      style={drag && drag.offset < 0 ? { transform: `translateY(${drag.offset}px)` } : undefined}
      className={cx(
        "pointer-events-auto grid touch-pan-x max-md:not-last:hidden",
        "transition-[grid-template-rows,opacity,translate] motion-reduce:transition-none",
        toast.closing
          ? "grid-rows-[0fr] translate-x-[calc(100%+1.5rem)] opacity-0 duration-200 ease-[cubic-bezier(0.4,0,1,1)] max-md:translate-x-0 max-md:-translate-y-4 motion-reduce:hidden"
          : "grid-rows-[1fr] duration-250 ease-[cubic-bezier(0.2,0,0,1)] starting:translate-x-[calc(100%+1.5rem)] starting:opacity-0 max-md:starting:translate-x-0 max-md:starting:-translate-y-4",
      )}
    >
      <div className={cx("min-h-0 pb-2", toast.closing && "overflow-hidden")}>
        <Toast
          tone={toast.tone}
          title={toast.message}
          description={toast.description}
          action={
            toast.action
              ? {
                  label: toast.action.label,
                  onClick: () => {
                    toast.action?.onClick();
                    close();
                  },
                }
              : undefined
          }
          onClose={close}
        />
      </div>
    </li>
  );
};

/**
 * Yashirin e'lon qiluvchi (doimiy jonli hudud). Har xabar — alohida qator (`id:version` kalitli `p`),
 * hudud `aria-atomic="false"` (`status`/`alert` rolining sukuti `true`): faqat QO'SHILGAN qator o'qiladi.
 * Bir lahzada kelgan bir nechta xabar bir-birini o'chirmaydi; mazmuni yangilangan xabar (`version`)
 * yangi qator bo'lib qayta o'qiladi; olib tashlangan qator aytilmaydi (`aria-relevant` sukuti).
 */
const Announcer = ({ role, toasts }: { role: "status" | "alert"; toasts: readonly ToastItem[] }) => (
  <div role={role} aria-atomic="false" className="sr-only" data-toast-announcer={role}>
    {toasts.map((toast) => (
      <p key={`${toast.id}:${toast.version}`}>
        {toast.message}
        {toast.description != null && toast.description !== false ? <>. {toast.description}</> : null}
      </p>
    ))}
  </div>
);

/**
 * XABARLAR MANZILI — `notify()` xabarlari shu yerda chiziladi (`toast` qatlami, 1300; v1 oyna ochiq
 * bo'lsa — uning ustida). Ilovada bir marta, `src/app/providers/UiHost.tsx` orqali.
 */
export const Toaster = () => {
  const { t } = useTranslation("ui");
  const toasts = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot, toastStore.getSnapshot);
  const announcements = useSyncExternalStore(
    toastStore.subscribe,
    toastStore.getAnnouncements,
    toastStore.getAnnouncements,
  );
  const regionRef = useRef<HTMLElement>(null);
  // Fokus xabarlarga kelishidan oldingi joy — fokusdagi xabar yopilsa, fokus shu yerga qaytadi.
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Tab yashirin bo'lsa vaqt yurmaydi (foydalanuvchi xabarni ko'rmay qolmasin).
  useEffect(() => {
    const sync = () => {
      if (document.visibilityState === "hidden") toastStore.pause("hidden");
      else toastStore.resume("hidden");
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      toastStore.resume("hidden");
    };
  }, []);

  const hasToasts = toasts.length > 0;
  // Ro'yxat bo'shab qolsa — kursor/fokus sababi ham yo'q (aks holda keyingi xabar to'xtab qolardi).
  useEffect(() => {
    if (hasToasts) return;
    toastStore.resume("hover");
    toastStore.resume("focus");
  }, [hasToasts]);

  // Kursor xabar ustidami — hujjat darajasida (`pointerover`). Hududning `pointerleave` iga tayanilmaydi:
  // kursor ostidagi xabar yopilib DOM'dan chiqsa, brauzer undan `pointerout` bermaydi va hudud «kursor
  // ustida» holatida qotib qolardi — qolgan xabarlar hech qachon yopilmasdi. Teginish (touch) hisobga
  // olinmaydi: taxta — «kursor ustida bo'lsa».
  useEffect(() => {
    if (!hasToasts) return;
    const onPointerOver = (event: globalThis.PointerEvent) => {
      if (event.pointerType === "touch") return;
      const target = event.target;
      if (target instanceof Node && regionRef.current?.contains(target)) toastStore.pause("hover");
      else toastStore.resume("hover");
    };
    // Kursor oynadan chiqdi (`relatedTarget` yo'q) — xabar ustida emas.
    const onPointerOut = (event: globalThis.PointerEvent) => {
      if (event.pointerType !== "touch" && event.relatedTarget === null) toastStore.resume("hover");
    };
    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("pointerout", onPointerOut, true);
    return () => {
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("pointerout", onPointerOut, true);
    };
  }, [hasToasts]);

  const onDismiss = (id: string, row: HTMLLIElement | null) => {
    const active = document.activeElement;
    if (row && active instanceof HTMLElement && row.contains(active)) {
      // Fokus yopilayotgan xabarda. Klaviatura bilan — keyingi (yoki oldingi) xabarning × tugmasiga;
      // sichqoncha bilan (× bosildi) — xabarlar ichida qolmaydi, avvalgi joyga qaytadi (aks holda fokus
      // qo'shni xabarda qolib, uning vaqti to'xtab turardi).
      const rows = Array.from(regionRef.current?.querySelectorAll<HTMLLIElement>("li[data-toast-id]:not([data-closing])") ?? []);
      const index = rows.indexOf(row);
      const neighbour = isKeyboardFocus(active) ? (rows[index + 1] ?? rows[index - 1]) : undefined;
      const target =
        neighbour?.querySelector<HTMLElement>("[data-toast-close]") ??
        (returnFocusRef.current?.isConnected ? returnFocusRef.current : null);
      if (target) target.focus();
      else active.blur();
    }
    notify.dismiss(id);
  };

  const onFocus = (event: FocusEvent<HTMLElement>) => {
    const from = event.relatedTarget;
    if (from instanceof HTMLElement && !event.currentTarget.contains(from)) returnFocusRef.current = from;
    // Taxta: «klaviatura fokusi» xabar ustida — vaqt to'xtaydi. Sichqoncha bosganda tugmaga tushgan fokus emas.
    if (isKeyboardFocus(event.target)) toastStore.pause("focus");
  };
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    const to = event.relatedTarget;
    if (to instanceof Node && event.currentTarget.contains(to)) return;
    toastStore.resume("focus");
  };

  return (
    <Portal layer="toast" anchor={topModalAnchor}>
      <Announcer role="status" toasts={announcements.status} />
      <Announcer role="alert" toasts={announcements.alert} />
      {hasToasts ? (
        <section
          ref={regionRef}
          aria-label={t("toast.region")}
          data-toaster=""
          onFocus={onFocus}
          onBlur={onBlur}
          className={cx(
            "pointer-events-none fixed bottom-6 right-6 w-[min(380px,calc(100vw-3rem))]",
            "max-md:inset-x-3 max-md:bottom-auto max-md:top-[4.5rem] max-md:w-auto",
          )}
        >
          <ol className="-mb-2 flex flex-col">
            {toasts.map((toast) => (
              <ToastRow key={toast.id} toast={toast} onDismiss={onDismiss} />
            ))}
          </ol>
        </section>
      ) : null}
    </Portal>
  );
};
