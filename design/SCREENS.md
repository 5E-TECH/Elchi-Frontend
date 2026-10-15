# Ekranlar xaritasi — route ↔ dizayn v2 maketi

> **Avtomatik yaratilgan fayl — qo'lda tahrirlamang.** Manba: `design/kit/route-map.json` (route ↔ maket, qo'lda
> yuritiladi), `src/app/lib/routes.tsx` (yo'llar va guardlar), `design/kit/views.json` (maketlar). Qayta yaratish:
> `npm run design:screens`; tekshirish: `npm run design:screens -- --check`.

**76 ta route** (+ qobiq) · **411 ta maket** (264 sahifa, 134 oyna, 13 tizim taxtasi; 369 ta fragment fayli) · kodda yo'q: **19** · qisman: **4** · v2 ga ko'chirilgan route: **1 / 76**

## Qanday ishlatiladi

1. **Route'ni toping.** Brauzerdagi manzil yoki tegayotgan fayl bo'yicha qidiring:
   `grep -n "src/pages/mails/detail" design/SCREENS.md` yoki `grep -n "/mails/:id" design/SCREENS.md`.
   Fayl qaysi route'ga tegishli ekanini [6-bo'lim](#6-fayl--route) beradi.
2. **Rolingizni tanlang.** Bir sahifani bir nechta rol ko'radi va har rolning o'z maketi bor (`<rol>-<viewId>`);
   o'sha sahifaning oynalari (dialog) va holatlari ham shu jadvalda. Maketi yo'q rol uchun eng yaqin maket izohda.
   Kim ocha olishi — «Rollar» (guardlar), kimning menyusida turgani — «Menyuda» qatori va [7-bo'lim](#7-rol-menyulari--route).
   Maket ostidagi `↳` — o'sha maketni chizadigan aniq fayl (rolga xos komponent yoki alohida oyna fayli).
3. **Fragmentni oching:** `design/fragments/<fragment>.html` — bo'limlar tartibi, aniq matnlar, `el-*` klasslar
   (Tailwind + token + komponentga tarjimasi: `design/CODE-MAP.md`). `.json` — tur, balandlik, qurilmalar.
   Fragment nomi ekran nomidan farq qilishi mumkin (bir nechta rol bitta fragmentni bo'lishadi).
4. **Ko'ring:** `npm run design:shot -- <rol>-<viewId>` → `design/shots/<ekran>--<desktop|tablet|phone>-<light|dark>.png`
   (Claude PNG'ni `Read` qiladi). Bitta ko'rinish: `-- <ekran> --device phone --theme dark`. Hammasi brauzerda:
   `npm run design:preview` (http://127.0.0.1:4199). Tizim taxtalari: `tizim-<nom>`, bosh taxta — `Main`.
5. **Holat ustuni:** `eski` — sahifa hali v2 ga ko'chirilmagan (tegsangiz, `AGENTS.md` qaror oqimi bo'yicha);
   `v2` — ko'chirilgan (asosiy faylning birinchi qatorida `// dizayn-v2: <ekran>`); `yangi (kodda yo'q)` — maket bor,
   kod hali yo'q (qayerga qo'shilishi route ustunida); `qisman` — kodda bir qismi bor (sababi 4-bo'limda).
6. **Route qo'shdingiz, o'chirdingiz yoki sahifani v2 ga ko'chirdingizmi?** `design/kit/route-map.json` ni yangilang
   (yo'l, fayllar, rol → maket; ko'chirilganda faylga `// dizayn-v2:` belgisi) va `npm run design:screens` ni yuring.
   Skript routes.tsx dagi har route xaritada borligini, har maket biror route'ga bog'langanini va fayllar mavjudligini
   tekshiradi. Menyu bandlari (`menuConfig.tsx`) maketdagi menyu (`design/kit/roles.json`) bilan bir xil bo'lishi shart.
   Maket fayllari (`fragments/`, `views.json`, `roles.json`) qo'lda o'zgarmaydi — `route-map.json` bundan mustasno.
   Shu tekshiruv `npm test` ichida ham yuradi (`design/tools/screens.test.mjs`), ya'ni CI'da majburiy.

## Mundarija

1. [Qisqa jadval: route → maketlar](#1-qisqa-jadval-route--maketlar)
2. [Route bo'yicha maketlar (batafsil)](#2-route-boyicha-maketlar-batafsil)
3. [Yo'naltirishlar (eski havolalar)](#3-yonaltirishlar-eski-havolalar)
4. [Maket → kod (teskari, rollar bo'yicha)](#4-maket--kod-teskari-rollar-boyicha)
5. [Dizayn tizimi taxtalari](#5-dizayn-tizimi-taxtalari)
6. [Fayl → route](#6-fayl--route)
7. [Rol menyulari → route](#7-rol-menyulari--route)

## 1. Qisqa jadval: route → maketlar

| Route | Bo'lim | Asosiy fayl | Rollar | Maketlar | Holat |
|---|---|---|---|---|---|
| `(qobiq)` | Qobiq | `src/widgets/layout/dashboardLayout.tsx` | superadmin, admin, manager, registrator, market, courier | 5 | v2 |
| `/login` | Kirish va xato sahifalari | `src/features/auth/index.tsx` | hamma (kirishsiz) | 3 | eski |
| `/403` | Kirish va xato sahifalari | `src/shared/ui/Forbidden.tsx` | hamma (kirishsiz) | 1 | eski |
| `/404` | Kirish va xato sahifalari | `src/shared/ui/NotFound.tsx` | hamma (kirishsiz) | 1 | eski |
| `/500` | Kirish va xato sahifalari | `src/shared/ui/ServerError.tsx` | hamma (kirishsiz) | 1 | eski |
| `/runtime-error` | Kirish va xato sahifalari | `src/shared/ui/ErrorBoundaryPage.tsx` | hamma (kirishsiz) | 1 | eski |
| `/*` | Kirish va xato sahifalari | `src/shared/ui/NotFound.tsx` | superadmin, admin, manager, registrator, market, courier | 1 | eski |
| `/` | Bosh sahifa | `src/pages/dashboard/MarketDashboardPage.tsx` + `src/pages/dashboard/DashboardPage.tsx` | superadmin, admin, manager (→ /branch-dashboard), registrator, market, courier | 8 | eski |
| `/branch-dashboard` | Bosh sahifa | `src/pages/branch-dashboard/ui/BranchDashboardPage.tsx` | manager | 2 | eski |
| `/orders` | Buyurtmalar | `src/pages/orders/index.tsx` | superadmin, admin, manager, registrator, market, courier | 24 | eski |
| `/orders/edit/:orderId` | Buyurtmalar | `src/pages/new_orders/components/new_orderUpdate.tsx` | superadmin, admin, manager, registrator, market, courier | 19 | eski |
| `/new-orders` | Qabul va yaratish | `src/pages/new_orders/markets/index.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market | 4 | eski |
| `/new-orders/create` | Qabul va yaratish | `src/pages/orders/create/index.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market | 23 | eski |
| `/new-orders/incoming` | Qabul va yaratish | `src/pages/incoming-orders/SourcePicker.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator | 3 | eski |
| `/new-orders/incoming/:marketId` | Qabul va yaratish | `src/pages/incoming-orders/index.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator | 7 | eski |
| `/new-orders/branches` | Qabul va yaratish | `src/pages/new_orders/branches/index.tsx` | superadmin, admin | 2 | eski |
| `/new-orders/branches/:branchId` | Qabul va yaratish | `src/pages/new_orders/branches/batches.tsx` | superadmin, admin | 2 | eski |
| `/new-orders/branches/:branchId/batches/:batchId` | Qabul va yaratish | `src/pages/new_orders/branches/batchDetail.tsx` | superadmin, admin | 5 | eski |
| `/new-orders/cancelled` | Qabul va yaratish | `src/pages/new_orders/cancelled/index.tsx` | superadmin, admin, registrator (faqat HQ) | 3 | eski |
| `/new-orders/cancelled/:marketId` | Qabul va yaratish | `src/pages/new_orders/cancelled/detail.tsx` | superadmin, admin, registrator (faqat HQ), market (faqat o'z marketi) | 14 | eski |
| `/new-orders/:marketId` | Qabul va yaratish | `src/pages/new_orders/components/new_orderDetail.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market (faqat o'z marketi) | 17 | eski |
| `/new-orders/:marketId/edit/:orderId` | Qabul va yaratish | `src/pages/new_orders/components/new_orderUpdate.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market (faqat o'z marketi) | 3 | eski |
| `/new-orders/userDetail/:id` | Qabul va yaratish | `src/pages/users/detail/UserDetailPage.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market | 0 | eski |
| `/mails` | Pochta | `src/pages/mails/index.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier | 0 | eski |
| `/mails/today` | Pochta | `src/pages/mails/index.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier | 6 | eski |
| `/mails/return` | Pochta | `src/pages/mails/index.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier | 4 | eski |
| `/mails/refused` | Pochta | `src/pages/mails/index.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier | 5 | eski |
| `/mails/old` | Pochta | `src/pages/mails/index.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier | 7 | eski |
| `/mails/:id` | Pochta | `src/pages/mails/detail/index.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier | 25 | eski |
| `/batches` | Paketlar va qaytarishlar | `src/pages/batches/ui/BatchesPage.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID) | 9 | eski |
| `/batches/:id` | Paketlar va qaytarishlar | `src/pages/batches/ui/BatchDetailPage.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID) | 7 | eski |
| `/returns` | Paketlar va qaytarishlar | `src/pages/returns/index.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID) | 3 | eski |
| `/dispatch` | Biriktirish va tezkor amal | `src/pages/dispatch/index.tsx` | superadmin, admin, manager (REGIONAL · HYBRID), registrator (HQ · REGIONAL · HYBRID) | 8 | eski |
| `/courier-bulk` | Biriktirish va tezkor amal | `src/pages/courier-bulk/index.tsx` | manager (REGIONAL · HYBRID), courier | 7 | eski |
| `/scan` | Skaner | `src/pages/scan/index.tsx` | superadmin, admin, manager, registrator, market, courier | 14 | eski |
| `/scan/:token` | Skaner | `src/pages/scan/detail.tsx` | superadmin, admin, manager, registrator, market, courier | 10 | eski |
| `/payments` | Moliya | `src/pages/payments/index.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID) | 11 | eski |
| `/payments/main-cashbox` | Moliya | `src/pages/payments/components/mainCashbox.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID) | 9 | eski |
| `/payments/cash-detail/:id` | Moliya | `src/pages/payments/components/cashDetail.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID) | 8 | eski |
| `/cash-box` | Moliya | `src/pages/payments/components/MyCashboxPage.tsx` | manager, market, courier | 5 | eski |
| `/financial-balance` | Moliya | `src/pages/financial-balance/index.tsx` | superadmin, admin | 11 | eski |
| `/products` | Mahsulotlar | `src/pages/products/list/index.tsx` | superadmin, admin, manager, registrator, market | 19 | eski |
| `/products/create-product/:id` | Mahsulotlar | `src/pages/products/create/index.tsx` | superadmin, admin, manager, registrator, market | 5 | eski |
| `/all-users` | Foydalanuvchilar | `src/pages/users/list/UserListPage.tsx` | superadmin, admin, manager (filial turi aniq bo'lsa) | 5 | eski |
| `/all-users/create-user` | Foydalanuvchilar | `src/pages/users/create/CreateUserPage.tsx` | superadmin, admin, manager (filial turi aniq bo'lsa) | 4 | eski |
| `/all-users/:id` | Foydalanuvchilar | `src/pages/users/detail/UserDetailPage.tsx` | superadmin, admin, manager (filial turi aniq bo'lsa) | 8 | eski |
| `/regions` | Hududlar | `src/pages/region/index.tsx` | superadmin, admin, manager, courier | 7 | eski |
| `/regions/districts` | Hududlar | `src/pages/region/pages/districts/index.tsx` | superadmin | 1 | eski |
| `/regions/sato-management` | Hududlar | `src/pages/region/pages/sato-management/index.tsx` | superadmin, admin | 2 | eski |
| `/regions/logist-assignment` | Hududlar | `src/pages/region/pages/logist-assignment/index.tsx` | superadmin, admin | 2 | eski |
| `/branches` | Filiallar | `src/pages/branches/ui/BranchesPage.tsx` | superadmin | 3 | eski |
| `/branches/:id` | Filiallar | `src/pages/branches/ui/BranchDetailPage.tsx` | superadmin | 2 | eski |
| `/integrations/connections` | Integratsiyalar | `src/pages/integrations/ConnectionsPage.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator | 23 | eski |
| `/integrations/new` | Integratsiyalar | `src/pages/integrations/CatalogPage.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator | 2 | eski |
| `/integrations/new/:typeKey` | Integratsiyalar | `src/pages/integrations/wizard/ConnectWizard.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator | 2 | eski |
| `/integrations/partners` | Integratsiyalar | `src/pages/partners/index.tsx` | superadmin, admin, manager, registrator, market, courier | 2 | eski |
| `/integrations/sources` | Integratsiyalar | `src/pages/new_orders/external_orders/index.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator | 2 | eski |
| `/integrations/sources/create` | Integratsiyalar | `src/pages/new_orders/external_orders/create.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator | 1 | eski |
| `/integrations/sources/:id` | Integratsiyalar | `src/pages/new_orders/external_orders/detail.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator | 1 | eski |
| `/notifications` | Bildirishnomalar | `src/pages/notifications/ui/NotificationsPage.tsx` | superadmin | 3 | eski |
| `/notifications/send` | Bildirishnomalar | `src/pages/notification-send/index.tsx` | superadmin, admin | 2 | eski |
| `/notifications/sms` | Bildirishnomalar | `src/pages/notifications/ui/SmsPage.tsx` | superadmin, admin | 5 | eski |
| `/activity-logs` | Tizim | `src/pages/activity-logs/index.tsx` | superadmin, admin | 5 | eski |
| `/ops` | Tizim | `src/pages/ops/index.tsx` | superadmin | 8 | eski |
| `/ops/ui-kit` | Tizim | `src/pages/ui-kit/index.tsx` | superadmin | 0 | v2 |
| `/finance-operators` | Tizim | `src/pages/finance-operators/index.tsx` | superadmin | 1 | eski |
| `/integrations-ops` | Tizim | `src/pages/integrations-ops/index.tsx` | superadmin | 1 | eski |
| `/investors-ops` | Tizim | `src/pages/investors-ops/index.tsx` | superadmin | 1 | eski |
| `/logistics-ops` | Tizim | `src/pages/logistics-ops/index.tsx` | superadmin | 1 | eski |
| `/branch-ops` | Tizim | `src/pages/branch-ops/index.tsx` | superadmin | 1 | eski |
| `/identity-ops` | Tizim | `src/pages/identity-ops/index.tsx` | superadmin | 1 | eski |
| `/system-ops` | Tizim | `src/pages/system-ops/index.tsx` | superadmin | 1 | eski |
| `/logs` | Tizim | `src/pages/logs/index.tsx` | superadmin | 1 | eski |
| `/market-operators` | Tizim | `src/pages/market-operators/index.tsx` | hech kim (yopiq) | 0 | eski |
| `/profile` | Profil, sozlamalar, bildirishnomalar qutisi | `src/pages/profile/ui/ProfilePage.tsx` | superadmin, admin, manager, registrator, market, courier | 2 | eski |
| `/settings` | Profil, sozlamalar, bildirishnomalar qutisi | `src/pages/settings/ui/SettingsPage.tsx` | superadmin, admin, manager, registrator, market, courier | 5 | eski |
| `/inbox` | Profil, sozlamalar, bildirishnomalar qutisi | `src/pages/notifications/ui/NotificationInboxPage.tsx` | superadmin, admin, manager, registrator, market, courier | 5 | eski |

## 2. Route bo'yicha maketlar (batafsil)

Har route: fayllar (birinchisi — routes.tsx dagi sahifa), guard zanjiri, kim ocha oladi, izoh va **har rol uchun** maketlar.

### Qobiq — yon menyu, yuqori panel, pastki menyu

#### `(qobiq)` — Har sahifa atrofidagi qobiq: yon menyu, yuqori panel (qidiruv, skaner, qo'ng'iroqcha, profil), pastki menyu va telefon menyusi

- **Fayllar:** `src/widgets/layout/dashboardLayout.tsx` · `src/widgets/layout/scanLayout.tsx` · `src/widgets/Sidebar/ui/Sidebar.tsx` · `src/widgets/Sidebar/ui/SidebarItem.tsx` · `src/widgets/Sidebar/ui/BottomNav.tsx` · `src/widgets/Sidebar/ui/MobileMenu.tsx` · `src/widgets/Sidebar/model/menuConfig.tsx` · `src/widgets/header/ui/Header.tsx` · `src/widgets/header/ui/HeaderSearch.tsx` · `src/widgets/header/ui/SearchScreen.tsx` · `src/widgets/header/ui/NotificationsMenu.tsx` · `src/widgets/header/ui/UserMenu.tsx`
- **Rollar:** superadmin, admin, manager, registrator, market, courier
- **Holat:** v2
- **Izoh:** Maketlardagi yon menyu, yuqori panel va pastki menyu design/kit/roles.json dan chiziladi (bandlar, guruhlar, pastki menyu tartibi, persona). Menyu bandi qo'shsangiz — menuConfig.tsx bilan birga roles.json ni ham solishtiring.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `(qobiq)` | superadmin | — Qobiq har sahifa maketida o'z rolining menyusi bilan chizilgan — masalan superadmin-orders-list (oltin sahifa). | — | — | v2 |
| `(qobiq)` | admin | — Qobiq har sahifa maketida chizilgan — masalan admin-orders-list. | — | — | v2 |
| `(qobiq)` | manager | — Qobiq har sahifa maketida chizilgan — masalan manager-orders-list-all (pastki menyuda «Skaner» va «Biriktirish»). | — | — | v2 |
| `(qobiq)` | registrator | — Qobiq har sahifa maketida chizilgan — masalan registrator-orders-list. | — | — | v2 |
| `(qobiq)` | market | — Qobiq har sahifa maketida chizilgan — masalan market-orders-list (pastki menyuda skaner yo'q). | — | — | v2 |
| `(qobiq)` | courier | `courier-dashboard-mobile-menu` — Menyu ochiq — yon panel / pastki varaq<br>↳ `src/widgets/Sidebar/ui/MobileMenu.tsx` | [design/fragments/courier--dashboard-mobile-menu.html](fragments/courier--dashboard-mobile-menu.html) | oyna · faqat planshet + telefon | v2 |
| `(qobiq)` | courier | `courier-dashboard-mobile-search` — Global qidiruv (telefon)<br>↳ `src/widgets/header/ui/SearchScreen.tsx` | [design/fragments/courier--dashboard-mobile-search.html](fragments/courier--dashboard-mobile-search.html) | oyna · faqat telefon | v2 |
| `(qobiq)` | umumiy (barcha rollar) | `common-bell-dropdown` — Qo'ng'iroqcha ochiq (so'nggi bildirishnomalar)<br>↳ `src/widgets/header/ui/NotificationsMenu.tsx` | [design/fragments/common--bell-dropdown.html](fragments/common--bell-dropdown.html) | oyna | v2 |
| `(qobiq)` | tizim taxtasi | `tizim-states-navigation` — Holatlar — navigatsiya | [design/fragments/tizim--states-navigation.html](fragments/tizim--states-navigation.html) | taxta | qoida |
| `(qobiq)` | tizim taxtasi | `tizim-responsive` — Moslashuvchanlik — telefon, planshet, desktop | [design/fragments/tizim--responsive.html](fragments/tizim--responsive.html) | taxta | qoida |

### Kirish va xato sahifalari

#### `/login` — Tizimga kirish

- **Fayllar:** `src/features/auth/index.tsx` · `src/features/auth/ui/LoginForm.tsx` · `src/auth/loginNotice.ts` · `src/auth/SessionExpiryCountdown.tsx`
- **Qobiq:** qobiqsiz (kirishsiz) · **Guard:** yo'q (kirishsiz)
- **Rollar:** hamma (kirishsiz)
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/login` | umumiy (barcha rollar) | `common-login` — Tizimga kirish | [design/fragments/common--login.html](fragments/common--login.html) | sahifa | eski |
| `/login` | umumiy (barcha rollar) | `common-login-error` — Tizimga kirish — xato holati | [design/fragments/common--login-error.html](fragments/common--login-error.html) | sahifa | eski |
| `/login` | umumiy (barcha rollar) | `common-session-expired` — Sessiya tugadi | [design/fragments/common--session-expired.html](fragments/common--session-expired.html) | sahifa | qisman |

#### `/403` — Ruxsat yo'q

- **Fayllar:** `src/shared/ui/Forbidden.tsx` · `src/shared/ui/error-page/ErrorInfoCard.tsx`
- **Qobiq:** qobiqsiz (kirishsiz) va DashboardLayout · **Guard:** yo'q (kirishsiz)
- **Rollar:** hamma (kirishsiz)
- **Holat:** eski
- **Izoh:** Alohida maket yo'q — tizim-errors taxtasidagi «403 · Ruxsat yo'q» bloki.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/403` | tizim taxtasi | `tizim-errors` — Xato va bo'sh holatlar | [design/fragments/tizim--errors.html](fragments/tizim--errors.html) | taxta | qoida |

#### `/404` — Sahifa topilmadi

- **Fayllar:** `src/shared/ui/NotFound.tsx` · `src/shared/ui/error-page/ErrorInfoCard.tsx`
- **Qobiq:** qobiqsiz (kirishsiz) va DashboardLayout · **Guard:** yo'q (kirishsiz)
- **Rollar:** hamma (kirishsiz)
- **Holat:** eski
- **Izoh:** tizim-errors taxtasidagi «404 · Sahifa topilmadi» bloki.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/404` | tizim taxtasi | `tizim-errors` — Xato va bo'sh holatlar | [design/fragments/tizim--errors.html](fragments/tizim--errors.html) | taxta | qoida |

#### `/500` — Server xatosi

- **Fayllar:** `src/shared/ui/ServerError.tsx` · `src/shared/ui/error-page/ErrorInfoCard.tsx`
- **Qobiq:** qobiqsiz (kirishsiz) va DashboardLayout · **Guard:** yo'q (kirishsiz)
- **Rollar:** hamma (kirishsiz)
- **Holat:** eski
- **Izoh:** tizim-errors taxtasidagi «500 · Server xatosi» bloki.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/500` | tizim taxtasi | `tizim-errors` — Xato va bo'sh holatlar | [design/fragments/tizim--errors.html](fragments/tizim--errors.html) | taxta | qoida |

#### `/runtime-error` — Ilova xatosi

- **Fayllar:** `src/shared/ui/ErrorBoundaryPage.tsx` · `src/shared/ui/ErrorBoundary.tsx`
- **Qobiq:** qobiqsiz (kirishsiz) va DashboardLayout · **Guard:** yo'q (kirishsiz)
- **Rollar:** hamma (kirishsiz)
- **Holat:** eski
- **Izoh:** tizim-errors taxtasidagi «Ilova xatosi» bloki.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/runtime-error` | tizim taxtasi | `tizim-errors` — Xato va bo'sh holatlar | [design/fragments/tizim--errors.html](fragments/tizim--errors.html) | taxta | qoida |

#### `/*` — Noma'lum yo'l (qobiq ichida)

- **Fayllar:** `src/shared/ui/NotFound.tsx`
- **Qobiq:** DashboardLayout · **Guard:** yo'q (faqat kirish)
- **Rollar:** superadmin, admin, manager, registrator, market, courier
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/*` | tizim taxtasi | `tizim-errors` — Xato va bo'sh holatlar | [design/fragments/tizim--errors.html](fragments/tizim--errors.html) | taxta | qoida |

### Bosh sahifa

#### `/` — Bosh sahifa — rolga qarab: DashboardPage yoki MarketDashboardPage

- **Fayllar:** `src/app/lib/routes.tsx` · `src/pages/dashboard/DashboardPage.tsx` · `src/pages/dashboard/MarketDashboardPage.tsx` · `src/widgets/dashboard-statistics/ui/DashboardStatistics.tsx` · `src/widgets/dashboard-statistics/ui/OrderStatusDonut.tsx` · `src/widgets/dashboard-statistics/ui/SuccessGauge.tsx` · `src/widgets/financial-analysis/ui/FinancialAnalysis.tsx` · `src/widgets/dashboard-top-performers/ui/TopPerformers.tsx` · `src/widgets/dashboard-performance-chart/ui/PerformanceChart.tsx` · `src/widgets/dashboard-region/ui/RegionStatsCard.tsx` · `src/pages/region/ui/UzbekistanRegionMap.tsx`
- **Qobiq:** DashboardLayout · **Guard:** yo'q (faqat kirish) · o'rovchi: `DashboardEntry`
- **Rollar:** superadmin, admin, manager (→ /branch-dashboard), registrator, market, courier
- **Menyuda:** «Bosh sahifa» (`dashboard`) — superadmin, admin, registrator, market, courier
- **Holat:** eski
- **Izoh:** DashboardEntry (routes.tsx): market → MarketDashboardPage (xarajat tasdiqlari shu sahifada), qolganlar → DashboardPage (kuryer — alohida tarmoq isCourier).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/` | superadmin | `superadmin-dashboard-main` — Dashboard — Bugungi statistika<br>↳ `src/pages/dashboard/DashboardPage.tsx` | [design/fragments/superadmin--dashboard-main.html](fragments/superadmin--dashboard-main.html) | sahifa | eski |
| `/` | superadmin | `superadmin-dashboard-region-modal` — Dashboard — Viloyat tafsiloti (xarita)<br>↳ `src/pages/region/ui/UzbekistanRegionMap.tsx` | [design/fragments/superadmin--dashboard-region-modal.html](fragments/superadmin--dashboard-region-modal.html) | oyna | eski |
| `/` | admin | `admin-dashboard-main` — Dashboard<br>↳ `src/pages/dashboard/DashboardPage.tsx` | [design/fragments/admin--dashboard-main.html](fragments/admin--dashboard-main.html) | sahifa | eski |
| `/` | manager | — DashboardEntry menejerni /branch-dashboard ga yo'naltiradi. | — | — | eski |
| `/` | registrator | `registrator-dashboard-main` — Dashboard — statistika<br>↳ `src/pages/dashboard/DashboardPage.tsx` | [design/fragments/registrator--dashboard-main.html](fragments/registrator--dashboard-main.html) | sahifa | eski |
| `/` | market | `market-dashboard-home` — Mening dashboardim<br>↳ `src/pages/dashboard/MarketDashboardPage.tsx` | [design/fragments/market--dashboard-home.html](fragments/market--dashboard-home.html) | sahifa | eski |
| `/` | market | `market-dashboard-extra-cost-approvals` — Dashboard · Xarajat tasdiqlari<br>↳ `src/pages/dashboard/MarketDashboardPage.tsx` | [design/fragments/market--dashboard-extra-cost-approvals.html](fragments/market--dashboard-extra-cost-approvals.html) | sahifa | eski |
| `/` | courier | `courier-dashboard-home` — Bosh sahifa — kuryer statistikasi<br>↳ `src/pages/dashboard/DashboardPage.tsx` | [design/fragments/courier--dashboard-home.html](fragments/courier--dashboard-home.html) | sahifa | eski |
| `/` | tizim taxtasi | `tizim-charts` — Grafiklar — statistika va tahlil | [design/fragments/tizim--charts.html](fragments/tizim--charts.html) | taxta | qoida |

#### `/branch-dashboard` — Filial paneli (menejer bosh sahifasi)

- **Fayllar:** `src/pages/branch-dashboard/ui/BranchDashboardPage.tsx` · `src/pages/branch-dashboard/ui/BranchDashboardCards.tsx` · `src/pages/branch-dashboard/ui/branchDashboardAdapter.ts` · `src/widgets/dashboard-top-performers/ui/TopPerformers.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewBranchDashboard` (routes.tsx → canViewBranchDashboard)
- **Rollar:** manager
- **Menyuda:** «Bosh sahifa» (`dashboard`) — manager
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/branch-dashboard` | manager | `manager-branch-dashboard-main` — Filial paneli | [design/fragments/manager--branch-dashboard-main.html](fragments/manager--branch-dashboard-main.html) | sahifa | eski |
| `/branch-dashboard` | tizim taxtasi | `tizim-charts` — Grafiklar — statistika va tahlil | [design/fragments/tizim--charts.html](fragments/tizim--charts.html) | taxta | qoida |

### Buyurtmalar

#### `/orders` — Buyurtmalar ro'yxati (kuryerda — alohida ro'yxat komponenti)

- **Fayllar:** `src/pages/orders/index.tsx` · `src/pages/orders/list/OrderFilters.tsx` · `src/pages/orders/list/OrdersTable.tsx` · `src/pages/orders/list/OrderStatusBadge.tsx` · `src/pages/orders/lib/exportOrdersToExcel.ts` · `src/pages/orders/list/courier/index.tsx` · `src/pages/orders/list/courier/list/tabs.tsx` · `src/pages/orders/list/courier/list/ordertable/pendingOrderTable.tsx` · `src/pages/orders/list/courier/list/ordertable/AllOrdersTable.tsx` · `src/pages/orders/list/courier/list/ordertable/CancelledOrdersTable.tsx` · `src/pages/orders/list/courier/list/SellModal.tsx` · `src/pages/orders/list/courier/list/CancelModal.tsx` · `src/entities/orders/ui/ExtraCostApproval.tsx` · `src/shared/components/popupConfirm.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewOrders` (access.ts → canViewOrders)
- **Rollar:** superadmin, admin, manager, registrator, market, courier
- **Menyuda:** «Buyurtmalar» (`orders`) — superadmin, admin, manager, registrator, market, courier
- **Holat:** eski
- **Izoh:** Kuryer ro'yxati — list/courier/index.tsx (tablar list/courier/list/tabs.tsx). Menejer tablari (kodda hozir «Hammasi · Kutilayotgan · Bekor qilinganlar»; maketda «Kutilayotgan · Barchasi · Bekor qilingan» — matn uchun maket fragmenti ustun) va sotish/bekor/qaytarish amallari faqat REGIONAL · HYBRID filialda (MANAGER_TABS_BRANCH_TYPES). Qator bosilsa → /orders/edit/:orderId.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/orders` | superadmin | `superadmin-orders-list` — Buyurtmalar ro'yxati | [design/fragments/superadmin--orders-list.html](fragments/superadmin--orders-list.html) | sahifa | eski |
| `/orders` | superadmin | `superadmin-orders-filters-mobile` — Buyurtmalar — filtr paneli (telefon)<br>↳ `src/pages/orders/list/OrderFilters.tsx` | [design/fragments/superadmin--orders-filters-mobile.html](fragments/superadmin--orders-filters-mobile.html) | oyna · faqat telefon | eski |
| `/orders` | admin | `admin-orders-list` — Buyurtmalar ro'yxati | [design/fragments/admin--orders-list.html](fragments/admin--orders-list.html) | sahifa | eski |
| `/orders` | admin | `admin-orders-filters-mobile` — Buyurtmalar — filtr paneli (telefon)<br>↳ `src/pages/orders/list/OrderFilters.tsx` | [design/fragments/superadmin--orders-filters-mobile.html](fragments/superadmin--orders-filters-mobile.html) | oyna · faqat telefon | eski |
| `/orders` | manager | `manager-orders-list-all` — Buyurtmalar — Hamma buyurtmalar | [design/fragments/manager--orders-list-all.html](fragments/manager--orders-list-all.html) | sahifa | eski |
| `/orders` | manager | `manager-orders-list-pending` — Buyurtmalar — Kutilayotgan | [design/fragments/manager--orders-list-pending.html](fragments/manager--orders-list-pending.html) | sahifa | eski |
| `/orders` | manager | `manager-orders-list-cancelled` — Buyurtmalar — Bekor qilinganlar (HQ'ga yuborish) | [design/fragments/manager--orders-list-cancelled.html](fragments/manager--orders-list-cancelled.html) | sahifa | eski |
| `/orders` | manager | `manager-orders-sell-dialog` — Sotish oynasi<br>↳ `src/pages/orders/list/courier/list/SellModal.tsx` | [design/fragments/manager--orders-sell-dialog.html](fragments/manager--orders-sell-dialog.html) | oyna | eski |
| `/orders` | manager | `manager-orders-cancel-dialog` — Bekor qilish oynasi<br>↳ `src/pages/orders/list/courier/list/CancelModal.tsx` | [design/fragments/manager--orders-cancel-dialog.html](fragments/manager--orders-cancel-dialog.html) | oyna | eski |
| `/orders` | manager | `manager-orders-rollback-dialog` — Buyurtmani qaytarish tasdig'i | [design/fragments/manager--orders-rollback-dialog.html](fragments/manager--orders-rollback-dialog.html) | oyna | eski |
| `/orders` | registrator | `registrator-orders-list` — Buyurtmalar ro'yxati | [design/fragments/registrator--orders-list.html](fragments/registrator--orders-list.html) | sahifa | eski |
| `/orders` | registrator | `registrator-orders-filters-mobile` — Buyurtmalar — filtr paneli (telefon)<br>↳ `src/pages/orders/list/OrderFilters.tsx` | [design/fragments/registrator--orders-filters-mobile.html](fragments/registrator--orders-filters-mobile.html) | oyna · faqat telefon | eski |
| `/orders` | market | `market-orders-list` — Buyurtmalar ro'yxati | [design/fragments/market--orders-list.html](fragments/market--orders-list.html) | sahifa | eski |
| `/orders` | courier | `courier-orders-pending` — Buyurtmalar — Kutilayotganlar<br>↳ `src/pages/orders/list/courier/index.tsx` | [design/fragments/courier--orders-pending.html](fragments/courier--orders-pending.html) | sahifa | eski |
| `/orders` | courier | `courier-orders-tab-switcher-open` — Buyurtmalar — tab almashtirildi, yuklanmoqda<br>↳ `src/pages/orders/list/courier/list/tabs.tsx` | [design/fragments/courier--orders-tab-switcher-open.html](fragments/courier--orders-tab-switcher-open.html) | sahifa · faqat telefon | eski |
| `/orders` | courier | `courier-orders-all` — Buyurtmalar — Hammasi<br>↳ `src/pages/orders/list/courier/index.tsx` | [design/fragments/courier--orders-all.html](fragments/courier--orders-all.html) | sahifa | eski |
| `/orders` | courier | `courier-orders-cancelled` — Buyurtmalar — Bekor qilinganlar<br>↳ `src/pages/orders/list/courier/index.tsx` | [design/fragments/courier--orders-cancelled.html](fragments/courier--orders-cancelled.html) | sahifa | eski |
| `/orders` | courier | `courier-orders-sell-dialog` — Sotish oynasi<br>↳ `src/pages/orders/list/courier/list/SellModal.tsx` | [design/fragments/courier--orders-sell-dialog.html](fragments/courier--orders-sell-dialog.html) | oyna | eski |
| `/orders` | courier | `courier-orders-sell-extra-cost-dialog` — Sotish — qo'shimcha xarajat bilan<br>↳ `src/pages/orders/list/courier/list/SellModal.tsx` | [design/fragments/courier--orders-sell-extra-cost-dialog.html](fragments/courier--orders-sell-extra-cost-dialog.html) | oyna | eski |
| `/orders` | courier | `courier-orders-sell-partial-dialog` — Qisman sotish oynasi<br>↳ `src/pages/orders/list/courier/list/SellModal.tsx` | [design/fragments/courier--orders-sell-partial-dialog.html](fragments/courier--orders-sell-partial-dialog.html) | oyna | eski |
| `/orders` | courier | `courier-orders-action-approval-pending` — Market tasdig'i kutilmoqda<br>↳ `src/pages/orders/list/courier/list/SellModal.tsx` | [design/fragments/courier--orders-action-approval-pending.html](fragments/courier--orders-action-approval-pending.html) | oyna | eski |
| `/orders` | courier | `courier-orders-cancel-dialog` — Bekor qilish oynasi<br>↳ `src/pages/orders/list/courier/list/CancelModal.tsx` | [design/fragments/courier--orders-cancel-dialog.html](fragments/courier--orders-cancel-dialog.html) | oyna | eski |
| `/orders` | courier | `courier-orders-rollback-confirm` — Buyurtmani qaytarish tasdig'i<br>↳ `src/pages/orders/list/courier/index.tsx` | [design/fragments/courier--orders-rollback-confirm.html](fragments/courier--orders-rollback-confirm.html) | oyna | eski |
| `/orders` | tizim taxtasi | `tizim-states-data` — Holatlar — jadval, ro'yxat, kartalar | [design/fragments/tizim--states-data.html](fragments/tizim--states-data.html) | taxta | qoida |

#### `/orders/edit/:orderId` — Buyurtma tafsiloti va tahrirlash (alohida «detail» marshruti yo'q — tafsilot shu sahifa)

- **Fayllar:** `src/pages/new_orders/components/new_orderUpdate.tsx` · `src/pages/new_orders/components/new_orderUpdate.ui.tsx` · `src/pages/new_orders/components/newOrderUpdateRules.ts` · `src/pages/orders/list/courier/list/SellModal.tsx` · `src/pages/orders/list/courier/list/CancelModal.tsx` · `src/features/order-return/ui/InitiateReturnModal.tsx` · `src/features/order-return/ui/MarkReturnedModal.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewOrders` (access.ts → canViewOrders)
- **Rollar:** superadmin, admin, manager, registrator, market, courier
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski
- **Izoh:** Mijozni tahrirlash — faqat superadmin/admin; buyurtma va manzilni tahrirlash — superadmin/admin/registrator/menejer; market va kuryer — faqat o'qish. Sotish/bekor/qaytarish — REGIONAL · HYBRID menejeri. Ayni komponent /new-orders/:marketId/edit/:orderId da ham ishlatiladi.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/orders/edit/:orderId` | superadmin | `superadmin-orders-detail` — Buyurtma tafsilotlari | [design/fragments/superadmin--orders-detail.html](fragments/superadmin--orders-detail.html) | sahifa | eski |
| `/orders/edit/:orderId` | superadmin | `superadmin-orders-detail-edit-order-dialog` — Buyurtmani tahrirlash (popup) | [design/fragments/superadmin--orders-detail-edit-order-dialog.html](fragments/superadmin--orders-detail-edit-order-dialog.html) | oyna | eski |
| `/orders/edit/:orderId` | superadmin | `superadmin-orders-detail-edit-customer-dialog` — Mijoz ma'lumotini tahrirlash (popup) | [design/fragments/superadmin--orders-detail-edit-customer-dialog.html](fragments/superadmin--orders-detail-edit-customer-dialog.html) | oyna | eski |
| `/orders/edit/:orderId` | superadmin | `superadmin-orders-detail-edit-address-dialog` — Manzilni tahrirlash (popup) | [design/fragments/superadmin--orders-detail-edit-address-dialog.html](fragments/superadmin--orders-detail-edit-address-dialog.html) | oyna | eski |
| `/orders/edit/:orderId` | admin | `admin-orders-detail` — Buyurtma tafsiloti | [design/fragments/admin--orders-detail.html](fragments/admin--orders-detail.html) | sahifa | eski |
| `/orders/edit/:orderId` | admin | `admin-orders-edit-order-dialog` — Buyurtmani tahrirlash oynasi | [design/fragments/admin--orders-edit-order-dialog.html](fragments/admin--orders-edit-order-dialog.html) | oyna | eski |
| `/orders/edit/:orderId` | admin | `admin-orders-edit-customer-dialog` — Mijozni tahrirlash oynasi | [design/fragments/admin--orders-edit-customer-dialog.html](fragments/admin--orders-edit-customer-dialog.html) | oyna | eski |
| `/orders/edit/:orderId` | admin | `admin-orders-edit-address-dialog` — Manzilni tahrirlash oynasi | [design/fragments/admin--orders-edit-address-dialog.html](fragments/admin--orders-edit-address-dialog.html) | oyna | eski |
| `/orders/edit/:orderId` | manager | `manager-orders-detail` — Buyurtma tafsiloti | [design/fragments/manager--orders-detail.html](fragments/manager--orders-detail.html) | sahifa | eski |
| `/orders/edit/:orderId` | manager | `manager-orders-detail-edit-address-dialog` — Manzilni tahrirlash oynasi | [design/fragments/manager--orders-detail-edit-address-dialog.html](fragments/manager--orders-detail-edit-address-dialog.html) | oyna | eski |
| `/orders/edit/:orderId` | manager | `manager-orders-detail-edit-products-dialog` — Buyurtmani tahrirlash oynasi | [design/fragments/manager--orders-detail-edit-products-dialog.html](fragments/manager--orders-detail-edit-products-dialog.html) | oyna | eski |
| `/orders/edit/:orderId` | manager | `manager-orders-sell-dialog` — Sotish oynasi<br>↳ `src/pages/orders/list/courier/list/SellModal.tsx` | [design/fragments/manager--orders-sell-dialog.html](fragments/manager--orders-sell-dialog.html) | oyna | eski |
| `/orders/edit/:orderId` | manager | `manager-orders-cancel-dialog` — Bekor qilish oynasi<br>↳ `src/pages/orders/list/courier/list/CancelModal.tsx` | [design/fragments/manager--orders-cancel-dialog.html](fragments/manager--orders-cancel-dialog.html) | oyna | eski |
| `/orders/edit/:orderId` | manager | `manager-orders-rollback-dialog` — Buyurtmani qaytarish tasdig'i | [design/fragments/manager--orders-rollback-dialog.html](fragments/manager--orders-rollback-dialog.html) | oyna | eski |
| `/orders/edit/:orderId` | registrator | `registrator-orders-detail` — Buyurtma tafsiloti | [design/fragments/registrator--orders-detail.html](fragments/registrator--orders-detail.html) | sahifa | eski |
| `/orders/edit/:orderId` | registrator | `registrator-orders-detail-edit-order-dialog` — Buyurtmani tahrirlash oynasi | [design/fragments/registrator--orders-detail-edit-order-dialog.html](fragments/registrator--orders-detail-edit-order-dialog.html) | oyna | eski |
| `/orders/edit/:orderId` | registrator | `registrator-orders-detail-edit-address-dialog` — Manzilni tahrirlash oynasi | [design/fragments/registrator--orders-detail-edit-address-dialog.html](fragments/registrator--orders-detail-edit-address-dialog.html) | oyna | eski |
| `/orders/edit/:orderId` | market | `market-orders-detail` — Buyurtma tafsilotlari | [design/fragments/market--orders-detail.html](fragments/market--orders-detail.html) | sahifa | eski |
| `/orders/edit/:orderId` | courier | `courier-orders-detail` — Buyurtma tafsilotlari | [design/fragments/courier--orders-detail.html](fragments/courier--orders-detail.html) | sahifa | eski |

### Qabul va yaratish

#### `/new-orders` — Qabul va yaratish — tablar (layout) + Marketlar tabi

- **Fayllar:** `src/pages/new_orders/markets/index.tsx` · `src/pages/new_orders/index.tsx`
- **Qobiq:** DashboardLayout › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market
- **Menyuda:** «Qabul va yaratish» (`newOrders`) — superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market
- **Holat:** eski
- **Izoh:** Tablar (Marketlar · Kiruvchi posilkalar · Filial paketlari · Bekor qilinganlar) va «Buyurtma yaratish» tugmasi — src/pages/new_orders/index.tsx (barcha /new-orders/* uchun layout).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders` | superadmin | `superadmin-neworders-markets` — Qabul va yaratish — Marketlar | [design/fragments/superadmin--neworders-markets.html](fragments/superadmin--neworders-markets.html) | sahifa | eski |
| `/new-orders` | admin | `admin-neworders-markets` — Qabul — Marketlar tabi | [design/fragments/admin--neworders-markets.html](fragments/admin--neworders-markets.html) | sahifa | eski |
| `/new-orders` | manager | `manager-new-orders-markets` — Qabul va yaratish — Marketlar | [design/fragments/manager--new-orders-markets.html](fragments/manager--new-orders-markets.html) | sahifa | eski |
| `/new-orders` | registrator | `registrator-new-orders-markets` — Qabul va yaratish — Marketlar | [design/fragments/registrator--new-orders-markets.html](fragments/registrator--new-orders-markets.html) | sahifa | eski |
| `/new-orders` | market | — Market /new-orders/:marketId (o'z marketi) ga yo'naltiriladi — o'sha route'ga qarang. | — | — | eski |

#### `/new-orders/create` — Buyurtma yaratish — qo'lda (market → mijoz va mahsulot) yoki AI bilan

- **Fayllar:** `src/pages/orders/create/index.tsx` · `src/pages/orders/create/ui/CreateModeTabs.tsx` · `src/pages/orders/create/ui/OrderStepper.tsx` · `src/pages/orders/create/ui/Step1Market.tsx` · `src/pages/orders/create/ui/Step2Combined.tsx` · `src/pages/orders/create/ui/ai/AiCreatePanel.tsx` · `src/pages/orders/create/ui/ai/AiInputPanel.tsx` · `src/pages/orders/create/ui/ai/AiPreviewCard.tsx` · `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` · `src/pages/orders/create/ui/ai/AiCreatedList.tsx` · `src/pages/orders/create/model/orderCreateForm.ts`
- **Qobiq:** DashboardLayout › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market
- **Menyuda:** yo'q — «Buyurtma yaratish» tugmasi (/new-orders sarlavhasi, market bosh sahifasi, market yangi buyurtmalari)
- **Holat:** eski
- **Izoh:** Market rolida 1-qadam (market tanlash) yo'q — forma darhol 2-qadamdan ochiladi. Market tanlash oynasi — Step1Market.tsx ichida; AI tasdiqlash oynasi — AiConfirmBar.tsx.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/create` | superadmin | `superadmin-neworders-create-manual-step1` — Buyurtma yaratish — 1-qadam: Market<br>↳ `src/pages/orders/create/ui/Step1Market.tsx` | [design/fragments/superadmin--neworders-create-manual-step1.html](fragments/superadmin--neworders-create-manual-step1.html) | sahifa | eski |
| `/new-orders/create` | superadmin | `superadmin-neworders-create-market-picker-dialog` — Market tanlash (modal)<br>↳ `src/pages/orders/create/ui/Step1Market.tsx` | [design/fragments/superadmin--neworders-create-market-picker-dialog.html](fragments/superadmin--neworders-create-market-picker-dialog.html) | oyna | eski |
| `/new-orders/create` | superadmin | `superadmin-neworders-create-manual-step2` — Buyurtma yaratish — 2-qadam: Mijoz va mahsulot<br>↳ `src/pages/orders/create/ui/Step2Combined.tsx` | [design/fragments/superadmin--neworders-create-manual-step2.html](fragments/superadmin--neworders-create-manual-step2.html) | sahifa | eski |
| `/new-orders/create` | superadmin | `superadmin-neworders-create-ai-input` — Buyurtma yaratish — AI bilan (kiritish)<br>↳ `src/pages/orders/create/ui/ai/AiInputPanel.tsx` | [design/fragments/superadmin--neworders-create-ai-input.html](fragments/superadmin--neworders-create-ai-input.html) | sahifa | eski |
| `/new-orders/create` | superadmin | `superadmin-neworders-create-ai-preview` — Buyurtma yaratish — AI natijalari (preview)<br>↳ `src/pages/orders/create/ui/ai/AiPreviewCard.tsx` | [design/fragments/superadmin--neworders-create-ai-preview.html](fragments/superadmin--neworders-create-ai-preview.html) | sahifa | eski |
| `/new-orders/create` | superadmin | `superadmin-neworders-create-ai-confirm-dialog` — AI — yaratishni tasdiqlash<br>↳ `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | [design/fragments/superadmin--neworders-create-ai-confirm-dialog.html](fragments/superadmin--neworders-create-ai-confirm-dialog.html) | oyna | eski |
| `/new-orders/create` | admin | `admin-neworders-create-manual` — Buyurtma yaratish — Qo'lda | [design/fragments/admin--neworders-create-manual.html](fragments/admin--neworders-create-manual.html) | sahifa | eski |
| `/new-orders/create` | admin | `admin-neworders-create-market-picker` — Market tanlash oynasi<br>↳ `src/pages/orders/create/ui/Step1Market.tsx` | [design/fragments/admin--neworders-create-market-picker.html](fragments/admin--neworders-create-market-picker.html) | oyna | eski |
| `/new-orders/create` | admin | `admin-neworders-create-ai` — Buyurtma yaratish — AI bilan | [design/fragments/admin--neworders-create-ai.html](fragments/admin--neworders-create-ai.html) | sahifa | eski |
| `/new-orders/create` | admin | `admin-neworders-create-ai-confirm-dialog` — AI yaratishni tasdiqlash<br>↳ `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | [design/fragments/admin--neworders-create-ai-confirm-dialog.html](fragments/admin--neworders-create-ai-confirm-dialog.html) | oyna | eski |
| `/new-orders/create` | manager | `manager-new-orders-create-manual-step1` — Buyurtma yaratish — market tanlash<br>↳ `src/pages/orders/create/ui/Step1Market.tsx` | [design/fragments/manager--new-orders-create-manual-step1.html](fragments/manager--new-orders-create-manual-step1.html) | sahifa | eski |
| `/new-orders/create` | manager | `manager-new-orders-create-manual-step2` — Buyurtma yaratish — ma'lumotlar<br>↳ `src/pages/orders/create/ui/Step2Combined.tsx` | [design/fragments/manager--new-orders-create-manual-step2.html](fragments/manager--new-orders-create-manual-step2.html) | sahifa | eski |
| `/new-orders/create` | manager | `manager-new-orders-create-ai` — Buyurtma yaratish — AI bilan | [design/fragments/manager--new-orders-create-ai.html](fragments/manager--new-orders-create-ai.html) | sahifa | eski |
| `/new-orders/create` | manager | `manager-new-orders-create-ai-confirm-dialog` — AI buyurtmalarni tasdiqlash<br>↳ `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | [design/fragments/manager--new-orders-create-ai-confirm-dialog.html](fragments/manager--new-orders-create-ai-confirm-dialog.html) | oyna | eski |
| `/new-orders/create` | registrator | `registrator-new-orders-create-step1` — Buyurtma yaratish — market tanlash<br>↳ `src/pages/orders/create/ui/Step1Market.tsx` | [design/fragments/manager--new-orders-create-manual-step1.html](fragments/manager--new-orders-create-manual-step1.html) | sahifa | eski |
| `/new-orders/create` | registrator | `registrator-new-orders-create-market-picker-dialog` — Buyurtma yaratish — market tanlash oynasi<br>↳ `src/pages/orders/create/ui/Step1Market.tsx` | [design/fragments/registrator--new-orders-create-market-picker-dialog.html](fragments/registrator--new-orders-create-market-picker-dialog.html) | oyna | eski |
| `/new-orders/create` | registrator | `registrator-new-orders-create-step2` — Buyurtma yaratish — qo'lda forma<br>↳ `src/pages/orders/create/ui/Step2Combined.tsx` | [design/fragments/registrator--new-orders-create-step2.html](fragments/registrator--new-orders-create-step2.html) | sahifa | eski |
| `/new-orders/create` | registrator | `registrator-new-orders-create-ai` — Buyurtma yaratish — AI rejimi | [design/fragments/registrator--new-orders-create-ai.html](fragments/registrator--new-orders-create-ai.html) | sahifa | eski |
| `/new-orders/create` | registrator | `registrator-new-orders-create-ai-confirm-dialog` — AI buyurtmalarni tasdiqlash<br>↳ `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | [design/fragments/manager--new-orders-create-ai-confirm-dialog.html](fragments/manager--new-orders-create-ai-confirm-dialog.html) | oyna | eski |
| `/new-orders/create` | market | `market-new-orders-create-manual` — Buyurtma yaratish · Qo'lda<br>↳ `src/pages/orders/create/ui/Step2Combined.tsx` | [design/fragments/market--new-orders-create-manual.html](fragments/market--new-orders-create-manual.html) | sahifa | eski |
| `/new-orders/create` | market | `market-new-orders-create-ai-input` — Buyurtma yaratish · AI kiritish<br>↳ `src/pages/orders/create/ui/ai/AiInputPanel.tsx` | [design/fragments/market--new-orders-create-ai-input.html](fragments/market--new-orders-create-ai-input.html) | sahifa | eski |
| `/new-orders/create` | market | `market-new-orders-create-ai-preview` — Buyurtma yaratish · AI natijalari<br>↳ `src/pages/orders/create/ui/ai/AiPreviewCard.tsx` | [design/fragments/market--new-orders-create-ai-preview.html](fragments/market--new-orders-create-ai-preview.html) | sahifa | eski |
| `/new-orders/create` | market | `market-new-orders-create-ai-confirm-dialog` — AI · Yaratishni tasdiqlash<br>↳ `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | [design/fragments/market--new-orders-create-ai-confirm-dialog.html](fragments/market--new-orders-create-ai-confirm-dialog.html) | oyna | eski |

#### `/new-orders/incoming` — Kiruvchi posilkalar — manba tanlash

- **Fayllar:** `src/pages/incoming-orders/SourcePicker.tsx` · `src/pages/incoming-orders/lib.ts`
- **Qobiq:** DashboardLayout › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) → `canManageExternalIntegrations` (access.ts → canReceiveExternalOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/incoming` | superadmin | `superadmin-neworders-incoming-sources` — Kiruvchi posilkalar — manba tanlash | [design/fragments/superadmin--neworders-incoming-sources.html](fragments/superadmin--neworders-incoming-sources.html) | sahifa | eski |
| `/new-orders/incoming` | admin | `admin-neworders-incoming-sources` — Kiruvchi posilkalar — manba tanlash | [design/fragments/admin--neworders-incoming-sources.html](fragments/admin--neworders-incoming-sources.html) | sahifa | eski |
| `/new-orders/incoming` | manager | `manager-new-orders-incoming-sources` — Kiruvchi posilkalar — manba tanlash | [design/fragments/manager--new-orders-incoming-sources.html](fragments/manager--new-orders-incoming-sources.html) | sahifa | eski |
| `/new-orders/incoming` | registrator | — Maket yo'q (tab faqat admin/superadmin'ga ko'rinadi, URL ochiq) — admin-neworders-incoming-sources ga qarang. | — | — | eski |

#### `/new-orders/incoming/:marketId` — Kiruvchi posilkalarni skanerlab qabul qilish (tanlangan manba)

- **Fayllar:** `src/pages/incoming-orders/index.tsx` · `src/pages/incoming-orders/lib.ts`
- **Qobiq:** DashboardLayout › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) → `canManageExternalIntegrations` (access.ts → canReceiveExternalOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/incoming/:marketId` | superadmin | `superadmin-neworders-incoming-scan` — Kiruvchi posilkalar — skanerlab qabul | [design/fragments/superadmin--neworders-incoming-scan.html](fragments/superadmin--neworders-incoming-scan.html) | sahifa | eski |
| `/new-orders/incoming/:marketId` | superadmin | `superadmin-neworders-incoming-scan-camera` — Kiruvchi posilkalar — skanerlab qabul — kamera | [design/fragments/superadmin--neworders-incoming-scan-camera.html](fragments/superadmin--neworders-incoming-scan-camera.html) | oyna | yangi (kodda yo'q) |
| `/new-orders/incoming/:marketId` | admin | `admin-neworders-incoming-scan` — Kiruvchi posilkalarni skanerlash | [design/fragments/admin--neworders-incoming-scan.html](fragments/admin--neworders-incoming-scan.html) | sahifa | eski |
| `/new-orders/incoming/:marketId` | admin | `admin-neworders-incoming-scan-camera` — Kiruvchi posilkalarni skanerlash — kamera | [design/fragments/superadmin--neworders-incoming-scan-camera.html](fragments/superadmin--neworders-incoming-scan-camera.html) | oyna | yangi (kodda yo'q) |
| `/new-orders/incoming/:marketId` | manager | `manager-new-orders-incoming-scan` — Kiruvchi posilkalar — skanerlash | [design/fragments/manager--new-orders-incoming-scan.html](fragments/manager--new-orders-incoming-scan.html) | sahifa | eski |
| `/new-orders/incoming/:marketId` | manager | `manager-new-orders-incoming-scan-camera` — Kiruvchi posilkalar — skanerlash — kamera | [design/fragments/manager--new-orders-incoming-scan-camera.html](fragments/manager--new-orders-incoming-scan-camera.html) | oyna | yangi (kodda yo'q) |
| `/new-orders/incoming/:marketId` | registrator | — Maket yo'q — admin-neworders-incoming-scan ga qarang. | — | — | eski |
| `/new-orders/incoming/:marketId` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

#### `/new-orders/branches` — Filial paketlari — filiallar

- **Fayllar:** `src/pages/new_orders/branches/index.tsx`
- **Qobiq:** DashboardLayout › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) → `canViewAdminNewOrderTabs` (routes.tsx → canViewAdminNewOrderTabs)
- **Rollar:** superadmin, admin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/branches` | superadmin | `superadmin-neworders-branches` — Filial batchlari — filiallar | [design/fragments/superadmin--neworders-branches.html](fragments/superadmin--neworders-branches.html) | sahifa | eski |
| `/new-orders/branches` | admin | `admin-neworders-branches` — Filial batchlari tabi | [design/fragments/admin--neworders-branches.html](fragments/admin--neworders-branches.html) | sahifa | eski |

#### `/new-orders/branches/:branchId` — Filial paketlari ro'yxati

- **Fayllar:** `src/pages/new_orders/branches/batches.tsx`
- **Qobiq:** DashboardLayout › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) → `canViewAdminNewOrderTabs` (routes.tsx → canViewAdminNewOrderTabs)
- **Rollar:** superadmin, admin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/branches/:branchId` | superadmin | `superadmin-neworders-branch-batches` — Filial batchlari ro'yxati | [design/fragments/superadmin--neworders-branch-batches.html](fragments/superadmin--neworders-branch-batches.html) | sahifa | eski |
| `/new-orders/branches/:branchId` | admin | `admin-neworders-branch-batches` — Filial batchlari ro'yxati | [design/fragments/superadmin--neworders-branch-batches.html](fragments/superadmin--neworders-branch-batches.html) | sahifa | eski |

#### `/new-orders/branches/:branchId/batches/:batchId` — Filial paketi tafsiloti (qabul)

- **Fayllar:** `src/pages/new_orders/branches/batchDetail.tsx`
- **Qobiq:** DashboardLayout › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) → `canViewAdminNewOrderTabs` (routes.tsx → canViewAdminNewOrderTabs)
- **Rollar:** superadmin, admin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/branches/:branchId/batches/:batchId` | superadmin | `superadmin-neworders-branch-batch-detail` — Filial paketi tafsiloti | [design/fragments/superadmin--neworders-branch-batch-detail.html](fragments/superadmin--neworders-branch-batch-detail.html) | sahifa | eski |
| `/new-orders/branches/:branchId/batches/:batchId` | superadmin | `superadmin-neworders-branch-batch-detail-camera` — Filial paketi tafsiloti — kamera | [design/fragments/superadmin--neworders-branch-batch-detail-camera.html](fragments/superadmin--neworders-branch-batch-detail-camera.html) | oyna | yangi (kodda yo'q) |
| `/new-orders/branches/:branchId/batches/:batchId` | admin | `admin-neworders-branch-batch-detail` — Filial paketi tafsiloti | [design/fragments/superadmin--neworders-branch-batch-detail.html](fragments/superadmin--neworders-branch-batch-detail.html) | sahifa | eski |
| `/new-orders/branches/:branchId/batches/:batchId` | admin | `admin-neworders-branch-batch-detail-camera` — Filial paketi tafsiloti — kamera | [design/fragments/superadmin--neworders-branch-batch-detail-camera.html](fragments/superadmin--neworders-branch-batch-detail-camera.html) | oyna | yangi (kodda yo'q) |
| `/new-orders/branches/:branchId/batches/:batchId` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

#### `/new-orders/cancelled` — Bekor qilinganlar — marketlar

- **Fayllar:** `src/pages/new_orders/cancelled/index.tsx` · `src/pages/new_orders/cancelled/utils.ts`
- **Qobiq:** DashboardLayout › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) → `canHandoverCancelledToMarket` (access.ts → canHandoverCancelledToMarket)
- **Rollar:** superadmin, admin, registrator (faqat HQ)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/cancelled` | superadmin | `superadmin-neworders-cancelled-markets` — Bekor qilinganlar — marketlar | [design/fragments/superadmin--neworders-cancelled-markets.html](fragments/superadmin--neworders-cancelled-markets.html) | sahifa | eski |
| `/new-orders/cancelled` | admin | `admin-neworders-cancelled` — Bekor qilinganlar tabi | [design/fragments/admin--neworders-cancelled.html](fragments/admin--neworders-cancelled.html) | sahifa | eski |
| `/new-orders/cancelled` | registrator | `registrator-new-orders-cancelled` — Bekor qilinganlar — marketlar (HQ) | [design/fragments/registrator--new-orders-cancelled.html](fragments/registrator--new-orders-cancelled.html) | sahifa | eski |

#### `/new-orders/cancelled/:marketId` — Bekor qilinganlarni marketga topshirish (market rolida — o'z bekorlari va QR kod)

- **Fayllar:** `src/pages/new_orders/cancelled/detail.tsx` · `src/pages/new_orders/cancelled/utils.ts` · `src/shared/components/ScannerCameraModal.tsx` · `src/app/lib/routes.tsx`
- **Qobiq:** DashboardLayout › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) · o'rovchi: `NewOrdersCancelledDetailEntry`
- **Rollar:** superadmin, admin, registrator (faqat HQ), market (faqat o'z marketi)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski
- **Izoh:** Kirish NewOrdersCancelledDetailEntry (routes.tsx) da: canHandoverCancelledToMarket yoki o'z marketi; boshqalar → /403.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/cancelled/:marketId` | superadmin | `superadmin-neworders-cancelled-handover` — Bekor qilinganlarni marketga topshirish | [design/fragments/superadmin--neworders-cancelled-handover.html](fragments/superadmin--neworders-cancelled-handover.html) | sahifa | eski |
| `/new-orders/cancelled/:marketId` | superadmin | `superadmin-neworders-cancelled-handover-camera` — Bekor qilinganlarni marketga topshirish — kamera | [design/fragments/superadmin--neworders-cancelled-handover-camera.html](fragments/superadmin--neworders-cancelled-handover-camera.html) | oyna | eski |
| `/new-orders/cancelled/:marketId` | superadmin | `superadmin-neworders-cancelled-manual-dialog` — QR buzilganini tasdiqlash (modal) | [design/fragments/superadmin--neworders-cancelled-manual-dialog.html](fragments/superadmin--neworders-cancelled-manual-dialog.html) | oyna | eski |
| `/new-orders/cancelled/:marketId` | superadmin | `superadmin-neworders-cancelled-scanner-dialog` — Kamera skaneri (modal) | [design/fragments/superadmin--neworders-cancelled-scanner-dialog.html](fragments/superadmin--neworders-cancelled-scanner-dialog.html) | oyna | eski |
| `/new-orders/cancelled/:marketId` | admin | `admin-neworders-cancelled-detail` — Bekor qilinganlarni marketga topshirish | [design/fragments/admin--neworders-cancelled-detail.html](fragments/admin--neworders-cancelled-detail.html) | sahifa | eski |
| `/new-orders/cancelled/:marketId` | admin | `admin-neworders-cancelled-detail-camera` — Bekor qilinganlarni marketga topshirish — kamera | [design/fragments/admin--neworders-cancelled-detail-camera.html](fragments/admin--neworders-cancelled-detail-camera.html) | oyna | eski |
| `/new-orders/cancelled/:marketId` | admin | `admin-neworders-cancelled-manual-dialog` — QR buzilganini tasdiqlash | [design/fragments/admin--neworders-cancelled-manual-dialog.html](fragments/admin--neworders-cancelled-manual-dialog.html) | oyna | eski |
| `/new-orders/cancelled/:marketId` | admin | `admin-neworders-cancelled-scanner-dialog` — Market QR skaneri | [design/fragments/admin--neworders-cancelled-scanner-dialog.html](fragments/admin--neworders-cancelled-scanner-dialog.html) | oyna | eski |
| `/new-orders/cancelled/:marketId` | registrator | `registrator-new-orders-cancelled-detail` — Bekor qilinganlarni marketga topshirish (HQ) | [design/fragments/registrator--new-orders-cancelled-detail.html](fragments/registrator--new-orders-cancelled-detail.html) | sahifa | eski |
| `/new-orders/cancelled/:marketId` | registrator | `registrator-new-orders-cancelled-manual-dialog` — QR buzilganini tasdiqlash (HQ) | [design/fragments/registrator--new-orders-cancelled-manual-dialog.html](fragments/registrator--new-orders-cancelled-manual-dialog.html) | oyna | eski |
| `/new-orders/cancelled/:marketId` | registrator | `registrator-new-orders-cancelled-scanner-dialog` — Market QR skanerlash (HQ) | [design/fragments/registrator--new-orders-cancelled-scanner-dialog.html](fragments/registrator--new-orders-cancelled-scanner-dialog.html) | oyna | eski |
| `/new-orders/cancelled/:marketId` | market | `market-new-orders-cancelled` — Bekor qilinganlar | [design/fragments/market--new-orders-cancelled.html](fragments/market--new-orders-cancelled.html) | sahifa | eski |
| `/new-orders/cancelled/:marketId` | market | `market-new-orders-cancelled-qr-dialog` — Bekor qilinganlar · QR kod | [design/fragments/market--new-orders-cancelled-qr-dialog.html](fragments/market--new-orders-cancelled-qr-dialog.html) | oyna | eski |
| `/new-orders/cancelled/:marketId` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

#### `/new-orders/:marketId` — Market yangi buyurtmalari — qabul (market rolida: o'z yangi buyurtmalari)

- **Fayllar:** `src/pages/new_orders/components/new_orderDetail.tsx` · `src/pages/new_orders/components/OrderCard.tsx` · `src/pages/new_orders/components/newOrderReceiveRules.ts` · `src/pages/new_orders/components/lib/printLabelPdf.ts` · `src/shared/components/popupConfirm.tsx` · `src/app/lib/routes.tsx`
- **Qobiq:** DashboardLayout › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) · o'rovchi: `NewOrdersMarketAccessEntry`
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market (faqat o'z marketi)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski
- **Izoh:** NewOrdersMarketAccessEntry (routes.tsx): market faqat o'z marketId sini ochadi. Qabul/o'chirish tasdig'i — PopupConfirm. Tahrirlash → /new-orders/:marketId/edit/:orderId.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/:marketId` | superadmin | `superadmin-neworders-market-orders` — Market yangi buyurtmalari (qabul) | [design/fragments/superadmin--neworders-market-orders.html](fragments/superadmin--neworders-market-orders.html) | sahifa | eski |
| `/new-orders/:marketId` | superadmin | `superadmin-neworders-market-orders-camera` — Market yangi buyurtmalari (qabul) — kamera | [design/fragments/superadmin--neworders-market-orders-camera.html](fragments/superadmin--neworders-market-orders-camera.html) | oyna | yangi (kodda yo'q) |
| `/new-orders/:marketId` | superadmin | `superadmin-neworders-receive-confirm-dialog` — Qo'lda qabul qilish (tasdiq) | [design/fragments/superadmin--neworders-receive-confirm-dialog.html](fragments/superadmin--neworders-receive-confirm-dialog.html) | oyna | eski |
| `/new-orders/:marketId` | admin | `admin-neworders-market-detail` — Market yangi buyurtmalari | [design/fragments/admin--neworders-market-detail.html](fragments/admin--neworders-market-detail.html) | sahifa | eski |
| `/new-orders/:marketId` | admin | `admin-neworders-market-detail-camera` — Market yangi buyurtmalari — kamera | [design/fragments/admin--neworders-market-detail-camera.html](fragments/admin--neworders-market-detail-camera.html) | oyna | yangi (kodda yo'q) |
| `/new-orders/:marketId` | admin | `admin-neworders-market-confirm-dialog` — Qabul tasdig'i / buyurtmani o'chirish | [design/fragments/admin--neworders-market-confirm-dialog.html](fragments/admin--neworders-market-confirm-dialog.html) | oyna | eski |
| `/new-orders/:marketId` | manager | `manager-new-orders-market-detail` — Market buyurtmalari — qabul | [design/fragments/manager--new-orders-market-detail.html](fragments/manager--new-orders-market-detail.html) | sahifa | eski |
| `/new-orders/:marketId` | manager | `manager-new-orders-market-detail-camera` — Market buyurtmalari — qabul — kamera | [design/fragments/manager--new-orders-market-detail-camera.html](fragments/manager--new-orders-market-detail-camera.html) | oyna | yangi (kodda yo'q) |
| `/new-orders/:marketId` | manager | `manager-new-orders-receive-confirm-dialog` — Qo'lda qabul qilish tasdig'i | [design/fragments/manager--new-orders-receive-confirm-dialog.html](fragments/manager--new-orders-receive-confirm-dialog.html) | oyna | eski |
| `/new-orders/:marketId` | manager | `manager-new-orders-delete-confirm-dialog` — Buyurtmani o'chirish tasdig'i | [design/fragments/manager--new-orders-delete-confirm-dialog.html](fragments/manager--new-orders-delete-confirm-dialog.html) | oyna | eski |
| `/new-orders/:marketId` | registrator | `registrator-new-orders-market-detail` — Market buyurtmalari — qabul | [design/fragments/registrator--new-orders-market-detail.html](fragments/registrator--new-orders-market-detail.html) | sahifa | eski |
| `/new-orders/:marketId` | registrator | `registrator-new-orders-market-detail-camera` — Market buyurtmalari — qabul — kamera | [design/fragments/registrator--new-orders-market-detail-camera.html](fragments/registrator--new-orders-market-detail-camera.html) | oyna | yangi (kodda yo'q) |
| `/new-orders/:marketId` | registrator | `registrator-new-orders-market-detail-receive-dialog` — Qabul qilish tasdig'i | [design/fragments/registrator--new-orders-market-detail-receive-dialog.html](fragments/registrator--new-orders-market-detail-receive-dialog.html) | oyna | eski |
| `/new-orders/:marketId` | registrator | `registrator-new-orders-market-detail-delete-dialog` — Buyurtmani o'chirish tasdig'i | [design/fragments/registrator--new-orders-market-detail-delete-dialog.html](fragments/registrator--new-orders-market-detail-delete-dialog.html) | oyna | eski |
| `/new-orders/:marketId` | market | `market-new-orders-list` — Yangi buyurtmalar | [design/fragments/market--new-orders-list.html](fragments/market--new-orders-list.html) | sahifa | eski |
| `/new-orders/:marketId` | market | `market-new-orders-delete-dialog` — Buyurtmani o'chirish | [design/fragments/market--new-orders-delete-dialog.html](fragments/market--new-orders-delete-dialog.html) | oyna | eski |
| `/new-orders/:marketId` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

#### `/new-orders/:marketId/edit/:orderId` — Yangi buyurtmani tahrirlash (qabuldan oldin)

- **Fayllar:** `src/pages/new_orders/components/new_orderUpdate.tsx` · `src/pages/new_orders/components/new_orderUpdate.ui.tsx` · `src/pages/new_orders/components/newOrderUpdateRules.ts` · `src/app/lib/routes.tsx`
- **Qobiq:** DashboardLayout › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) · o'rovchi: `NewOrdersMarketAccessEntry`
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market (faqat o'z marketi)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/:marketId/edit/:orderId` | superadmin | `superadmin-neworders-market-order-edit` — Market buyurtmasini tahrirlash | [design/fragments/superadmin--neworders-market-order-edit.html](fragments/superadmin--neworders-market-order-edit.html) | sahifa | eski |
| `/new-orders/:marketId/edit/:orderId` | admin | — Maket yo'q — superadmin-neworders-market-order-edit ga qarang. | — | — | eski |
| `/new-orders/:marketId/edit/:orderId` | manager | — Maket yo'q — registrator-new-orders-market-order-edit ga qarang. | — | — | eski |
| `/new-orders/:marketId/edit/:orderId` | registrator | `registrator-new-orders-market-order-edit` — Market buyurtmasini tahrirlash | [design/fragments/registrator--new-orders-market-order-edit.html](fragments/registrator--new-orders-market-order-edit.html) | sahifa | eski |
| `/new-orders/:marketId/edit/:orderId` | market | `market-new-orders-edit` — Yangi buyurtma tafsiloti | [design/fragments/market--new-orders-edit.html](fragments/market--new-orders-edit.html) | sahifa | eski |

#### `/new-orders/userDetail/:id` — Foydalanuvchi tafsiloti (eski havola, /new-orders ichida)

- **Fayllar:** `src/pages/users/detail/UserDetailPage.tsx` · `src/widgets/user-detail/ui/UserDetailWidget.tsx`
- **Qobiq:** DashboardLayout › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski
- **Izoh:** Alohida maket yo'q — <rol>-users-detail maketlariga qarang (superadmin-users-detail).

### Pochta

#### `/mails` — Pochta — kirish nuqtasi

- **Fayllar:** `src/pages/mails/index.tsx` · `src/pages/mails/lib/navigation.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewMails` (access.ts → canViewMails)
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier
- **Menyuda:** «Pochta» (`mails`) — superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier
- **Holat:** eski
- **Izoh:** Komponent darhol /mails/today ga yo'naltiradi.

#### `/mails/today` — Pochta — Bugungi pochtalar

- **Fayllar:** `src/pages/mails/index.tsx` · `src/pages/mails/components/todaysMails.tsx` · `src/pages/mails/components/MailGridCard.tsx` · `src/pages/mails/components/MailSummaryStats.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewMails` (access.ts → canViewMails)
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier
- **Menyuda:** «Pochta» (`mails`, `/mails` orqali) — superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier
- **Holat:** eski
- **Izoh:** Tablar (Bugungi · Qaytarish · Rad etilgan · Eski) — src/pages/mails/index.tsx; tor ekranda (< 1280px) tablar ochiladigan ixcham tanlagichga aylanadi (courier-mails-tab-switcher-open).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/mails/today` | superadmin | `superadmin-mails-today` — Pochta — Bugungi pochtalar | [design/fragments/superadmin--mails-today.html](fragments/superadmin--mails-today.html) | sahifa | eski |
| `/mails/today` | admin | `admin-mails-today` — Pochta — Bugungi pochtalar | [design/fragments/superadmin--mails-today.html](fragments/superadmin--mails-today.html) | sahifa | eski |
| `/mails/today` | manager | `manager-mails-today` — Pochta — Bugungi pochtalar | [design/fragments/manager--mails-today.html](fragments/manager--mails-today.html) | sahifa | eski |
| `/mails/today` | registrator | `registrator-mails-today` — Pochta — Bugungi pochtalar | [design/fragments/superadmin--mails-today.html](fragments/superadmin--mails-today.html) | sahifa | eski |
| `/mails/today` | courier | `courier-mails-today` — Pochta — Bugungi | [design/fragments/courier--mails-today.html](fragments/courier--mails-today.html) | sahifa | eski |
| `/mails/today` | courier | `courier-mails-tab-switcher-open` — Pochta — tab tanlash ochiq | [design/fragments/courier--mails-tab-switcher-open.html](fragments/courier--mails-tab-switcher-open.html) | sahifa · faqat telefon | eski |

#### `/mails/return` — Pochta — Qaytarish so'rovlari

- **Fayllar:** `src/pages/mails/index.tsx` · `src/pages/mails/components/returnMails.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewMails` (access.ts → canViewMails)
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/mails/return` | superadmin | `superadmin-mails-return` — Pochta — Qaytarish so'rovlari | [design/fragments/superadmin--mails-return.html](fragments/superadmin--mails-return.html) | sahifa | eski |
| `/mails/return` | admin | `admin-mails-return` — Pochta — Qaytarish | [design/fragments/admin--mails-return.html](fragments/admin--mails-return.html) | sahifa | eski |
| `/mails/return` | manager | `manager-mails-return` — Pochta — Qaytarish so'rovlari | [design/fragments/superadmin--mails-return.html](fragments/superadmin--mails-return.html) | sahifa | eski |
| `/mails/return` | registrator | `registrator-mails-return` — Pochta — Qaytarish | [design/fragments/admin--mails-return.html](fragments/admin--mails-return.html) | sahifa | eski |
| `/mails/return` | courier | — Kuryerda bu tab yo'q — /mails/today ga qaytariladi. | — | — | eski |

#### `/mails/refused` — Pochta — Rad etilgan pochtalar

- **Fayllar:** `src/pages/mails/index.tsx` · `src/pages/mails/components/refusedMails.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewMails` (access.ts → canViewMails)
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/mails/refused` | superadmin | `superadmin-mails-refused` — Pochta — Rad etilgan pochtalar | [design/fragments/superadmin--mails-refused.html](fragments/superadmin--mails-refused.html) | sahifa | eski |
| `/mails/refused` | admin | `admin-mails-refused` — Pochta — Rad etilgan | [design/fragments/admin--mails-refused.html](fragments/admin--mails-refused.html) | sahifa | eski |
| `/mails/refused` | manager | `manager-mails-refused` — Pochta — Rad etilgan pochtalar | [design/fragments/manager--mails-refused.html](fragments/manager--mails-refused.html) | sahifa | eski |
| `/mails/refused` | registrator | `registrator-mails-refused` — Pochta — Rad etilgan pochtalar | [design/fragments/superadmin--mails-refused.html](fragments/superadmin--mails-refused.html) | sahifa | eski |
| `/mails/refused` | courier | `courier-mails-refused` — Pochta — Rad etilgan | [design/fragments/courier--mails-refused.html](fragments/courier--mails-refused.html) | sahifa | eski |

#### `/mails/old` — Pochta — Eski pochtalar (admin/superadmin: «Hamma batchlar» rejimi)

- **Fayllar:** `src/pages/mails/index.tsx` · `src/pages/mails/components/oldMails.tsx` · `src/pages/mails/components/lib/exportOldMailsToExcel.ts` · `src/pages/mails/components/lib/regionFilterOptions.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewMails` (access.ts → canViewMails)
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/mails/old` | superadmin | `superadmin-mails-old` — Pochta — Eski pochtalar | [design/fragments/superadmin--mails-old.html](fragments/superadmin--mails-old.html) | sahifa | eski |
| `/mails/old` | superadmin | `superadmin-mails-old-batches` — Pochta — Hamma batchlar (eski) | [design/fragments/superadmin--mails-old-batches.html](fragments/superadmin--mails-old-batches.html) | sahifa | eski |
| `/mails/old` | admin | `admin-mails-old` — Pochta — Eski pochtalar | [design/fragments/admin--mails-old.html](fragments/admin--mails-old.html) | sahifa | eski |
| `/mails/old` | admin | `admin-mails-old-all-batches` — Eski pochtalar — Hamma batchlar | [design/fragments/admin--mails-old-all-batches.html](fragments/admin--mails-old-all-batches.html) | sahifa | eski |
| `/mails/old` | manager | `manager-mails-old` — Pochta — Eski pochtalar | [design/fragments/manager--mails-old.html](fragments/manager--mails-old.html) | sahifa | eski |
| `/mails/old` | registrator | `registrator-mails-old` — Pochta — Eski pochtalar | [design/fragments/registrator--mails-old.html](fragments/registrator--mails-old.html) | sahifa | eski |
| `/mails/old` | courier | `courier-mails-old` — Pochta — Eski | [design/fragments/courier--mails-old.html](fragments/courier--mails-old.html) | sahifa | eski |

#### `/mails/:id` — Pochta tafsiloti — jo'natish / qabul qilish / rad etilgan / tarix

- **Fayllar:** `src/pages/mails/detail/index.tsx` · `src/pages/mails/detail/model/useMailDetailState.ts` · `src/pages/mails/detail/ui/MailDetailHeader.tsx` · `src/pages/mails/detail/ui/MailStatCards.tsx` · `src/pages/mails/detail/ui/OrdersTable.tsx` · `src/pages/mails/detail/ui/OrderRow.tsx` · `src/pages/mails/detail/ui/SendButton.tsx` · `src/pages/mails/detail/ui/SendPostModal.tsx` · `src/pages/mails/detail/ui/PrintOnlyOrders.tsx` · `src/pages/mails/detail/lib/printMode.ts` · `src/shared/components/PrintModeSelect.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewMails` (access.ts → canViewMails)
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski
- **Izoh:** Rejim URL'dan: ?type=refused → rad etilgan, ?view=old → tarix (faqat o'qish), ?view=old-all-batches → «Hamma batchlar»dan ochilgan tarix (admin/superadmin; *-mails-detail-old / admin-mails-old-detail maketi). «Filialga jo'natish» oynasi faqat superadmin/admin/HQ registrator (canDispatchPostToBranch). Chop etish menyusi — PrintModeSelect.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/mails/:id` | superadmin | `superadmin-mails-detail` — Pochta tafsiloti (jo'natish) | [design/fragments/superadmin--mails-detail.html](fragments/superadmin--mails-detail.html) | sahifa | eski |
| `/mails/:id` | superadmin | `superadmin-mails-detail-camera` — Pochta tafsiloti (jo'natish) — kamera | [design/fragments/superadmin--mails-detail-camera.html](fragments/superadmin--mails-detail-camera.html) | oyna | yangi (kodda yo'q) |
| `/mails/:id` | superadmin | `superadmin-mails-detail-send-dialog` — Pochtani filialga jo'natish (modal)<br>↳ `src/pages/mails/detail/ui/SendPostModal.tsx` | [design/fragments/superadmin--mails-detail-send-dialog.html](fragments/superadmin--mails-detail-send-dialog.html) | oyna | eski |
| `/mails/:id` | superadmin | `superadmin-mails-detail-refused` — Rad etilgan pochta tafsiloti (qabul) | [design/fragments/superadmin--mails-detail-refused.html](fragments/superadmin--mails-detail-refused.html) | sahifa | eski |
| `/mails/:id` | superadmin | `superadmin-mails-detail-old` — Eski pochta tafsiloti (faqat o'qish) | [design/fragments/superadmin--mails-detail-old.html](fragments/superadmin--mails-detail-old.html) | sahifa | eski |
| `/mails/:id` | admin | `admin-mails-detail` — Pochta tafsiloti | [design/fragments/admin--mails-detail.html](fragments/admin--mails-detail.html) | sahifa | eski |
| `/mails/:id` | admin | `admin-mails-detail-camera` — Pochta tafsiloti — kamera | [design/fragments/superadmin--mails-detail-camera.html](fragments/superadmin--mails-detail-camera.html) | oyna | yangi (kodda yo'q) |
| `/mails/:id` | admin | `admin-mails-send-branch-dialog` — Pochtani filialga jo'natish<br>↳ `src/pages/mails/detail/ui/SendPostModal.tsx` | [design/fragments/admin--mails-send-branch-dialog.html](fragments/admin--mails-send-branch-dialog.html) | oyna | eski |
| `/mails/:id` | admin | `admin-mails-refused-detail` — Rad etilgan pochta tafsiloti | [design/fragments/admin--mails-refused-detail.html](fragments/admin--mails-refused-detail.html) | sahifa | eski |
| `/mails/:id` | admin | `admin-mails-old-detail` — Eski pochta tafsiloti (tarix) | [design/fragments/admin--mails-old-detail.html](fragments/admin--mails-old-detail.html) | sahifa | eski |
| `/mails/:id` | manager | `manager-mails-detail-receive` — Pochta tafsiloti — qabul qilish | [design/fragments/manager--mails-detail-receive.html](fragments/manager--mails-detail-receive.html) | sahifa | eski |
| `/mails/:id` | manager | `manager-mails-detail-receive-camera` — Pochta tafsiloti — qabul qilish — kamera | [design/fragments/manager--mails-detail-receive-camera.html](fragments/manager--mails-detail-receive-camera.html) | oyna | yangi (kodda yo'q) |
| `/mails/:id` | manager | `manager-mails-detail-refused-receive` — Rad etilgan pochta — qabul | [design/fragments/manager--mails-detail-refused-receive.html](fragments/manager--mails-detail-refused-receive.html) | sahifa | eski |
| `/mails/:id` | manager | `manager-mails-detail-old` — Eski pochta tafsiloti (tarix) | [design/fragments/admin--mails-old-detail.html](fragments/admin--mails-old-detail.html) | sahifa | eski |
| `/mails/:id` | registrator | `registrator-mails-detail` — Pochta tafsiloti — bugungi | [design/fragments/registrator--mails-detail.html](fragments/registrator--mails-detail.html) | sahifa | eski |
| `/mails/:id` | registrator | `registrator-mails-detail-camera` — Pochta tafsiloti — bugungi — kamera | [design/fragments/registrator--mails-detail-camera.html](fragments/registrator--mails-detail-camera.html) | oyna | yangi (kodda yo'q) |
| `/mails/:id` | registrator | `registrator-mails-detail-send-dialog` — Pochtani filialga jo'natish (HQ)<br>↳ `src/pages/mails/detail/ui/SendPostModal.tsx` | [design/fragments/registrator--mails-detail-send-dialog.html](fragments/registrator--mails-detail-send-dialog.html) | oyna | eski |
| `/mails/:id` | registrator | `registrator-mails-detail-refused` — Pochta tafsiloti — rad etilgan | [design/fragments/registrator--mails-detail-refused.html](fragments/registrator--mails-detail-refused.html) | sahifa | eski |
| `/mails/:id` | registrator | `registrator-mails-detail-old` — Pochta tafsiloti — tarix | [design/fragments/registrator--mails-detail-old.html](fragments/registrator--mails-detail-old.html) | sahifa | eski |
| `/mails/:id` | courier | `courier-mails-detail-receive` — Pochta tafsiloti — qabul qilish | [design/fragments/courier--mails-detail-receive.html](fragments/courier--mails-detail-receive.html) | sahifa | eski |
| `/mails/:id` | courier | `courier-mails-detail-receive-camera` — Pochta tafsiloti — qabul qilish — kamera | [design/fragments/courier--mails-detail-receive-camera.html](fragments/courier--mails-detail-receive-camera.html) | oyna | yangi (kodda yo'q) |
| `/mails/:id` | courier | `courier-mails-detail-refused` — Pochta tafsiloti — rad etilgan (faqat o'qish) | [design/fragments/courier--mails-detail-refused.html](fragments/courier--mails-detail-refused.html) | sahifa | eski |
| `/mails/:id` | courier | `courier-mails-detail-old` — Pochta tafsiloti — eski (tarix) | [design/fragments/courier--mails-detail-old.html](fragments/courier--mails-detail-old.html) | sahifa | eski |
| `/mails/:id` | courier | `courier-mails-detail-print-menu` — Chop etish menyusi<br>↳ `src/shared/components/PrintModeSelect.tsx` | [design/fragments/courier--mails-detail-print-menu.html](fragments/courier--mails-detail-print-menu.html) | oyna | eski |
| `/mails/:id` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

### Paketlar va qaytarishlar

#### `/batches` — Paketlar — Yangi · Eski · Qaytarilgan

- **Fayllar:** `src/pages/batches/ui/BatchesPage.tsx` · `src/pages/batches/lib/batchFormat.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewBatches` (access.ts → canViewBatchesPage)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID)
- **Menyuda:** «Paketlar» (`batches`) — superadmin, admin, manager (HQ · PICKUP · HYBRID)
- **Holat:** eski
- **Izoh:** Tab URL'da: ?tab=new|old|return.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/batches` | superadmin | `superadmin-batches-new` — Paketlar — Yangi | [design/fragments/superadmin--batches-new.html](fragments/superadmin--batches-new.html) | sahifa | eski |
| `/batches` | superadmin | `superadmin-batches-old` — Paketlar — Eski | [design/fragments/superadmin--batches-old.html](fragments/superadmin--batches-old.html) | sahifa | eski |
| `/batches` | superadmin | `superadmin-batches-return` — Paketlar — Qaytarilgan | [design/fragments/superadmin--batches-return.html](fragments/superadmin--batches-return.html) | sahifa | eski |
| `/batches` | admin | `admin-batches-new` — Paketlar — Yangi | [design/fragments/superadmin--batches-new.html](fragments/superadmin--batches-new.html) | sahifa | eski |
| `/batches` | admin | `admin-batches-old` — Paketlar — Eski | [design/fragments/superadmin--batches-old.html](fragments/superadmin--batches-old.html) | sahifa | eski |
| `/batches` | admin | `admin-batches-return` — Paketlar — Qaytarilgan | [design/fragments/superadmin--batches-return.html](fragments/superadmin--batches-return.html) | sahifa | eski |
| `/batches` | manager | `manager-batches-new` — Paketlar — Yangi | [design/fragments/manager--batches-new.html](fragments/manager--batches-new.html) | sahifa | eski |
| `/batches` | manager | `manager-batches-old` — Paketlar — Eski | [design/fragments/manager--batches-old.html](fragments/manager--batches-old.html) | sahifa | eski |
| `/batches` | manager | `manager-batches-return` — Paketlar — Qaytarilgan | [design/fragments/manager--batches-return.html](fragments/manager--batches-return.html) | sahifa | eski |

#### `/batches/:id` — Paket tafsiloti (menejer: asosiy filialga jo'natish yoki faqat o'qish; qaytarish paketi ham shu sahifa)

- **Fayllar:** `src/pages/batches/ui/BatchDetailPage.tsx` · `src/pages/batches/ui/BatchPrintSheet.tsx` · `src/pages/batches/ui/BatchQrCode.tsx` · `src/pages/batches/lib/batchOrderMailAdapter.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewBatches` (access.ts → canViewBatchesPage)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski
- **Izoh:** Jo'natish rejimi: paket holati «new» va rol menejer/registrator (canSendToMainBranch); aks holda faqat o'qish. /returns qatori ham shu sahifani ochadi.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/batches/:id` | superadmin | `superadmin-batches-detail` — Paket tafsiloti | [design/fragments/superadmin--batches-detail.html](fragments/superadmin--batches-detail.html) | sahifa | eski |
| `/batches/:id` | admin | `admin-batches-detail` — Paket tafsiloti | [design/fragments/superadmin--batches-detail.html](fragments/superadmin--batches-detail.html) | sahifa | eski |
| `/batches/:id` | manager | `manager-batches-detail-send` — Paket tafsiloti — asosiy filialga jo'natish | [design/fragments/manager--batches-detail-send.html](fragments/manager--batches-detail-send.html) | sahifa | eski |
| `/batches/:id` | manager | `manager-batches-detail-send-camera` — Paket tafsiloti — asosiy filialga jo'natish — kamera | [design/fragments/manager--batches-detail-send-camera.html](fragments/manager--batches-detail-send-camera.html) | oyna | yangi (kodda yo'q) |
| `/batches/:id` | manager | `manager-batches-detail-readonly` — Paket tafsiloti (faqat o'qish) | [design/fragments/manager--batches-detail-readonly.html](fragments/manager--batches-detail-readonly.html) | sahifa | eski |
| `/batches/:id` | manager | `manager-returns-batch-detail` — Qaytarish paketi tafsiloti | [design/fragments/manager--returns-batch-detail.html](fragments/manager--returns-batch-detail.html) | sahifa | eski |
| `/batches/:id` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

#### `/returns` — Qaytarishlar (qaytarish paketlari ro'yxati)

- **Fayllar:** `src/pages/returns/index.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewReturns` (access.ts → canViewReturnsPage)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID)
- **Menyuda:** «Qaytarishlar» (`returns`) — superadmin, admin, manager (HQ · PICKUP · HYBRID)
- **Holat:** eski
- **Izoh:** Qator bosilsa → /batches/:id (manager-returns-batch-detail).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/returns` | superadmin | `superadmin-returns-list` — Return batchlar | [design/fragments/superadmin--returns-list.html](fragments/superadmin--returns-list.html) | sahifa | eski |
| `/returns` | admin | `admin-returns-list` — Return batchlar | [design/fragments/superadmin--returns-list.html](fragments/superadmin--returns-list.html) | sahifa | eski |
| `/returns` | manager | `manager-returns-list` — Return batchlar | [design/fragments/manager--returns-list.html](fragments/manager--returns-list.html) | sahifa | eski |

### Biriktirish va tezkor amal

#### `/dispatch` — Biriktirish — buyurtmalarni skanerlab kuryerga berish

- **Fayllar:** `src/pages/dispatch/index.tsx` · `src/shared/components/ScannerCameraModal.tsx` · `src/shared/components/popupSelect.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewDispatch` (access.ts → canViewDispatchPage)
- **Rollar:** superadmin, admin, manager (REGIONAL · HYBRID), registrator (HQ · REGIONAL · HYBRID)
- **Menyuda:** «Biriktirish» (`dispatch`) — manager (REGIONAL · HYBRID), registrator (HQ · REGIONAL · HYBRID)
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/dispatch` | superadmin | — Menyuda yo'q (faqat URL) — registrator-dispatch-list ga qarang. | — | — | eski |
| `/dispatch` | admin | — Menyuda yo'q (faqat URL) — registrator-dispatch-list ga qarang. | — | — | eski |
| `/dispatch` | manager | `manager-dispatch-scan` — Biriktirish — skan savati | [design/fragments/manager--dispatch-scan.html](fragments/manager--dispatch-scan.html) | sahifa | eski |
| `/dispatch` | manager | `manager-dispatch-courier-dialog` — Kuryer tanlash oynasi | [design/fragments/manager--dispatch-courier-dialog.html](fragments/manager--dispatch-courier-dialog.html) | oyna | eski |
| `/dispatch` | manager | `manager-dispatch-camera-dialog` — Biriktirish — kamera | [design/fragments/manager--dispatch-camera-dialog.html](fragments/manager--dispatch-camera-dialog.html) | oyna | eski |
| `/dispatch` | registrator | `registrator-dispatch-list` — Biriktirish — skanerlangan buyurtmalar | [design/fragments/registrator--dispatch-list.html](fragments/registrator--dispatch-list.html) | sahifa | eski |
| `/dispatch` | registrator | `registrator-dispatch-empty` — Biriktirish — bo'sh holat | [design/fragments/registrator--dispatch-empty.html](fragments/registrator--dispatch-empty.html) | sahifa | eski |
| `/dispatch` | registrator | `registrator-dispatch-camera-scanner-dialog` — Biriktirish — kamera skaneri | [design/fragments/registrator--dispatch-camera-scanner-dialog.html](fragments/registrator--dispatch-camera-scanner-dialog.html) | oyna | eski |
| `/dispatch` | registrator | `registrator-dispatch-courier-select-dialog` — Biriktirish — kuryer tanlash | [design/fragments/registrator--dispatch-courier-select-dialog.html](fragments/registrator--dispatch-courier-select-dialog.html) | oyna | eski |
| `/dispatch` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

#### `/courier-bulk` — Tezkor amal — kunni yakunlash (skanerlab sotildi / bekor / ertaga)

- **Fayllar:** `src/pages/courier-bulk/index.tsx` · `src/pages/courier-bulk/model/courierBulk.ts` · `src/shared/components/ScannerCameraModal.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewCourierBulk` (access.ts → canViewCourierBulkPage)
- **Rollar:** manager (REGIONAL · HYBRID), courier
- **Menyuda:** «Tezkor amal» (`quickAction`) — manager (REGIONAL · HYBRID), courier
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/courier-bulk` | manager | `manager-courier-bulk-main` — Tezkor amal | [design/fragments/manager--courier-bulk-main.html](fragments/manager--courier-bulk-main.html) | sahifa | eski |
| `/courier-bulk` | manager | `manager-courier-bulk-camera-dialog` — Tezkor amal — kamera | [design/fragments/manager--courier-bulk-camera-dialog.html](fragments/manager--courier-bulk-camera-dialog.html) | oyna | eski |
| `/courier-bulk` | courier | `courier-courier-bulk-main` — Tezkor amal — kunni yakunlash | [design/fragments/courier--courier-bulk-main.html](fragments/courier--courier-bulk-main.html) | sahifa | eski |
| `/courier-bulk` | courier | `courier-courier-bulk-scanner-camera` — Tezkor amal — kamera skaneri | [design/fragments/courier--courier-bulk-scanner-camera.html](fragments/courier--courier-bulk-scanner-camera.html) | oyna | eski |
| `/courier-bulk` | courier | `courier-courier-bulk-scanner-camera-list` — Tezkor amal — kamera, skanerlanganlar ro'yxati | [design/fragments/courier--courier-bulk-scanner-camera-list.html](fragments/courier--courier-bulk-scanner-camera-list.html) | oyna · faqat telefon | yangi (kodda yo'q) |
| `/courier-bulk` | courier | `courier-courier-bulk-confirm-dialog` — Kunni yakunlash — tasdiqlash oynasi | [design/fragments/courier--courier-bulk-confirm-dialog.html](fragments/courier--courier-bulk-confirm-dialog.html) | oyna | yangi (kodda yo'q) |
| `/courier-bulk` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

### Skaner

#### `/scan` — QR skaner — telefon kamerasi (to'liq ekran, ScanLayout)

- **Fayllar:** `src/pages/scan/index.tsx` · `src/pages/scan/lib/scanShared.ts` · `src/shared/lib/useCameraQrScanner.ts` · `src/shared/components/ScanFeedbackOverlay.tsx`
- **Qobiq:** ScanLayout · **Guard:** yo'q (faqat kirish)
- **Rollar:** superadmin, admin, manager, registrator, market, courier
- **Menyuda:** yo'q — yuqori panel → «Skanerlash» tugmasi; telefon menyusi; skaner natijasidan «Skanerga qaytish»
- **Holat:** eski
- **Izoh:** Kirish: yuqori panel «Skanerlash» tugmasi va telefon menyusi. Holatlar (ishga tushmoqda, faol, topildi, noto'g'ri QR, juda tez, kamera xatosi) bitta komponentda.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/scan` | superadmin | `superadmin-scan-camera` — Skaner — kamera (umumiy) | [design/fragments/superadmin--scan-camera.html](fragments/superadmin--scan-camera.html) | sahifa | eski |
| `/scan` | admin | `admin-scan-camera` — Skaner — kamera (umumiy) | [design/fragments/superadmin--scan-camera.html](fragments/superadmin--scan-camera.html) | sahifa | eski |
| `/scan` | manager | `manager-scan-camera` — Skaner — kamera (umumiy) | [design/fragments/superadmin--scan-camera.html](fragments/superadmin--scan-camera.html) | sahifa | eski |
| `/scan` | registrator | `registrator-scan-camera` — Skaner — kamera (umumiy) | [design/fragments/superadmin--scan-camera.html](fragments/superadmin--scan-camera.html) | sahifa | eski |
| `/scan` | market | — Maket yo'q — market skanerlamaydi (roles.json: persona.scan = false). | — | — | eski |
| `/scan` | courier | `courier-scan-camera` — Skaner — kamera | [design/fragments/courier--scan-camera.html](fragments/courier--scan-camera.html) | sahifa | eski |
| `/scan` | courier | `courier-scan-starting` — Skaner — kamera ishga tushmoqda | [design/fragments/courier--scan-starting.html](fragments/courier--scan-starting.html) | sahifa | eski |
| `/scan` | courier | `courier-scan-permission-denied` — Skaner — kameraga ruxsat yo'q | [design/fragments/courier--scan-permission-denied.html](fragments/courier--scan-permission-denied.html) | sahifa | eski |
| `/scan` | courier | `courier-scan-active` — Skaner — skanerlanmoqda | [design/fragments/courier--scan-active.html](fragments/courier--scan-active.html) | sahifa | eski |
| `/scan` | courier | `courier-scan-success-flash` — Skaner — muvaffaqiyatli o'qildi | [design/fragments/courier--scan-success-flash.html](fragments/courier--scan-success-flash.html) | sahifa | eski |
| `/scan` | courier | `courier-scan-invalid` — Skaner — noto'g'ri QR | [design/fragments/courier--scan-invalid.html](fragments/courier--scan-invalid.html) | sahifa | eski |
| `/scan` | courier | `courier-scan-too-fast` — Skaner — juda tez | [design/fragments/courier--scan-too-fast.html](fragments/courier--scan-too-fast.html) | sahifa | eski |
| `/scan` | courier | `courier-scan-offline` — Skaner — internet yo'q (navbat) | [design/fragments/courier--scan-offline.html](fragments/courier--scan-offline.html) | sahifa | yangi (kodda yo'q) |
| `/scan` | courier | `courier-scan-manual-entry` — Skaner — kodni qo'lda kiritish | [design/fragments/courier--scan-manual-entry.html](fragments/courier--scan-manual-entry.html) | sahifa | yangi (kodda yo'q) |
| `/scan` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

#### `/scan/:token` — Skanerlangan obyekt — buyurtma / paket / pochta

- **Fayllar:** `src/pages/scan/detail.tsx` · `src/pages/scan/ui/ScanPackageDetail.tsx` · `src/pages/scan/ui/ScanPostDetail.tsx` · `src/pages/scan/lib/scanResource.ts`
- **Qobiq:** ScanLayout · **Guard:** yo'q (faqat kirish)
- **Rollar:** superadmin, admin, manager, registrator, market, courier
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski
- **Izoh:** «O'zimga olish» tugmasi faqat kuryerda. Paket → ScanPackageDetail, pochta → ScanPostDetail.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/scan/:token` | superadmin | `superadmin-scan-result` — Skanerlangan buyurtma | [design/fragments/superadmin--scan-result.html](fragments/superadmin--scan-result.html) | sahifa | eski |
| `/scan/:token` | admin | `admin-scan-result` — Skanerlangan buyurtma | [design/fragments/superadmin--scan-result.html](fragments/superadmin--scan-result.html) | sahifa | eski |
| `/scan/:token` | manager | `manager-scan-result` — Skanerlangan buyurtma | [design/fragments/manager--scan-result.html](fragments/manager--scan-result.html) | sahifa | eski |
| `/scan/:token` | registrator | `registrator-scan-result` — Skanerlangan buyurtma | [design/fragments/registrator--scan-result.html](fragments/registrator--scan-result.html) | sahifa | eski |
| `/scan/:token` | market | — Maket yo'q — market skanerlamaydi. | — | — | eski |
| `/scan/:token` | courier | `courier-scan-order-detail` — Skanerlangan buyurtma — O'zimga olish | [design/fragments/courier--scan-order-detail.html](fragments/courier--scan-order-detail.html) | sahifa | eski |
| `/scan/:token` | courier | `courier-scan-package-detail` — Skanerlangan paket<br>↳ `src/pages/scan/ui/ScanPackageDetail.tsx` | [design/fragments/courier--scan-package-detail.html](fragments/courier--scan-package-detail.html) | sahifa | eski |
| `/scan/:token` | courier | `courier-scan-post-detail` — Skanerlangan pochta<br>↳ `src/pages/scan/ui/ScanPostDetail.tsx` | [design/fragments/courier--scan-post-detail.html](fragments/courier--scan-post-detail.html) | sahifa | eski |
| `/scan/:token` | courier | `courier-scan-not-found` — Skaner — topilmadi | [design/fragments/courier--scan-not-found.html](fragments/courier--scan-not-found.html) | sahifa | eski |
| `/scan/:token` | courier | `courier-scan-other-courier` — Skaner — boshqa kuryerga biriktirilgan | [design/fragments/courier--scan-other-courier.html](fragments/courier--scan-other-courier.html) | sahifa | qisman |
| `/scan/:token` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

### Moliya — to'lovlar, kassa, balans

#### `/payments` — To'lovlar — umumiy (berilishi / qabul qilinishi kerak, operatsiyalar tarixi)

- **Fayllar:** `src/pages/payments/index.tsx` · `src/pages/payments/components/PaymentSummaryCards.tsx` · `src/pages/payments/components/patmentHistoryTable.tsx` · `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` · `src/pages/payments/components/InactiveBadge.tsx` · `src/pages/payments/components/lib/receiveOptions.ts` · `src/shared/components/popupSelect.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `isPaymentsManager` (access.ts → canViewPaymentsPage) · ruxsat bo'lmasa → `/cash-box`
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID)
- **Menyuda:** «To'lovlar» (`payments`) — superadmin, admin, manager (HQ · REGIONAL · HYBRID)
- **Holat:** eski
- **Izoh:** Berilishi kerak / Qabul qilinishi kerak tanlash oynalari — PopupSelect (payments/index.tsx). Ruxsati yo'q rol (market, kuryer) → /cash-box.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/payments` | superadmin | `superadmin-payments-overview` — To'lovlar — umumiy | [design/fragments/superadmin--payments-overview.html](fragments/superadmin--payments-overview.html) | sahifa | eski |
| `/payments` | superadmin | `superadmin-payments-market-picker-dialog` — Berilishi kerak / Qabul qilinishi kerak — tanlash | [design/fragments/superadmin--payments-market-picker-dialog.html](fragments/superadmin--payments-market-picker-dialog.html) | oyna | eski |
| `/payments` | superadmin | `superadmin-payments-to-give-dialog` — Berilishi kerak — market tanlash | [design/fragments/superadmin--payments-to-give-dialog.html](fragments/superadmin--payments-to-give-dialog.html) | oyna | eski |
| `/payments` | superadmin | `superadmin-payments-history-detail-dialog` — To'lov tarixi — yozuv tafsiloti<br>↳ `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | [design/fragments/superadmin--payments-history-detail-dialog.html](fragments/superadmin--payments-history-detail-dialog.html) | oyna | eski |
| `/payments` | admin | `admin-payments-overview` — To'lovlar | [design/fragments/admin--payments-overview.html](fragments/admin--payments-overview.html) | sahifa | eski |
| `/payments` | admin | `admin-payments-to-give-dialog` — Berilishi kerak — market tanlash | [design/fragments/admin--payments-to-give-dialog.html](fragments/admin--payments-to-give-dialog.html) | oyna | eski |
| `/payments` | admin | `admin-payments-to-receive-dialog` — Qabul qilinishi kerak — tanlash | [design/fragments/admin--payments-to-receive-dialog.html](fragments/admin--payments-to-receive-dialog.html) | oyna | eski |
| `/payments` | admin | `admin-payments-history-detail-dialog` — To'lov tarixi tafsiloti<br>↳ `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | [design/fragments/admin--payments-history-detail-dialog.html](fragments/admin--payments-history-detail-dialog.html) | oyna | eski |
| `/payments` | manager | `manager-payments-overview` — To'lovlar — umumiy | [design/fragments/manager--payments-overview.html](fragments/manager--payments-overview.html) | sahifa | eski |
| `/payments` | manager | `manager-payments-courier-select-dialog` — Qabul qilish — kuryer tanlash | [design/fragments/manager--payments-courier-select-dialog.html](fragments/manager--payments-courier-select-dialog.html) | oyna | eski |
| `/payments` | manager | `manager-payments-history-detail-dialog` — Tranzaksiya tafsiloti<br>↳ `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | [design/fragments/manager--payments-history-detail-dialog.html](fragments/manager--payments-history-detail-dialog.html) | oyna | eski |

#### `/payments/main-cashbox` — Asosiy kassa (to'ldirish / xarajat / smenani yopish)

- **Fayllar:** `src/pages/payments/components/mainCashbox.tsx` · `src/pages/payments/components/CashboxSummaryCard.tsx` · `src/pages/payments/components/CashboxFormPopup.tsx` · `src/pages/payments/components/CloseShiftPopup.tsx` · `src/pages/payments/components/SalaryPaymentPopup.tsx` · `src/pages/payments/components/PaymentHistoryList.tsx` · `src/pages/payments/components/lib/exportMainCashboxReport.ts`
- **Qobiq:** DashboardLayout · **Guard:** `isPaymentsManager` (access.ts → canViewPaymentsPage) · ruxsat bo'lmasa → `/cash-box`
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/payments/main-cashbox` | superadmin | `superadmin-payments-main-cashbox` — Asosiy kassa | [design/fragments/superadmin--payments-main-cashbox.html](fragments/superadmin--payments-main-cashbox.html) | sahifa | eski |
| `/payments/main-cashbox` | superadmin | `superadmin-payments-main-cashbox-fill-dialog` — Kassani to'ldirish / Kassadan xarajat (popup)<br>↳ `src/pages/payments/components/CashboxFormPopup.tsx` | [design/fragments/superadmin--payments-main-cashbox-fill-dialog.html](fragments/superadmin--payments-main-cashbox-fill-dialog.html) | oyna | eski |
| `/payments/main-cashbox` | superadmin | `superadmin-payments-main-cashbox-shift-dialog` — Smenani yopish (popup)<br>↳ `src/pages/payments/components/CloseShiftPopup.tsx` | [design/fragments/superadmin--payments-main-cashbox-shift-dialog.html](fragments/superadmin--payments-main-cashbox-shift-dialog.html) | oyna | eski |
| `/payments/main-cashbox` | admin | `admin-payments-main-cashbox` — Asosiy kassa | [design/fragments/admin--payments-main-cashbox.html](fragments/admin--payments-main-cashbox.html) | sahifa | eski |
| `/payments/main-cashbox` | admin | `admin-payments-cashbox-form-dialog` — Kassadan xarajat / Kassani to'ldirish<br>↳ `src/pages/payments/components/CashboxFormPopup.tsx` | [design/fragments/admin--payments-cashbox-form-dialog.html](fragments/admin--payments-cashbox-form-dialog.html) | oyna | eski |
| `/payments/main-cashbox` | admin | `admin-payments-shift-dialog` — Smenani yopish<br>↳ `src/pages/payments/components/CloseShiftPopup.tsx` | [design/fragments/admin--payments-shift-dialog.html](fragments/admin--payments-shift-dialog.html) | oyna | eski |
| `/payments/main-cashbox` | manager | `manager-payments-main-cashbox` — Asosiy kassa (filial) | [design/fragments/manager--payments-main-cashbox.html](fragments/manager--payments-main-cashbox.html) | sahifa | eski |
| `/payments/main-cashbox` | manager | `manager-payments-cashbox-form-dialog` — Kassadan xarajat / to'ldirish oynasi<br>↳ `src/pages/payments/components/CashboxFormPopup.tsx` | [design/fragments/manager--payments-cashbox-form-dialog.html](fragments/manager--payments-cashbox-form-dialog.html) | oyna | eski |
| `/payments/main-cashbox` | manager | `manager-payments-close-shift-dialog` — Smenani yopish oynasi<br>↳ `src/pages/payments/components/CloseShiftPopup.tsx` | [design/fragments/manager--payments-close-shift-dialog.html](fragments/manager--payments-close-shift-dialog.html) | oyna | eski |

#### `/payments/cash-detail/:id` — Kassa tafsiloti — kuryer / market / filial

- **Fayllar:** `src/pages/payments/components/cashDetail.tsx` · `src/pages/payments/components/CashboxRolePageLayout.tsx` · `src/pages/payments/components/CashboxActionFormCard.tsx` · `src/pages/payments/components/PaymentHistoryList.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `isPaymentsManager` (access.ts → canViewPaymentsPage) · ruxsat bo'lmasa → `/cash-box`
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski
- **Izoh:** Tur URL'da: ?type=courier|market|branch.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/payments/cash-detail/:id` | superadmin | `superadmin-payments-cash-detail-courier` — Kuryer kassasi (qabul qilish) | [design/fragments/superadmin--payments-cash-detail-courier.html](fragments/superadmin--payments-cash-detail-courier.html) | sahifa | eski |
| `/payments/cash-detail/:id` | superadmin | `superadmin-payments-cash-detail-market` — Market kassasi (to'lov berish) | [design/fragments/superadmin--payments-cash-detail-market.html](fragments/superadmin--payments-cash-detail-market.html) | sahifa | eski |
| `/payments/cash-detail/:id` | superadmin | `superadmin-payments-cash-detail-branch` — Filial kassasi (filialdan qabul) | [design/fragments/superadmin--payments-cash-detail-branch.html](fragments/superadmin--payments-cash-detail-branch.html) | sahifa | eski |
| `/payments/cash-detail/:id` | admin | `admin-payments-cash-detail-courier` — Kuryer kassasi | [design/fragments/admin--payments-cash-detail-courier.html](fragments/admin--payments-cash-detail-courier.html) | sahifa | eski |
| `/payments/cash-detail/:id` | admin | `admin-payments-cash-detail-market` — Market kassasi | [design/fragments/admin--payments-cash-detail-market.html](fragments/admin--payments-cash-detail-market.html) | sahifa | eski |
| `/payments/cash-detail/:id` | admin | `admin-payments-cash-detail-branch` — Filial kassasi (HQ qabul) | [design/fragments/admin--payments-cash-detail-branch.html](fragments/admin--payments-cash-detail-branch.html) | sahifa | eski |
| `/payments/cash-detail/:id` | manager | `manager-payments-cash-detail-courier` — Kassa tafsiloti — kuryerdan qabul | [design/fragments/manager--payments-cash-detail-courier.html](fragments/manager--payments-cash-detail-courier.html) | sahifa | eski |
| `/payments/cash-detail/:id` | manager | `manager-payments-cash-detail-branch` — Kassa tafsiloti — HQ'ga o'tkazish | [design/fragments/manager--payments-cash-detail-branch.html](fragments/manager--payments-cash-detail-branch.html) | sahifa | eski |

#### `/cash-box` — O'z kassam — market va kuryer (Barcha tarix · Oldi-berdi)

- **Fayllar:** `src/pages/payments/components/MyCashboxPage.tsx` · `src/pages/payments/components/CashboxRolePageLayout.tsx` · `src/pages/payments/components/PaymentHistoryList.tsx` · `src/pages/payments/components/FinanceHistoryDetailPopup.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `hasSelfCashboxAccess` (routes.tsx → hasSelfCashboxAccess) · ruxsat bo'lmasa → `/payments`
- **Rollar:** manager, market, courier
- **Menyuda:** «To'lovlar» (`payments`) — market; «Kassa» (`payments`) — courier
- **Holat:** eski
- **Izoh:** Tarix tablari: «all» → cashbox-my-all, «payments» → cashbox-my-transfers. Ruxsati yo'q rol → /payments.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/cash-box` | manager | — Maket yo'q. Ayni komponent menejerga filial kassasini ko'rsatadi, lekin menyudagi «To'lovlar» bandi /payments ga olib boradi (HQ · REGIONAL · HYBRID; PICKUP menejerida bu band yo'q, sahifa faqat URL orqali). Eng yaqin maket — market-cashbox-my (ayni tuzilma) va manager-payments-cash-detail-branch. | — | — | eski |
| `/cash-box` | market | `market-cashbox-my` — Market kassasi | [design/fragments/market--cashbox-my.html](fragments/market--cashbox-my.html) | sahifa | eski |
| `/cash-box` | market | `market-cashbox-history-detail-dialog` — Tranzaksiya tafsiloti<br>↳ `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | [design/fragments/market--cashbox-history-detail-dialog.html](fragments/market--cashbox-history-detail-dialog.html) | oyna | eski |
| `/cash-box` | courier | `courier-cashbox-my-all` — Kassa — Barcha tarix | [design/fragments/courier--cashbox-my-all.html](fragments/courier--cashbox-my-all.html) | sahifa | eski |
| `/cash-box` | courier | `courier-cashbox-my-transfers` — Kassa — Oldi-berdi | [design/fragments/courier--cashbox-my-transfers.html](fragments/courier--cashbox-my-transfers.html) | sahifa | eski |
| `/cash-box` | courier | `courier-cashbox-history-detail` — Tranzaksiya tafsiloti<br>↳ `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | [design/fragments/courier--cashbox-history-detail.html](fragments/courier--cashbox-history-detail.html) | oyna | eski |

#### `/financial-balance` — Balans — Umumiy · Tarix · Tahlil

- **Fayllar:** `src/pages/financial-balance/index.tsx` · `src/pages/financial-balance/components/Statistics.tsx` · `src/pages/financial-balance/components/HistoryTab.tsx` · `src/pages/financial-balance/components/AnalysisTab.tsx` · `src/pages/financial-balance/components/FinancialEntryModal.tsx` · `src/pages/financial-balance/components/FinancialHistoryDetail.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewFinancialBalance` (access.ts → canViewFinancialBalance)
- **Rollar:** superadmin, admin
- **Menyuda:** «Balans» (`balance`) — superadmin, admin
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/financial-balance` | superadmin | `superadmin-balance-overview` — Balans — Umumiy ko'rinish<br>↳ `src/pages/financial-balance/components/Statistics.tsx` | [design/fragments/superadmin--balance-overview.html](fragments/superadmin--balance-overview.html) | sahifa | eski |
| `/financial-balance` | superadmin | `superadmin-balance-history` — Balans — Tarix<br>↳ `src/pages/financial-balance/components/HistoryTab.tsx` | [design/fragments/superadmin--balance-history.html](fragments/superadmin--balance-history.html) | sahifa | eski |
| `/financial-balance` | superadmin | `superadmin-balance-entry-dialog` — Qo'lda yozuv qo'shish (modal)<br>↳ `src/pages/financial-balance/components/FinancialEntryModal.tsx` | [design/fragments/superadmin--balance-entry-dialog.html](fragments/superadmin--balance-entry-dialog.html) | oyna | eski |
| `/financial-balance` | superadmin | `superadmin-balance-analysis` — Balans — Tahlil<br>↳ `src/pages/financial-balance/components/AnalysisTab.tsx` | [design/fragments/superadmin--balance-analysis.html](fragments/superadmin--balance-analysis.html) | sahifa | eski |
| `/financial-balance` | superadmin | `superadmin-balance-history-detail-dialog` — Balans yozuvi tafsiloti<br>↳ `src/pages/financial-balance/components/FinancialHistoryDetail.tsx` | [design/fragments/superadmin--balance-history-detail-dialog.html](fragments/superadmin--balance-history-detail-dialog.html) | oyna | eski |
| `/financial-balance` | admin | `admin-balance-overview` — Balans — Umumiy ko'rinish<br>↳ `src/pages/financial-balance/components/Statistics.tsx` | [design/fragments/superadmin--balance-overview.html](fragments/superadmin--balance-overview.html) | sahifa | eski |
| `/financial-balance` | admin | `admin-balance-history` — Balans — Tarix<br>↳ `src/pages/financial-balance/components/HistoryTab.tsx` | [design/fragments/superadmin--balance-history.html](fragments/superadmin--balance-history.html) | sahifa | eski |
| `/financial-balance` | admin | `admin-balance-analysis` — Balans — Tahlil<br>↳ `src/pages/financial-balance/components/AnalysisTab.tsx` | [design/fragments/superadmin--balance-analysis.html](fragments/superadmin--balance-analysis.html) | sahifa | eski |
| `/financial-balance` | admin | `admin-balance-entry-dialog` — Qo'lda yozuv qo'shish<br>↳ `src/pages/financial-balance/components/FinancialEntryModal.tsx` | [design/fragments/admin--balance-entry-dialog.html](fragments/admin--balance-entry-dialog.html) | oyna | eski |
| `/financial-balance` | admin | `admin-balance-history-detail-dialog` — Balans yozuvi tafsiloti<br>↳ `src/pages/financial-balance/components/FinancialHistoryDetail.tsx` | [design/fragments/superadmin--balance-history-detail-dialog.html](fragments/superadmin--balance-history-detail-dialog.html) | oyna | eski |
| `/financial-balance` | tizim taxtasi | `tizim-charts` — Grafiklar — statistika va tahlil | [design/fragments/tizim--charts.html](fragments/tizim--charts.html) | taxta | qoida |

### Mahsulotlar

#### `/products` — Mahsulotlar ro'yxati (tahrirlash, o'chirish, yaratish uchun market tanlash)

- **Fayllar:** `src/pages/products/list/index.tsx` · `src/shared/components/popupSelect.tsx` · `src/shared/components/popupConfirm.tsx` · `src/shared/components/popupUpdate.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canManageProducts` (routes.tsx → canManageProducts)
- **Rollar:** superadmin, admin, manager, registrator, market
- **Menyuda:** «Mahsulotlar» (`products`) — superadmin, admin, manager, registrator, market
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/products` | superadmin | `superadmin-products-list` — Mahsulotlar ro'yxati | [design/fragments/superadmin--products-list.html](fragments/superadmin--products-list.html) | sahifa | eski |
| `/products` | superadmin | `superadmin-products-select-market-dialog` — Mahsulot yaratish — market tanlash | [design/fragments/superadmin--products-select-market-dialog.html](fragments/superadmin--products-select-market-dialog.html) | oyna | eski |
| `/products` | superadmin | `superadmin-products-edit-dialog` — Mahsulotni tahrirlash (popup) | [design/fragments/superadmin--products-edit-dialog.html](fragments/superadmin--products-edit-dialog.html) | oyna | eski |
| `/products` | superadmin | `superadmin-products-delete-dialog` — Mahsulotni o'chirish | [design/fragments/superadmin--products-delete-dialog.html](fragments/superadmin--products-delete-dialog.html) | oyna | eski |
| `/products` | admin | `admin-products-list` — Mahsulotlar ro'yxati | [design/fragments/admin--products-list.html](fragments/admin--products-list.html) | sahifa | eski |
| `/products` | admin | `admin-products-market-select-dialog` — Mahsulot uchun market tanlash | [design/fragments/admin--products-market-select-dialog.html](fragments/admin--products-market-select-dialog.html) | oyna | eski |
| `/products` | admin | `admin-products-edit-dialog` — Mahsulotni tahrirlash | [design/fragments/admin--products-edit-dialog.html](fragments/admin--products-edit-dialog.html) | oyna | eski |
| `/products` | admin | `admin-products-delete-dialog` — Mahsulotni o'chirish | [design/fragments/admin--products-delete-dialog.html](fragments/admin--products-delete-dialog.html) | oyna | eski |
| `/products` | manager | `manager-products-list` — Mahsulotlar ro'yxati | [design/fragments/admin--products-list.html](fragments/admin--products-list.html) | sahifa | eski |
| `/products` | manager | `manager-products-market-select-dialog` — Mahsulot uchun market tanlash | [design/fragments/admin--products-market-select-dialog.html](fragments/admin--products-market-select-dialog.html) | oyna | eski |
| `/products` | manager | `manager-products-edit-dialog` — Mahsulotni tahrirlash | [design/fragments/admin--products-edit-dialog.html](fragments/admin--products-edit-dialog.html) | oyna | eski |
| `/products` | manager | `manager-products-delete-dialog` — Mahsulotni o'chirish | [design/fragments/admin--products-delete-dialog.html](fragments/admin--products-delete-dialog.html) | oyna | eski |
| `/products` | registrator | `registrator-products-list` — Mahsulotlar ro'yxati | [design/fragments/admin--products-list.html](fragments/admin--products-list.html) | sahifa | eski |
| `/products` | registrator | `registrator-products-market-select-dialog` — Mahsulot uchun market tanlash | [design/fragments/admin--products-market-select-dialog.html](fragments/admin--products-market-select-dialog.html) | oyna | eski |
| `/products` | registrator | `registrator-products-edit-dialog` — Mahsulotni tahrirlash | [design/fragments/admin--products-edit-dialog.html](fragments/admin--products-edit-dialog.html) | oyna | eski |
| `/products` | registrator | `registrator-products-delete-dialog` — Mahsulotni o'chirish | [design/fragments/admin--products-delete-dialog.html](fragments/admin--products-delete-dialog.html) | oyna | eski |
| `/products` | market | `market-products-list` — Mahsulotlar | [design/fragments/market--products-list.html](fragments/market--products-list.html) | sahifa | eski |
| `/products` | market | `market-products-edit-dialog` — Mahsulotni tahrirlash | [design/fragments/market--products-edit-dialog.html](fragments/market--products-edit-dialog.html) | oyna | eski |
| `/products` | market | `market-products-delete-dialog` — Mahsulotni o'chirish | [design/fragments/admin--products-delete-dialog.html](fragments/admin--products-delete-dialog.html) | oyna | eski |

#### `/products/create-product/:id` — Mahsulot yaratish (:id — market)

- **Fayllar:** `src/pages/products/create/index.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canCreateProducts` (access.ts → canCreateProducts)
- **Rollar:** superadmin, admin, manager, registrator, market
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/products/create-product/:id` | superadmin | `superadmin-products-create` — Mahsulot yaratish (market uchun) | [design/fragments/superadmin--products-create.html](fragments/superadmin--products-create.html) | sahifa | eski |
| `/products/create-product/:id` | admin | `admin-products-create` — Mahsulot yaratish | [design/fragments/admin--products-create.html](fragments/admin--products-create.html) | sahifa | eski |
| `/products/create-product/:id` | manager | `manager-products-create` — Mahsulot yaratish | [design/fragments/admin--products-create.html](fragments/admin--products-create.html) | sahifa | eski |
| `/products/create-product/:id` | registrator | `registrator-products-create` — Mahsulot yaratish | [design/fragments/admin--products-create.html](fragments/admin--products-create.html) | sahifa | eski |
| `/products/create-product/:id` | market | `market-products-create` — Mahsulot yaratish | [design/fragments/market--products-create.html](fragments/market--products-create.html) | sahifa | eski |

### Foydalanuvchilar

#### `/all-users` — Foydalanuvchilar ro'yxati

- **Fayllar:** `src/pages/users/list/UserListPage.tsx` · `src/widgets/user-list/ui/UserListTable.tsx` · `src/widgets/user-list/ui/UserStats.tsx` · `src/shared/components/popupConfirm.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canManageUsers` (access.ts → canViewUsers) → `canViewUsers` (access.ts → canViewUsers)
- **Rollar:** superadmin, admin, manager (filial turi aniq bo'lsa)
- **Menyuda:** «Foydalanuvchilar» (`users`) — superadmin, admin, manager (HQ · PICKUP · REGIONAL · HYBRID)
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/all-users` | superadmin | `superadmin-users-list` — Foydalanuvchilar ro'yxati | [design/fragments/superadmin--users-list.html](fragments/superadmin--users-list.html) | sahifa | eski |
| `/all-users` | superadmin | `superadmin-users-delete-dialog` — Foydalanuvchini o'chirish (tasdiq) | [design/fragments/superadmin--users-delete-dialog.html](fragments/superadmin--users-delete-dialog.html) | oyna | eski |
| `/all-users` | admin | `admin-users-list` — Foydalanuvchilar ro'yxati | [design/fragments/superadmin--users-list.html](fragments/superadmin--users-list.html) | sahifa | eski |
| `/all-users` | admin | `admin-users-delete-dialog` — Foydalanuvchini o'chirish | [design/fragments/admin--users-delete-dialog.html](fragments/admin--users-delete-dialog.html) | oyna | eski |
| `/all-users` | manager | `manager-users-list` — Foydalanuvchilar (filial xodimlari) | [design/fragments/manager--users-list.html](fragments/manager--users-list.html) | sahifa | eski |

#### `/all-users/create-user` — Foydalanuvchi yaratish

- **Fayllar:** `src/pages/users/create/CreateUserPage.tsx` · `src/widgets/user-create/ui/CreateUserWidget.tsx` · `src/features/user/create-user/ui/CreateUserForm.tsx` · `src/features/user/create-user/ui/RoleSelector.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canManageUsers` (access.ts → canViewUsers) → `canViewUsers` (access.ts → canViewUsers)
- **Rollar:** superadmin, admin, manager (filial turi aniq bo'lsa)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski
- **Izoh:** Menejer: oddiy filialda — kuryer; HYBRID filialda — rol tanlash (kuryer yoki registrator).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/all-users/create-user` | superadmin | `superadmin-users-create` — Foydalanuvchi yaratish | [design/fragments/superadmin--users-create.html](fragments/superadmin--users-create.html) | sahifa | eski |
| `/all-users/create-user` | admin | `admin-users-create` — Yangi foydalanuvchi | [design/fragments/admin--users-create.html](fragments/admin--users-create.html) | sahifa | eski |
| `/all-users/create-user` | manager | `manager-users-create-courier` — Yangi xodim — kuryer | [design/fragments/manager--users-create-courier.html](fragments/manager--users-create-courier.html) | sahifa | eski |
| `/all-users/create-user` | manager | `manager-users-create-hybrid` — Yangi xodim — Aralash filial (rol tanlash) | [design/fragments/manager--users-create-hybrid.html](fragments/manager--users-create-hybrid.html) | sahifa | eski |

#### `/all-users/:id` — Foydalanuvchi tafsiloti

- **Fayllar:** `src/pages/users/detail/UserDetailPage.tsx` · `src/widgets/user-detail/ui/UserDetailWidget.tsx` · `src/widgets/user-detail/ui/MarketTelegramTokenCard.tsx` · `src/features/user/update-user/ui/UpdateUserModal.tsx` · `src/features/courier-transfer-branch/ui/TransferCourierButton.tsx` · `src/features/courier-transfer-branch/ui/TransferCourierModal.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canManageUsers` (access.ts → canViewUsers) → `canViewUsers` (access.ts → canViewUsers)
- **Rollar:** superadmin, admin, manager (filial turi aniq bo'lsa)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/all-users/:id` | superadmin | `superadmin-users-detail` — Foydalanuvchi tafsilotlari | [design/fragments/superadmin--users-detail.html](fragments/superadmin--users-detail.html) | sahifa | eski |
| `/all-users/:id` | superadmin | `superadmin-users-edit-dialog` — Foydalanuvchini tahrirlash (modal)<br>↳ `src/features/user/update-user/ui/UpdateUserModal.tsx` | [design/fragments/superadmin--users-edit-dialog.html](fragments/superadmin--users-edit-dialog.html) | oyna | eski |
| `/all-users/:id` | superadmin | `superadmin-users-courier-transfer-dialog` — Kuryerni boshqa filialga o'tkazish<br>↳ `src/features/courier-transfer-branch/ui/TransferCourierModal.tsx` | [design/fragments/superadmin--users-courier-transfer-dialog.html](fragments/superadmin--users-courier-transfer-dialog.html) | oyna | eski |
| `/all-users/:id` | admin | `admin-users-detail` — Foydalanuvchi tafsiloti | [design/fragments/admin--users-detail.html](fragments/admin--users-detail.html) | sahifa | eski |
| `/all-users/:id` | admin | `admin-users-edit-dialog` — Foydalanuvchini tahrirlash<br>↳ `src/features/user/update-user/ui/UpdateUserModal.tsx` | [design/fragments/admin--users-edit-dialog.html](fragments/admin--users-edit-dialog.html) | oyna | eski |
| `/all-users/:id` | admin | `admin-users-transfer-courier-dialog` — Kuryerni boshqa filialga o'tkazish<br>↳ `src/features/courier-transfer-branch/ui/TransferCourierModal.tsx` | [design/fragments/superadmin--users-courier-transfer-dialog.html](fragments/superadmin--users-courier-transfer-dialog.html) | oyna | eski |
| `/all-users/:id` | manager | `manager-users-detail` — Xodim tafsiloti | [design/fragments/manager--users-detail.html](fragments/manager--users-detail.html) | sahifa | eski |
| `/all-users/:id` | manager | `manager-users-edit-dialog` — Xodimni tahrirlash<br>↳ `src/features/user/update-user/ui/UpdateUserModal.tsx` | [design/fragments/manager--users-edit-dialog.html](fragments/manager--users-edit-dialog.html) | oyna | eski |

### Hududlar

#### `/regions` — Hududlar — xarita va statistika (menejer/kuryer: o'z hududi)

- **Fayllar:** `src/pages/region/index.tsx` · `src/pages/region/ui/UzbekistanRegionMap.tsx` · `src/pages/region/ui/ScopedRegionStatistics.tsx` · `src/pages/region/model/regionScope.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewRegionStats` (routes.tsx → canViewRegionStats)
- **Rollar:** superadmin, admin, manager, courier
- **Menyuda:** «Hududlar» (`regions`) — superadmin, admin, manager, courier
- **Holat:** eski
- **Izoh:** Viloyat oynasi — UzbekistanRegionMap.tsx ichidagi Modal (bosh sahifadagi xarita ham shu).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/regions` | superadmin | `superadmin-regions-map` — Hududlar — xarita va statistika | [design/fragments/superadmin--regions-map.html](fragments/superadmin--regions-map.html) | sahifa | eski |
| `/regions` | superadmin | `superadmin-regions-region-modal` — Viloyat ma'lumotlari (modal)<br>↳ `src/pages/region/ui/UzbekistanRegionMap.tsx` | [design/fragments/superadmin--regions-region-modal.html](fragments/superadmin--regions-region-modal.html) | oyna | eski |
| `/regions` | admin | `admin-regions-map` — Hududlar xaritasi | [design/fragments/admin--regions-map.html](fragments/admin--regions-map.html) | sahifa | eski |
| `/regions` | admin | `admin-regions-region-detail-dialog` — Viloyat ma'lumotlari oynasi<br>↳ `src/pages/region/ui/UzbekistanRegionMap.tsx` | [design/fragments/admin--regions-region-detail-dialog.html](fragments/admin--regions-region-detail-dialog.html) | oyna | eski |
| `/regions` | manager | `manager-regions-scoped` — Hudud — tumanlar statistikasi | [design/fragments/manager--regions-scoped.html](fragments/manager--regions-scoped.html) | sahifa | eski |
| `/regions` | courier | `courier-regions-scoped` — Hududlar — o'z viloyatim | [design/fragments/courier--regions-scoped.html](fragments/courier--regions-scoped.html) | sahifa | eski |
| `/regions` | tizim taxtasi | `tizim-charts` — Grafiklar — statistika va tahlil | [design/fragments/tizim--charts.html](fragments/tizim--charts.html) | taxta | qoida |

#### `/regions/districts` — Tumanlar boshqaruvi

- **Fayllar:** `src/pages/region/pages/districts/index.tsx`
- **Qobiq:** DashboardLayout › Region (`src/pages/region/index.tsx`) · **Guard:** `canViewRegionStats` (routes.tsx → canViewRegionStats)
- **Rollar:** superadmin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski
- **Izoh:** Komponent ichida: superadmin bo'lmasa → /regions.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/regions/districts` | superadmin | `superadmin-regions-districts` — Tumanlar boshqaruvi | [design/fragments/superadmin--regions-districts.html](fragments/superadmin--regions-districts.html) | sahifa | eski |

#### `/regions/sato-management` — Tumanlarni o'tkazish (SATO)

- **Fayllar:** `src/pages/region/pages/sato-management/index.tsx`
- **Qobiq:** DashboardLayout › Region (`src/pages/region/index.tsx`) · **Guard:** `canViewRegionStats` (routes.tsx → canViewRegionStats)
- **Rollar:** superadmin, admin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski
- **Izoh:** Komponent ichida: superadmin/admin bo'lmasa → /regions.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/regions/sato-management` | superadmin | `superadmin-regions-sato-management` — Tumanlarni o'tkazish (SATO) | [design/fragments/superadmin--regions-sato-management.html](fragments/superadmin--regions-sato-management.html) | sahifa | eski |
| `/regions/sato-management` | admin | `admin-regions-sato-management` — Tumanlarni o'tkazish | [design/fragments/admin--regions-sato-management.html](fragments/admin--regions-sato-management.html) | sahifa | eski |

#### `/regions/logist-assignment` — Logist biriktirish

- **Fayllar:** `src/pages/region/pages/logist-assignment/index.tsx`
- **Qobiq:** DashboardLayout › Region (`src/pages/region/index.tsx`) · **Guard:** `canViewRegionStats` (routes.tsx → canViewRegionStats)
- **Rollar:** superadmin, admin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski
- **Izoh:** Komponent ichida: superadmin/admin bo'lmasa → /regions.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/regions/logist-assignment` | superadmin | `superadmin-regions-logist-assignment` — Logist biriktirish | [design/fragments/superadmin--regions-logist-assignment.html](fragments/superadmin--regions-logist-assignment.html) | sahifa | eski |
| `/regions/logist-assignment` | admin | `admin-regions-logist-assignment` — Logist biriktirish | [design/fragments/superadmin--regions-logist-assignment.html](fragments/superadmin--regions-logist-assignment.html) | sahifa | eski |

### Filiallar

#### `/branches` — Filiallar — daraxt / jadval / kartalar

- **Fayllar:** `src/pages/branches/ui/BranchesPage.tsx` · `src/widgets/branch-list/ui/BranchListWidget.tsx` · `src/widgets/branch-list/ui/BranchTree.tsx` · `src/widgets/branch-list/ui/BranchTable.tsx` · `src/widgets/branch-list/ui/BranchCards.tsx` · `src/features/branch-create/ui/BranchFormModal.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewBranches` (access.ts → canViewBranches)
- **Rollar:** superadmin
- **Menyuda:** «Filiallar» (`branches`) — superadmin
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/branches` | superadmin | `superadmin-branches-list-tree` — Filiallar — daraxt ko'rinishi | [design/fragments/superadmin--branches-list-tree.html](fragments/superadmin--branches-list-tree.html) | sahifa | eski |
| `/branches` | superadmin | `superadmin-branches-list-table` — Filiallar — jadval / kartalar | [design/fragments/superadmin--branches-list-table.html](fragments/superadmin--branches-list-table.html) | sahifa | eski |
| `/branches` | superadmin | `superadmin-branches-create-dialog` — Yangi filial (modal)<br>↳ `src/features/branch-create/ui/BranchFormModal.tsx` | [design/fragments/superadmin--branches-create-dialog.html](fragments/superadmin--branches-create-dialog.html) | oyna | eski |

#### `/branches/:id` — Filial tafsiloti

- **Fayllar:** `src/pages/branches/ui/BranchDetailPage.tsx` · `src/widgets/branch-detail/ui/BranchDetailWidget.tsx` · `src/widgets/branch-detail/ui/BranchEmployeesSection.tsx` · `src/widgets/branch-detail/ui/BranchSettingsSection.tsx` · `src/features/branch-add-employee/ui/AddEmployeeModal.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewBranches` (access.ts → canViewBranches)
- **Rollar:** superadmin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/branches/:id` | superadmin | `superadmin-branches-detail` — Filial tafsiloti | [design/fragments/superadmin--branches-detail.html](fragments/superadmin--branches-detail.html) | sahifa | eski |
| `/branches/:id` | superadmin | `superadmin-branches-add-employee-dialog` — Xodim qo'shish (modal)<br>↳ `src/features/branch-add-employee/ui/AddEmployeeModal.tsx` | [design/fragments/superadmin--branches-add-employee-dialog.html](fragments/superadmin--branches-add-employee-dialog.html) | oyna | eski |

### Integratsiyalar

#### `/integrations/connections` — Integratsiyalar konsoli — Hamkorlar · Tashqi tizimlar · Marketplace + ulanish panellari

- **Fayllar:** `src/pages/integrations/ConnectionsPage.tsx` · `src/pages/integrations/index.tsx` · `src/pages/integrations/ConnectionSubNav.tsx` · `src/pages/integrations/FilterPills.tsx` · `src/pages/integrations/NewPartnerModal.tsx` · `src/pages/integrations/panels/ConnectionOverview.tsx` · `src/pages/integrations/panels/ConnectionSettings.tsx` · `src/pages/integrations/panels/ConnectionShipments.tsx` · `src/pages/integrations/panels/ConnectionLog.tsx` · `src/pages/integrations/panels/ConnectionSettlement.tsx` · `src/pages/integrations/panels/ConnectionControl.tsx` · `src/pages/integrations/panels/ConnectionSecurity.tsx` · `src/pages/integrations/ui.ts`
- **Qobiq:** DashboardLayout › IntegrationsPage (`src/pages/integrations/index.tsx`) · **Guard:** `canManageExternalIntegrations` (access.ts → canReceiveExternalOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator
- **Menyuda:** «Integratsiyalar» (`integrations`, `/integrations` orqali) — superadmin, admin
- **Holat:** eski
- **Izoh:** ?scope=partner|external|marketplace → *-console / admin-integrations-{partners,external,marketplace}; ?t=settings|shipments|log|settlement|control|security → panel maketlari (log = «Hodisalar»); ?t=overview (sukut) — konsol maketining o'zi. Tablar — src/pages/integrations/index.tsx (layout).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/integrations/connections` | superadmin | `superadmin-integrations-partners-console` — Integratsiyalar — Hamkorlar (konsol) | [design/fragments/superadmin--integrations-partners-console.html](fragments/superadmin--integrations-partners-console.html) | sahifa | eski |
| `/integrations/connections` | superadmin | `superadmin-integrations-external-console` — Integratsiyalar — Tashqi tizimlar | [design/fragments/superadmin--integrations-external-console.html](fragments/superadmin--integrations-external-console.html) | sahifa | eski |
| `/integrations/connections` | superadmin | `superadmin-integrations-marketplace-console` — Integratsiyalar — Marketplace | [design/fragments/superadmin--integrations-marketplace-console.html](fragments/superadmin--integrations-marketplace-console.html) | sahifa | eski |
| `/integrations/connections` | superadmin | `superadmin-integrations-panel-settings` — Ulanish — Sozlamalar paneli<br>↳ `src/pages/integrations/panels/ConnectionSettings.tsx` | [design/fragments/superadmin--integrations-panel-settings.html](fragments/superadmin--integrations-panel-settings.html) | sahifa | eski |
| `/integrations/connections` | superadmin | `superadmin-integrations-panel-shipments` — Ulanish — Posilkalar paneli<br>↳ `src/pages/integrations/panels/ConnectionShipments.tsx` | [design/fragments/superadmin--integrations-panel-shipments.html](fragments/superadmin--integrations-panel-shipments.html) | sahifa | eski |
| `/integrations/connections` | superadmin | `superadmin-integrations-panel-events` — Ulanish — Hodisalar paneli<br>↳ `src/pages/integrations/panels/ConnectionLog.tsx` | [design/fragments/superadmin--integrations-panel-events.html](fragments/superadmin--integrations-panel-events.html) | sahifa | eski |
| `/integrations/connections` | superadmin | `superadmin-integrations-panel-settlement` — Ulanish — Hisob-kitob paneli<br>↳ `src/pages/integrations/panels/ConnectionSettlement.tsx` | [design/fragments/superadmin--integrations-panel-settlement.html](fragments/superadmin--integrations-panel-settlement.html) | sahifa | eski |
| `/integrations/connections` | superadmin | `superadmin-integrations-settlement-pay-dialog` — Tashuvchidan olingan to'lov (modal)<br>↳ `src/pages/integrations/panels/ConnectionSettlement.tsx` | [design/fragments/superadmin--integrations-settlement-pay-dialog.html](fragments/superadmin--integrations-settlement-pay-dialog.html) | oyna | eski |
| `/integrations/connections` | superadmin | `superadmin-integrations-panel-control` — Ulanish — Ish rejimi paneli<br>↳ `src/pages/integrations/panels/ConnectionControl.tsx` | [design/fragments/superadmin--integrations-panel-control.html](fragments/superadmin--integrations-panel-control.html) | sahifa | eski |
| `/integrations/connections` | superadmin | `superadmin-integrations-panel-security` — Ulanish — Xavfsizlik paneli<br>↳ `src/pages/integrations/panels/ConnectionSecurity.tsx` | [design/fragments/superadmin--integrations-panel-security.html](fragments/superadmin--integrations-panel-security.html) | sahifa | eski |
| `/integrations/connections` | superadmin | `superadmin-integrations-rotate-key-dialog` — Kalitni yangilash (tasdiq)<br>↳ `src/pages/integrations/panels/ConnectionSecurity.tsx` | [design/fragments/superadmin--integrations-rotate-key-dialog.html](fragments/superadmin--integrations-rotate-key-dialog.html) | oyna | eski |
| `/integrations/connections` | superadmin | `superadmin-integrations-new-partner-dialog` — Yangi hamkor (modal)<br>↳ `src/pages/integrations/NewPartnerModal.tsx` | [design/fragments/superadmin--integrations-new-partner-dialog.html](fragments/superadmin--integrations-new-partner-dialog.html) | oyna | eski |
| `/integrations/connections` | admin | `admin-integrations-partners` — Integratsiyalar — Hamkorlar | [design/fragments/admin--integrations-partners.html](fragments/admin--integrations-partners.html) | sahifa | eski |
| `/integrations/connections` | admin | `admin-integrations-external` — Integratsiyalar — Tashqi tizimlar | [design/fragments/admin--integrations-external.html](fragments/admin--integrations-external.html) | sahifa | eski |
| `/integrations/connections` | admin | `admin-integrations-marketplace` — Integratsiyalar — Marketplace | [design/fragments/admin--integrations-marketplace.html](fragments/admin--integrations-marketplace.html) | sahifa | eski |
| `/integrations/connections` | admin | `admin-integrations-conn-settings` — Ulanish — Sozlamalar<br>↳ `src/pages/integrations/panels/ConnectionSettings.tsx` | [design/fragments/admin--integrations-conn-settings.html](fragments/admin--integrations-conn-settings.html) | sahifa | eski |
| `/integrations/connections` | admin | `admin-integrations-conn-shipments` — Ulanish — Posilkalar<br>↳ `src/pages/integrations/panels/ConnectionShipments.tsx` | [design/fragments/admin--integrations-conn-shipments.html](fragments/admin--integrations-conn-shipments.html) | sahifa | eski |
| `/integrations/connections` | admin | `admin-integrations-conn-log` — Ulanish — Hodisalar<br>↳ `src/pages/integrations/panels/ConnectionLog.tsx` | [design/fragments/admin--integrations-conn-log.html](fragments/admin--integrations-conn-log.html) | sahifa | eski |
| `/integrations/connections` | admin | `admin-integrations-conn-settlement` — Ulanish — Hisob-kitob<br>↳ `src/pages/integrations/panels/ConnectionSettlement.tsx` | [design/fragments/admin--integrations-conn-settlement.html](fragments/admin--integrations-conn-settlement.html) | sahifa | eski |
| `/integrations/connections` | admin | `admin-integrations-settlement-pay-dialog` — Tashuvchidan olingan to'lov<br>↳ `src/pages/integrations/panels/ConnectionSettlement.tsx` | [design/fragments/admin--integrations-settlement-pay-dialog.html](fragments/admin--integrations-settlement-pay-dialog.html) | oyna | eski |
| `/integrations/connections` | admin | `admin-integrations-conn-control` — Ulanish — Ish rejimi<br>↳ `src/pages/integrations/panels/ConnectionControl.tsx` | [design/fragments/admin--integrations-conn-control.html](fragments/admin--integrations-conn-control.html) | sahifa | eski |
| `/integrations/connections` | admin | `admin-integrations-conn-security` — Ulanish — Xavfsizlik<br>↳ `src/pages/integrations/panels/ConnectionSecurity.tsx` | [design/fragments/admin--integrations-conn-security.html](fragments/admin--integrations-conn-security.html) | sahifa | eski |
| `/integrations/connections` | admin | `admin-integrations-new-partner-dialog` — Yangi hamkor oynasi<br>↳ `src/pages/integrations/NewPartnerModal.tsx` | [design/fragments/admin--integrations-new-partner-dialog.html](fragments/admin--integrations-new-partner-dialog.html) | oyna | eski |
| `/integrations/connections` | manager | — Menyuda yo'q (faqat URL) — admin-integrations-* maketlariga qarang. | — | — | eski |
| `/integrations/connections` | registrator | — Menyuda yo'q (faqat URL) — admin-integrations-* maketlariga qarang. | — | — | eski |

#### `/integrations/new` — Yangi ulanish — katalog

- **Fayllar:** `src/pages/integrations/CatalogPage.tsx`
- **Qobiq:** DashboardLayout › IntegrationsPage (`src/pages/integrations/index.tsx`) · **Guard:** `canManageExternalIntegrations` (access.ts → canReceiveExternalOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/integrations/new` | superadmin | `superadmin-integrations-catalog` — Yangi ulanish — katalog | [design/fragments/superadmin--integrations-catalog.html](fragments/superadmin--integrations-catalog.html) | sahifa | eski |
| `/integrations/new` | admin | `admin-integrations-catalog` — Yangi ulanish — katalog | [design/fragments/admin--integrations-catalog.html](fragments/admin--integrations-catalog.html) | sahifa | eski |
| `/integrations/new` | manager | — Maket yo'q — admin-integrations-catalog ga qarang. | — | — | eski |
| `/integrations/new` | registrator | — Maket yo'q — admin-integrations-catalog ga qarang. | — | — | eski |

#### `/integrations/new/:typeKey` — Ulash ustasi (Nomi → Kalitlar → Sinash → Tayyor)

- **Fayllar:** `src/pages/integrations/wizard/ConnectWizard.tsx` · `src/pages/integrations/wizard/steps.ts` · `src/pages/integrations/ConnectionFields.tsx`
- **Qobiq:** DashboardLayout › IntegrationsPage (`src/pages/integrations/index.tsx`) · **Guard:** `canManageExternalIntegrations` (access.ts → canReceiveExternalOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/integrations/new/:typeKey` | superadmin | `superadmin-integrations-wizard` — Ulash ustasi (Nomi → Kalitlar → Sinash → Tayyor) | [design/fragments/superadmin--integrations-wizard.html](fragments/superadmin--integrations-wizard.html) | sahifa | eski |
| `/integrations/new/:typeKey` | admin | `admin-integrations-wizard` — Ulash ustasi | [design/fragments/admin--integrations-wizard.html](fragments/admin--integrations-wizard.html) | sahifa | eski |
| `/integrations/new/:typeKey` | manager | — Maket yo'q — admin-integrations-wizard ga qarang. | — | — | eski |
| `/integrations/new/:typeKey` | registrator | — Maket yo'q — admin-integrations-wizard ga qarang. | — | — | eski |

#### `/integrations/partners` — Partner API hamkorlari (eski sahifa, zaxira)

- **Fayllar:** `src/pages/partners/index.tsx`
- **Qobiq:** DashboardLayout › IntegrationsPage (`src/pages/integrations/index.tsx`) · **Guard:** yo'q (faqat kirish)
- **Rollar:** superadmin, admin, manager, registrator, market, courier
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski
- **Izoh:** Marshrutda guard yo'q (faqat kirish) — menyuda ko'rinmaydi; yangi konsol to'liq tasdiqlanguncha zaxira.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/integrations/partners` | superadmin | `superadmin-integrations-legacy-partners` — Partner API hamkorlari (eski sahifa) | [design/fragments/superadmin--integrations-legacy-partners.html](fragments/superadmin--integrations-legacy-partners.html) | sahifa | eski |
| `/integrations/partners` | admin | `admin-integrations-legacy-partners` — Partner API hamkorlari (eski) | [design/fragments/admin--integrations-legacy-partners.html](fragments/admin--integrations-legacy-partners.html) | sahifa | eski |
| `/integrations/partners` | manager | — Menyuda yo'q (marshrutda guard yo'q, faqat URL) — maket chizilmagan. | — | — | eski |
| `/integrations/partners` | registrator | — Menyuda yo'q (marshrutda guard yo'q, faqat URL) — maket chizilmagan. | — | — | eski |
| `/integrations/partners` | market | — Menyuda yo'q (marshrutda guard yo'q, faqat URL) — maket chizilmagan. | — | — | eski |
| `/integrations/partners` | courier | — Menyuda yo'q (marshrutda guard yo'q, faqat URL) — maket chizilmagan. | — | — | eski |

#### `/integrations/sources` — Tashqi manbalar (eski: integratsiyalar ro'yxati)

- **Fayllar:** `src/pages/new_orders/external_orders/index.tsx`
- **Qobiq:** DashboardLayout › IntegrationsPage (`src/pages/integrations/index.tsx`) · **Guard:** `canManageExternalIntegrations` (access.ts → canReceiveExternalOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/integrations/sources` | superadmin | `superadmin-integrations-legacy-sources` — Tashqi manbalar (eski: Integratsiyalar ro'yxati) | [design/fragments/superadmin--integrations-legacy-sources.html](fragments/superadmin--integrations-legacy-sources.html) | sahifa | eski |
| `/integrations/sources` | admin | `admin-integrations-legacy-sources` — Integratsiyalar manbalari (eski) | [design/fragments/admin--integrations-legacy-sources.html](fragments/admin--integrations-legacy-sources.html) | sahifa | eski |
| `/integrations/sources` | manager | — Maket yo'q — admin-integrations-legacy-sources ga qarang. | — | — | eski |
| `/integrations/sources` | registrator | — Maket yo'q — admin-integrations-legacy-sources ga qarang. | — | — | eski |

#### `/integrations/sources/create` — Integratsiya yaratish (eski forma)

- **Fayllar:** `src/pages/new_orders/external_orders/create.tsx`
- **Qobiq:** DashboardLayout › IntegrationsPage (`src/pages/integrations/index.tsx`) · **Guard:** `canManageExternalIntegrations` (access.ts → canReceiveExternalOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/integrations/sources/create` | superadmin | `superadmin-integrations-legacy-source-create` — Integratsiya yaratish (eski forma) | [design/fragments/superadmin--integrations-legacy-source-create.html](fragments/superadmin--integrations-legacy-source-create.html) | sahifa | eski |
| `/integrations/sources/create` | admin | — Maket yo'q — superadmin-integrations-legacy-source-create ga qarang. | — | — | eski |
| `/integrations/sources/create` | manager | — Maket yo'q — superadmin-integrations-legacy-source-create ga qarang. | — | — | eski |
| `/integrations/sources/create` | registrator | — Maket yo'q — superadmin-integrations-legacy-source-create ga qarang. | — | — | eski |

#### `/integrations/sources/:id` — Integratsiya — QR skaner (eski tafsilot)

- **Fayllar:** `src/pages/new_orders/external_orders/detail.tsx`
- **Qobiq:** DashboardLayout › IntegrationsPage (`src/pages/integrations/index.tsx`) · **Guard:** `canManageExternalIntegrations` (access.ts → canReceiveExternalOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/integrations/sources/:id` | superadmin | `superadmin-integrations-legacy-source-detail` — Integratsiya — QR skaner (eski) | [design/fragments/superadmin--integrations-legacy-source-detail.html](fragments/superadmin--integrations-legacy-source-detail.html) | sahifa | eski |
| `/integrations/sources/:id` | admin | — Maket yo'q — superadmin-integrations-legacy-source-detail ga qarang. | — | — | eski |
| `/integrations/sources/:id` | manager | — Maket yo'q — superadmin-integrations-legacy-source-detail ga qarang. | — | — | eski |
| `/integrations/sources/:id` | registrator | — Maket yo'q — superadmin-integrations-legacy-source-detail ga qarang. | — | — | eski |

### Bildirishnomalar

#### `/notifications` — Bildirishnomalar — Telegram guruhlari

- **Fayllar:** `src/pages/notifications/ui/NotificationsPage.tsx` · `src/widgets/notification-table/ui/NotificationTable.tsx` · `src/features/notification-create/ui/NotificationFormModal.tsx` · `src/features/notification-delete/ui/DeleteNotificationButton.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewNotifications` (access.ts → canViewNotifications)
- **Rollar:** superadmin
- **Menyuda:** «Bildirishnomalar» (`notifications`) — superadmin
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/notifications` | superadmin | `superadmin-notifications-telegram-groups` — Bildirishnomalar — Telegram guruhlari | [design/fragments/superadmin--notifications-telegram-groups.html](fragments/superadmin--notifications-telegram-groups.html) | sahifa | eski |
| `/notifications` | superadmin | `superadmin-notifications-create-dialog` — Bildirishnoma qo'shish (modal)<br>↳ `src/features/notification-create/ui/NotificationFormModal.tsx` | [design/fragments/superadmin--notifications-create-dialog.html](fragments/superadmin--notifications-create-dialog.html) | oyna | eski |
| `/notifications` | superadmin | `superadmin-notifications-delete-dialog` — Bildirishnomani o'chirish (tasdiq)<br>↳ `src/features/notification-delete/ui/DeleteNotificationButton.tsx` | [design/fragments/superadmin--notifications-delete-dialog.html](fragments/superadmin--notifications-delete-dialog.html) | oyna | eski |

#### `/notifications/send` — Xabar yuborish (tizim ichidagi bildirishnoma)

- **Fayllar:** `src/pages/notification-send/index.tsx` · `src/features/notification-dispatch/ui/NotificationDispatchForm.tsx` · `src/widgets/notification-inbox/ui/NotificationInboxItem.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canSendNotifications` (access.ts → canSendNotifications)
- **Rollar:** superadmin, admin
- **Menyuda:** yo'q — /inbox sahifasidagi «Xabar yuborish» havolasi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/notifications/send` | superadmin | `superadmin-notifications-send` — Xabar yuborish | [design/fragments/superadmin--notifications-send.html](fragments/superadmin--notifications-send.html) | sahifa | eski |
| `/notifications/send` | superadmin | `superadmin-notifications-send-confirm-dialog` — Xabarni yuborishni tasdiqlang | [design/fragments/superadmin--notifications-send-confirm-dialog.html](fragments/superadmin--notifications-send-confirm-dialog.html) | oyna | eski |
| `/notifications/send` | admin | — Maket yo'q — superadmin-notifications-send ga qarang (kirish: /inbox sahifasidagi havola). | — | — | eski |

#### `/notifications/sms` — SMS — Kampaniya · Shablonlar · Xarajat · Sozlamalar

- **Fayllar:** `src/pages/notifications/ui/SmsPage.tsx` · `src/pages/notifications/ui/CampaignPage.tsx` · `src/pages/notifications/ui/SmsTemplatesTab.tsx` · `src/pages/notifications/ui/SmsReportTab.tsx` · `src/pages/notifications/ui/SmsSettingsTab.tsx` · `src/shared/ui/SmsMeter.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canSendNotifications` (access.ts → canSendNotifications)
- **Rollar:** superadmin, admin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski
- **Izoh:** Tab URL'da: ?tab=campaign|templates|report|settings.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/notifications/sms` | superadmin | `superadmin-notifications-sms-campaign` — SMS — Kampaniya | [design/fragments/superadmin--notifications-sms-campaign.html](fragments/superadmin--notifications-sms-campaign.html) | sahifa | eski |
| `/notifications/sms` | superadmin | `superadmin-notifications-sms-campaign-confirm-dialog` — SMS kampaniyani tasdiqlash | [design/fragments/superadmin--notifications-sms-campaign-confirm-dialog.html](fragments/superadmin--notifications-sms-campaign-confirm-dialog.html) | oyna | eski |
| `/notifications/sms` | superadmin | `superadmin-notifications-sms-templates` — SMS — Shablonlar | [design/fragments/superadmin--notifications-sms-templates.html](fragments/superadmin--notifications-sms-templates.html) | sahifa | eski |
| `/notifications/sms` | superadmin | `superadmin-notifications-sms-report` — SMS — Xarajat | [design/fragments/superadmin--notifications-sms-report.html](fragments/superadmin--notifications-sms-report.html) | sahifa | eski |
| `/notifications/sms` | superadmin | `superadmin-notifications-sms-settings` — SMS — Sozlamalar | [design/fragments/superadmin--notifications-sms-settings.html](fragments/superadmin--notifications-sms-settings.html) | sahifa | eski |
| `/notifications/sms` | admin | — Maket yo'q — superadmin-notifications-sms-* ga qarang. | — | — | eski |

### Tizim — faoliyat jurnali va ops

#### `/activity-logs` — Faoliyat jurnali (ochiladigan qator)

- **Fayllar:** `src/pages/activity-logs/index.tsx` · `src/widgets/activity-log/ui/ActivityLogViewer.tsx` · `src/widgets/activity-log/ui/ActivityLogDetail.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewOps` (routes.tsx → canViewOps)
- **Rollar:** superadmin, admin
- **Menyuda:** «Faoliyat jurnali» (`activityLogs`) — superadmin, admin
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/activity-logs` | superadmin | `superadmin-activity-logs-list` — Faoliyat jurnali | [design/fragments/superadmin--activity-logs-list.html](fragments/superadmin--activity-logs-list.html) | sahifa | eski |
| `/activity-logs` | superadmin | `superadmin-activity-logs-row-expanded` — Faoliyat jurnali — yozuv tafsiloti (ochilgan qator)<br>↳ `src/widgets/activity-log/ui/ActivityLogDetail.tsx` | [design/fragments/superadmin--activity-logs-row-expanded.html](fragments/superadmin--activity-logs-row-expanded.html) | sahifa | eski |
| `/activity-logs` | admin | `admin-activity-logs-list` — Faoliyat jurnali | [design/fragments/superadmin--activity-logs-list.html](fragments/superadmin--activity-logs-list.html) | sahifa | eski |
| `/activity-logs` | admin | `admin-activity-logs-row-expanded` — Jurnal yozuvi ochilgan<br>↳ `src/widgets/activity-log/ui/ActivityLogDetail.tsx` | [design/fragments/admin--activity-logs-row-expanded.html](fragments/admin--activity-logs-row-expanded.html) | sahifa | eski |
| `/activity-logs` | tizim taxtasi | `tizim-states-data` — Holatlar — jadval, ro'yxat, kartalar | [design/fragments/tizim--states-data.html](fragments/tizim--states-data.html) | taxta | qoida |

#### `/ops` — Ops vositalari markazi (tablar: ?tab=finance|integrations|investors|logistics|branches|identity|system|auth)

- **Fayllar:** `src/pages/ops/index.tsx` · `src/pages/ops/tabs.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewOpsPages` (routes.tsx → canViewOpsPages)
- **Rollar:** superadmin
- **Menyuda:** «Ops vositalari» (`ops`) — superadmin
- **Holat:** eski
- **Izoh:** Har tab quyidagi eski to'g'ridan-to'g'ri sahifani ichida ko'rsatadi (/finance-operators … /logs).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/ops` | superadmin | `superadmin-ops-finance-operators` — Ops — Moliya operatorlari | [design/fragments/superadmin--ops-finance-operators.html](fragments/superadmin--ops-finance-operators.html) | sahifa | eski |
| `/ops` | superadmin | `superadmin-ops-integrations` — Ops — Integratsiyalar | [design/fragments/superadmin--ops-integrations.html](fragments/superadmin--ops-integrations.html) | sahifa | eski |
| `/ops` | superadmin | `superadmin-ops-investors` — Ops — Investorlar | [design/fragments/superadmin--ops-investors.html](fragments/superadmin--ops-investors.html) | sahifa | eski |
| `/ops` | superadmin | `superadmin-ops-logistics` — Ops — Logistika (qaytarish so'rovlari) | [design/fragments/superadmin--ops-logistics.html](fragments/superadmin--ops-logistics.html) | sahifa | eski |
| `/ops` | superadmin | `superadmin-ops-branches` — Ops — Filiallar (partiya bekor qilish) | [design/fragments/superadmin--ops-branches.html](fragments/superadmin--ops-branches.html) | sahifa | eski |
| `/ops` | superadmin | `superadmin-ops-identity` — Ops — Xodimlar ro'yxatlari | [design/fragments/superadmin--ops-identity.html](fragments/superadmin--ops-identity.html) | sahifa | eski |
| `/ops` | superadmin | `superadmin-ops-system` — Ops — Tizim | [design/fragments/superadmin--ops-system.html](fragments/superadmin--ops-system.html) | sahifa | eski |
| `/ops` | superadmin | `superadmin-ops-auth-diagnostics` — Ops — Auth diagnostikasi | [design/fragments/superadmin--ops-auth-diagnostics.html](fragments/superadmin--ops-auth-diagnostics.html) | sahifa | eski |

#### `/ops/ui-kit` — Komponentlar to'plami — dizayn v2 primitivlari namunasi (kunduzgi + tungi yonma-yon; ?section=<id>, ?theme-pair=0)

- **Fayllar:** `src/pages/ui-kit/index.tsx` · `src/pages/ui-kit/KitSection.tsx` · `src/pages/ui-kit/ThemePair.tsx` · `src/pages/ui-kit/sections/ButtonsSection.tsx` · `src/pages/ui-kit/sections/BadgesSection.tsx` · `src/pages/ui-kit/sections/CardsSection.tsx` · `src/pages/ui-kit/sections/PageHeaderSection.tsx` · `src/pages/ui-kit/sections/TabsSection.tsx` · `src/pages/ui-kit/sections/FormatSection.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewUiKit` (access.ts → canViewUiKit)
- **Rollar:** superadmin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Ichki sahifa, menyuda yo'q (URL orqali). Skrinshot: npm run app:shot -- /ops/ui-kit.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/ops/ui-kit` | superadmin | — Maket yo'q — ichki komponentlar namunasi; eng yaqini: Main | — | — | v2 |

#### `/finance-operators` — Ops — Moliya operatorlari (eski to'g'ridan-to'g'ri yo'l)

- **Fayllar:** `src/pages/finance-operators/index.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewOpsPages` (routes.tsx → canViewOpsPages)
- **Rollar:** superadmin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/finance-operators` | superadmin | `superadmin-ops-finance-operators` — Ops — Moliya operatorlari | [design/fragments/superadmin--ops-finance-operators.html](fragments/superadmin--ops-finance-operators.html) | sahifa | eski |

#### `/integrations-ops` — Ops — Integratsiyalar

- **Fayllar:** `src/pages/integrations-ops/index.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewOpsPages` (routes.tsx → canViewOpsPages)
- **Rollar:** superadmin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/integrations-ops` | superadmin | `superadmin-ops-integrations` — Ops — Integratsiyalar | [design/fragments/superadmin--ops-integrations.html](fragments/superadmin--ops-integrations.html) | sahifa | eski |

#### `/investors-ops` — Ops — Investorlar

- **Fayllar:** `src/pages/investors-ops/index.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewOpsPages` (routes.tsx → canViewOpsPages)
- **Rollar:** superadmin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/investors-ops` | superadmin | `superadmin-ops-investors` — Ops — Investorlar | [design/fragments/superadmin--ops-investors.html](fragments/superadmin--ops-investors.html) | sahifa | eski |

#### `/logistics-ops` — Ops — Logistika (qaytarish so'rovlari)

- **Fayllar:** `src/pages/logistics-ops/index.tsx` · `src/pages/logistics-ops/lib/returnRequestRows.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewOpsPages` (routes.tsx → canViewOpsPages)
- **Rollar:** superadmin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/logistics-ops` | superadmin | `superadmin-ops-logistics` — Ops — Logistika (qaytarish so'rovlari) | [design/fragments/superadmin--ops-logistics.html](fragments/superadmin--ops-logistics.html) | sahifa | eski |

#### `/branch-ops` — Ops — Filiallar (partiya bekor qilish)

- **Fayllar:** `src/pages/branch-ops/index.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewOpsPages` (routes.tsx → canViewOpsPages)
- **Rollar:** superadmin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/branch-ops` | superadmin | `superadmin-ops-branches` — Ops — Filiallar (partiya bekor qilish) | [design/fragments/superadmin--ops-branches.html](fragments/superadmin--ops-branches.html) | sahifa | eski |

#### `/identity-ops` — Ops — Xodimlar ro'yxatlari

- **Fayllar:** `src/pages/identity-ops/index.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewOpsPages` (routes.tsx → canViewOpsPages)
- **Rollar:** superadmin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/identity-ops` | superadmin | `superadmin-ops-identity` — Ops — Xodimlar ro'yxatlari | [design/fragments/superadmin--ops-identity.html](fragments/superadmin--ops-identity.html) | sahifa | eski |

#### `/system-ops` — Ops — Tizim

- **Fayllar:** `src/pages/system-ops/index.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewOpsPages` (routes.tsx → canViewOpsPages)
- **Rollar:** superadmin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/system-ops` | superadmin | `superadmin-ops-system` — Ops — Tizim | [design/fragments/superadmin--ops-system.html](fragments/superadmin--ops-system.html) | sahifa | eski |

#### `/logs` — Ops — Auth diagnostikasi (nomi «Loglar», lekin jurnal emas)

- **Fayllar:** `src/pages/logs/index.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewLogs` (access.ts → canViewLogs)
- **Rollar:** superadmin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski
- **Izoh:** /ops?tab=auth ichida ham ochiladi. Faoliyat jurnali — /activity-logs.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/logs` | superadmin | `superadmin-ops-auth-diagnostics` — Ops — Auth diagnostikasi | [design/fragments/superadmin--ops-auth-diagnostics.html](fragments/superadmin--ops-auth-diagnostics.html) | sahifa | eski |

#### `/market-operators` — Market operatorlari — YOPIQ sahifa

- **Fayllar:** `src/pages/market-operators/index.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewMarketOperators` (routes.tsx → canViewMarketOperators (doim false))
- **Rollar:** hech kim (yopiq)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** eski
- **Izoh:** canViewMarketOperators = () => false (fix3 RBAC-18): hech kim ocholmaydi, maket yo'q. Backendda market operatorlari yo'li paydo bo'lsa — avval maket chiziladi.

### Profil, sozlamalar, bildirishnomalar qutisi

#### `/profile` — Profil (yuqori panel → profil menyusi)

- **Fayllar:** `src/pages/profile/ui/ProfilePage.tsx` · `src/widgets/user-detail/ui/UserDetailWidget.tsx` · `src/features/user/update-user/ui/UpdateUserModal.tsx`
- **Qobiq:** DashboardLayout · **Guard:** yo'q (faqat kirish)
- **Rollar:** superadmin, admin, manager, registrator, market, courier
- **Menyuda:** yo'q — yuqori panel → ism/avatar (profil)
- **Holat:** eski

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/profile` | umumiy (barcha rollar) | `common-profile` — Profil | [design/fragments/common--profile.html](fragments/common--profile.html) | sahifa | eski |
| `/profile` | umumiy (barcha rollar) | `common-profile-password-dialog` — Profil — parolni o'zgartirish<br>↳ `src/features/user/update-user/ui/UpdateUserModal.tsx` | [design/fragments/common--profile-password-dialog.html](fragments/common--profile-password-dialog.html) | oyna | qisman |

#### `/settings` — Sozlamalar — Ko'rinish · Bosh sahifa · Interfeys · Bildirishnomalar

- **Fayllar:** `src/pages/settings/ui/SettingsPage.tsx` · `src/features/push-notifications/ui/PushPermissionButton.tsx`
- **Qobiq:** DashboardLayout · **Guard:** yo'q (faqat kirish)
- **Rollar:** superadmin, admin, manager, registrator, market, courier
- **Menyuda:** yo'q — yuqori panel → «Sozlamalar» tugmasi; telefon menyusi
- **Holat:** eski
- **Izoh:** Tablar (Ko'rinish · Bosh sahifa · Interfeys · Bildirishnomalar) komponent holatida, URL'da emas — sahifa doim «Ko'rinish» tabidan ochiladi. Maketdagi alohida «Skaner» tabi kodda hozir «Interfeys» tabi ichida (skaner ovozlari).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/settings` | umumiy (barcha rollar) | `common-settings-appearance` — Sozlamalar — Ko'rinish | [design/fragments/common--settings-appearance.html](fragments/common--settings-appearance.html) | sahifa | eski |
| `/settings` | umumiy (barcha rollar) | `common-settings-dashboard` — Sozlamalar — Bosh sahifa bloklari | [design/fragments/common--settings-dashboard.html](fragments/common--settings-dashboard.html) | sahifa | eski |
| `/settings` | umumiy (barcha rollar) | `common-settings-interface` — Sozlamalar — Interfeys | [design/fragments/common--settings-interface.html](fragments/common--settings-interface.html) | sahifa | eski |
| `/settings` | umumiy (barcha rollar) | `common-settings-scanner` — Sozlamalar — Skaner (kamera va ovoz) | [design/fragments/common--settings-scanner.html](fragments/common--settings-scanner.html) | sahifa | qisman |
| `/settings` | umumiy (barcha rollar) | `common-settings-notifications` — Sozlamalar — Bildirishnomalar | [design/fragments/common--settings-notifications.html](fragments/common--settings-notifications.html) | sahifa | eski |

#### `/inbox` — Bildirishnomalar qutisi (qo'ng'iroqcha manzili)

- **Fayllar:** `src/pages/notifications/ui/NotificationInboxPage.tsx` · `src/widgets/notification-inbox/ui/NotificationInboxList.tsx` · `src/widgets/notification-inbox/ui/NotificationInboxItem.tsx` · `src/features/push-notifications/ui/PushPermissionButton.tsx`
- **Qobiq:** DashboardLayout · **Guard:** yo'q (faqat kirish)
- **Rollar:** superadmin, admin, manager, registrator, market, courier
- **Menyuda:** yo'q — yuqori panel → qo'ng'iroqcha; telefon menyusi
- **Holat:** eski
- **Izoh:** Push ruxsati tushuntirish oynasi — PushPermissionButton (sozlamalarda ham).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/inbox` | superadmin | `superadmin-notifications-inbox` — Bildirishnomalar — Inbox (qo'ng'iroqcha) | [design/fragments/superadmin--notifications-inbox.html](fragments/superadmin--notifications-inbox.html) | sahifa | eski |
| `/inbox` | superadmin | `superadmin-notifications-push-explain-dialog` — Bildirishnomalarni yoqasizmi? (tasdiq)<br>↳ `src/features/push-notifications/ui/PushPermissionButton.tsx` | [design/fragments/superadmin--notifications-push-explain-dialog.html](fragments/superadmin--notifications-push-explain-dialog.html) | oyna | eski |
| `/inbox` | courier | `courier-inbox-list` — Bildirishnomalar | [design/fragments/courier--inbox-list.html](fragments/courier--inbox-list.html) | sahifa | eski |
| `/inbox` | courier | `courier-inbox-push-explain-dialog` — Bildirishnomalarni yoqish oynasi<br>↳ `src/features/push-notifications/ui/PushPermissionButton.tsx` | [design/fragments/courier--inbox-push-explain-dialog.html](fragments/courier--inbox-push-explain-dialog.html) | oyna | eski |
| `/inbox` | umumiy (barcha rollar) | `common-inbox` — Bildirishnomalar qutisi | [design/fragments/common--inbox.html](fragments/common--inbox.html) | sahifa | eski |

## 3. Yo'naltirishlar (eski havolalar)

Bu yo'llar sahifa emas — routes.tsx ularni yangi joyga yo'naltiradi (xatcho'p va tashqi havolalar buzilmasin). Maket — yangi joyniki.

| Eski yo'l | → Yangi joy | Guard |
|---|---|---|
| `/integrations` | `/integrations/connections?scope=partner` | — |
| `/integrations/incoming` | `/new-orders/incoming` | — |
| `/partners` | `/integrations/partners` | — |
| `/orders/add` | `/new-orders/create` | — |
| `/new-orders/external` | `/integrations/sources` | `canCreateOrdersByRoleAndBranchType` |
| `/new-orders/external/:id` | `/integrations/sources` | `canCreateOrdersByRoleAndBranchType` |
| `/new-orders/integrations` | `/integrations/sources` | `canCreateOrdersByRoleAndBranchType` |
| `/new-orders/integrations/incoming` | `/new-orders/incoming` | `canCreateOrdersByRoleAndBranchType` |
| `/new-orders/integrations/create` | `/integrations/sources/create` | `canCreateOrdersByRoleAndBranchType` |
| `/new-orders/branches/:branchId/:batchId` | `/new-orders/branches/:branchId/batches/:batchId` | `canCreateOrdersByRoleAndBranchType` → `canViewAdminNewOrderTabs` |
| `/new-orders/integrations/:id` | `/integrations/sources/:id` | `canCreateOrdersByRoleAndBranchType` |
| `/notification` | `/notifications` | — |
| `*` | `/404` | — |

## 4. Maket → kod (teskari, rollar bo'yicha)

Har maket qaysi route/faylda yashaydi. `yangi (kodda yo'q)` — maket chizilgan, kod hali yo'q: route ustuni u qayerga qo'shilishini ko'rsatadi.

### superadmin — Superadmin

124 ta maket · kodda bor: 120 · kodda yo'q: 4

| Maket | Sarlavha | Tur | Route | Asosiy fayl | Holat |
|---|---|---|---|---|---|
| `superadmin-dashboard-main` | Dashboard — Bugungi statistika | sahifa | `/` | `src/pages/dashboard/DashboardPage.tsx` | eski |
| `superadmin-dashboard-region-modal` | Dashboard — Viloyat tafsiloti (xarita) | oyna | `/` | `src/pages/region/ui/UzbekistanRegionMap.tsx` | eski |
| `superadmin-orders-list` | Buyurtmalar ro'yxati | sahifa | `/orders` | `src/pages/orders/index.tsx` | eski |
| `superadmin-orders-filters-mobile` | Buyurtmalar — filtr paneli (telefon) | oyna · faqat telefon | `/orders` | `src/pages/orders/list/OrderFilters.tsx` | eski |
| `superadmin-orders-detail` | Buyurtma tafsilotlari | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | eski |
| `superadmin-orders-detail-edit-order-dialog` | Buyurtmani tahrirlash (popup) | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | eski |
| `superadmin-orders-detail-edit-customer-dialog` | Mijoz ma'lumotini tahrirlash (popup) | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | eski |
| `superadmin-orders-detail-edit-address-dialog` | Manzilni tahrirlash (popup) | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | eski |
| `superadmin-neworders-markets` | Qabul va yaratish — Marketlar | sahifa | `/new-orders` | `src/pages/new_orders/markets/index.tsx` | eski |
| `superadmin-neworders-market-orders` | Market yangi buyurtmalari (qabul) | sahifa | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | eski |
| `superadmin-neworders-market-orders-camera` | Market yangi buyurtmalari (qabul) — kamera | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | yangi (kodda yo'q) — Kamera rejimi yo'q — sahifa faqat USB/klaviatura skaneri bilan ishlaydi (useOrderQrScanner). |
| `superadmin-neworders-receive-confirm-dialog` | Qo'lda qabul qilish (tasdiq) | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | eski |
| `superadmin-neworders-market-order-edit` | Market buyurtmasini tahrirlash | sahifa | `/new-orders/:marketId/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | eski |
| `superadmin-neworders-create-manual-step1` | Buyurtma yaratish — 1-qadam: Market | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/Step1Market.tsx` | eski |
| `superadmin-neworders-create-market-picker-dialog` | Market tanlash (modal) | oyna | `/new-orders/create` | `src/pages/orders/create/ui/Step1Market.tsx` | eski |
| `superadmin-neworders-create-manual-step2` | Buyurtma yaratish — 2-qadam: Mijoz va mahsulot | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/Step2Combined.tsx` | eski |
| `superadmin-neworders-create-ai-input` | Buyurtma yaratish — AI bilan (kiritish) | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiInputPanel.tsx` | eski |
| `superadmin-neworders-create-ai-preview` | Buyurtma yaratish — AI natijalari (preview) | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiPreviewCard.tsx` | eski |
| `superadmin-neworders-create-ai-confirm-dialog` | AI — yaratishni tasdiqlash | oyna | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | eski |
| `superadmin-neworders-incoming-sources` | Kiruvchi posilkalar — manba tanlash | sahifa | `/new-orders/incoming` | `src/pages/incoming-orders/SourcePicker.tsx` | eski |
| `superadmin-neworders-incoming-scan` | Kiruvchi posilkalar — skanerlab qabul | sahifa | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | eski |
| `superadmin-neworders-incoming-scan-camera` | Kiruvchi posilkalar — skanerlab qabul — kamera | oyna | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | yangi (kodda yo'q) — Kamera rejimi yo'q — faqat USB/klaviatura skaneri. |
| `superadmin-neworders-branches` | Filial batchlari — filiallar | sahifa | `/new-orders/branches` | `src/pages/new_orders/branches/index.tsx` | eski |
| `superadmin-neworders-branch-batches` | Filial batchlari ro'yxati | sahifa | `/new-orders/branches/:branchId` | `src/pages/new_orders/branches/batches.tsx` | eski |
| `superadmin-neworders-branch-batch-detail` | Filial paketi tafsiloti | sahifa | `/new-orders/branches/:branchId/batches/:batchId` | `src/pages/new_orders/branches/batchDetail.tsx` | eski |
| `superadmin-neworders-branch-batch-detail-camera` | Filial paketi tafsiloti — kamera | oyna | `/new-orders/branches/:branchId/batches/:batchId` | `src/pages/new_orders/branches/batchDetail.tsx` | yangi (kodda yo'q) — Kamera rejimi yo'q — faqat USB/klaviatura skaneri (useOrderQrScanner). |
| `superadmin-neworders-cancelled-markets` | Bekor qilinganlar — marketlar | sahifa | `/new-orders/cancelled` | `src/pages/new_orders/cancelled/index.tsx` | eski |
| `superadmin-neworders-cancelled-handover` | Bekor qilinganlarni marketga topshirish | sahifa | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | eski |
| `superadmin-neworders-cancelled-handover-camera` | Bekor qilinganlarni marketga topshirish — kamera | oyna | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | eski |
| `superadmin-neworders-cancelled-manual-dialog` | QR buzilganini tasdiqlash (modal) | oyna | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | eski |
| `superadmin-neworders-cancelled-scanner-dialog` | Kamera skaneri (modal) | oyna | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | eski |
| `superadmin-mails-today` | Pochta — Bugungi pochtalar | sahifa | `/mails/today` | `src/pages/mails/index.tsx` | eski |
| `superadmin-mails-return` | Pochta — Qaytarish so'rovlari | sahifa | `/mails/return` | `src/pages/mails/index.tsx` | eski |
| `superadmin-mails-refused` | Pochta — Rad etilgan pochtalar | sahifa | `/mails/refused` | `src/pages/mails/index.tsx` | eski |
| `superadmin-mails-old` | Pochta — Eski pochtalar | sahifa | `/mails/old` | `src/pages/mails/index.tsx` | eski |
| `superadmin-mails-old-batches` | Pochta — Hamma batchlar (eski) | sahifa | `/mails/old` | `src/pages/mails/index.tsx` | eski |
| `superadmin-mails-detail` | Pochta tafsiloti (jo'natish) | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | eski |
| `superadmin-mails-detail-camera` | Pochta tafsiloti (jo'natish) — kamera | oyna | `/mails/:id` | `src/pages/mails/detail/index.tsx` | yangi (kodda yo'q) — Kamera rejimi yo'q — faqat USB/klaviatura skaneri (useOrderQrScanner). |
| `superadmin-mails-detail-send-dialog` | Pochtani filialga jo'natish (modal) | oyna | `/mails/:id` | `src/pages/mails/detail/ui/SendPostModal.tsx` | eski |
| `superadmin-mails-detail-refused` | Rad etilgan pochta tafsiloti (qabul) | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | eski |
| `superadmin-mails-detail-old` | Eski pochta tafsiloti (faqat o'qish) | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | eski |
| `superadmin-batches-new` | Paketlar — Yangi | sahifa | `/batches` | `src/pages/batches/ui/BatchesPage.tsx` | eski |
| `superadmin-batches-old` | Paketlar — Eski | sahifa | `/batches` | `src/pages/batches/ui/BatchesPage.tsx` | eski |
| `superadmin-batches-return` | Paketlar — Qaytarilgan | sahifa | `/batches` | `src/pages/batches/ui/BatchesPage.tsx` | eski |
| `superadmin-batches-detail` | Paket tafsiloti | sahifa | `/batches/:id` | `src/pages/batches/ui/BatchDetailPage.tsx` | eski |
| `superadmin-returns-list` | Return batchlar | sahifa | `/returns` | `src/pages/returns/index.tsx` | eski |
| `superadmin-payments-overview` | To'lovlar — umumiy | sahifa | `/payments` | `src/pages/payments/index.tsx` | eski |
| `superadmin-payments-market-picker-dialog` | Berilishi kerak / Qabul qilinishi kerak — tanlash | oyna | `/payments` | `src/pages/payments/index.tsx` | eski |
| `superadmin-payments-history-detail-dialog` | To'lov tarixi — yozuv tafsiloti | oyna | `/payments` | `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | eski |
| `superadmin-payments-main-cashbox` | Asosiy kassa | sahifa | `/payments/main-cashbox` | `src/pages/payments/components/mainCashbox.tsx` | eski |
| `superadmin-payments-main-cashbox-fill-dialog` | Kassani to'ldirish / Kassadan xarajat (popup) | oyna | `/payments/main-cashbox` | `src/pages/payments/components/CashboxFormPopup.tsx` | eski |
| `superadmin-payments-main-cashbox-shift-dialog` | Smenani yopish (popup) | oyna | `/payments/main-cashbox` | `src/pages/payments/components/CloseShiftPopup.tsx` | eski |
| `superadmin-payments-cash-detail-courier` | Kuryer kassasi (qabul qilish) | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | eski |
| `superadmin-payments-cash-detail-market` | Market kassasi (to'lov berish) | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | eski |
| `superadmin-payments-cash-detail-branch` | Filial kassasi (filialdan qabul) | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | eski |
| `superadmin-payments-to-give-dialog` | Berilishi kerak — market tanlash | oyna | `/payments` | `src/pages/payments/index.tsx` | eski |
| `superadmin-balance-overview` | Balans — Umumiy ko'rinish | sahifa | `/financial-balance` | `src/pages/financial-balance/components/Statistics.tsx` | eski |
| `superadmin-balance-history` | Balans — Tarix | sahifa | `/financial-balance` | `src/pages/financial-balance/components/HistoryTab.tsx` | eski |
| `superadmin-balance-entry-dialog` | Qo'lda yozuv qo'shish (modal) | oyna | `/financial-balance` | `src/pages/financial-balance/components/FinancialEntryModal.tsx` | eski |
| `superadmin-balance-analysis` | Balans — Tahlil | sahifa | `/financial-balance` | `src/pages/financial-balance/components/AnalysisTab.tsx` | eski |
| `superadmin-balance-history-detail-dialog` | Balans yozuvi tafsiloti | oyna | `/financial-balance` | `src/pages/financial-balance/components/FinancialHistoryDetail.tsx` | eski |
| `superadmin-products-list` | Mahsulotlar ro'yxati | sahifa | `/products` | `src/pages/products/list/index.tsx` | eski |
| `superadmin-products-select-market-dialog` | Mahsulot yaratish — market tanlash | oyna | `/products` | `src/pages/products/list/index.tsx` | eski |
| `superadmin-products-edit-dialog` | Mahsulotni tahrirlash (popup) | oyna | `/products` | `src/pages/products/list/index.tsx` | eski |
| `superadmin-products-create` | Mahsulot yaratish (market uchun) | sahifa | `/products/create-product/:id` | `src/pages/products/create/index.tsx` | eski |
| `superadmin-products-delete-dialog` | Mahsulotni o'chirish | oyna | `/products` | `src/pages/products/list/index.tsx` | eski |
| `superadmin-users-list` | Foydalanuvchilar ro'yxati | sahifa | `/all-users` | `src/pages/users/list/UserListPage.tsx` | eski |
| `superadmin-users-delete-dialog` | Foydalanuvchini o'chirish (tasdiq) | oyna | `/all-users` | `src/pages/users/list/UserListPage.tsx` | eski |
| `superadmin-users-create` | Foydalanuvchi yaratish | sahifa | `/all-users/create-user` | `src/pages/users/create/CreateUserPage.tsx` | eski |
| `superadmin-users-detail` | Foydalanuvchi tafsilotlari | sahifa | `/all-users/:id` | `src/pages/users/detail/UserDetailPage.tsx` | eski |
| `superadmin-users-edit-dialog` | Foydalanuvchini tahrirlash (modal) | oyna | `/all-users/:id` | `src/features/user/update-user/ui/UpdateUserModal.tsx` | eski |
| `superadmin-users-courier-transfer-dialog` | Kuryerni boshqa filialga o'tkazish | oyna | `/all-users/:id` | `src/features/courier-transfer-branch/ui/TransferCourierModal.tsx` | eski |
| `superadmin-regions-map` | Hududlar — xarita va statistika | sahifa | `/regions` | `src/pages/region/index.tsx` | eski |
| `superadmin-regions-region-modal` | Viloyat ma'lumotlari (modal) | oyna | `/regions` | `src/pages/region/ui/UzbekistanRegionMap.tsx` | eski |
| `superadmin-regions-districts` | Tumanlar boshqaruvi | sahifa | `/regions/districts` | `src/pages/region/pages/districts/index.tsx` | eski |
| `superadmin-regions-sato-management` | Tumanlarni o'tkazish (SATO) | sahifa | `/regions/sato-management` | `src/pages/region/pages/sato-management/index.tsx` | eski |
| `superadmin-regions-logist-assignment` | Logist biriktirish | sahifa | `/regions/logist-assignment` | `src/pages/region/pages/logist-assignment/index.tsx` | eski |
| `superadmin-branches-list-tree` | Filiallar — daraxt ko'rinishi | sahifa | `/branches` | `src/pages/branches/ui/BranchesPage.tsx` | eski |
| `superadmin-branches-list-table` | Filiallar — jadval / kartalar | sahifa | `/branches` | `src/pages/branches/ui/BranchesPage.tsx` | eski |
| `superadmin-branches-create-dialog` | Yangi filial (modal) | oyna | `/branches` | `src/features/branch-create/ui/BranchFormModal.tsx` | eski |
| `superadmin-branches-detail` | Filial tafsiloti | sahifa | `/branches/:id` | `src/pages/branches/ui/BranchDetailPage.tsx` | eski |
| `superadmin-branches-add-employee-dialog` | Xodim qo'shish (modal) | oyna | `/branches/:id` | `src/features/branch-add-employee/ui/AddEmployeeModal.tsx` | eski |
| `superadmin-integrations-partners-console` | Integratsiyalar — Hamkorlar (konsol) | sahifa | `/integrations/connections` | `src/pages/integrations/ConnectionsPage.tsx` | eski |
| `superadmin-integrations-external-console` | Integratsiyalar — Tashqi tizimlar | sahifa | `/integrations/connections` | `src/pages/integrations/ConnectionsPage.tsx` | eski |
| `superadmin-integrations-marketplace-console` | Integratsiyalar — Marketplace | sahifa | `/integrations/connections` | `src/pages/integrations/ConnectionsPage.tsx` | eski |
| `superadmin-integrations-panel-settings` | Ulanish — Sozlamalar paneli | sahifa | `/integrations/connections` | `src/pages/integrations/panels/ConnectionSettings.tsx` | eski |
| `superadmin-integrations-panel-shipments` | Ulanish — Posilkalar paneli | sahifa | `/integrations/connections` | `src/pages/integrations/panels/ConnectionShipments.tsx` | eski |
| `superadmin-integrations-panel-events` | Ulanish — Hodisalar paneli | sahifa | `/integrations/connections` | `src/pages/integrations/panels/ConnectionLog.tsx` | eski |
| `superadmin-integrations-panel-settlement` | Ulanish — Hisob-kitob paneli | sahifa | `/integrations/connections` | `src/pages/integrations/panels/ConnectionSettlement.tsx` | eski |
| `superadmin-integrations-settlement-pay-dialog` | Tashuvchidan olingan to'lov (modal) | oyna | `/integrations/connections` | `src/pages/integrations/panels/ConnectionSettlement.tsx` | eski |
| `superadmin-integrations-panel-control` | Ulanish — Ish rejimi paneli | sahifa | `/integrations/connections` | `src/pages/integrations/panels/ConnectionControl.tsx` | eski |
| `superadmin-integrations-panel-security` | Ulanish — Xavfsizlik paneli | sahifa | `/integrations/connections` | `src/pages/integrations/panels/ConnectionSecurity.tsx` | eski |
| `superadmin-integrations-rotate-key-dialog` | Kalitni yangilash (tasdiq) | oyna | `/integrations/connections` | `src/pages/integrations/panels/ConnectionSecurity.tsx` | eski |
| `superadmin-integrations-new-partner-dialog` | Yangi hamkor (modal) | oyna | `/integrations/connections` | `src/pages/integrations/NewPartnerModal.tsx` | eski |
| `superadmin-integrations-catalog` | Yangi ulanish — katalog | sahifa | `/integrations/new` | `src/pages/integrations/CatalogPage.tsx` | eski |
| `superadmin-integrations-wizard` | Ulash ustasi (Nomi → Kalitlar → Sinash → Tayyor) | sahifa | `/integrations/new/:typeKey` | `src/pages/integrations/wizard/ConnectWizard.tsx` | eski |
| `superadmin-integrations-legacy-partners` | Partner API hamkorlari (eski sahifa) | sahifa | `/integrations/partners` | `src/pages/partners/index.tsx` | eski |
| `superadmin-integrations-legacy-sources` | Tashqi manbalar (eski: Integratsiyalar ro'yxati) | sahifa | `/integrations/sources` | `src/pages/new_orders/external_orders/index.tsx` | eski |
| `superadmin-integrations-legacy-source-create` | Integratsiya yaratish (eski forma) | sahifa | `/integrations/sources/create` | `src/pages/new_orders/external_orders/create.tsx` | eski |
| `superadmin-integrations-legacy-source-detail` | Integratsiya — QR skaner (eski) | sahifa | `/integrations/sources/:id` | `src/pages/new_orders/external_orders/detail.tsx` | eski |
| `superadmin-notifications-telegram-groups` | Bildirishnomalar — Telegram guruhlari | sahifa | `/notifications` | `src/pages/notifications/ui/NotificationsPage.tsx` | eski |
| `superadmin-notifications-create-dialog` | Bildirishnoma qo'shish (modal) | oyna | `/notifications` | `src/features/notification-create/ui/NotificationFormModal.tsx` | eski |
| `superadmin-notifications-delete-dialog` | Bildirishnomani o'chirish (tasdiq) | oyna | `/notifications` | `src/features/notification-delete/ui/DeleteNotificationButton.tsx` | eski |
| `superadmin-notifications-inbox` | Bildirishnomalar — Inbox (qo'ng'iroqcha) | sahifa | `/inbox` | `src/pages/notifications/ui/NotificationInboxPage.tsx` | eski |
| `superadmin-notifications-push-explain-dialog` | Bildirishnomalarni yoqasizmi? (tasdiq) | oyna | `/inbox` | `src/features/push-notifications/ui/PushPermissionButton.tsx` | eski |
| `superadmin-notifications-send` | Xabar yuborish | sahifa | `/notifications/send` | `src/pages/notification-send/index.tsx` | eski |
| `superadmin-notifications-send-confirm-dialog` | Xabarni yuborishni tasdiqlang | oyna | `/notifications/send` | `src/pages/notification-send/index.tsx` | eski |
| `superadmin-notifications-sms-campaign` | SMS — Kampaniya | sahifa | `/notifications/sms` | `src/pages/notifications/ui/SmsPage.tsx` | eski |
| `superadmin-notifications-sms-campaign-confirm-dialog` | SMS kampaniyani tasdiqlash | oyna | `/notifications/sms` | `src/pages/notifications/ui/SmsPage.tsx` | eski |
| `superadmin-notifications-sms-templates` | SMS — Shablonlar | sahifa | `/notifications/sms` | `src/pages/notifications/ui/SmsPage.tsx` | eski |
| `superadmin-notifications-sms-report` | SMS — Xarajat | sahifa | `/notifications/sms` | `src/pages/notifications/ui/SmsPage.tsx` | eski |
| `superadmin-notifications-sms-settings` | SMS — Sozlamalar | sahifa | `/notifications/sms` | `src/pages/notifications/ui/SmsPage.tsx` | eski |
| `superadmin-activity-logs-list` | Faoliyat jurnali | sahifa | `/activity-logs` | `src/pages/activity-logs/index.tsx` | eski |
| `superadmin-activity-logs-row-expanded` | Faoliyat jurnali — yozuv tafsiloti (ochilgan qator) | sahifa | `/activity-logs` | `src/widgets/activity-log/ui/ActivityLogDetail.tsx` | eski |
| `superadmin-ops-finance-operators` | Ops — Moliya operatorlari | sahifa | `/ops`, `/finance-operators` | `src/pages/ops/index.tsx`, `src/pages/finance-operators/index.tsx` | eski |
| `superadmin-ops-integrations` | Ops — Integratsiyalar | sahifa | `/ops`, `/integrations-ops` | `src/pages/ops/index.tsx`, `src/pages/integrations-ops/index.tsx` | eski |
| `superadmin-ops-investors` | Ops — Investorlar | sahifa | `/ops`, `/investors-ops` | `src/pages/ops/index.tsx`, `src/pages/investors-ops/index.tsx` | eski |
| `superadmin-ops-logistics` | Ops — Logistika (qaytarish so'rovlari) | sahifa | `/ops`, `/logistics-ops` | `src/pages/ops/index.tsx`, `src/pages/logistics-ops/index.tsx` | eski |
| `superadmin-ops-branches` | Ops — Filiallar (partiya bekor qilish) | sahifa | `/ops`, `/branch-ops` | `src/pages/ops/index.tsx`, `src/pages/branch-ops/index.tsx` | eski |
| `superadmin-ops-identity` | Ops — Xodimlar ro'yxatlari | sahifa | `/ops`, `/identity-ops` | `src/pages/ops/index.tsx`, `src/pages/identity-ops/index.tsx` | eski |
| `superadmin-ops-system` | Ops — Tizim | sahifa | `/ops`, `/system-ops` | `src/pages/ops/index.tsx`, `src/pages/system-ops/index.tsx` | eski |
| `superadmin-ops-auth-diagnostics` | Ops — Auth diagnostikasi | sahifa | `/ops`, `/logs` | `src/pages/ops/index.tsx`, `src/pages/logs/index.tsx` | eski |
| `superadmin-scan-camera` | Skaner — kamera (umumiy) | sahifa | `/scan` | `src/pages/scan/index.tsx` | eski |
| `superadmin-scan-result` | Skanerlangan buyurtma | sahifa | `/scan/:token` | `src/pages/scan/detail.tsx` | eski |

### admin — Admin

91 ta maket · kodda bor: 87 · kodda yo'q: 4

| Maket | Sarlavha | Tur | Route | Asosiy fayl | Holat |
|---|---|---|---|---|---|
| `admin-dashboard-main` | Dashboard | sahifa | `/` | `src/pages/dashboard/DashboardPage.tsx` | eski |
| `admin-orders-list` | Buyurtmalar ro'yxati | sahifa | `/orders` | `src/pages/orders/index.tsx` | eski |
| `admin-orders-filters-mobile` | Buyurtmalar — filtr paneli (telefon) | oyna · faqat telefon | `/orders` | `src/pages/orders/list/OrderFilters.tsx` | eski |
| `admin-orders-detail` | Buyurtma tafsiloti | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | eski |
| `admin-orders-edit-order-dialog` | Buyurtmani tahrirlash oynasi | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | eski |
| `admin-orders-edit-customer-dialog` | Mijozni tahrirlash oynasi | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | eski |
| `admin-orders-edit-address-dialog` | Manzilni tahrirlash oynasi | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | eski |
| `admin-neworders-markets` | Qabul — Marketlar tabi | sahifa | `/new-orders` | `src/pages/new_orders/markets/index.tsx` | eski |
| `admin-neworders-market-detail` | Market yangi buyurtmalari | sahifa | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | eski |
| `admin-neworders-market-detail-camera` | Market yangi buyurtmalari — kamera | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | yangi (kodda yo'q) — Kamera rejimi yo'q — faqat USB/klaviatura skaneri (useOrderQrScanner). |
| `admin-neworders-market-confirm-dialog` | Qabul tasdig'i / buyurtmani o'chirish | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | eski |
| `admin-neworders-incoming-sources` | Kiruvchi posilkalar — manba tanlash | sahifa | `/new-orders/incoming` | `src/pages/incoming-orders/SourcePicker.tsx` | eski |
| `admin-neworders-incoming-scan` | Kiruvchi posilkalarni skanerlash | sahifa | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | eski |
| `admin-neworders-incoming-scan-camera` | Kiruvchi posilkalarni skanerlash — kamera | oyna | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | yangi (kodda yo'q) — Kamera rejimi yo'q — faqat USB/klaviatura skaneri. |
| `admin-neworders-branches` | Filial batchlari tabi | sahifa | `/new-orders/branches` | `src/pages/new_orders/branches/index.tsx` | eski |
| `admin-neworders-branch-batches` | Filial batchlari ro'yxati | sahifa | `/new-orders/branches/:branchId` | `src/pages/new_orders/branches/batches.tsx` | eski |
| `admin-neworders-branch-batch-detail` | Filial paketi tafsiloti | sahifa | `/new-orders/branches/:branchId/batches/:batchId` | `src/pages/new_orders/branches/batchDetail.tsx` | eski |
| `admin-neworders-branch-batch-detail-camera` | Filial paketi tafsiloti — kamera | oyna | `/new-orders/branches/:branchId/batches/:batchId` | `src/pages/new_orders/branches/batchDetail.tsx` | yangi (kodda yo'q) — Kamera rejimi yo'q — faqat USB/klaviatura skaneri (useOrderQrScanner). |
| `admin-neworders-cancelled` | Bekor qilinganlar tabi | sahifa | `/new-orders/cancelled` | `src/pages/new_orders/cancelled/index.tsx` | eski |
| `admin-neworders-cancelled-detail` | Bekor qilinganlarni marketga topshirish | sahifa | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | eski |
| `admin-neworders-cancelled-detail-camera` | Bekor qilinganlarni marketga topshirish — kamera | oyna | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | eski |
| `admin-neworders-cancelled-manual-dialog` | QR buzilganini tasdiqlash | oyna | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | eski |
| `admin-neworders-cancelled-scanner-dialog` | Market QR skaneri | oyna | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | eski |
| `admin-neworders-create-manual` | Buyurtma yaratish — Qo'lda | sahifa | `/new-orders/create` | `src/pages/orders/create/index.tsx` | eski |
| `admin-neworders-create-market-picker` | Market tanlash oynasi | oyna | `/new-orders/create` | `src/pages/orders/create/ui/Step1Market.tsx` | eski |
| `admin-neworders-create-ai` | Buyurtma yaratish — AI bilan | sahifa | `/new-orders/create` | `src/pages/orders/create/index.tsx` | eski |
| `admin-neworders-create-ai-confirm-dialog` | AI yaratishni tasdiqlash | oyna | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | eski |
| `admin-mails-today` | Pochta — Bugungi pochtalar | sahifa | `/mails/today` | `src/pages/mails/index.tsx` | eski |
| `admin-mails-return` | Pochta — Qaytarish | sahifa | `/mails/return` | `src/pages/mails/index.tsx` | eski |
| `admin-mails-refused` | Pochta — Rad etilgan | sahifa | `/mails/refused` | `src/pages/mails/index.tsx` | eski |
| `admin-mails-old` | Pochta — Eski pochtalar | sahifa | `/mails/old` | `src/pages/mails/index.tsx` | eski |
| `admin-mails-old-all-batches` | Eski pochtalar — Hamma batchlar | sahifa | `/mails/old` | `src/pages/mails/index.tsx` | eski |
| `admin-mails-detail` | Pochta tafsiloti | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | eski |
| `admin-mails-detail-camera` | Pochta tafsiloti — kamera | oyna | `/mails/:id` | `src/pages/mails/detail/index.tsx` | yangi (kodda yo'q) — Kamera rejimi yo'q — faqat USB/klaviatura skaneri (useOrderQrScanner). |
| `admin-mails-old-detail` | Eski pochta tafsiloti (tarix) | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | eski |
| `admin-mails-refused-detail` | Rad etilgan pochta tafsiloti | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | eski |
| `admin-mails-send-branch-dialog` | Pochtani filialga jo'natish | oyna | `/mails/:id` | `src/pages/mails/detail/ui/SendPostModal.tsx` | eski |
| `admin-batches-new` | Paketlar — Yangi | sahifa | `/batches` | `src/pages/batches/ui/BatchesPage.tsx` | eski |
| `admin-batches-old` | Paketlar — Eski | sahifa | `/batches` | `src/pages/batches/ui/BatchesPage.tsx` | eski |
| `admin-batches-return` | Paketlar — Qaytarilgan | sahifa | `/batches` | `src/pages/batches/ui/BatchesPage.tsx` | eski |
| `admin-batches-detail` | Paket tafsiloti | sahifa | `/batches/:id` | `src/pages/batches/ui/BatchDetailPage.tsx` | eski |
| `admin-returns-list` | Return batchlar | sahifa | `/returns` | `src/pages/returns/index.tsx` | eski |
| `admin-payments-overview` | To'lovlar | sahifa | `/payments` | `src/pages/payments/index.tsx` | eski |
| `admin-payments-to-give-dialog` | Berilishi kerak — market tanlash | oyna | `/payments` | `src/pages/payments/index.tsx` | eski |
| `admin-payments-to-receive-dialog` | Qabul qilinishi kerak — tanlash | oyna | `/payments` | `src/pages/payments/index.tsx` | eski |
| `admin-payments-history-detail-dialog` | To'lov tarixi tafsiloti | oyna | `/payments` | `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | eski |
| `admin-payments-main-cashbox` | Asosiy kassa | sahifa | `/payments/main-cashbox` | `src/pages/payments/components/mainCashbox.tsx` | eski |
| `admin-payments-cashbox-form-dialog` | Kassadan xarajat / Kassani to'ldirish | oyna | `/payments/main-cashbox` | `src/pages/payments/components/CashboxFormPopup.tsx` | eski |
| `admin-payments-shift-dialog` | Smenani yopish | oyna | `/payments/main-cashbox` | `src/pages/payments/components/CloseShiftPopup.tsx` | eski |
| `admin-payments-cash-detail-market` | Market kassasi | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | eski |
| `admin-payments-cash-detail-courier` | Kuryer kassasi | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | eski |
| `admin-payments-cash-detail-branch` | Filial kassasi (HQ qabul) | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | eski |
| `admin-balance-overview` | Balans — Umumiy ko'rinish | sahifa | `/financial-balance` | `src/pages/financial-balance/components/Statistics.tsx` | eski |
| `admin-balance-history` | Balans — Tarix | sahifa | `/financial-balance` | `src/pages/financial-balance/components/HistoryTab.tsx` | eski |
| `admin-balance-analysis` | Balans — Tahlil | sahifa | `/financial-balance` | `src/pages/financial-balance/components/AnalysisTab.tsx` | eski |
| `admin-balance-entry-dialog` | Qo'lda yozuv qo'shish | oyna | `/financial-balance` | `src/pages/financial-balance/components/FinancialEntryModal.tsx` | eski |
| `admin-balance-history-detail-dialog` | Balans yozuvi tafsiloti | oyna | `/financial-balance` | `src/pages/financial-balance/components/FinancialHistoryDetail.tsx` | eski |
| `admin-products-list` | Mahsulotlar ro'yxati | sahifa | `/products` | `src/pages/products/list/index.tsx` | eski |
| `admin-products-market-select-dialog` | Mahsulot uchun market tanlash | oyna | `/products` | `src/pages/products/list/index.tsx` | eski |
| `admin-products-edit-dialog` | Mahsulotni tahrirlash | oyna | `/products` | `src/pages/products/list/index.tsx` | eski |
| `admin-products-delete-dialog` | Mahsulotni o'chirish | oyna | `/products` | `src/pages/products/list/index.tsx` | eski |
| `admin-products-create` | Mahsulot yaratish | sahifa | `/products/create-product/:id` | `src/pages/products/create/index.tsx` | eski |
| `admin-users-list` | Foydalanuvchilar ro'yxati | sahifa | `/all-users` | `src/pages/users/list/UserListPage.tsx` | eski |
| `admin-users-delete-dialog` | Foydalanuvchini o'chirish | oyna | `/all-users` | `src/pages/users/list/UserListPage.tsx` | eski |
| `admin-users-create` | Yangi foydalanuvchi | sahifa | `/all-users/create-user` | `src/pages/users/create/CreateUserPage.tsx` | eski |
| `admin-users-detail` | Foydalanuvchi tafsiloti | sahifa | `/all-users/:id` | `src/pages/users/detail/UserDetailPage.tsx` | eski |
| `admin-users-edit-dialog` | Foydalanuvchini tahrirlash | oyna | `/all-users/:id` | `src/features/user/update-user/ui/UpdateUserModal.tsx` | eski |
| `admin-users-transfer-courier-dialog` | Kuryerni boshqa filialga o'tkazish | oyna | `/all-users/:id` | `src/features/courier-transfer-branch/ui/TransferCourierModal.tsx` | eski |
| `admin-regions-map` | Hududlar xaritasi | sahifa | `/regions` | `src/pages/region/index.tsx` | eski |
| `admin-regions-region-detail-dialog` | Viloyat ma'lumotlari oynasi | oyna | `/regions` | `src/pages/region/ui/UzbekistanRegionMap.tsx` | eski |
| `admin-regions-sato-management` | Tumanlarni o'tkazish | sahifa | `/regions/sato-management` | `src/pages/region/pages/sato-management/index.tsx` | eski |
| `admin-regions-logist-assignment` | Logist biriktirish | sahifa | `/regions/logist-assignment` | `src/pages/region/pages/logist-assignment/index.tsx` | eski |
| `admin-integrations-partners` | Integratsiyalar — Hamkorlar | sahifa | `/integrations/connections` | `src/pages/integrations/ConnectionsPage.tsx` | eski |
| `admin-integrations-external` | Integratsiyalar — Tashqi tizimlar | sahifa | `/integrations/connections` | `src/pages/integrations/ConnectionsPage.tsx` | eski |
| `admin-integrations-marketplace` | Integratsiyalar — Marketplace | sahifa | `/integrations/connections` | `src/pages/integrations/ConnectionsPage.tsx` | eski |
| `admin-integrations-conn-settings` | Ulanish — Sozlamalar | sahifa | `/integrations/connections` | `src/pages/integrations/panels/ConnectionSettings.tsx` | eski |
| `admin-integrations-conn-shipments` | Ulanish — Posilkalar | sahifa | `/integrations/connections` | `src/pages/integrations/panels/ConnectionShipments.tsx` | eski |
| `admin-integrations-conn-log` | Ulanish — Hodisalar | sahifa | `/integrations/connections` | `src/pages/integrations/panels/ConnectionLog.tsx` | eski |
| `admin-integrations-conn-settlement` | Ulanish — Hisob-kitob | sahifa | `/integrations/connections` | `src/pages/integrations/panels/ConnectionSettlement.tsx` | eski |
| `admin-integrations-settlement-pay-dialog` | Tashuvchidan olingan to'lov | oyna | `/integrations/connections` | `src/pages/integrations/panels/ConnectionSettlement.tsx` | eski |
| `admin-integrations-conn-control` | Ulanish — Ish rejimi | sahifa | `/integrations/connections` | `src/pages/integrations/panels/ConnectionControl.tsx` | eski |
| `admin-integrations-conn-security` | Ulanish — Xavfsizlik | sahifa | `/integrations/connections` | `src/pages/integrations/panels/ConnectionSecurity.tsx` | eski |
| `admin-integrations-new-partner-dialog` | Yangi hamkor oynasi | oyna | `/integrations/connections` | `src/pages/integrations/NewPartnerModal.tsx` | eski |
| `admin-integrations-catalog` | Yangi ulanish — katalog | sahifa | `/integrations/new` | `src/pages/integrations/CatalogPage.tsx` | eski |
| `admin-integrations-wizard` | Ulash ustasi | sahifa | `/integrations/new/:typeKey` | `src/pages/integrations/wizard/ConnectWizard.tsx` | eski |
| `admin-integrations-legacy-partners` | Partner API hamkorlari (eski) | sahifa | `/integrations/partners` | `src/pages/partners/index.tsx` | eski |
| `admin-integrations-legacy-sources` | Integratsiyalar manbalari (eski) | sahifa | `/integrations/sources` | `src/pages/new_orders/external_orders/index.tsx` | eski |
| `admin-activity-logs-list` | Faoliyat jurnali | sahifa | `/activity-logs` | `src/pages/activity-logs/index.tsx` | eski |
| `admin-activity-logs-row-expanded` | Jurnal yozuvi ochilgan | sahifa | `/activity-logs` | `src/widgets/activity-log/ui/ActivityLogDetail.tsx` | eski |
| `admin-scan-camera` | Skaner — kamera (umumiy) | sahifa | `/scan` | `src/pages/scan/index.tsx` | eski |
| `admin-scan-result` | Skanerlangan buyurtma | sahifa | `/scan/:token` | `src/pages/scan/detail.tsx` | eski |

### manager — Menejer

64 ta maket · kodda bor: 60 · kodda yo'q: 4

| Maket | Sarlavha | Tur | Route | Asosiy fayl | Holat |
|---|---|---|---|---|---|
| `manager-branch-dashboard-main` | Filial paneli | sahifa | `/branch-dashboard` | `src/pages/branch-dashboard/ui/BranchDashboardPage.tsx` | eski |
| `manager-dispatch-scan` | Biriktirish — skan savati | sahifa | `/dispatch` | `src/pages/dispatch/index.tsx` | eski |
| `manager-dispatch-courier-dialog` | Kuryer tanlash oynasi | oyna | `/dispatch` | `src/pages/dispatch/index.tsx` | eski |
| `manager-dispatch-camera-dialog` | Biriktirish — kamera | oyna | `/dispatch` | `src/pages/dispatch/index.tsx` | eski |
| `manager-orders-list-all` | Buyurtmalar — Hamma buyurtmalar | sahifa | `/orders` | `src/pages/orders/index.tsx` | eski |
| `manager-orders-list-pending` | Buyurtmalar — Kutilayotgan | sahifa | `/orders` | `src/pages/orders/index.tsx` | eski |
| `manager-orders-list-cancelled` | Buyurtmalar — Bekor qilinganlar (HQ'ga yuborish) | sahifa | `/orders` | `src/pages/orders/index.tsx` | eski |
| `manager-orders-sell-dialog` | Sotish oynasi | oyna | `/orders`, `/orders/edit/:orderId` | `src/pages/orders/list/courier/list/SellModal.tsx` | eski |
| `manager-orders-cancel-dialog` | Bekor qilish oynasi | oyna | `/orders`, `/orders/edit/:orderId` | `src/pages/orders/list/courier/list/CancelModal.tsx` | eski |
| `manager-orders-rollback-dialog` | Buyurtmani qaytarish tasdig'i | oyna | `/orders`, `/orders/edit/:orderId` | `src/pages/orders/index.tsx`, `src/pages/new_orders/components/new_orderUpdate.tsx` | eski |
| `manager-orders-detail` | Buyurtma tafsiloti | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | eski |
| `manager-orders-detail-edit-address-dialog` | Manzilni tahrirlash oynasi | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | eski |
| `manager-orders-detail-edit-products-dialog` | Buyurtmani tahrirlash oynasi | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | eski |
| `manager-courier-bulk-main` | Tezkor amal | sahifa | `/courier-bulk` | `src/pages/courier-bulk/index.tsx` | eski |
| `manager-courier-bulk-camera-dialog` | Tezkor amal — kamera | oyna | `/courier-bulk` | `src/pages/courier-bulk/index.tsx` | eski |
| `manager-new-orders-markets` | Qabul va yaratish — Marketlar | sahifa | `/new-orders` | `src/pages/new_orders/markets/index.tsx` | eski |
| `manager-new-orders-market-detail` | Market buyurtmalari — qabul | sahifa | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | eski |
| `manager-new-orders-market-detail-camera` | Market buyurtmalari — qabul — kamera | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | yangi (kodda yo'q) — Kamera rejimi yo'q — faqat USB/klaviatura skaneri (useOrderQrScanner). |
| `manager-new-orders-receive-confirm-dialog` | Qo'lda qabul qilish tasdig'i | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | eski |
| `manager-new-orders-delete-confirm-dialog` | Buyurtmani o'chirish tasdig'i | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | eski |
| `manager-new-orders-create-manual-step1` | Buyurtma yaratish — market tanlash | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/Step1Market.tsx` | eski |
| `manager-new-orders-create-manual-step2` | Buyurtma yaratish — ma'lumotlar | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/Step2Combined.tsx` | eski |
| `manager-new-orders-create-ai` | Buyurtma yaratish — AI bilan | sahifa | `/new-orders/create` | `src/pages/orders/create/index.tsx` | eski |
| `manager-new-orders-create-ai-confirm-dialog` | AI buyurtmalarni tasdiqlash | oyna | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | eski |
| `manager-new-orders-incoming-sources` | Kiruvchi posilkalar — manba tanlash | sahifa | `/new-orders/incoming` | `src/pages/incoming-orders/SourcePicker.tsx` | eski |
| `manager-new-orders-incoming-scan` | Kiruvchi posilkalar — skanerlash | sahifa | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | eski |
| `manager-new-orders-incoming-scan-camera` | Kiruvchi posilkalar — skanerlash — kamera | oyna | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | yangi (kodda yo'q) — Kamera rejimi yo'q — faqat USB/klaviatura skaneri. |
| `manager-mails-today` | Pochta — Bugungi pochtalar | sahifa | `/mails/today` | `src/pages/mails/index.tsx` | eski |
| `manager-mails-return` | Pochta — Qaytarish so'rovlari | sahifa | `/mails/return` | `src/pages/mails/index.tsx` | eski |
| `manager-mails-refused` | Pochta — Rad etilgan pochtalar | sahifa | `/mails/refused` | `src/pages/mails/index.tsx` | eski |
| `manager-mails-old` | Pochta — Eski pochtalar | sahifa | `/mails/old` | `src/pages/mails/index.tsx` | eski |
| `manager-mails-detail-receive` | Pochta tafsiloti — qabul qilish | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | eski |
| `manager-mails-detail-receive-camera` | Pochta tafsiloti — qabul qilish — kamera | oyna | `/mails/:id` | `src/pages/mails/detail/index.tsx` | yangi (kodda yo'q) — Kamera rejimi yo'q — faqat USB/klaviatura skaneri (useOrderQrScanner). |
| `manager-mails-detail-refused-receive` | Rad etilgan pochta — qabul | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | eski |
| `manager-mails-detail-old` | Eski pochta tafsiloti (tarix) | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | eski |
| `manager-batches-new` | Paketlar — Yangi | sahifa | `/batches` | `src/pages/batches/ui/BatchesPage.tsx` | eski |
| `manager-batches-old` | Paketlar — Eski | sahifa | `/batches` | `src/pages/batches/ui/BatchesPage.tsx` | eski |
| `manager-batches-return` | Paketlar — Qaytarilgan | sahifa | `/batches` | `src/pages/batches/ui/BatchesPage.tsx` | eski |
| `manager-batches-detail-send` | Paket tafsiloti — asosiy filialga jo'natish | sahifa | `/batches/:id` | `src/pages/batches/ui/BatchDetailPage.tsx` | eski |
| `manager-batches-detail-send-camera` | Paket tafsiloti — asosiy filialga jo'natish — kamera | oyna | `/batches/:id` | `src/pages/batches/ui/BatchDetailPage.tsx` | yangi (kodda yo'q) — Kamera rejimi yo'q — faqat USB/klaviatura skaneri (useOrderQrScanner). |
| `manager-batches-detail-readonly` | Paket tafsiloti (faqat o'qish) | sahifa | `/batches/:id` | `src/pages/batches/ui/BatchDetailPage.tsx` | eski |
| `manager-returns-list` | Return batchlar | sahifa | `/returns` | `src/pages/returns/index.tsx` | eski |
| `manager-returns-batch-detail` | Qaytarish paketi tafsiloti | sahifa | `/batches/:id` | `src/pages/batches/ui/BatchDetailPage.tsx` | eski |
| `manager-payments-overview` | To'lovlar — umumiy | sahifa | `/payments` | `src/pages/payments/index.tsx` | eski |
| `manager-payments-courier-select-dialog` | Qabul qilish — kuryer tanlash | oyna | `/payments` | `src/pages/payments/index.tsx` | eski |
| `manager-payments-main-cashbox` | Asosiy kassa (filial) | sahifa | `/payments/main-cashbox` | `src/pages/payments/components/mainCashbox.tsx` | eski |
| `manager-payments-cashbox-form-dialog` | Kassadan xarajat / to'ldirish oynasi | oyna | `/payments/main-cashbox` | `src/pages/payments/components/CashboxFormPopup.tsx` | eski |
| `manager-payments-close-shift-dialog` | Smenani yopish oynasi | oyna | `/payments/main-cashbox` | `src/pages/payments/components/CloseShiftPopup.tsx` | eski |
| `manager-payments-cash-detail-branch` | Kassa tafsiloti — HQ'ga o'tkazish | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | eski |
| `manager-payments-cash-detail-courier` | Kassa tafsiloti — kuryerdan qabul | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | eski |
| `manager-payments-history-detail-dialog` | Tranzaksiya tafsiloti | oyna | `/payments` | `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | eski |
| `manager-products-list` | Mahsulotlar ro'yxati | sahifa | `/products` | `src/pages/products/list/index.tsx` | eski |
| `manager-products-market-select-dialog` | Mahsulot uchun market tanlash | oyna | `/products` | `src/pages/products/list/index.tsx` | eski |
| `manager-products-create` | Mahsulot yaratish | sahifa | `/products/create-product/:id` | `src/pages/products/create/index.tsx` | eski |
| `manager-products-edit-dialog` | Mahsulotni tahrirlash | oyna | `/products` | `src/pages/products/list/index.tsx` | eski |
| `manager-products-delete-dialog` | Mahsulotni o'chirish | oyna | `/products` | `src/pages/products/list/index.tsx` | eski |
| `manager-users-list` | Foydalanuvchilar (filial xodimlari) | sahifa | `/all-users` | `src/pages/users/list/UserListPage.tsx` | eski |
| `manager-users-create-courier` | Yangi xodim — kuryer | sahifa | `/all-users/create-user` | `src/pages/users/create/CreateUserPage.tsx` | eski |
| `manager-users-create-hybrid` | Yangi xodim — Aralash filial (rol tanlash) | sahifa | `/all-users/create-user` | `src/pages/users/create/CreateUserPage.tsx` | eski |
| `manager-users-detail` | Xodim tafsiloti | sahifa | `/all-users/:id` | `src/pages/users/detail/UserDetailPage.tsx` | eski |
| `manager-users-edit-dialog` | Xodimni tahrirlash | oyna | `/all-users/:id` | `src/features/user/update-user/ui/UpdateUserModal.tsx` | eski |
| `manager-regions-scoped` | Hudud — tumanlar statistikasi | sahifa | `/regions` | `src/pages/region/index.tsx` | eski |
| `manager-scan-camera` | Skaner — kamera (umumiy) | sahifa | `/scan` | `src/pages/scan/index.tsx` | eski |
| `manager-scan-result` | Skanerlangan buyurtma | sahifa | `/scan/:token` | `src/pages/scan/detail.tsx` | eski |

### registrator — Registrator

41 ta maket · kodda bor: 39 · kodda yo'q: 2

| Maket | Sarlavha | Tur | Route | Asosiy fayl | Holat |
|---|---|---|---|---|---|
| `registrator-dashboard-main` | Dashboard — statistika | sahifa | `/` | `src/pages/dashboard/DashboardPage.tsx` | eski |
| `registrator-dispatch-list` | Biriktirish — skanerlangan buyurtmalar | sahifa | `/dispatch` | `src/pages/dispatch/index.tsx` | eski |
| `registrator-dispatch-empty` | Biriktirish — bo'sh holat | sahifa | `/dispatch` | `src/pages/dispatch/index.tsx` | eski |
| `registrator-dispatch-camera-scanner-dialog` | Biriktirish — kamera skaneri | oyna | `/dispatch` | `src/pages/dispatch/index.tsx` | eski |
| `registrator-dispatch-courier-select-dialog` | Biriktirish — kuryer tanlash | oyna | `/dispatch` | `src/pages/dispatch/index.tsx` | eski |
| `registrator-orders-list` | Buyurtmalar ro'yxati | sahifa | `/orders` | `src/pages/orders/index.tsx` | eski |
| `registrator-orders-filters-mobile` | Buyurtmalar — filtr paneli (telefon) | oyna · faqat telefon | `/orders` | `src/pages/orders/list/OrderFilters.tsx` | eski |
| `registrator-orders-detail` | Buyurtma tafsiloti | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | eski |
| `registrator-orders-detail-edit-order-dialog` | Buyurtmani tahrirlash oynasi | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | eski |
| `registrator-orders-detail-edit-address-dialog` | Manzilni tahrirlash oynasi | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | eski |
| `registrator-new-orders-markets` | Qabul va yaratish — Marketlar | sahifa | `/new-orders` | `src/pages/new_orders/markets/index.tsx` | eski |
| `registrator-new-orders-market-detail` | Market buyurtmalari — qabul | sahifa | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | eski |
| `registrator-new-orders-market-detail-camera` | Market buyurtmalari — qabul — kamera | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | yangi (kodda yo'q) — Kamera rejimi yo'q — faqat USB/klaviatura skaneri (useOrderQrScanner). |
| `registrator-new-orders-market-detail-receive-dialog` | Qabul qilish tasdig'i | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | eski |
| `registrator-new-orders-market-detail-delete-dialog` | Buyurtmani o'chirish tasdig'i | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | eski |
| `registrator-new-orders-market-order-edit` | Market buyurtmasini tahrirlash | sahifa | `/new-orders/:marketId/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | eski |
| `registrator-new-orders-cancelled` | Bekor qilinganlar — marketlar (HQ) | sahifa | `/new-orders/cancelled` | `src/pages/new_orders/cancelled/index.tsx` | eski |
| `registrator-new-orders-cancelled-detail` | Bekor qilinganlarni marketga topshirish (HQ) | sahifa | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | eski |
| `registrator-new-orders-cancelled-manual-dialog` | QR buzilganini tasdiqlash (HQ) | oyna | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | eski |
| `registrator-new-orders-cancelled-scanner-dialog` | Market QR skanerlash (HQ) | oyna | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | eski |
| `registrator-new-orders-create-step1` | Buyurtma yaratish — market tanlash | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/Step1Market.tsx` | eski |
| `registrator-new-orders-create-market-picker-dialog` | Buyurtma yaratish — market tanlash oynasi | oyna | `/new-orders/create` | `src/pages/orders/create/ui/Step1Market.tsx` | eski |
| `registrator-new-orders-create-step2` | Buyurtma yaratish — qo'lda forma | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/Step2Combined.tsx` | eski |
| `registrator-new-orders-create-ai` | Buyurtma yaratish — AI rejimi | sahifa | `/new-orders/create` | `src/pages/orders/create/index.tsx` | eski |
| `registrator-new-orders-create-ai-confirm-dialog` | AI buyurtmalarni tasdiqlash | oyna | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | eski |
| `registrator-mails-today` | Pochta — Bugungi pochtalar | sahifa | `/mails/today` | `src/pages/mails/index.tsx` | eski |
| `registrator-mails-return` | Pochta — Qaytarish | sahifa | `/mails/return` | `src/pages/mails/index.tsx` | eski |
| `registrator-mails-refused` | Pochta — Rad etilgan pochtalar | sahifa | `/mails/refused` | `src/pages/mails/index.tsx` | eski |
| `registrator-mails-old` | Pochta — Eski pochtalar | sahifa | `/mails/old` | `src/pages/mails/index.tsx` | eski |
| `registrator-mails-detail` | Pochta tafsiloti — bugungi | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | eski |
| `registrator-mails-detail-camera` | Pochta tafsiloti — bugungi — kamera | oyna | `/mails/:id` | `src/pages/mails/detail/index.tsx` | yangi (kodda yo'q) — Kamera rejimi yo'q — faqat USB/klaviatura skaneri (useOrderQrScanner). |
| `registrator-mails-detail-send-dialog` | Pochtani filialga jo'natish (HQ) | oyna | `/mails/:id` | `src/pages/mails/detail/ui/SendPostModal.tsx` | eski |
| `registrator-mails-detail-refused` | Pochta tafsiloti — rad etilgan | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | eski |
| `registrator-mails-detail-old` | Pochta tafsiloti — tarix | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | eski |
| `registrator-products-list` | Mahsulotlar ro'yxati | sahifa | `/products` | `src/pages/products/list/index.tsx` | eski |
| `registrator-products-market-select-dialog` | Mahsulot uchun market tanlash | oyna | `/products` | `src/pages/products/list/index.tsx` | eski |
| `registrator-products-edit-dialog` | Mahsulotni tahrirlash | oyna | `/products` | `src/pages/products/list/index.tsx` | eski |
| `registrator-products-delete-dialog` | Mahsulotni o'chirish | oyna | `/products` | `src/pages/products/list/index.tsx` | eski |
| `registrator-products-create` | Mahsulot yaratish | sahifa | `/products/create-product/:id` | `src/pages/products/create/index.tsx` | eski |
| `registrator-scan-camera` | Skaner — kamera (umumiy) | sahifa | `/scan` | `src/pages/scan/index.tsx` | eski |
| `registrator-scan-result` | Skanerlangan buyurtma | sahifa | `/scan/:token` | `src/pages/scan/detail.tsx` | eski |

### market — Market

19 ta maket · kodda bor: 19 · kodda yo'q: 0

| Maket | Sarlavha | Tur | Route | Asosiy fayl | Holat |
|---|---|---|---|---|---|
| `market-dashboard-home` | Mening dashboardim | sahifa | `/` | `src/pages/dashboard/MarketDashboardPage.tsx` | eski |
| `market-dashboard-extra-cost-approvals` | Dashboard · Xarajat tasdiqlari | sahifa | `/` | `src/pages/dashboard/MarketDashboardPage.tsx` | eski |
| `market-orders-list` | Buyurtmalar ro'yxati | sahifa | `/orders` | `src/pages/orders/index.tsx` | eski |
| `market-orders-detail` | Buyurtma tafsilotlari | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | eski |
| `market-new-orders-list` | Yangi buyurtmalar | sahifa | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | eski |
| `market-new-orders-delete-dialog` | Buyurtmani o'chirish | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | eski |
| `market-new-orders-edit` | Yangi buyurtma tafsiloti | sahifa | `/new-orders/:marketId/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | eski |
| `market-new-orders-create-manual` | Buyurtma yaratish · Qo'lda | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/Step2Combined.tsx` | eski |
| `market-new-orders-create-ai-input` | Buyurtma yaratish · AI kiritish | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiInputPanel.tsx` | eski |
| `market-new-orders-create-ai-preview` | Buyurtma yaratish · AI natijalari | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiPreviewCard.tsx` | eski |
| `market-new-orders-create-ai-confirm-dialog` | AI · Yaratishni tasdiqlash | oyna | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | eski |
| `market-new-orders-cancelled` | Bekor qilinganlar | sahifa | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | eski |
| `market-new-orders-cancelled-qr-dialog` | Bekor qilinganlar · QR kod | oyna | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | eski |
| `market-products-list` | Mahsulotlar | sahifa | `/products` | `src/pages/products/list/index.tsx` | eski |
| `market-products-edit-dialog` | Mahsulotni tahrirlash | oyna | `/products` | `src/pages/products/list/index.tsx` | eski |
| `market-products-delete-dialog` | Mahsulotni o'chirish | oyna | `/products` | `src/pages/products/list/index.tsx` | eski |
| `market-products-create` | Mahsulot yaratish | sahifa | `/products/create-product/:id` | `src/pages/products/create/index.tsx` | eski |
| `market-cashbox-my` | Market kassasi | sahifa | `/cash-box` | `src/pages/payments/components/MyCashboxPage.tsx` | eski |
| `market-cashbox-history-detail-dialog` | Tranzaksiya tafsiloti | oyna | `/cash-box` | `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | eski |

### courier — Kuryer

47 ta maket · kodda bor: 42 · kodda yo'q: 5

| Maket | Sarlavha | Tur | Route | Asosiy fayl | Holat |
|---|---|---|---|---|---|
| `courier-dashboard-home` | Bosh sahifa — kuryer statistikasi | sahifa | `/` | `src/pages/dashboard/DashboardPage.tsx` | eski |
| `courier-dashboard-mobile-menu` | Menyu ochiq — yon panel / pastki varaq | oyna · faqat planshet + telefon | `(qobiq)` | `src/widgets/Sidebar/ui/MobileMenu.tsx` | v2 |
| `courier-dashboard-mobile-search` | Global qidiruv (telefon) | oyna · faqat telefon | `(qobiq)` | `src/widgets/header/ui/SearchScreen.tsx` | v2 |
| `courier-orders-pending` | Buyurtmalar — Kutilayotganlar | sahifa | `/orders` | `src/pages/orders/list/courier/index.tsx` | eski |
| `courier-orders-tab-switcher-open` | Buyurtmalar — tab almashtirildi, yuklanmoqda | sahifa · faqat telefon | `/orders` | `src/pages/orders/list/courier/list/tabs.tsx` | eski |
| `courier-orders-all` | Buyurtmalar — Hammasi | sahifa | `/orders` | `src/pages/orders/list/courier/index.tsx` | eski |
| `courier-orders-cancelled` | Buyurtmalar — Bekor qilinganlar | sahifa | `/orders` | `src/pages/orders/list/courier/index.tsx` | eski |
| `courier-orders-sell-dialog` | Sotish oynasi | oyna | `/orders` | `src/pages/orders/list/courier/list/SellModal.tsx` | eski |
| `courier-orders-sell-extra-cost-dialog` | Sotish — qo'shimcha xarajat bilan | oyna | `/orders` | `src/pages/orders/list/courier/list/SellModal.tsx` | eski |
| `courier-orders-sell-partial-dialog` | Qisman sotish oynasi | oyna | `/orders` | `src/pages/orders/list/courier/list/SellModal.tsx` | eski |
| `courier-orders-action-approval-pending` | Market tasdig'i kutilmoqda | oyna | `/orders` | `src/pages/orders/list/courier/list/SellModal.tsx` | eski |
| `courier-orders-cancel-dialog` | Bekor qilish oynasi | oyna | `/orders` | `src/pages/orders/list/courier/list/CancelModal.tsx` | eski |
| `courier-orders-rollback-confirm` | Buyurtmani qaytarish tasdig'i | oyna | `/orders` | `src/pages/orders/list/courier/index.tsx` | eski |
| `courier-orders-detail` | Buyurtma tafsilotlari | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | eski |
| `courier-courier-bulk-main` | Tezkor amal — kunni yakunlash | sahifa | `/courier-bulk` | `src/pages/courier-bulk/index.tsx` | eski |
| `courier-courier-bulk-scanner-camera` | Tezkor amal — kamera skaneri | oyna | `/courier-bulk` | `src/pages/courier-bulk/index.tsx` | eski |
| `courier-courier-bulk-scanner-camera-list` | Tezkor amal — kamera, skanerlanganlar ro'yxati | oyna · faqat telefon | `/courier-bulk` | `src/pages/courier-bulk/index.tsx` | yangi (kodda yo'q) — Kamera oynasida «skanerlanganlar ro'yxati» varag'i yo'q (ScannerCameraModal faqat kamera). |
| `courier-courier-bulk-confirm-dialog` | Kunni yakunlash — tasdiqlash oynasi | oyna | `/courier-bulk` | `src/pages/courier-bulk/index.tsx` | yangi (kodda yo'q) — «Kunni yakunlash» oldidan tasdiqlash oynasi yo'q (ega tasdiqlagan UX qo'shimchasi). |
| `courier-mails-today` | Pochta — Bugungi | sahifa | `/mails/today` | `src/pages/mails/index.tsx` | eski |
| `courier-mails-tab-switcher-open` | Pochta — tab tanlash ochiq | sahifa · faqat telefon | `/mails/today` | `src/pages/mails/index.tsx` | eski |
| `courier-mails-refused` | Pochta — Rad etilgan | sahifa | `/mails/refused` | `src/pages/mails/index.tsx` | eski |
| `courier-mails-old` | Pochta — Eski | sahifa | `/mails/old` | `src/pages/mails/index.tsx` | eski |
| `courier-mails-detail-receive` | Pochta tafsiloti — qabul qilish | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | eski |
| `courier-mails-detail-receive-camera` | Pochta tafsiloti — qabul qilish — kamera | oyna | `/mails/:id` | `src/pages/mails/detail/index.tsx` | yangi (kodda yo'q) — Kamera rejimi yo'q — faqat USB/klaviatura skaneri (useOrderQrScanner). |
| `courier-mails-detail-refused` | Pochta tafsiloti — rad etilgan (faqat o'qish) | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | eski |
| `courier-mails-detail-old` | Pochta tafsiloti — eski (tarix) | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | eski |
| `courier-mails-detail-print-menu` | Chop etish menyusi | oyna | `/mails/:id` | `src/shared/components/PrintModeSelect.tsx` | eski |
| `courier-cashbox-my-all` | Kassa — Barcha tarix | sahifa | `/cash-box` | `src/pages/payments/components/MyCashboxPage.tsx` | eski |
| `courier-cashbox-my-transfers` | Kassa — Oldi-berdi | sahifa | `/cash-box` | `src/pages/payments/components/MyCashboxPage.tsx` | eski |
| `courier-cashbox-history-detail` | Tranzaksiya tafsiloti | oyna | `/cash-box` | `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | eski |
| `courier-regions-scoped` | Hududlar — o'z viloyatim | sahifa | `/regions` | `src/pages/region/index.tsx` | eski |
| `courier-scan-camera` | Skaner — kamera | sahifa | `/scan` | `src/pages/scan/index.tsx` | eski |
| `courier-scan-order-detail` | Skanerlangan buyurtma — O'zimga olish | sahifa | `/scan/:token` | `src/pages/scan/detail.tsx` | eski |
| `courier-scan-package-detail` | Skanerlangan paket | sahifa | `/scan/:token` | `src/pages/scan/ui/ScanPackageDetail.tsx` | eski |
| `courier-scan-post-detail` | Skanerlangan pochta | sahifa | `/scan/:token` | `src/pages/scan/ui/ScanPostDetail.tsx` | eski |
| `courier-scan-not-found` | Skaner — topilmadi | sahifa | `/scan/:token` | `src/pages/scan/detail.tsx` | eski |
| `courier-scan-starting` | Skaner — kamera ishga tushmoqda | sahifa | `/scan` | `src/pages/scan/index.tsx` | eski |
| `courier-scan-permission-denied` | Skaner — kameraga ruxsat yo'q | sahifa | `/scan` | `src/pages/scan/index.tsx` | eski |
| `courier-scan-active` | Skaner — skanerlanmoqda | sahifa | `/scan` | `src/pages/scan/index.tsx` | eski |
| `courier-scan-success-flash` | Skaner — muvaffaqiyatli o'qildi | sahifa | `/scan` | `src/pages/scan/index.tsx` | eski |
| `courier-scan-other-courier` | Skaner — boshqa kuryerga biriktirilgan | sahifa | `/scan/:token` | `src/pages/scan/detail.tsx` | qisman — Alohida holat yo'q — backend xato matni umumiy xato blokida chiqadi (scan/detail.tsx). |
| `courier-scan-invalid` | Skaner — noto'g'ri QR | sahifa | `/scan` | `src/pages/scan/index.tsx` | eski |
| `courier-scan-too-fast` | Skaner — juda tez | sahifa | `/scan` | `src/pages/scan/index.tsx` | eski |
| `courier-scan-offline` | Skaner — internet yo'q (navbat) | sahifa | `/scan` | `src/pages/scan/index.tsx` | yangi (kodda yo'q) — Internet yo'qda skanlarni navbatga qo'yish yo'q. |
| `courier-scan-manual-entry` | Skaner — kodni qo'lda kiritish | sahifa | `/scan` | `src/pages/scan/index.tsx` | yangi (kodda yo'q) — Kodni qo'lda kiritish yo'q. |
| `courier-inbox-list` | Bildirishnomalar | sahifa | `/inbox` | `src/pages/notifications/ui/NotificationInboxPage.tsx` | eski |
| `courier-inbox-push-explain-dialog` | Bildirishnomalarni yoqish oynasi | oyna | `/inbox` | `src/features/push-notifications/ui/PushPermissionButton.tsx` | eski |

### umumiy ekranlar (common — barcha rollar)

12 ta maket · kodda bor: 12 · kodda yo'q: 0

| Maket | Sarlavha | Tur | Route | Asosiy fayl | Holat |
|---|---|---|---|---|---|
| `common-login` | Tizimga kirish | sahifa | `/login` | `src/features/auth/index.tsx` | eski |
| `common-login-error` | Tizimga kirish — xato holati | sahifa | `/login` | `src/features/auth/index.tsx` | eski |
| `common-session-expired` | Sessiya tugadi | sahifa | `/login` | `src/features/auth/index.tsx` | qisman — Alohida ekran yo'q — SessionExpiryCountdown taymeri, keyin /login ga qaytarish. |
| `common-settings-appearance` | Sozlamalar — Ko'rinish | sahifa | `/settings` | `src/pages/settings/ui/SettingsPage.tsx` | eski |
| `common-settings-dashboard` | Sozlamalar — Bosh sahifa bloklari | sahifa | `/settings` | `src/pages/settings/ui/SettingsPage.tsx` | eski |
| `common-settings-interface` | Sozlamalar — Interfeys | sahifa | `/settings` | `src/pages/settings/ui/SettingsPage.tsx` | eski |
| `common-settings-scanner` | Sozlamalar — Skaner (kamera va ovoz) | sahifa | `/settings` | `src/pages/settings/ui/SettingsPage.tsx` | qisman — Alohida tab yo'q — skaner ovozlari hozir «Interfeys» tabida. |
| `common-settings-notifications` | Sozlamalar — Bildirishnomalar | sahifa | `/settings` | `src/pages/settings/ui/SettingsPage.tsx` | eski |
| `common-profile` | Profil | sahifa | `/profile` | `src/pages/profile/ui/ProfilePage.tsx` | eski |
| `common-profile-password-dialog` | Profil — parolni o'zgartirish | oyna | `/profile` | `src/features/user/update-user/ui/UpdateUserModal.tsx` | qisman — Alohida «Parolni o'zgartirish» oynasi (yangi parol + takrorlash, saqlangach chiqish) yo'q — parol umumiy tahrirlash oynasida (UpdateUserModal). |
| `common-inbox` | Bildirishnomalar qutisi | sahifa | `/inbox` | `src/pages/notifications/ui/NotificationInboxPage.tsx` | eski |
| `common-bell-dropdown` | Qo'ng'iroqcha ochiq (so'nggi bildirishnomalar) | oyna | `(qobiq)` | `src/widgets/header/ui/NotificationsMenu.tsx` | v2 |

## 5. Dizayn tizimi taxtalari

Sahifa emas — qoidalar va komponent holatlari. Har UI ishida tegishli taxtani ko'ring (`npm run design:shot -- <taxta>`).

| Taxta | Sarlavha | Nimani belgilaydi | Kodda | Qayerda qo'llanadi |
|---|---|---|---|---|
| `Main` | Dizayn tizimi | Tamoyillar (rang = ma'no, bitta asosiy amal, faqat token), rang tokenlari (sirt, chiziq, matn, brend, amal, holat), tipografiya, 4px oraliq, radius, tugmalar, maydonlar, holat belgilari (buyurtma, yetkazish, foydalanuvchi), tab/segment/chip, statistika va jadval, xabar bloklari, tasdiqlash oynasi, bo'sh holat, format standarti. | src/index.css (@theme), src/shared/config/themeTokens.ts, src/shared/lib/formatMoney.ts, docs/DESIGN_SYSTEM.md; 1-bosqich primitivlari (Button, Badge/StatusBadge, Card/StatCard, PageHeader, Tabs) | barcha sahifalar |
| `tizim-icons` | Ikonkalar katalogi | lucide ikonkalar katalogi: 12 guruh, o'lchamlar (16/18/20/22), rang va tugmadagi ikonka, eski sinonimlarni almashtirish jadvali. | design/icon-registry.json, lucide-react | barcha sahifalar |
| `tizim-responsive` | Moslashuvchanlik — telefon, planshet, desktop | Breakpointlar (≥1024 · 768–1023 · <768), bitta sahifa uch kenglikda, dialog → pastdan oyna, yon/suriluvchi/pastki menyu, 70px yorliq qoidasi, yashirish sinflari, jadval o'rami, ≥44px bosish maydoni, asosiy amal pastda. | src/widgets/Sidebar/ui/{Sidebar,BottomNav,MobileMenu}.tsx, src/widgets/layout/dashboardLayout.tsx, docs/DESIGN_SYSTEM.md §6 | `(qobiq)` |
| `tizim-scanner` | Kamera skaner — telefon kamerasi bilan skanerlash | Kamera va USB skaner qachon, kirish nuqtalari (pastki menyu «Skaner», yuqori panel «Skanerlash»), kamera anatomiyasi, barcha holatlar (ruxsat, ishga tushmoqda, tayyor, topildi, takroriy, topilmadi, noto'g'ri QR, boshqa kuryerniki, juda tez, kam yorug'lik, chiroq, oflayn navbat, kamera band, qo'lda kiritish), uzluksiz skanerlash (hisoblagich, ro'yxat, tugatish), desktop veb-kamera + USB. | src/pages/scan/*, src/shared/components/ScannerCameraModal.tsx, src/shared/lib/{useCameraQrScanner,useKeyboardScanner,useOrderQrScanner}.ts, src/pages/scan/lib/scanShared.ts | `/new-orders/incoming/:marketId`, `/new-orders/branches/:branchId/batches/:batchId`, `/new-orders/cancelled/:marketId`, `/new-orders/:marketId`, `/mails/:id`, `/batches/:id`, `/dispatch`, `/courier-bulk`, `/scan`, `/scan/:token` |
| `tizim-charts` | Grafiklar — statistika va tahlil | Qaysi grafik qachon, kategorial palitra (chart-1…8, kunduzgi/tungi), ketma-ket va ikki qutbli shkalalar, holat ranglari, grafik anatomiyasi, galereya (spidometr, donut, KPI, chiziq, ustunlar, reyting, issiqlik xaritasi, xarita, sharshara, voronka, sparkline), holatlar (yuklanmoqda, bo'sh, xato), «Grafik \| Jadval» egizagi, telefon. | CHART_PALETTE (src/shared/config/themeTokens.ts), src/widgets/dashboard-*/*, src/widgets/financial-analysis/*, src/pages/region/ui/UzbekistanRegionMap.tsx, docs/DESIGN_SYSTEM.md §3 | `/`, `/branch-dashboard`, `/financial-balance`, `/regions` |
| `tizim-states-buttons` | Holatlar — tugmalar va havolalar | Tugma va havolalar: 12 tur × 6 holat, o'lchamlar (32/40/48), tugmalar guruhi, forma/oyna oxiri, sahifa sarlavhasi, xavfli juftlik, telefon pastki paneli, qilinmaydigan narsalar. | src/shared/components/button.tsx (1-bosqich: Button, IconButton) | barcha sahifalar |
| `tizim-states-forms` | Holatlar — forma elementlari | Forma elementlari: matn maydoni holatlari, qidiruv, telefon, son, ko'p qatorli matn, tanlash ro'yxati (yopiq/ochiq/ko'p tanlov), sana oralig'i, katak/radio/kalit/tanlov kartasi, fayl yuklash, forma xatolari xulosasi. | src/shared/ui/{Select,SearchableSelect,PhoneInput,DateRangePicker,Filter*,Toggle}.tsx, antd mavzusi (src/app/providers/theme) — 3-bosqich | barcha sahifalar |
| `tizim-states-navigation` | Holatlar — navigatsiya | Yon menyu (248/72px) va band holatlari, yuqori panel, qidiruv holatlari, tablar/segment/filtr chiplari, sahifalash, «orqaga» havolasi, «…» menyusi, maslahat, popover, telefon navigatsiyasi. | src/widgets/Sidebar/*, src/widgets/header/*, src/shared/components/pagination, src/shared/ui/BackButton.tsx | `(qobiq)` |
| `tizim-states-data` | Holatlar — jadval, ro'yxat, kartalar | Jadval: ustun sarlavhasi va saralash, qator holatlari va ommaviy tanlash, qator menyusi, ochiladigan qator, katak qoidalari va nusxa olish, telefon ro'yxat kartalari, ko'rsatkich kartalari, holat belgilarining to'liq to'plami (buyurtma, yetkazish, foydalanuvchi, to'lov, integratsiya, jurnal), sonlar. | src/shared/components/Table, src/shared/ui/{StatusBadge,MetricCard,TableSkeleton}.tsx | `/orders`, `/activity-logs` |
| `tizim-loading` | Yuklanish holatlari | Kutish vaqti bo'yicha qoida (hech narsa → yuqori chiziq → skelet → sekin izohi → xato va qayta urinish), sahifa skeletlari (ro'yxat, hisoblagich, tafsilot, bosh sahifa), tugma yuklanishi, fayl yuklash, tanlov ichida spinner, «ko'proq yuklash», fon yangilanishi, telefonda tortib yangilash. | src/shared/ui/{PageLoader,Loader,TableSkeleton,QueryErrorState,DeferredMount}.tsx, MetricCardSkeleton | barcha sahifalar |
| `tizim-feedback` | Bildirishnoma va ogohlantirishlar | Qalqib chiquvchi xabarlar (4 ton, amal bilan, qayta urinish; desktop pastki o'ngda ≤3, telefonda tepada bittadan), xabar bloklari, sahifa bannerlari (internet, sessiya), forma xatolari xulosasi, tasdiqlash oynalari (o'chirish, pul o'tkazish, nofaol qilish, push ruxsati), amal natijasi (to'liq/qisman), skaner signali. | src/app/providers/notification/NotificationProvider.tsx, src/shared/components/popupConfirm.tsx, src/auth/SessionExpiryCountdown.tsx, src/shared/components/ScanFeedbackOverlay.tsx | barcha sahifalar |
| `tizim-errors` | Xato va bo'sh holatlar | Sahifa xatolari (404, 403, 500, ilova xatosi) va ro'yxat/karta ichidagi holatlar (yuklanmoqda, bo'sh, natija yo'q, yuklanmadi, internet yo'q, ruxsat yo'q, bo'lim xatosi), xato xabarlari. | src/shared/ui/{NotFound,Forbidden,ServerError,ErrorBoundaryPage,EmptyState,QueryErrorState,InlineErrorBoundary}.tsx, src/shared/ui/error-page/ | `/403`, `/404`, `/500`, `/runtime-error`, `/*` |
| `tizim-motion` | Harakat, fokus va kirish qulayligi | Davomiylik shkalasi, egri chiziqlar, ochilish kadrlari (oyna, pastki oyna, xabar), harakatni kamaytirish, fokus halqasi, klaviatura tartibi, bosish maydoni, kontrast juftliklari, z-index shkalasi. | src/index.css (:focus-visible, animatsiyalar), docs/DESIGN_SYSTEM.md §9 | barcha sahifalar |

## 6. Fayl → route

Tegayotgan fayl qaysi route(lar)ga tegishli — o'sha route'ning maketlarini 2-bo'limdan oling.

| Fayl | Route(lar) |
|---|---|
| `src/app/lib/routes.tsx` | `/`, `/new-orders/cancelled/:marketId`, `/new-orders/:marketId`, `/new-orders/:marketId/edit/:orderId` |
| `src/auth/SessionExpiryCountdown.tsx` | `/login` |
| `src/auth/loginNotice.ts` | `/login` |
| `src/entities/orders/ui/ExtraCostApproval.tsx` | `/orders` |
| `src/features/auth/index.tsx` | `/login` |
| `src/features/auth/ui/LoginForm.tsx` | `/login` |
| `src/features/branch-add-employee/ui/AddEmployeeModal.tsx` | `/branches/:id` |
| `src/features/branch-create/ui/BranchFormModal.tsx` | `/branches` |
| `src/features/courier-transfer-branch/ui/TransferCourierButton.tsx` | `/all-users/:id` |
| `src/features/courier-transfer-branch/ui/TransferCourierModal.tsx` | `/all-users/:id` |
| `src/features/notification-create/ui/NotificationFormModal.tsx` | `/notifications` |
| `src/features/notification-delete/ui/DeleteNotificationButton.tsx` | `/notifications` |
| `src/features/notification-dispatch/ui/NotificationDispatchForm.tsx` | `/notifications/send` |
| `src/features/order-return/ui/InitiateReturnModal.tsx` | `/orders/edit/:orderId` |
| `src/features/order-return/ui/MarkReturnedModal.tsx` | `/orders/edit/:orderId` |
| `src/features/push-notifications/ui/PushPermissionButton.tsx` | `/settings`, `/inbox` |
| `src/features/user/create-user/ui/CreateUserForm.tsx` | `/all-users/create-user` |
| `src/features/user/create-user/ui/RoleSelector.tsx` | `/all-users/create-user` |
| `src/features/user/update-user/ui/UpdateUserModal.tsx` | `/all-users/:id`, `/profile` |
| `src/pages/activity-logs/index.tsx` | `/activity-logs` |
| `src/pages/batches/lib/batchFormat.ts` | `/batches` |
| `src/pages/batches/lib/batchOrderMailAdapter.ts` | `/batches/:id` |
| `src/pages/batches/ui/BatchDetailPage.tsx` | `/batches/:id` |
| `src/pages/batches/ui/BatchPrintSheet.tsx` | `/batches/:id` |
| `src/pages/batches/ui/BatchQrCode.tsx` | `/batches/:id` |
| `src/pages/batches/ui/BatchesPage.tsx` | `/batches` |
| `src/pages/branch-dashboard/ui/BranchDashboardCards.tsx` | `/branch-dashboard` |
| `src/pages/branch-dashboard/ui/BranchDashboardPage.tsx` | `/branch-dashboard` |
| `src/pages/branch-dashboard/ui/branchDashboardAdapter.ts` | `/branch-dashboard` |
| `src/pages/branch-ops/index.tsx` | `/branch-ops` |
| `src/pages/branches/ui/BranchDetailPage.tsx` | `/branches/:id` |
| `src/pages/branches/ui/BranchesPage.tsx` | `/branches` |
| `src/pages/courier-bulk/index.tsx` | `/courier-bulk` |
| `src/pages/courier-bulk/model/courierBulk.ts` | `/courier-bulk` |
| `src/pages/dashboard/DashboardPage.tsx` | `/` |
| `src/pages/dashboard/MarketDashboardPage.tsx` | `/` |
| `src/pages/dispatch/index.tsx` | `/dispatch` |
| `src/pages/finance-operators/index.tsx` | `/finance-operators` |
| `src/pages/financial-balance/components/AnalysisTab.tsx` | `/financial-balance` |
| `src/pages/financial-balance/components/FinancialEntryModal.tsx` | `/financial-balance` |
| `src/pages/financial-balance/components/FinancialHistoryDetail.tsx` | `/financial-balance` |
| `src/pages/financial-balance/components/HistoryTab.tsx` | `/financial-balance` |
| `src/pages/financial-balance/components/Statistics.tsx` | `/financial-balance` |
| `src/pages/financial-balance/index.tsx` | `/financial-balance` |
| `src/pages/identity-ops/index.tsx` | `/identity-ops` |
| `src/pages/incoming-orders/SourcePicker.tsx` | `/new-orders/incoming` |
| `src/pages/incoming-orders/index.tsx` | `/new-orders/incoming/:marketId` |
| `src/pages/incoming-orders/lib.ts` | `/new-orders/incoming`, `/new-orders/incoming/:marketId` |
| `src/pages/integrations-ops/index.tsx` | `/integrations-ops` |
| `src/pages/integrations/CatalogPage.tsx` | `/integrations/new` |
| `src/pages/integrations/ConnectionFields.tsx` | `/integrations/new/:typeKey` |
| `src/pages/integrations/ConnectionSubNav.tsx` | `/integrations/connections` |
| `src/pages/integrations/ConnectionsPage.tsx` | `/integrations/connections` |
| `src/pages/integrations/FilterPills.tsx` | `/integrations/connections` |
| `src/pages/integrations/NewPartnerModal.tsx` | `/integrations/connections` |
| `src/pages/integrations/index.tsx` | `/integrations/connections` |
| `src/pages/integrations/panels/ConnectionControl.tsx` | `/integrations/connections` |
| `src/pages/integrations/panels/ConnectionLog.tsx` | `/integrations/connections` |
| `src/pages/integrations/panels/ConnectionOverview.tsx` | `/integrations/connections` |
| `src/pages/integrations/panels/ConnectionSecurity.tsx` | `/integrations/connections` |
| `src/pages/integrations/panels/ConnectionSettings.tsx` | `/integrations/connections` |
| `src/pages/integrations/panels/ConnectionSettlement.tsx` | `/integrations/connections` |
| `src/pages/integrations/panels/ConnectionShipments.tsx` | `/integrations/connections` |
| `src/pages/integrations/ui.ts` | `/integrations/connections` |
| `src/pages/integrations/wizard/ConnectWizard.tsx` | `/integrations/new/:typeKey` |
| `src/pages/integrations/wizard/steps.ts` | `/integrations/new/:typeKey` |
| `src/pages/investors-ops/index.tsx` | `/investors-ops` |
| `src/pages/logistics-ops/index.tsx` | `/logistics-ops` |
| `src/pages/logistics-ops/lib/returnRequestRows.ts` | `/logistics-ops` |
| `src/pages/logs/index.tsx` | `/logs` |
| `src/pages/mails/components/MailGridCard.tsx` | `/mails/today` |
| `src/pages/mails/components/MailSummaryStats.tsx` | `/mails/today` |
| `src/pages/mails/components/lib/exportOldMailsToExcel.ts` | `/mails/old` |
| `src/pages/mails/components/lib/regionFilterOptions.ts` | `/mails/old` |
| `src/pages/mails/components/oldMails.tsx` | `/mails/old` |
| `src/pages/mails/components/refusedMails.tsx` | `/mails/refused` |
| `src/pages/mails/components/returnMails.tsx` | `/mails/return` |
| `src/pages/mails/components/todaysMails.tsx` | `/mails/today` |
| `src/pages/mails/detail/index.tsx` | `/mails/:id` |
| `src/pages/mails/detail/lib/printMode.ts` | `/mails/:id` |
| `src/pages/mails/detail/model/useMailDetailState.ts` | `/mails/:id` |
| `src/pages/mails/detail/ui/MailDetailHeader.tsx` | `/mails/:id` |
| `src/pages/mails/detail/ui/MailStatCards.tsx` | `/mails/:id` |
| `src/pages/mails/detail/ui/OrderRow.tsx` | `/mails/:id` |
| `src/pages/mails/detail/ui/OrdersTable.tsx` | `/mails/:id` |
| `src/pages/mails/detail/ui/PrintOnlyOrders.tsx` | `/mails/:id` |
| `src/pages/mails/detail/ui/SendButton.tsx` | `/mails/:id` |
| `src/pages/mails/detail/ui/SendPostModal.tsx` | `/mails/:id` |
| `src/pages/mails/index.tsx` | `/mails`, `/mails/today`, `/mails/return`, `/mails/refused`, `/mails/old` |
| `src/pages/mails/lib/navigation.ts` | `/mails` |
| `src/pages/market-operators/index.tsx` | `/market-operators` |
| `src/pages/new_orders/branches/batchDetail.tsx` | `/new-orders/branches/:branchId/batches/:batchId` |
| `src/pages/new_orders/branches/batches.tsx` | `/new-orders/branches/:branchId` |
| `src/pages/new_orders/branches/index.tsx` | `/new-orders/branches` |
| `src/pages/new_orders/cancelled/detail.tsx` | `/new-orders/cancelled/:marketId` |
| `src/pages/new_orders/cancelled/index.tsx` | `/new-orders/cancelled` |
| `src/pages/new_orders/cancelled/utils.ts` | `/new-orders/cancelled`, `/new-orders/cancelled/:marketId` |
| `src/pages/new_orders/components/OrderCard.tsx` | `/new-orders/:marketId` |
| `src/pages/new_orders/components/lib/printLabelPdf.ts` | `/new-orders/:marketId` |
| `src/pages/new_orders/components/newOrderReceiveRules.ts` | `/new-orders/:marketId` |
| `src/pages/new_orders/components/newOrderUpdateRules.ts` | `/orders/edit/:orderId`, `/new-orders/:marketId/edit/:orderId` |
| `src/pages/new_orders/components/new_orderDetail.tsx` | `/new-orders/:marketId` |
| `src/pages/new_orders/components/new_orderUpdate.tsx` | `/orders/edit/:orderId`, `/new-orders/:marketId/edit/:orderId` |
| `src/pages/new_orders/components/new_orderUpdate.ui.tsx` | `/orders/edit/:orderId`, `/new-orders/:marketId/edit/:orderId` |
| `src/pages/new_orders/external_orders/create.tsx` | `/integrations/sources/create` |
| `src/pages/new_orders/external_orders/detail.tsx` | `/integrations/sources/:id` |
| `src/pages/new_orders/external_orders/index.tsx` | `/integrations/sources` |
| `src/pages/new_orders/index.tsx` | `/new-orders` |
| `src/pages/new_orders/markets/index.tsx` | `/new-orders` |
| `src/pages/notification-send/index.tsx` | `/notifications/send` |
| `src/pages/notifications/ui/CampaignPage.tsx` | `/notifications/sms` |
| `src/pages/notifications/ui/NotificationInboxPage.tsx` | `/inbox` |
| `src/pages/notifications/ui/NotificationsPage.tsx` | `/notifications` |
| `src/pages/notifications/ui/SmsPage.tsx` | `/notifications/sms` |
| `src/pages/notifications/ui/SmsReportTab.tsx` | `/notifications/sms` |
| `src/pages/notifications/ui/SmsSettingsTab.tsx` | `/notifications/sms` |
| `src/pages/notifications/ui/SmsTemplatesTab.tsx` | `/notifications/sms` |
| `src/pages/ops/index.tsx` | `/ops` |
| `src/pages/ops/tabs.ts` | `/ops` |
| `src/pages/orders/create/index.tsx` | `/new-orders/create` |
| `src/pages/orders/create/model/orderCreateForm.ts` | `/new-orders/create` |
| `src/pages/orders/create/ui/CreateModeTabs.tsx` | `/new-orders/create` |
| `src/pages/orders/create/ui/OrderStepper.tsx` | `/new-orders/create` |
| `src/pages/orders/create/ui/Step1Market.tsx` | `/new-orders/create` |
| `src/pages/orders/create/ui/Step2Combined.tsx` | `/new-orders/create` |
| `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | `/new-orders/create` |
| `src/pages/orders/create/ui/ai/AiCreatePanel.tsx` | `/new-orders/create` |
| `src/pages/orders/create/ui/ai/AiCreatedList.tsx` | `/new-orders/create` |
| `src/pages/orders/create/ui/ai/AiInputPanel.tsx` | `/new-orders/create` |
| `src/pages/orders/create/ui/ai/AiPreviewCard.tsx` | `/new-orders/create` |
| `src/pages/orders/index.tsx` | `/orders` |
| `src/pages/orders/lib/exportOrdersToExcel.ts` | `/orders` |
| `src/pages/orders/list/OrderFilters.tsx` | `/orders` |
| `src/pages/orders/list/OrderStatusBadge.tsx` | `/orders` |
| `src/pages/orders/list/OrdersTable.tsx` | `/orders` |
| `src/pages/orders/list/courier/index.tsx` | `/orders` |
| `src/pages/orders/list/courier/list/CancelModal.tsx` | `/orders`, `/orders/edit/:orderId` |
| `src/pages/orders/list/courier/list/SellModal.tsx` | `/orders`, `/orders/edit/:orderId` |
| `src/pages/orders/list/courier/list/ordertable/AllOrdersTable.tsx` | `/orders` |
| `src/pages/orders/list/courier/list/ordertable/CancelledOrdersTable.tsx` | `/orders` |
| `src/pages/orders/list/courier/list/ordertable/pendingOrderTable.tsx` | `/orders` |
| `src/pages/orders/list/courier/list/tabs.tsx` | `/orders` |
| `src/pages/partners/index.tsx` | `/integrations/partners` |
| `src/pages/payments/components/CashboxActionFormCard.tsx` | `/payments/cash-detail/:id` |
| `src/pages/payments/components/CashboxFormPopup.tsx` | `/payments/main-cashbox` |
| `src/pages/payments/components/CashboxRolePageLayout.tsx` | `/payments/cash-detail/:id`, `/cash-box` |
| `src/pages/payments/components/CashboxSummaryCard.tsx` | `/payments/main-cashbox` |
| `src/pages/payments/components/CloseShiftPopup.tsx` | `/payments/main-cashbox` |
| `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | `/payments`, `/cash-box` |
| `src/pages/payments/components/InactiveBadge.tsx` | `/payments` |
| `src/pages/payments/components/MyCashboxPage.tsx` | `/cash-box` |
| `src/pages/payments/components/PaymentHistoryList.tsx` | `/payments/main-cashbox`, `/payments/cash-detail/:id`, `/cash-box` |
| `src/pages/payments/components/PaymentSummaryCards.tsx` | `/payments` |
| `src/pages/payments/components/SalaryPaymentPopup.tsx` | `/payments/main-cashbox` |
| `src/pages/payments/components/cashDetail.tsx` | `/payments/cash-detail/:id` |
| `src/pages/payments/components/lib/exportMainCashboxReport.ts` | `/payments/main-cashbox` |
| `src/pages/payments/components/lib/receiveOptions.ts` | `/payments` |
| `src/pages/payments/components/mainCashbox.tsx` | `/payments/main-cashbox` |
| `src/pages/payments/components/patmentHistoryTable.tsx` | `/payments` |
| `src/pages/payments/index.tsx` | `/payments` |
| `src/pages/products/create/index.tsx` | `/products/create-product/:id` |
| `src/pages/products/list/index.tsx` | `/products` |
| `src/pages/profile/ui/ProfilePage.tsx` | `/profile` |
| `src/pages/region/index.tsx` | `/regions` |
| `src/pages/region/model/regionScope.ts` | `/regions` |
| `src/pages/region/pages/districts/index.tsx` | `/regions/districts` |
| `src/pages/region/pages/logist-assignment/index.tsx` | `/regions/logist-assignment` |
| `src/pages/region/pages/sato-management/index.tsx` | `/regions/sato-management` |
| `src/pages/region/ui/ScopedRegionStatistics.tsx` | `/regions` |
| `src/pages/region/ui/UzbekistanRegionMap.tsx` | `/`, `/regions` |
| `src/pages/returns/index.tsx` | `/returns` |
| `src/pages/scan/detail.tsx` | `/scan/:token` |
| `src/pages/scan/index.tsx` | `/scan` |
| `src/pages/scan/lib/scanResource.ts` | `/scan/:token` |
| `src/pages/scan/lib/scanShared.ts` | `/scan` |
| `src/pages/scan/ui/ScanPackageDetail.tsx` | `/scan/:token` |
| `src/pages/scan/ui/ScanPostDetail.tsx` | `/scan/:token` |
| `src/pages/settings/ui/SettingsPage.tsx` | `/settings` |
| `src/pages/system-ops/index.tsx` | `/system-ops` |
| `src/pages/ui-kit/KitSection.tsx` | `/ops/ui-kit` |
| `src/pages/ui-kit/ThemePair.tsx` | `/ops/ui-kit` |
| `src/pages/ui-kit/index.tsx` | `/ops/ui-kit` |
| `src/pages/ui-kit/sections/BadgesSection.tsx` | `/ops/ui-kit` |
| `src/pages/ui-kit/sections/ButtonsSection.tsx` | `/ops/ui-kit` |
| `src/pages/ui-kit/sections/CardsSection.tsx` | `/ops/ui-kit` |
| `src/pages/ui-kit/sections/FormatSection.tsx` | `/ops/ui-kit` |
| `src/pages/ui-kit/sections/PageHeaderSection.tsx` | `/ops/ui-kit` |
| `src/pages/ui-kit/sections/TabsSection.tsx` | `/ops/ui-kit` |
| `src/pages/users/create/CreateUserPage.tsx` | `/all-users/create-user` |
| `src/pages/users/detail/UserDetailPage.tsx` | `/new-orders/userDetail/:id`, `/all-users/:id` |
| `src/pages/users/list/UserListPage.tsx` | `/all-users` |
| `src/shared/components/PrintModeSelect.tsx` | `/mails/:id` |
| `src/shared/components/ScanFeedbackOverlay.tsx` | `/scan` |
| `src/shared/components/ScannerCameraModal.tsx` | `/new-orders/cancelled/:marketId`, `/dispatch`, `/courier-bulk` |
| `src/shared/components/popupConfirm.tsx` | `/orders`, `/new-orders/:marketId`, `/products`, `/all-users` |
| `src/shared/components/popupSelect.tsx` | `/dispatch`, `/payments`, `/products` |
| `src/shared/components/popupUpdate.tsx` | `/products` |
| `src/shared/lib/useCameraQrScanner.ts` | `/scan` |
| `src/shared/ui/ErrorBoundary.tsx` | `/runtime-error` |
| `src/shared/ui/ErrorBoundaryPage.tsx` | `/runtime-error` |
| `src/shared/ui/Forbidden.tsx` | `/403` |
| `src/shared/ui/NotFound.tsx` | `/404`, `/*` |
| `src/shared/ui/ServerError.tsx` | `/500` |
| `src/shared/ui/SmsMeter.tsx` | `/notifications/sms` |
| `src/shared/ui/error-page/ErrorInfoCard.tsx` | `/403`, `/404`, `/500` |
| `src/widgets/Sidebar/model/menuConfig.tsx` | `(qobiq)` |
| `src/widgets/Sidebar/ui/BottomNav.tsx` | `(qobiq)` |
| `src/widgets/Sidebar/ui/MobileMenu.tsx` | `(qobiq)` |
| `src/widgets/Sidebar/ui/Sidebar.tsx` | `(qobiq)` |
| `src/widgets/Sidebar/ui/SidebarItem.tsx` | `(qobiq)` |
| `src/widgets/activity-log/ui/ActivityLogDetail.tsx` | `/activity-logs` |
| `src/widgets/activity-log/ui/ActivityLogViewer.tsx` | `/activity-logs` |
| `src/widgets/branch-detail/ui/BranchDetailWidget.tsx` | `/branches/:id` |
| `src/widgets/branch-detail/ui/BranchEmployeesSection.tsx` | `/branches/:id` |
| `src/widgets/branch-detail/ui/BranchSettingsSection.tsx` | `/branches/:id` |
| `src/widgets/branch-list/ui/BranchCards.tsx` | `/branches` |
| `src/widgets/branch-list/ui/BranchListWidget.tsx` | `/branches` |
| `src/widgets/branch-list/ui/BranchTable.tsx` | `/branches` |
| `src/widgets/branch-list/ui/BranchTree.tsx` | `/branches` |
| `src/widgets/dashboard-performance-chart/ui/PerformanceChart.tsx` | `/` |
| `src/widgets/dashboard-region/ui/RegionStatsCard.tsx` | `/` |
| `src/widgets/dashboard-statistics/ui/DashboardStatistics.tsx` | `/` |
| `src/widgets/dashboard-statistics/ui/OrderStatusDonut.tsx` | `/` |
| `src/widgets/dashboard-statistics/ui/SuccessGauge.tsx` | `/` |
| `src/widgets/dashboard-top-performers/ui/TopPerformers.tsx` | `/`, `/branch-dashboard` |
| `src/widgets/financial-analysis/ui/FinancialAnalysis.tsx` | `/` |
| `src/widgets/header/ui/Header.tsx` | `(qobiq)` |
| `src/widgets/header/ui/HeaderSearch.tsx` | `(qobiq)` |
| `src/widgets/header/ui/NotificationsMenu.tsx` | `(qobiq)` |
| `src/widgets/header/ui/SearchScreen.tsx` | `(qobiq)` |
| `src/widgets/header/ui/UserMenu.tsx` | `(qobiq)` |
| `src/widgets/layout/dashboardLayout.tsx` | `(qobiq)` |
| `src/widgets/layout/scanLayout.tsx` | `(qobiq)` |
| `src/widgets/notification-inbox/ui/NotificationInboxItem.tsx` | `/notifications/send`, `/inbox` |
| `src/widgets/notification-inbox/ui/NotificationInboxList.tsx` | `/inbox` |
| `src/widgets/notification-table/ui/NotificationTable.tsx` | `/notifications` |
| `src/widgets/user-create/ui/CreateUserWidget.tsx` | `/all-users/create-user` |
| `src/widgets/user-detail/ui/MarketTelegramTokenCard.tsx` | `/all-users/:id` |
| `src/widgets/user-detail/ui/UserDetailWidget.tsx` | `/new-orders/userDetail/:id`, `/all-users/:id`, `/profile` |
| `src/widgets/user-list/ui/UserListTable.tsx` | `/all-users` |
| `src/widgets/user-list/ui/UserStats.tsx` | `/all-users` |

## 7. Rol menyulari → route

Manba: `src/widgets/Sidebar/model/menuConfig.tsx` (kod) va `design/kit/roles.json` (maketdagi menyu, yorliq va guruh). Ikkalasidagi bandlar to'plami bir xil bo'lishi shart — skript tekshiradi. Maketda bandlar guruhlangan (Ish, Moliya …), shuning uchun tartib farq qilishi mumkin. Menejer menyusi filial turiga qarab (`MANAGER_CAPABILITIES`), registratorning «Biriktirish» bandi ham (`getSidebarConfigForUser`).

### superadmin — Superadmin

| Band | Kalit | `to` | Route | Shart (filial turi) | superadmin maketlari |
|---|---|---|---|---|---|
| Bosh sahifa | `dashboard` | `/` | `/` | — | `superadmin-dashboard-main` (+1) |
| Buyurtmalar | `orders` | `/orders` | `/orders` | — | `superadmin-orders-list` (+1) |
| Qabul va yaratish | `newOrders` | `/new-orders` | `/new-orders` | — | `superadmin-neworders-markets` |
| Pochta | `mails` | `/mails` | `/mails/today` | — | `superadmin-mails-today` |
| Paketlar | `batches` | `/batches` | `/batches` | — | `superadmin-batches-new` (+2) |
| Qaytarishlar | `returns` | `/returns` | `/returns` | — | `superadmin-returns-list` |
| Mahsulotlar | `products` | `/products` | `/products` | — | `superadmin-products-list` (+3) |
| Foydalanuvchilar | `users` | `/all-users` | `/all-users` | — | `superadmin-users-list` (+1) |
| To'lovlar | `payments` | `/payments` | `/payments` | — | `superadmin-payments-overview` (+3) |
| Balans | `balance` | `/financial-balance` | `/financial-balance` | — | `superadmin-balance-overview` (+4) |
| Hududlar | `regions` | `/regions` | `/regions` | — | `superadmin-regions-map` (+1) |
| Bildirishnomalar | `notifications` | `/notifications` | `/notifications` | — | `superadmin-notifications-telegram-groups` (+2) |
| Filiallar | `branches` | `/branches` | `/branches` | — | `superadmin-branches-list-tree` (+2) |
| Integratsiyalar | `integrations` | `/integrations` | `/integrations/connections` | — | `superadmin-integrations-partners-console` (+11) |
| Faoliyat jurnali | `activityLogs` | `/activity-logs` | `/activity-logs` | — | `superadmin-activity-logs-list` (+1) |
| Ops vositalari | `ops` | `/ops` | `/ops` | — | `superadmin-ops-finance-operators` (+7) |

### admin — Admin

| Band | Kalit | `to` | Route | Shart (filial turi) | admin maketlari |
|---|---|---|---|---|---|
| Bosh sahifa | `dashboard` | `/` | `/` | — | `admin-dashboard-main` |
| Buyurtmalar | `orders` | `/orders` | `/orders` | — | `admin-orders-list` (+1) |
| Qabul va yaratish | `newOrders` | `/new-orders` | `/new-orders` | — | `admin-neworders-markets` |
| Pochta | `mails` | `/mails` | `/mails/today` | — | `admin-mails-today` |
| Paketlar | `batches` | `/batches` | `/batches` | — | `admin-batches-new` (+2) |
| Qaytarishlar | `returns` | `/returns` | `/returns` | — | `admin-returns-list` |
| Mahsulotlar | `products` | `/products` | `/products` | — | `admin-products-list` (+3) |
| Foydalanuvchilar | `users` | `/all-users` | `/all-users` | — | `admin-users-list` (+1) |
| To'lovlar | `payments` | `/payments` | `/payments` | — | `admin-payments-overview` (+3) |
| Balans | `balance` | `/financial-balance` | `/financial-balance` | — | `admin-balance-overview` (+4) |
| Hududlar | `regions` | `/regions` | `/regions` | — | `admin-regions-map` (+1) |
| Integratsiyalar | `integrations` | `/integrations` | `/integrations/connections` | — | `admin-integrations-partners` (+10) |
| Faoliyat jurnali | `activityLogs` | `/activity-logs` | `/activity-logs` | — | `admin-activity-logs-list` (+1) |

### manager — Menejer

| Band | Kalit | `to` | Route | Shart (filial turi) | manager maketlari |
|---|---|---|---|---|---|
| Bosh sahifa | `dashboard` | `/branch-dashboard` | `/branch-dashboard` | barchasi | `manager-branch-dashboard-main` |
| Biriktirish | `dispatch` | `/dispatch` | `/dispatch` | REGIONAL · HYBRID | `manager-dispatch-scan` (+2) |
| Buyurtmalar | `orders` | `/orders` | `/orders` | barchasi | `manager-orders-list-all` (+5) |
| Tezkor amal | `quickAction` | `/courier-bulk` | `/courier-bulk` | REGIONAL · HYBRID | `manager-courier-bulk-main` (+1) |
| Qabul va yaratish | `newOrders` | `/new-orders` | `/new-orders` | HQ · PICKUP · HYBRID | `manager-new-orders-markets` |
| Pochta | `mails` | `/mails` | `/mails/today` | HQ · REGIONAL · HYBRID | `manager-mails-today` |
| Paketlar | `batches` | `/batches` | `/batches` | HQ · PICKUP · HYBRID | `manager-batches-new` (+2) |
| Qaytarishlar | `returns` | `/returns` | `/returns` | HQ · PICKUP · HYBRID | `manager-returns-list` |
| Mahsulotlar | `products` | `/products` | `/products` | barchasi | `manager-products-list` (+3) |
| Foydalanuvchilar | `users` | `/all-users` | `/all-users` | HQ · PICKUP · REGIONAL · HYBRID | `manager-users-list` |
| To'lovlar | `payments` | `/payments` | `/payments` | HQ · REGIONAL · HYBRID | `manager-payments-overview` (+2) |
| Hududlar | `regions` | `/regions` | `/regions` | barchasi | `manager-regions-scoped` |

### registrator — Registrator

| Band | Kalit | `to` | Route | Shart (filial turi) | registrator maketlari |
|---|---|---|---|---|---|
| Bosh sahifa | `dashboard` | `/` | `/` | — | `registrator-dashboard-main` |
| Biriktirish | `dispatch` | `/dispatch` | `/dispatch` | HQ · REGIONAL · HYBRID | `registrator-dispatch-list` (+3) |
| Buyurtmalar | `orders` | `/orders` | `/orders` | — | `registrator-orders-list` (+1) |
| Qabul va yaratish | `newOrders` | `/new-orders` | `/new-orders` | — | `registrator-new-orders-markets` |
| Pochta | `mails` | `/mails` | `/mails/today` | — | `registrator-mails-today` |
| Mahsulotlar | `products` | `/products` | `/products` | — | `registrator-products-list` (+3) |

### market — Market

| Band | Kalit | `to` | Route | Shart (filial turi) | market maketlari |
|---|---|---|---|---|---|
| Bosh sahifa | `dashboard` | `/` | `/` | — | `market-dashboard-home` (+1) |
| Buyurtmalar | `orders` | `/orders` | `/orders` | — | `market-orders-list` |
| Qabul va yaratish | `newOrders` | `/new-orders` | `/new-orders` | — | izohga qarang |
| Mahsulotlar | `products` | `/products` | `/products` | — | `market-products-list` (+2) |
| To'lovlar | `payments` | `/cash-box` | `/cash-box` | — | `market-cashbox-my` (+1) |

### courier — Kuryer

| Band | Kalit | `to` | Route | Shart (filial turi) | courier maketlari |
|---|---|---|---|---|---|
| Bosh sahifa | `dashboard` | `/` | `/` | — | `courier-dashboard-home` |
| Buyurtmalar | `orders` | `/orders` | `/orders` | — | `courier-orders-pending` (+9) |
| Tezkor amal | `quickAction` | `/courier-bulk` | `/courier-bulk` | — | `courier-courier-bulk-main` (+3) |
| Pochta | `mails` | `/mails` | `/mails/today` | — | `courier-mails-today` (+1) |
| Kassa | `payments` | `/cash-box` | `/cash-box` | — | `courier-cashbox-my-all` (+2) |
| Hududlar | `regions` | `/regions` | `/regions` | — | `courier-regions-scoped` |
