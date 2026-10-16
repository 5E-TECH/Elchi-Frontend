---
name: elchi-design
description: >-
  Elchi CRM dizayn v2 bo'yicha UI ish tartibi (MAJBURIY). Bu repoda UI'ga tegadigan HAR QANDAY ishdan oldin yuklang:
  yangi sahifa yoki ekran, mavjud sahifani tahrirlash, komponent, dialog yoki modal, forma, jadval, filtr, grafik yoki
  dashboard, Tailwind klasslari, ranglar, shrift, layout, telefon/planshet ko'rinishi, tungi mavzu, ikonkalar,
  kichik vizual tuzatish ham. Use for ANY UI/frontend change in this repo: new page, editing a page, component,
  styles, colours, layout, dialog, table, form, chart, mobile or tablet view, dark mode, icons.
---

# Elchi dizayn v2: UI o'zgarishi tartibi

Loyiha **dizayn v2** ga bosqichma-bosqich o'tmoqda. Ega tasdiqlagan maketlar repoda turadi (`design/`, 411 ekran ×
desktop/planshet/telefon × kunduzgi/tungi). Frontenddagi har bir o'zgarish, kim so'raganidan qat'i nazar, shu
maketlar va `docs/DESIGN_SYSTEM.md` bo'yicha qilinadi. Bu tartib ixtiyoriy emas. Qadamni o'tkazib yuborsangiz, buni
javobda ochiq ayting.

Foydalanuvchi so'rovi dizayn v2 ga zid bo'lsa (binafsha yoki boshqa yangi rang, gradient, maketda yo'q uslub, 12px dan
kichik matn, ikkinchi asosiy tugma), bajarishdan oldin ziddiyatni ayting va ega qarorini kuting. Dizaynni
o'zboshimchalik bilan o'zgartirmang.

## 1. Qoidalarni o'qing

- `AGENTS.md`: jamoa qoidalari va «eski sahifani tahrirlash» qaror oqimi.
- `docs/DESIGN_SYSTEM.md`: tokenlar, tipografiya, o'lchamlar, breakpointlar, pul/sana formati, holat → ton.
- `design/README.md`: maketlar qayerda va qanday ko'riladi (bir marta).

## 2. Maketni toping

1. `design/SCREENS.md` da route yoki sahifa fayli bo'yicha qidiring (`grep -n "src/pages/<papka>" design/SCREENS.md`).
   U ekran nomini (`<rol>-<viewId>`), sahifa holatini (`eski` / `v2` / `yangi (kodda yo'q)` / `qisman`) va izohni beradi.
2. Sahifani **qaysi rollar** ko'rishini aniqlang (SCREENS.md dagi «Rollar» va «Menyuda» qatorlari; manbasi
   `src/app/lib/routes.tsx` + `src/app/lib/access.ts` va `src/widgets/Sidebar/model/menuConfig.tsx`). Har rolning o'z
   maketi bor va farqlari muhim. Har rol ekranini oling.
3. Bo'limning dialog va holat ekranlarini ham oling:
   ```bash
   node -e 'for (const v of require("./design/kit/views.json").views) if (v.role==="manager" && v.menuKey==="orders") console.log(`${v.role}-${v.viewId}`, "·", v.kind, "·", v.title, "·", v.fragment)'
   ```
4. Komponent holatlari uchun taxtalar: `tizim-states-buttons`, `tizim-states-forms`, `tizim-states-navigation`,
   `tizim-states-data`, `tizim-loading`, `tizim-feedback`, `tizim-errors`, `tizim-charts`, `tizim-scanner`,
   `tizim-responsive`, `Main`.

## 3. Maketni o'qing va KO'RING

```bash
cat design/fragments/<fragment>.html      # tuzilma, aniq matnlar, qaysi el-* klasslar
cat design/fragments/<fragment>.json      # kind, height, dialog, devices
npm run design:shot -- <ekran>            # 6 PNG → design/shots/<ekran>--<desktop|tablet|phone>-<light|dark>.png
```

Keyin PNG'larni **Read** qiling: kamida `--desktop-light`, `--tablet-light`, `--phone-light`, `--desktop-dark`,
`--phone-dark`. Fragment nomi `views.json` dagi `"fragment"` (ekran nomidan farq qilishi mumkin). Faqat bitta
ko'rinish kerak bo'lsa: `npm run design:shot -- <ekran> --device phone --theme dark`.

