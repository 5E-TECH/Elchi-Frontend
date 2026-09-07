# Elchi-Frontend — To'liq Audit Hisoboti (v2, dev-merge'dan keyin)

> Sana: 2026-08-17 · Oldingi audit: 2026-08-12 (5.7/10)
> Metodologiya: `origin/dev` (108 commit oldinda) `shodiyor`ga merge qilingach
> qayta audit — 3 mustaqil agent (backend qamrovi, kod-sifat, merge-sog'ligi)
> real kodni o'qidi, natijalar sifat-darvozalari bilan cross-check qilindi
> (`tsc`, `eslint`, `vitest`, `vite build`).
>
> **Umumiy o'rtacha ball: 6.8 / 10** (oldingi 5.7 dan ↑). Merge reconcile
> qilindi va sessiya yaxshilanishlari saqlanib qoldi; asosiy qolgan qarz —
> **god-komponentlar**, **dev'ning yangi ops-sahifalari** (i18n/error yo'q) va
> **dependency CVE'lar**.

---

## 0. Merge holati — nima bo'ldi va nima tuzatildi

`shodiyor` eski `dev` ustiga yozilgani uchun 108 commit orqada edi. `-X theirs`
bilan merge qilindi (har conflict **dev foydasiga**), so'ng qo'lda reconcile
qilindi. Yakuniy holat **butunlay yashil**:

