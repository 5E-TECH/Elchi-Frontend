import { useEffect, useState, type RefObject } from "react";

/**
 * KAM YORUG'LIK — «Chiroq — avtomatik» (Sozlamalar → Skaner, maket `common-settings-scanner`; ega qarori:
 * chiroq o'zi yoqilmaydi, yorug'lik kam bo'lsa yoqish TAKLIF qilinadi). Kadr vaqti-vaqti bilan 32 × 24 ga
 * kichraytirib o'qiladi va o'rtacha yorqinlik hisoblanadi. Kadrni o'qib bo'lmasa (canvas yo'q, tasvir hali
 * kelmagan) — taklif yo'q: chiroq faqat qo'lda.
 */

/** O'rtacha yorqinlik (0–255, Rec. 601) — RGBA piksellar. */
export const averageLuma = (data: ArrayLike<number>): number => {
  const pixels = Math.floor(data.length / 4);
  if (pixels === 0) return 255;
  let sum = 0;
  for (let i = 0; i < pixels * 4; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return sum / pixels;
};

/** Shundan past — qorong'i; ketma-ket `LOW_SAMPLES` o'lchov kerak (bir lahzalik soya taklif chiqarmaydi). */
export const LOW_LIGHT_LUMA = 50;
/** Taklif yo'qolishi uchun yorqinlik (titrab turmasin). */
const BRIGHT_LUMA = 70;
const LOW_SAMPLES = 2;
export const LOW_LIGHT_INTERVAL_MS = 1200;

const SAMPLE_W = 32;
const SAMPLE_H = 24;

export const useLowLight = ({
  videoRef,
  enabled,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
}): boolean => {
  const [low, setLow] = useState(false);
  // O'lchash o'chsa (chiroq yoqildi, kamera to'xtadi) — taklif darhol yo'qoladi; render paytida, effektsiz.
  if (!enabled && low) setLow(false);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return undefined;
    let context: CanvasRenderingContext2D | null = null;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = SAMPLE_W;
      canvas.height = SAMPLE_H;
      context = canvas.getContext("2d", { willReadFrequently: true });
    } catch {
      context = null;
    }
    if (!context) return undefined;
    const ctx = context;
    let darkSamples = 0;
    const timer = window.setInterval(() => {
      const video = videoRef.current;
      // HAVE_CURRENT_DATA (2) — kadr bor.
      if (!video || video.readyState < 2) return;
      let luma: number;
      try {
        ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
        luma = averageLuma(ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data);
      } catch {
        window.clearInterval(timer);
        return;
      }
      if (luma < LOW_LIGHT_LUMA) {
        darkSamples += 1;
        if (darkSamples >= LOW_SAMPLES) setLow(true);
      } else {
        darkSamples = 0;
        if (luma > BRIGHT_LUMA) setLow(false);
      }
    }, LOW_LIGHT_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, videoRef]);

  return enabled && low;
};
