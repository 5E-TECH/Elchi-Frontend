# Chek shriftlari (`src/features/print-receipts`)

Buyurtma va paket cheki (maket `tizim-receipts`, Trello HJ5sLHiz) **faqat shu fayllar** bilan o'lchanadi va
chiziladi: jsPDF ularni PDF ichiga joylaydi, brauzer chop etish oynasi esa `@font-face` orqali o'sha TTF'ni yuklaydi —
termal, A4 va brauzer bir xil kenglikda chiqadi. Ilova interfeysi bu fayllarni yuklamaydi (Manrope UI uchun Google
Fonts'dan keladi); ular `?url` bilan faqat chop etish bosilganda so'raladi.

| Fayl | Manba | Litsenziya |
|---|---|---|
| `Manrope-Medium.ttf` (500) | `@expo-google-fonts/manrope@0.4.3` → `500Medium/Manrope_500Medium.ttf` (Google Fonts statik nusxasi, Manrope 4.505) | SIL OFL 1.1 — `OFL-Manrope.txt` |
| `Manrope-SemiBold.ttf` (600) | o'sha paket → `600SemiBold/Manrope_600SemiBold.ttf` | SIL OFL 1.1 — `OFL-Manrope.txt` |
| `Manrope-Bold.ttf` (700) | o'sha paket → `700Bold/Manrope_700Bold.ttf` | SIL OFL 1.1 — `OFL-Manrope.txt` |
| `NotoSans-UzCyrillic-Medium.ttf` (500) | `@expo-google-fonts/noto-sans@0.4.2` → `500Medium/NotoSans_500Medium.ttf` (Noto Sans 2.015), faqat U+0490–04FF | SIL OFL 1.1 — `OFL-NotoSans.txt` |
| `NotoSans-UzCyrillic-Bold.ttf` (700) | o'sha paket → `700Bold/NotoSans_700Bold.ttf`, faqat U+0490–04FF | SIL OFL 1.1 — `OFL-NotoSans.txt` |

Paketlar npm'dan olingan (`https://registry.npmjs.org/@expo-google-fonts/manrope/-/manrope-0.4.3.tgz`,
`…/noto-sans/-/noto-sans-0.4.2.tgz`); ikkalasining `LICENSE_FONT` fayli shu papkada `OFL-*.txt` nomi bilan.
Ikkala shriftda «Reserved Font Name» yo'q — o'zgartirilgan nusxa asl nomini saqlashi mumkin.

## Nima o'zgartirildi

1. **Manrope — tabular raqamlar qotirildi.** Maket raqamlarni `tabular-nums` bilan o'lchaydi
   (`design/kit/helmet.html`), jsPDF esa OpenType `tnum` ni qo'llamaydi — shuning uchun `tnum` cmap'ga qotirilgan
   (har raqam 1240/2000 em). Statik nusxa (500/600/700) Google Fonts'ning o'zinikidir, `varLib.instancer` kerak
   bo'lmadi.
2. **Noto Sans — kichik bo'lak.** Manrope'da ʻ ʼ қ ғ ҳ Қ Ғ Ҳ yo'q. ʻ ʼ chekda «'» ga almashtiriladi
   (`printReceiptFonts.ts` → `normalizeReceiptText`), U+0490–04FF esa Noto Sans'dan chiziladi (matn bo'laklanadi).

```bash
python3 -m venv .venv && .venv/bin/pip install fonttools==4.68.0 opentype-feature-freezer==1.32.2
for w in 500Medium:Medium 600SemiBold:SemiBold 700Bold:Bold; do
  .venv/bin/pyftfeatfreeze -f tnum "manrope/package/${w%%:*}/Manrope_${w%%:*}.ttf" "Manrope-${w##*:}.ttf"
done
for w in 500Medium:Medium 700Bold:Bold; do
  .venv/bin/pyftsubset "noto/package/${w%%:*}/NotoSans_${w%%:*}.ttf" --unicodes="U+0490-04FF" \
    --layout-features='' --no-hinting --desubroutinize --name-IDs='*' --name-languages='*' \
    --output-file="NotoSans-UzCyrillic-${w##*:}.ttf"
done
```

**Kerning.** Maket brauzerda Manrope kerningi bilan chizilgan, jsPDF esa kerning qo'llamaydi. Shuning uchun juftliklar
shu fayllarning o'zidan (GPOS `kern`, `printReceiptKerning.ts`) o'qiladi: o'lchashga qo'shiladi va ikkala renderer
matnni o'sha joylarda suradi (PDF — bo'laklab, HTML — `margin-right`; brauzerning o'z kerningi o'chiq).

Fayl almashtirilsa: `printReceiptFonts.ts` dagi `RECEIPT_FONT_METRICS` (hhea ascent/descent) va `MANROPE_RANGES`
(cmap qamrovi) shu fayllardan qayta olinadi, joylash testlari (`printReceiptLayout.test.ts`) maket bilan solishtiradi.

SHA-256:

```
3c7451f66d4d37efe9756e976695005c5d691bd87f206d5e06cc63f08ccb6217  Manrope-Bold.ttf
1721d9d6b6362b2d35231291a44d3bcbca4349e174e26727101c37266ba1940b  Manrope-Medium.ttf
d8d3083e461fb8313009f2b73c70488ac967f6a03e9d56e5def4d9ccf6870ac7  Manrope-SemiBold.ttf
b40f622f18d6fed4609a439f9620afadeb92b83c2469e2355a52b7d2376628e7  NotoSans-UzCyrillic-Bold.ttf
bcf0a0ed7f21de6d7ee7dc147df6effabb05bb58825552b9f1209b9f793b73e5  NotoSans-UzCyrillic-Medium.ttf
```
