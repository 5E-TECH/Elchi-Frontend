import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, useLocation, type To } from "react-router-dom";
import { cx } from "../../lib/cx";
import { formatNumberLocalized } from "../../lib/formatMoney";
import { IconButton } from "./IconButton";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  TABLAR — dizayn v2 (`.el-tabs` / `.el-tab` / `.el-tab-count`)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Maket: `tizim-states-navigation` (03 «Tablar amalda»), `superadmin-orders-list`,
 *  `admin-balance-*` (havola tablar), `courier-orders-pending` (to'liq enli).
 *  Klasslar: `design/CODE-MAP.md` 2.5.
 *
 *  Ikki rejim:
 *  1. **Tab** (sukut) — sahifa ichidagi bo'lim yoki holat filtri. WAI-ARIA
 *     `tablist` / `tab`: bitta Tab to'xtash joyi (roving tabindex), ← → Home End
 *     fokusni suradi va tabni DARHOL tanlaydi (avtomatik faollashtirish).
 *     Panelni komponent chizmaydi — sahifa o'zi chizadi va `getPanelId` /
 *     `getTabId` bilan bog'laydi (`controlsPanel`).
 *  2. **Havola** (`items[].to`) — har tab alohida route. Bu holda `tablist`
 *     EMAS, `<nav>` + havolalar + `aria-current="page"`: tab ro'li sahifani
 *     almashtirmaydigan, shu sahifadagi panelni ko'rsatadigan boshqaruv uchun.
 *     Route almashtiradigan narsa — navigatsiya: havolani yangi oynada ochish,
 *     brauzer tarixi va «Orqaga» ishlaydi, ekran o'quvchi «joriy sahifa» deb
 *     o'qiydi, klaviatura oddiy Tab bilan yuradi (strelkalar sahifani
 *     almashtirib yubormaydi).
 *
 *  Sig'masa: gorizontal aylantiriladi (aylantirish chizig'i yashirin), chetida
 *  xiralashadi, ≥ 768 da chetda o'q tugmasi chiqadi (telefonda barmoq bilan
 *  suriladi). Tanlangan tab ko'rinadigan joyga o'zi suriladi — yarim ko'ringan
 *  tanlangan tab qolmaydi.
 */

export type TabItem<T extends string = string> = {
  value: T;
  label: ReactNode;
  /** Tab ichidagi son (`formatNumberLocalized`). Nol ham ko'rsatiladi — rangsiz. */
  count?: number;
  icon?: LucideIcon;
  disabled?: boolean;
  /** Qisqa izoh (maslahat), masalan «To'langan va qisman to'langan buyurtmalar». */
  title?: string;
  /**
   * Havola rejimi: tab route'ga olib boradi. Bitta band `to` olsa, hammasi olishi
   * kerak (aralash ro'yxat — xato).
   */
  to?: To;
  /** Havola rejimida `NavLink end`: faqat aynan shu route'da faol. */
  end?: boolean;
};

/** Tablar turgan yuza — chetdagi xiralashish shu rangda chiziladi. */
export type TabsBackground = "surface" | "bg" | "raised" | "sunken";

/**
 * Qolgan atributlar (`className`, `ref`, `data-*` …) tashqi o'ramga o'tadi:
 * tab rejimida `<div>`, havola rejimida `<nav>` (ikkalasi ham `HTMLElement`).
 */
export type TabsProps<T extends string = string> = Omit<
  ComponentProps<"nav">,
  "children" | "onChange" | "defaultValue"
> & {
  items: readonly TabItem<T>[];
  /**
   * Tanlangan tab. Tab rejimida majburiy. Havola rejimida ixtiyoriy: berilsa,
   * faol tabni shu belgilaydi (route parametrli yoki `?query` li sahifalar),
   * berilmasa — `NavLink` route bo'yicha o'zi aniqlaydi.
   */
  value?: T;
  onValueChange?: (value: T) => void;
  /** Ro'yxat nomi (ekran o'quvchi uchun), masalan «Holat bo'yicha». */
  ariaLabel: string;
  /** Tablar butun enni teng bo'lib egallaydi (telefondagi 2–3 ta tab). */
  fullWidth?: boolean;
  /**
   * `id` lar prefiksi: tab `id` = `getTabId(idPrefix, value)`. Panel bilan
   * bog'lash kerak bo'lsa, aniq bering. Sukut — `useId()`.
   */
  idPrefix?: string;
  /**
   * Sahifa tanlangan tab uchun panel chizadi:
   * `<div role="tabpanel" id={getPanelId(p, v)} aria-labelledby={getTabId(p, v)}>`.
   * Shunda tanlangan tab `aria-controls` oladi (faqat u — qolgan panellar DOM'da
   * yo'q, mavjud bo'lmagan `id` ga ishora qilinmaydi).
   */
  controlsPanel?: boolean;
  /** Tablar turgan yuza (sukut `surface` — karta ichida). Sahifa fonida — `bg`. */
  background?: TabsBackground;
  /**
   * Aylanuvchi ro'yxatga qo'shimcha klass. Masalan karta ichida tablar chetdan
   * 12 px ichkarida, ostidagi chiziq esa karta eni bo'yicha: `listClassName="px-3"`.
   */
  listClassName?: string;
};

