import { describe, expect, it } from "vitest";
import { SCANNER_KEY_GAP_MS } from "../../../shared/lib/useKeyboardScanner";
import {
  GO_SHORTCUT_WINDOW_MS,
  createHeaderShortcutState,
  nextHeaderShortcut,
  type HeaderShortcut,
} from "./headerShortcuts";

const ALL = { orders: true, batches: true };

/** Belgilarni berilgan oraliq bilan «bosish»; har belgining natijasi. */
const press = (keys: string, gapMs: number, allowed = ALL, start = 1000) => {
  const state = createHeaderShortcutState();
  return [...keys].map((key, index) => nextHeaderShortcut(state, key, start + index * gapMs, allowed));
};
const fired = (results: Array<HeaderShortcut | null>) => results.filter(Boolean);

const HUMAN_MS = 150;
const SCANNER_MS = 8;

describe("nextHeaderShortcut — odam bosgan tugmalar", () => {
  it("G → O — buyurtmalar, G → B — paketlar, ? — ro'yxat", () => {
    expect(press("go", HUMAN_MS)).toEqual([null, "orders"]);
    expect(press("gb", HUMAN_MS)).toEqual([null, "batches"]);
    expect(press("?", HUMAN_MS)).toEqual(["help"]);
    expect(press("GO", HUMAN_MS)).toEqual([null, "orders"]);
  });

  it("ruxsat yo'q rolda — hech narsa (G → O logistda, G → B menejer bo'lmaganda)", () => {
    expect(fired(press("go", HUMAN_MS, { orders: false, batches: true }))).toEqual([]);
    expect(fired(press("gb", HUMAN_MS, { orders: true, batches: false }))).toEqual([]);
  });

  it("G dan keyin boshqa belgi — ketma-ketlik uziladi (G x O emas)", () => {
    expect(fired(press("gxo", HUMAN_MS))).toEqual([]);
    // G qayta bosilsa — kutish yangidan boshlanadi.
    expect(press("ggo", HUMAN_MS)).toEqual([null, null, "orders"]);
  });

  it("G dan keyin 900 ms dan kech — buyurtmalar emas", () => {
    expect(fired(press("go", GO_SHORTCUT_WINDOW_MS + 1))).toEqual([]);
    expect(press("go", GO_SHORTCUT_WINDOW_MS)).toEqual([null, "orders"]);
  });

  it("chegara: oldingi belgidan aynan SCANNER_KEY_GAP_MS keyin — odam (tezkor tugma ishlaydi)", () => {
    expect(press("go", SCANNER_KEY_GAP_MS)).toEqual([null, "orders"]);
    expect(fired(press("go", SCANNER_KEY_GAP_MS - 1))).toEqual([]);
  });

  it("G ni bosib turish (avtotakror ~33 ms) — skan emas: qo'yib, O bosilsa buyurtmalar", () => {
    const state = createHeaderShortcutState();
    expect(nextHeaderShortcut(state, "g", 1000, ALL)).toBeNull();
    // OS avtotakrori: 500 ms dan keyin har ~33 ms — 900 ms oynadan uzoqroq ushlab turilgan.
    for (let at = 1500; at <= 2400; at += 33) expect(nextHeaderShortcut(state, "g", at, ALL, true)).toBeNull();
    expect(nextHeaderShortcut(state, "o", 2400 + 150, ALL)).toBe("orders");
  });

  it("«?» ni bosib turish — ro'yxat bir marta (takror yangi tezkor tugma emas)", () => {
    const state = createHeaderShortcutState();
    expect(nextHeaderShortcut(state, "?", 1000, ALL)).toBe("help");
    expect(nextHeaderShortcut(state, "?", 1500, ALL, true)).toBeNull();
    expect(nextHeaderShortcut(state, "?", 1533, ALL, true)).toBeNull();
  });

  it("avtotakror kutilmagan G ni boshlamaydi (faqat bosib turilgan G ni yangilaydi)", () => {
    const state = createHeaderShortcutState();
    expect(nextHeaderShortcut(state, "x", 1000, ALL)).toBeNull();
    expect(nextHeaderShortcut(state, "g", 1500, ALL, true)).toBeNull();
    expect(nextHeaderShortcut(state, "o", 1650, ALL)).toBeNull();
  });
});

describe("nextHeaderShortcut — ⭐ skaner yozgan matn tezkor tugma emas", () => {
  it("market QR (MCR- + base64url, ichida «g…o» va «gb») — hech qanday o'tish yo'q", () => {
    const marketQr = "MCR-Jx3gQo9_kGb2Vt-ogG7oq4Lw0zgOaY1sNcE8hRuFb5d";
    expect(fired(press(marketQr, SCANNER_MS))).toEqual([]);
  });

  it("skan G bilan boshlansa va keyin O kelsa ham — yo'q", () => {
    expect(fired(press("go123456", SCANNER_MS))).toEqual([]);
  });

  it("skan ichidagi «?» (havola) — ro'yxat ochilmaydi", () => {
    expect(fired(press("https://x.uz/scan?t=abc", SCANNER_MS))).toEqual([]);
  });

  it("skandan keyin odam G → O bossa — ishlaydi (skan holatni buzmaydi)", () => {
    const state = createHeaderShortcutState();
    let at = 1000;
    for (const key of "MCR-gooo") {
      at += SCANNER_MS;
      expect(nextHeaderShortcut(state, key, at, ALL)).toBeNull();
    }
    expect(nextHeaderShortcut(state, "g", at + 500, ALL)).toBeNull();
    expect(nextHeaderShortcut(state, "o", at + 650, ALL)).toBe("orders");
  });
});
