# design/ — Elchi CRM dizayn v2 maketlari

Bu papkada ega tasdiqlagan **dizayn v2** ning barcha ekranlari turadi (qarorlar 2026-10-09 da qulflangan). Frontendga
tegadigan har bir ish, kim yozganidan qat'i nazar (odam, Claude Code, Codex), shu maketlar bo'yicha qilinadi.
Qoidalar: [`AGENTS.md`](../AGENTS.md) va [`docs/DESIGN_SYSTEM.md`](../docs/DESIGN_SYSTEM.md).

## Kimniki va qaysi nusxa asosiy

- **Egasi:** loyiha egasi (Shodiyor Ergashev). Dizayn qarori, ekran qo'shish yoki o'zgartirishni faqat ega yoki u
  tayinlagan dizayner qiladi.
- **Asl nusxa:** Claude Design kanvasi «Elchi CRM dizayn v2». Havola egada, kerak bo'lsa undan so'rang. Kanvas —
  dizaynerning ish joyi.
- **Dasturchilar uchun manba — shu papka.** Kod `design/` dagi nusxaga qarab yoziladi va PR'lar shu nusxa bo'yicha
  tekshiriladi. Kanvas bilan repo farq qilib qolsa, egadan so'rang. Kanvasdagi tasdiqlanmagan qoralama kodga
  o'tmaydi.

## Ichida nima bor

