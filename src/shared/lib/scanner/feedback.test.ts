import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BEEPOST_SOUNDS,
  getScanFeedbackSound,
  getScanFeedbackTones,
  playScanFeedback,
  playScanSignal,
  resolveScanVoice,
  SCAN_FEEDBACK_EVENT,
  SCAN_VOICE_PHRASES,
  SCANNER_SOUND_IDS,
  scanVoiceUrl,
  type ScanFeedbackDetail,
  type Tone,
} from "./feedback";

const listen = () => {
  const details: ScanFeedbackDetail[] = [];
  const handler = (event: Event) => details.push((event as CustomEvent<ScanFeedbackDetail>).detail);
  window.addEventListener(SCAN_FEEDBACK_EVENT, handler);
  return { details, stop: () => window.removeEventListener(SCAN_FEEDBACK_EVENT, handler) };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("scanner feedback (shared/lib/scanner/feedback)", () => {
  it("hodisa tafsiloti: { type, message, source }", () => {
    const { details, stop } = listen();
    playScanFeedback("success", "Qabul qilindi", "camera");
    playScanFeedback("duplicate");
    stop();
    expect(details).toEqual([
      { type: "success", message: "Qabul qilindi", source: "camera" },
      { type: "duplicate", message: undefined, source: undefined },
    ]);
  });

  it("playScanSignal — faqat ovoz/tebranish, ekrandagi xabar hodisasi yo'q", () => {
    const { details, stop } = listen();
    playScanSignal("error");
    stop();
    expect(details).toEqual([]);
  });

  it("sozlamalardagi ovozlar: BeePost (sukut) birinchi, keyin eski 6 tasi, keyin 6 ta yumshoq (JX0EBpa7)", () => {
    expect(SCANNER_SOUND_IDS).toEqual([
      "beepost",
      "classic",
      "soft",
      "digital",
      "bell",
      "pulse",
      "bright",
      "chime",
      "drop",
      "marimba",
      "bubble",
      "glass",
      "breeze",
    ]);
  });
});

describe("JX0EBpa7 — yumshoq ovoz to'plamlari", () => {
  const SOFT = ["chime", "drop", "marimba", "bubble", "glass", "breeze"] as const;
  const length = (tones: Tone[]) => Math.max(...tones.map((tone) => tone.start + tone.duration));
  const pick = (success: string, error = success) => {
    window.localStorage.setItem("scanner-success-sound", success);
    window.localStorage.setItem("scanner-error-sound", error);
  };

  afterEach(() => window.localStorage.clear());

  it.each(SOFT)("%s: muvaffaqiyat, takror va xato — ≤ 250 ms, past ovoz, keskin to'lqinsiz", (sound) => {
    pick(sound);
    for (const type of ["success", "duplicate", "error"] as const) {
      const tones = getScanFeedbackTones(type);
      expect(tones.length).toBeGreaterThan(0);
      expect(length(tones)).toBeLessThanOrEqual(0.25 + 1e-9);
      for (const tone of tones) {
        expect(tone.volume).toBeLessThanOrEqual(0.15);
        expect(["sine", "triangle"]).toContain(tone.oscillator);
      }
    }
  });

  it.each(SOFT)("%s: «takror» o'z ohangi (muvaffaqiyatdan farqli), xato ham boshqa", (sound) => {
    pick(sound);
    expect(getScanFeedbackTones("duplicate")).not.toEqual(getScanFeedbackTones("success"));
    expect(getScanFeedbackTones("error")).not.toEqual(getScanFeedbackTones("success"));
  });

  it("muvaffaqiyat va xato alohida tanlanadi: success — marimba, error — glass", () => {
    pick("marimba");
    const marimbaSuccess = getScanFeedbackTones("success");
    pick("glass");
    const glassError = getScanFeedbackTones("error");

    pick("marimba", "glass");
    expect(getScanFeedbackTones("success")).toEqual(marimbaSuccess);
    expect(getScanFeedbackTones("error")).toEqual(glassError);
    expect(marimbaSuccess).not.toEqual(glassError);
  });

  it("eski ovozlar o'zgarmagan: classic ohangi va «takror» = muvaffaqiyat (avvalgidek)", () => {
    pick("classic");
    expect(getScanFeedbackTones("success")).toEqual([
      { frequency: 784, endFrequency: 880, start: 0, duration: 0.13, volume: 0.22, oscillator: "triangle" },
      { frequency: 1175, endFrequency: 1318, start: 0.105, duration: 0.16, volume: 0.18, oscillator: "sine" },
    ]);
    for (const sound of ["classic", "soft", "digital", "bell", "pulse", "bright"]) {
      pick(sound);
      expect(getScanFeedbackTones("duplicate")).toBe(getScanFeedbackTones("success"));
    }
  });

  it("zaxira: saqlanmagan yoki noma'lum ID — BeePost fayli, u yuklanmasa classic ohangi", () => {
    pick("classic");
    const classic = getScanFeedbackTones("success");
    pick("eski-ovoz", "???");
    expect(getScanFeedbackSound("success")).toMatchObject({ kind: "file", file: BEEPOST_SOUNDS.success });
    expect(getScanFeedbackTones("success")).toEqual(classic);
    window.localStorage.clear();
    expect(getScanFeedbackSound("error")).toMatchObject({ kind: "file", file: BEEPOST_SOUNDS.error });
    expect(getScanFeedbackTones("success")).toEqual(classic);
    expect(getScanFeedbackTones("error")[0]).toEqual(
      expect.objectContaining({ frequency: 784, oscillator: "square" }),
    );
  });
});

describe("Sozlamalar → Skaner: «Ovoz» va «Tebranish» kalitlari", () => {
  afterEach(() => {
    window.localStorage.clear();
    Reflect.deleteProperty(navigator, "vibrate");
  });

  const mockVibrate = () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrate });
    return vibrate;
  };

  it("sukut — tebranadi (muvaffaqiyat: bir marta qisqa, xato: uch marta)", () => {
    const vibrate = mockVibrate();
    playScanSignal("success");
    playScanSignal("error");
    expect(vibrate).toHaveBeenNthCalledWith(1, 40);
    expect(vibrate).toHaveBeenNthCalledWith(2, [60, 45, 60, 45, 80]);
  });

  it("«Tebranish» o'chiq — tebranmaydi; «Eshitib ko'rish» (preview) baribir signal beradi", () => {
    window.localStorage.setItem("scanner-vibration", "false");
    const vibrate = mockVibrate();
    playScanSignal("success");
    playScanFeedback("error");
    expect(vibrate).not.toHaveBeenCalled();
    playScanFeedback("success", "Qabul qilindi", undefined, { preview: true });
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it("`vibrate: false` (Mini App — Telegram tebratadi) — tebranish yo'q, «Tebranish» yoqiq bo'lsa ham", () => {
    const vibrate = mockVibrate();
    playScanSignal("success", { vibrate: false });
    playScanSignal("error", { vibrate: false });
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("`silent` — faqat ekrandagi xabar (izoh qatori bilan), ovoz va tebranish yo'q", () => {
    const vibrate = mockVibrate();
    const { details, stop } = listen();
    playScanFeedback("error", "Boshqa kuryerga biriktirilgan", "camera", { text: "№10251", silent: true });
    stop();
    expect(vibrate).not.toHaveBeenCalled();
    expect(details).toEqual([
      expect.objectContaining({ type: "error", message: "Boshqa kuryerga biriktirilgan", text: "№10251" }),
    ]);
  });

  it("«Ovoz» o'chiq — ohang chalinmaydi (AudioContext yaratilmaydi), ekrandagi xabar hodisasi qoladi", () => {
    window.localStorage.setItem("scanner-sound-enabled", "false");
    const ctor = vi.fn();
    Object.defineProperty(window, "AudioContext", { configurable: true, writable: true, value: ctor });
    const { details, stop } = listen();
    playScanFeedback("success", "Qabul qilindi");
    stop();
    expect(ctor).not.toHaveBeenCalled();
    expect(details).toHaveLength(1);
    Reflect.deleteProperty(window, "AudioContext");
  });
});

describe("BeePost ovozi va «Ovozli xabar» — mapping (2026-11-04)", () => {
  afterEach(() => window.localStorage.clear());

  it("fayllar `public/sound` da, ilova bazasi bilan (Mini App `/tg/scan` da ham ildizdan)", () => {
    expect(BEEPOST_SOUNDS.success.url).toBe("/sound/scanner/beepost-success.mp3");
    expect(BEEPOST_SOUNDS.error.url).toBe("/sound/scanner/beepost-error.mp3");
    expect(SCAN_VOICE_PHRASES.map(scanVoiceUrl)).toEqual([
      "/sound/voice/uz/received.mp3",
      "/sound/voice/uz/selected.mp3",
      "/sound/voice/uz/assigned.mp3",
      "/sound/voice/uz/added.mp3",
      "/sound/voice/uz/done.mp3",
      "/sound/voice/uz/duplicate.mp3",
      "/sound/voice/uz/missing.mp3",
      "/sound/voice/uz/error.mp3",
    ]);
  });

  it("yangi foydalanuvchi — BeePost: muvaffaqiyat va «takror» — signal fayli, xato va «ro'yxatda yo'q» — xato fayli", () => {
    expect(getScanFeedbackSound("success")).toMatchObject({ kind: "file", file: BEEPOST_SOUNDS.success });
    expect(getScanFeedbackSound("duplicate")).toMatchObject({ kind: "file", file: BEEPOST_SOUNDS.success });
    expect(getScanFeedbackSound("error")).toMatchObject({ kind: "file", file: BEEPOST_SOUNDS.error });
    expect(getScanFeedbackSound("missing")).toMatchObject({ kind: "file", file: BEEPOST_SOUNDS.error });
  });

  it("saqlangan tanlov ustun: chime — ohanglar (fayl emas), «ro'yxatda yo'q» avvalgidek o'z ohangi", () => {
    window.localStorage.setItem("scanner-success-sound", "chime");
    window.localStorage.setItem("scanner-error-sound", "chime");
    expect(getScanFeedbackSound("success").kind).toBe("tones");
    expect(getScanFeedbackSound("missing")).toEqual({ kind: "tones", tones: getScanFeedbackTones("missing") });
    // «Eshitib ko'rish»: saqlangan tanlov o'rniga berilgan ovoz.
    expect(getScanFeedbackSound("success", "beepost")).toMatchObject({ kind: "file", file: BEEPOST_SOUNDS.success });
  });

  it("ibora: aniq berilgani, aks holda tur bo'yicha; `false` — aytilmaydi", () => {
    expect(resolveScanVoice("success")).toBe("done");
    expect(resolveScanVoice("duplicate")).toBe("duplicate");
    expect(resolveScanVoice("missing")).toBe("missing");
    expect(resolveScanVoice("error")).toBe("error");
    expect(resolveScanVoice("success", "received")).toBe("received");
    expect(resolveScanVoice("error", "duplicate")).toBe("duplicate");
    expect(resolveScanVoice("success", false)).toBeNull();
  });
});

/**
 * Soxta WebAudio: chalingan (`start`) manbalar — fayl (manzili bilan) va osilator (boshlang'ich chastotasi), qachon
 * boshlangani va to'xtatilgani. `fetch` — fayl manzilini xom ma'lumotga yozadi, `decodeAudioData` uni o'qiydi.
 * Har test modulni yangidan yuklaydi (AudioContext, dekodlangan fayllar va avlod — modul holati).
 */
describe("BeePost fayllari va «Ovozli xabar» — WebAudio ijrosi", () => {
  type Started = { kind: "file" | "tone"; url: string; frequency: number; at: number; stopped: boolean };
  const started: Started[] = [];
  const decodedFrom = new WeakMap<ArrayBuffer, string>();
  const fetchMock = vi.fn(async (url: string) => ({
    ok: true,
    arrayBuffer: async () => {
      const data = new ArrayBuffer(8);
      decodedFrom.set(data, url);
      return data;
    },
  }));
  const contexts = { created: 0, state: "running" as AudioContextState, resume: () => Promise.resolve() };

  class FakeAudioContext {
    state = contexts.state;
    currentTime = 0;
    destination = {};
    constructor() {
      contexts.created += 1;
    }
    createDynamicsCompressor() {
      const param = { value: 0 };
      return { threshold: param, knee: param, ratio: param, attack: param, release: param, connect: () => undefined };
    }
    createGain() {
      return {
        gain: { value: 0, setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
        connect: () => undefined,
      };
    }
    createOscillator() {
      const entry: Started = { kind: "tone", url: "", frequency: 0, at: 0, stopped: false };
      return {
        type: "sine",
        frequency: {
          setValueAtTime: (value: number) => {
            if (!entry.frequency) entry.frequency = value;
          },
          exponentialRampToValueAtTime: () => undefined,
        },
        connect: () => undefined,
        start: (at: number) => {
          entry.at = at;
          started.push(entry);
        },
        // `stop(end)` — rejadagi tugash; argumentsiz `stop()` — yangi signal uni to'xtatdi.
        stop: (at?: number) => {
          if (at === undefined) entry.stopped = true;
        },
        addEventListener: () => undefined,
      };
    }
    createBufferSource() {
      const entry: Started = { kind: "file", url: "", frequency: 0, at: 0, stopped: false };
      const node = {
        buffer: null as { url: string } | null,
        connect: () => undefined,
        start: (at: number) => {
          entry.url = node.buffer?.url ?? "";
          entry.at = at;
          started.push(entry);
        },
        stop: () => {
          entry.stopped = true;
        },
        addEventListener: () => undefined,
      };
      return node;
    }
    decodeAudioData(data: ArrayBuffer, ok?: (buffer: unknown) => void, fail?: (error: unknown) => void) {
      const url = decodedFrom.get(data);
      if (!url) {
        fail?.(new Error("decode"));
        return Promise.reject(new Error("decode"));
      }
      const buffer = { url, duration: 1.2 };
      ok?.(buffer);
      return Promise.resolve(buffer);
    }
    resume() {
      return contexts.resume();
    }
  }

  const BEEP = "/sound/scanner/beepost-success.mp3";
  const BEEP_ERROR = "/sound/scanner/beepost-error.mp3";
  const voiceUrl = (phrase: string) => `/sound/voice/uz/${phrase}.mp3`;
  const files = () => started.filter((item) => item.kind === "file");
  const live = () => started.filter((item) => !item.stopped);
  const realFetch = globalThis.fetch;

  const load = async () => {
    vi.resetModules();
    return import("./feedback");
  };

  beforeEach(() => {
    started.length = 0;
    contexts.created = 0;
    contexts.state = "running";
    contexts.resume = () => Promise.resolve();
    fetchMock.mockClear();
    window.localStorage.clear();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    Object.defineProperty(window, "AudioContext", { configurable: true, writable: true, value: FakeAudioContext });
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    Reflect.deleteProperty(window, "AudioContext");
    window.localStorage.clear();
  });

  it("yangi foydalanuvchi: BeePost signali (mp3), so'ng ibora signal so'ngach — osilator yo'q", async () => {
    const feedback = await load();
    feedback.playScanFeedback("success", "Qabul qilindi №1", "camera", { voice: "received" });

    await vi.waitFor(() => expect(files().map((item) => item.url)).toEqual([BEEP, voiceUrl("received")]));
    const [beep, voice] = files();
    expect(started.some((item) => item.kind === "tone")).toBe(false);
    // Ibora signalning eshitiladigan qismidan (0,2 s) keyin boshlanadi — ustma-ust emas.
    expect(voice.at - beep.at).toBeGreaterThanOrEqual(BEEPOST_SOUNDS.success.audible);
    expect(voice.at - beep.at).toBeLessThan(0.4);
  });

  it("xato — BeePost xato fayli va tur bo'yicha «Xatolik bo'ldi»; «takror», «yo'q» — o'z iboralari", async () => {
    const feedback = await load();
    feedback.playScanFeedback("error", "Topilmadi");
    await vi.waitFor(() => expect(files().map((item) => item.url)).toEqual([BEEP_ERROR, voiceUrl("error")]));
    // Xato fayli uch «bip» — ibora ~0,62 s dan keyin.
    expect(files()[1].at - files()[0].at).toBeGreaterThanOrEqual(BEEPOST_SOUNDS.error.audible);

    started.length = 0;
    feedback.playScanFeedback("duplicate");
    await vi.waitFor(() => expect(live().map((item) => item.url)).toEqual([BEEP, voiceUrl("duplicate")]));

    started.length = 0;
    feedback.playScanFeedback("missing");
    await vi.waitFor(() => expect(live().map((item) => item.url)).toEqual([BEEP_ERROR, voiceUrl("missing")]));

    started.length = 0;
    feedback.playScanFeedback("success");
    await vi.waitFor(() => expect(live().map((item) => item.url)).toEqual([BEEP, voiceUrl("done")]));
  });

  it("saqlangan tanlov ustun: classic — osilator ohangi, keyin ibora (fayl signali yo'q)", async () => {
    window.localStorage.setItem("scanner-success-sound", "classic");
    const feedback = await load();
    feedback.playScanFeedback("success", undefined, undefined, { voice: "selected" });

    await vi.waitFor(() => expect(files().map((item) => item.url)).toEqual([voiceUrl("selected")]));
    expect(started.filter((item) => item.kind === "tone").map((item) => item.frequency)).toEqual([784, 1175]);
    expect(fetchMock).not.toHaveBeenCalledWith(BEEP);
    // Ibora classic ohangi tugagach (0,265 s).
    expect(files()[0].at).toBeGreaterThan(0.265);
  });

  it("«Ovozli xabar» o'chiq — faqat signal, ibora yuklanmaydi ham", async () => {
    window.localStorage.setItem("scanner-voice-enabled", "false");
    const feedback = await load();
    feedback.playScanFeedback("success", undefined, undefined, { voice: "received" });

    await vi.waitFor(() => expect(files().map((item) => item.url)).toEqual([BEEP]));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(files()).toHaveLength(1);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([BEEP]);
  });

  it("«Ovoz» o'chiq — signal ham, ibora ham yo'q (AudioContext yaratilmaydi, fayl so'ralmaydi); xabar hodisasi qoladi", async () => {
    window.localStorage.setItem("scanner-sound-enabled", "false");
    const feedback = await load();
    const details: ScanFeedbackDetail[] = [];
    const handler = (event: Event) => details.push((event as CustomEvent<ScanFeedbackDetail>).detail);
    window.addEventListener(feedback.SCAN_FEEDBACK_EVENT, handler);
    feedback.playScanFeedback("success", "Qabul qilindi", "keyboard", { voice: "received" });
    window.removeEventListener(feedback.SCAN_FEEDBACK_EVENT, handler);

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(contexts.created).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(started).toEqual([]);
    // Hodisa shakli o'zgarmagan: ibora unga qo'shilmaydi.
    expect(details).toEqual([{ type: "success", message: "Qabul qilindi", source: "keyboard" }]);
  });

  it("tez ketma-ket skan: yangi signal oldingi signal va iborani to'xtatadi — ovozlar ustma-ust tushmaydi", async () => {
    const feedback = await load();
    feedback.playScanFeedback("success", undefined, undefined, { voice: "received" });
    await vi.waitFor(() => expect(files().map((item) => item.url)).toEqual([BEEP, voiceUrl("received")]));

    // Fayllar dekodlangan — ikkinchi skan kutishsiz (sinxron) rejalashtiriladi.
    feedback.playScanFeedback("success", undefined, undefined, { voice: "selected" });
    expect(files().slice(0, 2).every((item) => item.stopped)).toBe(true);
    await vi.waitFor(() => expect(live().map((item) => item.url)).toEqual([BEEP, voiceUrl("selected")]));

    feedback.playScanFeedback("error");
    await vi.waitFor(() => expect(live().map((item) => item.url)).toEqual([BEEP_ERROR, voiceUrl("error")]));
    expect(started.filter((item) => item.url === voiceUrl("selected")).every((item) => item.stopped)).toBe(true);
  });

  it("fayl hali yuklanayotganda yangi skan keldi — eskisi umuman chalinmaydi", async () => {
    const feedback = await load();
    feedback.playScanFeedback("success", undefined, undefined, { voice: "received" });
    feedback.playScanFeedback("error");

    await vi.waitFor(() => expect(files().map((item) => item.url)).toEqual([BEEP_ERROR, voiceUrl("error")]));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(started.map((item) => item.url)).toEqual([BEEP_ERROR, voiceUrl("error")]);
  });

  it("fayl yuklanmasa — zaxira classic ohangi chalinadi, ibora ham (u yuklansa)", async () => {
    fetchMock.mockImplementationOnce(async () => ({ ok: false, arrayBuffer: async () => new ArrayBuffer(0) }));
    const feedback = await load();
    feedback.playScanFeedback("success", undefined, undefined, { voice: "added" });

    await vi.waitFor(() => expect(files().map((item) => item.url)).toEqual([voiceUrl("added")]));
    expect(started.filter((item) => item.kind === "tone").map((item) => item.frequency)).toEqual([784, 1175]);
  });

  it("sekin tarmoq: signal fayli kechiksa skan jim qolmaydi — zaxira ohang darhol, fayl keyingi skanga", async () => {
    let release: () => void = () => undefined;
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementationOnce(
      (url: string) => new Promise((resolve) => (release = () => resolve(original(url)))) as never,
    );
    const feedback = await load();
    feedback.playScanFeedback("error", undefined, undefined, { voice: false });

    await vi.waitFor(() => expect(started.filter((item) => item.kind === "tone").length).toBeGreaterThan(0));
    expect(files()).toEqual([]);

    release();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    started.length = 0;
    feedback.playScanFeedback("error", undefined, undefined, { voice: false });
    await vi.waitFor(() => expect(files().map((item) => item.url)).toEqual([BEEP_ERROR]));
    expect(started.some((item) => item.kind === "tone")).toBe(false);
  });

  it("brauzer ovozni bloklasa (resume rad etiladi) — jim, xato tashlamaydi", async () => {
    contexts.state = "suspended";
    contexts.resume = () => Promise.reject(new Error("NotAllowedError"));
    const feedback = await load();
    expect(() => feedback.playScanFeedback("success", undefined, undefined, { voice: "received" })).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(started).toEqual([]);
  });

  it("«Eshitib ko'rish»: kalitlarga qaramay; ovoz tanlovi `sound` bilan, ibora faqat aniq berilsa", async () => {
    window.localStorage.setItem("scanner-sound-enabled", "false");
    window.localStorage.setItem("scanner-success-sound", "classic");
    const feedback = await load();

    feedback.playScanFeedback("success", "Qabul qilindi", undefined, { preview: true, sound: "beepost" });
    await vi.waitFor(() => expect(files().map((item) => item.url)).toEqual([BEEP]));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(files()).toHaveLength(1);
    // Saqlangan tanlov o'zgarmagan.
    expect(window.localStorage.getItem("scanner-success-sound")).toBe("classic");

    started.length = 0;
    feedback.playScanFeedback("success", "Qabul qilindi", undefined, { preview: true, voice: "received" });
    await vi.waitFor(() => expect(files().map((item) => item.url)).toEqual([voiceUrl("received")]));
    expect(started.filter((item) => item.kind === "tone").map((item) => item.frequency)).toEqual([784, 1175]);
  });

  it("oldindan yuklash: BeePost fayllari va 8 ibora tarmoqdan olinadi, AudioContext yaratilmaydi", async () => {
    const feedback = await load();
    feedback.preloadScanFeedbackAudio();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(10));
    expect(new Set(fetchMock.mock.calls.map(([url]) => url))).toEqual(
      new Set([BEEP, BEEP_ERROR, ...SCAN_VOICE_PHRASES.map(voiceUrl)]),
    );
    expect(contexts.created).toBe(0);
    // Takror chaqiruv qayta so'ramaydi; birinchi skan yuklangan fayllardan.
    feedback.preloadScanFeedbackAudio();
    feedback.playScanFeedback("success");
    await vi.waitFor(() => expect(files().map((item) => item.url)).toEqual([BEEP, voiceUrl("done")]));
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it("oldindan yuklash sozlamaga qarab: ibora o'chiq — faqat BeePost; tanlov classic — hech narsa; ovoz o'chiq — hech narsa", async () => {
    window.localStorage.setItem("scanner-voice-enabled", "false");
    let feedback = await load();
    feedback.preloadScanFeedbackAudio();
    expect(fetchMock.mock.calls.map(([url]) => url).sort()).toEqual([BEEP_ERROR, BEEP]);

    fetchMock.mockClear();
    window.localStorage.setItem("scanner-success-sound", "classic");
    window.localStorage.setItem("scanner-error-sound", "glass");
    feedback = await load();
    feedback.preloadScanFeedbackAudio();
    expect(fetchMock).not.toHaveBeenCalled();

    window.localStorage.clear();
    window.localStorage.setItem("scanner-sound-enabled", "false");
    feedback = await load();
    feedback.preloadScanFeedbackAudio();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
