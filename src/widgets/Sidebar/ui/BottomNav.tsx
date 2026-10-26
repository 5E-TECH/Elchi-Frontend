// dizayn-v2: shell
import { memo, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Menu, ScanLine, type LucideIcon } from "lucide-react";
import type { RootState } from "../../../app/config/store";
import { preloadRoute } from "../../../app/lib/routePreload";
import { cx } from "../../../shared/lib/cx";
import { openScanner, UNIVERSAL_SCANNER_PATH } from "../../../shared/lib/scanner/scannerHost";
import { getActiveScanTarget, useActiveScanTarget } from "../../../shared/lib/scanner/scanTargets";
import { preloadScannerCamera } from "../../../shared/ui/camera/loadScannerCamera";
import { useShellBottomInsetSource } from "../../../shared/ui/primitives";
import {
    getSidebarConfigForUser,
    normalizeSidebarRole,
    type SidebarUserRole,
} from "../model/menuConfig";
import { getActiveNavPath, useMobileMenu, useNavPathname } from "../model/shellNav";
import { formatNavCount, NEW_ORDERS_NAV_PATH, useNewOrdersNavCount } from "../model/navSections";

/**
 * TELEFON PASTKI MENYUSI (< 768) — maket `.el-bottomnav` / `.el-bn-*` (design/kit/helmet.html),
 * taxtalar `tizim-responsive` (05 · Pastki menyu) va `tizim-states-navigation` (06 · Telefon navigatsiyasi).
 *
 * - 5 ta teng katak, balandligi 64px + `env(safe-area-inset-bottom)`; fon `surface`, ustida 1px `border`
 *   (shaffof/xira emas). Shell slot'i (`dashboardLayout`) uni faqat telefonda ko'rsatadi va ustun pastidan
 *   shuncha joy qoldiradi (`--shell-bottomnav-h`). Haqiqiy balandlik `:root` ga ham yoziladi
 *   (`--shell-bottom-inset`, px; ≥ 768 da 0) — `#ui-portal` dagi ro'yxat/kalendar (`usePopover`) uni chetlaydi.
 * - Katak: ikonka 22px (yon menyudagi bilan bir xil) + yorliq 12px/600, BITTA qatorda — sig'masa «…» bilan
 *   kesiladi (ikki qatorga o'tmaydi, shrift kichraymaydi). Yorliq qisqa shaklda: «Qabul va yaratish» → «Qabul».
 *   Butun katak bosiladi (≈ 75–78 × 64px ≥ 44px).
 * - Ochiq bo'lim: ikonka va yorliq `action-fg` (`aria-current="page"`), fon o'zgarmaydi; qolganlari `text-muted`.
 *   Faol band `useNavPathname()` dan — bosilgan katak sahifa yuklanguncha ham darhol tanlangan ko'rinadi.
 * - Skaner rollarida markazda ko'tarilgan «Skaner» (52px `action` doira, 4px `surface` hoshiya, soya) —
 *   KONTEKSTLI (ega roziligi 2026-10-19, skaner 1-bosqichi): sahifa skan maqsadini ro'yxatdan o'tkazgan bo'lsa
 *   (`useScanTarget`) kamera shu sahifa ustida o'sha maqsad bilan ochiladi (`openScanner`, `ScannerHost`),
 *   `aria-label` uni aytadi («Skaner — Qabul qilish»); aks holda universal skaner `/scan` (telefonda to'liq
 *   ekran, pastki menyusiz). Ko'rinish o'zgarmaydi. Skaner faqat `roleHasScanner` rollarida (market, market
 *   operatori, logist, investorda yo'q — kataklari oddiy bo'limlar).
 * - Oxirgi katak «Menyu» — qolgan bo'limlar suriluvchi menyuda (`useMobileMenu().open()`, shell shartnomasi).
 * - Fokus faqat klaviaturada: 2px `action` halqa katak ICHIDA (−6px oraliq), burchak 12px.
 *
 * Bandlar to'plami `design/kit/roles.json` → `bottomNav` bilan bir xil (testda solishtiriladi). Bo'lim katagi
 * faqat foydalanuvchining O'Z menyusida (`getSidebarConfigForUser` — rol + filial turi) bor bandni ko'rsatadi:
 * ruxsat qoidasi bitta joyda qoladi, pastki menyu yangi yo'l ochmaydi.
 */

/** Bo'lim katagi: menyu bandi kaliti (`NavItem.label`). Bir nechta kalit — birinchi mavjudi (filial turiga qarab). */
type LinkSlot = { kind: "link"; keys: readonly string[] };
type BottomNavSlot = LinkSlot | { kind: "scan" } | { kind: "menu" };

