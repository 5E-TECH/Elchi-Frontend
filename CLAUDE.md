# CLAUDE.md

Bu repodagi barcha majburiy qoidalar `AGENTS.md` da (dizayn v2, qaror oqimi, tokenlar, formatlash, qo'riqchi,
test tartibi, PR ro'yxati):

@AGENTS.md

**Loyiha dizayn v2 ga o'tmoqda.** UI'ga tegadigan har qanday ishda (yangi sahifa, tahrir, komponent, stil, rang,
layout, dialog, jadval, grafik, telefon ko'rinishi) avval **`elchi-design`** skill'ini yuklang
(`.claude/skills/elchi-design/SKILL.md`, yoki `/elchi-design`). Skill maketni topish, uni `npm run design:shot`
bilan **ko'rish**, `design/CODE-MAP.md` bo'yicha yozish va tekshirish tartibini beradi.

- Dizayn tizimining to'liq matni: `docs/DESIGN_SYSTEM.md`.
- Maketlar: `design/` (`design/README.md`, `design/SCREENS.md`).

## Trello (ega qoidasi, 2026-11-20)

- Karta yaratish, tahrirlash, ko'chirish, yorliq va izoh — Trello MCP ulanishi orqali.
- MCP'da yo'q amallar (kartaga **a'zo biriktirish** va h.k.) — Trello REST API (`https://api.trello.com/1/…`).
  Egadan qayta so'ralmaydi: kalitlar bulut muhitining (Default) environment variables'ida — `TRELLO_KEY`,
  `TRELLO_TOKEN`; `api.trello.com` tarmoqda ochiq. Lokal kompyuterda —
  `~/Desktop/Projects/elchi-lid-sotuv/.env.trello`.
- Kalit va token hech qachon chatga, logga, kodga, commit'ga yoki URL'ga chiqarilmaydi: faqat sarlavhada
  (`set -x` siz), masalan a'zo biriktirish:
  `curl -sS -X POST "https://api.trello.com/1/cards/<kartaId>/idMembers?value=<memberId>" -H "Authorization: OAuth oauth_consumer_key=\"$TRELLO_KEY\", oauth_token=\"$TRELLO_TOKEN\""`
- Ega — Shodiyor Ergashev (`shodiyorergashev`, member id `63342f088e17220274b9af5c`). Ega «meni belgila» desa,
  karta unga a'zo qilib biriktiriladi.
- O'zgaruvchilar sessiyada yo'q bo'lsa: `get_environment` da nomlari bor — sessiya qayta ulanishi kerak (egaga
  bir qatorda ayting); nomlari ham yo'q — egaga shu bo'limni ko'rsating.