| Yo'l | Nima |
|---|---|
| `fragments/<rol>--<viewId>.html` + `.json` | 562 ta maket fragmenti: ekranning kontent qismi (shell'siz), `el-*` kit klasslari bilan. `.json`: `kind` (`page` = ilova shell'i ichida, `screen` = shell'siz to'liq ekran, masalan skaner; `standalone` = taxta yoki kirish sahifasi), `height`, ixtiyoriy `dialog`, `devices` |
| `kit/views.json` | 662 ta ekran: `role`, `viewId`, `menuKey` (menyu bo'limi), `title`, `fragment`, `kind` (`page` / `dialog` / `standalone`) |
| `kit/roles.json` | rollar: menyu, persona (ism, filial), pastki menyu, ikonkalar |
| `kit/helmet.html` | maket kiti: tokenlar (kunduzgi/tungi) va barcha `el-*` klasslari. Kodga to'g'ridan-to'g'ri o'tmaydi, tarjimasi [`CODE-MAP.md`](CODE-MAP.md) da |
| `kit/AUTHORING.md` | maketlar qanday chizilgan: qoidalar, matn standarti, holat → ton, grafik qoidalari (v3–v6 bo'limlari) |
| `kit/heights.json` | yig'ilgan artboard o'lchamlari (build uchun) |
| `kit/route-map.json` | route → sahifa fayllari, rol → maket bog'lanishi (qo'lda yuritiladi). `SCREENS.md` shundan yaratiladi |
| `icon-registry.json` | kanonik `lucide-react` ikonkalari (132 ta, 12 guruh) va eski sinonimlarning o'rnini bosuvchilari |
| `assets/_blob/` | maketdagi logotiplar |
| `tools/*.mjs` | `build` (yig'ish), `shoot` (skrinshot), `preview` (brauzerda ro'yxat), `serve` (statik server), `screens` (`SCREENS.md` ni yaratish va tekshirish; `screens.test.mjs` shu tekshiruvni `npm test` da yuradi) |
| [`SCREENS.md`](SCREENS.md) | route / sahifa fayli → maket ekrani jadvali (avtomatik: `npm run design:screens`, qo'lda tahrirlanmaydi) |
| [`CODE-MAP.md`](CODE-MAP.md) | maket klassi → Tailwind v4 + tokenlar → mavjud komponent → 1-bosqich primitivi |
| `.build/`, `shots/` | lokal natijalar, git'ga kirmaydi |

Rollar (ekranlar soni): `superadmin` 222 · `admin` 152 · `manager` 86 · `registrator` 54 · `market` 35 ·
`market_operator` 5 · `courier` 53 · `logist` 10 · `investor` 13 · `common` 19 (umumiy: kirish, bildirishnomalar, profil…) ·
`tizim` 13 (dizayn tizimi taxtalari). `market_operator`, `logist`, `investor` — ega 2026-10-19 da tasdiqlagan yangi rollar,
kodda hali yo'q (menyulari — `kit/route-map.json` → `plannedMenu`; marketning yangi pastki menyusi — `plannedBottomNav`;
menyu testlari `src/widgets/Sidebar` ularni `src/test/designMenu.ts` orqali chetlaydi).

## Ekran nomi

Ekran nomi `<rol>-<viewId>` (**bitta** tire), masalan `manager-orders-list-all`. Fragment fayli esa
`<rol>--<viewId>` (**ikki** tire). Bir fragment bir nechta ekranga xizmat qilishi mumkin: 100 ta ekran boshqa rolning
fragmentini ishlatadi (masalan admin ko'p superadmin fragmentlarini). Ekranning fragmenti `views.json` dagi
`"fragment"` maydonida yozilgan. Istisno: `tizim--main` taxtasining yig'ilgan fayli `Main.dc.html`, ekran nomi `Main`
(`design:shot` va `design:build -- --view` `tizim-main` ni ham qabul qiladi).

Har ekran **6 ko'rinishda** chizilgan: Desktop 1440 · Planshet 768 · Telefon 390, har biri kunduzgi va tungi.
`standalone` taxtalar faqat desktop. `dialog` turidagi ekran ota sahifa ustida ochiq oyna (telefonda pastki varaqa).

## Qanday ko'rish

```bash
npm run design:preview                      # http://127.0.0.1:4199 — rol → bo'lim → ekran ro'yxati (PORT=… bilan o'zgaradi)
npm run design:shot -- manager-orders-list-all                      # 6 ta PNG → design/shots/
npm run design:shot -- manager-orders-list-all --device phone --theme dark
npm run design:build                        # hammasini yig'ish → design/.build/  (-- --view <ekran> | -- --only <rol>)
```

- Skrinshot: `design/shots/<ekran>--<desktop|tablet|phone>-<light|dark>.png`. Konsolga JSON hisobot chiqadi:
  `overflowX` (gorizontal toshish, 0 bo'lishi kerak), `tiny` (12px dan kichik matn soni).
- Claude Code PNG'ni `Read` bilan o'qib dizaynni **ko'radi**. Codex'da rasm ko'rish vositasidan foydalaning.
  Odam `design:preview` ni ochadi.
- Birinchi marta: `npx playwright install chromium`.
- `design:shot` avval yig'ilgan `design/.build/<ekran>.dc.html` ni qayta ishlatadi. `design/` yangilangandan keyin
  `npm run design:build` ni qayta yuring (yoki `design/.build/` ni o'chiring), aks holda eski maketni ko'rasiz.

### Ilovani ko'rish (app:shot)

Maket bilan solishtirish uchun **haqiqiy ilova** sahifasining skrinshoti. Akkaunt va backend kerak emas: Vite shu
buyruq ichida ishga tushadi, API so'rovlari brauzerda ushlanib bo'sh JSON bilan javob beriladi, sessiya soxta token
bilan ochiladi (rol `--role`, sukut `superadmin`).

```bash
npm run app:shot -- /ops/ui-kit                                  # 6 ta PNG → design/shots/app/
npm run app:shot -- "/ops/ui-kit?section=buttons" --device phone --theme dark
npm run app:shot -- /orders --role manager --lang ru --split 1200
npm run app:shot -- / /orders --role manager --branch-type REGIONAL  # menejer menyusi filial turiga bog'liq
npm run app:shot -- /orders --device phone --width 375             # 375 telefon; --device desktop --width 1024 — chegara
```

Bayroqlar (bir nechta route bitta buyruqda): `--device desktop|tablet|phone` (sukut — uchalasi: 1440 / 768 / 390) ·
`--theme light|dark` (sukut — ikkalasi) · `--role superadmin|admin|manager|registrator|market|courier` (sukut
`superadmin`) · `--branch-type …` · `--lang uz|ru|en` (sukut `uz`) · `--width <px>` · `--split <px>` (uzun sahifa
bo'laklarga: `-1.png`, `-2.png` …) · `--wait <css-selektor>` (shu element chiqquncha kutadi; sukut — `<main>` ichida
kontent).

- `--width <px>` — tanlangan qurilma oynasining kengligi (320…3840). Balandlik va sensorli rejim `--device` dan qoladi
  (`phone` — 844, sensorli; `tablet` — 1024; `desktop` — 900). Qobiq chegaralarini (375 / 1024) tekshirish uchun.
  Fayl nomiga `-w<px>` qo'shiladi: `orders--phone-w375-light.png`.

- `--branch-type HQ|REGIONAL|HYBRID|PICKUP|none` — soxta profildagi filial turi (`menuConfig.tsx` →
  `getUserBranchType` o'qiydigan `branch.type` / `branch_type`). Menejer menyusi va guardlari (`MANAGER_CAPABILITIES`),
  registratorning «Kuryerga berish» bandi shundan. Sukut: `manager` → `HYBRID` (maketdagi to'liq menyu,
  `design/kit/roles.json`), `registrator` → `HQ` (persona «Toshkent HQ»), `courier` → `REGIONAL`; boshqa rollarda
  filial yo'q. `none` — filial turi aniqlanmagan holat (menejerda ogohlantirish va bazaviy menyu). Har rol shu bilan
  o'zining haqiqiy menyusini chizadi.

- Natija: `design/shots/app/<route>--<desktop|tablet|phone>-<light|dark>.png` (rol, filial turi yoki til sukutdan
  farq qilsa, nomga qo'shiladi: `orders-manager-regional--phone-light.png`). Bo'lim yuklanish chizig'i
  (`[data-route-progress]`) so'ngach suratga olinadi. Qobiq balandligi oynaga teng, shuning uchun skript oynani `<main>` kontenti to'liq tushadigan
  qilib cho'zadi.
- JSON hisobot: `finalPath` (`/403` yoki `/login` — guard o'tkazmadi), `overflowX` / `contentOverflowX` (0 bo'lsin),
  telefonda `smallTargets` / `smallTargetsInMain` (44px dan kichik bosiladigan elementlar, namunasi bilan),
  `tinyText` / `tinyTextInMain` (12px dan kichik matn), `consoleErrors`. Qobiqda (`<main>` tashqarisida) topilsa
  qo'shimcha `smallTargetsShellSample` / `tinyTextShellSample` namunalari chiqadi — qobiq uchun ular bo'lmasligi kerak.
- Ma'lumot bo'sh — sahifa bo'sh holatida chiziladi. To'ldirilgan holatni rol akkaunti bilan `npm run dev` da tekshiring.
- `/ops/ui-kit` (faqat superadmin, menyuda yo'q) — 1-bosqich primitivlari (`src/shared/ui/primitives`) namunasi,
  kunduzgi va tungi yonma-yon; `?section=buttons|badges|cards|page-header|tabs|format` bitta bo'lim,
  `?theme-pair=0` faqat joriy mavzu.

## Ekranni qanday topish

1. **`design/SCREENS.md`**: sahifa fayli yoki route bo'yicha qidiring. U ekran nomini (`<rol>-<viewId>`) beradi.
2. **Rol bo'yicha.** Bir sahifani bir nechta rol ko'radi va har rolning o'z maketi bor. Rollar orasidagi farq muhim:
   masalan menejerning buyurtma tafsilotida «Sotish / Bekor» bor, superadminnikida yo'q. Har rol uchun o'z ekranini
   oching.
3. **Bo'lim bo'yicha**: shu bo'limning barcha ekranlari (ro'yxat, tafsilot, dialoglar):
   ```bash
   node -e 'for (const v of require("./design/kit/views.json").views) if (v.role==="manager" && v.menuKey==="orders") console.log(`${v.role}-${v.viewId}`, "·", v.kind, "·", v.title)'
   ```
4. **Sarlavha bo'yicha**: `grep -n '"title": "Buyurtma tafsiloti' design/kit/views.json`.
5. **Holatlar** (hover, fokus, xato, bo'sh, yuklanish): `tizim-states-buttons`, `tizim-states-forms`,
   `tizim-states-navigation`, `tizim-states-data`, `tizim-loading`, `tizim-feedback`, `tizim-errors`.
   Grafiklar: `tizim-charts`. Skaner: `tizim-scanner`. Moslashuvchanlik: `tizim-responsive`.
   Oltin sahifalar: ro'yxat `superadmin-orders-list`, grafiklar `superadmin-dashboard-main`.

Maketdagi ma'lumotlar (ismlar, summalar) o'ylab topilgan. Matnlar (yorliqlar, tugma nomlari, holatlar) esa
tasdiqlangan o'zbekcha nusxa. Ularni locale fayllariga (uz/ru/en) olib o'ting. **Matn uchun fragment HTML'i ustun:**
`kit/views.json` dagi `title` va `kit/route-map.json` izohlari — faqat yorliq (ba'zilari eskirgan, masalan
`*-returns-list` sarlavhasi «Return batchlar», fragmentda «Qaytarishlar»). Maketdagi «Taklif» belgili element
backend hali bermaydigan taklif: kodga faqat API bo'lsa kiradi.

## Maket yangilanganda

1. Ega yoki dizayner kanvasni o'zgartiradi va tasdiqlaydi.
2. `design/` papkasi kanvasdan **alohida PR** bilan sinxronlanadi (`design: …` sarlavha). Unda `fragments/`,
   `kit/*.json`, `kit/helmet.html`, kerak bo'lsa `tools/` bo'ladi, ro'yxati bilan: qaysi ekranlar qo'shildi yoki
   o'zgardi. Shu PR'da kerak bo'lsa `kit/route-map.json` (keyin `npm run design:screens`), `CODE-MAP.md`,
   `docs/DESIGN_SYSTEM.md` ham yangilanadi.
3. Kod keyingi PR'larda yangi maketga moslashtiriladi.

Dasturchi `design/` ichidagi maket fayllarini (`fragments/`, `kit/`, `assets/`) qo'lda tahrirlamaydi. Yagona
istisno `kit/route-map.json`: route qo'shilsa, o'chirilsa yoki sahifa v2 ga ko'chirilsa, dasturchi uni o'z PR'ida
yangilaydi va `npm run design:screens` ni yuradi (`-- --check` faqat tekshiradi; xuddi shu tekshiruv `npm test` ichida
`design/tools/screens.test.mjs` sifatida CI'da yuradi). Maketda xato,
kamchilik yoki yetishmayotgan holat topsangiz, egaga ayting (Trello «Dizayn v2» kartasi yoki PR izohi) va PR'da
yozing. Maket «kod qulay bo'lsin» deb o'zgartirilmaydi. Yangi ekran kerak bo'lsa, avval maket qilinadi.
