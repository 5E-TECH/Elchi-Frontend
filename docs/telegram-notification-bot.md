# Telegram notification bot setup

Market Telegram guruhini Elchi'ga ulash — **haqiqiy (ishga tushirilgan) oqim**, 2026-10-01
(backend fix3/fix3b CODE-02, frontend fix3b). Bot backendning `notification-service` ichida
**long polling** (`getUpdates`) bilan ishlaydi: webhook yo'q, `setWebhook` qilinmaydi.

Ulashning yagona kaliti — marketning **maxfiy** `market_tg_token`i (`group_token-<32 hex>`).
Uni faqat SUPERADMIN/ADMIN ko'radi va marketga o'zi beradi.

## 1. Admin: market tokenini beradi

1. Superadmin yoki admin `Foydalanuvchilar` ro'yxatidan **market**ning sahifasini ochadi
   (`UserDetailWidget`).
2. Sahifada **"Telegram token"** kartasi bor (`widgets/user-detail/ui/MarketTelegramTokenCard.tsx`):
   - faqat SUPERADMIN/ADMIN ko'radi, faqat market sahifasida va o'z profilida emas; boshqa rollar
     uchun karta umuman chizilmaydi;
   - token sukut bo'yicha yashirin (doim 16 nuqta — uzunligi ham ko'rinmaydi);
   - **"Ko'rsatish" / "Yashirish"** va **"Nusxalash"** tugmalari (yashirin holatda ham haqiqiy
     tokenni nusxalaydi, natija toast bilan);
   - token bo'lmasa: "Bu marketda Telegram token hali yo'q";
   - izoh: "Market Telegram guruhiga botni qo'shib, shu tokenni yuborsin".
3. Admin tokenni marketga beradi.