/** `id` ichida bo'shliq va maxsus belgi bo'lmasin (`aria-controls` — IDREF ro'yxati). */
const idPart = (value: string) =>
  value.replace(/[^A-Za-z0-9_-]/g, (char) => `_${char.charCodeAt(0).toString(16)}`);

/** Tab elementining `id` si. Panel: `aria-labelledby={getTabId(prefix, value)}`. */
// eslint-disable-next-line react-refresh/only-export-components -- tab/panel id sxemasi primitiv bilan birga turadi
export const getTabId = (idPrefix: string, value: string) => `${idPrefix}-tab-${idPart(value)}`;

/** Panel `id` si. Tab `aria-controls` shunga ishora qiladi (`controlsPanel`). */
// eslint-disable-next-line react-refresh/only-export-components -- tab/panel id sxemasi primitiv bilan birga turadi
export const getPanelId = (idPrefix: string, value: string) => `${idPrefix}-panel-${idPart(value)}`;

/* ─── Klasslar (CODE-MAP 2.5) ─────────────────────────────────────────────── */

/**
 * Fokus halqasi tab ICHIGA chiziladi (`-outline-offset-2`): tablar aylanuvchi
 * konteynerda (`overflow-x-auto` → `overflow-y` ham kesadi), maketdagi tashqi
 * halqa (2 px oraliq) ro'yxat chetida kesilib qolardi. `!` faqat shu yerda
 * kerak: global `:focus-visible` dagi `outline-offset: 2px` ataylab qatlamsiz
 * (`index.css`), qatlamdagi oddiy utilita uni yutolmaydi. Burchak esa oddiy
 * `rounded-none` — global `border-radius: 4px` `@layer base` da; tab burchagi
 * to'g'ri (maketdagidek), ostki ko'k chiziq fokusda yumaloqlanmaydi.
 */
const TAB =
  "inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-none border-b-2 text-sm font-semibold " +
  "-outline-offset-2! transition-[background-color,border-color,color,box-shadow,opacity] duration-150 motion-reduce:transition-none max-md:h-12";
const TAB_IDLE = "border-transparent text-text-muted hover:text-text";
const TAB_ACTIVE = "border-action text-text";
const TAB_DISABLED = "cursor-not-allowed border-transparent text-text-muted opacity-45";
/** Oddiy tab: 12 px yon oraliq. To'liq enli: teng bo'lib, markazda, 6 px (maket `courier-orders-pending`). */
const TAB_SIZING = "shrink-0 px-3";
const TAB_SIZING_FULL = "flex-auto justify-center gap-1.5 px-1.5";

const COUNT =
  "inline-flex h-5 min-w-[22px] items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums";
const COUNT_IDLE = "bg-sunken text-text-muted";
const COUNT_ACTIVE = "bg-action-soft text-action-fg";

const FADE_BG: Record<TabsBackground, string> = {
  surface: "bg-surface",
  bg: "bg-bg",
  raised: "bg-raised",
  sunken: "bg-sunken",
};
/** Xiralashish — gradient emas, 4 ta 8 px pog'ona (maketdagi kabi). */
const FADE_STEPS = ["opacity-15", "opacity-35", "opacity-60", "opacity-85"] as const;

/**
 * Chetdagi qoplama eni: xiralashish 32 px; ≥ 768 da + o'q tugmasi bloki 44 px.
 * Tanlangan tab shu qoplama ostida qolmasligi kerak.
 */
const FADE_WIDTH = 32;
const ARROW_BLOCK_WIDTH = 44;

/* ─── Aylantirish ─────────────────────────────────────────────────────────── */

const prefersReducedMotion = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

const scrollListTo = (list: HTMLElement, left: number, smooth: boolean) => {
  const behavior: ScrollBehavior = smooth && !prefersReducedMotion() ? "smooth" : "auto";
  if (typeof list.scrollTo === "function") list.scrollTo({ left, behavior });
  else list.scrollLeft = left;
};

