# Elchi CRM — Dizayn tizimi v2

> Holat (2026-10-19): **0–5 bosqichlar tayyor.** 4 (sahifalar): 77 route'dan 76 tasi v2 — G1, G2, G3 birlashtirildi,
> `/scan` skaner 1-bosqichida (`design/SCREENS.md`); 5 (qo'riqchilar, §12): ESLint `design-v2/*` butun `src` da xato,
> `V2_SCOPES` + `named-colour`, vizual snapshotlar (CI «Visual», 23 sahna). Kamera ishi (skaner 1–4-bosqich) tayyor.
> Qolgan ish (§14): yopiq `/market-operators`, v1 ratchet ro'yxatlari (§12.2, §12.3), «Visual» baseline'lari va required tekshiruv (§12.5).
> Trello: «Dizayn v2» kartalari.

Bu hujjat — yangi UI yozayotgan har bir frontchi va AI agent uchun **majburiy** qoidalar. Qisqa versiyasi
`AGENTS.md` da. Barcha ekranlarning tasdiqlangan chizmalari (desktop / planshet / telefon × kunduzgi / tungi)
repo'da — `design/` (qanday ko'rish: `design/README.md`; marshrut → maket: `design/SCREENS.md`;
`npm run design:shot -- <view>` PNG chiqaradi). Asl nusxa — egadagi Claude Design kanvasi «Elchi CRM dizayn v2».

## 1. Qulflangan qarorlar (ega, 2026-10-09)

