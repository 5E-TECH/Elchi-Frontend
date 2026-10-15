# Maket → kod xaritasi (CODE-MAP)

Maketlar `design/kit/helmet.html` dagi `el-*` klasslari bilan chizilgan. Bu klasslar **ilovada yo'q** — maketdan
JSX'ga klass nomini ko'chirmang, shu jadval bo'yicha tarjima qiling.

> ⚠️ **Nom to'qnashuvi.** `src/index.css` da maket bilan bir xil prefiksli **eski (v1)** klasslar bor:
> `.el-card` (gradient + katta soya), `.el-card-soft`, `.el-surface-page`, `.el-glass-control`, `.el-segmented`,
> `.el-segmented-button(-active)` (gradient), `.el-muted-text`, `.el-soft-text`. Ular v2 **emas**. Yangi kodda
> `className="el-card"` yozsangiz maketdagi kartani emas, eski gradientli kartani olasiz. Yangi kodda ularni
> ishlatmang va yangi joyga ko'chirmang.

**Tanlash tartibi** (har element uchun):
1. `src/shared/ui/` da **1-bosqich primitivi** (`Button`, `IconButton`, `Badge`/`StatusBadge`, `Card`/`StatCard`,
   `PageHeader`, `Tabs`/`SegmentedControl`, `Dialog`/`ConfirmDialog`, `Field`/`TextInput`/`Select`/`DateRange`,
   `QueryBoundary`) allaqachon bo'lsa, o'shani ishlating. Tailwind'ni qo'lda yozmang.