Uzun ekran (telefon PNG'i 2000px dan baland) Read'da kichrayib, mayda matn o'qilmaydi. Bo'laklab oling:
`npm run design:shot -- <ekran> --device phone --split 1200` → `<ekran>--phone-light-1.png`, `-2.png` … ni o'qing.
Aniq matn uchun har doim fragment HTML'i ustun (`views.json` / `route-map.json` dagi sarlavhalar — faqat yorliq).

Maketdan yozib oling: bo'limlar tartibi; aniq matnlar; asosiy amal (bitta); holat badge tonlari; planshet va telefonda
nima yashirinadi yoki kartaga aylanadi; bo'sh, yuklanish va xato holatlari; dialog telefonda pastki varaqa.

- Maket eskirgan ko'rinsa (`design/` yangilangan): `npm run design:build -- --view <ekran>`, keyin qayta shot.
- Chromium topilmasa: `npx playwright install chromium`.

## 4. Amalga oshiring

- Klasslarni `design/CODE-MAP.md` bo'yicha tarjima qiling. Maketdagi `el-*` nomini JSX'ga **ko'chirmang**:
  `index.css` dagi `.el-card`, `.el-segmented` va boshqalar eski v1 klasslari.
- Avval 1-bosqich primitivlari — `src/shared/ui/primitives` (barrel, faqat nomli eksport):
  `import { Button, IconButton, Spinner, Badge, StatusBadge, Card, StatCard, PageHeader, Tabs, SegmentedControl }
  from "…/shared/ui/primitives"`; ton klasslari `TONE_SOFT` / `TONE_FG` / `TONE_SOLID` / `TONE_RING` (`tone.ts`).
  Buyurtma holati — `OrderStatusBadge` (`src/entities/order`; matn va ton `statusRegistry.ts` dan, shared'da emas).
  Sana/vaqt — `formatDateTimeLocalized` / `formatDateLocalized` / `formatTimeLocalized` (`src/shared/lib/formatDateTime.ts`),
  telefon — `formatPhone` / `toTelHref` (`formatPhone.ts`), ishorali pul — `formatSignedMoneyLocalized`, klass
  birlashtirish — `cx` (`src/shared/lib/cx.ts`). Hammasining namunasi: `/ops/ui-kit` (superadmin).
  v1 o'rnini bosuvchilar: `shared/components/button` → `Button`, `shared/ui/StatusBadge` va
  `pages/orders/list/OrderStatusBadge` → `StatusBadge` / `OrderStatusBadge`, `statusColorMap` → `statusRegistry` +
  `tone.ts`, `shared/lib/formatDate` → `formatDateTimeLocalized` (qo'riqchi yangi importni ushlaydi).
- **Forma, dialog, holatlar — 3-bosqich primitivlari (tayyor)**, o'sha barreldan; namunasi
  `/ops/ui-kit?section=forms|select|date|dialog|feedback|states|table`, klass retseptlari CODE-MAP (`.el-field`,
  `.el-select`, `.el-cal*`, `.el-dialog*`, `.el-toast*`, `.el-empty*`, `.el-skel*`):
  - maydon — `<Field label hint error required>` ichida `TextInput` (`mode="phone"|"search"`, `multiline`),
    `Select` (`searchable`, `multiple`), `DateRange` (tez tanlov: bugun, hafta, oy, barchasi) / `DateInput`;
  - oyna — `Dialog` (telefonda pastki varaqa o'zi); tasdiq — `const confirm = useConfirm()` →
    `await confirm({ title, description, confirmLabel: "<aniq fe'l>", tone, details, amount, transfer, consequences,
    irreversible, onConfirm })` yoki deklarativ `ConfirmDialog`. Pul o'tkazish, kassa amali, «Kunni yakunlash»,
    nofaol qilish, kalitni almashtirish — **har doim** tasdiq bilan, maketdagi `*-dialog` matnlari bilan;
  - xabar — `notify.success|info|warning|error(sarlavha, { description, action, duration /* ms */ })`
    (`src/shared/lib/notify.ts`);
  - holatlar — `QueryBoundary` (skelet → `EmptyState` / `ErrorState` + «Qayta urinish»), `Skeleton*` presetlari;
    sahifa umuman ochilmasa — `size="page"` (namunasi: `shared/ui/NotFound.tsx`, `ErrorBoundaryPage.tsx`).
  - **ro'yxat sahifasi (4-bosqich standarti)** — jadval `DataTable` (ustunlar, `density`, server saralashi `sort` /
    `onSortChange`, `selection`, telefonda `renderCard` → kartalar), sahifalash `Pagination` (`Card padding="none"
    footer={<Pagination … />}`), ikkalasi o'sha barreldan; namunasi `/ops/ui-kit?section=table`, ishlatilishi —
    `src/pages/orders/list/OrdersTable.tsx` (CODE-MAP §2.6). `shared/components/Table` va
    `shared/components/pagination` (v1) yangi kodda ishlatilmaydi.
  - ro'yxat, kalendar, dialog `#ui-portal` da: sahifadagi `document` «tashqariga bosish» tinglovchisi
    `if (isInUiLayer(event.target)) return;` bilan boshlanadi (aks holda panel ichidagi ro'yxat panelni yopadi).
  - v1 o'ramlari (`SearchableSelect`, `FilterSelect`, `FilterMultiSelect`, `PopupSelect`, `DateRangePicker`,
    `FilterDateRange`, `QuickDateRangeFilter`, `Popup`, `FormPopup`, `PopupConfirm`, `UpdatePopup`, `ConfirmButton`,
    `EmptyState`, `QueryErrorState`, `TableSkeleton`, `PhoneInput`, `SearchInput`) API'si saqlangan, ichi v2 —
    eski sahifa ishlayveradi; **yangi kodda** to'g'ridan-to'g'ri primitivni ishlating.
  - Testda `renderWithProviders` (`src/test/test-utils.tsx`) `ConfirmHost` va `Toaster` ni o'zi qo'shadi: tasdiqni
    `findByRole("alertdialog", { name })` → tugma bosish, xabarni `findByText` bilan tekshiring.
- Faqat tokenlar: `bg-surface`, `text-text-muted`, `border-border`, `bg-action text-on-solid`,
  `bg-success-soft text-success-fg` … JS'da `themeTokens(theme)`, `CHART_PALETTE[theme]`.
- Pul va son faqat `src/shared/lib/formatMoney.ts`. Ikonka faqat `lucide-react` (`design/icon-registry.json` dagi
  nom). Matn locale'da: uz/ru/en uchalasi birga, o'zbekchasi maketdagidek.
- Breakpoint: telefon `max-md:` (< 768), planshet `max-lg:` (< 1024). `sm:` telefon chegarasi emas.
- Maketda yo'q funksiya yoki ma'lumot qo'shilmaydi. Backend bermaydigan maydon chizilmaydi («Taklif» belgisi).
  Yangi filtr yoki maydon uchun API'ni tekshiring: `../Elchi-Backend/docs/frontend/openapi.json` (hook'dagi param
  tiplari, masalan `src/entities/orders/index.ts`, yetarli dalil emas). Yo'q bo'lsa — to'xtang va ayting.
- Pul, son, foiz: `formatMoneyLocalized`, `formatCompactMoneyLocalized`, `formatNumberLocalized`,
  `formatPercentLocalized` (uz `67,4%`). `designSystem.ts` dan faqat `formatMoney`, `formatCompactMoney`,
  `formatCompactAxisMoney` (grafik o'qi), `ratio`; `TYPO`, `TEXT`, `TONE`, `toneAccent`, `formatPercent` — v1.
- Eski (v1) sahifada: `AGENTS.md` qaror oqimi. Tegilgan qism v2 ga o'tadi, uni o'rab turgan **eng kichik
  karta/bo'lim** bilan birga (aralash karta bo'lmaydi); bu katta bo'lsa — yangi element alohida v2 blokda. Eski uslub
  kengaytirilmaydi. Katta o'zgarishda o'sha bo'lim to'liq ko'chiriladi. Umumiy widget (bir nechta route ishlatadi —
  `design/SCREENS.md` §6) shu PR'da qayta bo'yalmaydi: alohida PR + har iste'molchi skrinshoti, yoki yangi v2
  komponent yonida. Sahifa to'liq ko'chirilsa, faylning birinchi qatoriga
  `// dizayn-v2: <ekran>[, <ekran>]` belgisi qo'yiladi.
- Route qo'shsangiz, o'chirsangiz yoki sahifani v2 ga ko'chirsangiz: `design/kit/route-map.json` ni yangilang va
  `npm run design:screens` ni yuring (`design/SCREENS.md` qayta yoziladi; `-- --check` xarita to'liqligini tekshiradi,
  `npm test` ham shuni tekshiradi). Menyu bandi (`menuConfig.tsx`) faqat maketdagi menyu (`design/kit/roles.json`)
  bilan birga o'zgaradi.
- **Shell tayyor (2-bosqich)** — sahifa uni qayta chizmaydi: `widgets/layout/dashboardLayout.tsx` (kanvas, yagona
  skroll, `RouteProgress`), `widgets/Sidebar` (`Sidebar`, `MobileMenu`, `BottomNav`; bandlar, ruxsat va ikonkalar —
  `model/menuConfig.tsx`, ko'rinish — `model/navSections.ts`), `widgets/header` (`Header`, `HeaderSearch` /
  `SearchScreen`, `NotificationsMenu`, `UserMenu`, `ShortcutsDialog`). Sahifa `[data-shell-slot=content]` ichida
  chiziladi: o'ziga tashqi karta, tashqi `p-*`/`px-*` chekka, `h-screen`/o'z skroll konteyneri, pastki menyu yoki
  uning joyi qo'shilmaydi (kanvas, `max-w-[1440px]`, chekkalar va telefonda pastki menyu joyi shell'da). Ildiz —
  `flex flex-col gap-6 max-md:gap-4`. Sahifadagi pastga yopishgan panel (`fixed bottom-*`) telefonda
  `bottom-[calc(var(--shell-bottomnav-h)+…)]` bilan pastki menyu ustida turadi. Klasslar — CODE-MAP §2.10.
