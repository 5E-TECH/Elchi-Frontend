/**
 * Kiruvchi posilkalar ekranining sof mantiqi — React'siz, testga qulay.
 */

export interface WaitingLabel {
  text: string;
  /** Uzoq kutgan posilka — e'tibor kerakligini bildiradi. */
  stale: boolean;
}

/**
 * Eng eski posilka qancha kutgani.
 *
 * NEGA KERAK. Unutilib qolgan manba aks holda hech qayerda ko'rinmaydi: soni
 * kichik bo'lsa ro'yxat oxirida turib e'tibordan chetda qolardi va posilkalar
 * omborda haftalab yotishi mumkin edi.
 *
 * ⚠️ `stale` chegarasi — UCH KUN. Bir kun normal (posilka yo'lda bo'lishi
 * mumkin), uch kun esa unutilgan degani. Chegara shu yerda, chunki u ekranda
 * ikki joyda ishlatiladi (matn va rang) va ikkisi bir xil bo'lishi shart.
 */
export const waitingFor = (
  iso: string | null | undefined,
  now: number = Date.now(),
): WaitingLabel => {
  if (!iso) return { text: "—", stale: false };

  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return { text: "—", stale: false };

  const ms = now - at;
  // Kelajakdagi sana — server/mijoz vaqti farqi. "minus 2 soat" deb
  // ko'rsatishdan ko'ra "hozir" deyish to'g'ri.
  if (ms < 0) return { text: "hozir", stale: false };

  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return { text: "bugun", stale: false };
  if (hours < 24) return { text: `${hours} soat`, stale: false };

  const days = Math.floor(hours / 24);
  return { text: `${days} kun`, stale: days >= 3 };
};
