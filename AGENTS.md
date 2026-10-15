# Elchi Frontend — majburiy qoidalar (frontchilar va AI agentlar uchun)

React 19 + Vite + Tailwind v4 + antd 6, Feature-Sliced Design (`app → pages → widgets → features → entities → shared`).
To'liq dizayn qoidalari: **`docs/DESIGN_SYSTEM.md`** — UI'ga tegadigan har ishdan oldin o'qing.

## Dizayn v2 (ega qarori, qulflangan)
- **Ranglar faqat tokenlardan.** `bg-surface`, `text-text-muted`, `border-border`, `bg-action text-on-solid`,
  `bg-success-soft text-success-fg` … Yangi kodda hex/`rgb()`, Tailwind rang oilalari (`bg-blue-500`,
  `text-gray-400`), `dark:` juftlari va eski nomlar (`main`, `maindark`, `primarydark`, `purple*`, `border-soft`)
  **yozilmaydi**. Token yetmasa — `src/index.css` + `src/shared/config/themeTokens.ts` ga birga qo'shing
  (`themeTokens.test.ts` ularni solishtiradi).
- **Brend:** navy `#1f2853` + ko'k action. Binafsha/indigo (`#7c3aed`, `#6366f1`, `#576adb`) qaytarilmaydi
  (`src/test/paletteGuard.test.ts`). Ko'k — faqat interaktiv narsa.
- **Sukut mavzusi — kunduzgi.** Shrift — Manrope. Matn 12px dan kichik emas.
- **Pul/son** faqat `src/shared/lib/formatMoney.ts` orqali (`formatMoneyLocalized`, `formatCompactMoneyLocalized`,
  `formatNumberLocalized`). `Intl.NumberFormat("uz-UZ")` va qo'lda `" so'm"` qo'shish taqiqlanadi.
  Valyuta: uz `so'm` · ru `сум` · en `UZS`.
- **Ikonkalar** faqat `lucide-react` (`docs/design/icon-registry.json` dagi kanonik nom).
- **Holat** rangi faqat matn/ikonka bilan; ton qoidasi `docs/DESIGN_SYSTEM.md` §8.
- **Telefon:** bosiladigan har narsa ≥ 44px, jadval → kartalar, dialog → pastdan oyna, gorizontal skroll yo'q.
- **Matn:** o'zbek lotin, gap registri, inglizcha so'z yo'q; uz/ru/en uchala locale'ni birga yangilang.

## Ish tartibi
- Push qilishdan **oldin** to'liq `npm test` (nishonli test menyu invariantlarini — `ops.reachability.test.ts` —
  o'tkazib yuboradi) va `npm run build` (CI `tsc -b` qat'iy).
- Kodni `origin/dev` bo'yicha tekshiring; lokal branch eskirgan bo'lishi mumkin.
- `.env.local` hech qachon commit qilinmaydi.