- Sahifa PR'ida tegilmaydiganlar: tokenlar (`src/index.css`, `themeTokens.ts`), shell (`widgets/layout`,
  `widgets/Sidebar`, `widgets/header`), `design/` maket fayllari (`fragments/`, `kit/` — `route-map.json` dan
  tashqari, `assets/`).

## 5. Eski uslub qaytmaydi

Yangi yoki o'zgargan qatorlarda bo'lmasligi kerak: hex / `rgb()` / `hsl()`, Tailwind rang oilalari (`bg-blue-500`,
`text-gray-400`), `dark:` juftlari, eski nomlar (`main`, `maindark`, `primary`, `primarydark`, `purple*`,
`border-soft`, `card-surface`, `page-surface`, `dashboard-*`), 12px dan kichik matn (`text-[11px]`), `font-black` /
`font-extrabold`, gradient, v1 klasslari (`el-card`, `el-glass-control`, `el-segmented*`), v1 yordamchilari (`TYPO`,
`TEXT`, `toneAccent`, `formatPercent`, `HeaderName`, `MetricCard`), v1 komponent importlari (`shared/components/button`,
`shared/ui/StatusBadge`, `pages/orders/list/OrderStatusBadge`, `statusColorMap`, `shared/lib/formatDate`), maxsus soya, `Intl.NumberFormat`, qo'lda `so'm`,
boshqa ikonka kutubxonalari, antd `message` / `notification` / `Popconfirm` / `Modal.confirm` / `App.useApp()`,
brauzer `confirm()` / `alert()` / `prompt()` (ESLint xato beradi — `notify`, `useConfirm()`, `Dialog`), qo'lda yozilgan
«Yuklanmoqda…» / «Ma'lumot yo'q» bloklari (`QueryBoundary`, `EmptyState`, `ErrorState`).

```bash
npm run design:guard -- --diff            # origin/dev dan beri QO'SHILGAN qatorlar — yangi buzilish 0 (CI PR'da shu)
npm run design:guard -- <fayl>            # fayldagi buzilishlar + har birining v2 o'rnini bosuvchisi
npm run design:guard -- --changed         # baseline'dan farq qilgan fayllar (oshgan yoki kamaygan)
npm run design:guard -- --update          # eski fayldagi buzilishlarni kamaytirgach yangi sonni qotiring
```

Qo'riqchi ushlamaydiganlarni o'zingiz tekshirasiz: rangsiz maxsus soya, antd vizual komponentlari (`Card`, `Tag`,
`Segmented`), `sm:` telefon chegarasi sifatida, ikkinchi asosiy tugma, karta ichidagi karta.

Qo'riqchi ratchet usulida ishlaydi (`design/guard-baseline.json`): eski fayldagi son faqat kamayadi, yangi faylda
va `// dizayn-v2:` belgili faylda 0. Testni, baseline'ni oshirishni (`--allow-increase`) yoki `design-guard-ignore`
belgisini qo'riqchidan o'tish uchun ishlatmang. Ular faqat asosli istisno uchun, sababi yoziladi va PR'da ko'rsatiladi.

