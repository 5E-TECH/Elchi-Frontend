import { describe, expect, it } from "vitest";
import { assertModeAllowed, assertUpdateAllowed, snapshotAction, UPDATE_REFUSED, updateModeFromArgv } from "./policy";

/** Vizual baseline siyosati: lokal mashinada baseline hech qachon yozilmaydi (docs/DESIGN_SYSTEM.md §12.5). */
describe("vizual baseline siyosati", () => {
  it("CLI'dagi yangilash rejimini o'qiydi (-u, =qiymat, alohida qiymat, qiymatsiz)", () => {
    expect(updateModeFromArgv(["test", "-c", "playwright.visual.config.ts"])).toBeNull();
    expect(updateModeFromArgv(["test", "-u"])).toBe("changed");
    expect(updateModeFromArgv(["test", "--update-snapshots"])).toBe("changed");
    expect(updateModeFromArgv(["test", "--update-snapshots", "--project", "desktop-light"])).toBe("changed");
    expect(updateModeFromArgv(["test", "--update-snapshots=all"])).toBe("all");
    expect(updateModeFromArgv(["test", "--update-snapshots", "missing"])).toBe("missing");
    expect(updateModeFromArgv(["test", "--update-snapshots=none"])).toBe("none");
    expect(updateModeFromArgv(["test", "-u", "all"])).toBe("all");
    expect(updateModeFromArgv(["test", "-u", "--project", "phone-dark"])).toBe("changed");
    expect(updateModeFromArgv(["test", "-uall"])).toBe("all");
    expect(updateModeFromArgv(["test", "-uchanged"])).toBe("changed");
  });

  it("⭐ Docker'dan tashqarida baseline yozadigan har rejim rad etiladi", () => {
    for (const argv of [["-u"], ["--update-snapshots"], ["--update-snapshots=all"], ["--update-snapshots", "changed"], ["--update-snapshots=missing"]]) {
      expect(() => assertUpdateAllowed(argv, {}), argv.join(" ")).toThrow(UPDATE_REFUSED);
      expect(() => assertUpdateAllowed(argv, { VISUAL_IN_DOCKER: "0" }), argv.join(" ")).toThrow(UPDATE_REFUSED);
    }
  });

  it("⭐ argv'ni aylanib o'tgan rejim ham (Playwright tahlil qilgan qiymat, `-xu`) Docker'dan tashqarida rad etiladi", () => {
    for (const mode of ["all", "changed", "missing"]) {
      expect(() => assertModeAllowed(mode, {}), mode).toThrow(UPDATE_REFUSED);
      expect(() => assertModeAllowed(mode, { VISUAL_IN_DOCKER: "1" }), mode).not.toThrow();
    }
    expect(() => assertModeAllowed("none", {})).not.toThrow();
    expect(() => assertUpdateAllowed(["-uall"], {})).toThrow(UPDATE_REFUSED);
  });

  it("bayroqsiz, `none` rejimi va CI Docker obrazidagi yangilash o'tadi", () => {
    expect(() => assertUpdateAllowed([], {})).not.toThrow();
    expect(() => assertUpdateAllowed(["--update-snapshots=none"], {})).not.toThrow();
    expect(() => assertUpdateAllowed(["--update-snapshots=all"], { VISUAL_IN_DOCKER: "1" })).not.toThrow();
  });

  it("⭐ baseline yo'q PR yugurishi neytral (yiqilmaydi), bor bo'lsa solishtiriladi", () => {
    expect(snapshotAction({ dry: false, updateSnapshots: "none", baselineExists: false })).toBe("neutral");
    expect(snapshotAction({ dry: false, updateSnapshots: "none", baselineExists: true })).toBe("compare");
    // Yangilash rejimlari (faqat CI Docker) — Playwright o'zi yozadi.
    expect(snapshotAction({ dry: false, updateSnapshots: "all", baselineExists: false })).toBe("compare");
    expect(snapshotAction({ dry: false, updateSnapshots: "changed", baselineExists: false })).toBe("compare");
    expect(snapshotAction({ dry: false, updateSnapshots: "missing", baselineExists: false })).toBe("compare");
  });

  it("VISUAL_DRY=1 hech qachon solishtirmaydi va yozmaydi", () => {
    for (const updateSnapshots of ["none", "all", "changed", "missing"] as const) {
      expect(snapshotAction({ dry: true, updateSnapshots, baselineExists: true })).toBe("dry");
      expect(snapshotAction({ dry: true, updateSnapshots, baselineExists: false })).toBe("dry");
    }
  });
});
