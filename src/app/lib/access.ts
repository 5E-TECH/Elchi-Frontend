import type { RootState } from "../config/store";
import {
  getUserBranchType,
  managerHasCapability,
  registratorCanDispatch,
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

/**
 * Barcha rollarda bor edi. MO-3 (ega 2026-10-19): market operatori — o'z marketi buyurtmalari (backend `GET /orders`
 * operatorni `user.market_id` ga cheklaydi, tafsilot `assertCanViewOrder` — faqat o'z marketi); faqat ko'rish va Excel.
 */
export const canViewOrders: Predicate = hasRole(
  "superadmin",
  "admin",
  "market",
  "market_operator",
  "registrator",
  "courier",
  "manager",
);

/**
 * «Bekor qilish sabablari» hisoboti (GNWDKvmZ): superadmin va admin — filtr bilan, menejer va market — o'z doirasi.
 * Kartada boshqa rol yozilmagan.
 */
export const canViewCancelReasons: Predicate = hasRole("superadmin", "admin", "manager", "market");

/**
 * «Almashtirish qaytarmalari» (`/replacement-returns`, lQjt6sKP) — backend `GET orders/replacement/returns`
 * `@Roles(SUPERADMIN, ADMIN, MARKET)` bilan bir xil: superadmin va admin — hamma marketlar (market filtri bilan),
 * market — faqat o'zinikilar (token). Menyu bandi — superadmin va adminda (BeePost kabi); market (menyusiz) — /orders
 * sarlavhasidagi «Almashtirishlar» havolasi orqali. Registrator backend'da 403 oladi, shuning uchun bu yerda ham yo'q.
 */
export const canViewReplacementReturns: Predicate = hasRole("superadmin", "admin", "market");

/**
 * «Qo'shimcha xarajatli buyurtmalar» (`/extra-costs`, GykuOz8f) — backend `GET orders/extra-costs`
 * `@Roles(COURIER, MANAGER, MARKET, MARKET_OPERATOR)` bilan bir xil: kuryer — o'zi yozganlari, menejer — o'z filiali
 * kuryerlari va o'zi (har filial turida), market — o'z marketi, operator — o'z marketi (faqat ko'rish). Admin va
 * superadmin — karta bo'yicha bu sahifa YO'Q (backend ham 403).
 */
export const canViewExtraCosts: Predicate = hasRole("courier", "manager", "market", "market_operator");

/**
 * Investor kabinetini nazorat uchun ko'rish (vpKijXce): `/investor/:id`. Backend `investors/:id/dashboard` adminga
 * ham ochiq, lekin kirish nuqtasi — Ops «Investorlar» (faqat superadmin), shuning uchun karta matnidagidek superadmin.
 */
export const canViewInvestorControl: Predicate = hasRole("superadmin");

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

/**
 * Telegram guruhlari (`/notifications`) — backend `GET|POST|PATCH|DELETE /notifications` `@Roles(SUPERADMIN, ADMIN)`
 * bilan bir xil (ega NG-S2, 2026-10-19: adminga ham ochiladi).
 */
export const canViewNotifications: Predicate = hasRole("superadmin", "admin");

/** Xabar yuborish (`/notifications/send`) — backend `POST /notifications/dispatch` `@Roles(SUPERADMIN, ADMIN)` bilan AYNAN bir xil. */
export const canSendNotifications: Predicate = hasRole("superadmin", "admin");

/**
 * Kassa xarajati kategoriyalarini qo'shish / tahrirlash / o'chirish (Elchi Pochta №1) — backend `POST|PATCH|DELETE
 * finance/cashbox/expense-categories` `@Roles(SUPERADMIN)` bilan AYNAN bir xil. Ro'yxatni (tanlov) admin va
 * menejer ham o'qiydi — bu predikat faqat boshqaruv uchun.
 */
export const canManageExpenseCategories: Predicate = hasRole("superadmin");

/** Filiallar (`/branches`, yaratish va tahrirlash) — backend `branches` endpointlari `@Roles(SUPERADMIN, ADMIN)` bilan bir xil (ega 2026-11-02). */
export const canViewBranches: Predicate = hasRole("superadmin", "admin");

export const canViewLogs: Predicate = hasRole("superadmin");

/**
 * Dizayn v2 komponentlar to'plami (`/ops/ui-kit`) — ichki namuna sahifasi.
 * Faqat superadmin; menyuda YO'Q (URL orqali ochiladi). Ma'lumot o'qimaydi,
 * lekin ichki vosita bo'lgani uchun boshqa rollarga ko'rinmaydi.
 */
export const canViewUiKit: Predicate = hasRole("superadmin");

// ═════════ Filial qobiliyatiga bog'liq guardlar ═════════

/**
 * `/dispatch` — buyurtmani kuryerga berish.
 *
 * Registrator: filial turi aniq bo'lsa (HQ · REGIONAL · HYBRID · PICKUP) —
 * `registratorCanDispatch`. HQ registratori 2026-10-01 da qo'shildi.
 *
 * ⚠️ AVVALGI NOMUVOFIQLIK TUZATILDI. Bu yerda registrator SHARTSIZ ✓ edi,
 * `routes.tsx` esa o'z guardida HQ va noma'lum turni rad etardi. Endi marshrut
 * shu predikatni to'g'ridan-to'g'ri ishlatadi — ikkalasi ajralib keta olmaydi.
 */
export const canViewDispatchPage: Predicate = anyOf(
  hasRole("superadmin", "admin"),
  (state) => roleOf(state) === "registrator" && registratorCanDispatch(userOf(state)),
  managerCan("dispatch"),
);

/**
 * Pochtani filialga jo'natish (pochta sahifasidagi "Pochtani jo'natish"
 * tugmasi va filial tanlash oynasi).
 *
 * Backend bilan AYNAN bir xil: GET /branches/dispatch-destinations va
 * POST /branches/posts/:postId/dispatch faqat superadmin/admin yoki HQ
 * filialidagi registratorga ruxsat beradi. REGIONAL/HYBRID/PICKUP
 * registratorlari va menejerlar tugmani ko'rmaydi — ular uchun server doim
 * 403 qaytaradi.
 */
/** Jo'natilgan, hali qabul qilinmagan pochtani boshqa filialga o'tkazish — faqat superadmin/admin (backend bilan bir xil). */
export const canReassignPostToBranch: Predicate = hasRole("superadmin", "admin");

export const canDispatchPostToBranch: Predicate = anyOf(
  hasRole("superadmin", "admin"),
  (state) => roleOf(state) === "registrator" && branchTypeOf(state) === "HQ",
);

/**
 * «Yangi pochtalar» (`GET post/new` — HQ'dagi hali jo'natilmagan pochtalar, `/mails/today` xodim ro'yxati va
 * skanerning «Pochtani jo'natish» varag'i). Backend `assertNewPostsRequester` bilan bir xil (Elchi-Backend #620,
 * anKpzwxk): superadmin, admin va HQ filialidagi registrator; filial turi noma'lum — yo'q (fail-closed). Boshqa
 * registratorda server 403 `new_posts_hq_only` qaytaradi — unga «Bugungi» tabi ko'rsatilmaydi, so'rov ketmaydi.
 * Menejer bu yerda yo'q (ega Q2 sukuti): uning «Bugungi»si — o'z filialiga kelayotgan pochtalar
 * (`post?status=sent&branch_id`), HQ menejerida ham.
 */
export const canViewNewPosts: Predicate = anyOf(
  hasRole("superadmin", "admin"),
  (state) => roleOf(state) === "registrator" && branchTypeOf(state) === "HQ",
);

/**
 * Rad etilgan (kuryer qaytargan, `canceled`) pochtani qabul qilish — `/mails/:id` (`type: "refused"`) dagi
 * «Rad etilgan pochtani qabul qilish» (`POST post/cancel/receive/:id`, backend
 * `@Roles(MANAGER, REGISTRATOR, ADMIN, SUPERADMIN)`). Pochta sahifasining o'z shartini AYNAN takrorlaydi
 * (`canReceiveRefusedPost`: superadmin/admin, filial turi aniq menejer, HQ registratori; kuryerda bu sahifa faqat
 * o'qish) va `/mails` marshrutiga kirish bilan (`canViewMails` — PICKUP menejerida pochta yo'q). Universal skaner
 * «Rad etilgan pochta» rejimi (Trello vNcGDnNh) shu bilan ko'rsatiladi; boshqa rollarda sahifa tugmasi o'chiq.
 */
export const canReceiveRefusedMail: Predicate = (state) =>
  canViewMails(state) &&
  (hasRole("superadmin", "admin")(state) ||
    (roleOf(state) === "manager" && branchTypeOf(state) !== null) ||
    (roleOf(state) === "registrator" && branchTypeOf(state) === "HQ"));

/**
 * Bekor qilingan mollarni marketga QR orqali topshirish ("Yangi buyurtmalar"
 * → "Bekor qilinganlar" tabi va market bo'yicha topshirish sahifasi).
 *
 * fix3 CODE-16 / C4: HQ registratori qo'shildi. Mollar HQ omborida turadi va
 * ularni aynan HQ registratori marketga beradi; backend topshirish endpointi
 * (POST /orders/markets/:id/cancelled/handover) REGISTRATOR ga ruxsat beradi,
 * ro'yxat endpointlari esa HQ registratoriga HQ dagi bekorlarni qaytaradi.
 * Boshqa filial registratorlari — yo'q (mollar ularda turmaydi).
 */
export const canHandoverCancelledToMarket: Predicate = anyOf(
  hasRole("superadmin", "admin"),
  (state) => roleOf(state) === "registrator" && branchTypeOf(state) === "HQ",
);

/**
 * Mahsulot YARATISH va TAHRIRLASH — faqat Elchi xodimlari: SUPERADMIN, ADMIN, REGISTRATOR, MANAGER (backend
 * POST /product; market_id majburiy — xodim mahsulotni qaysi market uchun yaratishini tanlaydi).
 * MH-1 (ega qarori 2026-10-15): market endi faqat ko'radi — ro'yxatda «Mahsulot yaratish» va amallar yo'q,
 * `/products/create-product/:id` marketga 403. Backend market yozish yo'llarini keyin yopadi (Pc4CAFdB).
 */
export const canCreateProducts: Predicate = hasRole("superadmin", "admin", "registrator", "manager");

/**
 * Mahsulotlar ro'yxati (`/products`) — avval `routes.tsx` da qo'lda nusxalangan `canManageProducts` edi (ROL-0
 * shu yerga ko'chirdi). Market va market operatori (MH-1) — faqat ko'rish (`GET product/my-products`; operatorga
 * biriktirilgan marketi). Operatorning menyu bandi — MO-2 (`menuConfig.tsx`).
 */
export const canViewProducts: Predicate = hasRole(
  "superadmin",
  "admin",
  "market",
  "market_operator",
  "registrator",
  "manager",
);

/**
 * «Operatorlar» (`/market-operators`) — market O'Z operatorlarini boshqaradi (MO-1, ega qarori 2026-10-19). Backend
 * `market-operators` yo'llari faqat `@Roles(MARKET)` (o'z operatorlari, JWT `sub`) — superadmin/admin uchun `/users`.
 * Market operatori o'zi bu sahifani ko'rmaydi.
 */
export const canViewMarketOperators: Predicate = hasRole("market");

/**
 * Admin `DashboardPage` (`/`) — kompaniya bo'yicha tushum, viloyatlar kesimi (`RegionOverviewCard`) va
 * reytinglar. Faqat sanab o'tilgan rollar: yangi rol (logist, market operatori, investor) unga tushib qolmaydi —
 * avval `DashboardEntry` qolgan har rolni shu sahifaga yuborardi va logist kompaniya tushumini ko'rardi
 * (mDfjKeQi). Ularning o'z bosh sahifasi `DashboardEntry` da (LG-1 logist, MO-2 market operatori — market bosh sahifasi
 * operator rejimida, IN-1 investor). `operator` — avvalgidek (sahifa uni alohida qisqartiradi: kompaniya bloklarisiz). Market va menejerning o'z
 * bosh sahifasi bor (`DashboardEntry`).
 */
export const canViewAdminDashboard: Predicate = hasRole(
  "superadmin",
  "admin",
  "registrator",
  "courier",
  "operator",
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
 *
 * MO-3 (ega MO-S3): market operatori — faqat «AI bilan» (`POST orders/ai-parse`, `ai-confirm` `@Roles(…
 * MARKET_OPERATOR)`, market serverda `user.market_id` dan). «Qabul va yaratish» qobig'idan unga faqat
 * `/new-orders/create` ochiq (`/new-orders` → shu yerga, qolgan bolalar 403 — `newOrdersShell.ts`). Qo'lda yaratish
 * (`POST /orders`) — backend ruxsatidan keyin (OfRSoRUX, MO-7).
 */
export const canCreateOrders: Predicate = anyOf(
  hasRole("superadmin", "admin", "market", "market_operator", "registrator"),
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

/**
 * Investor kabineti (IN-1, vpKijXce): `/` da `InvestorDashboardPage` — faqat investor roli. Ma'lumot doirasi
 * backendda JWT'dan (`GET investors/me/*`, `@Roles(INVESTOR)`); superadmin/admin investorni `/investors-ops` da ko'radi.
 */
export const canViewInvestorCabinet: Predicate = hasRole("investor");

/**
 * «Hududlar» (`/regions`). Superadmin va admin — butun kompaniya xaritasi; menejer va kuryer — o'z viloyati
 * (`region/my/district-stats`); logist (LG-3, ega LG-S3) — faqat o'ziga biriktirilgan viloyatlar, PULSIZ
 * (`RegionPage` → `LogistRegionView`). Avval `routes.tsx` ichidagi qo'lda yozilgan predikat edi.
 */
export const canViewRegionStats: Predicate = hasRole("superadmin", "admin", "manager", "courier", "logist");

/**
 * «Daromadim» (`/my-earnings`, MO-2, ega 2026-10-19) — faqat market operatori: o'z stavkasi (`GET auth/my-profile` →
 * `commission_type`, `commission_value`). Hisob, to'lovlar va daromadlar ro'yxati — backend `finance/operators/me/*`
 * (E6iEOAVs, MO-6) kelgach; operator boshqa moliya sahifalarini ko'rmaydi.
 */
export const canViewMyEarnings: Predicate = hasRole("market_operator");

/**
 * «Yetkazish tariflari» (`/delivery-tariffs`, 47WFHzlx) — tariflar, hisob qoidalari, kalkulyator, tarix. Backend
 * `GET/POST /delivery/tariffs` va `GET/PATCH /delivery/pricing-settings` faqat SUPERADMIN, ADMIN (boshqa rol — 403).
 * Mahsulot formasidagi narx izohi ham chegara va yaxlitlashni shu rollarda sozlamadan oladi (6FLyjO6j).
 */
export const canManageDeliveryTariffs: Predicate = hasRole("superadmin", "admin");

/**
 * «Ombor» (`/warehouses`, `/warehouses/:id`; yXC91RRx, backend hY7uacJu): superadmin va admin — hamma omborlar,
 * ochish, kirim, inventarizatsiya, to'xtatish (backend yozish faqat SUPERADMIN, ADMIN). Filial menejeri — faqat o'z
 * filiali omborini KO'RADI (ega qarori 10; backend `GET /warehouses*` menejerni o'z filialiga cheklaydi, begonasi
 * 404). Ombor faqat viloyat filialida (REGIONAL, HYBRID) ochiladi — boshqa turdagi filial menejeriga band yo'q.
 */
export const canManageWarehouses: Predicate = hasRole("superadmin", "admin");
/**
 * XtcEyQjb (ega 2026-10-24): HAMMA omborlar ro'yxati — superadmin, admin va REGISTRATOR (registrator faqat ko'radi:
 * yozish tugmalari `canManageWarehouses` bilan). Filial xodimi (menejer) — faqat o'z filiali ombori: menyuda band
 * `GET /warehouses` bo'sh bo'lmasagina (`navSections.ts`), `/warehouses` uni o'z omboriga olib boradi. Kuryer,
 * market, market operatori, mijoz, investor — yo'q (backend `WAREHOUSE_READ_ROLES`).
 */
export const canViewAllWarehouses: Predicate = hasRole("superadmin", "admin", "registrator");
export const canViewWarehouses: Predicate = anyOf(canViewAllWarehouses, managerCan("warehouse"));

/**
 * Kassa smenasi sozlamalari (kiZgTybn: kartalar qoldig'ini tasdiqlash, rasm, AI kalitlari) — backend
 * `PATCH finance/shift/settings` `@Roles(SUPERADMIN)` bilan AYNAN bir xil. O'qish (GET) yopuvchi rollarga ochiq.
 */
export const canManageShiftSettings: Predicate = hasRole("superadmin");

/**
 * cards1111 — kassa kartalarini boshqarish (qo'shish, tahrirlash, asosiy qilish, faollashtirish, o'chirish,
 * kartalararo o'tkazma, karta ↔ naqd). Backend `POST|PATCH finance/cashbox/cards…` — `@Roles(SUPERADMIN, ADMIN)`
 * bilan AYNAN bir xil. Menejer o'z filiali kartalarini faqat ko'radi (ro'yxat va ko'chirma).
 */
export const canManageCashboxCards: Predicate = hasRole("superadmin", "admin");

/**
 * T6 N2 — kassa tarixidagi to'lovni qaytarish va summasini tuzatish («Qaytarish» / «Summani tahrirlash»). Backend
 * `POST finance/history/:id/reverse` va `POST finance/history/:id/correct-amount` — `@Roles(SUPERADMIN)` (servis ham
 * `assertSuperadmin`), `correctable` ham faqat superadmin tafsilotida keladi. Admin va boshqa rollarda tasodifan
 * `correctable` kelsa ham tugma chizilmaydi (ega qarori 2026-11-03).
 */
export const canCorrectPayments: Predicate = hasRole("superadmin");
