# Ekranlar xaritasi — route ↔ dizayn v2 maketi

> **Avtomatik yaratilgan fayl — qo'lda tahrirlamang.** Manba: `design/kit/route-map.json` (route ↔ maket, qo'lda
> yuritiladi), `src/app/lib/routes.tsx` (yo'llar va guardlar), `design/kit/views.json` (maketlar). Qayta yaratish:
> `npm run design:screens`; tekshirish: `npm run design:screens -- --check`.

**79 ta route** (+ qobiq) · **781 ta maket** (470 sahifa, 291 oyna, 20 tizim taxtasi; 663 ta fragment fayli) · kodda yo'q: **95** · qisman: **151** · v2 ga ko'chirilgan route: **79 / 79**

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
| `(qobiq)` | Qobiq | `src/widgets/layout/dashboardLayout.tsx` | superadmin, admin, manager, registrator, market, market_operator, courier, logist, investor | 10 | v2 |
| `/login` | Kirish va xato sahifalari | `src/features/auth/index.tsx` | hamma (kirishsiz) | 3 | v2 |
| `/403` | Kirish va xato sahifalari | `src/shared/ui/Forbidden.tsx` | hamma (kirishsiz) | 1 | v2 |
| `/404` | Kirish va xato sahifalari | `src/shared/ui/NotFound.tsx` | hamma (kirishsiz) | 1 | v2 |
| `/500` | Kirish va xato sahifalari | `src/shared/ui/ServerError.tsx` | hamma (kirishsiz) | 1 | v2 |
| `/runtime-error` | Kirish va xato sahifalari | `src/shared/ui/ErrorBoundaryPage.tsx` | hamma (kirishsiz) | 1 | v2 |
| `/*` | Kirish va xato sahifalari | `src/shared/ui/NotFound.tsx` | superadmin, admin, manager, registrator, market, market_operator, courier, logist, investor | 1 | v2 |
| `/` | Bosh sahifa | `src/pages/dashboard/MarketDashboardPage.tsx` + `src/pages/dashboard/LogistDashboardPage.tsx` + `src/pages/investor/InvestorDashboardPage.tsx` + `src/pages/dashboard/DashboardPage.tsx` + `src/shared/ui/Forbidden.tsx` | superadmin, admin, manager (→ /branch-dashboard), registrator, market, market_operator (MO-2: DashboardEntry → MarketDashboardPage variant=operator), courier, logist (LogistDashboardPage (LG-1) — o'z viloyatlari, pulsiz), investor (IN-1: DashboardEntry → InvestorDashboardPage (canViewInvestorCabinet)) | 22 | v2 |
| `/branch-dashboard` | Bosh sahifa | `src/pages/branch-dashboard/ui/BranchDashboardPage.tsx` | manager | 4 | v2 |
| `/orders` | Buyurtmalar | `src/pages/orders/index.tsx` | superadmin, admin, manager, registrator, market, market_operator (MO-3: o'z marketi (backend GET /orders operatorni cheklaydi), faqat ko'rish va Excel), courier, logist (taklif — logist faqat ko'radi (LG-S1), kodda yo'q) | 35 | v2 |
| `/orders/edit/:orderId` | Buyurtmalar | `src/pages/new_orders/components/new_orderUpdate.tsx` | superadmin, admin, manager, registrator, market, market_operator (MO-3: o'z marketi (backend GET /orders operatorni cheklaydi), faqat ko'rish va Excel), courier, logist (taklif — logist faqat ko'radi (LG-S1), kodda yo'q) | 33 | v2 |
| `/new-orders` | Qabul va yaratish | `src/pages/new_orders/markets/index.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market, market_operator (MO-3: faqat /new-orders/create («AI bilan»); /new-orders → create, qolgan bolalar 403 (NewOrdersRoleGate). Qo'lda — POST /orders ruxsatidan keyin (MO-7)) | 5 | v2 |
| `/new-orders/create` | Qabul va yaratish | `src/pages/orders/create/index.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market, market_operator (MO-3: faqat /new-orders/create («AI bilan»); /new-orders → create, qolgan bolalar 403 (NewOrdersRoleGate). Qo'lda — POST /orders ruxsatidan keyin (MO-7)) | 43 | v2 |
| `/new-orders/incoming` | Qabul va yaratish | `src/pages/incoming-orders/SourcePicker.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator | 4 | v2 |
| `/new-orders/incoming/:marketId` | Qabul va yaratish | `src/pages/incoming-orders/index.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator | 21 | v2 |
| `/new-orders/branches` | Qabul va yaratish | `src/pages/new_orders/branches/index.tsx` | superadmin, admin | 2 | v2 |
| `/new-orders/branches/:branchId` | Qabul va yaratish | `src/pages/new_orders/branches/batches.tsx` | superadmin, admin | 2 | v2 |
| `/new-orders/branches/:branchId/batches/:batchId` | Qabul va yaratish | `src/pages/new_orders/branches/batchDetail.tsx` | superadmin, admin | 5 | v2 |
| `/new-orders/cancelled` | Qabul va yaratish | `src/pages/new_orders/cancelled/index.tsx` | superadmin, admin, registrator (faqat HQ) | 3 | v2 |
| `/new-orders/cancelled/:marketId` | Qabul va yaratish | `src/pages/new_orders/cancelled/detail.tsx` | superadmin, admin, registrator (faqat HQ), market (faqat o'z marketi) | 18 | v2 |
| `/new-orders/:marketId` | Qabul va yaratish | `src/pages/new_orders/components/new_orderDetail.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market (faqat o'z marketi) | 20 | v2 |
| `/new-orders/:marketId/edit/:orderId` | Qabul va yaratish | `src/pages/new_orders/components/new_orderUpdate.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market (faqat o'z marketi) | 3 | v2 |
| `/new-orders/userDetail/:id` | Qabul va yaratish | `src/pages/users/detail/UserDetailPage.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market, market_operator (MO-3: faqat /new-orders/create («AI bilan»); /new-orders → create, qolgan bolalar 403 (NewOrdersRoleGate). Qo'lda — POST /orders ruxsatidan keyin (MO-7)) | 0 | v2 |
| `/mails` | Pochta | `src/pages/mails/index.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier, logist (taklif — logist faqat ko'radi (LG-S1), kodda yo'q) | 0 | v2 |
| `/mails/today` | Pochta | `src/pages/mails/index.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier, logist (taklif — logist faqat ko'radi (LG-S1), kodda yo'q) | 7 | v2 |
| `/mails/return` | Pochta | `src/pages/mails/index.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier, logist (taklif — logist faqat ko'radi (LG-S1), kodda yo'q) | 4 | v2 |
| `/mails/refused` | Pochta | `src/pages/mails/index.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier, logist (taklif — logist faqat ko'radi (LG-S1), kodda yo'q) | 5 | v2 |
| `/mails/old` | Pochta | `src/pages/mails/index.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier, logist (taklif — logist faqat ko'radi (LG-S1), kodda yo'q) | 7 | v2 |
| `/mails/:id` | Pochta | `src/pages/mails/detail/index.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier, logist (taklif — logist faqat ko'radi (LG-S1), kodda yo'q) | 42 | v2 |
| `/batches` | Paketlar va qaytarishlar | `src/pages/batches/ui/BatchesPage.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), logist (taklif — logist faqat ko'radi (LG-S1), kodda yo'q) | 11 | v2 |
| `/batches/:id` | Paketlar va qaytarishlar | `src/pages/batches/ui/BatchDetailPage.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), logist (taklif — logist faqat ko'radi (LG-S1), kodda yo'q) | 7 | v2 |
| `/returns` | Paketlar va qaytarishlar | `src/pages/returns/index.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID) | 6 | v2 |
| `/dispatch` | Biriktirish va tezkor amal | `src/pages/dispatch/index.tsx` | superadmin, admin, manager (REGIONAL · HYBRID), registrator (HQ · REGIONAL · HYBRID) | 8 | v2 |
| `/courier-bulk` | Biriktirish va tezkor amal | `src/pages/courier-bulk/index.tsx` | manager (REGIONAL · HYBRID), courier | 7 | v2 |
| `/scan` | Skaner | `src/pages/scan/index.tsx` | superadmin, admin, manager, registrator, market, market_operator, courier, logist, investor | 15 | v2 |
| `/scan/:token` | Skaner | `src/pages/scan/detail.tsx` | superadmin, admin, manager, registrator, market, market_operator, courier, logist, investor | 11 | v2 |
| `/tg/scan` | Skaner | `src/pages/tg-scan/index.tsx` | hamma (kirishsiz) | 7 | v2 |
| `/investments` | Moliya | `src/pages/investor/InvestmentsPage.tsx` | investor (IN-2: canViewInvestorCabinet = hasRole('investor') (access.ts); backend GET investors/me/investments — @Roles(INVESTOR), doira JWT'dan) | 3 | v2 |
| `/profits` | Moliya | `src/pages/investor/ProfitsPage.tsx` | investor (IN-2: canViewInvestorCabinet = hasRole('investor') (access.ts); backend GET investors/me/profits — @Roles(INVESTOR), doira JWT'dan) | 2 | v2 |
| `/payments` | Moliya | `src/pages/payments/index.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID) | 32 | v2 |
| `/payments/main-cashbox` | Moliya | `src/pages/payments/components/mainCashbox.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID) | 28 | v2 |
| `/payments/cash-detail/:id` | Moliya | `src/pages/payments/components/cashDetail.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID) | 18 | v2 |
| `/cash-box` | Moliya | `src/pages/payments/components/MyCashboxPage.tsx` | manager, market, courier | 10 | v2 |
| `/my-earnings` | Moliya | `src/pages/my-earnings/index.tsx` | market_operator (MO-2: canViewMyEarnings = hasRole('market_operator') (access.ts)) | 2 | v2 |
| `/financial-balance` | Moliya | `src/pages/financial-balance/index.tsx` | superadmin, admin | 11 | v2 |
| `/payments/shifts/:id` | Moliya | `src/pages/payments/shiftReport/index.tsx` | superadmin, admin, manager (HQ · REGIONAL · HYBRID) | 1 | v2 |
| `/payments/shift-settings` | Moliya | `src/pages/payments/shiftSettings/index.tsx` | superadmin | 4 | v2 |
| `(taklif) /ai-assistant` | Moliya | — (taklif) | superadmin, admin, manager, registrator, market, market_operator, courier, logist, investor | 2 | eski |
| `/products` | Mahsulotlar | `src/pages/products/list/index.tsx` | superadmin, admin, manager, registrator, market (faqat ko'rish), market_operator (faqat ko'rish) | 21 | v2 |
| `/products/create-product/:id` | Mahsulotlar | `src/pages/products/create/index.tsx` | superadmin, admin, manager, registrator | 8 | v2 |
| `/warehouses` | Mahsulotlar | `src/pages/warehouses/index.tsx` | superadmin, admin, manager (REGIONAL · HYBRID — o'z filiali ombori, faqat ko'rish (yXC91RRx); menyu bandi faqat GET /warehouses bo'sh bo'lmasa (XtcEyQjb)), registrator (hamma omborlar, faqat ko'rish (XtcEyQjb, ega 2026-10-24); menyuda yo'q — maket roles.json registrator.menu da «warehouse» yo'q (ega qarori kutilmoqda)) | 4 | v2 |
| `/warehouses/:id` | Mahsulotlar | `src/pages/warehouses/detail/index.tsx` | superadmin, admin, manager (REGIONAL · HYBRID — o'z filiali ombori, faqat ko'rish (yXC91RRx); menyu bandi faqat GET /warehouses bo'sh bo'lmasa (XtcEyQjb)), registrator (hamma omborlar, faqat ko'rish (XtcEyQjb, ega 2026-10-24); menyuda yo'q — maket roles.json registrator.menu da «warehouse» yo'q (ega qarori kutilmoqda)) | 5 | v2 |
| `/all-users` | Foydalanuvchilar | `src/pages/users/list/UserListPage.tsx` | superadmin, admin, manager (filial turi aniq bo'lsa) | 13 | v2 |
| `/all-users/create-user` | Foydalanuvchilar | `src/pages/users/create/CreateUserPage.tsx` | superadmin, admin, manager (filial turi aniq bo'lsa) | 10 | v2 |
| `/all-users/:id` | Foydalanuvchilar | `src/pages/users/detail/UserDetailPage.tsx` | superadmin, admin, manager (filial turi aniq bo'lsa) | 29 | v2 |
| `(taklif) /all-users/market-responsibles` | Foydalanuvchilar | — (taklif) | superadmin, admin | 10 | eski |
| `/market-operators` | Foydalanuvchilar | `src/pages/market-operators/index.tsx` | market (MO-1: canViewMarketOperators = hasRole('market') (access.ts); backend market-operators — @Roles(MARKET), faqat o'z operatorlari) | 8 | v2 |
| `/regions` | Hududlar | `src/pages/region/index.tsx` | superadmin, admin, manager, courier, logist (taklif — o'z viloyatlari (LG-S3), kodda yo'q) | 9 | v2 |
| `/regions/districts` | Hududlar | `src/pages/region/pages/districts/index.tsx` | superadmin, admin | 20 | v2 |
| `/regions/sato-management` | Hududlar | `src/pages/region/pages/sato-management/index.tsx` | superadmin, admin | 12 | v2 |
| `/regions/logist-assignment` | Hududlar | `src/pages/region/pages/logist-assignment/index.tsx` | superadmin, admin | 6 | v2 |
| `/delivery-tariffs` | Hududlar | `src/pages/delivery-tariffs/index.tsx` | superadmin, admin | 4 | v2 |
| `/branches` | Filiallar | `src/pages/branches/ui/BranchesPage.tsx` | superadmin | 3 | v2 |
| `/branches/:id` | Filiallar | `src/pages/branches/ui/BranchDetailPage.tsx` | superadmin | 2 | v2 |
| `/integrations/connections` | Integratsiyalar | `src/pages/integrations/ConnectionsPage.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator | 32 | v2 |
| `/integrations/new` | Integratsiyalar | `src/pages/integrations/CatalogPage.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator | 2 | v2 |
| `/integrations/new/:typeKey` | Integratsiyalar | `src/pages/integrations/wizard/ConnectWizard.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator | 2 | v2 |
| `/integrations/sources` | Integratsiyalar | `src/pages/new_orders/external_orders/index.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator | 2 | v2 |
| `/integrations/sources/create` | Integratsiyalar | `src/pages/new_orders/external_orders/create.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator | 1 | v2 |
| `/integrations/sources/:id` | Integratsiyalar | `src/pages/new_orders/external_orders/detail.tsx` | superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator | 1 | v2 |
| `/notifications` | Bildirishnomalar | `src/pages/notifications/ui/NotificationsPage.tsx` | superadmin, admin | 30 | v2 |
| `/notifications/send` | Bildirishnomalar | `src/pages/notification-send/index.tsx` | superadmin, admin | 18 | v2 |
| `/notifications/sent` | Bildirishnomalar | `src/pages/notification-sent/index.tsx` | superadmin, admin | 12 | v2 |
| `/notifications/sms` | Bildirishnomalar | `src/pages/notifications/ui/SmsPage.tsx` | superadmin, admin | 6 | v2 |
| `/activity-logs` | Tizim | `src/pages/activity-logs/index.tsx` | superadmin, admin | 5 | v2 |
| `/ops` | Tizim | `src/pages/ops/index.tsx` | superadmin | 12 | v2 |
| `/ops/ui-kit` | Tizim | `src/pages/ui-kit/index.tsx` | superadmin | 0 | v2 |
| `/finance-operators` | Tizim | `src/pages/finance-operators/index.tsx` | superadmin | 1 | v2 |
| `/identity-ops` | Tizim | `src/pages/identity-ops/index.tsx` | superadmin | 1 | v2 |
| `/profile` | Profil, sozlamalar, bildirishnomalar qutisi | `src/pages/profile/ui/ProfilePage.tsx` | superadmin, admin, manager, registrator, market, market_operator, courier, logist, investor | 15 | v2 |
| `/settings` | Profil, sozlamalar, bildirishnomalar qutisi | `src/pages/settings/ui/SettingsPage.tsx` | superadmin, admin, manager, registrator, market, market_operator, courier, logist, investor | 7 | v2 |
| `/inbox` | Profil, sozlamalar, bildirishnomalar qutisi | `src/pages/notifications/ui/NotificationInboxPage.tsx` | superadmin, admin, manager, registrator, market, market_operator, courier, logist, investor | 7 | v2 |

## 2. Route bo'yicha maketlar (batafsil)

Har route: fayllar (birinchisi — routes.tsx dagi sahifa), guard zanjiri, kim ocha oladi, izoh va **har rol uchun** maketlar.

### Qobiq — yon menyu, yuqori panel, pastki menyu

#### `(qobiq)` — Har sahifa atrofidagi qobiq: yon menyu, yuqori panel (qidiruv, skaner, qo'ng'iroqcha, profil), pastki menyu va telefon menyusi

- **Fayllar:** `src/widgets/layout/dashboardLayout.tsx` · `src/widgets/layout/scanLayout.tsx` · `src/widgets/Sidebar/ui/Sidebar.tsx` · `src/widgets/Sidebar/ui/SidebarItem.tsx` · `src/widgets/Sidebar/ui/BottomNav.tsx` · `src/widgets/Sidebar/ui/MobileMenu.tsx` · `src/widgets/Sidebar/model/menuConfig.tsx` · `src/widgets/header/ui/Header.tsx` · `src/widgets/header/ui/HeaderSearch.tsx` · `src/widgets/header/ui/SearchScreen.tsx` · `src/widgets/header/ui/NotificationsMenu.tsx` · `src/widgets/header/ui/UserMenu.tsx` · `src/widgets/layout/ui/SkipLink.tsx`
- **Rollar:** superadmin, admin, manager, registrator, market, market_operator, courier, logist, investor
- **Holat:** v2
- **Izoh:** Maketlardagi yon menyu, yuqori panel va pastki menyu design/kit/roles.json dan chiziladi (bandlar, guruhlar, pastki menyu tartibi, persona). Menyu bandi qo'shsangiz — menuConfig.tsx bilan birga roles.json ni ham solishtiring.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `(qobiq)` | superadmin | — Qobiq har sahifa maketida o'z rolining menyusi bilan chizilgan — masalan superadmin-orders-list (oltin sahifa). | — | — | v2 |
| `(qobiq)` | admin | — Qobiq har sahifa maketida chizilgan — masalan admin-orders-list. | — | — | v2 |
| `(qobiq)` | manager | — Qobiq har sahifa maketida chizilgan — masalan manager-orders-list-all (pastki menyuda «Skaner» va «Biriktirish»). | — | — | v2 |
| `(qobiq)` | registrator | — Qobiq har sahifa maketida chizilgan — masalan registrator-orders-list. | — | — | v2 |
| `(qobiq)` | market | `market-dashboard-mobile-menu` — Menyu ochiq — yon panel / pastki varaq | [design/fragments/market--dashboard-mobile-menu.html](fragments/market--dashboard-mobile-menu.html) | oyna · faqat planshet + telefon | v2 |
| `(qobiq)` | market_operator | — Yangi rol qobig'i (maket): yon menyu Bosh sahifa · Buyurtmalar · Buyurtma yaratish · Mahsulotlar · Daromadim; pastki menyu 5 oddiy katak (Skaner va Menyu yo'q) — Bosh sahifa · Buyurtmalar · Yaratish · Mahsulotlar · Daromadim. Bildirishnomalar, Sozlamalar va Chiqish faqat yuqori paneldan (qo'ng'iroqcha, profil menyusi) — eski market xatti-harakati kabi. Profil satri «Market operatori» (profil market nomini qaytarmaydi). Kodda (MO-2, MO-3): yon menyu maketdagidek 5 band (guruhsiz), pastki menyu shu 5 katak; «Buyurtma yaratish» — /new-orders (operatorda /new-orders/create ga yo'naltiriladi; yorlig'i rolga xos — sidebar:createOrder, qisqasi «Yaratish»). Menyu varaqasidagi qidiruv (/orders?search=) MO-3 dan beri ochiq. | — | — | v2 |
| `(qobiq)` | courier | `courier-dashboard-mobile-menu` — Menyu ochiq — yon panel / pastki varaq<br>↳ `src/widgets/Sidebar/ui/MobileMenu.tsx` | [design/fragments/courier--dashboard-mobile-menu.html](fragments/courier--dashboard-mobile-menu.html) | oyna · faqat planshet + telefon | v2 |
| `(qobiq)` | courier | `courier-dashboard-mobile-search` — Global qidiruv (telefon)<br>↳ `src/widgets/header/ui/SearchScreen.tsx` | [design/fragments/courier--dashboard-mobile-search.html](fragments/courier--dashboard-mobile-search.html) | oyna · faqat telefon | v2 |
| `(qobiq)` | courier | `courier-dashboard-user-menu-contacts` — Profil menyusi — «Aloqa» bandi (taklif) | [design/fragments/courier--dashboard-user-menu-contacts.html](fragments/courier--dashboard-user-menu-contacts.html) | sahifa | yangi (kodda yo'q) |
| `(qobiq)` | courier | `courier-dashboard-mobile-menu-contacts` — Menyu varag'i — «Aloqa» bandi (taklif) | [design/fragments/courier--dashboard-mobile-menu-contacts.html](fragments/courier--dashboard-mobile-menu-contacts.html) | oyna · faqat planshet + telefon | yangi (kodda yo'q) |
| `(qobiq)` | courier | `courier-dashboard-contacts-dialog` — «Aloqa» oynasi — profil menyusidan (taklif) | [design/fragments/courier--dashboard-contacts-dialog.html](fragments/courier--dashboard-contacts-dialog.html) | oyna | yangi (kodda yo'q) |
| `(qobiq)` | investor | `investor-dashboard-mobile-menu` — Menyu ochiq — yon panel / pastki varaq<br>↳ `src/widgets/Sidebar/ui/MobileMenu.tsx` | [design/fragments/investor--dashboard-mobile-menu.html](fragments/investor--dashboard-mobile-menu.html) | oyna · faqat planshet + telefon | v2 |
| `(qobiq)` | umumiy (barcha rollar) | `common-bell-dropdown` — Qo'ng'iroqcha ochiq (so'nggi bildirishnomalar)<br>↳ `src/widgets/header/ui/NotificationsMenu.tsx` | [design/fragments/common--bell-dropdown.html](fragments/common--bell-dropdown.html) | oyna | v2 |
| `(qobiq)` | tizim taxtasi | `tizim-states-navigation` — Holatlar — navigatsiya | [design/fragments/tizim--states-navigation.html](fragments/tizim--states-navigation.html) | taxta | qoida |
| `(qobiq)` | tizim taxtasi | `tizim-responsive` — Moslashuvchanlik — telefon, planshet, desktop | [design/fragments/tizim--responsive.html](fragments/tizim--responsive.html) | taxta | qoida |

### Kirish va xato sahifalari

#### `/login` — Tizimga kirish

- **Fayllar:** `src/features/auth/index.tsx` · `src/features/auth/ui/LoginForm.tsx` · `src/features/auth/ui/SessionExpiredScreen.tsx` · `src/auth/loginNotice.ts` · `src/auth/SessionExpiryCountdown.tsx` · `src/shared/lib/shellBannerSlot.ts`
- **Qobiq:** qobiqsiz (kirishsiz) · **Guard:** yo'q (kirishsiz)
- **Rollar:** hamma (kirishsiz)
- **Holat:** v2
- **Izoh:** Dizayn v2 (G3): kirish formasi (common-login, xato holati common-login-error) va «Sessiya tugadi» ekrani (SessionExpiredScreen — logoutAndRedirect({ reason: 'sessionExpired' }) → loginNotice; qo'lda «Chiqish» — to'g'ridan-to'g'ri forma). Sessiya banneri (SessionExpiryCountdown, taxta tizim-feedback 04) butun ilovada: DashboardLayout'da yuqori panel ostidagi shell slotiga ([data-shell-slot=banner], shared/lib/shellBannerSlot.ts) portal — sahifani pastga suradi, hech narsani yopmaydi (maket talabi bilan qo'shilgan shell sloti); ScanLayout'da oqimda, sticky. Ega savoli Q6 sukuti: «© 2026 Elchi Pochta» chizilmaydi (2026-10-16 «footer olib tashlangan»). Kirmagan foydalanuvchining noma'lum yo'li → /login (routes.tsx dagi mavjud xulq, o'zgartirilmadi). Birinchi kadr (rzzxMItN): sekin tarmoqda navy tasma va logotip index.html dagi #login-shell dan JS'ni kutmasdan chiziladi (matnsiz — til hali noma'lum, faqat /login yo'lida, maketdagi joyida), React formani chizganda bitta kadrda almashadi.

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
- **Rollar:** superadmin, admin, manager, registrator, market, market_operator, courier, logist, investor
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/*` | tizim taxtasi | `tizim-errors` — Xato va bo'sh holatlar | [design/fragments/tizim--errors.html](fragments/tizim--errors.html) | taxta | qoida |

### Bosh sahifa

#### `/` — Bosh sahifa — rolga qarab: DashboardPage yoki MarketDashboardPage (dizayn v2)

- **Fayllar:** `src/app/lib/routes.tsx` · `src/pages/dashboard/DashboardPage.tsx` · `src/pages/dashboard/ui/AnalyticsKpiSection.tsx` · `src/pages/dashboard/MarketDashboardPage.tsx` · `src/pages/dashboard/LogistDashboardPage.tsx` · `src/pages/dashboard/ui/LogistRegionSuccessCard.tsx` · `src/pages/dashboard/ui/LogistRegionsTable.tsx` · `src/widgets/dashboard-statistics/ui/DashboardHeader.tsx` · `src/widgets/dashboard-statistics/ui/DashboardGrid.tsx` · `src/widgets/dashboard-statistics/ui/SuccessRateCard.tsx` · `src/widgets/dashboard-statistics/ui/OrderStatusCard.tsx` · `src/pages/dashboard/ui/DeliveryQualityCard.tsx` · `src/pages/dashboard/ui/DeliveryResultsCard.tsx` · `src/widgets/financial-analysis/ui/FinancialAnalysis.tsx` · `src/widgets/financial-analysis/ui/FinancialTrendPlot.tsx` · `src/widgets/financial-analysis/ui/CashBalanceCard.tsx` · `src/widgets/dashboard-top-performers/ui/TopRankCard.tsx` · `src/widgets/dashboard-region/ui/RegionOverviewCard.tsx` · `src/widgets/dashboard-region/ui/RegionTiles.tsx` · `src/widgets/region-detail/ui/RegionDetailDialog.tsx` · `src/pages/dashboard/ui/CourierPlanCard.tsx` · `src/pages/dashboard/ui/CourierCashCard.tsx` · `src/pages/dashboard/ui/MarketSalesCard.tsx` · `src/pages/dashboard/ui/QuickActions.tsx` · `src/pages/dashboard/ui/ExtraCostApprovals.tsx` · `src/pages/dashboard/ui/AutoApprovedExtraCosts.tsx` · `src/pages/dashboard/ui/ExtraCostRejectDialog.tsx` · `src/widgets/dashboard-part-error/ui/DashboardPartError.tsx` · `src/shared/ui/charts/index.ts` · `src/shared/ui/Forbidden.tsx` · `src/pages/investor/InvestorDashboardPage.tsx` · `src/pages/investor/ui/MonthlyProfitCard.tsx` · `src/pages/investor/ui/InvestorListCards.tsx` · `src/pages/investor/ui/ProfitHistoryTable.tsx` · `src/pages/investor/ui/InvestorAccessState.tsx` · `src/shared/ui/charts/StackedBars.tsx` · `src/shared/ui/charts/Sparkline.tsx`
- **Qobiq:** DashboardLayout · **Guard:** yo'q (faqat kirish) · o'rovchi: `DashboardEntry`
- **Rollar:** superadmin, admin, manager (→ /branch-dashboard), registrator, market, market_operator (MO-2: DashboardEntry → MarketDashboardPage variant=operator), courier, logist (LogistDashboardPage (LG-1) — o'z viloyatlari, pulsiz), investor (IN-1: DashboardEntry → InvestorDashboardPage (canViewInvestorCabinet))
- **Menyuda:** «Bosh sahifa» (`dashboard`) — superadmin, admin, registrator, market, market_operator, courier, logist, investor
- **Holat:** v2
- **Izoh:** DashboardEntry (routes.tsx): market → MarketDashboardPage (xarajat tasdiqlari shu sahifada), canViewAdminDashboard rollari (superadmin, admin, registrator, kuryer, eski operator) → DashboardPage (kuryer — alohida tarmoq isCourier), logist → LogistDashboardPage (LG-1, o'z viloyatlari, pulsiz), investor → InvestorDashboardPage (IN-1), market_operator → MarketDashboardPage variant=operator (MO-2, xarajat tasdiqlarisiz), qolgan har rol (menyusiz eski rollar) — 403 ForbiddenPage (ROL-0, sizish yopildi — mDfjKeQi). Dizayn v2 (G1): grafiklar — src/shared/ui/charts (recharts faqat «Moliyaviy tahlil» trendida, FinancialTrendPlot lazy + DeferredMount rootMargin 0; bundle byudjeti 450 KB — tests/e2e/dashboard-bundle.preview.spec.ts), viloyat oynasi — umumiy RegionDetailDialog (lazy, faqat bosilganda; registratorda daromadsiz — showRevenue=false, eski oyna xulqi). Reytinglar top 5 (telefonda top 3) + «Yana ko'rsatish». 2026-10-26 (backend batch D) chizildi: KPI «Yo'qotilgan daromad» (orders.lostRevenue, l9NNdsCH), KPI 14 kunlik sparkline va delta — joriy javobning previous/series bo'lagidan (DwrMygfo, ikkinchi so'rovsiz; kuryerda hamon alohida so'rov), «Maqsad · 80%» (targets.successRate), «Moliyaviy tahlil» qatori «Sof foyda» (revenue profitValues/totalProfit), «Barchasi»da kpi va revenue all=true (XdKajqLe, clamped — «oxirgi N kun» izohi). Chizilmaganlar (Taklif yoki API yo'q, spec §6): «Buyurtmalar vaqti» issiqlik xaritasi, market «Reytingdagi o'rningiz» / «Buyurtmalar dinamikasi», xarajat so'rovida so'rovchi ismi va buyurtma raqami, kuryer «Oxirgi 7 kun». Ega savollari — sukut javoblari qo'llangan (spec §9): Q1 delta va «Kecha» — SA/admin: javobdagi previous (DwrMygfo; «Barchasi»da yo'q), kuryer: oldingi davr uchun ikkinchi so'rov; Q2 gauge belgisi — targets.successRate bo'lsa «Maqsad · 80%», aks holda «Yaxshi chegarasi · 70%»; Q3 registrator sarlavha izohida filial nomi (backend registratorni filialga cheklaydi); Q4 «Moliyaviy tahlil» — maketdagidek «Sof foyda» qatori (l9NNdsCH), izoh «Sof foyda = market tarifi − kuryer va filial ulushi» (backend formulasi); Q5 kuryer «Kassa» sharsharasi faqat my-cashbox bugungi tarixni bersa, aks holda «Qo'lingizdagi pul»; Q6 market «Tasdiqlash» — pul amali, tasdiq oynasi bilan (useConfirm), «Rad etish» — sabab oynasi ExtraCostRejectDialog; 409 «allaqachon hal qilingan» — qayta yuklash + info toast; market_operator — faqat ko'rish (dev, Urozov04); Q7 «Barchasi»da «Yetkazish sifati», «Moliyaviy tahlil» (oylik, solishtirishsiz) va «Kassa» all=true bilan chiziladi (XdKajqLe). Ega tasdig'i 2026-10-19 (small-p1 S3): «Ilovani o'rnatish» taklifi kuryer bosh sahifasida bir marta (yopiladi, courier-dashboard-pwa-install); Sozlamalar va Bildirishnomalarda doim. 2crjWf7v: superadmin bosh sahifasi oxirida «Kvitansiya yetkazilishi» (GET /telegram/dm-delivery, faqat superadmin; maket yo'q — eng yaqini superadmin-notifications-sms-report «Yetkazilish» o'lchagichi; ega qarori kutilmoqda): spidometr delivery_ratio, «Yetdi» / «Xato», «Qamrov» reach_ratio, navbat va «Yuborilmadi» sabablari; davr — bosh sahifa davri (bo'sh — oxirgi 30 kun).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/` | superadmin | `superadmin-dashboard-main` — Dashboard — Bugungi statistika<br>↳ `src/pages/dashboard/DashboardPage.tsx` | [design/fragments/superadmin--dashboard-main.html](fragments/superadmin--dashboard-main.html) | sahifa | v2 |
| `/` | superadmin | `superadmin-dashboard-region-modal` — Dashboard — Viloyat tafsiloti (xarita)<br>↳ `src/widgets/region-detail/ui/RegionDetailDialog.tsx` | [design/fragments/superadmin--dashboard-region-modal.html](fragments/superadmin--dashboard-region-modal.html) | oyna | v2 |
| `/` | admin | `admin-dashboard-main` — Dashboard<br>↳ `src/pages/dashboard/DashboardPage.tsx` | [design/fragments/admin--dashboard-main.html](fragments/admin--dashboard-main.html) | sahifa | v2 |
| `/` | manager | — DashboardEntry menejerni /branch-dashboard ga yo'naltiradi. | — | — | v2 |
| `/` | registrator | `registrator-dashboard-main` — Dashboard — statistika<br>↳ `src/pages/dashboard/DashboardPage.tsx` | [design/fragments/registrator--dashboard-main.html](fragments/registrator--dashboard-main.html) | sahifa | v2 |
| `/` | market | `market-dashboard-home` — Mening dashboardim<br>↳ `src/pages/dashboard/MarketDashboardPage.tsx` | [design/fragments/market--dashboard-home.html](fragments/market--dashboard-home.html) | sahifa | v2 |
| `/` | market | `market-dashboard-extra-cost-approvals` — Dashboard · Xarajat tasdiqlari<br>↳ `src/pages/dashboard/ui/ExtraCostApprovals.tsx` | [design/fragments/market--dashboard-extra-cost-approvals.html](fragments/market--dashboard-extra-cost-approvals.html) | sahifa | v2 |
| `/` | market | `market-dashboard-home-contacts` — Bosh sahifa — «Elchi mas'ulingiz» kartasi | [design/fragments/market--dashboard-home-contacts.html](fragments/market--dashboard-home-contacts.html) | sahifa | yangi (kodda yo'q) |
| `/` | market_operator | — Maket yo'q — eng yaqini: market-dashboard-home. MO-2 (2026-10-21): DashboardEntry → MarketDashboardPage variant="operator". GET analytics/dashboard market_operator'ga ochiq (DASHBOARD_ROLES; analytics resolveRequesterForMarket operatorni o'z marketiga cheklaydi: myStat, markets, topMarkets, topOperators). Qo'shimcha xarajat tasdiqlari — faqat o'qish (6QLF7nst / N14, MO-8; backend 8f0811b): GET orders/extra-cost-approvals operatorga ochiq (o'z marketi), approve/reject — 403; ExtraCostApprovals tugmalarsiz, sarlavhada «Faqat market egasi qaror qiladi»; marketga biriktirilmagan operatorda so'ralmaydi. «Avtomatik tasdiqlangan xarajatlar» (AutoApprovedExtraCosts — market e'tirozi uchun) yo'q. Sarlavha izohida market nomi yo'q (my-profile market nomini bermaydi — N13), o'rnida davr; «Marketlar bo'yicha sotuv foizi» da o'z qatori — profil market_id. «Tezkor harakatlar»: «Buyurtmalarni ko'rish» → /orders (faqat canViewOrders), «Buyurtma yaratish» va sarlavhadagi tugma — faqat canCreateOrders; holat kartasidagi ro'yxat havolasi — faqat canViewOrders. Ikkala ruxsat MO-3 da ochiladi — shungacha karta va havolalar yo'q (403 ga olib bormaydi). «To'lovlar»/kassa kartasi va moliya havolalari yo'q (finance ruxsati yo'q). | — | — | v2 |
| `/` | courier | `courier-dashboard-home` — Bosh sahifa — kuryer statistikasi<br>↳ `src/pages/dashboard/DashboardPage.tsx` | [design/fragments/courier--dashboard-home.html](fragments/courier--dashboard-home.html) | sahifa | v2 |
| `/` | courier | `courier-dashboard-pwa-install` — Bosh sahifa — ilovani o'rnatish taklifi (bir marta, yopiladi)<br>↳ `src/features/pwa-install/ui/InstallAppCard.tsx` | [design/fragments/courier--dashboard-pwa-install.html](fragments/courier--dashboard-pwa-install.html) | sahifa | v2 |
| `/` | courier | `courier-dashboard-home-contacts` — Bosh sahifa — «Viloyatingiz logisti» kartasi | [design/fragments/courier--dashboard-home-contacts.html](fragments/courier--dashboard-home-contacts.html) | sahifa | yangi (kodda yo'q) |
| `/` | logist | `logist-dashboard-main` — Bosh sahifa — viloyatlarim<br>↳ `src/pages/dashboard/LogistDashboardPage.tsx` | [design/fragments/logist--dashboard-main.html](fragments/logist--dashboard-main.html) | sahifa | qisman |
| `/` | logist | `logist-dashboard-mobile-menu` — Menyu ochiq — yon panel / pastki varaq<br>↳ `src/widgets/Sidebar/ui/MobileMenu.tsx` | [design/fragments/logist--dashboard-mobile-menu.html](fragments/logist--dashboard-mobile-menu.html) | oyna · faqat planshet + telefon | qisman |
| `/` | logist | `logist-dashboard-mobile-search` — Global qidiruv (telefon) — buyurtma, mijoz, telefon | [design/fragments/logist--dashboard-mobile-search.html](fragments/logist--dashboard-mobile-search.html) | oyna · faqat telefon | yangi (kodda yo'q) |
| `/` | investor | `investor-dashboard-home` — Bosh sahifa — investor kabineti<br>↳ `src/pages/investor/InvestorDashboardPage.tsx` | [design/fragments/investor--dashboard-home.html](fragments/investor--dashboard-home.html) | sahifa | qisman |
| `/` | investor | `investor-dashboard-home-table` — Bosh sahifa — oylik foyda jadvali<br>↳ `src/pages/investor/ui/MonthlyProfitCard.tsx` | [design/fragments/investor--dashboard-home-table.html](fragments/investor--dashboard-home-table.html) | sahifa | v2 |
| `/` | investor | `investor-dashboard-loading` — Bosh sahifa — yuklanmoqda<br>↳ `src/pages/investor/InvestorDashboardPage.tsx` | [design/fragments/investor--dashboard-loading.html](fragments/investor--dashboard-loading.html) | sahifa | v2 |
| `/` | investor | `investor-dashboard-empty` — Bosh sahifa — ma'lumot yo'q<br>↳ `src/pages/investor/InvestorDashboardPage.tsx` | [design/fragments/investor--dashboard-empty.html](fragments/investor--dashboard-empty.html) | sahifa | v2 |
| `/` | investor | `investor-dashboard-error` — Bosh sahifa — yuklash xatosi<br>↳ `src/pages/investor/InvestorDashboardPage.tsx` | [design/fragments/investor--dashboard-error.html](fragments/investor--dashboard-error.html) | sahifa | v2 |
| `/` | investor | `investor-dashboard-forbidden` — Bosh sahifa — profil nofaol (403)<br>↳ `src/pages/investor/ui/InvestorAccessState.tsx` | [design/fragments/investor--dashboard-forbidden.html](fragments/investor--dashboard-forbidden.html) | sahifa | v2 |
| `/` | investor | `investor-dashboard-not-linked` — Bosh sahifa — profil bog'lanmagan (404)<br>↳ `src/pages/investor/ui/InvestorAccessState.tsx` | [design/fragments/investor--dashboard-not-linked.html](fragments/investor--dashboard-not-linked.html) | sahifa | v2 |
| `/` | tizim taxtasi | `tizim-charts` — Grafiklar — statistika va tahlil | [design/fragments/tizim--charts.html](fragments/tizim--charts.html) | taxta | qoida |
| `/` | tizim taxtasi | `tizim-contact-card` — Aloqa kartasi va «Muammo bo'lsa» — holatlar | [design/fragments/tizim--contact-card.html](fragments/tizim--contact-card.html) | taxta | qoida |

#### `/branch-dashboard` — Filial paneli (menejer bosh sahifasi, dizayn v2)

- **Fayllar:** `src/pages/branch-dashboard/index.tsx` · `src/pages/branch-dashboard/ui/BranchDashboardPage.tsx` · `src/pages/branch-dashboard/ui/BranchCards.tsx` · `src/pages/branch-dashboard/ui/branchDashboardAdapter.ts` · `src/widgets/dashboard-statistics/ui/DashboardHeader.tsx` · `src/widgets/dashboard-top-performers/ui/TopRankCard.tsx` · `src/widgets/dashboard-part-error/ui/DashboardPartError.tsx` · `src/shared/ui/charts/index.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewBranchDashboard` (routes.tsx → canViewBranchDashboard)
- **Rollar:** manager
- **Menyuda:** «Bosh sahifa» (`dashboard`) — manager
- **Holat:** v2
- **Izoh:** Asosiy fayl — ui/BranchDashboardPage.tsx (index.tsx faqat qayta eksport). «Sizning filial» — reytingda pinned qator; stats_unavailable — ErrorState «Statistika vaqtincha mavjud emas»; davr sukuti — bugun.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/branch-dashboard` | manager | `manager-branch-dashboard-main` — Filial paneli<br>↳ `src/pages/branch-dashboard/ui/BranchDashboardPage.tsx` | [design/fragments/manager--branch-dashboard-main.html](fragments/manager--branch-dashboard-main.html) | sahifa | v2 |
| `/branch-dashboard` | manager | `manager-branch-dashboard-contacts` — Filial paneli — «Viloyatingiz logisti» kartasi | [design/fragments/manager--branch-dashboard-contacts.html](fragments/manager--branch-dashboard-contacts.html) | sahifa | yangi (kodda yo'q) |
| `/branch-dashboard` | tizim taxtasi | `tizim-charts` — Grafiklar — statistika va tahlil | [design/fragments/tizim--charts.html](fragments/tizim--charts.html) | taxta | qoida |
| `/branch-dashboard` | tizim taxtasi | `tizim-contact-card` — Aloqa kartasi va «Muammo bo'lsa» — holatlar | [design/fragments/tizim--contact-card.html](fragments/tizim--contact-card.html) | taxta | qoida |

### Buyurtmalar

#### `/orders` — Buyurtmalar ro'yxati (kuryerda — alohida ro'yxat komponenti)

- **Fayllar:** `src/pages/orders/index.tsx` · `src/pages/orders/list/OrderFilters.tsx` · `src/pages/orders/list/OrderFiltersSheet.tsx` · `src/pages/orders/list/OrdersTable.tsx` · `src/pages/orders/list/orderFilterModel.ts` · `src/pages/orders/list/useOrdersRefresh.ts` · `src/pages/orders/list/OrdersRefreshMeta.tsx` · `src/pages/orders/list/OrdersRefreshAlert.tsx` · `src/pages/orders/list/courier/index.tsx` · `src/pages/orders/list/courier/list/tabs.tsx` · `src/pages/orders/list/courier/list/ordertable/pendingOrderTable.tsx` · `src/pages/orders/list/courier/list/ordertable/AllOrdersTable.tsx` · `src/pages/orders/list/courier/list/ordertable/CancelledOrdersTable.tsx` · `src/pages/orders/list/courier/list/ordertable/CourierOrdersTable.tsx` · `src/pages/orders/list/courier/list/SellModal.tsx` · `src/pages/orders/list/courier/list/CancelModal.tsx` · `src/pages/orders/list/courier/list/RollbackOrderDialog.tsx` · `src/pages/orders/list/courier/list/OrderActionParts.tsx` · `src/entities/orders/ui/ExtraCostApprovalAlerts.tsx` · `src/entities/orders/ui/ExtraCostApprovalTag.tsx` · `src/entities/order/ui/ReturnRequestedTag.tsx` · `src/entities/order/ui/FulfillmentSourceTag.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewOrders` (access.ts → canViewOrders)
- **Rollar:** superadmin, admin, manager, registrator, market, market_operator (MO-3: o'z marketi (backend GET /orders operatorni cheklaydi), faqat ko'rish va Excel), courier, logist (taklif — logist faqat ko'radi (LG-S1), kodda yo'q)
- **Menyuda:** «Buyurtmalar» (`orders`) — superadmin, admin, manager, registrator, market, market_operator, courier
- **Holat:** v2
- **Izoh:** Kuryer ro'yxati — list/courier/index.tsx (tablar list/courier/list/tabs.tsx). Kuryerdan boshqa barcha rollarda bir xil 8 holat tabi (Barchasi · Yangi · Qabul qilindi · Yo'lda · Kutilmoqda · Sotilgan · To'langan · Bekor qilingan; tab sonlari API'da yo'q — chizilmaydi, OR-2 backenddan keyin). Menejerning qatordagi sotish/bekor/qaytarish amallari faqat REGIONAL · HYBRID filialda va can_sell_cancel yoqilganda; «Bekor qilingan» tabida HQ'ga yuborish (tanlov + QR skaner) ham faqat REGIONAL · HYBRID. Qator bosilsa → /orders/edit/:orderId. Yangilanish (OR-1, list/useOrdersRefresh.ts; ega orders-refresh S1–S4): avtomatik — har 60 s (faqat ko'rinadigan brauzer tabida) va ilovaga qaytganda — ma'lumot 30 s dan eski bo'lsa (global staleTime; refetchOnWindowFocus faqat shu so'rovlarda), qo'shimcha xarajat tasdig'i 30 s lik pollingi bilan birlashadi; sotish/bekor/qaytarish oynasi yoki skaner kamerasi ochiq bo'lsa to'xtaydi. Sarlavhada «Jami N ta buyurtma» · «Oxirgi yangilanish: HH:mm» (dataUpdatedAt) · «Avtomatik yangilanadi», qo'lda «Yangilash» (ghost, RefreshCw; telefonda h1 qatorining o'ng chetida chegarali ikonka — PageHeader grow) — barcha rollar va tablarda bir xil; «Yangilash» ro'yxat, tab sonlari (kuryer) va qadalgan (raqam bo'yicha aniq) buyurtmani birga so'raydi. Holatlar: *-refreshing — h1 yonida «Yangilanmoqda…» belgisi faqat fon so'rovi 400 ms dan uzoq cho'zilsa (tizim--loading 11-namuna), tugmalar band, kuryer tab sonlari xira (Tabs countBusy); *-refresh-error — ro'yxat kartasi ustida (kuryer telefonida tablar va qidiruvdan keyin) warning alert «Ro'yxat yangilanmadi» + «Qayta urinish» + × (S3; yo'qolganda fokus «Yangilash» ga qaytadi), eski qatorlar ko'rinib turadi, global xato xabari chiqmaydi (ma'lumot bo'lsa meta.silentError); kuryer bo'lmagan rollarda matn tab sonlarisiz. Kuryer tab sonlari — GET orders/courier/orders/counts. 6kHnNH9j (maket yo'q — eng yaqini superadmin-neworders-create-manual-source dagi neytral «Ombordan» belgisi): fulfillment_source = WAREHOUSE bo'lsa holat yonida «Ombordan · <ombor nomi>» (FulfillmentSourceTag; tafsilot sarlavhasida ham); panelda «Manba» filtri (Barchasi · Ombordan · HQ orqali → fulfillment_source; superadmin, admin, registrator, menejer; telefon varaqasida segment; chip «Manba: …»). Elchi-Backend#568: ombor buyurtmasi bekor bo'lib omborga qaytgan (returned_to_market + holder MARKET, tracking warehouse_returned) — holat belgisi «Omborga qaytdi» (Warehouse, neytral; ro'yxat, tafsilot, «Hozir kimda», tarix, «Qaytarish yo'li» qadami).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/orders` | superadmin | `superadmin-orders-list` — Buyurtmalar ro'yxati | [design/fragments/superadmin--orders-list.html](fragments/superadmin--orders-list.html) | sahifa | qisman |
| `/orders` | superadmin | `superadmin-orders-list-cancelled` — Buyurtmalar — Bekor qilinganlar: bosqich va joy (taklif) | [design/fragments/superadmin--orders-list-cancelled.html](fragments/superadmin--orders-list-cancelled.html) | sahifa | qisman |
| `/orders` | superadmin | `superadmin-orders-list-refreshing` — Buyurtmalar ro'yxati — yangilanmoqda | [design/fragments/superadmin--orders-list-refreshing.html](fragments/superadmin--orders-list-refreshing.html) | sahifa | qisman |
| `/orders` | superadmin | `superadmin-orders-list-refresh-error` — Buyurtmalar ro'yxati — yangilanmadi | [design/fragments/superadmin--orders-list-refresh-error.html](fragments/superadmin--orders-list-refresh-error.html) | sahifa | qisman |
| `/orders` | superadmin | `superadmin-orders-filters-mobile` — Buyurtmalar — filtr paneli (telefon)<br>↳ `src/pages/orders/list/OrderFilters.tsx` | [design/fragments/superadmin--orders-filters-mobile.html](fragments/superadmin--orders-filters-mobile.html) | oyna · faqat telefon | v2 |
| `/orders` | superadmin | `superadmin-orders-list-skip-link` — Buyurtmalar ro'yxati — «Asosiy kontentga o'tish» havolasi fokusda<br>↳ `src/widgets/layout/ui/SkipLink.tsx` | [design/fragments/superadmin--orders-list-skip-link.html](fragments/superadmin--orders-list-skip-link.html) | sahifa | v2 |
| `/orders` | superadmin | `superadmin-orders-list-special-categories` — Buyurtmalar ro'yxati — maxsus belgilar (2 + «+N») | [design/fragments/superadmin--orders-list-special-categories.html](fragments/superadmin--orders-list-special-categories.html) | sahifa | yangi (kodda yo'q) |
| `/orders` | admin | `admin-orders-list` — Buyurtmalar ro'yxati | [design/fragments/admin--orders-list.html](fragments/admin--orders-list.html) | sahifa | qisman |
| `/orders` | admin | `admin-orders-filters-mobile` — Buyurtmalar — filtr paneli (telefon)<br>↳ `src/pages/orders/list/OrderFilters.tsx` | [design/fragments/superadmin--orders-filters-mobile.html](fragments/superadmin--orders-filters-mobile.html) | oyna · faqat telefon | v2 |
| `/orders` | manager | `manager-orders-list-all` — Buyurtmalar — Hamma buyurtmalar | [design/fragments/manager--orders-list-all.html](fragments/manager--orders-list-all.html) | sahifa | v2 |
| `/orders` | manager | `manager-orders-list-all-refreshing` — Buyurtmalar — Hamma buyurtmalar, yangilanmoqda | [design/fragments/manager--orders-list-all-refreshing.html](fragments/manager--orders-list-all-refreshing.html) | sahifa | qisman |
| `/orders` | manager | `manager-orders-list-all-refresh-error` — Buyurtmalar — Hamma buyurtmalar, yangilanmadi | [design/fragments/manager--orders-list-all-refresh-error.html](fragments/manager--orders-list-all-refresh-error.html) | sahifa | qisman |
| `/orders` | manager | `manager-orders-list-pending` — Buyurtmalar — Kutilayotgan | [design/fragments/manager--orders-list-pending.html](fragments/manager--orders-list-pending.html) | sahifa | v2 |
| `/orders` | manager | `manager-orders-list-cancelled` — Buyurtmalar — Bekor qilinganlar (HQ'ga yuborish) | [design/fragments/manager--orders-list-cancelled.html](fragments/manager--orders-list-cancelled.html) | sahifa | qisman |
| `/orders` | manager | `manager-orders-sell-dialog` — Sotish oynasi<br>↳ `src/pages/orders/list/courier/list/SellModal.tsx` | [design/fragments/manager--orders-sell-dialog.html](fragments/manager--orders-sell-dialog.html) | oyna | v2 |
| `/orders` | manager | `manager-orders-cancel-dialog` — Bekor qilish oynasi<br>↳ `src/pages/orders/list/courier/list/CancelModal.tsx` | [design/fragments/manager--orders-cancel-dialog.html](fragments/manager--orders-cancel-dialog.html) | oyna | v2 |
| `/orders` | manager | `manager-orders-rollback-dialog` — Buyurtmani qaytarish tasdig'i<br>↳ `src/pages/orders/list/courier/list/RollbackOrderDialog.tsx` | [design/fragments/manager--orders-rollback-dialog.html](fragments/manager--orders-rollback-dialog.html) | oyna | v2 |
| `/orders` | registrator | `registrator-orders-list` — Buyurtmalar ro'yxati | [design/fragments/registrator--orders-list.html](fragments/registrator--orders-list.html) | sahifa | qisman |
| `/orders` | registrator | `registrator-orders-filters-mobile` — Buyurtmalar — filtr paneli (telefon)<br>↳ `src/pages/orders/list/OrderFilters.tsx` | [design/fragments/registrator--orders-filters-mobile.html](fragments/registrator--orders-filters-mobile.html) | oyna · faqat telefon | v2 |
| `/orders` | market | `market-orders-list` — Buyurtmalar ro'yxati | [design/fragments/market--orders-list.html](fragments/market--orders-list.html) | sahifa | qisman |
| `/orders` | market_operator | — Maket yo'q — eng yaqini: market-orders-list va market-orders-detail. GET orders — JwtAuthGuard, ichida operator o'z marketiga cheklanadi (resolveMarketOperatorMarketId); tafsilot assertCanViewOrder — faqat o'z marketi. Excel eksport bor (GET orders/export/excel @Roles … MARKET_OPERATOR). Kodda (MO-3): market ro'yxati bilan bir xil (isMarketSideRole — market va kuryer filtrlarisiz, Excel izohi), «Buyurtma yaratish» → /new-orders/create; «Viloyat» filtri yo'q — GET /region operatorga 403 (N11). | — | — | v2 |
| `/orders` | courier | `courier-orders-pending` — Buyurtmalar — Kutilayotganlar<br>↳ `src/pages/orders/list/courier/index.tsx` | [design/fragments/courier--orders-pending.html](fragments/courier--orders-pending.html) | sahifa | v2 |
| `/orders` | courier | `courier-orders-pending-refreshing` — Buyurtmalar — Kutilayotganlar, yangilanmoqda<br>↳ `src/pages/orders/list/courier/index.tsx` | [design/fragments/courier--orders-pending-refreshing.html](fragments/courier--orders-pending-refreshing.html) | sahifa | v2 |
| `/orders` | courier | `courier-orders-pending-refresh-error` — Buyurtmalar — Kutilayotganlar, yangilanmadi<br>↳ `src/pages/orders/list/courier/index.tsx` | [design/fragments/courier--orders-pending-refresh-error.html](fragments/courier--orders-pending-refresh-error.html) | sahifa | v2 |
| `/orders` | courier | `courier-orders-tab-switcher-open` — Buyurtmalar — tab almashtirildi, yuklanmoqda<br>↳ `src/pages/orders/list/courier/list/tabs.tsx` | [design/fragments/courier--orders-tab-switcher-open.html](fragments/courier--orders-tab-switcher-open.html) | sahifa · faqat telefon | v2 |
| `/orders` | courier | `courier-orders-all` — Buyurtmalar — Hammasi<br>↳ `src/pages/orders/list/courier/index.tsx` | [design/fragments/courier--orders-all.html](fragments/courier--orders-all.html) | sahifa | v2 |
| `/orders` | courier | `courier-orders-cancelled` — Buyurtmalar — Bekor qilinganlar<br>↳ `src/pages/orders/list/courier/index.tsx` | [design/fragments/courier--orders-cancelled.html](fragments/courier--orders-cancelled.html) | sahifa | v2 |
| `/orders` | courier | `courier-orders-sell-dialog` — Sotish oynasi<br>↳ `src/pages/orders/list/courier/list/SellModal.tsx` | [design/fragments/courier--orders-sell-dialog.html](fragments/courier--orders-sell-dialog.html) | oyna | v2 |
| `/orders` | courier | `courier-orders-sell-extra-cost-dialog` — Sotish — qo'shimcha xarajat bilan<br>↳ `src/pages/orders/list/courier/list/SellModal.tsx` | [design/fragments/courier--orders-sell-extra-cost-dialog.html](fragments/courier--orders-sell-extra-cost-dialog.html) | oyna | v2 |
| `/orders` | courier | `courier-orders-sell-partial-dialog` — Qisman sotish oynasi<br>↳ `src/pages/orders/list/courier/list/SellModal.tsx` | [design/fragments/courier--orders-sell-partial-dialog.html](fragments/courier--orders-sell-partial-dialog.html) | oyna | v2 |
| `/orders` | courier | `courier-orders-action-approval-pending` — Market tasdig'i kutilmoqda<br>↳ `src/pages/orders/list/courier/list/SellModal.tsx` | [design/fragments/courier--orders-action-approval-pending.html](fragments/courier--orders-action-approval-pending.html) | oyna | v2 |
| `/orders` | courier | `courier-orders-cancel-dialog` — Bekor qilish oynasi<br>↳ `src/pages/orders/list/courier/list/CancelModal.tsx` | [design/fragments/courier--orders-cancel-dialog.html](fragments/courier--orders-cancel-dialog.html) | oyna | v2 |
| `/orders` | courier | `courier-orders-rollback-confirm` — Buyurtmani qaytarish tasdig'i<br>↳ `src/pages/orders/list/courier/list/RollbackOrderDialog.tsx` | [design/fragments/courier--orders-rollback-confirm.html](fragments/courier--orders-rollback-confirm.html) | oyna | v2 |
| `/orders` | courier | `courier-orders-pending-special-categories` — Buyurtmalar — Kutilayotganlar, maxsus belgilar | [design/fragments/courier--orders-pending-special-categories.html](fragments/courier--orders-pending-special-categories.html) | sahifa | yangi (kodda yo'q) |
| `/orders` | logist | `logist-orders-list` — Buyurtmalar — faqat ko'rish | [design/fragments/logist--orders-list.html](fragments/logist--orders-list.html) | sahifa | yangi (kodda yo'q) |
| `/orders` | tizim taxtasi | `tizim-states-data` — Holatlar — jadval, ro'yxat, kartalar | [design/fragments/tizim--states-data.html](fragments/tizim--states-data.html) | taxta | qoida |

#### `/orders/edit/:orderId` — Buyurtma tafsiloti va tahrirlash (alohida «detail» marshruti yo'q — tafsilot shu sahifa)

- **Fayllar:** `src/pages/new_orders/components/new_orderUpdate.tsx` · `src/pages/new_orders/components/detail/DetailHeader.tsx` · `src/pages/new_orders/components/detail/DetailAlerts.tsx` · `src/pages/new_orders/components/detail/CustomerCard.tsx` · `src/pages/new_orders/components/detail/AddressCard.tsx` · `src/pages/new_orders/components/detail/PaymentCard.tsx` · `src/pages/new_orders/components/detail/ProductsCard.tsx` · `src/pages/new_orders/components/detail/ProofCard.tsx` · `src/pages/new_orders/components/detail/CourierCards.tsx` · `src/pages/new_orders/components/detail/orderDetailAccess.ts` · `src/pages/new_orders/components/detail/orderDetailModel.ts` · `src/pages/new_orders/components/newOrderUpdateRules.ts` · `src/pages/new_orders/components/editDialogs/index.ts` · `src/pages/new_orders/components/editDialogs/EditAddressDialog.tsx` · `src/pages/new_orders/components/editDialogs/EditCustomerDialog.tsx` · `src/pages/new_orders/components/editDialogs/EditOrderDialog.tsx` · `src/widgets/order-tracking/ui/OrderTracking.tsx` · `src/features/order-tracking/ui/TrackingTimelineItem.tsx` · `src/entities/order/ui/ProofGallery.tsx` · `src/widgets/order-meta/ui/OrderMeta.tsx` · `src/pages/orders/list/courier/list/SellModal.tsx` · `src/pages/orders/list/courier/list/CancelModal.tsx` · `src/pages/orders/list/courier/list/RollbackOrderDialog.tsx` · `src/features/order-return/ui/InitiateReturnModal.tsx` · `src/features/order-return/ui/MarkReturnedModal.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewOrders` (access.ts → canViewOrders)
- **Rollar:** superadmin, admin, manager, registrator, market, market_operator (MO-3: o'z marketi (backend GET /orders operatorni cheklaydi), faqat ko'rish va Excel), courier, logist (taklif — logist faqat ko'radi (LG-S1), kodda yo'q)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Mijozni tahrirlash — faqat superadmin/admin; buyurtma va manzilni tahrirlash — superadmin/admin/registrator/menejer; market va kuryer — faqat o'qish. Sotish/bekor/qaytarish — REGIONAL · HYBRID menejeri. Ayni komponent /new-orders/:marketId/edit/:orderId da ham ishlatiladi. QR va yorliq (TzfF0bmQ; tafsilot maketlarida yo'q — eng yaqini: QR kartasi *-batches-detail, menyu courier-mails-detail-print-menu; joyini ega hali tasdiqlamagan): «To'lov» kartasidan keyin «QR kod» (qr_code_token yo'q — karta yo'q), sarlavhada «Chop etish» — brauzer yoki PDF 100×60 mm. Xodimlar va market; kuryerda yo'q.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/orders/edit/:orderId` | superadmin | `superadmin-orders-detail` — Buyurtma tafsilotlari | [design/fragments/superadmin--orders-detail.html](fragments/superadmin--orders-detail.html) | sahifa | v2 |
| `/orders/edit/:orderId` | superadmin | `superadmin-orders-detail-cancelled` — Buyurtma tafsilotlari — marketga topshirilgan, «Qaytarish yo'li» (taklif) | [design/fragments/superadmin--orders-detail-cancelled.html](fragments/superadmin--orders-detail-cancelled.html) | sahifa | yangi (kodda yo'q) |
| `/orders/edit/:orderId` | superadmin | `superadmin-orders-detail-edit-order-dialog` — Buyurtmani tahrirlash (popup)<br>↳ `src/pages/new_orders/components/editDialogs/EditOrderDialog.tsx` | [design/fragments/superadmin--orders-detail-edit-order-dialog.html](fragments/superadmin--orders-detail-edit-order-dialog.html) | oyna | v2 |
| `/orders/edit/:orderId` | superadmin | `superadmin-orders-detail-edit-customer-dialog` — Mijoz ma'lumotini tahrirlash (popup)<br>↳ `src/pages/new_orders/components/editDialogs/EditCustomerDialog.tsx` | [design/fragments/superadmin--orders-detail-edit-customer-dialog.html](fragments/superadmin--orders-detail-edit-customer-dialog.html) | oyna | v2 |
| `/orders/edit/:orderId` | superadmin | `superadmin-orders-detail-edit-address-dialog` — Manzilni tahrirlash (popup)<br>↳ `src/pages/new_orders/components/editDialogs/EditAddressDialog.tsx` | [design/fragments/superadmin--orders-detail-edit-address-dialog.html](fragments/superadmin--orders-detail-edit-address-dialog.html) | oyna | v2 |
| `/orders/edit/:orderId` | superadmin | `superadmin-orders-detail-special-categories` — Buyurtma tafsilotlari — maxsus belgilar, «O'zgartirish», tarix | [design/fragments/superadmin--orders-detail-special-categories.html](fragments/superadmin--orders-detail-special-categories.html) | sahifa | yangi (kodda yo'q) |
| `/orders/edit/:orderId` | superadmin | `superadmin-orders-detail-special-categories-dialog` — Buyurtma tafsilotlari — «Maxsus belgilar» oynasi | [design/fragments/superadmin--orders-detail-special-categories-dialog.html](fragments/superadmin--orders-detail-special-categories-dialog.html) | oyna | yangi (kodda yo'q) |
| `/orders/edit/:orderId` | superadmin | `superadmin-orders-detail-special-categories-locked` — «Maxsus belgilar» oynasi — holat qulflandi (409) | [design/fragments/superadmin--orders-detail-special-categories-locked.html](fragments/superadmin--orders-detail-special-categories-locked.html) | oyna | yangi (kodda yo'q) |
| `/orders/edit/:orderId` | admin | `admin-orders-detail` — Buyurtma tafsiloti | [design/fragments/admin--orders-detail.html](fragments/admin--orders-detail.html) | sahifa | v2 |
| `/orders/edit/:orderId` | admin | `admin-orders-edit-order-dialog` — Buyurtmani tahrirlash oynasi<br>↳ `src/pages/new_orders/components/editDialogs/EditOrderDialog.tsx` | [design/fragments/admin--orders-edit-order-dialog.html](fragments/admin--orders-edit-order-dialog.html) | oyna | v2 |
| `/orders/edit/:orderId` | admin | `admin-orders-edit-customer-dialog` — Mijozni tahrirlash oynasi<br>↳ `src/pages/new_orders/components/editDialogs/EditCustomerDialog.tsx` | [design/fragments/admin--orders-edit-customer-dialog.html](fragments/admin--orders-edit-customer-dialog.html) | oyna | v2 |
| `/orders/edit/:orderId` | admin | `admin-orders-edit-address-dialog` — Manzilni tahrirlash oynasi<br>↳ `src/pages/new_orders/components/editDialogs/EditAddressDialog.tsx` | [design/fragments/admin--orders-edit-address-dialog.html](fragments/admin--orders-edit-address-dialog.html) | oyna | v2 |
| `/orders/edit/:orderId` | manager | `manager-orders-detail` — Buyurtma tafsiloti | [design/fragments/manager--orders-detail.html](fragments/manager--orders-detail.html) | sahifa | v2 |
| `/orders/edit/:orderId` | manager | `manager-orders-detail-cancelled` — Buyurtma tafsiloti — bekor, HQ'da, «Qaytarish yo'li» (taklif) | [design/fragments/manager--orders-detail-cancelled.html](fragments/manager--orders-detail-cancelled.html) | sahifa | yangi (kodda yo'q) |
| `/orders/edit/:orderId` | manager | `manager-orders-detail-edit-address-dialog` — Manzilni tahrirlash oynasi<br>↳ `src/pages/new_orders/components/editDialogs/EditAddressDialog.tsx` | [design/fragments/manager--orders-detail-edit-address-dialog.html](fragments/manager--orders-detail-edit-address-dialog.html) | oyna | v2 |
| `/orders/edit/:orderId` | manager | `manager-orders-detail-edit-products-dialog` — Buyurtmani tahrirlash oynasi<br>↳ `src/pages/new_orders/components/editDialogs/EditOrderDialog.tsx` | [design/fragments/manager--orders-detail-edit-products-dialog.html](fragments/manager--orders-detail-edit-products-dialog.html) | oyna | v2 |
| `/orders/edit/:orderId` | manager | `manager-orders-sell-dialog` — Sotish oynasi<br>↳ `src/pages/orders/list/courier/list/SellModal.tsx` | [design/fragments/manager--orders-sell-dialog.html](fragments/manager--orders-sell-dialog.html) | oyna | v2 |
| `/orders/edit/:orderId` | manager | `manager-orders-cancel-dialog` — Bekor qilish oynasi<br>↳ `src/pages/orders/list/courier/list/CancelModal.tsx` | [design/fragments/manager--orders-cancel-dialog.html](fragments/manager--orders-cancel-dialog.html) | oyna | v2 |
| `/orders/edit/:orderId` | manager | `manager-orders-rollback-dialog` — Buyurtmani qaytarish tasdig'i<br>↳ `src/pages/orders/list/courier/list/RollbackOrderDialog.tsx` | [design/fragments/manager--orders-rollback-dialog.html](fragments/manager--orders-rollback-dialog.html) | oyna | v2 |
| `/orders/edit/:orderId` | manager | `manager-orders-detail-contacts` — Buyurtma tafsiloti — «Muammo bo'lsa» qatori, market telefonisiz | [design/fragments/manager--orders-detail-contacts.html](fragments/manager--orders-detail-contacts.html) | sahifa | yangi (kodda yo'q) |
| `/orders/edit/:orderId` | registrator | `registrator-orders-detail` — Buyurtma tafsiloti | [design/fragments/registrator--orders-detail.html](fragments/registrator--orders-detail.html) | sahifa | v2 |
| `/orders/edit/:orderId` | registrator | `registrator-orders-detail-edit-order-dialog` — Buyurtmani tahrirlash oynasi<br>↳ `src/pages/new_orders/components/editDialogs/EditOrderDialog.tsx` | [design/fragments/registrator--orders-detail-edit-order-dialog.html](fragments/registrator--orders-detail-edit-order-dialog.html) | oyna | v2 |
| `/orders/edit/:orderId` | registrator | `registrator-orders-detail-edit-address-dialog` — Manzilni tahrirlash oynasi<br>↳ `src/pages/new_orders/components/editDialogs/EditAddressDialog.tsx` | [design/fragments/registrator--orders-detail-edit-address-dialog.html](fragments/registrator--orders-detail-edit-address-dialog.html) | oyna | v2 |
| `/orders/edit/:orderId` | market | `market-orders-detail` — Buyurtma tafsilotlari | [design/fragments/market--orders-detail.html](fragments/market--orders-detail.html) | sahifa | v2 |
| `/orders/edit/:orderId` | market | `market-orders-detail-cancelled` — Buyurtma tafsilotlari — bekor, «Qaytarish yo'li» (taklif) | [design/fragments/market--orders-detail-cancelled.html](fragments/market--orders-detail-cancelled.html) | sahifa | yangi (kodda yo'q) |
| `/orders/edit/:orderId` | market | `market-orders-detail-contacts` — Buyurtma tafsilotlari — «Elchi mas'ulingiz» qatori | [design/fragments/market--orders-detail-contacts.html](fragments/market--orders-detail-contacts.html) | sahifa | yangi (kodda yo'q) |
| `/orders/edit/:orderId` | market | `market-orders-detail-special-categories` — Buyurtma tafsilotlari — maxsus belgilar (o'zgartirib bo'lmaydi) | [design/fragments/market--orders-detail-special-categories.html](fragments/market--orders-detail-special-categories.html) | sahifa | yangi (kodda yo'q) |
| `/orders/edit/:orderId` | market_operator | — Maket yo'q — eng yaqini: market-orders-detail. Kodda (MO-3): market ko'rinishi (getOrderDetailAccess → layout market), faqat o'qish — tahrirlash, sotish / bekor, qaytarish va topshirish yo'q; «Buyurtma ma'lumotlari» da faqat market tarifi (backend proyeksiyasi market bilan bir xil). «Kuzatuv» va «Qaytarish yo'li» yo'q — GET orders/:id/tracking @Roles da MARKET_OPERATOR yo'q (403); bekor QR sahifasi — faqat market egasi. | — | — | v2 |
| `/orders/edit/:orderId` | courier | `courier-orders-detail` — Buyurtma tafsilotlari | [design/fragments/courier--orders-detail.html](fragments/courier--orders-detail.html) | sahifa | v2 |
| `/orders/edit/:orderId` | courier | `courier-orders-detail-contacts` — Buyurtma tafsilotlari — «Muammo bo'lsa» qatori, market telefonisiz | [design/fragments/courier--orders-detail-contacts.html](fragments/courier--orders-detail-contacts.html) | sahifa | yangi (kodda yo'q) |
| `/orders/edit/:orderId` | courier | `courier-orders-detail-special-categories` — Buyurtma tafsilotlari — maxsus belgilar (faqat ko'rish) | [design/fragments/courier--orders-detail-special-categories.html](fragments/courier--orders-detail-special-categories.html) | sahifa | yangi (kodda yo'q) |
| `/orders/edit/:orderId` | logist | `logist-orders-detail` — Buyurtma tafsiloti va kuzatuv — faqat ko'rish | [design/fragments/logist--orders-detail.html](fragments/logist--orders-detail.html) | sahifa | yangi (kodda yo'q) |
| `/orders/edit/:orderId` | tizim taxtasi | `tizim-contact-card` — Aloqa kartasi va «Muammo bo'lsa» — holatlar | [design/fragments/tizim--contact-card.html](fragments/tizim--contact-card.html) | taxta | qoida |
| `/orders/edit/:orderId` | tizim taxtasi | `tizim-category-labels` — Maxsus yorliq — kategoriya belgisi (100×60, A4, tartib) | [design/fragments/tizim--category-labels.html](fragments/tizim--category-labels.html) | taxta | qoida |

### Qabul va yaratish

#### `/new-orders` — Qabul va yaratish — tablar (layout) + Marketlar tabi

- **Fayllar:** `src/pages/new_orders/markets/index.tsx` · `src/pages/new_orders/index.tsx` · `src/pages/new_orders/ui/NewOrdersHeader.tsx` · `src/pages/new_orders/ui/NewOrdersTabs.tsx`
- **Qobiq:** DashboardLayout › NewOrdersRoleGate › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market, market_operator (MO-3: faqat /new-orders/create («AI bilan»); /new-orders → create, qolgan bolalar 403 (NewOrdersRoleGate). Qo'lda — POST /orders ruxsatidan keyin (MO-7))
- **Menyuda:** «Qabul va yaratish» (`newOrders`) — superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market; «Buyurtma yaratish» (`newOrders`) — market_operator
- **Holat:** v2
- **Izoh:** Qobiq (src/pages/new_orders/index.tsx, barcha /new-orders/* uchun) rejimi yo'lga qarab — model/newOrdersShell.ts: «Qabul va yaratish» sarlavhasi + «Buyurtma yaratish» havolasi (NewOrdersHeader.tsx); tablar (Marketlar · Kiruvchi posilkalar · Filial paketlari · Bekor qilinganlar, sonlari bilan; market — Yangi buyurtmalar · Bekor qilinganlar) bola sahifaning birinchi kartasida (NewOrdersTabs.tsx). Ega qarori (2026-10-19, S1; DamKku7C/xQ045luf, maket: manager-new-orders-markets, registrator-new-orders-markets): «Kiruvchi posilkalar» tabi posilka qabul qiladigan hamma xodimga — superadmin, admin, intake'li menejer (HQ · PICKUP · HYBRID; MANAGER_CAPABILITIES «intake») «Marketlar · Kiruvchi posilkalar», har qanday registrator «Marketlar · Kiruvchi posilkalar» (+ HQ registratorida «Bekor qilinganlar»). REGIONAL menejerda tab yo'q. Backend tayyor: GET orders/external, orders/external/sources va POST orders/external/receive-by-scan da MANAGER va REGISTRATOR bor. Kodda: resolveNewOrdersTabKeys → canReceiveIncoming (canReceiveExternalOrders, route guard bilan bir xil); tab soni silentError bilan (IP-1).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders` | superadmin | `superadmin-neworders-markets` — Qabul va yaratish — Marketlar | [design/fragments/superadmin--neworders-markets.html](fragments/superadmin--neworders-markets.html) | sahifa | v2 |
| `/new-orders` | admin | `admin-neworders-markets` — Qabul — Marketlar tabi | [design/fragments/admin--neworders-markets.html](fragments/admin--neworders-markets.html) | sahifa | v2 |
| `/new-orders` | manager | `manager-new-orders-markets` — Qabul va yaratish — Marketlar | [design/fragments/manager--new-orders-markets.html](fragments/manager--new-orders-markets.html) | sahifa | v2 |
| `/new-orders` | manager | `manager-new-orders-markets-no-phone` — Qabul va yaratish — Marketlar (telefon ustunisiz) | [design/fragments/manager--new-orders-markets-no-phone.html](fragments/manager--new-orders-markets-no-phone.html) | sahifa | yangi (kodda yo'q) |
| `/new-orders` | registrator | `registrator-new-orders-markets` — Qabul va yaratish — Marketlar | [design/fragments/registrator--new-orders-markets.html](fragments/registrator--new-orders-markets.html) | sahifa | v2 |
| `/new-orders` | market | — Market /new-orders/:marketId (o'z marketi) ga yo'naltiriladi — o'sha route'ga qarang. | — | — | v2 |
| `/new-orders` | market_operator | — MO-3: menyu bandi «Buyurtma yaratish» — /new-orders → /new-orders/create (NewOrdersRoleGate, newOrdersShell.ts → resolveMarketOperatorNewOrdersAccess); qobiqning boshqa bolalari (market ro'yxati, bekorlar, qabul, paketlar, foydalanuvchi tafsiloti) — 403. | — | — | v2 |

#### `/new-orders/create` — Buyurtma yaratish — qo'lda (market → mijoz va mahsulot) yoki AI bilan

- **Fayllar:** `src/pages/orders/create/index.tsx` · `src/pages/orders/create/ui/CreateModeTabs.tsx` · `src/pages/orders/create/ui/OrderStepper.tsx` · `src/pages/orders/create/ui/Step1Market.tsx` · `src/pages/orders/create/ui/MarketPicker.tsx` · `src/pages/orders/create/ui/Step2Combined.tsx` · `src/pages/orders/create/ui/Step2Summary.tsx` · `src/pages/orders/create/ui/TodayOrdersCard.tsx` · `src/pages/orders/create/ui/CreateAlert.tsx` · `src/pages/orders/create/ui/ai/AiCreatePanel.tsx` · `src/pages/orders/create/ui/ai/AiInputPanel.tsx` · `src/pages/orders/create/ui/ai/AiPreviewCard.tsx` · `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` · `src/pages/orders/create/ui/ai/AiCreatedList.tsx` · `src/pages/orders/create/model/orderCreateForm.ts` · `src/pages/orders/create/ui/CustomerPhoneSuggest.tsx` · `src/pages/orders/create/ui/ExistingCustomerNotice.tsx` · `src/pages/orders/create/ui/OrderSourceCard.tsx` · `src/pages/orders/create/model/useOrderSource.ts`
- **Qobiq:** DashboardLayout › NewOrdersRoleGate › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market, market_operator (MO-3: faqat /new-orders/create («AI bilan»); /new-orders → create, qolgan bolalar 403 (NewOrdersRoleGate). Qo'lda — POST /orders ruxsatidan keyin (MO-7))
- **Menyuda:** yo'q — «Buyurtma yaratish» tugmasi (/new-orders sarlavhasi, market bosh sahifasi, market yangi buyurtmalari)
- **Holat:** v2
- **Izoh:** Market rolida 1-qadam (market tanlash) yo'q — forma darhol 2-qadamdan ochiladi. Market tanlash oynasi — MarketPicker.tsx (Step1Market.tsx ochadi); 2-qadam o'ng ustuni — Step2Summary.tsx + TodayOrdersCard.tsx; AI tasdiqlash oynasi — AiConfirmBar.tsx. «Oldingi» / «O'zgartirish» 1-qadamga qaytaradi (market va forma saqlanadi). Ega tasdig'i 2026-10-19 (create-step2): 2-qadamda mijoz takliflari (*-customer-suggest; qo'shimcha raqam bo'yicha ham — S4, backend karta), mavjud mijoz tanlangach tarif, taxminiy yetkazish narxi va mahsulot rasmi (*-existing-customer). Narx (S1): market yaratilganda standart uy va markaz narxi; sukut — vazn yoki hajm bo'yicha avtomatik (katta bo'lsa oshadi), market sozlamasida «Vazn va hajm bo'yicha narx» toggle (sukut yoqiq) o'chirilsa — faqat standart narx; backend narx dvigateli (DAqXPeSy) va market maydoni kerak. Xulosada bitta «Yetkazish narxi» qatori, vazn/hajm hisobi yoqilgan bo'lsa ostida izoh (S2). Mijozni yaratuvchi har rol tanlay oladi, lekin market mijozning faqat o'z marketidagi buyurtmalari tarixini ko'radi (S3 — taklifdagi soni ham shu bo'yicha). Mavjud mijoz ma'lumoti o'zgartirilsa — «Mijoz kartasi ham yangilansinmi?» (Ha / Faqat shu buyurtmada, *-customer-update-dialog, S5). «Taklif · backend kerak» belgisi kodga ko'chirilmaydi. 6kHnNH9j (maket superadmin-neworders-create-manual-source): 2-qadamda «Qayerdan yuboriladi» kartasi — superadmin, admin, registrator, market (faqat can_order_from_warehouse); menejer va market operatorida yo'q. POST /warehouses/resolve-source (400 ms kechikish) → ombor «Avtomatik tanlandi» / «Toshkent HQ» tanlovi (fulfillment: auto | hq — POST /orders tanasida), «Omborda: N» tanlangan mahsulot ostida, «Chala qoldiq» ogohlantirishi, «Tuman ombori to'xtatilgan» (o'chiq karta), xulosada «Qayerdan». Maketda yo'q holatlar: tuman/mahsulot tanlanmagan — izoh; hududda ombor yo'q yoki aniqlanmadi — faqat HQ kartasi sababi bilan; so'rov yiqildi — «Qayta urinish». AI tasdiqlash yo'lida manba tanlovi yo'q (backend sukuti auto).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/create` | superadmin | `superadmin-neworders-create-manual-step1` — Buyurtma yaratish — 1-qadam: Market<br>↳ `src/pages/orders/create/ui/Step1Market.tsx` | [design/fragments/superadmin--neworders-create-manual-step1.html](fragments/superadmin--neworders-create-manual-step1.html) | sahifa | v2 |
| `/new-orders/create` | superadmin | `superadmin-neworders-create-market-picker-dialog` — Market tanlash (modal)<br>↳ `src/pages/orders/create/ui/MarketPicker.tsx` | [design/fragments/superadmin--neworders-create-market-picker-dialog.html](fragments/superadmin--neworders-create-market-picker-dialog.html) | oyna | v2 |
| `/new-orders/create` | superadmin | `superadmin-neworders-create-manual-step2` — Buyurtma yaratish — 2-qadam: Mijoz va mahsulot<br>↳ `src/pages/orders/create/ui/Step2Combined.tsx` | [design/fragments/superadmin--neworders-create-manual-step2.html](fragments/superadmin--neworders-create-manual-step2.html) | sahifa | v2 |
| `/new-orders/create` | superadmin | `superadmin-neworders-create-ai-input` — Buyurtma yaratish — AI bilan (kiritish)<br>↳ `src/pages/orders/create/ui/ai/AiInputPanel.tsx` | [design/fragments/superadmin--neworders-create-ai-input.html](fragments/superadmin--neworders-create-ai-input.html) | sahifa | v2 |
| `/new-orders/create` | superadmin | `superadmin-neworders-create-ai-preview` — Buyurtma yaratish — AI natijalari (preview)<br>↳ `src/pages/orders/create/ui/ai/AiPreviewCard.tsx` | [design/fragments/superadmin--neworders-create-ai-preview.html](fragments/superadmin--neworders-create-ai-preview.html) | sahifa | v2 |
| `/new-orders/create` | superadmin | `superadmin-neworders-create-ai-confirm-dialog` — AI — yaratishni tasdiqlash<br>↳ `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | [design/fragments/superadmin--neworders-create-ai-confirm-dialog.html](fragments/superadmin--neworders-create-ai-confirm-dialog.html) | oyna | v2 |
| `/new-orders/create` | superadmin | `superadmin-neworders-create-manual-step2-customer-suggest` — Buyurtma yaratish — 2-qadam: mijoz takliflari (taklif)<br>↳ `src/pages/orders/create/ui/CustomerPhoneSuggest.tsx` | [design/fragments/superadmin--neworders-create-manual-step2-customer-suggest.html](fragments/superadmin--neworders-create-manual-step2-customer-suggest.html) | sahifa | qisman |
| `/new-orders/create` | superadmin | `superadmin-neworders-create-manual-step2-existing-customer` — Buyurtma yaratish — 2-qadam: mavjud mijoz, tarif, rasm (taklif)<br>↳ `src/pages/orders/create/ui/ExistingCustomerNotice.tsx` | [design/fragments/superadmin--neworders-create-manual-step2-existing-customer.html](fragments/superadmin--neworders-create-manual-step2-existing-customer.html) | sahifa | qisman |
| `/new-orders/create` | superadmin | `superadmin-neworders-create-manual-step2-customer-update-dialog` — Buyurtma yaratish — 2-qadam: mijoz kartasini yangilash (taklif) | [design/fragments/superadmin--neworders-create-manual-step2-customer-update-dialog.html](fragments/superadmin--neworders-create-manual-step2-customer-update-dialog.html) | oyna | yangi (kodda yo'q) |
| `/new-orders/create` | superadmin | `superadmin-neworders-create-ai-input-images` — Buyurtma yaratish — AI: 20 tagacha rasm, avtomatik siqish | [design/fragments/superadmin--neworders-create-ai-input-images.html](fragments/superadmin--neworders-create-ai-input-images.html) | sahifa | yangi (kodda yo'q) |
| `/new-orders/create` | superadmin | `superadmin-neworders-create-manual-source` — Buyurtma yaratish — manba: viloyat ombori yoki HQ | [design/fragments/superadmin--neworders-create-manual-source.html](fragments/superadmin--neworders-create-manual-source.html) | sahifa | v2 |
| `/new-orders/create` | superadmin | `superadmin-neworders-create-manual-step2-special-categories` — Buyurtma yaratish — 2-qadam: maxsus belgilar (Izoh tepasida) | [design/fragments/superadmin--neworders-create-manual-step2-special-categories.html](fragments/superadmin--neworders-create-manual-step2-special-categories.html) | sahifa | yangi (kodda yo'q) |
| `/new-orders/create` | superadmin | `superadmin-neworders-create-ai-preview-special-categories` — Buyurtma yaratish — AI natijalari: har kartada maxsus belgilar | [design/fragments/superadmin--neworders-create-ai-preview-special-categories.html](fragments/superadmin--neworders-create-ai-preview-special-categories.html) | sahifa | yangi (kodda yo'q) |
| `/new-orders/create` | admin | `admin-neworders-create-manual` — Buyurtma yaratish — Qo'lda | [design/fragments/admin--neworders-create-manual.html](fragments/admin--neworders-create-manual.html) | sahifa | v2 |
| `/new-orders/create` | admin | `admin-neworders-create-market-picker` — Market tanlash oynasi<br>↳ `src/pages/orders/create/ui/MarketPicker.tsx` | [design/fragments/admin--neworders-create-market-picker.html](fragments/admin--neworders-create-market-picker.html) | oyna | v2 |
| `/new-orders/create` | admin | `admin-neworders-create-ai` — Buyurtma yaratish — AI bilan | [design/fragments/admin--neworders-create-ai.html](fragments/admin--neworders-create-ai.html) | sahifa | v2 |
| `/new-orders/create` | admin | `admin-neworders-create-ai-confirm-dialog` — AI yaratishni tasdiqlash<br>↳ `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | [design/fragments/admin--neworders-create-ai-confirm-dialog.html](fragments/admin--neworders-create-ai-confirm-dialog.html) | oyna | v2 |
| `/new-orders/create` | admin | `admin-neworders-create-manual-step2-customer-suggest` — Buyurtma yaratish — 2-qadam: mijoz takliflari (taklif)<br>↳ `src/pages/orders/create/ui/CustomerPhoneSuggest.tsx` | [design/fragments/superadmin--neworders-create-manual-step2-customer-suggest.html](fragments/superadmin--neworders-create-manual-step2-customer-suggest.html) | sahifa | qisman |
| `/new-orders/create` | admin | `admin-neworders-create-manual-step2-existing-customer` — Buyurtma yaratish — 2-qadam: mavjud mijoz, tarif, rasm (taklif)<br>↳ `src/pages/orders/create/ui/ExistingCustomerNotice.tsx` | [design/fragments/superadmin--neworders-create-manual-step2-existing-customer.html](fragments/superadmin--neworders-create-manual-step2-existing-customer.html) | sahifa | qisman |
| `/new-orders/create` | admin | `admin-neworders-create-manual-step2-customer-update-dialog` — Buyurtma yaratish — 2-qadam: mijoz kartasini yangilash (taklif) | [design/fragments/superadmin--neworders-create-manual-step2-customer-update-dialog.html](fragments/superadmin--neworders-create-manual-step2-customer-update-dialog.html) | oyna | yangi (kodda yo'q) |
| `/new-orders/create` | manager | `manager-new-orders-create-manual-step1` — Buyurtma yaratish — market tanlash<br>↳ `src/pages/orders/create/ui/Step1Market.tsx` | [design/fragments/manager--new-orders-create-manual-step1.html](fragments/manager--new-orders-create-manual-step1.html) | sahifa | v2 |
| `/new-orders/create` | manager | `manager-new-orders-create-manual-step2` — Buyurtma yaratish — ma'lumotlar<br>↳ `src/pages/orders/create/ui/Step2Combined.tsx` | [design/fragments/manager--new-orders-create-manual-step2.html](fragments/manager--new-orders-create-manual-step2.html) | sahifa | v2 |
| `/new-orders/create` | manager | `manager-new-orders-create-ai` — Buyurtma yaratish — AI bilan | [design/fragments/manager--new-orders-create-ai.html](fragments/manager--new-orders-create-ai.html) | sahifa | v2 |
| `/new-orders/create` | manager | `manager-new-orders-create-ai-confirm-dialog` — AI buyurtmalarni tasdiqlash<br>↳ `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | [design/fragments/manager--new-orders-create-ai-confirm-dialog.html](fragments/manager--new-orders-create-ai-confirm-dialog.html) | oyna | v2 |
| `/new-orders/create` | manager | `manager-new-orders-create-manual-step2-customer-suggest` — Buyurtma yaratish — mijoz takliflari (taklif)<br>↳ `src/pages/orders/create/ui/CustomerPhoneSuggest.tsx` | [design/fragments/manager--new-orders-create-manual-step2-customer-suggest.html](fragments/manager--new-orders-create-manual-step2-customer-suggest.html) | sahifa | qisman |
| `/new-orders/create` | manager | `manager-new-orders-create-manual-step2-existing-customer` — Buyurtma yaratish — mavjud mijoz, tarif, rasm (taklif)<br>↳ `src/pages/orders/create/ui/ExistingCustomerNotice.tsx` | [design/fragments/manager--new-orders-create-manual-step2-existing-customer.html](fragments/manager--new-orders-create-manual-step2-existing-customer.html) | sahifa | qisman |
| `/new-orders/create` | manager | `manager-new-orders-create-manual-step2-customer-update-dialog` — Buyurtma yaratish — 2-qadam: mijoz kartasini yangilash (taklif) | [design/fragments/manager--new-orders-create-manual-step2-customer-update-dialog.html](fragments/manager--new-orders-create-manual-step2-customer-update-dialog.html) | oyna | yangi (kodda yo'q) |
| `/new-orders/create` | registrator | `registrator-new-orders-create-step1` — Buyurtma yaratish — market tanlash<br>↳ `src/pages/orders/create/ui/Step1Market.tsx` | [design/fragments/manager--new-orders-create-manual-step1.html](fragments/manager--new-orders-create-manual-step1.html) | sahifa | v2 |
| `/new-orders/create` | registrator | `registrator-new-orders-create-market-picker-dialog` — Buyurtma yaratish — market tanlash oynasi<br>↳ `src/pages/orders/create/ui/MarketPicker.tsx` | [design/fragments/registrator--new-orders-create-market-picker-dialog.html](fragments/registrator--new-orders-create-market-picker-dialog.html) | oyna | v2 |
| `/new-orders/create` | registrator | `registrator-new-orders-create-step2` — Buyurtma yaratish — qo'lda forma<br>↳ `src/pages/orders/create/ui/Step2Combined.tsx` | [design/fragments/registrator--new-orders-create-step2.html](fragments/registrator--new-orders-create-step2.html) | sahifa | v2 |
| `/new-orders/create` | registrator | `registrator-new-orders-create-ai` — Buyurtma yaratish — AI rejimi | [design/fragments/registrator--new-orders-create-ai.html](fragments/registrator--new-orders-create-ai.html) | sahifa | v2 |
| `/new-orders/create` | registrator | `registrator-new-orders-create-ai-confirm-dialog` — AI buyurtmalarni tasdiqlash<br>↳ `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | [design/fragments/manager--new-orders-create-ai-confirm-dialog.html](fragments/manager--new-orders-create-ai-confirm-dialog.html) | oyna | v2 |
| `/new-orders/create` | registrator | `registrator-new-orders-create-step2-customer-suggest` — Buyurtma yaratish — mijoz takliflari (taklif)<br>↳ `src/pages/orders/create/ui/CustomerPhoneSuggest.tsx` | [design/fragments/manager--new-orders-create-manual-step2-customer-suggest.html](fragments/manager--new-orders-create-manual-step2-customer-suggest.html) | sahifa | qisman |
| `/new-orders/create` | registrator | `registrator-new-orders-create-step2-existing-customer` — Buyurtma yaratish — mavjud mijoz, tarif, rasm (taklif)<br>↳ `src/pages/orders/create/ui/ExistingCustomerNotice.tsx` | [design/fragments/manager--new-orders-create-manual-step2-existing-customer.html](fragments/manager--new-orders-create-manual-step2-existing-customer.html) | sahifa | qisman |
| `/new-orders/create` | registrator | `registrator-new-orders-create-step2-customer-update-dialog` — Buyurtma yaratish — mijoz kartasini yangilash (taklif) | [design/fragments/manager--new-orders-create-manual-step2-customer-update-dialog.html](fragments/manager--new-orders-create-manual-step2-customer-update-dialog.html) | oyna | yangi (kodda yo'q) |
| `/new-orders/create` | market | `market-new-orders-create-manual` — Buyurtma yaratish · Qo'lda<br>↳ `src/pages/orders/create/ui/Step2Combined.tsx` | [design/fragments/market--new-orders-create-manual.html](fragments/market--new-orders-create-manual.html) | sahifa | v2 |
| `/new-orders/create` | market | `market-new-orders-create-ai-input` — Buyurtma yaratish · AI kiritish<br>↳ `src/pages/orders/create/ui/ai/AiInputPanel.tsx` | [design/fragments/market--new-orders-create-ai-input.html](fragments/market--new-orders-create-ai-input.html) | sahifa | v2 |
| `/new-orders/create` | market | `market-new-orders-create-ai-preview` — Buyurtma yaratish · AI natijalari<br>↳ `src/pages/orders/create/ui/ai/AiPreviewCard.tsx` | [design/fragments/market--new-orders-create-ai-preview.html](fragments/market--new-orders-create-ai-preview.html) | sahifa | v2 |
| `/new-orders/create` | market | `market-new-orders-create-ai-confirm-dialog` — AI · Yaratishni tasdiqlash<br>↳ `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | [design/fragments/market--new-orders-create-ai-confirm-dialog.html](fragments/market--new-orders-create-ai-confirm-dialog.html) | oyna | v2 |
| `/new-orders/create` | market | `market-new-orders-create-manual-customer-suggest` — Buyurtma yaratish · mijoz takliflari (taklif)<br>↳ `src/pages/orders/create/ui/CustomerPhoneSuggest.tsx` | [design/fragments/market--new-orders-create-manual-customer-suggest.html](fragments/market--new-orders-create-manual-customer-suggest.html) | sahifa | qisman |
| `/new-orders/create` | market | `market-new-orders-create-manual-existing-customer` — Buyurtma yaratish · mavjud mijoz, tarif, rasm (taklif)<br>↳ `src/pages/orders/create/ui/ExistingCustomerNotice.tsx` | [design/fragments/market--new-orders-create-manual-existing-customer.html](fragments/market--new-orders-create-manual-existing-customer.html) | sahifa | qisman |
| `/new-orders/create` | market | `market-new-orders-create-manual-customer-update-dialog` — Buyurtma yaratish · mijoz kartasini yangilash (taklif) | [design/fragments/market--new-orders-create-manual-customer-update-dialog.html](fragments/market--new-orders-create-manual-customer-update-dialog.html) | oyna | yangi (kodda yo'q) |
| `/new-orders/create` | market_operator | `market_operator-new-orders-create-manual` — Buyurtma yaratish · Qo'lda | [design/fragments/market_operator--new-orders-create-manual.html](fragments/market_operator--new-orders-create-manual.html) | sahifa | qisman |

#### `/new-orders/incoming` — Kiruvchi posilkalar — manba tanlash

- **Fayllar:** `src/pages/incoming-orders/SourcePicker.tsx` · `src/pages/incoming-orders/lib.ts` · `src/pages/incoming-orders/ui/SourcesSummary.tsx` · `src/pages/incoming-orders/ui/SourcesTable.tsx` · `src/pages/incoming-orders/ui/sourceVisuals.tsx` · `src/pages/incoming-orders/ui/sourceFormat.ts` · `src/pages/incoming-orders/ui/IdleSources.tsx`
- **Qobiq:** DashboardLayout › NewOrdersRoleGate › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) → `canManageExternalIntegrations` (access.ts → canReceiveExternalOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Menejer va registrator maketlarida «Ulangan manbalar — hozircha posilka yo'q» kartasi yo'q: uning manbasi GET /integrations va GET admin/partners — backendda @Roles(SUPERADMIN, ADMIN); menejer va registratorda ikkalasi so'ralmaydi (useConnections enabled: false — 403 global xabar yo'q, IdleSources chizilmaydi).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/incoming` | superadmin | `superadmin-neworders-incoming-sources` — Kiruvchi posilkalar — manba tanlash | [design/fragments/superadmin--neworders-incoming-sources.html](fragments/superadmin--neworders-incoming-sources.html) | sahifa | v2 |
| `/new-orders/incoming` | admin | `admin-neworders-incoming-sources` — Kiruvchi posilkalar — manba tanlash | [design/fragments/admin--neworders-incoming-sources.html](fragments/admin--neworders-incoming-sources.html) | sahifa | v2 |
| `/new-orders/incoming` | manager | `manager-new-orders-incoming-sources` — Kiruvchi posilkalar — manba tanlash | [design/fragments/manager--new-orders-incoming-sources.html](fragments/manager--new-orders-incoming-sources.html) | sahifa | v2 |
| `/new-orders/incoming` | registrator | `registrator-new-orders-incoming-sources` — Kiruvchi posilkalar — manba tanlash | [design/fragments/registrator--new-orders-incoming-sources.html](fragments/registrator--new-orders-incoming-sources.html) | sahifa | v2 |

#### `/new-orders/incoming/:marketId` — Kiruvchi posilkalarni skanerlab qabul qilish (tanlangan manba)

- **Fayllar:** `src/pages/incoming-orders/index.tsx` · `src/pages/incoming-orders/lib.ts` · `src/pages/incoming-orders/ui/ScanInput.tsx` · `src/pages/incoming-orders/ui/ScanMessage.tsx` · `src/pages/incoming-orders/ui/IncomingTable.tsx`
- **Qobiq:** DashboardLayout › NewOrdersRoleGate › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) → `canManageExternalIntegrations` (access.ts → canReceiveExternalOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Ega qarori 2026-10-19 (skaner, Trello v1eLN2tV): pastki menyuning markaziy «Skaner» tugmasi (planshet/desktop — yuqori paneldagi «Skanerlash») kontekstli — sahifa skan maqsadini ro'yxatdan o'tkazgan bo'lsa kamera shu sahifa ustida, USB bilan bir xil handler'da ochiladi (ScannerHost); oqim ichidagi «Kamera bilan skanerlash» tugmasi QILINMAYDI (v1 «Kamera» tugmalari va eski kamera oynasi 2-bosqichda olib tashlangan). Chala qop va skanni olib tashlash (DamKku7C, eo3eeJxs): «Qop» ustuni (external_batch_ref, bo'lmasa external_batch_token ning 8 belgisi + «…»; «kelgan/aytilgan» — external_batch_size bilan), skanerlangan qatorda va oxirgi skan xabarida «Olib tashlash» + «Qaytarish» xabari, chala qop ogohlantirishi va qabul tasdig'i. «N tasi keldi» — qopning shu ro'yxatdagi va ilgari qabul qilingan a'zolari birga, faqat ro'yxatdagi NEW buyurtmalar emas; manba — backend GET orders/external javobidagi meta.batches: received_count + pending_count (ega S3, 2026-10-19; backend Sm3LZ6EN), frontend o'zi sanamaydi; hajmni hamkor aytmagan qopda ogohlantirish yo'q. Ega qarorlari (2026-10-19): S2 — chala qop bilan qabulda tasdiq yetarli, yetishmagan posilka kutilayotgan bo'lib qoladi (hamkorga avtomatik xabar yo'q); S4 — «Olib tashlandi» xabaridagi «Qaytarish» 5 soniya (tizim-scanner 05.2); S5 — chala qop QR'i skanerlanganda oxirgi skan xabari darhol sariq («Qop BP-24817: 2/3 keldi», maket: *-incoming-scan-partial) + ogohlantirish ovozi (Sozlamalar → Skaner dagi xato ovozi) va telefonda tebranish 60·45·80 ms; to'liq qop QR'i — odatdagi yashil xabar va muvaffaqiyat ovozi.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/incoming/:marketId` | superadmin | `superadmin-neworders-incoming-scan` — Kiruvchi posilkalar — skanerlab qabul | [design/fragments/superadmin--neworders-incoming-scan.html](fragments/superadmin--neworders-incoming-scan.html) | sahifa | qisman |
| `/new-orders/incoming/:marketId` | superadmin | `superadmin-neworders-incoming-scan-camera` — Kiruvchi posilkalar — skanerlab qabul — kamera | [design/fragments/superadmin--neworders-incoming-scan-camera.html](fragments/superadmin--neworders-incoming-scan-camera.html) | oyna | qisman |
| `/new-orders/incoming/:marketId` | superadmin | `superadmin-neworders-incoming-scan-partial` — Kiruvchi posilkalar — chala qop ogohlantirishi | [design/fragments/superadmin--neworders-incoming-scan-partial.html](fragments/superadmin--neworders-incoming-scan-partial.html) | sahifa | v2 |
| `/new-orders/incoming/:marketId` | superadmin | `superadmin-neworders-incoming-scan-partial-confirm-dialog` — Kiruvchi posilkalar — chala qop bilan qabul tasdig'i | [design/fragments/superadmin--neworders-incoming-scan-partial-confirm-dialog.html](fragments/superadmin--neworders-incoming-scan-partial-confirm-dialog.html) | oyna | v2 |
| `/new-orders/incoming/:marketId` | superadmin | `superadmin-neworders-incoming-scan-undo` — Kiruvchi posilkalar — skan olib tashlandi | [design/fragments/superadmin--neworders-incoming-scan-undo.html](fragments/superadmin--neworders-incoming-scan-undo.html) | sahifa | qisman |
| `/new-orders/incoming/:marketId` | admin | `admin-neworders-incoming-scan` — Kiruvchi posilkalarni skanerlash | [design/fragments/admin--neworders-incoming-scan.html](fragments/admin--neworders-incoming-scan.html) | sahifa | qisman |
| `/new-orders/incoming/:marketId` | admin | `admin-neworders-incoming-scan-camera` — Kiruvchi posilkalarni skanerlash — kamera | [design/fragments/superadmin--neworders-incoming-scan-camera.html](fragments/superadmin--neworders-incoming-scan-camera.html) | oyna | qisman |
| `/new-orders/incoming/:marketId` | admin | `admin-neworders-incoming-scan-partial` — Kiruvchi posilkalar — chala qop ogohlantirishi | [design/fragments/superadmin--neworders-incoming-scan-partial.html](fragments/superadmin--neworders-incoming-scan-partial.html) | sahifa | v2 |
| `/new-orders/incoming/:marketId` | admin | `admin-neworders-incoming-scan-partial-confirm-dialog` — Kiruvchi posilkalar — chala qop bilan qabul tasdig'i | [design/fragments/superadmin--neworders-incoming-scan-partial-confirm-dialog.html](fragments/superadmin--neworders-incoming-scan-partial-confirm-dialog.html) | oyna | v2 |
| `/new-orders/incoming/:marketId` | admin | `admin-neworders-incoming-scan-undo` — Kiruvchi posilkalar — skan olib tashlandi | [design/fragments/superadmin--neworders-incoming-scan-undo.html](fragments/superadmin--neworders-incoming-scan-undo.html) | sahifa | qisman |
| `/new-orders/incoming/:marketId` | manager | `manager-new-orders-incoming-scan` — Kiruvchi posilkalar — skanerlash | [design/fragments/manager--new-orders-incoming-scan.html](fragments/manager--new-orders-incoming-scan.html) | sahifa | qisman |
| `/new-orders/incoming/:marketId` | manager | `manager-new-orders-incoming-scan-camera` — Kiruvchi posilkalar — skanerlash — kamera | [design/fragments/manager--new-orders-incoming-scan-camera.html](fragments/manager--new-orders-incoming-scan-camera.html) | oyna | qisman |
| `/new-orders/incoming/:marketId` | manager | `manager-new-orders-incoming-scan-partial` — Kiruvchi posilkalar — chala qop ogohlantirishi | [design/fragments/manager--new-orders-incoming-scan-partial.html](fragments/manager--new-orders-incoming-scan-partial.html) | sahifa | v2 |
| `/new-orders/incoming/:marketId` | manager | `manager-new-orders-incoming-scan-partial-confirm-dialog` — Kiruvchi posilkalar — chala qop bilan qabul tasdig'i | [design/fragments/manager--new-orders-incoming-scan-partial-confirm-dialog.html](fragments/manager--new-orders-incoming-scan-partial-confirm-dialog.html) | oyna | v2 |
| `/new-orders/incoming/:marketId` | manager | `manager-new-orders-incoming-scan-undo` — Kiruvchi posilkalar — skan olib tashlandi | [design/fragments/manager--new-orders-incoming-scan-undo.html](fragments/manager--new-orders-incoming-scan-undo.html) | sahifa | qisman |
| `/new-orders/incoming/:marketId` | registrator | `registrator-new-orders-incoming-scan` — Kiruvchi posilkalar — skanerlash | [design/fragments/registrator--new-orders-incoming-scan.html](fragments/registrator--new-orders-incoming-scan.html) | sahifa | qisman |
| `/new-orders/incoming/:marketId` | registrator | `registrator-new-orders-incoming-scan-camera` — Kiruvchi posilkalar — skanerlash — kamera | [design/fragments/manager--new-orders-incoming-scan-camera.html](fragments/manager--new-orders-incoming-scan-camera.html) | oyna | qisman |
| `/new-orders/incoming/:marketId` | registrator | `registrator-new-orders-incoming-scan-partial` — Kiruvchi posilkalar — chala qop ogohlantirishi | [design/fragments/manager--new-orders-incoming-scan-partial.html](fragments/manager--new-orders-incoming-scan-partial.html) | sahifa | v2 |
| `/new-orders/incoming/:marketId` | registrator | `registrator-new-orders-incoming-scan-partial-confirm-dialog` — Kiruvchi posilkalar — chala qop bilan qabul tasdig'i | [design/fragments/manager--new-orders-incoming-scan-partial-confirm-dialog.html](fragments/manager--new-orders-incoming-scan-partial-confirm-dialog.html) | oyna | v2 |
| `/new-orders/incoming/:marketId` | registrator | `registrator-new-orders-incoming-scan-undo` — Kiruvchi posilkalar — skan olib tashlandi | [design/fragments/manager--new-orders-incoming-scan-undo.html](fragments/manager--new-orders-incoming-scan-undo.html) | sahifa | qisman |
| `/new-orders/incoming/:marketId` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

#### `/new-orders/branches` — Filial paketlari — filiallar

- **Fayllar:** `src/pages/new_orders/branches/index.tsx` · `src/pages/new_orders/ui/SourceListCard.tsx` · `src/pages/new_orders/branches/branchBatchesModel.ts`
- **Qobiq:** DashboardLayout › NewOrdersRoleGate › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) → `canViewAdminNewOrderTabs` (routes.tsx → canViewAdminNewOrderTabs)
- **Rollar:** superadmin, admin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/branches` | superadmin | `superadmin-neworders-branches` — Filial batchlari — filiallar | [design/fragments/superadmin--neworders-branches.html](fragments/superadmin--neworders-branches.html) | sahifa | v2 |
| `/new-orders/branches` | admin | `admin-neworders-branches` — Filial batchlari tabi | [design/fragments/admin--neworders-branches.html](fragments/admin--neworders-branches.html) | sahifa | v2 |

#### `/new-orders/branches/:branchId` — Filial paketlari ro'yxati

- **Fayllar:** `src/pages/new_orders/branches/batches.tsx` · `src/shared/ui/SelectionRegion.tsx` · `src/pages/new_orders/branches/branchBatchesModel.ts`
- **Qobiq:** DashboardLayout › NewOrdersRoleGate › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) → `canViewAdminNewOrderTabs` (routes.tsx → canViewAdminNewOrderTabs)
- **Rollar:** superadmin, admin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/branches/:branchId` | superadmin | `superadmin-neworders-branch-batches` — Filial batchlari ro'yxati | [design/fragments/superadmin--neworders-branch-batches.html](fragments/superadmin--neworders-branch-batches.html) | sahifa | v2 |
| `/new-orders/branches/:branchId` | admin | `admin-neworders-branch-batches` — Filial batchlari ro'yxati | [design/fragments/superadmin--neworders-branch-batches.html](fragments/superadmin--neworders-branch-batches.html) | sahifa | v2 |

#### `/new-orders/branches/:branchId/batches/:batchId` — Filial paketi tafsiloti (qabul)

- **Fayllar:** `src/pages/new_orders/branches/batchDetail.tsx` · `src/shared/ui/SelectionRegion.tsx` · `src/pages/new_orders/branches/branchBatchesModel.ts`
- **Qobiq:** DashboardLayout › NewOrdersRoleGate › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) → `canViewAdminNewOrderTabs` (routes.tsx → canViewAdminNewOrderTabs)
- **Rollar:** superadmin, admin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Ega qarori 2026-10-19 (skaner, Trello v1eLN2tV): pastki menyuning markaziy «Skaner» tugmasi (planshet/desktop — yuqori paneldagi «Skanerlash») kontekstli — sahifa skan maqsadini ro'yxatdan o'tkazgan bo'lsa kamera shu sahifa ustida, USB bilan bir xil handler'da ochiladi (ScannerHost); oqim ichidagi «Kamera bilan skanerlash» tugmasi QILINMAYDI (v1 «Kamera» tugmalari va eski kamera oynasi 2-bosqichda olib tashlangan). «Qabul qilish» uzun ro'yxatda doim ko'rinadi (ndKkHjhe): ≥ 768 sarlavha yopishqoq, telefonda tugma pastki menyu ustidagi panelda (/dispatch naqshi, Q7); maketdagi «Kamera bilan skanerlash» paneli yo'q (ega qarori 2026-10-19).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/branches/:branchId/batches/:batchId` | superadmin | `superadmin-neworders-branch-batch-detail` — Filial paketi tafsiloti | [design/fragments/superadmin--neworders-branch-batch-detail.html](fragments/superadmin--neworders-branch-batch-detail.html) | sahifa | v2 |
| `/new-orders/branches/:branchId/batches/:batchId` | superadmin | `superadmin-neworders-branch-batch-detail-camera` — Filial paketi tafsiloti — kamera | [design/fragments/superadmin--neworders-branch-batch-detail-camera.html](fragments/superadmin--neworders-branch-batch-detail-camera.html) | oyna | qisman |
| `/new-orders/branches/:branchId/batches/:batchId` | admin | `admin-neworders-branch-batch-detail` — Filial paketi tafsiloti | [design/fragments/superadmin--neworders-branch-batch-detail.html](fragments/superadmin--neworders-branch-batch-detail.html) | sahifa | v2 |
| `/new-orders/branches/:branchId/batches/:batchId` | admin | `admin-neworders-branch-batch-detail-camera` — Filial paketi tafsiloti — kamera | [design/fragments/superadmin--neworders-branch-batch-detail-camera.html](fragments/superadmin--neworders-branch-batch-detail-camera.html) | oyna | qisman |
| `/new-orders/branches/:branchId/batches/:batchId` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

#### `/new-orders/cancelled` — Bekor qilinganlar — marketlar

- **Fayllar:** `src/pages/new_orders/cancelled/index.tsx` · `src/pages/new_orders/ui/SourceListCard.tsx` · `src/pages/new_orders/cancelled/utils.ts`
- **Qobiq:** DashboardLayout › NewOrdersRoleGate › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) → `canHandoverCancelledToMarket` (access.ts → canHandoverCancelledToMarket)
- **Rollar:** superadmin, admin, registrator (faqat HQ)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/cancelled` | superadmin | `superadmin-neworders-cancelled-markets` — Bekor qilinganlar — marketlar | [design/fragments/superadmin--neworders-cancelled-markets.html](fragments/superadmin--neworders-cancelled-markets.html) | sahifa | v2 |
| `/new-orders/cancelled` | admin | `admin-neworders-cancelled` — Bekor qilinganlar tabi | [design/fragments/admin--neworders-cancelled.html](fragments/admin--neworders-cancelled.html) | sahifa | v2 |
| `/new-orders/cancelled` | registrator | `registrator-new-orders-cancelled` — Bekor qilinganlar — marketlar (HQ) | [design/fragments/registrator--new-orders-cancelled.html](fragments/registrator--new-orders-cancelled.html) | sahifa | v2 |

#### `/new-orders/cancelled/:marketId` — Bekor qilinganlarni marketga topshirish (market rolida — o'z bekorlari va QR kod)

- **Fayllar:** `src/pages/new_orders/cancelled/detail.tsx` · `src/pages/new_orders/cancelled/cancelledModel.ts` · `src/pages/new_orders/cancelled/ui/HandoverStatusAlert.tsx` · `src/pages/new_orders/cancelled/ui/CancelledOrdersTable.tsx` · `src/pages/new_orders/cancelled/ui/ManualConfirmDialog.tsx` · `src/pages/new_orders/cancelled/ui/MarketQrDialog.tsx` · `src/shared/ui/SelectionRegion.tsx` · `src/pages/new_orders/cancelled/utils.ts` · `src/shared/ui/camera/ScannerCamera.tsx` · `src/app/lib/routes.tsx`
- **Qobiq:** DashboardLayout › NewOrdersRoleGate › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) · o'rovchi: `NewOrdersCancelledDetailEntry`
- **Rollar:** superadmin, admin, registrator (faqat HQ), market (faqat o'z marketi)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Kirish NewOrdersCancelledDetailEntry (routes.tsx) da: canHandoverCancelledToMarket yoki o'z marketi; boshqalar → /403. Qobiq: xodimda `bare` (o'z sarlavhasi), marketda `hosted` (tablar kartada). Marketga jo'natish faqat market QR skanerlangach (marketda QR o'chirilgan bo'lmasa); buzilgan buyurtma QR — «QR buzilganini tasdiqlash» oynasi (sabab — backend enum kodi). Kamera (`*-camera`, 2-bosqich): avval «Market QR skanerlash», QR qabul qilingach shu oynada «Buyurtmalarni tanlash · QR 04:12 amal qiladi» (kamera yopilmaydi); ruxsat amalda bo'lsa market QR qayta o'qilsa so'rov yuborilmaydi (takror ovozi, ruxsat saqlanadi). Sarlavhadagi «Market QR skanerlash» tugmasi olib tashlangan — kamera faqat markaziy tugmadan. Ega qarori 2026-10-19 (skaner, Trello v1eLN2tV): pastki menyuning markaziy «Skaner» tugmasi (planshet/desktop — yuqori paneldagi «Skanerlash») kontekstli — sahifa skan maqsadini ro'yxatdan o'tkazgan bo'lsa kamera shu sahifa ustida, USB bilan bir xil handler'da ochiladi (ScannerHost); oqim ichidagi «Kamera bilan skanerlash» tugmasi QILINMAYDI (v1 «Kamera» tugmalari va eski kamera oynasi 2-bosqichda olib tashlangan).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/cancelled/:marketId` | superadmin | `superadmin-neworders-cancelled-handover` — Bekor qilinganlarni marketga topshirish | [design/fragments/superadmin--neworders-cancelled-handover.html](fragments/superadmin--neworders-cancelled-handover.html) | sahifa | v2 |
| `/new-orders/cancelled/:marketId` | superadmin | `superadmin-neworders-cancelled-handover-done` — Bekor qilinganlarni marketga topshirish — «Topshirildi» bo'limi (taklif) | [design/fragments/superadmin--neworders-cancelled-handover-done.html](fragments/superadmin--neworders-cancelled-handover-done.html) | sahifa | yangi (kodda yo'q) |
| `/new-orders/cancelled/:marketId` | superadmin | `superadmin-neworders-cancelled-pin-dialog` — Market PIN kodi (modal, taklif) | [design/fragments/superadmin--neworders-cancelled-pin-dialog.html](fragments/superadmin--neworders-cancelled-pin-dialog.html) | oyna | v2 |
| `/new-orders/cancelled/:marketId` | superadmin | `superadmin-neworders-cancelled-handover-camera` — Bekor qilinganlarni marketga topshirish — kamera<br>↳ `src/shared/ui/camera/ScannerCamera.tsx` | [design/fragments/superadmin--neworders-cancelled-handover-camera.html](fragments/superadmin--neworders-cancelled-handover-camera.html) | oyna | qisman |
| `/new-orders/cancelled/:marketId` | superadmin | `superadmin-neworders-cancelled-manual-dialog` — QR buzilganini tasdiqlash (modal)<br>↳ `src/pages/new_orders/cancelled/ui/ManualConfirmDialog.tsx` | [design/fragments/superadmin--neworders-cancelled-manual-dialog.html](fragments/superadmin--neworders-cancelled-manual-dialog.html) | oyna | v2 |
| `/new-orders/cancelled/:marketId` | superadmin | `superadmin-neworders-cancelled-scanner-dialog` — Kamera skaneri (modal) | [design/fragments/superadmin--neworders-cancelled-scanner-dialog.html](fragments/superadmin--neworders-cancelled-scanner-dialog.html) | oyna | qisman |
| `/new-orders/cancelled/:marketId` | admin | `admin-neworders-cancelled-detail` — Bekor qilinganlarni marketga topshirish | [design/fragments/admin--neworders-cancelled-detail.html](fragments/admin--neworders-cancelled-detail.html) | sahifa | v2 |
| `/new-orders/cancelled/:marketId` | admin | `admin-neworders-cancelled-detail-camera` — Bekor qilinganlarni marketga topshirish — kamera<br>↳ `src/shared/ui/camera/ScannerCamera.tsx` | [design/fragments/admin--neworders-cancelled-detail-camera.html](fragments/admin--neworders-cancelled-detail-camera.html) | oyna | qisman |
| `/new-orders/cancelled/:marketId` | admin | `admin-neworders-cancelled-manual-dialog` — QR buzilganini tasdiqlash<br>↳ `src/pages/new_orders/cancelled/ui/ManualConfirmDialog.tsx` | [design/fragments/admin--neworders-cancelled-manual-dialog.html](fragments/admin--neworders-cancelled-manual-dialog.html) | oyna | v2 |
| `/new-orders/cancelled/:marketId` | admin | `admin-neworders-cancelled-scanner-dialog` — Market QR skaneri | [design/fragments/admin--neworders-cancelled-scanner-dialog.html](fragments/admin--neworders-cancelled-scanner-dialog.html) | oyna | qisman |
| `/new-orders/cancelled/:marketId` | registrator | `registrator-new-orders-cancelled-detail` — Bekor qilinganlarni marketga topshirish (HQ) | [design/fragments/registrator--new-orders-cancelled-detail.html](fragments/registrator--new-orders-cancelled-detail.html) | sahifa | v2 |
| `/new-orders/cancelled/:marketId` | registrator | `registrator-new-orders-cancelled-manual-dialog` — QR buzilganini tasdiqlash (HQ)<br>↳ `src/pages/new_orders/cancelled/ui/ManualConfirmDialog.tsx` | [design/fragments/registrator--new-orders-cancelled-manual-dialog.html](fragments/registrator--new-orders-cancelled-manual-dialog.html) | oyna | v2 |
| `/new-orders/cancelled/:marketId` | registrator | `registrator-new-orders-cancelled-scanner-dialog` — Market QR skanerlash (HQ) | [design/fragments/registrator--new-orders-cancelled-scanner-dialog.html](fragments/registrator--new-orders-cancelled-scanner-dialog.html) | oyna | qisman |
| `/new-orders/cancelled/:marketId` | market | `market-new-orders-cancelled` — Bekor qilinganlar | [design/fragments/market--new-orders-cancelled.html](fragments/market--new-orders-cancelled.html) | sahifa | v2 |
| `/new-orders/cancelled/:marketId` | market | `market-new-orders-cancelled-transit` — Bekor qilinganlar · Yo'lda (taklif)<br>↳ `src/pages/new_orders/cancelled/ui/MarketReturns.tsx` | [design/fragments/market--new-orders-cancelled-transit.html](fragments/market--new-orders-cancelled-transit.html) | sahifa | v2 |
| `/new-orders/cancelled/:marketId` | market | `market-new-orders-cancelled-received` — Bekor qilinganlar · Olganlarim (taklif)<br>↳ `src/pages/new_orders/cancelled/ui/MarketReturns.tsx` | [design/fragments/market--new-orders-cancelled-received.html](fragments/market--new-orders-cancelled-received.html) | sahifa | v2 |
| `/new-orders/cancelled/:marketId` | market | `market-new-orders-cancelled-qr-dialog` — Bekor qilinganlar · QR kod<br>↳ `src/pages/new_orders/cancelled/ui/MarketQrDialog.tsx` | [design/fragments/market--new-orders-cancelled-qr-dialog.html](fragments/market--new-orders-cancelled-qr-dialog.html) | oyna | v2 |
| `/new-orders/cancelled/:marketId` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

#### `/new-orders/:marketId` — Market yangi buyurtmalari — qabul (market rolida: o'z yangi buyurtmalari)

- **Fayllar:** `src/pages/new_orders/components/new_orderDetail.tsx` · `src/pages/new_orders/components/newOrderReceiveRules.ts` · `src/features/print-receipts/index.ts` · `src/pages/new_orders/components/marketOrders/MarketOrdersTable.tsx` · `src/pages/new_orders/components/marketOrders/SelectionBar.tsx` · `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` · `src/pages/new_orders/components/marketOrders/marketOrdersModel.ts` · `src/app/lib/routes.tsx`
- **Qobiq:** DashboardLayout › NewOrdersRoleGate › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) · o'rovchi: `NewOrdersMarketAccessEntry`
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market (faqat o'z marketi)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** NewOrdersMarketAccessEntry (routes.tsx): market faqat o'z marketId sini ochadi. Qabul/o'chirish tasdig'i — PopupConfirm. Tahrirlash → /new-orders/:marketId/edit/:orderId. Ega qarori 2026-10-19 (skaner, Trello v1eLN2tV): pastki menyuning markaziy «Skaner» tugmasi (planshet/desktop — yuqori paneldagi «Skanerlash») kontekstli — sahifa skan maqsadini ro'yxatdan o'tkazgan bo'lsa kamera shu sahifa ustida, USB bilan bir xil handler'da ochiladi (ScannerHost); oqim ichidagi «Kamera bilan skanerlash» tugmasi QILINMAYDI (v1 «Kamera» tugmalari va eski kamera oynasi 2-bosqichda olib tashlangan). «Qabul qilish» uzun ro'yxatda doim ko'rinadi (ndKkHjhe): ≥ 768 sarlavha yopishqoq, telefonda tugma pastki menyu ustidagi panelda (/dispatch naqshi, Q7); maketdagi «Kamera bilan skanerlash» paneli yo'q (ega qarori 2026-10-19).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/new-orders/:marketId` | superadmin | `superadmin-neworders-market-orders` — Market yangi buyurtmalari (qabul) | [design/fragments/superadmin--neworders-market-orders.html](fragments/superadmin--neworders-market-orders.html) | sahifa | v2 |
| `/new-orders/:marketId` | superadmin | `superadmin-neworders-market-orders-camera` — Market yangi buyurtmalari (qabul) — kamera | [design/fragments/superadmin--neworders-market-orders-camera.html](fragments/superadmin--neworders-market-orders-camera.html) | oyna | qisman |
| `/new-orders/:marketId` | superadmin | `superadmin-neworders-receive-confirm-dialog` — Qo'lda qabul qilish (tasdiq)<br>↳ `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | [design/fragments/superadmin--neworders-receive-confirm-dialog.html](fragments/superadmin--neworders-receive-confirm-dialog.html) | oyna | v2 |
| `/new-orders/:marketId` | superadmin | `superadmin-neworders-market-orders-special-print-menu` — Market yangi buyurtmalari — «Faqat maxsus yorliqlar» menyusi | [design/fragments/superadmin--neworders-market-orders-special-print-menu.html](fragments/superadmin--neworders-market-orders-special-print-menu.html) | sahifa | yangi (kodda yo'q) |
| `/new-orders/:marketId` | superadmin | `superadmin-neworders-market-orders-special-print-dialog` — «Maxsus yorliq chop etish» oynasi | [design/fragments/superadmin--neworders-market-orders-special-print-dialog.html](fragments/superadmin--neworders-market-orders-special-print-dialog.html) | oyna | yangi (kodda yo'q) |
| `/new-orders/:marketId` | admin | `admin-neworders-market-detail` — Market yangi buyurtmalari | [design/fragments/admin--neworders-market-detail.html](fragments/admin--neworders-market-detail.html) | sahifa | v2 |
| `/new-orders/:marketId` | admin | `admin-neworders-market-detail-camera` — Market yangi buyurtmalari — kamera | [design/fragments/admin--neworders-market-detail-camera.html](fragments/admin--neworders-market-detail-camera.html) | oyna | qisman |
| `/new-orders/:marketId` | admin | `admin-neworders-market-confirm-dialog` — Qabul tasdig'i / buyurtmani o'chirish<br>↳ `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | [design/fragments/admin--neworders-market-confirm-dialog.html](fragments/admin--neworders-market-confirm-dialog.html) | oyna | v2 |
| `/new-orders/:marketId` | manager | `manager-new-orders-market-detail` — Market buyurtmalari — qabul | [design/fragments/manager--new-orders-market-detail.html](fragments/manager--new-orders-market-detail.html) | sahifa | v2 |
| `/new-orders/:marketId` | manager | `manager-new-orders-market-detail-camera` — Market buyurtmalari — qabul — kamera | [design/fragments/manager--new-orders-market-detail-camera.html](fragments/manager--new-orders-market-detail-camera.html) | oyna | qisman |
| `/new-orders/:marketId` | manager | `manager-new-orders-receive-confirm-dialog` — Qo'lda qabul qilish tasdig'i<br>↳ `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | [design/fragments/manager--new-orders-receive-confirm-dialog.html](fragments/manager--new-orders-receive-confirm-dialog.html) | oyna | v2 |
| `/new-orders/:marketId` | manager | `manager-new-orders-delete-confirm-dialog` — Buyurtmani o'chirish tasdig'i<br>↳ `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | [design/fragments/manager--new-orders-delete-confirm-dialog.html](fragments/manager--new-orders-delete-confirm-dialog.html) | oyna | v2 |
| `/new-orders/:marketId` | registrator | `registrator-new-orders-market-detail` — Market buyurtmalari — qabul | [design/fragments/registrator--new-orders-market-detail.html](fragments/registrator--new-orders-market-detail.html) | sahifa | qisman |
| `/new-orders/:marketId` | registrator | `registrator-new-orders-market-detail-camera` — Market buyurtmalari — qabul — kamera | [design/fragments/registrator--new-orders-market-detail-camera.html](fragments/registrator--new-orders-market-detail-camera.html) | oyna | qisman |
| `/new-orders/:marketId` | registrator | `registrator-new-orders-market-detail-receive-dialog` — Qabul qilish tasdig'i<br>↳ `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | [design/fragments/registrator--new-orders-market-detail-receive-dialog.html](fragments/registrator--new-orders-market-detail-receive-dialog.html) | oyna | qisman |
| `/new-orders/:marketId` | registrator | `registrator-new-orders-market-detail-delete-dialog` — Buyurtmani o'chirish tasdig'i<br>↳ `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | [design/fragments/registrator--new-orders-market-detail-delete-dialog.html](fragments/registrator--new-orders-market-detail-delete-dialog.html) | oyna | v2 |
| `/new-orders/:marketId` | market | `market-new-orders-list` — Yangi buyurtmalar | [design/fragments/market--new-orders-list.html](fragments/market--new-orders-list.html) | sahifa | v2 |
| `/new-orders/:marketId` | market | `market-new-orders-delete-dialog` — Buyurtmani o'chirish<br>↳ `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | [design/fragments/market--new-orders-delete-dialog.html](fragments/market--new-orders-delete-dialog.html) | oyna | v2 |
| `/new-orders/:marketId` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |
| `/new-orders/:marketId` | tizim taxtasi | `tizim-category-labels` — Maxsus yorliq — kategoriya belgisi (100×60, A4, tartib) | [design/fragments/tizim--category-labels.html](fragments/tizim--category-labels.html) | taxta | qoida |

#### `/new-orders/:marketId/edit/:orderId` — Yangi buyurtmani tahrirlash (qabuldan oldin)

- **Fayllar:** `src/pages/new_orders/components/new_orderUpdate.tsx` · `src/pages/new_orders/components/newOrderUpdateRules.ts` · `src/app/lib/routes.tsx`
- **Qobiq:** DashboardLayout › NewOrdersRoleGate › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders) · o'rovchi: `NewOrdersMarketAccessEntry`
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

- **Fayllar:** `src/pages/users/detail/UserDetailPage.tsx` · `src/widgets/user-detail/ui/UserDetailView.tsx` · `src/widgets/user-detail/ui/MarketTelegramGroupsCard.tsx`
- **Qobiq:** DashboardLayout › NewOrdersRoleGate › NewOrders (`src/pages/new_orders/index.tsx`) · **Guard:** `canCreateOrdersByRoleAndBranchType` (access.ts → canCreateOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator, market, market_operator (MO-3: faqat /new-orders/create («AI bilan»); /new-orders → create, qolgan bolalar 403 (NewOrdersRoleGate). Qo'lda — POST /orders ruxsatidan keyin (MO-7))
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Alohida maket yo'q — <rol>-users-detail maketlari (superadmin-users-detail). /all-users/:id bilan bir xil v2 sahifa (UserDetailView); «Qabul va yaratish» qobig'i bu yo'lda bare — sarlavha va «Buyurtma yaratish» takrorlanmaydi (newOrdersShell.ts), «←» — navigate(-1).

### Pochta

#### `/mails` — Pochta — kirish nuqtasi

- **Fayllar:** `src/pages/mails/index.tsx` · `src/pages/mails/lib/navigation.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewMails` (access.ts → canViewMails)
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier, logist (taklif — logist faqat ko'radi (LG-S1), kodda yo'q)
- **Menyuda:** «Pochta» (`mails`) — superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier
- **Holat:** v2
- **Izoh:** Komponent darhol /mails/today ga yo'naltiradi.

#### `/mails/today` — Pochta — Bugungi pochtalar

- **Fayllar:** `src/pages/mails/index.tsx` · `src/pages/mails/components/todaysMails.tsx` · `src/pages/mails/components/MailsListBody.tsx` · `src/pages/mails/components/MailsTable.tsx` · `src/pages/mails/components/MailSummaryStats.tsx` · `src/pages/mails/model/mailsLists.ts` · `src/pages/mails/model/mailsLayout.ts` · `src/pages/mails/components/lib/regionFilterOptions.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewMails` (access.ts → canViewMails)
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier, logist (taklif — logist faqat ko'radi (LG-S1), kodda yo'q)
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
| `/mails/today` | logist | `logist-mails-list` — Pochta — viloyatlarim pochtalari | [design/fragments/logist--mails-list.html](fragments/logist--mails-list.html) | sahifa | yangi (kodda yo'q) |

#### `/mails/return` — Pochta — Qaytarish so'rovlari

- **Fayllar:** `src/pages/mails/index.tsx` · `src/pages/mails/components/returnMails.tsx` · `src/shared/ui/SelectionRegion.tsx` · `src/pages/mails/model/mailsLists.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewMails` (access.ts → canViewMails)
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier, logist (taklif — logist faqat ko'radi (LG-S1), kodda yo'q)
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
| `/mails/return` | logist | — maket yo'q — docs/DESIGN_SYSTEM.md va eng yaqin maket asos | — | — | v2 |

#### `/mails/refused` — Pochta — Rad etilgan pochtalar

- **Fayllar:** `src/pages/mails/index.tsx` · `src/pages/mails/components/refusedMails.tsx` · `src/pages/mails/components/MailsListBody.tsx` · `src/pages/mails/components/MailsTable.tsx` · `src/pages/mails/components/MailSummaryStats.tsx` · `src/pages/mails/model/mailsLists.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewMails` (access.ts → canViewMails)
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier, logist (taklif — logist faqat ko'radi (LG-S1), kodda yo'q)
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
| `/mails/refused` | logist | — maket yo'q — docs/DESIGN_SYSTEM.md va eng yaqin maket asos | — | — | v2 |

#### `/mails/old` — Pochta — Eski pochtalar (admin/superadmin: «Filial paketlari» rejimi)

- **Fayllar:** `src/pages/mails/index.tsx` · `src/pages/mails/components/oldMails.tsx` · `src/pages/mails/components/OldMailsFiltersSheet.tsx` · `src/pages/mails/components/MailsTable.tsx` · `src/pages/mails/model/oldMailsModel.ts` · `src/pages/mails/components/lib/exportOldMailsToExcel.ts` · `src/pages/mails/components/lib/regionFilterOptions.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewMails` (access.ts → canViewMails)
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier, logist (taklif — logist faqat ko'radi (LG-S1), kodda yo'q)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Ega qarori 2026-10-17 (Pochta birxillashtirishi): filtrlar — ichki yorliqli Select («Viloyat: … · Kuryer: … · Holati: …») + sana oralig'i; «Excelga yuklash» karta asboblar qatorida (telefonda ikonka); xulosa qatori barcha xodimlarda; admin/superadmin — «Pochtalar | Filial paketlari» almashtirgichi (?batch_mode=all); paket qatori /batches/:id ni ochadi («← Eski pochtalar» filtrlar bilan). Filtr va sahifalash server tomonida (GET /post, GET /post/courier/old-posts — Trello YfrqN70i), Excel barcha filtrlangan qatorlarni 100 talab sahifalab oladi. Pochtalar xulosasi — «N ta pochta · M ta buyurtma · jami S» (tveJKICY: GET /post va post/courier/old-posts javobidagi orders_total, amount_total — joriy filtr bo'yicha barcha sahifalar; eski javobda — faqat «N ta pochta»); kuryer telefonida maketdagidek «Jami N ta pochta». «Filial paketlari» — GET transfer-batches ning barcha sahifalari (fetchAllTransferBatches), filtr mijoz tomonida.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/mails/old` | superadmin | `superadmin-mails-old` — Pochta — Eski pochtalar<br>↳ `src/pages/mails/components/oldMails.tsx` | [design/fragments/superadmin--mails-old.html](fragments/superadmin--mails-old.html) | sahifa | v2 |
| `/mails/old` | superadmin | `superadmin-mails-old-batches` — Pochta — Hamma batchlar (eski)<br>↳ `src/pages/mails/components/oldMails.tsx` | [design/fragments/superadmin--mails-old-batches.html](fragments/superadmin--mails-old-batches.html) | sahifa | v2 |
| `/mails/old` | admin | `admin-mails-old` — Pochta — Eski pochtalar<br>↳ `src/pages/mails/components/oldMails.tsx` | [design/fragments/admin--mails-old.html](fragments/admin--mails-old.html) | sahifa | v2 |
| `/mails/old` | admin | `admin-mails-old-all-batches` — Eski pochtalar — Hamma batchlar<br>↳ `src/pages/mails/components/oldMails.tsx` | [design/fragments/admin--mails-old-all-batches.html](fragments/admin--mails-old-all-batches.html) | sahifa | v2 |
| `/mails/old` | manager | `manager-mails-old` — Pochta — Eski pochtalar<br>↳ `src/pages/mails/components/oldMails.tsx` | [design/fragments/manager--mails-old.html](fragments/manager--mails-old.html) | sahifa | v2 |
| `/mails/old` | registrator | `registrator-mails-old` — Pochta — Eski pochtalar<br>↳ `src/pages/mails/components/oldMails.tsx` | [design/fragments/registrator--mails-old.html](fragments/registrator--mails-old.html) | sahifa | v2 |
| `/mails/old` | courier | `courier-mails-old` — Pochta — Eski<br>↳ `src/pages/mails/components/oldMails.tsx` | [design/fragments/courier--mails-old.html](fragments/courier--mails-old.html) | sahifa | v2 |
| `/mails/old` | logist | — maket yo'q — docs/DESIGN_SYSTEM.md va eng yaqin maket asos | — | — | v2 |

#### `/mails/:id` — Pochta tafsiloti — jo'natish / qabul qilish / rad etilgan / tarix

- **Fayllar:** `src/pages/mails/detail/index.tsx` · `src/pages/mails/detail/model/useMailDetailState.ts` · `src/pages/mails/detail/model/useOrderRowView.tsx` · `src/pages/mails/detail/ui/MailStatCards.tsx` · `src/pages/mails/detail/ui/OrdersTable.tsx` · `src/pages/mails/detail/ui/OrderRow.tsx` · `src/pages/mails/detail/ui/SendButton.tsx` · `src/pages/mails/detail/ui/SendPostModal.tsx` · `src/pages/mails/detail/ui/DeleteFromPostDialog.tsx` · `src/pages/mails/detail/ui/printOptions.tsx` · `src/pages/mails/detail/lib/printMode.ts` · `src/pages/mails/detail/lib/scanMatch.ts` · `src/pages/mails/detail/lib/mailSearch.ts` · `src/pages/mails/detail/ui/DuplicatePhonesAlert.tsx` · `src/shared/ui/SelectionRegion.tsx` · `src/shared/components/PrintModeSelect.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewMails` (access.ts → canViewMails)
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID), registrator, courier, logist (taklif — logist faqat ko'radi (LG-S1), kodda yo'q)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Rejim URL'dan: ?type=refused → rad etilgan, ?view=old → tarix (faqat o'qish), ?view=old-all-batches → eski pochtalarning «Filial paketlari» rejimidan ochilgan tarix (admin/superadmin; *-mails-detail-old / admin-mails-old-detail maketi). «Filialga jo'natish» oynasi faqat superadmin/admin/HQ registrator (canDispatchPostToBranch). Chop etish menyusi — PrintModeSelect. Ega qarori 2026-10-19 (skaner, Trello v1eLN2tV): pastki menyuning markaziy «Skaner» tugmasi (planshet/desktop — yuqori paneldagi «Skanerlash») kontekstli — sahifa skan maqsadini ro'yxatdan o'tkazgan bo'lsa kamera shu sahifa ustida, USB bilan bir xil handler'da ochiladi (ScannerHost); oqim ichidagi «Kamera bilan skanerlash» tugmasi QILINMAYDI (v1 «Kamera» tugmalari va eski kamera oynasi 2-bosqichda olib tashlangan). Qidiruv («Buyurtmalar N ta» kartasida, × bilan, «natija yo'q» holati) va takroriy telefon raqamlar banneri (*-mails-detail-duplicates / -search / -search-empty, menejerda *-receive-*) — klient tomonda, pochta ichidagi buyurtmalar bo'yicha (sahifa barcha buyurtmalarni yuklaydi; +998 siz raqamlar normallashtiriladi), backend maydoni kerak emas. Qoida: pochtada takroriy raqam bo'lsa banner qidiruvdan qat'i nazar turadi, chiplari filtr — faol chip = joriy qidiruv.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/mails/:id` | superadmin | `superadmin-mails-detail` — Pochta tafsiloti (jo'natish) | [design/fragments/superadmin--mails-detail.html](fragments/superadmin--mails-detail.html) | sahifa | v2 |
| `/mails/:id` | superadmin | `superadmin-mails-detail-duplicates` — Pochta tafsiloti (jo'natish) — takroriy telefonlar<br>↳ `src/pages/mails/detail/ui/DuplicatePhonesAlert.tsx`, `src/pages/mails/detail/ui/OrdersTable.tsx` | [design/fragments/superadmin--mails-detail-duplicates.html](fragments/superadmin--mails-detail-duplicates.html) | sahifa | v2 |
| `/mails/:id` | superadmin | `superadmin-mails-detail-search` — Pochta tafsiloti (jo'natish) — qidiruv<br>↳ `src/pages/mails/detail/ui/OrdersTable.tsx` | [design/fragments/superadmin--mails-detail-search.html](fragments/superadmin--mails-detail-search.html) | sahifa | v2 |
| `/mails/:id` | superadmin | `superadmin-mails-detail-search-empty` — Pochta tafsiloti (jo'natish) — qidiruvda natija yo'q<br>↳ `src/pages/mails/detail/ui/OrdersTable.tsx` | [design/fragments/superadmin--mails-detail-search-empty.html](fragments/superadmin--mails-detail-search-empty.html) | sahifa | v2 |
| `/mails/:id` | superadmin | `superadmin-mails-detail-camera` — Pochta tafsiloti (jo'natish) — kamera | [design/fragments/superadmin--mails-detail-camera.html](fragments/superadmin--mails-detail-camera.html) | oyna | qisman |
| `/mails/:id` | superadmin | `superadmin-mails-detail-send-dialog` — Pochtani filialga jo'natish (modal)<br>↳ `src/pages/mails/detail/ui/SendPostModal.tsx` | [design/fragments/superadmin--mails-detail-send-dialog.html](fragments/superadmin--mails-detail-send-dialog.html) | oyna | v2 |
| `/mails/:id` | superadmin | `superadmin-mails-detail-refused` — Rad etilgan pochta tafsiloti (qabul) | [design/fragments/superadmin--mails-detail-refused.html](fragments/superadmin--mails-detail-refused.html) | sahifa | v2 |
| `/mails/:id` | superadmin | `superadmin-mails-detail-old` — Eski pochta tafsiloti (faqat o'qish) | [design/fragments/superadmin--mails-detail-old.html](fragments/superadmin--mails-detail-old.html) | sahifa | v2 |
| `/mails/:id` | superadmin | `superadmin-mails-detail-special-categories` — Pochta tafsiloti (jo'natish) — maxsus belgilar | [design/fragments/superadmin--mails-detail-special-categories.html](fragments/superadmin--mails-detail-special-categories.html) | sahifa | yangi (kodda yo'q) |
| `/mails/:id` | admin | `admin-mails-detail` — Pochta tafsiloti | [design/fragments/admin--mails-detail.html](fragments/admin--mails-detail.html) | sahifa | v2 |
| `/mails/:id` | admin | `admin-mails-detail-duplicates` — Pochta tafsiloti — takroriy telefonlar<br>↳ `src/pages/mails/detail/ui/DuplicatePhonesAlert.tsx`, `src/pages/mails/detail/ui/OrdersTable.tsx` | [design/fragments/superadmin--mails-detail-duplicates.html](fragments/superadmin--mails-detail-duplicates.html) | sahifa | v2 |
| `/mails/:id` | admin | `admin-mails-detail-search` — Pochta tafsiloti — qidiruv<br>↳ `src/pages/mails/detail/ui/OrdersTable.tsx` | [design/fragments/superadmin--mails-detail-search.html](fragments/superadmin--mails-detail-search.html) | sahifa | v2 |
| `/mails/:id` | admin | `admin-mails-detail-search-empty` — Pochta tafsiloti — qidiruvda natija yo'q<br>↳ `src/pages/mails/detail/ui/OrdersTable.tsx` | [design/fragments/superadmin--mails-detail-search-empty.html](fragments/superadmin--mails-detail-search-empty.html) | sahifa | v2 |
| `/mails/:id` | admin | `admin-mails-detail-camera` — Pochta tafsiloti — kamera | [design/fragments/superadmin--mails-detail-camera.html](fragments/superadmin--mails-detail-camera.html) | oyna | qisman |
| `/mails/:id` | admin | `admin-mails-send-branch-dialog` — Pochtani filialga jo'natish<br>↳ `src/pages/mails/detail/ui/SendPostModal.tsx` | [design/fragments/admin--mails-send-branch-dialog.html](fragments/admin--mails-send-branch-dialog.html) | oyna | v2 |
| `/mails/:id` | admin | `admin-mails-refused-detail` — Rad etilgan pochta tafsiloti | [design/fragments/admin--mails-refused-detail.html](fragments/admin--mails-refused-detail.html) | sahifa | v2 |
| `/mails/:id` | admin | `admin-mails-old-detail` — Eski pochta tafsiloti (tarix) | [design/fragments/admin--mails-old-detail.html](fragments/admin--mails-old-detail.html) | sahifa | v2 |
| `/mails/:id` | manager | `manager-mails-detail-receive` — Pochta tafsiloti — qabul qilish | [design/fragments/manager--mails-detail-receive.html](fragments/manager--mails-detail-receive.html) | sahifa | v2 |
| `/mails/:id` | manager | `manager-mails-detail-receive-duplicates` — Pochta tafsiloti — qabul qilish — takroriy telefonlar<br>↳ `src/pages/mails/detail/ui/DuplicatePhonesAlert.tsx`, `src/pages/mails/detail/ui/OrdersTable.tsx` | [design/fragments/manager--mails-detail-receive-duplicates.html](fragments/manager--mails-detail-receive-duplicates.html) | sahifa | v2 |
| `/mails/:id` | manager | `manager-mails-detail-receive-search` — Pochta tafsiloti — qabul qilish — qidiruv<br>↳ `src/pages/mails/detail/ui/OrdersTable.tsx` | [design/fragments/manager--mails-detail-receive-search.html](fragments/manager--mails-detail-receive-search.html) | sahifa | v2 |
| `/mails/:id` | manager | `manager-mails-detail-receive-search-empty` — Pochta tafsiloti — qabul qilish — qidiruvda natija yo'q<br>↳ `src/pages/mails/detail/ui/OrdersTable.tsx` | [design/fragments/manager--mails-detail-receive-search-empty.html](fragments/manager--mails-detail-receive-search-empty.html) | sahifa | v2 |
| `/mails/:id` | manager | `manager-mails-detail-receive-camera` — Pochta tafsiloti — qabul qilish — kamera | [design/fragments/manager--mails-detail-receive-camera.html](fragments/manager--mails-detail-receive-camera.html) | oyna | qisman |
| `/mails/:id` | manager | `manager-mails-detail-refused-receive` — Rad etilgan pochta — qabul | [design/fragments/manager--mails-detail-refused-receive.html](fragments/manager--mails-detail-refused-receive.html) | sahifa | v2 |
| `/mails/:id` | manager | `manager-mails-detail-old` — Eski pochta tafsiloti (tarix) | [design/fragments/admin--mails-old-detail.html](fragments/admin--mails-old-detail.html) | sahifa | v2 |
| `/mails/:id` | registrator | `registrator-mails-detail` — Pochta tafsiloti — bugungi | [design/fragments/registrator--mails-detail.html](fragments/registrator--mails-detail.html) | sahifa | v2 |
| `/mails/:id` | registrator | `registrator-mails-detail-duplicates` — Pochta tafsiloti — bugungi — takroriy telefonlar<br>↳ `src/pages/mails/detail/ui/DuplicatePhonesAlert.tsx`, `src/pages/mails/detail/ui/OrdersTable.tsx` | [design/fragments/registrator--mails-detail-duplicates.html](fragments/registrator--mails-detail-duplicates.html) | sahifa | v2 |
| `/mails/:id` | registrator | `registrator-mails-detail-search` — Pochta tafsiloti — bugungi — qidiruv<br>↳ `src/pages/mails/detail/ui/OrdersTable.tsx` | [design/fragments/registrator--mails-detail-search.html](fragments/registrator--mails-detail-search.html) | sahifa | v2 |
| `/mails/:id` | registrator | `registrator-mails-detail-search-empty` — Pochta tafsiloti — bugungi — qidiruvda natija yo'q<br>↳ `src/pages/mails/detail/ui/OrdersTable.tsx` | [design/fragments/registrator--mails-detail-search-empty.html](fragments/registrator--mails-detail-search-empty.html) | sahifa | v2 |
| `/mails/:id` | registrator | `registrator-mails-detail-camera` — Pochta tafsiloti — bugungi — kamera | [design/fragments/registrator--mails-detail-camera.html](fragments/registrator--mails-detail-camera.html) | oyna | qisman |
| `/mails/:id` | registrator | `registrator-mails-detail-send-dialog` — Pochtani filialga jo'natish (HQ)<br>↳ `src/pages/mails/detail/ui/SendPostModal.tsx` | [design/fragments/registrator--mails-detail-send-dialog.html](fragments/registrator--mails-detail-send-dialog.html) | oyna | v2 |
| `/mails/:id` | registrator | `registrator-mails-detail-refused` — Pochta tafsiloti — rad etilgan | [design/fragments/registrator--mails-detail-refused.html](fragments/registrator--mails-detail-refused.html) | sahifa | v2 |
| `/mails/:id` | registrator | `registrator-mails-detail-old` — Pochta tafsiloti — tarix | [design/fragments/registrator--mails-detail-old.html](fragments/registrator--mails-detail-old.html) | sahifa | v2 |
| `/mails/:id` | courier | `courier-mails-detail-receive` — Pochta tafsiloti — qabul qilish | [design/fragments/courier--mails-detail-receive.html](fragments/courier--mails-detail-receive.html) | sahifa | v2 |
| `/mails/:id` | courier | `courier-mails-detail-receive-camera` — Pochta tafsiloti — qabul qilish — kamera | [design/fragments/courier--mails-detail-receive-camera.html](fragments/courier--mails-detail-receive-camera.html) | oyna | qisman |
| `/mails/:id` | courier | `courier-mails-detail-refused` — Pochta tafsiloti — rad etilgan (faqat o'qish) | [design/fragments/courier--mails-detail-refused.html](fragments/courier--mails-detail-refused.html) | sahifa | v2 |
| `/mails/:id` | courier | `courier-mails-detail-old` — Pochta tafsiloti — eski (tarix) | [design/fragments/courier--mails-detail-old.html](fragments/courier--mails-detail-old.html) | sahifa | v2 |
| `/mails/:id` | courier | `courier-mails-detail-print-menu` — Chop etish menyusi<br>↳ `src/shared/components/PrintModeSelect.tsx` | [design/fragments/courier--mails-detail-print-menu.html](fragments/courier--mails-detail-print-menu.html) | oyna | v2 |
| `/mails/:id` | courier | `courier-mails-detail-print-menu-special` — Chop etish menyusi — «Faqat maxsus yorliqlar» | [design/fragments/courier--mails-detail-print-menu-special.html](fragments/courier--mails-detail-print-menu-special.html) | oyna | yangi (kodda yo'q) |
| `/mails/:id` | courier | `courier-mails-detail-print-menu-special-disabled` — Chop etish menyusi — «Faqat maxsus yorliqlar» o'chiq (belgisiz tanlov) | [design/fragments/courier--mails-detail-print-menu-special-disabled.html](fragments/courier--mails-detail-print-menu-special-disabled.html) | oyna | yangi (kodda yo'q) |
| `/mails/:id` | logist | `logist-mails-detail` — Pochta tafsiloti — faqat ko'rish | [design/fragments/logist--mails-detail.html](fragments/logist--mails-detail.html) | sahifa | yangi (kodda yo'q) |
| `/mails/:id` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |
| `/mails/:id` | tizim taxtasi | `tizim-category-labels` — Maxsus yorliq — kategoriya belgisi (100×60, A4, tartib) | [design/fragments/tizim--category-labels.html](fragments/tizim--category-labels.html) | taxta | qoida |

### Paketlar va qaytarishlar

#### `/batches` — Paketlar — Yangi · Eski · Qaytarilgan

- **Fayllar:** `src/pages/batches/ui/BatchesPage.tsx` · `src/pages/batches/model/batchView.ts` · `src/pages/batches/lib/batchFormat.ts` · `src/entities/batch/model/batchStatus.ts` · `src/pages/branch-ops/index.tsx` · `src/pages/ops/ui/OpsSection.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewBatches` (access.ts → canViewBatchesPage)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), logist (taklif — logist faqat ko'radi (LG-S1), kodda yo'q)
- **Menyuda:** «Paketlar» (`batches`) — superadmin, admin, manager (HQ · PICKUP · HYBRID)
- **Holat:** v2
- **Izoh:** Tab URL'da: ?tab=new|old|return. Superadmin uchun ro'yxat ostida «Filiallar — operatsiyalar» (pages/branch-ops, maket superadmin-ops-branches, Ops'dan ko'chgan, F2NzXpMv).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/batches` | superadmin | `superadmin-batches-new` — Paketlar — Yangi | [design/fragments/superadmin--batches-new.html](fragments/superadmin--batches-new.html) | sahifa | v2 |
| `/batches` | superadmin | `superadmin-batches-old` — Paketlar — Eski | [design/fragments/superadmin--batches-old.html](fragments/superadmin--batches-old.html) | sahifa | v2 |
| `/batches` | superadmin | `superadmin-batches-return` — Paketlar — Qaytarilgan | [design/fragments/superadmin--batches-return.html](fragments/superadmin--batches-return.html) | sahifa | v2 |
| `/batches` | superadmin | `superadmin-ops-branches` — Ops — Filiallar (partiya bekor qilish) | [design/fragments/superadmin--ops-branches.html](fragments/superadmin--ops-branches.html) | sahifa | v2 |
| `/batches` | admin | `admin-batches-new` — Paketlar — Yangi | [design/fragments/superadmin--batches-new.html](fragments/superadmin--batches-new.html) | sahifa | v2 |
| `/batches` | admin | `admin-batches-old` — Paketlar — Eski | [design/fragments/superadmin--batches-old.html](fragments/superadmin--batches-old.html) | sahifa | v2 |
| `/batches` | admin | `admin-batches-return` — Paketlar — Qaytarilgan | [design/fragments/superadmin--batches-return.html](fragments/superadmin--batches-return.html) | sahifa | v2 |
| `/batches` | manager | `manager-batches-new` — Paketlar — Yangi | [design/fragments/manager--batches-new.html](fragments/manager--batches-new.html) | sahifa | v2 |
| `/batches` | manager | `manager-batches-old` — Paketlar — Eski | [design/fragments/manager--batches-old.html](fragments/manager--batches-old.html) | sahifa | v2 |
| `/batches` | manager | `manager-batches-return` — Paketlar — Qaytarilgan | [design/fragments/manager--batches-return.html](fragments/manager--batches-return.html) | sahifa | v2 |
| `/batches` | logist | `logist-batches-list` — Paketlar — viloyatlarimga | [design/fragments/logist--batches-list.html](fragments/logist--batches-list.html) | sahifa | yangi (kodda yo'q) |

#### `/batches/:id` — Paket tafsiloti (menejer: asosiy filialga jo'natish yoki faqat o'qish; qaytarish paketi ham shu sahifa)

- **Fayllar:** `src/pages/batches/ui/BatchDetailPage.tsx` · `src/pages/batches/ui/BatchInfoCard.tsx` · `src/pages/batches/ui/BatchQrCard.tsx` · `src/pages/batches/ui/BatchHistoryCard.tsx` · `src/pages/batches/ui/BatchPrintMenu.tsx` · `src/pages/batches/lib/batchReceipt.ts` · `src/pages/batches/ui/BatchQrCode.tsx` · `src/pages/batches/lib/batchOrderMailAdapter.ts` · `src/pages/mails/detail/ui/OrdersTable.tsx` · `src/pages/mails/detail/ui/MailStatCards.tsx` · `src/pages/mails/detail/ui/SendButton.tsx` · `src/pages/mails/detail/model/useMailDetailState.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewBatches` (access.ts → canViewBatchesPage)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), logist (taklif — logist faqat ko'radi (LG-S1), kodda yo'q)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Jo'natish rejimi: paket holati «new» va rol menejer/registrator (canSendToMainBranch); aks holda faqat o'qish. /returns qatori ham shu sahifani ochadi. Buyurtmalar kartasi, statistika va jo'natish tugmasi /mails/:id bilan umumiy (pages/mails/detail/ui — batchOrderMailAdapter.ts orqali). Filial nomlari (3HKvAyhm, backend 0507e22) — GET transfer-batches/:id javobidagi source_branch / destination_branch {id, name} dan, barcha rollarda (menejer ham), GET branches/:id chaqirilmaydi; «Tarix» — GET transfer-batches/:id/history (eng yangisi tepada, bajargan — user.name, noma'lum harakat — action_label; o'z yuklanish/xato holati; logistda so'ralmaydi — 403). Ega qarori 2026-10-19 (skaner, Trello v1eLN2tV): pastki menyuning markaziy «Skaner» tugmasi (planshet/desktop — yuqori paneldagi «Skanerlash») kontekstli — sahifa skan maqsadini ro'yxatdan o'tkazgan bo'lsa kamera shu sahifa ustida, USB bilan bir xil handler'da ochiladi (ScannerHost); oqim ichidagi «Kamera bilan skanerlash» tugmasi QILINMAYDI (v1 «Kamera» tugmalari va eski kamera oynasi 2-bosqichda olib tashlangan).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/batches/:id` | superadmin | `superadmin-batches-detail` — Paket tafsiloti | [design/fragments/superadmin--batches-detail.html](fragments/superadmin--batches-detail.html) | sahifa | v2 |
| `/batches/:id` | admin | `admin-batches-detail` — Paket tafsiloti | [design/fragments/superadmin--batches-detail.html](fragments/superadmin--batches-detail.html) | sahifa | v2 |
| `/batches/:id` | manager | `manager-batches-detail-send` — Paket tafsiloti — asosiy filialga jo'natish | [design/fragments/manager--batches-detail-send.html](fragments/manager--batches-detail-send.html) | sahifa | v2 |
| `/batches/:id` | manager | `manager-batches-detail-send-camera` — Paket tafsiloti — asosiy filialga jo'natish — kamera | [design/fragments/manager--batches-detail-send-camera.html](fragments/manager--batches-detail-send-camera.html) | oyna | qisman |
| `/batches/:id` | manager | `manager-batches-detail-readonly` — Paket tafsiloti (faqat o'qish) | [design/fragments/manager--batches-detail-readonly.html](fragments/manager--batches-detail-readonly.html) | sahifa | v2 |
| `/batches/:id` | manager | `manager-returns-batch-detail` — Qaytarish paketi tafsiloti | [design/fragments/manager--returns-batch-detail.html](fragments/manager--returns-batch-detail.html) | sahifa | v2 |
| `/batches/:id` | logist | — maket yo'q — docs/DESIGN_SYSTEM.md va eng yaqin maket asos | — | — | v2 |
| `/batches/:id` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

#### `/returns` — Qaytarishlar (qaytarish paketlari ro'yxati)

- **Fayllar:** `src/pages/returns/index.tsx` · `src/pages/returns/model/returnBatches.ts` · `src/pages/logistics-ops/index.tsx` · `src/pages/logistics-ops/ui/ApproveReturnSummary.tsx` · `src/pages/ops/ui/OpsSection.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewReturns` (access.ts → canViewReturnsPage)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID)
- **Menyuda:** «Qaytarishlar» (`returns`) — superadmin, admin, manager (HQ · PICKUP · HYBRID)
- **Holat:** v2
- **Izoh:** Superadmin uchun ro'yxat ostida «Qaytarish so'rovlari» (pages/logistics-ops, maket superadmin-ops-logistics, Ops'dan ko'chgan, F2NzXpMv). Qator bosilsa → /batches/:id (manager-returns-batch-detail; «← Qaytarishlar» filtrlar bilan). Filtrlar «Holat: …» va «Sana: …» (ega qarori 2026-10-17 F2) — URL ?status&period|date, o'zgarsa sahifa 1; sana qisqartirilgan: Bugun / Bu hafta / Bu oy (period) yoki bitta kun (date) — GET transfer-batches from/to oralig'ini olmaydi; telefonda ham ikkalasi qatorda (≤ 2 filtr, maket). Holat bo'sh yoki «Yangi» bo'lsa backend PENDING paketlarni sahifa ichida yig'adi va meta.total sahifaga xos — «jami N ta paket» va sahifalash to'liq emas (egaga savol Q2).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/returns` | superadmin | `superadmin-returns-list` — Return batchlar | [design/fragments/superadmin--returns-list.html](fragments/superadmin--returns-list.html) | sahifa | v2 |
| `/returns` | superadmin | `superadmin-ops-logistics` — Ops — Logistika (qaytarish so'rovlari) | [design/fragments/superadmin--ops-logistics.html](fragments/superadmin--ops-logistics.html) | sahifa | v2 |
| `/returns` | superadmin | `superadmin-ops-logistics-approve-dialog` — Ops — Logistika: qaytarish so'rovlarini tasdiqlash<br>↳ `src/pages/logistics-ops/index.tsx`, `src/pages/logistics-ops/ui/ApproveReturnSummary.tsx` | [design/fragments/superadmin--ops-logistics-approve-dialog.html](fragments/superadmin--ops-logistics-approve-dialog.html) | oyna | v2 |
| `/returns` | superadmin | `superadmin-ops-logistics-approve-result` — Ops — Logistika: tasdiqlash natijasi (qisman o'tkazib yuborildi) | [design/fragments/superadmin--ops-logistics-approve-result.html](fragments/superadmin--ops-logistics-approve-result.html) | sahifa | v2 |
| `/returns` | admin | `admin-returns-list` — Return batchlar | [design/fragments/superadmin--returns-list.html](fragments/superadmin--returns-list.html) | sahifa | v2 |
| `/returns` | manager | `manager-returns-list` — Return batchlar | [design/fragments/manager--returns-list.html](fragments/manager--returns-list.html) | sahifa | v2 |

### Biriktirish va tezkor amal

#### `/dispatch` — Biriktirish — buyurtmalarni skanerlab kuryerga berish

- **Fayllar:** `src/pages/dispatch/index.tsx` · `src/pages/dispatch/ui/DispatchStats.tsx` · `src/pages/dispatch/ui/DispatchOrdersTable.tsx` · `src/pages/dispatch/ui/CourierPickerDialog.tsx` · `src/pages/dispatch/ui/DispatchAlert.tsx` · `src/pages/dispatch/model/dispatchModel.ts` · `src/features/dispatch-basket/model/dispatchBasket.ts` · `src/shared/ui/camera/ScannerCamera.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewDispatch` (access.ts → canViewDispatchPage)
- **Rollar:** superadmin, admin, manager (REGIONAL · HYBRID), registrator (HQ · REGIONAL · HYBRID)
- **Menyuda:** «Biriktirish» (`dispatch`) — manager (REGIONAL · HYBRID), registrator (HQ · REGIONAL · HYBRID)
- **Holat:** v2
- **Izoh:** Dizayn v2 (G3): barcha rollar uchun bitta tartib — registrator maketlari (dispatch-list, dispatch-empty) + menejer dispatch-scan matnlari, «Kuryerni tanlang» oynasi — CourierPickerDialog (Dialog, telefonda pastki varaqa). Ega savoli Q7 sukuti: telefonda pastki menyu ustida yopishqoq panel «Biriktirish — K ta» (har rolda; kamera — markaziy «Skaner»), sarlavhadagi tugma ≥ 768 da. Bitta faol kuryer — oynasiz darhol biriktiriladi. /scan/:token dan «Kuryerga biriktirish» (Q3) → buyurtma savatga tanlangan holda yoziladi va /dispatch ochiladi. Savat qurilmada (ega qarori D2): features/dispatch-basket — foydalanuvchi + filial kaliti, localStorage, 12 soatdan eskisi tashlanadi; sahifa yangilansa yoki chiqib qaytilsa ham saqlanadi, boshqa tablar bilan sinxron. Kamera — markaziy «Skaner» orqali (ScannerCamera): qo'shilgan buyurtma darhol tanlanadi, rad etilgan kod ro'yxatda «Rad etildi». Ega qarori 2026-10-19 (skaner, Trello v1eLN2tV): pastki menyuning markaziy «Skaner» tugmasi (planshet/desktop — yuqori paneldagi «Skanerlash») kontekstli — sahifa skan maqsadini ro'yxatdan o'tkazgan bo'lsa kamera shu sahifa ustida, USB bilan bir xil handler'da ochiladi (ScannerHost); oqim ichidagi «Kamera bilan skanerlash» tugmasi QILINMAYDI (v1 «Kamera» tugmalari va eski kamera oynasi 2-bosqichda olib tashlangan).

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

- **Fayllar:** `src/pages/courier-bulk/index.tsx` · `src/pages/courier-bulk/model/courierBulk.ts` · `src/pages/courier-bulk/ui/CourierBulkSummary.tsx` · `src/pages/courier-bulk/ui/ScanModeControl.tsx` · `src/pages/courier-bulk/ui/CourierBulkOrders.tsx` · `src/pages/courier-bulk/ui/ResultControl.tsx` · `src/pages/courier-bulk/ui/BulkAlert.tsx` · `src/pages/courier-bulk/ui/CourierBulkProofDialog.tsx` · `src/pages/courier-bulk/ui/CourierBulkResultDialog.tsx` · `src/pages/courier-bulk/ui/segmentTint.ts` · `src/pages/courier-bulk/model/useIsBelowLg.ts` · `src/shared/ui/camera/ScannerCamera.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewCourierBulk` (access.ts → canViewCourierBulkPage)
- **Rollar:** manager (REGIONAL · HYBRID), courier
- **Menyuda:** «Tezkor amal» (`quickAction`) — manager (REGIONAL · HYBRID), courier
- **Holat:** v2
- **Izoh:** Dizayn v2 (G3): kuryer va menejer uchun bitta tartib (courier-courier-bulk-main). Ega savoli Q8 sukuti: menejerda ham kuryer maketi (4 stat karta, qidiruv + «Natija» filtri, saralash — hammasi mijoz tomonida, yangi API parametri yo'q); «Kutilayotgan» izohi menejerda «Filial kuryerlarida, yakunlanmagan». Q9: «Faqat bekorlarni qo'llash» olib tashlandi (maketlarda yo'q). Telefonda «Kunni yakunlash» pastki menyu ustidagi yopishqoq panelda (DOM'da bitta tugma). Tasdiq — useConfirm (courier-courier-bulk-confirm-dialog matnlari); «Ertaga» so'rov yubormaydi. Tasdiqdan keyingi isbot qadami (CourierBulkProofDialog — market expense_proof_conditions talab qilgan buyurtmalarga har biriga bitta ProofField, hammasida fayl bo'lmaguncha «Yakunlash» o'chiq) va xatolar ro'yxati (CourierBulkResultDialog — har xato backend sababi bilan) uchun maket yo'q — eng yaqini: tizim-states-forms + courier-courier-bulk-confirm-dialog (dev j9KFyqlS). Isbot kerak bo'lmasa qo'shimcha qadam yo'q; ommaviy sotish/bekor so'rovlarida X-Request-Source: courier-bulk. Kamera — markaziy «Skaner» orqali (ScannerCamera): kamera ichida «Bekor · Ertaga» almashtirgichi, «N / M ta skanerlandi», ro'yxat varag'ida «Bekor qilish». Ega qarori 2026-10-19 (skaner, Trello v1eLN2tV): pastki menyuning markaziy «Skaner» tugmasi (planshet/desktop — yuqori paneldagi «Skanerlash») kontekstli — sahifa skan maqsadini ro'yxatdan o'tkazgan bo'lsa kamera shu sahifa ustida, USB bilan bir xil handler'da ochiladi (ScannerHost); oqim ichidagi «Kamera bilan skanerlash» tugmasi QILINMAYDI (v1 «Kamera» tugmalari va eski kamera oynasi 2-bosqichda olib tashlangan).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/courier-bulk` | manager | `manager-courier-bulk-main` — Tezkor amal | [design/fragments/manager--courier-bulk-main.html](fragments/manager--courier-bulk-main.html) | sahifa | v2 |
| `/courier-bulk` | manager | `manager-courier-bulk-camera-dialog` — Tezkor amal — kamera | [design/fragments/manager--courier-bulk-camera-dialog.html](fragments/manager--courier-bulk-camera-dialog.html) | oyna | qisman |
| `/courier-bulk` | courier | `courier-courier-bulk-main` — Tezkor amal — kunni yakunlash | [design/fragments/courier--courier-bulk-main.html](fragments/courier--courier-bulk-main.html) | sahifa | v2 |
| `/courier-bulk` | courier | `courier-courier-bulk-scanner-camera` — Tezkor amal — kamera skaneri | [design/fragments/courier--courier-bulk-scanner-camera.html](fragments/courier--courier-bulk-scanner-camera.html) | oyna | qisman |
| `/courier-bulk` | courier | `courier-courier-bulk-scanner-camera-list` — Tezkor amal — kamera, skanerlanganlar ro'yxati | [design/fragments/courier--courier-bulk-scanner-camera-list.html](fragments/courier--courier-bulk-scanner-camera-list.html) | oyna · faqat telefon | qisman |
| `/courier-bulk` | courier | `courier-courier-bulk-confirm-dialog` — Kunni yakunlash — tasdiqlash oynasi | [design/fragments/courier--courier-bulk-confirm-dialog.html](fragments/courier--courier-bulk-confirm-dialog.html) | oyna | v2 |
| `/courier-bulk` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

### Skaner

#### `/scan` — QR skaner — telefon kamerasi (to'liq ekran, ScanLayout)

- **Fayllar:** `src/pages/scan/index.tsx` · `src/pages/scan/model/useUniversalScan.ts` · `src/pages/scan/model/scanHistory.ts` · `src/pages/scan/ui/ScanSideCards.tsx` · `src/pages/scan/ui/ScanModeCards.tsx` · `src/pages/scan/model/scanModes.ts` · `src/pages/scan/model/useCourierTake.ts` · `src/pages/scan/model/scanPickers.ts` · `src/pages/scan/model/useMailModeScan.ts` · `src/pages/scan/lib/scanResource.ts` · `src/shared/ui/camera/ScannerCamera.tsx` · `src/shared/ui/camera/scanRegion.ts` · `src/shared/ui/camera/useLowLight.ts` · `src/shared/lib/useCameraQrScanner.ts` · `src/shared/lib/scanner/feedback.ts` · `src/shared/components/ScanFeedbackOverlay.tsx`
- **Qobiq:** ScanLayout · **Guard:** yo'q (faqat kirish)
- **Rollar:** superadmin, admin, manager, registrator, market, market_operator, courier, logist, investor
- **Menyuda:** yo'q — yuqori panel → «Skanerlash» tugmasi; telefon menyusi; skaner natijasidan «Skanerga qaytish»
- **Holat:** v2
- **Izoh:** Ega qarori 2026-10-19 (skaner, Trello v1eLN2tV): pastki menyuning markaziy «Skaner» tugmasi (planshet/desktop — yuqori paneldagi «Skanerlash») kontekstli — sahifa skan maqsadini ro'yxatdan o'tkazgan bo'lsa kamera shu sahifa ustida, USB bilan bir xil handler'da ochiladi (ScannerHost); oqim ichidagi «Kamera bilan skanerlash» tugmasi QILINMAYDI (v1 «Kamera» tugmalari va eski kamera oynasi 2-bosqichda olib tashlangan). Universal skaner (dizayn v2, 1-bosqich): faqat «Ma'lumot» rejimi — bitta kod aniqlanadi va natija sahifasi /scan/:token ochiladi («№… topildi · Tegishli ekran ochilmoqda»); topilmadi / yaroqsiz QR / market QR — skaner ochiq qoladi, natija kamerada va desktopda «Natija» kartasida. Rejimlar (3-bosqich, maket yo'q — eng yaqini courier-courier-bulk-scanner-camera segmenti): rol va filial bo'yicha segment (telefonda kamera ichida, planshet/desktopda yon paneldagi «Skaner rejimi»), tanlov qurilmada. «Ma'lumot» — kuryerdan boshqa hammada sukut; «Qabul qilish» (canCreateOrders, REGIONAL menejer/registratorda yo'q) — market varag'i (GET orders/markets/new) → /new-orders/:id, kamera o'sha sahifada ochiq; «Kuryerga biriktirish» (faqat menejer, registrator — backend assign-to-courier; superadmin/admin yo'q) — /dispatch, kamera ochiq, /scan da o'qilgan kod savatga dispatch handler'i bilan; kuryer — «O'zimga olish» (sukut): ketma-ket POST orders/scan-assign, ro'yxat «Sizga biriktirildi / Allaqachon sizda / Boshqa kuryerda: <ism> / sabab», «Tugatish» → kesh yangilanadi va xulosa. Telefonda to'liq ekran (ScannerCamera presentation=page; pastda «Oxirgi: …» qatori, [Qo'lda kiritish] [Chiroq]); planshet/desktopda kamera + «USB skaner ham tayyor» va qo'lda kiritish, «Oxirgi skanerlar · Shu qurilmada» (localStorage, foydalanuvchiga bog'langan, oxirgi 10 ta). Qo'lda kiritish — faqat token yoki /scan/<token> havolasi: buyurtma raqami bo'yicha qidiruv API'si yo'q (QR faqat qr_code_token bo'yicha), shuning uchun maketdagi raqamli klaviatura va «Harflar» kiritilmagan — ega qarori kutiladi. Resolver (scanResource.ts): POST-/PST- → GET post/scan/:token; MCR- — so'rovsiz «Bu market QR kodi» (backend bir martada yeydi); qolgani GET orders/qr-code/:token, 404 bo'lsa GET scan/:token zaxirasi (BeePost qop yorlig'i); 24 belgili hex token kichik harfga keltiriladi, token encodeURIComponent bilan. Oflayn: chip bor, navbat yo'q. Sozlamalar (4-bosqich): kamera ochilishda Sozlamalar → Skaner → «Kamera» ni o'qiydi — asosiy kamera (kamera ichida «Kamerani almashtirish», bir nechta kamera bo'lsa — maket superadmin-scan-camera), ramka o'lchami va skan hududi, chiroq taklifi; «Uzluksiz skanerlash» faqat oqim kamerasiga ta'sir qiladi (universal /scan sahifasi o'zgarmaydi). Ega so'rovi 2026-10-25 (Trello vNcGDnNh 2-band, maket yo'q — eng yaqini superadmin-scan-camera): yana uchta rejim, «Qabul qilish» namunasida (varaq → sahifa, kamera o'sha sahifada ochiq — scannerArrivalState): «Pochtani jo'natish» (superadmin, admin, HQ registratori — canDispatchPostToBranch) — GET post/new varag'i yoki pochta QR'i (POST-/PST- → GET post/scan/:token, faqat new holatda) → /mails/:id, maqsad mail:<id>:send; «Rad etilgan pochta» (superadmin, admin, HQ registratori, menejer HQ · REGIONAL · HYBRID — canReceiveRefusedMail; kuryerda sahifa faqat o'qish) — GET post/rejected varag'i yoki pochta QR'i (faqat canceled) → /mails/:id (type: refused), maqsad mail:<id>:refused; «Marketga topshirish» (superadmin, admin, HQ registratori — canHandoverCancelledToMarket) — GET orders/markets/cancelled varag'i majburiy (market QR o'sha sahifada) → /new-orders/cancelled/:id, maqsad cancelled-handover:<id>. Rejim 3 tadan ko'p bo'lsa segment o'rniga telefonda «Rejim: … ▾» → «Skaner rejimi» varag'i, yon panelda ochiladigan ro'yxat; 3 talik segmentda rad etilgan pochta — qisqa «Rad etilgan». Ega qarori 2026-10-26 (vNcGDnNh): 3 tadan ko'p rejimda maketdagi segment o'rniga «Rejim: … ▾» varag'i (telefon) va ochiladigan ro'yxat (yon panel) — tasdiqlandi, shu ko'rinishda qoladi.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/scan` | superadmin | `superadmin-scan-camera` — Skaner — kamera (umumiy) | [design/fragments/superadmin--scan-camera.html](fragments/superadmin--scan-camera.html) | sahifa | v2 |
| `/scan` | admin | `admin-scan-camera` — Skaner — kamera (umumiy) | [design/fragments/superadmin--scan-camera.html](fragments/superadmin--scan-camera.html) | sahifa | v2 |
| `/scan` | manager | `manager-scan-camera` — Skaner — kamera (umumiy) | [design/fragments/superadmin--scan-camera.html](fragments/superadmin--scan-camera.html) | sahifa | v2 |
| `/scan` | registrator | `registrator-scan-camera` — Skaner — kamera (umumiy) | [design/fragments/superadmin--scan-camera.html](fragments/superadmin--scan-camera.html) | sahifa | v2 |
| `/scan` | market | — Maket yo'q — market skanerlamaydi (roles.json: persona.scan = false). URL bilan ochilsa — «Skaner market roli uchun emas» bo'sh holati (kamera ochilmaydi). | — | — | v2 |
| `/scan` | market_operator | — maket yo'q — docs/DESIGN_SYSTEM.md va eng yaqin maket asos | — | — | v2 |
| `/scan` | courier | `courier-scan-camera` — Skaner — kamera | [design/fragments/courier--scan-camera.html](fragments/courier--scan-camera.html) | sahifa | v2 |
| `/scan` | courier | `courier-scan-starting` — Skaner — kamera ishga tushmoqda | [design/fragments/courier--scan-starting.html](fragments/courier--scan-starting.html) | sahifa | v2 |
| `/scan` | courier | `courier-scan-permission-denied` — Skaner — kameraga ruxsat yo'q | [design/fragments/courier--scan-permission-denied.html](fragments/courier--scan-permission-denied.html) | sahifa | v2 |
| `/scan` | courier | `courier-scan-active` — Skaner — skanerlanmoqda | [design/fragments/courier--scan-active.html](fragments/courier--scan-active.html) | sahifa | qisman |
| `/scan` | courier | `courier-scan-success-flash` — Skaner — muvaffaqiyatli o'qildi | [design/fragments/courier--scan-success-flash.html](fragments/courier--scan-success-flash.html) | sahifa | v2 |
| `/scan` | courier | `courier-scan-invalid` — Skaner — noto'g'ri QR | [design/fragments/courier--scan-invalid.html](fragments/courier--scan-invalid.html) | sahifa | v2 |
| `/scan` | courier | `courier-scan-too-fast` — Skaner — juda tez | [design/fragments/courier--scan-too-fast.html](fragments/courier--scan-too-fast.html) | sahifa | v2 |
| `/scan` | courier | `courier-scan-offline` — Skaner — internet yo'q (navbat) | [design/fragments/courier--scan-offline.html](fragments/courier--scan-offline.html) | sahifa | yangi (kodda yo'q) |
| `/scan` | courier | `courier-scan-manual-entry` — Skaner — kodni qo'lda kiritish | [design/fragments/courier--scan-manual-entry.html](fragments/courier--scan-manual-entry.html) | sahifa | qisman |
| `/scan` | courier | `courier-scan-not-found` — Skaner — topilmadi | [design/fragments/courier--scan-not-found.html](fragments/courier--scan-not-found.html) | sahifa | v2 |
| `/scan` | logist | — maket yo'q — docs/DESIGN_SYSTEM.md va eng yaqin maket asos | — | — | v2 |
| `/scan` | investor | — maket yo'q — docs/DESIGN_SYSTEM.md va eng yaqin maket asos | — | — | v2 |
| `/scan` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

#### `/scan/:token` — Skanerlangan obyekt — buyurtma / paket / pochta

- **Fayllar:** `src/pages/scan/detail.tsx` · `src/pages/scan/ui/ScanOrderResult.tsx` · `src/pages/scan/ui/ScanResultHeader.tsx` · `src/pages/scan/ui/ScanActionCard.tsx` · `src/pages/scan/ui/ScanStickyBar.tsx` · `src/pages/scan/ui/ScanAlert.tsx` · `src/pages/scan/ui/ScanStates.tsx` · `src/pages/scan/ui/ScanOrdersCard.tsx` · `src/pages/scan/ui/ScanBatchSummary.tsx` · `src/pages/scan/ui/ScanTrackingCard.tsx` · `src/pages/scan/ui/ManagerOrderDialogs.tsx` · `src/pages/scan/ui/ScanPackageDetail.tsx` · `src/pages/scan/ui/ScanPostDetail.tsx` · `src/pages/scan/model/scanOrderView.ts` · `src/pages/scan/model/scanBatchView.ts` · `src/pages/scan/lib/scanResource.ts` · `src/pages/scan/ui/ScanExternalBagDetail.tsx` · `src/pages/scan/ui/ScanMarketQrNotice.tsx` · `src/pages/scan/model/scanExternalBagView.ts` · `src/pages/scan/model/scanHistory.ts`
- **Qobiq:** ScanLayout · **Guard:** yo'q (faqat kirish)
- **Rollar:** superadmin, admin, manager, registrator, market, market_operator, courier, logist, investor
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Dizayn v2 (G3): barcha rollar uchun bitta tartib (menejer/kuryer maketlari tuzilmasi), rol farqi faqat mazmunda; admin — superadmin maketi (superadmin-scan-result). «O'zimga olish» faqat kuryerda; boshqa kuryerga biriktirilgan buyurtma xatosi — backend matni amallar kartasida. Paket → ScanPackageDetail, pochta → ScanPostDetail; xodimda paket nomlari GET transfer-batches/:id bilan to'ldiriladi (ixtiyoriy, xatosi global xabarsiz — silentError). Ega savollari sukuti: Q2 menejerda «Sotish / Bekor qilish» buyurtma tafsilotidagi qoidalar bilan (can_sell_cancel, REGIONAL/HYBRID, kuryer qo'lida emas); Q3 «Kuryerga biriktirish» → /dispatch (buyurtma qo'shilib tanlanadi; buyurtma holati bo'yicha cheklanmagan — spec sukuti); Q4 superadmin/admin/registrator xulosasida «To'langan» ham, «Yaratilgan» ham; Q5 kuryerga paketni «Qabul qilish» yo'q (backend 403) — faqat o'qish. Skaner 1-bosqich: pochta tokeni POST-… (backend yaratadigan shakl) ham pochta sifatida ochiladi; tashqi qop yorlig'i (GET scan/:token zaxirasi, is_external_batch) — ScanExternalBagDetail (maket yo'q — eng yaqini courier-scan-package-detail: posilkalar soni, qabul qilinmaganlar, a'zolar ro'yxati; «Kiruvchi posilkalarda ochish» → /new-orders/incoming faqat canReceiveExternalOrders); market QR'i MCR- — ScanMarketQrNotice (so'rovsiz; «Bekor qilinganlarni ochish» faqat canHandoverCancelledToMarket). Kuryer «O'zimga olish» va paket «Qabul qilish» dan keyin orders / mails / batches / scan-detail keshi eskirgan deb belgilanadi (6qypMFeT). Ochilgan obyekt «Oxirgi skanerlar» tarixiga yoziladi.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/scan/:token` | superadmin | `superadmin-scan-result` — Skanerlangan buyurtma | [design/fragments/superadmin--scan-result.html](fragments/superadmin--scan-result.html) | sahifa | v2 |
| `/scan/:token` | admin | `admin-scan-result` — Skanerlangan buyurtma | [design/fragments/superadmin--scan-result.html](fragments/superadmin--scan-result.html) | sahifa | v2 |
| `/scan/:token` | manager | `manager-scan-result` — Skanerlangan buyurtma | [design/fragments/manager--scan-result.html](fragments/manager--scan-result.html) | sahifa | v2 |
| `/scan/:token` | registrator | `registrator-scan-result` — Skanerlangan buyurtma | [design/fragments/registrator--scan-result.html](fragments/registrator--scan-result.html) | sahifa | v2 |
| `/scan/:token` | market | — Maket yo'q — market skanerlamaydi. URL orqali ochilsa — xodimning faqat o'qish tartibi (amallarsiz, holat tarixisiz, tafsilot havolasisiz). | — | — | v2 |
| `/scan/:token` | market_operator | — maket yo'q — docs/DESIGN_SYSTEM.md va eng yaqin maket asos | — | — | v2 |
| `/scan/:token` | courier | `courier-scan-order-detail` — Skanerlangan buyurtma — O'zimga olish | [design/fragments/courier--scan-order-detail.html](fragments/courier--scan-order-detail.html) | sahifa | v2 |
| `/scan/:token` | courier | `courier-scan-package-detail` — Skanerlangan paket<br>↳ `src/pages/scan/ui/ScanPackageDetail.tsx` | [design/fragments/courier--scan-package-detail.html](fragments/courier--scan-package-detail.html) | sahifa | v2 |
| `/scan/:token` | courier | `courier-scan-post-detail` — Skanerlangan pochta<br>↳ `src/pages/scan/ui/ScanPostDetail.tsx` | [design/fragments/courier--scan-post-detail.html](fragments/courier--scan-post-detail.html) | sahifa | v2 |
| `/scan/:token` | courier | `courier-scan-not-found` — Skaner — topilmadi | [design/fragments/courier--scan-not-found.html](fragments/courier--scan-not-found.html) | sahifa | v2 |
| `/scan/:token` | courier | `courier-scan-other-courier` — Skaner — boshqa kuryerga biriktirilgan | [design/fragments/courier--scan-other-courier.html](fragments/courier--scan-other-courier.html) | sahifa | qisman |
| `/scan/:token` | courier | `courier-scan-order-detail-special-categories` — Skanerlangan buyurtma — maxsus belgilar | [design/fragments/courier--scan-order-detail-special-categories.html](fragments/courier--scan-order-detail-special-categories.html) | sahifa | yangi (kodda yo'q) |
| `/scan/:token` | logist | — maket yo'q — docs/DESIGN_SYSTEM.md va eng yaqin maket asos | — | — | v2 |
| `/scan/:token` | investor | — maket yo'q — docs/DESIGN_SYSTEM.md va eng yaqin maket asos | — | — | v2 |
| `/scan/:token` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

#### `/tg/scan` — Telegram skan Mini App — kuryer uzluksiz skanerlab buyurtmalarni o'ziga oladi (shell'siz, to'liq ekran)

- **Fayllar:** `src/pages/tg-scan/index.tsx` · `src/features/tg-scan/ui/TgScanner.tsx` · `src/shared/ui/camera/CameraSurface.tsx` · `src/features/tg-scan/ui/ScanListSheet.tsx` · `src/features/tg-scan/model/useTelegramAuth.ts` · `src/features/tg-scan/model/useScanAssign.ts` · `src/features/tg-scan/model/telegramWebApp.ts` · `src/features/tg-scan/api/tgScanApi.ts`
- **Qobiq:** qobiqsiz (kirishsiz) · **Guard:** yo'q (kirishsiz)
- **Rollar:** hamma (kirishsiz)
- **Holat:** v2
- **Izoh:** Faqat kuryer (boshqa rol Telegram orqali kirsa — «Skaner faqat kuryerlar uchun»). Telegram'dan tashqarida (initData bo'sh) — «Bu sahifa faqat Telegram ichida ochiladi», kamera ochilmaydi. Hisoblagich «N ta qabul qilindi», «Ro'yxat» varag'i va «Tayyor» maketda yo'q (dizayn ziddiyati kartada qayd etilgan) — eng yaqin namuna `courier-courier-bulk-scanner-camera` va `-camera-list`. Kamera ochilmasa — Telegram skaneri (`showScanQrPopup`). «Juda tez» holati yo'q: uzluksiz rejimda kamera QR'ni qayta o'qiydi va pauza o'tgach o'zi qabul qiladi. Qo'lda kiritish yo'q: `scan-assign` faqat QR tokenni qabul qiladi (yorliqdagi raqam bilan qidirmaydi).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/tg/scan` | courier | `courier-scan-active` — Skaner — skanerlanmoqda | [design/fragments/courier--scan-active.html](fragments/courier--scan-active.html) | sahifa | qisman |
| `/tg/scan` | courier | `courier-scan-starting` — Skaner — kamera ishga tushmoqda | [design/fragments/courier--scan-starting.html](fragments/courier--scan-starting.html) | sahifa | v2 |
| `/tg/scan` | courier | `courier-scan-permission-denied` — Skaner — kameraga ruxsat yo'q | [design/fragments/courier--scan-permission-denied.html](fragments/courier--scan-permission-denied.html) | sahifa | v2 |
| `/tg/scan` | courier | `courier-scan-success-flash` — Skaner — muvaffaqiyatli o'qildi | [design/fragments/courier--scan-success-flash.html](fragments/courier--scan-success-flash.html) | sahifa | v2 |
| `/tg/scan` | courier | `courier-scan-other-courier` — Skaner — boshqa kuryerga biriktirilgan | [design/fragments/courier--scan-other-courier.html](fragments/courier--scan-other-courier.html) | sahifa | qisman |
| `/tg/scan` | courier | `courier-scan-invalid` — Skaner — noto'g'ri QR | [design/fragments/courier--scan-invalid.html](fragments/courier--scan-invalid.html) | sahifa | v2 |
| `/tg/scan` | tizim taxtasi | `tizim-scanner` — Kamera skaner — telefon kamerasi bilan skanerlash | [design/fragments/tizim--scanner.html](fragments/tizim--scanner.html) | taxta | qoida |

### Moliya — to'lovlar, kassa, balans

#### `/investments` — Investitsiyalar — investorning o'z investitsiyalari (dizayn v2, IN-2)

- **Fayllar:** `src/pages/investor/InvestmentsPage.tsx` · `src/pages/investor/model/listSearch.ts` · `src/pages/investor/ui/InvestorAccessState.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewInvestorCabinet` (access.ts → canViewInvestorCabinet)
- **Rollar:** investor (IN-2: canViewInvestorCabinet = hasRole('investor') (access.ts); backend GET investors/me/investments — @Roles(INVESTOR), doira JWT'dan)
- **Menyuda:** «Investitsiyalar» (`investments`) — investor
- **Holat:** v2
- **Izoh:** Ega qarori 2026-10-19: investor bosh sahifasi quriladi; ro'yxat sahifalari menyudan (Investitsiyalar · Foyda tarixi). GET investors/me/investments (@Roles INVESTOR): from_date, to_date, page, limit; tartib invested_at DESC (saralash parametri yo'q — sarlavhada saralash tugmasi yo'q). Ustun «Jamidagi hissasi» = amount / summary.total_amount — frontendda hisoblanadi (backend maydoni emas); «Ulush» so'zi faqat KPI dagi foyda stavkasi (current_percentage) uchun. Holatlar: yuklanish — investments-list-loading (jadval skeleti, telefonda kartalar), sana oralig'i bo'yicha bo'sh — investments-list-filtered-empty («Filtrni tozalash»), umuman bo'sh / xato / 403 / 404 — bosh sahifa holatlari matni bilan (investor-dashboard-empty, -error, -forbidden, -not-linked). Sahifalash — Pagination (page/limit). IN-2 (2026-10-21): filtr va sahifa URL'da (?from&to&page&limit — listSearch.ts), oraliq Toshkent kuni bo'yicha (from_date = kun boshi +05:00, to_date = kun oxiri +05:00). Sarlavha: filtrsiz «Jami: summary.total_amount · meta.total ta»; oraliqda «Tanlangan oraliqda: summary.range_amount · meta.total ta» (su4IYGCN / IN-3, backend d56ade9 — oraliqning barcha sahifalari; yozuv yo'q — 0). range_amount yo'q eski javobda — bitta sahifa bo'lsa sahifa yig'indisi, aks holda faqat «Tanlangan oraliqda: N ta». Eski javob (keepPreviousData) paytida URL tuzatilmaydi va bo'sh holat chizilmaydi.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/investments` | investor | `investor-investments-list` — Investitsiyalar | [design/fragments/investor--investments-list.html](fragments/investor--investments-list.html) | sahifa | v2 |
| `/investments` | investor | `investor-investments-list-loading` — Investitsiyalar — yuklanmoqda | [design/fragments/investor--investments-list-loading.html](fragments/investor--investments-list-loading.html) | sahifa | v2 |
| `/investments` | investor | `investor-investments-list-filtered-empty` — Investitsiyalar — filtr bo'yicha bo'sh | [design/fragments/investor--investments-list-filtered-empty.html](fragments/investor--investments-list-filtered-empty.html) | sahifa | v2 |

#### `/profits` — Foyda tarixi — investorning foyda yozuvlari (dizayn v2, IN-2)

- **Fayllar:** `src/pages/investor/ProfitsPage.tsx` · `src/pages/investor/ui/ProfitHistoryTable.tsx` · `src/pages/investor/model/listSearch.ts` · `src/pages/investor/ui/InvestorAccessState.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewInvestorCabinet` (access.ts → canViewInvestorCabinet)
- **Rollar:** investor (IN-2: canViewInvestorCabinet = hasRole('investor') (access.ts); backend GET investors/me/profits — @Roles(INVESTOR), doira JWT'dan)
- **Menyuda:** «Foyda tarixi» (`profits`) — investor
- **Holat:** v2
- **Izoh:** Ega qarori 2026-10-19 (investor roli). GET investors/me/profits (@Roles INVESTOR): is_paid (Barchasi · To'langan · Kutilmoqda — telefonda to'liq kenglik, 44px), page, limit; tartib period_start DESC (saralash tugmasi yo'q); sana filtri backendda yo'q — chizilmagan. Qator: davr (period_start – period_end), foiz, summa, holat (is_paid), to'langan sana (paid_at). Holatlar: filtr bo'yicha bo'sh — profits-list-filtered-empty; yuklanish — investments-list-loading naqshi; umuman bo'sh / xato / 403 / 404 — bosh sahifa holatlari. Sahifalash — Pagination. IN-2 (2026-10-21): ?status=paid|pending&page&limit URL'da; sarlavhadagi «To'langan · Kutilmoqda» — summary (filtrdan qat'i nazar barcha yozuvlar); jadval bosh sahifa bilan umumiy ProfitHistoryTable. «To'langan» filtri bo'yicha bo'sh holat — maket yo'q, eng yaqini profits-list-filtered-empty («To'langan foyda yo'q» + «Filtrni tozalash»).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/profits` | investor | `investor-profits-list` — Foyda tarixi | [design/fragments/investor--profits-list.html](fragments/investor--profits-list.html) | sahifa | v2 |
| `/profits` | investor | `investor-profits-list-filtered-empty` — Foyda tarixi — filtr bo'yicha bo'sh | [design/fragments/investor--profits-list-filtered-empty.html](fragments/investor--profits-list-filtered-empty.html) | sahifa | v2 |

#### `/payments` — To'lovlar — umumiy (berilishi / qabul qilinishi kerak, operatsiyalar tarixi)

- **Fayllar:** `src/pages/payments/index.tsx` · `src/pages/payments/components/PaymentSummaryCards.tsx` · `src/pages/payments/components/CashFlowCard.tsx` · `src/pages/payments/components/CashStateCard.tsx` · `src/pages/payments/components/DailyFlowChart.tsx` · `src/pages/payments/components/patmentHistoryTable.tsx` · `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` · `src/pages/payments/components/ExpenseCategoryBadge.tsx` · `src/pages/payments/components/SettlementPickerDialog.tsx` · `src/pages/payments/components/InactiveBadge.tsx` · `src/pages/payments/components/paymentSourceType.ts` · `src/pages/payments/components/paymentHistoryActor.ts` · `src/pages/payments/components/lib/receiveOptions.ts`
- **Qobiq:** DashboardLayout · **Guard:** `isPaymentsManager` (access.ts → canViewPaymentsPage) · ruxsat bo'lmasa → `canOpenCashbox ? "/cash-box" : "/403"`
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID)
- **Menyuda:** «To'lovlar» (`payments`) — superadmin, admin, manager (HQ · REGIONAL · HYBRID)
- **Holat:** v2
- **Izoh:** Tanlash oynalari (Qabul qilinishi kerak · Berilishi kerak · Kuryerni tanlang) — SettlementPickerDialog (kind receive | give | courier), tafsilot — FinanceHistoryDetailPopup (barcha Moliya sahifalari uchun umumiy). Birxillashtirish (spec §0.5): filtr qatori barcha rollarda tarix kartasi ichida (menejer maketi naqshi), «Sana» filtri — GET finance/history from_date/to_date. Ega qarori D1 (2026-10-17): superadmin/admin tarixi kassa tanlanmagan bo'lsa server tomonida faqat asosiy kassa (gateway sukuti cashbox_type=main); «Kassa turi» filtri boshqa kassani tanlaydi; menejerda server doim filial kassasini beradi. Tab sonlari chizilmaydi (API bermaydi, Trello GaBIPi3Z). Ruxsati yo'q rol (market, kuryer) → /cash-box. «Berilishi kerak»: 0 so'mli market sukut bo'yicha ko'rinmaydi, faqat qidiruvda (maketda 0 so'm qatorlar bor; Spt8Cj7m TC matni, tester 2026-10-30: «qaror kutilmaydi»).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/payments` | superadmin | `superadmin-payments-overview` — To'lovlar — umumiy | [design/fragments/superadmin--payments-overview.html](fragments/superadmin--payments-overview.html) | sahifa | v2 |
| `/payments` | superadmin | `superadmin-payments-market-picker-dialog` — Berilishi kerak / Qabul qilinishi kerak — tanlash<br>↳ `src/pages/payments/components/SettlementPickerDialog.tsx` | [design/fragments/superadmin--payments-market-picker-dialog.html](fragments/superadmin--payments-market-picker-dialog.html) | oyna | v2 |
| `/payments` | superadmin | `superadmin-payments-to-give-dialog` — Berilishi kerak — market tanlash<br>↳ `src/pages/payments/components/SettlementPickerDialog.tsx` | [design/fragments/superadmin--payments-to-give-dialog.html](fragments/superadmin--payments-to-give-dialog.html) | oyna | v2 |
| `/payments` | superadmin | `superadmin-payments-history-detail-dialog` — To'lov tarixi — yozuv tafsiloti<br>↳ `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | [design/fragments/superadmin--payments-history-detail-dialog.html](fragments/superadmin--payments-history-detail-dialog.html) | oyna | v2 |
| `/payments` | superadmin | `superadmin-payments-history-detail-dialog-correctable` — To'lov tarixi — yozuv tafsiloti · «Qaytarish» va «Summani tahrirlash» (muddat ichida) | [design/fragments/superadmin--payments-history-detail-dialog-correctable.html](fragments/superadmin--payments-history-detail-dialog-correctable.html) | oyna | yangi (kodda yo'q) |
| `/payments` | superadmin | `superadmin-payments-history-detail-dialog-locked` — To'lov tarixi — yozuv tafsiloti · tuzatib bo'lmaydi (muddat tugagan, eski yozuv) | [design/fragments/superadmin--payments-history-detail-dialog-locked.html](fragments/superadmin--payments-history-detail-dialog-locked.html) | oyna | yangi (kodda yo'q) |
| `/payments` | superadmin | `superadmin-payments-history-detail-dialog-corrected` — To'lov tarixi — yozuv tafsiloti · tahrirlangan to'lov, «Qaytarish va tahrir» bloki | [design/fragments/superadmin--payments-history-detail-dialog-corrected.html](fragments/superadmin--payments-history-detail-dialog-corrected.html) | oyna | yangi (kodda yo'q) |
| `/payments` | superadmin | `superadmin-payments-history-detail-dialog-replacement` — To'lov tarixi — yozuv tafsiloti · tuzatilgan to'lov (yangi yozuv) va teskari yozuv | [design/fragments/superadmin--payments-history-detail-dialog-replacement.html](fragments/superadmin--payments-history-detail-dialog-replacement.html) | oyna | yangi (kodda yo'q) |
| `/payments` | superadmin | `superadmin-payments-history-reverse-dialog` — To'lovni qaytarish — sabab (oyna) | [design/fragments/superadmin--payments-history-reverse-dialog.html](fragments/superadmin--payments-history-reverse-dialog.html) | oyna | yangi (kodda yo'q) |
| `/payments` | superadmin | `superadmin-payments-history-reverse-confirm` — To'lovni qaytarish — tasdiq | [design/fragments/superadmin--payments-history-reverse-confirm.html](fragments/superadmin--payments-history-reverse-confirm.html) | oyna | yangi (kodda yo'q) |
| `/payments` | superadmin | `superadmin-payments-history-reverse-errors` — To'lovni qaytarish — xatolar (smena yopiq, pul yetmaydi, internet yo'q …) | [design/fragments/superadmin--payments-history-reverse-errors.html](fragments/superadmin--payments-history-reverse-errors.html) | oyna | yangi (kodda yo'q) |
| `/payments` | superadmin | `superadmin-payments-history-correct-amount-dialog` — Summani tahrirlash (oyna) | [design/fragments/superadmin--payments-history-correct-amount-dialog.html](fragments/superadmin--payments-history-correct-amount-dialog.html) | oyna | yangi (kodda yo'q) |
| `/payments` | superadmin | `superadmin-payments-history-correct-amount-confirm` — Summani tahrirlash — tasdiq | [design/fragments/superadmin--payments-history-correct-amount-confirm.html](fragments/superadmin--payments-history-correct-amount-confirm.html) | oyna | yangi (kodda yo'q) |
| `/payments` | superadmin | `superadmin-payments-history-correct-amount-errors` — Summani tahrirlash — xatolar (ko'pi bilan …, bir xil summa) | [design/fragments/superadmin--payments-history-correct-amount-errors.html](fragments/superadmin--payments-history-correct-amount-errors.html) | oyna | yangi (kodda yo'q) |
| `/payments` | superadmin | `superadmin-payments-overview-corrected` — To'lovlar — umumiy · qaytarilgan va tahrirlangan to'lovlar belgilari | [design/fragments/superadmin--payments-overview-corrected.html](fragments/superadmin--payments-overview-corrected.html) | sahifa | yangi (kodda yo'q) |
| `/payments` | superadmin | `superadmin-payments-history-detail-dialog-receipt` — To'lov tarixi — yozuv tafsiloti · «Chek» bo'limi (farq bor) | [design/fragments/superadmin--payments-history-detail-dialog-receipt.html](fragments/superadmin--payments-history-detail-dialog-receipt.html) | oyna | qisman |
| `/payments` | superadmin | `superadmin-payments-history-detail-receipt-states` — To'lov tarixi — «Chek» bo'limi va ko'ruvchi holatlari | [design/fragments/superadmin--payments-history-detail-receipt-states.html](fragments/superadmin--payments-history-detail-receipt-states.html) | sahifa | qisman |
| `/payments` | superadmin | `superadmin-payments-receipt-viewer-dialog` — Chek rasmi — ko'ruvchi (Moslash ↔ 100%, yangi oynada ochish) | [design/fragments/superadmin--payments-receipt-viewer-dialog.html](fragments/superadmin--payments-receipt-viewer-dialog.html) | oyna | qisman |
| `/payments` | superadmin | `superadmin-payments-history-receipt-reanalyze-confirm` — Chekni qayta tahlil — tasdiq | [design/fragments/superadmin--payments-history-receipt-reanalyze-confirm.html](fragments/superadmin--payments-history-receipt-reanalyze-confirm.html) | oyna | qisman |
| `/payments` | superadmin | `superadmin-payments-overview-receipts` — To'lovlar — umumiy · «Chek» belgilari va «Chek holati» filtri | [design/fragments/superadmin--payments-overview-receipts.html](fragments/superadmin--payments-overview-receipts.html) | sahifa | qisman |
| `/payments` | admin | `admin-payments-overview` — To'lovlar | [design/fragments/admin--payments-overview.html](fragments/admin--payments-overview.html) | sahifa | v2 |
| `/payments` | admin | `admin-payments-to-give-dialog` — Berilishi kerak — market tanlash<br>↳ `src/pages/payments/components/SettlementPickerDialog.tsx` | [design/fragments/admin--payments-to-give-dialog.html](fragments/admin--payments-to-give-dialog.html) | oyna | v2 |
| `/payments` | admin | `admin-payments-to-receive-dialog` — Qabul qilinishi kerak — tanlash<br>↳ `src/pages/payments/components/SettlementPickerDialog.tsx` | [design/fragments/admin--payments-to-receive-dialog.html](fragments/admin--payments-to-receive-dialog.html) | oyna | v2 |
| `/payments` | admin | `admin-payments-history-detail-dialog` — To'lov tarixi tafsiloti<br>↳ `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | [design/fragments/admin--payments-history-detail-dialog.html](fragments/admin--payments-history-detail-dialog.html) | oyna | v2 |
| `/payments` | admin | `admin-payments-history-detail-dialog-corrected` — To'lov tarixi tafsiloti · tahrirlangan to'lov (faqat ko'rish) | [design/fragments/superadmin--payments-history-detail-dialog-corrected.html](fragments/superadmin--payments-history-detail-dialog-corrected.html) | oyna | yangi (kodda yo'q) |
| `/payments` | admin | `admin-payments-history-detail-dialog-receipt` — To'lov tarixi tafsiloti · «Chek» bo'limi | [design/fragments/superadmin--payments-history-detail-dialog-receipt.html](fragments/superadmin--payments-history-detail-dialog-receipt.html) | oyna | qisman |
| `/payments` | admin | `admin-payments-overview-receipts` — To'lovlar · «Chek» belgilari va «Chek holati» filtri | [design/fragments/superadmin--payments-overview-receipts.html](fragments/superadmin--payments-overview-receipts.html) | sahifa | qisman |
| `/payments` | manager | `manager-payments-overview` — To'lovlar — umumiy | [design/fragments/manager--payments-overview.html](fragments/manager--payments-overview.html) | sahifa | qisman |
| `/payments` | manager | `manager-payments-overview-shift-closed` — To'lovlar — smena yopiq<br>↳ `src/pages/payments/index.tsx`, `src/pages/payments/components/ShiftBanner.tsx`, `src/pages/payments/components/OpenShiftFlow.tsx` | [design/fragments/manager--payments-overview-shift-closed.html](fragments/manager--payments-overview-shift-closed.html) | sahifa | qisman |
| `/payments` | manager | `manager-payments-courier-select-dialog` — Qabul qilish — kuryer tanlash<br>↳ `src/pages/payments/components/SettlementPickerDialog.tsx` | [design/fragments/manager--payments-courier-select-dialog.html](fragments/manager--payments-courier-select-dialog.html) | oyna | v2 |
| `/payments` | manager | `manager-payments-history-detail-dialog` — Tranzaksiya tafsiloti<br>↳ `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | [design/fragments/manager--payments-history-detail-dialog.html](fragments/manager--payments-history-detail-dialog.html) | oyna | v2 |
| `/payments` | manager | `manager-payments-history-detail-dialog-receipt` — Tranzaksiya tafsiloti · «Chek» bo'limi (faqat ko'rish) | [design/fragments/manager--payments-history-detail-dialog-receipt.html](fragments/manager--payments-history-detail-dialog-receipt.html) | oyna | qisman |
| `/payments` | market_operator | — Yo'q — market_operator'da kassa va to'lovlar bo'limi yo'q (menyuda emas, finance ruxsati yo'q); o'z hisobi — «Daromadim» (/my-earnings, MO-2). | — | — | v2 |

#### `/payments/main-cashbox` — Asosiy kassa (to'ldirish / xarajat / smenani yopish)

- **Fayllar:** `src/pages/payments/components/mainCashbox.tsx` · `src/pages/payments/components/MainCashboxBalanceChart.tsx` · `src/pages/payments/components/BalanceTrendCard.tsx` · `src/pages/payments/components/lib/mainCashboxStats.ts` · `src/pages/payments/components/CashboxFormPopup.tsx` · `src/pages/payments/components/ExpenseCategoryBadge.tsx` · `src/pages/payments/components/CloseShiftPopup.tsx` · `src/pages/payments/components/shiftCheck/ShiftAccountsSection.tsx` · `src/pages/payments/components/shiftCheck/useShiftAccountsForm.ts` · `src/pages/payments/components/OpenShiftDialog.tsx` · `src/pages/payments/components/ShiftResultDialog.tsx` · `src/pages/payments/components/ShiftBanner.tsx` · `src/pages/payments/components/lib/useCashboxShift.ts` · `src/pages/payments/components/SettlementPickerDialog.tsx` · `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` · `src/pages/payments/components/SalaryPaymentPopup.tsx` · `src/shared/components/popupSelect.tsx` · `src/pages/payments/components/lib/exportMainCashboxReport.ts`
- **Qobiq:** DashboardLayout · **Guard:** `isPaymentsManager` (access.ts → canViewPaymentsPage) · ruxsat bo'lmasa → `canOpenCashbox ? "/cash-box" : "/403"`
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Ega qarori D1 (2026-10-17): superadmin/admin — faqat asosiy kassa operatsiyalari (GET finance/history?cashbox_type=main): ro'yxat, «Bugun / Bu hafta / Bu oy», «Pul qayerdan keldi, qayerga ketdi» va Excel hisobot; menejerda filial kassasi (server majburlaydi, o'zgarmagan). D3: «Kassani to'ldirish» / «Kassadan xarajat» — tasdiq oynasi (useConfirm) + Idempotency-Key (paymentIdempotency, qayta urinishda o'sha kalit). Birxillashtirish (spec §10 Q2): «Kassa balansi» chizig'i va manba bloklari menejerda ham; telefonda davrlar — bitta karta + SegmentedControl. Smena (kfdfYDik; ega javoblari CB-S1…S5, 2026-10-19): smena HAMMA kassada majburiy (asosiy va filial; production FINANCE_REQUIRE_OPEN_SHIFT=all) — `required: false` holati chizilmaydi (…-shift-optional olib tashlandi). Holat — GET finance/shift/current (`shift` — faqat OCHIQ smena yoki null). Smena yo'q → «Smena boshlanmagan» (warning) banneri, tezkor amallar o'chiq, «Smenani ochish» — asosiy tugma (…-shift-closed). Menejer o'z filiali kassasida smenani ochadi va sanalgan pul bilan yopadi (CB-S1, backend R6 — o'z filiali doirasi JWT'dan). Yopish oynasi: «Sanalgan naqd» majburiy, «Sanalgan karta» ixtiyoriy (CB-S5): bo'sh → discrepancy_card null, natijada «Sanalmadi» (neutral). «Tizim bo'yicha kutilgan» = kassaning jonli balance_cash / balance_card; yakuniy qiymatlar POST finance/shift/close javobidan. Farq bo'lsa izoh majburiy (frontend qoidasi). Oxirgi yopilgan smena (CB-S2): «Smena yopildi · … · Natija» kartasi, ochish oynasidagi «Oxirgi smena … bilan yopilgan» va natija oynasi sahifa qayta yuklangandan keyin ham — barcha rollarda (menejer ham) GET finance/shift/current `last_closed` dan (Taklif · backend kerak, karta); ro'yxat uchun GET finance/shift cashbox_user_id filtri + closed_at saralash (CB-S3, backend karta). Xodim ismi: opened_by / closed_by — faqat ID; joriy foydalanuvchi bo'lsa — o'z profili, aks holda GET users/:id; topilmasa «—». Xatolar: ochish/yopish xatosi — Dialog ichida qoladi + notify.error; loadingText «Ochilmoqda…» / «Yopilmoqda…». «Maosh to'lash» yashirin (SalaryPaymentPopup + PopupSelect — v1, yetib bo'lmaydi). Xarajat kategoriyalari (Elchi Pochta №1, 2026-10-22; maketda yo'q — kategoriyalar backendda bo'lmagani uchun chizilmagan edi): «Kassadan xarajat» oynasida «Xarajat kategoriyasi» (qidiruvli Select, GET finance/cashbox/expense-categories — faol kategoriyalar sort_order bo'yicha, ostida «Nimalar kiradi»; spend'ga expense_category_id, to'ldirishda maydon ham kalit ham yo'q — backend fill 400 beradi; ega 2026-10-22: kategoriya MAJBURIY, «Izoh» ixtiyoriy — bo'sh izoh yuborilmaydi; ro'yxat yuklanmasa yoki faol kategoriya yo'q bo'lsa «Xarajatni saqlash» bloklanadi, faol kategoriya yo'q bo'lsa superadminda «Xarajat kategoriyalari» havolasi — /ops?tab=expense-categories ga o'tadi), tasdiq oynasida «Kategoriya» qatori; tarixda (jadval, telefon kartalari, FinanceHistoryDetailPopup «Kategoriya» qatori) expense_category_name — yozilgan paytdagi nom, nuqtasiz neytral Badge. Kategoriyalarni boshqarish (ro'yxat + qo'shish / tahrirlash / o'chirish) — kassada emas (2026-10-23 da sarlavhadagi «Xarajat kategoriyalari» tugmasi va ExpenseCategoriesDialog olib tashlandi): Ops vositalari → «Xarajat kategoriyalari» tabi (/ops izohi). Nomli kartalar (card_id) chizilmaydi.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/payments/main-cashbox` | superadmin | `superadmin-payments-main-cashbox` — Asosiy kassa | [design/fragments/superadmin--payments-main-cashbox.html](fragments/superadmin--payments-main-cashbox.html) | sahifa | v2 |
| `/payments/main-cashbox` | superadmin | `superadmin-payments-main-cashbox-fill-dialog` — Kassani to'ldirish / Kassadan xarajat (popup)<br>↳ `src/pages/payments/components/CashboxFormPopup.tsx` | [design/fragments/superadmin--payments-main-cashbox-fill-dialog.html](fragments/superadmin--payments-main-cashbox-fill-dialog.html) | oyna | v2 |
| `/payments/main-cashbox` | superadmin | `superadmin-payments-main-cashbox-shift-dialog` — Smenani yopish (popup)<br>↳ `src/pages/payments/components/CloseShiftPopup.tsx` | [design/fragments/superadmin--payments-main-cashbox-shift-dialog.html](fragments/superadmin--payments-main-cashbox-shift-dialog.html) | oyna | v2 |
| `/payments/main-cashbox` | superadmin | `superadmin-payments-main-cashbox-shift-closed` — Asosiy kassa — smena yopiq | [design/fragments/superadmin--payments-main-cashbox-shift-closed.html](fragments/superadmin--payments-main-cashbox-shift-closed.html) | sahifa | qisman |
| `/payments/main-cashbox` | superadmin | `superadmin-payments-main-cashbox-shift-open-dialog` — Smenani ochish (popup)<br>↳ `src/pages/payments/components/OpenShiftDialog.tsx` | [design/fragments/superadmin--payments-main-cashbox-shift-open-dialog.html](fragments/superadmin--payments-main-cashbox-shift-open-dialog.html) | oyna | qisman |
| `/payments/main-cashbox` | superadmin | `superadmin-payments-main-cashbox-shift-result-dialog` — Smena yopildi — natija (popup)<br>↳ `src/pages/payments/components/ShiftResultDialog.tsx` | [design/fragments/superadmin--payments-main-cashbox-shift-result-dialog.html](fragments/superadmin--payments-main-cashbox-shift-result-dialog.html) | oyna | v2 |
| `/payments/main-cashbox` | superadmin | `superadmin-payments-main-cashbox-accounts` — Asosiy kassa — kartalar va hisob raqamlar | [design/fragments/superadmin--payments-main-cashbox-accounts.html](fragments/superadmin--payments-main-cashbox-accounts.html) | sahifa | yangi (kodda yo'q) |
| `/payments/main-cashbox` | superadmin | `superadmin-payments-cashbox-account-form-dialog` — Karta yoki hisob raqam qo'shish (popup) | [design/fragments/superadmin--payments-cashbox-account-form-dialog.html](fragments/superadmin--payments-cashbox-account-form-dialog.html) | oyna | yangi (kodda yo'q) |
| `/payments/main-cashbox` | superadmin | `superadmin-payments-main-cashbox-fill-dialog-account` — Kassaga kirim — karta yoki hisob raqamni tanlash (popup) | [design/fragments/superadmin--payments-main-cashbox-fill-dialog-account.html](fragments/superadmin--payments-main-cashbox-fill-dialog-account.html) | oyna | yangi (kodda yo'q) |
| `/payments/main-cashbox` | superadmin | `superadmin-payments-main-cashbox-shift-dialog-accounts` — Smenani yopish — kartalar qoldig'i, rasm va AI tekshiruvi (popup) | [design/fragments/superadmin--payments-main-cashbox-shift-dialog-accounts.html](fragments/superadmin--payments-main-cashbox-shift-dialog-accounts.html) | oyna | v2 |
| `/payments/main-cashbox` | superadmin | `superadmin-payments-main-cashbox-expense-receipt-dialog` — Kassadan xarajat — chek rasmi bilan (popup) | [design/fragments/superadmin--payments-main-cashbox-expense-receipt-dialog.html](fragments/superadmin--payments-main-cashbox-expense-receipt-dialog.html) | oyna | qisman |
| `/payments/main-cashbox` | superadmin | `superadmin-payments-main-cashbox-expense-receipt-confirm` — Xarajatni tasdiqlang — «Chek: biriktirildi» qatori | [design/fragments/superadmin--payments-main-cashbox-expense-receipt-confirm.html](fragments/superadmin--payments-main-cashbox-expense-receipt-confirm.html) | oyna | qisman |
| `/payments/main-cashbox` | superadmin | `superadmin-payments-main-cashbox-expense-receipt-states` — Kassadan xarajat — chek rasmi maydoni holatlari | [design/fragments/superadmin--payments-main-cashbox-expense-receipt-states.html](fragments/superadmin--payments-main-cashbox-expense-receipt-states.html) | sahifa | qisman |
| `/payments/main-cashbox` | superadmin | `superadmin-payments-main-cashbox-receipts` — Asosiy kassa — operatsiyalar tarixida «Chek» belgilari | [design/fragments/superadmin--payments-main-cashbox-receipts.html](fragments/superadmin--payments-main-cashbox-receipts.html) | sahifa | qisman |
| `/payments/main-cashbox` | admin | `admin-payments-main-cashbox` — Asosiy kassa | [design/fragments/admin--payments-main-cashbox.html](fragments/admin--payments-main-cashbox.html) | sahifa | v2 |
| `/payments/main-cashbox` | admin | `admin-payments-cashbox-form-dialog` — Kassadan xarajat / Kassani to'ldirish<br>↳ `src/pages/payments/components/CashboxFormPopup.tsx` | [design/fragments/admin--payments-cashbox-form-dialog.html](fragments/admin--payments-cashbox-form-dialog.html) | oyna | v2 |
| `/payments/main-cashbox` | admin | `admin-payments-shift-dialog` — Smenani yopish<br>↳ `src/pages/payments/components/CloseShiftPopup.tsx` | [design/fragments/admin--payments-shift-dialog.html](fragments/admin--payments-shift-dialog.html) | oyna | v2 |
| `/payments/main-cashbox` | admin | `admin-payments-main-cashbox-shift-closed` — Asosiy kassa — smena yopiq | [design/fragments/admin--payments-main-cashbox-shift-closed.html](fragments/admin--payments-main-cashbox-shift-closed.html) | sahifa | qisman |
| `/payments/main-cashbox` | admin | `admin-payments-main-cashbox-shift-open-dialog` — Smenani ochish<br>↳ `src/pages/payments/components/OpenShiftDialog.tsx` | [design/fragments/admin--payments-main-cashbox-shift-open-dialog.html](fragments/admin--payments-main-cashbox-shift-open-dialog.html) | oyna | qisman |
| `/payments/main-cashbox` | admin | `admin-payments-main-cashbox-shift-result-dialog` — Smena yopildi — natija<br>↳ `src/pages/payments/components/ShiftResultDialog.tsx` | [design/fragments/admin--payments-main-cashbox-shift-result-dialog.html](fragments/admin--payments-main-cashbox-shift-result-dialog.html) | oyna | v2 |
| `/payments/main-cashbox` | admin | `admin-payments-cashbox-form-dialog-receipt` — Kassadan xarajat — chek rasmi bilan | [design/fragments/admin--payments-cashbox-form-dialog-receipt.html](fragments/admin--payments-cashbox-form-dialog-receipt.html) | oyna | qisman |
| `/payments/main-cashbox` | manager | `manager-payments-main-cashbox` — Asosiy kassa (filial) | [design/fragments/manager--payments-main-cashbox.html](fragments/manager--payments-main-cashbox.html) | sahifa | v2 |
| `/payments/main-cashbox` | manager | `manager-payments-cashbox-form-dialog` — Kassadan xarajat / to'ldirish oynasi<br>↳ `src/pages/payments/components/CashboxFormPopup.tsx` | [design/fragments/manager--payments-cashbox-form-dialog.html](fragments/manager--payments-cashbox-form-dialog.html) | oyna | v2 |
| `/payments/main-cashbox` | manager | `manager-payments-close-shift-dialog` — Smenani yopish oynasi<br>↳ `src/pages/payments/components/CloseShiftPopup.tsx` | [design/fragments/manager--payments-close-shift-dialog.html](fragments/manager--payments-close-shift-dialog.html) | oyna | v2 |
| `/payments/main-cashbox` | manager | `manager-payments-main-cashbox-shift-closed` — Asosiy kassa (filial) — smena yopiq | [design/fragments/manager--payments-main-cashbox-shift-closed.html](fragments/manager--payments-main-cashbox-shift-closed.html) | sahifa | qisman |
| `/payments/main-cashbox` | manager | `manager-payments-main-cashbox-shift-open-dialog` — Smenani ochish oynasi<br>↳ `src/pages/payments/components/OpenShiftDialog.tsx` | [design/fragments/manager--payments-main-cashbox-shift-open-dialog.html](fragments/manager--payments-main-cashbox-shift-open-dialog.html) | oyna | qisman |
| `/payments/main-cashbox` | manager | `manager-payments-main-cashbox-shift-result-dialog` — Smena yopildi — natija oynasi<br>↳ `src/pages/payments/components/ShiftResultDialog.tsx` | [design/fragments/manager--payments-main-cashbox-shift-result-dialog.html](fragments/manager--payments-main-cashbox-shift-result-dialog.html) | oyna | v2 |
| `/payments/main-cashbox` | manager | `manager-payments-cashbox-form-dialog-receipt` — Kassadan xarajat — chek rasmi bilan (filial) | [design/fragments/manager--payments-cashbox-form-dialog-receipt.html](fragments/manager--payments-cashbox-form-dialog-receipt.html) | oyna | qisman |

#### `/payments/cash-detail/:id` — Kassa tafsiloti — kuryer / market / filial

- **Fayllar:** `src/pages/payments/components/cashDetail.tsx` · `src/pages/payments/components/CashboxActionFormCard.tsx` · `src/pages/payments/components/PaymentHistoryList.tsx` · `src/pages/payments/components/PaymentAckBadge.tsx` · `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` · `src/pages/payments/components/ExpenseCategoryBadge.tsx` · `src/pages/payments/components/lib/paymentIdempotency.ts`
- **Qobiq:** DashboardLayout · **Guard:** `isPaymentsManager` (access.ts → canViewPaymentsPage) · ruxsat bo'lmasa → `canOpenCashbox ? "/cash-box" : "/403"`
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Tur URL'da: ?type=courier|market|branch (noma'lum tur — forma yo'q). Pul o'tkazish — «To'lovni tasdiqlang» oynasi (useConfirm, from → to) + Idempotency-Key. Birxillashtirish (spec §10 Q2): «Balans harakati» va «Barcha tarix | To'lov o'tkazmalari» menejerda ham. Menejerda mijoz tomonidagi summa chegarasi yo'q (Q8 — backend chegaralaydi); tarix tab sonlari chizilmaydi (API bermaydi). Kuryer «kechaga nisbatan» va 7 kunlik chiziq (menejer), «Davr boshida» va davr jami — GET finance/history/daily (qzjTMWPb, M5). Excel faqat superadmin/admin. Smena (ega javobi CB-S4, 2026-10-19 — hamma kassada majburiy, FINANCE_REQUIRE_OPEN_SHIFT=all): menejer — filial kassasida smena ochilmagan bo'lsa forma o'rnida «Smena boshlanmagan» + «Smenani ochish» (asosiy, ayni ochish oynasi), tarix ko'rinadi (manager …-branch-shift-closed, …-courier-shift-closed; holat — GET finance/shift/current, menejer doirasi o'z filiali). Superadmin/admin «Filialdan qabul qilish» — «Filial smenasi ochilmagan» (tugmasiz: filial smenasini faqat menejer ochadi) — Taklif · backend kerak: shift/current ni ixtiyoriy filial (cashbox_user_id) uchun privileged rolga ochish; backend bo'lmaguncha — POST javobidagi 400 «Smena ochilmagan! … filial kassasida …» xabari Dialog/notify.error orqali. Asosiy kassada smena yo'q bo'lsa (privileged) — ayni blok «Smena boshlanmagan» + «Smenani ochish» asosiy kassa oynasi. Kvitansiya javobi (payment_ack — PaymentAckBadge, paymentAck.ts; KI-1): kuryer → filial o'tkazmasi (courier_payment) qatorida va tafsilot oynasida xodimga «Kuryer tasdiqladi» (success) / «Kuryer: noto'g'ri» (danger) belgisi (title — to'liq izoh; qator nomida oxirida), javob bo'lmasa qatorda belgi yo'q; maket — manager-payments-cash-detail-courier-ack va manager-payments-history-detail-dialog-ack («Noto'g'ri» holati chizilgan). Oynadagi «Kvitansiya javobi» qatori qolgan holatlarda ham shu joyda: «Kuryer tasdiqladi» — success belgi, javob yo'q — neytral «Javob yo'q» (v2HistoryDetail.paymentAckNone). superadmin/admin kuryer kassasida ham ayni qator va oyna (ayni komponent).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/payments/cash-detail/:id` | superadmin | `superadmin-payments-cash-detail-courier` — Kuryer kassasi (qabul qilish) | [design/fragments/superadmin--payments-cash-detail-courier.html](fragments/superadmin--payments-cash-detail-courier.html) | sahifa | v2 |
| `/payments/cash-detail/:id` | superadmin | `superadmin-payments-cash-detail-market` — Market kassasi (to'lov berish) | [design/fragments/superadmin--payments-cash-detail-market.html](fragments/superadmin--payments-cash-detail-market.html) | sahifa | v2 |
| `/payments/cash-detail/:id` | superadmin | `superadmin-payments-cash-detail-branch` — Filial kassasi (filialdan qabul) | [design/fragments/superadmin--payments-cash-detail-branch.html](fragments/superadmin--payments-cash-detail-branch.html) | sahifa | v2 |
| `/payments/cash-detail/:id` | superadmin | `superadmin-payments-cash-detail-branch-shift-closed` — Filial kassasi — filial smenasi ochilmagan · taklif (backend kerak) | [design/fragments/superadmin--payments-cash-detail-branch-shift-closed.html](fragments/superadmin--payments-cash-detail-branch-shift-closed.html) | sahifa | yangi (kodda yo'q) |
| `/payments/cash-detail/:id` | superadmin | `superadmin-payments-cash-detail-courier-corrected` — Kuryer kassasi · qaytarilgan to'lov belgilari | [design/fragments/superadmin--payments-cash-detail-courier-corrected.html](fragments/superadmin--payments-cash-detail-courier-corrected.html) | sahifa | yangi (kodda yo'q) |
| `/payments/cash-detail/:id` | superadmin | `superadmin-payments-cash-detail-courier-receipt` — Kuryer kassasi (HQ kuryeri) — «O'tkazma» qabulida chek rasmi | [design/fragments/superadmin--payments-cash-detail-courier-receipt.html](fragments/superadmin--payments-cash-detail-courier-receipt.html) | sahifa | qisman |
| `/payments/cash-detail/:id` | superadmin | `superadmin-payments-cash-detail-branch-receipt` — Filial kassasi — filialdan HQ ga «O'tkazma» qabulida chek rasmi | [design/fragments/superadmin--payments-cash-detail-branch-receipt.html](fragments/superadmin--payments-cash-detail-branch-receipt.html) | sahifa | qisman |
| `/payments/cash-detail/:id` | admin | `admin-payments-cash-detail-courier` — Kuryer kassasi | [design/fragments/admin--payments-cash-detail-courier.html](fragments/admin--payments-cash-detail-courier.html) | sahifa | v2 |
| `/payments/cash-detail/:id` | admin | `admin-payments-cash-detail-market` — Market kassasi | [design/fragments/admin--payments-cash-detail-market.html](fragments/admin--payments-cash-detail-market.html) | sahifa | v2 |
| `/payments/cash-detail/:id` | admin | `admin-payments-cash-detail-branch` — Filial kassasi (HQ qabul) | [design/fragments/admin--payments-cash-detail-branch.html](fragments/admin--payments-cash-detail-branch.html) | sahifa | v2 |
| `/payments/cash-detail/:id` | admin | `admin-payments-cash-detail-branch-shift-closed` — Filial kassasi — filial smenasi ochilmagan · taklif (backend kerak) | [design/fragments/admin--payments-cash-detail-branch-shift-closed.html](fragments/admin--payments-cash-detail-branch-shift-closed.html) | sahifa | yangi (kodda yo'q) |
| `/payments/cash-detail/:id` | manager | `manager-payments-cash-detail-courier` — Kassa tafsiloti — kuryerdan qabul | [design/fragments/manager--payments-cash-detail-courier.html](fragments/manager--payments-cash-detail-courier.html) | sahifa | v2 |
| `/payments/cash-detail/:id` | manager | `manager-payments-cash-detail-branch` — Kassa tafsiloti — HQ'ga o'tkazish | [design/fragments/manager--payments-cash-detail-branch.html](fragments/manager--payments-cash-detail-branch.html) | sahifa | qisman |
| `/payments/cash-detail/:id` | manager | `manager-payments-cash-detail-courier-ack` — Kassa tafsiloti — kuryerdan qabul · kvitansiya javobi<br>↳ `src/pages/payments/components/cashDetail.tsx`, `src/pages/payments/components/PaymentHistoryList.tsx`, `src/pages/payments/components/PaymentAckBadge.tsx` | [design/fragments/manager--payments-cash-detail-courier-ack.html](fragments/manager--payments-cash-detail-courier-ack.html) | sahifa | v2 |
| `/payments/cash-detail/:id` | manager | `manager-payments-history-detail-dialog-ack` — Tranzaksiya tafsiloti — kvitansiya javobi «Kuryer: noto'g'ri»<br>↳ `src/pages/payments/components/FinanceHistoryDetailPopup.tsx`, `src/pages/payments/components/PaymentAckBadge.tsx` | [design/fragments/manager--payments-history-detail-dialog-ack.html](fragments/manager--payments-history-detail-dialog-ack.html) | oyna | v2 |
| `/payments/cash-detail/:id` | manager | `manager-payments-cash-detail-branch-shift-closed` — Kassa tafsiloti — HQ'ga o'tkazish · smena yopiq<br>↳ `src/pages/payments/components/cashDetail.tsx`, `src/pages/payments/components/ShiftLockedCard.tsx`, `src/pages/payments/components/OpenShiftFlow.tsx` | [design/fragments/manager--payments-cash-detail-branch-shift-closed.html](fragments/manager--payments-cash-detail-branch-shift-closed.html) | sahifa | qisman |
| `/payments/cash-detail/:id` | manager | `manager-payments-cash-detail-courier-shift-closed` — Kassa tafsiloti — kuryerdan qabul · smena yopiq<br>↳ `src/pages/payments/components/cashDetail.tsx`, `src/pages/payments/components/ShiftLockedCard.tsx`, `src/pages/payments/components/OpenShiftFlow.tsx` | [design/fragments/manager--payments-cash-detail-courier-shift-closed.html](fragments/manager--payments-cash-detail-courier-shift-closed.html) | sahifa | v2 |
| `/payments/cash-detail/:id` | manager | `manager-payments-history-detail-dialog-corrected` — Tranzaksiya tafsiloti · qaytarilgan to'lov (faqat ko'rish) | [design/fragments/manager--payments-history-detail-dialog-corrected.html](fragments/manager--payments-history-detail-dialog-corrected.html) | oyna | yangi (kodda yo'q) |

#### `/cash-box` — O'z kassam — market va kuryer (Barcha tarix · Oldi-berdi)

- **Fayllar:** `src/pages/payments/components/MyCashboxPage.tsx` · `src/pages/payments/components/MyCashboxDaily.tsx` · `src/pages/payments/components/PaymentAckBadge.tsx` · `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` · `src/pages/payments/components/ExpenseCategoryBadge.tsx` · `src/pages/payments/components/paymentSourceType.ts`
- **Qobiq:** DashboardLayout · **Guard:** `hasSelfCashboxAccess` (routes.tsx → hasSelfCashboxAccess) · ruxsat bo'lmasa → `canOpenPayments ? "/payments" : "/403"`
- **Rollar:** manager, market, courier
- **Menyuda:** «To'lovlar» (`payments`) — market; «Kassa» (`payments`) — courier
- **Holat:** v2
- **Izoh:** Tarix tablari: «all» → cashbox-my-all, «payments» → cashbox-my-transfers (sourceTypes). Ega qarori D2 (2026-10-17): marketning o'z kassasida HQ → market o'tkazmasi (market_payment) — «Chiqim −» (market balansi = Elchining qarzi), ro'yxatda ham, tafsilot oynasida ham (getViewerOperationType); boshqa rollarda yo'nalish o'zgarmagan. Kuryer tafsilotida «Kassa turi» yo'q (hideCashboxType). «Umumiy balans» grafigi, delta, «Davr/Kassa oqimi» — GET finance/history/daily (qzjTMWPb, MyCashboxDaily.tsx); kuryerda grafik telefonda yashirin; «Filialga topshirildi» grafigi — Taklif, chizilmaydi. Ruxsati yo'q rol → /payments. Kvitansiya javobi (payment_ack; KI-1, ega javobi KI-S1): kuryerning «Oldi-berdi» qatorlarida o'z javobi — «Siz tasdiqlagansiz» / «Siz: noto'g'ri» (courier-cashbox-my-transfers-ack; telefon kartasida «Qabul qildi» → izoh → belgi oxirida), market/menejer ko'rinishida — «Kuryer tasdiqladi» / «Kuryer: noto'g'ri»; javobni kuryerning o'zi botda beradi, izoh hozir faqat tooltip (telefonda ko'rinmaydi — ega savoli). Kuryer tafsilot oynasi (courier-cashbox-history-detail) ayni FinanceHistoryDetailPopup — «Kvitansiya javobi» qatori manager-payments-history-detail-dialog-ack dagidek, matni kuryerga «Siz …».

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/cash-box` | manager | — Maket yo'q. Ayni komponent menejerga filial kassasini ko'rsatadi, lekin menyudagi «To'lovlar» bandi /payments ga olib boradi (HQ · REGIONAL · HYBRID; PICKUP menejerida bu band yo'q, sahifa faqat URL orqali). Eng yaqin maket — market-cashbox-my (ayni tuzilma) va manager-payments-cash-detail-branch. | — | — | v2 |
| `/cash-box` | market | `market-cashbox-my` — Market kassasi | [design/fragments/market--cashbox-my.html](fragments/market--cashbox-my.html) | sahifa | v2 |
| `/cash-box` | market | `market-cashbox-history-detail-dialog` — Tranzaksiya tafsiloti<br>↳ `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | [design/fragments/market--cashbox-history-detail-dialog.html](fragments/market--cashbox-history-detail-dialog.html) | oyna | v2 |
| `/cash-box` | market | `market-cashbox-history-detail-dialog-corrected` — Tranzaksiya tafsiloti · tahrirlangan to'lov (sabab bilan) | [design/fragments/market--cashbox-history-detail-dialog-corrected.html](fragments/market--cashbox-history-detail-dialog-corrected.html) | oyna | yangi (kodda yo'q) |
| `/cash-box` | market | `market-cashbox-my-corrected` — Market kassasi · tahrirlangan to'lov belgilari | [design/fragments/market--cashbox-my-corrected.html](fragments/market--cashbox-my-corrected.html) | sahifa | yangi (kodda yo'q) |
| `/cash-box` | market_operator | — Yo'q — market_operator'da kassa va to'lovlar bo'limi yo'q (menyuda emas, finance ruxsati yo'q); o'z hisobi — «Daromadim» (/my-earnings, MO-2). | — | — | v2 |
| `/cash-box` | courier | `courier-cashbox-my-all` — Kassa — Barcha tarix | [design/fragments/courier--cashbox-my-all.html](fragments/courier--cashbox-my-all.html) | sahifa | v2 |
| `/cash-box` | courier | `courier-cashbox-my-transfers` — Kassa — Oldi-berdi | [design/fragments/courier--cashbox-my-transfers.html](fragments/courier--cashbox-my-transfers.html) | sahifa | v2 |
| `/cash-box` | courier | `courier-cashbox-history-detail` — Tranzaksiya tafsiloti<br>↳ `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | [design/fragments/courier--cashbox-history-detail.html](fragments/courier--cashbox-history-detail.html) | oyna | v2 |
| `/cash-box` | courier | `courier-cashbox-my-transfers-ack` — Kassa — Oldi-berdi · kvitansiya javobi<br>↳ `src/pages/payments/components/MyCashboxPage.tsx`, `src/pages/payments/components/PaymentAckBadge.tsx` | [design/fragments/courier--cashbox-my-transfers-ack.html](fragments/courier--cashbox-my-transfers-ack.html) | sahifa | v2 |
| `/cash-box` | courier | `courier-cashbox-history-detail-corrected` — Tranzaksiya tafsiloti · qaytarilgan to'lov (sabab bilan) | [design/fragments/courier--cashbox-history-detail-corrected.html](fragments/courier--cashbox-history-detail-corrected.html) | oyna | yangi (kodda yo'q) |
| `/cash-box` | courier | `courier-cashbox-my-transfers-corrected` — Kassa — Oldi-berdi · qaytarilgan to'lov belgilari | [design/fragments/courier--cashbox-my-transfers-corrected.html](fragments/courier--cashbox-my-transfers-corrected.html) | sahifa | yangi (kodda yo'q) |

#### `/my-earnings` — Daromadim — market operatorining komissiya hisobi (MO-2)

- **Fayllar:** `src/pages/my-earnings/index.tsx` · `src/pages/my-earnings/lib/operatorRate.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewMyEarnings` (access.ts → canViewMyEarnings)
- **Rollar:** market_operator (MO-2: canViewMyEarnings = hasRole('market_operator') (access.ts))
- **Menyuda:** «Daromadim» (`earnings`) — market_operator
- **Holat:** v2
- **Izoh:** Ega qarori 2026-10-19: market_operator «Daromadim» oladi. MO-2 (2026-10-21) — kodda: «Stavkam» kartasi — GET auth/my-profile (findOwnProfile → sanitize(user): commission_type percent|fixed, commission_value numeric(14,2) — son yoki matn); qiymat, «Turi» (Foiz · Qat'iy summa), «Belgilaydi: Market egasi» (profil faqat market_id qaytaradi, market nomi yo'q — N13, shuning uchun nom yozilmadi), «Namuna» 250 000 so'm → daromad (foiz — butun so'mga yaxlitlangan, qat'iy — qiymatning o'zi), izoh «Stavka o'zgarsa, faqat keyingi sotuvlarga qo'llanadi» (backend daromad qatoriga stavkani yozib qo'yadi). commission_type null YOKI commission_value 0/yo'q (backend recordOperatorEarning — daromad yozilmaydi) — earnings-no-commission: ogohlantirish «Komissiya belgilanmagan — daromad yozilmaydi», «Belgilanmagan» belgisi, «Turi —». Yuklanish — karta skeleti, xato — karta ichida ErrorState + «Qayta urinish». Yolg'iz karta max-w-xl (maketda qatorning 1/3 qismi). TAKLIF · BACKEND KERAK (maketda badge bilan, chizilmadi): «Hisob» (Qoldiq · Daromad · To'langan), «To'lovlar», «Daromadlar» — GET finance/operators/:operator_id/{balance,earnings,payments} faqat @Roles(SUPERADMIN, ADMIN, MANAGER), market_operator 403 oladi, /me ko'rinishi yo'q (E6iEOAVs → MO-6). Kerak: GET finance/operators/me/{balance,earnings,payments} (operator_id = token sub). Maydonlar mavjud: balance → { earned, paid, balance }; earnings → { rows: [order_id, amount, commission_type, commission_value, order_total_price, createdAt], total, limit, offset }; payments → { rows: [amount, note, createdAt], total }. «82 ta sotilgan buyurtmadan» = earnings.total, «Oxirgisi: …» = payments.rows[0].createdAt. Atamalar: Qoldiq · Daromad · To'langan (ru: Остаток · Доход · Выплачено; en: Balance · Earned · Paid). Daromad summasi neytral matn, ishora «+» bilan (yashil emas). Bo'sh holatlar «Hali to'lov yo'q», «Hali daromad yo'q» — MO-6.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/my-earnings` | market_operator | `market_operator-earnings` — Daromadim | [design/fragments/market_operator--earnings.html](fragments/market_operator--earnings.html) | sahifa | qisman |
| `/my-earnings` | market_operator | `market_operator-earnings-no-commission` — Daromadim — komissiya belgilanmagan | [design/fragments/market_operator--earnings-no-commission.html](fragments/market_operator--earnings-no-commission.html) | sahifa | qisman |

#### `/financial-balance` — Balans — Umumiy · Tarix · Tahlil · AI xarajat

- **Fayllar:** `src/pages/financial-balance/index.tsx` · `src/pages/financial-balance/components/Statistics.tsx` · `src/pages/financial-balance/components/HistoryTab.tsx` · `src/pages/financial-balance/components/LedgerBalanceCard.tsx` · `src/pages/financial-balance/components/AnalysisTab.tsx` · `src/pages/financial-balance/components/DailyLedgerCard.tsx` · `src/pages/financial-balance/components/AiCostTab.tsx` · `src/pages/financial-balance/components/LedgerFlow.tsx` · `src/pages/financial-balance/components/SettlementRanks.tsx` · `src/pages/financial-balance/components/FinancialEntryModal.tsx` · `src/pages/financial-balance/components/FinancialHistoryDetail.tsx` · `src/pages/financial-balance/lib/financialBalance.ts` · `src/pages/financial-balance/lib/analytics.ts` · `src/pages/financial-balance/lib/manualEntry.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewFinancialBalance` (access.ts → canViewFinancialBalance)
- **Rollar:** superadmin, admin
- **Menyuda:** «Balans» (`balance`) — superadmin, admin
- **Holat:** v2
- **Izoh:** Tab URL'da: ?tab= (Umumiy ko'rinish · Tarix · Tahlil · AI xarajat). «AI xarajat» (?tab=ai, Celz3rKJ) — karta matni bo'yicha Balans ichida tab (maketda yo'q, dizayn ziddiyati — ega tasdig'i kutiladi; eng yaqini balance-analysis + tizim-charts): GET /ai-usage/dashboard (KPI so'm + USD, kunlik trend Toshkent kuni bo'yicha StackedBars + «Grafik | Jadval», buyurtma manbasi AI / qo'lda / bot / tashqi / filial SegBar, funksiya jadvali, model hbar) va GET /ai-usage/ai-orders («AI buyurtmalar», raqam → /orders/edit/:id); davr — «Bugun · Bu hafta · Bu oy · 30 kun» + sana oralig'i (sukut 30 kun); telefonda jadvallar kartalar. «Excelga yuklash» va «Yozuv qo'shish» sarlavhada, har tabda; Excel faol tab paramlari bilan. Tahlil davri «Bugun / Bu hafta / Bu oy / Barchasi» (spec §10 Q7); eng katta ta'sirli tranzaksiyalar server sahifalashida (top-impacts limit ≤ 100); o'tgan davrda waterfall davr boshi/«Hozir» ustunlarisiz (currentBalance — bugungi qoldiq). Qo'lda yozuvga alohida tasdiq yo'q (Q5c — oynaning o'zi «Balansga ta'siri» bilan). KPI delta/sparkline, «Daftar qoldig'i», «Kunlik kirim va chiqim» va o'tgan davr sharsharasi boshi — GET finance/financial-balance/daily (qzjTMWPb).

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

#### `/payments/shifts/:id` — Smena hisoboti — naqd, kartalar bo'yicha qoldiq va AI tekshiruvi

- **Fayllar:** `src/pages/payments/shiftReport/index.tsx` · `src/pages/payments/shiftReport/ReportDeliveries.tsx` · `src/pages/payments/components/shiftCheck/aiStatus.tsx` · `src/pages/payments/components/shiftCheck/aiStatusMeta.ts`
- **Qobiq:** DashboardLayout · **Guard:** `isPaymentsManager` (access.ts → canViewPaymentsPage) · ruxsat bo'lmasa → `canOpenCashbox ? "/cash-box" : "/403"`
- **Rollar:** superadmin, admin, manager (HQ · REGIONAL · HYBRID)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Trello 2026-10-23 (ega topshirig'i): 2-, 3-, 11-bandlar; kiZgTybn (2026-10-26). Manba — GET finance/shift/:id/report (superadmin/admin/menejer — o'z filiali; registrator — asosiy kassa): KPI (ochilish · kirim · chiqim · yopilish · farq), «Naqd», «Kartalar va hisob raqamlar» (tizim bo'yicha, kiritilgan, rasm — 300 s imzolangan havola, AI natija + «Kiritilgan ≠ rasm», farq, izoh; telefonda kartalar), «Operatsiyalar xulosasi» (tur × to'lov usuli). Ochiq smenada ham ishlaydi (info banner). Kirish — smena natija oynasidagi «Smena hisoboti» (kartalar tekshirilgan smenada). y8Tqm9Ap / gWI4gYkw (2026-10-26): avtomatik yopilgan smenada sariq «Avtomatik yopildi — HH:MM, kassir yopmagan» banneri (close_reason=auto); faqat superadmin — sarlavhada hisobot fayli (PDF / «Excelga yuklash», report.file_url 300 s) va «Hisobotni qayta yuborish» (tasdiq bilan, POST finance/shift/:id/report/resend), «Hisobot kimlarga yuborildi» kartasi (deliveries[] oxirgi raund: qabul qiluvchi turi × Telegram / tizim, «Telegram ulanmagan» sababi). Bildirishnoma havolasi /payments/shift-report/:id → shu sahifaga yo'naltiriladi. «Vaqt chizig'i» — backend bermaydi, chizilmaydi. Tarix ro'yxati /payments/shifts (alohida maket chizilmagan) — kodda yo'q.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/payments/shifts/:id` | superadmin | `superadmin-payments-shift-report` — Smena hisoboti — kartalar, AI tekshiruvi, avtomatik yopilish | [design/fragments/superadmin--payments-shift-report.html](fragments/superadmin--payments-shift-report.html) | sahifa | v2 |
| `/payments/shifts/:id` | admin | — Maket yo'q — eng yaqini: superadmin-payments-shift-report (ayni sahifa, «Sozlamalar» tugmasisiz) | — | — | v2 |
| `/payments/shifts/:id` | manager | — Maket yo'q — eng yaqini: superadmin-payments-shift-report (o'z filiali kassasi smenasi, «Sozlamalar» tugmasisiz) | — | — | v2 |

#### `/payments/shift-settings` — Kassa smenasi sozlamalari — kartalar qoldig'ini tasdiqlash, rasm, AI (faqat superadmin)

- **Fayllar:** `src/pages/payments/shiftSettings/index.tsx` · `src/pages/payments/shiftSettings/AutomationCards.tsx` · `src/pages/payments/shiftSettings/CellSwitch.tsx` · `src/pages/payments/shiftSettings/settingsDiff.ts` · `src/pages/settings/ui/settingsUi.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canManageShiftSettings` (access.ts → canManageShiftSettings (kiZgTybn; backend PATCH finance/shift/settings @Roles(SUPERADMIN)))
- **Rollar:** superadmin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Trello 2026-10-23 (ega topshirig'i): 2-, 3-, 11-bandlar; kiZgTybn (2026-10-26). Faqat SUPERADMIN (canManageShiftSettings = backend PATCH finance/shift/settings @Roles(SUPERADMIN)). GET finance/shift/settings → global kalitlar + asosiy kassa kartalari; «Saqlash» faqat o'zgargan maydonlarni yuboradi; karta rasmi o'chsa AI ham o'chadi (AI faqat rasm talab qilingan kartada — backend 400). Kirish — smena yopish oynasidagi va smena hisobotidagi «Sozlamalar». y8Tqm9Ap / gWI4gYkw (2026-10-26): «Avtomatik yopish» (kalit, kuniga yopish vaqtlari — Toshkent HH:MM, 1–12 ta; «Qaysi kassalarda» — backend scope: faqat asosiy kassa | asosiy + filiallar, maketdagi har kassa belgisi o'rniga ikki variant; yopishdan N daqiqa oldin ogohlantirish, 0 — o'chiq) va «Smena hisobotini yuborish» (superadmin / kuryerlar / marketlar × Telegram / tizim, ilova formati PDF | Excel) — o'sha «Saqlash» bilan (PATCH auto_close / report, faqat o'zgarganlar); javobda auto_close / report bo'lmasa (eski backend) chizilmaydi.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/payments/shift-settings` | superadmin | `superadmin-payments-shift-settings` — Kassa smenasi sozlamalari — rasm, AI, avtomatik yopish, hisobot | [design/fragments/superadmin--payments-shift-settings.html](fragments/superadmin--payments-shift-settings.html) | sahifa | v2 |
| `/payments/shift-settings` | superadmin | `superadmin-payments-shift-settings-correction` — Kassa smenasi sozlamalari · to'lovlarni tuzatish muddati (7 · 10 · 30 · Boshqa) | [design/fragments/superadmin--payments-shift-settings-correction.html](fragments/superadmin--payments-shift-settings-correction.html) | sahifa | yangi (kodda yo'q) |
| `/payments/shift-settings` | superadmin | `superadmin-payments-shift-settings-receipts` — Kassa smenasi sozlamalari · «Chek rasmi va AI tahlili» kartasi | [design/fragments/superadmin--payments-shift-settings-receipts.html](fragments/superadmin--payments-shift-settings-receipts.html) | sahifa | qisman |
| `/payments/shift-settings` | superadmin | `superadmin-payments-shift-settings-receipts-photo-off-confirm` — Chek rasmini o'chirish — tasdiq | [design/fragments/superadmin--payments-shift-settings-receipts-photo-off-confirm.html](fragments/superadmin--payments-shift-settings-receipts-photo-off-confirm.html) | oyna | qisman |

#### `(taklif) /ai-assistant` — AI moliyaviy yordamchi (taklif — kodda yo'q)

- **Fayllar:** 
- **Rollar:** superadmin, admin, manager, registrator, market, market_operator, courier, logist, investor
- **Holat:** eski
- **Izoh:** Trello 2026-10-23 (ega topshirig'i): 9-band. SUPERADMIN doim; ADMIN — superadmin ruxsat bersa (menyu bandi ham shunda). Faqat o'qiydi.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `(taklif) /ai-assistant` | superadmin | `superadmin-ai-assistant` — AI moliyaviy yordamchi | [design/fragments/superadmin--ai-assistant.html](fragments/superadmin--ai-assistant.html) | sahifa | yangi (kodda yo'q) |
| `(taklif) /ai-assistant` | superadmin | `superadmin-ai-assistant-access-dialog` — AI yordamchi — kirish huquqi (popup) | [design/fragments/superadmin--ai-assistant-access-dialog.html](fragments/superadmin--ai-assistant-access-dialog.html) | oyna | yangi (kodda yo'q) |
| `(taklif) /ai-assistant` | admin | — maket yo'q — docs/DESIGN_SYSTEM.md va eng yaqin maket asos | — | — | eski |
| `(taklif) /ai-assistant` | manager | — maket yo'q — docs/DESIGN_SYSTEM.md va eng yaqin maket asos | — | — | eski |
| `(taklif) /ai-assistant` | registrator | — maket yo'q — docs/DESIGN_SYSTEM.md va eng yaqin maket asos | — | — | eski |
| `(taklif) /ai-assistant` | market | — maket yo'q — docs/DESIGN_SYSTEM.md va eng yaqin maket asos | — | — | eski |
| `(taklif) /ai-assistant` | market_operator | — maket yo'q — docs/DESIGN_SYSTEM.md va eng yaqin maket asos | — | — | eski |
| `(taklif) /ai-assistant` | courier | — maket yo'q — docs/DESIGN_SYSTEM.md va eng yaqin maket asos | — | — | eski |
| `(taklif) /ai-assistant` | logist | — maket yo'q — docs/DESIGN_SYSTEM.md va eng yaqin maket asos | — | — | eski |
| `(taklif) /ai-assistant` | investor | — maket yo'q — docs/DESIGN_SYSTEM.md va eng yaqin maket asos | — | — | eski |

### Mahsulotlar

#### `/products` — Mahsulotlar ro'yxati (xodim: tahrirlash, o'chirish, yaratish uchun market tanlash; market va market operatori — faqat ko'rish; dizayn v2)

- **Fayllar:** `src/pages/products/list/index.tsx` · `src/pages/products/list/ui/SelectMarketDialog.tsx` · `src/pages/products/list/ui/EditProductDialog.tsx` · `src/pages/products/ui/useDeleteProductConfirm.tsx` · `src/pages/products/ui/ProductImageField.tsx` · `src/pages/products/ui/ProductPriceField.tsx` · `src/pages/products/ui/ProductMeasureFields.tsx` · `src/pages/products/ui/ProductMeasureCells.tsx` · `src/pages/products/ui/FormErrorSummary.tsx` · `src/pages/products/ui/ProductCodeSection.tsx` · `src/pages/products/model/productCode.ts` · `src/pages/products/model/productLabelPrint.ts` · `src/pages/products/warehouse-stock/MarketWarehouseStock.tsx` · `src/pages/products/warehouse-stock/MarketProductsTabs.tsx` · `src/entities/product/ui/ProductThumb.tsx` · `src/entities/delivery-pricing/ui/DeliveryQuoteList.tsx` · `src/entities/delivery-pricing/ui/MeasureWeights.tsx` · `src/entities/delivery-pricing/ui/VolumetricSwitch.tsx` · `src/pages/products/model/productView.ts` · `src/pages/products/model/productMeasure.ts` · `src/pages/products/model/productErrors.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewProducts` (access.ts → canViewProducts)
- **Rollar:** superadmin, admin, manager, registrator, market (faqat ko'rish), market_operator (faqat ko'rish)
- **Menyuda:** «Mahsulotlar» (`products`) — superadmin, admin, manager, registrator, market, market_operator
- **Holat:** v2
- **Izoh:** Market va market operatorida GET product/my-products (search/page/limit), xodimda GET product + market filtri (URL market_id). Ro'yxat so'rovlari entities/product hook'lari (keepPreviousData, silentError). «Narx» ustuni (price, zRqDRLAZ; narxsiz — «—»), planshetda (< 1024) «Market» ustuni yashirin — market nomi mahsulot nomi ostida Store bilan (MH-1). O'lchov ustunlari (6FLyjO6j, backend MH-3 / 9fHyFp3y): «Og'irlik» va «O'lcham, sm» (planshetda yashirin), «Hisob vazni» (qalin + og'irlik bo'yicha / hajm bo'yicha / hajm hisobga olinmaydi; formula — U×K×B/5000, 0,1 kg yuqoriga), o'lchovsiz eski mahsulot — «Kiritilmagan» (warning); telefon kartasida narx ostida; market va operatorda ham. Tahrirlash oynasi — yaratish sahifasi bilan AYNI o'lchov maydonlari (ProductMeasureFields), narx — uchta katak; PATCH faqat o'zgargan o'lchovni yuboradi (U/K/B uchalasi birga). «Taklif · backend kerak» belgisi va uning izoh qatori — faqat maket annotatsiyasi. yXC91RRx: tahrirlash oynasida «Mahsulot kodi» (products-edit-dialog-barcode) — «Shtrix kod (EAN-13)» (USB skaner Enter'i formani saqlamaydi; raqamli kodda uzunlik va nazorat raqami tekshiriladi; o'zgarsa FormData `barcode`, 409 «shtrix kod» — maydon ostida), «Elchi kodi» (sku_code, faqat o'qish + «Nusxalash»), 40×30 stiker ko'rinishi, «Soni» va «QR stiker chop etish» (40×30 · 58×40 mm — tizim-product-labels; brauzer chop etish oynasi, @page stiker o'lchamida, QR V1-Q logosiz). Market — «Mahsulotlar | Ombordagi qoldiq» tablari, ikkinchisi `/products?view=warehouse` (products-warehouse-stock; GET /market/warehouse-stock; market operatorida yo'q — maket faqat marketda). XtcEyQjb: market operatori «Mahsulotlar | Ombordagi qoldiq» tablarini faqat my-profile.can_view_warehouse_stock === true bo'lsa ko'radi (market har operatorga /market-operators da yoqadi); keyin o'chirilsa GET market/warehouse-stock → 403 WAREHOUSE_STOCK_FORBIDDEN — «Ombordagi qoldiq siz uchun yopiq» (maket yo'q — eng yaqini market-products-warehouse-stock, tizim-errors 403). Pa1KaXmj: «Ombordagi qoldiq» da Markaziy ombor (kind HQ) ustuni birinchi, nomi «Markaziy ombor»; u bo'lsa «Faqat ko'rish» izohida vaqtinchalik qator «Markaziy ombor qoldig'i buyurtmalarga keyingi bosqichda ulanadi — hozircha undan buyurtma ketmaydi» (FE-2 da olinadi; maket yo'q — eng yaqini market-products-warehouse-stock).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/products` | superadmin | `superadmin-products-list` — Mahsulotlar ro'yxati | [design/fragments/superadmin--products-list.html](fragments/superadmin--products-list.html) | sahifa | v2 |
| `/products` | superadmin | `superadmin-products-select-market-dialog` — Mahsulot yaratish — market tanlash<br>↳ `src/pages/products/list/ui/SelectMarketDialog.tsx` | [design/fragments/superadmin--products-select-market-dialog.html](fragments/superadmin--products-select-market-dialog.html) | oyna | v2 |
| `/products` | superadmin | `superadmin-products-edit-dialog` — Mahsulotni tahrirlash (popup)<br>↳ `src/pages/products/list/ui/EditProductDialog.tsx` | [design/fragments/superadmin--products-edit-dialog.html](fragments/superadmin--products-edit-dialog.html) | oyna | v2 |
| `/products` | superadmin | `superadmin-products-delete-dialog` — Mahsulotni o'chirish<br>↳ `src/pages/products/ui/useDeleteProductConfirm.tsx` | [design/fragments/superadmin--products-delete-dialog.html](fragments/superadmin--products-delete-dialog.html) | oyna | v2 |
| `/products` | superadmin | `superadmin-products-edit-dialog-barcode` — Mahsulotni tahrirlash — shtrix kod va QR stiker (popup) | [design/fragments/superadmin--products-edit-dialog-barcode.html](fragments/superadmin--products-edit-dialog-barcode.html) | oyna | v2 |
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
| `/products` | market | `market-products-warehouse-stock` — Mahsulotlar — omborlardagi qoldiq | [design/fragments/market--products-warehouse-stock.html](fragments/market--products-warehouse-stock.html) | sahifa | v2 |
| `/products` | market_operator | `market_operator-products-list` — Mahsulotlar | [design/fragments/market--products-list.html](fragments/market--products-list.html) | sahifa | v2 |
| `/products` | market_operator | `market_operator-products-unassigned` — Mahsulotlar — market biriktirilmagan | [design/fragments/market_operator--products-unassigned.html](fragments/market_operator--products-unassigned.html) | sahifa | v2 |

#### `/products/create-product/:id` — Mahsulot yaratish (:id — market; dizayn v2)

- **Fayllar:** `src/pages/products/create/index.tsx` · `src/pages/products/ui/ProductImageField.tsx` · `src/pages/products/ui/ProductPriceField.tsx` · `src/pages/products/ui/ProductMeasureFields.tsx` · `src/pages/products/ui/ProductMeasureCells.tsx` · `src/pages/products/model/productMeasure.ts` · `src/entities/delivery-pricing/ui/DeliveryQuoteList.tsx` · `src/entities/delivery-pricing/ui/MeasureWeights.tsx` · `src/entities/delivery-pricing/ui/VolumetricSwitch.tsx` · `src/pages/products/ui/FormErrorSummary.tsx` · `src/entities/product/ui/ProductThumb.tsx` · `src/pages/products/ui/useDeleteProductConfirm.tsx` · `src/pages/products/model/productErrors.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canCreateProducts` (access.ts → canCreateProducts)
- **Rollar:** superadmin, admin, manager, registrator
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** O'ngdagi «Market mahsulotlari» ro'yxati bitta so'rovda (limit 500 — PRODUCT_LIST_MAX_LIMIT), «Narx» ustuni bilan; qalam — forma tahrir rejimi; nofaol market — yaratish bloklanadi. «Narx» maydoni (MH-1): ixtiyoriy, TextInput mode=money, bo'sh — null; tahrirda faqat o'zgargan bo'lsa yuboriladi. «Og'irlik va o'lcham» (6FLyjO6j, backend MH-3): og'irlik (kg, 0,1…1000, ≤ 3 kasr) + U × K × B (butun sm, 1…1000) MAJBURIY, forma darajasida tekshiriladi (backend 400 ga tushmaydi; xato matni i18n kaliti — til almashsa yangilanadi); «Hajmga qarab hisoblash» sukut yoqiq (o'chiq — maydonlar bloklanmaydi, izoh); jonli «Hajmli vazn» / «Hisob vazni»; «Taxminiy yetkazish narxi» — POST /delivery/quote/by-tariff (~400 ms kutish, faqat o'lchov to'g'ri bo'lsa; xato — «Narxni hisoblab bo'lmadi», forma ishlaydi); izohdagi chegara va yaxlitlash — superadmin/admin'da GET /delivery/pricing-settings dan, boshqa rolda qisqa izoh. Ro'yxat «Mahsulot nomi · hisob vazni». Maketdagi «Taklif» belgisi kodga ko'chirilmaydi. products-create-errors — «Saqlash» bosilgandan keyingi holat; tahrirlash oynasi (products-edit-dialog) xatolari shu bilan bir xil (maydon ostida qizil matn, yuqorida xulosa). «Taklif · backend kerak» belgisi kodga ko'chirilmaydi.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/products/create-product/:id` | superadmin | `superadmin-products-create` — Mahsulot yaratish (market uchun) | [design/fragments/superadmin--products-create.html](fragments/superadmin--products-create.html) | sahifa | v2 |
| `/products/create-product/:id` | superadmin | `superadmin-products-create-errors` — Mahsulot yaratish — xatolar | [design/fragments/admin--products-create-errors.html](fragments/admin--products-create-errors.html) | sahifa | qisman |
| `/products/create-product/:id` | admin | `admin-products-create` — Mahsulot yaratish | [design/fragments/admin--products-create.html](fragments/admin--products-create.html) | sahifa | v2 |
| `/products/create-product/:id` | admin | `admin-products-create-errors` — Mahsulot yaratish — xatolar | [design/fragments/admin--products-create-errors.html](fragments/admin--products-create-errors.html) | sahifa | qisman |
| `/products/create-product/:id` | manager | `manager-products-create` — Mahsulot yaratish | [design/fragments/admin--products-create.html](fragments/admin--products-create.html) | sahifa | v2 |
| `/products/create-product/:id` | manager | `manager-products-create-errors` — Mahsulot yaratish — xatolar | [design/fragments/admin--products-create-errors.html](fragments/admin--products-create-errors.html) | sahifa | qisman |
| `/products/create-product/:id` | registrator | `registrator-products-create` — Mahsulot yaratish | [design/fragments/admin--products-create.html](fragments/admin--products-create.html) | sahifa | v2 |
| `/products/create-product/:id` | registrator | `registrator-products-create-errors` — Mahsulot yaratish — xatolar | [design/fragments/admin--products-create-errors.html](fragments/admin--products-create-errors.html) | sahifa | qisman |
| `/products/create-product/:id` | market | — Yaratish yo'q — faqat ko'rish (ega qarori 2026-10-15); guard canCreateProducts marketni o'tkazmaydi (MH-1). | — | — | v2 |

#### `/warehouses` — Omborlar — vaqtinchalik ombor tizimi (superadmin, admin; menejer — o'z omboriga yo'naltiriladi)

- **Fayllar:** `src/pages/warehouses/index.tsx` · `src/pages/warehouses/ui/WarehouseListView.tsx` · `src/pages/warehouses/ui/WarehousesTable.tsx` · `src/pages/warehouses/ui/CreateWarehouseDialog.tsx` · `src/pages/warehouses/ui/ManagerWarehouseRedirect.tsx` · `src/pages/warehouses/ui/NoteAlert.tsx` · `src/entities/warehouse/ui/WarehouseBadges.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewWarehouses` (access.ts → canViewWarehouses)
- **Rollar:** superadmin, admin, manager (REGIONAL · HYBRID — o'z filiali ombori, faqat ko'rish (yXC91RRx); menyu bandi faqat GET /warehouses bo'sh bo'lmasa (XtcEyQjb)), registrator (hamma omborlar, faqat ko'rish (XtcEyQjb, ega 2026-10-24); menyuda yo'q — maket roles.json registrator.menu da «warehouse» yo'q (ega qarori kutilmoqda))
- **Menyuda:** «Ombor» (`warehouse`) — superadmin, admin, manager (REGIONAL · HYBRID), registrator
- **Holat:** v2
- **Izoh:** Trello yXC91RRx (backend hY7uacJu / Elchi-Backend#566), ega qarorlari TafZHzCD. GET /warehouses?status&region_id&search&page&limit → KPI (summary — filtrsiz), «Barchasi · Faol · To'xtatilgan» (counts — viloyat/qidiruvdan keyin), «Viloyat:» (GET /region). «Ombor ochish» — filial: GET /branches/dispatch-destinations (faol REGIONAL/HYBRID, menejeri bilan) minus mavjud omborlar; nom «<filial> ombori» taklifi; mas'ul — filial menejeri (o'qish); POST /warehouses, 409 — «Bu filialda ombor allaqachon bor». Ochilgach — tafsilotga o'tadi. Farq: maketdagi «Ombor ↑↓» saralash tugmasi yo'q (API'da saralash parametri yo'q). Pa1KaXmj — Markaziy ombor, 1-bosqich (maket yo'q — eng yaqini superadmin-warehouse-create-dialog / superadmin-warehouse-list): oynada filiallar = GET /branches/hq (SUPERADMIN, ADMIN; birinchi, «Markaziy ombor · <HQ nomi>»; 404 — HQ yo'q, 400 — eski backend: oyna avvalgidek; boshqa xato — «Filial» izohida «Markaziy ombor filialini (HQ) yuklab bo'lmadi …» + «Qayta urinish») + dispatch-destinations (REGIONAL/HYBRID), ombori bor filial chiqmaydi; HQ tanlansa nom «Markaziy ombor» (saqlanadigan nom — interfeys tilidan qat'i nazar, backend sukuti), «Mas'ul xodim» — faqat o'qiladigan «Belgilanmaydi» + «Markaziy omborda menejer yo'q — mas'ul belgilanmaydi», manager_user_id yuborilmaydi, «Ombor qanday ishlaydi» 2-bandi — buyurtmalarga keyingi bosqichda ulanadi. Ro'yxatda kind = HQ (yoki filial turi HQ) — qator tepada, nom yonida «Markaziy» (info Badge), «Viloyat» — HQ filialining viloyati (backend «Viloyat:» filtri ham shu bo'yicha; yo'q bo'lsa «—»); telefon kartasida ham.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/warehouses` | superadmin | `superadmin-warehouse-list` — Omborlar | [design/fragments/superadmin--warehouse-list.html](fragments/superadmin--warehouse-list.html) | sahifa | v2 |
| `/warehouses` | superadmin | `superadmin-warehouse-create-dialog` — Ombor ochish (popup) | [design/fragments/superadmin--warehouse-create-dialog.html](fragments/superadmin--warehouse-create-dialog.html) | oyna | v2 |
| `/warehouses` | admin | `admin-warehouse-list` — Omborlar | [design/fragments/superadmin--warehouse-list.html](fragments/superadmin--warehouse-list.html) | sahifa | v2 |
| `/warehouses` | admin | `admin-warehouse-create-dialog` — Ombor ochish (popup) | [design/fragments/superadmin--warehouse-create-dialog.html](fragments/superadmin--warehouse-create-dialog.html) | oyna | v2 |
| `/warehouses` | manager | — Filial menejeri (REGIONAL/HYBRID, qobiliyat `warehouse`) — `/warehouses` uni o'z filiali omboriga (`/warehouses/:id`) olib boradi; filialda ombor yo'q — «Filialingizda ombor yo'q» (maket yo'q — eng yaqini manager-warehouse-detail). XtcEyQjb: menyu bandi faqat o'z filialida ombor bo'lsa (GET /warehouses?limit=1 bo'sh emas — navSections.ts). | — | — | v2 |
| `/warehouses` | registrator | — Maket yo'q — eng yaqini: superadmin-warehouse-list (XtcEyQjb: hamma omborlar, faqat ko'rish — «Ombor ochish» sarlavhada ham, bo'sh holatda ham yo'q). | — | — | v2 |

#### `/warehouses/:id` — Ombor tafsiloti — qoldiq, harakatlar, kirim, inventarizatsiya, to'xtatish (menejer — faqat ko'rish)

- **Fayllar:** `src/pages/warehouses/detail/index.tsx` · `src/pages/warehouses/detail/ui/WarehouseKpis.tsx` · `src/pages/warehouses/detail/ui/WarehouseActionsMenu.tsx` · `src/pages/warehouses/detail/ui/StockPanel.tsx` · `src/pages/warehouses/detail/ui/MovementsPanel.tsx` · `src/pages/warehouses/detail/ui/MovementItem.tsx` · `src/pages/warehouses/detail/ui/RecentMovementsCard.tsx` · `src/pages/warehouses/detail/ui/StockInDialog.tsx` · `src/pages/warehouses/detail/ui/ScanProductField.tsx` · `src/pages/warehouses/detail/ui/ScanLinesList.tsx` · `src/pages/warehouses/detail/ui/LinkBarcodeDialog.tsx` · `src/pages/warehouses/detail/ui/InventoryDialog.tsx` · `src/pages/warehouses/detail/ui/ThresholdDialog.tsx` · `src/pages/warehouses/detail/ui/OutgoingOrdersCard.tsx` · `src/entities/warehouse/ui/ProductCodeTag.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewWarehouses` (access.ts → canViewWarehouses)
- **Rollar:** superadmin, admin, manager (REGIONAL · HYBRID — o'z filiali ombori, faqat ko'rish (yXC91RRx); menyu bandi faqat GET /warehouses bo'sh bo'lmasa (XtcEyQjb)), registrator (hamma omborlar, faqat ko'rish (XtcEyQjb, ega 2026-10-24); menyuda yo'q — maket roles.json registrator.menu da «warehouse» yo'q (ega qarori kutilmoqda))
- **Menyuda:** yo'q — «Omborlar» qatori; menejerda — «Ombor» bandi
- **Holat:** v2
- **Izoh:** GET /warehouses/:id (KPI, movements_count); «Qoldiq» — GET …/stock?search&market_id&level&page&limit (facets → «Market:», «Holat:»; saralash serverda — mavjud o'sishi); «Harakatlar» — GET …/movements (to'liq jurnal + «Turi:» filtri; maket yo'q — qator ko'rinishi «Oxirgi harakatlar» dan); «Oxirgi harakatlar» — so'nggi 5 ta, «Barchasi» tabga o'tadi. Superadmin/admin: «Excelga yuklash» (GET …/export joriy filtrlar bilan; telefonda yashirin — maket), «Mahsulot qo'shish» — kirim oynasi: Ombor, Market, Mahsulot (USB skaner `useKeyboardScanner`; kamera — markaziy skaner `layer: dialog` maqsadi, faqat QR — ELC-P; nom qidiruvi GET /product), har kod GET …/lookup: bir nechta marketda — market tanlovi, zavod kodi topilmasa «Mahsulotga bog'lash» → PATCH /product/:id {barcode}; POST …/stock-in + Idempotency-Key (tarkib barmoq iziga bog'langan). ⋯ «Inventarizatsiya» (maket yo'q — eng yaqini warehouse-stock-in-dialog; sabab majburiy; POST …/inventory + Idempotency-Key), «Omborni to'xtatish / Qayta yoqish» (tasdiq). «Chegara» katagi bosiladi — «Kam qoldiq chegarasi» oynasi (PATCH …/stock/:productId; maketda tugma ko'rinmaydi — qo'shimcha). Farq: kirim qatoridagi «Mahsulotni tahrirlash» havolasi chizilmagan (o'lchovsiz — faqat ogohlantirish). XtcEyQjb: to'xtatilgan omborda «Mahsulot qo'shish» o'chiq + izoh «To'xtatilgan omborga kirim qilinmaydi — avval qayta yoqing» (kirim oynasida ham; 409 WAREHOUSE_PAUSED — shu matn). Registrator — amallarsiz. 6kHnNH9j: menejerda «Ombordan ketadigan buyurtmalar» kartasi (GET /orders?fulfillment_source=WAREHOUSE&status=received,waiting; chiplar «Kuryerga berilmagan» = received, «Kuryerda» = waiting; «Kuryerga biriktirish» → /dispatch). Farq: kuryer qatoridagi vaqt yo'q (javobda kuryerga berilgan vaqt yo'q). Pa1KaXmj (maket yo'q — eng yaqini superadmin-warehouse-detail): Markaziy omborda holat yonida «Markaziy», sarlavha ostida «Markaziy ombor · HQ» va «Mas'ul: belgilanmagan», vaqtinchalik izoh «Markaziy ombor qoldig'i buyurtmalarga keyingi bosqichda ulanadi» (FE-2 da olinadi); kirim, inventarizatsiya va to'xtatish — o'zgarishsiz.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/warehouses/:id` | superadmin | `superadmin-warehouse-detail` — Ombor tafsiloti — qoldiq va harakatlar | [design/fragments/superadmin--warehouse-detail.html](fragments/superadmin--warehouse-detail.html) | sahifa | v2 |
| `/warehouses/:id` | superadmin | `superadmin-warehouse-stock-in-dialog` — Omborga mahsulot qo'shish — kirim (popup) | [design/fragments/superadmin--warehouse-stock-in-dialog.html](fragments/superadmin--warehouse-stock-in-dialog.html) | oyna | v2 |
| `/warehouses/:id` | admin | `admin-warehouse-detail` — Ombor tafsiloti — qoldiq va harakatlar | [design/fragments/superadmin--warehouse-detail.html](fragments/superadmin--warehouse-detail.html) | sahifa | v2 |
| `/warehouses/:id` | admin | `admin-warehouse-stock-in-dialog` — Omborga mahsulot qo'shish — kirim (popup) | [design/fragments/superadmin--warehouse-stock-in-dialog.html](fragments/superadmin--warehouse-stock-in-dialog.html) | oyna | v2 |
| `/warehouses/:id` | manager | `manager-warehouse-detail` — Filial ombori — qoldiq va ombordan ketadigan buyurtmalar (faqat ko'rish) | [design/fragments/manager--warehouse-detail.html](fragments/manager--warehouse-detail.html) | sahifa | v2 |
| `/warehouses/:id` | registrator | — Maket yo'q — eng yaqini: superadmin-warehouse-detail (XtcEyQjb: amallarsiz — «← Omborlar», «Excelga yuklash», «Faqat ko'rish» izohi; kirim, inventarizatsiya, chegara, to'xtatish yo'q). | — | — | v2 |

### Foydalanuvchilar

#### `/all-users` — Foydalanuvchilar ro'yxati (dizayn v2)

- **Fayllar:** `src/pages/users/list/UserListPage.tsx` · `src/widgets/user-list/ui/UserListTable.tsx` · `src/widgets/user-list/ui/UserListKpi.tsx` · `src/widgets/user-list/ui/UserRowMenu.tsx` · `src/features/user/update-user/ui/UpdateUserModal.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canManageUsers` (access.ts → canViewUsers) → `canViewUsers` (access.ts → canViewUsers)
- **Rollar:** superadmin, admin, manager (filial turi aniq bo'lsa)
- **Menyuda:** «Foydalanuvchilar» (`users`) — superadmin, admin, manager (HQ · PICKUP · REGIONAL · HYBRID)
- **Holat:** v2
- **Izoh:** Tablar, qidiruv va holat — URL'da (role, search, status); menejerda amallar yo'q, GET branches so'ralmaydi. Chizilmaganlar (backend ro'yxatda superadmin va mijozni bermaydi, spec §6): KPI «shundan {n} ta mijoz», segbar «Mijozlar», tablar «Superadminlar», «Mijozlar». Ega savoli Q8 sukuti: sarlavha izohi maketdagidek («… va mijozlar hisoblarini boshqarish»). Ega tasdig'i 2026-10-19 (tg-link S4): «Telegram» ustuni va «Telegram boti: Barchasi · Ulangan · Ulanmagan» chiplari (*-users-list-telegram; superadmin va admin) — server filtri GET /users?telegram_linked=true|false (yA31z7Rr), URL kaliti telegram=linked|unlinked. 2CBnPAeg: menejer tablarida sonlar (manager-users-list) — meta.countsByRole (filial ko'lami, sahifalashdan oldin), «Barchasi» — meta.totalUsers; superadmin/admin maketida tab soni yo'q. FY-1: superadmin va admin — 9 ta rol tabi FY-S1 tartibida (eski «Operatorlar» olindi; admin maketida hali 7 tab — sukut: FY-S1 adminga ham), telefonda tablar o'rnida «Rol» Select (Xodimlar / Tashqi hisoblar, URL kaliti role); menejerda 4 tab o'zgarmagan; GET /users — bitta so'rov (market + marketing birlashtirish olindi).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/all-users` | superadmin | `superadmin-users-list` — Foydalanuvchilar ro'yxati | [design/fragments/superadmin--users-list.html](fragments/superadmin--users-list.html) | sahifa | v2 |
| `/all-users` | superadmin | `superadmin-users-delete-dialog` — Foydalanuvchini o'chirish (tasdiq)<br>↳ `src/widgets/user-list/ui/UserListTable.tsx` | [design/fragments/superadmin--users-delete-dialog.html](fragments/superadmin--users-delete-dialog.html) | oyna | v2 |
| `/all-users` | superadmin | `superadmin-users-list-roles` — Foydalanuvchilar — barcha rollar tablari (taklif) | [design/fragments/superadmin--users-list-roles.html](fragments/superadmin--users-list-roles.html) | sahifa | qisman |
| `/all-users` | superadmin | `superadmin-users-list-role-select` — Foydalanuvchilar — rol tanlash ro'yxati (telefon, taklif) | [design/fragments/superadmin--users-list-role-select.html](fragments/superadmin--users-list-role-select.html) | sahifa · faqat telefon | v2 |
| `/all-users` | superadmin | `superadmin-users-list-telegram` — Foydalanuvchilar ro'yxati — Telegram ustuni<br>↳ `src/widgets/user-list/ui/UserListTable.tsx` | [design/fragments/superadmin--users-list-telegram.html](fragments/superadmin--users-list-telegram.html) | sahifa | v2 |
| `/all-users` | superadmin | `superadmin-users-list-responsibles-entry` — Foydalanuvchilar ro'yxati — «Market mas'ullari» tugmasi | [design/fragments/superadmin--users-list-responsibles-entry.html](fragments/superadmin--users-list-responsibles-entry.html) | sahifa | yangi (kodda yo'q) |
| `/all-users` | superadmin | `superadmin-users-delete-dialog-responsible` — Foydalanuvchini o'chirish — N ta market sukutga o'tadi | [design/fragments/superadmin--users-delete-dialog-responsible.html](fragments/superadmin--users-delete-dialog-responsible.html) | oyna | yangi (kodda yo'q) |
| `/all-users` | admin | `admin-users-list` — Foydalanuvchilar ro'yxati | [design/fragments/superadmin--users-list.html](fragments/superadmin--users-list.html) | sahifa | v2 |
| `/all-users` | admin | `admin-users-delete-dialog` — Foydalanuvchini o'chirish<br>↳ `src/widgets/user-list/ui/UserListTable.tsx` | [design/fragments/admin--users-delete-dialog.html](fragments/admin--users-delete-dialog.html) | oyna | v2 |
| `/all-users` | admin | `admin-users-list-telegram` — Foydalanuvchilar ro'yxati — Telegram ustuni<br>↳ `src/widgets/user-list/ui/UserListTable.tsx` | [design/fragments/superadmin--users-list-telegram.html](fragments/superadmin--users-list-telegram.html) | sahifa | v2 |
| `/all-users` | admin | `admin-users-list-responsibles-entry` — Foydalanuvchilar ro'yxati — «Market mas'ullari» tugmasi | [design/fragments/superadmin--users-list-responsibles-entry.html](fragments/superadmin--users-list-responsibles-entry.html) | sahifa | yangi (kodda yo'q) |
| `/all-users` | admin | `admin-users-delete-dialog-responsible` — Foydalanuvchini o'chirish — N ta market sukutga o'tadi | [design/fragments/superadmin--users-delete-dialog-responsible.html](fragments/superadmin--users-delete-dialog-responsible.html) | oyna | yangi (kodda yo'q) |
| `/all-users` | manager | `manager-users-list` — Foydalanuvchilar (filial xodimlari) | [design/fragments/manager--users-list.html](fragments/manager--users-list.html) | sahifa | v2 |

#### `/all-users/create-user` — Foydalanuvchi yaratish (dizayn v2)

- **Fayllar:** `src/pages/users/create/CreateUserPage.tsx` · `src/features/user/create-user/ui/CreateUserForm.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canManageUsers` (access.ts → canViewUsers) → `canViewUsers` (access.ts → canViewUsers)
- **Rollar:** superadmin, admin, manager (filial turi aniq bo'lsa)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Menejer: oddiy filialda — kuryer; HYBRID filialda — rol tanlash (kuryer yoki registrator). «Logist» rol kartasi (superadmin, admin; users-create-logist; LG-2 — tartib Admin · Menejer · Ro'yxatchi · Logist · Kuryer · Market, ikonka Route, izoh «Buyurtmalar va holat tarixi, moliyasiz» — LG-S1; ?role=logist — shu rol tanlangan holda ochiladi): POST /logists (SUPERADMIN | ADMIN) — ism, telefon, parol, maosh, to'lov kuni; filial yo'q. Muvaffaqiyat → notify.success «Logist yaratildi» va /regions/logist-assignment?logist=<id> (yangi logist tanlangan). 409 «Bu telefon raqam allaqachon mavjud» — telefon maydoni ostida, forma saqlanib qoladi (server matni ko'rsatilmaydi; boshqa xato — «Logistni yaratib bo'lmadi»). Maosh majburiy (backend DTO), to'lov kuni ixtiyoriy. LG-2 tozalash: kuryer yaratishda region_id yuborilmaydi (gateway DTO'da yo'q) va «region_id bo'lmasa qayta yuborish» olib tashlandi. DtKKY0V8 (*-users-create-courier-district): kuryer «Ish hududi» — superadmin/admin: Filial (ixtiyoriy, faol HQ/REGIONAL/HYBRID, viloyatli; tanlanmasa — HQ, perqZ3oM) · Viloyat (filialdan, faqat o'qish) · Tuman (filial viloyati tumanlari, filialsiz — o'chiq); menejer: faqat Tuman (o'z filiali viloyati). POST /couriers { branch_id?, district_id? }; 400/503 tuman xatolari — maydon ostida va xabarda i18n matni.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/all-users/create-user` | superadmin | `superadmin-users-create` — Foydalanuvchi yaratish | [design/fragments/superadmin--users-create.html](fragments/superadmin--users-create.html) | sahifa | v2 |
| `/all-users/create-user` | superadmin | `superadmin-users-create-courier-district` — Yangi foydalanuvchi — Logist roli va kuryer «Ish hududi» (taklif) | [design/fragments/superadmin--users-create-courier-district.html](fragments/superadmin--users-create-courier-district.html) | sahifa | v2 |
| `/all-users/create-user` | superadmin | `superadmin-users-create-logist` — Foydalanuvchi yaratish — Logist | [design/fragments/superadmin--users-create-logist.html](fragments/superadmin--users-create-logist.html) | sahifa | v2 |
| `/all-users/create-user` | superadmin | `superadmin-users-create-password-sms` — Foydalanuvchi yaratish — parolni tizim yaratadi va SMS yuboradi | [design/fragments/superadmin--users-create-password-sms.html](fragments/superadmin--users-create-password-sms.html) | sahifa | v2 |
| `/all-users/create-user` | superadmin | `superadmin-users-create-password-result-dialog` — Foydalanuvchi yaratildi — parol SMS orqali yuborildi (popup) | [design/fragments/superadmin--users-create-password-result-dialog.html](fragments/superadmin--users-create-password-result-dialog.html) | oyna | v2 |
| `/all-users/create-user` | admin | `admin-users-create` — Yangi foydalanuvchi | [design/fragments/admin--users-create.html](fragments/admin--users-create.html) | sahifa | v2 |
| `/all-users/create-user` | admin | `admin-users-create-logist` — Foydalanuvchi yaratish — Logist | [design/fragments/superadmin--users-create-logist.html](fragments/superadmin--users-create-logist.html) | sahifa | v2 |
| `/all-users/create-user` | manager | `manager-users-create-courier` — Yangi xodim — kuryer | [design/fragments/manager--users-create-courier.html](fragments/manager--users-create-courier.html) | sahifa | v2 |
| `/all-users/create-user` | manager | `manager-users-create-hybrid` — Yangi xodim — Aralash filial (rol tanlash) | [design/fragments/manager--users-create-hybrid.html](fragments/manager--users-create-hybrid.html) | sahifa | v2 |
| `/all-users/create-user` | manager | `manager-users-create-courier-district` — Yangi xodim — kuryer, «Ish hududi» (taklif) | [design/fragments/manager--users-create-courier-district.html](fragments/manager--users-create-courier-district.html) | sahifa | v2 |

#### `/all-users/:id` — Foydalanuvchi tafsiloti (dizayn v2)

- **Fayllar:** `src/pages/users/detail/UserDetailPage.tsx` · `src/widgets/user-detail/ui/UserDetailView.tsx` · `src/widgets/user-detail/ui/MarketTelegramGroupsCard.tsx` · `src/widgets/user-detail/model/useMarketTelegramGroupPiiToggle.ts` · `src/features/telegram-link/ui/MarketGroupLinkDialog.tsx` · `src/features/telegram-link/ui/useMarketGroupLink.tsx` · `src/features/user/update-user/ui/UpdateUserModal.tsx` · `src/features/user/update-user/ui/WarehouseOrderSection.tsx` · `src/features/courier-transfer-branch/ui/TransferCourierButton.tsx` · `src/features/courier-transfer-branch/ui/TransferCourierModal.tsx` · `src/features/user/password-sms/ui/ResetPasswordSmsButton.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canManageUsers` (access.ts → canViewUsers) → `canViewUsers` (access.ts → canViewUsers)
- **Rollar:** superadmin, admin, manager (filial turi aniq bo'lsa)
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Yangi v2 UserDetailView (eski UserDetailWidget G2 da o'chirildi — iste'molchisi qolmadi). «Parolni tiklash va SMS yuborish» (xtXKLUwT; superadmin, admin, menejer — o'z kuryeri; maket yo'q — eng yaqini superadmin-users-create-password-result-dialog). «Faoliyat» (Taklif) chizilmaydi. Ega savoli Q9 sukuti: menejer xodimidagi «Oylik maosh» kartasi (to'plangan / kun qoldi) chizilmaydi — faqat «Profil ma'lumotlari»dagi maosh va to'lov kuni. Mijoz (customer) — maket yo'q, eng yaqini superadmin-users-detail. Ega tasdig'i 2026-10-19 (tg-link): market tafsilotida «Telegram guruhi» kartasi — har xabar turi qatorida to'g'ridan-to'g'ri «Ulash» (S5), bir martalik havola + QR oynasi, muddati tugasa — qayta yaratish (*-users-detail-telegram-group-dialog / -expired-dialog); admin ham ulaydi (S2); «Guruhda mijoz ismi va telefoni» kaliti shu kartaga ko'chadi (S3). TG-B (2026-10-21): MarketTelegramGroupsCard — superadmin va admin (GET /notifications?market_id: «Ulangan · {sana} dan» / «Nofaol» / «Ulanmagan» + «Ulash»), «Barcha guruhlar «Bildirishnomalar» bo'limida» (canViewNotifications), PII kaliti «Ruxsatlar»dan shu kartaga ko'chdi; menejer va ro'yxatchi kartani ko'rmaydi. Oyna — MarketGroupLinkDialog (har 4 s kuzatuv, guruh paydo bo'lsa — «Guruh ulandi»); buyruq rejimi — maket yo'q, naqsh common-profile-telegram-command-dialog.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/all-users/:id` | superadmin | `superadmin-users-detail` — Foydalanuvchi tafsilotlari | [design/fragments/superadmin--users-detail.html](fragments/superadmin--users-detail.html) | sahifa | qisman |
| `/all-users/:id` | superadmin | `superadmin-users-edit-dialog` — Foydalanuvchini tahrirlash (modal)<br>↳ `src/features/user/update-user/ui/UpdateUserModal.tsx` | [design/fragments/superadmin--users-edit-dialog.html](fragments/superadmin--users-edit-dialog.html) | oyna | qisman |
| `/all-users/:id` | superadmin | `superadmin-users-courier-transfer-dialog` — Kuryerni boshqa filialga o'tkazish<br>↳ `src/features/courier-transfer-branch/ui/TransferCourierModal.tsx` | [design/fragments/superadmin--users-courier-transfer-dialog.html](fragments/superadmin--users-courier-transfer-dialog.html) | oyna | v2 |
| `/all-users/:id` | superadmin | `superadmin-users-edit-role` — Foydalanuvchini tahrirlash — «Rol» maydoni (taklif)<br>↳ `src/features/user/change-role/ui/RoleSection.tsx` | [design/fragments/superadmin--users-edit-role.html](fragments/superadmin--users-edit-role.html) | oyna | v2 |
| `/all-users/:id` | superadmin | `superadmin-users-role-confirm-dialog` — Rolni o'zgartirish — tasdiq (taklif)<br>↳ `src/features/user/change-role/ui/roleChangeConfirm.tsx` | [design/fragments/superadmin--users-role-confirm-dialog.html](fragments/superadmin--users-role-confirm-dialog.html) | oyna | v2 |
| `/all-users/:id` | superadmin | `superadmin-users-role-confirm-logist` — Rolni o'zgartirish — Logist → Admin, viloyatlar bo'shatiladi (taklif)<br>↳ `src/features/user/change-role/ui/roleChangeConfirm.tsx` | [design/fragments/superadmin--users-role-confirm-logist.html](fragments/superadmin--users-role-confirm-logist.html) | oyna | v2 |
| `/all-users/:id` | superadmin | `superadmin-users-edit-role-error` — Foydalanuvchini tahrirlash — rol o'zgartirilmadi, 409 (taklif)<br>↳ `src/features/user/change-role/ui/RoleSection.tsx` | [design/fragments/superadmin--users-edit-role-error.html](fragments/superadmin--users-edit-role-error.html) | oyna | qisman |
| `/all-users/:id` | superadmin | `superadmin-users-edit-role-branch` — Foydalanuvchini tahrirlash — filialga biriktirilgan, rol qulf (taklif) | [design/fragments/superadmin--users-edit-role-branch.html](fragments/superadmin--users-edit-role-branch.html) | oyna | yangi (kodda yo'q) |
| `/all-users/:id` | superadmin | `superadmin-users-edit-courier-district` — Kuryerni tahrirlash — «Tuman» maydoni (taklif)<br>↳ `src/features/user/update-user/ui/UpdateUserModal.tsx` | [design/fragments/superadmin--users-edit-courier-district.html](fragments/superadmin--users-edit-courier-district.html) | oyna | qisman |
| `/all-users/:id` | superadmin | `superadmin-users-edit-courier-district-phone` — Kuryerni tahrirlash — «Tuman» ro'yxati, telefon (taklif) | [design/fragments/superadmin--users-edit-courier-district-phone.html](fragments/superadmin--users-edit-courier-district-phone.html) | oyna · faqat telefon | qisman |
| `/all-users/:id` | superadmin | `superadmin-users-edit-market-ai` — Marketni tahrirlash — «AI narxi (1 buyurtma)»<br>↳ `src/features/user/update-user/ui/UpdateUserModal.tsx` | [design/fragments/superadmin--users-edit-market-ai.html](fragments/superadmin--users-edit-market-ai.html) | oyna | qisman |
| `/all-users/:id` | superadmin | `superadmin-users-edit-market-ai-phone` — Marketni tahrirlash — «AI narxi», telefon<br>↳ `src/features/user/update-user/ui/UpdateUserModal.tsx` | [design/fragments/superadmin--users-edit-market-ai-phone.html](fragments/superadmin--users-edit-market-ai-phone.html) | oyna · faqat telefon | qisman |
| `/all-users/:id` | superadmin | `superadmin-users-detail-telegram` — Foydalanuvchi tafsilotlari — Telegram guruhi<br>↳ `src/widgets/user-detail/ui/MarketTelegramGroupsCard.tsx` | [design/fragments/superadmin--users-detail-telegram.html](fragments/superadmin--users-detail-telegram.html) | sahifa | qisman |
| `/all-users/:id` | superadmin | `superadmin-users-detail-telegram-group-dialog` — Telegram guruhini ulash (havola, QR)<br>↳ `src/features/telegram-link/ui/MarketGroupLinkDialog.tsx` | [design/fragments/superadmin--users-detail-telegram-group-dialog.html](fragments/superadmin--users-detail-telegram-group-dialog.html) | oyna | v2 |
| `/all-users/:id` | superadmin | `superadmin-users-detail-telegram-group-expired-dialog` — Telegram guruhini ulash — havola muddati tugadi<br>↳ `src/features/telegram-link/ui/MarketGroupLinkDialog.tsx` | [design/fragments/superadmin--users-detail-telegram-group-expired-dialog.html](fragments/superadmin--users-detail-telegram-group-expired-dialog.html) | oyna | v2 |
| `/all-users/:id` | superadmin | `superadmin-users-edit-market-warehouse` — Marketni tahrirlash — «Ombordan buyurtma yaratish» kaliti (popup) | [design/fragments/superadmin--users-edit-market-warehouse.html](fragments/superadmin--users-edit-market-warehouse.html) | oyna | v2 |
| `/all-users/:id` | superadmin | `superadmin-users-detail-market-responsible` — Market tafsiloti — «Elchi mas'uli» kartasi | [design/fragments/superadmin--users-detail-market-responsible.html](fragments/superadmin--users-detail-market-responsible.html) | sahifa | yangi (kodda yo'q) |
| `/all-users/:id` | superadmin | `superadmin-users-detail-market-responsible-dialog` — Market tafsiloti — mas'ulni o'zgartirish (oyna) | [design/fragments/superadmin--users-detail-market-responsible-dialog.html](fragments/superadmin--users-detail-market-responsible-dialog.html) | oyna | yangi (kodda yo'q) |
| `/all-users/:id` | superadmin | `superadmin-users-role-confirm-responsible` — Rolni o'zgartirish — Logist → Menejer, N ta market sukutga o'tadi | [design/fragments/superadmin--users-role-confirm-responsible.html](fragments/superadmin--users-role-confirm-responsible.html) | oyna | yangi (kodda yo'q) |
| `/all-users/:id` | admin | `admin-users-detail` — Foydalanuvchi tafsiloti | [design/fragments/admin--users-detail.html](fragments/admin--users-detail.html) | sahifa | qisman |
| `/all-users/:id` | admin | `admin-users-edit-dialog` — Foydalanuvchini tahrirlash<br>↳ `src/features/user/update-user/ui/UpdateUserModal.tsx` | [design/fragments/admin--users-edit-dialog.html](fragments/admin--users-edit-dialog.html) | oyna | qisman |
| `/all-users/:id` | admin | `admin-users-transfer-courier-dialog` — Kuryerni boshqa filialga o'tkazish<br>↳ `src/features/courier-transfer-branch/ui/TransferCourierModal.tsx` | [design/fragments/superadmin--users-courier-transfer-dialog.html](fragments/superadmin--users-courier-transfer-dialog.html) | oyna | v2 |
| `/all-users/:id` | admin | `admin-users-detail-telegram` — Foydalanuvchi tafsiloti — Telegram guruhi<br>↳ `src/widgets/user-detail/ui/MarketTelegramGroupsCard.tsx` | [design/fragments/admin--users-detail-telegram.html](fragments/admin--users-detail-telegram.html) | sahifa | qisman |
| `/all-users/:id` | admin | `admin-users-detail-telegram-group-dialog` — Telegram guruhini ulash (havola, QR)<br>↳ `src/features/telegram-link/ui/MarketGroupLinkDialog.tsx` | [design/fragments/admin--users-detail-telegram-group-dialog.html](fragments/admin--users-detail-telegram-group-dialog.html) | oyna | v2 |
| `/all-users/:id` | admin | `admin-users-detail-telegram-group-expired-dialog` — Telegram guruhini ulash — havola muddati tugadi<br>↳ `src/features/telegram-link/ui/MarketGroupLinkDialog.tsx` | [design/fragments/admin--users-detail-telegram-group-expired-dialog.html](fragments/admin--users-detail-telegram-group-expired-dialog.html) | oyna | v2 |
| `/all-users/:id` | admin | `admin-users-detail-market-responsible` — Market tafsiloti — «Elchi mas'uli» kartasi | [design/fragments/superadmin--users-detail-market-responsible.html](fragments/superadmin--users-detail-market-responsible.html) | sahifa | yangi (kodda yo'q) |
| `/all-users/:id` | admin | `admin-users-detail-market-responsible-dialog` — Market tafsiloti — mas'ulni o'zgartirish (oyna) | [design/fragments/superadmin--users-detail-market-responsible-dialog.html](fragments/superadmin--users-detail-market-responsible-dialog.html) | oyna | yangi (kodda yo'q) |
| `/all-users/:id` | manager | `manager-users-detail` — Xodim tafsiloti | [design/fragments/manager--users-detail.html](fragments/manager--users-detail.html) | sahifa | v2 |
| `/all-users/:id` | manager | `manager-users-edit-dialog` — Xodimni tahrirlash<br>↳ `src/features/user/update-user/ui/UpdateUserModal.tsx` | [design/fragments/manager--users-edit-dialog.html](fragments/manager--users-edit-dialog.html) | oyna | qisman |

#### `(taklif) /all-users/market-responsibles` — Market mas'ullari — sukut mas'ul, umumiy raqamlar, market ↔ mas'ul (taklif — kodda yo'q)

- **Fayllar:** 
- **Rollar:** superadmin, admin
- **Holat:** eski
- **Izoh:** T7 (eRhiuIVj) F4 — kodda yo'q: src/pages/users/market-responsibles/ (yangi), /all-users bolasi, alohida ProtectedRoute — faqat superadmin va admin (menejer — 403 ekrani). Kirish — /all-users sarlavhasidagi ikkilamchi «Market mas'ullari» tugmasi (menyu bandi yo'q). API: GET/PATCH /settings/contacts, GET /markets/responsibles, POST /markets/responsible/bulk, GET /markets?responsible_id=<id>|none. Mas'ul rollari: superadmin, admin, ro'yxatchi, logist. Route qo'shilganda yo'ldagi «(taklif) » olib tashlanadi va components to'ldiriladi.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `(taklif) /all-users/market-responsibles` | superadmin | `superadmin-users-market-responsibles` — Market mas'ullari | [design/fragments/superadmin--users-market-responsibles.html](fragments/superadmin--users-market-responsibles.html) | sahifa | yangi (kodda yo'q) |
| `(taklif) /all-users/market-responsibles` | superadmin | `superadmin-users-market-responsibles-empty` — Market mas'ullari — sukut va umumiy raqam belgilanmagan (birinchi sozlash) | [design/fragments/superadmin--users-market-responsibles-empty.html](fragments/superadmin--users-market-responsibles-empty.html) | sahifa | yangi (kodda yo'q) |
| `(taklif) /all-users/market-responsibles` | superadmin | `superadmin-users-market-responsibles-settings-confirm` — Market mas'ullari — sukut va umumiy raqamlarni saqlash (tasdiq) | [design/fragments/superadmin--users-market-responsibles-settings-confirm.html](fragments/superadmin--users-market-responsibles-settings-confirm.html) | oyna | yangi (kodda yo'q) |
| `(taklif) /all-users/market-responsibles` | superadmin | `superadmin-users-market-responsibles-move-confirm` — Market mas'ullari — boshqa xodimga o'tkazish (tasdiq, X → Y) | [design/fragments/superadmin--users-market-responsibles-move-confirm.html](fragments/superadmin--users-market-responsibles-move-confirm.html) | oyna | yangi (kodda yo'q) |
| `(taklif) /all-users/market-responsibles` | superadmin | `superadmin-users-market-responsibles-default-confirm` — Market mas'ullari — sukutga qaytarish (tasdiq) | [design/fragments/superadmin--users-market-responsibles-default-confirm.html](fragments/superadmin--users-market-responsibles-default-confirm.html) | oyna | yangi (kodda yo'q) |
| `(taklif) /all-users/market-responsibles` | admin | `admin-users-market-responsibles` — Market mas'ullari | [design/fragments/superadmin--users-market-responsibles.html](fragments/superadmin--users-market-responsibles.html) | sahifa | yangi (kodda yo'q) |
| `(taklif) /all-users/market-responsibles` | admin | `admin-users-market-responsibles-empty` — Market mas'ullari — sukut va umumiy raqam belgilanmagan (birinchi sozlash) | [design/fragments/superadmin--users-market-responsibles-empty.html](fragments/superadmin--users-market-responsibles-empty.html) | sahifa | yangi (kodda yo'q) |
| `(taklif) /all-users/market-responsibles` | admin | `admin-users-market-responsibles-settings-confirm` — Market mas'ullari — sukut va umumiy raqamlarni saqlash (tasdiq) | [design/fragments/superadmin--users-market-responsibles-settings-confirm.html](fragments/superadmin--users-market-responsibles-settings-confirm.html) | oyna | yangi (kodda yo'q) |
| `(taklif) /all-users/market-responsibles` | admin | `admin-users-market-responsibles-move-confirm` — Market mas'ullari — boshqa xodimga o'tkazish (tasdiq, X → Y) | [design/fragments/superadmin--users-market-responsibles-move-confirm.html](fragments/superadmin--users-market-responsibles-move-confirm.html) | oyna | yangi (kodda yo'q) |
| `(taklif) /all-users/market-responsibles` | admin | `admin-users-market-responsibles-default-confirm` — Market mas'ullari — sukutga qaytarish (tasdiq) | [design/fragments/superadmin--users-market-responsibles-default-confirm.html](fragments/superadmin--users-market-responsibles-default-confirm.html) | oyna | yangi (kodda yo'q) |

#### `/market-operators` — Operatorlar — market o'z operatorlarini boshqaradi (ega qarori 2026-10-19)

- **Fayllar:** `src/pages/market-operators/index.tsx` · `src/pages/market-operators/ui/WarehouseAccessSwitch.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewMarketOperators` (routes.tsx → canViewMarketOperators (doim false))
- **Rollar:** market (MO-1: canViewMarketOperators = hasRole('market') (access.ts); backend market-operators — @Roles(MARKET), faqat o'z operatorlari)
- **Menyuda:** «Operatorlar» (`operators`) — market
- **Holat:** v2
- **Izoh:** Dizayn v2 (MO-1, 2026-10-21). Backend (origin/main, market-operator-gateway.controller.ts, hammasi @Roles(MARKET), faqat o'z operatorlari, market_id yuborilmaydi — JWT sub): GET market-operators (search, status, page, limit ≤ 100 → { items, meta: { page, limit, total, totalPages } }; maydonlar: id, name, phone_number, status, commission_type, commission_value, createdAt), POST market-operators (name 2..100, phone_number, password — NDmZMzCP siyosati: ≥ 8 belgi, oddiy / ketma-ket / telefonga teng parol 400 — faqat 3 maydon, forbidNonWhitelisted), PATCH market-operators/:id/commission (percent 0..100 | fixed 0..1 000 000 so'm, 2 kasr; ikkalasi null — olib tashlash), DELETE market-operators/:id (soft). Ro'yxat: sarlavha + «Operator qo'shish», qidiruv (ism yoki telefon) + «Holat» (Barchasi · Faol · Nofaol), DataTable (Operator · Telefon · Komissiya — formatPercentLocalized / formatMoneyLocalized + izoh · Holat · Qo'shilgan · kebab), < 1024 Telefon va Qo'shilgan yashirin (telefon ism ostida), telefonda kartalar; pastda «N ta operator» yoki Pagination (jami > sahifa hajmi; 20 · 50 · 100). «N tasi faol» soni backendda yo'q — chizilmadi. Ogohlantirish «Komissiya belgilanmagan — daromad yozilmaydi» — joriy sahifa, faqat FAOL operatorlar (nofaol sotuv qilmaydi): 1 ta — ismi bilan + «Belgilash» (Komissiya oynasi); 2+ — «N ta operatorda …», ismlar (3 + «yana N ta») + «Faqat ularni ko'rsatish» ↔ «Hammasini ko'rsatish» (mijoz tomonda, backendda komissiya filtri yo'q). Bo'sh holat «Hali operator yo'q» (sarlavhada tugma, ogohlantirish va filtrlar yo'q — tugma bo'sh holat ichida); filtr bo'yicha topilmasa — «Operator topilmadi» + «Filtrlarni tozalash» (maket yo'q, eng yaqini superadmin-users-list). Qo'shish oynasi (ega MO-S5): ixtiyoriy «Komissiya» — avval POST (3 maydon), so'ng PATCH :id/commission; PATCH yiqilsa notify.error «Operator qo'shildi, komissiya saqlanmadi» + «Belgilash». 409 — telefon maydonida «Bu telefon raqam band», 403 — «Market bloklangan». Komissiya oynasi: belgilanmaganda ogohlantirish, belgilanganda «Hozirgi stavka» + «Komissiyani olib tashlash» (useConfirm danger: «Komissiyani olib tashlaysizmi?» → PATCH null); foizda «Namuna» (250 000 so'mlik sotuvdan), qat'iyda «Qanday hisoblanadi»; izoh «Yangi stavka faqat keyingi sotuvlarga …» ikkala turda (maketda faqat foizda). O'chirish — useConfirm (alertdialog, danger) + ob'ekt kartasi va izoh. Qator menyusi popover (telefonda ham, maketdagi aria-haspopup=menu; bandlar 44 px). TAKLIF · BACKEND KERAK (MO-4, mFkrqvMi): «Nofaol qilish / Faollashtirish» (operators-deactivate-dialog, operators-activate-dialog) — market uchun PATCH market-operators/:id/status yo'q; shungacha holat faqat o'qiladi. MO-5 (B3ZtzCCx): yaratishda komissiya bitta atomar so'rov. XtcEyQjb (maket yo'q — eng yaqini operators-list qatori + superadmin-users-edit-market-warehouse kaliti): «Ombordagi qoldiq» ustuni — «Ombordagi qoldiqni ko'radi» kaliti (PATCH market-operators/:id/warehouse-access, optimistik emas: javobgacha eski holat va spinner, xato — o'zgarmaydi + i18n xabar, 404 — ro'yxat yangilanadi); telefonda kartaning pastki qatori.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/market-operators` | market | `market-operators-list` — Operatorlar | [design/fragments/market--operators-list.html](fragments/market--operators-list.html) | sahifa | v2 |
| `/market-operators` | market | `market-operators-empty` — Operatorlar — bo'sh holat | [design/fragments/market--operators-empty.html](fragments/market--operators-empty.html) | sahifa | v2 |
| `/market-operators` | market | `market-operators-create-dialog` — Operator qo'shish<br>↳ `src/pages/market-operators/ui/CreateOperatorDialog.tsx` | [design/fragments/market--operators-create-dialog.html](fragments/market--operators-create-dialog.html) | oyna | v2 |
| `/market-operators` | market | `market-operators-commission-dialog` — Komissiya<br>↳ `src/pages/market-operators/ui/CommissionDialog.tsx` | [design/fragments/market--operators-commission-dialog.html](fragments/market--operators-commission-dialog.html) | oyna | v2 |
| `/market-operators` | market | `market-operators-commission-fixed-dialog` — Komissiya — qat'iy summa, xato<br>↳ `src/pages/market-operators/ui/CommissionDialog.tsx` | [design/fragments/market--operators-commission-fixed-dialog.html](fragments/market--operators-commission-fixed-dialog.html) | oyna | v2 |
| `/market-operators` | market | `market-operators-delete-dialog` — Operatorni o'chirish<br>↳ `src/pages/market-operators/ui/useDeleteOperatorConfirm.tsx` | [design/fragments/market--operators-delete-dialog.html](fragments/market--operators-delete-dialog.html) | oyna | v2 |
| `/market-operators` | market | `market-operators-deactivate-dialog` — Operatorni nofaol qilish | [design/fragments/market--operators-deactivate-dialog.html](fragments/market--operators-deactivate-dialog.html) | oyna | yangi (kodda yo'q) |
| `/market-operators` | market | `market-operators-activate-dialog` — Operatorni faollashtirish | [design/fragments/market--operators-activate-dialog.html](fragments/market--operators-activate-dialog.html) | oyna | yangi (kodda yo'q) |

### Hududlar

#### `/regions` — Hududlar — xarita va statistika (menejer/kuryer: o'z viloyati; logist: o'z viloyatlari, pulsiz; dizayn v2)

- **Fayllar:** `src/pages/region/index.tsx` · `src/pages/region/ui/RegionsOverview.tsx` · `src/pages/region/ui/RegionsMapCard.tsx` · `src/pages/region/ui/RegionsSuccessCards.tsx` · `src/pages/region/ui/UzbekistanRegionMap.tsx` · `src/pages/region/ui/RegionPeriodControls.tsx` · `src/pages/region/ui/regionBlocks.tsx` · `src/pages/region/ui/ScopedRegionView.tsx` · `src/pages/region/ui/ScopedDistricts.tsx` · `src/pages/region/ui/LogistRegionView.tsx` · `src/pages/region/ui/LogistRegionCouriers.tsx` · `src/pages/region/model/regionsModel.ts` · `src/pages/region/model/scopedModel.ts` · `src/pages/region/model/logistRegionModel.ts` · `src/pages/region/model/regionPeriod.ts` · `src/widgets/region-detail/ui/RegionDetailDialog.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewRegionStats` (routes.tsx → canViewRegionStats)
- **Rollar:** superadmin, admin, manager, courier, logist (taklif — o'z viloyatlari (LG-S3), kodda yo'q)
- **Menyuda:** «Hududlar» (`regions`) — superadmin, admin, manager, courier, logist
- **Holat:** v2
- **Izoh:** Viloyat oynasi — umumiy RegionDetailDialog (widgets/region-detail, lazy; bosh sahifa kartogrammasi ham shu). Menejer va kuryer — GET region/my/district-stats (stats/all va orders so'rovlari yo'q). Ega savollari sukuti: Q11 xarita — Highcharts lazy, v2 tokenlar; Q12 (aLx7Di99): my/district-stats raqamlari so'rovchi kesimida, sarlavha `data.scope` bo'yicha — menejer «{filial} buyurtmalari · …», kuryer «Faqat o'zingizga tegishli …» / «Sizga tegishli buyurtmalar»; scope yo'q (eski backend) — «{viloyat} buyurtmalari». Chizilmagan: oynadagi «Kunlik buyurtmalar» (Taklif).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/regions` | superadmin | `superadmin-regions-map` — Hududlar — xarita va statistika | [design/fragments/superadmin--regions-map.html](fragments/superadmin--regions-map.html) | sahifa | v2 |
| `/regions` | superadmin | `superadmin-regions-region-modal` — Viloyat ma'lumotlari (modal)<br>↳ `src/widgets/region-detail/ui/RegionDetailDialog.tsx` | [design/fragments/superadmin--regions-region-modal.html](fragments/superadmin--regions-region-modal.html) | oyna | v2 |
| `/regions` | admin | `admin-regions-map` — Hududlar xaritasi | [design/fragments/admin--regions-map.html](fragments/admin--regions-map.html) | sahifa | v2 |
| `/regions` | admin | `admin-regions-region-detail-dialog` — Viloyat ma'lumotlari oynasi<br>↳ `src/widgets/region-detail/ui/RegionDetailDialog.tsx` | [design/fragments/admin--regions-region-detail-dialog.html](fragments/admin--regions-region-detail-dialog.html) | oyna | v2 |
| `/regions` | manager | `manager-regions-scoped` — Hudud — tumanlar statistikasi<br>↳ `src/pages/region/ui/ScopedRegionView.tsx` | [design/fragments/manager--regions-scoped.html](fragments/manager--regions-scoped.html) | sahifa | v2 |
| `/regions` | courier | `courier-regions-scoped` — Hududlar — o'z viloyatim<br>↳ `src/pages/region/ui/ScopedRegionView.tsx` | [design/fragments/courier--regions-scoped.html](fragments/courier--regions-scoped.html) | sahifa | v2 |
| `/regions` | logist | `logist-regions-detail` — Viloyat — tumanlar va kuryerlar<br>↳ `src/pages/region/ui/LogistRegionView.tsx`, `src/pages/region/ui/LogistRegionCouriers.tsx` | [design/fragments/logist--regions-detail.html](fragments/logist--regions-detail.html) | sahifa | qisman |
| `/regions` | logist | `logist-couriers-list` — Kuryerlar — viloyatlarim | [design/fragments/logist--couriers-list.html](fragments/logist--couriers-list.html) | sahifa | yangi (kodda yo'q) |
| `/regions` | tizim taxtasi | `tizim-charts` — Grafiklar — statistika va tahlil | [design/fragments/tizim--charts.html](fragments/tizim--charts.html) | taxta | qoida |

#### `/regions/districts` — Tumanlar boshqaruvi

- **Fayllar:** `src/pages/region/pages/districts/index.tsx` · `src/pages/region/ui/DistrictBoard.tsx` · `src/pages/region/model/boardModel.ts` · `src/pages/region/ui/DistrictDeleteBlockedDialog.tsx` · `src/pages/region/ui/DistrictMergeDialog.tsx` · `src/pages/region/ui/useDistrictMerge.ts` · `src/pages/region/model/districtMerge.ts`
- **Qobiq:** DashboardLayout › Region (`src/pages/region/index.tsx`) · **Guard:** `canViewRegionStats` (routes.tsx → canViewRegionStats)
- **Rollar:** superadmin, admin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Ega qarori (2026-10-19): admin sahifada hamma amalni bajaradi — tuman qo'shish, tahrirlash, o'chirish, birlashtirish (backend POST/PATCH/DELETE district va POST district/:id/merge ga ADMIN ruxsat beradi; DM-1 da komponent guard'i superadmin + admin); admin kirishi — «Hududlar» sarlavhasidagi «Tumanlar» tugmasi. O'chirish 400 bersa (data.usage {orders, users, branches}) — «Tumanni o'chirib bo'lmaydi» oynasi; birlashtirish oynasi shu holatdan (va SATO sahifasidagi takroriy tumanlardan) ochiladi. Maqsad tuman — faqat shu viloyatdan (ega qarori). Birlashtirish so'rovi timeout'i ≥ 125 soniya (gateway 120 s; global API_TIMEOUT_MS emas). Natijadagi «Ko'chirildi» — faqat tirik yozuvlar (ega qarori; backend moved o'chirilganlarni ham sanaydi — tirik sonlar kerak). 409/503/chala qoldi — xato oynalari (DM-2, kodda): «Sabab» qatori data.reason / data.details kodi va sonlaridan (tf324cXN), backend matni ko'rsatilmaydi; «Bog'langan» — DELETE 400 data.usage, «… ko'chadi» / «Ko'chirilayotganlar» — GET district/:id/usage, «Ko'chirildi» — moved_live (vsmpTweI). Faoliyat jurnali: uz «Tuman birlashtirildi» / «Tuman birlashtirish chala qoldi», ru «Район объединён» / «Объединение района не завершено», en «District merged» / «District merge incomplete» (muvaffaqiyatli birlashtirish uchun alohida district.merge amali — backend kerak).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/regions/districts` | superadmin | `superadmin-regions-districts` — Tumanlar boshqaruvi<br>↳ `src/pages/region/pages/districts/index.tsx` | [design/fragments/superadmin--regions-districts.html](fragments/superadmin--regions-districts.html) | sahifa | v2 |
| `/regions/districts` | superadmin | `superadmin-regions-districts-delete-blocked` — Tumanni o'chirib bo'lmaydi<br>↳ `src/pages/region/ui/DistrictDeleteBlockedDialog.tsx` | [design/fragments/superadmin--regions-districts-delete-blocked.html](fragments/superadmin--regions-districts-delete-blocked.html) | oyna | v2 |
| `/regions/districts` | superadmin | `superadmin-regions-districts-merge-dialog` — Tumanni birlashtirish<br>↳ `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | [design/fragments/superadmin--regions-districts-merge-dialog.html](fragments/superadmin--regions-districts-merge-dialog.html) | oyna | v2 |
| `/regions/districts` | superadmin | `superadmin-regions-districts-merge-target` — Tumanni birlashtirish — maqsad tumanni tanlash<br>↳ `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | [design/fragments/superadmin--regions-districts-merge-target.html](fragments/superadmin--regions-districts-merge-target.html) | oyna | v2 |
| `/regions/districts` | superadmin | `superadmin-regions-districts-merge-progress` — Tumanni birlashtirish — jarayonda<br>↳ `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | [design/fragments/superadmin--regions-districts-merge-progress.html](fragments/superadmin--regions-districts-merge-progress.html) | oyna | v2 |
| `/regions/districts` | superadmin | `superadmin-regions-districts-merge-result` — Tumanni birlashtirish — natija<br>↳ `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | [design/fragments/superadmin--regions-districts-merge-result.html](fragments/superadmin--regions-districts-merge-result.html) | oyna | qisman |
| `/regions/districts` | superadmin | `superadmin-regions-districts-merge-error` — Tumanni birlashtirish — bekor qilindi<br>↳ `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | [design/fragments/superadmin--regions-districts-merge-error.html](fragments/superadmin--regions-districts-merge-error.html) | oyna | qisman |
| `/regions/districts` | superadmin | `superadmin-regions-districts-merge-error-unavailable` — Tumanni birlashtirish — servis javob bermadi<br>↳ `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | [design/fragments/superadmin--regions-districts-merge-error-unavailable.html](fragments/superadmin--regions-districts-merge-error-unavailable.html) | oyna | qisman |
| `/regions/districts` | superadmin | `superadmin-regions-districts-merge-error-manual` — Tumanni birlashtirish — qo'lda tuzatish kerak<br>↳ `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | [design/fragments/superadmin--regions-districts-merge-error-manual.html](fragments/superadmin--regions-districts-merge-error-manual.html) | oyna | qisman |
| `/regions/districts` | superadmin | `superadmin-regions-districts-merge-unknown` — Tumanni birlashtirish — natija noma'lum<br>↳ `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | [design/fragments/superadmin--regions-districts-merge-unknown.html](fragments/superadmin--regions-districts-merge-unknown.html) | oyna | qisman |
| `/regions/districts` | admin | `admin-regions-districts` — Tumanlar boshqaruvi | [design/fragments/superadmin--regions-districts.html](fragments/superadmin--regions-districts.html) | sahifa | v2 |
| `/regions/districts` | admin | `admin-regions-districts-delete-blocked` — Tumanni o'chirib bo'lmaydi<br>↳ `src/pages/region/ui/DistrictDeleteBlockedDialog.tsx` | [design/fragments/superadmin--regions-districts-delete-blocked.html](fragments/superadmin--regions-districts-delete-blocked.html) | oyna | v2 |
| `/regions/districts` | admin | `admin-regions-districts-merge-dialog` — Tumanni birlashtirish<br>↳ `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | [design/fragments/superadmin--regions-districts-merge-dialog.html](fragments/superadmin--regions-districts-merge-dialog.html) | oyna | v2 |
| `/regions/districts` | admin | `admin-regions-districts-merge-target` — Tumanni birlashtirish — maqsad tumanni tanlash<br>↳ `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | [design/fragments/superadmin--regions-districts-merge-target.html](fragments/superadmin--regions-districts-merge-target.html) | oyna | v2 |
| `/regions/districts` | admin | `admin-regions-districts-merge-progress` — Tumanni birlashtirish — jarayonda<br>↳ `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | [design/fragments/superadmin--regions-districts-merge-progress.html](fragments/superadmin--regions-districts-merge-progress.html) | oyna | v2 |
| `/regions/districts` | admin | `admin-regions-districts-merge-result` — Tumanni birlashtirish — natija<br>↳ `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | [design/fragments/superadmin--regions-districts-merge-result.html](fragments/superadmin--regions-districts-merge-result.html) | oyna | qisman |
| `/regions/districts` | admin | `admin-regions-districts-merge-error` — Tumanni birlashtirish — bekor qilindi<br>↳ `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | [design/fragments/superadmin--regions-districts-merge-error.html](fragments/superadmin--regions-districts-merge-error.html) | oyna | qisman |
| `/regions/districts` | admin | `admin-regions-districts-merge-error-unavailable` — Tumanni birlashtirish — servis javob bermadi<br>↳ `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | [design/fragments/superadmin--regions-districts-merge-error-unavailable.html](fragments/superadmin--regions-districts-merge-error-unavailable.html) | oyna | qisman |
| `/regions/districts` | admin | `admin-regions-districts-merge-error-manual` — Tumanni birlashtirish — qo'lda tuzatish kerak<br>↳ `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | [design/fragments/superadmin--regions-districts-merge-error-manual.html](fragments/superadmin--regions-districts-merge-error-manual.html) | oyna | qisman |
| `/regions/districts` | admin | `admin-regions-districts-merge-unknown` — Tumanni birlashtirish — natija noma'lum<br>↳ `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | [design/fragments/superadmin--regions-districts-merge-unknown.html](fragments/superadmin--regions-districts-merge-unknown.html) | oyna | qisman |

#### `/regions/sato-management` — Tumanlar va SATO kodlari

- **Fayllar:** `src/pages/region/pages/sato-management/index.tsx` · `src/pages/region/ui/DistrictBoard.tsx` · `src/pages/region/ui/MoveDistrictDialog.tsx` · `src/pages/region/model/boardModel.ts` · `src/pages/region/model/satoModel.ts` · `src/pages/region/ui/sato/SatoKpiRow.tsx` · `src/pages/region/ui/sato/SatoCodesPanel.tsx` · `src/pages/region/ui/sato/SatoCodesTable.tsx` · `src/pages/region/ui/sato/SatoCodeEditor.tsx` · `src/pages/region/ui/sato/useSatoCodeEditor.ts` · `src/pages/region/ui/sato/SatoApplyDialog.tsx` · `src/pages/region/ui/sato/SatoAddDistrictDialog.tsx` · `src/pages/region/ui/sato/SatoDuplicatesTable.tsx` · `src/pages/region/ui/sato/SatoMergeDialog.tsx` · `src/pages/region/ui/sato/useSatoMerge.ts` · `src/pages/region/ui/DistrictMergeDialog.tsx`
- **Qobiq:** DashboardLayout › Region (`src/pages/region/index.tsx`) · **Guard:** `canViewRegionStats` (routes.tsx → canViewRegionStats)
- **Rollar:** superadmin, admin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Komponent ichida: superadmin/admin bo'lmasa → /regions. Telefonda sudrash o'rniga ⇆ — MoveDistrictDialog (maket yo'q — eng yaqini superadmin-regions-sato-management). SA-1 (2xlYlBst, kodda): sahifada bitta sarlavha «Tumanlar va SATO kodlari» va ikki tab — «Tumanlarni o'tkazish» (sukut) va «SATO kodlari» (?tab=sato); tab almashsa faqat amallar joyi o'zgaradi (o'tkazishda — sonlar, SATO'da superadminga «SATO kodlarini yozish N», adminda amal yo'q). Superadmin: GET district/sato-match/preview (faqat superadmin) GET /district bilan dbId=id bo'yicha birlashtiriladi — nom, viloyat va sato_code /district dan olinadi, dbName satri parse qilinmaydi. KPI = preview.stats (totalDb, totalSato, matchedCount, unmatchedCount, duplicatesCount — yozuvlar soni, missingCount); «185 tasida kod bor» — «Kodi bor» tabi soni. Tablar saqlangan sato_code bo'yicha (/district), preview'dagi «(allaqachon mavjud)» matni bo'yicha EMAS (SA-1). Tablar (ega S2): «Topildi» = matched, /district da sato_code yo'q (yangi kod, hali saqlanmagan; sukut tab) va «Topilmadi» = unmatched, kodsiz (qo'lda kod) — ikki alohida tab; «Kodi bor» = /district da sato_code bor (takroriylar kirmaydi); «Takroriy nomlar» = duplicates[] (yozuvlar /district dan, sato_code ham); «Bazada yo'q» = missingSatoEntries. Qidiruv va viloyat filtri, sahifalash — klientda. «SATO kodlarini yozish N» (N = yangi kodli matched): N=0 bo'lsa tugma o'chiq; tasdiq oynasi → POST district/sato-match/apply (server qayta moslaydi; xabar appliedCount bilan; activity log logistics.sato_bulk_apply), bosilgach tugma «Yozilmoqda…», oyna yopilmaydi. SA-2 (kodda): oyna — Yoziladi (Topildi) / O'zgarmaydi (Kodi bor) / Yozilmaydi (Topilmadi + takroriy yozuvlar), birinchi 3 tuman + «yana N ta»; javobdan keyin preview va /district qayta yuklanadi, xabar shundan keyin. Server yozishni bo'laklab qiladi (tranzaksiyasiz, gateway 8 s) — xato yoki 504 bo'lsa ham ro'yxat qayta olinib haqiqiy holat aytiladi: hammasi yozilgan — «N ta tumanga SATO kodi yozildi», qisman — «Kodlar qisman yozildi», hech biri — «SATO kodlarini yozib bo'lmadi», ro'yxat ham kelmasa — «Natija noma'lum»; server matni ko'rsatilmaydi. Qo'lda kod: PATCH district/sato/:id {sato_code} (admin + superadmin); klientda faqat raqam (DTO ^\d+$); 409 «District sato_code already exists» kelsa, GET district/sato/:code bilan egasi olinib «Bu kod band: <tuman>, <viloyat>» ko'rsatiladi. «Tuman qo'shish» (Bazada yo'q) — POST /district {name, region_id, sato_code} oynasi qatordan to'ldiriladi (viloyat SATO nomi bo'yicha region_id ga moslanadi). SA-2 (kodda): viloyat — sato_code prefiksi (4 raqam) bo'yicha, zaxira — rasmiy viloyat nomi («Samarqand viloyati» = «Samarqand», «Toshkent sh.» ≠ «Toshkent viloyati»); shu viloyatda o'xshash nomli tuman bo'lsa (o'zak: «tumani», «sh.» tashlanadi) — «Bazada «X» bor … «<tab>» tabida unga kodni kiriting»; 409 — maydon xatolari (kod band: GET district/sato/:code egasi bilan; aks holda — «Bu viloyatda shu nomli tuman bor»), 404 — «Viloyat topilmadi»; kodsiz qo'shsa sato_code yuborilmaydi. Ochiq savol: Up9nDWCG («UI orqali qo'shmang — backend seed») va maketdagi «Tuman qo'shish» ziddiyati — roadmap sukuti bo'yicha oyna qilindi. Takroriylar (ega S4): «Takroriy nomlar» tabida bitta viloyatdagi guruh qatorida «Birlashtirish» — districts-merge to'plamidagi umumiy «Tumanni birlashtirish» oynasi (POST district/:id/merge {target_district_id}); sukut: kodsiz yozuv o'chadi, kodli yozuv maqsad (kod saqlanadi), maqsad faqat shu viloyatdan; jarayon/natija/xato holatlari — regions-districts-merge-* maketlari. SA-2 (kodda): guruh sarlavha qatorlari (nom, «N ta yozuv», viloyatlar), qidiruv/viloyat filtri guruh bo'yicha (birorta yozuvi mos kelsa — butun guruh), sahifalash guruhlar bilan; birlashtirilgach preview, /district, «Tumanlarni o'tkazish» taxtasi, tumanlar sahifasi, tuman katalogi va viloyat statistikasi qayta yuklanadi. Ikkala yozuvda kod bor yoki hech birida yo'q (maket yo'q, ochiq savol): sukut — maqsad eski yozuv (kichik ID), manba eng yangisi; manbada boshqa kod bo'lsa izohda «ID N yozuvidagi K kodi o'chadi». Aralash guruh (bir viloyatda ≥ 2 + boshqa viloyatda) — o'sha viloyat ichida birlashtiriladi. Turli viloyatdagi bir xil nomlar (preview duplicates viloyatsiz guruhlaydi) birlashtirilmaydi — «Turli viloyatda — birlashtirilmaydi», har biriga kod qo'lda. «Bazada yo'q» va «Takroriy nomlar» faqat superadmin (ega S3). Admin: preview/apply yo'q — ro'yxat GET /district dan, tablar «Kodsiz» va «Kodi bor» (takroriylar ham kiradi), faqat qo'lda kod; holatlar umumiy komponentdan (admin-regions-sato-codes «Boshqa holatlar»).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/regions/sato-management` | superadmin | `superadmin-regions-sato-management` — Tumanlarni o'tkazish (SATO) | [design/fragments/superadmin--regions-sato-management.html](fragments/superadmin--regions-sato-management.html) | sahifa | v2 |
| `/regions/sato-management` | superadmin | `superadmin-regions-sato-codes` — SATO kodlari — topildi<br>↳ `src/pages/region/ui/sato/SatoKpiRow.tsx`, `src/pages/region/ui/sato/SatoApplyDialog.tsx`, `src/pages/region/ui/sato/SatoCodesPanel.tsx`, `src/pages/region/ui/sato/SatoCodesTable.tsx`, `src/pages/region/model/satoModel.ts` | [design/fragments/superadmin--regions-sato-codes.html](fragments/superadmin--regions-sato-codes.html) | sahifa | v2 |
| `/regions/sato-management` | superadmin | `superadmin-regions-sato-codes-not-found` — SATO kodlari — topilmadi (qo'lda kiritish)<br>↳ `src/pages/region/ui/sato/SatoCodesTable.tsx`, `src/pages/region/ui/sato/SatoCodeEditor.tsx` | [design/fragments/superadmin--regions-sato-codes-not-found.html](fragments/superadmin--regions-sato-codes-not-found.html) | sahifa | v2 |
| `/regions/sato-management` | superadmin | `superadmin-regions-sato-codes-apply-dialog` — SATO kodlari — avtomatik yozish (tasdiq)<br>↳ `src/pages/region/ui/sato/SatoApplyDialog.tsx`, `src/pages/region/model/satoModel.ts` | [design/fragments/superadmin--regions-sato-codes-apply-dialog.html](fragments/superadmin--regions-sato-codes-apply-dialog.html) | oyna | v2 |
| `/regions/sato-management` | superadmin | `superadmin-regions-sato-codes-edit` — SATO kodlari — kodni tahrirlash («kod band»)<br>↳ `src/pages/region/ui/sato/SatoCodeEditor.tsx`, `src/pages/region/ui/sato/useSatoCodeEditor.ts` | [design/fragments/superadmin--regions-sato-codes-edit.html](fragments/superadmin--regions-sato-codes-edit.html) | sahifa | v2 |
| `/regions/sato-management` | superadmin | `superadmin-regions-sato-codes-duplicates` — SATO kodlari — takroriy nomlar<br>↳ `src/pages/region/ui/sato/SatoDuplicatesTable.tsx`, `src/pages/region/ui/sato/SatoCodesTable.tsx`, `src/pages/region/model/satoModel.ts` | [design/fragments/superadmin--regions-sato-codes-duplicates.html](fragments/superadmin--regions-sato-codes-duplicates.html) | sahifa | v2 |
| `/regions/sato-management` | superadmin | `superadmin-regions-sato-codes-merge-dialog` — SATO kodlari — takroriy tumanni birlashtirish<br>↳ `src/pages/region/ui/sato/SatoMergeDialog.tsx`, `src/pages/region/ui/sato/useSatoMerge.ts`, `src/pages/region/ui/DistrictMergeDialog.tsx` | [design/fragments/superadmin--regions-sato-codes-merge-dialog.html](fragments/superadmin--regions-sato-codes-merge-dialog.html) | oyna | qisman |
| `/regions/sato-management` | superadmin | `superadmin-regions-sato-codes-missing` — SATO kodlari — bazada yo'q<br>↳ `src/pages/region/ui/sato/SatoCodesPanel.tsx`, `src/pages/region/ui/sato/SatoCodesTable.tsx`, `src/pages/region/model/satoModel.ts` | [design/fragments/superadmin--regions-sato-codes-missing.html](fragments/superadmin--regions-sato-codes-missing.html) | sahifa | v2 |
| `/regions/sato-management` | superadmin | `superadmin-regions-sato-codes-add-dialog` — SATO kodlari — tuman qo'shish oynasi<br>↳ `src/pages/region/ui/sato/SatoAddDistrictDialog.tsx`, `src/pages/region/model/satoModel.ts` | [design/fragments/superadmin--regions-sato-codes-add-dialog.html](fragments/superadmin--regions-sato-codes-add-dialog.html) | oyna | v2 |
| `/regions/sato-management` | admin | `admin-regions-sato-management` — Tumanlarni o'tkazish | [design/fragments/admin--regions-sato-management.html](fragments/admin--regions-sato-management.html) | sahifa | v2 |
| `/regions/sato-management` | admin | `admin-regions-sato-codes` — SATO kodlari<br>↳ `src/pages/region/ui/sato/SatoCodesPanel.tsx`, `src/pages/region/ui/sato/SatoCodesTable.tsx`, `src/pages/region/model/satoModel.ts` | [design/fragments/admin--regions-sato-codes.html](fragments/admin--regions-sato-codes.html) | sahifa | v2 |
| `/regions/sato-management` | admin | `admin-regions-sato-codes-edit` — SATO kodlari — kodni tahrirlash («kod band»)<br>↳ `src/pages/region/ui/sato/SatoCodeEditor.tsx`, `src/pages/region/ui/sato/useSatoCodeEditor.ts` | [design/fragments/admin--regions-sato-codes-edit.html](fragments/admin--regions-sato-codes-edit.html) | sahifa | v2 |

#### `/regions/logist-assignment` — Logist biriktirish

- **Fayllar:** `src/pages/region/pages/logist-assignment/index.tsx` · `src/pages/region/pages/logist-assignment/model/assignment.ts` · `src/pages/region/pages/logist-assignment/ui/LogistListCard.tsx` · `src/pages/region/pages/logist-assignment/ui/LogistPicker.tsx` · `src/pages/region/pages/logist-assignment/ui/RegionChoiceCard.tsx` · `src/pages/region/pages/logist-assignment/ui/ChangesBar.tsx` · `src/pages/region/pages/logist-assignment/ui/ChangesList.tsx`
- **Qobiq:** DashboardLayout › Region (`src/pages/region/index.tsx`) · **Guard:** `canViewRegionStats` (routes.tsx → canViewRegionStats)
- **Rollar:** superadmin, admin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Komponent ichida: superadmin/admin bo'lmasa → /regions. Ma'lumot: chapda GET /logists (ism, telefon, faollik); viloyatlar — GET /region (har qatorda logist_id; logistdagi viloyatlar soni shundan). Saqlash — POST /region/logist/bulk { logist_id, region_ids } (region_ids dagilar unga o'tadi, ro'yxatda yo'q eski viloyatlaridan u olinadi). «Saqlash» o'zgarish bo'lmaguncha o'chiq. Tasdiq qoidasi: faqat qo'shish bo'lsa — darhol saqlanadi + notify.success «Saqlandi»; olib tashlash yoki boshqa logistdan o'tkazish bo'lsa — avval tasdiq oynasi (…-confirm-dialog, o'zgarishlar ro'yxati bilan). Saqlanmagan o'zgarish bor paytda boshqa logist tanlansa — useConfirm «O'zgarishlar saqlanmaydi» (Qolish / O'zgarishsiz o'tish). Nofaol logist tanlansa — ogohlantirish, viloyat kartalari va «Saqlash» o'chiq (server rad etishi — zaxira). Telefon: logist — Select (pastki varaqa, qidiruv), filtr seg 44px, o'zgarish bo'lsa pastki menyu ustida yopishqoq panel («N ta o'zgarish» + Bekor qilish / Saqlash). ?logist=<id> — shu logist tanlangan holda ochiladi. Logist yo'q — EmptyState «Logist yo'q» + «Logist yaratish» (…-empty). Eski «Bo'lim hali ishga tushmagan» bo'sh holati olib tashlandi (LG-2). LG-2 sukutlari: «Logist yaratish» → /all-users/create-user?role=logist; ro'yxat tartibi — faollari avval, so'ng ism; ?logist= yo'q yoki noma'lum — birinchi logist; viloyatlar — Toshkent sh., Toshkent vil., so'ng alifbo; «Logistsiz · N» — serverdagi holat, «Belgilangan · N» — joriy belgilar; saqlash xatosi — notify.error «Saqlab bo'lmadi» (400 → logist nofaol, 404 → topilmadi, qolgani — umumiy), qoralama sahifada qoladi; telefonda Select maydonida avatar yo'q (primitiv ikonka oladi, avatar emas).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/regions/logist-assignment` | superadmin | `superadmin-regions-logist-assignment` — Logist biriktirish | [design/fragments/superadmin--regions-logist-assignment.html](fragments/superadmin--regions-logist-assignment.html) | sahifa | v2 |
| `/regions/logist-assignment` | superadmin | `superadmin-regions-logist-assignment-confirm-dialog` — Logist biriktirish — saqlashni tasdiqlash<br>↳ `src/pages/region/pages/logist-assignment/ui/ChangesList.tsx` | [design/fragments/superadmin--regions-logist-assignment-confirm-dialog.html](fragments/superadmin--regions-logist-assignment-confirm-dialog.html) | oyna | v2 |
| `/regions/logist-assignment` | superadmin | `superadmin-regions-logist-assignment-empty` — Logist biriktirish — logist yo'q | [design/fragments/superadmin--regions-logist-assignment-empty.html](fragments/superadmin--regions-logist-assignment-empty.html) | sahifa | v2 |
| `/regions/logist-assignment` | admin | `admin-regions-logist-assignment` — Logist biriktirish | [design/fragments/superadmin--regions-logist-assignment.html](fragments/superadmin--regions-logist-assignment.html) | sahifa | v2 |
| `/regions/logist-assignment` | admin | `admin-regions-logist-assignment-confirm-dialog` — Logist biriktirish — saqlashni tasdiqlash<br>↳ `src/pages/region/pages/logist-assignment/ui/ChangesList.tsx` | [design/fragments/superadmin--regions-logist-assignment-confirm-dialog.html](fragments/superadmin--regions-logist-assignment-confirm-dialog.html) | oyna | v2 |
| `/regions/logist-assignment` | admin | `admin-regions-logist-assignment-empty` — Logist biriktirish — logist yo'q | [design/fragments/superadmin--regions-logist-assignment-empty.html](fragments/superadmin--regions-logist-assignment-empty.html) | sahifa | v2 |

#### `/delivery-tariffs` — Yetkazish tariflari — har kg narxi, qo'shimcha haq chegarasi, kalkulyator, tarix (superadmin, admin; dizayn v2)

- **Fayllar:** `src/pages/delivery-tariffs/index.tsx` · `src/pages/delivery-tariffs/ui/DeliveryTariffsContent.tsx` · `src/pages/delivery-tariffs/ui/TariffsCard.tsx` · `src/pages/delivery-tariffs/ui/TariffEditDialog.tsx` · `src/pages/delivery-tariffs/ui/PricingRulesCard.tsx` · `src/pages/delivery-tariffs/ui/PriceCalculatorCard.tsx` · `src/pages/delivery-tariffs/ui/TariffHistoryCard.tsx` · `src/pages/delivery-tariffs/ui/CardHead.tsx` · `src/pages/delivery-tariffs/model/tariffForm.ts` · `src/pages/delivery-tariffs/model/rulesForm.ts` · `src/pages/delivery-tariffs/model/history.ts` · `src/entities/delivery-pricing/ui/DeliveryQuoteList.tsx` · `src/entities/delivery-pricing/ui/MeasureWeights.tsx` · `src/entities/delivery-pricing/ui/VolumetricSwitch.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canManageDeliveryTariffs` (access.ts → canManageDeliveryTariffs)
- **Rollar:** superadmin, admin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** 47WFHzlx (backend DAqXPeSy). Guard canManageDeliveryTariffs — superadmin, admin (boshqa rol — 403; backend ham faqat SA/ADMIN). Kirish — «Hududlar» sarlavhasidagi «Yetkazish tariflari» tugmasi (regions-map maketida yo'q — karta talabi, qo'shni tugmalar naqshi). Tariflar: GET /delivery/tariffs (current + versions); «O'zgartirish» — POST /delivery/tariffs (yangi versiya; bugun — darhol, keyingi kun — valid_from 00:00 +05:00, rejalashtirilgan; namunaviy posilkalar 1,0 / 3,4 / 7,0 kg hozir → yangi — sozlama bilan klientda). Hisob qoidalari: GET/PATCH /delivery/pricing-settings (faqat o'zgargan maydonlar; first_kg_included — qo'shimcha haq chegarasi, jonli misol 3,4 kg «Markazgacha»; volumetric_divisor — faqat ko'rsatiladi). Kalkulyator: POST /delivery/quote/by-tariff. Tarix: versiyalar o'zaro solishtiriladi; muallif ismi (faqat created_by ID) va hisob qoidalari tarixi backend javobida yo'q — chizilmaydi (maketdagi «Asosiy narxga kiradigan og'irlik · 1,0 kg» qatori — faoliyat jurnalida). Saqlangach deliveryPricing keshi yangilanadi (jadval, tarix, kalkulyator). «Hajm bo'yicha hisoblash chegarasi» (ega 2026-10-25; maketda yo'q — eng yaqini shu kartaning maydon + «Misol» naqshi): volumetric_from_kg (kg, 0..1000, 3 kasr, sukut 0 — har doim hajm bo'yicha) — hajmli vazn chegaradan kichik bo'lsa standart narx (faqat og'irlik), chegaradan boshlab (≥) — hajm bo'yicha; maydon pickup qatoridan keyin, yonida jonli misol (20 × 20 × 20 sm, 0,5 kg va 50 × 35 × 20 sm, 0,8 kg); PATCH faqat o'zgarganda; tarixda «hajm bo'yicha hisoblash chegarasi 0 → 3 kg». Kalkulyator va mahsulot formasi «Hisob vazni» — server javobidan (volumetricApplied, volumetricFromKg; sozlamani o'qiy olmaydigan rolda ham), chegara tufayli hajm qo'llanmasa hajmli vazn chizilgan + «Chegara 3,0 kg dan kichik — narx og'irlik bo'yicha». Tanasi (DeliveryTariffsContent) Ops vositalari → «Yetkazish narxi» (/ops?tab=delivery-pricing) bilan umumiy.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/delivery-tariffs` | superadmin | `superadmin-regions-delivery-tariffs` — Yetkazish tariflari — har kg narxi, qo'shimcha haq chegarasi, kalkulyator | [design/fragments/superadmin--regions-delivery-tariffs.html](fragments/superadmin--regions-delivery-tariffs.html) | sahifa | v2 |
| `/delivery-tariffs` | superadmin | `superadmin-regions-delivery-tariff-edit-dialog` — Tarifni o'zgartirish — asosiy narx, har kg narxi, kuchga kirish sanasi (popup) | [design/fragments/superadmin--regions-delivery-tariff-edit-dialog.html](fragments/superadmin--regions-delivery-tariff-edit-dialog.html) | oyna | v2 |
| `/delivery-tariffs` | admin | `admin-regions-delivery-tariffs` — Yetkazish tariflari — har kg narxi, qo'shimcha haq chegarasi, kalkulyator | [design/fragments/superadmin--regions-delivery-tariffs.html](fragments/superadmin--regions-delivery-tariffs.html) | sahifa | v2 |
| `/delivery-tariffs` | admin | `admin-regions-delivery-tariff-edit-dialog` — Tarifni o'zgartirish (popup) | [design/fragments/superadmin--regions-delivery-tariff-edit-dialog.html](fragments/superadmin--regions-delivery-tariff-edit-dialog.html) | oyna | v2 |

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

- **Fayllar:** `src/pages/branches/ui/BranchDetailPage.tsx` · `src/pages/branches/ui/BranchMetricsSection.tsx` · `src/pages/branches/ui/BranchMetricsCards.tsx` · `src/widgets/branch-detail/ui/BranchDetailWidget.tsx` · `src/widgets/branch-detail/ui/BranchEmployeesSection.tsx` · `src/features/branch-add-employee/ui/AddEmployeeModal.tsx` · `src/features/branch-remove-employee/ui/RemoveEmployeeButton.tsx` · `src/features/courier-transfer-branch/ui/TransferCourierButton.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewBranches` (access.ts → canViewBranches)
- **Rollar:** superadmin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** 404 — sahifada «Filial topilmadi» (global xabar takrorlanmaydi). Q10 «Filial ko'rsatkichlari» (6CYRjoZG) — bitta GET analytics/dashboard?branch_id= so'rovidan: davr «Bugun · Bu hafta · Bu oy · Barchasi» (sukut «Bu hafta», ?period=), 4 KPI (Qabul qilingan, Sotilgan, Daromad, Sof foyda — oldingi teng davrga nisbatan delta «oldingi davrga / kechaga nisbatan», 14 kunlik sparkline — previous/series; «Barchasi»da yoki trend olinmasa chizilmaydi), «Muvaffaqiyat darajasi» (SuccessRateCard, oldingi davr nuqtasi), «Kunlik daromad» (dailyRevenue — tanlangan davr kunlari, Grafik | Jadval; oldingi davr chizig'i va «Kunlik · Haftalik · Oylik» chizilmaydi — filial kesimida API faqat joriy davr kunlarini beradi), «Buyurtmalar holati» (statusDistribution → Sotilgan · Yo'lda · Yangi · Bekor qilingan, «Ro'yxat ›» → /orders?orderBranchId=&startDay=&endDay=), «Kuryerlar reytingi» (topCouriers; «x / y faol» — branchDashboard bugun faol / filial kuryerlari; «Bugun»da reyting oxirgi 30 kun). Holatlar: skelet; xato yoki javobda branch_id yo'q — ErrorState + «Qayta urinish»; bo'sh davr — EmptyState; failed_parts — karta joyida xato; stats_unavailable — «x / y faol» yo'q. Q14 filial sozlamalari (config) — sahifada hech qachon chizilmagan, o'lik kod sifatida o'chirildi.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/branches/:id` | superadmin | `superadmin-branches-detail` — Filial tafsiloti | [design/fragments/superadmin--branches-detail.html](fragments/superadmin--branches-detail.html) | sahifa | v2 |
| `/branches/:id` | superadmin | `superadmin-branches-add-employee-dialog` — Xodim qo'shish (modal)<br>↳ `src/features/branch-add-employee/ui/AddEmployeeModal.tsx` | [design/fragments/superadmin--branches-add-employee-dialog.html](fragments/superadmin--branches-add-employee-dialog.html) | oyna | v2 |

### Integratsiyalar

#### `/integrations/connections` — Integratsiyalar konsoli — Hamkorlar · Tashqi tizimlar · Marketplace + ulanish panellari (dizayn v2)

- **Fayllar:** `src/pages/integrations/ConnectionsPage.tsx` · `src/pages/integrations/index.tsx` · `src/pages/integrations/useConnections.ts` · `src/pages/integrations/NewPartnerModal.tsx` · `src/pages/integrations/ConnectionFields.tsx` · `src/pages/integrations/StatusMapField.tsx` · `src/pages/integrations/panels/ConnectionOverview.tsx` · `src/pages/integrations/panels/ConnectionSettings.tsx` · `src/pages/integrations/panels/ConnectionShipments.tsx` · `src/pages/integrations/panels/ConnectionLog.tsx` · `src/pages/integrations/panels/ConnectionSettlement.tsx` · `src/pages/integrations/panels/ConnectionControl.tsx` · `src/pages/integrations/panels/ConnectionSecurity.tsx` · `src/pages/integrations/ui/index.ts` · `src/pages/integrations/ui/layout.tsx` · `src/pages/integrations/ui/charts.tsx` · `src/pages/integrations/ui/FilterChips.tsx` · `src/pages/integrations/ui/InlineAlert.tsx` · `src/pages/integrations/ui/inputs.tsx` · `src/pages/integrations/ui/Switch.tsx`
- **Qobiq:** DashboardLayout › IntegrationsPage (`src/pages/integrations/index.tsx`) · **Guard:** `canManageExternalIntegrations` (access.ts → canReceiveExternalOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator
- **Menyuda:** «Integratsiyalar» (`integrations`, `/integrations` orqali) — superadmin, admin
- **Holat:** v2
- **Izoh:** ?scope=partner|external|marketplace → *-console / admin-integrations-{partners,external,marketplace}; ?t=settings|shipments|log|settlement|control|security → panel maketlari (log = «Hodisalar»); ?t=overview (sukut) — konsol maketining o'zi. Dizayn v2 (G2): eski ui.ts / OverviewPage / ConnectionSubNav / FilterPills o'chirildi; scope tablari konsol kartasi ichida (D2, layout index.tsx faqat Outlet). KPI «kechaga nisbatan» — qo'shimcha GET integrations/metrics?hours=48 (kecha = 48 − 24 soat; ikkinchi so'rov yiqilsa meta qatori yashirinadi; ega savoli 8 — sukut: ha). Kalitni yangilash, to'xtatish va hisob-kitob to'lovi — tasdiq oynasi orqali. Chizilmagan (Taklif / API yo'q, spec §5): KPI sparklinelari, «Hodisalar · oxirgi 7 kun», «Soatlar bo'yicha», «O'rtacha javob vaqti» trendi (avg_ms — bitta son), «Qarz harakati · 30 kun». Sahifadagi xato holatlari global xabarni takrorlamaydi (meta.silentError). Hisob-kitob (DxdZFdIk, utIffRFx): «To'lov olindi» MAIN kassaga kirim yozadi (N3yNa6rO) — eski «Bu ekran kassa emas» matni o'chirildi; javobda cashbox_posted (false → «Kassaga yozilmadi» + «Asosiy kassa tarixini tekshiring»). «Olingan to'lovlar» (IS-3) — GET integrations/:id/remittances (status, from_date, to_date; sana, amount, settled_count/settled_amount, unapplied_amount, advance_applied, reference, note, status, cashbox_posted, cancel_reason); bekor qilish (IS-3) — POST integrations/:id/remittances/:rid/cancel (reason ≤ 500), reverse_cashbox faqat eski yozuvda (majburiy radio; aks holda 409). «Hozir bekor qilib bo'lmaydi» (avans keyingi to'lovda ishlatilgan) — frontda oldindan (hissa > hamkor avansi), 409 zaxira; 502 / kassa rad etsa — «Kassadan chiqim yozib bo'lmadi»; idempotent javob — «allaqachon bekor qilingan» xabari. 409/502 xom matni (faqat o'zbekcha) ko'rsatilmaydi. «Olingan to'lovlar» chiplarida o'z kaliti (remittances.filterAll «Barchasi»). Bekor qilingan eski yozuvda (cashbox_posted = null) kassa holati saqlanmaydi → «Kassa: eski yozuv». «Kim kiritdi / bekor qildi» ismi — Taklif · backend kerak (javobda faqat created_by / cancelled_by id; created_by_name / cancelled_by_name so'raladi). Ortiqcha summa — sukut A: backend ortig'ini hamkor avansiga o'tkazadi (bloklash — faqat ega savoli). Panelda «barchasi» chipi ikkala guruhda «Barchasi» (integrations.filterAll i18n almashadi). To'lov raqamlari «№82» ko'rinishida.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/integrations/connections` | superadmin | `superadmin-integrations-partners-console` — Integratsiyalar — Hamkorlar (konsol) | [design/fragments/superadmin--integrations-partners-console.html](fragments/superadmin--integrations-partners-console.html) | sahifa | v2 |
| `/integrations/connections` | superadmin | `superadmin-integrations-external-console` — Integratsiyalar — Tashqi tizimlar | [design/fragments/superadmin--integrations-external-console.html](fragments/superadmin--integrations-external-console.html) | sahifa | v2 |
| `/integrations/connections` | superadmin | `superadmin-integrations-marketplace-console` — Integratsiyalar — Marketplace | [design/fragments/superadmin--integrations-marketplace-console.html](fragments/superadmin--integrations-marketplace-console.html) | sahifa | v2 |
| `/integrations/connections` | superadmin | `superadmin-integrations-panel-settings` — Ulanish — Sozlamalar paneli<br>↳ `src/pages/integrations/panels/ConnectionSettings.tsx` | [design/fragments/superadmin--integrations-panel-settings.html](fragments/superadmin--integrations-panel-settings.html) | sahifa | v2 |
| `/integrations/connections` | superadmin | `superadmin-integrations-panel-shipments` — Ulanish — Posilkalar paneli<br>↳ `src/pages/integrations/panels/ConnectionShipments.tsx` | [design/fragments/superadmin--integrations-panel-shipments.html](fragments/superadmin--integrations-panel-shipments.html) | sahifa | v2 |
| `/integrations/connections` | superadmin | `superadmin-integrations-panel-events` — Ulanish — Hodisalar paneli<br>↳ `src/pages/integrations/panels/ConnectionLog.tsx` | [design/fragments/superadmin--integrations-panel-events.html](fragments/superadmin--integrations-panel-events.html) | sahifa | qisman |
| `/integrations/connections` | superadmin | `superadmin-integrations-panel-settlement` — Ulanish — Hisob-kitob paneli<br>↳ `src/pages/integrations/panels/ConnectionSettlement.tsx`, `src/pages/integrations/panels/settlement/RemittancesSection.tsx` | [design/fragments/superadmin--integrations-panel-settlement.html](fragments/superadmin--integrations-panel-settlement.html) | sahifa | qisman |
| `/integrations/connections` | superadmin | `superadmin-integrations-settlement-pay-dialog` — Tashuvchidan olingan to'lov (modal)<br>↳ `src/pages/integrations/panels/ConnectionSettlement.tsx` | [design/fragments/superadmin--integrations-settlement-pay-dialog.html](fragments/superadmin--integrations-settlement-pay-dialog.html) | oyna | v2 |
| `/integrations/connections` | superadmin | `superadmin-integrations-settlement-pay-overpay-dialog` — To'lov — ortiqcha summa (modal)<br>↳ `src/pages/integrations/panels/ConnectionSettlement.tsx` | [design/fragments/superadmin--integrations-settlement-pay-overpay-dialog.html](fragments/superadmin--integrations-settlement-pay-overpay-dialog.html) | oyna | v2 |
| `/integrations/connections` | superadmin | `superadmin-integrations-settlement-pay-result-dialog` — To'lov natijasi — avans va kassa (modal)<br>↳ `src/pages/integrations/panels/settlement/PayResultDialog.tsx` | [design/fragments/superadmin--integrations-settlement-pay-result-dialog.html](fragments/superadmin--integrations-settlement-pay-result-dialog.html) | oyna | qisman |
| `/integrations/connections` | superadmin | `superadmin-integrations-settlement-cancel-dialog` — To'lovni bekor qilish (tasdiq)<br>↳ `src/pages/integrations/panels/settlement/CancelRemittanceDialog.tsx` | [design/fragments/superadmin--integrations-settlement-cancel-dialog.html](fragments/superadmin--integrations-settlement-cancel-dialog.html) | oyna | v2 |
| `/integrations/connections` | superadmin | `superadmin-integrations-panel-control` — Ulanish — Ish rejimi paneli<br>↳ `src/pages/integrations/panels/ConnectionControl.tsx` | [design/fragments/superadmin--integrations-panel-control.html](fragments/superadmin--integrations-panel-control.html) | sahifa | v2 |
| `/integrations/connections` | superadmin | `superadmin-integrations-panel-security` — Ulanish — Xavfsizlik paneli<br>↳ `src/pages/integrations/panels/ConnectionSecurity.tsx` | [design/fragments/superadmin--integrations-panel-security.html](fragments/superadmin--integrations-panel-security.html) | sahifa | v2 |
| `/integrations/connections` | superadmin | `superadmin-integrations-rotate-key-dialog` — Kalitni yangilash (tasdiq)<br>↳ `src/pages/integrations/panels/ConnectionSecurity.tsx` | [design/fragments/superadmin--integrations-rotate-key-dialog.html](fragments/superadmin--integrations-rotate-key-dialog.html) | oyna | v2 |
| `/integrations/connections` | superadmin | `superadmin-integrations-new-partner-dialog` — Yangi hamkor (modal)<br>↳ `src/pages/integrations/NewPartnerModal.tsx` | [design/fragments/superadmin--integrations-new-partner-dialog.html](fragments/superadmin--integrations-new-partner-dialog.html) | oyna | v2 |
| `/integrations/connections` | superadmin | `superadmin-integrations-legacy-partners` — Partner API hamkorlari (eski sahifa) | [design/fragments/superadmin--integrations-legacy-partners.html](fragments/superadmin--integrations-legacy-partners.html) | sahifa | qisman |
| `/integrations/connections` | superadmin | `superadmin-ops-integrations` — Ops — Integratsiyalar | [design/fragments/superadmin--ops-integrations.html](fragments/superadmin--ops-integrations.html) | sahifa | qisman |
| `/integrations/connections` | admin | `admin-integrations-partners` — Integratsiyalar — Hamkorlar | [design/fragments/admin--integrations-partners.html](fragments/admin--integrations-partners.html) | sahifa | v2 |
| `/integrations/connections` | admin | `admin-integrations-external` — Integratsiyalar — Tashqi tizimlar | [design/fragments/admin--integrations-external.html](fragments/admin--integrations-external.html) | sahifa | v2 |
| `/integrations/connections` | admin | `admin-integrations-marketplace` — Integratsiyalar — Marketplace | [design/fragments/admin--integrations-marketplace.html](fragments/admin--integrations-marketplace.html) | sahifa | v2 |
| `/integrations/connections` | admin | `admin-integrations-conn-settings` — Ulanish — Sozlamalar<br>↳ `src/pages/integrations/panels/ConnectionSettings.tsx` | [design/fragments/admin--integrations-conn-settings.html](fragments/admin--integrations-conn-settings.html) | sahifa | v2 |
| `/integrations/connections` | admin | `admin-integrations-conn-shipments` — Ulanish — Posilkalar<br>↳ `src/pages/integrations/panels/ConnectionShipments.tsx` | [design/fragments/admin--integrations-conn-shipments.html](fragments/admin--integrations-conn-shipments.html) | sahifa | v2 |
| `/integrations/connections` | admin | `admin-integrations-conn-log` — Ulanish — Hodisalar<br>↳ `src/pages/integrations/panels/ConnectionLog.tsx` | [design/fragments/admin--integrations-conn-log.html](fragments/admin--integrations-conn-log.html) | sahifa | qisman |
| `/integrations/connections` | admin | `admin-integrations-conn-settlement` — Ulanish — Hisob-kitob<br>↳ `src/pages/integrations/panels/ConnectionSettlement.tsx`, `src/pages/integrations/panels/settlement/RemittancesSection.tsx` | [design/fragments/admin--integrations-conn-settlement.html](fragments/admin--integrations-conn-settlement.html) | sahifa | qisman |
| `/integrations/connections` | admin | `admin-integrations-settlement-pay-dialog` — Tashuvchidan olingan to'lov<br>↳ `src/pages/integrations/panels/ConnectionSettlement.tsx` | [design/fragments/admin--integrations-settlement-pay-dialog.html](fragments/admin--integrations-settlement-pay-dialog.html) | oyna | v2 |
| `/integrations/connections` | admin | `admin-integrations-settlement-pay-overpay-dialog` — To'lov — ortiqcha summa<br>↳ `src/pages/integrations/panels/ConnectionSettlement.tsx` | [design/fragments/admin--integrations-settlement-pay-overpay-dialog.html](fragments/admin--integrations-settlement-pay-overpay-dialog.html) | oyna | v2 |
| `/integrations/connections` | admin | `admin-integrations-settlement-pay-result-dialog` — To'lov natijasi<br>↳ `src/pages/integrations/panels/settlement/PayResultDialog.tsx` | [design/fragments/admin--integrations-settlement-pay-result-dialog.html](fragments/admin--integrations-settlement-pay-result-dialog.html) | oyna | qisman |
| `/integrations/connections` | admin | `admin-integrations-settlement-cancel-dialog` — To'lovni bekor qilish<br>↳ `src/pages/integrations/panels/settlement/CancelRemittanceDialog.tsx` | [design/fragments/admin--integrations-settlement-cancel-dialog.html](fragments/admin--integrations-settlement-cancel-dialog.html) | oyna | v2 |
| `/integrations/connections` | admin | `admin-integrations-conn-control` — Ulanish — Ish rejimi<br>↳ `src/pages/integrations/panels/ConnectionControl.tsx` | [design/fragments/admin--integrations-conn-control.html](fragments/admin--integrations-conn-control.html) | sahifa | v2 |
| `/integrations/connections` | admin | `admin-integrations-conn-security` — Ulanish — Xavfsizlik<br>↳ `src/pages/integrations/panels/ConnectionSecurity.tsx` | [design/fragments/admin--integrations-conn-security.html](fragments/admin--integrations-conn-security.html) | sahifa | v2 |
| `/integrations/connections` | admin | `admin-integrations-new-partner-dialog` — Yangi hamkor oynasi<br>↳ `src/pages/integrations/NewPartnerModal.tsx` | [design/fragments/admin--integrations-new-partner-dialog.html](fragments/admin--integrations-new-partner-dialog.html) | oyna | v2 |
| `/integrations/connections` | admin | `admin-integrations-legacy-partners` — Partner API hamkorlari (eski) | [design/fragments/admin--integrations-legacy-partners.html](fragments/admin--integrations-legacy-partners.html) | sahifa | qisman |
| `/integrations/connections` | manager | — Menyuda yo'q (faqat URL) — admin-integrations-* maketlariga qarang. | — | — | v2 |
| `/integrations/connections` | registrator | — Menyuda yo'q (faqat URL) — admin-integrations-* maketlariga qarang. | — | — | v2 |

#### `/integrations/new` — Yangi ulanish — katalog

- **Fayllar:** `src/pages/integrations/CatalogPage.tsx`
- **Qobiq:** DashboardLayout › IntegrationsPage (`src/pages/integrations/index.tsx`) · **Guard:** `canManageExternalIntegrations` (access.ts → canReceiveExternalOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Dizayn v2 (G2): 4 ta tur kartasi (klaviatura bilan), «← Integratsiyalar» qaytish havolasi.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/integrations/new` | superadmin | `superadmin-integrations-catalog` — Yangi ulanish — katalog | [design/fragments/superadmin--integrations-catalog.html](fragments/superadmin--integrations-catalog.html) | sahifa | v2 |
| `/integrations/new` | admin | `admin-integrations-catalog` — Yangi ulanish — katalog | [design/fragments/admin--integrations-catalog.html](fragments/admin--integrations-catalog.html) | sahifa | v2 |
| `/integrations/new` | manager | — Maket yo'q — admin-integrations-catalog ga qarang. | — | — | v2 |
| `/integrations/new` | registrator | — Maket yo'q — admin-integrations-catalog ga qarang. | — | — | v2 |

#### `/integrations/new/:typeKey` — Ulash ustasi (Nomi → Kalitlar → Sinash → Tayyor)

- **Fayllar:** `src/pages/integrations/wizard/ConnectWizard.tsx` · `src/pages/integrations/wizard/steps.ts` · `src/pages/integrations/ConnectionFields.tsx`
- **Qobiq:** DashboardLayout › IntegrationsPage (`src/pages/integrations/index.tsx`) · **Guard:** `canManageExternalIntegrations` (access.ts → canReceiveExternalOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Dizayn v2 (G2): 4 qadam (Nomi → Kalitlar → Sinash → Tayyor), ulanish 2-qadamda yaratiladi; telefonda qadamlar ustma-ust.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/integrations/new/:typeKey` | superadmin | `superadmin-integrations-wizard` — Ulash ustasi (Nomi → Kalitlar → Sinash → Tayyor) | [design/fragments/superadmin--integrations-wizard.html](fragments/superadmin--integrations-wizard.html) | sahifa | v2 |
| `/integrations/new/:typeKey` | admin | `admin-integrations-wizard` — Ulash ustasi | [design/fragments/admin--integrations-wizard.html](fragments/admin--integrations-wizard.html) | sahifa | v2 |
| `/integrations/new/:typeKey` | manager | — Maket yo'q — admin-integrations-wizard ga qarang. | — | — | v2 |
| `/integrations/new/:typeKey` | registrator | — Maket yo'q — admin-integrations-wizard ga qarang. | — | — | v2 |

#### `/integrations/sources` — Tashqi manbalar (eski: integratsiyalar ro'yxati)

- **Fayllar:** `src/pages/new_orders/external_orders/index.tsx`
- **Qobiq:** DashboardLayout › IntegrationsPage (`src/pages/integrations/index.tsx`) · **Guard:** `canManageExternalIntegrations` (access.ts → canReceiveExternalOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Dizayn v2 (G2): «Eski sahifa» belgisi; eski yo'llar (/new-orders/external, /new-orders/integrations …) kanonik /integrations/sources* ga yo'naltiriladi (D9); o'chirish — tasdiq oynasi.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/integrations/sources` | superadmin | `superadmin-integrations-legacy-sources` — Tashqi manbalar (eski: Integratsiyalar ro'yxati) | [design/fragments/superadmin--integrations-legacy-sources.html](fragments/superadmin--integrations-legacy-sources.html) | sahifa | v2 |
| `/integrations/sources` | admin | `admin-integrations-legacy-sources` — Integratsiyalar manbalari (eski) | [design/fragments/admin--integrations-legacy-sources.html](fragments/admin--integrations-legacy-sources.html) | sahifa | v2 |
| `/integrations/sources` | manager | — Maket yo'q — admin-integrations-legacy-sources ga qarang. | — | — | v2 |
| `/integrations/sources` | registrator | — Maket yo'q — admin-integrations-legacy-sources ga qarang. | — | — | v2 |

#### `/integrations/sources/create` — Integratsiya yaratish (eski forma)

- **Fayllar:** `src/pages/new_orders/external_orders/create.tsx`
- **Qobiq:** DashboardLayout › IntegrationsPage (`src/pages/integrations/index.tsx`) · **Guard:** `canManageExternalIntegrations` (access.ts → canReceiveExternalOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Dizayn v2 (G2). auth_type qiymatlari (none/bearer/basic) o'zgartirilmagan — backend AuthType 'api_key' | 'login'; gateway moslashuvi alohida tekshiriladi.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/integrations/sources/create` | superadmin | `superadmin-integrations-legacy-source-create` — Integratsiya yaratish (eski forma) | [design/fragments/superadmin--integrations-legacy-source-create.html](fragments/superadmin--integrations-legacy-source-create.html) | sahifa | v2 |
| `/integrations/sources/create` | admin | — Maket yo'q — superadmin-integrations-legacy-source-create ga qarang. | — | — | v2 |
| `/integrations/sources/create` | manager | — Maket yo'q — superadmin-integrations-legacy-source-create ga qarang. | — | — | v2 |
| `/integrations/sources/create` | registrator | — Maket yo'q — superadmin-integrations-legacy-source-create ga qarang. | — | — | v2 |

#### `/integrations/sources/:id` — Integratsiya — QR skaner (eski tafsilot)

- **Fayllar:** `src/pages/new_orders/external_orders/detail.tsx`
- **Qobiq:** DashboardLayout › IntegrationsPage (`src/pages/integrations/index.tsx`) · **Guard:** `canManageExternalIntegrations` (access.ts → canReceiveExternalOrders)
- **Rollar:** superadmin, admin, manager (HQ · PICKUP · HYBRID), registrator
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Dizayn v2 (G2). Ega savoli 7 — sukut: maketdagi «Qidirish» maydoni chizilmaydi (POST integrations/{slug}/search-by-qr bor, lekin oqim kelishilmagan).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/integrations/sources/:id` | superadmin | `superadmin-integrations-legacy-source-detail` — Integratsiya — QR skaner (eski) | [design/fragments/superadmin--integrations-legacy-source-detail.html](fragments/superadmin--integrations-legacy-source-detail.html) | sahifa | v2 |
| `/integrations/sources/:id` | admin | — Maket yo'q — superadmin-integrations-legacy-source-detail ga qarang. | — | — | v2 |
| `/integrations/sources/:id` | manager | — Maket yo'q — superadmin-integrations-legacy-source-detail ga qarang. | — | — | v2 |
| `/integrations/sources/:id` | registrator | — Maket yo'q — superadmin-integrations-legacy-source-detail ga qarang. | — | — | v2 |

### Bildirishnomalar

#### `/notifications` — Bildirishnoma sozlamalari — Telegram guruhlari

- **Fayllar:** `src/pages/notifications/ui/NotificationsPage.tsx` · `src/features/notification-create/ui/NotificationFormModal.tsx` · `src/pages/notifications/ui/NotificationRowMenu.tsx` · `src/features/notification-toggle/ui/useToggleNotificationConfirm.tsx` · `src/features/telegram-link/ui/LinkQrPanel.tsx` · `src/features/telegram-link/ui/LinkCountdown.tsx` · `src/features/notification-delete/ui/useDeleteNotificationConfirm.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewNotifications` (access.ts → canViewNotifications)
- **Rollar:** superadmin, admin
- **Menyuda:** «Bildirishnoma sozlamalari» (`notifications`) — superadmin, admin
- **Holat:** v2
- **Izoh:** Dizayn v2 (G2 + NG-A): jadval + sahifalash (DataTable / Pagination; telefonda kartalar), planshetda (< 1024) «Xabar turi» va «Sana» ustunlari yashirin (tur — market nomi ostida, sana — guruh ID ostida), «Holat» ustuni (Faol / Nofaol + nofaollik sababi — NG-C, G085w5Qr: inactive_reason kicked/left — qizil «Nofaol» + «Bot guruhdan chiqarilgan — qayta qo'shing va faollashtiring», chat_not_found — qizil + «Guruh topilmadi — ulanishni o'chirib, qayta ulang», blocked_on_send — qizil + «Bot guruhga xabar yubora olmadi — …» (maketda yo'q matn), manual — neytral «Qo'lda nofaol qilingan», null yoki noma'lum qiymat — neytral umumiy izoh «Xabarlar bu guruhga yuborilmayapti» (D1); inactive_at bo'lsa ostida «Nofaol bo'lgan: {sana}» — maketda yo'q, vazifa bo'yicha; xuddi shu matn telefon kartasida, qator varag'ida va foydalanuvchi tafsilotidagi «Telegram guruhi» kartasida; faollashtirish tasdig'ida ogohlantirish sababga qarab — bot chiqarilgan: maketdagi «Bot guruhdan chiqarilgan», qo'lda / noma'lum: umumiy «Bot guruhda ekanini tekshiring»; «shu tur ulangan, lekin nofaol» oynasida ham sababli matn), market nomlari GET /markets dan (qatorda faqat market_id). Qator menyusi (NotificationRowMenu, 64 px ustun): desktopda popover, telefonda pastki varaqa (bandlar ≥ 52 px, kebab 44 px) — faol guruhda «Nofaol qilish», nofaolida «Faollashtirish», so'ng «O'chirish»; nofaol qilish (danger) va faollashtirish (ogohlantirish bilan) — tasdiq oynalari, ikkalasi faqat PATCH /notifications/:id {is_active} (features/notification-toggle); o'chirish — tasdiq oynasi (maket matni). Xato matnlari faqat i18n (backend message ko'rsatilmaydi). Qo'shish oynasi maketdagi bot havolasi formasi (*-create-dialog; qo'lda guruh ID formasi yo'q) — bir martalik Telegram havolasi: market + xabar turi → POST /telegram/link-code {purpose: market_group} → QR, «Telegram'da ochish», qadamlar, muddat; oyna ochiqligida GET /notifications har 4 s, guruh paydo bo'lsa yopiladi («Guruh ulandi» xabari — *-connected); shu (market, tur) ulangan bo'lsa havola berilmaydi. «Tahrirlash» (qo'lda guruh ID, NotificationEditModal) olib tashlandi (NG-S4). Ustun saralashi chizilmaydi (GET /notifications da sort yo'q). Matnlar — notificationGroups.json. Ega tasdig'i 2026-10-19 (notif-groups): NG-S1 — nofaol sababi «Holat» ustunida (backend inactive_reason — NG-C); NG-S2 — /notifications adminga ochiladi (menyu «Bildirishnomalar», guard canViewNotifications superadmin + admin — NG-A); NG-S3 — shu tur ulangan, lekin nofaol bo'lsa asosiy tugma «Faollashtirish» (*-create-exists-inactive-dialog → *-activate-dialog — NG-B); NG-S4 — faqat bot havolasi (*-create-link-dialog, *-create-expired-dialog — NG-B). NG-B (2026-10-21): havola tayyor — QR oq ramkada (desktopda chapda, telefonda qadamlardan keyin), «Telegram bor telefonda» qadami, ajratgich ostida teskari sanoq (LinkCountdown inline, role=timer, progresssiz) va «Guruh ulanishi kutilmoqda…»; faol ulanishda — «avval eskisini ro'yxatdan o'chiring» (tahrirlash yo'q); nofaol ulanishda — asosiy tugma «Faollashtirish» → ochiq oyna ustida tasdiq (features/notification-toggle), muvaffaqiyatda oyna yopiladi, bekor qilinsa fokus tugmaga qaytadi; havola xatosi — faqat i18n matn (403 / boshqa).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/notifications` | superadmin | `superadmin-notifications-telegram-groups` — Bildirishnomalar — Telegram guruhlari | [design/fragments/superadmin--notifications-telegram-groups.html](fragments/superadmin--notifications-telegram-groups.html) | sahifa | qisman |
| `/notifications` | superadmin | `superadmin-notifications-row-menu` — Guruh amallari menyusi<br>↳ `src/pages/notifications/ui/NotificationRowMenu.tsx` | [design/fragments/superadmin--notifications-row-menu.html](fragments/superadmin--notifications-row-menu.html) | oyna | v2 |
| `/notifications` | superadmin | `superadmin-notifications-row-menu-inactive` — Guruh amallari menyusi — nofaol guruh<br>↳ `src/pages/notifications/ui/NotificationRowMenu.tsx` | [design/fragments/superadmin--notifications-row-menu-inactive.html](fragments/superadmin--notifications-row-menu-inactive.html) | oyna | qisman |
| `/notifications` | superadmin | `superadmin-notifications-connected` — Bildirishnomalar — guruh ulandi | [design/fragments/superadmin--notifications-connected.html](fragments/superadmin--notifications-connected.html) | sahifa | v2 |
| `/notifications` | superadmin | `superadmin-notifications-empty` — Bildirishnomalar — bo'sh holat | [design/fragments/superadmin--notifications-empty.html](fragments/superadmin--notifications-empty.html) | sahifa | v2 |
| `/notifications` | superadmin | `superadmin-notifications-loading` — Bildirishnomalar — yuklanish | [design/fragments/superadmin--notifications-loading.html](fragments/superadmin--notifications-loading.html) | sahifa | v2 |
| `/notifications` | superadmin | `superadmin-notifications-error` — Bildirishnomalar — xato holati | [design/fragments/superadmin--notifications-error.html](fragments/superadmin--notifications-error.html) | sahifa | v2 |
| `/notifications` | superadmin | `superadmin-notifications-create-dialog` — Bildirishnoma qo'shish (modal)<br>↳ `src/features/notification-create/ui/NotificationFormModal.tsx` | [design/fragments/superadmin--notifications-create-dialog.html](fragments/superadmin--notifications-create-dialog.html) | oyna | v2 |
| `/notifications` | superadmin | `superadmin-notifications-create-link-dialog` — Bildirishnoma qo'shish — havola tayyor, kutilmoqda<br>↳ `src/features/notification-create/ui/NotificationFormModal.tsx`, `src/features/telegram-link/ui/LinkCountdown.tsx` | [design/fragments/superadmin--notifications-create-link-dialog.html](fragments/superadmin--notifications-create-link-dialog.html) | oyna | v2 |
| `/notifications` | superadmin | `superadmin-notifications-create-expired-dialog` — Bildirishnoma qo'shish — havola muddati tugadi<br>↳ `src/features/notification-create/ui/NotificationFormModal.tsx` | [design/fragments/superadmin--notifications-create-expired-dialog.html](fragments/superadmin--notifications-create-expired-dialog.html) | oyna | v2 |
| `/notifications` | superadmin | `superadmin-notifications-create-exists-dialog` — Bildirishnoma qo'shish — shu tur allaqachon ulangan<br>↳ `src/features/notification-create/ui/NotificationFormModal.tsx` | [design/fragments/superadmin--notifications-create-exists-dialog.html](fragments/superadmin--notifications-create-exists-dialog.html) | oyna | v2 |
| `/notifications` | superadmin | `superadmin-notifications-create-exists-inactive-dialog` — Bildirishnoma qo'shish — shu tur ulangan, lekin nofaol<br>↳ `src/features/notification-create/ui/NotificationFormModal.tsx` | [design/fragments/superadmin--notifications-create-exists-inactive-dialog.html](fragments/superadmin--notifications-create-exists-inactive-dialog.html) | oyna | qisman |
| `/notifications` | superadmin | `superadmin-notifications-deactivate-dialog` — Guruhni nofaol qilish (tasdiq)<br>↳ `src/features/notification-toggle/ui/useToggleNotificationConfirm.tsx` | [design/fragments/superadmin--notifications-deactivate-dialog.html](fragments/superadmin--notifications-deactivate-dialog.html) | oyna | v2 |
| `/notifications` | superadmin | `superadmin-notifications-activate-dialog` — Guruhni faollashtirish (tasdiq)<br>↳ `src/features/notification-toggle/ui/useToggleNotificationConfirm.tsx` | [design/fragments/superadmin--notifications-activate-dialog.html](fragments/superadmin--notifications-activate-dialog.html) | oyna | qisman |
| `/notifications` | superadmin | `superadmin-notifications-delete-dialog` — Bildirishnomani o'chirish (tasdiq)<br>↳ `src/features/notification-delete/ui/useDeleteNotificationConfirm.tsx` | [design/fragments/superadmin--notifications-delete-dialog.html](fragments/superadmin--notifications-delete-dialog.html) | oyna | v2 |
| `/notifications` | admin | `admin-notifications-telegram-groups` — Bildirishnomalar — Telegram guruhlari | [design/fragments/superadmin--notifications-telegram-groups.html](fragments/superadmin--notifications-telegram-groups.html) | sahifa | qisman |
| `/notifications` | admin | `admin-notifications-row-menu` — Guruh amallari menyusi<br>↳ `src/pages/notifications/ui/NotificationRowMenu.tsx` | [design/fragments/superadmin--notifications-row-menu.html](fragments/superadmin--notifications-row-menu.html) | oyna | v2 |
| `/notifications` | admin | `admin-notifications-row-menu-inactive` — Guruh amallari menyusi — nofaol guruh<br>↳ `src/pages/notifications/ui/NotificationRowMenu.tsx` | [design/fragments/superadmin--notifications-row-menu-inactive.html](fragments/superadmin--notifications-row-menu-inactive.html) | oyna | qisman |
| `/notifications` | admin | `admin-notifications-connected` — Bildirishnomalar — guruh ulandi | [design/fragments/superadmin--notifications-connected.html](fragments/superadmin--notifications-connected.html) | sahifa | v2 |
| `/notifications` | admin | `admin-notifications-empty` — Bildirishnomalar — bo'sh holat | [design/fragments/superadmin--notifications-empty.html](fragments/superadmin--notifications-empty.html) | sahifa | v2 |
| `/notifications` | admin | `admin-notifications-loading` — Bildirishnomalar — yuklanish | [design/fragments/superadmin--notifications-loading.html](fragments/superadmin--notifications-loading.html) | sahifa | v2 |
| `/notifications` | admin | `admin-notifications-error` — Bildirishnomalar — xato holati | [design/fragments/superadmin--notifications-error.html](fragments/superadmin--notifications-error.html) | sahifa | v2 |
| `/notifications` | admin | `admin-notifications-create-dialog` — Bildirishnoma qo'shish (modal)<br>↳ `src/features/notification-create/ui/NotificationFormModal.tsx` | [design/fragments/superadmin--notifications-create-dialog.html](fragments/superadmin--notifications-create-dialog.html) | oyna | v2 |
| `/notifications` | admin | `admin-notifications-create-link-dialog` — Bildirishnoma qo'shish — havola tayyor, kutilmoqda<br>↳ `src/features/notification-create/ui/NotificationFormModal.tsx`, `src/features/telegram-link/ui/LinkCountdown.tsx` | [design/fragments/superadmin--notifications-create-link-dialog.html](fragments/superadmin--notifications-create-link-dialog.html) | oyna | v2 |
| `/notifications` | admin | `admin-notifications-create-expired-dialog` — Bildirishnoma qo'shish — havola muddati tugadi<br>↳ `src/features/notification-create/ui/NotificationFormModal.tsx` | [design/fragments/superadmin--notifications-create-expired-dialog.html](fragments/superadmin--notifications-create-expired-dialog.html) | oyna | v2 |
| `/notifications` | admin | `admin-notifications-create-exists-dialog` — Bildirishnoma qo'shish — shu tur allaqachon ulangan<br>↳ `src/features/notification-create/ui/NotificationFormModal.tsx` | [design/fragments/superadmin--notifications-create-exists-dialog.html](fragments/superadmin--notifications-create-exists-dialog.html) | oyna | v2 |
| `/notifications` | admin | `admin-notifications-create-exists-inactive-dialog` — Bildirishnoma qo'shish — shu tur ulangan, lekin nofaol<br>↳ `src/features/notification-create/ui/NotificationFormModal.tsx` | [design/fragments/superadmin--notifications-create-exists-inactive-dialog.html](fragments/superadmin--notifications-create-exists-inactive-dialog.html) | oyna | qisman |
| `/notifications` | admin | `admin-notifications-deactivate-dialog` — Guruhni nofaol qilish (tasdiq)<br>↳ `src/features/notification-toggle/ui/useToggleNotificationConfirm.tsx` | [design/fragments/superadmin--notifications-deactivate-dialog.html](fragments/superadmin--notifications-deactivate-dialog.html) | oyna | v2 |
| `/notifications` | admin | `admin-notifications-activate-dialog` — Guruhni faollashtirish (tasdiq)<br>↳ `src/features/notification-toggle/ui/useToggleNotificationConfirm.tsx` | [design/fragments/superadmin--notifications-activate-dialog.html](fragments/superadmin--notifications-activate-dialog.html) | oyna | qisman |
| `/notifications` | admin | `admin-notifications-delete-dialog` — Bildirishnomani o'chirish (tasdiq)<br>↳ `src/features/notification-delete/ui/useDeleteNotificationConfirm.tsx` | [design/fragments/superadmin--notifications-delete-dialog.html](fragments/superadmin--notifications-delete-dialog.html) | oyna | v2 |

#### `/notifications/send` — Xabar yuborish (tizim ichidagi bildirishnoma)

- **Fayllar:** `src/pages/notification-send/index.tsx` · `src/features/notification-dispatch/ui/NotificationDispatchForm.tsx` · `src/widgets/notification-inbox/ui/NotificationInboxItem.tsx` · `src/features/notification-dispatch/ui/DispatchResultCard.tsx` · `src/features/notification-dispatch/ui/DispatchUnknownCard.tsx` · `src/entities/notification-dispatch/ui/SentDetailDialog.tsx` · `src/entities/notification-campaign/ui/AudienceBuilder.tsx` · `src/entities/notification-campaign/ui/AudienceSummary.tsx` · `src/entities/notification-campaign/ui/AudienceSampleDialog.tsx` · `src/entities/notification-campaign/ui/SaveSegmentDialog.tsx` · `src/features/notification-dispatch/ui/CampaignProgressCard.tsx` · `src/features/notification-dispatch/ui/CampaignScheduleCard.tsx` · `src/features/notification-dispatch/ui/CampaignHistoryCard.tsx` · `src/features/notification-dispatch/ui/CampaignReportDialog.tsx` · `src/features/notification-dispatch/ui/useCampaignCancel.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canSendNotifications` (access.ts → canSendNotifications)
- **Rollar:** superadmin, admin
- **Menyuda:** yo'q — /inbox sahifasidagi «Xabar yuborish» havolasi
- **Holat:** v2
- **Izoh:** Dizayn v2 (G2): 4 rejim, kanallar, ko'rinish (NotificationInboxItem preview), yuborish — tasdiq oynasi (hammaga — danger), ikki marta yuborilmaydi. Ega savoli 10 — sukut: «← Bildirishnomalar» /inbox ga qaytaradi (kirish nuqtasi /inbox; admin /notifications ni ocholmaydi). Ega tasdig'i 2026-10-19 (notif-send): yuborishdan keyin natija bloki (*-send-result: kanal bo'yicha yuborildi / navbatda / o'tkazib yuborildi / xato; «Yetkazilmaganlar» darhol — S1, qo'shimcha so'rov bilan); javob kelmasa (504) — *-send-unknown, «Qayta urinish» ayni client_request_id bilan (S5). Ranglar (S3): navbatda / yuborilmoqda — warning, o'tkazib yuborildi / provayder ulanmagan — neytral, xato — danger, yetkazildi — success. Xato matni faqat tushunarli o'zbekcha (S4). Sarlavhadagi «Yuborilganlar» havolasi → /notifications/sent (NS-2; natija kartasidagi «Yetkazilmaganlar» xatosida ham). KM-2: «Rol» rejimi olindi — «Auditoriya» (kampaniya: konstruktor, jonli son, namuna, saqlangan segmentlar, tasdiq + Idempotency-Key, progress va «Bekor qilish»); «Hamma» soni — POST notifications/audience/preview { broadcast: true }, yuborish sinxron qoldi (ega savoli). «Kategoriya»: marketing — «Reklama». KM-3: «Yuborish vaqti» (Darhol / Belgilangan vaqtda, Toshkent vaqti, reklama tungi taqiqi — schedule-policy), «Rejalashtirish» tasdig'i, pastda «Kampaniyalar tarixi» (GET /notifications/campaigns?state) — bekor qilish (POST …/:id/cancel, tasdiq bilan) va hisobot oynasi (GET …/:id/report, /undelivered, /undelivered/export — CSV faqat superadmin).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/notifications/send` | superadmin | `superadmin-notifications-send` — Xabar yuborish | [design/fragments/superadmin--notifications-send.html](fragments/superadmin--notifications-send.html) | sahifa | v2 |
| `/notifications/send` | superadmin | `superadmin-notifications-send-confirm-dialog` — Xabarni yuborishni tasdiqlang | [design/fragments/superadmin--notifications-send-confirm-dialog.html](fragments/superadmin--notifications-send-confirm-dialog.html) | oyna | v2 |
| `/notifications/send` | superadmin | `superadmin-notifications-send-audience` — Xabar yuborish — auditoriya konstruktori<br>↳ `src/entities/notification-campaign/ui/AudienceBuilder.tsx` | [design/fragments/superadmin--notifications-send-audience.html](fragments/superadmin--notifications-send-audience.html) | sahifa | qisman |
| `/notifications/send` | superadmin | `superadmin-notifications-send-schedule` — Xabar yuborish — belgilangan vaqtda (soat tanlash ochiq)<br>↳ `src/features/notification-dispatch/ui/CampaignScheduleCard.tsx` | [design/fragments/superadmin--notifications-send-schedule.html](fragments/superadmin--notifications-send-schedule.html) | sahifa | qisman |
| `/notifications/send` | superadmin | `superadmin-notifications-send-audience-sample-dialog` — Auditoriya namunasi (20 ta, maskalangan)<br>↳ `src/entities/notification-campaign/ui/AudienceSampleDialog.tsx` | [design/fragments/superadmin--notifications-send-audience-sample-dialog.html](fragments/superadmin--notifications-send-audience-sample-dialog.html) | oyna | v2 |
| `/notifications/send` | superadmin | `superadmin-notifications-send-audience-save-dialog` — Segmentni saqlash (oyna)<br>↳ `src/entities/notification-campaign/ui/SaveSegmentDialog.tsx` | [design/fragments/superadmin--notifications-send-audience-save-dialog.html](fragments/superadmin--notifications-send-audience-save-dialog.html) | oyna | v2 |
| `/notifications/send` | superadmin | `superadmin-notifications-send-confirm-scheduled-dialog` — Kampaniyani rejalashtirishni tasdiqlang<br>↳ `src/features/notification-dispatch/ui/NotificationDispatchForm.tsx` | [design/fragments/superadmin--notifications-send-confirm-scheduled-dialog.html](fragments/superadmin--notifications-send-confirm-scheduled-dialog.html) | oyna | qisman |
| `/notifications/send` | superadmin | `superadmin-notifications-campaign-cancel-dialog` — Kampaniyani bekor qilish (tasdiq)<br>↳ `src/features/notification-dispatch/ui/useCampaignCancel.tsx` | [design/fragments/superadmin--notifications-campaign-cancel-dialog.html](fragments/superadmin--notifications-campaign-cancel-dialog.html) | oyna | qisman |
| `/notifications/send` | superadmin | `superadmin-notifications-campaign-report-dialog` — Kampaniya hisoboti (oyna)<br>↳ `src/features/notification-dispatch/ui/CampaignReportDialog.tsx` | [design/fragments/superadmin--notifications-campaign-report-dialog.html](fragments/superadmin--notifications-campaign-report-dialog.html) | oyna | qisman |
| `/notifications/send` | superadmin | `superadmin-notifications-send-states` — Xabar yuborish — auditoriya va yuborish holatlari<br>↳ `src/entities/notification-campaign/ui/AudienceSummary.tsx` | [design/fragments/superadmin--notifications-send-states.html](fragments/superadmin--notifications-send-states.html) | sahifa | qisman |
| `/notifications/send` | superadmin | `superadmin-notifications-send-result` — Xabar yuborish — natija<br>↳ `src/features/notification-dispatch/ui/DispatchResultCard.tsx` | [design/fragments/superadmin--notifications-send-result.html](fragments/superadmin--notifications-send-result.html) | sahifa | v2 |
| `/notifications/send` | superadmin | `superadmin-notifications-send-unknown` — Xabar yuborish — natija noma'lum<br>↳ `src/features/notification-dispatch/ui/DispatchUnknownCard.tsx` | [design/fragments/superadmin--notifications-send-unknown.html](fragments/superadmin--notifications-send-unknown.html) | sahifa | v2 |
| `/notifications/send` | superadmin | `superadmin-notifications-sent-detail-dialog` — Yuborilgan xabar tafsiloti<br>↳ `src/entities/notification-dispatch/ui/SentDetailDialog.tsx` | [design/fragments/superadmin--notifications-sent-detail-dialog.html](fragments/superadmin--notifications-sent-detail-dialog.html) | oyna | v2 |
| `/notifications/send` | admin | `admin-notifications-send` — Xabar yuborish | [design/fragments/superadmin--notifications-send.html](fragments/superadmin--notifications-send.html) | sahifa | v2 |
| `/notifications/send` | admin | `admin-notifications-send-confirm-dialog` — Xabarni yuborishni tasdiqlang | [design/fragments/superadmin--notifications-send-confirm-dialog.html](fragments/superadmin--notifications-send-confirm-dialog.html) | oyna | v2 |
| `/notifications/send` | admin | `admin-notifications-send-result` — Xabar yuborish — natija<br>↳ `src/features/notification-dispatch/ui/DispatchResultCard.tsx` | [design/fragments/superadmin--notifications-send-result.html](fragments/superadmin--notifications-send-result.html) | sahifa | v2 |
| `/notifications/send` | admin | `admin-notifications-send-unknown` — Xabar yuborish — natija noma'lum<br>↳ `src/features/notification-dispatch/ui/DispatchUnknownCard.tsx` | [design/fragments/superadmin--notifications-send-unknown.html](fragments/superadmin--notifications-send-unknown.html) | sahifa | v2 |
| `/notifications/send` | admin | `admin-notifications-sent-detail-dialog` — Yuborilgan xabar tafsiloti<br>↳ `src/entities/notification-dispatch/ui/SentDetailDialog.tsx` | [design/fragments/superadmin--notifications-sent-detail-dialog.html](fragments/superadmin--notifications-sent-detail-dialog.html) | oyna | v2 |

#### `/notifications/sent` — Yuborilganlar — qo'lda yuborilgan xabarlar va natija

- **Fayllar:** `src/pages/notification-sent/index.tsx` · `src/pages/notification-sent/ui/SentFilters.tsx` · `src/pages/notification-sent/ui/SentTable.tsx` · `src/entities/notification-dispatch/ui/SentDetailDialog.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canSendNotifications` (access.ts → canSendNotifications)
- **Rollar:** superadmin, admin
- **Menyuda:** yo'q — «Xabar yuborish» sahifasi sarlavhasidagi «Yuborilganlar» havolasi (menyu bandi emas); natija kartasidagi ro'yxat xatosida ham
- **Holat:** v2
- **Izoh:** NS-2 (ega tasdig'i 2026-10-19, notif-send): GET /notifications/sent?page&limit=10&status&created_by — yangisi birinchi. Filtrlar «Natija» (tarix holati) va «Kim yubordi» (GET /users?role=superadmin|admin; created_by — foydalanuvchi id'si) URL'da (?status, ?created_by), sahifa ?page, ochiq tafsilot oynasi ?id=<dispatch_id> (eskirgan havola — oynada «Xabar topilmadi»); telefonda «Filtrlar» tugmasi + pastki varaqa. Jadval (DataTable + Pagination; planshetda «Kim yubordi», «Kanallar» va › yashirin; telefonda kartalar): sana, sarlavha + matn boshi (body_preview), muallif + rol, «Kimga» — ro'yxat javobidagi audience (NS-3, NwlmrcMf: rol, «Hamma», bitta odam — «ism · rol», ismsiz eski yozuvda «Bitta odam», «Tanlangan ro'yxat»; ichki dispatch — «—») + qabul qiluvchilar (dispatched + skipped_by_preference), kanal chiplari (Darhol · Telegram · SMS · Push), «Natija» badge'i + izoh (yuborilmoqda — «… dan beri»; xato — «Hech kimga ketmadi»; provayder ulanmagan / xato / o'tkazib yuborildi kanal sonlari bilan — saqlangan channel_status dan; backend message ko'rsatilmaydi). «Yuborilmoqda» qatori bo'lsa ro'yxat har 10 s yangilanadi; tafsilot oynasidagi raqamlar jonli (SentDetailDialog). Holatlar (QueryBoundary): yuklanish (filtrlar o'chiq), bo'sh (hech narsa yuborilmagan — filtrlar yashirin; filtr bo'yicha — «Filtrni tozalash»), xato («Qayta urinish»). Tafsilot holatlari: 404, xato, yuborilmoqda, xato bilan tugagan — «Qayta yuborish» → /notifications/send.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/notifications/sent` | superadmin | `superadmin-notifications-sent` — Yuborilganlar | [design/fragments/superadmin--notifications-sent.html](fragments/superadmin--notifications-sent.html) | sahifa | v2 |
| `/notifications/sent` | superadmin | `superadmin-notifications-sent-loading` — Yuborilganlar — yuklanmoqda | [design/fragments/superadmin--notifications-sent-loading.html](fragments/superadmin--notifications-sent-loading.html) | sahifa | v2 |
| `/notifications/sent` | superadmin | `superadmin-notifications-sent-empty` — Yuborilganlar — bo'sh | [design/fragments/superadmin--notifications-sent-empty.html](fragments/superadmin--notifications-sent-empty.html) | sahifa | v2 |
| `/notifications/sent` | superadmin | `superadmin-notifications-sent-error` — Yuborilganlar — xato | [design/fragments/superadmin--notifications-sent-error.html](fragments/superadmin--notifications-sent-error.html) | sahifa | v2 |
| `/notifications/sent` | superadmin | `superadmin-notifications-sent-detail-dialog` — Yuborilgan xabar tafsiloti<br>↳ `src/entities/notification-dispatch/ui/SentDetailDialog.tsx` | [design/fragments/superadmin--notifications-sent-detail-dialog.html](fragments/superadmin--notifications-sent-detail-dialog.html) | oyna | v2 |
| `/notifications/sent` | superadmin | `superadmin-notifications-sent-detail-states` — Yuborilgan xabar tafsiloti — boshqa holatlar<br>↳ `src/entities/notification-dispatch/ui/SentDetailDialog.tsx` | [design/fragments/superadmin--notifications-sent-detail-states.html](fragments/superadmin--notifications-sent-detail-states.html) | sahifa | v2 |
| `/notifications/sent` | admin | `admin-notifications-sent` — Yuborilganlar | [design/fragments/superadmin--notifications-sent.html](fragments/superadmin--notifications-sent.html) | sahifa | v2 |
| `/notifications/sent` | admin | `admin-notifications-sent-loading` — Yuborilganlar — yuklanmoqda | [design/fragments/superadmin--notifications-sent-loading.html](fragments/superadmin--notifications-sent-loading.html) | sahifa | v2 |
| `/notifications/sent` | admin | `admin-notifications-sent-empty` — Yuborilganlar — bo'sh | [design/fragments/superadmin--notifications-sent-empty.html](fragments/superadmin--notifications-sent-empty.html) | sahifa | v2 |
| `/notifications/sent` | admin | `admin-notifications-sent-error` — Yuborilganlar — xato | [design/fragments/superadmin--notifications-sent-error.html](fragments/superadmin--notifications-sent-error.html) | sahifa | v2 |
| `/notifications/sent` | admin | `admin-notifications-sent-detail-dialog` — Yuborilgan xabar tafsiloti<br>↳ `src/entities/notification-dispatch/ui/SentDetailDialog.tsx` | [design/fragments/superadmin--notifications-sent-detail-dialog.html](fragments/superadmin--notifications-sent-detail-dialog.html) | oyna | v2 |
| `/notifications/sent` | admin | `admin-notifications-sent-detail-states` — Yuborilgan xabar tafsiloti — boshqa holatlar<br>↳ `src/entities/notification-dispatch/ui/SentDetailDialog.tsx` | [design/fragments/superadmin--notifications-sent-detail-states.html](fragments/superadmin--notifications-sent-detail-states.html) | sahifa | v2 |

#### `/notifications/sms` — SMS — Kampaniya · Shablonlar · Xarajat · Sozlamalar

- **Fayllar:** `src/pages/notifications/ui/SmsPage.tsx` · `src/pages/notifications/ui/CampaignPage.tsx` · `src/pages/notifications/ui/SmsTemplatesTab.tsx` · `src/pages/notifications/ui/SmsReportTab.tsx` · `src/pages/notifications/ui/SmsSettingsTab.tsx` · `src/pages/notifications/ui/sms/CardList.tsx` · `src/pages/notifications/ui/sms/SmsReportCharts.tsx` · `src/pages/notifications/ui/sms/CampaignAudienceSummary.tsx` · `src/pages/notifications/ui/sms/CampaignSendTime.tsx` · `src/entities/notification-campaign/ui/CustomerSegmentFilters.tsx` · `src/shared/ui/SmsMeter.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canSendNotifications` (access.ts → canSendNotifications)
- **Rollar:** superadmin, admin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Tab URL'da: ?tab=campaign|templates|report|settings. Dizayn v2 (G2): kampaniya — tasdiq oynasi + Idempotency-Key; «Xarajat» grafiklari Grafik | Jadval egizagi; shablonni o'chirish — tasdiq. «Xarajat» o'lchagichi — «Yetkazildi / jami yuborilgan» (maket); backend success_rate (yetkazildi / (yetkazildi + xato)) ko'rsatilmaydi. Rejalashtirilgan vaqt «18.10.2026, 09:00 da yuboriladi» ko'rinishida (umumiy formatlovchida «Ertaga» yo'q). KM-1: kampaniya faqat reklama; «Mijozlar segmenti» — CustomerSegmentFilters (Select / DateRange / minimum), jonli auditoriya va bugungi SMS limiti; «Oxirgi buyurtma» oxirgi kuni ham kiradi (backend last_order_to qat'iy — keyingi kun yuboriladi); xato — faqat i18n matn (HTTP holati bo'yicha).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/notifications/sms` | superadmin | `superadmin-notifications-sms-campaign` — SMS — Kampaniya | [design/fragments/superadmin--notifications-sms-campaign.html](fragments/superadmin--notifications-sms-campaign.html) | sahifa | v2 |
| `/notifications/sms` | superadmin | `superadmin-notifications-sms-campaign-confirm-dialog` — SMS kampaniyani tasdiqlash | [design/fragments/superadmin--notifications-sms-campaign-confirm-dialog.html](fragments/superadmin--notifications-sms-campaign-confirm-dialog.html) | oyna | v2 |
| `/notifications/sms` | superadmin | `superadmin-notifications-sms-templates` — SMS — Shablonlar | [design/fragments/superadmin--notifications-sms-templates.html](fragments/superadmin--notifications-sms-templates.html) | sahifa | v2 |
| `/notifications/sms` | superadmin | `superadmin-notifications-sms-report` — SMS — Xarajat | [design/fragments/superadmin--notifications-sms-report.html](fragments/superadmin--notifications-sms-report.html) | sahifa | qisman |
| `/notifications/sms` | superadmin | `superadmin-notifications-sms-settings` — SMS — Sozlamalar | [design/fragments/superadmin--notifications-sms-settings.html](fragments/superadmin--notifications-sms-settings.html) | sahifa | v2 |
| `/notifications/sms` | superadmin | `superadmin-notifications-sms-campaign-segment` — SMS — Kampaniya: mijozlar segmenti va yuborish vaqti<br>↳ `src/pages/notifications/ui/CampaignPage.tsx` | [design/fragments/superadmin--notifications-sms-campaign-segment.html](fragments/superadmin--notifications-sms-campaign-segment.html) | sahifa | qisman |
| `/notifications/sms` | admin | — Maket yo'q — superadmin-notifications-sms-* ga qarang. | — | — | v2 |

### Tizim — faoliyat jurnali va ops

#### `/activity-logs` — Faoliyat jurnali (ochiladigan qator)

- **Fayllar:** `src/pages/activity-logs/index.tsx` · `src/widgets/activity-log/ui/ActivityLogViewer.tsx` · `src/widgets/activity-log/ui/ActivityLogFilters.tsx` · `src/widgets/activity-log/ui/ActivityLogDetail.tsx` · `src/widgets/activity-log/model/activityFilters.ts` · `src/widgets/activity-log/model/activityDetail.ts` · `src/widgets/activity-log/model/useActivityLabels.ts` · `src/entities/activity-log/ui/ActivityActionBadge.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewOps` (routes.tsx → canViewOps)
- **Rollar:** superadmin, admin
- **Menyuda:** «Faoliyat jurnali» (`activityLogs`) — superadmin, admin
- **Holat:** v2
- **Izoh:** Dizayn v2 (G2 + dev): 6 filtr + tozalash (telefonda «Filtrlar» varag'i — ActivityLogFilters ichidagi Dialog, `(maket yo'q) superadmin-activity-logs-list, superadmin-orders-filters-mobile`); «Amal» filtri GET /activity-logs/actions reyestri bo'yicha kategoriyalarga guruhlangan; muallif `actor.resolved` («#44 (topilmadi)», «Tizim»), amal yorlig'i action_meta → reyestr → humanize (ActivityActionBadge). Qator DataTable expandable bilan ochiladi (o'zgarishlar, «Qo'shimcha ma'lumot»: Manba, Filial, …, Qurilma, IP); o'zgarish, metadata va «Kuzatuv ID» yo'q yozuvda chevron yo'q (faqat «Kuzatuv ID» bo'lsa ham ochiladi — dev qoidasi); sahifalash «1–20 / 45 ta yozuv».

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/activity-logs` | superadmin | `superadmin-activity-logs-list` — Faoliyat jurnali | [design/fragments/superadmin--activity-logs-list.html](fragments/superadmin--activity-logs-list.html) | sahifa | v2 |
| `/activity-logs` | superadmin | `superadmin-activity-logs-row-expanded` — Faoliyat jurnali — yozuv tafsiloti (ochilgan qator)<br>↳ `src/widgets/activity-log/ui/ActivityLogDetail.tsx` | [design/fragments/superadmin--activity-logs-row-expanded.html](fragments/superadmin--activity-logs-row-expanded.html) | sahifa | v2 |
| `/activity-logs` | admin | `admin-activity-logs-list` — Faoliyat jurnali | [design/fragments/superadmin--activity-logs-list.html](fragments/superadmin--activity-logs-list.html) | sahifa | v2 |
| `/activity-logs` | admin | `admin-activity-logs-row-expanded` — Jurnal yozuvi ochilgan<br>↳ `src/widgets/activity-log/ui/ActivityLogDetail.tsx` | [design/fragments/admin--activity-logs-row-expanded.html](fragments/admin--activity-logs-row-expanded.html) | sahifa | v2 |
| `/activity-logs` | tizim taxtasi | `tizim-states-data` — Holatlar — jadval, ro'yxat, kartalar | [design/fragments/tizim--states-data.html](fragments/tizim--states-data.html) | taxta | qoida |

#### `/ops` — Ops vositalari markazi (tablar: ?tab=finance|expense-categories|integrations|investors|logistics|delivery-pricing|branches|identity|system|auth; dizayn v2)

- **Fayllar:** `src/pages/ops/index.tsx` · `src/pages/ops/tabs.ts` · `src/pages/ops/ui/OpsToolPage.tsx` · `src/pages/expense-categories/index.tsx` · `src/pages/expense-categories/ui/ExpenseCategoriesPanel.tsx` · `src/pages/expense-categories/ui/ExpenseCategoryFormDialog.tsx` · `src/pages/delivery-tariffs/index.tsx` · `src/pages/delivery-tariffs/ui/DeliveryTariffsContent.tsx` · `src/pages/investors-ops/index.tsx` · `src/pages/system-ops/index.tsx` · `src/pages/system-ops/ui/HealthCard.tsx` · `src/pages/system-ops/ui/AiStatusCard.tsx` · `src/pages/system-ops/lib/aiStatus.ts` · `src/pages/logs/index.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewOpsPages` (routes.tsx → canViewOpsPages)
- **Rollar:** superadmin
- **Menyuda:** «Ops vositalari» (`ops`) — superadmin
- **Holat:** v2
- **Izoh:** Har tab o'z sahifasini (OPS_TABS → pageDir) `embedded` rejimda (sarlavhasiz panel) chizadi. Desktopda 7 tab, telefonda tablar → Select (D8); auth tabi yorlig'i «Kirish diagnostikasi». To'g'ridan-to'g'ri yo'llar: /finance-operators, /identity-ops — ega savoli 1 sukuti bo'yicha o'sha panel + «← Ops vositalari» (/ops?tab=<k>); /investors-ops, /system-ops, /logs — 2026-10-30 dan /ops?tab=<k> ga, /integrations-ops — 2026-11-01 dan /integrations ga (Dj70iDbD), /logistics-ops va /branch-ops — 2026-10-31 dan /returns va /batches ga yo'naltiradi; «Logistika» va «Filiallar» tablari o'sha sahifalarga ko'chdi (faqat superadmin, F2NzXpMv, TC matni bo'yicha — maketda ops ichida, ega tasdig'i kutilmoqda), «Tizim» → «Tizim holati», «Integratsiyalar» → «Integratsiya vositalari», «Token orqali tekshirish» olindi, SLA va «Analitika KPI» superadmin bosh sahifasiga ko'chdi (kartalar F2NzXpMv «ikki eshik», bhitm9do; guard o'sha, eski havola buzilmaydi). «Xarajat kategoriyalari» (?tab=expense-categories, Elchi Pochta №1; 2026-10-23 da «Asosiy kassa» sarlavhasidagi tugma + oynadan ko'chirildi; moliya guruhida — «Moliya operatorlari» dan keyin) — hub ichida tug'ilgan tab, to'g'ridan-to'g'ri eski yo'li yo'q (tab maslahatida «Eski manzil» yo'q): OpsIntro + «Kategoriyalar» kartasi (son, bitta asosiy amal «Kategoriya qo'shish» — ro'yxat yuklanmaguncha o'chiq; faol kategoriyalar sort_order bo'yicha: tartib raqami, nom, «Nimalar kiradi», Pencil / qizil Trash2), qo'shish / tahrirlash oynasi (Nomi *, Nimalar kiradi, Tartib raqami; tahrirda faqat o'zgargan maydonlar; 409 — «Nomi» ostida, 404 — xabar), o'chirish — useConfirm (danger, tarix nomni saqlaydi); bo'sh / xato / yuklanish — QueryBoundary. GET|POST|PATCH|DELETE finance/cashbox/expense-categories (CRUD faqat superadmin). Maket yo'q — eng yaqini: superadmin-ops-investors (ro'yxat kartasi + qo'shish), qator amallari va o'chirish tasdig'i superadmin-products-delete-dialog, forma tizim-states-forms. «Kassadan xarajat» oynasida faol kategoriya yo'q bo'lsa superadmin havolasi shu tabga olib keladi. «Yetkazish narxi» (?tab=delivery-pricing, ega 2026-10-25 — «qaysi hajmdan boshlab narx hajmga qarab hisoblanadi» boshqaruvi Ops vositalarida; «Logistika» dan keyin) — /delivery-tariffs sahifasi (pages/delivery-tariffs) `embedded` bilan: sarlavha va «← Hududlar» o'rniga OpsIntro («Yetkazish narxi — tariflar va hisob qoidalari», «Xuddi shu bo'lim: Hududlar → Yetkazish tariflari»), tanasi — o'sha DeliveryTariffsContent (tariflar + «O'zgartirish» oynasi, «Hisob qoidalari» — «Hajm bo'yicha hisoblash chegarasi» (volumetric_from_kg) ham, kalkulyator, tarix). To'g'ridan-to'g'ri eski ops yo'li yo'q (tab maslahatida «Eski manzil» yo'q): /delivery-tariffs — Hududlar bo'limining o'z sahifasi (admin ham). Maket yo'q — eng yaqini: superadmin-regions-delivery-tariffs. ?tab=logistics: Tanlangan qaytarish so'rovlarini tasdiqlash — POST post/return-requests/approve { order_ids }. Ega tasdig'i 2026-10-19 (ops-system): tasdiq oynasi (*-ops-logistics-approve-dialog), natija — faqat toast «N ta tasdiqlandi, M tasi o'tkazib yuborildi» (S5) va yangilangan (bo'sh) ro'yxat (*-approve-result; alohida natija ro'yxati yo'q). OS-3: kodda — useConfirm + ApproveReturnSummary (HQ/filial — data.scope.type), natija notify.warning/success (skipped_order_ids), bo'sh ro'yxat EmptyState; maketdagi CircleCheckBig o'rniga ikonka reyestridagi CircleCheck. ?tab=branches: Paketni bekor qilish — tasdiq oynasi. ?tab=system: «Kuryer samaradorligi» (D3, ega savoli 5 — sukut): API foiz bermaydi (analytics courierEfficiency = kuryerga o'rtacha buyurtma soni) — «O'rtacha N ta buyurtma», maketdagi halqa chizilmaydi. Yetkazish bo'lmaganda backend onTimeRate = 0 yuboradi (0% ko'rinadi). Ega tasdig'i 2026-10-19 (ops-system): asosiy xizmatlar Identity, Order, Finance, Logistics — biri ishlamasa «Ishlamayapti» (S1, *-ops-system-critical / -down); holatlar: yuklanish, xato, qisman (zaif AI modeli), AI limiti tugadi (*-ai-cap; limitni oshirish faqat serverda, Ops'da tugma yo'q — S2), kalit yo'q / noto'g'ri — «AI o'chiq» va «AI bilan» tabi yashiriladi (S3, *-ai-config). Dollar summalari formatMoney + valyuta («12,40 $», S4). OS-2: «AI holati» — GET ai/status (silentError) + gateway bayrog'i GET orders/ai-availability (enabled:false → «AI o'chiq», maket yo'q — eng yaqini *-ops-system-error); dollar — formatUsdLocalized (en «$12.40» — ega javob bermagan, sukut); «80% dan oshdi» — backend sukuti AI_CAP_WARN_RATIO 0,8; xato 504 — ichki ogohlantirish (*-down), boshqasi — bo'sh holat (*-critical); limit holati o'qilmasa (cap.state unknown) — «Noma'lum» + ogohlantirish (maket yo'q). *-critical bo'sh holati — maketdagidek neytral ikonka (EmptyState, ErrorState emas). Maketdagi ogohlantirish badge'laridagi lucide circle-alert («80% dan oshdi», yozilmagan chaqiruvlar) o'rniga ikonka reyestridagi TriangleAlert (reyestrda CircleAlert yo'q); circle-help o'rniga CircleQuestionMark. ?tab=auth: Faoliyat jurnali — /activity-logs (kirish kartasidagi havola).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/ops` | superadmin | `superadmin-ops-finance-operators` — Ops — Moliya operatorlari | [design/fragments/superadmin--ops-finance-operators.html](fragments/superadmin--ops-finance-operators.html) | sahifa | v2 |
| `/ops` | superadmin | `superadmin-ops-investors` — Ops — Investorlar | [design/fragments/superadmin--ops-investors.html](fragments/superadmin--ops-investors.html) | sahifa | v2 |
| `/ops` | superadmin | `superadmin-ops-identity` — Ops — Xodimlar ro'yxatlari | [design/fragments/superadmin--ops-identity.html](fragments/superadmin--ops-identity.html) | sahifa | qisman |
| `/ops` | superadmin | `superadmin-ops-system` — Ops — Tizim | [design/fragments/superadmin--ops-system.html](fragments/superadmin--ops-system.html) | sahifa | qisman |
| `/ops` | superadmin | `superadmin-ops-system-loading` — Ops — Tizim: yuklanish<br>↳ `src/pages/system-ops/ui/HealthCard.tsx`, `src/pages/system-ops/ui/AiStatusCard.tsx` | [design/fragments/superadmin--ops-system-loading.html](fragments/superadmin--ops-system-loading.html) | sahifa | v2 |
| `/ops` | superadmin | `superadmin-ops-system-error` — Ops — Tizim: holatni olib bo'lmadi, AI o'chiq<br>↳ `src/pages/system-ops/ui/HealthCard.tsx`, `src/pages/system-ops/ui/AiStatusCard.tsx` | [design/fragments/superadmin--ops-system-error.html](fragments/superadmin--ops-system-error.html) | sahifa | v2 |
| `/ops` | superadmin | `superadmin-ops-system-partial` — Ops — Tizim: qisman ishlayapti, zaif AI modeli<br>↳ `src/pages/system-ops/ui/HealthCard.tsx`, `src/pages/system-ops/ui/AiStatusCard.tsx` | [design/fragments/superadmin--ops-system-partial.html](fragments/superadmin--ops-system-partial.html) | sahifa | v2 |
| `/ops` | superadmin | `superadmin-ops-system-down` — Ops — Tizim: xizmatlar ishlamayapti<br>↳ `src/pages/system-ops/ui/HealthCard.tsx`, `src/pages/system-ops/ui/AiStatusCard.tsx` | [design/fragments/superadmin--ops-system-down.html](fragments/superadmin--ops-system-down.html) | sahifa | v2 |
| `/ops` | superadmin | `superadmin-ops-system-critical` — Ops — Tizim: asosiy xizmat ishlamayapti, AI ulanmagan<br>↳ `src/pages/system-ops/ui/HealthCard.tsx`, `src/pages/system-ops/ui/AiStatusCard.tsx` | [design/fragments/superadmin--ops-system-critical.html](fragments/superadmin--ops-system-critical.html) | sahifa | v2 |
| `/ops` | superadmin | `superadmin-ops-system-ai-config` — Ops — Tizim: kalit nomi noto'g'ri, noma'lum model<br>↳ `src/pages/system-ops/ui/AiStatusCard.tsx` | [design/fragments/superadmin--ops-system-ai-config.html](fragments/superadmin--ops-system-ai-config.html) | sahifa | v2 |
| `/ops` | superadmin | `superadmin-ops-system-ai-cap` — Ops — Tizim: AI kunlik limiti tugadi<br>↳ `src/pages/system-ops/ui/AiStatusCard.tsx` | [design/fragments/superadmin--ops-system-ai-cap.html](fragments/superadmin--ops-system-ai-cap.html) | sahifa | v2 |
| `/ops` | superadmin | `superadmin-ops-auth-diagnostics` — Ops — Auth diagnostikasi | [design/fragments/superadmin--ops-auth-diagnostics.html](fragments/superadmin--ops-auth-diagnostics.html) | sahifa | v2 |

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

- **Fayllar:** `src/pages/finance-operators/index.tsx` · `src/pages/finance-operators/ui/OperatorBalanceCard.tsx` · `src/pages/finance-operators/lib/operatorFinance.ts`
- **Qobiq:** DashboardLayout · **Guard:** `canViewOpsPages` (routes.tsx → canViewOpsPages)
- **Rollar:** superadmin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Dizayn v2 (G2): /ops?tab=<k> paneli bilan bir xil + «← Ops vositalari» (ega savoli 1 — sukut). «To'lovni saqlash» — tasdiq oynasi (D10, pul qoidasi; maketda oyna yo'q — tizim-states-forms + Moliya tasdiq naqshi) va Idempotency-Key (bitta mantiqiy to'lov — bitta kalit, xatodan keyin qayta urinishda o'sha kalit; muvaffaqiyat xabaridagi summa server javobidan). «Ishlab topgan va to'langan» yig'ma grafigi — Taklif, chizilmaydi.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/finance-operators` | superadmin | `superadmin-ops-finance-operators` — Ops — Moliya operatorlari | [design/fragments/superadmin--ops-finance-operators.html](fragments/superadmin--ops-finance-operators.html) | sahifa | v2 |

#### `/identity-ops` — Ops — Xodimlar ro'yxatlari

- **Fayllar:** `src/pages/identity-ops/index.tsx`
- **Qobiq:** DashboardLayout · **Guard:** `canViewOpsPages` (routes.tsx → canViewOpsPages)
- **Rollar:** superadmin
- **Menyuda:** yo'q — sahifa ichidagi havola yoki URL orqali ochiladi
- **Holat:** v2
- **Izoh:** Dizayn v2 (G2): /ops?tab=<k> paneli bilan bir xil + «← Ops vositalari» (ega savoli 1 — sukut).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/identity-ops` | superadmin | `superadmin-ops-identity` — Ops — Xodimlar ro'yxatlari | [design/fragments/superadmin--ops-identity.html](fragments/superadmin--ops-identity.html) | sahifa | qisman |

### Profil, sozlamalar, bildirishnomalar qutisi

#### `/profile` — Profil (yuqori panel → profil menyusi)

- **Fayllar:** `src/pages/profile/ui/ProfilePage.tsx` · `src/pages/profile/ui/ProfileCards.tsx` · `src/pages/profile/ui/ProfileSessionsCard.tsx` · `src/pages/profile/ui/ChangePasswordDialog.tsx` · `src/pages/profile/ui/EditProfileDialog.tsx` · `src/pages/profile/lib/salaryCycle.ts` · `src/pages/profile/lib/profileView.ts` · `src/features/telegram-link/ui/TelegramLinkCard.tsx` · `src/features/telegram-link/ui/TelegramLinkDialog.tsx` · `src/features/telegram-link/ui/LinkCountdown.tsx` · `src/features/telegram-link/ui/LinkQrPanel.tsx` · `src/widgets/user-detail/ui/MarketTelegramGroupsCard.tsx` · `src/features/telegram-link/ui/MarketGroupLinkDialog.tsx`
- **Qobiq:** DashboardLayout · **Guard:** yo'q (faqat kirish)
- **Rollar:** superadmin, admin, manager, registrator, market, market_operator, courier, logist, investor
- **Menyuda:** yo'q — yuqori panel → ism/avatar (profil)
- **Holat:** v2
- **Izoh:** Dizayn v2 (G2): ma'lumot kartasi (GET /auth/my-profile), maosh bloki faqat salary > 0; parol — alohida oyna (NDmZMzCP: ≥ 8, xodim ≥ 10 belgi, server 400 matni maydon ostida, mos kelish; login/refresh javobida must_change_password: true bo'lsa shu oyna «Yangi parol o'rnating» rejimida (app/providers/PasswordChangePrompt, «Keyinroq» bilan yopiladi — bloklamaydi; maket yo'q — eng yaqini common-profile-password-dialog); 2026-10-23 dan saqlangach boshqa barcha qurilmalar chiqadi, shu qurilma qoladi — «Parol almashtirildi — boshqa qurilmalardan chiqildi», «Sessiyalar» qayta so'raladi; avval shu yerdan ham chiqarilardi); profilni tahrirlash — alohida oyna (Ism, Telefon; D7, maket yo'q: EditProfileDialog `(maket yo'q) common-profile-password-dialog`). UpdateUserModal profilda ishlatilmaydi. «Login» — username bo'lsa. dev birlashtirishi: «Xavfsizlik» ostida yana bir qator — o'z Telegram'ini ulash/uzish (TelegramLinkCard, mijoz/investordan boshqa rollar; POST users/me/telegram/link-code, oyna ochiqligida profil har 3 s) — maket yo'q, eng yaqini «Xavfsizlik» kartasi (`(maket yo'q) common-profile`). Ega tasdig'i 2026-10-19 (tg-link): o'z Telegram'ini ulash — ulanmagan / ulangan holatlari, havola + QR oynasi (muddat bilan), bot nomi yo'q bo'lsa buyruq oynasi, havola eskirsa — qayta yaratish, uzish — tasdiq oynasi (common-profile-telegram*). Market rolida /profile maketi — market-profile (common-profile o'rniga): «Telegram guruhlari» holati (S1 — backendga endpoint so'raladi), har xabar turi qatorida «Ulash» (S5), «Guruhda mijoz ismi va telefoni» kaliti «Telegram guruhi» kartasida (S3). TG-A (2026-10-21) — common-profile-telegram* maket bo'yicha: ulangan holatda qalin «@username» · «{sana} da ulangan»; havola oynasi — QR oq ramkada, muddat sanog'i va progress (LinkCountdown), «Ulanish kutilmoqda…», telefonda boshqa qadamlar va yig'ilgan «Boshqa telefondan — QR kod» (LinkQrPanel); buyruq rejimi (deep_link yo'q) — o'z qadamlari, sanoqsiz, faqat «Yopish»; muddati tugadi — sunken ichida bo'sh holat. Kod olinmasa — faqat i18n izoh (backend matni ko'rsatilmaydi). Havola qismlari (LinkCountdown, LinkQrPanel, useQrImage, requestGroupLinkCode) features/telegram-link da — notification-create shu yerdan oladi. EP-3 (Elchi Pochta #3, 2026-10-22): sahifa oxirida «Sessiyalar» kartasi (ProfileSessionsCard, barcha rollar; maket yo'q — eng yaqini market-profile «Telegram guruhi» qatorlari, `(maket yo'q) market-profile, common-profile`) — GET /auth/sessions: FAQAT shu hisobning faol sessiyalari, sarlavhada «N ta faol» (active_count), har qatorda qurilma (server yorlig'i, turi joriy tilda; bo'lmasa qisqa User-Agent yoki «Noma'lum qurilma»), «Shu qurilma» badge'i (tepada), IP, «Kirgan vaqti», «Oxirgi faollik» (nisbiy + sana); bo'sh / xato + «Qayta urinish» / skelet; bo'lim ochilganda va oynaga qaytilganda qayta so'raladi, davriy so'rov yo'q. Tizim bo'yicha son yoki boshqa foydalanuvchilar sessiyasi ko'rsatilmaydi. 2026-10-22: boshqa qurilmalarni chiqarish — har «Shu qurilma» bo'lmagan qatorda «Chiqarish» (DELETE /auth/sessions/:id), kamida bitta boshqa sessiya bo'lsa sarlavhada «Boshqa barcha qurilmalardan chiqish» (POST /auth/sessions/revoke-others); ikkalasi tasdiq oynasi (danger, qurilma / soni) bilan, 404 — «allaqachon yopilgan» xabari va ro'yxat yangilanadi, 400 — oyna ichida sabab (eski token — qayta kirish); yopilgan qurilma keyingi so'rovida 401 («Session revoked») → refresh 401 → kirish sahifasida «Sessiya tugadi» ekrani, izohi «Sessiyangiz boshqa qurilmadan yopildi» (maket yo'q — common-session-expired matni almashadi). 2026-10-23: qurilma nomi aniq — mijoz `X-Device-Name` yuboradi (Client Hints: «Samsung SM-A515F · Android 13 · Chrome 155», «Windows 11 · Chrome 154»; Safari/Firefox — User-Agent: «iPhone · iOS 17 · Safari»); shu qurilmada ochiq sessiya qayta kirishda qayta ishlatiladi — «Kirgan vaqti» oxirgi kirish, ostida «Birinchi marta: …» (first_logged_in_at, farq qilsa); status «expired» (qayta kirishi kerak) qatorlar oxirida, xiralashgan (text-muted) + neytral «Qayta kirish kerak» belgisi, «Chiqarish» ular uchun ham; «N ta faol» — faqat faollar; «Boshqa barcha qurilmalardan chiqish» tasdig'idagi son — barcha boshqalar; IP — «Tarmoq IP» (bitta Wi-Fi izohi title'da). Eski backend: status yo'q — faol, first_logged_in_at yo'q — qator chizilmaydi. 2026-10-23 (Telegram kabi qoida): shu qurilmadan birinchi kirganiga 48 soat to'lmagan sessiya boshqalarni chiqara olmaydi — GET /auth/sessions → can_revoke_others: false, revoke_available_at (ISO) va ro'yxatda kamida bitta boshqa sessiya bo'lsa (faqat shu qurilma — ogohlantirish yo'q, boshqasi kelsa chiqadi): kartada .el-alert (info, ShieldCheck) faqat «Xavfsizlik uchun yangi qurilmadan boshqa sessiyalarni chiqarib bo'lmaydi.» (qachon mumkinligi va parol maslahati ko'rsatilmaydi); «Chiqarish» va «Boshqa barcha qurilmalardan chiqish» yashirilmaydi — disabled + aria-describedby (sabab) + title; vaqt o'tsa cheklov o'zi olinadi; maydon yo'q (eski backend) — ruxsat. Baribir 403 SESSION_TOO_NEW (code, available_at — yuqori darajada yoki data/details/error ichida) — tasdiq yopiladi, notify.warning «Hozircha chiqarib bo'lmaydi» + sabab (vaqtsiz; server matnidagi sana ko'rsatilmaydi), ro'yxat qayta so'raladi. O'z «Chiqish» i cheklanmaydi. Maket yo'q — eng yaqini market-profile «Telegram guruhi» kartasi + CODE-MAP .el-alert. TG-C (KJNHAlGW, 2026-10-25): market-profile-telegram-status — market «Telegram guruhi» kartasida har tur holati GET /notifications/me/telegram-groups dan (market_id tokendan; javob har doim 2 tur): ulangan — «Ulangan» + «{sana} dan» (linked_at; kelmasa sanasiz), nofaol — «Nofaol» + /notifications dagi sabab matni va toni (NG-C; inactive_at kelmaydi — sanasiz), ulanmagan — «Ulanmagan» + nima kelmasligi va «Ulash»; ulangan (faol) turda «Ulash» yo'q; BOT-3 #6 (2026-10-30): Telegram sababli nofaol turda (bot chiqarilgan, guruhdan chiqqan, guruh topilmadi, yuborishda rad) «Qayta ulash» — o'sha oyna, kuzatuv ulanish faollashguncha kutadi; admin o'chirgan yoki sababi noma'lum — tugma yo'q (maket yo'q — eng yaqini market-profile-telegram-status); BOT-2: guruhni boshqa xodim ulagan bo'lsa (linked_by_owner: false) egaga «Bu guruhni siz ulamagansiz …» ogohlantirishi; yuklanishda skelet, xatoda ErrorState + «Qayta urinish». Market o'z «Ulash» oynasi (market-profile-telegram-group-dialog) endi «Guruh ulanishi kutilmoqda…» va 3-qadam «holat shu yerda yangilanadi»: oyna ochiq va havola amalda ekan har 4 s shu endpoint so'raladi, tur ulansa oyna o'zi yopiladi va «Guruh ulandi»; oyna yopilsa yoki muddat tugasa (expired-dialog) so'rov to'xtaydi. Maketdagi «Taklif · holat uchun backend kerak» belgisi chizilmaydi. market_operator profilida karta yo'q (maket yo'q — ega qarori kutiladi).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/profile` | market | `market-profile` — Profil — Telegram guruhlari holati (ulanmagan; taklif · backend kerak) | [design/fragments/market--profile.html](fragments/market--profile.html) | sahifa | qisman |
| `/profile` | market | `market-profile-telegram-status` — Profil — Telegram guruhi: biri ulangan (taklif · backend kerak) | [design/fragments/market--profile-telegram-status.html](fragments/market--profile-telegram-status.html) | sahifa | yangi (kodda yo'q) |
| `/profile` | market | `market-profile-telegram-group-dialog` — Telegram guruhini ulash (havola, QR, holat kutilmoqda)<br>↳ `src/features/telegram-link/ui/MarketGroupLinkDialog.tsx` | [design/fragments/market--profile-telegram-group-dialog.html](fragments/market--profile-telegram-group-dialog.html) | oyna | qisman |
| `/profile` | market | `market-profile-telegram-group-expired-dialog` — Telegram guruhini ulash — havola muddati tugadi<br>↳ `src/features/telegram-link/ui/MarketGroupLinkDialog.tsx` | [design/fragments/market--profile-telegram-group-expired-dialog.html](fragments/market--profile-telegram-group-expired-dialog.html) | oyna | v2 |
| `/profile` | market | `market-profile-contacts` — Profil — «Elchi mas'ulingiz» kartasi | [design/fragments/market--profile-contacts.html](fragments/market--profile-contacts.html) | sahifa | yangi (kodda yo'q) |
| `/profile` | courier | `courier-profile-contacts` — Profil — «Viloyatingiz logisti» kartasi | [design/fragments/courier--profile-contacts.html](fragments/courier--profile-contacts.html) | sahifa | yangi (kodda yo'q) |
| `/profile` | umumiy (barcha rollar) | `common-profile` — Profil | [design/fragments/common--profile.html](fragments/common--profile.html) | sahifa | v2 |
| `/profile` | umumiy (barcha rollar) | `common-profile-password-dialog` — Profil — parolni o'zgartirish<br>↳ `src/pages/profile/ui/ChangePasswordDialog.tsx` | [design/fragments/common--profile-password-dialog.html](fragments/common--profile-password-dialog.html) | oyna | v2 |
| `/profile` | umumiy (barcha rollar) | `common-profile-telegram` — Profil — Telegram ulanmagan<br>↳ `src/features/telegram-link/ui/TelegramLinkCard.tsx` | [design/fragments/common--profile-telegram.html](fragments/common--profile-telegram.html) | sahifa | v2 |
| `/profile` | umumiy (barcha rollar) | `common-profile-telegram-link-dialog` — Profil — Telegram'ni ulash (havola, QR, muddat)<br>↳ `src/features/telegram-link/ui/TelegramLinkDialog.tsx` | [design/fragments/common--profile-telegram-link-dialog.html](fragments/common--profile-telegram-link-dialog.html) | oyna | v2 |
| `/profile` | umumiy (barcha rollar) | `common-profile-telegram-command-dialog` — Profil — Telegram'ni ulash (bot nomi yo'q: buyruq)<br>↳ `src/features/telegram-link/ui/TelegramLinkDialog.tsx` | [design/fragments/common--profile-telegram-command-dialog.html](fragments/common--profile-telegram-command-dialog.html) | oyna | v2 |
| `/profile` | umumiy (barcha rollar) | `common-profile-telegram-expired-dialog` — Profil — Telegram havolasi eskirdi<br>↳ `src/features/telegram-link/ui/TelegramLinkDialog.tsx` | [design/fragments/common--profile-telegram-expired-dialog.html](fragments/common--profile-telegram-expired-dialog.html) | oyna | v2 |
| `/profile` | umumiy (barcha rollar) | `common-profile-telegram-linked` — Profil — Telegram ulangan (+ «Telegram ulandi» xabari)<br>↳ `src/features/telegram-link/ui/TelegramLinkCard.tsx` | [design/fragments/common--profile-telegram-linked.html](fragments/common--profile-telegram-linked.html) | sahifa | v2 |
| `/profile` | umumiy (barcha rollar) | `common-profile-telegram-unlink-dialog` — Profil — Telegram'ni uzish (tasdiq)<br>↳ `src/features/telegram-link/ui/TelegramLinkCard.tsx` | [design/fragments/common--profile-telegram-unlink-dialog.html](fragments/common--profile-telegram-unlink-dialog.html) | oyna | v2 |
| `/profile` | tizim taxtasi | `tizim-contact-card` — Aloqa kartasi va «Muammo bo'lsa» — holatlar | [design/fragments/tizim--contact-card.html](fragments/tizim--contact-card.html) | taxta | qoida |

#### `/settings` — Sozlamalar — Ko'rinish · Bosh sahifa · Interfeys · Skaner · Bildirishnomalar (dizayn v2)

- **Fayllar:** `src/pages/settings/ui/SettingsPage.tsx` · `src/pages/settings/ui/settingsUi.tsx` · `src/pages/settings/ui/AppearancePanel.tsx` · `src/pages/settings/ui/DashboardPanel.tsx` · `src/pages/settings/ui/InterfacePanel.tsx` · `src/pages/settings/ui/ScannerPanel.tsx` · `src/pages/settings/ui/NotificationsPanel.tsx` · `src/features/push-notifications/ui/PushPermissionButton.tsx` · `src/features/pwa-install/ui/AppInstallStatusBlock.tsx` · `src/features/pwa-install/ui/IosInstallDialog.tsx`
- **Qobiq:** DashboardLayout · **Guard:** yo'q (faqat kirish)
- **Rollar:** superadmin, admin, manager, registrator, market, market_operator, courier, logist, investor
- **Menyuda:** yo'q — yuqori panel → «Sozlamalar» tugmasi; telefon menyusi
- **Holat:** v2
- **Izoh:** Dizayn v2 (G2): 5 tab (desktopda chap navigatsiya, telefonda gorizontal), komponent holatida — URL'da emas; «Saqlandi» belgisi, mavzu/til darhol. «Skaner» alohida tab (D5): ovozlar «Interfeys» dan ko'chdi; «Kamera» kartasi — skaner 4-bosqichi (common-settings-scanner): «Kamerani sinash» → /scan (marketda yo'q), asosiy kamera, «Chiroq — avtomatik» (ega qarori: yorug'lik kam bo'lsa yoqish taklifi, o'zi yoqilmaydi — izoh matni shunga moslangan), «Uzluksiz skanerlash» (o'chiq — oqim kamerasi bitta koddan keyin yopiladi), «Ovoz», «Tebranish», «Ramka o'lchami» (ramka va skan hududi); hisobga saqlanadi (entities/settings scanner.camera / scanner.feedback, backend jsonb ochiq) + localStorage ko'zgusi — maketdagi «shu qurilmada saqlanadi» o'rniga «hisobingizda saqlanadi». Tab izohi maketdagidek «Kamera, ovoz va tebranish». Ega savoli 3 — sukut: «Bildirishnomalar» tabida maketdagi qurilma blokidan keyin kodda bor kanallar / kategoriyalar / reklama / sokin soatlar maket uslubidagi kartalarda saqlanadi. «Bosh sahifa bloklari» tartibi bosh sahifadagi (G1) tartib bilan bir xil; «Buyurtmalar vaqti» — Taklif, chizilmaydi. KI-2 (2026-10-21, ega javobi KI-S3 «Sozlamalarda doim»): «Bildirishnomalar» tabida qurilma blokidan keyin «Ilova» kartasi (AppInstallStatusBlock, features/pwa-install; faqat mijoz tomoni — manifest.webmanifest va sw.js bor, backend kerak emas) — «O'rnatilgan» (display-mode: standalone yoki shu qurilmada appinstalled) / «O'rnatilmagan» + «O'rnatish» (beforeinstallprompt, main.tsx da chizishdan oldin ushlanadi) / iOS va iPadOS — «Qanday qo'shiladi» → IosInstallDialog (courier-inbox-pwa-ios-dialog) / brauzer qo'llab-quvvatlamasa — «Qo'llab-quvvatlanmaydi», tugmasiz; tab izohi «Shu qurilmaga xabarlar · ilova». Maketdagi «Boshqa holatlar» bloki — dizayn taxtasi (holatlar namunasi), kodda bir vaqtda faqat joriy holat chiziladi.

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/settings` | umumiy (barcha rollar) | `common-settings-appearance` — Sozlamalar — Ko'rinish | [design/fragments/common--settings-appearance.html](fragments/common--settings-appearance.html) | sahifa | v2 |
| `/settings` | umumiy (barcha rollar) | `common-settings-dashboard` — Sozlamalar — Bosh sahifa bloklari | [design/fragments/common--settings-dashboard.html](fragments/common--settings-dashboard.html) | sahifa | v2 |
| `/settings` | umumiy (barcha rollar) | `common-settings-interface` — Sozlamalar — Interfeys | [design/fragments/common--settings-interface.html](fragments/common--settings-interface.html) | sahifa | v2 |
| `/settings` | umumiy (barcha rollar) | `common-settings-scanner` — Sozlamalar — Skaner (kamera va ovoz) | [design/fragments/common--settings-scanner.html](fragments/common--settings-scanner.html) | sahifa | v2 |
| `/settings` | umumiy (barcha rollar) | `common-settings-notifications` — Sozlamalar — Bildirishnomalar | [design/fragments/common--settings-notifications.html](fragments/common--settings-notifications.html) | sahifa | v2 |
| `/settings` | umumiy (barcha rollar) | `common-settings-notifications-pwa` — Sozlamalar — Bildirishnomalar · ilova o'rnatilgan / o'rnatilmagan<br>↳ `src/features/pwa-install/ui/AppInstallStatusBlock.tsx` | [design/fragments/common--settings-notifications-pwa.html](fragments/common--settings-notifications-pwa.html) | sahifa | v2 |
| `/settings` | umumiy (barcha rollar) | `common-settings-scanner-feedback` — Sozlamalar — Skaner: rangli effekt va ovozlar | [design/fragments/common--settings-scanner-feedback.html](fragments/common--settings-scanner-feedback.html) | sahifa | yangi (kodda yo'q) |

#### `/inbox` — Bildirishnomalar qutisi (qo'ng'iroqcha manzili)

- **Fayllar:** `src/pages/notifications/ui/NotificationInboxPage.tsx` · `src/widgets/notification-inbox/ui/NotificationInboxList.tsx` · `src/widgets/notification-inbox/ui/NotificationInboxItem.tsx` · `src/widgets/notification-inbox/ui/NotificationItemMenu.tsx` · `src/features/push-notifications/ui/PushPermissionButton.tsx` · `src/features/push-notifications/ui/PushExplainDialog.tsx` · `src/features/pwa-install/ui/InstallAppCard.tsx` · `src/features/pwa-install/ui/IosInstallDialog.tsx`
- **Qobiq:** DashboardLayout · **Guard:** yo'q (faqat kirish)
- **Rollar:** superadmin, admin, manager, registrator, market, market_operator, courier, logist, investor
- **Menyuda:** yo'q — yuqori panel → qo'ng'iroqcha; telefon menyusi
- **Holat:** v2
- **Izoh:** Dizayn v2 (G2): tablar, kategoriya chiplari (URL'da), «Faqat muhim», qator amallari, sahifalash; push holat bloki barcha rollarda holatga qarab (D4). Sarlavha: superadminda «Bildirishnomalar qutisi» (maket superadmin-notifications-inbox, 17HWafL7 — ega savoli 9 sukuti o'rniga), boshqa rollarda «Bildirishnomalar»; «SMS» va «Xabar yuborish» faqat canSendNotifications. Push ruxsati tushuntirish oynasi — PushExplainDialog (sozlamalarda ham). KI-2 (2026-10-21, ega javobi KI-S3): «Ilovani o'rnatish» kartasi (InstallAppCard placement=inbox, features/pwa-install) — barcha rollarda, push blokidan keyin, doim (yopishsiz; maketdagidek faqat «O'rnatish»), faqat ilova o'rnatilmagan va o'rnatish mumkin bo'lsa: Android/kompyuter — «O'rnatish» (ikkinchi darajali tugma, beforeinstallprompt; brauzer oynasi oldin yopilgan bo'lsa — brauzer menyusidan o'rnatish izohi, notify.info) — courier-inbox-pwa-install; iPhone/iPad — «Elchi'ni bosh ekranga qo'shing» + «Qanday qo'shiladi» → 3 qadamli oyna «Bosh ekranga qo'shing» («Keyinroq» / «Tushunarli», telefonda pastki varaqa) — courier-inbox-pwa-ios-dialog. iOS Safari tabida PushManager yo'q — push bloki o'zi chiqmaydi, uning o'rnida o'rnatish kartasi turadi. O'rnatilgan yoki qo'llab-quvvatlanmaydigan brauzerda karta yo'q (holat — Sozlamalar → Bildirishnomalar → «Ilova»).

| Route | Rol | Maket (`npm run design:shot -- <nom>`) | Fragment | Tur | Holat |
|---|---|---|---|---|---|
| `/inbox` | superadmin | `superadmin-notifications-inbox` — Bildirishnomalar — Inbox (qo'ng'iroqcha) | [design/fragments/superadmin--notifications-inbox.html](fragments/superadmin--notifications-inbox.html) | sahifa | v2 |
| `/inbox` | superadmin | `superadmin-notifications-push-explain-dialog` — Bildirishnomalarni yoqasizmi? (tasdiq)<br>↳ `src/features/push-notifications/ui/PushExplainDialog.tsx` | [design/fragments/superadmin--notifications-push-explain-dialog.html](fragments/superadmin--notifications-push-explain-dialog.html) | oyna | v2 |
| `/inbox` | courier | `courier-inbox-list` — Bildirishnomalar | [design/fragments/courier--inbox-list.html](fragments/courier--inbox-list.html) | sahifa | v2 |
| `/inbox` | courier | `courier-inbox-push-explain-dialog` — Bildirishnomalarni yoqish oynasi<br>↳ `src/features/push-notifications/ui/PushExplainDialog.tsx` | [design/fragments/courier--inbox-push-explain-dialog.html](fragments/courier--inbox-push-explain-dialog.html) | oyna | v2 |
| `/inbox` | courier | `courier-inbox-pwa-install` — Bildirishnomalar — ilovani o'rnatish taklifi (Android / kompyuter)<br>↳ `src/features/pwa-install/ui/InstallAppCard.tsx` | [design/fragments/courier--inbox-pwa-install.html](fragments/courier--inbox-pwa-install.html) | sahifa | v2 |
| `/inbox` | courier | `courier-inbox-pwa-ios-dialog` — Bosh ekranga qo'shish oynasi (iPhone / iPad)<br>↳ `src/features/pwa-install/ui/IosInstallDialog.tsx` | [design/fragments/courier--inbox-pwa-ios-dialog.html](fragments/courier--inbox-pwa-ios-dialog.html) | oyna · faqat planshet + telefon | v2 |
| `/inbox` | umumiy (barcha rollar) | `common-inbox` — Bildirishnomalar qutisi | [design/fragments/common--inbox.html](fragments/common--inbox.html) | sahifa | v2 |

## 3. Yo'naltirishlar (eski havolalar)

Bu yo'llar sahifa emas — routes.tsx ularni yangi joyga yo'naltiradi (xatcho'p va tashqi havolalar buzilmasin). Maket — yangi joyniki.

| Eski yo'l | → Yangi joy | Guard |
|---|---|---|
| `/integrations` | `/integrations/connections?scope=partner` | — |
| `/integrations/incoming` | `/new-orders/incoming` | — |
| `/integrations-ops` | `/integrations` | `canViewOpsPages` |
| `/investors-ops` | `/ops?tab=investors` | `canViewOpsPages` |
| `/logistics-ops` | `/returns` | `canViewOpsPages` |
| `/branch-ops` | `/batches` | `canViewOpsPages` |
| `/system-ops` | `/ops?tab=system` | `canViewOpsPages` |
| `/orders/add` | `/new-orders/create` | — |
| `/orders/create` | `/new-orders/create` | — |
| `/orders/:orderId` | `/orders/edit/:orderId` | `canViewOrders` |
| `/new-orders/external` | `/integrations/sources` | `canCreateOrdersByRoleAndBranchType` |
| `/new-orders/external/:id` | `/integrations/sources` | `canCreateOrdersByRoleAndBranchType` |
| `/new-orders/integrations` | `/integrations/sources` | `canCreateOrdersByRoleAndBranchType` |
| `/new-orders/integrations/incoming` | `/new-orders/incoming` | `canCreateOrdersByRoleAndBranchType` |
| `/new-orders/integrations/create` | `/integrations/sources/create` | `canCreateOrdersByRoleAndBranchType` |
| `/new-orders/branches/:branchId/:batchId` | `/new-orders/branches/:branchId/batches/:batchId` | `canCreateOrdersByRoleAndBranchType` → `canViewAdminNewOrderTabs` |
| `/new-orders/integrations/:id` | `/integrations/sources/:id` | `canCreateOrdersByRoleAndBranchType` |
| `/payments/shift-report/:id` | `/payments/shifts/:id` | — |
| `/notification` | `/notifications` | — |
| `/logs` | `/ops?tab=auth` | `canViewLogs` |
| `*` | `/404` | — |

## 4. Maket → kod (teskari, rollar bo'yicha)

Har maket qaysi route/faylda yashaydi. `yangi (kodda yo'q)` — maket chizilgan, kod hali yo'q: route ustuni u qayerga qo'shilishini ko'rsatadi.

### superadmin — Superadmin

287 ta maket · kodda bor: 244 · kodda yo'q: 43

| Maket | Sarlavha | Tur | Route | Asosiy fayl | Holat |
|---|---|---|---|---|---|
| `superadmin-dashboard-main` | Dashboard — Bugungi statistika | sahifa | `/` | `src/pages/dashboard/DashboardPage.tsx` | v2 |
| `superadmin-dashboard-region-modal` | Dashboard — Viloyat tafsiloti (xarita) | oyna | `/` | `src/widgets/region-detail/ui/RegionDetailDialog.tsx` | v2 |
| `superadmin-orders-list` | Buyurtmalar ro'yxati | sahifa | `/orders` | `src/pages/orders/index.tsx` | qisman — Bekor qatorlarida bosqich badge'i (Bekor · kuryerda / yo'lda / filialda / HQ'da — danger + ikonka; «Marketga topshirildi» — neutral, PackageCheck) va ostida joy qatori «Urgut filiali · 2 kun»; muddat 3 kunda warning, 7 kunda + TriangleAlert (BG7) (taklif «Bekor holatlari» (ega 2026-10-19, Trello vOczoOUE; elchi-v2-specs/bekor-holatlari-taklif.md)) — kodda hali eski «Bekor qilingan» badge'i. |
| `superadmin-orders-list-cancelled` | Buyurtmalar — Bekor qilinganlar: bosqich va joy (taklif) | sahifa | `/orders` | `src/pages/orders/index.tsx` | qisman — «Bekor qilingan» tabi (taklif «Bekor holatlari» (ega 2026-10-19, Trello vOczoOUE; elchi-v2-specs/bekor-holatlari-taklif.md)): bosqich badge'i va ostida joy qatori — backend `cancel_return` (BG1: joy nomi hamma rolda, «N kun» — `received_at`; «Marketga topshirildi» — vaqt va usul, BG2), 3 kunda warning, 7 kunda + TriangleAlert, «Eskalatsiya» / «Marketga eslatildi (sana)» (BG7, xodim ro'yxatida). Chiplar «Barchasi · Kuryerda · Yo'lda · Filialda · HQ'da · Topshirilgan» → `GET /orders?cancel_stage=` (BG4; `status` yuborilmaydi; «Barchasi» — tabning o'zi). Qisman: chip sonlari — backend bosqich bo'yicha son bermaydi, sonsiz. |
| `superadmin-orders-list-skip-link` | Buyurtmalar ro'yxati — «Asosiy kontentga o'tish» havolasi fokusda | sahifa | `/orders` | `src/widgets/layout/ui/SkipLink.tsx` | v2 |
| `superadmin-orders-list-refreshing` | Buyurtmalar ro'yxati — yangilanmoqda | sahifa | `/orders` | `src/pages/orders/index.tsx` | qisman — Kodda bor (OR-1): «Yangilanmoqda…» belgisi (400 ms dan keyin), «Yangilash» band, «Oxirgi yangilanish», «Avtomatik yangilanadi». Farq: holat tablari sonlari (va ularning xira holati) chizilmaydi — GET /orders har holat sonini bermaydi (OR-2, backend GaBIPi3Z). |
| `superadmin-orders-list-refresh-error` | Buyurtmalar ro'yxati — yangilanmadi | sahifa | `/orders` | `src/pages/orders/index.tsx` | qisman — Kodda bor (OR-1): «Ro'yxat yangilanmadi» + «Qayta urinish» + ×, eski qatorlar qoladi. Farq: izoh «Ro'yxat eskirgan bo'lishi mumkin.» (tab sonlarisiz) — holat tablari sonlari API'da yo'q (OR-2, backend GaBIPi3Z). |
| `superadmin-orders-filters-mobile` | Buyurtmalar — filtr paneli (telefon) | oyna · faqat telefon | `/orders` | `src/pages/orders/list/OrderFilters.tsx` | v2 |
| `superadmin-orders-detail` | Buyurtma tafsilotlari | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | v2 |
| `superadmin-orders-detail-cancelled` | Buyurtma tafsilotlari — marketga topshirilgan, «Qaytarish yo'li» (taklif) | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | yangi (kodda yo'q) — Tafsilot (taklif «Bekor holatlari» (ega 2026-10-19, Trello vOczoOUE; elchi-v2-specs/bekor-holatlari-taklif.md)): sarlavhada bosqich badge'i + joy qatori; yangi «Qaytarish yo'li» kartasi (widgets/order-return-path, GET /orders/:id/tracking): Bekor qilindi → Jo'natildi (pochta №) → Qabul qilindi (joy, xodim) → Marketga topshirildi (joy, xodim, usul) yoki «kutilmoqda»; filial → HQ zanjirida 2–3 qadam takrorlanadi. Usul «QR orqali» / «Qo'lda tasdiq — sabab» / «QR'siz» tarixdan; ro'yxatda — BG2. «Buyurtma tarixi» yig'ilgan holda. |
| `superadmin-orders-detail-edit-order-dialog` | Buyurtmani tahrirlash (popup) | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/editDialogs/EditOrderDialog.tsx` | v2 |
| `superadmin-orders-detail-edit-customer-dialog` | Mijoz ma'lumotini tahrirlash (popup) | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/editDialogs/EditCustomerDialog.tsx` | v2 |
| `superadmin-orders-detail-edit-address-dialog` | Manzilni tahrirlash (popup) | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/editDialogs/EditAddressDialog.tsx` | v2 |
| `superadmin-neworders-markets` | Qabul va yaratish — Marketlar | sahifa | `/new-orders` | `src/pages/new_orders/markets/index.tsx` | v2 |
| `superadmin-neworders-market-orders` | Market yangi buyurtmalari (qabul) | sahifa | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | v2 |
| `superadmin-neworders-market-orders-camera` | Market yangi buyurtmalari (qabul) — kamera | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | qisman — Kamera v2 — markaziy «Skaner» (planshet/desktopda «Skanerlash») kamerani shu sahifa ustida ochadi (ega qarori 2026-10-19: oqim ichidagi «Kamera bilan skanerlash» / «Kamera» tugmasi yo'q); skan USB bilan bitta handler, kamera har skandan keyin yopilmaydi. Skan = darhol qabul; «Qabul qilindi N · Qoldi M · Topilmadi K», boshqa marketning buyurtmasi rad etiladi, kamera ichida market almashtirish. |
| `superadmin-neworders-receive-confirm-dialog` | Qo'lda qabul qilish (tasdiq) | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | v2 |
| `superadmin-neworders-market-order-edit` | Market buyurtmasini tahrirlash | sahifa | `/new-orders/:marketId/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | v2 |
| `superadmin-neworders-create-manual-step1` | Buyurtma yaratish — 1-qadam: Market | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/Step1Market.tsx` | v2 |
| `superadmin-neworders-create-market-picker-dialog` | Market tanlash (modal) | oyna | `/new-orders/create` | `src/pages/orders/create/ui/MarketPicker.tsx` | v2 |
| `superadmin-neworders-create-manual-step2` | Buyurtma yaratish — 2-qadam: Mijoz va mahsulot | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/Step2Combined.tsx` | v2 |
| `superadmin-neworders-create-manual-step2-existing-customer` | Buyurtma yaratish — 2-qadam: mavjud mijoz, tarif, rasm (taklif) | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/ExistingCustomerNotice.tsx` | qisman — CS-A (hiqRNhkI): «Mavjud mijoz» bloki (kartadan to'ldirildi · N ta buyurtma, oxirgisi …, «Bekor qilish»), viloyat district/:id dan, o'zgarmagan mijoz — customer_id; «Bu mijozda yangi buyurtma bor» + «№id ni yangi oynada ochish». CS-B (IT1YpboR, zRqDRLAZ): yetkazish turi kartalarida market standart narxi («25 000 so'm · standart»; «Narx yo'q» + «standart narx belgilanmagan» ogohlantirishi; sukut tur — default_tariff, qo'lda tanlangani ustidan yozilmaydi; faqat superadmin, admin, market — menejer/registratorga backend tarif bermaydi, N3), mahsulot rasmi 40 px (ProductThumb, entities/product), narx matni («2 × 45 000 so'm», «Narxi kiritilmagan», «Katalogdan tashqari · narxsiz»), «Umumiy summa» avto-taklifi («Mahsulotlar narxidan hisoblandi», qo'lda yozilgach «Mahsulotlar bo'yicha: … · Qo'llash»), xulosada VAQTINCHALIK «Yetkazish narxi» — standart narx (ega tasdig'i kutilmoqda; tanlangan tur narxsiz bo'lsa qator yo'q). Kodda yo'q: taxminiy «≈ …», vazn/hajm izohlari va «og'ir yoki katta posilkada oshadi» (CS-E, DAqXPeSy), «O'zgartirsangiz … «Mijoz kartasi ham yangilansinmi?»» (CS-D, BD2-4). |
| `superadmin-neworders-create-manual-step2-customer-suggest` | Buyurtma yaratish — 2-qadam: mijoz takliflari (taklif) | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/CustomerPhoneSuggest.tsx` | qisman — CS-A (hiqRNhkI): telefon bo'yicha taklif v2 — 7 raqamdan keyin 300 ms, desktopda ro'yxat, telefonda pastki varaqa (faqat natija bo'lsa), qatorda ism · telefon · tuman, «N ta buyurtma», «N ta yangi», «qidirilmoqda» / «topilmadi». «Qo'shimcha raqam: …» — faqat backend matched_by = extra_number bo'lsa (9444UAa8). Kodda yo'q (backend kartasidan keyin, CS-D): «Bu marketda hali buyurtmasi yo'q» + boshqa market mijozlari (BD2-2); shu sabab «Barcha mijozlar» sarlavhasi faqat superadmin/admin da, menejer/registrator — «<market> mijozlari», market — «Sizning mijozlaringiz». |
| `superadmin-neworders-create-manual-step2-customer-update-dialog` | Buyurtma yaratish — 2-qadam: mijoz kartasini yangilash (taklif) | oyna | `/new-orders/create` | `src/pages/orders/create/index.tsx` | yangi (kodda yo'q) — Taklif (create-step2, ega S1..S5) — kodda yo'q: taxminiy narx, mijoz kartasini yangilash tasdig'i; backend narx dvigateli (DAqXPeSy) kerak. |
| `superadmin-neworders-create-ai-input` | Buyurtma yaratish — AI bilan (kiritish) | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiInputPanel.tsx` | v2 |
| `superadmin-neworders-create-ai-preview` | Buyurtma yaratish — AI natijalari (preview) | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiPreviewCard.tsx` | v2 |
| `superadmin-neworders-create-ai-confirm-dialog` | AI — yaratishni tasdiqlash | oyna | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | v2 |
| `superadmin-neworders-incoming-sources` | Kiruvchi posilkalar — manba tanlash | sahifa | `/new-orders/incoming` | `src/pages/incoming-orders/SourcePicker.tsx` | v2 |
| `superadmin-neworders-incoming-scan` | Kiruvchi posilkalar — skanerlab qabul | sahifa | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | qisman — Kodda qop yorlig'i bor («Qop» ustuni, telefon kartasida «Qop …», xulosa «N ta · M ta qop»), skanni olib tashlash va «Qaytarish» — v2; «2/3» belgisi va «N ta qop chala keldi» bloki — backend kerak (har qop uchun received_count, BD2-7 → IP-2). «Kamera» / «Kamera bilan skanerlash» tugmalari chizilmaydi (ega qarori 2026-10-19 — markaziy «Skaner»). |
| `superadmin-neworders-incoming-scan-camera` | Kiruvchi posilkalar — skanerlab qabul — kamera | oyna | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | qisman — Kamera v2 — markaziy «Skaner» (planshet/desktopda «Skanerlash») kamerani shu sahifa ustida ochadi (ega qarori 2026-10-19: oqim ichidagi «Kamera bilan skanerlash» / «Kamera» tugmasi yo'q); skan USB bilan bitta handler, kamera har skandan keyin yopilmaydi. Skan faqat belgilaydi, qabul — sahifadagi «Qabul qilish»; kamera ichida manba almashtirish, «Qopda yetishmaydi». |
| `superadmin-neworders-incoming-scan-partial` | Kiruvchi posilkalar — chala qop ogohlantirishi | sahifa | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | v2 |
| `superadmin-neworders-incoming-scan-partial-confirm-dialog` | Kiruvchi posilkalar — chala qop bilan qabul tasdig'i | oyna | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | v2 |
| `superadmin-neworders-incoming-scan-undo` | Kiruvchi posilkalar — skan olib tashlandi | sahifa | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | qisman — Kodda bor (IP-1): qatordagi Undo2 «Olib tashlash», skan xabarida «Olib tashlash» (qop skanida faqat shu skan belgilaganlar), 5 soniyalik «Qaytarish» xabari. Farq: xabar umumiy notify bilan — maketdagi Undo2 ikonka va ikkinchi darajali «Qaytarish» tugmasi o'rniga info ikonka va havola-tugma (Toaster'ni kengaytirish — umumiy qatlam, ega roziligi kerak). |
| `superadmin-neworders-branches` | Filial batchlari — filiallar | sahifa | `/new-orders/branches` | `src/pages/new_orders/branches/index.tsx` | v2 |
| `superadmin-neworders-branch-batches` | Filial batchlari ro'yxati | sahifa | `/new-orders/branches/:branchId` | `src/pages/new_orders/branches/batches.tsx` | v2 |
| `superadmin-neworders-branch-batch-detail` | Filial paketi tafsiloti | sahifa | `/new-orders/branches/:branchId/batches/:batchId` | `src/pages/new_orders/branches/batchDetail.tsx` | v2 |
| `superadmin-neworders-branch-batch-detail-camera` | Filial paketi tafsiloti — kamera | oyna | `/new-orders/branches/:branchId/batches/:batchId` | `src/pages/new_orders/branches/batchDetail.tsx` | qisman — Kamera v2 — markaziy «Skaner» (planshet/desktopda «Skanerlash») kamerani shu sahifa ustida ochadi (ega qarori 2026-10-19: oqim ichidagi «Kamera bilan skanerlash» / «Kamera» tugmasi yo'q); skan USB bilan bitta handler, kamera har skandan keyin yopilmaydi. Skan tanlaydi, «N / jami ta tanlandi», «Hammasi tanlandi»; qabul — sahifadagi tugma. |
| `superadmin-neworders-cancelled-markets` | Bekor qilinganlar — marketlar | sahifa | `/new-orders/cancelled` | `src/pages/new_orders/cancelled/index.tsx` | v2 |
| `superadmin-neworders-cancelled-handover` | Bekor qilinganlarni marketga topshirish | sahifa | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | v2 |
| `superadmin-neworders-cancelled-handover-done` | Bekor qilinganlarni marketga topshirish — «Topshirildi» bo'limi (taklif) | sahifa | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | yangi (kodda yo'q) — Topshirish ekrani muvaffaqiyatdan keyin (taklif «Bekor holatlari» (ega 2026-10-19, Trello vOczoOUE; elchi-v2-specs/bekor-holatlari-taklif.md)): qatorlar yo'qolmaydi — pastda «Topshirildi (N)» kartasi (sessiya ichida, backendsiz; sahifa yangilansa tozalanadi), har qatorda «Marketga topshirildi» badge'i + «Toshkent HQ · QR orqali». QR sessiyasi faol bo'lsa, qolgani uchun taymer qoladi. |
| `superadmin-neworders-cancelled-handover-camera` | Bekor qilinganlarni marketga topshirish — kamera | oyna | `/new-orders/cancelled/:marketId` | `src/shared/ui/camera/ScannerCamera.tsx` | qisman — Kamera v2 — markaziy «Skaner» (planshet/desktopda «Skanerlash») kamerani shu sahifa ustida ochadi (ega qarori 2026-10-19: oqim ichidagi «Kamera bilan skanerlash» / «Kamera» tugmasi yo'q); skan USB bilan bitta handler, kamera har skandan keyin yopilmaydi. Avval market QR, so'ng buyurtmalar («Buyurtmalarni tanlang · QR 04:12 amal qiladi»), ro'yxatda «Bekor qilish», «Tugatish». |
| `superadmin-neworders-cancelled-manual-dialog` | QR buzilganini tasdiqlash (modal) | oyna | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/ui/ManualConfirmDialog.tsx` | v2 |
| `superadmin-neworders-cancelled-scanner-dialog` | Kamera skaneri (modal) | oyna | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | qisman — Kamera v2 — markaziy «Skaner» (planshet/desktopda «Skanerlash») kamerani shu sahifa ustida ochadi (ega qarori 2026-10-19: oqim ichidagi «Kamera bilan skanerlash» / «Kamera» tugmasi yo'q); skan USB bilan bitta handler, kamera har skandan keyin yopilmaydi. Sarlavhadagi «Market QR skanerlash» tugmasi olib tashlangan (bitta ekranda ikkinchi skan tugmasi yo'q — tizim-scanner §09); market QR'dan keyin kamera yopilmaydi — buyurtmalarni tanlashga o'tadi. «QR o'qilmayaptimi? — PIN kodni kiritish» bloki kamera ichida yo'q (umumiy kamera oynasida sahifa amali uchun joy yo'q; oqim ichida qo'shimcha tugma yo'q — ega qarori): PIN oynasiga (neworders-cancelled-pin-dialog, BG6 tayyor — zkRab9M2) kirish sahifadagi «Market QR kerak» ogohlantirishidagi «PIN kodni kiritish» tugmasidan. |
| `superadmin-neworders-cancelled-pin-dialog` | Market PIN kodi (modal, taklif) | oyna | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | v2 |
| `superadmin-mails-today` | Pochta — Bugungi pochtalar | sahifa | `/mails/today` | `src/pages/mails/components/todaysMails.tsx` | v2 |
| `superadmin-mails-return` | Pochta — Qaytarish so'rovlari | sahifa | `/mails/return` | `src/pages/mails/components/returnMails.tsx` | v2 |
| `superadmin-mails-refused` | Pochta — Rad etilgan pochtalar | sahifa | `/mails/refused` | `src/pages/mails/components/refusedMails.tsx` | v2 |
| `superadmin-mails-old` | Pochta — Eski pochtalar | sahifa | `/mails/old` | `src/pages/mails/components/oldMails.tsx` | v2 |
| `superadmin-mails-old-batches` | Pochta — Hamma batchlar (eski) | sahifa | `/mails/old` | `src/pages/mails/components/oldMails.tsx` | v2 |
| `superadmin-mails-detail` | Pochta tafsiloti (jo'natish) | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | v2 |
| `superadmin-mails-detail-duplicates` | Pochta tafsiloti (jo'natish) — takroriy telefonlar | sahifa | `/mails/:id` | `src/pages/mails/detail/ui/DuplicatePhonesAlert.tsx`, `src/pages/mails/detail/ui/OrdersTable.tsx` | v2 |
| `superadmin-mails-detail-search` | Pochta tafsiloti (jo'natish) — qidiruv | sahifa | `/mails/:id` | `src/pages/mails/detail/ui/OrdersTable.tsx` | v2 |
| `superadmin-mails-detail-search-empty` | Pochta tafsiloti (jo'natish) — qidiruvda natija yo'q | sahifa | `/mails/:id` | `src/pages/mails/detail/ui/OrdersTable.tsx` | v2 |
| `superadmin-mails-detail-camera` | Pochta tafsiloti (jo'natish) — kamera | oyna | `/mails/:id` | `src/pages/mails/detail/index.tsx` | qisman — Kamera v2 — markaziy «Skaner» (planshet/desktopda «Skanerlash») kamerani shu sahifa ustida ochadi (ega qarori 2026-10-19: oqim ichidagi «Kamera bilan skanerlash» / «Kamera» tugmasi yo'q); skan USB bilan bitta handler, kamera har skandan keyin yopilmaydi. Skan tanlaydi (jo'natish / qabul / rad etilganni qabul); pochtada yo'q kod — «Bu pochtada yo'q · rad etildi». Eski pochta va kuryerning rad etilgan pochtasida maqsad yo'q. |
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
| `superadmin-payments-main-cashbox-shift-closed` | Asosiy kassa — smena yopiq | sahifa | `/payments/main-cashbox` | `src/pages/payments/components/mainCashbox.tsx` | qisman — Kodda bor (CB-1): «Smena boshlanmagan» banneri, «Tezkor amallar» qulfi («Smena ochilgach ishlaydi»), «Smenani ochish» asosiy tugma (GET finance/shift/current). Oxirgi yopilgan smena kartasi «Smena yopildi · … · Natija» chizilmagan — Taklif · backend kerak (`last_closed`, BD2-8 → CB-3). |
| `superadmin-payments-main-cashbox-shift-open-dialog` | Smenani ochish (popup) | oyna | `/payments/main-cashbox` | `src/pages/payments/components/OpenShiftDialog.tsx` | qisman — Kodda bor (CB-1, OpenShiftDialog): ochadigan xodim, «Boshlanish: hozir», ochilish qoldig'i (jonli balans), izoh. «Oxirgi smena … bilan yopilgan» ogohlantirishi chizilmagan — Taklif · backend kerak (`last_closed`, BD2-8 → CB-3). |
| `superadmin-payments-main-cashbox-shift-result-dialog` | Smena yopildi — natija (popup) | oyna | `/payments/main-cashbox` | `src/pages/payments/components/ShiftResultDialog.tsx` | v2 |
| `superadmin-payments-cash-detail-courier` | Kuryer kassasi (qabul qilish) | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | v2 |
| `superadmin-payments-cash-detail-market` | Market kassasi (to'lov berish) | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | v2 |
| `superadmin-payments-cash-detail-branch` | Filial kassasi (filialdan qabul) | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | v2 |
| `superadmin-payments-cash-detail-branch-shift-closed` | Filial kassasi — filial smenasi ochilmagan · taklif (backend kerak) | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | yangi (kodda yo'q) — Taklif (cashbox-shift, ega S1..S5) — kodda yo'q: smena ochilmaguncha kirim/chiqim qulf (hamma kassada, FINANCE_REQUIRE_OPEN_SHIFT=all), ochish / natija oynalari. |
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
| `superadmin-products-create-errors` | Mahsulot yaratish — xatolar | sahifa | `/products/create-product/:id` | `src/pages/products/create/index.tsx` | qisman — Kodda bor (MH-1): forma tepasida «Saqlab bo'lmadi · N ta maydonda xato» (tahrirlash oynasida ham), «Mahsulot nomi» va «Narx» xatolari. Og'irlik va o'lcham maydonlari xatolari — backend kerak (9fHyFp3y → MH-2). |
| `superadmin-products-delete-dialog` | Mahsulotni o'chirish | oyna | `/products` | `src/pages/products/ui/useDeleteProductConfirm.tsx` | v2 |
| `superadmin-users-list` | Foydalanuvchilar ro'yxati | sahifa | `/all-users` | `src/pages/users/list/UserListPage.tsx` | v2 |
| `superadmin-users-list-telegram` | Foydalanuvchilar ro'yxati — Telegram ustuni | sahifa | `/all-users` | `src/widgets/user-list/ui/UserListTable.tsx` | v2 |
| `superadmin-users-delete-dialog` | Foydalanuvchini o'chirish (tasdiq) | oyna | `/all-users` | `src/widgets/user-list/ui/UserListTable.tsx` | v2 |
| `superadmin-users-create` | Foydalanuvchi yaratish | sahifa | `/all-users/create-user` | `src/pages/users/create/CreateUserPage.tsx` | v2 |
| `superadmin-users-detail` | Foydalanuvchi tafsilotlari | sahifa | `/all-users/:id` | `src/pages/users/detail/UserDetailPage.tsx` | qisman — Kodda bor (CS-C): market «Tarif» kartasida «Asosiy tarif», «Uyga standart narx», «Markazga standart narx» (kuryer va menejerda «Uyga / Markazga tarif» qoladi). Yo'q: «Vazn va hajm bo'yicha narx» kaliti va «Masalan: standart … + vazn uchun …» izohi (Taklif · backend kerak) — market maydoni va narx dvigateli DAqXPeSy (ega S1) kelgach CS-E. |
| `superadmin-users-detail-telegram` | Foydalanuvchi tafsilotlari — Telegram guruhi | sahifa | `/all-users/:id` | `src/widgets/user-detail/ui/MarketTelegramGroupsCard.tsx` | qisman — CS-C: kodda market yorlig'i «Uyga standart narx» / «Markazga standart narx» (maket `superadmin-users-detail` / `-users-edit-dialog`, ega S1, sinxron f86a2e73 2026-10-19); bu maketda tafsilot sahifasidagi market «Tarif» kartasida hali «Uyga tarif» / «Markazga tarif» (o'sha f86a2e73) — bir xil maydon uchun maketlar ziddiyati, ega savoli. Qolgani — avvalgidek v2. NG-C (G085w5Qr): «Telegram guruhi» kartasida nofaol turda «Nofaol» (ton sababga qarab) + /notifications dagi sabab matni va «Nofaol bo'lgan: {sana}» — maket yo'q, eng yaqini superadmin-notifications-telegram-groups; faollashtirish — «Barcha guruhlar «Bildirishnomalar» bo'limida» havolasi orqali (ega savoli TG-B 2 ochiq). |
| `superadmin-users-detail-telegram-group-dialog` | Telegram guruhini ulash (havola, QR) | oyna | `/all-users/:id` | `src/features/telegram-link/ui/MarketGroupLinkDialog.tsx` | v2 |
| `superadmin-users-detail-telegram-group-expired-dialog` | Telegram guruhini ulash — havola muddati tugadi | oyna | `/all-users/:id` | `src/features/telegram-link/ui/MarketGroupLinkDialog.tsx` | v2 |
| `superadmin-users-edit-dialog` | Foydalanuvchini tahrirlash (modal) | oyna | `/all-users/:id` | `src/features/user/update-user/ui/UpdateUserModal.tsx` | qisman — Kodda bor (CS-C): «Market ma'lumotlari»da «Asosiy tarif *», «Uyga standart narx *», «Markazga standart narx *» (bo'sh bo'lsa «Uyga/Markazga standart narxni kiriting»); kuryer va menejer maydonlari «Uyga / Markazga tarif». Yo'q: «Vazn va hajm bo'yicha narx» kaliti — backend market maydoni yo'q (DAqXPeSy, ega S1), CS-E. |
| `superadmin-users-courier-transfer-dialog` | Kuryerni boshqa filialga o'tkazish | oyna | `/all-users/:id` | `src/features/courier-transfer-branch/ui/TransferCourierModal.tsx` | v2 |
| `superadmin-regions-map` | Hududlar — xarita va statistika | sahifa | `/regions` | `src/pages/region/index.tsx` | v2 |
| `superadmin-regions-region-modal` | Viloyat ma'lumotlari (modal) | oyna | `/regions` | `src/widgets/region-detail/ui/RegionDetailDialog.tsx` | v2 |
| `superadmin-regions-districts` | Tumanlar boshqaruvi | sahifa | `/regions/districts` | `src/pages/region/pages/districts/index.tsx` | v2 |
| `superadmin-regions-districts-delete-blocked` | Tumanni o'chirib bo'lmaydi | oyna | `/regions/districts` | `src/pages/region/ui/DistrictDeleteBlockedDialog.tsx` | v2 |
| `superadmin-regions-districts-merge-dialog` | Tumanni birlashtirish | oyna | `/regions/districts` | `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | v2 |
| `superadmin-regions-districts-merge-target` | Tumanni birlashtirish — maqsad tumanni tanlash | oyna | `/regions/districts` | `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | v2 |
| `superadmin-regions-districts-merge-progress` | Tumanni birlashtirish — jarayonda | oyna | `/regions/districts` | `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | v2 |
| `superadmin-regions-districts-merge-result` | Tumanni birlashtirish — natija | oyna | `/regions/districts` | `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | qisman — Kodda bor (DM-1, DM-2, v2): «Tumanlar birlashtirildi», «Ko'chirildi» — moved_live (faqat tirik, vsmpTweI; eski javobda moved), nol qatorlar chizilmaydi; «{maqsad}da endi» — target_after tirik sonlari va «oldin» (target_before), «O'chirilgan yozuvlar sanalmaydi.». Farq: «Faoliyat jurnaliga «Tuman birlashtirildi» yozuvi qo'shildi» jumlasi yo'q (jurnal yorliqlari va oynalardagi jurnal havolasi — ILq3WNL1, DM-3). |
| `superadmin-regions-districts-merge-error` | Tumanni birlashtirish — bekor qilindi | oyna | `/regions/districts` | `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | qisman — Kodda bor (DM-2, v2): 409/503 javobidagi data.reason + data.details (tf324cXN) dan — «Birlashtirib bo'lmadi» (count_mismatch, 409 dagi remote_refused, invalid_response, delete_failed), tuman juftligi, «Sabab» qatori (masalan «Sonlar mos kelmadi — Izboskan tumanida buyurtmalar 1 255 ta, kutilgan 1 254 ta.»; noma'lum kodda qator yo'q), izoh, «Xabarni nusxalash» (sarlavha, juftlik ID bilan, sabab, kod, trace_id, vaqt) va «Qayta urinish» (o'sha juftlik bilan yangi so'rov). Server matni va HTTP kodi ko'rsatilmaydi; details.manual_fix yo'q javob (400/403/404) — oyna emas, umumiy xabar. Z1c1sNPT: «Bo'z tumaniga qaytarildi» — details.rolled_back_orders/users/branches (nol qatorlar chizilmaydi, hammasi 0 — blok yo'q), «Xabarni nusxalash» da ham. |
| `superadmin-regions-districts-merge-error-unavailable` | Tumanni birlashtirish — servis javob bermadi | oyna | `/regions/districts` | `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | qisman — Kodda bor (DM-2, v2): «Servis javob bermadi» — reason timeout yoki 503 dagi remote_refused / sababsiz 503; «Sabab» — «Foydalanuvchilar ko'chirilmadi — servis 15 soniya ichida javob bermadi.» (details.kind, details.timeout_ms), izoh, «Xabarni nusxalash», «Qayta urinish». Z1c1sNPT: «Bo'z tumaniga qaytarildi» — details.rolled_back_orders/users/branches (nol qatorlar chizilmaydi, hammasi 0 — blok yo'q), «Xabarni nusxalash» da ham. |
| `superadmin-regions-districts-merge-error-manual` | Tumanni birlashtirish — qo'lda tuzatish kerak | oyna | `/regions/districts` | `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | qisman — Kodda bor (DM-2, v2): details.manual_fix = true — «Birlashtirish chala qoldi», «Qo'lda tuzatish kerak» ogohlantirishi (role=alert), «Sabab», «Bo'z tumaniga qaytmadi» — details.stranded (tur · N ta / «ID'lar noma'lum»; «<tuman>da qoldi» / «Joyi aniqlanmadi — jurnalda tekshiring»), jurnal izohi, «Xabarni nusxalash» va «Faoliyat jurnalini ochish» (/activity-logs); «Qayta urinish» yo'q. Z1c1sNPT: «Buyurtmalar» qatorida qolgan raqamlar — details.stranded_order_ids (≤10 ta, «… va yana N ta»), nusxada ham; to'liq ro'yxat — activity log. |
| `superadmin-regions-districts-merge-unknown` | Tumanni birlashtirish — natija noma'lum | oyna | `/regions/districts` | `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | qisman — Kodda bor (DM-1, v2): timeout / javobsiz / 500 / 502 / 504 / 524 → «Natija noma'lum», «Qayta urinish» yo'q, «Faoliyat jurnalini ochish» (/activity-logs) va «Tumanlarni yangilash». Farq: qadamlar matnida jurnal yozuvi nomlari («Tuman birlashtirildi» / «… chala qoldi») yo'q — backend ularni hali yozmaydi (ILq3WNL1, DM-3); o'rniga «shu tuman yozuvlarini ko'ring». |
| `superadmin-regions-sato-management` | Tumanlarni o'tkazish (SATO) | sahifa | `/regions/sato-management` | `src/pages/region/pages/sato-management/index.tsx` | v2 |
| `superadmin-regions-sato-codes` | SATO kodlari — topildi | sahifa | `/regions/sato-management` | `src/pages/region/ui/sato/SatoKpiRow.tsx`, `src/pages/region/ui/sato/SatoApplyDialog.tsx`, `src/pages/region/ui/sato/SatoCodesPanel.tsx`, `src/pages/region/ui/sato/SatoCodesTable.tsx`, `src/pages/region/model/satoModel.ts` | v2 |
| `superadmin-regions-sato-codes-not-found` | SATO kodlari — topilmadi (qo'lda kiritish) | sahifa | `/regions/sato-management` | `src/pages/region/ui/sato/SatoCodesTable.tsx`, `src/pages/region/ui/sato/SatoCodeEditor.tsx` | v2 |
| `superadmin-regions-sato-codes-apply-dialog` | SATO kodlari — avtomatik yozish (tasdiq) | oyna | `/regions/sato-management` | `src/pages/region/ui/sato/SatoApplyDialog.tsx`, `src/pages/region/model/satoModel.ts` | v2 |
| `superadmin-regions-sato-codes-edit` | SATO kodlari — kodni tahrirlash («kod band») | sahifa | `/regions/sato-management` | `src/pages/region/ui/sato/SatoCodeEditor.tsx`, `src/pages/region/ui/sato/useSatoCodeEditor.ts` | v2 |
| `superadmin-regions-sato-codes-duplicates` | SATO kodlari — takroriy nomlar | sahifa | `/regions/sato-management` | `src/pages/region/ui/sato/SatoDuplicatesTable.tsx`, `src/pages/region/ui/sato/SatoCodesTable.tsx`, `src/pages/region/model/satoModel.ts` | v2 |
| `superadmin-regions-sato-codes-merge-dialog` | SATO kodlari — takroriy tumanni birlashtirish | oyna | `/regions/sato-management` | `src/pages/region/ui/sato/SatoMergeDialog.tsx`, `src/pages/region/ui/sato/useSatoMerge.ts`, `src/pages/region/ui/DistrictMergeDialog.tsx` | qisman — Kodda bor (SA-2, DM-2): «Takroriy nomlar» → guruhdagi «Birlashtirish» → umumiy DistrictMergeDialog (DM-1) SATO matnlari bilan — «Nom (ID N) dagi hamma narsa …», «O'chiriladigan tuman: Nom · ID N, <viloyat> · <kod>», maqsad «Nom · ID N» + kod, «Faqat <viloyat> tumanlari. SATO kodi N saqlanadi.», «Nom (ID N) ga ko'chadi» sonlari (GET district/:id/usage, nol qatorlar chizilmaydi), «ID N yozuvi butunlay o'chiriladi …»; jarayon / natija / xato / «noma'lum» — regions-districts-merge-* bo'yicha. Farq: maqsad ro'yxati qidiruvsiz (kod yonida ko'rinishi uchun). |
| `superadmin-regions-sato-codes-missing` | SATO kodlari — bazada yo'q | sahifa | `/regions/sato-management` | `src/pages/region/ui/sato/SatoCodesPanel.tsx`, `src/pages/region/ui/sato/SatoCodesTable.tsx`, `src/pages/region/model/satoModel.ts` | v2 |
| `superadmin-regions-sato-codes-add-dialog` | SATO kodlari — tuman qo'shish oynasi | oyna | `/regions/sato-management` | `src/pages/region/ui/sato/SatoAddDistrictDialog.tsx`, `src/pages/region/model/satoModel.ts` | v2 |
| `superadmin-regions-logist-assignment` | Logist biriktirish | sahifa | `/regions/logist-assignment` | `src/pages/region/pages/logist-assignment/index.tsx` | v2 |
| `superadmin-branches-list-tree` | Filiallar — daraxt ko'rinishi | sahifa | `/branches` | `src/widgets/branch-list/ui/BranchTree.tsx` | v2 |
| `superadmin-branches-list-table` | Filiallar — jadval / kartalar | sahifa | `/branches` | `src/widgets/branch-list/ui/BranchTable.tsx` | v2 |
| `superadmin-branches-create-dialog` | Yangi filial (modal) | oyna | `/branches` | `src/features/branch/ui/BranchFormDialog.tsx` | v2 |
| `superadmin-branches-detail` | Filial tafsiloti | sahifa | `/branches/:id` | `src/pages/branches/ui/BranchDetailPage.tsx` | v2 |
| `superadmin-branches-add-employee-dialog` | Xodim qo'shish (modal) | oyna | `/branches/:id` | `src/features/branch-add-employee/ui/AddEmployeeModal.tsx` | v2 |
| `superadmin-integrations-partners-console` | Integratsiyalar — Hamkorlar (konsol) | sahifa | `/integrations/connections` | `src/pages/integrations/ConnectionsPage.tsx` | v2 |
| `superadmin-integrations-external-console` | Integratsiyalar — Tashqi tizimlar | sahifa | `/integrations/connections` | `src/pages/integrations/ConnectionsPage.tsx` | v2 |
| `superadmin-integrations-marketplace-console` | Integratsiyalar — Marketplace | sahifa | `/integrations/connections` | `src/pages/integrations/ConnectionsPage.tsx` | v2 |
| `superadmin-integrations-panel-settings` | Ulanish — Sozlamalar paneli | sahifa | `/integrations/connections` | `src/pages/integrations/panels/ConnectionSettings.tsx` | v2 |
| `superadmin-integrations-panel-shipments` | Ulanish — Posilkalar paneli | sahifa | `/integrations/connections` | `src/pages/integrations/panels/ConnectionShipments.tsx` | v2 |
| `superadmin-integrations-panel-events` | Ulanish — Hodisalar paneli | sahifa | `/integrations/connections` | `src/pages/integrations/panels/ConnectionLog.tsx` | qisman — Maketga qo'shimcha (Dj70iDbD): «Hamkor» filtri («Barcha hamkorlar» — umumiy jurnal, qatorda hamkor nomi; shu holatda «Natija · 24 soat» yashirin) va «Webhook ma'lumoti» ochiladigan qatori — ikkalasi superadmin-integrations-legacy-partners dan. Ega tasdig'i kutilmoqda. |
| `superadmin-integrations-panel-settlement` | Ulanish — Hisob-kitob paneli | sahifa | `/integrations/connections` | `src/pages/integrations/panels/ConnectionSettlement.tsx`, `src/pages/integrations/panels/settlement/RemittancesSection.tsx` | qisman — Ism kutadi (BD2-10, IS-4): «Kim kiritdi / bekor qildi» ismi — Taklif · backend kerak (javobda faqat created_by / cancelled_by id), bekor qilingan eski yozuvda operatorning kassa tanlovi saqlanmaydi → «Kassa: eski yozuv». Qolgani v2 (IS-1: «To'lov asosiy kassaga o'zi yoziladi» + Asosiy kassa havolasi, «Qoldiq» — to'lanishi kerak, yopilmagan qarz, hamkor avansi, formula, «Qarz yo'q»; IS-2: «To'lov» ustuni / telefonda «… · To'lov №N · …», ortiqcha summa ogohlantirishi va «To'lov yozildi» natija oynasi; IS-3: «Olingan to'lovlar» — sana oralig'i, «Faol · Bekor qilingan · Barchasi», jadval / telefonda kartalar, «Holat · kassa», bekor qilish oynasi; «To'lov №N» — shu bo'limga o'tish). |
| `superadmin-integrations-settlement-pay-dialog` | Tashuvchidan olingan to'lov (modal) | oyna | `/integrations/connections` | `src/pages/integrations/panels/ConnectionSettlement.tsx` | v2 |
| `superadmin-integrations-settlement-pay-overpay-dialog` | To'lov — ortiqcha summa (modal) | oyna | `/integrations/connections` | `src/pages/integrations/panels/ConnectionSettlement.tsx` | v2 |
| `superadmin-integrations-settlement-pay-result-dialog` | To'lov natijasi — avans va kassa (modal) | oyna | `/integrations/connections` | `src/pages/integrations/panels/settlement/PayResultDialog.tsx` | qisman — Kodda bor (IS-2, v2). Farq (ega savoli 1 ochiq): raqamlar backend bo'linmasi bo'yicha — «Avansga o'tdi» = shu to'lovning qarzga sig'magan ortig'i (unapplied_amount), «Hamkor avansi endi» = jami avans (advance_balance); maketdagi «490 000 so'm avansga o'tdi» + «Avvalgi avansdan ishlatildi 350 000» o'rniga «140 000 so'm avansga o'tdi» + «Hamkor avansi endi 490 000». Avvalgi avans ortiqchani qoplasa (to'lanishi kerak < summa < yopilmagan qarz) backend unapplied 0 qaytaradi — «avansga o'tdi» qatori yo'q, faqat «Avvalgi avansdan ishlatildi» va «Hamkor avansi endi». Maketsiz matnlar: qarz yozuviga sig'magan qoldiq izohi, birorta qarz yopilmagan holda «Kassaga yozilmadi» izohi. |
| `superadmin-integrations-settlement-cancel-dialog` | To'lovni bekor qilish (tasdiq) | oyna | `/integrations/connections` | `src/pages/integrations/panels/settlement/CancelRemittanceDialog.tsx` | v2 |
| `superadmin-integrations-panel-control` | Ulanish — Ish rejimi paneli | sahifa | `/integrations/connections` | `src/pages/integrations/panels/ConnectionControl.tsx` | v2 |
| `superadmin-integrations-panel-security` | Ulanish — Xavfsizlik paneli | sahifa | `/integrations/connections` | `src/pages/integrations/panels/ConnectionSecurity.tsx` | v2 |
| `superadmin-integrations-rotate-key-dialog` | Kalitni yangilash (tasdiq) | oyna | `/integrations/connections` | `src/pages/integrations/panels/ConnectionSecurity.tsx` | v2 |
| `superadmin-integrations-new-partner-dialog` | Yangi hamkor (modal) | oyna | `/integrations/connections` | `src/pages/integrations/NewPartnerModal.tsx` | v2 |
| `superadmin-integrations-catalog` | Yangi ulanish — katalog | sahifa | `/integrations/new` | `src/pages/integrations/CatalogPage.tsx` | v2 |
| `superadmin-integrations-wizard` | Ulash ustasi (Nomi → Kalitlar → Sinash → Tayyor) | sahifa | `/integrations/new/:typeKey` | `src/pages/integrations/wizard/ConnectWizard.tsx` | v2 |
| `superadmin-integrations-legacy-partners` | Partner API hamkorlari (eski sahifa) | sahifa | `/integrations/connections` | `src/pages/integrations/ConnectionsPage.tsx` | qisman — Sahifa olindi (Dj70iDbD, karta TC matni bo'yicha): hamkor amallari konsolda (yaratish, Sozlamalar, Xavfsizlik, Ish rejimi), «Webhook yetkazish jurnali» — «Hodisalar» panelida. /partners va /integrations/partners — 404. Maket taqdiri ega bilan kelishilishi kerak. |
| `superadmin-integrations-legacy-sources` | Tashqi manbalar (eski: Integratsiyalar ro'yxati) | sahifa | `/integrations/sources` | `src/pages/new_orders/external_orders/index.tsx` | v2 |
| `superadmin-integrations-legacy-source-create` | Integratsiya yaratish (eski forma) | sahifa | `/integrations/sources/create` | `src/pages/new_orders/external_orders/create.tsx` | v2 |
| `superadmin-integrations-legacy-source-detail` | Integratsiya — QR skaner (eski) | sahifa | `/integrations/sources/:id` | `src/pages/new_orders/external_orders/detail.tsx` | v2 |
| `superadmin-notifications-telegram-groups` | Bildirishnomalar — Telegram guruhlari | sahifa | `/notifications` | `src/pages/notifications/ui/NotificationsPage.tsx` | qisman — Kodda bor (NG-A, NG-C, v2). Nofaollik sababi (inactive_reason, G085w5Qr) maketdagidek: bot chiqarilgan / guruh topilmadi — qizil «Nofaol» + «Bot guruhdan chiqarilgan — …» / «Guruh topilmadi — …», qo'lda — neytral «Qo'lda nofaol qilingan»; faollashtirish ogohlantirishi bot chiqarilganda «Bot guruhdan chiqarilgan». Maketdan farq: blocked_on_send matni maketda yo'q («Bot guruhga xabar yubora olmadi — …», qizil); sabab null yoki noma'lum — neytral umumiy izoh «Xabarlar bu guruhga yuborilmayapti» va ogohlantirish «Bot guruhda ekanini tekshiring» (D1); inactive_at bo'lsa izoh ostida «Nofaol bo'lgan: {sana}» (maketda yo'q). |
| `superadmin-notifications-create-dialog` | Bildirishnoma qo'shish (modal) | oyna | `/notifications` | `src/features/notification-create/ui/NotificationFormModal.tsx` | v2 |
| `superadmin-notifications-delete-dialog` | Bildirishnomani o'chirish (tasdiq) | oyna | `/notifications` | `src/features/notification-delete/ui/useDeleteNotificationConfirm.tsx` | v2 |
| `superadmin-notifications-inbox` | Bildirishnomalar — Inbox (qo'ng'iroqcha) | sahifa | `/inbox` | `src/pages/notifications/ui/NotificationInboxPage.tsx` | v2 |
| `superadmin-notifications-push-explain-dialog` | Bildirishnomalarni yoqasizmi? (tasdiq) | oyna | `/inbox` | `src/features/push-notifications/ui/PushExplainDialog.tsx` | v2 |
| `superadmin-notifications-send` | Xabar yuborish | sahifa | `/notifications/send` | `src/pages/notification-send/index.tsx` | v2 |
| `superadmin-notifications-send-confirm-dialog` | Xabarni yuborishni tasdiqlang | oyna | `/notifications/send` | `src/pages/notification-send/index.tsx` | v2 |
| `superadmin-notifications-send-result` | Xabar yuborish — natija | sahifa | `/notifications/send` | `src/features/notification-dispatch/ui/DispatchResultCard.tsx` | v2 |
| `superadmin-notifications-send-unknown` | Xabar yuborish — natija noma'lum | sahifa | `/notifications/send` | `src/features/notification-dispatch/ui/DispatchUnknownCard.tsx` | v2 |
| `superadmin-notifications-sent` | Yuborilganlar | sahifa | `/notifications/sent` | `src/pages/notification-sent/index.tsx` | v2 |
| `superadmin-notifications-sent-detail-dialog` | Yuborilgan xabar tafsiloti | oyna | `/notifications/send`, `/notifications/sent` | `src/entities/notification-dispatch/ui/SentDetailDialog.tsx` | v2 |
| `superadmin-notifications-sent-detail-states` | Yuborilgan xabar tafsiloti — boshqa holatlar | sahifa | `/notifications/sent` | `src/entities/notification-dispatch/ui/SentDetailDialog.tsx` | v2 |
| `superadmin-notifications-sent-loading` | Yuborilganlar — yuklanmoqda | sahifa | `/notifications/sent` | `src/pages/notification-sent/index.tsx` | v2 |
| `superadmin-notifications-sent-empty` | Yuborilganlar — bo'sh | sahifa | `/notifications/sent` | `src/pages/notification-sent/index.tsx` | v2 |
| `superadmin-notifications-sent-error` | Yuborilganlar — xato | sahifa | `/notifications/sent` | `src/pages/notification-sent/index.tsx` | v2 |
| `superadmin-notifications-sms-campaign` | SMS — Kampaniya | sahifa | `/notifications/sms` | `src/pages/notifications/ui/SmsPage.tsx` | v2 |
| `superadmin-notifications-sms-campaign-confirm-dialog` | SMS kampaniyani tasdiqlash | oyna | `/notifications/sms` | `src/pages/notifications/ui/SmsPage.tsx` | v2 |
| `superadmin-notifications-sms-templates` | SMS — Shablonlar | sahifa | `/notifications/sms` | `src/pages/notifications/ui/SmsPage.tsx` | v2 |
| `superadmin-notifications-sms-report` | SMS — Xarajat | sahifa | `/notifications/sms` | `src/pages/notifications/ui/SmsPage.tsx` | qisman — Maketda yo'q «Oylar bo'yicha» kartasi qo'shilgan (eng yaqini «Kunlar bo'yicha»): tanlangan davrdagi kun qatorlaridan. Karta FaFN0Pux TC matni bo'yicha, joyini ega tasdiqlashi kerak. |
| `superadmin-notifications-sms-settings` | SMS — Sozlamalar | sahifa | `/notifications/sms` | `src/pages/notifications/ui/SmsPage.tsx` | v2 |
| `superadmin-activity-logs-list` | Faoliyat jurnali | sahifa | `/activity-logs` | `src/pages/activity-logs/index.tsx` | v2 |
| `superadmin-activity-logs-row-expanded` | Faoliyat jurnali — yozuv tafsiloti (ochilgan qator) | sahifa | `/activity-logs` | `src/widgets/activity-log/ui/ActivityLogDetail.tsx` | v2 |
| `superadmin-ops-finance-operators` | Ops — Moliya operatorlari | sahifa | `/ops`, `/finance-operators` | `src/pages/ops/index.tsx`, `src/pages/finance-operators/index.tsx` | v2 |
| `superadmin-ops-integrations` | Ops — Integratsiyalar | sahifa | `/integrations/connections` | `src/pages/integrations/ConnectionsPage.tsx` | qisman — Tab olindi (Dj70iDbD, karta TC matni bo'yicha): qarzlar — ulanishning «Hisob-kitob» panelida (faqat ulanish kesimida, barcha ulanishlar ro'yxati yo'q), navbat — «Ish rejimi» panelida. /integrations-ops va /ops?tab=integrations → /integrations. Maket taqdiri ega bilan kelishilishi kerak. |
| `superadmin-ops-investors` | Ops — Investorlar | sahifa | `/ops` | `src/pages/ops/index.tsx` | v2 |
| `superadmin-ops-logistics` | Ops — Logistika (qaytarish so'rovlari) | sahifa | `/returns` | `src/pages/returns/index.tsx` | v2 |
| `superadmin-ops-logistics-approve-dialog` | Ops — Logistika: qaytarish so'rovlarini tasdiqlash | oyna | `/returns` | `src/pages/logistics-ops/index.tsx`, `src/pages/logistics-ops/ui/ApproveReturnSummary.tsx` | v2 |
| `superadmin-ops-logistics-approve-result` | Ops — Logistika: tasdiqlash natijasi (qisman o'tkazib yuborildi) | sahifa | `/returns` | `src/pages/returns/index.tsx` | v2 |
| `superadmin-ops-branches` | Ops — Filiallar (partiya bekor qilish) | sahifa | `/batches` | `src/pages/batches/ui/BatchesPage.tsx` | v2 |
| `superadmin-ops-identity` | Ops — Xodimlar ro'yxatlari | sahifa | `/ops`, `/identity-ops` | `src/pages/ops/index.tsx`, `src/pages/identity-ops/index.tsx` | qisman — Maketdagi «Market: buyurtma qo'shish ruxsati» kartasi olindi: ruxsat bitta joyda, market profilida (Ruxsatlar → Buyurtma qo'shish). Karta 941rmIn5 TC matni bo'yicha, ega tasdig'i kutilmoqda. |
| `superadmin-ops-system` | Ops — Tizim | sahifa | `/ops` | `src/pages/ops/index.tsx` | qisman — Maketdagi «O'z vaqtida (SLA)» va «Analitika KPI» superadmin bosh sahifasida (AnalyticsKpiSection), «Token orqali tekshirish» olindi — karta F2NzXpMv TC matni bo'yicha, ega tasdig'i kutilmoqda. |
| `superadmin-ops-system-partial` | Ops — Tizim: qisman ishlayapti, zaif AI modeli | sahifa | `/ops` | `src/pages/system-ops/ui/HealthCard.tsx`, `src/pages/system-ops/ui/AiStatusCard.tsx` | v2 |
| `superadmin-ops-system-down` | Ops — Tizim: xizmatlar ishlamayapti | sahifa | `/ops` | `src/pages/system-ops/ui/HealthCard.tsx`, `src/pages/system-ops/ui/AiStatusCard.tsx` | v2 |
| `superadmin-ops-system-loading` | Ops — Tizim: yuklanish | sahifa | `/ops` | `src/pages/system-ops/ui/HealthCard.tsx`, `src/pages/system-ops/ui/AiStatusCard.tsx` | v2 |
| `superadmin-ops-system-error` | Ops — Tizim: holatni olib bo'lmadi, AI o'chiq | sahifa | `/ops` | `src/pages/system-ops/ui/HealthCard.tsx`, `src/pages/system-ops/ui/AiStatusCard.tsx` | v2 |
| `superadmin-ops-system-critical` | Ops — Tizim: asosiy xizmat ishlamayapti, AI ulanmagan | sahifa | `/ops` | `src/pages/system-ops/ui/HealthCard.tsx`, `src/pages/system-ops/ui/AiStatusCard.tsx` | v2 |
| `superadmin-ops-system-ai-config` | Ops — Tizim: kalit nomi noto'g'ri, noma'lum model | sahifa | `/ops` | `src/pages/system-ops/ui/AiStatusCard.tsx` | v2 |
| `superadmin-ops-system-ai-cap` | Ops — Tizim: AI kunlik limiti tugadi | sahifa | `/ops` | `src/pages/system-ops/ui/AiStatusCard.tsx` | v2 |
| `superadmin-ops-auth-diagnostics` | Ops — Auth diagnostikasi | sahifa | `/ops` | `src/pages/ops/index.tsx` | v2 |
| `superadmin-scan-camera` | Skaner — kamera (umumiy) | sahifa | `/scan` | `src/pages/scan/index.tsx` | v2 |
| `superadmin-scan-result` | Skanerlangan buyurtma | sahifa | `/scan/:token` | `src/pages/scan/detail.tsx` | v2 |
| `superadmin-notifications-send-audience` | Xabar yuborish — auditoriya konstruktori | sahifa | `/notifications/send` | `src/entities/notification-campaign/ui/AudienceBuilder.tsx` | qisman — Kodda bor (KM-2): «Kimga» — Bitta odam · Tanlangan ro'yxat · Auditoriya · Hamma («Rol» olindi); «Auditoriya» doim kampaniya (POST /notifications/campaigns + Idempotency-Key, KM-S1): «Saqlangan segment» (tanlash, o'chirish — tasdiq bilan), «Turi» Mijoz · Market · Xodim, «Xodim rollari» (admin, menejer, registrator, kuryer, logist — KM-S2), «Mijoz filtrlari» (CustomerSegmentFilters, «dan – gacha» — bildirishnoma segmentida max_orders bor), jonli son (POST notifications/audience/preview, debounce; segmentsiz include_customers yuborilmaydi — «Filtrsiz» belgisi bilan confirm_all_customers), «Namunani ko'rish», «Segmentni saqlash»; «Kanal» — Ilova ichida · Ochiq ekranga · Push (son — foydalanuvchi, qurilma emas) · Telegram «Kampaniyada yo'q»; «Mazmun»da guruh kaliti yo'q; «Yuborish» ostida «Darhol · kampaniya · N ta qabul qiluvchi». «Yuborish vaqti» va «Kampaniyalar tarixi» — KM-3 (-send-schedule). Yo'q: SMS kartasi («Taklif · backend kerak» — KM-5). Farq: saqlangan segmentni o'chirish tugmasi ro'yxat bandi ichida emas, maydon yonida (tanlangan segment uchun). |
| `superadmin-notifications-send-schedule` | Xabar yuborish — belgilangan vaqtda (soat tanlash ochiq) | sahifa | `/notifications/send` | `src/features/notification-dispatch/ui/CampaignScheduleCard.tsx` | qisman — Kodda bor (KM-3): «Yuborish vaqti» (faqat «Auditoriya») — Darhol / Belgilangan vaqtda, «Sana» (bugundan max_schedule_days gacha), «Soat» (30 daqiqa; bugun o'tgan soatlar ro'yxatda yo'q; reklamada taqiq soatlari o'chiq — «Reklama taqiqi», oyna faqat GET campaigns/schedule-policy dan), «Toshkent vaqti (UTC+5)», ko'k «Ertaga, 10:00 da yuboriladi»; tugma «Rejalashtirish», ostida «Ertaga, 10:00 · N ta qabul qiluvchi»; scheduled_at — +05:00 bilan, «Darhol» da yuborilmaydi. «Kampaniyalar tarixi» (CampaignHistoryCard) — holat tablari (backend state), jadval / planshetda qisqa ustunlar / telefonda kartalar, Pagination, yuborilayotganda har 3 s. Farq: qatorda «18:40 da so'ralgan, tungi taqiq» va «Partiya 3 marta yiqildi» izohlari yo'q — ro'yxat javobida requested_scheduled_at va partiya urinishlari soni yo'q (last_error — xom matn, ko'rsatilmaydi); o'rniga yuborilayotgan reklama tunda to'xtasa — «Tungi taqiq — ertaga, 09:00 da davom etadi», navbatdagisi taqiqqa surilsa — vaqt paused_until va «Tungi taqiq tufayli surildi». «E'lon» kategoriyasi backendda yo'q — kategoriya nomi («Tizim»). Bitta sahifada ham sahifalash tugmalari (Pagination primitivi). |
| `superadmin-notifications-send-audience-sample-dialog` | Auditoriya namunasi (20 ta, maskalangan) | oyna | `/notifications/send` | `src/entities/notification-campaign/ui/AudienceSampleDialog.tsx` | v2 |
| `superadmin-notifications-send-audience-save-dialog` | Segmentni saqlash (oyna) | oyna | `/notifications/send` | `src/entities/notification-campaign/ui/SaveSegmentDialog.tsx` | v2 |
| `superadmin-notifications-send-confirm-scheduled-dialog` | Kampaniyani rejalashtirishni tasdiqlang | oyna | `/notifications/send` | `src/features/notification-dispatch/ui/NotificationDispatchForm.tsx` | qisman — Kodda bor (KM-3): maketdagidek (sarlavha ostida «N ta qabul qiluvchiga yuboriladi», ko'k vaqt bloki, Kimga · Qabul qiluvchilar · Kanallar · Kategoriya, «Orqaga» · «Rejalashtirish»). Reklama taqiqqa tushsa (schedule-policy check.shifted) — ko'k blok o'rniga sariq «Reklama … da yuboriladi». |
| `superadmin-notifications-campaign-cancel-dialog` | Kampaniyani bekor qilish (tasdiq) | oyna | `/notifications/send` | `src/features/notification-dispatch/ui/useCampaignCancel.tsx` | qisman — Kodda bor (KM-3): useCampaignCancel — natija kartasi va «Kampaniyalar tarixi» uchun umumiy; rejalashtirilgan kampaniyada progress chizig'i yo'q; 409 — «allaqachon yakunlangan» xabari va ro'yxat yangilanadi. |
| `superadmin-notifications-campaign-report-dialog` | Kampaniya hisoboti (oyna) | oyna | `/notifications/send` | `src/features/notification-dispatch/ui/CampaignReportDialog.tsx` | qisman — Kodda bor (KM-3, ega KM-S1 — oyna; H7kpCman FE TC'lari 2026-10-26): 6 ta StatCard (390px da 2 ustun) — Auditoriya · Yuborildi · Yetkazildi (DLR o'lchanmagan — «—», 0 emas; izohda sababi) · Xato · O'tkazib yuborildi (kanal kesimi yig'indisi, izohida kanal yoki yagona sabab) · Narx (formatCompactMoney, izohi doim «taxminiy …»); «Kanallar bo'yicha» jadvali (telefonda ro'yxat); SMS bloki faqat sms !== null — xabarlar, bo'laklar (1 xabar = N bo'lak), kodlash (GSM-7 / UCS-2 — SMS kampaniyasida), operator hisoboti, 1 bo'lak narxi, yuborilganlar narxi + «Narx taxminiy» izohi (eng yaqin maket — superadmin-notifications-sms-report «Jami SMS · Bo'laklar · Jami xarajat» va «Yetkazilish»); «Yetkazilmaganlar» 10 tadan sahifalab — maskalangan telefon (N9, lkQiuyQu: bildirishnomada ham ***7434), sabab — failures[].reason_code xaritasidan; CSV faqat permissions.can_export (superadmin; 10 000 dan katta — fon vazifasi, holat har 2 s). SMS kampaniyasi hisoboti ham shu oyna: /notifications/sms «Kampaniyalar tarixi» → «Hisobot» (GET /notifications/sms/campaigns/:id/report, …/undelivered, …/export; rejalashtirilganida tugma yo'q). Farq: maketdagi provayder matni («qurilma tokeni eskirgan») xom bo'lgani uchun ko'rsatilmaydi — kod xaritasi matni («Push obunasi eskirgan»); maketda «Yetkazildi», narx va SMS bloki yo'q — karta TC'lari bo'yicha qo'shildi (StatCard, tokenlar). |
| `superadmin-notifications-send-states` | Xabar yuborish — auditoriya va yuborish holatlari | sahifa | `/notifications/send` | `src/entities/notification-campaign/ui/AudienceSummary.tsx` | qisman — Kodda bor (KM-2): «Auditoriya hisobi» — mijoz tanlanmagan (filtrlar yashirin + izoh), filtr tanlang + «Filtrsiz», hisoblanmoqda, hisoblandi, 0 ta, chegaradan oshdi («Yuborish» o'chiq), katta auditoriya (navbat orqali 200 tadan), xato + «Qayta urinish», saqlangan segmentlar ro'yxati; «Yuborish» — «navbatga qo'yildi» progress bloki (GET campaigns/:id har 3 s, «Bekor qilish» tasdiq bilan, 409 — xabar), «Server rad etdi» (400 — preview limitlaridan matn), «Segment nomi band» (409), «Segmentni o'chirish — tasdiq». KM-3: «Reklama, Darhol, kechqurun» — «Yuborish vaqti» kartasida sariq «Hozir 19:10 — reklama ertaga, 09:00 da yuboriladi» (taqiq oynasi schedule-policy dan), progress kartasida «Kampaniyalar tarixi» tugmasi (sahifadagi tarix kartasiga). Yo'q: «SMS va kunlik limit» bo'limi (KM-5). Farq (ataylab): «Katta auditoriya» da son ostida kesim va «Namunani ko'rish» / «Segmentni saqlash» ham bor (maketda faqat son va navbat izohi) — yuborish mumkin bo'lgan holatda amallar qo'l ostida qoladi; 400 da son qayta sanaladi («… — chegara 20 000. Hech kimga yuborilmadi.», «Yuborish» yangi son bilan); oflayn — «Internet aloqasi yo'q». |
| `superadmin-notifications-sms-campaign-segment` | SMS — Kampaniya: mijozlar segmenti va yuborish vaqti | sahifa | `/notifications/sms` | `src/pages/notifications/ui/CampaignPage.tsx` | qisman — Kodda bor (KM-1): «Xabar turi» — faqat «Reklama» (xizmat va OTP shablonlari ro'yxatda yo'q); «Mijoz filtrlari» — Viloyat / Tuman / Market Select, «Oxirgi buyurtma» DateRange, «Buyurtmalar soni» faqat minimum (entities/notification-campaign CustomerSegmentFilters); jonli auditoriya (POST sms/campaigns/preview, debounce) va «SMS limiti · Bugun qolgan: X / N» (KM-S4; oshsa «Ko'rib chiqish» o'chiq); «Yuborish vaqti» — «Darhol» va tungi taqiq izohi. Chizilmaydi («Taklif · backend kerak»): «Saqlangan segment», «Segmentni saqlash», «gacha» (max_orders SMS kampaniyada yo'q), «Belgilangan vaqtda» (KM-4/KM-6). |
| `superadmin-users-list-roles` | Foydalanuvchilar — barcha rollar tablari (taklif) | sahifa | `/all-users` | `src/pages/users/list/UserListPage.tsx` | qisman — FY-1: 9 ta rol tabi (FY-S1) va qator menyusi («Nofaol qilish», FY-S2) — kodda. Chizilmagan: «Filial» ustuni va market operatori qatorida market nomi (FY-S3) — GET /users qatorida filial ham, market nomi ham yo'q (backend kerak). |
| `superadmin-users-list-role-select` | Foydalanuvchilar — rol tanlash ro'yxati (telefon, taklif) | sahifa · faqat telefon | `/all-users` | `src/pages/users/list/UserListPage.tsx` | v2 |
| `superadmin-users-edit-role` | Foydalanuvchini tahrirlash — «Rol» maydoni (taklif) | oyna | `/all-users/:id` | `src/features/user/change-role/ui/RoleSection.tsx` | v2 |
| `superadmin-users-role-confirm-dialog` | Rolni o'zgartirish — tasdiq (taklif) | oyna | `/all-users/:id` | `src/features/user/change-role/ui/roleChangeConfirm.tsx` | v2 |
| `superadmin-users-role-confirm-logist` | Rolni o'zgartirish — Logist → Admin, viloyatlar bo'shatiladi (taklif) | oyna | `/all-users/:id` | `src/features/user/change-role/ui/roleChangeConfirm.tsx` | v2 |
| `superadmin-users-edit-role-error` | Foydalanuvchini tahrirlash — rol o'zgartirilmadi, 409 (taklif) | oyna | `/all-users/:id` | `src/features/user/change-role/ui/RoleSection.tsx` | qisman — FY-2: 409 — oyna ichida «Rol o'zgartirilmadi» umumiy matn bilan («{ism} filialga biriktirilgan …»); filial nomi va «… filialini ochish» tugmasi chizilmagan — backend 409 javobida filial maydoni yo'q (kGIjOciz, FY-4; backend matni ko'rsatilmaydi). 503 / tarmoq — o'sha joyda «Qayta urinish» (tasdiqsiz qayta yuboradi), 400/403 — umumiy matn. |
| `superadmin-users-edit-role-branch` | Foydalanuvchini tahrirlash — filialga biriktirilgan, rol qulf (taklif) | oyna | `/all-users/:id` | `src/pages/users/detail/UserDetailPage.tsx` | yangi (kodda yo'q) — Taklif (users-roles): filialga biriktirilgan — rol maydoni qulf. Backend kerak: GET /users da branch_id + branch{id,name} (kGIjOciz) — FY-4; FY-2 da rol maydoni ochiq, 409 umumiy matn bilan. |
| `superadmin-users-edit-courier-district` | Kuryerni tahrirlash — «Tuman» maydoni (taklif) | oyna | `/all-users/:id` | `src/features/user/update-user/ui/UpdateUserModal.tsx` | qisman — Kodda bor (FY-1, DtKKY0V8): «Ish hududi» — viloyat faqat o'qish (GET /users/:id `region`) + «Boshqa filialga o'tkazish — unda tuman tozalanadi» izohi (FY-S4); «Tuman» — qidiruvli tanlov, faqat kuryer viloyati tumanlari, ixtiyoriy; o'zgarsa PATCH /users/:id { district_id } (× — null), 400/503 — maydon ostida va xabarda i18n matni. Farq: «Filial va viloyat» o'rnida «Viloyat» (filial nomi tahrirlash oynasida yo'q). |
| `superadmin-users-create-courier-district` | Yangi foydalanuvchi — Logist roli va kuryer «Ish hududi» (taklif) | sahifa | `/all-users/create-user` | `src/pages/users/create/CreateUserPage.tsx` | v2 |
| `superadmin-users-edit-market-ai` | Marketni tahrirlash — «AI narxi (1 buyurtma)» | oyna | `/all-users/:id` | `src/features/user/update-user/ui/UpdateUserModal.tsx` | qisman — CS-C: kodda market yorlig'i «Uyga standart narx» / «Markazga standart narx» (maket `superadmin-users-detail` / `-users-edit-dialog`, ega S1, sinxron f86a2e73 2026-10-19); bu maketda fondagi «Tarif» kartasi va «Market ma'lumotlari» maydonlarida hali «Uyga tarif» / «Markazga tarif» (FY-1, o'sha f86a2e73) — bir xil maydon uchun maketlar ziddiyati, ega savoli. Qolgani — avvalgidek v2. |
| `superadmin-users-edit-courier-district-phone` | Kuryerni tahrirlash — «Tuman» ro'yxati, telefon (taklif) | oyna · faqat telefon | `/all-users/:id` | `src/pages/users/detail/UserDetailPage.tsx` | qisman — Kodda bor (FY-1, DtKKY0V8): «Ish hududi» — viloyat faqat o'qish (GET /users/:id `region`) + «Boshqa filialga o'tkazish — unda tuman tozalanadi» izohi (FY-S4); «Tuman» — qidiruvli tanlov, faqat kuryer viloyati tumanlari, ixtiyoriy; o'zgarsa PATCH /users/:id { district_id } (× — null), 400/503 — maydon ostida va xabarda i18n matni. Farq: «Filial va viloyat» o'rnida «Viloyat» (filial nomi tahrirlash oynasida yo'q). Telefonda — pastki varaqa. |
| `superadmin-users-edit-market-ai-phone` | Marketni tahrirlash — «AI narxi», telefon | oyna · faqat telefon | `/all-users/:id` | `src/features/user/update-user/ui/UpdateUserModal.tsx` | qisman — CS-C: kodda market yorlig'i «Uyga standart narx» / «Markazga standart narx» (maket `superadmin-users-detail` / `-users-edit-dialog`, ega S1, sinxron f86a2e73 2026-10-19); bu maketda fondagi «Tarif» kartasi va «Market ma'lumotlari» maydonlarida hali «Uyga tarif» / «Markazga tarif» (FY-1, o'sha f86a2e73) — bir xil maydon uchun maketlar ziddiyati, ega savoli. Qolgani — avvalgidek v2. |
| `superadmin-regions-logist-assignment-confirm-dialog` | Logist biriktirish — saqlashni tasdiqlash | oyna | `/regions/logist-assignment` | `src/pages/region/pages/logist-assignment/ui/ChangesList.tsx` | v2 |
| `superadmin-regions-logist-assignment-empty` | Logist biriktirish — logist yo'q | sahifa | `/regions/logist-assignment` | `src/pages/region/pages/logist-assignment/index.tsx` | v2 |
| `superadmin-users-create-logist` | Foydalanuvchi yaratish — Logist | sahifa | `/all-users/create-user` | `src/pages/users/create/CreateUserPage.tsx` | v2 |
| `superadmin-notifications-row-menu` | Guruh amallari menyusi | oyna | `/notifications` | `src/pages/notifications/ui/NotificationRowMenu.tsx` | v2 |
| `superadmin-notifications-connected` | Bildirishnomalar — guruh ulandi | sahifa | `/notifications` | `src/pages/notifications/ui/NotificationsPage.tsx` | v2 |
| `superadmin-notifications-empty` | Bildirishnomalar — bo'sh holat | sahifa | `/notifications` | `src/pages/notifications/ui/NotificationsPage.tsx` | v2 |
| `superadmin-notifications-loading` | Bildirishnomalar — yuklanish | sahifa | `/notifications` | `src/pages/notifications/ui/NotificationsPage.tsx` | v2 |
| `superadmin-notifications-error` | Bildirishnomalar — xato holati | sahifa | `/notifications` | `src/pages/notifications/ui/NotificationsPage.tsx` | v2 |
| `superadmin-notifications-create-link-dialog` | Bildirishnoma qo'shish — havola tayyor, kutilmoqda | oyna | `/notifications` | `src/features/notification-create/ui/NotificationFormModal.tsx`, `src/features/telegram-link/ui/LinkCountdown.tsx` | v2 |
| `superadmin-notifications-create-expired-dialog` | Bildirishnoma qo'shish — havola muddati tugadi | oyna | `/notifications` | `src/features/notification-create/ui/NotificationFormModal.tsx` | v2 |
| `superadmin-notifications-create-exists-dialog` | Bildirishnoma qo'shish — shu tur allaqachon ulangan | oyna | `/notifications` | `src/features/notification-create/ui/NotificationFormModal.tsx` | v2 |
| `superadmin-notifications-deactivate-dialog` | Guruhni nofaol qilish (tasdiq) | oyna | `/notifications` | `src/features/notification-toggle/ui/useToggleNotificationConfirm.tsx` | v2 |
| `superadmin-notifications-activate-dialog` | Guruhni faollashtirish (tasdiq) | oyna | `/notifications` | `src/features/notification-toggle/ui/useToggleNotificationConfirm.tsx` | qisman — Kodda bor (NG-A, NG-C, v2). Nofaollik sababi (inactive_reason, G085w5Qr) maketdagidek: bot chiqarilgan / guruh topilmadi — qizil «Nofaol» + «Bot guruhdan chiqarilgan — …» / «Guruh topilmadi — …», qo'lda — neytral «Qo'lda nofaol qilingan»; faollashtirish ogohlantirishi bot chiqarilganda «Bot guruhdan chiqarilgan». Maketdan farq: blocked_on_send matni maketda yo'q («Bot guruhga xabar yubora olmadi — …», qizil); sabab null yoki noma'lum — neytral umumiy izoh «Xabarlar bu guruhga yuborilmayapti» va ogohlantirish «Bot guruhda ekanini tekshiring» (D1); inactive_at bo'lsa izoh ostida «Nofaol bo'lgan: {sana}» (maketda yo'q). |
| `superadmin-notifications-row-menu-inactive` | Guruh amallari menyusi — nofaol guruh | oyna | `/notifications` | `src/pages/notifications/ui/NotificationRowMenu.tsx` | qisman — Kodda bor (NG-A, NG-C, v2). Nofaollik sababi (inactive_reason, G085w5Qr) maketdagidek: bot chiqarilgan / guruh topilmadi — qizil «Nofaol» + «Bot guruhdan chiqarilgan — …» / «Guruh topilmadi — …», qo'lda — neytral «Qo'lda nofaol qilingan»; faollashtirish ogohlantirishi bot chiqarilganda «Bot guruhdan chiqarilgan». Maketdan farq: blocked_on_send matni maketda yo'q («Bot guruhga xabar yubora olmadi — …», qizil); sabab null yoki noma'lum — neytral umumiy izoh «Xabarlar bu guruhga yuborilmayapti» va ogohlantirish «Bot guruhda ekanini tekshiring» (D1); inactive_at bo'lsa izoh ostida «Nofaol bo'lgan: {sana}» (maketda yo'q). |
| `superadmin-notifications-create-exists-inactive-dialog` | Bildirishnoma qo'shish — shu tur ulangan, lekin nofaol | oyna | `/notifications` | `src/features/notification-create/ui/NotificationFormModal.tsx` | qisman — Kodda bor (v2, NG-B): «Faollashtirish» — ochiq oyna ustida tasdiq (*-activate-dialog, PATCH {is_active: true}). NG-C (G085w5Qr): matn inactive_reason bo'yicha — kicked/left: maketdagi «… nofaol — bot guruhdan chiqarilgan (ID: …)»; chat_not_found, blocked_on_send, manual — o'z matni (maketda yo'q); null yoki noma'lum — umumiy «xabarlar unga yuborilmayapti» (D1). |
| `superadmin-payments-main-cashbox-accounts` | Asosiy kassa — kartalar va hisob raqamlar | sahifa | `/payments/main-cashbox` | `src/pages/payments/components/mainCashbox.tsx` | yangi (kodda yo'q) — Trello 2026-10-23 (ega topshirig'i), 1-band: kassa kartalari va hisob raqamlari bo'limi — backend'da MAIN uchun nomli kartalar bor (3PE0B03q), frontend'da UI yo'q; turi/bank/oxirgi 4 raqam/egasi, filial kassalari — yangi. |
| `superadmin-payments-cashbox-account-form-dialog` | Karta yoki hisob raqam qo'shish (popup) | oyna | `/payments/main-cashbox` | `src/pages/payments/components/mainCashbox.tsx` | yangi (kodda yo'q) — Trello 2026-10-23 (ega topshirig'i), 1-band: karta yoki hisob raqam qo'shish oynasi; smena kalitlari (rasm, AI) faqat superadminga. |
| `superadmin-payments-main-cashbox-fill-dialog-account` | Kassaga kirim — karta yoki hisob raqamni tanlash (popup) | oyna | `/payments/main-cashbox` | `src/pages/payments/components/mainCashbox.tsx` | yangi (kodda yo'q) — Trello 2026-10-23 (ega topshirig'i), 1-band: kirim/xarajatda karta yoki hisob raqam tanlovi. |
| `superadmin-payments-main-cashbox-shift-dialog-accounts` | Smenani yopish — kartalar qoldig'i, rasm va AI tekshiruvi (popup) | oyna | `/payments/main-cashbox` | `src/pages/payments/components/mainCashbox.tsx` | v2 |
| `superadmin-payments-shift-report` | Smena hisoboti — kartalar, AI tekshiruvi, avtomatik yopilish | sahifa | `/payments/shifts/:id` | `src/pages/payments/shiftReport/index.tsx` | v2 |
| `superadmin-payments-shift-settings` | Kassa smenasi sozlamalari — rasm, AI, avtomatik yopish, hisobot | sahifa | `/payments/shift-settings` | `src/pages/payments/shiftSettings/index.tsx` | v2 |
| `superadmin-neworders-create-ai-input-images` | Buyurtma yaratish — AI: 20 tagacha rasm, avtomatik siqish | sahifa | `/new-orders/create` | `src/pages/orders/create/index.tsx` | yangi (kodda yo'q) — Trello 2026-10-23 (ega topshirig'i), 7-band: 20 tagacha rasm, brauzerda siqish (hozir AI_MAX_IMAGES = 3, JPEG 0,92). |
| `superadmin-ai-assistant` | AI moliyaviy yordamchi | sahifa | `(taklif) /ai-assistant` | — | yangi (kodda yo'q) — Trello 2026-10-23 (ega topshirig'i), 9-band: AI moliyaviy yordamchi — kodda yo'q. |
| `superadmin-ai-assistant-access-dialog` | AI yordamchi — kirish huquqi (popup) | oyna | `(taklif) /ai-assistant` | — | yangi (kodda yo'q) — Trello 2026-10-23 (ega topshirig'i), 9-band: adminlarga kirish huquqi — kodda yo'q. |
| `superadmin-warehouse-list` | Omborlar | sahifa | `/warehouses` | `src/pages/warehouses/index.tsx` | v2 |
| `superadmin-warehouse-create-dialog` | Ombor ochish (popup) | oyna | `/warehouses` | `src/pages/warehouses/index.tsx` | v2 |
| `superadmin-warehouse-detail` | Ombor tafsiloti — qoldiq va harakatlar | sahifa | `/warehouses/:id` | `src/pages/warehouses/detail/index.tsx` | v2 |
| `superadmin-warehouse-stock-in-dialog` | Omborga mahsulot qo'shish — kirim (popup) | oyna | `/warehouses/:id` | `src/pages/warehouses/detail/index.tsx` | v2 |
| `superadmin-users-create-password-sms` | Foydalanuvchi yaratish — parolni tizim yaratadi va SMS yuboradi | sahifa | `/all-users/create-user` | `src/pages/users/create/CreateUserPage.tsx` | v2 |
| `superadmin-users-create-password-result-dialog` | Foydalanuvchi yaratildi — parol SMS orqali yuborildi (popup) | oyna | `/all-users/create-user` | `src/pages/users/create/CreateUserPage.tsx` | v2 |
| `superadmin-neworders-create-manual-source` | Buyurtma yaratish — manba: viloyat ombori yoki HQ | sahifa | `/new-orders/create` | `src/pages/orders/create/index.tsx` | v2 |
| `superadmin-users-edit-market-warehouse` | Marketni tahrirlash — «Ombordan buyurtma yaratish» kaliti (popup) | oyna | `/all-users/:id` | `src/pages/users/detail/UserDetailPage.tsx` | v2 |
| `superadmin-products-edit-dialog-barcode` | Mahsulotni tahrirlash — shtrix kod va QR stiker (popup) | oyna | `/products` | `src/pages/products/list/index.tsx` | v2 |
| `superadmin-regions-delivery-tariffs` | Yetkazish tariflari — har kg narxi, qo'shimcha haq chegarasi, kalkulyator | sahifa | `/delivery-tariffs` | `src/pages/delivery-tariffs/index.tsx` | v2 |
| `superadmin-regions-delivery-tariff-edit-dialog` | Tarifni o'zgartirish — asosiy narx, har kg narxi, kuchga kirish sanasi (popup) | oyna | `/delivery-tariffs` | `src/pages/delivery-tariffs/index.tsx` | v2 |
| `superadmin-payments-history-detail-dialog-correctable` | To'lov tarixi — yozuv tafsiloti · «Qaytarish» va «Summani tahrirlash» (muddat ichida) | oyna | `/payments` | `src/pages/payments/index.tsx` | yangi (kodda yo'q) — T6 (Env2iYq1) pul qaytarish / summani tahrirlash — kodda yo'q: FinanceHistoryDetailPopup footer — canCorrectPayments + correctable.allowed → «Summani tahrirlash» (secondary), «Qaytarish» (danger-soft), muddat izohi. |
| `superadmin-payments-history-detail-dialog-locked` | To'lov tarixi — yozuv tafsiloti · tuzatib bo'lmaydi (muddat tugagan, eski yozuv) | oyna | `/payments` | `src/pages/payments/index.tsx` | yangi (kodda yo'q) — T6 (Env2iYq1) pul qaytarish / summani tahrirlash — kodda yo'q: correctable.allowed = false → tugmalar o'rnida izoh (WINDOW_EXPIRED «Muddat tugagan: {sana}», LEGACY_UNLINKED «Eski yozuv», NOT_CORRECTABLE). |
| `superadmin-payments-history-detail-dialog-corrected` | To'lov tarixi — yozuv tafsiloti · tahrirlangan to'lov, «Qaytarish va tahrir» bloki | oyna | `/payments` | `src/pages/payments/index.tsx` | yangi (kodda yo'q) — T6 (Env2iYq1) pul qaytarish / summani tahrirlash — kodda yo'q: «Qaytarish va tahrir» bloki (amal, sana, kim, sabab, eski → yangi, bog'liq yozuvlar) — barcha rollarga. |
| `superadmin-payments-history-detail-dialog-replacement` | To'lov tarixi — yozuv tafsiloti · tuzatilgan to'lov (yangi yozuv) va teskari yozuv | oyna | `/payments` | `src/pages/payments/index.tsx` | yangi (kodda yo'q) — T6 (Env2iYq1) pul qaytarish / summani tahrirlash — kodda yo'q: correction.role = replacement («Tuzatilgan», yana tuzatsa bo'ladi — muddat zanjirning birinchi to'lovidan) va reversal («Teskari yozuv», NOT_CORRECTABLE). |
| `superadmin-payments-history-reverse-dialog` | To'lovni qaytarish — sabab (oyna) | oyna | `/payments` | `src/pages/payments/index.tsx` | yangi (kodda yo'q) — T6 (Env2iYq1) pul qaytarish / summani tahrirlash — kodda yo'q: features/payment-correction ReversePaymentDialog (Dialog, xulosa, «Sabab» 5–500). |
| `superadmin-payments-history-reverse-confirm` | To'lovni qaytarish — tasdiq | oyna | `/payments` | `src/pages/payments/index.tsx` | yangi (kodda yo'q) — T6 (Env2iYq1) pul qaytarish / summani tahrirlash — kodda yo'q: useConfirm({ tone: "danger", amount, transfer, consequences, confirmLabel: "Qaytarish" }). |
| `superadmin-payments-history-reverse-errors` | To'lovni qaytarish — xatolar (smena yopiq, pul yetmaydi, internet yo'q …) | oyna | `/payments` | `src/pages/payments/index.tsx` | yangi (kodda yo'q) — T6 (Env2iYq1) pul qaytarish / summani tahrirlash — kodda yo'q: xato tasdiq oynasida qoladi (SHIFT_REQUIRED, INSUFFICIENT_BALANCE, CARD_ARCHIVED, ALREADY_CORRECTED, WINDOW_EXPIRED, oflayn). |
| `superadmin-payments-history-correct-amount-dialog` | Summani tahrirlash (oyna) | oyna | `/payments` | `src/pages/payments/index.tsx` | yangi (kodda yo'q) — T6 (Env2iYq1) pul qaytarish / summani tahrirlash — kodda yo'q: features/payment-correction CorrectAmountDialog (joriy summa, «To'g'ri summa», farq, «Sabab»). |
| `superadmin-payments-history-correct-amount-confirm` | Summani tahrirlash — tasdiq | oyna | `/payments` | `src/pages/payments/index.tsx` | yangi (kodda yo'q) — T6 (Env2iYq1) pul qaytarish / summani tahrirlash — kodda yo'q: useConfirm({ confirmLabel: "Tahrirlash", rows, consequences }). |
| `superadmin-payments-history-correct-amount-errors` | Summani tahrirlash — xatolar (ko'pi bilan …, bir xil summa) | oyna | `/payments` | `src/pages/payments/index.tsx` | yangi (kodda yo'q) — T6 (Env2iYq1) pul qaytarish / summani tahrirlash — kodda yo'q: AMOUNT_EXCEEDS «Ko'pi bilan {max}», SAME_AMOUNT, oflayn. |
| `superadmin-payments-overview-corrected` | To'lovlar — umumiy · qaytarilgan va tahrirlangan to'lovlar belgilari | sahifa | `/payments` | `src/pages/payments/index.tsx` | yangi (kodda yo'q) — T6 (Env2iYq1) pul qaytarish / summani tahrirlash — kodda yo'q: patmentHistoryTable — 4 belgi (Qaytarildi, Tahrirlangan, Teskari yozuv, Tuzatilgan) jadvalda va telefon kartalarida. |
| `superadmin-payments-cash-detail-courier-corrected` | Kuryer kassasi · qaytarilgan to'lov belgilari | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | yangi (kodda yo'q) — T6 (Env2iYq1) pul qaytarish / summani tahrirlash — kodda yo'q: PaymentHistoryList — «Qaytarildi» va «Teskari yozuv». |
| `superadmin-payments-shift-settings-correction` | Kassa smenasi sozlamalari · to'lovlarni tuzatish muddati (7 · 10 · 30 · Boshqa) | sahifa | `/payments/shift-settings` | `src/pages/payments/shiftSettings/index.tsx` | yangi (kodda yo'q) — T6 (Env2iYq1) pul qaytarish / summani tahrirlash — kodda yo'q: «To'lovlarni tuzatish muddati» kartasi (GET/PATCH finance/payment-corrections/settings), sahifadagi yagona «Saqlash». |
| `superadmin-users-list-responsibles-entry` | Foydalanuvchilar ro'yxati — «Market mas'ullari» tugmasi | sahifa | `/all-users` | `src/pages/users/list/UserListPage.tsx` | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F4 — UserListPage sarlavhasida ikkilamchi «Market mas'ullari» (faqat superadmin, admin). |
| `superadmin-users-market-responsibles` | Market mas'ullari | sahifa | `(taklif) /all-users/market-responsibles` | — | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F4 — sukut mas'ul + 2 umumiy raqam, xodimlar (market_count), marketlar DataTable (tanlov, qidiruv, «Barchasi · Shu xodimda · Sukutda», «Mas'ul», Pagination), ommaviy amallar. |
| `superadmin-users-market-responsibles-empty` | Market mas'ullari — sukut va umumiy raqam belgilanmagan (birinchi sozlash) | sahifa | `(taklif) /all-users/market-responsibles` | — | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F4 — default_market_responsible null, support_phones [], barcha marketlar «Belgilanmagan». |
| `superadmin-users-market-responsibles-settings-confirm` | Market mas'ullari — sukut va umumiy raqamlarni saqlash (tasdiq) | oyna | `(taklif) /all-users/market-responsibles` | — | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F4 — PATCH /settings/contacts oldidan useConfirm (oldin → keyin). |
| `superadmin-users-market-responsibles-move-confirm` | Market mas'ullari — boshqa xodimga o'tkazish (tasdiq, X → Y) | oyna | `(taklif) /all-users/market-responsibles` | — | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F4 — POST /markets/responsible/bulk, boshqa xodimdagi market bo'lsa — tasdiq «X → Y · N ta». |
| `superadmin-users-market-responsibles-default-confirm` | Market mas'ullari — sukutga qaytarish (tasdiq) | oyna | `(taklif) /all-users/market-responsibles` | — | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F4 — POST /markets/responsible/bulk { responsible_id: null } — tasdiq «X → Sukut · N ta». |
| `superadmin-users-detail-market-responsible` | Market tafsiloti — «Elchi mas'uli» kartasi | sahifa | `/all-users/:id` | `src/pages/users/detail/UserDetailPage.tsx` | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F4 UserDetailView (market) — «Elchi mas'uli» kartasi (responsible, responsible_source) + «O'zgartirish». |
| `superadmin-users-detail-market-responsible-dialog` | Market tafsiloti — mas'ulni o'zgartirish (oyna) | oyna | `/all-users/:id` | `src/pages/users/detail/UserDetailPage.tsx` | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F4 — «Mas'ulni o'zgartirish» Dialog, PATCH /markets/:id/responsible. |
| `superadmin-users-role-confirm-responsible` | Rolni o'zgartirish — Logist → Menejer, N ta market sukutga o'tadi | oyna | `/all-users/:id` | `src/pages/users/detail/UserDetailPage.tsx` | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F4 RoleSection tasdig'ida «N ta market sukutga o'tadi» (B4). |
| `superadmin-users-delete-dialog-responsible` | Foydalanuvchini o'chirish — N ta market sukutga o'tadi | oyna | `/all-users` | `src/pages/users/list/UserListPage.tsx` | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F4 UserListTable o'chirish tasdig'ida «N ta market sukutga o'tadi» (B4). |
| `superadmin-payments-main-cashbox-expense-receipt-dialog` | Kassadan xarajat — chek rasmi bilan (popup) | oyna | `/payments/main-cashbox` | `src/pages/payments/components/mainCashbox.tsx` | qisman — Kodda bor (QlLf33Ma): CashboxFormPopup (spend) — «Chek rasmi» (receipt/ReceiptField) kategoriya va izoh orasida, receipt-settings manual_expense.photo_required bo'lsa majburiy; superadminda «Sozlamalar» havolasi; yuklanayotganda «Xarajatni saqlash» o'chiq; eskiz → ReceiptViewerDialog. Farq: «Yuklash» — Pressable (label emas), bosilganda yashirin file input ochiladi. |
| `superadmin-payments-main-cashbox-expense-receipt-confirm` | Xarajatni tasdiqlang — «Chek: biriktirildi» qatori | oyna | `/payments/main-cashbox` | `src/pages/payments/components/mainCashbox.tsx` | qisman — Kodda bor (QlLf33Ma): useConfirm rows ← «Chek» · «Biriktirildi» (ReceiptAttachedValue); muvaffaqiyat — notify.success + «Chek AI tahlilida — natija tarixda ko'rinadi» (faqat javobda receipt.ai_status=pending); RECEIPT_REQUIRED — oyna formaga qaytadi. |
| `superadmin-payments-main-cashbox-expense-receipt-states` | Kassadan xarajat — chek rasmi maydoni holatlari | sahifa | `/payments/main-cashbox` | `src/pages/payments/components/mainCashbox.tsx` | qisman — Kodda bor (QlLf33Ma): ReceiptField holatlari — bo'sh, sozlama yuklanmoqda, yuklanmoqda (foiz, «To'xtatish»), yuklandi, AI o'chiq, majburiy, katta / format / HEIC, yuklash xatosi + «Qayta urinish», oflayn, RECEIPT_NOT_FOUND / 409. |
| `superadmin-payments-cash-detail-courier-receipt` | Kuryer kassasi (HQ kuryeri) — «O'tkazma» qabulida chek rasmi | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | qisman — Kodda bor (QlLf33Ma): cashDetail (type=courier, superadmin/admin) — «O'tkazma» (click) tanlansa ReceiptField (kind courier_to_hq); Naqd va «Marketga o'tkazma» da yo'q; receipt_id barmoq iziga kirmaydi. Admin — ayni (havolasiz); menejerning kuryer qabulida chek yo'q. Tarix ro'yxatida «Chek» belgisi (ReceiptRowBadge). |
| `superadmin-payments-cash-detail-branch-receipt` | Filial kassasi — filialdan HQ ga «O'tkazma» qabulida chek rasmi | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | qisman — Kodda bor (QlLf33Ma): cashDetail (type=branch, branch-to-main, superadmin/admin) — «O'tkazma» da ReceiptField (kind branch_to_hq). Admin — ayni (havolasiz). |
| `superadmin-payments-history-detail-dialog-receipt` | To'lov tarixi — yozuv tafsiloti · «Chek» bo'limi (farq bor) | oyna | `/payments` | `src/pages/payments/index.tsx` | qisman — Kodda bor (QlLf33Ma): FinanceHistoryDetailPopup → receipt/ReceiptSection (row.receipt yoki history/:id receipt bo'lsa): holat, eskiz → ko'ruvchi, AI maydonlari, farq, «Qayta tahlil» (can_reanalyze). Ma'lumot GET finance/receipts/:id dan. |
| `superadmin-payments-history-detail-receipt-states` | To'lov tarixi — «Chek» bo'limi va ko'ruvchi holatlari | sahifa | `/payments` | `src/pages/payments/index.tsx` | qisman — Kodda bor (QlLf33Ma): ReceiptSection — mos keldi, tahlilda, natija kelmadi (ai_stale), o'qib bo'lmadi, xato, AI o'chiq, bayroqlar, urinishlar tugadi, yuklanmoqda / xato; ReceiptViewerDialog — 100%, yuklanmoqda, ochilmadi. |
| `superadmin-payments-receipt-viewer-dialog` | Chek rasmi — ko'ruvchi (Moslash ↔ 100%, yangi oynada ochish) | oyna | `/payments` | `src/pages/payments/index.tsx` | qisman — Kodda bor (QlLf33Ma): ReceiptViewerDialog — Dialog lg, telefonda varaqa 92dvh (pinch-zoom); photo_url 300 s, rasm ochilmasa «Qayta urinish» yangi havola so'raydi. Farq: telefonda Dialog primitivining balandlik chegarasi (92dvh) saqlangan. |
| `superadmin-payments-history-receipt-reanalyze-confirm` | Chekni qayta tahlil — tasdiq | oyna | `/payments` | `src/pages/payments/index.tsx` | qisman — Kodda bor (QlLf33Ma): useConfirm → POST finance/receipts/:id/reanalyze (202); 409 / 429 / 400 va tarmoq xatosi oynada, kod bo'yicha matn. |
| `superadmin-payments-overview-receipts` | To'lovlar — umumiy · «Chek» belgilari va «Chek holati» filtri | sahifa | `/payments` | `src/pages/payments/index.tsx` | qisman — Kodda bor (QlLf33Ma): patmentHistoryTable / PaymentHistoryList — ReceiptRowBadge (Receipt + holat; telefonda karta meta qatorida); /payments da «Chek holati» Select (receipt_status, URL; superadmin/admin). Menejer — belgilar bor, filtr yo'q. «Chek yo'q» variant ostida izoh. |
| `superadmin-payments-shift-settings-receipts` | Kassa smenasi sozlamalari · «Chek rasmi va AI tahlili» kartasi | sahifa | `/payments/shift-settings` | `src/pages/payments/shiftSettings/index.tsx` | qisman — Kodda bor (QlLf33Ma): shiftSettings/ReceiptSettingsCard — GET/PATCH finance/receipt-settings, «Qo'lda chiqim» va «Kuryer va filialdan HQ'ga o'tkazma» × «Chek rasmi majburiy» / «AI tahlili»; rasm o'chiq — AI kaliti o'chiq + «Avval chek rasmini yoqing»; sahifadagi yagona «Saqlash» (faqat o'zgargan so'rov). Farq: telefon qatorida ikonka yo'q (maketdagidek), «Oxirgi o'zgarish» ismi GET users/:id dan — backend updated_by ID beradi. |
| `superadmin-payments-shift-settings-receipts-photo-off-confirm` | Chek rasmini o'chirish — tasdiq | oyna | `/payments/shift-settings` | `src/pages/payments/shiftSettings/index.tsx` | qisman — Kodda bor (QlLf33Ma): useConfirm (danger) — «Chek rasmi majburiy» o'chirilishidan oldin; AI ham o'chadi, AI kaliti tasdiqsiz. |
| `superadmin-payments-main-cashbox-receipts` | Asosiy kassa — operatsiyalar tarixida «Chek» belgilari | sahifa | `/payments/main-cashbox` | `src/pages/payments/components/mainCashbox.tsx` | qisman — Kodda bor (QlLf33Ma): mainCashbox.tsx historyColumns («Manba» katakchasi — kategoriya belgisidan keyin) va renderHistoryCard (telefon kartasining meta qatori) — ReceiptRowBadge. Faqat superadmin va admin; menejerning filial kassasida belgi yo'q. Qator → FinanceHistoryDetailPopup «Chek» bo'limi. |
| `superadmin-neworders-create-manual-step2-special-categories` | Buyurtma yaratish — 2-qadam: maxsus belgilar (Izoh tepasida) | sahifa | `/new-orders/create` | `src/pages/orders/create/index.tsx` | yangi (kodda yo'q) — T8 (EcD6EHTH) maxsus belgilar — kodda yo'q: SpecialCategoryPicker (entities/order/ui, 7 ta .el-chip — Pressable aria-pressed, role=group «Maxsus belgilar (ixtiyoriy)») Step2Combined.tsx da «Izoh» tepasida; xulosada «Maxsus belgilar» qatori; payload special_categories faqat bo'sh bo'lmasa (orderCreateForm.ts). Market va market operatori — joylashuv bir xil (market-new-orders-create-manual), admin, ro'yxatchi va menejer (HQ · PICKUP · HYBRID) — xuddi shunday. |
| `superadmin-neworders-create-ai-preview-special-categories` | Buyurtma yaratish — AI natijalari: har kartada maxsus belgilar | sahifa | `/new-orders/create` | `src/pages/orders/create/index.tsx` | yangi (kodda yo'q) — T8 (EcD6EHTH) maxsus belgilar — kodda yo'q: AiPreviewCard.tsx — har kartada picker («Izoh» tepasida), aiDraft.ts + buildAiConfirmPayload (AiConfirmOrderDto.special_categories). «AI taklifi» holati — BE-2 (ixtiyoriy). |
| `superadmin-orders-detail-special-categories-dialog` | Buyurtma tafsilotlari — «Maxsus belgilar» oynasi | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | yangi (kodda yo'q) — T8 (EcD6EHTH) maxsus belgilar — kodda yo'q: features/order-special-categories — SpecialCategoriesDialog (Dialog + picker + «Saqlash»), useUpdateSpecialCategories → PUT /orders/:id/special-categories; saqlangach notify.success + amal «Maxsus yorliqni chop etish»; 403 / tarmoq — notify.error, oyna saqlanadi. |
| `superadmin-orders-detail-special-categories-locked` | «Maxsus belgilar» oynasi — holat qulflandi (409) | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | yangi (kodda yo'q) — T8 (EcD6EHTH) maxsus belgilar — kodda yo'q: 409 SPECIAL_CATEGORIES_LOCKED «Bu holatda maxsus belgini o'zgartirib bo'lmaydi» — tafsilot qayta yuklanadi, chiplar o'chiq, faqat «Yopish»; qulf qoidasi — canEditSpecialCategories (entities/order/model/specialCategories.ts). |
| `superadmin-orders-list-special-categories` | Buyurtmalar ro'yxati — maxsus belgilar (2 + «+N») | sahifa | `/orders` | `src/pages/orders/index.tsx` | yangi (kodda yo'q) — T8 (EcD6EHTH) maxsus belgilar — kodda yo'q: OrdersTable.tsx statusBadges — SpecialCategoryTags (Badge neutral + 14 px ikonka + nom), telefon kartasida alohida qator. Filtr YO'Q (TZ: GET /orders da param yo'q). admin, ro'yxatchi va menejer (HQ · PICKUP · HYBRID) — xuddi shunday, market ham. |
| `superadmin-orders-detail-special-categories` | Buyurtma tafsilotlari — maxsus belgilar, «O'zgartirish», tarix | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | yangi (kodda yo'q) — T8 (EcD6EHTH) maxsus belgilar — kodda yo'q: DetailHeader.tsx — «Maxsus belgilar:» qatori + «O'zgartirish» (canCreateOrders && canEditSpecialCategories — faol; faqat canCreateOrders — o'chiq, «Bu holatda o'zgartirib bo'lmaydi»); «Maxsus yorliq chop etish» (Printer); tarix — actionLabelMap/describeTrackingEvent «Maxsus belgilar: …». admin, ro'yxatchi va menejer (HQ · PICKUP · HYBRID) — xuddi shunday. |
| `superadmin-mails-detail-special-categories` | Pochta tafsiloti (jo'natish) — maxsus belgilar | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | yangi (kodda yo'q) — T8 (EcD6EHTH) maxsus belgilar — kodda yo'q: mails/detail/ui/OrdersTable.tsx — holat ustunida SpecialCategoryTags; PostOrder.special_categories (entities/mails), toApiOrder ko'chiradi. Barcha pochta rejimlarida (qabul, rad etilgan, tarix) — shunday. |
| `superadmin-neworders-market-orders-special-print-menu` | Market yangi buyurtmalari — «Faqat maxsus yorliqlar» menyusi | sahifa | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | yangi (kodda yo'q) — T8 (EcD6EHTH) maxsus belgilar — kodda yo'q: MarketOrdersTable.tsx — Yetkazish ustunida belgilar; SelectionBar.tsx menyusida «Faqat maxsus yorliqlar» (categories_only, belgisiz tanlovda PrintModeSelect option.disabled + izoh); chekdan keyin maxsus yorliqlar avtomatik. |
| `superadmin-neworders-market-orders-special-print-dialog` | «Maxsus yorliq chop etish» oynasi | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | yangi (kodda yo'q) — T8 (EcD6EHTH) maxsus belgilar — kodda yo'q: SpecialLabelPrintDialog (Dialog) — «N ta buyurtma · M ta yorliq», belgilar chiplari (hammasi tanlangan), nusxa SegmentedControl 1·2·3, usul «Brauzer · PDF 100×60», «Chop etish»; tafsilotdagi «Maxsus yorliq chop etish» ham shu oynani ochadi (1 ta buyurtma). |

### admin — Admin

171 ta maket · kodda bor: 159 · kodda yo'q: 12

| Maket | Sarlavha | Tur | Route | Asosiy fayl | Holat |
|---|---|---|---|---|---|
| `admin-dashboard-main` | Dashboard | sahifa | `/` | `src/pages/dashboard/DashboardPage.tsx` | v2 |
| `admin-orders-list` | Buyurtmalar ro'yxati | sahifa | `/orders` | `src/pages/orders/index.tsx` | qisman — Bekor qatorlarida bosqich badge'i (Bekor · kuryerda / yo'lda / filialda / HQ'da — danger + ikonka; «Marketga topshirildi» — neutral, PackageCheck) va ostida joy qatori «Urgut filiali · 2 kun»; muddat 3 kunda warning, 7 kunda + TriangleAlert (BG7) (taklif «Bekor holatlari» (ega 2026-10-19, Trello vOczoOUE; elchi-v2-specs/bekor-holatlari-taklif.md)) — kodda hali eski «Bekor qilingan» badge'i. |
| `admin-orders-filters-mobile` | Buyurtmalar — filtr paneli (telefon) | oyna · faqat telefon | `/orders` | `src/pages/orders/list/OrderFilters.tsx` | v2 |
| `admin-orders-detail` | Buyurtma tafsiloti | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | v2 |
| `admin-orders-edit-order-dialog` | Buyurtmani tahrirlash oynasi | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/editDialogs/EditOrderDialog.tsx` | v2 |
| `admin-orders-edit-customer-dialog` | Mijozni tahrirlash oynasi | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/editDialogs/EditCustomerDialog.tsx` | v2 |
| `admin-orders-edit-address-dialog` | Manzilni tahrirlash oynasi | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/editDialogs/EditAddressDialog.tsx` | v2 |
| `admin-neworders-markets` | Qabul — Marketlar tabi | sahifa | `/new-orders` | `src/pages/new_orders/markets/index.tsx` | v2 |
| `admin-neworders-market-detail` | Market yangi buyurtmalari | sahifa | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | v2 |
| `admin-neworders-market-detail-camera` | Market yangi buyurtmalari — kamera | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | qisman — Kamera v2 — markaziy «Skaner» (planshet/desktopda «Skanerlash») kamerani shu sahifa ustida ochadi (ega qarori 2026-10-19: oqim ichidagi «Kamera bilan skanerlash» / «Kamera» tugmasi yo'q); skan USB bilan bitta handler, kamera har skandan keyin yopilmaydi. Skan = darhol qabul; «Qabul qilindi N · Qoldi M · Topilmadi K», boshqa marketning buyurtmasi rad etiladi, kamera ichida market almashtirish. |
| `admin-neworders-market-confirm-dialog` | Qabul tasdig'i / buyurtmani o'chirish | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | v2 |
| `admin-neworders-incoming-sources` | Kiruvchi posilkalar — manba tanlash | sahifa | `/new-orders/incoming` | `src/pages/incoming-orders/SourcePicker.tsx` | v2 |
| `admin-neworders-incoming-scan` | Kiruvchi posilkalarni skanerlash | sahifa | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | qisman — Kodda qop yorlig'i bor («Qop» ustuni, telefon kartasida «Qop …», xulosa «N ta · M ta qop»), skanni olib tashlash va «Qaytarish» — v2; «2/3» belgisi va «N ta qop chala keldi» bloki — backend kerak (har qop uchun received_count, BD2-7 → IP-2). «Kamera» / «Kamera bilan skanerlash» tugmalari chizilmaydi (ega qarori 2026-10-19 — markaziy «Skaner»). |
| `admin-neworders-incoming-scan-camera` | Kiruvchi posilkalarni skanerlash — kamera | oyna | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | qisman — Kamera v2 — markaziy «Skaner» (planshet/desktopda «Skanerlash») kamerani shu sahifa ustida ochadi (ega qarori 2026-10-19: oqim ichidagi «Kamera bilan skanerlash» / «Kamera» tugmasi yo'q); skan USB bilan bitta handler, kamera har skandan keyin yopilmaydi. Skan faqat belgilaydi, qabul — sahifadagi «Qabul qilish»; kamera ichida manba almashtirish, «Qopda yetishmaydi». |
| `admin-neworders-incoming-scan-partial` | Kiruvchi posilkalar — chala qop ogohlantirishi | sahifa | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | v2 |
| `admin-neworders-incoming-scan-partial-confirm-dialog` | Kiruvchi posilkalar — chala qop bilan qabul tasdig'i | oyna | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | v2 |
| `admin-neworders-incoming-scan-undo` | Kiruvchi posilkalar — skan olib tashlandi | sahifa | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | qisman — Kodda bor (IP-1): qatordagi Undo2 «Olib tashlash», skan xabarida «Olib tashlash» (qop skanida faqat shu skan belgilaganlar), 5 soniyalik «Qaytarish» xabari. Farq: xabar umumiy notify bilan — maketdagi Undo2 ikonka va ikkinchi darajali «Qaytarish» tugmasi o'rniga info ikonka va havola-tugma (Toaster'ni kengaytirish — umumiy qatlam, ega roziligi kerak). |
| `admin-neworders-branches` | Filial batchlari tabi | sahifa | `/new-orders/branches` | `src/pages/new_orders/branches/index.tsx` | v2 |
| `admin-neworders-branch-batches` | Filial batchlari ro'yxati | sahifa | `/new-orders/branches/:branchId` | `src/pages/new_orders/branches/batches.tsx` | v2 |
| `admin-neworders-branch-batch-detail` | Filial paketi tafsiloti | sahifa | `/new-orders/branches/:branchId/batches/:batchId` | `src/pages/new_orders/branches/batchDetail.tsx` | v2 |
| `admin-neworders-branch-batch-detail-camera` | Filial paketi tafsiloti — kamera | oyna | `/new-orders/branches/:branchId/batches/:batchId` | `src/pages/new_orders/branches/batchDetail.tsx` | qisman — Kamera v2 — markaziy «Skaner» (planshet/desktopda «Skanerlash») kamerani shu sahifa ustida ochadi (ega qarori 2026-10-19: oqim ichidagi «Kamera bilan skanerlash» / «Kamera» tugmasi yo'q); skan USB bilan bitta handler, kamera har skandan keyin yopilmaydi. Skan tanlaydi, «N / jami ta tanlandi», «Hammasi tanlandi»; qabul — sahifadagi tugma. |
| `admin-neworders-cancelled` | Bekor qilinganlar tabi | sahifa | `/new-orders/cancelled` | `src/pages/new_orders/cancelled/index.tsx` | v2 |
| `admin-neworders-cancelled-detail` | Bekor qilinganlarni marketga topshirish | sahifa | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | v2 |
| `admin-neworders-cancelled-detail-camera` | Bekor qilinganlarni marketga topshirish — kamera | oyna | `/new-orders/cancelled/:marketId` | `src/shared/ui/camera/ScannerCamera.tsx` | qisman — Kamera v2 — markaziy «Skaner» (planshet/desktopda «Skanerlash») kamerani shu sahifa ustida ochadi (ega qarori 2026-10-19: oqim ichidagi «Kamera bilan skanerlash» / «Kamera» tugmasi yo'q); skan USB bilan bitta handler, kamera har skandan keyin yopilmaydi. Avval market QR, so'ng buyurtmalar («Buyurtmalarni tanlang · QR 04:12 amal qiladi»), ro'yxatda «Bekor qilish», «Tugatish». |
| `admin-neworders-cancelled-manual-dialog` | QR buzilganini tasdiqlash | oyna | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/ui/ManualConfirmDialog.tsx` | v2 |
| `admin-neworders-cancelled-scanner-dialog` | Market QR skaneri | oyna | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | qisman — Kamera v2 — markaziy «Skaner» (planshet/desktopda «Skanerlash») kamerani shu sahifa ustida ochadi (ega qarori 2026-10-19: oqim ichidagi «Kamera bilan skanerlash» / «Kamera» tugmasi yo'q); skan USB bilan bitta handler, kamera har skandan keyin yopilmaydi. Sarlavhadagi «Market QR skanerlash» tugmasi olib tashlangan (bitta ekranda ikkinchi skan tugmasi yo'q — tizim-scanner §09); market QR'dan keyin kamera yopilmaydi — buyurtmalarni tanlashga o'tadi. |
| `admin-neworders-create-manual` | Buyurtma yaratish — Qo'lda | sahifa | `/new-orders/create` | `src/pages/orders/create/index.tsx` | v2 |
| `admin-neworders-create-manual-step2-existing-customer` | Buyurtma yaratish — 2-qadam: mavjud mijoz, tarif, rasm (taklif) | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/ExistingCustomerNotice.tsx` | qisman — CS-A (hiqRNhkI): «Mavjud mijoz» bloki (kartadan to'ldirildi · N ta buyurtma, oxirgisi …, «Bekor qilish»), viloyat district/:id dan, o'zgarmagan mijoz — customer_id; «Bu mijozda yangi buyurtma bor» + «№id ni yangi oynada ochish». CS-B (IT1YpboR, zRqDRLAZ): yetkazish turi kartalarida market standart narxi («25 000 so'm · standart»; «Narx yo'q» + «standart narx belgilanmagan» ogohlantirishi; sukut tur — default_tariff, qo'lda tanlangani ustidan yozilmaydi; faqat superadmin, admin, market — menejer/registratorga backend tarif bermaydi, N3), mahsulot rasmi 40 px (ProductThumb, entities/product), narx matni («2 × 45 000 so'm», «Narxi kiritilmagan», «Katalogdan tashqari · narxsiz»), «Umumiy summa» avto-taklifi («Mahsulotlar narxidan hisoblandi», qo'lda yozilgach «Mahsulotlar bo'yicha: … · Qo'llash»), xulosada VAQTINCHALIK «Yetkazish narxi» — standart narx (ega tasdig'i kutilmoqda; tanlangan tur narxsiz bo'lsa qator yo'q). Kodda yo'q: taxminiy «≈ …», vazn/hajm izohlari va «og'ir yoki katta posilkada oshadi» (CS-E, DAqXPeSy), «O'zgartirsangiz … «Mijoz kartasi ham yangilansinmi?»» (CS-D, BD2-4). |
| `admin-neworders-create-manual-step2-customer-suggest` | Buyurtma yaratish — 2-qadam: mijoz takliflari (taklif) | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/CustomerPhoneSuggest.tsx` | qisman — CS-A (hiqRNhkI): telefon bo'yicha taklif v2 — 7 raqamdan keyin 300 ms, desktopda ro'yxat, telefonda pastki varaqa (faqat natija bo'lsa), qatorda ism · telefon · tuman, «N ta buyurtma», «N ta yangi», «qidirilmoqda» / «topilmadi». «Qo'shimcha raqam: …» — faqat backend matched_by = extra_number bo'lsa (9444UAa8). Kodda yo'q (backend kartasidan keyin, CS-D): «Bu marketda hali buyurtmasi yo'q» + boshqa market mijozlari (BD2-2); shu sabab «Barcha mijozlar» sarlavhasi faqat superadmin/admin da, menejer/registrator — «<market> mijozlari», market — «Sizning mijozlaringiz». |
| `admin-neworders-create-manual-step2-customer-update-dialog` | Buyurtma yaratish — 2-qadam: mijoz kartasini yangilash (taklif) | oyna | `/new-orders/create` | `src/pages/orders/create/index.tsx` | yangi (kodda yo'q) — Taklif (create-step2, ega S1..S5) — kodda yo'q: taxminiy narx, mijoz kartasini yangilash tasdig'i; backend narx dvigateli (DAqXPeSy) kerak. |
| `admin-neworders-create-market-picker` | Market tanlash oynasi | oyna | `/new-orders/create` | `src/pages/orders/create/ui/MarketPicker.tsx` | v2 |
| `admin-neworders-create-ai` | Buyurtma yaratish — AI bilan | sahifa | `/new-orders/create` | `src/pages/orders/create/index.tsx` | v2 |
| `admin-neworders-create-ai-confirm-dialog` | AI yaratishni tasdiqlash | oyna | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | v2 |
| `admin-mails-today` | Pochta — Bugungi pochtalar | sahifa | `/mails/today` | `src/pages/mails/components/todaysMails.tsx` | v2 |
| `admin-mails-return` | Pochta — Qaytarish | sahifa | `/mails/return` | `src/pages/mails/components/returnMails.tsx` | v2 |
| `admin-mails-refused` | Pochta — Rad etilgan | sahifa | `/mails/refused` | `src/pages/mails/components/refusedMails.tsx` | v2 |
| `admin-mails-old` | Pochta — Eski pochtalar | sahifa | `/mails/old` | `src/pages/mails/components/oldMails.tsx` | v2 |
| `admin-mails-old-all-batches` | Eski pochtalar — Hamma batchlar | sahifa | `/mails/old` | `src/pages/mails/components/oldMails.tsx` | v2 |
| `admin-mails-detail` | Pochta tafsiloti | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | v2 |
| `admin-mails-detail-duplicates` | Pochta tafsiloti — takroriy telefonlar | sahifa | `/mails/:id` | `src/pages/mails/detail/ui/DuplicatePhonesAlert.tsx`, `src/pages/mails/detail/ui/OrdersTable.tsx` | v2 |
| `admin-mails-detail-search` | Pochta tafsiloti — qidiruv | sahifa | `/mails/:id` | `src/pages/mails/detail/ui/OrdersTable.tsx` | v2 |
| `admin-mails-detail-search-empty` | Pochta tafsiloti — qidiruvda natija yo'q | sahifa | `/mails/:id` | `src/pages/mails/detail/ui/OrdersTable.tsx` | v2 |
| `admin-mails-detail-camera` | Pochta tafsiloti — kamera | oyna | `/mails/:id` | `src/pages/mails/detail/index.tsx` | qisman — Kamera v2 — markaziy «Skaner» (planshet/desktopda «Skanerlash») kamerani shu sahifa ustida ochadi (ega qarori 2026-10-19: oqim ichidagi «Kamera bilan skanerlash» / «Kamera» tugmasi yo'q); skan USB bilan bitta handler, kamera har skandan keyin yopilmaydi. Skan tanlaydi (jo'natish / qabul / rad etilganni qabul); pochtada yo'q kod — «Bu pochtada yo'q · rad etildi». Eski pochta va kuryerning rad etilgan pochtasida maqsad yo'q. |
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
| `admin-payments-main-cashbox-shift-closed` | Asosiy kassa — smena yopiq | sahifa | `/payments/main-cashbox` | `src/pages/payments/components/mainCashbox.tsx` | qisman — Kodda bor (CB-1): «Smena boshlanmagan» banneri, «Tezkor amallar» qulfi («Smena ochilgach ishlaydi»), «Smenani ochish» asosiy tugma (GET finance/shift/current). Oxirgi yopilgan smena kartasi «Smena yopildi · … · Natija» chizilmagan — Taklif · backend kerak (`last_closed`, BD2-8 → CB-3). |
| `admin-payments-main-cashbox-shift-open-dialog` | Smenani ochish | oyna | `/payments/main-cashbox` | `src/pages/payments/components/OpenShiftDialog.tsx` | qisman — Kodda bor (CB-1, OpenShiftDialog): ochadigan xodim, «Boshlanish: hozir», ochilish qoldig'i (jonli balans), izoh. «Oxirgi smena … bilan yopilgan» ogohlantirishi chizilmagan — Taklif · backend kerak (`last_closed`, BD2-8 → CB-3). |
| `admin-payments-main-cashbox-shift-result-dialog` | Smena yopildi — natija | oyna | `/payments/main-cashbox` | `src/pages/payments/components/ShiftResultDialog.tsx` | v2 |
| `admin-payments-cash-detail-market` | Market kassasi | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | v2 |
| `admin-payments-cash-detail-courier` | Kuryer kassasi | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | v2 |
| `admin-payments-cash-detail-branch` | Filial kassasi (HQ qabul) | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | v2 |
| `admin-payments-cash-detail-branch-shift-closed` | Filial kassasi — filial smenasi ochilmagan · taklif (backend kerak) | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | yangi (kodda yo'q) — Taklif (cashbox-shift, ega S1..S5) — kodda yo'q: smena ochilmaguncha kirim/chiqim qulf (hamma kassada, FINANCE_REQUIRE_OPEN_SHIFT=all), ochish / natija oynalari. |
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
| `admin-products-create-errors` | Mahsulot yaratish — xatolar | sahifa | `/products/create-product/:id` | `src/pages/products/create/index.tsx` | qisman — Kodda bor (MH-1): forma tepasida «Saqlab bo'lmadi · N ta maydonda xato» (tahrirlash oynasida ham), «Mahsulot nomi» va «Narx» xatolari. Og'irlik va o'lcham maydonlari xatolari — backend kerak (9fHyFp3y → MH-2). |
| `admin-users-list` | Foydalanuvchilar ro'yxati | sahifa | `/all-users` | `src/pages/users/list/UserListPage.tsx` | v2 |
| `admin-users-list-telegram` | Foydalanuvchilar ro'yxati — Telegram ustuni | sahifa | `/all-users` | `src/widgets/user-list/ui/UserListTable.tsx` | v2 |
| `admin-users-delete-dialog` | Foydalanuvchini o'chirish | oyna | `/all-users` | `src/widgets/user-list/ui/UserListTable.tsx` | v2 |
| `admin-users-create` | Yangi foydalanuvchi | sahifa | `/all-users/create-user` | `src/pages/users/create/CreateUserPage.tsx` | v2 |
| `admin-users-detail` | Foydalanuvchi tafsiloti | sahifa | `/all-users/:id` | `src/pages/users/detail/UserDetailPage.tsx` | qisman — Kodda bor (CS-C): market «Tarif» kartasida «Asosiy tarif», «Uyga standart narx», «Markazga standart narx» (kuryer va menejerda «Uyga / Markazga tarif» qoladi). Yo'q: «Vazn va hajm bo'yicha narx» kaliti va «Masalan: standart … + vazn uchun …» izohi (Taklif · backend kerak) — market maydoni va narx dvigateli DAqXPeSy (ega S1) kelgach CS-E. |
| `admin-users-detail-telegram` | Foydalanuvchi tafsiloti — Telegram guruhi | sahifa | `/all-users/:id` | `src/widgets/user-detail/ui/MarketTelegramGroupsCard.tsx` | qisman — CS-C: kodda market yorlig'i «Uyga standart narx» / «Markazga standart narx» (maket `superadmin-users-detail` / `-users-edit-dialog`, ega S1, sinxron f86a2e73 2026-10-19); bu maketda tafsilot sahifasidagi market «Tarif» kartasida hali «Uyga tarif» / «Markazga tarif» (o'sha f86a2e73) — bir xil maydon uchun maketlar ziddiyati, ega savoli. Qolgani — avvalgidek v2. NG-C (G085w5Qr): «Telegram guruhi» kartasida nofaol turda «Nofaol» (ton sababga qarab) + /notifications dagi sabab matni va «Nofaol bo'lgan: {sana}» — maket yo'q, eng yaqini superadmin-notifications-telegram-groups; faollashtirish — «Barcha guruhlar «Bildirishnomalar» bo'limida» havolasi orqali (ega savoli TG-B 2 ochiq). |
| `admin-users-detail-telegram-group-dialog` | Telegram guruhini ulash (havola, QR) | oyna | `/all-users/:id` | `src/features/telegram-link/ui/MarketGroupLinkDialog.tsx` | v2 |
| `admin-users-detail-telegram-group-expired-dialog` | Telegram guruhini ulash — havola muddati tugadi | oyna | `/all-users/:id` | `src/features/telegram-link/ui/MarketGroupLinkDialog.tsx` | v2 |
| `admin-users-edit-dialog` | Foydalanuvchini tahrirlash | oyna | `/all-users/:id` | `src/features/user/update-user/ui/UpdateUserModal.tsx` | qisman — Kodda bor (CS-C): «Market ma'lumotlari»da «Asosiy tarif *», «Uyga standart narx *», «Markazga standart narx *» (bo'sh bo'lsa «Uyga/Markazga standart narxni kiriting»); kuryer va menejer maydonlari «Uyga / Markazga tarif». Yo'q: «Vazn va hajm bo'yicha narx» kaliti — backend market maydoni yo'q (DAqXPeSy, ega S1), CS-E. |
| `admin-users-transfer-courier-dialog` | Kuryerni boshqa filialga o'tkazish | oyna | `/all-users/:id` | `src/features/courier-transfer-branch/ui/TransferCourierModal.tsx` | v2 |
| `admin-regions-map` | Hududlar xaritasi | sahifa | `/regions` | `src/pages/region/index.tsx` | v2 |
| `admin-regions-region-detail-dialog` | Viloyat ma'lumotlari oynasi | oyna | `/regions` | `src/widgets/region-detail/ui/RegionDetailDialog.tsx` | v2 |
| `admin-regions-districts` | Tumanlar boshqaruvi | sahifa | `/regions/districts` | `src/pages/region/pages/districts/index.tsx` | v2 |
| `admin-regions-districts-delete-blocked` | Tumanni o'chirib bo'lmaydi | oyna | `/regions/districts` | `src/pages/region/ui/DistrictDeleteBlockedDialog.tsx` | v2 |
| `admin-regions-districts-merge-dialog` | Tumanni birlashtirish | oyna | `/regions/districts` | `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | v2 |
| `admin-regions-districts-merge-target` | Tumanni birlashtirish — maqsad tumanni tanlash | oyna | `/regions/districts` | `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | v2 |
| `admin-regions-districts-merge-progress` | Tumanni birlashtirish — jarayonda | oyna | `/regions/districts` | `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | v2 |
| `admin-regions-districts-merge-result` | Tumanni birlashtirish — natija | oyna | `/regions/districts` | `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | qisman — Kodda bor (DM-1, DM-2, v2): «Tumanlar birlashtirildi», «Ko'chirildi» — moved_live (faqat tirik, vsmpTweI; eski javobda moved), nol qatorlar chizilmaydi; «{maqsad}da endi» — target_after tirik sonlari va «oldin» (target_before), «O'chirilgan yozuvlar sanalmaydi.». Farq: «Faoliyat jurnaliga «Tuman birlashtirildi» yozuvi qo'shildi» jumlasi yo'q (jurnal yorliqlari va oynalardagi jurnal havolasi — ILq3WNL1, DM-3). |
| `admin-regions-districts-merge-error` | Tumanni birlashtirish — bekor qilindi | oyna | `/regions/districts` | `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | qisman — Kodda bor (DM-2, v2): 409/503 javobidagi data.reason + data.details (tf324cXN) dan — «Birlashtirib bo'lmadi» (count_mismatch, 409 dagi remote_refused, invalid_response, delete_failed), tuman juftligi, «Sabab» qatori (masalan «Sonlar mos kelmadi — Izboskan tumanida buyurtmalar 1 255 ta, kutilgan 1 254 ta.»; noma'lum kodda qator yo'q), izoh, «Xabarni nusxalash» (sarlavha, juftlik ID bilan, sabab, kod, trace_id, vaqt) va «Qayta urinish» (o'sha juftlik bilan yangi so'rov). Server matni va HTTP kodi ko'rsatilmaydi; details.manual_fix yo'q javob (400/403/404) — oyna emas, umumiy xabar. Z1c1sNPT: «Bo'z tumaniga qaytarildi» — details.rolled_back_orders/users/branches (nol qatorlar chizilmaydi, hammasi 0 — blok yo'q), «Xabarni nusxalash» da ham. |
| `admin-regions-districts-merge-error-unavailable` | Tumanni birlashtirish — servis javob bermadi | oyna | `/regions/districts` | `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | qisman — Kodda bor (DM-2, v2): «Servis javob bermadi» — reason timeout yoki 503 dagi remote_refused / sababsiz 503; «Sabab» — «Foydalanuvchilar ko'chirilmadi — servis 15 soniya ichida javob bermadi.» (details.kind, details.timeout_ms), izoh, «Xabarni nusxalash», «Qayta urinish». Z1c1sNPT: «Bo'z tumaniga qaytarildi» — details.rolled_back_orders/users/branches (nol qatorlar chizilmaydi, hammasi 0 — blok yo'q), «Xabarni nusxalash» da ham. |
| `admin-regions-districts-merge-error-manual` | Tumanni birlashtirish — qo'lda tuzatish kerak | oyna | `/regions/districts` | `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | qisman — Kodda bor (DM-2, v2): details.manual_fix = true — «Birlashtirish chala qoldi», «Qo'lda tuzatish kerak» ogohlantirishi (role=alert), «Sabab», «Bo'z tumaniga qaytmadi» — details.stranded (tur · N ta / «ID'lar noma'lum»; «<tuman>da qoldi» / «Joyi aniqlanmadi — jurnalda tekshiring»), jurnal izohi, «Xabarni nusxalash» va «Faoliyat jurnalini ochish» (/activity-logs); «Qayta urinish» yo'q. Z1c1sNPT: «Buyurtmalar» qatorida qolgan raqamlar — details.stranded_order_ids (≤10 ta, «… va yana N ta»), nusxada ham; to'liq ro'yxat — activity log. |
| `admin-regions-districts-merge-unknown` | Tumanni birlashtirish — natija noma'lum | oyna | `/regions/districts` | `src/pages/region/ui/DistrictMergeDialog.tsx`, `src/pages/region/ui/useDistrictMerge.ts`, `src/pages/region/model/districtMerge.ts` | qisman — Kodda bor (DM-1, v2): timeout / javobsiz / 500 / 502 / 504 / 524 → «Natija noma'lum», «Qayta urinish» yo'q, «Faoliyat jurnalini ochish» (/activity-logs) va «Tumanlarni yangilash». Farq: qadamlar matnida jurnal yozuvi nomlari («Tuman birlashtirildi» / «… chala qoldi») yo'q — backend ularni hali yozmaydi (ILq3WNL1, DM-3); o'rniga «shu tuman yozuvlarini ko'ring». |
| `admin-regions-sato-management` | Tumanlarni o'tkazish | sahifa | `/regions/sato-management` | `src/pages/region/pages/sato-management/index.tsx` | v2 |
| `admin-regions-sato-codes` | SATO kodlari | sahifa | `/regions/sato-management` | `src/pages/region/ui/sato/SatoCodesPanel.tsx`, `src/pages/region/ui/sato/SatoCodesTable.tsx`, `src/pages/region/model/satoModel.ts` | v2 |
| `admin-regions-sato-codes-edit` | SATO kodlari — kodni tahrirlash («kod band») | sahifa | `/regions/sato-management` | `src/pages/region/ui/sato/SatoCodeEditor.tsx`, `src/pages/region/ui/sato/useSatoCodeEditor.ts` | v2 |
| `admin-regions-logist-assignment` | Logist biriktirish | sahifa | `/regions/logist-assignment` | `src/pages/region/pages/logist-assignment/index.tsx` | v2 |
| `admin-integrations-partners` | Integratsiyalar — Hamkorlar | sahifa | `/integrations/connections` | `src/pages/integrations/ConnectionsPage.tsx` | v2 |
| `admin-integrations-external` | Integratsiyalar — Tashqi tizimlar | sahifa | `/integrations/connections` | `src/pages/integrations/ConnectionsPage.tsx` | v2 |
| `admin-integrations-marketplace` | Integratsiyalar — Marketplace | sahifa | `/integrations/connections` | `src/pages/integrations/ConnectionsPage.tsx` | v2 |
| `admin-integrations-conn-settings` | Ulanish — Sozlamalar | sahifa | `/integrations/connections` | `src/pages/integrations/panels/ConnectionSettings.tsx` | v2 |
| `admin-integrations-conn-shipments` | Ulanish — Posilkalar | sahifa | `/integrations/connections` | `src/pages/integrations/panels/ConnectionShipments.tsx` | v2 |
| `admin-integrations-conn-log` | Ulanish — Hodisalar | sahifa | `/integrations/connections` | `src/pages/integrations/panels/ConnectionLog.tsx` | qisman — Maketga qo'shimcha (Dj70iDbD): superadmin bilan bir xil — «Hamkor» filtri va «Webhook ma'lumoti». Ega tasdig'i kutilmoqda. |
| `admin-integrations-conn-settlement` | Ulanish — Hisob-kitob | sahifa | `/integrations/connections` | `src/pages/integrations/panels/ConnectionSettlement.tsx`, `src/pages/integrations/panels/settlement/RemittancesSection.tsx` | qisman — Ism kutadi (BD2-10, IS-4): «Kim kiritdi / bekor qildi» ismi — Taklif · backend kerak (javobda faqat created_by / cancelled_by id), bekor qilingan eski yozuvda operatorning kassa tanlovi saqlanmaydi → «Kassa: eski yozuv». Qolgani v2 (IS-1: «To'lov asosiy kassaga o'zi yoziladi» + Asosiy kassa havolasi, «Qoldiq» — to'lanishi kerak, yopilmagan qarz, hamkor avansi, formula, «Qarz yo'q»; IS-2: «To'lov» ustuni / telefonda «… · To'lov №N · …», ortiqcha summa ogohlantirishi va «To'lov yozildi» natija oynasi; IS-3: «Olingan to'lovlar» — sana oralig'i, «Faol · Bekor qilingan · Barchasi», jadval / telefonda kartalar, «Holat · kassa», bekor qilish oynasi; «To'lov №N» — shu bo'limga o'tish). |
| `admin-integrations-settlement-pay-dialog` | Tashuvchidan olingan to'lov | oyna | `/integrations/connections` | `src/pages/integrations/panels/ConnectionSettlement.tsx` | v2 |
| `admin-integrations-settlement-pay-overpay-dialog` | To'lov — ortiqcha summa | oyna | `/integrations/connections` | `src/pages/integrations/panels/ConnectionSettlement.tsx` | v2 |
| `admin-integrations-settlement-pay-result-dialog` | To'lov natijasi | oyna | `/integrations/connections` | `src/pages/integrations/panels/settlement/PayResultDialog.tsx` | qisman — Kodda bor (IS-2, v2). Farq (ega savoli 1 ochiq): raqamlar backend bo'linmasi bo'yicha — «Avansga o'tdi» = shu to'lovning qarzga sig'magan ortig'i (unapplied_amount), «Hamkor avansi endi» = jami avans (advance_balance); maketdagi «490 000 so'm avansga o'tdi» + «Avvalgi avansdan ishlatildi 350 000» o'rniga «140 000 so'm avansga o'tdi» + «Hamkor avansi endi 490 000». Avvalgi avans ortiqchani qoplasa (to'lanishi kerak < summa < yopilmagan qarz) backend unapplied 0 qaytaradi — «avansga o'tdi» qatori yo'q, faqat «Avvalgi avansdan ishlatildi» va «Hamkor avansi endi». Maketsiz matnlar: qarz yozuviga sig'magan qoldiq izohi, birorta qarz yopilmagan holda «Kassaga yozilmadi» izohi. |
| `admin-integrations-settlement-cancel-dialog` | To'lovni bekor qilish | oyna | `/integrations/connections` | `src/pages/integrations/panels/settlement/CancelRemittanceDialog.tsx` | v2 |
| `admin-integrations-conn-control` | Ulanish — Ish rejimi | sahifa | `/integrations/connections` | `src/pages/integrations/panels/ConnectionControl.tsx` | v2 |
| `admin-integrations-conn-security` | Ulanish — Xavfsizlik | sahifa | `/integrations/connections` | `src/pages/integrations/panels/ConnectionSecurity.tsx` | v2 |
| `admin-integrations-new-partner-dialog` | Yangi hamkor oynasi | oyna | `/integrations/connections` | `src/pages/integrations/NewPartnerModal.tsx` | v2 |
| `admin-integrations-catalog` | Yangi ulanish — katalog | sahifa | `/integrations/new` | `src/pages/integrations/CatalogPage.tsx` | v2 |
| `admin-integrations-wizard` | Ulash ustasi | sahifa | `/integrations/new/:typeKey` | `src/pages/integrations/wizard/ConnectWizard.tsx` | v2 |
| `admin-integrations-legacy-partners` | Partner API hamkorlari (eski) | sahifa | `/integrations/connections` | `src/pages/integrations/ConnectionsPage.tsx` | qisman — Sahifa olindi (Dj70iDbD): superadmin bilan bir xil. Maket taqdiri ega bilan kelishilishi kerak. |
| `admin-integrations-legacy-sources` | Integratsiyalar manbalari (eski) | sahifa | `/integrations/sources` | `src/pages/new_orders/external_orders/index.tsx` | v2 |
| `admin-activity-logs-list` | Faoliyat jurnali | sahifa | `/activity-logs` | `src/pages/activity-logs/index.tsx` | v2 |
| `admin-activity-logs-row-expanded` | Jurnal yozuvi ochilgan | sahifa | `/activity-logs` | `src/widgets/activity-log/ui/ActivityLogDetail.tsx` | v2 |
| `admin-notifications-send` | Xabar yuborish | sahifa | `/notifications/send` | `src/pages/notification-send/index.tsx` | v2 |
| `admin-notifications-send-confirm-dialog` | Xabarni yuborishni tasdiqlang | oyna | `/notifications/send` | `src/pages/notification-send/index.tsx` | v2 |
| `admin-notifications-send-result` | Xabar yuborish — natija | sahifa | `/notifications/send` | `src/features/notification-dispatch/ui/DispatchResultCard.tsx` | v2 |
| `admin-notifications-send-unknown` | Xabar yuborish — natija noma'lum | sahifa | `/notifications/send` | `src/features/notification-dispatch/ui/DispatchUnknownCard.tsx` | v2 |
| `admin-notifications-sent` | Yuborilganlar | sahifa | `/notifications/sent` | `src/pages/notification-sent/index.tsx` | v2 |
| `admin-notifications-sent-detail-dialog` | Yuborilgan xabar tafsiloti | oyna | `/notifications/send`, `/notifications/sent` | `src/entities/notification-dispatch/ui/SentDetailDialog.tsx` | v2 |
| `admin-notifications-sent-detail-states` | Yuborilgan xabar tafsiloti — boshqa holatlar | sahifa | `/notifications/sent` | `src/entities/notification-dispatch/ui/SentDetailDialog.tsx` | v2 |
| `admin-notifications-sent-loading` | Yuborilganlar — yuklanmoqda | sahifa | `/notifications/sent` | `src/pages/notification-sent/index.tsx` | v2 |
| `admin-notifications-sent-empty` | Yuborilganlar — bo'sh | sahifa | `/notifications/sent` | `src/pages/notification-sent/index.tsx` | v2 |
| `admin-notifications-sent-error` | Yuborilganlar — xato | sahifa | `/notifications/sent` | `src/pages/notification-sent/index.tsx` | v2 |
| `admin-scan-camera` | Skaner — kamera (umumiy) | sahifa | `/scan` | `src/pages/scan/index.tsx` | v2 |
| `admin-scan-result` | Skanerlangan buyurtma | sahifa | `/scan/:token` | `src/pages/scan/detail.tsx` | v2 |
| `admin-notifications-telegram-groups` | Bildirishnomalar — Telegram guruhlari | sahifa | `/notifications` | `src/pages/notifications/ui/NotificationsPage.tsx` | qisman — Kodda bor (NG-A, NG-C, v2). Nofaollik sababi (inactive_reason, G085w5Qr) maketdagidek: bot chiqarilgan / guruh topilmadi — qizil «Nofaol» + «Bot guruhdan chiqarilgan — …» / «Guruh topilmadi — …», qo'lda — neytral «Qo'lda nofaol qilingan»; faollashtirish ogohlantirishi bot chiqarilganda «Bot guruhdan chiqarilgan». Maketdan farq: blocked_on_send matni maketda yo'q («Bot guruhga xabar yubora olmadi — …», qizil); sabab null yoki noma'lum — neytral umumiy izoh «Xabarlar bu guruhga yuborilmayapti» va ogohlantirish «Bot guruhda ekanini tekshiring» (D1); inactive_at bo'lsa izoh ostida «Nofaol bo'lgan: {sana}» (maketda yo'q). |
| `admin-notifications-create-dialog` | Bildirishnoma qo'shish (modal) | oyna | `/notifications` | `src/features/notification-create/ui/NotificationFormModal.tsx` | v2 |
| `admin-notifications-delete-dialog` | Bildirishnomani o'chirish (tasdiq) | oyna | `/notifications` | `src/features/notification-delete/ui/useDeleteNotificationConfirm.tsx` | v2 |
| `admin-notifications-row-menu` | Guruh amallari menyusi | oyna | `/notifications` | `src/pages/notifications/ui/NotificationRowMenu.tsx` | v2 |
| `admin-notifications-row-menu-inactive` | Guruh amallari menyusi — nofaol guruh | oyna | `/notifications` | `src/pages/notifications/ui/NotificationRowMenu.tsx` | qisman — Kodda bor (NG-A, NG-C, v2). Nofaollik sababi (inactive_reason, G085w5Qr) maketdagidek: bot chiqarilgan / guruh topilmadi — qizil «Nofaol» + «Bot guruhdan chiqarilgan — …» / «Guruh topilmadi — …», qo'lda — neytral «Qo'lda nofaol qilingan»; faollashtirish ogohlantirishi bot chiqarilganda «Bot guruhdan chiqarilgan». Maketdan farq: blocked_on_send matni maketda yo'q («Bot guruhga xabar yubora olmadi — …», qizil); sabab null yoki noma'lum — neytral umumiy izoh «Xabarlar bu guruhga yuborilmayapti» va ogohlantirish «Bot guruhda ekanini tekshiring» (D1); inactive_at bo'lsa izoh ostida «Nofaol bo'lgan: {sana}» (maketda yo'q). |
| `admin-notifications-connected` | Bildirishnomalar — guruh ulandi | sahifa | `/notifications` | `src/pages/notifications/ui/NotificationsPage.tsx` | v2 |
| `admin-notifications-empty` | Bildirishnomalar — bo'sh holat | sahifa | `/notifications` | `src/pages/notifications/ui/NotificationsPage.tsx` | v2 |
| `admin-notifications-loading` | Bildirishnomalar — yuklanish | sahifa | `/notifications` | `src/pages/notifications/ui/NotificationsPage.tsx` | v2 |
| `admin-notifications-error` | Bildirishnomalar — xato holati | sahifa | `/notifications` | `src/pages/notifications/ui/NotificationsPage.tsx` | v2 |
| `admin-notifications-create-link-dialog` | Bildirishnoma qo'shish — havola tayyor, kutilmoqda | oyna | `/notifications` | `src/features/notification-create/ui/NotificationFormModal.tsx`, `src/features/telegram-link/ui/LinkCountdown.tsx` | v2 |
| `admin-notifications-create-expired-dialog` | Bildirishnoma qo'shish — havola muddati tugadi | oyna | `/notifications` | `src/features/notification-create/ui/NotificationFormModal.tsx` | v2 |
| `admin-notifications-create-exists-dialog` | Bildirishnoma qo'shish — shu tur allaqachon ulangan | oyna | `/notifications` | `src/features/notification-create/ui/NotificationFormModal.tsx` | v2 |
| `admin-notifications-create-exists-inactive-dialog` | Bildirishnoma qo'shish — shu tur ulangan, lekin nofaol | oyna | `/notifications` | `src/features/notification-create/ui/NotificationFormModal.tsx` | qisman — Kodda bor (v2, NG-B): «Faollashtirish» — ochiq oyna ustida tasdiq (*-activate-dialog, PATCH {is_active: true}). NG-C (G085w5Qr): matn inactive_reason bo'yicha — kicked/left: maketdagi «… nofaol — bot guruhdan chiqarilgan (ID: …)»; chat_not_found, blocked_on_send, manual — o'z matni (maketda yo'q); null yoki noma'lum — umumiy «xabarlar unga yuborilmayapti» (D1). |
| `admin-notifications-deactivate-dialog` | Guruhni nofaol qilish (tasdiq) | oyna | `/notifications` | `src/features/notification-toggle/ui/useToggleNotificationConfirm.tsx` | v2 |
| `admin-notifications-activate-dialog` | Guruhni faollashtirish (tasdiq) | oyna | `/notifications` | `src/features/notification-toggle/ui/useToggleNotificationConfirm.tsx` | qisman — Kodda bor (NG-A, NG-C, v2). Nofaollik sababi (inactive_reason, G085w5Qr) maketdagidek: bot chiqarilgan / guruh topilmadi — qizil «Nofaol» + «Bot guruhdan chiqarilgan — …» / «Guruh topilmadi — …», qo'lda — neytral «Qo'lda nofaol qilingan»; faollashtirish ogohlantirishi bot chiqarilganda «Bot guruhdan chiqarilgan». Maketdan farq: blocked_on_send matni maketda yo'q («Bot guruhga xabar yubora olmadi — …», qizil); sabab null yoki noma'lum — neytral umumiy izoh «Xabarlar bu guruhga yuborilmayapti» va ogohlantirish «Bot guruhda ekanini tekshiring» (D1); inactive_at bo'lsa izoh ostida «Nofaol bo'lgan: {sana}» (maketda yo'q). |
| `admin-regions-logist-assignment-confirm-dialog` | Logist biriktirish — saqlashni tasdiqlash | oyna | `/regions/logist-assignment` | `src/pages/region/pages/logist-assignment/ui/ChangesList.tsx` | v2 |
| `admin-regions-logist-assignment-empty` | Logist biriktirish — logist yo'q | sahifa | `/regions/logist-assignment` | `src/pages/region/pages/logist-assignment/index.tsx` | v2 |
| `admin-users-create-logist` | Foydalanuvchi yaratish — Logist | sahifa | `/all-users/create-user` | `src/pages/users/create/CreateUserPage.tsx` | v2 |
| `admin-warehouse-list` | Omborlar | sahifa | `/warehouses` | `src/pages/warehouses/index.tsx` | v2 |
| `admin-warehouse-create-dialog` | Ombor ochish (popup) | oyna | `/warehouses` | `src/pages/warehouses/index.tsx` | v2 |
| `admin-warehouse-detail` | Ombor tafsiloti — qoldiq va harakatlar | sahifa | `/warehouses/:id` | `src/pages/warehouses/detail/index.tsx` | v2 |
| `admin-warehouse-stock-in-dialog` | Omborga mahsulot qo'shish — kirim (popup) | oyna | `/warehouses/:id` | `src/pages/warehouses/detail/index.tsx` | v2 |
| `admin-regions-delivery-tariffs` | Yetkazish tariflari — har kg narxi, qo'shimcha haq chegarasi, kalkulyator | sahifa | `/delivery-tariffs` | `src/pages/delivery-tariffs/index.tsx` | v2 |
| `admin-regions-delivery-tariff-edit-dialog` | Tarifni o'zgartirish (popup) | oyna | `/delivery-tariffs` | `src/pages/delivery-tariffs/index.tsx` | v2 |
| `admin-payments-history-detail-dialog-corrected` | To'lov tarixi tafsiloti · tahrirlangan to'lov (faqat ko'rish) | oyna | `/payments` | `src/pages/payments/index.tsx` | yangi (kodda yo'q) — T6 (Env2iYq1) pul qaytarish / summani tahrirlash — kodda yo'q: adminda blok va belgilar, amal yo'q (superadmin fragmenti). |
| `admin-users-list-responsibles-entry` | Foydalanuvchilar ro'yxati — «Market mas'ullari» tugmasi | sahifa | `/all-users` | `src/pages/users/list/UserListPage.tsx` | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F4 — admin ham (superadmin fragmenti). |
| `admin-users-market-responsibles` | Market mas'ullari | sahifa | `(taklif) /all-users/market-responsibles` | — | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F4 — admin ham (superadmin fragmenti). |
| `admin-users-market-responsibles-empty` | Market mas'ullari — sukut va umumiy raqam belgilanmagan (birinchi sozlash) | sahifa | `(taklif) /all-users/market-responsibles` | — | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F4 — admin ham. |
| `admin-users-market-responsibles-settings-confirm` | Market mas'ullari — sukut va umumiy raqamlarni saqlash (tasdiq) | oyna | `(taklif) /all-users/market-responsibles` | — | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F4 — admin ham. |
| `admin-users-market-responsibles-move-confirm` | Market mas'ullari — boshqa xodimga o'tkazish (tasdiq, X → Y) | oyna | `(taklif) /all-users/market-responsibles` | — | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F4 — admin ham. |
| `admin-users-market-responsibles-default-confirm` | Market mas'ullari — sukutga qaytarish (tasdiq) | oyna | `(taklif) /all-users/market-responsibles` | — | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F4 — admin ham. |
| `admin-users-detail-market-responsible` | Market tafsiloti — «Elchi mas'uli» kartasi | sahifa | `/all-users/:id` | `src/pages/users/detail/UserDetailPage.tsx` | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F4 — admin ham (superadmin fragmenti). |
| `admin-users-detail-market-responsible-dialog` | Market tafsiloti — mas'ulni o'zgartirish (oyna) | oyna | `/all-users/:id` | `src/pages/users/detail/UserDetailPage.tsx` | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F4 — admin ham. |
| `admin-users-delete-dialog-responsible` | Foydalanuvchini o'chirish — N ta market sukutga o'tadi | oyna | `/all-users` | `src/pages/users/list/UserListPage.tsx` | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F4 — admin ham. |
| `admin-payments-cashbox-form-dialog-receipt` | Kassadan xarajat — chek rasmi bilan | oyna | `/payments/main-cashbox` | `src/pages/payments/components/mainCashbox.tsx` | qisman — Kodda bor (QlLf33Ma): superadmin oynasi bilan bir xil, «Sozlamalar» havolasisiz. |
| `admin-payments-history-detail-dialog-receipt` | To'lov tarixi tafsiloti · «Chek» bo'limi | oyna | `/payments` | `src/pages/payments/index.tsx` | qisman — Kodda bor (QlLf33Ma): superadmin bilan bir xil («Qayta tahlil» bor). |
| `admin-payments-overview-receipts` | To'lovlar · «Chek» belgilari va «Chek holati» filtri | sahifa | `/payments` | `src/pages/payments/index.tsx` | qisman — Kodda bor (QlLf33Ma): superadmin bilan bir xil. |

### manager — Menejer

93 ta maket · kodda bor: 87 · kodda yo'q: 6

| Maket | Sarlavha | Tur | Route | Asosiy fayl | Holat |
|---|---|---|---|---|---|
| `manager-branch-dashboard-main` | Filial paneli | sahifa | `/branch-dashboard` | `src/pages/branch-dashboard/ui/BranchDashboardPage.tsx` | v2 |
| `manager-dispatch-scan` | Biriktirish — skan savati | sahifa | `/dispatch` | `src/pages/dispatch/index.tsx` | v2 |
| `manager-dispatch-courier-dialog` | Kuryer tanlash oynasi | oyna | `/dispatch` | `src/pages/dispatch/index.tsx` | v2 |
| `manager-dispatch-camera-dialog` | Biriktirish — kamera | oyna | `/dispatch` | `src/pages/dispatch/index.tsx` | qisman — Kamera v2 — markaziy «Skaner» (planshet/desktopda «Skanerlash») kamerani shu sahifa ustida ochadi (ega qarori 2026-10-19: oqim ichidagi «Kamera bilan skanerlash» / «Kamera» tugmasi yo'q); skan USB bilan bitta handler, kamera har skandan keyin yopilmaydi. «Biriktirish · <filial> · savatda N ta», savat qurilmada (ega D2, /scan/:token «Kuryerga biriktirish» ham shu savatga), rad etilgan QR ro'yxatda «Paket … · Rad etildi»; kuryer — sahifadagi tugma. |
| `manager-orders-list-all` | Buyurtmalar — Hamma buyurtmalar | sahifa | `/orders` | `src/pages/orders/index.tsx` | v2 |
| `manager-orders-list-all-refreshing` | Buyurtmalar — Hamma buyurtmalar, yangilanmoqda | sahifa | `/orders` | `src/pages/orders/index.tsx` | qisman — Kodda bor (OR-1): «Yangilanmoqda…» belgisi (400 ms dan keyin), «Yangilash» band, «Oxirgi yangilanish», «Avtomatik yangilanadi». Farq: holat tablari sonlari (va ularning xira holati) chizilmaydi — GET /orders har holat sonini bermaydi (OR-2, backend GaBIPi3Z). |
| `manager-orders-list-all-refresh-error` | Buyurtmalar — Hamma buyurtmalar, yangilanmadi | sahifa | `/orders` | `src/pages/orders/index.tsx` | qisman — Kodda bor (OR-1): «Ro'yxat yangilanmadi» + «Qayta urinish» + ×, eski qatorlar qoladi. Farq: izoh «Ro'yxat eskirgan bo'lishi mumkin.» (tab sonlarisiz) — holat tablari sonlari API'da yo'q (OR-2, backend GaBIPi3Z). |
| `manager-orders-list-pending` | Buyurtmalar — Kutilayotgan | sahifa | `/orders` | `src/pages/orders/index.tsx` | v2 |
| `manager-orders-list-cancelled` | Buyurtmalar — Bekor qilinganlar (HQ'ga yuborish) | sahifa | `/orders` | `src/pages/orders/index.tsx` | qisman — bosqich badge'i (Bekor · kuryerda / yo'lda / filialda / HQ'da — danger + ikonka; «Marketga topshirildi» — neutral, PackageCheck) va ostida joy qatori — vOczoOUE 2-bosqich: backend `cancel_return` (joy nomi hamma rolda, «N kun» — `received_at`), 3 kunda warning, 7 kunda + TriangleAlert, «Eskalatsiya» / «Marketga eslatildi» (BG7); tab ichidagi bosqich chiplari «Barchasi · Kuryerda · Yo'lda · Filialda · HQ'da · Topshirilgan» → `GET /orders?cancel_stage=` (BG4; «Barchasi» — tabning o'zi: bekor + bekor — jo'natilgan). Qisman: chiplardagi sonlar — backend bosqich bo'yicha son bermaydi (`status-counts`), sonsiz. |
| `manager-orders-sell-dialog` | Sotish oynasi | oyna | `/orders`, `/orders/edit/:orderId` | `src/pages/orders/list/courier/list/SellModal.tsx` | v2 |
| `manager-orders-cancel-dialog` | Bekor qilish oynasi | oyna | `/orders`, `/orders/edit/:orderId` | `src/pages/orders/list/courier/list/CancelModal.tsx` | v2 |
| `manager-orders-rollback-dialog` | Buyurtmani qaytarish tasdig'i | oyna | `/orders`, `/orders/edit/:orderId` | `src/pages/orders/list/courier/list/RollbackOrderDialog.tsx` | v2 |
| `manager-orders-detail` | Buyurtma tafsiloti | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | v2 |
| `manager-orders-detail-cancelled` | Buyurtma tafsiloti — bekor, HQ'da, «Qaytarish yo'li» (taklif) | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | yangi (kodda yo'q) — Menejer tafsiloti, bekor · HQ'da (taklif «Bekor holatlari» (ega 2026-10-19, Trello vOczoOUE; elchi-v2-specs/bekor-holatlari-taklif.md)): amallar yo'q, «Qaytarish yo'li» filial → HQ zanjiri bilan (6 qadam, oxirgisi kutilmoqda + «3 kun»). Boshqa filial nomi menejerga BG1 dan keyin. |
| `manager-orders-detail-edit-address-dialog` | Manzilni tahrirlash oynasi | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/editDialogs/EditAddressDialog.tsx` | v2 |
| `manager-orders-detail-edit-products-dialog` | Buyurtmani tahrirlash oynasi | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/editDialogs/EditOrderDialog.tsx` | v2 |
| `manager-courier-bulk-main` | Tezkor amal | sahifa | `/courier-bulk` | `src/pages/courier-bulk/index.tsx` | v2 |
| `manager-courier-bulk-camera-dialog` | Tezkor amal — kamera | oyna | `/courier-bulk` | `src/pages/courier-bulk/index.tsx` | qisman — Kamera v2 — markaziy «Skaner» (planshet/desktopda «Skanerlash») kamerani shu sahifa ustida ochadi (ega qarori 2026-10-19: oqim ichidagi «Kamera bilan skanerlash» / «Kamera» tugmasi yo'q); skan USB bilan bitta handler, kamera har skandan keyin yopilmaydi. Kamera ichida «Bekor / Ertaga» rejimi (sahifadagi bilan bitta), «N / M ta skanerlandi», ro'yxat; yakunlash — sahifadagi «Kunni yakunlash». |
| `manager-new-orders-markets` | Qabul va yaratish — Marketlar | sahifa | `/new-orders` | `src/pages/new_orders/markets/index.tsx` | v2 |
| `manager-new-orders-market-detail` | Market buyurtmalari — qabul | sahifa | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | v2 |
| `manager-new-orders-market-detail-camera` | Market buyurtmalari — qabul — kamera | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | qisman — Kamera v2 — markaziy «Skaner» (planshet/desktopda «Skanerlash») kamerani shu sahifa ustida ochadi (ega qarori 2026-10-19: oqim ichidagi «Kamera bilan skanerlash» / «Kamera» tugmasi yo'q); skan USB bilan bitta handler, kamera har skandan keyin yopilmaydi. Skan = darhol qabul; «Qabul qilindi N · Qoldi M · Topilmadi K», boshqa marketning buyurtmasi rad etiladi, kamera ichida market almashtirish. |
| `manager-new-orders-receive-confirm-dialog` | Qo'lda qabul qilish tasdig'i | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | v2 |
| `manager-new-orders-delete-confirm-dialog` | Buyurtmani o'chirish tasdig'i | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | v2 |
| `manager-new-orders-create-manual-step1` | Buyurtma yaratish — market tanlash | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/Step1Market.tsx` | v2 |
| `manager-new-orders-create-manual-step2` | Buyurtma yaratish — ma'lumotlar | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/Step2Combined.tsx` | v2 |
| `manager-new-orders-create-manual-step2-existing-customer` | Buyurtma yaratish — mavjud mijoz, tarif, rasm (taklif) | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/ExistingCustomerNotice.tsx` | qisman — CS-A (hiqRNhkI): «Mavjud mijoz» bloki (kartadan to'ldirildi · N ta buyurtma, oxirgisi …, «Bekor qilish»), viloyat district/:id dan, o'zgarmagan mijoz — customer_id; «Bu mijozda yangi buyurtma bor» + «№id ni yangi oynada ochish». CS-B (IT1YpboR, zRqDRLAZ): bu rolda yetkazish narxi CHIZILMAYDI — backend menejer/registratorga tarif bermaydi (N3): kartalarda tur ikonkasi, «Narx yo'q» ogohlantirishi va xulosadagi «Yetkazish narxi» qatori yo'q, sukut tur — «Markazgacha»; mahsulot rasmi 40 px (ProductThumb, entities/product), narx matni («2 × 45 000 so'm», «Narxi kiritilmagan», «Katalogdan tashqari · narxsiz»), «Umumiy summa» avto-taklifi («Mahsulotlar narxidan hisoblandi», qo'lda yozilgach «Mahsulotlar bo'yicha: … · Qo'llash»). Kodda yo'q (bu rolda): «Yetkazish narxi»; taxminiy «≈ …», vazn/hajm izohlari va «og'ir yoki katta posilkada oshadi» (CS-E, DAqXPeSy), «O'zgartirsangiz … «Mijoz kartasi ham yangilansinmi?»» (CS-D, BD2-4). |
| `manager-new-orders-create-manual-step2-customer-suggest` | Buyurtma yaratish — mijoz takliflari (taklif) | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/CustomerPhoneSuggest.tsx` | qisman — CS-A (hiqRNhkI): telefon bo'yicha taklif v2 — 7 raqamdan keyin 300 ms, desktopda ro'yxat, telefonda pastki varaqa (faqat natija bo'lsa), qatorda ism · telefon · tuman, «N ta buyurtma», «N ta yangi», «qidirilmoqda» / «topilmadi». «Qo'shimcha raqam: …» — faqat backend matched_by = extra_number bo'lsa (9444UAa8). Kodda yo'q (backend kartasidan keyin, CS-D): «Bu marketda hali buyurtmasi yo'q» + boshqa market mijozlari (BD2-2); shu sabab «Barcha mijozlar» sarlavhasi faqat superadmin/admin da, menejer/registrator — «<market> mijozlari», market — «Sizning mijozlaringiz». |
| `manager-new-orders-create-manual-step2-customer-update-dialog` | Buyurtma yaratish — 2-qadam: mijoz kartasini yangilash (taklif) | oyna | `/new-orders/create` | `src/pages/orders/create/index.tsx` | yangi (kodda yo'q) — Taklif (create-step2, ega S1..S5) — kodda yo'q: taxminiy narx, mijoz kartasini yangilash tasdig'i; backend narx dvigateli (DAqXPeSy) kerak. |
| `manager-new-orders-create-ai` | Buyurtma yaratish — AI bilan | sahifa | `/new-orders/create` | `src/pages/orders/create/index.tsx` | v2 |
| `manager-new-orders-create-ai-confirm-dialog` | AI buyurtmalarni tasdiqlash | oyna | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | v2 |
| `manager-new-orders-incoming-sources` | Kiruvchi posilkalar — manba tanlash | sahifa | `/new-orders/incoming` | `src/pages/incoming-orders/SourcePicker.tsx` | v2 |
| `manager-new-orders-incoming-scan` | Kiruvchi posilkalar — skanerlash | sahifa | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | qisman — Kodda qop yorlig'i bor («Qop» ustuni, telefon kartasida «Qop …», xulosa «N ta · M ta qop»), skanni olib tashlash va «Qaytarish» — v2; «2/3» belgisi va «N ta qop chala keldi» bloki — backend kerak (har qop uchun received_count, BD2-7 → IP-2). «Kamera» / «Kamera bilan skanerlash» tugmalari chizilmaydi (ega qarori 2026-10-19 — markaziy «Skaner»). |
| `manager-new-orders-incoming-scan-camera` | Kiruvchi posilkalar — skanerlash — kamera | oyna | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | qisman — Kamera v2 — markaziy «Skaner» (planshet/desktopda «Skanerlash») kamerani shu sahifa ustida ochadi (ega qarori 2026-10-19: oqim ichidagi «Kamera bilan skanerlash» / «Kamera» tugmasi yo'q); skan USB bilan bitta handler, kamera har skandan keyin yopilmaydi. Skan faqat belgilaydi, qabul — sahifadagi «Qabul qilish»; kamera ichida manba almashtirish, «Qopda yetishmaydi». |
| `manager-new-orders-incoming-scan-partial` | Kiruvchi posilkalar — chala qop ogohlantirishi | sahifa | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | v2 |
| `manager-new-orders-incoming-scan-partial-confirm-dialog` | Kiruvchi posilkalar — chala qop bilan qabul tasdig'i | oyna | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | v2 |
| `manager-new-orders-incoming-scan-undo` | Kiruvchi posilkalar — skan olib tashlandi | sahifa | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | qisman — Kodda bor (IP-1): qatordagi Undo2 «Olib tashlash», skan xabarida «Olib tashlash» (qop skanida faqat shu skan belgilaganlar), 5 soniyalik «Qaytarish» xabari. Farq: xabar umumiy notify bilan — maketdagi Undo2 ikonka va ikkinchi darajali «Qaytarish» tugmasi o'rniga info ikonka va havola-tugma (Toaster'ni kengaytirish — umumiy qatlam, ega roziligi kerak). |
| `manager-mails-today` | Pochta — Bugungi pochtalar | sahifa | `/mails/today` | `src/pages/mails/components/todaysMails.tsx` | v2 |
| `manager-mails-return` | Pochta — Qaytarish so'rovlari | sahifa | `/mails/return` | `src/pages/mails/components/returnMails.tsx` | v2 |
| `manager-mails-refused` | Pochta — Rad etilgan pochtalar | sahifa | `/mails/refused` | `src/pages/mails/components/refusedMails.tsx` | v2 |
| `manager-mails-old` | Pochta — Eski pochtalar | sahifa | `/mails/old` | `src/pages/mails/components/oldMails.tsx` | v2 |
| `manager-mails-detail-receive` | Pochta tafsiloti — qabul qilish | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | v2 |
| `manager-mails-detail-receive-duplicates` | Pochta tafsiloti — qabul qilish — takroriy telefonlar | sahifa | `/mails/:id` | `src/pages/mails/detail/ui/DuplicatePhonesAlert.tsx`, `src/pages/mails/detail/ui/OrdersTable.tsx` | v2 |
| `manager-mails-detail-receive-search` | Pochta tafsiloti — qabul qilish — qidiruv | sahifa | `/mails/:id` | `src/pages/mails/detail/ui/OrdersTable.tsx` | v2 |
| `manager-mails-detail-receive-search-empty` | Pochta tafsiloti — qabul qilish — qidiruvda natija yo'q | sahifa | `/mails/:id` | `src/pages/mails/detail/ui/OrdersTable.tsx` | v2 |
| `manager-mails-detail-receive-camera` | Pochta tafsiloti — qabul qilish — kamera | oyna | `/mails/:id` | `src/pages/mails/detail/index.tsx` | qisman — Kamera v2 — markaziy «Skaner» (planshet/desktopda «Skanerlash») kamerani shu sahifa ustida ochadi (ega qarori 2026-10-19: oqim ichidagi «Kamera bilan skanerlash» / «Kamera» tugmasi yo'q); skan USB bilan bitta handler, kamera har skandan keyin yopilmaydi. Skan tanlaydi (jo'natish / qabul / rad etilganni qabul); pochtada yo'q kod — «Bu pochtada yo'q · rad etildi». Eski pochta va kuryerning rad etilgan pochtasida maqsad yo'q. |
| `manager-mails-detail-refused-receive` | Rad etilgan pochta — qabul | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | v2 |
| `manager-mails-detail-old` | Eski pochta tafsiloti (tarix) | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | v2 |
| `manager-batches-new` | Paketlar — Yangi | sahifa | `/batches` | `src/pages/batches/ui/BatchesPage.tsx` | v2 |
| `manager-batches-old` | Paketlar — Eski | sahifa | `/batches` | `src/pages/batches/ui/BatchesPage.tsx` | v2 |
| `manager-batches-return` | Paketlar — Qaytarilgan | sahifa | `/batches` | `src/pages/batches/ui/BatchesPage.tsx` | v2 |
| `manager-batches-detail-send` | Paket tafsiloti — asosiy filialga jo'natish | sahifa | `/batches/:id` | `src/pages/batches/ui/BatchDetailPage.tsx` | v2 |
| `manager-batches-detail-send-camera` | Paket tafsiloti — asosiy filialga jo'natish — kamera | oyna | `/batches/:id` | `src/pages/batches/ui/BatchDetailPage.tsx` | qisman — Kamera v2 — markaziy «Skaner» (planshet/desktopda «Skanerlash») kamerani shu sahifa ustida ochadi (ega qarori 2026-10-19: oqim ichidagi «Kamera bilan skanerlash» / «Kamera» tugmasi yo'q); skan USB bilan bitta handler, kamera har skandan keyin yopilmaydi. «HQ'ga yuborish · Paket B-… · <filial>», skan tanlaydi, «Bu paketda yo'q · tanlanmadi»; yuborish — sahifadagi tugma. |
| `manager-batches-detail-readonly` | Paket tafsiloti (faqat o'qish) | sahifa | `/batches/:id` | `src/pages/batches/ui/BatchDetailPage.tsx` | v2 |
| `manager-returns-list` | Return batchlar | sahifa | `/returns` | `src/pages/returns/index.tsx` | v2 |
| `manager-returns-batch-detail` | Qaytarish paketi tafsiloti | sahifa | `/batches/:id` | `src/pages/batches/ui/BatchDetailPage.tsx` | v2 |
| `manager-payments-overview` | To'lovlar — umumiy | sahifa | `/payments` | `src/pages/payments/index.tsx` | qisman — Kodda bor (v2). Farq: sarlavhadagi «HQ'ga o'tkazish» tugmasi yo'q — Ega qarori #7 (IjqTYQks, 2026-10-25): menejer HQ'ga pul o'tkazmaydi — HQ (superadmin/admin) filial pulini «Pul qabul qilish» orqali o'zi oladi. «Berilishi kerak» kartasi HQ kassasi sahifasini faqat ko'rish uchun ochadi. |
| `manager-payments-overview-shift-closed` | To'lovlar — smena yopiq | sahifa | `/payments` | `src/pages/payments/index.tsx`, `src/pages/payments/components/ShiftBanner.tsx`, `src/pages/payments/components/OpenShiftFlow.tsx` | qisman — Kodda bor (CB-2). Farq: banner matnida «HQ'ga o'tkazish» yo'q — Ega qarori #7 (IjqTYQks, 2026-10-25): menejer HQ'ga pul o'tkazmaydi — HQ (superadmin/admin) filial pulini «Pul qabul qilish» orqali o'zi oladi. |
| `manager-payments-courier-select-dialog` | Qabul qilish — kuryer tanlash | oyna | `/payments` | `src/pages/payments/components/SettlementPickerDialog.tsx` | v2 |
| `manager-payments-main-cashbox` | Asosiy kassa (filial) | sahifa | `/payments/main-cashbox` | `src/pages/payments/components/mainCashbox.tsx` | v2 |
| `manager-payments-cashbox-form-dialog` | Kassadan xarajat / to'ldirish oynasi | oyna | `/payments/main-cashbox` | `src/pages/payments/components/CashboxFormPopup.tsx` | v2 |
| `manager-payments-close-shift-dialog` | Smenani yopish oynasi | oyna | `/payments/main-cashbox` | `src/pages/payments/components/CloseShiftPopup.tsx` | v2 |
| `manager-payments-main-cashbox-shift-closed` | Asosiy kassa (filial) — smena yopiq | sahifa | `/payments/main-cashbox` | `src/pages/payments/components/mainCashbox.tsx` | qisman — Kodda bor (CB-1): «Smena boshlanmagan» banneri, «Tezkor amallar» qulfi («Smena ochilgach ishlaydi»), «Smenani ochish» asosiy tugma (GET finance/shift/current). Oxirgi yopilgan smena kartasi «Smena yopildi · … · Natija» chizilmagan — Taklif · backend kerak (`last_closed`, BD2-8 → CB-3). |
| `manager-payments-main-cashbox-shift-open-dialog` | Smenani ochish oynasi | oyna | `/payments/main-cashbox` | `src/pages/payments/components/OpenShiftDialog.tsx` | qisman — Kodda bor (CB-1, OpenShiftDialog): ochadigan xodim, «Boshlanish: hozir», ochilish qoldig'i (jonli balans), izoh. «Oxirgi smena … bilan yopilgan» ogohlantirishi chizilmagan — Taklif · backend kerak (`last_closed`, BD2-8 → CB-3). |
| `manager-payments-main-cashbox-shift-result-dialog` | Smena yopildi — natija oynasi | oyna | `/payments/main-cashbox` | `src/pages/payments/components/ShiftResultDialog.tsx` | v2 |
| `manager-payments-cash-detail-branch` | Kassa tafsiloti — HQ'ga o'tkazish | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | qisman — Kodda bor (v2), faqat ko'rish: sarlavha, hisob-kitob holati, kassa yetarliligi, tarix. Farq: «HQ'ga o'tkazish» formasi o'rnida izoh «Filial pulini HQ o'zi qabul qiladi …» — Ega qarori #7 (IjqTYQks, 2026-10-25): menejer HQ'ga pul o'tkazmaydi — HQ (superadmin/admin) filial pulini «Pul qabul qilish» orqali o'zi oladi. |
| `manager-payments-cash-detail-branch-shift-closed` | Kassa tafsiloti — HQ'ga o'tkazish · smena yopiq | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx`, `src/pages/payments/components/ShiftLockedCard.tsx`, `src/pages/payments/components/OpenShiftFlow.tsx` | qisman — Ishlatilmaydi: HQ kassasi sahifasida forma yo'q, shuning uchun smena qulfi ham yo'q — Ega qarori #7 (IjqTYQks, 2026-10-25): menejer HQ'ga pul o'tkazmaydi — HQ (superadmin/admin) filial pulini «Pul qabul qilish» orqali o'zi oladi. |
| `manager-payments-cash-detail-courier` | Kassa tafsiloti — kuryerdan qabul | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | v2 |
| `manager-payments-cash-detail-courier-ack` | Kassa tafsiloti — kuryerdan qabul · kvitansiya javobi | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx`, `src/pages/payments/components/PaymentHistoryList.tsx`, `src/pages/payments/components/PaymentAckBadge.tsx` | v2 |
| `manager-payments-cash-detail-courier-shift-closed` | Kassa tafsiloti — kuryerdan qabul · smena yopiq | sahifa | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx`, `src/pages/payments/components/ShiftLockedCard.tsx`, `src/pages/payments/components/OpenShiftFlow.tsx` | v2 |
| `manager-payments-history-detail-dialog` | Tranzaksiya tafsiloti | oyna | `/payments` | `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | v2 |
| `manager-payments-history-detail-dialog-ack` | Tranzaksiya tafsiloti — kvitansiya javobi «Kuryer: noto'g'ri» | oyna | `/payments/cash-detail/:id` | `src/pages/payments/components/FinanceHistoryDetailPopup.tsx`, `src/pages/payments/components/PaymentAckBadge.tsx` | v2 |
| `manager-products-list` | Mahsulotlar ro'yxati | sahifa | `/products` | `src/pages/products/list/index.tsx` | v2 |
| `manager-products-market-select-dialog` | Mahsulot uchun market tanlash | oyna | `/products` | `src/pages/products/list/ui/SelectMarketDialog.tsx` | v2 |
| `manager-products-create` | Mahsulot yaratish | sahifa | `/products/create-product/:id` | `src/pages/products/create/index.tsx` | v2 |
| `manager-products-create-errors` | Mahsulot yaratish — xatolar | sahifa | `/products/create-product/:id` | `src/pages/products/create/index.tsx` | qisman — Kodda bor (MH-1): forma tepasida «Saqlab bo'lmadi · N ta maydonda xato» (tahrirlash oynasida ham), «Mahsulot nomi» va «Narx» xatolari. Og'irlik va o'lcham maydonlari xatolari — backend kerak (9fHyFp3y → MH-2). |
| `manager-products-edit-dialog` | Mahsulotni tahrirlash | oyna | `/products` | `src/pages/products/list/ui/EditProductDialog.tsx` | v2 |
| `manager-products-delete-dialog` | Mahsulotni o'chirish | oyna | `/products` | `src/pages/products/ui/useDeleteProductConfirm.tsx` | v2 |
| `manager-users-list` | Foydalanuvchilar (filial xodimlari) | sahifa | `/all-users` | `src/pages/users/list/UserListPage.tsx` | v2 |
| `manager-users-create-courier` | Yangi xodim — kuryer | sahifa | `/all-users/create-user` | `src/pages/users/create/CreateUserPage.tsx` | v2 |
| `manager-users-create-hybrid` | Yangi xodim — Aralash filial (rol tanlash) | sahifa | `/all-users/create-user` | `src/pages/users/create/CreateUserPage.tsx` | v2 |
| `manager-users-detail` | Xodim tafsiloti | sahifa | `/all-users/:id` | `src/pages/users/detail/UserDetailPage.tsx` | v2 |
| `manager-users-edit-dialog` | Xodimni tahrirlash | oyna | `/all-users/:id` | `src/features/user/update-user/ui/UpdateUserModal.tsx` | qisman — CS-C: kodda market yorlig'i «Uyga standart narx» / «Markazga standart narx» (maket `superadmin-users-detail` / `-users-edit-dialog`, ega S1, sinxron f86a2e73 2026-10-19); bu maketda fondagi «Tarif» kartasi va «Market ma'lumotlari» maydonlarida hali «Uyga tarif» / «Markazga tarif» (e5436b19, 2026-10-15) — bir xil maydon uchun maketlar ziddiyati, ega savoli. Qolgani — avvalgidek v2. |
| `manager-regions-scoped` | Hudud — tumanlar statistikasi | sahifa | `/regions` | `src/pages/region/ui/ScopedRegionView.tsx` | v2 |
| `manager-scan-camera` | Skaner — kamera (umumiy) | sahifa | `/scan` | `src/pages/scan/index.tsx` | v2 |
| `manager-scan-result` | Skanerlangan buyurtma | sahifa | `/scan/:token` | `src/pages/scan/detail.tsx` | v2 |
| `manager-users-create-courier-district` | Yangi xodim — kuryer, «Ish hududi» (taklif) | sahifa | `/all-users/create-user` | `src/pages/users/create/CreateUserPage.tsx` | v2 |
| `manager-warehouse-detail` | Filial ombori — qoldiq va ombordan ketadigan buyurtmalar (faqat ko'rish) | sahifa | `/warehouses/:id` | `src/pages/warehouses/detail/index.tsx` | v2 |
| `manager-payments-history-detail-dialog-corrected` | Tranzaksiya tafsiloti · qaytarilgan to'lov (faqat ko'rish) | oyna | `/payments/cash-detail/:id` | `src/pages/payments/components/cashDetail.tsx` | yangi (kodda yo'q) — T6 (Env2iYq1) pul qaytarish / summani tahrirlash — kodda yo'q: filial kassasida «Qaytarildi» va blok; amal yo'q. |
| `manager-branch-dashboard-contacts` | Filial paneli — «Viloyatingiz logisti» kartasi | sahifa | `/branch-dashboard` | `src/pages/branch-dashboard/ui/BranchDashboardPage.tsx` | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F3 ContactCard BranchDashboardPage da — sarlavhadan keyin. |
| `manager-orders-detail-contacts` | Buyurtma tafsiloti — «Muammo bo'lsa» qatori, market telefonisiz | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F2 OrderMeta — «Market» qatorida telefon yo'q, yangi «Muammo bo'lsa». |
| `manager-new-orders-markets-no-phone` | Qabul va yaratish — Marketlar (telefon ustunisiz) | sahifa | `/new-orders` | `src/pages/new_orders/markets/index.tsx` | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F2 — menejerda market telefoni ustuni/qatori yo'q (markets/index.tsx, SourceListCard, MarketPicker, SelectMarketDialog). |
| `manager-payments-cashbox-form-dialog-receipt` | Kassadan xarajat — chek rasmi bilan (filial) | oyna | `/payments/main-cashbox` | `src/pages/payments/components/mainCashbox.tsx` | qisman — Kodda bor (QlLf33Ma): menejer — o'z filiali kassasidan xarajatga chek (POST finance/receipts kind=manual_expense), «Sozlamalar» havolasisiz. |
| `manager-payments-history-detail-dialog-receipt` | Tranzaksiya tafsiloti · «Chek» bo'limi (faqat ko'rish) | oyna | `/payments` | `src/pages/payments/index.tsx` | qisman — Kodda bor (QlLf33Ma): menejer — o'z filiali cheklari, «Qayta tahlil» yo'q (backend can_reanalyze=false). |

### registrator — Registrator

54 ta maket · kodda bor: 53 · kodda yo'q: 1

| Maket | Sarlavha | Tur | Route | Asosiy fayl | Holat |
|---|---|---|---|---|---|
| `registrator-dashboard-main` | Dashboard — statistika | sahifa | `/` | `src/pages/dashboard/DashboardPage.tsx` | v2 |
| `registrator-dispatch-list` | Biriktirish — skanerlangan buyurtmalar | sahifa | `/dispatch` | `src/pages/dispatch/index.tsx` | v2 |
| `registrator-dispatch-empty` | Biriktirish — bo'sh holat | sahifa | `/dispatch` | `src/pages/dispatch/index.tsx` | v2 |
| `registrator-dispatch-camera-scanner-dialog` | Biriktirish — kamera skaneri | oyna | `/dispatch` | `src/pages/dispatch/index.tsx` | qisman — Kamera v2 — markaziy «Skaner» (planshet/desktopda «Skanerlash») kamerani shu sahifa ustida ochadi (ega qarori 2026-10-19: oqim ichidagi «Kamera bilan skanerlash» / «Kamera» tugmasi yo'q); skan USB bilan bitta handler, kamera har skandan keyin yopilmaydi. «Biriktirish · <filial> · savatda N ta», savat qurilmada (ega D2, /scan/:token «Kuryerga biriktirish» ham shu savatga), rad etilgan QR ro'yxatda «Paket … · Rad etildi»; kuryer — sahifadagi tugma. |
| `registrator-dispatch-courier-select-dialog` | Biriktirish — kuryer tanlash | oyna | `/dispatch` | `src/pages/dispatch/index.tsx` | v2 |
| `registrator-orders-list` | Buyurtmalar ro'yxati | sahifa | `/orders` | `src/pages/orders/index.tsx` | qisman — Bekor qatorida bosqich badge'i (Bekor · kuryerda / yo'lda / filialda / HQ'da — danger + ikonka; «Marketga topshirildi» — neutral, PackageCheck) va ostida joy qatori «Urgut filiali · 2 kun»; muddat 3 kunda warning, 7 kunda + TriangleAlert (BG7) (taklif «Bekor holatlari» (ega 2026-10-19, Trello vOczoOUE; elchi-v2-specs/bekor-holatlari-taklif.md)) — kodda hali eski «Bekor qilingan» badge'i. |
| `registrator-orders-filters-mobile` | Buyurtmalar — filtr paneli (telefon) | oyna · faqat telefon | `/orders` | `src/pages/orders/list/OrderFilters.tsx` | v2 |
| `registrator-orders-detail` | Buyurtma tafsiloti | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | v2 |
| `registrator-orders-detail-edit-order-dialog` | Buyurtmani tahrirlash oynasi | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/editDialogs/EditOrderDialog.tsx` | v2 |
| `registrator-orders-detail-edit-address-dialog` | Manzilni tahrirlash oynasi | oyna | `/orders/edit/:orderId` | `src/pages/new_orders/components/editDialogs/EditAddressDialog.tsx` | v2 |
| `registrator-new-orders-markets` | Qabul va yaratish — Marketlar | sahifa | `/new-orders` | `src/pages/new_orders/markets/index.tsx` | v2 |
| `registrator-new-orders-incoming-sources` | Kiruvchi posilkalar — manba tanlash | sahifa | `/new-orders/incoming` | `src/pages/incoming-orders/SourcePicker.tsx` | v2 |
| `registrator-new-orders-incoming-scan` | Kiruvchi posilkalar — skanerlash | sahifa | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | qisman — Kodda qop yorlig'i bor («Qop» ustuni, telefon kartasida «Qop …», xulosa «N ta · M ta qop»), skanni olib tashlash va «Qaytarish» — v2; «2/3» belgisi va «N ta qop chala keldi» bloki — backend kerak (har qop uchun received_count, BD2-7 → IP-2). «Kamera» / «Kamera bilan skanerlash» tugmalari chizilmaydi (ega qarori 2026-10-19 — markaziy «Skaner»). |
| `registrator-new-orders-incoming-scan-camera` | Kiruvchi posilkalar — skanerlash — kamera | oyna | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | qisman — Kamera v2 — markaziy «Skaner» (planshet/desktopda «Skanerlash») kamerani shu sahifa ustida ochadi (ega qarori 2026-10-19: oqim ichidagi «Kamera bilan skanerlash» / «Kamera» tugmasi yo'q); skan USB bilan bitta handler, kamera har skandan keyin yopilmaydi. Skan faqat belgilaydi, qabul — sahifadagi «Qabul qilish»; kamera ichida manba almashtirish, «Qopda yetishmaydi». Registrator — menejer bilan bir xil kamera (ScannerHost, markaziy «Skaner»); kameraning o'z ishi (Trello v1eLN2tV) alohida. |
| `registrator-new-orders-incoming-scan-partial` | Kiruvchi posilkalar — chala qop ogohlantirishi | sahifa | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | v2 |
| `registrator-new-orders-incoming-scan-partial-confirm-dialog` | Kiruvchi posilkalar — chala qop bilan qabul tasdig'i | oyna | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | v2 |
| `registrator-new-orders-incoming-scan-undo` | Kiruvchi posilkalar — skan olib tashlandi | sahifa | `/new-orders/incoming/:marketId` | `src/pages/incoming-orders/index.tsx` | qisman — Kodda bor (IP-1): qatordagi Undo2 «Olib tashlash», skan xabarida «Olib tashlash» (qop skanida faqat shu skan belgilaganlar), 5 soniyalik «Qaytarish» xabari. Farq: xabar umumiy notify bilan — maketdagi Undo2 ikonka va ikkinchi darajali «Qaytarish» tugmasi o'rniga info ikonka va havola-tugma (Toaster'ni kengaytirish — umumiy qatlam, ega roziligi kerak). |
| `registrator-new-orders-market-detail` | Market buyurtmalari — qabul | sahifa | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | qisman — Registrator boshqa xodim rollari (superadmin/admin/menejer) bilan bir xil v2 ko'rinishda — maketdagi farqlar (sarlavhada «Chop etish», «Buyurtmalar N ta» karta sarlavhasi, «5 / 6 ta» tanlov xulosasi, qator kebab menyusi) ega qaroriga qadar kiritilmagan. |
| `registrator-new-orders-market-detail-camera` | Market buyurtmalari — qabul — kamera | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | qisman — Kamera v2 — markaziy «Skaner» (planshet/desktopda «Skanerlash») kamerani shu sahifa ustida ochadi (ega qarori 2026-10-19: oqim ichidagi «Kamera bilan skanerlash» / «Kamera» tugmasi yo'q); skan USB bilan bitta handler, kamera har skandan keyin yopilmaydi. Skan = darhol qabul; «Qabul qilindi N · Qoldi M · Topilmadi K», boshqa marketning buyurtmasi rad etiladi, kamera ichida market almashtirish. |
| `registrator-new-orders-market-detail-receive-dialog` | Qabul qilish tasdig'i | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | qisman — Umumiy xodim qabul oynasi (MarketOrderDialogs.tsx) — tasdiq tugmasi «Tasdiqlash»; maketdagi «Qabul qilish — N ta» varianti ega qaroriga qadar kiritilmagan. |
| `registrator-new-orders-market-detail-delete-dialog` | Buyurtmani o'chirish tasdig'i | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | v2 |
| `registrator-new-orders-market-order-edit` | Market buyurtmasini tahrirlash | sahifa | `/new-orders/:marketId/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | v2 |
| `registrator-new-orders-cancelled` | Bekor qilinganlar — marketlar (HQ) | sahifa | `/new-orders/cancelled` | `src/pages/new_orders/cancelled/index.tsx` | v2 |
| `registrator-new-orders-cancelled-detail` | Bekor qilinganlarni marketga topshirish (HQ) | sahifa | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | v2 |
| `registrator-new-orders-cancelled-manual-dialog` | QR buzilganini tasdiqlash (HQ) | oyna | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/ui/ManualConfirmDialog.tsx` | v2 |
| `registrator-new-orders-cancelled-scanner-dialog` | Market QR skanerlash (HQ) | oyna | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | qisman — Kamera v2 — markaziy «Skaner» (planshet/desktopda «Skanerlash») kamerani shu sahifa ustida ochadi (ega qarori 2026-10-19: oqim ichidagi «Kamera bilan skanerlash» / «Kamera» tugmasi yo'q); skan USB bilan bitta handler, kamera har skandan keyin yopilmaydi. Sarlavhadagi «Market QR skanerlash» tugmasi olib tashlangan (bitta ekranda ikkinchi skan tugmasi yo'q — tizim-scanner §09); market QR'dan keyin kamera yopilmaydi — buyurtmalarni tanlashga o'tadi. |
| `registrator-new-orders-create-step1` | Buyurtma yaratish — market tanlash | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/Step1Market.tsx` | v2 |
| `registrator-new-orders-create-market-picker-dialog` | Buyurtma yaratish — market tanlash oynasi | oyna | `/new-orders/create` | `src/pages/orders/create/ui/MarketPicker.tsx` | v2 |
| `registrator-new-orders-create-step2` | Buyurtma yaratish — qo'lda forma | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/Step2Combined.tsx` | v2 |
| `registrator-new-orders-create-step2-existing-customer` | Buyurtma yaratish — mavjud mijoz, tarif, rasm (taklif) | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/ExistingCustomerNotice.tsx` | qisman — CS-A (hiqRNhkI): «Mavjud mijoz» bloki (kartadan to'ldirildi · N ta buyurtma, oxirgisi …, «Bekor qilish»), viloyat district/:id dan, o'zgarmagan mijoz — customer_id; «Bu mijozda yangi buyurtma bor» + «№id ni yangi oynada ochish». CS-B (IT1YpboR, zRqDRLAZ): bu rolda yetkazish narxi CHIZILMAYDI — backend menejer/registratorga tarif bermaydi (N3): kartalarda tur ikonkasi, «Narx yo'q» ogohlantirishi va xulosadagi «Yetkazish narxi» qatori yo'q, sukut tur — «Markazgacha»; mahsulot rasmi 40 px (ProductThumb, entities/product), narx matni («2 × 45 000 so'm», «Narxi kiritilmagan», «Katalogdan tashqari · narxsiz»), «Umumiy summa» avto-taklifi («Mahsulotlar narxidan hisoblandi», qo'lda yozilgach «Mahsulotlar bo'yicha: … · Qo'llash»). Kodda yo'q (bu rolda): «Yetkazish narxi»; taxminiy «≈ …», vazn/hajm izohlari va «og'ir yoki katta posilkada oshadi» (CS-E, DAqXPeSy), «O'zgartirsangiz … «Mijoz kartasi ham yangilansinmi?»» (CS-D, BD2-4). |
| `registrator-new-orders-create-step2-customer-suggest` | Buyurtma yaratish — mijoz takliflari (taklif) | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/CustomerPhoneSuggest.tsx` | qisman — CS-A (hiqRNhkI): telefon bo'yicha taklif v2 — 7 raqamdan keyin 300 ms, desktopda ro'yxat, telefonda pastki varaqa (faqat natija bo'lsa), qatorda ism · telefon · tuman, «N ta buyurtma», «N ta yangi», «qidirilmoqda» / «topilmadi». «Qo'shimcha raqam: …» — faqat backend matched_by = extra_number bo'lsa (9444UAa8). Kodda yo'q (backend kartasidan keyin, CS-D): «Bu marketda hali buyurtmasi yo'q» + boshqa market mijozlari (BD2-2); shu sabab «Barcha mijozlar» sarlavhasi faqat superadmin/admin da, menejer/registrator — «<market> mijozlari», market — «Sizning mijozlaringiz». |
| `registrator-new-orders-create-step2-customer-update-dialog` | Buyurtma yaratish — mijoz kartasini yangilash (taklif) | oyna | `/new-orders/create` | `src/pages/orders/create/index.tsx` | yangi (kodda yo'q) — Taklif (create-step2, ega S1..S5) — kodda yo'q: taxminiy narx, mijoz kartasini yangilash tasdig'i; backend narx dvigateli (DAqXPeSy) kerak. |
| `registrator-new-orders-create-ai` | Buyurtma yaratish — AI rejimi | sahifa | `/new-orders/create` | `src/pages/orders/create/index.tsx` | v2 |
| `registrator-new-orders-create-ai-confirm-dialog` | AI buyurtmalarni tasdiqlash | oyna | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | v2 |
| `registrator-mails-today` | Pochta — Bugungi pochtalar | sahifa | `/mails/today` | `src/pages/mails/components/todaysMails.tsx` | v2 |
| `registrator-mails-return` | Pochta — Qaytarish | sahifa | `/mails/return` | `src/pages/mails/components/returnMails.tsx` | v2 |
| `registrator-mails-refused` | Pochta — Rad etilgan pochtalar | sahifa | `/mails/refused` | `src/pages/mails/components/refusedMails.tsx` | v2 |
| `registrator-mails-old` | Pochta — Eski pochtalar | sahifa | `/mails/old` | `src/pages/mails/components/oldMails.tsx` | v2 |
| `registrator-mails-detail` | Pochta tafsiloti — bugungi | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | v2 |
| `registrator-mails-detail-duplicates` | Pochta tafsiloti — bugungi — takroriy telefonlar | sahifa | `/mails/:id` | `src/pages/mails/detail/ui/DuplicatePhonesAlert.tsx`, `src/pages/mails/detail/ui/OrdersTable.tsx` | v2 |
| `registrator-mails-detail-search` | Pochta tafsiloti — bugungi — qidiruv | sahifa | `/mails/:id` | `src/pages/mails/detail/ui/OrdersTable.tsx` | v2 |
| `registrator-mails-detail-search-empty` | Pochta tafsiloti — bugungi — qidiruvda natija yo'q | sahifa | `/mails/:id` | `src/pages/mails/detail/ui/OrdersTable.tsx` | v2 |
| `registrator-mails-detail-camera` | Pochta tafsiloti — bugungi — kamera | oyna | `/mails/:id` | `src/pages/mails/detail/index.tsx` | qisman — Kamera v2 — markaziy «Skaner» (planshet/desktopda «Skanerlash») kamerani shu sahifa ustida ochadi (ega qarori 2026-10-19: oqim ichidagi «Kamera bilan skanerlash» / «Kamera» tugmasi yo'q); skan USB bilan bitta handler, kamera har skandan keyin yopilmaydi. Skan tanlaydi (jo'natish / qabul / rad etilganni qabul); pochtada yo'q kod — «Bu pochtada yo'q · rad etildi». Eski pochta va kuryerning rad etilgan pochtasida maqsad yo'q. |
| `registrator-mails-detail-send-dialog` | Pochtani filialga jo'natish (HQ) | oyna | `/mails/:id` | `src/pages/mails/detail/ui/SendPostModal.tsx` | v2 |
| `registrator-mails-detail-refused` | Pochta tafsiloti — rad etilgan | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | v2 |
| `registrator-mails-detail-old` | Pochta tafsiloti — tarix | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | v2 |
| `registrator-products-list` | Mahsulotlar ro'yxati | sahifa | `/products` | `src/pages/products/list/index.tsx` | v2 |
| `registrator-products-market-select-dialog` | Mahsulot uchun market tanlash | oyna | `/products` | `src/pages/products/list/ui/SelectMarketDialog.tsx` | v2 |
| `registrator-products-edit-dialog` | Mahsulotni tahrirlash | oyna | `/products` | `src/pages/products/list/ui/EditProductDialog.tsx` | v2 |
| `registrator-products-delete-dialog` | Mahsulotni o'chirish | oyna | `/products` | `src/pages/products/ui/useDeleteProductConfirm.tsx` | v2 |
| `registrator-products-create` | Mahsulot yaratish | sahifa | `/products/create-product/:id` | `src/pages/products/create/index.tsx` | v2 |
| `registrator-products-create-errors` | Mahsulot yaratish — xatolar | sahifa | `/products/create-product/:id` | `src/pages/products/create/index.tsx` | qisman — Kodda bor (MH-1): forma tepasida «Saqlab bo'lmadi · N ta maydonda xato» (tahrirlash oynasida ham), «Mahsulot nomi» va «Narx» xatolari. Og'irlik va o'lcham maydonlari xatolari — backend kerak (9fHyFp3y → MH-2). |
| `registrator-scan-camera` | Skaner — kamera (umumiy) | sahifa | `/scan` | `src/pages/scan/index.tsx` | v2 |
| `registrator-scan-result` | Skanerlangan buyurtma | sahifa | `/scan/:token` | `src/pages/scan/detail.tsx` | v2 |

### market — Market

42 ta maket · kodda bor: 31 · kodda yo'q: 11

| Maket | Sarlavha | Tur | Route | Asosiy fayl | Holat |
|---|---|---|---|---|---|
| `market-dashboard-home` | Mening dashboardim | sahifa | `/` | `src/pages/dashboard/MarketDashboardPage.tsx` | v2 |
| `market-dashboard-extra-cost-approvals` | Dashboard · Xarajat tasdiqlari | sahifa | `/` | `src/pages/dashboard/ui/ExtraCostApprovals.tsx` | v2 |
| `market-orders-list` | Buyurtmalar ro'yxati | sahifa | `/orders` | `src/pages/orders/index.tsx` | qisman — Bekor qatorlarida bosqich badge'i (Bekor · kuryerda / yo'lda / filialda / HQ'da — danger + ikonka; «Marketga topshirildi» — neutral, PackageCheck) va ostida joy qatori «Urgut filiali · 2 kun»; muddat 3 kunda warning, 7 kunda + TriangleAlert (BG7) (taklif «Bekor holatlari» (ega 2026-10-19, Trello vOczoOUE; elchi-v2-specs/bekor-holatlari-taklif.md)) — kodda hali eski «Bekor qilingan» badge'i; joy nomi marketga BG1 dan keyin. |
| `market-orders-detail` | Buyurtma tafsilotlari | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | v2 |
| `market-orders-detail-cancelled` | Buyurtma tafsilotlari — bekor, «Qaytarish yo'li» (taklif) | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | yangi (kodda yo'q) — Market tafsiloti (taklif «Bekor holatlari» (ega 2026-10-19, Trello vOczoOUE; elchi-v2-specs/bekor-holatlari-taklif.md)): bosqich badge'i + «Qaytarish yo'li» (market-orders-detail da tarix bloki yo'q edi), pastda «QR kodni ochish» → market QR oynasi. Xodim va joy nomi marketga BG1 dan keyin. |
| `market-new-orders-list` | Yangi buyurtmalar | sahifa | `/new-orders/:marketId` | `src/pages/new_orders/components/new_orderDetail.tsx` | v2 |
| `market-new-orders-delete-dialog` | Buyurtmani o'chirish | oyna | `/new-orders/:marketId` | `src/pages/new_orders/components/marketOrders/MarketOrderDialogs.tsx` | v2 |
| `market-new-orders-edit` | Yangi buyurtma tafsiloti | sahifa | `/new-orders/:marketId/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | v2 |
| `market-new-orders-create-manual` | Buyurtma yaratish · Qo'lda | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/Step2Combined.tsx` | v2 |
| `market-new-orders-create-manual-existing-customer` | Buyurtma yaratish · mavjud mijoz, tarif, rasm (taklif) | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/ExistingCustomerNotice.tsx` | qisman — CS-A (hiqRNhkI): «Mavjud mijoz» bloki (kartadan to'ldirildi · N ta buyurtma, oxirgisi …, «Bekor qilish»), viloyat district/:id dan, o'zgarmagan mijoz — customer_id; «Bu mijozda yangi buyurtma bor» + «№id ni yangi oynada ochish». CS-B (IT1YpboR, zRqDRLAZ): yetkazish turi kartalarida market standart narxi («25 000 so'm · standart»; «Narx yo'q» + «standart narx belgilanmagan» ogohlantirishi; sukut tur — default_tariff, qo'lda tanlangani ustidan yozilmaydi; market o'z kartasidan — auth/my-profile), mahsulot rasmi 40 px (ProductThumb, entities/product), narx matni («2 × 45 000 so'm», «Narxi kiritilmagan», «Katalogdan tashqari · narxsiz»), «Umumiy summa» avto-taklifi («Mahsulotlar narxidan hisoblandi», qo'lda yozilgach «Mahsulotlar bo'yicha: … · Qo'llash»), xulosada VAQTINCHALIK «Yetkazish narxi» — standart narx (ega tasdig'i kutilmoqda; tanlangan tur narxsiz bo'lsa qator yo'q). Kodda yo'q: taxminiy «≈ …», vazn/hajm izohlari va «og'ir yoki katta posilkada oshadi» (CS-E, DAqXPeSy), «O'zgartirsangiz … «Mijoz kartasi ham yangilansinmi?»» (CS-D, BD2-4). |
| `market-new-orders-create-manual-customer-suggest` | Buyurtma yaratish · mijoz takliflari (taklif) | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/CustomerPhoneSuggest.tsx` | qisman — CS-A (hiqRNhkI): telefon bo'yicha taklif v2 — 7 raqamdan keyin 300 ms, desktopda ro'yxat, telefonda pastki varaqa (faqat natija bo'lsa), qatorda ism · telefon · tuman, «N ta buyurtma», «N ta yangi», «qidirilmoqda» / «topilmadi». «Qo'shimcha raqam: …» — faqat backend matched_by = extra_number bo'lsa (9444UAa8). Kodda yo'q (backend kartasidan keyin, CS-D): «Bu marketda hali buyurtmasi yo'q» + boshqa market mijozlari (BD2-2); shu sabab «Barcha mijozlar» sarlavhasi faqat superadmin/admin da, menejer/registrator — «<market> mijozlari», market — «Sizning mijozlaringiz». |
| `market-new-orders-create-manual-customer-update-dialog` | Buyurtma yaratish · mijoz kartasini yangilash (taklif) | oyna | `/new-orders/create` | `src/pages/orders/create/index.tsx` | yangi (kodda yo'q) — Taklif (create-step2, ega S1..S5) — kodda yo'q: taxminiy narx, mijoz kartasini yangilash tasdig'i; backend narx dvigateli (DAqXPeSy) kerak. |
| `market-new-orders-create-ai-input` | Buyurtma yaratish · AI kiritish | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiInputPanel.tsx` | v2 |
| `market-new-orders-create-ai-preview` | Buyurtma yaratish · AI natijalari | sahifa | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiPreviewCard.tsx` | v2 |
| `market-new-orders-create-ai-confirm-dialog` | AI · Yaratishni tasdiqlash | oyna | `/new-orders/create` | `src/pages/orders/create/ui/ai/AiConfirmBar.tsx` | v2 |
| `market-new-orders-cancelled` | Bekor qilinganlar | sahifa | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/detail.tsx` | v2 |
| `market-new-orders-cancelled-transit` | Bekor qilinganlar · Yo'lda (taklif) | sahifa | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/ui/MarketReturns.tsx` | v2 |
| `market-new-orders-cancelled-received` | Bekor qilinganlar · Olganlarim (taklif) | sahifa | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/ui/MarketReturns.tsx` | v2 |
| `market-new-orders-cancelled-qr-dialog` | Bekor qilinganlar · QR kod | oyna | `/new-orders/cancelled/:marketId` | `src/pages/new_orders/cancelled/ui/MarketQrDialog.tsx` | v2 |
| `market-products-list` | Mahsulotlar | sahifa | `/products` | `src/pages/products/list/index.tsx` | v2 |
| `market-cashbox-my` | Market kassasi | sahifa | `/cash-box` | `src/pages/payments/components/MyCashboxPage.tsx` | v2 |
| `market-cashbox-history-detail-dialog` | Tranzaksiya tafsiloti | oyna | `/cash-box` | `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | v2 |
| `market-profile` | Profil — Telegram guruhlari holati (ulanmagan; taklif · backend kerak) | sahifa | `/profile` | `src/pages/profile/ui/ProfilePage.tsx` | qisman — TG-B: «Xavfsizlik» + «Telegram» bir qatorda, ostida «Telegram guruhi» — har tur qatorida «Ulash» va PII kaliti kodda; guruh holati («Ulanmagan» / «Ulangan», izohlar) chizilmagan — market uchun holat endpointi yo'q (KJNHAlGW, TG-C). Sarlavhadagi kontakt shaxs ismi va «{do'kon} · Login» — backend maydoni yo'q. |
| `market-profile-telegram-group-dialog` | Telegram guruhini ulash (havola, QR, holat kutilmoqda) | oyna | `/profile` | `src/features/telegram-link/ui/MarketGroupLinkDialog.tsx` | qisman — TG-B: havola + QR, qadamlar, sanoq — kodda. Holat kuzatilmaydi (GET /notifications market uchun yopiq): «Guruh ulanishi kutilmoqda…» o'rniga 3-qadam «ulanganda sizga bildirishnoma keladi» (backend telegram.group_connected), oyna o'zi yopilmaydi — TG-C (KJNHAlGW). |
| `market-profile-telegram-group-expired-dialog` | Telegram guruhini ulash — havola muddati tugadi | oyna | `/profile` | `src/features/telegram-link/ui/MarketGroupLinkDialog.tsx` | v2 |
| `market-profile-telegram-status` | Profil — Telegram guruhi: biri ulangan (taklif · backend kerak) | sahifa | `/profile` | `src/pages/profile/ui/ProfilePage.tsx` | yangi (kodda yo'q) — Taklif (tg-link S1, S5) — kodda yo'q; backend guruhlar holati endpointi kerak. |
| `market-operators-list` | Operatorlar | sahifa | `/market-operators` | `src/pages/market-operators/index.tsx` | v2 |
| `market-operators-empty` | Operatorlar — bo'sh holat | sahifa | `/market-operators` | `src/pages/market-operators/index.tsx` | v2 |
| `market-operators-create-dialog` | Operator qo'shish | oyna | `/market-operators` | `src/pages/market-operators/ui/CreateOperatorDialog.tsx` | v2 |
| `market-operators-commission-dialog` | Komissiya | oyna | `/market-operators` | `src/pages/market-operators/ui/CommissionDialog.tsx` | v2 |
| `market-operators-delete-dialog` | Operatorni o'chirish | oyna | `/market-operators` | `src/pages/market-operators/ui/useDeleteOperatorConfirm.tsx` | v2 |
| `market-operators-commission-fixed-dialog` | Komissiya — qat'iy summa, xato | oyna | `/market-operators` | `src/pages/market-operators/ui/CommissionDialog.tsx` | v2 |
| `market-dashboard-mobile-menu` | Menyu ochiq — yon panel / pastki varaq | oyna · faqat planshet + telefon | `(qobiq)` | `src/widgets/layout/dashboardLayout.tsx` | v2 |
| `market-operators-deactivate-dialog` | Operatorni nofaol qilish | oyna | `/market-operators` | `src/pages/market-operators/index.tsx` | yangi (kodda yo'q) — Kodda yo'q; market uchun status endpoint yo'q (Taklif · backend kerak). |
| `market-operators-activate-dialog` | Operatorni faollashtirish | oyna | `/market-operators` | `src/pages/market-operators/index.tsx` | yangi (kodda yo'q) — Kodda yo'q; market uchun status endpoint yo'q (Taklif · backend kerak). |
| `market-products-warehouse-stock` | Mahsulotlar — omborlardagi qoldiq | sahifa | `/products` | `src/pages/products/list/index.tsx` | v2 |
| `market-cashbox-history-detail-dialog-corrected` | Tranzaksiya tafsiloti · tahrirlangan to'lov (sabab bilan) | oyna | `/cash-box` | `src/pages/payments/components/MyCashboxPage.tsx` | yangi (kodda yo'q) — T6 (Env2iYq1) pul qaytarish / summani tahrirlash — kodda yo'q: marketga «Tahrirlangan» va blok (sabab ko'rinadi). |
| `market-cashbox-my-corrected` | Market kassasi · tahrirlangan to'lov belgilari | sahifa | `/cash-box` | `src/pages/payments/components/MyCashboxPage.tsx` | yangi (kodda yo'q) — T6 (Env2iYq1) pul qaytarish / summani tahrirlash — kodda yo'q: MyCashboxPage (market) — «Tahrirlangan», «Teskari yozuv», «Tuzatilgan». |
| `market-dashboard-home-contacts` | Bosh sahifa — «Elchi mas'ulingiz» kartasi | sahifa | `/` | `src/pages/dashboard/MarketDashboardPage.tsx + src/pages/dashboard/LogistDashboardPage.tsx + src/pages/investor/InvestorDashboardPage.tsx + src/pages/dashboard/DashboardPage.tsx + src/shared/ui/Forbidden.tsx` | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F3 ContactCard MarketDashboardPage da (market_operator — operator rejimida ham) — KPI qatoridan keyin. |
| `market-profile-contacts` | Profil — «Elchi mas'ulingiz» kartasi | sahifa | `/profile` | `src/pages/profile/ui/ProfilePage.tsx` | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F3 ContactCard ProfilePage da (market, market_operator). |
| `market-orders-detail-contacts` | Buyurtma tafsilotlari — «Elchi mas'ulingiz» qatori | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F2 OrderMeta — market/market_operator'da «Muammo bo'lsa» o'rnida «Elchi mas'ulingiz» (/users/me/contacts). |
| `market-orders-detail-special-categories` | Buyurtma tafsilotlari — maxsus belgilar (o'zgartirib bo'lmaydi) | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | yangi (kodda yo'q) — T8 (EcD6EHTH) maxsus belgilar — kodda yo'q: market — faqat «Yaratilgan»/«Yangi» da o'zgartiradi; «Yo'lda» da tugma o'chiq + izoh; «Maxsus yorliq chop etish» bor. Market operatori — o'z marketi, Yaratilgan/Yangi; chop etish yo'q. |

### market_operator — Market operatori

5 ta maket · kodda bor: 5 · kodda yo'q: 0

| Maket | Sarlavha | Tur | Route | Asosiy fayl | Holat |
|---|---|---|---|---|---|
| `market_operator-products-list` | Mahsulotlar | sahifa | `/products` | `src/pages/products/list/index.tsx` | v2 |
| `market_operator-products-unassigned` | Mahsulotlar — market biriktirilmagan | sahifa | `/products` | `src/pages/products/list/index.tsx` | v2 |
| `market_operator-earnings` | Daromadim | sahifa | `/my-earnings` | `src/pages/my-earnings/index.tsx` | qisman — Kodda bor (MO-2): sarlavha va «Stavkam» kartasi (my-profile → commission_type/commission_value: qiymat, Turi, Belgilaydi «Market egasi», Namuna, izoh). Farq: «Hisob» (Qoldiq · Daromad · To'langan), «To'lovlar», «Daromadlar» chizilmagan — maketda «Taklif · backend kerak» (finance/operators/me/* — E6iEOAVs, MO-6); yolg'iz karta max-w-xl. |
| `market_operator-earnings-no-commission` | Daromadim — komissiya belgilanmagan | sahifa | `/my-earnings` | `src/pages/my-earnings/index.tsx` | qisman — Kodda bor (MO-2): ogohlantirish «Komissiya belgilanmagan — daromad yozilmaydi» va «Stavkam» kartasida «Belgilanmagan» (commission_type null yoki qiymat 0). Farq: «Hisob», «To'lovlar» va «Daromadlar» («Hali daromad yo'q») bo'sh holatlari chizilmagan (Taklif — MO-6); ogohlantirish karta kengligida (max-w-xl). |
| `market_operator-new-orders-create-manual` | Buyurtma yaratish · Qo'lda | sahifa | `/new-orders/create` | `src/pages/orders/create/index.tsx` | qisman — Kodda bor (MO-3): faqat «AI bilan» qismi — 1-qadamsiz (market serverda user.market_id dan, katalog my-products), AI kiritish / natijalar / tasdiq holatlari market-new-orders-create-ai-* bilan bir xil; «Qo'lda · AI bilan» tanlovi yo'q (yolg'iz usul), AI o'chiq bo'lsa «AI bilan yaratish hozir o'chiq» ogohlantirishi; orqaga — «Buyurtmalar»; AI kartasidagi «Operator» maydoni — o'zi, faqat o'qish («Siz — avtomatik yoziladi», operator matni yuborilmaydi — ai-confirm so'rovchi ismini o'zi yozadi). Farq: qo'lda forma (mijoz, manzil, mahsulotlar, «Operator: Siz — avtomatik») — POST orders MARKET_OPERATOR'ga yopiq (OfRSoRUX, MO-7); sarlavhadagi «<market> nomidan» — my-profile market nomini bermaydi (N13, MO-8), o'rniga umumiy izoh; AI kartasida «Viloyat» maydoni yo'q va tuman faqat AI aniqlagani / takliflari — GET /region va region/:id operatorga 403 (N11; ai-confirm viloyatni tumandan oladi); «Yangi buyurtmalar» yon kartasi (nCAFnqIe / N12, MO-8; backend a3c67d0): GET orders/markets/:marketId/new — operator marketi (my-profile market_id, bo'lmasa market.id; biriktirilmagan — karta yo'q), qator → /orders/edit/:id, telefondagi havola-karta → /orders?status=new («Qabul va yaratish» market sahifalari operatorga yopiq). |

### courier — Kuryer

66 ta maket · kodda bor: 52 · kodda yo'q: 14

| Maket | Sarlavha | Tur | Route | Asosiy fayl | Holat |
|---|---|---|---|---|---|
| `courier-dashboard-home` | Bosh sahifa — kuryer statistikasi | sahifa | `/` | `src/pages/dashboard/DashboardPage.tsx` | v2 |
| `courier-dashboard-pwa-install` | Bosh sahifa — ilovani o'rnatish taklifi (bir marta, yopiladi) | sahifa | `/` | `src/features/pwa-install/ui/InstallAppCard.tsx` | v2 |
| `courier-dashboard-mobile-menu` | Menyu ochiq — yon panel / pastki varaq | oyna · faqat planshet + telefon | `(qobiq)` | `src/widgets/Sidebar/ui/MobileMenu.tsx` | v2 |
| `courier-dashboard-mobile-search` | Global qidiruv (telefon) | oyna · faqat telefon | `(qobiq)` | `src/widgets/header/ui/SearchScreen.tsx` | v2 |
| `courier-orders-pending` | Buyurtmalar — Kutilayotganlar | sahifa | `/orders` | `src/pages/orders/list/courier/index.tsx` | v2 |
| `courier-orders-pending-refreshing` | Buyurtmalar — Kutilayotganlar, yangilanmoqda | sahifa | `/orders` | `src/pages/orders/list/courier/index.tsx` | v2 |
| `courier-orders-pending-refresh-error` | Buyurtmalar — Kutilayotganlar, yangilanmadi | sahifa | `/orders` | `src/pages/orders/list/courier/index.tsx` | v2 |
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
| `courier-courier-bulk-scanner-camera` | Tezkor amal — kamera skaneri | oyna | `/courier-bulk` | `src/pages/courier-bulk/index.tsx` | qisman — Kamera v2 — markaziy «Skaner» (planshet/desktopda «Skanerlash») kamerani shu sahifa ustida ochadi (ega qarori 2026-10-19: oqim ichidagi «Kamera bilan skanerlash» / «Kamera» tugmasi yo'q); skan USB bilan bitta handler, kamera har skandan keyin yopilmaydi. Kamera ichida «Bekor / Ertaga» rejimi (sahifadagi bilan bitta), «N / M ta skanerlandi», ro'yxat; yakunlash — sahifadagi «Kunni yakunlash». |
| `courier-courier-bulk-scanner-camera-list` | Tezkor amal — kamera, skanerlanganlar ro'yxati | oyna · faqat telefon | `/courier-bulk` | `src/pages/courier-bulk/index.tsx` | qisman — Kamera v2 — markaziy «Skaner» (planshet/desktopda «Skanerlash») kamerani shu sahifa ustida ochadi (ega qarori 2026-10-19: oqim ichidagi «Kamera bilan skanerlash» / «Kamera» tugmasi yo'q); skan USB bilan bitta handler, kamera har skandan keyin yopilmaydi. «Skanerlanganlar · N / M · K ta bekor, L ta ertaga» varag'i, «Bekor qilish» belgini oladi, «Skanerlanmagan N ta buyurtma sotilgan deb belgilanadi». |
| `courier-courier-bulk-confirm-dialog` | Kunni yakunlash — tasdiqlash oynasi | oyna | `/courier-bulk` | `src/pages/courier-bulk/index.tsx` | v2 |
| `courier-mails-today` | Pochta — Bugungi | sahifa | `/mails/today` | `src/pages/mails/components/todaysMails.tsx` | v2 |
| `courier-mails-tab-switcher-open` | Pochta — tab tanlash ochiq | sahifa · faqat telefon | `/mails/today` | `src/pages/mails/index.tsx` | v2 |
| `courier-mails-refused` | Pochta — Rad etilgan | sahifa | `/mails/refused` | `src/pages/mails/components/refusedMails.tsx` | v2 |
| `courier-mails-old` | Pochta — Eski | sahifa | `/mails/old` | `src/pages/mails/components/oldMails.tsx` | v2 |
| `courier-mails-detail-receive` | Pochta tafsiloti — qabul qilish | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | v2 |
| `courier-mails-detail-receive-camera` | Pochta tafsiloti — qabul qilish — kamera | oyna | `/mails/:id` | `src/pages/mails/detail/index.tsx` | qisman — Kamera v2 — markaziy «Skaner» (planshet/desktopda «Skanerlash») kamerani shu sahifa ustida ochadi (ega qarori 2026-10-19: oqim ichidagi «Kamera bilan skanerlash» / «Kamera» tugmasi yo'q); skan USB bilan bitta handler, kamera har skandan keyin yopilmaydi. Skan tanlaydi (jo'natish / qabul / rad etilganni qabul); pochtada yo'q kod — «Bu pochtada yo'q · rad etildi». Eski pochta va kuryerning rad etilgan pochtasida maqsad yo'q. |
| `courier-mails-detail-refused` | Pochta tafsiloti — rad etilgan (faqat o'qish) | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | v2 |
| `courier-mails-detail-old` | Pochta tafsiloti — eski (tarix) | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | v2 |
| `courier-mails-detail-print-menu` | Chop etish menyusi | oyna | `/mails/:id` | `src/shared/components/PrintModeSelect.tsx` | v2 |
| `courier-cashbox-my-all` | Kassa — Barcha tarix | sahifa | `/cash-box` | `src/pages/payments/components/MyCashboxPage.tsx` | v2 |
| `courier-cashbox-my-transfers` | Kassa — Oldi-berdi | sahifa | `/cash-box` | `src/pages/payments/components/MyCashboxPage.tsx` | v2 |
| `courier-cashbox-my-transfers-ack` | Kassa — Oldi-berdi · kvitansiya javobi | sahifa | `/cash-box` | `src/pages/payments/components/MyCashboxPage.tsx`, `src/pages/payments/components/PaymentAckBadge.tsx` | v2 |
| `courier-cashbox-history-detail` | Tranzaksiya tafsiloti | oyna | `/cash-box` | `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | v2 |
| `courier-regions-scoped` | Hududlar — o'z viloyatim | sahifa | `/regions` | `src/pages/region/ui/ScopedRegionView.tsx` | v2 |
| `courier-scan-camera` | Skaner — kamera | sahifa | `/scan` | `src/pages/scan/index.tsx` | v2 |
| `courier-scan-order-detail` | Skanerlangan buyurtma — O'zimga olish | sahifa | `/scan/:token` | `src/pages/scan/detail.tsx` | v2 |
| `courier-scan-package-detail` | Skanerlangan paket | sahifa | `/scan/:token` | `src/pages/scan/ui/ScanPackageDetail.tsx` | v2 |
| `courier-scan-post-detail` | Skanerlangan pochta | sahifa | `/scan/:token` | `src/pages/scan/ui/ScanPostDetail.tsx` | v2 |
| `courier-scan-not-found` | Skaner — topilmadi | sahifa | `/scan`, `/scan/:token` | `src/pages/scan/index.tsx`, `src/pages/scan/detail.tsx` | v2 |
| `courier-scan-starting` | Skaner — kamera ishga tushmoqda | sahifa | `/scan`, `/tg/scan` | `src/pages/scan/index.tsx`, `src/pages/tg-scan/index.tsx` | v2 |
| `courier-scan-permission-denied` | Skaner — kameraga ruxsat yo'q | sahifa | `/scan`, `/tg/scan` | `src/pages/scan/index.tsx`, `src/pages/tg-scan/index.tsx` | v2 |
| `courier-scan-active` | Skaner — skanerlanmoqda | sahifa | `/scan`, `/tg/scan` | `src/pages/scan/index.tsx`, `src/pages/tg-scan/index.tsx` | qisman — /scan kuryer «O'zimga olish» rejimi (skaner 3-bosqich, useCourierTake): kamera, chiroq chipi, «Oxirgi» qatori va «Ro'yxat» — «Sizga biriktirildi» / «Allaqachon sizda» / «Boshqa kuryerda», hisoblagich «N ta biriktirildi», «Tugatish» → xulosa. Farq: biriktirilganlar qurilma tarixiga («Oxirgi skanerlar · Shu qurilmada») yozilmaydi — keng ekranda ular «Skanerlanganlar» kartasida (shu sessiya); telefonda pastda «Chiroq» o'rnida «Tugatish» (chiroq tepada). |
| `courier-scan-success-flash` | Skaner — muvaffaqiyatli o'qildi | sahifa | `/scan`, `/tg/scan` | `src/pages/scan/index.tsx`, `src/pages/tg-scan/index.tsx` | v2 |
| `courier-scan-other-courier` | Skaner — boshqa kuryerga biriktirilgan | sahifa | `/scan/:token`, `/tg/scan` | `src/pages/scan/detail.tsx`, `src/pages/tg-scan/index.tsx` | qisman — /scan/:token — alohida holat yo'q, «O'zimga olish» rad etilsa backend matni amallar kartasida (ScanActionCard). Kamera ekrani — /scan kuryer «O'zimga olish» rejimi (skaner 3-bosqich): qizil xabar «Boshqa kuryerga biriktirilgan» + izoh «№… · <kuryer>. Menejerga xabar bering.» (raqam va kuryer buyurtmani bir marta o'qib olingach, xabar ovozsiz yangilanadi), ro'yxatda qizil UserX qator «Boshqa kuryerda: <ism>», xulosada «Biriktirilmadi». Maketdagi keng ekran «Natija» kartasi (mijoz, summa, «Biriktirilgan kuryer») yo'q — natija «Skanerlanganlar» kartasida. |
| `courier-scan-invalid` | Skaner — noto'g'ri QR | sahifa | `/scan`, `/tg/scan` | `src/pages/scan/index.tsx`, `src/pages/tg-scan/index.tsx` | v2 |
| `courier-scan-too-fast` | Skaner — juda tez | sahifa | `/scan` | `src/pages/scan/index.tsx` | v2 |
| `courier-scan-offline` | Skaner — internet yo'q (navbat) | sahifa | `/scan` | `src/pages/scan/index.tsx` | yangi (kodda yo'q) — Oflayn chip bor («Internet yo'q»); skanlarni navbatga qo'yish yo'q. |
| `courier-scan-manual-entry` | Skaner — kodni qo'lda kiritish | sahifa | `/scan` | `src/pages/scan/index.tsx` | qisman — «Kodni qo'lda kiriting» varag'i v2 (token yoki /scan/<token> havolasi, «Ochish»); maketdagi raqamli klaviatura va «Harflar» yo'q — buyurtma raqami bo'yicha qidiruv API'si yo'q, ega qarori kutiladi. |
| `courier-inbox-list` | Bildirishnomalar | sahifa | `/inbox` | `src/pages/notifications/ui/NotificationInboxPage.tsx` | v2 |
| `courier-inbox-push-explain-dialog` | Bildirishnomalarni yoqish oynasi | oyna | `/inbox` | `src/features/push-notifications/ui/PushExplainDialog.tsx` | v2 |
| `courier-inbox-pwa-install` | Bildirishnomalar — ilovani o'rnatish taklifi (Android / kompyuter) | sahifa | `/inbox` | `src/features/pwa-install/ui/InstallAppCard.tsx` | v2 |
| `courier-inbox-pwa-ios-dialog` | Bosh ekranga qo'shish oynasi (iPhone / iPad) | oyna · faqat planshet + telefon | `/inbox` | `src/features/pwa-install/ui/IosInstallDialog.tsx` | v2 |
| `courier-cashbox-history-detail-corrected` | Tranzaksiya tafsiloti · qaytarilgan to'lov (sabab bilan) | oyna | `/cash-box` | `src/pages/payments/components/MyCashboxPage.tsx` | yangi (kodda yo'q) — T6 (Env2iYq1) pul qaytarish / summani tahrirlash — kodda yo'q: kuryerga «Qaytarildi» va blok (sabab ko'rinadi). |
| `courier-cashbox-my-transfers-corrected` | Kassa — Oldi-berdi · qaytarilgan to'lov belgilari | sahifa | `/cash-box` | `src/pages/payments/components/MyCashboxPage.tsx` | yangi (kodda yo'q) — T6 (Env2iYq1) pul qaytarish / summani tahrirlash — kodda yo'q: MyCashboxPage (kuryer, «Oldi-berdi» tabi payment_reversal ni ham ko'rsatadi) — «Qaytarildi», «Teskari yozuv». |
| `courier-dashboard-home-contacts` | Bosh sahifa — «Viloyatingiz logisti» kartasi | sahifa | `/` | `src/pages/dashboard/MarketDashboardPage.tsx + src/pages/dashboard/LogistDashboardPage.tsx + src/pages/investor/InvestorDashboardPage.tsx + src/pages/dashboard/DashboardPage.tsx + src/shared/ui/Forbidden.tsx` | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F3 ContactCard (useMyContacts, GET /users/me/contacts) — KPI qatoridan keyin. |
| `courier-profile-contacts` | Profil — «Viloyatingiz logisti» kartasi | sahifa | `/profile` | `src/pages/profile/ui/ProfilePage.tsx` | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F3 ContactCard ProfilePage da (kuryer, menejer). |
| `courier-orders-detail-contacts` | Buyurtma tafsilotlari — «Muammo bo'lsa» qatori, market telefonisiz | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F2 OrderMeta — «Market» qatorida telefon yo'q, yangi «Muammo bo'lsa» (Headset, problem_contacts, tel:). |
| `courier-dashboard-user-menu-contacts` | Profil menyusi — «Aloqa» bandi (taklif) | sahifa | `(qobiq)` | `src/widgets/layout/dashboardLayout.tsx` | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: F3 UserMenu «Aloqa» — shell, faqat ega roziligi bilan (taklif). |
| `courier-dashboard-mobile-menu-contacts` | Menyu varag'i — «Aloqa» bandi (taklif) | oyna · faqat planshet + telefon | `(qobiq)` | `src/widgets/layout/dashboardLayout.tsx` | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: MobileMenu «Aloqa» qatori — shell, faqat ega roziligi bilan (taklif). |
| `courier-dashboard-contacts-dialog` | «Aloqa» oynasi — profil menyusidan (taklif) | oyna | `(qobiq)` | `src/widgets/layout/dashboardLayout.tsx` | yangi (kodda yo'q) — T7 (eRhiuIVj) aloqa raqamlari — kodda yo'q: «Aloqa» bandi ochadigan Dialog (ContactCard tanasi) — taklif. |
| `courier-orders-pending-special-categories` | Buyurtmalar — Kutilayotganlar, maxsus belgilar | sahifa | `/orders` | `src/pages/orders/index.tsx` | yangi (kodda yo'q) — T8 (EcD6EHTH) maxsus belgilar — kodda yo'q: SpecialCategoryTags (2 ta + «+N», to'liqi aria-label da) kuryer ro'yxatlarida (orders/list/courier/list/ordertable/*) — holat ustunida va telefon kartasida; kuryer belgini o'zgartirmaydi. |
| `courier-scan-order-detail-special-categories` | Skanerlangan buyurtma — maxsus belgilar | sahifa | `/scan/:token` | `src/pages/scan/detail.tsx` | yangi (kodda yo'q) — T8 (EcD6EHTH) maxsus belgilar — kodda yo'q: scan/detail.tsx (ScanOrderResult) — holat qatorida SpecialCategoryTags (ORDER_SCAN_LIGHT_SELECT / ORDER_FIELDS da special_categories); xodim skanida ham shunday. |
| `courier-orders-detail-special-categories` | Buyurtma tafsilotlari — maxsus belgilar (faqat ko'rish) | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | yangi (kodda yo'q) — T8 (EcD6EHTH) maxsus belgilar — kodda yo'q: kuryer — belgilar ko'rinadi, «O'zgartirish» yo'q (PUT → 403), «Maxsus yorliq chop etish» bor; telefonda belgilar To'lov kartasidagi holat qatorida. |
| `courier-mails-detail-print-menu-special` | Chop etish menyusi — «Faqat maxsus yorliqlar» | oyna | `/mails/:id` | `src/pages/mails/detail/index.tsx` | yangi (kodda yo'q) — T8 (EcD6EHTH) maxsus belgilar — kodda yo'q: ui/printOptions.tsx — «Faqat maxsus yorliqlar» (mails.json printOptions.categoriesOnly), oyna ochadi; buyurtma cheklari (brauzer · PDF 100×60 · A4) ichida maxsus yorliqlar avtomatik. |
| `courier-mails-detail-print-menu-special-disabled` | Chop etish menyusi — «Faqat maxsus yorliqlar» o'chiq (belgisiz tanlov) | oyna | `/mails/:id` | `src/pages/mails/detail/index.tsx` | yangi (kodda yo'q) — T8 (EcD6EHTH) maxsus belgilar — kodda yo'q: tanlovda maxsus belgi yo'q — band aria-disabled + izoh «Tanlanganlarda maxsus belgi yo'q» (PrintModeSelect option.disabled). |

### logist — Logist

10 ta maket · kodda bor: 3 · kodda yo'q: 7

| Maket | Sarlavha | Tur | Route | Asosiy fayl | Holat |
|---|---|---|---|---|---|
| `logist-dashboard-main` | Bosh sahifa — viloyatlarim | sahifa | `/` | `src/pages/dashboard/LogistDashboardPage.tsx` | qisman — Kodda bor (LG-1): sarlavha + biriktirilgan viloyatlar, davr (Bugun · Bu hafta · Bu oy · Barchasi + sana), KPI (Jami, Sotilgan, Bekor, Faol kuryerlar a/b), «Muvaffaqiyat darajasi», «Viloyatlar muvaffaqiyati», «Viloyatlarim» jadvali (telefonda kartalar), holatlar (yuklanish, xato, internet yo'q — «Internet aloqasi yo'q», viloyat yo'q). Ma'lumot — GET region/stats/all + klientda logist_id = me (backend iOnGbEqi gacha). Farq: «So'nggi buyurtmalar» chizilmagan (logist buyurtmalari — backend 4BftLLnc, LG-4); «Faol kuryerlar» — backend status = 'active' (maketdagi «bugun buyurtmasi bor» soni API'da yo'q, izoh «Faol holatdagi kuryerlar» — ega savoli); «Viloyatlar muvaffaqiyati» — umumiy HBarList emas, sahifa ichidagi Meter ro'yxati (LogistRegionSuccessCard: HBarList'da maqsad chizig'i yo'q, maketda 70% belgisi); davr tablaridagi sonlar yo'q (API bermaydi — ega savoli); foizlarda oxirgi nol tushadi («75%», maketda «75,0%» — umumiy formatPercentLocalized qoidasi, butun ilova bo'yicha qaror). |
| `logist-dashboard-mobile-menu` | Menyu ochiq — yon panel / pastki varaq | oyna · faqat planshet + telefon | `/` | `src/widgets/Sidebar/ui/MobileMenu.tsx` | qisman — Kodda bor (LG-1): telefon varaqasi / planshet paneli — profil (rol «Logist»), «Bosh sahifa», «Hududlar» (LG-3), Bildirishnomalar (+ son), Sozlamalar, Chiqish; pastki menyu — «Bosh sahifa» · «Hududlar» · «Menyu». Farq: menyu qidiruvi yo'q (buyurtmalar ochilmaguncha — LG-4/LG-6); «Hududlar» — LG-3 da (pastki menyuda ham katak); Buyurtmalar, Pochta, Paketlar, Kuryerlar bandlari o'z sahifasi bilan (LG-4, LG-5); personadagi «· 4 viloyat» yo'q. |
| `logist-dashboard-mobile-search` | Global qidiruv (telefon) — buyurtma, mijoz, telefon | oyna · faqat telefon | `/` | `src/pages/dashboard/MarketDashboardPage.tsx + src/pages/dashboard/LogistDashboardPage.tsx + src/pages/investor/InvestorDashboardPage.tsx + src/pages/dashboard/DashboardPage.tsx + src/shared/ui/Forbidden.tsx` | yangi (kodda yo'q) — Logist roli kodda hali yo'q (dzyVftBx, mDfjKeQi); ega javobi LG-S1..S3 (2026-10-19) — faqat ko'rish, moliyasiz. |
| `logist-orders-list` | Buyurtmalar — faqat ko'rish | sahifa | `/orders` | `src/pages/orders/index.tsx` | yangi (kodda yo'q) — Logist roli kodda hali yo'q (dzyVftBx, mDfjKeQi); ega javobi LG-S1..S3 (2026-10-19) — faqat ko'rish, moliyasiz. |
| `logist-orders-detail` | Buyurtma tafsiloti va kuzatuv — faqat ko'rish | sahifa | `/orders/edit/:orderId` | `src/pages/new_orders/components/new_orderUpdate.tsx` | yangi (kodda yo'q) — Logist roli kodda hali yo'q (dzyVftBx, mDfjKeQi); ega javobi LG-S1..S3 (2026-10-19) — faqat ko'rish, moliyasiz. |
| `logist-mails-list` | Pochta — viloyatlarim pochtalari | sahifa | `/mails/today` | `src/pages/mails/index.tsx` | yangi (kodda yo'q) — Logist roli kodda hali yo'q (dzyVftBx, mDfjKeQi); ega javobi LG-S1..S3 (2026-10-19) — faqat ko'rish, moliyasiz. |
| `logist-mails-detail` | Pochta tafsiloti — faqat ko'rish | sahifa | `/mails/:id` | `src/pages/mails/detail/index.tsx` | yangi (kodda yo'q) — Logist roli kodda hali yo'q (dzyVftBx, mDfjKeQi); ega javobi LG-S1..S3 (2026-10-19) — faqat ko'rish, moliyasiz. |
| `logist-batches-list` | Paketlar — viloyatlarimga | sahifa | `/batches` | `src/pages/batches/ui/BatchesPage.tsx` | yangi (kodda yo'q) — Logist roli kodda hali yo'q (dzyVftBx, mDfjKeQi); ega javobi LG-S1..S3 (2026-10-19) — faqat ko'rish, moliyasiz. |
| `logist-couriers-list` | Kuryerlar — viloyatlarim | sahifa | `/regions` | `src/pages/region/index.tsx` | yangi (kodda yo'q) — Logist roli kodda hali yo'q (dzyVftBx, mDfjKeQi); ega javobi LG-S1..S3 (2026-10-19) — faqat ko'rish, moliyasiz. |
| `logist-regions-detail` | Viloyat — tumanlar va kuryerlar | sahifa | `/regions` | `src/pages/region/ui/LogistRegionView.tsx`, `src/pages/region/ui/LogistRegionCouriers.tsx` | qisman — Kodda bor (LG-3): /regions logist ko'rinishi — viloyat tanlovi (?region=), davr, spidometr, umumiy ko'rsatkichlar, tumanlar taxtasi (Grafik \| Jadval) va «Tanlangan tuman», «Tumanlar kesimida», «Kuryerlar» top 5, holatlar (yuklanish, xato, «Bu viloyat endi sizga biriktirilmagan», tumanlar yo'q, viloyat biriktirilmagan). Farq: «Tuman buyurtmalari» (logist buyurtmalari — LG-4) va «Barcha kuryerlar» (/couriers — LG-5) yashirin; «Faol kuryerlar» — backend status = 'active' (maketdagi «bugun buyurtmasi bor» soni API'da yo'q — LG-1 qarori, izoh «Faol holatdagi kuryerlar»); tuman kataklari shkalasi 4 pog'ona (ilovadagi region-map tokenlari; maketda 5); 5 tadan ko'p viloyatda desktopda ham Select. |

### investor — Investor

13 ta maket · kodda bor: 13 · kodda yo'q: 0

| Maket | Sarlavha | Tur | Route | Asosiy fayl | Holat |
|---|---|---|---|---|---|
| `investor-dashboard-home` | Bosh sahifa — investor kabineti | sahifa | `/` | `src/pages/investor/InvestorDashboardPage.tsx` | qisman — Kodda bor (IN-1): KPI, «Oylik foyda» (6 · 12 · 24 oy, Grafik \| Jadval, StackedBars), «So'nggi investitsiyalar», «Foyda tarixi». «Barchasi» → /investments, /profits (IN-2). Farq: yuqori paneldagi qidiruv investorda yo'q (ROL-0). |
| `investor-dashboard-home-table` | Bosh sahifa — oylik foyda jadvali | sahifa | `/` | `src/pages/investor/ui/MonthlyProfitCard.tsx` | v2 |
| `investor-dashboard-loading` | Bosh sahifa — yuklanmoqda | sahifa | `/` | `src/pages/investor/InvestorDashboardPage.tsx` | v2 |
| `investor-dashboard-empty` | Bosh sahifa — ma'lumot yo'q | sahifa | `/` | `src/pages/investor/InvestorDashboardPage.tsx` | v2 |
| `investor-dashboard-error` | Bosh sahifa — yuklash xatosi | sahifa | `/` | `src/pages/investor/InvestorDashboardPage.tsx` | v2 |
| `investor-dashboard-forbidden` | Bosh sahifa — profil nofaol (403) | sahifa | `/` | `src/pages/investor/ui/InvestorAccessState.tsx` | v2 |
| `investor-dashboard-not-linked` | Bosh sahifa — profil bog'lanmagan (404) | sahifa | `/` | `src/pages/investor/ui/InvestorAccessState.tsx` | v2 |
| `investor-investments-list` | Investitsiyalar | sahifa | `/investments` | `src/pages/investor/InvestmentsPage.tsx` | v2 |
| `investor-profits-list` | Foyda tarixi | sahifa | `/profits` | `src/pages/investor/ProfitsPage.tsx` | v2 |
| `investor-dashboard-mobile-menu` | Menyu ochiq — yon panel / pastki varaq | oyna · faqat planshet + telefon | `(qobiq)` | `src/widgets/Sidebar/ui/MobileMenu.tsx` | v2 |
| `investor-investments-list-loading` | Investitsiyalar — yuklanmoqda | sahifa | `/investments` | `src/pages/investor/InvestmentsPage.tsx` | v2 |
| `investor-investments-list-filtered-empty` | Investitsiyalar — filtr bo'yicha bo'sh | sahifa | `/investments` | `src/pages/investor/InvestmentsPage.tsx` | v2 |
| `investor-profits-list-filtered-empty` | Foyda tarixi — filtr bo'yicha bo'sh | sahifa | `/profits` | `src/pages/investor/ProfitsPage.tsx` | v2 |

### umumiy ekranlar (common — barcha rollar)

20 ta maket · kodda bor: 19 · kodda yo'q: 1

| Maket | Sarlavha | Tur | Route | Asosiy fayl | Holat |
|---|---|---|---|---|---|
| `common-login` | Tizimga kirish | sahifa | `/login` | `src/features/auth/index.tsx` | v2 |
| `common-login-error` | Tizimga kirish — xato holati | sahifa | `/login` | `src/features/auth/index.tsx` | v2 |
| `common-session-expired` | Sessiya tugadi | sahifa | `/login` | `src/features/auth/index.tsx` | v2 |
| `common-settings-appearance` | Sozlamalar — Ko'rinish | sahifa | `/settings` | `src/pages/settings/ui/SettingsPage.tsx` | v2 |
| `common-settings-dashboard` | Sozlamalar — Bosh sahifa bloklari | sahifa | `/settings` | `src/pages/settings/ui/SettingsPage.tsx` | v2 |
| `common-settings-interface` | Sozlamalar — Interfeys | sahifa | `/settings` | `src/pages/settings/ui/SettingsPage.tsx` | v2 |
| `common-settings-scanner` | Sozlamalar — Skaner (kamera va ovoz) | sahifa | `/settings` | `src/pages/settings/ui/SettingsPage.tsx` | v2 |
| `common-settings-notifications` | Sozlamalar — Bildirishnomalar | sahifa | `/settings` | `src/pages/settings/ui/SettingsPage.tsx` | v2 |
| `common-settings-notifications-pwa` | Sozlamalar — Bildirishnomalar · ilova o'rnatilgan / o'rnatilmagan | sahifa | `/settings` | `src/features/pwa-install/ui/AppInstallStatusBlock.tsx` | v2 |
| `common-profile` | Profil | sahifa | `/profile` | `src/pages/profile/ui/ProfilePage.tsx` | v2 |
| `common-profile-password-dialog` | Profil — parolni o'zgartirish | oyna | `/profile` | `src/pages/profile/ui/ChangePasswordDialog.tsx` | v2 |
| `common-profile-telegram` | Profil — Telegram ulanmagan | sahifa | `/profile` | `src/features/telegram-link/ui/TelegramLinkCard.tsx` | v2 |
| `common-profile-telegram-link-dialog` | Profil — Telegram'ni ulash (havola, QR, muddat) | oyna | `/profile` | `src/features/telegram-link/ui/TelegramLinkDialog.tsx` | v2 |
| `common-profile-telegram-expired-dialog` | Profil — Telegram havolasi eskirdi | oyna | `/profile` | `src/features/telegram-link/ui/TelegramLinkDialog.tsx` | v2 |
| `common-profile-telegram-command-dialog` | Profil — Telegram'ni ulash (bot nomi yo'q: buyruq) | oyna | `/profile` | `src/features/telegram-link/ui/TelegramLinkDialog.tsx` | v2 |
| `common-profile-telegram-linked` | Profil — Telegram ulangan (+ «Telegram ulandi» xabari) | sahifa | `/profile` | `src/features/telegram-link/ui/TelegramLinkCard.tsx` | v2 |
| `common-profile-telegram-unlink-dialog` | Profil — Telegram'ni uzish (tasdiq) | oyna | `/profile` | `src/features/telegram-link/ui/TelegramLinkCard.tsx` | v2 |
| `common-inbox` | Bildirishnomalar qutisi | sahifa | `/inbox` | `src/pages/notifications/ui/NotificationInboxPage.tsx` | v2 |
| `common-bell-dropdown` | Qo'ng'iroqcha ochiq (so'nggi bildirishnomalar) | oyna | `(qobiq)` | `src/widgets/header/ui/NotificationsMenu.tsx` | v2 |
| `common-settings-scanner-feedback` | Sozlamalar — Skaner: rangli effekt va ovozlar | sahifa | `/settings` | `src/pages/settings/ui/SettingsPage.tsx` | yangi (kodda yo'q) — Trello 2026-10-23 (ega topshirig'i), 5-band: to'liq ekran rangli effekt, ovoz to'plami, balandlik, sinab ko'rish (ScannerPanel). Dizayn ega tasdig'idan keyin kodga o'tadi. |

## 5. Dizayn tizimi taxtalari

Sahifa emas — qoidalar va komponent holatlari. Har UI ishida tegishli taxtani ko'ring (`npm run design:shot -- <taxta>`).

| Taxta | Sarlavha | Nimani belgilaydi | Kodda | Qayerda qo'llanadi |
|---|---|---|---|---|
| `Main` | Dizayn tizimi | Tamoyillar (rang = ma'no, bitta asosiy amal, faqat token), rang tokenlari (sirt, chiziq, matn, brend, amal, holat), tipografiya, 4px oraliq, radius, tugmalar, maydonlar, holat belgilari (buyurtma, yetkazish, foydalanuvchi), tab/segment/chip, statistika va jadval, xabar bloklari, tasdiqlash oynasi, bo'sh holat, format standarti. | src/index.css (@theme), src/shared/config/themeTokens.ts, src/shared/lib/formatMoney.ts, docs/DESIGN_SYSTEM.md; 1-bosqich primitivlari (Button, Badge/StatusBadge, Card/StatCard, PageHeader, Tabs) | barcha sahifalar |
| `tizim-icons` | Ikonkalar katalogi | lucide ikonkalar katalogi: 12 guruh, o'lchamlar (16/18/20/22), rang va tugmadagi ikonka, eski sinonimlarni almashtirish jadvali. | design/icon-registry.json, lucide-react | barcha sahifalar |
| `tizim-responsive` | Moslashuvchanlik — telefon, planshet, desktop | Breakpointlar (≥1024 · 768–1023 · <768), bitta sahifa uch kenglikda, dialog → pastdan oyna, yon/suriluvchi/pastki menyu, 70px yorliq qoidasi, yashirish sinflari, jadval o'rami, ≥44px bosish maydoni, asosiy amal pastda. | src/widgets/Sidebar/ui/{Sidebar,BottomNav,MobileMenu}.tsx, src/widgets/layout/dashboardLayout.tsx, docs/DESIGN_SYSTEM.md §6 | `(qobiq)` |
| `tizim-scanner` | Kamera skaner — telefon kamerasi bilan skanerlash | Kamera va USB skaner qachon, kirish nuqtalari (pastki menyu «Skaner», yuqori panel «Skanerlash»), kamera anatomiyasi, barcha holatlar (ruxsat, ishga tushmoqda, tayyor, topildi, takroriy, topilmadi, noto'g'ri QR, boshqa kuryerniki, juda tez, kam yorug'lik, chiroq, oflayn navbat, kamera band, qo'lda kiritish), uzluksiz skanerlash (hisoblagich, ro'yxat, tugatish), desktop veb-kamera + USB. | src/shared/ui/camera/{ScannerCamera,CameraSurface,useScannerCameraSession,cameraPermission}.ts(x), src/shared/lib/scanner/{scanTargets,scannerHost,feedback}.ts, src/widgets/scanner/ScannerHost.tsx, src/pages/scan/*, src/shared/lib/{useCameraQrScanner,useKeyboardScanner,useOrderQrScanner,qrScanner}.ts | `/new-orders/incoming/:marketId`, `/new-orders/branches/:branchId/batches/:batchId`, `/new-orders/cancelled/:marketId`, `/new-orders/:marketId`, `/mails/:id`, `/batches/:id`, `/dispatch`, `/courier-bulk`, `/scan`, `/scan/:token`, `/tg/scan` |
| `tizim-charts` | Grafiklar — statistika va tahlil | Qaysi grafik qachon, kategorial palitra (chart-1…8, kunduzgi/tungi), ketma-ket va ikki qutbli shkalalar, holat ranglari, grafik anatomiyasi, galereya (spidometr, donut, KPI, chiziq, ustunlar, reyting, issiqlik xaritasi, xarita, sharshara, voronka, sparkline), holatlar (yuklanmoqda, bo'sh, xato), «Grafik \| Jadval» egizagi, telefon. | src/shared/ui/charts (Gauge, Donut, RankList, Meter, SegBar, HBarList, Waterfall, RingStat, ChartLegend, ChartNote, ViewToggle, DeltaChip), CHART_PALETTE (src/shared/config/themeTokens.ts), src/widgets/dashboard-*/*, src/widgets/financial-analysis/* (recharts — faqat FinancialTrendPlot), src/pages/region/ui/UzbekistanRegionMap.tsx, docs/DESIGN_SYSTEM.md §3 | `/`, `/branch-dashboard`, `/financial-balance`, `/regions` |
| `tizim-states-buttons` | Holatlar — tugmalar va havolalar | Tugma va havolalar: 12 tur × 6 holat, o'lchamlar (32/40/48), tugmalar guruhi, forma/oyna oxiri, sahifa sarlavhasi, xavfli juftlik, telefon pastki paneli, qilinmaydigan narsalar. | src/shared/components/button.tsx (1-bosqich: Button, IconButton) | barcha sahifalar |
| `tizim-states-forms` | Holatlar — forma elementlari | Forma elementlari: matn maydoni holatlari, qidiruv, telefon, son, ko'p qatorli matn, tanlash ro'yxati (yopiq/ochiq/ko'p tanlov), sana oralig'i, katak/radio/kalit/tanlov kartasi, fayl yuklash, forma xatolari xulosasi. | src/shared/ui/{Select,SearchableSelect,PhoneInput,DateRangePicker,Filter*,Toggle}.tsx, antd mavzusi (src/app/providers/theme) — 3-bosqich | barcha sahifalar |
| `tizim-states-navigation` | Holatlar — navigatsiya | Yon menyu (248/72px) va band holatlari, yuqori panel, qidiruv holatlari, tablar/segment/filtr chiplari, sahifalash, «orqaga» havolasi, «…» menyusi, maslahat, popover, telefon navigatsiyasi. | src/widgets/Sidebar/*, src/widgets/header/*, src/shared/components/pagination, src/shared/ui/BackButton.tsx | `(qobiq)` |
| `tizim-states-data` | Holatlar — jadval, ro'yxat, kartalar | Jadval: ustun sarlavhasi va saralash, qator holatlari va ommaviy tanlash, qator menyusi, ochiladigan qator, katak qoidalari va nusxa olish, telefon ro'yxat kartalari, ko'rsatkich kartalari, holat belgilarining to'liq to'plami (buyurtma, yetkazish, foydalanuvchi, to'lov, integratsiya, jurnal), sonlar. | src/shared/components/Table, src/shared/ui/{StatusBadge,MetricCard,TableSkeleton}.tsx | `/orders`, `/activity-logs` |
| `tizim-loading` | Yuklanish holatlari | Kutish vaqti bo'yicha qoida (hech narsa → yuqori chiziq → skelet → sekin izohi → xato va qayta urinish), sahifa skeletlari (ro'yxat, hisoblagich, tafsilot, bosh sahifa), tugma yuklanishi, fayl yuklash, tanlov ichida spinner, «ko'proq yuklash», fon yangilanishi, telefonda tortib yangilash. | src/shared/ui/{PageLoader,Loader,TableSkeleton,QueryErrorState,DeferredMount}.tsx, MetricCardSkeleton | barcha sahifalar |
| `tizim-feedback` | Bildirishnoma va ogohlantirishlar | Qalqib chiquvchi xabarlar (4 ton, amal bilan, qayta urinish; desktop pastki o'ngda ≤3, telefonda tepada bittadan), xabar bloklari, sahifa bannerlari (internet, sessiya), forma xatolari xulosasi, tasdiqlash oynalari (o'chirish, pul o'tkazish, nofaol qilish, push ruxsati), amal natijasi (to'liq/qisman), skaner signali. | src/app/providers/notification/NotificationProvider.tsx, src/shared/components/popupConfirm.tsx, src/auth/SessionExpiryCountdown.tsx, src/shared/components/ScanFeedbackOverlay.tsx | barcha sahifalar |
| `tizim-errors` | Xato va bo'sh holatlar | Sahifa xatolari (404, 403, 500, ilova xatosi) va ro'yxat/karta ichidagi holatlar (yuklanmoqda, bo'sh, natija yo'q, yuklanmadi, internet yo'q, ruxsat yo'q, bo'lim xatosi), xato xabarlari. | src/shared/ui/{NotFound,Forbidden,ServerError,ErrorBoundaryPage,EmptyState,QueryErrorState}.tsx, src/shared/ui/primitives/{QueryBoundary,ErrorState}.tsx, src/shared/ui/error-page/ | `/403`, `/404`, `/500`, `/runtime-error`, `/*` |
| `tizim-motion` | Harakat, fokus va kirish qulayligi | Davomiylik shkalasi, egri chiziqlar, ochilish kadrlari (oyna, pastki oyna, xabar), harakatni kamaytirish, fokus halqasi, klaviatura tartibi, bosish maydoni, kontrast juftliklari, z-index shkalasi. | src/index.css (:focus-visible, animatsiyalar), docs/DESIGN_SYSTEM.md §9 | barcha sahifalar |
| `tizim-shift-report-messages` | Smena hisoboti — Telegram va tizim xabarlari | Smena yopilganda (qo'lda yoki avtomatik) superadmin, kuryer va marketga Telegram va tizim orqali yuboriladigan xabarlar: matnlar, ilova (PDF/Excel), avtomatik yopilganda variant, hodisa → qabul qiluvchi → kanal jadvali. | taklif — kodda yo'q (notification-service finance.shift_closed / finance.shift_auto_closed) | barcha sahifalar |
| `tizim-scan-feedback` | Skaner natijasi — to'liq ekran rang effekti va ovozlar | Skaner natijasi: to'liq ekran yashil / sariq / qizil qatlam (telefon, kamera, desktop USB), vaqt va harakat, reduced-motion, yangi ovozlar va tebranish spetsifikatsiyasi, holat → rang qoidalari. | src/shared/lib/scanner/feedback.ts, src/shared/components/ScanFeedbackOverlay.tsx, src/shared/ui/camera/ (o'zgarishi kerak — ega tasdig'idan keyin) | barcha sahifalar |
| `tizim-receipts` | Chek va paket cheki — yangi dizayn | Buyurtma cheki (termal 100×60 mm), paket cheki, A4 varaq (12 ta), chop etish qoidalari (shrift, QR, qisqartirish), hozir → yangi farqlari. | src/features/print-receipts (HJ5sLHiz: buyurtma cheki termal 100×60 va A4, paket / pochta cheki termal va A5, lokal QR); kirish nuqtalari — src/pages/new_orders/components/new_orderDetail.tsx, src/pages/mails/detail/lib/printMode.ts, src/pages/mails/components/oldMails.tsx, src/pages/batches/ui/BatchDetailPage.tsx | barcha sahifalar |
| `tizim-product-labels` | Mahsulot stikeri — QR va shtrix kod (40×30, 58×40) | Mahsulot stikeri: Elchi kodi ELC-P-… (QR) va zavod shtrix kodi (EAN-13), 40×30 va 58×40 mm termal yorliq, chop etish va skanerlash qoidalari. | src/pages/products/model/productLabelPrint.ts (mahsulot tahririda «QR stiker chop etish», yXC91RRx) | barcha sahifalar |
| `tizim-contact-card` | Aloqa kartasi va «Muammo bo'lsa» — holatlar | Aloqa kartasi (ContactCard): «Viloyatingiz logisti» (kuryer, menejer) va «Elchi mas'ulingiz» (market, market operatori) — anatomiya, joylar (bosh sahifa, profil, profil menyusi), holatlar (to'liq, bir nechta raqam, umumiy raqam, belgilanmagan, yuklanish, xato, oflayn «Oxirgi ma'lumot», nusxalandi); buyurtma tafsilotidagi «Muammo bo'lsa» / «Elchi mas'ulingiz» qatori; kim nimani ko'radi (market telefoni menejer, filial va kuryerga yo'q). | src/entities/contacts (useMyContacts, ContactCard — yangi), src/widgets/order-meta/ui/OrderMeta.tsx, src/widgets/header/ui/UserMenu.tsx (taklif), locales */common.json → contacts.* | `/`, `/branch-dashboard`, `/orders/edit/:orderId`, `/profile` |
| `tizim-receipts-contact` | Chek — «Muammo bo'lsa» raqami (viloyat logisti) | Chekdagi «Muammo bo'lsa»: buyurtma viloyati logist(lar)i raqami (1–2 ta, «, » bilan) → umumiy raqamlar; ikkalasi ham yo'q — o'ng qism chiqmaydi («-» yozilmaydi); market va operator raqami yorliqqa chiqmaydi; 100×60 va A4 (12 ta) namunalari. | src/pages/new_orders/components/lib/receiptContact.ts (getReceiptContactPhone → problem_contacts), printLabelPdf.ts, src/pages/mails/detail/lib/printMode.ts | barcha sahifalar |
| `tizim-category-labels` | Maxsus yorliq — kategoriya belgisi (100×60, A4, tartib) | Maxsus yorliq (kategoriya belgisi): 7 ta belgi — Sinadigan, Diniy kitob, Suyuqlik, Tez buziladigan, Elektronika (batareyali), Og'ir yuk, Hujjat (kanonik tartib); termal 100×60, faqat qora, katta ikonka, o'zbekcha + ruscha matn (ilova tilidan qat'i nazar), pastda «№EL-… · 1/2», QR yo'q; ko'rinish — chapda qora plitada ikonka (ega tanlovi, 2026-10-29); A4 (12 ta) da buyurtma katagidan keyingi kataklar; chop etish tartibi (chek → uning maxsus yorliqlari → keyingi buyurtma); «Faqat maxsus yorliqlar» va nusxa soni. | src/entities/order/model/specialCategories.ts (yangi), src/features/print-receipts (kategoriya yorlig'i — yangi; printOrderReceipts ketma-ketligi), src/features/order-special-categories (SpecialLabelPrintDialog — yangi), design/icon-registry.json «Maxsus belgilar» | `/orders/edit/:orderId`, `/new-orders/:marketId`, `/mails/:id` |

## 6. Fayl → route

Tegayotgan fayl qaysi route(lar)ga tegishli — o'sha route'ning maketlarini 2-bo'limdan oling.

| Fayl | Route(lar) |
|---|---|
| `src/app/lib/routes.tsx` | `/`, `/new-orders/cancelled/:marketId`, `/new-orders/:marketId`, `/new-orders/:marketId/edit/:orderId` |
| `src/auth/SessionExpiryCountdown.tsx` | `/login` |
| `src/auth/loginNotice.ts` | `/login` |
| `src/entities/activity-log/ui/ActivityActionBadge.tsx` | `/activity-logs` |
| `src/entities/batch/model/batchStatus.ts` | `/batches` |
| `src/entities/delivery-pricing/ui/DeliveryQuoteList.tsx` | `/products`, `/products/create-product/:id`, `/delivery-tariffs` |
| `src/entities/delivery-pricing/ui/MeasureWeights.tsx` | `/products`, `/products/create-product/:id`, `/delivery-tariffs` |
| `src/entities/delivery-pricing/ui/VolumetricSwitch.tsx` | `/products`, `/products/create-product/:id`, `/delivery-tariffs` |
| `src/entities/notification-campaign/ui/AudienceBuilder.tsx` | `/notifications/send` |
| `src/entities/notification-campaign/ui/AudienceSampleDialog.tsx` | `/notifications/send` |
| `src/entities/notification-campaign/ui/AudienceSummary.tsx` | `/notifications/send` |
| `src/entities/notification-campaign/ui/CustomerSegmentFilters.tsx` | `/notifications/sms` |
| `src/entities/notification-campaign/ui/SaveSegmentDialog.tsx` | `/notifications/send` |
| `src/entities/notification-dispatch/ui/SentDetailDialog.tsx` | `/notifications/send`, `/notifications/sent` |
| `src/entities/order/ui/FulfillmentSourceTag.tsx` | `/orders` |
| `src/entities/order/ui/ProofGallery.tsx` | `/orders/edit/:orderId` |
| `src/entities/order/ui/ReturnRequestedTag.tsx` | `/orders` |
| `src/entities/orders/ui/ExtraCostApprovalAlerts.tsx` | `/orders` |
| `src/entities/orders/ui/ExtraCostApprovalTag.tsx` | `/orders` |
| `src/entities/product/ui/ProductThumb.tsx` | `/products`, `/products/create-product/:id` |
| `src/entities/warehouse/ui/ProductCodeTag.tsx` | `/warehouses/:id` |
| `src/entities/warehouse/ui/WarehouseBadges.tsx` | `/warehouses` |
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
| `src/features/dispatch-basket/model/dispatchBasket.ts` | `/dispatch` |
| `src/features/notification-create/ui/NotificationFormModal.tsx` | `/notifications` |
| `src/features/notification-delete/ui/useDeleteNotificationConfirm.tsx` | `/notifications` |
| `src/features/notification-dispatch/ui/CampaignHistoryCard.tsx` | `/notifications/send` |
| `src/features/notification-dispatch/ui/CampaignProgressCard.tsx` | `/notifications/send` |
| `src/features/notification-dispatch/ui/CampaignReportDialog.tsx` | `/notifications/send` |
| `src/features/notification-dispatch/ui/CampaignScheduleCard.tsx` | `/notifications/send` |
| `src/features/notification-dispatch/ui/DispatchResultCard.tsx` | `/notifications/send` |
| `src/features/notification-dispatch/ui/DispatchUnknownCard.tsx` | `/notifications/send` |
| `src/features/notification-dispatch/ui/NotificationDispatchForm.tsx` | `/notifications/send` |
| `src/features/notification-dispatch/ui/useCampaignCancel.tsx` | `/notifications/send` |
| `src/features/notification-toggle/ui/useToggleNotificationConfirm.tsx` | `/notifications` |
| `src/features/order-return/ui/InitiateReturnModal.tsx` | `/orders/edit/:orderId` |
| `src/features/order-return/ui/MarkReturnedModal.tsx` | `/orders/edit/:orderId` |
| `src/features/order-tracking/ui/TrackingTimelineItem.tsx` | `/orders/edit/:orderId` |
| `src/features/print-receipts/index.ts` | `/new-orders/:marketId` |
| `src/features/push-notifications/ui/PushExplainDialog.tsx` | `/inbox` |
| `src/features/push-notifications/ui/PushPermissionButton.tsx` | `/settings`, `/inbox` |
| `src/features/pwa-install/ui/AppInstallStatusBlock.tsx` | `/settings` |
| `src/features/pwa-install/ui/InstallAppCard.tsx` | `/inbox`, `/` |
| `src/features/pwa-install/ui/IosInstallDialog.tsx` | `/settings`, `/inbox` |
| `src/features/telegram-link/ui/LinkCountdown.tsx` | `/notifications`, `/profile` |
| `src/features/telegram-link/ui/LinkQrPanel.tsx` | `/notifications`, `/profile` |
| `src/features/telegram-link/ui/MarketGroupLinkDialog.tsx` | `/all-users/:id`, `/profile` |
| `src/features/telegram-link/ui/TelegramLinkCard.tsx` | `/profile` |
| `src/features/telegram-link/ui/TelegramLinkDialog.tsx` | `/profile` |
| `src/features/telegram-link/ui/useMarketGroupLink.tsx` | `/all-users/:id` |
| `src/features/tg-scan/api/tgScanApi.ts` | `/tg/scan` |
| `src/features/tg-scan/model/telegramWebApp.ts` | `/tg/scan` |
| `src/features/tg-scan/model/useScanAssign.ts` | `/tg/scan` |
| `src/features/tg-scan/model/useTelegramAuth.ts` | `/tg/scan` |
| `src/features/tg-scan/ui/ScanListSheet.tsx` | `/tg/scan` |
| `src/features/tg-scan/ui/TgScanner.tsx` | `/tg/scan` |
| `src/features/user/change-role/ui/RoleSection.tsx` | `/all-users/:id` |
| `src/features/user/change-role/ui/roleChangeConfirm.tsx` | `/all-users/:id` |
| `src/features/user/create-user/ui/CreateUserForm.tsx` | `/all-users/create-user` |
| `src/features/user/password-sms/ui/ResetPasswordSmsButton.tsx` | `/all-users/:id` |
| `src/features/user/update-user/ui/UpdateUserModal.tsx` | `/all-users`, `/all-users/:id` |
| `src/features/user/update-user/ui/WarehouseOrderSection.tsx` | `/all-users/:id` |
| `src/pages/activity-logs/index.tsx` | `/activity-logs` |
| `src/pages/batches/lib/batchFormat.ts` | `/batches` |
| `src/pages/batches/lib/batchOrderMailAdapter.ts` | `/batches/:id` |
| `src/pages/batches/lib/batchReceipt.ts` | `/batches/:id` |
| `src/pages/batches/model/batchView.ts` | `/batches` |
| `src/pages/batches/ui/BatchDetailPage.tsx` | `/batches/:id` |
| `src/pages/batches/ui/BatchHistoryCard.tsx` | `/batches/:id` |
| `src/pages/batches/ui/BatchInfoCard.tsx` | `/batches/:id` |
| `src/pages/batches/ui/BatchPrintMenu.tsx` | `/batches/:id` |
| `src/pages/batches/ui/BatchQrCard.tsx` | `/batches/:id` |
| `src/pages/batches/ui/BatchQrCode.tsx` | `/batches/:id` |
| `src/pages/batches/ui/BatchesPage.tsx` | `/batches` |
| `src/pages/branch-dashboard/index.tsx` | `/branch-dashboard` |
| `src/pages/branch-dashboard/ui/BranchCards.tsx` | `/branch-dashboard` |
| `src/pages/branch-dashboard/ui/BranchDashboardPage.tsx` | `/branch-dashboard` |
| `src/pages/branch-dashboard/ui/branchDashboardAdapter.ts` | `/branch-dashboard` |
| `src/pages/branch-ops/index.tsx` | `/batches` |
| `src/pages/branches/ui/BranchDetailPage.tsx` | `/branches/:id` |
| `src/pages/branches/ui/BranchMetricsCards.tsx` | `/branches/:id` |
| `src/pages/branches/ui/BranchMetricsSection.tsx` | `/branches/:id` |
| `src/pages/branches/ui/BranchesPage.tsx` | `/branches` |
| `src/pages/courier-bulk/index.tsx` | `/courier-bulk` |
| `src/pages/courier-bulk/model/courierBulk.ts` | `/courier-bulk` |
| `src/pages/courier-bulk/model/useIsBelowLg.ts` | `/courier-bulk` |
| `src/pages/courier-bulk/ui/BulkAlert.tsx` | `/courier-bulk` |
| `src/pages/courier-bulk/ui/CourierBulkOrders.tsx` | `/courier-bulk` |
| `src/pages/courier-bulk/ui/CourierBulkProofDialog.tsx` | `/courier-bulk` |
| `src/pages/courier-bulk/ui/CourierBulkResultDialog.tsx` | `/courier-bulk` |
| `src/pages/courier-bulk/ui/CourierBulkSummary.tsx` | `/courier-bulk` |
| `src/pages/courier-bulk/ui/ResultControl.tsx` | `/courier-bulk` |
| `src/pages/courier-bulk/ui/ScanModeControl.tsx` | `/courier-bulk` |
| `src/pages/courier-bulk/ui/segmentTint.ts` | `/courier-bulk` |
| `src/pages/dashboard/DashboardPage.tsx` | `/` |
| `src/pages/dashboard/LogistDashboardPage.tsx` | `/` |
| `src/pages/dashboard/MarketDashboardPage.tsx` | `/` |
| `src/pages/dashboard/ui/AnalyticsKpiSection.tsx` | `/` |
| `src/pages/dashboard/ui/AutoApprovedExtraCosts.tsx` | `/` |
| `src/pages/dashboard/ui/CourierCashCard.tsx` | `/` |
| `src/pages/dashboard/ui/CourierPlanCard.tsx` | `/` |
| `src/pages/dashboard/ui/DeliveryQualityCard.tsx` | `/` |
| `src/pages/dashboard/ui/DeliveryResultsCard.tsx` | `/` |
| `src/pages/dashboard/ui/ExtraCostApprovals.tsx` | `/` |
| `src/pages/dashboard/ui/ExtraCostRejectDialog.tsx` | `/` |
| `src/pages/dashboard/ui/LogistRegionSuccessCard.tsx` | `/` |
| `src/pages/dashboard/ui/LogistRegionsTable.tsx` | `/` |
| `src/pages/dashboard/ui/MarketSalesCard.tsx` | `/` |
| `src/pages/dashboard/ui/QuickActions.tsx` | `/` |
| `src/pages/delivery-tariffs/index.tsx` | `/delivery-tariffs`, `/ops` |
| `src/pages/delivery-tariffs/model/history.ts` | `/delivery-tariffs` |
| `src/pages/delivery-tariffs/model/rulesForm.ts` | `/delivery-tariffs` |
| `src/pages/delivery-tariffs/model/tariffForm.ts` | `/delivery-tariffs` |
| `src/pages/delivery-tariffs/ui/CardHead.tsx` | `/delivery-tariffs` |
| `src/pages/delivery-tariffs/ui/DeliveryTariffsContent.tsx` | `/delivery-tariffs`, `/ops` |
| `src/pages/delivery-tariffs/ui/PriceCalculatorCard.tsx` | `/delivery-tariffs` |
| `src/pages/delivery-tariffs/ui/PricingRulesCard.tsx` | `/delivery-tariffs` |
| `src/pages/delivery-tariffs/ui/TariffEditDialog.tsx` | `/delivery-tariffs` |
| `src/pages/delivery-tariffs/ui/TariffHistoryCard.tsx` | `/delivery-tariffs` |
| `src/pages/delivery-tariffs/ui/TariffsCard.tsx` | `/delivery-tariffs` |
| `src/pages/dispatch/index.tsx` | `/dispatch` |
| `src/pages/dispatch/model/dispatchModel.ts` | `/dispatch` |
| `src/pages/dispatch/ui/CourierPickerDialog.tsx` | `/dispatch` |
| `src/pages/dispatch/ui/DispatchAlert.tsx` | `/dispatch` |
| `src/pages/dispatch/ui/DispatchOrdersTable.tsx` | `/dispatch` |
| `src/pages/dispatch/ui/DispatchStats.tsx` | `/dispatch` |
| `src/pages/expense-categories/index.tsx` | `/ops` |
| `src/pages/expense-categories/ui/ExpenseCategoriesPanel.tsx` | `/ops` |
| `src/pages/expense-categories/ui/ExpenseCategoryFormDialog.tsx` | `/ops` |
| `src/pages/finance-operators/index.tsx` | `/finance-operators` |
| `src/pages/finance-operators/lib/operatorFinance.ts` | `/finance-operators` |
| `src/pages/finance-operators/ui/OperatorBalanceCard.tsx` | `/finance-operators` |
| `src/pages/financial-balance/components/AiCostTab.tsx` | `/financial-balance` |
| `src/pages/financial-balance/components/AnalysisTab.tsx` | `/financial-balance` |
| `src/pages/financial-balance/components/DailyLedgerCard.tsx` | `/financial-balance` |
| `src/pages/financial-balance/components/FinancialEntryModal.tsx` | `/financial-balance` |
| `src/pages/financial-balance/components/FinancialHistoryDetail.tsx` | `/financial-balance` |
| `src/pages/financial-balance/components/HistoryTab.tsx` | `/financial-balance` |
| `src/pages/financial-balance/components/LedgerBalanceCard.tsx` | `/financial-balance` |
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
| `src/pages/integrations/CatalogPage.tsx` | `/integrations/new` |
| `src/pages/integrations/ConnectionFields.tsx` | `/integrations/connections`, `/integrations/new/:typeKey` |
| `src/pages/integrations/ConnectionsPage.tsx` | `/integrations/connections` |
| `src/pages/integrations/NewPartnerModal.tsx` | `/integrations/connections` |
| `src/pages/integrations/StatusMapField.tsx` | `/integrations/connections` |
| `src/pages/integrations/index.tsx` | `/integrations/connections` |
| `src/pages/integrations/panels/ConnectionControl.tsx` | `/integrations/connections` |
| `src/pages/integrations/panels/ConnectionLog.tsx` | `/integrations/connections` |
| `src/pages/integrations/panels/ConnectionOverview.tsx` | `/integrations/connections` |
| `src/pages/integrations/panels/ConnectionSecurity.tsx` | `/integrations/connections` |
| `src/pages/integrations/panels/ConnectionSettings.tsx` | `/integrations/connections` |
| `src/pages/integrations/panels/ConnectionSettlement.tsx` | `/integrations/connections` |
| `src/pages/integrations/panels/ConnectionShipments.tsx` | `/integrations/connections` |
| `src/pages/integrations/panels/settlement/CancelRemittanceDialog.tsx` | `/integrations/connections` |
| `src/pages/integrations/panels/settlement/PayResultDialog.tsx` | `/integrations/connections` |
| `src/pages/integrations/panels/settlement/RemittancesSection.tsx` | `/integrations/connections` |
| `src/pages/integrations/ui/FilterChips.tsx` | `/integrations/connections` |
| `src/pages/integrations/ui/InlineAlert.tsx` | `/integrations/connections` |
| `src/pages/integrations/ui/Switch.tsx` | `/integrations/connections` |
| `src/pages/integrations/ui/charts.tsx` | `/integrations/connections` |
| `src/pages/integrations/ui/index.ts` | `/integrations/connections` |
| `src/pages/integrations/ui/inputs.tsx` | `/integrations/connections` |
| `src/pages/integrations/ui/layout.tsx` | `/integrations/connections` |
| `src/pages/integrations/useConnections.ts` | `/integrations/connections` |
| `src/pages/integrations/wizard/ConnectWizard.tsx` | `/integrations/new/:typeKey` |
| `src/pages/integrations/wizard/steps.ts` | `/integrations/new/:typeKey` |
| `src/pages/investor/InvestmentsPage.tsx` | `/investments` |
| `src/pages/investor/InvestorDashboardPage.tsx` | `/` |
| `src/pages/investor/ProfitsPage.tsx` | `/profits` |
| `src/pages/investor/model/listSearch.ts` | `/investments`, `/profits` |
| `src/pages/investor/ui/InvestorAccessState.tsx` | `/`, `/investments`, `/profits` |
| `src/pages/investor/ui/InvestorListCards.tsx` | `/` |
| `src/pages/investor/ui/MonthlyProfitCard.tsx` | `/` |
| `src/pages/investor/ui/ProfitHistoryTable.tsx` | `/`, `/profits` |
| `src/pages/investors-ops/index.tsx` | `/ops` |
| `src/pages/logistics-ops/index.tsx` | `/returns` |
| `src/pages/logistics-ops/ui/ApproveReturnSummary.tsx` | `/returns` |
| `src/pages/logs/index.tsx` | `/ops` |
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
| `src/pages/mails/detail/lib/mailSearch.ts` | `/mails/:id` |
| `src/pages/mails/detail/lib/printMode.ts` | `/mails/:id` |
| `src/pages/mails/detail/lib/scanMatch.ts` | `/mails/:id` |
| `src/pages/mails/detail/model/useMailDetailState.ts` | `/mails/:id`, `/batches/:id` |
| `src/pages/mails/detail/model/useOrderRowView.tsx` | `/mails/:id` |
| `src/pages/mails/detail/ui/DeleteFromPostDialog.tsx` | `/mails/:id` |
| `src/pages/mails/detail/ui/DuplicatePhonesAlert.tsx` | `/mails/:id` |
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
| `src/pages/market-operators/ui/CommissionDialog.tsx` | `/market-operators` |
| `src/pages/market-operators/ui/CreateOperatorDialog.tsx` | `/market-operators` |
| `src/pages/market-operators/ui/WarehouseAccessSwitch.tsx` | `/market-operators` |
| `src/pages/market-operators/ui/useDeleteOperatorConfirm.tsx` | `/market-operators` |
| `src/pages/my-earnings/index.tsx` | `/my-earnings` |
| `src/pages/my-earnings/lib/operatorRate.ts` | `/my-earnings` |
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
| `src/pages/new_orders/cancelled/ui/MarketReturns.tsx` | `/new-orders/cancelled/:marketId` |
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
| `src/pages/notification-sent/index.tsx` | `/notifications/sent` |
| `src/pages/notification-sent/ui/SentFilters.tsx` | `/notifications/sent` |
| `src/pages/notification-sent/ui/SentTable.tsx` | `/notifications/sent` |
| `src/pages/notifications/ui/CampaignPage.tsx` | `/notifications/sms` |
| `src/pages/notifications/ui/NotificationInboxPage.tsx` | `/inbox` |
| `src/pages/notifications/ui/NotificationRowMenu.tsx` | `/notifications` |
| `src/pages/notifications/ui/NotificationsPage.tsx` | `/notifications` |
| `src/pages/notifications/ui/SmsPage.tsx` | `/notifications/sms` |
| `src/pages/notifications/ui/SmsReportTab.tsx` | `/notifications/sms` |
| `src/pages/notifications/ui/SmsSettingsTab.tsx` | `/notifications/sms` |
| `src/pages/notifications/ui/SmsTemplatesTab.tsx` | `/notifications/sms` |
| `src/pages/notifications/ui/sms/CampaignAudienceSummary.tsx` | `/notifications/sms` |
| `src/pages/notifications/ui/sms/CampaignSendTime.tsx` | `/notifications/sms` |
| `src/pages/notifications/ui/sms/CardList.tsx` | `/notifications/sms` |
| `src/pages/notifications/ui/sms/SmsReportCharts.tsx` | `/notifications/sms` |
| `src/pages/ops/index.tsx` | `/ops` |
| `src/pages/ops/tabs.ts` | `/ops` |
| `src/pages/ops/ui/OpsSection.tsx` | `/batches`, `/returns` |
| `src/pages/ops/ui/OpsToolPage.tsx` | `/ops` |
| `src/pages/orders/create/index.tsx` | `/new-orders/create` |
| `src/pages/orders/create/model/orderCreateForm.ts` | `/new-orders/create` |
| `src/pages/orders/create/model/useOrderSource.ts` | `/new-orders/create` |
| `src/pages/orders/create/ui/CreateAlert.tsx` | `/new-orders/create` |
| `src/pages/orders/create/ui/CreateModeTabs.tsx` | `/new-orders/create` |
| `src/pages/orders/create/ui/CustomerPhoneSuggest.tsx` | `/new-orders/create` |
| `src/pages/orders/create/ui/ExistingCustomerNotice.tsx` | `/new-orders/create` |
| `src/pages/orders/create/ui/MarketPicker.tsx` | `/new-orders/create` |
| `src/pages/orders/create/ui/OrderSourceCard.tsx` | `/new-orders/create` |
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
| `src/pages/orders/list/OrderFilters.tsx` | `/orders` |
| `src/pages/orders/list/OrderFiltersSheet.tsx` | `/orders` |
| `src/pages/orders/list/OrdersRefreshAlert.tsx` | `/orders` |
| `src/pages/orders/list/OrdersRefreshMeta.tsx` | `/orders` |
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
| `src/pages/orders/list/useOrdersRefresh.ts` | `/orders` |
| `src/pages/payments/components/BalanceTrendCard.tsx` | `/payments/main-cashbox` |
| `src/pages/payments/components/CashFlowCard.tsx` | `/payments` |
| `src/pages/payments/components/CashStateCard.tsx` | `/payments` |
| `src/pages/payments/components/CashboxActionFormCard.tsx` | `/payments/cash-detail/:id` |
| `src/pages/payments/components/CashboxFormPopup.tsx` | `/payments/main-cashbox` |
| `src/pages/payments/components/CloseShiftPopup.tsx` | `/payments/main-cashbox` |
| `src/pages/payments/components/DailyFlowChart.tsx` | `/payments` |
| `src/pages/payments/components/ExpenseCategoryBadge.tsx` | `/payments`, `/payments/main-cashbox`, `/payments/cash-detail/:id`, `/cash-box` |
| `src/pages/payments/components/FinanceHistoryDetailPopup.tsx` | `/payments`, `/payments/main-cashbox`, `/payments/cash-detail/:id`, `/cash-box` |
| `src/pages/payments/components/InactiveBadge.tsx` | `/payments` |
| `src/pages/payments/components/MainCashboxBalanceChart.tsx` | `/payments/main-cashbox` |
| `src/pages/payments/components/MyCashboxDaily.tsx` | `/cash-box` |
| `src/pages/payments/components/MyCashboxPage.tsx` | `/cash-box` |
| `src/pages/payments/components/OpenShiftDialog.tsx` | `/payments/main-cashbox` |
| `src/pages/payments/components/OpenShiftFlow.tsx` | `/payments/cash-detail/:id`, `/payments` |
| `src/pages/payments/components/PaymentAckBadge.tsx` | `/payments/cash-detail/:id`, `/cash-box` |
| `src/pages/payments/components/PaymentHistoryList.tsx` | `/payments/cash-detail/:id` |
| `src/pages/payments/components/PaymentSummaryCards.tsx` | `/payments` |
| `src/pages/payments/components/SalaryPaymentPopup.tsx` | `/payments/main-cashbox` |
| `src/pages/payments/components/SettlementPickerDialog.tsx` | `/payments`, `/payments/main-cashbox` |
| `src/pages/payments/components/ShiftBanner.tsx` | `/payments/main-cashbox`, `/payments` |
| `src/pages/payments/components/ShiftLockedCard.tsx` | `/payments/cash-detail/:id` |
| `src/pages/payments/components/ShiftResultDialog.tsx` | `/payments/main-cashbox` |
| `src/pages/payments/components/cashDetail.tsx` | `/payments/cash-detail/:id` |
| `src/pages/payments/components/lib/exportMainCashboxReport.ts` | `/payments/main-cashbox` |
| `src/pages/payments/components/lib/mainCashboxStats.ts` | `/payments/main-cashbox` |
| `src/pages/payments/components/lib/paymentIdempotency.ts` | `/payments/cash-detail/:id` |
| `src/pages/payments/components/lib/receiveOptions.ts` | `/payments` |
| `src/pages/payments/components/lib/useCashboxShift.ts` | `/payments/main-cashbox` |
| `src/pages/payments/components/mainCashbox.tsx` | `/payments/main-cashbox` |
| `src/pages/payments/components/patmentHistoryTable.tsx` | `/payments` |
| `src/pages/payments/components/paymentHistoryActor.ts` | `/payments` |
| `src/pages/payments/components/paymentSourceType.ts` | `/payments`, `/cash-box` |
| `src/pages/payments/components/shiftCheck/ShiftAccountsSection.tsx` | `/payments/main-cashbox` |
| `src/pages/payments/components/shiftCheck/aiStatus.tsx` | `/payments/shifts/:id` |
| `src/pages/payments/components/shiftCheck/aiStatusMeta.ts` | `/payments/shifts/:id` |
| `src/pages/payments/components/shiftCheck/useShiftAccountsForm.ts` | `/payments/main-cashbox` |
| `src/pages/payments/index.tsx` | `/payments` |
| `src/pages/payments/shiftReport/ReportDeliveries.tsx` | `/payments/shifts/:id` |
| `src/pages/payments/shiftReport/index.tsx` | `/payments/shifts/:id` |
| `src/pages/payments/shiftSettings/AutomationCards.tsx` | `/payments/shift-settings` |
| `src/pages/payments/shiftSettings/CellSwitch.tsx` | `/payments/shift-settings` |
| `src/pages/payments/shiftSettings/index.tsx` | `/payments/shift-settings` |
| `src/pages/payments/shiftSettings/settingsDiff.ts` | `/payments/shift-settings` |
| `src/pages/products/create/index.tsx` | `/products/create-product/:id` |
| `src/pages/products/list/index.tsx` | `/products` |
| `src/pages/products/list/ui/EditProductDialog.tsx` | `/products` |
| `src/pages/products/list/ui/SelectMarketDialog.tsx` | `/products` |
| `src/pages/products/model/productCode.ts` | `/products` |
| `src/pages/products/model/productErrors.ts` | `/products`, `/products/create-product/:id` |
| `src/pages/products/model/productLabelPrint.ts` | `/products` |
| `src/pages/products/model/productMeasure.ts` | `/products`, `/products/create-product/:id` |
| `src/pages/products/model/productView.ts` | `/products` |
| `src/pages/products/ui/FormErrorSummary.tsx` | `/products`, `/products/create-product/:id` |
| `src/pages/products/ui/ProductCodeSection.tsx` | `/products` |
| `src/pages/products/ui/ProductImageField.tsx` | `/products`, `/products/create-product/:id` |
| `src/pages/products/ui/ProductMeasureCells.tsx` | `/products`, `/products/create-product/:id` |
| `src/pages/products/ui/ProductMeasureFields.tsx` | `/products`, `/products/create-product/:id` |
| `src/pages/products/ui/ProductPriceField.tsx` | `/products`, `/products/create-product/:id` |
| `src/pages/products/ui/useDeleteProductConfirm.tsx` | `/products`, `/products/create-product/:id` |
| `src/pages/products/warehouse-stock/MarketProductsTabs.tsx` | `/products` |
| `src/pages/products/warehouse-stock/MarketWarehouseStock.tsx` | `/products` |
| `src/pages/profile/lib/profileView.ts` | `/profile` |
| `src/pages/profile/lib/salaryCycle.ts` | `/profile` |
| `src/pages/profile/ui/ChangePasswordDialog.tsx` | `/profile` |
| `src/pages/profile/ui/EditProfileDialog.tsx` | `/profile` |
| `src/pages/profile/ui/ProfileCards.tsx` | `/profile` |
| `src/pages/profile/ui/ProfilePage.tsx` | `/profile` |
| `src/pages/profile/ui/ProfileSessionsCard.tsx` | `/profile` |
| `src/pages/region/index.tsx` | `/regions` |
| `src/pages/region/model/boardModel.ts` | `/regions/districts`, `/regions/sato-management` |
| `src/pages/region/model/districtMerge.ts` | `/regions/districts` |
| `src/pages/region/model/logistRegionModel.ts` | `/regions` |
| `src/pages/region/model/regionPeriod.ts` | `/regions` |
| `src/pages/region/model/regionsModel.ts` | `/regions` |
| `src/pages/region/model/satoModel.ts` | `/regions/sato-management` |
| `src/pages/region/model/scopedModel.ts` | `/regions` |
| `src/pages/region/pages/districts/index.tsx` | `/regions/districts` |
| `src/pages/region/pages/logist-assignment/index.tsx` | `/regions/logist-assignment` |
| `src/pages/region/pages/logist-assignment/model/assignment.ts` | `/regions/logist-assignment` |
| `src/pages/region/pages/logist-assignment/ui/ChangesBar.tsx` | `/regions/logist-assignment` |
| `src/pages/region/pages/logist-assignment/ui/ChangesList.tsx` | `/regions/logist-assignment` |
| `src/pages/region/pages/logist-assignment/ui/LogistListCard.tsx` | `/regions/logist-assignment` |
| `src/pages/region/pages/logist-assignment/ui/LogistPicker.tsx` | `/regions/logist-assignment` |
| `src/pages/region/pages/logist-assignment/ui/RegionChoiceCard.tsx` | `/regions/logist-assignment` |
| `src/pages/region/pages/sato-management/index.tsx` | `/regions/sato-management` |
| `src/pages/region/ui/DistrictBoard.tsx` | `/regions/districts`, `/regions/sato-management` |
| `src/pages/region/ui/DistrictDeleteBlockedDialog.tsx` | `/regions/districts` |
| `src/pages/region/ui/DistrictMergeDialog.tsx` | `/regions/districts`, `/regions/sato-management` |
| `src/pages/region/ui/LogistRegionCouriers.tsx` | `/regions` |
| `src/pages/region/ui/LogistRegionView.tsx` | `/regions` |
| `src/pages/region/ui/MoveDistrictDialog.tsx` | `/regions/sato-management` |
| `src/pages/region/ui/RegionPeriodControls.tsx` | `/regions` |
| `src/pages/region/ui/RegionsMapCard.tsx` | `/regions` |
| `src/pages/region/ui/RegionsOverview.tsx` | `/regions` |
| `src/pages/region/ui/RegionsSuccessCards.tsx` | `/regions` |
| `src/pages/region/ui/ScopedDistricts.tsx` | `/regions` |
| `src/pages/region/ui/ScopedRegionView.tsx` | `/regions` |
| `src/pages/region/ui/UzbekistanRegionMap.tsx` | `/regions` |
| `src/pages/region/ui/regionBlocks.tsx` | `/regions` |
| `src/pages/region/ui/sato/SatoAddDistrictDialog.tsx` | `/regions/sato-management` |
| `src/pages/region/ui/sato/SatoApplyDialog.tsx` | `/regions/sato-management` |
| `src/pages/region/ui/sato/SatoCodeEditor.tsx` | `/regions/sato-management` |
| `src/pages/region/ui/sato/SatoCodesPanel.tsx` | `/regions/sato-management` |
| `src/pages/region/ui/sato/SatoCodesTable.tsx` | `/regions/sato-management` |
| `src/pages/region/ui/sato/SatoDuplicatesTable.tsx` | `/regions/sato-management` |
| `src/pages/region/ui/sato/SatoKpiRow.tsx` | `/regions/sato-management` |
| `src/pages/region/ui/sato/SatoMergeDialog.tsx` | `/regions/sato-management` |
| `src/pages/region/ui/sato/useSatoCodeEditor.ts` | `/regions/sato-management` |
| `src/pages/region/ui/sato/useSatoMerge.ts` | `/regions/sato-management` |
| `src/pages/region/ui/useDistrictMerge.ts` | `/regions/districts` |
| `src/pages/returns/index.tsx` | `/returns` |
| `src/pages/returns/model/returnBatches.ts` | `/returns` |
| `src/pages/scan/detail.tsx` | `/scan/:token` |
| `src/pages/scan/index.tsx` | `/scan` |
| `src/pages/scan/lib/scanResource.ts` | `/scan`, `/scan/:token` |
| `src/pages/scan/model/scanBatchView.ts` | `/scan/:token` |
| `src/pages/scan/model/scanExternalBagView.ts` | `/scan/:token` |
| `src/pages/scan/model/scanHistory.ts` | `/scan`, `/scan/:token` |
| `src/pages/scan/model/scanModes.ts` | `/scan` |
| `src/pages/scan/model/scanOrderView.ts` | `/scan/:token` |
| `src/pages/scan/model/scanPickers.ts` | `/scan` |
| `src/pages/scan/model/useCourierTake.ts` | `/scan` |
| `src/pages/scan/model/useMailModeScan.ts` | `/scan` |
| `src/pages/scan/model/useUniversalScan.ts` | `/scan` |
| `src/pages/scan/ui/ManagerOrderDialogs.tsx` | `/scan/:token` |
| `src/pages/scan/ui/ScanActionCard.tsx` | `/scan/:token` |
| `src/pages/scan/ui/ScanAlert.tsx` | `/scan/:token` |
| `src/pages/scan/ui/ScanBatchSummary.tsx` | `/scan/:token` |
| `src/pages/scan/ui/ScanExternalBagDetail.tsx` | `/scan/:token` |
| `src/pages/scan/ui/ScanMarketQrNotice.tsx` | `/scan/:token` |
| `src/pages/scan/ui/ScanModeCards.tsx` | `/scan` |
| `src/pages/scan/ui/ScanOrderResult.tsx` | `/scan/:token` |
| `src/pages/scan/ui/ScanOrdersCard.tsx` | `/scan/:token` |
| `src/pages/scan/ui/ScanPackageDetail.tsx` | `/scan/:token` |
| `src/pages/scan/ui/ScanPostDetail.tsx` | `/scan/:token` |
| `src/pages/scan/ui/ScanResultHeader.tsx` | `/scan/:token` |
| `src/pages/scan/ui/ScanSideCards.tsx` | `/scan` |
| `src/pages/scan/ui/ScanStates.tsx` | `/scan/:token` |
| `src/pages/scan/ui/ScanStickyBar.tsx` | `/scan/:token` |
| `src/pages/scan/ui/ScanTrackingCard.tsx` | `/scan/:token` |
| `src/pages/settings/ui/AppearancePanel.tsx` | `/settings` |
| `src/pages/settings/ui/DashboardPanel.tsx` | `/settings` |
| `src/pages/settings/ui/InterfacePanel.tsx` | `/settings` |
| `src/pages/settings/ui/NotificationsPanel.tsx` | `/settings` |
| `src/pages/settings/ui/ScannerPanel.tsx` | `/settings` |
| `src/pages/settings/ui/SettingsPage.tsx` | `/settings` |
| `src/pages/settings/ui/settingsUi.tsx` | `/settings`, `/payments/shift-settings` |
| `src/pages/system-ops/index.tsx` | `/ops` |
| `src/pages/system-ops/lib/aiStatus.ts` | `/ops` |
| `src/pages/system-ops/ui/AiStatusCard.tsx` | `/ops` |
| `src/pages/system-ops/ui/HealthCard.tsx` | `/ops` |
| `src/pages/tg-scan/index.tsx` | `/tg/scan` |
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
| `src/pages/warehouses/detail/index.tsx` | `/warehouses/:id` |
| `src/pages/warehouses/detail/ui/InventoryDialog.tsx` | `/warehouses/:id` |
| `src/pages/warehouses/detail/ui/LinkBarcodeDialog.tsx` | `/warehouses/:id` |
| `src/pages/warehouses/detail/ui/MovementItem.tsx` | `/warehouses/:id` |
| `src/pages/warehouses/detail/ui/MovementsPanel.tsx` | `/warehouses/:id` |
| `src/pages/warehouses/detail/ui/OutgoingOrdersCard.tsx` | `/warehouses/:id` |
| `src/pages/warehouses/detail/ui/RecentMovementsCard.tsx` | `/warehouses/:id` |
| `src/pages/warehouses/detail/ui/ScanLinesList.tsx` | `/warehouses/:id` |
| `src/pages/warehouses/detail/ui/ScanProductField.tsx` | `/warehouses/:id` |
| `src/pages/warehouses/detail/ui/StockInDialog.tsx` | `/warehouses/:id` |
| `src/pages/warehouses/detail/ui/StockPanel.tsx` | `/warehouses/:id` |
| `src/pages/warehouses/detail/ui/ThresholdDialog.tsx` | `/warehouses/:id` |
| `src/pages/warehouses/detail/ui/WarehouseActionsMenu.tsx` | `/warehouses/:id` |
| `src/pages/warehouses/detail/ui/WarehouseKpis.tsx` | `/warehouses/:id` |
| `src/pages/warehouses/index.tsx` | `/warehouses` |
| `src/pages/warehouses/ui/CreateWarehouseDialog.tsx` | `/warehouses` |
| `src/pages/warehouses/ui/ManagerWarehouseRedirect.tsx` | `/warehouses` |
| `src/pages/warehouses/ui/NoteAlert.tsx` | `/warehouses` |
| `src/pages/warehouses/ui/WarehouseListView.tsx` | `/warehouses` |
| `src/pages/warehouses/ui/WarehousesTable.tsx` | `/warehouses` |
| `src/shared/components/PrintModeSelect.tsx` | `/mails/:id` |
| `src/shared/components/ScanFeedbackOverlay.tsx` | `/scan` |
| `src/shared/components/popupSelect.tsx` | `/payments/main-cashbox` |
| `src/shared/lib/scanner/feedback.ts` | `/scan` |
| `src/shared/lib/shellBannerSlot.ts` | `/login` |
| `src/shared/lib/useCameraQrScanner.ts` | `/scan` |
| `src/shared/ui/ErrorBoundary.tsx` | `/runtime-error` |
| `src/shared/ui/ErrorBoundaryPage.tsx` | `/runtime-error` |
| `src/shared/ui/Forbidden.tsx` | `/403`, `/` |
| `src/shared/ui/NotFound.tsx` | `/404`, `/*` |
| `src/shared/ui/SelectionRegion.tsx` | `/new-orders/branches/:branchId`, `/new-orders/branches/:branchId/batches/:batchId`, `/new-orders/cancelled/:marketId`, `/mails/return`, `/mails/:id` |
| `src/shared/ui/ServerError.tsx` | `/500` |
| `src/shared/ui/SmsMeter.tsx` | `/notifications/sms` |
| `src/shared/ui/camera/CameraSurface.tsx` | `/tg/scan` |
| `src/shared/ui/camera/ScannerCamera.tsx` | `/new-orders/cancelled/:marketId`, `/dispatch`, `/courier-bulk`, `/scan` |
| `src/shared/ui/camera/scanRegion.ts` | `/scan` |
| `src/shared/ui/camera/useLowLight.ts` | `/scan` |
| `src/shared/ui/charts/Sparkline.tsx` | `/` |
| `src/shared/ui/charts/StackedBars.tsx` | `/` |
| `src/shared/ui/charts/index.ts` | `/`, `/branch-dashboard` |
| `src/shared/ui/error-page/ErrorPageFrame.tsx` | `/403`, `/404`, `/500` |
| `src/widgets/Sidebar/model/menuConfig.tsx` | `(qobiq)` |
| `src/widgets/Sidebar/ui/BottomNav.tsx` | `(qobiq)` |
| `src/widgets/Sidebar/ui/MobileMenu.tsx` | `(qobiq)`, `/` |
| `src/widgets/Sidebar/ui/Sidebar.tsx` | `(qobiq)` |
| `src/widgets/Sidebar/ui/SidebarItem.tsx` | `(qobiq)` |
| `src/widgets/activity-log/model/activityDetail.ts` | `/activity-logs` |
| `src/widgets/activity-log/model/activityFilters.ts` | `/activity-logs` |
| `src/widgets/activity-log/model/useActivityLabels.ts` | `/activity-logs` |
| `src/widgets/activity-log/ui/ActivityLogDetail.tsx` | `/activity-logs` |
| `src/widgets/activity-log/ui/ActivityLogFilters.tsx` | `/activity-logs` |
| `src/widgets/activity-log/ui/ActivityLogViewer.tsx` | `/activity-logs` |
| `src/widgets/branch-detail/ui/BranchDetailWidget.tsx` | `/branches/:id` |
| `src/widgets/branch-detail/ui/BranchEmployeesSection.tsx` | `/branches/:id` |
| `src/widgets/branch-list/ui/BranchCards.tsx` | `/branches` |
| `src/widgets/branch-list/ui/BranchListWidget.tsx` | `/branches` |
| `src/widgets/branch-list/ui/BranchRowMenu.tsx` | `/branches` |
| `src/widgets/branch-list/ui/BranchSummaryCard.tsx` | `/branches` |
| `src/widgets/branch-list/ui/BranchTable.tsx` | `/branches` |
| `src/widgets/branch-list/ui/BranchTree.tsx` | `/branches` |
| `src/widgets/dashboard-part-error/ui/DashboardPartError.tsx` | `/`, `/branch-dashboard` |
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
| `src/widgets/layout/ui/SkipLink.tsx` | `(qobiq)`, `/orders` |
| `src/widgets/notification-inbox/ui/NotificationInboxItem.tsx` | `/notifications/send`, `/inbox` |
| `src/widgets/notification-inbox/ui/NotificationInboxList.tsx` | `/inbox` |
| `src/widgets/notification-inbox/ui/NotificationItemMenu.tsx` | `/inbox` |
| `src/widgets/order-meta/ui/OrderMeta.tsx` | `/orders/edit/:orderId` |
| `src/widgets/order-tracking/ui/OrderTracking.tsx` | `/orders/edit/:orderId` |
| `src/widgets/region-detail/ui/RegionDetailDialog.tsx` | `/`, `/regions` |
| `src/widgets/user-detail/model/useMarketTelegramGroupPiiToggle.ts` | `/all-users/:id` |
| `src/widgets/user-detail/ui/MarketTelegramGroupsCard.tsx` | `/new-orders/userDetail/:id`, `/all-users/:id`, `/profile` |
| `src/widgets/user-detail/ui/UserDetailView.tsx` | `/new-orders/userDetail/:id`, `/all-users/:id` |
| `src/widgets/user-list/ui/UserListKpi.tsx` | `/all-users` |
| `src/widgets/user-list/ui/UserListTable.tsx` | `/all-users` |
| `src/widgets/user-list/ui/UserRowMenu.tsx` | `/all-users` |

## 7. Rol menyulari → route

Manba: `src/widgets/Sidebar/model/menuConfig.tsx` (kod) va `design/kit/roles.json` (maketdagi menyu, yorliq va guruh). Ikkalasidagi bandlar to'plami bir xil bo'lishi shart — skript tekshiradi. Maketda bandlar guruhlangan (Ish, Moliya …), shuning uchun tartib farq qilishi mumkin. Menejer menyusi filial turiga qarab (`MANAGER_CAPABILITIES`), registratorning «Biriktirish» bandi ham (`getSidebarConfigForUser`).

### superadmin — Superadmin

| Band | Kalit | `to` | Route | Shart (filial turi) | superadmin maketlari |
|---|---|---|---|---|---|
| Bosh sahifa | `dashboard` | `/` | `/` | — | `superadmin-dashboard-main` (+1) |
| Buyurtmalar | `orders` | `/orders` | `/orders` | — | `superadmin-orders-list` (+6) |
| Qabul va yaratish | `newOrders` | `/new-orders` | `/new-orders` | — | `superadmin-neworders-markets` |
| Pochta | `mails` | `/mails` | `/mails/today` | — | `superadmin-mails-today` |
| Paketlar | `batches` | `/batches` | `/batches` | — | `superadmin-batches-new` (+3) |
| Qaytarishlar | `returns` | `/returns` | `/returns` | — | `superadmin-returns-list` (+3) |
| Mahsulotlar | `products` | `/products` | `/products` | — | `superadmin-products-list` (+4) |
| Ombor | `warehouse` | `/warehouses` | `/warehouses` | — | `superadmin-warehouse-list` (+1) |
| Foydalanuvchilar | `users` | `/all-users` | `/all-users` | — | `superadmin-users-list` (+6) |
| To'lovlar | `payments` | `/payments` | `/payments` | — | `superadmin-payments-overview` (+19) |
| Balans | `balance` | `/financial-balance` | `/financial-balance` | — | `superadmin-balance-overview` (+4) |
| Hududlar | `regions` | `/regions` | `/regions` | — | `superadmin-regions-map` (+1) |
| Bildirishnoma sozlamalari | `notifications` | `/notifications` | `/notifications` | — | `superadmin-notifications-telegram-groups` (+14) |
| Filiallar | `branches` | `/branches` | `/branches` | — | `superadmin-branches-list-tree` (+2) |
| Integratsiyalar | `integrations` | `/integrations` | `/integrations/connections` | — | `superadmin-integrations-partners-console` (+16) |
| Faoliyat jurnali | `activityLogs` | `/activity-logs` | `/activity-logs` | — | `superadmin-activity-logs-list` (+1) |
| Ops vositalari | `ops` | `/ops` | `/ops` | — | `superadmin-ops-finance-operators` (+11) |

Maketda bor, kodda hali yo'q (`plannedMenu`): AI yordamchi (`aiAssistant`).

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
| Ombor | `warehouse` | `/warehouses` | `/warehouses` | — | `admin-warehouse-list` (+1) |
| Foydalanuvchilar | `users` | `/all-users` | `/all-users` | — | `admin-users-list` (+4) |
| To'lovlar | `payments` | `/payments` | `/payments` | — | `admin-payments-overview` (+6) |
| Balans | `balance` | `/financial-balance` | `/financial-balance` | — | `admin-balance-overview` (+4) |
| Hududlar | `regions` | `/regions` | `/regions` | — | `admin-regions-map` (+1) |
| Integratsiyalar | `integrations` | `/integrations` | `/integrations/connections` | — | `admin-integrations-partners` (+14) |
| Bildirishnoma sozlamalari | `notifications` | `/notifications` | `/notifications` | — | `admin-notifications-telegram-groups` (+14) |
| Faoliyat jurnali | `activityLogs` | `/activity-logs` | `/activity-logs` | — | `admin-activity-logs-list` (+1) |

### manager — Menejer

| Band | Kalit | `to` | Route | Shart (filial turi) | manager maketlari |
|---|---|---|---|---|---|
| Bosh sahifa | `dashboard` | `/branch-dashboard` | `/branch-dashboard` | barchasi | `manager-branch-dashboard-main` (+1) |
| Biriktirish | `dispatch` | `/dispatch` | `/dispatch` | REGIONAL · HYBRID | `manager-dispatch-scan` (+2) |
| Buyurtmalar | `orders` | `/orders` | `/orders` | barchasi | `manager-orders-list-all` (+7) |
| Tezkor amal | `quickAction` | `/courier-bulk` | `/courier-bulk` | REGIONAL · HYBRID | `manager-courier-bulk-main` (+1) |
| Qabul va yaratish | `newOrders` | `/new-orders` | `/new-orders` | HQ · PICKUP · HYBRID | `manager-new-orders-markets` (+1) |
| Pochta | `mails` | `/mails` | `/mails/today` | HQ · REGIONAL · HYBRID | `manager-mails-today` |
| Paketlar | `batches` | `/batches` | `/batches` | HQ · PICKUP · HYBRID | `manager-batches-new` (+2) |
| Qaytarishlar | `returns` | `/returns` | `/returns` | HQ · PICKUP · HYBRID | `manager-returns-list` |
| Mahsulotlar | `products` | `/products` | `/products` | barchasi | `manager-products-list` (+3) |
| Ombor | `warehouse` | `/warehouses` | `/warehouses` | REGIONAL · HYBRID | izohga qarang |
| Foydalanuvchilar | `users` | `/all-users` | `/all-users` | HQ · PICKUP · REGIONAL · HYBRID | `manager-users-list` |
| To'lovlar | `payments` | `/payments` | `/payments` | HQ · REGIONAL · HYBRID | `manager-payments-overview` (+4) |
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
| Ombor | `warehouse` | `/warehouses` | `/warehouses` | — | izohga qarang |

### market — Market

| Band | Kalit | `to` | Route | Shart (filial turi) | market maketlari |
|---|---|---|---|---|---|
| Bosh sahifa | `dashboard` | `/` | `/` | — | `market-dashboard-home` (+2) |
| Buyurtmalar | `orders` | `/orders` | `/orders` | — | `market-orders-list` |
| Qabul va yaratish | `newOrders` | `/new-orders` | `/new-orders` | — | izohga qarang |
| Mahsulotlar | `products` | `/products` | `/products` | — | `market-products-list` (+1) |
| To'lovlar | `payments` | `/cash-box` | `/cash-box` | — | `market-cashbox-my` (+3) |
| Operatorlar | `operators` | `/market-operators` | `/market-operators` | — | `market-operators-list` (+7) |

### market_operator — Market operatori

| Band | Kalit | `to` | Route | Shart (filial turi) | market_operator maketlari |
|---|---|---|---|---|---|
| Bosh sahifa | `dashboard` | `/` | `/` | — | izohga qarang |
| Buyurtmalar | `orders` | `/orders` | `/orders` | — | izohga qarang |
| Buyurtma yaratish | `newOrders` | `/new-orders` | `/new-orders` | — | izohga qarang |
| Mahsulotlar | `products` | `/products` | `/products` | — | `market_operator-products-list` (+1) |
| Daromadim | `earnings` | `/my-earnings` | `/my-earnings` | — | `market_operator-earnings` (+1) |

### courier — Kuryer

| Band | Kalit | `to` | Route | Shart (filial turi) | courier maketlari |
|---|---|---|---|---|---|
| Bosh sahifa | `dashboard` | `/` | `/` | — | `courier-dashboard-home` (+2) |
| Buyurtmalar | `orders` | `/orders` | `/orders` | — | `courier-orders-pending` (+12) |
| Tezkor amal | `quickAction` | `/courier-bulk` | `/courier-bulk` | — | `courier-courier-bulk-main` (+3) |
| Pochta | `mails` | `/mails` | `/mails/today` | — | `courier-mails-today` (+1) |
| Kassa | `payments` | `/cash-box` | `/cash-box` | — | `courier-cashbox-my-all` (+5) |
| Hududlar | `regions` | `/regions` | `/regions` | — | `courier-regions-scoped` |

### logist — Logist

| Band | Kalit | `to` | Route | Shart (filial turi) | logist maketlari |
|---|---|---|---|---|---|
| Bosh sahifa | `dashboard` | `/` | `/` | — | `logist-dashboard-main` (+2) |
| Hududlar | `regions` | `/regions` | `/regions` | — | `logist-regions-detail` (+1) |

Maketda bor, kodda hali yo'q (`plannedMenu`): Buyurtmalar (`orders`), Pochta (`mails`), Paketlar (`batches`), Kuryerlar (`couriers`).

### investor — Investor

| Band | Kalit | `to` | Route | Shart (filial turi) | investor maketlari |
|---|---|---|---|---|---|
| Bosh sahifa | `dashboard` | `/` | `/` | — | `investor-dashboard-home` (+6) |
| Investitsiyalar | `investments` | `/investments` | `/investments` | — | `investor-investments-list` (+2) |
| Foyda tarixi | `profits` | `/profits` | `/profits` | — | `investor-profits-list` (+1) |
