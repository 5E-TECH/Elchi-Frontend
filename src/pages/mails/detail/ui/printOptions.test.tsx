import { renderHook } from "@testing-library/react";
import { FileText, Globe, Mail } from "lucide-react";
import type { ReactElement } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "../../../../i18n";
import { useMailPrintOptions } from "./printOptions";

/** Chop etish menyusi ikonkalari — `design/icon-registry.json` dagi kanonik nomlar (bitta ikonka — bitta ma'no). */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

describe("useMailPrintOptions — icons", () => {
  it("«A4 varaq (12 ta)» — FileText (Hujjat), «Pochta cheki» — Mail (Pochta); no LayoutGrid / Package", () => {
    const { result } = renderHook(() => useMailPrintOptions({ withPostReceipt: true }));
    const icon = (id: string) =>
      (result.current.find((option) => option.id === id)?.icon as ReactElement | undefined)?.type;
    expect(result.current.map((option) => option.id)).toEqual([
      "browser",
      "pdf_100x60",
      "a4",
      "post_receipt",
    ]);
    expect(icon("browser")).toBe(Globe);
    expect(icon("pdf_100x60")).toBe(FileText);
    expect(icon("a4")).toBe(FileText);
    expect(icon("post_receipt")).toBe(Mail);
  });
});