| Darvoza | Natija |
|---|---|
| TypeScript (`tsc`) | ✅ 0 xato |
| ESLint | ✅ 0 error (253 warning) |
| Testlar (`vitest`) | ✅ 179 passed / 44 fayl |
| Production build | ✅ toza, ichki IP sizmaydi |
| `shodiyor` ↔ `origin/dev` | ✅ 0 orqada (PR conflictsiz merge bo'ladi) |

**Merge qoldirgan muammolar (agent-3 topdi, hammasi tuzatildi):**
- 🔴 **Notification inbox regressiyasi** — qo'ng'iroq (unread badge) dev'ning admin
  sahifasiga olib borardi; inbox UI ulanmagan qolgan edi → yangi `/inbox` route +
  qo'ng'iroq shu yerga (har foydalanuvchi uchun). Tuzatildi.
- **`features/proof-upload`** orphan (dev inline file-input ishlatadi) → o'chirildi.
- **`deriveTopCouriers`** o'lik (dev dashboard'ida top-couriers paneli yo'q) → o'chirildi.
- **`setupInterceptors`** testi merge'da tushib qolgan → dev'ning haqiqiy
  implementatsiyasiga mos yangi test yozildi (401→refresh→retry).

---

## A. Backend qamrovi — Frontend hamma funksiyani qamragan­mi?

**Ha, deyarli to'liq: 268 backend HTTP endpoint'dan 247 tasi (~92.2%) ulangan.**
(Faqat `api-gateway` HTTP ochadi; 13 mikroservis RabbitMQ `@MessagePattern` —
ichki transport, frontendga tegishli emas.) Frontend **100% `API_ENDPOINTS`
registri** orqali ishlaydi (`src/shared/api/endpoints.ts`), literal-string chaqiruv yo'q.

| Modul | Qamrov | Modul | Qamrov |
|---|---|---|---|
| Logistics | 42/42 ✅ | Order | 34/37 |
| Finance | 30/30 ✅ | Investor | 18/21 |
| Branch/Transfer-batches | 28/28 ✅ | Identity/Users | 19/20 |
| Integration | 19/19 ✅ | Catalog/Product | 9/9 ✅ |
| **Notification** | **15/15 ✅** | Auth | 7/7 ✅ |
| Analytics | 6/6 ✅ | **Audit/Activity logs** | **4/4 ✅** |

> ✨ Sessiya hissasi: **Notification (15/15)** va **Activity logs (4/4)** to'liq
> ulandi — oldingi auditda bu 11 endpoint qolib ketgan edi.

### ❌ Frontendga tegishli qolgan bo'shliqlar (8/21)

| Endpoint | Modul | Izoh |
|---|---|---|
| `GET orders/branch/orders`, `.../cancelled` | Order | Filial-rol o'z buyurtmalari ro'yxati — registrda yo'q |
| `admin/partners` (POST/GET/rotate-key/status) | Partner-admin | B2B hamkor (API-mijoz) boshqaruvi — butun domen ulanmagan |
| `GET files/view/:key` | File | Inline ko'rish varianti (hozir `BY_KEY` signed-download ishlatiladi) |

Qolgan 13 ta uncovered — **infra/tashqi** (webhook, gateway health, tashqi B2B
`partner/*` API 8 ta, investor nested-alias 3 ta) — frontend gap emas.

### 🔴 O'lik frontend chaqiruvlari (runtime'da 404)

`src/entities/payments/financeCoverage.ts` da 2 ta endpoint backend'da **yo'q**:
- `GET finance/financial-balance/analytics` (`financeCoverage.ts:89`)
- `GET finance/financial-balance/top-impacts` (`financeCoverage.ts:98`)

→ Bu chaqiruvlar 404 qaytaradi (backend faqat `/entries`, `/history` ochadi).
Backend qo'shilmaguncha olib turish yoki error bilan o'rash kerak.

---

## B. Frontend sifat auditi — 15 o'lchov (1–10)

| # | O'lchov | v1 | **v2** | Qisqa xulosa |
|--:|---|:--:|:--:|---|
| 1 | Xavfsizlik | 7 | **7** | Auth kuchaydi (token `sessionStorage`da, localStorage'da EMAS; session-metadata; single-flight refresh). ⚠️ 23 npm CVE (18 high) |
| 2 | Routing / perf | 7 | **7** | ~60 route lazy; region xaritasi endi lazy (393kB Highcharts alohida chunk). God-komponent + virtualizatsiyasiz ro'yxatlar qoladi |
| 3 | Backend qamrovi | 7 | **8** ↑ | 92.2%; notification+activity ulandi. 2 o'lik finance chaqiruvi |
| 4 | TypeScript | 6 | **6** | `strict`, build toza; 166 `any` (227↓). `entities/*Coverage.ts` chegaralarida `any` oqadi |
| 5 | State management | 6 | **6** | Filter slice `shared/model`da; ~57 `useEffect`-ichida-setState (cascading render) |
| 6 | API qatlami | 6 | **7** ↑ | Interceptor puxta, o'lik axios olib tashlangan, 100% registr. 2 o'lik endpoint |
| 7 | Komponent sifati | 6 | **4** ↓ | **39 fayl >400 qator**, 14 tasi >800: `new_orderUpdate` 1245, `orders/index` 1052, `mainCashbox` 1020, `CreateUserForm` 1020 |
| 8 | Formalar & validatsiya | 6 | **6** | RHF+yup izchil; ba'zi ops-formalarida validatsiya yo'q |
| 9 | i18n (uz/ru/en) | 6 | **8** ↑ | 2535 `t()` chaqiruv, 178/285 faylda; 0 hardcoded kirill. Bo'shliq: ops-sahifalar + 2 toast |
| 10 | Error handling & UX | 6 | **6** | `QueryErrorState` ~14 faylda + inbox optimistik rollback. Ammo moliya/order jadvallar error'siz (silent-empty) |
| 11 | Kod sifati / tooling | 6 | **8** ↑ | ESLint: jsx-a11y + import/order + Prettier; 0 error; console tozalangan |
| 12 | Arxitektura / FSD | 5 | **8** ↑ | Value-buzilishlar 2 taga tushdi (`ScanFeedbackOverlay` shared→pages, `RegionStatsCard` widget→pages) |
| 13 | Accessibility | 5 | **7** ↑ | Rasmlar `alt` bilan; klaviatura yaxshilandi. 2 ta clickable-`div` (select-all) qoladi |
| 14 | Build / env / deploy | 4 | **8** ↑ | `.env.production` (public URL), IP-leak tuzatilgan, wrangler asosiy. Kichik: `wrangler.jsonc`+`.toml` dublikat |
| 15 | Testlar | 3 | **6** ↑ | 179 test / 44 fayl (25↑). Auth+slice+normalizatsiya qamrab olindi. e2e (Playwright spec) hali yo'q |

---

## C. Tuzatish kerak bo'lgan joylar (prioritet bo'yicha)

### 🔴 Ship-blocker
1. **2 o'lik finance endpoint** (`financeCoverage.ts:89,98`) — 404 beradi; olib turish yoki backend qo'shilishini kutish. Dev'ning `financial-balance/AnalysisTab` shularga bog'liq.
2. **23 dependency CVE (18 high)** — `npm audit fix`; `vite` (fs.deny bypass), `picomatch` (ReDoS), `sharp/libvips` CVE'larini yangilash.

### 🟠 Yuqori
3. **Dev'ning 7 ta `*-ops` sahifasi** (`branch-ops`, `integrations-ops`, `investors-ops`, `logistics-ops`, `identity-ops`, `system-ops`, `finance-operators`) — **`useTranslation` yo'q** (hardcoded uzbek), aksarida **error-handling yo'q**, va **sidebar/nav havolasi yo'q** (faqat direct-URL, superadmin). i18n + error + kirish nuqtasi qo'shish.
4. **God-komponentlar (39 fayl >400 qator)** — `new_orderUpdate` (1245), `orders/index` (1052), `mainCashbox` (1020), `CreateUserForm` (1020), `cancelled/detail` (997), `OrderFilters` (954). Hook'lar/bo'limlarga ajratish.
5. **Moliya/order jadvallarida error-state** — `mainCashbox.tsx:210-234` (6+ query `isLoading`-only), `products/list:314`, `OrdersTable` — `isError`→`QueryErrorState`.
6. **~57 `useEffect`-ichida-setState** — `ScanPackageDetail:246`, `new_orderDetail:93,392`, `SalaryPaymentPopup:75`, `rootLayout:15` — render-vaqti derivatsiya yoki `key`-reset.

### 🟡 O'rta
7. **`any` chegaralari** — `entities/*Coverage.ts` (orders 12, finance 11, logistics 10, integrations 9) + `mainCashbox` (22) — OpenAPI'dan tip generatsiya (`openapi-typescript`).
8. **2 FSD buzilishi** — `ScanFeedbackOverlay` (`SCAN_FEEDBACK_EVENT`ni `shared`ga), `RegionStatsCard` (`UzbekistanRegionMap`ni `pages`dan `shared`/`entities`ga).
9. **i18n toast'lar** — `NotificationFormModal:87`, `DeleteNotificationButton:18` hardcoded matnlarni `t()`ga; ops-sahifa placeholderlari.
10. **2 a11y** — `new_orderDetail:392`, `batchDetail:199` clickable-`div` select-all'ni `<button>` (yoki `role`/`tabIndex`/key-handler).

### ⚪ Past
11. `wrangler.jsonc`/`wrangler.toml` dublikatini birlashtirish; path alias (`@shared`); `files/view` + `orders/branch/*` endpointlarni qo'shish yoki hujjatlashtirish.

---

## D. Umumiy xulosa

Merge muvaffaqiyatli reconcile qilindi: `shodiyor` endi **butun `dev` + sessiya
yaxshilanishlarini** o'z ichiga oladi, hamma darvoza yashil, PR conflictsiz.
Sessiya hissasi bo'yicha kuchaygan o'lchovlar: **FSD (5→8)**, **build/env (4→8)**,
**tooling (6→8)**, **i18n (6→8)**, **testlar (3→6)**, **backend qamrovi (7→8)**.

Qolgan asosiy qarz **dev tomonidan kiritilgan**: 7 ta `*-ops` sahifa (i18n/error
yo'q), god-komponentlar va dependency CVE'lar. Umumiy ball **5.7 → 6.8**; C-bo'lim
1–6 punktlarni bajarish ~8 gacha ko'taradi.
