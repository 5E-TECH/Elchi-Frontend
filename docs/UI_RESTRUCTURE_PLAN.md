# Elchi UI qayta tuzish rejasi — sidebar guruhlash, tab birlashtirish, sozlamalarni yig'ish

**Sana:** 2026-09-10 · **Holat:** REJA (kod yozilmagan) · **Qamrov:** `Elchi-Frontend`

Bu hujjat uchta savolga javob beradi:
1. UI hozir qanday tuzilgan va nega chalkash?
2. Qaysi tablar takrorlanadi yoki mantiqan bir xil — nimani birlashtirish mumkin?
3. Sozlamalarni bir joyga yig'ish uchun qaysi qismni qayerga ko'chiramiz?

---

## 0. ⚠️ Eng muhim texnik haqiqat — buni bilmasdan tegib bo'lmaydi

**Sidebar faqat navigatsiya emas — u RUXSAT TIZIMI ham.**

`src/app/lib/routes.tsx:225`:

```ts
const canViewSidebarPath = (path: string) => (state) =>
  getSidebarConfigForUser(role, user).some((item) => item.to === path);

const canViewOrders           = canViewSidebarPath("/orders");
const canViewMails            = canViewSidebarPath("/mails");
const canViewUsers            = canViewSidebarPath("/all-users");
const canViewFinancialBalance = canViewSidebarPath("/financial-balance");
const canViewNotifications    = canViewSidebarPath("/notifications");
const canViewBranches         = canViewSidebarPath("/branches");
const canViewLogs             = canViewSidebarPath("/logs");
```

**Oqibati:** bandni menyudan olib tashlash = sahifani **hamma uchun yopish** (403).
Bandning `to` qiymatini o'zgartirish ham xuddi shunday — moslik **aniq satr tengligi**
bo'yicha.

| Nima qilinsa | Nima bo'ladi |
|---|---|
| `/mails` bandini guruh ichiga ko'chirsak, `to` o'zgarmasa | ✅ xavfsiz |
| `/mails` ni `/work/mails` ga o'zgartirsak | ❌ `canViewMails` hammaga `false` → 403 |
| `/notifications` ni menyudan olib, Tizim sahifasiga tab qilsak | ❌ sahifa butunlay yopiladi |

> **Qoida:** qayta tuzishning **birinchi qadami** — bu 7 ta guardni sidebar'dan
> ajratib, aniq rol/filial shartlariga o'tkazish. Busiz boshqa hech narsaga
> tegib bo'lmaydi.

---

## 1. Hozirgi tuzilish — raqamlar

### 1.1 Sidebar konfiguratsiyalari

Bitta rol uchun bitta menyu emas — **10 xil konfiguratsiya**:

| Konfiguratsiya | Bandlar soni | Izoh |
|---|---:|---|
| `superadmin` | 14 | eng uzun ro'yxat |
| `admin` | 13 | |
| `market` | 6 | |
| `registrator` | 6 | |
| `courier` | 6 | |
| `manager` (bazaviy) | 3 | filial turi aniqlanmasa |
| `manager` + `REGIONAL` | 8 | |
| `manager` + `PICKUP` | 6 | |
| `manager` + `HYBRID` | 11 | |
| `manager` + `HQ` | 5 | |

Menejer uchun menyu **filial turiga** qarab o'zgaradi (`getUserBranchType`),
ya'ni bitta rol — to'rt xil ko'rinish. Bu qo'llab-quvvatlashda eng qimmat joy.

### 1.2 Sidebar bandlari (21 ta noyob yo'l)

`/` · `/orders` · `/new-orders` · `/mails` · `/dispatch` · `/batches` · `/returns` ·
`/courier-bulk` · `/products` · `/all-users` · `/market-operators` · `/payments` ·
`/cash-box` · `/financial-balance` · `/regions` · `/branches` · `/partners` ·
`/notifications` · `/activity-logs` · `/logs` · `/branch-dashboard`

**Hech qanday guruh yo'q** — 14 band bir tekis ro'yxatda, ierarxiyasiz.

---

## 2. 🔴 Yetim sahifalar — UI'dan umuman ochib bo'lmaydi

Kod bor, marshrut bor, lekin **hech qayerdan havola yo'q**. Faqat URL qo'lda
yozilsa ochiladi.

| Sahifa | Qatorlar | Nima qiladi | Kim ko'radi |
|---|---:|---|---|
| `/settlement` | 210 | **COD hisob-kitobi**: Kuryer→Filial, Filial→HQ oyoqlari | superadmin |
| `/finance-operators` | 136 | Moliya operatorlari | superadmin |
| `/identity-ops` | 104 | Foydalanuvchi/identity operatsiyalari | superadmin |
| `/system-ops` | 85 | Tizim operatsiyalari | superadmin |
| `/logistics-ops` | 80 | Logistika operatsiyalari | superadmin |
| `/investors-ops` | 71 | Investor operatsiyalari | superadmin |
| `/branch-ops` | 67 | Filial operatsiyalari | superadmin |
| `/integrations-ops` | 61 | Integratsiya debitorligi + sinxronlash | superadmin |

