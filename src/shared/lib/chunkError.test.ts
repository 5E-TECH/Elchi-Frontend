import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHUNK_RELOAD_GUARD_MS, isChunkLoadError, reloadForNewVersion } from "./chunkError";

describe("chunkError (G6F68ti6, 6-band)", () => {
  const reload = vi.fn();

  beforeEach(() => {
    window.sessionStorage.clear();
    reload.mockReset();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload } as Location);
  });

  afterEach(() => vi.restoreAllMocks());

  it("Chrome / Safari / Firefox chunk xatolari va ChunkLoadError taniladi; oddiy xato — yo'q", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: https://x/assets/a-1.js"))).toBe(true);
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(new TypeError("error loading dynamically imported module"))).toBe(true);
    expect(isChunkLoadError(Object.assign(new Error("x"), { name: "ChunkLoadError" }))).toBe(true);
    expect(isChunkLoadError(new Error("Unable to preload CSS for /assets/b.css"))).toBe(true);
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });

  it("onlayn — bir marta qayta yuklaydi; 30 s ichida takror yo'q, keyin yana mumkin", () => {
    expect(reloadForNewVersion(1_000_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reloadForNewVersion(1_000_000 + CHUNK_RELOAD_GUARD_MS - 1)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reloadForNewVersion(1_000_000 + CHUNK_RELOAD_GUARD_MS + 1)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("oflayn — qayta yuklamaydi", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect(reloadForNewVersion()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
