# Dizayn v2 — ishni davom ettirish (handoff, 2026-10-17)

Bu hujjat dizayn v2 ga o'tishni boshqa sessiya yoki agent qolgan joyidan davom ettirishi uchun yozilgan.
Majburiy qoidalar `AGENTS.md` da. UI ishidan oldin `.claude/skills/elchi-design/SKILL.md` o'qiladi.
Bu fayl faqat **holat, qarorlar va navbatni** beradi.

## 1. Hozirgi holat

- **Branch:** `origin/shodiyor` = so'nggi push (2026-10-17 kechqurun: `7ea71d7` va undan keyingilar). Ega
  `shodiyor` → `dev` ni o'zi merge qiladi. Biz faqat `shodiyor` ga push qilamiz (ega ruxsati: yashil tekshiruvli har
  commit so'ramasdan push), `main`/`dev` ga hech qachon.
- **Ish branchi** (lokal, asosiy papka): `design-v2/phase-4-moliya` (= `origin/shodiyor`). G1 guruhi alohida
  worktree'da quriladi: branch `design-v2/phase-4-g1` (`8b9c73c` dan) → tayyor bo'lgach asosiy branchga merge qilinadi.
- `dev` da hozircha `9a39eec` (PR #303). `shodiyor` dagi 4-bosqich commitlari hali dev'ga merge qilinmagan.
- **Jonli tekshiruv:** front lokal (`127.0.0.1:4173`), backend — server (`api.elchipochta.uz`, test ma'lumot) lokal
  proksi orqali: production CORS lokal manzillarni bloklaydi. Login'ni ega brauzerda o'zi qiladi, agent parol
  kiritmaydi. Proksi sukut bo'yicha faqat o'qish rejimida.

| Bosqich | Holat |
|---|---|
| 0 tokenlar, 1 primitivlar, 2 shell, 3 forma/dialog/holatlar | tayyor, dev'da |
| 4 sahifalar migratsiyasi | jarayonda: G1 qurilmoqda, G2 va G3 spec tayyor |
| 5 qo'shimcha qo'riqchilar (ESLint, vizual snapshot) | 4 tugashi bilan darhol (ega: kutilmaydi) |

**4-bosqichda ko'chirilgan sahifalar** (ro'yxat `AGENTS.md` 4-qatorida ham bor):

- `/orders` + `/orders/edit/:orderId`
- «Qabul va yaratish»: `/new-orders/create`, marketlar, `/new-orders/:marketId` (+ edit), incoming,
  `/new-orders/branches*`, `/new-orders/cancelled*`
- «Pochta»: `/mails/*`, `/mails/:id`
- «Paketlar va qaytarishlar»: `/batches`, `/batches/:id`, `/returns`
- «Moliya» (`7ea71d7`): `/payments`, `/payments/main-cashbox`, `/payments/cash-detail/:id`, `/cash-box`,
  `/financial-balance`

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

## 2. Navbatdagi ish (shu tartibda)

### 2.1 Qolgan guruhlar — spec'lar tayyor

Spec nusxalari: `~/Desktop/Hujjatlar/elchi-v2-specs/` (g1/g2/g3, moliya, followups, QA hisoboti, lokal proksi `dev-api-proxy.mjs`). Yo'qolsa — har spec bitta
spec agentning ishi. Har spec'dagi ega savollariga **sukut javoblari** qo'llanadi (ega: kutma). Ro'yxat 4-bosqich
yakuniy hisobotida.

1. **G1** — Dashboard (`/`, `/branch-dashboard`), Foydalanuvchilar, Filiallar, Mahsulotlar, Hududlar (13 route,
   65 maket).
   - Dashboard bundle byudjeti: ≤ 450 KB, `shared/ui/charts` recharts'siz.
   - `RegionDetailDialog` umumiy, lazy.
   - Kuryer `/regions` → `region/my/district-stats` (prod'da 403 xavfi).
2. **G2** — Integratsiyalar, Bildirishnomalar, Tizim/Ops/Jurnal, Profil/Sozlamalar/Inbox (67 maket).
   - `integrations/ui.ts` olib tashlanadi.
   - `finance-operators` to'lovi tasdiq bilan.
   - `/market-operators` ko'chirilmaydi.
3. **G3** — `/login` (+ «Sessiya tugadi»), `/scan/:token`, `/dispatch`, `/courier-bulk`.
   - Xato sahifalari 3-bosqichda tayyor.
   - `/scan` butunlay kamera ekrani — kamera ishi bilan **alohida**.

So'ng 5-bosqich. Kamera skaner rejimlari (`*-camera` ko'rinishlari, `ScannerCameraModal`, butun `/scan`) ega qarori
bilan **alohida ish**.

### 2.2 Ega tasdiqlagan, dizayndan keyin bitta to'plamda

- Trello: 2 ta yangi Backend kartasi va 4 ta karta izohi.
  - Yangi kartalar: `GET /transfer-batches` statussiz bo'lganda `meta.total` sahifaga xos; `GET /post` javobida
    `orders_total`/`amount_total` yo'q.
  - `FoCaUF10` Done → Backend: «EL-…» raqami bilan qidiruv ishlamaydi.
  - Izohlar: `rwAy8Qyk`, `3qDsJpfW`, `Ho5qcDn4`.
- To'liq QA: Trello «Qo'lda testlar» (79 karta), real ma'lumotda, oddiy foydalanuvchi sifatida.
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
- Ochiq savollar (javob olinmagan), ehtiyot bo'lib birga so'rash mumkin:
  - chop etish menyusi izohlari: xodim maketi «Faqat jadvalni chop etadi», kuryer maketi «Brauzerning chop etish
    oynasi ochiladi». Kod kuryer matnini ishlatadi, chunki u to'g'ri;
  - kuryer telefonida yo'lda qolgan eski pochta uchun 2 yoki 3 ta stat ustun.

## 6. Trello va xavfsizlik

- Board `Ybn5j9yN`. Dizayn v2 kartalari:
  - bosqichlar: `lzNVFmSH`, `1QR2FboE`, `klNZb5uJ`, `rejXa4X6` — 0–3, In Test;
  - `tzvOkdpI` — 4-bosqich, In Progress, 3/10;
  - `suniwdoQ` — 5-bosqich.
- Trello kalitlari `~/Desktop/Elchi-Marketplace/.env.trello` da. Hech qachon chiqarilmaydi, kodga yoki commit'ga
  yozilmaydi.
- Karta sikli: In Progress → In Test → Done faqat BARCHA checkbox belgilansa.
- Faqat egasi (shodiyorergashev) kartalari bajariladi.
- Parol hech qayerga kiritilmaydi va yozilmaydi; `.env.local` commit qilinmaydi.
- Savollar hisobot ichiga yashirilmaydi — alohida so'raladi.
- Ega bilan o'zbekcha gaplashiladi.
