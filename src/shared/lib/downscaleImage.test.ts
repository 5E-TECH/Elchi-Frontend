import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  JPEG_QUALITY,
  MAX_IMAGE_DIM,
  MAX_SOURCE_BYTES,
  PrepareImageError,
  fitWithin,
  prepareImage,
} from "./downscaleImage";

/**
 * AI BUYURTMA — RASMNI TAYYORLASH (KbPY1CVa).
 *
 * jsdom'da canvas yo'q, shu sabab `createImageBitmap`, `OffscreenCanvas`,
 * `Image` va `HTMLCanvasElement` mock qilinadi. Haqiqiy kodlash (hajm,
 * oq fon piksellari) haqiqiy brauzerda alohida tekshirilgan.
 */

type Call = { op: string; args: unknown[]; fillStyle?: string };

const makeCtx = (calls: Call[]) => {
  const ctx = {
    fillStyle: "#000000",
    fillRect: (...args: unknown[]) => calls.push({ op: "fillRect", args, fillStyle: ctx.fillStyle }),
    drawImage: (...args: unknown[]) => calls.push({ op: "drawImage", args }),
  };
  return ctx;
};

const file = (name: string, type: string, size = 1024) => {
  const f = new File([new Uint8Array(Math.min(size, 2048))], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
};

let calls: Call[];
let canvases: Array<{ width: number; height: number; quality?: number; type?: string }>;
let bitmapSize: { width: number; height: number };
let bitmapFails: boolean;
let imageFails: boolean;
let created: number;
let revoked: number;

class OffscreenCanvasMock {
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    canvases.push({ width, height });
  }
  getContext() {
    return makeCtx(calls);
  }
  convertToBlob(options: { type: string; quality: number }) {
    const last = canvases[canvases.length - 1];
    last.type = options.type;
    last.quality = options.quality;
    return Promise.resolve(new Blob(["JPEG-BYTES"], { type: options.type }));
  }
}

class ImageMock {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = bitmapSize.width;
  naturalHeight = bitmapSize.height;
  width = bitmapSize.width;
  height = bitmapSize.height;
  set src(_value: string) {
    setTimeout(() => (imageFails ? this.onerror?.() : this.onload?.()), 0);
  }
}

