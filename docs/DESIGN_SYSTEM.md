# Elchi CRM — Dizayn tizimi v2

> Holat: **0-bosqich** (tokenlar, mavzu, shrift, valyuta). Komponentlar (1-bosqich), shell (2), forma/dialog (3),
> sahifalar migratsiyasi (4) va qo'riqchilar (5) keyingi PR'larda. Trello: «Dizayn v2» kartalari.

Bu hujjat — yangi UI yozayotgan har bir frontchi va AI agent uchun **majburiy** qoidalar. Qisqa versiyasi
`AGENTS.md` da. Barcha ekranlarning tasdiqlangan chizmalari (desktop / planshet / telefon × kunduzgi / tungi)
egada: Claude Design kanvasi «Elchi CRM dizayn v2» (havolani Shodiyordan so'rang).

## 1. Qulflangan qarorlar (ega, 2026-10-09)

| Qaror | Qiymat |
|---|---|
| Brend | navy `#1f2853` + ko'k action (`#2b50d8` kunduzgi / `#8ea6ff` tungi) |
| Sukut mavzusi | **Kunduzgi (light)** — tungi faqat foydalanuvchi tanlasa |
| Shrift | **Manrope** (400/500/600/700) |
| Valyuta | uz `so'm` · ru `сум` · en `UZS`; ixcham `mln/ming/mlrd` · `млн/тыс./млрд` · `M/K/B` |
| Ikonkalar | faqat `lucide-react` |

Eski to'rt brend (`#576adb`, `#7c3aed`, antd `#6366f1`, `#7c5cff`) va binafsha tungi mavzu **olib tashlangan** —
`src/test/paletteGuard.test.ts` ularning qaytishiga yo'l qo'ymaydi.

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
- Yangi kodda **hex, `rgb()`, Tailwind rang oilalari (`bg-blue-500`, `text-gray-400` …) yozilmaydi** — faqat tokenlar.
  `dark:` juftlari ham kerak emas: tokenlar mavzuga o'zi moslashadi.

### Eski nomlar (alias — yangi kodda ishlatilmaydi)
Sahifalar 4-bosqichda ko'chiriladi; hozircha eski nomlar yangi tokenlarga ishora qiladi:
`main → action` (tungida `#5574ee`: oq yozuvli fon ham, yuzadagi matn ham ~4.1:1),
`maindark → brand` (tungida `surface`), `primarydark → action-hover`, `sidebar → bg`, `border-soft → border`,
`page-surface → surface`, `card-surface → row-hover`, `purple* → action*`, `error → danger`,
`surface-elevated → raised`, `dark-bg-py → bg`, hudud xaritasi yashil shkalasi → bitta ko'k ketma-ket shkala.

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

## 7. Format qoidalari

Pul va sonlar **faqat** `src/shared/lib/formatMoney.ts` orqali:

```ts
formatMoneyLocalized(185000)            // uz "185 000 so'm" · ru "185 000 сум" · en "185,000 UZS"
formatCompactMoneyLocalized(48_600_000) // uz "48,6 mln so'm" · ru "48,6 млн сум" · en "48.6M UZS"
formatNumberLocalized(1545000)          // uz "1 545 000" · en "1,545,000"
```

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
sinonimlarning o'rnini bosuvchilari — `docs/design/icon-registry.json` (132 ikonka, 12 guruh).

## 11. Bosqichlar va PR qoidasi

0 tokenlar/mavzu/shrift/valyuta → 1 primitivlar (`Button`, `IconButton`, `Badge/StatusBadge`, `Card/StatCard`,
`PageHeader`, `Tabs/SegmentedControl`, formatlovchilar) → 2 shell → 3 forma/dialog/holatlar → 4 sahifalar
(har sahifa alohida PR) → 5 qo'riqchilar (ESLint, palitra testi, vizual snapshotlar).

Har PR: faqat tokenlar · `PageHeader` · bitta asosiy amal · `StatusBadge` · formatlovchilar · 2 qavatdan ko'p
karta yo'q · kunduzgi / tungi / 390px skrinshot · to'liq `npm test` + `npm run build` yashil.
