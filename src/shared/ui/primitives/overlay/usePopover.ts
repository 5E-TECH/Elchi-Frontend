import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { readShellBottomInset } from "./shellInset";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  POPOVER JOYLASHUVI — ro'yxat (Select), kalendar (DateRange), amallar menyusi
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Panel langar (trigger) ostida chiqadi (`.el-options`: «ro'yxat maydon ostida»), sig'masa va
 *  tepada joy ko'p bo'lsa — tepaga ag'dariladi (flip); ekran chetidan chiqib ketmasin deb gorizontal
 *  suriladi (shift). `position: fixed` — koordinatalar ko'rinadigan oynaga nisbatan, skroll
 *  konteynerlariga bog'liq emas; har skroll, o'lcham o'zgarishi va telefon klaviaturasi
 *  (`visualViewport`) da qayta hisoblanadi. Tashqi kutubxona (floating-ui) ishlatilmaydi.
 */

export type PopoverSide = "top" | "bottom";
export type PopoverAlign = "start" | "end" | "center";
export type PopoverPlacement = "bottom-start" | "bottom-end" | "bottom" | "top-start" | "top-end" | "top";

type Box = { top: number; left: number; right: number; bottom: number; width: number; height: number };

export type PopoverPositionInput = {
  anchor: Box;
  /** Panelning tabiiy o'lchami (cheklovsiz kontent balandligi). */
  floating: { width: number; height: number };
  /** Ko'rinadigan oyna: yuqori/chap chekka va o'lcham (`visualViewport` bo'lsa — u). */
  viewport: { top: number; left: number; width: number; height: number };
  placement: PopoverPlacement;
  /** Langar va panel orasidagi masofa (px). */
  offset: number;
  /** Ekran chetidan eng kam masofa (px). */
  padding: number;
  /** `true` — eni langarga teng (Select); `"min"` — kamida langar eni; `false` — o'z eni. */
  matchWidth: boolean | "min";
};

export type PopoverPosition = {
  top: number;
  left: number;
  /** Amaldagi joy (ag'darilgan bo'lishi mumkin). */
  side: PopoverSide;
  placement: PopoverPlacement;
  /** Panel eni (`matchWidth` da langar eni), `undefined` — o'z eni. */
  width: number | undefined;
  minWidth: number | undefined;
  /** Ekranga sig'adigan eng katta en. */
  maxWidth: number;
  /** Tanlangan tomonda panelga qolgan balandlik (`maxHeight` uchun). */
  availableHeight: number;
};

const splitPlacement = (placement: PopoverPlacement): [PopoverSide, PopoverAlign] => {
  const [side, align] = placement.split("-") as [PopoverSide, PopoverAlign | undefined];
  return [side, align ?? "center"];
};

/** Sof hisob (DOM'siz, test qilinadi): joy, ag'darish va surish. */
export const computePopoverPosition = ({
  anchor,
  floating,
  viewport,
  placement,
  offset,
  padding,
  matchWidth,
}: PopoverPositionInput): PopoverPosition => {
  const [preferred, align] = splitPlacement(placement);
  const viewTop = viewport.top + padding;
  const viewBottom = viewport.top + viewport.height - padding;
  const viewLeft = viewport.left + padding;
  const viewRight = viewport.left + viewport.width - padding;
  const maxWidth = Math.max(0, viewRight - viewLeft);

  const spaceBelow = Math.max(0, viewBottom - anchor.bottom - offset);
  const spaceAbove = Math.max(0, anchor.top - offset - viewTop);

  let side = preferred;
  if (preferred === "bottom" && floating.height > spaceBelow && spaceAbove > spaceBelow) side = "top";
  if (preferred === "top" && floating.height > spaceAbove && spaceBelow > spaceAbove) side = "bottom";

  const availableHeight = side === "bottom" ? spaceBelow : spaceAbove;
  const height = Math.min(floating.height, availableHeight);

  const rawWidth =
    matchWidth === true ? anchor.width : matchWidth === "min" ? Math.max(floating.width, anchor.width) : floating.width;
  const width = Math.min(rawWidth, maxWidth);

  let left = align === "start" ? anchor.left : align === "end" ? anchor.right - width : anchor.left + (anchor.width - width) / 2;
  left = Math.min(Math.max(left, viewLeft), Math.max(viewLeft, viewRight - width));

  const top = side === "bottom" ? anchor.bottom + offset : anchor.top - offset - height;

  return {
    top: Math.round(top),
    left: Math.round(left),
    side,
    placement: (align === "center" ? side : `${side}-${align}`) as PopoverPlacement,
    width: matchWidth === true ? Math.min(anchor.width, maxWidth) : undefined,
    minWidth: matchWidth === "min" ? Math.min(anchor.width, maxWidth) : undefined,
    maxWidth,
    availableHeight: Math.floor(availableHeight),
  };
};

export type UsePopoverOptions = {
  open: boolean;
  /** Sukut `bottom-start` (maydon ostida, chap chetdan). */
  placement?: PopoverPlacement;
  /** Langar va panel orasidagi masofa — sukut 8 px (`.el-options` maketda `margin-top: 8px`). */
  offset?: number;
  /** Ekran chetidan eng kam masofa — sukut 8 px. */
  padding?: number;
  /** `true` — eni maydonga teng (Select); `"min"` — kamida maydon eni (DateRange). */
  matchWidth?: boolean | "min";
  /** Panelning eng katta balandligi (`.el-options` — 280 px); ekranda joy kam bo'lsa — kamroq. */
  maxHeight?: number;
};

export type UsePopoverResult<A extends HTMLElement, F extends HTMLElement> = {
  /** Langar (trigger: maydon tugmasi, input) — `ref={anchorRef}`. */
  anchorRef: RefObject<A | null>;
  /** Suzuvchi panel — `ref={floatingRef}` va `style={floatingStyles}`. */
  floatingRef: RefObject<F | null>;
  /**
   * `position: fixed` + `top/left` + `width`/`minWidth` + `maxWidth` + `maxHeight`.
   * Birinchi o'lchovgacha `visibility: hidden` (noto'g'ri joyda miltillamasin).
   */
  floatingStyles: CSSProperties;
  /** Amaldagi joy: `bottom-start`, ag'darilsa `top-start` … (`data-placement` / animatsiya yo'nalishi uchun). */
  placement: PopoverPlacement;
  side: PopoverSide;
  isPositioned: boolean;
  /** Qo'lda qayta hisoblash (kontent o'zgarganda; o'lcham kuzatuvchisi odatda o'zi yetadi). */
  update: () => void;
};

/**
 * Panel uchun ko'rinadigan maydon: `visualViewport` (telefon klaviaturasi ochilsa — kichrayadi), pastidan
 * telefon pastki menyusi (`--shell-bottom-inset`, `shellInset.ts`) ayiriladi — ro'yxat menyu ostida qolmaydi.
 * Pastki menyu oynaning (layout viewport) pastiga yopishgan: klaviatura uni yopgan bo'lsa, chegara —
 * klaviatura usti (ikkisidan qaysi biri yuqoriroq bo'lsa).
 */
const readViewport = () => {
  const vv = window.visualViewport;
  const area = vv
    ? { top: vv.offsetTop, left: vv.offsetLeft, width: vv.width, height: vv.height }
    : { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
  const inset = readShellBottomInset();
  if (inset <= 0) return area;
  const bottom = Math.min(area.top + area.height, window.innerHeight - inset);
  return { ...area, height: Math.max(0, bottom - area.top) };
};

/** Panel kontentining tabiiy balandligi (`maxHeight` bilan cheklangan bo'lsa ham). */
const naturalHeight = (el: HTMLElement) => el.scrollHeight + (el.offsetHeight - el.clientHeight);

const samePosition = (a: PopoverPosition | null, b: PopoverPosition) =>
  Boolean(a) &&
  a!.top === b.top &&
  a!.left === b.left &&
  a!.side === b.side &&
  a!.width === b.width &&
  a!.minWidth === b.minWidth &&
  a!.maxWidth === b.maxWidth &&
  a!.availableHeight === b.availableHeight;

/**
 * Langarga bog'langan suzuvchi panel joylashuvi.
 *
 *   const [open, setOpen] = useState(false);
 *   // ⚠️ Destrukturizatsiya qiling: `popover.floatingRef` ko'rinishini React Compiler lint'i
 *   // (`react-hooks/refs`) «render paytida ref o'qildi» deb yiqitadi.
 *   const { anchorRef, floatingRef, floatingStyles } = usePopover<HTMLButtonElement>({ open, matchWidth: true, maxHeight: 280 });
 *   useDismiss({ open, refs: [anchorRef, floatingRef], onDismiss: () => setOpen(false) });
 *   <button ref={anchorRef} aria-expanded={open} …/>
 *   {open && (
 *     <Portal layer="dropdown" anchor={anchorRef}>
 *       <div ref={floatingRef} style={floatingStyles} role="listbox">…</div>
 *     </Portal>
 *   )}
 */
export const usePopover = <A extends HTMLElement = HTMLElement, F extends HTMLElement = HTMLDivElement>({
  open,
  placement = "bottom-start",
  offset = 8,
  padding = 8,
  matchWidth = false,
  maxHeight,
}: UsePopoverOptions): UsePopoverResult<A, F> => {
  const anchorRef = useRef<A>(null);
  const floatingRef = useRef<F>(null);
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  const update = useCallback(() => {
    const anchor = anchorRef.current;
    const floating = floatingRef.current;
    if (!anchor || !floating || !anchor.isConnected || !floating.isConnected) return;
    const rect = anchor.getBoundingClientRect();
    const next = computePopoverPosition({
      anchor: rect,
      floating: { width: floating.offsetWidth, height: Math.min(naturalHeight(floating), maxHeight ?? Infinity) },
      viewport: readViewport(),
      placement,
      offset,
      padding,
      matchWidth,
    });
    setPosition((prev) => (samePosition(prev, next) ? prev : next));
  }, [placement, offset, padding, matchWidth, maxHeight]);

  useLayoutEffect(() => {
    if (!open) return;
    update();

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };

    const vv = window.visualViewport;
    window.addEventListener("resize", schedule);
    // Capture: har qanday skroll konteyneri (shell `<main>`, jadval, dialog tanasi).
    window.addEventListener("scroll", schedule, true);
    vv?.addEventListener("resize", schedule);
    vv?.addEventListener("scroll", schedule);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    if (anchorRef.current) observer?.observe(anchorRef.current);
    if (floatingRef.current) observer?.observe(floatingRef.current);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      vv?.removeEventListener("resize", schedule);
      vv?.removeEventListener("scroll", schedule);
      observer?.disconnect();
    };
  }, [open, update]);

  const current = open ? position : null;
  const floatingStyles: CSSProperties = {
    position: "fixed",
    top: current?.top ?? 0,
    left: current?.left ?? 0,
    width: current?.width,
    minWidth: current?.minWidth,
    maxWidth: current?.maxWidth,
    maxHeight:
      current === null
        ? maxHeight
        : maxHeight === undefined
          ? current.availableHeight
          : Math.min(maxHeight, current.availableHeight),
    visibility: current ? undefined : "hidden",
  };

  return {
    anchorRef,
    floatingRef,
    floatingStyles,
    placement: current?.placement ?? placement,
    side: current?.side ?? splitPlacement(placement)[0],
    isPositioned: current !== null,
    update,
  };
};