2. Primitiv hali bo'lmasa, shu jadvaldagi Tailwind klasslarini yozing (faqat tokenlar).
3. «Bugun bor» ustunidagi mavjud komponentni **xatti-harakati uchun** qayta ishlating (fokus tuzog'i, portal,
   pagination mantig'i, skaner). Ularning ko'pchiligining ko'rinishi hali v1 (`bg-main`, `text-maindark`, `bg-white`).
   Tegsangiz, ko'rinishini shu jadval bo'yicha v2 ga keltiring. Eski ko'rinishni yangi joyga nusxalamang.

1-bosqich primitivlari hali yo'q (navbatdagi bosqich). Ungacha qo'lda yozilgan retsept (segment, pastki varaqa,
gauge, bo'sh holat) **shu jadvaldagi klasslar bilan aynan** yoziladi va PR'da «1-bosqichda primitivga
almashtiriladi» deb belgilanadi — har kim o'z variantini o'ylab topmaydi.

Barcha klasslar Tailwind v4 (`@tailwindcss/vite`) va `src/index.css` dagi `@theme` tokenlari bilan tekshirilgan.
Faylingizdagi eski rang/nom/o'lchamlar va ularning v2 o'rnini bosuvchisi: `npm run design:guard -- <fayl>`.

---

## 0. Asoslar

### 0.1 Token → Tailwind

Maketda `var(--surface)`, ilovada esa `var(--color-surface)` (Tailwind `@theme` prefiksi). Klassda prefiks yo'q:

| Maket o'zgaruvchisi | Tailwind klassi | Inline/SVG (`style`, `stroke`, `fill`) |
|---|---|---|
| `--bg` · `--surface` · `--raised` · `--sunken` · `--input` · `--row-hover` | `bg-bg` · `bg-surface` · `bg-raised` · `bg-sunken` · `bg-input` · `hover:bg-row-hover` | `var(--color-surface)` … |
| `--border` · `--border-strong` | `border-border` · `border-border-strong` (`divide-border`, `ring-border`) | `var(--color-border)` |
| `--text` · `--text-muted` · `--text-subtle` | `text-text` · `text-text-muted` · `text-text-subtle` (`placeholder:text-text-subtle`) | `var(--color-text-muted)` |
| `--brand` (logotip, avatar) · `--sidebar` | `bg-brand` / `text-brand` · `bg-nav` (yon menyu, 2-bosqich) | `var(--color-brand)` |
| `--action` · `--action-hover` · `--action-fg` · `--action-soft` · `--on-solid` | `bg-action hover:bg-action-hover text-on-solid` · `text-action-fg` · `bg-action-soft` | `var(--color-action)` |
| `--focus` | `ring-focus` (`focus:ring-3 focus:ring-focus`) | `var(--color-focus)` |
| `--success` / `-fg` / `-soft` (warning, danger, info ham shunday) | `bg-success` · `text-success-fg` · `bg-success-soft` | `var(--color-success)` |
| `--overlay` | `bg-overlay` | `var(--color-overlay)` |
| `--chart-1 … --chart-8`, `--chart-muted` | `bg-chart-1` … `bg-chart-muted` | `var(--color-chart-1)`; JS: `CHART_PALETTE[theme]`, `CHART_MUTED[theme]` |
| `--shadow-1` · `--shadow-2` | `shadow-xs` (segment tanlovi) · `shadow-xl` (dialog, menyu, popover, toast). Ilovada soya tokeni yo'q, bular eng yaqin standart soyalar; `shadow-[…]` yozilmaydi | — |
| `--seq-*`, `--div-*`, `--chart-grid/-axis/-baseline/-total`, `--chart-wash` | **ilovada hali token yo'q.** Vaqtincha: grid/baseline → `border-border`, o'q matni → `text-text-subtle`, jami → `text-text-muted`, ketma-ket shkala trek → `bg-action-soft`, maydon shaffofligi 0.10 / 0.14 | Token kerak bo'lsa — alohida PR: `index.css` + `themeTokens.ts` + test. Qo'lda hex yozilmaydi |

JS (antd, recharts, highcharts, canvas): `themeTokens(theme)`, `SEMANTIC_TOKENS`, `CHART_PALETTE`, `CHART_MUTED`
(`src/shared/config/themeTokens.ts`). Mavzuni `ThemeContext` dan oling. `dark:` jufti **yozilmaydi**, tokenlar o'zi
almashadi.

### 0.2 O'lchamlar

| Maket | Tailwind |
|---|---|
| radius 6 · 8 · 10 · 12 · 14 · 20 · 999 | `rounded-md` · `rounded-lg` · `rounded-[10px]` · `rounded-xl` · `rounded-[14px]` · `rounded-[20px]` · `rounded-full` |
| balandlik 24 · 32 · 36 · 40 · 44 · 48 · 56 · 64 | `h-6` · `h-8` · `h-9` · `h-10` · `h-11` · `h-12` · `h-14` · `h-16` |
| oraliq 4 · 8 · 12 · 16 · 20 · 24 · 32 | `gap-1`/`p-1` · `2` · `3` · `4` · `5` · `6` · `8` |
| `.el-h1` 24/32 (telefon 20/28) · 700 | `text-2xl font-bold tracking-[-.01em] text-text max-md:text-xl` |
| `.el-h2` 16/24 · 700 | `text-base font-bold text-text` |
| `.el-h3` 14/20 · 600 | `text-sm font-semibold text-text` |
| asosiy matn 14 · `.el-small` 13 · `.el-xs` 12 | `text-sm` · `text-[13px]` · `text-xs` (12px dan kichik **yo'q**: `text-[11px]`, `text-[10px]` taqiq) |
| `.el-overline`, jadval sarlavhasi | `text-xs font-semibold uppercase tracking-[.05em] text-text-muted` (jadvalda `tracking-[.04em]`) |
| `.el-muted` · `.el-subtle` · `.el-strong` · `.el-sr` | `text-text-muted` · `text-text-subtle` · `font-semibold text-text` · `sr-only` |
| `.el-divider` | `h-px border-0 bg-border` |
| harakat (`transition .15s`) | `transition-colors duration-150` (`prefers-reduced-motion` uchun `motion-reduce:transition-none`) |
| fokus | `:focus-visible` halqasi `index.css` da global. Maydonlarda: `focus:outline-none focus:border-action focus:ring-3 focus:ring-focus` |

Qalinlik faqat 400/500/600/700 (`font-normal/medium/semibold/bold`). `font-extrabold`, `font-black` yo'q.
Gradient, maxsus soya (`shadow-[…]`), hex/`rgb()`, `bg-blue-500` / `text-gray-400` kabi rang oilalari yo'q.

### 0.3 Moslashuvchanlik: konteyner so'rovlari → Tailwind breakpointlari

Maket `.el` ildizida **container query** ishlatadi (`@container el (max-width:1023px)` va `(max-width:767px)`).
`.el` ildizi butun ilova kengligi bo'lgani uchun ilovada **viewport breakpointlari** aynan teng keladi:
Tailwind `lg` = 1024, `md` = 768.

| Maket | Ilova | Ma'nosi |
|---|---|---|
| `@container el (max-width:1023px)` | `max-lg:` | planshet va telefon (< 1024) |
| `@container el (max-width:767px)` | `max-md:` | faqat telefon (< 768) |
| `.el-hide-tablet` | `max-lg:hidden` | < 1024 da yashirin (jadvalning ikkinchi darajali ustuni: `th` va `td` ikkalasiga) |
| `.el-hide-mobile` | `max-md:hidden` | < 768 da yashirin (jadval, tooltip, kursor chizig'i) |
| `.el-show-mobile` | `hidden max-md:flex` | faqat telefonda (kartalar ro'yxati, qisqa kodlar) |
| `.el-show-tablet` | `hidden max-lg:inline-flex` | < 1024 da (menyu tugmasi) |

`sm:` (640) v2 da telefon chegarasi **emas**. Telefon = `max-md:`. Maket telefonda o'zi qiladigan narsalarni kodda
qo'lda yozasiz:

- tugma, maydon, chip, sahifa raqami: `max-md:min-h-11`; ikonka-tugma `max-md:size-11`; tab `max-md:h-12`;
- `.el-pagehead` amallari to'liq enli: `max-md:w-full max-md:[&>*]:flex-1`;
- har `.el-overlay > .el-dialog` telefonda **pastdan chiquvchi varaqa** (2.8-bo'lim);
- sahifa sarlavhasi 20/28 (`max-md:text-xl`), sahifa oraliqlari 16 (`max-md:gap-4`).

### 0.4 Maket va ilova tokenlari orasidagi ma'lum farq

Ilovaning **tungi** `--color-success/-warning/-danger/-info` qiymati maketdagidan to'qroq (`#0d8f5b`, `#c97900`,
`#d82f48`, `#2563d8`). Sababi: eski kod ularni oq matnli fon sifatida ishlatadi. Holat **matni** uchun doim `*-fg`,
yumshoq fon uchun `*-soft` ishlating. Bu ikkalasi maket bilan bir xil. To'liq rangli tugmalar:

- `bg-success text-on-solid` ikkala mavzuda AA (≥ 4.5:1) beradi;
- `bg-danger text-on-solid` tungi mavzuda ~3.9:1, AA dan past. To'liq qizil tugma faqat tasdiqlash oynasida kerak.
  1-bosqich `Button variant="danger"` kelguncha `danger-soft` ko'rinishini ishlating (2.1-bo'lim) yoki PR'da
  belgilang.

---

## 1. Retseptlar (takrorlanadigan klass to'plamlari)

Quyidagi jadvallarda shu nomlar ishlatiladi:

```text
BTN    = inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border border-transparent
         px-4 text-sm font-semibold transition-colors duration-150
         disabled:cursor-not-allowed disabled:opacity-45 max-md:min-h-11
INPUT  = h-10 w-full rounded-[10px] border border-border-strong bg-input px-3 text-base text-text md:text-sm
         placeholder:text-text-subtle hover:border-text-subtle
         focus:border-action focus:outline-none focus:ring-3 focus:ring-focus
         disabled:cursor-not-allowed disabled:bg-sunken disabled:text-text-subtle
         aria-[invalid=true]:border-danger max-md:min-h-11
CARD   = min-w-0 rounded-[14px] border border-border bg-surface
BADGE  = inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-semibold leading-none
RAISED = rounded-xl border border-border bg-raised shadow-xl          (menyu, variantlar ro'yxati, popover)
```

`INPUT` da telefonda 16px (`text-base md:text-sm`). Bu maketdan farq qiladi va ataylab shunday: iOS Safari 16px dan
kichik maydonga fokus berilganda sahifani kattalashtiradi. `src/test/inputFontGuard.test.ts` `<input>`, `<textarea>`,
`<select>` da prefikssiz `text-xs` / `text-sm` ni yiqitadi.

---

## 2. Komponentlar

### 2.1 Tugmalar

| Maket | Kod (Tailwind v4) | Bugun bor | 1-bosqich |
|---|---|---|---|
| `.el-btn.el-btn-primary` | `BTN bg-action text-on-solid hover:bg-action-hover` (ekranda **bitta**, sarlavhada o'ngda) | `shared/components/button.tsx` (v1 `bg-main`), antd `Button` | `Button variant="primary"` |
| `.el-btn-secondary` | `BTN border-border-strong bg-surface text-text hover:bg-sunken` | — | `Button variant="secondary"` |
| `.el-btn-ghost` | `BTN bg-transparent text-text-muted hover:bg-sunken hover:text-text` | `FilterClearButton.tsx` | `Button variant="ghost"` |
| `.el-btn-link` | `inline-flex items-center gap-1 px-1 text-sm font-semibold text-action-fg hover:underline` | — | `Button variant="link"` |
| `.el-btn-success` | `BTN bg-success text-on-solid hover:brightness-110` | — | `Button variant="success"` |
| `.el-btn-danger` | faqat tasdiqlash oynasida; 0.4-bo'limga qarang | `popupConfirm.tsx`, `ConfirmButton/` | `Button variant="danger"` |
| `.el-btn-danger-soft` | `BTN bg-danger-soft text-danger-fg hover:bg-danger hover:text-on-solid` (jadval, menyu ichida) | — | `Button variant="danger-soft"` |
| `.el-btn-sm` · `.el-btn-lg` · `.el-btn-block` | `h-8 px-3 text-[13px] rounded-lg` · `h-12 px-5 text-[15px] rounded-xl` · `w-full` | — | `size="sm"/"lg"`, `block` |
| `.el-btn.is-loading` | `cursor-progress` + ichida `.el-spinner` (2.10), `aria-busy="true"`, `disabled` | — | `loading` |
| `.el-iconbtn` | `relative inline-flex size-10 items-center justify-center rounded-[10px] border border-transparent text-text-muted transition-colors hover:bg-sunken hover:text-text max-md:size-11`. **`aria-label` majburiy**, ikonka `aria-hidden` | — | `IconButton` |
| `.el-iconbtn-sm` · `.el-iconbtn-lg` · `.el-iconbtn-bordered` | `size-8 rounded-lg` · `size-11 rounded-xl` · `border-border-strong bg-surface` | — | `IconButton size / bordered` |
| `.el-dotcount` (ikonka ustidagi son) | `absolute right-1.5 top-1.5 h-[18px] min-w-[18px] rounded-full bg-danger px-[5px] text-center text-xs font-bold leading-[18px] text-on-solid` (tungi kontrast: 0.4) | `widgets/header` | — |
| `.el-back` | `mb-1 inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-muted hover:text-text max-md:min-h-11` + `ArrowLeft` 16 | `shared/ui/BackButton.tsx` (v1) | `PageHeader back` |

### 2.2 Forma

| Maket | Kod | Bugun bor | 1-bosqich |
|---|---|---|---|
| `.el-field` | `flex min-w-0 flex-col gap-1.5` | `FilterFieldCard.tsx` | `Field` |
| `.el-label` · `.el-req` | `text-[13px] font-semibold text-text` · `text-danger-fg` (`*`) | — | `Field label required` |
| `.el-hint` · `.el-error-text` | `text-xs text-text-muted` · `text-xs font-semibold text-danger-fg` (`id` + maydonda `aria-describedby`, `aria-invalid`) | react-hook-form + yup | `Field hint / error` |
| `.el-input` (+ `.is-invalid`, `:disabled`, `.is-readonly`) | `INPUT`; faqat o'qish: `read-only:bg-sunken` | `PhoneInput.tsx`, `FilterDateInput.tsx`, antd `Input` | `TextInput` |
| `.el-input-lg` | `INPUT h-12 rounded-xl md:text-[15px]` | — | `TextInput size="lg"` |
| `.el-search` (ikonkali qidiruv) | o'ram `relative flex items-center` · ikonka `pointer-events-none absolute left-3 text-text-subtle` (18) · maydon `INPUT pl-10` | `SearchInput/`, `FilterSearch.tsx`, `GlobalSearchInput.tsx` | `TextInput icon` |
| `.el-textarea` | `INPUT h-auto min-h-[88px] resize-y py-2.5` | — | `TextInput multiline` |
| `.el-select` (yopiq holat) · `.el-select-placeholder` | `INPUT flex cursor-pointer items-center justify-between gap-2 text-left` + `ChevronDown` (`text-text-subtle`) · `text-text-subtle` | `Select.tsx`, `SearchableSelect.tsx`, `FilterSelect.tsx`, `FilterMultiSelect.tsx`, `StatusSelect/`, `popupSelect.tsx` | `Select` |
| `.el-options` · `.el-option` (`aria-selected`) · `.el-option-empty` | `RAISED flex max-h-[280px] flex-col gap-0.5 overflow-auto p-1.5` · `flex min-h-9 w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm text-text hover:bg-sunken aria-selected:bg-action-soft aria-selected:font-semibold aria-selected:text-action-fg` · `px-2.5 py-4 text-center text-[13px] text-text-muted` | yuqoridagi selectlar | `Select` |
| `.el-check` · `.el-radio` | `size-[18px] accent-action` (`<input type="checkbox/radio">`) | — | — |
| `.el-choice` · `.el-choice-card` (`.is-selected`) | `flex cursor-pointer items-center gap-2.5 text-sm text-text` · `flex cursor-pointer items-start gap-2.5 rounded-xl border border-border-strong bg-surface px-3.5 py-3 has-[:checked]:border-action has-[:checked]:bg-action-soft` | — | — |
| `.el-switch` (`aria-checked`) | `role="switch"`, 36×20 (`h-5 w-9 rounded-full`), o'chiq `bg-border-strong`, yoqiq `aria-checked:bg-action`; telefonda bosish maydoni ≥ 44px | `shared/ui/Toggle.tsx` (v1 rang, 44×24) | — |
| `.el-filters` | `flex flex-wrap items-end gap-3 [&>*]:flex-[1_1_180px]`. Telefonda: ≤ 2 filtr — qatorda ustma-ust (`max-md:min-h-11`, `manager-returns-list`); ≥ 3 — «Filtrlar» tugmasi + chiplar, pastki varaqa (`superadmin-orders-filters-mobile`). DESIGN_SYSTEM §6 | `FilterPanel.tsx`, `MobileCollapsibleSection.tsx`, `FilterClearButton.tsx` | — |
| `.el-chip` (`aria-pressed`, `.el-chip-active`) | `inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-border-strong bg-surface px-3 text-[13px] font-medium text-text hover:border-text-subtle aria-pressed:border-action aria-pressed:bg-action-soft aria-pressed:font-semibold aria-pressed:text-action-fg max-md:h-11` | — | — |
| `.el-chip-x` | `-mr-1.5 inline-flex size-5 items-center justify-center rounded-full` + telefonda katta bosish maydoni: `max-md:relative max-md:after:absolute max-md:after:-inset-3 max-md:after:content-['']`; `aria-label="… filtrini olib tashlash"` | — | — |
| `.el-cal*` (sana oralig'i paneli: `.el-cal-head`, `.el-cal-grid`, `.el-cal-dow`, `.el-cal-day`), `.el-cal-presets` | `RAISED w-[300px] p-3`; sarlavha `flex items-center justify-between text-sm font-bold`; to'r `grid grid-cols-7 gap-0.5 text-center`; hafta kuni `py-1 text-xs font-semibold text-text-muted`; kun `h-9 rounded-lg text-[13px] text-text hover:bg-sunken` (boshqa oy `text-text-subtle`), oraliq `bg-action-soft`, boshi/oxiri `bg-action text-on-solid font-bold`, bugun `ring-1 ring-inset ring-action`; tayyor davrlar: `Bugun / Bu hafta / Bu oy / Barchasi` | `DateRangePicker.tsx`, `CustomDatePicker.tsx`, `FilterDateRange.tsx`, `QuickDateRangeFilter.tsx`, antd `DatePicker` (`AntdThemeProvider` orqali v2 rangda) | `DateRange` |

### 2.3 Badge va holat

| Maket | Kod | Bugun bor | 1-bosqich |
|---|---|---|---|
| `.el-badge` | `BADGE` | `shared/ui/StatusBadge.tsx` (v1: `text-[11px]`, `rounded-full`, `config/statusColorMap.ts`), `OrderIdBadge.tsx`, `PageStatBadge.tsx`, antd `Tag` | `Badge` |
| `.el-tone-info` · `.el-tone-success` · `.el-tone-warning` · `.el-tone-danger` | `bg-info-soft text-info-fg` · `bg-success-soft text-success-fg` · `bg-warning-soft text-warning-fg` · `bg-danger-soft text-danger-fg` | — | `Badge tone=…` |
| `.el-tone-action` · `.el-tone-neutral` | `bg-action-soft text-action-fg` · `bg-sunken text-text-muted ring-1 ring-inset ring-border` | — | `Badge tone=…` |
| `.el-badge-dot` | `before:size-1.5 before:shrink-0 before:rounded-full before:bg-current before:content-['']` | — | `Badge dot` |
| `.el-badge-outline` | `bg-transparent ring-1 ring-inset ring-current` (masalan «Bekor — jo'natilgan»: danger + outline) | — | `Badge outline` |
| buyurtma holati → ton | Yangi / Yaratilgan / Qabul qilindi → info · Yo'lda / Kutilmoqda / Qisman to'langan → warning · Sotilgan / To'langan → success · Bekor qilingan → danger · Bekor — jo'natilgan → danger + outline · Yopilgan → neutral (`docs/DESIGN_SYSTEM.md` §8) | `StatusBadge` | `StatusBadge` |
| yetkazish turi, «Nofaol» | `BADGE` + neutral (rangsiz) | — | `Badge tone="neutral"` |

### 2.4 Sirtlar va sahifa sarlavhasi

| Maket | Kod | Bugun bor | 1-bosqich |
|---|---|---|---|
| `.el-card` | `CARD` (soya yo'q, gradient yo'q). **Kartaning ichida karta yo'q** — ichki bo'lim `border-t border-border` yoki `bg-sunken rounded-xl` (chegarasiz) | ⚠️ `index.css` dagi eski `.el-card` emas; antd `Card` emas | `Card` |
| `.el-card-head` · `.el-card-pad` · `.el-card-foot` | `flex items-center justify-between gap-3 border-b border-border px-5 py-4` · `p-5` · `flex items-center justify-between gap-3 border-t border-border px-5 py-3` | — | `Card.Header / Body / Footer` |
| `.el-pagehead` | `flex flex-wrap items-end justify-between gap-4 max-md:items-stretch` | `shared/components/headerName.tsx` (v1: ikonka + `text-maindark`) | `PageHeader` |
| `.el-pagehead-text` · `.el-h1` · `.el-sub` | `flex min-w-0 flex-col gap-1` · `<h1>` 0.2-bo'lim · `text-sm text-text-muted` | `config/designSystem.ts` `TYPO.pageTitle` (v1, 18/20px, ishlatmang) | `PageHeader title / description` |
| `.el-actions` | `flex flex-wrap items-center gap-2 max-md:w-full max-md:[&>*]:flex-1` | — | `PageHeader actions` |
| `.el-content` (sahifa ritmi) | sahifa ildizi: `flex flex-col gap-6 max-md:gap-4`. Ichki chekka (padding) shell'da (`widgets/layout/dashboardLayout.tsx`, 2-bosqich), sahifada yozilmaydi | `PageContainer.tsx` | — |
| `.el-grid` | `grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4` | — | — |
| `.el-kv` (atama: qiymat) | `<dl>`: `grid grid-cols-[minmax(120px,40%)_1fr] gap-x-4 gap-y-2.5 text-sm`; `dt` `text-text-muted`; `dd` `m-0 min-w-0 font-semibold text-text` | `Timeline/` (tarix uchun) | — |
| `.el-list` · `.el-list-item` | `flex flex-col` · `flex min-h-14 items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-row-hover` | — | — |
| `.el-sticky-bar` | `sticky bottom-0 flex gap-2 border-t border-border bg-surface px-4 py-3` (telefonda asosiy amal pastda, to'liq enli) | — | — |
| `.el-stat` | `CARD flex flex-col gap-2 p-5` | `shared/ui/MetricCard.tsx` (v1: rangli ton, `bg-slate-200`) | `StatCard` |
| `.el-stat-top` · `.el-stat-label` · `.el-stat-icon` | `flex items-center justify-between gap-2` · `text-[13px] font-semibold text-text-muted` · `inline-flex size-9 items-center justify-center rounded-[10px] bg-sunken text-text-muted` (ikonka **neytral**, rangsiz) | — | `StatCard` |
| `.el-stat-value` · `.el-stat-unit` · `.el-stat-meta` | `text-[28px] leading-9 font-bold tracking-[-.01em] text-text` · `ml-1 text-sm font-semibold tracking-normal text-text-muted` · `flex flex-wrap items-center gap-1.5 text-[13px] text-text-muted` | `formatCompactMoneyLocalized` | `StatCard` |
| `.el-delta-up` · `.el-delta-down` | `font-semibold text-success-fg` · `font-semibold text-danger-fg` (belgi `+` / `−` bilan) | — | — |

### 2.5 Tablar va segmentlar

| Maket | Kod | Bugun bor | 1-bosqich |
|---|---|---|---|
| `.el-tabs` | `role="tablist"`: `flex gap-1 overflow-x-auto border-b border-border scrollbar-hide` (`scrollbar-hide` — `index.css` utiliti) | `pages/orders/create/ui/CreateModeTabs.tsx` (mahalliy), antd `Tabs` | `Tabs` |
| `.el-tab` (`aria-selected`) | `role="tab"`: `group -mb-px inline-flex h-11 items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 text-sm font-semibold text-text-muted hover:text-text aria-selected:border-action aria-selected:text-text max-md:h-12` | — | `Tabs.Tab` |
| `.el-tab-count` | `inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-sunken px-1.5 text-xs font-semibold text-text-muted group-aria-selected:bg-action-soft group-aria-selected:text-action-fg` (sonni `formatNumberLocalized` bilan) | — | `Tabs.Tab count` |
| `.el-seg` | `role="group" aria-label`: `inline-flex gap-0.5 rounded-[10px] border border-border bg-sunken p-[3px]` | ⚠️ `index.css` dagi `.el-segmented*` emas (v1 gradient) | `SegmentedControl` |
| `.el-seg button` (`aria-pressed`) | `h-8 whitespace-nowrap rounded-lg px-3 text-[13px] font-semibold text-text-muted hover:text-text aria-pressed:bg-surface aria-pressed:text-text aria-pressed:shadow-xs max-md:h-11` | `QuickDateRangeFilter.tsx` (davrlar) | `SegmentedControl` |
| `.el-viewtoggle` («Grafik \| Jadval») | `.el-seg` bilan bir xil, tugma `gap-1.5 px-2.5` + ikonka (`ChartArea`, `Table2`) | — | `SegmentedControl` |

### 2.6 Jadval

| Maket | Kod | Bugun bor | 1-bosqich |
|---|---|---|---|
| `.el-table-wrap` | `relative overflow-x-auto` (faqat jadval skroll qiladi, sahifa emas) | `shared/components/Table/Table.tsx` (ustun konfiguratsiyasi, `hideOnMobile`, `mobileRowRender`, `loading` / `error` / `emptyState`; ko'rinishi `Table.module.css` da v1) | — |
| `.el-table` | `w-full border-collapse text-sm` | antd `Table` (yangi kodda emas) | — |
| `.el-table th` | `h-10 whitespace-nowrap border-b border-border bg-sunken px-4 text-left text-xs font-semibold uppercase tracking-[.04em] text-text-muted` | — | — |
| `.el-table td` | `h-14 border-b border-border px-4 py-2 align-middle text-text`; oxirgi qator `[&_tr:last-child_td]:border-b-0` (`<table>` ga) | — | — |
| qator hover · `.is-selected` · `.is-disabled` | `hover:bg-row-hover` · `bg-action-soft` · `text-text-subtle` | — | — |
| `.el-num` | `text-right whitespace-nowrap` (`td`/`th` da `tabular-nums` global) | `formatMoneyLocalized` | — |
| `.el-col-check` | `w-11 pr-0` + `.el-check` | — | — |
| `.el-cell-title` · `.el-cell-sub` | `font-semibold text-text` · `whitespace-nowrap text-[13px] text-text-muted` (masalan `№10241` / `Bugun, 14:15`) | `formatDate.ts` | — |
| `.el-th-sort` (`aria-pressed`) | `<button>`: `inline-flex items-center gap-1 uppercase tracking-[.04em] aria-pressed:text-text` + `ArrowUpDown` / `ArrowDown` 14 | `Table` `sortable` | — |
| `.el-table.is-compact` (grafik egizagi) | `th` `h-9 px-3` · `td` `h-11 px-3 py-1.5` | — | — |
| `.el-pagination` · `.el-pages` | `flex flex-wrap items-center justify-between gap-3 text-[13px] text-text-muted` · `flex gap-1` | `shared/components/pagination/index.tsx` | — |
| `.el-page` (`aria-current`) | `inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-border bg-surface px-2 text-[13px] font-semibold text-text hover:bg-sunken aria-[current=page]:border-action aria-[current=page]:bg-action aria-[current=page]:text-on-solid disabled:opacity-45 max-md:h-11 max-md:min-w-11` | `pagination` | — |
| planshet (768–1023) | jadval 736px ga **sig'ishi shart**: ikkinchi darajali ustunlar `max-lg:hidden` (`th` va `td`), №/nom/holat/summa/amal qoladi | `ColumnConfig.className` | — |
| telefon (< 768) | jadval `max-md:hidden`, o'rniga kartalar ro'yxati `hidden max-md:flex flex-col gap-3`; gorizontal skroll yo'q | `Table` `mobileRowRender` | — |

### 2.7 Holatlar: bo'sh, yuklanish, xato, bildirishnoma

| Maket | Kod | Bugun bor | 1-bosqich |
|---|---|---|---|
| `.el-empty` | `flex flex-col items-center gap-2 px-6 py-12 text-center` | `shared/ui/EmptyState.tsx` (v1: emoji `📭`, `font-black`, `bg-primary`) | `QueryBoundary` (bo'sh holat) |
| `.el-empty-icon` · `.el-empty-title` · `.el-empty-text` | `mb-1 inline-flex size-12 items-center justify-center rounded-full bg-sunken text-text-muted` (lucide ikonka, emoji emas) · `text-base font-bold text-text` · `max-w-[380px] text-sm text-text-muted` | — | `QueryBoundary` |
| xato holati (`tizim-errors`) | `.el-empty` + `bg-danger-soft text-danger-fg` ikonka + «Qayta urinish» (`secondary`) | `QueryErrorState.tsx`, `ErrorBoundaryPage.tsx`, `NotFound.tsx`, `Forbidden.tsx`, `ServerError.tsx` | `QueryBoundary` (xato) |
| `.el-skel` · `.el-skel-line` · `.el-skel-block` · `.el-skel-circle` | `h-3 rounded-md bg-sunken` (`.el-skel` va `.el-skel-line` bir xil) · `rounded-[10px] bg-sunken` · `rounded-full bg-sunken` | `TableSkeleton.tsx` (v1 `bg-white`), `PageLoader.tsx`, `Loader.tsx` | `QueryBoundary` (yuklanish) |
| `.el-shimmer` | `animate-pulse motion-reduce:animate-none` | — | `QueryBoundary` |
| `.el-spinner` · `.el-spinner-lg` | `inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent` · `size-8 border-3` | antd `Spin` (yangi kodda emas) | `Button loading` |
| `.el-topprogress` · `.el-progress` · `.el-bar` | `h-[3px] overflow-hidden bg-action-soft` > `block h-full bg-action` · `h-2 overflow-hidden rounded-full bg-sunken` > `block h-full rounded-full bg-action` (eni `style={{ width: '62%' }}`) | — | — |
| `.el-alert` + ton | `flex items-start gap-3 rounded-xl px-4 py-3 text-sm` + `bg-warning-soft text-warning-fg` (va h.k.); `role="status"` yoki `"alert"`; `.el-alert-title` `font-bold`, `.el-alert-body` `min-w-0 text-text` | antd `Alert` (yangi kodda emas) | — |
| `.el-banner` | `flex items-center gap-3 border-b border-border px-8 py-2.5 text-sm` + ton (`max-lg:px-4`) | — | — |
| `.el-toast` | o'zingiz chizmang: `useAppNotification()` (`app/providers/notification/NotificationProvider.tsx`, antd notification v2 tokenlarda) | `NotificationProvider` | — |

### 2.8 Dialog, varaqa, menyu, tooltip

| Maket | Kod | Bugun bor | 1-bosqich |
|---|---|---|---|
| `.el-overlay` | `fixed inset-0 z-[9998] flex items-center justify-center bg-overlay p-6 max-md:items-end max-md:p-0` | `shared/ui/Popup.tsx`: portal, `useFocusTrap`, Escape, `#root` `inert` (xatti-harakati to'g'ri). Foni v1 (`bg-black/65 backdrop-blur-md`), telefonda markazda qoladi | `Dialog` |
| `.el-dialog` | `role="dialog" aria-modal="true" aria-labelledby`: `flex w-full max-w-[480px] flex-col gap-4 rounded-[20px] border border-border bg-raised p-6 shadow-xl` (keng forma `max-w-[640px]`) | `FormPopup/`, `popupUpdate.tsx` | `Dialog` |
| `.el-dialog` telefonda = **pastki varaqa** | `max-md:max-h-[92dvh] max-md:max-w-full max-md:overflow-auto max-md:rounded-b-none max-md:px-4 max-md:pb-6 max-md:pt-5` (overlay `max-md:items-end` bilan) | — | `Dialog` (avtomatik) |
| `.el-dialog-head` · `.el-dialog-foot` | `flex items-start gap-3` · `flex flex-wrap justify-end gap-2 max-md:[&>*]:flex-1` | — | `Dialog.Header / Footer` |
| `.el-sheet` · `.el-sheet-grip` | `fixed inset-x-0 bottom-0 flex flex-col gap-4 rounded-t-[20px] border border-border bg-raised px-4 pb-6 pt-2 shadow-xl` · `mx-auto mt-1 h-1 w-10 rounded-full bg-border-strong` | — | `Dialog` (telefon) |
| tasdiqlash (pul o'tkazish, nofaol qilish, «Kunni yakunlash») | `.el-dialog` + izoh + `secondary` «Bekor qilish» + xavfli amal (0.4) | `popupConfirm.tsx`, `ConfirmButton/` | `ConfirmDialog` |
| `.el-menu` · `.el-menu-item` · `.el-menu-item-danger` | `RAISED flex min-w-[200px] flex-col gap-0.5 p-1.5` · `flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-text hover:bg-sunken [&>svg]:text-text-muted` · `text-danger-fg hover:bg-danger-soft [&>svg]:text-danger-fg` | antd `Dropdown` | — |
| `.el-menu-sep` · `.el-menu-label` | `mx-1.5 my-1 h-px bg-border` · `px-2.5 pb-0.5 pt-1.5 text-xs font-semibold text-text-muted` | — | — |
| `.el-tooltip` | `max-w-[240px] rounded-lg bg-text px-2.5 py-1.5 text-xs font-semibold leading-[1.4] text-bg shadow-xl` (teskari ranglar) | antd `Tooltip` | — |
| `.el-popover` | `flex w-80 flex-col gap-3 rounded-[14px] border border-border bg-raised p-4 shadow-xl` | — | — |
| `.el-kbd` | `inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-md border border-border-strong bg-sunken px-1.5 text-xs font-semibold text-text-muted` | — | — |

Yangi dialog yozsangiz va 1-bosqich `Dialog` hali bo'lmasa: overlay va panelni shu jadval bo'yicha o'zingiz quring,
`useFocusTrap` (`src/shared/lib/useFocusTrap.ts`, `onEscape`, `inertAppRoot`) va `createPortal` dan foydalaning.
`Popup` ichidagi panel telefonda pastga yopisha olmaydi (o'ram `translate` qilingan).

### 2.9 Grafiklar (`tizim-charts` taxtasi, oltin sahifa `superadmin-dashboard-main`)

Maket grafiklarni HTML/SVG bilan chizgan. Kodda **recharts** (yoki xarita uchun mavjud highcharts) ishlatiladi,
lekin ko'rinish maketdagidek bo'ladi: ranglar `CHART_PALETTE[theme]` tartibida (aylantirilmaydi, 9-seriya «Boshqa»
`CHART_MUTED`), chiziq 2px, ustun ≤ 24px (`maxBarSize={24}`, `radius={[4,4,0,0]}`), faqat gorizontal grid
(`vertical={false}`, `stroke="var(--color-border)"`), o'q matni 12px `var(--color-text-subtle)`, ikki o'qli grafik
yo'q, har grafikda «Grafik | Jadval» egizagi, matn hech qachon seriya rangida emas.

| Maket | Kod | Bugun bor | 1-bosqich |
|---|---|---|---|
| `.el-chart` (`.el-card.el-chart`) | `CARD flex flex-col gap-4 p-5 max-md:gap-3.5 max-md:p-4` (karta ichida yana karta yo'q) | — | `Card` |
| `.el-chart-head` · `.el-chart-titles` · `.el-chart-title` · `.el-chart-sub` | `flex flex-wrap items-start justify-between gap-x-4 gap-y-3` · `flex min-w-0 flex-[1_1_200px] flex-col gap-0.5` · `text-base font-bold text-text` · `text-[13px] text-text-muted` | — | — |
| `.el-chart-controls` | `flex flex-wrap items-center gap-2 max-md:w-full max-md:[&>*]:flex-auto` (telefonda segment tugmalari 44px) | — | `SegmentedControl` |
| `.el-chart-foot` · `.el-chart-note` | `flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4` · `flex items-start gap-2 text-xs text-text-subtle` | — | — |
| `.el-legend` · `.el-legend-item` · `.el-legend-key` | `flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-text-muted` · `inline-flex items-center gap-2 whitespace-nowrap` · `size-2.5 rounded-[3px]` (chiziq: `h-0.5 w-4 rounded-full`), rang `style={{ background: palette[i] }}` | — | — |
| `.el-plot` (maydon/chiziq), `.el-crosshair`, `.el-tip*`, `.el-dot`, `.el-endlabel`, `.el-gridline`, `.el-axis-x/-y`, `.el-hit` | recharts `AreaChart`/`LineChart`: balandlik 300 (telefon 160–180), joriy `CHART_PALETTE[0]`, oldingi `CHART_MUTED`, maydon `fillOpacity` 0.10 (tungi 0.14); tooltip = `RAISED` karta (avval qiymat, keyin yorliq); oxirgi qiymat yorlig'i; telefonda kursor/tooltip `max-md:hidden`, oraliq o'q yorliqlari yashirin | `widgets/dashboard-performance-chart/ui/PerformanceChart.tsx`, `widgets/financial-analysis/ui/FinancialAnalysis.tsx` | — |
| `.el-kpi-row` | `grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-md:gap-3` | `pages/branch-dashboard/ui/BranchDashboardCards.tsx` | — |
| `.el-kpi` | `CARD flex flex-col gap-1.5 px-5 py-4 max-md:gap-1 max-md:px-4 max-md:py-3.5` | `MetricCard.tsx` (v1) | `StatCard` |
| `.el-kpi-top` · `.el-kpi-label` | `flex min-h-9 items-center justify-between gap-2 max-md:min-h-0` (ikonka `max-md:hidden`) · `min-w-0 text-[13px] font-semibold text-text-muted` | — | `StatCard` |
| `.el-kpi-value` · `.el-kpi-unit` · `.el-kpi-meta` | `whitespace-nowrap text-[28px] leading-9 font-bold tracking-[-.01em] text-text proportional-nums max-md:text-[22px] max-md:leading-[30px]` · `ml-1 text-sm font-semibold tracking-normal text-text-muted max-md:text-[13px]` · `flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted` | `formatCompactMoneyLocalized` | `StatCard` |
| `.el-delta` (`.is-up/.is-down` × `.is-good/.is-bad`) | `inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-md bg-sunken px-1.5 text-xs font-bold text-text-muted`; yaxshi `bg-success-soft text-success-fg`, yomon `bg-danger-soft text-danger-fg`; `TrendingUp` ikonka, pastga `-scale-y-100`. Rang = yo'nalish × yaxshi/yomon | — | `StatCard delta` |
| `.el-spark` (`.is-inline`) | `relative h-10 max-md:h-8` (jadvalda `inline-block h-6 w-24`), SVG `stroke="var(--color-chart-1)"`, o'tmish `var(--color-chart-muted)` | — | — |
| `.el-gauge` (`.is-success/-warning/-danger`) | qat'iy 312×176 SVG, zona ≥ 70 success / 40–70 warning / < 40 danger. Kit o'zgaruvchilari zonaga qarab: `--gauge-c` → `var(--color-{success\|warning\|danger})`, `--gauge-soft` → `var(--color-{…}-soft)` (trek = soft, yoy = asosiy); tashqi zona yoylari (danger/warning/success) — o'sha tokenlar, `strokeOpacity={0.55}`; strelka `fill="var(--color-text)"`, markaz doirasi `stroke="var(--color-surface)" strokeWidth={2}`; foiz `formatPercentLocalized` (`67,4%`); qiymat `text-[40px] leading-[44px] font-bold tracking-[-.02em] text-text proportional-nums max-md:text-4xl`; yonida holat `Badge` (ikonka + so'z); `role="img" aria-label` | `widgets/dashboard-statistics/ui/SuccessGauge.tsx` | — |
| `.el-donut` (`.is-side`), `.el-donut-ring`, `.el-donut-total`, `.el-donut-center`, `.el-donut-label`, `.el-legend-list`, `.el-legend-row`, `.el-legend-name`, `.el-legend-value`, `.el-legend-pct` | ≤ 6 bo'lak, 2px bo'shliq, 12 dan boshlanadi; halqa `size-[184px]` (kichik `size-[120px]`); markazda `text-[32px] leading-9 font-bold text-text`; legenda qatori `grid grid-cols-[12px_minmax(0,1fr)_auto_52px] items-center gap-2.5 min-h-10 border-t border-border py-1.5 text-sm first:border-t-0` (legenda = jadval egizagi); `.is-side` telefonda ustma-ust | `widgets/dashboard-statistics/ui/OrderStatusDonut.tsx` | — |
| `.el-rank` · `.el-rank-row` | `<ol>` `flex flex-col` · `grid grid-cols-[24px_32px_minmax(0,1fr)_auto] items-center gap-x-3 border-t border-border py-2.5 first:border-t-0 max-md:grid-cols-[24px_minmax(0,1fr)_auto]` | `widgets/dashboard-top-performers/ui/TopPerformers.tsx` | — |
| `.el-rank-pos` · `.el-rank-avatar` · `.el-rank-name` · `.el-rank-value` · `.el-rank-sub` | `inline-flex size-6 items-center justify-center rounded-full bg-sunken text-xs font-bold text-text-muted` · `size-8 rounded-full bg-sunken text-xs font-bold text-text-muted ring-1 ring-inset ring-border max-md:hidden` · `truncate text-sm font-semibold text-text` · `text-sm font-bold text-text` · `text-xs text-text-muted` | — | — |
| `.el-meter` (`.is-thin/.is-thick`, holat) · `.el-ring` | `--meter-track` → `bg-action-soft`, `--meter-c` → `bg-chart-1`: trek `h-2 rounded-full bg-action-soft` (`h-1.5` / `h-3`) > `block h-full rounded-full bg-chart-1`; holat (`.is-success/-warning/-danger`): trek `bg-*-soft` > to'ldirish `bg-*` (masalan `bg-success-soft` > `bg-success`); qiymat foizi `formatPercentLocalized`; maqsad chizig'i `absolute -inset-y-1 w-0.5 bg-text` · halqa 56/72px SVG | — | — |
| `.el-hbars` · `.el-bars` · `.el-segbar` · `.el-waterfall` · `.el-funnel` | recharts `BarChart` (ustun ≤ 24px, 4px yumaloq uch, 2px oraliq stack) / CSS chiziqlar; segbar `flex h-3 gap-0.5` (bo'laklar `min-w-1`, chetlari `rounded-[4px]`) | `FinancialAnalysis.tsx` | — |
| `.el-heat` · `.el-tilemap` · `.el-seq-0…5` | ketma-ket bitta ko'k shkala (`--seq-*` ilovada yo'q, 0.1-bo'lim); hudud xaritasi uchun mavjud `--color-region-map-*`; kataklarda son yo'q, yonida jadval / reyting | `pages/region/ui/UzbekistanRegionMap.tsx` (highcharts), `widgets/dashboard-region` | — |
| `.el-chart-loading` · `.el-chart-empty` · `.el-chart.is-refetch` | skelet ustunlar `bg-border animate-pulse` · `flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl bg-sunken p-6 text-center` · qayta yuklashda eski grafik `opacity-45` (skelet emas) | — | `QueryBoundary` |

#### Grafik ichki qismlari

Bu qismlarni odatda recharts o'zi chizadi. Qo'lda (CSS/SVG) chizilsa, shu klasslar ishlatiladi. Maketdagi
`--chart-axis` → `text-text-subtle`, `--chart-baseline` → `border-border` (0.1-bo'lim).

| Maket | Kod |
|---|---|
| `.el-chart-figure` · `.el-plot-area` · `.el-plot-end` · `.el-axis-y` | `<figure className="m-0 min-w-0">` · `relative min-w-0` + balandlik (300, telefonda 160) · oxirgi qiymat ustuni `relative min-w-16 max-md:min-w-14` · Y o'qi `relative min-w-9`, yorliqlar `text-xs text-text-subtle tabular-nums` (telefonda oraliq yorliqlar yashirin) |
| `.el-wash` | maydon to'ldirishi: `fillOpacity` 0.10 (tungi 0.14) |
| `.el-tip-title` · `.el-tip-row` · `.el-tip-key` (`.is-box`) · `.el-tip-value` · `.el-tip-label` · `.el-tip-sep` | `whitespace-nowrap text-xs font-semibold text-text-muted` · `flex items-center gap-2 whitespace-nowrap` · `h-0.5 w-3 rounded-full` (quti: `size-2.5 rounded-[3px]`), rang `style` orqali · `font-bold text-text` · `text-text-muted` · `h-px bg-border` |
| `.el-gauge-dial` · `.el-gauge-tick` · `.el-gauge-readout` · `.el-gauge-value` · `.el-gauge-label` | `relative h-[176px] w-[312px] flex-none` · `absolute -translate-x-1/2 -translate-y-1/2 text-xs font-semibold text-text-subtle tabular-nums` · `flex flex-col items-center gap-1.5 text-center` · 2.9 jadvalidagi qiymat (`.is-sm`: `text-[28px] leading-8`) · `text-[13px] leading-[18px] text-text-muted` |
| `.el-gauge-foot` · `.el-gauge-stat` · `.el-gauge-stat-icon` · `.el-gauge-stat-body` · `.el-gauge-stat-value` · `.el-gauge-stat-label` | `mt-2 grid w-full grid-cols-2 gap-3 border-t border-border pt-4` · `flex min-w-0 items-center gap-2.5` · `inline-flex size-8 flex-none items-center justify-center rounded-full` + ton (`bg-success-soft text-success-fg` …) · `flex min-w-0 flex-col` · `whitespace-nowrap text-base font-bold text-text` · `truncate text-xs text-text-muted` |
| `.el-donut-center` · `.el-donut-label` | `pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-center` · `max-w-[110px] text-xs font-semibold text-text-muted` |
| `.el-bars-col` · `.el-bars-bar` · `.el-bars-stack` · `.el-bars-value` · `.el-bars-labels` | `relative flex h-full min-w-0 flex-1 flex-col items-center justify-end` · `block w-full max-w-6 rounded-t-[4px]` + rang · `flex w-full max-w-6 flex-col-reverse gap-0.5` (yuqori bo'lak `rounded-t-[4px]`) · `mb-1 whitespace-nowrap text-xs font-semibold text-text` · `flex min-w-0 gap-1`, yorliq `min-w-0 flex-1 whitespace-nowrap text-center text-xs text-text-subtle` (joriy: `font-semibold text-text`) |
| `.el-hbar` · `.el-hbar-label` · `.el-hbar-track` · `.el-hbar-fill` · `.el-hbar-value` · `.el-hbar-sub` | `grid min-h-6 grid-cols-[minmax(80px,32%)_minmax(0,1fr)] items-center gap-3 text-[13px]` · `truncate text-text` · `flex min-w-0 items-center gap-2` · `block h-4 flex-none rounded-r-[4px]` + rang (eni `style`) · `whitespace-nowrap font-semibold text-text` · `font-normal text-text-muted` |
| `.el-rank-main` · `.el-rank-end` | `flex min-w-0 flex-col gap-1.5` · `flex min-w-16 flex-col items-end` |
| `.el-meter-target` · `.el-ring-label` | maqsad chizig'i (2.9 jadvali, `.el-meter`) · `absolute inset-0 flex items-center justify-center text-[13px] font-bold text-text proportional-nums` |
| `.el-seq-0` · `.el-seq-1` … `.el-seq-5` · `.el-heat-cell` · `.el-heat-label` · `.el-heat-scale` · `.el-heat-steps` | ketma-ket shkala: ilovada `--seq-*` tokeni yo'q (0.1). `seq-0` = `bg-sunken text-text-subtle`. Katak `flex min-h-6 min-w-0 items-center justify-center rounded-[4px] text-xs font-semibold`; yorliq `flex min-w-0 items-center whitespace-nowrap text-xs text-text-subtle`; shkala izohi `flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-text-muted`, qadamlar `flex gap-0.5`, har biri `h-2.5 w-7 rounded-[2px]` |
| `.el-tile` · `.el-tile-name` · `.el-tile-value` | `flex min-h-[72px] min-w-0 flex-col justify-between gap-0.5 rounded-lg px-2 py-1.5 max-md:min-h-12` · `text-xs font-semibold leading-[14px] [overflow-wrap:anywhere]` · `text-sm font-bold proportional-nums` |
| `.el-wf-col` · `.el-wf-bar` (`.is-up/.is-down/.is-total`) · `.el-wf-value` · `.el-wf-link` · `.el-wf-labels` | sharshara: recharts `BarChart` (stack + shaffof asos) yoki CSS: ustun `relative h-full min-w-0`, bar `absolute left-1/2 -ml-3 w-6 rounded-[4px]`; o'sish/kamayish ranglari uchun `--div-*` tokeni ilovada yo'q (0.1), jami `bg-text-muted`; qiymat `text-xs font-bold text-text`; bog'lovchi `border-t border-border`; yorliqlar `grid auto-cols-fr grid-flow-col gap-1 text-center text-xs text-text-muted` |
| `.el-funnel-step` · `.el-funnel-label` · `.el-funnel-track` · `.el-funnel-bar` · `.el-funnel-value` · `.el-funnel-conv` | `grid min-h-9 grid-cols-[minmax(96px,30%)_minmax(0,1fr)_72px] items-center gap-3 max-md:grid-cols-[minmax(80px,32%)_minmax(0,1fr)_56px] max-md:gap-2` · `truncate text-[13px] text-text` · `flex min-w-0 justify-center` · `block h-7 rounded-[4px]` + rang (eni `style`) · `whitespace-nowrap text-right text-[13px] font-bold text-text` · o'tish foizi qatori (shu grid, 2-ustunda `inline-flex items-center gap-1 text-xs text-text-muted`, `min-h-[22px]`) |

### 2.10 Shell va telefon navigatsiyasi (2-bosqich, sahifada qayta chizilmaydi)

| Maket | Ilovadagi joyi |
|---|---|
| `.el-app`, `.el-main`, `.el-content` | `widgets/layout/dashboardLayout.tsx`, `widgets/layout/rootLayout.tsx` |
| `.el-sidebar`, `.el-brand`, `.el-nav`, `.el-nav-group`, `.el-nav-item`, `.el-nav-count` | `widgets/Sidebar/ui/Sidebar.tsx`, `SidebarItem.tsx`, menyu `widgets/Sidebar/model/menuConfig.tsx` (fon `bg-nav`) |
| `.el-topbar`, `.el-topbar-spacer`, `.el-search` (topbar), `.el-user`, `.el-user-text`, `.el-user-name`, `.el-user-role`, `.el-avatar` | `widgets/header` (planshetda `.el-user-text` va qidiruv yashirin: `max-lg:hidden`) |
| `.el-bottomnav`, `.el-bn-label`, `.el-bn-scan`, `.el-bn-fab` | `widgets/Sidebar/ui/BottomNav.tsx`, `MobileMenu.tsx`: 5 katak, yorliq bir qatorda (12px/600, ellipsis, ≤ 70px), skaner rollarida markazda 52px «Skaner». Sahifa fragmentiga chizilmaydi |
| `.el-mtop`, `.el-mtitle` | shell'siz `screen` ekranlarning (masalan skaner natijasi `/scan/:token`) telefondagi yuqori paneli: `hidden max-md:flex h-14 items-center gap-2 border-b border-border bg-surface pl-4 pr-2`, sarlavha `min-w-0 flex-1 truncate text-[17px] font-bold` |
| `.el-phone`, `.el-mbody`, `.el-mnav`, `.el-mobilebar` | eski `phone` turi (endi faqat taxtalarda). Kodda bu oddiy sahifaning telefon (< 768) ko'rinishi |

Shell'ga tegadigan o'zgarish 2-bosqich PR'i orqali qilinadi. Sahifa ichida yon menyu yoki pastki menyu yasalmaydi.

### 2.11 Kamera skaneri (`.el-cam*`, taxta `tizim-scanner`)

| Maket | Kod | Bugun bor |
|---|---|---|
| `.el-cam` (kamera yuzasi **har doim tungi**) | ildizga `className="dark"`: ichidagi barcha tokenlar tungi bo'ladi (`.el-theme-dark` ekvivalenti). Maketdagi `--cam-*` ranglari tungi tokenlar va shaffoflik bilan beriladi: shisha `bg-bg/60`, panel `bg-bg/95`, chiziq `border-text/20`, yordamchi matn `text-text/75`, qorong'i parda `bg-overlay`, urg'u `bg-action`, natija ranglari `success-fg` / `warning-fg` / `danger-fg` / `info-fg`, ular ustidagi matn `text-on-solid`. Hex yozilmaydi | `shared/components/ScannerCameraModal.tsx`, `ScanFeedbackOverlay.tsx`, `ScannerActionButton.tsx` |
| qatlamlar | tasvir 0 · ramka 1 · holat/maslahat/toast/karta 2 · yuqori panel + pastki panel 3 · varaqa foni 4 · varaqa 5 (`z-0 … z-50` emas, shu tartib) | — |
| `.el-cam-top`, `.el-cam-btn` | 48px yumaloq shisha tugmalar, markazda sarlavha (`text-base font-bold`) va kontekst (`text-[13px]`), `aria-label` majburiy | — |
| `.el-cam-finder`, `.el-cam-corner`, `.el-cam-line`, `.el-cam-mark` | ramka 280px (telefonda 248), radius 24, burchak 56px / 5px; natija: `is-success/-error/-warning/-info` (ramka va belgi rangi + ikonka) | `useCameraQrScanner.ts`, `useOrderQrScanner.ts`, `useScannerGate.ts` |
| `.el-cam-status`, `.el-cam-chip`, `.el-cam-hint` | yuqorida holat chipi (32px), ramka ostida maslahat (pill) | — |
| `.el-cam-toasts`, `.el-cam-toast*` | pastda natija xabari (`aria-live`), ton = natija | — |
| `.el-cam-bottom`, `.el-cam-meter`, `.el-cam-count*`, `.el-cam-last*`, `.el-cam-actions` | pastki panel: hisoblagich (28px qiymat), oxirgi skanerlangan, amallar (`flex-1`) | — |
| `.el-cam-sheet*`, `.el-cam-backdrop` | kamera ichidagi «skanerlanganlar» varaqasi | — |
| `.el-cam-card*`, `.el-cam-steps`, `.el-cam-step-n` | ruxsat so'rash / ruxsat yo'q / kamera band — markazdagi karta | — |
| `.el-cam-screen`, `.el-cam-split`, `.el-cam-side`, `.el-cam-dialog`, `.el-overlay-cam` | desktop: kamera + yon panel 380px; dialog 1080×680, yon panel 360; planshet: ustma-ust; telefon: faqat kamera, to'liq ekran | `widgets/layout/scanLayout.tsx`, `pages/scan` |
| `.el-cam-heading`, `.el-cam-title`, `.el-cam-context`, `.el-cam-tools` | yuqori panel: markaziy sarlavha bloki (`min-w-0 flex-1 text-center`, sarlavha `truncate text-base font-bold`, kontekst `truncate text-[13px] text-text/75`), o'ngda asboblar (`ml-auto flex gap-2`: chiroq, kamera almashtirish) | `ScannerCameraModal.tsx` |
| `.el-cam-stage`, `.el-cam-feed` (`is-dim/-torch/-blur/-paused/-off`) | sahna `relative min-h-0 flex-1`; tasvir = haqiqiy `<video>` (`absolute inset-0 object-cover`). Maketdagi fon rasmi va filtrlar faqat taxta uchun; pauza/ruxsat yo'q holatida tasvir ustiga `bg-overlay` | `useCameraQrScanner.ts` |
| `.el-cam-toast-icon`, `.el-cam-toast-body`, `.el-cam-toast-title`, `.el-cam-toast-text` | `size-9 rounded-full` natija rangida (`bg-success-fg text-on-solid` …) · `min-w-0 flex-1 flex flex-col` · `text-sm font-bold` · `text-[13px] text-text/75` | `ScanFeedbackOverlay.tsx` |
| `.el-cam-count-n`, `.el-cam-count-of`, `.el-cam-meter-label`, `.el-cam-last-icon`, `.el-cam-last-body`, `.el-cam-last-title`, `.el-cam-last-sub` | hisoblagich `text-[28px] leading-8 font-bold` + `/ jami` `text-base font-semibold text-text/75`; yorliq `min-w-0 flex-1 text-[13px] text-text/75`; oxirgi skan: ikonka `size-8 rounded-full` (natija rangida), sarlavha `truncate text-sm font-semibold`, izoh `truncate text-[13px] text-text/75` | `ScannerCameraModal.tsx` |
| `.el-cam-sheet-head`, `.el-cam-sheet-body`, `.el-cam-sheet-foot` | `flex items-center gap-3 border-b border-border py-2 pl-4 pr-2` · `min-h-0 flex-1 overflow-auto` · `flex gap-2 border-t border-border px-4 pb-5 pt-3 [&>*]:flex-1` | — |
| `.el-cam-card-icon`, `.el-cam-card-title`, `.el-cam-card-text`, `.el-cam-card-actions` | `size-14 rounded-full` (xato `bg-danger-soft text-danger-fg`, ogohlantirish `bg-warning-soft text-warning-fg`) · `text-lg font-bold` · `text-sm text-text/75` · `mt-1 flex w-full flex-col gap-2` | — |
| `.el-cam-pin`, `.el-cam-code`, `.el-device`, `.el-state-label`, `.el-code` | faqat taxta (doska) yordamchilari, kodga o'tmaydi | — |

`useKeyboardScanner` (USB skaner) va kamera bir xil natija oqimini beradi. Holatlarni `tizim-scanner` taxtasidagi
tartibda qiling.

---

## 3. Mavzu va taxtalar

| Maket | Kod |
|---|---|
| `.el` (kunduzgi) · `.el.dark` (tungi) | `<html class="light|dark">` (`app/providers/theme/ThemeContext.tsx`). Tekshirish: Sozlamalar sahifasida tungi mavzuni tanlang yoki konsolda `localStorage.setItem('theme','dark'); localStorage.setItem('theme-version','2')`, keyin sahifani yangilang (`theme-version` siz `theme` e'tiborga olinmaydi) |
| `.el-theme-dark` (bir qismni majburan tungi) | o'ramga `className="dark"` |
| `.el-theme-light` | ilovada ekvivalenti yo'q (kerak bo'lmagan) |

Taxtalar (`tizim-*`): `Main` (dizayn tizimi, ranglar), `tizim-icons` (`design/icon-registry.json`),
`tizim-states-buttons` / `-forms` / `-navigation` / `-data` (har holat: hover, fokus, disabled, xato),
`tizim-loading`, `tizim-feedback`, `tizim-errors`, `tizim-motion`, `tizim-responsive`, `tizim-scanner`, `tizim-charts`.
Biror element holati (hover, fokus, xato) savol tug'dirsa, avval shu taxtalarni oching.

---

Bu fayl maket bilan birga yangilanadi: `design/kit/helmet.html` ga yangi klass qo'shilsa yoki 1-bosqich primitivi
paydo bo'lsa, shu jadvalni ham yangilang (xuddi shu PR'da).