beforeEach(() => {
  calls = [];
  canvases = [];
  bitmapSize = { width: 4032, height: 3024 };
  bitmapFails = false;
  imageFails = false;
  created = 0;
  revoked = 0;
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(() =>
      bitmapFails
        ? Promise.reject(new Error("decode"))
        : Promise.resolve({ ...bitmapSize, close: vi.fn() }),
    ),
  );
  vi.stubGlobal("OffscreenCanvas", OffscreenCanvasMock);
  vi.stubGlobal("Image", ImageMock);
  URL.createObjectURL = vi.fn(() => {
    created += 1;
    return `blob:mock-${created}`;
  });
  URL.revokeObjectURL = vi.fn(() => {
    revoked += 1;
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => makeCtx(calls) as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(function (
    this: HTMLCanvasElement,
    type?: string,
    quality?: unknown,
  ) {
    canvases.push({ width: this.width, height: this.height, type, quality: Number(quality) });
    return `data:${type};base64,SlBFRy1CWVRFUw==`;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fitWithin", () => {
  it("uzun tomonni 1568 ga tushiradi, nisbatni saqlaydi, kichikni kattalashtirmaydi", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1568, height: 1176 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1176, height: 1568 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe("prepareImage", () => {
  it("12MB 4032×3024 JPEG → uzun tomoni 1568, JPEG 0.92 bilan qayta kodlanadi", async () => {
    const result = await prepareImage(file("IMG_0001.JPG", "image/jpeg", 12 * 1024 * 1024));

    expect(canvases).toEqual([{ width: MAX_IMAGE_DIM, height: 1176, type: "image/jpeg", quality: JPEG_QUALITY }]);
    expect(result.bytes).toBe(10); // "JPEG-BYTES"
  });

  it("shaffof PNG — AVVAL oq fon chiziladi, keyin rasm (qora fon yo'q)", async () => {
    bitmapSize = { width: 500, height: 400 };
    await prepareImage(file("logo.png", "image/png"));

    expect(calls.map((c) => c.op)).toEqual(["fillRect", "drawImage"]);
    expect(calls[0].fillStyle).toBe("#ffffff");
    expect(calls[0].args).toEqual([0, 0, 500, 400]);
  });

  it("`data_base64` da `data:...;base64,` prefiksi yo'q, `preview` esa to'liq data URL", async () => {
    const result = await prepareImage(file("a.jpg", "image/jpeg"));

    expect(result.data_base64).toBe(btoa("JPEG-BYTES"));
    expect(result.data_base64).not.toMatch(/^data:/);
    expect(result.preview).toBe(`data:image/jpeg;base64,${btoa("JPEG-BYTES")}`);
  });

  it.each([
    ["a.png", "image/png"],
    ["b.webp", "image/webp"],
    ["c.jpeg", "image/jpeg"],
  ])("`media_type` har doim image/jpeg (%s)", async (name, type) => {
    const result = await prepareImage(file(name, type));
    expect(result.media_type).toBe("image/jpeg");
    expect(result.name).toMatch(/\.jpg$/);
  });

  it("30MB dan katta fayl → PrepareImageError('too_large'), dekodlashga urinilmaydi", async () => {
    const error = await prepareImage(file("big.jpg", "image/jpeg", MAX_SOURCE_BYTES + 1)).catch((e) => e);

    expect(error).toBeInstanceOf(PrepareImageError);
    expect(error.code).toBe("too_large");
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it.each([
    ["hujjat.pdf", "application/pdf"],
    ["video.mp4", "video/mp4"],
    ["anim.gif", "image/gif"],
  ])("%s → PrepareImageError('unsupported')", async (name, type) => {
    const error = await prepareImage(file(name, type)).catch((e) => e);
    expect(error).toBeInstanceOf(PrepareImageError);
    expect(error.code).toBe("unsupported");
  });

  it("buzuq rasm → PrepareImageError('decode_failed') (crash emas), object URL bo'shatiladi", async () => {
    bitmapFails = true;
    imageFails = true;

    const error = await prepareImage(file("broken.jpg", "image/jpeg")).catch((e) => e);

    expect(error).toBeInstanceOf(PrepareImageError);
    expect(error.code).toBe("decode_failed");
    expect(created).toBe(1);
    expect(revoked).toBe(1);
  });

  it("HEIC'ni brauzer dekodlay olmasa → 'heic_unsupported' (bo'sh type + .heic kengaytma ham)", async () => {
    bitmapFails = true;
    imageFails = true;

    const typed = await prepareImage(file("IMG_1.HEIC", "image/heic")).catch((e) => e);
    const untyped = await prepareImage(file("IMG_2.heic", "")).catch((e) => e);

    expect(typed.code).toBe("heic_unsupported");
    expect(untyped.code).toBe("heic_unsupported");
  });

  it("`createImageBitmap` yo'q muhitda zaxira yo'l bir xil natija beradi", async () => {
    const fast = await prepareImage(file("a.jpg", "image/jpeg", 12 * 1024 * 1024));
    const fastCanvas = canvases[0];

    canvases = [];
    vi.stubGlobal("createImageBitmap", undefined);
    const fallback = await prepareImage(file("a.jpg", "image/jpeg", 12 * 1024 * 1024));

    expect(canvases).toEqual([fastCanvas]);
    expect(fallback).toEqual(fast);
    expect(created).toBe(1);
    expect(revoked).toBe(1);
  });

  it("har `createObjectURL` ga `revokeObjectURL` to'g'ri keladi (xato bo'lganda ham)", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    await prepareImage(file("ok.png", "image/png"));
    imageFails = true;
    await prepareImage(file("bad.png", "image/png")).catch(() => undefined);

    expect(created).toBe(2);
    expect(revoked).toBe(2);
  });

  it("kichik (200KB) skrinshot ham canvas orqali JPEG 0.92 ga qayta kodlanadi", async () => {
    bitmapSize = { width: 1080, height: 720 };
    const result = await prepareImage(file("screenshot.png", "image/png", 200 * 1024));

    expect(canvases).toEqual([{ width: 1080, height: 720, type: "image/jpeg", quality: 0.92 }]);
    expect(result.media_type).toBe("image/jpeg");
  });
});