const SCAN: BottomNavSlot = { kind: "scan" };
const MENU: BottomNavSlot = { kind: "menu" };
const link = (...keys: string[]): LinkSlot => ({ kind: "link", keys });

/** Universal skaner (`ScanLayout`, telefonda to'liq ekran kamera). */
const SCANNER_PATH = UNIVERSAL_SCANNER_PATH;

const SCANNER_ROLE_SLOTS: readonly BottomNavSlot[] = [link("dashboard"), link("orders"), SCAN, link("newOrders"), MENU];

/**
 * Rol → kataklar (maket `roles.json` → `bottomNav`).
 *
 * Menejer: maketda HYBRID filial (to'liq menyu) chizilgan — 4-katak «Biriktirish». Filialda jo'natish yo'q
 * (HQ, PICKUP) bo'lsa — «Qabul» (boshqa skaner rollaridagidek); filial turi aniqlanmasa (bazaviy menyu) —
 * «Mahsulotlar». Markazdagi «Skaner» joyidan siljimasin deb katak bo'sh qoldirilmaydi.
 */
const BOTTOM_NAV_SLOTS: Record<SidebarUserRole, readonly BottomNavSlot[]> = {
    superadmin: SCANNER_ROLE_SLOTS,
    admin: SCANNER_ROLE_SLOTS,
    registrator: SCANNER_ROLE_SLOTS,
    manager: [link("dashboard"), link("orders"), SCAN, link("dispatch", "newOrders", "products"), MENU],
    courier: [link("dashboard"), link("orders"), SCAN, link("quickAction"), MENU],
    // MO-S1 (ega 2026-10-19): «Mahsulotlar» va «Operatorlar» — «Menyu» varaqasida.
    market: [link("dashboard"), link("orders"), link("newOrders"), link("payments"), MENU],
    /**
     * Yangi rollar (ROL-0) — maketdagi kataklar; menyu bandlari hali yo'q, shuning uchun katak o'z sahifasi
     * menyuga kirganda paydo bo'ladi (LG-1/LG-5, MO-2/MO-3, IN-1/IN-2). Investorda 4 katak (ega IN-S2),
     * market operatorida «Menyu» yo'q — 5 bo'lim (MO-3 da to'liq): Bosh sahifa · Buyurtmalar · Yaratish ·
     * Mahsulotlar · Daromadim. Skaner yo'q (`roleHasScanner`).
     */
    logist: [link("dashboard"), link("orders"), link("couriers"), link("regions"), MENU],
    market_operator: [link("dashboard"), link("orders"), link("newOrders"), link("products"), link("earnings")],
    investor: [link("dashboard"), link("investments"), link("profits"), MENU],
};

/** Menyu kaliti → qisqa yorliq (`ui:shell.bottomNav.*`, maket `roles.json` → `short`). */
const SHORT_LABEL: Record<string, string> = {
    dashboard: "home",
    orders: "orders",
    newOrders: "intake",
    dispatch: "dispatch",
    quickAction: "quickAction",
    products: "products",
    payments: "payments",
    earnings: "earnings",
};

/** Rolga xos qisqa yorliq: marketda «Qabul va yaratish» — «Yaratish» (market faqat yaratadi). */
const SHORT_LABEL_BY_ROLE: Partial<Record<SidebarUserRole, Record<string, string>>> = {
    market: { newOrders: "create" },
    // MO-2/MO-3: «Buyurtma yaratish» → «Yaratish».
    market_operator: { newOrders: "create" },
    // IN-2: «Investitsiya», «Foyda» (maket `roles.json` → investor.menu.short).
    investor: { investments: "investments", profits: "profits" },
};

type BottomNavEntry =
    | { kind: "link"; key: string; to: string; end?: boolean; icon: LucideIcon; label: string }
    | { kind: "scan"; key: "scan"; to: string; label: string }
    | { kind: "menu"; key: "menu"; label: string };

/* ─── Klasslar (CODE-MAP 2.10 · `.el-bottomnav`, `.el-bn-*`) ─────────────── */

/**
 * Panel: jami 64px (ustki chiziq ichida, maketdagidek) + pastki xavfsiz hudud — shell qoldirgan
 * `--shell-bottomnav-h` bilan aynan teng; teng ustunlar. `z-30` («Yopishqoq» qatlam, `tizim-motion` 08):
 * sahifa mazmunidan yuqori; yuqori panel slotidan (`z-40` — profil menyusi kabi ochiladigan ro'yxatlar
 * pastki menyuni yopadi), yuqori chiziq (`z-50`), suriluvchi menyu va dialoglardan past.
 */
