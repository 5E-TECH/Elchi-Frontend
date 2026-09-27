/**
 * AI BUYURTMA UCHUN RASMNI TAYYORLASH — brauzerda kichraytirib JPEG qilish.
 *
 * Telefon surati 5–12MB bo'ladi. Uni shundayligicha yuborish 413 xatosi,
 * sekin yuklash va ortiqcha vision token xarajatiga olib keladi. Shu bois
 * rasm serverga ketishidan OLDIN uzun tomoni {@link MAX_IMAGE_DIM} gacha
 * kichraytiriladi va JPEG ga o'giriladi.
 *
 * ⚠️ BeePost'dan farqi (ataylab): kichik fayl uchun "asl holida qoldirish"
 * istisnosi YO'Q — HAR DOIM canvas orqali JPEG chiqariladi. Elchi
 * file-service `image/webp` va `image/gif` ni qabul qilmaydi; canvas doim
 * `image/jpeg` bergani uchun format mos kelmasligi umuman tug'ilmaydi.
 * Kichik skrinshot matni buzilmasligi uchun sifat 0.92.
 */

/**
 * Uzun tomon chegarasi. ⚠️ O'zgartirmang: 1568px — vision model rasmni
 * shu o'lchamgacha o'zi kichraytiradi (modeldan modelga farq qiladi).
 * Kattaroq yuborish sifat bermaydi, faqat hajm va token xarajatini oshiradi.
 */
export const MAX_IMAGE_DIM = 1568;
export const JPEG_QUALITY = 0.92;
export const MAX_SOURCE_BYTES = 30 * 1024 * 1024;
export const ACCEPTED_INPUT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type PreparedImage = {
  media_type: string;
  /** Sof base64 — `data:image/...;base64,` prefiksisiz (backend shunday kutadi). */
  data_base64: string;
  /** `<img src>` uchun to'liq data URL. */
  preview: string;
  name: string;
  bytes: number;
};

export type PrepareImageErrorCode = "too_large" | "unsupported" | "decode_failed" | "heic_unsupported";

/**
 * Chaqiruvchi foydalanuvchiga ANIQ sabab ko'rsata olishi uchun ("o'qib
 * bo'lmadi" emas). iOS Safari'da katta rasmda canvas xotira cheklovi ham
 * `decode_failed` ga tushadi.
 */
export class PrepareImageError extends Error {
  readonly code: PrepareImageErrorCode;

  constructor(code: PrepareImageErrorCode) {
    super(`prepareImage: ${code}`);
    this.name = "PrepareImageError";
    this.code = code;
  }
}

const OUTPUT_TYPE = "image/jpeg";

const extensionOf = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

/**
 * ⚠️ HEIC/HEIF ni Chrome/Firefox canvas dekodlay olmaydi (Safari oladi).
 * Uni buzuq fayldan ajratish kerak — aks holda "HEIC surat — telefonda JPEG
 * qilib saqlang" degan aniq maslahatni ko'rsatib bo'lmaydi. Ba'zi brauzerlar
 * HEIC uchun bo'sh `type` beradi, shu bois kengaytma ham tekshiriladi.
 */
const isHeic = (file: File) =>
  file.type === "image/heic" || file.type === "image/heif" || ["heic", "heif"].includes(extensionOf(file.name));

const EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

const isAccepted = (file: File) => {
  const type = file.type || EXTENSION_TYPES[extensionOf(file.name)] || "";
  return (ACCEPTED_INPUT_TYPES as readonly string[]).includes(type);
};

/** Tomonlar nisbatini saqlab uzun tomonni `max` ga tushiradi (kattalashtirmaydi). */
export const fitWithin = (width: number, height: number, max = MAX_IMAGE_DIM) => {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

type Drawable = CanvasImageSource & { width: number; height: number };
type Context2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

/** Shaffof PNG qora fon bo'lib chiqmasligi uchun AVVAL oq fon chiziladi. */
const paint = (ctx: Context2D, source: Drawable, width: number, height: number) => {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(blob);
  });

/**
 * Tezkor yo'l: `createImageBitmap` + `OffscreenCanvas` asosiy oqimni kam
 * bloklaydi (`convertToBlob` asinxron). Muhit ularni bermasa `null`.
 */
const encodeWithBitmap = async (file: File): Promise<string | null> => {
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas !== "function") return null;
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    paint(ctx, bitmap, width, height);
    const blob = await canvas.convertToBlob({ type: OUTPUT_TYPE, quality: JPEG_QUALITY });
    return blobToDataUrl(blob);
  } finally {
    bitmap.close();
  }
};

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image decode failed"));
    image.src = url;
  });

/**
 * Zaxira yo'l: `new Image()` + `<canvas>`. ⚠️ `toDataURL` katta rasmda asosiy
 * oqimni 200–500ms bloklaydi — chaqiruvchi progress ko'rsatadi.
 */
const encodeWithImageElement = async (file: File): Promise<string> => {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const { width, height } = fitWithin(image.naturalWidth || image.width, image.naturalHeight || image.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    paint(ctx, image, width, height);
    return canvas.toDataURL(OUTPUT_TYPE, JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(url);
  }
};

/** Base64 satrning haqiqiy bayt hajmi. */
const base64Bytes = (base64: string) => {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
};

const toJpegName = (name: string) => {
  const base = name.replace(/\.[^./\\]+$/, "") || "image";
  return `${base}.jpg`;
};

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (file.size > MAX_SOURCE_BYTES) throw new PrepareImageError("too_large");
  if (!isAccepted(file)) throw new PrepareImageError("unsupported");

  let dataUrl: string | null = null;
  try {
    dataUrl = await encodeWithBitmap(file);
  } catch {
    // Tezkor yo'l ishlamadi (masalan brauzer bu formatni bitmap'ga
    // dekodlay olmadi) — zaxira yo'l bilan yana bir urinish.
    dataUrl = null;
  }
  if (!dataUrl) {
    try {
      dataUrl = await encodeWithImageElement(file);
    } catch {
      throw new PrepareImageError(isHeic(file) ? "heic_unsupported" : "decode_failed");
    }
  }

  // Canvas xotiraga sig'magan bo'lsa `toDataURL` "data:," qaytaradi.
  const base64 = dataUrl.startsWith(`data:${OUTPUT_TYPE}`) ? dataUrl.split(",")[1] ?? "" : "";
  if (!base64) throw new PrepareImageError(isHeic(file) ? "heic_unsupported" : "decode_failed");

  return {
    media_type: OUTPUT_TYPE,
    data_base64: base64,
    preview: dataUrl,
    name: toJpegName(file.name),
    bytes: base64Bytes(base64),
  };
}
