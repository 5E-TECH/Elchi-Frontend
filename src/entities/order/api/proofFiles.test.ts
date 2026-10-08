import { describe, expect, it } from "vitest";
import { proofFileName, proofKind, readProofFiles } from "./proofFiles";

describe("proofFiles — yordamchilar", () => {
  it("kengaytma bo'yicha rasm / video / fayl ajratiladi (registr muhim emas)", () => {
    expect(proofKind("proof-1-a.png")).toBe("image");
    expect(proofKind("proof-1-a.JPEG")).toBe("image");
    expect(proofKind("proof-1-a.heic")).toBe("image");
    expect(proofKind("proof-1-a.mp4")).toBe("video");
    expect(proofKind("proof-1-a.MOV")).toBe("video");
    expect(proofKind("proof-1-a.webm")).toBe("video");
    expect(proofKind("proof-1-a.pdf")).toBe("file");
    expect(proofKind("proof-1-no-extension")).toBe("file");
  });

  it("⭐ buzuq qiymat karta chiqarmaydi: massiv emas / bo'sh / takror / satr emas tashlanadi", () => {
    expect(readProofFiles(null)).toEqual([]);
    expect(readProofFiles(undefined)).toEqual([]);
    expect(readProofFiles("proof-a.png")).toEqual([]);
    expect(readProofFiles([])).toEqual([]);
    expect(readProofFiles(["proof-a.png", " ", "", 42, null, "proof-a.png", " proof-b.mp4 "])).toEqual([
      "proof-a.png",
      "proof-b.mp4",
    ]);
  });

  it("ko'rsatish uchun nom: vaqt va uuid prefiksi olib tashlanadi", () => {
    expect(
      proofFileName(
        "proof-1784557173685-10818f3a-6482-4bb3-b092-f85b18057d9b-Screenshot_from_2025-12-05_22-03-56.png",
      ),
    ).toBe("Screenshot_from_2025-12-05_22-03-56.png");
    // Boshqa shakl — kalitning o'zi.
    expect(proofFileName("cod-123.png")).toBe("cod-123.png");
  });
});