const BAR =
    "fixed inset-x-0 bottom-0 z-30 grid h-[calc(4rem+env(safe-area-inset-bottom))] auto-cols-fr grid-flow-col " +
    "border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden";
/**
 * Katak. `-outline-offset-6!` — global `:focus-visible` halqasi (`index.css`, qatlamsiz) katak ichiga
 * (maket: «−6px oraliq, burchak 12px»); `!` usiz qatlamdagi utilita uni yutolmaydi (`Tabs` dagidek).
 */
const ITEM =
    "group flex min-w-0 flex-col items-center justify-end gap-0.5 rounded-xl px-0.5 pb-[9px] " +
    "text-xs font-semibold no-underline -outline-offset-6! " +
    "transition-[color] duration-150 motion-reduce:transition-none aria-[current=page]:text-action-fg";
/** `.el-bn-label`: bitta qator, sig'masa «…». */
const LABEL = "block max-w-full truncate tracking-[-0.01em]";
/**
 * `.el-bn-fab`: 52px doira, 28px yuqoriga, 4px `surface` hoshiya, soya (`--shadow-2` → `shadow-xl`).
 * Bosilganda (`tizim-states-navigation` 3): `action-hover`, 94%, atrofida 6px och halqa — 120 ms.
 * Halqa rangi `focus` (maket: `box-shadow: 0 0 0 6px var(--focus)`): `action-soft` kunduzgi mavzuda oq
 * `surface` ustida deyarli ko'rinmaydi (#e8edfd ↔ #fff).
 * Tailwind v4 `scale-*` — CSS `scale` xususiyati (`transform` emas), o'tish ro'yxatida shu nom.
 */
const FAB =
    "-mt-7 inline-flex size-13 flex-none items-center justify-center rounded-full border-4 border-surface " +
    "bg-action text-on-solid shadow-xl transition-[scale,background-color,box-shadow] duration-[120ms] " +
    "motion-reduce:transition-none group-active:scale-[.94] group-active:bg-action-hover " +
    "group-active:ring-6 group-active:ring-focus";

/**
 * Son belgisi (taxta `tizim-states-navigation` 06 · 4 «Son belgisi»): ikonka burchagida `.el-dotcount` — yangi =
 * `info` rang, 2px `surface` hoshiya, 22×20; 99 dan ko'pi «99+». Ekran o'quvchi nomi «Qabul, 7 ta yangi».
 */
const NAV_COUNT =
    "pointer-events-none absolute -right-[13px] -top-[7px] h-5 min-w-[22px] rounded-full border-2 border-surface " +
    "bg-info px-1 text-center text-xs font-bold leading-4 text-on-solid";

const NAV_ICON_SIZE = 22;
const FAB_ICON_SIZE = 24;