Backend: token faqat `GET /users/:id` javobida (`market_tg_token`), faqat SUPERADMIN/ADMIN
so'rovida va faqat market qatorida qaytadi. Menejer uni hech qachon ko'rmaydi (biznes qarori #5).
Token react-query keshida (shu `GET /users/:id` javobi) faqat SA/admin sessiyasida turadi.

## 2. Market: guruhni ulaydi

1. Market notification botni o'z Telegram guruhiga qo'shadi.
2. Guruhga token matnini yuboradi:
   - `group_token-<secret>` — **yangi buyurtmalar** guruhi (`create`, sukut; `-create` qo'shimchasi ham bo'ladi);
   - `group_token-<secret>-cancel` — **bekor qilingan buyurtmalar** guruhi.
3. Bot guruhga javob yozadi: "<Market> uchun Telegram guruhi ulandi" yoki xato sababi (o'zbekcha).

Qoidalar (backend `notification-service.service.ts` — `parseGroupTokenText` / `connectGroupByTokenText`):

- Faqat marketning **joriy** maxfiy tokeni qabul qilinadi (`identity.market.find_by_tg_token`).
  Eski `group_token-<marketId>` ko'rinishi **rad etiladi** ("Token formati noto'g'ri…"); noma'lum
  token — "Token topilmadi yoki yaroqsiz".
- Ulashdan keyin token **almashtirilmaydi** — u marketning order-bot kaliti bo'lib qoladi.
  (`identity.market.rotate_tg_token` RPC'ni endi hech kim chaqirmaydi.)
- Mavjud (market, guruh turi) ulanishi bot/token orqali **hech qachon qayta yozilmaydi** — faol yoki
  nofaol bo'lsin (o'chirilgan ulanish to'sqinlik qilmaydi). Bot javobi: "Bu market uchun bu turdagi
  guruh allaqachon ulangan — admin orqali o'zgartiring". Qayta ulash faqat admin orqali:
  `PATCH /notifications/:id` yoki `DELETE /notifications/:id` (keyin qaytadan ulash).
  Shu sababli guruh chatida ko'ringan token allaqachon ulangan guruhni "o'g'irlay" olmaydi.
- Shu guruh shu turga allaqachon ulangan bo'lsa: "Bu guruh shu xabar turi uchun allaqachon ulangan".
- Token matni bazada saqlanmaydi (`telegram_market.token = null`); guruhga xabarni env bot
  (`TELEGRAM_BOT_TOKEN`) yuboradi. Kutilmagan xato matni guruhga chiqarilmaydi (faqat logda).
- Eslatma (tekshirish kerak): guruhdagi oddiy (komanda bo'lmagan) matn botga faqat BotFather'da
  privacy mode o'chirilgan bo'lsa yoki bot guruh admini bo'lsa yetib boradi.

## 3. Bot komandalar

| Guruhda yoziladi | Bot javobi |
|---|---|
| `/id` yoki `/id@<bot_username>` | `Group ID: <chat.id>` |
| `/start` (aynan shu, qo'shimchasiz) | ulash bo'yicha qisqa ko'rsatma (maxfiy token, `-cancel`) |
| `/help` | komandalar: `/start`, `/help`, `/id`; ulangan guruhni almashtirish faqat admin orqali |
| `group_token-…` | guruhni ulash (yuqoridagi qoidalar) |

`/start <payload>` va `/start@bot` ga javob yo'q (faqat aynan `/start`).

## 4. Admin qo'lda ulash (fallback)

`Bildirishnomalar` sahifasi (`/notifications`; frontendda faqat **superadmin** ochadi — backend
route'lari SUPERADMIN/ADMIN) → "Bildirishnoma qo'shish" modali (`NotificationFormModal`):
market + Telegram group ID + xabar turi → `POST /notifications`:

```json
{
  "market_id": "12",
  "group_id": "-1001234567890",
  "group_type": "create"
}
```

`group_type` faqat `create` yoki `cancel`. Group ID ni guruhda `/id` yozib olish mumkin; bot o'sha
guruhga qo'shilgan bo'lishi kerak. (Modaldagi "Group ID ni qanday olish mumkin?" yordam matni hali
"botga /id komandasi qo'shilsa…" deydi — `/id` endi ishlaydi.)

Modaldagi eski **"Token orqali ulash"** bo'limi olib tashlandi (fix3b): u
`POST /notifications/connect-by-token` ga `{ token }` yuborardi va har doim 400 olardi.

## 5. Backend endpointlar

| Endpoint | Rollar | Izoh |
|---|---|---|
| `GET /notifications`, `GET /notifications/:id` | SUPERADMIN, ADMIN | ulanishlar ro'yxati |
| `POST /notifications` | SUPERADMIN, ADMIN | qo'lda ulash (yuqoridagi tana) |
| `PATCH /notifications/:id`, `DELETE /notifications/:id` | SUPERADMIN, ADMIN | qayta ulashning yagona yo'li |
| `POST /notifications/connect-by-token` | SUPERADMIN, ADMIN, REGISTRATOR | tana `{ "text": "group_token-<secret>[-cancel]", "group_id": "-100…" }` — ikkalasi majburiy; bot bilan bir xil qoidalar |
| `POST /notifications/send` | SUPERADMIN, ADMIN, REGISTRATOR | guruh(lar)ga qo'lda xabar |

Frontendda `connect-by-token` ni chaqiradigan UI yo'q: `useConnectNotificationByToken` hooki
`{ text, group_id }` ga moslangan, lekin ishlatilmaydi; `entities/coverage/miscCoverage.ts`
dagi coverage hooki erkin tana yuboradi.

**Avtomatik xabarlar:** hozircha hech bir servis buyurtma yaratilganda yoki bekor qilinganda ulangan
guruhga **avtomatik** xabar yubormaydi — faqat `POST /notifications/send` va admin
`POST /notifications/dispatch` (ixtiyoriy telegram relay). Bu alohida qaror.

## 6. Kerakli env

Backend (`notification-service`, `.env.example`):

```env
# Notification bot (guruh ulash, /id). Bo'sh bo'lsa listener o'chiq.
TELEGRAM_BOT_TOKEN=
# Order-create bot (alohida BotFather tokeni). Bo'sh bo'lsa o'chiq.
ORDER_BOT_TOKEN=
ORDER_BOT_WEBAPP_URL=
```

Frontend:

```env
# "Botni Telegram groupga qo'shish" tugmasi uchun (https://t.me/<bot>?startgroup=notification)
VITE_TELEGRAM_NOTIFICATION_BOT_USERNAME=
```

**Prod holati (2026-10-01):** `VITE_TELEGRAM_NOTIFICATION_BOT_USERNAME` hech bir frontend env
faylida yo'q — modal "Bot username sozlanmagan" ogohlantirishini ko'rsatadi. Prod backendda
`TELEGRAM_BOT_TOKEN` hali placeholder, `ORDER_BOT_TOKEN` qo'yilmagan — ops haqiqiy tokenlarni
qo'ymaguncha ikkala bot ham ishlamaydi. Tokenlarni repoga yozmang.

## Mavjud EMAS

Bu hujjatning avvalgi versiyasidagi reja amalga oshirilmagan va backendda yo'q:
`POST /notifications/connect-token` (10–15 daqiqalik token), deep-link `?startgroup=<token>`,
`/connect <token>` komandasi, `POST /telegram/notification/webhook`, `TELEGRAM_WEBHOOK_SECRET`,
`TELEGRAM_NOTIFICATION_BOT_USERNAME` (backend env). Ulash faqat yuqoridagi maxfiy token +
`/id` + admin `POST /notifications` orqali.
