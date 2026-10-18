## Nima o'zgardi

<!-- Qisqa: nima va nima uchun. Trello karta havolasi. -->

## Dizayn v2

<!-- UI'ga tegmasa: "UI o'zgarmadi" deb yozing va bu bo'limni o'tkazib yuboring.
     Qoidalar: AGENTS.md · docs/DESIGN_SYSTEM.md · design/README.md · design/CODE-MAP.md -->

**Maket:** `<rol>-<viewId>`, … <!-- design/SCREENS.md dan. Maket yo'q bo'lsa: "maket yo'q — eng yaqini: `<ekran>`" -->

**Sahifa turi:** yangi ekran / v2 sahifa / eski (v1) sahifa — kichik qo'shimcha / eski sahifa — bo'lim ko'chirildi / sahifa to'liq ko'chirildi (`// dizayn-v2:`)

**Maketdan farqlar va sababi:** <!-- yo'q bo'lsa "yo'q" -->

| | Kunduzgi | Tungi |
|---|---|---|
| Desktop 1440 | <!-- skrinshot --> | <!-- skrinshot --> |
| Telefon 390 | <!-- skrinshot --> | <!-- skrinshot --> |
| Planshet 768 (jadval yoki layout o'zgargan bo'lsa) | <!-- skrinshot --> | |

- [ ] Maket topildi va ko'rildi (`npm run design:shot -- <ekran>`), barcha rollar uchun
- [ ] Kunduzgi, tungi va 390px skrinshotlar yuqorida
- [ ] Faqat tokenlar: hex / `rgb()`, `bg-blue-500` kabi rang oilalari, `dark:` juftlari, eski nomlar (`main`, `maindark`, `primary*`, `purple*`, `border-soft` …) yo'q
- [ ] Pul/son `formatMoney.ts` orqali; ikonka `lucide-react`; matn uz/ru/en uchala locale'da
- [ ] Xom `<button>` / `<select>` / matn `<input>` / `<textarea>`, antd vizual komponenti va `@ant-design/icons` yo'q (`npm run lint` — `design-v2/*`): amal — `Button` / `IconButton`, karta / qator / chip / menyu bandi / kalit — `Pressable`
- [ ] Telefon: gorizontal skroll yo'q, bosiladigan narsalar ≥ 44px, jadval → kartalar, dialog → pastki varaqa; matn ≥ 12px
- [ ] Eski sahifada: tegilgan qism v2 da, eski uslub kengaytirilmagan
- [ ] Dizayn qo'riqchisi yashil (`npm test` + `npm run design:guard -- --diff`), baseline oshirilmagan, sababsiz `design-guard-ignore` yo'q
- [ ] Eski fayl tozalangan bo'lsa, yangi son qotirilgan (`npm run design:guard -- --update`)
- [ ] «Visual» (GitHub Actions) yashil; farq kutilgan bo'lsa — «Actions → Visual → Run workflow» (update) bilan baseline yangilangan va diff (`visual-report`) ko'rib chiqilgan; «baseline yo'q» bo'lsa — yaratilgan (docs/DESIGN_SYSTEM.md §12.5)
- [ ] Route qo'shilgan, o'chirilgan yoki sahifa v2 ga ko'chirilgan bo'lsa: `design/kit/route-map.json` yangilangan, `npm run design:screens` yurilgan

## Tekshiruv

- [ ] `npm run lint`
- [ ] `npm test` (to'liq, nishonli emas)
- [ ] `npm run build`
