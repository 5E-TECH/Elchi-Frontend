# Elchi UI v2 — mockup kit and rules

You are drawing a **high-fidelity mockup** of one screen of **Elchi CRM** (admin.elchipochta.uz), a delivery/logistics
CRM used in Uzbekistan by superadmins, branch managers, market operators and couriers. The owner approved this new
design direction and will review the mockups before any code is written. Every screen must look like ONE product.

Canvas root (cwd for all commands): the folder that contains this `kit/` folder.
Real source code (read-only, origin/main): `../fe-main/src/` relative to the canvas root.
Golden reference page (study it first, copy its patterns): `kit/fragments/Buyurtmalar.html` + rendered
`shots/Buyurtmalar-light.png`, `shots/Buyurtmalar-dark.png`, `shots/Buyurtmalar-mobile.png`.

## Files you write (ONLY these, ONLY for your stem)

- `kit/fragments/<Stem>.json` — `{"kind":"page"|"phone"|"standalone","title":"…","active":"<NavKey>","height":<px>}`
  - `page`: the app shell (sidebar + topbar + bottom nav) is added for you; you write only what goes inside `<main class="el-content">`.
    `active` = one of: Dashboard, Buyurtmalar, QabulYaratish, Pochta, Paketlar, Qaytarishlar, Tolovlar, Balans, Mahsulotlar,
    Foydalanuvchilar, Hududlar, Filiallar, Integratsiyalar, Bildirishnomalar, Jurnal, Sozlamalar.
    `height` = the rendered full-page height at 1440px wide (read it from your light screenshot's height; round up to 50).
  - `phone`: fixed 390×844 courier phone screen; you write three parts separated by markers:
    `<!--MTOP-->` (the `.el-mtop` bar), `<!--MBODY-->` (inside `.el-mbody`), `<!--MAFTER-->` (optional: a `.el-sticky-bar`,
    or an `.el-overlay` with an `.el-sheet`/`.el-dialog` shown on top). `active` = home | orders | quick | mails | cash. `height` 844.
  - `standalone`: no shell (login, error states, the design-system board); you write everything inside the `.el` root.
    Optional `"width"` (default 1440).
- `kit/fragments/<Stem>.html` — the fragment.

Never edit `kit/helmet.html`, `kit/*.dc.html`, `kit/*.mjs`, other stems' files, or anything in `project/` by hand
(`project/` is generated). If the kit truly lacks something you need, compose it from existing classes + inline layout
styles; report the gap in your final answer instead of inventing new classes.

## Commands

    node kit/build.mjs <Stem>     # → project/<Stem>.dc.html and project/<Stem>-dark.dc.html
    node kit/lint.mjs <Stem>      # must print "errors": [] — fix every error
    node kit/render.mjs <Stem>    # → shots/<Stem>-light.png, -dark.png (+ -mobile.png for pages) and a JSON report

Then **Read the PNGs** and fix what you see. Report JSON flags: `overflowX` must be 0; `broken` images empty;
`textUnder12px` empty; `wideElements` is only acceptable for content inside a horizontal scroll box (tabs, wide table).

## Hard rules (lint enforces most)

1. **Only kit classes + inline layout styles.** Classes come from `kit/helmet.html` (`el`, `el-*`). Inline `style` is for
   layout only: display, flex/grid props, gap, padding, margin, width/height/min/max, align, position, overflow, text-align,
   white-space. Colors ONLY as `var(--token)`. No `<style>`, no `<script>`, no `{{holes}}`, no emoji, no gradients,
   no font-weight 800/900, no font-size under 12px, no custom shadows, radii only 6/8/10/12/14/20/999px.
2. **Tokens** (both themes are automatic — never hard-code a color):
   surfaces `--bg --surface --raised --sunken --input --row-hover`, lines `--border --border-strong`,
   text `--text --text-muted --text-subtle`, brand `--brand` (identity only), interactive `--action --action-hover --action-fg --action-soft --on-solid`,
   status `--success|--warning|--danger|--info` + `-fg` (text) + `-soft` (background).
3. **Color = meaning.** Blue action = interactive things only (primary button, links, selected tab/page, focus).
   Navy brand = logo/sidebar/avatar only. Green = success/positive money only, amber = in progress / needs attention,
   red = cancelled/debt/destructive only, info blue = new/informational. Everything else is neutral (text, sunken, border).
   KPI icons are neutral (`.el-stat-icon`). Zero or empty values are neutral, never colored. No rainbow of card accents.
4. **One primary action per screen** (`el-btn-primary`), top-right in the page header. Secondary actions = `el-btn-secondary`
   or `el-btn-ghost`. Destructive = `el-btn-danger-soft` (in tables/menus) or `el-btn-danger` only inside a confirm dialog.
5. **At most 2 levels of bordered surfaces**: page → `.el-card`. Never a card inside a card. Inside a card, separate
   sections with `.el-divider`, `border-top: 1px solid var(--border)`, or a `--sunken` background block without a border.
6. **Page anatomy** (kind `page`): `.el-pagehead` (optional `.el-back` link, `h1.el-h1`, `p.el-sub`, `.el-actions`) →
   optional stat row (`.el-grid` of `.el-stat`, only figures the real page actually shows) → filters/tabs → content cards.
   Vertical rhythm comes from `.el-content` gap (24px); inside cards use 16–20px padding, 12–16px gaps (4px grid).
7. **Typography:** use classes — `el-h1` (24/700) page title, `el-h2` (16/700) card title, `el-h3` (14/600), body 14px,
   `el-small` 13, `el-xs`/`el-overline` 12 (minimum). Numbers are tabular automatically.
8. **Accessible as drawn:** real `<button type="button">`, `<a href>`, `<input>` with `aria-label` or `<label>`;
   icon-only buttons need `aria-label`; tabs `role="tab" aria-selected`; current nav `aria-current="page"`. No clickable divs.
   Touch targets on phone ≥44px (`el-btn-lg`, `el-iconbtn-lg`, phone inputs/chips are auto-sized).
9. **Responsive (kind page):** must not overflow at 390px. Use `.el-grid` (auto-fit) for card grids; wrap tables in
   `.el-table-wrap`; for list pages also give an `.el-show-mobile` card/list version and mark the table `.el-hide-mobile`
   (see golden). Toolbars use `flex-wrap: wrap` and flexible widths (`flex: 1 1 200px`), never fixed px widths over 260px.
10. **Links between artboards** (they work in the canvas Play mode): use `href="<Stem>.dc.html"` for existing stems:
    Main, Dashboard, Buyurtmalar, BuyurtmaTafsiloti, QabulYaratish, BuyurtmaYaratish, Pochta, Paketlar, Tolovlar, Balans,
    Foydalanuvchilar, Filiallar, Integratsiyalar, Sozlamalar, Login, Holatlar, TelBuyurtmalar, TelTafsilot, TelSkan,
    TelYakunlash. Otherwise `href="#"`.

## Content standards (Uzbek, Latin script)

- Copy is Uzbek Latin, sentence case (never Title Case or ALL CAPS in markup; `.el-overline`/table headers uppercase via CSS
  are fine). Apostrophes as in the app: o', g', to'lov. No English words in UI copy (no "history", "Export", "Return").
  Take real labels from `../fe-main/src/locales/uz/*.json`; where the real label is mixed-language or confusing, use the
  clean Uzbek equivalent and list the rename in your final answer.
- **Money:** `185 000 so'm` (space thousands, unit "so'm", never "UZS"/"SO'M"/comma). KPI tiles may use compact
  `12,4 mln so'm`. Negative/debt: `−240 000 so'm` (U+2212) in `--danger-fg`. Income `+` in `--success-fg`.
- **Phone:** `+998 90 123 45 67`. **Date/time:** today `Bugun, 14:15`, yesterday `Kecha, 18:04`, older `06.10.2026, 19:05` (tables and lists alike; never `08.10.2026, …` for today). Date only: `06.10.2026`.
  **Order id:** `№10241`. **Counts:** `12 ta`.
- **Order status → badge** (`el-badge el-badge-dot` + tone):
  new `Yangi` info · created `Yaratilgan` info · received `Qabul qilindi` info · on the road `Yo'lda` warning ·
  waiting `Kutilmoqda` warning · sold `Sotilgan` success · paid `To'langan` success · partly_paid `Qisman to'langan` warning ·
  cancelled `Bekor qilingan` danger · cancelled (sent) `Bekor — jo'natilgan` danger + `el-badge-outline` · closed `Yopilgan` neutral.
  Delivery type: `Uygacha` / `Markazgacha` as `el-badge el-tone-neutral` (no color). Active user `Faol` success, inactive `Nofaol` neutral.
  Other domains (mail, batch, payment, integration) follow the same meaning rule: done=success, in progress=warning,
  new=info, failed/cancelled=danger, archived/closed=neutral.
- **Sample data:** realistic but fictional. People: Uzbek names (Dilnoza Karimova, Aziz Rahimov, …). Markets: fictional
  shops (Baraka Shop, Nur Elektronika, Chilonzor Market, Ipak Yo'li Savdo). Places: real regions/districts
  (Toshkent sh., Samarqand, Farg'ona, Chilonzor tumani…). Amounts 50 000 – 3 000 000 so'm. Branch: "Toshkent HQ".
  Current user: Shodiyor Ergashev, Superadmin (courier screens: Jasur Tursunov, Kuryer).
- **No filler:** show only sections/fields/actions that exist in the real page (read the source!). You may restructure,
  merge, rename, reorder and fix UX (that is the point), but do not invent features, KPIs or data the product doesn't have.
  If you propose a small UX addition the audit asked for (confirm dialog, sticky action bar, empty state), mention it in
  your final answer.

### Owner-approved copy and UX (2026-10-09) — use these everywhere
- Labels: `Bosh sahifa` (never "Dashboard"), `Qaytarishlar` (never "Returnlar"/"Return batchlar"), `Filial paketlari` (never "batchlar"),
  status created = `Yaratilgan`, inactive = `Nofaol`, export = `Excelga yuklash`, payments history = `Operatsiyalar tarixi`,
  theme names `Kunduzgi` / `Tungi`, "all" = `Barchasi`, periods `Bugun / Bu hafta / Bu oy / Barchasi`.
- Status tones: `Yangi`, `Yaratilgan` and `Qabul qilindi` are ALL info tone (blue = interactive only).
- UX approved: confirm dialogs before money transfers, user deactivation and "Kunni yakunlash"; QR manual code entry;
  To'lovlar date filter; Foydalanuvchilar "Filial" column; order status tabs with counts; Kunni yakunlash uses per-row
  Sotildi / Bekor / Ertaga segments (no "Faqat bekorlarni qo'llash").
- Settings, profile and the notification inbox open from the topbar user menu / bell — they are not sidebar items.

## Component recipes (copy from the golden page or compose like this)

- Page header: see golden (`.el-pagehead` → `.el-pagehead-text` + `.el-actions`). Detail pages put
  `<a class="el-back" href="Buyurtmalar.dc.html">← icon + Buyurtmalar</a>` above the h1.
- Card with title: `<section class="el-card"><div class="el-card-head"><h2 class="el-h2">…</h2>…</div><div class="el-card-pad">…</div></section>`
- Stat: `<div class="el-stat"><div class="el-stat-top"><span class="el-stat-label">Jami daromad</span><span class="el-stat-icon">svg</span></div>
  <div class="el-stat-value">12,4<span class="el-stat-unit">mln so'm</span></div><div class="el-stat-meta"><span class="el-delta-up">+8,2%</span> o'tgan haftaga nisbatan</div></div>`
- Field: `<div class="el-field"><label class="el-label" for="x">Telefon <span class="el-req">*</span></label><input class="el-input" id="x" …><span class="el-hint">…</span></div>`
- Select (closed state): `<button class="el-input el-select" type="button" aria-label="…"><span>Toshkent sh.</span>chevron-svg</button>`;
  placeholder text inside `<span class="el-select-placeholder">`.
- Segmented: `<div class="el-seg" role="group" aria-label="…"><button type="button" aria-pressed="true">Bugun</button>…</div>`
- Tabs: golden page. Table: golden page. Pagination: golden page.
- Alert: `<div class="el-alert el-tone-warning" role="status">icon<div class="el-alert-body"><div class="el-alert-title">…</div>…</div></div>`
- Empty: `<div class="el-empty"><span class="el-empty-icon">svg</span><p class="el-empty-title">…</p><p class="el-empty-text">…</p><a class="el-btn el-btn-primary" …>…</a></div>`
- Dialog shown open (phone or standalone): `<div class="el-overlay"><div class="el-dialog" role="dialog" aria-modal="true" aria-labelledby="…">…<div class="el-dialog-foot">…</div></div></div>`
  (the overlay needs a positioned ancestor: `.el-phone` already is; elsewhere wrap in `<div style="position: relative; min-height: 420px">`).
- Simple charts: draw with divs (bars: `.el-bar > span` with inline `width: 62%`) or inline SVG using `stroke="var(--action)"`
  / `fill="var(--sunken)"` etc. Series colors: action, then text-subtle; status donuts use success/warning/danger tokens.

## Icons (lucide, inline SVG)

Wrapper: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">…</svg>`
(16 or 18 inside buttons/inputs, 20 default, 22 in phone nav). Paths:

- home `<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>`
- shopping-bag `<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>`
- inbox `<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>`
- mail `<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>`
- package `<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/><path d="m7.5 4.27 9 5.15"/>`
- rotate-ccw `<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>`
- credit-card `<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>`
- wallet `<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>`
- scale `<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>`
- tag `<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>`
- users `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`
- user `<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`
- map-pin `<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>`
- building `<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>`
- store `<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/>`
- plug `<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>`
- bell `<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>`
- search `<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>`
- scan `<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>`
- qr `<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>`
- chevron-down `<path d="m6 9 6 6 6-6"/>` · chevron-right `<path d="m9 18 6-6-6-6"/>` · chevron-left `<path d="m15 18-6-6 6-6"/>`
- arrow-left `<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>` · arrow-up-right `<path d="M7 7h10v10"/><path d="M7 17 17 7"/>` · arrow-down-left `<path d="M17 7 7 17"/><path d="M17 17H7V7"/>`
- plus `<path d="M5 12h14"/><path d="M12 5v14"/>` · minus `<path d="M5 12h14"/>` · x `<path d="M18 6 6 18"/><path d="m6 6 12 12"/>` · check `<path d="M20 6 9 17l-5-5"/>`
- download `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>`
- filter `<path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/>` · more `<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>`
- phone `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>`
- truck `<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>`
- pencil `<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>`
- trash `<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>`
- printer `<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>`
- calendar `<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>`
- clock `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`
- trending-up `<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>` · trending-down `<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>`
- alert-triangle `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>`
- info `<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>` · help `<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>`
- check-circle `<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>` · x-circle `<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>`
- copy `<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>`
- eye `<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>`
- lock `<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`
- send `<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>`
- sparkles `<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>`
- zap `<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>`
- camera `<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>`
- keyboard `<path d="M10 8h.01"/><path d="M12 12h.01"/><path d="M14 8h.01"/><path d="M16 12h.01"/><path d="M18 8h.01"/><path d="M6 8h.01"/><path d="M7 16h10"/><path d="M8 12h.01"/><rect width="20" height="16" x="2" y="4" rx="2"/>`
- flashlight `<path d="M18 6c0 2-2 2-2 4v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V10c0-2-2-2-2-4V2h12z"/><line x1="6" x2="18" y1="6" y2="6"/><line x1="12" x2="12" y1="12" y2="12"/>`
- refresh `<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>`
- log-out `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>`
- sun `<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>` · moon `<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>`
- globe `<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>`
- link `<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>`
- key `<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>`
- shield-check `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>`

## Logos (already uploaded; use exactly these src values)

- white wordmark (on navy/dark): `/_blob/6c64e6604f822b10da1545ec86677c82` (289×96)
- navy wordmark (on light): `/_blob/e9e5dece9e747749fa9cc1ce94a87c92` (289×96)
- white mark: `/_blob/e1f00e084ded5f41b8d7023517fa5b2c` (105×96) · navy mark: `/_blob/702b515e0b014fb35f3b0231343d45a1` (105×96)
On a surface that changes with the theme, show the navy logo with class `el-hide-dark`-style switching is NOT available:
instead place the logo on a fixed navy panel (`style="background: var(--sidebar)"`) with the white logo, as the sidebar does.

## Final answer (your return value)

Return a short JSON-ish summary: stem, files written, lint result, render flags, height used, list of copy renames,
list of UX changes vs the current product (one line each), and any kit gaps.

## v3 additions — role-grouped canvas (READ THIS, it overrides older notes above where they differ)

**Fragment names** are now `<role>--<viewId>` (e.g. `superadmin--orders-list`, `courier--scan-active`, `tizim--states-forms`,
`common--inbox`). Write `kit/fragments/<role>--<viewId>.json` + `.html`. The canvas shows each view as ONE artboard with the
light version on the left and the dark version on the right (built for you by `node kit/build-roles.mjs`), inside the
correct role's sidebar/topbar (each role has its own menu and persona: superadmin Shodiyor Ergashev, admin Nilufar
Rashidova, manager Ravshan Ortiqov · Urgut filiali (Aralash), registrator Bobur Xolmatov · Toshkent HQ, market Akbar
Nurmatov · Baraka Shop, courier Jasur Tursunov). You still review with `node kit/build.mjs <frag>` + `node kit/render.mjs <frag>`
(single-theme renders with a generic shell — the sidebar there is NOT the role's; judge only your content).

**Links between screens:** use `href="@<viewId>"` (e.g. `href="@orders-detail"`). The builder resolves it inside the
same role (falls back to common screens, else `#`). Old `X.dc.html` links are also mapped. Never hard-code a role prefix.

**Kinds:** `page` (inside app shell), `phone` (390×844 courier screens; dialogs on phone are bottom sheets in MAFTER using
`.el-overlay` with `align-items: flex-end; padding: 0` + `.el-sheet`), `standalone` (no shell: login, system boards).
A desktop `dialog` view = kind `page`: draw the parent page content (copy it from the parent view's fragment if it already
exists in kit/fragments, otherwise a faithful compact version) and put the open dialog last:
`<div class="el-overlay" style="position: absolute"><div class="el-dialog" role="dialog" aria-modal="true" aria-labelledby="…">…</div></div>`
— the artboard root is positioned, so the overlay covers the whole app like a real modal. Wide forms may use
`style="width: min(640px, 100%)"` on `.el-dialog`. Dropdowns/popovers do NOT get an overlay.

**Base fragments:** when a task names a `base`, first copy `kit/fragments/<base>.html` (+ .json) to your new fragment name
and ADAPT it to the inventory description for this role/view (remove actions the role cannot do, add what it has). Keep the
approved look; do not redesign a base.

**New kit classes (kit/helmet.html):** state modifiers `.is-hover .is-focus .is-active .is-loading .is-disabled
.is-selected .is-readonly .is-success` (force a state in a mockup), `.el-spinner(.el-spinner-lg)`, skeletons
`.el-skel-line .el-skel-block .el-skel-circle` + `.el-shimmer`, `.el-topprogress > span`, `.el-progress > span`,
menus `.el-menu .el-menu-item .el-menu-item-danger .el-menu-sep .el-menu-label`, options `.el-options .el-option[aria-selected] .el-option-empty`,
`.el-tooltip`, `.el-popover`, calendar `.el-cal .el-cal-head .el-cal-grid .el-cal-dow .el-cal-day(.is-muted .is-today .is-range .is-start .is-end) .el-cal-presets`,
`.el-radio`, `.el-choice`, `.el-choice-card(.is-selected)`, `.el-banner`, `.el-kbd`, `.el-state-label`, `.el-list .el-list-item`,
`.el-sr` (screen-reader only), `.el-th-sort` (sortable header button). Real `:hover`/`:focus-visible` also work in Play mode.

**Icons:** prefer the canonical icon set from `kit/icon-registry.json` once it exists; otherwise the KIT list. For any
lucide icon not in the list get the exact path with `node kit/icons-extract.mjs PascalName` (prints real lucide SVG body).

**Phone views:** content must fit one 844px screen as a believable scroll position (top bar + body + optional sticky bar +
bottom nav). Touch targets ≥44px. Courier role only.

**Fidelity:** every view must show what the inventory description says THIS role sees (role differences matter: e.g. the
superadmin order detail has NO Sotish/Bekor buttons; the manager's has them). Owner-approved changes override the source.

## v4 — responsive (READ THIS)
Every product screen is shown on the canvas at THREE widths, each light + dark: Desktop 1440, Planshet 768, Telefon 390.
The kit uses CONTAINER queries on `.el` (not viewport media queries): ≤1023px → sidebar hidden, menu button in topbar,
`.el-hide-tablet` hides; ≤767px → `.el-hide-mobile` hides, `.el-show-mobile` shows (as flex), 44px controls, bottom nav,
page-header actions full width, and every `.el-overlay > .el-dialog` automatically becomes a bottom sheet.
Rules for screens:
- Telefon: no horizontal page scroll; data tables become stacked cards/list (`.el-show-mobile` variant, `.el-hide-mobile` on
  the table); filters collapse behind a "Filtrlar" button + chips; forms one column, primary action full width at the end;
  KPI tiles 2 per row or 1 per row; tabs scroll horizontally; touch targets ≥44px.
- Planshet: tables must FIT 736px — hide low-priority columns with `.el-hide-tablet` on both th and td (keep №/name/status/amount/
  action), or use the card list if the table is a wide multi-column report; two-column detail layouts collapse to one column;
  dialogs stay centered.
- `.el-theme-light` / `.el-theme-dark` on an element force light/dark tokens inside it (theme previews, camera surfaces).

## v5 — workspace, commands, kinds, bottom nav (READ THIS — it overrides everything above where they differ)

**Canvas root** = the folder that contains `kit/` (run every command from there). Real source (read-only): `../fe-main/src/`.
`published/` is a read-only backup of the live canvas — never edit it. Golden page: `kit/fragments/superadmin--orders-list.html`
(table on desktop, fitting columns on tablet, cards + Filtrlar on phone). Old `kit/build.mjs` / `kit/render.mjs` NO LONGER EXIST.

**Commands**
    node kit/build-roles.mjs --view <role>-<viewId>          # build one artboard (desktop + tablet + phone, light + dark)
    node kit/build-roles.mjs --adhoc <role>:<viewId>:<menuKey>:<page|dialog>:<fragment>[:phone,tablet]
                                                             # build a NEW view that is not in views.json yet (preview)
    node kit/shoot.mjs <role>-<viewId>                       # → shots/<role>-<viewId>--{desktop,tablet,phone}-{light,dark}.png + JSON report
    node kit/lint.mjs <fragment>                             # must print "errors": []
Read the PNGs (all devices, at least one dark) and fix what you see. Report must show: overflowX 0 everywhere, wrapNav [],
tiny [], broken [], smallTargets [] on phone (inline text links are exempt). NEVER run `kit/measure.mjs` or `--index`
(the orchestrator does), never edit `kit/views.json`, `kit/roles.json`, `kit/helmet.html`, `kit/*.mjs` unless your task says so.

**Fragment kinds** (`kit/fragments/<frag>.json` → `"kind"`):
- `page` — inside the role's app shell (sidebar ≥1024, menu button + drawer 768–1023, topbar + **bottom nav** <768). You write only
  the content of `<main class="el-content">`. Courier now uses this too (desktop sidebar: Bosh sahifa, Buyurtmalar, Tezkor amal,
  Pochta, Kassa, Hududlar — the same as the real app's `menuConfig.tsx`).
- `screen` — a full-bleed app screen WITHOUT the shell (the scanner, like the real `/scan` route in `ScanLayout`), drawn at all three
  devices with fixed device heights: desktop = `"height"` (use 900), tablet 1024, phone 844. You draw everything inside `.el`.
  Add `"fixed": false` for a scrolling full-bleed page (e.g. the scan result `/scan/:token`): frames then grow with the content.
- `standalone` — design-system boards and login-like single pages (desktop only, light+dark).
- `phone` — LEGACY 390×844 courier shell (`<!--MTOP-->/<!--MBODY-->/<!--MAFTER-->`). Being retired: convert to `page`/`screen`.
Optional meta keys: `"dialog": true` (the view is an open dialog/sheet/camera → tablet and phone frames are cut at device height
1024/844 so the sheet sits on the bottom edge), `"devices": ["phone"]` or `["tablet","phone"]` (phone-only interactions such as a tab
switcher sheet, the mobile menu, mobile search — never use it to skip a real desktop screen).

**Bottom nav (phone, built by the shell — never draw it inside a page fragment):** 5 equal cells, icon 22px + ONE-LINE label
(`.el-bn-label`, 12px/600, ellipsis, must fit 70px in uz/ru/en). Long menu names use short forms: Qabul va yaratish → Qabul /
Приём / Intake; market: Yaratish / Создать / Create; Kassa / Касса / Cashbox. Scanner roles (superadmin, admin, manager,
registrator, courier) get a raised centre **Skaner** button (`.el-bn-fab`, 52px, action colour) that opens `@scan-camera`;
the last cell is **Menyu** (full menu). Market has no scanner: 4 plain cells + **Menyu** (its 6th item «Operatorlar», ega qarori
2026-10-19, does not fit 5 cells; Mahsulotlar moved into Menyu). Market operator (`market_operator`) has 5 plain cells, no Skaner, no Menyu.
Per role: superadmin/admin: Bosh sahifa · Buyurtmalar · [Skaner] · Qabul · Menyu; manager: Bosh sahifa · Buyurtmalar · [Skaner] ·
Biriktirish · Menyu; registrator: Bosh sahifa · Buyurtmalar · [Skaner] · Qabul · Menyu; market: Bosh sahifa · Buyurtmalar ·
Yaratish · To'lovlar · Menyu (Mahsulotlar, Operatorlar → Menyu); market_operator: Bosh sahifa · Buyurtmalar · Yaratish ·
Mahsulotlar · Daromadim; courier: Bosh sahifa · Buyurtmalar · [Skaner] · Tezkor amal · Menyu.
Any label you draw yourself in a compact nav/tab/segment must also never wrap mid-word: `white-space: nowrap` + ellipsis, or a shorter word.

**Sharing:** one fragment can serve several views (admin re-uses many `superadmin--*` fragments). Before editing a fragment, check
which views use it (`grep '"fragment": "<frag>"' kit/views.json`); if your change is role-specific, copy it to `<yourrole>--<viewId>`
and tell the orchestrator in your result (`viewChanges`).

## v5 — camera scanner (phone camera as the scanner — READ THIS for every scan / camera view)

Board: `tizim-scanner` (fragment `tizim--scanner`) shows every state as a real phone frame. Reference views:
`superadmin--scan-camera` (kind `screen`, the universal `/scan`, shared by superadmin/admin/manager/registrator) and
`superadmin--neworders-cancelled-scanner-dialog` (flow camera dialog, market QR). Copy from them, never redraw a camera by hand.

**When camera, when USB scanner.** Phone (≤767): no USB scanner → camera first (bottom-nav centre **Skaner**, in-flow full-width
primary **Kamera bilan skanerlash**, camera opens full screen). Tablet: in-flow **Kamera** button + USB chip, camera in a centred
dialog. Desktop: the USB/HID scanner always listens (chip **USB skaner tayyor** = the app is listening, not "a device is plugged in")
+ secondary **Kamera** button (webcam). Both work at the same time. Camera exists today only in `/scan`, Biriktirish, Tezkor amal /
Kunni yakunlash and the cancelled-orders handover (market QR); every other scan flow (mails detail receive, batches detail, branch
batch detail, incoming / market-order intake, orders list, courier orders list) is HID-only → add a camera view there.

**Naming.** Flow camera view = `<parentViewId>-camera` (e.g. `mails-detail-receive-camera`), same `menuKey` as the parent, title
`<parent title> — kamera`, fragment `<role>--<parentViewId>-camera.json` = `{"kind":"page","title":"…","height":<parent height>,"dialog":true}`.
The fragment = the parent page content (copy the parent fragment) + the camera overlay LAST. The parent's entry button links
`href="@<parentViewId>-camera"`. The universal scanner is `scan-camera` (kind `screen`, already exists — link `@scan-camera`).
Existing camera dialogs keep their ids (`neworders-cancelled-scanner-dialog`, `dispatch-camera-dialog`, `courier-bulk-camera-dialog`).

**Kit (helmet "v5 — Camera scanner").** The camera surface `.el-cam` is ALWAYS dark (both themes): it defines `--cam-*` tokens and
re-maps the kit tokens to dark, so `.el-btn`, `.el-badge`, `.el-list`, `.el-input`, `.el-progress`, `.el-iconbtn` inside it render dark
automatically. Never put literal colours in a fragment — the camera colours live in the helmet.
- Layout: `.el-overlay.el-overlay-cam > .el-dialog.el-cam-dialog > (section.el-cam + aside.el-cam-side)`. Desktop: dialog 1080×680,
  side panel 360 px (themed). Tablet: dialog full width, side 300 px. Phone (container ≤767): dialog becomes FULL SCREEN (no radius,
  no padding, covers the bottom nav) and `.el-cam-side` hides itself. Screen kind: `.el-cam-screen > header.el-hide-mobile +
  .el-cam-split > (section.el-cam + aside.el-cam-side)` — tablet stacks (side = 2-column grid), phone = camera only.
- Inside `.el-cam`: `.el-cam-top` (48 px glass `.el-cam-btn`s, `.el-cam-heading` = `.el-cam-title` + `.el-cam-context`, `.el-cam-tools`
  pushed right) → `.el-cam-stage` (`.el-cam-feed` simulated picture, `.el-cam-finder`, `.el-cam-status` chip slot, `.el-cam-hint`,
  `.el-cam-toasts`, or a centred `.el-cam-card`) → `.el-cam-bottom` (`.el-cam-meter` counter, `.el-progress`, `.el-cam-last`,
  `.el-cam-actions`). Sheets inside the camera: `.el-cam-backdrop` + `.el-cam-sheet` (`.el-sheet-grip`, `-head`, `-body`, `-foot`).
- Finder markup is fixed: `<div class="el-cam-finder [is-success|is-error|is-warning|is-info|is-paused]" aria-hidden="true">` + 4 ×
  `<span class="el-cam-corner"></span>` FIRST + `<span class="el-cam-line"></span>` + optional `<span class="el-cam-mark">icon 36</span>`.
- Feed: `<div class="el-cam-feed" aria-hidden="true"></div>` = parcel label with QR, centred on the finder. Modifiers: `.is-screen-qr`
  (QR on a phone screen — market QR), `.is-dim` (low light), `.is-torch`, `.is-blur` (starting), `.is-paused` (sheet open), `.is-off`
  (no picture: permission / errors).
- Phone-only vs large-screen parts: put `.el-show-mobile` on the top-bar close button, `.el-cam-heading`, `.el-cam-status`, the torch
  tool and `.el-cam-bottom`; put `.el-hide-mobile` on the top-bar `.el-cam-chip`. On desktop the side panel carries title, close,
  counter, list, USB badge and the actions. (Board frames that are phone-only drop these classes.)
- Board device frames: `<div class="el-device" style="width: 390px; height: 844px">` = a nested container named `el` that keeps the
  page theme, so all phone rules apply inside (do NOT nest `<div class="el">`: it resets to light tokens and confuses shoot.mjs).
  `.el-cam-pin` (numbered annotation) and `.el-cam-code` (code block) are for boards only.

**Torch / camera buttons.** Flows on phone: torch = top-bar `.el-cam-btn` with `aria-label="Chiroq" aria-pressed="false|true"`
(pressed = white button + feed `.is-torch` + chip "Chiroq yoqilgan"). Universal `/scan` on phone: labelled **Chiroq** button in the
bottom panel next to **Qo'lda kiritish**. Desktop: no torch (webcams have none) — only **Kamerani almashtirish** (`SwitchCamera`).

**States → classes → copy** (one toast at a time; sound = `playScanFeedback`; camera cooldown 700 ms, duplicate 1800 ms, HID none):
| State | Finder + mark | Chip / toast | Sound |
|---|---|---|---|
| Ruxsat izohi | feed `.is-off`, `.el-cam-card` (Camera) | "Kameraga ruxsat bering" · "Posilkadagi QR kodni o'qish uchun telefon kamerasi kerak. Tasvir saqlanmaydi va hech qayerga yuborilmaydi." · [Kamerani yoqish] [Qo'lda kiritish] | — |
| Ruxsat rad etilgan | card `.is-error` (CameraOff) + `.el-cam-steps` | "Kameraga ruxsat berilmagan" · 1 Manzil satridagi qulf belgisini bosing · 2 «Ruxsatlar» → «Kamera» → «Ruxsat berish» · 3 «Qayta urinish»ni bosing · [Qayta urinish] [Qo'lda kiritish] | error |
| Ishga tushmoqda | feed `.is-blur`, finder `.is-paused` + `.el-spinner-lg` | chip `.is-info` "Kamera ishga tushmoqda" · hint "Bir lahza — kamera ochilmoqda" | — |
| Tayyor | default + line | chip `.is-live` "Skanerlash faol" · hint "QR kodni ramka ichiga olib keling" | — |
| Topildi | `.is-success` + Check | chip "QR topildi" · toast success "Qo'shildi" / "№10241 · Dilnoza Karimova" · counter +1 | success, 40 ms |
| Takroriy | `.is-info` + Repeat | toast info "Allaqachon skanerlangan" / "№10241 · ro'yxatda bor, qayta sanalmadi" | duplicate (camera re-read <1800 ms: silent) |
| Topilmadi | `.is-error` + X | toast error "Topilmadi" (flow wording: "Bu pochtada yo'q") / "№10388 · boshqa pochtaga tegishli" | missing |
| Noto'g'ri QR turi / yaroqsiz | `.is-error` + Ban | "Noto'g'ri QR turi" / "Bu paket QR kodi. Buyurtma yorlig'idagi QR kodni skanerlang." · foreign QR: "Bu QR kod skaner uchun yaroqsiz" | error |
| Boshqa kuryerniki | `.is-error` + UserX | "Boshqa kuryerga biriktirilgan" / "№10251 · Sherzod Nazarov. Menejerga xabar bering." | error |
| Juda tez | `.is-warning` + Timer | "Juda tez — skan qabul qilinmadi" / "Posilkani qayta skanerlang" | error |
| Kam yorug'lik | feed `.is-dim` | chip `.is-warning` "Yorug'lik kam" · toast warning (SunDim) "Yorug'lik kam" / "Kod ko'rinmayapti — chiroqni yoqing" + [Yoqish] | — |
| Chiroq yoqilgan | feed `.is-torch`, torch `aria-pressed="true"` | chip "Chiroq yoqilgan" (Flashlight icon) | — |
| Oflayn navbat | `.is-success` | chip `.is-warning` "Internet yo'q · 3 ta navbatda" · toast info (CloudUpload) "Navbatga qo'shildi" / "№10242 · aloqa tiklanganda yuboriladi" · last row icon `.is-warning` Clock | success |
| Kamera band / yo'q | feed `.is-off`, card `.is-warning` (CameraOff) | "Kamera band" / "Kamera boshqa ilovada ochiq. Uni yoping va qayta urining." · no camera: "Bu qurilmada kamera qo'llab-quvvatlanmaydi" · start error: "Kamerani ishga tushirib bo'lmadi" | error |
| Qo'lda kiritish | feed/finder `.is-paused`, chip "Kamera to'xtatildi", sheet | "Kodni qo'lda kiriting" · label "Buyurtma raqami yoki yorliqdagi kod" · [Bekor] [Qo'shish] | as a scan |
| Market QR rule | feed `.is-screen-qr` | last row (Store) "Faqat Baraka Shop QR kodi" / "Boshqa marketning QR kodi qabul qilinmaydi"; side `.el-alert.el-tone-info` same rule | — |

**Multi-scan.** Counter `.el-cam-count-n` + `.el-cam-count-of` "/ 40" + label "ta skanerlandi" (unknown total: drop `-of`, label
"ta skanerlandi" after "12"). **Ro'yxat** (ghost sm) opens the list sheet (newest first, each row `Undo2` 44 px "№… ni ro'yxatdan olib
tashlash"; foot [Davom etish] [Tugatish]). Undo toast: info "Olib tashlandi" / "№10241 · hisoblagich 12 / 40" + [Qaytarish] (5 s).
**Tugatish** when not all scanned → summary sheet "Skanerlashni tugatasizmi?" (Skanerlandi / Skanerlanmadi / Rad etildi + note) with
[Davom etish] [<N> tasini qabul qilish]. Titles: universal "QR skaner" / "Buyurtma, paket yoki pochta"; flows = the flow action
("Pochtani qabul qilish", "Biriktirish", "Kunni yakunlash", "Market QR skanerlash", "Paketni qabul qilish") + context
"<object> · <place or count>". Labels: Tugatish, Qo'lda kiritish, Chiroq, Ro'yxat, Davom etish; aria: "Skanerni yopish",
"Kamerani almashtirish".

**Entry buttons (in the parent page).** Desktop/tablet — in the card head or toolbar where scanning selects rows:
```html
<span class="el-badge el-badge-dot el-tone-success el-hide-mobile">USB skaner tayyor</span>
<a class="el-btn el-btn-secondary el-hide-mobile" href="@mails-detail-receive-camera" aria-haspopup="dialog"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"/><circle cx="12" cy="13" r="3"/></svg>Kamera</a>
```
Phone — one full-width primary, right above the list it fills (it is the page's main action on phone):
```html
<a class="el-btn el-btn-primary el-btn-lg el-btn-block el-show-mobile" href="@mails-detail-receive-camera" aria-haspopup="dialog"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>Kamera bilan skanerlash</a>
```

**Flow camera overlay — copy, then change title/context/counter/rows/links** (put it LAST, after the parent page content):
```html
<!-- parent page content first (copied from the parent fragment), then: -->
<div class="el-overlay el-overlay-cam" style="position: absolute">
  <div class="el-dialog el-cam-dialog" role="dialog" aria-modal="true" aria-labelledby="cam-title">
    <section class="el-cam" aria-label="Kamera">
      <div class="el-cam-top">
        <a class="el-cam-btn el-show-mobile" href="@mails-detail-receive" aria-label="Skanerni yopish"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></a>
        <div class="el-cam-heading el-show-mobile">
          <p class="el-cam-title">Pochtani qabul qilish</p>
          <p class="el-cam-context">Pochta №2493 · Toshkent sh.</p>
        </div>
        <span class="el-cam-chip is-live el-hide-mobile">Skanerlash faol</span>
        <div class="el-cam-tools">
          <button class="el-cam-btn el-show-mobile" type="button" aria-label="Chiroq" aria-pressed="false"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 13v1"/><path d="M17 2a1 1 0 0 1 1 1v4a3 3 0 0 1-.6 1.8l-.6.8A4 4 0 0 0 16 12v8a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-8a4 4 0 0 0-.8-2.4l-.6-.8A3 3 0 0 1 6 7V3a1 1 0 0 1 1-1z"/><path d="M6 6h12"/></svg></button>
          <button class="el-cam-btn" type="button" aria-label="Kamerani almashtirish"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/><path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5"/><circle cx="12" cy="12" r="3"/><path d="m18 22-3-3 3-3"/><path d="m6 2 3 3-3 3"/></svg></button>
        </div>
      </div>
      <div class="el-cam-stage">
        <div class="el-cam-feed" aria-hidden="true"></div>
        <div class="el-cam-finder" aria-hidden="true"><span class="el-cam-corner"></span><span class="el-cam-corner"></span><span class="el-cam-corner"></span><span class="el-cam-corner"></span><span class="el-cam-line"></span></div>
        <div class="el-cam-status el-show-mobile"><span class="el-cam-chip is-live">Skanerlash faol</span></div>
        <p class="el-cam-hint">QR kodni ramka ichiga olib keling</p>
        <div class="el-cam-toasts" role="status" aria-live="polite">
          <div class="el-cam-toast is-success"><span class="el-cam-toast-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></span><div class="el-cam-toast-body"><span class="el-cam-toast-title">Qo'shildi</span><span class="el-cam-toast-text">№10241 · Dilnoza Karimova</span></div></div>
        </div>
      </div>
      <div class="el-cam-bottom el-show-mobile">
        <div class="el-cam-meter">
          <span class="el-cam-count"><span class="el-cam-count-n">13</span><span class="el-cam-count-of">/ 40</span></span>
          <span class="el-cam-meter-label">ta skanerlandi</span>
          <button class="el-btn el-btn-ghost el-btn-sm" type="button" aria-haspopup="dialog"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/></svg>Ro'yxat</button>
        </div>
        <div class="el-progress" role="progressbar" aria-label="Skanerlandi" aria-valuemin="0" aria-valuemax="40" aria-valuenow="13"><span style="width: 33%"></span></div>
        <div class="el-cam-last">
          <span class="el-cam-last-icon is-success"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></span>
          <span class="el-cam-last-body"><span class="el-cam-last-title">№10241 · Dilnoza Karimova</span><span class="el-cam-last-sub">Chilonzor tumani · 185 000 so'm</span></span>
          <button class="el-iconbtn el-iconbtn-lg" type="button" aria-label="№10241 ni ro'yxatdan olib tashlash"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/></svg></button>
        </div>
        <div class="el-cam-actions">
          <button class="el-btn el-btn-secondary el-btn-lg" type="button" aria-haspopup="dialog"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 8h.01"/><path d="M12 12h.01"/><path d="M14 8h.01"/><path d="M16 12h.01"/><path d="M18 8h.01"/><path d="M6 8h.01"/><path d="M7 16h10"/><path d="M8 12h.01"/><rect width="20" height="16" x="2" y="4" rx="2"/></svg>Qo'lda kiritish</button>
          <button class="el-btn el-btn-primary el-btn-lg" type="button"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>Tugatish</button>
        </div>
      </div>
    </section>
    <aside class="el-cam-side" aria-label="Skanerlanganlar">
      <div class="el-dialog-head">
        <span class="el-stat-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg></span>
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column"><h2 class="el-h2" id="cam-title">Pochtani qabul qilish</h2><span class="el-small el-muted" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis">Pochta №2493 · Toshkent sh.</span></div>
        <a class="el-iconbtn" href="@mails-detail-receive" aria-label="Skanerni yopish" style="margin: -8px -8px 0 0"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></a>
      </div>
      <!-- counter: big number + .el-progress · list: ul.el-list of scanned rows (CircleCheck + title/sub + Undo2 .el-iconbtn-sm) -->
      <div style="flex: 1"></div>
      <span class="el-badge el-badge-dot el-tone-success" style="align-self: flex-start">USB skaner ham tayyor</span>
      <div class="el-dialog-foot" style="flex-wrap: nowrap">
        <button class="el-btn el-btn-secondary" type="button" style="flex: 1"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 8h.01"/><path d="M12 12h.01"/><path d="M14 8h.01"/><path d="M16 12h.01"/><path d="M18 8h.01"/><path d="M6 8h.01"/><path d="M7 16h10"/><path d="M8 12h.01"/><rect width="20" height="16" x="2" y="4" rx="2"/></svg>Qo'lda kiritish</button>
        <button class="el-btn el-btn-primary" type="button" style="flex: 1"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>Tugatish</button>
      </div>
    </aside>
  </div>
</div>
```

**Screen-kind scanner** (only `/scan`): copy `kit/fragments/superadmin--scan-camera.html` (`{"kind":"screen","height":900}`):
`.el-cam-screen` → `header.el-hide-mobile` (Orqaga + h1 "QR skaner" + ghost "Skaner ovozi" → `@settings-scanner`) → `.el-cam-split`
→ `section.el-cam` (top bar: close + heading `.el-show-mobile`, chip `.el-hide-mobile`, SwitchCamera; stage; bottom panel
`.el-show-mobile` with last scan link → `@scan-result` and [Qo'lda kiritish] [Chiroq]) + `aside.el-cam-side` (card "USB skaner ham
tayyor" + manual entry field; card "Oxirgi skanerlar" list, extra rows `.el-hide-tablet`).
Note: `kit/lint.mjs` does not know kind `screen` yet and prints `meta.kind invalid` for it — that one error is expected; everything
else must be clean. The build (`build-roles.mjs`) handles `screen` correctly.

## v6 — charts (READ THIS for every view with numbers, stats or charts — it overrides "Simple charts" above)

**Golden = `kit/fragments/superadmin--dashboard-main.html`** (KPI row with sparklines, success speedometer, status donut,
delivery rings, area chart current vs previous with crosshair + tooltip, cash waterfall, ranked lists, region tile map + heat
table, order-time heatmap). **Board = `tizim--charts`** (form table, colours + validation, anatomy, gallery of every type, states,
phone collapse, don'ts, developer API). Copy markup from the golden page; never draw a chart from scratch.
Classes live in `kit/helmet.html` section "v6 — charts" (literal colours only there).

**Method (in this order):** 1) pick the form by the data's job (board section 01: one number + trend → `.el-kpi`; a % with a
good/bad threshold → `.el-gauge`; part-to-whole ≤ 6 far-apart parts → `.el-donut`; trend → `.el-plot` area/line; ranking →
`.el-rank` / `.el-hbars`; composition per day → `.el-bars-stack`; 2-D density → `.el-heat`; geography → `.el-tilemap` + table;
add/subtract → `.el-waterfall`; stages → `.el-funnel`; vs plan/limit → `.el-meter`; ≥ 7 meaningful groups → a table, not a chart).
2) colour by job. 3) marks. 4) hover/focus layer. 5) table twin. Show only metrics the backend gives (see the golden notes);
a derived/proposed chart gets a neutral `el-badge` "Taklif" and a line in your result's `remaining`.

**Tokens (on `.el`, `.el.dark`, `.el-theme-light`, `.el-theme-dark`):**
- categorical `--chart-1 … --chart-8` (blue, orange, aqua, yellow, magenta, green, violet, red) — validated order (adjacent CVD
  ΔE ≥ 8.4, normal-vision ≥ 19.3 in both modes). Assign 1, 2, 3… in order, never cycle, never skip; 9th+ series → "Boshqa" in
  `--chart-muted`. Colour follows the entity (a filter never repaints survivors). Light slots 3·4·5 are < 3:1 on white → any chart
  using them must show direct labels or the table view.
- sequential `--seq-100 … --seq-700` (one blue hue; light: more = darker, dark: flipped, more = brighter). Steps for 5 bins:
  `.el-seq-1 … .el-seq-5` (= 150 · 250 · 400 · 550 · 700, each sets background + readable ink); `.el-seq-0` = no data (sunken).
- diverging `--div-neg-3 … --div-neg-1, --div-mid, --div-pos-1 … --div-pos-3` (red ↔ blue, neutral mid). Waterfall: up =
  `--div-pos-2`, down = `--div-neg-2`, total = `--chart-total`.
- chrome: `--chart-grid` (hairline), `--chart-baseline` (zero line, links), `--chart-axis` (axis text = text-subtle),
  `--chart-muted` (previous period, "Boshqa", sparkline past), `--chart-wash` (area fill opacity: `class="el-wash"` on the path).
- status = the kit `--success / --warning / --danger / --info` — only when the colour MEANS good/bad, always with an icon or word.
  A series that is just "Samarqand" uses categorical, never status.

**Marks (fixed):** lines 2 px (`vector-effect="non-scaling-stroke"`), bars ≤ 24 px with a 4 px rounded data end and a square
baseline, dots 10–12 px with a 2 px surface ring (`.el-dot`), 2 px surface gaps between touching fills (stacks, segbar, donut,
heat cells), hairline solid gridlines (never dashed, no vertical grid), legend for ≥ 2 series + selective direct labels (end value
only — never a number on every point), text never in a series colour (values/legends use text tokens; the swatch carries identity),
no dual axis, no donut for close values.

**Text never scales:** all chart text is HTML (`.el-axis-x/-y` spans positioned by %, `.el-endlabel`, `.el-gauge-tick`), ≥ 12 px.
The SVG only draws marks: `<svg viewBox="0 0 1000 220" preserveAspectRatio="none">` inside `.el-plot-area`; dots/labels are
HTML at `left/top` %. Fixed-geometry charts (gauge 312 × 176, donut 184/120, ring 56/72) use fixed px SVG, no scaling.

**Class API (copy-paste):**
```html
<section class="el-card el-chart" aria-labelledby="c-fin">
  <div class="el-chart-head">
    <div class="el-chart-titles"><h2 class="el-chart-title" id="c-fin">Moliyaviy tahlil</h2><p class="el-chart-sub">Sof foyda = market tarifi − kuryer tarifi</p></div>
    <div class="el-chart-controls"><div class="el-seg" role="group" aria-label="Grafik davri">…Kunlik/Haftalik/Oylik/Yillik…</div>
      <div class="el-viewtoggle" role="group" aria-label="Ko'rinish"><button type="button" aria-pressed="true">ChartArea-icon Grafik</button><button type="button" aria-pressed="false">Table2-icon Jadval</button></div></div>
  </div>
  <div class="el-plot is-direct" role="img" aria-label="(one-sentence summary)" style="--plot-h: 300px; --plot-h-phone: 180px">
    <div class="el-axis-y" aria-hidden="true"><span style="top: 0%">6 mln</span>…<span style="top: 100%">0</span></div>
    <div class="el-plot-area">
      <span class="el-gridline" style="top: 33.33%"></span> … <span class="el-gridline is-base" style="top: 100%"></span>
      <svg viewBox="0 0 1000 220" preserveAspectRatio="none" aria-hidden="true">
        <path d="…" fill="none" stroke="var(--chart-muted)" stroke-width="2" vector-effect="non-scaling-stroke"/>   <!-- previous -->
        <path class="el-wash" d="… Z" fill="var(--chart-1)" stroke="none"/>
        <path d="…" fill="none" stroke="var(--chart-1)" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      </svg>
      <span class="el-crosshair el-hide-mobile" style="left: 38.46%"></span>
      <div class="el-tip el-hide-mobile" role="status" style="left: calc(38.46% + 14px); top: 0">
        <span class="el-tip-title">30.09.2026, chorshanba</span>
        <div class="el-tip-row"><span class="el-tip-key"></span><span class="el-tip-value">5 068 400 so'm</span><span class="el-tip-label">Joriy</span></div>
      </div>
      <span class="el-dot is-lg" style="left: 100%; top: 18.5%"></span>
    </div>
    <div class="el-plot-end" aria-hidden="true"><span class="el-endlabel" style="top: 18.5%"><strong>4,9 mln</strong></span></div>
    <span></span>
    <div class="el-axis-x" aria-hidden="true"><span class="is-start" style="left: 0%">25.09</span><span class="is-minor" style="left: 15.38%">27.09</span>…<span class="is-end is-current" style="left: 100%">Bugun</span></div><span></span>
  </div>
  <div class="el-chart-foot"><ul class="el-legend"><li class="el-legend-item"><span class="el-legend-key is-line"></span>Joriy davr</li>
    <li class="el-legend-item"><span class="el-legend-key is-line is-muted"></span>Oldingi davr</li></ul></div>
</section>
```
- KPI tile v2: `.el-kpi-row` (4 → 2 → 2 columns) > `.el-kpi` > `.el-kpi-top` (`.el-kpi-label` + `.el-stat-icon`, icon hides on phone)
  · `.el-kpi-value` + `.el-kpi-unit` · `.el-kpi-meta` (`.el-delta.is-up|is-down.is-good|is-bad` with the TrendingUp icon — `is-down`
  flips it; colour = direction × good/bad, e.g. lost revenue up = `is-up is-bad`) · `.el-spark` (SVG 100 × 40, past in
  `--chart-muted`, last segment + `.el-dot` in `--chart-1`). Inline table sparkline: `.el-spark.is-inline` (96 × 24).
- Gauge: `<figure class="el-gauge is-success|is-warning|is-danger" role="img" aria-label="…">` > `.el-gauge-dial` (fixed 312 × 176
  SVG: zone ring 0–40 danger / 40–70 warning / 70–100 success, track `var(--gauge-soft)`, value arc `var(--gauge-c)`, ticks
  0·25·50·75·100, optional target tick, needle + hub; HTML `.el-gauge-tick` labels) > `.el-gauge-readout` (`.el-gauge-value`
  in text colour, `.el-gauge-label`, status `el-badge` with icon + word) > `.el-gauge-foot` (`.el-gauge-stat` × 2: CircleCheck
  sold / CircleX cancelled in `.el-gauge-stat-icon.el-tone-*`). Band rule exactly as `SuccessGauge.tsx`: ≥ 70 / 40–70 / < 40.
- Donut: `.el-donut(.is-side)` > `.el-donut-ring(.is-sm)` (SVG circles with `stroke-dasharray`, 2–2.5 px gaps, start 12 o'clock)
  + `.el-donut-center` (`.el-donut-total`, `.el-donut-label`) > `ul.el-legend-list` > `li.el-legend-row` (key, `.el-legend-name`
  with icon, `.el-legend-value`, `.el-legend-pct`). The legend list IS the table twin.
- Columns: `.el-bars` (`--plot-h`) > `.el-bars-col(.is-hover|.is-focus)` > `.el-bars-value` + `.el-bars-bar` (height %) or
  `.el-bars-stack` > spans (flex = value); labels row `.el-bars-labels`. Horizontal: `ol.el-hbars > li.el-hbar` (`.el-hbar-label`,
  `.el-hbar-track` > `.el-hbar-fill` width % + `.el-hbar-value`).
- Ranked list: `ol.el-rank > li.el-rank-row` (`.el-rank-pos`, `.el-rank-avatar` initials, `.el-rank-main` = `.el-rank-name` +
  `.el-meter.is-thin`, `.el-rank-end` = `.el-rank-value` + `.el-rank-sub`). Phone: 3 rows + "Yana ko'rsatish", avatar hidden.
- Meter / bullet: `.el-meter(.is-thin|.is-thick)(.is-success|.is-warning|.is-danger)` > `span` (width %) + optional
  `span.el-meter-target` (left %). Track = lighter step of the fill's ramp. Ring: `.el-ring(.is-lg)(.is-*)` > SVG + `.el-ring-label`.
- Segbar: `.el-segbar` > spans (`flex: <value> 1 0; background: var(--success)`), 2 px gaps, min 4 px.
- Heatmap: `.el-heat` (inline `grid-template-columns: 28px repeat(N, minmax(0,1fr)); grid-auto-rows: 28px`) > `.el-heat-label(.is-col)`
  + `.el-heat-cell.el-seq-1…5`; legend `.el-heat-scale` > `.el-heat-steps`. No numbers in cells.
- Tile map: `.el-tilemap` (7 columns) > `a.el-tile.el-seq-N` (inline `grid-row / grid-column`) > `.el-tile-name` + `.el-tile-value`;
  phone shows the 2–3 letter code (`el-show-mobile`), full names in the list below. Always keep a table or ranked list next to it.
- Waterfall: `.el-waterfall` (`--plot-h`) > `.el-wf-col` > `.el-wf-bar.is-up|is-down|is-total` (bottom/height %; the starting balance and the end result are both `is-total`) + `.el-wf-value`
  (top %) + `.el-wf-link` (bottom %); labels `.el-wf-labels`. Funnel: `ol.el-funnel` > `.el-funnel-step` (`.el-funnel-label`,
  `.el-funnel-track` > `.el-funnel-bar` width % in `--seq-700 → --seq-250`, `.el-funnel-value`) + `.el-funnel-conv` between steps.
- Tables next to charts: `.el-table.is-compact` (44 px rows). Inline code on boards: `.el-code`.
- States: `.el-chart-loading` > spans `.el-shimmer` (height %) · `.el-chart-empty` (= `.el-empty-*` content, error = danger icon +
  "Qayta urinish") · `.el-chart.is-refetch` (old render at 45%, no skeleton) · "Ma'lumot hali kam" = `.el-chart-note` under the chart.

**Responsive rule:** the classes adapt inside `@container el` — tablet (≤ 1023): KPI 2 columns, side-by-side cards wrap (use
`display:flex; flex-wrap:wrap; gap:16px` rows with `flex: 1 1 340px` cards, never a grid that leaves an empty cell); phone (≤ 767):
chart padding 16, controls full width with 44 px buttons, plot height = `--plot-h-phone` (default 160), `.is-minor` axis labels
hide (keep start, middle, "Bugun"), tooltips/crosshair carry `el-hide-mobile`, KPI value 22 px without icon, donut legend below,
rank avatar hidden, heat 2-hour buckets (separate `el-show-mobile` wrapper — never put `el-show-mobile` on a grid element itself,
it forces `display:flex`). Phone gets a deliberate compact version, never a squashed desktop chart.

**Accessibility:** every chart = `role="img"` + `aria-label` summary sentence (or a figure with a visible table/legend); a
"Grafik | Jadval" twin for every plotted chart (donut/gauge/rank lists already print every value); legend for ≥ 2 series; tooltip
content also reachable by Tab (`.el-hit` buttons ≥ 24 px, phone 44 px) and in the table; status colours always with icon + word;
text ≥ 12 px; meters `role="meter"` with `aria-valuenow`; reduced motion = no animation.

**Recharts / Highcharts (already in package.json):** Recharts — `stroke="var(--chart-1)"`, `strokeWidth={2}`, `fillOpacity={0.1}`,
`dot={false}`, `activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}`, `CartesianGrid vertical={false} stroke="var(--chart-grid)"`,
ticks `fontSize: 12, fill: "var(--chart-axis)"`, `Bar maxBarSize={24} radius={[4,4,0,0]}`, stacks `stroke="var(--surface)" strokeWidth={2}`,
tooltip `content` renders `.el-tip`. Highcharts maps — `colorAxis.dataClasses` from the 5 `--seq-*` steps (read with
`getComputedStyle(el).getPropertyValue('--seq-400')`). SuccessGauge / OrderStatusDonut stay plain SVG (first-screen bundle budget).