type Edges = { start: boolean; end: boolean };

/**
 * Ro'yxat chap/o'ng chetida yashiringan tab bormi. Aylantirish va o'lcham
 * o'zgarishida (tablar soni yuklanganda ham) qayta o'lchanadi.
 */
const useOverflowEdges = (listRef: RefObject<HTMLElement | null>, itemsKey: string): Edges => {
  const [edges, setEdges] = useState<Edges>({ start: false, end: false });

  useEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;
    const update = () => {
      const max = list.scrollWidth - list.clientWidth;
      const start = max > 1 && list.scrollLeft > 1;
      const end = max > 1 && list.scrollLeft < max - 1;
      setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    list.addEventListener("scroll", update, { passive: true });
    // Brauzer `observe()` dan keyin bir marta o'zi chaqiradi — dastlabki o'lchov shu.
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(update) : null;
    if (observer) {
      observer.observe(list);
      for (const child of Array.from(list.children)) observer.observe(child);
    }
    return () => {
      list.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [listRef, itemsKey]);

  return edges;
};

const edgeRoom = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(min-width: 768px)").matches
    ? FADE_WIDTH + ARROW_BLOCK_WIDTH
    : FADE_WIDTH;

/**
 * Tanlangan tab ko'rinmasa yoki chetdagi xiralashish ostida qolsa — ro'yxatni
 * kerakli qadar (minimal) suradi: tab to'liq ko'rinadi va qoplama ostida
 * qolmaydi. Faqat ro'yxatning o'zi aylanadi (sahifa emas).
 */
const useRevealActive = (listRef: RefObject<HTMLElement | null>, activeKey: string) => {
  const mountedRef = useRef(false);

  useEffect(() => {
    const list = listRef.current;
    const smooth = mountedRef.current;
    mountedRef.current = true;
    if (!list || list.clientWidth === 0) return;
    const tab = list.querySelector<HTMLElement>('[aria-selected="true"], [aria-current="page"]');
    if (!tab) return;

    const max = list.scrollWidth - list.clientWidth;
    if (max <= 0) return;
    // Tab juda keng bo'lsa (tor ekran) — qoplama uchun joy shunchaki kamayadi.
    const room = Math.max(0, Math.min(edgeRoom(), (list.clientWidth - tab.offsetWidth) / 2));
    const viewStart = list.scrollLeft;
    const tabStart = tab.offsetLeft;
    const tabEnd = tabStart + tab.offsetWidth;
    // Chetda qoplama faqat o'sha tomonda yashiringan tab bo'lsa chiqadi.
    const startLimit = viewStart + (viewStart > 0 ? room : 0);
    const endLimit = viewStart + list.clientWidth - (viewStart < max ? room : 0);
    if (tabStart >= startLimit && tabEnd <= endLimit) return;

    const target = tabEnd > endLimit ? tabEnd - list.clientWidth + room : tabStart - room;
    scrollListTo(list, Math.min(max, Math.max(0, target)), smooth);
  }, [listRef, activeKey]);
};

/* ─── Ichki qismlar ───────────────────────────────────────────────────────── */

const TabContent = ({
  item,
  active,
  language,
}: {
  item: TabItem;
  active: boolean;
  language: string | undefined;
}) => {
  const Icon = item.icon;
  return (
    <>
      {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0" /> : null}
      {item.label}
      {/* Bo'shliq — ekran o'quvchi «Yangi 32» deb o'qisin («Yangi32» emas); flex ichida ko'rinmaydi. */}
      {item.count !== undefined ? " " : null}
      {item.count !== undefined ? (
        <span className={cx(COUNT, active ? COUNT_ACTIVE : COUNT_IDLE)}>
          {formatNumberLocalized(item.count, { language })}
        </span>
      ) : null}
    </>
  );
};

const EdgeFade = ({
  side,
  background,
  label,
  onScroll,
}: {
  side: "start" | "end";
  background: TabsBackground;
  label: string;
  onScroll: () => void;
}) => {
  const steps = side === "end" ? FADE_STEPS : [...FADE_STEPS].reverse();
  const fade = steps.map((step) => <span key={step} className={cx("w-2", FADE_BG[background], step)} />);
  // O'q tugmasi (`.el-iconbtn-sm`) faqat sichqoncha uchun: klaviaturada ← →
  // (tablist) yoki Tab (havolalar) fokusni suradi va ro'yxat o'zi aylanadi —
  // shuning uchun Tab tartibiga kirmaydi. Telefonda yo'q (barmoq bilan suriladi).
  const button = (
    <span className={cx("pointer-events-auto flex items-center px-1.5 max-md:hidden", FADE_BG[background])}>
      <IconButton
        size="sm"
        tabIndex={-1}
        label={label}
        icon={side === "end" ? ChevronRight : ChevronLeft}
        onClick={onScroll}
      />
    </span>
  );
  return (
    <div
      data-tabs-edge={side}
      className={cx("pointer-events-none absolute inset-y-0 flex", side === "end" ? "right-0" : "left-0")}
    >
      {side === "end" ? fade : button}
      {side === "end" ? button : fade}
    </div>
  );
};

type StripProps = Omit<ComponentProps<"nav">, "children"> & {
  as: "div" | "nav";
  listRef: RefObject<HTMLDivElement | null>;
  listProps: HTMLAttributes<HTMLDivElement>;
  listClassName?: string;
  background: TabsBackground;
  itemsKey: string;
  activeKey: string;
  children: ReactNode;
};

/**
 * Umumiy ramka: ostki chiziq (o'ram `border-b`), aylanuvchi ro'yxat va chetdagi
 * xiralashish. Ro'yxat `-mb-px` bilan o'ram chizig'i ustiga 1 px tushadi — faol
 * tabning 2 px ko'k chizig'i kulrang chiziqni yopadi (maketdagi
 * `.el-tab{margin-bottom:-1px}`); tablarning o'zi ro'yxatdan chiqmaydi, shuning
 * uchun ro'yxatda vertikal aylanish paydo bo'lmaydi.
 */
const TabStrip = ({
  as: Outer,
  listRef,
  listProps,
  listClassName,
  background,
  itemsKey,
  activeKey,
  className,
  children,
  ...rest
}: StripProps) => {
  const { t } = useTranslation("ui");
  const edges = useOverflowEdges(listRef, itemsKey);
  useRevealActive(listRef, activeKey);
  // TS: `div` ham, `nav` ham HTMLElement — `ref` va atributlar bir xil.
  const Tag = Outer as "nav";

  const scrollByPage = (direction: 1 | -1) => {
    const list = listRef.current;
    if (!list) return;
    const max = Math.max(0, list.scrollWidth - list.clientWidth);
    const next = Math.min(max, Math.max(0, list.scrollLeft + direction * list.clientWidth * 0.8));
    scrollListTo(list, next, true);
  };

  return (
    <Tag className={cx("relative min-w-0 border-b border-border", className)} {...rest}>
      <div
        ref={listRef}
        {...listProps}
        className={cx("relative -mb-px flex min-w-0 gap-1 overflow-x-auto overscroll-x-contain scrollbar-hide", listClassName)}
      >
        {children}
      </div>
      {edges.start ? (
        <EdgeFade side="start" background={background} label={t("tabs.scrollPrev")} onScroll={() => scrollByPage(-1)} />
      ) : null}
      {edges.end ? (
        <EdgeFade side="end" background={background} label={t("tabs.scrollNext")} onScroll={() => scrollByPage(1)} />
      ) : null}
    </Tag>
  );
};

/** ← → Home End: keyingi faol (o'chirilmagan) indeks, aylanma. */
const nextIndex = (key: string, current: number, total: number): number | null => {
  if (total === 0) return null;
  switch (key) {
    case "ArrowRight":
      return (current + 1) % total;
    case "ArrowLeft":
      return (current - 1 + total) % total;
    case "Home":
      return 0;
    case "End":
      return total - 1;
    default:
      return null;
  }
};

/* ─── Rejimlar ────────────────────────────────────────────────────────────── */

type ModeProps<T extends string> = Omit<TabsProps<T>, "idPrefix" | "controlsPanel"> & { prefix: string };

const TabList = <T extends string>({
  items,
  value,
  onValueChange,
  ariaLabel,
  fullWidth = false,
  prefix,
  controlsPanel = false,
  background = "surface",
  listClassName,
  ...rest
}: ModeProps<T> & { controlsPanel?: boolean }) => {
  const { i18n } = useTranslation("ui");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const listRef = useRef<HTMLDivElement>(null);
  const enabled = items.filter((item) => !item.disabled);
  // Roving tabindex: Tab tugmasi tanlangan tabga keladi (u o'chirilgan yoki
  // yo'q bo'lsa — birinchi faol tabga).
  const focusValue = enabled.some((item) => item.value === value) ? value : enabled[0]?.value;

  const select = (next: T) => {
    if (next !== value) onValueChange?.(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const current = enabled.findIndex((item) => item.value === target.dataset.value);
    if (current === -1) return;
    const index = nextIndex(event.key, current, enabled.length);
    if (index === null) return;
    event.preventDefault();
    const next = enabled[index];
    document.getElementById(getTabId(prefix, next.value))?.focus();
    select(next.value);
  };

  return (
    <TabStrip
      as="div"
      listRef={listRef}
      listProps={{ role: "tablist", "aria-label": ariaLabel, onKeyDown }}
      listClassName={cx(fullWidth && "gap-0", listClassName)}
      background={background}
      itemsKey={items.map((item) => item.value).join("|")}
      activeKey={value ?? ""}
      {...rest}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={getTabId(prefix, item.value)}
            data-value={item.value}
            aria-selected={active}
            aria-controls={controlsPanel && active ? getPanelId(prefix, item.value) : undefined}
            tabIndex={item.value === focusValue ? 0 : -1}
            disabled={item.disabled}
            title={item.title}
            onClick={() => select(item.value)}
            className={cx(
              TAB,
              fullWidth ? TAB_SIZING_FULL : TAB_SIZING,
              item.disabled ? TAB_DISABLED : active ? TAB_ACTIVE : TAB_IDLE,
            )}
          >
            <TabContent item={item} active={active} language={language} />
          </button>
        );
      })}
    </TabStrip>
  );
};