**Jami 814 qator ishlaydigan kod, foydalanuvchi uchun mavjud emas.**

Qo'shimcha: bu 8 sahifa **antd** bilan yozilgan, qolgan ilova esa **tailwind +
maxsus dizayn**. Ya'ni ochilsa ham begona ko'rinadi.

> `/profile`, `/settings`, `/inbox`, `/main-cashbox` yetim EMAS — ular header'dan
> (⚙️ va 🔔) yoki `/payments` kartasidan ochiladi. Lekin sidebar'da yo'q, shuning
> uchun ularni topish uchun bilish kerak.

---

## 3. 🟠 Takrorlangan va mantiqan yaqin tablar

### 3.1 Aniq chalkashlik — nomi bir xil, ma'nosi boshqa

| # | A | B | Nega chalkash | Taklif |
|---|---|---|---|---|
| **D1** | `/partners` — **Hamkorlar** | `/new-orders/integrations` — **Integratsiyalar** | Ikkalasi ham "integratsiya". A = bizga API orqali buyurtma **yuboradigan** tizimlar (BeePost). B = buyurtma **manbalari** (do'kon ulanishlari). Foydalanuvchi farqni ajratmaydi | **BIRLASHTIRISH** — bitta "Integratsiyalar" uyi, ichida 3 tab: *Hamkorlar (API)* · *Manbalar* · *Kiruvchi posilkalar* |
| **D2** | `/orders` — **Buyurtmalar** | `/new-orders` — **Bugungi buyurtmalar** | "Bugungi" noto'g'ri nom: u yerda market/integratsiya/filial/bekor tablari bor, ya'ni u **yaratish va qabul** yuzasi. `/orders` esa **operatsion ro'yxat** | **QAYTA NOMLASH** (birlashtirmaslik) — `/new-orders` → "Qabul va yaratish" |
| **D3** | `/batches` (412 q.) | `/new-orders/branches/:id` (412 q.) | Ikkalasi ham paket ro'yxati, ikki xil kod | **BIRLASHTIRISH** — bitta paket komponenti, kontekst prop bilan |
| **D4** | `/activity-logs` | `/logs` | Ikkisi ham "jurnal": biri audit izi, ikkinchisi tizim loglari | **BIR UYGA** — "Jurnallar" ichida 2 tab |
| **D5** | `/notifications` | `/inbox` | A = adminning yuborish paneli, B = shaxsiy qutisi. Nomi deyarli bir xil | **AJRATISH** — A → "Bildirishnoma yuborish" (Tizim), B → header 🔔 (o'z joyida) |

### 3.2 Pul — 6 ta alohida yuza

| Yo'l | Nima | Holat |
|---|---|---|
| `/payments` | Kassa (806 qator) | sidebar'da |
| `/cash-box` | Mening kassam | sidebar'da (kuryer/market) |
| `/main-cashbox` | Asosiy kassa | `/payments` kartasidan |
| `/financial-balance` | Moliyaviy balans (392 q.) | sidebar'da |
| `/settlement` | **COD hisob-kitob oyoqlari** | 🔴 yetim |
| `/finance-operators` | Moliya operatorlari | 🔴 yetim |

**Taklif:** bitta **"Moliya"** guruhi — Kassa · Balans · Hisob-kitob · Operatorlar.
`/main-cashbox` va `/cash-box` — Kassa sahifasining ichki tablari.

### 3.3 To'g'ri tuzilgan joylar (tegmaymiz)

| Yuza | Nega yaxshi |
|---|---|
| `/regions` → `districts` · `sato-management` · `logist-assignment` | Geo bo'limi allaqachon ichma-ich va mantiqan bir joyda |
| `/mails` → `today` · `return` · `refused` · `old` | Bitta sahifa, 4 tab — to'g'ri naqsh |
| `/new-orders` → markets · integrations · branches · cancelled | Tab tuzilishi bor; faqat nomi va ichidagi taqsimot qayta ko'rilishi kerak |

---

## 4. ⚙️ "Sozlamalar" muammosi — so'z ikki ma'noda ishlatilgan

| Ma'no | Hozir qayerda | Muammo |
|---|---|---|
| **Shaxsiy sozlamalar** (mavzu, til, vidjetlar, skaner ovozi) | `/settings` — 507 qator, header ⚙️ dan | To'g'ri ishlaydi, lekin sidebar'da yo'q |
| **Tizim konfiguratsiyasi** (kim, qayerda, qanday ulanadi) | **Uyi YO'Q** — bandlar tekis ro'yxatda sochilgan | Operator "sozlamani qayerdan topaman?" deb so'raydi |

Tizim konfiguratsiyasiga tegishli, lekin alohida turgan bandlar:

`/branches` · `/regions` (+3 bola) · `/partners` · `/notifications` · `/all-users` ·
`/products` · `/activity-logs` · `/logs` + 7 ta `*-ops`

---

## 5. ✅ Taklif — 5 guruhli sidebar

Guruhlar **yig'iladigan** (collapsible), yo'llar **o'zgarmaydi**.

| Guruh | Ichidagi bandlar | Kim ko'radi |
|---|---|---|
| **1. Ish** | Boshqaruv paneli · Buyurtmalar · Qabul va yaratish · Pochta · Jo'natish · Tezkor amal · Paketlar · Qaytarishlar | rolga qarab |
| **2. Moliya** | Kassa (+ Asosiy kassa, Mening kassam) · Balans · **Hisob-kitob** · **Moliya operatorlari** | admin/superadmin/manager |
| **3. Ma'lumotnoma** | Mahsulotlar · Foydalanuvchilar · Filiallar · Hududlar (+ Tumanlar, SOATO, Logist) | admin/superadmin |
| **4. Integratsiyalar** | **Hamkorlar** · **Manbalar** · **Kiruvchi posilkalar** | admin/superadmin |
| **5. Tizim** | Bildirishnomalar · Jurnallar (Audit + Tizim) · **Ops vositalari** (7 sahifa) | superadmin |
| *(Header)* | Profil · Sozlamalar · Inbox 🔔 | hamma |

**Qalin** = hozir yetim yoki topilmaydigan, guruhlash bilan **birinchi marta
ko'rinadigan bo'ladi**.

---

## 6. 📦 Ko'chirish jadvali — nima qayerdan qayerga

| # | Nima | Hozir | Bo'ladi | Xavf |
|---|---|---|---|---|
| M1 | 7 ta `*-ops` sahifa | 🔴 yetim | **Tizim → Ops vositalari** (bitta sahifa, 7 tab) | past |
| M2 | `/settlement` | 🔴 yetim | **Moliya → Hisob-kitob** | past |
| M3 | `/main-cashbox`, `/cash-box` | tarqoq | **Moliya → Kassa** ichki tablari | o'rta |
| M4 | `/partners` | alohida band | **Integratsiyalar → Hamkorlar** | past |
| M5 | `/new-orders/integrations` | Bugungi buyurtmalar ichida | **Integratsiyalar → Manbalar** | **yuqori** — `canManageExternalIntegrations` va tab holati |
| M6 | `/new-orders/integrations/incoming` | Bugungi buyurtmalar ichida | **Integratsiyalar → Kiruvchi posilkalar** | o'rta |
| M7 | `/activity-logs` + `/logs` | ikki band | **Tizim → Jurnallar** (2 tab) | **yuqori** — `canViewLogs` sidebar'ga bog'langan |
| M8 | `/notifications` | alohida band | **Tizim → Bildirishnomalar** | **yuqori** — `canViewNotifications` sidebar'ga bog'langan |
| M9 | `/districts`, `/sato-management`, `/logist-assignment` | `/regions` bolalari | **o'z joyida qoladi** (to'g'ri tuzilgan) | — |
| M10 | `/batches` va `/new-orders/branches` | ikki xil kod | bitta komponent, ikki kirish nuqtasi | o'rta |

---

## 7. Bosqichlar

| Bosqich | Ish | Kun | Bog'liqlik |
|---|---|---:|---|
| **B0** | **7 guardni sidebar'dan ajratish** — aniq rol/filial shartlariga o'tkazish + test | **1.5** | — |
| **B1** | Sidebar guruhlash (yig'iladigan, `to` o'zgarmaydi) | 1 | B0 |
| **B2** | Yetimlarni ko'rsatish: Ops vositalari + Hisob-kitob (M1, M2) | 1 | B1 |
| **B3** | Integratsiyalar uyi (M4, M5, M6) | 2 | B1 |
| **B4** | Moliya guruhi (M3) + Jurnallar (M7) + Bildirishnomalar (M8) | 2 | B0, B1 |
| **B5** | Paket kodini birlashtirish (M10) + `/new-orders` nomini o'zgartirish (D2) | 1.5 | — |
| **B6** | Ops sahifalarini tailwind'ga o'tkazish (dizayn birligi) | 2 | B2 |

**Jami: 11 kun.** B0 → B1 → B2 minimal yo'l = **3.5 kun** va eng katta foyda
(yetim sahifalar ko'rinadi, menyu guruhlanadi).

---

## 8. Tasdiq kerak bo'lgan qarorlar

| # | Savol | Tavsiyam |
|---|---|---|
| Q1 | `/partners` va `/new-orders/integrations` birlashtirilsinmi? | **Ha** — ikkalasi "integratsiya", alohida turishi chalkashlikning asosiy manbai |
| Q2 | `/activity-logs` va `/logs` bitta sahifada 2 tab bo'lsinmi? | **Ha** |
| Q3 | 7 ta `*-ops` bitta sahifada 7 tab bo'lsinmi, yoki alohida-alohida? | **Bitta sahifa** — ular kamdan-kam ochiladi |
| Q4 | `/new-orders` "Qabul va yaratish" deb nomlansinmi? | **Ha** — "Bugungi buyurtmalar" nomi mazmuniga mos emas |
| Q5 | Menejer uchun 4 xil filial menyusi soddalashtirilsinmi? | Alohida ko'rib chiqish kerak — bu biznes qoidasi |
