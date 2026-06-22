# Telegram notification bot setup

Bu loyiha frontend-only deploy qilinadi, shuning uchun Telegram group ID ni avtomatik olish frontenddan xavfsiz va ishonchli qilinmaydi. Eng yaxshi yechim: backend ichida Telegram bot ishlaydi va group ID ni Telegram update orqali o'zi oladi.

## Admin flow

1. Admin `Bildirishnomalar` sahifasida market va xabar turini tanlaydi.
2. Frontend backenddan ulash tokeni so'raydi.
3. Backend token, bot username va Telegram deep-link qaytaradi.
4. Admin `Botni groupga qo'shish` tugmasini bosadi.
5. Telegram group ichida bot `/connect <token>` komandasi orqali group ID ni oladi.
6. Backend `market_id`, `group_type`, `group_id` ni saqlaydi.
7. Keyingi orderlarda backend shu groupga xabar yuboradi.

## Kerakli env

Backendda:

```env
TELEGRAM_BOT_TOKEN=123456:ABCDEF
TELEGRAM_WEBHOOK_SECRET=random-secret
TELEGRAM_NOTIFICATION_BOT_USERNAME=your_bot_username
FRONTEND_URL=https://dashboard.example.com
```

Frontendda:

```env
VITE_TELEGRAM_NOTIFICATION_BOT_USERNAME=your_bot_username
```

## Backend endpointlar

### Create connect token

`POST /notifications/connect-token`

Request:

```json
{
  "market_id": "12",
  "group_type": "create"
}
```

Response:

```json
{
  "token": "8f4c2a",
  "bot_username": "your_bot_username",
  "deep_link": "https://t.me/your_bot_username?startgroup=8f4c2a",
  "command": "/connect 8f4c2a",
  "expires_at": "2026-06-22T18:00:00.000Z"
}
```

Token backendda 10-15 daqiqa yashashi yetadi.

### Telegram webhook

`POST /telegram/notification/webhook`

Bot groupga qo'shilganda yoki groupda xabar yozilganda Telegram shu endpointga update yuboradi. Backend update ichidan `message.chat.id` ni oladi.

Bot komandalar:

- `/connect <token>`: tokenni tekshiradi va notification config yaratadi.
- `/id`: group ID ni javob qilib yuboradi; bu fallback uchun qulay.

### Existing notification create

`POST /notifications`

Manual fallback uchun hozirgi kontrakt saqlanadi:

```json
{
  "market_id": "12",
  "group_id": "-1001234567890",
  "group_type": "create"
}
```

`group_type` faqat `create` yoki `cancel` bo'ladi.

## Minimal bot logic

```ts
async function handleTelegramUpdate(update) {
  const message = update.message || update.channel_post;
  if (!message?.chat?.id || !message?.text) return;

  const chatId = String(message.chat.id);
  const text = message.text.trim();

  if (text === "/id" || text.startsWith("/id@")) {
    await telegramSendMessage(chatId, `Group ID: ${chatId}`);
    return;
  }

  const match = text.match(/^\/connect(?:@\w+)?\s+([A-Za-z0-9_-]+)$/);
  if (!match) return;

  const token = match[1];
  const connectToken = await findValidConnectToken(token);

  if (!connectToken) {
    await telegramSendMessage(chatId, "Token noto'g'ri yoki muddati tugagan.");
    return;
  }

  await createOrUpdateNotification({
    market_id: connectToken.market_id,
    group_type: connectToken.group_type,
    group_id: chatId,
  });

  await markConnectTokenUsed(token);
  await telegramSendMessage(chatId, "✅ Bildirishnomalar shu groupga ulandi.");
}
```

## Telegram send helper

```ts
async function telegramSendMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
}
```

## Webhook sozlash

Backend deploy bo'lgandan keyin bir marta:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://api.example.com/telegram/notification/webhook","secret_token":"random-secret"}'
```

Webhook request kelganda `X-Telegram-Bot-Api-Secret-Token` headerini `TELEGRAM_WEBHOOK_SECRET` bilan solishtirish kerak.

## Frontend UX talabi

Ideal UI:

- Asosiy flow: market + xabar turi tanlanadi, keyin backenddan token olinadi.
- Group ID input asosiy ko'rinmasin; faqat `Qo'lda qo'shish` fallback ichida tursin.
- Bot username bo'lsa `https://t.me/<bot_username>?startgroup=<token>` linki ochiladi.
- Ulanishdan keyin frontend notifications listni refetch qiladi.

