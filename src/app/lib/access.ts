import type { RootState } from "../config/store";
import {
  getUserBranchType,
  managerHasCapability,
  type BranchType,
} from "../../widgets/Sidebar/model/menuConfig";

/**
 * ═══════════════ KIRISH HUQUQI — YAGONA MANBA ═══════════════
 *
 * NEGA BU FAYL BOR. Avval yettita marshrut guardi SIDEBAR'dan hosil bo'lardi:
 *
 *   const canViewSidebarPath = (path) => (state) =>
 *     getSidebarConfigForUser(role, user).some((item) => item.to === path);
 *
 * Ya'ni menyu bir vaqtning o'zida ikki ish qilardi: navigatsiya VA ruxsat.
 * Oqibati og'ir edi:
 *
 *   • bandni menyudan olib tashlash = sahifani HAMMAGA yopish (403);
 *   • bandning `to` qiymatini o'zgartirish = xuddi shu natija, chunki moslik
 *     aniq satr tengligi bo'yicha edi;
 *   • menejerning filial turi aniqlanmasa menyu 3 bandga tushardi va u bilan
 *     birga pochta/kassa/xodimlar sahifalari JIMGINA yopilardi.
 *
 * Shu sababli menyuni guruhlash yoki qayta tartiblash imkonsiz edi — har qanday
 * o'zgarish ruxsat xatosiga aylanardi.
 *
 * ENDI yo'nalish teskari: bu yerda ROL va FILIAL QOBILIYATI bo'yicha aniq
 * shartlar yoziladi; sidebar ham, guardlar ham shu manbadan foydalanadi.
 * Menyuni istagancha guruhlash mumkin — ruxsatga ta'sir qilmaydi.
 *
 * ⚠️ Bu qatlam FAQAT UI uchun: u tugmani yashiradi va marshrutni to'sadi.
 * Haqiqiy himoya baribir backend guardlarida — bu yerdagi hech narsa
 * serverdagi rol tekshiruvining o'rnini bosmaydi.
 */

export type Predicate = (state: RootState) => boolean;

const roleOf = (state: RootState) => state.role.role;
const userOf = (state: RootState) => state.user.user;

/** Menejerning filial qobiliyati bor-yo'qligi. */
const managerCan =
  (capability: Parameters<typeof managerHasCapability>[1]): Predicate =>
  (state) =>
    roleOf(state) === "manager" && managerHasCapability(userOf(state), capability);

const hasRole =
  (...roles: string[]): Predicate =>
  (state) => {
    const role = roleOf(state);
    return Boolean(role && roles.includes(role));
  };

const anyOf =
  (...predicates: Predicate[]): Predicate =>
  (state) =>
    predicates.some((predicate) => predicate(state));

export const branchTypeOf = (state: RootState): BranchType | null =>
  getUserBranchType(userOf(state));

// ═════════ Avval sidebar'dan hosil bo'lgan 7 ta guard ═════════
// Har biri o'sha paytdagi ruxsat matritsasini AYNAN takrorlaydi —
// refaktor hech kimning huquqini kengaytirmaydi va toraytirmaydi.

/** Barcha rollarda bor edi. */
export const canViewOrders: Predicate = hasRole(
  "superadmin",
  "admin",
  "market",
  "registrator",
  "courier",
  "manager",
);

/** Menejerlarda: HQ · REGIONAL · HYBRID (PICKUP da YO'Q edi). */
export const canViewMails: Predicate = anyOf(
  hasRole("superadmin", "admin", "registrator", "courier"),
  managerCan("mails"),
);

/** Menejerlarda: REGIONAL · HYBRID. */
export const canViewUsers: Predicate = anyOf(
  hasRole("superadmin", "admin"),
  managerCan("staff"),
);

export const canViewFinancialBalance: Predicate = hasRole("superadmin", "admin");

export const canViewNotifications: Predicate = hasRole("superadmin");

export const canViewBranches: Predicate = hasRole("superadmin");

export const canViewLogs: Predicate = hasRole("superadmin");

// ═════════ Filial qobiliyatiga bog'liq guardlar ═════════

export const canViewDispatchPage: Predicate = anyOf(
  hasRole("superadmin", "admin", "registrator"),
  managerCan("dispatch"),
);

export const canViewCourierBulkPage: Predicate = anyOf(
  hasRole("courier"),
  managerCan("dispatch"),
);

/**
 * Kassa sahifasi.
 *
 * ⚠️ AVVALGI NOMUVOFIQLIK TUZATILDI. HQ menejerining menyusida "/payments"
 * bandi bor edi, lekin marshrut guardi faqat REGIONAL/HYBRID ni qabul qilardi —
 * ya'ni HQ menejeri bandni ko'rib, bosganda 403 olardi. Menyu va guard ikki
 * joyda alohida yozilgani uchun bu farq hech kimga ko'rinmasdi.
 *
 * Endi ikkalasi ham `finance` qobiliyatidan kelib chiqadi (HQ · REGIONAL ·
 * HYBRID), shuning uchun ular ajralib keta olmaydi.
 */
export const canViewPaymentsPage: Predicate = anyOf(
  hasRole("admin", "superadmin"),
  managerCan("finance"),
);

export const canViewBatchesPage: Predicate = anyOf(
  hasRole("superadmin", "admin"),
  managerCan("intake"),
);

export const canViewReturnsPage: Predicate = anyOf(
  hasRole("superadmin", "admin"),
  managerCan("intake"),
);

/**
 * Buyurtma YARATISH.
 *
 * ⚠️ Bu `canReceiveExternalOrders` dan ATAYLAB ajratilgan. Avval ikkalasi bitta
 * shart edi, ya'ni "hamkordan kelgan posilkani qabul qilish" huquqini berish
 * uchun "yangi buyurtma yaratish" huquqini ham berishga to'g'ri kelardi.
 */
export const canCreateOrders: Predicate = anyOf(
  hasRole("superadmin", "admin", "market", "registrator"),
  managerCan("intake"),
);

/**
 * Hamkordan (BeePost) kelgan posilkalarni qabul qilish va tashqi manbalarni
 * boshqarish.
 *
 * `market` roli chetlatilgan: market o'z buyurtmasini yaratadi, lekin boshqa
 * tizimning posilkasini qabul qilmaydi.
 */
export const canReceiveExternalOrders: Predicate = anyOf(
  hasRole("superadmin", "admin", "registrator"),
  managerCan("intake"),
);
