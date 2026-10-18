# Ekranlar xaritasi — route ↔ dizayn v2 maketi

> **Avtomatik yaratilgan fayl — qo'lda tahrirlamang.** Manba: `design/kit/route-map.json` (route ↔ maket, qo'lda
> yuritiladi), `src/app/lib/routes.tsx` (yo'llar va guardlar), `design/kit/views.json` (maketlar). Qayta yaratish:
> `npm run design:screens`; tekshirish: `npm run design:screens -- --check`.

**76 ta route** (+ qobiq) · **411 ta maket** (264 sahifa, 134 oyna, 13 tizim taxtasi; 369 ta fragment fayli) · kodda yo'q: **12** · qisman: **21** · v2 ga ko'chirilgan route: **51 / 76**

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
| `/login` | Kirish va xato sahifalari | `src/features/auth/index.tsx` | hamma (kirishsiz) | 3 | v2 |
| `/403` | Kirish va xato sahifalari | `src/shared/ui/Forbidden.tsx` | hamma (kirishsiz) | 1 | v2 |
| `/404` | Kirish va xato sahifalari | `src/shared/ui/NotFound.tsx` | hamma (kirishsiz) | 1 | v2 |
| `/500` | Kirish va xato sahifalari | `src/shared/ui/ServerError.tsx` | hamma (kirishsiz) | 1 | v2 |
| `/runtime-error` | Kirish va xato sahifalari | `src/shared/ui/ErrorBoundaryPage.tsx` | hamma (kirishsiz) | 1 | v2 |
| `/*` | Kirish va xato sahifalari | `src/shared/ui/NotFound.tsx` | superadmin, admin, manager, registrator, market, courier | 1 | v2 |
| `/` | Bosh sahifa | `src/pages/dashboard/MarketDashboardPage.tsx` + `src/pages/dashboard/DashboardPage.tsx` | superadmin, admin, manager (→ /branch-dashboard), registrator, market, courier | 8 | v2 |
| `/branch-dashboard` | Bosh sahifa | `src/pages/branch-dashboard/ui/BranchDashboardPage.tsx` | manager | 2 | v2 |
| `/orders` | Buyurtmalar | `src/pages/orders/index.tsx` | superadmin, admin, manager, registrator, market, courier | 24 | v2 |
| `/orders/edit/:orderId` | Buyurtmalar | `src/pages/new_orders/components/new_orderUpdate.tsx` | superadmin, admin, manager, registrator, market, courier | 19 | v2 |
| `/new-orders` | Qabul va yaratish | `src/pages/new_orders/markets/index.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market | 4 | v2 |
| `/new-orders/create` | Qabul va yaratish | `src/pages/orders/create/index.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market | 23 | v2 |
| `/new-orders/incoming` | Qabul va yaratish | `src/pages/incoming-orders/SourcePicker.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator | 3 | v2 |
| `/new-orders/incoming/:marketId` | Qabul va yaratish | `src/pages/incoming-orders/index.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator | 7 | v2 |
| `/new-orders/branches` | Qabul va yaratish | `src/pages/new_orders/branches/index.tsx` | superadmin, admin | 2 | v2 |
| `/new-orders/branches/:branchId` | Qabul va yaratish | `src/pages/new_orders/branches/batches.tsx` | superadmin, admin | 2 | v2 |
| `/new-orders/branches/:branchId/batches/:batchId` | Qabul va yaratish | `src/pages/new_orders/branches/batchDetail.tsx` | superadmin, admin | 5 | v2 |
| `/new-orders/cancelled` | Qabul va yaratish | `src/pages/new_orders/cancelled/index.tsx` | superadmin, admin, registrator (faqat HQ) | 3 | v2 |
| `/new-orders/cancelled/:marketId` | Qabul va yaratish | `src/pages/new_orders/cancelled/detail.tsx` | superadmin, admin, registrator (faqat HQ), market (faqat o'z marketi) | 14 | v2 |
| `/new-orders/:marketId` | Qabul va yaratish | `src/pages/new_orders/components/new_orderDetail.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market (faqat o'z marketi) | 17 | v2 |
| `/new-orders/:marketId/edit/:orderId` | Qabul va yaratish | `src/pages/new_orders/components/new_orderUpdate.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market (faqat o'z marketi) | 3 | v2 |
| `/new-orders/userDetail/:id` | Qabul va yaratish | `src/pages/users/detail/UserDetailPage.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market | 0 | v2 |
| `/mails` | Pochta | `src/pages/mails/index.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier | 0 | v2 |
| `/mails/today` | Pochta | `src/pages/mails/index.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier | 6 | v2 |
| `/mails/return` | Pochta | `src/pages/mails/index.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier | 4 | v2 |
| `/mails/refused` | Pochta | `src/pages/mails/index.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier | 5 | v2 |
| `/mails/old` | Pochta | `src/pages/mails/index.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier | 7 | v2 |
| `/mails/:id` | Pochta | `src/pages/mails/detail/index.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier | 25 | v2 |
| `/batches` | Paketlar va qaytarishlar | `src/pages/batches/ui/BatchesPage.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID) | 9 | v2 |
| `/batches/:id` | Paketlar va qaytarishlar | `src/pages/batches/ui/BatchDetailPage.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID) | 7 | v2 |
| `/returns` | Paketlar va qaytarishlar | `src/pages/returns/index.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID) | 3 | v2 |
| `/dispatch` | Biriktirish va tezkor amal | `src/pages/dispatch/index.tsx` | superadmin, admin, manager (REGIONAL · HYBRID), registrator (HQ · REGIONAL · HYBRID) | 8 | v2 |
| `/courier-bulk` | Biriktirish va tezkor amal | `src/pages/courier-bulk/index.tsx` | manager (REGIONAL · HYBRID), courier | 7 | v2 |
| `/scan` | Skaner | `src/pages/scan/index.tsx` | superadmin, admin, manager, registrator, market, courier | 14 | eski |
| `/scan/:token` | Skaner | `src/pages/scan/detail.tsx` | superadmin, admin, manager, registrator, market, courier | 10 | v2 |
| `/payments` | Moliya | `src/pages/payments/index.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID) | 11 | v2 |
| `/payments/main-cashbox` | Moliya | `src/pages/payments/components/mainCashbox.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID) | 9 | v2 |
| `/payments/cash-detail/:id` | Moliya | `src/pages/payments/components/cashDetail.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID) | 8 | v2 |
| `/cash-box` | Moliya | `src/pages/payments/components/MyCashboxPage.tsx` | manager, market, courier | 5 | v2 |
| `/financial-balance` | Moliya | `src/pages/financial-balance/index.tsx` | superadmin, admin | 11 | v2 |
| `/products` | Mahsulotlar | `src/pages/products/list/index.tsx` | superadmin, admin, manager, registrator, market | 19 | v2 |
| `/products/create-product/:id` | Mahsulotlar | `src/pages/products/create/index.tsx` | superadmin, admin, manager, registrator, market | 5 | v2 |
| `/all-users` | Foydalanuvchilar | `src/pages/users/list/UserListPage.tsx` | superadmin, admin, manager (filial turi aniq bo'lsa) | 5 | v2 |
| `/all-users/create-user` | Foydalanuvchilar | `src/pages/users/create/CreateUserPage.tsx` | superadmin, admin, manager (filial turi aniq bo'lsa) | 4 | v2 |
| `/all-users/:id` | Foydalanuvchilar | `src/pages/users/detail/UserDetailPage.tsx` | superadmin, admin, manager (filial turi aniq bo'lsa) | 8 | v2 |
| `/regions` | Hududlar | `src/pages/region/index.tsx` | superadmin, admin, manager, courier | 7 | v2 |
| `/regions/districts` | Hududlar | `src/pages/region/pages/districts/index.tsx` | superadmin | 1 | v2 |
| `/regions/sato-management` | Hududlar | `src/pages/region/pages/sato-management/index.tsx` | superadmin, admin | 2 | v2 |
| `/regions/logist-assignment` | Hududlar | `src/pages/region/pages/logist-assignment/index.tsx` | superadmin, admin | 2 | v2 |
| `/branches` | Filiallar | `src/pages/branches/ui/BranchesPage.tsx` | superadmin | 3 | v2 |
| `/branches/:id` | Filiallar | `src/pages/branches/ui/BranchDetailPage.tsx` | superadmin | 2 | v2 |
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

- **Fayllar:** `src/features/auth/index.tsx` · `src/features/auth/ui/LoginForm.tsx` · `src/features/auth/ui/SessionExpiredScreen.tsx` · `src/auth/loginNotice.ts` · `src/auth/SessionExpiryCountdown.tsx` · `src/shared/lib/shellBannerSlot.ts`
- **Qobiq:** qobiqsiz (kirishsiz) · **Guard:** yo'q (kirishsiz)
- **Rollar:** hamma (kirishsiz)
- **Holat:** v2
- **Izoh:** Dizayn v2 (G3): kirish formasi (common-login, xato holati common-login-error) va «Sessiya tugadi» ekrani (SessionExpiredScreen — logoutAndRedirect({ reason: 'sessionExpired' }) → loginNotice; qo'lda «Chiqish» — to'g'ridan-to'g'ri forma). Sessiya banneri (SessionExpiryCountdown, taxta tizim-feedback 04) butun ilovada: DashboardLayout'da yuqori panel ostidagi shell slotiga ([data-shell-slot=banner], shared/lib/shellBannerSlot.ts) portal — sahifani pastga suradi, hech narsani yopmaydi (maket talabi bilan qo'shilgan shell sloti); ScanLayout'da oqimda, sticky. Ega savoli Q6 sukuti: «© 2026 Elchi Pochta» chizilmaydi (2026-10-16 «footer olib tashlangan»). Kirmagan foydalanuvchining noma'lum yo'li → /login (routes.tsx dagi mavjud xulq, o'zgartirilmadi).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/login` | umumiy (barcha rollar) | `common-login` — Tizimga kirish | [design/fragments/common--login.html](fragments/common--login.html) | sahifa | v2 |
| `/login` | umumiy (barcha rollar) | `common-login-error` — Tizimga kirish — xato holati | [design/fragments/common--login-error.html](fragments/common--login-error.html) | sahifa | v2 |
| `/login` | umumiy (barcha rollar) | `common-session-expired` — Sessiya tugadi | [design/fragments/common--session-expired.html](fragments/common--session-expired.html) | sahifa | v2 |

#### `/403` — Ruxsat yo'q

- **Fayllar:** `src/shared/ui/Forbidden.tsx` · `src/shared/ui/error-page/ErrorPageFrame.tsx`
- **Qobiq:** DashboardLayout · **Guard:** yo'q (faqat kirish)
- **Rollar:** hamma (kirishsiz)
- **Holat:** v2
- **Izoh:** Alohida maket yo'q — tizim-errors taxtasidagi «403 · Ruxsat yo'q» bloki. ProtectedRoute va sahifa ichidagi ruxsat tekshiruvlari shu yerga yo'naltiradi. Kirgan foydalanuvchi — shell ichida (yon menyu va yuqori panel joyida); kirmagan yoki shell yiqilgan bo'lsa — butun ekran (routes.tsx → STANDALONE_ERROR_PAGES, AppRouter).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/403` | tizim taxtasi | `tizim-errors` — Xato va bo'sh holatlar | [design/fragments/tizim--errors.html](fragments/tizim--errors.html) | taxta | qoida |

#### `/404` — Sahifa topilmadi

- **Fayllar:** `src/shared/ui/NotFound.tsx` · `src/shared/ui/error-page/ErrorPageFrame.tsx`
- **Qobiq:** DashboardLayout · **Guard:** yo'q (faqat kirish)
- **Rollar:** hamma (kirishsiz)
- **Holat:** v2
- **Izoh:** tizim-errors taxtasidagi «404 · Sahifa topilmadi» bloki. Kirgan foydalanuvchi — shell ichida (yon menyu va yuqori panel joyida); kirmagan yoki shell yiqilgan bo'lsa — butun ekran (routes.tsx → STANDALONE_ERROR_PAGES, AppRouter).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/404` | tizim taxtasi | `tizim-errors` — Xato va bo'sh holatlar | [design/fragments/tizim--errors.html](fragments/tizim--errors.html) | taxta | qoida |

#### `/500` — Server xatosi

- **Fayllar:** `src/shared/ui/ServerError.tsx` · `src/shared/ui/error-page/ErrorPageFrame.tsx`
- **Qobiq:** DashboardLayout · **Guard:** yo'q (faqat kirish)
- **Rollar:** hamma (kirishsiz)
- **Holat:** v2
- **Izoh:** tizim-errors taxtasidagi «500 · Server xatosi» bloki. Kirgan foydalanuvchi — shell ichida (yon menyu va yuqori panel joyida); kirmagan yoki shell yiqilgan bo'lsa — butun ekran (routes.tsx → STANDALONE_ERROR_PAGES, AppRouter).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/500` | tizim taxtasi | `tizim-errors` — Xato va bo'sh holatlar | [design/fragments/tizim--errors.html](fragments/tizim--errors.html) | taxta | qoida |

#### `/runtime-error` — Ilova xatosi

