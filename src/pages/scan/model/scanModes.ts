import { useCallback, useMemo, useState } from "react";
import { isMarketSideRole } from "../../../entities/user/lib/role";
import { shallowEqual, useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import { branchTypeOf, canCreateOrders, canViewDispatchPage } from "../../../app/lib/access";
import type { BranchType } from "../../../widgets/Sidebar/model/menuConfig";
import { resolveReceiveMode } from "../../new_orders/components/newOrderReceiveRules";

/**
 * UNIVERSAL SKANER REJIMLARI (`/scan`, Trello v1eLN2tV 3-bosqich; ega qarorlari 2026-10-19).
 *
 *   info     — «Ma'lumot»: bitta kod → natija sahifasi `/scan/:token` (kuryerdan boshqa hamma uchun sukut);
 *   receive  — «Qabul qilish»: avval market tanlanadi, keyin `/new-orders/<marketId>` sahifasida kamera ochiq
 *              davom etadi (2-bosqichdagi F1 oqimi — ikkinchi qabul mantig'i yozilmaydi);
 *   dispatch — «Kuryerga biriktirish»: `/dispatch` sahifasida kamera ochiq, savat qurilmada (F9);
 *   take     — kuryer «O'zimga olish» (kuryerda sukut): ketma-ket skan → `POST orders/scan-assign`.
 *
 * Rejim segmenti rol va filial imkoniyatiga qarab (bitta rejim qolsa — segment chizilmaydi):
 *   - kuryer — «O'zimga olish» · «Ma'lumot»;
 *   - «Qabul qilish» — buyurtma yaratish/qabul sahifasiga kirish bor (`canCreateOrders`) va qabul usuli bor
 *     (`resolveReceiveMode` ≠ `none`: REGIONAL menejer/registratorda yo'q — backend transfer'ni 403 qiladi);
 *   - «Kuryerga biriktirish» — `/dispatch` ga kirish bor VA backend `POST orders/assign-to-courier` rolida
 *     (BRANCH, MANAGER, REGISTRATOR). Superadmin va adminda yo'q — server 403 qaytaradi (Trello 1gxmqLj5).
 *
 * Tanlangan rejim qurilmada eslab qolinadi (`localStorage`, foydalanuvchi bo'yicha kalit, `try/catch` bilan).
 */

export type UniversalScanMode = "info" | "receive" | "dispatch" | "take";

export type ScanModeAccess = {
  role: string | null | undefined;
  branchType: BranchType | null;
  /** `canCreateOrders` — `/new-orders` (qabul) sahifasiga kirish. */
  canCreateOrders: boolean;
  /** `canViewDispatchPage` — `/dispatch` ga kirish. */
  canViewDispatch: boolean;
};

/** `POST orders/assign-to-courier` gateway rollari (backend `@Roles(BRANCH, MANAGER, REGISTRATOR)`). */
const COURIER_ASSIGN_ROLES: ReadonlySet<string> = new Set(["branch", "manager", "registrator"]);

/** Rol va imkoniyatga qarab rejimlar (segment tartibida). Market — skanerlamaydi (bo'sh ro'yxat). */
export const resolveScanModes = ({ role, branchType, canCreateOrders, canViewDispatch }: ScanModeAccess): UniversalScanMode[] => {
  // Market tomoni (market va MO-3 dan beri buyurtma yaratadigan market operatori) — skanerlamaydi.
  if (!role || isMarketSideRole(role)) return [];
  if (role === "courier") return ["take", "info"];
  const modes: UniversalScanMode[] = ["info"];
  if (canCreateOrders && resolveReceiveMode(role, branchType) !== "none") modes.push("receive");
  if (canViewDispatch && COURIER_ASSIGN_ROLES.has(role)) modes.push("dispatch");
  return modes;
};

/** Sukut rejimi: kuryerda «O'zimga olish», qolganlarda «Ma'lumot». */
export const defaultScanMode = (modes: readonly UniversalScanMode[]): UniversalScanMode =>
  modes.includes("take") ? "take" : "info";

const STORAGE_PREFIX = "elchi:scan-mode:v1:";

export const scanModeStorageKey = (userId: string | null | undefined) => `${STORAGE_PREFIX}${userId || "anon"}`;

/** `/scan` ni ma'lum rejimda ochish (`navigate("/scan", { state: scanModeState("info") })`), saqlanmaydi. */
export const scanModeState = (mode: UniversalScanMode) => ({ scanMode: mode });

/** Router state'dagi so'ralgan rejim. */
export const requestedScanMode = (state: unknown): unknown =>
  state && typeof state === "object" ? (state as { scanMode?: unknown }).scanMode : undefined;

const isMode = (value: unknown): value is UniversalScanMode =>
  value === "info" || value === "receive" || value === "dispatch" || value === "take";

/** Qurilmadagi rejim (yo'q, buzilgan yoki `localStorage` yopiq — `null`). */
export const readStoredScanMode = (userId: string | null | undefined): UniversalScanMode | null => {
  try {
    const value = window.localStorage.getItem(scanModeStorageKey(userId));
    return isMode(value) ? value : null;
  } catch {
    return null;
  }
};

export const writeStoredScanMode = (userId: string | null | undefined, mode: UniversalScanMode) => {
  try {
    window.localStorage.setItem(scanModeStorageKey(userId), mode);
  } catch {
    // Maxfiy oyna / bloklangan saqlash — rejim shu sessiyada xotirada ishlayveradi.
  }
};

/** Redux holatidan rejim uchun kerakli huquqlar (yagona manba — `app/lib/access.ts`). */
export const scanModeAccessOf = (state: RootState): ScanModeAccess => ({
  role: state.role.role,
  branchType: branchTypeOf(state),
  canCreateOrders: canCreateOrders(state),
  canViewDispatch: canViewDispatchPage(state),
});

/** Joriy foydalanuvchining rejimlari. */
export const useScanModes = (): UniversalScanMode[] => {
  const access = useSelector(scanModeAccessOf, shallowEqual);
  return useMemo(() => resolveScanModes(access), [access]);
};

/**
 * Tanlangan rejim: qurilmada saqlangani (hozir ruxsat etilgan bo'lsa), aks holda sukut. `setMode` qurilmaga
 * yozadi. Ruxsat o'zgarsa (filial turi aniqlandi) — ro'yxatda yo'q rejim sukutga qaytadi.
 * `requested` — shu ochilish uchun rejim (router state `scanModeState`, masalan Sozlamalardagi «Kamerani
 * sinash» — «Ma'lumot», kuryer sinov skanida buyurtmani o'ziga olib qo'ymasin); qurilmaga yozilmaydi.
 */
export const useScanMode = (
  modes: readonly UniversalScanMode[],
  userId: string | null | undefined,
  requested?: unknown,
) => {
  const [chosen, setChosen] = useState<UniversalScanMode | null>(() =>
    isMode(requested) ? requested : readStoredScanMode(userId),
  );
  const mode = chosen && modes.includes(chosen) ? chosen : defaultScanMode(modes);
  const setMode = useCallback(
    (next: UniversalScanMode) => {
      setChosen(next);
      writeStoredScanMode(userId, next);
    },
    [userId],
  );
  return [mode, setMode] as const;
};