## 6. Ilovada ko'ring

`npm run dev`, sahifani kerakli rol bilan oching (o'z test akkauntingiz; parol kodga yoki chatga yozilmaydi).
Akkauntsiz tez ko'rish: `npm run app:shot -- <route> [--device phone] [--theme dark] [--role manager]
[--branch-type HQ|REGIONAL|HYBRID|PICKUP|none] [--lang ru] [--width 375] [--split 1200] [--wait <css-selektor>]` →
`design/shots/app/*.png` + JSON hisobot (toshish, 44px nishonlar, mayda matn, konsol xatolari); PNG'larni Read qiling.
Tekshiring:

- **390, 768, 1440** kenglikda, **kunduzgi va tungi** mavzuda. Tungi mavzu: Sozlamalar sahifasida tanlang yoki
  konsolda `localStorage.setItem('theme','dark'); localStorage.setItem('theme-version','2')` va sahifani yangilang
  (`theme-version` siz `theme` e'tiborga olinmaydi; kirgandan keyin server sozlamasi ustun bo'lishi mumkin).
- Maket PNG'lari bilan yonma-yon solishtiring. Playwright MCP (`.mcp.json`) ulangan bo'lsa, kenglikni o'rnating →
  skrinshot → Read.
- 390px da gorizontal skroll yo'q (`document.documentElement.scrollWidth <= innerWidth`), bosiladigan har narsa
  ≥ 44px, matn ≥ 12px, jadval kartaga aylangan, dialog pastdan chiqadi, fokus ko'rinadi.

## 7. Test va build (push oldidan, hammasi yashil)

```bash
npm run lint
npm test                          # TO'LIQ, nishonli emas: dizayn qo'riqchisi, palitra, tokenlar, iOS shrift, menyu
npm run design:guard -- --diff    # qo'shilgan qatorlarda yangi buzilish yo'q (CI PR qadami)
npm run build                     # tsc -b qat'iy, CI shu bilan yiqiladi
```

## 8. Maket yo'q bo'lsa

`docs/DESIGN_SYSTEM.md` qoidalariga va **eng yaqin maketga** (shu rol, shu tur) tayaning:

- ro'yxat → `superadmin-orders-list`;
- tafsilot → `<rol>-orders-detail`;
- forma yoki dialog → `tizim-states-forms` + o'sha bo'limning eng yaqin `*-dialog` ekrani;
- grafik yoki dashboard → `superadmin-dashboard-main` + `tizim-charts`.

Javobda va PR'da yozing: «Maket yo'q — eng yaqini: `<ekran>`». Katta yangi ekran bo'lsa, avval egadan maket so'rang.

- Maketsiz yangi route: `design/kit/route-map.json` ga `"views": {}` va
  `"roleNotes": { "<rol>": "Maket yo'q — eng yaqini: <ekran>" }`, keyin `npm run design:screens`. Fayl belgisi:
  `// dizayn-v2: (maket yo'q) <eng yaqin ekran>`.
- **Maket ataylab yashirgan narsa «maket yo'q» emas.** Element boshqa breakpointda yoki boshqa rolda bor, bu yerda
  yo'q (`el-hide-mobile`, `el-hide-tablet`, rol maketida yo'q) — bu dizayn ziddiyati: kod yozmang, egadan so'rang va
  shu breakpoint/rolning eng yaqin namunasini taklif qiling (telefon filtrlari: ≤ 2 tasi — qatorda
  `manager-returns-list`; ≥ 3 — «Filtrlar» tugmasi + pastki varaqa `superadmin-orders-filters-mobile`).

## Javob va PR

Yakuniy javobda va PR tavsifida (`.github/pull_request_template.md`) quyidagilar bo'lsin:

- ishlatilgan maket ekranlari (`<rol>-<viewId>`);
- kunduzgi, tungi va 390px skrinshotlar;
- maketdan farqlar va sababi;
- qo'riqchi va testlar natijasi.

Tekshirmagan narsani «tekshirildi» deb yozmang.
