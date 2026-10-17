# Dizayn v2 — ishni davom ettirish (handoff, 2026-10-17)

Bu hujjat dizayn v2 ga o'tishni boshqa sessiya yoki agent qolgan joyidan davom ettirishi uchun yozilgan.
Majburiy qoidalar `AGENTS.md` da. UI ishidan oldin `.claude/skills/elchi-design/SKILL.md` o'qiladi.
Bu fayl faqat **holat, qarorlar va navbatni** beradi.

## 1. Hozirgi holat

- **Branch:** `shodiyor` = `d417789` (hammasi push qilingan, ishchi daraxt toza). Ega `shodiyor` → `dev` ni o'zi
  merge qiladi. Biz faqat `shodiyor` ga push qilamiz, `main`/`dev` ga hech qachon.
- **Ish branchi** (lokal): `design-v2/phase-4-orders` (= `origin/shodiyor`). Yangi ishni `origin/shodiyor` dan
  boshlang. Ega merge qilgan bo'lsa, `origin/dev` dan boshlang.
- `dev` da hozircha `9a39eec` (PR #303) bor. `shodiyor` dagi 4-bosqich commitlari hali dev'ga merge qilinmagan.

| Bosqich | Holat |
|---|---|
| 0 tokenlar, 1 primitivlar, 2 shell, 3 forma/dialog/holatlar | tayyor, dev'da |
| 4 sahifalar migratsiyasi | jarayonda, Trello 3/10 band |
| 5 qo'shimcha qo'riqchilar (ESLint, vizual snapshot) | navbatda |

**4-bosqichda ko'chirilgan sahifalar** (ro'yxat `AGENTS.md` 4-qatorida ham bor):

- `/orders` + `/orders/edit/:orderId`
- «Qabul va yaratish»: `/new-orders/create`, marketlar, `/new-orders/:marketId` (+ edit), incoming,
  `/new-orders/branches*`, `/new-orders/cancelled*`
- «Pochta»: `/mails/*`, `/mails/:id`
- «Paketlar va qaytarishlar»: `/batches`, `/batches/:id`, `/returns`

**Yo'l-yo'lakay qo'shilganlar:**

- CI: Playwright e2e endi PR'da yuradi (`c0d81d2`). Ega GitHub'da «Deploy» tekshiruvini `dev` uchun required
  qilishi kerak, aks holda e2e merge'ni to'xtatmaydi.
- Buyurtma yaratish: market almashtirilsa tasdiq oynasi chiqadi (`ae4c9f8`).
- Tabs: sonlar kech yuklansa ham faol tab ko'rinadi.
- Batch `normalizeOrder`: `order:null` holatda `order_id` olinadi.
- Menejer/registrator paket sahifasida admin-only `GET branches` chaqirilib 403 olinardi — tuzatildi.
- Eski pochtalardagi paket qatori endi `/batches/:id` ni ochadi.

## 2. Navbatdagi ish (shu tartibda)

### 2.1 Ega qarorlari (2026-10-17) — hali BAJARILMAGAN

