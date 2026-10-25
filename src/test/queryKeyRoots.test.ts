import { describe, expect, it } from "vitest";
import {
  checkQueryKeyRoots,
  formatReport,
  scanQueryKeyRoots,
  SHARED_ROOTS_RATCHET,
} from "../../scripts/query-key-roots.mjs";

/**
 * KESH KALITI ILDIZI QO'RIQCHISI (sUjPxTzJ) — bitta API endpoint bitta queryKey ildizi ostida. Ikki ildizda
 * saqlansa mutatsiya bittasini yangilaydi, ikkinchisi jimgina eski qoladi (/returns partiya qabulidan keyin).
 * Dvigatel: `scripts/query-key-roots.mjs` (CLI: `npm run query-keys:check`). Eski takrorlar — ratchet ro'yxati.
 */
const scan = scanQueryKeyRoots();

describe("kesh kaliti ildizlari — src (sUjPxTzJ)", () => {
  it("yangi takror yo'q va ratchet ro'yxatida eskirgan yozuv yo'q", () => {
    expect(formatReport(checkQueryKeyRoots(scan))).toBe("");
  });

  it("endpoint chaqiradigan har kalitning ildizi aniqlanadi (qo'riqchi ko'r qolmaydi)", () => {
    expect(scan.unresolved).toEqual([]);
    expect(scan.roots.size).toBeGreaterThan(100);
  });

  it("/returns partiyalar ildizida — partiya mutatsiyasi `[batches]` uni ham yangilaydi", () => {
    expect([...(scan.roots.get("BATCHES.BASE")?.keys() ?? [])]).toEqual(["batches"]);
  });

  it("ratchet faqat haqiqiy takrorlarni saqlaydi (har yozuvda 2+ ildiz)", () => {
    for (const roots of Object.values(SHARED_ROOTS_RATCHET)) expect(roots.length).toBeGreaterThan(1);
  });
});

describe("checkQueryKeyRoots — qoida", () => {
  const roots = new Map([
    ["BATCHES.BASE", new Map([["batches", ["a.ts:1"]], ["return-batches", ["b.ts:2"]]])],
    ["REGIONS.BASE", new Map([["regions", ["c.ts:3"]], ["region-catalog", ["d.ts:4"]]])],
    ["USERS.BASE", new Map([["users", ["e.ts:5"]]])],
  ]);
  const ratchet = { "REGIONS.BASE": ["region-catalog", "regions"], "USERS.BASE": ["user", "users"] };

  it("ro'yxatda yo'q takror — xato, ro'yxatdagisi — o'tadi, bitta ildizga tushgan yozuv — eskirgan", () => {
    const result = checkQueryKeyRoots({ roots }, ratchet);
    expect(result.violations).toEqual([
      {
        endpoint: "BATCHES.BASE",
        roots: { batches: ["a.ts:1"], "return-batches": ["b.ts:2"] },
        extra: ["batches", "return-batches"],
      },
    ]);
    expect(result.stale).toEqual(["USERS.BASE"]);
    expect(formatReport(result)).toContain("✗ BATCHES.BASE — 2 ta kesh ildizi ostida");
  });

  it("ro'yxatdagi endpointga yangi ildiz qo'shilsa — xato", () => {
    const grown = new Map([...roots, ["REGIONS.BASE", new Map([["regions", ["c.ts:3"]], ["region-catalog", ["d.ts:4"]], ["regions-v2", ["f.ts:6"]]])]]);
    expect(checkQueryKeyRoots({ roots: grown }, ratchet).violations.map((v) => [v.endpoint, v.extra])).toContainEqual([
      "REGIONS.BASE",
      ["regions-v2"],
    ]);
  });
});
