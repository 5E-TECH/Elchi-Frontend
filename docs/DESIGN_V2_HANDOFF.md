# Dizayn v2 — ishni davom ettirish (handoff, 2026-10-18)

Bu hujjat dizayn v2 ga o'tishni boshqa sessiya yoki agent qolgan joyidan davom ettirishi uchun yozilgan.
Majburiy qoidalar `AGENTS.md` da. UI ishidan oldin `.claude/skills/elchi-design/SKILL.md` o'qiladi.
Bu fayl faqat **holat, qarorlar va navbatni** beradi.

## 1. Hozirgi holat

- **Branch:** `origin/shodiyor` = so'nggi push. Ega `shodiyor` → `dev` ni o'zi merge qiladi. Biz faqat `shodiyor` ga
  push qilamiz (ega ruxsati: yashil tekshiruvli har commit so'ramasdan push), `main`/`dev` ga hech qachon.
- **Ish branchi** (lokal, asosiy papka): `design-v2/phase-4-moliya`. 4-bosqich to'liq (G1, G2, G3 + Bahodir/Dilshod
  dev ishi) `9443388` da — PR #305 orqali `dev` ga tushgan. 5-bosqich (A — `b450e90`, B — shu commit) uning ustida.
- `origin/dev` (`2dee343`, Bahodir #312) `shodiyor` ga birlashtirilgan (`5b7ada4`). Har PR'dan oldin
  `git merge-base --is-ancestor origin/dev HEAD` — dev oldinga ketgan bo'lsa, avval birlashtiring.
- **Jonli tekshiruv:** front lokal (`127.0.0.1:4173`), backend — server (`api.elchipochta.uz`, test ma'lumot) lokal
  proksi orqali: production CORS lokal manzillarni bloklaydi. Login'ni ega brauzerda o'zi qiladi, agent parol
  kiritmaydi. Proksi sukut bo'yicha faqat o'qish rejimida.

| Bosqich | Holat |
|---|---|
| 0 tokenlar, 1 primitivlar, 2 shell, 3 forma/dialog/holatlar | tayyor, dev'da |
| 4 sahifalar migratsiyasi | **tayyor**: 77 route'dan 75 tasi v2 (G1, G2, G3); qolgan `/scan` — kamera ishi, `/market-operators` — yopiq |
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
  `/profile`, `/settings`, `/inbox`; `/market-operators` yopiq, ko'chirilmagan
- G3: `/login` (+ «Sessiya tugadi» ekrani, sessiya banneri shell'ning `[data-shell-slot=banner]` slotida),
  `/scan/:token`, `/dispatch`, `/courier-bulk` (+ dev'ning isbot qadami va xato berganlar oynasi, `X-Request-Source`);
  butun `/scan` kamera ekrani — alohida kamera ishi

**5-bosqich** (`docs/DESIGN_SYSTEM.md` §12, §14):

- ESLint `design-v2/raw-control` (xom `<button>` / `<select>` / `<textarea>` / matn `<input>` / `<dialog>` /
  `role="button"` → primitivlar va `Pressable`), `design-v2/ui-imports` (antd'dan faqat `ConfigProvider`, `theme`,
  `QRCode`; boshqa ikonka kutubxonalari yo'q), `jsx-a11y/anchor-is-valid` — butun `src` da **xato**,
  `STAGE_A_PENDING = []`. Ratchet: `RAW_CONTROL_RATCHET` 5 (kamera ishi 2, `/market-operators`, `SalaryPaymentPopup`,
  `PrintModeSelect`), `UI_IMPORT_RATCHET` 0; bitta qator istisnolari 2 (kamera tugmasi, `CampaignPage` prefiksi).
- design-guard `named-colour` + `V2_SCOPES` (80 papka, ichidagi har fayl rangda 0), `V2_SCOPE_PENDING` 2,
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

- **Kamera ishi** — alohida (ega qarori 2026-10-16): butun `/scan`, `*-camera` ko'rinishlari, `ScannerCameraModal`,
  `cancelled/detail.tsx` dagi «Kamera» tugmasi (`docs/DESIGN_SYSTEM.md` §14).
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
  - butun `/scan` (kamera holatlari, qo'lda kiritish, oflayn navbat) — alohida kamera ishi;
  - menejer skaner natijasida «Sotish / Bekor qilish» — buyurtma tafsilotidagi qoidalar bilan;
  - «Kuryerga biriktirish» → `/dispatch` buyurtma qo'shilgan va tanlangan holda;
  - xodim skaner natijasida «To'langan» ham, «Yaratilgan» ham;
  - kuryerga paket «Qabul qilish» yashirilgan (backend 403);
  - «© 2026 Elchi Pochta» chizilmaydi;
  - `/dispatch` telefonda bitta yopishqoq panel «Kamera N ta» + «Biriktirish — K ta»;
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