- **Fayllar:** `src/shared/ui/ErrorBoundaryPage.tsx` · `src/shared/ui/ErrorBoundary.tsx`
- **Qobiq:** DashboardLayout · **Guard:** yo'q (faqat kirish)
- **Rollar:** hamma (kirishsiz)
- **Holat:** v2
- **Izoh:** tizim-errors taxtasidagi «Ilova xatosi» bloki. ErrorBoundary xatoni saqlab, shu yo'lga to'liq qayta yuklash bilan o'tadi. Kirgan foydalanuvchi — shell ichida (yon menyu va yuqori panel joyida); kirmagan yoki shell yiqilgan bo'lsa — butun ekran (routes.tsx → STANDALONE_ERROR_PAGES, AppRouter).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/runtime-error` | tizim taxtasi | `tizim-errors` — Xato va bo'sh holatlar | [design/fragments/tizim--errors.html](fragments/tizim--errors.html) | taxta | qoida |

#### `/*` — Noma'lum yo'l (qobiq ichida)

- **Fayllar:** `src/shared/ui/NotFound.tsx`
- **Qobiq:** DashboardLayout · **Guard:** yo'q (faqat kirish)
- **Rollar:** superadmin, admin, manager, registrator, market, courier
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/*` | tizim taxtasi | `tizim-errors` — Xato va bo'sh holatlar | [design/fragments/tizim--errors.html](fragments/tizim--errors.html) | taxta | qoida |

### Bosh sahifa

#### `/` — Bosh sahifa — rolga qarab: DashboardPage yoki MarketDashboardPage (dizayn v2)

- **Fayllar:** `src/app/lib/routes.tsx` · `src/pages/dashboard/DashboardPage.tsx` · `src/pages/dashboard/MarketDashboardPage.tsx` · `src/widgets/dashboard-statistics/ui/DashboardHeader.tsx` · `src/widgets/dashboard-statistics/ui/DashboardGrid.tsx` · `src/widgets/dashboard-statistics/ui/SuccessRateCard.tsx` · `src/widgets/dashboard-statistics/ui/OrderStatusCard.tsx` · `src/pages/dashboard/ui/DeliveryQualityCard.tsx` · `src/pages/dashboard/ui/DeliveryResultsCard.tsx` · `src/widgets/financial-analysis/ui/FinancialAnalysis.tsx` · `src/widgets/financial-analysis/ui/FinancialTrendPlot.tsx` · `src/widgets/financial-analysis/ui/CashBalanceCard.tsx` · `src/widgets/dashboard-top-performers/ui/TopRankCard.tsx` · `src/widgets/dashboard-region/ui/RegionOverviewCard.tsx` · `src/widgets/dashboard-region/ui/RegionTiles.tsx` · `src/widgets/region-detail/ui/RegionDetailDialog.tsx` · `src/pages/dashboard/ui/CourierPlanCard.tsx` · `src/pages/dashboard/ui/CourierCashCard.tsx` · `src/pages/dashboard/ui/MarketSalesCard.tsx` · `src/pages/dashboard/ui/QuickActions.tsx` · `src/pages/dashboard/ui/ExtraCostApprovalsCard.tsx` · `src/shared/ui/charts/index.ts`
- **Qobiq:** DashboardLayout · **Guard:** yo'q (faqat kirish) · o'rovchi: `DashboardEntry`
- **Rollar:** superadmin, admin, manager (→ /branch-dashboard), registrator, market, courier
- **Menyuda:** «Bosh sahifa» (`dashboard`) — superadmin, admin, registrator, market, courier
- **Holat:** v2
- **Izoh:** DashboardEntry (routes.tsx): market → MarketDashboardPage (xarajat tasdiqlari shu sahifada), qolganlar → DashboardPage (kuryer — alohida tarmoq isCourier). Dizayn v2 (G1): grafiklar — src/shared/ui/charts (recharts faqat «Moliyaviy tahlil» trendida, FinancialTrendPlot lazy + DeferredMount rootMargin 0; bundle byudjeti 450 KB — tests/e2e/dashboard-bundle.preview.spec.ts), viloyat oynasi — umumiy RegionDetailDialog (lazy, faqat bosilganda; registratorda daromadsiz — showRevenue=false, eski oyna xulqi). Reytinglar top 5 (telefonda top 3) + «Yana ko'rsatish». Chizilmaganlar (Taklif yoki API yo'q, spec §6): «Buyurtmalar vaqti» issiqlik xaritasi, KPI «Yo'qotilgan daromad», KPI sparkline, «maqsad 80%», «Sof foyda» qatori, market «Reytingdagi o'rningiz» / «Buyurtmalar dinamikasi», xarajat so'rovida so'rovchi ismi va buyurtma raqami, kuryer «Oxirgi 7 kun». Ega savollari — sukut javoblari qo'llangan (spec §9): Q1 delta va «Kecha» — oldingi davr uchun ikkinchi analytics so'rovi («Barchasi»da yo'q); Q2 gauge belgisi «Yaxshi chegarasi · 70%»; Q3 registrator sarlavha izohida filial nomi (backend registratorni filialga cheklaydi); Q4 «Moliyaviy tahlil» izohi «Daromad · oldingi davr bilan solishtirish», qator «Daromad»; Q5 kuryer «Kassa» sharsharasi faqat my-cashbox bugungi tarixni bersa, aks holda «Qo'lingizdagi pul»; Q6 market «Tasdiqlash / Rad etish» tasdiq oynasisiz (maketdagidek); Q7 «Barchasi»da «Yetkazish sifati» o'rnida bo'sh holat, «Moliyaviy tahlil» va «Kassa» yashirin.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/` | superadmin | `superadmin-dashboard-main` — Dashboard — Bugungi statistika<br>↳ `src/pages/dashboard/DashboardPage.tsx` | [design/fragments/superadmin--dashboard-main.html](fragments/superadmin--dashboard-main.html) | sahifa | v2 |
| `/` | superadmin | `superadmin-dashboard-region-modal` — Dashboard — Viloyat tafsiloti (xarita)<br>↳ `src/widgets/region-detail/ui/RegionDetailDialog.tsx` | [design/fragments/superadmin--dashboard-region-modal.html](fragments/superadmin--dashboard-region-modal.html) | oyna | v2 |
| `/` | admin | `admin-dashboard-main` — Dashboard<br>↳ `src/pages/dashboard/DashboardPage.tsx` | [design/fragments/admin--dashboard-main.html](fragments/admin--dashboard-main.html) | sahifa | v2 |
| `/` | manager | — DashboardEntry menejerni /branch-dashboard ga yo'naltiradi. | — | — | v2 |
| `/` | registrator | `registrator-dashboard-main` — Dashboard — statistika<br>↳ `src/pages/dashboard/DashboardPage.tsx` | [design/fragments/registrator--dashboard-main.html](fragments/registrator--dashboard-main.html) | sahifa | v2 |
| `/` | market | `market-dashboard-home` — Mening dashboardim<br>↳ `src/pages/dashboard/MarketDashboardPage.tsx` | [design/fragments/market--dashboard-home.html](fragments/market--dashboard-home.html) | sahifa | v2 |
| `/` | market | `market-dashboard-extra-cost-approvals` — Dashboard · Xarajat tasdiqlari<br>↳ `src/pages/dashboard/ui/ExtraCostApprovalsCard.tsx` | [design/fragments/market--dashboard-extra-cost-approvals.html](fragments/market--dashboard-extra-cost-approvals.html) | sahifa | v2 |
| `/` | courier | `courier-dashboard-home` — Bosh sahifa — kuryer statistikasi<br>↳ `src/pages/dashboard/DashboardPage.tsx` | [design/fragments/courier--dashboard-home.html](fragments/courier--dashboard-home.html) | sahifa | v2 |
| `/` | tizim taxtasi | `tizim-charts` — Grafiklar — statistika va tahlil | [design/fragments/tizim--charts.html](fragments/tizim--charts.html) | taxta | qoida |

#### `/branch-dashboard` — Filial paneli (menejer bosh sahifasi, dizayn v2)

- **Fayllar:** `src/pages/branch-dashboard/index.tsx` · `src/pages/branch-dashboard/ui/BranchDashboardPage.tsx` · `src/pages/branch-dashboard/ui/BranchCards.tsx` · `src/pages/branch-dashboard/ui/branchDashboardAdapter.ts` · `src/widgets/dashboard-statistics/ui/DashboardHeader.tsx` · `src/widgets/dashboard-top-performers/ui/TopRankCard.tsx` · `src/shared/ui/charts/index.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewBranchDashboard` (routes.tsx → canViewBranchDashboard)
- **Rollar:** manager
- **Menyuda:** «Bosh sahifa» (`dashboard`) — manager
- **Holat:** v2
- **Izoh:** Asosiy fayl — ui/BranchDashboardPage.tsx (index.tsx faqat qayta eksport). «Sizning filial» — reytingda pinned qator; stats_unavailable — ErrorState «Statistika vaqtincha mavjud emas»; davr sukuti — bugun.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/branch-dashboard` | manager | `manager-branch-dashboard-main` — Filial paneli<br>↳ `src/pages/branch-dashboard/ui/BranchDashboardPage.tsx` | [design/fragments/manager--branch-dashboard-main.html](fragments/manager--branch-dashboard-main.html) | sahifa | v2 |
| `/branch-dashboard` | tizim taxtasi | `tizim-charts` — Grafiklar — statistika va tahlil | [design/fragments/tizim--charts.html](fragments/tizim--charts.html) | taxta | qoida |

### Buyurtmalar

#### `/orders` — Buyurtmalar ro'yxati (kuryerda — alohida ro'yxat komponenti)

- **Fayllar:** `src/pages/orders/index.tsx` · `src/pages/orders/list/OrderFilters.tsx` · `src/pages/orders/list/OrderFiltersSheet.tsx` · `src/pages/orders/list/OrdersTable.tsx` · `src/pages/orders/list/orderFilterModel.ts` · `src/pages/orders/lib/exportOrdersToExcel.ts` · `src/pages/orders/list/courier/index.tsx` · `src/pages/orders/list/courier/list/tabs.tsx` · `src/pages/orders/list/courier/list/ordertable/pendingOrderTable.tsx` · `src/pages/orders/list/courier/list/ordertable/AllOrdersTable.tsx` · `src/pages/orders/list/courier/list/ordertable/CancelledOrdersTable.tsx` · `src/pages/orders/list/courier/list/ordertable/CourierOrdersTable.tsx` · `src/pages/orders/list/courier/list/SellModal.tsx` · `src/pages/orders/list/courier/list/CancelModal.tsx` · `src/pages/orders/list/courier/list/RollbackOrderDialog.tsx` · `src/pages/orders/list/courier/list/OrderActionParts.tsx` · `src/entities/orders/ui/ExtraCostApprovalAlerts.tsx` · `src/entities/orders/ui/ExtraCostApprovalTag.tsx` · `src/entities/order/ui/ReturnRequestedTag.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewOrders` (access.ts → canViewOrders)
- **Rollar:** superadmin, admin, manager, registrator, market, courier
- **Menyuda:** «Buyurtmalar» (`orders`) — superadmin, admin, manager, registrator, market, courier
- **Holat:** v2
- **Izoh:** Kuryer ro'yxati — list/courier/index.tsx (tablar list/courier/list/tabs.tsx). Kuryerdan boshqa barcha rollarda bir xil 8 holat tabi (Barchasi · Yangi · Qabul qilindi · Yo'lda · Kutilmoqda · Sotilgan · To'langan · Bekor qilingan; tab sonlari API'da yo'q — chizilmaydi). Menejerning qatordagi sotish/bekor/qaytarish amallari faqat REGIONAL · HYBRID filialda va can_sell_cancel yoqilganda; «Bekor qilingan» tabida HQ'ga yuborish (tanlov + QR skaner) ham faqat REGIONAL · HYBRID. Qator bosilsa → /orders/edit/:orderId.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/orders` | superadmin | `superadmin-orders-list` — Buyurtmalar ro'yxati | [design/fragments/superadmin--orders-list.html](fragments/superadmin--orders-list.html) | sahifa | v2 |
| `/orders` | superadmin | `superadmin-orders-filters-mobile` — Buyurtmalar — filtr paneli (telefon)<br>↳ `src/pages/orders/list/OrderFilters.tsx` | [design/fragments/superadmin--orders-filters-mobile.html](fragments/superadmin--orders-filters-mobile.html) | oyna · faqat telefon | v2 |
| `/orders` | admin | `admin-orders-list` — Buyurtmalar ro'yxati | [design/fragments/admin--orders-list.html](fragments/admin--orders-list.html) | sahifa | v2 |
| `/orders` | admin | `admin-orders-filters-mobile` — Buyurtmalar — filtr paneli (telefon)<br>↳ `src/pages/orders/list/OrderFilters.tsx` | [design/fragments/superadmin--orders-filters-mobile.html](fragments/superadmin--orders-filters-mobile.html) | oyna · faqat telefon | v2 |
| `/orders` | manager | `manager-orders-list-all` — Buyurtmalar — Hamma buyurtmalar | [design/fragments/manager--orders-list-all.html](fragments/manager--orders-list-all.html) | sahifa | v2 |
| `/orders` | manager | `manager-orders-list-pending` — Buyurtmalar — Kutilayotgan | [design/fragments/manager--orders-list-pending.html](fragments/manager--orders-list-pending.html) | sahifa | v2 |
| `/orders` | manager | `manager-orders-list-cancelled` — Buyurtmalar — Bekor qilinganlar (HQ'ga yuborish) | [design/fragments/manager--orders-list-cancelled.html](fragments/manager--orders-list-cancelled.html) | sahifa | v2 |
| `/orders` | manager | `manager-orders-sell-dialog` — Sotish oynasi<br>↳ `src/pages/orders/list/courier/list/SellModal.tsx` | [design/fragments/manager--orders-sell-dialog.html](fragments/manager--orders-sell-dialog.html) | oyna | v2 |
| `/orders` | manager | `manager-orders-cancel-dialog` — Bekor qilish oynasi<br>↳ `src/pages/orders/list/courier/list/CancelModal.tsx` | [design/fragments/manager--orders-cancel-dialog.html](fragments/manager--orders-cancel-dialog.html) | oyna | v2 |
| `/orders` | manager | `manager-orders-rollback-dialog` — Buyurtmani qaytarish tasdig'i<br>↳ `src/pages/orders/list/courier/list/RollbackOrderDialog.tsx` | [design/fragments/manager--orders-rollback-dialog.html](fragments/manager--orders-rollback-dialog.html) | oyna | v2 |
| `/orders` | registrator | `registrator-orders-list` — Buyurtmalar ro'yxati | [design/fragments/registrator--orders-list.html](fragments/registrator--orders-list.html) | sahifa | v2 |
| `/orders` | registrator | `registrator-orders-filters-mobile` — Buyurtmalar — filtr paneli (telefon)<br>↳ `src/pages/orders/list/OrderFilters.tsx` | [design/fragments/registrator--orders-filters-mobile.html](fragments/registrator--orders-filters-mobile.html) | oyna · faqat telefon | v2 |
| `/orders` | market | `market-orders-list` — Buyurtmalar ro'yxati | [design/fragments/market--orders-list.html](fragments/market--orders-list.html) | sahifa | v2 |
| `/orders` | courier | `courier-orders-pending` — Buyurtmalar — Kutilayotganlar<br>↳ `src/pages/orders/list/courier/index.tsx` | [design/fragments/courier--orders-pending.html](fragments/courier--orders-pending.html) | sahifa | v2 |
| `/orders` | courier | `courier-orders-tab-switcher-open` — Buyurtmalar — tab almashtirildi, yuklanmoqda<br>↳ `src/pages/orders/list/courier/list/tabs.tsx` | [design/fragments/courier--orders-tab-switcher-open.html](fragments/courier--orders-tab-switcher-open.html) | sahifa · faqat telefon | v2 |
| `/orders` | courier | `courier-orders-all` — Buyurtmalar — Hammasi<br>↳ `src/pages/orders/list/courier/index.tsx` | [design/fragments/courier--orders-all.html](fragments/courier--orders-all.html) | sahifa | v2 |
| `/orders` | courier | `courier-orders-cancelled` — Buyurtmalar — Bekor qilinganlar<br>↳ `src/pages/orders/list/courier/index.tsx` | [design/fragments/courier--orders-cancelled.html](fragments/courier--orders-cancelled.html) | sahifa | v2 |
| `/orders` | courier | `courier-orders-sell-dialog` — Sotish oynasi<br>↳ `src/pages/orders/list/courier/list/SellModal.tsx` | [design/fragments/courier--orders-sell-dialog.html](fragments/courier--orders-sell-dialog.html) | oyna | v2 |
| `/orders` | courier | `courier-orders-sell-extra-cost-dialog` — Sotish — qo'shimcha xarajat bilan<br>↳ `src/pages/orders/list/courier/list/SellModal.tsx` | [design/fragments/courier--orders-sell-extra-cost-dialog.html](fragments/courier--orders-sell-extra-cost-dialog.html) | oyna | v2 |
| `/orders` | courier | `courier-orders-sell-partial-dialog` — Qisman sotish oynasi<br>↳ `src/pages/orders/list/courier/list/SellModal.tsx` | [design/fragments/courier--orders-sell-partial-dialog.html](fragments/courier--orders-sell-partial-dialog.html) | oyna | v2 |
| `/orders` | courier | `courier-orders-action-approval-pending` — Market tasdig'i kutilmoqda<br>↳ `src/pages/orders/list/courier/list/SellModal.tsx` | [design/fragments/courier--orders-action-approval-pending.html](fragments/courier--orders-action-approval-pending.html) | oyna | v2 |
| `/orders` | courier | `courier-orders-cancel-dialog` — Bekor qilish oynasi<br>↳ `src/pages/orders/list/courier/list/CancelModal.tsx` | [design/fragments/courier--orders-cancel-dialog.html](fragments/courier--orders-cancel-dialog.html) | oyna | v2 |
| `/orders` | courier | `courier-orders-rollback-confirm` — Buyurtmani qaytarish tasdig'i<br>↳ `src/pages/orders/list/courier/list/RollbackOrderDialog.tsx` | [design/fragments/courier--orders-rollback-confirm.html](fragments/courier--orders-rollback-confirm.html) | oyna | v2 |
| `/orders` | tizim taxtasi | `tizim-states-data` — Holatlar — jadval, ro'yxat, kartalar | [design/fragments/tizim--states-data.html](fragments/tizim--states-data.html) | taxta | qoida |

#### `/orders/edit/:orderId` — Buyurtma tafsiloti va tahrirlash (alohida «detail» marshruti yo'q — tafsilot shu sahifa)

- **Fayllar:** `src/pages/new_orders/components/new_orderUpdate.tsx` · `src/pages/new_orders/components/detail/DetailHeader.tsx` · `src/pages/new_orders/components/detail/DetailAlerts.tsx` · `src/pages/new_orders/components/detail/CustomerCard.tsx` · `src/pages/new_orders/components/detail/AddressCard.tsx` · `src/pages/new_orders/components/detail/PaymentCard.tsx` · `src/pages/new_orders/components/detail/ProductsCard.tsx` · `src/pages/new_orders/components/detail/ProofCard.tsx` · `src/pages/new_orders/components/detail/CourierCards.tsx` · `src/pages/new_orders/components/detail/orderDetailAccess.ts` · `src/pages/new_orders/components/detail/orderDetailModel.ts` · `src/pages/new_orders/components/newOrderUpdateRules.ts` · `src/pages/new_orders/components/editDialogs/index.ts` · `src/pages/new_orders/components/editDialogs/EditAddressDialog.tsx` · `src/pages/new_orders/components/editDialogs/EditCustomerDialog.tsx` · `src/pages/new_orders/components/editDialogs/EditOrderDialog.tsx` · `src/widgets/order-tracking/ui/OrderTracking.tsx` · `src/features/order-tracking/ui/TrackingTimelineItem.tsx` · `src/entities/order/ui/ProofGallery.tsx` · `src/widgets/order-meta/ui/OrderMeta.tsx` · `src/pages/orders/list/courier/list/SellModal.tsx` · `src/pages/orders/list/courier/list/CancelModal.tsx` · `src/pages/orders/list/courier/list/RollbackOrderDialog.tsx` · `src/features/order-return/ui/InitiateReturnModal.tsx` · `src/features/order-return/ui/MarkReturnedModal.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewOrders` (access.ts → canViewOrders)
- **Rollar:** superadmin, admin, manager, registrator, market, courier
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Mijozni tahrirlash — faqat superadmin/admin; buyurtma va manzilni tahrirlash — superadmin/admin/registrator/menejer; market va kuryer — faqat o'qish. Sotish/bekor/qaytarish — REGIONAL · HYBRID menejeri. Ayni komponent /new-orders/:marketId/edit/:orderId da ham ishlatiladi.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/orders/edit/:orderId` | superadmin | `superadmin-orders-detail` — Buyurtma tafsilotlari | [design/fragments/superadmin--orders-detail.html](fragments/superadmin--orders-detail.html) | sahifa | v2 |
| `/orders/edit/:orderId` | superadmin | `superadmin-orders-detail-edit-order-dialog` — Buyurtmani tahrirlash (popup)<br>↳ `src/pages/new_orders/components/editDialogs/EditOrderDialog.tsx` | [design/fragments/superadmin--orders-detail-edit-order-dialog.html](fragments/superadmin--orders-detail-edit-order-dialog.html) | oyna | v2 |
| `/orders/edit/:orderId` | superadmin | `superadmin-orders-detail-edit-customer-dialog` — Mijoz ma'lumotini tahrirlash (popup)<br>↳ `src/pages/new_orders/components/editDialogs/EditCustomerDialog.tsx` | [design/fragments/superadmin--orders-detail-edit-customer-dialog.html](fragments/superadmin--orders-detail-edit-customer-dialog.html) | oyna | v2 |
| `/orders/edit/:orderId` | superadmin | `superadmin-orders-detail-edit-address-dialog` — Manzilni tahrirlash (popup)<br>↳ `src/pages/new_orders/components/editDialogs/EditAddressDialog.tsx` | [design/fragments/superadmin--orders-detail-edit-address-dialog.html](fragments/superadmin--orders-detail-edit-address-dialog.html) | oyna | v2 |
| `/orders/edit/:orderId` | admin | `admin-orders-detail` — Buyurtma tafsiloti | [design/fragments/admin--orders-detail.html](fragments/admin--orders-detail.html) | sahifa | v2 |
| `/orders/edit/:orderId` | admin | `admin-orders-edit-order-dialog` — Buyurtmani tahrirlash oynasi<br>↳ `src/pages/new_orders/components/editDialogs/EditOrderDialog.tsx` | [design/fragments/admin--orders-edit-order-dialog.html](fragments/admin--orders-edit-order-dialog.html) | oyna | v2 |
| `/orders/edit/:orderId` | admin | `admin-orders-edit-customer-dialog` — Mijozni tahrirlash oynasi<br>↳ `src/pages/new_orders/components/editDialogs/EditCustomerDialog.tsx` | [design/fragments/admin--orders-edit-customer-dialog.html](fragments/admin--orders-edit-customer-dialog.html) | oyna | v2 |
| `/orders/edit/:orderId` | admin | `admin-orders-edit-address-dialog` — Manzilni tahrirlash oynasi<br>↳ `src/pages/new_orders/components/editDialogs/EditAddressDialog.tsx` | [design/fragments/admin--orders-edit-address-dialog.html](fragments/admin--orders-edit-address-dialog.html) | oyna | v2 |
| `/orders/edit/:orderId` | manager | `manager-orders-detail` — Buyurtma tafsiloti | [design/fragments/manager--orders-detail.html](fragments/manager--orders-detail.html) | sahifa | v2 |
| `/orders/edit/:orderId` | manager | `manager-orders-detail-edit-address-dialog` — Manzilni tahrirlash oynasi<br>↳ `src/pages/new_orders/components/editDialogs/EditAddressDialog.tsx` | [design/fragments/manager--orders-detail-edit-address-dialog.html](fragments/manager--orders-detail-edit-address-dialog.html) | oyna | v2 |
| `/orders/edit/:orderId` | manager | `manager-orders-detail-edit-products-dialog` — Buyurtmani tahrirlash oynasi<br>↳ `src/pages/new_orders/components/editDialogs/EditOrderDialog.tsx` | [design/fragments/manager--orders-detail-edit-products-dialog.html](fragments/manager--orders-detail-edit-products-dialog.html) | oyna | v2 |
| `/orders/edit/:orderId` | manager | `manager-orders-sell-dialog` — Sotish oynasi<br>↳ `src/pages/orders/list/courier/list/SellModal.tsx` | [design/fragments/manager--orders-sell-dialog.html](fragments/manager--orders-sell-dialog.html) | oyna | v2 |
| `/orders/edit/:orderId` | manager | `manager-orders-cancel-dialog` — Bekor qilish oynasi<br>↳ `src/pages/orders/list/courier/list/CancelModal.tsx` | [design/fragments/manager--orders-cancel-dialog.html](fragments/manager--orders-cancel-dialog.html) | oyna | v2 |
| `/orders/edit/:orderId` | manager | `manager-orders-rollback-dialog` — Buyurtmani qaytarish tasdig'i<br>↳ `src/pages/orders/list/courier/list/RollbackOrderDialog.tsx` | [design/fragments/manager--orders-rollback-dialog.html](fragments/manager--orders-rollback-dialog.html) | oyna | v2 |
| `/orders/edit/:orderId` | registrator | `registrator-orders-detail` — Buyurtma tafsiloti | [design/fragments/registrator--orders-detail.html](fragments/registrator--orders-detail.html) | sahifa | v2 |
| `/orders/edit/:orderId` | registrator | `registrator-orders-detail-edit-order-dialog` — Buyurtmani tahrirlash oynasi<br>↳ `src/pages/new_orders/components/editDialogs/EditOrderDialog.tsx` | [design/fragments/registrator--orders-detail-edit-order-dialog.html](fragments/registrator--orders-detail-edit-order-dialog.html) | oyna | v2 |
| `/orders/edit/:orderId` | registrator | `registrator-orders-detail-edit-address-dialog` — Manzilni tahrirlash oynasi<br>↳ `src/pages/new_orders/components/editDialogs/EditAddressDialog.tsx` | [design/fragments/registrator--orders-detail-edit-address-dialog.html](fragments/registrator--orders-detail-edit-address-dialog.html) | oyna | v2 |
| `/orders/edit/:orderId` | market | `market-orders-detail` — Buyurtma tafsilotlari | [design/fragments/market--orders-detail.html](fragments/market--orders-detail.html) | sahifa | v2 |
| `/orders/edit/:orderId` | courier | `courier-orders-detail` — Buyurtma tafsilotlari | [design/fragments/courier--orders-detail.html](fragments/courier--orders-detail.html) | sahifa | v2 |

### Qabul va yaratish

#### `/new-orders` — Qabul va yaratish — tablar (layout) + Marketlar tabi

- **Fayllar:** `src/pages/new_orders/markets/index.tsx` · `src/pages/new_orders/index.tsx` · `src/pages/new_orders/ui/NewOrdersHeader.tsx` · `src/pages/new_orders/ui/NewOrdersTabs.tsx`
- **Qobiq:** DashboardLayout › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market
- **Menyuda:** «Qabul va yaratish» (`newOrders`) — superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market
- **Holat:** v2
- **Izoh:** Qobiq (src/pages/new_orders/index.tsx, barcha /new-orders/* uchun) rejimi yo'lga qarab — model/newOrdersShell.ts: «Qabul va yaratish» sarlavhasi + «Buyurtma yaratish» havolasi (NewOrdersHeader.tsx); tablar (Marketlar · Kiruvchi posilkalar · Filial paketlari · Bekor qilinganlar, sonlari bilan; market — Yangi buyurtmalar · Bekor qilinganlar) bola sahifaning birinchi kartasida (NewOrdersTabs.tsx). Bitta tabli rol (menejer, HQ bo'lmagan registrator) — tablar o'rnida karta sarlavhasi «Marketlar».

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders` | superadmin | `superadmin-neworders-markets` — Qabul va yaratish — Marketlar | [design/fragments/superadmin--neworders-markets.html](fragments/superadmin--neworders-markets.html) | sahifa | v2 |
| `/new-orders` | admin | `admin-neworders-markets` — Qabul — Marketlar tabi | [design/fragments/admin--neworders-markets.html](fragments/admin--neworders-markets.html) | sahifa | v2 |
| `/new-orders` | manager | `manager-new-orders-markets` — Qabul va yaratish — Marketlar | [design/fragments/manager--new-orders-markets.html](fragments/manager--new-orders-markets.html) | sahifa | v2 |
| `/new-orders` | registrator | `registrator-new-orders-markets` — Qabul va yaratish — Marketlar | [design/fragments/registrator--new-orders-markets.html](fragments/registrator--new-orders-markets.html) | sahifa | v2 |
| `/new-orders` | market | — Market /new-orders/:marketId (o'z marketi) ga yo'naltiriladi — o'sha route'ga qarang. | — | — | v2 |

#### `/new-orders/create` — Buyurtma yaratish — qo'lda (market → mijoz va mahsulot) yoki AI bilan

- **Fayllar:** `src/pages/orders/create/index.tsx` · `src/pages/orders/create/ui/CreateModeTabs.tsx` · `src/pages/orders/create/ui/OrderStepper.tsx` · `src/pages/orders/create/ui/Step1Market.tsx` · `src/pages/orders/create/ui/MarketPicker.tsx` · `src/pages/orders/create/ui/Step2Combined.tsx` · `src/pages/orders/create/ui/Step2Summary.tsx` · `src/pages/orders/create/ui/TodayOrdersCard.tsx` · `src/pages/orders/create/ui/CreateAlert.tsx` · `src/pages/orders/create/ui/ai/AiCreatePanel.tsx` · `src/pages/orders/create/ui/ai/AiInputPanel.tsx` · `src/pages/orders/create/ui/ai/AiPreviewCard.tsx` · `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` · `src/pages/orders/create/ui/ai/AiCreatedList.tsx` · `src/pages/orders/create/model/orderCreateForm.ts`
- **Qobiq:** DashboardLayout › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market
- **Menyuda:** yo'q — «Buyurtma yaratish» tugmasi (/new-orders sarlavhasi, market bosh sahifasi, market yangi buyurtmalari)
- **Holat:** v2
- **Izoh:** Market rolida 1-qadam (market tanlash) yo'q — forma darhol 2-qadamdan ochiladi. Market tanlash oynasi — MarketPicker.tsx (Step1Market.tsx ochadi); 2-qadam o'ng ustuni — Step2Summary.tsx + TodayOrdersCard.tsx; AI tasdiqlash oynasi — AiConfirmBar.tsx. «Oldingi» / «O'zgartirish» 1-qadamga qaytaradi (market va forma saqlanadi).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/create` | superadmin | `superadmin-neworders-create-manual-step1` — Buyurtma yaratish — 1-qadam: Market<br>↳ `src/pages/orders/create/ui/Step1Market.tsx` | [design/fragments/superadmin--neworders-create-manual-step1.html](fragments/superadmin--neworders-create-manual-step1.html) | sahifa | v2 |
| `/new-orders/create` | superadmin | `superadmin-neworders-create-market-picker-dialog` — Market tanlash (modal)<br>↳ `src/pages/orders/create/ui/MarketPicker.tsx` | [design/fragments/superadmin--neworders-create-market-picker-dialog.html](fragments/superadmin--neworders-create-market-picker-dialog.html) | oyna | v2 |
| `/new-orders/create` | superadmin | `superadmin-neworders-create-manual-step2` — Buyurtma yaratish — 2-qadam: Mijoz va mahsulot<br>↳ `src/pages/orders/create/ui/Step2Combined.tsx` | [design/fragments/superadmin--neworders-create-manual-step2.html](fragments/superadmin--neworders-create-manual-step2.html) | sahifa | v2 |
| `/new-orders/create` | superadmin | `superadmin-neworders-create-ai-input` — Buyurtma yaratish — AI bilan (kiritish)<br>↳ `src/pages/orders/create/ui/ai/AiInputPanel.tsx` | [design/fragments/superadmin--neworders-create-ai-input.html](fragments/superadmin--neworders-create-ai-input.html) | sahifa | v2 |
| `/new-orders/create` | superadmin | `superadmin-neworders-create-ai-preview` — Buyurtma yaratish — AI natijalari (preview)<br>↳ `src/pages/orders/create/ui/ai/AiPreviewCard.tsx` | [design/fragments/superadmin--neworders-create-ai-preview.html](fragments/superadmin--neworders-create-ai-preview.html) | sahifa | v2 |
| `/new-orders/create` | superadmin | `superadmin-neworders-create-ai-confirm-dialog` — AI — yaratishni tasdiqlash<br>↳ `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | [design/fragments/superadmin--neworders-create-ai-confirm-dialog.html](fragments/superadmin--neworders-create-ai-confirm-dialog.html) | oyna | v2 |
| `/new-orders/create` | admin | `admin-neworders-create-manual` — Buyurtma yaratish — Qo'lda | [design/fragments/admin--neworders-create-manual.html](fragments/admin--neworders-create-manual.html) | sahifa | v2 |
| `/new-orders/create` | admin | `admin-neworders-create-market-picker` — Market tanlash oynasi<br>↳ `src/pages/orders/create/ui/MarketPicker.tsx` | [design/fragments/admin--neworders-create-market-picker.html](fragments/admin--neworders-create-market-picker.html) | oyna | v2 |
| `/new-orders/create` | admin | `admin-neworders-create-ai` — Buyurtma yaratish — AI bilan | [design/fragments/admin--neworders-create-ai.html](fragments/admin--neworders-create-ai.html) | sahifa | v2 |
| `/new-orders/create` | admin | `admin-neworders-create-ai-confirm-dialog` — AI yaratishni tasdiqlash<br>↳ `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | [design/fragments/admin--neworders-create-ai-confirm-dialog.html](fragments/admin--neworders-create-ai-confirm-dialog.html) | oyna | v2 |
| `/new-orders/create` | manager | `manager-new-orders-create-manual-step1` — Buyurtma yaratish — market tanlash<br>↳ `src/pages/orders/create/ui/Step1Market.tsx` | [design/fragments/manager--new-orders-create-manual-step1.html](fragments/manager--new-orders-create-manual-step1.html) | sahifa | v2 |
| `/new-orders/create` | manager | `manager-new-orders-create-manual-step2` — Buyurtma yaratish — ma'lumotlar<br>↳ `src/pages/orders/create/ui/Step2Combined.tsx` | [design/fragments/manager--new-orders-create-manual-step2.html](fragments/manager--new-orders-create-manual-step2.html) | sahifa | v2 |
| `/new-orders/create` | manager | `manager-new-orders-create-ai` — Buyurtma yaratish — AI bilan | [design/fragments/manager--new-orders-create-ai.html](fragments/manager--new-orders-create-ai.html) | sahifa | v2 |
| `/new-orders/create` | manager | `manager-new-orders-create-ai-confirm-dialog` — AI buyurtmalarni tasdiqlash<br>↳ `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | [design/fragments/manager--new-orders-create-ai-confirm-dialog.html](fragments/manager--new-orders-create-ai-confirm-dialog.html) | oyna | v2 |
| `/new-orders/create` | registrator | `registrator-new-orders-create-step1` — Buyurtma yaratish — market tanlash<br>↳ `src/pages/orders/create/ui/Step1Market.tsx` | [design/fragments/manager--new-orders-create-manual-step1.html](fragments/manager--new-orders-create-manual-step1.html) | sahifa | v2 |
| `/new-orders/create` | registrator | `registrator-new-orders-create-market-picker-dialog` — Buyurtma yaratish — market tanlash oynasi<br>↳ `src/pages/orders/create/ui/MarketPicker.tsx` | [design/fragments/registrator--new-orders-create-market-picker-dialog.html](fragments/registrator--new-orders-create-market-picker-dialog.html) | oyna | v2 |
| `/new-orders/create` | registrator | `registrator-new-orders-create-step2` — Buyurtma yaratish — qo'lda forma<br>↳ `src/pages/orders/create/ui/Step2Combined.tsx` | [design/fragments/registrator--new-orders-create-step2.html](fragments/registrator--new-orders-create-step2.html) | sahifa | v2 |
| `/new-orders/create` | registrator | `registrator-new-orders-create-ai` — Buyurtma yaratish — AI rejimi | [design/fragments/registrator--new-orders-create-ai.html](fragments/registrator--new-orders-create-ai.html) | sahifa | v2 |
| `/new-orders/create` | registrator | `registrator-new-orders-create-ai-confirm-dialog` — AI buyurtmalarni tasdiqlash<br>↳ `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | [design/fragments/manager--new-orders-create-ai-confirm-dialog.html](fragments/manager--new-orders-create-ai-confirm-dialog.html) | oyna | v2 |
| `/new-orders/create` | market | `market-new-orders-create-manual` — Buyurtma yaratish · Qo'lda<br>↳ `src/pages/orders/create/ui/Step2Combined.tsx` | [design/fragments/market--new-orders-create-manual.html](fragments/market--new-orders-create-manual.html) | sahifa | v2 |
| `/new-orders/create` | market | `market-new-orders-create-ai-input` — Buyurtma yaratish · AI kiritish<br>↳ `src/pages/orders/create/ui/ai/AiInputPanel.tsx` | [design/fragments/market--new-orders-create-ai-input.html](fragments/market--new-orders-create-ai-input.html) | sahifa | v2 |
| `/new-orders/create` | market | `market-new-orders-create-ai-preview` — Buyurtma yaratish · AI natijalari<br>↳ `src/pages/orders/create/ui/ai/AiPreviewCard.tsx` | [design/fragments/market--new-orders-create-ai-preview.html](fragments/market--new-orders-create-ai-preview.html) | sahifa | v2 |
| `/new-orders/create` | market | `market-new-orders-create-ai-confirm-dialog` — AI · Yaratishni tasdiqlash<br>↳ `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | [design/fragments/market--new-orders-create-ai-confirm-dialog.html](fragments/market--new-orders-create-ai-confirm-dialog.html) | oyna | v2 |

#### `/new-orders/incoming` — Kiruvchi posilkalar — manba tanlash

- **Fayllar:** `src/pages/incoming-orders/SourcePicker.tsx` · `src/pages/incoming-orders/lib.ts` · `src/pages/incoming-orders/ui/SourcesSummary.tsx` · `src/pages/incoming-orders/ui/SourcesTable.tsx` · `src/pages/incoming-orders/ui/sourceVisuals.tsx` · `src/pages/incoming-orders/ui/sourceFormat.ts` · `src/pages/incoming-orders/ui/IdleSources.tsx`
- **Qobiq:** DashboardLayout › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) → `canManageExternalIntegrations` (access.ts → canReceiveExternalOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/incoming` | superadmin | `superadmin-neworders-incoming-sources` — Kiruvchi posilkalar — manba tanlash | [design/fragments/superadmin--neworders-incoming-sources.html](fragments/superadmin--neworders-incoming-sources.html) | sahifa | v2 |
| `/new-orders/incoming` | admin | `admin-neworders-incoming-sources` — Kiruvchi posilkalar — manba tanlash | [design/fragments/admin--neworders-incoming-sources.html](fragments/admin--neworders-incoming-sources.html) | sahifa | v2 |
| `/new-orders/incoming` | manager | `manager-new-orders-incoming-sources` — Kiruvchi posilkalar — manba tanlash | [design/fragments/manager--new-orders-incoming-sources.html](fragments/manager--new-orders-incoming-sources.html) | sahifa | v2 |
| `/new-orders/incoming` | registrator | — Maket yo'q (tab faqat admin/superadmin'ga ko'rinadi, URL ochiq) — admin-neworders-incoming-sources ga qarang. | — | — | v2 |

#### `/new-orders/incoming/:marketId` — Kiruvchi posilkalarni skanerlab qabul qilish (tanlangan manba)

- **Fayllar:** `src/pages/incoming-orders/index.tsx` · `src/pages/incoming-orders/lib.ts` · `src/pages/incoming-orders/ui/ScanInput.tsx` · `src/pages/incoming-orders/ui/ScanMessage.tsx` · `src/pages/incoming-orders/ui/IncomingTable.tsx`
- **Qobiq:** DashboardLayout › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) → `canManageExternalIntegrations` (access.ts → canReceiveExternalOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/incoming/:marketId` | superadmin | `superadmin-neworders-incoming-scan` — Kiruvchi posilkalar — skanerlab qabul | [design/fragments/superadmin--neworders-incoming-scan.html](fragments/superadmin--neworders-incoming-scan.html) | sahifa | v2 |
| `/new-orders/incoming/:marketId` | superadmin | `superadmin-neworders-incoming-scan-camera` — Kiruvchi posilkalar — skanerlab qabul — kamera | [design/fragments/superadmin--neworders-incoming-scan-camera.html](fragments/superadmin--neworders-incoming-scan-camera.html) | oyna | yangi (kodda yo'q) |
| `/new-orders/incoming/:marketId` | admin | `admin-neworders-incoming-scan` — Kiruvchi posilkalarni skanerlash | [design/fragments/admin--neworders-incoming-scan.html](fragments/admin--neworders-incoming-scan.html) | sahifa | v2 |
| `/new-orders/incoming/:marketId` | admin | `admin-neworders-incoming-scan-camera` — Kiruvchi posilkalarni skanerlash — kamera | [design/fragments/superadmin--neworders-incoming-scan-camera.html](fragments/superadmin--neworders-incoming-scan-camera.html) | oyna | yangi (kodda yo'q) |
| `/new-orders/incoming/:marketId` | manager | `manager-new-orders-incoming-scan` — Kiruvchi posilkalar — skanerlash | [design/fragments/manager--new-orders-incoming-scan.html](fragments/manager--new-orders-incoming-scan.html) | sahifa | v2 |
| `/new-orders/incoming/:marketId` | manager | `manager-new-orders-incoming-scan-camera` — Kiruvchi posilkalar — skanerlash — kamera | [design/fragments/manager--new-orders-incoming-scan-camera.html](fragments/manager--new-orders-incoming-scan-camera.html) | oyna | yangi (kodda yo'q) |
| `/new-orders/incoming/:marketId` | registrator | — Maket yo'q — admin-neworders-incoming-scan ga qarang. | — | — | v2 |
| `/new-orders/incoming/:marketId` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

#### `/new-orders/branches` — Filial paketlari — filiallar

- **Fayllar:** `src/pages/new_orders/branches/index.tsx` · `src/pages/new_orders/ui/SourceListCard.tsx` · `src/pages/new_orders/branches/branchBatchesModel.ts`
- **Qobiq:** DashboardLayout › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) → `canViewAdminNewOrderTabs` (routes.tsx → canViewAdminNewOrderTabs)
- **Rollar:** superadmin, admin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/branches` | superadmin | `superadmin-neworders-branches` — Filial batchlari — filiallar | [design/fragments/superadmin--neworders-branches.html](fragments/superadmin--neworders-branches.html) | sahifa | v2 |
| `/new-orders/branches` | admin | `admin-neworders-branches` — Filial batchlari tabi | [design/fragments/admin--neworders-branches.html](fragments/admin--neworders-branches.html) | sahifa | v2 |

#### `/new-orders/branches/:branchId` — Filial paketlari ro'yxati

- **Fayllar:** `src/pages/new_orders/branches/batches.tsx` · `src/shared/ui/SelectionRegion.tsx` · `src/pages/new_orders/branches/branchBatchesModel.ts`
- **Qobiq:** DashboardLayout › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) → `canViewAdminNewOrderTabs` (routes.tsx → canViewAdminNewOrderTabs)
- **Rollar:** superadmin, admin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/branches/:branchId` | superadmin | `superadmin-neworders-branch-batches` — Filial batchlari ro'yxati | [design/fragments/superadmin--neworders-branch-batches.html](fragments/superadmin--neworders-branch-batches.html) | sahifa | v2 |
| `/new-orders/branches/:branchId` | admin | `admin-neworders-branch-batches` — Filial batchlari ro'yxati | [design/fragments/superadmin--neworders-branch-batches.html](fragments/superadmin--neworders-branch-batches.html) | sahifa | v2 |

#### `/new-orders/branches/:branchId/batches/:batchId` — Filial paketi tafsiloti (qabul)

- **Fayllar:** `src/pages/new_orders/branches/batchDetail.tsx` · `src/shared/ui/SelectionRegion.tsx` · `src/pages/new_orders/branches/branchBatchesModel.ts`
- **Qobiq:** DashboardLayout › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) → `canViewAdminNewOrderTabs` (routes.tsx → canViewAdminNewOrderTabs)
- **Rollar:** superadmin, admin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/branches/:branchId/batches/:batchId` | superadmin | `superadmin-neworders-branch-batch-detail` — Filial paketi tafsiloti | [design/fragments/superadmin--neworders-branch-batch-detail.html](fragments/superadmin--neworders-branch-batch-detail.html) | sahifa | v2 |
| `/new-orders/branches/:branchId/batches/:batchId` | superadmin | `superadmin-neworders-branch-batch-detail-camera` — Filial paketi tafsiloti — kamera | [design/fragments/superadmin--neworders-branch-batch-detail-camera.html](fragments/superadmin--neworders-branch-batch-detail-camera.html) | oyna | yangi (kodda yo'q) |
| `/new-orders/branches/:branchId/batches/:batchId` | admin | `admin-neworders-branch-batch-detail` — Filial paketi tafsiloti | [design/fragments/superadmin--neworders-branch-batch-detail.html](fragments/superadmin--neworders-branch-batch-detail.html) | sahifa | v2 |
| `/new-orders/branches/:branchId/batches/:batchId` | admin | `admin-neworders-branch-batch-detail-camera` — Filial paketi tafsiloti — kamera | [design/fragments/superadmin--neworders-branch-batch-detail-camera.html](fragments/superadmin--neworders-branch-batch-detail-camera.html) | oyna | yangi (kodda yo'q) |
| `/new-orders/branches/:branchId/batches/:batchId` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

#### `/new-orders/cancelled` — Bekor qilinganlar — marketlar

- **Fayllar:** `src/pages/new_orders/cancelled/index.tsx` · `src/pages/new_orders/ui/SourceListCard.tsx` · `src/pages/new_orders/cancelled/utils.ts`
- **Qobiq:** DashboardLayout › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) → `canHandoverCancelledToMarket` (access.ts → canHandoverCancelledToMarket)
- **Rollar:** superadmin, admin, registrator (faqat HQ)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/cancelled` | superadmin | `superadmin-neworders-cancelled-markets` — Bekor qilinganlar — marketlar | [design/fragments/superadmin--neworders-cancelled-markets.html](fragments/superadmin--neworders-cancelled-markets.html) | sahifa | v2 |
| `/new-orders/cancelled` | admin | `admin-neworders-cancelled` — Bekor qilinganlar tabi | [design/fragments/admin--neworders-cancelled.html](fragments/admin--neworders-cancelled.html) | sahifa | v2 |
| `/new-orders/cancelled` | registrator | `registrator-new-orders-cancelled` — Bekor qilinganlar — marketlar (HQ) | [design/fragments/registrator--new-orders-cancelled.html](fragments/registrator--new-orders-cancelled.html) | sahifa | v2 |

#### `/new-orders/cancelled/:marketId` — Bekor qilinganlarni marketga topshirish (market rolida — o'z bekorlari va QR kod)

- **Fayllar:** `src/pages/new_orders/cancelled/detail.tsx` · `src/pages/new_orders/cancelled/cancelledModel.ts` · `src/pages/new_orders/cancelled/ui/HandoverStatusAlert.tsx` · `src/pages/new_orders/cancelled/ui/CancelledOrdersTable.tsx` · `src/pages/new_orders/cancelled/ui/ManualConfirmDialog.tsx` · `src/pages/new_orders/cancelled/ui/MarketQrDialog.tsx` · `src/shared/ui/SelectionRegion.tsx` · `src/pages/new_orders/cancelled/utils.ts` · `src/shared/components/ScannerCameraModal.tsx` · `src/app/lib/routes.tsx`
- **Qobiq:** DashboardLayout › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) · o'rovchi: `NewOrdersCancelledDetailEntry`
- **Rollar:** superadmin, admin, registrator (faqat HQ), market (faqat o'z marketi)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Kirish NewOrdersCancelledDetailEntry (routes.tsx) da: canHandoverCancelledToMarket yoki o'z marketi; boshqalar → /403. Qobiq: xodimda `bare` (o'z sarlavhasi), marketda `hosted` (tablar kartada). Marketga jo'natish faqat market QR skanerlangach (marketda QR o'chirilgan bo'lmasa); buzilgan buyurtma QR — «QR buzilganini tasdiqlash» oynasi (sabab — backend enum kodi). Kamera rejimi (`*-camera`) — keyinroq, `ScannerCameraModal` o'zgarmagan.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/cancelled/:marketId` | superadmin | `superadmin-neworders-cancelled-handover` — Bekor qilinganlarni marketga topshirish | [design/fragments/superadmin--neworders-cancelled-handover.html](fragments/superadmin--neworders-cancelled-handover.html) | sahifa | v2 |
| `/new-orders/cancelled/:marketId` | superadmin | `superadmin-neworders-cancelled-handover-camera` — Bekor qilinganlarni marketga topshirish — kamera<br>↳ `src/shared/components/ScannerCameraModal.tsx` | [design/fragments/superadmin--neworders-cancelled-handover-camera.html](fragments/superadmin--neworders-cancelled-handover-camera.html) | oyna | qisman |
| `/new-orders/cancelled/:marketId` | superadmin | `superadmin-neworders-cancelled-manual-dialog` — QR buzilganini tasdiqlash (modal)<br>↳ `src/pages/new_orders/cancelled/ui/ManualConfirmDialog.tsx` | [design/fragments/superadmin--neworders-cancelled-manual-dialog.html](fragments/superadmin--neworders-cancelled-manual-dialog.html) | oyna | v2 |
| `/new-orders/cancelled/:marketId` | superadmin | `superadmin-neworders-cancelled-scanner-dialog` — Kamera skaneri (modal) | [design/fragments/superadmin--neworders-cancelled-scanner-dialog.html](fragments/superadmin--neworders-cancelled-scanner-dialog.html) | oyna | qisman |
| `/new-orders/cancelled/:marketId` | admin | `admin-neworders-cancelled-detail` — Bekor qilinganlarni marketga topshirish | [design/fragments/admin--neworders-cancelled-detail.html](fragments/admin--neworders-cancelled-detail.html) | sahifa | v2 |
| `/new-orders/cancelled/:marketId` | admin | `admin-neworders-cancelled-detail-camera` — Bekor qilinganlarni marketga topshirish — kamera<br>↳ `src/shared/components/ScannerCameraModal.tsx` | [design/fragments/admin--neworders-cancelled-detail-camera.html](fragments/admin--neworders-cancelled-detail-camera.html) | oyna | qisman |
| `/new-orders/cancelled/:marketId` | admin | `admin-neworders-cancelled-manual-dialog` — QR buzilganini tasdiqlash<br>↳ `src/pages/new_orders/cancelled/ui/ManualConfirmDialog.tsx` | [design/fragments/admin--neworders-cancelled-manual-dialog.html](fragments/admin--neworders-cancelled-manual-dialog.html) | oyna | v2 |
| `/new-orders/cancelled/:marketId` | admin | `admin-neworders-cancelled-scanner-dialog` — Market QR skaneri | [design/fragments/admin--neworders-cancelled-scanner-dialog.html](fragments/admin--neworders-cancelled-scanner-dialog.html) | oyna | qisman |
| `/new-orders/cancelled/:marketId` | registrator | `registrator-new-orders-cancelled-detail` — Bekor qilinganlarni marketga topshirish (HQ) | [design/fragments/registrator--new-orders-cancelled-detail.html](fragments/registrator--new-orders-cancelled-detail.html) | sahifa | v2 |
| `/new-orders/cancelled/:marketId` | registrator | `registrator-new-orders-cancelled-manual-dialog` — QR buzilganini tasdiqlash (HQ)<br>↳ `src/pages/new_orders/cancelled/ui/ManualConfirmDialog.tsx` | [design/fragments/registrator--new-orders-cancelled-manual-dialog.html](fragments/registrator--new-orders-cancelled-manual-dialog.html) | oyna | v2 |
| `/new-orders/cancelled/:marketId` | registrator | `registrator-new-orders-cancelled-scanner-dialog` — Market QR skanerlash (HQ) | [design/fragments/registrator--new-orders-cancelled-scanner-dialog.html](fragments/registrator--new-orders-cancelled-scanner-dialog.html) | oyna | qisman |
| `/new-orders/cancelled/:marketId` | market | `market-new-orders-cancelled` — Bekor qilinganlar | [design/fragments/market--new-orders-cancelled.html](fragments/market--new-orders-cancelled.html) | sahifa | v2 |
| `/new-orders/cancelled/:marketId` | market | `market-new-orders-cancelled-qr-dialog` — Bekor qilinganlar · QR kod<br>↳ `src/pages/new_orders/cancelled/ui/MarketQrDialog.tsx` | [design/fragments/market--new-orders-cancelled-qr-dialog.html](fragments/market--new-orders-cancelled-qr-dialog.html) | oyna | v2 |
| `/new-orders/cancelled/:marketId` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

#### `/new-orders/:marketId` — Market yangi buyurtmalari — qabul (market rolida: o'z yangi buyurtmalari)

- **Fayllar:** `src/pages/new_orders/components/new_orderDetail.tsx` · `src/pages/new_orders/components/newOrderReceiveRules.ts` · `src/pages/new_orders/components/lib/printLabelPdf.ts` · `src/pages/new_orders/components/marketOrders/MarketOrdersTable.tsx` · `src/pages/new_orders/components/marketOrders/SelectionBar.tsx` · `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` · `src/pages/new_orders/components/marketOrders/marketOrdersModel.ts` · `src/app/lib/routes.tsx`
- **Qobiq:** DashboardLayout › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) · o'rovchi: `NewOrdersMarketAccessEntry`
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market (faqat o'z marketi)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** NewOrdersMarketAccessEntry (routes.tsx): market faqat o'z marketId sini ochadi. Qabul/o'chirish tasdig'i — PopupConfirm. Tahrirlash → /new-orders/:marketId/edit/:orderId.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/:marketId` | superadmin | `superadmin-neworders-market-orders` — Market yangi buyurtmalari (qabul) | [design/fragments/superadmin--neworders-market-orders.html](fragments/superadmin--neworders-market-orders.html) | sahifa | v2 |
| `/new-orders/:marketId` | superadmin | `superadmin-neworders-market-orders-camera` — Market yangi buyurtmalari (qabul) — kamera | [design/fragments/superadmin--neworders-market-orders-camera.html](fragments/superadmin--neworders-market-orders-camera.html) | oyna | yangi (kodda yo'q) |
| `/new-orders/:marketId` | superadmin | `superadmin-neworders-receive-confirm-dialog` — Qo'lda qabul qilish (tasdiq)<br>↳ `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | [design/fragments/superadmin--neworders-receive-confirm-dialog.html](fragments/superadmin--neworders-receive-confirm-dialog.html) | oyna | v2 |
| `/new-orders/:marketId` | admin | `admin-neworders-market-detail` — Market yangi buyurtmalari | [design/fragments/admin--neworders-market-detail.html](fragments/admin--neworders-market-detail.html) | sahifa | v2 |
| `/new-orders/:marketId` | admin | `admin-neworders-market-detail-camera` — Market yangi buyurtmalari — kamera | [design/fragments/admin--neworders-market-detail-camera.html](fragments/admin--neworders-market-detail-camera.html) | oyna | yangi (kodda yo'q) |
| `/new-orders/:marketId` | admin | `admin-neworders-market-confirm-dialog` — Qabul tasdig'i / buyurtmani o'chirish<br>↳ `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | [design/fragments/admin--neworders-market-confirm-dialog.html](fragments/admin--neworders-market-confirm-dialog.html) | oyna | v2 |
| `/new-orders/:marketId` | manager | `manager-new-orders-market-detail` — Market buyurtmalari — qabul | [design/fragments/manager--new-orders-market-detail.html](fragments/manager--new-orders-market-detail.html) | sahifa | v2 |
| `/new-orders/:marketId` | manager | `manager-new-orders-market-detail-camera` — Market buyurtmalari — qabul — kamera | [design/fragments/manager--new-orders-market-detail-camera.html](fragments/manager--new-orders-market-detail-camera.html) | oyna | yangi (kodda yo'q) |
| `/new-orders/:marketId` | manager | `manager-new-orders-receive-confirm-dialog` — Qo'lda qabul qilish tasdig'i<br>↳ `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | [design/fragments/manager--new-orders-receive-confirm-dialog.html](fragments/manager--new-orders-receive-confirm-dialog.html) | oyna | v2 |
| `/new-orders/:marketId` | manager | `manager-new-orders-delete-confirm-dialog` — Buyurtmani o'chirish tasdig'i<br>↳ `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | [design/fragments/manager--new-orders-delete-confirm-dialog.html](fragments/manager--new-orders-delete-confirm-dialog.html) | oyna | v2 |
| `/new-orders/:marketId` | registrator | `registrator-new-orders-market-detail` — Market buyurtmalari — qabul | [design/fragments/registrator--new-orders-market-detail.html](fragments/registrator--new-orders-market-detail.html) | sahifa | qisman |
| `/new-orders/:marketId` | registrator | `registrator-new-orders-market-detail-camera` — Market buyurtmalari — qabul — kamera | [design/fragments/registrator--new-orders-market-detail-camera.html](fragments/registrator--new-orders-market-detail-camera.html) | oyna | yangi (kodda yo'q) |
| `/new-orders/:marketId` | registrator | `registrator-new-orders-market-detail-receive-dialog` — Qabul qilish tasdig'i<br>↳ `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | [design/fragments/registrator--new-orders-market-detail-receive-dialog.html](fragments/registrator--new-orders-market-detail-receive-dialog.html) | oyna | qisman |
| `/new-orders/:marketId` | registrator | `registrator-new-orders-market-detail-delete-dialog` — Buyurtmani o'chirish tasdig'i<br>↳ `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | [design/fragments/registrator--new-orders-market-detail-delete-dialog.html](fragments/registrator--new-orders-market-detail-delete-dialog.html) | oyna | v2 |
| `/new-orders/:marketId` | market | `market-new-orders-list` — Yangi buyurtmalar | [design/fragments/market--new-orders-list.html](fragments/market--new-orders-list.html) | sahifa | v2 |
| `/new-orders/:marketId` | market | `market-new-orders-delete-dialog` — Buyurtmani o'chirish<br>↳ `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | [design/fragments/market--new-orders-delete-dialog.html](fragments/market--new-orders-delete-dialog.html) | oyna | v2 |
| `/new-orders/:marketId` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

#### `/new-orders/:marketId/edit/:orderId` — Yangi buyurtmani tahrirlash (qabuldan oldin)

- **Fayllar:** `src/pages/new_orders/components/new_orderUpdate.tsx` · `src/pages/new_orders/components/newOrderUpdateRules.ts` · `src/app/lib/routes.tsx`
- **Qobiq:** DashboardLayout › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) · o'rovchi: `NewOrdersMarketAccessEntry`
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market (faqat o'z marketi)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/:marketId/edit/:orderId` | superadmin | `superadmin-neworders-market-order-edit` — Market buyurtmasini tahrirlash | [design/fragments/superadmin--neworders-market-order-edit.html](fragments/superadmin--neworders-market-order-edit.html) | sahifa | v2 |
| `/new-orders/:marketId/edit/:orderId` | admin | — Maket yo'q — superadmin-neworders-market-order-edit ga qarang. | — | — | v2 |
| `/new-orders/:marketId/edit/:orderId` | manager | — Maket yo'q — registrator-new-orders-market-order-edit ga qarang. | — | — | v2 |
| `/new-orders/:marketId/edit/:orderId` | registrator | `registrator-new-orders-market-order-edit` — Market buyurtmasini tahrirlash | [design/fragments/registrator--new-orders-market-order-edit.html](fragments/registrator--new-orders-market-order-edit.html) | sahifa | v2 |
| `/new-orders/:marketId/edit/:orderId` | market | `market-new-orders-edit` — Yangi buyurtma tafsiloti | [design/fragments/market--new-orders-edit.html](fragments/market--new-orders-edit.html) | sahifa | v2 |

#### `/new-orders/userDetail/:id` — Foydalanuvchi tafsiloti (eski havola, /new-orders ichida; dizayn v2)

- **Fayllar:** `src/pages/users/detail/UserDetailPage.tsx` · `src/widgets/user-detail/ui/UserDetailView.tsx` · `src/widgets/user-detail/ui/MarketTelegramTokenCard.tsx`
- **Qobiq:** DashboardLayout › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Alohida maket yo'q — <rol>-users-detail maketlari (superadmin-users-detail). /all-users/:id bilan bir xil v2 sahifa (UserDetailView); «Qabul va yaratish» qobig'i bu yo'lda bare — sarlavha va «Buyurtma yaratish» takrorlanmaydi (newOrdersShell.ts), «←» — navigate(-1).

### Pochta

#### `/mails` — Pochta — kirish nuqtasi

- **Fayllar:** `src/pages/mails/index.tsx` · `src/pages/mails/lib/navigation.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewMails` (access.ts → canViewMails)
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier
- **Menyuda:** «Pochta» (`mails`) — superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier
- **Holat:** v2
- **Izoh:** Komponent darhol /mails/today ga yo'naltiradi.

#### `/mails/today` — Pochta — Bugungi pochtalar

- **Fayllar:** `src/pages/mails/index.tsx` · `src/pages/mails/components/todaysMails.tsx` · `src/pages/mails/components/MailsListBody.tsx` · `src/pages/mails/components/MailsTable.tsx` · `src/pages/mails/components/MailSummaryStats.tsx` · `src/pages/mails/model/mailsLists.ts` · `src/pages/mails/model/mailsLayout.ts` · `src/pages/mails/components/lib/regionFilterOptions.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewMails` (access.ts → canViewMails)
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier
- **Menyuda:** «Pochta» (`mails`, `/mails` orqali) — superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier
- **Holat:** v2
- **Izoh:** Qobiq — src/pages/mails/index.tsx: xodimda sarlavha + bitta karta (sonli tablar «Bugungi · Qaytarish · Rad etilgan · Eski»; telefonda bo'lim tanlagichi — Select «Pochta bo'limi: …»), kuryerda tablar sahifa fonida («Qaytarish» yo'q; telefonda to'liq enli qisqa tablar — courier-mails-tab-switcher-open). Tab sonlari model/mailsLists.ts hooklaridan (tanalar bilan bir xil queryKey). Ega qarori 2026-10-17 (Pochta birxillashtirishi, barcha xodim rollarida maketlardan ustun): filtrlar — ichki yorliqli Select («Viloyat: …»); xulosa qatori barcha xodimlarda. «Kuryer» ustuni hozirgidek — faqat backend kuryer yuborsa (YANGI pochtada courier_id='0', post/new kuryer bermaydi).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/mails/today` | superadmin | `superadmin-mails-today` — Pochta — Bugungi pochtalar<br>↳ `src/pages/mails/components/todaysMails.tsx` | [design/fragments/superadmin--mails-today.html](fragments/superadmin--mails-today.html) | sahifa | v2 |
| `/mails/today` | admin | `admin-mails-today` — Pochta — Bugungi pochtalar<br>↳ `src/pages/mails/components/todaysMails.tsx` | [design/fragments/superadmin--mails-today.html](fragments/superadmin--mails-today.html) | sahifa | v2 |
| `/mails/today` | manager | `manager-mails-today` — Pochta — Bugungi pochtalar<br>↳ `src/pages/mails/components/todaysMails.tsx` | [design/fragments/manager--mails-today.html](fragments/manager--mails-today.html) | sahifa | v2 |
| `/mails/today` | registrator | `registrator-mails-today` — Pochta — Bugungi pochtalar<br>↳ `src/pages/mails/components/todaysMails.tsx` | [design/fragments/superadmin--mails-today.html](fragments/superadmin--mails-today.html) | sahifa | v2 |
| `/mails/today` | courier | `courier-mails-today` — Pochta — Bugungi<br>↳ `src/pages/mails/components/todaysMails.tsx` | [design/fragments/courier--mails-today.html](fragments/courier--mails-today.html) | sahifa | v2 |
| `/mails/today` | courier | `courier-mails-tab-switcher-open` — Pochta — tab tanlash ochiq | [design/fragments/courier--mails-tab-switcher-open.html](fragments/courier--mails-tab-switcher-open.html) | sahifa · faqat telefon | v2 |

#### `/mails/return` — Pochta — Qaytarish so'rovlari

- **Fayllar:** `src/pages/mails/index.tsx` · `src/pages/mails/components/returnMails.tsx` · `src/shared/ui/SelectionRegion.tsx` · `src/pages/mails/model/mailsLists.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewMails` (access.ts → canViewMails)
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Ega qarori 2026-10-17 (Pochta birxillashtirishi): «Qaytarish» tabida bitta doimiy tanlov paneli (0 ta — tugmalar o'chiq) — har kuryer guruhidagi alohida tugmalar o'rniga; xulosa qatori barcha xodimlarda. Maketdagi «Marketga» manzili chizilmaydi: backend faqat HQ/BRANCH doirasini beradi va tasdiq buyurtmani o'z omboriga qaytaradi.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/mails/return` | superadmin | `superadmin-mails-return` — Pochta — Qaytarish so'rovlari<br>↳ `src/pages/mails/components/returnMails.tsx` | [design/fragments/superadmin--mails-return.html](fragments/superadmin--mails-return.html) | sahifa | v2 |
| `/mails/return` | admin | `admin-mails-return` — Pochta — Qaytarish<br>↳ `src/pages/mails/components/returnMails.tsx` | [design/fragments/admin--mails-return.html](fragments/admin--mails-return.html) | sahifa | v2 |
| `/mails/return` | manager | `manager-mails-return` — Pochta — Qaytarish so'rovlari<br>↳ `src/pages/mails/components/returnMails.tsx` | [design/fragments/superadmin--mails-return.html](fragments/superadmin--mails-return.html) | sahifa | v2 |
| `/mails/return` | registrator | `registrator-mails-return` — Pochta — Qaytarish<br>↳ `src/pages/mails/components/returnMails.tsx` | [design/fragments/admin--mails-return.html](fragments/admin--mails-return.html) | sahifa | v2 |
| `/mails/return` | courier | — Kuryerda bu tab yo'q — /mails/today ga qaytariladi. | — | — | v2 |

#### `/mails/refused` — Pochta — Rad etilgan pochtalar

- **Fayllar:** `src/pages/mails/index.tsx` · `src/pages/mails/components/refusedMails.tsx` · `src/pages/mails/components/MailsListBody.tsx` · `src/pages/mails/components/MailsTable.tsx` · `src/pages/mails/components/MailSummaryStats.tsx` · `src/pages/mails/model/mailsLists.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewMails` (access.ts → canViewMails)
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Ega qarori 2026-10-17 (Pochta birxillashtirishi): xulosa qatori barcha xodimlarda; filtr qo'shilsa — ichki yorliqli Select.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/mails/refused` | superadmin | `superadmin-mails-refused` — Pochta — Rad etilgan pochtalar<br>↳ `src/pages/mails/components/refusedMails.tsx` | [design/fragments/superadmin--mails-refused.html](fragments/superadmin--mails-refused.html) | sahifa | v2 |
| `/mails/refused` | admin | `admin-mails-refused` — Pochta — Rad etilgan<br>↳ `src/pages/mails/components/refusedMails.tsx` | [design/fragments/admin--mails-refused.html](fragments/admin--mails-refused.html) | sahifa | v2 |
| `/mails/refused` | manager | `manager-mails-refused` — Pochta — Rad etilgan pochtalar<br>↳ `src/pages/mails/components/refusedMails.tsx` | [design/fragments/manager--mails-refused.html](fragments/manager--mails-refused.html) | sahifa | v2 |
| `/mails/refused` | registrator | `registrator-mails-refused` — Pochta — Rad etilgan pochtalar<br>↳ `src/pages/mails/components/refusedMails.tsx` | [design/fragments/superadmin--mails-refused.html](fragments/superadmin--mails-refused.html) | sahifa | v2 |
| `/mails/refused` | courier | `courier-mails-refused` — Pochta — Rad etilgan<br>↳ `src/pages/mails/components/refusedMails.tsx` | [design/fragments/courier--mails-refused.html](fragments/courier--mails-refused.html) | sahifa | v2 |

#### `/mails/old` — Pochta — Eski pochtalar (admin/superadmin: «Filial paketlari» rejimi)

- **Fayllar:** `src/pages/mails/index.tsx` · `src/pages/mails/components/oldMails.tsx` · `src/pages/mails/components/OldMailsFiltersSheet.tsx` · `src/pages/mails/components/MailsTable.tsx` · `src/pages/mails/model/oldMailsModel.ts` · `src/pages/mails/components/lib/exportOldMailsToExcel.ts` · `src/pages/mails/components/lib/regionFilterOptions.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewMails` (access.ts → canViewMails)
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Ega qarori 2026-10-17 (Pochta birxillashtirishi): filtrlar — ichki yorliqli Select («Viloyat: … · Kuryer: … · Holati: …») + sana oralig'i; «Excelga yuklash» karta asboblar qatorida (telefonda ikonka); xulosa qatori barcha xodimlarda; admin/superadmin — «Pochtalar | Filial paketlari» almashtirgichi (?batch_mode=all); paket qatori /batches/:id ni ochadi («← Eski pochtalar» filtrlar bilan). Filtr va sahifalash server tomonida (GET /post, GET /post/courier/old-posts — Trello YfrqN70i), Excel barcha filtrlangan qatorlarni 100 talab sahifalab oladi. Pochtalar xulosasi hozircha faqat «N ta pochta» (API buyurtma/summa yig'indisini bermaydi — egaga savol Q1). «Filial paketlari» — GET transfer-batches ning barcha sahifalari (fetchAllTransferBatches), filtr mijoz tomonida.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/mails/old` | superadmin | `superadmin-mails-old` — Pochta — Eski pochtalar<br>↳ `src/pages/mails/components/oldMails.tsx` | [design/fragments/superadmin--mails-old.html](fragments/superadmin--mails-old.html) | sahifa | v2 |
| `/mails/old` | superadmin | `superadmin-mails-old-batches` — Pochta — Hamma batchlar (eski)<br>↳ `src/pages/mails/components/oldMails.tsx` | [design/fragments/superadmin--mails-old-batches.html](fragments/superadmin--mails-old-batches.html) | sahifa | v2 |
| `/mails/old` | admin | `admin-mails-old` — Pochta — Eski pochtalar<br>↳ `src/pages/mails/components/oldMails.tsx` | [design/fragments/admin--mails-old.html](fragments/admin--mails-old.html) | sahifa | v2 |
| `/mails/old` | admin | `admin-mails-old-all-batches` — Eski pochtalar — Hamma batchlar<br>↳ `src/pages/mails/components/oldMails.tsx` | [design/fragments/admin--mails-old-all-batches.html](fragments/admin--mails-old-all-batches.html) | sahifa | v2 |
| `/mails/old` | manager | `manager-mails-old` — Pochta — Eski pochtalar<br>↳ `src/pages/mails/components/oldMails.tsx` | [design/fragments/manager--mails-old.html](fragments/manager--mails-old.html) | sahifa | v2 |
| `/mails/old` | registrator | `registrator-mails-old` — Pochta — Eski pochtalar<br>↳ `src/pages/mails/components/oldMails.tsx` | [design/fragments/registrator--mails-old.html](fragments/registrator--mails-old.html) | sahifa | v2 |
| `/mails/old` | courier | `courier-mails-old` — Pochta — Eski<br>↳ `src/pages/mails/components/oldMails.tsx` | [design/fragments/courier--mails-old.html](fragments/courier--mails-old.html) | sahifa | v2 |

#### `/mails/:id` — Pochta tafsiloti — jo'natish / qabul qilish / rad etilgan / tarix

- **Fayllar:** `src/pages/mails/detail/index.tsx` · `src/pages/mails/detail/model/useMailDetailState.ts` · `src/pages/mails/detail/model/useOrderRowView.tsx` · `src/pages/mails/detail/ui/MailStatCards.tsx` · `src/pages/mails/detail/ui/OrdersTable.tsx` · `src/pages/mails/detail/ui/OrderRow.tsx` · `src/pages/mails/detail/ui/SendButton.tsx` · `src/pages/mails/detail/ui/SendPostModal.tsx` · `src/pages/mails/detail/ui/DeleteFromPostDialog.tsx` · `src/pages/mails/detail/ui/printOptions.tsx` · `src/pages/mails/detail/lib/printMode.ts` · `src/pages/mails/detail/lib/scanMatch.ts` · `src/shared/ui/SelectionRegion.tsx` · `src/shared/components/PrintModeSelect.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewMails` (access.ts → canViewMails)
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Rejim URL'dan: ?type=refused → rad etilgan, ?view=old → tarix (faqat o'qish), ?view=old-all-batches → eski pochtalarning «Filial paketlari» rejimidan ochilgan tarix (admin/superadmin; *-mails-detail-old / admin-mails-old-detail maketi). «Filialga jo'natish» oynasi faqat superadmin/admin/HQ registrator (canDispatchPostToBranch). Chop etish menyusi — PrintModeSelect.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/mails/:id` | superadmin | `superadmin-mails-detail` — Pochta tafsiloti (jo'natish) | [design/fragments/superadmin--mails-detail.html](fragments/superadmin--mails-detail.html) | sahifa | v2 |
| `/mails/:id` | superadmin | `superadmin-mails-detail-camera` — Pochta tafsiloti (jo'natish) — kamera | [design/fragments/superadmin--mails-detail-camera.html](fragments/superadmin--mails-detail-camera.html) | oyna | qisman |
| `/mails/:id` | superadmin | `superadmin-mails-detail-send-dialog` — Pochtani filialga jo'natish (modal)<br>↳ `src/pages/mails/detail/ui/SendPostModal.tsx` | [design/fragments/superadmin--mails-detail-send-dialog.html](fragments/superadmin--mails-detail-send-dialog.html) | oyna | v2 |
| `/mails/:id` | superadmin | `superadmin-mails-detail-refused` — Rad etilgan pochta tafsiloti (qabul) | [design/fragments/superadmin--mails-detail-refused.html](fragments/superadmin--mails-detail-refused.html) | sahifa | v2 |
| `/mails/:id` | superadmin | `superadmin-mails-detail-old` — Eski pochta tafsiloti (faqat o'qish) | [design/fragments/superadmin--mails-detail-old.html](fragments/superadmin--mails-detail-old.html) | sahifa | v2 |
| `/mails/:id` | admin | `admin-mails-detail` — Pochta tafsiloti | [design/fragments/admin--mails-detail.html](fragments/admin--mails-detail.html) | sahifa | v2 |
| `/mails/:id` | admin | `admin-mails-detail-camera` — Pochta tafsiloti — kamera | [design/fragments/superadmin--mails-detail-camera.html](fragments/superadmin--mails-detail-camera.html) | oyna | qisman |
| `/mails/:id` | admin | `admin-mails-send-branch-dialog` — Pochtani filialga jo'natish<br>↳ `src/pages/mails/detail/ui/SendPostModal.tsx` | [design/fragments/admin--mails-send-branch-dialog.html](fragments/admin--mails-send-branch-dialog.html) | oyna | v2 |
| `/mails/:id` | admin | `admin-mails-refused-detail` — Rad etilgan pochta tafsiloti | [design/fragments/admin--mails-refused-detail.html](fragments/admin--mails-refused-detail.html) | sahifa | v2 |
| `/mails/:id` | admin | `admin-mails-old-detail` — Eski pochta tafsiloti (tarix) | [design/fragments/admin--mails-old-detail.html](fragments/admin--mails-old-detail.html) | sahifa | v2 |
| `/mails/:id` | manager | `manager-mails-detail-receive` — Pochta tafsiloti — qabul qilish | [design/fragments/manager--mails-detail-receive.html](fragments/manager--mails-detail-receive.html) | sahifa | v2 |
| `/mails/:id` | manager | `manager-mails-detail-receive-camera` — Pochta tafsiloti — qabul qilish — kamera | [design/fragments/manager--mails-detail-receive-camera.html](fragments/manager--mails-detail-receive-camera.html) | oyna | qisman |
| `/mails/:id` | manager | `manager-mails-detail-refused-receive` — Rad etilgan pochta — qabul | [design/fragments/manager--mails-detail-refused-receive.html](fragments/manager--mails-detail-refused-receive.html) | sahifa | v2 |
| `/mails/:id` | manager | `manager-mails-detail-old` — Eski pochta tafsiloti (tarix) | [design/fragments/admin--mails-old-detail.html](fragments/admin--mails-old-detail.html) | sahifa | v2 |
| `/mails/:id` | registrator | `registrator-mails-detail` — Pochta tafsiloti — bugungi | [design/fragments/registrator--mails-detail.html](fragments/registrator--mails-detail.html) | sahifa | v2 |
| `/mails/:id` | registrator | `registrator-mails-detail-camera` — Pochta tafsiloti — bugungi — kamera | [design/fragments/registrator--mails-detail-camera.html](fragments/registrator--mails-detail-camera.html) | oyna | qisman |
| `/mails/:id` | registrator | `registrator-mails-detail-send-dialog` — Pochtani filialga jo'natish (HQ)<br>↳ `src/pages/mails/detail/ui/SendPostModal.tsx` | [design/fragments/registrator--mails-detail-send-dialog.html](fragments/registrator--mails-detail-send-dialog.html) | oyna | v2 |
| `/mails/:id` | registrator | `registrator-mails-detail-refused` — Pochta tafsiloti — rad etilgan | [design/fragments/registrator--mails-detail-refused.html](fragments/registrator--mails-detail-refused.html) | sahifa | v2 |
| `/mails/:id` | registrator | `registrator-mails-detail-old` — Pochta tafsiloti — tarix | [design/fragments/registrator--mails-detail-old.html](fragments/registrator--mails-detail-old.html) | sahifa | v2 |
| `/mails/:id` | courier | `courier-mails-detail-receive` — Pochta tafsiloti — qabul qilish | [design/fragments/courier--mails-detail-receive.html](fragments/courier--mails-detail-receive.html) | sahifa | v2 |
| `/mails/:id` | courier | `courier-mails-detail-receive-camera` — Pochta tafsiloti — qabul qilish — kamera | [design/fragments/courier--mails-detail-receive-camera.html](fragments/courier--mails-detail-receive-camera.html) | oyna | qisman |
| `/mails/:id` | courier | `courier-mails-detail-refused` — Pochta tafsiloti — rad etilgan (faqat o'qish) | [design/fragments/courier--mails-detail-refused.html](fragments/courier--mails-detail-refused.html) | sahifa | v2 |
| `/mails/:id` | courier | `courier-mails-detail-old` — Pochta tafsiloti — eski (tarix) | [design/fragments/courier--mails-detail-old.html](fragments/courier--mails-detail-old.html) | sahifa | v2 |
| `/mails/:id` | courier | `courier-mails-detail-print-menu` — Chop etish menyusi<br>↳ `src/shared/components/PrintModeSelect.tsx` | [design/fragments/courier--mails-detail-print-menu.html](fragments/courier--mails-detail-print-menu.html) | oyna | v2 |
| `/mails/:id` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

### Paketlar va qaytarishlar

#### `/batches` — Paketlar — Yangi · Eski · Qaytarilgan

- **Fayllar:** `src/pages/batches/ui/BatchesPage.tsx` · `src/pages/batches/model/batchView.ts` · `src/pages/batches/lib/batchFormat.ts` · `src/entities/batch/model/batchStatus.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewBatches` (access.ts → canViewBatchesPage)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID)
- **Menyuda:** «Paketlar» (`batches`) — superadmin, admin, manager (HQ · PICKUP · HYBRID)
- **Holat:** v2
- **Izoh:** Tab URL'da: ?tab=new|old|return.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/batches` | superadmin | `superadmin-batches-new` — Paketlar — Yangi | [design/fragments/superadmin--batches-new.html](fragments/superadmin--batches-new.html) | sahifa | v2 |
| `/batches` | superadmin | `superadmin-batches-old` — Paketlar — Eski | [design/fragments/superadmin--batches-old.html](fragments/superadmin--batches-old.html) | sahifa | v2 |
| `/batches` | superadmin | `superadmin-batches-return` — Paketlar — Qaytarilgan | [design/fragments/superadmin--batches-return.html](fragments/superadmin--batches-return.html) | sahifa | v2 |
| `/batches` | admin | `admin-batches-new` — Paketlar — Yangi | [design/fragments/superadmin--batches-new.html](fragments/superadmin--batches-new.html) | sahifa | v2 |
| `/batches` | admin | `admin-batches-old` — Paketlar — Eski | [design/fragments/superadmin--batches-old.html](fragments/superadmin--batches-old.html) | sahifa | v2 |
| `/batches` | admin | `admin-batches-return` — Paketlar — Qaytarilgan | [design/fragments/superadmin--batches-return.html](fragments/superadmin--batches-return.html) | sahifa | v2 |
| `/batches` | manager | `manager-batches-new` — Paketlar — Yangi | [design/fragments/manager--batches-new.html](fragments/manager--batches-new.html) | sahifa | v2 |
| `/batches` | manager | `manager-batches-old` — Paketlar — Eski | [design/fragments/manager--batches-old.html](fragments/manager--batches-old.html) | sahifa | v2 |
| `/batches` | manager | `manager-batches-return` — Paketlar — Qaytarilgan | [design/fragments/manager--batches-return.html](fragments/manager--batches-return.html) | sahifa | v2 |

#### `/batches/:id` — Paket tafsiloti (menejer: asosiy filialga jo'natish yoki faqat o'qish; qaytarish paketi ham shu sahifa)

- **Fayllar:** `src/pages/batches/ui/BatchDetailPage.tsx` · `src/pages/batches/ui/BatchInfoCard.tsx` · `src/pages/batches/ui/BatchQrCard.tsx` · `src/pages/batches/ui/BatchHistoryCard.tsx` · `src/pages/batches/ui/BatchPrintSheet.tsx` · `src/pages/batches/ui/BatchQrCode.tsx` · `src/pages/batches/lib/batchOrderMailAdapter.ts` · `src/pages/mails/detail/ui/OrdersTable.tsx` · `src/pages/mails/detail/ui/MailStatCards.tsx` · `src/pages/mails/detail/ui/SendButton.tsx` · `src/pages/mails/detail/model/useMailDetailState.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewBatches` (access.ts → canViewBatchesPage)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Jo'natish rejimi: paket holati «new» va rol menejer/registrator (canSendToMainBranch); aks holda faqat o'qish. /returns qatori ham shu sahifani ochadi. Buyurtmalar kartasi, statistika va jo'natish tugmasi /mails/:id bilan umumiy (pages/mails/detail/ui — batchOrderMailAdapter.ts orqali).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/batches/:id` | superadmin | `superadmin-batches-detail` — Paket tafsiloti | [design/fragments/superadmin--batches-detail.html](fragments/superadmin--batches-detail.html) | sahifa | v2 |
| `/batches/:id` | admin | `admin-batches-detail` — Paket tafsiloti | [design/fragments/superadmin--batches-detail.html](fragments/superadmin--batches-detail.html) | sahifa | v2 |
| `/batches/:id` | manager | `manager-batches-detail-send` — Paket tafsiloti — asosiy filialga jo'natish | [design/fragments/manager--batches-detail-send.html](fragments/manager--batches-detail-send.html) | sahifa | v2 |
| `/batches/:id` | manager | `manager-batches-detail-send-camera` — Paket tafsiloti — asosiy filialga jo'natish — kamera | [design/fragments/manager--batches-detail-send-camera.html](fragments/manager--batches-detail-send-camera.html) | oyna | qisman |
| `/batches/:id` | manager | `manager-batches-detail-readonly` — Paket tafsiloti (faqat o'qish) | [design/fragments/manager--batches-detail-readonly.html](fragments/manager--batches-detail-readonly.html) | sahifa | v2 |
| `/batches/:id` | manager | `manager-returns-batch-detail` — Qaytarish paketi tafsiloti | [design/fragments/manager--returns-batch-detail.html](fragments/manager--returns-batch-detail.html) | sahifa | v2 |
| `/batches/:id` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

#### `/returns` — Qaytarishlar (qaytarish paketlari ro'yxati)

- **Fayllar:** `src/pages/returns/index.tsx` · `src/pages/returns/model/returnBatches.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewReturns` (access.ts → canViewReturnsPage)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID)
- **Menyuda:** «Qaytarishlar» (`returns`) — superadmin, admin, manager (HQ · PICKUP · HYBRID)
- **Holat:** v2
- **Izoh:** Qator bosilsa → /batches/:id (manager-returns-batch-detail; «← Qaytarishlar» filtrlar bilan). Filtrlar «Holat: …» va «Sana: …» (ega qarori 2026-10-17 F2) — URL ?status&period|date, o'zgarsa sahifa 1; sana qisqartirilgan: Bugun / Bu hafta / Bu oy (period) yoki bitta kun (date) — GET transfer-batches from/to oralig'ini olmaydi; telefonda ham ikkalasi qatorda (≤ 2 filtr, maket). Holat bo'sh yoki «Yangi» bo'lsa backend PENDING paketlarni sahifa ichida yig'adi va meta.total sahifaga xos — «jami N ta paket» va sahifalash to'liq emas (egaga savol Q2).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/returns` | superadmin | `superadmin-returns-list` — Return batchlar | [design/fragments/superadmin--returns-list.html](fragments/superadmin--returns-list.html) | sahifa | v2 |
| `/returns` | admin | `admin-returns-list` — Return batchlar | [design/fragments/superadmin--returns-list.html](fragments/superadmin--returns-list.html) | sahifa | v2 |
| `/returns` | manager | `manager-returns-list` — Return batchlar | [design/fragments/manager--returns-list.html](fragments/manager--returns-list.html) | sahifa | v2 |

### Biriktirish va tezkor amal

#### `/dispatch` — Biriktirish — buyurtmalarni skanerlab kuryerga berish

- **Fayllar:** `src/pages/dispatch/index.tsx` · `src/pages/dispatch/ui/DispatchStats.tsx` · `src/pages/dispatch/ui/DispatchOrdersTable.tsx` · `src/pages/dispatch/ui/CourierPickerDialog.tsx` · `src/pages/dispatch/ui/DispatchAlert.tsx` · `src/pages/dispatch/model/dispatchModel.ts` · `src/shared/components/ScannerCameraModal.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewDispatch` (access.ts → canViewDispatchPage)
- **Rollar:** superadmin, admin, manager (REGIONAL · HYBRID), registrator (HQ · REGIONAL · HYBRID)
- **Menyuda:** «Biriktirish» (`dispatch`) — manager (REGIONAL · HYBRID), registrator (HQ · REGIONAL · HYBRID)
- **Holat:** v2
- **Izoh:** Dizayn v2 (G3): barcha rollar uchun bitta tartib — registrator maketlari (dispatch-list, dispatch-empty) + menejer dispatch-scan matnlari, «Kuryerni tanlang» oynasi — CourierPickerDialog (Dialog, telefonda pastki varaqa). Ega savoli Q7 sukuti: telefonda pastki menyu ustida yopishqoq panel «Kamera N ta» + «Biriktirish — K ta» (har rolda), sarlavhadagi tugma ≥ 768 da. Bitta faol kuryer — oynasiz darhol biriktiriladi. /scan/:token dan «Kuryerga biriktirish» (Q3) → state.scanToken bir marta qo'shiladi va tanlanadi. Ro'yxat sahifa holati — sahifadan chiqilsa yo'qoladi (menejer maketidagi «biriktirish savati» saqlanishi — ega qarori kutiladi). Kamera oynasi (ScannerCameraModal, umumiy) — alohida kamera ishi.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/dispatch` | superadmin | — Menyuda yo'q (faqat URL) — registrator-dispatch-list tartibi (barcha rollar uchun bitta tartib). | — | — | v2 |
| `/dispatch` | admin | — Menyuda yo'q (faqat URL) — registrator-dispatch-list tartibi (barcha rollar uchun bitta tartib). | — | — | v2 |
| `/dispatch` | manager | `manager-dispatch-scan` — Biriktirish — skan savati | [design/fragments/manager--dispatch-scan.html](fragments/manager--dispatch-scan.html) | sahifa | v2 |
| `/dispatch` | manager | `manager-dispatch-courier-dialog` — Kuryer tanlash oynasi | [design/fragments/manager--dispatch-courier-dialog.html](fragments/manager--dispatch-courier-dialog.html) | oyna | v2 |
| `/dispatch` | manager | `manager-dispatch-camera-dialog` — Biriktirish — kamera | [design/fragments/manager--dispatch-camera-dialog.html](fragments/manager--dispatch-camera-dialog.html) | oyna | qisman |
| `/dispatch` | registrator | `registrator-dispatch-list` — Biriktirish — skanerlangan buyurtmalar | [design/fragments/registrator--dispatch-list.html](fragments/registrator--dispatch-list.html) | sahifa | v2 |
| `/dispatch` | registrator | `registrator-dispatch-empty` — Biriktirish — bo'sh holat | [design/fragments/registrator--dispatch-empty.html](fragments/registrator--dispatch-empty.html) | sahifa | v2 |
| `/dispatch` | registrator | `registrator-dispatch-camera-scanner-dialog` — Biriktirish — kamera skaneri | [design/fragments/registrator--dispatch-camera-scanner-dialog.html](fragments/registrator--dispatch-camera-scanner-dialog.html) | oyna | qisman |
| `/dispatch` | registrator | `registrator-dispatch-courier-select-dialog` — Biriktirish — kuryer tanlash | [design/fragments/registrator--dispatch-courier-select-dialog.html](fragments/registrator--dispatch-courier-select-dialog.html) | oyna | v2 |
| `/dispatch` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

#### `/courier-bulk` — Tezkor amal — kunni yakunlash (skanerlab sotildi / bekor / ertaga)

- **Fayllar:** `src/pages/courier-bulk/index.tsx` · `src/pages/courier-bulk/model/courierBulk.ts` · `src/pages/courier-bulk/ui/CourierBulkSummary.tsx` · `src/pages/courier-bulk/ui/ScanModeControl.tsx` · `src/pages/courier-bulk/ui/CourierBulkOrders.tsx` · `src/pages/courier-bulk/ui/ResultControl.tsx` · `src/pages/courier-bulk/ui/BulkAlert.tsx` · `src/pages/courier-bulk/ui/segmentTint.ts` · `src/pages/courier-bulk/model/useIsBelowLg.ts` · `src/shared/components/ScannerCameraModal.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewCourierBulk` (access.ts → canViewCourierBulkPage)
- **Rollar:** manager (REGIONAL · HYBRID), courier
- **Menyuda:** «Tezkor amal» (`quickAction`) — manager (REGIONAL · HYBRID), courier
- **Holat:** v2
- **Izoh:** Dizayn v2 (G3): kuryer va menejer uchun bitta tartib (courier-courier-bulk-main). Ega savoli Q8 sukuti: menejerda ham kuryer maketi (4 stat karta, qidiruv + «Natija» filtri, saralash — hammasi mijoz tomonida, yangi API parametri yo'q); «Kutilayotgan» izohi menejerda «Filial kuryerlarida, yakunlanmagan». Q9: «Faqat bekorlarni qo'llash» olib tashlandi (maketlarda yo'q). Telefonda «Kunni yakunlash» pastki menyu ustidagi yopishqoq panelda (DOM'da bitta tugma). Tasdiq — useConfirm (courier-courier-bulk-confirm-dialog matnlari); «Ertaga» so'rov yubormaydi. Kamera oynasi va skan topilmaganda chiqadigan umumiy qoplama (common:scannerFeedbackMissing «Bu pochtada yo'q» matni) — alohida kamera ishi.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/courier-bulk` | manager | `manager-courier-bulk-main` — Tezkor amal | [design/fragments/manager--courier-bulk-main.html](fragments/manager--courier-bulk-main.html) | sahifa | v2 |
| `/courier-bulk` | manager | `manager-courier-bulk-camera-dialog` — Tezkor amal — kamera | [design/fragments/manager--courier-bulk-camera-dialog.html](fragments/manager--courier-bulk-camera-dialog.html) | oyna | qisman |
| `/courier-bulk` | courier | `courier-courier-bulk-main` — Tezkor amal — kunni yakunlash | [design/fragments/courier--courier-bulk-main.html](fragments/courier--courier-bulk-main.html) | sahifa | v2 |
| `/courier-bulk` | courier | `courier-courier-bulk-scanner-camera` — Tezkor amal — kamera skaneri | [design/fragments/courier--courier-bulk-scanner-camera.html](fragments/courier--courier-bulk-scanner-camera.html) | oyna | qisman |
| `/courier-bulk` | courier | `courier-courier-bulk-scanner-camera-list` — Tezkor amal — kamera, skanerlanganlar ro'yxati | [design/fragments/courier--courier-bulk-scanner-camera-list.html](fragments/courier--courier-bulk-scanner-camera-list.html) | oyna · faqat telefon | yangi (kodda yo'q) |
| `/courier-bulk` | courier | `courier-courier-bulk-confirm-dialog` — Kunni yakunlash — tasdiqlash oynasi | [design/fragments/courier--courier-bulk-confirm-dialog.html](fragments/courier--courier-bulk-confirm-dialog.html) | oyna | v2 |
| `/courier-bulk` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

### Skaner

#### `/scan` — QR skaner — telefon kamerasi (to'liq ekran, ScanLayout)

- **Fayllar:** `src/pages/scan/index.tsx` · `src/pages/scan/lib/scanShared.ts` · `src/shared/lib/useCameraQrScanner.ts` · `src/shared/components/ScanFeedbackOverlay.tsx`
- **Qobiq:** ScanLayout · **Guard:** yo'q (faqat kirish)
- **Rollar:** superadmin, admin, manager, registrator, market, courier
- **Menyuda:** yo'q — yuqori panel → «Skanerlash» tugmasi; telefon menyusi; skaner natijasidan «Skanerga qaytish»
- **Holat:** eski
- **Izoh:** Kirish: yuqori panel «Skanerlash» tugmasi va telefon menyusi. Holatlar (ishga tushmoqda, faol, topildi, noto'g'ri QR, juda tez, kamera xatosi) bitta komponentda. Butun /scan sahifasi (barcha kamera holatlari, «Qo'lda kiritish», «Oxirgi skanerlar», oflayn navbat) — alohida kamera ishi (ega qarori 2026-10-16; G3 Q1 sukuti); 4-bosqichda faqat /scan/:token. Buyurtma raqami bilan qo'lda qidirish uchun API yo'q (QR faqat qr_code_token bo'yicha).

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

- **Fayllar:** `src/pages/scan/detail.tsx` · `src/pages/scan/ui/ScanOrderResult.tsx` · `src/pages/scan/ui/ScanResultHeader.tsx` · `src/pages/scan/ui/ScanActionCard.tsx` · `src/pages/scan/ui/ScanStickyBar.tsx` · `src/pages/scan/ui/ScanAlert.tsx` · `src/pages/scan/ui/ScanStates.tsx` · `src/pages/scan/ui/ScanOrdersCard.tsx` · `src/pages/scan/ui/ScanBatchSummary.tsx` · `src/pages/scan/ui/ScanTrackingCard.tsx` · `src/pages/scan/ui/ManagerOrderDialogs.tsx` · `src/pages/scan/ui/ScanPackageDetail.tsx` · `src/pages/scan/ui/ScanPostDetail.tsx` · `src/pages/scan/model/scanOrderView.ts` · `src/pages/scan/model/scanBatchView.ts` · `src/pages/scan/lib/scanResource.ts`
- **Qobiq:** ScanLayout · **Guard:** yo'q (faqat kirish)
- **Rollar:** superadmin, admin, manager, registrator, market, courier
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Dizayn v2 (G3): barcha rollar uchun bitta tartib (menejer/kuryer maketlari tuzilmasi), rol farqi faqat mazmunda; admin — superadmin maketi (superadmin-scan-result). «O'zimga olish» faqat kuryerda; boshqa kuryerga biriktirilgan buyurtma xatosi — backend matni amallar kartasida. Paket → ScanPackageDetail, pochta → ScanPostDetail; xodimda paket nomlari GET transfer-batches/:id bilan to'ldiriladi (ixtiyoriy, xatosi global xabarsiz — silentError). Ega savollari sukuti: Q2 menejerda «Sotish / Bekor qilish» buyurtma tafsilotidagi qoidalar bilan (can_sell_cancel, REGIONAL/HYBRID, kuryer qo'lida emas); Q3 «Kuryerga biriktirish» → /dispatch (buyurtma qo'shilib tanlanadi; buyurtma holati bo'yicha cheklanmagan — spec sukuti); Q4 superadmin/admin/registrator xulosasida «To'langan» ham, «Yaratilgan» ham; Q5 kuryerga paketni «Qabul qilish» yo'q (backend 403) — faqat o'qish.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/scan/:token` | superadmin | `superadmin-scan-result` — Skanerlangan buyurtma | [design/fragments/superadmin--scan-result.html](fragments/superadmin--scan-result.html) | sahifa | v2 |
| `/scan/:token` | admin | `admin-scan-result` — Skanerlangan buyurtma | [design/fragments/superadmin--scan-result.html](fragments/superadmin--scan-result.html) | sahifa | v2 |
| `/scan/:token` | manager | `manager-scan-result` — Skanerlangan buyurtma | [design/fragments/manager--scan-result.html](fragments/manager--scan-result.html) | sahifa | v2 |
| `/scan/:token` | registrator | `registrator-scan-result` — Skanerlangan buyurtma | [design/fragments/registrator--scan-result.html](fragments/registrator--scan-result.html) | sahifa | v2 |
| `/scan/:token` | market | — Maket yo'q — market skanerlamaydi. URL orqali ochilsa — xodimning faqat o'qish tartibi (amallarsiz, holat tarixisiz, tafsilot havolasisiz). | — | — | v2 |
| `/scan/:token` | courier | `courier-scan-order-detail` — Skanerlangan buyurtma — O'zimga olish | [design/fragments/courier--scan-order-detail.html](fragments/courier--scan-order-detail.html) | sahifa | v2 |
| `/scan/:token` | courier | `courier-scan-package-detail` — Skanerlangan paket<br>↳ `src/pages/scan/ui/ScanPackageDetail.tsx` | [design/fragments/courier--scan-package-detail.html](fragments/courier--scan-package-detail.html) | sahifa | v2 |
| `/scan/:token` | courier | `courier-scan-post-detail` — Skanerlangan pochta<br>↳ `src/pages/scan/ui/ScanPostDetail.tsx` | [design/fragments/courier--scan-post-detail.html](fragments/courier--scan-post-detail.html) | sahifa | v2 |
| `/scan/:token` | courier | `courier-scan-not-found` — Skaner — topilmadi | [design/fragments/courier--scan-not-found.html](fragments/courier--scan-not-found.html) | sahifa | qisman |
| `/scan/:token` | courier | `courier-scan-other-courier` — Skaner — boshqa kuryerga biriktirilgan | [design/fragments/courier--scan-other-courier.html](fragments/courier--scan-other-courier.html) | sahifa | qisman |
| `/scan/:token` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

### Moliya — to'lovlar, kassa, balans

#### `/payments` — To'lovlar — umumiy (berilishi / qabul qilinishi kerak, operatsiyalar tarixi)

- **Fayllar:** `src/pages/payments/index.tsx` · `src/pages/payments/components/PaymentSummaryCards.tsx` · `src/pages/payments/components/patmentHistoryTable.tsx` · `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` · `src/pages/payments/components/SettlementPickerDialog.tsx` · `src/pages/payments/components/InactiveBadge.tsx` · `src/pages/payments/components/paymentSourceType.ts` · `src/pages/payments/components/paymentHistoryActor.ts` · `src/pages/payments/components/lib/receiveOptions.ts`
- **Qobiq:** DashboardLayout · **Guard:** `isPaymentsManager` (access.ts → canViewPaymentsPage) · ruxsat bo'lmasa → `/cash-box`
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID)
- **Menyuda:** «To'lovlar» (`payments`) — superadmin, admin, manager (HQ · REGIONAL · HYBRID)
- **Holat:** v2
- **Izoh:** Tanlash oynalari (Qabul qilinishi kerak · Berilishi kerak · Kuryerni tanlang) — SettlementPickerDialog (kind receive | give | courier), tafsilot — FinanceHistoryDetailPopup (barcha Moliya sahifalari uchun umumiy). Birxillashtirish (spec §0.5): filtr qatori barcha rollarda tarix kartasi ichida (menejer maketi naqshi), «Sana» filtri — GET finance/history from_date/to_date. Ega qarori D1 (2026-10-17): superadmin/admin tarixi kassa tanlanmagan bo'lsa server tomonida faqat asosiy kassa (gateway sukuti cashbox_type=main); «Kassa turi» filtri boshqa kassani tanlaydi; menejerda server doim filial kassasini beradi. Tab sonlari chizilmaydi (API bermaydi, Trello GaBIPi3Z). Ruxsati yo'q rol (market, kuryer) → /cash-box.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/payments` | superadmin | `superadmin-payments-overview` — To'lovlar — umumiy | [design/fragments/superadmin--payments-overview.html](fragments/superadmin--payments-overview.html) | sahifa | v2 |
| `/payments` | superadmin | `superadmin-payments-market-picker-dialog` — Berilishi kerak / Qabul qilinishi kerak — tanlash<br>↳ `src/pages/payments/components/SettlementPickerDialog.tsx` | [design/fragments/superadmin--payments-market-picker-dialog.html](fragments/superadmin--payments-market-picker-dialog.html) | oyna | v2 |
| `/payments` | superadmin | `superadmin-payments-to-give-dialog` — Berilishi kerak — market tanlash<br>↳ `src/pages/payments/components/SettlementPickerDialog.tsx` | [design/fragments/superadmin--payments-to-give-dialog.html](fragments/superadmin--payments-to-give-dialog.html) | oyna | v2 |
| `/payments` | superadmin | `superadmin-payments-history-detail-dialog` — To'lov tarixi — yozuv tafsiloti<br>↳ `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | [design/fragments/superadmin--payments-history-detail-dialog.html](fragments/superadmin--payments-history-detail-dialog.html) | oyna | v2 |
| `/payments` | admin | `admin-payments-overview` — To'lovlar | [design/fragments/admin--payments-overview.html](fragments/admin--payments-overview.html) | sahifa | v2 |
| `/payments` | admin | `admin-payments-to-give-dialog` — Berilishi kerak — market tanlash<br>↳ `src/pages/payments/components/SettlementPickerDialog.tsx` | [design/fragments/admin--payments-to-give-dialog.html](fragments/admin--payments-to-give-dialog.html) | oyna | v2 |
| `/payments` | admin | `admin-payments-to-receive-dialog` — Qabul qilinishi kerak — tanlash<br>↳ `src/pages/payments/components/SettlementPickerDialog.tsx` | [design/fragments/admin--payments-to-receive-dialog.html](fragments/admin--payments-to-receive-dialog.html) | oyna | v2 |
| `/payments` | admin | `admin-payments-history-detail-dialog` — To'lov tarixi tafsiloti<br>↳ `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | [design/fragments/admin--payments-history-detail-dialog.html](fragments/admin--payments-history-detail-dialog.html) | oyna | v2 |
| `/payments` | manager | `manager-payments-overview` — To'lovlar — umumiy | [design/fragments/manager--payments-overview.html](fragments/manager--payments-overview.html) | sahifa | v2 |
| `/payments` | manager | `manager-payments-courier-select-dialog` — Qabul qilish — kuryer tanlash<br>↳ `src/pages/payments/components/SettlementPickerDialog.tsx` | [design/fragments/manager--payments-courier-select-dialog.html](fragments/manager--payments-courier-select-dialog.html) | oyna | v2 |
| `/payments` | manager | `manager-payments-history-detail-dialog` — Tranzaksiya tafsiloti<br>↳ `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | [design/fragments/manager--payments-history-detail-dialog.html](fragments/manager--payments-history-detail-dialog.html) | oyna | v2 |

#### `/payments/main-cashbox` — Asosiy kassa (to'ldirish / xarajat / smenani yopish)

- **Fayllar:** `src/pages/payments/components/mainCashbox.tsx` · `src/pages/payments/components/MainCashboxBalanceChart.tsx` · `src/pages/payments/components/lib/mainCashboxStats.ts` · `src/pages/payments/components/CashboxFormPopup.tsx` · `src/pages/payments/components/CloseShiftPopup.tsx` · `src/pages/payments/components/SettlementPickerDialog.tsx` · `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` · `src/pages/payments/components/SalaryPaymentPopup.tsx` · `src/shared/components/popupSelect.tsx` · `src/pages/payments/components/lib/exportMainCashboxReport.ts`
- **Qobiq:** DashboardLayout · **Guard:** `isPaymentsManager` (access.ts → canViewPaymentsPage) · ruxsat bo'lmasa → `/cash-box`
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Ega qarori D1 (2026-10-17): superadmin/admin — faqat asosiy kassa operatsiyalari (GET finance/history?cashbox_type=main): ro'yxat, «Bugun / Bu hafta / Bu oy», «Pul qayerdan keldi, qayerga ketdi» va Excel hisobot; menejerda filial kassasi (server majburlaydi, o'zgarmagan). D3: «Kassani to'ldirish» / «Kassadan xarajat» — tasdiq oynasi (useConfirm) + Idempotency-Key (paymentIdempotency, qayta urinishda o'sha kalit). Birxillashtirish (spec §10 Q2): «Kassa balansi» chizig'i va manba bloklari menejerda ham; telefonda davrlar — bitta karta + SegmentedControl. Smena faqat superadmin/admin (Q4 — menejerda yo'q). «Maosh to'lash» yashirin (SalaryPaymentPopup + PopupSelect — v1, yetib bo'lmaydi). 18 talik xarajat kategoriyasi va nomli kartalar (card_id) chizilmaydi.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/payments/main-cashbox` | superadmin | `superadmin-payments-main-cashbox` — Asosiy kassa | [design/fragments/superadmin--payments-main-cashbox.html](fragments/superadmin--payments-main-cashbox.html) | sahifa | v2 |
| `/payments/main-cashbox` | superadmin | `superadmin-payments-main-cashbox-fill-dialog` — Kassani to'ldirish / Kassadan xarajat (popup)<br>↳ `src/pages/payments/components/CashboxFormPopup.tsx` | [design/fragments/superadmin--payments-main-cashbox-fill-dialog.html](fragments/superadmin--payments-main-cashbox-fill-dialog.html) | oyna | v2 |
| `/payments/main-cashbox` | superadmin | `superadmin-payments-main-cashbox-shift-dialog` — Smenani yopish (popup)<br>↳ `src/pages/payments/components/CloseShiftPopup.tsx` | [design/fragments/superadmin--payments-main-cashbox-shift-dialog.html](fragments/superadmin--payments-main-cashbox-shift-dialog.html) | oyna | v2 |
| `/payments/main-cashbox` | admin | `admin-payments-main-cashbox` — Asosiy kassa | [design/fragments/admin--payments-main-cashbox.html](fragments/admin--payments-main-cashbox.html) | sahifa | v2 |
| `/payments/main-cashbox` | admin | `admin-payments-cashbox-form-dialog` — Kassadan xarajat / Kassani to'ldirish<br>↳ `src/pages/payments/components/CashboxFormPopup.tsx` | [design/fragments/admin--payments-cashbox-form-dialog.html](fragments/admin--payments-cashbox-form-dialog.html) | oyna | v2 |
| `/payments/main-cashbox` | admin | `admin-payments-shift-dialog` — Smenani yopish<br>↳ `src/pages/payments/components/CloseShiftPopup.tsx` | [design/fragments/admin--payments-shift-dialog.html](fragments/admin--payments-shift-dialog.html) | oyna | v2 |
| `/payments/main-cashbox` | manager | `manager-payments-main-cashbox` — Asosiy kassa (filial) | [design/fragments/manager--payments-main-cashbox.html](fragments/manager--payments-main-cashbox.html) | sahifa | v2 |
| `/payments/main-cashbox` | manager | `manager-payments-cashbox-form-dialog` — Kassadan xarajat / to'ldirish oynasi<br>↳ `src/pages/payments/components/CashboxFormPopup.tsx` | [design/fragments/manager--payments-cashbox-form-dialog.html](fragments/manager--payments-cashbox-form-dialog.html) | oyna | v2 |
| `/payments/main-cashbox` | manager | `manager-payments-close-shift-dialog` — Smenani yopish oynasi<br>↳ `src/pages/payments/components/CloseShiftPopup.tsx` | [design/fragments/manager--payments-close-shift-dialog.html](fragments/manager--payments-close-shift-dialog.html) | oyna | v2 |

#### `/payments/cash-detail/:id` — Kassa tafsiloti — kuryer / market / filial

- **Fayllar:** `src/pages/payments/components/cashDetail.tsx` · `src/pages/payments/components/CashboxActionFormCard.tsx` · `src/pages/payments/components/PaymentHistoryList.tsx` · `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` · `src/pages/payments/components/lib/paymentIdempotency.ts`
- **Qobiq:** DashboardLayout · **Guard:** `isPaymentsManager` (access.ts → canViewPaymentsPage) · ruxsat bo'lmasa → `/cash-box`
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Tur URL'da: ?type=courier|market|branch (noma'lum tur — forma yo'q). Pul o'tkazish — «To'lovni tasdiqlang» oynasi (useConfirm, from → to) + Idempotency-Key. Birxillashtirish (spec §10 Q2): «Balans harakati» va «Barcha tarix | To'lov o'tkazmalari» menejerda ham. Menejerda mijoz tomonidagi summa chegarasi yo'q (Q8 — backend chegaralaydi); tarix tab sonlari, kuryer «kechaga nisbatan» va sparkline chizilmaydi (API bermaydi). Excel faqat superadmin/admin.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/payments/cash-detail/:id` | superadmin | `superadmin-payments-cash-detail-courier` — Kuryer kassasi (qabul qilish) | [design/fragments/superadmin--payments-cash-detail-courier.html](fragments/superadmin--payments-cash-detail-courier.html) | sahifa | v2 |
| `/payments/cash-detail/:id` | superadmin | `superadmin-payments-cash-detail-market` — Market kassasi (to'lov berish) | [design/fragments/superadmin--payments-cash-detail-market.html](fragments/superadmin--payments-cash-detail-market.html) | sahifa | v2 |
| `/payments/cash-detail/:id` | superadmin | `superadmin-payments-cash-detail-branch` — Filial kassasi (filialdan qabul) | [design/fragments/superadmin--payments-cash-detail-branch.html](fragments/superadmin--payments-cash-detail-branch.html) | sahifa | v2 |
| `/payments/cash-detail/:id` | admin | `admin-payments-cash-detail-courier` — Kuryer kassasi | [design/fragments/admin--payments-cash-detail-courier.html](fragments/admin--payments-cash-detail-courier.html) | sahifa | v2 |
| `/payments/cash-detail/:id` | admin | `admin-payments-cash-detail-market` — Market kassasi | [design/fragments/admin--payments-cash-detail-market.html](fragments/admin--payments-cash-detail-market.html) | sahifa | v2 |
| `/payments/cash-detail/:id` | admin | `admin-payments-cash-detail-branch` — Filial kassasi (HQ qabul) | [design/fragments/admin--payments-cash-detail-branch.html](fragments/admin--payments-cash-detail-branch.html) | sahifa | v2 |
| `/payments/cash-detail/:id` | manager | `manager-payments-cash-detail-courier` — Kassa tafsiloti — kuryerdan qabul | [design/fragments/manager--payments-cash-detail-courier.html](fragments/manager--payments-cash-detail-courier.html) | sahifa | v2 |
| `/payments/cash-detail/:id` | manager | `manager-payments-cash-detail-branch` — Kassa tafsiloti — HQ'ga o'tkazish | [design/fragments/manager--payments-cash-detail-branch.html](fragments/manager--payments-cash-detail-branch.html) | sahifa | v2 |

#### `/cash-box` — O'z kassam — market va kuryer (Barcha tarix · Oldi-berdi)

- **Fayllar:** `src/pages/payments/components/MyCashboxPage.tsx` · `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` · `src/pages/payments/components/paymentSourceType.ts`
- **Qobiq:** DashboardLayout · **Guard:** `hasSelfCashboxAccess` (routes.tsx → hasSelfCashboxAccess) · ruxsat bo'lmasa → `/payments`
- **Rollar:** manager, market, courier
- **Menyuda:** «To'lovlar» (`payments`) — market; «Kassa» (`payments`) — courier
- **Holat:** v2
- **Izoh:** Tarix tablari: «all» → cashbox-my-all, «payments» → cashbox-my-transfers (sourceTypes). Ega qarori D2 (2026-10-17): marketning o'z kassasida HQ → market o'tkazmasi (market_payment) — «Chiqim −» (market balansi = Elchining qarzi), ro'yxatda ham, tafsilot oynasida ham (getViewerOperationType); boshqa rollarda yo'nalish o'zgarmagan. Kuryer tafsilotida «Kassa turi» yo'q (hideCashboxType). «Umumiy balans» grafigi, «Davr/Kassa oqimi», delta va sparkline — Taklif, chizilmaydi. Ruxsati yo'q rol → /payments.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/cash-box` | manager | — Maket yo'q. Ayni komponent menejerga filial kassasini ko'rsatadi, lekin menyudagi «To'lovlar» bandi /payments ga olib boradi (HQ · REGIONAL · HYBRID; PICKUP menejerida bu band yo'q, sahifa faqat URL orqali). Eng yaqin maket — market-cashbox-my (ayni tuzilma) va manager-payments-cash-detail-branch. | — | — | v2 |
| `/cash-box` | market | `market-cashbox-my` — Market kassasi | [design/fragments/market--cashbox-my.html](fragments/market--cashbox-my.html) | sahifa | v2 |
| `/cash-box` | market | `market-cashbox-history-detail-dialog` — Tranzaksiya tafsiloti<br>↳ `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | [design/fragments/market--cashbox-history-detail-dialog.html](fragments/market--cashbox-history-detail-dialog.html) | oyna | v2 |
| `/cash-box` | courier | `courier-cashbox-my-all` — Kassa — Barcha tarix | [design/fragments/courier--cashbox-my-all.html](fragments/courier--cashbox-my-all.html) | sahifa | v2 |
| `/cash-box` | courier | `courier-cashbox-my-transfers` — Kassa — Oldi-berdi | [design/fragments/courier--cashbox-my-transfers.html](fragments/courier--cashbox-my-transfers.html) | sahifa | v2 |
| `/cash-box` | courier | `courier-cashbox-history-detail` — Tranzaksiya tafsiloti<br>↳ `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | [design/fragments/courier--cashbox-history-detail.html](fragments/courier--cashbox-history-detail.html) | oyna | v2 |

#### `/financial-balance` — Balans — Umumiy · Tarix · Tahlil

- **Fayllar:** `src/pages/financial-balance/index.tsx` · `src/pages/financial-balance/components/Statistics.tsx` · `src/pages/financial-balance/components/HistoryTab.tsx` · `src/pages/financial-balance/components/AnalysisTab.tsx` · `src/pages/financial-balance/components/LedgerFlow.tsx` · `src/pages/financial-balance/components/SettlementRanks.tsx` · `src/pages/financial-balance/components/FinancialEntryModal.tsx` · `src/pages/financial-balance/components/FinancialHistoryDetail.tsx` · `src/pages/financial-balance/lib/financialBalance.ts` · `src/pages/financial-balance/lib/analytics.ts` · `src/pages/financial-balance/lib/manualEntry.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewFinancialBalance` (access.ts → canViewFinancialBalance)
- **Rollar:** superadmin, admin
- **Menyuda:** «Balans» (`balance`) — superadmin, admin
- **Holat:** v2
- **Izoh:** Tab URL'da: ?tab= (Umumiy ko'rinish · Tarix · Tahlil). «Excelga yuklash» va «Yozuv qo'shish» sarlavhada, har tabda; Excel faol tab paramlari bilan. Tahlil davri «Bugun / Bu hafta / Bu oy / Barchasi» (spec §10 Q7); eng katta ta'sirli tranzaksiyalar server sahifalashida (top-impacts limit ≤ 100); o'tgan davrda waterfall davr boshi/«Hozir» ustunlarisiz (currentBalance — bugungi qoldiq). Qo'lda yozuvga alohida tasdiq yo'q (Q5c — oynaning o'zi «Balansga ta'siri» bilan). KPI delta/sparkline, «Daftar qoldig'i» va «Kunlik kirim va chiqim» grafiklari — Taklif, chizilmaydi.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/financial-balance` | superadmin | `superadmin-balance-overview` — Balans — Umumiy ko'rinish<br>↳ `src/pages/financial-balance/components/Statistics.tsx` | [design/fragments/superadmin--balance-overview.html](fragments/superadmin--balance-overview.html) | sahifa | v2 |
| `/financial-balance` | superadmin | `superadmin-balance-history` — Balans — Tarix<br>↳ `src/pages/financial-balance/components/HistoryTab.tsx` | [design/fragments/superadmin--balance-history.html](fragments/superadmin--balance-history.html) | sahifa | v2 |
| `/financial-balance` | superadmin | `superadmin-balance-entry-dialog` — Qo'lda yozuv qo'shish (modal)<br>↳ `src/pages/financial-balance/components/FinancialEntryModal.tsx` | [design/fragments/superadmin--balance-entry-dialog.html](fragments/superadmin--balance-entry-dialog.html) | oyna | v2 |
| `/financial-balance` | superadmin | `superadmin-balance-analysis` — Balans — Tahlil<br>↳ `src/pages/financial-balance/components/AnalysisTab.tsx` | [design/fragments/superadmin--balance-analysis.html](fragments/superadmin--balance-analysis.html) | sahifa | v2 |
| `/financial-balance` | superadmin | `superadmin-balance-history-detail-dialog` — Balans yozuvi tafsiloti<br>↳ `src/pages/financial-balance/components/FinancialHistoryDetail.tsx` | [design/fragments/superadmin--balance-history-detail-dialog.html](fragments/superadmin--balance-history-detail-dialog.html) | oyna | v2 |
| `/financial-balance` | admin | `admin-balance-overview` — Balans — Umumiy ko'rinish<br>↳ `src/pages/financial-balance/components/Statistics.tsx` | [design/fragments/superadmin--balance-overview.html](fragments/superadmin--balance-overview.html) | sahifa | v2 |
| `/financial-balance` | admin | `admin-balance-history` — Balans — Tarix<br>↳ `src/pages/financial-balance/components/HistoryTab.tsx` | [design/fragments/superadmin--balance-history.html](fragments/superadmin--balance-history.html) | sahifa | v2 |
| `/financial-balance` | admin | `admin-balance-analysis` — Balans — Tahlil<br>↳ `src/pages/financial-balance/components/AnalysisTab.tsx` | [design/fragments/superadmin--balance-analysis.html](fragments/superadmin--balance-analysis.html) | sahifa | v2 |
| `/financial-balance` | admin | `admin-balance-entry-dialog` — Qo'lda yozuv qo'shish<br>↳ `src/pages/financial-balance/components/FinancialEntryModal.tsx` | [design/fragments/admin--balance-entry-dialog.html](fragments/admin--balance-entry-dialog.html) | oyna | v2 |
| `/financial-balance` | admin | `admin-balance-history-detail-dialog` — Balans yozuvi tafsiloti<br>↳ `src/pages/financial-balance/components/FinancialHistoryDetail.tsx` | [design/fragments/superadmin--balance-history-detail-dialog.html](fragments/superadmin--balance-history-detail-dialog.html) | oyna | v2 |
| `/financial-balance` | tizim taxtasi | `tizim-charts` — Grafiklar — statistika va tahlil | [design/fragments/tizim--charts.html](fragments/tizim--charts.html) | taxta | qoida |

### Mahsulotlar

#### `/products` — Mahsulotlar ro'yxati (tahrirlash, o'chirish, yaratish uchun market tanlash; dizayn v2)

- **Fayllar:** `src/pages/products/list/index.tsx` · `src/pages/products/list/ui/SelectMarketDialog.tsx` · `src/pages/products/list/ui/EditProductDialog.tsx` · `src/pages/products/ui/useDeleteProductConfirm.tsx` · `src/pages/products/ui/ProductImageField.tsx` · `src/pages/products/ui/ProductThumb.tsx` · `src/pages/products/model/productView.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canManageProducts` (routes.tsx → canManageProducts)
- **Rollar:** superadmin, admin, manager, registrator, market
- **Menyuda:** «Mahsulotlar» (`products`) — superadmin, admin, manager, registrator, market
- **Holat:** v2
- **Izoh:** Market rolida GET product/my-products (search/page/limit), xodimda GET product + market filtri (URL market_id). Ro'yxat so'rovlari entities/product hook'lari (keepPreviousData, silentError).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/products` | superadmin | `superadmin-products-list` — Mahsulotlar ro'yxati | [design/fragments/superadmin--products-list.html](fragments/superadmin--products-list.html) | sahifa | v2 |
| `/products` | superadmin | `superadmin-products-select-market-dialog` — Mahsulot yaratish — market tanlash<br>↳ `src/pages/products/list/ui/SelectMarketDialog.tsx` | [design/fragments/superadmin--products-select-market-dialog.html](fragments/superadmin--products-select-market-dialog.html) | oyna | v2 |
| `/products` | superadmin | `superadmin-products-edit-dialog` — Mahsulotni tahrirlash (popup)<br>↳ `src/pages/products/list/ui/EditProductDialog.tsx` | [design/fragments/superadmin--products-edit-dialog.html](fragments/superadmin--products-edit-dialog.html) | oyna | v2 |
| `/products` | superadmin | `superadmin-products-delete-dialog` — Mahsulotni o'chirish<br>↳ `src/pages/products/ui/useDeleteProductConfirm.tsx` | [design/fragments/superadmin--products-delete-dialog.html](fragments/superadmin--products-delete-dialog.html) | oyna | v2 |
| `/products` | admin | `admin-products-list` — Mahsulotlar ro'yxati | [design/fragments/admin--products-list.html](fragments/admin--products-list.html) | sahifa | v2 |
| `/products` | admin | `admin-products-market-select-dialog` — Mahsulot uchun market tanlash<br>↳ `src/pages/products/list/ui/SelectMarketDialog.tsx` | [design/fragments/admin--products-market-select-dialog.html](fragments/admin--products-market-select-dialog.html) | oyna | v2 |
| `/products` | admin | `admin-products-edit-dialog` — Mahsulotni tahrirlash<br>↳ `src/pages/products/list/ui/EditProductDialog.tsx` | [design/fragments/admin--products-edit-dialog.html](fragments/admin--products-edit-dialog.html) | oyna | v2 |
| `/products` | admin | `admin-products-delete-dialog` — Mahsulotni o'chirish<br>↳ `src/pages/products/ui/useDeleteProductConfirm.tsx` | [design/fragments/admin--products-delete-dialog.html](fragments/admin--products-delete-dialog.html) | oyna | v2 |
| `/products` | manager | `manager-products-list` — Mahsulotlar ro'yxati | [design/fragments/admin--products-list.html](fragments/admin--products-list.html) | sahifa | v2 |
| `/products` | manager | `manager-products-market-select-dialog` — Mahsulot uchun market tanlash<br>↳ `src/pages/products/list/ui/SelectMarketDialog.tsx` | [design/fragments/admin--products-market-select-dialog.html](fragments/admin--products-market-select-dialog.html) | oyna | v2 |
| `/products` | manager | `manager-products-edit-dialog` — Mahsulotni tahrirlash<br>↳ `src/pages/products/list/ui/EditProductDialog.tsx` | [design/fragments/admin--products-edit-dialog.html](fragments/admin--products-edit-dialog.html) | oyna | v2 |
| `/products` | manager | `manager-products-delete-dialog` — Mahsulotni o'chirish<br>↳ `src/pages/products/ui/useDeleteProductConfirm.tsx` | [design/fragments/admin--products-delete-dialog.html](fragments/admin--products-delete-dialog.html) | oyna | v2 |
| `/products` | registrator | `registrator-products-list` — Mahsulotlar ro'yxati | [design/fragments/admin--products-list.html](fragments/admin--products-list.html) | sahifa | v2 |
| `/products` | registrator | `registrator-products-market-select-dialog` — Mahsulot uchun market tanlash<br>↳ `src/pages/products/list/ui/SelectMarketDialog.tsx` | [design/fragments/admin--products-market-select-dialog.html](fragments/admin--products-market-select-dialog.html) | oyna | v2 |
| `/products` | registrator | `registrator-products-edit-dialog` — Mahsulotni tahrirlash<br>↳ `src/pages/products/list/ui/EditProductDialog.tsx` | [design/fragments/admin--products-edit-dialog.html](fragments/admin--products-edit-dialog.html) | oyna | v2 |
| `/products` | registrator | `registrator-products-delete-dialog` — Mahsulotni o'chirish<br>↳ `src/pages/products/ui/useDeleteProductConfirm.tsx` | [design/fragments/admin--products-delete-dialog.html](fragments/admin--products-delete-dialog.html) | oyna | v2 |
| `/products` | market | `market-products-list` — Mahsulotlar | [design/fragments/market--products-list.html](fragments/market--products-list.html) | sahifa | v2 |
| `/products` | market | `market-products-edit-dialog` — Mahsulotni tahrirlash<br>↳ `src/pages/products/list/ui/EditProductDialog.tsx` | [design/fragments/market--products-edit-dialog.html](fragments/market--products-edit-dialog.html) | oyna | v2 |
| `/products` | market | `market-products-delete-dialog` — Mahsulotni o'chirish<br>↳ `src/pages/products/ui/useDeleteProductConfirm.tsx` | [design/fragments/admin--products-delete-dialog.html](fragments/admin--products-delete-dialog.html) | oyna | v2 |

#### `/products/create-product/:id` — Mahsulot yaratish (:id — market; dizayn v2)

- **Fayllar:** `src/pages/products/create/index.tsx` · `src/pages/products/ui/ProductImageField.tsx` · `src/pages/products/ui/ProductThumb.tsx` · `src/pages/products/ui/useDeleteProductConfirm.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canCreateProducts` (access.ts → canCreateProducts)
- **Rollar:** superadmin, admin, manager, registrator, market
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** O'ngdagi «Market mahsulotlari» ro'yxati bitta so'rovda (limit 500 — PRODUCT_LIST_MAX_LIMIT); qalam — forma tahrir rejimi; nofaol market — yaratish bloklanadi.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/products/create-product/:id` | superadmin | `superadmin-products-create` — Mahsulot yaratish (market uchun) | [design/fragments/superadmin--products-create.html](fragments/superadmin--products-create.html) | sahifa | v2 |
| `/products/create-product/:id` | admin | `admin-products-create` — Mahsulot yaratish | [design/fragments/admin--products-create.html](fragments/admin--products-create.html) | sahifa | v2 |
| `/products/create-product/:id` | manager | `manager-products-create` — Mahsulot yaratish | [design/fragments/admin--products-create.html](fragments/admin--products-create.html) | sahifa | v2 |
| `/products/create-product/:id` | registrator | `registrator-products-create` — Mahsulot yaratish | [design/fragments/admin--products-create.html](fragments/admin--products-create.html) | sahifa | v2 |
| `/products/create-product/:id` | market | `market-products-create` — Mahsulot yaratish | [design/fragments/market--products-create.html](fragments/market--products-create.html) | sahifa | v2 |

### Foydalanuvchilar

#### `/all-users` — Foydalanuvchilar ro'yxati (dizayn v2)

- **Fayllar:** `src/pages/users/list/UserListPage.tsx` · `src/widgets/user-list/ui/UserListTable.tsx` · `src/widgets/user-list/ui/UserListKpi.tsx` · `src/widgets/user-list/ui/UserRowMenu.tsx` · `src/features/user/update-user/ui/UpdateUserModal.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canManageUsers` (access.ts → canViewUsers) → `canViewUsers` (access.ts → canViewUsers)
- **Rollar:** superadmin, admin, manager (filial turi aniq bo'lsa)
- **Menyuda:** «Foydalanuvchilar» (`users`) — superadmin, admin, manager (HQ · PICKUP · REGIONAL · HYBRID)
- **Holat:** v2
- **Izoh:** Tablar, qidiruv va holat — URL'da (role, search, status); menejerda amallar yo'q, GET branches so'ralmaydi. Chizilmaganlar (backend ro'yxatda superadmin va mijozni bermaydi, spec §6): KPI «shundan {n} ta mijoz», segbar «Mijozlar», tablar «Superadminlar», «Mijozlar». Ega savoli Q8 sukuti: sarlavha izohi maketdagidek («… va mijozlar hisoblarini boshqarish»).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/all-users` | superadmin | `superadmin-users-list` — Foydalanuvchilar ro'yxati | [design/fragments/superadmin--users-list.html](fragments/superadmin--users-list.html) | sahifa | v2 |
| `/all-users` | superadmin | `superadmin-users-delete-dialog` — Foydalanuvchini o'chirish (tasdiq)<br>↳ `src/widgets/user-list/ui/UserListTable.tsx` | [design/fragments/superadmin--users-delete-dialog.html](fragments/superadmin--users-delete-dialog.html) | oyna | v2 |
| `/all-users` | admin | `admin-users-list` — Foydalanuvchilar ro'yxati | [design/fragments/superadmin--users-list.html](fragments/superadmin--users-list.html) | sahifa | v2 |
| `/all-users` | admin | `admin-users-delete-dialog` — Foydalanuvchini o'chirish<br>↳ `src/widgets/user-list/ui/UserListTable.tsx` | [design/fragments/admin--users-delete-dialog.html](fragments/admin--users-delete-dialog.html) | oyna | v2 |
| `/all-users` | manager | `manager-users-list` — Foydalanuvchilar (filial xodimlari) | [design/fragments/manager--users-list.html](fragments/manager--users-list.html) | sahifa | v2 |

#### `/all-users/create-user` — Foydalanuvchi yaratish (dizayn v2)

- **Fayllar:** `src/pages/users/create/CreateUserPage.tsx` · `src/features/user/create-user/ui/CreateUserForm.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canManageUsers` (access.ts → canViewUsers) → `canViewUsers` (access.ts → canViewUsers)
- **Rollar:** superadmin, admin, manager (filial turi aniq bo'lsa)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Menejer: oddiy filialda — kuryer; HYBRID filialda — rol tanlash (kuryer yoki registrator).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/all-users/create-user` | superadmin | `superadmin-users-create` — Foydalanuvchi yaratish | [design/fragments/superadmin--users-create.html](fragments/superadmin--users-create.html) | sahifa | v2 |
| `/all-users/create-user` | admin | `admin-users-create` — Yangi foydalanuvchi | [design/fragments/admin--users-create.html](fragments/admin--users-create.html) | sahifa | v2 |
| `/all-users/create-user` | manager | `manager-users-create-courier` — Yangi xodim — kuryer | [design/fragments/manager--users-create-courier.html](fragments/manager--users-create-courier.html) | sahifa | v2 |
| `/all-users/create-user` | manager | `manager-users-create-hybrid` — Yangi xodim — Aralash filial (rol tanlash) | [design/fragments/manager--users-create-hybrid.html](fragments/manager--users-create-hybrid.html) | sahifa | v2 |

#### `/all-users/:id` — Foydalanuvchi tafsiloti (dizayn v2)

- **Fayllar:** `src/pages/users/detail/UserDetailPage.tsx` · `src/widgets/user-detail/ui/UserDetailView.tsx` · `src/widgets/user-detail/ui/MarketTelegramTokenCard.tsx` · `src/features/user/update-user/ui/UpdateUserModal.tsx` · `src/features/courier-transfer-branch/ui/TransferCourierButton.tsx` · `src/features/courier-transfer-branch/ui/TransferCourierModal.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canManageUsers` (access.ts → canViewUsers) → `canViewUsers` (access.ts → canViewUsers)
- **Rollar:** superadmin, admin, manager (filial turi aniq bo'lsa)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Yangi v2 UserDetailView; eski UserDetailWidget faqat /profile uchun muzlatilgan. «Faoliyat» (Taklif) chizilmaydi. Ega savoli Q9 sukuti: menejer xodimidagi «Oylik maosh» kartasi (to'plangan / kun qoldi) chizilmaydi — faqat «Profil ma'lumotlari»dagi maosh va to'lov kuni. Mijoz (customer) — maket yo'q, eng yaqini superadmin-users-detail.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/all-users/:id` | superadmin | `superadmin-users-detail` — Foydalanuvchi tafsilotlari | [design/fragments/superadmin--users-detail.html](fragments/superadmin--users-detail.html) | sahifa | v2 |
| `/all-users/:id` | superadmin | `superadmin-users-edit-dialog` — Foydalanuvchini tahrirlash (modal)<br>↳ `src/features/user/update-user/ui/UpdateUserModal.tsx` | [design/fragments/superadmin--users-edit-dialog.html](fragments/superadmin--users-edit-dialog.html) | oyna | v2 |
| `/all-users/:id` | superadmin | `superadmin-users-courier-transfer-dialog` — Kuryerni boshqa filialga o'tkazish<br>↳ `src/features/courier-transfer-branch/ui/TransferCourierModal.tsx` | [design/fragments/superadmin--users-courier-transfer-dialog.html](fragments/superadmin--users-courier-transfer-dialog.html) | oyna | v2 |
| `/all-users/:id` | admin | `admin-users-detail` — Foydalanuvchi tafsiloti | [design/fragments/admin--users-detail.html](fragments/admin--users-detail.html) | sahifa | v2 |
| `/all-users/:id` | admin | `admin-users-edit-dialog` — Foydalanuvchini tahrirlash<br>↳ `src/features/user/update-user/ui/UpdateUserModal.tsx` | [design/fragments/admin--users-edit-dialog.html](fragments/admin--users-edit-dialog.html) | oyna | v2 |
| `/all-users/:id` | admin | `admin-users-transfer-courier-dialog` — Kuryerni boshqa filialga o'tkazish<br>↳ `src/features/courier-transfer-branch/ui/TransferCourierModal.tsx` | [design/fragments/superadmin--users-courier-transfer-dialog.html](fragments/superadmin--users-courier-transfer-dialog.html) | oyna | v2 |
| `/all-users/:id` | manager | `manager-users-detail` — Xodim tafsiloti | [design/fragments/manager--users-detail.html](fragments/manager--users-detail.html) | sahifa | v2 |
| `/all-users/:id` | manager | `manager-users-edit-dialog` — Xodimni tahrirlash<br>↳ `src/features/user/update-user/ui/UpdateUserModal.tsx` | [design/fragments/manager--users-edit-dialog.html](fragments/manager--users-edit-dialog.html) | oyna | v2 |

### Hududlar

#### `/regions` — Hududlar — xarita va statistika (menejer/kuryer: o'z viloyati; dizayn v2)

- **Fayllar:** `src/pages/region/index.tsx` · `src/pages/region/ui/RegionsOverview.tsx` · `src/pages/region/ui/RegionsMapCard.tsx` · `src/pages/region/ui/RegionsSuccessCards.tsx` · `src/pages/region/ui/UzbekistanRegionMap.tsx` · `src/pages/region/ui/RegionPeriodControls.tsx` · `src/pages/region/ui/regionBlocks.tsx` · `src/pages/region/ui/ScopedRegionView.tsx` · `src/pages/region/ui/ScopedDistricts.tsx` · `src/pages/region/model/regionsModel.ts` · `src/pages/region/model/scopedModel.ts` · `src/pages/region/model/regionPeriod.ts` · `src/widgets/region-detail/ui/RegionDetailDialog.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewRegionStats` (routes.tsx → canViewRegionStats)
- **Rollar:** superadmin, admin, manager, courier
- **Menyuda:** «Hududlar» (`regions`) — superadmin, admin, manager, courier
- **Holat:** v2
- **Izoh:** Viloyat oynasi — umumiy RegionDetailDialog (widgets/region-detail, lazy; bosh sahifa kartogrammasi ham shu). Menejer va kuryer — GET region/my/district-stats (stats/all va orders so'rovlari yo'q). Ega savollari sukuti: Q11 xarita — Highcharts lazy, v2 tokenlar; Q12 scoped sarlavhalarda filial / «sizga tegishli» da'vosi yo'q («{viloyat} buyurtmalari · …» — backend butun viloyat raqamlarini beradi). Chizilmagan: oynadagi «Kunlik buyurtmalar» (Taklif), scoped filial/kuryer kesimi (API yo'q).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/regions` | superadmin | `superadmin-regions-map` — Hududlar — xarita va statistika | [design/fragments/superadmin--regions-map.html](fragments/superadmin--regions-map.html) | sahifa | v2 |
| `/regions` | superadmin | `superadmin-regions-region-modal` — Viloyat ma'lumotlari (modal)<br>↳ `src/widgets/region-detail/ui/RegionDetailDialog.tsx` | [design/fragments/superadmin--regions-region-modal.html](fragments/superadmin--regions-region-modal.html) | oyna | v2 |
| `/regions` | admin | `admin-regions-map` — Hududlar xaritasi | [design/fragments/admin--regions-map.html](fragments/admin--regions-map.html) | sahifa | v2 |
| `/regions` | admin | `admin-regions-region-detail-dialog` — Viloyat ma'lumotlari oynasi<br>↳ `src/widgets/region-detail/ui/RegionDetailDialog.tsx` | [design/fragments/admin--regions-region-detail-dialog.html](fragments/admin--regions-region-detail-dialog.html) | oyna | v2 |
| `/regions` | manager | `manager-regions-scoped` — Hudud — tumanlar statistikasi<br>↳ `src/pages/region/ui/ScopedRegionView.tsx` | [design/fragments/manager--regions-scoped.html](fragments/manager--regions-scoped.html) | sahifa | v2 |
| `/regions` | courier | `courier-regions-scoped` — Hududlar — o'z viloyatim<br>↳ `src/pages/region/ui/ScopedRegionView.tsx` | [design/fragments/courier--regions-scoped.html](fragments/courier--regions-scoped.html) | sahifa | v2 |
| `/regions` | tizim taxtasi | `tizim-charts` — Grafiklar — statistika va tahlil | [design/fragments/tizim--charts.html](fragments/tizim--charts.html) | taxta | qoida |

#### `/regions/districts` — Tumanlar boshqaruvi

- **Fayllar:** `src/pages/region/pages/districts/index.tsx` · `src/pages/region/ui/DistrictBoard.tsx` · `src/pages/region/model/boardModel.ts`
- **Qobiq:** DashboardLayout › Region (`src/pages/region/index.tsx`) · **Guard:** `canViewRegionStats` (routes.tsx → canViewRegionStats)
- **Rollar:** superadmin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Komponent ichida: superadmin bo'lmasa → /regions.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/regions/districts` | superadmin | `superadmin-regions-districts` — Tumanlar boshqaruvi<br>↳ `src/pages/region/pages/districts/index.tsx` | [design/fragments/superadmin--regions-districts.html](fragments/superadmin--regions-districts.html) | sahifa | v2 |

#### `/regions/sato-management` — Tumanlarni o'tkazish (SATO)

- **Fayllar:** `src/pages/region/pages/sato-management/index.tsx` · `src/pages/region/ui/DistrictBoard.tsx` · `src/pages/region/ui/MoveDistrictDialog.tsx` · `src/pages/region/model/boardModel.ts`
- **Qobiq:** DashboardLayout › Region (`src/pages/region/index.tsx`) · **Guard:** `canViewRegionStats` (routes.tsx → canViewRegionStats)
- **Rollar:** superadmin, admin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Komponent ichida: superadmin/admin bo'lmasa → /regions. Telefonda sudrash o'rniga ⇆ — MoveDistrictDialog (maket yo'q — eng yaqini superadmin-regions-sato-management).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/regions/sato-management` | superadmin | `superadmin-regions-sato-management` — Tumanlarni o'tkazish (SATO) | [design/fragments/superadmin--regions-sato-management.html](fragments/superadmin--regions-sato-management.html) | sahifa | v2 |
| `/regions/sato-management` | admin | `admin-regions-sato-management` — Tumanlarni o'tkazish | [design/fragments/admin--regions-sato-management.html](fragments/admin--regions-sato-management.html) | sahifa | v2 |

#### `/regions/logist-assignment` — Logist biriktirish

- **Fayllar:** `src/pages/region/pages/logist-assignment/index.tsx`
- **Qobiq:** DashboardLayout › Region (`src/pages/region/index.tsx`) · **Guard:** `canViewRegionStats` (routes.tsx → canViewRegionStats)
- **Rollar:** superadmin, admin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Komponent ichida: superadmin/admin bo'lmasa → /regions. Ega savoli Q13 sukuti: maketdagi bo'sh holat «Bo'lim hali ishga tushmagan» + «Hududlarga qaytish» (backend'da GET /logists, PATCH region/{id}/logist bor — ishlaydigan sahifa uchun maket kerak).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/regions/logist-assignment` | superadmin | `superadmin-regions-logist-assignment` — Logist biriktirish | [design/fragments/superadmin--regions-logist-assignment.html](fragments/superadmin--regions-logist-assignment.html) | sahifa | v2 |
| `/regions/logist-assignment` | admin | `admin-regions-logist-assignment` — Logist biriktirish | [design/fragments/superadmin--regions-logist-assignment.html](fragments/superadmin--regions-logist-assignment.html) | sahifa | v2 |

### Filiallar

#### `/branches` — Filiallar — daraxt / jadval / kartalar (dizayn v2)

- **Fayllar:** `src/pages/branches/ui/BranchesPage.tsx` · `src/widgets/branch-list/ui/BranchListWidget.tsx` · `src/widgets/branch-list/ui/BranchSummaryCard.tsx` · `src/widgets/branch-list/ui/BranchTree.tsx` · `src/widgets/branch-list/ui/BranchTable.tsx` · `src/widgets/branch-list/ui/BranchCards.tsx` · `src/widgets/branch-list/ui/BranchRowMenu.tsx` · `src/features/branch-create/ui/BranchFormModal.tsx` · `src/features/branch/ui/BranchFormDialog.tsx` · `src/features/branch-edit/ui/BranchEditModal.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewBranches` (access.ts → canViewBranches)
- **Rollar:** superadmin
- **Menyuda:** «Filiallar» (`branches`) — superadmin
- **Holat:** v2
- **Izoh:** Tahrirlash oynasi — yaratish oynasi bilan bir xil forma (BranchFormDialog; maket yo'q — eng yaqini superadmin-branches-create-dialog).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/branches` | superadmin | `superadmin-branches-list-tree` — Filiallar — daraxt ko'rinishi<br>↳ `src/widgets/branch-list/ui/BranchTree.tsx` | [design/fragments/superadmin--branches-list-tree.html](fragments/superadmin--branches-list-tree.html) | sahifa | v2 |
| `/branches` | superadmin | `superadmin-branches-list-table` — Filiallar — jadval / kartalar<br>↳ `src/widgets/branch-list/ui/BranchTable.tsx` | [design/fragments/superadmin--branches-list-table.html](fragments/superadmin--branches-list-table.html) | sahifa | v2 |
| `/branches` | superadmin | `superadmin-branches-create-dialog` — Yangi filial (modal)<br>↳ `src/features/branch/ui/BranchFormDialog.tsx` | [design/fragments/superadmin--branches-create-dialog.html](fragments/superadmin--branches-create-dialog.html) | oyna | v2 |

#### `/branches/:id` — Filial tafsiloti (dizayn v2)

- **Fayllar:** `src/pages/branches/ui/BranchDetailPage.tsx` · `src/widgets/branch-detail/ui/BranchDetailWidget.tsx` · `src/widgets/branch-detail/ui/BranchEmployeesSection.tsx` · `src/features/branch-add-employee/ui/AddEmployeeModal.tsx` · `src/features/branch-remove-employee/ui/RemoveEmployeeButton.tsx` · `src/features/courier-transfer-branch/ui/TransferCourierButton.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewBranches` (access.ts → canViewBranches)
- **Rollar:** superadmin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** 404 — sahifada «Filial topilmadi» (global xabar takrorlanmaydi). Ega savollari sukuti: Q10 «Filial ko'rsatkichlari» bo'limi (KPI, daromad trendi, holat, kuryerlar reytingi) chizilmaydi — analytics branch_id qabul qilmaydi (backend kartasi kerak); Q14 filial sozlamalari (config) — sahifada hech qachon chizilmagan, o'lik kod sifatida o'chirildi.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/branches/:id` | superadmin | `superadmin-branches-detail` — Filial tafsiloti | [design/fragments/superadmin--branches-detail.html](fragments/superadmin--branches-detail.html) | sahifa | v2 |
| `/branches/:id` | superadmin | `superadmin-branches-add-employee-dialog` — Xodim qo'shish (modal)<br>↳ `src/features/branch-add-employee/ui/AddEmployeeModal.tsx` | [design/fragments/superadmin--branches-add-employee-dialog.html](fragments/superadmin--branches-add-employee-dialog.html) | oyna | v2 |

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

124 ta maket · kodda bor: 121 · kodda yo'q: 3

| Maket | Sarlavha | Tur | Route | Asosiy fayl | Holat |
|---|---|---|---|---|---|
| `superadmin-dashboard-main` | Dashboard — Bugungi statistika | sahifa | `/` | `src/pages/dashboard/DashboardPage.tsx` | v2 |
| `superadmin-dashboard-region-modal` | Dashboard — Viloyat tafsiloti (xarita) | oyna | `/` | `src/widgets/region-detail/ui/RegionDetailDialog.tsx` | v2 |
| `superadmin-orders-list` | Buyurtmalar ro'yxati | sahifa | `/orders` | `src/pages/orders/index.tsx` | v2 |
| `superadmin-orders-filters-mobile` | Buyurtmalar — filtr paneli (telefon) | oyna · faqat telefon | `/orders` | `src/pages/orders/list/OrderFilters.tsx` | v2 |
| `superadmin-orders-detail` | Buyurtma tafsilotlari | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | v2 |
| `superadmin-orders-detail-edit-order-dialog` | Buyurtmani tahrirlash (popup) | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/editDialogs/EditOrderDialog.tsx` | v2 |
| `superadmin-orders-detail-edit-customer-dialog` | Mijoz ma'lumotini tahrirlash (popup) | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/editDialogs/EditCustomerDialog.tsx` | v2 |
| `superadmin-orders-detail-edit-address-dialog` | Manzilni tahrirlash (popup) | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/editDialogs/EditAddressDialog.tsx` | v2 |
| `superadmin-neworders-markets` | Qabul va yaratish — Marketlar | sahifa | `/new-orders` | `src/pages/new_orders/markets/index.tsx` | v2 |
| `superadmin-neworders-market-orders` | Market yangi buyurtmalari (qabul) | sahifa | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | v2 |
| `superadmin-neworders-market-orders-camera` | Market yangi buyurtmalari (qabul) — kamera | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | yangi (kodda yo'q) — Kamera rejimi yo'q — sahifa faqat USB/klaviatura skaneri bilan ishlaydi (useOrderQrScanner). |
| `superadmin-neworders-receive-confirm-dialog` | Qo'lda qabul qilish (tasdiq) | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | v2 |
| `superadmin-neworders-market-order-edit` | Market buyurtmasini tahrirlash | sahifa | `/new-orders/:marketId/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | v2 |
| `superadmin-neworders-create-manual-step1` | Buyurtma yaratish — 1-qadam: Market | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/Step1Market.tsx` | v2 |
| `superadmin-neworders-create-market-picker-dialog` | Market tanlash (modal) | oyna | `/new-orders/create` | `src/pages/orders/create/ui/MarketPicker.tsx` | v2 |
| `superadmin-neworders-create-manual-step2` | Buyurtma yaratish — 2-qadam: Mijoz va mahsulot | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/Step2Combined.tsx` | v2 |
| `superadmin-neworders-create-ai-input` | Buyurtma yaratish — AI bilan (kiritish) | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiInputPanel.tsx` | v2 |
| `superadmin-neworders-create-ai-preview` | Buyurtma yaratish — AI natijalari (preview) | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiPreviewCard.tsx` | v2 |
| `superadmin-neworders-create-ai-confirm-dialog` | AI — yaratishni tasdiqlash | oyna | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | v2 |
| `superadmin-neworders-incoming-sources` | Kiruvchi posilkalar — manba tanlash | sahifa | `/new-orders/incoming` | `src/pages/incoming-orders/SourcePicker.tsx` | v2 |
| `superadmin-neworders-incoming-scan` | Kiruvchi posilkalar — skanerlab qabul | sahifa | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | v2 |
| `superadmin-neworders-incoming-scan-camera` | Kiruvchi posilkalar — skanerlab qabul — kamera | oyna | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | yangi (kodda yo'q) — Kamera rejimi yo'q — faqat USB/klaviatura skaneri. |
| `superadmin-neworders-branches` | Filial batchlari — filiallar | sahifa | `/new-orders/branches` | `src/pages/new_orders/branches/index.tsx` | v2 |
| `superadmin-neworders-branch-batches` | Filial batchlari ro'yxati | sahifa | `/new-orders/branches/:branchId` | `src/pages/new_orders/branches/batches.tsx` | v2 |
| `superadmin-neworders-branch-batch-detail` | Filial paketi tafsiloti | sahifa | `/new-orders/branches/:branchId/batches/:batchId` | `src/pages/new_orders/branches/batchDetail.tsx` | v2 |
| `superadmin-neworders-branch-batch-detail-camera` | Filial paketi tafsiloti — kamera | oyna | `/new-orders/branches/:branchId/batches/:batchId` | `src/pages/new_orders/branches/batchDetail.tsx` | yangi (kodda yo'q) — Kamera rejimi yo'q — faqat USB/klaviatura skaneri (useOrderQrScanner). |
| `superadmin-neworders-cancelled-markets` | Bekor qilinganlar — marketlar | sahifa | `/new-orders/cancelled` | `src/pages/new_orders/cancelled/index.tsx` | v2 |
| `superadmin-neworders-cancelled-handover` | Bekor qilinganlarni marketga topshirish | sahifa | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | v2 |
| `superadmin-neworders-cancelled-handover-camera` | Bekor qilinganlarni marketga topshirish — kamera | oyna | `/new-orders/cancelled/:marketId` | `src/shared/components/ScannerCameraModal.tsx` | qisman — Sahifa qismi (sarlavha, «Market QR» holati, «USB skaner tayyor» qatori, tanlov, jadval) v2; kamera oynasining o'zi (ScannerCameraModal, umumiy) hali v1 — kamera rejimi keyinroq, alohida. |
| `superadmin-neworders-cancelled-manual-dialog` | QR buzilganini tasdiqlash (modal) | oyna | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/ui/ManualConfirmDialog.tsx` | v2 |
| `superadmin-neworders-cancelled-scanner-dialog` | Kamera skaneri (modal) | oyna | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | qisman — Desktop/planshetdagi sahifa holati («Market QR kerak», «USB skaner tayyor», «Hali buyurtma tanlanmagan», skan bilan tanlov) v2; telefondagi kamera skaneri oynasi (ScannerCameraModal, umumiy) hali v1 — kamera rejimi keyinroq, alohida. |
| `superadmin-mails-today` | Pochta — Bugungi pochtalar | sahifa | `/mails/today` | `src/pages/mails/components/todaysMails.tsx` | v2 |
| `superadmin-mails-return` | Pochta — Qaytarish so'rovlari | sahifa | `/mails/return` | `src/pages/mails/components/returnMails.tsx` | v2 |
| `superadmin-mails-refused` | Pochta — Rad etilgan pochtalar | sahifa | `/mails/refused` | `src/pages/mails/components/refusedMails.tsx` | v2 |
| `superadmin-mails-old` | Pochta — Eski pochtalar | sahifa | `/mails/old` | `src/pages/mails/components/oldMails.tsx` | v2 |
| `superadmin-mails-old-batches` | Pochta — Hamma batchlar (eski) | sahifa | `/mails/old` | `src/pages/mails/components/oldMails.tsx` | v2 |
| `superadmin-mails-detail` | Pochta tafsiloti (jo'natish) | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | v2 |
| `superadmin-mails-detail-camera` | Pochta tafsiloti (jo'natish) — kamera | oyna | `/mails/:id` | `src/pages/mails/detail/index.tsx` | qisman — Sahifa qismi (sarlavha, statistika, «Buyurtmalar» kartasi, «USB skaner tayyor» belgisi, tanlov tasmasi, jadval) v2; «Kamera» tugmasi va kamera oynasi yo'q — faqat USB/klaviatura skaneri (useOrderQrScanner). Kamera rejimi keyinroq, alohida. |
| `superadmin-mails-detail-send-dialog` | Pochtani filialga jo'natish (modal) | oyna | `/mails/:id` | `src/pages/mails/detail/ui/SendPostModal.tsx` | v2 |
| `superadmin-mails-detail-refused` | Rad etilgan pochta tafsiloti (qabul) | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | v2 |
| `superadmin-mails-detail-old` | Eski pochta tafsiloti (faqat o'qish) | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | v2 |
| `superadmin-batches-new` | Paketlar — Yangi | sahifa | `/batches` | `src/pages/batches/ui/BatchesPage.tsx` | v2 |
| `superadmin-batches-old` | Paketlar — Eski | sahifa | `/batches` | `src/pages/batches/ui/BatchesPage.tsx` | v2 |
| `superadmin-batches-return` | Paketlar — Qaytarilgan | sahifa | `/batches` | `src/pages/batches/ui/BatchesPage.tsx` | v2 |
| `superadmin-batches-detail` | Paket tafsiloti | sahifa | `/batches/:id` | `src/pages/batches/ui/BatchDetailPage.tsx` | v2 |
| `superadmin-returns-list` | Return batchlar | sahifa | `/returns` | `src/pages/returns/index.tsx` | v2 |
| `superadmin-payments-overview` | To'lovlar — umumiy | sahifa | `/payments` | `src/pages/payments/index.tsx` | v2 |
| `superadmin-payments-market-picker-dialog` | Berilishi kerak / Qabul qilinishi kerak — tanlash | oyna | `/payments` | `src/pages/payments/components/SettlementPickerDialog.tsx` | v2 |
| `superadmin-payments-history-detail-dialog` | To'lov tarixi — yozuv tafsiloti | oyna | `/payments` | `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | v2 |
| `superadmin-payments-main-cashbox` | Asosiy kassa | sahifa | `/payments/main-cashbox` | `src/pages/payments/components/mainCashbox.tsx` | v2 |
| `superadmin-payments-main-cashbox-fill-dialog` | Kassani to'ldirish / Kassadan xarajat (popup) | oyna | `/payments/main-cashbox` | `src/pages/payments/components/CashboxFormPopup.tsx` | v2 |
| `superadmin-payments-main-cashbox-shift-dialog` | Smenani yopish (popup) | oyna | `/payments/main-cashbox` | `src/pages/payments/components/CloseShiftPopup.tsx` | v2 |
| `superadmin-payments-cash-detail-courier` | Kuryer kassasi (qabul qilish) | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | v2 |
| `superadmin-payments-cash-detail-market` | Market kassasi (to'lov berish) | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | v2 |
| `superadmin-payments-cash-detail-branch` | Filial kassasi (filialdan qabul) | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | v2 |
| `superadmin-payments-to-give-dialog` | Berilishi kerak — market tanlash | oyna | `/payments` | `src/pages/payments/components/SettlementPickerDialog.tsx` | v2 |
| `superadmin-balance-overview` | Balans — Umumiy ko'rinish | sahifa | `/financial-balance` | `src/pages/financial-balance/components/Statistics.tsx` | v2 |
| `superadmin-balance-history` | Balans — Tarix | sahifa | `/financial-balance` | `src/pages/financial-balance/components/HistoryTab.tsx` | v2 |
| `superadmin-balance-entry-dialog` | Qo'lda yozuv qo'shish (modal) | oyna | `/financial-balance` | `src/pages/financial-balance/components/FinancialEntryModal.tsx` | v2 |
| `superadmin-balance-analysis` | Balans — Tahlil | sahifa | `/financial-balance` | `src/pages/financial-balance/components/AnalysisTab.tsx` | v2 |
| `superadmin-balance-history-detail-dialog` | Balans yozuvi tafsiloti | oyna | `/financial-balance` | `src/pages/financial-balance/components/FinancialHistoryDetail.tsx` | v2 |
| `superadmin-products-list` | Mahsulotlar ro'yxati | sahifa | `/products` | `src/pages/products/list/index.tsx` | v2 |
| `superadmin-products-select-market-dialog` | Mahsulot yaratish — market tanlash | oyna | `/products` | `src/pages/products/list/ui/SelectMarketDialog.tsx` | v2 |
| `superadmin-products-edit-dialog` | Mahsulotni tahrirlash (popup) | oyna | `/products` | `src/pages/products/list/ui/EditProductDialog.tsx` | v2 |
| `superadmin-products-create` | Mahsulot yaratish (market uchun) | sahifa | `/products/create-product/:id` | `src/pages/products/create/index.tsx` | v2 |
| `superadmin-products-delete-dialog` | Mahsulotni o'chirish | oyna | `/products` | `src/pages/products/ui/useDeleteProductConfirm.tsx` | v2 |
| `superadmin-users-list` | Foydalanuvchilar ro'yxati | sahifa | `/all-users` | `src/pages/users/list/UserListPage.tsx` | v2 |
| `superadmin-users-delete-dialog` | Foydalanuvchini o'chirish (tasdiq) | oyna | `/all-users` | `src/widgets/user-list/ui/UserListTable.tsx` | v2 |
| `superadmin-users-create` | Foydalanuvchi yaratish | sahifa | `/all-users/create-user` | `src/pages/users/create/CreateUserPage.tsx` | v2 |
| `superadmin-users-detail` | Foydalanuvchi tafsilotlari | sahifa | `/all-users/:id` | `src/pages/users/detail/UserDetailPage.tsx` | v2 |
| `superadmin-users-edit-dialog` | Foydalanuvchini tahrirlash (modal) | oyna | `/all-users/:id` | `src/features/user/update-user/ui/UpdateUserModal.tsx` | v2 |
| `superadmin-users-courier-transfer-dialog` | Kuryerni boshqa filialga o'tkazish | oyna | `/all-users/:id` | `src/features/courier-transfer-branch/ui/TransferCourierModal.tsx` | v2 |
| `superadmin-regions-map` | Hududlar — xarita va statistika | sahifa | `/regions` | `src/pages/region/index.tsx` | v2 |
| `superadmin-regions-region-modal` | Viloyat ma'lumotlari (modal) | oyna | `/regions` | `src/widgets/region-detail/ui/RegionDetailDialog.tsx` | v2 |
| `superadmin-regions-districts` | Tumanlar boshqaruvi | sahifa | `/regions/districts` | `src/pages/region/pages/districts/index.tsx` | v2 |
| `superadmin-regions-sato-management` | Tumanlarni o'tkazish (SATO) | sahifa | `/regions/sato-management` | `src/pages/region/pages/sato-management/index.tsx` | v2 |
| `superadmin-regions-logist-assignment` | Logist biriktirish | sahifa | `/regions/logist-assignment` | `src/pages/region/pages/logist-assignment/index.tsx` | v2 |
| `superadmin-branches-list-tree` | Filiallar — daraxt ko'rinishi | sahifa | `/branches` | `src/widgets/branch-list/ui/BranchTree.tsx` | v2 |
| `superadmin-branches-list-table` | Filiallar — jadval / kartalar | sahifa | `/branches` | `src/widgets/branch-list/ui/BranchTable.tsx` | v2 |
| `superadmin-branches-create-dialog` | Yangi filial (modal) | oyna | `/branches` | `src/features/branch/ui/BranchFormDialog.tsx` | v2 |
| `superadmin-branches-detail` | Filial tafsiloti | sahifa | `/branches/:id` | `src/pages/branches/ui/BranchDetailPage.tsx` | v2 |
| `superadmin-branches-add-employee-dialog` | Xodim qo'shish (modal) | oyna | `/branches/:id` | `src/features/branch-add-employee/ui/AddEmployeeModal.tsx` | v2 |
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
| `superadmin-scan-result` | Skanerlangan buyurtma | sahifa | `/scan/:token` | `src/pages/scan/detail.tsx` | v2 |

### admin — Admin

91 ta maket · kodda bor: 88 · kodda yo'q: 3

| Maket | Sarlavha | Tur | Route | Asosiy fayl | Holat |
|---|---|---|---|---|---|
| `admin-dashboard-main` | Dashboard | sahifa | `/` | `src/pages/dashboard/DashboardPage.tsx` | v2 |
| `admin-orders-list` | Buyurtmalar ro'yxati | sahifa | `/orders` | `src/pages/orders/index.tsx` | v2 |
| `admin-orders-filters-mobile` | Buyurtmalar — filtr paneli (telefon) | oyna · faqat telefon | `/orders` | `src/pages/orders/list/OrderFilters.tsx` | v2 |
| `admin-orders-detail` | Buyurtma tafsiloti | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | v2 |
| `admin-orders-edit-order-dialog` | Buyurtmani tahrirlash oynasi | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/editDialogs/EditOrderDialog.tsx` | v2 |
| `admin-orders-edit-customer-dialog` | Mijozni tahrirlash oynasi | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/editDialogs/EditCustomerDialog.tsx` | v2 |
| `admin-orders-edit-address-dialog` | Manzilni tahrirlash oynasi | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/editDialogs/EditAddressDialog.tsx` | v2 |
| `admin-neworders-markets` | Qabul — Marketlar tabi | sahifa | `/new-orders` | `src/pages/new_orders/markets/index.tsx` | v2 |
| `admin-neworders-market-detail` | Market yangi buyurtmalari | sahifa | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | v2 |
| `admin-neworders-market-detail-camera` | Market yangi buyurtmalari — kamera | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | yangi (kodda yo'q) — Kamera rejimi yo'q — faqat USB/klaviatura skaneri (useOrderQrScanner). |
| `admin-neworders-market-confirm-dialog` | Qabul tasdig'i / buyurtmani o'chirish | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | v2 |
| `admin-neworders-incoming-sources` | Kiruvchi posilkalar — manba tanlash | sahifa | `/new-orders/incoming` | `src/pages/incoming-orders/SourcePicker.tsx` | v2 |
| `admin-neworders-incoming-scan` | Kiruvchi posilkalarni skanerlash | sahifa | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | v2 |
| `admin-neworders-incoming-scan-camera` | Kiruvchi posilkalarni skanerlash — kamera | oyna | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | yangi (kodda yo'q) — Kamera rejimi yo'q — faqat USB/klaviatura skaneri. |
| `admin-neworders-branches` | Filial batchlari tabi | sahifa | `/new-orders/branches` | `src/pages/new_orders/branches/index.tsx` | v2 |
| `admin-neworders-branch-batches` | Filial batchlari ro'yxati | sahifa | `/new-orders/branches/:branchId` | `src/pages/new_orders/branches/batches.tsx` | v2 |
| `admin-neworders-branch-batch-detail` | Filial paketi tafsiloti | sahifa | `/new-orders/branches/:branchId/batches/:batchId` | `src/pages/new_orders/branches/batchDetail.tsx` | v2 |
| `admin-neworders-branch-batch-detail-camera` | Filial paketi tafsiloti — kamera | oyna | `/new-orders/branches/:branchId/batches/:batchId` | `src/pages/new_orders/branches/batchDetail.tsx` | yangi (kodda yo'q) — Kamera rejimi yo'q — faqat USB/klaviatura skaneri (useOrderQrScanner). |
| `admin-neworders-cancelled` | Bekor qilinganlar tabi | sahifa | `/new-orders/cancelled` | `src/pages/new_orders/cancelled/index.tsx` | v2 |
| `admin-neworders-cancelled-detail` | Bekor qilinganlarni marketga topshirish | sahifa | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | v2 |
| `admin-neworders-cancelled-detail-camera` | Bekor qilinganlarni marketga topshirish — kamera | oyna | `/new-orders/cancelled/:marketId` | `src/shared/components/ScannerCameraModal.tsx` | qisman — Sahifa qismi (sarlavha, «Market QR» holati, «USB skaner tayyor» qatori, tanlov, jadval) v2; kamera oynasining o'zi (ScannerCameraModal, umumiy) hali v1 — kamera rejimi keyinroq, alohida. |
| `admin-neworders-cancelled-manual-dialog` | QR buzilganini tasdiqlash | oyna | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/ui/ManualConfirmDialog.tsx` | v2 |
| `admin-neworders-cancelled-scanner-dialog` | Market QR skaneri | oyna | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | qisman — Desktop/planshetdagi sahifa holati («Market QR kerak», «USB skaner tayyor», «Hali buyurtma tanlanmagan», skan bilan tanlov) v2; telefondagi kamera skaneri oynasi (ScannerCameraModal, umumiy) hali v1 — kamera rejimi keyinroq, alohida. |
| `admin-neworders-create-manual` | Buyurtma yaratish — Qo'lda | sahifa | `/new-orders/create` | `src/pages/orders/create/index.tsx` | v2 |
| `admin-neworders-create-market-picker` | Market tanlash oynasi | oyna | `/new-orders/create` | `src/pages/orders/create/ui/MarketPicker.tsx` | v2 |
| `admin-neworders-create-ai` | Buyurtma yaratish — AI bilan | sahifa | `/new-orders/create` | `src/pages/orders/create/index.tsx` | v2 |
| `admin-neworders-create-ai-confirm-dialog` | AI yaratishni tasdiqlash | oyna | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | v2 |
| `admin-mails-today` | Pochta — Bugungi pochtalar | sahifa | `/mails/today` | `src/pages/mails/components/todaysMails.tsx` | v2 |
| `admin-mails-return` | Pochta — Qaytarish | sahifa | `/mails/return` | `src/pages/mails/components/returnMails.tsx` | v2 |
| `admin-mails-refused` | Pochta — Rad etilgan | sahifa | `/mails/refused` | `src/pages/mails/components/refusedMails.tsx` | v2 |
| `admin-mails-old` | Pochta — Eski pochtalar | sahifa | `/mails/old` | `src/pages/mails/components/oldMails.tsx` | v2 |
| `admin-mails-old-all-batches` | Eski pochtalar — Hamma batchlar | sahifa | `/mails/old` | `src/pages/mails/components/oldMails.tsx` | v2 |
| `admin-mails-detail` | Pochta tafsiloti | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | v2 |
| `admin-mails-detail-camera` | Pochta tafsiloti — kamera | oyna | `/mails/:id` | `src/pages/mails/detail/index.tsx` | qisman — Sahifa qismi (sarlavha, statistika, «Buyurtmalar» kartasi, «USB skaner tayyor» belgisi, tanlov tasmasi, jadval) v2; «Kamera» tugmasi va kamera oynasi yo'q — faqat USB/klaviatura skaneri (useOrderQrScanner). Kamera rejimi keyinroq, alohida. |
| `admin-mails-old-detail` | Eski pochta tafsiloti (tarix) | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | v2 |
| `admin-mails-refused-detail` | Rad etilgan pochta tafsiloti | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | v2 |
| `admin-mails-send-branch-dialog` | Pochtani filialga jo'natish | oyna | `/mails/:id` | `src/pages/mails/detail/ui/SendPostModal.tsx` | v2 |
| `admin-batches-new` | Paketlar — Yangi | sahifa | `/batches` | `src/pages/batches/ui/BatchesPage.tsx` | v2 |
| `admin-batches-old` | Paketlar — Eski | sahifa | `/batches` | `src/pages/batches/ui/BatchesPage.tsx` | v2 |
| `admin-batches-return` | Paketlar — Qaytarilgan | sahifa | `/batches` | `src/pages/batches/ui/BatchesPage.tsx` | v2 |
| `admin-batches-detail` | Paket tafsiloti | sahifa | `/batches/:id` | `src/pages/batches/ui/BatchDetailPage.tsx` | v2 |
| `admin-returns-list` | Return batchlar | sahifa | `/returns` | `src/pages/returns/index.tsx` | v2 |
| `admin-payments-overview` | To'lovlar | sahifa | `/payments` | `src/pages/payments/index.tsx` | v2 |
| `admin-payments-to-give-dialog` | Berilishi kerak — market tanlash | oyna | `/payments` | `src/pages/payments/components/SettlementPickerDialog.tsx` | v2 |
| `admin-payments-to-receive-dialog` | Qabul qilinishi kerak — tanlash | oyna | `/payments` | `src/pages/payments/components/SettlementPickerDialog.tsx` | v2 |
| `admin-payments-history-detail-dialog` | To'lov tarixi tafsiloti | oyna | `/payments` | `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | v2 |
| `admin-payments-main-cashbox` | Asosiy kassa | sahifa | `/payments/main-cashbox` | `src/pages/payments/components/mainCashbox.tsx` | v2 |
| `admin-payments-cashbox-form-dialog` | Kassadan xarajat / Kassani to'ldirish | oyna | `/payments/main-cashbox` | `src/pages/payments/components/CashboxFormPopup.tsx` | v2 |
| `admin-payments-shift-dialog` | Smenani yopish | oyna | `/payments/main-cashbox` | `src/pages/payments/components/CloseShiftPopup.tsx` | v2 |
| `admin-payments-cash-detail-market` | Market kassasi | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | v2 |
| `admin-payments-cash-detail-courier` | Kuryer kassasi | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | v2 |
| `admin-payments-cash-detail-branch` | Filial kassasi (HQ qabul) | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | v2 |
| `admin-balance-overview` | Balans — Umumiy ko'rinish | sahifa | `/financial-balance` | `src/pages/financial-balance/components/Statistics.tsx` | v2 |
| `admin-balance-history` | Balans — Tarix | sahifa | `/financial-balance` | `src/pages/financial-balance/components/HistoryTab.tsx` | v2 |
| `admin-balance-analysis` | Balans — Tahlil | sahifa | `/financial-balance` | `src/pages/financial-balance/components/AnalysisTab.tsx` | v2 |
| `admin-balance-entry-dialog` | Qo'lda yozuv qo'shish | oyna | `/financial-balance` | `src/pages/financial-balance/components/FinancialEntryModal.tsx` | v2 |
| `admin-balance-history-detail-dialog` | Balans yozuvi tafsiloti | oyna | `/financial-balance` | `src/pages/financial-balance/components/FinancialHistoryDetail.tsx` | v2 |
| `admin-products-list` | Mahsulotlar ro'yxati | sahifa | `/products` | `src/pages/products/list/index.tsx` | v2 |
| `admin-products-market-select-dialog` | Mahsulot uchun market tanlash | oyna | `/products` | `src/pages/products/list/ui/SelectMarketDialog.tsx` | v2 |
| `admin-products-edit-dialog` | Mahsulotni tahrirlash | oyna | `/products` | `src/pages/products/list/ui/EditProductDialog.tsx` | v2 |
| `admin-products-delete-dialog` | Mahsulotni o'chirish | oyna | `/products` | `src/pages/products/ui/useDeleteProductConfirm.tsx` | v2 |
| `admin-products-create` | Mahsulot yaratish | sahifa | `/products/create-product/:id` | `src/pages/products/create/index.tsx` | v2 |
| `admin-users-list` | Foydalanuvchilar ro'yxati | sahifa | `/all-users` | `src/pages/users/list/UserListPage.tsx` | v2 |
| `admin-users-delete-dialog` | Foydalanuvchini o'chirish | oyna | `/all-users` | `src/widgets/user-list/ui/UserListTable.tsx` | v2 |
| `admin-users-create` | Yangi foydalanuvchi | sahifa | `/all-users/create-user` | `src/pages/users/create/CreateUserPage.tsx` | v2 |
| `admin-users-detail` | Foydalanuvchi tafsiloti | sahifa | `/all-users/:id` | `src/pages/users/detail/UserDetailPage.tsx` | v2 |
| `admin-users-edit-dialog` | Foydalanuvchini tahrirlash | oyna | `/all-users/:id` | `src/features/user/update-user/ui/UpdateUserModal.tsx` | v2 |
| `admin-users-transfer-courier-dialog` | Kuryerni boshqa filialga o'tkazish | oyna | `/all-users/:id` | `src/features/courier-transfer-branch/ui/TransferCourierModal.tsx` | v2 |
| `admin-regions-map` | Hududlar xaritasi | sahifa | `/regions` | `src/pages/region/index.tsx` | v2 |
| `admin-regions-region-detail-dialog` | Viloyat ma'lumotlari oynasi | oyna | `/regions` | `src/widgets/region-detail/ui/RegionDetailDialog.tsx` | v2 |
| `admin-regions-sato-management` | Tumanlarni o'tkazish | sahifa | `/regions/sato-management` | `src/pages/region/pages/sato-management/index.tsx` | v2 |
| `admin-regions-logist-assignment` | Logist biriktirish | sahifa | `/regions/logist-assignment` | `src/pages/region/pages/logist-assignment/index.tsx` | v2 |
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
| `admin-scan-result` | Skanerlangan buyurtma | sahifa | `/scan/:token` | `src/pages/scan/detail.tsx` | v2 |

### manager — Menejer

64 ta maket · kodda bor: 62 · kodda yo'q: 2

| Maket | Sarlavha | Tur | Route | Asosiy fayl | Holat |
|---|---|---|---|---|---|
| `manager-branch-dashboard-main` | Filial paneli | sahifa | `/branch-dashboard` | `src/pages/branch-dashboard/ui/BranchDashboardPage.tsx` | v2 |
| `manager-dispatch-scan` | Biriktirish — skan savati | sahifa | `/dispatch` | `src/pages/dispatch/index.tsx` | v2 |
| `manager-dispatch-courier-dialog` | Kuryer tanlash oynasi | oyna | `/dispatch` | `src/pages/dispatch/index.tsx` | v2 |
| `manager-dispatch-camera-dialog` | Biriktirish — kamera | oyna | `/dispatch` | `src/pages/dispatch/index.tsx` | qisman — Sahifa v2; kamera oynasining o'zi (ScannerCameraModal, umumiy) hali v1 — kamera rejimi alohida ish. |
| `manager-orders-list-all` | Buyurtmalar — Hamma buyurtmalar | sahifa | `/orders` | `src/pages/orders/index.tsx` | v2 |
| `manager-orders-list-pending` | Buyurtmalar — Kutilayotgan | sahifa | `/orders` | `src/pages/orders/index.tsx` | v2 |
| `manager-orders-list-cancelled` | Buyurtmalar — Bekor qilinganlar (HQ'ga yuborish) | sahifa | `/orders` | `src/pages/orders/index.tsx` | v2 |
| `manager-orders-sell-dialog` | Sotish oynasi | oyna | `/orders`, `/orders/edit/:orderId` | `src/pages/orders/list/courier/list/SellModal.tsx` | v2 |
| `manager-orders-cancel-dialog` | Bekor qilish oynasi | oyna | `/orders`, `/orders/edit/:orderId` | `src/pages/orders/list/courier/list/CancelModal.tsx` | v2 |
| `manager-orders-rollback-dialog` | Buyurtmani qaytarish tasdig'i | oyna | `/orders`, `/orders/edit/:orderId` | `src/pages/orders/list/courier/list/RollbackOrderDialog.tsx` | v2 |
| `manager-orders-detail` | Buyurtma tafsiloti | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | v2 |
| `manager-orders-detail-edit-address-dialog` | Manzilni tahrirlash oynasi | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/editDialogs/EditAddressDialog.tsx` | v2 |
| `manager-orders-detail-edit-products-dialog` | Buyurtmani tahrirlash oynasi | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/editDialogs/EditOrderDialog.tsx` | v2 |
| `manager-courier-bulk-main` | Tezkor amal | sahifa | `/courier-bulk` | `src/pages/courier-bulk/index.tsx` | v2 |
| `manager-courier-bulk-camera-dialog` | Tezkor amal — kamera | oyna | `/courier-bulk` | `src/pages/courier-bulk/index.tsx` | qisman — Sahifa v2; kamera oynasining o'zi (ScannerCameraModal, umumiy) hali v1 — kamera rejimi alohida ish. |
| `manager-new-orders-markets` | Qabul va yaratish — Marketlar | sahifa | `/new-orders` | `src/pages/new_orders/markets/index.tsx` | v2 |
| `manager-new-orders-market-detail` | Market buyurtmalari — qabul | sahifa | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | v2 |
| `manager-new-orders-market-detail-camera` | Market buyurtmalari — qabul — kamera | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | yangi (kodda yo'q) — Kamera rejimi yo'q — faqat USB/klaviatura skaneri (useOrderQrScanner). |
| `manager-new-orders-receive-confirm-dialog` | Qo'lda qabul qilish tasdig'i | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | v2 |
| `manager-new-orders-delete-confirm-dialog` | Buyurtmani o'chirish tasdig'i | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | v2 |
| `manager-new-orders-create-manual-step1` | Buyurtma yaratish — market tanlash | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/Step1Market.tsx` | v2 |
| `manager-new-orders-create-manual-step2` | Buyurtma yaratish — ma'lumotlar | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/Step2Combined.tsx` | v2 |
| `manager-new-orders-create-ai` | Buyurtma yaratish — AI bilan | sahifa | `/new-orders/create` | `src/pages/orders/create/index.tsx` | v2 |
| `manager-new-orders-create-ai-confirm-dialog` | AI buyurtmalarni tasdiqlash | oyna | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | v2 |
| `manager-new-orders-incoming-sources` | Kiruvchi posilkalar — manba tanlash | sahifa | `/new-orders/incoming` | `src/pages/incoming-orders/SourcePicker.tsx` | v2 |
| `manager-new-orders-incoming-scan` | Kiruvchi posilkalar — skanerlash | sahifa | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | v2 |
| `manager-new-orders-incoming-scan-camera` | Kiruvchi posilkalar — skanerlash — kamera | oyna | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | yangi (kodda yo'q) — Kamera rejimi yo'q — faqat USB/klaviatura skaneri. |
| `manager-mails-today` | Pochta — Bugungi pochtalar | sahifa | `/mails/today` | `src/pages/mails/components/todaysMails.tsx` | v2 |
| `manager-mails-return` | Pochta — Qaytarish so'rovlari | sahifa | `/mails/return` | `src/pages/mails/components/returnMails.tsx` | v2 |
| `manager-mails-refused` | Pochta — Rad etilgan pochtalar | sahifa | `/mails/refused` | `src/pages/mails/components/refusedMails.tsx` | v2 |
| `manager-mails-old` | Pochta — Eski pochtalar | sahifa | `/mails/old` | `src/pages/mails/components/oldMails.tsx` | v2 |
| `manager-mails-detail-receive` | Pochta tafsiloti — qabul qilish | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | v2 |
| `manager-mails-detail-receive-camera` | Pochta tafsiloti — qabul qilish — kamera | oyna | `/mails/:id` | `src/pages/mails/detail/index.tsx` | qisman — Sahifa qismi (sarlavha, statistika, «Buyurtmalar» kartasi, «USB skaner tayyor» belgisi, tanlov tasmasi, jadval) v2; «Kamera» tugmasi va kamera oynasi yo'q — faqat USB/klaviatura skaneri (useOrderQrScanner). Kamera rejimi keyinroq, alohida. |
| `manager-mails-detail-refused-receive` | Rad etilgan pochta — qabul | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | v2 |
| `manager-mails-detail-old` | Eski pochta tafsiloti (tarix) | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | v2 |
| `manager-batches-new` | Paketlar — Yangi | sahifa | `/batches` | `src/pages/batches/ui/BatchesPage.tsx` | v2 |
| `manager-batches-old` | Paketlar — Eski | sahifa | `/batches` | `src/pages/batches/ui/BatchesPage.tsx` | v2 |
| `manager-batches-return` | Paketlar — Qaytarilgan | sahifa | `/batches` | `src/pages/batches/ui/BatchesPage.tsx` | v2 |
| `manager-batches-detail-send` | Paket tafsiloti — asosiy filialga jo'natish | sahifa | `/batches/:id` | `src/pages/batches/ui/BatchDetailPage.tsx` | v2 |
| `manager-batches-detail-send-camera` | Paket tafsiloti — asosiy filialga jo'natish — kamera | oyna | `/batches/:id` | `src/pages/batches/ui/BatchDetailPage.tsx` | qisman — Sahifa qismi (sarlavha, paket ma'lumoti, QR, «Buyurtmalar» kartasi — /mails/:id bilan umumiy OrdersTable, «Skaner tayyor» belgisi, tanlov) v2; «Kamera» tugmasi va kamera oynasi yo'q — faqat USB/klaviatura skaneri (useOrderQrScanner). Kamera rejimi keyinroq, alohida. |
| `manager-batches-detail-readonly` | Paket tafsiloti (faqat o'qish) | sahifa | `/batches/:id` | `src/pages/batches/ui/BatchDetailPage.tsx` | v2 |
| `manager-returns-list` | Return batchlar | sahifa | `/returns` | `src/pages/returns/index.tsx` | v2 |
| `manager-returns-batch-detail` | Qaytarish paketi tafsiloti | sahifa | `/batches/:id` | `src/pages/batches/ui/BatchDetailPage.tsx` | v2 |
| `manager-payments-overview` | To'lovlar — umumiy | sahifa | `/payments` | `src/pages/payments/index.tsx` | v2 |
| `manager-payments-courier-select-dialog` | Qabul qilish — kuryer tanlash | oyna | `/payments` | `src/pages/payments/components/SettlementPickerDialog.tsx` | v2 |
| `manager-payments-main-cashbox` | Asosiy kassa (filial) | sahifa | `/payments/main-cashbox` | `src/pages/payments/components/mainCashbox.tsx` | v2 |
| `manager-payments-cashbox-form-dialog` | Kassadan xarajat / to'ldirish oynasi | oyna | `/payments/main-cashbox` | `src/pages/payments/components/CashboxFormPopup.tsx` | v2 |
| `manager-payments-close-shift-dialog` | Smenani yopish oynasi | oyna | `/payments/main-cashbox` | `src/pages/payments/components/CloseShiftPopup.tsx` | v2 |
| `manager-payments-cash-detail-branch` | Kassa tafsiloti — HQ'ga o'tkazish | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | v2 |
| `manager-payments-cash-detail-courier` | Kassa tafsiloti — kuryerdan qabul | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | v2 |
| `manager-payments-history-detail-dialog` | Tranzaksiya tafsiloti | oyna | `/payments` | `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | v2 |
| `manager-products-list` | Mahsulotlar ro'yxati | sahifa | `/products` | `src/pages/products/list/index.tsx` | v2 |
| `manager-products-market-select-dialog` | Mahsulot uchun market tanlash | oyna | `/products` | `src/pages/products/list/ui/SelectMarketDialog.tsx` | v2 |
| `manager-products-create` | Mahsulot yaratish | sahifa | `/products/create-product/:id` | `src/pages/products/create/index.tsx` | v2 |
| `manager-products-edit-dialog` | Mahsulotni tahrirlash | oyna | `/products` | `src/pages/products/list/ui/EditProductDialog.tsx` | v2 |
| `manager-products-delete-dialog` | Mahsulotni o'chirish | oyna | `/products` | `src/pages/products/ui/useDeleteProductConfirm.tsx` | v2 |
| `manager-users-list` | Foydalanuvchilar (filial xodimlari) | sahifa | `/all-users` | `src/pages/users/list/UserListPage.tsx` | v2 |
| `manager-users-create-courier` | Yangi xodim — kuryer | sahifa | `/all-users/create-user` | `src/pages/users/create/CreateUserPage.tsx` | v2 |
| `manager-users-create-hybrid` | Yangi xodim — Aralash filial (rol tanlash) | sahifa | `/all-users/create-user` | `src/pages/users/create/CreateUserPage.tsx` | v2 |
| `manager-users-detail` | Xodim tafsiloti | sahifa | `/all-users/:id` | `src/pages/users/detail/UserDetailPage.tsx` | v2 |
| `manager-users-edit-dialog` | Xodimni tahrirlash | oyna | `/all-users/:id` | `src/features/user/update-user/ui/UpdateUserModal.tsx` | v2 |
| `manager-regions-scoped` | Hudud — tumanlar statistikasi | sahifa | `/regions` | `src/pages/region/ui/ScopedRegionView.tsx` | v2 |
| `manager-scan-camera` | Skaner — kamera (umumiy) | sahifa | `/scan` | `src/pages/scan/index.tsx` | eski |
| `manager-scan-result` | Skanerlangan buyurtma | sahifa | `/scan/:token` | `src/pages/scan/detail.tsx` | v2 |

### registrator — Registrator

41 ta maket · kodda bor: 40 · kodda yo'q: 1

| Maket | Sarlavha | Tur | Route | Asosiy fayl | Holat |
|---|---|---|---|---|---|
| `registrator-dashboard-main` | Dashboard — statistika | sahifa | `/` | `src/pages/dashboard/DashboardPage.tsx` | v2 |
| `registrator-dispatch-list` | Biriktirish — skanerlangan buyurtmalar | sahifa | `/dispatch` | `src/pages/dispatch/index.tsx` | v2 |
| `registrator-dispatch-empty` | Biriktirish — bo'sh holat | sahifa | `/dispatch` | `src/pages/dispatch/index.tsx` | v2 |
| `registrator-dispatch-camera-scanner-dialog` | Biriktirish — kamera skaneri | oyna | `/dispatch` | `src/pages/dispatch/index.tsx` | qisman — Sahifa v2; kamera oynasining o'zi (ScannerCameraModal, umumiy) hali v1 — kamera rejimi alohida ish. |
| `registrator-dispatch-courier-select-dialog` | Biriktirish — kuryer tanlash | oyna | `/dispatch` | `src/pages/dispatch/index.tsx` | v2 |
| `registrator-orders-list` | Buyurtmalar ro'yxati | sahifa | `/orders` | `src/pages/orders/index.tsx` | v2 |
| `registrator-orders-filters-mobile` | Buyurtmalar — filtr paneli (telefon) | oyna · faqat telefon | `/orders` | `src/pages/orders/list/OrderFilters.tsx` | v2 |
| `registrator-orders-detail` | Buyurtma tafsiloti | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | v2 |
| `registrator-orders-detail-edit-order-dialog` | Buyurtmani tahrirlash oynasi | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/editDialogs/EditOrderDialog.tsx` | v2 |
| `registrator-orders-detail-edit-address-dialog` | Manzilni tahrirlash oynasi | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/editDialogs/EditAddressDialog.tsx` | v2 |
| `registrator-new-orders-markets` | Qabul va yaratish — Marketlar | sahifa | `/new-orders` | `src/pages/new_orders/markets/index.tsx` | v2 |
| `registrator-new-orders-market-detail` | Market buyurtmalari — qabul | sahifa | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | qisman — Registrator boshqa xodim rollari (superadmin/admin/menejer) bilan bir xil v2 ko'rinishda — maketdagi farqlar (sarlavhada «Chop etish», «Buyurtmalar N ta» karta sarlavhasi, «5 / 6 ta» tanlov xulosasi, qator kebab menyusi) ega qaroriga qadar kiritilmagan. |
| `registrator-new-orders-market-detail-camera` | Market buyurtmalari — qabul — kamera | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | yangi (kodda yo'q) — Kamera rejimi yo'q — faqat USB/klaviatura skaneri (useOrderQrScanner). |
| `registrator-new-orders-market-detail-receive-dialog` | Qabul qilish tasdig'i | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | qisman — Umumiy xodim qabul oynasi (MarketOrderDialogs.tsx) — tasdiq tugmasi «Tasdiqlash»; maketdagi «Qabul qilish — N ta» varianti ega qaroriga qadar kiritilmagan. |
| `registrator-new-orders-market-detail-delete-dialog` | Buyurtmani o'chirish tasdig'i | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | v2 |
| `registrator-new-orders-market-order-edit` | Market buyurtmasini tahrirlash | sahifa | `/new-orders/:marketId/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | v2 |
| `registrator-new-orders-cancelled` | Bekor qilinganlar — marketlar (HQ) | sahifa | `/new-orders/cancelled` | `src/pages/new_orders/cancelled/index.tsx` | v2 |
| `registrator-new-orders-cancelled-detail` | Bekor qilinganlarni marketga topshirish (HQ) | sahifa | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | v2 |
| `registrator-new-orders-cancelled-manual-dialog` | QR buzilganini tasdiqlash (HQ) | oyna | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/ui/ManualConfirmDialog.tsx` | v2 |
| `registrator-new-orders-cancelled-scanner-dialog` | Market QR skanerlash (HQ) | oyna | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | qisman — Desktop/planshetdagi sahifa holati («Market QR kerak», «USB skaner tayyor», «Hali buyurtma tanlanmagan», skan bilan tanlov) v2; telefondagi kamera skaneri oynasi (ScannerCameraModal, umumiy) hali v1 — kamera rejimi keyinroq, alohida. |
| `registrator-new-orders-create-step1` | Buyurtma yaratish — market tanlash | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/Step1Market.tsx` | v2 |
| `registrator-new-orders-create-market-picker-dialog` | Buyurtma yaratish — market tanlash oynasi | oyna | `/new-orders/create` | `src/pages/orders/create/ui/MarketPicker.tsx` | v2 |
| `registrator-new-orders-create-step2` | Buyurtma yaratish — qo'lda forma | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/Step2Combined.tsx` | v2 |
| `registrator-new-orders-create-ai` | Buyurtma yaratish — AI rejimi | sahifa | `/new-orders/create` | `src/pages/orders/create/index.tsx` | v2 |
| `registrator-new-orders-create-ai-confirm-dialog` | AI buyurtmalarni tasdiqlash | oyna | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | v2 |
| `registrator-mails-today` | Pochta — Bugungi pochtalar | sahifa | `/mails/today` | `src/pages/mails/components/todaysMails.tsx` | v2 |
| `registrator-mails-return` | Pochta — Qaytarish | sahifa | `/mails/return` | `src/pages/mails/components/returnMails.tsx` | v2 |
| `registrator-mails-refused` | Pochta — Rad etilgan pochtalar | sahifa | `/mails/refused` | `src/pages/mails/components/refusedMails.tsx` | v2 |
| `registrator-mails-old` | Pochta — Eski pochtalar | sahifa | `/mails/old` | `src/pages/mails/components/oldMails.tsx` | v2 |
| `registrator-mails-detail` | Pochta tafsiloti — bugungi | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | v2 |
| `registrator-mails-detail-camera` | Pochta tafsiloti — bugungi — kamera | oyna | `/mails/:id` | `src/pages/mails/detail/index.tsx` | qisman — Sahifa qismi (sarlavha, statistika, «Buyurtmalar» kartasi, «USB skaner tayyor» belgisi, tanlov tasmasi, jadval) v2; «Kamera» tugmasi va kamera oynasi yo'q — faqat USB/klaviatura skaneri (useOrderQrScanner). Kamera rejimi keyinroq, alohida. |
| `registrator-mails-detail-send-dialog` | Pochtani filialga jo'natish (HQ) | oyna | `/mails/:id` | `src/pages/mails/detail/ui/SendPostModal.tsx` | v2 |
| `registrator-mails-detail-refused` | Pochta tafsiloti — rad etilgan | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | v2 |
| `registrator-mails-detail-old` | Pochta tafsiloti — tarix | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | v2 |
| `registrator-products-list` | Mahsulotlar ro'yxati | sahifa | `/products` | `src/pages/products/list/index.tsx` | v2 |
| `registrator-products-market-select-dialog` | Mahsulot uchun market tanlash | oyna | `/products` | `src/pages/products/list/ui/SelectMarketDialog.tsx` | v2 |
| `registrator-products-edit-dialog` | Mahsulotni tahrirlash | oyna | `/products` | `src/pages/products/list/ui/EditProductDialog.tsx` | v2 |
| `registrator-products-delete-dialog` | Mahsulotni o'chirish | oyna | `/products` | `src/pages/products/ui/useDeleteProductConfirm.tsx` | v2 |
| `registrator-products-create` | Mahsulot yaratish | sahifa | `/products/create-product/:id` | `src/pages/products/create/index.tsx` | v2 |
| `registrator-scan-camera` | Skaner — kamera (umumiy) | sahifa | `/scan` | `src/pages/scan/index.tsx` | eski |
| `registrator-scan-result` | Skanerlangan buyurtma | sahifa | `/scan/:token` | `src/pages/scan/detail.tsx` | v2 |

### market — Market

19 ta maket · kodda bor: 19 · kodda yo'q: 0

| Maket | Sarlavha | Tur | Route | Asosiy fayl | Holat |
|---|---|---|---|---|---|
| `market-dashboard-home` | Mening dashboardim | sahifa | `/` | `src/pages/dashboard/MarketDashboardPage.tsx` | v2 |
| `market-dashboard-extra-cost-approvals` | Dashboard · Xarajat tasdiqlari | sahifa | `/` | `src/pages/dashboard/ui/ExtraCostApprovalsCard.tsx` | v2 |
| `market-orders-list` | Buyurtmalar ro'yxati | sahifa | `/orders` | `src/pages/orders/index.tsx` | v2 |
| `market-orders-detail` | Buyurtma tafsilotlari | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | v2 |
| `market-new-orders-list` | Yangi buyurtmalar | sahifa | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | v2 |
| `market-new-orders-delete-dialog` | Buyurtmani o'chirish | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | v2 |
| `market-new-orders-edit` | Yangi buyurtma tafsiloti | sahifa | `/new-orders/:marketId/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | v2 |
| `market-new-orders-create-manual` | Buyurtma yaratish · Qo'lda | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/Step2Combined.tsx` | v2 |
| `market-new-orders-create-ai-input` | Buyurtma yaratish · AI kiritish | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiInputPanel.tsx` | v2 |
| `market-new-orders-create-ai-preview` | Buyurtma yaratish · AI natijalari | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiPreviewCard.tsx` | v2 |
| `market-new-orders-create-ai-confirm-dialog` | AI · Yaratishni tasdiqlash | oyna | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | v2 |
| `market-new-orders-cancelled` | Bekor qilinganlar | sahifa | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | v2 |
| `market-new-orders-cancelled-qr-dialog` | Bekor qilinganlar · QR kod | oyna | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/ui/MarketQrDialog.tsx` | v2 |
| `market-products-list` | Mahsulotlar | sahifa | `/products` | `src/pages/products/list/index.tsx` | v2 |
| `market-products-edit-dialog` | Mahsulotni tahrirlash | oyna | `/products` | `src/pages/products/list/ui/EditProductDialog.tsx` | v2 |
| `market-products-delete-dialog` | Mahsulotni o'chirish | oyna | `/products` | `src/pages/products/ui/useDeleteProductConfirm.tsx` | v2 |
| `market-products-create` | Mahsulot yaratish | sahifa | `/products/create-product/:id` | `src/pages/products/create/index.tsx` | v2 |
| `market-cashbox-my` | Market kassasi | sahifa | `/cash-box` | `src/pages/payments/components/MyCashboxPage.tsx` | v2 |
| `market-cashbox-history-detail-dialog` | Tranzaksiya tafsiloti | oyna | `/cash-box` | `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | v2 |

### courier — Kuryer

47 ta maket · kodda bor: 44 · kodda yo'q: 3

| Maket | Sarlavha | Tur | Route | Asosiy fayl | Holat |
|---|---|---|---|---|---|
| `courier-dashboard-home` | Bosh sahifa — kuryer statistikasi | sahifa | `/` | `src/pages/dashboard/DashboardPage.tsx` | v2 |
| `courier-dashboard-mobile-menu` | Menyu ochiq — yon panel / pastki varaq | oyna · faqat planshet + telefon | `(qobiq)` | `src/widgets/Sidebar/ui/MobileMenu.tsx` | v2 |
| `courier-dashboard-mobile-search` | Global qidiruv (telefon) | oyna · faqat telefon | `(qobiq)` | `src/widgets/header/ui/SearchScreen.tsx` | v2 |
| `courier-orders-pending` | Buyurtmalar — Kutilayotganlar | sahifa | `/orders` | `src/pages/orders/list/courier/index.tsx` | v2 |
| `courier-orders-tab-switcher-open` | Buyurtmalar — tab almashtirildi, yuklanmoqda | sahifa · faqat telefon | `/orders` | `src/pages/orders/list/courier/list/tabs.tsx` | v2 |
| `courier-orders-all` | Buyurtmalar — Hammasi | sahifa | `/orders` | `src/pages/orders/list/courier/index.tsx` | v2 |
| `courier-orders-cancelled` | Buyurtmalar — Bekor qilinganlar | sahifa | `/orders` | `src/pages/orders/list/courier/index.tsx` | v2 |
| `courier-orders-sell-dialog` | Sotish oynasi | oyna | `/orders` | `src/pages/orders/list/courier/list/SellModal.tsx` | v2 |
| `courier-orders-sell-extra-cost-dialog` | Sotish — qo'shimcha xarajat bilan | oyna | `/orders` | `src/pages/orders/list/courier/list/SellModal.tsx` | v2 |
| `courier-orders-sell-partial-dialog` | Qisman sotish oynasi | oyna | `/orders` | `src/pages/orders/list/courier/list/SellModal.tsx` | v2 |
| `courier-orders-action-approval-pending` | Market tasdig'i kutilmoqda | oyna | `/orders` | `src/pages/orders/list/courier/list/SellModal.tsx` | v2 |
| `courier-orders-cancel-dialog` | Bekor qilish oynasi | oyna | `/orders` | `src/pages/orders/list/courier/list/CancelModal.tsx` | v2 |
| `courier-orders-rollback-confirm` | Buyurtmani qaytarish tasdig'i | oyna | `/orders` | `src/pages/orders/list/courier/list/RollbackOrderDialog.tsx` | v2 |
| `courier-orders-detail` | Buyurtma tafsilotlari | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | v2 |
| `courier-courier-bulk-main` | Tezkor amal — kunni yakunlash | sahifa | `/courier-bulk` | `src/pages/courier-bulk/index.tsx` | v2 |
| `courier-courier-bulk-scanner-camera` | Tezkor amal — kamera skaneri | oyna | `/courier-bulk` | `src/pages/courier-bulk/index.tsx` | qisman — Sahifa v2; kamera oynasining o'zi (ScannerCameraModal, umumiy) hali v1 — kamera rejimi alohida ish. |
| `courier-courier-bulk-scanner-camera-list` | Tezkor amal — kamera, skanerlanganlar ro'yxati | oyna · faqat telefon | `/courier-bulk` | `src/pages/courier-bulk/index.tsx` | yangi (kodda yo'q) — Kamera oynasida «skanerlanganlar ro'yxati» varag'i yo'q (ScannerCameraModal faqat kamera). |
| `courier-courier-bulk-confirm-dialog` | Kunni yakunlash — tasdiqlash oynasi | oyna | `/courier-bulk` | `src/pages/courier-bulk/index.tsx` | v2 |
| `courier-mails-today` | Pochta — Bugungi | sahifa | `/mails/today` | `src/pages/mails/components/todaysMails.tsx` | v2 |
| `courier-mails-tab-switcher-open` | Pochta — tab tanlash ochiq | sahifa · faqat telefon | `/mails/today` | `src/pages/mails/index.tsx` | v2 |
| `courier-mails-refused` | Pochta — Rad etilgan | sahifa | `/mails/refused` | `src/pages/mails/components/refusedMails.tsx` | v2 |
| `courier-mails-old` | Pochta — Eski | sahifa | `/mails/old` | `src/pages/mails/components/oldMails.tsx` | v2 |
| `courier-mails-detail-receive` | Pochta tafsiloti — qabul qilish | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | v2 |
| `courier-mails-detail-receive-camera` | Pochta tafsiloti — qabul qilish — kamera | oyna | `/mails/:id` | `src/pages/mails/detail/index.tsx` | qisman — Sahifa qismi (sarlavha, statistika, «Buyurtmalar» kartasi, «USB skaner tayyor» belgisi, tanlov tasmasi, jadval) v2; «Kamera» tugmasi va kamera oynasi yo'q — faqat USB/klaviatura skaneri (useOrderQrScanner). Kamera rejimi keyinroq, alohida. |
| `courier-mails-detail-refused` | Pochta tafsiloti — rad etilgan (faqat o'qish) | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | v2 |
| `courier-mails-detail-old` | Pochta tafsiloti — eski (tarix) | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | v2 |
| `courier-mails-detail-print-menu` | Chop etish menyusi | oyna | `/mails/:id` | `src/shared/components/PrintModeSelect.tsx` | v2 |
| `courier-cashbox-my-all` | Kassa — Barcha tarix | sahifa | `/cash-box` | `src/pages/payments/components/MyCashboxPage.tsx` | v2 |
| `courier-cashbox-my-transfers` | Kassa — Oldi-berdi | sahifa | `/cash-box` | `src/pages/payments/components/MyCashboxPage.tsx` | v2 |
| `courier-cashbox-history-detail` | Tranzaksiya tafsiloti | oyna | `/cash-box` | `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | v2 |
| `courier-regions-scoped` | Hududlar — o'z viloyatim | sahifa | `/regions` | `src/pages/region/ui/ScopedRegionView.tsx` | v2 |
| `courier-scan-camera` | Skaner — kamera | sahifa | `/scan` | `src/pages/scan/index.tsx` | eski |
| `courier-scan-order-detail` | Skanerlangan buyurtma — O'zimga olish | sahifa | `/scan/:token` | `src/pages/scan/detail.tsx` | v2 |
| `courier-scan-package-detail` | Skanerlangan paket | sahifa | `/scan/:token` | `src/pages/scan/ui/ScanPackageDetail.tsx` | v2 |
| `courier-scan-post-detail` | Skanerlangan pochta | sahifa | `/scan/:token` | `src/pages/scan/ui/ScanPostDetail.tsx` | v2 |
| `courier-scan-not-found` | Skaner — topilmadi | sahifa | `/scan/:token` | `src/pages/scan/detail.tsx` | qisman — Maket holati kamera ekranida chizilgan — kamera ishi. /scan/:token da «Buyurtma topilmadi» kartasi (ScanStates: «Qayta urinish» + «Skanerga qaytish») v2. |
| `courier-scan-starting` | Skaner — kamera ishga tushmoqda | sahifa | `/scan` | `src/pages/scan/index.tsx` | eski |
| `courier-scan-permission-denied` | Skaner — kameraga ruxsat yo'q | sahifa | `/scan` | `src/pages/scan/index.tsx` | eski |
| `courier-scan-active` | Skaner — skanerlanmoqda | sahifa | `/scan` | `src/pages/scan/index.tsx` | eski |
| `courier-scan-success-flash` | Skaner — muvaffaqiyatli o'qildi | sahifa | `/scan` | `src/pages/scan/index.tsx` | eski |
| `courier-scan-other-courier` | Skaner — boshqa kuryerga biriktirilgan | sahifa | `/scan/:token` | `src/pages/scan/detail.tsx` | qisman — Alohida holat yo'q — «O'zimga olish» rad etilsa backend xato matni amallar kartasida chiqadi (ScanActionCard). Kamera ekranidagi ko'rinishi — alohida kamera ishi. |
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
| `common-login` | Tizimga kirish | sahifa | `/login` | `src/features/auth/index.tsx` | v2 |
| `common-login-error` | Tizimga kirish — xato holati | sahifa | `/login` | `src/features/auth/index.tsx` | v2 |
| `common-session-expired` | Sessiya tugadi | sahifa | `/login` | `src/features/auth/index.tsx` | v2 |
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
| `tizim-charts` | Grafiklar — statistika va tahlil | Qaysi grafik qachon, kategorial palitra (chart-1…8, kunduzgi/tungi), ketma-ket va ikki qutbli shkalalar, holat ranglari, grafik anatomiyasi, galereya (spidometr, donut, KPI, chiziq, ustunlar, reyting, issiqlik xaritasi, xarita, sharshara, voronka, sparkline), holatlar (yuklanmoqda, bo'sh, xato), «Grafik \| Jadval» egizagi, telefon. | src/shared/ui/charts (Gauge, Donut, RankList, Meter, SegBar, HBarList, Waterfall, RingStat, ChartLegend, ChartNote, ViewToggle, DeltaChip), CHART_PALETTE (src/shared/config/themeTokens.ts), src/widgets/dashboard-*/*, src/widgets/financial-analysis/* (recharts — faqat FinancialTrendPlot), src/pages/region/ui/UzbekistanRegionMap.tsx, docs/DESIGN_SYSTEM.md §3 | `/`, `/branch-dashboard`, `/financial-balance`, `/regions` |
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
| `src/entities/batch/model/batchStatus.ts` | `/batches` |
| `src/entities/order/ui/ProofGallery.tsx` | `/orders/edit/:orderId` |
| `src/entities/order/ui/ReturnRequestedTag.tsx` | `/orders` |
| `src/entities/orders/ui/ExtraCostApprovalAlerts.tsx` | `/orders` |
| `src/entities/orders/ui/ExtraCostApprovalTag.tsx` | `/orders` |
| `src/features/auth/index.tsx` | `/login` |
| `src/features/auth/ui/LoginForm.tsx` | `/login` |
| `src/features/auth/ui/SessionExpiredScreen.tsx` | `/login` |
| `src/features/branch-add-employee/ui/AddEmployeeModal.tsx` | `/branches/:id` |
| `src/features/branch-create/ui/BranchFormModal.tsx` | `/branches` |
| `src/features/branch-edit/ui/BranchEditModal.tsx` | `/branches` |
| `src/features/branch-remove-employee/ui/RemoveEmployeeButton.tsx` | `/branches/:id` |
| `src/features/branch/ui/BranchFormDialog.tsx` | `/branches` |
| `src/features/courier-transfer-branch/ui/TransferCourierButton.tsx` | `/all-users/:id`, `/branches/:id` |
| `src/features/courier-transfer-branch/ui/TransferCourierModal.tsx` | `/all-users/:id` |
| `src/features/notification-create/ui/NotificationFormModal.tsx` | `/notifications` |
| `src/features/notification-delete/ui/DeleteNotificationButton.tsx` | `/notifications` |
| `src/features/notification-dispatch/ui/NotificationDispatchForm.tsx` | `/notifications/send` |
| `src/features/order-return/ui/InitiateReturnModal.tsx` | `/orders/edit/:orderId` |
| `src/features/order-return/ui/MarkReturnedModal.tsx` | `/orders/edit/:orderId` |
| `src/features/order-tracking/ui/TrackingTimelineItem.tsx` | `/orders/edit/:orderId` |
| `src/features/push-notifications/ui/PushPermissionButton.tsx` | `/settings`, `/inbox` |
| `src/features/user/create-user/ui/CreateUserForm.tsx` | `/all-users/create-user` |
| `src/features/user/update-user/ui/UpdateUserModal.tsx` | `/all-users`, `/all-users/:id`, `/profile` |
| `src/pages/activity-logs/index.tsx` | `/activity-logs` |
| `src/pages/batches/lib/batchFormat.ts` | `/batches` |
| `src/pages/batches/lib/batchOrderMailAdapter.ts` | `/batches/:id` |
| `src/pages/batches/model/batchView.ts` | `/batches` |
| `src/pages/batches/ui/BatchDetailPage.tsx` | `/batches/:id` |
| `src/pages/batches/ui/BatchHistoryCard.tsx` | `/batches/:id` |
| `src/pages/batches/ui/BatchInfoCard.tsx` | `/batches/:id` |
| `src/pages/batches/ui/BatchPrintSheet.tsx` | `/batches/:id` |
| `src/pages/batches/ui/BatchQrCard.tsx` | `/batches/:id` |
| `src/pages/batches/ui/BatchQrCode.tsx` | `/batches/:id` |
| `src/pages/batches/ui/BatchesPage.tsx` | `/batches` |
| `src/pages/branch-dashboard/index.tsx` | `/branch-dashboard` |
| `src/pages/branch-dashboard/ui/BranchCards.tsx` | `/branch-dashboard` |
| `src/pages/branch-dashboard/ui/BranchDashboardPage.tsx` | `/branch-dashboard` |
| `src/pages/branch-dashboard/ui/branchDashboardAdapter.ts` | `/branch-dashboard` |
| `src/pages/branch-ops/index.tsx` | `/branch-ops` |
| `src/pages/branches/ui/BranchDetailPage.tsx` | `/branches/:id` |
| `src/pages/branches/ui/BranchesPage.tsx` | `/branches` |
| `src/pages/courier-bulk/index.tsx` | `/courier-bulk` |
| `src/pages/courier-bulk/model/courierBulk.ts` | `/courier-bulk` |
| `src/pages/courier-bulk/model/useIsBelowLg.ts` | `/courier-bulk` |
| `src/pages/courier-bulk/ui/BulkAlert.tsx` | `/courier-bulk` |
| `src/pages/courier-bulk/ui/CourierBulkOrders.tsx` | `/courier-bulk` |
| `src/pages/courier-bulk/ui/CourierBulkSummary.tsx` | `/courier-bulk` |
| `src/pages/courier-bulk/ui/ResultControl.tsx` | `/courier-bulk` |
| `src/pages/courier-bulk/ui/ScanModeControl.tsx` | `/courier-bulk` |
| `src/pages/courier-bulk/ui/segmentTint.ts` | `/courier-bulk` |
| `src/pages/dashboard/DashboardPage.tsx` | `/` |
| `src/pages/dashboard/MarketDashboardPage.tsx` | `/` |
| `src/pages/dashboard/ui/CourierCashCard.tsx` | `/` |
| `src/pages/dashboard/ui/CourierPlanCard.tsx` | `/` |
| `src/pages/dashboard/ui/DeliveryQualityCard.tsx` | `/` |
| `src/pages/dashboard/ui/DeliveryResultsCard.tsx` | `/` |
| `src/pages/dashboard/ui/ExtraCostApprovalsCard.tsx` | `/` |
| `src/pages/dashboard/ui/MarketSalesCard.tsx` | `/` |
| `src/pages/dashboard/ui/QuickActions.tsx` | `/` |
| `src/pages/dispatch/index.tsx` | `/dispatch` |
| `src/pages/dispatch/model/dispatchModel.ts` | `/dispatch` |
| `src/pages/dispatch/ui/CourierPickerDialog.tsx` | `/dispatch` |
| `src/pages/dispatch/ui/DispatchAlert.tsx` | `/dispatch` |
| `src/pages/dispatch/ui/DispatchOrdersTable.tsx` | `/dispatch` |
| `src/pages/dispatch/ui/DispatchStats.tsx` | `/dispatch` |
| `src/pages/finance-operators/index.tsx` | `/finance-operators` |
| `src/pages/financial-balance/components/AnalysisTab.tsx` | `/financial-balance` |
| `src/pages/financial-balance/components/FinancialEntryModal.tsx` | `/financial-balance` |
| `src/pages/financial-balance/components/FinancialHistoryDetail.tsx` | `/financial-balance` |
| `src/pages/financial-balance/components/HistoryTab.tsx` | `/financial-balance` |
| `src/pages/financial-balance/components/LedgerFlow.tsx` | `/financial-balance` |
| `src/pages/financial-balance/components/SettlementRanks.tsx` | `/financial-balance` |
| `src/pages/financial-balance/components/Statistics.tsx` | `/financial-balance` |
| `src/pages/financial-balance/index.tsx` | `/financial-balance` |
| `src/pages/financial-balance/lib/analytics.ts` | `/financial-balance` |
| `src/pages/financial-balance/lib/financialBalance.ts` | `/financial-balance` |
| `src/pages/financial-balance/lib/manualEntry.ts` | `/financial-balance` |
| `src/pages/identity-ops/index.tsx` | `/identity-ops` |
| `src/pages/incoming-orders/SourcePicker.tsx` | `/new-orders/incoming` |
| `src/pages/incoming-orders/index.tsx` | `/new-orders/incoming/:marketId` |
| `src/pages/incoming-orders/lib.ts` | `/new-orders/incoming`, `/new-orders/incoming/:marketId` |
| `src/pages/incoming-orders/ui/IdleSources.tsx` | `/new-orders/incoming` |
| `src/pages/incoming-orders/ui/IncomingTable.tsx` | `/new-orders/incoming/:marketId` |
| `src/pages/incoming-orders/ui/ScanInput.tsx` | `/new-orders/incoming/:marketId` |
| `src/pages/incoming-orders/ui/ScanMessage.tsx` | `/new-orders/incoming/:marketId` |
| `src/pages/incoming-orders/ui/SourcesSummary.tsx` | `/new-orders/incoming` |
| `src/pages/incoming-orders/ui/SourcesTable.tsx` | `/new-orders/incoming` |
| `src/pages/incoming-orders/ui/sourceFormat.ts` | `/new-orders/incoming` |
| `src/pages/incoming-orders/ui/sourceVisuals.tsx` | `/new-orders/incoming` |
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
| `src/pages/mails/components/MailSummaryStats.tsx` | `/mails/today`, `/mails/refused` |
| `src/pages/mails/components/MailsListBody.tsx` | `/mails/today`, `/mails/refused` |
| `src/pages/mails/components/MailsTable.tsx` | `/mails/today`, `/mails/refused`, `/mails/old` |
| `src/pages/mails/components/OldMailsFiltersSheet.tsx` | `/mails/old` |
| `src/pages/mails/components/lib/exportOldMailsToExcel.ts` | `/mails/old` |
| `src/pages/mails/components/lib/regionFilterOptions.ts` | `/mails/today`, `/mails/old` |
| `src/pages/mails/components/oldMails.tsx` | `/mails/old` |
| `src/pages/mails/components/refusedMails.tsx` | `/mails/refused` |
| `src/pages/mails/components/returnMails.tsx` | `/mails/return` |
| `src/pages/mails/components/todaysMails.tsx` | `/mails/today` |
| `src/pages/mails/detail/index.tsx` | `/mails/:id` |
| `src/pages/mails/detail/lib/printMode.ts` | `/mails/:id` |
| `src/pages/mails/detail/lib/scanMatch.ts` | `/mails/:id` |
| `src/pages/mails/detail/model/useMailDetailState.ts` | `/mails/:id`, `/batches/:id` |
| `src/pages/mails/detail/model/useOrderRowView.tsx` | `/mails/:id` |
| `src/pages/mails/detail/ui/DeleteFromPostDialog.tsx` | `/mails/:id` |
| `src/pages/mails/detail/ui/MailStatCards.tsx` | `/mails/:id`, `/batches/:id` |
| `src/pages/mails/detail/ui/OrderRow.tsx` | `/mails/:id` |
| `src/pages/mails/detail/ui/OrdersTable.tsx` | `/mails/:id`, `/batches/:id` |
| `src/pages/mails/detail/ui/SendButton.tsx` | `/mails/:id`, `/batches/:id` |
| `src/pages/mails/detail/ui/SendPostModal.tsx` | `/mails/:id` |
| `src/pages/mails/detail/ui/printOptions.tsx` | `/mails/:id` |
| `src/pages/mails/index.tsx` | `/mails`, `/mails/today`, `/mails/return`, `/mails/refused`, `/mails/old` |
| `src/pages/mails/lib/navigation.ts` | `/mails` |
| `src/pages/mails/model/mailsLayout.ts` | `/mails/today` |
| `src/pages/mails/model/mailsLists.ts` | `/mails/today`, `/mails/return`, `/mails/refused` |
| `src/pages/mails/model/oldMailsModel.ts` | `/mails/old` |
| `src/pages/market-operators/index.tsx` | `/market-operators` |
| `src/pages/new_orders/branches/batchDetail.tsx` | `/new-orders/branches/:branchId/batches/:batchId` |
| `src/pages/new_orders/branches/batches.tsx` | `/new-orders/branches/:branchId` |
| `src/pages/new_orders/branches/branchBatchesModel.ts` | `/new-orders/branches`, `/new-orders/branches/:branchId`, `/new-orders/branches/:branchId/batches/:batchId` |
| `src/pages/new_orders/branches/index.tsx` | `/new-orders/branches` |
| `src/pages/new_orders/cancelled/cancelledModel.ts` | `/new-orders/cancelled/:marketId` |
| `src/pages/new_orders/cancelled/detail.tsx` | `/new-orders/cancelled/:marketId` |
| `src/pages/new_orders/cancelled/index.tsx` | `/new-orders/cancelled` |
| `src/pages/new_orders/cancelled/ui/CancelledOrdersTable.tsx` | `/new-orders/cancelled/:marketId` |
| `src/pages/new_orders/cancelled/ui/HandoverStatusAlert.tsx` | `/new-orders/cancelled/:marketId` |
| `src/pages/new_orders/cancelled/ui/ManualConfirmDialog.tsx` | `/new-orders/cancelled/:marketId` |
| `src/pages/new_orders/cancelled/ui/MarketQrDialog.tsx` | `/new-orders/cancelled/:marketId` |
| `src/pages/new_orders/cancelled/utils.ts` | `/new-orders/cancelled`, `/new-orders/cancelled/:marketId` |
| `src/pages/new_orders/components/detail/AddressCard.tsx` | `/orders/edit/:orderId` |
| `src/pages/new_orders/components/detail/CourierCards.tsx` | `/orders/edit/:orderId` |
| `src/pages/new_orders/components/detail/CustomerCard.tsx` | `/orders/edit/:orderId` |
| `src/pages/new_orders/components/detail/DetailAlerts.tsx` | `/orders/edit/:orderId` |
| `src/pages/new_orders/components/detail/DetailHeader.tsx` | `/orders/edit/:orderId` |
| `src/pages/new_orders/components/detail/PaymentCard.tsx` | `/orders/edit/:orderId` |
| `src/pages/new_orders/components/detail/ProductsCard.tsx` | `/orders/edit/:orderId` |
| `src/pages/new_orders/components/detail/ProofCard.tsx` | `/orders/edit/:orderId` |
| `src/pages/new_orders/components/detail/orderDetailAccess.ts` | `/orders/edit/:orderId` |
| `src/pages/new_orders/components/detail/orderDetailModel.ts` | `/orders/edit/:orderId` |
| `src/pages/new_orders/components/editDialogs/EditAddressDialog.tsx` | `/orders/edit/:orderId` |
| `src/pages/new_orders/components/editDialogs/EditCustomerDialog.tsx` | `/orders/edit/:orderId` |
| `src/pages/new_orders/components/editDialogs/EditOrderDialog.tsx` | `/orders/edit/:orderId` |
| `src/pages/new_orders/components/editDialogs/index.ts` | `/orders/edit/:orderId` |
| `src/pages/new_orders/components/lib/printLabelPdf.ts` | `/new-orders/:marketId` |
| `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | `/new-orders/:marketId` |
| `src/pages/new_orders/components/marketOrders/MarketOrdersTable.tsx` | `/new-orders/:marketId` |
| `src/pages/new_orders/components/marketOrders/SelectionBar.tsx` | `/new-orders/:marketId` |
| `src/pages/new_orders/components/marketOrders/marketOrdersModel.ts` | `/new-orders/:marketId` |
| `src/pages/new_orders/components/newOrderReceiveRules.ts` | `/new-orders/:marketId` |
| `src/pages/new_orders/components/newOrderUpdateRules.ts` | `/orders/edit/:orderId`, `/new-orders/:marketId/edit/:orderId` |
| `src/pages/new_orders/components/new_orderDetail.tsx` | `/new-orders/:marketId` |
| `src/pages/new_orders/components/new_orderUpdate.tsx` | `/orders/edit/:orderId`, `/new-orders/:marketId/edit/:orderId` |
| `src/pages/new_orders/external_orders/create.tsx` | `/integrations/sources/create` |
| `src/pages/new_orders/external_orders/detail.tsx` | `/integrations/sources/:id` |
| `src/pages/new_orders/external_orders/index.tsx` | `/integrations/sources` |
| `src/pages/new_orders/index.tsx` | `/new-orders` |
| `src/pages/new_orders/markets/index.tsx` | `/new-orders` |
| `src/pages/new_orders/ui/NewOrdersHeader.tsx` | `/new-orders` |
| `src/pages/new_orders/ui/NewOrdersTabs.tsx` | `/new-orders` |
| `src/pages/new_orders/ui/SourceListCard.tsx` | `/new-orders/branches`, `/new-orders/cancelled` |
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
| `src/pages/orders/create/ui/CreateAlert.tsx` | `/new-orders/create` |
| `src/pages/orders/create/ui/CreateModeTabs.tsx` | `/new-orders/create` |
| `src/pages/orders/create/ui/MarketPicker.tsx` | `/new-orders/create` |
| `src/pages/orders/create/ui/OrderStepper.tsx` | `/new-orders/create` |
| `src/pages/orders/create/ui/Step1Market.tsx` | `/new-orders/create` |
| `src/pages/orders/create/ui/Step2Combined.tsx` | `/new-orders/create` |
| `src/pages/orders/create/ui/Step2Summary.tsx` | `/new-orders/create` |
| `src/pages/orders/create/ui/TodayOrdersCard.tsx` | `/new-orders/create` |
| `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | `/new-orders/create` |
| `src/pages/orders/create/ui/ai/AiCreatePanel.tsx` | `/new-orders/create` |
| `src/pages/orders/create/ui/ai/AiCreatedList.tsx` | `/new-orders/create` |
| `src/pages/orders/create/ui/ai/AiInputPanel.tsx` | `/new-orders/create` |
| `src/pages/orders/create/ui/ai/AiPreviewCard.tsx` | `/new-orders/create` |
| `src/pages/orders/index.tsx` | `/orders` |
| `src/pages/orders/lib/exportOrdersToExcel.ts` | `/orders` |
| `src/pages/orders/list/OrderFilters.tsx` | `/orders` |
| `src/pages/orders/list/OrderFiltersSheet.tsx` | `/orders` |
| `src/pages/orders/list/OrdersTable.tsx` | `/orders` |
| `src/pages/orders/list/courier/index.tsx` | `/orders` |
| `src/pages/orders/list/courier/list/CancelModal.tsx` | `/orders`, `/orders/edit/:orderId` |
| `src/pages/orders/list/courier/list/OrderActionParts.tsx` | `/orders` |
| `src/pages/orders/list/courier/list/RollbackOrderDialog.tsx` | `/orders`, `/orders/edit/:orderId` |
| `src/pages/orders/list/courier/list/SellModal.tsx` | `/orders`, `/orders/edit/:orderId` |
| `src/pages/orders/list/courier/list/ordertable/AllOrdersTable.tsx` | `/orders` |
| `src/pages/orders/list/courier/list/ordertable/CancelledOrdersTable.tsx` | `/orders` |
| `src/pages/orders/list/courier/list/ordertable/CourierOrdersTable.tsx` | `/orders` |
| `src/pages/orders/list/courier/list/ordertable/pendingOrderTable.tsx` | `/orders` |
| `src/pages/orders/list/courier/list/tabs.tsx` | `/orders` |
| `src/pages/orders/list/orderFilterModel.ts` | `/orders` |
| `src/pages/partners/index.tsx` | `/integrations/partners` |
| `src/pages/payments/components/CashboxActionFormCard.tsx` | `/payments/cash-detail/:id` |
| `src/pages/payments/components/CashboxFormPopup.tsx` | `/payments/main-cashbox` |
| `src/pages/payments/components/CloseShiftPopup.tsx` | `/payments/main-cashbox` |
| `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | `/payments`, `/payments/main-cashbox`, `/payments/cash-detail/:id`, `/cash-box` |
| `src/pages/payments/components/InactiveBadge.tsx` | `/payments` |
| `src/pages/payments/components/MainCashboxBalanceChart.tsx` | `/payments/main-cashbox` |
| `src/pages/payments/components/MyCashboxPage.tsx` | `/cash-box` |
| `src/pages/payments/components/PaymentHistoryList.tsx` | `/payments/cash-detail/:id` |
| `src/pages/payments/components/PaymentSummaryCards.tsx` | `/payments` |
| `src/pages/payments/components/SalaryPaymentPopup.tsx` | `/payments/main-cashbox` |
| `src/pages/payments/components/SettlementPickerDialog.tsx` | `/payments`, `/payments/main-cashbox` |
| `src/pages/payments/components/cashDetail.tsx` | `/payments/cash-detail/:id` |
| `src/pages/payments/components/lib/exportMainCashboxReport.ts` | `/payments/main-cashbox` |
| `src/pages/payments/components/lib/mainCashboxStats.ts` | `/payments/main-cashbox` |
| `src/pages/payments/components/lib/paymentIdempotency.ts` | `/payments/cash-detail/:id` |
| `src/pages/payments/components/lib/receiveOptions.ts` | `/payments` |
| `src/pages/payments/components/mainCashbox.tsx` | `/payments/main-cashbox` |
| `src/pages/payments/components/patmentHistoryTable.tsx` | `/payments` |
| `src/pages/payments/components/paymentHistoryActor.ts` | `/payments` |
| `src/pages/payments/components/paymentSourceType.ts` | `/payments`, `/cash-box` |
| `src/pages/payments/index.tsx` | `/payments` |
| `src/pages/products/create/index.tsx` | `/products/create-product/:id` |
| `src/pages/products/list/index.tsx` | `/products` |
| `src/pages/products/list/ui/EditProductDialog.tsx` | `/products` |
| `src/pages/products/list/ui/SelectMarketDialog.tsx` | `/products` |
| `src/pages/products/model/productView.ts` | `/products` |
| `src/pages/products/ui/ProductImageField.tsx` | `/products`, `/products/create-product/:id` |
| `src/pages/products/ui/ProductThumb.tsx` | `/products`, `/products/create-product/:id` |
| `src/pages/products/ui/useDeleteProductConfirm.tsx` | `/products`, `/products/create-product/:id` |
| `src/pages/profile/ui/ProfilePage.tsx` | `/profile` |
| `src/pages/region/index.tsx` | `/regions` |
| `src/pages/region/model/boardModel.ts` | `/regions/districts`, `/regions/sato-management` |
| `src/pages/region/model/regionPeriod.ts` | `/regions` |
| `src/pages/region/model/regionsModel.ts` | `/regions` |
| `src/pages/region/model/scopedModel.ts` | `/regions` |
| `src/pages/region/pages/districts/index.tsx` | `/regions/districts` |
| `src/pages/region/pages/logist-assignment/index.tsx` | `/regions/logist-assignment` |
| `src/pages/region/pages/sato-management/index.tsx` | `/regions/sato-management` |
| `src/pages/region/ui/DistrictBoard.tsx` | `/regions/districts`, `/regions/sato-management` |
| `src/pages/region/ui/MoveDistrictDialog.tsx` | `/regions/sato-management` |
| `src/pages/region/ui/RegionPeriodControls.tsx` | `/regions` |
| `src/pages/region/ui/RegionsMapCard.tsx` | `/regions` |
| `src/pages/region/ui/RegionsOverview.tsx` | `/regions` |
| `src/pages/region/ui/RegionsSuccessCards.tsx` | `/regions` |
| `src/pages/region/ui/ScopedDistricts.tsx` | `/regions` |
| `src/pages/region/ui/ScopedRegionView.tsx` | `/regions` |
| `src/pages/region/ui/UzbekistanRegionMap.tsx` | `/regions` |
| `src/pages/region/ui/regionBlocks.tsx` | `/regions` |
| `src/pages/returns/index.tsx` | `/returns` |
| `src/pages/returns/model/returnBatches.ts` | `/returns` |
| `src/pages/scan/detail.tsx` | `/scan/:token` |
| `src/pages/scan/index.tsx` | `/scan` |
| `src/pages/scan/lib/scanResource.ts` | `/scan/:token` |
| `src/pages/scan/lib/scanShared.ts` | `/scan` |
| `src/pages/scan/model/scanBatchView.ts` | `/scan/:token` |
| `src/pages/scan/model/scanOrderView.ts` | `/scan/:token` |
| `src/pages/scan/ui/ManagerOrderDialogs.tsx` | `/scan/:token` |
| `src/pages/scan/ui/ScanActionCard.tsx` | `/scan/:token` |
| `src/pages/scan/ui/ScanAlert.tsx` | `/scan/:token` |
| `src/pages/scan/ui/ScanBatchSummary.tsx` | `/scan/:token` |
| `src/pages/scan/ui/ScanOrderResult.tsx` | `/scan/:token` |
| `src/pages/scan/ui/ScanOrdersCard.tsx` | `/scan/:token` |
| `src/pages/scan/ui/ScanPackageDetail.tsx` | `/scan/:token` |
| `src/pages/scan/ui/ScanPostDetail.tsx` | `/scan/:token` |
| `src/pages/scan/ui/ScanResultHeader.tsx` | `/scan/:token` |
| `src/pages/scan/ui/ScanStates.tsx` | `/scan/:token` |
| `src/pages/scan/ui/ScanStickyBar.tsx` | `/scan/:token` |
| `src/pages/scan/ui/ScanTrackingCard.tsx` | `/scan/:token` |
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
| `src/shared/components/popupSelect.tsx` | `/payments/main-cashbox` |
| `src/shared/lib/shellBannerSlot.ts` | `/login` |
| `src/shared/lib/useCameraQrScanner.ts` | `/scan` |
| `src/shared/ui/ErrorBoundary.tsx` | `/runtime-error` |
| `src/shared/ui/ErrorBoundaryPage.tsx` | `/runtime-error` |
| `src/shared/ui/Forbidden.tsx` | `/403` |
| `src/shared/ui/NotFound.tsx` | `/404`, `/*` |
| `src/shared/ui/SelectionRegion.tsx` | `/new-orders/branches/:branchId`, `/new-orders/branches/:branchId/batches/:batchId`, `/new-orders/cancelled/:marketId`, `/mails/return`, `/mails/:id` |
| `src/shared/ui/ServerError.tsx` | `/500` |
| `src/shared/ui/SmsMeter.tsx` | `/notifications/sms` |
| `src/shared/ui/charts/index.ts` | `/`, `/branch-dashboard` |
| `src/shared/ui/error-page/ErrorPageFrame.tsx` | `/403`, `/404`, `/500` |
| `src/widgets/Sidebar/model/menuConfig.tsx` | `(qobiq)` |
| `src/widgets/Sidebar/ui/BottomNav.tsx` | `(qobiq)` |
| `src/widgets/Sidebar/ui/MobileMenu.tsx` | `(qobiq)` |
| `src/widgets/Sidebar/ui/Sidebar.tsx` | `(qobiq)` |
| `src/widgets/Sidebar/ui/SidebarItem.tsx` | `(qobiq)` |
| `src/widgets/activity-log/ui/ActivityLogDetail.tsx` | `/activity-logs` |
| `src/widgets/activity-log/ui/ActivityLogViewer.tsx` | `/activity-logs` |
| `src/widgets/branch-detail/ui/BranchDetailWidget.tsx` | `/branches/:id` |
| `src/widgets/branch-detail/ui/BranchEmployeesSection.tsx` | `/branches/:id` |
| `src/widgets/branch-list/ui/BranchCards.tsx` | `/branches` |
| `src/widgets/branch-list/ui/BranchListWidget.tsx` | `/branches` |
| `src/widgets/branch-list/ui/BranchRowMenu.tsx` | `/branches` |
| `src/widgets/branch-list/ui/BranchSummaryCard.tsx` | `/branches` |
| `src/widgets/branch-list/ui/BranchTable.tsx` | `/branches` |
| `src/widgets/branch-list/ui/BranchTree.tsx` | `/branches` |
| `src/widgets/dashboard-region/ui/RegionOverviewCard.tsx` | `/` |
| `src/widgets/dashboard-region/ui/RegionTiles.tsx` | `/` |
| `src/widgets/dashboard-statistics/ui/DashboardGrid.tsx` | `/` |
| `src/widgets/dashboard-statistics/ui/DashboardHeader.tsx` | `/`, `/branch-dashboard` |
| `src/widgets/dashboard-statistics/ui/OrderStatusCard.tsx` | `/` |
| `src/widgets/dashboard-statistics/ui/SuccessRateCard.tsx` | `/` |
| `src/widgets/dashboard-top-performers/ui/TopRankCard.tsx` | `/`, `/branch-dashboard` |
| `src/widgets/financial-analysis/ui/CashBalanceCard.tsx` | `/` |
| `src/widgets/financial-analysis/ui/FinancialAnalysis.tsx` | `/` |
| `src/widgets/financial-analysis/ui/FinancialTrendPlot.tsx` | `/` |
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
| `src/widgets/order-meta/ui/OrderMeta.tsx` | `/orders/edit/:orderId` |
| `src/widgets/order-tracking/ui/OrderTracking.tsx` | `/orders/edit/:orderId` |
| `src/widgets/region-detail/ui/RegionDetailDialog.tsx` | `/`, `/regions` |
| `src/widgets/user-detail/ui/MarketTelegramTokenCard.tsx` | `/new-orders/userDetail/:id`, `/all-users/:id` |
| `src/widgets/user-detail/ui/UserDetailView.tsx` | `/new-orders/userDetail/:id`, `/all-users/:id` |
| `src/widgets/user-detail/ui/UserDetailWidget.tsx` | `/profile` |
| `src/widgets/user-list/ui/UserListKpi.tsx` | `/all-users` |
| `src/widgets/user-list/ui/UserListTable.tsx` | `/all-users` |
| `src/widgets/user-list/ui/UserRowMenu.tsx` | `/all-users` |

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
