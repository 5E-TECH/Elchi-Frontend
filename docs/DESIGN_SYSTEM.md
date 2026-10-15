# Elchi CRM — Dizayn tizimi v2

> Holat: **0-bosqich** (tokenlar, mavzu, shrift, valyuta). Komponentlar (1-bosqich), shell (2), forma/dialog (3),
> sahifalar migratsiyasi (4) va qo'riqchilar (5) keyingi PR'larda. Trello: «Dizayn v2» kartalari.

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
| `action` | `#2b50d8` | `#8ea6ff` | asosiy tugma foni, faol holat — **ko'k faqat interaktiv narsa** |
| `action-hover` | `#2443b8` | `#a9bbff` | hover |
| `action-fg` | `#2b50d8` | `#8ea6ff` | havola, faol tab matni |
| `action-soft` | `#e8edfd` | `rgba(142,166,255,.14)` | tanlangan qator, yumshoq tugma |
| `on-solid` | `#ffffff` | `#0d1120` | `action` fon ustidagi matn (tungida to'q!) |
| `focus` | `rgba(43,80,216,.28)` | `rgba(142,166,255,.38)` | fokus soyasi |
| `success` / `-fg` / `-soft` | `#12704f` / `#12704f` / `#e3f4ec` | `#0d8f5b` / `#4fc58e` / 14% | sotilgan, to'langan, faol |
| `warning` / `-fg` / `-soft` | `#95560a` / `#95560a` / `#fcf0dc` | `#c97900` / `#f1b24e` / 14% | jarayonda, kutilmoqda |
| `danger` / `-fg` / `-soft` | `#be2a3b` / `#be2a3b` / `#fde8ea` | `#d82f48` / `#ff7182` / 14% | bekor, xato, qarz |
| `info` / `-fg` / `-soft` | `#1a62a8` / `#1a62a8` / `#e2effa` | `#2563d8` / `#6bb6f3` / 14% | yangi, yaratilgan, qabul qilindi |
| `overlay` | `rgba(16,23,51,.45)` | `rgba(3,5,12,.62)` | modal orqa foni |
| `chart-1…8`, `chart-muted` | 3-bo'limga qarang | | grafiklar |

**Qoidalar**
- Holat rangi har doim **matn yoki ikonka bilan** birga (faqat rang bilan ma'no berilmaydi).
- Holat **matni** uchun `*-fg`, yumshoq fon uchun `*-soft`, to'liq fon uchun asosiy token (`success`, `danger` …).
- Tungi mavzuda `action` fon ustidagi matn — `on-solid` (to'q). Oq matn faqat eski `main` ustida (alias, quyida).
- Navy (`nav`) fon ustidagi matn uchun hali token yo'q (`on-solid` tungida to'q bo'lib qoladi). 2-bosqich (shell)
  `on-nav` tokenini ega roziligi bilan qo'shadi; ungacha navy fonli yangi joy yaratilmaydi.
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

**Telefonda filtrlar:** ≤ 2 ta filtr — qatorda, ustma-ust (`max-md:min-h-11`; namuna `manager-returns-list`);
≥ 3 ta — «Filtrlar» tugmasi (soni bilan) + pastdan chiquvchi oyna, «Tozalash» va «Natijalarni ko'rsatish (N)»
(namuna `superadmin-orders-list` → `superadmin-orders-filters-mobile`). Maket telefonda filtrni ataylab
yashirgan bo'lsa (`courier-orders-all`), uni qo'shish — ega qarori.

## 7. Format qoidalari

Pul va sonlar **faqat** `src/shared/lib/formatMoney.ts` orqali:

```ts
formatMoneyLocalized(185000)            // uz "185 000 so'm" · ru "185 000 сум" · en "185,000 UZS"
formatCompactMoneyLocalized(48_600_000) // uz "48,6 mln so'm" · ru "48,6 млн сум" · en "48.6M UZS"
formatNumberLocalized(1545000)          // uz "1 545 000" · en "1,545,000"
```

Grafik o'qi uchun — `formatCompactAxisMoney` (`shared/config/designSystem.ts`, 2 xonagacha: `1,05 mln`, `3 mln`);
KPI kartalar uchun — `formatCompactMoney` (1 xona: `1,1 mln`).

Foiz — `formatPercentLocalized(67.43)` → uz/ru `67,4%`, en `67.4%` (1 xona sukut, ortiqcha nolsiz: `50%`).
`.toFixed(1) + "%"` yozilmaydi.

`shared/config/designSystem.ts` dan v2 da faqat `formatNumber`, `formatMoney`, `formatCompactMoney`,
`formatCompactAxisMoney` (formatMoney.ts ustidagi o'ramlar) va `ratio` ishlatiladi. `TYPO`, `TEXT`, `TONE`,
`toneAccent`, `toneSoftBg`, `formatPercent` — v1 (`@deprecated`, qo'riqchining `v1-helper` qoidasi sanaydi).

`Intl.NumberFormat("uz-UZ")` ishlatilmaydi — Chrome'da `uz` ICU ma'lumoti yo'q va u "1,545,000" beradi
(testda esa to'g'ri chiqib, xatoni yashiradi). Valyuta yorlig'i locale'da ham bir xil: `orders.currency`,
`payments.currency` … → uz `so'm` / ru `сум` / en `UZS`.

- Telefon: `+998 90 123 45 67` · Buyurtma: `№10241` · Soni: `12 ta`
- Sana: bugun `Bugun, 14:15`, kecha `Kecha, 18:04`, eskiroq `06.10.2026, 19:05`
- Qarz/manfiy: `−240 000 so'm` (`danger-fg`), kirim `+` (`success-fg`)

## 8. Matn va holatlar

- O'zbek lotin, gap registri (Title Case yo'q). Inglizcha so'z yo'q («history», «Export», «Return» emas):
  `Bosh sahifa`, `Qaytarishlar`, `Filial paketlari`, `Yaratilgan`, `Nofaol`, `Excelga yuklash`, `Operatsiyalar tarixi`.
- Buyurtma holati → ton: Yangi / Yaratilgan / Qabul qilindi — **info**; Yo'lda, Kutilmoqda, Qisman to'langan —
  **warning**; Sotilgan, To'langan — **success**; Bekor qilingan, Bekor — jo'natilgan — **danger**; Yopilgan — neytral.
- Pul o'tkazish, foydalanuvchini nofaol qilish, «Kunni yakunlash» — **tasdiqlash oynasi** orqali.

## 9. Kirish qulayligi

- Kontrast: matn ≥ 4.5:1, katta matn va UI ≥ 3:1 — `themeTokens.test.ts` asosiy juftlarni tekshiradi.
- Klaviatura fokusi ko'rinadi (`:focus-visible` → `action` rangidagi 2px halqa).
- Faqat ikonkali tugmada `aria-label` majburiy; ikonka `aria-hidden`.
- Har grafikning jadval ko'rinishi bor; holat faqat rang bilan berilmaydi.

## 10. Ikonkalar

Faqat `lucide-react`, chiziq 2, `currentColor`. Bitta ma'no = bitta ikonka: kanonik ro'yxat va eski
sinonimlarning o'rnini bosuvchilari — `design/icon-registry.json` (132 ikonka, 12 guruh).

## 11. Bosqichlar va PR qoidasi

0 tokenlar/mavzu/shrift/valyuta + `design/` manbasi + design guard (ratchet) → 1 primitivlar (`Button`, `IconButton`, `Badge/StatusBadge`, `Card/StatCard`,
`PageHeader`, `Tabs/SegmentedControl`, formatlovchilar) → 2 shell → 3 forma/dialog/holatlar → 4 sahifalar
(har sahifa alohida PR) → 5 qo'riqchilar (ESLint qoidasi, vizual snapshotlar). Palitra testi va ratchet guard
0-bosqichdan beri ishlaydi: eski kodga tegmaydi, lekin yangi buzilish qo'shilsa CI qizil bo'ladi.

**Dizayn qo'riqchisi** (`scripts/design-guard.mjs`, `npm run design:guard`): `colour`, `palette`, `dark-pair`,
`legacy`, `money`, `icons`, `tiny-text`, `v1-class`, `weight`, `gradient`, `v1-helper`. Ikki darvoza:
`npm test` ichida ratchet (`design/guard-baseline.json`, fayl × qoida soni faqat kamayadi, yangi va `// dizayn-v2:`
faylda 0) va CI'da PR qadami `--diff` (PR'da qo'shilgan qatorlarda yangi buzilish yo'q).

Har PR: faqat tokenlar · `PageHeader` · bitta asosiy amal · `StatusBadge` · formatlovchilar · 2 qavatdan ko'p
karta yo'q · kunduzgi / tungi / 390px skrinshot · to'liq `npm test` + `npm run build` yashil.

### Dizayn qo'riqchisi (ratchet)

`src/test/designGuard.test.ts` (CI'da har PR'da `npm test`) va `npm run design:guard` bitta dvigateldan
foydalanadi: `scripts/design-guard.mjs`. U `src/**/*.{ts,tsx}` ni skanerlaydi (testlar, `src/test`, `src/locales`
kirmaydi). Izohlar hisobga olinmaydi.

| Qoida | Nimani sanaydi | O'rniga |
|---|---|---|
| `colour` | hex, `rgb()`/`rgba()`/`hsl()`: className, `bg-[#fff]`, `shadow-[…rgba()]`, style, JS (`themeTokens.ts` dan tashqari) | tokenlar; JS'da `themeTokens.ts` |
| `palette` | `bg-blue-500`, `text-gray-400`, `border-red-200/50`, `bg-white`, `text-white`, `bg-black/65` … | `bg-surface`, `text-text-muted`, `bg-action text-on-solid`, `bg-*-soft text-*-fg`, `bg-overlay` |
| `dark-pair` | `dark:` rang jufti: `dark:bg-slate-800`, `dark:text-white`, `dark:hover:border-…` (`dark:text-sm` kabi o'lcham sanalmaydi) | hech narsa: tokenlar mavzuga o'zi moslashadi |
| `legacy` | `main`, `maindark`, `primary`, `primarydark`, `purple*`, `border-soft`, `card-surface`, `page-surface`, `background(-soft/-deep)`, `dashboard-*`, `table-*`, `glass*`, `warning-start/end/surface/border/text`, `sidebar`, `error`, `surface-elevated`, `surface-dark`, `text-muted-dark` (utilita yoki `--color-*`) | §2 jadvali |
| `money` | `Intl.NumberFormat`, sonning `.toLocaleString()`, qo'lda `so'm` / `сум` / `UZS` (`formatMoney.ts` dan tashqari) | §7 formatlovchilari |
| `icons` | `@ant-design/icons` va boshqa ikonka kutubxonalari | `lucide-react` (§10) |
| `tiny-text` | 12px dan kichik: `text-[10px]`, `text-[11px]`, `fontSize: 10` … | `text-xs` |

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
- **Bitta qator istisnosi:** shu yoki oldingi qatorda `// design-guard-ignore: <sabab>` (JSX'da
  `{/* design-guard-ignore: <sabab> */}`). Sabab majburiy, sababsiz belgi testni yiqitadi.
- Baseline'da bor, lekin o'chirilgan fayl faqat ogohlantirish beradi; `--update` uni olib tashlaydi.