const BottomNav = () => {
    const { t } = useTranslation(["ui", "sidebar"]);
    const { role } = useSelector((state: RootState) => state.role);
    const user = useSelector((state: RootState) => state.user.user);
    const { isOpen: isMenuOpen, open: openMenu } = useMobileMenu();
    const pathname = useNavPathname();
    const scanTarget = useActiveScanTarget();

    // ⚠️ "admin" ga fallback YO'Q: menyusi yo'q rol (masalan operator) avval
    // telefonda admin havolalarini ko'rardi va ularning hammasi 403 berardi.
    // Desktop Sidebar ham shunday rolga bo'sh menyu ko'rsatadi.
    const userRole = normalizeSidebarRole(role, user);

    const menuItems = useMemo(() => (userRole ? getSidebarConfigForUser(userRole, user) : []), [userRole, user]);
    // GaBIPi3Z: «Qabul» katagidagi son — yon menyu bilan bir kesh yozuvi (`new_incoming`).
    const newOrdersCount = useNewOrdersNavCount(userRole, menuItems);
    const newOrdersBadge = formatNavCount(newOrdersCount);

    const entries = useMemo<BottomNavEntry[]>(() => {
        if (!userRole) return [];
        const shortLabels = { ...SHORT_LABEL, ...SHORT_LABEL_BY_ROLE[userRole] };
        const result: BottomNavEntry[] = [];

        for (const slot of BOTTOM_NAV_SLOTS[userRole]) {
            if (slot.kind === "scan") {
                result.push({ kind: "scan", key: "scan", to: SCANNER_PATH, label: t("ui:shell.bottomNav.scanner") });
                continue;
            }
            if (slot.kind === "menu") {
                result.push({ kind: "menu", key: "menu", label: t("ui:shell.bottomNav.menu") });
                continue;
            }
            const item = slot.keys
                .map((key) => menuItems.find((menuItem) => menuItem.label === key))
                .find((menuItem) => menuItem !== undefined);
            if (!item) continue;
            const shortKey = shortLabels[item.label];
            result.push({
                kind: "link",
                key: item.label,
                to: item.to,
                end: item.end,
                icon: item.icon,
                label: shortKey ? t(`ui:shell.bottomNav.${shortKey}`) : t(`sidebar:${item.label}`),
            });
        }
        return result;
    }, [userRole, menuItems, t]);

    // Faol katak: eng uzun mos yo'l (`/orders/123` → «Buyurtmalar»); «Menyu» — yo'lsiz, hech qachon tanlanmaydi.
    const activeTo = useMemo(
        () => getActiveNavPath(entries.flatMap((entry) => (entry.kind === "menu" ? [] : [entry])), pathname),
        [entries, pathname],
    );

    // Balandlik `:root` ga (`--shell-bottom-inset`): portal qatlamidagi ro'yxat/kalendar pastki menyu ostida qolmaydi.
    const navRef = useRef<HTMLElement>(null);

    // Birorta bo'lim katagi yo'q (menyusi hali bo'sh yangi rol) — yolg'iz «Menyu» chizilmaydi: suriluvchi menyu
    // yuqori paneldagi menyu tugmasidan ochiladi.
    const hasSection = entries.some((entry) => entry.kind !== "menu");
    useShellBottomInsetSource(navRef, hasSection);

    if (!hasSection) return null;

    return (
        <nav ref={navRef} aria-label={t("ui:shell.bottomNav.label")} data-bottomnav className={BAR}>
            {entries.map((entry) => {
                if (entry.kind === "menu") {
                    return (
                        <button
                            key={entry.key}
                            type="button"
                            onClick={openMenu}
                            aria-haspopup="dialog"
                            aria-expanded={isMenuOpen}
                            title={entry.label}
                            className={cx(ITEM, "text-text-muted")}
                        >
                            <Menu size={NAV_ICON_SIZE} strokeWidth={2} aria-hidden="true" className="flex-none" />
                            <span className={LABEL}>{entry.label}</span>
                        </button>
                    );
                }

                const isActive = entry.to === activeTo;
                const preload = () => preloadRoute(entry.to);

                if (entry.kind === "scan") {
                    // Faol skan maqsadi bor — kamera shu sahifa ustida (havola o'tishi to'xtatiladi); yo'q — `/scan`.
                    const preloadScanner = () => (getActiveScanTarget() ? preloadScannerCamera() : preload());
                    return (
                        <Link
                            key={entry.key}
                            to={entry.to}
                            aria-current={isActive ? "page" : undefined}
                            aria-label={
                                scanTarget
                                    ? t("ui:shell.scanFor", { action: entry.label, target: scanTarget.title })
                                    : undefined
                            }
                            aria-haspopup={scanTarget ? "dialog" : undefined}
                            title={entry.label}
                            data-bottomnav-scan
                            onClick={(event) => {
                                if (!getActiveScanTarget()) return;
                                event.preventDefault();
                                openScanner();
                            }}
                            onPointerEnter={preloadScanner}
                            onFocus={preloadScanner}
                            onTouchStart={preloadScanner}
                            className={cx(ITEM, "text-text")}
                        >
                            <span className={FAB}>
                                <ScanLine size={FAB_ICON_SIZE} strokeWidth={2} aria-hidden="true" />
                            </span>
                            <span className={LABEL}>{entry.label}</span>
                        </Link>
                    );
                }

                const Icon = entry.icon;
                const count = entry.to === NEW_ORDERS_NAV_PATH ? newOrdersBadge : null;
                return (
                    <Link
                        key={entry.key}
                        to={entry.to}
                        aria-current={isActive ? "page" : undefined}
                        aria-label={
                            count
                                ? `${entry.label}, ${t("sidebar:newCount", { count: newOrdersCount ?? 0 })}`
                                : undefined
                        }
                        title={entry.label}
                        onPointerEnter={preload}
                        onFocus={preload}
                        onTouchStart={preload}
                        className={cx(ITEM, "text-text-muted")}
                    >
                        {count ? (
                            <span className="relative inline-flex flex-none">
                                <Icon size={NAV_ICON_SIZE} strokeWidth={2} aria-hidden="true" />
                                <span aria-hidden="true" data-bottomnav-count className={NAV_COUNT}>
                                    {count}
                                </span>
                            </span>
                        ) : (
                            <Icon size={NAV_ICON_SIZE} strokeWidth={2} aria-hidden="true" className="flex-none" />
                        )}
                        <span className={LABEL}>{entry.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
};

export default memo(BottomNav);
