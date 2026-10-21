# Dizayn v2 — ishni davom ettirish (handoff, 2026-10-18)

Bu hujjat dizayn v2 ga o'tishni boshqa sessiya yoki agent qolgan joyidan davom ettirishi uchun yozilgan.
Majburiy qoidalar `AGENTS.md` da. UI ishidan oldin `.claude/skills/elchi-design/SKILL.md` o'qiladi.
Bu fayl faqat **holat, qarorlar va navbatni** beradi.

## 1. Hozirgi holat

- **Branch:** `origin/shodiyor` = so'nggi push. Ega `shodiyor` → `dev` ni o'zi merge qiladi. Biz faqat `shodiyor` ga
  push qilamiz (ega ruxsati: yashil tekshiruvli har commit so'ramasdan push), `main`/`dev` ga hech qachon.
- **Ish branchi** (lokal, asosiy papka): `design-v2/phase-4-moliya`. 4-bosqich to'liq (G1, G2, G3 + Bahodir/Dilshod
  dev ishi) `9443388` da — PR #305 orqali `dev` ga tushgan. 5-bosqich (A — `b450e90`, B — shu commit) uning ustida.
  Tasdiqlangan 19 guruh kodi (0- va 1-to'lqin, 2026-10-21) ham shu branch'da — §2.2.
- `origin/dev` (`2dee343`, Bahodir #312) `shodiyor` ga birlashtirilgan (`5b7ada4`). Har PR'dan oldin
  `git merge-base --is-ancestor origin/dev HEAD` — dev oldinga ketgan bo'lsa, avval birlashtiring.
- **Jonli tekshiruv:** front lokal (`127.0.0.1:4173`), backend — server (`api.elchipochta.uz`, test ma'lumot) lokal
  proksi orqali: production CORS lokal manzillarni bloklaydi. Login'ni ega brauzerda o'zi qiladi, agent parol
  kiritmaydi. Proksi sukut bo'yicha faqat o'qish rejimida.

| Bosqich | Holat |
|---|---|
| 0 tokenlar, 1 primitivlar, 2 shell, 3 forma/dialog/holatlar | tayyor, dev'da |
| 4 sahifalar migratsiyasi | **tayyor**: 81 / 81 route v2 (G1, G2, G3; `/scan` — skaner 1-bosqichi; oxirgi `/market-operators` — MO-1, 2026-10-21; yangi `/notifications/sent` — NS-2, `/my-earnings` — MO-2, `/investments` va `/profits` — IN-2, v2 da yozilgan) |
| 5 qo'riqchilar (ESLint, palitra, vizual snapshot, CI) | **tayyor** (kod va tekshiruvlar); «Visual» baseline'lari — egada (§2.1) |

**4-bosqichda ko'chirilgan sahifalar** (ro'yxat `AGENTS.md` 4-qatorida ham bor):

- `/orders` + `/orders/edit/:orderId`
- «Qabul va yaratish»: `/new-orders/create`, marketlar, `/new-orders/:marketId` (+ edit), incoming,
  `/new-orders/branches*`, `/new-orders/cancelled*`
- «Pochta»: `/mails/*`, `/mails/:id`
- «Paketlar va qaytarishlar»: `/batches`, `/batches/:id`, `/returns`
- «Moliya» (`7ea71d7`): `/payments`, `/payments/main-cashbox`, `/payments/cash-detail/:id`, `/cash-box`,
  `/financial-balance`
- G1: `/`, `/branch-dashboard`, `/all-users*` (+ `/new-orders/userDetail/:id`), `/branches*`, `/products*`, `/regions*`
  (umumiy `shared/ui/charts`, `widgets/region-detail`; dashboard bundle 418 KB ≤ 450)
- G2: `/integrations/*` (konsol + 7 panel, katalog, usta; eski sahifalar «Eski sahifa» belgisi bilan), `/notifications*`
  (Telegram guruhini bir martalik havola bilan ulash), `/activity-logs` (`DataTable expandable`), `/ops` + 8 ta ops yo'li,
  `/profile`, `/settings`, `/inbox`; `/market-operators` — MO-1 da (2026-10-21) market uchun ochildi va v2 ga ko'chdi
- G3: `/login` (+ «Sessiya tugadi» ekrani, sessiya banneri shell'ning `[data-shell-slot=banner]` slotida),
  `/scan/:token`, `/dispatch`, `/courier-bulk` (+ dev'ning isbot qadami va xato berganlar oynasi, `X-Request-Source`);
  butun `/scan` kamera ekrani — skaner ishida (1–4-bosqich tayyor, quyida §2.2)

**5-bosqich** (`docs/DESIGN_SYSTEM.md` §12, §14):

- ESLint `design-v2/raw-control` (xom `<button>` / `<select>` / `<textarea>` / matn `<input>` / `<dialog>` /
  `role="button"` → primitivlar va `Pressable`), `design-v2/ui-imports` (antd'dan faqat `ConfigProvider`, `theme`,
  `QRCode`; boshqa ikonka kutubxonalari yo'q), `jsx-a11y/anchor-is-valid` — butun `src` da **xato**,
  `STAGE_A_PENDING = []`. Ratchet: `RAW_CONTROL_RATCHET` 5 (kamera ishi 2, `/market-operators`, `SalaryPaymentPopup`,
  `PrintModeSelect`), `UI_IMPORT_RATCHET` 0; bitta qator istisnolari 2 (kamera tugmasi, `CampaignPage` prefiksi).
  Skaner 1–2-bosqichidan keyin: `RAW_CONTROL_RATCHET` 3 (kamera ishi chiqdi), bitta qator istisnosi 1 (`CampaignPage`);
  MO-1 dan keyin: 2 (`SalaryPaymentPopup`, `PrintModeSelect`).
- design-guard `named-colour` + `V2_SCOPES` (papkalar ro'yxati — `scripts/design-guard.mjs`, ichidagi har fayl rangda 0), `V2_SCOPE_PENDING` 2,
  `OUTPUT_FORMAT_FILES` 4; `design/guard-baseline.json` faqat kamaydi (87 → 17 fayl yozuvi).
- Vizual snapshotlar: 23 sahna × kunduzgi/tungi × 1440/390 = 92 (`tests/visual/`, mock API), CI «Visual»
  (`.github/workflows/visual.yml`); baseline'lar `shodiyor` da (bot commit `a107f5e`, `616bc03` da yaratilgan;
  `47bcb53` gacha bironta sahna o'zgarmagani lokal A/B chizish bilan tasdiqlangan), `dev` da hali yo'q.
- Bosqich B integratsiyasida iste'molchisi qolmagan 61 v1 fayl o'chirildi (testlari bilan): `PhoneInput`,
  `SearchableSelect`, `DateRangePicker`, `CustomDatePicker`, `FilterDateRange`, `FilterSearch`, `GlobalSearchInput`,
  `FilterClearButton`, `PageStatBadge`, v1 `EmptyState` / `QueryErrorState` / `TableSkeleton` / `Loader`,
  `shared/components/{button,Table,pagination,popupConfirm,popupUpdate}`, `features/search` barreli, eski
  `app/router`, `pages/home` va boshqalar (ro'yxat — commit).

**Yo'l-yo'lakay qo'shilganlar:**

- CI: Playwright e2e endi PR'da yuradi (`c0d81d2`). Ega GitHub'da «Deploy» tekshiruvini `dev` uchun required
  qilishi kerak, aks holda e2e merge'ni to'xtatmaydi.
- Buyurtma yaratish: market almashtirilsa tasdiq oynasi chiqadi (`ae4c9f8`).
- F1–F5 bajarildi (`8b9c73c`):
  - paket badge'i maketdagidek;
  - `/returns` sana filtri; ega qarori: telefonda filtrlar qatorda, varaqa yo'q;
  - Pochta qarorlari route-map `note` larida — `roleNotes` bu route'larda ko'rinmaydi;
  - `/mails/old` server filtrlari, sahifalash va to'liq Excel;
  - F5: avvalgi 6 ta bo'shliq `origin/main` da ham bor.
- Real foydalanuvchi QA'si («Buyurtmalar», tafsilot, yaratish) topgan nuqsonlar tuzatildi (`b1a599a`).
- «Visual» beqarorliklari tuzatildi (2026-10-18; faqat harness, baseline o'zgarmagan):
  - **xost Wi-Fi'si uzilsa:** React Query so'rovni to'xtatardi va «Internet aloqasi yo'q» suratga tushardi (`order-create`).
    Endi `pinOnline` bor.
  - **lazy grafik va `DeferredMount`:** oyna cho'zilgach ochilib, kech chizilardi (`dashboard` balandligi 32 px qisqa,
    telefonda grafik o'rnida skelet). Endi «band» shartnomasi kengaytirilgan va balandlik barqarorlashguncha
    kutiladi.
  - **xato holati:** endi suratga tushmaydi, sahna sababi bilan yiqiladi.

  Batafsil: `docs/DESIGN_SYSTEM.md` §12.5 «Determinizm».

## 2. Navbatdagi ish (shu tartibda)

### 2.1 «Visual» — deploy PR'ini yashil qilish (ega, GitHub'da)

`visual.yml` dev'da, baseline'lar `shodiyor` da (§1). 2026-10-18 holati: deploy PR #311 (`dev` → `main`) da
«Visual» qizil. Sabab: Bahodir'ning #312 i `/new-orders/:marketId` da sukut tanlovni olib tashlagan (QMvu5Ajx),
`market-new-orders` sahnasi esa yangilanmagan. «Visual» required emas, shuning uchun qizil holda merge bo'lgan.
Sahna `shodiyor` da tuzatilgan (`5b7ada4`).

1. `shodiyor` → `dev` PR oching. Head bot commit'i bo'lmasin, chunki `[skip ci]` li head'da PR tekshiruvlari yurmaydi.
   «Visual» `shodiyor` dagi baseline'lar bilan solishtiradi va yashil bo'lishi kerak.
2. **«Create a merge commit»** bilan merge qiling, squash qilmang. Squash xabariga bot commit'ining `[skip ci]` i
   tushadi, natijada `dev` head'i #311 tekshiruvlarini ham, `main` deploy'ini ham o'chiradi.
3. #311 dev'ning yangi head'i bilan qayta yuradi va yashil bo'lishi kerak.
4. Bir necha ketma-ket yashil yugurishdan keyin (AGENTS.md: 5 ta): Settings → Branches → `dev` va `main` →
   required checks ga «Visual / visual» va «Deploy / deploy». Shungacha qoida: qizil «Visual» bilan merge yo'q.
   Sahnaga tegadigan xatti-harakat o'zgarsa, sahna fayli o'sha PR'da yangilanadi; farq kutilgan bo'lsa
   «Run workflow (update)» o'z branch'ida yuritiladi.
5. Run workflow (update) faqat ishchi branch'da yuritiladi (`dev` va `main` da emas). U tugaguncha shu branch'ga
   push qilmang, aks holda bot push'i rad etiladi.

Lokal kompyuterda Docker yoki vizual solishtirish shart emas; lokal faqat `VISUAL_DRY=1` (`AGENTS.md`).

### 2.2 Keyingi ishlar

- **Kamera ishi (skaner, Trello v1eLN2tV)** — ega qarorlari 2026-10-19 (markaziy «Skaner» kontekstli, oqim ichida
  kamera tugmasi yo'q), batafsil `docs/DESIGN_SYSTEM.md` §14:
  - 1-bosqich — tayyor: skan maqsadlari reyestri, `ScannerHost`, v2 `ScannerCamera`, universal `/scan` v2.
  - 2-bosqich — tayyor (`design-v2/scanner-2`): USB skanli har oqim kamera bilan ham (qabul — skan = darhol qabul,
    boshqa market rad, kamera ichida market almashtirish; kiruvchi, filial paketlari, bekorlar, pochta, paket
    jo'natish, `/orders` bekor tablari — tanlash; `/dispatch` savati qurilmada va `/scan/:token` «Kuryerga
    biriktirish» shu savatga; `/courier-bulk` — kamera ichida «Bekor / Ertaga»). v1 «Kamera» tugmalari va
    `ScannerCameraModal` o'chirildi; bekorlardagi sarlavha «Market QR skanerlash» tugmasi ham olib tashlandi (bitta
    ekranda ikkinchi skan tugmasi yo'q — tizim-scanner §09; 2026-10-17 dagi qaror shu bilan almashdi). Istisno:
    `MarkReturnedModal` ning o'z kamera tugmasi (markaziy tugma oyna ostida).
  - 2-bosqich follow-up (ega qarori kerak): `playScanFeedback` faqat bitta matn oladi — maketdagi «sarlavha + tafsilot»
    natija qatori 1-bosqich API o'zgarishini talab qiladi; `/dispatch` savati chiqishda (logout) tozalanmaydi — sessiya
    tugashi ham `logout()` orqali, savat D2 bo'yicha qurilmada qoladi.
  - 3-bosqich — tayyor (`design-v2/scanner-3`): universal `/scan` rejimlari — «Ma'lumot · Qabul qilish ·
    Kuryerga biriktirish» (rol va filial bo'yicha, tanlov qurilmada), kuryerda «O'zimga olish» (ketma-ket
    `scan-assign`, natija ro'yxati, «Tugatish» → xulosa + kesh). «Qabul qilish» / «Kuryerga biriktirish» —
    `/new-orders/<id>` / `/dispatch` ga kamera OCHIQ holda o'tadi (`scannerArrivalState` + `ScannerHost`). Batafsil —
    `docs/DESIGN_SYSTEM.md` §14.
  - 4-bosqich — tayyor (`design-v2/scanner-3` ichida): Sozlamalar → Skaner → «Kamera» kartasi (maket
    `common-settings-scanner`): «Kamerani sinash» → `/scan`, asosiy kamera (orqa / old), «Chiroq — avtomatik»
    (yorug'lik kam bo'lsa yoqish TAKLIFI, o'zi yoqilmaydi), «Uzluksiz skanerlash» (o'chiq — oqim kamerasi bitta
    muvaffaqiyatli koddan keyin yopiladi), «Ovoz», «Tebranish», «Ramka o'lchami» (ramka va skan hududi). Qiymatlar
    `entities/settings` (`scanner.camera`, `scanner.feedback`) → backend `admins.settings` (opaque jsonb, kalit
    tekshirilmaydi) + `SettingsSync` orqali `localStorage` ko'zgusi; `ScannerCamera` va `playScanSignal` o'qiydi.
    Kamera ichida «Kamerani almashtirish» (bir nechta kamera bo'lsa).
  - **Kamera ishi yopildi** (1–4-bosqich): v1 kamera qolmadi. Ochiq qolgani (ega qarori kutiladi): oflayn navbat,
    buyurtma raqami bo'yicha qo'lda kiritish (API yo'q); 2-bosqich follow-up'lari (yuqorida).
- **Trello «Frontend» auditi va dizayn takliflari (2026-10-19).**
  - **Audit.** 118 kartaning hammasi kod va backend bilan solishtirildi. 15 tasi dalil bilan Done ga o'tkazildi.
    Hisobot: ega papkasidagi `trello-audit/report.md`.
  - **Dizayn takliflari.** 32 ta dizayn bo'shlig'idan 19 guruh `design/` nusxasida, kit qoidalari bo'yicha chizildi:
    1-to'plam 11 guruh, 2-to'plam 8 guruh. Galereyalar: `Hujjatlar/elchi-dizayn-takliflar{,-2}/index.html`,
    fragmentlar ham shu papkalarda.
  - **Savollar.** Ega 83 ta savolning hammasiga javob berdi: `Hujjatlar/elchi-v2-specs/owner-answers.md`.
  - **Tavsiyadan farq qilgan asosiy javoblar:**
    - logist — buyurtmalar va holat tarixini ko'radi, moliya yopiq;
    - yetkazish narxi — sukutda vazn yoki hajm bo'yicha; har marketda «faqat standart narx» tugmasi;
    - mijozni har bir yaratuvchi rol tanlaydi, market esa faqat o'z tarixini ko'radi;
    - kassa smenasi hamma kassada majburiy;
    - mahsulot o'lchamlari doim majburiy.
  - **Keyingi qadam.** Ega guruhlarni tasdiqlaydi → tasdiqlangan maketlar `design/` ga sinxron PR bilan kiradi →
    kod yoziladi. Backend talablari Trello Backend ro'yxatiga yozilgan: 2026-10-19 da 22 + 8 karta va mavjud
    kartalarga izohlar.
- **Tasdiqlangan 19 guruhning kodi (2026-10-19 dan).** Reja — ega papkasidagi
  `elchi-v2-specs/tasdiqlangan-dizayn-roadmap.md` (to'lqinlar, PR'lar, fayl egaligi, 4.1-bo'limdagi tartib).
  - **0- va 1-to'lqin tayyor (2026-10-21, `design-v2/phase-4-moliya` → `origin/shodiyor`):** BH-1 (bekor
    holatlari, 1-bosqich, `vOczoOUE`), ROL-0 (yangi rollar asosi, market pastki menyusi), IP-1 (kiruvchi
    posilkalar), CS-A (mijoz taklifi, mavjud mijoz — `customer_id`), IS-1 (integratsiya hisob-kitobi matni va
    «Qoldiq»), CB-1 (kassa smenasi: `shift/current`, ochish / yopish / natija oynalari). Har biri alohida branch'da
    yozilib, mustaqil review'dan o'tib, merge commit bilan birlashtirilgan.
  - **Dev bilan birlashtirish qarori:** Bahodir #318 (SllBYhnt) `waiting_customer` va `returned_to_market` ni
    registrga qo'shgan; BH-1 maketi bo'yicha `returned_to_market` yorlig'i «Marketga topshirildi» (neutral,
    `PackageCheck`), «Mijoz kutilmoqda» — dev'dagidek.
  - **Egaga (GitHub):** ROL-0 market pastki menyusini o'zgartirdi («Mahsulotlar» → «To'lovlar», 5-katak «Menyu») —
    «Visual» `market-home` va `market-new-orders` telefon sahnalari kutilgan farq beradi: Actions → Visual → Run
    workflow (update ✓) `shodiyor` da. CB-1: frontend qulfi `shift === null` da (`required` ga qaramaydi, ega S4) —
    deploy bilan asosiy/filial kassasi tezkor amallari smena ochilguncha yopiq, operatorlarga oldindan xabar.
  - **Ochiq (ega qarori):** IP — Toaster'ga Undo2 ikonka va ikkinchi darajali tugma (hozir umumiy `notify`,
    `partialViews` izohida); MO — market operatori global qidiruvi; ROL-0 dan: logist / market operatorida menyu
    qidiruvi `/orders` ochilguncha (LG-4 / MO-3) yashirin, yuqori paneldagi global qidiruv qoladi.
  - **2-to'lqin, 1-to'plam tayyor (2026-10-21, `67d4d21d`):** KI-1 (kvitansiya yorliqlari rolga qarab — xodim
    «Kuryer …», kuryer «Siz …»; shell'da «Asosiy kontentga o'tish», `#main-content`), NG-A (yuqorida), TG-A (shaxsiy
    Telegram: teskari sanoq, QR, buyruq rejimi; umumiy havola qismlari `features/telegram-link`), NS-1 (yuborish
    natijasi, «Natija noma'lum» — o'sha `client_request_id`, tafsilot oynasi; `entities/notification-dispatch`), OS-1
    («Tizim holati» — `health/readiness`, 14 xizmat), OS-3 (qaytarish so'rovlarini tasdiqlash oynasi va natija
    xabari). Integratsiyada: 5375 unit, 258 e2e yashil. Sukut bilan qilingan qarorlar va egaga savollar — ega
    papkasidagi `elchi-v2-specs/ochiq-savollar-2-tolqin.md`.
  - **2-to'lqin, 2-to'plam tayyor (2026-10-21, `183079c5`):** DM-1 (quyida), OR-1 (buyurtmalar ro'yxati avtomatik
    yangilanadi, «Yangilash», «Ro'yxat yangilanmadi» ogohlantirishi, kuryer tab sonlari; `PageHeader` / `Tabs` — opt-in
    prop'lar), MD-1 (pochta tafsilotida `?q=` qidiruv va takroriy telefonlar banneri), FY-1 (9 rol tabi, telefonda
    «Rol» tanlovi, AI narxi, logist maoshi, kuryer ish hududi), MH-1 (market mahsulotlarni faqat ko'radi, «Narx», xato
    xulosasi, market operatori — ko'rish), MO-1 (quyida — oxirgi v1 route ko'chdi). Integratsiyada: 5544 unit, 291 e2e.
  - **2-to'lqin, 3-to'plam tayyor (2026-10-21):** LG-1 (logist qobig'i va bosh sahifasi — o'z viloyatlari, pulsiz;
    `region/stats/all` brauzerda `logist_id` bo'yicha filtrlanadi, serverda cheklash — iOnGbEqi), LG-2 (`/regions/
    logist-assignment` va «Logist» yaratish), IN-1 (investor kabineti — `investors/me`, `StackedBars` primitivi),
    SA-1 (SATO: qobiq, KPI, holat tablari, inline kod muharriri), KM-1 (SMS kampaniya — mijozlar segmenti, jonli
    auditoriya, kunlik limit), KI-2 («Ilovani o'rnatish» — kuryer bosh sahifasi, `/inbox`, Sozlamalar «Ilova»).
    Endi `/` da 403 faqat market operatorida (MO-2 gacha). Integratsiyada: 5778 unit, 328 e2e. 2-to'lqin yopildi.
  - **3-to'lqin, 1-yarmi tayyor (2026-10-21):** NG-B (qo'shish oynasi — «ulangan, lekin nofaol» faollashtirish, havola
    sanog'i), TG-B («Telegram guruhi» kartasi, market profili, «Telegram boti» ustuni), FY-2 (superadmin rolni
    o'zgartiradi), NS-2 (`/notifications/sent` — «Yuborilganlar», 78-route), CB-2 (menejer «To'lovlar» va kassa
    tafsilotida smena qulfi), IS-2 (ortiqcha to'lov, «To'lov yozildi» natija oynasi), TOZ-0 (kartalarda qolgan front
    bandlari: kuryer tab sonlari va pochta qidiruvi testlari, `100vh` qo'riqchisi, `SalaryPaymentPopup` tokenlari,
    ops sahifalari uchun haqiqiy konvert mocklari). Integratsiyada LG-2 poygasi tuzatildi («Logist yaratish» dan keyin
    yangi logist tanlanmay qolardi). 5966 unit, 374 e2e.
  - **3-to'lqin, 2-yarmi tayyor (2026-10-21):** CS-B (yetkazish turida market standart narxi, mahsulot rasmi —
    umumiy `entities/product` `ProductThumb`, narx matni, «Umumiy summa» taklifi, vaqtinchalik «Yetkazish narxi» — ega
    tasdig'i kutilmoqda, `disabled` da «AI bilan» yashirin), SA-2 (SATO kodlarini yozish, «Tuman qo'shish», takroriy
    nomlar va birlashtirish — `DistrictMergeDialog` qayta ishlatildi), LG-3 (logist `/regions` — o'z viloyati, pulsiz),
    OS-2 («AI holati» kartasi, USD formatlovchisi), MO-2 (market operatori qobig'i, `/my-earnings`), IN-2
    (`/investments`, `/profits`, investor pastki menyusi 4 katak); TOZ-2 (foydalanuvchi ro'yxati keshi, kassa/balans
    invalidatsiyasi, o'lik settlement mutatsiyalari olindi, forma a11y, tungi kontrast e2e). Route 81 / 81.
    Integratsiyada: 6243 unit, 418 e2e.
  - **Navbatda — 4-to'lqin** (ishda): KM-2, MO-3, IS-3, CS-C, TOZ-1; keyin KM-3 (KM-2 dan keyin).
  - **IS-3 (2026-10-21, `feat/is-3-settlement-received`):** integratsiya hisob-kitobida «Olingan to'lovlar» (sana
    oralig'i, «Faol · Bekor qilingan · Barchasi», «Holat · kassa» `cashbox_posted` bo'yicha) va «To'lovni bekor qilish»
    oynasi (oqibatlar, «Sabab *», eski yozuvda majburiy kassa tanlovi, «Hozir bekor qilib bo'lmaydi» oldindan + 409
    zaxira, 502 — kassa xatosi; xom backend matni ko'rsatilmaydi); «To'lov №N» — bo'limga o'tish. Muallif ismi va eski
    yozuvdagi kassa tanlovi — BD2-10 (IS-4) kutadi. O'lik `sidebar.settlement` kaliti olindi (N9jY9xVV).
    Review: bo'lim ulanish bo'yicha `key` bilan (filtr/sahifa A dan B ga o'tmaydi), sahifa yangi javobdan keyingina oxirgi
    haqiqiy sahifaga suriladi (LG-2), oflayn — «Internet aloqasi yo'q» (`isPaused`); «To'lov №N» faqat `<main>` ni suradi
    (`scrollIntoView` qobiq ildizini 64 px surardi); summalar `nowrap`, 409 dan keyin fokus «Orqaga» da, ikonkalar
    CircleX / RotateCcw, en matnlarida “”.
  - **NG-A (2026-10-21, `feat/ng-a-telegram-groups-admin`):** `/notifications` adminga ochildi (menyu «Tizim» →
    «Bildirishnomalar»), qator menyusi (popover / telefonda varaqa), nofaol qilish / faollashtirish tasdiq bilan
    (`features/notification-toggle`, faqat `PATCH {is_active}`), «Tahrirlash» va `features/notification-edit` olindi;
    «Nofaol» — neytral, umumiy izoh (sabab — NG-C). Egaga: admin yon menyusi o'zgardi — admin «Visual» sahnalari
    (masalan `regions`) baseline'i «Run workflow (update)» bilan yangilanadi; `/inbox` alias'i adminda ham qabul qilindi.
  - **MO-1 (2026-10-21, `feat/mo-1-market-operators`):** `/market-operators` — market o'z operatorlari (menyu
    «Operatorlar», telefonda «Menyu» varag'ida; `canViewMarketOperators`), ro'yxat + komissiya ogohlantirishi, qo'shish
    (POST → PATCH komissiya), Komissiya va o'chirish oynalari; oxirgi v1 route — 77 / 77 v2, `RAW_CONTROL_RATCHET` 2,
    v1 `headerName`, `FormPopup`, `PageContainer`, `UserStatusBadge` o'chirildi. Egaga: market yon menyusi o'zgardi —
    market desktop «Visual» sahnalari «Run workflow (update)»; «Nofaol qilish / Faollashtirish» — MO-4 (backend).
  - **DM-1 (2026-10-21, `feat/dm-1-districts-merge`):** `/regions/districts` adminga ochildi (ega S1; admin
    «Hududlar» sarlavhasida «Tumanlar» birinchi), DELETE 400 → «Tumanni o'chirib bo'lmaydi» (faqat holat kodi bo'yicha,
    sonlarsiz), sahifadan ajratilgan `DistrictMergeDialog` + `useDistrictMerge` (maqsad — shu viloyatdan, oldindan
    tanlangan maqsad — SA-2 uchun; idle → confirm → progress → result | error | unknown), `MERGE_REQUEST_TIMEOUT_MS`
    125 s (`shared/api/api.ts`). Xato oynalari, sonlar bloklari va jurnal nomlari — DM-2 / DM-3 (backend N1,
    vsmpTweI, ILq3WNL1), `partialViews` izohlarida. Egaga: proksi read timeout'i ≥ 125 s bo'lsin (nginx 60 s,
    Cloudflare 100 s), aks holda ko'pincha «Natija noma'lum»; timeout'da global «Tarmoq xatosi» toast'i ham chiqadi;
    admin `regions` «Visual» sahnasi kutilgan farq — «Run workflow (update)».
  - **NS-2 (2026-10-21, `feat/ns-2-sent-history`):** yangi route `/notifications/sent` — «Yuborilganlar» (superadmin,
    admin; `canSendNotifications`, menyusiz — «Xabar yuborish» sarlavhasidagi va natija kartasi xatosidagi havola):
    `GET /notifications/sent`, «Natija» / «Kim yubordi» filtrlari, sahifa va ochiq oyna (`?id=`) URL'da, telefonda
    «Filtrlar» varaqasi; «Kimga» hozircha «—» + qabul qiluvchilar (auditoriya ro'yxat javobida yo'q — S2, backend);
    tafsilot oynasida «Xato bilan tugadi» → «Qayta yuborish». Route soni 78 / 78.
  - **LG-3 (2026-10-21, `feat/lg-3-logist-regions`):** `/regions` logistga ochildi (`canViewRegionStats` endi
    `access.ts` da; menyuda va pastki menyuda «Hududlar»): `LogistRegionView` — o'z viloyatlari tanlovi (`?region=`,
    desktopda seg, telefonda / 5 tadan ko'pida `Select`), `GET region/stats/:id` — spidometr, umumiy ko'rsatkichlar
    («Faol kuryerlar» — `status = 'active'`), tumanlar taxtasi va «Tanlangan tuman» (Tushum o'rnida «Kuryerlar»),
    «Tumanlar kesimida» (Tushumsiz), «Kuryerlar» top 5; pul yo'q (LG-S1), `GET /district` chaqirilmaydi. Begona /
    o'tkazilgan viloyat (yangi ro'yxat bo'yicha yoki 403) — «Bu viloyat endi sizga biriktirilmagan». Bosh sahifada
    «Tafsilot» ochildi — bosh sahifa davri bilan (`period=today|month|all`, hafta/yil/oraliq — `period=custom` aniq
    kunlar bilan). Eskirgan keshni qayta tekshirish har davr kaliti uchun alohida; URL'da viloyat bo'lmasa ko'rsatilgani
    davr almashganda ham saqlanadi; oflayn (keshda ro'yxat bo'lsa ham) — «Internet aloqasi yo'q». Logist qatorlarida
    tushum maydoni umuman yo'q (`toDistrictRows(…, { withRevenue: false })`). «Tuman buyurtmalari» — LG-4,
    «Barcha kuryerlar» — LG-5. Yangi route yo'q.
  - **MO-2 (2026-10-21, `feat/mo-2-operator-shell`):** market operatori qobig'i — yon menyu Bosh sahifa · Mahsulotlar ·
    Daromadim (pastki menyu shu 3 katak; Buyurtmalar va «Buyurtma yaratish» — MO-3); `/` — `MarketDashboardPage`
    operator rejimida (xarajat tasdiqlarisiz — backend 403, buyurtma havolalari MO-3 gacha yashirin); yangi route
    `/my-earnings` — «Stavkam» (`auth/my-profile` komissiyasi) va «Komissiya belgilanmagan» ogohlantirishi; «Hisob»,
    «To'lovlar», «Daromadlar» — backend `finance/operators/me/*` (MO-6). Route soni 81 / 81 (IN-2 bilan).
  - **IN-2 (2026-10-21, `feat/in-2-investor-lists`):** yangi route'lar `/investments` («Investitsiyalar» — `DateRange`
    «Barcha vaqt», «Jamidagi hissasi», oraliq jami — bitta sahifada yig'indi, aks holda faqat son, N6 → IN-3) va
    `/profits` («Foyda tarixi» — «To'lov holati» segmenti, umumiy `ProfitHistoryTable`); filtr va sahifa URL'da,
    `canViewInvestorCabinet`; investor menyusi va pastki menyusi to'liq (4 katak), bosh sahifada «Barchasi».
    Route soni 81 / 81 (MO-2 bilan).
- «Visual» baseline'lari skaner 2-bosqichidan keyin yangilangan (bot commit `1393ae0`, `/dispatch` va
  `cancelled-handover` — «Kamera» tugmalari olib tashlangani uchun kutilgan farq).
- **To'liq QA** — Trello «Qo'lda testlar» (79 karta), real ma'lumotda, oddiy foydalanuvchi sifatida.
- Follow-up: `Switch`, `FilterChip`, `Checkbox` primitivlari, `TextInput` prefiks sloti (`CampaignPage` istisnosi).
- **Chek (yorliq) dizayni — keyinga qoldirilgan** (ega, 2026-10-18). 5 ta taklif rad etilgan: «havodor» va eski
  chek / BeePost jadvali uslubidagi 4 variant. Hozirgi chek — Bahodir #312 versiyasi. Ega qaytmaguncha bu ishga
  vaqt sarflanmaydi.
- Vizual harness'ning qolgan bo'shliqlari (ixtiyoriy): «band» tekshiruvi oyna (portal) ichidagi yuklanishni
  ko'rmaydi; `tests/visual` hech bir `tsconfig` ga kirmaydi (CI `tsc -b` uni tekshirmaydi).

### 2.3 Ega tasdiqlagan, dizayndan keyin bitta to'plamda

- **Bajarilgan** (2026-10-18): backend bo'shliqlari bo'yicha Trello'ga yangi Backend kartalari ochildi va mavjud
  kartalarga izoh yozildi. `FoCaUF10` Done → Backend; izohlar `rwAy8Qyk`, `3qDsJpfW`, `Ho5qcDn4` va boshqalar.
  Ro'yxat: `backend-gaps.md` (ega papkasi `Hujjatlar/elchi-v2-specs`).
- `/mails/old` Excel 20 000 qator chegarasida «Fayl to'liq emas» ogohlantirishi bor (`old.exportCapped`).
- Ochiq: D-12 — yangi to'lanmagan buyurtmada «To'lanishi kerak 0» (`to_be_paid` semantikasi, backend bilan).

## 3. Ish usuli (o'zini oqlagan)

- **Har guruh = bitta ish oqimi.** Ketma-ketligi:
  1. spec agent — maketlarni o'qiydi va ko'radi, joriy kod va API'ni o'qiydi, fayl egaligini bo'ladi;
  2. N ta quruvchi, parallel, fayllari kesishmaydi;
  3. har qismga mustaqil tekshiruvchi;
  4. integrator: route-map, `design:screens`, `design:guard -- --update` (faqat kamaytirish), o'lik kodni
     o'chirish, hujjatlar, skrinshot matritsasi, to'liq tekshiruvlar.
- **Umumiy fayllarga faqat integrator tegadi:** `design/kit/route-map.json`, `design/SCREENS.md`,
  `design/guard-baseline.json`.
- **Push oldidan to'liq tekshiruv** (hammasi yashil bo'lsin):

  ```text
  npx tsc -b && npm run lint && npx vitest run && npm run design:guard && npm run design:guard -- --diff \
    && node design/tools/screens.mjs --check && npm run build && npm run check:bundle \
    && npx playwright test --reporter=line --workers=2
  ```

  Bitta umumiy dev server: `npm run dev -- --host 127.0.0.1 --port 4173 --strictPort` (e2e
  `reuseExistingServer`).
- **Ko'rish:**
  - maket: `npm run design:shot -- <rol>-<viewId> [--device phone] [--theme dark]`;
  - ilova: `npm run app:shot -- <route> --role <r>` (mock API, bo'sh);
  - to'la holatlar uchun vaqtinchalik Playwright probe (`tests/e2e/support/*` fixture'lari bilan), ishdan keyin
    o'chiriladi;
  - telefon (390), planshet (768), desktop (1440) × kunduzgi/tungi.
- **Kuchsiz kompyuter (ega shikoyati):**
  - barcha og'ir buyruqlar (`tsc`, `vitest`, `playwright`, `design:shot`, `app:shot`, `build`) bitta umumiy
    `flock` qulfi orqali, bittadan;
  - bir vaqtda 2–3 agent;
  - to'liq suite faqat integratorda, kataloglarga bo'lib (har biri < 9 daqiqa).
- **Parallel guruh — alohida git worktree:**
  - `node_modules` — asosiy o'rnatmaning paketlariga symlink, `.tmp` / `.vite` keshi esa alohida;
  - worktree'da Playwright default konfig bilan YURITILMAYDI, chunki u asosiy daraxtning `:4173` serverini qayta
    ishlatadi. Probe uchun `:4175` portli vaqtinchalik konfig ishlatiladi;
  - integratsiya merge'dan keyin asosiy daraxtda qilinadi.
- **Uzoq ish paytida** lokal WIP nazorat nuqtasi qo'ying: `git commit` → `git branch -f wip/<nom>` →
  `git reset --mixed HEAD~1`. Kompyuter o'chsa ish yo'qolmaydi.

## 4. Backend — haqiqat manbai

- Lokal `~/Desktop/Elchi-Backend` **eskirgan**: 6-oktabr holati, boshqa branch, ichida birovning commit
  qilinmagan ishi bor. Unga tegilmaydi va undan API fakti olinmaydi.
- Faqat `origin/main` ishlatiladi:

  ```text
  git -C ~/Desktop/Elchi-Backend fetch
  git -C ~/Desktop/Elchi-Backend show origin/main:docs/frontend/openapi.json > /tmp/openapi.json
  git -C ~/Desktop/Elchi-Backend show origin/main:<path>
  git -C ~/Desktop/Elchi-Backend grep -n <naqsh> origin/main -- <yo'l>
  ```

- `origin/main` = production (main'ga push = avto-deploy).

## 5. Ega qarorlari jurnali (qulflangan)

- **2026-10-09.** Navy `#1f2853` + ko'k action, kunduzgi sukut, Manrope, valyuta uz «so'm» / ru «сум» / en «UZS».
  Maketlar (`design/`) — asosiy manba.
- **2026-10-16:**
  - footer olib tashlangan;
  - marketda topbar «Skanerlash» yo'q;
  - HQ/PICKUP menejer pastki menyusida «Qabul»;
  - filtrda × + «Barchasi»;
  - to'lov kuni 1–30;
  - xato sahifalari kirgan foydalanuvchi uchun shell ichida;
  - 4-bosqich eng ko'p ishlatiladigan sahifalardan boshlanadi;
  - tab sonlari uchun backend endpoint kerak (Trello `GaBIPi3Z`);
  - bekor sababi kodda saqlanadi;
  - kamera keyin alohida;
  - Dialog footer chizig'i doim bor.
- **2026-10-17:**
  - market almashtirishda tasdiq (bajarildi);
  - SENT paket = haqiqiy «Yo'lda»;
  - «Market QR skanerlash» sarlavha tugmasi faqat QR kerak bo'lganda;
  - e2e CI'da (bajarildi);
  - paket badge'i maketdagidek (F1);
  - `/returns` qisqartirilgan sana filtri (F2);
  - Pochta birxillashtirishi (F3);
  - «Kuryer» ustuni hozirgidek.
- **2026-10-17 (kechqurun):**
  - push `origin/shodiyor` ga so'ramasdan (yashil bo'lsa);
  - 4 tugashi bilan 5 darhol;
  - Moliya D1 — asosiy kassa faqat `cashbox_type=main`;
  - D2 — market kassasida HQ → market «Chiqim −»;
  - D3 — to'ldirish/xarajat tasdiq + `Idempotency-Key`;
  - `/returns` telefonda filtrlar qatorda;
  - `/mails/old` yig'indilar backend'dan so'raladi (hozircha «N ta pochta»);
  - Excel 20 000 qator chegarasida ogohlantirish;
  - spec savollarida sukut.
- **G1 spec §9 sukutlari (egaga ko'rsatiladi):**
  - KPI deltalari ikkinchi analytics so'rovidan;
  - gauge'da «Yaxshi chegarasi · 70%»;
  - registrator sarlavhasida filial nomi;
  - «Moliyaviy tahlil» = «Daromad»;
  - market qo'shimcha xarajat tasdig'ida tasdiq oynasi yo'q;
  - `/branches/:id` da «Filial ko'rsatkichlari» yo'q (backend `branch_id` kerak);
  - `/regions` da Highcharts lazy;
  - logist sahifasi maketdagi bo'sh holat;
  - filial config kodi o'chirildi;
  - `/all-users` da «Filial» ustuni yo'q (users'da filial maydoni yo'q);
  - market tariflari majburiy.
- **G2 spec §10 sukutlari** — `design/kit/route-map.json` izohlarida (`docs/DESIGN_SYSTEM.md` §11, G2 bandi).
- **G3 spec §9 sukutlari (egaga ko'rsatiladi):**
  - butun `/scan` (kamera holatlari, qo'lda kiritish) — kamera ishida tayyor (§2.2); oflayn navbat — ega qarori;
  - menejer skaner natijasida «Sotish / Bekor qilish» — buyurtma tafsilotidagi qoidalar bilan;
  - «Kuryerga biriktirish» → `/dispatch` buyurtma qo'shilgan va tanlangan holda (skaner 2-bosqichidan — qurilmadagi
    savat orqali);
  - xodim skaner natijasida «To'langan» ham, «Yaratilgan» ham;
  - kuryerga paket «Qabul qilish» yashirilgan (backend 403);
  - «© 2026 Elchi Pochta» chizilmaydi;
  - `/dispatch` telefonda bitta yopishqoq panel «Biriktirish — K ta» (skaner 2-bosqichida «Kamera N ta» olindi —
    kamera markaziy «Skaner» orqali);
  - `/courier-bulk` menejerda kuryer maketi; «Faqat bekorlarni qo'llash» olib tashlandi.
- Ochiq savollar (javob olinmagan), ehtiyot bo'lib birga so'rash mumkin:
  - chop etish menyusi izohlari: xodim maketi «Faqat jadvalni chop etadi», kuryer maketi «Brauzerning chop etish
    oynasi ochiladi». Kod kuryer matnini ishlatadi, chunki u to'g'ri;
  - kuryer telefonida yo'lda qolgan eski pochta uchun 2 yoki 3 ta stat ustun.

## 6. Trello va xavfsizlik

- Board `Ybn5j9yN`. Dizayn v2 kartalari:
  - bosqichlar: `lzNVFmSH`, `1QR2FboE`, `klNZb5uJ`, `rejXa4X6` — 0–3, In Test;
  - `tzvOkdpI` — 4-bosqich (kod tayyor; checklist'ni lead yangilaydi);
  - `suniwdoQ` — 5-bosqich (5 ta checkbox — baseline'lar commit qilinib, «Visual» yashil bo'lgach).
- Trello kalitlari `~/Desktop/Elchi-Marketplace/.env.trello` da. Hech qachon chiqarilmaydi, kodga yoki commit'ga
  yozilmaydi.
- Karta sikli: In Progress → In Test → Done faqat BARCHA checkbox belgilansa.
- Faqat egasi (shodiyorergashev) kartalari bajariladi.
- Parol hech qayerga kiritilmaydi va yozilmaydi; `.env.local` commit qilinmaydi.
- Savollar hisobot ichiga yashirilmaydi — alohida so'raladi.
- Ega bilan o'zbekcha gaplashiladi.