1. **F1 — paket holati badge'i maketdagidek.**
   - `src/entities/batch/model/batchStatus.ts`: `on_the_way` → `"warning"` (buyurtmadagi «Yo'lda» bilan bir xil).
   - `newOrders:batchStatus` yorliqlari: uz `received` «Qabul qilingan», `cancelled` «Bekor qilingan»; ru/en ham
     shu ma'noda.
   - Haqiqiy holat saqlanadi: SENT = «Yo'lda», «Yangi» qattiq yozilmaydi.
   - Barcha iste'molchi testlari yangilanadi: new_orders/branches, batches, returns, mails/old paket rejimi + Excel.
2. **F2 — `/returns` ga qisqartirilgan «Sana» filtri.**
   - Bugun / Hafta / Oy (`period=today|week|month`) va bitta kun (`date=YYYY-MM-DD`); `GET /transfer-batches`
     oraliq (from/to) qabul qilmaydi.
   - URL bilan sinxron, sahifa 1 ga qaytadi, tozalash bor, telefonda filtr varaqasi.
3. **F3 — Pochta birxillashtirishi `design/kit/route-map.json` ga `roleNotes` qilib yoziladi** (ega tasdiqladi).
   Qarorlar:
   - filtrlar ichki yorliqli Select;
   - «Excelga yuklash» karta asboblar qatorida;
   - xulosa qatori barcha xodimlarda;
   - «Qaytarish» tabida bitta doimiy tanlov paneli;
   - «Pochtalar | Filial paketlari» almashtirgichi;
   - paket qatori → `/batches/:id`.
4. **F4 — `/mails/old` server tomonidagi filtr va sahifalash** (XATO, muhim).
   - Backend Trello `YfrqN70i` (Done) bilan `GET /post` endi `region_id`, `courier_id`, `startDate`, `endDate`
     (Toshkent kuni), `has_orders`, `status`, `page`, `limit` (max 100, `limit_capped`) ni bajaradi.
   - `GET /post/courier/old-posts` ham `region_id`, `status`, `startDate`, `endDate`, `has_orders` ni bajaradi.
   - Frontend hali v1 usulida (`limit=10000` + mijozda filtrlash) → amalda faqat oxirgi 100 ta ichida
     filtrlaydi. Server filtrlari + `total` bo'yicha sahifalashga o'tkaziladi.
   - Excel BARCHA filtrlangan qatorlarni oladi (limit=100 bilan sahifalab). UI va URL parametrlari o'zgarmaydi.
5. **F5 — oldingi «backend'da yo'q» xulosalarini `origin/main` bo'yicha qayta tekshirish.**
   - Tekshiriladiganlar:
     - `post/new` kuryeri;
     - `orders/markets/cancelled` parametrlari;
     - `GET branches/:id` rollari;
     - `transfer-batches/:id` filial nomlari va tarixi;
     - `transfer-batches` saralash;
     - qaytarish so'rovida «Marketga».
   - Endi bor bo'lsa va tuzatish kichik bo'lsa, tuzatiladi.
   - Ega qarori: `/mails/today` dagi «Kuryer» ustuni hozirgidek qoladi (backend kuryer yuborsagina).

### 2.2 «Moliya» guruhi (keyingi sahifalar, ~44 maket)

| Route | Fayl |
|---|---|
| `/payments` | `src/pages/payments/index.tsx` + dialoglar, `FinanceHistoryDetailPopup` |
| `/payments/main-cashbox` | `components/mainCashbox.tsx`, `CashboxFormPopup`, `CloseShiftPopup`, `SalaryPaymentPopup` |
| `/payments/cash-detail/:id` | `components/cashDetail.tsx` |
| `/cash-box` | `MyCashboxPage`, `CashboxRolePageLayout`, `CashboxView` (market, kuryer; menejerga maket yo'q) |
| `/financial-balance` | `src/pages/financial-balance/**` (grafiklar — `tizim-charts`) |

**Pul qoidalari:**

- Har pul amali, smena yopish va oylik to'lash tasdiq oynasi orqali.
- `paymentIdempotency.ts` va ikki marta bosishdan himoya aynan saqlanadi.
- Payload'lar va izoh majburiyligi o'zgarmaydi.
- Kassalar orasidagi o'tkazish xarajat emas.
- Chiqim kategoriyasi (18 talik yopiq ro'yxat, Trello `ljVOuNz4`) hali API'da ham, maketda ham yo'q — chizilmaydi.

### 2.3 Qolgan guruhlar (Trello `tzvOkdpI` checklist tartibida)

1. Dashboard. Oldindan ma'lum muammo: `playwright.preview` testida dashboard JS 487 KB > 450 KB byudjet.
2. Foydalanuvchilar / Filiallar / Mahsulotlar.
3. Hududlar.
4. Integratsiyalar / Ops / Faoliyat jurnali (`integrations/ui.ts` olib tashlanadi).
5. Login va xato sahifalari (404/403/500 bitta uslubda).
6. Scan va Kuryer ommaviy (telefon, 48px tugmalar, yopishqoq asosiy harakat).

So'ng 5-bosqich. Kamera skaner rejimlari (`*-camera` ko'rinishlari, `ScannerCameraModal`) ega qarori bilan
**alohida ish** — route-map'da `partialViews`/`newViews` da turibdi.

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
