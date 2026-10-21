# Elchi Frontend — majburiy qoidalar (frontchilar va AI agentlar uchun)

React 19 + Vite + Tailwind v4 + antd 6, Feature-Sliced Design (`app → pages → widgets → features → entities → shared`).
Bu fayl jamoaning **majburiy** qoidalari. Ular odamga ham, AI agentga ham (Claude Code `CLAUDE.md` orqali o'qiydi,
Codex to'g'ridan-to'g'ri) bir xil amal qiladi.
To'liq dizayn qoidalari: **`docs/DESIGN_SYSTEM.md`**. UI'ga tegadigan har ishdan oldin o'qing.

## Loyiha holati: dizayn v2 ga o'tish

Dizayn v2 ga **bosqichma-bosqich** o'tildi: 0–5 bosqichlar tayyor (2026-10-18), kamera ishi (skaner
1–4-bosqich, `docs/DESIGN_SYSTEM.md` §14) ham tayyor; qolgani — ratchet ro'yxatlaridagi v1 fayllar. Ega yangi dizaynni tasdiqlagan (2026-10-09) va uning barcha ekranlari repoda turadi
(`design/`).

| Bosqich | Nima | Holat |
|---|---|---|
| 0 | tokenlar, kunduzgi/tungi mavzu, Manrope, valyuta i18n, maketlar repoda, dizayn qo'riqchisi | **tayyor** |
| 1 | primitivlar (`src/shared/ui/primitives`): `Button`, `IconButton`, `Spinner`, `Badge`, `StatusBadge` (+ `OrderStatusBadge`/`statusRegistry` — `src/entities/order`), `Card`, `StatCard`, `PageHeader`, `Tabs`, `SegmentedControl`; formatlovchilar `formatPhone`, `formatDateTime*`, `formatSigned*`; namuna sahifasi `/ops/ui-kit` | **tayyor** |
| 2 | shell (`widgets/layout`, `widgets/Sidebar`, `widgets/header`, `// dizayn-v2: shell`): bitta kanvas (kontent karta emas, `max-w-[1440px]`, chekkalar 24·32·48 / < 1024 16·16·88), `nav-*` va `avatar` tokenlari, yon menyu 248/72 (guruhlar) + planshet surma menyu + telefon varaqasi, topbar + profil menyusi (mavzu, til, «Chiqish») + qo'ng'iroqcha + global qidiruv (Ctrl K, < 1024 qidiruv ekrani), pastki menyu (`roles.json` → `bottomNav`), bo'lim almashsa skroll tepaga, bo'lim yuklanish chizig'i (`RouteProgress`); ikonkalar yagona manba — `menuConfig.tsx` | **tayyor** |
| 3 | forma, dialog va holatlar (`src/shared/ui/primitives`): `Field` + `TextInput` (telefon, qidiruv), `Select` (qidiruv, ko'p tanlov), `DateRange`/`DateInput`/`Calendar` (tez tanlov), `Dialog` + `ConfirmDialog` + `useConfirm()` (telefonda pastki varaqa), `notify()` + `Toaster`, `EmptyState`/`ErrorState`/`Skeleton*` + `QueryBoundary`; xato sahifalari (404/403/500/ilova xatosi, `tizim-errors`); global qatlam `app/providers/UiHost.tsx`; v1 o'ramlari (`FilterSelect`, `PopupSelect`, `Popup` …) API'si o'zgarmagan, ichi v2 (iste'molchisiz qolganlari 5-bosqichda, `FormPopup` — MO-1 da o'chirildi); pul/kirish amallari tasdiq bilan; ESLint antd `message`/`notification`/`Popconfirm`/`Modal.confirm` va brauzer `confirm`/`alert`/`prompt` ni taqiqlaydi | **tayyor** |
| 4 | sahifalar migratsiyasi (har sahifa alohida PR); ro'yxat standarti — `DataTable` + `Pagination` (`src/shared/ui/primitives`, `/ops/ui-kit?section=table`). Ko'chirilgan: `/orders` (barcha rollar: ro'yxat, filtrlar + telefon varaqasi, kuryer ro'yxati, sotish / bekor qilish / qaytarish oynalari), `/orders/edit/:orderId` (buyurtma tafsiloti, barcha rollar: kartalar, tarix, tahrirlash oynalari, amallar), `/new-orders/create` (buyurtma yaratish, barcha rollar: qo'lda — qadamlar, market tanlash oynasi, mijoz va mahsulotlar, xulosa; AI bilan — matn/rasm, tahlil kartalari, tasdiq oynasi, «Yaratildi»), «Qabul va yaratish» qobig'i (sarlavha + sonli tablar, `pages/new_orders/model/newOrdersShell.ts`), `/new-orders` («Marketlar»), `/new-orders/:marketId` (market yangi buyurtmalari: tanlov, qabul / o'chirish oynalari, USB skaner; market rolida — o'z ro'yxati), `/new-orders/:marketId/edit/:orderId`, `/new-orders/incoming` (manba tanlash), `/new-orders/incoming/:marketId` (USB skaner bilan qabul), «Filial paketlari» (`/new-orders/branches`, `/new-orders/branches/:branchId` — paketlar, tanlov va USB skaner, `…/batches/:batchId` — paket buyurtmalarini qabul qilish) va «Bekor qilinganlar» (`/new-orders/cancelled` — marketlar, `/new-orders/cancelled/:marketId` — marketga topshirish: «Market QR kerak» / «skanerlandi» holati, faqat market QR'idan keyin jo'natish, «QR buzilganini tasdiqlash» oynasi; market rolida — o'z bekorlari va QR kod oynasi), «Pochta» (`/mails/today`, `/mails/return`, `/mails/refused`, `/mails/old` — sonli tablar, kuryerda «Qaytarish»siz; ro'yxatlar `MailsTable`, eski pochtalar filtrlari + «Filial paketlari» + Excel; `/mails/:id` — jo'natish / qabul / rad etilgan / tarix, USB skaner, chop etish menyusi, jo'natish va o'chirish oynalari) va «Paketlar va qaytarishlar» (`/batches` — Yangi · Eski · Qaytarilgan, `/batches/:id` — paket ma'lumoti, QR, pochta tafsilotining buyurtmalar kartasi bilan jo'natish, A5 varaq; `/returns`) va «Moliya» (`/payments` — KPI, «Kuryerlardagi pul», tarix + filtrlar, tanlash oynalari `SettlementPickerDialog`; `/payments/main-cashbox` — kassa balansi + grafik, tezkor amallar, davrlar, manbalar, to'ldirish / xarajat tasdiq bilan, smena oynasi; `/payments/cash-detail/:id` — kuryer / market / filial kassasi, to'lov formasi + «To'lovni tasdiqlang», balans harakati; `/cash-box` — market, kuryer, menejer; `/financial-balance` — Umumiy · Tarix · Tahlil, qo'lda yozuv va tafsilot oynalari; umumiy tafsilot oynasi `FinanceHistoryDetailPopup`; ega qarorlari D1–D3 — `design/kit/route-map.json` izohlarida) va G1 — «Bosh sahifa» (`/` — superadmin, admin, registrator, kuryer, market: KPI, muvaffaqiyat spidometri, holat donuti, reytinglar top 5, «Moliyaviy tahlil», kassa, hududlar kartogrammasi + umumiy viloyat oynasi `RegionDetailDialog`, xarajat tasdiqlari; `/branch-dashboard` — menejer; grafiklar `src/shared/ui/charts`), «Foydalanuvchilar» (`/all-users` — KPI, rol tablari, qator menyusi, nofaol qilish / o'chirish tasdiq bilan; `/all-users/create-user`; `/all-users/:id` va `/new-orders/userDetail/:id` — `UserDetailView`, ruxsatlar, tarif, Telegram token, tahrirlash va kuryerni o'tkazish oynalari), «Filiallar» (`/branches` — daraxt · jadval · kartalar, yaratish / tahrirlash oynasi; `/branches/:id` — xodimlar, qo'shish / olib tashlash / o'tkazish), «Mahsulotlar» (`/products` — market tanlash, tahrirlash, o'chirish oynalari; `/products/create-product/:id`), «Hududlar» (`/regions` — xarita, metrika, jadval egizagi, viloyat oynasi; menejer va kuryerda o'z viloyati `region/my/district-stats`; `/regions/districts`, `/regions/sato-management`, `/regions/logist-assignment`; ega savollariga sukut javoblari — `route-map.json` izohlarida) va G2 — «Integratsiyalar» (`/integrations/connections` — konsol: Hamkorlar · Tashqi tizimlar · Marketplace, KPI «kechaga nisbatan», 7 panel — Sozlamalar, Posilkalar, Hodisalar, Hisob-kitob + to'lov oynasi, Ish rejimi, Xavfsizlik + kalitni yangilash; `/integrations/new` — katalog, `/integrations/new/:typeKey` — 4 qadamli usta; `/integrations/partners`, `/integrations/sources`, `/integrations/sources/create`, `/integrations/sources/:id` — eski sahifalar «Eski sahifa» belgisi bilan), «Bildirishnomalar» (`/notifications` — superadmin va admin: Telegram guruhlari + «Holat» ustuni (umumiy neytral izoh), qo'shish — bir martalik Telegram havolasi (QR, maketdagi qo'lda guruh ID emas), qator menyusi (desktopda popover, telefonda pastki varaqa): nofaol qilish / faollashtirish (`PATCH {is_active}`) va o'chirish — tasdiq oynalari bilan, «Tahrirlash» yo'q; `/notifications/send` — 4 rejim, ko'rinish, tasdiq, sarlavhada «Yuborilganlar»; `/notifications/sent` — «Yuborilganlar» (NS-2: «Natija» va «Kim yubordi» filtrlari URL'da + telefon varaqasi, `DataTable` + `Pagination`, tafsilot oynasi `?id=`); `/notifications/sms` — Kampaniya · Shablonlar · Xarajat · Sozlamalar), «Tizim» (`/activity-logs` — filtrlar (amallar reyestri) + telefon varaqasi, ochiladigan qator `DataTable expandable` (muallif, qurilma, IP); `/ops` — 8 tab, telefonda `Select`, va to'g'ridan-to'g'ri `/finance-operators` (to'lov tasdiq + `Idempotency-Key` bilan), `/integrations-ops`, `/investors-ops`, `/logistics-ops`, `/branch-ops`, `/identity-ops`, `/system-ops`, `/logs` — «← Ops vositalari» bilan; `/market-operators` — MO-1 da ko'chirildi), «Hisob» (`/profile` — ma'lumot, maosh, parol va tahrirlash oynalari, o'z Telegram'ini ulash, marketda «Guruhda mijoz ismi va telefoni»; `/settings` — Ko'rinish · Bosh sahifa · Interfeys · Skaner · Bildirishnomalar, `common-settings-scanner` ham; `/inbox` — tablar, chiplar, «Faqat muhim», push tushuntirish oynalari); ega savollariga sukut javoblari — `route-map.json` izohlarida; G3 — `/login` (+ «Sessiya tugadi» ekrani; sessiya banneri shell'ning `[data-shell-slot=banner]` slotida — sahifani suradi), `/scan/:token` (barcha rollar bitta tartibda: kuryer «O'zimga olish», menejer sotish / bekor / «Kuryerga biriktirish», paket va pochta), `/dispatch` (USB skan → tanlov → «Kuryerni tanlang» oynasi), `/courier-bulk` («Sotildi · Bekor · Ertaga», «Kunni yakunlash» tasdiq bilan). Kamera ishi (skaner, Trello v1eLN2tV): 1–2-bosqich tayyor — `/scan` v2, kontekstli markaziy «Skaner» / «Skanerlash» (`ScannerHost`, v2 `ScannerCamera`), USB skanli har oqim kamera bilan ham (oqim ichida kamera tugmasi yo'q — ega qarori), v1 `ScannerCameraModal` o'chirildi; 3-bosqich — universal `/scan` rejimlari («Ma'lumot · Qabul qilish · Kuryerga biriktirish», kuryerda «O'zimga olish»); 4-bosqich — Sozlamalar → Skaner → «Kamera» kartasi (asosiy kamera, chiroq taklifi, uzluksiz skanerlash, ovoz, tebranish, ramka o'lchami — `ScannerCamera` o'qiydi); kamera ishi yopildi. «Operatorlar» (`/market-operators`, faqat market — MO-1: ro'yxat, komissiya ogohlantirishi, qo'shish, komissiya va o'chirish oynalari; menyuda «Operatorlar», telefonda «Menyu» varag'ida); «Daromadim» (`/my-earnings`, faqat market operatori — MO-2: «Stavkam» kartasi va «Komissiya belgilanmagan» ogohlantirishi; operator bosh sahifasi — market bosh sahifasi operator rejimida); «Investor» (`/investments` — «Investitsiyalar», `/profits` — «Foyda tarixi», faqat investor — IN-2) | **tayyor** — 81 / 81 route v2 (`design/SCREENS.md`); jurnal — `docs/DESIGN_SYSTEM.md` Ilova A |
| 5 | qo'riqchilar (`docs/DESIGN_SYSTEM.md` §12): ESLint `design-v2/raw-control` (xom `<button>` / `<select>` / `<textarea>` / matn `<input>` / `<dialog>` / `role="button"` — o'rniga primitivlar va yangi `Pressable`), `design-v2/ui-imports` (antd vizual komponentlari, boshqa ikonka kutubxonalari), `jsx-a11y/anchor-is-valid` — butun `src` da xato (xom element taqiqi dizayn tizimi qatlami va testlarda o'chiq, antd / ikonka taqiqi — faqat testlarda); design-guard `named-colour` + `V2_SCOPES` (ko'chirilgan papkadagi har fayl rangda 0, 80 papka); vizual snapshotlar (23 sahna × kunduzgi/tungi × 1440/390 = 92, Playwright, mock API, CI «Visual» workflow — baseline faqat Docker obrazida); ratchet ro'yxatlari faqat qisqaradi | **tayyor** — qolgan: «Visual» baseline'lari `dev` ga (`shodiyor` da tayyor, merge commit bilan) va required (§12.5), v1 ratchet fayllari (§14) |

**Sahifa shell ichida chiziladi** (4-bosqichdan boshlab har sahifa): u `[data-shell-slot=content]` ichida turadi —
kanvas foni, `max-w-[1440px]`, chekkalar va telefonda pastki menyu joyi shell'da. Sahifa o'ziga tashqi karta
(`bg-surface` o'rami), tashqi `p-*`/`px-*` chekka, `h-screen`/o'z skroll konteyneri, yon menyu yoki pastki menyu
yasamaydi; sahifa ildizi faqat bo'limlar oralig'ini beradi (`flex flex-col gap-6 max-md:gap-4`).

Ilovada hozir ikki xil sahifa bor:
- **v2 ga ko'chirilgan** sahifalar. Faylning birinchi qatorida `// dizayn-v2: <ekran>` belgisi turadi.
- **Eski (v1)** sahifalar. Ular eski nomlar (alias) orqali yangi ranglarda ko'rinadi, lekin tuzilmasi va
  komponentlari eski.

Trello'dagi «Dizayn v2» kartalari bosqichlarni kuzatadi. **Joriy holat, ega qarorlari jurnali va navbatdagi ish:
`docs/DESIGN_V2_HANDOFF.md`** — dizayn v2 ishini davom ettiruvchi har sessiya/agent avval shuni o'qiydi.

## Dizaynni qayerdan ko'rish

- **`design/`**: 662 ekran (superadmin, admin, manager, registrator, market, market_operator, courier, logist,
  investor, umumiy ekranlar va `tizim-*` dizayn tizimi taxtalari; 2026-10-19 da ega tasdiqlagan 19 guruh qo'shildi —
  kodda hali yo'qlari `route-map.json` → `newViews`, `plannedMenu`, `plannedBottomNav`). Har biri desktop 1440 / planshet 768 / telefon 390, kunduzgi va tungi. Tavsif:
  `design/README.md`.
- **Ekranni topish:** `design/SCREENS.md` (route / sahifa fayli → `<rol>-<viewId>`).
- **Ko'rish:** `npm run design:preview` (http://127.0.0.1:4199, barcha ekranlar ro'yxati) yoki
  `npm run design:shot -- <ekran>` (`design/shots/` ga PNG; agent ularni o'qib dizaynni ko'radi).
- **Kodga tarjima:** `design/CODE-MAP.md` (maket `el-*` klassi → Tailwind + tokenlar → mavjud komponent →
  1-bosqich primitivi).
- **Primitivlar namunasi:** `/ops/ui-kit` (faqat superadmin, menyuda yo'q) — har primitiv kunduzgi va tungi
  mavzuda yonma-yon; `?section=buttons|badges|cards|page-header|tabs|format|forms|select|date|dialog|feedback|states|table`
  bitta bo'lim.
- **Ilovani ko'rish (akkauntsiz):** `npm run app:shot -- <route> [--device phone] [--theme dark] [--role manager]`
  → `design/shots/app/*.png` + JSON hisobot (gorizontal toshish, 44px dan kichik nishon, 12px dan kichik matn,
  konsol xatolari). Batafsil: `design/README.md`.
- Asl nusxa egadagi Claude Design kanvasi. Dasturchilar uchun manba esa repodagi `design/`. Maket fayllari qo'lda
  tahrirlanmaydi, faqat ega yoki dizaynerning sinxron PR'i orqali o'zgaradi. Yagona istisno
  `design/kit/route-map.json` (route ↔ maket xaritasi, quyida).

## Har qanday UI o'zgarishi dizayn v2 bo'yicha

Kim yozishidan qat'i nazar (odam yoki agent), UI'ga tegadigan har o'zgarish shu oqim bo'yicha:

```text
UI'ga tegadimi? ── yo'q ─→ bu bo'lim talab qilmaydi
   │ ha
   ├─ Yangi ekran / komponent / dialog / bo'lim ........... to'liq v2: maket + tokenlar + primitivlar
   ├─ v2 ga ko'chirilgan sahifa (`// dizayn-v2:` bor) ..... faqat v2; eski klass, komponent, uslub qaytmaydi
   └─ Eski (v1) sahifa
        ├─ ko'rinishga tegmaydigan tuzatish (mantiq, API, matn) ....... ko'rinish o'zgarishi shart emas
        ├─ kichik UI qo'shimchasi (tugma, ustun, maydon, badge) ......... yangi yoki tegilgan qism v2 da
        └─ katta o'zgarish (bo'limni qayta tuzish; yangi karta, jadval,
           dialog yoki forma; bo'limning yarmidan ko'pi) ................ o'sha bo'lim to'liq v2 ga ko'chiriladi
```

- **Eski uslub kengaytirilmaydi.** Eski klass satrini nusxalamang. Yangi `bg-main`, `text-maindark`, `dark:`,
  `bg-white`, rang oilasi qo'shmang. Eski komponentning v1 ko'rinishini yangi joyga olib o'tmang.
- **Bitta element ichida aralash bo'lmaydi.** Karta, jadval yoki dialog v2 ga o'tsa, ichidagi tugma, badge va
  maydonlar ham v2. Shuning uchun eski sahifaga yangi v2 element qo'shilsa, uni o'rab turgan **eng kichik
  karta/bo'lim** ham v2 ga ko'chiriladi. Bu «kichik» doiradan oshib ketsa, yangi element eski kartaga
  tiqilmaydi — o'zining alohida v2 bloki bo'lib, eski karta yonida turadi.
  *Misol:* kuryer buyurtmalar sahifasiga (`src/pages/orders/list/courier/index.tsx`, sarlavha kartasi
  `bg-primary dark:bg-maindark …`) filtr qo'shilsa — sarlavha kartasi (sarlavha + tablar + filtr) birga v2 ga
  o'tadi; sahifaning qolgan qismi (ro'yxat) eski holicha qolishi mumkin.
- **Bir nechta sahifa ishlatadigan umumiy widget** (`SuccessRateCard`, `DashboardGrid`, `TopRankCard`, `RegionDetailDialog` …)
  bitta sahifa uchun «yo'l-yo'lakay» qayta bo'yalmaydi — u boshqa rollarning sahifalarini ham jimgina o'zgartiradi.
  Ikki yo'l: (1) widget alohida PR'da ko'chiriladi va **har bir** iste'molchi ekranining skrinshoti ilova qilinadi
  (ro'yxat: `design/SCREENS.md` §6 «Fayl → route»); (2) yangi v2 komponent yoniga yaratiladi, eskisi tegilmaydi.
- **Sahifa to'liq ko'chirilsa** (4-bosqich qoidasi): alohida PR, maketdagi barcha holatlar (bo'sh, yuklanish, xato,
  dialoglar, telefon), faylning birinchi qatorida `// dizayn-v2: <ekran>[, <ekran>]`.
- **Route qo'shilsa, o'chirilsa yoki sahifa ko'chirilsa:** `design/kit/route-map.json` yangilanadi va
  `npm run design:screens` yuriladi (`design/SCREENS.md` qayta yoziladi, qo'lda tahrirlanmaydi).
- **Menyu bandi** (`src/widgets/Sidebar/model/menuConfig.tsx`) faqat maketdagi menyu (`design/kit/roles.json`) bilan
  birga qo'shiladi yoki olinadi. Yangi band uchun avval ega maketni yangilaydi.
- **Maket yo'q bo'lsa:** `docs/DESIGN_SYSTEM.md` va eng yaqin maket asos bo'ladi, PR'da «Maket yo'q — eng yaqini:
  `<ekran>`» deb yoziladi. Katta yangi ekran uchun avval egadan maket so'raladi. Maketsiz yangi route
  `design/kit/route-map.json` ga `"views": {}` va `"roleNotes": { "<rol>": "Maket yo'q — eng yaqini: <ekran>" }`
  bilan yoziladi; v2 da yozilgan maketsiz sahifa belgisi: `// dizayn-v2: (maket yo'q) <eng yaqin ekran>`.
- **Maket elementni ataylab yashirgan bo'lsa** (masalan `courier-orders-all` telefonda faqat qidiruv, filtrlar
  `el-hide-mobile`; yoki element boshqa rolda bor, bu rolda yo'q) — bu «maket yo'q» emas, **dizayn ziddiyati**:
  kod yozishdan oldin egadan so'raladi, taklif sifatida shu breakpoint/rolning eng yaqin namunasi ko'rsatiladi
  (masalan `superadmin-orders-filters-mobile`).
- **So'rov dizaynga zid bo'lsa** (yangi rang, gradient, maketda yo'q uslub), kod yozilmaydi, avval ega qaror qiladi.
  Maket «kod qulay bo'lsin» deb o'zgartirilmaydi.
- **Tokenlar** (`src/index.css`, `themeTokens.ts`) va **shell** (`widgets/layout`, `widgets/Sidebar`,
  `widgets/header`) faqat o'z bosqichining PR'ida yoki ega roziligi bilan o'zgaradi.

## Dizayn v2 (ega qarori, qulflangan)
- **Ranglar faqat tokenlardan.** `bg-surface`, `text-text-muted`, `border-border`, `bg-action text-on-solid`,
  `bg-success-soft text-success-fg` … Yangi kodda hex/`rgb()`, Tailwind rang oilalari (`bg-blue-500`,
  `text-gray-400`), `dark:` juftlari va eski nomlar (`main`, `maindark`, `primary` — bu **oq** yuza, brend emas,
  `primarydark`, `purple*`, `border-soft`, `sidebar`, `error` …; to'liq jadval `docs/DESIGN_SYSTEM.md` §2)
  **yozilmaydi**. Token yetmasa, `src/index.css` va `src/shared/config/themeTokens.ts` ga birga qo'shing
  (`themeTokens.test.ts` ularni solishtiradi).
- **Brend:** navy `#1f2853` + ko'k action. Binafsha/indigo (`#7c3aed`, `#6366f1`, `#576adb`) qaytarilmaydi
  (`src/test/paletteGuard.test.ts`). Ko'k faqat interaktiv narsa uchun.
- **Sukut mavzusi kunduzgi.** Shrift Manrope. Matn 12px dan kichik emas.
- **Pul/son/foiz** faqat `src/shared/lib/formatMoney.ts` orqali (`formatMoneyLocalized`, `formatCompactMoneyLocalized`,
  `formatNumberLocalized`, `formatPercentLocalized`) yoki uning `designSystem.ts` dagi o'ramlari (`formatMoney`,
  `formatCompactMoney`, `formatCompactAxisMoney`). `Intl.NumberFormat("uz-UZ")`, `.toFixed(1) + "%"` va qo'lda
  `" so'm"` qo'shish taqiqlanadi. `designSystem.ts` dagi `TYPO`, `TEXT`, `TONE`, `toneAccent`, `formatPercent` — v1.
  Valyuta: uz `so'm` · ru `сум` · en `UZS`.
- **Ikonkalar** faqat `lucide-react` (`design/icon-registry.json` dagi kanonik nom).
- **Holat** rangi faqat matn yoki ikonka bilan birga. Ton qoidasi: `docs/DESIGN_SYSTEM.md` §8.
- **Telefon:** bosiladigan har narsa ≥ 44px, jadval → kartalar, dialog → pastdan oyna, gorizontal skroll yo'q.
  Breakpointlar: telefon `max-md:` (< 768), planshet `max-lg:` (< 1024).
- **Matn:** o'zbek lotin, gap registri, inglizcha so'z yo'q. uz/ru/en uchala locale birga yangilanadi.
- **Bitta ekranda bitta asosiy amal**, karta ichida karta yo'q (ko'pi bilan 2 qavat), pul o'tkazish, nofaol qilish
  va «Kunni yakunlash» tasdiqlash oynasi orqali.
- **Forma, dialog, holatlar — faqat 3-bosqich primitivlari** (`src/shared/ui/primitives`, namunasi `/ops/ui-kit`):
  - **Xabar** — `notify.success|info|warning|error(sarlavha, { description, action, duration })`
    (`src/shared/lib/notify.ts`; React'dan tashqarida ham). antd `message` / `notification` / `App.useApp()` —
    **taqiqlangan** (ESLint). `duration` — millisekund; xato foydalanuvchi yopguncha turadi.
  - **Tasdiq** — `const confirm = useConfirm(); if (await confirm({ title, description, confirmLabel, tone, … }))`
    yoki deklarativ `ConfirmDialog`. Tugmada aniq fe'l («Nofaol qilish», «O'chirish», «Tasdiqlash»), «Ha» / «OK»
    emas; buzuvchi amal — `tone: "danger"`. antd `Popconfirm`, `Modal.confirm`, brauzer `confirm`/`alert`/`prompt`
    — **taqiqlangan** (ESLint). Pul o'tkazish, kassa/to'lov amali, «Kunni yakunlash», nofaol qilish, API kalitini
    almashtirish, hamkorni o'chirish **majburiy** tasdiq bilan (maketdagi `*-dialog` matnlari).
  - **Oyna** — `Dialog` (telefonda o'zi pastki varaqa, fokus tuzog'i, Esc, skroll qulfi). Forma maydoni — `Field`
    ichida `TextInput` / `Select` / `DateRange` / `DateInput` (yorliq, majburiy belgisi, izoh, xato matni).
  - **Ro'yxat** — jadval `DataTable` (telefonda `renderCard` → kartalar, server saralashi, tanlov), sahifalash
    `Pagination` (`Card footer`); v1 `shared/components/Table` va `shared/components/pagination` o'chirilgan.
  - **Holatlar** — so'rovli blok `QueryBoundary` (yuklanish skeleti, bo'sh — `EmptyState`, xato — `ErrorState` +
    «Qayta urinish») bilan; qo'lda «Yuklanmoqda…» / «Ma'lumot yo'q» yozilmaydi.
  - Global qatlam (`ConfirmHost` + `Toaster`) ilovada bir marta — `app/providers/UiHost.tsx`; testda
    `renderWithProviders` uni o'zi qo'shadi (tasdiq va xabarni haqiqiy UI orqali tekshiring, `notify`/`confirm` ni
    mock qilmang).

## Dizayn qo'riqchisi (CI)

CI (`.github/workflows/deploy.yml`) har PR'da `npm run lint` → `npm test` → `npm run build` →
`npm run check:bundle` → Playwright e2e (`npx playwright test`, `tests/e2e`, API mock) ni yuradi. Biri yiqilsa,
merge va deploy bo'lmaydi. E2E'ni push oldidan lokalda ham yurgizing: `npm run test:e2e`. Yonida alohida **«Visual»**
workflow (`.github/workflows/visual.yml`, vizual snapshotlar — quyida) parallel yuradi.
`npm test` ichidagi dizayn tekshiruvlari:

- `src/test/designGuard.test.ts` (`scripts/design-guard.mjs`): rang literallari, Tailwind palitrasi (`bg-white`
  ham), `dark:` rang juftlari, eski token nomlari, nomli CSS ranglari (`stroke="white"`, `color: "red"`), qo'lda pul
  formati, boshqa ikonka kutubxonalari, 12px dan kichik matn. Ratchet usulida ishlaydi: `design/guard-baseline.json`
  dagi son har fayl uchun faqat **kamayadi**, yangi faylda 0. `// dizayn-v2:` belgili faylda esa har doim 0.
- `src/test/paletteGuard.test.ts`: eski brend ranglari qaytmasin; **ko'chirilgan papkalar** (`V2_SCOPES`,
  `scripts/design-guard.mjs`) ichidagi har fayl — `// dizayn-v2:` belgisiz yordamchi ham — rang qoidalarida 0;
  rangda toza v2 papkani `V2_SCOPES` ga qo'shishni o'zi talab qiladi; `src` da yangi CSS fayl yo'q.
- `src/test/lintRatchet.test.ts`: ESLint istisno ro'yxatlari (`scripts/eslint-design-v2.mjs`) faqat qisqaradi,
  `design-v2` disable izohida sabab bor, `STAGE_A_PENDING` bo'sh.
- `src/test/visualCiVersion.test.ts`: «Visual» Docker obrazi tegi = package.json dagi aniq Playwright versiyasi.
- `src/shared/config/themeTokens.test.ts`: `index.css` ↔ `themeTokens.ts` mosligi va kontrast.
- `src/test/inputFontGuard.test.ts`: telefonda maydon shrifti 16px (iOS zoom).
- `design/tools/screens.test.mjs` (`npm run design:screens -- --check`): `routes.tsx` dagi har route
  `design/kit/route-map.json` da bor, har maket biror route'ga bog'langan, menyu bandlari maketdagi menyu bilan bir xil
  va `design/SCREENS.md` yangi.

Qoidalar (`scripts/design-guard.mjs`): `colour`, `palette`, `dark-pair`, `legacy`, `named-colour`, `money`, `icons`,
`tiny-text`, `v1-class` (`index.css` dagi eski `el-card`, `el-glass-control`, `el-segmented*` …), `weight` (`font-black`,
`font-extrabold`), `gradient` (`bg-linear-*`, `linear-gradient(…)`), `v1-helper` (`TYPO`, `TEXT`, `TONE`,
`toneAccent`, `formatPercent`, `HeaderName`, `MetricCard`; 1-bosqich o'rnini bosgan, 5-bosqichda o'chirilgan v1
modullari importi qaytmasin: `shared/components/button` → `Button`, `shared/ui/StatusBadge` va
`pages/orders/list/OrderStatusBadge` → `StatusBadge` / `OrderStatusBadge`, `shared/config/statusColorMap` →
`statusRegistry` + `tone.ts`, `shared/lib/formatDate` → `formatDateTimeLocalized`).

- **ESLint** (`npm run lint`, CI'da birinchi qadam): antd `message` / `notification` / `Popconfirm` importi,
  `Modal.confirm|info|success|error|warning`, `Modal.useModal`, `App.useApp`, `<Popconfirm>`, `window.confirm` /
  `alert` / `prompt` va global `confirm()` — xato (o'rniga `notify`, `useConfirm()`, `Dialog`). `eslint-disable` faqat
  asosli istisno uchun, sababi bilan.
- **ESLint, dizayn v2** (5-bosqich, `docs/DESIGN_SYSTEM.md` §12.2; ma'lumot — `scripts/eslint-design-v2.mjs`):
  - `design-v2/raw-control` — xom `<button>`, `<select>`, `<textarea>`, matn `<input>` (`type` siz, matn turi,
    dinamik), `<dialog>`, `role="button"` va `bg-action`/`bg-success`/`bg-danger` li `<a>`/`<Link>` — xato. Amal —
    `Button` / `IconButton`; karta, qator-karta, chip, chip «×», menyu bandi, kalit (`role="switch"`), ochib-yopish,
    matn-havola — **`Pressable`** (uslubsiz `<button type="button">`); maydon — `Field` + `TextInput` / `Select` /
    `DateInput`; oyna — `Dialog`; havola-tugma — `buttonClasses({ variant })`. `type="checkbox|radio|file|hidden"`
    ruxsat. Dizayn tizimi qatlami (`src/shared/ui/**`, shell `widgets/layout|Sidebar|header`) va testlar — istisno.
  - `design-v2/ui-imports` — antd'dan faqat `ConfigProvider`, `theme`, `QRCode` (`import type` ham taqiq, `antd/*`
    faqat `antd/locale/*`); `@ant-design/icons` va boshqa ikonka kutubxonalari — xato.
  - `jsx-a11y/anchor-is-valid`; keraksiz `eslint-disable` izohi ham xato (`reportUnusedDisableDirectives`).
  - Istisno: `// eslint-disable-next-line design-v2/raw-control -- <sabab>` (sabab majburiy, test tekshiradi; hozir
    1 ta — `CampaignPage` prefiksli maydon; bekorlardagi kamera tugmasi skaner 2-bosqichida olindi); v1 fayllar —
    ratchet ro'yxatlarida (faqat qisqaradi: `SalaryPaymentPopup`, `PrintModeSelect`). Qoidalar hamma joyda
    **xato** — `warn` bosqichi (`STAGE_A_PENDING`, G2/G3 qurilayotganda) tugagan, ro'yxat bo'sh bo'lishi shart (test).
- **Vizual snapshotlar** («Visual» workflow, `docs/DESIGN_SYSTEM.md` §12.5): 23 sahna (har rolning bosh va eng ko'p
  ishlatiladigan ekranlari) × kunduzgi/tungi × 1440/390 = 92, mock API, `tests/visual/`. Baseline'lar faqat CI'da,
  Playwright Docker obrazida yaratiladi va solishtiriladi — **lokal Docker yoki lokal vizual yugurish shart emas**.
  Har draft bo'lmagan PR'da yuradi: baseline yo'q bo'lsa — neytral (yashil, Summary'da «baseline yo'q»), bor bo'lsa —
  farq yiqitadi (artefaktlar `visual-report`, `visual-baselines`). Hozircha maslahat: baseline'lar yaratilib, 5 ta
  ketma-ket yashil PR yugurishidan keyin ega `dev` uchun required qiladi.
  - **Baseline yaratish / yangilash** (`visual.yml` `dev` da bo'lgach — GitHub «Run workflow» tugmasini faqat default
    branch'dagi workflow uchun ko'rsatadi; uni `dev` ga olib kiradigan birinchi PR neytral): GitHub → Actions →
    **Visual** → **Run workflow** → branch, «update» ✓ → PNG'lar obrazda qayta yaratiladi va shu branchga commit
    qilinadi («test(visual): baseline'lar yangilandi [skip ci]»; `main`/`dev` ga emas — u yerda faqat artefakt). So'ng
    lokalda `git pull`; bot commit'i PR tekshiruvlarini qayta yurgizmaydi — keyingi push (yangi commit) bilan, PR'ni ham
    bot commit'idan keyingi commit bilan oching. Farq faqat **kutilgan** bo'lsa yangilanadi va PR'da ko'rsatiladi.
  - Lokal: faqat `VISUAL_DRY=1` (chizish + tekshiruvlar, solishtirishsiz) — `npm run visual:build`, so'ng
    `VISUAL_DRY=1 npx playwright test -c playwright.visual.config.ts --project desktop-light -g <sahna>`.
    `--update-snapshots` lokalda rad etiladi. Ixtiyoriy: `npm run visual:pull` (artefaktni olish, gh CLI yoki
    `-- --from <zip>`), `npm run visual:docker` (Docker bor bo'lsa, solishtirish).
- **PR diff qadami** (CI, faqat PR'da): `npm run design:guard -- --diff origin/<base>` — PR'da **qo'shilgan**
  qatorlarda yangi buzilish bo'lmasin. Eski qatorni tahrirlash yoki kodni ko'chirish o'tadi, lekin bir joyda
  `bg-white` ni o'chirib boshqa joyga `text-gray-400` qo'shish o'tmaydi (ratchet buni ko'rmaydi, diff ko'radi).

Lokal tekshiruv: `npm run design:guard -- --diff` (push oldidan, `origin/dev` bilan), `npm run design:guard -- <fayl>`
(har buzilish va uning v2 o'rnini bosuvchisi) yoki `npm run design:guard -- --changed`. Eski fayldagi buzilishlarni
kamaytirgach `npm run design:guard -- --update` bilan yangi sonni qotiring, aks holda keyingi PR ularni qaytara oladi.

Qo'riqchi hammasini ushlamaydi: rangsiz maxsus soya, `sm:` ni telefon chegarasi sifatida ishlatish, ikkinchi asosiy
tugma, karta ichidagi karta va `Pressable` ga `.el-btn` ko'rinishi (fon + radius + balandlik — bu `Button`) berilgani
review'da tekshiriladi (`docs/DESIGN_SYSTEM.md` §12.7). Vizual sahnasi yo'q sahifa — PR'dagi kunduzgi / tungi /
390px skrinshotlar bilan.

Qo'riqchini o'chirish, testni yumshatish, baseline'ni oshirish (`--allow-increase`) va sababsiz
`design-guard-ignore` **taqiqlanadi**. Asosli istisno bo'lsa, sababi belgining o'zida yoziladi, PR'da ko'rsatiladi
va ega rozi bo'ladi.

## AI agentlar (Claude Code, Codex …)

- **Claude Code:** UI ishida `.claude/skills/elchi-design/SKILL.md` skill'i yuklanadi (avtomatik yoki
  `/elchi-design`). U 8 qadamli tartibni beradi: qoidalar → maketni topish → maketni o'qish va **ko'rish**
  (`npm run design:shot`) → CODE-MAP bo'yicha yozish → eski uslubsiz → 390/768/1440 + tungi tekshiruv →
  lint/test/build → maket yo'q bo'lsa eng yaqini.
- **Codex va boshqa agentlar:** UI ishidan oldin `.claude/skills/elchi-design/SKILL.md` ni o'qing va xuddi shu
  tartibda ishlang.
- Agent maketni taxmin qilmaydi: fragment HTML'ini o'qiydi va PNG'ni ko'radi. Agent yozgan kod ham shu qoidalarga
  bo'ysunadi. Tekshirilmagan narsa «tekshirildi» deb yozilmaydi.

## Ish tartibi
- Push qilishdan **oldin** to'liq `npm test` (nishonli test menyu invariantlarini, ya'ni `ops.reachability.test.ts`
  ni, o'tkazib yuboradi), `npm run design:guard -- --diff` va `npm run build` (CI `tsc -b` qat'iy).
- **Backend maydoni yoki filtri** qo'shishdan oldin API'da borligini tekshiring: `../Elchi-Backend/docs/frontend/openapi.json`
  (endpointlar ro'yxati: `src/shared/api/endpoints.ts`). Yo'q query param yoki maydon UI'ga chizilmaydi — avval
  backend bilan kelishiladi.
- **Rol bo'yicha tekshirish** uchun test akkauntlarini egadan so'rang (superadmin, admin, menejer, registrator,
  market, kuryer). Parol kodga, commit'ga, chatga yoki PR'ga yozilmaydi. Menejer va kuryer tablari filial turiga
  bog'liq (`REGIONAL` · `HYBRID` · `HQ` · `PICKUP`, `menuConfig.tsx` dagi `MANAGER_CAPABILITIES`) — kerakli turdagi
  filial akkauntini so'rang.
- Kodni `origin/dev` bo'yicha tekshiring, lokal branch eskirgan bo'lishi mumkin.
- `.env.local` hech qachon commit qilinmaydi.

## PR tekshiruv ro'yxati (UI'ga tegadigan har PR)

`.github/pull_request_template.md` dagi ro'yxat to'ldiriladi:

- [ ] maket topildi: `<rol>-<viewId>` (yoki «maket yo'q — eng yaqini: …»)
- [ ] kunduzgi, tungi va 390px (kerak bo'lsa 768px) skrinshotlar ilova qilingan
- [ ] faqat tokenlar; eski nomlar, hex, rang oilalari, `dark:` juftlari yo'q
- [ ] `formatMoney`, `lucide-react`, uz/ru/en matnlar
- [ ] eski sahifada: tegilgan qism v2 da, eski uslub kengaytirilmagan
- [ ] xom `<button>` / `<select>` / matn `<input>` / `<textarea>`, antd vizual komponenti va `@ant-design/icons` yo'q
  (`npm run lint` — `design-v2/*`); sirt — `Pressable`, amal — `Button` / `IconButton`
- [ ] dizayn qo'riqchisi yashil (`npm test` + `npm run design:guard -- --diff`), baseline oshirilmagan
- [ ] «Visual» yashil; farq kutilgan bo'lsa — «Actions → Visual → Run workflow» (update ✓) bilan baseline yangilangan
  va diff (`visual-report`) ko'rib chiqilgan
- [ ] `npm run lint`, to'liq `npm test`, `npm run build` yashil