| Qaror | Qiymat |
|---|---|
| Brend | navy `#1f2853` + ko'k action (`#2b50d8` kunduzgi / `#8ea6ff` tungi) |
| Sukut mavzusi | **Kunduzgi (light)** — tungi faqat foydalanuvchi tanlasa |
| Shrift | **Manrope** (o'zgaruvchan 400–800; asosan 400/500/600/700, KPI raqamlari 800 gacha) |
| Valyuta | uz `so'm` · ru `сум` · en `UZS`; ixcham `mln/ming/mlrd` · `млн/тыс./млрд` · `M/K/B` |
| Ikonkalar | faqat `lucide-react` |

Eski to'rt brend (`#576adb`, `#7c3aed`, antd `#6366f1`, `#7c5cff`) va binafsha tungi mavzu **olib tashlangan** —
`src/test/paletteGuard.test.ts` ularning qaytishiga yo'l qo'ymaydi.

**Mavzu migratsiyasi.** Ilgari server sozlamasi va `localStorage["theme"]` ga sukut bo'yicha `"dark"` yozilardi.
Endi saqlangan mavzu faqat foydalanuvchi uni **o'zi tanlagan** bo'lsa qo'llanadi: serverda
`appearance.themeChosen === true`, brauzerda `localStorage["theme-version"] === "2"` (`preferencesStorage.ts`,
`entities/settings`). Shuning uchun avval tungini tanlagan foydalanuvchilar bir marta kunduzgiga qaytadi va
Sozlamalardan qayta tanlaydi. Mavzuni yozadigan yangi kod `writeStoredTheme()` va `themeChosen: true` dan foydalanadi.

## 2. Tokenlar

Yagona manba — `src/index.css` (`@theme` = kunduzgi, `.dark` = tungi). JS kerak bo'lgan joylar (antd, grafiklar)
uchun aynan nusxa — `src/shared/config/themeTokens.ts`; ikkalasini `themeTokens.test.ts` solishtiradi.
Tailwind'da token nomi bilan ishlatiladi: `bg-surface`, `text-text-muted`, `border-border`, `bg-action`,
`text-on-solid`, `bg-success-soft text-success-fg` …

| Token | Kunduzgi | Tungi | Ma'nosi |
|---|---|---|---|
| `bg` | `#f4f6fb` | `#0d1120` | sahifa foni |
| `surface` | `#ffffff` | `#151a2e` | karta, panel, jadval |
| `raised` | `#ffffff` | `#1c2240` | dialog, dropdown, popover |
| `sunken` | `#f0f3f9` | `#11162a` | jadval sarlavhasi, segment fon, chiplar |
| `input` | `#ffffff` | `#11162a` | maydonlar |
| `row-hover` | `#f7f9fd` | `#1a2036` | qator ustiga kelinganda |
| `border` | `#e1e6f0` | `#262d4a` | ajratuvchi chiziqlar |
| `border-strong` | `#c9d1e0` | `#3a4366` | maydon chegarasi |
| `text` | `#101733` | `#e8ebf7` | asosiy matn |
| `text-muted` | `#4b5575` | `#a7afcb` | yordamchi matn (AA ≥ 4.5:1) |
| `text-subtle` | `#7c859f` | `#7a83a3` | placeholder, o'q yorliqlari (faqat ≥ 12px) |
| `brand` | `#1f2853` | `#c9d2f5` | logotip, brend urg'usi |
| `nav` | `#1f2853` | `#0a0e1b` | yon menyu foni (2-bosqich) |
| `nav-accent` | `#8ea6ff` | `#8ea6ff` | **navy/to'q fon ustidagi** urg'u: faol menyu, skaner ramkasi, xato sahifasi ikonkasi (oq yuzada ishlatilmaydi) |
| `nav-text` | `rgba(255,255,255,.80)` | `rgba(232,235,247,.78)` | yon menyu bandi matni va ikonkasi (faqat `nav` ustida; AA: 9.5 / 10.0) |
| `nav-muted` | `rgba(255,255,255,.52)` | `rgba(232,235,247,.48)` | yon menyu guruh sarlavhasi (12px/600, katta harf; 4.9 / 4.4) |
| `nav-hover` | `rgba(255,255,255,.08)` | `rgba(232,235,247,.06)` | yon menyu bandi hover foni |
| `nav-active` | `rgba(255,255,255,.14)` | `rgba(142,166,255,.16)` | yon menyu faol bandi foni (`aria-current="page"`) |
| `nav-line` | `rgba(255,255,255,.10)` | `rgba(232,235,247,.08)` | yon menyu ichidagi chiziq (logotip ostida) |
| `nav-count` | `rgba(255,255,255,.14)` | xuddi shu | yon menyu son pilyulasi foni |
| `on-nav` | `#ffffff` | `#ffffff` | `nav` ustidagi hover/faol band matni, son pilyulasi matni (faol band ustida 9.1 / 14.9) |
| `avatar` | `#1f2853` | `#2b3768` | foydalanuvchi avatari (bosh harflar doirasi, maket `.el-avatar`; tunda `brand` emas — och doira bo'lib qolardi) |
| `on-avatar` | `#ffffff` | `#e8ebf7` | avatar ustidagi bosh harflar |
| `action` | `#2b50d8` | `#8ea6ff` | asosiy tugma foni, faol holat — **ko'k faqat interaktiv narsa** |
| `action-hover` | `#2443b8` | `#a9bbff` | hover |
| `action-fg` | `#2b50d8` | `#8ea6ff` | havola, faol tab matni |
| `action-soft` | `#e8edfd` | `rgba(142,166,255,.14)` | tanlangan qator, yumshoq tugma |
| `on-solid` | `#ffffff` | `#0d1120` | `action` fon ustidagi matn (tungida to'q!) |
| `focus` | `rgba(43,80,216,.28)` | `rgba(142,166,255,.38)` | fokus soyasi |
| `success` / `-fg` / `-soft` | `#12704f` / `#12704f` / `#e3f4ec` | `#4fc58e` / `#4fc58e` / 14% | sotilgan, to'langan, faol |
| `warning` / `-fg` / `-soft` | `#95560a` / `#95560a` / `#fcf0dc` | `#f1b24e` / `#f1b24e` / 14% | jarayonda, kutilmoqda |
| `danger` / `-fg` / `-soft` | `#be2a3b` / `#be2a3b` / `#fde8ea` | `#ff7182` / `#ff7182` / 14% | bekor, xato, qarz |
| `info` / `-fg` / `-soft` | `#1a62a8` / `#1a62a8` / `#e2effa` | `#6bb6f3` / `#6bb6f3` / 14% | yangi, yaratilgan, qabul qilindi |
| `overlay` | `rgba(16,23,51,.45)` | `rgba(3,5,12,.62)` | modal orqa foni |
| `chart-1…8`, `chart-muted` | 3-bo'limga qarang | | grafiklar |

**Qoidalar**
- Holat rangi har doim **matn yoki ikonka bilan** birga (faqat rang bilan ma'no berilmaydi).
- Holat **matni** uchun `*-fg`, yumshoq fon uchun `*-soft`, to'liq fon uchun asosiy token (`success`, `danger` …)
  + `on-solid` matn. Tungi mavzuda asosiy holat rangi maketdagidek ochiq (`*-fg` bilan bir xil) va matn to'q —
  ikkala mavzuda AA (1-bosqichda maketga moslashtirildi; ilgari tungi qiymat to'qroq edi).
- Tungi mavzuda `action` fon ustidagi matn — `on-solid` (to'q). Oq matn faqat eski `main` ustida (alias, quyida).
- Navy (`nav`) fon ustidagi matn — faqat `nav-text` / `on-nav` / `nav-muted` (`on-solid` tungida to'q bo'lib qoladi,
  `text-*` esa yorug' yuza uchun). Bu tokenlar 2-bosqichda maketdagi `--sidebar-*` dan olindi; `nav-*` yarim shaffof,
  shuning uchun faqat `nav` foni ustida ishlatiladi (kontrast `themeTokens.test.ts` da aralashtirib o'lchanadi).
  Eski `sidebar` nomi — **sahifa foni** aliasi (`bg`), yon menyu emas.
- Yangi kodda **hex, `rgb()`, Tailwind rang oilalari (`bg-blue-500`, `text-gray-400` …) yozilmaydi** — faqat tokenlar.
  `dark:` juftlari ham kerak emas: tokenlar mavzuga o'zi moslashadi.

### Eski nomlar (alias — yangi kodda ishlatilmaydi)
Sahifalar 4-bosqichda ko'chiriladi; hozircha eski nomlar yangi tokenlarga ishora qiladi. Ba'zilari mavzuga qarab
**boshqa** tokenga boradi (eski kodda bir nom ikki xil vazifada ishlatilgani uchun):

| Eski nom | Kunduzgi | Tungi |
|---|---|---|
| `main` | `action` | `#4c6ae6` — eski kodda asosan oq yozuvli fon: oq matn 4.6:1 (AA), yuzadagi matn ~3.7:1 (eski binafsha 3.0 edi). Yangi kodda `bg-action text-on-solid` / `text-action-fg` |
| `maindark` | `brand` | `surface` |
| `primary` | `#ffffff` | `#ffffff` — **brend emas, oq**: eski kodda kunduzgi karta foni (`bg-primary dark:bg-maindark`) va tungi oq matn (`dark:text-primary`). v2: `bg-surface`, `text-text` |
| `primarydark` | `action-hover` | `raised` |
| `sidebar` | `bg` | `sunken` |
| `border-soft` | `border` | `rgba(142,166,255,.14)` |
| `page-surface` | `surface` | `surface` |
| `card-surface` | `row-hover` | `surface` |
| `purple` / `purple-dark` / `purple-light` / `purple-soft` | `action` / `action-hover` / `#5b7cf0` / 18% | `main` / `#2f4bc4` / `#a9bbff` / 20% |
| `error` | `danger` | `danger` |
| `surface-elevated` | `raised` | `raised` |
| `dark-bg-py` | `#0d1120` | `bg` |
| `warning-start` / `-end` | `#b26a10` / `#95560a` | `#f59e0b` / `#f97316` |
| `error-page-*` | navy → ko'k gradient, ikonka `nav-accent` | xuddi shu |
| `region-map-*` | bitta ko'k ketma-ket shkala (eski yashil o'rniga) | to'q ko'k shkala |

Muhim: 0-bosqich faqat **tokenlar** darajasida. Sahifa TSX fayllarida eski hex / Tailwind rang oilalari
(`bg-gray-*`, `text-[#…]`, `dark:…`) 4-bosqichgacha **qoladi** — ularni ko'chirish o'sha sahifaning PR'ida.
Yangi qo'shilgani esa design guard (`npm run design:guard`, CI) tomonidan bloklanadi.

## 3. Grafiklar

Kategorial palitra (`--color-chart-1…8`, `CHART_PALETTE`) ikkala mavzu yuzasida `validate_palette.js` bilan
tekshirilgan (qo'shni juftlar CVD ΔE ≥ 8.4, oddiy ko'rish ΔE ≥ 19.3):

| # | Kunduzgi | Tungi |
|---|---|---|
| 1 | `#2b50d8` | `#5b7cf0` |
| 2 | `#eb6834` | `#d95926` |
| 3 | `#1baf7a` | `#199e70` |
| 4 | `#eda100` | `#c98500` |
| 5 | `#e87ba4` | `#d55181` |
| 6 | `#008300` | `#008300` |
| 7 | `#4a3aa7` | `#9085e9` |
| 8 | `#e34948` | `#e66767` |

- Tartib **o'zgarmaydi**, ranglar seriya **o'rniga emas, mohiyatiga** bog'lanadi; 8 dan ortig'i «Boshqa»ga yig'iladi.
- Kunduzgi 3, 4, 5-ranglar oq fonda 3:1 dan past — ularda yonidagi yorliq yoki jadval ko'rinishi majburiy.
- Miqdor (xarita, issiqlik jadvali) — bitta ko'k ketma-ket shkala; ijobiy/salbiy — ko'k ↔ qizil + kulrang o'rta.
- Ma'nosi yaxshi/yomon bo'lgan seriya (xato, bekor) — holat tokenlari; oddiy seriya — kategorial.
- Ikki o'qli grafik yo'q; ingichka chiziqlar (ustun ≤ 24px, chiziq 2px), yorliq tanlab qo'yiladi, har grafikda
  «Grafik | Jadval» egizagi. Muvaffaqiyat darajasi — yarim doira «speedometr» (≥70% success, 40–70 warning, <40 danger).

## 4. Tipografiya

Shrift: **Manrope** (`--font-sans`). Raqamlar ustunlarda (`td`, `th`, `.tabular-nums`) `tabular-nums`; katta
yakka raqamlar (KPI) — oddiy raqamlar.

| Rol | O'lcham / qator | Qalinlik |
|---|---|---|
| Sahifa sarlavhasi (h1) | 24 / 32 (telefon 20 / 28) | 700 |
| Bo'lim (h2) | 16 / 24 | 700 |
| Karta sarlavhasi (h3) | 14 / 20 | 600 |
| Asosiy matn | 14 / 20 | 400–500 |
| Kichik | 13 | 400–500 |
| Eng kichik (badge, o'q) | 12 — **12px dan kichik matn yo'q** | 600 |
| Overline / jadval sarlavhasi | 12, katta harf, `letter-spacing .04em` | 600 |

## 5. O'lchamlar

- Oraliq shkalasi: 4 · 8 · 12 · 16 · 20 · 24 · 32 px.
- Radius: badge 6 · kichik tugma 8 · tugma/maydon 10 · katta tugma 12 · karta 14 · dialog 16–20 · pill 999.
- Boshqaruv balandligi: 32 (kichik) · **40 (sukut)** · 48 (katta); telefonda bosiladigan har narsa **≥ 44px**.
- Jadval: sarlavha 40px (`sunken`, `text-muted`, katta harf), qator 56px, chiziq `border`.
- Karta ichida karta — ko'pi bilan 2 qavat.

## 6. Moslashuvchanlik

Breakpointlar: **≥ 1024** sidebar · **768–1023** menyu tugmasi + suriluvchi panel, jadvalning ikkinchi
darajali ustunlari yashiriladi · **< 768** pastki menyu (5 band, yorliq bir qatorda, ≤ 70px; skaner rollarida
markazda «Skaner»), jadval → kartalar, filtrlar «Filtrlar» tugmasi orqasida, dialog → pastdan chiquvchi oyna,
asosiy amal pastda to'liq enli. Telefon kamerasi bilan skanerlash — to'liq ekran.

**Shell** (`widgets/layout/dashboardLayout.tsx`, maket `.el-app`/`.el-content`): sahifa bitta kanvasda (`bg`),
kontent karta emas — `max-w-[1440px]`, undan keng ekranda markazda, chekkalar ≥ 1024: 24 · 32 · 48 px, < 1024: 16 · 16 · 88 px. Yon menyu 248px
(≥ 1024), yuqori panel 64px, telefonda pastki menyu 64px + safe-area (kontent uning ostida qolmaydi). Skroll — faqat
shell'ning `<main>` ida: bo'lim (yo'l) almashsa tepaga, faqat `?search` (tab, filtr) o'zgarsa joyida, «Orqaga» —
oldingi joyi. Bo'limlar orasida o'tishda butun ekranli yuklovchi yo'q: 150 ms dan keyin tepada 3px `action` chiziq
(`RouteProgress`), menyuda bosilgan band darhol tanlangan. Sahifa ichida yon menyu, pastki menyu yoki sahifa darajasidagi o'z skroll
konteyneri yasalmaydi. Sahifa `[data-shell-slot=content]` ichida chiziladi: o'ziga tashqi karta (`bg-surface` o'rami),
tashqi chekka (`p-*` / `px-*`), `h-screen` yoki pastki menyu uchun joy qo'shmaydi — bular shell'da; sahifa ildizi
faqat bo'limlar oralig'i (`flex flex-col gap-6 max-md:gap-4`).

**Telefonda filtrlar:** ≤ 2 ta filtr — qatorda, ustma-ust (`max-md:min-h-11`; namuna `manager-returns-list`);
≥ 3 ta — «Filtrlar» tugmasi (soni bilan) + pastdan chiquvchi oyna, «Tozalash» va «Natijalarni ko'rsatish (N)»
(namuna `superadmin-orders-list` → `superadmin-orders-filters-mobile`). Maket telefonda filtrni ataylab
yashirgan bo'lsa (`courier-orders-all`), uni qo'shish — ega qarori.

## 7. Format qoidalari

Manba — maket `Main` → «Format standarti» (`design/fragments/tizim--main.html`); ilovada `/ops/ui-kit?section=format`.
Pul, son va foiz **faqat** `src/shared/lib/formatMoney.ts`, telefon — `src/shared/lib/formatPhone.ts`, sana —
`src/shared/lib/formatDateTime.ts` orqali. Har formatlovchi `{ language: "uz" | "ru" | "en" }` oladi; berilmasa —
i18n joriy tili (`resolveMoneyLanguage`, `ru-RU` → `ru`, noma'lum → `uz`).

| Formatlovchi | O'zbekcha | Ruscha | Inglizcha |
|---|---|---|---|
| `formatMoneyLocalized(185000)` | `185 000 so'm` | `185 000 сум` | `185,000 UZS` |
| `formatMoneyLocalized(-240000)` (qarz) | `−240 000 so'm` | `−240 000 сум` | `−240,000 UZS` |
| `formatSignedMoneyLocalized(185000)` (kirim) | `+185 000 so'm` | `+185 000 сум` | `+185,000 UZS` |
| `formatSignedMoneyLocalized(-240000)` (chiqim) | `−240 000 so'm` | `−240 000 сум` | `−240,000 UZS` |
| `formatCompactMoneyLocalized(48_600_000)` | `48,6 mln so'm` | `48,6 млн сум` | `48.6M UZS` |
| `formatCompactMoneyLocalized(185_000)` | `185 ming so'm` | `185 тыс. сум` | `185K UZS` |
| `formatCompactMoneyLocalized(1_200_000_000)` | `1,2 mlrd so'm` | `1,2 млрд сум` | `1.2B UZS` |
| `formatCompactAxisMoney(1_050_000)` (grafik o'qi) | `1,05 mln` | `1,05 млн` | `1.05M` |
| `formatNumberLocalized(1545000)` | `1 545 000` | `1 545 000` | `1,545,000` |
| `formatPercentLocalized(8.2)` | `8,2%` | `8,2 %` | `8.2%` |
| `formatPercentLocalized(-6.2)` | `−6,2%` | `−6,2 %` | `−6.2%` |
| `formatPhone("998901234567")` | `+998 90 123 45 67` | `+998 90 123 45 67` | `+998 90 123 45 67` |
| `toTelHref("90 123 45 67")` | `tel:+998901234567` | `tel:+998901234567` | `tel:+998901234567` |
| `formatDateLocalized(value)` | `08.10.2026` | `08.10.2026` | `08.10.2026` |
| `formatTimeLocalized(value)` | `19:05` | `19:05` | `19:05` |
| `formatDateTimeLocalized(value)` — eski | `06.10.2026, 19:05` | `06.10.2026, 19:05` | `06.10.2026, 19:05` |
| `formatDateTimeLocalized(value)` — bugun | `Bugun, 14:15` | `Сегодня, 14:15` | `Today, 14:15` |
| `formatDateTimeLocalized(value)` — kecha | `Kecha, 18:04` | `Вчера, 18:04` | `Yesterday, 18:04` |

**Pul.** Butun so'mga yaxlitlanadi; minglik ajratkichi uz/ru — bo'sh joy, en — vergul; kasr ajratkichi uz/ru — vergul,
en — nuqta. `withCurrency: false` — faqat raqam (valyuta ustun sarlavhasida bo'lsa). Noto'g'ri qiymat (`null`, `"abc"`,
`NaN`) — `0`; satr son qabul qilinadi (xom SQL `numeric` satr qaytaradi).

**Manfiy son — haqiqiy minus `−` (U+2212)**, chiziqcha `-` emas: pul, son, ixcham, foiz — hammasi. Yaxlitlab nol
bo'lsa — minussiz `0`. Qo'lda `"-" + formatMoney(...)` yozilmaydi.

**Ishorali pul** (kirim/chiqim ro'yxati, balans harakati, «Balansga ta'siri») — `formatSignedMoneyLocalized`:
musbat `+`, manfiy `−`, nol ishorasiz (`0 so'm`). Rangni chaqiruvchi beradi: kirim `text-success-fg`, qarz/chiqim
`text-danger-fg`; ishora matnda turadi — rang yolg'iz ma'no bermaydi.

**Ixcham** — faqat ko'rsatkich kartasi (KPI) va grafik: 1000 dan kichik summa to'liq, so'ng ming / mln / mlrd
(ru `тыс.` / `млн` / `млрд`, en `K` / `M` / `B` raqamga yopishib), bitta kasr xonasi, ortiqcha `,0` yo'q (`5 mln`).
Pog'ona chegarasi yaxlitlangandan keyin tanlanadi (`999 950` → `1 mln`, `1000 ming` emas). Grafik o'qi —
`formatCompactAxisMoney` (`shared/config/designSystem.ts`, 2 xonagacha: `1,05 mln`, `3 mln`); KPI karta —
`formatCompactMoney` (1 xona: `1,1 mln`). Ikkalasi joriy tilni oladi va valyutasiz.

**Foiz** — 1 xona sukut, ortiqcha nolsiz (`50%`); rus tilida son va `%` orasida bo'linmas bo'sh joy (U+00A0,
maketdagi `8,2 %`), uz/en — bo'sh joysiz. `.toFixed(1) + "%"` yozilmaydi.

`shared/config/designSystem.ts` dan v2 da faqat `formatNumber`, `formatMoney`, `formatCompactMoney`,
`formatCompactAxisMoney` (formatMoney.ts ustidagi o'ramlar) va `ratio` ishlatiladi. `TYPO`, `TEXT`, `TONE`,
`toneAccent`, `toneSoftBg`, `formatPercent` — v1 (`@deprecated`, qo'riqchining `v1-helper` qoidasi sanaydi).

`Intl.NumberFormat("uz-UZ")`, `Intl.DateTimeFormat`, `toLocaleString` va yangi kodda `dayjs` ishlatilmaydi —
Chrome'da `uz` ICU ma'lumoti yo'q va u "1,545,000" beradi (testda esa to'g'ri chiqib, xatoni yashiradi).
Valyuta yorlig'i locale'da ham bir xil: `orders.currency`, `payments.currency` … → uz `so'm` / ru `сум` / en `UZS`
(`CURRENCY_LABEL`).

**Telefon** — hamma tilda `+998 90 123 45 67` (2-3-2-2). Qabul qilinadi: 9 xona (`901234567`), 12 xona `998` bilan
(`+` bilan yoki siz), `00998…`; bo'sh joy, chiziqcha, qavs, nuqta bilan ham. Xorijiy yoki chala raqam — o'zgarishsiz
(xato ko'rinib tursin), bo'sh — `—`. `toTelHref` — `<a href>` uchun; telefonga o'xshamasa yoki `+998` bilan
boshlanib xonasi 12 ta bo'lmasa — `undefined` (havola chizilmaydi). Maydon niqobi (yozish paytida) — `phone.ts`.

**Sana** — hamma tilda `KK.OO.YYYY`, vaqt 24 soatlik, sana va vaqt vergul bilan. Jadval va ro'yxatda
`formatDateTimeLocalized`: bugun / kecha — so'z bilan (kalendar kuni bo'yicha, 24 soatlik oyna emas), eskiroq yoki
kelajak — to'liq sana; `{ relative: false }` — har doim to'liq. Qiymat — `Date`, ISO satr (`Z` / `+05:00` hisobga
olinadi, mintaqasiz — mahalliy vaqt), millisekund yoki ilovaning o'z ko'rinishi (`06.10.2026, 19:05`); bo'sh yoki
noto'g'ri (`2026-02-30`, `10/06/2026`) — `—`. Brauzerning mahalliy vaqti (timezone plagini yo'q).

- Buyurtma: `№10241` (bo'sh joysiz) · Soni: `1 248 ta buyurtma` (ru ko'plik shakli: `1 248 заказов`) — i18n kaliti +
  `formatNumberLocalized`.

## 8. Matn va holatlar

- O'zbek lotin, gap registri (Title Case yo'q). Inglizcha so'z yo'q («history», «Export», «Return» emas):
  `Bosh sahifa`, `Qaytarishlar`, `Filial paketlari`, `Yaratilgan`, `Nofaol`, `Excelga yuklash`, `Operatsiyalar tarixi`.
- Buyurtma holati → ton: Yangi / Yaratilgan / Qabul qilindi — **info**; Yo'lda, Kutilmoqda, Qisman to'langan —
  **warning**; Sotilgan, To'langan — **success**; Bekor qilingan, Bekor — jo'natilgan — **danger**; Yopilgan — neytral.
- Pul o'tkazish, foydalanuvchini nofaol qilish, «Kunni yakunlash» — **tasdiqlash oynasi** orqali
  (`useConfirm()` / `ConfirmDialog`). Shu qatorda: kassa va to'lov amallari (maosh, kassadan to'lov), API kalitini
  almashtirish, hamkor/ulanishni o'chirish, filialdan chiqarish, buzuvchi o'chirish. Tasdiq tugmasida aniq fe'l
  («Nofaol qilish», «O'chirish», «Tasdiqlash»; maket shunday bersa — «Ha, yangilash»), «OK» emas; buzuvchi amal —
  `tone: "danger"` va `irreversible`; pul — `amount` + `transfer` (Qayerdan → Qayerga); oqibat — `details` /
  `consequences`. Matn — maketdagi `*-dialog` ekrani (`design/kit/views.json`, `kind: "dialog"`).
  Ataylab tasdiqsiz: forma oynasining o'zi qaror bo'lgan joylar (kassani to'ldirish/xarajat, «Tashuvchidan olingan
  to'lov», kuryerni o'tkazish, sotish/bekor qilish oynalari — maketda ham alohida tasdiq yo'q), darhol qaytariladigan
  ruxsat kalitlari (foydalanuvchi tafsilotidagi switch'lar) va faollashtirish.
- **Xabar** (amal natijasi) — `notify.success|info|warning|error()` (`src/shared/lib/notify.ts`, `<Toaster />`):
  sarlavha 2–4 so'z, izoh — tafsilot; ko'pi bilan bitta amal tugmasi; xato foydalanuvchi yopguncha turadi.
  antd `message` / `notification` ishlatilmaydi (ESLint).
- **Holatlar** — `QueryBoundary`: yuklanish — skelet (400 ms kechikish, 15 s dan keyin «sekin» izohi), bo'sh —
  `EmptyState` (nima uchun bo'sh + keyingi qadam), xato — `ErrorState` (turi o'zi aniqlanadi: server, tarmoq,
  ruxsat yo'q …) + «Qayta urinish».

## 9. Kirish qulayligi

- Kontrast: matn ≥ 4.5:1, katta matn va UI ≥ 3:1 — `themeTokens.test.ts` asosiy juftlarni tekshiradi.
- Klaviatura fokusi ko'rinadi (`:focus-visible` → `action` rangidagi 2px halqa).
- Faqat ikonkali tugmada `aria-label` majburiy; ikonka `aria-hidden`.
- Har grafikning jadval ko'rinishi bor; holat faqat rang bilan berilmaydi.

## 10. Ikonkalar

Faqat `lucide-react`, chiziq 2, `currentColor`. Bitta ma'no = bitta ikonka: kanonik ro'yxat va eski
sinonimlarning o'rnini bosuvchilari — `design/icon-registry.json` (132 ikonka, 12 guruh). Boshqa ikonka kutubxonasi
(`@ant-design/icons`, `react-icons` …) importini ESLint `design-v2/ui-imports` (muharrirda darhol) va design-guard
`icons` qoidasi ushlaydi (§12).

## 11. Bosqichlar va PR qoidasi

| Bosqich | Nima | Asosiy fayllar | Holat |
|---|---|---|---|
| 0 | tokenlar, kunduzgi/tungi mavzu, Manrope, valyuta i18n, `design/` maketlari, dizayn qo'riqchisi (ratchet) | `src/index.css`, `src/shared/config/themeTokens.ts`, `design/`, `scripts/design-guard.mjs` | tayyor |
| 1 | primitivlar, formatlovchilar, namuna sahifasi `/ops/ui-kit` | `src/shared/ui/primitives`, `src/entities/order`, `src/shared/lib/format*.ts` | tayyor |
| 2 | shell: kanvas, yon / pastki menyu, yuqori panel | `src/widgets/layout`, `src/widgets/Sidebar`, `src/widgets/header` | tayyor |
| 3 | forma, dialog, xabar, holatlar, xato sahifalari | `src/shared/ui/primitives`, `src/app/providers/UiHost.tsx`, `src/shared/lib/notify.ts` | tayyor |
| 4 | sahifalar migratsiyasi (har sahifa alohida PR, `// dizayn-v2:`) | `src/pages/**`, `src/widgets/**`; jurnal — Ilova A, route bo'yicha — `design/SCREENS.md` | tayyor: 76 / 77 route v2 (G1, G2, G3; `/scan` — skaner 1-bosqichi, 2026-10-19); qolgan `/market-operators` — yopiq |
| 5 | qo'riqchilar: ESLint `design-v2/*` + `Pressable`, `V2_SCOPES` + `named-colour`, vizual snapshotlar (CI «Visual») | `eslint.config.js`, `scripts/eslint-design-v2.mjs`, `scripts/design-guard.mjs`, `playwright.visual.config.ts`, `tests/visual/`, `.github/workflows/visual.yml` | tayyor (§12; qolgan ish — §14) |

Palitra testi va ratchet qo'riqchisi 0-bosqichdan beri ishlaydi: eski kodga tegmaydi, lekin yangi buzilish qo'shilsa
CI qizil bo'ladi. Barcha qo'riqchilar — §12 (dizayn qo'riqchisi, ratchet — §12.3), yangi sahifa tartibi va PR
qoidasi — §13.

**1-bosqich — tayyor.** Hammasi maketga (`design/kit/helmet.html`, `tizim-*` taxtalari) o'lchab moslangan, ikkala
mavzuda AA, telefonda bosish maydoni ≥ 44px. Qaysi maket bloki qaysi primitivga mos — `design/CODE-MAP.md`.

- **Primitivlar** — `src/shared/ui/primitives` (barrel, faqat nomli eksport): `Button` (+ `buttonClasses` havola
  uchun), `IconButton`, `Spinner`, `Badge`, `StatusBadge`, `Card`, `StatCard`, `PageHeader`, `Tabs` (+ `getTabId` /
  `getPanelId`), `SegmentedControl`; ton klasslari `tone.ts` (`TONE_SOFT`, `TONE_FG`, `TONE_SOLID`, `TONE_RING`, §8).
- **Buyurtma holati** — `OrderStatusBadge` va `ORDER_STATUS_REGISTRY` (`src/entities/order`): backend'ning har
  holati uchun ton, ikonka va yorliq (`status` nomlar fazosi, uz/ru/en); noma'lum holat yiqitmaydi.
- **Formatlovchilar** — `formatDateTimeLocalized` / `formatDateLocalized` / `formatTimeLocalized`
  (`src/shared/lib/formatDateTime.ts`), `formatPhone` / `toTelHref` (`formatPhone.ts`), `formatSignedMoneyLocalized`
  (`formatMoney.ts`), klass birlashtirish `cx` (`cx.ts`).
- **Namuna sahifasi** — `/ops/ui-kit` (faqat superadmin, menyuda yo'q): har primitiv kunduzgi va tungi mavzuda
  yonma-yon; `?section=<id>` bitta bo'lim. Ilovani akkauntsiz ko'rish: `npm run app:shot -- <route>`
  (`design/README.md`).
- **v1 o'rnini bosuvchilar** (v1 modullari 5-bosqich B da o'chirildi; importi qaytsa — qo'riqchining `v1-helper`
  qoidasi): `shared/components/button` → `Button`, `shared/ui/StatusBadge` va `pages/orders/list/OrderStatusBadge` →
  `StatusBadge` / `OrderStatusBadge`, `shared/config/statusColorMap` → `statusRegistry` + `tone.ts`,
  `shared/lib/formatDate` → `formatDateTimeLocalized`.

**2-bosqich — tayyor (shell).** Fayllar `// dizayn-v2: shell` belgili, qo'riqchida 0; klasslar `design/CODE-MAP.md` §2.10.

- **Kanvas** — `widgets/layout/dashboardLayout.tsx`: bitta `bg` kanvas, yagona skroll `<main>`, kontent sloti
  `[data-shell-slot=content]` (karta emas, `max-w-[1440px]`, chekkalar §6). Skaner `widgets/layout/scanLayout.tsx`.
- **Navigatsiya** — `widgets/Sidebar`: yon menyu 248 / yig'ilgan 72 (guruhlar Ish · Moliya · Ma'lumotnoma · Tizim,
  holati server sozlamasida), planshetda surma menyu, telefonda pastki varaqa (`MobileMenu`), pastki menyu
  (`BottomNav`, `roles.json` → `bottomNav`). Bandlar, ruxsat va **ikonkalar** yagona manbadan — `menuConfig.tsx`
  (kanonik, `design/icon-registry.json`); ko'rinish (guruh, qisqa yorliq) `model/navSections.ts`.
- **Yuqori panel** — `widgets/header`: global qidiruv (Ctrl K; < 1024 qidiruv ekrani), «Skanerlash»,
  qo'ng'iroqcha (so'nggi 5 bildirishnoma), profil menyusi (Profil, Sozlamalar, Tezkor tugmalar, Mavzu, Til,
  «Chiqish»). Ikonka tugmalar bir o'lchamda (40, telefonda 44).
- **Holat** — bo'lim almashsa skroll tepaga (`model/useShellScroll.ts`), bo'lim yuklanish chizig'i
  (`ui/RouteProgress.tsx` + `shared/lib/navigationPending.ts`).
- **Tokenlar** — `nav-*`, `on-nav`, `avatar`, `on-avatar` (§2).

**3-bosqich — tayyor (forma, dialog, holatlar).** Hammasi `src/shared/ui/primitives` barrelidan; namunasi
`/ops/ui-kit?section=forms|select|date|dialog|feedback|states`; klass retseptlari `design/CODE-MAP.md`.

- **Forma** — `Field` (yorliq, majburiy belgisi, izoh, xato; `useFieldControl` bilan `aria-*` bog'lanadi),
  `TextInput` (`mode`: matn, qidiruv, telefon, son, pul; `multiline`), `Select` (WAI-ARIA combobox + listbox:
  qidiruvli, ko'p tanlovli, guruhlar, yuklanish; **filtrda** bo'sh maydon — «Barchasi», qiymat tanlangach maydonda ×
  «Tozalash» — ega qarori 2026-10-16, CODE-MAP `.el-select`), `DateRange` (tez tanlov + ikki oy, telefonda varaqa), `DateInput`,
  `Calendar` (grid). Overlay infratuzilmasi — `overlay/` (`Portal`, `usePopover`, `useFocusTrap`, `useDismiss`,
  `useScrollLock`, `inertOthers`). Telefonda popover pastki menyu ostiga tushmaydi (`:root` →
  `--shell-bottom-inset`, `BottomNav` yozadi); modal varaqa esa uni ataylab yopadi. Eski sahifaning `document`
  «tashqariga bosish» tinglovchisi `isInUiLayer(event.target)` bo'lsa — panelni yopmaydi.
- **Oyna** — `Dialog` (fokus tuzog'i va qaytishi, Esc, fon, `inert` + skroll qulfi; < 768 px pastki varaqa —
  tutqichni pastga tortib ham yopiladi; ichidagi ro'yxat ochiq turganda Esc va fonga bosish faqat ro'yxatni yopadi),
  `ConfirmDialog` + `useConfirm()` / `confirm()` (va'da: yuklanish va xato oyna ichida).
- **Xabar** — `notify()` + `Toaster` (`role="status"` / `role="alert"` e'lon hududlari, ko'pi bilan 3 ta).
- **Holatlar** — `EmptyState`, `ErrorState`, `Skeleton` + presetlar, `QueryBoundary`, `useLoadingPhase`.
- **Xato sahifalari** (`tizim-errors` 01, `// dizayn-v2: tizim-errors`) — 404 `NotFound`, 403 `Forbidden`, 500
  `ServerError`, ilova xatosi `ErrorBoundaryPage`: `EmptyState`/`ErrorState` `size="page"` + «Xato kodi …», asosiy
  tugma muammoni hal qiladi, ikkinchisi — chiqish yo'li; ramka `shared/ui/error-page/ErrorPageFrame.tsx`. Kirgan
  foydalanuvchiga shell ichida (yon menyu va yuqori panel joyida); kirmagan foydalanuvchi yoki shell'ning o'zi
  yiqilganda — butun ekran (`standalone`, `routes.tsx` → `STANDALONE_ERROR_PAGES`).
- **Global qatlam** — `app/providers/UiHost.tsx` (`ConfirmHost` + `Toaster`), ilova provayderida bir marta.
- **v1 o'ramlari** — eski import yo'llari va API saqlangan, ichi v2: `FilterSelect`, `PopupSelect`, `PrintModeSelect`,
  `Popup`, `FormPopup`, `PageLoader`. Iste'molchisiz qolganlari o'chirildi: `shared/ui/Select.tsx`,
  `features/Select/selectInput.tsx`, `StatusSelect/` (3-bosqich), `QuickDateRangeFilter` (G1), `ConfirmButton` (G2);
  5-bosqich B da — `SearchableSelect`, `FilterMultiSelect`, `CustomDatePicker`, `DateRangePicker`, `FilterDateRange`,
  `FilterDateInput`, `PopupConfirm`, `UpdatePopup`, `EmptyState`, `QueryErrorState`, `TableSkeleton`, `Loader`,
  `PhoneInput`, `FilterSearch`, `SearchInput`, `GlobalSearchInput`, `FilterClearButton`, `PageStatBadge`, `Timeline`
  (yangi kodda — to'g'ridan-to'g'ri primitivlar).
- **Migratsiya** — antd `message`/`notification` (va `NotificationProvider` ichidagi antd `notification`) →
  `notify`; `Popconfirm` va `window.confirm` → `useConfirm()`; §8 dagi pul/kirish amallariga tasdiq qo'shildi.
- **ESLint** (`eslint.config.js`) — antd `message` / `notification` / `Popconfirm` importi, `<Popconfirm>`,
  `Modal.confirm|info|success|error|warning`, `Modal.useModal`, `App.useApp`, `window.confirm|alert|prompt` va global
  `confirm`/`alert`/`prompt` — xato.

**4-bosqich — tayyor (sahifalar).** Har sahifa alohida PR, faylning birinchi qatorida `// dizayn-v2: <ekran>`.
77 route'dan 76 tasi v2 (`design/SCREENS.md`); `/scan` skaner 1-bosqichida ko'chirildi (2026-10-19), qolgani — yopiq
`/market-operators` (ko'chirilmaydi). Oqimlardagi kamera rejimlari (`*-camera`) — skaner 2-bosqichida kontekstli
markaziy tugma orqali qilindi, v1 `ScannerCameraModal` o'chirildi (§14); universal rejimlar — 3-bosqich,
Sozlamalar → Skaner → «Kamera» — 4-bosqich (kamera ishi yopildi).

- **Ro'yxat standarti** — `DataTable` (ustunlar, `density`, server saralashi, tanlov, telefonda `renderCard` →
  kartalar) + `Pagination` (`Card footer`, «10 ta» tanlovi, 5 o'rinli sahifalar), `src/shared/ui/primitives` barrelidan;
  namunasi `/ops/ui-kit?section=table`, klasslar `design/CODE-MAP.md` §2.6. v1 `shared/components/Table` va
  `shared/components/pagination` 5-bosqich B da o'chirildi.
- **Ko'chirilgan sahifalar** (har guruh: route'lar, kartalar, oynalar, ega qarorlari, chiqarilgan v1) — **Ilova A**;
  route bo'yicha joriy holat (`v2` / `eski` / `qisman`) — `design/SCREENS.md` (generatsiya qilinadi, haqiqat manbai).

**5-bosqich — tayyor (qo'riqchilar).** Ikki bosqichda kiritildi: A — G2/G3 qurilayotganda ularning yo'llarida ESLint
`design-v2/*` `warn` edi; B (G2 va G3 birlashtirilgach) — hamma joyda `error`, G2/G3 papkalari `V2_SCOPES` da, 23
vizual sahna. Qoidalar, istisnolar va oqimlar — §12, sonlar va qolgan ish — §14.

## 12. Qo'riqchilar

Dizayn v2 qoidalari kodda bir necha darvoza bilan ushlanadi. **Bitta tashvish — bitta dvigatel:** JSX va import
taqiqlari — ESLint, rang va tokenlar — `scripts/design-guard.mjs`, piksellar — Playwright vizual loyihasi (yagona
ataylab takror: ikonka importi — ESLint muharrirda darhol ko'rsatadi, design-guard `icons` ham sanaydi). **Har
istisno — aniq, sababli va faqat qisqaradigan ro'yxat**, uni test tekshiradi: eskirgan yozuv testni yiqitadi,
ro'yxatni o'stirish — testdagi `MAX_*` sonini o'zgartirish (review'da ko'rinadi). Bitta qator istisnosi —
ESLint'da `-- <sabab>`, design-guard'da `design-guard-ignore: <sabab>`.

### 12.1 Umumiy jadval

| Qo'riqchi | Nimani ushlaydi | Qayerda yuradi | Qanday tuzatiladi | Istisno |
|---|---|---|---|---|
| ESLint `design-v2/raw-control` (§12.2) | xom `<button>`, `<select>`, `<textarea>`, matn `<input>`, `<dialog>`, `role="button"`, `bg-action` / `bg-success` / `bg-danger` li `<a>` / `<Link>` / `<NavLink>` | muharrir, `npm run lint` (CI 1-qadam) | `Button` / `IconButton`, `Pressable`, `Select`, `TextInput`, `DateInput`, `Dialog`, `buttonClasses` | `// eslint-disable-next-line design-v2/raw-control -- <sabab>`; v1 fayl — `RAW_CONTROL_RATCHET` |
| ESLint `design-v2/ui-imports` (§12.2) | antd'dan `ConfigProvider`, `theme`, `QRCode` dan boshqa har nom (`import type` ham), antd chuqur importi (`antd/locale/*` dan tashqari), boshqa ikonka kutubxonalari | muharrir, `npm run lint` | primitiv (§12.2), `lucide-react` | `-- <sabab>` bilan disable; `UI_IMPORT_RATCHET` |
| ESLint `jsx-a11y/anchor-is-valid` | `href` siz, `href="#"` yoki `javascript:` li `<a>` | muharrir, `npm run lint` | `Link to`; amal — `Button` | `-- <sabab>` bilan disable |
| ESLint, 3-bosqich (`no-restricted-imports` / `no-restricted-syntax`) | antd `message` / `notification` / `Popconfirm`, `Modal.confirm…`, `Modal.useModal`, `App.useApp`, brauzer `confirm` / `alert` / `prompt` | muharrir, `npm run lint` | `notify`, `useConfirm()`, `Dialog` | sababli disable |
| Dizayn qo'riqchisi — ratchet (`src/test/designGuard.test.ts`, §12.3) | 12 qoida: hex, Tailwind palitrasi, `dark:` juftlari, eski nomlar, qo'lda pul formati, ikonkalar, 12px dan kichik matn, v1 klass / yordamchi, `font-black`, gradient, nomli rang | `npm test` | §12.3 jadvali | `// design-guard-ignore: <sabab>`; baseline faqat kamayadi |
| Dizayn qo'riqchisi — PR diff (§12.6) | PR'da **qo'shilgan** qatorlardagi yangi buzilish (o'sha 12 qoida) | CI, faqat PR (`deploy.yml`) | §12.3 | `design-guard-ignore: <sabab>` |
| Palitra (`src/test/paletteGuard.test.ts`, §12.4) | `V2_SCOPES` papkalaridagi har fayl rangda 0; unutilgan toza papka; `src` dagi CSS fayllari; eski brend ranglari | `npm test` | tokenlar; papka — `V2_SCOPES` ga | `V2_SCOPE_PENDING`, `OUTPUT_FORMAT_FILES` (sabab bilan) |
| ESLint ratchet (`src/test/lintRatchet.test.ts`, §12.2) | ratchet ro'yxatlari faqat qisqaradi; `design-v2` disable izohida sabab; `STAGE_A_PENDING` bo'sh | `npm test` | ro'yxatdan olib tashlash | — |
| Vizual snapshotlar (CI «Visual», §12.5) | piksel farqi: sahnalar × kunduzgi/tungi × 1440/390 | GitHub Actions: PR + «Run workflow» | kodni tuzatish yoki «Run workflow (update)» | sahna `maxDiffPixels` faqat sabab bilan; beqaror — `test.fixme` + issue |
| `src/test/visualCiVersion.test.ts` (§12.5) | CI Docker obrazi tegi = o'rnatilgan Playwright; aniq pin; lock; workflow qoidalari | `npm test` | bitta PR'da package.json + lock + obraz + baseline'lar | — |
| Tokenlar, shrift, menyu | `themeTokens.test.ts` (`index.css` ↔ `themeTokens.ts`, kontrast), `inputFontGuard.test.ts` (telefonda maydon 16px), `design/tools/screens.test.mjs` (route ↔ maket, menyu) | `npm test` | `AGENTS.md` «Dizayn qo'riqchisi (CI)» | — |

### 12.2 ESLint: xom boshqaruv elementlari, antd va ikonkalar

Ikki qoida — core `no-restricted-syntax` va `no-restricted-imports` ning alohida nomli nusxasi (plagin `design-v2`,
`eslint.config.js`): darajasi, fayl istisnosi va `eslint-disable` izohi 3-bosqich selektorlaridan alohida.
Ma'lumot (selektorlar, ruxsat ro'yxatlari, ratchet) — `scripts/eslint-design-v2.mjs`. Qamrov —
`src/**/*.{ts,tsx}`; faqat JSX tugunlari (chop etish HTML satridagi `<button` sanalmaydi).

| Element / import | Qaror | O'rniga |
|---|---|---|
| `<button>` | taqiq (dizayn tizimi qatlamidan tashqarida) | amal — `Button` / `IconButton`; bosiladigan yuza — `Pressable` (quyida) |
| `<select>` | taqiq | `Select` (filtrda bo'sh — «Barchasi», qiymat bilan × — CODE-MAP `.el-select`) |
| `<textarea>` | taqiq | `<Field><TextInput multiline /></Field>` |
| `<input>` — `type` siz, matn turi yoki dinamik `type={…}` | taqiq | `<Field><TextInput mode="phone" \| "search" \| "money" … /></Field>`, `DateInput` |
| `<input type="checkbox">` / `type="radio"` | **ruxsat** (`type` satr ko'rinishida) | CODE-MAP `.el-check` / `.el-radio` (`size-[18px] accent-action`); jadvalda — `DataTable selection` |
| `<input type="file">` / `type="hidden"` | ruxsat | yuklash maydonlari ichida |
| `<dialog>` | taqiq | `Dialog` / `ConfirmDialog` / `useConfirm()` |
| `role="button"` (har qanday elementda) | taqiq | haqiqiy tugma — `Button` yoki `Pressable` |
| `<a>` / `<Link>` / `<NavLink>` + `className` da `bg-action` / `bg-success` / `bg-danger` | taqiq | `<Link className={buttonClasses({ variant })}>` |
| antd | faqat `ConfigProvider`, `theme` (provayder) va `QRCode` (`MarketQrDialog`); boshqa har nom, `import type` ham, `antd/*` (`antd/locale/*` dan tashqari) — taqiq | `Button` / `IconButton`, `Dialog` / `ConfirmDialog`, `Select`, `TextInput`, `DateInput` / `DateRange`, `DataTable` + `Pagination`, `Badge` / `StatusBadge`, `Card`, `Tabs` / `SegmentedControl`, `Spinner`, `EmptyState` / `ErrorState` / `Skeleton`, `StatCard`; `Alert` → CODE-MAP `.el-alert`; `Tooltip` → `title` / `aria-describedby`; `Switch` → `.el-switch` + `Pressable` |
| `@ant-design/icons` va boshqa ikonka kutubxonalari (20 kutubxona, 25 import shabloni; design-guard `ICON_LIBS` bilan bir ro'yxat) | taqiq (butun `src`) | `lucide-react` (`design/icon-registry.json`) |
| `<table>`, `<progress>`, `<meter>`, `<label>` | tegilmaydi | grafikning «Jadval» egizagi — oddiy `<table>` |

**`Button`, `IconButton` yoki `Pressable`?**

- **`Button` / `IconButton`** — amal: maketdagi `.el-btn` (fon + radius + balandlik) — «Saqlash», «Sotish»,
  «Excelga yuklash», ikonka tugma. Havola tugma ko'rinishida — `buttonClasses({ variant })`.
- **`Pressable`** (`src/shared/ui/primitives/Pressable.tsx`) — amal tugmasi ko'rinishida bo'lmagan bosiladigan
  yuza: karta va telefon qator-kartasi, chip (`aria-pressed`), chip «×», menyu bandi (`role="menuitem"`), kalit
  (`role="switch"`, `.el-switch`), ochib-yopish sarlavhasi (`aria-expanded`), matn ichidagi bosiladigan so'z
  (`hover:underline`; maketda `.el-btn-link` bo'lsa — `Button variant="link"`, §12.7). U uslubsiz
  `<button type="button">`: o'zi klass qo'shmaydi (DOM aynan `<button type="button" …>`), `type="submit"` berish
  mumkin, `ref` — oddiy prop (React 19). Ko'rinishni chaqiruvchi CODE-MAP retsepti bilan beradi
  (`.el-chip`, `.el-chip-x`, `.el-switch`, `.el-menu-item`, `.el-tile`). Fokus halqasi — global `:focus-visible`.
  `Pressable` ga `.el-btn` ko'rinishi berilmaydi — bu `Button`. `/ops/ui-kit` da bo'limi yo'q (ko'rsatadigan
  ko'rinishi yo'q).

**Doimiy ruxsat etilgan joylar** (yo'l bo'yicha, `DS_LAYER` / `TEST_FILES`): `src/shared/ui/**` (primitivlar va v1
o'ramlari — ichi v2) va 2-bosqich shell (`src/widgets/layout/**`, `src/widgets/Sidebar/**`, `src/widgets/header/**`)
— `raw-control` o'chiq; testlar (`src/**/*.test.{ts,tsx}`, `__tests__`, `src/test/**`) — ikkala qoida o'chiq.
`tests/`, `scripts/`, `design/` — qamrovdan tashqari.

**Ratchet (faqat qisqaradi).** `RAW_CONTROL_RATCHET` — xom element hali qolgan v1 fayllar, kalit — fayl, qiymat —
sabab (`scripts/eslint-design-v2.mjs`, hozir 3 ta, `MAX_RAW = 3`; kamera ishi chiqdi — `src/pages/scan/index.tsx`
skaner 1-bosqichida v2 ga o'tdi, v1 `src/shared/components/ScannerCameraModal.tsx` 2-bosqichida o'chirildi):

- yopiq `/market-operators` (`src/pages/market-operators/index.tsx`, ko'chirilmaydi) va yetib bo'lmaydigan
  `src/pages/payments/components/SalaryPaymentPopup.tsx` («Maosh to'lash» yashirin);
- v1 o'rami `src/shared/components/PrintModeSelect.tsx` (ichi v2, menyu bandlari; `shared/ui` ga ko'chirilguncha).

Bosqich B integratsiyasida iste'molchisi qolmagan (o'lik) v1 fayllar — `UserInfoCards.tsx`,
`shared/components/button.tsx`, `shared/components/Table/` (+ `CustomerOrdersTable`), `shared/components/pagination`
— o'chirildi, ularning yozuvlari bilan birga (`MAX_RAW` 9 → 5).

`UI_IMPORT_RATCHET` — bo'sh (`MAX_UI = 0`; yagona yozuv `ConfirmButton` G2 da o'chirildi): `src` da antd'dan faqat
`ConfigProvider`, `theme`, `QRCode`, boshqa ikonka kutubxonasi yo'q. `src/test/lintRatchet.test.ts`: fayl bor,
`// dizayn-v2:` belgisiz, sababi yozilgan; fayl tozalansa — «ro'yxatdan olib tashlang»; o'lcham `≤ MAX_RAW` /
`≤ MAX_UI` («faqat kamaytiring»; o'stirish — `MAX_*` ni o'zgartirish, review'da ko'rinadi). ESLint testda yurmaydi (tez).

**Bitta qator istisnosi** — `// eslint-disable-next-line design-v2/raw-control -- <sabab>` (JSX ichida
`{/* … */}`), sabab ≥ 10 belgi (test tekshiradi). `reportUnusedDisableDirectives: "error"` — keraksiz bo'lib qolgan
disable izohi ham xato. Hozir bitta (bekorlardagi telefon «Kamera» tugmasining istisnosi skaner 2-bosqichida tugma
bilan birga olindi — kamera markaziy «Skaner» orqali):

- `src/pages/notifications/ui/CampaignPage.tsx` dagi matn prefiksli maydon — `TextInput` da prefiks sloti yo'q, quti
  `TextInput` klasslarida; slot qo'shilganda `TextInput` ga o'tadi (follow-up).

**Bosqich B (joriy).** `STAGE_A_PENDING = []` — `design-v2/*` butun `src` da xato (yuqoridagi doimiy joylardan
tashqari); `lintRatchet.test.ts` ro'yxat bo'sh bo'lishini talab qiladi. Bosqich A da G2/G3 qurilayotgan yo'llarda
`warn` edi; ularning v2 fayllarida qolgan 24 ta xom element `Pressable` (kalit, chip, chip «×», matn-havola, menyu
bandi, `role="button"` li karta) yoki `Button` (amal tugmasi ko'rinishidagilar) ga o'tdi, bittasi — yuqoridagi
`CampaignPage` istisnosi. Yangi qurilayotgan yo'l uchun ham `warn` qaytarilmaydi: `Pressable` / primitiv, sababli
bitta qator istisnosi yoki (v1 fayl) ratchet.
`npm run lint` (`eslint . --quiet`) faqat xatolarni ko'rsatadi; ogohlantirishlar (`no-explicit-any` …) —
`npm run lint:report`.

`jsx-a11y/anchor-is-valid` faqat xom `<a>` ni tekshiradi: `components: ["Link"]` qo'yilmagan — lucide-react `Link`
ikonkasi ham `<Link>` (soxta xato), react-router `Link` / `NavLink` da esa `to` TypeScript'da majburiy.

### 12.3 Dizayn qo'riqchisi (ratchet)

`src/test/designGuard.test.ts` (CI'da har PR'da `npm test`) va `npm run design:guard` bitta dvigateldan
foydalanadi: `scripts/design-guard.mjs`. U `src/**/*.{ts,tsx}` ni skanerlaydi (testlar, `src/test`, `src/locales`
kirmaydi). Izohlar hisobga olinmaydi.

| Qoida | Nimani sanaydi | O'rniga |
|---|---|---|
| `colour` | hex, `rgb()`/`rgba()`/`hsl()`: className, `bg-[#fff]`, `shadow-[…rgba()]`, style, JS (`themeTokens.ts` dan tashqari) | tokenlar; JS'da `themeTokens.ts` |
| `palette` | `bg-blue-500`, `text-gray-400`, `border-red-200/50`, `bg-white`, `text-white`, `bg-black/65` …; palitra CSS o'zgaruvchisi `var(--color-blue-500)`, `bg-(--color-gray-400)` va dinamik oila `bg-${c}-500` | `bg-surface`, `text-text-muted`, `bg-action text-on-solid`, `bg-*-soft text-*-fg`, `bg-overlay` |
| `dark-pair` | `dark:` rang jufti: `dark:bg-slate-800`, `dark:text-white`, `dark:hover:border-…` (`dark:text-sm` kabi o'lcham sanalmaydi) | hech narsa: tokenlar mavzuga o'zi moslashadi |
| `legacy` | `main`, `maindark`, `primary`, `primarydark`, `purple*`, `border-soft`, `card-surface`, `page-surface`, `background(-soft/-deep)`, `dashboard-*`, `table-*`, `glass*`, `warning-start/end/surface/border/text`, `sidebar`, `error`, `surface-elevated`, `surface-dark`, `text-muted-dark` (utilita yoki `--color-*`) | §2 jadvali |
| `money` | `Intl.NumberFormat`, sonning `.toLocaleString()`, qo'lda `so'm` / `сум` / `UZS` (`formatMoney.ts` dan tashqari) | §7 formatlovchilari |
| `icons` | `@ant-design/icons` va boshqa ikonka kutubxonalari | `lucide-react` (§10) |
| `tiny-text` | 12px dan kichik: `text-[10px]`, `text-[11px]`, `fontSize: 10` … | `text-xs` |
| `v1-class` | `index.css` dagi eski `el-card`, `el-card-soft`, `el-glass-control`, `el-segmented*`, `el-surface-page`, `el-muted-text`, `el-soft-text` | `design/CODE-MAP.md` retsepti / primitiv |
| `weight` | `font-black`, `font-extrabold`, `fontWeight: 800/900` | `font-bold` |
| `gradient` | `bg-linear-*`, `bg-gradient-*`, `bg-radial*`, `bg-conic*`, `linear-gradient(…)` | tekis token fon |
| `v1-helper` | `TYPO.*`, `TEXT.*`, `TONE[…]`, `toneAccent()`, `toneSoftBg()`, `formatPercent()`; `headerName` / `MetricCard` importi; 1-bosqich almashtirgan v1 modullari importi — yo'l fayl joyiga nisbatan aniq hal qilinadi (`./button`, `../../shared/ui/StatusBadge`, `@/shared/lib/formatDate` …) | `PageHeader`, `StatCard`, `Button`, `StatusBadge` / `OrderStatusBadge`, `statusRegistry` + `tone.ts`, `formatDateTimeLocalized`, `formatPercentLocalized` |
| `named-colour` | nomli CSS rangi (`white`, `red`, `navy` … 148 ta; `transparent` / `currentColor` / `inherit` / `none` emas): JSX rang atributi (`stroke="white"`, `color="red"`), style / konfig kaliti (`color: "green"`, `border: "1px solid black"`), ternar / `??` tarmoqlari, satr ichidagi CSS (`color: red;`), `bg-[white]`; `themeTokens.ts` va `OUTPUT_FORMAT_FILES` dan tashqari | SVG — `fill-current` / `stroke-current` + `text-*`; JS — `CHART_PALETTE[theme]`, `themeTokens(theme)`; antd Tag rangi o'rniga `Badge` / `StatusBadge` `tone` |

- **Ratchet.** Har fayl × qoida soni `design/guard-baseline.json` da turadi. Son faqat kamayadi, yangi faylda 0.
  Oshsa, test yiqiladi va qator, ustun hamda v2 o'rnini bosuvchisini ko'rsatadi. Eski kodni darhol qayta yozish
  shart emas, lekin unga yangi buzilish qo'shib bo'lmaydi.
- **Buyruqlar.** `npm run design:guard` (fayllar bo'yicha hisobot) · `-- --changed` (faqat farqlar) · `-- <fayl>`
  (har buzilish va maslahat) · `-- --update` (kamayishni qotiradi, yo'q faylni o'chiradi, oshishni **rad etadi**).
- **Sahifani tozalagach** `npm run design:guard -- --update` bilan yangi sonni qotiring. Aks holda keyingi PR o'sha
  joyga eski uslubni qaytara oladi.
- **Oshirish** faqat asosli holatda va ega roziligi bilan (masalan, fayl ko'chirildi yoki bo'lindi):
  `npm run design:guard -- --update --allow-increase "<sabab>"`. Sabab baseline'ning `increases` ro'yxatiga
  yoziladi va PR review'da ko'rinadi. Baseline qo'lda tahrirlanmaydi.
- **v2 ga ko'chirilgan fayl** (birinchi qatorda `// dizayn-v2: <ekran>`) uchun baseline qo'llanmaydi: har qoida
  bo'yicha ruxsat 0, `--allow-increase` ham yordam bermaydi.
- **Migratsiya qilingan papka** (`V2_SCOPES`, §12.4): ichidagi har fayl — belgisiz ham — rang qoidalarida
  (`COLOUR_RULES`) ruxsat 0; istisno — `V2_SCOPE_PENDING` (sabab bilan, faqat qisqaradi) va `OUTPUT_FORMAT_FILES`
  (chop etish / Excel).
- **Bitta qator istisnosi:** shu yoki oldingi qatorda `// design-guard-ignore: <sabab>` (JSX'da
  `{/* design-guard-ignore: <sabab> */}`). Sabab majburiy, sababsiz belgi testni yiqitadi.
- Baseline'da bor, lekin o'chirilgan fayl faqat ogohlantirish beradi; `--update` uni olib tashlaydi.

### 12.4 Palitra: migratsiya qilingan papkalar (`V2_SCOPES`)

Ratchet eski faylga yangi buzilish qo'shishni to'xtatadi, lekin v1 sonini almashtirishni emas. Shuning uchun to'liq
ko'chirilgan slice'larda **har fayl** — `// dizayn-v2:` belgisiz `.ts` yordamchi ham — rang qoidalarida (`COLOUR_RULES`:
`colour`, `palette`, `dark-pair`, `legacy`, `gradient`, `named-colour`) ruxsat 0; boshqa qoidalar (`money`,
`tiny-text`, `weight`, `v1-helper` …) baseline bo'yicha qoladi. Ro'yxatlar — `scripts/design-guard.mjs`:

- `V2_SCOPES` — 82 papka (`src/<qatlam>/<slice>`, qatlamdan tashqari yagona — `src/auth`; `src/shared/ui`
  butunligicha emas — `primitives`, `charts`, `error-page`, `camera`; yopiq `src/pages/market-operators` yo'q). Scope faylining
  rang soni `--update` da baseline'ga yozilmaydi; buzilish «(V2_SCOPES: rang qoidalarida ruxsat 0)» deb chiqadi.
- `V2_SCOPE_PENDING` — scope ichida hali v1 qolgan fayllar (sabab bilan, `≤ MAX_PENDING`): baseline ruxsati saqlanadi.
  Hozir 1 ta: `SalaryPaymentPopup.tsx` (yetib bo'lmaydigan; `pages/scan/index.tsx` skaner 1-bosqichida chiqdi); v1
  `entities/orders/ui/ExtraCostApproval.tsx` iste'molchisiz qolib o'chirildi.
- `OUTPUT_FORMAT_FILES` — ilova mavzusidan tashqari chiqish formatlari (chop etish HTML'i, termal yorliq / PDF, Excel
  ARGB): rang qoidalari qo'llanmaydi (oq qog'ozdagi qora matn to'g'ri). Faqat `/lib/` dagi `print|export|pdf|label`
  fayllari.

`src/test/paletteGuard.test.ts` («migratsiya qilingan papkalar»): (1) har scope papkasi bor va ichida qo'riqlanadigan
fayl bor; (2) har scope fayli rangda 0 — xatoda `fayl:qator:ustun [qoida] … → o'rnini bosuvchi`; (3) **avtomatik
qattiqlashtirish** — ≥ 1 ta `// dizayn-v2:` fayli bor va rangda toza slice `V2_SCOPES` da bo'lishi shart
(«integrator: papkani V2_SCOPES ga qo'shing»; istisnosiz — G2/G3 papkalari ham); (4)
`V2_SCOPE_PENDING` faqat qisqaradi (fayl bor, scope ichida, hali rang bor, sabab ≥ 10 belgi, `≤ MAX_PENDING = 2`); (5)
`OUTPUT_FORMAT_FILES` faqat `/lib/` dagi chiqish fayllari; (6) `src` dagi stil fayllari — faqat `src/index.css` (v2 CSS
modul / SCSS yozmaydi; v1 `Table.module.css` `Table` bilan o'chirildi).
Eski brend ranglari tekshiruvlari (`index.css`, `AntdThemeProvider.tsx`, `var(--color-maindark)`) o'zgarmagan.

### 12.5 Vizual snapshotlar (CI «Visual»)

**Matritsa:** 4 loyiha — `desktop-light`, `desktop-dark` (1440 × 900), `phone-light`, `phone-dark` (390 × 844,
`isMobile`, `hasTouch`), DPR 1. Planshet 768 va ru/en matritsada yo'q (`app:shot` va e2e qoplaydi). **23 sahna × 4
= 92 snapshot.** Rollar: superadmin 8, admin 3, menejer 3, registrator 3, kuryer 3, market 2, mehmon 1.

| id | rol (filial turi) | route | maket | fayl |
|---|---|---|---|---|
| `dashboard` | superadmin | `/` | `superadmin-dashboard-main`, `tizim-charts` | `home.visual.ts` |
| `market-home` | market | `/` | `market-dashboard-home`, `market-dashboard-extra-cost-approvals` | `home.visual.ts` |
| `branch-dashboard` | manager (HYBRID) | `/branch-dashboard` | `manager-branch-dashboard-main` | `home.visual.ts` |
| `orders` | superadmin | `/orders?where_deliver=address` | `superadmin-orders-list` | `orders.visual.ts` |
| `order-sell-dialog` | courier (REGIONAL) | `/orders` → «Sotish» (telefonda pastki varaqa) | `courier-orders-sell-dialog`, `courier-orders-pending` | `orders.visual.ts` |
| `orders-courier` | courier (REGIONAL) | `/orders` | `courier-orders-pending` | `order-pages.visual.ts` |
| `order-detail` | admin | `/orders/edit/96` | `admin-orders-detail` | `order-pages.visual.ts` |
| `order-create` | registrator (HQ) | `/new-orders/create` | `registrator-new-orders-create-step1` | `order-pages.visual.ts` |
| `market-new-orders` | manager (HYBRID) | `/new-orders/7` | `manager-new-orders-market-detail` | `intake.visual.ts` |
| `cancelled-handover` | superadmin | `/new-orders/cancelled/31` | `superadmin-neworders-cancelled-handover` | `intake.visual.ts` |
| `mails-today` | manager (HYBRID) | `/mails/today` | `manager-mails-today` | `mails.visual.ts` |
| `mail-detail` | courier (REGIONAL) | `/mails/78` | `courier-mails-detail-receive` | `mails.visual.ts` |
| `payments` | superadmin | `/payments?cashbox_type=main` | `superadmin-payments-overview` | `finance.visual.ts` |
| `main-cashbox` | admin | `/payments/main-cashbox` | `admin-payments-main-cashbox` | `finance.visual.ts` |
| `cash-box` | market | `/cash-box` | `market-cashbox-my` | `finance.visual.ts` |
| `financial-balance` | superadmin | `/financial-balance` | `superadmin-balance-overview` | `finance.visual.ts` |
| `users` | superadmin | `/all-users` | `superadmin-users-list` | `directory.visual.ts` |
| `regions` | admin | `/regions` | `admin-regions-map` | `directory.visual.ts` |
| `ui-kit` | superadmin | `/ops/ui-kit?section=states` | `tizim-main`, `tizim-errors`, `tizim-loading`, `tizim-charts` | `kit.visual.ts` |
| `login` | mehmon (sessiyasiz) | `/login` — bo'sh forma, shell'siz | `common-login` | `auth.visual.ts` |
| `integrations` | superadmin | `/integrations/connections` — «Hamkorlar», birinchi hamkor tanlangan | `superadmin-integrations-partners-console` | `system.visual.ts` |
| `settings` | registrator (HQ) | `/settings` — «Ko'rinish» | `common-settings-appearance` | `system.visual.ts` |
| `dispatch` | registrator (HQ) | `/dispatch` — USB skaner bilan 3 ta buyurtma (QR bo'yicha qidiruv — soxta API) | `registrator-dispatch-list` | `floor.visual.ts` |

Har sahna aniq ro'yxat va holat (`api`, `act`, `capture`) — sahna faylining o'zida; `maket` hisobotda chiqadi.

**Fayllar:** `playwright.visual.config.ts` (alohida bundle `dist-visual`, `vite preview` :4178), `tests/visual/support/`
(sahna shartnomasi `defineScene`, soxta API, sessiya, shrift, barqarorlik, baseline siyosati `policy.ts`),
`tests/visual/scenes/*.visual.ts` (vitest va e2e konfiguratsiyasiga kirmaydi), `tests/visual/fixtures/<sahna>/*.json`
(faqat **sintetik** ma'lumot; e2e support fayllari import qilinmaydi — nusxa), baseline'lar
`tests/visual/__screenshots__/<loyiha>/<id>.png` (commit qilinadi).

**Determinizm:** API `http://api.visual.test` ga yig'ilgan alohida bundle (`npm run visual:build`, production emas);
tarmoq to'liq yopiq — faqat ilova, soxta API va Google Fonts, qolgani bloklanadi, yozish so'rovi va mock qilinmagan
yo'l hisobotda, yozish — yiqilish; soat muzlatilgan `2026-10-15T10:00:00+05:00`, `Asia/Tashkent`, `uz-UZ`;
`reducedMotion: reduce`, animatsiya va kursor o'chiq (`support/screenshot.css`); Manrope ilovadagidek Google Fonts'dan,
suratdan oldin `document.fonts.load("600 16px Manrope")` bo'sh bo'lmasligi shart; brauzer doim «onlayn»
(`pinOnline`: xost Wi-Fi'si uzilsa ham `navigator.onLine` true, `online`/`offline` hodisalari ilovaga yetmaydi —
aks holda React Query so'rovni to'xtatib «Internet aloqasi yo'q» chizardi); sahifa tayyorligi — bo'lim yuklanish
chizig'i (`[data-route-progress]`) yo'q, «band» shartnomasi (`BUSY_SELECTOR`: `aria-busy`,
`data-query-state="loading"`, har qanday skelet `[data-skeleton]` — `Suspense` zaxirasi ham, `svg` siz recharts
konteyneri) bo'yicha chizilgan element yo'q va oynaga kirgan, lekin ochilmagan `DeferredMount` yo'q; xato holati
(`data-query-state="error"` yoki `ErrorState`, `forbidden` dan tashqari) suratga tushmaydi — yiqilish (sahnada
faqat `allowErrors` sababi bilan); ikkala tekshiruv ham `display: none` ostidagini hisoblamaydi; konsol xatosi va `pageerror` — yiqilish (sahnada faqat sabab bilan
ruxsat). Balandlik: kontent bo'yicha (6000 px gacha) — har o'lchovdan oldin tayyorlik qayta kutiladi, balandlik
ketma-ket ikki o'lchovda o'zgarmaguncha (10 urinish, keyin yiqilish); dialog sahnalari — faqat oyna.

**Baseline faqat CI Docker obrazida.** Shrift va rasterlash mashinadan mashinaga farq qiladi, shuning uchun baseline
faqat `mcr.microsoft.com/playwright:v1.59.1-noble` da yaratiladi va solishtiriladi (= package.json dagi aniq
`@playwright/test` / `playwright` pini; `src/test/visualCiVersion.test.ts` va workflow qadami tekshiradi). Konfiguratsiya
`--update-snapshots` / `-u` ni faqat `VISUAL_IN_DOCKER=1` bilan qabul qiladi, bayroqsiz yugurish baseline yozmaydi.
**Hech kimning kompyuterida Docker yoki vizual yugurish shart emas.**

**Yangilash oqimi** (`.github/workflows/visual.yml`):

0. **Old shart — `visual.yml` `dev` da.** GitHub «Run workflow» tugmasini faqat workflow fayli default branch (`dev`)
   da bo'lsa ko'rsatadi. `visual.yml` ni `dev` ga birinchi marta olib kiradigan PR'da baseline yo'q va «Visual»
   neytral; o'sha PR merge qilingach 2-qadam ishchi branchda (masalan `shodiyor`) bajariladi → keyingi PR solishtiradi.
1. **Baseline yo'q** (birinchi marta yoki yangi sahna): PR'dagi «Visual» yashil (neytral) — sahnalar chiziladi va
   tekshiriladi (tarmoq, konsol, shrift), piksel solishtirilmaydi; Summary'da «baseline yo'q — Run workflow (update)
   bilan yarating».
2. **GitHub → Actions → Visual → Run workflow** → branch (masalan `shodiyor`), «update» ✓ (sukut) → `baselines`
   job barcha PNG'larni obrazda qayta yaratadi, `visual-baselines` artefaktini yuklaydi va
   `tests/visual/__screenshots__/**` ni **shu branchga commit qiladi** («test(visual): baseline'lar yangilandi
   [skip ci]»). Bayt-bayt bir xil PNG commit bo'lmaydi; o'chirilgan yoki qayta nomlangan sahnaning PNG'i ham ketadi;
   biror sahna yiqilsa — commit yo'q. `main` / `dev` ga commit qilinmaydi (faqat artefakt).
3. Lokalda `git pull`. Bot commit'i PR tekshiruvlarini o'zi qayta yurgizmaydi (GitHub `GITHUB_TOKEN` push'ida
   workflow ishga tushirmaydi) — keyingi push (yangi commit) bilan yuriting. `[skip ci]` li bot commit'i PR'ning
   oxirgi commit'i bo'lib qolsa, PR ochilganda ham «Deploy» va «Visual» o'tkazib yuboriladi — PR'ni yangi commit'dan
   keyin oching.
4. **PR'da farq:** job qizil, Summary'da `*-diff.png` ro'yxati; artefaktlar `visual-report` (HTML: expected / actual /
   diff, trace) va `visual-baselines` (faqat yiqilganlari qayta yaratilgan taklif — commit qilinmaydi). Farq
   **kutilgan** bo'lsa — 2-qadam va PR'da diff'ni ko'rsating; kutilmagan bo'lsa — kodni tuzating.

«update» belgisiz Run workflow — PR'dagidek faqat solishtirish (commit yo'q).

Ixtiyoriy yordamchilar: `npm run visual:pull` — artefaktni lokal `__screenshots__` ga ko'chiradi (gh CLI kerak;
gh'siz — Actions sahifasidan yuklangan zip: `npm run visual:pull -- --from <fayl.zip|papka>`); `npm run visual:docker`
— Docker bor mashinada xuddi shu obrazda solishtirish (baseline yaratmaydi).

**Lokal tekshiruv** (kuchsiz kompyuter ham): faqat `VISUAL_DRY=1` — chizish va barcha tekshiruvlar, solishtirish va
yangilashsiz. `npm run visual:build` (bir marta), so'ng
`VISUAL_DRY=1 npx playwright test -c playwright.visual.config.ts --project desktop-light -g orders` →
`test-results-visual/dry/<loyiha>/<id>.png` (Read qiling) + `<id>.json` (mock qilinmagan / bloklangan so'rovlar,
konsol, mavzu, vaqt mintaqasi). Qarorni faqat CI beradi.

**Chegara va beqarorlik:** `maxDiffPixels: 64` + piksel `threshold: 0.2`; `maxDiffPixelRatio` yo'q (1440 × 6000 da
0,1 % ham 8 600 px — o'zgargan so'zni yashiradi). Baseline va tekshiruv bitta obrazda — kutilgan farq 0. Global
qiymat oshirilmaydi; shovqinli grafik sahnasi — sahna `maxDiffPixels` (sabab izohi bilan); baribir beqaror —
`test.fixme` + issue. `retries: 0` (qayta urinish beqarorlikni yashiradi).

**Sahna qachon qo'shiladi yoki o'zgaradi:** yangi rolning bosh ekrani; yangi v2 pattern (ro'yxat, filtr + chiplar,
forma + qadamlar, dialog → telefonda varaqa, tanlov paneli, skaner holati, KPI + grafik); sahna sahifasi qayta
tuzilsa (route, holat, maket). id global va kebab-case (PNG nomi, `defineScene` takrorni rad etadi). Faqat v2
sahifalar; kamera ko'rinishlari yo'q (alohida ish).

**Holati:** «Visual / visual» hozircha maslahat (required emas): baseline'lar yaratilib (0- va 2-qadam), 5 ta ketma-ket
yashil PR yugurishidan so'ng ega GitHub sozlamalarida `dev` uchun required qiladi. Har draft bo'lmagan PR push'ida
yuradi («Deploy» bilan parallel; vaqt bahosi ≈ 7–10 daqiqa, GitHub'da hali o'lchanmagan); `paths` filtri ataylab yo'q
(filtrlangan required tekshiruv PR'ni bloklaydi).

### 12.6 PR diff qadami

CI (faqat PR'da, `deploy.yml`): `npm run design:guard -- --diff origin/<base>` — PR'da **qo'shilgan** qatorlarda yangi
buzilish (12 qoida, `named-colour` ham) bo'lmasin. Eski qatorni tahrirlash yoki kodni ko'chirish o'tadi, lekin bir
joyda `bg-white` ni o'chirib boshqa joyga `text-gray-400` qo'shish o'tmaydi (ratchet buni ko'rmaydi, diff ko'radi).
Lokal: `npm run design:guard -- --diff` (push oldidan, `origin/dev` bilan).

### 12.7 Qo'riqchilar ushlamaydigan narsalar (review)

- rangsiz maxsus soya (`shadow-[0_8px_…]` — rang literalisiz);
- `sm:` ni telefon chegarasi sifatida ishlatish (telefon — `max-md:`, planshet — `max-lg:`);
- bitta ekranda ikkinchi asosiy tugma;
- karta ichida karta (2 qavatdan ko'p);
- `Pressable` ga `.el-btn` ko'rinishi (fon + radius + balandlik) berilgani — bu `Button`;
- matn ko'rinishidagi havola: maketda `.el-btn-link` — `Button variant="link"`, boshqa sahifaga olib borsa —
  `Link` + `buttonClasses({ variant: "link" })`; `Pressable` + `hover:underline` — faqat `.el-btn-link` bo'lmagan matn
  ichidagi bosiladigan so'z (5-bosqichda DOM'i o'zgarmasdan ko'chirilgan «ochish» havolalari shunday);
- ESLint faqat JSX tugunini ko'radi: `createElement("button")` yoki satr ichidagi HTML (chop etish) sanalmaydi;
- vizual sahnasi yo'q sahifalar (§12.5 jadvali) — kunduzgi / tungi / 390px skrinshotlar PR'da;
- PR'da `tests/visual/__screenshots__/**` dagi PNG o'chirilsa (bot commit'idan tashqari), o'sha sahna «baseline yo'q»
  bo'lib neytral o'tadi — PR diff'ida o'chirilgan baseline'ga qarang.

## 13. Yangi sahifa / ekran qo'shish

1. **Maket:** `design/SCREENS.md` / `design/kit/views.json` → `<rol>-<viewId>` (sahifani ko'radigan har rol), dialog va
   holat ekranlari; `npm run design:shot -- <ekran>` va PNG'larni ko'ring (`.claude/skills/elchi-design/SKILL.md`
   §2–3). Maket yo'q — eng yaqini («Maket yo'q — eng yaqini: …»), katta yangi ekran — avval egadan.
2. **Route:** `src/app/lib/routes.tsx` + `design/kit/route-map.json` → `npm run design:screens` (`-- --check`). Menyu
   bandi faqat `design/kit/roles.json` bilan birga.
3. **Faqat primitivlar** (`src/shared/ui/primitives`): `Button` / `IconButton` / `Pressable` (§12.2), `Field` +
   `TextInput` / `Select` / `DateInput` / `DateRange`, `Dialog` / `ConfirmDialog` / `useConfirm()`, `notify()`,
   `DataTable` + `Pagination`, `QueryBoundary`, `PageHeader`, `Card`, `StatCard`, `StatusBadge` / `OrderStatusBadge`;
   klasslar — `design/CODE-MAP.md`, ranglar — tokenlar, pul / sana — §7 formatlovchilari, ikonka — `lucide-react`.
   Sahifa shell ichida (ildiz `flex flex-col gap-6 max-md:gap-4`, §6).
4. **Belgi:** faylning birinchi qatori `// dizayn-v2: <ekran>[, <ekran>]` (maketsiz —
   `// dizayn-v2: (maket yo'q) <eng yaqin ekran>`).
5. **Papka toza bo'lsa** — `V2_SCOPES` ga (§12.4; palitra testi buni talab qiladi — toza v2 papka ro'yxatda bo'lmasa
   `npm test` yiqiladi; ro'yxat `scripts/design-guard.mjs`, integrator yuritadi).
6. **Eski fayldan buzilish kamaygan bo'lsa** — `npm run design:guard -- --update` (faqat kamayish; oshirish taqiqlangan).
7. **Tekshiruvlar:** `npm run lint` · to'liq `npm test` · `npm run design:guard -- --diff` · `npm run build` (+
   tegishli e2e — `npm run test:e2e`).
8. **Vizual sahna** — ekran rolning bosh ekrani yoki yangi pattern bo'lsa (§12.5): `tests/visual/scenes/*.visual.ts` da
   `defineScene` + sintetik fixture, lokalda `VISUAL_DRY=1`, so'ng «Run workflow (update)» (§12.5, `visual.yml` `dev`
   da bo'lgach). Sahna sahifasi ataylab o'zgarsa — xuddi shu yangilash va PR'da diff.
9. **PR:** `.github/pull_request_template.md` (maket, kunduzgi / tungi / 390px skrinshot, «Visual» yashil).

Har PR: faqat tokenlar · `PageHeader` · bitta asosiy amal · `StatusBadge` · formatlovchilar · 2 qavatdan ko'p
karta yo'q · kunduzgi / tungi / 390px skrinshot · to'liq `npm test` + `npm run build` yashil.

## 14. Migratsiya holati

> Yakuniy — o'lchandi 2026-10-18 (asosiy daraxt, G1 + G2 + G3 birlashtirilgan, 5-bosqich B). Route bo'yicha haqiqat
> manbai — `design/SCREENS.md` (generatsiya qilinadi, qo'lda tahrirlanmaydi); sonlar quyidagi manbadan qayta olinadi.

| Ko'rsatkich | Son | Manba |
|---|---|---|
| v2 ga ko'chirilgan route | 76 / 77 (qolgan: `/market-operators` — yopiq; `/scan` skaner 1-bosqichida, 2026-10-19) | `design/SCREENS.md` |
| `// dizayn-v2:` belgili fayllar | 375 / 846 qo'riqlanadigan (skaner 2-bosqichi, 2026-10-19) | `npm run design:guard` |
| `V2_SCOPES` | 83 papka (1-bosqichda `src/widgets/scanner`, `src/shared/ui/camera`; 2-bosqichda `src/features/dispatch-basket` qo'shildi) | `scripts/design-guard.mjs` |
| `V2_SCOPE_PENDING` | 1 (`MAX_PENDING = 1`; `pages/scan/index.tsx` chiqdi) | `scripts/design-guard.mjs` |
| `OUTPUT_FORMAT_FILES` | 4 (`MAX_OUTPUT_FORMAT = 4`) | `scripts/design-guard.mjs` |
| `RAW_CONTROL_RATCHET` / `UI_IMPORT_RATCHET` | 3 / 0 (`MAX_RAW = 3`, `MAX_UI = 0`; `ScannerCameraModal` o'chirildi) | `scripts/eslint-design-v2.mjs` |
| `design-v2` bitta qator istisnolari | 1 (`CampaignPage` prefiksli maydon; bekorlardagi kamera tugmasi olindi) | `src/**` |
| `STAGE_A_PENDING` | 0 (bo'sh bo'lishi shart) | `scripts/eslint-design-v2.mjs` |
| Vizual sahnalar | 23 × 4 = 92 snapshot | `tests/visual/scenes/` |
| Commit qilingan vizual baseline'lar | 0 — §12.5 0- va 2-qadamdan keyin 92 | `tests/visual/__screenshots__/` |

**Qolgan ish:**

- **«Visual» baseline'lari va required** (§12.5): `visual.yml` `dev` ga tushadi (birinchi PR — neytral) → ishchi
  branchda «Run workflow (update)» → 92 PNG commit → ketma-ket ikki yugurishda 0 farq (determinizm) → 5 ta yashil PR
  yugurishidan keyin ega `dev` uchun «Visual / visual» ni required qiladi. Shungacha «Visual» maslahat.
- **Kamera ishi** (Trello v1eLN2tV; ega qarorlari 2026-10-19, qulflangan):
  - **Markaziy tugma kontekstli.** Pastki menyuning «Skaner» tugmasi (planshet/desktop — yuqori paneldagi
    «Skanerlash») sahifa skan maqsadini ro'yxatdan o'tkazgan bo'lsa (`useScanTarget`, `src/shared/lib/scanner/`)
    kamerani SHU sahifa ustida, USB skaner bilan aynan bir xil handler'da ochadi (`widgets/scanner/ScannerHost`);
    aks holda universal `/scan`. **Oqim ichidagi «Kamera bilan skanerlash» tugmasi QILINMAYDI** — maket uni chizgan,
    ega «ma'nosiz» dedi. Kamera ichida kontekstni almashtirish (market tanlash, «Qabul qilindi N · Qoldi M ·
    Topilmadi K») — `ScanTarget.switcher` / `stats`.
  - **1-bosqich — tayyor:** reyestr va `ScannerHost`, v2 `ScannerCamera` (`src/shared/ui/camera/`, `.el-cam*`,
    taxta `tizim-scanner`: telefon to'liq ekran, planshet/desktop oyna + yon panel, ruxsat izohi, rad etilgan —
    platformaga qarab 3 qadam, band / yo'q, oflayn chip, qo'lda kiritish, ro'yxat), `useKeyboardScanner` (Caps Lock,
    lotin bo'lmagan tartib), universal `/scan` v2 («Ma'lumot» rejimi, «Oxirgi skanerlar · Shu qurilmada», qo'lda
    kiritish — token yoki havola), resolver (`POST-` pochta, `MCR-` so'rovsiz, 404 → `GET scan/:token` qop yorlig'i,
    hex kichik harf), `/scan/:token` da qop va market QR natijalari, skaner amalidan keyin kesh yangilanishi,
    `ScanFeedbackOverlay` v2 (kamera ochiqda chiqmaydi). `/scan` `RAW_CONTROL_RATCHET` va `V2_SCOPE_PENDING` dan
    chiqdi. Maketdan farq: qo'lda kiritishdagi raqamli klaviatura / «Harflar» yo'q (buyurtma raqami bo'yicha qidiruv
    API'si yo'q — ega qarori kutiladi); oflayn navbat yo'q.
  - **2-bosqich — tayyor:** USB skanli har oqim kamera maqsadi bo'ldi (`useOrderQrScanner({ camera })` yoki
    `useScanTarget`; kamera skani USB handler'ini AYNAN chaqiradi, ikkinchi mantiq yo'q; kamera har skandan keyin
    yopilmaydi; maketdagi `*-camera` matnlari — sarlavha, kontekst, yo'riqnoma, hisoblagich, ro'yxat «Bekor qilish»
    bilan faqat server amali hali bajarilmagan bo'lsa, «Tugatish» kamerani yopadi):
    - `/new-orders/:marketId` — skan = darhol qabul, «Qabul qilindi N · Qoldi M · Topilmadi K», ro'yxatda yo'q kod
      `GET orders/qr-code/:token` bilan tekshiriladi (boshqa market — rad, 404 — «Topilmadi»), kamera ichida market
      almashtirish (`GET orders/markets/new`) — kamera ochiq qoladi;
    - `/new-orders/incoming/:marketId` (`ScanInput` dagi `handleScan`, manba almashtirish, «Qopda yetishmaydi»),
      filial paketlari va paket ichidagi buyurtmalar, `/mails/:id` (jo'natish, qabul, rad etilganni qabul),
      `/batches/:id` («HQ'ga yuborish»), `/orders` bekor tablari (HYBRID/REGIONAL menejer — «HQ'ga yuborish», kuryer —
      «Pochtaga yuborish»; maket yo'q) — tanlash;
    - `/new-orders/cancelled/:marketId` — avval market QR, so'ng buyurtmalar («QR 04:12 amal qiladi»);
    - `/dispatch` — **savat qurilmada** (ega D2; `src/features/dispatch-basket`: `localStorage`, foydalanuvchi +
      filial kaliti, 12 soatdan eskisi va buzilgan yozuv tashlanadi, boshqa varaq bilan sinxron), `/scan/:token`
      dagi «Kuryerga biriktirish» shu savatga qo'shadi; rad etilgan QR ro'yxatda «Paket … · Rad etildi»;
    - `/courier-bulk` — kamera ichida «Bekor / Ertaga» rejimi, «Skanerlanganlar · 4 / 7 · 2 ta bekor, 2 ta ertaga»,
      «Skanerlanmagan N ta buyurtma sotilgan deb belgilanadi»; yakunlash — sahifadagi «Kunni yakunlash» (tasdiq).
    - **Istisno — `MarkReturnedModal`** (`/orders/edit/:id`, «Marketga topshirish»): oyna ochiq turganda telefonda
      markaziy tugma oyna ostida qoladi, shuning uchun oynaning o'z «Kamera bilan skanerlash» tugmasi qoldi — u oyna
      maqsadini (`layer: "dialog"`) v2 `ScannerCamera` da ochadi (sabab fayl izohida).
    - v1 «Kamera» tugmalari (dispatch, courier-bulk, cancelled — bitta qator istisnosi bilan) va
      `src/shared/components/ScannerCameraModal.tsx` (ratchet va baseline yozuvi bilan) o'chirildi;
      `ScanFeedbackOverlay` — umumiy `Portal` ning `toast` qatlamida (`z-[10050]` yo'q), matn — skan natijasi.
    - E2E (390 px, mock API): `tests/e2e/new-orders-camera.mobile.spec.ts`, `tests/e2e/scanner-*.mobile.spec.ts`
      (kamera soxta, kod «Qo'lda kiritish» bilan).
  - **3-bosqich — tayyor:** universal `/scan` rejimlari (`src/pages/scan/model/scanModes.ts`; maket yo'q — eng yaqini
    `courier-courier-bulk-scanner-camera` segmenti). Segment telefonda kamera ichida (`ScanTarget.modes`, ruxsat izohi
    holatida ham), planshet/desktopda yon paneldagi «Skaner rejimi» kartasida; bitta rejim qolsa — chizilmaydi.
    Tanlov qurilmada (`localStorage`, foydalanuvchi kaliti, `try/catch`); ruxsatdan tushgan rejim — sukutga.
    - «Ma'lumot» (kuryerdan boshqa hammada sukut) — 1-bosqichdagidek;
    - «Qabul qilish» — `canCreateOrders` va `resolveReceiveMode` ≠ `none` (REGIONAL menejer/registratorda yo'q):
      market varag'i (`GET orders/markets/new`, son, qidiruv) → `/new-orders/<id>`, kamera O'SHA sahifada ochiq
      (router holati `scannerArrivalState` → `ScannerHost` sahifa maqsadini kutadi, bayroqni tozalaydi); qabul — F1;
    - «Kuryerga biriktirish» (segmentda «Biriktirish») — `/dispatch` ruxsati VA backend `assign-to-courier` roli
      (menejer, registrator; superadmin/admin — yo'q, Trello 1gxmqLj5): tanlansa `/dispatch`, kamera ochiq; bu rejimda
      `/scan` da o'qilgan buyurtma kodi `/dispatch` ga olib o'tiladi va savatga o'sha sahifa handler'i bilan tushadi;
    - kuryer «O'zimga olish» (sukut) + «Ma'lumot»: ketma-ket `POST orders/scan-assign` (Mini App oqimi
      `features/tg-scan/model/useScanAssign` — so'rov asosiy `api` bilan), ro'yxat «Sizga biriktirildi» / «Allaqachon
      sizda» / «Boshqa kuryerda: <ism>» (ism backend xatosida yo'q — buyurtma bir marta o'qiladi) / xato sababi;
      buyurtma bo'lmagan yorliq — so'rovsiz rad; «Tugatish» (`finish.keepOpen`) → kesh yangilanadi, xulosa
      «N ta buyurtma sizga biriktirildi» [Davom etish] [Buyurtmalarimga o'tish].
    - E2E: `tests/e2e/scanner-universal.mobile.spec.ts`.
  - **4-bosqich — tayyor:** Sozlamalar → Skaner → «Kamera» kartasi (`common-settings-scanner`,
    `pages/settings/ui/ScannerPanel.tsx`): «Kamerani sinash» → `/scan` (marketda yo'q), «Asosiy kamera» (orqa —
    sukut / old), kalitlar «Chiroq — avtomatik», «Uzluksiz skanerlash», «Ovoz», «Tebranish», «Ramka o'lchami»
    (kichik 208/232 · o'rta 248/280 · katta 288/320 px).
    - Saqlash: `entities/settings` → `scanner.camera { facing, frame, torchAuto, continuous }` va
      `scanner.feedback { sound, vibration }`; backend `PATCH auth/my-settings` jsonb ni ochiq saqlaydi (origin/main
      `updateOwnSettings` — kalit tekshiruvi yo'q), shuning uchun hisobga yoziladi. Qurilmada — `localStorage`
      ko'zgusi (`shared/lib/preferencesStorage`, `SettingsSync` va sahifa yozadi); `shared` qatlami shundan o'qiydi.
      Maket matni «shu qurilmada saqlanadi» → «hisobingizda saqlanadi» (haqiqiy xatti-harakat).
    - `ScannerCamera` ochilishda o'qiydi: asosiy kamera (`preferredCamera`; kamera ichida «Kamerani almashtirish» —
      shu ochilish uchun, bir nechta kamera bo'lsa, maket `superadmin-scan-camera`), ramka o'lchami — ramka,
      maslahat o'rni va **skan hududi** (`shared/ui/camera/scanRegion.ts`: ekrandagi ramka `object-cover` hisobi bilan
      tasvir pikseliga, ±10 % zaxira; maket «faqat ramka ichidagi QR»). «Chiroq — avtomatik» — ega qarori: o'zi
      yoqilmaydi, chiroqli qurilmada kadr yorqinligi past bo'lsa (`useLowLight`, 1,2 s da bir o'lchov, ketma-ket 2
      ta) maslahat o'rnida «Yorug'lik kam» + [Chiroqni yoqish]; chiroq bir marta bosilsa — shu ochilishda
      qaytmaydi; kadrni o'qib bo'lmasa — faqat qo'lda. «Uzluksiz skanerlash» o'chiq — oqim oynasi (`overlay`) shu
      kamera yuborgan kodning muvaffaqiyatli natijasidan 700 ms keyin yopiladi (xato — ochiq qoladi, USB natijasi
      yopmaydi); universal `/scan` sahifasiga ta'sir qilmaydi. «Ovoz» / «Tebranish» — `playScanSignal` da
      (kamera va USB; «Eshitib ko'rish» — `preview`, kalitga qaramaydi).
    - E2E: `tests/e2e/scanner-settings.mobile.spec.ts` (saqlash; o'chiq uzluksizlikda bitta koddan keyin yopilish).
  - **Kamera ishi yopildi:** v1 kamera kodi qolmadi (`ScannerCameraModal`, v1 «Kamera» tugmalari, `scanShared`
    chiqarilgan). Ochiq (ega qarori): oflayn navbat, buyurtma raqami bo'yicha qo'lda kiritish (API yo'q).
  - Kamera ko'rinishlari vizual sahnalarda yo'q.
- **Yopiq va yetib bo'lmaydigan v1:** `/market-operators` (ko'chirilmaydi, `V2_SCOPES` da yo'q), `SalaryPaymentPopup`
  («Maosh to'lash» yashirin) — ratchet va pending'da; o'chirish — alohida qaror.
- **v1 o'rami:** `PrintModeSelect` (ratchet'da, `shared/ui` ga ko'chirilguncha). Iste'molchisi qolmagan (o'lik) v1
  — 61 fayl, testlari bilan: `UserInfoCards` / `UserStatsCard` / `UserDetailHeader` / `CustomerOrdersTable`,
  `shared/components/{button,Table,pagination,popupConfirm,popupUpdate}`, `shared/ui` dagi v1 o'ramlari (§11,
  3-bosqich ro'yxati), `StatusBadge` + `statusColorMap` + `pages/orders/list/OrderStatusBadge`, `formatDate`,
  `ExtraCostApproval.tsx`, `features/search` barreli va `LoginForm`, eski `app/router`, `pages/home` — bosqich B
  integratsiyasida o'chirildi (`MAX_RAW` 9 → 5, `MAX_PENDING` 3 → 2, CSS ruxsat ro'yxatida faqat `src/index.css`).
- **Follow-up (5-bosqichda emas):** `Switch`, `FilterChip`, `Checkbox` primitivlari — qo'lda yasalgan `.el-switch`
  (`SellModal`, `FinancialAnalysis`, `UserDetailView`, `settingsUi`, `pages/integrations/ui/Switch.tsx`, …) va chip «×»
  (`orders`, `mails`, `payments`, `integrations`) nusxalari; `TextInput` prefiks sloti (`CampaignPage` istisnosi shu bilan
  yo'qoladi).

## Ilova A. 4-bosqich migratsiya jurnali

Har guruhning ko'chirilgan sahifalari: route'lar, kartalar, oynalar, ega qarorlari va chiqarilgan v1. Matn 2026-10-18
da §11 dan o'zgarishsiz ko'chirildi, G2 va G3 yozuvlari birlashtirishda qo'shildi; route bo'yicha joriy holat — `design/SCREENS.md`.

- **Ko'chirilgan:** `/orders` — barcha rollar (superadmin, admin, registrator, market, menejer, kuryer): ro'yxat va
  8 holat tabi, filtrlar (asboblar qatori, «Qo'shimcha filtrlar» paneli, chiplar, telefon varaqasi), menejerning
  «Bekor qilingan» tabida HQ'ga yuborish, kuryer ro'yxati (3 tab, skaner), sotish / qisman sotish / bekor qilish /
  qaytarish oynalari (`variant="courier" | "manager"`). Tab sonlari chizilmagan — `GET /orders` holat bo'yicha sonlarni
  bermaydi.
- **Ko'chirilgan:** `/orders/edit/:orderId` — buyurtma tafsiloti, barcha rollar (`<rol>-orders-detail`; market va
  kuryer — o'z tartibi): sarlavha `PageHeader` («← Buyurtmalar», № + nusxalash, holat, «Qaytarish so'ralgan», rol
  amallari — bitta asosiy «Sotish»), ogohlantirishlar (market tasdig'i, qulflar, «Faqat ko'rish uchun», qisman sotuv),
  Mijoz · Manzil · To'lov · Mahsulotlar · Dalillar · Tarix · «Buyurtma ma'lumotlari» kartalari, tahrirlash oynalari
  (manzil, mijoz, buyurtma / mahsulotlar — `pages/new_orders/components/editDialogs/`), sotish / bekor qilish /
  qaytarish — `/orders` dagi v2 oynalar, marketga qaytarish oynalari. Sahifa `pages/new_orders/components/new_orderUpdate.tsx`
  (konteyner) + `detail/` (kartalar, ruxsat `orderDetailAccess.ts`, javob tozalash `orderDetailModel.ts`). Ayni komponent
  `/new-orders/:marketId/edit/:orderId` da ham (maketlar `*-neworders-market-order-edit`, `market-new-orders-edit`):
  orqaga — market nomi (market rolida «Qabul va yaratish»), «Buyurtma ma'lumotlari» kartasi yo'q, qulf bo'lmasa
  xodimga «Tahrirlash ochiq.», marketga «Faqat ko'rish uchun» + «Yangi buyurtmalar» ro'yxatiga havola.
- **Ko'chirilgan:** `/new-orders/create` — buyurtma yaratish, barcha rollar (`*-create-manual*`, `*-create-step1|step2`,
  `*-create-market-picker*`, `*-create-ai*`): sarlavha `PageHeader` («← Qabul va yaratish», «Yangi buyurtma», holatga
  qarab izoh, o'ngda «Qo'lda | AI bilan» — `SegmentedControl`), ~ 924 px dan keng ekranda ikki ustun (asosiy + yon),
  telefonda yopishqoq panel yo'q. Qo'lda: «Qadamlar» kartasi (`OrderStepper`; «O'zgartirish» / «Oldingi» 1-qadamga
  qaytaradi, market va forma saqlanadi, boshqa market tanlansa katalog mahsulotlari tushib qoladi, «maxsus» qoladi),
  «Market tanlang» (`Step1Market`) + market tanlash oynasi (`MarketPicker.tsx`: qidiruv, `listbox`, klaviatura,
  skelet, «Market topilmadi»; ro'yxat faqat oyna ochiqligida so'raladi), 2-qadam — mijoz, manzil, mahsulotlar
  (katalog + «maxsus»), yetkazish va izoh (`Step2Combined`), yon ustunda «Buyurtma xulosasi» (`Step2Summary`) va
  bugungi «Yangi buyurtmalar» (`TodayOrdersCard`). Market rolida 1-qadam yo'q; planshetda yon kartalar yonma-yon.
  AI bilan: matn/rasm paneli (`AiInputPanel`), tahlil kartalari (`AiPreviewCard`), tasdiq paneli va 5 tadan ortiq
  buyurtmada tasdiq oynasi (`AiConfirmBar`), «Yaratildi (N)» (`AiCreatedList`), chiqib ketish himoyasi — `useConfirm()`.
  Ogohlantirishlar — umumiy `ui/CreateAlert.tsx` (`.el-alert`). v1 `ui/formFieldStyles.tsx` o'chirildi.
- **Ko'chirilgan:** «Qabul» — `/new-orders/*` qobig'i va qabul sahifalari (kamera rejimlari `*-camera` — keyinroq,
  hozir faqat USB/klaviatura skaneri). Qobiq `pages/new_orders/index.tsx`: rejim yo'lga qarab
  (`model/newOrdersShell.ts` — `bare` faqat `<Outlet/>`; `hosted` — «Qabul va yaratish» `PageHeader` + «Buyurtma
  yaratish» havolasi, `ui/NewOrdersHeader.tsx`; `legacy` — hali v1 bola sahifalar uchun sarlavha + tablar). Tablar
  (`ui/NewOrdersTabs.tsx`, havola rejimidagi `Tabs`) bola sahifaning birinchi kartasi boshida, sonlari sahifa bilan
  bir xil kesh kalitidan (yuklanish/xatoda son chizilmaydi, ko'rinmas tab so'rov yubormaydi); ko'rinish v1
  qoidalari bo'yicha — superadmin/admin 4 tab, HQ registrator 2, menejer va boshqa registrator 1 (tab o'rnida karta
  sarlavhasi), market — «Yangi buyurtmalar · Bekor qilinganlar».
  `/new-orders` — «Marketlar» (`markets/index.tsx`): qidiruv, «Bugun:» xulosasi, `DataTable` (telefonda kartalar),
  market roli o'z marketiga yo'naltiriladi. `/new-orders/:marketId` (`components/new_orderDetail.tsx` +
  `components/marketOrders/`): xodimga `PageHeader` (market nomi, bugungi son · summa, bitta asosiy «Qabul qilish —
  N ta»; REGIONAL — tugma o'rnida «Biriktirish» izohi), qidiruv + «USB skaner tayyor», tanlov paneli (`SelectionBar`
  — «N ta buyurtma tanlandi · summa», «Barchasini tanlash», chop etish menyusi), `DataTable` tanlov bilan (telefonda
  48 px belgi), qabul / o'chirish oynalari (`MarketOrderDialogs.tsx`, `ConfirmDialog`; o'chirish xatosi oynada
  qoladi); market rolida — qobiq ichida o'z ro'yxati. Registrator hozircha boshqa xodimlar ko'rinishida (o'z maketi
  — ega qarori kutilmoqda, `route-map.json` `partialViews`). `/new-orders/incoming` (`incoming-orders/SourcePicker.tsx`
  + `ui/`): manbalar xulosasi (SVG halqa + legenda, telefonda segment chizig'i; «Jami summa», «Eng uzoq
  kutayotgan»), `DataTable` (kutish o'lchagichi `role="meter"`, 3 kun chegarasi `lib.ts` `STALE_HOURS`), bo'sh
  manbalar kartasi. `/new-orders/incoming/:marketId` (`incoming-orders/index.tsx`): skan maydoni `ui/ScanInput.tsx`
  (matn holati maydonning o'zida — skaner tugmalari ro'yxatni qayta chizmaydi), oxirgi natija `ui/ScanMessage.tsx`
  (`.el-alert`), posilkalar `ui/IncomingTable.tsx`; qabul 200 talik partiyalar bilan, ovoz va takror/topilmadi
  holatlari o'zgarmagan. Tab sonlari uchun `useIncomingSources`, `useCancelledMarkets`, `useCancelledOrdersByMarket`,
  `useBranchesWithSentBatches` ga ixtiyoriy `enabled` qo'shildi (sukut o'zgarmagan). v1 o'lik kalitlar
  (`addOrderBtn`, `ordersHeader`, `searchOrder`, `receiveOrders`, `selectOrders`, `receiveOrderMessage`) o'chirildi.
- **Ko'chirilgan:** «Qabul» — «Filial paketlari» va «Bekor qilinganlar» (superadmin, admin; bekor qilinganlar — HQ
  registrator va market ham). Qobiq rejimi (`model/newOrdersShell.ts`): ro'yxatlar `hosted`, filial / paket va
  xodimning topshirish sahifasi `bare`, market rolining bekor qilinganlari `hosted`. Umumiy qismlar:
  `ui/SourceListCard.tsx` (manba ro'yxati kartasi: qidiruv, saralash — sukut «Buyurtmalar/Paketlar» kamayish bo'yicha,
  «N ta … · jami» xulosasi, `DataTable` → telefonda kartalar, bo'sh / topilmadi / xato holatlari) va
  `shared/ui/SelectionRegion.tsx` (tanlov xulosasi, `aria-live`; `idle` — hali tanlanmagan; pochta va paket
  tafsilotlari ham ishlatadi). `/new-orders/branches`
  (`branches/index.tsx`) — filiallar; `/new-orders/branches/:branchId` (`branches/batches.tsx`) — yuborilgan paketlar,
  qidiruv + «Skaner tayyor», USB skaner paket QR'ini tanlaydi, «Qabul qilish — N ta paket» (har paketga
  `transfer-batches/:id/receive`); `…/batches/:batchId` (`branches/batchDetail.tsx`) — paket buyurtmalari, skan bilan
  tanlash, `receive-orders`. Yordamchilar `branches/branchBatchesModel.ts`. `/new-orders/cancelled`
  (`cancelled/index.tsx`) — bekor qilingan buyurtmasi bor marketlar (qidiruv mijozda — endpoint parametr olmaydi).
  `/new-orders/cancelled/:marketId` (`cancelled/detail.tsx` + `cancelledModel.ts` + `ui/`): `PageHeader` (market
  nomi, son · summa, yagona asosiy «Marketga jo'natish — N ta»), `HandoverStatusAlert` («Market QR kerak» → «Market QR
  skanerlandi» + amal qilish taymeri; QR talab qilinmasa — neutral), «USB skaner tayyor» qatori (kamera — faqat
  markaziy «Skaner» orqali, skaner 2-bosqich; sahifada skan tugmasi yo'q), `CancelledOrdersTable` (tanlov faqat skaner orqali; «QR buzilgan»
  qatorlarida qo'lda tasdiq), `ManualConfirmDialog` («QR buzilganini tasdiqlash», sabab `Select` — backendga enum
  kodi, ko'rinadigani tarjima). Biznes qoidasi o'zgarmagan: jo'natish faqat market QR skanerlangach (u marketning
  barcha bekorlarini tanlaydi), so'rov tanasi, ovozlar, takroriy/noto'g'ri skan va kirish huquqlari v1 dagidek.
  Market rolida — o'z bekorlari (skanersiz) va «QR kod» oynasi (`ui/MarketQrDialog.tsx`). v1 `components/OrderCard.tsx`
  o'chirildi (tur `model/apiOrder.ts` ga ko'chdi), o'lik `newOrders` kalitlari (`cancelled*`, `branch*`,
  `deliver*` …) o'chirildi.
- **Ko'chirilgan:** «Pochta» (`/mails/*`, superadmin, admin, menejer HQ · REGIONAL · HYBRID, registrator, kuryer;
  kamera rejimlari `*-camera` — keyinroq, hozir faqat USB/klaviatura skaneri, `route-map.json` `partialViews`).
  Qobiq `pages/mails/index.tsx`: xodimda `PageHeader` + bitta `Card` (havola rejimidagi sonli `Tabs` «Bugungi ·
  Qaytarish · Rad etilgan · Eski», telefonda bo'lim tanlagichi — `Select`), kuryerda tablar sahifa fonida
  (`background="bg"` — nofaol son yuza + chegara), «Qaytarish» yo'q (`/mails/return` → `/mails/today`). Sonlar
  `model/mailsLists.ts` hooklaridan (tanalar bilan bir xil queryKey). Ro'yxatlar umumiy `components/MailsTable.tsx`
  (`DataTable`, telefonda kartalar, kuryerda mijoz tomonida saralash; `statusHeader` — admin/superadmin eski
  pochtalarida «Holati») va `MailsListBody.tsx` + `MailSummaryStats.tsx` (bugungi, rad etilgan). `/mails/return` —
  kuryer bo'yicha guruhlangan jadval, doimiy `SelectionRegion`, `{ order_ids }` tasdiq/rad. `/mails/old` — «Pochtalar
  | Filial paketlari» (`SegmentedControl`, faqat admin/superadmin, `batch_mode=all`), filtrlar URL'da (telefonda pastki
  varaqa `OldMailsFiltersSheet.tsx`), xulosa, «Excelga yuklash» (ustunlar, jumladan «Kuryer», o'zgarmagan), mijoz
  tomonida `Pagination`, chekni qayta chiqarish. `/mails/:id` (`detail/index.tsx`): `PageHeader` (holat, «Faqat
  o'qish», chop etish menyusi + bitta asosiy «Pochtani jo'natish / qabul qilish — N ta»; kuryer telefonida pastki
  menyu ustidagi panelda), `StatCard`lar (`MailStatCards`), buyurtmalar kartasi `ui/OrdersTable.tsx` (`DataTable`,
  telefonda `OrderRow`, «USB skaner tayyor», `SelectionRegion`, qatorni bosish — tanlov), jo'natish oynasi
  `SendPostModal` (`Dialog`), pochtadan o'chirish `DeleteFromPostDialog` (`Dialog`, `alertdialog`, sabab majburiy).
  Yuborish/qabul/o'chirish so'rovlari, USB skaner (takror/topilmadi), chop etish rejimlari (brauzer / PDF 100×60)
  o'zgarmagan. v1 `MailGridCard`, `MailDetailHeader`, `PrintOnlyOrders`, `Checkbox`, `lib/helpers.ts` va o'lik
  `mails` kalitlari o'chirildi.
- **Ko'chirilgan:** «Paketlar va qaytarishlar» (`/batches`, `/batches/:id`, `/returns`; superadmin, admin, menejer
  HQ · PICKUP · HYBRID). `/batches` (`batches/ui/BatchesPage.tsx`): «Yangi · Eski · Qaytarilgan» sonli tablar
  (`?tab`), `DataTable` (telefonda kartalar), `Pagination`; holat badge'i — haqiqiy paket holati
  (`entities/batch` `BATCH_STATUS_TONE` + `newOrders:batchStatus.*`). `/batches/:id` (`ui/BatchDetailPage.tsx`):
  `PageHeader` («← Paketlar / Qaytarishlar / Eski pochtalar»), `BatchInfoCard`, `BatchQrCard`, `BatchHistoryCard`,
  A5 chop etish varag'i `BatchPrintSheet`; buyurtmalar — pochta tafsilotining `OrdersTable` kartasi
  (`appearance="batch"`: telefonda «№X · [market ·] telefon» + manzil, pastda «Jami N ta buyurtma»;
  qaytarish paketida `scannerReadyOnPhone`), jo'natish `PATCH transfer-batches/:id/send { orderIds }` va USB skaner
  o'zgarmagan. `GET branches/:id` faqat superadmin/admin uchun so'raladi (backend `@Roles`). `/returns`
  (`returns/index.tsx` + `model/returnBatches.ts`): holat filtri, `DataTable`, qator → `/batches/:id`.
- **Ko'chirilgan:** «Moliya» (`/payments`, `/payments/main-cashbox`, `/payments/cash-detail/:id`, `/cash-box`,
  `/financial-balance`). Umumiy qismlar (`pages/payments/components/`): yorliqlar `paymentSourceType.ts`
  (`getPaymentSourceTitle` — ko'ruvchiga bog'liq manba nomi, `getPaymentMethodLabel`, `getCashboxTypeLabel`,
  `getViewerOperationType` — yo'nalish), tafsilot oynasi `FinanceHistoryDetailPopup` (barcha sahifalar; kuryerda
  `hideCashboxType`), tanlash oynasi `SettlementPickerDialog` (`receive` · `give` · `courier`), kassa ro'yxati
  `PaymentHistoryList`. Pul faqat `formatMoney*` (ishora `formatSignedMoneyLocalized`, kirim `success-fg`, chiqim
  `danger-fg`), operatsiya badge'i neytral + strelka. `/payments`: KPI kartalari, menejerda «Kuryerlardagi pul»,
  «Operatsiyalar tarixi» (`Tabs` Kirim/Chiqim, sana + manba + kassa + yaratgan filtrlari URL'da, telefonda varaqa,
  `DataTable` + `Pagination`). `/payments/main-cashbox`: «Kassa balansi» (naqd/karta, kun oxiridagi qoldiq grafigi
  `MainCashboxBalanceChart`, «Grafik | Jadval»), «Tezkor amallar», «Bugun / Bu hafta / Bu oy», «Pul qayerdan keldi,
  qayerga ketdi», tarix; to'ldirish / xarajat (`CashboxFormPopup`) — `useConfirm` tasdig'i + `Idempotency-Key`,
  smena oynasi `CloseShiftPopup` (oynaning o'zi tasdiq). `/payments/cash-detail/:id`: «Hisob-kitob holati», to'lov
  formasi `CashboxActionFormCard` + «To'lovni tasdiqlang» (from → to), «Balans harakati» va tarix. `/cash-box`
  (`MyCashboxPage`): balans kartasi, «Bugun» bloki, tarix jadvali. `/financial-balance`: 4 KPI, «Balans tarkibi»,
  reytinglar (`SettlementRanks`), Tarix (`HistoryTab`), Tahlil (`AnalysisTab` + waterfall `LedgerFlow`, `tizim-charts`),
  qo'lda yozuv `FinancialEntryModal`, tafsilot `FinancialHistoryDetail`. Ega qarorlari 2026-10-17: D1 — SA/admin
  asosiy kassasida faqat asosiy kassa operatsiyalari (`cashbox_type=main`); D2 — marketning o'z kassasida
  `market_payment` «Chiqim −» (ro'yxat va tafsilot); D3 — to'ldirish / xarajat `Idempotency-Key` bilan. Payload'lar,
  idempotentlik, ikki marta bosishdan himoya va eksportlar o'zgarmagan; «Taklif» grafiklari chizilmagan. v1
  `CashboxRolePageLayout`, `CashboxView`, `CashboxSummaryCard` va o'lik `payments` kalitlari o'chirildi.
- **Ko'chirilgan:** G1 — «Bosh sahifa», «Foydalanuvchilar», «Filiallar», «Mahsulotlar», «Hududlar» (`/`,
  `/branch-dashboard`, `/all-users`, `/all-users/create-user`, `/all-users/:id`, `/new-orders/userDetail/:id`,
  `/branches`, `/branches/:id`, `/products`, `/products/create-product/:id`, `/regions`, `/regions/districts`,
  `/regions/sato-management`, `/regions/logist-assignment`). **Grafiklar** — yangi umumiy `src/shared/ui/charts`
  (barrel, `// dizayn-v2: tizim-charts`): `Gauge` (zona badge'i o'zida, `successZoneTone` ≥ 70 / 40–70 / < 40),
  `Donut` (≤ 6 bo'lak + legenda-jadval), `RankList` (top 5, telefonda top 3, «Yana ko'rsatish · {n} ta», `pinned`
  qator), `Meter`, `SegBar`, `HBarList`, `Waterfall`, `RingStat`, `ChartLegend` / `ChartNote`, `ViewToggle`
  («Grafik | Jadval»), `DeltaChip`; hammasi oddiy SVG/div + tokenlar, recharts faqat «Moliyaviy tahlil» trendida
  (`widgets/financial-analysis/ui/FinancialTrendPlot.tsx` — lazy, `DeferredMount rootMargin="0px"`; dashboard
  birinchi ochilishi ≤ 450 KB gzip — `tests/e2e/dashboard-bundle.preview.spec.ts`). Dashboard: `DashboardHeader`
  (davr segmenti + «Yil» + `DateRange`, davr redux'da), `DashboardGrid`, `SuccessRateCard`, `OrderStatusCard`,
  `TopRankCard`, hududlar kartogrammasi `widgets/dashboard-region` (Highcharts'siz, `--color-region-map-*`).
  Viloyat oynasi — umumiy `widgets/region-detail` `RegionDetailDialog` (faqat `lazy(() => import(…))`, bosilganda;
  `showRevenue={false}` — registratorda daromadsiz). Foydalanuvchi tafsiloti — yangi `UserDetailView` (eski
  `UserDetailWidget` G2 da o'chirildi). Xatosi sahifada chiziladigan G1 so'rovlari
  `meta.silentError` bilan (global xabar takrorlanmaydi). Ega savollariga sukut javoblari (spec §9) —
  `design/kit/route-map.json` izohlarida. Chiqarilgan v1: `MetricCard`, `MobileCollapsibleSection`,
  `QuickDateRangeFilter`, `PerformanceChart`, `RegionStatsCard`, filial sozlamalari (config) kodi.
- **Ko'chirilgan:** G2 — «Integratsiyalar», «Bildirishnomalar», «Tizim», «Hisob» (`/integrations/connections` —
  konsol va 7 panel, `/integrations/new`, `/integrations/new/:typeKey`, `/integrations/partners`, `/integrations/sources`,
  `/integrations/sources/create`, `/integrations/sources/:id`; `/notifications`, `/notifications/send`,
  `/notifications/sms`; `/activity-logs`, `/ops` + `/finance-operators`, `/integrations-ops`, `/investors-ops`,
  `/logistics-ops`, `/branch-ops`, `/identity-ops`, `/system-ops`, `/logs`; `/profile`, `/settings`, `/inbox`;
  `/market-operators` yopiq, ko'chirilmagan). **`DataTable` ochiladigan qator** — yagona API `expandable` (dev'dagi `renderExpanded` unga birlashtirilgan: `isExpanded`,
  `onToggle`, `render`, `canExpand`, `toggleLabel`, `toggle: "none"` + `panelId`, `panelClassName`,
  `expandedClassName`): chevron ustuni birinchi, panel `colSpan` = barcha ustunlar, telefonda karta ostida; retsept —
  CODE-MAP §2.6, namuna `/ops/ui-kit?section=table`, iste'molchilar — faoliyat jurnali, integratsiya posilkalari va eski hamkorlar
  webhook jurnali. **Telegram guruhini ulash** (`/notifications`, dev birlashtirishi, ega qoidasi) — maketdagi qo'lda
  guruh ID formasi o'rniga bir martalik havola: `POST /telegram/link-code` → QR + «Telegram'da ochish» + qadamlar +
  muddat, oyna ochiqligida ro'yxat har 4 s, guruh ulangach oyna yopiladi; jadvalda «Holat» ustuni. `/profile` da
  xodimning o'z Telegram'ini ulash/uzish (`TelegramLinkCard`, xuddi shu bir martalik oqim) va marketda «Guruhda mijoz
  ismi va telefoni» (`MarketTelegramGroupPiiCard`) — maket yo'q, eng yaqini «Xavfsizlik» kartasi. Ops panellari — `pages/ops/ui/OpsToolPage.tsx` (`embedded` — hub ichida sarlavhasiz; to'g'ridan-to'g'ri
  yo'lda «← Ops vositalari»), telefonda tablar → `Select`. Pul va xavfli amallar tasdiq bilan: operator to'lovi (`useConfirm` +
  `Idempotency-Key`, muvaffaqiyat xabarida server qaytargan summa), SMS kampaniya (tasdiq oynasi + `Idempotency-Key`),
  kalitni yangilash, hamkor / ulanishni to'xtatish, paketni bekor qilish, manba va Telegram guruhini o'chirish. Sozlamalar 5 tab («Skaner» alohida), profil — parol va tahrirlash oynalari
  (`UpdateUserModal` profilda yo'q), inbox — push holat bloki barcha rollarda. Matnlar yangi `ops.json`,
  `profile.json`, `notificationGroups.json` da. Xatosi sahifada chiziladigan G2 so'rovlari `meta.silentError`
  bilan (umumiy hook'larda ixtiyoriy `{ silentError: true }`, `shared/lib/queryErrorEvents.ts` →
  `silentErrorMeta`). Ega savollariga sukut javoblari (spec §10) — `route-map.json` izohlarida. Chiqarilgan v1:
  `integrations/ui.ts`, `OverviewPage`, `ConnectionSubNav`, `FilterPills`, `widgets/notification-table`,
  `DeleteNotificationButton`, `shared/ui/InlineErrorBoundary`, `shared/ui/Toggle`, `shared/ui/ConfirmButton`,
  `NotificationCategoryTag` / `NotificationPriorityTag` (antd `Tag`), `financeCoverage.createOperatorPayment`,
  `NOTIFICATIONS.CONNECT_BY_TOKEN`, `UserDetailWidget` (profil v2 da; uning Telegram kartalari — `ProfilePage` da) va
  `TransferCourierButton` ning v1 `header` turi; dev bilan birlashtirishda dublikatlar — `ActivityLogFiltersSheet`,
  `activity-log/lib/logView.ts`, `actionTone.ts`, `ActivityActionTag` (o'rniga dev'ning `ActivityLogFilters`,
  `model/*`, `actionMeta.ts`, `ActivityActionBadge`), `TelegramGroupFormDialog` / `telegramGroupForm.ts` (o'rniga
  `NotificationFormModal` + `NotificationEditModal`), `DataTable renderExpanded`.
- **Ko'chirilgan:** G3 — kirish, skaner natijasi, «Biriktirish», «Tezkor amal» (`/login`, `/scan/:token`,
  `/dispatch`, `/courier-bulk`; xato sahifalari 3-bosqichda tayyor; butun `/scan` kamera ekrani — alohida kamera
  ishi). `/login` (`features/auth`): ≥ 1024 navy panel + forma, < 1024 navy tasma; `TextInput mode="phone"`
  (payload `+998XXXXXXXXX`), parol ko'zi, xato — forma ichidagi `role="alert"` bloki; «Sessiya tugadi» ekrani
  `SessionExpiredScreen` (`logoutAndRedirect({ reason: "sessionExpired" })` → `auth/loginNotice.ts`). **Sessiya
  banneri** `auth/SessionExpiryCountdown.tsx` (`tizim-feedback` 04, entry chunk'da, faqat primitivlar): ogohlantirish
  «Sessiya N daqiqadan keyin tugaydi» + `role="timer"`, tugagach «Qayta kirish». **Shell'ga qo'shilgan slot (maket
  talabi):** `DashboardLayout` da yuqori panel va `<main>` orasida `[data-shell-slot=banner]` (`shrink-0`, oqimda,
  skroll konteyneridan tashqarida) — banner unga portal qiladi (`shared/lib/shellBannerSlot.ts`), sahifani pastga
  suradi va hech narsani yopmaydi; slot yo'q qobiqda (`ScanLayout`) — `sticky top-0`. `/scan/:token`
  (`pages/scan/ui/*`): barcha rollar uchun bitta tartib (telefon yuqori paneli `ScanResultHeader`, «Holat va summa»,
  «Mijoz va manzil», «Mahsulotlar», ≥ 1024 «Amallar» kartasi / < 1024 yopishqoq `ScanStickyBar`); kuryer «O'zimga
  olish», menejer «Sotish» / «Bekor qilish» (`/orders` oynalari, tafsilot qoidalari) va «Kuryerga biriktirish» →
  `/dispatch` (`state.scanToken`), xodimda «Holat tarixi»; paket va pochta tanalari, «topilmadi» kartasi. Paket
  nomlari ixtiyoriy `useBatchDetail(id, { silentError: true })` bilan. `/dispatch` (`pages/dispatch/ui/*`): stat
  kartalar, «Skanerlangan buyurtmalar» (`DataTable` + tanlov, USB skaner qo'shadi va tanlaydi), kuryer oynasi
  `CourierPickerDialog`, bitta faol kuryer — darhol biriktirish, telefonda pastki menyu ustida yopishqoq panel.
  `/courier-bulk` (`pages/courier-bulk/ui/*`): 4 stat karta, «Skanerlash rejimi», qator natijasi «Sotildi | Bekor |
  Ertaga» (`SegmentedControl`), mijoz tomonida qidiruv / filtr / saralash, «Kunni yakunlash» — `useConfirm` tasdig'i
  (DOM'da bitta tugma; telefonda yopishqoq panelda). Tasdiqdan keyin **isbot qadami** (maket yo'q — eng yaqini
  `tizim-states-forms` + `courier-courier-bulk-confirm-dialog`): market `expense_proof_conditions` talab qilgan
  buyurtmalar uchun `CourierBulkProofDialog` (har biriga bitta `ProofField`, hammasida fayl bo'lmaguncha «Yakunlash»
  o'chiq; isbot kerak bo'lmasa qadam yo'q); xato berganlar `CourierBulkResultDialog` da backend sababi bilan;
  ommaviy sotish/bekor so'rovlarida `X-Request-Source: courier-bulk`, isbotlilar 2 tadan, qolganlari 6 tadan parallel.
  Skaner vaqtlari va ovozlar o'zgarmagan.
  Ega savollariga sukut javoblari (spec §9) — `route-map.json` izohlarida. Chiqarilgan v1: `ScannerActionButton`,
  `.login-field` CSS, `logo yozuvlik qora.png`, o'lik `auth` / `dispatch` / `courierBulk` / `common:scanner*`
  kalitlari; en/ru ko'plik shakllari («1 order», «2 orders»).
- **Ko'chirilgan:** skaner 1-bosqichi (Trello v1eLN2tV, 2026-10-19) — universal `/scan` (maketlar `superadmin-scan-camera`,
  `courier-scan-*`): telefonda `ScannerCamera presentation="page"` (to'liq ekran, «Oxirgi: …», [Qo'lda kiritish]
  [Chiroq]), planshet/desktop — sarlavha, kamera bloki va yon kartalar («Natija», «USB skaner ham tayyor» + qo'lda
  kiritish, «Oxirgi skanerlar · Shu qurilmada»); faqat «Ma'lumot» rejimi, topilgan kod → `/scan/:token`; begona sayt
  havolasi — so'rovsiz «yaroqsiz». Infratuzilma: skan maqsadlari reyestri (`shared/lib/scanner`), kontekstli markaziy
  tugma va `widgets/scanner/ScannerHost` (shell, ega roziligi), v2 `ScannerCamera` (`shared/ui/camera`). Batafsil va
  maketdan farqlar — §14 «Kamera ishi». Chiqarilgan v1: `pages/scan/lib/scanShared.ts` (`playScanFeedback` →
  `shared/lib/scanner/feedback.ts`), `/scan` ning `RAW_CONTROL_RATCHET` va `V2_SCOPE_PENDING` yozuvlari.
