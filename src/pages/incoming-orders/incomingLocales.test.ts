import { describe, expect, it } from "vitest";
import uz from "../../locales/uz/common.json";
import ru from "../../locales/ru/common.json";
import en from "../../locales/en/common.json";

/**
 * «Kiruvchi posilkalar» matnlari uch tilda bir xil kalitlar bilan (`common:incoming.*`).
 * Ko'plik shakllari (`_one`, `_few`, `_many`, `_other`) bitta kalit hisoblanadi: ruscha/inglizcha
 * shakllar o'zbekchadagi bitta kalitga to'g'ri keladi.
 */
const baseKeys = (block: Record<string, string>) =>
  [...new Set(Object.keys(block).map((key) => key.replace(/_(zero|one|two|few|many|other)$/, "")))].sort();

describe("common:incoming — uz/ru/en kalitlari", () => {
  it("uch tilda bir xil kalitlar", () => {
    const keys = baseKeys(uz.incoming);
    expect(baseKeys(ru.incoming)).toEqual(keys);
    expect(baseKeys(en.incoming)).toEqual(keys);
  });

  it("o'zbekcha matnlar maketdagidek (fragment — matn manbai)", () => {
    expect(uz.incoming.sourcesIntro).toBe("Qaysi manbadan qabul qilamiz? Manbani tanlang, so'ng posilkalarni skanerlang.");
    expect(uz.incoming.idleTitle).toBe("Ulangan manbalar — hozircha posilka yo'q");
    expect(uz.incoming.scannerReady).toBe("USB skaner tayyor");
    expect(uz.incoming.scannerHint).toBe("Skaner o'qigan kod shu maydonga o'zi tushadi");
    expect(uz.incoming.thresholdNote).toBe(
      "Tik chiziq — 3 kunlik chegara: undan uzoq kutgan posilka unutilgan hisoblanadi va sariq belgilanadi",
    );
    expect(uz.incomingSubtitle).toBe("QR kodni skanerlab tizimga qabul qiling");
    expect(uz.incomingScanPlaceholder).toBe("QR kodni skanerlang yoki kiriting...");
  });
});