const TabNav = <T extends string>({
  items,
  value,
  onValueChange,
  ariaLabel,
  fullWidth = false,
  prefix,
  background = "surface",
  listClassName,
  ...rest
}: ModeProps<T>) => {
  const { i18n } = useTranslation("ui");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const location = useLocation();
  const listRef = useRef<HTMLDivElement>(null);
  const sizing = fullWidth ? TAB_SIZING_FULL : TAB_SIZING;

  return (
    <TabStrip
      as="nav"
      aria-label={ariaLabel}
      listRef={listRef}
      listProps={{}}
      listClassName={cx(fullWidth && "gap-0", listClassName)}
      background={background}
      itemsKey={items.map((item) => item.value).join("|")}
      activeKey={value ?? `${location.pathname}${location.search}`}
      {...rest}
    >
      {items.map((item) => {
        const id = getTabId(prefix, item.value);
        if (item.disabled || item.to === undefined) {
          // Havolani o'chirib bo'lmaydi — o'chirilgan band oddiy matn.
          return (
            <span key={item.value} id={id} aria-disabled="true" title={item.title} className={cx(TAB, sizing, TAB_DISABLED)}>
              <TabContent item={item} active={false} language={language} />
            </span>
          );
        }
        const onClick = () => {
          if (item.value !== value) onValueChange?.(item.value);
        };
        if (value !== undefined) {
          const active = item.value === value;
          return (
            <Link
              key={item.value}
              id={id}
              to={item.to}
              title={item.title}
              aria-current={active ? "page" : undefined}
              onClick={onClick}
              className={cx(TAB, sizing, active ? TAB_ACTIVE : TAB_IDLE)}
            >
              <TabContent item={item} active={active} language={language} />
            </Link>
          );
        }
        return (
          <NavLink
            key={item.value}
            id={id}
            to={item.to}
            end={item.end}
            title={item.title}
            onClick={onClick}
            className={({ isActive }) => cx(TAB, sizing, isActive ? TAB_ACTIVE : TAB_IDLE)}
          >
            {({ isActive }) => <TabContent item={item} active={isActive} language={language} />}
          </NavLink>
        );
      })}
    </TabStrip>
  );
};

/**
 * Tablar (`.el-tabs`). Tab rejimi:
 *
 *   <Tabs idPrefix="orders" ariaLabel={t("orders.byStatus")} controlsPanel
 *     items={[{ value: "all", label: t("…"), count: 1248 }, …]}
 *     value={status} onValueChange={setStatus} listClassName="px-3" />
 *   <div role="tabpanel" id={getPanelId("orders", status)} aria-labelledby={getTabId("orders", status)}>…</div>
 *
 * Havola rejimi: `items[].to` (`value` ixtiyoriy) — `<nav>` + `aria-current="page"`.
 */
export const Tabs = <T extends string = string>({ items, idPrefix, controlsPanel, ...props }: TabsProps<T>) => {
  const autoId = useId();
  const prefix = idPrefix ?? autoId;
  const linkMode = items.some((item) => item.to !== undefined);
  // Havola rejimida panel yo'q (har tab — alohida sahifa), `controlsPanel` e'tiborga olinmaydi.
  return linkMode ? (
    <TabNav items={items} prefix={prefix} {...props} />
  ) : (
    <TabList items={items} prefix={prefix} controlsPanel={controlsPanel} {...props} />
  );
};
